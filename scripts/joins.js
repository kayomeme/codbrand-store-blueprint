/**
 * joins.js — the JOINS between a page's blocks, checked mechanically instead of by eye.
 *
 * Paste this whole file into the browser console of the page you are checking, or run it through your
 * browser tool's evaluate, like measure.js. It prints its findings as JSON and returns them.
 * **Zero findings is the pass.** A finding you decide is right for this design needs a reason, in
 * your report, per finding.
 *
 * Run it on every page you changed, at 1440×900 and 390×844, and on a page with collapsibles (a size
 * guide, an order summary, an FAQ) ONCE WITH EVERY ONE OPEN AND ONCE WITH EVERY ONE CLOSED — a closed
 * block draws its borders somewhere else than an open one. It reads `open_collapsibles` back to you so
 * you can see which state you measured.
 *
 * WHAT IT FLAGS — each one survives every per-setting check and every screenshot of a block alone:
 *
 *   touching-boxes      two visible boxes stacked one on the other with 0px between them, where at
 *                       least one draws a border on that side or their backgrounds differ. Measured:
 *                       an order summary switched on sat flush on the form box below it, its closed
 *                       state drawing its bottom border along the box's top edge.
 *   stacked-dividers    two horizontal rules (a top/bottom border with no side borders, or an <hr>)
 *                       within 24px of each other, from two different boxes — or a rule within 12px of
 *                       a bordered box's edge. Two bordered cards 16px apart are a list, not this. Measured:
 *                       a toggle's bottom rule, then a summary header's top AND bottom rules, then the
 *                       form's border: four lines in under 100px, each block styled as if alone.
 *   browser-default     a heading whose margin or weight, or a link whose colour, comes from the
 *                       browser's own stylesheet: no rule of the page sets it. Measured: two section
 *                       titles taking 1em margins from the browser, and a link in browser blue.
 *                       Where a stylesheet cannot be read (another origin), a finding is marked
 *                       `certain: false` — "could not tell", never "clean".
 *   dead-anchor         an in-page link `href="#id"` whose target is not on the page, or is hidden.
 *                       Measured: a summary linking to a shipping block that was switched off.
 *
 * No dependencies. It only reads the page.
 */
(() => {
  'use strict';

  const W = document.documentElement.clientWidth || window.innerWidth;
  const q = (sel, root = document) => root.querySelector(sel);
  const qa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const box = (el) => el.getBoundingClientRect();
  const round = (n) => Math.round(n);
  const text = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  const describe = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '')
    + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const isShown = (el) => {
    if (!el || !el.isConnected) return false;
    // checkVisibility also knows content the browser keeps un-rendered, e.g. inside a closed <details>.
    if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
    for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
    }
    const r = box(el);
    return r.width > 0 && r.height > 0;
  };
  const parseColour = (v) => {
    const m = String(v).match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/);
    if (!m) return null;
    const a = m[4] === undefined ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
    return { r: +m[1], g: +m[2], b: +m[3], a };
  };
  const sameColour = (a, b) => a && b && Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) <= 6;
  const paints = (cs) => { const c = parseColour(cs.backgroundColor); return !!(c && c.a > 0.05) || cs.backgroundImage !== 'none'; };
  const edge = (cs, side) => {
    const w = parseFloat(cs[`border${side}Width`]);
    const style = cs[`border${side}Style`];
    const c = parseColour(cs[`border${side}Color`]);
    return w >= 0.5 && style !== 'none' && style !== 'hidden' && c && c.a > 0.05 ? { w, c } : null;
  };
  // What is painted behind an element (its nearest painted ancestor), for "do the two backgrounds differ".
  const behind = (el) => {
    for (let a = el.parentElement; a; a = a.parentElement) {
      const c = parseColour(getComputedStyle(a).backgroundColor);
      if (c && c.a > 0.5) return c;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };
  const SKIP = new Set(['TD', 'TH', 'TR', 'THEAD', 'TBODY', 'TFOOT', 'TABLE', 'OPTION', 'SVG', 'PATH', 'IMG', 'BR', 'SCRIPT', 'STYLE']);
  const findings = [];
  const flag = (check, where, detail, extra = {}) => findings.push(Object.assign({ check, where, detail }, extra));

  // ── the boxes: visible, reasonably wide, not fixed to the screen ──────────────────────────────
  const minWidth = Math.min(200, W * 0.5);
  const boxes = qa('body *').filter((el) => {
    if (SKIP.has(el.tagName.toUpperCase()) || !isShown(el)) return false;
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed' || cs.display.startsWith('inline')) return false;
    const r = box(el);
    return r.width >= minWidth && r.height >= 16;
  }).map((el) => {
    const cs = getComputedStyle(el);
    return { el, r: box(el), top: edge(cs, 'Top'), bottom: edge(cs, 'Bottom'), sides: !!(edge(cs, 'Left') && edge(cs, 'Right')),
      bg: paints(cs) ? parseColour(cs.backgroundColor) : null };
  });
  const overlapX = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const related = (a, b) => a.el.contains(b.el) || b.el.contains(a.el);
  // The outermost edge-to-edge section around an element (below <body>), or null.
  const bandOf = (el) => {
    let band = null;
    for (let a = el; a && a !== document.body; a = a.parentElement) {
      const r = box(a);
      if (r.left <= 1 && r.right >= W - 1) band = a;
    }
    return band;
  };
  const commonWidth = (x, y) => {
    let common = x.parentElement;
    while (common && !common.contains(y)) common = common.parentElement;
    return common ? box(common).width : W;
  };
  const partsOfOneBox = (x, y) => {
    let common = x.parentElement;
    while (common && !common.contains(y)) common = common.parentElement;
    if (!common || common === document.body || common === document.documentElement) return false;
    const cs = getComputedStyle(common);
    return paints(cs) || !!(edge(cs, 'Left') && edge(cs, 'Right'));
  };

  // ── touching-boxes ────────────────────────────────────────────────────────────────────────────
  const byTop = new Map();
  for (const b of boxes) { const k = round(b.r.top); byTop.set(k, (byTop.get(k) || []).concat(b)); }
  const seams = [];
  for (const a of boxes) {
    const k = round(a.r.bottom);
    for (const b of [...(byTop.get(k - 1) || []), ...(byTop.get(k) || []), ...(byTop.get(k + 1) || [])]) {
      if (a === b || related(a, b)) continue;
      const gap = b.r.top - a.r.bottom;
      if (Math.abs(gap) > 0.5 || overlapX(a.r, b.r) < Math.min(a.r.width, b.r.width) * 0.5) continue;
      // Nothing may sit flush ON a box (a background, or borders on its sides), and a box may not end
      // flush on what follows it. A rule with no sides over plain content — a header's divider over the
      // body of its own block — is design, not a seam. Measured on the store: open, the summary's plain
      // body ended exactly on the form box's top border; closed, its header's rule lay on that border.
      const boxLike = (x) => !!(x.bg || x.sides);
      if (!boxLike(a) && !boxLike(b)) continue;
      // Two full-bleed sections stacking is how a page is built, not a seam: skip a pair that meets
      // exactly where their two edge-to-edge sections meet. (Not "90% of the width" — on a phone every
      // block is that wide, and the seam this exists for would vanish.)
      const [ba, bb] = [bandOf(a.el), bandOf(b.el)];
      if (ba && bb && ba !== bb && Math.abs(box(ba).bottom - box(bb).top) <= 1) continue;
      // Parts of ONE styled box (a card's image area on its body, a hero's rows) may touch: skip a pair
      // whose nearest common ancestor paints a background or has side borders.
      if (partsOfOneBox(a.el, b.el)) continue;
      const drawn = a.bottom || b.top;
      const differ = (a.bg || b.bg) && !sameColour(a.bg || behind(a.el), b.bg || behind(b.el));
      // A LINE on the seam always counts. A change of background alone counts only between blocks
      // narrower than the container they share: sections spanning it and changing colour is page
      // composition (in a boxed layout too, where every section is narrower than the window).
      const shared = commonWidth(a.el, b.el);
      if (!drawn && !(differ && a.r.width < shared * 0.9 && b.r.width < shared * 0.9)) continue;
      seams.push({ a, b, y: round(a.r.bottom) });
    }
  }
  // One finding per seam: the outermost pair meeting at that line.
  const seen = new Set();
  seams.sort((x, y) => (y.a.r.width * y.a.r.height + y.b.r.width * y.b.r.height) - (x.a.r.width * x.a.r.height + x.b.r.width * x.b.r.height));
  for (const s of seams) {
    const key = `${s.y}:${round(Math.max(s.a.r.left, s.b.r.left) / 40)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    flag('touching-boxes', `${describe(s.a.el)} → ${describe(s.b.el)}`,
      `0px between them at y=${s.y + round(window.scrollY)}px${s.a.bottom ? `; the upper box draws a ${s.a.bottom.w}px bottom border` : ''}${s.b.top ? `; the lower box draws a ${s.b.top.w}px top border` : ''} — give one of them a margin, or set their spacing`);
  }

  // ── stacked-dividers ──────────────────────────────────────────────────────────────────────────
  // A DIVIDER is a top or bottom border on a box with no side borders (a rule across the page). A box
  // bordered on its sides has an OUTLINE: two outlined cards 16px apart are a list, not stacked
  // dividers — an outline counts only when a divider lies directly on it.
  const lines = [];
  for (const b of boxes) {
    if (b.r.height < 24) continue; // a chip or an input: its own top and bottom are not dividers
    const kind = b.sides ? 'outline' : 'divider';
    if (b.top) lines.push({ y: b.r.top, left: b.r.left, right: b.r.right, el: b.el, side: 'top', kind });
    if (b.bottom) lines.push({ y: b.r.bottom, left: b.r.left, right: b.r.right, el: b.el, side: 'bottom', kind });
  }
  for (const hr of qa('hr').filter(isShown)) {
    const r = box(hr);
    if (r.width >= minWidth) lines.push({ y: r.top + r.height / 2, left: r.left, right: r.right, el: hr, side: 'rule', kind: 'divider' });
  }
  lines.sort((a, b) => a.y - b.y);
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length && lines[j].y - lines[i].y <= 24; j++) {
      const [a, b] = [lines[i], lines[j]];
      if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
      if (overlapX(a, b) < Math.min(a.right - a.left, b.right - b.left) * 0.5) continue;
      if (a.kind === 'outline' && b.kind === 'outline') continue;
      // A divider close to an outline reads as a double line too — measured on a store: a toggle's rule
      // 8px above a bordered offer card. Up to 12px (half the divider-to-divider distance).
      if ((a.kind === 'outline' || b.kind === 'outline') && b.y - a.y > 12) continue;
      const d = round(b.y - a.y);
      flag('stacked-dividers', `${describe(a.el)} (${a.side}) + ${describe(b.el)} (${b.side})`,
        d <= 1 ? `two lines lying on each other at y=${round(a.y + window.scrollY)}px — one block's divider directly on the next block's border`
          : `two lines ${d}px apart at y=${round(a.y + window.scrollY)}px — two blocks each bring a divider to the same join; keep one`);
    }
  }

  // ── browser-default styling ───────────────────────────────────────────────────────────────────
  // The page's own rules that can set a heading's margin or weight, or a link's colour. A rule inside a
  // @media counts only when that media query applies now.
  const unreadable = [];
  const rules = [];
  const PROPS = /(^|[\s;{])(margin(-top|-bottom|-block(-start|-end)?)?|font-weight|font|color|all)\s*:/i;
  const walkRules = (list) => {
    for (const rule of Array.from(list)) {
      if (rule.cssRules && (rule.media || rule.conditionText !== undefined || rule.name !== undefined)) {
        if (rule.media && !window.matchMedia(rule.media.mediaText).matches) continue;
        walkRules(rule.cssRules);
      } else if (rule.selectorText && PROPS.test(rule.style.cssText)) {
        rules.push(rule);
      }
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    try { walkRules(sheet.cssRules); } catch (e) { unreadable.push(sheet.href || '(inline)'); }
  }
  const sets = (el, props) => {
    const inline = el.getAttribute('style') || '';
    if (props.some((p) => new RegExp(`(^|;)\\s*${p}\\s*:`, 'i').test(inline))) return true;
    return rules.some((r) => {
      if (!props.some((p) => r.style.getPropertyValue(p) !== '')) return false;
      try { return el.matches(r.selectorText); } catch (e) { return false; }
    });
  };
  const certain = unreadable.length === 0;
  const UA_MARGIN = { H1: 0.67, H2: 0.83, H3: 1, H4: 1.33, H5: 1.67, H6: 2.33 };
  for (const h of qa('h1, h2, h3, h4, h5, h6').filter((h) => isShown(h) && text(h))) {
    const cs = getComputedStyle(h);
    const fs = parseFloat(cs.fontSize);
    const ua = UA_MARGIN[h.tagName] * fs;
    const uaMargin = Math.abs(parseFloat(cs.marginTop) - ua) <= 0.5 && Math.abs(parseFloat(cs.marginBottom) - ua) <= 0.5;
    if (uaMargin && !sets(h, ['margin', 'margin-top', 'margin-bottom', 'margin-block', 'margin-block-start', 'margin-block-end', 'all'])) {
      flag('browser-default', describe(h), `"${text(h).slice(0, 40)}" takes ${round(ua)}px margins above and below from the browser, not from any rule of the page`, { certain });
    }
    if (parseInt(cs.fontWeight, 10) === 700 && !sets(h, ['font-weight', 'font', 'all'])) {
      flag('browser-default', describe(h), `"${text(h).slice(0, 40)}" is bold because the browser makes headings bold, not because a rule of the page says so`, { certain });
    }
  }
  const UA_LINKS = [{ r: 0, g: 0, b: 238 }, { r: 85, g: 26, b: 139 }]; // link and visited-link blue
  // The colour of the link's VISIBLE text: a card link can be browser blue itself while every word in
  // it carries its own colour.
  const firstText = (root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.nodeValue.trim().length > 1 && isShown(n.parentElement)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP,
    });
    const n = walker.nextNode();
    return n ? n.parentElement : root;
  };
  for (const a of qa('a[href]').filter((a) => isShown(a) && text(a))) {
    const t = firstText(a);
    const c = parseColour(getComputedStyle(t).color);
    if (UA_LINKS.some((u) => sameColour(c, u)) && !sets(a, ['color', 'all']) && (t === a || !sets(t, ['color', 'all']))) {
      flag('browser-default', describe(a), `the link "${text(a).slice(0, 40)}" is browser blue: no rule of the page colours it`, { certain });
    }
  }

  // ── dead-anchor ───────────────────────────────────────────────────────────────────────────────
  for (const a of qa('a[href^="#"]')) {
    const raw = a.getAttribute('href').slice(1);
    if (!raw || raw.startsWith('!') || raw === 'top') continue;
    let id = raw;
    try { id = decodeURIComponent(raw); } catch (e) { /* keep it as written */ }
    const target = document.getElementById(id) || document.getElementsByName(id)[0];
    if (!isShown(a)) continue;
    if (!target) flag('dead-anchor', describe(a), `links to #${id}, which is not on this page — a link to a block that is switched off goes nowhere`);
    else if (!isShown(target)) flag('dead-anchor', describe(a), `links to #${id}, which is on the page but hidden`);
  }

  const openCollapsibles = qa('details[open]').length + qa('[aria-expanded="true"]').filter(isShown).length;
  const collapsibles = qa('details').length + qa('[aria-expanded]').filter(isShown).length;
  const result = {
    tool: 'joins.js',
    source: location.href,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    collapsibles, open_collapsibles: openCollapsibles,
    unreadable_stylesheets: unreadable,
    findings,
  };
  console.log(JSON.stringify(result, null, 2));
  console.info(`joins.js: ${findings.length} finding(s) at ${window.innerWidth}×${window.innerHeight}, ${openCollapsibles} of ${collapsibles} collapsible(s) open.`
    + (collapsibles ? ' Run it again with every collapsible in the other state.' : '')
    + (unreadable.length ? `\n${unreadable.length} stylesheet(s) could not be read (another origin): a browser-default finding is marked certain: false.` : ''));
  return result;
})();

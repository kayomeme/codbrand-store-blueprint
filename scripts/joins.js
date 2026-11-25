/**
 * joins.js — the spacing laws and the page checks, measured on the page a shopper sees.
 *
 * scripts/live-check.mjs runs it on every page of the store at 390, 768, 1024 and 1440 and saves each result and its
 * strips. By hand (a store Chrome cannot open): paste this whole file into the page's console, or run it through your
 * browser tool's evaluate, with first:
 *   window.CL_SPACING = { designs: [...], T, line_length }  the store's Spacing designs, each { id, title, category,
 *                       computer, phone } (GET design_controls/presets?type=spacing), and the blueprint's T and reading
 *                       line. Without it the plugin's shipped steps are used, and the result says so (the gate refuses it).
 *   window.CL_JOINS_PAGE = "home" | "category" | "product" | "page" | …   what this page is;
 *   window.CL_JOINS_OPEN = "quick view" | "cart drawer" | "checkout popup"  with an overlay open: only the overlay is
 *                       judged (the one on top, when two are open) — the page under it has its own run.
 * Measure a phone width in a phone's browser (the store prints other HTML for phones), and at an exact width (a frame:
 * references/spacing.md → "The check"). It prints the result as JSON and returns it; save each as a .json file in one
 * folder for `handover.mjs --joins <folder>`. Zero findings is the pass; a finding stays only with a known plugin
 * limit's id or the merchant's decision id in the result's "accepted" (references/spacing.md).
 *
 * THE SPACING LAWS (references/spacing.md) — measured between inks (a line of text by its line box, a photo, a painted
 * box seen as a box), on both axes, inside each scroll container, at the store's steps for this width:
 *   L1 never touch       neighbours closer than 4px or overlapping; boxes touching side by side or one under the other
 *                        (a seam no designed join explains); cards of one list with 0px between them; two lines with
 *                        nothing between them; text under 8px from a line another block draws, under 4px from its own.
 *                        Measured: a reviews summary ending at 368px and the first review card starting at 368.
 *   L2 a box is seen     a background under T : 1 (1.15) with no border or shadow is no box: content it insets is off
 *                        the ruler beside it; a seen box keeps its content on one inner edge, 4px or more from its
 *                        sides, 8px from its photo; a control is wider inside than tall. Measured: a "Where to buy"
 *                        box at 1.08 : 1, its title 18px and its table 30px in.
 *   L3 proximity         a group's items no further apart than its heading is from them; a heading nearer what it
 *                        labels than what came before; a box's inset no larger than the space between boxes.
 *                        Measured: footer links 38px apart under a heading 28px away.
 *   L4 same job          siblings of one kind keep one gap; columns side by side keep one item gap; collapsibles in one
 *                        stack share one look (header, chevron, divider, gap, body padding).
 *   L5 rulers            the header, trail, page title and footer on the page edge; the blocks of one column on one
 *                        edge (or one inset inside a seen box); logical in a right-to-left store. Measured: header,
 *                        trail and title at 72, 48 and 64px.
 *   L6 scale only        every gap one of the store's steps at this width (±0.5px), 4px inside one part, 2 / 6px
 *                        inside a control; the nearest step named. Measured: 0, 4 and 41px in one checkout pop-up.
 *   L7 build rule        body text at most 80 characters a line (or the blueprint's line_length).
 *   L8 overlays          badges and labels over a photo: one distance from the edges for every one of a kind, never
 *                        touching. Measured: a "Sold out" badge 8px from the corner on two cards, 0 on a third.
 *   L9 fixed, floating   a floating button on the page edge, over no other floating thing, and at the page end over
 *                        no content. Measured: a WhatsApp button 16px from the window over "How we earn money".
 *
 * THE PAGE CHECKS — unchanged by the laws:
 *   browser-default     a heading's margin or weight, or a link's colour, from the browser's own stylesheet.
 *   dead-anchor         an in-page link `#id` to nothing, or to something not rendered.
 *   soft-image          a photo with too few pixels for its box on this screen or a 2× phone (Lighthouse's rule).
 *   small-target        on a phone, a control under 44 × 44px — what a tap reaches: its labels, a stretched link, a
 *                       box forwarding the tap, a tap area drawn by ::before / ::after.
 *   dead-scoped-css     a design's custom CSS rule that can never apply (it aims at a nested design).
 *   low-contrast        text under WCAG 1.4.3's 4.5 : 1 (3 : 1 large) against what is painted behind it.
 *   overflow            the page wider than the window, a block past its edge, a control past its card (not what a
 *                       slider's track clips), text past its box, a word broken mid-word.
 *
 * A collapsible is a <details>, a block whose header toggles it with aria-expanded, or an element carrying
 * is_open="yes|no" whose first child is its header: measure every page once with all open and once all closed.
 * With `CL_SPACING.draw` set the measurements are drawn on the page for screenshots (live-check.mjs's strips).
 *
 * No dependencies. It only reads the page (and, with `draw`, adds one layer it removes on the next run).
 */
(() => {
  'use strict';

  const W = document.documentElement.clientWidth || window.innerWidth;
  // The page's content box, from L0 to R0. A classic scrollbar sits on the LEFT of a right-to-left page in Chrome on
  // Windows and in any same-origin frame, so the content runs from 15px to the window's right edge. Measured from
  // 0 … clientWidth on such a store (set to right-to-left), the header was "15px past the window's right edge" and
  // "33px from the right edge" on every page, though it stood 48px from the content's edge.
  const scrollbar = Math.max(0, window.innerWidth - W);
  const L0 = scrollbar > 0 && document.documentElement.getBoundingClientRect().left >= scrollbar - 0.5 ? scrollbar : 0;
  const R0 = L0 + W;
  const q = (sel, root = document) => root.querySelector(sel);
  // Every query goes through the run's scope: the whole page, or, with an overlay open, only that overlay (below).
  let inScope = () => true;
  const qa = (sel, root = document) => Array.from(root.querySelectorAll(sel)).filter((el) => inScope(el));
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
  // ── an overlay open: judge only it ────────────────────────────────────────────────────────────
  // A panel open over the page: a fixed box at least 200 × 200px holding text, on the screen (the outermost of them).
  // When you say one is open (`window.CL_JOINS_OPEN`) and one is, every check reads only what is inside it: the page
  // under it is measured in its own run, with nothing open. Measured on one store: with the cart drawer open, text
  // 7px from a line on the product page UNDER the drawer was reported.
  const panelsFound = Array.from(document.querySelectorAll('body *')).filter((el) => {
    if (getComputedStyle(el).position !== 'fixed' || !isShown(el)) return false;
    const r = box(el);
    return r.width >= 200 && r.height >= 200 && r.left < W && r.right > 0 && r.top < window.innerHeight && r.bottom > 0
      && /[\p{L}\p{N}]/u.test(el.innerText || el.textContent || '');
  });
  const openPanels = panelsFound.filter((el) => !panelsFound.some((o) => o !== el && o.contains(el)));
  // With two panels open, the one on top is the one judged: the checkout popup opened from the cart drawer leaves the
  // drawer open under it, and judging both paired the popup's title with the drawer's header line (measured on one
  // store at 390). On top: the panel the browser hits at its own centre; else the highest stacked, the last in the page.
  const topPanel = (() => {
    if (openPanels.length < 2) return openPanels[0] || null;
    const hit = openPanels.find((p) => { const r = box(p); const e = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2); return e && p.contains(e); });
    if (hit) return hit;
    const z = (el) => { for (let a = el; a && a !== document.body; a = a.parentElement) { const v = parseInt(getComputedStyle(a).zIndex, 10); if (!Number.isNaN(v)) return v; } return 0; };
    return openPanels.slice().sort((a, b) => z(a) - z(b) || (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)).pop();
  })();
  const scoped = typeof window.CL_JOINS_OPEN === 'string' && window.CL_JOINS_OPEN.trim() !== '' && !!topPanel;
  if (scoped) inScope = (el) => topPanel === el || topPanel.contains(el);
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
  const LAWS = { L1: 'never touch', L2: 'a box is a box only if it is seen', L3: 'proximity', L4: 'same job, same spacing',
    L5: 'rulers', L6: 'scale only', L7: 'build rule', L8: 'overlays', L9: 'fixed and floating' };
  // The spacing family names its law (`check: "L1"` …); the other checks keep their names.
  // `at`: the element(s) a finding is about — drawn on the page for the strips, never in the saved result.
  const anchors = new Map();
  const flag = (check, where, detail, extra = {}) => {
    const { at, ...rest } = extra;
    const f = Object.assign({ check, where, detail }, LAWS[check] ? { law: check, family: 'spacing', law_name: LAWS[check] } : { family: 'other' }, rest);
    findings.push(f);
    if (at) anchors.set(f, [].concat(at).filter(Boolean));
  };

  // ── the store's steps ─────────────────────────────────────────────────────────────────────────
  // A store's steps are its Spacing designs: each one value on computers and one on phones (phones: narrower than
  // 768px, the plugin's one breakpoint, so 768 and 1024 are computers). Pass them as `window.CL_SPACING` (its
  // `designs`: { id, title, category, computer, phone } read from the store; `T`, `rulers` and `line_length` from the
  // blueprint's `spacing`). Without them this measures against the plugin's shipped designs and says so.
  const SHIPPED = [[452, 'Small', 'between_horizontal', 8, 8], [453, 'Item', 'between_horizontal', 16, 12],
    [454, 'Group', 'between_horizontal', 24, 20], [455, 'Grid', 'between_horizontal', 32, 24], [461, 'Small', 'between_vertical', 8, 8],
    [462, 'Item', 'between_vertical', 16, 12], [463, 'Group', 'between_vertical', 24, 20], [464, 'Grid', 'between_vertical', 32, 24],
    [458, 'Above block', 'space_above', 32, 24], [456, 'Above section', 'space_above', 64, 48], [459, 'Below block', 'space_below', 32, 24],
    [460, 'Below section', 'space_below', 64, 48], [457, 'Edge', 'page_edge', 48, 16], [465, 'Inside small', 'inside', 8, 8],
    [466, 'Inside', 'inside', 12, 12], [467, 'Inside large', 'inside', 16, 16]]
    .map(([id, title, category, computer, phone]) => ({ id, title, category, computer, phone }));
  const SP = window.CL_SPACING && typeof window.CL_SPACING === 'object' ? window.CL_SPACING : null;
  const given = SP && Array.isArray(SP.designs) && SP.designs.some((d) => Number(d.computer) >= 0) ? SP.designs : null;
  const DESIGNS = given || SHIPPED;
  const phoneBelow = Number(SP && SP.phone_below) || 768;
  const phoneSteps = window.matchMedia(`(max-width: ${phoneBelow - 0.02}px)`).matches;
  const stepOf = (d) => Number(phoneSteps && d.phone !== null && d.phone !== undefined && d.phone !== '' ? d.phone : d.computer);
  const valuesIn = (cats) => DESIGNS.filter((d) => !cats || cats.includes(d.category)).map(stepOf).filter((n) => n >= 0);
  const STEPS = [...new Set(valuesIn(null))].sort((a, b) => a - b);
  const EDGE = valuesIn(['page_edge'])[0] ?? (phoneSteps ? 16 : 48);
  const SMALL = Math.min(...valuesIn(['between_horizontal', 'between_vertical']).filter((n) => n > 0), 8);
  // The space inside one component (label → value, stars → count, icon → text) follows the store's steps by role, and
  // the plugin's smallest role is 4px (`tight`); badge, count and chip insets are 4 × 8, 2 × 6 and 4 × 8.
  const TIGHT = 4;
  const INNER = [2, 4, 6];
  const T = Number(SP && SP.T) > 1 ? Number(SP.T) : 1.15;
  const onStep = (v, extra = []) => [...STEPS, ...extra].some((s) => Math.abs(v - s) <= 0.5);
  const nearest = (v, extra = []) => [...STEPS, ...extra].reduce((b, s) => (Math.abs(s - v) < Math.abs(b - v) ? s : b), STEPS[0] ?? 0);
  const stepName = (v) => { const d = DESIGNS.find((x) => stepOf(x) === v); return d ? `${d.title} ${v}px (#${d.id})` : `${v}px`; };
  // The design a part belongs to (its `cl-design` attribute) and the block it sits in: where its spacing is set.
  const designOf = (el) => {
    const d = el && el.closest && el.closest('[cl-design]');
    if (!d) return null;
    const blk = el.closest('[cl-block]');
    return `${d.getAttribute('cl-design')}${blk ? ` · ${blk.getAttribute('cl-block')}` : ''}`;
  };

  // A visible box-shadow is an edge as well: a card drawn only by its shadow ends exactly where a border
  // would. Measured: a borderless white summary card, outlined by `box-shadow: 0 1px 3px` alone, sat
  // flush on the form below it, and no border on the seam meant nothing was reported.
  const shadowEdge = (cs) => {
    if (!cs.boxShadow || cs.boxShadow === 'none') return null;
    const c = parseColour((cs.boxShadow.match(/rgba?\([^)]*\)/) || [])[0]);
    return c && c.a > 0.05 ? { w: 1, c, shadow: true } : null;
  };

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
    const shadow = shadowEdge(cs);
    return { el, r: box(el), top: edge(cs, 'Top') || shadow, bottom: edge(cs, 'Bottom') || shadow,
      sides: !!(edge(cs, 'Left') && edge(cs, 'Right')) || !!shadow, bg: paints(cs) ? parseColour(cs.backgroundColor) : null };
  });
  // A background the eye can see: an image, or a colour unlike what is behind the element.
  const visiblePaint = (el, cs) => {
    if (cs.backgroundImage !== 'none') return true;
    const c = parseColour(cs.backgroundColor);
    return !!(c && c.a > 0.05) && !sameColour(c, behind(el));
  };
  // A control that shows as a box: a border, a shadow, or a visible background. One that does not (a white
  // button on a white page) is drawn only by what it holds — its icon, its text.
  const controlShows = (el, cs) => ['Top', 'Right', 'Bottom', 'Left'].some((s) => edge(cs, s)) || !!shadowEdge(cs) || visiblePaint(el, cs);
  // How far from an element's top or bottom edge the first thing VISIBLY drawn inside it sits: text, a
  // replaced element, a control that shows as a box, a descendant's top or bottom border and, with
  // `withPaint`, a descendant's visible background. Infinity when it draws nothing.
  const gapTo = (el, side, withPaint) => {
    const r = box(el);
    let best = Infinity;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      let rr = null;
      if (n.nodeType === 3) {
        if (!n.nodeValue.trim() || !isShown(n.parentElement)) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        rr = range.getBoundingClientRect();
      } else {
        if (!isShown(n)) continue;
        const cs = getComputedStyle(n);
        if (/^(IMG|SVG|VIDEO|CANVAS|IFRAME|HR)$/i.test(n.tagName) || edge(cs, 'Top') || edge(cs, 'Bottom')
          || (/^(INPUT|SELECT|TEXTAREA|BUTTON)$/i.test(n.tagName) && controlShows(n, cs))
          || (withPaint && visiblePaint(n, cs))) rr = n.getBoundingClientRect();
      }
      if (!rr || !rr.width || !rr.height) continue;
      best = Math.min(best, side === 'top' ? rr.top - r.top : r.bottom - rr.bottom);
    }
    return best;
  };
  const overlapX = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const related = (a, b) => a.el.contains(b.el) || b.el.contains(a.el);
  // The outermost edge-to-edge section around an element (below <body>), or null.
  const bandOf = (el) => {
    let band = null;
    for (let a = el; a && a !== document.body; a = a.parentElement) {
      const r = box(a);
      if (r.left <= L0 + 1 && r.right >= R0 - 1) band = a;
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
      // Two designed joins are not seams, measured on a store's every page: (1) THE LOWER BOX'S OWN
      // DIVIDER — the only line on the seam is the top border of a box with no side borders (a rule
      // across a band, like a footer's bottom bar), the box above is no card, and the content keeps 8px
      // clear on both sides of the line; (2) A BOX THAT PAINTS NOTHING ON THE SEAM — the side that brings
      // no line, whose first visible content keeps away from it: 8px BELOW a box's line (the clearance (1)
      // asks; measured: a slider's controls row under its review cards, round arrow buttons 10px down,
      // dots 27px), 24px ABOVE one, the distance stacked-dividers allows between two lines (text ending
      // 12px over a box reads as resting on it — the open order summary of the case that made this
      // check). A seam where content sits on the line, or a card on a card, is still one.
      const ownDivider = !a.bottom && !!b.top && !b.top.shadow && !b.sides && !a.sides && !(a.bg && a.r.width < b.r.width - 1)
        && gapTo(a.el, 'bottom', false) >= 8 && gapTo(b.el, 'top', false) >= 8;
      const clearBelow = !b.bg && !b.top && gapTo(b.el, 'top', true) >= 8;
      const clearAbove = !a.bg && !a.bottom && gapTo(a.el, 'bottom', true) >= 24;
      if (ownDivider || clearBelow || clearAbove) continue;
      seams.push({ a, b, y: round(a.r.bottom) });
    }
  }
  // One finding per seam: the outermost pair meeting at that line, once per box below it and the boxes
  // nested in it (three cards over one pager, and the pager's arrows inside it, are one seam).
  const reported = [];
  seams.sort((x, y) => (y.a.r.width * y.a.r.height + y.b.r.width * y.b.r.height) - (x.a.r.width * x.a.r.height + x.b.r.width * x.b.r.height));
  const lineOn = (e, which) => (e ? `; the ${which} box ${e.shadow ? 'casts a shadow' : `draws a ${e.w}px ${which === 'upper' ? 'bottom' : 'top'} border`}` : '');
  for (const s of seams) {
    if (reported.some((o) => Math.abs(o.y - s.y) <= 1 && (o.b === s.b || related(o.b, s.b)))) continue;
    reported.push(s);
    flag('L1', `${describe(s.a.el)} → ${describe(s.b.el)}`,
      `boxes touch one under the other: 0px between them at y=${s.y + round(window.scrollY)}px${lineOn(s.a.bottom, 'upper')}${lineOn(s.b.top, 'lower')} — give one of them a margin, or set their spacing`,
      { rule: 'touching', measured: 0, expected: `at least ${TIGHT}px`, design: designOf(s.b.el), at: [s.a.el, s.b.el] });
  }

  // ── touching-cards ────────────────────────────────────────────────────────────────────────────
  // Cards of one list — siblings of one kind, each drawing its own box — with 0px between them, side by
  // side or one under the next: a grid or a slider whose gap is 0. A stacked pair touching-boxes already
  // reported is not reported twice; one it passed (cards of one colour, no line between them) runs
  // together into one panel and is reported here. Big enough to be a card: a joined row of buttons or
  // chips (a segmented control) is a design, not this. One finding per list.
  const seamAt = (x, y) => reported.some((s) => [x, y].every((e) => [s.a.el, s.b.el].some((o) => o === e || o.contains(e) || e.contains(o))));
  // A card draws a BOX: a background the eye sees, a shadow, or borders on both sides. A row that draws only a line
  // above or below it is a row of a list or a table, and rows meet by design. Measured on one store: a price list's
  // rows, each with only a 1px bottom border, and a partners table's rows with only a top one, reported as cards.
  const drawsBox = (el) => {
    const cs = getComputedStyle(el);
    return !!(edge(cs, 'Left') && edge(cs, 'Right')) || !!shadowEdge(cs) || visiblePaint(el, cs);
  };
  const kindOf = (el) => `${el.tagName}.${typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] || '' : ''}`;
  const overlapY = (a, b) => Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  const cardLists = []; // every list of two or more cards of one kind, for side-gap and overflow below
  for (const list of new Set(qa('body *').map((el) => el.parentElement).filter((el) => el && inScope(el)))) {
    const byKind = new Map();
    for (const c of Array.from(list.children)) {
      if (SKIP.has(c.tagName.toUpperCase()) || !isShown(c)) continue;
      const r = box(c);
      if (r.width < 80 || r.height < 60 || getComputedStyle(c).position === 'fixed' || !drawsBox(c)) continue;
      byKind.set(kindOf(c), (byKind.get(kindOf(c)) || []).concat({ el: c, r }));
    }
    for (const cards of byKind.values()) {
      if (cards.length < 2) continue;
      cardLists.push({ list, cards });
      const pairs = [];
      for (let i = 0; i < cards.length; i++) {
        for (let j = i + 1; j < cards.length; j++) {
          const [a, b] = [cards[i].r, cards[j].r];
          if (overlapY(a, b) >= Math.min(a.height, b.height) * 0.5 && Math.abs(Math.max(b.left - a.right, a.left - b.right)) <= 0.5) {
            pairs.push([cards[i], cards[j], 'side by side']);
          } else if (overlapX(a, b) >= Math.min(a.width, b.width) * 0.5 && Math.abs(Math.max(b.top - a.bottom, a.top - b.bottom)) <= 0.5
            && !seamAt(cards[i].el, cards[j].el)) {
            pairs.push([cards[i], cards[j], 'one under the other']);
          }
        }
      }
      if (!pairs.length) continue;
      const [a, b, how] = pairs[0];
      flag('L1', describe(list),
        `cards touch: ${pairs.length} pair(s) of its ${cards.length} cards with 0px between them (${describe(a.el)} and the next, ${how}), and each card draws its own box — set the list's space between cards to a step, unless the reference joins its cards`,
        { rule: 'touching', measured: 0, expected: `a step (${STEPS.filter((v) => v > 0).join(' / ')}px)`, design: designOf(list), at: [a.el, b.el] });
    }
  }

  // ── stacked-dividers ──────────────────────────────────────────────────────────────────────────
  // A DIVIDER is a top or bottom border on a box with no side borders (a rule across the page). A box
  // bordered on its sides has an OUTLINE: two outlined cards 16px apart are a list, not stacked
  // dividers — an outline counts only when a divider lies directly on it.
  // A CONTROL drawn as a box — a button, a pill, a field — is not a rule: its outline is the control's shape. Up to 64px
  // tall, and a control by its tag or role, by its pointer, or by its pill shape (a radius of nearly half its height).
  // Measured on one store: an outlined 48px "Where to buy" pill (a <span>, radius 999px) 10px from its table's row
  // lines, reported as stacked dividers on every partner row.
  const controlBox = (el, r) => {
    if (r.height > 64) return false;
    const cs = getComputedStyle(el);
    return /^(A|BUTTON|INPUT|SELECT|TEXTAREA|LABEL|SUMMARY)$/.test(el.tagName)
      || /^(button|link|tab|switch|checkbox|radio|option|menuitem)$/.test(el.getAttribute('role') || '')
      || cs.cursor === 'pointer' || parseFloat(cs.borderTopLeftRadius) >= r.height * 0.45;
  };
  const lines = [];
  for (const b of boxes) {
    if (b.r.height < 24) continue; // a chip or an input: its own top and bottom are not dividers
    if (controlBox(b.el, b.r)) continue;
    const kind = b.sides ? 'outline' : 'divider';
    if (b.top) lines.push({ y: b.r.top, w: b.top.w, left: b.r.left, right: b.r.right, el: b.el, side: 'top', kind });
    if (b.bottom) lines.push({ y: b.r.bottom, w: b.bottom.w, left: b.r.left, right: b.r.right, el: b.el, side: 'bottom', kind });
  }
  for (const hr of qa('hr').filter(isShown)) {
    const r = box(hr);
    if (r.width >= minWidth) lines.push({ y: r.top + r.height / 2, w: 0, left: r.left, right: r.right, el: hr, side: 'rule', kind: 'divider' });
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
      flag('L1', `${describe(a.el)} (${a.side}) + ${describe(b.el)} (${b.side})`,
        d <= 1 ? `two lines lying on each other at y=${round(a.y + window.scrollY)}px — one block's divider directly on the next block's border`
          : `two lines ${d}px apart at y=${round(a.y + window.scrollY)}px with nothing between them — two blocks each bring a divider to the same join; keep one`,
        { rule: 'doubled line', measured: d, design: designOf(b.el), at: [a.el, b.el] });
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
  // A target is there when the page renders it — not switched off (display none), not hidden (visibility), not in a
  // closed <details> — whatever its size: an empty focus target (`tabindex="-1"`, where a skip link sends focus past
  // the header) and a 0-height anchor are targets. Measured on one store: its skip link's 1440 × 0 target was
  // reported hidden on every page.
  const rendered = (el) => {
    if (!el.isConnected) return false;
    if (el.checkVisibility) return el.checkVisibility({ visibilityProperty: true });
    for (let p = el; p && p !== document.documentElement; p = p.parentElement) if (getComputedStyle(p).display === 'none') return false;
    return getComputedStyle(el).visibility !== 'hidden';
  };
  for (const a of qa('a[href^="#"]')) {
    const raw = a.getAttribute('href').slice(1);
    if (!raw || raw.startsWith('!') || raw === 'top') continue;
    let id = raw;
    try { id = decodeURIComponent(raw); } catch (e) { /* keep it as written */ }
    const target = document.getElementById(id) || document.getElementsByName(id)[0];
    if (!isShown(a)) continue;
    if (!target) flag('dead-anchor', describe(a), `links to #${id}, which is not on this page — a link to a block that is switched off goes nowhere`);
    else if (!rendered(target)) flag('dead-anchor', describe(a), `links to #${id}, which is on the page but hidden`);
  }

  // ── soft-image ────────────────────────────────────────────────────────────────────────────────
  // Lighthouse's rule ("Serves images with low resolution"): an image drawn larger than 64px needs at
  // least 0.75 file pixels per screen pixel, the screen density rounded down to 2, 1.5 or 1. The file's
  // width is the srcset candidate the browser chose (its `w`) or, with no srcset, naturalWidth — never
  // naturalWidth for a srcset image: the browser scales it by the candidate's density, so a 768px file
  // can report 169. object-fit decides how the file fills its box. And whatever this screen is, an image
  // whose LARGEST file gives less than 1.5 pixels per CSS pixel is soft on a 2× phone. Measured: a
  // product gallery drawing 800px photos 710px wide, 1.13 file pixels per CSS pixel and nothing larger
  // offered. An image not loaded yet (lazy, below the fold) is not judged: scroll the page through first.
  const dpr = window.devicePixelRatio >= 2 ? 2 : window.devicePixelRatio >= 1.5 ? 1.5 : 1;
  const candidatesOf = (img) => (img.getAttribute('srcset') || img.getAttribute('data-lazy-srcset') || img.getAttribute('data-srcset') || '')
    .split(',').map((s) => s.trim().split(/\s+/)).filter((p) => p[0] && /^\d+w$/.test(p[1] || ''))
    .map((p) => { let href = p[0]; try { href = new URL(p[0], location.href).href; } catch (e) { /* as written */ } return { href, w: parseInt(p[1], 10) }; });
  for (const img of qa('img').filter((i) => isShown(i) && i.complete && i.naturalWidth > 0)) {
    const r = box(img);
    if (r.width <= 64 && r.height <= 64) continue;
    const src = img.currentSrc || img.src;
    if (/\.svg(\?|#|$)/i.test(src)) continue;
    const cands = candidatesOf(img);
    const chosen = cands.find((c) => c.href === src);
    const fileW = chosen ? chosen.w : (cands.length ? null : img.naturalWidth);
    if (!fileW) continue;
    const fileH = fileW * (img.naturalHeight / img.naturalWidth);
    const fit = getComputedStyle(img).objectFit;
    const sx = fileW / r.width;
    const sy = fileH / r.height;
    const perCss = fit === 'cover' ? Math.min(sx, sy) : (fit === 'contain' || fit === 'scale-down') ? Math.max(sx, sy) : fit === 'none' ? 1 : Math.min(sx, sy);
    const largest = Math.max(fileW, ...cands.map((c) => c.w));
    const bestPerCss = perCss * (largest / fileW);
    const name = src.split('/').pop().split('?')[0].slice(0, 60);
    if (perCss < 0.75 * dpr) {
      flag('soft-image', describe(img), `"${name}": a ${fileW}px file drawn ${round(r.width)}×${round(r.height)} gives ${(Math.floor(perCss * 100) / 100).toFixed(2)} file pixels per CSS pixel, below the ${0.75 * dpr} this ${dpr}× screen needs — serve a larger file`);
    } else if (bestPerCss < 1.5) {
      flag('soft-image', describe(img), `"${name}": the largest file offered (${largest}px) gives ${(Math.floor(bestPerCss * 100) / 100).toFixed(2)} file pixels per CSS pixel drawn ${round(r.width)}px wide — soft on a 2× phone; upload the photo at least ${Math.ceil(1.5 * largest / bestPerCss)}px wide`);
    }
  }

  // ── stack-mismatch ────────────────────────────────────────────────────────────────────────────
  // A collapsible is a <details> (its header: the <summary>), an element carrying is_open="yes|no" whose
  // first child is a header (this plugin's toggles), or a block whose first child toggles it through
  // aria-expanded. An always-visible block may carry is_open too: with no header it is not a collapsible.
  const collapsibleList = [];
  const addCollapsible = (el, header, open) => {
    if (el && header && !collapsibleList.some((c) => c.el === el)) collapsibleList.push({ el, header, open });
  };
  for (const d of qa('details')) addCollapsible(d, q(':scope > summary', d), d.open);
  for (const el of qa('[is_open]')) {
    const h = el.firstElementChild;
    if (h && /header/i.test(typeof h.className === 'string' ? h.className : '')) addCollapsible(el, h, el.getAttribute('is_open') === 'yes');
  }
  for (const t of qa('[aria-expanded]')) {
    if (t.parentElement && t.parentElement.firstElementChild === t) addCollapsible(t.parentElement, t, t.getAttribute('aria-expanded') === 'true');
  }
  // A stack: collapsibles lined up one under the next — the same column, at most 64px apart, nothing
  // between them. One nested in another's body belongs to that body, not to the stack.
  const shownCollapsibles = collapsibleList.filter((c) => isShown(c.el) && isShown(c.header));
  const stackable = shownCollapsibles.filter((c) => !shownCollapsibles.some((o) => o !== c && o.el.contains(c.el)))
    .sort((a, b) => box(a.el).top - box(b.el).top);
  const stacks = [];
  let run = [];
  for (const c of stackable) {
    const prev = run[run.length - 1];
    if (prev) {
      const [pr, cr] = [box(prev.el), box(c.el)];
      const gap = cr.top - pr.bottom;
      const aligned = overlapX(pr, cr) >= Math.min(pr.width, cr.width) * 0.9 && Math.abs(pr.width - cr.width) <= Math.max(pr.width, cr.width) * 0.1;
      const between = boxes.some((b) => !related(b, { el: prev.el }) && !related(b, { el: c.el })
        && b.r.top >= pr.bottom - 1 && b.r.bottom <= cr.top + 1 && overlapX(b.r, cr) > 0);
      if (aligned && gap >= -1 && gap <= 64 && !between) { run.push(c); continue; }
    }
    if (run.length > 1) stacks.push(run);
    run = [c];
  }
  if (run.length > 1) stacks.push(run);

  const hex = (c) => '#' + [c.r, c.g, c.b].map((n) => Math.round(n).toString(16).padStart(2, '0')).join('');
  const lineOf = (e) => (e ? `${Math.round(e.w * 2) / 2}px ${hex(e.c)}` : 'none');
  // The chevron: the last visible icon in the header (the toggle sits at its end), its size and its paint.
  const chevronOf = (h) => {
    const icons = qa('svg', h).filter(isShown);
    if (!icons.length) return null;
    const svg = icons.reduce((a, b) => (box(b).right > box(a).right ? b : a));
    const shape = q('path, line, polyline, polygon, circle, rect, ellipse', svg) || svg;
    const cs = getComputedStyle(shape);
    const stroke = parseFloat(cs.strokeWidth) > 0 ? parseColour(cs.stroke) : null;
    const paint = (stroke && stroke.a > 0.05) ? stroke : parseColour(cs.fill);
    const r = box(svg);
    return { size: round(Math.max(r.width, r.height)), colour: paint && paint.a > 0.05 ? paint : null };
  };
  // The body's padding, open only: the first element after the header, or the single wrapper inside it
  // that carries the padding.
  const bodyPaddingOf = (c) => {
    if (!c.open) return null;
    let body = c.header.nextElementSibling;
    while (body && !isShown(body)) body = body.nextElementSibling;
    for (let depth = 0; body && depth < 4; depth++) {
      const cs = getComputedStyle(body);
      const pad = { top: round(parseFloat(cs.paddingTop)), left: round(parseFloat(cs.paddingLeft)) };
      if (pad.top || pad.left || body.children.length !== 1) return pad;
      body = body.firstElementChild;
    }
    return body ? { top: 0, left: 0 } : null;
  };
  const PROPS_LOOK = [
    { key: 'header', label: 'header', show: (v) => `${v}px`, eq: (a, b) => Math.abs(a - b) <= 2 },
    { key: 'chevron', label: 'chevron', show: (v) => (v ? `${v.size}px ${v.colour ? hex(v.colour) : ''}`.trim() : 'none'),
      eq: (a, b) => (!a || !b ? a === b : Math.abs(a.size - b.size) <= 1 && (!a.colour || !b.colour ? a.colour === b.colour : sameColour(a.colour, b.colour))) },
    { key: 'divider', label: 'divider under the header', show: (v) => v, eq: (a, b) => a === b },
    { key: 'join', label: 'rule above it', show: (v) => v, eq: (a, b) => a === b },
    { key: 'gap', label: 'gap above', show: (v) => `${v}px`, eq: (a, b) => Math.abs(a - b) <= 2 },
    { key: 'body', label: 'body padding', show: (v) => (v.top === v.left ? `${v.top}px` : `${v.top}px top, ${v.left}px left`),
      eq: (a, b) => Math.abs(a.top - b.top) <= 2 && Math.abs(a.left - b.left) <= 2 },
  ];
  for (const stack of stacks) {
    const looks = stack.map((c, i) => {
      const prev = stack[i - 1];
      return {
        header: round(box(c.header).height),
        chevron: chevronOf(c.header),
        divider: lineOf(edge(getComputedStyle(c.header), 'Bottom')),
        join: prev ? lineOf(edge(getComputedStyle(prev.el), 'Bottom') || edge(getComputedStyle(c.el), 'Top')) : undefined,
        gap: prev ? round(box(c.el).top - box(prev.el).bottom) : undefined,
        body: bodyPaddingOf(c) || undefined,
      };
    });
    // The stack's look is what most of its members share (the first member's, on a tie); a member that
    // differs from it is the finding.
    const norm = {};
    for (const p of PROPS_LOOK) {
      const vals = looks.map((l) => l[p.key]).filter((v) => v !== undefined);
      if (vals.length < 2) continue;
      norm[p.key] = vals.reduce((best, v) => (vals.filter((x) => p.eq(x, v)).length > vals.filter((x) => p.eq(x, best)).length ? v : best), vals[0]);
    }
    stack.forEach((c, i) => {
      const diffs = PROPS_LOOK.filter((p) => p.key in norm && looks[i][p.key] !== undefined && !p.eq(looks[i][p.key], norm[p.key]))
        .map((p) => `${p.label} ${p.show(looks[i][p.key])} (the others: ${p.show(norm[p.key])})`);
      if (diffs.length) {
        flag('L4', describe(c.el), `one of ${stack.length} collapsibles stacked here looks different: ${diffs.join('; ')} — blocks of one kind in one stack share one look`, { rule: 'collapsible stack', design: designOf(c.el), at: c.el });
      }
    });
  }

  // ── small-target ──────────────────────────────────────────────────────────────────────────────
  // On a phone every control a shopper taps is at least 44 × 44px: Apple's default (44 × 44pt; 28 at the
  // very least), WCAG 2.5.5 (44; 2.5.8 allows 24), Material's 48dp. A small icon gets there through padding,
  // as Material puts it: the icon keeps its size, the box around it grows. The target is where a tap lands —
  // the element's box and everything shown inside it (an inline link around a photo reports only its text
  // line). A field and its labels are one target, since tapping either works; a label over a hidden radio (a
  // colour swatch, a size button) is the target itself. Not judged: a text link among other words on its line
  // (WCAG's inline exception: the line sets its height), anything out of sight (a skip link, a field clipped
  // or under 2px), anything a tap goes through, and what sits in a closed drawer (a fixed panel off the
  // screen). Identical targets — same tag, same first class, the same size where they fall short — are one
  // finding with their count: a row of colour dots is one line, not nine. Phones only, under 768px wide.
  const phone = window.innerWidth < 768;
  const TAPPABLE = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, label, [role="button"], '
    + '[role="link"], [role="checkbox"], [role="radio"], [role="tab"], [role="switch"], [role="menuitem"]';
  // Out of sight: not shown, under 2px, clipped to nothing (a screen-reader-only skip link), or left of or above
  // the page.
  const unseen = (el) => {
    if (!isShown(el)) return true;
    const r = box(el);
    const cs = getComputedStyle(el);
    const clip = (String(cs.clip || '').match(/-?[\d.]+(?=px)/g) || []).map(Number);
    return r.width < 2 || r.height < 2 || r.right + window.scrollX <= 0 || r.bottom + window.scrollY <= 0
      || (clip.length === 4 && (clip[1] - clip[3] <= 1 || clip[2] - clip[0] <= 1)) || /^inset\((50|100)%/.test(cs.clipPath);
  };
  // A closed drawer: a fixed panel moved off the screen still holds its links.
  const inClosedPanel = (el) => {
    for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
      if (getComputedStyle(a).position !== 'fixed') continue;
      const r = box(a);
      if (r.right <= 0 || r.bottom <= 0 || r.left >= window.innerWidth || r.top >= window.innerHeight) return true;
    }
    return false;
  };
  // Where a tap lands: the element's box grown by every box shown inside it, unless it clips its content.
  const hitBox = (el) => {
    const r = box(el);
    const a = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    const cs = getComputedStyle(el);
    if (cs.overflowX === 'visible' && cs.overflowY === 'visible') {
      for (const d of qa(':not(svg *)', el)) {
        const dr = box(d);
        if (!dr.width || !dr.height || (dr.left >= a.left && dr.top >= a.top && dr.right <= a.right && dr.bottom <= a.bottom) || unseen(d)) continue;
        [a.left, a.top, a.right, a.bottom] = [Math.min(a.left, dr.left), Math.min(a.top, dr.top), Math.max(a.right, dr.right), Math.max(a.bottom, dr.bottom)];
      }
    }
    return { width: a.right - a.left, height: a.bottom - a.top };
  };
  // WCAG's inline exception: a text link among other words — a sentence, or a row whose text sets its height
  // ("Delivery … 0 MAD") — takes that line's height. Other words: visible text in the link's block, outside
  // every other control, with a letter or a digit, on one of the link's lines.
  const inRunningText = (link) => {
    if (!text(link)) return false;
    let block = link.parentElement;
    while (block && block !== document.body && ['inline', 'contents'].includes(getComputedStyle(block).display)) block = block.parentElement;
    if (!block) return false;
    const own = Array.from(link.getClientRects());
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (link.contains(n) || !/[\p{L}\p{N}]/u.test(n.nodeValue) || !isShown(n.parentElement)) continue;
      const other = n.parentElement.closest(TAPPABLE);
      if (other && !other.contains(link)) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      if (Array.from(range.getClientRects()).some((t) => own.some((o) => Math.min(t.bottom, o.bottom) - Math.max(t.top, o.top) > 2))) return true;
    }
    return false;
  };
  // What a shopper reads on it: its text, else its aria-label, title, a photo's alt, or its hidden radio's
  // label or value.
  const nameOf = (el) => {
    const img = q('img[alt]', el);
    const ctl = el.control || null;
    const picked = el.tagName === 'SELECT' && el.selectedOptions && el.selectedOptions[0] ? el.selectedOptions[0].text : '';
    return ((/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) ? picked : text(el)) || el.getAttribute('aria-label') || el.getAttribute('title')
      || el.getAttribute('placeholder') || (img && img.alt) || (ctl && (ctl.getAttribute('aria-label') || ctl.value)) || el.value || '')
      .replace(/\s+/g, ' ').trim().slice(0, 30);
  };
  // WHAT A TAP THERE REACHES (WCAG's target: "region of the display that will accept a pointer action"), beyond the
  // control's own box and its labels. Measured on one store at 390, each proved by a real tap: a checkout field's
  // bordered 52px box around an 18px borderless input; quantity-offer and shipping cards (`cursor: pointer`) around a
  // 13px radio; a partner link stretched over its 322 × 121 row by an `::after { position: absolute; inset: 0 }`.
  // (1) A STRETCHED LINK: a `::before` / `::after` placed absolutely over its containing block, less its insets.
  const px = (v) => (/^-?[\d.]+px$/.test(v) ? parseFloat(v) : null);
  const stretched = (el) => {
    let best = null;
    for (const pseudo of ['::before', '::after']) {
      const cs = getComputedStyle(el, pseudo);
      if (!cs.content || cs.content === 'none' || cs.content === 'normal' || !/^(absolute|fixed)$/.test(cs.position)) continue;
      const [t, r, b, l] = [cs.top, cs.right, cs.bottom, cs.left].map(px);
      if ([t, r, b, l].some((v) => v === null)) continue;
      let cb = el;
      if (cs.position === 'absolute') while (cb.parentElement && cb !== document.body && getComputedStyle(cb).position === 'static') cb = cb.parentElement;
      const c = cs.position === 'fixed' ? { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight } : box(cb);
      const w = c.right - r - (c.left + l);
      const h = c.bottom - b - (c.top + t);
      if (w > 0 && h > 0 && (!best || w * h > best.width * best.height)) best = { width: w, height: h };
    }
    return best;
  };
  // (2) THE BOX THAT FORWARDS A TAP: up from the control, while an ancestor holds no other control (its labels aside),
  // the largest one that shows a pointer (a card that selects it) or draws a box while the control draws none of its
  // own (the box IS the field a shopper sees). A field sharing its box with a button is not one: only the field takes
  // a tap there.
  const forwardBox = (el) => {
    const own = new Set([el, ...Array.from(el.labels || [])]);
    const drawsNone = !controlShows(el, getComputedStyle(el));
    let best = null;
    for (let a = el.parentElement, i = 0; a && a !== document.body && i < 6; a = a.parentElement, i++) {
      if (Array.from(a.querySelectorAll(TAPPABLE)).some((o) => !own.has(o) && !o.contains(el) && !unseen(o))) break;
      const cs = getComputedStyle(a);
      if (cs.cursor === 'pointer' || (drawsNone && drawsBox(a))) best = box(a);
    }
    return best;
  };
  const big = (r) => !!r && round(r.width) >= 44 && round(r.height) >= 44;
  // Another control doing the same job beside it (WCAG's "Equivalent" exception: "the function can be achieved through
  // a different control on the same page that meets this criterion"): (a) a link with the same address whose target is
  // 44 × 44 or more, within 48px — a category chip's title beside its 54 × 54 image link; (b) a row of identical small
  // buttons (pager dots) with a 44 × 44 button of another kind before it and one after it in its group — a slider's
  // dots between its previous / next arrows. Measured on the same store.
  const gapBetween = (a, b) => Math.max(0, Math.max(a.left, b.left) - Math.min(a.right, b.right), Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom));
  const doneBeside = (el) => {
    const r = box(el);
    if (el.tagName === 'A' && el.href) {
      if (qa('a[href]').some((o) => o !== el && o.href === el.href && !unseen(o) && big(hitBox(o)) && gapBetween(r, box(o)) <= 48)) return true;
    }
    const kin = (o) => o.tagName === el.tagName && kindOf(o) === kindOf(el);
    const row = el.parentElement ? Array.from(el.parentElement.children).filter(kin) : [];
    if (row.length >= 2 && row.every((o) => !big(hitBox(o)))) {
      const span = row.map(box).reduce((x, y) => ({ left: Math.min(x.left, y.left), right: Math.max(x.right, y.right), top: Math.min(x.top, y.top), bottom: Math.max(x.bottom, y.bottom) }));
      for (const g of [el.parentElement, el.parentElement.parentElement].filter(Boolean)) {
        const steps = qa('button, [role="button"]', g).filter((o) => !kin(o) && !unseen(o) && big(hitBox(o))).map(box);
        const across = span.right - span.left >= span.bottom - span.top;
        if (steps.some((s) => (across ? s.right <= span.left + 1 : s.bottom <= span.top + 1)) && steps.some((s) => (across ? s.left >= span.right - 1 : s.top >= span.bottom - 1))) return true;
      }
    }
    return false;
  };
  if (phone) {
    const groups = new Map();
    for (const el of qa(TAPPABLE)) {
      // A label is a target of its own only over a hidden control; over a visible one it is part of that
      // control's target, judged with it.
      if (el.tagName === 'LABEL' && !(el.control && unseen(el.control))) continue;
      if (unseen(el) || inClosedPanel(el) || getComputedStyle(el).pointerEvents === 'none') continue;
      if (el.tagName === 'A' && inRunningText(el)) continue;
      const parts = [el, ...Array.from(el.labels || []).filter((l) => !unseen(l))].map((p) => ({ el: p, r: hitBox(p) }));
      if (parts.some((p) => big(p.r)) || big(stretched(el)) || big(forwardBox(el)) || doneBeside(el)) continue;
      const t = parts.reduce((x, y) => (y.r.width * y.r.height > x.r.width * x.r.height ? y : x));
      const [w, h] = [round(t.r.width), round(t.r.height)];
      const cls = typeof t.el.className === 'string' ? t.el.className.trim().split(/\s+/)[0] || '' : '';
      const kind = t.el.tagName.toLowerCase() + (cls ? '.' + cls : '');
      const key = `${kind} ${w < 44 ? w : ''}×${h < 44 ? h : ''}`;
      const g = groups.get(key) || { kind, el: t.el, ws: [], hs: [], names: [] };
      g.ws.push(w); g.hs.push(h); g.names.push(nameOf(t.el));
      groups.set(key, g);
    }
    const span = (v) => (Math.min(...v) === Math.max(...v) ? `${v[0]}` : `${Math.min(...v)}–${Math.max(...v)}`);
    for (const g of groups.values()) {
      const names = [...new Set(g.names.filter(Boolean))];
      const said = names.length ? ` (${names.slice(0, 3).map((s) => `"${s}"`).join(', ')}${names.length > 3 ? ' …' : ''})` : '';
      flag('small-target', g.ws.length > 1 ? `${g.ws.length} × ${g.kind}` : describe(g.el),
        `${span(g.ws)}×${span(g.hs)}px${said}, under the 44 × 44px a fingertip needs on a phone — reach 44 × 44 through padding in its preset or style key`);
    }
  }

  // ── the page's text, read once for the five checks below ──────────────────────────────────────
  // Every text with a letter or a digit that a shopper can see (not out of sight, not in a closed drawer), with the
  // boxes its lines draw: each as tall as the font (its ascent and descent), not as the line — the line's extra
  // leading is outside it. What these checks measure from, as a person measuring the page would.
  const hiddenMemo = new Map();
  const hidden = (el) => {
    if (!hiddenMemo.has(el)) hiddenMemo.set(el, unseen(el) || inClosedPanel(el));
    return hiddenMemo.get(el);
  };
  const texts = [];
  {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || !inScope(el) || !/[\p{L}\p{N}]/u.test(n.nodeValue) || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|OPTION|TITLE)$/.test(el.tagName) || hidden(el)) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
      if (rects.length) texts.push({ node: n, el, rects });
    }
  }
  // The scroll or clip container that cuts a box: the nearest ancestor whose overflow is not visible and whose box the
  // rect reaches past by more than half a pixel. Measured on two stores: a quick view's body scrolls under its fixed
  // footer, and text it had scrolled away was reported glued to the footer's line.
  const clippedBy = (el, r) => {
    for (let a = el.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      const c = box(a);
      if (r.top < c.top - 0.5 || r.bottom > c.bottom + 0.5 || r.left < c.left - 0.5 || r.right > c.right + 0.5) return a;
    }
    return null;
  };
  const rtl = getComputedStyle(document.body).direction === 'rtl';
  const startOf = (r) => (rtl ? R0 - r.right : r.left - L0); // from the content box's start edge: left, or right in RTL
  const media = qa('img, svg, video, picture').filter((m) => !(m.parentElement && m.parentElement.closest('svg')) && !hidden(m));
  // Centred content keeps no edge: its own text centred, or its parent centring it.
  const centred = (el) => {
    if (getComputedStyle(el).textAlign === 'center') return true;
    const p = el.parentElement && getComputedStyle(el.parentElement);
    return !!(p && /flex|grid/.test(p.display) && /center/.test(`${p.justifyContent} ${p.justifyItems}`));
  };

  // ── edge-mismatch ─────────────────────────────────────────────────────────────────────────────
  // The header, the breadcrumb trail, the page's title and the footer stack on every page: their content starts at
  // one distance from the window's edge — the header's — and, given the store's edge inset (`CL_JOINS_RHYTHM.edge`,
  // palette.md → "Density"), at that inset on a phone and never closer to the window on a wider screen (a boxed
  // page adds its margin there). Centred content keeps no edge; a part with something beside it on its start side
  // (a product's title right of its photos) does not start a row and is not compared. Measured on one store at
  // 1440: header 72px, trail 48px, title 64px, and 0 findings from every other check there.
  const edgeWant = EDGE;
  // The first part shown for each selector, in order; outside the header (a theme may put the site's name in an h1).
  const firstOf = (sels, outside) => {
    for (const sel of sels) { const el = qa(sel).find((x) => !hidden(x) && !(outside && outside.contains(x))); if (el) return el; }
    return null;
  };
  const header = firstOf(['[cl-compo="header"][cl-block="main_header"]', 'header', '[role="banner"]']);
  // Content inside a painted box narrower than the window (a hero panel, a bar as wide as the page) starts where that
  // box starts: the box's own padding insets its text, as a band's must. Measured on one store: a home title 113px
  // in, inside a dark panel standing on the 48px edge with 64px of padding.
  const panelMemo = new Map();
  const panelOf = (el) => {
    if (!panelMemo.has(el)) {
      let found = null;
      for (let a = el; a && a !== document.body; a = a.parentElement) {
        const r = box(a);
        if (r.left > L0 + 1 && r.right < R0 - 1 && drawsBox(a)) found = r;
      }
      panelMemo.set(el, found);
    }
    return panelMemo.get(el);
  };
  // A part's content nearest the start edge, and nearest the end edge (the end: right, or left in RTL).
  const endOf = (r) => (rtl ? r.left - L0 : R0 - r.right);
  const edgesIn = (root) => {
    let start = null;
    let end = null;
    const take = (el, r) => {
      // Content inside a control counts at the control's box: an icon keeps its size and its box reaches the edge
      // (measured on one store: a header's cart button ending 48px from the right, its 22px glyph at 70).
      const control = el.closest(TAPPABLE);
      let at = panelOf(el) || (control && root.contains(control) ? box(control) : r);
      // Only what shows: a row that clips its overflow (a menu swiped sideways) hides the rest. Measured on one store
      // at 768: a header menu's last link cut behind the cart, its box 18px past the edge.
      let [left, right] = [at.left, at.right];
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        if (getComputedStyle(a).overflowX !== 'visible') { const c = box(a); left = Math.max(left, c.left); right = Math.min(right, c.right); }
        if (a === root) break;
      }
      if (right - left < 1) return;
      if (left !== at.left || right !== at.right) at = { left, right, top: at.top, bottom: at.bottom, width: right - left, height: at.height };
      if (centred(el)) return;
      if (!start || startOf(at) < startOf(start.r)) start = { el, r: at };
      if (!end || endOf(at) < endOf(end.r)) end = { el, r: at };
    };
    for (const t of texts) if (root.contains(t.el)) for (const r of t.rects) take(t.el, r);
    for (const m of media) {
      const r = box(m);
      if (root.contains(m) && r.width < W * 0.9 && r.width > 0) take(m, r);
    }
    return start ? { start, end } : null;
  };
  const parts = [
    ['the header', header],
    ['the breadcrumb trail', firstOf(['[cl-compo="breadcrumb"]', 'nav[aria-label*="readcrumb" i]', '.woocommerce-breadcrumb', '.breadcrumbs', '.breadcrumb'], header)],
    ['the page title', firstOf(['h1'], header)],
    ['the footer', firstOf(['[cl-compo="footer"]', 'footer', '[role="contentinfo"]'], header)],
  ].filter(([, el], i, all) => el && !all.slice(0, i).some(([, o]) => o && (o === el || o.contains(el))))
    .map(([name, el]) => ({ name, el, ...(edgesIn(el) || {}) })).filter((p) => p.start);
  // Something outside the part, level with its first content and nearer the start edge: the part is not a row's start.
  const besideStart = (p) => texts.some((t) => !p.el.contains(t.el) && t.rects.some((r) => overlapY(r, p.start.r) > 0 && startOf(r) < startOf(p.start.r) - 2))
    || media.some((m) => { const r = box(m); return !p.el.contains(m) && r.width < W * 0.9 && overlapY(r, p.start.r) > 0 && startOf(r) < startOf(p.start.r) - 2; });
  const rows = parts.filter((p) => !besideStart(p));
  const side = rtl ? 'right' : 'left';
  const otherSide = rtl ? 'left' : 'right';
  // Aligned to the end edge, as its CSS says: text aligned to the end, or a flex row packing its items at the end,
  // from the content up to the part. Measured on one store: its trail's list a flex row with `justify-content:
  // flex-end` on computers and `flex-start` on phones.
  const END_TEXT = rtl ? ['left', 'end', '-webkit-left'] : ['right', 'end', '-webkit-right'];
  const endAligned = (el, root) => {
    for (let a = el; a; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (END_TEXT.includes(cs.textAlign)) return true;
      if (/flex/.test(cs.display) && !/column/.test(cs.flexDirection)) {
        const packs = /reverse/.test(cs.flexDirection) ? ['flex-start', 'start'] : ['flex-end', 'end', rtl ? 'left' : 'right'];
        if (packs.includes(cs.justifyContent)) return true;
      }
      if (a === root) break;
    }
    return false;
  };
  if (rows.length) {
    const ref = rows[0];
    const x0 = round(startOf(ref.start.r));
    const e0 = round(endOf(ref.end.r));
    for (const p of rows.slice(1)) {
      // A part aligned to the end edge (by its CSS, or starting past the window's middle) is compared by its END with
      // the header's end. Measured on one store: a trail ending on the header's end, reported as starting 1234px from
      // the left.
      if (endAligned(p.end.el, p.el) || startOf(p.start.r) > W / 2) {
        const e = round(endOf(p.end.r));
        if (Math.abs(e - e0) <= 2) continue;
        flag('L5', describe(p.el), `${p.name} is aligned to the ${otherSide} and ends ${e}px from that edge, ${ref.name} ${e0}px — the parts stacked on every page share one edge: set ${p.name}'s side space so its content ends where ${ref.name}'s does`, { rule: 'edge ruler', measured: e, expected: e0, design: designOf(p.el), at: p.el });
        continue;
      }
      const x = round(startOf(p.start.r));
      if (Math.abs(x - x0) <= 2) continue;
      flag('L5', describe(p.el), `${p.name} starts ${x}px from the ${side} edge, ${ref.name} ${x0}px — the parts stacked on every page share one edge: set ${p.name}'s side space so its content starts where ${ref.name}'s does`, { rule: 'edge ruler', measured: x, expected: x0, design: designOf(p.el), at: p.el });
    }
    if (edgeWant && (phone ? Math.abs(x0 - edgeWant) > 2 : x0 < edgeWant - 2)) {
      flag('L5', describe(ref.el), `${ref.name} starts ${x0}px from the ${side} edge, and the store's page edge is ${edgeWant}px${phone ? '' : ' (at least that on a wider screen)'} — set its side space to the page edge`, { rule: 'edge ruler', measured: x0, expected: edgeWant, design: designOf(ref.el), at: ref.el });
    }
  }

  // ── glued-to-line ─────────────────────────────────────────────────────────────────────────────
  // Text closer than 8px to a line drawn by another box — a divider it does not own: a trail 2px under the header's
  // bottom line, a heading on a section's rule. Measured between the text's own box (the font's height) and the
  // line. 8px is the smallest gap Material's card puts between two parts of it (its text block
  // has 16dp of padding); a box's own text near its own border is that box's padding, not this.
  const GLUE = SMALL;
  const gluedTo = new Map();
  for (const l of lines.filter((x) => x.kind === 'divider')) {
    for (const t of texts) {
      // Its own line: the box's padding, judged only under the tight step (text 2px under its own footer's line).
      const own = l.el.contains(t.el);
      for (const r of t.rects) {
        if (Math.min(r.right, l.right) - Math.max(r.left, l.left) <= 0) continue;
        // Text a scroll container clips (scrolled under a fixed footer) is not next to a line outside that container.
        const clip = clippedBy(t.el, r);
        if (clip && !clip.contains(l.el)) continue;
        // From the line's own edge on the text's side: a 1px bottom border's top, a top border's bottom.
        const [y0, y1] = l.side === 'top' ? [l.y, l.y + (l.w || 0)] : l.side === 'bottom' ? [l.y - (l.w || 0), l.y] : [l.y, l.y];
        const d = r.top >= y0 - 0.5 ? r.top - y1 : r.bottom <= y1 + 0.5 ? y0 - r.bottom : null;
        if (d === null || d >= (own ? TIGHT : GLUE) - 0.5) continue;
        const g = gluedTo.get(l.el) || { l, d: Infinity, el: null, n: 0 };
        g.n++;
        if (d < g.d) Object.assign(g, { d: Math.max(0, d), el: t.el, words: text(t.el).slice(0, 40) });
        gluedTo.set(l.el, g);
      }
    }
  }
  for (const g of gluedTo.values()) {
    const own = g.l.el.contains(g.el);
    flag('L1', `${describe(g.l.el)} (${g.l.side}) + ${describe(g.el)}`,
      `text on a line: "${g.words}" sits ${round(g.d)}px from the line ${describe(g.l.el)} draws${g.n > 1 ? ` (${g.n} line(s) of text that near)` : ''} — ${own ? `keep text at least ${TIGHT}px from its own box's line: give the box padding on that side` : `keep text at least ${GLUE}px from a line another block draws: give the text's block space on that side`}`,
      { rule: 'text on a line', measured: round(g.d), expected: `at least ${own ? TIGHT : GLUE}px`, design: designOf(g.el), at: [g.el, g.l.el] });
  }

  // ── side-gap ──────────────────────────────────────────────────────────────────────────────────
  // Inside a card of a list, under 8px between its photo and its text, above, below or beside it — the parts read
  // as glued. Material's card keeps its text block 16dp in, and 8dp is the least it puts between two parts.
  // Measured on one store: a product card's title 5px under its photo. One finding per list.
  for (const { list, cards } of cardLists) {
    let worst = Infinity;
    let hit = 0;
    for (const c of cards) {
      const photo = qa('img, picture, video', c.el).filter((m) => !hidden(m)).map((m) => ({ m, r: box(m) }))
        .filter(({ r }) => r.width >= 40 && r.height >= 40).sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height)[0];
      if (!photo) continue;
      let gap = Infinity;
      for (const t of texts) {
        if (!c.el.contains(t.el) || photo.m.contains(t.el)) continue;
        for (const r of t.rects) {
          const p = photo.r;
          if (overlapX(r, p) > 0) {
            if (r.top >= p.bottom - 0.5) gap = Math.min(gap, r.top - p.bottom);
            else if (r.bottom <= p.top + 0.5) gap = Math.min(gap, p.top - r.bottom);
          } else if (overlapY(r, p) > 0) {
            if (r.left >= p.right - 0.5) gap = Math.min(gap, r.left - p.right);
            else if (r.right <= p.left + 0.5) gap = Math.min(gap, p.left - r.right);
          }
        }
      }
      if (gap < SMALL - 0.5) { hit++; worst = Math.min(worst, Math.max(0, gap)); }
    }
    if (hit) {
      flag('L2', describe(list), `text glued to the photo: ${hit} of its ${cards.length} cards keep their text ${round(worst)}px from their photo — at least ${SMALL}px between a card's photo and its text (Material's card: 16dp of padding around its text); pad the card's text block`, { rule: 'photo edge', measured: round(worst), expected: `at least ${SMALL}px`, design: designOf(list), at: list });
    }
  }

  // ══ THE SPACING LAWS ═════════════════════════════════════════════════════════════════════════
  // Each law is checked on every visible thing the run judges, in both directions; none names a component. The joins
  // above are the laws' first clauses (L1: boxes and cards touching, doubled lines, text on a line; L2: text glued to a
  // photo; L4: a collapsible stack; L5: the page's edge ruler). What follows measures BETWEEN INKS — what the eye sees:
  // a text line's box, a photo, a painted box. A link's padding is no ink, so the space it adds is measured as space.
  const csMemo = new Map();
  const csOf = (el) => { if (!csMemo.has(el)) csMemo.set(el, getComputedStyle(el)); return csMemo.get(el); };
  const lumC = (c) => { const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratioOf = (a, b) => { const [hi, lo] = [lumC(a), lumC(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  const mix = (t, u) => ({ r: t.r * t.a + u.r * (1 - t.a), g: t.g * t.a + u.g * (1 - t.a), b: t.b * t.a + u.b * (1 - t.a), a: 1 });
  // What shows behind an element: its ancestors' backgrounds, see-through ones over the first solid one (white).
  const backOf = (el) => {
    const layers = [];
    for (let a = el.parentElement; a; a = a.parentElement) {
      const c = parseColour(csOf(a).backgroundColor);
      if (c && c.a > 0.01) { layers.push(c); if (c.a >= 0.99) break; }
    }
    let bg = layers.length && layers[layers.length - 1].a >= 0.99 ? layers.pop() : { r: 255, g: 255, b: 255, a: 1 };
    while (layers.length) bg = mix(layers.pop(), bg);
    return bg;
  };
  // L2's test, a box is a box only if it is seen: a border or outline, a shadow, or a background at least T : 1 against
  // what is behind it. A background under T with neither is FAINT: no one sees a box there. Measured on one store: a
  // "Where to buy" box rgb(21,21,23) on a page of rgb(11,11,12), 1.08 : 1, its content inset 18 and 30px.
  const paintMemo = new Map();
  const paintOf = (el) => {
    if (paintMemo.has(el)) return paintMemo.get(el);
    const cs = csOf(el);
    const sides = ['Top', 'Right', 'Bottom', 'Left'].filter((s) => edge(cs, s));
    const shadow = !!shadowEdge(cs);
    const c = parseColour(cs.backgroundColor);
    let bg = cs.backgroundImage !== 'none';
    let faint = 0;
    if (!bg && c && c.a > 0.05) {
      const back = backOf(el);
      const k = ratioOf(mix(c, back), back);
      if (k >= T) bg = true; else if (k > 1.004) faint = k;
    }
    const v = { sides, shadow, bg, faint, container: bg || shadow || sides.length === 4 };
    paintMemo.set(el, v);
    return v;
  };
  // A text line's box: the glyphs plus the half-leading above and below — what CSS spaces. Two paragraphs 16px apart
  // measure 16 between their line boxes; their glyphs would measure 16 plus each font's leading.
  // The line is placed on its block's own grid — the content top plus whole line heights — since a glyph box is
  // rounded and drifts by up to a pixel (32px of space read as 33). Where the grid does not hold the glyphs (mixed
  // sizes, a 'normal' line height), the glyphs plus the half-leading.
  const lineBoxOf = (el, r) => {
    let blk = el;
    while (blk.parentElement && /^inline/.test(csOf(blk).display) && !/^inline-(block|flex|grid|table)$/.test(csOf(blk).display)) blk = blk.parentElement;
    const bcs = csOf(blk);
    const lh = parseFloat(bcs.lineHeight);
    if (!Number.isNaN(lh) && lh > 0) {
      const b = box(blk);
      const top0 = b.top + parseFloat(bcs.borderTopWidth) + parseFloat(bcs.paddingTop);
      const mid = (r.top + r.bottom) / 2;
      const i = Math.floor((mid - top0) / lh);
      const top = top0 + i * lh;
      if (i >= 0 && r.top >= top - 1 && r.bottom <= top + lh + 1) return { left: r.left, right: r.right, top, bottom: top + lh, width: r.width, height: lh };
    }
    let own = parseFloat(csOf(el).lineHeight);
    if (Number.isNaN(own)) own = parseFloat(csOf(el).fontSize) * 1.2;
    const extra = Math.max(0, (own - r.height) / 2);
    return { left: r.left, right: r.right, top: r.top - extra, bottom: r.bottom + extra, width: r.width, height: r.height + 2 * extra };
  };
  const cut = (r, c) => ({ left: Math.max(r.left, c.left), right: Math.min(r.right, c.right), top: Math.max(r.top, c.top), bottom: Math.min(r.bottom, c.bottom) });
  const empty = (r) => r.right - r.left < 1 || r.bottom - r.top < 1;
  const outOfFlow = (el) => /^(absolute|fixed)$/.test(csOf(el).position);
  const clips = (el) => csOf(el).overflowX !== 'visible' || csOf(el).overflowY !== 'visible';
  // The inks. Text by line; photos, icons and videos; painted boxes (seen as boxes, by L2). Never inks: anything
  // invisible (opacity 0, hidden, an empty live region), a box under T with no border, what a scroll container hides.
  const inks = [];
  const visibleIn = (el, r) => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { if (clips(a)) { r = cut(r, box(a)); if (empty(r)) return null; } } return r; };
  for (const t of texts) for (const g of t.rects) { if (visibleIn(t.el, g)) inks.push({ el: t.el, kind: 'text', r: lineBoxOf(t.el, g), glyph: g }); }
  for (const m of media) { const r = box(m); if (r.width >= 4 && r.height >= 4 && visibleIn(m, r)) inks.push({ el: m, kind: 'media', r }); }
  // A form control the browser draws itself (a radio, a checkbox, a range) is seen with no CSS of its own.
  for (const c of qa('input, select, textarea, progress, meter')) {
    if (hidden(c) || c.type === 'hidden' || csOf(c).appearance === 'none' || parseFloat(csOf(c).opacity) < 0.05) continue;
    const r = box(c);
    if (r.width >= 4 && r.height >= 4 && visibleIn(c, r)) inks.push({ el: c, kind: 'media', r });
  }
  const boxInks = [];
  for (const el of qa('body *')) {
    if (SKIP.has(el.tagName.toUpperCase()) || hidden(el)) continue;
    const p = paintOf(el);
    // A line one side of a box draws (a header's bottom rule, a divider) is an ink of its own: the space either side
    // of it is measured to the line, not across it.
    if (!p.container && p.sides.length) {
      const r = box(el);
      const cs = csOf(el);
      for (const s of p.sides) {
        const w = parseFloat(cs[`border${s}Width`]);
        const lr = s === 'Top' ? { left: r.left, right: r.right, top: r.top, bottom: r.top + w } : s === 'Bottom' ? { left: r.left, right: r.right, top: r.bottom - w, bottom: r.bottom }
          : s === 'Left' ? { left: r.left, right: r.left + w, top: r.top, bottom: r.bottom } : { left: r.right - w, right: r.right, top: r.top, bottom: r.bottom };
        if (r.width >= 4 && r.height >= 1 && visibleIn(el, lr)) inks.push({ el, kind: 'line', r: { ...lr, width: lr.right - lr.left, height: lr.bottom - lr.top } });
      }
      continue;
    }
    if (!p.container) continue;
    // Where the paint is: a background clipped to the content or padding box (a swatch's dot inside its 44px tap
    // padding) is drawn there, not at the border box — unless a border or a shadow draws the outer edge.
    let r = box(el);
    const cs = csOf(el);
    if (!p.sides.length && !p.shadow && /content-box|padding-box/.test(cs.backgroundClip)) {
      const content = cs.backgroundClip === 'content-box';
      const inset = (s) => parseFloat(cs[`border${s}Width`]) + (content ? parseFloat(cs[`padding${s}`]) : 0);
      r = { left: r.left + inset('Left'), right: r.right - inset('Right'), top: r.top + inset('Top'), bottom: r.bottom - inset('Bottom') };
      r = { ...r, width: r.right - r.left, height: r.bottom - r.top };
    }
    if (r.width < 4 || r.height < 4 || !visibleIn(el, r)) continue;
    const k = { el, kind: 'box', r };
    inks.push(k);
    boxInks.push(k);
  }
  // Each element's ink extent: the union of the inks inside it that flow with it (an absolutely placed overlay and what
  // a clipping box hides are left out of its ancestors').
  const ext = new Map();
  for (const k of inks) {
    let r = { left: k.r.left, right: k.r.right, top: k.r.top, bottom: k.r.bottom };
    for (let a = k.el; a && a !== document.documentElement; a = a.parentElement) {
      const e = ext.get(a);
      if (!e) ext.set(a, { ...r }); else { e.left = Math.min(e.left, r.left); e.right = Math.max(e.right, r.right); e.top = Math.min(e.top, r.top); e.bottom = Math.max(e.bottom, r.bottom); }
      if (outOfFlow(a)) break;
      if (a !== k.el && clips(a)) { r = cut(r, box(a)); if (empty(r)) break; }
    }
  }
  const sig = (el) => `${el.tagName}.${typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter((c) => !/\d/.test(c)).sort().join('.') : ''}`;
  const isControl = (el) => /^(A|BUTTON|INPUT|SELECT|TEXTAREA|LABEL|SUMMARY)$/.test(el.tagName) || /^(button|link|tab|switch|checkbox|radio|option|menuitem)$/.test(el.getAttribute('role') || '');
  const insideControl = (el) => !!el.closest('a, button, label, summary, [role="button"]');
  const faced = (el, side) => boxInks.find((k) => (k.el === el || el.contains(k.el)) && Math.abs(k.r[side] - ext.get(el)[side]) <= 0.5);
  const wordsOf = (el) => text(el).slice(0, 40);
  const spacingFlag = (law, where, detail, extra) => flag(law, where, detail, extra);

  // ── the flow pairs: each block's children, as the eye meets them ──────────────────────────────
  // For every box holding two or more visible children in flow: each child's neighbour above (one under the other)
  // and before it (side by side). A side-by-side gap is measured only where both inks reach their boxes' facing edges
  // (cards, photos, painted boxes): text in a column leaves its track's unused space, which is alignment, not a gap.
  const pairs = []; // { p, a, b, axis: 'y' | 'x', gap }
  const parents = new Set();
  for (const el of ext.keys()) if (el.parentElement && el.parentElement !== document.documentElement) parents.add(el.parentElement);
  for (const p of parents) {
    if (!inScope(p) || /^(TABLE|TBODY|THEAD|TFOOT|TR|SVG|svg|SELECT|PICTURE)$/.test(p.tagName)) continue;
    const pcs = csOf(p);
    if (pcs.display.startsWith('inline') && !/flex|grid/.test(pcs.display)) continue;
    const kids = Array.from(p.children).filter((c) => ext.has(c) && !outOfFlow(c) && !hidden(c)
      && (!/^inline$/.test(csOf(c).display) || /flex|grid/.test(pcs.display)));
    if (kids.length < 2) continue;
    const spread = /space-(between|around|evenly)/.test(pcs.justifyContent);
    for (let i = 1; i < kids.length; i++) {
      const b = kids[i];
      const eb = ext.get(b);
      let above = null;
      let before = null;
      // The neighbour above is the row right above it — the lowest earlier sibling ending over it, wherever it sits
      // across (a trail aligned to the end still stands between the header and the content).
      for (let j = i - 1; j >= 0; j--) {
        const ea = ext.get(kids[j]);
        if (eb.top >= ea.bottom - 1 && (!above || ea.bottom > ext.get(above).bottom)) above = kids[j];
        if (!before && overlapY(eb, ea) > Math.min(eb.bottom - eb.top, ea.bottom - ea.top) * 0.5
          && (rtl ? eb.right <= ea.left + 1 : eb.left >= ea.right - 1)) before = kids[j];
      }
      // A flex column that spreads its children, or a child that grows into the free space (a card stretched to its
      // row's height, a button pushed to the bottom), makes the space next to it free space, not a gap.
      const column = /flex/.test(pcs.display) && /column/.test(pcs.flexDirection);
      const grows = (el) => parseFloat(csOf(el).flexGrow) > 0;
      const free = column && (/space-|end|center/.test(pcs.justifyContent) || (above && (grows(above) || grows(b))));
      if (above && !free) pairs.push({ p, a: above, b, axis: 'y', gap: eb.top - ext.get(above).bottom });
      if (before && !spread) {
        const ea = ext.get(before);
        const [ba, bb] = [box(before), box(b)];
        const hug = rtl ? Math.abs(ea.left - ba.left) <= 1 && Math.abs(eb.right - bb.right) <= 1 : Math.abs(ea.right - ba.right) <= 1 && Math.abs(eb.left - bb.left) <= 1;
        if (hug) pairs.push({ p, a: before, b, axis: 'x', gap: rtl ? ea.left - eb.right : eb.left - ea.right });
      }
    }
  }

  // ── L1 never touch — side by side ─────────────────────────────────────────────────────────────
  // Two boxes side by side with under the tight step between them, where each side facing the other is a painted box.
  // Allowed joins: the parts of one box (their common parent draws it); a row of controls drawn as one (a segmented
  // control, a stepper, a field and its button); table cells. Measured on one store: a reviews summary ending at 368px
  // and the first review card starting at 368 — the old checks looked only at boxes one ON the other.
  for (const pr of pairs) {
    if (pr.axis !== 'x' || pr.gap >= TIGHT - 0.5) continue;
    const [fa, fb] = [faced(pr.a, rtl ? 'left' : 'right'), faced(pr.b, rtl ? 'right' : 'left')];
    if (!fa || !fb) continue;
    if (paintOf(pr.p).container || partsOfOneBox(pr.a, pr.b)) continue;
    if ([fa, fb].every((k) => controlBox(k.el, k.r) || isControl(k.el))) continue;
    // A photo full-bleed beside the text of its own card (a split card) is drawn as one.
    if ([fa, fb].some((k) => /^(IMG|VIDEO|PICTURE|CANVAS)$/.test(k.el.tagName) || csOf(k.el).backgroundImage !== 'none')) continue;
    spacingFlag('L1', `${describe(fa.el)} | ${describe(fb.el)}`, `boxes touch side by side: ${round(Math.max(0, pr.gap))}px between ${describe(fa.el)} and ${describe(fb.el)} — set the space between them to a step (${STEPS.filter((v) => v > 0).join(' / ')}px)`,
      { rule: 'touching', measured: round(Math.max(0, pr.gap)), expected: `at least ${TIGHT}px`, design: designOf(pr.b), at: [fa.el, fb.el] });
  }

  // ── L6 scale only ─────────────────────────────────────────────────────────────────────────────
  // Every gap between two neighbours is one of the store's steps at this width (±1px) — or 4px (the tight role) inside
  // one part, and 2 / 6px inside a control. 0 is a join, judged by L1. Gaps past twice the largest step are a layout's
  // free space (a tall hero), not a spacing value. One finding per box, naming each gap and the nearest step.
  const maxStep = Math.max(...STEPS, 64);
  const offStep = new Map();
  for (const pr of pairs) {
    const g = pr.gap;
    if (g <= 0.5 || g > maxStep * 2) continue;
    const small = (el) => (isControl(el) || controlBox(el, box(el))) && box(el).height <= 24;
    const extra = insideControl(pr.p) || (small(pr.a) && small(pr.b)) ? INNER : [TIGHT];
    if (onStep(g, extra)) continue;
    const o = offStep.get(pr.p) || [];
    o.push(pr);
    offStep.set(pr.p, o);
  }
  for (const [p, list] of offStep) {
    const vals = [...new Set(list.map((x) => round(x.gap)))];
    const first = list[0];
    spacingFlag('L6', describe(p), `${vals.join(', ')}px between its parts (${describe(first.a)} → ${describe(first.b)}${list.length > 1 ? ` and ${list.length - 1} more` : ''}) — not a step of the store at this width (${STEPS.join(' / ')}px); nearest: ${vals.map((v) => stepName(nearest(v))).join(', ')}`,
      { rule: 'off the scale', measured: vals, expected: vals.map((v) => nearest(v)), design: designOf(first.b), at: list.flatMap((x) => [x.a, x.b]) });
  }

  // ── L4 same job, same spacing (repeated siblings) and L3 (c) ──────────────────────────────────
  // Siblings of one structure keep one gap between them (±1px), along each axis. And L3 (c), internal ≤ external: a
  // list of boxes keeps its boxes' inset no larger than the space between them.
  const byParentSig = new Map();
  for (const pr of pairs) {
    if (sig(pr.a) !== sig(pr.b)) continue;
    const k = `${sig(pr.a)}|${pr.axis}`;
    const m = byParentSig.get(pr.p) || new Map();
    m.set(k, (m.get(k) || []).concat(pr));
    byParentSig.set(pr.p, m);
  }
  const insetOf = (el) => {
    const r = box(el);
    const cs = csOf(el);
    const inner = { left: r.left + parseFloat(cs.borderLeftWidth), right: r.right - parseFloat(cs.borderRightWidth), top: r.top + parseFloat(cs.borderTopWidth) };
    const all = inks.filter((k) => k.el !== el && el.contains(k.el) && k.kind !== 'line');
    const own = all.filter((k) => k.kind === 'text' && !all.some((o) => o !== k && overlapY(o.r, k.r) > 0 && startOf(o.r) < startOf(k.r) - 1));
    if (!own.length) return null;
    return Math.min(...own.map((k) => (rtl ? inner.right - k.r.right : k.r.left - inner.left)));
  };
  for (const [p, m] of byParentSig) {
    for (const [k, list] of m) {
      const gaps = list.map((x) => x.gap).filter((g) => g > -0.5);
      if (gaps.length >= 2 && Math.max(...gaps) - Math.min(...gaps) > 1) {
        spacingFlag('L4', describe(p), `its ${list.length + 1} ${k.endsWith('|y') ? 'stacked' : 'side-by-side'} ${describe(list[0].b)} are ${[...new Set(gaps.map(round))].join(' / ')}px apart — parts of one kind keep one gap: set it once, on their box`,
          { rule: 'one gap', measured: [...new Set(gaps.map(round))], design: designOf(p), at: list.flatMap((x) => [x.a, x.b]) });
      }
      const boxes2 = [list[0].a, ...list.map((x) => x.b)].filter((el) => paintOf(el).container && !isControl(el));
      if (boxes2.length >= 2 && gaps.length) {
        const ins = boxes2.map(insetOf).filter((v) => v !== null);
        const g = Math.min(...gaps);
        const i = ins.length ? Math.min(...ins) : null;
        if (i !== null && g > 0.5 && i > g + 1) {
          spacingFlag('L3', describe(p), `its boxes keep their content ${round(i)}px in but stand only ${round(g)}px apart — inside a box no more space than between boxes (internal ≤ external): less inset, or more space between them`,
            { rule: 'internal ≤ external', measured: { inset: round(i), gap: round(g) }, design: designOf(p), at: boxes2 });
        }
      }
    }
  }

  // ── L3 proximity — a heading and its group ────────────────────────────────────────────────────
  // A group's items are no further apart than its heading is from the first of them, and a heading is nearer what it
  // labels than what came before it. A heading: h1–h6, a role="heading", a legend, a dt — or a short text block styled
  // apart (bolder, larger, capitals) right before a list. Measured on one store: footer links 38px apart under a heading
  // 28px away, after a phone tap-target fix set their padding on every screen.
  const groups = [];
  const textOnly = (el) => el.children.length === 0 || Array.from(el.querySelectorAll('*')).every((c) => /^(SPAN|STRONG|B|EM|I|SMALL|BR)$/.test(c.tagName));
  const styledApart = (h, item) => {
    const [a, b] = [csOf(h), csOf(item)];
    return parseInt(a.fontWeight, 10) >= 600 && parseInt(a.fontWeight, 10) > parseInt(b.fontWeight, 10)
      || parseFloat(a.fontSize) > parseFloat(b.fontSize) + 1 || (a.textTransform === 'uppercase' && b.textTransform !== 'uppercase');
  };
  for (const h of qa('body *')) {
    if (!ext.has(h) || hidden(h) || !h.parentElement) continue;
    const semantic = /^H[1-6]$/.test(h.tagName) || h.getAttribute('role') === 'heading' || /^(LEGEND|DT)$/.test(h.tagName);
    if (!semantic && !textOnly(h)) continue;
    let next = h.nextElementSibling;
    while (next && (!ext.has(next) || hidden(next))) next = next.nextElementSibling;
    if (!next) continue;
    let items = Array.from(next.children).filter((c) => ext.has(c) && !hidden(c));
    if (!(items.length >= 2 && items.every((c) => sig(c) === sig(items[0])))) {
      items = [];
      for (let s = next; s && ext.has(s) && sig(s) === sig(next); s = s.nextElementSibling) items.push(s);
    }
    if (items.length < 2) continue;
    if (!semantic && !styledApart(h, items[0])) continue;
    const eh = ext.get(h);
    const stacked = items.every((c, i) => i === 0 || ext.get(c).top >= ext.get(items[i - 1]).bottom - 1);
    if (!stacked || ext.get(items[0]).top < eh.bottom - 1) continue;
    const hg = ext.get(items[0]).top - eh.bottom;
    const ig = Math.max(...items.slice(1).map((c, i) => ext.get(c).top - ext.get(items[i]).bottom));
    const g = { h, items, hg, ig, parent: h.parentElement };
    groups.push(g);
    if (ig > hg + 1) {
      spacingFlag('L3', describe(h.parentElement), `"${wordsOf(h)}" heads items ${round(ig)}px apart, yet sits only ${round(hg)}px from the first — a group's items no further apart than its heading is from them: ${round(ig) > 24 ? 'less space between the items' : 'more space under the heading'}`,
        { rule: 'heading and its items', measured: { items: round(ig), heading: round(hg) }, design: designOf(h), at: [h, ...items] });
    }
    let prev = h.previousElementSibling;
    while (prev && (!ext.has(prev) || hidden(prev))) prev = prev.previousElementSibling;
    if (prev && ext.get(prev).bottom <= eh.top + 1 && overlapX(ext.get(prev), eh) > 0) {
      const pg = eh.top - ext.get(prev).bottom;
      if (pg < hg - 1) {
        spacingFlag('L3', describe(h), `"${wordsOf(h)}" sits ${round(pg)}px under what is above it and ${round(hg)}px over what it labels — a heading is nearer what it labels: more space above it`,
          { rule: 'heading nearer its group', measured: { above: round(pg), below: round(hg) }, design: designOf(h), at: [h, prev] });
      }
    }
  }
  // L4, parallel groups: columns side by side, each a heading and its items, keep one gap between items.
  const rowsOfGroups = new Map();
  for (const g of groups) {
    const col = g.parent;
    const row = col.parentElement;
    if (!row) continue;
    rowsOfGroups.set(row, (rowsOfGroups.get(row) || []).concat(g));
  }
  for (const [row, gs] of rowsOfGroups) {
    const side = gs.filter((g) => gs.some((o) => o !== g && Math.abs(ext.get(o.parent).top - ext.get(g.parent).top) <= 2 && overlapX(ext.get(o.parent), ext.get(g.parent)) <= 0));
    if (side.length < 2) continue;
    const gaps = side.map((g) => g.ig);
    if (Math.max(...gaps) - Math.min(...gaps) > 1) {
      spacingFlag('L4', describe(row), `columns side by side space their items ${side.map((g) => `${round(g.ig)}px ("${wordsOf(g.h)}")`).join(', ')} — parallel groups keep one gap between their items`,
        { rule: 'parallel groups', measured: side.map((g) => round(g.ig)), design: designOf(row), at: side.map((g) => g.parent) });
    }
  }

  // ── L2 a box is a box only if it is seen ──────────────────────────────────────────────────────
  // (a) A FAINT box (a background under T, no border, no shadow) is no container: its content sits on the ruler of what
  // stands beside it, and any inset it keeps is a misalignment. (b) A seen box keeps all its content on one inner edge,
  // at least the tight step from its painted sides. (c) A control is wider inside than tall (M3's "squish").
  // A block that centres its own content (a flex row packed in the middle, centred text), or whose content sits in the
  // middle of it with equal space each side (a capped width with auto margins), keeps no start edge.
  const centresOwn = (c) => {
    const cs = csOf(c);
    if (cs.textAlign === 'center' || (/flex|grid/.test(cs.display) && !/column/.test(cs.flexDirection) && /center|space-around|space-evenly/.test(cs.justifyContent))) return true;
    const e = ext.get(c);
    const b = box(c);
    return !!e && e.right - e.left < (b.right - b.left) * 0.9 && Math.abs((e.left - b.left) - (b.right - e.right)) <= 2;
  };
  for (const el of qa('body *')) {
    if (!ext.has(el) || hidden(el)) continue;
    const p = paintOf(el);
    const r = box(el);
    if (p.faint && !p.sides.length && !p.shadow && r.width >= 60 && r.height >= 24 && r.width < W - 2) {
      const inset = startOf(ext.get(el)) - startOf(r);
      const sibs = Array.from(el.parentElement ? el.parentElement.children : []).filter((s) => s !== el && ext.has(s) && !hidden(s) && !paintOf(s).faint);
      const ruler = sibs.length ? Math.min(...sibs.map((s) => startOf(ext.get(s)))) : null;
      const onRuler = ruler === null || Math.abs(startOf(r) - ruler) <= 2;
      if (inset > 2 && onRuler) {
        const back = backOf(el);
        spacingFlag('L2', describe(el), `a box no one sees — its background is ${(Math.floor(p.faint * 100) / 100).toFixed(2)} : 1 against what is behind it (${hex(back)}), under ${T} : 1, with no border or shadow — yet its content starts ${round(inset)}px in, off the edge the parts beside it start on: draw the box (a border, or a background of at least ${T} : 1), or put its content on that edge`,
          { rule: 'faint box', measured: { contrast: Math.round(p.faint * 100) / 100, inset: round(inset) }, expected: `${T} : 1, or no inset`, design: designOf(el), at: el });
      }
      continue;
    }
    if (!p.container || r.width < 80 || r.height < 40 || r.left <= L0 + 1 && r.right >= R0 - 1) continue;
    if (controlBox(el, r) || isControl(el)) continue;
    const cs = csOf(el);
    const inner = { left: r.left + parseFloat(cs.borderLeftWidth), right: r.right - parseFloat(cs.borderRightWidth), top: r.top + parseFloat(cs.borderTopWidth) };
    // Its rows: the children (through single wrappers), each where its own content starts — a seen box inside it at
    // its painted edge; children side by side count once, by the first of the row; a photo spanning the box is media
    // run to its edge. Measured on one store: a bordered group of three columns read as three inner edges.
    let holder = el;
    for (let i = 0; i < 6; i++) { const only = Array.from(holder.children).filter((c) => ext.has(c) && !outOfFlow(c) && !hidden(c)); if (only.length !== 1) break; holder = only[0]; }
    const kids = Array.from(holder.children).filter((c) => ext.has(c) && !outOfFlow(c) && !hidden(c) && c.tagName !== 'LI' && !centred(c) && !centresOwn(c) && !endAligned(c, c));
    const rowsIn = kids.filter((c) => !kids.some((o) => o !== c && overlapY(ext.get(o), ext.get(c)) > 0 && startOf(ext.get(o)) < startOf(ext.get(c)) - 1));
    const kidStart = (c) => { if (paintOf(c).container) return startOf(box(c)); const own = inks.filter((k) => c.contains(k.el) && k.kind !== 'line' && !(k.el === c && k.kind === 'box')); return own.length ? Math.min(...own.map((k) => startOf(k.r))) : null; };
    const bleeds = (c) => inks.some((k) => k.kind === 'media' && c.contains(k.el) && k.r.width >= inner.right - inner.left - 2);
    const at = rowsIn.filter((c) => !bleeds(c)).map((c) => ({ c, d: kidStart(c) })).filter((x) => x.d !== null).map((x) => ({ ...x, d: x.d - startOf(inner) }));
    if (at.length < 2) continue;
    const ds = at.map((x) => x.d);
    if (Math.max(...ds) - Math.min(...ds) > 2) {
      const vals = [...new Set(ds.map(round))].sort((a, b) => a - b);
      spacingFlag('L2', describe(el), `its content starts at ${vals.join(', ')}px from its ${rtl ? 'right' : 'left'} side — everything a box holds starts on one inner edge`,
        { rule: 'one inner edge', measured: vals, design: designOf(el), at: el });
    } else if (Math.min(...ds) < TIGHT - 0.5) {
      spacingFlag('L2', describe(el), `its text starts ${round(Math.max(0, Math.min(...ds)))}px from its painted side — keep a box's content at least ${TIGHT}px in`,
        { rule: 'inset', measured: round(Math.max(0, Math.min(...ds))), expected: `at least ${TIGHT}px`, design: designOf(el), at: el });
    }
  }
  for (const k of boxInks) {
    const el = k.el;
    if (!(controlBox(el, k.r) || isControl(el)) || /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) continue;
    const t = inks.filter((x) => x.kind === 'text' && el.contains(x.el));
    if (t.length !== 1) continue;
    const g = t[0].r;
    const v = Math.min(g.top - k.r.top, k.r.bottom - g.bottom);
    const h = Math.min(g.left - k.r.left, k.r.right - g.right);
    if (v >= 2 && h < v - 1) {
      spacingFlag('L2', describe(el), `"${wordsOf(el)}" keeps ${round(h)}px beside its text and ${round(v)}px above and below — a control is wider inside than tall (the plugin's control steps: 12 × 16, badge 4 × 8)`,
        { rule: 'control inset', measured: { vertical: round(v), horizontal: round(h) }, design: designOf(el), at: el });
    }
  }

  // ── L5 rulers — one column, one edge ──────────────────────────────────────────────────────────
  // The blocks stacked in one column start on one edge (±2px): a block whose content starts elsewhere is off the
  // column's ruler. Not compared: a seen box (its painted edge starts on the ruler, its content one inset in), a faint
  // box (L2 says it), centred or end-aligned blocks, list items (their markers keep a secondary ruler).
  for (const p of parents) {
    if (!inScope(p)) continue;
    const pcs = csOf(p);
    if (/flex/.test(pcs.display) && !/column/.test(pcs.flexDirection)) continue;
    if (/grid/.test(pcs.display) && pcs.gridTemplateColumns.split(' ').length > 1) continue;
    if (paintOf(p).container) continue;
    const kids = Array.from(p.children).filter((c) => ext.has(c) && !outOfFlow(c) && !hidden(c) && c.tagName !== 'LI' && !centred(c) && !centresOwn(c) && !endAligned(c, c) && !paintOf(c).faint);
    if (kids.length < 2) continue;
    // A seen box starts at its painted edge; a band across the page (a footer, a coloured section) at its content,
    // which stands on the page's edge ruler.
    const band = (c) => { const r = box(c); return r.left <= L0 + 1 && r.right >= R0 - 1; };
    const contentOf = (c) => { const own = inks.filter((k) => c.contains(k.el) && k.kind !== 'line' && !(k.el === c && k.kind === 'box')); return own.length ? { left: Math.min(...own.map((k) => k.r.left)), right: Math.max(...own.map((k) => k.r.right)) } : null; };
    const startAt = (c) => { if (!paintOf(c).container) { const r = contentOf(c); return r ? startOf(r) : null; } if (!band(c)) return startOf(box(c)); const r = contentOf(c); return r ? startOf(r) : null; };
    const xs = kids.map(startAt);
    if (xs.filter((x) => x !== null).length < 2) continue;
    const counts = new Map();
    for (const x of xs) { if (x === null) continue; const key = round(x); counts.set(key, (counts.get(key) || 0) + 1); }
    const mode = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
    if (counts.get(mode) < 2) continue;
    // "Or one inset inside a seen box": the content edge of a box standing on the ruler in this column.
    const insideEdges = kids.filter((c, i) => paintOf(c).container && xs[i] !== null && Math.abs(xs[i] - mode) <= 2)
      .map((c) => { const r = contentOf(c); return r ? startOf(r) : null; }).filter((x) => x !== null);
    kids.forEach((c, i) => {
      if (xs[i] === null || Math.abs(xs[i] - mode) <= 2 || (!paintOf(c).container && insideEdges.some((x) => Math.abs(xs[i] - x) <= 2))) return;
      spacingFlag('L5', describe(c), `${c.firstElementChild || ext.has(c) ? `"${wordsOf(c)}"` : describe(c)} starts ${round(Math.abs(xs[i] - mode))}px ${xs[i] > mode ? 'further in than' : 'outside'} the edge the rest of its column starts on — one column, one ruler`,
        { rule: 'column ruler', measured: round(xs[i]), expected: mode, design: designOf(c), at: c });
    });
  }

  // ── L7 build rule — the reading line ──────────────────────────────────────────────────────────
  // Body text keeps a readable line: at most `CL_SPACING.line_length` characters a line (80, WCAG 1.4.8; Material asks
  // 40–60). One finding for the page, naming the longest.
  const LINE = Number(SP && SP.line_length) > 0 ? Number(SP.line_length) : 80;
  let longest = null;
  for (const t of texts) {
    if (t.rects.length < 3 || parseFloat(csOf(t.el).fontSize) > 20) continue;
    const per = t.node.nodeValue.replace(/\s+/g, ' ').trim().length / (t.rects.length - 0.5);
    if (per > LINE && (!longest || per > longest.per)) longest = { t, per };
  }
  if (longest) {
    spacingFlag('L7', describe(longest.t.el), `"${wordsOf(longest.t.el)}…" runs about ${round(longest.per)} characters a line, past ${LINE} — narrow the reading column`,
      { rule: 'line length', measured: round(longest.per), expected: `at most ${LINE}`, design: designOf(longest.t.el), at: longest.t.el });
  }

  // ── L8 overlays ───────────────────────────────────────────────────────────────────────────────
  // What is drawn over a photo or a box — a badge, a label, a control — keeps one distance from the edges it is
  // anchored to, the same for every overlay of that kind, and never touches another overlay. Measured on one store: a
  // "Sold out" badge 8px from the photo's corner on two cards and 0 on a third.
  const hosts = inks.filter((k) => k.kind === 'media' || k.kind === 'box');
  const overlays = [];
  for (const el of qa('body *')) {
    if (!ext.has(el) || hidden(el) || csOf(el).position !== 'absolute') continue;
    const o = ext.get(el);
    const area = (o.right - o.left) * (o.bottom - o.top);
    if (area < 16) continue;
    // Its host is drawn under it, inside the box it is placed in (its nearest positioned ancestor) — or that box itself.
    // A layer covering that whole box (a cover photo, a tint) is a background, not an overlay.
    let cbEl = el.parentElement;
    while (cbEl && cbEl !== document.body && csOf(cbEl).position === 'static') cbEl = cbEl.parentElement;
    if (!cbEl || cbEl === document.body) continue;
    const cbR = box(cbEl);
    if (area >= cbR.width * cbR.height * 0.9) continue;
    let host = null;
    for (const h of hosts) {
      if (h.el === el || el.contains(h.el) || (h.el !== cbEl && (!cbEl.contains(h.el) || h.el.contains(el)))) continue;
      const c = cut(o, h.r);
      if (empty(c) || (c.right - c.left) * (c.bottom - c.top) < area * 0.9) continue;
      const ha = h.r.width * h.r.height;
      if (area > ha * 0.25) continue;
      if (!host || ha < host.r.width * host.r.height) host = h;
    }
    if (!host) continue;
    const hr = host.r;
    const dx = Math.min(o.left - hr.left, hr.right - o.right);
    const dy = Math.min(o.top - hr.top, hr.bottom - o.bottom);
    const corner = `${o.top - hr.top <= hr.bottom - o.bottom ? 'top' : 'bottom'}-${(o.left - hr.left <= hr.right - o.right) !== rtl ? 'start' : 'end'}`;
    if (overlays.some((x) => x.el.contains(el))) continue;
    overlays.push({ el, host, dx, dy, corner, kind: `${kindOf(el)}|${corner}` });
  }
  const byOverlay = new Map();
  for (const ov of overlays) byOverlay.set(ov.kind, (byOverlay.get(ov.kind) || []).concat(ov));
  for (const list of byOverlay.values()) {
    if (list.length < 2) continue;
    const xs = list.map((x) => x.dx); const ys = list.map((x) => x.dy);
    if (Math.max(...xs) - Math.min(...xs) > 1 || Math.max(...ys) - Math.min(...ys) > 1) {
      const vals = [...new Set(list.map((x) => `${round(x.dx)} × ${round(x.dy)}`))];
      spacingFlag('L8', describe(list[0].el), `${list.length} overlays of one kind (${list[0].corner.replace('-', ' ')} of ${describe(list[0].host.el)}) sit ${vals.join(', ')}px from their host's edges — every overlay of a kind keeps one distance from the edges it is anchored to`,
        { rule: 'one placement', measured: vals, design: designOf(list[0].el), at: list.map((x) => x.el) });
    }
  }
  for (let i = 0; i < overlays.length; i++) {
    for (let j = i + 1; j < overlays.length; j++) {
      const [a, b] = [overlays[i], overlays[j]];
      if (a.host !== b.host) continue;
      const [ra, rb] = [ext.get(a.el), ext.get(b.el)];
      if (overlapX(ra, rb) > -TIGHT + 0.5 && overlapY(ra, rb) > -TIGHT + 0.5) {
        spacingFlag('L8', `${describe(a.el)} + ${describe(b.el)}`, `two overlays on ${describe(a.host.el)} touch or cover each other — keep them at least ${TIGHT}px apart`, { rule: 'overlays touch', design: designOf(a.el), at: [a.el, b.el] });
      }
    }
  }

  // ── L9 fixed and floating ─────────────────────────────────────────────────────────────────────
  // A floating button or bar sits on the page's edge from the window's side, covers no other floating thing, and at the
  // end of the page covers no content: the page leaves room for it. Measured on one store: a WhatsApp button 16px from
  // the window against a 48px page edge, and at the page end over the bottom bar's "How we earn money".
  if (!scoped) {
    const floats = qa('body *').filter((el) => csOf(el).position === 'fixed' && ext.has(el) && !hidden(el)
      && !openPanels.some((p) => p === el || p.contains(el) || el.contains(p))).filter((el) => {
      const r = box(el);
      return r.width < W * 0.6 && r.height < window.innerHeight * 0.5 && r.width > 0;
    }).filter((el, i, all) => !all.some((o) => o !== el && o.contains(el)));
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const inFixed = (n) => { for (let a = n; a && a !== document.body; a = a.parentElement) if (csOf(a).position === 'fixed') return true; return false; };
    for (const el of floats) {
      const r = box(el);
      const toStart = r.left - L0;
      const toEnd = R0 - r.right;
      // A centred dialog floats nowhere near a side: it is a panel, judged as one when it is open.
      if (Math.abs(toStart - toEnd) <= 4 || el.getAttribute('role') === 'dialog' || el.getAttribute('aria-modal') === 'true') continue;
      const d = Math.min(toStart, toEnd);
      if (Math.abs(d - EDGE) > 2) {
        spacingFlag('L9', describe(el), `a floating ${describe(el)} sits ${round(d)}px from the window's ${(toStart < toEnd) !== rtl ? 'start' : 'end'} side; the page edge is ${EDGE}px — float it on the page's edge`,
          { rule: 'floating edge', measured: round(d), expected: EDGE, design: designOf(el), at: el });
      }
      for (const o of floats) {
        if (o === el || o.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING) continue;
        const ro = box(o);
        if (overlapX(r, ro) > 0 && overlapY(r, ro) > 0) spacingFlag('L9', `${describe(el)} + ${describe(o)}`, 'two floating things cover each other — stack them, with a step between', { rule: 'floating overlap', design: designOf(el), at: [el, o] });
      }
      // At the page's end, the window shows the last screen: what lies under the floating thing there.
      const atEnd = { left: r.left, right: r.right, top: r.top + window.scrollY + (maxScroll - window.scrollY), bottom: r.bottom + window.scrollY + (maxScroll - window.scrollY) };
      const under = inks.find((k) => k.kind !== 'box' && !inFixed(k.el)
        && overlapX(k.r, atEnd) > 1 && overlapY({ top: k.r.top + window.scrollY, bottom: k.r.bottom + window.scrollY }, atEnd) > 1);
      if (under) {
        spacingFlag('L9', describe(el), `at the end of the page ${describe(el)} covers ${wordsOf(under.el) ? `"${wordsOf(under.el)}"` : describe(under.el)} — leave room for it under the last content (at least its height and a step)`,
          { rule: 'covers content at the end', design: designOf(el), at: [el, under.el] });
      }
    }
  }

  // ── low-contrast ──────────────────────────────────────────────────────────────────────────────
  // Text whose colour against what is painted behind it misses WCAG 1.4.3: 4.5 : 1, or 3 : 1 for large text (24px,
  // or 18.5px bold). The background is composited as painted: every see-through layer over the first solid one.
  // Not judged: text over a photo or a gradient, or in a box placed over the page with nothing solid under the text
  // inside it (what shows behind is not its ancestors'); logos and disabled controls (WCAG's own exceptions).
  // Run it with each overlay open (quick view, cart drawer): measured on one store, a quick view's title, price and
  // button near-white on its white panel, 1.12 : 1, in a drawer every other check skipped.
  const lin = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const lumOf = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
  // A box placed over the page that paints (a photo, a colour, a gradient): a cover block's photo and its tint sit
  // under the text this way, beside it in the markup, not around it.
  const placed = qa('body *').filter((el) => {
    const cs = getComputedStyle(el);
    if (!/^(absolute|fixed)$/.test(cs.position) || hidden(el)) return false;
    return /^(IMG|VIDEO|PICTURE|CANVAS|SVG)$/i.test(el.tagName) || cs.backgroundImage !== 'none' || (parseColour(cs.backgroundColor) || { a: 0 }).a > 0.05;
  }).map((el) => ({ el, r: box(el) }));
  // What the text sits on: its ancestors' backgrounds from the first solid one up, composited. null when that cannot
  // be read — a photo or a gradient on the way, a box placed over the page with nothing solid under the text inside
  // it, or a placed painting box under the solid one overlapping the text.
  const backdrop = (t) => {
    const layers = [];
    let solid = document.documentElement;
    for (let a = t.el; a; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.backgroundImage !== 'none') return null;
      const c = parseColour(cs.backgroundColor);
      if (c && c.a > 0.01) layers.push(c);
      if (c && c.a >= 0.99) { solid = a; break; }
      if (/^(absolute|fixed)$/.test(cs.position)) return null;
    }
    if (placed.some((p) => p.el !== solid && solid.contains(p.el) && !p.el.contains(t.el)
      && t.rects.some((r) => overlapX(r, p.r) > 0 && overlapY(r, p.r) > 0))) return null;
    let bg = layers.length && layers[layers.length - 1].a >= 0.99 ? layers.pop() : { r: 255, g: 255, b: 255, a: 1 };
    while (layers.length) bg = over(layers.pop(), bg);
    return bg;
  };
  const lowContrast = new Map();
  for (const t of texts) {
    if (t.el.closest('[class*="logo" i], [id*="logo" i], .site-title, a[rel="home"], :disabled, [aria-disabled="true"]')) continue;
    const cs = getComputedStyle(t.el);
    const fg = parseColour(cs.color);
    if (!fg || fg.a < 0.1) continue;
    const bg = backdrop(t);
    if (!bg) continue;
    const seen = over(fg, bg);
    const [hi, lo] = [lumOf(seen), lumOf(bg)].sort((a, b) => b - a);
    const ratio = (hi + 0.05) / (lo + 0.05);
    const fs = parseFloat(cs.fontSize);
    const large = fs >= 24 || (fs >= 18.5 && parseInt(cs.fontWeight, 10) >= 700);
    const need = large ? 3 : 4.5;
    if (ratio >= need) continue;
    const k = `${hex(seen)}|${hex(bg)}|${need}`;
    const g = lowContrast.get(k) || { el: t.el, words: text(t.el).slice(0, 40), seen, bg, ratio, need, n: 0 };
    g.n++;
    lowContrast.set(k, g);
  }
  for (const g of lowContrast.values()) {
    flag('low-contrast', describe(g.el), `"${g.words}" is ${hex(g.seen)} on ${hex(g.bg)}, ${(Math.floor(g.ratio * 100) / 100).toFixed(2)} : 1, under the ${g.need} : 1 WCAG 1.4.3 asks for${g.need === 3 ? ' large text' : ''}${g.n > 1 ? ` (${g.n} texts in these colours)` : ''} — change the text's colour or what is behind it`);
  }

  // ── overflow ──────────────────────────────────────────────────────────────────────────────────
  // Content out of its box, which no setting reports: (1) the page wider than the window, or a block past the
  // window's edge (WCAG 1.4.10: nothing scrolls sideways, nothing is lost); (2) a control past its card's edge;
  // (3) text past its box; (4) a word broken mid-word across two lines (`word-break` / `overflow-wrap`; a word
  // hyphenated by `hyphens: auto` is not one). Measured on one store at 768: card buttons standing out of their
  // cards, and product names broken mid-word. A box that clips what overflows it (a slider's track) is skipped.
  const clipMemo = new Map();
  const clipsX = (a) => { if (!clipMemo.has(a)) clipMemo.set(a, getComputedStyle(a).overflowX !== 'visible'); return clipMemo.get(a); };
  const clippedInside = (el, stop) => { for (let a = el.parentElement; a && a !== stop && a !== document.body && a !== document.documentElement; a = a.parentElement) if (clipsX(a)) return true; return false; };
  const pageW = W;
  const past = qa('body *').filter((el) => {
    if (SKIP.has(el.tagName.toUpperCase()) && el.tagName !== 'IMG') return false;
    const r = box(el);
    if (!(r.right > R0 + 1 || r.left < L0 - 1) || r.width === 0 || hidden(el)) return false;
    if (getComputedStyle(el).position === 'fixed' || clippedInside(el, null)) return false;
    return true;
  });
  const outermost = past.filter((el) => !past.some((o) => o !== el && o.contains(el)));
  for (const el of outermost.slice(0, 3)) {
    const r = box(el);
    flag('overflow', describe(el), `reaches ${r.left < L0 - 1 ? `${round(L0 - r.left)}px past the window's left edge` : `${round(r.right - R0)}px past the window's right edge`} (a ${pageW}px window) — ${document.documentElement.scrollWidth > pageW + 1 ? 'the page scrolls sideways' : 'what is out there is cut off'}; size it to its container`);
  }
  for (const { list, cards } of cardLists) {
    const out = [];
    for (const c of cards) {
      if (clipsX(c.el)) continue;
      for (const k of qa(TAPPABLE, c.el).filter((k) => !hidden(k) && !clippedInside(k, c.el))) {
        const r = box(k);
        if (r.right > c.r.right + 1 || r.left < c.r.left - 1) { out.push(k); break; }
      }
    }
    if (out.length) flag('overflow', describe(list), `in ${out.length} of its ${cards.length} cards a control (${describe(out[0])}) stands past the card's edge — let it shrink or wrap inside the card`);
  }
  const blockOf = (el) => { let b = el; while (b && b !== document.body && /^(inline|contents)/.test(getComputedStyle(b).display)) b = b.parentElement; return b; };
  const textPast = new Map();
  const broken = new Map();
  for (const t of texts) {
    const b = blockOf(t.el);
    if (b && b !== document.body && !clipsX(b) && !clippedInside(b, null)) {
      const br = box(b);
      if (t.rects.some((r) => r.right > br.right + 1 || r.left < br.left - 1) && !textPast.has(b)) textPast.set(b, text(t.el).slice(0, 40));
    }
    if (t.rects.length < 2 || getComputedStyle(t.el).hyphens === 'auto') continue;
    const re = /[\p{L}\p{N}]{4,}/gu;
    for (let m = re.exec(t.node.nodeValue); m; m = re.exec(t.node.nodeValue)) {
      const range = document.createRange();
      range.setStart(t.node, m.index);
      range.setEnd(t.node, m.index + m[0].length);
      const tops = Array.from(range.getClientRects()).filter((r) => r.width > 0).map((r) => r.top);
      if (tops.length < 2 || Math.max(...tops) - Math.min(...tops) <= 2) continue;
      const k = kindOf(t.el);
      const g = broken.get(k) || { el: t.el, word: m[0], n: 0 };
      g.n++;
      broken.set(k, g);
    }
  }
  for (const [b, words] of textPast) flag('overflow', describe(b), `"${words}" runs past its box — let the text wrap inside it`);
  for (const g of broken.values()) {
    flag('overflow', describe(g.el), `"${g.word}" is broken mid-word across two lines${g.n > 1 ? ` (${g.n} words in such text)` : ''} — a word cut in two reads as two: wrap between words (drop \`word-break: break-all\` / \`overflow-wrap: anywhere\`), or hyphenate with \`hyphens: auto\``);
  }

  // ── dead-scoped-css ───────────────────────────────────────────────────────────────────────────
  // The store prints each design's custom CSS inside `@scope ([cl-design="…"]) to ([cl-design])`: a rule
  // reaches its own design and stops at every design nested in it — a slider design in a listing's card, a
  // countdown in a product's sticky bar. A rule aimed past that boundary is stored, printed and never applied.
  // Each rule is matched the way @scope matches it: relative to the design's root (`:scope` and `&` are the
  // root; a selector with neither is `:scope <selector>`), an element counting only when no boundary of that
  // scope holds it. :hover, :focus, :active, :visited and pseudo-elements are set aside, so a hover style or a
  // ::before is judged by the element it styles; a rule inside @media counts whatever the screen. Flagged: a
  // rule that reaches nothing in its design but something past a boundary. A rule matching nothing anywhere
  // may be for another page or state: not flagged.
  let scopedRules = null; // stays null where this browser has no @scope: the check could not run
  if (window.CSSScopeRule) {
    scopedRules = 0;
    // A selector list split on its top-level commas (not those inside :is(), [attr] or quotes).
    const splitList = (s) => {
      const parts = [];
      let depth = 0;
      let quote = '';
      let cur = '';
      for (const ch of String(s)) {
        if (quote) { if (ch === quote) quote = ''; } else if (ch === '"' || ch === "'") quote = ch;
        else if (ch === '(' || ch === '[') depth++;
        else if (ch === ')' || ch === ']') depth--;
        else if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; continue; }
        cur += ch;
      }
      if (cur.trim()) parts.push(cur.trim());
      return parts;
    };
    const STATE = ':(?:hover|focus-visible|focus-within|focus|active|visited)(?![\\w-])';
    const atRest = (s) => {
      const out = s.replace(new RegExp(`:not\\(\\s*(?:${STATE}[\\s,]*)+\\)`, 'gi'), '') // :not(:hover) holds at rest
        .replace(new RegExp(STATE, 'gi'), '')
        .replace(/::?(?:before|after|first-line|first-letter)(?![\w-])|::[\w-]+(?:\([^)]*\))?/gi, '').trim();
      return !out || /[>+~]$/.test(out) ? `${out} *`.trim() : out;
    };
    // The roots of a scope on this page, each with its boundaries: the elements its `to (…)` matches inside it.
    const rootsOf = new Map();
    const roots = (scope) => {
      if (!rootsOf.has(scope)) {
        let found = [];
        try { found = scope.start ? qa(scope.start) : []; } catch (e) { /* a start this browser cannot read */ }
        rootsOf.set(scope, found.map((R) => {
          let limits = [];
          try { limits = scope.end ? qa(splitList(scope.end).map((s) => (/:scope(?![\w-])/.test(s) ? s : `:scope ${s}`)).join(', '), R) : []; } catch (e) { /* as above */ }
          return { R, limits };
        }));
      }
      return rootsOf.get(scope);
    };
    const reportedRules = new Set();
    const judge = (scope, sels) => {
      scopedRules++;
      const found = roots(scope);
      if (!found.length) return; // the design is not on this page
      const past = new Set(); // the nested designs holding what the rule matches
      for (const sel of sels) {
        const plain = atRest(sel);
        const rel = /:scope(?![\w-])/.test(plain) ? plain : `:scope ${plain}`;
        for (const { R, limits } of found) {
          let hits;
          try { hits = qa(rel, R); if (R.matches(rel)) hits.unshift(R); } catch (e) { break; } // a selector this browser cannot read: skipped
          for (const el of hits) {
            const limit = limits.find((l) => l.contains(el));
            if (!limit) return; // it applies in its own design
            const holder = el.closest('[cl-design]');
            past.add(holder && limit.contains(holder) ? holder.getAttribute('cl-design') : describe(limit));
          }
        }
      }
      const shown = sels.join(', ');
      if (!past.size || reportedRules.has(`${scope.start} ${shown}`)) return;
      reportedRules.add(`${scope.start} ${shown}`);
      const held = [...past];
      flag('dead-scoped-css', String(scope.start),
        `"${shown.slice(0, 120)}" matches nothing in this design, only inside the nested design${held.length > 1 ? 's' : ''} ${held.slice(0, 3).join(', ')}${held.length > 3 ? ' …' : ''}, where this design's scoped CSS stops — never applied: move it into that design's own custom CSS, or use the setting that design has`);
    };
    // Every style rule inside a @scope, through @media, @supports and @layer, and a nested rule's `&` as its parent.
    const walkScoped = (list, scope, parent) => {
      for (const rule of Array.from(list)) {
        if (rule instanceof CSSScopeRule) { walkScoped(rule.cssRules, rule, null); continue; }
        if (rule.selectorText !== undefined) {
          if (!scope) continue;
          const sels = splitList(rule.selectorText).map((s) => (parent === null ? s.replace(/&/g, ':scope')
            : s.includes('&') ? s.replace(/&/g, `:is(${parent})`) : `:is(${parent}) ${s}`));
          judge(scope, sels);
          if (rule.cssRules && rule.cssRules.length) walkScoped(rule.cssRules, scope, sels.join(', '));
        } else if (rule.cssRules) {
          walkScoped(rule.cssRules, scope, parent);
        }
      }
    };
    for (const sheet of Array.from(document.styleSheets)) {
      try { walkScoped(sheet.cssRules, null, null); } catch (e) { /* another origin: already in unreadable_stylesheets */ }
    }
  }

  // ── the strips: what was measured, drawn on the page ──────────────────────────────────────────
  // With `window.CL_SPACING.draw` set, every ink is outlined (text blue, photos green, boxes orange), every gap between
  // neighbours is labelled in px (green on a step, red off it), the page edge ruler is a dashed line, and every finding
  // is boxed in red with its law. Screenshot the page window by window (the runner does) and open every strip.
  if (SP && SP.draw) {
    document.querySelectorAll('[data-cl-joins-draw]').forEach((n) => n.parentNode.removeChild(n));
    const layer = document.createElement('div');
    layer.setAttribute('data-cl-joins-draw', '');
    layer.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none';
    const sx = window.scrollX;
    const sy = window.scrollY;
    const mark = (r, css, label) => {
      const d = document.createElement('div');
      d.style.cssText = `position:absolute;left:${r.left + sx}px;top:${r.top + sy}px;width:${Math.max(1, r.right - r.left)}px;height:${Math.max(1, r.bottom - r.top)}px;box-sizing:border-box;${css}`;
      if (label) {
        const t = document.createElement('span');
        t.textContent = label;
        t.style.cssText = 'position:absolute;left:0;top:-13px;font:600 10px/12px Arial,sans-serif;background:#fff;color:#111;padding:0 2px;white-space:nowrap';
        d.appendChild(t);
      }
      layer.appendChild(d);
    };
    const tint = { text: 'rgba(0,110,255,.35)', media: 'rgba(0,160,90,.5)', box: 'rgba(255,130,0,.5)', line: 'rgba(160,0,200,.5)' };
    for (const k of inks) mark(k.r, `outline:1px solid ${tint[k.kind]}`);
    for (const pr of pairs) {
      if (pr.gap <= 0.5 || pr.gap > maxStep * 2) continue;
      const [a, b] = [ext.get(pr.a), ext.get(pr.b)];
      const off = !onStep(pr.gap, insideControl(pr.p) ? INNER : [TIGHT]);
      const r = pr.axis === 'y' ? { left: Math.max(a.left, b.left) + 6, right: Math.max(a.left, b.left) + 8, top: a.bottom, bottom: b.top }
        : { left: rtl ? b.right : a.right, right: rtl ? a.left : b.left, top: Math.max(a.top, b.top) + 6, bottom: Math.max(a.top, b.top) + 8 };
      mark(r, `background:${off ? '#e00000' : '#00a000'}`, `${round(pr.gap)}`);
    }
    const edgeX = rtl ? R0 - EDGE : L0 + EDGE;
    mark({ left: edgeX, right: edgeX + 1, top: -sy, bottom: document.documentElement.scrollHeight - sy }, 'border-left:1px dashed rgba(0,150,0,.9)');
    for (const [f, els] of anchors) for (const el of els) if (el && el.getBoundingClientRect) mark(box(el), 'outline:2px solid #e00000', `${f.check}${f.rule ? ` ${f.rule}` : ''}`);
    document.documentElement.appendChild(layer);
  }

  const shownOpen = shownCollapsibles.filter((c) => c.open).length;
  const openCollapsibles = shownOpen;
  const collapsibles = shownCollapsibles.length;
  // What was measured, for the hand-over gate: the page type and the overlay you opened, as you set them
  // (`window.CL_JOINS_PAGE`, `window.CL_JOINS_OPEN`), the panels this script itself sees open over the page (see "an
  // overlay open" at the top), and whether it judged only the overlay.
  const said = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const result = {
    tool: 'joins.js',
    source: location.href,
    measured_at: new Date().toISOString(),
    page_type: said(window.CL_JOINS_PAGE),
    opened: said(window.CL_JOINS_OPEN),
    overlays_open: openPanels.map(describe),
    judged: scoped ? 'the open overlay only' : 'the whole page',
    // The window, and the width the page was laid out in (a classic scrollbar takes ~15px; a frame can be clamped by
    // its parent): a "390" run measured 375px wide is not a phone measurement.
    viewport: { width: window.innerWidth, height: window.innerHeight, content_width: W },
    touch: window.matchMedia('(pointer: coarse)').matches,
    phone_browser: /Mobi/.test(navigator.userAgent) || !!(navigator.userAgentData && navigator.userAgentData.mobile),
    spacing: { steps_from: given ? (SP.source || "the store's Spacing designs") : "the plugin's shipped Spacing designs — no store record given (window.CL_SPACING)",
      screen: phoneSteps ? 'phone' : 'computer', steps: STEPS, page_edge: EDGE, T },
    collapsibles, open_collapsibles: openCollapsibles,
    unreadable_stylesheets: unreadable,
    scoped_rules: scopedRules,
    findings,
  };
  console.log(JSON.stringify(result, null, 2));
  console.info(`joins.js: ${findings.length} finding(s) at ${window.innerWidth}×${window.innerHeight}, ${openCollapsibles} of ${collapsibles} collapsible(s) open.`
    + (collapsibles ? ' Run it again with every collapsible in the other state.' : '')
    + (given ? '' : " Spacing measured against the plugin's SHIPPED steps: set window.CL_SPACING to the store's own (its Spacing designs) and run it again.")
    + (phone && !/Mobi/.test(navigator.userAgent) && !(navigator.userAgentData && navigator.userAgentData.mobile) ? ' This is not a phone browser: the store may serve phones other HTML — measure a phone width with a phone user agent.' : '')
    + (phone && W < window.innerWidth - 1 ? ` The page was laid out ${W}px wide in a ${window.innerWidth}px window (a scrollbar): hide it to measure a phone width.` : '')
    + (phone ? '' : ' Tap targets NOT checked: they are judged on a phone only — run it again at 390×844.')
    + (scopedRules === null ? ' Scoped CSS NOT checked: this browser has no @scope (scoped_rules: null).' : '')
    + (unreadable.length ? `\n${unreadable.length} stylesheet(s) could not be read (another origin): a browser-default finding is marked certain: false.` : ''));
  return result;
})();

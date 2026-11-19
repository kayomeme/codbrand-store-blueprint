/**
 * joins.js — the JOINS between a page's blocks, checked mechanically instead of by eye.
 *
 * Paste this whole file into the browser console of the page you are checking, or run it through your
 * browser tool's evaluate, like measure.js. It prints its findings as JSON and returns them.
 * **Zero findings is the pass.** A finding you decide is right for this design needs a reason, in
 * your report, per finding.
 *
 * Run it on every page you changed, at 1440×900, 768×1024 and 390×844, and on a page with collapsibles (a size
 * guide, an order summary, an FAQ) ONCE WITH EVERY ONE OPEN AND ONCE WITH EVERY ONE CLOSED — a closed
 * block draws its borders somewhere else than an open one. It reads `open_collapsibles` back to you so
 * you can see which state you measured. Then once more with each overlay open (the cart drawer, the
 * checkout popup, a quick view): what an overlay holds is checked only while it is open, and with
 * `window.CL_JOINS_OPEN` set (below) only the overlay is judged — the page under it has its own run. Set
 * `window.CL_JOINS_RHYTHM = { stack, section, edge }` first — the store's two spacing steps and its edge
 * inset at this width (references/palette.md → "Density") — for off-rhythm and edge-mismatch. And name what
 * you measure: `window.CL_JOINS_PAGE` = "home", "category", "product", "cart" or "checkout", and with an
 * overlay open `window.CL_JOINS_OPEN` = "quick view", "cart drawer" or "checkout popup". Save each result it
 * prints as a .json file in one folder: `handover.mjs --joins <folder>` reads them, and fails without them.
 *
 * WHAT IT FLAGS — each one survives every per-setting check and every screenshot of a block alone:
 *
 *   touching-boxes      two visible boxes stacked one on the other with 0px between them, where at
 *                       least one draws a border (or casts a shadow) on that side or their backgrounds
 *                       differ. Measured: an order summary switched on sat flush on the form box below
 *                       it, its closed state drawing its bottom border along the box's top edge. Not a
 *                       seam: a lower box's own divider with clear space on both sides of it, and a box
 *                       that paints nothing on the seam and keeps its visible content away from it — 8px
 *                       below a box, 24px above one.
 *   touching-cards      cards of one list — siblings of one kind, each drawing its own box (a background, a
 *                       shadow or borders on both sides; a row drawing only a line above or below is a row,
 *                       not a card), 80×60px or more — with 0px between them, side by side or one under the
 *                       next: a grid or a slider whose gap is 0. Measured: review cards touching in a row of
 *                       three and in a slider for a month, while every other check passed.
 *   stacked-dividers    two horizontal rules (a top/bottom border with no side borders, or an <hr>)
 *                       within 24px of each other, from two different boxes — or a rule within 12px of
 *                       a bordered box's edge. Two bordered cards 16px apart are a list, not this, and a
 *                       control drawn as a box (a button, a pill, a field) is no line at all. Measured:
 *                       a toggle's bottom rule, then a summary header's top AND bottom rules, then the
 *                       form's border: four lines in under 100px, each block styled as if alone.
 *   browser-default     a heading whose margin or weight, or a link whose colour, comes from the
 *                       browser's own stylesheet: no rule of the page sets it. Measured: two section
 *                       titles taking 1em margins from the browser, and a link in browser blue.
 *                       Where a stylesheet cannot be read (another origin), a finding is marked
 *                       `certain: false` — "could not tell", never "clean".
 *   dead-anchor         an in-page link `href="#id"` whose target is not on the page, or is not rendered
 *                       (switched off, hidden). An empty or 0-height target is one (a skip link's focus
 *                       target). Measured: a summary linking to a shipping block that was switched off.
 *   soft-image          a photo whose file has too few pixels for the box it is drawn in, on this screen
 *                       or on a 2× phone (Lighthouse's rule). Measured: a product gallery drawing 800px
 *                       photos 710px wide, soft on every phone. Scroll the page through first, so lazy
 *                       photos have loaded.
 *   off-rhythm          two cards or sections stacked in one column whose gap is neither of the store's
 *                       two spacing steps (only with CL_JOINS_RHYTHM set). Measured: 0, 4 and 41px
 *                       between the blocks of one checkout popup.
 *   stack-mismatch      collapsibles lined up one under another (a product's description and
 *                       specifications, and a block placed with them) that do not share one look:
 *                       header height, chevron size and colour, the divider under the header, the rule
 *                       between them, the gap above and, open, the body's padding. Measured: a delivery
 *                       block placed under two product sections drew a 22px header with no divider, a
 *                       14px grey chevron, a 12px gap and an unpadded body, against 59px, a 1px divider,
 *                       18px, 24px and 16px.
 *   small-target        on a phone (under 768px wide), a control a shopper taps — a link, a button, a field,
 *                       a toggle, a colour swatch's label over its hidden radio — under 44 × 44px in either
 *                       direction (Apple: 44 × 44pt; WCAG 2.5.5: 44; Material: 48dp). The icon keeps its size;
 *                       its box reaches 44 through padding. The target is what a tap there reaches: its labels,
 *                       a link stretched over its row, a pointer card or a drawn field box holding only it. Not
 *                       one: a link inside a sentence, and a control whose job a 44px one beside it does (a
 *                       link with the same address, pager dots between previous / next arrows). Identical
 *                       targets are one finding with their count. Measured on one store: about 20 controls
 *                       under 44px on a phone — header icons 20 to 22px tall, a card's "+" 30 × 26, colour
 *                       dots 10 × 10, a drawer's × 16 × 22, footer links 18px tall.
 *   dead-scoped-css     a design's custom CSS rule that can never apply. The store prints each design's CSS
 *                       inside `@scope ([cl-design="…"]) to ([cl-design])`, which stops at every design nested
 *                       in it: a rule matching nothing in its own design but something inside a nested one is
 *                       stored, printed and dead. Measured on one store: 15 rules of three listing designs
 *                       aimed at their cards' photo gallery (a 4:5 photo, image cover, the full-screen button,
 *                       the arrows' look and hover) — the gallery is a slider design of its own, and not one
 *                       of the 15 ever applied.
 *   edge-mismatch       the header, the breadcrumb trail, the page's title and the footer not starting their
 *                       content at one distance from the window's edge (±2px) — the header's; with
 *                       CL_JOINS_RHYTHM.edge, the header at that inset on a phone and never nearer the window
 *                       on a wider screen. Content inside a painted box narrower than the window starts where
 *                       the box does; a part aligned to the end (by its CSS, or starting past the window's
 *                       middle) is compared by its end with the header's end. Measured on one store at 1440: header
 *                       72px, trail 48px, title 64px.
 *   glued-to-line       text whose line sits under 8px from a line another block draws. Measured: a trail
 *                       2px under the header's bottom line.
 *   side-gap            inside the cards of a list, under 8px between a card's photo and its text (Material's
 *                       card pads its text 16dp). Measured: a product title 5px under its photo.
 *   low-contrast        text under WCAG 1.4.3's 4.5 : 1 (3 : 1 for 24px, or 18.5px bold) against what is painted
 *                       behind it. Text over a photo or a gradient is not judged; logos and disabled controls
 *                       are WCAG's exceptions. Measured: a quick view's text near-white on its white panel, 1.12 : 1.
 *   overflow            the page wider than the window or a block past its edge (WCAG 1.4.10), a control past
 *                       its card, text past its box, a word broken mid-word across two lines. Measured at 768:
 *                       card buttons out of their cards, product names cut mid-word.
 *
 * A collapsible is a <details>, a block whose header toggles it with aria-expanded, or this plugin's own
 * toggle: an element carrying is_open="yes|no" whose first child is its header. To measure them open,
 * set every is_open to "yes" (and every <details> open); closed, to "no".
 *
 * No dependencies. It only reads the page.
 */
(() => {
  'use strict';

  const W = document.documentElement.clientWidth || window.innerWidth;
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
  const scoped = typeof window.CL_JOINS_OPEN === 'string' && window.CL_JOINS_OPEN.trim() !== '' && openPanels.length > 0;
  if (scoped) inScope = (el) => openPanels.some((p) => p === el || p.contains(el));
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
    flag('touching-boxes', `${describe(s.a.el)} → ${describe(s.b.el)}`,
      `0px between them at y=${s.y + round(window.scrollY)}px${lineOn(s.a.bottom, 'upper')}${lineOn(s.b.top, 'lower')} — give one of them a margin, or set their spacing`);
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
      flag('touching-cards', describe(list),
        `${pairs.length} pair(s) of its ${cards.length} cards touch with 0px between them (${describe(a.el)} and the next, ${how}), and each card draws its own box — set the list's space between cards to the design's, unless the reference joins its cards`);
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

  // ── off-rhythm ────────────────────────────────────────────────────────────────────────────────
  // Only when you pass the store's spacing: `window.CL_JOINS_RHYTHM = { stack: 16, section: 72 }` before
  // running this (the blueprint's density, palette.md → "Density"). Two cards or sections stacked in one
  // column — siblings, at least one painting a background or an outline — sit the stack gap or the
  // section gap apart (±2px); 0 is a join, which touching-boxes judges. Anything else is off the store's
  // rhythm. Measured on one checkout: 0, 4 and 41px between blocks where the design had one 12/16px rhythm.
  const rhythm = window.CL_JOINS_RHYTHM && Number(window.CL_JOINS_RHYTHM.stack) > 0 ? window.CL_JOINS_RHYTHM : null;
  if (rhythm) {
    const steps = [Number(rhythm.stack), Number(rhythm.section)].filter((n) => n > 0);
    // Controls keep their component's own spacing (two buttons in a card), not the page's rhythm.
    const control = (el) => /^(A|BUTTON|INPUT|SELECT|TEXTAREA|LABEL)$/.test(el.tagName) || el.getAttribute('role') === 'button';
    const byEl = new Map(boxes.filter((b) => !control(b.el)).map((b) => [b.el, b]));
    const parents = new Set(boxes.map((b) => b.el.parentElement).filter(Boolean));
    for (const p of parents) {
      const kids = Array.from(p.children).map((c) => byEl.get(c)).filter(Boolean).sort((x, y) => x.r.top - y.r.top);
      for (let i = 1; i < kids.length; i++) {
        const [a, b] = [kids[i - 1], kids[i]];
        if (overlapX(a.r, b.r) < Math.min(a.r.width, b.r.width) * 0.5) continue;
        if (!(a.bg || a.sides || b.bg || b.sides)) continue;
        const gap = b.r.top - a.r.bottom;
        if (gap <= 0.5 || steps.some((s) => Math.abs(gap - s) <= 2)) continue;
        flag('off-rhythm', `${describe(a.el)} → ${describe(b.el)}`,
          `${round(gap)}px between them at y=${round(a.r.bottom + window.scrollY)}px, off the store's rhythm (${steps.join(' / ')}px) — set the lower one's space above to a step`);
      }
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
        flag('stack-mismatch', describe(c.el), `one of ${stack.length} collapsibles stacked here looks different: ${diffs.join('; ')} — blocks of one kind in one stack share one look`);
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
  const rtl = getComputedStyle(document.body).direction === 'rtl';
  const startOf = (r) => (rtl ? W - r.right : r.left); // from the window's start edge: left, or right in RTL
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
  const edgeWant = Number(window.CL_JOINS_RHYTHM && window.CL_JOINS_RHYTHM.edge) > 0 ? Number(window.CL_JOINS_RHYTHM.edge) : null;
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
        if (r.left > 1 && r.right < W - 1 && drawsBox(a)) found = r;
      }
      panelMemo.set(el, found);
    }
    return panelMemo.get(el);
  };
  // A part's content nearest the start edge, and nearest the end edge (the end: right, or left in RTL).
  const endOf = (r) => (rtl ? r.left : W - r.right);
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
        flag('edge-mismatch', describe(p.el), `${p.name} is aligned to the ${otherSide} and ends ${e}px from that edge, ${ref.name} ${e0}px — the parts stacked on every page share one edge: set ${p.name}'s side space so its content ends where ${ref.name}'s does`);
        continue;
      }
      const x = round(startOf(p.start.r));
      if (Math.abs(x - x0) <= 2) continue;
      flag('edge-mismatch', describe(p.el), `${p.name} starts ${x}px from the ${side} edge, ${ref.name} ${x0}px — the parts stacked on every page share one edge: set ${p.name}'s side space so its content starts where ${ref.name}'s does`);
    }
    if (edgeWant && (phone ? Math.abs(x0 - edgeWant) > 2 : x0 < edgeWant - 2)) {
      flag('edge-mismatch', describe(ref.el), `${ref.name} starts ${x0}px from the ${side} edge, and the store's edge inset is ${edgeWant}px${phone ? '' : ' (at least that on a wider screen)'} — set its side space to the inset`);
    }
  }

  // ── glued-to-line ─────────────────────────────────────────────────────────────────────────────
  // Text closer than 8px to a line drawn by another box — a divider it does not own: a trail 2px under the header's
  // bottom line, a heading on a section's rule. Measured between the text's own box (the font's height) and the
  // line. 8px is the smallest gap Material's card puts between two parts of it (its text block
  // has 16dp of padding); a box's own text near its own border is that box's padding, not this.
  const GLUE = 8;
  const gluedTo = new Map();
  for (const l of lines.filter((x) => x.kind === 'divider')) {
    for (const t of texts) {
      if (l.el.contains(t.el)) continue;
      for (const r of t.rects) {
        if (Math.min(r.right, l.right) - Math.max(r.left, l.left) <= 0) continue;
        const d = r.top >= l.y - 0.5 ? r.top - l.y : r.bottom <= l.y + 0.5 ? l.y - r.bottom : null;
        if (d === null || d >= GLUE) continue;
        const g = gluedTo.get(l.el) || { l, d: Infinity, el: null, n: 0 };
        g.n++;
        if (d < g.d) Object.assign(g, { d: Math.max(0, d), el: t.el, words: text(t.el).slice(0, 40) });
        gluedTo.set(l.el, g);
      }
    }
  }
  for (const g of gluedTo.values()) {
    flag('glued-to-line', `${describe(g.l.el)} (${g.l.side}) + ${describe(g.el)}`,
      `"${g.words}" sits ${round(g.d)}px from the line ${describe(g.l.el)} draws${g.n > 1 ? ` (${g.n} line(s) of text under 8px)` : ''} — keep text at least 8px from a line another block draws: give the text's block space on that side`);
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
      if (gap < 8) { hit++; worst = Math.min(worst, Math.max(0, gap)); }
    }
    if (hit) {
      flag('side-gap', describe(list), `${hit} of its ${cards.length} cards keep their text ${round(worst)}px from their photo — at least 8px between a card's photo and its text (Material's card: 16dp of padding around its text); pad the card's text block`);
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
  const pageW = document.documentElement.clientWidth;
  const past = qa('body *').filter((el) => {
    if (SKIP.has(el.tagName.toUpperCase()) && el.tagName !== 'IMG') return false;
    const r = box(el);
    if (!(r.right > pageW + 1 || r.left < -1) || r.width === 0 || hidden(el)) return false;
    if (getComputedStyle(el).position === 'fixed' || clippedInside(el, null)) return false;
    return true;
  });
  const outermost = past.filter((el) => !past.some((o) => o !== el && o.contains(el)));
  for (const el of outermost.slice(0, 3)) {
    const r = box(el);
    flag('overflow', describe(el), `reaches ${r.left < -1 ? `${round(-r.left)}px past the window's left edge` : `${round(r.right - pageW)}px past the window's right edge`} (a ${pageW}px window) — ${document.documentElement.scrollWidth > pageW + 1 ? 'the page scrolls sideways' : 'what is out there is cut off'}; size it to its container`);
  }
  for (const { list, cards } of cardLists) {
    const out = [];
    for (const c of cards) {
      if (clipsX(c.el)) continue;
      for (const k of qa(TAPPABLE, c.el).filter((k) => !hidden(k))) {
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
    viewport: { width: window.innerWidth, height: window.innerHeight },
    collapsibles, open_collapsibles: openCollapsibles,
    rhythm: rhythm ? { stack: Number(rhythm.stack), section: Number(rhythm.section) || null, edge: edgeWant } : (edgeWant ? { edge: edgeWant } : null),
    unreadable_stylesheets: unreadable,
    scoped_rules: scopedRules,
    findings,
  };
  console.log(JSON.stringify(result, null, 2));
  console.info(`joins.js: ${findings.length} finding(s) at ${window.innerWidth}×${window.innerHeight}, ${openCollapsibles} of ${collapsibles} collapsible(s) open.`
    + (collapsibles ? ' Run it again with every collapsible in the other state.' : '')
    + (rhythm ? '' : ' Spacing NOT checked: set window.CL_JOINS_RHYTHM = { stack, section } (the store\'s density) and run it again.')
    + (phone ? '' : ' Tap targets NOT checked: they are judged on a phone only — run it again at 390×844.')
    + (scopedRules === null ? ' Scoped CSS NOT checked: this browser has no @scope (scoped_rules: null).' : '')
    + (unreadable.length ? `\n${unreadable.length} stylesheet(s) could not be read (another origin): a browser-default finding is marked certain: false.` : ''));
  return result;
})();

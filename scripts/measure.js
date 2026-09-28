/**
 * measure.js — the checklist in references/reference-extraction.md, measured instead of eyeballed.
 *
 * Paste this whole file into the browser console of the page you are measuring, or run it through
 * your browser tool's evaluate. It prints ONE spec in exactly the shape scripts/match.mjs reads,
 * and returns it. Save it as reference-1440.json, live-390.json and so on.
 *
 * Run it once per page and per width — 1440×900, then 390×844 — on the reference and on the store
 * you built. Before you run it, dismiss consent banners and pop-ups yourself and take a screenshot.
 * It never dismisses anything: a dismissal heuristic once removed a store's own header and footer.
 * If something fixed still covers much of the page it stops and lists it; once your screenshot shows
 * that element belongs to the design, set `window.CL_MEASURE_IGNORE_OVERLAYS = true` and run again.
 *
 * On a PRODUCT page it also writes the `product.*` rows. A plugin store's product page, and a page that
 * declares a Product (JSON-LD, og:type, a `single-product` body class), is recognised by itself; a page
 * that declares nothing (a page builder's product page) is not — set `window.CL_MEASURE_PAGE = 'product'`
 * first on that page. Measure the reference and the store in the SAME browser mode (a desktop window
 * with its scrollbar, or a phone), or wrapping text makes heights and gutters differ for no real reason.
 *
 * WHAT IT GUARANTEES
 * - The measuring rules are built in. A background walks UP from the visible text to the first
 *   painted ancestor, and an image on the way makes the row unmeasurable. A text row
 *   reads the deepest element holding visible text. Colours come in pairs, and a pair at contrast
 *   1.5 or below is refused on both rows, because it proves one of them came off the wrong element.
 *   A background of gradients only (no image) reads as its FIRST colour stop, on both passes, with a
 *   note saying so.
 * - A store built with the plugin is read through its own containers and classes. A reference site
 *   is read through <header>, <footer>, <nav>, links to the home page (a locale root like /en-ae
 *   included), and page geometry. With no landmarks at all, the header is the band holding the logo,
 *   its menu the first row of three or more short links, and the footer the block around the © line.
 *   It reads the page as it is laid out NOW: run it in the tab in front, at rest at the top — a header
 *   that changes on scroll can be caught half-way in a background tab.
 * - A row it cannot resolve with confidence comes back as `"value": null` with
 *   `"reason": { "kind": "unmeasurable" }` and what it tried. match.mjs reports such a row and never
 *   passes it: measure that row by hand and replace it in the file.
 * - `"value": null` WITHOUT a reason means the page has no such surface (no topbar, no reviews).
 * - The review-card and product-card rows are read on a plugin store only. Every theme builds those
 *   differently, so on a reference they come back unmeasurable, for you to measure by hand.
 *
 * DEFINITIONS the checklist leaves open, fixed here so both passes agree:
 * - `footer.columns` counts column groups: one per heading (a short title, 40 characters or fewer),
 *   plus a brand block with no heading of its own. `footer.links_per_column` lists the text links in
 *   each, left to right.
 * - `header.trailing_icons` names the icon controls after the menu, in reading order — on a header in
 *   two rows, those after the logo on its row. An icon may be an svg, an image or an icon font; the
 *   label counted against a control's 20 characters is the one a visitor sees.
 * - `product.gallery_width` of a grid of equal photos side by side is the grid's width, and such a
 *   grid has no thumbnails. Thumbnails are a set of same-size images of 40px or more by the photo.
 * - `reviews.card_border` is the card's top border (`none` when it has none), `reviews.card_padding`
 *   its left padding.
 * - `header.height` excludes a topbar that sits inside the reference's <header>.
 * - Every gutter row is measured from the side text starts on: the left, or the right on a
 *   right-to-left page. The `_left` in `header.gutter_left` names the usual case, not the side.
 * - `header.border_bottom` is the line along the header's bottom edge, whether the header draws it,
 *   a wrapper around it, or a row inside it at least half its width.
 * - `topbar.text_align` is where the message visibly sits in its bar, read from the rendered text: a
 *   flex or grid bar centres text whose own `text-align` still says left.
 * - `page.max_width` and `page.gutter` are what most sections of the page agree on. A section is the
 *   outermost block around its first left-aligned text that does not run edge to edge; its gutter is
 *   the padding edge that text sits at, and its max width is its width when a px cap holds it back
 *   (`null` when none does — a phone, a fluid page). A centred title has no vote on either, nor does
 *   one slide or card of a row, nor a caption laid over an image. A block running edge to edge whose
 *   text is held in by a left padding votes that padding as a gutter, and no max width.
 *
 * No dependencies. It only reads the page: it scrolls to the top first, as a visitor lands, and scrolls
 * down and back once to see whether a sticky header stays.
 */
(() => {
  'use strict';

  // The page's own width, WITHOUT a vertical scrollbar. window.innerWidth includes it, so in a desktop
  // browser nothing ever reached "edge to edge" and every section-voting and right-to-left gap was off
  // by the scrollbar (~15px). The viewport (VW) is still what the spec reports and checks.
  const W = document.documentElement.clientWidth || window.innerWidth;
  const VW = window.innerWidth;
  const H = window.innerHeight;
  const today = new Date().toISOString().slice(0, 10);

  // ── small helpers ─────────────────────────────────────────────────────────────────────────────
  const q = (sel, root = document) => (root ? root.querySelector(sel) : null);
  const qa = (sel, root = document) => (root ? Array.from(root.querySelectorAll(sel)) : []);
  const box = (el) => el.getBoundingClientRect();
  const round = (n) => Math.round(n);
  const text = (el) => (el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  const describe = (el) => el ? el.tagName.toLowerCase() + (el.id ? '#' + el.id : '')
    + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '') : '(none)';

  const isShown = (el) => {
    if (!el || !el.isConnected) return false;
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
  // The format the checklist's own examples use, so a hand-measured row compares equal.
  const colourString = (c) => `rgb(${round(c.r)},${round(c.g)},${round(c.b)})`;
  const luminance = (c) => {
    const ch = [c.r, c.g, c.b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const contrast = (a, b) => {
    const l1 = luminance(a);
    const l2 = luminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };

  /**
   * A background made of gradients only (no url()): its FIRST colour stop. Both passes read a
   * gradient this way, so the reference and the store compare like with like — before 26-09-2026 a
   * store's gradient topbar was unmeasurable while the reference's identical strip read as a colour.
   */
  const gradientStop = (image) => {
    if (/url\(/i.test(image) || !/gradient\(/i.test(image)) return null;
    const m = image.match(/rgba?\([^)]*\)/i);
    return m ? parseColour(m[0]) : null;
  };

  /** Rule 1, backgrounds: walk UP to the first opaque paint, blending any translucent layers. */
  const paintUp = (start) => {
    const layers = [];
    let gradient = null;
    let painter = null; // the element whose opaque paint ended the walk
    for (let el = start; el; el = el.parentElement) {
      const cs = getComputedStyle(el);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        const stop = gradientStop(cs.backgroundImage);
        if (!stop) return { image: el };
        gradient = el;
        layers.push(stop);
        if (stop.a >= 0.99) { painter = el; break; }
        continue;
      }
      const c = parseColour(cs.backgroundColor);
      if (c && c.a > 0) {
        layers.push(c);
        if (c.a >= 0.99) { painter = el; break; }
      }
    }
    // Nothing opaque below: the page canvas, which browsers paint white.
    const colour = layers.reverse().reduce((under, top) => ({
      r: top.r * top.a + under.r * (1 - top.a),
      g: top.g * top.a + under.g * (1 - top.a),
      b: top.b * top.a + under.b * (1 - top.a),
      a: 1,
    }), { r: 255, g: 255, b: 255, a: 1 });
    return { colour, gradient, painter };
  };
  const gradientNote = (bg) => (bg.gradient ? { note: `a gradient on ${describe(bg.gradient)}: its first colour stop` } : {});

  /** Rule 1, text: the deepest element holding visible text. */
  // `unpinned` skips text on a fixed layer inside the root — a "back to top" button kept in the footer
  // markup floats over the page, and appears only after a scroll (measured 28-09-2026: footer gutter 1368).
  const pinned = (el, root) => { for (let a = el; a && a !== root; a = a.parentElement) if (getComputedStyle(a).position === 'fixed') return true; return false; };
  const textDown = (root, unpinned = false) => {
    if (!root) return null;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.nodeValue.trim().length > 1 && isShown(n.parentElement) && !(unpinned && pinned(n.parentElement, root)))
        ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP,
    });
    const n = walker.nextNode();
    return n ? n.parentElement : null;
  };

  /** A band's own text: the first fully on screen whose walk up to the band crosses no paint — not a
   *  badge or a pill inside it, and not a ticker item scrolled half out of view. */
  const textOnBand = (band) => {
    const walker = document.createTreeWalker(band, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (n.nodeValue.trim().length < 2 || !isShown(el) || box(el).left < 0 || box(el).right > W) continue;
      let onBand = true;
      for (let a = el; a && a !== band; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.backgroundImage !== 'none' || (parseColour(cs.backgroundColor) || { a: 0 }).a > 0) { onBand = false; break; }
      }
      if (onBand) return el;
    }
    return textDown(band);
  };

  // The home page is "/" — or a LOCALE ROOT: one or two language/country segments such as /en-ae, /ae-en/
  // or /ae/en/. Measured 28-09-2026: three stores linked their logo to exactly those, and with "/" alone
  // a 39px sister-brand icon in the top strip was taken for the logo.
  const LOCALE = /^[a-z]{2}(?:[-_][a-z]{2})?$/i;
  const isHomeLink = (a) => {
    try {
      const u = new URL(a.href, location.href);
      const parts = u.pathname.split('/').filter(Boolean);
      return u.origin === location.origin && !u.hash && parts.length <= 2 && parts.every((p) => LOCALE.test(p));
    } catch (e) {
      return false;
    }
  };
  const SOCIAL = /(facebook|fb\.com|instagram|tiktok|twitter|x\.com|youtube|youtu\.be|pinterest|linkedin|snapchat|wa\.me|whatsapp|threads\.net|telegram|t\.me)/i;
  /** What a header control says it is — from its label, title, class, id, link, its own (often
   *  visually hidden) text, or its icon font's class: "Search", "Wishlist", "icon-heart". */
  const nameOf = (el) => {
    const glyph = el.querySelector('i[class], [class*="icon"]');
    return kindOf([el.getAttribute('aria-label'), el.title, el.className, el.id, el.getAttribute('href'), (el.textContent || '').slice(0, 60),
      glyph ? String(glyph.className) : '',
      el.getAttribute('data-open-cart') ? 'cart' : '', el.getAttribute('data-open-search') ? 'search' : ''].join(' '));
  };
  const kindOf = (words) => {
    const s = words.toLowerCase();
    if (/search|recherche|chercher|بحث/.test(s)) return 'search';
    if (/cart|bag|basket|panier|sac|سلة/.test(s)) return 'cart';
    // Wishlist before account: a wishlist often lives under the account ("/my-account/wishlist").
    if (/wish|heart|favou?r|favori|my list/.test(s)) return 'wishlist';
    if (/account|user|login|log in|sign in|sign-in|profile|customer|compte|connexion|حساب/.test(s)) return 'account';
    if (/menu|burger|hamburger|toggle|flexnav|drawer/.test(s)) return 'menu';
    return 'other';
  };

  // ── rows ──────────────────────────────────────────────────────────────────────────────────────
  const rows = [];
  const put = (row) => { rows.push(row); };
  const add = (id, value, extra = {}) => put(Object.assign({ id, value }, extra));
  const unmeasurable = (id, why, extra = {}) =>
    put(Object.assign({ id, value: null, reason: { kind: 'unmeasurable', evidence: `measure.js: ${why}` } }, extra));
  const absent = (ids) => ids.forEach((id) => add(id, null));
  const px = (id, n, tolerance = 4) => add(id, round(n), { unit: 'px', tolerance });
  /** One section at a time: a section that throws marks its missing rows unmeasurable, never the run. */
  const section = (ids, fn) => {
    try {
      fn();
    } catch (e) {
      ids.filter((id) => !rows.some((r) => r.id === id)).forEach((id) => unmeasurable(id, `failed while measuring (${e.message})`));
    }
  };

  /** Rule 2: a colour is recorded only with its partner, and an unreadable pair is refused. */
  const pair = (bgId, textId, textEl) => {
    if (!textEl) {
      unmeasurable(bgId, 'no visible text to walk up from', { traversal: 'paint-up' });
      unmeasurable(textId, 'no visible text found', { traversal: 'text-down', pair_with: bgId });
      return;
    }
    const bg = paintUp(textEl);
    const fg = parseColour(getComputedStyle(textEl).color);
    if (bg.image) {
      const why = `the backdrop behind ${describe(textEl)} is an image or a gradient on ${describe(bg.image)}, so it has no single colour`;
      unmeasurable(bgId, why, { traversal: 'paint-up' });
      unmeasurable(textId, why, { traversal: 'text-down', pair_with: bgId });
      return;
    }
    if (!fg) {
      unmeasurable(bgId, `the text colour of ${describe(textEl)} is not in a readable form`, { traversal: 'paint-up' });
      unmeasurable(textId, `the text colour of ${describe(textEl)} is not in a readable form`, { traversal: 'text-down', pair_with: bgId });
      return;
    }
    const ratio = contrast(fg, bg.colour);
    if (ratio <= 1.5) {
      const why = `text ${colourString(fg)} on ${colourString(bg.colour)} is contrast ${ratio.toFixed(2)}, which nobody could read, so one of the two came off the wrong element — measure both by hand`;
      unmeasurable(bgId, why, { traversal: 'paint-up' });
      unmeasurable(textId, why, { traversal: 'text-down', pair_with: bgId });
      return;
    }
    add(bgId, colourString(bg.colour), Object.assign({ traversal: 'paint-up' }, gradientNote(bg)));
    add(textId, colourString(fg), { traversal: 'text-down', pair_with: bgId });
  };

  const fontRows = (prefix, el, keys) => {
    const cs = getComputedStyle(el);
    if (keys.includes('font_size')) add(`${prefix}font_size`, round(parseFloat(cs.fontSize)), { unit: 'px', tolerance: 1, traversal: 'text-down' });
    if (keys.includes('font_weight')) add(`${prefix}font_weight`, parseInt(cs.fontWeight, 10) || cs.fontWeight, { traversal: 'text-down' });
    if (keys.includes('text_transform')) add(`${prefix}text_transform`, cs.textTransform, { traversal: 'text-down' });
  };

  /**
   * Where a line of text sits across its band: left, center or right. Read from the rendered text of
   * its own block, never from `text-align` — a flex or grid band centres text whose text-align says left.
   */
  const alignIn = (textEl, band) => {
    const textRects = (root) => {
      const rects = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.nodeValue.trim() || !isShown(n.parentElement)) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        rects.push(...Array.from(range.getClientRects()).filter((r) => r.width > 0));
      }
      return rects;
    };
    const b = box(band);
    // Text cut by the band's edge is a scrolling ticker, and a ticker has no alignment. A rotator's
    // waiting messages park wholly outside the band; those are not cut, and do not count.
    if (textRects(band).some((r) => (r.left < b.left - 1 && r.right > b.left + 1) || (r.left < b.right - 1 && r.right > b.right + 1))) return null;
    let block = textEl;
    while (block !== band && block.parentElement && getComputedStyle(block).display.startsWith('inline')) block = block.parentElement;
    const rects = textRects(block);
    const leftGap = Math.min(...rects.map((r) => r.left)) - b.left;
    const rightGap = b.right - Math.max(...rects.map((r) => r.right));
    if (Math.abs(leftGap - rightGap) <= Math.max(8, b.width * 0.05)) return 'center';
    return leftGap < rightGap ? 'left' : 'right';
  };

  const borderOf = (el) => {
    const cs = getComputedStyle(el);
    const w = parseFloat(cs.borderTopWidth);
    if (!w || cs.borderTopStyle === 'none' || cs.borderTopStyle === 'hidden') return 'none';
    const c = parseColour(cs.borderTopColor);
    return `${round(w)}px ${cs.borderTopStyle} ${c ? colourString(c) : cs.borderTopColor}`;
  };
  const borderBottomOf = (el) => {
    const cs = getComputedStyle(el);
    const w = parseFloat(cs.borderBottomWidth);
    if (!w || cs.borderBottomStyle === 'none' || cs.borderBottomStyle === 'hidden') return 'none';
    const c = parseColour(cs.borderBottomColor);
    return `${round(w)}px ${cs.borderBottomStyle} ${c ? colourString(c) : cs.borderBottomColor}`;
  };

  // ── before anything: the page as a visitor lands on it, nothing covering it ───────────────────
  window.scrollTo(0, 0);
  const pluginStore = !!q('.cl-header-container, .cl-footer-container, .cl-topbar-container');
  // Every gutter is measured from the side text starts on: the left, or the right on a right-to-left page.
  const rtl = getComputedStyle(document.documentElement).direction === 'rtl';
  const startGap = (el) => (rtl ? W - box(el).right : box(el).left);

  // A reference with no <header> (page builders often have none): the band around the menu at the top
  // of the screen — the first <nav> there, widened while its ancestors are still the height of a bar.
  const bandAroundTopMenu = () => {
    const menu = qa('nav').find((n) => isShown(n) && box(n).top < H / 3 && qa('a', n).filter(isShown).length >= 2);
    if (!menu) return null;
    let band = menu;
    for (let el = menu.parentElement; el && el !== document.body; el = el.parentElement) {
      if (box(el).height > box(menu).height + 60 || box(el).top < box(menu).top - 60) break;
      band = el;
    }
    return band;
  };
  // A reference's LOGO: the home link near the top holding an image — the largest, so a small sister-brand
  // or flag icon never wins — else the first home link there.
  const topHomeLinks = pluginStore ? [] : qa('a').filter((a) => isShown(a) && isHomeLink(a) && box(a).top < H / 2);
  const area = (el) => box(el).width * box(el).height;
  const pageLogo = topHomeLinks.filter((a) => q('img, svg', a)).sort((a, b) => area(b) - area(a))[0] || topHomeLinks[0] || null;
  // The band around the logo: its widest ancestor that still starts at the top and is the height of a
  // header, not the page. Used when the page has no <header> at all (measured: a store built entirely of
  // <div>s, whose only <nav> elements were hidden dropdowns).
  const bandAroundLogo = (logo) => {
    let band = null;
    for (let el = logo; el && el !== document.body; el = el.parentElement) {
      const r = box(el);
      if (r.height > 260 || r.top < -1) break;
      if (r.width >= W * 0.9) band = el;
    }
    return band;
  };
  const headers = pluginStore ? [] : qa('header, [role="banner"]').filter(isShown);
  const headerEl = pluginStore
    ? (q('.cl-header-container header.cl-site-header') || q('.cl-header-container'))
    // Several <header>s (or none): the one holding the logo wins over the first in the page.
    : (pageLogo && headers.find((h) => h.contains(pageLogo))) || headers[0] || (pageLogo && bandAroundLogo(pageLogo)) || bandAroundTopMenu();
  // No <footer>: the bottom block holding the copyright line — the widest ancestor of it that leaves the
  // header out and is a footer's height, not the page's.
  const footerAroundCopyright = () => {
    const pageH = document.documentElement.scrollHeight;
    const copy = qa('body *').filter((el) => el.children.length <= 3 && isShown(el) && box(el).top + window.scrollY > pageH * 0.5
      && /©|copyright|all rights reserved|tous droits|derechos|جميع الحقوق/i.test(text(el)))
      .sort((a, b) => text(a).length - text(b).length)[0];
    let block = null;
    for (let el = copy; el && el !== document.body; el = el.parentElement) {
      if ((headerEl && el.contains(headerEl)) || box(el).height > pageH * 0.6) break;
      if (box(el).width >= W * 0.9) block = el;
    }
    return block;
  };
  const footerEl = pluginStore
    ? (q('.cl-footer-container footer.cl-site-footer') || q('.cl-footer-container'))
    : qa('footer, [role="contentinfo"]').filter(isShown).pop() || footerAroundCopyright();

  const overlays = qa('body *').filter((el) => {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' || !isShown(el)) return false;
    if ((headerEl && (headerEl.contains(el) || el.contains(headerEl))) || el.closest('.cl-topbar-container')) return false;
    // A layer that paints nothing — no background, image, border or visible text or media — covers
    // nothing: measured, a transparent full-screen wrapper stopped the run on a store.
    const paintsSomething = (parseColour(cs.backgroundColor) || { a: 0 }).a > 0.05 || cs.backgroundImage !== 'none'
      || parseFloat(cs.borderTopWidth) > 0 || text(el) || qa('img, video, canvas, iframe, svg', el).some(isShown);
    if (!paintsSomething) return false;
    const r = box(el);
    const visibleArea = Math.max(0, Math.min(r.right, W) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, H) - Math.max(r.top, 0));
    return visibleArea >= 0.25 * W * H;
  });
  if (overlays.length && window.CL_MEASURE_IGNORE_OVERLAYS !== true) {
    const found = overlays.map((el) => `${describe(el)} (${round(box(el).width)}×${round(box(el).height)})`);
    console.warn('measure.js stopped — fixed element(s) cover a quarter of the viewport or more:\n  '
      + found.join('\n  ') + '\nDismiss them, take a screenshot, and run again. If the screenshot shows they are part of the '
      + 'design, set window.CL_MEASURE_IGNORE_OVERLAYS = true first.');
    return { error: 'overlay', overlays: found };
  }

  // ── topbar ────────────────────────────────────────────────────────────────────────────────────
  const logoLink = (() => {
    if (pluginStore) return q('.logo-container a', headerEl);
    // The home link holding an image (the largest), else the first home link; failing that — a one-page
    // site's logo links to its own top, #accueil — the LARGEST header link holding an image that does not
    // name itself as a control (the first one was a 39px sister-brand icon on one store).
    if (pageLogo && (!headerEl || headerEl.contains(pageLogo))) return pageLogo;
    const links = qa('a', headerEl || document.body).filter(isShown);
    return links.filter(isHomeLink).sort((a, b) => (q('img, svg', b) ? 1 : 0) - (q('img, svg', a) ? 1 : 0))[0]
      || (headerEl && links.filter((a) => q('img, svg', a) && nameOf(a) === 'other').sort((a, b) => area(b) - area(a))[0]) || null;
  })();
  const topbarIds = ['topbar.present', 'topbar.height', 'topbar.background', 'topbar.text_color', 'topbar.font_size',
    'topbar.font_weight', 'topbar.text_transform', 'topbar.text_align', 'topbar.message_count', 'topbar.message_is_link', 'topbar.arrows'];
  let topbarEl = null;
  section(topbarIds, () => {
    if (pluginStore) {
      const t = q('.cl-topbar-container .cl-header-topbar');
      topbarEl = t && isShown(t) && q('.cl-topbar-message', t) ? t : null;
    } else {
      // A full-width band at the very top, above the logo row, holding some text — never the header
      // itself, nor anything around it.
      const logoTop = logoLink ? box(logoLink).top : (headerEl ? box(headerEl).top + 24 : 120);
      topbarEl = qa('body *').filter((el) => {
        const r = box(el);
        return r.top <= 2 && r.width >= W * 0.9 && r.height >= 18 && r.height <= 70 && r.bottom <= logoTop + 2
          && text(el).length > 3 && isShown(el) && !(logoLink && el.contains(logoLink)) && !(headerEl && el.contains(headerEl));
      }).sort((a, b) => box(b).height - box(a).height)[0] || null;
    }
    add('topbar.present', !!topbarEl);
    if (!topbarEl) {
      absent(topbarIds.slice(1));
      return;
    }
    px('topbar.height', box(topbarEl).height);
    const msgText = pluginStore
      ? textDown(q('.cl-topbar-message.is-active', topbarEl) || q('.cl-topbar-message', topbarEl))
      : textOnBand(topbarEl);
    pair('topbar.background', 'topbar.text_color', msgText);
    if (msgText) {
      fontRows('topbar.', msgText, ['font_size', 'font_weight', 'text_transform']);
      add('topbar.text_align', alignIn(msgText, topbarEl), { traversal: 'text-down' });
    } else {
      ['topbar.font_size', 'topbar.font_weight', 'topbar.text_transform', 'topbar.text_align'].forEach((id) => unmeasurable(id, 'no visible message text'));
    }
    if (pluginStore) {
      // A marquee prints every message twice; count each message once.
      add('topbar.message_count', new Set(qa('.cl-topbar-message', topbarEl).map((m) => m.getAttribute('data-message-id'))).size);
      const active = q('.cl-topbar-message.is-active', topbarEl) || q('.cl-topbar-message', topbarEl);
      add('topbar.message_is_link', !!q('a.cl-topbar-message-content, a[href]', active));
    } else {
      unmeasurable('topbar.message_count', 'a rotating reference topbar shows one message at a time and keeps the rest in markup no two themes share — count them by watching it');
      add('topbar.message_is_link', !!(msgText && msgText.closest('a[href]')));
    }
    add('topbar.arrows', qa('button, a, [role="button"]', topbarEl).some((b) =>
      isShown(b) && /prev|next|arrow|chevron|précédent|suivant/i.test([b.getAttribute('aria-label'), b.title, b.className, b.id].join(' '))));
  });

  // ── header ────────────────────────────────────────────────────────────────────────────────────
  const headerIds = ['header.height', 'header.background', 'header.border_bottom', 'header.gutter_left', 'header.logo_present',
    'header.logo_kind', 'header.logo_width', 'header.nav_items', 'header.nav_labels', 'header.nav_font_size', 'header.nav_font_weight',
    'header.nav_text_transform', 'header.nav_color', 'header.trailing_icons', 'header.sticky'];
  section(headerIds, () => {
    if (!headerEl || !isShown(headerEl)) {
      headerIds.forEach((id) => unmeasurable(id, pluginStore ? 'the store renders no plugin header on this page' : 'no <header>, no [role="banner"] and no menu near the top of the page'));
      return;
    }
    const inner = topbarEl && headerEl.contains(topbarEl) ? box(topbarEl).height : 0;
    px('header.height', box(headerEl).height - inner);

    // Every link in the menu, then the ones a visitor can see. The plugin's menu stays hidden until its
    // script has measured it and marked it .cl-nav-ready, so a page measured before that (or in a
    // background tab, where the script waits) shows none of it. Anywhere else, a menu with no link
    // showing is a menu folded away at this width, and it counts zero.
    // A reference's MENU: the first ROW of at least three visible short text links in the header, at or
    // below the logo and outside the topbar — inside a <nav> or not. Measured 28-09-2026: one store's
    // menu was <a> buttons in <div>s while its only <nav> elements were hidden dropdowns; another had a
    // white menu row above a black category bar, and "the <nav> with the most links" picked the bar. The
    // logo, a filled call-to-action button and an icon control (cart, account…) are never menu items.
    const referenceMenu = () => {
      const logoTop = logoLink && isShown(logoLink) ? box(logoLink).top : -Infinity;
      const menuItem = (a) => isShown(a) && text(a) && text(a).length <= 40
        && !(logoLink && (a === logoLink || a.contains(logoLink) || logoLink.contains(a)))
        // By the link's centre: a menu of full-height buttons starts above the logo (measured 28-09-2026:
        // 80px buttons from y=46, the logo from y=62), and every one was dropped by its top.
        && !(topbarEl && topbarEl.contains(a)) && (box(a).top + box(a).bottom) / 2 >= logoTop - 10
        && !((parseColour(getComputedStyle(a).backgroundColor) || { a: 0 }).a > 0)
        && !(q('svg, img', a) && (nameOf(a) !== 'other' || text(a).length <= 2));
      // A visible <nav> first — even of one link — and of several, the TOP-MOST, not the fullest.
      const navs = (headerEl.tagName === 'NAV' ? [headerEl] : qa('nav', headerEl))
        .map((n) => qa('a', n).filter(menuItem)).filter((links) => links.length)
        .sort((x, y) => Math.min(...x.map((a) => box(a).top)) - Math.min(...y.map((a) => box(a).top)));
      if (navs.length) return navs[0].sort((a, b) => startGap(a) - startGap(b));
      // No usable <nav>: the first row of at least three menu links, wherever they sit.
      const items = qa('a', headerEl).filter(menuItem);
      const lines = [];
      for (const a of items) {
        const c = (box(a).top + box(a).bottom) / 2;
        let line = lines.find((l) => Math.abs(l.c - c) <= 12);
        if (!line) lines.push(line = { c, links: [] });
        line.links.push(a);
      }
      const row = lines.filter((l) => l.links.length >= 3).sort((x, y) => x.c - y.c)[0];
      return row ? row.links.sort((a, b) => startGap(a) - startGap(b)) : [];
    };
    const referenceLinks = pluginStore ? [] : referenceMenu();
    const commonAncestor = (els) => {
      let c = els[0] ? els[0].parentElement : null;
      while (c && !els.every((e) => c.contains(e))) c = c.parentElement;
      return c && c !== headerEl ? c : null;
    };
    const navEl = pluginStore ? q('nav.main-nav', headerEl) : commonAncestor(referenceLinks);
    const navAll = pluginStore ? (navEl ? qa('li:not(.cl_hidden_flexnav) > a', navEl) : []) : referenceLinks;
    const navLinks = navAll.filter((a) => isShown(a) && text(a));
    // Folded away at this width by the page's own CSS (`display: none`, e.g. a store that hides its menu
    // on phones): the menu shows NO links here, exactly as a reference's folded menu counts zero. Only a
    // menu that is merely not revealed yet by its script stays unmeasurable. Before 26-09-2026 both read
    // as unmeasurable, so a phone spec needed its nav rows written by hand.
    const foldedByCss = (el) => {
      for (let a = el; a && a !== document.body; a = a.parentElement) if (getComputedStyle(a).display === 'none') return true;
      return false;
    };
    const navHidden = pluginStore && navAll.length > 0 && navLinks.length === 0 && !q('.cl-nav-ready', headerEl) && !foldedByCss(navEl);
    const hiddenWhy = `the menu has ${navAll.length} link(s) in the markup but none is visible — if the page shows them, it was measured before its script revealed them: let the page settle in a visible tab and run again`;

    const navText = navLinks.length ? textDown(navLinks[0]) : null;
    const logoText = logoLink ? textDown(logoLink) : null;
    if (navText) {
      pair('header.background', 'header.nav_color', navText);
    } else {
      // No nav text to pair with: the background alone, walked up from the wordmark or the logo. A
      // wordmark still checks the pair's contrast; its colour is never written as the NAV colour.
      const from = logoText || ((logoLink && isShown(logoLink)) ? logoLink : headerEl);
      const bg = paintUp(from);
      const fg = logoText ? parseColour(getComputedStyle(logoText).color) : null;
      if (bg.image) {
        unmeasurable('header.background', `the backdrop is an image or a gradient on ${describe(bg.image)}`, { traversal: 'paint-up' });
      } else if (fg && contrast(fg, bg.colour) <= 1.5) {
        unmeasurable('header.background', `the wordmark ${colourString(fg)} on ${colourString(bg.colour)} is unreadable, so the background came off the wrong element — measure it by hand`, { traversal: 'paint-up' });
      } else {
        add('header.background', colourString(bg.colour), Object.assign({ traversal: 'paint-up' }, gradientNote(bg)));
      }
      if (navHidden) unmeasurable('header.nav_color', hiddenWhy, { traversal: 'text-down', pair_with: 'header.background' });
      else add('header.nav_color', null);
    }
    // The line along the header's bottom edge: on the header, on a wrapper around it, or on a row
    // inside it — anything ending where the header ends and spanning at least half its width.
    const hb = box(headerEl);
    const around = [];
    for (let el = headerEl.parentElement; el && el !== document.body; el = el.parentElement) around.push(el);
    const line = [...around, headerEl, ...qa('*', headerEl)].filter((el) => {
      const r = box(el);
      return Math.abs(r.bottom - hb.bottom) <= 2 && r.width >= hb.width * 0.5 && borderBottomOf(el) !== 'none' && isShown(el);
    }).sort((a, b) => box(b).width - box(a).width)[0];
    add('header.border_bottom', line ? borderBottomOf(line) : 'none');

    if (logoLink && isShown(logoLink)) {
      const img = q('img, svg', logoLink);
      add('header.logo_present', true);
      add('header.logo_kind', img && isShown(img) ? 'image' : 'wordmark');
      px('header.logo_width', box(img && isShown(img) ? img : (logoText || logoLink)).width);
      px('header.gutter_left', startGap(logoLink));
    } else {
      add('header.logo_present', false);
      absent(['header.logo_kind', 'header.logo_width']);
      const first = textDown(headerEl);
      if (first) px('header.gutter_left', startGap(first)); else unmeasurable('header.gutter_left', 'no logo and no visible text in the header');
    }

    const navFontIds = ['header.nav_font_size', 'header.nav_font_weight', 'header.nav_text_transform'];
    if (navHidden) {
      ['header.nav_items', 'header.nav_labels', ...navFontIds].forEach((id) => unmeasurable(id, hiddenWhy));
    } else {
      add('header.nav_items', navLinks.length);
      add('header.nav_labels', navLinks.map(text));
      if (navText) fontRows('header.nav_', navText, ['font_size', 'font_weight', 'text_transform']);
      else absent(navFontIds);
    }

    // Icon controls after the nav in reading order — to its right, or to its left on a right-to-left
    // page — named by what they say they are. With no nav link showing (a phone folds the menu into a
    // toggle), the nav's own edge, or the logo's, is where they start. A header in TWO ROWS (logo and
    // icons above, the menu alone below) keeps its icons by ROW: on the logo's row, after the logo.
    // Measured 28-09-2026: a two-row header lost all five icons to the one-row rule.
    const endGap = (el) => (rtl ? W - box(el).left : box(el).right);
    const navEnd = navLinks.length ? Math.max(...navLinks.map(endGap))
      : (navEl && isShown(navEl) && navEl !== headerEl) ? endGap(navEl)
        : (logoLink && isShown(logoLink)) ? endGap(logoLink) : startGap(headerEl);
    const sameRow = (el, ref) => {
      const a = box(el), b = box(ref);
      return Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) >= Math.min(a.height, b.height) * 0.5;
    };
    const logoShown = logoLink && isShown(logoLink);
    const logoRowApart = logoShown && navLinks.length > 0 && !navLinks.some((n) => sameRow(n, logoLink));
    const trailing = (el) => (navLinks.length && navLinks.some((n) => sameRow(el, n)) && startGap(el) >= navEnd - 2)
      || (logoRowApart && sameRow(el, logoLink) && startGap(el) >= endGap(logoLink) - 2)
      || (!navLinks.length && startGap(el) >= navEnd - 2);
    // An icon control may carry a short label or a count ("Cart 2"); a plain text link has no icon. The
    // icon may be an icon font (<i class="icon-heart">), and the control a block that opens a menu on
    // hover with no link of its own — kept when its id or class names what it is ("user-menu-account").
    const ICON = 'svg, img, i, [class*="icon"]';
    const CONTROL = ['search', 'cart', 'account', 'wishlist'];
    const hoverControls = qa('div, span, li', headerEl).filter((el) => CONTROL.includes(kindOf(`${el.id} ${el.className}`)) && box(el).width <= 200 && box(el).height <= 80
      && !qa('a, button', el).some(isShown));
    // The label counted is the one a visitor sees: a screen-reader label (a 1px box) can hold anything
    // (measured 28-09-2026: "inline-block ml-1 no-underline … Cart", 62 characters, dropped the cart).
    const seenText = (el) => {
      const parts = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) if (box(n.parentElement).width > 1 && box(n.parentElement).height > 1) parts.push(n.nodeValue);
      return parts.join(' ').replace(/\s+/g, ' ').trim();
    };
    const icons = [...qa('a, button, [role="button"]', headerEl), ...hoverControls].filter((el) => isShown(el) && q(ICON, el) && seenText(el).length <= 20
      && trailing(el) && !(logoLink && (el === logoLink || logoLink.contains(el))) && !navLinks.includes(el)
      // On a reference the menu's block may also hold the icons (one flex row): only its links are menu.
      && !(pluginStore && navEl && navEl !== headerEl && navEl.contains(el)))
      .filter((el, i, all) => !all.some((o) => o !== el && o.contains(el)))
      .sort((a, b) => startGap(a) - startGap(b));
    add('header.trailing_icons', icons.map(nameOf));

    // Sticky means it is still at the top after a scroll. position: sticky only holds inside its own
    // container — a header sticky within a hero leaves with the hero — so that one is tried: scroll
    // down, look, scroll back.
    let sticky = pluginStore && headerEl.classList.contains('cl_can_be_sticky');
    for (let el = headerEl; el && el !== document.body && !sticky; el = el.parentElement) {
      const p = getComputedStyle(el).position;
      if (p === 'fixed') sticky = true;
      if (p === 'sticky') {
        window.scrollTo(0, Math.min(H * 2, document.documentElement.scrollHeight - H));
        sticky = window.scrollY > 0 && box(headerEl).bottom > 0 && box(headerEl).top < H / 3;
        window.scrollTo(0, 0);
        break;
      }
    }
    add('header.sticky', sticky);
  });

  // ── footer ────────────────────────────────────────────────────────────────────────────────────
  const footerIds = ['footer.background', 'footer.text_color', 'footer.height', 'footer.columns', 'footer.column_headings',
    'footer.links_per_column', 'footer.brand_block', 'footer.social_icons', 'footer.bottom_bar', 'footer.bottom_bar_links',
    'footer.gutter_left', 'footer.bottom_bar_gutter_left'];
  section(footerIds, () => {
    if (!footerEl || !isShown(footerEl)) {
      footerIds.forEach((id) => unmeasurable(id, pluginStore ? 'the store renders no plugin footer on this page' : 'no <footer> or [role="contentinfo"] on the page'));
      return;
    }
    // The bottom bar: the plugin's socket, or the row holding the copyright line.
    let bar = pluginStore ? q('.cl-footer-socket', footerEl) : null;
    if (!pluginStore) {
      const copy = qa('*', footerEl).filter((el) => isShown(el) && el.children.length <= 3 && /©|copyright|all rights reserved|tous droits|derechos|جميع الحقوق/i.test(text(el)))
        .sort((a, b) => text(a).length - text(b).length)[0];
      // The bar is a STRIP: at least 60% of the footer's width and a small part of its height. The height
      // cap is relative — a fixed 140px failed on a phone-width window, where the © line and five legal
      // links wrap into a 173px block and the climb stopped at the © line alone, leaving the links to be
      // read as a fifth column (measured 26-09-2026, fassiano.com at 390 with a scrollbar).
      const barMax = Math.max(140, box(footerEl).height * 0.35);
      for (let el = copy; el && el !== footerEl; el = el.parentElement) {
        if (box(el).width >= box(footerEl).width * 0.6 && box(el).height <= barMax) { bar = el; } else if (bar) { break; }
      }
    }
    const inBar = (el) => !!(bar && bar.contains(el));

    const mainText = textDown(pluginStore ? (q('.cl-footer-main', footerEl) || footerEl) : footerEl, true);
    pair('footer.background', 'footer.text_color', mainText && !inBar(mainText) ? mainText : textDown(footerEl, true));
    px('footer.height', box(footerEl).height, 8);

    // A social ICON: small, and pointing at a network. A text link to WhatsApp ("Contact us") is a link.
    const isSocial = (a) => (SOCIAL.test(a.href || '') || !!a.closest('.cl-footer-social-links')) && box(a).width <= 64 && box(a).height <= 64;
    // A column title is short: a heading tag holding a sentence ("Find out first. Get our emails…") is a
    // newsletter or legal note, not a column (measured 28-09-2026).
    let headings = qa(pluginStore ? '.footer-menu-title, .contact-info-title' : 'h2, h3, h4, h5, h6, [role="heading"]', footerEl)
      .filter((h) => isShown(h) && text(h) && !inBar(h) && (pluginStore || text(h).length <= 40));
    if (!pluginStore && !headings.length) {
      // No heading tags (page builders often use none): a column's title is the short first text of a
      // block holding two or more links, when that text is not itself a link.
      headings = qa('*', footerEl).filter((p) => isShown(p) && !inBar(p) && qa('a', p).filter(isShown).length >= 2).map(textDown)
        .filter((t, i, all) => t && all.indexOf(t) === i && !t.closest('a') && !q('a', t) && text(t).length <= 40);
    }
    // A heading's column: the widest ancestor that holds its links but no other heading.
    const columnOf = (h) => {
      let col = h;
      for (let el = h.parentElement; el && el !== footerEl; el = el.parentElement) {
        if (headings.some((o) => o !== h && el.contains(o))) break;
        col = el;
      }
      return col;
    };
    // Outside the bottom bar: a legal-bar image link can point at the home page too (measured: "Customer
    // Rights", linking to the store's locale root).
    const brand = pluginStore ? q('.footer-brand-col', footerEl) : (qa('a', footerEl).find((a) => isShown(a) && isHomeLink(a) && q('img, svg', a) && !inBar(a)) || null);
    const brandBlock = brand && isShown(brand) && !headings.some((h) => columnOf(h).contains(brand)) ? columnOf(brand) : null;
    add('footer.brand_block', !!brandBlock);

    if (!headings.length && !brandBlock) {
      ['footer.columns', 'footer.column_headings', 'footer.links_per_column'].forEach((id) =>
        unmeasurable(id, 'no column titles found in the footer (looked for h2–h6, role="heading", and a short title above two or more links) — count the columns by hand'));
    } else {
      const cols = headings.map((h) => ({ el: columnOf(h), heading: text(h) }));
      if (brandBlock) cols.push({ el: brandBlock, heading: null });
      cols.sort((a, b) => (box(a.el).left - box(b.el).left) || (box(a.el).top - box(b.el).top));
      add('footer.columns', cols.length);
      add('footer.column_headings', cols.filter((c) => c.heading !== null).map((c) => c.heading));
      add('footer.links_per_column', cols.map((c) => qa('a', c.el).filter((a) => isShown(a) && text(a) && !isSocial(a) && !isHomeLink(a)).length));
    }

    add('footer.social_icons', qa('a', footerEl).filter((a) => isShown(a) && isSocial(a)).length);
    add('footer.bottom_bar', !!(bar && isShown(bar)));
    if (bar && isShown(bar)) {
      add('footer.bottom_bar_links', qa('a', bar).filter((a) => isShown(a) && text(a) && !isSocial(a)).length);
      const barText = textDown(bar);
      if (barText) px('footer.bottom_bar_gutter_left', startGap(barText)); else unmeasurable('footer.bottom_bar_gutter_left', 'no visible text in the bottom bar');
    } else {
      absent(['footer.bottom_bar_links', 'footer.bottom_bar_gutter_left']);
    }
    if (mainText && !inBar(mainText)) px('footer.gutter_left', startGap(mainText)); else unmeasurable('footer.gutter_left', 'no visible text above the bottom bar');
  });

  // ── page ──────────────────────────────────────────────────────────────────────────────────────
  const pageIds = ['page.background', 'page.max_width', 'page.gutter'];
  section(pageIds, () => {
    const main = qa('main, [role="main"], #main, .site-main, #content, .site-content').find(isShown) || document.body;
    const bg = paintUp(main);
    if (bg.image) unmeasurable('page.background', `the page backdrop is an image or a gradient on ${describe(bg.image)}`, { traversal: 'paint-up' });
    else add('page.background', colourString(bg.colour), { traversal: 'paint-up' });

    // Every section of the page votes once: the outermost block around its first left-aligned text
    // that does not run edge to edge. The text sits at the padding edge of the innermost element there
    // sharing the section's box, and the section has a max width when a px cap holds it back — a plain
    // max-width, or the px term of a builder's min(100%, 1140px). The page's gutter and max width are
    // what most sections agree on, a tie going to the one higher up: one hero or one padded story
    // block does not speak for the page. A centred title says nothing about the gutter, so it has no vote.
    const chrome = (el) => [headerEl, footerEl, topbarEl].some((c) => c && c.contains(el));
    const edgeToEdge = (el) => box(el).left <= 1 && box(el).right >= W - 1;
    const heldBack = (el) => {
      const cs = getComputedStyle(el);
      const edges = cs.boxSizing === 'border-box' ? 0
        : parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
      return (cs.maxWidth.match(/[\d.]+px/g) || []).some((cap) => Math.abs(box(el).width - edges - parseFloat(cap)) <= 1);
    };
    const votes = new Map();
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.nodeValue.trim().length > 1 && isShown(n.parentElement) && !chrome(n.parentElement)
        && box(n.parentElement).left >= 0 && box(n.parentElement).right <= W
        && !['center', '-webkit-center'].includes(getComputedStyle(n.parentElement).textAlign)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP,
    });
    // One ballot: the text sits at the padding edge of the innermost element on its chain sharing the
    // section's box; the section's width counts when a px cap holds any of those back.
    const ballot = (sectionEl, chain) => {
      const s = box(sectionEl);
      const same = chain.filter((a) => Math.abs(box(a).left - s.left) <= 1 && Math.abs(box(a).right - s.right) <= 1);
      const cs = getComputedStyle(same[0]);
      const edge = rtl ? W - (box(same[0]).right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight))
        : box(same[0]).left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft);
      const held = same.find(heldBack);
      return { gutter: round(edge), width: held ? round(box(held).width) : null };
    };
    // Neither votes: text laid ON something (a caption on a hero image, in an absolutely positioned
    // layer), nor one card of a ROW of three or more side by side (a slider, a card grid) — a row's first
    // card starts wherever the row starts. Measured 28-09-2026: a slider flush with the window's edge,
    // each 394px slide voting as a section, gave the page a 394px width and a 0 gutter.
    const layered = (chain) => chain.some((a) => ['absolute', 'fixed'].includes(getComputedStyle(a).position));
    const inCardRow = (el) => {
      const r = box(el);
      if (!el.parentElement) return false;
      return Array.from(el.parentElement.children).filter((s) => {
        if (s === el || !isShown(s)) return false;
        const o = box(s);
        return Math.min(o.bottom, r.bottom) - Math.max(o.top, r.top) >= Math.min(o.height, r.height) * 0.5
          && (o.left >= r.right - 1 || o.right <= r.left + 1);
      }).length >= 2;
    };
    // The chain starts at the text's BLOCK: an inline link or <strong> starts wherever the line puts it
    // (measured 28-09-2026: a link mid-sentence voted a 920px gutter). A block that itself runs edge to
    // edge, its text held in by a left padding, votes that padding as a gutter and no width.
    const flat = (el) => ['inline', 'contents'].includes(getComputedStyle(el).display);
    const padStart = (el) => parseFloat(getComputedStyle(el)[rtl ? 'paddingRight' : 'paddingLeft']);
    const texts = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      let block = n.parentElement;
      while (block && block !== main && flat(block)) block = block.parentElement;
      const chain = [];
      for (let a = block; a && main.contains(a) && !edgeToEdge(a); a = a.parentElement) chain.push(a);
      const padded = !chain.length && block && padStart(block) > 0;
      if (padded) chain.push(block);
      const sectionEl = chain[chain.length - 1];
      if (!sectionEl || layered(chain) || inCardRow(sectionEl)) continue;
      const full = [];
      for (let a = n.parentElement; a && a !== sectionEl.parentElement; a = a.parentElement) full.push(a);
      texts.push({ n, chain: full });
      if (!votes.has(sectionEl)) votes.set(sectionEl, padded ? { gutter: ballot(sectionEl, chain).gutter, width: undefined } : ballot(sectionEl, chain));
    }
    // ONE WRAPPER HOLDING THE WHOLE PAGE — a boxed layout, where no section runs edge to edge — gives one
    // ballot for the page, so "what most sections agree on" silently became "the wrapper". Found by
    // structure, not by a class name: walk down through elements with a single child holding text to
    // the first with several, and let each of those children vote. The wrapper stays on each chain, so
    // a px cap on it still counts as the page's max width. Measured 26-09-2026: a plugin store's home
    // page, ten sections voting as one.
    if (votes.size === 1 && texts.length > 1 && [...votes.values()][0].width !== undefined) {
      let fork = [...votes.keys()][0];
      const childHolding = (parent, el) => { let c = el; while (c && c.parentElement !== parent) c = c.parentElement; return c; };
      for (;;) {
        const kids = new Set(texts.map((t) => childHolding(fork, t.n.parentElement)).filter(Boolean));
        if (kids.size !== 1) break;
        fork = [...kids][0];
      }
      const split = new Map();
      for (const t of texts) {
        const child = childHolding(fork, t.n.parentElement);
        if (child && !split.has(child)) split.set(child, ballot(child, t.chain));
      }
      if (split.size > 1) { votes.clear(); split.forEach((v, k) => votes.set(k, v)); }
    }
    const mostCommon = (values) => {
      const count = new Map();
      values.forEach((v) => count.set(v, (count.get(v) || 0) + 1));
      let best;
      for (const [v, c] of count) if (best === undefined || c > count.get(best)) best = v;
      return best;
    };
    const ballots = Array.from(votes.values());
    const widths = ballots.map((v) => v.width).filter((w) => w !== undefined);
    const maxWidth = widths.length ? mostCommon(widths) : null;
    if (maxWidth !== null) px('page.max_width', maxWidth, 8); else add('page.max_width', null);
    const gutter = ballots.length ? mostCommon(ballots.map((v) => v.gutter)) : null;
    if (gutter !== null) px('page.gutter', gutter); else unmeasurable('page.gutter', 'no left-aligned text in the main area');
  });

  // ── reviews and the product card: read on a plugin store only ─────────────────────────────────
  const reviewIds = ['reviews.card_background', 'reviews.text_color', 'reviews.card_border', 'reviews.card_padding', 'reviews.avatar_kind',
    'reviews.text_lines', 'reviews.name_font_family', 'reviews.name_font_size', 'reviews.name_font_style', 'reviews.badge_present', 'reviews.date_kind'];
  const cardIds = ['plist1.card_bottom_row', 'plist1.button_kind', 'plist1.badge_position', 'plist1.columns', 'plist1.card_ratio'];
  const byHand = 'every theme builds this differently, so it is read on a store built with the plugin only — measure it by hand on the reference';

  section(reviewIds, () => {
    if (!pluginStore) { reviewIds.forEach((id) => unmeasurable(id, byHand)); return; }
    const cards = qa('.reviewlist .cl_item').filter(isShown);
    if (!cards.length) {
      // No list at all is no surface; a list showing no cards yet was measured before it loaded.
      if (q('.reviewlist')) reviewIds.forEach((id) => unmeasurable(id, 'the reviews list is on the page but shows no cards yet — let the page settle and run again'));
      else absent(reviewIds);
      return;
    }
    const card = cards[0];
    pair('reviews.card_background', 'reviews.text_color', textDown(q('.cl-review-text', card) || card));
    add('reviews.card_border', borderOf(card));
    px('reviews.card_padding', parseFloat(getComputedStyle(card).paddingLeft), 2);
    const avatar = q('.cl-review-avatar', card);
    const img = q('img', avatar);
    add('reviews.avatar_kind', !avatar || !isShown(avatar) ? 'none'
      : img ? (img.classList.contains('avatar-default') ? 'placeholder' : 'photo')
        : (/^\S{1,3}$/.test(text(avatar)) ? 'initials' : 'none'));
    const reviewText = q('.cl-review-text', card);
    const clamp = reviewText ? getComputedStyle(reviewText).webkitLineClamp : 'none';
    add('reviews.text_lines', reviewText ? (parseInt(clamp, 10) || 0) : null);
    const name = q('.cl-review-reviewer-name', card);
    const nameText = name ? textDown(name) || name : null;
    if (nameText) {
      const cs = getComputedStyle(nameText);
      add('reviews.name_font_family', cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(), { traversal: 'text-down' });
      add('reviews.name_font_size', round(parseFloat(cs.fontSize)), { unit: 'px', tolerance: 1, traversal: 'text-down' });
      add('reviews.name_font_style', cs.fontStyle, { traversal: 'text-down' });
    } else {
      absent(['reviews.name_font_family', 'reviews.name_font_size', 'reviews.name_font_style']);
    }
    // The badge shows on verified reviews only, so any card carrying one means the design shows it.
    add('reviews.badge_present', qa('.cl-review-verified-badge').some(isShown));
    const date = q('.cl-review-date', card);
    const d = text(date);
    add('reviews.date_kind', !date || !isShown(date) || !d ? 'none'
      : (/\b(1[89]|20)\d{2}\b|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|janv|févr|mars|avr|mai|juin|juil|août|sept|oct|nov|déc/i.test(d) ? 'absolute' : 'relative'));
  });

  section(cardIds, () => {
    if (!pluginStore) { cardIds.forEach((id) => unmeasurable(id, byHand)); return; }
    const cards = qa('.plist1 .cl_product').filter(isShown);
    if (!cards.length) {
      if (q('.plist1')) cardIds.forEach((id) => unmeasurable(id, 'the product list is on the page but shows no cards yet — let the page settle and run again'));
      else absent(cardIds);
      return;
    }
    const card = cards[0];
    const NAMES = { image: 'image', title: 'title', prices: 'price', buttons: 'button' };
    const blocks = qa('[cl-block]', card).filter((el) => isShown(el) && el.parentElement.closest('[cl-block]') === card);
    if (blocks.length) {
      const lowest = blocks.reduce((a, b) => (box(b).bottom > box(a).bottom ? b : a));
      const lb = box(lowest);
      const row = blocks.filter((el) => { const r = box(el); const mid = (r.top + r.bottom) / 2; return mid >= lb.top && mid <= lb.bottom; })
        .sort((a, b) => box(a).left - box(b).left);
      add('plist1.card_bottom_row', row.map((el) => NAMES[el.getAttribute('cl-block')] || el.getAttribute('cl-block')).join('+'));
    } else {
      unmeasurable('plist1.card_bottom_row', 'the card holds no visible blocks');
    }
    const button = qa('.cl_actions a, .cl_actions button', card).find(isShown);
    add('plist1.button_kind', !button ? 'none' : (text(button) ? 'text' : (q('svg, img, .cl-icon', button) ? 'icon' : 'none')));
    const badge = qa('.product_discount', card).find(isShown) || qa('.plist1 .product_discount').find(isShown);
    const image = q('.cl_image', badge ? badge.closest('.cl_product') : card);
    if (!badge) {
      add('plist1.badge_position', 'none');
    } else {
      const b = box(badge);
      const i = image ? box(image) : null;
      add('plist1.badge_position', i && b.left >= i.left && b.right <= i.right && b.top >= i.top && b.bottom <= i.bottom ? 'image' : 'inline');
    }
    // Cards a visitor sees side by side: same row as the first, and centred inside the list's
    // visible box — a carousel keeps the rest of its cards on that row, scrolled out of view.
    const firstTop = box(card).top;
    const list = card.closest('.cl_list') || card.parentElement;
    const view = box(list);
    add('plist1.columns', qa('.cl_product', list).filter((c) => {
      const r = box(c);
      const mid = (r.left + r.right) / 2;
      return isShown(c) && Math.abs(r.top - firstTop) <= 4 && mid >= Math.max(view.left, 0) && mid <= Math.min(view.right, W);
    }).length);
    const photo = q('.cl_image img', card);
    if (photo && isShown(photo) && box(photo).height) add('plist1.card_ratio', Math.round((box(photo).width / box(photo).height) * 100) / 100, { tolerance: 0.02 });
    else unmeasurable('plist1.card_ratio', 'the first card has no visible image');
  });

  // ── the product page: read on a product page only, on both passes ─────────────────────────────
  // Added 26-09-2026: these rows were written by hand on every build that had a reference, because
  // nothing measured them. On a plugin store the gallery and title are read through their own markup;
  // on a reference, through geometry — the largest image near the top, and the page's <h1>.
  const productIds = ['product.gallery_ratio', 'product.gallery_width', 'product.title_font_size', 'typography.product_title_family',
    'product.info_position', 'product.thumbs_position', 'product.gallery_background'];
  section(productIds, () => {
    const ldProduct = qa('script[type="application/ld+json"]').some((s) => /"@type"\s*:\s*\[?\s*"Product"/.test(s.textContent));
    const ogType = (q('meta[property="og:type"]') || { content: '' }).content;
    // A reference built with a page builder often declares nothing (measured: fassiano.com's product
    // pages are plain Elementor pages, og:type "article"), so the agent can say it: CL_MEASURE_PAGE.
    const isProduct = window.CL_MEASURE_PAGE === 'product' || (pluginStore ? !!q('.cl-product-page')
      : ldProduct || /\bsingle-product\b/.test(document.body.className) || /product/i.test(ogType || ''));
    if (!isProduct) { absent(productIds); return; }
    const inChrome = (el) => [headerEl, footerEl, topbarEl].some((c) => c && c.contains(el));
    const area = (el) => box(el).width * box(el).height;
    const title = pluginStore ? q('.cl-product-page .cl-product-title') : qa('h1').find((h) => isShown(h) && !inChrome(h));
    const gallery = pluginStore ? q('.cl-product-page #cl_gallery, .cl-product-page .cl_gallery') : null;
    // Only images mostly ON SCREEN: a carousel parks its other slides beside the window, "visible" to the
    // DOM. Measured 28-09-2026: four 708px slides at x = -622, 86, 794, 1502, and an off-screen one won.
    // Seen means inside the window AND inside every clipping box around it: in a wider window the next
    // slide is on screen but hidden by the carousel's overflow, and would pass for a second photo.
    const onScreen = (el) => {
      const r = box(el);
      if (!r.width) return false;
      let left = Math.max(r.left, 0), right = Math.min(r.right, W);
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        if (getComputedStyle(a).overflowX !== 'visible') { left = Math.max(left, box(a).left); right = Math.min(right, box(a).right); }
      }
      return right - left >= r.width * 0.9;
    };
    const candidates = pluginStore ? [] : qa('img').filter((i) => isShown(i) && onScreen(i) && !inChrome(i)
      && box(i).top + window.scrollY < H * 2 && box(i).width >= 120);
    const main = pluginStore
      ? (qa('.cl-gallery-slide.active img', gallery).find(isShown) || qa('img', gallery).filter(isShown).sort((a, b) => area(b) - area(a))[0])
      : candidates.sort((a, b) => area(b) - area(a))[0];
    // A PHOTO GRID (2×2 tiles…): other images the size of the largest one, next to it. The gallery is then
    // their smallest common block, and it has no thumbnails. Measured: a 2×2 grid of 272px tiles, which the
    // old "a quarter of the page wide" floor turned into "no product image found".
    const peers = pluginStore || !main ? [] : candidates.filter((i) => i !== main
      && Math.abs(box(i).width - box(main).width) <= 4 && Math.abs(box(i).height - box(main).height) <= 4
      && Math.abs(box(i).left - box(main).left) <= box(main).width * 2 && Math.abs(box(i).top - box(main).top) <= box(main).height * 2);
    let grid = null;
    if (peers.length) {
      grid = main.parentElement;
      while (grid && !peers.every((p) => grid.contains(p))) grid = grid.parentElement;
    }
    if (!main) {
      ['product.gallery_ratio', 'product.gallery_width', 'product.info_position', 'product.thumbs_position', 'product.gallery_background']
        .forEach((id) => unmeasurable(id, 'no product image found near the top of the page'));
    } else {
      const m = box(main);
      // From the image ITSELF: a transparent product photo shows the <img> element's own background
      // (measured: a plugin store paints it on the img, a reference on a panel around it).
      const bg = paintUp(main);
      // The gallery's width is the PANEL the photo sits in — the box painting the background behind it —
      // when that panel frames the photo (up to 1.6× its width); otherwise the photo itself. A framed
      // gallery reads the frame on both passes; a bare photo reads the photo.
      const panel = bg.painter && bg.painter.contains(main) && box(bg.painter).width <= m.width * 1.6 ? bg.painter : main;
      if (grid) add('product.gallery_width', round(box(grid).width), { unit: 'px', tolerance: 4, note: `a photo grid of ${peers.length + 1} images: the grid's width` });
      else px('product.gallery_width', box(panel).width);
      add('product.gallery_ratio', Math.round((m.width / m.height) * 100) / 100, { tolerance: 0.02 });
      if (bg.image) unmeasurable('product.gallery_background', `the image sits on an image or a picture background (${describe(bg.image)})`, { traversal: 'paint-up' });
      else add('product.gallery_background', colourString(bg.colour), Object.assign({ traversal: 'paint-up' }, gradientNote(bg)));
      // The gallery as a whole: the grid when there is one, else the main photo.
      const g = grid ? box(grid) : m;
      // Where the title sits against the gallery: side by side (right / left) only when the two SHARE rows,
      // otherwise below / above. Measured: a title ABOVE the photo, read as "left" because its right edge
      // came before the photo's left.
      if (title && isShown(title)) {
        const t = box(title);
        const shareRows = Math.min(t.bottom, g.bottom) - Math.max(t.top, g.top) > 0;
        const side = (t.left + t.right) / 2 >= (g.left + g.right) / 2 ? 'right' : 'left';
        add('product.info_position', shareRows ? (rtl ? { right: 'left', left: 'right' }[side] : side)
          : t.top >= g.bottom - 4 ? 'below' : 'above');
      } else {
        unmeasurable('product.info_position', 'no visible product title');
      }
      // Thumbnails: the other, smaller images of the gallery — on screen, and the largest set of ONE size
      // (the strip), so a badge or a brand mark near the photo never joins them. Their side is where their
      // centre lies against the photo's. Measured: a left column of 68px thumbnails read as "top" because a
      // share logo on the right was counted with them. On a reference, within one image-width of the main
      // photo and not the title's block; a single stray image is not a strip.
      let thumbs = [];
      if (!grid) {
        const near = (pluginStore ? qa('img', gallery) : qa('img').filter((i) => {
          const r = box(i);
          return !inChrome(i) && r.left >= m.left - m.width && r.right <= m.right + m.width
            && r.top >= m.top - m.height && r.bottom <= m.bottom + m.height && !(title && title.parentElement && title.parentElement.contains(i));
        })).filter((i) => i !== main && isShown(i) && onScreen(i) && box(i).width <= m.width * 0.4
          // A thumbnail is a photo one can recognise: 40px or more. Around a large photo, the page's own
          // icons (quantity buttons, badges, 12–32px) outnumbered three 65px thumbnails (measured 28-09-2026).
          && (pluginStore || (box(i).width >= 40 && box(i).height >= 40)));
        const sets = [];
        for (const i of near) {
          const r = box(i);
          let s = sets.find((x) => Math.abs(x.w - r.width) <= 3 && Math.abs(x.h - r.height) <= 3);
          if (!s) sets.push(s = { w: r.width, h: r.height, imgs: [] });
          s.imgs.push(i);
        }
        const strip = sets.sort((a, b) => b.imgs.length - a.imgs.length)[0];
        thumbs = strip && (pluginStore || strip.imgs.length >= 2) ? strip.imgs : [];
      }
      if (!thumbs.length) {
        add('product.thumbs_position', 'none');
      } else {
        const cx = thumbs.reduce((s, i) => s + (box(i).left + box(i).right) / 2, 0) / thumbs.length;
        const cy = thumbs.reduce((s, i) => s + (box(i).top + box(i).bottom) / 2, 0) / thumbs.length;
        const dx = cx - (m.left + m.right) / 2;
        const dy = cy - (m.top + m.bottom) / 2;
        add('product.thumbs_position', Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy > 0 ? 'bottom' : 'top'));
      }
    }
    if (title && isShown(title)) {
      const tt = textDown(title) || title;
      const cs = getComputedStyle(tt);
      px('product.title_font_size', parseFloat(cs.fontSize), 1);
      add('typography.product_title_family', cs.fontFamily.split(',')[0].replace(/["']/g, '').trim().toLowerCase(), { traversal: 'text-down' });
    } else {
      unmeasurable('product.title_font_size', 'no visible product title');
      unmeasurable('typography.product_title_family', 'no visible product title');
    }
  });

  // ── the spec ──────────────────────────────────────────────────────────────────────────────────
  const spec = {
    source: location.href,
    captured_at: today,
    viewport: { width: VW, height: H },
    measured_with: 'browser',
    properties: rows,
  };
  const left = rows.filter((r) => r.reason && r.reason.kind === 'unmeasurable').map((r) => r.id);
  const standard = (VW === 1440 && H === 900) || (VW === 390 && H === 844);
  console.log(JSON.stringify(spec, null, 2));
  console.info(`measure.js: ${rows.length} rows on a ${pluginStore ? 'plugin store' : 'reference'} at ${VW}×${H}.`
    + (standard ? '' : ' The checklist is measured at 1440×900 and 390×844 — resize and run again.')
    + (left.length ? `\nMeasure these by hand and replace them: ${left.join(', ')}` : ''));
  return spec;
})();

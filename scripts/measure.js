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
 * WHAT IT GUARANTEES
 * - The measuring rules are built in. A background walks UP from the visible text to the first
 *   painted ancestor, and an image or a gradient on the way makes the row unmeasurable. A text row
 *   reads the deepest element holding visible text. Colours come in pairs, and a pair at contrast
 *   1.5 or below is refused on both rows, because it proves one of them came off the wrong element.
 * - A store built with the plugin is read through its own containers and classes. A reference site
 *   is read through <header>, <footer>, <nav>, links to the home page, and page geometry.
 * - A row it cannot resolve with confidence comes back as `"value": null` with
 *   `"reason": { "kind": "unmeasurable" }` and what it tried. match.mjs reports such a row and never
 *   passes it: measure that row by hand and replace it in the file.
 * - `"value": null` WITHOUT a reason means the page has no such surface (no topbar, no reviews).
 * - The review-card and product-card rows are read on a plugin store only. Every theme builds those
 *   differently, so on a reference they come back unmeasurable, for you to measure by hand.
 *
 * DEFINITIONS the checklist leaves open, fixed here so both passes agree:
 * - `footer.columns` counts column groups: one per heading, plus a brand block with no heading of
 *   its own. `footer.links_per_column` lists the text links in each, left to right.
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
 *   (`null` when none does — a phone, a fluid page). A centred title has no vote on either.
 *
 * No dependencies. It only reads the page: it scrolls to the top first, as a visitor lands, and scrolls
 * down and back once to see whether a sticky header stays.
 */
(() => {
  'use strict';

  const W = window.innerWidth;
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

  /** Rule 1, backgrounds: walk UP to the first opaque paint, blending any translucent layers. */
  const paintUp = (start) => {
    const layers = [];
    for (let el = start; el; el = el.parentElement) {
      const cs = getComputedStyle(el);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return { image: el };
      const c = parseColour(cs.backgroundColor);
      if (c && c.a > 0) {
        layers.push(c);
        if (c.a >= 0.99) break;
      }
    }
    // Nothing opaque below: the page canvas, which browsers paint white.
    const colour = layers.reverse().reduce((under, top) => ({
      r: top.r * top.a + under.r * (1 - top.a),
      g: top.g * top.a + under.g * (1 - top.a),
      b: top.b * top.a + under.b * (1 - top.a),
      a: 1,
    }), { r: 255, g: 255, b: 255, a: 1 });
    return { colour };
  };

  /** Rule 1, text: the deepest element holding visible text. */
  const textDown = (root) => {
    if (!root) return null;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.nodeValue.trim().length > 1 && isShown(n.parentElement)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP,
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

  const isHomeLink = (a) => {
    try {
      const u = new URL(a.href, location.href);
      return u.origin === location.origin && (u.pathname === '/' || u.pathname === '') && !u.hash;
    } catch (e) {
      return false;
    }
  };
  const SOCIAL = /(facebook|fb\.com|instagram|tiktok|twitter|x\.com|youtube|youtu\.be|pinterest|linkedin|snapchat|wa\.me|whatsapp|threads\.net|telegram|t\.me)/i;
  /** What a header control says it is — from its label, title, class, id or link. */
  const nameOf = (el) => {
    const s = [el.getAttribute('aria-label'), el.title, el.className, el.id, el.getAttribute('href'),
      el.getAttribute('data-open-cart') ? 'cart' : '', el.getAttribute('data-open-search') ? 'search' : ''].join(' ').toLowerCase();
    if (/search|recherche|chercher|بحث/.test(s)) return 'search';
    if (/cart|bag|basket|panier|sac|سلة/.test(s)) return 'cart';
    if (/account|user|login|profile|compte|connexion|حساب/.test(s)) return 'account';
    if (/wish|heart|favou?r|favori/.test(s)) return 'wishlist';
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
    add(bgId, colourString(bg.colour), { traversal: 'paint-up' });
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
  const headerEl = pluginStore
    ? (q('.cl-header-container header.cl-site-header') || q('.cl-header-container'))
    : qa('header, [role="banner"]').find(isShown) || bandAroundTopMenu();
  const footerEl = pluginStore
    ? (q('.cl-footer-container footer.cl-site-footer') || q('.cl-footer-container'))
    : qa('footer, [role="contentinfo"]').filter(isShown).pop() || null;

  const overlays = qa('body *').filter((el) => {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' || !isShown(el)) return false;
    if ((headerEl && (headerEl.contains(el) || el.contains(headerEl))) || el.closest('.cl-topbar-container')) return false;
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
    // The home link; failing that — a one-page site's logo links to its own top, #accueil — the first
    // header link holding an image that does not name itself as a control.
    const links = qa('a', headerEl || document.body).filter(isShown);
    return links.find(isHomeLink) || (headerEl && links.find((a) => q('img, svg', a) && nameOf(a) === 'other')) || null;
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
    const navEl = pluginStore
      ? q('nav.main-nav', headerEl)
      : (headerEl.tagName === 'NAV' ? headerEl : qa('nav', headerEl).sort((a, b) => qa('a', b).length - qa('a', a).length)[0]) || null;
    // A reference's <nav> can also hold the logo and a filled call-to-action button; the menu is neither.
    const navAll = !navEl ? []
      : pluginStore ? qa('li:not(.cl_hidden_flexnav) > a', navEl)
        : qa('a', navEl).filter((a) => !(logoLink && (a === logoLink || a.contains(logoLink)))
          && !((parseColour(getComputedStyle(a).backgroundColor) || { a: 0 }).a > 0));
    const navLinks = navAll.filter((a) => isShown(a) && text(a));
    const navHidden = pluginStore && navAll.length > 0 && navLinks.length === 0 && !q('.cl-nav-ready', headerEl);
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
        add('header.background', colourString(bg.colour), { traversal: 'paint-up' });
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
    // toggle), the nav's own edge, or the logo's, is where they start.
    const endGap = (el) => (rtl ? W - box(el).left : box(el).right);
    const navEnd = navLinks.length ? Math.max(...navLinks.map(endGap))
      : (navEl && isShown(navEl) && navEl !== headerEl) ? endGap(navEl)
        : (logoLink && isShown(logoLink)) ? endGap(logoLink) : startGap(headerEl);
    // An icon control may carry a short label or a count ("Cart 2"); a plain text link has no icon.
    const icons = qa('a, button', headerEl).filter((el) => isShown(el) && q('svg, img', el) && text(el).length <= 20
      && startGap(el) >= navEnd - 2 && !(logoLink && (el === logoLink || logoLink.contains(el)))
      && !(navEl && navEl !== headerEl && navEl.contains(el)))
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
      for (let el = copy; el && el !== footerEl; el = el.parentElement) {
        if (box(el).width >= box(footerEl).width * 0.6 && box(el).height <= 140) { bar = el; } else if (bar) { break; }
      }
    }
    const inBar = (el) => !!(bar && bar.contains(el));

    const mainText = textDown(pluginStore ? (q('.cl-footer-main', footerEl) || footerEl) : footerEl);
    pair('footer.background', 'footer.text_color', mainText && !inBar(mainText) ? mainText : textDown(footerEl));
    px('footer.height', box(footerEl).height, 8);

    // A social ICON: small, and pointing at a network. A text link to WhatsApp ("Contact us") is a link.
    const isSocial = (a) => (SOCIAL.test(a.href || '') || !!a.closest('.cl-footer-social-links')) && box(a).width <= 64 && box(a).height <= 64;
    let headings = qa(pluginStore ? '.footer-menu-title, .contact-info-title' : 'h2, h3, h4, h5, h6, [role="heading"]', footerEl)
      .filter((h) => isShown(h) && text(h) && !inBar(h));
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
    const brand = pluginStore ? q('.footer-brand-col', footerEl) : (qa('a', footerEl).find((a) => isShown(a) && isHomeLink(a) && q('img, svg', a)) || null);
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
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const chain = [];
      for (let a = n.parentElement; a && main.contains(a) && !edgeToEdge(a); a = a.parentElement) chain.push(a);
      const sectionEl = chain[chain.length - 1];
      if (!sectionEl || votes.has(sectionEl)) continue;
      const s = box(sectionEl);
      const same = chain.filter((a) => Math.abs(box(a).left - s.left) <= 1 && Math.abs(box(a).right - s.right) <= 1);
      const cs = getComputedStyle(same[0]);
      const edge = rtl ? W - (box(same[0]).right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight))
        : box(same[0]).left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft);
      const held = same.find(heldBack);
      votes.set(sectionEl, { gutter: round(edge), width: held ? round(box(held).width) : null });
    }
    const mostCommon = (values) => {
      const count = new Map();
      values.forEach((v) => count.set(v, (count.get(v) || 0) + 1));
      let best;
      for (const [v, c] of count) if (best === undefined || c > count.get(best)) best = v;
      return best;
    };
    const ballots = Array.from(votes.values());
    const maxWidth = ballots.length ? mostCommon(ballots.map((v) => v.width)) : null;
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

  // ── the spec ──────────────────────────────────────────────────────────────────────────────────
  const spec = {
    source: location.href,
    captured_at: today,
    viewport: { width: W, height: H },
    measured_with: 'browser',
    properties: rows,
  };
  const left = rows.filter((r) => r.reason && r.reason.kind === 'unmeasurable').map((r) => r.id);
  const standard = (W === 1440 && H === 900) || (W === 390 && H === 844);
  console.log(JSON.stringify(spec, null, 2));
  console.info(`measure.js: ${rows.length} rows on a ${pluginStore ? 'plugin store' : 'reference'} at ${W}×${H}.`
    + (standard ? '' : ' The checklist is measured at 1440×900 and 390×844 — resize and run again.')
    + (left.length ? `\nMeasure these by hand and replace them: ${left.join(', ')}` : ''));
  return spec;
})();

#!/usr/bin/env node
/**
 * handover.mjs — is the store actually finished, or does it only look finished?
 *
 *   node handover.mjs <site-url> <api-key> [--wordmark-intended "why there is no logo image"]
 *
 * `preflight.mjs` asks whether a build can START. This asks whether it may END. It is the
 * UNCONDITIONAL gate: `match.mjs` only runs when the merchant named a reference site, which most of
 * them do not — so before this script existed, the common build was checked by nothing at all after
 * the store was written.
 *
 * IT CHECKS ONLY WHAT LEAVES NO VISIBLE TRACE. Everything a person can see by opening the page is
 * deliberately left to the person: whether the topbar copy is the merchant's or the shipped line,
 * whether the palette reads, whether the thing hangs together. A script that pretended to judge those
 * would be worse than one that admits it cannot.
 *
 * The failures it catches are the ones that survive a screenshot AND a `200`:
 *
 *   1. THE LOGO HALF-STATE. A logo is two writes — the header design's own fields, and `site_logo_id`
 *      on `stores`. Set one and the other renders nothing, with a 200 on both calls.
 *
 *   2. THE HOLLOW ELEMENT. An element switched ON whose list is EMPTY. The view returns *before* it
 *      prints its own heading, so there is no dangling "Contact us", no error, and no gap in the
 *      markup — just space where a column should be. The footer ships this way deliberately now, so
 *      "leave it alone" produces a hollow footer rather than a defaulted one.
 *
 *   3. THE DANGLING ICON. An `*_icon_id` pointing at an icon that does not exist.
 *      `IconsManagerSelectorFR_cl::getIconCode()` returns `null` for an unknown id — no fallback, no
 *      log, no error. The control simply renders without its icon, and nothing anywhere says so.
 *      Found live on the plugin's own demo store: a cart edit button pointed at icon 17, which does
 *      not exist, while the shipped default was 57 `edit`. It had been that way since the build.
 *
 *   4. THE THIN CATALOGUE. Products with no featured image, a gallery too short to be a gallery, or
 *      photos at mixed aspect ratios / mixed formats. A product page with one photo looks *plausible*
 *      in a screenshot and returns 200 on every call, which is why it survives both. Measured on the
 *      same demo: 20/20 products had a featured image and 0/20 had a gallery of 4 or more. Mixing
 *      aspect ratios is, in this skill's own words, "the most visible defect a build can ship, and no
 *      status code reveals it".
 *
 *   5. THE CRAMPED HEADER. A header sizes to its content when its layout is `stacked` (which ignores
 *      `height`) or when it has no height, and then its card design is its only source of vertical
 *      space. With 0 vertical padding the nav row touches whatever comes next, while the height setting
 *      reads back exactly as written. Measured 21-09-2026: `height:221px` stored, a header about 103px
 *      tall on the page. A height that is not a real length (`auto`, `0`) is worse: the plugin still
 *      zeroes the card design's padding for it.
 *
 *   6. THE SEE-THROUGH STUCK HEADER. Once a sticky header sticks, whichever rule wins the cascade
 *      paints it. A transparent winner lets the page scroll visibly through the bar, and nothing at
 *      rest shows it.
 *
 *   7. THE FLUSH BAND. A card design that paints a background the page does not have, with no side
 *      padding at some breakpoint, puts the text on the band's edge. The page width mode pads a
 *      wrapper OUTSIDE the band, so it never helps. Measured 21-09-2026: a footer padded on desktop,
 *      flush on phones, because only `css_default` had been corrected.
 *
 *   8. THE UNTRANSLATED LABEL. On an Arabic-, Hebrew- or Thaana-script store, a `translatable` setting
 *      still written in Latin letters is shopper copy nobody translated. Measured 21-09-2026: "Add to
 *      cart" on the main buy button of an Arabic store whose build reported the copy as translated.
 *
 *   9. THE UNKEPT CHECKLIST. The feature checklist the merchant corrected is recorded in the
 *      blueprint, and the store can disagree with it: a countdown the merchant was told is OFF shipped
 *      ON, and options ticked ON had no rows behind them. Measured on the same build.
 *
 * EVERY LIST IS WALKED, page by page. The api returns at most 100 rows a page and silently clamps a
 * larger `per_page`, so reading a list once used to check the first 100 rows and call it the table.
 *
 * WHY THE HOLLOW CHECK CARRIES NO LIST OF FOOTER KEYS. This skill ships to merchants and cannot be
 * hot-fixed, so a curated key list is a fact that rots on a machine nobody can reach. Instead the
 * check tests a SHAPE — `<prefix>_is_active` is "yes" and a sibling under `<prefix>` is an empty
 * array — which is a naming convention, evaluated against whatever the install actually returns. It
 * therefore keeps working when the plugin adds a surface, and it fails OPEN (finds nothing) rather
 * than falsely blocking a build if the convention ever changes. For a gate, that is the safe
 * direction: a missed warning costs a re-run, a false block costs the merchant's trust. The feature
 * checklist (9) is the one place that needs a map of named settings, and it reports a key it cannot
 * find instead of passing over it.
 *
 * No dependencies — same rule as every script here. Network reaches the merchant's own site only.
 *
 * NOTE: sets `process.exitCode` and returns; never calls process.exit(), for the same reason
 * preflight.mjs and match.mjs do not — killing the loop mid-write truncates the report.
 */

const argv = process.argv.slice(2);
const flagAt = argv.findIndex((a) => a === '--wordmark-intended');
const wordmarkReason = flagAt === -1 ? null : (argv[flagAt + 1] ?? '');
/* `flagAt === -1` must not mean "skip index 0" — that silently ate the site URL when no flag was
 * passed, and every no-flag case then failed with a usage error that LOOKED like a real refusal. */
const positional = argv.filter((a, i) => !a.startsWith('--') && (flagAt === -1 || i !== flagAt + 1));
const [rawUrl, apiKey] = positional;

/* Long enough that it cannot be a shrug. Mirrors match.mjs's reason contract: the agent being gated
 * is the one writing the excuse, so "n/a" must not clear a gate. */
const MIN_REASON = 20;

/* A gallery shorter than this is not a gallery. Owner's rule: every product carries a featured image
 * AND at least this many gallery images. Deliberately hard, with no escape flag — unlike the
 * wordmark, there is no store for which "one photo per product" is a considered decision.
 *
 * 4 -> 2 on 20-09-2026, with the always-build-a-complete-store change. Every store is now built in
 * full, so the catalogue is 10 products and the gallery is the single slowest step in a build: at 4
 * it is 50 images, at 2 it is 30. Two still refutes "one photo reads as a placeholder", which is the
 * reason this rule exists; four was buying polish at the cost of the merchant waiting. */
const MIN_GALLERY = 2;

/* Aspect ratios within this fraction of each other count as the same ratio. Generation rounds to
 * whole pixels, so 1200x1600 and 1201x1600 are the same intent and must not be reported as drift. */
const RATIO_TOLERANCE = 0.02;

/* How much of an image to pull when reading its dimensions. A JPEG's SOF marker sits after any EXIF
 * and any embedded colour profile, which can be large; 128 KiB clears every real product photo while
 * keeping a 100-product sweep cheap. If the marker is past it the row is reported UNDETERMINED —
 * never silently treated as a match. */
const HEADER_BYTES = 131072;

/* Every list door answers at most 100 rows a page and CLAMPS a larger `per_page` to 100 without an
 * error. This script used to read each list once with `per_page=200` and take the answer as the whole
 * table: on a store with more than 100 uploads, an image past row 100 was reported "not in the media
 * library" (a failure the check invented), and a dangling icon past row 100 would have passed. */
const PAGE_SIZE = 100;
/* A runaway guard, not a real limit — 10,000 rows. Past it a walk reports itself unfinished rather
 * than presenting the rows it did read as all of them. */
const MAX_PAGES = 100;

/* A 429 is the api asking for a pause, not an answer. This runs at the END of a build that has just
 * spent the key's budget on writes, and walking every list makes more reads than one call per list
 * did, so it waits the `retry_after` the api names and tries again — a few times — before it reports
 * the read as failed. A read that still fails is then NOT CHECKED, never passed. */
const MAX_RETRIES = 3;
const MAX_WAIT_S = 30;

/* The plugin version from which a header's sticky style outranks its card design. Before it the two
 * tied at (0,2,0), and the card design — compiled later — won every property it declared. */
const STICKY_STYLE_WINS_FROM = [1, 2, 766];

/* Two colours closer than this, as a plain RGB distance, read as one surface — no band at all. */
const SAME_SURFACE = 6;

/* Below this alpha a surface is see-through. The same line match.mjs draws for a painted surface. */
const OPAQUE = 0.95;

const line = (ok, text) => console.log(`  ${ok ? '✓' : '✗'} ${text}`);
/* Something the reader must know that is neither a pass nor a failure: a check that could not apply
 * to this store, or a pass that rests on an assumption. Never used for a check that failed to run. */
const note = (text) => console.log(`  ! ${text}`);

/** Slug in, URL path out — ask `/me`, never guess. Same helper, same reasoning, as preflight.mjs. */
function pathFor(slug, fallback, resources) {
  const declared = resources?.[slug]?.path;
  return (typeof declared === 'string' && declared) ? declared : fallback;
}

/** The API wraps list payloads differently by version; take the first row whichever shape arrived. */
function firstRow(body) {
  if (Array.isArray(body)) return body[0] ?? null;
  for (const k of ['data', 'items', 'stores', 'results']) {
    const v = body?.[k];
    if (Array.isArray(v)) return v[0] ?? null;
    if (v && typeof v === 'object') return v;
  }
  return body && typeof body === 'object' ? body : null;
}

const isSet = (v) => v !== null && v !== undefined && v !== '' && v !== 0 && v !== '0';

/** An array, or a string holding one. Anything else is not a list and is none of our business. */
function asArray(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    const t = v.trim();
    if (t.startsWith('[')) {
      try {
        const parsed = JSON.parse(t);
        return Array.isArray(parsed) ? parsed : null;
      } catch { return null; }
    }
  }
  return null;
}

/** The rows of a list response, whichever wrapper arrived — or null when it is not a list at all. */
function listRows(body) {
  if (Array.isArray(body)) return body;
  const inner = body?.items ?? body?.data;
  return Array.isArray(inner) ? inner : null;
}

/**
 * Every row of a list door, page by page.
 *
 * Stops at `X-WP-TotalPages`, or on a short page when that header is absent — the two stop rules the
 * api's `pagination` page documents. Sends `order=ASC`, as that page asks of any walk: lists are
 * newest-first by default, so a row written while the walk runs would push every later page down by
 * one, returning one row twice and never returning another.
 *
 * A page that fails part-way returns an ERROR, never the rows read so far. A shorter list is exactly
 * the false answer this function exists to prevent.
 */
async function walk(call, path) {
  const rows = [];
  const sep = path.includes('?') ? '&' : '?';
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await call(`${path}${sep}per_page=${PAGE_SIZE}&page=${page}&order=ASC`);
    if (res.status !== 200) return { error: `page ${page} answered HTTP ${res.status}` };
    const batch = listRows(res.body);
    if (!batch) return { error: `page ${page} did not come back as a list` };
    rows.push(...batch);
    const header = res.headers?.get?.('x-wp-totalpages');
    const totalPages = (header === null || header === undefined || header === '') ? NaN : Number(header);
    if (Number.isFinite(totalPages) ? page >= totalPages : batch.length < PAGE_SIZE) return { rows };
  }
  return { error: `more than ${MAX_PAGES} pages, so it stopped rather than report part of the list as all of it` };
}

/**
 * How many rows a filtered list holds, from one small read: `X-WP-Total`, or — when a door sends no
 * total — whether the first page had anything in it, which is all an "at least one" question needs.
 */
async function countRows(call, path) {
  const res = await call(`${path}${path.includes('?') ? '&' : '?'}per_page=1`);
  if (res.status !== 200) return { error: `HTTP ${res.status}` };
  const total = res.headers?.get?.('x-wp-total');
  if (total !== null && total !== undefined && total !== '' && Number.isFinite(Number(total))) {
    return { count: Number(total) };
  }
  const rows = listRows(res.body);
  return rows ? { count: rows.length } : { error: 'the reply was not a list' };
}

/**
 * Which designs does this store actually use? DISCOVERED from the store row, never assumed:
 *   `<surface>_layout_config` → { default: {type:'sm', id}, pages: { <context>: {type:'sm', id} } }
 *   `<type>_sm_id`            → an integer id                     (everything else)
 * A layout surface can use a DIFFERENT design on some pages (the `pages` overrides), and a shopper
 * sees each of those, so each is checked. Returned as [type, id] pairs, without repeats.
 * Reading it this way means a surface the plugin adds later is checked without editing this file.
 */
function designsFrom(store) {
  const out = [];
  const seen = new Set();
  const add = (type, id) => {
    const key = `${type}/${id}`;
    if (!seen.has(key)) { seen.add(key); out.push([type, id]); }
  };
  for (const [key, value] of Object.entries(store ?? {})) {
    if (key.endsWith('_layout_config')) {
      const surface = key.slice(0, -'_layout_config'.length);
      let cfg = value;
      if (typeof cfg === 'string') { try { cfg = JSON.parse(cfg); } catch { cfg = null; } }
      const pages = (cfg?.pages && typeof cfg.pages === 'object') ? Object.values(cfg.pages) : [];
      for (const d of [cfg?.default, ...pages]) {
        if (d && d.type === 'sm' && Number(d.id) > 0) add(surface, Number(d.id));
      }
    } else if (key.endsWith('_sm_id') && Number(value) > 0) {
      add(key.slice(0, -'_sm_id'.length), Number(value));
    }
  }
  return out;
}

/** The whole hollow rule, in one function. See the header comment for why it is a shape, not a list. */
function hollowIn(settings) {
  const found = [];
  for (const [key, value] of Object.entries(settings ?? {})) {
    if (!key.endsWith('_is_active') || String(value) !== 'yes') continue;
    const prefix = key.slice(0, -'_is_active'.length) + '_';
    for (const [sib, sibValue] of Object.entries(settings)) {
      if (sib === key || !sib.startsWith(prefix)) continue;
      const arr = asArray(sibValue);
      if (arr && arr.length === 0) found.push({ toggle: key, list: sib });
    }
  }
  return found;
}

/**
 * Width and height out of an image's own header bytes - no dependencies, no image library.
 *
 * WHY THIS IS HERE AT ALL: the `media` door returns `id`, `mime`, `filename` and `url`, and no
 * dimensions. Aspect ratio cannot be derived from any of them, and aspect ratio is the one image
 * property this skill already calls the most visible defect a build can ship. So the bytes are the
 * only source, and reading four format headers is cheaper than not checking at all.
 *
 * Returns `null` when the format is unrecognised or the header did not arrive in the first slice.
 * `null` is reported as UNDETERMINED, never as agreement - the same rule as `unmeasurable` in
 * reference-extraction.md: a check that could not look must not read as a pass.
 */
function readImageSize(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const has = (n) => u8.length >= n;

  /* PNG - fixed layout: 8-byte signature, then the IHDR chunk with width/height at 16 and 20. */
  if (has(24) && u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47) {
    return { w: dv.getUint32(16), h: dv.getUint32(20) };
  }

  /* GIF - little-endian, right after the "GIF87a"/"GIF89a" signature. */
  if (has(10) && u8[0] === 0x47 && u8[1] === 0x49 && u8[2] === 0x46) {
    return { w: dv.getUint16(6, true), h: dv.getUint16(8, true) };
  }

  /* WebP - three sub-formats under one RIFF container, each storing the size differently. */
  if (has(30) && u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46
      && u8[8] === 0x57 && u8[9] === 0x45 && u8[10] === 0x42 && u8[11] === 0x50) {
    const fourcc = String.fromCharCode(u8[12], u8[13], u8[14], u8[15]);
    if (fourcc === 'VP8 ') {
      return { w: dv.getUint16(26, true) & 0x3fff, h: dv.getUint16(28, true) & 0x3fff };
    }
    if (fourcc === 'VP8L') {
      const b = dv.getUint32(21, true);
      return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
    }
    if (fourcc === 'VP8X') {
      const rd24 = (o) => u8[o] | (u8[o + 1] << 8) | (u8[o + 2] << 16);
      return { w: rd24(24) + 1, h: rd24(27) + 1 };
    }
    return null;
  }

  /* JPEG - walk the marker chain to the first SOFn. Its position varies with EXIF and ICC size,
     which is exactly why a fixed offset does not work and why HEADER_BYTES is generous. */
  if (has(4) && u8[0] === 0xff && u8[1] === 0xd8) {
    let i = 2;
    while (i + 9 < u8.length) {
      if (u8[i] !== 0xff) { i++; continue; }
      const marker = u8[i + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      const len = dv.getUint16(i + 2);
      /* SOF0-SOF15, minus the three that are not frame headers (DHT C4, JPG C8, DAC CC). */
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { h: dv.getUint16(i + 5), w: dv.getUint16(i + 7) };
      }
      if (len < 2) return null;
      i += 2 + len;
    }
  }
  return null;
}

/**
 * Every `*_icon_id` set on every design, checked against the icons that actually exist.
 *
 * A dangling id is invisible at runtime, so this is the only place it can be caught. The icons are
 * read ONCE, every page of them, and matched as a set; ids are compared as strings because the
 * settings store them as strings and the API returns them as strings, and `'17' !== 17` would
 * silently pass everything.
 */
async function checkIcons(call, R, settingsByDesign) {
  const iconPath = pathFor('design_controls_icons_manager', 'design_controls/icons_manager', R);
  const read = await walk(call, iconPath);
  if (read.error) {
    return { skipped: `could not read the icons library — ${read.error}`, dangling: [] };
  }
  const known = new Map(read.rows.map((r) => [String(r.id), r.name]));

  const dangling = [];
  const byDesign = new Map();
  for (const [design, settings] of settingsByDesign) {
    for (const [k, v] of Object.entries(settings)) {
      /* Any key that holds an icon id — NOT just one ending `_icon_id`. The toggle keys are spelled
       * `*_icon_open_id`, `*_icon_close_id`, `*_open_icon_id` and `*_open_group_icon_id`, and an
       * endsWith('_icon_id') filter silently skipped every one of them. That is precisely the pair
       * this check exists to judge, so the narrow filter made it report "every pair belongs
       * together" while a telephone was rendering on the live product page. Measured 18-09-2026 —
       * the browser disagreed with a green gate, which is the only reason it was found. */
      if (!/icon/.test(k) || !k.endsWith('_id')) continue;
      const id = String(v ?? '').trim();
      if (!id || id === '0') continue;
      if (!known.has(id)) { dangling.push({ design, key: k, id }); continue; }
      if (!byDesign.has(design)) byDesign.set(design, new Map());
      byDesign.get(design).set(k, { id, name: known.get(id) });
    }
  }

  /*
   * A RESOLVING id is not a CORRECT id, and this is the half a dangling check cannot see.
   *
   * The live demo store carried `extra_description_icon_open_id = 12` on its product design. 12 is
   * `phone`, and its partner 13 is `email`, so the Specifications accordion rendered a telephone
   * handset. Both ids are real, both resolve, and every check above passed. The repo-side audit
   * catches it in the SHIPPED DEFAULTS; nothing caught it in a live settings row - and fixing the
   * default does NOT fix an existing store, because a default only applies to a fresh install.
   *
   * Pairs are matched by TOKEN, because the plugin spells them several ways: `*_icon_open_id`,
   * `*_open_icon_id`, `*_open_group_icon_id`.
   */
  const PAIRS = { 'chevron-down': 'chevron-up', plus: 'minus', 'arrow-down': 'arrow-up' };
  const mismatched = [];
  for (const [design, keys] of byDesign) {
    for (const [key, open] of keys) {
      if (!/(^|_)open(_|$)/.test(key)) continue;
      const closeKey = key.replace(/(^|_)open(_|$)/, '$1close$2');
      const close = keys.get(closeKey);
      if (!close) continue;
      if (PAIRS[open.name] === close.name) continue;
      mismatched.push({ design, key, closeKey, open, close });
    }
  }
  return { skipped: null, dangling, mismatched, count: known.size, pairs: PAIRS };
}

/**
 * The catalogue's images: is every product actually photographed, and photographed consistently?
 *
 * Four separate questions, reported separately because they have different fixes:
 * featured image present, gallery at least MIN_GALLERY, one format, one aspect ratio and size.
 *
 * Dimensions are read from the image bytes (see readImageSize). Anything undetermined is named as
 * undetermined rather than folded into either answer.
 */
async function checkImages(call, R, productsRead) {
  if (productsRead.error) {
    return { skipped: `could not read products — ${productsRead.error}`, problems: [] };
  }
  const products = productsRead.rows;
  if (!products.length) return { skipped: 'no products on this store', problems: [] };

  const noFeatured = [];
  const thinGallery = [];
  const ids = new Set();

  for (const p of products) {
    const label = p.sku || p.slug || p.title || `#${p.id}`;
    const feat = String(p.featured_image_id ?? '').trim();
    if (!feat || feat === '0') { noFeatured.push(label); } else { ids.add(feat); }

    let gal = p.gallery_image_ids ?? [];
    if (typeof gal === 'string') {
      try { gal = JSON.parse(gal); } catch { gal = gal.split(',').filter(Boolean); }
    }
    if (!Array.isArray(gal)) gal = [];
    gal.map(String).filter((g) => g && g !== '0').forEach((g) => ids.add(g));
    if (gal.length < MIN_GALLERY) thinGallery.push(`${label} (${gal.length})`);
  }

  /* Resolve every referenced image ONCE - a product's featured shot is often another's gallery
     entry, and the media library is the cheapest place to learn mime and url. EVERY page of it:
     a failed read used to fall through to an EMPTY library, and every image the products reference
     was then reported "not in the media library" — a failure the check itself invented. */
  const mediaPath = pathFor('media', 'media', R);
  const media = await walk(call, mediaPath);
  if (media.error) {
    return { skipped: `could not read the media library — ${media.error}`, problems: [] };
  }
  const byId = new Map(media.rows.map((m) => [String(m.id), m]));

  const mimes = new Map();
  const sizes = [];
  const undetermined = [];
  const missing = [];

  for (const id of ids) {
    const m = byId.get(id);
    if (!m) { missing.push(id); continue; }
    const mime = m.mime || 'unknown';
    mimes.set(mime, (mimes.get(mime) ?? 0) + 1);
    try {
      const r = await fetch(m.url, { headers: { Range: `bytes=0-${HEADER_BYTES - 1}` } });
      const dim = r.ok ? readImageSize(new Uint8Array(await r.arrayBuffer())) : null;
      if (dim && dim.w > 0 && dim.h > 0) { sizes.push({ id, w: dim.w, h: dim.h, name: m.filename || id }); }
      else { undetermined.push(m.filename || id); }
    } catch { undetermined.push(m.filename || id); }
  }

  const problems = [];
  if (noFeatured.length) {
    problems.push(
      `${noFeatured.length} product(s) have NO featured image: ` +
      `${noFeatured.slice(0, 8).join(', ')}${noFeatured.length > 8 ? ', ...' : ''}\n` +
      '      The listing card, the cart line and every share preview fall back to nothing.'
    );
  }
  if (thinGallery.length) {
    problems.push(
      `${thinGallery.length} product(s) have fewer than ${MIN_GALLERY} gallery images: ` +
      `${thinGallery.slice(0, 8).join(', ')}${thinGallery.length > 8 ? ', ...' : ''}\n` +
      '      A product page with one photo reads as a placeholder listing, and a COD shopper being\n' +
      '      asked to hand over cash at the door is already looking for a reason not to.'
    );
  }
  if (mimes.size > 1) {
    problems.push(
      `product images are in ${mimes.size} different formats: ` +
      [...mimes].map(([k, n]) => `${k} x${n}`).join(', ') + '\n' +
      '      Pick one and regenerate - mixed formats mean mixed compression behaviour and, on a\n' +
      '      listing grid, visibly different rendering of the same kind of photograph.'
    );
  }
  if (sizes.length > 1) {
    const base = sizes[0].w / sizes[0].h;
    const offRatio = sizes.filter((s) => Math.abs((s.w / s.h) - base) / base > RATIO_TOLERANCE);
    if (offRatio.length) {
      problems.push(
        `product images are at MIXED ASPECT RATIOS - ${offRatio.length} of ${sizes.length} differ from ` +
        `${sizes[0].w}x${sizes[0].h}:\n` +
        offRatio.slice(0, 6).map((s) => `        ${s.name}  ${s.w}x${s.h}`).join('\n') +
        (offRatio.length > 6 ? '\n        ...' : '') + '\n' +
        '      This is the most visible defect a build can ship and no status code reveals it: the\n' +
        '      listing crops each card differently and the grid stops lining up.'
      );
    }
    const longEdges = new Set(sizes.map((s) => Math.max(s.w, s.h)));
    if (!offRatio.length && longEdges.size > 1) {
      problems.push(
        `product images share a ratio but not a SIZE - ${longEdges.size} different long edges: ` +
        [...longEdges].sort((a, b) => a - b).join(', ') + '\n' +
        '      Generate at one size. Different source sizes give different sharpness in one grid.'
      );
    }
  }
  if (missing.length) {
    problems.push(
      `${missing.length} image id(s) referenced by a product are not in the media library: ` +
      `${missing.slice(0, 8).join(', ')}\n      Those render nothing at all.`
    );
  }

  return {
    skipped: null,
    problems,
    undetermined,
    counted: { products: products.length, images: ids.size, measured: sizes.length, library: media.rows.length },
  };
}

/* ── CSS, read the way a browser cascades it ─────────────────────────────────────────────────────
 * Three checks have to know what a card design ACTUALLY pads and paints at each breakpoint. A card
 * design is two declaration strings: `css_default`, and `css_mobile`, which the plugin compiles into
 * `@media(max-width:767px)` AFTER every desktop rule — so on a phone it overrides css_default for
 * exactly the properties it declares, and no others. Shorthands have to be expanded to see that:
 * `padding:40px 0` in css_mobile replaces all four sides a `padding-left:15px` in css_default set,
 * and `background:transparent` resets a background-color. Only the two families these checks read
 * are expanded — padding and background; every other property passes through as written. */

/** Whitespace-separated tokens, keeping `rgb(1, 2, 3)` or `calc(1px + 2px)` in one piece. */
function tokens(value) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of String(value ?? '').trim()) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (depth === 0 && /\s/.test(ch)) {
      if (cur) { out.push(cur); cur = ''; }
      continue;
    }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

/** `a:b; c:d !important` → [{ prop, value, important }], in source order. */
function declarations(css, forceImportant = false) {
  const out = [];
  for (const chunk of String(css ?? '').split(';')) {
    const at = chunk.indexOf(':');
    if (at === -1) continue;
    const prop = chunk.slice(0, at).trim().toLowerCase();
    const raw = chunk.slice(at + 1).trim();
    const important = forceImportant || /!\s*important\s*$/i.test(raw);
    const value = raw.replace(/!\s*important\s*$/i, '').trim();
    if (prop && value) out.push({ prop, value, important });
  }
  return out;
}

/** 1 to 4 box values → [top, right, bottom, left], the CSS way. */
function boxSides(value) {
  const [t, r = t, b = t, l = r] = tokens(value);
  return [t, r, b, l];
}

/* Words a `background` shorthand can carry that are NOT its colour: position, size, repeat,
 * attachment and box. Anything else left over is the colour — including a colour name this script
 * cannot read, which is then reported as unreadable instead of being taken for transparent. */
const BACKGROUND_WORDS = new Set(['none', 'repeat', 'no-repeat', 'repeat-x', 'repeat-y', 'space', 'round',
  'center', 'top', 'bottom', 'left', 'right', 'cover', 'contain', 'auto', 'fixed', 'scroll', 'local',
  'border-box', 'padding-box', 'content-box', 'text']);

/** The `background` shorthand as the two longhands the checks read. Like CSS, it resets what it omits. */
function splitBackground(value) {
  const whole = String(value).trim().toLowerCase();
  if (['inherit', 'initial', 'unset', 'revert', 'revert-layer'].includes(whole)) {
    return [['background-color', whole], ['background-image', 'none']];
  }
  let colour = 'transparent';
  let image = 'none';
  for (const raw of tokens(value)) {
    const tok = raw.replace(/,+$/, '');
    const t = tok.toLowerCase();
    if (/^(url|image-set|image|cross-fade|element)\(|gradient\(/.test(t)) { image = tok; continue; }
    if (t.includes('/') || /^[-+]?[\d.]/.test(t) || BACKGROUND_WORDS.has(t)) continue;
    colour = tok;
  }
  return [['background-color', colour], ['background-image', image]];
}

/** One declaration as the longhands it sets: padding and background expanded, anything else as-is. */
function longhands(prop, value) {
  if (prop === 'padding') {
    const [t, r, b, l] = boxSides(value);
    return [['padding-top', t], ['padding-right', r], ['padding-bottom', b], ['padding-left', l]];
  }
  /* Logical sides are folded onto physical ones. Every check tests BOTH sides of an axis at once, so
   * which physical side "start" lands on does not change a verdict — unless one card design mixed
   * physical and logical sides, which none of the shipped ones does. */
  if (prop === 'padding-inline' || prop === 'padding-block') {
    const [a, b = a] = tokens(value);
    return prop === 'padding-inline'
      ? [['padding-left', a], ['padding-right', b]]
      : [['padding-top', a], ['padding-bottom', b]];
  }
  const logical = {
    'padding-inline-start': 'padding-left', 'padding-inline-end': 'padding-right',
    'padding-block-start': 'padding-top', 'padding-block-end': 'padding-bottom',
  };
  if (logical[prop]) return [[logical[prop], value]];
  if (prop === 'background') return splitBackground(value);
  return [[prop, value]];
}

/**
 * Apply declarations onto a longhand map the way successive CSS rules do: a later declaration wins,
 * except that a normal one never displaces an !important one.
 */
function cascade(map, css, forceImportant = false) {
  for (const d of declarations(css, forceImportant)) {
    for (const [prop, value] of longhands(d.prop, d.value)) {
      if (map.get(prop)?.important && !d.important) continue;
      map.set(prop, { value, important: d.important });
    }
  }
  return map;
}

/**
 * What a card design compiles to, per breakpoint. `null` when it compiles NOTHING: the plugin emits
 * CSS only for presets marked active, so an inactive one leaves its element unstyled. `force_styles`
 * appends !important to every declaration of both strings, which is why it is carried through. The
 * cards type adds only `box-sizing` of its own — no padding, no background.
 */
function presetAt(preset) {
  if (!preset || String(preset.is_active) !== 'yes') return null;
  const force = String(preset.force_styles) === 'yes';
  const desktop = cascade(new Map(), preset.css_default, force);
  const phone = cascade(new Map(desktop), preset.css_mobile, force);
  return { desktop, phone };
}

/** A length that is zero — or absent, which on a card design means the same: nothing pads it. */
function isZeroLength(v) {
  if (v === undefined || v === null) return true;
  const s = String(v).trim().toLowerCase();
  return s === '' || /^[-+]?0*\.?0+(px|r?em|%|pt|vh|vw|vmin|vmax|ch|ex)?$/.test(s);
}

/* ── colour ────────────────────────────────────────────────────────────────────────────────────────
 * Local on purpose, like match.mjs's: each script stands alone. The palette door stores `code` as
 * hex, rgb(), rgba(), hsl(), hsla() or `transparent`, so those are what is parsed, plus `white` and
 * `black`; a design value that is a `var(--cl-…)` is looked up in the store's own palette. */

function hslToRgb(h, s, l) {
  const S = s / 100;
  const L = l / 100;
  const hue = ((h % 360) + 360) % 360;
  const k = (n) => (n + hue / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((x) => x * 255);
}

function parseColourLiteral(v) {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'transparent') return { rgb: [0, 0, 0], alpha: 0 };
  if (s === 'white') return { rgb: [255, 255, 255], alpha: 1 };
  if (s === 'black') return { rgb: [0, 0, 0], alpha: 1 };
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/);
  if (hex) {
    const h = hex[1].length <= 4 ? hex[1].split('').map((c) => c + c).join('') : hex[1];
    return {
      rgb: [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)),
      alpha: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
    };
  }
  const fn = s.match(/^(rgba?|hsla?)\(\s*([^)]*)\)$/);
  if (!fn) return null;
  const parts = fn[2].split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const a = parts[3];
  const alpha = a === undefined ? 1 : (a.endsWith('%') ? Number(a.slice(0, -1)) / 100 : Number(a));
  const rgb = fn[1].startsWith('rgb')
    ? parts.slice(0, 3).map((p) => (p.endsWith('%') ? Number(p.slice(0, -1)) * 2.55 : Number(p)))
    : hslToRgb(parseFloat(parts[0]), parseFloat(parts[1]), parseFloat(parts[2]));
  if (rgb.some((c) => !Number.isFinite(c)) || !Number.isFinite(alpha)) return null;
  return { rgb: rgb.map((c) => Math.round(c)), alpha };
}

/**
 * Resolve a colour as the page would: `var(--cl-x)` through the store's palette (each row carries its
 * `css_var` and its `code`), a literal as itself. Returns { rgb, alpha, text } or { unresolved, text }.
 * Anything it cannot read is UNRESOLVED, never guessed — `inherit` included.
 */
function colourResolver(paletteRows) {
  const vars = new Map();
  for (const r of paletteRows ?? []) {
    const m = /var\(\s*(--[\w-]+)\s*\)/.exec(String(r.css_var ?? ''));
    if (m) vars.set(m[1].toLowerCase(), r.code);
  }
  const resolve = (value, depth) => {
    const v = String(value ?? '').trim();
    const ref = v.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/i);
    if (ref) {
      const code = vars.get(ref[1].toLowerCase());
      if (code !== undefined && depth < 4) return resolve(code, depth + 1);
      if (ref[2]) return resolve(ref[2], depth + 1);
      return { unresolved: paletteRows
        ? `${ref[1]} is not in this store's palette`
        : `${ref[1]} could not be looked up, because the palette could not be read` };
    }
    return parseColourLiteral(v)
      ?? { unresolved: `"${v}" is not a colour this check can read — use a palette variable or a hex value` };
  };
  return (value) => ({ ...resolve(value, 0), text: String(value ?? '').trim() });
}

const hexOf = (c) => '#' + c.rgb.map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')
  + (c.alpha < 1 ? ` at ${Math.round(c.alpha * 100)}%` : '');
const describe = (c) => (c.text && !c.text.startsWith('#') ? `${c.text} = ${hexOf(c)}` : hexOf(c));

/**
 * What a longhand map paints: { none } (nothing), { image } (a gradient or picture — it paints, but
 * has no single colour to compare), { colour } or { unresolved }.
 */
function paintOf(map, resolve) {
  const image = map?.get('background-image')?.value;
  if (image && image.toLowerCase() !== 'none') return { image, text: image.slice(0, 60) };
  const raw = map?.get('background-color')?.value;
  if (!raw) return { none: true };
  /* The initial background colour is transparent; `inherit` is not handled here and stays unreadable. */
  if (['initial', 'unset', 'revert', 'revert-layer'].includes(raw.trim().toLowerCase())) return { none: true, text: raw };
  const c = resolve(raw);
  if (c.unresolved) return { unresolved: c.unresolved, text: raw };
  if (c.alpha <= 0.02) return { none: true, text: raw };
  return { colour: c };
}

/** Does a band read as a different surface from the page it sits on? A see-through band is blended. */
function differs(band, page) {
  const a = Math.min(1, band.alpha);
  const seen = band.rgb.map((c, i) => a * c + (1 - a) * page.rgb[i]);
  return Math.sqrt(seen.reduce((sum, c, i) => sum + (c - page.rgb[i]) ** 2, 0)) > SAME_SURFACE;
}

/**
 * The colour a design sits on. VERIFIED, not assumed (21-09-2026): the store's page background is
 * `store_settings` → `page_background_style`, compiled into a `:root body` rule. It is NOT simply
 * palette slot 23 — that is only the shipped default, and a store may point it anywhere (one live
 * store measured that day pointed it at bg-color2). Product pages paint their own body from the
 * product design's `product_page_style`, so the product design's bands are compared with that when
 * it sets one. An empty style leaves the THEME's colour showing, which the api cannot see:
 * that is unresolved.
 */
async function readPageBackgrounds(call, R, resolve, designs) {
  const colourOf = (css, emptyWhy) => {
    const p = paintOf(cascade(new Map(), css), resolve);
    if (p.colour) {
      return p.colour.alpha >= OPAQUE ? p.colour
        : { unresolved: `the page background ${describe(p.colour)} is see-through, so the theme's colour shows under it` };
    }
    if (p.image) return { unresolved: 'the page background is an image or a gradient, with no single colour to compare a band with' };
    if (p.unresolved) return { unresolved: p.unresolved };
    return emptyWhy ? { unresolved: emptyWhy } : null;
  };
  const res = await call(pathFor('store_settings', 'store_settings', R));
  const store = res.status !== 200
    ? { unresolved: `could not read store_settings (HTTP ${res.status})` }
    : colourOf(res.body?.settings?.page_background_style ?? '',
      'the store sets no page background, so the theme\'s colour shows and the api cannot see it');
  const productCss = designs.find((d) => d.type === 'product')?.settings?.product_page_style;
  return { store, product: productCss ? colourOf(productCss, null) : null };
}

/**
 * The value the plugin's header compiler treats as "a height is set". It mirrors
 * StyleManagerBK_cl::getSingleCssPropertyValue($style, 'height', true) (styleManagerBK.php:550-596):
 * a var(), else any word, else any number with or without a unit, each found as `height:` followed
 * DIRECTLY by the value, the first match winning; '' when none matches. generated_css.php:31 then
 * emits the padding guard (`padding-top/bottom: 0 !important`) for ANY non-empty value on a one-row
 * layout. Mirrored, not improved: this check has to agree with what the plugin compiles, and the
 * plugin counts `auto`, `0` or a bare `60` as a set height.
 */
function pluginHeightGuardValue(style) {
  const s = String(style ?? '');
  const m = s.match(/height:(var\([^)]+\))/) || s.match(/height:([a-zA-Z-]+)/)
    || s.match(/height:(-?\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw)?)/);
  return m ? m[1] : '';
}

/**
 * Whether the header's own `height` gives the bar a size in the BROWSER: the last `height`
 * declaration, as a positive length with a unit. `auto`, `0`, a percentage of an auto-height parent,
 * a word, or a bare number (invalid CSS, dropped) all leave it sized to its content. A function
 * (var, calc, clamp, min, max) cannot be resolved here, so it is taken as a real height.
 */
function headerHasFixedHeight(style) {
  const d = declarations(style).filter((x) => x.prop === 'height').pop();
  if (!d) return false;
  const v = d.value.trim().toLowerCase();
  if (/^(var|calc|clamp|min|max)\(/.test(v)) return true;
  const m = v.match(/^\+?(\d*\.?\d+)(px|r?em|vh|vw|vmin|vmax|svh|lvh|dvh|pt|pc|cm|mm|in|q|ch|ex|r?lh)$/);
  return !!m && Number(m[1]) > 0;
}

/**
 * Does a card design breakpoint give the bar any top or bottom padding? Under the plugin's padding
 * guard only an `!important` declaration survives: the card design's doubled class out-ranks the
 * guard's single one, so force_styles, or an explicit !important, keeps its padding.
 */
function hasVerticalPadding(map, guarded) {
  const side = (prop) => {
    const e = map.get(prop);
    return (!e || (guarded && !e.important)) ? '0' : e.value;
  };
  return !(isZeroLength(side('padding-top')) && isZeroLength(side('padding-bottom')));
}

/**
 * 5 — THE CRAMPED HEADER. Does every header that sizes to its content have vertical space, on desktop
 * and on phones?
 *
 * A header sizes to its content in three cases (generated_css.php: `height: fit-content`, then the
 * design's style, then the guard):
 *   a. `stacked`: it forces `height:auto` over any height and never gets the guard, so the bar is its
 *      two rows plus the card design's top and bottom padding.
 *   b. a one-row layout with NO height: no guard either, so the card design's padding is again the
 *      only vertical space. The shipped `height:60px` avoids this; removing it re-opens it.
 *   c. a one-row layout whose height is not a real length (`auto`, `0`, a bare number): the plugin
 *      still counts it as set and zeroes the padding, so only !important padding survives.
 * A one-row layout with a real height has room and is not checked here.
 */
function checkHeaderVerticalSpace(headers, presetsById) {
  const problems = [];
  let checked = 0;
  for (const d of headers) {
    const stacked = String(d.settings.main_header_layout ?? '') === 'stacked';
    const style = d.settings.main_header_container_style ?? '';
    if (!stacked && headerHasFixedHeight(style)) continue;
    checked++;
    // generated_css.php:31 never emits the guard for `stacked`.
    const guard = stacked ? '' : pluginHeightGuardValue(style);
    const id = Number(d.settings.main_header_container_preset ?? 0);
    const preset = presetsById.get(String(id));
    const at = presetAt(preset);
    const flat = [];
    for (const [bp, map] of [['desktop', at?.desktop], ['phones', at?.phone]]) {
      if (!map || !hasVerticalPadding(map, guard !== '')) flat.push(bp);
    }
    if (!flat.length) continue;

    if (guard !== '') {
      problems.push(
        `${d.label}: the header's height is \`${guard}\`, which gives the bar no height of its own on ${flat.join(' or on ')}, ` +
        'yet the plugin still counts it as a set height.\n' +
        '      Any height value switches on the rule that zeroes the card design\'s top and bottom padding,\n' +
        '      a rule meant for a fixed-height bar. So this bar is only as tall as its content, with no\n' +
        '      padding at all. Set a real length (the shipped value is 60px), or remove the height and give\n' +
        '      the card design padding-top and padding-bottom in css_default AND css_mobile. See\n' +
        '      api-recipes.md → "Header height: what sets it depends on the layout".'
      );
      continue;
    }

    const why = !preset
      ? `it points at card design #${id}, which does not exist on this install, so nothing pads it`
      : !at
        ? `its card design #${id} "${preset.title}" is switched off (is_active "${preset.is_active}"), so it compiles no CSS at all`
        : `its card design #${id} "${preset.title}" sets no top or bottom padding on ${flat.join(' or on ')} ` +
          `(css_default \`${preset.css_default || '—'}\`, css_mobile \`${preset.css_mobile || '—'}\`)`;
    problems.push(stacked
      ? `${d.label}: the header layout is \`stacked\`, and ${why}.\n` +
        '      A stacked header ignores `height` and sizes to its two rows, so the card design\'s top and\n' +
        '      bottom padding is the ONLY vertical space it has. Without it the logo sits on the bar\'s top\n' +
        '      edge and the nav row touches whatever comes next, while the height reads back as written.\n' +
        '      Give the card design padding-top and padding-bottom in css_default AND css_mobile. Check its\n' +
        '      used_count first: if it is shared, create a card design for the header alone. See\n' +
        '      api-recipes.md → "Header height: what sets it depends on the layout".'
      : `${d.label}: the header has no height, so it sizes to its content, and ${why}.\n` +
        '      With no height the bar is only as tall as its content plus the card design\'s top and\n' +
        '      bottom padding, the same as a stacked header. Without that padding the logo sits on the\n' +
        '      bar\'s top edge and the nav row touches whatever comes next. Give the card design\n' +
        '      padding-top and padding-bottom in css_default AND css_mobile (check its used_count first:\n' +
        '      if it is shared, create a card design for the header alone), or set a height again: the\n' +
        '      shipped value is 60px. See api-recipes.md → "Header height: what sets it depends on the layout".'
    );
  }
  return { checked, problems };
}

/** A dotted version string as numbers, or null. */
function parseVersion(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(String(v ?? ''));
  return m ? m.slice(1, 4).map(Number) : null;
}

function atLeast(v, min) {
  for (let i = 0; i < 3; i++) {
    if (v[i] !== min[i]) return v[i] > min[i];
  }
  return true;
}

/**
 * Who paints a stuck header under one cascade rule. The stuck bar is `.cl-header-main`, the element
 * carrying the card design; the sticky wrapper around it paints nothing of its own. Two rules reach it:
 *   'new' — plugin 1.2.766 and later: the sticky style is (0,3,0) and outranks the card design's
 *           (0,2,0), unless the card design's value is !important (its force_styles);
 *   'old' — before that: the two tie at (0,2,0), and the card design, compiled later, wins every
 *           property it declares — a `background:transparent` on it beats any sticky colour.
 */
function stuckPaint(rule, stickyMap, presetMap, resolve) {
  const declares = (m) => !!m && (m.has('background-color') || m.has('background-image'));
  const cardDeclares = declares(presetMap);
  const cardForced = cardDeclares && !!(presetMap.get('background-color')?.important || presetMap.get('background-image')?.important);
  const stickyDeclares = declares(stickyMap);
  const winner = rule === 'new'
    ? (cardForced ? 'card' : stickyDeclares ? 'sticky' : cardDeclares ? 'card' : null)
    : (cardDeclares ? 'card' : stickyDeclares ? 'sticky' : null);
  if (!winner) return { winner, cardForced, none: true };
  return { winner, cardForced, ...paintOf(winner === 'sticky' ? stickyMap : presetMap, resolve) };
}

/** A stuck paint that fails: transparent, see-through, or unreadable. null when it is opaque. */
function stuckFault(p) {
  if (p.none) return 'is transparent';
  if (p.unresolved) return `could not be read — ${p.unresolved}`;
  if (p.colour && p.colour.alpha < OPAQUE) return `is see-through (${describe(p.colour)})`;
  return null;
}

/** Why the stuck bar looks the way it does, as one sentence. */
function stuckCause(f, cardDesc) {
  if (!f.p.winner) return 'neither the sticky style nor the card design declares a background, so nothing paints the bar';
  if (f.p.winner === 'sticky') return `the sticky style paints the bar, and its background ${f.fault}`;
  if (f.rule === 'new' && f.p.cardForced) {
    return `${cardDesc} paints the bar: its force_styles makes it !important, so it beats the sticky style, and its background ${f.fault}`;
  }
  if (f.rule === 'new') return `the sticky style declares no background, so ${cardDesc} paints the bar, and its background ${f.fault}`;
  return `${cardDesc} paints the bar, and its background ${f.fault}`;
}

/**
 * 6 — THE SEE-THROUGH STUCK HEADER. For each sticky header: once it sticks, is the bar opaque?
 *
 * ⚠️ The rule lives in COMPILED CSS, so it changes when the header design is next SAVED, not when the
 * plugin is upgraded. A store built on 1.2.766 or later is fine; one upgraded past it keeps the old
 * rule until its header is saved again — which is why a pass that depends on the new rule says so.
 * With no version from /me, both rules are applied and the bar must be opaque under each.
 */
function checkStickyHeaders(headers, presetsById, resolve, version) {
  const problems = [];
  const notes = [];
  let checked = 0;
  const rules = !version ? ['old', 'new'] : (atLeast(version, STICKY_STYLE_WINS_FROM) ? ['new'] : ['old']);
  const ruleText = {
    new: 'from plugin 1.2.766 the sticky style wins over the card design',
    old: 'before plugin 1.2.766 the card design wins every property it declares, even while stuck',
  };
  for (const d of headers) {
    if (String(d.settings.main_header_is_sticky ?? '') !== 'yes') continue;
    checked++;
    const stickyCss = String(d.settings.main_header_sticky_style ?? '');
    const sticky = cascade(new Map(), stickyCss);
    const id = Number(d.settings.main_header_container_preset ?? 0);
    const preset = presetsById.get(String(id));
    const at = presetAt(preset);
    const faults = [];
    let onlyNew = false;
    for (const [bp, presetMap] of [['desktop', at?.desktop], ['phones', at?.phone]]) {
      for (const rule of rules) {
        const p = stuckPaint(rule, sticky, presetMap, resolve);
        const fault = stuckFault(p);
        if (fault) faults.push({ bp, rule, p, fault });
      }
      if (rules.length === 1 && rules[0] === 'new' && !faults.length && stuckFault(stuckPaint('old', sticky, presetMap, resolve))) {
        onlyNew = true;
      }
    }
    const cardDesc = !preset ? `card design #${id} (does not exist)`
      : `card design #${id} "${preset.title}"${at ? '' : ' (switched off, compiles nothing)'}`;
    if (!faults.length) {
      if (onlyNew) {
        notes.push(
          `${d.label}: the stuck header is opaque only because plugin 1.2.766+ lets the sticky style win.\n` +
          `    A header design last SAVED before this store reached 1.2.766 still compiles the older rule, where\n` +
          `    ${cardDesc} wins while stuck, and it is not opaque. If this store was upgraded rather than\n` +
          '    built on this version, save the header design once: any write to it recompiles it.'
        );
      }
      continue;
    }
    const where = [...new Set(faults.map((f) => f.bp))].join(' and on ');
    const reasons = [...new Set(faults.map((f) => `${ruleText[f.rule]}: ${stuckCause(f, cardDesc)}`))];
    problems.push(
      `${d.label}: the header is sticky, and once it sticks the bar is not opaque on ${where}.\n` +
      reasons.map((r) => `        · ${r}`).join('\n') + '\n' +
      `        main_header_sticky_style: ${stickyCss.trim() ? `\`${stickyCss.trim()}\`` : '(empty)'}\n` +
      `        ${cardDesc}: css_default \`${preset?.css_default || '—'}\`, css_mobile \`${preset?.css_mobile || '—'}\`\n` +
      (version ? '' : '      /me did not report the plugin version, so both rules were applied.\n') +
      '      The page scrolls visibly through a see-through stuck header, and nothing at rest shows it.\n' +
      '      Give `main_header_sticky_style` an opaque background-color (the page surface looks the same at\n' +
      '      rest), keep force_styles off on the card design, and on a plugin older than 1.2.766 give the\n' +
      '      card design itself an opaque background equal to the page surface instead of `transparent`.'
    );
  }
  return { checked, problems, notes };
}

/**
 * 7 — THE FLUSH BAND. For every design the store uses and every `*_container_preset` it sets: when
 * that card design paints a background the page does not have, it needs side padding of its own, at
 * each breakpoint. The same rule `codbrand-content-builder` applies to a page block, in its words.
 *
 * A container whose own `<block>_is_active` is "no" is not rendered and is skipped. The comparison
 * is with the page, which is the right answer for the header, footer and topbar and an approximation
 * for a container nested inside a drawer, whose own background it sits on.
 */
async function checkBands(designs, presetsById, resolve, pageBackgrounds) {
  const found = new Map();
  const undecided = [];
  let checked = 0;
  let pages = null;
  for (const d of designs) {
    for (const [key, raw] of Object.entries(d.settings)) {
      if (!key.endsWith('_container_preset')) continue;
      const id = Number(raw);
      if (!(id > 0)) continue;
      const block = key.slice(0, -'_container_preset'.length);
      if (String(d.settings[`${block}_is_active`] ?? '') === 'no') continue;
      const preset = presetsById.get(String(id));
      if (!preset || preset.type !== 'cards') continue;
      const at = presetAt(preset);
      if (!at) continue;
      checked++;
      for (const [bp, map] of [['desktop', at.desktop], ['phones (under 767px)', at.phone]]) {
        if (!(isZeroLength(map.get('padding-left')?.value) && isZeroLength(map.get('padding-right')?.value))) continue;
        const paint = paintOf(map, resolve);
        if (paint.none) continue;
        const use = `${d.label} ${key}`;
        if (paint.unresolved) {
          undecided.push(`${use}: card design #${id} paints ${paint.text} with no side padding on ${bp}, and ${paint.unresolved}`);
          continue;
        }
        let pageColour = null;
        if (paint.colour) {
          if (!pages) pages = await pageBackgrounds();
          pageColour = (d.type === 'product' && pages.product) ? pages.product : pages.store;
          if (!pageColour || pageColour.unresolved) {
            undecided.push(`${use}: card design #${id} paints ${describe(paint.colour)} with no side padding on ${bp}, ` +
              `and the page it sits on could not be read — ${pageColour?.unresolved ?? 'no page background'}`);
            continue;
          }
          if (!differs(paint.colour, pageColour)) continue;
        }
        const k = `${id}|${bp}|${pageColour ? hexOf(pageColour) : 'image'}`;
        if (!found.has(k)) found.set(k, { preset, bp, paint, pageColour, uses: [] });
        found.get(k).uses.push(use);
      }
    }
  }
  const problems = [...found.values()].map((f) => {
    const paints = f.paint.colour ? describe(f.paint.colour) : `an image (${f.paint.text})`;
    const page = f.pageColour ? ` that differs from the page (${describe(f.pageColour)})` : '';
    return `card design #${f.preset.id} "${f.preset.title}" paints a background (${paints})${page}, but sets no horizontal\n` +
      `      padding on ${f.bp}: css_default \`${f.preset.css_default || '—'}\`, css_mobile \`${f.preset.css_mobile || '—'}\`.\n` +
      `      Used by: ${f.uses.join(', ')}\n` +
      '      The text will sit exactly ON the band\'s visible edge, both sides. The page width mode does NOT\n' +
      '      rescue this -- it insets the block INCLUDING its background, so the gap between the edge and\n' +
      '      the text stays 0 at every width mode. Pad the card design at that breakpoint: css_default for\n' +
      '      desktop, css_mobile for phones, which wins there for every property it declares. Check its\n' +
      '      used_count first, and if the band should blend into the page, make it transparent instead.\n' +
      '      See api-recipes.md → "A coloured band needs its own side padding, on phones too".';
  });
  if (undecided.length) {
    problems.push(
      `${undecided.length} unpadded card design(s) could not be judged, so the band check did NOT finish:\n` +
      undecided.slice(0, 8).map((u) => `        ${u}`).join('\n') + (undecided.length > 8 ? '\n        ...' : '') + '\n' +
      '      A band this check cannot read is not a band it passed. Resolve the colour, or pad the card design.'
    );
  }
  return { checked, problems };
}

/* The script each language is written in, by language subtag — for the right-to-left languages the
 * plugin itself recognises, and ONLY those: every one of them is written in a single script, so the
 * answer is not in doubt, and Latin copy on those stores is untranslated rather than a style choice.
 * Anything else is either Latin-script or not claimed, and the check says so instead of guessing. */
const SCRIPT_OF_LANGUAGE = {
  ar: 'Arabic', ary: 'Arabic', arq: 'Arabic', azb: 'Arabic', ckb: 'Arabic', fa: 'Arabic',
  haz: 'Arabic', ps: 'Arabic', skr: 'Arabic', snd: 'Arabic', ug: 'Arabic', ur: 'Arabic',
  he: 'Hebrew', yi: 'Hebrew', dv: 'Thaana',
};

/* Names shoppers read in Latin letters in any language: the platforms the plugin itself links to.
 * The store's own name is added at run time. Nothing else is excused. */
const PLATFORM_NAMES = ['WhatsApp', 'Instagram', 'Facebook', 'Messenger', 'TikTok', 'Snapchat', 'YouTube',
  'Telegram', 'Pinterest', 'LinkedIn', 'Google'];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The part of a setting a shopper reads as words: no @tokens, markup, entities, URLs, emails or names. */
function shopperWords(value, names) {
  let s = String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;|&#x?[0-9a-f]+;/gi, ' ')
    .replace(/https?:\/\/\S+|www\.\S+/gi, ' ')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, ' ')
    .replace(/@[a-z_][a-z0-9_]*/gi, ' ');
  for (const n of names) s = s.replace(new RegExp(escapeRe(n), 'gi'), ' ');
  return s;
}

/**
 * 8 — THE UNTRANSLATED LABEL. On a store written in a non-Latin script this check can name, every
 * setting `settings_schema` marks `translatable` must carry that script, or carry no Latin word at all.
 *
 * Driven by the schema's own flag, never by guessing which values look like copy. The schema does NOT
 * say what a key shipped with (verified 21-09-2026), so "still at the English default" cannot be
 * tested — which is why a Latin-script store is not checked at all rather than checked badly.
 * A Latin word is three letters or more in a row, so `cm`, `kg` and a lone initial pass.
 */
function checkShopperScript(store, designs) {
  const code = String(store?.langue_code ?? '').trim();
  const lang = code.toLowerCase().split(/[_-]/)[0];
  const script = SCRIPT_OF_LANGUAGE[lang];
  if (!script) {
    return {
      skipped: code
        ? `this check covers stores written in the Arabic, Hebrew or Thaana script only, and \`${code}\` is not one of them — `
          + 'it cannot tell an untranslated word from a correct one in a Latin script. Compare each `translatable` value '
          + 'with the language you wrote yourself.'
        : 'the store row carries no `langue_code`, so the store\'s script is unknown and untranslated copy was not checked.',
    };
  }
  const own = new RegExp(`\\p{Script=${script}}`, 'u');
  const latinWord = /\p{Script=Latin}{3,}/u;
  const names = [store?.title, store?.site_title].filter((n) => typeof n === 'string' && n.trim()).map((n) => n.trim())
    .concat(PLATFORM_NAMES);
  const flagged = [];
  let scanned = 0;
  for (const d of designs) {
    for (const [key, spec] of Object.entries(d.schema ?? {})) {
      if (!spec || spec.translatable !== true) continue;
      const value = d.settings[key];
      if (typeof value !== 'string' || !value.trim() || asArray(value)) continue;
      scanned++;
      const words = shopperWords(value, names);
      if (latinWord.test(words) && !own.test(words)) flagged.push({ design: d.label, key, value });
    }
  }
  return { script, code, scanned, flagged };
}

const yes = (v) => String(v ?? '') === 'yes';

/**
 * One setting on every design of a type the store uses. `on` when any of them shows the feature;
 * a `gate` is a sibling switch the setting only matters under ([key, value]). A key the design does
 * not carry is reported as MISSING — the map below is stale for this install, and says so.
 */
function probe(ctx, type, key, test = yes, gate = null) {
  const r = { on: false, seen: [], missing: [], designs: 0 };
  for (const d of ctx.designsOf(type)) {
    r.designs++;
    const s = d.settings;
    if (!(key in s)) { r.missing.push(`${d.label}.${key}`); continue; }
    if (gate && !(gate[0] in s)) { r.missing.push(`${d.label}.${gate[0]}`); continue; }
    const live = !gate || String(s[gate[0]]) === gate[1];
    const shown = typeof s[key] === 'string' && s[key].length > 30 ? `${s[key].slice(0, 30)}…` : s[key];
    r.seen.push(`${d.label}.${key} = ${JSON.stringify(shown)}${live ? '' : ` (inert: ${gate[0]} = ${JSON.stringify(s[gate[0]])})`}`);
    if (live && test(s[key], s)) r.on = true;
  }
  return r;
}

/** The same, for a column on the store row. */
function storeProbe(ctx, key, test) {
  if (!(key in (ctx.store ?? {}))) return { on: false, seen: [], missing: [`stores.${key}`], designs: 1 };
  return { on: test(ctx.store[key]), seen: [`stores.${key} = ${JSON.stringify(ctx.store[key])}`], missing: [], designs: 1 };
}

/** `main` must ALL be on for the checklist row to show; any `also` surface shows the feature too. */
function combine(main, also = []) {
  const all = [...main, ...also];
  const mainOn = main.length > 0 && main.every((p) => p.on);
  return {
    main: mainOn,
    shows: mainOn || also.some((p) => p.on),
    evidence: all.flatMap((p) => p.seen),
    missing: all.flatMap((p) => p.missing),
    absent: main.filter((p) => p.designs === 0).length > 0,
  };
}

/* The search entry points; `none` is the value that hides each one. */
const SEARCH_ENTRIES = ['header_search_render', 'inline_search_bar_header_position', 'inline_search_bar_footer_position',
  'inline_search_bar_results_page_position', 'floating_button_position'];

/*
 * THE FEATURE CHECKLIST → the settings that put each feature on the storefront.
 *
 * ⚠️ The one curated map in this file, and it has a twin: references/archetypes.md → "What switches
 * each feature". Change both or neither. Every key was read in the plugin's own block configs and
 * the view that obeys it on 21-09-2026. A key this install does not carry is REPORTED as not
 * reconciled, never skipped quietly: a stale map has to say that it is stale.
 *
 * `state` answers "is it on the storefront": `main` is the surface the checklist row describes, which
 * an ON decision needs; `shows` is true when ANY surface shows it, which an OFF decision forbids.
 * `rows` is what an ON feature needs behind it. Where the block renders NOTHING without rows
 * (`gates`, verified in each view), a switch left on over zero rows is not showing anything — so an
 * OFF decision is noted there, not failed. The coupon box is the exception: it renders with no codes.
 */
const FEATURES = {
  reviews: {
    label: 'Customer reviews',
    state: (c) => combine([probe(c, 'product', 'reviews_is_active')]),
    rows: { slug: 'reviews', path: 'reviews', query: 'approved=1', what: 'approved reviews', gates: true },
  },
  qty_offers: {
    label: 'Quantity discounts',
    state: (c) => combine([probe(c, 'product', 'qty_offers_is_active')]),
    rows: { slug: 'qty_offers', path: 'qty_offers', query: 'is_active=yes', what: 'active quantity offers', gates: true },
  },
  product_variations: {
    label: 'Product options',
    /* Two switches, and either one at "no" hides every option: the product design's, and the store
     * row's own `variations_is_active`. */
    state: (c) => combine([probe(c, 'product', 'variations_is_active'), storeProbe(c, 'variations_is_active', (v) => String(v) !== 'no')]),
    rows: { products: (p) => Array.isArray(p.variations) && p.variations.length > 0, what: 'products carrying options', gates: true },
  },
  product_upsells: {
    label: 'You may also like',
    state: (c) => combine([probe(c, 'product', 'p_upsell_is_active')]),
    rows: { upsells: true, what: 'products carrying upsells', gates: true },
  },
  quickview: {
    label: 'Quick view',
    state: (c) => combine(
      [probe(c, 'plist1', 'quickview_bt_is_active')],
      [probe(c, 'product', 'p_upsell_quickview_bt_is_active', yes, ['p_upsell_is_active', 'yes']),
       probe(c, 'thankyou', 'quickview_bt_is_active', yes, ['upsell_is_active', 'yes'])],
    ),
  },
  stories: {
    label: 'Stories',
    state: (c) => combine([probe(c, 'product', 'stories_is_active')]),
    rows: { slug: 'stories', path: 'stories', query: 'is_active=yes', what: 'active stories', gates: true },
  },
  coupons: {
    label: 'Discount codes',
    state: (c) => combine([probe(c, 'cart', 'cart_coupon_is_active')]),
    rows: { slug: 'coupons', path: 'coupons', query: 'is_active=yes', what: 'active discount codes',
            empty: 'so the code box shows on the cart and checkout, and no code typed into it can work' },
  },
  stock_waitlist: {
    label: 'Back-in-stock alerts',
    state: (c) => combine([probe(c, 'product', 'stock_waitlist_is_active')]),
  },
  countdown: {
    label: 'Countdown timer',
    state: (c) => combine(
      [probe(c, 'product', 'p_countdown_is_active')],
      [probe(c, 'product', 'p_upsell_countdown_is_active', yes, ['p_upsell_is_active', 'yes']),
       probe(c, 'product', 'sticky_button_countdown_display', (v) => String(v) !== 'hide', ['sticky_button_is_active', 'yes']),
       probe(c, 'thankyou', 'upsell_countdown_is_active', yes, ['upsell_is_active', 'yes']),
       probe(c, 'topbar', 'topbar_messages', (v) => (asArray(v) ?? []).some((m) => String(m?.countdown_target ?? '').trim() !== ''))],
    ),
  },
  search: {
    label: 'Search',
    /* On only while the master switch is on AND at least one entry point is not `none`. */
    state: (c) => combine([
      probe(c, 'search', 'search_is_active'),
      probe(c, 'search', 'header_search_render', (v, s) => SEARCH_ENTRIES.some((k) => (k in s) && String(s[k]) !== 'none')),
    ]),
  },
  tracking: {
    label: 'Ad tracking',
    /* No design switch: a pixel row per platform is what turns it on, on the store's tracking design. */
    state: null,
    rows: { slug: 'tracking_pixels', path: 'tracking/pixels', query: 'is_active=yes', what: 'active pixels',
            scoped: true, empty: 'so nothing is tracked' },
  },
};

/** "on", "off", or null — accepts a trailing note ("on — 10/10 products carry sizes") and booleans. */
function decisionOf(v) {
  if (v === true || v === false) return v ? 'on' : 'off';
  const s = String(v ?? '').trim().toLowerCase();
  if (/^on\b/.test(s)) return 'on';
  if (/^off\b/.test(s)) return 'off';
  return null;
}

/** The recorded feature decisions: the applied blueprint, else the newest draft. */
async function readFeatureDecisions(call, R, storeId) {
  const path = pathFor('store_blueprint', 'store_blueprint', R);
  const ours = (rows) => rows.filter((r) => !storeId || !r.store_id || Number(r.store_id) === Number(storeId));
  const applied = await walk(call, `${path}?status=applied`);
  if (applied.error) return { error: `could not read the applied blueprint — ${applied.error}` };
  let row = ours(applied.rows)[0];
  let which = row ? `applied blueprint v${row.version}` : null;
  if (!row) {
    const drafts = await walk(call, `${path}?status=draft`);
    if (drafts.error) return { error: `could not read the draft blueprints — ${drafts.error}` };
    row = ours(drafts.rows).sort((a, b) => Number(b.version) - Number(a.version))[0];
    which = row ? `draft blueprint v${row.version} (none is applied yet)` : null;
  }
  if (!row) return { none: true };
  const one = await call(`${path}/${row.id}`);
  if (one.status !== 200) return { error: `could not read blueprint #${row.id} (HTTP ${one.status})` };
  const doc = one.body?.blueprint ?? one.body?.data?.blueprint;
  const features = doc?.decisions?.features?.value;
  if (!features || typeof features !== 'object' || Array.isArray(features)) return { which, noFeatures: true };
  return { which, features };
}

/**
 * 9 — THE UNKEPT CHECKLIST. The blueprint's `decisions.features` against the live store: an OFF
 * feature must not show anywhere, and an ON feature must show where its checklist row says — with
 * the rows it needs behind it.
 */
async function reconcileFeatures(call, R, ctx, recorded, productsRead) {
  const problems = [];
  const notes = [];
  const unknown = [];
  let reconciled = 0;
  for (const [rawKey, rawValue] of Object.entries(recorded.features)) {
    const key = String(rawKey).toLowerCase();
    if (['note', 'notes', 'why'].includes(key)) continue;
    const name = key.startsWith('tracking') ? 'tracking' : key;
    const feature = FEATURES[name];
    if (!feature) { unknown.push(rawKey); continue; }
    const decision = decisionOf(rawValue);
    if (!decision) { notes.push(`feature \`${rawKey}\` is recorded as ${JSON.stringify(rawValue)}, which is neither "on" nor "off" — not reconciled.`); continue; }

    let state = null;
    if (feature.state) {
      state = feature.state(ctx);
      if (state.missing.length) {
        notes.push(`feature \`${rawKey}\` NOT reconciled: this install has no ${state.missing.join(', ')} — the map in handover.mjs is stale here. Check it by hand.`);
        continue;
      }
      if (state.absent) {
        notes.push(`feature \`${rawKey}\` NOT reconciled: the store uses no design of the type that carries it.`);
        continue;
      }
    }

    let rows = null;
    if (feature.rows && (decision === 'on' || !feature.state || (feature.rows.gates && state.shows))) {
      rows = await rowsFor(call, R, ctx, feature.rows, productsRead);
      if (rows.error) {
        problems.push(`feature \`${rawKey}\` (${feature.label}) was NOT reconciled — could not count its ${feature.rows.what}: ${rows.error}. A check that did not run is not a pass: re-run.`);
        continue;
      }
    }
    reconciled++;
    const evidence = state ? state.evidence.join(', ') : `${rows.count} ${feature.rows.what}`;
    const emptied = !!(state && feature.rows?.gates && rows && rows.count === 0);
    const shows = state ? (state.shows && !emptied) : rows.count > 0;

    if (decision === 'off' && emptied && state.shows) {
      notes.push(`feature \`${rawKey}\` is OFF and shows nothing, but its switch is still on (${evidence}) with no ${feature.rows.what} behind it — it appears the moment one is added. Switch it off to match the checklist.`);
    }

    if (decision === 'off' && shows) {
      problems.push(
        `feature \`${rawKey}\` (${feature.label}): the blueprint records OFF, but the store shows it — ${evidence}.\n` +
        '      A merchant told a feature is off whose store shows it has been misinformed by the build. Switch it\n' +
        '      off, or record it ON if they asked for it back.'
      );
    } else if (decision === 'on' && state && !state.main) {
      problems.push(
        `feature \`${rawKey}\` (${feature.label}): the blueprint records ON, but the store does not show it — ${evidence}.\n` +
        '      The merchant saw it ticked. Switch it on, or record it OFF if they unticked it.'
      );
    } else if (decision === 'on' && rows && rows.count === 0) {
      problems.push(
        `feature \`${rawKey}\` (${feature.label}): ON${state ? ` (${evidence})` : ''}, but the store has no ${feature.rows.what}, ` +
        `${feature.rows.empty ?? 'so it renders nothing'}.\n` +
        '      A ticked feature with nothing behind it is a promise the storefront does not keep. Add them —\n' +
        '      or, if no door can, tell the merchant and record it OFF until they do.'
      );
    } else if (name === 'countdown' && decision === 'on' && !productsRead.error && !productsRead.rows.some(onTimedSale)) {
      notes.push('feature `countdown` is ON, but no product has a sale with a start AND an end date, so the timer shows nowhere yet. Tell the merchant it appears when they run a timed sale — do not invent one.');
    }
  }
  if (unknown.length) {
    notes.push(`blueprint feature(s) ${unknown.map((k) => `\`${k}\``).join(', ')} are not on the checklist this script knows, so they were NOT reconciled. Compare them by hand.`);
  }
  return { reconciled, problems, notes };
}

/** A product the countdown can render on: a sale price, with both a start and an end date. */
function onTimedSale(p) {
  return Number(p.sale_price) > 0 && String(p.sale_from ?? '').trim() !== '' && String(p.sale_to ?? '').trim() !== '';
}

/** What an ON feature needs behind it, counted. */
async function rowsFor(call, R, ctx, spec, productsRead) {
  if (spec.products) {
    if (productsRead.error) return { error: `products could not be read — ${productsRead.error}` };
    return { count: productsRead.rows.filter(spec.products).length };
  }
  if (spec.upsells) {
    if (productsRead.error) return { error: `products could not be read — ${productsRead.error}` };
    /* Upsells are read through the product that offers them, one product at a time. Stop at the
     * first product carrying any: the question is whether the feature has anything to show. */
    const path = pathFor('product_upsells', 'product/upsells', R);
    for (const p of productsRead.rows) {
      const res = await call(`${path}?product_id=${encodeURIComponent(p.id)}&per_page=1`);
      if (res.status !== 200) return { error: `product/upsells for product ${p.id} answered HTTP ${res.status}` };
      if ((listRows(res.body) ?? []).length) return { count: 1 };
    }
    return { count: 0 };
  }
  let query = spec.query;
  const instance = Number(ctx.store?.tracking_sm_id ?? 0);
  if (spec.scoped && instance > 0) query += `&tracking_instance_id=${instance}`;
  return countRows(call, `${pathFor(spec.slug, spec.path, R)}?${query}`);
}

async function main(base) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const call = async (path) => {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`${base}/${path}`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      });
      let body = null;
      try { body = await res.json(); } catch { /* status still tells us what happened */ }
      if (res.status === 429 && attempt < MAX_RETRIES) {
        const asked = Number(res.headers.get('retry-after')) || Number(body?.data?.retry_after) || 2;
        const wait = Math.min(MAX_WAIT_S, Math.max(1, asked));
        console.log(`  · rate-limited on ${path.split('?')[0]} — waiting ${wait}s, as the api asked`);
        await sleep(wait * 1000);
        continue;
      }
      return { status: res.status, body, headers: res.headers };
    }
  };

  console.log(`\nHandover check → ${base}\n`);

  const me = await call('me');
  if (me.status !== 200 || !me.body) {
    console.error(`  ✗ the API did not answer (HTTP ${me.status}). Is the site up, and the key whole?\n`);
    return 1;
  }
  const R = me.body.resources;
  const version = parseVersion(me.body.plugin_version);

  const storesRes = await call(`${pathFor('stores', 'stores', R)}?per_page=1`);
  if (storesRes.status !== 200) {
    console.error(`  ✗ could not read \`stores\` (HTTP ${storesRes.status}) — this check cannot run.`);
    console.error('    That is not a pass. Say so rather than reporting the build as verified.\n');
    return 1;
  }
  const store = firstRow(storesRes.body);
  const designRefs = designsFrom(store);

  if (!designRefs.length) {
    console.error('  ✗ no designs found on the store row — this check cannot run, so nothing is verified.\n');
    return 1;
  }
  line(true, `read the store and ${designRefs.length} design(s) it uses`);

  const problems = [];
  const passed = [];
  const notes = [];
  const designs = [];
  const unreadable = [];

  const gsPath = pathFor('section_manager_global_settings', 'section_manager/global_settings', R);
  let hollow = 0;
  for (const [type, id] of designRefs) {
    const res = await call(`${gsPath}/${type}/${id}`);
    if (res.status !== 200) { unreadable.push(`${type}/${id} (HTTP ${res.status})`); continue; }
    const settings = res.body?.settings ?? res.body?.data?.settings;
    if (!settings || typeof settings !== 'object') { unreadable.push(`${type}/${id} (no settings)`); continue; }
    const schema = res.body?.settings_schema ?? res.body?.data?.settings_schema ?? {};
    designs.push({ label: `${type}/${id}`, type, id, settings, schema });

    for (const h of hollowIn(settings)) {
      hollow++;
      problems.push(
        `${type}/${id}: \`${h.toggle}\` is "yes" but \`${h.list}\` is empty.\n` +
        '      Nothing renders, and the view returns before its own heading — so the page shows a gap,\n' +
        '      not a mistake. Fill it, or set the toggle to "no" as a deliberate decision.'
      );
    }
  }
  if (!hollow && designs.length) passed.push('nothing switched on and empty');
  const settingsByDesign = new Map(designs.map((d) => [d.label, d.settings]));

  /* ── dangling icon ids: invisible at runtime, so this is the only place they can be caught ──── */
  const icons = await checkIcons(call, R, settingsByDesign);
  if (icons.skipped) {
    line(false, `${icons.skipped} — icon ids NOT checked, and not passed`);
    // Counted, not just printed: without this the run still ended "✓ … icons resolve" and exit 0
    // after saying the icons were never read (a rate-limited build, 20-09-2026).
    problems.push(`icon ids were NOT checked — ${icons.skipped}. A check that did not run is not a pass: re-run.`);
  } else if (icons.dangling.length) {
    problems.push(
      `${icons.dangling.length} icon id(s) point at an icon that does not exist:\n` +
      icons.dangling.map((d) => `        ${d.design}.${d.key} = ${d.id}`).join('\n') + '\n' +
      '      `getIconCode()` returns null for an unknown id — no fallback, no log. The control\n' +
      '      renders with no icon and nothing reports it. Resolve icons BY NAME through\n' +
      '      design_controls/icons_manager and use the id it returns; never write a literal.'
    );
  } else if (icons.mismatched.length) {
    for (const m of icons.mismatched) {
      problems.push(
        `${m.design}: an open/close icon pair that does not belong together:\n` +
        `        ${m.key} = ${m.open.id} "${m.open.name}"\n` +
        `        ${m.closeKey} = ${m.close.id} "${m.close.name}"\n` +
        '      Both ids resolve, so nothing else catches this. Known pairs: ' +
        Object.entries(icons.pairs).map(([a, b]) => `${a}/${b}`).join(', ') + '.\n' +
        '      Resolve icons BY NAME through design_controls/icons_manager.'
      );
    }
  } else {
    line(true, `every icon id resolves and every open/close pair belongs together (${icons.count} icons)`);
    passed.push('icons resolve');
  }

  /* ── the catalogue's photography ─────────────────────────────────────────────── */
  const productsRead = await walk(call, pathFor('products', 'products', R));
  const imgs = await checkImages(call, R, productsRead);
  if (imgs.skipped) {
    line(false, `${imgs.skipped} — images NOT checked, and not passed`);
    problems.push(`catalogue images were NOT checked — ${imgs.skipped}. A check that did not run is not a pass: re-run.`);
  } else {
    problems.push(...imgs.problems);
    if (!imgs.problems.length) {
      line(true, `catalogue images consistent (${imgs.counted.products} products, ${imgs.counted.images} images, ` +
        `${imgs.counted.library} in the media library)`);
      passed.push('photography is consistent');
    }
    if (imgs.undetermined && imgs.undetermined.length) {
      line(false, `${imgs.undetermined.length} image(s) UNDETERMINED — dimensions unreadable, so not verified: `
        + imgs.undetermined.slice(0, 5).join(', '));
    }
  }

  /* ── the logo, which is two writes and fails silently when it is one ─────────────────────────── */
  const siteLogo = isSet(store?.site_logo_id);
  let designLogo = false;
  const designLogoIn = [];
  for (const [design, settings] of settingsByDesign) {
    for (const [k, v] of Object.entries(settings)) {
      if (/logo/.test(k) && /(_url|_id)$/.test(k) && isSet(v)) { designLogo = true; designLogoIn.push(`${design}.${k}`); }
    }
  }

  if (siteLogo && designLogo) {
    line(true, 'logo set in both places');
    passed.push('the logo is whole');
  } else if (!siteLogo && !designLogo) {
    /* A genuine decision — some brands are a wordmark. It still has to be a DECISION. */
    if (String(wordmarkReason ?? '').trim().length >= MIN_REASON) {
      line(true, `no logo image, declared intentional: "${String(wordmarkReason).trim()}"`);
      console.log('    → then the wordmark is the brand mark. Its typography is the header design\'s');
      console.log('      `logo_text_preset` (a typography preset, default 204 "Small Title"): pick or');
      console.log('      clone one through design_controls/presets. See api-recipes.md → "The header".');
      passed.push('the wordmark is a declared decision');
    } else {
      problems.push(
        'no logo anywhere — neither `site_logo_id` nor any design\'s logo field is set.\n' +
        '      The header falls back to a text wordmark. That is a legitimate choice and NOT a\n' +
        '      legitimate accident, so say which it is:\n' +
        `        --wordmark-intended "<why, at least ${MIN_REASON} characters>"`
      );
    }
  } else {
    /* Half-set. No typed reason clears this one: it is not a decision anyone would make on purpose. */
    problems.push(
      'LOGO HALF-STATE — set in one place and not the other, so one of them renders nothing:\n' +
      `        site_logo_id (on \`stores\`) : ${siteLogo ? 'set' : 'NOT SET'}\n` +
      `        the design's logo fields   : ${designLogo ? `set (${designLogoIn.join(', ')})` : 'NOT SET'}\n` +
      '      A logo is two writes. `--wordmark-intended` does not excuse this — it covers having no\n' +
      '      logo at all, not having half of one. See api-recipes.md → "The header".'
    );
  }

  /* ── the card designs: the header's height and stuck state, and every coloured band ─────────── */
  const presetsRead = await walk(call, pathFor('design_controls_presets', 'design_controls/presets', R));
  if (presetsRead.error) {
    line(false, `could not read the card designs (design_controls/presets) — ${presetsRead.error}`);
    problems.push(`the header and band checks were NOT run: the card designs could not be read — ${presetsRead.error}. A check that did not run is not a pass: re-run.`);
  } else {
    const presetsById = new Map(presetsRead.rows.map((p) => [String(p.id), p]));
    const paletteRead = await walk(call, pathFor('design_controls_color_palette', 'design_controls/color_palette', R));
    const resolve = colourResolver(paletteRead.error ? null : paletteRead.rows);
    const headers = designs.filter((d) => d.type === 'header');

    const headerSpace = checkHeaderVerticalSpace(headers, presetsById);
    problems.push(...headerSpace.problems);
    if (headerSpace.checked && !headerSpace.problems.length) {
      line(true, `the header has vertical space on desktop and on phones (${headerSpace.checked} checked)`);
      passed.push('the header has vertical space');
    }

    const sticky = checkStickyHeaders(headers, presetsById, resolve, version);
    problems.push(...sticky.problems);
    notes.push(...sticky.notes);
    if (sticky.checked && !sticky.problems.length) {
      line(true, `the stuck header is opaque on desktop and on phones (${sticky.checked} checked, ` +
        `${version ? `plugin ${version.join('.')}` : 'plugin version unknown, both cascade rules applied'})`);
      passed.push('the stuck header is opaque');
    }

    /* Read only when an unpadded band needs a page to compare with — so a store with none never
     * depends on store_settings being readable. */
    const pageBackgrounds = () => readPageBackgrounds(call, R, resolve, designs);
    const bands = await checkBands(designs, presetsById, resolve, pageBackgrounds);
    problems.push(...bands.problems);
    if (!bands.problems.length) {
      line(true, `every coloured band has side padding on desktop and on phones (${bands.checked} card design use(s) checked)`);
      passed.push('every coloured band has side padding');
    }
  }

  /* ── shopper copy still in Latin letters on a store written in another script ──────────────── */
  const script = checkShopperScript(store, designs);
  if (script.skipped) {
    notes.push(`untranslated copy NOT checked — ${script.skipped}`);
  } else if (script.flagged.length) {
    const shown = script.flagged.slice(0, 25);
    problems.push(
      `${script.flagged.length} translatable setting(s) are still in Latin letters on ${/^[AEIOU]/.test(script.script) ? 'an' : 'a'} ` +
      `${script.script}-script store ` +
      `(langue_code \`${script.code}\`):\n` +
      shown.map((f) => `        ${f.design.padEnd(14)} ${f.key.padEnd(38)} ${JSON.stringify(f.value.length > 60 ? `${f.value.slice(0, 60)}…` : f.value)}`).join('\n') +
      (script.flagged.length > shown.length ? `\n        ... and ${script.flagged.length - shown.length} more` : '') + '\n' +
      '      settings_schema marks these `translatable`: shopper copy, visible now or the day its block is\n' +
      '      switched on. Write them in the store\'s language through section_manager/global_settings.\n' +
      '      Excused on purpose: @tokens, numbers, markup, URLs, emails, the store\'s own name and platform\n' +
      '      names such as WhatsApp. Never report the storefront as translated while any remain.'
    );
  } else {
    line(true, `every translatable setting is in ${script.script} script (${script.scanned} checked)`);
    passed.push(`shopper copy is in ${script.script} script`);
  }
  if (!script.skipped) {
    notes.push('outside this check, read by hand: repeater rows (topbar messages, footer contact and social rows), ' +
      'resource rows (variation titles, options and error text, quantity-offer tiers, custom block placement titles, ' +
      'checkout field labels, shipping rate names), and the strings baked into the plugin.');
  }

  /* ── the feature checklist, against the store it describes ───────────────────────────────────── */
  const recorded = await readFeatureDecisions(call, R, store?.id);
  if (recorded.error) {
    line(false, `feature checklist NOT reconciled — ${recorded.error}`);
    problems.push(`the feature checklist was NOT reconciled — ${recorded.error}. A check that did not run is not a pass: re-run.`);
  } else if (recorded.none) {
    notes.push('no blueprint is recorded on this store, so the feature checklist was NOT reconciled. A store this skill built ' +
      'records one (SKILL.md → "Recording it"); on any other store, compare the features by hand.');
  } else if (recorded.noFeatures) {
    problems.push(
      `the ${recorded.which} records no feature checklist (\`decisions.features\`), so nothing says which features the\n` +
      '      merchant kept. Write the checklist as they left it — every key, on and off (blueprint-format.md →\n' +
      '      "features") — and re-run.'
    );
  } else {
    const byType = (type) => designs.filter((d) => d.type === type);
    const features = await reconcileFeatures(call, R, { designsOf: byType, store }, recorded, productsRead);
    problems.push(...features.problems);
    notes.push(...features.notes);
    // Zero reconciled is not a match: every key was unknown, unreadable or unmapped, and the notes say which.
    if (!features.problems.length && features.reconciled) {
      line(true, `the feature checklist matches the store (${features.reconciled} feature(s), ${recorded.which})`);
      passed.push('the feature checklist matches the store');
    }
  }

  if (unreadable.length) {
    console.log('');
    for (const u of unreadable) line(false, `could not read ${u} — NOT checked, and not passed`);
    problems.push(`${unreadable.length} design(s) could not be read, so they were NOT checked: ${unreadable.join(', ')}. Re-run.`);
  }

  if (notes.length) {
    console.log('');
    for (const n of notes) note(n);
  }

  console.log('');
  if (problems.length) {
    console.log('NOT READY TO HAND OVER:\n');
    for (const p of problems) console.log(`  ✗ ${p}\n`);
    console.log('  These are the failures a screenshot and a 200 both miss. Fix them, then re-run.\n');
    return 1;
  }

  // ONLY what ran and passed. A check that could not apply to this store is a `!` line above, never
  // a word in this sentence.
  line(true, passed.join('; '));
  // THE REPLACE-LIST. Since 20-09-2026 a store is built in full out of PLACEHOLDER content, so
  // "passes every check" and "ready for customers" stopped being the same sentence. The script
  // cannot compute this -- it has no way to tell an invented product from a real one -- so it
  // DEMANDS it rather than half-guessing it. Writing it is the last step of the build.
  console.log('\n  NOW WRITE THE REPLACE-LIST. This store is built from placeholder content and it');
  console.log('  looks finished. Name every piece that is not theirs yet, where it is, and tell');
  console.log('  them they can simply ask you to change it:\n');
  console.log('      - the reviews        how many, and on which products');
  console.log('      - the product photos generated, not photographs of their products');
  console.log('      - contact details    phone, email, address, social links');
  console.log('      - policy values      return window, delivery time, shipping cost');
  console.log('      - anything else you invented rather than found\n');
  console.log('  A merchant who never reads it ships placeholders as real. Do not shorten it to');
  console.log('  "review the content" -- name the items.\n');

  console.log('  That is everything a script can tell you. Now open the store and judge what it');
  console.log('  cannot: is the topbar copy theirs or the shipped line, and does it read as one brand?\n');
  return 0;
}

if (!rawUrl || !apiKey) {
  console.error('usage: node handover.mjs <site-url> <api-key> [--wordmark-intended "reason"]');
  process.exitCode = 1;
} else {
  const base = rawUrl.replace(/\/+$/, '').replace(/\/wp-json.*$/, '') + '/wp-json/cl-api/v1';
  main(base)
    .then((code) => { process.exitCode = code; })
    .catch((err) => {
      console.error(`\n  ✗ could not reach the site: ${err.message}\n`);
      process.exitCode = 1;
    });
}

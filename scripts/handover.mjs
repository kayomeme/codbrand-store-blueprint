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
 * The two failures it does catch are the two that survive a screenshot AND a `200`:
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
 * WHY THE HOLLOW CHECK CARRIES NO LIST OF FOOTER KEYS. This skill ships to merchants and cannot be
 * hot-fixed, so a curated key list is a fact that rots on a machine nobody can reach. Instead the
 * check tests a SHAPE — `<prefix>_is_active` is "yes" and a sibling under `<prefix>` is an empty
 * array — which is a naming convention, evaluated against whatever the install actually returns. It
 * therefore keeps working when the plugin adds a surface, and it fails OPEN (finds nothing) rather
 * than falsely blocking a build if the convention ever changes. For a gate, that is the safe
 * direction: a missed warning costs a re-run, a false block costs the merchant's trust.
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
 * wordmark, there is no store for which "one photo per product" is a considered decision. */
const MIN_GALLERY = 4;

/* Aspect ratios within this fraction of each other count as the same ratio. Generation rounds to
 * whole pixels, so 1200x1600 and 1201x1600 are the same intent and must not be reported as drift. */
const RATIO_TOLERANCE = 0.02;

/* How much of an image to pull when reading its dimensions. A JPEG's SOF marker sits after any EXIF
 * and any embedded colour profile, which can be large; 128 KiB clears every real product photo while
 * keeping a 100-product sweep cheap. If the marker is past it the row is reported UNDETERMINED —
 * never silently treated as a match. */
const HEADER_BYTES = 131072;

const line = (ok, text) => console.log(`  ${ok ? '✓' : '✗'} ${text}`);

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

/**
 * Which designs does this store actually use? DISCOVERED from the store row, never assumed:
 *   `<surface>_layout_config` → { default: { type: 'sm', id } }   (topbar / header / footer)
 *   `<type>_sm_id`            → an integer id                     (everything else)
 * Reading it this way means a surface the plugin adds later is checked without editing this file.
 */
function designsFrom(store) {
  const out = new Map();
  for (const [key, value] of Object.entries(store ?? {})) {
    if (key.endsWith('_layout_config')) {
      const surface = key.slice(0, -'_layout_config'.length);
      let cfg = value;
      if (typeof cfg === 'string') { try { cfg = JSON.parse(cfg); } catch { cfg = null; } }
      const d = cfg?.default;
      if (d && d.type === 'sm' && Number(d.id) > 0) out.set(surface, Number(d.id));
    } else if (key.endsWith('_sm_id') && Number(value) > 0) {
      out.set(key.slice(0, -'_sm_id'.length), Number(value));
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
 * fetched ONCE and matched as a set; ids are compared as strings because the settings store them as
 * strings and the API returns them as strings, and `'17' !== 17` would silently pass everything.
 */
async function checkIcons(call, R, settingsByType) {
  const iconPath = pathFor('design_controls_icons_manager', 'design_controls/icons_manager', R);
  const res = await call(`${iconPath}?per_page=200`);
  if (res.status !== 200) {
    return { skipped: `could not read the icons library (HTTP ${res.status})`, dangling: [] };
  }
  const rows = Array.isArray(res.body) ? res.body : (res.body?.items ?? res.body?.data ?? []);
  const known = new Map(rows.map((r) => [String(r.id), r.name]));

  const dangling = [];
  const byType = new Map();
  for (const [type, settings] of settingsByType) {
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
      if (!known.has(id)) { dangling.push({ type, key: k, id }); continue; }
      if (!byType.has(type)) byType.set(type, new Map());
      byType.get(type).set(k, { id, name: known.get(id) });
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
  for (const [type, keys] of byType) {
    for (const [key, open] of keys) {
      if (!/(^|_)open(_|$)/.test(key)) continue;
      const closeKey = key.replace(/(^|_)open(_|$)/, '$1close$2');
      const close = keys.get(closeKey);
      if (!close) continue;
      if (PAIRS[open.name] === close.name) continue;
      mismatched.push({ type, key, closeKey, open, close });
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
async function checkImages(call, R) {
  const prodPath = pathFor('products', 'products', R);
  const res = await call(`${prodPath}?per_page=100`);
  if (res.status !== 200) {
    return { skipped: `could not read products (HTTP ${res.status})`, problems: [] };
  }
  const products = Array.isArray(res.body) ? res.body : (res.body?.items ?? res.body?.data ?? []);
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
     entry, and the media library is the cheapest place to learn mime and url. */
  const mediaPath = pathFor('media', 'media', R);
  const mediaRes = await call(`${mediaPath}?per_page=200`);
  const mediaRows = mediaRes.status === 200
    ? (Array.isArray(mediaRes.body) ? mediaRes.body : (mediaRes.body?.items ?? mediaRes.body?.data ?? []))
    : [];
  const byId = new Map(mediaRows.map((m) => [String(m.id), m]));

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
    counted: { products: products.length, images: ids.size, measured: sizes.length },
  };
}

async function main(base) {
  const call = async (path) => {
    const res = await fetch(`${base}/${path}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    });
    let body = null;
    try { body = await res.json(); } catch { /* status still tells us what happened */ }
    return { status: res.status, body };
  };

  console.log(`\nHandover check → ${base}\n`);

  const me = await call('me');
  if (me.status !== 200 || !me.body) {
    console.error(`  ✗ the API did not answer (HTTP ${me.status}). Is the site up, and the key whole?\n`);
    return 1;
  }
  const R = me.body.resources;

  const storesRes = await call(`${pathFor('stores', 'stores', R)}?per_page=1`);
  if (storesRes.status !== 200) {
    console.error(`  ✗ could not read \`stores\` (HTTP ${storesRes.status}) — this check cannot run.`);
    console.error('    That is not a pass. Say so rather than reporting the build as verified.\n');
    return 1;
  }
  const store = firstRow(storesRes.body);
  const designs = designsFrom(store);

  if (!designs.size) {
    console.error('  ✗ no designs found on the store row — this check cannot run, so nothing is verified.\n');
    return 1;
  }
  line(true, `read the store and ${designs.size} design(s) it uses`);

  const problems = [];
  const settingsByType = new Map();
  const unreadable = [];

  const gsPath = pathFor('section_manager_global_settings', 'section_manager/global_settings', R);
  for (const [type, id] of designs) {
    const res = await call(`${gsPath}/${type}/${id}`);
    if (res.status !== 200) { unreadable.push(`${type}/${id} (HTTP ${res.status})`); continue; }
    const settings = res.body?.settings ?? res.body?.data?.settings;
    if (!settings || typeof settings !== 'object') { unreadable.push(`${type}/${id} (no settings)`); continue; }
    settingsByType.set(type, settings);

    for (const h of hollowIn(settings)) {
      problems.push(
        `${type}/${id}: \`${h.toggle}\` is "yes" but \`${h.list}\` is empty.\n` +
        '      Nothing renders, and the view returns before its own heading — so the page shows a gap,\n' +
        '      not a mistake. Fill it, or set the toggle to "no" as a deliberate decision.'
      );
    }
  }

  /* ── dangling icon ids: invisible at runtime, so this is the only place they can be caught ──── */
  const icons = await checkIcons(call, R, settingsByType);
  if (icons.skipped) {
    line(false, `${icons.skipped} — icon ids NOT checked, and not passed`);
  } else if (icons.dangling.length) {
    problems.push(
      `${icons.dangling.length} icon id(s) point at an icon that does not exist:\n` +
      icons.dangling.map((d) => `        ${d.type}.${d.key} = ${d.id}`).join('\n') + '\n' +
      '      `getIconCode()` returns null for an unknown id — no fallback, no log. The control\n' +
      '      renders with no icon and nothing reports it. Resolve icons BY NAME through\n' +
      '      design_controls/icons_manager and use the id it returns; never write a literal.'
    );
  } else if (icons.mismatched.length) {
    for (const m of icons.mismatched) {
      problems.push(
        `${m.type}: an open/close icon pair that does not belong together:\n` +
        `        ${m.key} = ${m.open.id} "${m.open.name}"\n` +
        `        ${m.closeKey} = ${m.close.id} "${m.close.name}"\n` +
        '      Both ids resolve, so nothing else catches this. Known pairs: ' +
        Object.entries(icons.pairs).map(([a, b]) => `${a}/${b}`).join(', ') + '.\n' +
        '      Resolve icons BY NAME through design_controls/icons_manager.'
      );
    }
  } else {
    line(true, `every icon id resolves and every open/close pair belongs together (${icons.count} icons)`);
  }

  /* ── the catalogue's photography ─────────────────────────────────────────────── */
  const imgs = await checkImages(call, R);
  if (imgs.skipped) {
    line(false, `${imgs.skipped} — images NOT checked, and not passed`);
  } else {
    problems.push(...imgs.problems);
    if (!imgs.problems.length) {
      line(true, `catalogue images consistent (${imgs.counted.products} products, ${imgs.counted.images} images)`);
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
  for (const [type, settings] of settingsByType) {
    for (const [k, v] of Object.entries(settings)) {
      if (/logo/.test(k) && /(_url|_id)$/.test(k) && isSet(v)) { designLogo = true; designLogoIn.push(`${type}.${k}`); }
    }
  }

  if (siteLogo && designLogo) {
    line(true, 'logo set in both places');
  } else if (!siteLogo && !designLogo) {
    /* A genuine decision — some brands are a wordmark. It still has to be a DECISION. */
    if (String(wordmarkReason ?? '').trim().length >= MIN_REASON) {
      line(true, `no logo image, declared intentional: "${String(wordmarkReason).trim()}"`);
      console.log('    → then the wordmark is the brand mark. Its typography is the header design\'s');
      console.log('      `logo_text_preset` (a typography preset, default 204 "Small Title"): pick or');
      console.log('      clone one through design_controls/presets. See api-recipes.md → "The header".');
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

  if (unreadable.length) {
    console.log('');
    for (const u of unreadable) line(false, `could not read ${u} — NOT checked, and not passed`);
  }

  console.log('');
  if (problems.length) {
    console.log('NOT READY TO HAND OVER:\n');
    for (const p of problems) console.log(`  ✗ ${p}\n`);
    console.log('  These are the failures a screenshot and a 200 both miss. Fix them, then re-run.\n');
    return 1;
  }

  line(true, 'nothing switched on and empty; the logo is whole; icons resolve; photography is consistent');
  console.log('\n  That is everything a script can tell you. Now open the store and judge what it');
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

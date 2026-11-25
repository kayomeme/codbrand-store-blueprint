#!/usr/bin/env node
/**
 * handover.mjs — is the store actually finished, or does it only look finished?
 *
 *   node handover.mjs <site-url> <api-key> [--wordmark-intended "why there is no logo image"]
 *                     [--block-kept <custom-block-id> "why this build did not write it"] …
 *                     [--floating-bar "why the merchant wants a header bar only as wide as its content"]
 *                     [--utc-intended "why the store's customers keep UTC"]
 *                     --joins <the live check's folder: live-check.mjs's results, or joins.js results saved by hand>
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
 *   1. THE LOGO HALF-STATE. A logo is two writes for two things — the header design's own fields draw the
 *      header, and `site_logo_id` on `stores` is the brand image search engines and shared links show (it
 *      draws nothing in the header). A header image with no `site_logo_id` shares no picture; a text
 *      wordmark must be declared, and still wants `site_logo_id` when pages have no image of their own.
 *
 *   2. THE HOLLOW ELEMENT. An element switched ON whose list is EMPTY. The view returns *before* it
 *      prints its own heading, so there is no dangling "Contact us", no error, and no gap in the
 *      markup — just space where a column should be. The footer ships this way deliberately now, so
 *      "leave it alone" produces a hollow footer rather than a defaulted one. Listing cards switched to
 *      show product options with no option type named show none the same way.
 *
 *   3. THE DANGLING ICON. An `*_icon_id` pointing at an icon that does not exist.
 *      `IconsManagerSelectorFR_cl::getIconCode()` returns `null` for an unknown id — no fallback, no
 *      log, no error. The control simply renders without its icon, and nothing anywhere says so.
 *      Found live on the plugin's own demo store: a cart edit button pointed at icon 17, which does
 *      not exist, while the shipped default was 57 `edit`. It had been that way since the build.
 *      An EMPTY toggle icon falls back to the store row's own open/close pair, so that pair is
 *      checked too, and an empty toggle over an empty pair renders no mark at all.
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
 *      zeroes the bar's padding for it. Each side is judged by its own layout and height: phones can
 *      have their own (`main_header_layout_mobile`, a phone height), and the plugin compiles each side
 *      apart. The bar's own padding counts before its card design's.
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
 *      ON, and options ticked ON had no rows behind them. Measured on the same build. A sales feature
 *      ON must also show its GOAL — an upsell with a title and a saving, quantity offers with a saving
 *      — on the products the merchant meant, not on one product of twenty.
 *
 *  10. THE MISSING WHATSAPP BUTTON. Switched on with no number, the floating button renders nothing
 *      at all, and the number ships empty. (Before plugin 1.2.799 it was also invisible with no image;
 *      it now falls back to the icon library's WhatsApp icon.)
 *
 *  11. THE STORE ONLY ITS OWNER CAN SEE. A host's coming-soon page answers a logged-out visitor with
 *      its own page while the api keeps working, so every check above can pass for a store customers
 *      cannot open. Reported to be told first, not as a failure: it is a host setting, and possibly
 *      deliberate before a launch.
 *
 *  12. THE SILENT REVERSAL. A decision recorded as reversed must say what it was, why and when — a
 *      reversal with no reason reads like a mistake on the next run. (Checked only where the blueprint
 *      records it; see checkReversals().)
 *
 *  14. THE SITE SEARCH ENGINES ARE TOLD TO SKIP. `discourage_search_engines: yes` (WordPress's
 *      "Discourage search engines") puts noindex on every page and turns the sitemap off; nothing on
 *      the store looks broken, and a launched store gets no search traffic. A WARNING to pass on, never
 *      a failure: demo and dev sites stay hidden on purpose, and only the merchant decides. An older
 *      plugin does not report it: then the state is UNKNOWN, never "visible".
 *
 *  13. THE HAND-STYLED BLOCK. A custom block's content is markup, like a page's, and WordPress's own
 *      check accepts anything inside a Custom HTML block: hand-styled rows pass it, return 200, and
 *      then render unlike the rest of the store, with nothing the merchant can change from the block
 *      editor. `codbrand-content-builder`'s validator is the only check that looks inside one, so it
 *      runs here on every custom block the store SHOWS — through a placement, as a topbar, header or
 *      footer, or as a product's extra description. A block placed to load AFTER the page arrives
 *      without the CSS behind its layout settings (WordPress prints it while it renders the page),
 *      so that fails too. Measured on one store: every placed block had been written by hand, and
 *      each failed the validator with 2 to 7 errors.
 *
 *  15. THE STYLE A PRESET OVERRULES. A `*_style` property that the preset on the same element also
 *      sets usually loses to the preset: stored, compiled, never seen. A WARNING (see
 *      checkStyleVsPreset()).
 *
 *  16. THE DESIGN THE STORE DOES NOT SHOW. A design is linked to nothing until its store row points at
 *      it; a pointer at 0 shows the first active design of its type, and one at a missing design falls
 *      back the same way (see checkPointers()).
 *
 *  17. THE PAGE BESIDE THE STUCK BAR. A sticky header whose background is only as wide as its width
 *      mode lets the page scroll visibly beside the stuck bar; a Bottom Row whose width differs from the
 *      bar's background looks broken (see checkHeaderWidths()).
 *
 *  18. THE CARDS THAT TOUCH. A products, categories or reviews list whose gap is 0 shows its cards
 *      touching, and a reviews summary beside the list touching the first card. A WARNING when the cards
 *      draw their edge (see checkListGaps()).
 *
 *  19. THE CLOCK NOBODY SET. Sale ends, countdowns and topbar dates are read in the site's time zone, and
 *      a fresh install keeps UTC whatever country the store sells in: a sale written to end at midnight
 *      ends hours off. A FAILURE when the site runs on UTC or a fixed offset while sales, countdowns or
 *      dated topbar messages are on (`--utc-intended "<why>"` for customers who keep UTC), a WARNING
 *      otherwise. A sale's dates are read in the site's own zone, never this machine's.
 *
 *  20. THE NOTE LEFT FOR THE MERCHANT. Words written to the merchant ("tell us why…", "replace before
 *      launch") on a page, a block or a review; the placeholders the skill prescribes, listed for the
 *      replace-list — and failed on a store whose blueprint records it as a SHOWCASE (see
 *      scanShopperText()).
 *
 *  21. WHAT WORDPRESS LEFT, AND THE PAGE NOTHING LINKS TO. Its sample page and first post still published;
 *      a store page no rendered link reaches (see checkLeftovers()).
 *
 *  22. THE POPUP WITH NO PANEL. A card design painting a popup's box transparent (see checkPopupPanels()).
 *
 *  23. THE CUSTOM CODE NOBODY REVIEWED. Every piece at every level, listed for review (see
 *      listCustomCode()).
 *
 *  24. THE STOCK NOBODY COUNTS. Back-in-stock alerts, a stock badge or the low-stock line on, while no
 *      product tracks its stock.
 *
 *  25. THE CRAMPED FILTER DRAWER. Over 24px of padding, or a close button under 44px (see
 *      checkFilterDrawers()).
 *
 *  26. ONE CARD, SEVERAL LOOKS. Listing designs of one store drawing the same card differently, listed
 *      for the merchant to confirm (see checkSameKindLooks()).
 *
 *  27. THE HOST'S BOT CHECK. Reads are paced; a challenge page the host answers instead of the store is
 *      waited out, then reported as the host's, never as a missing permission.
 *
 *  28. NO LIVE CHECK. What a shopper sees is checked in the browser by live-check.mjs (joins.js on every page),
 *      and the gate takes its saved results (`--joins <folder>`), not a word that it ran: every page the store
 *      shows at a phone, a medium, an expanded and a large width, every overlay the store has open, measured
 *      against the store's own steps; every finding fixed or accepted with an id — a known plugin limit or the
 *      merchant's decision — never a sentence (see checkJoins()). Text left at a text design of 0 on a dark page is
 *      warned about beside it.
 *
 *  29. A FONT ON GOOGLE. An active Google font still loading from Google (`hosting: google`) is named, with the
 *      fix (see checkFontHosting()).
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

import { existsSync, mkdtempSync, writeFileSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
const flagAt = argv.findIndex((a) => a === '--wordmark-intended');
const wordmarkReason = flagAt === -1 ? null : (argv[flagAt + 1] ?? '');
/* `--block-kept <id> "<why>"`, repeatable: a custom block the store shows that this build did not
 * write — the merchant's own, on an established store — so its content is not this build's to fix. */
const keptBlocks = new Map();
/* The values a flag takes are not positional. `flagAt === -1` must not mean "skip index 0" — that
 * silently ate the site URL when no flag was passed, and every no-flag case then failed with a usage
 * error that LOOKED like a real refusal. */
const flagValues = new Set(flagAt === -1 ? [] : [flagAt + 1]);
/* `--floating-bar "<why>"`: the merchant chose a header whose background stops at its width mode (a boxed or
 * floating bar), so the page showing beside it while it is stuck is the design, not a defect. */
const floatAt = argv.findIndex((a) => a === '--floating-bar');
const floatingReason = floatAt === -1 ? null : (argv[floatAt + 1] ?? '');
if (floatAt !== -1) flagValues.add(floatAt + 1);
/* `--utc-intended "<why>"`: the store's customers really keep UTC, so a site on UTC is right even with sales
 * and countdowns on it. */
const utcAt = argv.findIndex((a) => a === '--utc-intended');
const utcReason = utcAt === -1 ? null : (argv[utcAt + 1] ?? '');
if (utcAt !== -1) flagValues.add(utcAt + 1);
/* `--joins <folder>`: this build's live check — live-check.mjs's folder, or joins.js results saved one per .json file. */
const joinsAt = argv.findIndex((a) => a === '--joins');
const joinsDir = joinsAt === -1 ? null : (argv[joinsAt + 1] ?? '');
if (joinsAt !== -1) flagValues.add(joinsAt + 1);
argv.forEach((a, i) => {
  if (a !== '--block-kept') return;
  flagValues.add(i + 1).add(i + 2);
  keptBlocks.set(String(argv[i + 1] ?? '').trim(), String(argv[i + 2] ?? '').trim());
});
const positional = argv.filter((a, i) => !a.startsWith('--') && !flagValues.has(i));
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

/* Reads are PACED. A host's bot protection answers a burst with its own challenge page ("Checking your
 * browser": an HTML 403 or 503 where the api answers JSON) instead of the store — measured on two hosted
 * stores, 16-10-2026, after one unpaced run of a copy of this script. A short pause between reads keeps a
 * run under it; a challenge that still comes is waited out a few times, then counted and reported as the
 * HOST's refusal — never as the store's, and never as a missing permission. */
const PACE_MS = 150;
let nextRead = 0;
async function pace() {
  const now = Date.now();
  const at = Math.max(now, nextRead);
  nextRead = at + PACE_MS;
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
}
const hostChallenge = { count: 0, paths: [] };
const isChallenge = (status, text) => (status === 403 || status === 503)
  && /checking your browser|just a moment|cf-chl|captcha|challenge-platform|attention required/i.test(text);

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
 * sees each of those, so each is checked. A pointer at 0 that the store row's `renders` reports as
 * falling back is checked through the design the storefront actually shows. Returned as [type, id]
 * pairs, without repeats. Reading it this way means a surface the plugin adds later is checked
 * without editing this file.
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
    } else if (key.endsWith('_sm_id') && store?.renders?.[key]?.via === 'fallback' && Number(store.renders[key].id) > 0) {
      add(key.slice(0, -'_sm_id'.length), Number(store.renders[key].id));
    }
  }
  return out;
}

/**
 * 16 — THE DESIGN THE STORE DOES NOT SHOW. Each component renders through the design its store row
 * points at. A design created through the api is linked to nothing, and a pointer at 0 shows the first
 * active design of its type, so a design the build styled can sit unused while the storefront shows
 * another, with a 200 on every call. A pointer at a design that does not exist falls back the same
 * way. The store row's own `renders` says what each pointer shows; this reads it and never guesses.
 */
async function checkPointers(call, R, store) {
  const problems = [];
  const notes = [];
  const renders = store?.renders;
  if (!renders || typeof renders !== 'object') return { problems, notes, unknown: true };
  const instancesPath = pathFor('section_manager_instances', 'section_manager/instances', R);
  for (const [key, r] of Object.entries(renders)) {
    if (!key.endsWith('_sm_id') || !r || typeof r !== 'object') continue;
    if (r.exists === false) {
      problems.push(`\`${key}\` points at design #${r.id}, which the storefront cannot use: ${r.warning ?? 'no such design'}\n` +
        '      Point it at the design you styled.');
      continue;
    }
    if (r.via !== 'fallback') continue;
    const type = r.type ?? key.slice(0, -'_sm_id'.length);
    const count = await countRows(call, `${instancesPath}?type=${encodeURIComponent(type)}`);
    if (count.error || count.count < 2) continue;
    notes.push(`\`${key}\` is 0, so the storefront shows the first active ${type} design, #${r.id} "${clip(r.title ?? '', 40)}"; ` +
      `this install has ${count.count} ${type} designs. If you styled another one, point the store at it (\`stores\` → \`${key}\`): ` +
      'a design shows only once its store points at it.');
  }
  return { problems, notes, unknown: false };
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
 *
 * A design's open/close toggle icon left EMPTY ("" or "0") is not missing: the view falls back to
 * the store row's own pair, `collapse_open_icon_id` / `collapse_close_icon_id`. So the store's pair is
 * checked like a design's, and an empty toggle fails only when the pair it falls back to is empty
 * too — then the collapsible renders with no open/close mark at all. Measured: a store's pair seeded
 * 0 / 0 left every cart, checkout and thank-you collapsible without one, and the empty design ids
 * were skipped as "not set".
 */
async function checkIcons(call, R, settingsByDesign, store) {
  const iconPath = pathFor('design_controls_icons_manager', 'design_controls/icons_manager', R);
  const read = await walk(call, iconPath);
  if (read.error) {
    return { skipped: `could not read the icons library — ${read.error}`, dangling: [] };
  }
  const known = new Map(read.rows.map((r) => [String(r.id), r.name]));

  const dangling = [];
  const unmarked = [];
  const byDesign = new Map();
  const storePair = ['collapse_open_icon_id', 'collapse_close_icon_id'].filter((k) => k in (store ?? {}));
  const fallbackOk = { open: false, close: false };
  for (const k of storePair) {
    const id = String(store[k] ?? '').trim();
    const side = k.includes('open') ? 'open' : 'close';
    if (!id || id === '0') continue;
    if (!known.has(id)) { dangling.push({ design: 'stores', key: k, id }); continue; }
    fallbackOk[side] = true;
    if (!byDesign.has('stores')) byDesign.set('stores', new Map());
    byDesign.get('stores').set(k, { id, name: known.get(id) });
  }
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
      if (!id || id === '0') {
        const toggle = k.match(/_icon_(open|close)_id$/);
        if (toggle && storePair.length && !fallbackOk[toggle[1]]) unmarked.push({ design, key: k, side: toggle[1] });
        continue;
      }
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
  return { skipped: null, dangling, mismatched, unmarked, count: known.size, pairs: PAIRS };
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
      await pace();
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

/**
 * 15 — THE STYLE A PRESET OVERRULES. A `*_style` and a `*_preset` can paint the same element — "same
 * element" meaning they share a `css_selector` in the design's `style_generator`, the plugin's own
 * test. When both set a property, the preset usually wins on the storefront, so the style's value is
 * stored, compiled and never seen: a 200 and no visible change. Measured on one build: a topbar given
 * its colour through the style stayed invisible until the colour went into a preset.
 *
 * A WARNING, never a failure — "usually": a style compiled under a selector holding an id outranks the
 * preset (skipped), an !important style beats a normal preset, and an equally specific preset can lose.
 * The id is looked for in the selector the design's CSS really PRINTS the style under — its
 * `compiled_selector` (plugin 1.2.1519+), not its `css_selector`, which names the element and can weigh
 * differently (/docs/settings_vs_presets): measured on one store, 70 style keys named with one weight and
 * compiled with another, a product description's `#cl_long_description …` among them, compiled as
 * `.cl_long_description …` and outweighed by its preset. An older plugin reports no `compiled_selector`, and
 * then the name decides, as before. Only properties set to DIFFERENT values are reported; padding and
 * background are compared as longhands, every other property as written. A preset on a parent or child
 * element is not checked.
 */
function checkStyleVsPreset(designs, presetsById) {
  const notes = [];
  const norm = (v) => String(v).replace(/\s+/g, ' ').trim().toLowerCase();
  for (const d of designs) {
    const sg = d.styleGen ?? {};
    for (const [key, css] of Object.entries(d.settings)) {
      if (!key.endsWith('_style') || typeof css !== 'string' || !css.trim()) continue;
      // `sel` pairs the style with its preset (the element's shared name); the weight is the compiled one.
      const sel = sg[key]?.css_selector;
      if (!sel || String(sg[key]?.compiled_selector ?? sel).includes('#')) continue;
      const style = cascade(new Map(), css);
      for (const [pKey, pId] of Object.entries(d.settings)) {
        /* `*_countdown_preset` holds a countdown DESIGN id, not a preset (/docs/settings_vs_presets). */
        if (!pKey.endsWith('_preset') || pKey.endsWith('_countdown_preset')) continue;
        if (sg[pKey]?.css_selector !== sel) continue;
        const preset = presetAt(presetsById.get(String(pId)));
        if (!preset) continue;
        const clash = [];
        for (const [prop, mine] of style) {
          for (const map of [preset.desktop, preset.phone]) {
            const theirs = map.get(prop);
            if (!theirs || norm(theirs.value) === norm(mine.value)) continue;
            if (mine.important && !theirs.important) continue;
            clash.push(`${prop} ${mine.value} (the preset: ${theirs.value}${map === preset.phone ? ', on phones' : ''})`);
            break;
          }
        }
        if (clash.length) {
          notes.push(`${d.label}.${key} sets ${clash.join('; ')}, but preset ${pId} (\`${pKey}\`) paints the same element\n` +
            '    and usually wins, so these values may never show. Put the look in the preset (clone it first when other\n' +
            '    surfaces use it), not in the style — /docs/settings_vs_presets.');
        }
      }
    }
  }
  return notes;
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
async function readPageBackgrounds(call, R, resolve, designs, presetsById) {
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
  return { store, product: productCss ? colourOf(productCss, null) : null, modes: widthModeInsets(res, presetsById) };
}

/**
 * The side padding each width mode gives what it holds, per breakpoint, from the store's own compiled
 * rules (store_settings → global layout; plugin `comps/store/…/global_layout/v1/generated_css.php`):
 * `cl-full-width` sets none, `cl-boxed-mode` sets 0, and the two padded modes the store's page edge: since the
 * plugin's spacing standard one Spacing design (`page_edge_space_preset`, its computer and phone value); before it
 * `full_width_padded_style` / `boxed_mode_padded_style` and their `*_mobile_style`. `null` when store_settings could
 * not be read.
 */
function widthModeInsets(res, presetsById) {
  if (res.status !== 200) return null;
  const s = res.body?.settings ?? {};
  const at = (css, mobile) => { const desktop = cascade(new Map(), css); return { desktop, phone: cascade(new Map(desktop), mobile) }; };
  const edge = s.page_edge_space_preset !== undefined && presetsById ? spaceOf(s.page_edge_space_preset, presetsById) : null;
  if (edge) {
    const side = (n) => `padding-left:${n}px;padding-right:${n}px`;
    const padded = at(side(edge.desktop), side(edge.phone));
    return { 'cl-full-width': at('', ''), 'cl-boxed-mode': at('padding-left:0;padding-right:0', ''), 'cl-full-width-padded': padded, 'cl-boxed-mode-padded': padded };
  }
  return {
    'cl-full-width': at('', ''),
    'cl-boxed-mode': at('padding-left:0;padding-right:0', ''),
    'cl-full-width-padded': at(s.full_width_padded_style ?? '', s.full_width_padded_mobile_style ?? ''),
    'cl-boxed-mode-padded': at(s.boxed_mode_padded_style ?? '', s.boxed_mode_padded_mobile_style ?? ''),
  };
}

/* The bands a design can paint across the screen while its content stays in its width mode (plugin G142:
 * the preset's paint on an outer full-screen box, `cl-card-paint-only`, its padding on the box inside the
 * width mode, `cl-card-padding-only`): the block, and the main footer's key its bottom bar follows on `same`. */
const SCREEN_BANDS = { main_header: null, main_footer: null, bottom_footer: 'main_footer' };
function paintedAcrossScreen(s, block) {
  if (!(block in SCREEN_BANDS)) return false;
  let w = String(s[`${block}_background_width`] ?? '');
  if (w === 'same' && SCREEN_BANDS[block]) w = String(s[`${SCREEN_BANDS[block]}_background_width`] ?? '');
  return w === 'screen';
}

/**
 * One property's value as the plugin reads it: StyleManagerBK_cl::getSingleCssPropertyValue($style,
 * $prop, true) (styleManagerBK.php:515-577, since 15-10-2026). Only the property's OWN declaration — the
 * first `;`-separated part whose name, leading spaces trimmed, is the property — read from the very
 * start of its value: a var(), else a word, else a number with or without a unit; '' when none. So
 * `height: 60px` (a space after the colon) reads as no height, as it does in the plugin. Mirrored, not
 * improved: this check has to agree with what the plugin compiles.
 */
function pluginCssValue(style, prop) {
  for (const decl of String(style ?? '').split(';')) {
    const colon = decl.indexOf(':');
    if (colon === -1 || decl.slice(0, colon).replace(/^\s+/, '') !== prop) continue;
    const v = decl.slice(colon + 1);
    const m = v.match(/^(var\([^)"']+\))/) || v.match(/^(-?[a-zA-Z][a-zA-Z-]*)/) || v.match(/^(-?\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw)?)/);
    return m ? m[1] : '';
  }
  return '';
}

/** The header compiler takes the spaces out around each colon before some of its reads. */
const tightCss = (style) => String(style ?? '').replace(/\s*:\s*/g, ':');

/**
 * The value the plugin's header compiler treats as "a height is set" (generated_css.php:54,
 * `$headerFixedHeight`, read from main_header_container_style as stored). The padding guard
 * (`padding-top/bottom: 0 !important`, :72-81) then goes on every side whose layout is not `stacked`
 * for ANY non-empty value: the plugin counts `auto`, `0` or a bare `60` as a set height.
 */
function pluginHeightGuardValue(style) {
  return pluginCssValue(style, 'height');
}

/**
 * The bar's height on phones (main_header_container_mobile_style; generated_css.php:67-68, `$phoneBarHeight`):
 * kept only as a length of 0 or more, '' when unset — and then the height above applies on phones too.
 */
function phoneBarHeight(settings) {
  const v = String(pluginCssValue(tightCss(settings.main_header_container_mobile_style), 'height'));
  return /^(\d+(\.\d+)?(px|em|rem)|0)$/.test(v) ? v : '';
}

/**
 * The bar's OWN top and bottom padding (main_header_container_style for every screen,
 * main_header_container_mobile_style for phones; generated_css.php:57-63). Where one is set it wins over
 * the card design's, side by side; where it is not, the card design's applies. The height guard zeroes
 * it like any other padding.
 */
function barPadding(settings) {
  const read = (style) => ({ 'padding-top': String(pluginCssValue(tightCss(style), 'padding-top')),
    'padding-bottom': String(pluginCssValue(tightCss(style), 'padding-bottom')) });
  return { all: read(settings.main_header_container_style), phone: read(settings.main_header_container_mobile_style) };
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
 * Does one side of the bar get any top or bottom padding? Under the guard, only the card design's
 * !important padding survives (the bar's own is zeroed with the rest). Otherwise each of the two is the
 * bar's own where it is set — on phones the phone value first — and the card design's where it is not.
 */
function sidePadded(side, map, guarded, bar) {
  if (guarded) return !!map && hasVerticalPadding(map, true);
  const value = (prop) => {
    const own = side === 'phones' ? (bar.phone[prop] || bar.all[prop]) : bar.all[prop];
    if (own !== '') return own;
    const e = map?.get(prop);
    return e ? e.value : '0';
  };
  return !(isZeroLength(value('padding-top')) && isZeroLength(value('padding-bottom')));
}

/**
 * Which layout each side of a header compiles with. Desktop — 768px and wider — is
 * `main_header_layout`. Phones — below 768px — are `main_header_layout_mobile`, unless it is `same`
 * (the default) or absent (an install that predates the key), when phones follow desktop.
 */
function headerLayouts(settings) {
  const desktop = String(settings.main_header_layout ?? '');
  const mobile = String(settings.main_header_layout_mobile ?? 'same');
  const own = mobile !== '' && mobile !== 'same';
  return { desktop, phones: own ? mobile : desktop, own };
}

/**
 * 5 — THE CRAMPED HEADER. Does every header that sizes to its content have vertical space, on desktop
 * and on phones?
 *
 * EACH SIDE BY ITS OWN LAYOUT (headerLayouts()). With a phone layout the plugin compiles one pass per
 * side, each in its own media query, and puts the padding guard in every pass whose layout is not
 * `stacked` (generated_css.php: $layoutPasses, $paddingGuardMedia). With `same` there is one pass and
 * this is exactly the old single-layout check. Mirrored, not improved.
 *
 * A side sizes to its content in three cases (generated_css.php: `height: fit-content`, then the
 * design's style, then the guard):
 *   a. `stacked`: it forces `height:auto` over any height and never gets the guard, so the bar is its
 *      two rows plus its top and bottom padding.
 *   b. a one-row layout with NO height: no guard either, so that padding is again the only vertical
 *      space. The shipped `height:60px` avoids this; removing it re-opens it.
 *   c. a one-row layout whose height is not a real length (`auto`, `0`, a bare number): the plugin
 *      still counts it as set and zeroes the padding, so only !important padding survives.
 * A one-row side with a real height has room and is not checked here. The padding is the bar's own
 * where it is set (barPadding(), since 31-10-2026), else the card design's; on phones a phone height
 * (phoneBarHeight(), since 01-11-2026) replaces the one above and, alone, guards phones.
 */
function checkHeaderVerticalSpace(headers, presetsById) {
  const problems = [];
  let checked = 0;
  for (const d of headers) {
    const style = d.settings.main_header_container_style ?? '';
    const heightValue = pluginHeightGuardValue(style);
    const fixed = headerHasFixedHeight(style);
    const phoneHeight = phoneBarHeight(d.settings);
    const bar = barPadding(d.settings);
    const layouts = headerLayouts(d.settings);
    const id = Number(d.settings.main_header_container_preset ?? 0);
    const preset = presetsById.get(String(id));
    const at = presetAt(preset);

    // The sides each case leaves without vertical space: `guard` (a one-row side whose height is not a
    // real length), `stacked`, `noHeight` (a one-row side with no height).
    const flatIn = { guard: [], stacked: [], noHeight: [] };
    let judged = false;
    for (const [side, map] of [['desktop', at?.desktop], ['phones', at?.phone]]) {
      const stacked = layouts[side] === 'stacked';
      // On phones a phone height, where set, replaces the one above (`0` gives the bar no height of its own).
      const sideFixed = side === 'phones' && phoneHeight !== '' ? headerHasFixedHeight(`height:${phoneHeight}`) : fixed;
      if (!stacked && sideFixed) continue;
      judged = true;
      // generated_css.php never emits the guard for a `stacked` pass; a phone height alone guards phones.
      const guarded = !stacked && (heightValue !== '' || (side === 'phones' && phoneHeight !== ''));
      if (sidePadded(side, map, guarded, bar)) continue;
      flatIn[guarded ? 'guard' : stacked ? 'stacked' : 'noHeight'].push(side);
    }
    if (judged) checked++;

    // With a phone layout of its own, say which key gave each side its layout. With `same` the message
    // is the single-layout one, unchanged.
    const lead = (flat) => (layouts.own
      ? `${d.label} (${flat.map((side) => `${side}: \`${side === 'phones' ? 'main_header_layout_mobile' : 'main_header_layout'}\` is \`${layouts[side]}\``).join(', ')})`
      : d.label);

    if (flatIn.guard.length) {
      const flat = flatIn.guard;
      problems.push(
        `${lead(flat)}: the header's height is \`${heightValue || phoneHeight}\`, which gives the bar no height of its own on ${flat.join(' or on ')}, ` +
        'yet the plugin still counts it as a set height.\n' +
        '      Any height value switches on the rule that zeroes the bar\'s top and bottom padding (its own and\n' +
        '      its card design\'s), a rule meant for a fixed-height bar. So this bar is only as tall as its\n' +
        '      content, with no padding at all. Set a real length (the shipped value is 60px), or remove the\n' +
        '      height and give the bar top and bottom padding. See api-recipes.md → "Header height: what sets\n' +
        '      it depends on the layout".'
      );
    }

    const why = (flat) => (!preset
      ? `it points at card design #${id}, which does not exist on this install, so nothing pads it`
      : !at
        ? `its card design #${id} "${preset.title}" is switched off (is_active "${preset.is_active}"), so it compiles no CSS at all`
        : `neither the bar (\`main_header_container_style\`${flat.includes('phones') ? ', `main_header_container_mobile_style`' : ''}) nor ` +
          `its card design #${id} "${preset.title}" sets top or bottom padding on ${flat.join(' or on ')} ` +
          `(css_default \`${preset.css_default || '—'}\`, css_mobile \`${preset.css_mobile || '—'}\`)`);
    if (flatIn.stacked.length) {
      problems.push(
        `${lead(flatIn.stacked)}: the header layout is \`stacked\`, and ${why(flatIn.stacked)}.\n` +
        '      A stacked header ignores `height` and sizes to its two rows, so its top and bottom padding is\n' +
        '      the ONLY vertical space it has. Without it the logo sits on the bar\'s top edge and the nav row\n' +
        '      touches whatever comes next, while the height reads back as written. Give the bar its own\n' +
        '      padding-top and padding-bottom (main_header_container_style, and _mobile_style for phones), or,\n' +
        '      on an install whose header style refuses padding, its card design (css_default AND css_mobile;\n' +
        '      check its used_count first). See api-recipes.md → "Header height: what sets it depends on the layout".'
      );
    }
    if (flatIn.noHeight.length) {
      problems.push(
        `${lead(flatIn.noHeight)}: the header has no height, so it sizes to its content, and ${why(flatIn.noHeight)}.\n` +
        '      With no height the bar is only as tall as its content plus its top and bottom padding, the\n' +
        '      same as a stacked header. Without that padding the logo sits on the bar\'s top edge and the nav\n' +
        '      row touches whatever comes next. Give the bar its own padding-top and padding-bottom\n' +
        '      (main_header_container_style, and _mobile_style for phones) — or, where the header style refuses\n' +
        '      padding, its card design (css_default AND css_mobile; check its used_count first) — or set a\n' +
        '      height again: the shipped value is 60px. See api-recipes.md → "Header height: what sets it depends on the layout".'
      );
    }
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
 * 17 — THE PAGE BESIDE THE STUCK BAR. The bar's background — its card design, its sticky colour — reaches
 * as far as `main_header_background_width` says: `screen`, across the screen, or `bar`, only as wide as
 * the width mode. A sticky header in any width mode but `cl-full-width`, on `bar`, lets the page scroll
 * visibly beside the stuck bar: measured, 48px strips on a desktop, 20px on a phone, 368px each side at
 * 1920. A design saved before the setting existed keeps `bar`. And a Bottom Row whose width resolves
 * differently from the bar's background looks broken — a full-screen row under a boxed bar. Before the
 * setting existed, the bar always stopped at its width mode and only `cl-full-width` closed the gap.
 */
function checkHeaderWidths(headers) {
  const problems = [];
  const notes = [];
  let checked = 0;
  for (const d of headers) {
    const s = d.settings;
    const full = String(s.main_header_width_mode ?? '') === 'cl-full-width';
    const has = 'main_header_background_width' in s;
    const bg = has ? String(s.main_header_background_width) : 'bar';
    if (yes(s.main_header_is_sticky) && !full) {
      checked++;
      if (!has) {
        notes.push(`${d.label}: the header is sticky in the width mode \`${s.main_header_width_mode}\`, and this plugin has no\n` +
          '    `main_header_background_width`: while the bar is stuck the page shows beside it, and the only setting\n' +
          '    that closes it here is the width mode `cl-full-width`. A newer plugin adds the switch.');
      } else if (bg !== 'screen') {
        if (String(floatingReason ?? '').trim().length >= MIN_REASON) {
          line(true, `${d.label}: a floating header bar, declared intentional: "${String(floatingReason).trim()}"`);
        } else {
          problems.push(`${d.label}: the header is sticky in the width mode \`${s.main_header_width_mode}\` and its background is only\n` +
            `      as wide as the bar (\`main_header_background_width\`: \`${bg}\`), so while it is stuck the page scrolls\n` +
            '      visibly beside it. Set `main_header_background_width` to `screen` (/docs/header_global_settings →\n' +
            '      "The bar and the Bottom Row: one width"). If the merchant asked for a floating bar, say so:\n' +
            `        --floating-bar "<why, at least ${MIN_REASON} characters>"`);
        }
      }
    }
    const rowUsed = ['end_menu_position', 'end_menu_position_mobile'].some((k) => String(s[k] ?? '') === 'bottom_row');
    if (rowUsed && !full && 'main_header_bottom_row_width' in s) {
      checked++;
      const row = String(s.main_header_bottom_row_width);
      const rowWidth = row === 'same' ? bg : row;
      if (rowWidth !== bg) {
        problems.push(`${d.label}: the bar's background is \`${bg}\` wide and its Bottom Row \`${rowWidth}\`, so one stops where the\n` +
          '      other runs on — a full-screen row under a boxed bar, or the reverse, looks broken. Set\n' +
          '      `main_header_bottom_row_width` to `same` (/docs/header_global_settings → "The bar and the Bottom Row: one width").');
      }
    }
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
 *
 * A header, footer or bottom-bar band painted ACROSS THE SCREEN (`*_background_width: screen`) is
 * built differently: the preset's paint goes on an outer full-screen box and its padding on a box inside
 * the width mode, so the text's distance from the band's edge is the width mode's padding plus the
 * preset's. Measured on one store: presets with 0 side padding there, the width mode `cl-boxed-mode-padded`
 * (48px, 16px on phones), logo and footer text 48 / 16px from the band's edge. Such a band passes at a
 * breakpoint where its width mode pads both sides; in a mode that pads nothing it is still flush.
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
      const screen = paintedAcrossScreen(d.settings, block);
      for (const [bp, map, side] of [['desktop', at.desktop, 'desktop'], ['phones (under 767px)', at.phone, 'phone']]) {
        if (!(isZeroLength(map.get('padding-left')?.value) && isZeroLength(map.get('padding-right')?.value))) continue;
        const paint = paintOf(map, resolve);
        if (paint.none) continue;
        const use = `${d.label} ${key}`;
        // Painted across the screen, the band's edge is the screen's, and the width mode pads the content
        // inside it: no flush text when that mode gives both sides a padding at this breakpoint.
        if (screen) {
          if (!pages) pages = await pageBackgrounds();
          const mode = String(d.settings[`${block}_width_mode`] ?? '');
          const inset = pages.modes?.[mode]?.[side];
          if (!pages.modes) {
            undecided.push(`${use}: card design #${id} is painted across the screen with no side padding on ${bp}, and the ` +
              'width modes could not be read (store_settings) to tell whether `' + mode + '` pads its content');
            continue;
          }
          if (inset && !isZeroLength(inset.get('padding-left')?.value) && !isZeroLength(inset.get('padding-right')?.value)) continue;
        }
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
      '      The text will sit exactly ON the band\'s visible edge, both sides. A width mode does NOT rescue\n' +
      '      this -- it insets the block INCLUDING its background -- except for a header or footer band painted\n' +
      '      across the screen (`*_background_width: screen`) in a width mode that pads both sides, which none\n' +
      '      of the uses above is. Pad the card design at that breakpoint: css_default for\n' +
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

/**
 * A TEXT WITH NO TEXT DESIGN ON A DARK PAGE (a warning). A `*_text_preset` at 0 gives its text no style of its own:
 * it takes its colour from what is around it (the plugin's own "inherit" for most such keys) and, where nothing
 * around it sets one, from the theme's page text — which no door sets (store_settings → `page_background_style`
 * takes a background colour only) and the api cannot see. Measured on one dark store: a stock-waitlist title at 0
 * drew #000 on #151517 (1.15 : 1). "Dark" = black text would miss WCAG 1.4.3's 4.5 : 1 on the page there. Only
 * active blocks; the browser decides what really shows (joins.js `low-contrast`), so this is never a failure.
 */
async function checkTextAtZero(designs, pageBackgrounds) {
  const lum = (c) => 0.2126 * ch(c.rgb[0]) + 0.7152 * ch(c.rgb[1]) + 0.0722 * ch(c.rgb[2]);
  const ch = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const blackFails = (c) => c && !c.unresolved && (lum(c) + 0.05) / 0.05 < 4.5;
  const zero = [];
  for (const d of designs) {
    for (const [key, raw] of Object.entries(d.settings)) {
      if (!/_text_preset$/.test(key) || String(raw ?? '').trim() !== '0') continue;
      // The block a key belongs to: the longest prefix with its own `_is_active`.
      const parts = key.split('_');
      let active = true;
      for (let i = parts.length - 1; i > 0; i--) {
        const sw = `${parts.slice(0, i).join('_')}_is_active`;
        if (sw in d.settings) { active = String(d.settings[sw]) !== 'no'; break; }
      }
      if (active) zero.push({ d, key });
    }
  }
  if (!zero.length) return [];
  const pages = await pageBackgrounds();
  const pageOf = (d) => (d.type === 'product' && pages.product ? pages.product : pages.store);
  const dark = zero.filter(({ d }) => blackFails(pageOf(d)));
  if (!dark.length) return [];
  const page = [...new Set(dark.map(({ d }) => describe(pageOf(d))))].join(', ');
  return [`${dark.length} text(s) on a dark page (${page}) have no text design of their own (preset 0):\n` +
    dark.slice(0, 8).map(({ d, key }) => `        ${d.label}.${key}`).join('\n') + (dark.length > 8 ? `\n        … and ${dark.length - 8} more` : '') + '\n' +
    '    At 0 a text takes its colour from what is around it, and where nothing around it sets one, from the theme\'s\n' +
    '    page text, which no door sets — measured on one dark store: #000 on #151517. Pick a text design for each one\n' +
    '    a shopper sees, or check it shown in the browser (joins.js reports `low-contrast`).'];
}

/**
 * 29 — A GOOGLE FONT STILL LOADING FROM GOOGLE (a warning). A Google font row carries `hosting`: `local` (the store
 * copied its files and serves them; no visitor connects to Google) or `google`. A NEW font defaults to `local`, but a
 * re-point keeps the row's old value and the two shipped rows read `google` (the plugin's seed carries none and the
 * column defaults to it), so a build that re-points `font1` without `"hosting": "local"` leaves the brand face on
 * Google. Measured on one store: its display font, a re-pointed shipped row, loaded from fonts.googleapis.com on
 * every page. A warning, not a failure: when the store cannot copy the files (a 503 in the apply's results), Google
 * is the right end state — told to the merchant. Only active fonts: an inactive one loads nothing.
 */
async function checkFontHosting(call, R) {
  const read = await walk(call, pathFor('design_controls_font_manager', 'design_controls/font_manager', R));
  if (read.error) return { notes: [`fonts NOT checked for where they load from: could not read the font list — ${read.error}`] };
  const google = read.rows.filter((f) => String(f.type ?? '') === 'google' && String(f.is_active ?? 'yes') !== 'no');
  if (!google.length) return { notes: [] };
  if (!google.some((f) => 'hosting' in f)) {
    return { notes: ['fonts NOT checked for where they load from: this plugin reports no `hosting`, so every Google font\n' +
      '    loads from Google there — a plugin update serves them from the store.'] };
  }
  const onGoogle = google.filter((f) => String(f.hosting ?? '') === 'google');
  if (!onGoogle.length) return { notes: [], passed: `every Google font is served from the store (${google.length} checked)` };
  return { notes: [`${onGoogle.length} font(s) load from Google — every visitor's browser contacts Google for them:\n` +
    onGoogle.map((f) => `        ${f.name} "${clip(String(f.title ?? ''), 40)}" (${clip(String(f.font_family ?? ''), 40)})`).join('\n') + '\n' +
    '    Send each again with `"hosting": "local"` (references/palette.md → "Fonts"). If its result comes back with\n' +
    '    `"http": 503` and the copy failed, tell the merchant that font loads from Google, and why.'] };
}

/* The lists whose cards stand side by side or one under another: the keys holding the space between the cards
 * (Spacing designs since the plugin's spacing standard: one side by side, one one under the other; before it a `gap` in
 * a container style), and the card's own look (a card design, and a style on the same element). */
const CARD_LISTS = {
  plist1: { columns: 'plist1_columns_space_preset', rows: 'plist1_rows_space_preset', gap: 'plist1_products_container_style', preset: 'single_product_preset', style: 'single_product_style', cards: 'product cards' },
  catlist: { columns: 'catlist_columns_space_preset', rows: 'catlist_rows_space_preset', gap: 'cl_categories_container_style', preset: 'category_item_preset', style: 'category_item_style', cards: 'category cards' },
  reviewlist: { columns: 'reviewlist_columns_space_preset', rows: 'reviewlist_rows_space_preset', beside: 'summary_reviews_beside_space_preset', gap: 'cl_reviews_container_style', preset: 'review_item_preset', style: 'review_item_style', cards: 'review cards' },
};
/* A Spacing design's two values — computer and phone (px) — or null when the id names none; `0` is no space. */
function spaceOf(id, presetsById) {
  if (String(id ?? '').trim() === '0') return { desktop: 0, phone: 0 };
  const p = presetsById.get(String(id));
  if (!p || p.type !== 'spacing') return null;
  const n = (css) => { const m = String(css || '').match(/(?:gap|margin[a-z-]*|padding[a-z-]*)\s*:\s*(-?\d+(?:\.\d+)?)px/); return m ? Number(m[1]) : null; };
  const desktop = n(p.css_default);
  return desktop === null ? null : { desktop, phone: n(p.css_mobile) ?? desktop };
}
/* A page design that shows a list through a design it names itself, not the store's: [page type, the key
 * naming the list design, the list type, the prefix of the page's keys that override the list's own]. */
const LIST_TEMPLATES = [['product', 'reviews_design_template', 'reviewlist', 'reviews_'], ['category', 'design_template', 'plist1', '']];

const BORDER_LINE = /^(solid|dashed|dotted|double|groove|ridge|inset|outset)$/i;

/** What draws a card's edge — a border, a background or a shadow — or '' when nothing does. */
function cardEdge(map, resolve) {
  for (const [prop, { value }] of map) {
    if (!/^border(-(top|right|bottom|left|block|inline)(-(start|end))?)?(-style)?$/.test(prop)) continue;
    const t = tokens(value);
    if (!t.some((x) => BORDER_LINE.test(x)) || t.some((x) => /^[\d.]/.test(x) && isZeroLength(x))) continue;
    const width = map.get('border-width')?.value;
    if (width === undefined || !tokens(width).every((x) => isZeroLength(x))) return `a border (${prop}: ${value})`;
  }
  const paint = paintOf(map, resolve);
  if (paint.colour) return `a background (${describe(paint.colour)})`;
  if (paint.image || paint.unresolved) return `a background (${paint.text})`;
  const shadow = map.get('box-shadow')?.value;
  return shadow && !/^none$/i.test(shadow.trim()) ? `a shadow (${shadow})` : '';
}

/**
 * 18 — THE CARDS THAT TOUCH. A products, categories or reviews list keeps its cards apart with the `gap`
 * of its container style, in a grid and in a slider alike, and a reviews summary shown beside the list
 * (`summary_position: beside`) keeps the same gap from the first card. A design whose gap is 0 — an
 * older default, a copy of one — shows touching cards, and a card that draws its edge makes it plain.
 * Measured on one store: review cards touching for a month while every other check passed.
 *
 * A WARNING: joined cards can be the design. Only a gap WRITTEN as zero is read; with none written the
 * plugin's stylesheet decides, and the browser pass (joins.js) measures that. A product page's reviews
 * and a category page's products can show another design than the store's (LIST_TEMPLATES), so those
 * are read too, with the page's own overrides of the layout.
 */
async function checkListGaps(call, R, designs, presetsById, resolve) {
  const notes = [];
  let checked = 0;
  const uses = designs.filter((d) => CARD_LISTS[d.type]).map((d) => ({ d, label: d.label, over: () => undefined }));
  const gsPath = pathFor('section_manager_global_settings', 'section_manager/global_settings', R);
  for (const page of designs) {
    for (const [pageType, key, type, prefix] of LIST_TEMPLATES) {
      if (page.type !== pageType) continue;
      const id = Number(page.settings[key]);
      if (!(id > 0)) continue;
      const label = `${type}/${id} (named by ${page.label} \`${key}\`)`;
      const over = (k) => {
        const v = page.settings[`${prefix}${k}`];
        return v === undefined || v === '' || v === 'inherit' ? undefined : v;
      };
      let d = designs.find((x) => x.type === type && Number(x.id) === id);
      if (!d) {
        const res = await call(`${gsPath}/${type}/${id}`);
        const settings = res.body?.settings ?? res.body?.data?.settings;
        if (res.status === 404) {
          notes.push(`${page.label} \`${key}\` names ${type} design #${id}, which does not exist: that page shows the first active ${type}\n` +
            '    design instead. Its cards were NOT checked for touching. Point the key at the design you styled.');
          continue;
        }
        if (res.status !== 200 || !settings || typeof settings !== 'object') {
          notes.push(`${label} could not be read (HTTP ${res.status}), so its cards were NOT checked for touching.`);
          continue;
        }
        d = { label: `${type}/${id}`, type, id, settings };
      }
      uses.push({ d, label, over });
    }
  }
  for (const { d, label, over } of uses) {
    const spec = CARD_LISTS[d.type];
    const s = d.settings;
    const get = (k) => over(k) ?? s[k];
    const slider = String(get('pagination_type')) === 'slider';
    const oneColumn = ['columns_desktop', 'columns_mobile'].every((k) => String(get(k)) === '1');
    if (spec.columns in s) {
      const col = spaceOf(get(spec.columns), presetsById);
      const row = spaceOf(get(spec.rows), presetsById);
      if (!col || !row) {
        notes.push(`${label}: \`${!col ? spec.columns : spec.rows}\` names no Spacing design of this store, so its cards were NOT checked for touching.`);
        continue;
      }
      checked++;
      const zero = (v) => v.desktop === 0 || v.phone === 0;
      const touch = [];
      if (zero(col) && (slider || !oneColumn)) touch.push('side by side');
      if (zero(row) && !slider) touch.push('one under the next');
      const bes = spec.beside ? spaceOf(get(spec.beside), presetsById) : null;
      const beside = d.type === 'reviewlist' && yes(s.summary_is_active) && s.summary_position === 'beside' && s.summary_reviews_is_active !== 'no' && !!bes && zero(bes);
      if (!touch.length && !beside) continue;
      const preset = presetAt(presetsById.get(String(s[spec.preset])));
      const edge = (preset && (cardEdge(preset.desktop, resolve) || cardEdge(preset.phone, resolve))) || cardEdge(cascade(new Map(), s[spec.style]), resolve);
      if (!edge) continue;
      const where = [touch.length ? `the cards touch ${touch.join(' and ')}` : '', beside ? 'the summary beside them touches the first card' : ''].filter(Boolean).join(', and ');
      const keys = [touch.includes('side by side') ? spec.columns : '', touch.includes('one under the next') ? spec.rows : '', beside ? spec.beside : ''].filter(Boolean);
      notes.push(`${label}: 0px between its ${spec.cards} (${keys.map((k) => `\`${k}\`: 0`).join(', ')}), and each card draws ${edge}\n` +
        '    — ' + where + '. Unless the reference joins its cards on purpose, point those keys at a Spacing design (references/spacing.md).');
      continue;
    }
    if (!(spec.gap in s)) {
      notes.push(`${label}: this install's design has neither \`${spec.columns}\` nor \`${spec.gap}\`, so its cards were NOT checked for touching.`);
      continue;
    }
    checked++;
    const css = cascade(new Map(), s[spec.gap]);
    const [r, c = r] = tokens(css.get('gap')?.value ?? '');
    const row = css.get('row-gap')?.value ?? r;
    const col = css.get('column-gap')?.value ?? c;
    const zero = (v) => v !== undefined && (isZeroLength(v) || /^normal$/i.test(v));
    const touch = [];
    if (zero(col) && (slider || !oneColumn)) touch.push('side by side');
    if (zero(row) && !slider) touch.push('one under the next');
    /* The summary's gap is read the plugin's way: its own reader, spaces around the colon removed first. */
    const beside = d.type === 'reviewlist' && yes(s.summary_is_active) && s.summary_position === 'beside'
      && s.summary_reviews_is_active !== 'no' && isZeroLength(pluginCssValue(tightCss(s[spec.gap]), 'gap') || '20px');
    if (!touch.length && !beside) continue;
    const preset = presetAt(presetsById.get(String(s[spec.preset])));
    const edge = (preset && (cardEdge(preset.desktop, resolve) || cardEdge(preset.phone, resolve)))
      || cardEdge(cascade(new Map(), s[spec.style]), resolve);
    if (!edge) continue;
    const where = [touch.length ? `the cards touch ${touch.join(' and ')}` : '', beside ? 'the summary beside them touches the first card' : '']
      .filter(Boolean).join(', and ');
    notes.push(`${label}: 0px between its ${spec.cards} (\`${spec.gap}\`: \`${String(s[spec.gap]).trim()}\`), and each card draws ${edge}\n` +
      `    — ${where}. Unless the reference joins its cards on purpose, set the space the design shows in that key's \`gap\`.`);
  }
  return { checked, notes };
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

/**
 * THE MISSING WHATSAPP BUTTON. Switched on with a number under three characters, the floating button
 * prints nothing at all — a 200 everywhere. An empty `whatsapp_bt_img_url` is NOT a problem: since
 * plugin 1.2.799 the button falls back to the icon library's WhatsApp icon.
 *
 * Named keys, unlike the hollow check: this is one element with its own vocabulary, and the condition
 * mirrors the controller's own. A design without the switch is reported as not checked.
 */
function checkWhatsappButton(designs) {
  const problems = [];
  const unknown = [];
  let checked = 0;
  for (const d of designs.filter((x) => x.type === 'whatsapp')) {
    const s = d.settings;
    if (!('whatsapp_bt_active' in s)) { unknown.push(d.label); continue; }
    checked++;
    if (!yes(s.whatsapp_bt_active)) continue;
    if (String(s.whatsapp_bt_number ?? '').length < 3) {
      problems.push(
        `${d.label}: the WhatsApp button is switched on with no number (\`whatsapp_bt_number\`), so it does\n` +
        '      not render at all. Write the merchant\'s number, or switch it off (`whatsapp_bt_active: "no"`).'
      );
    }
  }
  return { problems, unknown, checked };
}

/**
 * THE STORE ONLY ITS OWNER CAN SEE. A host's "coming soon" or maintenance page answers a logged-out
 * visitor with its own page — often a 200 — while every api call above keeps working with the key.
 * So a build can pass every check and still show customers nothing. Measured on one host: HTTP 200,
 * `<title>Prochainement</title>`, and not one trace of the plugin in the page.
 *
 * The test is the plugin's own storefront markup, never the status code: its asset folder, or the
 * `cl_ajax_nonce` global printed on every storefront page. Either is enough, so a cache plugin that
 * merges the asset files does not trip it. NOT a `cl-design` anchor: that same host's coming-soon
 * page still ran the site footer, so the cart drawer's anchor was on it while nothing else of the
 * store was. Fetched without a session, as a customer is.
 */
async function checkPublicHome(siteUrl) {
  try {
    await pace();
    const res = await fetch(`${siteUrl}/`, { redirect: 'follow', headers: { Accept: 'text/html' } });
    const html = await res.text();
    const title = ((html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] ?? '').trim();
    return {
      status: res.status,
      title,
      html,
      store: /\/plugins\/(codbrand-plugin|cod-leads-for-elementor)\/|cl_ajax_nonce/.test(html),
    };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Does the theme render Block spacing (`blockGap`)? Read from the page, never assumed from the theme's name
 * (`codbrand-content-builder` → references/snippets.md → "Detect it"). WordPress prints the flow-layout
 * spacing rule — `:where(.is-layout-flow) > *{margin-block-start:…}` — only when the theme supports it;
 * without support it emits the flex and grid fallback gap alone (wp-includes/class-wp-theme-json.php,
 * get_layout_styles()). true / false from the home page's own styles; null when the page could not be read.
 */
function blockGapFrom(html) {
  if (typeof html !== 'string' || !html) return null;
  return /:where\(\.is-layout-(?:flow|constrained)\)\s*>\s*\*\s*\{[^}]*margin-block-start/.test(html);
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
 *
 * `goal` is what makes an ON feature WORK, beyond showing: the reason a shopper acts on it. A sales
 * feature switched on with rows behind it can still give no reason at all — an upsell strip with no
 * title and no saving, quantity offers on one product of twenty — and every count above passes it.
 * Measured on one build. The table's twin column is "What makes it work".
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
    goal: goalOffers,
  },
  product_variations: {
    label: 'Product options',
    /* Two switches, and either one at "no" hides every option: the product design's, and the store
     * row's own `variations_is_active`. */
    state: (c) => combine([probe(c, 'product', 'variations_is_active'), storeProbe(c, 'variations_is_active', (v) => String(v) !== 'no')]),
    rows: { products: (p) => Array.isArray(p.variations) && p.variations.length > 0, what: 'products carrying options', gates: true },
  },
  product_upsells: {
    label: 'Upsell offer',
    state: (c) => combine([probe(c, 'product', 'p_upsell_is_active')]),
    /* What the picked upsell offers on a product page: its picked products and automatic sources on every page,
     * else each product's own pairings (and, for a Bought together box, its lists). */
    rows: { upsellOffer: true, what: 'products to offer on the product page', gates: true },
    goal: goalUpsells,
  },
  quickview: {
    label: 'Quick view',
    state: (c) => combine(
      [probe(c, 'plist1', 'quickview_bt_is_active')],
      /* The upsells' cards and the thank-you upsell carry their own Quick View button (since the upsells design). */
      [upsellProbe(c, 'look_quickview_bt_is_active', ['cards', 'thankyou'])],
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
            empty: 'so the code box shows on the cart and checkout, and no code typed into it can work. The api only READS ' +
                   'codes (/docs/coupons): a person creates them in wp-admin. Ask the merchant for the code, and name none ' +
                   'in any copy until it exists' },
  },
  stock_waitlist: {
    label: 'Back-in-stock alerts',
    state: (c) => combine([probe(c, 'product', 'stock_waitlist_is_active')]),
    /* The alert shows only on a product that counts its stock and has run out of it. */
    rows: { products: tracksStock, what: 'products that track stock', gates: true,
            empty: 'so the alert shows on no product: it appears only where a product counts its stock and sells out. ' +
                   'Turn stock tracking on (`stock_mode`) for the products the merchant counts' },
  },
  countdown: {
    label: 'Countdown timer',
    state: (c) => combine(
      [probe(c, 'product', 'p_countdown_is_active')],
      [upsellProbe(c, 'look_countdown_is_active', ['cards', 'thankyou']),
       upsellProbe(c, 'look_visitor_timer_is_active', ['cards']),
       probe(c, 'product', 'sticky_button_countdown_display', (v) => String(v) !== 'hide', ['sticky_button_is_active', 'yes']),
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

/**
 * Options on a listing CARD — the swatches under a product — are a second switch, per option type: the
 * listing design's `variations_is_active` shows only the global options named in
 * `variations_included_slugs`, and an empty list shows none. Part of the curated map above; its twin
 * is archetypes.md → "What switches each feature", Product options. Checked on every listing design
 * the store uses, whatever the checklist says: a switch on over an empty list is a hollow element.
 */
function checkCardOptions(designs) {
  const problems = [];
  for (const d of designs) {
    const s = d.settings;
    if (d.type !== 'plist1' || !('variations_is_active' in s) || !('variations_included_slugs' in s)) continue;
    if (!yes(s.variations_is_active)) continue;
    const raw = s.variations_included_slugs;
    const listed = (asArray(raw) ?? String(raw ?? '').split(',')).map((x) => String(x).trim()).filter(Boolean);
    if (listed.length) continue;
    problems.push(
      `${d.label}: \`variations_is_active\` is "yes" but \`variations_included_slugs\` names no option type, so no\n` +
      '      product card shows any. List the option types the cards should show (/docs/plist1_global_settings),\n' +
      '      or set the switch to "no".'
    );
  }
  return problems;
}

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
  const decisions = doc?.decisions && typeof doc.decisions === 'object' ? doc.decisions : null;
  const features = decisions?.features?.value;
  if (!features || typeof features !== 'object' || Array.isArray(features)) return { which, noFeatures: true, decisions };
  return { which, features, decisions };
}

/**
 * 12 — THE SILENT REVERSAL. A decision changed after it was made — above all one taken to match the
 * merchant's reference — must say what it was, why it changed and when (`reversed`, blueprint-format.md
 * → "Reversing a decision"). Measured: an order summary switched OFF because the reference shows none
 * was switched back ON the same day as a side effect of another fix, and nothing recorded it; the join
 * it created with the form below went unchecked for days.
 *
 * What this can and cannot see: it checks every `reversed` the blueprint RECORDS. A setting flipped on
 * the store without touching the blueprint leaves no trace here — that is what the rule in SKILL.md and
 * the re-run browser pass are for.
 */
function checkReversals(decisions) {
  const problems = [];
  let checked = 0;
  for (const [key, d] of Object.entries(decisions)) {
    if (!d || typeof d !== 'object' || !('reversed' in d)) continue;
    checked++;
    const r = d.reversed;
    const missing = [];
    if (!r || typeof r !== 'object' || Array.isArray(r)) missing.push('an object { from, why, date }');
    else {
      if (!('from' in r)) missing.push('`from` (the value it had)');
      if (typeof r.why !== 'string' || r.why.trim().length < 20) missing.push('`why` (a sentence, 20+ characters)');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.date ?? ''))) missing.push('`date` (YYYY-MM-DD)');
    }
    if (missing.length) {
      problems.push(
        `decision \`${key}\` is recorded as reversed, but its \`reversed\` lacks ${missing.join(', ')}.\n` +
        '      A reversal with no reason reads, on the next run, exactly like a mistake — and a decision taken to\n' +
        '      match the reference gets undone again. Write what it was, why it changed and when.'
      );
    }
  }
  return { checked, problems };
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
      rows = await rowsFor(call, R, ctx, feature.rows, productsRead, decision === 'on' && !!feature.goal);
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
    } else if (name === 'countdown' && decision === 'on' && !productsRead.error && !productsRead.rows.some((p) => onTimedSale(p, ctx.clock))) {
      notes.push('feature `countdown` is ON, but no product has a sale with a start date and an end date still ahead, so the timer shows nowhere now. Tell the merchant it appears when they run a timed sale — do not invent one.');
    } else if (decision === 'on' && feature.goal && (!state || state.main) && rows && rows.count > 0) {
      const goal = await feature.goal(ctx, productsRead, rows, decisionNote(rawValue), call, R);
      problems.push(...goal.problems.map((p) => `feature \`${rawKey}\` (${feature.label}) — ${p}`));
      notes.push(...goal.notes);
    }
  }
  if (unknown.length) {
    notes.push(`blueprint feature(s) ${unknown.map((k) => `\`${k}\``).join(', ')} are not on the checklist this script knows, so they were NOT reconciled. Compare them by hand.`);
  }
  return { reconciled, problems, notes };
}

/**
 * A moment written in the store's own clock. A sale's `sale_from` / `sale_to` carry no zone: "2026-11-06 23:59"
 * is 23:59 where the site keeps time (/docs/store_settings → "The site's time zone"). Read in the clock of the
 * machine running this check instead, a Dubai store checked on a UTC machine kept a sale "running" four hours
 * after it ended. The site's city zone from `/me` (`timezone`, summer time included), else its `utc_offset`,
 * else — a plugin that reports neither — this machine's clock, as before.
 */
function storeTime(text, clock = {}) {
  const s = String(text).trim().replace(' ', 'T');
  if (/(Z|[+-]\d{2}:?\d{2})$/i.test(s)) return Date.parse(s);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return Date.parse(s);
  const [y, mo, d, h = '0', mi = '0', se = '0'] = m.slice(1);
  const wall = Date.UTC(+y, +mo - 1, +d, +h, +mi, +se);
  if (clock.zone) {
    try {
      /* The zone's offset at that moment: the wall clock it shows at a guess, the guess corrected by the
       * difference — twice, for a time near a clock change. */
      const fmt = new Intl.DateTimeFormat('en-US', { timeZone: clock.zone, hourCycle: 'h23', year: 'numeric',
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const shown = (t) => {
        const p = Object.fromEntries(fmt.formatToParts(t).map((x) => [x.type, x.value]));
        return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
      };
      let t = wall;
      for (let i = 0; i < 2; i++) t = wall - (shown(t) - t);
      return t;
    } catch { /* a zone this Node does not know: the offset below */ }
  }
  const off = String(clock.offset ?? '').match(/^([+-])(\d{2}):?(\d{2})$/);
  if (off) return wall - (off[1] === '-' ? -1 : 1) * (Number(off[2]) * 60 + Number(off[3])) * 60000;
  return Date.parse(s);
}

/** A product that counts its stock (`stock_mode` `product` or `variant`): the only kind a stock badge, the
 *  low-stock line or a back-in-stock alert can show on. */
function tracksStock(p) {
  return String(p.stock_mode ?? 'off') !== 'off';
}

/** A product the countdown can render on: a sale price, with a start date and an end date still ahead. */
function onTimedSale(p, clock) {
  if (!(Number(p.sale_price) > 0) || String(p.sale_from ?? '').trim() === '') return false;
  const to = String(p.sale_to ?? '').trim();
  if (!to) return false;
  const end = storeTime(to, clock);
  return Number.isNaN(end) || end > Date.now();
}

/** What an ON feature needs behind it, counted. `full` reads every row an ON feature's goal probe needs. */
async function rowsFor(call, R, ctx, spec, productsRead, full = false) {
  if (spec.products) {
    if (productsRead.error) return { error: `products could not be read — ${productsRead.error}` };
    return { count: productsRead.rows.filter(spec.products).length };
  }
  if (spec.upsellOffer) {
    if (productsRead.error) return { error: `products could not be read — ${productsRead.error}` };
    if (ctx.upsells.unread) return { error: ctx.upsells.unread };
    const legacy = ctx.upsells.legacy.filter((l) => l.endsWith('.p_upsell'));
    if (legacy.length) return { error: `this plugin keeps the upsell on the product design (${legacy.join(', ')}), before the upsells design this skill reads` };
    /* What the product page's picked upsell(s) offer (/docs/upsells_global_settings → "Where the products come
     * from"): its picked products and any source that finds products by itself — a category, the best sellers… —
     * reach EVERY product page; `own_upsells` only the products paired for the product page (`product/upsells`, a
     * row's `pages`; none listed = all four); a Bought together box the viewed product's lists, else those pairings.
     * Without `full`, stop at the first product with something to offer. */
    const offers = ctx.upsells.picked.filter((u) => u.block === 'p_upsell');
    const published = productsRead.rows.filter((p) => String(p.status ?? 'publish') === 'publish');
    const sources = (u) => (asArray(u.settings.products_sources) ?? []).map((s) => String(s?.type ?? ''));
    const everywhere = offers.find((u) => u.look !== 'bought_together'
      && ((asArray(u.settings.products_picked_ids) ?? []).length > 0 || sources(u).some((t) => t !== 'products' && t !== 'own_upsells')));
    if (everywhere && !full) return { count: 1 };
    const upsold = new Map();
    if (offers.some((u) => u.look === 'bought_together')) {
      const lists = await walk(call, pathFor('bought_together', 'bought_together', R));
      if (lists.error) return { error: `could not read the Bought together lists — ${lists.error}` };
      for (const l of lists.rows) {
        const ids = (asArray(l.product_ids) ?? []).map(String);
        if (ids.length < 2) continue;
        for (const id of ids) upsold.set(id, [...(upsold.get(id) ?? []), ...ids.filter((x) => x !== id).map((x) => ({ id: x }))]);
      }
    }
    if (offers.some((u) => u.look === 'bought_together' || sources(u).includes('own_upsells'))) {
      const path = pathFor('product_upsells', 'product/upsells', R);
      for (const p of published) {
        if (!full && upsold.size) break;
        const res = await call(`${path}?product_id=${encodeURIComponent(p.id)}&per_page=${PAGE_SIZE}`);
        if (res.status !== 200) return { error: `product/upsells for product ${p.id} answered HTTP ${res.status}` };
        const found = (listRows(res.body) ?? []).filter((r) => !Array.isArray(r.pages) || r.pages.includes('product'));
        if (found.length) upsold.set(String(p.id), [...(upsold.get(String(p.id)) ?? []), ...found]);
      }
    }
    const reached = published.filter((p) => upsold.has(String(p.id))).length;
    if (!full) return { count: everywhere ? 1 : Math.min(reached, 1) };
    return { count: everywhere ? published.length : reached, total: published.length, upsold, everywhere: everywhere?.label ?? null };
  }
  let query = spec.query;
  const instance = Number(ctx.store?.tracking_sm_id ?? 0);
  if (spec.scoped && instance > 0) query += `&tracking_instance_id=${instance}`;
  if (full && spec.slug === 'qty_offers') {
    const read = await walk(call, `${pathFor(spec.slug, spec.path, R)}?${query}`);
    return read.error ? { error: read.error } : { count: read.rows.length, rows: read.rows };
  }
  return countRows(call, `${pathFor(spec.slug, spec.path, R)}?${query}`);
}

/** The words after "on" in a decision ("on — only the six blenders: …"), the reason a partial reach was chosen. */
function decisionNote(v) {
  return typeof v === 'string' ? v.trim().replace(/^on\b[\s—–:,;-]*/i, '').trim() : '';
}

/** Products a share of the catalogue reaches — fine when the blueprint says which and why, otherwise a failure. */
function partialReach(feature, reached, total, reason) {
  if (!total || reached >= total) return null;
  if (reason.length >= MIN_REASON) return null;
  return `${feature} reaches ${reached} of ${total} published products.\n` +
    '      A feature the merchant ticked works only where it reaches. Extend it to the rest, or record which products\n' +
    `      and why in the blueprint's decision ("on — <which, and why: at least ${MIN_REASON} characters>").`;
}

/**
 * The upsell's goal: a reason to add the product. A title the shopper reads, a saving they can see,
 * card text where the cards show text, on the products the merchant meant. Measured on one build: a
 * strip with no title (`always_visible` dropped it), no saving and empty card text on 20 of 20
 * products, while "products carry upsells" passed.
 *
 * Read on the upsell design the product page's block picks (A, and B in an A/B test), by its look — the plugin's
 * own views (comps/upsells/frontend/views/look/): the cards show `look_header_title` in their header, which
 * `always_visible` hides unless `look_always_visible_header_is_active`; the tick boxes show `look_heading_text`; a
 * Bought together box `look_bought_together_heading_text`. The saving is `products_discount_value`, or an offered
 * product on sale (never in a Bought together box, which saves nothing at 0). Until the upsells design (04-11-2026)
 * all of this sat on the product design as `p_upsell_*`. A product sold through partners' links is shown with the
 * partner's button, not "add" (comps/upsells/frontend/views/look/cards/buttons.php): an upsell offering only those
 * is a recommendation and needs no saving. Measured on one store selling 14 of 20 products that way.
 */
async function goalUpsells(ctx, productsRead, rows, reason, call, R) {
  const problems = [];
  const notes = [];
  const byId = new Map(productsRead.rows.map((p) => [String(p.id), p]));
  const paired = [...new Set([...rows.upsold.values()].flat().map((u) => String(u.id)))].map((id) => byId.get(id)).filter(Boolean);
  const onSale = (p) => String(p.on_sale ?? '') === 'yes' || yes(p.on_sale) ||
    (Number(p.sale_price) > 0 && Number(p.sale_price) < Number(p.regular_price));
  for (const u of ctx.upsells.picked.filter((x) => x.block === 'p_upsell')) {
    const s = u.settings;
    const who = `${u.label} (picked by ${u.page})`;
    const ownPairs = (asArray(s.products_sources) ?? []).some((x) => x?.type === 'own_upsells');
    const picked = (asArray(s.products_picked_ids) ?? []).map((id) => byId.get(String(id))).filter(Boolean);
    const offered = u.look === 'bought_together' ? paired : [...new Set([...picked, ...(ownPairs ? paired : [])])];
    if (u.look === 'cards') {
      const title = String(s.look_header_title ?? '').trim();
      if (String(s.look_display_type) === 'always_visible' && !yes(s.look_always_visible_header_is_active)) {
        problems.push(`${who}: the upsell shows NO title — display type "always_visible" hides the header and its\n` +
          `      \`look_header_title\` (${JSON.stringify(clip(title, 40))}). Switch on \`look_always_visible_header_is_active\`\n` +
          '      or use a collapsible display type, so the shopper reads why these products are offered.');
      } else if (!title) {
        problems.push(`${who}: the upsell shows NO title — \`look_header_title\` is empty.`);
      }
    } else {
      const key = u.look === 'ticks' ? 'look_heading_text' : 'look_bought_together_heading_text';
      if (!String(s[key] ?? '').trim()) problems.push(`${who}: the upsell shows NO title — \`${key}\` is empty (the ${u.look} look).`);
    }
    const discount = Number(s.products_discount_value ?? 0);
    if (!(discount > 0) && !(u.look !== 'bought_together' && offered.some(onSale))) {
      // A product sold through partners' links shows the partner's button on an upsell card, not "add": nothing to
      // add here, so nothing to discount. Only the products a shopper can buy here need the saving.
      const away = offered.length ? await soldElsewhere(offered, call, R, ctx) : new Set();
      const here = offered.filter((p) => !away.has(String(p.id)));
      if (away.size && !here.length) {
        notes.push(`${who}: no saving, and every product it offers (${offered.length}) is sold through partners' links, so it\n` +
          '    is a recommendation: its cards show the partner\'s button, with nothing to add here or to discount.');
      } else {
        const hereIds = new Set(here.map((p) => String(p.id)));
        const pages = away.size ? [...rows.upsold].filter(([, list]) => list.some((x) => hereIds.has(String(x.id))))
          .map(([id]) => `${clip(byId.get(String(id))?.title ?? 'product', 30)} (#${id})`) : [];
        problems.push(`${who}: the upsell offers NO saving — \`products_discount_value\` is 0 and no product it offers\n` +
          '      is on sale — so it shows products at full price with no reason to add them. An offer is a promise: set the\n' +
          '      saving the merchant agreed to, and ask them when they have not said. Never invent one.' +
          (away.size ? `\n      ${away.size} of the ${offered.length} products it offers ${away.size === 1 ? 'is' : 'are'} sold through partners' links and need none. Sold\n` +
            `      here: ${here.slice(0, 5).map((p) => `${clip(p.title, 30)} (#${p.id})`).join(', ')}${here.length > 5 ? ' …' : ''}` +
            (pages.length ? `; offered on ${pages.slice(0, 3).join(', ')}${pages.length > 3 ? ` and ${pages.length - 3} more page(s)` : ''}` : '') + '.' : ''));
      }
    } else if (u.look === 'cards' && !yes(s.look_regular_price_is_active) && !yes(s.look_sale_price_is_active)) {
      problems.push(`${who}: the upsell has a saving, but both of its price displays are off, so nobody sees it.`);
    }
    if (u.look === 'cards' && yes(s.look_card_description_is_active) && offered.length &&
        offered.every((p) => !String(p.upsell_description ?? '').replace(/<[^>]*>/g, '').trim())) {
      problems.push(`${who}: upsell cards show a description, but none of the ${offered.length} product(s) it offers has an\n` +
        '      `upsell_description`, so every card\'s text line is empty. Write them on those products, or switch the\n' +
        '      description off.');
    }
  }
  const reach = rows.everywhere ? null : partialReach('the upsell', rows.count, rows.total, reason);
  if (reach) problems.push(reach);
  return { problems, notes };
}

/**
 * The products of a list a shopper cannot buy here: sold through partners' links. The plugin's own test
 * (AffiliateModelFR_cl::isBoxActive, comps/affiliate): the store's affiliate switch on (`affiliate/settings`
 * is_active, without it nothing affiliate registers), the product's own switch on and one usable link
 * (`product/affiliate`). Read once per product and kept on `ctx`; a store with no affiliate door sells all.
 */
async function soldElsewhere(products, call, R, ctx) {
  if (ctx.affiliateOn === undefined) {
    const res = await call(pathFor('affiliate_settings', 'affiliate/settings', R));
    ctx.affiliateOn = res.status === 200 && String(firstRow(res.body)?.is_active ?? '') === 'yes';
    ctx.linkOut = new Map();
  }
  const away = new Set();
  if (!ctx.affiliateOn) return away;
  for (const p of products) {
    const id = String(p.id);
    if (!ctx.linkOut.has(id)) {
      const res = await call(`${pathFor('product_affiliate', 'product/affiliate', R)}?product_id=${encodeURIComponent(id)}`);
      const row = res.status === 200 ? firstRow(res.body) : null;
      ctx.linkOut.set(id, String(row?.is_active ?? '') === 'yes' && (asArray(row?.links) ?? []).some((l) => l?.usable === true));
    }
    if (ctx.linkOut.get(id)) away.add(id);
  }
  return away;
}

/**
 * 28 — THE LIVE CHECK. Every check above reads the api; what a shopper sees is checked in the browser by
 * scripts/live-check.mjs (or joins.js pasted by hand: references/spacing.md → "The check"), and this gate takes their
 * saved results, never a word that they ran (`--joins <folder>`). It fails unless they cover every page the store
 * shows — home, a category, the all-products page, a product, a missing page, and every published page — each at a
 * phone (under 768px), a medium (768–1023), an expanded (1024–1199) and a large width (1200 and more), and each overlay
 * the store has (the quick view, the cart drawer, the checkout pop-up) open at those widths. A result counts when it is
 * of this site, under a day old, measured by a joins.js with the spacing laws against the STORE's steps (its Spacing
 * designs), at a phone width in a phone's browser (the store prints other HTML for phones) and laid out at the width
 * it says. Each finding: fixed — or accepted with an id, never a sentence: `{ "check", "where", "ledger": "<id>" }`
 * for a known limit of this plugin version (KNOWN_LIMITS), `{ "check", "where", "decision": "<id>" }` for a decision
 * the merchant took, recorded in the blueprint's `spacing.decisions`. Measured on one build: every finding of the
 * old pass carried a written reason, and the gate passed while the merchant's marked faults stood on the store.
 */
const KNOWN_LIMITS = [
  // { id, check, design (the finding's `design` starts with), where (pattern), what, fixed_in (plugin version, or null) }
  { id: 'popup-close-40px', check: 'small-target', where: /cl-modal-close-x/, what: "every pop-up's, drawer's and quick view's close is drawn 40 × 40 with no tap area", fixed_in: '1.2.2038' },
  { id: 'footer-contact-tap-area', check: 'small-target', design: /^footer/, where: /contact|social/i, what: "the footer's contact and social links have no tap area and no key to give them one", fixed_in: '1.2.2037' },
  { id: 'affiliate-box-spaces', check: 'L6', design: /^affiliate/, where: /affiliate/i, what: "the affiliate box's two spaces are px numbers, one value for every width, outside the Spacing designs", fixed_in: null },
];
const BANDS = [['phone', (w) => w < 768], ['medium', (w) => w >= 768 && w < 1024], ['expanded', (w) => w >= 1024 && w < 1200], ['large', (w) => w >= 1200]];
const bandOf = (w) => BANDS.find(([, t]) => t(w))?.[0] ?? 'large';
const olderThan = (v, fix) => { const a = parseVersion(v); const b = parseVersion(fix); if (!a || !b) return true; for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i]; return false; };
function knownLimitOf(fd, pluginVersion) {
  return KNOWN_LIMITS.find((k) => k.check === fd.check && (!k.design || k.design.test(String(fd.design ?? ''))) && (!k.where || k.where.test(String(fd.where ?? '')))
    && (k.fixed_in === null || olderThan(pluginVersion, k.fixed_in))) || null;
}

function checkJoins(dir, site, store, quickview, ctx = {}) {
  const how = '      Run scripts/live-check.mjs <site> <key> (references/spacing.md → "The check") and pass its folder: --joins <folder>.\n' +
    '      A page it cannot open (a host\'s bot check): joins.js pasted into the page, each result saved as a .json file there.';
  if (!dir) {
    return { problems: ['NO LIVE CHECK: no result was given (--joins <folder>), so nothing a shopper sees on a page was checked —\n' +
      `      only what the api says.\n${how}`] };
  }
  let files;
  try { files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.json')); } catch (e) {
    return { problems: [`NO LIVE CHECK: the folder ${dir} could not be read (${e.code || e.message}).\n${how}`] };
  }
  // A page by its path (the host is checked on its own, below).
  const norm = (u) => { try { return new URL(u).pathname.replace(/\/+$/, '').toLowerCase(); } catch { return String(u); } };
  const hostOf = (u) => new URL(u).host.replace(/^www\./i, '');
  const host = hostOf(site);
  const results = [];
  const refused = [];
  const notes = [];
  for (const f of files) {
    let j;
    try { j = JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { refused.push(`${f}: not JSON`); continue; }
    if (j?.tool === 'live-check.mjs') {
      for (const n of asArray(j.not_measured) ?? []) notes.push(`not measured by the live check: ${n}`);
      for (const p of asArray(j.pages) ?? []) for (const e of asArray(p.errors) ?? []) notes.push(`${p.url} — ${e}`);
      continue;
    }
    if (j?.tool !== 'joins.js' || !Array.isArray(j.findings)) { refused.push(`${f}: not a joins.js result`); continue; }
    let h = '';
    try { h = hostOf(j.source); } catch { /* reported below */ }
    const at = Date.parse(j.measured_at ?? '');
    const w = Number(j.viewport?.width) || 0;
    const laidOut = Number(j.viewport?.content_width) || w;
    if (h !== host) refused.push(`${f}: measured ${j.source || 'no page'}, not this site`);
    else if (!(at > 0)) refused.push(`${f}: no measured_at — a joins.js older than this gate: run the one beside it`);
    else if (Date.now() - at > 24 * 3600e3) refused.push(`${f}: measured ${j.measured_at}, over a day ago — measure again`);
    else if (!j.spacing) refused.push(`${f}: measured by a joins.js without the spacing laws — run the one beside this gate`);
    else if (/shipped/i.test(String(j.spacing.steps_from ?? ''))) refused.push(`${f}: measured against the plugin's shipped steps, not this store's — set window.CL_SPACING (or use live-check.mjs)`);
    else if (w < 768 && j.phone_browser === false) refused.push(`${f}: a phone width (${w}px) in a computer's browser — the store prints other HTML for phones: a phone user agent`);
    else if (w <= 1024 && Math.abs(laidOut - w) > 1) refused.push(`${f}: laid out ${laidOut}px wide in a ${w}px window (a scrollbar, a clamped frame) — not a ${w}px measurement`);
    else if (j.opened && !(asArray(j.overlays_open) ?? []).length) refused.push(`${f}: labelled "${j.opened}" open, but joins.js saw no panel open`);
    else results.push({ f, j, w: laidOut, page: norm(j.source), type: String(j.page_type ?? '').trim().toLowerCase(), opened: String(j.opened ?? '').trim().toLowerCase() });
  }
  // What the store shows: every published page, and the page types a shopper meets.
  const want = [];
  const homeKey = norm(site);
  want.push({ name: 'home', ok: (r) => r.page === homeKey || r.type === 'home' });
  want.push({ name: 'a category', ok: (r) => r.type === 'category' || /\/product[_-]cat(egory)?\//.test(r.page) });
  want.push({ name: 'the all-products page', ok: (r) => r.type === 'all products' || /\/product$/.test(r.page) });
  want.push({ name: 'a product', ok: (r) => r.type.startsWith('product') && r.type !== 'products' || /\/product\/[^/]+$/.test(r.page) });
  want.push({ name: 'a missing page (404)', ok: (r) => r.type === '404' });
  const thankyouId = Number(store?.thankyou_page_id);
  for (const p of ctx.pages ?? []) {
    if (String(p.status ?? 'publish') !== 'publish' || !p.url || Number(p.id) === thankyouId) continue;
    const key = norm(p.url);
    if (key === homeKey) continue;
    want.push({ name: `page "${clip(String(p.title ?? p.slug ?? key), 30)}"`, ok: (r) => r.page === key });
  }
  const missing = [];
  for (const wnt of want) {
    const bands = BANDS.map(([b]) => b).filter((b) => !results.some((r) => !r.opened && wnt.ok(r) && bandOf(r.w) === b));
    if (bands.length) missing.push(`${wnt.name} at a ${bands.join(', ')} width`);
  }
  const overlays = [];
  if (quickview) overlays.push('quick view');
  if (/^modal_(left|right)$/.test(String(store?.cart_mode ?? ''))) overlays.push('cart drawer');
  if (String(store?.checkout_mode ?? '') === 'modal') overlays.push('checkout popup');
  for (const o of overlays) {
    const bands = BANDS.map(([b]) => b).filter((b) => !results.some((r) => r.opened === o && bandOf(r.w) === b));
    if (bands.length) missing.push(`the ${o} open at a ${bands.join(', ')} width`);
  }
  if (thankyouId && !results.some((r) => r.type === 'thank-you')) notes.push('the thank-you page was NOT measured: it needs an order — pass live-check.mjs --thankyou <its address after a test order>');
  // Each finding: fixed, or accepted with an id that holds.
  const decisionIds = new Set((asArray(ctx.decisions) ?? []).map((d) => String(d?.id ?? '').trim()).filter(Boolean));
  const open = [];
  const badIds = [];
  const freeText = [];
  for (const r of results) {
    const accepted = asArray(r.j.accepted) ?? [];
    for (const fd of r.j.findings) {
      const a = accepted.find((x) => x?.check === fd.check && x?.where === fd.where);
      const limit = knownLimitOf(fd, ctx.pluginVersion);
      if (a?.ledger !== undefined) {
        if (limit && String(a.ledger) === limit.id) continue;
        const k = KNOWN_LIMITS.find((x) => x.id === String(a.ledger));
        badIds.push(`${r.f}: ${fd.check} ${clip(String(fd.where), 40)} — ledger "${a.ledger}" ${!k ? 'is no known limit' : k.fixed_in && !olderThan(ctx.pluginVersion, k.fixed_in) ? `was fixed in plugin ${k.fixed_in}: fix the finding` : 'does not match this finding'}`);
      } else if (a?.decision !== undefined) {
        if (decisionIds.has(String(a.decision))) continue;
        badIds.push(`${r.f}: ${fd.check} ${clip(String(fd.where), 40)} — decision "${a.decision}" is not in the blueprint's spacing.decisions`);
      } else if (a) freeText.push(`${r.f}: ${fd.check} ${clip(String(fd.where), 40)}`);
      open.push({ r, fd, limit });
    }
  }
  const problems = [];
  if (refused.length) {
    problems.push(`${refused.length} result(s) do not count:\n` + refused.slice(0, 8).map((x) => `        ${x}`).join('\n') +
      (refused.length > 8 ? `\n        … and ${refused.length - 8} more` : ''));
  }
  if (missing.length) {
    problems.push(`THE LIVE CHECK IS NOT COMPLETE — no result for:\n` + missing.slice(0, 20).map((m) => `        ${m}`).join('\n') +
      (missing.length > 20 ? `\n        … and ${missing.length - 20} more` : '') + '\n' +
      '      Each page looks different at each width, and what an overlay holds is checked only while it is open.\n' + how);
  }
  if (freeText.length) {
    problems.push(`${freeText.length} finding(s) accepted with a written reason, which no longer counts:\n` + freeText.slice(0, 6).map((x) => `        ${x}`).join('\n') + '\n' +
      '      Fix each one, or accept it with an id: "ledger" (a known limit of this plugin, named below when one matches) or\n' +
      '      "decision" (the merchant\'s, recorded in the blueprint\'s spacing.decisions — blueprint-format.md).');
  }
  if (badIds.length) problems.push(`${badIds.length} accepted id(s) do not hold:\n` + badIds.slice(0, 8).map((x) => `        ${x}`).join('\n'));
  if (open.length) {
    const byCheck = new Map();
    for (const o of open) byCheck.set(o.fd.check, (byCheck.get(o.fd.check) ?? 0) + 1);
    problems.push(`${open.length} finding(s) neither fixed nor accepted with an id (${[...byCheck].map(([c, n]) => `${n} ${c}`).join(', ')}):\n` +
      open.slice(0, 10).map((o) => `        ${o.r.f} @${o.r.w}: ${o.fd.check}${o.fd.rule ? ` (${o.fd.rule})` : ''} ${clip(String(o.fd.where), 50)} — ${clip(String(o.fd.detail), 90)}` +
        (o.limit ? `\n          a known limit of plugin ${ctx.pluginVersion ?? '?'}: ${o.limit.what} — accept with { "check", "where", "ledger": "${o.limit.id}" }` : '')).join('\n') +
      (open.length > 10 ? `\n        … and ${open.length - 10} more` : '') + '\n' +
      '      Fix each one and measure again. Only a known plugin limit or a decision the merchant took keeps one: references/spacing.md\n' +
      '      → "The check". A finding you are sure is wrong is the check\'s fault: say so in your report, with the finding.');
  }
  return { problems, notes, pass: `the live check covers ${want.length} page(s) at four widths${overlays.length ? ` and ${overlays.join(', ')} open` : ''}, every finding fixed or accepted with an id (${results.length} result(s))` };
}

/**
 * Quantity offers' goal: a saving for buying more, on the products the merchant meant. An offer
 * counts only with at least two tiers and a saving on a tier above one unit — the seeded catalogue-wide
 * offer ships switched off, and an offer of one tier, or of tiers with nothing off, gives no reason
 * to buy two. Measured on one build: one offer, on 1 product of 20, passed.
 */
async function goalOffers(ctx, productsRead, rows, reason, call, R) {
  const problems = [];
  const saves = (t) => Number(t?.quantity) > 1 && (Number(t?.discount_per_product) > 0 || Number(t?.offered_quantity) > 0);
  const real = rows.rows.filter((o) => Array.isArray(o.tiers) && o.tiers.length >= 2 && o.tiers.some(saves));
  if (!real.length) {
    problems.push(`${rows.rows.length} active quantity offer(s), and none has two tiers with a saving above one unit, so the\n` +
      '      offer box gives no reason to buy more. Set the tiers the merchant agreed to (/docs/qty_offer_writes).');
    return { problems, notes: [] };
  }
  const published = productsRead.rows.filter((p) => String(p.status ?? 'publish') === 'publish');
  let reached = 0;
  if (real.some((o) => o.application_scope === 'all_products')) {
    reached = published.length;
  } else {
    const cats = await walk(call, pathFor('categories', 'categories', R));
    const slugOf = new Map((cats.rows ?? []).map((c) => [String(c.id), String(c.slug)]));
    const inCats = new Set(real.filter((o) => o.application_scope === 'category').map((o) => slugOf.get(String(o.application_target))).filter(Boolean));
    const single = new Set(real.filter((o) => o.application_scope === 'single_product').map((o) => String(o.application_target)));
    reached = published.filter((p) => single.has(String(p.id)) || (asArray(p.category_slugs) ?? []).some((s) => inCats.has(String(s)))).length;
  }
  const reach = partialReach('quantity offers', reached, published.length, reason);
  if (reach) problems.push(reach);
  return { problems, notes: [] };
}

/* ── 13. custom blocks: content, checked like a page ───────────────────────────────────────────── */

/** `codbrand-content-builder`'s validator — the only check that looks INSIDE a Custom HTML block,
 *  which WordPress's own check accepts whatever it holds. Looked for BESIDE THIS SKILL first: the two
 *  are installed side by side (`<skills>/codbrand-store-blueprint/scripts/handover.mjs` and
 *  `<skills>/codbrand-content-builder/`), so the copy installed with this blueprint is found from any
 *  working folder — the path as invoked (a linked install keeps its own) and as resolved. Then the two
 *  places preflight.mjs looks: the home skills folder and the working folder's. Measured: run from a
 *  folder with no `.claude/skills/`, the check reported every block NOT CHECKED with the skill
 *  installed. */
function findContentBuilderValidator() {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const beside = [process.argv[1], fileURLToPath(import.meta.url)].filter(Boolean)
    .map((p) => join(dirname(dirname(dirname(resolve(p)))), 'codbrand-content-builder'));
  for (const root of [...beside, join(home, '.claude', 'skills', 'codbrand-content-builder'),
    join(process.cwd(), '.claude', 'skills', 'codbrand-content-builder')]) {
    if (!existsSync(join(root, 'SKILL.md'))) continue;
    const script = join(root, 'scripts', 'validate_pattern.mjs');
    return existsSync(script) ? { script }
      : { missing: `${root} has no scripts/validate_pattern.mjs — the skill's other half was never fetched` };
  }
  return { missing: 'codbrand-content-builder is not installed (preflight.mjs checks for it too)' };
}

/** Does this markup use a layout setting — the kind whose CSS WordPress prints while it renders the
 *  page? A block comment carrying `layout` (a row, a stack, a grid, a constrained group) or a block gap. */
function hasLayoutSettings(content) {
  for (const m of String(content ?? '').matchAll(/<!--\s*wp:[\w/-]+\s+(\{[\s\S]*?\})\s*\/?-->/g)) {
    if (/"(layout|blockGap)"\s*:/.test(m[1])) return true;
  }
  return false;
}

const clip = (s, n) => { const t = String(s).replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

/**
 * Every custom block the store SHOWS, and what content-builder's validator says about each.
 * Shown = a placement on a design, a layout surface (`<surface>_layout_config` entries of type
 * `custom_block`), or a product's `extra_description_block_id`. A block shown nowhere is skipped: the
 * shopper never sees it. A block kept with `--block-kept` is not validated — it is not this build's.
 */
async function checkCustomBlocks(call, R, store, productsRead, kept, blockGap = null) {
  const read = await walk(call, pathFor('custom_blocks', 'custom_blocks', R));
  if (read.error) return { skipped: `could not read the custom blocks — ${read.error}`, rows: [] };
  const byId = new Map(read.rows.map((b) => [Number(b.id), b]));

  const where = new Map();
  const shownAt = (id, place) => { const n = Number(id); if (n > 0) where.set(n, [...(where.get(n) ?? []), place]); };
  const deferred = [];
  for (const b of read.rows) {
    for (const p of asArray(b.placements) ?? []) {
      shownAt(b.id, `${p.consumer_compo} design ${p.consumer_instance_id}`);
      if (p.render_mode === 'after_page_load' && hasLayoutSettings(b.content)) deferred.push({ block: b, placement: p });
    }
  }
  for (const [key, value] of Object.entries(store ?? {})) {
    if (!key.endsWith('_layout_config')) continue;
    let cfg = value;
    if (typeof cfg === 'string') { try { cfg = JSON.parse(cfg); } catch { cfg = null; } }
    const surface = key.slice(0, -'_layout_config'.length);
    const pages = (cfg?.pages && typeof cfg.pages === 'object') ? Object.entries(cfg.pages) : [];
    for (const [context, d] of [['default', cfg?.default], ...pages]) {
      if (d && d.type === 'custom_block') shownAt(d.id, `the store's ${surface}${context === 'default' ? '' : ` on ${context} pages`}`);
    }
  }
  if (!productsRead.error) {
    for (const p of productsRead.rows) {
      if (Number(p.extra_description_block_id) > 0) shownAt(p.extra_description_block_id, `product ${p.id}'s extra description`);
    }
  }

  const out = { shown: where.size, deferred, missing: [], failing: [], warned: [], unreadable: [], kept: [], shortReason: [],
    keptNotShown: [...kept.keys()].filter((id) => !where.has(Number(id))), productsUnread: !!productsRead.error, checked: 0,
    rows: read.rows.filter((b) => where.has(Number(b.id))), blockGap };
  const toValidate = [];
  for (const [id, places] of where) {
    const block = byId.get(id);
    if (!block) { out.missing.push({ id, places }); continue; }
    const reason = kept.get(String(id));
    if (reason !== undefined) {
      if (reason.length >= MIN_REASON) out.kept.push({ block, reason });
      else out.shortReason.push({ block, places });
      continue;
    }
    toValidate.push({ block, places });
  }
  if (!toValidate.length) return out;

  const validator = findContentBuilderValidator();
  if (!validator.script) return { ...out, notChecked: validator.missing, pending: toValidate.length };
  const dir = mkdtempSync(join(tmpdir(), 'handover-blocks-'));
  try {
    for (const { block, places } of toValidate) {
      const file = join(dir, `custom-block-${block.id}.html`);
      writeFileSync(file, String(block.content ?? ''));
      // Block spacing read from the home page (blockGapFrom()): with support there, the validator's
      // "confirm it" warning has nothing left to ask.
      const args = [validator.script, file, ...(blockGap === true ? ['--block-gap=supported'] : [])];
      const run = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 60000 });
      let report = null;
      try { report = JSON.parse(run.stdout); } catch { /* no report: said below */ }
      if (!report || !Array.isArray(report.errors)) {
        out.unreadable.push({ block, places, why: clip(run.stderr || run.error?.message || 'the validator printed no report', 160) });
        continue;
      }
      out.checked++;
      const warnings = asArray(report.warnings) ?? [];
      if (report.errors.length) out.failing.push({ block, places, errors: report.errors, warnings });
      else if (warnings.length) out.warned.push({ block, warnings });
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return out;
}

/* ── 20 · words a shopper reads that were written for the merchant ─────────────────────────────────────
 * Notes to the merchant belong in the hand-over and its replace-list, never on a page ("Tell us why you
 * started the brand…", "Send us the real ones…"): measured on one store, six pages and thirty reviews
 * carried them, and every check passed. The placeholders this skill prescribes are a different thing — a
 * merchant's own build shows them on purpose (SKILL.md → "Asking") — but a SHOWCASE store, recorded as one in
 * its blueprint (`purpose`), must read as a real store, so there they fail. */

/* The placeholders the skill itself writes: a contact number whose digits are X ("+212 6XX XXX XXX"), an address
 * at "yourstore". Written the same way in every language, so they are found in any. A number needs four X or more
 * and no letter after them: a size table's "36 XXL" is not one (measured on one store's size guide). */
const PLACEHOLDER_MARKS = [
  (t) => {
    for (const m of t.matchAll(/[+\d][\d\s.()-]*X[X\d\s.()-]*/g)) {
      const s = m[0].replace(/[\s.()-]+$/, '');
      if ((s.match(/X/g) || []).length >= 4 && /\d/.test(s) && !/[A-Za-z]/.test(t[m.index + s.length] ?? '')) return s;
    }
    return undefined;
  },
  (t) => (t.match(/yourstore/i) || [])[0],
];
/* Words that mark a placeholder the merchant was meant to SEE — the unverified legal draft, a sample review.
 * English, French and Arabic, the languages this skill's stores are most often written in. */
const PLACEHOLDER_WORDS = ['unverified draft', 'to be completed', 'sample review', 'lorem ipsum',
  'brouillon non vérifié', 'à compléter', "avis d'exemple", 'مسودة', 'نص مؤقت'];
/* Words written TO the merchant: a request a shopper must never read. A heuristic, so a warning. */
const MERCHANT_NOTE_WORDS = ['placeholder', 'before launch', 'generic draft', 'confirm or correct', 'not yours yet',
  'in your words', 'send us the real', 'tell us why', 'replace with a real', 'espace réservé', 'avant le lancement',
  'dites-nous pourquoi', 'envoyez-nous les vrais', 'قبل الإطلاق'];

/** The words of markup as a shopper reads them: no tags, no block comments, the common entities decoded. */
function readableText(html) {
  return String(html ?? '').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&#0?39;|&apos;|&rsquo;/g, "'").replace(/\s+/g, ' ').trim();
}

/** Every place a shopper reads that still carries a placeholder or a note to the merchant. */
function scanShopperText(sources) {
  const placeholders = new Map();
  const notes = new Map();
  const hit = (map, where, what) => { if (!map.has(where)) map.set(where, new Set()); map.get(where).add(what); };
  for (const { where, text } of sources) {
    const t = readableText(text);
    if (!t) continue;
    const lower = t.toLowerCase();
    for (const mark of PLACEHOLDER_MARKS) { const m = mark(t); if (m) hit(placeholders, where, `"${clip(m.trim(), 30)}"`); }
    for (const w of PLACEHOLDER_WORDS) if (lower.includes(w)) hit(placeholders, where, `"${w}"`);
    for (const w of MERCHANT_NOTE_WORDS) if (lower.includes(w)) hit(notes, where, `"${w}"`);
  }
  return { placeholders, notes };
}

/** Every string a design shows, collected from its settings — repeater rows included. */
function designStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => designStrings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => designStrings(v, out));
  return out;
}

/* ── 21 · what WordPress left, and the store page nothing links to ─────────────────────────────────────
 * WordPress's own sample page and first post stay published until someone removes them, and a store page
 * no menu, footer or page links to is a page no shopper finds. Measured on one store: the sample page (with
 * a link into wp-admin) and "Hello world!" published; the order-tracking and reviews pages linked from
 * nowhere. Links are read from the RENDERED pages, as a visitor follows them, so a link a design or a
 * plugin block draws counts. */
async function checkLeftovers(call, R, store, pagesRead, siteUrl, publicHome) {
  const problems = [];
  const notes = [];
  if (pagesRead.error) return { problems, notes: [`WordPress's sample content and unlinked pages were NOT checked — ${pagesRead.error}.`] };
  const published = pagesRead.rows.filter((p) => String(p.status ?? 'publish') === 'publish');
  const leftovers = published.filter((p) => p.slug === 'sample-page').map((p) => `the page "${clip(p.title ?? '', 40)}" (/${p.slug}/)`);
  const posts = await walk(call, pathFor('posts', 'posts', R));
  if (!posts.error) {
    leftovers.push(...posts.rows.filter((p) => p.slug === 'hello-world' && String(p.status ?? 'publish') === 'publish')
      .map((p) => `the post "${clip(p.title ?? '', 40)}" (/${p.slug}/)`));
  }
  if (leftovers.length) {
    problems.push(`WordPress's sample content is still published: ${leftovers.join(', ')}. A shopper can land on it, and the\n` +
      '      sample page links into wp-admin. Take it off the site through the pages and posts doors.');
  }
  if (!publicHome.store) {
    notes.push('pages that no link reaches were NOT looked for: the home page did not show the store to a logged-out visitor.');
    return { problems, notes };
  }
  /* The store's own links, whatever host spelling they carry: the address this run was given, and the one the
   * pages door reports (they differ behind a proxy, and between www and no www). */
  const hostOf = (url) => { try { return new URL(url, `${siteUrl}/`).host.replace(/^www\./, ''); } catch { return null; } };
  const hosts = new Set([hostOf(siteUrl), ...published.map((p) => p.url && hostOf(p.url))].filter(Boolean));
  const pathOf = (url) => { try { return new URL(url, `${siteUrl}/`).pathname.replace(/\/+$/, '') || '/'; } catch { return null; } };
  /* Only a link a shopper can follow (`<a href>`) and only to ANOTHER page: every page names itself in its own
   * head (canonical, shortlink), which on one store made every page look linked. */
  const linked = new Set();
  const collect = (html, self) => {
    for (const m of String(html).matchAll(/<a\b[^>]*?\bhref=["']([^"'#\s]+)/gi)) {
      const path = pathOf(m[1]);
      if (hosts.has(hostOf(m[1])) && path !== self) linked.add(path);
    }
  };
  collect(publicHome.html, '/');
  for (const p of published) {
    const path = pathOf(p.url ?? `/${p.slug}/`);
    if (!path) continue;
    try {
      await pace();
      const res = await fetch(`${siteUrl}${path}/`, { redirect: 'follow', headers: { Accept: 'text/html' } });
      collect(await res.text(), path);
    } catch { /* an unreadable page adds no link */ }
  }
  /* The pages a shopper reaches by acting, not by a link: the cart, the checkout, the thank-you page, search. */
  const reached = new Set(['cart_page_id', 'checkout_page_id', 'thankyou_page_id', 'search_page_id'].map((k) => Number(store?.[k])).filter((n) => n > 0));
  const front = (p) => p.is_front_page === true || String(p.is_front_page) === 'yes';
  const unlinked = published.filter((p) => !reached.has(Number(p.id)) && !front(p) && !linked.has(pathOf(p.url ?? `/${p.slug}/`)));
  if (unlinked.length) {
    notes.push(`${unlinked.length} published page(s) no menu, footer or page links to, so no shopper finds them: ` +
      unlinked.slice(0, 10).map((p) => `"${clip(p.title ?? '', 30)}" (/${p.slug}/)`).join(', ') + (unlinked.length > 10 ? ', …' : '') + '.\n' +
      '    Link each from a menu or the footer, or take it off the site when it is not meant for shoppers.');
  }
  return { problems, notes };
}

/* ── 22 · the popup with no panel ──────────────────────────────────────────────────────────────────────
 * A popup's box is `.cl_modal_container`, white unless a card design or style on it says otherwise. A card
 * design that paints it transparent leaves the popup's text straight on the page behind — measured on one
 * store, a thank-you upsell shown as a modal over the order lines. Read from each design's own
 * style_generator: any card design or style whose selector reaches the popup's box, on a design whose
 * matching `*_display_type` (when it has one) shows that popup.
 *
 * Since the upsells design (04-11-2026) an upsell's popups are dressed on the upsell the page's block picks, each shown
 * by its own setting (read on dev1's upsells 234 and 254, 12-11-2026): the thank-you popup's box
 * `look_modal_container_preset` while `look_placement` is `popup`, the cart's after-add and before-checkout pop-ups'
 * while it is `after_add` / `before_checkout`, the "added" confirmation's while `look_success_feedback` shows it —
 * never inside a cart pop-up, where the plugin answers an add with the toast (one pop-up at a time). */
const SUCCESS_POPUP = (s) => ['modal', 'both'].includes(String(s.look_success_feedback ?? 'both'))
  && !['after_add', 'before_checkout'].includes(String(s.look_placement));
const UPSELL_POPUPS = {
  look_modal_container_preset: (s) => s.look_placement === 'popup',
  look_after_add_container_preset: (s) => s.look_placement === 'after_add',
  look_before_checkout_container_preset: (s) => s.look_placement === 'before_checkout',
  look_success_modal_preset: SUCCESS_POPUP,
  look_success_modal_style: SUCCESS_POPUP,
};
function checkPopupPanels(designs, presetsById, resolve) {
  const problems = [];
  for (const d of designs) {
    for (const [key, cfg] of Object.entries(d.styleGen ?? {})) {
      if (!String(cfg?.css_selector ?? '').includes('.cl_modal_container')) continue;
      const prefix = key.replace(/_(container_)?(preset|style)$/, '');
      const display = d.upsell ? undefined : d.settings[`${prefix}_display_type`];
      if (d.upsell ? !(UPSELL_POPUPS[key]?.(d.settings) ?? true) : display !== undefined && !/modal/.test(String(display))) continue;
      const active = d.upsell ? undefined : d.settings[`${prefix}_is_active`];
      if (active !== undefined && !yes(active)) continue;
      let maps = [];
      let what = `\`${key}\``;
      if (key.endsWith('_preset')) {
        const preset = presetsById.get(String(d.settings[key]));
        const at = presetAt(preset);
        if (at) { maps = [at.desktop, at.phone]; what = `\`${key}\` (card design #${preset.id} "${clip(preset.title ?? '', 30)}")`; }
      } else if (key.endsWith('_style')) {
        maps = [cascade(new Map(), d.settings[key])];
      }
      if (!maps.some((m) => m.has('background-color') && paintOf(m, resolve).none)) continue;
      problems.push(`${d.label}: the popup ${display !== undefined ? `\`${prefix}_display_type\` = \`${display}\` ` : ''}opens with no panel — ` +
        `${what} paints its box\n      transparent, so its text sits straight on the page behind it. Give that card design a ` +
        'background (clone it first when other\n      surfaces use it), or point the key at one that has.');
    }
  }
  return problems;
}

/* ── 23 · the custom code nobody reviewed ──────────────────────────────────────────────────────────────
 * Custom CSS and JS at any level — the store, a design, a page, a product — is the last door, and the one
 * no other check reads. Measured on one store: a third of its custom rules did nothing (CSS aimed inside a
 * design nested in another stops at its edge), a few repeated a setting, two broke the layout between
 * phone and desktop widths, and a custom-JS sort reordered only the cards already loaded. Listed here so
 * each piece is reviewed; whether a rule applies is measured in the browser (joins.js → dead-scoped-css).
 * Every design a shopper meets is listed, with where it shows: the store row's, those shownDesigns() finds placed or
 * named elsewhere, and the upsells the pages' blocks pick — measured on one store, three designs with custom CSS
 * placed only on pages, in a custom block or by another design were missed while only the store row's were read. */
function listCustomCode(store, designs, pagesRead, productsRead) {
  const pieces = [];
  let readable = false;
  const lines = (s) => String(s).split('\n').filter((l) => l.trim()).length;
  const add = (where, css, js) => {
    if (css === undefined && js === undefined) return;
    readable = true;
    const parts = [];
    if (String(css ?? '').trim()) parts.push(`CSS ${lines(css)} line(s)`);
    if (String(js ?? '').trim()) parts.push(`JS ${lines(js)} line(s)`);
    if (parts.length) pieces.push(`${where}: ${parts.join(', ')}`);
  };
  add('the store', store?.custom_css, store?.custom_js);
  const places = (w) => w.slice(0, 3).join('; ') + (w.length > 3 ? `; and ${w.length - 3} more place(s)` : '');
  for (const d of designs) add(`design ${d.label}${d.where?.length ? ` (${places(d.where)})` : ''}`, d.custom?.css, d.custom?.js);
  for (const p of pagesRead.rows ?? []) if (String(p.status ?? 'publish') === 'publish') add(`page "${clip(p.title ?? '', 30)}"`, p.custom_css, p.custom_js);
  for (const p of productsRead.rows ?? []) add(`product "${clip(p.title ?? '', 30)}"`, p.custom_css, p.custom_js);
  return { readable, pieces };
}

/* ── 25 · the cramped filter drawer ────────────────────────────────────────────────────────────────────
 * On a phone the filter opens as a drawer (`filter_layout` / `filter_layout_mobile` `modal_left` or
 * `modal_right`). Its padding is its own `filter_drawer_style` side by side, else its card design's and
 * `filter_container_style`'s; its close button is an icon design. Measured on one store: a card made for page
 * gutters on the drawer (no room above, 48px each side) and a close × of 16 × 22. Above 24px of padding the
 * drawer gives the filters' room away; under 44px the close button is smaller than a thumb. */
const pxOf = (v) => {
  const m = String(v ?? '').trim().match(/^(-?\d+(?:\.\d+)?)(px|r?em)?$/);
  return m ? Number(m[1]) * (m[2] && m[2] !== 'px' ? 16 : 1) : NaN;
};
function checkFilterDrawers(designs, presetsById) {
  const notes = [];
  for (const d of designs) {
    const s = d.settings;
    if (!('filter_drawer_style' in s) || ('filter_is_active' in s && !yes(s.filter_is_active))) continue;
    /* A drawer on computers (`filter_layout`), on phones (`filter_layout_mobile`), or both: each is judged with
     * its own breakpoint's values — a card can pad 48px on desktop and 20px on phones. */
    const where = [['computers', 'desktop', 'filter_layout'], ['phones', 'phone', 'filter_layout_mobile']]
      .filter(([, , k]) => /^modal_/.test(String(s[k] ?? '')));
    if (!where.length) continue;
    const own = cascade(new Map(), s.filter_drawer_style);
    const card = presetAt(presetsById.get(String(s.filter_container_preset)));
    const wide = [];
    for (const [bp, map] of where) {
      const base = cascade(new Map(card?.[map] ?? []), s.filter_container_style);
      const side = (p) => pxOf(own.get(p)?.value ?? base.get(p)?.value ?? '0');
      for (const p of ['padding-top', 'padding-left', 'padding-right']) if (side(p) > 24) wide.push(`${p} ${side(p)}px on ${bp}`);
    }
    const close = presetsById.get(String(s.filter_drawer_close_preset));
    const at = presetAt(close);
    const atMap = at?.[where.some(([, m]) => m === 'phone') ? 'phone' : 'desktop'];
    const size = (p) => pxOf(atMap?.get(`min-${p}`)?.value ?? atMap?.get(p)?.value);
    const small = close && !(size('width') >= 44 && size('height') >= 44);
    if (!wide.length && !small) continue;
    const said = [];
    if (wide.length) said.push(`pads its content ${wide.join(', ')} — over 24px, room taken from the filters`);
    if (small) said.push(`closes with icon design #${close.id} "${clip(close.title ?? '', 30)}", which ` +
      (Number.isNaN(size('width')) && Number.isNaN(size('height')) ? 'sets no size, so the button is only as big as its icon'
        : `is ${Number.isNaN(size('width')) ? '?' : size('width')} × ${Number.isNaN(size('height')) ? '?' : size('height')}px`) + ' — under the 44 × 44 a thumb needs');
    notes.push(`${d.label}: the filter drawer ${said.join('; and it ')}. Pad the drawer through \`filter_drawer_style\`\n` +
      '    and give its close button an icon design of 44px or more (/docs/plist1_global_settings → "The drawer").');
  }
  return notes;
}

/* ── 26 · one card, several looks ──────────────────────────────────────────────────────────────────────
 * A store can show product cards through several listing designs — the shop, the category pages, a row on
 * the home page, a recommended row — and each is styled on its own. Measured on one store: tags top-left on
 * three listings and top-right on the home page's, and titles in small capitals on one row only. The designs
 * found: the store's own, a category page's `design_template`, and those a page or a shown custom block
 * names (`"instanceId"` of a `cl/plist1` block, `id` of a `[cl_plist1]` shortcode). Differences are listed for
 * the merchant to confirm, never failed: a different look can be meant. */
const LOOK_KEYS = {
  plist1: ['product_tags_photo_position', 'discount_photo_position', 'stock_badge_photo_position', 'product_title_preset',
    'regular_price_text_preset', 'sale_price_text_preset', 'single_product_preset', 'product_image_container_style'],
};
/* How a page or a custom block places a design, by the plugin's own names (its `block.json` files and
 * `add_shortcode()` calls, read 12-11-2026): the block → the design type and the attributes naming the design. A
 * listing block with no `instanceId` shows the store's own design. */
const PLACED_BLOCKS = { 'products-listing': ['plist1', ['instanceId']], catlist: ['catlist', ['instanceId']],
  reviewlist: ['reviewlist', ['instanceId']], slider: ['slider', ['instanceId', 'phoneInstanceId']] };
const PLACED_SHORTCODES = { products: ['plist1', ['id']], cl_catlist: ['catlist', ['id']],
  cl_reviewlist: ['reviewlist', ['id']], cl_slider: ['slider', ['id', 'phone_id']] };
/* Keys by which one design names another: [the design type carrying it, the key, the type it names]. 0 is the
 * type's default, which is not followed. */
const NAMED_DESIGNS = [['category', 'design_template', 'plist1'], ['product', 'reviews_design_template', 'reviewlist'],
  ['product', 'gallery_slider_id', 'slider'], ['plist1', 'product_card_gallery_slider_id', 'slider'],
  ['reviewlist', 'review_media_slider_id', 'slider']];

/**
 * The designs a store shows beyond the ones its row points at, each with WHERE it shows: those another design
 * names (NAMED_DESIGNS — a category page's listing, a product page's reviews and photo gallery, a listing card's
 * gallery), those a published page or a shown custom block places (PLACED_BLOCKS, PLACED_SHORTCODES), and a
 * product's own gallery (`slider_id`, `phone_slider_id` on `products`). Followed one level from every design found,
 * so a slider inside a placed listing is read too. Read once, for the checks that judge every design a shopper
 * meets. A name that reads nothing is skipped here: the card-gap check reports a template that points at no design.
 * Measured on one store before this: three designs carrying custom CSS — a listing placed on its shop and category
 * pages, one in a custom block, a product page's photo gallery — were never read.
 */
async function shownDesigns(call, R, designs, pagesRead, blockRows, productsRead) {
  const gsPath = pathFor('section_manager_global_settings', 'section_manager/global_settings', R);
  const wanted = new Map();
  const add = (type, id, where) => {
    if (!(id > 0)) return;
    /* The store's own design placed again on a page keeps that place too, after "the store's own". */
    const own = designs.find((d) => d.type === type && Number(d.id) === id);
    if (own) {
      own.where ??= ["the store's own"];
      if (!own.where.includes(where)) own.where.push(where);
      return;
    }
    const key = `${type}/${id}`;
    if (!wanted.has(key)) wanted.set(key, { type, id, where: [] });
    if (!wanted.get(key).where.includes(where)) wanted.get(key).where.push(where);
  };
  const named = (d) => {
    for (const [from, key, type] of NAMED_DESIGNS) if (d.type === from) add(type, Number(d.settings[key]), `${d.label} \`${key}\``);
  };
  designs.forEach(named);
  const placed = [
    ...(pagesRead.rows ?? []).filter((p) => String(p.status ?? 'publish') === 'publish').map((p) => [`page "${clip(p.title ?? '', 30)}"`, p.content]),
    ...blockRows.map((b) => [`custom block #${b.id}`, b.content]),
  ];
  for (const [where, text] of placed) {
    const t = String(text ?? '');
    for (const m of t.matchAll(/<!--\s*wp:cl\/([a-z-]+)\s+(\{[\s\S]*?\})\s*\/?-->/g)) {
      const block = PLACED_BLOCKS[m[1]];
      if (!block) continue;
      for (const attr of block[1]) add(block[0], Number((m[2].match(new RegExp(`"${attr}"\\s*:\\s*"?(\\d+)`)) || [])[1]), where);
    }
    for (const m of t.matchAll(/\[(products|cl_catlist|cl_reviewlist|cl_slider)\b([^\]]*)\]/g)) {
      const [type, attrs] = PLACED_SHORTCODES[m[1]];
      for (const attr of attrs) add(type, Number((m[2].match(new RegExp(`\\b${attr}=["']?(\\d+)`)) || [])[1]), where);
    }
  }
  for (const p of productsRead.rows ?? []) {
    for (const key of ['slider_id', 'phone_slider_id']) add('slider', Number(p[key]), `product "${clip(p.title ?? '', 30)}" \`${key}\``);
  }
  /* Each design read once; one read can name more (a placed listing's card gallery), so go on until none is new. */
  const out = [];
  const tried = new Set();
  for (let more = true; more;) {
    more = false;
    for (const [key, w] of [...wanted]) {
      if (tried.has(key)) continue;
      tried.add(key);
      more = true;
      const res = await call(`${gsPath}/${w.type}/${w.id}`);
      const top = res.body?.data ?? res.body ?? {};
      if (res.status !== 200 || !top.settings || typeof top.settings !== 'object') continue;
      const d = { label: key, type: w.type, id: w.id, settings: top.settings, where: w.where, custom: { css: top.custom_css, js: top.custom_js } };
      out.push(d);
      named(d);
    }
  }
  return out;
}

/* The pages' Upsell blocks (an upsell is its own design since 04-11-2026; /docs/upsells_global_settings → "Where an
 * upsell shows"): [the page design type, the block, the upsell type it takes]. A block picks its upsell — and in an
 * A/B test a second — in `{block}_upsell_ids`: `0` is the type's system upsell, `""` none, a third id never read. */
const UPSELL_BLOCKS = [['product', 'p_upsell', 'product'], ['cart', 'cart_upsell', 'cart'], ['checkout', 'checkout_upsell', 'checkout'],
  ['thankyou', 'upsell_settings', 'thankyou']];
/* Each type's looks, the first its default (the plugin's `UpsellsModel_cl::TYPE_DEFS`); a cart upsell in one of the
 * cart's pop-ups (`after_add`, `before_checkout`) always shows the cards (`UpsellsLayouts_cl::lookForSettings()`). */
const UPSELL_LOOKS = { product: ['cards', 'ticks', 'bought_together'], cart: ['cards', 'ticks'], checkout: ['cards', 'ticks'], thankyou: ['thankyou'] };

function upsellLook(type, s) {
  const looks = UPSELL_LOOKS[type] ?? [];
  if (looks.length < 2) return looks[0] ?? '';
  if (type === 'cart' && ['after_add', 'before_checkout'].includes(String(s.look_placement ?? ''))) return 'cards';
  return looks.includes(String(s.look_layout ?? '')) ? String(s.look_layout) : looks[0];
}

/**
 * The upsells a shopper meets: each switched-on Upsell block's picked upsell(s), read from the upsells design. `0` is
 * the type's system upsell — the plugin's lowest-id one of that preset (`UpsellsModel_cl::getSystemDesignId()`), seen
 * through the api as the lowest `is_system` upsell of that `instance_type`. An id that is gone or of another type is
 * left out, as the plugin leaves it out. `legacy` names a design that still carries its upsell itself (a plugin before
 * the upsells design: the store then fetches an older copy of this skill, so it is reported, not read). A block
 * switched on that shows no upsell adds nothing: the feature check then counts nothing to offer.
 */
async function readPickedUpsells(call, R, designs) {
  const out = { picked: [], legacy: [], unread: null };
  if (!designs.some((d) => UPSELL_BLOCKS.some(([t, b]) => d.type === t && `${b}_upsell_ids` in d.settings))) {
    for (const d of designs) if (d.type === 'product' && yes(d.settings.p_upsell_is_active)) out.legacy.push(`${d.label}.p_upsell`);
    return out;
  }
  const list = await walk(call, `${pathFor('section_manager_instances', 'section_manager/instances', R)}?type=upsells`);
  if (list.error) { out.unread = `could not read the upsells list — ${list.error}`; return out; }
  const typeOf = new Map(list.rows.map((r) => [Number(r.id), String(r.instance_type ?? '')]));
  const system = {};
  for (const r of [...list.rows].sort((a, b) => Number(a.id) - Number(b.id))) {
    if (String(r.is_system) === 'yes' && !(r.instance_type in system)) system[r.instance_type] = Number(r.id);
  }
  const gsPath = pathFor('section_manager_global_settings', 'section_manager/global_settings', R);
  const read = new Map();
  for (const [pageType, block, type] of UPSELL_BLOCKS) {
    for (const d of designs.filter((x) => x.type === pageType)) {
      const s = d.settings;
      if (!yes(s[`${block}_is_active`])) continue;
      if (!(`${block}_upsell_ids` in s)) { out.legacy.push(`${d.label}.${block}`); continue; }
      const raw = String(s[`${block}_upsell_ids`] ?? '').split(',').map((x) => x.trim()).filter((x) => x !== '').slice(0, 2);
      const ids = [...new Set(raw.map((x) => (Number(x) > 0 ? Number(x) : system[type] ?? 0)))].filter((id) => id > 0 && typeOf.get(id) === type);
      for (const id of ids) {
        if (!read.has(id)) {
          const res = await call(`${gsPath}/upsells/${id}`);
          const top = res.body?.data ?? res.body ?? {};
          read.set(id, res.status === 200 && top.settings && typeof top.settings === 'object' ? top : { error: `HTTP ${res.status}` });
        }
        const top = read.get(id);
        if (top.error) { out.unread = `upsells/${id} (picked by ${d.label}) could not be read (${top.error})`; continue; }
        out.picked.push({ block, page: d.label, id, label: `upsells/${id}`, type, look: upsellLook(type, top.settings),
          settings: top.settings, styleGen: top.style_generator ?? {}, custom: { css: top.custom_css, js: top.custom_js },
          where: [`${d.label} \`${block}_upsell_ids\``] });
      }
    }
  }
  return out;
}

/** One setting on every upsell a switched-on block shows in one of `looks` — the upsell twin of probe(). */
function upsellProbe(ctx, key, looks) {
  const r = { on: false, seen: [], missing: [], designs: 0 };
  for (const u of ctx.upsells?.picked ?? []) {
    if (!looks.includes(u.look)) continue;
    r.designs++;
    if (!(key in u.settings)) { r.missing.push(`${u.label}.${key}`); continue; }
    r.seen.push(`${u.label}.${key} = ${JSON.stringify(u.settings[key])} (${u.page} \`${u.block}\`)`);
    if (yes(u.settings[key])) r.on = true;
  }
  return r;
}

function checkSameKindLooks(listDesigns) {
  const notes = [];
  const ratio = (style) => (String(style ?? '').match(/aspect-ratio\s*:\s*([^;]+)/) || [])[1]?.trim() ?? '';
  for (const [type, keys] of Object.entries(LOOK_KEYS)) {
    const looks = listDesigns.filter((d) => d.type === type);
    if (looks.length < 2) continue;
    const diffs = [];
    for (const k of keys) {
      const vals = looks.map((d) => [d.label, k.endsWith('_container_style') ? ratio(d.settings[k]) : d.settings[k]])
        .filter(([, v]) => v !== undefined && String(v) !== '');
      if (new Set(vals.map(([, v]) => String(v))).size > 1) {
        diffs.push(`${k.endsWith('_container_style') ? 'the photo ratio' : `\`${k}\``}: ${vals.map(([l, v]) => `${l} ${v}`).join(' · ')}`);
      }
    }
    if (diffs.length) {
      notes.push(`${looks.length} ${type} designs show cards on this store, and they draw them differently:\n` +
        diffs.map((x) => `        ${x}`).join('\n') + '\n' +
        '    The same card on two pages should look the same. Match them, or confirm each difference with the merchant.');
    }
  }
  return notes;
}

async function main(base) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const call = async (path) => {
    for (let attempt = 0; ; attempt++) {
      await pace();
      const res = await fetch(`${base}/${path}`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      });
      const text = await res.text();
      let body = null;
      try { body = JSON.parse(text); } catch { /* status still tells us what happened */ }
      if (res.status === 429 && attempt < MAX_RETRIES) {
        const asked = Number(res.headers.get('retry-after')) || Number(body?.data?.retry_after) || 2;
        const wait = Math.min(MAX_WAIT_S, Math.max(1, asked));
        console.log(`  · rate-limited on ${path.split('?')[0]} — waiting ${wait}s, as the api asked`);
        await sleep(wait * 1000);
        continue;
      }
      if (!body && isChallenge(res.status, text)) {
        // Once the host has held out through the retries, later reads are counted at once, not waited on.
        if (attempt < MAX_RETRIES && !hostChallenge.count) {
          const wait = 20 * (attempt + 1);
          console.log(`  · the host's bot check answered ${path.split('?')[0]} instead of the store — waiting ${wait}s`);
          await sleep(wait * 1000);
          continue;
        }
        hostChallenge.count++;
        if (hostChallenge.paths.length < 5) hostChallenge.paths.push(path.split('?')[0]);
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
    const styleGen = res.body?.style_generator ?? res.body?.data?.style_generator ?? {};
    const top = res.body?.data ?? res.body ?? {};
    /* A key without the custom-code access gets these fields dropped, not emptied: undefined = unread. */
    designs.push({ label: `${type}/${id}`, type, id, settings, schema, styleGen, custom: { css: top.custom_css, js: top.custom_js } });

    for (const h of hollowIn(settings)) {
      hollow++;
      problems.push(
        `${type}/${id}: \`${h.toggle}\` is "yes" but \`${h.list}\` is empty.\n` +
        '      Nothing renders, and the view returns before its own heading — so the page shows a gap,\n' +
        '      not a mistake. Fill it, or set the toggle to "no" as a deliberate decision.'
      );
    }
  }
  const cardOptions = checkCardOptions(designs);
  problems.push(...cardOptions);
  if (!hollow && !cardOptions.length && designs.length) passed.push('nothing switched on and empty');
  const settingsByDesign = new Map(designs.map((d) => [d.label, d.settings]));

  /* ── the design each pointer actually shows ──────────────────────────────────────────────────── */
  const pointers = await checkPointers(call, R, store);
  problems.push(...pointers.problems);
  notes.push(...pointers.notes);
  if (pointers.unknown) {
    notes.push('this plugin\'s store row carries no `renders`, so which design each pointer shows was NOT checked.');
  } else if (!pointers.problems.length) {
    line(true, 'every design pointer on the store row shows a design that exists');
    passed.push('every pointer shows a real design');
  }

  /* ── the WhatsApp button, which renders nothing without a number ─────────────────────────────── */
  const whatsapp = checkWhatsappButton(designs);
  problems.push(...whatsapp.problems);
  for (const u of whatsapp.unknown) {
    notes.push(`${u}: the WhatsApp button was not checked — this install's design has no \`whatsapp_bt_active\`.`);
  }
  if (whatsapp.checked && !whatsapp.problems.length) {
    line(true, 'the WhatsApp button is off, or has a number');
    passed.push('the WhatsApp button can be seen');
  }

  /* ── dangling icon ids: invisible at runtime, so this is the only place they can be caught ──── */
  const icons = await checkIcons(call, R, settingsByDesign, store);
  if (!icons.skipped && icons.unmarked.length) {
    const shown = icons.unmarked.slice(0, 8);
    problems.push(
      `${icons.unmarked.length} collapsible toggle icon(s) are empty, and the store's own pair they fall back to is empty too:\n` +
      shown.map((u) => `        ${u.design}.${u.key}`).join('\n') +
      (icons.unmarked.length > shown.length ? `\n        … and ${icons.unmarked.length - shown.length} more` : '') + '\n' +
      `      stores.collapse_open_icon_id = ${JSON.stringify(store?.collapse_open_icon_id)}, collapse_close_icon_id = ` +
      `${JSON.stringify(store?.collapse_close_icon_id)}\n` +
      '      Those collapsibles render with no open/close mark. Point the store\'s pair at an open/close icon pair,\n' +
      '      looked up BY NAME through design_controls/icons_manager — never a remembered id.'
    );
  }
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
  } else if (!icons.unmarked.length) {
    line(true, `every icon id resolves and every open/close pair belongs together (${icons.count} icons)`);
    passed.push('icons resolve');
  }

  /* ── the catalogue's photography ─────────────────────────────────────────────── */
  const productsRead = await walk(call, pathFor('products', 'products', R));
  /* The store's pages, read once: their images, their words, their links and their custom code are checked below. */
  const pagesRead = await walk(call, pathFor('pages', 'pages', R));
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

  /* The home page as a logged-out visitor gets it — read once, here: the custom blocks below need what its
   * styles say about Block spacing, and the public-store check near the end reports the rest. */
  const siteUrl = base.replace(/\/wp-json\/cl-api\/v1$/, '');
  const publicHome = await checkPublicHome(siteUrl);
  const blockGap = publicHome.store ? blockGapFrom(publicHome.html) : null;

  /* ── custom blocks: content, checked like a page — WordPress accepts anything in a Custom HTML block ── */
  const cb = await checkCustomBlocks(call, R, store, productsRead, keptBlocks, blockGap);
  const blockLabel = (b) => `custom block #${b.id} "${clip(b.title ?? '', 40)}"`;
  if (cb.skipped) {
    line(false, `${cb.skipped} — custom blocks NOT checked, and not passed`);
    problems.push(`custom blocks were NOT checked — ${cb.skipped}. A check that did not run is not a pass: re-run.`);
  } else {
    for (const m of cb.missing) {
      problems.push(`custom block #${m.id} is shown on ${m.places.join(', ')}, but no such block exists — that place renders\n` +
        '      nothing. Point it at a block that exists, or remove the reference.');
    }
    for (const d of cb.deferred) {
      problems.push(`${blockLabel(d.block)} is placed to load AFTER the page (placement ${d.placement.id}, ` +
        `${d.placement.consumer_compo} design ${d.placement.consumer_instance_id}) and uses layout settings.\n` +
        '      WordPress prints the CSS behind layout settings while it renders the page, so a block fetched after\n' +
        '      the page loses its spacing, wrapping and widths. Set that placement\'s render_mode to "immediate".');
    }
    if (cb.notChecked) {
      line(false, `${cb.pending} custom block(s) NOT checked — ${cb.notChecked}`);
      problems.push(`${cb.pending} custom block(s) the store shows were NOT checked: ${cb.notChecked}. A check that did not run is not a pass.`);
    }
    for (const u of cb.unreadable) {
      problems.push(`${blockLabel(u.block)} was NOT checked — codbrand-content-builder's validator gave no report (${u.why}). Re-run.`);
    }
    for (const f of cb.failing) {
      problems.push(`${blockLabel(f.block)} — shown on ${f.places.join(', ')} — fails codbrand-content-builder's checks ` +
        `(${f.errors.length} error(s)${f.warnings.length ? `, ${f.warnings.length} warning(s)` : ''}):\n` +
        f.errors.slice(0, 3).map((e) => `        - ${clip(e, 150)}`).join('\n') +
        (f.errors.length > 3 ? `\n        … and ${f.errors.length - 3} more` : '') + '\n' +
        '      A custom block is content: make it with codbrand-content-builder (its target custom_blocks) and publish\n' +
        '      only what passes its checks — api-recipes.md → "Custom blocks are content". If this build did not\n' +
        `      write it (the merchant's own block), say so: --block-kept ${f.block.id} "<why, at least ${MIN_REASON} characters>"`);
    }
    for (const s of cb.shortReason) {
      problems.push(`${blockLabel(s.block)} is kept with a reason shorter than ${MIN_REASON} characters. Say why this build did not\n` +
        `      write it: --block-kept ${s.block.id} "<why, at least ${MIN_REASON} characters>"`);
    }
    for (const k of cb.kept) line(true, `${blockLabel(k.block)} kept as not this build's: "${k.reason}"`);
    for (const w of cb.warned) {
      notes.push(`${blockLabel(w.block)} passes codbrand-content-builder's checks with ${w.warnings.length} warning(s): ${clip(w.warnings[0], 150)}`);
    }
    for (const id of cb.keptNotShown) notes.push(`--block-kept ${id}: the store shows no custom block #${id}, so it excuses nothing.`);
    if (cb.productsUnread) notes.push('products could not be read, so custom blocks used as a product\'s extra description were NOT looked for.');
    const blockTrouble = cb.missing.length + cb.deferred.length + cb.failing.length + cb.unreadable.length + cb.shortReason.length + (cb.notChecked ? 1 : 0);
    if (!cb.shown) {
      line(true, 'the store shows no custom block');
    } else if (!blockTrouble && cb.checked) {
      line(true, `every custom block the store shows passes codbrand-content-builder's checks and renders with the page ` +
        `(${cb.checked} checked${cb.kept.length ? `, ${cb.kept.length} kept as not this build's` : ''})`);
      passed.push('custom blocks pass content-builder\'s checks');
    }
  }

  /* ── the logo: the header's image, and the brand image the store shares ───────────────────────────
   * Two different writes for two different things: the header design's logo fields draw the header;
   * `site_logo_id` is the brand image search engines read as the Organization logo and every page with no
   * image of its own shares as its picture (og:image) — it draws nothing in the header (/docs/stores). So a
   * text wordmark still wants `site_logo_id`: measured on one store, a link to its home page sent on WhatsApp
   * showed no picture, because only its product pages had an image to share. */
  const siteLogo = isSet(store?.site_logo_id);
  let designLogo = false;
  const designLogoIn = [];
  for (const [design, settings] of settingsByDesign) {
    for (const [k, v] of Object.entries(settings)) {
      if (/logo/.test(k) && /(_url|_id)$/.test(k) && isSet(v)) { designLogo = true; designLogoIn.push(`${design}.${k}`); }
    }
  }
  const wordmarkDeclared = String(wordmarkReason ?? '').trim().length >= MIN_REASON;
  /* Pages a shopper shares: not the cart, the checkout, the thank-you page or search, which nobody sends anyone. */
  const flowPages = new Set(['cart_page_id', 'checkout_page_id', 'thankyou_page_id', 'search_page_id'].map((k) => Number(store?.[k])).filter((n) => n > 0));
  const imageless = (pagesRead.rows ?? []).filter((p) => String(p.status ?? 'publish') === 'publish' && !flowPages.has(Number(p.id))
    && !(Number(p.featured_image_id) > 0));
  /* The header is judged by the header designs alone: a footer's or a popup's logo image does not draw it. */
  const headerLogoIn = designLogoIn.filter((x) => x.startsWith('header/'));

  if (designLogo && headerLogoIn.length && siteLogo) {
    line(true, 'the header shows the logo image, and `site_logo_id` gives the store its brand image');
    passed.push('the logo is whole');
  } else if (headerLogoIn.length) {
    problems.push(
      `the header shows a logo image (${headerLogoIn.join(', ')}), but \`site_logo_id\` on \`stores\` is NOT SET: search\n` +
      '      engines get no Organization logo, and every page with no image of its own is shared with no picture.\n' +
      '      Point `site_logo_id` at the brand image (square shares best) — it does not change the header.\n' +
      '      See api-recipes.md → "The header".'
    );
  } else {
    /* A text wordmark in the header. A genuine decision — some brands are a wordmark. It still has to be a DECISION. */
    if (wordmarkDeclared) {
      line(true, `no logo image in the header, declared intentional: "${String(wordmarkReason).trim()}"`);
      console.log('    → then the wordmark is the brand mark. Its typography is the header design\'s');
      console.log('      `logo_text_preset` (a typography preset, default 204 "Small Title"): pick or');
      console.log('      clone one through design_controls/presets. See api-recipes.md → "The header".');
      passed.push('the wordmark is a declared decision');
    } else {
      problems.push(
        'no header design has a logo image, so the header shows the store\'s name as text. That is a legitimate\n' +
        '      choice and NOT a legitimate accident, so say which it is:\n' +
        `        --wordmark-intended "<why, at least ${MIN_REASON} characters>"`
      );
    }
    if (!siteLogo && imageless.length) {
      problems.push(
        `\`site_logo_id\` on \`stores\` is NOT SET, and ${imageless.length} published page(s) have no image of their own ` +
        `(${imageless.slice(0, 4).map((p) => `/${p.slug}/`).join(', ')}${imageless.length > 4 ? ', …' : ''}):\n` +
        '      shared on WhatsApp or Instagram they show no picture, and search engines get no Organization logo.\n' +
        '      A text wordmark still wants a brand image there — it draws nothing in the header. Upload one (square\n' +
        '      shares best) and point `site_logo_id` at it. See api-recipes.md → "The header".'
      );
    } else if (siteLogo) {
      line(true, '`site_logo_id` gives the store a brand image to share, beside the text wordmark');
    }
  }

  /* Every design a shopper meets beyond the store row's — placed on a page or in a custom block, or named by another
   * design — and the upsells the pages' blocks pick: read once, for the checks below. */
  const shown = await shownDesigns(call, R, designs, pagesRead, cb.rows ?? [], productsRead);
  const upsells = await readPickedUpsells(call, R, designs);
  /* Whether a shopper can open a quick view: a listing's button, or an upsell card's (the browser pass needs it open). */
  let quickviewShown = upsells.picked.some((u) => yes(u.settings.look_quickview_bt_is_active))
    || designs.some((d) => d.type === 'plist1' && yes(d.settings.quickview_bt_is_active));

  /* ── the card designs: the header's height and stuck state, and every coloured band ─────────── */
  const presetsRead = await walk(call, pathFor('design_controls_presets', 'design_controls/presets', R));
  if (presetsRead.error) {
    line(false, `could not read the card designs (design_controls/presets) — ${presetsRead.error}`);
    problems.push(`the header and band checks were NOT run: the card designs could not be read — ${presetsRead.error}. A check that did not run is not a pass: re-run.`);
  } else {
    const presetsById = new Map(presetsRead.rows.map((p) => [String(p.id), p]));
    notes.push(...checkStyleVsPreset(designs, presetsById));
    const paletteRead = await walk(call, pathFor('design_controls_color_palette', 'design_controls/color_palette', R));
    const resolve = colourResolver(paletteRead.error ? null : paletteRead.rows);
    const headers = designs.filter((d) => d.type === 'header');

    const headerSpace = checkHeaderVerticalSpace(headers, presetsById);
    problems.push(...headerSpace.problems);
    if (headerSpace.checked && !headerSpace.problems.length) {
      line(true, `the header has vertical space on desktop and on phones (${headerSpace.checked} checked)`);
      passed.push('the header has vertical space');
    }

    const widths = checkHeaderWidths(headers);
    problems.push(...widths.problems);
    notes.push(...widths.notes);
    if (widths.checked && !widths.problems.length && !widths.notes.length) {
      line(true, `the header's background reaches as far as the stuck bar and its Bottom Row (${widths.checked} checked)`);
      passed.push('the header has one background width');
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
    let pagesRead = null;
    const pageBackgrounds = () => (pagesRead ??= readPageBackgrounds(call, R, resolve, designs, presetsById));
    const bands = await checkBands(designs, presetsById, resolve, pageBackgrounds);
    problems.push(...bands.problems);
    notes.push(...await checkTextAtZero(designs, pageBackgrounds));
    const fonts = await checkFontHosting(call, R);
    notes.push(...fonts.notes);
    if (fonts.passed) line(true, fonts.passed);
    if (!bands.problems.length) {
      line(true, `every coloured band has side padding on desktop and on phones (${bands.checked} card design use(s) checked)`);
      passed.push('every coloured band has side padding');
    }

    const gaps = await checkListGaps(call, R, designs, presetsById, resolve);
    notes.push(...gaps.notes);
    if (gaps.checked && !gaps.notes.length) {
      line(true, `the cards of every list keep a space between them (${gaps.checked} list design use(s) checked)`);
      passed.push('cards in a list do not touch');
    }

    const upsellPopups = upsells.picked.map((u) => ({ label: `${u.label} (picked by ${u.page} \`${u.block}\`)`, upsell: true,
      settings: u.settings, styleGen: u.styleGen }));
    const panels = checkPopupPanels([...designs, ...upsellPopups], presetsById, resolve);
    problems.push(...panels);
    /* Every list design a shopper meets — the store's own and those a page or a template names — for the drawer
     * and card-look checks. Measured: the cramped drawer was on a listing reached only through the category page. */
    const listDesigns = [...designs, ...shown];
    quickviewShown ||= listDesigns.some((d) => d.type === 'plist1' && yes(d.settings.quickview_bt_is_active));
    notes.push(...checkFilterDrawers(listDesigns, presetsById));
    notes.push(...checkSameKindLooks(listDesigns));
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
    const clock = { zone: me.body.timezone, offset: me.body.utc_offset };
    const features = await reconcileFeatures(call, R, { designsOf: byType, store, clock, upsells }, recorded, productsRead);
    problems.push(...features.problems);
    notes.push(...features.notes);
    // Zero reconciled is not a match: every key was unknown, unreadable or unmapped, and the notes say which.
    if (!features.problems.length && features.reconciled) {
      line(true, `the feature checklist matches the store (${features.reconciled} feature(s), ${recorded.which})`);
      passed.push('the feature checklist matches the store');
    }
  }
  if (recorded.decisions) {
    const reversals = checkReversals(recorded.decisions);
    problems.push(...reversals.problems);
    if (reversals.checked && !reversals.problems.length) {
      line(true, `every reversed decision says what it was, why and when (${reversals.checked})`);
      passed.push('every reversed decision is recorded with its reason');
    }
  }

  /* ── words for the merchant, and placeholders, where a shopper reads them ─────────────────────── */
  const showcase = /^showcase\b/i.test(String(recorded.decisions?.purpose?.value ?? '').trim());
  const reviewsRead = await walk(call, `${pathFor('reviews', 'reviews', R)}?approved=1`);
  const settingsRead = await call(pathFor('store_settings', 'store_settings', R));
  const sources = [
    ...(pagesRead.rows ?? []).filter((p) => String(p.status ?? 'publish') === 'publish')
      .map((p) => ({ where: `page "${clip(p.title ?? '', 30)}" (/${p.slug}/)`, text: `${p.title ?? ''} ${p.content ?? ''}` })),
    ...(cb.rows ?? []).map((b) => ({ where: `custom block #${b.id}`, text: b.content })),
    ...(reviewsRead.rows ?? []).map((r) => ({ where: `review #${r.id}`, text: `${r.title ?? ''} ${r.content ?? ''} ${r.author ?? ''}` })),
    ...designs.map((d) => ({ where: `design ${d.label}`, text: designStrings(d.settings).join(' | ') })),
    ...(productsRead.rows ?? []).filter((p) => String(p.status ?? 'publish') === 'publish').map((p) => ({ where: `product "${clip(p.title ?? '', 30)}"`,
      text: [p.title, p.short_description, p.long_description, p.extra_description, p.upsell_description].join(' ') })),
    { where: 'the store settings', text: designStrings(settingsRead.body?.settings ?? {}).join(' | ') },
  ];
  const scan = scanShopperText(sources);
  const listed = (map) => [...map].slice(0, 12).map(([w, s]) => `        ${w}: ${[...s].join(', ')}`).join('\n') +
    (map.size > 12 ? `\n        … and ${map.size - 12} more` : '');
  if (showcase && (scan.placeholders.size || scan.notes.size)) {
    const both = new Map(scan.placeholders);
    for (const [w, s] of scan.notes) both.set(w, new Set([...(both.get(w) ?? []), ...s]));
    problems.push(`this store is a SHOWCASE (its blueprint's \`purpose\`), so every page must read as a real store — but ${both.size}\n` +
      `      place(s) still show a placeholder or words written to the merchant:\n${listed(both)}\n` +
      '      SKILL.md → "Asking": a showcase gets believable contacts, legal pages without the draft line, and reviews\n' +
      '      written as real.');
  } else {
    if (scan.notes.size) {
      notes.push(`${scan.notes.size} place(s) a shopper reads hold words written to the merchant:\n${listed(scan.notes)}\n` +
        '    A note to the merchant goes in the hand-over and its replace-list, never on a page: move each one there.');
    }
    if (scan.placeholders.size) notes.push(`placeholders still on the store — name each one in the replace-list:\n${listed(scan.placeholders)}`);
  }
  if (reviewsRead.error) notes.push(`reviews were NOT read for placeholders and notes to the merchant — ${reviewsRead.error}.`);

  /* ── what WordPress left, and the store pages nothing links to ───────────────────────────────── */
  const leftovers = await checkLeftovers(call, R, store, pagesRead, siteUrl, publicHome);
  problems.push(...leftovers.problems);
  notes.push(...leftovers.notes);

  /* ── the custom code, listed for review ──────────────────────────────────────────────────────── */
  /* An upsell picked by several blocks is one design: listed once, with every place that shows it. */
  const upsellDesigns = new Map();
  for (const u of upsells.picked) {
    if (!upsellDesigns.has(u.label)) upsellDesigns.set(u.label, { label: u.label, custom: u.custom, where: [] });
    upsellDesigns.get(u.label).where.push(...u.where);
  }
  const code = listCustomCode(store, [...designs, ...shown, ...upsellDesigns.values()], pagesRead, productsRead);
  if (!code.readable) {
    notes.push('custom code was NOT listed: this key cannot read it (the custom-code access on the key\'s form).');
  } else if (code.pieces.length) {
    notes.push(`${code.pieces.length} piece(s) of custom code run on this store — review each one:\n` +
      /* Every piece, never a first few: the note asks for each one to be reviewed. */
      code.pieces.map((p) => `        ${p}`).join('\n') + '\n' +
      '    A setting or a card design that does the same replaces it; CSS aimed inside a design nested in another does\n' +
      '    nothing (joins.js reports it as dead-scoped-css); custom JS never stands in for a feature that changes what a\n' +
      '    shopper sees — order, price, stock — report that gap instead. Check pages with custom layout CSS at 768 and\n' +
      '    1200 too, not only 390 and 1440. references/check-store.md → custom code says how to classify each.');
  }

  /* ── stock shown where no stock is counted ───────────────────────────────────────────────────── */
  if (designs.some((d) => d.type === 'product' && yes(d.settings.stock_badge_is_active)) && !productsRead.error && !productsRead.rows.some(tracksStock)) {
    notes.push('the stock badge and the low-stock line are on (`stock_badge_is_active`), but no product counts its stock\n' +
      '    (`stock_mode`), so they show on no product. Turn stock tracking on for the products the merchant counts, or\n' +
      '    switch them off.');
  }

  /* ── what a customer actually gets: the home page, logged out (read before the custom blocks) ─── */
  let hiddenStore = '';
  if (publicHome.error) {
    line(false, `the public home page could not be fetched — ${publicHome.error}`);
    problems.push(`the public home page was NOT checked — ${publicHome.error}. A check that did not run is not a pass: re-run.`);
  } else if (!publicHome.store) {
    hiddenStore = `a logged-out visitor to ${siteUrl}/ gets HTTP ${publicHome.status}` +
      (publicHome.title ? ` "${publicHome.title}"` : '') + ', a page with none of the store in it';
    notes.push(`THE STORE IS NOT PUBLIC: ${hiddenStore}. Usually the host's coming-soon or maintenance mode.`);
  } else {
    line(true, 'a logged-out visitor gets the store');
    passed.push('the public sees the store');
  }

  /* ── the site's clock: every sale end, countdown and topbar date is read in its time zone ───────── */
  const zone = me.body.timezone;
  /* What runs on that clock where a shopper sees it. With any of it on, a site left on UTC is a failure: a
   * sale ending at 23:59 ends hours off for customers anywhere else. */
  const dated = [];
  if (designs.some((d) => d.type === 'product' && yes(d.settings.p_countdown_is_active))) dated.push('the product countdown');
  if (!productsRead.error && productsRead.rows.some((p) => String(p.sale_to ?? '').trim() !== '')) dated.push('sales with an end date');
  if (designs.some((d) => d.type === 'topbar' && (asArray(d.settings.topbar_messages) ?? [])
    .some((m) => ['start_date', 'end_date', 'countdown_target'].some((k) => String(m?.[k] ?? '').trim() !== '')))) dated.push('dated topbar messages');
  const clockAt = zone ? 'the site runs on UTC' : `the site keeps a fixed offset (${me.body.utc_offset ?? 'unknown'}) and no time zone`;
  if (zone === undefined) {
    notes.push('the site\'s time zone was NOT checked: this plugin does not report `timezone`.');
  } else if ((zone === '' || zone === 'UTC') && dated.length && String(utcReason ?? '').trim().length < MIN_REASON) {
    problems.push(`THE SITE'S CLOCK: ${clockAt}, and the store shows ${dated.join(', ')} — each runs on that clock,\n` +
      '      hours off for customers anywhere else. Set the zone where they are (store_settings → timezone) and write the\n' +
      '      dated rows again — api-recipes.md → "The site\'s time zone". If the customers really keep UTC, say so:\n' +
      `        --utc-intended "<why, at least ${MIN_REASON} characters>"`);
  } else if ((zone === '' || zone === 'UTC') && dated.length) {
    line(true, `${clockAt}, with ${dated.join(', ')}, declared intentional: "${String(utcReason).trim()}"`);
  } else if (zone === '' || zone === 'UTC') {
    notes.push(`THE SITE'S CLOCK: ${clockAt}, ` +
      'so every sale end,\n    countdown and topbar date is read there. Unless the store\'s customers live on it, set the zone where they are\n' +
      '    (store_settings → timezone) and write the dated rows again — api-recipes.md → "The site\'s time zone".');
  } else {
    line(true, `the site keeps time in ${zone} (${me.body.utc_offset ?? 'offset unknown'}): check it is where the store's customers are`);
  }

  /* ── the whole site's search visibility: told to the merchant, never changed here ──────────────── */
  const searchHidden = me.body.discourage_search_engines;
  if (searchHidden === 'yes') {
    notes.push('THE WHOLE SITE IS HIDDEN FROM SEARCH ENGINES (`discourage_search_engines`: yes). Tell the merchant in plain\n' +
      '    words: "your site is hidden from Google and other search engines; nothing looks broken, but a launched\n' +
      '    store gets no search traffic while this is on. Turn it off at launch: CodBrand > Store > Store\n' +
      '    Visibility." Offer to switch it off only when they say they are launching and your key holds\n' +
      '    `search_visibility`; never change it on your own. A demo or development site stays hidden on purpose.');
  } else if (searchHidden === 'no') {
    // Not in the pass summary: on a demo or development site, open to search engines is not a pass.
    line(true, 'search engines may index the whole site (`discourage_search_engines`: no)');
  } else {
    notes.push('search visibility UNKNOWN: this plugin does not report `discourage_search_engines`. Do not tell the\n' +
      '    merchant the site is visible to search engines.');
  }

  /* ── the live check: live-check.mjs's (or joins.js's) saved results ──────────────────────────────────────────────── */
  const browserPass = checkJoins(joinsDir, base, store, quickviewShown, {
    pages: pagesRead.rows ?? [], pluginVersion: me.body.plugin_version, decisions: recorded?.decisions?.spacing?.value?.decisions });
  problems.push(...browserPass.problems);
  notes.push(...(browserPass.notes ?? []));
  if (!browserPass.problems.length) {
    line(true, browserPass.pass);
    passed.push('the live check is complete');
  }

  if (hostChallenge.count) {
    problems.push(`the HOST's bot check answered ${hostChallenge.count} read(s) instead of the store (${hostChallenge.paths.join(', ')}), so what\n` +
      '      they feed was NOT checked. That is the hosting\'s protection ("Checking your browser"), not the store and not a\n' +
      '      missing permission on the key: wait a few minutes and re-run, or ask the host to let this machine through.');
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
  // Not a failure of the build — a host setting only the merchant can turn off, and possibly on
  // purpose before a launch. It is still the first thing they must hear: every check above passed
  // for a store their customers cannot open.
  if (hiddenStore) {
    console.log(`\n  ! TELL THE MERCHANT FIRST: the store is not public yet — ${hiddenStore}.`);
    console.log('    Customers cannot see any of this until they switch that page off in their hosting panel.');
  }
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
  console.error('usage: node handover.mjs <site-url> <api-key> --joins <folder> [--wordmark-intended "reason"] [--block-kept <id> "reason"] …');
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

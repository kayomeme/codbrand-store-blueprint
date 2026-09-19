#!/usr/bin/env node
/**
 * preflight.mjs — can this key actually build a store here?
 *
 *   node preflight.mjs <site-url> <api-key> --mode=<demo|merchant> --country=<CC> --market=<CC>
 *
 * Answers five questions before any work starts, so a build cannot die half-done:
 *   1. does the plugin's API answer at this URL at all?
 *   2. what may this key do?
 *   3. is any door the build NEEDS missing or unreachable — and which OPTIONAL ones are absent?
 *   4. WHICH KIND OF BUILD is this, and for WHERE?          (--mode / --country / --market)
 *   5. what design systems does this install already have?  (icons, fonts, palette, presets)
 *
 * WHY 4 AND 5 ARE HERE RATHER THAN IN THE PROSE. Everything this skill asks for in a document can
 * be skipped, and has been: `match.mjs` was written after a by-eye build cost four rounds of
 * owner-pointed defects, it was declared mandatory inside SKILL.md, and the very next build with a
 * named reference site did not run it — no reference spec, no live spec, no match report exists
 * anywhere. An optional gate is not a gate. So the questions that decide the shape of a build are
 * asked by a script that exits non-zero, not by a paragraph.
 *
 *   --mode      `demo` builds every feature the archetype supports, because showing the product off
 *               IS the job. `merchant` OFFERS a feature and lets them decline. Never inferred:
 *               guessing wrong either imposes features on a merchant who will not operate them, or
 *               ships a demo that hides the product.
 *   --country   where the SELLER is.
 *   --market    where the CUSTOMER is. Kept separate on purpose — consumer-protection obligations
 *               usually follow the customer, so one question would silently pick the wrong
 *               jurisdiction for any cross-border seller. Pass the same value twice when they match.
 *
 * It PROBES each door with a real request rather than reading capability off `/me` — `/me` lists
 * what each RESOURCE offers, never what THIS key was granted, so a slug match there once reported a
 * door "✓" that then returned 403.
 *
 * ⚠️ It DOES carry a curated list of the doors a build needs — see `NEEDED` below, and the note
 * above it explaining why the path cannot be derived from the slug. An earlier version of this
 * docblock claimed the opposite ("asks the API what exists rather than carrying a list of its own");
 * that was false about this very file, 45 lines above the list it denied. The list is the part that
 * needs maintaining when the plugin ships a new door; `/me`'s published path is preferred over the
 * hardcoded one whenever it declares it.
 *
 * Exit 0 = safe to start. Exit 1 = stop and tell the merchant what to grant.
 *
 * NOTE: this sets `process.exitCode` and returns; it never calls process.exit(). Killing the loop
 * while a fetch is still settling trips a libuv assertion on Windows, which prints a crash dump
 * underneath an otherwise clean report.
 */

const argv = process.argv.slice(2);
const positional = argv.filter((a) => !a.startsWith('--'));
const [rawUrl, apiKey] = positional;

/** `--name=value`, or `--name value`. Returns null when absent so a missing flag reads as missing. */
function flag(name) {
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3).trim() || null;
  const i = argv.indexOf(`--${name}`);
  if (i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1].trim();
  return null;
}

const mode = (flag('mode') || '').toLowerCase();
const country = flag('country');
const market = flag('market');

/**
 * Is the companion renderer installed?
 *
 * `codbrand-content-builder` renders every page's markup. Without it the build reaches phase 7 and
 * stops — which is exactly what happened on the first real run, silently, because nothing checked.
 * A missing companion is a setup problem with a one-line fix, so it is worth saying out loud before
 * any work starts rather than discovering it after the palette and designs are already written.
 */
function findCompanionSkill() {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const candidates = [
    join(home, '.claude', 'skills', 'codbrand-content-builder', 'SKILL.md'),
    join(process.cwd(), '.claude', 'skills', 'codbrand-content-builder', 'SKILL.md'),
  ];
  return candidates.find((p) => existsSync(p)) || null;
}

/**
 * Doors the build genuinely needs: the PATH to probe, and what each is for.
 *
 * Each entry is [path, why]. The path is NOT derivable from the slug — `custom_blocks` is flat while
 * `checkout_shipping_rates` is `checkout/shipping_rates` — so it is written out. `/me` is preferred
 * when it declares one; this is the fallback for when it does not.
 *
 * And it very often does not, which is the whole point. `/me` omits any resource the key cannot use,
 * so exactly the doors worth probing — the ones whose scope is missing — are the ones with no
 * published path. An earlier version guessed by turning the last underscore into a slash; that gave
 * `custom/blocks` and `checkout_shipping/rates`, so a missing scope would have been reported as a
 * missing door, sending the merchant to fix the wrong thing.
 *
 * The last three are here because a store shipped to a Moroccan merchant promising "Free delivery on
 * orders over $50" and a "30-day money-back" guarantee — seeded English demo copy on the cart and
 * checkout that the build never saw, because nothing checked whether it could reach it.
 */
const NEEDED = {
  'store_blueprint':                 ['store_blueprint',                'record the plan so a later run can tell your work from theirs'],
  'stores':                          ['stores',                         'read which designs each surface uses, and the site logo'],
  'store_settings':                  ['store_settings',                 'reading direction, site title, page width'],
  'section_manager_global_settings': ['section_manager/global_settings','write the designs'],
  'design_controls_color_palette':   ['design_controls/color_palette',  'the colour tokens'],
  'design_controls_font_manager':    ['design_controls/font_manager',   'the fonts'],
  'pages':                           ['pages',                          'create the content pages'],
  'media':                           ['media',                          'upload the logo and the images'],
  'products':                        ['products',                       'read and write the products'],
  'categories':                      ['categories',                     'read the catalogue structure'],
  'menus':                           ['menus',                          'the navigation menus themselves'],
  'menus_items':                     ['menus/items',                    'the links inside them — phase 8 cannot finish without this'],
  'custom_blocks':                   ['custom_blocks',                  'the seeded promo blocks on cart and checkout — ENGLISH DEMO COPY until rewritten'],
  'checkout_fields':                 ['checkout/fields',                'the checkout form fields, in their language'],
  'checkout_shipping_rates':         ['checkout/shipping_rates',        'delivery cost and the free-delivery threshold, in their currency'],
};

/**
 * Doors a build can finish WITHOUT, but whose absence changes what you can promise.
 *
 * These are probed and REPORTED, never fatal — which is the whole reason they are a separate list.
 * Putting one in NEEDED would stop a build that `codbrand-content-builder` explicitly says to
 * continue: *"With no key holding that grant, (b) is not available to you: continue with (c) … and
 * say in your report that the structural check did not run."* A gate that stops a build the
 * companion skill says to finish is a wrong gate.
 *
 * `content_builders_validate` is here because of a measured surprise (18-09-2026): the door is
 * deployed and working on demo.codbrand.pro, and the store's own build key answers **403
 * forbidden_scope** on it. Nothing said so until phase 7 — preflight probed fifteen doors and not
 * this one — which is precisely the late discovery this script exists to prevent.
 */
const OPTIONAL = {
  'content_builders_validate': {
    path: 'content_builders/validate',
    why: 'check page markup before publishing. Without it, codbrand-content-builder\'s structural ' +
         'check (b) cannot run; its strict check (c) still can, and your report must say (b) did not run.',
    /* PROBED WITH A POST, and that does not contradict "write scopes are not probed" further down.
     * This door is `read`-scoped and its own doc states it "changes nothing on the site" — it parses
     * the markup you hand it and answers. A GET returns 405 here, which says the door exists and
     * nothing at all about whether this key may use it; the first version of this probe reported
     * exactly that and was useless. Probing a door the way it is actually called is the only honest
     * test of whether the key can open it. */
    method: 'POST',
    body: { content: '<!-- wp:paragraph --><p>preflight</p><!-- /wp:paragraph -->' },
  },
};

/**
 * Slug in, URL path out — ASK `/me`, never guess.
 *
 * The two are frequently different: `design_controls_font_manager` is served at
 * `design_controls/font_manager`, and `section_manager_global_settings` at
 * `section_manager/global_settings`. Hardcoding paths here got two of them wrong on the first
 * attempt, which is exactly the transcription rot this skill avoids everywhere else.
 *
 * The fallback matters too: `menus_items` is a real resource that `/me` does not list, so it has no
 * published path. Converting the last underscore to a slash reaches it, and if that guess is wrong
 * the probe reports a 404 rather than silently skipping the door.
 */
function pathFor(slug, fallback, resources) {
  const declared = resources?.[slug]?.path;
  return (typeof declared === 'string' && declared) ? declared : fallback;
}

const line = (ok, text) => console.log(`  ${ok ? '✓' : '✗'} ${text}`);

import { existsSync } from 'node:fs';
import { join } from 'node:path';


/**
 * What design systems does this install already carry?
 *
 * The plugin ships four, all with full CRUD through the API: the colour palette, the font manager,
 * the icons library and the design presets. A build that does not know what is already there
 * duplicates it, or worse picks a value out of it blind.
 *
 * TWO REAL FAILURES THIS EXISTS TO STOP, both measured on the plugin's own demo store:
 *
 *   - An accordion on the product page rendered a TELEPHONE icon, because the shipped default for
 *     that block was icon id 12, and 12 is `phone`. Nothing had ever joined an id to its name, so
 *     nothing could see it. Its own sibling blocks used 42/43 (`chevron-down`/`chevron-up`).
 *   - A cart button pointed at icon id 17, which does not exist. `getIconCode()` returns null for an
 *     unknown id, silently, so the control rendered with no icon and nothing reported it.
 *
 * Opposite behaviours - one inherited a default, one wrote its own - with one cause: THE ID WAS
 * NEVER RESOLVED TO A MEANING. So this prints the names, and the rule that follows from them.
 */
async function censusDesignSystems(call, resources) {
  const systems = [
    ['icons',    'design_controls_icons_manager', 'design_controls/icons_manager'],
    ['fonts',    'design_controls_font_manager',  'design_controls/font_manager'],
    ['palette',  'design_controls_color_palette', 'design_controls/color_palette'],
    ['presets',  'design_controls_presets',       'design_controls/presets'],
  ];

  console.log('\nDesign systems already on this install — reuse before you create:\n');
  let icons = null;

  for (const [label, slug, fallback] of systems) {
    const res = await call(`${pathFor(slug, fallback, resources)}?per_page=200`);
    if (res.status !== 200) { line(false, `${label.padEnd(9)} could not read (HTTP ${res.status})`); continue; }
    const rows = Array.isArray(res.body) ? res.body : (res.body?.items ?? res.body?.data ?? []);
    line(true, `${label.padEnd(9)} ${rows.length}`);
    if (label === 'icons') icons = rows;
  }

  if (icons && icons.length) {
    const names = icons.map((i) => i.name).filter(Boolean).sort();
    console.log('\n  The icons, BY NAME — address them this way, never by a remembered number:\n');
    for (let i = 0; i < names.length; i += 6) {
      console.log('    ' + names.slice(i, i + 6).map((n) => n.padEnd(22)).join('').trimEnd());
    }
    console.log('\n  Look the NAME up and use the id the API returns. Two separate defects on this');
    console.log('  plugin\'s own demo came from writing a literal id: one inherited `12` (phone) onto');
    console.log('  an accordion, the other wrote `17`, which does not exist and rendered nothing.');
    console.log('  If no name fits, you may CREATE one — and record why in the blueprint.');
  }
}

async function main(base) {
  /* A side-effect-free POST, for the one kind of door a GET cannot honestly test. */
  const post = async (path, body) => {
    const res = await fetch(`${base}/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json',
                 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    let parsed = null;
    try { parsed = await res.json(); } catch { /* the status is enough */ }
    return { status: res.status, body: parsed };
  };

  const call = async (path) => {
    const res = await fetch(`${base}/${path}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    });
    let body = null;
    try { body = await res.json(); } catch { /* non-JSON: status still tells us what happened */ }
    return { status: res.status, body };
  };

  console.log(`\nPreflight → ${base}\n`);

  const me = await call('me');

  if (me.status === 401 || me.status === 403) {
    console.error(`  ✗ the key was rejected (HTTP ${me.status}).`);
    console.error('    Check it was copied whole — a key is shown once, at creation.\n');
    return 1;
  }
  if (me.status === 404) {
    console.error('  ✗ no COD Leads API at this URL.');
    console.error('    This skill only works on a WordPress site running that plugin —');
    console.error('    not on Shopify, plain WooCommerce, or plain WordPress.\n');
    return 1;
  }
  if (me.status !== 200 || !me.body) {
    console.error(`  ✗ unexpected reply (HTTP ${me.status}). Is the site up?\n`);
    return 1;
  }

  line(true, 'API answers, key accepted');

  /* /me's shape varies by plugin version, so look for the slug anywhere in the payload rather
     than assuming which key holds the resource list. */
  if (me.body.theme) {
    line(true, `theme: ${me.body.theme}`);
  }

  /*
   * PROBE each door — do not read the capability off `/me`.
   *
   * `/me` lists what each RESOURCE offers (`"scopes":["read","write","transfer"]`), never what THIS
   * KEY was granted, and it publishes no scope list for the key at all. An earlier version of this
   * script matched the slug against the `/me` payload and reported a door "✓" that then returned 403
   * on the first real call — which is how a build got all the way to phase 8 before discovering it
   * could not write a single menu link.
   *
   * A GET is the honest test: 200 means the key can actually open the door, 403 means the scope is
   * missing, 404 means the door is not there at all.
   */
  console.log('\nDoors this build needs — probed, not assumed:\n');
  const missing = [];
  const forbidden = [];

  for (const [slug, [fallback, why]] of Object.entries(NEEDED)) {
    const path = pathFor(slug, fallback, me.body.resources);
    const res = await call(`${path}?per_page=1`);
    /*
     * 400 COUNTS AS REACHABLE. Some doors cannot be listed blind — `menus/items` needs a `menu_id`,
     * because "every link in every menu" is not a question it answers — and replies
     * `cl_api_missing_param`. That is the handler talking, which means the request already cleared
     * auth and scope (a 403 fires before it). The probe asks "can this key open the door", not "is
     * this a valid call", so treating a 400 as failure would report a working door as broken.
     */
    if (res.status === 200 || res.status === 400) {
      line(true, path);
    } else if (res.status === 403) {
      line(false, `${path.padEnd(32)} — no scope for it. ${why}`);
      forbidden.push(path);
    } else if (res.status === 404) {
      line(false, `${path.padEnd(32)} — door not found (HTTP 404). ${why}`);
      missing.push(path);
    } else {
      line(false, `${path.padEnd(32)} — HTTP ${res.status}. ${why}`);
      missing.push(path);
    }
  }

  await censusDesignSystems(call, me.body.resources);

  /* The shape of this build, echoed back so it is on the record and in front of the agent. */
  console.log('\nThis build:\n');
  line(true, mode === 'demo'
    ? 'mode DEMO — BUILD every feature the archetype supports; showing the product off is the job'
    : 'mode MERCHANT — OFFER a feature when the archetype fits, and let them decline');
  line(true, `seller in ${country} — legal pages are built from this and from the market below`);
  line(true, market === country
    ? `customers in ${market} (same as the seller)`
    : `customers in ${market} — DIFFERENT from the seller, so consumer obligations follow ${market}`);
  console.log('    → legal pages are BUILT BY DEFAULT and the merchant may decline them. Draft them');
  console.log('      clearly marked as unverified, say what you do not know, and never claim');
  console.log('      compliance. A confident generic Terms page is worse than an empty one.');

  /* The nice-to-haves. Probed the same way, reported, never fatal. */
  console.log('\nDoors that are optional — a missing one narrows what you can promise, not whether you can start:\n');
  for (const [slug, spec] of Object.entries(OPTIONAL)) {
    const path = pathFor(slug, spec.path, me.body.resources);
    const why = spec.why;
    const res = spec.method === 'POST' ? await post(path, spec.body) : await call(`${path}?per_page=1`);
    if (res.status === 200 || res.status === 400) {
      line(true, path);
    } else if (res.status === 403) {
      line(false, `${path.padEnd(32)} — no scope. ${why}`);
    } else {
      line(false, `${path.padEnd(32)} — HTTP ${res.status}. ${why}`);
    }
  }

  /* Has this store been built before? The answer changes how much you may touch. */
  const bp = await call('store_blueprint');
  if (bp.status === 200) {
    const n = Array.isArray(bp.body) ? bp.body.length : (bp.body?.items?.length ?? 0);
    console.log('');
    line(true, `store_blueprint readable — ${n} existing version(s)`);
    if (n > 0) {
      console.log('    → this store has been built before. READ its applied blueprint before');
      console.log('      changing anything, and ask the scoping question first.');
    }
  }

  /* The companion renderer — a local check, not an API one, but a build stops dead without it. */
  console.log('');
  const companion = findCompanionSkill();
  line(!!companion, companion
    ? 'codbrand-content-builder installed — it renders the pages'
    : 'codbrand-content-builder NOT installed — required to build any page');

  if (forbidden.length || missing.length) {
    console.error('\nSTOP. This key cannot complete a build.');

    if (forbidden.length) {
      console.error('\nThe key is missing a scope for:\n');
      for (const m of forbidden) console.error(`    • ${m}`);
      console.error('\nAsk the merchant to tick these in their API settings and save the key.');
      console.error('A scope CAN be added to an existing key: open it in COD Leads -> API, tick the');
      console.error('missing permission and save. Re-issuing the key is not required.');
    }

    if (missing.length) {
      console.error('\nThese doors did not answer at all:\n');
      for (const m of missing) console.error(`    • ${m}`);
      console.error('\nThat usually means the plugin is older than this skill expects. Say so —');
      console.error('it is a different problem from a missing scope and has a different fix.');
    }

    console.error('\nDo not work around either — a half-built store is worse than none.\n');
    return 1;
  }

  /*
   * WRITE access is NOT proven above. A GET tells you the read scope is there; the write scope is a
   * separate grant, and probing it would mean creating something on the merchant's store. So say what
   * this check does and does not cover, rather than implying more than it tested.
   */
  console.log('\n  ! read access verified above; WRITE scopes are not probed — creating test rows on');
  console.log('    a merchant\'s store to check them would be worse than finding out on first use.');

  /*
   * Two things a build that is COPYING A REFERENCE SITE depends on. Both are stated here rather than
   * at the phase that needs them, for the same reason the companion-skill check is: a dependency
   * discovered at the phase that needs it has already cost the whole build.
   *
   * ⚠️ The browser requirement is ANNOUNCED, not detected — and the distinction is deliberate. This
   * is a bare-node script; it cannot see what tools the agent running it has. Printing a "✓" for
   * something untested is exactly the failure this file's own door-probe comment warns about, so it
   * asks instead of pretending. Answering it is the agent's job, honestly.
   */
  console.log('\nIf the merchant gave you a REFERENCE SITE to match:\n');
  console.log('  . capability comes from `settings_schema`, which ships beside `settings` on every');
  console.log('    design read — derive it there, never from a list carried in this skill.');
  console.log('    (references/reference-extraction.md → "Capability — ask the install")');
  console.log('  ? a BROWSER is required — measuring a reference means computed style on a rendered');
  console.log('    page, which this script cannot do and cannot detect that you can. If you have no');
  console.log('    browser, say so NOW: extract what static HTML gives (counts, order, labels), mark');
  console.log('    every computed-style row `unmeasurable`, and tell the merchant which parts of');
  console.log('    their reference went unchecked. An unmeasurable row never counts as a match.');

  if (!companion) {
    console.error('\nSTOP. The companion skill is missing.');
    console.error('This skill decides WHAT the store should be; `codbrand-content-builder` renders');
    console.error('the pages. Without it the build reaches the content phase and cannot continue.\n');
    console.error('Install it alongside this one:\n');
    console.error('    cp -r codbrand-content-builder ~/.claude/skills/\n');
    console.error('Then run this preflight again.\n');
    return 1;
  }

  console.log('\nReady. Start at phase 0: read the store before deciding anything.\n');
  return 0;
}

const MODES = ['demo', 'merchant'];
const missingArgs = [];
if (!rawUrl || !apiKey) missingArgs.push('<site-url> and <api-key>');
if (!MODES.includes(mode)) missingArgs.push('--mode=demo|merchant');
if (!country) missingArgs.push('--country=<where the SELLER is>');
if (!market) missingArgs.push('--market=<where the CUSTOMER is>');

if (missingArgs.length) {
  console.error('\nusage: node preflight.mjs <site-url> <api-key> --mode=<demo|merchant> --country=<CC> --market=<CC>\n');
  console.error('missing:');
  for (const m of missingArgs) console.error(`  • ${m}`);
  console.error('\nNone of these is inferable, which is why the script refuses rather than guessing:');
  console.error('  --mode     demo BUILDS every feature the archetype supports; merchant OFFERS them.');
  console.error('             Guess wrong and you either impose features on a merchant who will not');
  console.error('             operate them, or ship a demo that hides the product.');
  console.error('  --country  where the SELLER is.');
  console.error('  --market   where the CUSTOMER is. Separate on purpose: consumer obligations follow');
  console.error('             the customer, so collapsing the two silently picks the wrong');
  console.error('             jurisdiction for a cross-border seller. Pass the same value twice when');
  console.error('             they match.\n');
  process.exitCode = 1;
} else {
  const base = rawUrl.replace(/\/+$/, '').replace(/\/wp-json.*$/, '') + '/wp-json/cl-api/v1';
  main(base)
    .then((code) => { process.exitCode = code; })
    .catch((err) => {
      console.error(`\n  ✗ could not reach the site: ${err.message}`);
      console.error('    Check the URL, and that the site is reachable from this machine.\n');
      process.exitCode = 1;
    });
}

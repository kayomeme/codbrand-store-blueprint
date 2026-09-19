#!/usr/bin/env node
/**
 * match.mjs — does the store you built actually match the reference you were given?
 *
 *   node match.mjs --reference reference-spec.json --live live-spec.json
 *   node match.mjs --reference a.json --reference b.json --reference c.json --live live-spec.json
 *
 * ONE reference is a target. SEVERAL are a BAND, and that is what makes this script usable on a
 * build with no reference site at all. A merchant who names a site to copy gets the first form. A
 * merchant who names only a NICHE gets the second: measure the three best stores in that niche and
 * match against the band they describe together.
 *
 * Why a band rather than an average: three good stores in a niche do not agree on a number, they
 * occupy a range. Averaging them invents a fourth store none of them is, and then reports a build
 * that looks exactly like one of the three as a mismatch. A row inside the band is a row a real
 * store in that niche actually shipped.
 *
 * Before this, phase 9 ran "only if phase 2 ran", and phase 2 ran "only if they named a site to look
 * like" - so a niche build had no match phase AT ALL and nothing it produced could be re-tested
 * against anything. That was the gap; the band closes it.
 *
 * Both files come from `references/reference-extraction.md`, which is written to be executed TWICE:
 * once against the merchant's reference site, once against the storefront you built. This script
 * diffs the two, row by row.
 *
 * WHY THIS EXISTS AS A SCRIPT: because the alternative already failed. A build matched to a reference
 * "by eye" needed four rounds of the owner pointing at defects — a nav with 6 items where the
 * reference had 2, a footer column the reference did not have, a beige band where the reference was
 * neutral grey, and a topbar whose colours were inverted. Every one is a value comparison a machine
 * does perfectly and a reader skims past.
 *
 * TWO THINGS THIS DELIBERATELY REFUSES TO DO:
 *
 *   1. Accept a free-text excuse. A row that does not match passes only with a `reason` of a known
 *      KIND carrying evidence — and `within_tolerance` is re-checked numerically here rather than
 *      believed. The agent being gated is the one writing the reasons; a sentence about your own work
 *      is not evidence.
 *   2. Trust two rows measured differently. If `traversal` differs between the specs the comparison
 *      is meaningless, and a meaningless comparison that returns "match" is worse than no check.
 *
 * No dependencies — same rule as every script here: a merchant must never install a toolchain to
 * find out their store does not match what they asked for.
 *
 * NOTE: sets `process.exitCode` and returns; never calls process.exit(), for the same reason
 * preflight.mjs does not — killing the loop mid-write truncates the report.
 */

import { readFileSync, existsSync } from 'node:fs';

const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? null : argv[i + 1];
};

/** Every occurrence of a repeatable flag, in order. `--reference` may be given up to three times. */
const args = (name) => argv.reduce((out, a, i) => (a === `--${name}` && argv[i + 1] ? [...out, argv[i + 1]] : out), []);

/* ── colour, kept local on purpose ──────────────────────────────────────────────────────────────
 * contrast.mjs has this arithmetic too, but it is a CLI with no exports. Adding exports to that
 * script so this one can borrow 15 lines would couple two phases of the build for no real gain —
 * and the sub-project's own rule is that each script stands alone. Duplicated knowingly.
 * Only used for the pair check below, which needs "are these two colours effectively identical",
 * not a WCAG verdict. */
/* Returns { rgb, alpha }. ⚠️ ALPHA IS NOT OPTIONAL HERE, and dropping it was a real bug in this
 * file: `rgba(0,0,0,0)` — the computed backgroundColor of the transparent wrapper in the documented
 * topbar failure — parsed as OPAQUE BLACK, so white-on-transparent scored 21:1 and sailed straight
 * through the one check written to catch that exact mistake. A transparent value is not a colour;
 * it is proof the walk-up stopped before it reached anything that paints. */
const parseColour = (v) => {
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  const m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)/);
  if (m) {
    const raw = m[4];
    const alpha = raw === undefined ? 1 : raw.endsWith('%') ? Number(raw.slice(0, -1)) / 100 : Number(raw);
    return { rgb: [Number(m[1]), Number(m[2]), Number(m[3])], alpha: Number.isFinite(alpha) ? alpha : 1 };
  }
  const h = s.match(/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/);
  if (!h) return null;
  const short = h[1].length <= 4;
  const hex = short ? h[1].split('').map((c) => c + c).join('') : h[1];
  return {
    rgb: [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)),
    alpha: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
  };
};

const luminance = (rgb) => {
  const [r, g, b] = rgb.map((c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (a, b) => {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

/* A surface a human can read is never below this. At or under it, the two colours are effectively
 * the same — which for a RENDERED surface is impossible, so it is proof one of them was sampled off
 * the wrong element rather than evidence of a low-contrast design. Deliberately far below any
 * legibility threshold: this is a "that cannot be real" test, not a WCAG test. contrast.mjs is where
 * legibility is judged. */
const IMPOSSIBLE_RATIO = 1.5;

const REASON_KINDS = ['not_expressible', 'needs_a_preset', 'within_tolerance', 'merchant_override', 'unmeasurable'];

/* Each excusable kind must name the SOURCE it was decided from. The anchor is a literal string that
 * only appears in the evidence if the writer went and looked at the right place:
 *
 *   not_expressible / needs_a_preset  the design's own `settings_schema` — absence there is the
 *                                     whole claim, and it ships beside `settings` on every read
 *   merchant_override                 a `decisions.<key>` path into the blueprint that authorised it
 *
 * ⚠️ BE HONEST ABOUT WHAT THIS PROVES. It proves the writer consulted the right source. It cannot
 * prove they read it correctly — no string check can. It exists because the previous bar (any eight
 * characters) let "looked at it and it seemed fine to me honestly" through as `not_expressible`,
 * which is the self-certifying excuse this whole gate was built to refuse.
 *
 * These three literals are OUR OWN vocabulary — `settings_schema` is named by the API's docs and
 * `decisions` by `references/blueprint-format.md` — not a curated list of plugin capabilities, so
 * there is nothing here to rot on a machine we cannot reach. Do not grow this into one. */
const EVIDENCE_ANCHOR = {
  not_expressible:   { needle: 'settings_schema', want: 'name `settings_schema` and what you searched it for' },
  needs_a_preset:    { needle: 'settings_schema', want: 'name `settings_schema` (absent there) and the property class' },
  merchant_override: { needle: 'decisions.',      want: 'cite the blueprint decision, e.g. `decisions.palette`' },
};

function load(path, label) {
  if (!path) {
    console.log(`  ✗ missing --${label} <file>`);
    return null;
  }
  if (!existsSync(path)) {
    console.log(`  ✗ ${label}: no such file — ${path}`);
    return null;
  }
  try {
    const spec = JSON.parse(readFileSync(path, 'utf8'));
    if (!Array.isArray(spec.properties)) {
      console.log(`  ✗ ${label}: no "properties" array — see references/reference-extraction.md`);
      return null;
    }
    return spec;
  } catch (e) {
    console.log(`  ✗ ${label}: not valid JSON — ${e.message}`);
    return null;
  }
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * How far apart are two colours, as a plain RGB distance?
 *
 * WHY A BAND OF COLOURS IS NOT AN ENUM — found by running this against three real footwear stores
 * (18-09-2026). Their footer text measured rgb(74,74,74), rgb(20,20,21) and rgb(255,255,255); ours
 * measured rgb(0,0,0). Folded as a SET, a build could only pass by reproducing one of those values
 * exactly — so a perfectly ordinary near-black was reported as a mismatch, and the only way to
 * "fix" it would have been to copy a specific brand's hex. That is the opposite of what this skill
 * asks for: match the measurable STYLE, never the content.
 *
 * Three near-blacks are one design decision. So a colour row passes when it is within
 * COLOUR_TOLERANCE of the NEAREST reference colour, and fails when it is genuinely a different
 * choice (white where every reference is dark). Distance, not equality; nearest, not all.
 */
function parseRgb(v) {
  if (typeof v !== 'string') return null;
  const m = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/* ~48 in RGB space. Wide enough that rgb(0,0,0), rgb(20,20,21) and rgb(45,42,42) are the same
 * decision; narrow enough that a mid grey, a saturated hue or an inverted value is not. Deliberately
 * cruder than a perceptual ΔE formula: this gate is about "did you make the same CHOICE", and a
 * dependency-free threshold that a reader can check by eye beats a formula they must trust. */
const COLOUR_TOLERANCE = 48;

const colourDistance = (a, b) => Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2);

/** A number, or a string that is one with a unit attached ("16px", "1.5"). Otherwise null. */
function numeric(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const m = v.trim().match(/^-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/**
 * Fold several reference specs into one target spec describing the BAND they occupy.
 *
 * Per property id:
 *   every reference agrees            -> { value }    an exact target, identical to the 1-ref case
 *   they differ and all are numeric   -> { band }     min..max, inclusive
 *   they differ otherwise             -> { allowed }  the distinct values any of them shipped
 *
 * A property NOT present in every reference is DROPPED and named in `dropped`. Keeping it would mean
 * inventing a band from a partial sample; reporting it is what tells the agent the exemplars
 * disagree structurally, which is itself worth knowing - two of three having a topbar is a finding,
 * not a row to match.
 */
function foldReferences(specs) {
  const first = specs[0];
  const counts = new Map();
  for (const spec of specs) {
    for (const p of spec.properties) counts.set(p.id, (counts.get(p.id) ?? 0) + 1);
  }

  const properties = [];
  const dropped = [];

  for (const [id, n] of counts) {
    if (n < specs.length) { dropped.push({ id, seen: n }); continue; }
    const rows = specs.map((spec) => spec.properties.find((p) => p.id === id));
    const values = rows.map((r) => r.value);
    const base = { id, traversal: rows[0].traversal, pair_with: rows[0].pair_with, reason: rows.find((r) => r.reason)?.reason };

    /* An UNMEASURABLE reference does not get a vote. `null` means "could not look", and folding it
     * into an allowed set turns "we did not measure this on two of three sites" into "null is a
     * legitimate value your build may have" - which is how a non-answer becomes a constraint.
     * It reduces the SAMPLE instead; below two real values there is no band to speak of. */
    const real = values.filter((v) => v !== null && v !== undefined);
    if (real.length < 2) {
      dropped.push({ id, seen: real.length, why: 'measurable on fewer than two references' });
      continue;
    }

    const distinct = [...new Map(real.map((v) => [JSON.stringify(v), v])).values()];
    if (distinct.length === 1) { properties.push({ ...base, value: distinct[0] }); continue; }

    const nums = real.map(numeric);
    if (nums.every((x) => x !== null)) {
      properties.push({ ...base, band: { min: Math.min(...nums), max: Math.max(...nums) }, samples: real });
      continue;
    }

    const cols = real.map(parseRgb);
    if (cols.every((c) => c !== null)) {
      properties.push({ ...base, colours: cols, samples: real });
      continue;
    }

    properties.push({ ...base, allowed: distinct });
  }

  return {
    source: `${specs.length} references: ${specs.map((x) => x.source ?? '(unnamed)').join(', ')}`,
    viewport: first.viewport,
    properties,
    dropped,
  };
}

/**
 * Does the live value satisfy the target? Returns null on success, else the string saying why not.
 * An exact target is still `same()`, so a single-reference run behaves exactly as it always did.
 */
function offTarget(target, liveValue) {
  if ('value' in target) {
    return same(target.value, liveValue) ? null : null_or(target.value, liveValue);
  }
  if (target.band) {
    const n = numeric(liveValue);
    if (n === null) return `${JSON.stringify(liveValue)} is not numeric, so it cannot sit in the band ${target.band.min}..${target.band.max}`;
    if (n < target.band.min || n > target.band.max) {
      return `${n} is outside the band ${target.band.min}..${target.band.max} that the references occupy (${target.samples.map((v) => JSON.stringify(v)).join(', ')})`;
    }
    return null;
  }
  if (target.colours) {
    const live = parseRgb(liveValue);
    if (!live) return `${JSON.stringify(liveValue)} is not a colour, so it cannot sit near the references' ${target.samples.join(', ')}`;
    const nearest = Math.min(...target.colours.map((c) => colourDistance(c, live)));
    if (nearest > COLOUR_TOLERANCE) {
      return `${JSON.stringify(liveValue)} is ${Math.round(nearest)} away from the nearest colour the references shipped (${target.samples.join(', ')}); anything past ${COLOUR_TOLERANCE} is a different decision, not a different shade`;
    }
    return null;
  }
  if (target.allowed) {
    return target.allowed.some((v) => same(v, liveValue))
      ? null
      : `${JSON.stringify(liveValue)} is none of the values the references shipped: ${target.allowed.map((v) => JSON.stringify(v)).join(', ')}`;
  }
  return 'target row carries neither a value, a band nor an allowed set';
}

/* Kept separate so the exact-match message is unchanged from the single-reference era. */
const null_or = (a, b) => `${JSON.stringify(a)} -> ${JSON.stringify(b)}`;

/** The band edge a live value missed, so `within_tolerance` measures from the band, not from a
 * reference row that stopped existing the moment several were folded into one. */
function nearestEdge(band, liveValue) {
  const n = numeric(liveValue);
  if (n === null) return band.min;
  return Math.abs(n - band.min) <= Math.abs(n - band.max) ? band.min : band.max;
}

/**
 * Is this row's `reason` good enough to let a non-matching row pass?
 * Returns null when acceptable, otherwise the string saying why not.
 */
function rejectReason(row, refValue, liveValue) {
  const r = row.reason;
  if (!r || typeof r !== 'object') {
    return 'does not match and carries no `reason` — a bare mismatch never passes';
  }
  if (!REASON_KINDS.includes(r.kind)) {
    return `reason.kind "${r.kind ?? '(none)'}" is not one of: ${REASON_KINDS.join(', ')}`;
  }
  if (r.kind === 'unmeasurable') {
    return 'unmeasurable — reported, never passed. Say which parts of the reference you could not check';
  }
  if (r.kind === 'within_tolerance') {
    const tol = Number(row.tolerance);
    const a = Number(refValue);
    const b = Number(liveValue);
    if (!Number.isFinite(tol)) return 'within_tolerance needs a numeric `tolerance` on the row';
    if (!Number.isFinite(a) || !Number.isFinite(b)) return 'within_tolerance only applies to numeric values';
    if (Math.abs(a - b) > tol) return `claims within_tolerance but |${a} - ${b}| > ${tol}`;
    return null; // re-checked, not believed
  }
  const evidence = String(r.evidence ?? '').trim();
  const anchor = EVIDENCE_ANCHOR[r.kind];
  if (evidence.length < 20) {
    return `reason.kind "${r.kind}" needs \`evidence\` — ${anchor.want}`;
  }
  if (!evidence.includes(anchor.needle)) {
    return `evidence does not mention \`${anchor.needle}\`, so nothing shows you checked. ` +
           `A sentence about your own work is not evidence — ${anchor.want}`;
  }
  return null;
}

/** The one check that does not need the reference: a colour pair that could not render. */
function pairFailures(spec, label) {
  const byId = new Map(spec.properties.map((p) => [p.id, p]));
  const out = [];
  for (const p of spec.properties) {
    if (!p.pair_with) continue;
    const partner = byId.get(p.pair_with);
    if (!partner) {
      out.push(`${label}: ${p.id} → pair_with "${p.pair_with}" is not in this spec`);
      continue;
    }
    const [fg, bg] = [parseColour(p.value), parseColour(partner.value)];
    if (!fg || !bg) continue; // null/unmeasurable — the row check reports it

    /* A see-through value is not a painted surface. Recording one as the background a colour sits
     * on means the walk-up stopped on a wrapper — the documented failure, caught here directly
     * instead of via a contrast ratio it would have passed. */
    const seeThrough = [[bg, partner], [fg, p]].filter(([c]) => c.alpha < 0.95);
    if (seeThrough.length) {
      for (const [c, row] of seeThrough) {
        out.push(
          `${label}: ${row.id} is "${row.value}" — alpha ${c.alpha}, so nothing there paints. ` +
          'A transparent value means the traversal stopped short: keep walking UP until ' +
          'backgroundColor is opaque, and sample text colour DOWN at the node holding the text.'
        );
      }
      continue;
    }

    const r = ratio(fg.rgb, bg.rgb);
    if (r <= IMPOSSIBLE_RATIO) {
      out.push(
        `${label}: ${p.id} (${p.value}) on ${partner.id} (${partner.value}) — ratio ${r.toFixed(2)}:1. ` +
        'That surface could not be read by anyone, so one of the two was sampled off the wrong ' +
        'element. Re-measure: background walks UP to the first painting ancestor, text colour walks ' +
        'DOWN to the deepest node holding the visible text.'
      );
    }
  }
  return out;
}

function main() {
  const refPaths = args('reference');
  const loaded = refPaths.map((path, i) => load(path, refPaths.length > 1 ? `reference ${i + 1}` : 'reference'));
  const live = load(arg('live'), 'live');
  if (!refPaths.length || loaded.some((x) => !x) || !live) {
    console.log('\n  usage: node match.mjs --reference <spec.json> [--reference ...] --live live-spec.json\n');
    console.log('  One --reference matches a named site. Two or three match the BAND they occupy,');
    console.log('  which is how a NICHE build is verified: measure the best stores in that niche.\n');
    process.exitCode = 1;
    return;
  }

  /* All references must have been measured at one viewport, for the same reason the reference and
   * the live store must: every dimensional row is a function of the width it was measured at. */
  const widths = new Set(loaded.map((r) => r.viewport?.width).filter((w) => w !== undefined));
  if (widths.size > 1) {
    console.log(`  \u2717 the references were measured at different viewports (${[...widths].join(', ')}).`);
    console.log('      Re-measure them all at one width. A band built from mixed widths is noise.\n');
    process.exitCode = 1;
    return;
  }

  const ref = loaded.length === 1 ? loaded[0] : foldReferences(loaded);

  if (ref.dropped?.length) {
    console.log(`  ! ${ref.dropped.length} propert(ies) are not present in every reference, so no band`);
    console.log('    could be derived and they are NOT matched. That the references disagree here is');
    console.log('    itself worth knowing:');
    for (const d of ref.dropped.slice(0, 10)) {
      console.log(`      \u00b7 ${d.id} (in ${d.seen} of ${loaded.length})${d.why ? ' \u2014 ' + d.why : ''}`);
    }
    console.log('');
  }

  console.log(`\nMatch → reference ${ref.source ?? '(unnamed)'}  vs  live ${live.source ?? '(unnamed)'}\n`);

  /* Two pages measured at different widths cannot be compared at all: every height, inset and
   * max-width is a function of the viewport, so a diff between them is noise either way it lands —
   * a real mismatch reported as agreement, or agreement reported as a defect. The spec records the
   * viewport; it is worth nothing unless something reads it. */
  const [rv, lv] = [ref.viewport, live.viewport];
  if (rv && lv && (rv.width !== lv.width || rv.height !== lv.height)) {
    console.log(
      `  ✗ measured at different viewports — reference ${rv.width}×${rv.height}, live ${lv.width}×${lv.height}.\n` +
      '      Re-measure the live store at the reference\'s viewport. Every dimensional row below is\n' +
      '      meaningless until you do.\n'
    );
    process.exitCode = 1;
    return;
  }

  /* Pair check next, and on BOTH specs. It is the only failure that proves a measurement is wrong
   * rather than that the build is wrong — and if a sample is bad, every diff below it is noise. */
  const pairs = [...pairFailures(ref, 'reference'), ...pairFailures(live, 'live')];
  if (pairs.length) {
    console.log('IMPOSSIBLE COLOUR PAIRS — measurement is wrong, not the build:\n');
    for (const p of pairs) console.log(`  ✗ ${p}`);
    console.log('\n  Fix the measurement and re-run. Nothing below is trustworthy until you do.\n');
    process.exitCode = 1;
    return;
  }

  const liveById = new Map(live.properties.map((p) => [p.id, p]));
  const problems = [];
  let matched = 0;
  let excused = 0;

  for (const r of ref.properties) {
    const l = liveById.get(r.id);
    if (!l) {
      problems.push([r.id, 'not measured on the live store — the checklist must be run identically on both']);
      continue;
    }
    if (r.traversal && l.traversal && r.traversal !== l.traversal) {
      problems.push([r.id, `measured differently (${r.traversal} vs ${l.traversal}) — that comparison means nothing`]);
      continue;
    }
    const off = offTarget(r, l.value);
    if (!off) {
      matched++;
      continue;
    }
    // Either side may carry the reason: the reference declares what is not expressible,
    // the live spec declares what the merchant overrode.
    // `within_tolerance` is re-checked numerically against the target's own centre: for a band that
    // is the nearer edge, because "close enough to the band" is measured from the band, not from a
    // reference row that no longer exists once several were folded together.
    const refValue = 'value' in r ? r.value
      : r.band ? nearestEdge(r.band, l.value)
      : r.colours ? r.samples[0]
      : r.allowed?.[0];
    const why = rejectReason(l.reason ? l : r, refValue, l.value);
    if (why) {
      problems.push([r.id, `${off} \u2014 ${why}`]);
    } else {
      excused++;
      console.log(`  ~ ${r.id.padEnd(30)} ${(l.reason ?? r.reason).kind}`);
    }
  }

  const extra = live.properties.filter((p) => !ref.properties.some((r) => r.id === p.id));
  for (const e of extra) console.log(`  · ${e.id.padEnd(30)} present in your build, absent from the reference`);

  console.log(`\n  ${matched} match · ${excused} excused with evidence · ${problems.length} unresolved\n`);

  if (problems.length) {
    console.log('UNRESOLVED — each needs a real fix or a reason with evidence:\n');
    for (const [id, msg] of problems) console.log(`  ✗ ${id}\n      ${msg}`);
    console.log('\n  See references/reference-extraction.md → "Reasons — the gate is not a comment box".\n');
    process.exitCode = 1;
    return;
  }

  console.log('  Every row matches or is excused with evidence.\n');
}

main();

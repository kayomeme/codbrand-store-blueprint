#!/usr/bin/env node
/**
 * palette.mjs — a seed colour and an archetype in, twenty-six legible slots out.
 *
 *   node palette.mjs --seed "#8B5E3C" --archetype caregiver
 *   node palette.mjs --seed "#8B5E3C" --archetype lover > palette.json
 *
 * stdout is the JSON payload alone, so it can be redirected. The readable table and the
 * verification go to stderr.
 *
 * WHY A SCRIPT AND NOT JUDGEMENT: picking twenty-two colours by eye produces a palette that looks
 * plausible and fails at the till — the plugin's own shipped palette puts the sale price at 4.19:1
 * on a card, under the 4.5 it needs. That is not a mistake anyone SEES; it is a mistake you
 * MEASURE. So the contrast-critical slots here are not chosen, they are SOLVED: the tone walks
 * until the measured ratio passes, then stops. A model cannot do that in its head, which is the
 * whole reason this file exists.
 *
 * NO DEPENDENCIES, and that is deliberate — see "Why not material-color-utilities" at the foot.
 */

/* ── colour space: sRGB <-> CIELAB <-> LCh ─────────────────────────────────
 *
 * Lightness here is CIE L*, which is perceptually uniform — equal steps look equal. That is the
 * same property Material 3 calls "tone", and it is what makes a ramp behave predictably.
 */

const D65 = [0.95047, 1.0, 1.08883];
const E = 216 / 24389;
const K = 24389 / 27;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linearToSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

function hexToRgb(hex) {
  const h = String(hex).trim().replace(/^#/, '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

const rgbToHex = (rgb) =>
  '#' + rgb.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');

function rgbToLab([r, g, b]) {
  const [lr, lg, lb] = [r, g, b].map((v) => srgbToLinear(v / 255));
  const X = (0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb) / D65[0];
  const Y = (0.2126729 * lr + 0.7151522 * lg + 0.0721750 * lb) / D65[1];
  const Z = (0.0193339 * lr + 0.1191920 * lg + 0.9503041 * lb) / D65[2];
  const f = (t) => (t > E ? Math.cbrt(t) : (K * t + 16) / 116);
  const [fx, fy, fz] = [f(X), f(Y), f(Z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** @returns {{rgb:number[], inGamut:boolean}} */
function labToRgb([L, a, bb]) {
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - bb / 200;
  const inv = (t) => (t ** 3 > E ? t ** 3 : (116 * t - 16) / K);
  const [X, Y, Z] = [inv(fx) * D65[0], inv(fy) * D65[1], inv(fz) * D65[2]];

  const lin = [
    3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z,
    -0.9692660 * X + 1.8760108 * Y + 0.0415560 * Z,
    0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z,
  ];

  const srgb = lin.map(linearToSrgb);
  /* Half a unit of 8-bit tolerance — rounding alone must not read as out-of-gamut. */
  const inGamut = srgb.every((c) => c >= -0.002 && c <= 1.002);
  return { rgb: srgb.map((c) => clamp(c, 0, 1) * 255), inGamut };
}

const labToLch = ([L, a, b]) => [L, Math.hypot(a, b), (Math.atan2(b, a) * 180 / Math.PI + 360) % 360];

const lchToLab = ([L, C, h]) => {
  const r = h * Math.PI / 180;
  return [L, C * Math.cos(r), C * Math.sin(r)];
};

/**
 * One step on a ramp: hold hue, set lightness, keep as much chroma as sRGB can actually show.
 *
 * A requested chroma is frequently outside the gamut at a given lightness — vivid mid-tones exist,
 * vivid near-whites do not. Reducing chroma until the colour fits is the standard approach, and it
 * is what keeps a ramp's light end from silently clipping into a different hue.
 */
function ramp(hue, chroma, tone) {
  let lo = 0;
  let hi = chroma;
  let best = labToRgb(lchToLab([tone, 0, hue])).rgb;

  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const { rgb, inGamut } = labToRgb(lchToLab([tone, mid, hue]));
    if (inGamut) {
      best = rgb;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return rgbToHex(best);
}

/* ── WCAG, so the solver can measure rather than assume ────────────────────
 *
 * Identical arithmetic to contrast.mjs. Duplicated on purpose: both scripts must run standalone,
 * and a shared module would make each one useless without the other.
 */

const luminance = (rgb) => {
  const [r, g, b] = rgb.map((v) => srgbToLinear(v / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratioHex = (aHex, bHex) => {
  const [la, lb] = [luminance(hexToRgb(aHex)), luminance(hexToRgb(bHex))];
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
};

/**
 * Walk a ramp away from its preferred tone until every check passes, then stop.
 *
 * Stopping at the FIRST passing tone is the point: it keeps the colour as close to the intended
 * design as legibility permits, instead of over-darkening everything to be safe.
 */
function solveTone(hue, chroma, preferred, dir, checks, { min = 0, max = 100 } = {}) {
  for (let t = preferred; t >= min && t <= max; t += dir * 0.5) {
    const hex = ramp(hue, chroma, t);
    if (checks.every(({ against, need }) => ratioHex(hex, against) >= need)) {
      return { hex, tone: t, moved: Math.abs(t - preferred) };
    }
  }
  /* Unreachable for real inputs — pure black and pure white are always on the ramp. */
  const edge = dir < 0 ? min : max;
  return { hex: ramp(hue, chroma, edge), tone: edge, moved: Math.abs(preferred - edge), failed: true };
}

/* ── archetypes ────────────────────────────────────────────────────────────
 *
 * The archetype controls INTENSITY — how saturated the brand reads, how far the accent sits from
 * the page, how much colour survives in the neutrals. It does NOT control temperature: the seed
 * does that. Forcing "cool neutrals" onto a merchant whose logo is warm terracotta would be the
 * skill overruling the brand, which is not its job.
 *
 * Keep this table in step with references/archetypes.md — that file is what the merchant's answer
 * is matched against, this one is only how the answer becomes numbers. Adding an archetype there
 * without adding it here makes this script reject a name the skill just told the agent to use.
 */
const ARCHETYPES = {
  caregiver: { brandChroma: 34, neutralChroma: 4,   variantChroma: 6, pageTone: 96, accentTone: 32, note: 'warm, muted, one soft accent' },
  ruler:     { brandChroma: 14, neutralChroma: 1.5, variantChroma: 3, pageTone: 97, accentTone: 14, note: 'restrained accent, high contrast' },
  lover:     { brandChroma: 52, neutralChroma: 5,   variantChroma: 7, pageTone: 95, accentTone: 24, note: 'rich tones, deep neutrals' },
  everyman:  { brandChroma: 26, neutralChroma: 2,   variantChroma: 4, pageTone: 97, accentTone: 30, note: 'neutral, clear, unfussy' },
  sage:      { brandChroma: 20, neutralChroma: 2,   variantChroma: 4, pageTone: 98, accentTone: 28, note: 'low saturation, structured' },
  magician:  { brandChroma: 78, neutralChroma: 3,   variantChroma: 5, pageTone: 98, accentTone: 22, note: 'saturated, higher contrast' },
};

/** Sale red must read as urgent, and must not be mistaken for the brand colour. */
const SALE_HUE = 28;
const SALE_CHROMA = 62;

const AA = 4.5;

/* ── build ─────────────────────────────────────────────────────────────────
 *
 * Order is load-bearing. Backgrounds are free choices, so they settle first; text is then solved
 * against the background it will actually sit on; the accent blocks are solved LAST, against the
 * inverse text that will sit on THEM. Solving in any other order means solving against a value
 * that is about to move.
 */
function buildPalette(seedHex, archetypeName) {
  const a = ARCHETYPES[archetypeName];
  const [, seedC, seedH] = labToLch(rgbToLab(hexToRgb(seedHex)));

  /* A near-grey seed carries no usable hue, so anchor it rather than amplify sensor noise. */
  const hue = seedC < 4 ? 40 : seedH;

  /*
   * The archetype's chroma is a TARGET, not a ceiling clamped to the seed's own saturation.
   *
   * Clamping was the first implementation and it silently destroyed the whole point: with a
   * seed at chroma 30, `min(34,30)`, `min(52,30)` and `min(78,30)` all collapse to 30, so
   * caregiver, lover and magician rendered IDENTICALLY. Only a side-by-side render showed it —
   * every palette passed its contrast checks and looked fine alone.
   *
   * So the seed decides hue, the archetype decides intensity. A vivid seed under `ruler` is
   * deliberately pulled back to a restrained accent, and a muted seed under `magician` is pushed
   * up. That is the archetype doing the job the merchant picked it for. `ramp()` still gamut-maps,
   * so an unreachable target degrades to the most saturated colour sRGB can actually show.
   */
  const brandC = a.brandChroma;

  const brand = (t) => ramp(hue, brandC, t);
  const neutral = (t) => ramp(hue, a.neutralChroma, t);
  const variant = (t) => ramp(hue, a.variantChroma, t);

  const notes = [];

  /* 1. Backgrounds — unconstrained. */
  const bg1 = neutral(a.pageTone);
  const bg2 = neutral(100);
  const bg3 = neutral(a.pageTone - 5);
  /* A soft tinted panel, scaled off the brand so it stays restrained for ruler and punchy for
     magician. At full brand chroma this reads as a flat colour block rather than a highlight. */
  const bg5 = ramp(hue, brandC * 0.35, 93);

  /* 1b. Page surfaces (the plugin's fifth palette category, `page-bg-color`, 06-09-2026) — the
     colour behind a WHOLE page: the store's page background and the per-page override pick from
     these four and from nothing else. Two repeat the main and section tones so a stock store looks
     unchanged; the dark one is a NEUTRAL, not the accent, because body copy never sits on it (only
     inverse text does); the tint is paler than bg5 because a whole page of it must still read as a
     page, not as a panel. */
  const pg1 = bg1;
  const pg2 = bg2;
  const pg3 = neutral(12);
  const pg4 = ramp(hue, brandC * 0.2, 96);

  /* 2. Inverse text — the label that will sit on the accent blocks. */
  const txt5 = neutral(97);

  /* 3. Text, solved against every background it lands on. */
  const onPage = [bg1, bg2, bg3, pg4].map((against) => ({ against, need: AA }));

  const t1 = solveTone(hue, a.neutralChroma, 18, -1, onPage);
  const t2 = solveTone(hue, a.neutralChroma, 42, -1, onPage);
  const t6 = solveTone(SALE_HUE, SALE_CHROMA, 46, -1, onPage);

  if (t6.moved > 0) {
    notes.push(`sale text moved ${t6.moved.toFixed(1)} tone(s) to clear 4.5:1 on the card background`);
  }

  /* 4. Accent blocks — solved so the inverse text ON them passes. */
  const onInverse = [{ against: txt5, need: AA }];
  const b4 = solveTone(hue, brandC, a.accentTone, -1, onInverse);
  const b6 = solveTone(hue, brandC, Math.max(a.accentTone - 14, 6), -1, onInverse);
  const b7 = solveTone(SALE_HUE, SALE_CHROMA, 45, -1, onInverse);

  if (b4.moved > 0) {
    notes.push(`accent background moved ${b4.moved.toFixed(1)} tone(s) so the button label clears 4.5:1`);
  }
  if (b7.moved > 0) {
    notes.push(`sale background moved ${b7.moved.toFixed(1)} tone(s) so the discount badge clears 4.5:1`);
  }

  /* 5. The rest — muted and accent text are advisory; borders and shadows carry no text. */
  return {
    slots: {
      1:  t1.hex,       // Primary Text
      2:  t2.hex,       // Secondary Text
      3:  variant(55),  // Muted Text
      4:  brand(30),    // Accent Text
      17: txt5,         // Inverse Text
      22: t6.hex,       // Sale Text

      5:  bg1,          // Main Background
      6:  bg2,          // Section Background
      7:  bg3,          // Card Background
      8:  b4.hex,       // Accent Background
      18: bg5,          // Light Accent Background
      19: b6.hex,       // Dark Accent Background
      21: b7.hex,       // Sale Background

      23: pg1,          // Default Page Background
      24: pg2,          // White Page Background
      25: pg3,          // Dark Page Background
      26: pg4,          // Tinted Page Background

      9:  variant(89),  // Light Border
      10: variant(82),  // Medium Border
      11: variant(62),  // Dark Border
      12: b4.hex,       // Accent Border
      20: variant(85),  // Light Accent Border

      13: neutral(0),   // Deep Shadow
      14: neutral(15),  // Medium Shadow
      15: neutral(45),  // Light Shadow
      16: variant(62),  // Subtle Shadow
    },
    meta: { hue, brandChroma: brandC, archetype: archetypeName, note: a.note, notes },
  };
}

/* ── verification ──────────────────────────────────────────────────────────
 *
 * The same required pairs contrast.mjs enforces, checked here so a bad palette can never leave
 * this script in the first place. `17 on 21` is the discount badge — shipped in five defaults
 * across plist1 cards, the product page, upsells and the sale button preset.
 */
const REQUIRED = [
  [1, 5, 'body text on the page'],
  [1, 6, 'body text on a section'],
  [1, 7, 'body text on a card'],
  [1, 23, 'body text on the default page surface'],
  [1, 24, 'body text on the white page surface'],
  [1, 26, 'body text on the tinted page surface'],
  [17, 8, 'BUTTON LABEL on the primary button'],
  [17, 25, 'inverse text on the dark page surface'],
  [17, 19, 'inverse text on a dark accent'],
  [17, 21, 'DISCOUNT BADGE label on the sale background'],
  [22, 5, 'SALE PRICE on the page'],
  [22, 7, 'SALE PRICE on a card'],
  [22, 23, 'SALE PRICE on the default page surface'],
];

const NAMES = {
  1: 'txt-color1', 2: 'txt-color2', 3: 'txt-color3', 4: 'txt-color4', 17: 'txt-color5', 22: 'txt-color6',
  5: 'bg-color1', 6: 'bg-color2', 7: 'bg-color3', 8: 'bg-color4', 18: 'bg-color5', 19: 'bg-color6', 21: 'bg-color7',
  23: 'page-bg-color1', 24: 'page-bg-color2', 25: 'page-bg-color3', 26: 'page-bg-color4',
  9: 'border-color1', 10: 'border-color2', 11: 'border-color3', 12: 'border-color4', 20: 'border-color5',
  13: 'shadow-color1', 14: 'shadow-color2', 15: 'shadow-color3', 16: 'shadow-color4',
};

const ROLES = {
  1: 'Primary Text', 2: 'Secondary Text', 3: 'Muted Text', 4: 'Accent Text', 17: 'Inverse Text', 22: 'Sale Text',
  5: 'Main Background', 6: 'Section Background', 7: 'Card Background', 8: 'Accent Background',
  18: 'Light Accent Background', 19: 'Dark Accent Background', 21: 'Sale Background',
  23: 'Default Page Background', 24: 'White Page Background', 25: 'Dark Page Background', 26: 'Tinted Page Background',
  9: 'Light Border', 10: 'Medium Border', 11: 'Dark Border', 12: 'Accent Border', 20: 'Light Accent Border',
  13: 'Deep Shadow', 14: 'Medium Shadow', 15: 'Light Shadow', 16: 'Subtle Shadow',
};

const GROUPS = [[1, 2, 3, 4, 17, 22], [5, 6, 7, 8, 18, 19, 21], [23, 24, 25, 26], [9, 10, 11, 12, 20], [13, 14, 15, 16]];

/* ── cli ───────────────────────────────────────────────────────────────────
 * stdout carries the JSON alone so it can be redirected; everything human goes to stderr.
 */

const argv = process.argv.slice(2);
const arg = (n) => {
  const i = argv.indexOf(`--${n}`);
  return i === -1 ? null : argv[i + 1];
};

const seed = arg('seed');
const archetype = (arg('archetype') || '').toLowerCase();
const names = Object.keys(ARCHETYPES).join(', ');

const fail = (m) => {
  console.error(m);
  process.exitCode = 1;
};

if (!seed || !archetype) {
  fail('usage: palette.mjs --seed "#8B5E3C" --archetype <name>\n' +
       `       archetypes: ${names}`);
} else if (!hexToRgb(seed)) {
  fail(`not a hex colour: ${seed}`);
} else if (!ARCHETYPES[archetype]) {
  fail(`unknown archetype: ${archetype}\n       known: ${names}\n` +
       '       If references/archetypes.md lists one this script does not, add it to ARCHETYPES here.');
} else if (argv.includes('--dark')) {
  /* See "No dark storefront" at the foot of this file. Refusing loudly beats generating a
     palette whose discount badge is unreadable. */
  fail('--dark is not supported. The plugin\'s slot model is written for a light storefront:\n' +
       '       slot 17 "Inverse Text" is the label for BOTH the primary button AND the discount\n' +
       '       badge, and those only agree on a light theme. See the note at the foot of this file.');
} else {
  const { slots, meta } = buildPalette(seed, archetype);

  console.error(`\n${archetype} — ${meta.note}`);
  console.error(`seed ${seed} -> hue ${meta.hue.toFixed(0)}deg, brand chroma ${meta.brandChroma.toFixed(0)}\n`);

  for (const group of GROUPS) {
    for (const id of group) {
      console.error(`  ${String(id).padStart(2)}  ${NAMES[id].padEnd(14)} ${slots[id]}  ${ROLES[id]}`);
    }
    console.error('');
  }

  if (meta.notes.length) {
    console.error('Adjusted for legibility:');
    for (const n of meta.notes) console.error(`  . ${n}`);
    console.error('');
  }

  let failed = 0;
  for (const [fg, bg, what] of REQUIRED) {
    const r = ratioHex(slots[fg], slots[bg]);
    if (r < AA) {
      failed++;
      console.error(`  x ${r.toFixed(2)}:1  ${what}  (${NAMES[fg]} on ${NAMES[bg]})`);
    }
  }

  if (failed) {
    console.error(`\n${failed} required pair(s) still fail — do NOT use this palette.`);
    console.error('The solver could not reach AA, which means the archetype limits are too tight for');
    console.error('this seed. Report that rather than hand-editing the output.\n');
    process.exitCode = 1;
  } else {
    console.error(`All ${REQUIRED.length} required pairs pass AA. Verify independently with:`);
    console.error('  node palette.mjs ... > p.json && node contrast.mjs --palette p.json\n');
    console.log(JSON.stringify(slots, null, 2));
  }
}

/* ── No dark storefront, and why that is a decision rather than an omission ─
 *
 * A `--dark` flag was built and then removed, because it could not be made correct inside the
 * plugin's own slot model.
 *
 * Slot 17 is named "Inverse Text", and the shipped defaults use it as the label for TWO different
 * things: the primary button sitting on slot 8, and the discount badge sitting on slot 21 (five
 * defaults across plist1 cards, the product page, upsells, and the sale button preset). On a light
 * storefront both wear near-white, so one slot serves both.
 *
 * On a dark storefront they diverge. The page is dark, so the primary button must go LIGHT to read
 * as a button, which forces slot 17 dark. But the sale badge is still red, and dark-on-red is not
 * what a discount badge looks like anywhere. Every way out either desaturates the badge to pale
 * pink or leaves the button invisible against the page.
 *
 * The first implementation did not notice, and produced an accent walked all the way to pure white
 * still failing at 1.10:1. A dark mode is a genuine feature; it needs the plugin's slot semantics
 * revisited first — most likely a dedicated badge-label slot — not a flag bolted onto this script.
 * Until then this refuses `--dark` loudly rather than emitting something unreadable.
 */

/* ── Why not material-color-utilities ──────────────────────────────────────
 *
 * Material 3's own library was tried first and rejected on evidence, not preference:
 *
 *   1. v0.4.0 does not load under native Node ESM. Ten of its internal imports omit the `.js`
 *      extension, which only a bundler resolves — `import` fails outright. The workaround is a
 *      filesystem path into node_modules that steps around the package's own `exports` map, and
 *      that breaks whenever its file layout moves.
 *   2. The other two scripts in this folder need nothing installed, on purpose. A merchant should
 *      not have to run `npm install` to find out their prices are unreadable.
 *
 * What is actually needed here is a perceptual lightness axis with hue held constant — CIE L* in
 * LCh, which is public arithmetic and about a hundred lines. HCT's advantage over LCh is better
 * hue constancy, most visible in blues; the measured difference for storefront palettes is
 * recorded in the task file. That difference is also SELF-CORRECTING here, because every
 * contrast-critical slot is solved against a measured ratio rather than an assumed tone gap.
 *
 * Contrast with `codbrand-content-builder`, which DOES take dependencies: there the dependency is WordPress's
 * own save() implementation — the ground truth, impossible to reimplement. Here it is a colour
 * transform. Take a dependency when it is irreplaceable, not when it is merely convenient.
 */

#!/usr/bin/env node
/**
 * contrast.mjs — is this palette actually readable?
 *
 *   node contrast.mjs --palette blueprint.json     # reads decisions.palette.value
 *   node contrast.mjs --pairs '{"txt-color1":"#1F1F1F","bg-color1":"#F5F2EC"}'
 *
 * WCAG 2.x relative luminance and contrast ratio. No dependencies — this is arithmetic, and it must
 * stay runnable on a merchant's machine with nothing installed.
 *
 * WHY THIS EXISTS AS A SCRIPT: a model asked whether grey-on-beige "looks fine" will say yes. That
 * is precisely how an unreadable storefront ships. Legibility is measured, never judged.
 *
 * The pairs below are the ones the plugin actually renders together — derived from the roles in
 * references/palette.md, not from every possible combination.
 *
 * Exit 0 = every required pair passes. Exit 1 = at least one fails.
 */

const AA_NORMAL = 4.5;   // body text
const AA_LARGE  = 3.0;   // headings and large/bold text

/**
 * [foreground, background, threshold, level, what it is]
 *
 * `level` is the judgement this script exists to make, and it is not a softening of WCAG — it is
 * about what a FAILURE means for a storefront:
 *
 *   required — illegible here costs a sale. Body copy, the button label, the price. Hard fail.
 *   advisory — worth knowing, not worth blocking a build. Muted captions and meta, which are
 *              deliberately low-contrast in most designs and are never the thing a buyer must read.
 *
 * BORDERS ARE DELIBERATELY ABSENT. WCAG 1.4.11's 3:1 applies to UI components and graphics
 * REQUIRED TO UNDERSTAND THE CONTENT — not to a decorative card outline. The plugin's own shipped
 * border sits at 1.18:1 against the page, which is an ordinary subtle-border choice, and demanding
 * 3:1 would force a harsh outline onto every store. Measuring the wrong thing loudly is worse than
 * not measuring it.
 */
const PAIRS = [
  ['txt-color1', 'bg-color1', AA_NORMAL, 'required', 'body text on the page'],
  ['txt-color1', 'bg-color2', AA_NORMAL, 'required', 'body text on a section'],
  ['txt-color1', 'bg-color3', AA_NORMAL, 'required', 'body text on a card'],
  /* The page surfaces (palette category `page-bg-color`, 06-09-2026): the store's page background
     and the per-page override. Body copy lands on the light three; only inverse text on the dark. */
  ['txt-color1', 'page-bg-color1', AA_NORMAL, 'required', 'body text on the default page surface'],
  ['txt-color1', 'page-bg-color2', AA_NORMAL, 'required', 'body text on the white page surface'],
  ['txt-color1', 'page-bg-color4', AA_NORMAL, 'required', 'body text on the tinted page surface'],
  ['txt-color5', 'page-bg-color3', AA_NORMAL, 'required', 'inverse text on the dark page surface'],
  ['txt-color5', 'bg-color4', AA_NORMAL, 'required', 'BUTTON LABEL on the primary button'],
  ['txt-color5', 'bg-color6', AA_NORMAL, 'required', 'inverse text on a dark accent'],
  /* txt-color5 does double duty: it is the button label AND the discount-badge label. The badge
     pairing is shipped in five defaults — plist1 cards, the product page, upsells, the product
     badge, and the sale button preset — and an unreadable "-30%" is a lost sale on a COD store. */
  ['txt-color5', 'bg-color7', AA_NORMAL, 'required', 'DISCOUNT BADGE label on the sale background'],
  ['txt-color6', 'bg-color1', AA_NORMAL, 'required', 'SALE PRICE on the page'],
  ['txt-color6', 'bg-color3', AA_NORMAL, 'required', 'SALE PRICE on a card'],
  ['txt-color6', 'page-bg-color1', AA_NORMAL, 'required', 'SALE PRICE on the default page surface'],
  ['txt-color2', 'bg-color1', AA_NORMAL, 'advisory', 'secondary text on the page'],
  ['txt-color2', 'bg-color3', AA_NORMAL, 'advisory', 'secondary text on a card'],
  ['txt-color3', 'bg-color1', AA_LARGE,  'advisory', 'muted text — captions, meta'],
  ['txt-color4', 'bg-color1', AA_LARGE,  'advisory', 'accent text'],
];

const hexToRgb = (hex) => {
  const h = String(hex).trim().replace(/^#/, '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
};

/** WCAG relative luminance. */
const luminance = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (a, b) => {
  const [la, lb] = [luminance(a), luminance(b)];
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
};

/* ── input ─────────────────────────────────────────────────────────────── */

import { readFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? null : argv[i + 1];
};

/** Accepts either slot NAMES (txt-color1) or the numeric ids the API returns. */
const ID_TO_NAME = {
  1: 'txt-color1', 2: 'txt-color2', 3: 'txt-color3', 4: 'txt-color4', 17: 'txt-color5', 22: 'txt-color6',
  5: 'bg-color1', 6: 'bg-color2', 7: 'bg-color3', 8: 'bg-color4', 18: 'bg-color5', 19: 'bg-color6', 21: 'bg-color7',
  23: 'page-bg-color1', 24: 'page-bg-color2', 25: 'page-bg-color3', 26: 'page-bg-color4',
  9: 'border-color1', 10: 'border-color2', 11: 'border-color3', 12: 'border-color4', 20: 'border-color5',
  13: 'shadow-color1', 14: 'shadow-color2', 15: 'shadow-color3', 16: 'shadow-color4',
};

function loadPalette() {
  const inline = arg('pairs');
  if (inline) return JSON.parse(inline);

  const file = arg('palette');
  if (!file) {
    console.error('usage: contrast.mjs --palette <blueprint.json> | --pairs \'{"txt-color1":"#111", …}\'');
    process.exitCode = 1;
    return null;
  }

  const raw = JSON.parse(readFileSync(file, 'utf8'));
  const value = raw?.decisions?.palette?.value ?? raw?.palette ?? raw;

  /* Normalise numeric ids to slot names so either shape works. */
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[ID_TO_NAME[k] || k] = typeof v === 'string' ? v : v?.code ?? v?.hex;
  }
  return out;
}

/* ── run ───────────────────────────────────────────────────────────────── */

const palette = loadPalette();

if (palette) {
  let failed = 0;
  let warned = 0;
  let skipped = 0;

  console.log('\nContrast (WCAG 2.x)\n');

  for (const [fgName, bgName, min, level, what] of PAIRS) {
    const fg = hexToRgb(palette[fgName]);
    const bg = hexToRgb(palette[bgName]);

    if (!fg || !bg) {
      console.log(`  ?  ${what}`);
      console.log(`     missing or unparseable: ${!fg ? fgName : bgName}`);
      skipped++;
      continue;
    }

    const r = ratio(fg, bg);
    const ok = r >= min;
    const mark = ok ? '✓' : (level === 'required' ? '✗' : '!');
    if (!ok && level === 'required') failed++;
    if (!ok && level === 'advisory') warned++;
    console.log(`  ${mark}  ${r.toFixed(2)}:1  (needs ${min})  ${what}`);
    if (!ok) console.log(`     ${fgName} ${palette[fgName]} on ${bgName} ${palette[bgName]}`);
  }

  if (skipped) console.log(`\n  ${skipped} pair(s) skipped — those slots are not in the palette.`);

  if (warned) {
    console.log(`\n  ! ${warned} advisory pair(s) below target — muted / secondary text.`);
    console.log('    Not a blocker: these are deliberately low-contrast in most designs.');
    console.log('    Raise them only if that text carries something a buyer must read.');
  }

  if (failed) {
    console.error(`\n${failed} REQUIRED pair(s) FAIL. Do not ship this palette.`);
    console.error('These are body copy, the button label and the price — illegible here costs a sale.');
    console.error('Darken the text or lighten the background; do not "adjust until it looks ok".\n');
    process.exitCode = 1;
  } else {
    console.log('\nEvery required pair passes.\n');
  }
}

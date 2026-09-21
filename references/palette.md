# Palette, fonts and density

## The palette is 26 semantic SLOTS, not 26 free colours

Each slot has a job. Fill roles, not swatches — that is what stops a pretty palette producing an
unreadable price or an invisible border.

Read the live palette before deciding anything: `GET /design_controls/color_palette`. These are the
ids a stock install ships with, and their meanings:

| id | name | role |
|---|---|---|
| 1 | `txt-color1` | primary text — body copy, headings |
| 2 | `txt-color2` | secondary text — supporting lines |
| 3 | `txt-color3` | muted text — captions, meta |
| 4 | `txt-color4` | accent text |
| 17 | `txt-color5` | **inverse** text — on a dark background |
| 22 | `txt-color6` | sale text |
| 5 | `bg-color1` | main background of sections and components — the page surface itself is slot 23 |
| 6 | `bg-color2` | section background |
| 7 | `bg-color3` | card background |
| 8 | `bg-color4` | accent background — the primary button |
| 18 | `bg-color5` | light accent background |
| 19 | `bg-color6` | dark accent background |
| 21 | `bg-color7` | sale background |
| 23 | `page-bg-color1` | **default page surface** — the colour behind every page; the store default |
| 24 | `page-bg-color2` | white page surface — a single page's content area can switch to it |
| 25 | `page-bg-color3` | dark page surface — dark landing content areas (the chrome keeps slot 23); only inverse text sits on it |
| 26 | `page-bg-color4` | tinted page surface — a page's content area in a pale brand tint |
| 9–12 | `border-color1‑4` | light → medium → dark → accent border |
| 20 | `border-color5` | light accent border |
| 13–16 | `shadow-color1‑4` | deep → medium → light → subtle |

Every style value in the plugin references these as `var(--cl-{name})` — so `bg-color4` is not "a
colour", it is *the button*. Get the roles right and the store is coherent; get them merely pretty and
it is not.

**Ids 1–100 are reserved for system colours.** A brand colour you add gets an id above that.

**Slots 23–26 are a category of their own** (`page-bg-color`, added 06-09-2026). They are what the store's page background and a page's own background override list — and ONLY those two. A section, card or button background stays on `bg-color`; never reference a page surface from a component style.

## Deriving them

**Do not hand-pick 26 hex values.** Derive them all from one seed so they relate to each other:

```
node scripts/palette.mjs --seed "#8B5E3C" --archetype caregiver > palette.json
```

Hue is held constant while lightness moves along a perceptually-even axis (CIE L\* in LCh — the same
property Material 3 calls "tone"), and chroma is reduced wherever sRGB cannot actually show the
colour requested. Nothing to install: it is arithmetic.

**The contrast-critical slots are SOLVED, not chosen.** The sale price, the button label and the
discount badge each walk their tone until the *measured* WCAG ratio clears 4.5, then stop — so the
colour stays as close to the intended design as legibility permits. This is not theoretical: the
plugin's own shipped palette puts the sale price at **4.19:1** on a card background, under the 4.5 it
needs. That is invisible to the eye and obvious to a measurement.

**The seed sets hue; the archetype sets intensity.** A vivid seed under `ruler` is deliberately pulled
back to a restrained accent; a muted one under `magician` is pushed up. Temperature always follows the
merchant's own colour — never force "cool neutrals" onto a warm brand because an archetype table says
so.

**Where the seed comes from**, in priority order:

1. **Their existing brand** — read it off their logo or product photography and pass the hex. An
   existing brand outranks any archetype. Judging "the brand colour is this terracotta" is a job you
   do better than a quantizer, which returns the most *common* colour — often a background.
2. **The archetype's colour family** — see `archetypes.md`.

**Add an archetype in two places or not at all.** `archetypes.md` is what the merchant's answer is
matched against; the `ARCHETYPES` table in `palette.mjs` is how that answer becomes numbers. Adding one
here alone makes the script reject a name this skill just told you to use.

**There is no dark-storefront mode, deliberately.** Slot 17 is the label for *both* the primary button
and the discount badge, and those only agree on a light theme — on a dark page the button must go
light (forcing slot 17 dark) while the badge is still red. `--dark` is refused rather than emitting an
unreadable badge. A dark storefront needs the plugin's slot model revisited first.

## Then validate. With the script, never by eye.

```
node scripts/contrast.mjs --palette palette.json
```

`palette.mjs` self-checks before it will emit anything, but run this too — it is the independent
check, and it is the **only** check for a palette that was hand-edited, imported, or already live on
a store. It grades in two bands: **required** pairs (body copy, the button label, the price, the
discount badge) fail the run; **advisory** pairs (muted captions and meta) only warn, because those
are deliberately low-contrast in most designs.

## ⚠️ The trap that silently deletes your styling

The plugin runs a **StyleCleaner** on every admin settings save. It computes an allow-list from each
style key's declared brushes and **strips any CSS property not on it**. The stripped value is then
persisted.

So a style can look perfect when you write it and vanish the first time the merchant opens that
settings page and saves. Symptom: *"the styles disappeared after I saved."*

Properties commonly assumed and **not** allowed: `gap` (unless declared), `letter-spacing`,
`line-height`, `text-transform`, `text-decoration`, `cursor`, `transition`, `display`, `overflow`,
`opacity`, `scrollbar-width`.

**Stay on values the plugin already exposes** in a settings string — the cleaner deletes the rest.
Anything exotic now has a proper home rather than needing a plugin change: STORE-LEVEL CUSTOM CSS
(`PUT /stores/{id}/custom-code`, scope `stores_custom_code`) is hand-written, never passes through the
cleaner, and applies to every page of the store. That is where `gap`, `letter-spacing`, `line-height`,
`text-transform`, `text-decoration`, `cursor`, `transition`, `opacity` and `scrollbar-width` belong.
Ask the api for `GET /docs/custom_code_css_js` before writing any.

⚠️ `stores_custom_code` is a SEPARATE permission from `stores_write`, and `preflight.mjs` will not
catch a missing one — it probes read scopes only, by its own admission. A key that can restyle a store
may still get a 403 here. If it does, the merchant ticks `Custom code` on the Stores row of the key's
permission grid and saves; the key does not need reissuing.

## Fonts

**A fresh install ships two font rows**: `font1`, Inter, which is active and the default; and `font2`,
a system serif (Georgia), which is switched off. An install seeded by an older version may carry
different families in those two rows. Read what is actually there with
`GET /design_controls/font_manager`, and never assume a family is present.

⚠️ An earlier version of this page said "46 families ship — 17 Arabic, 29 Latin", which sent readers
hunting for an Arabic list that is not installed. The 46 are real but they are a **picker list in the
admin UI** (17 Arabic + 29 Latin), not rows in the font table. Anything you want, you add.

### How the font system works — and how little the default reaches

Every font row publishes a CSS variable named from its `name`: `--cl-font1`, `--cl-font101`, and so
on. `apply` adds a font as well as updating one, and adding never disturbs an existing row.

**The default font is compiled into a single rule, `:root, body { font-family: … }`, and almost no
storefront text uses it.** Nearly every piece of text is styled by a design preset, and presets set
their own font: 26 of the 35 shipped presets write `font-family: var(--cl-font1)`, and every button,
badge and icon-button preset, including any you create, has `font-family: var(--cl-font1)` in its base
styles. No setting changes that base. A preset's own declaration beats the inherited default, so a new
default reaches body text and little else.

⚠️ *An earlier version of this page said that marking a font `is_default` "is how you set the face for
the whole site". On a real store that was false. Measured 21-09-2026: a build made an Arabic font the
default and left `font1` as Inter, and every preset-styled button, badge and title stayed Inter until
the build edited all 26 presets by hand.*

**So put the brand's face INTO `font1`, rather than beside it.** `font1` is a system row, so it cannot
be deleted, but its family can be re-pointed like any other: `apply` with `"name": "font1"` and the
new family (the door's own field list says what else a Google font needs). Every preset that uses
`var(--cl-font1)` follows, and so does every button base. Keep `font1` the default as well, so `body`
agrees with the presets.

- **The body face goes in `font1`.** A second face, for headings or a price, is a new font that you
  reference by its variable, `font-family: var(--cl-font101)`, in the typography presets that should
  use it.
- **Fonts are global, like the palette.** On an install with more than one store, re-pointing `font1`
  restyles every store. There, add the new face as its own font, and give each preset you use its own
  copy with `font-family` in `css_default`, which beats the base.

Pick **two**: a heading face and a body face. Map from the archetype:

| archetype | heading | body |
|---|---|---|
| Caregiver | rounded humanist sans (Quicksand, Nunito) | plain humanist sans |
| Ruler | serif display (Playfair Display) | restrained sans (Inter, Lato) |
| Lover | elegant serif (Playfair Display, Merriweather) | light sans |
| Everyman | one sans throughout (Inter, Open Sans) | same, lighter weight |
| Sage | clean geometric sans (Montserrat, Inter) | same family |
| Magician | bold heavy sans (Poppins, Montserrat 700+) | plain sans |

**For an Arabic-script store, re-point `font1` to an Arabic family and keep it the default.** Tajawal,
Cairo, Amiri, Almarai, Noto Sans Arabic, Reem Kufi and El Messiri are all in the picker list. Neither
shipped font has Arabic glyphs, so skipping this leaves the browser substituting something arbitrary
for every button, badge and title on the site. Also remove the negative `letter-spacing` that two
shipped title presets carry (`-0.02em` and `-0.01em`): negative tracking pulls Arabic letters out of
their joins. Latin-script Darija uses a Latin family normally.

## Density

One decision, applied consistently: **airy** (Caregiver, Ruler, Lover) · **structured** (Sage) ·
**denser** (Everyman) · **punchy** (Magician).

It drives container padding, card padding, gaps and the radius scale. Keep it consistent — an airy
palette on dense spacing reads as a mistake rather than a choice.

## Icon style

Also archetype-driven, also one decision: **line** icons for Caregiver / Sage / Ruler, **solid** for
Magician / Everyman, **fine line** for Lover. Read what is available at
`GET /design_controls/icons_manager` before assuming a set exists.

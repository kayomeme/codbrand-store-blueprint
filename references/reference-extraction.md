# Measuring a reference site — and measuring what you built

Read this when the merchant hands you an example site and says *"make mine look like this"*.

A reference site is a **specification**, not a mood board. Treated as a mood board it produces a store
that is "in the spirit of" the reference and wrong in every particular, and the merchant finds each
particular for you, one message at a time.

## This document is executed TWICE, at TWO widths

That is the whole design. The same checklist, run against two different pages:

| pass | when | output |
|---|---|---|
| **1 — reference** | before you configure anything | `reference-1440.json` · `reference-390.json` |
| **2 — live** | after the build, before you say it is done | `live-1440.json` · `live-390.json` |

`scripts/match.mjs` then diffs the two. **A checklist applied to only one side cannot diff anything** —
if you extract the reference and never measure what you built, you have a nicely-documented wish.

**Both passes run at 1440×900 AND at 390×844, one spec file per width**, and `match.mjs` runs once per
width: `--reference reference-1440.json --live live-1440.json`, then the same for 390. It refuses to
compare specs taken at different widths, so the two cannot be mixed by accident. Every dimensional row
is a function of the width it was measured at, and a COD store's customers are mostly on a phone.

*Measured 21-09-2026: a build matched at 1440 only. Both defects the merchant then reported on a phone
— a footer band flush against its text, a product grid with crushed buttons — sat outside anything
the match had measured.*

Measuring the reference first is not optional either: decide the palette, fonts and layout *from*
measured values, not from an impression you then hope the measurement confirms.

## Before you measure ANYTHING: clear the page, and know which document you are in

Both of these were learned by driving this file against three real stores and one built one
(18-09-2026). Neither was written down, and each silently corrupted a whole pass.

### 1. Dismiss what sits between you and the page — then LOOK

A consent banner or an email-capture modal is not part of the design you are measuring, and its
dimmed backdrop is a **full-width opaque element**, so a background sampler reports it as the page
colour. On greats.com that returned **black on a white site**, and every colour row with it.

Remove fixed/absolute elements with a high `z-index` that cover a large part of the viewport, then
**take a screenshot and look at it**.

⚠️ **That dismissal can destroy the thing you are measuring.** The same heuristic, run on a store
built with this plugin, removed the plugin's own header and footer — after which the measurement
reported one nav link (the cart badge) and a default-blue footer. **A dismissal step without an
after-screenshot is not safe.** This is rule 4 below, and it is the rule most likely to be skipped
because everything appears to work without it.

### 2. Pass 2 is a DIFFERENT KIND OF DOCUMENT, and the anchors must change

The checklist is anchored on semantics — `<header>`, `<footer>`, `[role="banner"]`. That is correct
on a reference site. **It is wrong on a store built with this plugin**, because the plugin renders its
own chrome into its own containers, inside or beside the theme's shell. The theme's `<header>` is a
document shell that renders nothing of its own.

| pass | resolve a surface as |
|---|---|
| **1 — the reference** | the semantic tag: `header, [role="banner"]` · `footer, [role="contentinfo"]` |
| **2 — what you built** | **the plugin's container FIRST** — `.cl-topbar-container` · `.cl-header-container` · `.cl-footer-container` — falling back to the semantic tag |

Same checklist, same ids, same traversals. Only the element lookup differs, and if it does not, the
two passes measure different things and **the match returns a number that means nothing** — which is
worse than not running it.

### 3. Make the measurer refuse a pair that could not render

Rule 2 below says record colour as a pair. Enforce it *at measurement time*: if a text/background
pair's contrast is at or below **1.5**, return `null` for **both** rather than writing the pair into
the spec. A surface no one could read is not a low-contrast design — it is proof one of the two was
sampled off the wrong element. On thursdayboots.com it was white-on-white, because the header is
transparent over a hero **image**, so its backdrop is not a colour at all.

`null` is honest and it costs nothing: an `unmeasurable` row never counts as a match.

## When the input is a NICHE, this runs FOUR times per width, not twice

A merchant who names a site gives you one reference. A merchant who names only a niche used to give
you nothing measurable at all — an archetype produced adjectives, adjectives cannot fail a check, and
so a niche build had no match phase and nothing it produced could be verified against anything.

**So a niche build gets references too: the three best stores in that niche.** Measure each one with
this same checklist, then measure what you built. Four specs at each width — the diagram below is one
width; run it again at the other:

```
reference-a.json   reference-b.json   reference-c.json        live-spec.json
        \________________ the band ________________/                  |
                              |                                       |
   node scripts/match.mjs --reference reference-a.json \
                          --reference reference-b.json \
                          --reference reference-c.json --live live-spec.json
```

`match.mjs` folds the three itself — you do not merge them by hand:

| the three references | becomes |
|---|---|
| all agree | an exact target, identical to the single-reference case |
| differ, all numeric | a **band**, `min..max` inclusive |
| differ otherwise | the **set** of values any of them shipped |
| present in only some of them | **dropped and named** — no band can be derived from a partial sample, and that the exemplars disagree structurally is itself worth reporting |

**A band, never an average.** Three good stores in a niche do not agree on a number; they occupy a
range. Averaging invents a fourth store that none of them is, and then reports a build that looks
exactly like one of the three as a mismatch. A row inside the band is a row a real store in that
niche actually shipped.

⚠️ **Measure all three at the SAME viewport, once per width.** Every dimensional row is a function of
the width it was measured at, so a band built from mixed widths is noise — `match.mjs` refuses it
outright, the same way it refuses a reference and a live store measured at different widths.

⚠️ **Style only, never content.** Measure colour, type, spacing and structure. Never lift copy,
photography or a brand mark from any of the three. This is the standing rule from the first build
this skill was used on — *"design + structure like <site> · do NOT use their content or images"*.

**Record which three you picked, and why, in the blueprint.** A later session re-running the match
needs the same three, or the band moves underneath it and the comparison means nothing.

## ⚠️ You need a browser, and you must say so if you do not have one

Most of this is **computed style on a rendered page** — the cascade resolved, not the HTML source. A
bare-node script cannot do it. `scripts/preflight.mjs` checks for the capability and says so before
any work starts, the same way it checks for `codbrand-content-builder`.

**Without a browser, degrade explicitly — never silently:**

- Measure what static HTML gives you: item counts, column order, link labels, presence/absence.
- Mark every computed-style row `"unmeasurable"`, and write `"measured_with": "none"` on the spec —
  `match.mjs` then treats every computed-style row as unmeasurable even where you slipped.
- **An `unmeasurable` row NEVER counts as a match.** It is reported, and the merchant is told which
  parts of their reference you could not check. A gate that passes because it could not look is worse
  than no gate — it converts "I don't know" into "it matches".
- **A value you SET is not a value you MEASURED.** Sizes are computed style too, not only colours:
  `header.height`, `logo_width` and every gutter. Your own setting records what you asked for, and a
  layout or a card design can override it on the page. Without a browser, mark those rows
  `unmeasurable` as well, **even when a setting states the exact number**. Those are the rows most
  likely to be wrong. `match.mjs` now enforces it: a spec with `"measured_with": "none"` has every
  such row treated as unmeasurable, whatever you wrote in it — see "The spec shape".

  *Measured 21-09-2026: a build with no browser marked the topbar and footer heights `unmeasurable`,
  but filled `header.height` from its own `height:221px` setting. `match.mjs` counted 221 → 221 as a
  match. On the page the header was about 103px tall, because the `stacked` layout ignores height.*

## The four measurement rules

These exist because each one has already produced a wrong build.

### 1. Sample the element that actually PAINTS — and the traversal differs per property

Writing one universal rule is itself a bug. Applied to text colour, "walk up" lands on a container.

| property class | traversal |
|---|---|
| **background** / the painted band | walk **UP** from the visible content to the first ancestor whose `backgroundColor` is not transparent |
| **colour, size, weight, case, letter-spacing** | sample the **deepest element that contains the visible text** |
| **counts, order, structure** | count rendered nodes, after the page has settled |

> **Real failure.** A topbar was recorded as *white with dark text*. It is **black with white text**.
> The background had been read off a transparent wrapper several levels above the painted bar, whose
> own computed `backgroundColor` was `rgba(0,0,0,0)`. Four rounds of corrections followed from that
> one wrong sample.

### 2. Record colour as a PAIR, never alone

For every surface, capture text colour **and** its background together, linked with `pair_with` in the
spec. `match.mjs` hard-fails a pair that cannot be real.

This is the only rule that catches rule 1 being broken. A value diff cannot: if you sample the wrong
element on **both** the reference and your build, the two agree and the gate passes with the store
still wrong. But *white text on a measured-white background* is impossible for a surface anyone can
read — so it is proof the background came off the wrong element, and it is detectable **without a
reference at all**.

### 3. Chase a contradiction; never explain it away

If one measurement disagrees with another, the disagreement is the finding. Stop and resolve it.

> **Real failure.** The correct evidence — `color: rgb(255,255,255)` on the topbar text — had already
> been observed, and was dismissed as "a hidden duplicate element" because it contradicted a
> background value read off the wrong node. The wrong measurement was protected and the right one
> discarded.

### 4. Confirm every visual claim with a screenshot

Computed style tells you what one node says. It cannot tell you the bar looks wrong. Take the
screenshot and look at it — especially before writing "matches".

## What to measure — and the `id` for each row

⚠️ **Use these `id` strings exactly.** `match.mjs` diffs the two passes **by `id`**, so an id you
invent on pass 1 and phrase differently on pass 2 (`footer.columns` vs `footer.column_count`) is
reported as *"not measured on the live store"* — a naming slip that surfaces as a build failure and
sends you looking in the wrong place. Two passes done hours apart WILL drift unless the names are
fixed here.

Skip a row only if the reference genuinely has no such surface, and record that as `"value": null`
rather than omitting it — **omitting is how "you built a footer column the reference does not have"
escapes**, because a row present only in your build is reported and not failed.

| id | notes |
|---|---|
| `topbar.present` · `topbar.height` | |
| `topbar.background` · `topbar.text_color` | **pair** them |
| `topbar.font_size` · `topbar.font_weight` · `topbar.text_transform` · `topbar.text_align` | |
| `topbar.message_count` · `topbar.message_is_link` · `topbar.arrows` | |
| `header.height` · `header.background` · `header.border_bottom` · `header.gutter_left` | |
| `header.logo_present` · `header.logo_kind` · `header.logo_width` | `logo_kind`: `image` or `wordmark` |
| `header.nav_items` · `header.nav_labels` | `nav_labels` is an ordered array |
| `header.nav_font_size` · `header.nav_font_weight` · `header.nav_text_transform` · `header.nav_color` | pair `nav_color` with `header.background` |
| `header.trailing_icons` · `header.sticky` | `trailing_icons` is an ordered array |
| `footer.background` · `footer.text_color` | **pair** them |
| `footer.height` · `footer.columns` · `footer.column_headings` · `footer.links_per_column` | headings ordered; links per column an array of counts |
| `footer.brand_block` · `footer.social_icons` | |
| `footer.bottom_bar` · `footer.bottom_bar_links` | |
| `footer.gutter_left` · `footer.bottom_bar_gutter_left` | **these two should agree.** A mismatch is a real defect and very easy to miss by eye |
| `page.background` · `page.max_width` · `page.gutter` | |

**This list is the chrome only, and the gate is only as wide as what you write into the spec.** The
product grid, the product page, the cart and the menus are not in it — nothing stops you adding rows
for them (`plist1.card_ratio`, `plist1.columns`), and on a reference whose product cards are the
point, you should. Exit 0 means *the rows you wrote agree*, never *the store matches*.

## The spec shape

One file per pass and per width, identical shape, so `match.mjs` can diff them positionally by `id`.

```jsonc
{
  "source": "https://example.com/",       // or the built store's URL on pass 2
  "captured_at": "2026-09-06",
  "viewport": { "width": 1440, "height": 900 },   // or 390 × 844 — one file per width
  "measured_with": "browser",             // REQUIRED: "browser" or "none"
  "properties": [
    { "id": "topbar.height",     "value": 36,                 "unit": "px", "tolerance": 4 },
    { "id": "topbar.background", "value": "rgb(0,0,0)",       "traversal": "paint-up" },
    { "id": "topbar.text_color", "value": "rgb(255,255,255)", "traversal": "text-down",
      "pair_with": "topbar.background" },
    { "id": "header.nav_items",  "value": 2 },
    { "id": "topbar.arrows",     "value": true,
      "reason": { "kind": "not_expressible",
                  "evidence": "settings_schema for type topbar lists 41 keys, none matching arrow/manual/control" } }
  ]
}
```

- **`measured_with`** is REQUIRED on every spec, reference and live alike, and `match.mjs` refuses a
  spec without it. `"browser"` means every value was read off a rendered page. `"none"` means there
  was no browser, and then every row that needs a rendered page is treated exactly like
  `unmeasurable` — reported, never passed — whatever number you wrote into it. Only **static** rows
  can match without a browser: presence (a boolean), an ordered list (labels, icons, links per
  column), and a count or a kind (an id ending in `present`, `count`, `items`, `columns`, `links` or
  `kind`). Everything else is computed style — sizes, gutters, padding, colours, font sizes and
  weights, transforms, alignment, borders, radii, ratios — and so is any row with a `unit`, a
  `traversal`, a `pair_with` or a colour value. Write the field honestly: it is the only thing that
  tells a number copied out of a setting from a number measured on the page.
- **`tolerance`** is numeric and optional; without one, values must be equal. Put it on properties
  where exactness is meaningless (a 2px height difference), never on ones where it hides a defect.
- **`traversal`** records HOW you measured, so the second pass repeats it. `match.mjs` refuses to
  compare two rows measured differently — that comparison is meaningless.
- **`pair_with`** links a colour to its background. See rule 2.
- **`reason`** is the ONLY way a non-matching row passes. See below.

## Reasons — the gate is not a comment box

A row that does not match passes **only** with a `reason`, and only these kinds, each carrying
machine-checkable evidence:

| kind | what it means | evidence required |
|---|---|---|
| `not_expressible` | the plugin has no way to do this | must name **`settings_schema`** and what you searched it for |
| `needs_a_preset` | reachable, but through a shared preset, not this design's settings | must name **`settings_schema`** (absent there) and the property class |
| `within_tolerance` | numerically close enough | checked against the row's own `tolerance` — not asserted |
| `merchant_override` | the merchant asked for something different | must cite the decision, e.g. **`decisions.palette`** |
| `unmeasurable` | no browser; could not read it | **does not pass** — reported only, on either spec, even when both sides say it |

**Free text alone fails**, and `match.mjs` enforces it: evidence under 20 characters is rejected, and
evidence that never mentions the anchor above is rejected — nothing in it shows you looked.

> ⚠️ **You cannot cite an absent key by name, because it has no name.** Cite the schema you read and
> the search that came back empty: *"settings_schema for design type `topbar` lists 41 keys, none
> matching arrow / manual / control"*. That is a claim someone can re-run. "The plugin can't do
> arrows" is not.

Be clear about what this check buys: it proves you consulted the right source. It cannot prove you
read it correctly — no string check can. It exists because the bar before it was "any eight
characters", which let *"looked at it and it seemed fine to me honestly"* through as
`not_expressible`. The agent being gated is the one writing the reason, and "explained it away" is
precisely how the worst defect in this skill's history survived. A sentence you wrote about your own
work is not evidence.

## Capability — ask the install, do not carry a list

Whether a property is expressible is decided by **reading the live install**, never by a list in this
file. A hardcoded list of what the plugin can do rots the first time the plugin ships a change, and
this skill runs on machines nobody can hot-fix.

- `expressible` — the key exists in `settings_schema` for that design type.
- `needs_a_preset` — no key, and the property is colour / type / shape → it lives in a shared preset.
- `not_expressible` — neither.

Read the schema from `GET section_manager/global_settings/{type}/{id}`; it ships beside `settings` on
every read.

**Say what you cannot do BEFORE you build, not after.** A merchant who is told up front that their
reference's animated announcement carousel is not reproducible will accept it. The same sentence
after the build reads as an excuse.

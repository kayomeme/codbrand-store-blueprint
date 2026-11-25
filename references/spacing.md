# Spacing — one model, nine laws, one check

Every space in the store comes from this file: the words, the steps, how to write them, and the nine laws a live
page is checked against. `palette.md`, `order-of-work.md`, `blueprint-format.md` and `check-store.md` point here.
A spacing fault is never fixed with a rule of its own: it is a law broken, and the check names which.

## The words

| Word | Means |
|---|---|
| **inset** | space inside a visible box, from its painted edge to its content |
| **stack** | vertical space between two things |
| **inline** | horizontal space between two things |
| **edge** | the page's side space: the window's edge to the content |
| **ruler** | a vertical line content starts on — the edge ruler (where the header's content starts) and its mirror at the end, plus a reading column the blueprint records |
| **ink** | what the eye sees: a line of text (its line box), a photo or icon, a painted box. Space is measured between inks, never between element boxes: a link's padding is no ink, so the space it adds is space |

## The steps are the store's Spacing designs

A store's spacing steps are its **Spacing designs** (a design preset type): each one value on computers and one on
phones. Phones are screens narrower than 768px — the plugin has one breakpoint, so 768 and 1024 use the computer
value. Read them before deciding anything: `GET design_controls/presets?type=spacing`, every page
(`api-recipes.md` → "A list answers 20 rows"); what they are and how a design uses them:
`/docs/settings_vs_presets` → "Spacing presets hold a space, not a class". A fresh install ships these:

| What it spaces (`category`) | Shipped, computer / phone |
|---|---|
| side by side (`between_horizontal`) | Small 8 / 8 · Item 16 / 12 · Group 24 / 20 · Grid 32 / 24 |
| one under the other (`between_vertical`) | Small 8 / 8 · Item 16 / 12 · Group 24 / 20 · Grid 32 / 24 |
| above a block (`space_above`) | Above block 32 / 24 · Above section 64 / 48 |
| below a block, only where nothing follows (`space_below`) | Below block 32 / 24 · Below section 64 / 48 |
| the page's sides (`page_edge`) | Edge 48 / 16 |
| inside a part that has its own picker (`inside`) | 8 · 12 · 16 |

What has no picker follows the same scale by role: **tight 4** (label → value, title → its subline, icon → text);
controls inside **12 × 16** (buttons, fields), badges **4 × 8**, counts **2 × 6**, selectable chips **4 × 8**;
selectable option boxes 16 inside on computers, 12 on phones. Every value is on a **4px scale** (0, 2, 4, 6, 8, 12,
16, 20, 24, 32, 40, 48, 56, 64, 80, 96).

## How a store picks its steps

From the reference first (phase 2 measures it at 1440 and 390: the space between cards, between a heading and its
items, between sections, the page edge), else from the archetype's density:

| density | Item — between blocks of one section | Above section | Edge | archetypes |
|---|---|---|---|---|
| airy | 24 / 20 | 96 / 64 | 64 / 20 | Caregiver, Ruler, Lover |
| structured | 16 / 12 | 64 / 48 | 48 / 16 | Sage — the shipped steps |
| denser | 12 / 12 | 48 / 32 | 32 / 16 | Everyman |
| punchy | 16 / 12 | 56 / 40 | 40 / 16 | Magician |

Edit both Item designs (side by side, one under the other) with the same values, and keep Group a step above Item
(airy: 32 / 24) — a heading sits further from its items than they sit from each other (L3). Phone values: a value equal
to a shipped step takes that step's phone value; any other above 20px takes `max(20, the step nearest 0.7 ×)`. Keep one density across the store: an airy palette on dense
spacing reads as a mistake. Record the choice in the blueprint's `spacing` (`blueprint-format.md`): which designs you
changed, from what, to what, and why.

## How to write them

- **Density is the shipped Spacing designs, edited** — `PATCH design_controls/presets/{id}` with the computer and
  phone value. Editing one re-saves every design that uses it, phones included: one write per step, never key by key.
- **A place's space is its `*_space_preset` key**, pointing at a design of that key's category (another category is
  refused; `0` is no space at all). Each design's doc page lists its space keys (`/docs/{type}_global_settings`).
- **Never a px in a `_style` key for a space** — the property left those keys and a write of it is refused (422),
  naming the key to use. **Never `clamp()`** for a space: a plugin update turns a `clamp()` into the default step.
- **Your own Spacing design only for a deliberate exception** ("Hero above 120 / 64" for one section), made in the
  category it spaces. A loose value above 20px gets its phone value as `max(20, the step nearest 0.7 × computer)`;
  20px or less is the same on phones.
- No `spacing` type on the presets door: the plugin is older than this skill — stop and say so.

## The nine laws

Each law holds for every visible thing on every page, in both directions, at every width. None names a component.

| Law | Rule | Measured as |
|---|---|---|
| **L1 Never touch** | Two neighbours are never closer than tight (4px), side by side or one under the other, and never overlap. Text keeps a Small step (8px) from a line another block draws, tight from its own box's line; a line separates two things, so two lines with nothing between them are one too many. Allowed joins: a field and its button drawn as one control, a stepper, a segmented control or tab row, table rows sharing a border, a photo full-bleed in its own card | the gap between two inks where they face; a line's distance to the text either side |
| **L2 A box is a box only if it is seen** | A container draws a border, a shadow, or a background at least **T** (1.15 : 1) against what is behind it. A box below T with neither is no container: its content sits on the ruler of what stands beside it, and any inset it keeps is a misalignment. A seen box keeps all its content on one inner edge, at least tight from its sides; a photo is an edge too (8px to the text beside or under it); a control is wider inside than tall | contrast of the box's background with what is behind it; painted edge → content |
| **L3 Proximity** (internal ≤ external) | A group's items are no further apart than its heading is from them; a heading is nearer what it labels than what came before; a box's inset is no larger than the space between it and its siblings | the gaps inside a group compared with each other |
| **L4 Same job, same spacing** | Siblings of one kind keep one gap (±1px); columns side by side, each a heading and its items, keep one item gap; collapsibles in one stack share one look; a control keeps its size when hovered, focused, selected or disabled | gaps of repeated siblings; states forced |
| **L5 Rulers** | Every block starts on a ruler, or one inset inside a seen box (±2px). The header, the trail, the page title and the footer start on the edge ruler, at the page edge; the blocks of one column start on one edge. A part aligned to the end is checked by its end, a centred one by its centre. Directions are logical: in a right-to-left store the start is the right | start, end and centre edges of the inks |
| **L6 Scale only** | Every gap and inset is one of the store's steps at that width (±0.5px), or tight inside one part, or 2 / 6 inside a control. A finding names the nearest step | every gap of L1–L5 |
| **L7 Build rule** | Space is set on the parent (padding and a gap, a design's space key), one gap per container; children carry no margins. Body text keeps a readable line: at most 80 characters (WCAG 1.4.8; Material asks 40–60), or the blueprint's `line_length` | unequal gaps in one container (L4); characters per line |
| **L8 Overlays** | A badge, a label or a control drawn over a photo or a box keeps one distance from the edges it is anchored to — the same for every overlay of that kind — and never touches another overlay | the overlay's position against its host's edges |
| **L9 Fixed and floating** | A floating button or bar sits on the page edge from the window's side, never covers another floating thing, and at the end of the page covers no content: the page leaves room for it | distance to the window; what lies under it at the page end |

Scroll containers (sliders, swipe rows): neighbours are measured inside the scroller; a slide the edge cuts (a
peek) is allowed; what the scroller hides is no ink. An open overlay (a drawer, a quick view, a pop-up) is judged
alone, the one on top when two are open. Tap targets stay their own check (44px on a phone), and a tap-target fix
counts only when the laws pass at every width in the same run.

| Pattern | Laws |
|---|---|
| grids and lists of cards, upsells, reviews | L1, L3, L4, L6 (a card is a box only when seen, L2) |
| a photo and text side by side (horizontal cards, a summary beside a list) | L1, L3 |
| sliders and swipe rows | L1, L4, L5, and the scroll-container rule |
| badges, labels and controls over a photo | L8 |
| floating buttons and bars | L9 |
| drawers, quick views, pop-ups | L2 (the panel is a box), L1–L6 inside, judged alone |
| collapsibles | L4, L1 — measured open and closed |
| tables, forms, inline clusters (price + saving, stars + count, chips) | L1 (both axes once they wrap), L2, L4, L5, L6 |
| alignment choices (start / centre / end) | L5 |
| bands (topbar, header, footer, coloured sections) | L2, content on the edge ruler (L5) |
| page content from the content builder | every law |

## The check

**`scripts/live-check.mjs`** measures every page the store shows at 390, 768, 1024 and 1440, the way a shopper
sees it (a phone's user agent and touch below 768: the store prints other HTML for phones, and rules for touch
screens apply only there), with collapsibles open and closed, each overlay open and hover / focus forced, and saves
each result and its annotated strips. It reads the store's Spacing designs and the blueprint's `spacing` itself.
Open **every strip** it writes: the boxes, gaps and rulers are drawn on the page, findings in red.

**`scripts/joins.js` by hand**, when the runner cannot open the store (a host's bot check): paste it into the page
with `window.CL_SPACING = { designs: [...the store's Spacing designs as { id, title, category, computer, phone }], T,
line_length }` set first. At an exact width, measure inside a same-origin `<iframe>` of that width: give the frame
`max-width: none` (a theme's `iframe { max-width: 100% }` clamps it), and at 768 and under put
`html { scrollbar-width: none }` in the frame (phones and tablets have overlay scrollbars); read back `innerWidth` and
`documentElement.clientWidth` before trusting the run. The result says when the run was not a phone browser or not a
touch screen: a phone measured that way is not proof.

A finding carries its law, its rule, the two inks, what was measured and what was expected, the step, and the design
it belongs to (`cl-design`). **A finding stays only with an id**: `{ "check", "where", "ledger": "<id>" }` for a known
limit of this plugin version (`handover.mjs` names the ones that match), or `{ "check", "where", "decision": "<id>" }`
for a decision the merchant took, recorded in the blueprint's `spacing.decisions`. A written reason is refused. A
finding you are sure is wrong is a fault of the check: say so in your report, with the finding, and do not accept it.

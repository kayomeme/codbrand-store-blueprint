# The order of work — every phase in full

`SKILL.md` keeps one line per phase and the five hard orderings; this file is each phase in full, and the phase 10
browser pass. Moved here verbatim from `SKILL.md` (14-11-2026) to keep that file inside its budget.

## The phases

Five of these orderings are hard constraints, not preferences. Each one has bitten a real build.

| # | Phase | |
|---|---|---|
| 0 | **Read the store** | `GET /me` — including the **theme**, see `SKILL.md` → "Check the theme", and **`discourage_search_engines`** — then products, categories, designs, palette, fonts, every page of each list (`api-recipes.md` → "A list answers 20 rows"). This decides *fresh* vs *established* — see `SKILL.md` → "How much you may change". **If `discourage_search_engines` is `yes`, tell the merchant now, in plain words:** "your site is hidden from Google and other search engines; nothing looks broken, but a launched store gets no search traffic while this is on. Turn it off at launch: CodBrand > Store > Store Visibility." If `/me` has no such field (an older plugin), the state is unknown: say so, do not call its door, and never say the site is visible. |
| 1 | **Facts** | Only what they alone know. See `SKILL.md` → "Asking". **Confirm the seller's country and the customer's market** — preflight already has them; this is where you say them back and let the merchant correct you. **Then show the FEATURE CHECKLIST** and let them correct that too. `references/archetypes.md` → "The checklist". |
| 2 | **Reference** | **ALWAYS.** If they named a site to look like, measure it at 1440×900 **and** at 390×844, one spec per width. **If they named only a NICHE, find the three best stores in that niche and measure all three** — they become a band, not an average. A reference is a specification, not a mood board, and one treated as a mood board produces a store that is wrong in every particular. Say up front which parts of it this plugin cannot do. `references/reference-extraction.md` |
| 3 | **Direction** | Resolve an archetype, propose it in plain words, let them choose. The archetype also decides **which plugin features this store gets** — it sets which boxes start TICKED on the feature checklist you show them. You decide the ticks; they correct them. `references/archetypes.md` |
| 4 | **Foundation** | `store_settings` FIRST — reading direction, site title, page width, **the time zone of the customers** (ask when their country has several; every sale end and countdown runs on it) — then **`POST stores/ensure_pages`**, then palette, fonts and presets: colour, type and shape live in presets, and a `*_style` loses to the preset on the same element (`api-recipes.md` → "Things that fail quietly"). **Then the spacing**: the store's steps are its Spacing designs — edit them to the density or the reference, and record the choice in the blueprint's `spacing` (`references/spacing.md`). That one call is what makes the funnel reachable; without it a store takes orders and never confirms them. `references/palette.md`, and `api-recipes.md` → "`store_settings`" + "The funnel pages". |
| 5 | **Settings** | Every design, all copy in their language, and the logo. **Before writing a design, read `GET /docs/{type}_global_settings`** — its traps live there, not in its settings. **The topbar, header and footer are the only designs on EVERY page — the highest-leverage in the store, and none of the three may ship at its default.** The topbar is the one most often left untouched; the footer now ships **hollow**, so leaving it alone renders empty space rather than anything obviously broken. **Order tracking and My account are funnel designs too**: their titles, fields and buttons take the checkout's presets. **Also rewrite the seeded English promo copy** — the store ships promising "$50 free delivery" and a "30-day refund" nobody agreed to. Decide the words here; a custom block's content is markup, made in phase 7 by `codbrand-content-builder` like a page. **And apply the feature checklist**: every feature they left ticked ON, every unticked one OFF; 5b seeds the rows the ticked ones need. A merchant told a feature is off must not find it on the store — `archetypes.md` → "What switches each feature". **Style each surface with its neighbours, never alone** — what sits above, below and beside it, on every page and at every width: every space a `*_space_preset` pointing at a step, never a px in a `_style`, and the nine laws of `references/spacing.md` (L1–L5: nothing touches, a box is a box only if it is seen, a heading nearer its items, one gap for one kind, one edge for one column). Write the choice in the design's `why`. *Measured on one build: header, trail and title at 72, 48 and 64px from the edge, the trail 2px under the header's line, a footer reusing the header bar's preset with its text 1px under the paint — every design right alone.* The live check finds each (L5, L1). `api-recipes.md` |
| 5b | **Catalogue** | **10 products, 4 categories and their REVIEWS.** When they sell from a supplier or another store, import those products with `codbrand-tools` (its rules on price, copy and photos apply); otherwise build them yourself. Reviews go on live and approved: a product page with no reviews does not show the design you built, and seeing it is the point. They are placeholder like everything else — name them in the replace-list at handover so nobody ships them as real. An empty store shows nothing, and a merchant cannot judge a design with no products in it. Invent them for the niche; when they named a reference site, take its SHAPES — categories, price bands, typical titles — and build comparable ones. **Prices come from the reference when there is one**, and otherwise from what that niche sells for in that MARKET — not from a guess and not from converting another country's prices. A bedding store in Morocco priced in European money reads as a scam to the only people who will see it, and a COD shopper deciding whether to open the door is exactly who notices. **Every category carries all five of its fields** — `name`, `slug`, `description`, `parent_slug`, `img_id`; the description and the image are the two that get skipped and they are not optional. Assign every product to a real category. |
| 6 | **Pages** | Which pages this niche needs, **and which its market requires**. Legal pages are BUILT BY DEFAULT from `--country` + `--market`; the merchant may decline them. Draft them clearly marked unverified, say what you do not know, and **never claim compliance**. `references/pages.md` |
| 7 | **Content** | Hand each page's structure — home included — and each custom block's to `codbrand-content-builder`; publish what it returns. Place a custom block with render mode `immediate`, and apply any CSS or JS it hands over at the level it names (`api-recipes.md` → "Custom blocks are content"). Source and upload the images first, so it has real assets to place. **Generate the PRODUCT GRID, photograph everything else.** The ten tiles must share one ratio, one style and one long-edge size, which generation gives you and free stock does not — a photographer shot each of those at whatever ratio suited them. Heroes, lifestyle shots and category images are the reverse: a real photograph reads as a real shop, and none of them sits in a grid where mismatch shows. Take those from a free source, or from the site the merchant gave you. **Every product photo at ONE aspect ratio, ONE format and ONE long-edge size, matched to the listing's image box** — mixing ratios is the most visible defect a build can ship, and no status code reveals it. **Every product carries a featured image AND at least 2 gallery images.** `handover.mjs` now fails the build on all of it, so decide the three values before you generate anything rather than discovering the drift afterwards. **Publish each page's WIDTH too** — a banded, full-bleed page needs `PATCH pages/{id}/plugin {"width_mode":"none"}`, because nothing else sets it and the inherited default insets every band. `references/pages.md`, `api-recipes.md` → "A page's width" |
| 7b | **SEO** | A search title and a one-sentence description for every page you built and every product, in the store's language, through each one's own SEO door — otherwise the description is the page's own text cut off at 300 characters, mid-sentence. Leave `noindex` alone. Check the store's `country_code` is set: without it product pages give search engines no price. `api-recipes.md` → "Search titles and descriptions" |
| 8 | **Wire up** | Menus, footer nav, and **the front page — `is_front_page: "yes"` on the `pages` door**, which is what makes the domain root serve the page you built. Building a page called Home does NOT set it, and a store whose root still shows the blog index reads as unfinished at the only URL most visitors type. **Wiring a menu is not designing the surface** — the topbar, header and footer are designs, decided back in phase 5. If you set a menu id here and moved on, all three are still at their shipped defaults. |
| 9 | **Match** | **ALWAYS — phase 2 always ran.** Measure what you BUILT with the same checklist at both widths, then run `node scripts/match.mjs --reference <each phase-2 spec at that width> --live <the live spec at that width>` once per width. Every spec states `measured_with`: without a browser, sizes and colours are unmeasurable, never matched. One reference is a target; three are a band. Exit 1 is not done. |
| 10 | **Hand over** | First **the live check**: `node scripts/live-check.mjs <site-url> <api-key>` — every page the store shows at 390, 768, 1024 and 1440, collapsibles open and closed, each overlay open, hover and focus forced — and **open every strip it saves** (`references/spacing.md` → "The check"); fix what it finds and run it again. Then the eight-point look below, and `node scripts/handover.mjs <site-url> <api-key> --joins <its folder>` — **every build.** It fails on a page, a width or an overlay missing, a result over a day old or measured the wrong way, and a finding neither fixed nor accepted with an id (a known plugin limit, or a decision the merchant took). Exit 1 is not done, and a `!` saying the store is NOT PUBLIC goes to the merchant first even at exit 0. Say what you built and what is genuinely left to them. **If `/me` still says `discourage_search_engines: yes`, say it again in the same words.** Offer to switch it off yourself only when the merchant says they are launching and your key holds `search_visibility` (`/me` → `resources.store_settings.scopes`), and switch it only once they say yes. Never change it on your own: only when the merchant asks. |

**The five hard orderings:**

- **4 before 5** — every style value references `var(--cl-*)`. Write styles before the palette exists and they point at nothing.
- **`store_settings` before any design** — it owns reading direction and the page width, and its compiled CSS is the ONLY definition of the `.cl-boxed-mode*` container classes the designs are laid out inside. Skip it and every section renders unbounded, on a store the api reports as correct.
- **8 after 7** — a menu cannot link to `/about` before `/about` exists.
- **Assign every product to a real category before deleting any category** — deleting a seeded one orphans them.
- **Design before you show content** — an unstyled page makes a merchant judge the copy by the styling.

## Phase 10's browser pass — look for these EIGHT things, not for "does it look good"

Use whatever browser you have. **This is not a skill you invoke; it is a list you work through.**

An unscoped look is worthless: it is the by-eye pass `match.mjs` exists to replace, and it cost
four rounds of merchant-pointed defects. So look only for the **classes a measured spec cannot carry** — everything
else has already been checked by a script, better than you will check it.

| # | Look for | Why a spec misses it |
|---|---|---|
| 1 | **A real phone width** (≈390px), not just desktop — every control there 44 × 44px or more | a spec is measured at ONE width; the layout breaks at another, and no spec holds a tap target's size |
| 2 | **Overflow, clipping, collision** | every individual value can be correct while two elements still collide |
| 3 | **Images actually rendering** — the real photograph, not a placeholder, not a broken box | the element EXISTS either way, so every DOM check and every metric passes |
| 4 | **Padding that is actually there** | nothing "overflows" when padding is zero, so an overflow metric reports clean |
| 5 | **Interaction states** — cart drawer, quickview, dropdowns, hover, and **the header after you scroll one screen**: it should be opaque, readable, and not hidden under the admin bar (check once while logged in) | they are not in the DOM, or not in that state, until opened or scrolled |
| 6 | **One aspect ratio across a listing grid, one look for one element** — the same card, price or tag on every surface (product page and quick view) | each image and each design is valid alone; only side by side shows the drift |
| 7 | **The real entry path**, not a convenient proxy | a component behaves differently nested in a drawer than standalone |
| 8 | **Space between cards** in every list and slider — products, categories, reviews — and between a summary and the list beside it: they touch only where the design joins them | each card is whole and nothing overflows; only the row shows they touch |

**3 and 4 are the load-bearing ones**: a metrics-only pass once certified a modal that shipped flush
content and initials where photographs belonged. **So take a screenshot and LOOK at it** — no reading
of the DOM substitutes for that.

**No browser?** Say so, name which of the eight went unchecked, and never let "could not look" read
as "passed" — the same rule `reference-extraction.md` already applies to an unmeasurable row.

**RE-RUN IT AFTER THE LAST LAYOUT-AFFECTING CHANGE, not once per build.** Switching a block on or off,
reordering blocks, or changing a container preset, a Spacing design or a style re-opens every join on that page. After
any of these, run the live check again on that page (`--only <its address>`) — all four widths, collapsibles open and
closed, each overlay open — and open its strips. It holds every visible thing to the nine laws (`references/spacing.md`):
nothing touches or overlaps, a box is a box only if it is seen, a heading nearer its items than they are to each other,
one gap for parts of one kind, one edge for one column and the page's edge for the header, trail, title and footer,
every gap on the store's steps, a readable line, one placement for every badge of a kind, floating buttons on the page
edge and covering nothing at the page end; and the seven page checks: browser-default headings and links, `#links` to
nothing, soft photos, controls under 44px on phones, custom CSS a nested design never receives, text under WCAG's
contrast, content out of its box. Zero findings, or an id in the saved result's `"accepted": [{ "check", "where",
"ledger" | "decision" }]`, which `handover.mjs --joins` reads. **Never restate an earlier pass as a current fact.**
Measured: a summary block switched back on after the pass sat flush on the form below it — the pass had run days
before, on a page without it.

**A custom block inside a stack of the surface's own collapsibles must match them:** header height,
chevron size and colour, divider, gap above and body padding, at 1440 and 390, open and closed.
the live check compares them for you (L4, a collapsible stack), not your eye. A difference is a finding: fix it through the
placement's look (`references/api-recipes.md` → "A custom block among a surface's own collapsibles"),
never with custom CSS. When the placement cannot reach it, that section's step 4 applies. Measured: a block
placed between two product sections drew a 22px header with no divider against their 59px with one — every
door had answered 200.

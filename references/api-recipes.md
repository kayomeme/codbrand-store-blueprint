# Applying a blueprint

## Do not trust this file for what the API accepts

**It deliberately contains no field lists and no payload schemas.** The API describes itself, and a
copy here would rot the moment a door changes — which is exactly what happened to an earlier
hand-maintained doc in this project.

Ask the API instead. Every time:

```
GET /me                    which resources exist, and what your key may do
GET /openapi               the full machine-readable contract
GET /docs/{slug}           the human page for one resource
```

Every write door also publishes its own field list with types and descriptions, and **a 400 names the
field it refused and why**. Read the refusal; do not guess around it.

What *this* file holds is the part the API cannot tell you: **the order, the preconditions, and the
things that fail quietly.**

## Order, and why

| phase | do | why here |
|---|---|---|
| 0 | read `/me`, then the store's current state | you cannot decide "fresh vs established" without it |
| 0b | read the current blueprint (`?status=applied`) | tells your work from the merchant's |
| 2 | measure the reference site, if they gave one | every decision below should follow measured values, not an impression |
| 4 | **`store_settings`**, then **`stores/ensure_pages`**, then palette, fonts, icons | reading direction and the page width are what every design is laid out inside; **everything downstream references `var(--cl-*)`**; and the funnel is not reachable until its pages are wired |
| 5 | designs, copy, logo | needs the tokens to exist |
| 6–7 | pages | needs the design, or the merchant judges copy by styling |
| 8 | menus, nav, the front page (`is_front_page` on `pages`) | **needs the pages to exist** — and a menu id is not a designed header; that was phase 5 |
| 9 | measure what you built, and diff it against the reference | the only step that can catch a build that is self-consistent and still wrong |

Two of those are hard failures, not preferences: styles written before their tokens point at nothing,
and a menu cannot link to a page that does not exist yet.

## `store_settings` — the door it is easiest not to know exists

**Write it in phase 4, before the designs.** It owns the settings every design is laid out *inside*,
and a store that skips it looks broken in ways nothing else can fix:

- **Reading direction — set the LANGUAGE, and the direction follows.** `langue_code` on
  `store_settings` is the single control: it writes WordPress's own Site Language (`WPLANG`),
  installs the translation pack, derives `langue_direction`, and recompiles the `direction:` rule —
  in one call. Send a **full WordPress locale**, not a 2-letter code: `fr_FR`, `ar`, `pt_BR`,
  `es_MX`. (Legacy 2-letter values are still accepted and resolved, but write the locale.)

  ⚠️ **`langue_code` decides the direction.** RTL is derived from the language, so a store set to
  `ar` renders right-to-left everywhere — `<html dir>`, the theme, the editor and the plugin's own
  compiled rule. `langue_direction` is an override you can still send through `store_settings` for
  the rare store whose script does not match its language; it is only honoured when you send it in
  the same call. The `stores` door **REFUSES** it — `PATCH /stores/{id}` with `langue_direction` (or
  `langue_code`) answers `400 Unknown field(s) in the request body`. It used to accept the write,
  move a column nothing renders from, and return `200` while the storefront stayed LTR; that silent
  no-op is why the field was denied there. `store_settings` is the only door for either key.

  **A language WordPress does not ship is still fully supported.** The shopper-facing words are free
  text in the designs — write Darija, Tamazight, a dialect, anything — and nothing validates them
  against a language. `langue_code` is not choosing the words; it sets `<html lang>` and DERIVES the
  direction. Those are separate decisions and only the second is constrained.

  **So pick `langue_code` by SCRIPT, never by language.** Latin-script Darija is the case this skill
  exists to get right, and picking `ar` because "the language is Arabic" ships a fully mirrored store
  — header flipped, punctuation on the wrong side — no matter what `langue_direction` says. Measured:
  `langue_code: ar` + `langue_direction: ltr` served `<html dir="rtl" lang="ar">`. Use `fr` or `en` for
  Latin script and record the real dialect in the blueprint, where it belongs.

  An earlier version of this page said to set both settings together and implied that was sufficient.
  It is not, and that advice produced exactly the mirrored store it was meant to prevent.
- **The page width and side gutters.** The compiled CSS here is the *only* definition of
  `.cl-boxed-mode`, `.cl-boxed-mode-padded` and `.cl-full-width-padded` anywhere in the plugin — no
  stylesheet carries a fallback. Those are the default container classes on product, header, cart,
  checkout, footer and both listings. Until this is written the classes are applied with **no rule
  defined at all**, so every section is unbounded and ungutter'd. Nothing seeds it — not activation,
  not a migration. This affects every store you build.

  ⚠️ **Two doors touch width, and they do different jobs.** This one DEFINES those four classes —
  what "boxed" is actually worth in pixels, and how much gutter "padded" means. A separate set of
  fields on `stores` CHOOSES which of the four each surface uses (cart, checkout, product, search,
  thankyou, category). Defining without choosing is fine; choosing without defining is not, which is
  why this door still comes first. If you want a surface narrower or wider, that is the `stores`
  field — writing a different value here changes every surface at once.

  You can skip the choosing entirely: the six ship with sensible per-surface defaults that preserve
  normal rendering, so leaving them alone is a real option, not an oversight. Set them when the
  density you decided in phase 3 actually calls for it.
- **The brand name.** The footer and the browser tab render WordPress's own site title, not the store
  column — so a store can be correctly named through `stores` and still show "WordPress" in the tab.
- **Contact details and social links**, which otherwise keep whatever the install shipped with.

**Currency and price format are NOT here** — those are per-store columns, written through `stores`.
That split is the single most confusing thing about these two doors; check which one owns a field
before assuming.

**Write through the door, never the underlying option.** One call moves the option, the mirrored
`cl_stores` columns, the per-store cached settings and the WordPress site title/tagline/icon
together. Writing the option directly moves one of those and looks like it worked.

⚠️ **Do not send `reset_lang_confirm` or `storefront_locale_is_active`.** Both keys were REMOVED
from the plugin (31-08-2026), and this door refuses the WHOLE payload when it sees an unknown key —
so one stale key costs you every setting in the call, including the container widths above. The
"reset all component strings" action they belonged to is gone: it applied no translated strings, and
the shipped per-language files it read have been deleted. **A store seeds its designs in English
whatever the language** — translate storefront copy by writing the values through
`section_manager/global_settings`.

**How much that covers — so you can state it precisely instead of hedging.** Measured on a stock
install, 19-09-2026:

| | count | how you reach it |
|---|---|---|
| **settings copy** | **201 keys** across 12 compos — product 52, thankyou 26, plist1 26, cart 21, search 20, checkout 16, reviewlist 16, catlist 10, footer 5, tracking 5, header 2, store 2 | you write them, through this door. The schema flags each one `translatable: true`, so it is an enumeration, not a hunt |
| **baked into PHP/JS** | **74 strings** in frontend code, 18 of which duplicate a settings default — leaving **56** with no settings equivalent | nothing you can call. English until a `.mo` ships |

Of those 56, about **10 never reach a shopper at all** (preview-editor chrome, "No blocks
configured for quickview", internal agent-bot notices) and about **21 are ARIA labels** — invisible
to a sighted shopper, though not to one running a screen reader in the store's language. That
leaves roughly **25 genuinely visible strings**, and they cluster into five groups worth naming
when you report them:

- **order validation and failure** — "Please fill in all required fields to complete your order.",
  "Could not save your order, please try again." The worst moment for English to appear.
- **stock and waitlist** — "This item is out of stock", "You are on the list …"
- **bot protection** — the Turnstile and rate-limit messages, seen only when one triggers
- **the catlist filter's "All" chip** — note the listing EMPTY-STATE messages are NOT in this list:
  since 19-09-2026 all three listings read `filter_no_results_message` on first paint as well as
  after a filter, so an empty products / categories / reviews list IS translatable through
  `section_manager/global_settings`. An earlier version of this page listed them as baked in.
- **the review badge and relative time** — "Verified Purchase", "ago"

**Report it as a number, not a disclaimer.** *"201 keys written in Arabic; about 25 visible strings
stay English, here they are"* is true and actionable. *"I cannot fully translate the storefront"*
is neither — it describes a store whose copy IS in the merchant's language, with a short listable
tail, and the merchant deserves the list rather than the hedge.

**On an Arabic-, Hebrew- or Thaana-script store, `handover.mjs` lists every `translatable` setting
still in Latin letters, and fails.** A Latin-script store gets no such check, because the schema does
not say what each key shipped with, so an English default cannot be told from French copy. There,
compare the keys yourself.

*Measured 21-09-2026: a build reported an Arabic store's copy as fully translated. Seventeen
translatable settings were still English, including "Add to cart" on the main buy button.*

⚠️ **The `langue_code` translation pack is WordPress's, not ours.** Setting `ar` installs the
Arabic pack, which translates core and the theme. This plugin ships `codlfw.pot` at **0 bytes**
and no `.mo` or `.po` in any language, so no pack ever reaches the 57 above. If that changes and
translation files start shipping, this whole section shrinks to nothing — re-measure rather than
trusting the counts.

## The funnel pages — one call, and the store takes orders it can confirm

**In phase 4, call `POST stores/ensure_pages` once. No body, no id, no condition.**

Four WordPress pages host the buying flow — cart, checkout, thank you, search — and a store points
at them through four columns. Miss one and nothing errors. This is what it looks like:

> The customer fills the form, submits, the cart empties — and they are never taken to a thank-you
> page. The order **was** saved. The api returned `200`. Nothing is logged anywhere.

Measured on a real build. There is no failure to find, which is exactly why it needs saying out
loud: you will not notice this by watching status codes, and neither will the merchant until a
customer asks where their confirmation went.

**Why a fresh store is in that state at all.** Those columns ship at `0`, and `0` is not damage — in
the admin it is the dropdown's own *"— Auto (resolve/create on save) —"* option. Something has to
APPLY that Auto, and only two things ever did: the store's first-run setup, and a human opening
Store settings in wp-admin and pressing Save. **A store you built entirely through the api meets
neither**, so its `0`s stay `0`.

**Call it unconditionally.** It is idempotent — on a healthy store it changes nothing and says so —
so checking first costs a round trip and buys nothing except a chance to decide wrong. It reuses a
page that already exists and creates one only where none does, and it will not overwrite a column
already pointing at a live page someone deliberately chose. It takes no `store_id`: the pages are
site-wide and only the wiring is per store, so a store-scoped key wires its own store and leaves the
others alone.

**It needs no new grant** — it rides the `stores` write scope you already hold.

**If it answers 404, the merchant's plugin is older than this door.** Do not fail the build over it:
finish the store, and tell them at handover that the funnel needs one Save in wp-admin → Store
settings before they take a real order. That is a sentence they can act on; a dead build is not.

## Express checkout — a decision, not a default

Express checkout puts the whole order on the product page: the shopper opens a product, fills the
form and orders, with no cart step. It is a way of building the store, not a switch. Decide it with
the merchant's selling in mind (one hero product sold from ads is the classic case; a catalogue that
shoppers browse and combine is not), then **read `GET /docs/express_checkout` before touching
anything** — it holds the rules this section does not repeat.

- **Where it sits in the order:** the two modes are a `stores` write (phase 4, beside
  `ensure_pages` — still call it: the open-cart button on non-product pages still goes to the cart
  page); arranging the page is the product design's order list (phase 5).
- **The quiet failure:** `checkout_mode: in_product` with any other `cart_mode`. The form shows up
  exactly where it should, and orders whatever the cart holds instead of the product on screen. Set
  **both** modes.
- **The aim is a short page.** Choose per store which blocks it needs; showing every block defeats
  the purpose. Hide a block with its switch, never by dropping it from the order list — the doc says
  why.
- **Verify on a product page:** the summary lists that product at its price, the total includes
  delivery, and no other product appears.

## Things that fail quietly

**A write that succeeds is not a write that shows.** Several settings only take effect when a sibling
toggle is on, or when something else points at the design you just edited. If you set a value and the
storefront does not change, check the gate before rewriting the value.

**Named example, because it is money and easy to reproduce: creating shipping rates does not turn
them on.** `POST checkout/shipping_rates` returns `200` and the row is real, but the checkout ignores
the whole table until the *checkout design* also has `shipping_rates_is_active: "yes"` — a sibling
setting on `section_manager/global_settings/checkout/{id}`, not on the rate itself, and not mentioned
on the `shipping_rates` door's own doc page. Ships `"no"` on a fresh design. Miss it and every order
quietly uses the design's OWN flat `default_shipping_rate_fees` instead (measured shipping at **0** on
a fresh install) — no error, no partial state, a normal `200` at every step. Verified on a real
build: an order placed with the gate off booked at exactly the product price with a rate radio button
never even shown; flipping `shipping_rates_is_active` to `"yes"` made the same two rates render as
selectable options, and the next order booked at product price **+ the selected rate's cost**,
matching the quote exactly. Check this gate in the same phase you create the rates, not after.

**A design's custom CSS can lose to the plugin's own, silently.** Scoping decides where a rule
applies, not how strong it is: a plain selector keeps only its own weight, so a shipped two-class rule
(a listing card's `display: flex`) beats your one-class rule whatever the order. Look for a setting
first; when CSS is the only way, read `/docs/custom_code_css_js` → "Winning against the plugin's own
CSS" — a written `:scope` adds the class you need.

**Design settings are per SM instance, and a store chooses which instance it uses.** Writing to an
instance no store points at changes nothing visible. Resolve which instance the store actually uses
before writing to it.

**Global tokens are shared.** Colours, fonts and presets live in one library across all stores.
Adding is safe; **editing a token another store references restyles that store too.** On a
multi-store install, add and point rather than edit.

**Media dedupes by content hash**, so re-uploading the same bytes is safe and free. When you upload an
image you generated, send `"source_type": "trainedAlgorithmicMedia"` — it is recorded with the image.

**What you may remove — a hard rule.** Delete or replace only images YOU added (uploaded through the
API). Any other image — one the merchant added — only when the merchant has asked you to remove or
replace THAT image; then, and only then, send `"merchant_confirmed": true`. Never set it to clean up on
your own initiative, and never to get past a refusal.

`GET media/{id}/usage` shows where an image is used. `DELETE media/{id}` refuses while anything uses it
(point those places elsewhere first — a merchant's request does not override this) and needs the key's
`media` delete grant. `PUT media/{id}/file` swaps the picture inside an image when the new one has the
same format and size, so a logo iteration of the same size needs no re-linking. See
`/docs/media_usage_and_delete`.

**Some things have no door — but CHECK before you say so.** A contact form is the known one: you can
build a Contact page, but it lists WhatsApp / phone / email rather than a working form. Say so rather
than quietly shipping a page that looks like it has a form. If a door you expected really is missing,
tell the merchant — do not invent a workaround that leaves the store in a state nobody can maintain.

⚠️ **"There is no api door for this" is the most expensive sentence in a handover.** The merchant
believes it and does it by hand from then on, so a wrong one keeps costing long after the build ends.
**This file not naming a thing means THIS FILE is incomplete** — it says so at the top — **never that
the door is absent.** Read the resource's own field list before you concede; every write door
publishes one. Measured 20-09-2026: a build reported the front page as impossible and sent the
merchant to wp-admin. `is_front_page` was declared, enum-validated and documented on the `pages` door
the whole time; the build inferred its absence instead of reading the door.

**The front page is a SITE-WIDE switch, so `"no"` is not a safe default.** `"yes"` on one page takes
it off whichever page held it — there is only ever one. Sending `"no"` on the page that currently
holds it hands the domain root back to the blog index: a normal `200`, and the store stops answering
at its own root. Send the key on the ONE page that should be the front page and omit it everywhere
else; never send `"no"` as a tidy-up.

## Idempotency, so a re-run is safe

- **Pages and products** update by `slug` — the same slug rewrites rather than duplicating.
- **Media** dedupes by content hash.
- **Writes** accept an `Idempotency-Key` header; use one so a timeout is safe to retry.
- **Blueprints** are versioned per store: each create is a new version, and applying one archives the
  previous. That is the intended shape — do not try to overwrite a version in place.

## Content

**You orchestrate; you do not make the artifacts.**

| artifact | who makes it | then you |
|---|---|---|
| page markup | `codbrand-content-builder` | publish what it returns, unmodified |
| photos and the logo | the agent you are running in | upload via `media`, pass the returned `url` on |
| icons | the agent — inline SVG or a service, its call | nothing, unless it chose to upload one |

**Order matters inside phase 7:** generate and upload the images *before* handing a page's structure
to the renderer, so it places real assets instead of inventing placeholders.

### A page's width is YOURS to set — nothing else sets it

**A page you publish does not get its width from the store.** The store's width settings are
per-surface (`cart_width_mode`, `category_width_mode`, `checkout_width_mode`, `product_width_mode`,
`search_width_mode`, `thankyou_width_mode`) and **none of them applies to an ordinary page**. A page
takes the theme default — `cl-full-width-padded` — unless you override it, one call per page:

```
PATCH /cl-api/v1/pages/{id}/plugin      {"width_mode": "none"}
```

`""` inherits · `none` = no wrapper, true edge-to-edge · or one of the four store width classes.
The same door exists on `products/{id}/plugin`, where it wraps the landing content under the product
block.

**The front page is the exception:** there `""` gives no wrapper at all, because the plugin removes
it for a designed home. To box the front page, send one of the four classes explicitly; an explicit
value is kept.

**Which to send:**

| the page is | send | why |
|---|---|---|
| a banded landing / lookbook / home — full-bleed sections, each with its own background | `none` | the bands must reach both edges |
| prose — About, a legal page, a policy | `""` (leave it) | the inherited padding is the only thing keeping the text off the viewport edge |

⚠️ **`align:"full"` in the markup does NOT do this**, and believing it does is the whole trap. It
removes a `max-width`; it cannot escape the wrapper's `padding`. **Measured on demo.codbrand.pro,
18-09-2026:** a lookbook's 8 bands sat at `x=32, w=1344` in a 1408px viewport under the inherited
default, and at `x=0, w=1408` after one `width_mode: "none"` call — identical markup both times.

⚠️ **No status code reveals this.** The page publishes `200`, reads back correct, and renders inset.
It joins the aspect-ratio drift below in the class of defects only a screenshot catches — so treat
the width as a fact you deliver per page, not something to notice at phase 10.

### Every product photo at ONE aspect ratio — decide it before you generate the first one

**Pick a single ratio for the whole catalogue, generate every product image at exactly those pixel
dimensions, and set the listing's image container to that same ratio.** Both halves. Either one
alone leaves a defect.

Measured on a real build: some photos came back 1400×1400 and others 1400×1867. The cards were all
the same height — but the photos inside them were not. A square shoe on one card, a wide belt
floating in white space on the next, and a catalogue that reads as if it were assembled from
whatever was lying around. Which, in effect, it was.

**Generating at the target ratio matters even though the storefront has a ratio box of its own.**
The listing crops to FILL that box, so a photo composed at a different ratio is not politely
letterboxed — it is **cut**. A belt shot wide, forced into a portrait box, loses the belt.
Generate at the ratio the store displays and there is nothing to crop away.

- **Choose by what you sell.** Square (1:1) suits objects shot centred — bags, watches, cosmetics,
  jewellery. Portrait (3:4 or 2:3) suits anything worn or standing — shoes, clothing, furniture.
  Pick once, for the whole store.
- **Fix the pixel dimensions before the first image** and reuse them for every product — including
  the second (hover) photo, which is part of the same grid and fails the same way.
- **Then point the listing's image-container ratio at the same value**, so the box and the photos
  agree. Read the design's own settings to find it; do not guess a key name.

⚠️ **This is one of the things a `200` cannot tell you.** Every upload succeeds, every product reads
back correctly, and the listing still looks wrong — so it survives any check made of status codes.
The only thing that catches it is opening the listing and looking at it, which is why
"Verify at the end, in the browser" exists.

### How many product columns a phone takes

At 390px, two columns give each card about (390 − 2 × phone gutter − grid gap) ÷ 2, which is about
155px at the shipped 24px gutters and 32px gap. The card's buttons share that width. Once quick view
is switched on, add to cart and quick view sit side by side in the listing's default `inline` buttons
layout, each gets roughly 75px, and a two-word label wraps onto two or three lines.

*Measured 21-09-2026, at 390px with 2 columns: the add-to-cart button was 78px wide, and its Arabic
label "زيد بسرعة" split in the middle of a word. The plugin stopped the mid-word split in 1.2.766, but
a 78px button still crushes its label.*

**Use two columns on a phone only when both of these hold:**

1. **Each card carries at most one text button.** Make the second one icon-only (its text is just
   `@icon`), switch it off, or stack the buttons: the listing's `stacked` buttons layout gives each
   one the full card width.
2. **The longest button label fits on one line inside the card**, in the store's language, after you
   have written the copy. Translation changes a label's length, so check it after the copy is written.

Otherwise use one column. The listing design's `mobile_columns` setting holds it (1 or 2). A
`cl/products-listing` block on a page overrides it with its own `mobileColumns`, and `inherit` follows
the design, so set the page's blocks as well, or leave them on `inherit`. Read the design's
`settings_schema` for the current buttons-layout values rather than trusting this paragraph. Then look
at the grid at 390px in the phase-10 browser pass.

### Reviews on a product page get one or two columns, never three

The product page's reviews block renders inside the product-info column, not across the page, so it is
working with roughly half the width even on a desktop. Three columns there give each card a strip too
narrow for a sentence, and the same design read fine on the home page, where it has the full width.

Set the product page's reviews to 1 or 2 columns and check it in the phase-10 browser pass at 1440 as
well as at 390 — this is one of the few places where the desktop view is the cramped one.

`codbrand-content-builder` is required, not optional, and `preflight.mjs` checks it is installed
before any work begins. If it is missing, say so and stop — writing the markup yourself produces a
visibly thinner store, which is the failure this arrangement exists to prevent.

**The door takes any string.** `content` is stored byte-verbatim — nothing is sanitised, escaped or
reformatted, and malformed markup returns `200` exactly like good markup does. Nothing downstream
catches a mistake, which is why the renderer's validators are the only real check.

## Search titles and descriptions — phase 7b

Every page you built and every product needs its own search title and description. Without one, the
plugin takes the description from the page itself: its excerpt, or else its body as plain text, cut
off at 300 characters. On a banded page that is a run of headings and numbered steps that stops
mid-sentence, and it is what a shopper reads under the link in a search result.

*Measured 21-09-2026: a delivery page served its own numbered steps as its search description, cut
off in the middle of the list.*

The doors are per item: `pages/{id}/seo`, `products/{id}/seo` and `posts/{id}/seo`. Read
`GET /docs/seo_overrides` for what they take, and `GET /docs/seo_global_settings` for the seo design.
The docs cannot tell you the following:

- **Write both in the store's language**, like the rest of the copy. The title names the page and the
  brand. The description is one plain sentence for someone deciding whether to click: say what the
  page answers, rather than repeating its first paragraph. Send plain text only, because markup in a
  meta description is escaped into noise.
- **Products take the same two, plus their condition.** Condition is a fact about the merchant's
  goods, so confirm it with them rather than assume it. Once they confirm, set it once as the seo
  design's `product_condition_default` instead of product by product. Until someone decides, empty is
  the correct value, because it states nothing.
- **Leave `noindex` alone** on everything you built. It removes far more than the robots tag (the doc
  says what), and a small store has nothing to hide from search.
- **Check the store's `country_code`** on `stores`. Until it is set, product pages give search engines
  and link previews no price at all, whatever the seo design says.
- **A shared link to a page with no featured image of its own previews with the store's logo**, and
  with no picture at all when the store has no logo. Check the `pages` door's own field list: if it
  takes no featured image, that fallback applies to every page you build.
- **The seo design is listed by `GET section_manager/global_settings`** (type `seo`). Read it before
  you assume any of its switches. Which one a store uses is `seo_sm_id` on the `stores` door; at 0 the
  store uses the first active one, and `GET stores/{id}` names it under `renders.seo_sm_id`.
- **Verify by reading the page's HTML**: the `<title>` and `<meta name="description">` tags. None of
  this shows on the page itself, so a screenshot proves nothing. A fetch is enough, and needs no
  browser.

## The store ships with English demo copy that makes PROMISES

A fresh install seeds promo blocks on the cart, checkout and product pages. They are placeholders,
they are in English, and they commit the merchant to terms they never agreed to. Measured on a real
build for a Moroccan merchant who offers a 7-day exchange and prices in dirhams, the storefront was
telling her customers:

> Free delivery on orders over **$50** · **30-day** money-back guarantee

Nobody wrote that. It shipped with the store, and the build never noticed because it never looked.

**In phase 5, read and rewrite them.** Four doors own this, and none is optional:

| door | what it holds |
|---|---|
| `custom_blocks` | the promo blocks' own body copy — the refund and delivery promises above |
| `custom_blocks/placements` | **a SEPARATE English string per placement** — `header_title` — see below |
| `checkout/fields` | the checkout form labels and placeholders |
| `checkout/shipping_rates` | the delivery cost and the free-delivery threshold |

Treat every seeded string as **wrong until you have replaced it**. It is not neutral filler: a
currency and a returns window are commitments, and shipping someone else's is worse than shipping
nothing. If the merchant has not told you their terms, **ask** — this is one of the few places where
a fact only they can know has real consequences.

⚠️ **Rewriting a promo block's `content` does NOT rewrite what the shopper sees as its heading.**
When a block's display is `collapse` (the shipped default for both seeded blocks), the visible
clickable header comes from a field on the *placement*, not the block:

```
GET /custom_blocks/placements/{id}
{ "id": 1, "content_type_id": 6, "header_title": "Money-back guarantee", ... }
```

`header_title` lives on `custom_blocks/placements`, is a plain string with no `translatable` flag
anywhere to find it by, and is entirely independent of the block's own `title` — PATCHing
`custom_blocks/{id}` with a French `title` changes nothing here. Verified on a real build: the block
body read correctly in French while its collapse header still read "Money-back guarantee" /
"Shipping information" until `PATCH /custom_blocks/placements/{id} { "header_title": "…" }` was sent
for every placement (`GET /custom_blocks/{id}` → `placements[].id` lists them). List every placement
on both seeded blocks and rewrite `header_title` on each — a store can have the same block placed on
both `cart` and `checkout`, and each placement carries its own copy of this field.

## The header — the logo, and the half-state to avoid

A logo is two writes, not one, and the failure mode is silent.

1. **Brief it** from the archetype and the brand name — what it should feel like, not how to draw it.
2. **Produce it** — the agent you are running in, by whatever means it has.
3. **Upload it** through `media` and keep the returned `id` and `url`.
4. **Point BOTH places at it.** The header design carries its own logo fields, and the site-wide logo
   is a column on **`stores`** — `site_logo_id`. Setting only one leaves the other showing nothing.

   ⚠️ **The logo and the favicon are two different images, and `store_settings` writes both.**
   `site_logo_id` is the wide brand mark and is what search engines get as the organisation logo;
   `site_icon_id` is the square favicon. Either door can write either field — `store_settings` by
   name, or `stores` as columns.

   *This paragraph has been wrong twice today, so here is the whole of it. It first said
   `store_settings` "exposes no logo field and will refuse one", which was false — it wrote the logo
   column under the name `site_icon_id`. That was corrected to "they are ONE column, write it once",
   which was true for a few hours and is now false too: the owner split them, so there are genuinely
   two images. If you are reading a store built before the split, its logo column may hold a favicon.*

⚠️ **If you have no image, leave the slot ON — turning it off is what actually produces nothing.**
An earlier version of this page said the opposite (`logo_image_is_active` → `no` "ships a text
wordmark") and had the mechanism backwards. Read `logo.php` and the fallback is INSIDE the
`if ($settings['logo_image_is_active'] == 'yes')` block:

```php
<?php if ($settings['logo_image_is_active'] == 'yes') { ?>
<div class="logo-container" cl-sub-block="logo">
    <a href="...">
        <?php if (!empty($settings['logo_image_url'])) : ?>
            <img ... >
        <?php else : ?>
            <span class="cl-logo-text"><?= esc_html($clLogoText) ?></span>   <!-- falls back to store site_title, then get_bloginfo() -->
        <?php endif; ?>
    </a>
</div>
<?php } ?>
```

So the text wordmark is what you get from **`yes` + an empty `logo_image_url`** — the exact "half
state" this section used to warn you off. `no` doesn't fall back to text; it removes the whole
`.logo-container`, image AND text fallback both, which is a **blank header** and strictly worse than
the state being warned about. Verified on a real build: setting `no` produced no logo at all;
reverting to `yes` with the image fields still empty produced `<span class="cl-logo-text">{site
title}</span>` immediately.

**Tell the merchant plainly that a logo is the single most worthwhile thing they can add** — that
part of the old advice was right, only the setting value was backwards.

**The wordmark's typography is a setting** — `logo_text_preset` on the header design (a typography
preset, default `204` "Small Title"; plugin 1.2.725 and later). Pick or clone a preset through
`design_controls/presets` — family, size, weight, colour, line-height, letter-spacing, transform and a
mobile size all live there — and write its id with `PUT section_manager/global_settings/header/{id}`.
It applies only while `logo_image_url` is empty. Verify the result by reading `getComputedStyle` on
`.cl-logo-text` (or the rendered `<img>`), not by trusting the settings write: a `200` on every write
is exactly how a wrong-looking header goes unnoticed.

⚠️ An earlier version of this page said there was no settings key and told you to write custom CSS on
`.cl-logo-text` through the custom-code door. **Do not do that any more.** A typography preset's
selector repeats its class three times, so it outranks a one-class rule whatever the order, and such
CSS now silently loses. A store that still
carries one from before: move its values into a preset, set `logo_text_preset` to it, delete the CSS.

### ⚠️ Correction — `nav_center` DOES render the logo

**An earlier version of this page told you to change `main_header_layout` away from `nav_center`,
because that layout "has no logo slot at all" and "`.logo-container` never renders regardless of
`logo_image_is_active`". All of that was wrong**, and it was the most expensive kind of wrong: it
told you a capability was missing, so you stopped trying. If you changed the layout on the strength
of it, that change was unnecessary — though harmless, since every layout renders the logo.

What the source actually does:

- `main_header/v1/index.php` includes `logo.php` **unconditionally**, for every layout. Its own
  docblock says so: *"Always emits the same DOM (logo, main-nav, end-zone). Layout positioning is
  handled in generated_css.php via flex order/justify-content rules."*
- `logo.php` gates on **one** thing — `logo_image_is_active`. No layout value is read anywhere in
  the logo render path.
- `generated_css.php` emits `.cl-header-main .logo-container { display: flex; … }` **outside** the
  per-layout `if/elseif` chain, so it applies to every layout including `nav_center`.
- Four layouts (`logo_center`, `stacked`, both `drawer_logo_*`) add a `.logo-container`
  **repositioning** rule. `nav_center` having none means "needs no reorder", not "does not render" —
  and that branch's own comment describes it as `[logo .. nav .. end]`, logo first.

**So `main_header_layout` is a design choice about WHERE the logo sits, never whether it appears.**
Pick a layout because you want that arrangement. Read the live list from
`GET section_manager/global_settings/header/{id}` → `settings_schema.main_header_layout.options`
rather than assuming any particular value is still the shipped default.

### Header height: what sets it depends on the layout

`header.height` is one of the rows `match.mjs` compares with the reference. The setting that gets you
there changes with `main_header_layout`:

- **Every one-row layout** (all of them except `stacked`): a `height` in `main_header_container_style`
  fixes the bar's height. While it is set, the bar's top and bottom padding is zeroed so the logo can
  fill the bar.
- **`stacked`**: `height` is ignored, and the bar always sizes to its two rows. Its vertical space comes
  only from the top and bottom padding of the header's card design (`main_header_container_preset`),
  set in that preset's `css_default`, plus `css_mobile` for phones. A card design with 0px vertical
  padding renders a cramped header, whatever height you write.
- **A one-row layout with NO `height`** sizes to its content exactly like `stacked`, so its only vertical
  space is again the card design's padding. The shipped `height:60px` has room; removing it without
  padding the card design gives the same cramped bar. A height that is not a real length (`auto`, `0`,
  a bare `60`) is worse: the plugin still counts it as set and zeroes the card design's padding, so the
  bar gets none at all. Use a real length, or no height.

The header's style door refuses `padding` on purpose, because padding belongs to the card design.
Check the preset's `used_count` before you edit it: a card design can be shared, and new padding lands
on every surface that uses it. If it is not the header's alone, create one for the header through
`design_controls/presets` (an `apply` entry with no id creates one), and point
`main_header_container_preset` at it. Leave `force_styles` off on that card design and on the two menu
text designs (`main_nav_items_text_preset`, `end_menu_items_text_preset`). It adds `!important` to
every declaration, so the stuck bar's own background and text colour could no longer win.

`handover.mjs` fails any header that sizes to its content (`stacked`, no height, or a height that is not
a real length) without top and bottom padding on desktop or on phones, and a sticky header whose bar is
not opaque once it sticks.

*Added 21-09-2026: a build set `height:221px` on a stacked header whose card design had 0px vertical
padding. The height did nothing, the style door refused padding, and the header shipped cramped.*

## Verify at the end, in the browser

The API returning `200` proves the value was stored, not that the store looks right. Before you tell
the merchant it is done, open the storefront and look — a mobile width especially, since that is
where their customers are.

Check the things a status code cannot: does the palette read; is the price legible; does the buy
button look like a buy button; does the page hold together on a phone.

**Run the gate before you look**, on every build — reference site or not:

```
node scripts/handover.mjs <site-url> <api-key>
```

It reads the store back and exits 1 on the failures that leave no visible trace: the logo half-state,
an element switched on with nothing in it, a dangling icon, thin or inconsistent product photography,
a header that sizes to its content with no vertical padding, a stuck header that is not opaque, a coloured band with no
side padding, Latin-letter copy on an Arabic-, Hebrew- or Thaana-script store, and a feature checklist
the store disagrees with. A check it could not run is a failure too, never a pass. Then look at these
four, every time:

| artefact | what you are actually checking |
|---|---|
| the **header** on a real product page | the logo renders — and if what renders is the text wordmark, say so out loud rather than letting it pass as done |
| the **footer** on a real page | that it is not hollow — see "The footer" below |
| the **topbar** copy | that it is the merchant's words and not the shipped line |
| any page at a **phone width** | that is where their customers are |

A checklist that names artefacts survives a long build. A sentence saying "check the live site" does
not — that sentence was already here when a build shipped an undesigned topbar, header and footer.

### If there was a reference site, "looks right" is not the test — "matches" is

Looking is necessary and not sufficient. A store can look perfectly good and be nothing like the site
the merchant pointed at, and *they* will find every difference if you do not.

Measure the built store with the **same checklist** you used on the reference, at both widths, then
diff once per width:

```
node scripts/match.mjs --reference reference-1440.json --live live-1440.json
node scripts/match.mjs --reference reference-390.json  --live live-390.json
```

Exit 0 means every row matches or carries evidence. Exit 1 means it does not, and the output names
the rows. Full method — including why the checklist is written to run twice, and the traversal rules
that decide whether a measurement is even valid — is `references/reference-extraction.md`.

**Do not skip the second pass because the first one went well.** Three of the four defects that made
this gate necessary — a nav with too many items, a footer column the reference did not have, and an
inverted topbar — exist *only* as a difference between the two. Nothing about the reference alone,
and nothing about a `200`, could have surfaced any of them.

## The topbar — the surface most likely to ship untouched

The header and footer at least get looked at. The topbar is one narrow strip, it ships with a
plausible-sounding default line, and a build that never opens it produces a store whose only
promotional real-estate says something the merchant never wrote. That has happened: a welted-footwear
brand shipped carrying the shipped default, byte-identical.

Judgement, not a field list — read the keys from `settings_schema` on the design:

- **Decide whether it exists at all.** A minimal brand often reads better with no topbar than with a
  filler line. Turning the surface off is a decision; leaving the default is not.
- **Every message must be something the merchant would sign.** The seeded copy is generic by design.
  Anything about delivery time, shipping cost or returns is a PROMISE — see the demo-copy section
  above. Facts about how the store works or what the product is carry no such risk.
- **Rotation is a choice with a cost.** Multiple messages mean any single one is seen by only some
  visitors. Two or three short lines rotate well; five do not.
- **A message can carry a link**, which is usually the highest-value thing the strip can do — and the
  archetype decides whether that link is a promotion or a proof point.

Match the topbar the way you match anything else: its height, its background, its text colour and
size, whether messages rotate, and whether any is a link. It is small enough that a mismatch reads as
carelessness rather than as a design choice.

## The footer — it ships hollow, and the hollowness is silent

The footer's identity elements — the brand line, the logo, the contact rows, the social links — ship
**empty, deliberately**. So "leave the footer alone" no longer means "it keeps sensible defaults". It
means those elements render as nothing.

**The shape to know, because it is the one you cannot see:**

> An element is switched **ON** (`…_is_active` = `yes`) while the thing it displays is **empty**.
> The view returns *before* it prints its own heading — so there is no dangling "Contact us", no
> error, and no gap in the markup. Just space where a column should be.

That is why this one survives a `200`, a screenshot, and a glance at the page.
`scripts/handover.mjs` tests exactly that shape, and it tests it as a shape rather than against a
memorised list of footer keys — so it keeps working when the plugin adds a surface.

For every such element the build makes **one of two decisions, never neither**:

- **Fill it** — real contact rows, real social URLs, a brand line the merchant would sign.
- **Turn it off** — set its `…_is_active` to `no`. An empty element that is switched off is a design
  decision. An empty element that is switched on is an unfinished build.

Judgement, not a field list — read the keys from `settings_schema` on the design:

- **The brand column carries identity or it carries nothing.** A logo or a wordmark, plus one real
  sentence. A brand column holding only the store name is the tell of a surface nobody designed.
- **Contact rows do real work on a COD store.** These shoppers are deciding whether a stranger will
  actually arrive with a parcel and take their cash. A visible phone or WhatsApp earns more trust here
  than it would on a card-payment store — which is the opposite of the usual advice about footers.
- **Social links: only accounts that exist.** Never invent a handle. A bare platform root is a weak
  link, and an invented handle is a broken promise the merchant has to answer for. No accounts → turn
  the element off.
- **Column count follows the page list**, not the reverse. Three columns of two links read thinner
  than two columns of four.
- **Column order is a decision**, not a default to inherit — the door's own docs page says which
  ordering tokens it honours and which it silently ignores.

### A coloured band needs its own side padding, on phones too

This applies to every design, not only the footer. If a design's card design paints a background that
differs from the page, the text inside it needs that card design's own side padding. The page gutter
will not provide it: the width class pads an outer wrapper, so it moves the whole band away from the
screen edge, not the text away from the band's edge. `codbrand-content-builder` enforces the same rule
for page blocks.

Set the padding for **both** breakpoints: `css_default` for desktop and `css_mobile` for phones.
`css_mobile` wins on phones for every property it declares, so after you change padding in one, read
the other. `handover.mjs` fails any design's card design that paints a background the page does not
have and sets no side padding at either breakpoint.

*Added 21-09-2026: a build gave its footer band `padding:56px 15px 40px 15px` on desktop but left
`css_mobile` at `padding:40px 0px 28px 0px`. The desktop footer looked right, and on phones the text
sat on the grey band's edges.*

## The three surfaces read differently per archetype

Same three surfaces, same fields, opposite answers. The archetype decides, and this is where most of
the judgement in the chrome actually lives.

| | a minimal / premium brand | a high-volume COD store |
|---|---|---|
| **topbar** | often best turned **off** — a filler strip cheapens a restrained brand | usually **on**: it is the only always-visible place to carry the offer, the guarantee, or the delivery promise |
| **header** | few nav items, generous space, the logo doing the talking | more reachable — search and the cart earn their place, and the nav names categories rather than concepts |
| **footer** | short. A brand line, a couple of columns, restraint reads as confidence | the trust surface: contact, delivery and returns visible **without scrolling into a menu**, because the shopper is deciding whether to trust a stranger with cash at their door |

Two things this table is not saying. It is not a licence to leave anything at its default — "off" is a
decision you make and record, "default" is one you did not. And it is not a substitute for a reference
site: if the merchant named one, the measured values win over every row above.

# The page list

## Three tiers, and only one depends on the niche

**System pages** — cart, checkout, thank-you, search. They already exist and belong to the plugin.
You **style** them; you never create them, and their titles are protected.

**Universal** — every store needs these, several for legal reasons rather than design ones:

- **Home** · **About** · **Contact** · **Delivery & Returns** · **Privacy** · **Terms**

**Niche-derived** — the tier where judgement applies:

| niche | add |
|---|---|
| fashion, clothing | size guide |
| beauty, cosmetics, food | ingredients / composition |
| textiles, bedding | care instructions |
| electronics, appliances | warranty, what's in the box |
| supplements, health | how to use, precautions |
| almost everyone | FAQ |

## The third axis: the MARKET, not just the niche

The niche decides what a buyer needs in order to *decide*. The market decides what the store is
*obliged* to carry, and those are different questions with different answers. A cosmetics store in a
market with strict labelling rules needs more in its legal pages than the same catalogue sold
somewhere lax — same niche, same products, different obligations.

`preflight.mjs` has already collected both: `--country` (where the **seller** is) and `--market`
(where the **customer** is). They are separate because **consumer-protection obligations usually
follow the customer**, so collapsing them silently picks the wrong jurisdiction for any cross-border
seller.

**Legal pages are BUILT BY DEFAULT, and the merchant may decline them.** That default is deliberately
different from a plugin feature, which is only OFFERED (`archetypes.md`): a missing size guide is a
missed opportunity, a missing Terms page is a store not fit to trade.

### ⚠️ Guarantee the STRUCTURE. Never author legal ADVICE.

This skill ships to machines nobody can reach and cannot be hot-fixed, and regulation changes. **A
stale legal rule is worse than none**, so no jurisdiction rule is baked in here.

| | where it lives |
|---|---|
| **Stable category expectations** — a cosmetics store has an ingredients surface, an apparel store has a size guide | this file, above |
| **Jurisdiction-specific legal content** | **asked, never asserted.** Create the slot, draft it clearly marked unverified, say plainly what you do not know, and make the merchant confirm it. **"Confirm" does not mean WAIT** — the page is written and published like every other, marked unverified; confirmation is something they owe the page before relying on it, not something the build stops for. |

**Never claim compliance, and never present a draft as legal advice.** Say which market each page was
drafted for, and that a local check is the merchant's to make.

This is the quality gate below, applied harder. That gate says *"a thin, obviously-generic FAQ is
worse than no FAQ — it signals a template store."* **A confidently-worded generic Terms page is
worse than an empty one, because it LOOKS like compliance and is not.**

## COD changes the priorities — do not copy generic e-commerce advice

In a card-payment store, **Delivery & Returns** is boilerplate nobody reads. In a COD store the
customer **pays cash at the door**, so *"how delivery works, what happens if I refuse, who pays
return shipping"* is the single biggest trust page on the site.

Treat it as a first-class page with real content, not a footer link. It is often the difference
between a considered order and a refused parcel.

## The quality gate

**Only create a page you can genuinely fill.**

A thin, obviously-generic FAQ is worse than no FAQ. It signals a template store — which is exactly
what a COD shopper is already suspicious of, because they are being asked to trust a stranger with
cash at their door.

If you cannot fill a page well, either ask the one question that would let you, or leave it out and
say why.

## Where content comes from

**Facts you can derive** — delivery terms, returns window, what the store sells, the categories:
generate freely from the store's own data and the merchant's answers.

**Facts only they have** — why they started, what customers actually ask, who they are: these are the
**optional story questions**. If they answer, About and FAQ become real. If they skip, generate from
niche convention and **tell them plainly that those two pages are generic and worth editing**. Do not
present invented history as if they told it to you.

**Contact has a known limit.** There is no API door for a contact form. Build the page with WhatsApp,
phone and email — the channels a COD merchant actually uses — and keep that section as a **swappable
unit**, so adopting a form later is a local change rather than a rewrite.

## Structuring a page

For each page, decide and record: its **purpose** in one line, its **sections in order**, and **what
each section needs** (a heading, a claim plus evidence, a list, an image).

⚠️ **This applies to EVERY page, not just the home page, and a live build proved it does not happen
by itself.** Measured 20-09-2026: seven authored pages shipped as headings and paragraphs on a plain
card — an FAQ that was a wall of text, no imagery, no sections. Each one is a document, not a page.
A merchant can edit words; they cannot build the layout you skipped, so a prose page hands them the
one job they came here to avoid. **A missing fact is never the reason** — fill it (see SKILL.md →
"Asking") and lay the page out anyway.

Then render that structure as block markup and publish it — see "Rendering it" below. You decide
what the page *says* and in what order; rendering is mechanical once that is settled.

**Two shapes worth knowing:**

- **A landing section pairs a claim with its evidence.** An image beside the text it supports, sides
  alternating down the page — not a wall of text followed by a gallery. An image with nothing to say
  next to it is decoration; either give it a claim or drop it.
- **Product page bodies sit BELOW the plugin's own product UI** — gallery, price, quantity offers,
  add-to-cart are already rendered. So a product body carries **no second hero, no price, and no
  call-to-action button**. It answers the questions the buy box cannot: what it is made of, why it is
  built that way, how to care for it, what people ask before buying.

## Rendering it

**Hand the structure to `codbrand-content-builder`. It renders every page, home included.**

That skill owns block serialization, a house style learned from a corpus of finished pages, and two
validators. It is installed alongside this one and `preflight.mjs` checks for it before any work
starts — so if it is missing you already know, and the answer is to install it, not to work around it.

**Do not write block markup yourself.** An earlier version of this page carried a small "safe"
vocabulary to fall back on. It worked, and it produced visibly worse stores: headings and paragraphs
where the renderer builds layered sections with real composition. Guaranteeing correctness by
narrowing to four block types buys correctness at the price of the thing the merchant is paying for.

### Give it real images, not placeholders

The renderer places whatever assets you hand it. **Generate the photos first, upload them, and pass
the returned URLs**, so it never has to invent a source.

- **Photos** — product shots, hero imagery, anything the page is actually about. You produce them by
  whatever means you have: another skill, a local tool, your own generation, or a source you
  download under a permissive licence. Then `POST /media`, and use the `url` it returns. It also
  returns an `id`, which is what a `wp:image` block wants for its `wp-image-{id}` class.
- **Sourcing an image from the web is allowed. Hotlinking it is not.** With no way to generate one,
  fetch from a permissively-licensed source, download the bytes, upload them, and use the URL the
  upload returns — the same door and the same end state as a merchant emailing you the file. Keep
  each image's licence and its attribution requirement with the blueprint, and prefer sources that
  ask for neither. **Product photos are the exception, and it is not a small one** — next bullet.
- **A product photo is the merchant's real product. Never stock, never a lookalike.** COD is what
  makes this sharper here than on an ordinary store: the customer pays cash *at the door*, so a
  photo of something the box does not contain is not a refund, it is a refusal — the merchant pays
  both freight legs and the sale is gone. Hero, lifestyle, category tiles and backgrounds carry no
  such risk and may be sourced. If you can neither generate nor obtain a true photo of the product,
  **stop and ask the merchant for it**: a build that pauses beats one that ships a stranger's
  product.
- **A store must never ship a hotlinked or placeholder photo, whatever the image's source.**
  `placehold.co` boxes and images pointing at someone else's server are a store that breaks when
  that server does — and they read as unfinished to the one visitor who matters. Every image the
  store renders lives in the store's own media library.
- **Icons are your call.** Inline the SVG yourself, use an icon service, use any tool you like.
  Inlining is the more durable choice, since nothing external can withdraw it; a service is
  perfectly reasonable for small glyphs and avoids filling the media library with them.

**Media is upload-only and dedupes by content hash** — re-uploading identical bytes is free and safe,
but there is no delete, so every iteration on an image stays in the library. Settle on the image
before you upload it.

### The four image invariants — decide them BEFORE you generate anything

`handover.mjs` fails the build on all four, so deciding them afterwards means regenerating and
re-uploading into a library with no delete.

| # | invariant | why |
|---|---|---|
| 1 | **Every product has a featured image** | the listing card, the cart line and every share preview fall back to nothing without it |
| 2 | **Every product has at least 2 gallery images** (4 until 20-09-2026 — see `handover.mjs`) | a product page with one photo reads as a placeholder listing, and a COD shopper being asked to hand over cash at the door is already looking for a reason not to |
| 3 | **One aspect ratio**, matched to the listing's image box | the most visible defect a build can ship, and no status code reveals it — the grid crops each card differently and stops lining up |
| 4 | **One format and one long-edge pixel size** | mixed formats mean mixed compression behaviour; mixed sizes mean different sharpness in one grid |

**Measured on the plugin's own demo store, which is why these are invariants and not advice:** 20/20
products had a featured image, **0/20 had a gallery of four**, seven had none at all, and **20 of 34
images were at mixed aspect ratios** — 1600x1067 beside 1600x2400 beside 1600x960. Every API call
had returned 200 and every page looked plausible in a screenshot.

**The imagery must also belong to the niche.** Product shots are the obvious part; the hero, the
category tiles and any lifestyle image carry the niche's visual language too — lighting, styling,
background, how the product is held or worn. An image that is technically correct and belongs to a
different kind of store is still the generic-template smell the homepage section warns about.

## Homepage

The one page where a COD store earns or loses the visit. It needs, roughly in order: what you sell
and who for, why trust you (delivery, payment on receipt, returns), the products themselves, and
proof — reviews, real photography, real detail.

Avoid the generic-template smell: stock imagery with no relationship to the products, claims with no
specifics, and a hero that says nothing a competitor could not also say.

# Archetypes

The archetype is how a personality answer becomes a palette, a typeface and a spacing scale. It is
the difference between *"here are three colour schemes"* and *"here is the one that fits how you want
your brand to feel, and here is why."*

## Two rules before the list

**The merchant never sees these names.** "Caregiver" and "Ruler" are our vocabulary. Show them and
you have swapped one jargon (palettes) for another. They answer a plain question about how the brand
should feel; you resolve it to an archetype silently.

**This list is meant to change.** Add one when real merchants keep not fitting; drop one that never
gets used. That is why it lives in this file and not in `SKILL.md` — the spine holds the *method*,
this holds the *data*. Editing it must never require touching the skill's logic.

⚠️ Because the list is dynamic, **a blueprint stores the resolved palette and fonts, never just the
archetype name**. Store `"Caregiver"` alone and every old blueprint becomes unreadable the day that
entry is renamed. The archetype belongs in `why`; the colours belong in `value`.

## Where this comes from, and where it does not

The framework is Jung's archetypes as adapted to branding by Mark & Pearson, *The Hero and the
Outlaw* (2001) — an established model that maps personality to visual language, with a **70/30 rule**:
about 70% of the visual signal follows the primary archetype, 30% the secondary.

**The mapping below to design axes and to COD niches is ours, not sourced.** It is a working
hypothesis built from how real stores in these niches actually look. Treat it as revisable; if a
merchant's own site contradicts it, their site wins.

## The six

Chosen for **distinctness**, not coverage. Two archetypes that produce similar-looking stores are not
worth separating. These six differ meaningfully on the axes that actually drive a design — warm/cool,
soft/sharp, serif/sans, dense/airy, muted/saturated.

| archetype | feels | colour | type | space | typical COD store |
|---|---|---|---|---|---|
| **Caregiver** | safe, gentle, looked-after | warm neutrals, muted, one soft accent | humanist sans; rounded | airy | health, baby, parapharmacie, home comfort, bedding |
| **Ruler** | established, premium, in control | dark, high contrast, restrained accent | serif display + clean sans | generous, deliberate | high-ticket, luxury, watches, premium appliances |
| **Lover** | beautiful, intimate, indulgent | rich warm tones, deep neutrals | serif display, elegant | generous | beauty, cosmetics, lingerie, silk, perfume |
| **Everyman** | honest, practical, for everyone | neutral, clear, unfussy | plain sans throughout | denser, functional | value and mass-market — the COD default |
| **Sage** | knowledgeable, careful, proven | cool neutrals, low saturation | clean sans; strong hierarchy | structured | supplements, tech, anything expertise-led |
| **Magician** | transformative, exciting, results | saturated, higher contrast | bold sans, heavy weights | punchy | before/after, weight loss, gadgets — very common in COD |

### Why only six

The other Jung six either collapse into these or barely occur in MENA COD retail:

- **Innocent** → folds into Caregiver (both soft, warm, gentle)
- **Hero** → Magician (results) or Ruler (mastery), depending on the store
- **Explorer · Outlaw · Jester · Creator** → rare enough here that a mapping would be guesswork

Fewer archetypes, each tuned well, beats twelve half-tuned. And the merchant narrows to one with a
couple of plain questions rather than a menu.

## Resolving one

Three inputs, in priority order. **The existing site outranks the niche** when they disagree — a
store already selling something has facts we should not overrule.

1. **Existing site.** Read their current palette, fonts and product imagery. If the brand already
   reads a certain way, start there and say so in `why`.
2. **Niche.** Narrows the field to two or three plausible candidates (see the table).
3. **Their description.** Words like *premium, gentle, cheap and fast, for young mothers, natural*
   pick between the candidates. This is why "tell me about your store" earns its place.

Then **confirm with one plain-language question** between the two front-runners:

> *"Should your store feel more caring and gentle, or more premium and authoritative?"*

Never *"Caregiver or Ruler?"*. Never a palette.

### The secondary, and the 70/30

Pick a secondary only when the primary alone reads flat. Apply it at roughly 30% — accent colour,
micro-copy tone, photography feel — while layout and the primary colour stay with the archetype that
won.

## Which PLUGIN FEATURES this archetype reaches for

An archetype decides more than a palette. It decides what the store *does* — and until this section
existed the skill had no notion that the plugin had commercial features at all, so it never offered
one. Measured on its own twelve files: **zero** mentions of stories, quantity offers, variations,
coupons, countdown, reviews, tracking or quickview. Every storefront it built was a catalogue with a
palette.

**The inventory is NOT here. Ask the install.** `preflight.mjs` prints what `GET /me` returns for
that site — `qty_offers`, `product_variations`, `product_upsells`, `quickview`, `stories`,
`coupons`, `stock_waitlist`, `reviews` and the rest. A capability absent from `/me` is absent from
that install, whatever this file says. **What lives here is only which ones to REACH FOR**, which is
judgement and cannot be derived from a list of resource names.

| archetype | reach for | leave alone unless asked |
|---|---|---|
| **Caregiver** | reviews · stock_waitlist · upsells (refills, bundles) | countdown, aggressive scarcity — it fights the whole personality |
| **Ruler** | variations · quickview · reviews | qty offers, coupons — volume discounting reads as cheap on a premium store |
| **Lover** | variations (shade, size) · stories · quickview · upsells | countdown |
| **Everyman** | qty offers · coupons · upsells · reviews | stories |
| **Sage** | reviews · variations (strength, format) · stock_waitlist | countdown, stories |
| **Magician** | qty offers · countdown · upsells · stories · coupons | — this is the archetype that legitimately uses all of it |

**What you DO with that list depends on `--mode`, and the two are deliberately different:**

| mode | obligation |
|---|---|
| **merchant** | **OFFER.** Propose it in plain words — *"stores like yours usually sell the same product in several sizes; shall I set that up?"* — and let them decline. A feature the merchant will not operate is worse than no feature. |
| **demo** | **BUILD.** Showing the product off IS the job, and an unexercised feature is invisible to whoever is evaluating the plugin. |

⚠️ **Demo mode means everything the ARCHETYPE supports, not everything that exists.** A demo with
every feature switched on is a kitchen sink, not a showcase: a single-product funnel wants qty offers
and a countdown and has no business carrying variations, and a fashion demo is the reverse. The
archetype already decides palette and pages — it decides the feature set the same way.

**Ask only what the merchant alone can know.** This skill's own opening rule is *"Carry the taste for
them. Ask only what they alone can know. Decide everything else."* So never ask *"do you want
quantity offers?"* — that is a decision you carry. Ask the fact you cannot know: *"do you sell the
same product in several sizes or colours?"*, *"do you run promotions?"* — then decide the feature
yourself. A skill that asks about all eight features has handed its job back to the merchant.

## When the merchant named a NICHE and not a site — find three exemplars

A niche used to produce adjectives: *"warm neutrals, muted, one soft accent."* Nothing can fail a
check written like that, so nothing could tell a good result from a drifted one, and a niche build
had no match phase at all.

**So a niche build gets references too.** Find the **three best stores in that niche**, measure all
three with `reference-extraction.md` exactly as you would measure a named reference, and pass all
three to `match.mjs`. They become a **band**, not a target.

**Why three, and why a band:**

- **One** exemplar is somebody's specific brand, and copying it is neither wanted nor legal.
- **Three** describe what the niche actually looks like — where they agree is the convention, where
  they differ is the room you have.
- **A band, never an average.** Averaging three good stores invents a fourth that none of them is,
  and then reports a build that looks exactly like one of the three as a mismatch. `match.mjs` folds
  them for you: unanimous rows become an exact target, numeric spreads become `min..max`, and
  anything else becomes the set of values any of them shipped.
- A property missing from one of the three is **dropped and named**, not guessed at. That the
  exemplars disagree structurally — two have a topbar, one does not — is itself worth knowing.

**Choosing them:** real stores currently trading in that niche, ideally in the same market, chosen
for being *good* rather than for being famous. Say which three you picked and why, in the blueprint.
A later session re-running the match needs the same three or the band moves under it.

⚠️ **Match the measurable style, never the content.** Extraction measures colour, type, spacing and
structure. It never lifts copy, photography or a brand mark. This is the standing rule from the
first build brief this skill was used on — *"design + structure like <site> · do NOT use their
content or images (copyright)"* — and it applies to all three exemplars at once.

**No browser?** Then you cannot measure any of them. Say so, extract what static HTML gives (item
counts, column order, link labels), mark every computed-style row `unmeasurable`, and tell the
merchant which parts went unchecked. An unmeasurable row never counts as a match.

## When nothing fits

Say so, pick the closest, mark it `inferred` in the blueprint, and **write the mismatch into `why`**.

We get no telemetry from this skill — it runs on the merchant's own machine, and adding reporting
would be both a privacy problem and the thing the platform's own guidance flags as risky in
third-party skills. So a recorded mismatch in a merchant's blueprint, surfaced to them, is the only
signal that this list needs a seventh entry. Make it legible.

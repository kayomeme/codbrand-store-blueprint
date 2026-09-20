# The blueprint format

The blueprint is the deliverable. Everything else in this skill either writes it or reads it back.

It is JSON, because that is what the `store_blueprint` door stores. **The merchant never reads the
JSON** — they read a short rendering of it at each decision point. Keep that split in mind: the file
is for the next agent, the rendering is for the person.

⚠️ **What this page describes is the document the door STORES — not the request body you send.** The
document travels *inside* the create request, as one field alongside a couple the door owns. Post it
as the body and it is refused outright, with a `400` naming every key the door did not expect.

Read `GET /docs/store_blueprint` for the request shape before you send one. Same rule as everywhere
else here: ask the API, do not guess around it — see `api-recipes.md`.

## The one rule that shapes everything

**A blueprint records decisions, not instructions.** It says *"the palette is these twenty-six colours,
because the brand reads Caregiver"*. It never says *"call `PATCH /design_controls/color_palette/4`"*.

If you find yourself writing an endpoint into a blueprint, you have crossed the line this whole skill
exists to hold — see `SKILL.md` → "What this skill does not do".

## Shape of the document

This is the value the door stores, not the request — see the warning above.

```jsonc
{
  "schema_version": "1",
  "generated_by":   "codbrand-store-blueprint",

  "decisions": {
    // ... see below. Every entry has the same three-part shape.
  },

  "site":   { /* global token library — ADDITIVE. See "site vs stores". */ },
  "stores": [ { "store_id": 1, /* per-store choices */ } ]
}
```

## A decision

Provenance lives at the **decision** level, not on every value. A decision is something the merchant
could plausibly change on its own — the palette is one decision with twenty-six colours in it, not twenty-six
decisions.

```jsonc
"palette": {
  "status": "inferred",
  "why":    "Caregiver archetype; seed #8B5E3C extracted from the merchant's logo",
  "value":  { "1": "#FBF7F2", "2": "#1F1B17", /* … 26 slots … */ }
}
```

| field | meaning |
|---|---|
| `value` | the resolved decision — real colours, real font names, real page list. Never just `"Caregiver"`. |
| `why` | one sentence, plain language. What it was derived from. This is what makes "logic, not hazard" checkable — and what lets a later run re-derive when an input changes. |
| `status` | `inferred` · `chosen` · `merchant-edited` · `locked` |

### `status`, and why it is the whole re-run story

| status | set when | a later run may… |
|---|---|---|
| `inferred` | the skill derived it; the merchant never named it | re-derive it, **but only** if they answer "restyle" to the one scoping question |
| `chosen` | the merchant actively picked it (the archetype, "make it darker") | never change it without asking |
| `merchant-edited` | it differs from what the blueprint says, so a human changed it by hand | never change it |
| `locked` | the merchant said "leave this alone" | never change it |

**Do not promote `inferred` to `chosen` because a build was accepted.** Silence is not a choice, and
if acceptance promoted everything then `inferred` would only exist between generation and approval —
the field would stop meaning anything and the skill could never improve a store it built.

### `value` must be self-contained

Store the **resolved output**, never only the reasoning that produced it.

```jsonc
// WRONG — unreadable the moment the archetype list changes
"palette": { "value": { "from_archetype": "Caregiver" } }

// RIGHT — the archetype is provenance; the colours are the decision
"palette": { "why": "derived from the Caregiver archetype", "value": { "1": "#FBF7F2", … } }
```

The archetype list is deliberately dynamic (see `archetypes.md`). A blueprint that stored only
`"Caregiver"` would become unreadable the day that archetype is renamed or dropped.

## The decisions

| key | holds |
|---|---|
| `brand_name` | the name as it should appear |
| `niche` | what they sell, in their words |
| `language` | `{ "code": "fr", "script": "latin", "dialect": "Moroccan Darija" }` — see below |
| `market` | ISO country, for currency and delivery conventions |
| `contact` | whatsapp / phone / email — whichever they gave |
| `archetype` | `{ "primary": …, "secondary": … }`, 70/30 |
| `palette` | 26 semantic slots, filled by role |
| `fonts` | `{ "heading": …, "body": … }` |
| `icon_style` | the icon family |
| `density` | spacing/scale character |
| `page_list` | which pages this store needs, and why each |
| `page_structure` | per page: purpose, sections, what each section needs |
| `copy` | the translatable settings keys, in their language |
| `features` | the FEATURE CHECKLIST as they left it — `{ "reviews": "on", "countdown": "off", … }` |

### `features` — record what they UNTICKED, or a re-run re-offers it

The checklist is pre-ticked from the archetype and the merchant corrects it (`archetypes.md` → "The
checklist"). Write the RESULT here, every key, including the ones left ticked.

**Why every key and not just the changes:** a later session cannot tell "they said no to the
countdown" from "the countdown was never offered" unless both are written down. Without this the
re-run proposes a feature the merchant has already declined, which reads as not listening — and it
is the same class of mistake as asking a question whose answer is already on the store.

An `"off"` here is a merchant's decision and outranks the archetype's default on every later run.
They can change it back at any time by saying so.

### `language` carries a script, and it is not decoration

```jsonc
"language": { "value": { "code": "ar", "script": "latin", "dialect": "Moroccan Darija" } }
```

**Reading direction follows the SCRIPT, never the language.** Darija written in Latin letters —
*"ghadi nsiftou lik l'commande"* — is **LTR** even though the language is Arabic; the same dialect in
Arabic script is RTL. Defaulting Arabic → RTL is wrong for the common Moroccan case.

**`code` is chosen by SCRIPT, not by language** — it is what sets WordPress's locale, and that is what
decides reading direction for the whole site. Of the six the plugin accepts, only `ar` is RTL; `en`,
`fr`, `es`, `pt` and `it` are all LTR. So Latin-script Darija takes `fr` or `en`. Picking `ar`
because the language is Arabic ships a mirrored store, and no direction setting overrides it.

`dialect` is free text and is what the copy is actually written in — the plugin has no Darija entry
and does not need one. That split is the point: `code` carries the *script*, `dialect` carries the
*voice*.

## `site` vs `stores`

They behave differently in the plugin, and the blueprint mirrors that rather than trying to fix it.

**`site` is ADDITIVE.** Colours, fonts and presets live in one global library shared by every store.
Adding to it breaks nothing. So `site` says *"these tokens should exist"*, never *"the palette is
this"* — two stores can coexist because each store's settings then *reference* the tokens they want.

**`stores[]` is per store** — which design each surface uses, which pages exist, and the copy.

⚠️ The one way to damage another store is to **redefine a token it already references**. On a fresh
or single-store install, redefining the seeded system tokens is right and tidy. On an install with
more than one store, **add new tokens and point at them** — never edit one another store is using.

## Worked example

Trimmed to two decisions; a real one carries all thirteen.

```jsonc
{
  "schema_version": "1",
  "generated_by": "codbrand-store-blueprint",

  "decisions": {
    "brand_name": {
      "status": "chosen",
      "why": "the merchant gave it",
      "value": "Maison Douce"
    },
    "archetype": {
      "status": "chosen",
      "why": "they answered 'more caring and gentle' when asked how the brand should feel",
      "value": { "primary": "Caregiver", "secondary": "Everyman" }
    },
    "palette": {
      "status": "inferred",
      "why": "Caregiver: warm, soft, muted. Seed #8B5E3C extracted from their logo.",
      "value": { "1": "#FBF7F2", "2": "#1F1B17", "3": "#8B5E3C" }
    }
  },

  "site":   { "palette_tokens": [ { "id": 3, "hex": "#8B5E3C", "action": "add" } ] },
  "stores": [ { "store_id": 1, "pages": ["home", "about", "delivery", "contact"] } ]
}
```

## Size

There is a **2 MB ceiling** on the encoded blueprint, and a **20-character** limit on
`schema_version` — over-long versions are refused, not truncated, because `v1.10` and `v1.11` would
both cut to `v1.1`. A real blueprint is tens to low-hundreds of KB.

## One transport gotcha that loses data

**An empty JSON object comes back as an empty array.** Send `"pages": {}` and you read back
`"pages": []` — WordPress decodes the request body into associative arrays before the API sees it, so
the distinction is gone before anyone can preserve it.

If you then do `blueprint.pages["home"] = {…}` in JavaScript on what is now an array and send it
back, **the page vanishes silently** — `JSON.stringify` drops string keys on arrays.

**Omit a section you have nothing for. Never write `{}`.**

# codbrand-store-blueprint — scripts

The **scripts** for the `codbrand-store-blueprint` skill, which plans and builds a complete
cash-on-delivery storefront on a WordPress site running the COD Leads plugin.

## This is half of a skill, not the whole skill

The skill itself — `SKILL.md` and its `references/` — **ships inside the COD Leads plugin** and is
installed from there. This repository carries only the executable half:

| in this repository | ships with the plugin |
|---|---|
| `scripts/` — preflight, palette, contrast, match, handover | `SKILL.md` — the order of work and the rules |
| | `references/` — archetypes, palette theory, page structure, API recipes |

Both halves use the **same folder layout**, so the contents of this repository drop straight into an
installed skill folder with no renaming and no merge step.

The scripts are deliberately **dependency-free** — they run on bare `node`, with no install step.

## Use the tag, not the default branch

Each tag matches a COD Leads plugin version. An agent reads the store's plugin version from
`/cl-api/v1/me` and fetches the matching tag, so the scripts it runs always match the store they are
inspecting and writing to.

---

*Repository created 19-09-2026. Content lands with the first tagged release.*

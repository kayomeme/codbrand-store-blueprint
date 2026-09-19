# codbrand-store-blueprint — references & scripts

Everything the `codbrand-store-blueprint` skill uses, except its entry point. The skill plans and
builds a complete cash-on-delivery storefront on a WordPress site running the COD Leads plugin.

## This is most of a skill, but not its entry point

`SKILL.md` — the skill's instructions — **ships inside the COD Leads plugin** and is installed from
there. Everything `SKILL.md` refers to lives here:

| in this repository | ships with the plugin |
|---|---|
| `references/` — archetypes, palette theory, page structure, API recipes | `SKILL.md` — the order of work and the rules |
| `scripts/` — preflight, palette, contrast, match, handover | |

The layout matches the installed skill exactly, so the contents of this repository drop straight into
a skill folder with no renaming and no merge step.

The scripts are deliberately **dependency-free** — they run on bare `node`, with no install step.

## Use the tag, not the default branch

Each tag corresponds to a COD Leads plugin version. An agent reads the store's plugin version from
`/cl-api/v1/me` and fetches the matching tag, so the references and scripts it uses always match the
store it is inspecting and writing to.

The default branch may describe doors or behaviour that exist only in a newer plugin. Following it
against an older store produces calls that fail, or markup that validates locally and then does not
render.

---

*Repository created 19-09-2026. Content lands with the first tagged release.*

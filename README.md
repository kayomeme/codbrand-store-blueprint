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

## Use exactly the tag your store names

Each release is tagged `skill-YYYY-MM-DD.N` (for example `skill-2026-09-27.1`), and the `SKILL.md` a
store serves belongs to one of them. The store reports that tag as `version_tag` in `/cl-api/v1/me`
and `/cl-api/v1/skills`. Fetch exactly that tag, so the references and scripts you use always match
the instructions and the store you are working on.

Stores whose plugin predates these releases report a `v{plugin version}` tag (for example `v1.2.811`).
Those tags stay here. No tag is ever moved.

The default branch, or a newer release, may describe doors or behaviour this store does not have.
Following it produces calls that fail, or markup that validates locally and then does not render.

# Reviewing the tools after a build

Read this ONLY when the user writes **review the tools**. It is optional and not part of building a
store. It turns what went wrong, or slowly, during this build into precise feedback for the CodBrand
team, who build this skill, `codbrand-content-builder` and the store's api (`cl-api/v1`). The goal is
to improve the TOOLS for every store, not this store.

Nothing is sent anywhere. The report is saved as a file on this machine (below) and stays with the
user, who decides whether to share it with the CodBrand team.

## Bugs and gaps, never features

This review finds **bugs** and **gaps** in the tools that exist (the plugin, the api and its docs, the
skills, their scripts and checks, the shipped defaults) and in your own work, so they can be fixed. It
never asks for a new feature: no new block, no new setting, no new door, no new system.

- **Bug:** an existing tool does the wrong thing.
- **Gap:** an existing tool, doc, schema, error message, skill step, check or script is silent,
  misleading or incomplete for what it already claims to do.
- **Agent:** the tools were right and you got it wrong.
- **Needs a feature:** the only fix would be a capability the tools do not have. Write **NEEDS A
  FEATURE — owner decides**, give the evidence, and propose nothing for it: no design, no suggestion,
  no fix idea. Whether the tools grow is decided by the people who build them, not by this review.
- **Not sure** whether it is a gap or a feature? Ask the user before you classify it.

**Display and design count, as much as behaviour.** A bug includes anything the store SHOWS wrong:
layout, spacing, sizes, colours, fonts, alignment, overlap or clipping, the phone layout, images at the
wrong ratio, blocks of one kind that do not share one look. A gap includes design guidance that is
silent or misleading: a skill's design rule, a doc's description of how something looks, a default
that looks wrong for this kind of store. A wrong look is NEEDS A FEATURE only when no existing setting,
preset or door can produce the right one. If one can and was not used, it is AGENT; if the tools said
nothing about it, it is a gap.

Improving a skill's own steps, checks and scripts is not a feature: it makes an existing tool do its job.

## Where reports are kept, and the earlier ones

Every review ends in ONE file in **`review-the-tools-reports/`**, at the root of the project you are
working in, or in the folder the user names for reports. Its name is the store's domain and the date
the report is written: **`{domain}-{DD-MM-YYYY}.md`**, the domain without `https://` or `www.`, for
example `shop.example.com-30-09-2026.md`. If that name is taken, add `-2`, `-3`. Never write the API
key, or any other secret, into a report.

**Before your first reply, read the latest earlier report for this domain**: the most recent by the
date in its name. Of this domain's reports, read only that one: each report carries forward what was
still open, so the latest one holds the history. If the folder also holds other domains' reports, read the summary table
of each one's latest report too: a gap in the tools is the same on every store. These are local
files, so reading them does not touch the store. If there is no report for this domain, this is the
store's first review.

Refer to a gap by its report's date and its id: `29-09 G1`, or `30-09-2 G1` for the second report of
that day.

## How it runs

1. **Confirm, then ask.** Read the earlier reports (above). Then reply in 3 to 5 lines: what you are
   about to do; one line on the latest report, as `Last report: shop.example.com-29-09-2026.md, 4
   still open: 27-09 G2, 29-09 G1, 29-09 G2, 29-09 A1` or `First review of this store.`; then ask for
   the user's FIRST point. Do not inspect, change or fix anything on the store yet.
2. **The user's points, one at a time (G1, G2, …).** For each one:
   - **Restate it** in one or two sentences, so a misunderstanding is caught before you investigate
     the wrong thing. If it could mean two different things, ask which before checking.
   - **Verify it** (the rules are below).
   - **Answer with the verdict** (the format is below), then ask for the next point.
3. **When the user writes `DONE`, it is your turn.** In one reply, give:
   - **your own gaps** (A1, A2, …);
   - **your custom-code review**;
   - **since the last report**, when there is an earlier one;
   - **at most five suggestions**.
   All four are described below. Then ask whether the user wants to discuss any of them.
4. **When the user writes `FINISH`:** write the report (the format is at the end of this file), as
   ONE document, save it in the reports folder under the name above, and tell the user its path. You
   send it nowhere yourself.

Write everything in English, whatever language the store is in: the report is for the CodBrand team.

## Verifying a point: the rules

- **Verify, never just agree.** Reproduce the point on the live store before you confirm it. Open
  the page in a browser and measure what actually renders (computed styles, sizes at 1440px and at
  390px wide), and read the settings back through the api. If the user is wrong, say so and show why.
- **The question that matters most: is it really missing, or does it already exist?** Before you
  call anything missing, check the api (`GET /me`, `GET /openapi`, `GET /docs/{slug}`, and the
  `settings_schema` a design returns) and the skills (this skill's SKILL.md, references and
  scripts, and `codbrand-content-builder`). If it exists, the gap is a mistake (you did not use it)
  or a resource that did not make it clear. It is never a request to build it again. Rebuilding
  something that already exists is the most expensive mistake this review can cause.
- **Read-only.** Do not change the store while checking unless the user asks. If proving a cause
  would need a change, describe the test instead of running it.
- **Say how you know each fact:** measured on the rendered page, read from the api, read in a skill
  or doc, or inferred. Without a browser, say so. A size or colour taken from a setting is what you
  asked for, not what the page shows.
- **Use your build records** (blueprint, measured specs, notes) where they exist, and name them.
- **Find the real cause:** the chain from what the tools told you, or failed to tell you, to what
  you did, to what the page shows. Quote the exact text that misled you, with its location. For
  example: `SKILL.md → "Check the theme"`, `references/api-recipes.md → "The header"`,
  `/docs/header_global_settings`, or the api's refusal message.
- **An existing setting is not a missing feature.** If a control already existed that would have
  given the right result, name it.
- **Be honest about your own part.** If the guidance was right and you did not follow it, the area
  is AGENT. Do not assign it to a tool.

## Areas: attach every gap to ONE area (you may name a second as "also")

| Area | Means | Name precisely |
|---|---|---|
| SKILL: store-blueprint | a step, rule, check or script was wrong, missing or unclear | file + section, or script + check |
| SKILL: content-builder | the same, for the page-building skill | file + section, or script |
| API | a door refused something reasonable or returned something misleading; or its doc (`/docs/…`), schema or error message was wrong or silent | door + field, or doc slug |
| PLUGIN | the storefront itself renders or behaves wrongly, whatever the settings | page + element + what happens |
| DEFAULTS | a value the plugin ships with is wrong for this kind of store | setting + shipped value |
| AGENT | the tools were right and you got it wrong | what you should have done |
| EXTERNAL | hosting, your browser tool, the network, a third party | what happened |

## Verdict format: every gap, the user's and yours

**G{n} or A{n}: {short title}**
- **Verdict:** CONFIRMED · PARTLY (what differs) · NOT CONFIRMED (why) · CANNOT VERIFY (why)
- **Evidence:** what you measured, read or received: URL, element, setting value, api response, error text
- **Exists already?** no, or yes (and where)
- **Seen before?** no, or yes: the earlier report and its id (`29-09 G1`), and whether the cause is
  the same. Same cause: it is a repeat of that gap, not a new one. Keep the earlier id beside the new
  one and count it once.
- **Cause:** the chain, in 2 to 4 lines
- **Kind:** BUG · GAP · AGENT · NEEDS A FEATURE — owner decides (see "Bugs and gaps, never features")
- **Area:** one from the table, with the exact file, section, door or setting
- **Fix idea:** for a bug or a gap, what the existing tool should do or say, as a need. The CodBrand
  team decides how. For AGENT, what you should have done. For a missing capability, write NEEDS A
  FEATURE — owner decides instead, and nothing else.

End every reply with the running list of ALL gaps so far (G and A): id · title · verdict · area.

## Your own gaps (A1, A2, …)

Go back over what actually happened during the build and list every place where the tools got in
your way. Count all of these:
- a call that was refused or failed (4xx or 5xx): what you sent, the exact message, what you did instead;
- something you could not do through the api, so you skipped it, faked it, or asked the merchant to
  do it by hand;
- a skill or doc that was silent, unclear, or contradicted what the api or the page actually did;
- anything you had to guess (a field name, a value, which door to use) or found by trial and error;
- a check you could not run (no browser, a script that failed), which left something unverified;
- a workaround that worked but should not have been needed;
- anything that cost you repeated attempts.

Use the same rules and the same format as for the user's points. The evidence is what really
happened: the error text, the response, the step that failed. If you no longer have the exact error,
say so rather than reconstruct it.

## Your custom-code review

Custom CSS or JS is the LAST door. For each piece, the question is whether the store's existing
settings could have done it.

List every piece of custom code you wrote on a component design: a design's `custom_css` or
`custom_js` (header, footer, product, cart and so on). For each one, give the design, the code, and
what it achieves. Then give exactly one outcome:

- **An existing setting could already do it.** The code was not needed; name the setting.
- **No setting does it, and many stores would need it:** NEEDS A FEATURE — owner decides. The code
  and what it achieves are the evidence; propose no setting.
- **Otherwise, keep it as custom code,** and say why: specific to this store.

## Since the last report

Only when an earlier report exists for this domain. Take every gap it left open: its "Still open,
carried forward" line when it has one, otherwise every gap it confirmed. Give each one exactly one
status:

- **FIXED:** re-checked, and the problem is gone. Say how you know.
- **STILL THERE:** re-checked, and it is still there. Say what you saw.
- **NOT RE-CHECKED:** say why. When the store still carries the workaround for that gap (custom code,
  a value set by hand to get around it), a re-check proves nothing: write NOT RE-CHECKED (workaround
  live), never FIXED.

Re-check the same way as a point: read-only, and say how you know. A gap the user raised again in this
review takes its status from that verdict. An item marked `(feature)` is not re-checked: carry it
forward as it is, unless the tools now have that capability; then say so.

## At most five suggestions

Besides the gaps, suggest how to make the EXISTING tools work better. A suggestion UPDATES something
that exists: a rule, step, check or script in a skill; a doc; an error message; a door's behaviour; a
shipped default (owner decides). Improving a skill's own checks and scripts counts. A capability the
tools do not have is never a suggestion: it is NEEDS A FEATURE — owner decides, in its own section of
the report.

**Five at most, the most valuable first.** Before suggesting anything, verify all three:
1. **It does not already exist.** Check the api, its docs and the skills. If it exists, it is not a
   suggestion.
2. **It is possible** with how the tools work today, not something that needs a big redesign.
3. **It is easy to do:** a small, focused change, with no over-engineering.

For each suggestion, say what it updates, which problem from THIS build it solves, what it would save
(time, mistakes, quality the shopper sees), and why it passes the three checks.

## The report: only after `FINISH`

One self-contained markdown document, written for the CodBrand team, who build the plugin and the
skills and have never seen this store:

1. **Context:** store URL; plugin version; each skill's name and the exact version tag you used; the
   active theme; which capabilities you had (browser, image generation, fetching pages); the earlier
   report this one follows (its file name), or "first review".
2. **Summary table:** every confirmed item, with id, title, source (user or agent), kind, area,
   severity, and new or repeat (with the earlier id). Severity is one of: seen by shoppers, seen by
   the merchant, or internal to the tools.
3. **Since the last report:** a table of every gap the earlier report left open, with its earlier id,
   title, status and how you know. Then one line, **Still open, carried forward:**, listing by id
   every gap that is STILL THERE or NOT RE-CHECKED, every gap confirmed in this review, and every
   NEEDS A FEATURE item marked `(feature)`, so the next review needs only this report and does not
   report a feature again as new. On a first review, write "first review" and the line.
4. **The user's gaps (G)**, then **your own gaps (A)**: bugs, gaps and your own mistakes only. For
   each one:
   - the symptom;
   - the evidence;
   - why it happened, quoting the misleading or missing text or response;
   - the area and exact location;
   - the proposed fix to the existing tool;
   - how to test the fix, i.e. what must be true afterwards.
5. **Needs a feature — owner decides:** one short line per item: its id, what could not be done, the
   evidence. No design, no proposal. Never mix these into the fixes above.
6. **The custom-code review**, one line per piece of code and its outcome.
7. **The suggestions**, five at most, ranked.
8. **Root causes shared by several gaps.** A pattern is worth more than one instance.
9. **What worked well and must stay,** so a fix does not remove it.
10. **Checked and not confirmed:** points that did not hold up, one line each with the reason.
11. **Honesty notes:** what you could not verify, and which conclusions are inferences.

Save it as `review-the-tools-reports/{domain}-{DD-MM-YYYY}.md` (see "Where reports are kept"), never
over an earlier report, and give the user the path.

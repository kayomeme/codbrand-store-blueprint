# Reviewing the tools after a build

Read this ONLY when the user writes **review the tools**. It is optional and not part of building a
store. It turns what went wrong, or slowly, during this build into precise feedback for the CodBrand
team, who build this skill, `codbrand-content-builder` and the store's api (`cl-api/v1`). The goal is
to improve the TOOLS for every store, not this store.

Nothing is sent anywhere. The report is saved as a file on this machine (below) and stays with the
user, who decides whether to share it with the CodBrand team.

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
| API | a door was missing, refused something reasonable, or returned something misleading; or its doc (`/docs/…`), schema or error message was wrong or silent | door + field, or doc slug |
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
- **Area:** one from the table, with the exact file, section, door or setting
- **Fix idea:** what the tool should do or say, as a need. The CodBrand team decides how.

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

Custom CSS or JS is the LAST door. Anything common enough should become a normal setting, so the next
build uses the store's own settings instead of code.

List every piece of custom code you wrote on a component design: a design's `custom_css` or
`custom_js` (header, footer, product, cart and so on). For each one, give the design, the code, and
what it achieves. Then give exactly one outcome:

- **An existing setting could already do it.** The code was not needed; name the setting.
- **No setting does it, and one would be simple and useful.** Suggest a new setting, but only when
  it is simple, adds real value, and is something a merchant would reasonably want to set themselves
  in the admin settings. Suggest only; never build.
- **Otherwise, keep it as custom code,** and say why: too specific, or not worth a setting.

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
review takes its status from that verdict.

## At most five suggestions

Besides the gaps, suggest what would make the tools better. A suggestion can:
- **ADD** something the tools do not have, or
- **UPDATE** something that exists but works poorly or is unclear, such as a skill section, a door's
  behaviour, an error message, a script or a check.

**Five at most, the most valuable first.** Before suggesting anything, verify all three:
1. **It does not already exist.** Check the api, its docs and the skills. If it exists, it is not a
   suggestion.
2. **It is possible** with how the tools work today, not something that needs a big redesign.
3. **It is easy to do:** a small, focused change, with no over-engineering.

For each suggestion, say whether it adds or updates, which problem from THIS build it solves, what it
would save (time, mistakes, quality the shopper sees), and why it passes the three checks.

## The report: only after `FINISH`

One self-contained markdown document, written for the CodBrand team, who build the plugin and the
skills and have never seen this store:

1. **Context:** store URL; plugin version; each skill's name and the exact version tag you used; the
   active theme; which capabilities you had (browser, image generation, fetching pages); the earlier
   report this one follows (its file name), or "first review".
2. **Summary table:** every confirmed gap, with id, title, source (user or agent), area,
   severity, and new or repeat (with the earlier id). Severity is one of: seen by shoppers, seen by
   the merchant, or internal to the tools.
3. **Since the last report:** a table of every gap the earlier report left open, with its earlier id,
   title, status and how you know. Then one line, **Still open, carried forward:**, listing by id
   every gap that is STILL THERE or NOT RE-CHECKED, plus every gap confirmed in this review, so the
   next review needs only this report. On a first review, write "first review" and the line.
4. **The user's gaps (G)**, then **your own gaps (A)**. For each gap:
   - the symptom;
   - the evidence;
   - why it happened, quoting the misleading or missing text or response;
   - the area and exact location;
   - the proposed fix;
   - how to test the fix, i.e. what must be true afterwards.
5. **The custom-code review**, one line per piece of code and its outcome.
6. **The suggestions**, five at most, ranked.
7. **Root causes shared by several gaps.** A pattern is worth more than one instance.
8. **What worked well and must stay,** so a fix does not remove it.
9. **Checked and not confirmed:** points that did not hold up, one line each with the reason.
10. **Honesty notes:** what you could not verify, and which conclusions are inferences.

Save it as `review-the-tools-reports/{domain}-{DD-MM-YYYY}.md` (see "Where reports are kept"), never
over an earlier report, and give the user the path.

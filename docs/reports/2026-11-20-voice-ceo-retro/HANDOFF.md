---
report: fabric-voice-ceo-retro
date: 2026-11-20
project: fabric
kind: handoff
---

# Handoff: the voice CEO retro, 2026-11-20

**Objective.** The owner's order (CEO window, 2026-11-20): review the voice agent's calls, fix every defect, add the
missing tools ([the retro](README.md)). Session 9cda1c0f.

**Entry point.** Branch `feat/voice-retro` on `origin`, worktree `~/DATA/_worktrees/fabric-voice-retro`, stacked on
`feat/ceo-board-ux` (session 8343a070). The ledger of fixes, with code and tests per finding: [fixes.md](fixes.md).

## Done

| What | Where |
|---|---|
| The retro copied from the CEO's inbox, private paths made neutral | `a30f3fff`, [README.md](README.md) |
| Findings 1 to 8 and 10 fixed with tests; findings 1 to 7 watched red (6 plants), 8 and 10 not planted | `807276b0`, [fixes.md](fixes.md) |
| Design map entry `#iteration-2026-11-20-voice-retro`, the product model and mockup coverage | `cea84623` |
| 18 project records in caches and temporary folders archived (journal `project.archived@1`, folders untouched) | [fixes.md §5](fixes.md#5-the-project-registry) |
| Two insights for every agent recorded in the agents base (intake `in-20261120-b7433c`, `in-20261120-43edca`) | the base's branch `records/voice-retro-insights` `902c78bf`, handed to the base by board request `b9f814c1` (its `check.py` fails only on the flaky `test_daily_retry`, flaky on its `main` too) |

## Decisions

- Stacked on 8343a070's branch rather than `main`: the same files (`shared/ceoAgent.ts#findProject`, `main/ceoTools.ts#start`)
  carry its fixes of findings 2 and 9. The split was agreed with that session (agent-sync lease `VOICE-RETRO`).
- 8343a070 lands `feat/ceo-board-ux` on `main`; this branch then takes `main` by a merge (so reviewed commits stay
  ancestors) and runs the 0.3.27 release for both (that session's words, 2026-11-20).
- The call journal lives in the CEO's folder (`<userData>/ceo/calls/`), not beside the voice key, so the CEO's
  console reads it; the key's folder stays apart (DA-11 of 0.3.24).
- A message to the owner by voice is delegated to the CEO (`ask_ceo`): the voice holds no messaging credential.
- The worktree-copy projects and the two `research-agent` projects are listed for the owner, not archived: the order
  allowed archiving only records in caches and temporary folders.

## Open

1. Release 0.3.27 per `docs/launch/release-mac.md`: three review iterations (five reviewers each, receipts), the
   verification ledger, the release gate, the tag, the published DMG installed and smoked on this Mac, then a live
   call: a project named by voice, `ceo_reply`, and a file in `<userData>/ceo/calls/`.
2. The owner decides on the worktree-copy projects and the duplicate `research-agent` ([fixes.md §5](fixes.md#5-the-project-registry)).
3. Board request 51d22d2b (the CEO's production version) is wider than this order and is not answered by it.

## Prerequisites

`feat/ceo-board-ux` on `main` (8343a070 sends the commit when it lands).

## Checks actually run

- `node --experimental-strip-types --test apps/desktop/test/voice-retro.test.mjs`: 14 pass.
- `node --experimental-strip-types --test apps/desktop/test/ceo-agent.test.mjs`: 56 pass; `session-enroll`,
  `project-admission`, `automatic-registration-scenario`, `fabric-mcp`, `session-enroll-request`: pass.
- `npx vitest run src/renderer/src/ceo/voiceCall.test.ts`: 13 pass.
- Both `tsc` projects: no error. `check-regions`, `check-private`, `check-docs.sh`, `check-registers`,
  `check-design-map`: pass.
- `bash scripts/ci.sh fast`: see the ledger of the release (the first run failed on stale mockup coverage, rebuilt
  in `cea84623`).

## Since then

`feat/ceo-board-ux` landed on `main` (`37d69d6a`) and this branch merged it; the release of 0.3.27 is under way. Its
ledger is the entry point from here: `docs/evidence/plans/2026-11-20-release-0327-verification.md`.

On 2026-11-20 at 21:37 (the owner's time, as relayed) the owner reported a session's first task and the CEO popup's
messages lost; the home's session fixed it on `fix/delivery-never-drops`, merged before the tag, which reopened review
iteration 3 (runs four and more, each in the ledger). On 2026-11-21 (00:30 as relayed) came
the owner's pause (fabric-workspace session 2d03ce15, brief `2026-11-21-strategic-plan-fable-brief.md`): new features wait for the strategic plan; 0.3.27 carries the voice retro's fixes; by the owner's later words, what `main` took meanwhile (his answer of 2026-11-21, «Выпустить с main») and the voice reading the board (his exception of about 02:10); and, by the agreement between this release's session and the home's, the home's blockers, Inbox's connection among them (CO-614, closed); the ledger `docs/evidence/plans/2026-11-20-release-0327-verification.md` records the sources. The registry fix and Inbox's connection, first held out by that pause, ship in 0.3.27 (CO-614, closed); what the review's runs leave is CO-609, CO-615 and CO-620. The paused
CEO work (access, approval modes, persona, voice, calls) has its own handoff for the strategist on `feat/ceo-persona`:
`docs/reports/2026-11-21-paused-ceo-work-handoff/README.md`.

## Where the release stands (2026-11-21)

The owner answered run seven's question (PL-49) on 2026-11-21: «Выпустить с main». The candidate on `feat/voice-retro`
merges `main` (`5f4dc15b`), the voice reading the board (his exception of about 02:10, `feat/voice-board`) and the
home's blockers agreed to ride this release (`fix/registry-contract` with Inbox's connection, `fix/stack-outage-banner`,
`feat/ceo-window-place`, `fix/ceo-dictation-tail`). `ci.sh fast` on the merge found design-gate gaps in the merged
branches, fixed before review run eight, and prototype and journey gaps fixed after it (`ec06a616`, `3dfc6778`). Run eight (the ledger's run eight) found blocking findings
in what the merge brought: the estate index kept and served text unredacted (DA-49), the CEO's address words still
reached a project and a new folder was refused beside a longer-named one (UX-63, UX-65), the voice could not open a task
by the id it gave (UX-64), and the records did not say what 0.3.27 now carries (PL-53, DO-63 to DO-66). All are fixed in
the next candidate with their tests; run nine reads it.

Run nine (on `ee544e2a`) found 34 findings, 7 blocking, two of them this release's own fixes going wrong (the
redaction of a transcript's saved state, the CEO head's drag); all are fixed with tests in the next candidate, the rest
in CO-620. The home's session then brought two more blockers of the owner (2026-11-21, about 02:40): text copied
between consoles turned to mojibake, and the CEO's board slot lapsed after 60 s (`fix/paste-and-ceo-slot`); this
session takes them into 0.3.27, merged before run ten.

`fix/paste-and-ceo-slot` (`ac46691d`) is merged (`e0b2c55c`); the candidate is `33aec0f4`.

**Paused (2026-11-21, about 03:30, the owner's word through the CEO window).** Every session stops while a reconciling
agent (fabric-workspace session 25879d0f, on Fable 5.2) reconciles the owner's orders of the last hours and sets the
priorities. At the pause: `33aec0f4` committed and pushed; `ci.sh fast` on it and review run ten (five read-only
reviewers on the review worktree) were already running and are left to finish as observation; their output lands in
`~/.cache/fabric-88/ci-33aec0f4.log` and the reviewers' reports, not in the repository. Nothing is released; no tag.

**What run ten found before the pause took hold (observed, not acted on).** The ux, docs and plan reviewers each found
one blocking finding, the same one (UX-81, DO-85, PL-66): the merged CEO wake keeps the person's stop of the CEO only in
memory (`main/ceoAgent.ts`, `held`), so after any restart of Fabric, the 0.3.27 update's own included, a queued
`ceo.task` request starts a CEO the owner stopped; the fix is to keep the stop in the CEO folder's `ceo.json` and test a
restart, in a new candidate read by run eleven. The plan reviewer also found that `origin/main` moved to `608f5416`
(ADR-0205, 03:17) after the candidate, so a fast-forward landing is no longer possible (PL-67). The errors and data
reviewers found the same blocker (ER-87, DA-62; the wake also restarts a failed CEO after a runner's hour), and the
data reviewer found the new `xai-key` rule redacting hyphenated folder and branch names in a transcript's saved state
(DA-64: keep `cwd` and `branch` unredacted, narrow the rule). `ci.sh fast` on `33aec0f4` then ended red: browser suites 25 of
26, `screens-stand.browser.mjs` fails «console ru 1100: a control of the bar is cut» (the console's bottom bar with the
system line of SCN-188 at 1100 px in Russian; the merged candidate's first run to reach the browser suites). It is the
first gate to fix in the next candidate, beside UX-81; log `~/.cache/fabric-88/ci-33aec0f4.log`. The reports are stored with the run in
`docs/evidence/reviews/0.3.27/iteration-3-33aec0f4/`.

**The pause lifted for this release (the reconciler's step 2, A-3, relayed by the CEO).** Release 0.3.27 from the
candidate, the CEO's stop surviving a restart being the blocker before the tag. Done since: `origin/main` (`608f5416`)
merged (`12ab551f`); the stop kept in `ceo.json` and honoured by the board's wake, a failed CEO not woken, a wake
logged by its outcome; the console bar's folder press does not shrink (a name past 20em still cuts, CO-620 (13)) (the screens stand green at 1616 checks); run ten's cheaper
findings fixed and the rest in CO-620.

**Where it stands at the release commit.** Run thirteen read `34e5eecd` (`main` at `65423c42` with schema 103 and its
documents at `cf23801b`, via `de716a0b`), and `ci.sh fast` on it reached its last step (26 of 26 browser suites). Its
one blocking finding was in the records (the schema step said to be automatic) and is fixed in the release commit. The
gate names `34e5eecd` and run thirteen's folder. What the runs leave is CO-609, CO-615, CO-620 and CO-622.

**Next task.**
1. Land the release commit on `main` by fast-forward. If `main` moved by documents only, merge it with the map refreshed;
   by code or a schema step, make a new candidate and run fourteen. Fetch just before landing.
2. Tag `v0.3.27` on the release commit, push it, and watch the release workflow to the published DMG.
3. On the owner's Mac, before 0.3.27 first starts: «Служба доски» off, Fabric quit, a `pg_dump` backup, the rehearsal
   from 102 on a copy (`rehearse-upgrade.mjs`), `supabase migration up --local` in the stack folder, `schema_version()`
   read back as 103; then install with `scripts/install-mac-update.mjs`, start, and turn «Служба доски» on again.
4. On the installed build, check and record: `schema_version()` 103 and the backup; stop the CEO, then «Перезапустить
   Fabric», and see it stopped with a queued `ceo.task` not starting it (a stop pressed under 0.3.26 is not kept through
   the update); Russian pasted and copied between two consoles under «Служба доски»; the CEO's `ceo.task` slot live past
   60 s; a wake on a real queued request.
5. A register commit on `main` right after the tag: CO-620 (15) with run thirteen's ruled findings, `release-mac.md`'s
   0.3.27 paragraph (the schema step is manual) and CO-620 (14)'s stale clause dropped; the map refreshed.
6. One `communicator_notify` to the owner: the release, the schema step done for him, Fabric Inbox allowed at once on
   his machine and connecting itself (revoked in Agent access), the CEO's board slot and wake, ADR-0207 not built in
   0.3.27; tell the CEO and session 8343a070 (`fabric-8b`), which checks `com.directory` and the bot bridge.
7. Then the owner's order of 04:20, CO-622 (the CEO's and the voice's missing tools,
   `docs/evidence/plans/2026-11-21-ceo-voice-missing-tools.md`, for 0.3.28; item 4 is 8343a070's).

## The exact next task (as written before the merge)

When `feat/ceo-board-ux` is on `main`: `git merge origin/main` in the worktree, `bash scripts/ci.sh fast`, then open
review iteration 1 of 0.3.27 on that commit.

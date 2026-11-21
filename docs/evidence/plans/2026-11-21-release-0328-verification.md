# Fabric 0.3.28 release verification

Release gate ledger for 0.3.28 ([the release runbook](../../launch/release-mac.md#how-a-release-is-made), P-02). Three
iterations, five reviewers each (ux, errors, docs, data, plan), every reviewer a fresh context reading the candidate
read-only; findings are disposed here and in the receipts under `docs/evidence/reviews/0.3.28/`.

0.3.28 carries the owner's order of 2026-11-21, relayed by fabric-workspace's reconciler (step A-3, d213194e), verbatim:
«Выпуск 0.3.27 делает 9cda1c0f, ты готовишь 0.3.28 одним поездом из готовых веток». It is the system plan's SD-FAB-01
(fabric-workspace `docs/plans/2026-11-21-system-design/specs/fabric.md`, first date 2026-11-24).

## Protocol

- Baseline: `v0.3.27` (`da6d6620`). The candidate branch is `release/0.3.28`, merged from `v0.3.27` with
  `fix/memory-source-kinds`, `audit/owner-hardcode`, `feat/dock-icon-face` and `refactor/board-operator-door`
  ([the merge log](../../MERGES.md), `RELEASE-0328-TRAIN`).
- Left out, each with its reason (iteration 1, PL-1 to PL-5; the rows are CO-623): `feat/ceo-session-windows` (the
  CEO's windows, the owner's order of 2026-11-19: a feature held under the owner's pause of 2026-11-21, 14 commits not in
  the train), CO-622 (its author, session 9cda1c0f: the next
  release), and the work in progress held by the pause (`feat/ceo-persona`, `feat/ui-kit`, `feat/dispatch-credentials`,
  `feat/record-show`, `feat/pages-wave`, `feat/estate-work-summary`). `feat/ceo-triage` (task a0afb015) is built on
  this train and goes to a later release.
- Taken from `main` before iteration 2 (PL-7): the queue's order (`8cbf93ff`, ADR-0208, migration 131, schema 104),
  which `main` landed after the tag with its own gate run; the release tag must be on `main`, so 0.3.28 carries it.
- Joined for iteration 2 (merged from `feat/approval-modes-0328`, `2d689d34`): `feat/approval-modes` and `feat/ceo-access`. The reconciler's plan puts them in SD-FAB-01
  (fabric-workspace `docs/plans/2026-11-21-system-design/amendments/A-3-owner-orders-audit.md:167`, row 9 of P0: «the
  hardcode audit wave 1, CEO access, approval modes with the behaviour journal»); their author, session 9cda1c0f,
  brought them onto `main` after `v0.3.27` (`78237d65`) with 0.3.27's changes, its `ci.sh fast` green with the browser
  suites 26 of 26 (its messages to this session of 2026-11-21, after iteration 1's PL-2 and at about 09:40). ADR-0207's
  Decision 1 builds on them.
- The reviewers: Claude Code subagents of the release session (Opus 5.5), each a fresh context given
  [the brief](../reviews/0.3.28/brief.md) and its level's focus, reading a separate read-only worktree checked out at the
  candidate, recording HEAD and `git status --short | wc -l` before and after. They ran single test files at most; the
  release session ran the gates.
- A finding is fixed (with its test or check), ruled (with its register id), not a defect (with why), not recoverable,
  or stopped.
- A run's candidate passes `bash scripts/ci.sh fast` with the browser suites run (`FABRIC_PLAYWRIGHT_MODULE` and
  `FABRIC_CHROME` set to the Chromium Playwright keeps, never the owner's Chrome).

## What 0.3.28 carries

The `## 0.3.28 (unreleased)` section of [`CHANGELOG.md`](../../../CHANGELOG.md). One schema step, 103 to 104
(`20261121000131_task_rank.sql`, from `main` at `8cbf93ff`); Fabric refuses a schema-103 database until the runbook's
upgrade runs, as 0.3.27 does for 102.

## CO-625: a signalled stop with live consoles

Found by the 0.3.27 release session (9cda1c0f) when the 0.3.27 install aborted at 08:50 UTC on 2026-11-21: Fabric 0.3.26
ended by SIGTERM with live consoles aborted with SIGABRT on the main thread in `pty.node`
(`Napi::ThreadSafeFunction::CallJS` → `Napi::Error::ThrowAsJavaScriptException` → `std::terminate`, under
`node::FreeEnvironment` → `Environment::RunCleanup` → `CleanupHandles` → `uv_run`; crash reports of 2026-11-21 09:50 and
2026-11-20 13:08 on the owner's Mac), and the board's launch agent started it again six seconds later. A console's exit
reached node-pty's thread-safe function while Node tore its environment down, where JavaScript can no longer run.

Taken into 0.3.28 before iteration 2's reviewers: the quit coordinator settles the consoles after the drain and before
its last `app.quit()` (`main/quit.ts`, option `settle`); `main/ptySettle.ts#settleExits` waits up to 1.5 s for every
exit to reach JavaScript, sends SIGKILL to what still runs and waits 0.7 s more, inside the quit's 10 s deadline, and
says what it did in the ops log (`quit.settle`). Tests: `pty-settle.test.mjs` (five cases) and `quit.test.mjs`
«CO-625 …» (watched red with the settle removed). Not yet proven on a packaged build: the repro (a console open, then
`launchctl kill SIGTERM gui/$UID/ai.passioncode.desktop.board`) runs on the candidate's build before the tag.

## Iteration 1

Candidate `acbff40cab29096a292efd5771aba40a8906af10`. Reports and receipts in
[`docs/evidence/reviews/0.3.28/iteration-1/`](../reviews/0.3.28/iteration-1/). Gate: `ci.sh fast` on the candidate's
tree ran green in three parts before the reviewers (steps 1 to 216 on `0d2db0b5`'s tree before the comment and test
fixes; the rest on the fixed tree); the browser run follows.

52 findings, 2 blocking: a routes file that does not read is replaced by the first choice in Settings (ER-1, also
DA-1 and UX-6), and CHANGELOG's opening named the train's branches wrongly (PL-1). 35 fixed in the iteration-2
candidate, 17 ruled to CO-624. Fixes of code carry a test, except ER-4, ER-7, DO-7 and UX-11 (comments and a stop path,
read, not tested); ER-1, DA-2 and UX-1 were watched red with their mechanism removed. Three reports named the owner's
organizations or a family example; those words are redacted (ADR-0096).

| Row | Finding | Severity | Disposition |
|---|---|---|---|
| V1-UX-1 | UX-1 | non-blocking | fixed: the Dock follows the face only once the look was read without a problem and the person chose a face (renderer/src/launch/dockIcon.ts#dockFollows, persona.tsx `read`); test «dockFollows (0.3.28 review, UX-1, UX-7)» |
| V1-UX-2 | UX-2 | non-blocking | fixed: SCN-126, SCN-170 and SCN-190 amended 2026-11-21 (docs/ux/scenarios.md) for the Dock face, «Куда уходят вопросы» and Memory's own projects |
| V1-UX-3 | UX-3 | non-blocking | ruled: the table dimmed or one line while the switch is off or the stack is shared |
| V1-UX-4 | UX-4 | non-blocking | ruled: an unknown source when the responders were not read |
| V1-UX-5 | UX-5 | non-blocking | ruled: the table's styles and a design pass |
| V1-UX-6 | UX-6 | non-blocking | fixed: the same defect as ER-1: an unreadable routes file is said above the table, its selects disabled, and no choice is saved over it |
| V1-UX-7 | UX-7 | non-blocking | fixed: a face never chosen leaves the bundle's mark in the Dock (dockFollows needs chosen); CHANGELOG and ADR-0100 amendment 3 say it |
| V1-UX-8 | UX-8 | non-blocking | ruled: the corner radius on the macOS grid |
| V1-UX-9 | UX-9 | non-blocking | ruled: the own-row label and the held value |
| V1-UX-10 | UX-10 | non-blocking | ruled: the English strings through the copy check |
| V1-UX-11 | UX-11 | non-blocking | fixed: (a) appIcon.ts#setDockIcon's comment claims only the windows open now on Windows and Linux; (b) CHANGELOG says what a machine without a routes file relies on |
| V1-ER-1 | ER-1 | blocking | fixed: shared/peopleAsk.ts#readRoutesFile tells absent from unreadable; boardCycle.ts setPeopleChoice refuses `routes-file-unreadable`; the view's routesUnread is said in Settings with the selects disabled; tests «tells an absent routes file from one that cannot be read or is not JSON» (red with the ENOENT check removed) and board-cycle «0.3.28 review ER-1» |
| V1-ER-2 | ER-2 | non-blocking | fixed: only ENOENT is absent; any other read error is unreadable and recorded once (people.ask.routes-unread with its code) |
| V1-ER-3 | ER-3 | non-blocking | ruled: one bad route entry dropping every route |
| V1-ER-4 | ER-4 | non-blocking | fixed: dockIcon.ts's catch says a drawing failure in the window is not recorded; recording it is in CO-624 |
| V1-ER-5 | ER-5 | non-blocking | fixed: (a) the half-written dock-icon.png.tmp is removed on a failed write (appIcon.ts#setDockIcon); (b) and (c) are in CO-624 |
| V1-ER-6 | ER-6 | non-blocking | fixed: a malformed escape in the door's name answers 400 bad-door-name (operatorDoor.ts); asserted in operator-door.test.mjs |
| V1-ER-7 | ER-7 | non-blocking | fixed: stop() closes the listener in a finally, logs operatorDoor.withdraw-skipped with the reason, and a failed stop may be asked again (operatorDoor.ts) |
| V1-ER-8 | ER-8 | non-blocking | ruled: the door's default log |
| V1-ER-9 | ER-9 | non-blocking | ruled: the client's timeout naming and Retry-After |
| V1-ER-10 | ER-10 | non-blocking | ruled: check-build-private's unreadable files, --require over reading 3, skipped files |
| V1-ER-11 | ER-11 | non-blocking | ruled: an unreadable PM project's facts said as unread, a wider home-path pattern |
| V1-DO-1 | DO-1 | non-blocking | fixed: CHANGELOG and the runbook's 0.3.28 paragraph say what going back to 0.3.27 does to the Settings choices |
| V1-DO-2 | DO-2 | non-blocking | fixed: CHANGELOG says a PM agent found by its responder still gets questions until a choice, and what a machine without a routes file relies on |
| V1-DO-3 | DO-3 | non-blocking | fixed: docs/launch/release-mac.md: «0.3.28 admits schema 103» with the no-migration receipt, bundle-only both ways, «Служба доски», DO-1's warning |
| V1-DO-4 | DO-4 | non-blocking | fixed: docs/MERGES.md: the two entries say branch only, reached a release through RELEASE-0328-TRAIN |
| V1-DO-5 | DO-5 | non-blocking | fixed: ADR-0100 amendment 3: the running Dock follows the face the person picked; the bundle keeps the mark |
| V1-DO-6 | DO-6 | non-blocking | fixed: the runbook's Dock paragraph and CHANGELOG say: while Fabric runs; a kept tile of a Fabric not running shows the bundle's icon |
| V1-DO-7 | DO-7 | non-blocking | fixed: appIcon.ts header and setDockIcon comments corrected; check-build-private.mjs says three readings |
| V1-DO-8 | DO-8 | non-blocking | fixed: memory spec §15: the directory lives in ceo/people.md, which Fabric never rewrites; the example made neutral |
| V1-DO-9 | DO-9 | non-blocking | fixed: the map's iteration-1 entry links the four branch entries and says the installer part is 0.3.27's |
| V1-DO-10 | DO-10 | non-blocking | fixed: the board-apart plan's W2c.2a row names fe7971f0 and the 0.3.28 train |
| V1-DO-11 | DO-11 | non-blocking | fixed: CHANGELOG names the screen «Облик Fabric», as the interface does |
| V1-DA-1 | DA-1 | non-blocking | fixed: the same defect as ER-1 |
| V1-DA-2 | DA-2 | non-blocking | fixed: withChoice keeps every project entry the file had (test «a choice keeps every project entry…», red with choicesOf restored); the write uses a fresh exclusive temp file, fchmod 0600, fsync, rename |
| V1-DA-3 | DA-3 | non-blocking | ruled: the decoded size bounded and the write synced |
| V1-DA-4 | DA-4 | non-blocking | ruled: a failed start never removing another board's token, before W2c.2b starts the door |
| V1-DA-5 | DA-5 | non-blocking | ruled: the slot and projects-root defaults read from settings; CHANGELOG now says the check reads literal strings |
| V1-DA-6 | DA-6 | non-blocking | ruled: neutral names in test fixtures; the gate's own comment made neutral in this candidate |
| V1-PL-1 | PL-1 | blocking | fixed: CHANGELOG's opening names what the train carries and what it leaves out, each reason in the ledger's protocol |
| V1-PL-2 | PL-2 | non-blocking | fixed: session 9cda1c0f brings feat/approval-modes and feat/ceo-access into iteration 2 by A-3:167 (row 9 of P0); the ledger's protocol cites both sources |
| V1-PL-3 | PL-3 | non-blocking | fixed: feat/ceo-session-windows is named as a feature held under the pause (ledger, CO-623 part 1) |
| V1-PL-4 | PL-4 | non-blocking | fixed: feat/task-rank's reason is its migration 130 and the gate run it needs (ledger, CO-623 part 2) |
| V1-PL-5 | PL-5 | non-blocking | fixed: the ledger's protocol names every unmerged branch with its reason; feat/ceo-triage is this session's and is rebased onto the final train |
| V1-PL-6 | PL-6 | non-blocking | ruled: the SD-FAB-01 report to fabric-workspace on the board |
| V1-PL-7 | PL-7 | non-blocking | fixed: origin/main merged into release/0.3.28 before the iteration-2 candidate |
| V1-PL-8 | PL-8 | non-blocking | fixed: the brief and docs/evidence/plans/2026-11-21-release-0328-verification.md committed; the gate's inputs are written at the release commit |
| V1-PL-9 | PL-9 | non-blocking | fixed: CO-623 (what 0.3.28 leaves out, CO-606's target) and CO-624 (iteration 1's ruled findings) in lane 12; the general plan's Now line names 0.3.28 |
| V1-PL-10 | PL-10 | non-blocking | ruled: the build check in the release procedure |
| V1-PL-11 | PL-11 | non-blocking | fixed: ADR-0100 amendment 3 |
| V1-PL-12 | PL-12 | non-blocking | fixed: MERGES says 0.3.27's side was kept at the conflict, then rebuilt for the dock branch's token |
| V1-PL-13 | PL-13 | non-blocking | fixed: the memory spec's example made neutral; the reports that quoted it redacted (ADR-0096) |

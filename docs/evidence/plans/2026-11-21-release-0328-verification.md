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
  the train), CO-622's items 3, 4 and 6 to 11 (its author, session 9cda1c0f: after 0.3.28;
  items 1, 2 and 5 came with `main`, below), and the work in progress held by the pause (`feat/ceo-persona`, `feat/ui-kit`, `feat/dispatch-credentials`,
  `feat/record-show`, `feat/pages-wave`, `feat/estate-work-summary`). `feat/ceo-triage` (task a0afb015) is built on
  this train and goes to a later release.
- Shipped earlier, so not in this train: the Inbox registry fix of A-3 row 9 (in 0.3.27, its CHANGELOG «Agents reach
  Fabric Inbox again»). Left for a later release: the CEO console pinned first on Агенты (A-3's addendum, board task
  `2de5eff4`, «the 0.3.28 train if it is small»: not built when the train was cut; iteration 2, PL-20).
- Taken from `main` before iteration 2 (PL-7): the queue's order (`8cbf93ff`, ADR-0208, migration 131, schema 104),
  which `main` landed after the tag with its own gate run; the release tag must be on `main`, so 0.3.28 carries it.
- Joined for iteration 2 (merged from `feat/approval-modes-0328`, `2d689d34`): `feat/approval-modes` and `feat/ceo-access`. The reconciler's plan puts them in SD-FAB-01
  (fabric-workspace `docs/plans/2026-11-21-system-design/amendments/A-3-owner-orders-audit.md:167`, row 9 of P0: «the
  hardcode audit wave 1, CEO access, approval modes with the behaviour journal»); their author, session 9cda1c0f,
  brought them, with 0.3.27's changes, onto a branch cut from `main`'s tip `8cbf93ff` after the tag (they reach `main`
  for the first time with this release), its `ci.sh fast` green with the browser
  suites 26 of 26 (its messages to this session of 2026-11-21, after iteration 1's PL-2 and at about 09:40). ADR-0207's
  Decision 1 builds on them.
- Joined for iteration 3 (iteration 3, PL-25, DO-26): CO-626's fix (`63b58ef5`, `scripts/install-mac-update.mjs` and
  `scripts/lib/install-mac-update.mjs#swapProbe`, `install-mac-update.test.mjs` 11 of 11), from the 0.3.27 install of
  2026-11-21, whose row the 0.3.27 release session (fabric-9e) asked to have written in this candidate; and `main` at
  `fe8961f1` by the merge `01d3a2d5` (`RELEASE-0328-MAIN-2`), which brought CO-622's items 1, 2 and 5 (`0140eb8b`: the
  CEO's model and effort at a start, `fabric_ceo_session_model`, `fabric_ceo_session_last_reply` and `_wait_reply`, the
  board on the CEO's console), the system plan's rows and the session feed spec (`ab9ea5e1`). The release tag must sit
  on `main`, so the train carries what `main` took. The merge's conflict resolutions in `ceoTools.ts`, `pty.ts`,
  `hubPorts.ts` and `index.ts` were read by iteration 3's ux, errors and data reviewers (their reports name the start's
  account and model, the model flags with extras, and the board wiring), and `swapProbe` by its errors and data
  reviewers. Iteration 2's reports went into the CO-626 commit and its receipts and dispositions into the merge
  (PL-31): the gate reads them by hash; from iteration 3 on, review records are committed in their own commit.
- From the iteration-3 candidate to the tag, `main` takes nothing outside the files the release gate allows after
  `verifiedCommit` (iteration 2, PL-16): before tagging, `git diff --name-only <verifiedCommit> origin/main` must name only
  those.
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
«CO-625 …» (watched red with the settle removed). Iteration 2 bounded the drain so the settle always runs (ER-13). The proof on a packaged build is a post-tag check on the
installed 0.3.28, since this Mac's disk keeps local builds off (the sentry's line): three consoles (an idle shell, one
ignoring SIGTERM with `trap '' TERM HUP; sleep 600`, one agent), then `launchctl kill SIGTERM
gui/$UID/ai.passioncode.desktop.board`; no new `Fabric-*.ips`, no `app.started` within 60 s, `quit.settle` in the ops log.
Before the check, `launchctl print gui/$UID/ai.passioncode.desktop.board` must show the bundle's own agent (its
`BundleProgram`, `KeepAlive` with `SuccessfulExit` false), not the stand-in job of the 0.3.27 install, which would keep
launchd from starting Fabric again whether or not it aborted; the exit status is recorded with the result (iteration 3,
PL-30). Iteration 3 tied the drain's bound to the settle's (`QUIT_SETTLE_BUDGET_MS` is 1.5 s, 0.7 s and 0.8 s to end,
3 s; ER-31). CO-625 stays open until it is recorded (iteration 2, PL-17).

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

Iteration 1's browser run: `ci.sh fast` with both browser variables (Playwright's Chromium) ran green on the
iteration-2 candidate's tree (26 browser suites), recorded below.

Exit for iteration 1: 52 findings, 35 fixed, 17 ruled to CO-624. Blocking findings open: none.

## Iteration 2

Candidate `618551f73bd0ca272b3f2884ae33872607b1297d`: iteration 1's fixes, `main` at `8cbf93ff` (the queue's order, schema 104), `feat/approval-modes-0328`
(`2d689d34`) and CO-625's settle. Reports and receipts in
[`docs/evidence/reviews/0.3.28/iteration-2/`](../reviews/0.3.28/iteration-2/). Gate: `bash scripts/ci.sh fast` on
`618551f7` with `FABRIC_PLAYWRIGHT_MODULE` and `FABRIC_CHROME` (Playwright's Chromium) ran to its last step green,
browser suites 26 of 26 (the run's environment set `LANG`/`LC_ALL=en_US.UTF-8` and Homebrew first on `PATH`: a resumed
session's empty `LANG` stops `initdb`, and the system `python3` has no `jsonschema`).

49 findings, 6 blocking rows for four defects (several levels found the same one): the approval mode
could not be switched (UX-12, DO-12, PL-14), a waiting task moved to no effect (UX-13), an unreadable routes file still
sent questions (ER-12, with UX-16), and the runbook's step 4 read 103 (DO-13). 35 fixed in the iteration-3 candidate,
14 ruled to CO-627. Fixes of code carry a test except ER-14, ER-18 and ER-20 (a kill path, a catch and a cleanup, read,
not tested); UX-13's drop, ER-12's skip and ER-13's race were watched red with their mechanism removed.

| Row | Finding | Severity | Disposition |
|---|---|---|---|
| V2-UX-12 | UX-12 | blocking | fixed: the owner sees and switches the mode in Settings, «Что ждёт вашего одобрения» (SettingsScreen.tsx#ApprovalModeSetting); test «shows the five approval modes…»; ADR-0203 amendment 1 |
| V2-UX-13 | UX-13 | blocking | fixed: KanbanBoard.tsx#orderMoveAllowed: a waiting card does not move above a ready one, nor a ready one below a waiting one; the buttons are disabled with launch.kanban.order.waitsFirst, a drop across the line is not taken; tests «orderMoveAllowed» and the rewritten move and drop tests, the drop watched red with the guard removed |
| V2-UX-14 | UX-14 | non-blocking | ruled: the «Место задали вы» pill only on the card the owner moved |
| V2-UX-15 | UX-15 | non-blocking | fixed: «Принять» shows only where the queue can be moved (mayOrder); «Отклонить» stays; asserted in the every-project test |
| V2-UX-16 | UX-16 | non-blocking | fixed: the same defect as ER-12: while the routes file does not read nothing is sent, and the Settings line says so |
| V2-UX-17 | UX-17 | non-blocking | ruled: the first run's look step counts as a pick; say it or store an explicit pick |
| V2-UX-18 | UX-18 | non-blocking | ruled: the launch menu's choice of account comes later |
| V2-UX-19 | UX-19 | non-blocking | ruled: the voice's own short approval rule and session_journal in its instructions |
| V2-UX-20 | UX-20 | non-blocking | ruled: scenarios for the approval mode, the journal and SCN-183/184 amendments |
| V2-ER-12 | ER-12 | blocking | fixed: peopleAskRun.ts: routesUnread skips every item ('routes-unread'); boardCycle passes the file's state; test «0.3.28 review ER-12…», watched red with the skip removed; CHANGELOG and the Settings line say it |
| V2-ER-13 | ER-13 | non-blocking | fixed: quit.ts: the drain is raced against hardDeadlineMs minus QUIT_SETTLE_BUDGET_MS (2.5 s), then the settle runs; test «CO-625, ER-13…», watched red with the race removed |
| V2-ER-14 | ER-14 | non-blocking | fixed: PtyManager#pendingExits ends a console through platform.ts#killPty; the settle's catch says a refused kill is counted in left |
| V2-ER-15 | ER-15 | non-blocking | ruled: the mode's grant issued before the policy decides; mode grants told apart from the owner's |
| V2-ER-16 | ER-16 | non-blocking | ruled: rank writes in one batch, capped queues refused, UUIDs checked at the door |
| V2-ER-17 | ER-17 | non-blocking | ruled: a failed Switchboard group read said as unread, the call shape aligned |
| V2-ER-18 | ER-18 | non-blocking | fixed: (1) index.ts's settle records a failure as quit.settle; (2) to (5) are in CO-627 |
| V2-ER-19 | ER-19 | non-blocking | ruled: a caller that hangs up mid-body recorded as a refusal, before W2c.2b starts the door |
| V2-ER-20 | ER-20 | non-blocking | fixed: setPeopleChoice removes its temp file when the write, sync or rename fails |
| V2-DO-12 | DO-12 | blocking | fixed: the same as UX-12; CHANGELOG says where the mode is switched |
| V2-DO-13 | DO-13 | blocking | fixed: release-mac.md step 4: «103 for 0.3.27, 104 after» |
| V2-DO-14 | DO-14 | non-blocking | fixed: ADR-0203's register row, the next-free text corrected, ADR-0203 amendment 1, pointers appended to ADR-0028 and ADR-0050 |
| V2-DO-15 | DO-15 | non-blocking | fixed: the settle now always runs (ER-13); CHANGELOG states the bound and that the packaged proof is recorded in the ledger |
| V2-DO-16 | DO-16 | non-blocking | fixed: CO-625's row (landed on main by 8b9712b3, merged before iteration 3) brought up to date, in lane 12, next free id moved |
| V2-DO-17 | DO-17 | non-blocking | fixed: AGENTS.md: behaviour/ and dock-icon.png in the userData/ceo row, the settle in the PTY row, the routes file written by Settings in the people-ask row |
| V2-DO-18 | DO-18 | non-blocking | fixed: the runbook's 0.3.28 paragraph: two columns and an index on project_tasks, the feed sentences the app's own, migration 130's archive admission, one wording for 102 |
| V2-DO-19 | DO-19 | non-blocking | fixed: the runbook and CHANGELOG say going back drops the approval mode |
| V2-DO-20 | DO-20 | non-blocking | fixed: the ledger says the approval branch was cut from main's tip 8cbf93ff and reaches main with the release |
| V2-DO-21 | DO-21 | non-blocking | fixed: ADR-0100 amendment 3 and CHANGELOG: on Windows and Linux the open windows take the face until they close or Fabric restarts |
| V2-DO-22 | DO-22 | non-blocking | fixed: MERGES: RELEASE-0328-MAIN for 3d60a362, with the note that two «not in it» items joined later |
| V2-DO-23 | DO-23 | non-blocking | fixed: CHANGELOG's opening names the CO-625 fix; the ledger has iteration 2 with its candidate and gate run |
| V2-DA-7 | DA-7 | non-blocking | fixed: ceoTools.ts#accountName: the CEO and its voice say the name before «@» and get account_id; the account is chosen by id; ceo-access test updated |
| V2-DA-8 | DA-8 | non-blocking | fixed: the switch exists in Settings (UX-12); recording each change of mode is in CO-627 |
| V2-DA-9 | DA-9 | non-blocking | ruled: a byte bound for the behaviour journal |
| V2-DA-10 | DA-10 | non-blocking | ruled: one drag writing many events, not atomically |
| V2-DA-11 | DA-11 | non-blocking | ruled: the projector's range check on rank in a later migration |
| V2-DA-12 | DA-12 | non-blocking | ruled: apply_task_rank matched by project too, in a later migration |
| V2-DA-13 | DA-13 | non-blocking | fixed: the same as ER-20 |
| V2-DA-14 | DA-14 | non-blocking | fixed: the landed migration is not edited; the runbook names migration 130's archive admission |
| V2-DA-15 | DA-15 | non-blocking | ruled: the no-loss way back from 104 measured on a copy |
| V2-PL-14 | PL-14 | blocking | fixed: the same as UX-12 |
| V2-PL-15 | PL-15 | non-blocking | fixed: the main merge before iteration 3 put CO-625 in lane 12, updated its row, ordered the rows, moved the next free id and recounted |
| V2-PL-16 | PL-16 | non-blocking | fixed: docs/system-plan-rows landed on main before the iteration-3 merge of main; the ledger's protocol says main takes nothing outside the allowed list until the tag |
| V2-PL-17 | PL-17 | non-blocking | fixed: the ledger's CO-625 section records the packaged proof as a post-tag check on the installed 0.3.28 (three consoles, one ignoring TERM), and CO-625 stays open until it |
| V2-PL-18 | PL-18 | non-blocking | fixed: the runbook's 0.3.28 paragraph: stopping the old build with consoles open meets CO-625, bootout with the stand-in job, the broker held, the release session runs the step |
| V2-PL-19 | PL-19 | non-blocking | fixed: the SD-FAB-01 report to fabric-workspace is part of the release close; PL-6 taken out of CO-624 |
| V2-PL-20 | PL-20 | non-blocking | fixed: the ledger's protocol: the Inbox registry fix shipped in 0.3.27; the CEO console pinned first is left for a later release |
| V2-PL-21 | PL-21 | non-blocking | fixed: the same as DO-20 and DO-14 |
| V2-PL-22 | PL-22 | non-blocking | fixed: CO-623's due column and its held branches with owner and reason; the next free id |
| V2-PL-23 | PL-23 | non-blocking | fixed: the ledger gains iteration 1's exit line and the gate runs of 618551f7 and the iteration-3 candidate; the release commit writes version, the gate file and CHANGELOG's heading |

Exit for iteration 2: 49 findings, 35 fixed, 14 ruled to CO-627. Blocking findings open: none.

## Iteration 3

### Run one, 666d0fdd (superseded)

Candidate `666d0fdd295502d2ed0e2a82569b97f8a372ecf6`: iteration 2's fixes, CO-626's fix and `main` at `fe8961f1`.
Five reviewers, one per level; their reports and receipts are in
[`docs/evidence/reviews/0.3.28/iteration-3-666d0fdd/`](../reviews/0.3.28/iteration-3-666d0fdd/) (kept as the record; not
this iteration's receipts). They read `~/DATA/_worktrees/fabric-0328` itself at `666d0fdd`, read-only (HEAD and dirty
count the same before and after in all five), since the disk sentry refused the packages a separate checkout needs.
Gate: `ci.sh fast` with the browser variables ran green through its pure tests while the reviewers read; the release
session stopped it when the findings came in, because the fixes were written in the same worktree, so it gave no
verdict on this candidate.

48 findings, 6 blocking rows for three defects: CO-622's items 1, 2 and 5 ship and the notes said they did not (UX-21,
DO-24, PL-24, DA-17); account labels, mail addresses, still reached the voice in three refusals (DA-16, with ER-30 and
UX-25); the runbook forbade a launchd install and recommended one (DO-25, with PL-27 and DA-21). Also fixed: the
installer's zip moved between its last running check and the swap (ER-21, UX-32, DA-20), a cut zip could take the way
back's name (ER-22, DA-19), and `/model` could press Enter on a permission prompt (UX-23). 44 fixed in the run-two
candidate (UX-25 and UX-26 in part, their other parts ruled), 3 ruled to CO-628 (UX-24, UX-29, UX-30), 1 not a defect
for this release (PL-31). Tests watched red with their mechanism removed: DA-16's refusals, UX-23's prompt guard,
UX-31's active-project filter, UX-28's proposal guard.

| Row | Finding | Severity | Disposition |
|---|---|---|---|
| V3-UX-21 | UX-21 | blocking | fixed in the run-two candidate: CHANGELOG names CO-622's items 1, 2 and 5 in its opening and in three bullets (model and effort, answers from the transcript, the board on the CEO's console); the protocol says what joined |
| V3-UX-22 | UX-22 | non-blocking | fixed: the refusal on the CEO's own console names `settings.json` (`ceoModels`), not Settings (`ceoTools.ts` `model`) |
| V3-UX-23 | UX-23 | non-blocking | fixed: `/model` types nothing while `shared/consolePrompt.ts#promptOnScreen` reads a question on the screen, and the voice's use counts against its inputs into the console (`voiceInputOver`); test «/model types nothing while the console waits at a question», red with the guard removed |
| V3-UX-24 | UX-24 | non-blocking | ruled to CO-628: `applied` means the flag was passed; reading the model back is later work |
| V3-UX-25 | UX-25 | non-blocking | fixed in parts 1 and 2 (with DA-16): refusals and their choices say «name@…» with the id, the field asks for the id, and «work@…» finds its account again (`launchChoice.ts#findAccount`); part 3, two accounts with one name, ruled to CO-628 |
| V3-UX-26 | UX-26 | non-blocking | fixed in part 1: the ready card's «Ниже» has its own reason, `launch.kanban.order.readyFirst` (the text check's reports `317c1448` and `ee1a8ee1`, no findings); part 2, a focusable reason, ruled to CO-628 |
| V3-UX-27 | UX-27 | non-blocking | fixed: a card across the waiting line takes no drop and shows no drop cursor (`KanbanBoard.tsx` `onDragOver`) |
| V3-UX-28 | UX-28 | non-blocking | fixed: «Принять» shows only where the proposed place keeps ready tasks first (`KanbanBoard.tsx#proposalAllowed`); tests «proposalAllowed» and «a proposal that would put a waiting task before a ready one can only be declined», red with the guard removed |
| V3-UX-29 | UX-29 | non-blocking | ruled to CO-628: the routes table while the file does not read |
| V3-UX-30 | UX-30 | non-blocking | ruled to CO-628: the approval panel's wording |
| V3-UX-31 | UX-31 | non-blocking | fixed (with ER-26, DA-22): the summary counts the open tasks of the active projects only and says no id; without the projects it is said as unread; test «the board summary counts …», red with the filter removed |
| V3-UX-32 | UX-32 | non-blocking | fixed with ER-21 |
| V3-ER-21 | ER-21 | non-blocking | fixed: Fabric is looked for again right after the zip and before the first rename; source pin «ER-21, ER-22 …» in `install-mac-update.test.mjs` |
| V3-ER-22 | ER-22 | non-blocking | fixed (with DA-19): the zip is written to `<zip>.partial`, checked with `unzip -tq`, then renamed; a failure removes it and the stage and says nothing was changed; `--tidy` checks a zip already there before it removes a copy (`install-mac-update.mjs#writeZip`, `zipReads`) |
| V3-ER-23 | ER-23 | non-blocking | fixed: a target folder this run created is removed when it stops before the swap, and only the refusal that moved nothing says «nothing was changed» (`swapProbe`); test «ER-23 …» |
| V3-ER-24 | ER-24 | non-blocking | fixed: a dry run says the swap probe is not run there |
| V3-ER-25 | ER-25 | non-blocking | fixed: the undo after a bundle that does not verify is read back like the first, and a failed one says where both copies are |
| V3-ER-26 | ER-26 | non-blocking | fixed: `OPEN_READ` is the gateway's 1 000, so «at least» is said when it is met; the read is ordered and the summary keeps the active projects (with UX-31) |
| V3-ER-27 | ER-27 | non-blocking | fixed: a failed requests read is said by its error's message (`index.ts`, region voice-board-reads) |
| V3-ER-28 | ER-28 | non-blocking | fixed: the waiting requests' projects are said by name; the test's fixture passes ids |
| V3-ER-29 | ER-29 | non-blocking | fixed: the CEO console's board door records `ceo.board` with the tool and outcome, and the catches' comments name both ops |
| V3-ER-30 | ER-30 | non-blocking | fixed with DA-16 |
| V3-ER-31 | ER-31 | non-blocking | fixed: `QUIT_SETTLE_BUDGET_MS` is `SETTLE_GRACE_MS` + `SETTLE_KILL_MS` + 800 ms (3 s); test «ER-31 …» |
| V3-DO-24 | DO-24 | blocking | fixed with UX-21; the CO-625 clause names the defect it fixes, and CO-626 is in the opening |
| V3-DO-25 | DO-25 | blocking | fixed: `--schedule` refuses at once with the App Management reason; the runbook's example and step 3, the script's header and its refusal hint name `--wait` from Terminal; test «DO-25 …» |
| V3-DO-26 | DO-26 | non-blocking | fixed: the protocol's «Joined for iteration 3»; the run-two candidate's gate is recorded in its section |
| V3-DO-27 | DO-27 | non-blocking | fixed: CO-622's row says which items ship in 0.3.28 and that the rest follow |
| V3-DO-28 | DO-28 | non-blocking | fixed: the runbook's steps follow the code (the running check and the probe, the checked zip, the second check, the swap with its checked undos) |
| V3-DO-29 | DO-29 | non-blocking | fixed: the `userData/ceo` row reads «since 0.3.28 `behaviour/` …; since 0.3.27 `calls/`», and `userData/dock-icon.png` has its own row |
| V3-DO-30 | DO-30 | non-blocking | fixed: the next-free note says CO-623 and CO-624's rows are above and drops the second CO-621 clause |
| V3-DO-31 | DO-31 | non-blocking | fixed: the permissions comment is back above `AgentPermissionsSetting` |
| V3-DO-32 | DO-32 | non-blocking | fixed: the schema paragraph uses the runbook's wording, the CO-625 bullet says the proof is checked after the release, and the approval bullets have their lead sentence |
| V3-DO-33 | DO-33 | non-blocking | fixed: `RELEASE-0328-MAIN-2` names its merge commit |
| V3-DA-16 | DA-16 | blocking | fixed: every refusal of `accountFor` says «name@…», its choices are `{account, id}`, and the ambiguous list carries accounts, not labels; test G1 asserts no `@example.com` in any of the three refusals by voice, red with the mapping removed |
| V3-DA-17 | DA-17 | blocking | fixed with UX-21; the transcript reads by voice are named in their bullet |
| V3-DA-18 | DA-18 | non-blocking | fixed: a `/model` typed but not read back is journalled `done` with its state, the model, effort and account asked are in the act's reason, and the ops line's outcome follows the state; test «/model types nothing …» |
| V3-DA-19 | DA-19 | non-blocking | fixed with ER-22 |
| V3-DA-20 | DA-20 | non-blocking | fixed with ER-21 |
| V3-DA-21 | DA-21 | non-blocking | fixed with DO-25 |
| V3-DA-22 | DA-22 | non-blocking | fixed with UX-31 |
| V3-PL-24 | PL-24 | blocking | fixed with UX-21 |
| V3-PL-25 | PL-25 | non-blocking | fixed: the protocol names both joins and which reviewers read the merge's resolutions and `swapProbe` |
| V3-PL-26 | PL-26 | non-blocking | fixed: `docs/co-626`'s author (fabric-9e) retired the branch on this session's ask: deleted from origin, archived as `refs/archive/2026-11-21/docs-co-626` = `9b4a1d80`, no force (this candidate writes CO-626's row); before tagging, `git log <verifiedCommit>..origin/main` must be empty (the release close) |
| V3-PL-27 | PL-27 | non-blocking | fixed with DO-25, in the candidate rather than after the tag |
| V3-PL-28 | PL-28 | non-blocking | fixed: the release close below |
| V3-PL-29 | PL-29 | non-blocking | fixed with DO-32 |
| V3-PL-30 | PL-30 | non-blocking | fixed: the CO-625 section asks for the label's own agent before the check |
| V3-PL-31 | PL-31 | non-blocking | not a defect for this release: the gate reads the records by hash; said in the protocol, and run two's records are committed on their own |

## Release close

Done by the release session (fabric-dd) after the tag, each step with its receipt here (iteration 3, PL-28):

1. Before tagging: `git fetch`, then `git log <verifiedCommit>..origin/main` empty and `git diff --name-only
   <verifiedCommit> origin/main` naming only the files the gate allows (PL-16, PL-26). Then the tag `v0.3.28`, the
   release run watched to success, the published DMG's guard read back.
2. Install on the owner's Mac from a Terminal session outside Fabric that has App Management permission, with `--wait`
   (CO-626). When no agent session holds that permission, that is a human gate: say it with the exact command.
3. The schema step 103 to 104, before 0.3.28 starts: a backup, 0.3.27 stopped as the runbook's 0.3.28 paragraph says
   (`launchctl bootout`, the lifecycle broker's target held, no Fabric process and no connection to the database left),
   `supabase migration up --local`, `schema_version()` read back as 104.
4. CO-625's proof on the installed 0.3.28 (the section above), with the label's own agent checked first (PL-30).
5. CO-626's proof: the install of step 2 completes, and `/Applications/Fabric.app` holds 0.3.28 with a signature that
   verifies.
6. SD-FAB-01's report on the board to fabric-workspace (iteration 2, PL-19): each acceptance item of
   `docs/plans/2026-11-21-system-design/specs/fabric.md` in fabric-workspace mapped to 0.3.27's or 0.3.28's evidence,
   naming that the four branches the item lists shipped in 0.3.27.
7. On `main` after the tag: the CO-622, CO-625 and CO-626 rows' states, SD-FAB-01 and the Now line, the workspace
   publication (`node scripts/workspace.mjs sync`) and the knowledge base's product page.

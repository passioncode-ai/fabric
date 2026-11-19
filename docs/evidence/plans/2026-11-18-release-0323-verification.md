# Fabric 0.3.23 release verification

Release gate ledger for 0.3.23 ([the release runbook](../../launch/release-mac.md#how-a-release-is-made), P-02).
Three iterations, five reviewers each (ux, errors, docs, data, plan), every reviewer a fresh context reading the
candidate read-only; findings are disposed here and in the receipts under `docs/evidence/reviews/0.3.23/`.

0.3.23 carries what landed on `main` after 0.3.22 (`661bcf45`): the full-disk repair of CO-594, ADR-0195's waves W1,
W2b and W2c.1a (the board's hub as a process of its own), the board dispatcher waiting for a free Switchboard session
slot, the people-ask bridge's fixes, «Служба доски» starting the new version after an update, and the console and page
layout fixes of task `a832e3ad`. Task `3ff9a3e2` on the board.

## Protocol

- Baseline: `661bcf45`, 0.3.22's release commit (tag `v0.3.22`). The reviewers read the candidate's checkout without
  writing in it and record HEAD and `git status --short | wc -l` before and after.
- Tests are run by file under `nice -n 10`, one run at a time; a timing test that fails once is rerun alone before it is
  called a defect (the machine ran at a load between 60 and 155 during this review).
- The review copies are redacted for publication (ADR-0096): no home path, secret or private name is in them.
- A finding is fixed (with its test or check), ruled (with its register id), not a defect (with why), not recoverable,
  or stopped.
- A run's candidate passes `bash scripts/ci.sh fast` before its reviewers start; a load flake in a file the release does
  not touch is rerun alone twice, then the gate is rerun (the 0.3.22 protocol).
- A candidate becomes `verifiedCommit` only after a full hosted `ci` run reads green on it, or on a commit whose
  difference to it is documents only.

## What 0.3.23 carries

The `## 0.3.23` section of [`CHANGELOG.md`](../../../CHANGELOG.md) names every person-visible change.

## Iteration 1

Candidate `22403642f28ff666c723486a8fb12c8d56f3d94c` (`main` at 2026-11-18, `bash scripts/ci.sh fast` green on it). Five reviewers, one per level; their
reports and receipts are in `docs/evidence/reviews/0.3.23/iteration-1/`.

38 findings, 5 blocking (UX-1, ER-1, DO-1, DA-1, PL-1), three distinct defects: `scripts/ci.sh` had lost its executable bit,
so hosted `ci` could not run it and the release guard could not pass (DO-1, PL-1); the dispatcher's capacity hold ignored
Switchboard's board share and held board runs Switchboard would admit (ER-1, DA-1); the disk notice said Fabric had
stopped its database also when the database fell by itself on a nearly full disk (UX-1). All three, and most of the
rest, were fixed in iteration 1's wave (`cb1a453a`); two test fixes for the loaded machine followed (`53476a4d`,
`8e18964d`), the last of them candidate 2. Every new test was watched failing on the old code.

| Row | Finding | Severity | Defect | Disposition |
|---|---|---|---|---|
| V1-1 | UX-1 | blocking | The disk-hold notice tells the person «Fabric stopped its local database ... its data is kept» and «starts it again once more than 3.5 GB are free» also when Fa … | fixed in iteration 1's wave (`cb1a453a`, candidate 2 `8e18964d`): StackHealthNotice.tsx splits diskStopped from self-down; stopForDisk sets state.diskStopped only after the stop resolves; hubRefusalFor second sentence; test stack-watch.test.mjs UX-1, ER-4 |
| V1-2 | UX-2 | non-blocking | The Russian disk-hold sentence reads wrongly: «и так полный диск её не повредит» is parsed as «the already full disk will not damage it anyway», not «so a full … | fixed in iteration 1's wave (`cb1a453a`, candidate 2 `8e18964d`): i18n/ru.ts stack.health.diskHold rewritten |
| V1-3 | UX-3 | non-blocking | Under a disk hold the notice says three partly contradictory things: the title «База данных Fabric не отвечает» (it was stopped on purpose), then `stack.health. … | fixed in iteration 1's wave (`cb1a453a`, candidate 2 `8e18964d`): StackHealthNotice.tsx own title diskStoppedTitle, diskCause omitted when diskStopped |
| V1-4 | UX-4 | non-blocking | For up to two watch reads (about 60 s) after Fabric stops its database for the disk, the window shows only the ordinary low-disk warning and agents get raw data … | fixed in iteration 1's wave (`cb1a453a`, candidate 2 `8e18964d`): main/stackWatch.ts stopForDisk then: diskStoppedState + publish at once |
| V1-5 | UX-5 | non-blocking | A failed disk stop is said only in the operations log; the person sees an ordinary low-disk warning («освободите место в ближайшее время») while the database ke … | fixed in iteration 1's wave (`cb1a453a`, candidate 2 `8e18964d`): stop retried 3 times with back-off (shared/stackWatch.ts DISK_STOP_ATTEMPTS, main/stackWatch.ts diskStopNow); notice after giving up remains a warning, see UX-10 |
| V1-6 | UX-6 | non-blocking | While «Новая сессия» only checks who works in the project, its label already says «Запускаем…»; when the check finds someone, nothing starts, yet the button sai … | fixed in iteration 1's wave (`cb1a453a`, candidate 2 `8e18964d`): SessionWindow.tsx phase checking/starting; label Запускаем only for starting |
| V1-7 | UX-7 | non-blocking | «Подождать» and «Всё равно запустить» remove the note and the pressed button, so keyboard focus drops to the document body in the console's bar. | fixed in iteration 1's wave (`cb1a453a`, candidate 2 `8e18964d`): onWait returns focus to button.current |
| V1-8 | UX-8 | non-blocking | The console's own scenario was not amended: SCN-172 step 6 still says «Новая сессия» starts the same agent at once, and its UI elements and states do not list t … | fixed in iteration 1's wave (`cb1a453a`, candidate 2 `8e18964d`): scenarios.md SCN-172 step 6, UI elements, states amended |
| V1-9 | UX-9 | non-blocking | The disk-hold strings carry the recovery mark as a literal («3.5 GB», «3,5 ГБ») while the code derives it from `DISK_RECOVERED_BYTES = LOW_DISK_BYTES + 5e8`; a … | fixed in iteration 1's wave (`cb1a453a`, candidate 2 `8e18964d`): {mark} placeholder from view.diskMarkBytes via freeDiskGb in en.ts and ru.ts |
| V1-10 | ER-1 | blocking | The dispatcher's capacity hold ignores Switchboard's board share, so board runs Switchboard would admit are held while interactive sessions fill the cap. The ch … | fixed in iteration 1's wave (`cb1a453a`, candidate 2 `8e18964d`): apps/desktop/src/main/boardDispatchRun.ts#capacityHolds (boardAdmitted decides when a boolean, else used >= cap); boardDispatchWiring.ts capacity() maps data.board_admitted; tests in test/board-dispatch-run.test.mjs (145 pass) |
| V1-11 | ER-2 | non-blocking | The capacity read fails silently and is said wrongly. `.catch(() => null)` drops every failure (an older Switchboard without `capacity`, a control timeout, garb … | fixed in iteration 1's wave (`cb1a453a`, candidate 2 `8e18964d`): boardDispatchRun.ts heldByCapacity: read lazily once a pass only when a decision reaches launch, failure said once as 'unknown' starts:'unread' (never 'resumed'), 10 s deadline in boardDispatchWiring.ts capacity() |
| V1-12 | ER-3 | non-blocking | The `deadline_passed` skip is keyed by the last record, not by the request. For an inbox item `last` is the project's newest inbox record of any message, so one … | fixed in iteration 1's wave (`cb1a453a`, candidate 2 `8e18964d`): boardDispatchRun.ts deadline_passed skip now scoped: mine.some(requestId === req.id && refused deadline_passed && (!req.resume \|\| r.resume === req.resume.releasedAt)); comment says no Switchboard sends it yet |
| V1-13 | ER-4 | non-blocking | A failed disk stop is never tried again and later holds a start Fabric never owed. `stoppedForDisk` is set before `supabase stop` resolves and is cleared only b … | fixed in iteration 1's wave (`cb1a453a`, candidate 2 `8e18964d`): apps/desktop/src/main/stackWatch.ts: diskStopping promise tracked, tick skips tryRecover while it runs, failures retried DISK_STOP_ATTEMPTS=3 with DISK_STOP_BACKOFF, diskStopped set in state only after the stop ended; stack-watch tests (21 pass) and stackWatch.test.ts (37 pass) |
| V1-14 | ER-5 | non-blocking | The launch path does not read the critical floor. At under 1 GB every Fabric start (and launchd's start at login) runs `supabase start`, so the database writes … | fixed in iteration 1's wave (`cb1a453a`, candidate 2 `8e18964d`): apps/desktop/src/main/env.ts#diskRefusal read at the top of startStackOnce (launch, retry, heal, watch try); shared/stackWatch.ts#startRefusedForDisk; startupHeals accepts DISK_START_REFUSAL, verified by classifying the message (cause unknown, heals true) |
| V1-15 | ER-6 | non-blocking | A malformed answer is now silent. `blocks()` drops a fenced block that does not parse as JSON, so a PM reply whose `fabric-people-answer/1` block has a JSON err … | fixed in iteration 1's wave (`cb1a453a`, candidate 2 `8e18964d`): shared/peopleAsk.ts#hasAnswerBlock now true when the text names fabric-people-answer or holds an untagged/json fence, so a malformed block reaches parseAnswer and gets the refusal; peopleAsk.test.ts 22 pass, people-ask-run 22 pass |
| V1-16 | ER-7 | non-blocking | The board entry's failed start skips its own quit. Once `startBoardHub` has published the hub (`hub.json`, door token, registry watch), a later throw goes to `m … | fixed in iteration 1's wave (`cb1a453a`, candidate 2 `8e18964d`): boardMain.ts startBoardProcess try/catch calls quit.release() (runs stops and shutdown, withdraws hub.json) before rethrow; BoardQuit.release added; board-main.test.mjs 11 pass |
| V1-17 | DO-1 | blocking | scripts/ci.sh lost its executable bit (100755 to 100644 in 0d81cc39); hosted ci runs ./scripts/ci.sh, so it exits 126 before any test and the release guard (ci. … | fixed in iteration 1's wave (`cb1a453a`, candidate 2 `8e18964d`): git ls-files -s scripts/ci.sh = 100755; no mode change in v0.3.22..HEAD |
| V1-18 | DO-2 | non-blocking | AGENTS.md Lifecycle row for the board dispatcher describes a run only for a project with no live session; since c60edfeb a request or inbox item beside a live s … | fixed in iteration 1's wave (`cb1a453a`, candidate 2 `8e18964d`): AGENTS.md:174 names LIVE_SESSION_TAKE_MS hold and keptByLiveSession |
| V1-19 | DO-3 | non-blocking | On-demand spec §3.8 step 1 and the comment above decideDispatch's live-session line still say no second agent starts beside a live session | fixed in iteration 1's wave (`cb1a453a`, candidate 2 `8e18964d`): on-demand spec :386-387; shared/boardDispatch.ts:158-161 |
| V1-20 | DO-4 | non-blocking | AGENTS.md people-ask row omits the ask-once-more (ASK_ATTEMPTS 2, 'Нужны вы, ещё раз') and the 'снят:' line in the thread; bridge spec §6 failure list omits peo … | fixed in iteration 1's wave (`cb1a453a`, candidate 2 `8e18964d`): AGENTS.md:175 ASK_ATTEMPTS, ещё раз, снят; bridge spec :178 people.ask.withdrawn |
| V1-21 | DO-5 | non-blocking | Board-apart plan wave table stale: W2a.3 cites 82064f51 (not in the candidate's history; landed 50c79ce4); W2a.4 and W2c.1a say 'composed on refactor/...' thoug … | fixed in iteration 1's wave (`cb1a453a`, candidate 2 `8e18964d`): plan rows :88-91 landed shas, BoardState members, stack watch in index.ts until W2c.1b |
| V1-22 | DO-6 | non-blocking | On-demand spec §3.14 names main/board.ts#startBoard(ports, deps) and says boardMain.ts starts startBoard; shipped are startBoardHub and boardCycle.ts#startBoard … | fixed in iteration 1's wave (`cb1a453a`, candidate 2 `8e18964d`): on-demand spec :698-701 As built; :650 five |
| V1-23 | DO-7 | non-blocking | Carry-over row CO-545 says the rest of W2a, W2c and W2d remain; the candidate ships W2a.3, W2a.4 and W2c.1a | fixed in iteration 1's wave (`cb1a453a`, candidate 2 `8e18964d`): carryover :560 W2a done, W2c.1a landed, remainder named |
| V1-24 | DO-8 | non-blocking | Capacity bullet and spec §3.5 say a start at the cap is refused at_capacity and Fabric holds every run at used >= cap; the installed Switchboard admits board ru … | fixed in iteration 1's wave (`cb1a453a`, candidate 2 `8e18964d`): boardDispatchRun.ts#capacityHolds; CHANGELOG, spec §3.5, AGENTS.md agree on board_admitted |
| V1-25 | DO-9 | non-blocking | CO-422 design counts 136 ACTIVE_ESTATE uses in main/index.ts; the candidate has 108 | fixed in iteration 1's wave (`cb1a453a`, candidate 2 `8e18964d`): contexts-beside-personal.md:16 names commit and 108/12/19 split |
| V1-26 | DA-1 | blocking | The capacity gate holds every board dispatch whenever used >= cap and ignores Switchboard's board share: Switchboard admits a board start at a full pool while b … | fixed in iteration 1's wave (`cb1a453a`, candidate 2 `8e18964d`): boardDispatchRun.ts#capacityHolds uses board_admitted when named, used>=cap only when absent; boardDispatchWiring.ts reads board_admitted; board-dispatch-run.test.mjs 145 pass |
| V1-27 | DA-2 | non-blocking | At the cap the pass returns before the request loop, so to-operator, no-folder and past-due handling stop too; starting records are retried above the gate and r … | fixed in iteration 1's wave (`cb1a453a`, candidate 2 `8e18964d`): hold applied only at the launch path via heldByCapacity(); pass no longer returns before the loop; refusalCheck maps at_capacity to deferred-cap |
| V1-28 | DA-3 | non-blocking | A PM reply whose answer block does not parse (bad JSON, fence not tagged json, redacted body) is taken as a note, marked handled and never judged; the PM side g … | fixed in iteration 1's wave (`cb1a453a`, candidate 2 `8e18964d`): peopleAsk.ts#hasAnswerBlock true for schema name or untagged/json fence, so malformed attempts reach parseAnswer; CHANGELOG lines 71-72 |
| V1-29 | DA-4 | non-blocking | The disk floor is enforced only by the runtime watch: the launch's startStack runs with no disk check, and stoppedForDisk is in memory, so after a restart the s … | ruled: CO-594 (every stack start now waits under 1 GB, `env.ts#startStackOnce`; the 3.5 GB mark is per process and the CHANGELOG says a restarted Fabric waits for 1 GB) |
| V1-30 | DA-5 | non-blocking | deadline_passed handling answers a refusal Switchboard does not emit; the CHANGELOG entry for task e8facb06 describes behaviour no installed Switchboard can tri … | ruled: CO-596 (no installed Switchboard sends `deadline_passed` yet, 0.7.117; the CHANGELOG says so and the guard is scoped to its own request) |
| V1-31 | DA-6 | non-blocking | switchboard --json capacity runs every 30 s pass under the 60 s CLI deadline before any request is due, so a slow Switchboard stalls each pass and an idle board … | fixed in iteration 1's wave (`cb1a453a`, candidate 2 `8e18964d`): capacity read once per pass at the first launch decision (capacityOnce), 10 s deadline in boardDispatchWiring.ts; unread pool holds nothing and is logged once |
| V1-32 | PL-1 | blocking | scripts/ci.sh lost its executable bit (0d81cc39), so hosted ci cannot run ./scripts/ci.sh and the release guard (needs ci.yml green on the tag's commit) cannot … | fixed in iteration 1's wave (`cb1a453a`, candidate 2 `8e18964d`): git ls-files -s scripts/ci.sh = 100755; git diff --summary v0.3.22..HEAD has no mode change. Hosted ci on the new head not readable offline (PL-8). |
| V1-33 | PL-2 | non-blocking | W2a.4 reported landed but its plan exit check is partly met: no tests of wireBoardDispatch, the session holds factory or one cycle pass (only the latter two car … | fixed in iteration 1's wave (`cb1a453a`, candidate 2 `8e18964d`): docs/evidence/plans/2026-11-17-board-apart-waves.md rows W2a.3/W2a.4/W2c.1a say landed with 50c79ce4/205d7bd8/22403642; wireBoardDispatch, holds factory, cycle pass tests and the stack watch move carried to W2c.1b with exit check. |
| V1-34 | PL-3 | non-blocking | CO-545 register row is stale: it says the rest of W2a, W2c and W2d remain, while W2a.3, W2a.4 and W2c.1a land in this release. | fixed in iteration 1's wave (`cb1a453a`, candidate 2 `8e18964d`): CO-545 row names the three landed steps and commits; W2c.1b, W2c.2, W2d remain. |
| V1-35 | PL-4 | non-blocking | CO-594 half done, undone half not named as left: no free-space floor before the stack starts (launch, Retry, restart, launchd restart all run supabase start on … | fixed in iteration 1's wave (`cb1a453a`, candidate 2 `8e18964d`): CO-594 Done lists the floor before every start (main/env.ts#diskRefusal, shared/stackWatch.ts#startRefusedForDisk); Left names the in-memory 3.5 GB mark, journal growth, container logs; CHANGELOG states it; stack-watch 21 pass. |
| V1-36 | PL-5 | non-blocking | After the section 3.2 change (a run starts beside a live session that did not take the request within 10 minutes after the grace) the Settings switch and help, … | fixed in iteration 1's wave (`cb1a453a`, candidate 2 `8e18964d`): ru.ts:297/300 and en.ts settings.dispatchHelp say two minutes without a session, twelve with one; AGENTS.md dispatcher row names LIVE_SESSION_TAKE_MS and keptByLiveSession; boardDispatch.ts:160 comment rewritten. |
| V1-37 | PL-6 | non-blocking | CO-591 (decision verifier door) is dated 'build in the release after 0.3.22' (this release), is not built and was not re-ruled. | ruled: CO-591 (re-ruled 2026-11-18: built with W2c of ADR-0195; 0.3.23 lands W2c.1a only) |
| V1-38 | PL-7 | non-blocking | The CHANGELOG bullet for the PM agent's progress note does not name its board task d048b422. | fixed in iteration 1's wave (`cb1a453a`, candidate 2 `8e18964d`): CHANGELOG bullet names board task d048b422. |

Exit for iteration 1: every finding disposed above. Blocking findings open: none.

## Iteration 2

Candidate `8e18964d40ec58c22059ebf7d91062fee6491566` (`bash scripts/ci.sh fast` green on it, 2026-11-18). Five reviewers in fresh contexts, each reviewing
the candidate and then iteration 1's dispositions; reports and receipts in `docs/evidence/reviews/0.3.23/iteration-2/`.

8 findings, 0 blocking. Every one was fixed in iteration 2's wave, candidate 3 (`f056b3b6`): the board's quit
waits for its release at most to a deadline (ER-8); an untagged fence counts as an answer only when it parses as a JSON
object (ER-9, DA-7); a stack already running under 1 GB starts nothing and says so (ER-10); a third failed stop is said
to the person (UX-10); SCN-147 and SCN-180 carry the twelve-minute rule and the shipped label (UX-11); a new gate keeps
`scripts/ci.sh` executable (PL-8); the reconciliation test holds under load (PL-9).

| Row | Finding | Severity | Defect | Disposition |
|---|---|---|---|---|
| V2-1 | UX-10 | non-blocking | After three failed protective stops the person is told nothing: the notice stays the ordinary low-disk warning while the database keeps writing; only the operat … | fixed in iteration 2's wave (candidate 3 `f056b3b6`): main/stackWatch.ts give-up branch sets diskStopFailed and publishes; shared/stackWatch.ts:388 view; StackHealthNotice.tsx:87-92 sentence; en.ts:1107, ru.ts:387; cleared on recovery above floor and on a stop that ended; test in StackHealthNotice.test.tsx |
| V2-2 | UX-11 | non-blocking | docs/ux/scenarios.md SCN-180 (line 3819) says a board start happens with no open session; the Settings help now says two minutes with no open session and twelve … | fixed in iteration 2's wave (candidate 3 `f056b3b6`): docs/ux/scenarios.md SCN-147 and SCN-180 amended 2026-11-18 with the twelve-minute rule and shipped label; en.ts:1008,1011 match; product-model.json regenerated |
| V2-3 | ER-8 | non-blocking | BoardQuit.release (the failed-start cleanup added for ER-7) has no deadline and no forced exit. If the surface's shutdown never settles, the awaited release in … | fixed in iteration 2's wave (candidate 3 `f056b3b6`): apps/desktop/src/main/boardMain.ts release(): shutdown raced against deadlineMs with unref'd timer, board.quit-deadline logged, timer cleared in finally; board-main tests 12 pass |
| V2-4 | ER-9 | non-blocking | hasAnswerBlock now treats any untagged fenced block (for example a stack trace or log excerpt in a PM responder's progress note) as an answer attempt. Such a no … | fixed in iteration 2's wave (candidate 3 `f056b3b6`): apps/desktop/src/shared/peopleAsk.ts#hasAnswerBlock: untagged fence counts only when its content parses as a JSON object; peopleAsk tests and people-ask-run 22 pass |
| V2-5 | ER-10 | non-blocking | The launch-time disk refusal also fires when the stack is already running healthy (it is kept up between launches by design) and the disk is under 1 GB: Fabric … | fixed in iteration 2's wave (candidate 3 `f056b3b6`): apps/desktop/src/main/env.ts#diskPlan + shared/stackWatch.ts#diskStartPlan: running stack skipped under the floor; Docker error/hang (10 s timeout) maps to unknown and refuses; partial/stopped/absent refuse |
| V2-6 | DA-7 | non-blocking | hasAnswerBlock treats any untagged or json fence as an answer attempt, so a PM note quoting an ordinary untagged code block gets 'не применено' once per such me … | fixed in iteration 2's wave (candidate 3 `f056b3b6`): peopleAsk.ts#hasAnswerBlock: untagged fence counts only when its content parses as a JSON object; peopleAsk.test.ts and stackWatch.test.ts 64 pass |
| V2-7 | PL-8 | non-blocking | Nothing keeps scripts/ci.sh executable: the check half of PL-1's fix was not done, and the fix is not read on hosted ci yet; the release guard needs hosted ci g … | fixed in iteration 2's wave (candidate 3 `f056b3b6`): scripts/check-script-modes.mjs + scripts/lib/script-modes.mjs, wired at scripts/ci.sh:77-78; exit 0; script-modes.test.mjs 3 pass. Hosted ci on the final head not readable offline (ledger item). |
| V2-8 | PL-9 | non-blocking | test/resource-reconciliation.test.mjs 'timed-out release stays unknown; late completion never mutates returned result or cursor' is still load-sensitive (finish … | fixed in iteration 2's wave (candidate 3 `f056b3b6`): resource-reconciliation.test.mjs timed-out release case re-sets up when the sweep ran out early, with a planted slow first read variant; 38 pass in two runs at load about 60. |

Exit for iteration 2: every finding disposed above. Blocking findings open: none.

## Iteration 3

Candidate `f056b3b650341a703c0c9702ba7cde631ed91a1e`, the `verifiedCommit`. Five reviewers in fresh contexts, each reviewing the candidate and then
iterations 1 and 2's dispositions; reports and receipts in `docs/evidence/reviews/0.3.23/iteration-3/`. Every iteration-2
finding read fixed. 4 new findings, none blocking; they are ruled to CO-596, a row filed on `main` after the tag
(the carry-over ledger is outside the files the gate allows after `verifiedCommit`), with DA-5 of iteration 1.

| Row | Finding | Severity | Defect | Disposition |
|---|---|---|---|---|
| V3-1 | UX-12 | non-blocking | The CO-594 scenario bullet does not record the iteration-2 behaviour: the warning after a third failed stop, and that a launch on a disk under 1 GB with the sta … | ruled: CO-596 (the 0.3.23 review's iteration-3 leftovers, its row filed after the tag) |
| V3-2 | ER-11 | non-blocking | Under the disk floor each held start adds up to 10 s of docker ps when Docker is slow; a partial stack under the floor is refused with wording saying it starts … | ruled: CO-596 (the 0.3.23 review's iteration-3 leftovers, its row filed after the tag) |
| V3-3 | ER-12 | non-blocking | An untagged fence holding any JSON object (a quoted JSON log line) counts as an answer attempt, so that note gets one refusal; bounded by ASK_ATTEMPTS. | ruled: CO-596 (the 0.3.23 review's iteration-3 leftovers, its row filed after the tag) |
| V3-4 | ER-13 | non-blocking | The retried resource-reconciliation test leaves up to 19 never-resolved release promises from discarded fixtures; test process only, relies on --test-force-exit … | ruled: CO-596 (the 0.3.23 review's iteration-3 leftovers, its row filed after the tag) |

Exit for iteration 3: every finding disposed above. Blocking findings open: none.

## Release close

What is owed around the tag, in order; each item is checked off here with its receipt.

0. Before the release commit: one full hosted `ci` run green on `verifiedCommit` (`f056b3b6`), and `bash scripts/ci.sh
   fast` green on it.
0b. The release commit (the version, `## 0.3.23`, `docs/launch/release-gate.json`, the review receipts, a new top map
   lane, the MERGES entry), `node scripts/release-mac.mjs --check-only --tag v0.3.23`, and its landing on `main` by
   fast-forward.
0c. On `main` after the tag: the CO-596 row (UX-12, ER-11 to ER-13, DA-5 of iteration 1) in the carry-over ledger.
1. The CI release run green on every platform, the published release and its notes from `## 0.3.23`.
2. Install 0.3.23 on this Mac by [the runbook](../../launch/release-mac.md#upgrading-an-existing-database) (no schema
   step: schema 102 as in 0.3.22), through the lifecycle broker; board task `3ff9a3e2` moved to review.
3. The Mac Studio by its host agent, asked on the board.

Receipt for 0 (2026-11-18): the push run of `ci` on `f056b3b6` read its fast job green; the full job runs only on dispatch
or the nightly schedule, so [run 44413219961](https://github.com/passioncode-ai/fabric/actions/runs/44413219961), dispatched
on `cf834842`, whose difference to `f056b3b6` is documents only (the receipts, this ledger, the gate, the version, CHANGELOG,
MERGES, the map), read green in both the fast job and the full job with a disposable stack. `bash scripts/ci.sh fast` exit 0
on `f056b3b6` and on `cf834842`.
Receipt for 0b: the release commit `817f2a6e` and the map's redaction entry `cf834842` (the pre-push private-text check
found a private agent's name in iteration 1's plan report; the name was replaced and its receipt's hash recomputed);
`node scripts/release-mac.mjs --check-only --tag v0.3.23` «its release gate is clear»; landed on `main` by fast-forward
(`22403642..cf834842`), tag `v0.3.23` pushed 2026-11-18 23:22 UTC.
Receipt for 0c: this commit carries the CO-596 row.

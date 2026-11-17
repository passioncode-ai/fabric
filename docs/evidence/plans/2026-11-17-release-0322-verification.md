# Fabric 0.3.22 release verification

Release gate ledger for 0.3.22 ([the release runbook](../../launch/release-mac.md#how-a-release-is-made), P-02).
Three iterations, five reviewers each (ux, errors, docs, data, plan), every reviewer a fresh context reading the
candidate read-only; findings are disposed here and in the receipts under `docs/evidence/reviews/0.3.22/`.

0.3.22 carries what landed on `main` after 0.3.21 (`bfb4d31f`): the turn-end-waits spec's waves T1 to T6
([the spec](../specs/2026-11-16-turn-end-waits.md)), question clarity, the board supervisor, a second client of a
session leaving no longer ending it (task `fb5b790a`, the claim loss the installed 0.3.21 still has), the session console
with one bar, the interface wave U, and test fixes for a loaded machine. Task `07510265` on the board.

## Protocol

- Baseline: `bfb4d31f`, 0.3.21's release commit (tag `v0.3.21`). The reviewers read the candidate's checkout without
  writing in it and record HEAD and `git status --short | wc -l` before and after.
- Tests are run by file under `nice -n 10`, one run at a time; a timing test that fails once is rerun alone before it is
  called a defect (the machine ran at a load above 60 during this review).
- The review copies are redacted for publication (ADR-0096): home paths are `/Users/example`.
- A finding is fixed (with its test or check), ruled (with its register id), not a defect (with why), not recoverable,
  or stopped.
- A run's candidate passes `bash scripts/ci.sh fast` before its reviewers start (the 0.3.21 review, iteration 3, run two,
  PL-20).
- A candidate becomes `verifiedCommit` only after a full hosted `ci` run reads green on it, or on a commit whose
  difference to it is documents only (0.3.21's run five, PL-33, PL-34, DO-37).

## What 0.3.22 carries

The `## Unreleased` section of [`CHANGELOG.md`](../../../CHANGELOG.md) names every person-visible change.

## Iteration 1

Candidate `cffeb7111f5c3429986ded60a3984ab1aa732674` (`bash scripts/ci.sh fast` green on it, 2026-11-17). Five
reviewers, one per level; their reports and receipts are in `docs/evidence/reviews/0.3.22/iteration-1/`.

46 findings, 5 blocking (PL-1, PL-2, DO-1, DO-2, DA-1; PL-1 and DO-1 one defect, PL-2 and DO-2 one defect), three distinct
defects: a remote run's question, asked by a non-uuid id, made the database refuse the read that names every agent
question's asker on «Нужны вы»; the CHANGELOG and the spec promised the adapter's Stop hook, which no adapter has; a wait
past the supervisor's week was dropped unsaid. Every new test was watched failing on the old code (a store refusing a
non-uuid as PostgREST does, a hold call held open while a release is asked, a question read that throws, the panel's old
accessible names). The rest is ruled to CO-590, one row with each finding's id.

| Row | Finding | Severity | Defect | Disposition |
|---|---|---|---|---|
| V1-1 | UX-1 | non-blocking | An unclear question tells the person to hand the decision back to the agent, but «Отдать агенту» is offered only when the question has options. An old agent … | ruled: CO-590 (the 0.3.22 review's iteration-1 leftovers) |
| V1-2 | UX-2 | non-blocking | The clarity rule refuses plain questions as «machine words»: a slash pair, a product with a number, a domain, a standard name. The refusal does not say which … | ruled: CO-590 (the 0.3.22 review's iteration-1 leftovers) |
| V1-3 | UX-3 | non-blocking | A question a run on another machine asks, refused as unclear, reaches nobody who can fix it: the person sees nothing, and the next run's packet carries no … | ruled: CO-590 (the 0.3.22 review's iteration-1 leftovers) |
| V1-4 | UX-4 | non-blocking | English names one column two ways: the kanban's second column is now "In progress", but its own notes and every other English screen still call it "In work"; … | fixed in the iteration-1 wave (candidate 2, `76b5637f`): the kanban's two notes name the column «In progress» as the column does (`launch.kanban.abandonedNote`, `launch.kanban.agentOnlyRunning`); the copy check found nothing |
| V1-5 | UX-5 | non-blocking | What agents are told about continuation is unconditional, and the release tool's own description still says a let-go only goes back to the queue. In fact a run … | ruled: CO-590 (the 0.3.22 review's iteration-1 leftovers) |
| V1-6 | UX-6 | non-blocking | The feed and История now say «вы» / "you" for a proposal decided or a grant issued, but the people-ask bridge applies a Telegram answer from another person (an … | ruled: CO-590 (the 0.3.22 review's iteration-1 leftovers) |
| V1-7 | UX-7 | non-blocking | A console whose agent exited by itself offers «Проверить остановку» / "Check stop again", though nobody stopped it; "again" claims a first stop. The state … | ruled: CO-590 (the 0.3.22 review's iteration-1 leftovers) |
| V1-8 | UX-8 | non-blocking | The Telegram request says its deadline as a raw UTC timestamp, while the release moved every date in the interface to words in the person's language and zone. | ruled: CO-590 (the 0.3.22 review's iteration-1 leftovers) |
| V1-9 | UX-9 | non-blocking | New person-facing surfaces have no scenario: the two Settings switches, the unclear-question headline with «Подробнее», the «На проверке» row for a task Fabric … | ruled: CO-590 (the 0.3.22 review's iteration-1 leftovers) |
| V1-10 | UX-10 | non-blocking | An agent with no registry name is titled «Агент без имени» on screen, but its buttons' accessible names still carry its machine id, so a screen reader … | fixed in the iteration-1 wave (candidate 2, `76b5637f`): the buttons' accessible names use `shownTitle`; test «a screen reader names the buttons by the shown title, never the machine id» in `AgentAccessPanel.test.tsx`, watched failing on the old panel |
| V1-11 | ER-1 | non-blocking | A Switchboard hold can be left stale or not renewed: `set()` silently drops a call for a session whose previous call is still in flight instead of keeping the … | fixed in the iteration-1 wave (candidate 2, `76b5637f`): a change asked while a hold call runs is kept, newest wins, and asked after it (`sessionHolds.ts#createSessionHolds`); test «a release asked while the hold is in flight is asked once that call ends», watched failing |
| V1-12 | ER-2 | non-blocking | Switchboard's first lookup races. Two holds asked at once before the binary was found: the second sees `lookedAt` fresh and `file` still null, throws … | fixed in the iteration-1 wave (candidate 2, `76b5637f`): holds asked together share one lookup (`createMachineSessionHolds`, `looking`) |
| V1-13 | ER-3 | non-blocking | Claims handed back to a resumed session are outside the hold and renewal path in two ways. (a) They get no Switchboard hold: `noteClaims` only schedules a … | ruled: CO-590 (the 0.3.22 review's iteration-1 leftovers) |
| V1-14 | ER-4 | non-blocking | The fb5b790a guard counts any other non-rejoin bearer of the session that called within five minutes as a live client, including a bearer its own client has … | ruled: CO-590 (the 0.3.22 review's iteration-1 leftovers) |
| V1-15 | ER-5 | non-blocking | The turn verdict has no deadline of its own and is lost on a retried turn. Every turn's answer now waits for the verdict's reads: three reads in parallel, then … | ruled: CO-590 (the 0.3.22 review's iteration-1 leftovers) |
| V1-16 | ER-6 | non-blocking | A declared wait whose reference cannot be read or never settles holds the task silently. `readSettled` drops a failed `questions` or `access_requests` read … | ruled: CO-590 (the 0.3.22 review's iteration-1 leftovers) |
| V1-17 | ER-7 | non-blocking | A `task-to-operator` row leaves «На проверке» whenever the dispatcher's last pass did not read the left tasks: a failed resume read is caught and returns no … | ruled: CO-590 (the 0.3.22 review's iteration-1 leftovers) |
| V1-18 | ER-8 | non-blocking | A remote run's question filed for a person is never withdrawn. When the request is settled elsewhere, expires, or its `waiting` record is trimmed, the question … | ruled: CO-590 (the 0.3.22 review's iteration-1 leftovers) |
| V1-19 | ER-9 | non-blocking | A failed read of a filed question is swallowed: `questionState` rejecting reads as null and the request is said once as `board.dispatch.decided` `wait` … | fixed in the iteration-1 wave (candidate 2, `76b5637f`): a failed read of a filed question is logged once as `board.dispatch.question` failed, reason unread; test «a filed question that cannot be read is said once as unread», watched failing |
| V1-20 | ER-10 | non-blocking | The supervisor's loop guard counts only runs that never claimed the task. A resume run that claims and lets go again without progress reads `answered`, ends … | ruled: CO-590 (the 0.3.22 review's iteration-1 leftovers) |
| V1-21 | DA-1 | blocking | A question a run on another machine asks (T5) is filed with the asker id `dispatch-run:<launch>`, which is not a uuid. The board read behind «Нужны вы» … | fixed in the iteration-1 wave (candidate 2, `76b5637f`): only session uuids reach the askers' read (`boardReads.ts`, `SESSION_ID`), a failed read is logged as `board.read-askers`; tests «a remote run's asker id never reaches the uuid read» (a store refusing a non-uuid as PostgREST does), watched failing, and «a failed read of the askers ... is said in the operations log» |
| V1-22 | DA-2 | non-blocking | Going back to 0.3.21 on data 0.3.22 wrote is not described, and loses state: 0.3.21 drops every `waiting` record (its `OUTCOMES` lacks the value), so with the … | ruled: CO-590 (the 0.3.22 review's iteration-1 leftovers) |
| V1-23 | DA-3 | non-blocking | A remote run's question is never withdrawn when its request settles another way (another agent answered it, the requester cancelled it, it expired). The pass … | ruled: CO-590 (the 0.3.22 review's iteration-1 leftovers) |
| V1-24 | DA-4 | non-blocking | The newest-claim reads of the supervisor and of the claims hand-back ask each chunk of 100 tasks for at most 1000 claims, newest first, but never compare a … | ruled: CO-590 (the 0.3.22 review's iteration-1 leftovers) |
| V1-25 | DA-5 | non-blocking | New reads run on every dispatcher pass (30 s) or at enrollment without an index on their filter, and 0.3.22 adds no migration: `work.released@1` by … | ruled: CO-590 (the 0.3.22 review's iteration-1 leftovers) |
| V1-26 | DA-6 | non-blocking | The T6 row «На проверке» exists only on a pass where the resume read succeeded with `resumeLeftWork` on: `resumeGiven` filters by `readIds`, which holds resume … | ruled: CO-590 (the 0.3.22 review's iteration-1 leftovers) |
| V1-27 | DA-7 | non-blocking | A resume `to-operator` record is never trimmed: `afterPass` keeps any newest record whose outcome is `to-operator`, a rule made for board requests that a board … | ruled: CO-590 (the 0.3.22 review's iteration-1 leftovers) |
| V1-28 | DA-8 | non-blocking | `people-asks.json`'s `applying` is written before the door is called and never read. A quit or crash between a successful apply and the next save re-judges the … | ruled: CO-590 (the 0.3.22 review's iteration-1 leftovers) |
| V1-29 | DA-9 | non-blocking | A resume run is reported to the home as a board request: `BoardRun` has no resume flag and carries the task id as `requestId`, so «В работе» shows «Работает по … | ruled: CO-590 (the 0.3.22 review's iteration-1 leftovers) |
| V1-30 | DO-1 | blocking | The CHANGELOG says a live session holding open work now goes on by itself: «The adapter's Stop hook turns it into another turn.» No released adapter does. The … | fixed in the iteration-1 wave (candidate 2, `76b5637f`): the CHANGELOG's T2 entry and spec §4.2 say Fabric only answers; the adapter's Stop hook is wave T3, requested, not released |
| V1-31 | DO-2 | blocking | The turn-end spec promises that «a task still waiting past the supervisor's week goes to the operator like any left task». No code does this. The supervisor … | fixed in the iteration-1 wave (candidate 2, `76b5637f`): `fabric_work_release` refuses a time or limit past 7 days (`shared/boardResume.ts#waitTooFar`, tests in `boardResume.test.ts`); the tool, the CHANGELOG and spec §3 say an open wait leaves the task in the queue after a week; its route to the operator ruled: CO-590 |
| V1-32 | DO-3 | non-blocking | The turn-end spec section 4.1 says a resumed task's run «goes where the project's runs go: this Mac, or the machine `dispatchTargets` names». The dispatcher … | fixed in the iteration-1 wave (candidate 2, `76b5637f`): spec §4.1: a resume run starts on this Mac |
| V1-33 | DO-4 | non-blocking | The spec says twice that a wait naming nothing checkable makes the work go on «at once». The code refuses such a wait at the tool (`bad-input`), and a release … | fixed in the iteration-1 wave (candidate 2, `76b5637f`): spec §2 and the T1 row: a wait naming nothing checkable is refused; no wait is continued after the 10-minute grace |
| V1-34 | DO-5 | non-blocking | Section 4.2 says the turn's answer is `continue` «else `stop`». Fabric never answers `stop`: no verdict means the turn ends. An adapter written to this section … | fixed in the iteration-1 wave (candidate 2, `76b5637f`): spec §4.2: Fabric never sends `stop`, no verdict is the ordinary end |
| V1-35 | DO-6 | non-blocking | Section 4.4 gives the hold as `switchboard monitor hold --session <id> --until <expiry> --reason fabric_claim`; Fabric sends no `--reason`. The T4 row says … | fixed in the iteration-1 wave (candidate 2, `76b5637f`): spec §4.4 says Fabric sends no `--reason` yet; sending it ruled: CO-590 |
| V1-36 | DO-7 | non-blocking | User-facing changes in the range shipped without their scenarios: Главная leads with «Нужны вы» and every card is decided in place (7be60d93); the two new … | ruled: CO-590 (the 0.3.22 review's iteration-1 leftovers) |
| V1-37 | DO-8 | non-blocking | The `AGENTS.md` footprint row «The home's work reading» was not updated for W3: main now shares one reading among every window and screen, joins one in flight … | ruled: CO-590 (the 0.3.22 review's iteration-1 leftovers) |
| V1-38 | DO-9 | non-blocking | The CHANGELOG says the Switchboard hold is released «when none is left». A release (`--until 0`) asked while a hold call for the same session is still running … | fixed in the iteration-1 wave (candidate 2, `76b5637f`): the same defect as ER-1, fixed there |
| V1-39 | DO-10 | non-blocking | The turn-end spec's section 5 says Kira's `people.ask` comes 2026-11-19, while the people-ask spec says both PM agents already hold a live `people.ask` … | fixed in the iteration-1 wave (candidate 2, `76b5637f`): spec §5: Кира's `people.ask` active in the directory on 2026-11-17 |
| V1-40 | PL-1 | blocking | The CHANGELOG promises that a live session holding open work goes on by itself: «The adapter's Stop hook turns it into another turn». No released adapter does … | fixed in the iteration-1 wave (candidate 2, `76b5637f`): the same as DO-1: the CHANGELOG and spec §4.2 no longer promise the adapter's hook |
| V1-41 | PL-2 | blocking | A wait longer than the supervisor's week is accepted, promised, then dropped without a word. `fabric_work_release` accepts a `time` wait with any `until` and a … | fixed in the iteration-1 wave (candidate 2, `76b5637f`): the same as DO-2: a time past the window is refused, the open wait's end is said; the operator route ruled: CO-590 |
| V1-42 | PL-3 | non-blocking | Rows the register targets at «the release after 0.3.21», which 0.3.22 is, are neither built nor retargeted, and nothing in the candidate says so. Among them is … | ruled: CO-590 (the 0.3.22 review's iteration-1 leftovers) |
| V1-43 | PL-4 | non-blocking | The new open pieces of the 2026-11-16/17 work have no register rows, and the rows they move were not updated. T3 (the adapter's hook), the wait past its time … | ruled: CO-590 (the 0.3.22 review's iteration-1 leftovers) |
| V1-44 | PL-5 | non-blocking | The general development plan's Now line still says the quality waves W1 to W8 «in that order». Since 2026-11-16 the work turned to the turn-end waves, the … | ruled: CO-590 (the 0.3.22 review's iteration-1 leftovers) |
| V1-45 | PL-6 | non-blocking | The spec waits for Switchboard to ship `--reason fabric_claim`, and it has: Switchboard 0.7.111 (installed here) takes it. Fabric still calls `monitor hold` … | ruled: CO-590 (the 0.3.22 review's iteration-1 leftovers) |
| V1-46 | PL-7 | non-blocking | The CHANGELOG says every «Нужны вы» item goes to «the project's organization agent». The people-ask spec records that the operator's personal boards are not … | ruled: CO-590 (the 0.3.22 review's iteration-1 leftovers) |

Exit for iteration 1: candidate 2 is `591905408b6ea855bfcdd2f671c5b0796bfba655`, the wave above with the gate's own fixes
(the mockup receipt re-pinned, CO-590 cited by lane 12, the plan projection rebuilt; `76b5637f` was its first commit and
failed the plan-ids gate, iteration 2, PL-5); `bash scripts/ci.sh fast` read green on it before iteration 2.
Blocking findings open: none.

## Iteration 2

Candidate `591905408b6ea855bfcdd2f671c5b0796bfba655`. Five reviewers, fresh contexts, each first reviewing the candidate
and then checking iteration 1's dispositions; their reports and receipts are in `docs/evidence/reviews/0.3.22/iteration-2/`.
29 findings, 4 blocking (ER-1, DO-1, PL-1, PL-2; DO-1 and PL-7 one defect, PL-1 and DO-9 one defect): the separate
console window's «Новая сессия» could never start; the T2 entry's title still promised a live session goes on; the spec
promised to check a heartbeat's wait; no rollback paragraph for 0.3.22. Beside them DA-1, non-blocking as written, was
fixed first: the supervisor would have restarted every task left in the week before the upgrade (42 tasks in 30 projects
on this machine's board). The reviewers agreed every iteration-1 finding ruled to CO-590 is non-blocking.

| Row | Finding | Severity | Defect | Disposition |
|---|---|---|---|---|
| V2-1 | UX-1 | non-blocking | The iteration-1 fix's new refusal tells an agent to do the opposite of waiting. A `fabric_work_release` with a `time` or `limit` wait past 7 days is refused … | fixed in the iteration-2 wave (candidate 3, `fbb7d9b5`): the refusal says to wait with a nearer until and release again then, or keep the claim and wait in the session |
| V2-2 | UX-2 | non-blocking | Iteration 1's UX-4 is fixed only inside the kanban. English still names the running state two ways: the kanban column, its notes and История's stage say "In … | ruled: CO-590 (appended for iteration 2) |
| V2-3 | UX-3 | non-blocking | In История's «Что делали агенты», the reason a row opens nothing is now visually hidden and a mouse tooltip, so a sighted keyboard user no longer reads it; the … | ruled: CO-590 (appended for iteration 2) |
| V2-4 | UX-4 | non-blocking | The console tabs tell two sessions of one project and coding agent apart by clock time only, never the day: a session left open since yesterday at 14:05 and … | ruled: CO-590 (appended for iteration 2) |
| V2-5 | ER-1 | blocking | «Новая сессия» in the separate console window can never work. The detached window renders the button for an ended session, but its click calls … | fixed in the iteration-2 wave (candidate 3, `fbb7d9b5`): the separate window offers no «Новая сессия» (`SessionWindow.tsx`); test «the separate window of an ended session offers no new session it could not start», watched failing; the CHANGELOG says so |
| V2-6 | ER-2 | non-blocking | Iteration-1 ER-1 is fixed only in part. The newest-wins queue keeps calls in the order they reach `set`, but `syncHold` still issues one unordered claims read … | ruled: CO-590 (appended for iteration 2) |
| V2-7 | ER-3 | non-blocking | A failed read of `switchboard dispatch --help` is not said and is logged as the wrong cause. `helpOf` turns a timeout or a non-zero exit (10 s deadline, a … | ruled: CO-590 (appended for iteration 2) |
| V2-8 | ER-4 | non-blocking | A claim taken with `fabric_task_claim` is never held by Switchboard. Only `fabric_work_claim` calls `onClaimed` (`syncHold` and the renewal schedule); … | ruled: CO-590 (appended for iteration 2) |
| V2-9 | DA-1 | non-blocking | On upgrade the board supervisor treats every release of the week before it as left work, though a 0.3.21 release could not say what it waited for. … | fixed in the iteration-2 wave (candidate 3, `fbb7d9b5`): the supervisor continues only work left after it first ran here (`main/boardResumeRead.ts#resumeSince`, `resume-since.json`, named in `AGENTS.md` and the CHANGELOG's Upgrading); test «DA-1: only work left since the supervisor began on this machine is continued» |
| V2-10 | DA-2 | non-blocking | Turning «Продолжать начатую работу без меня» off does not hold a resume start already in flight. A record left `starting` (Switchboard's answer lost) is asked … | ruled: CO-590 (appended for iteration 2) |
| V2-11 | DA-3 | non-blocking | The iteration-1 fix of PL-2 and DO-2 (a time or limit wait past 7 days is refused) is tested only as the pure `waitTooFar`; nothing calls `fabric_work_release` … | ruled: CO-590 (appended for iteration 2) |
| V2-12 | DO-1 | blocking | The turn-end spec's rule table promises that a session which says it waits through `fabric_heartbeat` (phase waiting with `waitingOn`) while it stays is … | fixed in the iteration-2 wave (candidate 3, `fbb7d9b5`): spec §2 says a heartbeat's wait is not checked, it only holds back the turn's continue |
| V2-13 | DO-2 | non-blocking | Iteration 1's PL-2 and DO-2 are marked fixed with «tests in `boardResume.test.ts`», but those test only the helper `waitTooFar`. The refusal itself, in … | ruled: CO-590 (appended for iteration 2) |
| V2-14 | DO-3 | non-blocking | The spec's checks cite «`test/board-dispatch-run.test.mjs` (a run's packet names the wait)» for T1. No such test exists: no test in that file builds a resume … | ruled: CO-590 (appended for iteration 2) |
| V2-15 | DO-4 | non-blocking | Two leftovers of iteration 1's doc fixes. (a) DO-6 is marked fixed, but its second half is not: the T4 plan row still says `--reason fabric_claim` waits «once … | fixed in the iteration-2 wave (candidate 3, `fbb7d9b5`): (a) the T4 row says Switchboard 0.7.111 takes the reason, sending it is CO-590; (b) ruled: CO-590 |
| V2-16 | DO-5 | non-blocking | The on-demand spec §3.11 still lists as «Not done in this wave» the «На проверке» row for a task given to the operator. The same release ships it (T6, … | fixed in the iteration-2 wave (candidate 3, `fbb7d9b5`): the on-demand spec §3.11 points to T6's row |
| V2-17 | DO-6 | non-blocking | `## Unreleased` has no `**Upgrading.**` paragraph, which every 0.3.x section carries and which the release workflow publishes as the notes. 0.3.22 adds no … | fixed in the iteration-2 wave (candidate 3, `fbb7d9b5`): `## Unreleased` opens with its Upgrading paragraph |
| V2-18 | DO-7 | non-blocking | The ADR index's Next free ID says two opposite things about ADR-0193 in one sentence: «ADR-0193 (superseded, never used) was the pipeline reservation; ADR-0193 … | ruled: CO-590 (appended for iteration 2) |
| V2-19 | DO-8 | non-blocking | The map lane for iteration 1 says «Остальные 33 замечания в строке переноса CO-590». The ledger rules 30 findings to CO-590 and fixes 16; the CO-590 row names … | fixed in the iteration-2 wave (candidate 3, `fbb7d9b5`): the iteration-1 lane says 30 |
| V2-20 | DO-9 | non-blocking | After iteration 1's DO-1 fix the T2 entry's body says a live session still ends its turn as before until the adapter acts on the verdict, but its bold title … | fixed in the iteration-2 wave (candidate 3, `fbb7d9b5`): the T2 entry's title says the turn only answers |
| V2-21 | DO-10 | non-blocking | Wave U changes person-facing words on four screens with no scenario amendment: История «Агент · взял задачу», Agent access «Агент без имени» / "An unnamed … | ruled: CO-590 (appended for iteration 2) |
| V2-22 | PL-1 | blocking | Iteration 1's PL-1 and DO-1 are fixed only in the entry's body. The bold headline still says «A live session goes on while it holds open work», which is false … | fixed in the iteration-2 wave (candidate 3, `fbb7d9b5`): the T2 entry's title says the turn only answers |
| V2-23 | PL-2 | blocking | DA-2, ruled to CO-590, is a release blocker by this release line's own precedent, and its consequence is an outward send against the person's choice. The … | fixed in the iteration-2 wave (candidate 3, `fbb7d9b5`): the runbook's 0.3.22 paragraph and the CHANGELOG say what going back to 0.3.21 loses and what to do first |
| V2-24 | PL-3 | non-blocking | Two fixes the ledger calls done have no test that fails without them. PL-2's refusal of a wait past 7 days lives in `fabric_work_release`, but the only test … | ruled: CO-590 (appended for iteration 2) |
| V2-25 | PL-4 | non-blocking | UX-4 is recorded fixed but half done. The finding was that English names one column two ways and its fix was one name everywhere; the wave changed only the two … | ruled: CO-590 (appended for iteration 2) |
| V2-26 | PL-5 | non-blocking | The ledger names the wrong candidate 2. It says candidate 2 is `76b5637f` and that `bash scripts/ci.sh fast` ran on it, but `76b5637f` fails the plan-ids gate … | fixed in the iteration-2 wave (candidate 3, `fbb7d9b5`): the ledger names candidate 2 `59190540`, the commit the gate and iteration 2 read |
| V2-27 | PL-6 | non-blocking | Left work in a project with no folder on this Mac is never continued and never shown. A resume item whose project has no folder here is turned from … | ruled: CO-590 (appended for iteration 2) |
| V2-28 | PL-7 | non-blocking | The spec's rule promises more for a live session than is built. §2's table says a session that stays and declares a wait with `fabric_heartbeat` waiting and … | fixed in the iteration-2 wave (candidate 3, `fbb7d9b5`): the same as DO-1 |
| V2-29 | PL-8 | non-blocking | «Вопросы должны быть понятны» is applied to the question's text only. Option labels and consequences, which a person reads as the choices on Главная and in … | ruled: CO-590 (appended for iteration 2) |

Exit for iteration 2: candidate 3 is `fbb7d9b5` (the wave above); `bash scripts/ci.sh fast` runs on it before iteration 3.
Blocking findings open: none.

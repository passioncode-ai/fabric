# Fabric 0.3.26 release verification

Release gate ledger for 0.3.26 ([the release runbook](../../launch/release-mac.md#how-a-release-is-made), P-02). Three
iterations, five reviewers each (ux, errors, docs, data, plan), every reviewer a fresh context reading the candidate
read-only; findings are disposed here and in the receipts under `docs/evidence/reviews/0.3.26/`.

0.3.26 carries [the release spec](../specs/2026-11-20-home-agents-sessions.md): the CEO card at the top right of Главная,
every session of this computer in Агенты and the left column (Claude Code's files joined with Switchboard's
`sessions --rows`), `fabric://session/open` and `continue` (DEC-0189), the launch journal with a press on an agent
opening its console and a project's new or last session, the fast «Завершить сессию», and the CEO window redesigned with
the CEO's stop that holds (prepared as 0.3.25 and not published). The operator's orders of 2026-11-20 are quoted in the
spec.

## Protocol

- Baseline: `origin/main` `53e8c3e2` (0.3.24 and the home CEO card).
- The reviewers: Claude Code subagents of the release session (Opus 5.5), each a fresh context given the spec, the
  CHANGELOG and the diff against the baseline, reading the candidate's checkout without writing in it and recording HEAD
  and `git status --short | wc -l` before and after. They ran single test files at most; the release session ran the
  gates and the built app.
- A finding is fixed (with its test or check), ruled (with its register id), not a defect (with why), not recoverable,
  or stopped.
- 0.3.25's ledger ([2026-11-19](2026-11-19-release-0325-verification.md)) stays as the record of that candidate; its
  three iterations are not reused here.
- A run's candidate passes `bash scripts/ci.sh fast` with the browser suites run (`FABRIC_PLAYWRIGHT_MODULE` and
  `FABRIC_CHROME` set), as the hosted run does, before its reviewers start (iteration 3, run one, PL-23).
- Built-app check: the disposable stack (`scripts/test-stack.mjs`) with `scripts/fixtures/launch-estate.sql`, the
  built candidate under a temporary HOME, windows of 1280, 1440 and 1680 px, screenshots at 1440 and 1280 (spec §3).

## What 0.3.26 carries

The `## Unreleased` section of [`CHANGELOG.md`](../../../CHANGELOG.md), renamed `## 0.3.26` at the release. No schema
step (schema 102, no migration).

## Iteration 1

Candidate `314c956660b35a25b4b71e3ba97cbd8b548914a4`. Reports and receipts in
[`docs/evidence/reviews/0.3.26/iteration-1/`](../reviews/0.3.26/iteration-1/). 60 findings, 12 blocking: the CEO test file
did not parse after the merge (ER-1), vitest red on the candidate (ER-2, UX-3), Fabric's own consoles listed «вне Fabric»
(ER-3, UX-2), «Продолжить в Fabric» stopping a session before it could be continued (UX-1), three false claims in the
CHANGELOG and AGENTS.md (DO-1 to DO-3), and the count claim and the deferrals without rows (PL-1 to PL-3). Code fixed in
`527ca936`, documents in the commit «docs(0.3.26): review iteration 1, the document findings». Gate on the candidate: `ci.sh fast` exit 1 (ER-2's tests and a stale
mockup coverage page).

| Row | Finding | Severity | Disposition |
|---|---|---|---|
| V1-UX-1 | UX-1 | blocking | fixed in 527ca936: the project is asked before any signal; a console that fails after the stop says so with claude --resume (machineSessions.ts continueInFabric); tests «a folder in no project is refused BEFORE anything is stopped» and MachineSessions «a continue refused for no project…», red before |
| V1-UX-2 | UX-2 | blocking | fixed in 527ca936: a process that is a Fabric console or runs under one is Fabric's (machineSessions.ts ownedBy, pty.ts runningPids, the process table); test «a Fabric console is never «outside»», red before |
| V1-UX-3 | UX-3 | blocking | fixed in 527ca936: the fixture carries source; a Switchboard-only row shows no act (MachineSessions.test.tsx, 7 pass) |
| V1-UX-4 | UX-4 | non-blocking | ruled: CO-604 (10) |
| V1-UX-5 | UX-5 | non-blocking | ruled: CO-601 (9) |
| V1-UX-6 | UX-6 | non-blocking | ruled: CO-604 (11) |
| V1-UX-7 | UX-7 | non-blocking | fixed in 527ca936: a session with no state is counted as such in both places (MachineSessions.tsx counts, LaunchShell.tsx rail); test «counts sum to the list» |
| V1-UX-8 | UX-8 | non-blocking | ruled: CO-604 (12) |
| V1-UX-9 | UX-9 | non-blocking | fixed in 527ca936: no raw status word; the folder once when there is no name (MachineSessions.tsx) |
| V1-UX-10 | UX-10 | non-blocking | fixed in 527ca936: every act button names its folder; the rail says the state once (dot aria-hidden); Rail.test.tsx |
| V1-UX-11 | UX-11 | non-blocking | fixed in 527ca936: a listing waits at most 3 s for Switchboard and takes the last settled rows (index.ts switchboardRows) |
| V1-UX-12 | UX-12 | non-blocking | ruled: CO-604 (13) |
| V1-UX-13 | UX-13 | non-blocking | ruled: CO-604 (14) |
| V1-UX-14 | UX-14 | non-blocking | ruled: CO-604 (15) |
| V1-UX-15 | UX-15 | non-blocking | fixed in the commit «docs(0.3.26): review iteration 1, the document findings»: CHANGELOG names the shipped title and scope; the empty text says agent sessions |
| V1-ER-1 | ER-1 | blocking | fixed in 527ca936: the closing of the ER-11 test restored (ceo-agent.test.mjs, 54 pass); ci.sh fast parses every test file and runs ceo-agent, session-resume, session-launches |
| V1-ER-2 | ER-2 | blocking | fixed in 527ca936: the rail calls the bridge through Promise.resolve and App guards a missing method; «Mac» became «компьютер»; the fixture carries source (platformWords, consoleTabsShell, MachineSessions pass) |
| V1-ER-3 | ER-3 | blocking | fixed in 527ca936: Fabric consoles excluded by process and parents; close refuses them (session-resume «a Fabric console is never «outside»», red before) |
| V1-ER-4 | ER-4 | non-blocking | ruled: CO-604 (2) |
| V1-ER-5 | ER-5 | non-blocking | fixed in 527ca936 in part: one read in flight, fresh 20 s from settle, a listing waits at most 3 s, one reading at a time in both pollers; the process group and the double journal read ruled: CO-604 (5) |
| V1-ER-6 | ER-6 | non-blocking | ruled: CO-604 (6) |
| V1-ER-7 | ER-7 | non-blocking | ruled: CO-604 (7) |
| V1-ER-8 | ER-8 | non-blocking | fixed in 527ca936: the last 2 MB read through a file handle (machineSessions.ts readTail); test «the tail read starts at a whole line» |
| V1-ER-9 | ER-9 | non-blocking | ruled: CO-604 (8) |
| V1-ER-10 | ER-10 | non-blocking | ruled: CO-604 (9); (a) fixed with DA-9 |
| V1-DO-1 | DO-1 | blocking | fixed in the commit «docs(0.3.26): review iteration 1, the document findings»: the journal bullet no longer describes the old panel; the sessions bullet owns it |
| V1-DO-2 | DO-2 | blocking | fixed in the commit «docs(0.3.26): review iteration 1, the document findings»: the CEO button bullet dropped; spec row 7 says it was a test-only defect |
| V1-DO-3 | DO-3 | blocking | fixed in the commit «docs(0.3.26): review iteration 1, the document findings»: the AGENTS.md lifecycle row names the Switchboard call, its cache, the process table read and both readers |
| V1-DO-4 | DO-4 | non-blocking | fixed in 527ca936: the code now does what the comment and spec say (fresh from settle, one in flight) |
| V1-DO-5 | DO-5 | non-blocking | fixed in the commit «docs(0.3.26): review iteration 1, the document findings»: the three merges recorded into the candidate with their merge commits |
| V1-DO-6 | DO-6 | non-blocking | fixed in the commit «docs(0.3.26): review iteration 1, the document findings»: an Upgrading paragraph |
| V1-DO-7 | DO-7 | non-blocking | fixed in the commit «docs(0.3.26): review iteration 1, the document findings»: «its newest Claude Code session» |
| V1-DO-8 | DO-8 | non-blocking | fixed in the commit «docs(0.3.26): review iteration 1, the document findings»: the stray blank line and the repeated card position removed |
| V1-DO-9 | DO-9 | non-blocking | fixed in the commit «docs(0.3.26): review iteration 1, the document findings»: the headline says the same sessions, counted by Switchboard's groups |
| V1-DO-10 | DO-10 | non-blocking | fixed in the commit «docs(0.3.26): review iteration 1, the document findings»: spec §4 cites board request 7c726479 and task ccd5c232 |
| V1-DO-11 | DO-11 | non-blocking | fixed in the commit «docs(0.3.26): review iteration 1, the document findings»: the map entry iteration-2026-11-20-release-0326-i1 names the code |
| V1-DA-1 | DA-1 | non-blocking | fixed in 527ca936: turns redacted in the wiring (index.ts machineSessions turns) |
| V1-DA-2 | DA-2 | non-blocking | fixed in 527ca936: the tail read (readTail); the synchronous transcript lookup ruled with CO-604 (5) |
| V1-DA-3 | DA-3 | non-blocking | ruled: CO-604 (1) |
| V1-DA-4 | DA-4 | non-blocking | fixed in 527ca936: as ER-3 |
| V1-DA-5 | DA-5 | non-blocking | ruled: CO-604 (2) |
| V1-DA-6 | DA-6 | non-blocking | fixed in 527ca936: as ER-5 |
| V1-DA-7 | DA-7 | non-blocking | ruled: CO-604 (3) |
| V1-DA-8 | DA-8 | non-blocking | ruled: CO-604 (4) |
| V1-DA-9 | DA-9 | non-blocking | fixed in the commit «docs(0.3.26): review iteration 1, the document findings»: a rejected mkdir is forgotten (sessionLaunches.ts ensureDir); test «a journal folder that could not be made is tried again», red before |
| V1-DA-10 | DA-10 | non-blocking | fixed in 527ca936: no machine in the CEO launches tool (ceoTools.ts) |
| V1-DA-11 | DA-11 | non-blocking | fixed in 527ca936: every outcome but ok is failed, at warn (index.ts record) |
| V1-PL-1 | PL-1 | blocking | fixed in the commit «docs(0.3.26): review iteration 1, the document findings»: CHANGELOG, spec §1 row 2 and §2 say the same sessions, counted by Switchboard's groups; the shared definition is CO-603 (1) |
| V1-PL-2 | PL-2 | blocking | fixed in the commit «docs(0.3.26): review iteration 1, the document findings»: CO-603 and CO-604 reserved and written; update pointed at P-12 and P-27 |
| V1-PL-3 | PL-3 | blocking | fixed in the commit «docs(0.3.26): review iteration 1, the document findings»: CO-601 gains the nine 0.3.25 iteration-3 items and is re-dated to 0.3.27 with its reason |
| V1-PL-4 | PL-4 | non-blocking | fixed in the commit «docs(0.3.26): review iteration 1, the document findings»: as DO-5 |
| V1-PL-5 | PL-5 | non-blocking | fixed in the commit «docs(0.3.26): review iteration 1, the document findings»: screenshots committed (docs/evidence/reviews/0.3.26/shots), the ledger records each candidate's gate |
| V1-PL-6 | PL-6 | non-blocking | ruled: CO-604 (16) |
| V1-PL-7 | PL-7 | non-blocking | ruled: CO-603 (7) |
| V1-PL-8 | PL-8 | non-blocking | ruled: CO-604 (12) |
| V1-PL-9 | PL-9 | non-blocking | fixed in the commit «docs(0.3.26): review iteration 1, the document findings»: spec §2a maps every ask to what shipped or where it went |
| V1-PL-10 | PL-10 | non-blocking | fixed at the release: PRs #66 and #68 closed as superseded; the version, gate and ledger point at 0.3.26 |
| V1-PL-11 | PL-11 | non-blocking | fixed in the commit «docs(0.3.26): review iteration 1, the document findings»: as DO-2 |
| V1-PL-12 | PL-12 | non-blocking | ruled: CO-603 (8) |
| V1-PL-13 | PL-13 | non-blocking | ruled: CO-603 (5) |

Exit for iteration 1: every finding disposed above. Blocking findings open: none.

## Iteration 2

Candidate `30552b73e58571047945ef0eafb6c63d44fcb42a`. Reports and receipts in
[`docs/evidence/reviews/0.3.26/iteration-2/`](../reviews/0.3.26/iteration-2/). Every iteration-1 fix held. 39 new findings, 4 blocking:
a `session/open` link opened the agent's page instead of the console (UX-17), two CHANGELOG bullets measured against
builds never published (DO-13), CO-603 and CO-604 in no lane of the plan (DO-14), and the continue ask naming a
session only by its id, with the gate red on SP-2 (PL-15). Gate on the candidate: hosted `ci.yml` run 44677433773 and
local `ci.sh fast` red on SP-2; with the SP-2 fix, red only on the mockup receipt of `backlog.md` (re-reviewed and
re-pinned by `repin-mockup-receipts.mjs`, the cited row unchanged). Code and documents fixed in
the commit «fix(0.3.26): review iteration 2, every finding fixed or ruled».

| Row | Finding | Severity | Disposition |
|---|---|---|---|
| V2-UX-17 | UX-17 | blocking | fixed in the iteration-2 commit: a link to a console Fabric holds opens that console as the rail does (shared/linkRoute.ts consoleToOpen, App.tsx applyLink); linkRoute test «a link to a console Fabric holds opens that console at once» |
| V2-UX-18 | UX-18 | non-blocking | fixed in the iteration-2 commit: a stopped session not opened in a console leads with its own sentence, no «Не сделано», and offers «Продолжить из истории» (MachineSessions.tsx halfDone, ContinueSessionAsk.tsx); tests in both |
| V2-UX-19 | UX-19 | non-blocking | fixed in the iteration-2 commit: no manual command; «Продолжить из истории» continues the session from its transcript in its own Claude home (resumeEnded); MachineSessions test of the retry |
| V2-UX-20 | UX-20 | non-blocking | fixed in the iteration-2 commit: one warning banner for a continue (the notice is not shown beside it), Cancel disabled while the press is answered (ContinueSessionAsk.tsx); test «a refusal is said in words and keeps the ask» |
| V2-UX-21 | UX-21 | non-blocking | fixed in the iteration-2 commit: one machineWhy for the panel and the ask, every code a sentence, an unknown one in words; a running session not outside is not-outside, not still-running (index.ts resumeEnded); test «an unknown refusal code is never shown as the sentence» |
| V2-UX-22 | UX-22 | non-blocking | fixed in the iteration-2 commit: the ask names the folder, agent, state and the app the link came from, never the id (ContinueSessionAsk.tsx); test «names the session by folder, agent and state» |
| V2-UX-23 | UX-23 | non-blocking | ruled: CO-604 (11), extended in iteration 2 |
| V2-UX-24 | UX-24 | non-blocking | fixed in the iteration-2 commit: en machineSessions.continueAsk says «window or terminal» |
| V2-UX-25 | UX-25 | non-blocking | fixed in the iteration-2 commit: SCN-142 amended with session/open and continue; SCN-166 says «компьютере» and the iteration-1 fixes |
| V2-UX-26 | UX-26 | non-blocking | fixed in the iteration-2 commit: two sessions in one folder are named with their start; the panel heading is hidden inside the fold (MachineSessions.tsx label, folded) |
| V2-ER-12 | ER-12 | non-blocking | fixed in the iteration-2 commit for (a): one continue of a session at a time, close refused while it runs, the link keeps the ask in flight (machineSessions.ts continuing, App.tsx applyLink); test «one continue of a session at a time», red before; (b) ruled: CO-604 (22) |
| V2-ER-13 | ER-13 | non-blocking | ruled: CO-604 (18) |
| V2-ER-14 | ER-14 | non-blocking | fixed in the iteration-2 commit: with the process table unread, close and continue refuse with unknown-owner and the list still shows the row (machineSessions.ts find); test «the process table not read: no act runs», red before |
| V2-ER-15 | ER-15 | non-blocking | ruled: CO-604 (19) |
| V2-ER-16 | ER-16 | non-blocking | fixed in the iteration-2 commit: the CEO read takes the transcript tail through readTail (ceoTools.ts read); ceo-agent tests 54 pass |
| V2-ER-17 | ER-17 | non-blocking | fixed in the iteration-2 commit: readTail decodes only bytesRead (machineSessions.ts readTail); no test, a file shrinking between stat and read |
| V2-DO-13 | DO-13 | blocking | fixed in the iteration-2 commit: both bullets rewritten against 0.3.24 (the full-width card, no sessions list in 0.3.24) |
| V2-DO-14 | DO-14 | blocking | fixed in the iteration-2 commit: CO-603 and CO-604 in lane 12; check-plan-ids.mjs PASS |
| V2-DO-15 | DO-15 | non-blocking | fixed in the iteration-2 commit: the CHANGELOG, spec row 8 and SCN-142 quote the button and say a console Fabric runs is opened, not moved; the dated map entry stays as its record, the iteration-2 entry says it |
| V2-DO-16 | DO-16 | non-blocking | fixed in the iteration-2 commit: spec row 3, SCN-166 and the test name say «компьютер» / this computer |
| V2-DO-17 | DO-17 | non-blocking | fixed in the iteration-2 commit: SCN-142 amended; UX-1 and ER-3 added to the SCN-166 amendment |
| V2-DO-18 | DO-18 | non-blocking | fixed in the iteration-2 commit: the synchronous transcript lookup is CO-604 (17) |
| V2-DO-19 | DO-19 | non-blocking | fixed: PRs #66 and #68 closed as superseded on 2026-11-20 (gh pr close, both heads in the candidate); the version and the gate move in the release commit |
| V2-DO-20 | DO-20 | non-blocking | fixed in the iteration-2 commit: «0.3.25 was not published; its changes are in this release» |
| V2-DO-21 | DO-21 | non-blocking | fixed in the iteration-2 commit: the ledger intro drops the CEO button clause; the protocol says windows of 1280, 1440 and 1680 px, screenshots at 1440 and 1280 |
| V2-DA-13 | DA-13 | non-blocking | fixed in the iteration-2 commit: a turn is redacted whole, then cut (ceoTools.ts transcriptTurns clean, redactedTurns); test «redacted whole before they are cut», red with the old order |
| V2-DA-14 | DA-14 | non-blocking | fixed in the iteration-2 commit: the composed reader redactedTurns is exported, used by the panel and the CEO, and tested with a key across the cut |
| V2-DA-15 | DA-15 | non-blocking | fixed in the iteration-2 commit: the ask names the session and the app; the press carries from to the launch journal as via link with the app in the reason (sessionLaunches.ts LAUNCH_VIA, index.ts resumeInFabric linkReason); test «the link's app reaches the console» |
| V2-DA-16 | DA-16 | non-blocking | fixed in the iteration-2 commit: as ER-12 (a) |
| V2-DA-17 | DA-17 | non-blocking | ruled: CO-604 (20) |
| V2-DA-18 | DA-18 | non-blocking | fixed in the iteration-2 commit: a history whose folder cannot be read answers unreadable with its own sentence, not gone (index.ts resumeEnded) |
| V2-PL-15 | PL-15 | blocking | fixed in the iteration-2 commit: no id on screen (check-design SP-2 passes), the ask names folder, agent, state and app, every refusal a sentence, and the ask has five tests (ContinueSessionAsk.test.tsx); the gate on the iteration-3 candidate is recorded below |
| V2-PL-16 | PL-16 | non-blocking | fixed in the iteration-2 commit: the CHANGELOG says links are checked by the DEC-0151 and DEC-0177 detector; the folder-attribution twin ruled: CO-604 (20) |
| V2-PL-17 | PL-17 | non-blocking | fixed in the iteration-2 commit: SCN-142 amended, the FABRIC-0326 merge entry lists the links and the contract files; the product model state ruled: CO-604 (21) |
| V2-PL-18 | PL-18 | non-blocking | fixed in the iteration-2 commit: the Upgrading paragraph says consoles are not opened again after a restart, «↻» continues, CO-603 |
| V2-PL-19 | PL-19 | non-blocking | fixed: as DO-19 |
| V2-PL-20 | PL-20 | non-blocking | fixed in the iteration-2 commit: spec §3 marks its count as a reading on 314c9566; the release close records the reading on the verified candidate |
| V2-PL-21 | PL-21 | non-blocking | fixed in the plan: the iteration-3 candidate is a new commit descending from both, it becomes verifiedCommit, and nothing but metadata and the version changes after it; no new scope after iteration 2 (the live-process count of iteration 2 answers the operator's count ask with Switchboard's reply of 2026-11-20) |
| V2-PL-22 | PL-22 | non-blocking | fixed in the iteration-2 commit: spec §4 lists the moved promise with CO-603 (6) and cites CO-603 in its tracking column; thread 3ca40854 is told at the release |

Exit for iteration 2: every finding disposed above. Blocking findings open: none.

## Iteration 3

### Run one, 4ba9fd62 (superseded)

Candidate `4ba9fd6214dd80526eeba127b5c2fcb0a962647c`. Five reviewers, one per level; their reports and receipts are in
[`docs/evidence/reviews/0.3.26/iteration-3-4ba9fd62/`](../reviews/0.3.26/iteration-3-4ba9fd62/) (kept as the record; not
this iteration's receipts). Every iteration-2 fix held, three in part (UX-22, UX-25, DA-15), whose gaps are UX-27, UX-31,
DA-19 and DA-20. 23 findings, 2 blocking, both in files the gate refuses after
`verifiedCommit`, so the iteration runs again: DA-19, a link's `from` in the contract's `name.instance` form dropped by
Fabric's narrower checks, so the journal recorded a false reason, and PL-23, hosted `ci.yml` run 44681000417 red on two
browser suites (`layout-stress`: the new grids `.rail-pick`, `.ag-machine`, `.ag-machine-turns` grew past a 600 px column;
`screens-stand`: the stand did not feed `terminal.launch` and `agents.machineSessions`). The local `ci.sh fast` read
exit 0 on this candidate because the browser suites print NOT_RUN without `FABRIC_PLAYWRIGHT_MODULE` and
`FABRIC_CHROME`; run two's candidate runs them with both set.

| Row | Finding | Severity | Disposition |
|---|---|---|---|
| V3-UX-27 | UX-27 | non-blocking | fixed in the iteration-3 run-two candidate: the agent by runnerLabel, the app by its product name (ContinueSessionAsk.tsx appName); test «names the app by its product» |
| V3-UX-28 | UX-28 | non-blocking | fixed in the iteration-3 run-two candidate: a code with a sentence is not printed under it; only a message with no sentence is (MachineSessions.tsx FailureNote detail) |
| V3-UX-29 | UX-29 | non-blocking | fixed in the iteration-3 run-two candidate for (a) and (b): an unread list is said as unread, the session is read again after every answer (ContinueSessionAsk.tsx); test «a list read that failed is said as unread»; (c) ruled: CO-604 (24) |
| V3-UX-30 | UX-30 | non-blocking | fixed in the iteration-3 run-two candidate for the ask: a session only Switchboard names is read-only there, with where to act; test «a session only Switchboard names is read-only here»; the main side ruled: CO-604 (25) |
| V3-UX-31 | UX-31 | non-blocking | fixed in the iteration-3 run-two candidate: the SCN-142 amendment names every refusal, its states and its coverage |
| V3-UX-32 | UX-32 | non-blocking | ruled: CO-604 (26) |
| V3-ER-18 | ER-18 | non-blocking | fixed in the iteration-3 run-two candidate: an ask whose press is being answered stays until its answer; a newer continue link waits behind it and is shown after (App.tsx applyLink, continueBusy, continueQueued; ContinueSessionAsk onBusy) |
| V3-ER-19 | ER-19 | non-blocking | fixed in the iteration-3 run-two candidate: sessionLaunch.via.link in both locales; test «every LAUNCH_BY and LAUNCH_VIA value has a sentence in en and ru», red before |
| V3-ER-20 | ER-20 | non-blocking | fixed in the iteration-3 run-two candidate: as DA-19 and DA-20 |
| V3-ER-21 | ER-21 | non-blocking | ruled: CO-604 (23) |
| V3-ER-22 | ER-22 | non-blocking | fixed in the iteration-3 run-two candidate: as UX-29 (a) |
| V3-DO-22 | DO-22 | non-blocking | fixed in the iteration-3 run-two candidate: a link's id found nowhere is said as links.continue.gone; the CHANGELOG says the ask names a running session; SCN-142 lists the refusals; test «a session found nowhere is said as not on this computer» |
| V3-DO-23 | DO-23 | non-blocking | fixed in the iteration-3 run-two candidate: the CHANGELOG says what 0.3.24 listed (consoles, enrolled terminals, Switchboard's launches; only the CEO read the others) |
| V3-DA-19 | DA-19 | blocking | fixed in the iteration-3 run-two candidate: every check of from uses the contract's AGENT_ID (index.ts linkReason and the IPC handler, ContinueSessionAsk.tsx appName); tests «the link and its app, in the contract's name.instance form, reach the console» and «names the app by its product, the instance form included», red before |
| V3-DA-20 | DA-20 | non-blocking | fixed in the iteration-3 run-two candidate: the ask passes an explicit link origin, separate from from; via and the reason follow it (machineSessions.ts LinkOrigin, index.ts resumeEnded and continueInFabric); test «a link with no app still continues as a link» |
| V3-DA-21 | DA-21 | non-blocking | fixed in the iteration-3 run-two candidate: as ER-19 |
| V3-DA-22 | DA-22 | non-blocking | ruled: CO-604 (28); the unread case fixed as UX-29 (a) |
| V3-DA-23 | DA-23 | non-blocking | ruled: CO-604 (27) |
| V3-PL-23 | PL-23 | blocking | fixed in the iteration-3 run-two candidate: the three grids take minmax(0,1fr) columns and their items wrap (rail.css .rail-pick, launch.css .ag-machine, .ag-machine-turns); the screens stand feeds terminal.launch and agents.machineSessions (stand/fixtures.ts); layout-stress «125 grid classes, none grows past its column» and screens-stand «1528 checks pass», both red before; run-browser-suites.sh 26 of 26 locally |
| V3-PL-24 | PL-24 | non-blocking | fixed in the iteration-3 run-two candidate: run one's rulings are CO-604 (23) to (30); run two's are written in the ledger and added to CO-604 on main after the tag |
| V3-PL-25 | PL-25 | non-blocking | fixed in the iteration-3 run-two candidate: CO-603 (10), owner this repository's release session; spec §2a names it |
| V3-PL-26 | PL-26 | non-blocking | fixed in the iteration-3 run-two candidate: spec §1 row 2 and §2 say live processes are counted beside Switchboard's groups, with Switchboard's reply |
| V3-PL-27 | PL-27 | non-blocking | ruled: CO-604 (30); this release's rows are read by hand at the release commit |

### Run two, 5d549a8d (superseded)

Candidate `5d549a8dc93396a096fef8998e37d50fe3aa0a2a`. Reports and receipts in
[`docs/evidence/reviews/0.3.26/iteration-3-5d549a8d/`](../reviews/0.3.26/iteration-3-5d549a8d/) (kept as the record; not
this iteration's receipts). Gate: hosted `ci.yml` run 44684581786 success (browser suites 26 of 26, 06:15:32Z); local
`ci.sh fast` with both browser variables set, exit 0, browser suites 26 of 26. Every run-one fix held. 14 findings, 1 blocking,
in code the gate refuses after `verifiedCommit`, so the iteration runs again: UX-33 (ER-24), run one's UX-30 fix made
every session only Switchboard names read-only, the ended ones too, which Fabric continues from their history.

| Row | Finding | Severity | Disposition |
|---|---|---|---|
| V3-UX-33 | UX-33 | blocking | fixed in the iteration-3 run-three candidate: only a Switchboard-only row whose process runs (live) is read-only; one no process runs is ended and continued from its history (ContinueSessionAsk.tsx elsewhere, ended); test «an ended session only Switchboard names is continued from its history», red before |
| V3-UX-34 | UX-34 | non-blocking | fixed in the iteration-3 run-three candidate: a queued continue link is said in the ask (links.continue.queued) and dropped when another link replaces the ask (App.tsx continueQueued state); test «says when another continue link waits behind this one» |
| V3-UX-35 | UX-35 | non-blocking | fixed in the iteration-3 run-three candidate: the app is said as the link's own claim, «Ссылка называет себя: …» (links.continue.from) |
| V3-UX-36 | UX-36 | non-blocking | fixed in the iteration-3 run-three candidate: a read-only session shows its sentence instead of the question and no primary press, only Cancel; test «a running session only Switchboard names is read-only here» |
| V3-ER-23 | ER-23 | non-blocking | fixed in the iteration-3 run-three candidate: the queue is React state, cleared when a link replaces the ask, said in the ask, shown after the answer; the App-level test ruled: CO-604 (31) |
| V3-ER-24 | ER-24 | non-blocking | fixed in the iteration-3 run-three candidate: as UX-33 |
| V3-ER-25 | ER-25 | non-blocking | fixed in the iteration-3 run-three candidate: the IPC origin filter and the reason-and-via choice are pure, exported and tested (machineSessions.ts linkOriginOf, continueOrigin); test «a continue's origin: a link is a link with its app in the contract's grammar, a press is a screen» |
| V3-DO-24 | DO-24 | non-blocking | fixed in the iteration-3 run-three candidate: spec row 8 and SCN-142 say a running session is named by folder, agent and state and an ended one as ended |
| V3-DO-25 | DO-25 | non-blocking | fixed in the release commit: the ledger's Release close records the session reading with the commit it was built from |
| V3-DO-26 | DO-26 | non-blocking | fixed in the iteration-3 run-three candidate: the run-one paragraph says three iteration-2 fixes held in part and names their gaps |
| V3-DO-27 | DO-27 | non-blocking | fixed in the iteration-3 run-three candidate: the FABRIC-0326 entry lists launch/rail.css and the screens stand's fixtures |
| V3-DA-24 | DA-24 | non-blocking | fixed in the iteration-3 run-three candidate: as ER-25 |
| V3-PL-28 | PL-28 | non-blocking | fixed in the iteration-3 run-three candidate: CO-603's owner column gives Fabric's half of (5) (task dbeb4fcd, board request 508c1048) to this repository's release session |
| V3-PL-29 | PL-29 | non-blocking | fixed in the release commit: the ledger records the hosted run and the local ci.sh fast exit for each run, and the Release close the session reading with its commit |

### Run three, b83bed27 (superseded)

Candidate `b83bed27ec8fe80ada818372290fd78d18b66a57`. Reports and receipts in
[`docs/evidence/reviews/0.3.26/iteration-3-b83bed27/`](../reviews/0.3.26/iteration-3-b83bed27/) (kept as the record; not
this iteration's receipts). Gate: hosted `ci.yml` run 44687173294 success (browser suites 26 of 26, 06:39:09Z); local
`ci.sh fast` with both browser variables set, exit 0, browser suites 26 of 26. Every run-two fix held except ER-18, which regressed (ER-26); three held in part (UX-33, UX-35, ER-23), whose gaps are UX-37, UX-39 and ER-26. 16 findings, 3 blocking:
ER-26, run two's move of the waiting link to React state left the ask's answer calling a callback of an older render, so a
link waiting behind a successful press was dropped; UX-37, after a half-done answer a stale read hid the retry; both in
code the gate refuses after `verifiedCommit`, so the iteration runs again. PL-30, items 2 to 4 of the owner's release
order `3aa89c92` were in no record of this release.

| Row | Finding | Severity | Disposition |
|---|---|---|---|
| V3-UX-37 | UX-37 | blocking | fixed in the iteration-3 run-four candidate: after a half-done answer the retry from history is always offered and the stale state is not said (ContinueSessionAsk.tsx half); main asks Switchboard again after an act (index.ts rowsChanged); test «a half-done answer keeps the retry, even when the next read sees the stopped session as Switchboard's running one», red before |
| V3-UX-38 | UX-38 | non-blocking | fixed in the iteration-3 run-four candidate: the read-only sentence opens with what the link asks and names the folder; its only press is «Закрыть» (links.continue.viaSwitchboard, links.continue.close); test «a running session only Switchboard names is read-only here» |
| V3-UX-39 | UX-39 | non-blocking | ruled: CO-604 (32) |
| V3-UX-40 | UX-40 | non-blocking | fixed in the iteration-3 run-four candidate: an ended Switchboard-only session is named by its folder and agent, said as ended (links.continue.whichEnded); test «an ended session only Switchboard names is continued from its history» |
| V3-UX-41 | UX-41 | non-blocking | fixed in the iteration-3 run-four candidate: Агенты offers «Продолжить в Fabric» for a session Switchboard names that no process runs, and no «Закрыть» (MachineSessions.tsx); test «a session only Switchboard names that no process runs can be continued, not closed»; SCN-166 says so |
| V3-ER-26 | ER-26 | blocking | fixed in the iteration-3 run-four candidate: the asks App shows are a reducer (launch/continueQueue.ts, 7 tests), dispatched from the ask, and the ask calls the newest render's callbacks (ContinueSessionAsk.tsx latest); tests «a link that arrived during a press is shown after the press succeeds» and «the answer calls the callbacks of the newest render», red before |
| V3-ER-27 | ER-27 | non-blocking | fixed in the iteration-3 run-four candidate: gone for a session Switchboard lists says its history is not in a Claude folder Fabric reads (links.continue.goneHome); test «a Switchboard session whose history Fabric cannot read is not said as «not on this computer»» |
| V3-DO-28 | DO-28 | non-blocking | fixed in the iteration-3 run-four candidate: SCN-142 names the queued state and the CHANGELOG says a continue link waits behind another |
| V3-DO-29 | DO-29 | non-blocking | fixed in the iteration-3 run-four candidate: spec row 8 states the read-only exception and the ended case |
| V3-DO-30 | DO-30 | non-blocking | fixed in the iteration-3 run-four candidate: the header comment of ContinueSessionAsk.tsx says what the ask does now |
| V3-DA-25 | DA-25 | non-blocking | fixed in the iteration-3 run-four candidate: the CHANGELOG says the app the link names itself; the journal reason's wording ruled: CO-604 (33) |
| V3-PL-30 | PL-30 | blocking | fixed in the iteration-3 run-four candidate: items 2 to 4 of 3aa89c92 and the ideas dated 0.3.26 in 2cec2091 are CO-603 (11) and a row of spec §4, with their branches and tasks; thread 20ee2630 is told the version at the release |
| V3-PL-31 | PL-31 | non-blocking | fixed in the release commit: the ledger records each run's hosted run and local exit, and the Release close the session reading on the verified candidate |
| V3-PL-32 | PL-32 | non-blocking | fixed in the release close: the knowledge base's roadmap, products and plans pages updated to 0.3.26 in one fabric-workspace pull request after the publication |
| V3-PL-33 | PL-33 | non-blocking | fixed in the release close: the shipped tasks moved to review with the version, the partly shipped ones noted with what remains |
| V3-PL-34 | PL-34 | non-blocking | fixed in the iteration-3 run-four candidate: CO-603's owner column gives Fabric's half of (2) (installing the service, task c0e6b2d2) to this repository's release session |

### Run four, 19b42226 (superseded)

Candidate `19b422264b26d1dbed6b380574978d2f9cc0d25f`. Reports and receipts in
[`docs/evidence/reviews/0.3.26/iteration-3-19b42226/`](../reviews/0.3.26/iteration-3-19b42226/) (kept as the record; not
this iteration's receipts). Gate: hosted `ci.yml` run 44687173294 success (browser suites 26 of 26, 06:39:09Z); local
`ci.sh fast` with both browser variables set, exit 0, browser suites 26 of 26. Every run-two fix held, two in part. 19 findings, 2 blocking:
ER-26, run two's move of the waiting link to React state left the ask's answer calling a callback of an older render, so a
link waiting behind a successful press was dropped; UX-37, after a half-done answer a stale read hid the retry; both in
code the gate refuses after `verifiedCommit`, so the iteration runs again. PL-30, items 2 to 4 of the owner's release
order `3aa89c92` were in no record of this release.

| Row | Finding | Severity | Disposition |
|---|---|---|---|
| V3-UX-42 | UX-42 | blocking | fixed in the iteration-3 run-five candidate: Switchboard's account homes (homes/) are read beside runtimes/, for live sessions and transcripts alike (diskSessions.ts switchboardHomeRoots, claudeConfigDirs; ceoTools.ts defaultTranscriptRoots); test «Switchboard's account homes are Claude homes: their sessions are read and continued from history», red before |
| V3-UX-43 | UX-43 | non-blocking | fixed in the iteration-3 run-five candidate: Агенты asks an ended session's continue as one from history, nothing stopped (machineSessions.continueEndedAsk); test «a session only Switchboard names that no process runs can be continued, not closed» |
| V3-UX-44 | UX-44 | non-blocking | fixed in the iteration-3 run-five candidate: Агенты says gone for a Switchboard session as its history out of Fabric's reach (links.continue.goneHome); test «a Switchboard session whose history Fabric cannot read says so in the panel» |
| V3-UX-45 | UX-45 | non-blocking | fixed in the iteration-3 run-five candidate: after a half-done answer the ask names the stopped session from its first read and drops the opening question (links.continue.whichStopped); test «after a half-done answer the stopped session is named from the first read» |
| V3-UX-46 | UX-46 | non-blocking | fixed in the iteration-3 run-five candidate: SCN-142 says a running Switchboard-only session is said with «Закрыть» only |
| V3-UX-47 | UX-47 | non-blocking | fixed in the iteration-3 run-five candidate: the run-three link points at iteration-3-b83bed27/ |
| V3-ER-28 | ER-28 | non-blocking | fixed in the iteration-3 run-five candidate: after a half-done answer only a stale Switchboard read is not said; a live Claude Code row (continued elsewhere) is said as running and the press is a continue (ContinueSessionAsk.tsx resumedSince); test «a session continued elsewhere after a half-done answer is said as running» |
| V3-ER-29 | ER-29 | non-blocking | fixed in the iteration-3 run-five candidate: as UX-43 and UX-44 |
| V3-ER-30 | ER-30 | non-blocking | fixed in the iteration-3 run-five candidate: an act starts a new generation of the rows cache; a read begun before it is never fresh after it and is not joined (index.ts sbGen, sbInFlightGen); no test, the cache is inline wiring (CO-604 (19)) |
| V3-DO-31 | DO-31 | non-blocking | fixed in the iteration-3 run-five candidate: as UX-47 |
| V3-DO-32 | DO-32 | non-blocking | fixed in the iteration-3 run-five candidate: the run-three paragraph names ER-18's regression and the three in-part fixes with their gaps |
| V3-DO-33 | DO-33 | non-blocking | fixed in the iteration-3 run-five candidate: the AGENTS.md row names rowsChanged and the homes folder |
| V3-DO-34 | DO-34 | non-blocking | fixed in the iteration-3 run-five candidate: continueQueue.ts and its test in the FABRIC-0326 entry and in SCN-142's coverage |
| V3-DA-26 | DA-26 | non-blocking | fixed in the iteration-3 run-five candidate: as UX-44 |
| V3-PL-35 | PL-35 | blocking | fixed in the iteration-3 run-five candidate: the order 51d22d2b is CO-603 (12) and a row of spec §4, owner this repository's release session; thread fe5f93aa is told the version at the release |
| V3-PL-36 | PL-36 | non-blocking | fixed in the release close: it lists every thread the release owes a notice (20ee2630, 3ca40854, 12e4a915, fe5f93aa, 7e7889f6) and the people.ask 5467c685 |
| V3-PL-37 | PL-37 | non-blocking | fixed in the iteration-3 run-five candidate: as UX-47 |
| V3-PL-38 | PL-38 | non-blocking | fixed in the release close: post-tag acts are listed as owed items, each checked off with its receipt on main after the tag |
| V3-PL-39 | PL-39 | non-blocking | fixed in the iteration-3 run-five candidate: as DO-33 |

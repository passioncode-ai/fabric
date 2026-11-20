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

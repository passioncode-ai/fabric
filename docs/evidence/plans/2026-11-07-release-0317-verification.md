# Fabric 0.3.17 release verification

Release gate ledger for 0.3.17 ([the release runbook](../../launch/release-mac.md#how-a-release-is-made), P-02).
Three iterations, five reviewers each (ux, errors, docs, data, plan), every reviewer a fresh context reading the
candidate read-only; findings are disposed here and in the receipts under
`docs/evidence/reviews/0.3.17/`.

Asked on the project board on 2026-11-07 (request `fe51a4a6`, thread `c7c8ae82`), relaying the operator's words of
that day: release the version with CO-506 (a session's own project answers its requests at once; `fabric_access_*` on
the operator's word) and install it on the operator's Mac. Promised there: 0.3.17 by 2026-11-09.

## Protocol

- Baseline: tag `v0.3.16`. The reviewers read one clean checkout of the candidate, write nothing in it and record HEAD
  and `git status --short | wc -l` before and after.
- The review copies are redacted for publication (ADR-0096): private names replaced, home paths made `/Users/example`.
- A finding is fixed (with its test or check), ruled (with its register id), not a defect (with why), not recoverable,
  or stopped.
- Machine load on 2026-11-07 ran from 55 to 260 on 14 cores; a timing test that fails under that load and passes alone
  is recorded as such, never as a pass, and the hosted CI on the candidate is the tier's verdict.
- The push run of `ci` runs the fast tier only. The iteration-3 candidate also gets the full tier (a `workflow_dispatch`
  of `ci`, or `scripts/ci.sh full` on a disposable stack), its result recorded in *Iteration 3* (iteration 2, PL-1).

## What 0.3.17 carries

No schema step: the database stays at schema 100 (the newest migration is `20261030000127`). The `## Unreleased`
section of [`CHANGELOG.md`](../../../CHANGELOG.md) names every person-visible change since 0.3.16: CO-521 (a task in
review asks one decision), CO-522 waves A to C (the overlap note before a start, the overlap decision, «Написать
агенту»), CO-506 (a session's own project answers its requests at once; Agent access on the operator's word), CO-514,
CO-528 and CO-532 (a credential only to a hub this account runs), CO-530 with CO-517, CO-525 and FAA-231 (the board rule
as DEC-0152 released it), CO-489, CO-526, CO-409's dispatcher (wake, crash, timed-out, the mandate, following a request,
settled workflows), CO-510, CO-503 and CO-509 (the operations digest sent to Observatory), CO-508, CO-315 and CO-378 (not
yet tried on a Windows machine). Built but not active: the manager's tool set and its port (CO-522 wave D step 4), the
schema step's admission and backup (CO-364 step 1). Not person-visible: CO-512, CO-520 (the private-data gate), CO-529.

The candidates sit on the working branch `fix/co510-assign-retry`, each landed on `main` by fast-forward once its
hosted `ci` run is green; each iteration names its candidate's run.

## Owed in 0.3.17's Release close

Carried from 0.3.16's ledger (its *Owed in 0.3.16's Release close*), still open:

- The person's look at the opened release (carried since 0.3.15).
- A live run of the board dispatcher on this Mac: a request filed to a scratch project with no live session is
  answered by a started run, which ends; with the switch off nothing new starts. It needs fabric-agent-adapter 0.63 or
  later and Switchboard 0.7.15 or later on this Mac. This Mac has the adapter at 0.62.0: 0.63 reaches it through the
  launcher 0.2.76, which waits for an analytics secret from the operator (thread `cb1df3d5`), a person's step; until
  then the rollout leaves `dispatchBoardRequests` false (iteration 2, PL-5).
- Forty agent sessions at once on this Mac: the home, the left column and Агенты stay responsive.
- A live start of the local stack with the Docker engine stopped. Expected since CO-508: Colima starts and the docker
  context the person chose stays current (0.3.16 expected Colima's context to become current). It runs only after the
  rollout's readings, so a hang costs no install. This is CO-536's trigger: on 2026-11-08 a Docker ping froze 0.3.16's
  main process while Colima started. A hang is that known defect of 0.3.16 and 0.3.17, recorded here with its `sample`
  and the operations log's tail and told on thread `c7c8ae82`, never counted as a pass (iteration 3, PL-6).

New for 0.3.17:

- `node scripts/release-mac.mjs --check-only --tag v0.3.17` on the commit to be tagged reads green before the tag is
  pushed, its result written here.
- The runbook's step 7 (the published DMG smoked on this Mac: `chat-activation-native`, `smoke-platform --mcp-only`,
  `packaged-helpers`) and step 9 (the site's download redirects for macOS, Windows and Linux); a step not run is said
  here with its reason (iteration 2, PL-3).
- The runbook's step 10 (publish and pin the workspace from the release commit), with CO-535 (the scheduled
  publication has failed since 2026-11-03), and step 11 (Fabric's rows in the knowledge base). If the scheduled sync
  still fails, step 10 runs by hand from a clean `main`: `node scripts/workspace.mjs publish`, then
  `node scripts/workspace.mjs check --require-child`; if that fails too, its output is recorded here and CO-535 stays
  open (iteration 2, PL-6).
- The release handoff `docs/handoffs/<date>-release-0317.md` with the rollout as done (version, schema 100, the journal
  count, `hub.json`'s pid, `com.status`, `dispatchBoardRequests`), committed on `main` after the install (iteration 3,
  PL-4).
- After the tag: P-31 marked released with the tag and the rollout date, and the Now line moved, on `main`
  (`docs/evidence/backlog.md` cannot change after `verifiedCommit`; iteration 2, PL-4).
- On the board: the tag and the install to request `fe51a4a6` (thread `c7c8ae82`); the dispatcher switch's state to
  thread `1add3c03`; CO-503's first read-back and CO-509's remainder to thread `f7758225`; CO-532 to thread `eefa7959`.

Done for 0.3.16 (not carried): its `--check-only`, CO-512 (V3-56 to V3-61), its board follow-ups.

## Rollout on the operator's Mac

No schema step (schema 100 stays). Fabric 0.3.16 runs under the broker target `fabric.desktop`, opened by the person,
so the quit is the person's. Steps: the bundle `Fabric-0.3.17-universal.dmg` from the release, `SHA256SUMS`,
`codesign --verify --deep --strict` and `spctl` read back; the person quits 0.3.16; the 0.3.16 bundle is kept as the
way back; 0.3.17 is put in place and opened through the broker (`ensure_running`); readings: the version, schema 100,
the journal count, `hub.json`'s live pid, `com.status`, and `dispatchBoardRequests` read back unchanged (false on this
Mac until the conditions of thread `1add3c03` hold: adapter 0.63 or later, Switchboard 0.7.15 or later, the scratch
project's live check; CO-506 is now met).

## Closing checklist

In the release commit, after `verifiedCommit` (the iteration-3 candidate): `version` 0.3.17 in
`apps/desktop/package.json`, `## Unreleased` renamed `## 0.3.17`, and `docs/launch/release-gate.json` naming 0.3.17,
this ledger, `verifiedCommit` and three iterations of five receipts; `releaseMetadata` holding only 0.3.17's
final-verifier reports, or empty; this ledger with one `## Iteration N` section per iteration, each naming its candidate
in full and ending with its `Exit for iteration N` line (iteration 2, PL-4).

## Iteration 1

Candidate `a0a89d1bca7044ea7622ba52bfa3c5800c640320` (hosted `ci` 42409174606, green). Five reviewers, one per level;
their reports and receipts are in `docs/evidence/reviews/0.3.17/iteration-1/`. 49 findings, 9 blocking (6 distinct:
UX-1 = DO-1, PL-1 = DO-2, PL-2 = DO-3). Text checks of the new strings: reports `3ffdc24c` (ru-RU) and `7824d1d1`
(en-US), no findings.

| Finding | Level | Severity | What | Disposition |
|---|---|---|---|---|
| V1-1 | UX-1 | blocking | the release notes quoted a «На проверке» title the app no longer shows | fixed: the shipped title in both languages, with both cases it covers (`CHANGELOG.md`, «На проверке» bullet) |
| V1-2 | UX-2 | non-blocking | person-visible features missing from the notes | fixed: bullets for CO-521, CO-522 A to C, CO-526, CO-510, the digest sending (`CHANGELOG.md`) |
| V1-3 | UX-3 | non-blocking | the board-rule bullets contradicted each other; a blank line; a placeholder name | fixed: one bullet states the rule as shipped; the list is one; no placeholder (`CHANGELOG.md`) |
| V1-4 | UX-4 | non-blocking | «Вы сдал работу»; the agent's sentence when the person moved the task | fixed: one key per author and a person's own line (`i18n/ru.ts`, `i18n/en.ts`, `launch/ReviewDecision.tsx`); test `ReviewDecision.test.tsx` |
| V1-5 | UX-5 | non-blocking | the hand-in words differ between the task page and the card | ruled: CO-533 |
| V1-6 | UX-6 | non-blocking | the launch note interrupts any start in a busy project; raw relation ids | ruled: CO-533 (the notes now say the note names the sessions working there) |
| V1-7 | UX-7 | non-blocking | the person's words to an agent are kept in memory only | ruled: CO-533 (the notes now say unread words are lost on quit) |
| V1-8 | UX-8 | non-blocking | English refusal reasons inside Russian sentences | ruled: CO-533 |
| V1-9 | UX-9 | non-blocking | SCN-180's index row and status contradicted its section | fixed: «implemented in part» and «waves D and E open» (`docs/ux/scenarios.md`) |
| V1-10 | UX-10 | non-blocking | the accepted confirmation disappears at once | ruled: CO-533 |
| V1-11 | ER-1 | blocking | a hub 403 `peer-unverified` made fabric-mcp forget its credential | fixed: the hub answers an untold account 503 with Retry-After and code `peer-unverified` (`main/agentSurface.ts`); fabric-mcp reads a 403 naming a peer code as `HubPeerRefusedError`, never a revoked credential (`main/fabricMcpClient.ts#httpTransportWith`); test `connection-owner.test.mjs` «ER-1», watched failing with the check removed |
| V1-12 | ER-2 | non-blocking | a refused owner check reported as «may have run» | fixed: `classifyFailure` answers not run (`main/fabricMcp.ts`); test «ER-2» |
| V1-13 | ER-3 | non-blocking | an unknown listener verdict cached a minute | ruled: CO-533 |
| V1-14 | ER-4 | non-blocking | the 1 s settle window could refuse a stalled healthy hub | fixed: 3 s (`main/listenerOwner.ts#verifyConnection`) |
| V1-15 | ER-5 | non-blocking | `checkedFetch` never removed its abort listener | fixed: removed on the request's close (`main/fabricMcpClient.ts#checkedFetch`); test «ER-5», watched failing with the removal gone |
| V1-16 | ER-6 | non-blocking | synchronous account and owner reads on the request path | ruled: CO-533 |
| V1-17 | ER-7 | non-blocking | directory accounts disable the peer check | ruled: CO-533 |
| V1-18 | ER-8 | non-blocking | a crash mark lost when the request state is unread | ruled: CO-533 |
| V1-19 | ER-9 | non-blocking | a folder attach reported not done after it was done | ruled: CO-533 |
| V1-20 | ER-10 | non-blocking | returning a task in review is not atomic | ruled: CO-533 |
| V1-21 | ER-11 | non-blocking | a mandate trusted without its quote's source | ruled: CO-533 |
| V1-22 | ER-12 | non-blocking | the schema step's deadline does not stop `pg_dump` in the container | ruled: CO-364 (its step 3 wires the step and owns the deadline) |
| V1-23 | DA-1 | blocking | `boardDigest` as a seventh manifest key broke the private-history export | fixed: the board file's digest is written beside it in `board.sha256` and the manifest keeps its six keys (`main/backup.ts`, `shared/archive.ts#BOARD_DIGEST_FILE`); test `backup-paging.test.mjs` «DA-1: an archive take() writes passes the private-history preflight», watched failing with the seventh key back |
| V1-24 | DA-2 | non-blocking | held log lines stamped at flush | ruled: CO-533 |
| V1-25 | DA-3 | non-blocking | a dropped dispatch record not named | ruled: CO-533 |
| V1-26 | DA-4 | non-blocking | the mandate's words unredacted in the checkpoint | ruled: CO-533 |
| V1-27 | DA-5 | non-blocking | an agent's detach worded as the person's | ruled: CO-533 |
| V1-28 | DA-6 | non-blocking | the digest prune follows a clock set forward | ruled: CO-533 |
| V1-29 | DA-7 | non-blocking | the schema step's file handling once wired | ruled: CO-364 |
| V1-30 | PL-1 | blocking | the notes described superseded board rules | fixed: as V1-3 |
| V1-31 | PL-2 | blocking | the ledger's scope and the notes left out person-visible work | fixed: *What 0.3.17 carries* names every row; the notes as V1-2 |
| V1-32 | PL-3 | blocking | 0.3.16's owed Release-close items not carried | fixed: *Owed in 0.3.17's Release close*, with the Docker check's expectation restated |
| V1-33 | PL-4 | non-blocking | no rollout plan | fixed: *Rollout on the operator's Mac* |
| V1-34 | PL-5 | non-blocking | CO-506 resolved with work left | ruled: CO-534 |
| V1-35 | PL-6 | non-blocking | no general-plan row for 0.3.17; P-29 still planned | fixed: P-29 released, P-31 added in lane 2, the Now line (`docs/evidence/backlog.md`) |
| V1-36 | PL-7 | non-blocking | stale date cells | ruled: CO-533 |
| V1-37 | PL-8 | non-blocking | the workspace publication failing since 2026-11-03 | ruled: CO-535; steps 10 and 11 in the Release close |
| V1-38 | PL-9 | non-blocking | no closing checklist for the version and the gate | fixed: *Closing checklist* |
| V1-39 | PL-10 | non-blocking | CO-378's Windows behaviour stated as fact | fixed: «Not yet tried on a Windows machine» (`CHANGELOG.md`) |
| V1-40 | PL-11 | non-blocking | the candidates' branch and CI results not recorded | fixed: *What 0.3.17 carries* names the branch; each iteration names its run |
| V1-41 | DO-1 | blocking | as UX-1 | fixed: as V1-1 |
| V1-42 | DO-2 | blocking | as PL-1 | fixed: as V1-3 |
| V1-43 | DO-3 | blocking | as PL-2 | fixed: as V1-2 and V1-31 |
| V1-44 | DO-4 | non-blocking | the lifecycle row of the dispatcher predates the wake and the stop; the wake applies to requests a session files | ruled: CO-533 (the notes now say «a board request a session files») |
| V1-45 | DO-5 | non-blocking | the lifecycle table omits the per-request owner reads | ruled: CO-533 |
| V1-46 | DO-6 | non-blocking | two living specs before CO-528 and CO-530 | ruled: CO-533 |
| V1-47 | DO-7 | non-blocking | the ledger's next free id read CO-525 | fixed: CO-536 with the reservations named (`docs/evidence/specs/2026-08-16-software-fabric-carryover.md`) |
| V1-48 | DO-8 | non-blocking | the map's «Смотреть» links labelled as the change | fixed: labelled «предыдущая запись» (`docs/reports/map.html`) |
| V1-49 | DO-9 | non-blocking | CO-366 named applications on the operator's Mac | fixed: neutral words (`docs/evidence/specs/2026-08-16-software-fabric-carryover.md`, CO-366) |

Exit for iteration 1: every finding has a disposition. Blocking findings open: none.

## Iteration 2

Candidate `bc21883d67b84144d854e3c2b1a8f9f189c90bc2` (hosted `ci` 42418488305, green; landed on `main` by
fast-forward). Five reviewers, one per level; their reports and receipts are in
`docs/evidence/reviews/0.3.17/iteration-2/`. 29 findings, 7 blocking (6 distinct: ER-2 = DA-1). Text checks of the
strings changed in iteration 1 (`review.handedIn.*`, `review.saidNothingPerson`): reports `2871d195` (ru-RU) and
`38b3e2e7` (en-US), run by the docs reviewer (DO-5); of the strings added here: `b526a92a` and `b5ecda96` (ru-RU),
`e71d4446` and `9854b4fa` (en-US); no findings.

| Finding | Level | Severity | What | Disposition |
|---|---|---|---|---|
| V2-1 | UX-1 | blocking | the launch-check bullet promised a check before every start and two reasons no caller can produce | fixed: the bullet says what ships (a project page's task form and console, the files both name for a new task) and names the starts without it (`CHANGELOG.md`) |
| V2-2 | UX-2 | blocking | a review on the Board lost «Открыть» and pointed to a history the pane does not show | fixed: «Открыть» beside the review card on the Board; outside the task page the card says to open the task (`launch/BoardScreen.tsx`, `launch/ReviewDecision.tsx#ReviewDecision` `historyBelow`, `review.saidNothingOpen`, `review.saidNothingPersonOpen`); test `BoardScreen.test.tsx` «a review on the Board is decided there and still opens its task», watched failing on the candidate |
| V2-3 | UX-3 | non-blocking | SCN-179 did not describe who handed the work in or the person's no-note line | fixed: SCN-179's preconditions, steps, alt paths and coverage (`docs/ux/scenarios.md`) |
| V2-4 | UX-4 | non-blocking | «kept while Fabric runs» is wider than the bounds | fixed in the notes: the last 20 per session, at most 50 waiting lines (`CHANGELOG.md`); the page's lede ruled: CO-533 |
| V2-5 | UX-5 | non-blocking | the credential bullet stated Windows as tried | fixed: «not yet tried on a Windows machine» (`CHANGELOG.md`) |
| V2-6 | UX-6 | non-blocking | `com.accept` said to close a request; the agents-first rule unnamed | fixed: accepted before its effect, reported, closed with `com.complete`; whoami's bullet names the rule (`CHANGELOG.md`) |
| V2-7 | ER-1 | blocking | the netstat fallback read a pid chosen through the process name, so another account's process could read as this one's | fixed: the process column is cut by position (ten fields before, eight after) and its pid is the column's last `:digits`; any other shape names no pid (`main/listenerOwner.ts#serverEndPidsFromNetstat`); test `connection-owner.test.mjs` «CO-532 (DEC-0155 RT-1)» with a captured row and a name `x:1 y`, watched failing on the candidate |
| V2-8 | ER-2 | blocking | the person's restore never read `board.sha256` | fixed: as V2-14 |
| V2-9 | ER-3 | non-blocking | CO-364 did not carry iteration 1's ER-12 and DA-7 | fixed: CO-364's step-3 note (`docs/evidence/specs/2026-08-16-software-fabric-carryover.md`) |
| V2-10 | ER-4 | non-blocking | a connection never made reported as possibly run | fixed: `classifyFailure` reads the socket code on the error itself too (`main/fabricMcp.ts#classifyFailure`); test `fabric-mcp.test.mjs` «classifyFailure», watched failing on the candidate |
| V2-11 | ER-5 | non-blocking | the schema step's dump does not stop on a failed write | ruled: CO-364 (step 3) |
| V2-12 | ER-6 | non-blocking | a damaged `board.sha256` read as absent | fixed: as V2-15 |
| V2-13 | ER-7 | non-blocking | the manager's `assign_across` mints a key per call | ruled: CO-533 (the manager is not wired yet, CO-522 wave D) |
| V2-14 | DA-1 | blocking | the CO-315 claim held only in `createBackups`, which nothing calls; the person's restore ignored the digest | fixed: `privateHistory` reads `board.sha256` before any write, refuses a lost board file `board_missing` (named, with the file to copy back) and a different one `integrity_mismatch`, copies the digest into its operation and checks it again at the board stage (`main/privateHistory.ts#createPrivateHistory`, `PrivateHistoryPanel.tsx`, `history.reason.board_missing`); tests `private-history-service.test.mjs` (lost, different, damaged, and a file gone from the operation's copy) and `PrivateHistoryPanel.test.tsx`, watched failing on the candidate |
| V2-15 | DA-2 | non-blocking | `readBoardDigest` read a damaged file as absent | fixed: `shared/archive.ts#readBoardDigestFile` answers absent only on ENOENT, a malformed or unreadable file is corrupt; test `backup-paging.test.mjs`, watched failing on the candidate |
| V2-16 | DA-3 | non-blocking | CO-315's row still described the manifest field | fixed: CO-315's resolution describes `board.sha256` (`docs/evidence/specs/2026-08-16-software-fabric-carryover.md`) |
| V2-17 | DA-4 | non-blocking | iteration 1's DA-7 ruling reached no row | fixed: as V2-9 |
| V2-18 | DO-1 | blocking | as DA-3 | fixed: as V2-16 |
| V2-19 | DO-2 | blocking | CO-514, the spec and the full-tier probe still said an untold caller is refused 403 | fixed: CO-514 and `2026-11-06-studio-spaces-gaps.md` amended, the comment in `main/agentSurface.ts`, and `test/agent-surface.test.mjs` expects 503 with Retry-After for `unverified` and 403 for `foreign`; it runs in the full tier on the iteration-3 candidate |
| V2-20 | DO-3 | non-blocking | CO-528's settle window and macOS order out of date | fixed: CO-528 amended |
| V2-21 | DO-4 | non-blocking | as UX-4 | fixed: as V2-4 |
| V2-22 | DO-5 | non-blocking | the text checks did not cover iteration 1's changed strings | fixed: the reports named above |
| V2-23 | DO-6 | non-blocking | CO-534's pointer to ADR-0190; CO-533's DO-5 note | fixed: both rows amended |
| V2-24 | PL-1 | non-blocking | the full-tier probe asserts the old 403 and no full run covers a candidate | fixed: as V2-19; *Protocol* owes a full-tier run on the iteration-3 candidate |
| V2-25 | PL-2 | non-blocking | as ER-3 | fixed: as V2-9 |
| V2-26 | PL-3 | non-blocking | the runbook's steps 7 and 9 not owed | fixed: *Owed in 0.3.17's Release close* |
| V2-27 | PL-4 | non-blocking | the checklist missed `releaseMetadata`, the iteration sections and P-31's close | fixed: *Closing checklist* and *Release close* |
| V2-28 | PL-5 | non-blocking | the dispatcher item lost its human gate | fixed: *Release close* restates the chain and its owner |
| V2-29 | PL-6 | non-blocking | CO-535 sat outside the release lane; step 10 had no manual route | fixed: CO-535 in lane 2 (`docs/evidence/backlog.md`); step 10's route in *Release close* |

Exit for iteration 2: every finding has a disposition. Blocking findings open: none.

## Iteration 3

Five fresh reviewers started on `4344c25c50104e129d975a36093da429e6861b21` (hosted `ci` push run 42426288202, green;
the full tier, `workflow_dispatch` run 42426416148, owed by *Protocol*). Their first reading found 17 findings, 4
blocking (2 distinct: the full-tier probe, ER-1 = PL-1 = DO-1, and SCN-179's step 5, UX-1). The probe's 503 loop had
been put above the template literal the probe runs, so `node test/agent-surface.test.mjs` threw at its first line and
the probe's own loop still asserted 403: the full-tier run on `4344c25c` could not pass, and V2-19 and V2-24 were not
fixed as recorded. The fixes below made the next candidate,
`e917e8aa43b8d2fc4b605e458a584dc572c481ae`; the same five reviewers then read the delta `4344c25c..e917e8aa` and closed
against it, as 0.3.7's third iteration did. Their reports, written as of `e917e8aa`, are in
`docs/evidence/reviews/0.3.17/iteration-3/`.

The full tier on `4344c25c` (`workflow_dispatch` run 42426416148) failed before it reached the probe: the owned-cluster
runner `run-ceo-private-archive-db` stopped at `test/private-history-native-db.test.mjs:70`, whose list of an export's
files did not have `board.sha256`, written since iteration 1's DA-1 fix. The nightly full tier on `main` at `bc21883d`
(run 42433463558) failed on the same assertion. Fixed in `e917e8aa` (V3-18); the suite then ran green on this Mac on
an owned cluster ("private history in main: 6 groups"). On `e917e8aa`: push run 42435076677, green, and `workflow_dispatch`
run 42435115398, green in all its jobs: `fast`, and `full: with a disposable stack`, which ran the agent-surface probe's
403 and 503 answers on a stack (V3-6, V3-11, V3-14). Text checks of the reworded `history.reason.board_missing`: reports
`53c4ca47` (ru-RU) and `1b911eb7` (en-US), no findings.

| Finding | Level | Severity | What | Disposition |
|---|---|---|---|---|
| V3-1 | UX-1 | blocking | SCN-179's step 5 said the home card's title opens the task; it opens the item on the Board | fixed: step 5 says the title opens it on the Board, where «Открыть» opens the task page (`docs/ux/scenarios.md`) |
| V3-2 | UX-2 | non-blocking | a refusal after the restore wrote reads «Ничего не записано» | ruled: CO-533 (the board stage no longer refuses, V3-7) |
| V3-3 | UX-3 | non-blocking | the two languages of `history.reason.board_missing` said different things | fixed: one meaning in both, the archive's original copy (`i18n/ru.ts`, `i18n/en.ts`) |
| V3-4 | UX-4 | non-blocking | SCN-146 did not describe the lost-board-file refusal | fixed: SCN-146's alt paths, UI elements, states and coverage (`docs/ux/scenarios.md`) |
| V3-5 | UX-5 | non-blocking | the say-to-agent lines are also dropped after a day | fixed: «for a day» in the bullet (`CHANGELOG.md`) |
| V3-6 | ER-1 | blocking | the full-tier probe's 503 loop sat outside the template and the probe still asserted 403 | fixed: the outer block removed; the probe's loop expects 403 `peer-foreign-account` and 503 `peer-unverified` with `retry-after` 5 and the body's code (`apps/desktop/test/agent-surface.test.mjs`); `node --check` and `check-probes.mjs` pass; the full tier on the next candidate is recorded below |
| V3-7 | ER-2 | non-blocking | a board file gone from the operation's own copy kept the restore pending for good | fixed: the board stage finishes with `board_history: board_missing` and the Estate opens (`main/privateHistory.ts#createPrivateHistory`); test `private-history-service.test.mjs`, watched failing on `4344c25c` |
| V3-8 | ER-3 | non-blocking | `--activate=false` on a Colima too old to know it fails unseen | ruled: CO-533 |
| V3-9 | DA-1 | non-blocking | as ER-2 | fixed: as V3-7 |
| V3-10 | DA-2 | non-blocking | the digest collector offers only two months of closed days | ruled: CO-533 (the binding is not issued yet, nothing is sent) |
| V3-11 | DO-1 | blocking | as ER-1 | fixed: as V3-6 |
| V3-12 | DO-2 | non-blocking | CO-514 cited `agentSurface.ts#createAgentSurface` | fixed: `agentSurface.ts#AgentSurface` (`docs/evidence/specs/2026-08-16-software-fabric-carryover.md`) |
| V3-13 | DO-3 | non-blocking | the `peer-account` module header still said refused | fixed: 403 for another account, 503 with Retry-After for one it cannot tell (`main/peerAccount.ts`) |
| V3-14 | PL-1 | blocking | as ER-1, and the gate needs iteration 3's candidate to be `verifiedCommit` | fixed: as V3-6; the reviewers close against the next candidate |
| V3-15 | PL-2 | non-blocking | as DO-2; the register gate skips the carry-over register's citations | fixed: as V3-12; the gate's skip ruled: CO-533 |
| V3-16 | PL-3 | non-blocking | the Now line still said «Next P-29» | fixed: the Now line names P-27 next (`docs/evidence/backlog.md`) |
| V3-17 | PL-4 | non-blocking | no release handoff owed | fixed: *Owed in 0.3.17's Release close* |
| V3-18 | CI | blocking | the full tier's private-history test listed an export's files without `board.sha256` (runs 42426416148 and 42433463558) | fixed: the list has five files, each 0600 (`apps/desktop/test/private-history-native-db.test.mjs`); green on an owned cluster on this Mac |
| V3-19 | ER-4 | non-blocking | a restore whose board texts did not come back finishes looking whole: the History panel never shows `board_history` | not a defect: SCN-146 declares the panel does not show `board_history` yet (COM-07's later slices), as in 0.3.16; «said as lost» in the board stage's comment means recorded in the result |
| V3-20 | DO-4 | non-blocking | «kept for a day» stated a bound the page applies only when the next line is written | fixed: the bullet says the page keeps the last 20 lines, a line older than a day leaves when the next is written, and unread words wait in the queue, at most 50 (`CHANGELOG.md`, release metadata) |
| V3-21 | DO-5 | non-blocking | the map quoted words no screen shows | fixed: the entry says the result records `board_history: board_missing` and the panel does not show it yet (`docs/reports/map.html`, release metadata) |
| V3-22 | PL-5 | non-blocking | *Iteration 3* did not name `e917e8aa` in full, the failed full-tier runs, their cause, or the native test's row | fixed: this section names the candidate, runs 42426416148, 42433463558, 42435076677 and 42435115398, and V3-18 |
| V3-23 | PL-6 | non-blocking | the Docker-stopped check of *Release close* can trigger CO-536 and be read as a pass | fixed: *Owed in 0.3.17's Release close* ties the check to CO-536 |

Exit for iteration 3: every finding has a disposition. Blocking findings open: none.

## Release close, as done

Recorded on `main` after the tag (2026-11-08).

- `node scripts/release-mac.mjs --check-only --tag v0.3.17` on `1ac42780` (`main` after the release commit's hosted `ci`
  run 42437826293, green): "release: Fabric 0.3.17 at 1ac427803622 (v0.3.17) is on origin/main and its release gate is
  clear". The tag `v0.3.17` was pushed on `1ac42780`.
- The release run 42438810794: success in every job (guard, preflight, macos, windows x64 and arm64, linux x64 and
  arm64, publish); the release was published 2026-11-08 02:54:51 UTC with the DMG, the Windows installers, the Linux
  AppImages and packages, their manifests and `SHA256SUMS` with its signature.
- The published `Fabric-0.3.17-universal.dmg` read back on this Mac: SHA-256
  `73733bd0661f997265054eef7d8b69dce5072c4d067aeb58ec1eda741c3659f9`, equal to `SHA256SUMS`;
  `codesign --verify --deep --strict` passes; `spctl` accepts it as "Notarized Developer ID"; version 0.3.17; the main
  binary carries x86_64 and arm64.
- Step 10, the workspace publication: run by hand from `main` (`1ac42780`) and refused at the workspace's own content
  check (`npm run verify:content`): another repository's backlog (`passioncode-ai/passioncode`, `docs/backlog.md`,
  rows PC-97 and PC-138) has a `|` inside a code span that is not escaped, so its table rows have five cells where the
  header has four ("Malformed task table row"). This is CO-535's cause as of today; the ask goes to that project on
  the board once the hub answers. CO-535 stays open; the workspace stays pinned at its earlier snapshot.
- The rollout: waits. The installed 0.3.16 froze at 00:37 UTC (CO-536) and was opened by the person, so the lifecycle
  broker refuses to stop it (`in_use_by_person`, `not_started_by_broker`); the person was told once, with the one step
  (quit it). A watcher keeps the 0.3.16 bundle as the way back and puts 0.3.17 in place once 0.3.16 has exited; 0.3.17
  is then opened through the broker and the rollout's readings are recorded here.
- Not yet run: steps 7 and 9 and the Docker-stopped check (after the rollout), step 11, the board's replies (the board
  answers again once the hub does).

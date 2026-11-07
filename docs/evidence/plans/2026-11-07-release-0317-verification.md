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
  later and Switchboard 0.7.15 or later on this Mac.
- Forty agent sessions at once on this Mac: the home, the left column and Агенты stay responsive.
- A live start of the local stack with the Docker engine stopped. Expected since CO-508: Colima starts and the docker
  context the person chose stays current (0.3.16 expected Colima's context to become current).

New for 0.3.17:

- `node scripts/release-mac.mjs --check-only --tag v0.3.17` on the commit to be tagged reads green before the tag is
  pushed, its result written here.
- The runbook's step 10 (publish and pin the workspace from the release commit), with CO-535 (the scheduled
  publication has failed since 2026-11-03), and step 11 (Fabric's rows in the knowledge base).
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
this ledger, `verifiedCommit` and three iterations of five receipts.

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

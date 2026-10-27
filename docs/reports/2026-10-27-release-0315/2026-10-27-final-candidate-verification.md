# Fabric 0.3.15: verification of the final candidate

- **Candidate:** `112779af7fccd9444779b4e72983c535ac160ebc` (detached checkout `/Users/sshlg/DATA/_worktrees/fabric-0315-final`; tests and gates run from `/Users/sshlg/DATA/_worktrees/fabric-mockup-parity`, same HEAD).
- **Before:** both checkouts at HEAD `112779af7fccd9444779b4e72983c535ac160ebc`, `git status --short | wc -l` = 0 in each.
- **After:** both checkouts at HEAD `112779af7fccd9444779b4e72983c535ac160ebc`, `git status --short | wc -l` = 0 in each. Nothing in either repository was written.
- **Date:** 2026-10-27.
- **Reviewer run id:** `release-0315-final-verify-20261027`.
- **Method:** read the ledger's «Iteration 3» (V3-1 to V3-18) and «Release» against `git diff dbb69aa4..112779af` (30 files, 10 of them code or tests); read the whole code diff for new defects, with the callers of `onWorkRow`, `groupInWork`, `withWorkSignals` and `withWaitingList`; ran 9 test files strictly one at a time; ran the five docs gates once each with the exit code read directly. No build, no stack, no database, no Docker, no app started.

## Tests run (one at a time, from `apps/desktop`)

| File | Runner | Result |
|---|---|---|
| `test/comms-waiting-list.test.mjs` | `node --experimental-strip-types --test` | exit 0, 4 pass (ER-15 case by name) |
| `test/work-rhythm.test.mjs` | node --test | exit 0, 9 pass (ER-11/ER-14 and the new ER-14 case by name) |
| `test/delivery.test.mjs` | `node --experimental-strip-types` | exit 0, "all green", «typing moves the activity clock, never the output clock» ok |
| `src/shared/homeProjects.test.ts` | `npx vitest run` | exit 0, 12 pass (DA-15 case) |
| `src/shared/agentWork.test.ts` | vitest | exit 0, 5 pass |
| `src/shared/railAgents.test.ts` | vitest | exit 0, 8 pass |
| `src/renderer/src/launch/HomeInWork.test.tsx` | vitest | exit 0, 16 pass |
| `src/renderer/src/launch/Rail.test.tsx` | vitest | exit 0, 28 pass |

## Iteration 3 findings

| Finding | Verdict | Evidence |
|---|---|---|
| V3-1, V3-2 | holds (ruled) | CO-483 (carry-over line 498) names both, target 2026-11-05; cited in lane 12 of `docs/evidence/backlog.md` and in P-30. |
| V3-3, V3-4 | holds (ruled) | CO-477 (line 492) extended with the unordered stage-report read, the unsaid full claims read and the turns index. |
| V3-5 | holds | `test/work-rhythm.test.mjs`: ER-11 test renamed to what it proves; the new ER-14 case passed. Test-only change, the reader (`main/workRhythm.ts`) is unchanged and already did what the case asserts. |
| V3-6 | holds | `main/commsWaitingList.ts:43-45` catches a rejected `deps.threads()`; `threads.ok` false leaves subjects empty (`:57`). Test passed. |
| V3-7, V3-17 | holds | P-30 reads «iteration 3 of 3 closed with no blocking finding», names CO-481 to CO-483; the ledger has «Iteration 3». |
| V3-8 | holds | the Rollout wording read in the ledger; no engine named. |
| V3-9 | holds | `CHANGELOG.md:18-19` now names the working heartbeat. |
| V3-10 | holds | `homeProjects.ts#onWorkRow` and `groupInWork` as in the ledger; `agentWork.ts:82` `connectedIdle` counts only no-task agents; DA-15 test passed; `railAgents.ts` uses the same `onWorkRow` (Rail and railAgents tests passed). |
| V3-11 | holds | CHANGELOG says a quiet agent with no task is listed on Агенты only. |
| V3-12 | holds (ruled) | CO-475 (line 490) extended with tasks, history and held time. |
| V3-13, V3-14 | holds (ruled) | CO-481 (line 496) and CO-482 (line 497), each in lane 12 and P-30. |
| V3-15 | holds | `pty.ts` keeps `lastOutputAt` set only in the output handler (`:636-639`), exposed as `TerminalSession.lastOutputAt`; `index.ts#heldSessions` judges `outputAt` by it. Delivery test passed. |
| V3-16 | holds | the «Release» section is an ordered list of six steps. |
| V3-18 | holds | `docs/reports/2026-10-27-mockup-parity/README.md` names the rows not ticked and the evidence. |

Iteration 3: 18 of 18 dispositions true at the candidate; 9 cited CO rows (475, 477, 481, 482, 483 and the earlier ones) exist with 9 columns and an open status.

## New findings

| Id | Severity | Blocking | Where | Evidence |
|---|---|---|---|---|
| FV-1 | low | no | `apps/desktop/src/shared/homeProjects.ts:20,158` | `onWorkRow` now keeps any agent that holds a task, so a connected agent that is not silent but whose task is carried from an earlier session id (`fromEarlierSession`, never work by `workOf`) keeps a row and is counted in «молчат» (`agentsQuiet`), though it is not stale. The sentence is only a word choice; the strip and cards still reconcile (cards less quiet equal `atWork.agents`). A wording row for 0.3.15's next release. |
| FV-2 | low | no | `apps/desktop/src/main/index.ts:1473-1480` | `outputAt` is null until a console has printed, so a just-launched console that has not yet printed no longer counts as printed (before, its start time did). Intended by DA-20; noted so the first minute of a console reads «подключён», not «работает», until its first output. |

No blocking finding. Code read in full: `onWorkRow`, `groupInWork` (only caller passes `atWorkOnly: true`, `HomeInWork.tsx:51`), `withWorkSignals`, `withWaitingList`, `PtyManager` (field set at creation, in the data handler and in the listing only), `TerminalSession` (optional field, older hosts give null), `heldSessions`. No migration, no secret, no change outside the reviewed surfaces.

## Gates (run once each from `/Users/sshlg/DATA/_worktrees/fabric-mockup-parity`, exit codes read directly)

| Gate | Exit | Output tail |
|---|---|---|
| `node scripts/check-registers.mjs` | 0 | PASS: registers parse, citations resolve, asserted counts recompute (479 carry-over rows, 198 milestones, 1618 verification rows) |
| `bash scripts/check-docs.sh` | 0 | PASS: Fabric documentation structure |
| `node scripts/check-design-map.mjs` | 0 | PASS: map source stamp (6918 files), 912 unique anchors and 2495 link targets |
| `node scripts/check-regions.mjs` | 0 | PASS code regions: 622 marker(s) |
| `node scripts/check-plan-ids.mjs` | 0 | PASS general plan: every cited id resolves |

Added lines carry no new U+2014 in text for people (the two matches in the diff are unchanged pre-existing sentences inside edited rows of `docs/evidence/backlog.md`).

## Verdict

Ready to tag. Every iteration 3 disposition is true at `112779af`, the changed tests pass, the five gates exit 0, and the two new findings are low and non-blocking.

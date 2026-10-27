# Fabric 0.3.14: verification of the final candidate

- **Candidate:** `39c82b7b07ca5f32b4f414c60b00c3e5403baa59` on `release/0.3.14` (`/Users/sshlg/DATA/fabric`).
- **Before:** HEAD `39c82b7b07ca5f32b4f414c60b00c3e5403baa59`, `git status --short | wc -l` = 0.
- **After:** HEAD `39c82b7b07ca5f32b4f414c60b00c3e5403baa59`, `git status --short | wc -l` = 0. Nothing in the repository was written.
- **Date:** 2026-10-27.
- **Reviewer run id:** `release-0314-final-verify-20261027`.
- **Method:** read every fix commit of `git log 0b633afe..39c82b7b` (19 commits, 40 files) against iteration 3's five reports and the plan's «Review, iteration 3»; read the whole code diff for new defects; ran 8 test files strictly one at a time (memory and disk were near their limits: swap about 38 of 38 GB, about 420 MB free disk); ran the five docs gates once each with the exit code read directly. No build, no Playwright, no database, no app or service started or stopped. Board items were checked as citations in the plan and the rows, not re-read on the board.

## Tests run (one at a time, from `apps/desktop`)

| File | Runner | Result |
|---|---|---|
| `test/agent-goals.test.mjs` | `node --experimental-strip-types --test` | exit 0, 12 pass, 0 fail (UX-22, PL-13 x2, DA-7, ER-24/DA-8 by name) |
| `test/abandoned-sweep-run.test.mjs` | node --test | exit 0, 82 pass, 0 fail (ER-22 x2, ER-23/DA-9 by name) |
| `test/agent-branches.test.mjs` | node --test | exit 0, 7 pass, 0 fail (ER-28 by name) |
| `src/shared/sessionStatus.test.ts` | `npx vitest run` | exit 0, 7 pass |
| `src/shared/sessionTasks.test.ts` | vitest | exit 0, 8 pass |
| `src/renderer/src/launch/CrossProjectConsole.test.tsx` | vitest | exit 0, 8 pass (ER-26, ER-25/UX-23 by name) |
| `src/renderer/src/launch/Rail.test.tsx` | vitest | exit 0, 27 pass (UX-26 assertion) |
| `src/renderer/src/launch/AgentsScreen.test.tsx` | vitest | exit 0, 22 pass (UX-25 by name) |

Not run (read only): `HomeInWork.test.tsx` (UX-22 case), `protocolObligations.w2.test.ts` (DO-12 case), `spawnParent.test.ts` (ER-24 unit cases).

## Iteration 3 findings

| Finding | Verdict | Evidence |
|---|---|---|
| UX-26 (blocking) | holds | `bd60cd3c`: `LaunchShell.tsx:305-307` writes ` · {status}` for every status, «Работает» included; dot keeps `role="img"` name (`:298-299`). `Rail.test.tsx` asserts ` · Working` and the img name; passed. CHANGELOG.md:51 sentence now true. |
| UX-22 | holds | `be03d084`: `agentGoals.ts:93` `isTask: root.task === a.task.id && !fromGoal`; test `agent-goals.test.mjs` «UX-22: …» passed (link and goal_id cases); `HomeInWork.test.tsx` «UX-22: …» read. See FV-1 for a residual edge. |
| UX-23 | holds | `803147d6`: `CrossProjectConsole.tsx` «Консоль не открылась» only when `!current`; started session said alone; «Открыть сессию» clears `tabFailed`. Test «ER-25, UX-23: …» passed. |
| UX-24 | holds | `4e828fba`: `sessionTasks.ts:134` any released claim is `dropped` or `handed`, never `inWork`; test asserts `done` release with `backlog` and `running` is `handed`; passed. |
| UX-25 | holds | `967780a9`: `AgentsScreen.tsx:288` shows `agentPage.unread` («Список агентов не прочитан, поэтому открыть агента нельзя.», `ru.ts:1817`) when an arrival is unmatched and the reading failed; test «UX-25: …» passed. |
| UX-27 | holds | `1adb402b`, `b329cd0d`: dated 2026-10-27 amendments in `docs/ux/scenarios.md` for SCN-158, SCN-162, SCN-166, SCN-174 and `docs/ux/screens.md` SCR-87. |
| ER-22 | holds | `73723448`: `abandonedSweep.ts:303-314` `mayBeReleaseStep` (now also requires `how === 'done'`) and `isReleaseStep` requires `movedFrom === 'backlog'`; `abandonedSweepRun.ts:567-580` reads the last `task.moved@1` `from` only for those tasks, an unread move is never taken as the release's step. Payload carries `from` (`workTools.ts:481,575`). Two ER-22 tests passed. |
| ER-23 | holds in part, as ruled | `d8d60370`: `abandonedSweepRun.ts:296` blinds `task-unclaimed` and `terminal-stalled` when a chunk is capped, `:404` keeps their last findings, `:372` adds `tasks` to `capped`; `SWEEP_CAPS` gains `tasks` (`abandonedSweep.ts:37`) and the ingress schema reads it (`commandIngress.ts:203`). Re-judging is CO-465 (P-29), cited in the plan and the carry-over row 480. Side effect noted: while capped, a judged task's resolved finding of those kinds also stays shown (the blind rule is per kind). |
| ER-24 | holds | `8c9ad5a7`: `agentSurface.ts:2024-2035` walks one hop per read (`spawnParent.ts#spawnedChainFrom`, at most `DEFAULT_BOUND + 1` reads), a failed read files the piece unlinked with `spawned_from_why`; wire test «ER-24, DA-8: …» passed. |
| ER-25 | holds | `803147d6`: the unsaved note is its own `role="alert"` line; test passed. |
| ER-26 | holds | `803147d6`: `started` is a record by project and sentence; test «ER-26: …» passed. |
| ER-27 | holds | `e58315d2`: `sessionStatus.ts:48` returns `ended` first when `stoppedByFabric`; test asserts 143 and 130 ended, 143 not by Fabric is error; passed. CHANGELOG `f97218de`. |
| ER-28 | holds | `55757d7d`: `agentBranches.ts:37` uses `killSignal: 'SIGKILL'` (threaded through `gitRun.ts:133,205`); slot freed at `timeoutMs + 1 s` from the slot, at most `limit` stuck; queued unwanted work runs no git; an unran folder leaves the cache. Test «ER-28: …» passed. |
| DA-7 | holds | `8c9ad5a7`: proposal answer carries `spawned_from: null` and `spawned_from_why` (`agentSurface.ts:2062-2064`); CHANGELOG `77127389` says terminal sessions now meet the bound; test «DA-7: …» passed. |
| DA-8 | holds | as ER-24: per-hop reads, errors kept, no 1 000-row map. |
| DA-9 | holds in part | as ER-23. |
| DA-10 | holds | `sessionStatus.ts` header no longer claims an open question counts unless `asking` is passed; `AGENTS.md` home reading row names the heartbeat read (`68d6838e`). |
| DO-9 | holds | `AGENTS.md` sweep row now says the claims history newest first, 1 000 per hundred tasks, `work.sweep-claims-capped`, `capped` names `tasks`; the done repair exception matches the code. |
| DO-10 | holds | `AGENTS.md` home reading row: «Главная uses the shell's reading». |
| DO-11 | holds | as UX-27. |
| DO-12 | holds | `16021faa`: `protocolObligations.ts:140` «your current task in the goal's place»; plan line 239-241 carries the dated correction; only remaining «current step» wording is that quoted history. |
| DO-13 | holds | `docs/evidence/backlog.md:136` P-27 names CO-461 and CO-463; P-29 (line 138) carries CO-465. |
| DO-14 | holds | CHANGELOG.md:80-81 «Передано» includes «released by you, said «Снята вами»» (`ru.ts:1829`); SCR-87 amendment says the same. |
| PL-9 | holds (cited) | plan line 111 and 267 cite Fabric's `621b24e1` on `d683f99d`; CO-457 (carry-over line 472) cites `621b24e1`, PL-9 and Dashboards' `1269d738`. |
| PL-10 | holds (cited) | plan line 123 and 268 cite `451bbcad` on `7ef21793` correcting `1f60252c`. |
| PL-11 | holds (cited) | plan line 269, v2 §4.6 lines 419-422 cite `6a8d2f9c` and `1002bc73`; CO-457 cites `6a8d2f9c` and PL-11. The answer's own message id is not cited, only the thread (non-blocking). |
| PL-12 | holds (cited) | CO-452 (line 468) cites `e2d4ecab`; CO-464 (line 479) cites `44a26740` and `6dd910c2`. |
| PL-13 | holds | `agent-goals.test.mjs` drives `fabric_task_create` through a real `AgentSurface` and an MCP client over an in-memory database: one claim links, two claims link nothing with the reason; both passed. |

Iteration 3: 28 findings re-checked, 26 hold, 2 hold in part as the plan rules (ER-23, DA-9, re-read filed as CO-465). None does not hold.

## New findings

| Id | Severity | Blocking | Where | Evidence |
|---|---|---|---|---|
| FV-1 | low | no | `apps/desktop/src/main/agentGoals.ts:87-89`, `apps/desktop/src/renderer/src/launch/AgentPage.tsx:217-220` | When a Plan goal leads (UX-22), the goal block shows the task's `brief_what` under the goal's title, `byPerson` is the task's origin (so a goal the person defined in Plan is not said «поставили вы»), and «Открыть цель» opens the root task, not the Plan goal. Already so in 0.3.13-era code for a non-root task with a `goal_id`; UX-22 extends it to the root case. No shipped sentence made false; a board row for 0.3.15. |
| FV-2 | low | no | `apps/desktop/src/shared/spawnParent.ts:49` | `spawnedChainFrom` follows only the lexicographically first `spawned` parent when a task has several, so a longer chain or a cycle through another parent is not counted. The replaced single-request map also kept one parent per task (whichever row came last), so this is no regression. |

No new blocking finding. Diff read in full: the journal read for ER-22 has precedent (`.eq('payload->>…')` in `chainAdvance.ts:540`, `actLog.ts:45`) and runs only for tasks in the 60 s window; `readRunningTasks` has one caller (`main/index.ts:2786`) and the sweep accepts both shapes; `laneOf` has one consumer (`AgentPage.tsx:146,150`); no migration, no secret, no change to what 0.3.13 shipped outside the reviewed surfaces.

## Gates (run once each from the repository root, exit codes read directly)

| Gate | Exit | Output tail |
|---|---|---|
| `node scripts/check-registers.mjs` | 0 | PASS: registers parse, citations resolve, asserted counts recompute (462 carry-over rows, 198 milestones, 1618 verification rows) |
| `node scripts/check-plan-ids.mjs` | 0 | PASS general plan: every cited id resolves |
| `bash scripts/check-docs.sh` | 0 | PASS: Fabric documentation structure |
| `node scripts/check-regions.mjs` | 0 | PASS code regions: 612 markers |
| `node scripts/check-design-map.mjs` | 0 | PASS: map source stamp (6818 files), 902 anchors, 2472 link targets |

Added lines of the candidate carry no new U+2014 in text for people (the two matches are unchanged pre-existing sentences in edited rows of `docs/evidence/backlog.md`).

## Verdict

ready to tag

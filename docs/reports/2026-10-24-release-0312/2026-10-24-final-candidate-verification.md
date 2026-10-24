# Fabric 0.3.12 release review, iteration 3: the final candidate's verification

- **Verifier run id:** `release-0312-i3-final-verifier-20261024`
- **Date:** 2026-10-24
- **Read:** `b314a37cc7d97539dd5cacda2eb7547bb57243c2..020e901927efce4e366d73b2a6e3ea8c72efbde4` (11 commits, 49 files, `git log` and `git diff`), against the five iteration-3 reports in `rv-0312-out/iteration-3/` (34 findings: UX-1 to UX-9, ER-1 to ER-8, DO-1 to DO-8, DA-1, DA-2, PL-1 to PL-5).
- **Checkout state before:** `/Users/sshlg/DATA/_worktrees/rv-0312`, `git status --short` printed nothing, `git rev-parse HEAD` = `020e901927efce4e366d73b2a6e3ea8c72efbde4`.
- **Checkout state after:** `git status --short` printed nothing (0 lines), `git rev-parse HEAD` = `020e901927efce4e366d73b2a6e3ea8c72efbde4`.
- **Method:** every changed function read with its callers; every fix that claims a test was reverted in a scratch copy under `rv-0312-out/scratch3/verifier/` (imports rewritten to the checkout's absolute paths; `node_modules` reached by a symlink in scratch) and its test run against the planted copy; the release gate's ancestry rule simulated read-only against the real history; hosted CI for the final candidate read with `gh run view` (read only, nothing dispatched or re-run).

## What I ran

| Command | Exit | Result |
|---|---|---|
| `node scratch/sim-gate.mjs` (new `verifiedCandidateProblem`, real `git` in the checkout, verified commit = HEAD) | 0 | `[7b042631, 69db245a, HEAD]`: passes (null). Iteration 2 = `6c6aafef` (a commit in the repository, not in HEAD's history): refused "iteration 2 candidate is not an ancestor of the verified commit". Iteration 1 = `6c6aafef`: refused likewise. `[b314a37c, 69db245a, HEAD]`: refused "iteration 2 candidate comes before iteration 1's in history". A missing SHA: refused "does not exist". `[69db245a, 7b042631, HEAD]` (the two are unrelated in history): passes (see FV-5) |
| same script with `b314a37c`'s `release-mac.mjs` | 0 | the real history is refused: "review iteration 1 candidate is not an ancestor of iteration 2's" (PL-1 reproduced, so the change is what makes it pass) |
| `git merge-base --is-ancestor` for `7b042631`, `69db245a`, `b314a37c` against HEAD; `7b042631` vs `69db245a` both ways | 0 | all three are ancestors of HEAD; neither of `7b042631`, `69db245a` is an ancestor of the other |
| `node --test scripts/test/release-gate.test.mjs scripts/test/release-mac.test.mjs` | 0 | 40 pass, 0 fail |
| scratch copy of `release-gate.test.mjs` importing the old `release-mac.mjs` | 1 | "I3 P-1: iteration commits must exist, reach the verified commit and keep their order" fails on the old rule (the two other failures are path reads relative to the scratch folder, unrelated) |
| `npx vitest run` (23 neighbouring files: Board, BoardPanel, BoardSection, HomeWork, HomeParts, HomeBoardWaiting, Kanban, ProjectLaunch, ProjectProfile, ProjectWay, Rail, Settings, CommsFeed, waitingForYou, attentionHonesty, ProjectHeader, EstateAgents, plural, board, protocol, protocolObligations, attention, homeView) | 0 | 23 files, 336 tests pass |
| `npx vitest run` (whole renderer and shared suite) | 0 | 2577 tests pass |
| `node --experimental-strip-types --test test/{board-wall-reads,board-service,board-tool-schemas,board-surface,claude-inbound,claude-trust,git-people,project-onboarding}.test.mjs` | 0 each | 10, 48, 3, 10, 9, 6, 8, 13 pass, 0 fail |
| the same four main-process tests against `b314a37c`'s module (scratch copy) | 1 each | board-service: "i3 ER-1 ..." fails; project-onboarding: "i3 ER-4 / DA-1 ..." and the DA-2 unit fail; git-people: "i3 ER-7 ..." fails; claude-inbound: "a dangling symlinked settings file stays a link ..." fails |
| scratch vitest, unmodified copies (baseline for the plants) | 0 | 6 files, 148 tests pass |
| scratch vitest, 12 plants (one fix reverted each; see the next table) | 1 each | each plant fails exactly the test written for its finding |
| scratch vitest, `b314a37c`'s `protocol.ts` | 1 | "after making the change itself, the asker posts it on the thread and cancels its own request (DO-2)" fails |
| `npx tsc --noEmit -p tsconfig.node.json`; `-p tsconfig.web.json` | 0, 0 | no errors (covers `db.rpc(...).abortSignal(signal)` in `agentSurface.ts`) |
| `node scripts/check-ops.mjs` | 0 | 173 IPC registrations, 516 catch blocks, 0 console calls |
| `node scripts/check-ipc-contract.mjs` | 0 | 168 of 168 handlers, 178 of 178 channels |
| `node scripts/check-registers.mjs` | 0 | PASS |
| `bash scripts/check-docs.sh` | 0 | PASS |
| `node scripts/check-design-map.mjs` | 0 | PASS: 6667 files stamped, 857 anchors, 2330 link targets |
| `node scripts/check-regions.mjs` | 0 | PASS: 561 markers |
| receipts script over `docs/evidence/reviews/0.3.12/iteration-{1,2}/*.json` | 0 | all 10 `closed`, report SHA-256 equal to the committed bytes, iteration 2 `plan.json` regenerated with PL-9 `not-a-defect` |
| `gh run list --commit 020e9019...` | 0 | `ci` push run `40081520536`: **failure** (fast tier; gate and full tier skipped); `workspace publication`: success |
| `gh run view 40081520536 --log-failed` | 0 | one failure: `apps/desktop/test/prepared-launch-input.test.mjs` "30 timeouts retain one unsettled I/O ... fresh preparation succeeds", `'unknown' !== 'observed'` (see FV-2) |
| `node --experimental-strip-types --test test/prepared-launch-input.test.mjs` x5 locally | 0 x5 | 0 fail each time |
| `gh run list --workflow ci.yml --branch agent/release-0312` | 0 | four push runs; only `b314a37c`'s fast run is green; no full-tier run on any of them |
| `gh pr view 421 -R passioncode-ai/fabric-workspace`, `gh pr diff 421` | 0 | merged 09:12Z as `6af4f7ee`: `knowledge/agents-first.md` no longer uses `com.reply` for the two passages DO-1 named, and its "adapted by" step now says `com.submit` then `com.cancel` |
| `git ls-tree HEAD workspace`; `sed` on `workspace/knowledge/agents-first.md` lines 89 to 105 | 0 | the candidate pins `073fa4dc`, which still carries the old text (lines 91 to 93, 104) |

Plants (each in a scratch copy of the current file, one change each):

| Plant | Reverts | Test that failed |
|---|---|---|
| er2 | `BoardScreen.tsx` `unread` back to "first source of each name, whatever its status" | `BoardScreen.test.tsx` «on «All», a source the whole board's read did not answer is said, even when the person's read answered it» |
| er3stale | `reviewStale = false` | «a later failed read keeps the rows and says they are the earlier reading's» |
| er3arrive | the arrival effect waits for `wholeOpen` again | «arriving for a row to review while the whole board's read fails opens «To review» and says the failure» |
| ux2tab | the tab label without its count | «carries its count: reviews, proposals and abandoned work together» |
| ux6 | `undecided = false` in `ProjectProfile.tsx` | «while the relations are unread or unreadable, the offer is not made ...» |
| ux1 | `ProjectLaunch.tsx` reads the whole board for «Вопросы ко мне» | ««Questions for you» is the person's part ...» (and one older test) |
| ux1section | `ProjectHome.tsx` `BoardPanel` without `personOnly` | `waitingForYou.test.tsx` «the project page says the 2 the rail beside it says, and counts the 3 to review apart» |
| ux5 | a held file said as «Not saved: ... refused» with the wait as detail | `SettingsScreen.test.tsx` «a write Claude Code held its lock over is said as such ...» |
| ux3 | the Board's `feedMark` back to the old family list (no `access`) | «an access request re-reads the Board's list, as it moves the rail» |
| ux7 | `waitsUnknown = false` in `EstateHome.tsx` | «a count that could not be read is said on every card, never as nothing waiting or idle» |
| ux2strip | `HomeStats` not given `toReview` | «the strip's «to review» counts the reviews and the proposal, 3, and opens the Board on «To review»» |
| do2 | `b314a37c`'s `protocol.ts` | `protocol.test.ts` DO-2 test |

## Each iteration-3 finding

| ID | Claimed | Verified? | Evidence |
|---|---|---|---|
| UX-1 | fixed (`6e536dd5`) | yes | `ProjectLaunch.tsx` reads `personOnly` for «Вопросы ко мне» and shows «На проверке: N» from `reviewCounts`; `ProjectHome.tsx` `BoardPanel ... personOnly`; plants ux1, ux1section caught |
| UX-2 | fixed | yes | `shared/board.ts#reviewCounts` (the whole board less `PERSON_KINDS`, from the same two readings; `main/index.ts` `personOnly` is exactly that filter, so the difference is exact for one snapshot); Главная's cell, each project pill and the Board's tab count it; plants ux2tab, ux2strip caught |
| UX-3 | fixed | yes | `App.tsx` hands the Board `markOf(marks, NEEDS_YOU_FAMILIES)`, a superset of the old list (`HomeParts.tsx`: adds `access`); plant ux3 caught |
| UX-4 | deferred to CO-418 | yes, recorded | CO-418 now names "the Board tab «На проверке» sharing its name with the kanban column and sitting under «Начать разбор» (iteration 3, UX-4)" |
| UX-5 | fixed | yes, for the held file | `SettingsScreen.tsx` gives `locked` its own sentence, the setting's name as detail; ru and en both "через минуту" / "in a minute"; plant ux5 caught. The new dangling-link answer reuses the refusal sentence (FV-4) |
| UX-6 | fixed | yes | `ProjectProfile.tsx` `undecided` while relations are unread: «Читаю…», or `launch.profile.undecided` after a failed read; no offer; plant ux6 caught |
| UX-7 | fixed | yes | idle pill requires `!waitsUnknown && reviewHere !== null`; plant ux7 caught |
| UX-8 | fixed | yes | the three ru strings rewritten; `plural.test.ts` asserts the new text for 1 and 21; `CommsFeed.test.tsx` updated; vitest green |
| UX-9 | fixed (docs) | yes | `docs/ux/flows.md` FLW-96 amendment names the three states (unread with «Повторить», nobody working, pick an agent) |
| ER-1 | fixed (`b9521217`) | yes | the reply's `board_get` runs inside `wallFor`'s deadline with its `signal` (`agentSurface.ts` passes it to `.abortSignal`); an `error` answer and an answer without a thread are logged as `board.thread-participants-read`; `ok: false` stays silent; old-module run fails the new test |
| ER-2 | fixed | yes | `BoardScreen.tsx` names a source once among failed sources only; plant er2 caught |
| ER-3 | fixed | yes | `reviewStale` keeps rows with `launch.board.reviewStale` and the reading's time; arrival opens «На проверке» when the whole read failed; plants er3stale, er3arrive caught |
| ER-4 | fixed (`d61ccbb7`) | yes | `agentProfilePayload` drops only the business when a read failed and returns `refused.business` naming the read; a call naming only the business is still refused; the tool description says so; old-module run fails |
| ER-5 | fixed | yes | `App.tsx` keeps `waitingProblem`; `EstateHome.tsx` banner from it and «Ждут вас: неизвестно» on each card; plant ux7 caught |
| ER-6 | fixed | yes | as UX-6 |
| ER-7 | fixed (`9ca5beff`) | yes | `gitPeople.ts` stamps `now + (clock() - started)`; sole caller `main/index.ts` passes no clock (defaults to `Date.now`); old-module run fails the new test |
| ER-8 | fixed (`22c7e624`) | yes | `claudeInbound.ts#danglingLink` before the lock and again under it; answer `notSaved {write-failed, ENOENT-link}`; link and target untouched; old-module run fails the new test |
| DO-1 | not in the diff | fixed upstream, not recorded | `fabric-workspace` #421 (`6af4f7ee`, 09:12Z) changed both passages; the candidate's `workspace` pin `073fa4dc` still has the old text, and no ledger row, CO-397 note or Owed item says so (FV-3) |
| DO-2 | fixed (`c6987d85`) | yes | `protocol.ts#crossProjectRule`: `com.submit` kind message on the thread, then `com.cancel` with a reason; `board_cancel` moves `queued/claimed/accepted` to `cancelled` (migration 103 line 484), and `board_request_open` treats `cancelled` as closed (migration 120 line 52), so `board_waiting_operator` stops counting it; SCN-177 amended; old `protocol.ts` fails the test |
| DO-3 | fixed | yes | as ER-4; the spec's W2-4 amendment, the deps comment and the hub comment now match the code |
| DO-4 | fixed (docs) | yes | CHANGELOG, SCR-86 (`docs/ux/screens.md`), W2 spec: goal, summary, plan with items or relations |
| DO-5 | fixed (docs) | yes | CO-368 and CO-391 resolutions say what ships |
| DO-6 | fixed (docs) | yes | CO-418 now carries V2-30 and W2-4's projector rule |
| DO-7 | fixed (docs) | yes | CHANGELOG adds that a read past 5 s lets the post through and logs it |
| DO-8 | fixed (docs) | yes | handoff State and Next task updated; MERGES entry names iteration 3 |
| DA-1 | fixed | yes | as ER-4 |
| DA-2 | deferred to CO-418 | yes, recorded | CO-418 names `memberships`, `deliveries`, `task_runs` timestamps (iteration 3, DA-2, a schema step) |
| PL-1 | fixed (`7fc5eb73`) | yes | rule now: every candidate exists, is an ancestor of `verifiedCommit`, and no later one is an ancestor of an earlier one; simulation passes on `[7b042631, 69db245a, HEAD]` and refuses a reviewed commit outside HEAD's history; the old rule refuses the real history; `release-mac.md` and the ledger Protocol state the rule |
| PL-2 | not in the diff | no | no full-tier run on any 0.3.12 commit; the handoff's Next task, which at `b314a37c` named "the full gate (`node scripts/test-stack.mjs run -- bash scripts/ci.sh full` ...)", no longer names it; no disposition anywhere in the tree (FV-1) |
| PL-3 | fixed (docs) | yes | handoff entry point updated |
| PL-4 | fixed (docs) | yes | the Owed list names 0.3.13's date on `147a5538`, `0d82422a`, `12bd8b4c` |
| PL-5 | fixed (docs) | yes | V2-9 is "not a defect" in the ledger and in the regenerated `iteration-2/plan.json` (hash checked) |

## New findings

| ID | Severity | Finding | Evidence | Proposed fix |
|---|---|---|---|---|
| FV-1 | blocking | **The candidate has no full-tier run, and the plan to run one was removed.** PL-2 (major) is neither fixed nor disposed. The handoff's Next task at `b314a37c` scheduled "the full gate (`node scripts/test-stack.mjs run -- bash scripts/ci.sh full` ...)"; at `020e9019` it goes from the verifier straight to the release commit and the tag. The iteration-3 fixes add paths only the full tier exercises: `agentSurface.ts` now calls `db.rpc(...).abortSignal(signal)` on the wall's reads and `fabric_project_profile` answers `refused`, both covered only by the stack probes (`test/agent-surface.test.mjs` "Runs against the local stack"), besides migration 123 and the paging rewrites PL-2 listed. 0.3.11 recorded "it ran in the full gate of `e569bb5b`". Under the operator's CI policy a missing run is not a passing one. | `git diff b314a37c..HEAD -- docs/handoffs/2026-10-24-release-0312.md`; `gh run list --workflow ci.yml --branch agent/release-0312` (no full run); `iteration-3/2026-10-24-plan.md` PL-2 | Run `node scripts/test-stack.mjs run -- bash scripts/ci.sh full` (with `FABRIC_PG_BIN=/opt/homebrew/opt/postgresql@17/bin`) on `020e9019`, or dispatch `ci.yml` on the branch; record the run and its exit code in the ledger's iteration 3 as PL-2's disposition and restore the step in the handoff. If it is green no code changes and no new verifier is needed; if it fails, the fix is a new candidate. |
| FV-2 | major | **The final candidate's hosted fast run is red.** `ci` push run `40081520536` on `020e9019` failed in the fast tier: `prepared-launch-input.test.mjs` "30 timeouts ... fresh preparation succeeds" got `unknown` where it expects `observed`. The test gives the fresh preparation a 5 ms deadline (`timeoutMs:5`), so a loaded runner fails it; it passes 5 of 5 locally and the diff touches nothing it reads, so it is a flake, not a regression. It is still the only hosted run of this commit and it is not green. | `gh run view 40081520536 --log-failed` (lines around "test at apps/desktop/test/prepared-launch-input.test.mjs:39:1"); local runs exit 0 x5; `test/prepared-launch-input.test.mjs` lines 39 to 44 | Re-run the failed job and record the green run; file a board row (or CO row) to give that test's final `prepare` its own, wider deadline so the assertion does not depend on runner load. |
| FV-3 | minor | **"Every finding is fixed or ruled" is said before it is written, and DO-1's fix lives outside the pinned snapshot.** The handoff's State says so; the ledger has no `## Iteration 3` section yet while the V2-1 row and the Protocol already cite "V3-1". DO-1 was fixed in `fabric-workspace` #421 (`6af4f7ee`), but the candidate pins `workspace` `073fa4dc`, whose `knowledge/agents-first.md` still says "Without the grant, reply instead: `com.reply`" and "asks that agent with `com.reply` on the request"; nothing in the tree records #421. PL-2 has no disposition at all (FV-1). | `docs/handoffs/2026-10-24-release-0312.md` State; `grep -n '^## ' docs/evidence/plans/2026-10-24-release-0312-verification.md` (Iteration 1, 2 only); `git ls-tree HEAD workspace`; `workspace/knowledge/agents-first.md` lines 91 to 93, 104; `gh pr view 421` | In the release commit's iteration 3 section, dispose DO-1 as fixed in fabric-workspace #421 with the workspace pin moved to a snapshot that contains `6af4f7ee` (the gate allows the pin to move after verification), and PL-2 with FV-1's run; until then the handoff should say the dispositions are pending. |
| FV-4 | minor | **A dangling settings link is said as a refusal, with a machine code.** ER-8's new answer `notSaved {write-failed, code: ENOENT-link}` reaches Settings through the generic branch: «Не сохранилось: настройки Claude Code не приняли изменение» and, in the mono detail, «Файл не удалось записать (ENOENT-link).». Nothing refused anything: the link's target does not exist. UX-5's class, in the path ER-8 added; no renderer test covers it. | `launch/SettingsScreen.tsx#AgentLinksSetting` (the non-`locked` branch); `main/claudeInbound.ts` `DANGLING`; `i18n/ru.ts` `settings.agentLinks.notSaved`, `writeFailed` | Give `ENOENT-link` its own sentence (the settings file is a link to a file that does not exist; Fabric left it as it is) in both languages, with a test; or a CO row. |
| FV-5 | minor | **The order half of the new ancestry rule cannot see a swap of unrelated candidates.** With `7b042631` and `69db245a` unrelated in history, `[69db245a, 7b042631, HEAD]` passes the simulation; the rule can only refuse a later candidate that is an ancestor of an earlier one. The receipts bind each candidate to its iteration and report hash, so a swap needs mislabelled receipts, hence minor; `release-mac.md`'s "none before an earlier one in history" is accurate, the commit message's "in order" is stronger than the check. | `rv-0312-out/scratch3/verifier/sim-gate.mjs` output; `scripts/lib/release-mac.mjs#verifiedCandidateProblem` | Accept and say in the comment that unrelated candidates are ordered by their receipts, not by Git; or compare committer dates when neither is an ancestor of the other. |

Counts: 1 blocking, 1 major, 3 minor.

## Verdict

FAIL: every iteration-3 fix in the diff holds, has a test that fails without it, and breaks no neighbour (2577 renderer tests, the main-process tests, typecheck and the six document gates green), but the candidate must not be tagged until the full tier runs green on it and its red hosted fast run (a timing flake) is re-run green, both recorded in the ledger's iteration 3 with PL-2 and DO-1 disposed (FV-1, FV-2, FV-3); if those runs are green no code change and no new verifier is needed.

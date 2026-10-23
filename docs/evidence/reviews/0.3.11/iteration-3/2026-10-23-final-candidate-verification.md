# Fabric 0.3.11: verification of the final release candidate

Date: 2026-10-23. Verifier: a fresh, independent agent (Claude Code), read-only.

## Candidate

- Reviewed candidate (iteration 3): `6481e524ec8d537b766f3fe99958f06ab852f0ba`.
- Final candidate: **`20ea082f51cc8afab42e897ffa7a577dec54b2a2`** (branch `agent/rel-0311-i3`), which is
  `c07b1e9c56221df1a1fd5ee50e826d59b8c73139` (the iteration 3 fixes) plus `20ea082f` (the pipeline ADR reservation
  moves from 0175 to 0177). `afff7495` (SCN-176 and SCN-177 join PJ-42) sits between `6481e524` and `c07b1e9c`.
- Worktree: `/Users/sshlg/DATA/_worktrees/rv-0311-final`, detached at `20ea082f`, dependencies symlinked from the main
  checkout. Removed at the end.

## What I read

- `git diff 6481e524..c07b1e9c` (111 files; 30 outside `docs/reports/previews/`) and `git diff c07b1e9c..20ea082f`
  (4 files: `docs/adr/README.md`, the walk, `task-pipeline-persistence-contract.md`, `map.html`).
- Code in full where the diff touched control flow: `launch/CommsFeed.tsx`, `launch/KanbanBoard.tsx`,
  `launch/BoardScreen.tsx` (header), `launch/CommsScreen.tsx` (strip, polls), `TaskPage.tsx`, `shared/appSettings.ts`,
  `main/index.ts`, `main/agentSurface.ts` (comment), `launch/commsNewest.ts` (`PASSES`, `PAGES`).
- The new tests: `appSettings.test.ts`, `homeLive.test.ts`, `KanbanBoard.test.tsx`, `BoardScreen.test.tsx`,
  `CommsFeed.test.tsx`, `Feed.test.tsx`.
- Documents: AGENTS.md rows, the walk, `scenarios.md`, `product-model.json`, the backlog (P-24, P-25, lane 2), the
  carry-over register (CO-391, CO-392, CO-394, CO-400, CO-401, CO-403, CO-404, CO-405), the ledger
  (`docs/evidence/plans/2026-10-23-release-0311-verification.md`, Rollout, Owed, Iteration 3, Release close), the handoff.
- The five iteration 3 review reports, read from the fixer's worktree
  (`/Users/sshlg/DATA/_worktrees/rel-0311-fix/docs/evidence/reviews/0.3.11/iteration-3/`), because they are not in the
  candidate (VF-1). Count of findings there: UX 10, ER 9, DO 9, DA 4, PL 12 = 44, as the ledger says.

## What I ran

All from the worktree at `20ea082f` unless stated. Plants were made in the worktree and reverted with
`git checkout -- <file>` right after each run; a scratch test file was created and deleted (copy kept in
`scratchpad/rvf/scratch.test.tsx.txt`). `git status --short` printed nothing at the end.

| Command | Exit | Result |
|---|---|---|
| `apps/desktop: tsc --noEmit -p tsconfig.web.json` | 0 | clean |
| `apps/desktop: tsc --noEmit -p tsconfig.node.json` | 0 | clean |
| `vitest run` on appSettings, homeLive, KanbanBoard, BoardScreen, CommsFeed, Feed, CommsScreen, TaskPage, commsNewest tests | 0 | 9 files, 189 tests passed |
| `apps/desktop: vitest run` (whole suite) | 0 | 204 files, 2436 tests passed |
| `bash scripts/check-docs.sh` | **1** | `broken relative Markdown links`: the five `../reviews/0.3.11/iteration-3/2026-10-23-*.md` links at ledger lines 184 to 186; `FAIL: Fabric documentation structure` |
| `node scripts/check-design-map.mjs` | **1** | `Changed iteration reuses the committed top entry`: the source fingerprint here is `aa1acbe8…` over 6593 files; the stamp says `e0b45aed…` over 6598 |
| same two gates with the five iteration 3 reports copied in from the fixer's worktree (then removed) | 0, 0 | fingerprint `e0b45aed…`, 6598 files; `PASS: Fabric documentation structure` |
| `node scripts/check-registers.mjs` | 0 | PASS |
| `node scripts/check-plan-ids.mjs` | 0 | PASS |
| `node scripts/check-hooks.mjs` | 0 | 165 components, no hook below an early return |
| `node scripts/check-design.mjs` | 0 | PASS |
| `node scripts/check-product-model.mjs` | 0 | pass |
| `node scripts/build-product-report.mjs --check` | 0 | product.html matches its inputs |
| `python3 docs/ux/lint.py` | 0 | 0 errors, 2 warnings |
| `node scripts/check-regions.mjs` | 0 | 530 markers, all resolve |
| `python3 test/audit_regressions/fix-pf-06.03.py` | 0 | all green (the 0177 reservation) |
| `node scripts/test/shell-scroll.browser.mjs` | 1 | not run: Playwright's `chromium_headless_shell-1243` is not installed; not downloaded (disk 6.8 GB free) |
| `git ls-remote origin 'refs/agent-sync/leases/*'` | 0 | `rel-0311` and `res--fabric--docs-adr-0176-…` present (see VF-7) |

### Plants (each reverted; the focused suite's result on the plant)

| Plant | What it undoes | Suite on the plant |
|---|---|---|
| P1 | `workingLanguageOfRead` ignores `unreadable` (V2-9) | appSettings: 1 failed |
| P2 | `homeLive` `working()` keeps `backlog` (V2-10) | homeLive: 1 failed |
| P3 | Kanban unread count `'0'` (V2-11) | KanbanBoard: 1 failed |
| P4 | Kanban drop effect removed (V3-8) | KanbanBoard: 1 failed |
| P5a | Kanban heading is the queue's (V2-13 heading) | BoardScreen: 1 failed |
| P5b | review button back to `setMode('needs'); setReview(!review)`, the exact pre-V2-13 code (`git show 90b88c2d^`) | BoardScreen: **33 of 33 passed** |
| P5f | «Add a topic» back to `setTopic(topic ? null : …)` (V2-13 topic half) | BoardScreen: **33 of 33 passed** |
| P5c | V3-9 reverted (`aria-pressed={review}`, label by `review`, `aria-expanded={topic !== null}`) | BoardScreen: **33 of 33 passed** |
| P5d | `ledeProject` not used (V3-13) | BoardScreen: **33 of 33 passed** |
| P5e | arrival focus removed (V2-15) | BoardScreen: 1 failed |
| P6a | «no match» block removed (V2-16) | CommsFeed: 1 failed |
| P6a2 | «Show everything» clears only «requests», not the project (V2-16) | CommsFeed: **9 of 9 passed** |
| P6b | a failed refresh empties to «failed» (V2-16 stale) | CommsFeed: 2 failed |
| P6c | `mounted` effect back to cleanup only (V3-5) | CommsFeed: 1 failed |
| P6d | stale line back to time only (V3-11) | CommsFeed: **9 of 9 passed** |
| P6e | no 60 s deadline (V3-6) | CommsFeed: **9 of 9 passed** |
| P6f | no `again` (V3-6, a press during a read dropped) | CommsFeed: **9 of 9 passed** |
| P6g | feed drop effect removed (V3-8, feed half) | CommsFeed: **9 of 9 passed** |
| P9 | feed `scope = project` and no drop effect (V2-12 and V3-8) | CommsFeed: **9 of 9 passed** |
| P7 | `Feed` shows the U+2014 dash for no project (V2-17) | Feed: 1 failed |
| P8 | HomeWork «Закончили» unread count `'0'` (V2-11, home half) | HomeWork: **15 of 15 passed** |
| P10 | `TaskPage.tsx:179` back to `task.back` (V3-21) | TaskPage: **21 of 21 passed** |
| P11 | CommsScreen strip back to the observed time under «Лента» (V3-10) | CommsScreen and CommsFeed: **73 of 73 passed** |

A scratch test (deleted after the run) showed the behaviour itself is right on the candidate and that a test can hold
it: «a first read that never settles is said as failed after 60 s» (fails on P6e), «Try again pressed during a read is
read right after it» (fails on P6f), «from the kanban with a review on, the button says Start, is not pressed, and opens
the review» (fails on P5b and on P5c). All four cases passed on `20ea082f`.

## Iteration 3 rows checked

| Row | Holds? | Evidence |
|---|---|---|
| V3-1 | holds | `product-model.json` lists SCN-176, SCN-177 in PJ-42 (`afff7495`); product-model check and ux lint exit 0 |
| V3-2 | **partly** | Watched failing: P1, P2, P3, P5a, P5e, P6a, P6b, P6c, P7. Not held: V2-12 (P9 green), V2-13's opener halves (P5b, P5f green; the test named «opens the review rather than closing one» starts with the review off, so the pre-fix toggle passes it), V2-11's home half (P8 green), V2-16's project clear (P6a2 green). ER-7 asked for exactly these («the header from the kanban with a form open and a review on», `HomeWork.test.tsx`). VF-2 |
| V3-3 | holds, with VF-5 | AGENTS.md: 14 windows (`commsNewest.ts` `PASSES = 14`, `PAGES = 5`), 60 s, `FEED_DEADLINE_MS`; a thread-list row. «One read at a time» is not true after a deadline (VF-5); the open thread's own 2.5 s poll (`CommsScreen.tsx:538`) is not in the row |
| V3-4 | holds | the walk: OF-21 and OF-29 «partly … (CO-401, 0.3.12)»; CO-401 holds both halves |
| V3-5 | holds | `CommsFeed.tsx:42`; test «reads under StrictMode» fails on P6c |
| V3-6 | holds in behaviour, **no test** | `CommsFeed.tsx:44-64`; scratch cases pass on the candidate and fail on P6e, P6f; the committed suite is green on both. VF-3 |
| V3-7 | holds | CO-405 now carries ER-3 (carry-over line 419) |
| V3-8 | holds in behaviour; kanban tested, **feed untested** | `KanbanBoard.tsx:44` (P4 caught); `CommsFeed.tsx:69-71` (P6g, P9 green). VF-3 |
| V3-9 | holds in behaviour, **no test**; ruled half not in its row | `BoardScreen.tsx:189-196`; P5c green; CO-400 says nothing of the mode switch's group name or the twice-read heading. VF-3, VF-6 |
| V3-10 | holds, no test | `CommsScreen.tsx:315-316`, en/ru `launch.comms.feed.strip`; P11 green. VF-4 |
| V3-11 | holds, no test | `CommsFeed.tsx:104` `dateStyle`/`timeStyle`; P6d green. VF-4, VF-9 |
| V3-12 | holds | `agentSurface.ts:310-311` comment; ledger V2-4 quotes the real test name |
| V3-13 | holds, no test | `BoardScreen.tsx:189`, en/ru `launch.kanban.ledeProject`; P5d green. VF-4 |
| V3-14 | holds | en `launch.comms.feed.stale` and `launch.comms.unavailable` both say «Comms»; ru both «Переписка» |
| V3-15 | ruling **not carried** | CO-400 (line 414) and CO-394 (line 408) mention none of UX-6, UX-7, UX-8; the back label part holds (`TaskPage.tsx:179`). VF-6 |
| V3-16 | holds as an outcome, mislabelled | the diff moves the browser case's heading into `aside.lh-side-column` so it reaches `launch.css:592`; that is a fix, not «not a defect». Browser case not run here. VF-8 |
| V3-17 | holds; ruled half not carried | SCN-162 `implemented` in the index (`scenarios.md:168`) and the body; CO-400 does not mention SCN-038. VF-6 |
| V3-18 | **owed, not done** | the Release close reads «_Not started._»; same as V2-25. VF-7 |
| V3-19 | text holds; pointers **not carried** | SCN-163 and SCN-170 Status lines name CO-391 and CO-392, but CO-391 (line 405) is about «Нужны вы» and CO-392 (line 406) about quotas; neither holds the greeting line, the option buttons, the section names or «Сохранено». VF-6 |
| V3-20 | holds | CO-403 path `apps/desktop/src/renderer/src/TaskPage.tsx`; P-25 names CO-386, CO-388, CO-402, CO-405 |
| V3-21 | holds, no test | `TaskPage.tsx:179` and `:204` use `launch.agent.back` («← К проекту»); P10 green; `task.back` now unused. VF-4, VF-9 |
| V3-22 | **owed, not done** | Release close «_Not started._». VF-7 |
| V3-23 | holds | lane 2 no longer lists P-19, P-21, P-22, P-23 (backlog line 96) |
| V3-24 | holds | Rollout step 0 names the caches and what never goes; step 3 has the two failure branches |
| V3-25 | holds | Owed: CO-377 by 2026-10-31, else 0.3.12's first patch; P-25 says CO-377 first |
| V3-26 | **does not hold** | `refs/agent-sync/leases/res--fabric--docs-adr-0176-…` is on origin, `ts 2026-10-23T10:15:10Z`, `ttl 2700`: expired, not released. `rel-0311` (expired 08:11Z) is owed at the Release close. VF-7 |
| V3-27 | walk owed; OF-33 pointer **not carried** | the Release close is not started; CO-392 does not hold OF-33's section review. VF-6, VF-7 |
| V3-28 | holds | CO-404 (line 418) carries the rule to fabric-agent-contract and `knowledge/agents-first.md` |
| V3-29 | holds | handoff «Waiting on» names the CO-382 decision as the operator's |
| V3-30 | holds | P-24 links `plans/2026-10-23-release-0311-verification.md#release-close`; the heading exists |
| `20ea082f` | holds | ADR README next free `ADR-0178`, 0177 reserved; `task-pipeline-persistence-contract.md` dated note; walk D-1; map entry; `fix-pf-06.03.py` all green |

The code changes break nothing measured: both type checks clean, the full desktop suite (2436 tests) green, hooks gate
green (the filter-reset effect sits before the early returns, `CommsFeed.tsx:69`). The drop effects cannot loop: each
sets `''`, which makes its own condition false. Under StrictMode the feed reads twice on mount (the second through
`again`), which is harmless.

## Findings

| ID | Severity | Finding | Evidence | Proposed fix |
|---|---|---|---|---|
| VF-1 | **blocking** | The candidate fails its own documents gate and design-map gate in a clean checkout. The ledger links the five iteration 3 review reports, and the map stamp was computed with them present, but they were never committed: they exist only as untracked files in the fixer's worktree. This is the class PL-1 found in iteration 3. | `check-docs.sh` exit 1, five broken links at ledger lines 184 to 186; `check-design-map.mjs` exit 1 (6593 files here, 6598 stamped); `git -C …/rel-0311-fix status --short` prints `?? docs/evidence/reviews/0.3.11/iteration-3/`; with the five files copied in both gates exit 0 | Commit the five reports (and sidecars if the iteration 1 and 2 convention of `*.json` applies) on `agent/rel-0311-i3`; the stamp then matches as is. Re-run the gates in a clean checkout, not in the worktree that wrote them |
| VF-2 | major | V3-2 claims a watched test for each of ER-7's eight fixes; four are still not held: V2-12 (feed scope), V2-13's two opener halves (the test starts with the review off, so the original toggle passes), V2-11's home count, V2-16's project clear by «Show everything». ER-7's own proposed cases («a review on», `HomeWork.test.tsx`) were not written. | plants P9, P5b (the exact `90b88c2d^` code), P5f, P8, P6a2 all green; scratch case fails on P5b | Add: a BoardScreen case that starts a review, switches to the kanban and presses the button (and one with a topic form open); a HomeWork `doneUnread` case; a CommsFeed case where the filtered project's posts leave and come back; make the Show-everything case pick a project whose posts the requests filter alone would not reveal. Watch each fail on its plant |
| VF-3 | major | New iteration 3 control-flow fixes have no test that fails without them: the 60 s deadline and the kept press (V3-6), the feed's drop effect (V3-8 feed half), the kanban header's label, pressed state and `aria-expanded` (V3-9). This repeats ER-7 in the iteration that closed it. | P6e, P6f, P6g, P5c green; scratch tests pass on the candidate and fail on those plants | Commit tests of the scratch shape (fake timers, a never-settling `heads`; a press during a hung read; review on then kanban) |
| VF-4 | minor | Copy and label fixes without a test: V3-10 strip, V3-11 date, V3-13 project lede, V3-21 back label while loading. | P11, P6d, P5d, P10 green | One assertion each, or record them as unverified by test in the ledger |
| VF-5 | minor | After a deadline the abandoned read keeps running and `busy` is released, so on a board that never answers a new read starts about once a minute and none ends: 6 pending `heads` calls after 5 minutes. The deadline timer is never cleared, on settle or unmount. AGENTS.md now says «one read at a time»; the strip says the feed reads «every 15 seconds». | scratch «PILEUP» case: `heads calls in 5 min with a hung board: 6 pending 6`; `CommsFeed.tsx:56`; ER-2 notes no deadline in main | Clear the timer when the race settles; keep a count of abandoned reads and start none while one is outstanding (or pass an abort to the bridge); word the AGENTS row as «at most one read in flight, a stalled one abandoned after 60 s» |
| VF-6 | major | Ruled parts are handed to register rows that do not hold them, the class V2-24 (DO-3) fixed in iteration 2: V3-9 (group name, twice-read heading to CO-400), V3-15 (UX-6, UX-7, UX-8 to CO-400 and CO-394), V3-17 (SCN-038 to CO-400), V3-19 (greeting line, option buttons to CO-391; section names, «Сохранено» to CO-392), V3-27 (OF-33's section review to CO-392). | carry-over lines 405, 406, 408, 414 contain none of these; `grep "iteration 3"` finds only CO-405's ER-3 among 0.3.11 rows | Under the lease, add each item with its source (`iteration 3, UX-6`…) to the named row, or open new rows |
| VF-7 | minor | Four dispositions read «fixed» for acts of the Release close, which is «_Not started._»: V3-18, V3-22, V3-27's walk, V3-26's `rel-0311`. V3-26's «the ADR leases are released» is false now: the ADR-0176 lease ref is still on origin, expired. | ledger «## Release close / _Not started._»; `git ls-remote` shows `res--fabric--docs-adr-0176-…` (`ts 10:15:10Z`, `ttl 2700`) | Write «owed at the Release close» for those four; release the ADR-0176 lease (`agent_sync.py release`) and say so |
| VF-8 | minor | V3-16 reads «not a defect» while the diff changes the browser case so that it reaches the rule UX-9 said it missed; that is a fix of the test. The browser case was not run here. | `scripts/test/shell-scroll.browser.mjs:130`, `launch.css:592` | Disposition «fixed: the case now sits in `.lh-side-column`»; run the case before the release commit |
| VF-9 | minor | Small text leftovers: the ru stale line now reads «эти посты прочитаны в 23 окт. 2026 г., 23:10» («в» before a date); `task.back` is unused in en and ru; the new thread-list row omits the open thread's 2.5 s poll. | `CommsFeed.tsx:104`, `ru.ts` `launch.comms.feed.stale`; `en.ts:313`, `ru.ts:1670`; `CommsScreen.tsx:538` | «эти посты прочитаны {time}» or «по состоянию на {time}»; drop `task.back`; add «and an open thread's messages» to the row |

Counts: 1 blocking, 3 major (VF-2, VF-3, VF-6), 5 minor.

## Verdict

**fail**: the final candidate `20ea082f` fails `check-docs.sh` and `check-design-map.mjs` in a clean checkout because the
five iteration 3 review reports it links and stamps are not committed (VF-1); with them committed the gates pass and the
code itself is sound (type checks clean, 2436 tests green), but V3-2 and the new control-flow fixes still lack the
tests the ledger claims (VF-2, VF-3), and several ruled items point to rows that do not hold them (VF-6).

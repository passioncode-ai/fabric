# Fabric 0.3.11: second verification of the final release candidate

Date: 2026-10-23. Verifier: a fresh, independent agent (Claude Code), read-only.

## Candidate

- Final candidate: **`e569bb5b53d297915866c15a7af0fc0119b1497b`** (branch `agent/release-0311`; `git ls-remote origin refs/heads/agent/release-0311` resolves to it), one commit on top of the failed candidate `20ea082f`: «fix(0.3.11): the final candidate after its first verification».
- Scope: `git diff 20ea082f..e569bb5b` (16 files, 798 insertions, 25 deletions) against ledger rows V3-31 to V3-39 (`docs/evidence/plans/2026-10-23-release-0311-verification.md`, Iteration 3).
- The gate checkout `/Users/sshlg/DATA/_worktrees/gate-0311` was only read (HEAD `e569bb5b`, `git status --short` empty before and after). Plants ran in my own worktree `/Users/sshlg/DATA/_worktrees/rv-0311-f2` (detached at `e569bb5b`, dependencies symlinked from the main checkout), each reverted with `git checkout -- <file>` right after its run; the worktree was clean and then removed with `git worktree remove --force`; the main checkout's four `node_modules` folders were checked present afterwards.

## What I read

- The whole diff: `CommsFeed.tsx`, `CommsFeed.test.tsx`, `BoardScreen.test.tsx`, `HomeWork.test.tsx`, `en.ts`, `ru.ts`, `AGENTS.md` (two Lifecycle rows), the ledger (Iteration 3), the carry-over register (CO-391, CO-392, CO-394, CO-400), `map.html` (new top entry and stamp), and the six committed reports under `docs/evidence/reviews/0.3.11/iteration-3/`.
- Context needed to judge the diff: `CommsFeed.tsx` in full, the header of `BoardScreen.tsx` (lines 184 to 212), `HomeWork.tsx` (the «Закончили» count, line 154), `CommsScreen.tsx` (polls at lines 212, 236, 538), CO-405, the Status lines of SCN-163, SCN-170 and the SCN-038 index row in `docs/ux/scenarios.md`, `scripts/test/shell-scroll.browser.mjs:130`, `scripts/lib/release-gate.mjs` (review receipts), the first verifier's report.

## What I ran

| Command | Exit | Result |
|---|---|---|
| `vitest run` CommsFeed, BoardScreen, HomeWork tests (plant worktree, unplanted) | 0 | 3 files, 63 tests passed |
| `vitest run` CommsScreen, TaskPage, KanbanBoard tests | 0 | 3 files, 92 tests passed |
| `apps/desktop: tsc --noEmit -p tsconfig.web.json` | 0 | clean (so the removed `task.back` key is referenced by no typed caller) |
| `node scripts/check-registers.mjs` | 0 | PASS: 402 carry-over rows, citations resolve, counts recompute |
| `node scripts/check-design-map.mjs` | 0 | PASS: map source stamp (6599 files), 819 anchors, 2252 link targets |
| `bash scripts/check-docs.sh` | 0 | PASS: Fabric documentation structure (the gate VF-1 failed on) |
| `git ls-tree -r --name-only e569bb5b docs/evidence/reviews/0.3.11/iteration-3/` | 0 | the five iteration 3 reports and the first verifier's report |
| `grep -rn task.back apps/` (ts, tsx) | 1 | no match |
| em dash count (U+2014) in the six reports | 0 | 0 in each |
| em dash in added lines of the diff | 0 | 2 hits, both the existing U+2014 placeholder cell of the AGENTS.md Lifecycle table (the same column every row uses), none in prose |
| `git ls-remote origin 'refs/agent-sync/leases/*'` | 0 | `rel-0311`, `release-0311` and `res--fabric--docs-adr-0176-…` still present (VF2-4) |
| scratch test, a healthy but slow board (heads answers in 1 s), stale line checked at 60.5 s | 0 / 1 | passes on the candidate, fails when `clearTimeout(deadline)` is removed (VF2-3); kept as `scratch-timer.test.tsx.txt` beside this report, deleted from the worktree |

### Plants (each reverted; focused suite result on the plant)

| Plant | What it undoes | Row | Suite on the plant |
|---|---|---|---|
| Q1 | `CommsFeed.tsx` replaced by its `20ea082f` text (the `Promise.race` deadline that frees the slot) | V3-36 | 1 failed: «a first read that never settles …», `heads` called 7 times, expected 1 |
| Q2 | no 60 s deadline timer | V3-33 | 1 failed: the deadline test |
| Q3 | `clearTimeout(deadline)` removed | V3-36 | **13 of 13 passed** (VF2-3) |
| Q4 | no `again` (a press during a read dropped) | V3-33 | 1 failed: «Try again pressed while a read runs …» |
| Q5 | the filter-dropping effect removed | V3-32 (V2-12, V3-8) | 1 failed: «a project filter whose posts left the read is cleared» |
| Q6 | `scope = project` and no drop effect (the first verifier's P9) | V3-32 | 1 failed: same test |
| Q7 | «Show everything» clears only «requests» | V3-32 (V2-16) | 1 failed: «Show everything clears the project filter …» |
| Q8 | `mounted` effect back to cleanup only | V3-5 (regression check) | 1 failed: «reads under StrictMode» |
| B1 | review button back to `setMode('needs'); setReview(!review)` (pre-V2-13) | V3-32, V3-33 | 1 failed: «from the kanban with a review on …» |
| B2a | `aria-pressed={review}` | V3-33 (V3-9) | 1 failed: same test |
| B2b | label chosen by `review` alone | V3-33 (V3-9) | 1 failed: same test |
| B2c | `aria-expanded={topic !== null}` | V3-33 (V3-9) | 1 failed: same test |
| B3 | «Add a topic» back to `setTopic(topic ? null : …)` (the V2-13 topic half, the first verifier's P5f) | V3-32 | **35 of 35 passed** (VF2-1) |
| B4 | `ledeProject` not used | V3-35 (V3-13) | 1 failed: «a project's own board says …» |
| H1 | «Закончили» unread count `'0'` instead of `'?'` | V3-32 (V2-11) | 1 failed: «Закончили that could not be read says so …» |

## Code review of `CommsFeed.tsx`

- The deadline: `setTimeout(failed, FEED_DEADLINE_MS)` at line 51 calls the same `failed` as a refused read (a ready feed turns stale, otherwise «failed»), guarded by `mounted`. `busy` is released only in `finally` (line 65), so a hung read keeps the one slot; Q1 shows the old code piling 7 reads in about 6 minutes and the new one keeping 1. The timer is cleared in `finally` (line 64). If the screen is left while a read hangs, the timer still fires once and does nothing (the `mounted` guard); not a defect.
- A read that settles after its deadline still lands: `setRead(ready)` at line 59 replaces «failed», so a slow board recovers by itself.
- `again`: a press or tick while `busy` is kept (line 46) and replayed in `finally` (line 66) only while mounted. During a hung read the «Try again» button stays on screen and pressing it is queued, not lost; nothing piles up (each press only sets a flag).
- StrictMode: the second effect run finds `busy` set and only sets `again`, so it creates no second timer; the first read's `finally` replays one extra read. Harmless, and Q8 shows the StrictMode test still holds.
- The filter-dropping effect (lines 71 to 73) sits before both early returns (hooks order intact), sets `''`, which ends its own condition, so it cannot loop; line 83's `scope` is now redundant but harmless.

## Rows V3-31 to V3-39

| Row | Holds? | Evidence |
|---|---|---|
| V3-31 | holds | the six reports are in the tree at `e569bb5b`; `check-docs.sh` and `check-design-map.mjs` exit 0 in a clean worktree (6599 files, stamp `e92d3bc1…`). The stamp's +1 file over `20ea082f`'s 6598 fits: the five reports were already counted (they sat untracked where the stamp was computed) and the first verifier's report is the new one |
| V3-32 | **holds in part** | watched failing: project filter (Q5, Q6), Show everything (Q7), the home's «?» (H1), the review half of the header (B1). Not held: V2-13's «Add a topic» opener half (B3 green, 35 of 35), which VF-2 named («one with a topic form open»). The new test opens the form and checks `aria-expanded` on the kanban, but never presses «Add a topic» there. VF2-1 |
| V3-33 | holds | deadline (Q2), kept press (Q4), kanban button label, pressed state and `aria-expanded` (B2a, B2b, B2c) each fail their test |
| V3-34 | holds | CO-400 now holds V3-9's group name and twice-read heading, V3-15's UX-6 row detail and V3-17's SCN-038; CO-394 holds V3-15's UX-7 and UX-8 (way back, empty brief and lede, compact agent row); CO-391 holds V3-19's greeting line and option buttons; CO-392 holds V3-19's section names and «Сохранено» and V3-27's OF-33. SCN-163 and SCN-170 Status lines name the same rows. `check-registers.mjs` exit 0 |
| V3-35 | **does not hold** (its ruled half) | the lede test fails on B4 (the fixed half holds). The strip, the stale date and the back label are «ruled CO-405 for their tests», but CO-405 (carry-over line 419) names none of them: it is about the claims read, the main-process tests, История's reading line and ER-3. The class V3-34 just fixed. VF2-2 |
| V3-36 | holds in code; test holds the slot half only | Q1 fails (7 reads against 1); Q3 (timer not cleared) is green. The row does not claim a test of the clearing, but without it a healthy feed says «Comms did not answer» 60 s after every read for as long as the next read takes (scratch test). VF2-3 |
| V3-37 | holds as wording | V3-18, V3-22, V3-26, V3-27 now say «fixed in the release commit»; the Release close is still «_Not started._», so these are owed acts. V3-26's «the ADR leases are released» reads as done and is not: the ADR-0176 lease ref is on origin (`ts 2026-10-23T10:15:10Z`, `ttl 2700`, expired). VF2-4 |
| V3-38 | holds | the added fact is true: `scripts/test/shell-scroll.browser.mjs:130` renders the case inside `aside.lh-side-column`. Keeping «not a defect» against VF-8's «fixed» is a defensible reading. Nobody in this round ran the browser case (Playwright's `chromium_headless_shell-1243` is not installed, only 1234) |
| V3-39 | holds | ru `launch.comms.feed.stale` reads «посты ниже прочитаны {time}» (no «в» before a date); `task.back` removed from en and ru and referenced nowhere (grep empty, tsc clean); the AGENTS.md thread-list row adds «an open thread's messages every 2.5 s», matching `CommsScreen.tsx:538`; the feed row now says the stalled read keeps the slot, matching the code |

Also checked: the map's new top entry `iteration-2026-10-23-release-0311-final` links the ledger and the previous entry; the ledger links all six iteration 3 reports including the first verifier's; no em dash in prose.

## Findings

| ID | Severity | Finding | Evidence | Proposed fix |
|---|---|---|---|---|
| VF2-1 | major | V3-32 (and V3-33, «as V3-32») says the board header's two buttons are held, «each watched failing on its plant». The «Add a topic» half of V2-13 (from the kanban with a form open, a press opens the form rather than closing it) still has no test: the exact pre-fix code passes the whole suite. VF-2 asked for this case by name. The behaviour itself is right on the candidate (`BoardScreen.tsx:197`, `opening`). | plant B3 `setTopic(topic ? null : …)`: BoardScreen 35 of 35 passed | In the new BoardScreen case, after switching to the kanban with the form open, press «Add a topic» and assert the form's heading (`launch.board.topic.title`) is on screen; watch it fail on B3 |
| VF2-2 | major | V3-35 rules the tests of the Comms strip under «Лента», the stale line's date and the task page's back label to CO-405, which holds none of them. Same class as VF-6 and V3-34, introduced by the row that answers VF-4; the iteration's exit sentence («ruled to a register row») is therefore not true for this row. | carry-over line 419 (CO-405) text; ledger V3-35 | Under the lease add to CO-405: «With it (the 0.3.11 final verification, VF-4): tests for the Comms strip under «Лента», the stale line's date and the task page's back label while loading», or write the three one-line assertions now |
| VF2-3 | minor | The timer clearing in V3-36 has no test. Without it every read's deadline fires 60 s after it started, which falls on a later poll, so a healthy feed says «Comms did not answer» with «Try again» each time a read is in flight. | plant Q3 green (13 of 13); scratch test (heads answers in 1 s, check at 60.5 s) passes on the candidate and fails on Q3 | Commit the scratch test (`scratch-timer.test.tsx.txt` beside this report) into `CommsFeed.test.tsx` |
| VF2-4 | minor | V3-26 says «the ADR leases are released», present tense; the ADR-0176 lease ref is still on origin, expired, as VF-7 found. `rel-0311` and `release-0311` are also there (owed at the Release close, which the row says). | `git ls-remote origin 'refs/agent-sync/leases/*'`; ref body `{"key": "res--fabric--docs-adr-0176-…", "ts": "2026-10-23T10:15:10Z", "ttl": 2700}` | Release the ADR-0176 lease now (`agent_sync.py release`) or word the row «owed at the Release close» |
| VF2-5 | minor | The deadline test runs with `vi.useFakeTimers({ shouldAdvanceTime: true })`, which adds real elapsed time to the fake clock, and asserts «not yet failed» at 59 s against a 60 s deadline: a 1 s margin. On a loaded machine more than 1 s of real time between render and that assertion makes it fail spuriously. It passed in every run here (load average about 58). | `CommsFeed.test.tsx`, the test «a first read that never settles …» | Use plain fake timers in that test (it needs only `act` and `advanceTimersByTimeAsync`), or assert at 50 s |
| VF2-6 | minor | Iteration 3 has no `fabric-release-reviews/1` receipts (`ux.json`, `errors.json`, … ), which iterations 1 and 2 carry and `scripts/lib/release-gate.mjs` requires for three iterations before a release. 0.3.10 wrote its iteration 3 receipts in the release commit (`6671833e`), so this is owed, not wrong, but the ledger lists it nowhere among the release commit's acts, beside the four V3-37 rows and the unrun browser case of V3-38. | `ls docs/evidence/reviews/0.3.11/iteration-3/` (no `.json`); `release-gate.mjs:30-45`; `git log -- docs/evidence/reviews/0.3.10/iteration-3/errors.json` | Add one line to the Release close plan: write the five iteration 3 receipts, release the leases, fold the merge log, run the shell-scroll browser case |

Counts: 0 blocking, 2 major (VF2-1, VF2-2), 4 minor.

## Verdict

**fail**: the code is sound and breaks nothing measured (type check clean, 155 focused tests green, docs, map and register gates exit 0), and the blocking VF-1 is fixed, but two rows claim what the candidate does not hold: V3-32's «each watched failing on its plant» misses the «Add a topic» half of V2-13 (VF2-1) and V3-35 rules three tests to CO-405, which does not hold them (VF2-2); both are one test and one register sentence, no product change.

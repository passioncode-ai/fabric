# Fabric 0.3.12 release review, iteration 3: the final candidate's verification, second pass

- **Verifier run id:** `release-0312-i3-final-verifier-2-20261024`
- **Date:** 2026-10-24
- **Read:** `020e901927efce4e366d73b2a6e3ea8c72efbde4..e1419aeb0acae676a6a5048b4f1378010b327229` (`git log`: one commit, `e1419aeb` "test: timing margins and a dangling link said for what it is"; `git diff --stat`: 8 files, 33 insertions, 7 deletions), against the first pass `2026-10-24-final-candidate-verification.md` (FV-1 to FV-5).
- **Checkout state before:** `/Users/sshlg/DATA/_worktrees/rv-0312`, `git status --short` printed nothing, `git rev-parse HEAD` = `e1419aeb0acae676a6a5048b4f1378010b327229`.
- **Checkout state after:** `git status --short` printed nothing, `git rev-parse HEAD` = `e1419aeb0acae676a6a5048b4f1378010b327229`.
- **Method:** every changed line read with the code it exercises (`main/preparedLaunchInput.ts#execute`, `main/agentSurface.ts` start, `main/claudeInbound.ts`, `main/index.ts` `settingsSetClaudeInbound`). Plants were made in a scratch copy of `apps/desktop/{src,test}` under `rv-0312-out/scratch3/verifier2/plant/` (`node_modules` reached by symlink; the scratch baseline passes 22/22, 16/16 and 25/25 before any plant), one change at a time, restored and checked with `diff -q` after each. Load runs used `nice -n 19` so the full-tier run in progress on this machine kept priority. Nothing was fetched, committed, dispatched or re-run; the hosted CI was only read.

## What I ran

| Command | Exit | Result |
|---|---|---|
| `node --experimental-strip-types --test test/prepared-launch-input.test.mjs` (checkout) | 0 | 22 pass; the "30 timeouts" test takes 53 ms |
| `node --experimental-strip-types --test --test-force-exit test/hub-surface.test.mjs` (checkout) | 0 | 16 pass, the three ER-8 tests among them |
| plant P1: `if(busy)return fallback` removed (no single unsettled read) | 1 | "30 timeouts ..." fails, `f.reads.length` actual 31, expected 1 (and the older "actual compiler retains unsettled sibling" test, 11 vs 1) |
| plant P1b: `busy` released on the deadline, not on settlement (`if(finished)busy=false`) | 1 | same two failures, 31 vs 1 |
| plant P2: the work's `active` ignores the deadline (`work(()=>true)`), so a late resolution keeps reading | 1 | "30 timeouts ..." alone fails, `f.reads.length` actual 2, expected 1 (the assertion after `resolve`) |
| "30 timeouts" alone, 8 workers x 15 runs, niced, load average 9 | 0 or 1 | 120 runs, 1 fail; durations median 58 ms, p95 73 ms, max 127 ms |
| same, 10 workers x 20 runs | 0 or 1 | 200 runs, 1 fail at `prepared-launch-input.test.mjs:45` (`'unknown'` for `'observed'`, the fresh preparation; that run took 176 ms) |
| scratch copy, same load harness, `timeoutMs` 5 / 50 / 1000 (10 workers) | | 5 ms: 143 of 200 fail, all at line 45; 50 ms: 1 of 200; 1000 ms: 0 of 100, median 1007 ms, max 1019 ms. Load average reached 60 during this run |
| plant H1: `agentSurface.ts` treats a taken `[::1]` as absent | 1 | "ER-8: [::1] taken by another program refuses the hub port" fails; the two other ER-8 tests pass |
| plant H3 (test side): another program holds 127.0.0.1 on every port the kernel gives on `[::1]`, so the loop gives up after its 21st try | 1 | the same test fails: `HubPortUnavailable: port 64188 on 127.0.0.1 is already in use ...` does not match `/\[::1\]\|::1/` |
| `npx vitest run src/renderer/src/launch/SettingsScreen.test.tsx src/renderer/src/i18n/plural.test.ts` (checkout) | 0 | 2 files, 31 tests pass |
| scratch: `SettingsScreen.tsx` with the `ENOENT-link` branch replaced by `false` | 1 | only "a settings link to a missing file is said as such, not as a refusal" fails (24 of 25 pass) |
| `node --experimental-strip-types --test test/claude-inbound.test.mjs` | 0 | 9 pass; line 62 pins `{reason: 'write-failed', code: 'ENOENT-link'}` |
| `node scripts/check-design.mjs` | 0 | "PASS: interface tokens and strings" (includes the ru translation debt gate) |
| `node scripts/check-registers.mjs` | 0 | "PASS": 415 carry-over rows, 198 milestones, 1618 verification rows |
| `node scripts/check-design-map.mjs` | 0 | "PASS: map source stamp (6667 files), 858 unique anchors and 2331 link targets" |
| `git diff 020e9019..e1419aeb \| grep '^+' \| grep -c` U+2014 | 0 matches | no em dash in any added line |
| `git diff --word-diff=porcelain ... -- docs/evidence/specs/2026-08-16-software-fabric-carryover.md` | 0 | one insertion in CO-418, quoted in item d |
| `gh run list --commit e1419aeb...`; `gh run view 40082478531` (read only) | 0 | `ci` push run in progress, job "fast, no database" in progress; `workspace publication` success |

## Each item

**(a) FV-2's test change: meaningful, yes; holds under load, mostly, not fully.**
The change is one number: `timeoutMs` 5 to 50 in `test/prepared-launch-input.test.mjs:42`. Every assertion stays. The test still catches the defects it exists for: P1 and P1b (reads not bounded to one unsettled read) give 31 reads for 1, and P2 (a late resolution that keeps reading) gives 2 for 1. Each of the 30 calls in the loop still meets the guard, because `execute` returns `fallback` at once while `busy` is true. The first call is the only one that waits for the deadline, and it still reaches it, because the read never resolves on its own.
Under load the margin is better but not enough. On this machine with 10 niced workers, the 5 ms version fails 143 of 200 times at line 45, the exact hosted failure. At 50 ms it failed 3 of 520 runs: 1 of 120, 1 of 200 and 1 of 200, each at line 45, where the final fresh preparation answers `unknown`. At 1000 ms it failed 0 of 100 runs. The new comment says "31 hung reads still cost about 1.5 s". That is not what the code does: only the first call waits, and the test takes about 53 ms. 1.5 s is the runtime of the P1 and P1b defects, where every call waits. So the deadline was kept small to avoid a cost that does not exist (FV2-1).

**(b) hub-surface ER-8 change: yes, it still tests the `[::1]` refusal and cannot pass vacuously.**
The loop only picks the port. The blocker always holds `[::1]`, and the assertion is unchanged: `HubPortUnavailable` and a message naming `::1`. The surface binds 127.0.0.1 first, and that refusal's text (`port N on 127.0.0.1 is ...`) contains no `::1`. If the loop gives up after its 21st try with 127.0.0.1 held, the test fails rather than passes (plant H3 shows this). A defect that ignores a taken `[::1]` fails the test (plant H1). The trailing probe still checks that nothing is left half-listening on 127.0.0.1. Two notes. The probe and `surface.start` race against other programs, but losing that race makes the test fail, never pass. In `/\[::1\]|::1/` the first alternative is subsumed by the second, which is harmless.

**(c) FV-4: yes.**
`launch/SettingsScreen.tsx#AgentLinksSetting` gives `notSaved.code === 'ENOENT-link'` its own sentence, `settings.agentLinks.danglingLink`, with only the setting's name as detail. It no longer shows the machine code. `locked` and every other code keep their earlier branches. The code reaches the renderer unchanged: `main/index.ts` `settingsSetClaudeInbound` passes `notSaved` through `inboundAnswer`, and `main/claudeInbound.ts` `DANGLING` is `{reason: 'write-failed', code: 'ENOENT-link'}`.
The new test fails when the branch is removed and passes on the candidate. Both i18n files carry the key (en.ts:918, ru.ts:253), and `check-design.mjs`, which refuses an untranslated new key, passes. Neither string has U+2014. "Turn this on again" is right: `setInbound(false)` on a dangling link writes nothing and returns no `notSaved`, because `plan(null)` is null when `on` is false, so only turning it on reaches this sentence.
The Russian is natural and correct. "указывает ссылкой на файл" reads a little stiff; "ссылается на файл, которого нет" would be more idiomatic (FV2-3, cosmetic).

**(d) FV-5 recorded in CO-418: yes.**
The only change to `docs/evidence/specs/2026-08-16-software-fabric-carryover.md` is this insertion in CO-418's text: "the release gate's order check cannot tell a swap of two reviewed candidates that are unrelated in history (the receipts bind each to its iteration; the final candidate's verification, FV-5)". The row is still `open` for 0.3.13 and `check-registers.mjs` passes. The row's file column does not name `scripts/lib/release-mac.mjs`, which the fix would touch (FV2-2, cosmetic).

**(e) Nothing else changed behaviour: yes.**
The diff touches only these: two i18n files (one new key each), one renderer branch (only for `ENOENT-link`), two node tests, one vitest test, one carry-over row, and `docs/reports/map.html`. The map change is a new changelog lane `iteration-2026-10-24-release-0312-final`, placed first, linking to the previous lane, plus the restamped source stamp, and `check-design-map.mjs` passes. No main-process, preload, shared, migration or script file changed.
The map lane's Russian text says the fast gate failed on ER-8 because another program held the port on 127.0.0.1. That matches the commit message and the new test comment.

## New findings

| ID | Severity | Finding | Evidence | Proposed fix |
|---|---|---|---|---|
| FV2-1 | major (not blocking) | **The 50 ms deadline narrows FV-2's flake but does not close it, and the reason given for keeping it small is wrong.** The final fresh preparation must finish inside the same deadline as the hung first call. Under niced load on this machine it missed 50 ms in 3 of 520 runs, each at line 45 (`'unknown' !== 'observed'`), the hosted failure's assertion. At 1000 ms it missed 0 of 100. The comment's "31 hung reads still cost about 1.5 s" describes the defective code (P1 and P1b take about 1.6 s). On the candidate only the first call waits and the test takes about 53 ms, so a larger deadline costs one wait. The fixture's own comment (N-040) already records 100 ms failing ordinary preparation on a loaded host. | `test/prepared-launch-input.test.mjs:39-45`; `src/main/preparedLaunchInput.ts#execute` (`if(busy)return fallback`; `busy` cleared only when `settled && finished`); `test/prepared-launch-fixture.mjs` comment on `timeoutMs:5000`; scratch logs `scratch3/verifier2/load2/w10-2.log`, `load-5/`, `load-50/`, `load-1000/` | Set this test's `timeoutMs` to 1000 (about 1 s, one wait) and correct the comment. If the candidate is not to change, record it as a carry-over row and treat a red hosted fast run at line 45 as this flake, re-run, not as a regression. |
| FV2-2 | minor (cosmetic) | CO-418 now names FV-5, but its file column does not list `scripts/lib/release-mac.mjs#verifiedCandidateProblem`, where the fix lives. | `docs/evidence/specs/2026-08-16-software-fabric-carryover.md:434`, file column | Add the path when CO-418 is next edited. |
| FV2-3 | minor (cosmetic) | `ENOENT-link` is a string literal on both sides (`claudeInbound.ts` `DANGLING`, `SettingsScreen.tsx`) under `code: string` in `shared/types.ts:1359`. Each side has its own test pinned to the literal, so renaming the code on one side breaks no test. Separately, the ru sentence's "указывает ссылкой на файл" is stiffer than "ссылается на файл". | `src/shared/types.ts:1359`; `test/claude-inbound.test.mjs:62`; `SettingsScreen.test.tsx` FV-4 test; `i18n/ru.ts:253` | Optional: one shared constant or a literal union for `code`; optionally reword ru. |

Counts: 0 blocking, 1 major, 2 minor.

## Verdict

**PASS** for items a to e, on the condition that the hosted fast run of `e1419aeb` (`ci` run `40082478531`, in progress when I read it) finishes green. FV-1 is not mine to judge here: the full tier is running separately. FV-3 belongs to the release commit's ledger.

Why PASS. The ER-8 test still tests the `[::1]` refusal and fails rather than passes when it cannot find a port (plants H1, H3). FV-4's sentence is correct, translated, free of U+2014, and its test fails without the fix. FV-5 is in CO-418. Nothing else changed behaviour. FV-2's test still catches both defects it guards (plants P1, P1b, P2), and its flake rate under heavy load fell from 143 of 200 to 3 of 520.

FV2-1 is the one thing that falls short of "holds under load". It is a test-only timing margin with a one-line remedy, so it does not block the tag. If the hosted fast run on this candidate fails at `prepared-launch-input.test.mjs:45`, that is FV2-1: re-run it, and fix or carry the deadline.

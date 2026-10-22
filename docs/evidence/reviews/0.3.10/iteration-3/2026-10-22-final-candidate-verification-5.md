# Fabric 0.3.10 release review, iteration 3: fifth verification of the final candidate (unit, seam, product)

- **Read:** `f0c92f90`. Unit tier: `opsLog.ts` with `redact.ts` against v0.3.9. Seam tier: the log's callers and
  readers and the shell's selectors. Product tier: CHANGELOG, SCN-162, SCN-073, SCR-84, SCR-52, SCR-88, release-mac,
  operating-surfaces, the ledger, the backlog, the register, the handoff, and the neighbour features on the same path.
- **Date:** 2026-10-22. Detached worktrees, removed after; the repository's `git status` stayed empty.
- **Verdicts:** unit pass; seam pass; product fail on two documents (no behaviour blocks).

## Unit tier (pass)

An Error's name and message are redacted and capped as v0.3.9 did: 369 inputs gave byte-identical records, rule names
and counts included. No value of a plain object without a message is written; no input throws; each claimed test fails
when undone. Risks: a thrown function is written as its source (as in v0.3.9); an Error from another realm loses its
name to `Error`.

## Seam tier (pass)

Every code the board and Comms paths produce (`42501`, `57014`, `PGRST116`, numeric statuses) keeps its fixed shape and is
written; no reader uses an Error's name as a key; sampling, retention and `lost()` hold; vitest 199 files and 2 380 tests,
ops, retention, board, comms and stack-watch tests green. Risk: a plain object with a code and no message loses the
code (no caller found).

## Product tier (fail on documents)

| ID | Severity | Finding |
|---|---|---|
| VP-1 | breaks | The CHANGELOG's count of hidden failures was out of date (40 board upkeep passes, 27 after the 0.3.9 rollout, last 19:00:47 UTC; and 23 board commands, 14 after) |
| VP-2 | breaks | SCR-84 said the page keeps at least half of the place; the stylesheet gives 40 % |
| VP-3 | risk | Diagnostics, retired by SCN-073, still renders in the project page and now shows the new wording |
| VP-4 | risk | Old «[object Object]» records stay in the log until rotation |
| VP-5 | risk | The person's quit ends every console session; the rollout did not say so |
| VP-6 | risk | "Closing Settings finds the page where it was" rested on the key test alone |
| VP-7 | risk | The handoff's next task was stale |

Dispositions: V3-39 to V3-44 in the ledger.

# Fabric 0.3.21 release verification

Release gate ledger for 0.3.21 ([the release runbook](../../launch/release-mac.md#how-a-release-is-made), P-02).
Three iterations, five reviewers each (ux, errors, docs, data, plan), every reviewer a fresh context reading the
candidate read-only; findings are disposed here and in the receipts under `docs/evidence/reviews/0.3.21/`.

0.3.21 carries what the board's live audit of 2026-11-13 found after 0.3.20 was installed (CO-572, CO-573 items 6, 9,
10, 13 and 14, CO-575), the operator's 10-minute rule for idle sessions (CO-565, CO-571), the connect link another app
would open (CO-570), the Board from the rail with a question's recommended option (`6166a904`), and the board search the
operator asked for on 2026-11-14 (`fabric_board_search`, `similar_work`, the advice `work.search-the-board`;
[its spec](../specs/2026-11-14-board-search.md)).

## Protocol

- Baseline: `0d729bbe`, 0.3.20's release commit (tag `v0.3.20`). The reviewers read the candidate's checkout without
  writing in it and record HEAD and `git status --short | wc -l` before and after.
- Tests are run by file under `nice -n 10`, one run at a time.
- The review copies are redacted for publication (ADR-0096): home paths are `/Users/example`.
- A finding is fixed (with its test or check), ruled (with its register id), not a defect (with why), not recoverable,
  or stopped.
- Iteration 3 closes on the first run whose blocking findings are all confined to the files the release gate allows
  after `verifiedCommit` (`scripts/lib/release-mac.mjs#verifiedCandidateProblem`); those are fixed in the release commit,
  as for 0.3.20 (its ledger's Protocol, run five, PL-84).

## What 0.3.21 carries

Schema 102, no migration: the database is the one 0.3.20 left. The `## Unreleased` section of
[`CHANGELOG.md`](../../../CHANGELOG.md) names every person-visible change.

## Iteration 1

_Not started._

## Iteration 2

_Not started._

## Iteration 3

_Not started._

## Release close

What is owed around the tag, in order; each item is checked off here with its receipt.

0. Before the release commit: at least 5 GB free (`df -h`); one full hosted `ci` run green on the final candidate.
1. The CI release run green on every platform, the published release and its notes from `## 0.3.21`.
2. Install 0.3.21 on this Mac by [the runbook](../../launch/release-mac.md#upgrading-an-existing-database) (no schema
   step): the board switch and «Служба доски» off before the quit, the lifecycle broker's `fabric.desktop` held, the
   bundle checked and replaced, then the broker released and `always_on` again, both switches on once 0.3.21 reads back.
3. The Mac Studio by its host agent, asked on the board.
4. One live `fabric_board_search` call from a coding session against the installed board, its answer read.
5. The runbook's steps 9 to 11.

# Fabric 0.3.21 release verification

Release gate ledger for 0.3.21 ([the release runbook](../../launch/release-mac.md#how-a-release-is-made), P-02).
Three iterations, five reviewers each (ux, errors, docs, data, plan), every reviewer a fresh context reading the
candidate read-only; findings are disposed here and in the receipts under `docs/evidence/reviews/0.3.21/`.

0.3.21 carries what the board's live audit of 2026-11-13 found after 0.3.20 was installed (CO-572, CO-573 items 5, 6, 9,
10 and 14, and 13 in part, CO-575), the operator's 10-minute rule for idle sessions (CO-565; CO-571 in part: its waking
half; what is left is in CO-571's row, and until it closes a coding session's scheduled check stays the live push), the connect link another app
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

Candidate `b30304aebcbd4e0dfa208cfb8f540dfa04f2ed42`. Five reviewers, one per level; their reports and receipts are in
`docs/evidence/reviews/0.3.21/iteration-1/`. 33 findings, 6 blocking (UX-1, DO-1, ER-1, ER-2, PL-1; UX-1 and DO-1 one
defect), four distinct defects: the board search read a project's capabilities by a field the directory does not answer;
its id pattern backtracked quadratically on a long word (a 64 KB message stalled the main process 5 s); CO-570's check
refused Fabric Inbox's own app on Windows and Linux; the dispatcher's spec still stated the old liveness rule. Every new
test was watched failing on the old code (the capability fixture in the directory's shape, the backtracking pattern
restored, the handler check on Windows paths, the dead delegate button) or encodes the refused value.

| Row | Finding | Severity | Defect | Disposition |
|---|---|---|---|---|
| V1-1 | UX-1 | blocking | capabilities read as `c.name`, the directory answers `{capability, responder}` | fixed in the iteration-1 wave (candidate 2): `str(c.capability)`; test «UX-1: a capability alone finds the project that takes it» in the directory's shape |
| V1-2 | UX-2 | non-blocking | the no-folder reason reached only agents | fixed in the iteration-1 wave (candidate 2): sweep kind `request-no-folder` with its own en/ru words in «На проверке»; test «UX-2» in `abandonedSweep.test.ts` |
| V1-3 | UX-3 | non-blocking | «Отдать агенту» did nothing on a Главная question with no options | fixed in the iteration-1 wave (candidate 2): `AnswerForm` offers it only with `onDelegate`; test «UX-3» in `HomeParts.test.tsx`, watched failing |
| V1-4 | UX-4 | non-blocking | «Подробнее» folded the why on every Board row | fixed in the iteration-1 wave (candidate 2): only a question's card folds; any other row opens it |
| V1-5 | UX-5 | non-blocking | unread claims and a stop-word query read as «nobody» and «not found» | fixed in the iteration-1 wave (candidate 2): `holder_unknown` and `holders`; a note for a query with no searchable words; test «UX-5» |
| V1-6 | ER-1 | blocking | quadratic id pattern on a long word | fixed in the iteration-1 wave (candidate 2): ids joined from words (`compoundsOf`), text read to 6 000 characters and words to 64; test «a 64 KB message of one unbroken word», watched failing at 7.4 s with the pattern restored |
| V1-7 | ER-2 | blocking | CO-570 refused Fabric Inbox on Windows and Linux | fixed in the iteration-1 wave (candidate 2): `productConnect.ts#handlerIsProduct` per platform; test «ER-2» with Windows and Linux paths |
| V1-8 | ER-3 | non-blocking | a search blocks the main process 0.8 to 9 s | fixed in the iteration-1 wave (candidate 2): text caps and the prefix walk kept per term, a board at the read bounds under a time bound; a worker ruled: CO-578 |
| V1-9 | ER-4 | non-blocking | partial directory read said «nothing could be read» | fixed in the iteration-1 wave (candidate 2): nothing searched only when no document was read |
| V1-10 | ER-5 | non-blocking | `similar_work` noisy on instruction words and generic names | fixed in the iteration-1 wave (candidate 2): title and touches only, generic names (`src`, `index`, ...) link nothing, lapsed claims left out |
| V1-11 | ER-6 | non-blocking | a long turn without a tool call reads idle | ruled: CO-571 (its Left names it); the `fabricMcp.ts` comment corrected |
| V1-12 | ER-7 | non-blocking | alias proposal awaited in the pass and repeated | fixed in the iteration-1 wave (candidate 2): proposed once per process, never awaited; remembered across restarts ruled: CO-578 |
| V1-13 | DO-1 | blocking | capabilities claim false | fixed in the iteration-1 wave (candidate 2): as UX-1 |
| V1-14 | DO-2 | non-blocking | spec said 20 open tasks | fixed in the iteration-1 wave (candidate 2): 40, with up to 20 returned from review |
| V1-15 | DO-3 | non-blocking | on-demand spec's old liveness rule | fixed in the iteration-1 wave (candidate 2): as PL-1 |
| V1-16 | DO-4 | non-blocking | CO-573 (5) named nowhere | fixed in the iteration-1 wave (candidate 2): CHANGELOG, this ledger's scope, the map lane and MERGES |
| V1-17 | DO-5 | non-blocking | CHANGELOG overclaimed the `git` fix | fixed in the iteration-1 wave (candidate 2): «no longer refused; a folder Fabric knows by its path still joins» |
| V1-18 | DO-6 | non-blocking | stale test title and displaced doc comments | fixed in the iteration-1 wave (candidate 2): test retitled, `isWorkCall` above `doorBucket`'s comment, `touched` documents `work` |
| V1-19 | DO-7 | non-blocking | `similar_work` wiring untested; lapsed claims named | fixed in the iteration-1 wave (candidate 2): lapsed claims left out; the stack test ruled: CO-578 |
| V1-20 | DO-8 | non-blocking | header said «newest kept» | fixed in the iteration-1 wave (candidate 2): the read rewritten (DA-1) and its comments with it |
| V1-21 | DO-9 | non-blocking | spec §5 inferred a project's window from the estate count | fixed in the iteration-1 wave (candidate 2): says the narrowing was not measured |
| V1-22 | DO-10 | non-blocking | CO-573's built items in the files column | fixed in the iteration-1 wave (candidate 2): moved to the status cell, `partially resolved` |
| V1-23 | DA-1 | non-blocking | board window wasted reads and kept the oldest | fixed in the iteration-1 wave (candidate 2): narrowest first, widest that fits kept, 6 hours and 1 hour below a day; test «DA-1» |
| V1-24 | DA-2 | non-blocking | no index for notes and released claims | ruled: CO-578 (a schema step) |
| V1-25 | DA-3 | non-blocking | the real PostgREST reads untested on a database | ruled: CO-578 |
| V1-26 | DA-4 | non-blocking | alias proposed again after each restart | ruled: CO-578; once per process fixed with ER-7 |
| V1-27 | DA-5 | non-blocking | released claims at bound not capped; tasks capped for notes | fixed in the iteration-1 wave (candidate 2): test «DA-5» |
| V1-28 | PL-1 | blocking | on-demand spec §3.8 and §3.2 false after the change | fixed in the iteration-1 wave (candidate 2): §3.8 states the 0.3.21 rule and the old one, §3.2 marked superseded |
| V1-29 | PL-2 | non-blocking | CO-571 cited as done; G29 not updated | fixed in the iteration-1 wave (candidate 2): «CO-571 in part» in this ledger and the CHANGELOG, CO-571's Left names the person-wait exemption and the session check, Release close item 6 updates G29 |
| V1-30 | PL-3 | non-blocking | cross-project «who works on what» left unowned | ruled: CO-579 (the operator's decision on the project boundary, asked) |
| V1-31 | PL-4 | non-blocking | adapter guidance refused by the recommended rule | ruled: CO-580 (asked of fabric-agent-adapter on the board) |
| V1-32 | PL-5 | non-blocking | 0.3.20's open close items not carried | fixed in the iteration-1 wave (candidate 2): «Carried from 0.3.20's close» below |
| V1-33 | PL-6 | non-blocking | scope line left out CO-573 (5) | fixed in the iteration-1 wave (candidate 2): «items 5, 6, 9, 10 and 14, and 13 in part» |

Exit for iteration 1: every finding disposed above. Blocking findings open: none.

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
6. North Star G29 and §6 in fabric-workspace: what of the 10-minute push 0.3.21 carries and what CO-571 leaves, told on
   the board (PL-2).

### Carried from 0.3.20's close

Open when 0.3.21 was cut (the 0.3.21 review, iteration 1, PL-5); each is done when its receipt is written here or in
0.3.20's ledger: 2b, the window check of the published DMG (`chat-activation-native`), with room on the disk; 4, one
live run on the Studio seen end to end; 5, the nightly `platforms` run confirming CO-560; 6, CO-563 on a live `-p` run;
7, migration 129 on the installed board and the hyperframes thread told; 8, a dispatched run that asks a question; 10,
the runbook's steps 9 to 11. Owner: this repository's release session; the Studio's items by its host agent.

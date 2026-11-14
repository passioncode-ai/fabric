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
`docs/evidence/reviews/0.3.21/iteration-1/`. 33 findings, 5 blocking (UX-1, DO-1, ER-1, ER-2, PL-1; UX-1 and DO-1 one
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

Candidate `4f465b6dd8c00b9d2142d90951eddf8feed9ef9f`. Five reviewers, one per level; their reports and receipts are in
`docs/evidence/reviews/0.3.21/iteration-2/`. 23 findings, 2 blocking (ER-8, DO-11): `similar_work` still linked two
claims through names every repository has, and the release notes said connecting Fabric Inbox works on Windows and Linux
«again» (it never broke, and on Windows it still waits for the vault). Every new test was watched failing on the old code
(the generic-name filter removed, the inbox exemption removed, the AppImage match made exact again, the Board's delegate
button offered always and its fold always closed, the query cap removed). `bash scripts/ci.sh fast` on candidate 2 failed
once in `transcript-recovery.test.mjs` under a load average of about 130, a test this release does not touch; the file
alone passed three times (CO-581).

| Row | Finding | Severity | Defect | Disposition |
|---|---|---|---|---|
| V2-1 | UX-6 | non-blocking | «Отдать агенту» offered on a question with no options and on the person's own topic | fixed in the iteration-2 wave (candidate 3): the Board offers it only on an agent's question with options; test «offers «Отдать агенту» only on an agent's question with options (UX-6)», watched failing |
| V2-2 | UX-7 | non-blocking | the no-folder row told the person to answer the request, which no screen lets them do | fixed in the iteration-2 wave (candidate 3): the row's words name what a person can do: attach the folder, or ask the asking project's agent to withdraw it (en, ru, `abandonedSweep.ts` next step) |
| V2-3 | UX-8 | non-blocking | SCN-147 did not record the no-folder row | fixed in the iteration-2 wave (candidate 3): SCN-147 amended 2026-11-14 with the en/ru words, the inbox exemption and the tests |
| V2-4 | UX-9 | non-blocking | the UX-4 fold had no test | fixed in the iteration-2 wave (candidate 3): test «folds the why on a question and keeps it open on any other row (UX-9)», watched failing |
| V2-5 | ER-8 | blocking | generic names still linked claims as words, so ER-5 was not fixed | fixed in the iteration-2 wave (candidate 3): `boardSearch.ts#touchWords` drops generic names before they become words; test «ER-8 ... names every repository has (index, main, README) link nothing», watched failing; spec and SCN-140 say so |
| V2-6 | ER-9 | non-blocking | the search's cost understated by a 14-word fixture | fixed in the iteration-2 wave (candidate 3): the query cut to 12 words (`QUERY_WORDS`), the measured times (1.3 to 2.5 s warm, 4.4 s first call, 8.5 s cold before the cap) in spec §3a and CO-578; a worker ruled: CO-578 |
| V2-7 | ER-10 | non-blocking | a versioned AppImage or its desktop file refused as wrong-handler | fixed in the iteration-2 wave (candidate 3): `handlerIsProduct` asks whether the file's name holds the product's; test «ER-2» gains the AppImage cases, watched failing |
| V2-8 | DO-11 | blocking | CHANGELOG and map said Fabric Inbox connects on Windows and Linux «again» | fixed in the iteration-2 wave (candidate 3): the bullet dropped; CO-570's bullet names each platform's app and that Windows still waits for the vault (CO-245); the map's iteration-1 lane corrected |
| V2-9 | DO-12 | non-blocking | iteration 1 counted 6 blocking findings, its list names 5 | fixed in the iteration-2 wave (candidate 3): 5 in this ledger and the map's lane |
| V2-10 | DO-13 | non-blocking | a CHANGELOG bullet fixed what this release itself introduced | fixed in the iteration-2 wave (candidate 3): the bullet dropped, its facts folded into the Board bullet |
| V2-11 | DO-14 | non-blocking | spec said half of the title's words | fixed in the iteration-2 wave (candidate 3): «half of the words of its title and touched names» in the spec and SCN-140 |
| V2-12 | DO-15 | non-blocking | spec bounded the ranking at 2 000 documents, the reads allow 2 500 | fixed in the iteration-2 wave (candidate 3): spec §3a and §5 say 2 500, directory included, measured at 2 000 |
| V2-13 | DO-16 | non-blocking | CO-570's row still described the macOS-only check | fixed in the iteration-2 wave (candidate 3): CO-570's status names `handlerIsProduct` per platform and its test |
| V2-14 | DO-17 | non-blocking | comments said the newest messages are never left out | fixed in the iteration-2 wave (candidate 3): `boardSearchRead.ts` header and `readBoard` comment say when the last hour does not fit |
| V2-15 | DA-6 | non-blocking | an inbox item to a project with no folder went to the operator, who never sees it | fixed in the iteration-2 wave (candidate 3): an inbox item stays skipped; test «DA-6 ... stays skipped, never the operator's», watched failing |
| V2-16 | DA-7 | non-blocking | a narrowed board read was not said, and the note asked for wider days | fixed in the iteration-2 wave (candidate 3): `board_narrowed` in the answer and the tool's description, no «wider days» when narrowed; test «DA-7», watched failing |
| V2-17 | PL-7 | non-blocking | six carry-over rows targeted 0.3.21 and are not closed by it | fixed in the iteration-2 wave (candidate 3): CO-567, CO-568 (its ADR date moved to 2026-11-21), CO-569, CO-571, CO-573, CO-574 retargeted to the release after 0.3.21 |
| V2-18 | PL-8 | non-blocking | the rest of the 10-minute push had no date and its stopgap lapses | fixed in the iteration-2 wave (candidate 3): CO-571's latest date 2026-11-20 with its owner, this repository's release session; the handoff names it |
| V2-19 | PL-9 | non-blocking | the Release close left out the release commit, the DMG smoke and the dispatcher watch | fixed in the iteration-2 wave (candidate 3): items 0b, 2b and 4b added, 0.3.20's carried items placed in the order |
| V2-20 | PL-10 | non-blocking | the handoff did not carry iteration 1's waits and next task | fixed in the iteration-2 wave (candidate 3): the handoff's Open names CO-578 to CO-581, question `6c3764b6` and request `981a7b99` with their watcher; CO-579 and CO-580 name them; Next task names iteration 3 |
| V2-21 | PL-11 | non-blocking | the notes reported a fix of a failure no release had | fixed in the iteration-2 wave (candidate 3): as DO-11 |
| V2-22 | PL-12 | non-blocking | no text check of the new strings | fixed in the iteration-2 wave (candidate 3): 22 texts checked, none blocking; report ids in `docs/evidence/reviews/0.3.21/iteration-2/2026-11-14-text-check.md` |
| V2-23 | PL-13 | non-blocking | two tests asserted wall-clock time and one failed under load | fixed in the iteration-2 wave (candidate 3): the read-bounds time test replaced by checks of the bounds; the 64 KB test's bound 2 500 ms (the old pattern took 7.4 s alone) |

Exit for iteration 2: every finding disposed above. Blocking findings open: none.

## Iteration 3

_Not started._

## Release close

What is owed around the tag, in order; each item is checked off here with its receipt.

0. Before the release commit: at least 5 GB free (`df -h`); one full hosted `ci` run green on the final candidate.
0b. The release commit (the version, `## 0.3.21`, `docs/launch/release-gate.json`) and its landing on `main` by
   fast-forward (runbook step 1; the 0.3.21 review, iteration 2, PL-9).
1. The CI release run green on every platform, the published release and its notes from `## 0.3.21`.
2. Install 0.3.21 on this Mac by [the runbook](../../launch/release-mac.md#upgrading-an-existing-database) (no schema
   step): the board switch and «Служба доски» off before the quit, the lifecycle broker's `fabric.desktop` held, the
   bundle checked and replaced, then the broker released and `always_on` again, both switches on once 0.3.21 reads back.
2b. The published DMG smoked (runbook step 7: `--mcp-only` and `packaged-helpers.test.mjs`), CO-575's helpers read as
   `Fabric Helper` on the installed bundle (`ps -o comm=`), and with room on the disk the window check carried from
   0.3.20 (2b below).
3. The Mac Studio by its host agent, asked on the board, with 0.3.20's carried Studio item 4.
4. One live `fabric_board_search` call from a coding session against the installed board, its answer read.
4b. The dispatcher watched live for an hour on the installed board: an idle project's request starts a run (CO-565),
   a request to a project with no folder reaches «На проверке» after 30 minutes (CO-573 item 9), and the ops log
   names a failed start's cause (CO-573 item 13); with it 0.3.20's carried items 6 and 8 where a run offers them.
5. The runbook's steps 9 to 11 (with 0.3.20's carried item 10).
6. North Star G29 and §6 in fabric-workspace: what of the 10-minute push 0.3.21 carries and what CO-571 leaves, told on
   the board (PL-2).

### Carried from 0.3.20's close

Open when 0.3.21 was cut (the 0.3.21 review, iteration 1, PL-5); each is done when its receipt is written here or in
0.3.20's ledger: 2b, the window check of the published DMG (`chat-activation-native`), with room on the disk; 4, one
live run on the Studio seen end to end; 5, the nightly `platforms` run confirming CO-560; 6, CO-563 on a live `-p` run;
7, migration 129 on the installed board and the hyperframes thread told; 8, a dispatched run that asks a question; 10,
the runbook's steps 9 to 11. Owner: this repository's release session; the Studio's items by its host agent. Their place
in the order above (PL-9): 2b with item 2b, 4 with item 3, 6 and 8 with item 4b, 10 with item 5; 5 (the nightly
`platforms` run) is read the morning after the tag; 7 (migration 129) is read on the installed board at item 2.

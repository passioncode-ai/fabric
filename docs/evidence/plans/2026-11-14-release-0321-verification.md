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
- A run's candidate passes `bash scripts/ci.sh fast` before its reviewers start (the 0.3.21 review, iteration 3, run two,
  PL-20: a red candidate cannot be `verifiedCommit`, and its fixes are refused after it).

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

### Run one, 7b5a7205 (superseded)

Candidate `7b5a720517340b56c88a926678c88fbf2cafab38`. Five reviewers, one per level; their reports and receipts are in
`docs/evidence/reviews/0.3.21/iteration-3-7b5a7205/` (kept as the record; not this iteration's receipts). 22 findings, 2
blocking, both in code the gate refuses after `verifiedCommit`, so the iteration runs again: UX-10, a question's own
explanation shown on no screen since `6166a904` moved it off «Нужны вы» to a Board that never showed it, and ER-11,
`similar_work` still linking claims through names every repository carries (`CHANGELOG.md`, `tsconfig.json`, lock files,
`index.test.ts`). Every new test was watched failing on the old code. `bash scripts/ci.sh fast` on this candidate failed
once in `owned-backend-process-registry.test.mjs` at a load average of about 90, a test this release does not touch;
the file alone passed three times (CO-581). fabric-agent-adapter 0.86.0 resolved CO-580 the same hour.

| Row | Finding | Severity | Defect | Disposition |
|---|---|---|---|---|
| V3-1 | UX-10 | blocking | a question's own why shown on no screen | fixed in the iteration-3 wave (run two's candidate): the Board shows `entry.why` under «Почему просят» in «Подробнее» and the count of tasks it holds as its own line; test «shows a question's own why under «Подробнее», not the count of tasks it holds (UX-10)», watched failing |
| V3-2 | UX-11 | non-blocking | words past the query cap dropped silently and said not found | fixed in the iteration-3 wave (run two's candidate): the answer names `searched` and `not_searched`, the note says the searched words were not found and how many were not searched; test «UX-11, DA-9», watched failing |
| V3-3 | UX-12 | non-blocking | board_narrowed says «did not fit» when a wider read failed | fixed in the iteration-3 wave (run two's candidate): «another window could not be read (see degraded)» when a read failed; test «DA-8, UX-12», watched failing |
| V3-4 | UX-13 | non-blocking | the no-folder row names neither the asking project nor the request | ruled: CO-583 (every request row of «На проверке» carries only its target since 0.3.16) |
| V3-5 | ER-11 | blocking | similar_work still linked claims through CHANGELOG, tsconfig, lock files and index.test.ts | fixed in the iteration-3 wave (run two's candidate): a name is read up to its first dot after leading dots, `GENERIC_NAMES` gains the names every repository of the estate carries; test «ER-11», watched failing; spec and SCN-140 say so |
| V3-6 | ER-12 | non-blocking | an id matched by a shorter word it begins with | fixed in the iteration-3 wave (run two's candidate): an id matches only whole or as the start of a longer document term; test «ER-12», watched failing; spec §2 says so |
| V3-7 | ER-13 | non-blocking | a failed narrow read dropped the 500 messages already read; window days unrounded | fixed in the iteration-3 wave (run two's candidate): a failed narrower read keeps the wider read's messages, named capped; `board_window_days` rounded; test «ER-13», watched failing |
| V3-8 | ER-14 | non-blocking | one capped flag for the open and the newest thread reads | fixed in the iteration-3 wave (run two's candidate): `capped` is the open read's, `recentCapped` the newest read's; the dispatcher logs only the first; test «ER-14», watched failing; AGENTS.md says so |
| V3-9 | DO-18 | non-blocking | spec §3a and CO-578 said the times were measured at 2 500 documents | fixed in the iteration-3 wave (run two's candidate): «measured on 2 000 documents» in spec §3a and CO-578 |
| V3-10 | DO-19 | non-blocking | «the first 12 searchable words» inexact (ids first) | fixed in the iteration-3 wave (run two's candidate): the cut follows the query's own order, an id counting as one; the tool's description, spec §3a and the map lane say so |
| V3-11 | DO-20 | non-blocking | the text check predates the rewritten no-folder strings | fixed in the iteration-3 wave (run two's candidate): both later wordings checked, report ids added to the text-check receipt |
| V3-12 | DO-21 | non-blocking | CO-573's latest date not moved | fixed in the iteration-3 wave (run two's candidate): the release after 0.3.21, with its owner |
| V3-13 | DO-22 | non-blocking | liveness docs leave out the start grace | fixed in the iteration-3 wave (run two's candidate): «worked or started in the last 10 minutes» in spec §3.8, the CHANGELOG and AGENTS.md |
| V3-14 | DO-23 | non-blocking | a header and a test title contradict the code | fixed in the iteration-3 wave (run two's candidate): «closed ones unless asked not to»; the 64 KB test titled «within 2.5 s (the old pattern took 7.4 s)» |
| V3-15 | DA-8 | non-blocking | a failed wider read worded «did not fit» and «nothing could be read» | fixed in the iteration-3 wave (run two's candidate): as UX-12, and a board window read whole is not a failed part for «nothing could be read» |
| V3-16 | DA-9 | non-blocking | the 12th plain word dropped when an id follows | fixed in the iteration-3 wave (run two's candidate): as DO-19 |
| V3-17 | PL-14 | non-blocking | CO-573's latest date | fixed in the iteration-3 wave (run two's candidate): as DO-21 |
| V3-18 | PL-15 | non-blocking | CO-569's settled items and 0.3.20's carried item 10 | fixed in the iteration-3 wave (run two's candidate): CO-569 says PL-38 and PL-33 are settled with the pin commits; the carried list says item 10's condition is met |
| V3-19 | PL-16 | non-blocking | 0.3.20's Studio install not carried; no schema step for a Studio space | fixed in the iteration-3 wave (run two's candidate): 0.3.20's item 3 carried; item 3 reads each space's `schema_version()` first and upgrades a space on 101 by the runbook |
| V3-20 | PL-17 | non-blocking | no close item for iteration 3 rulings; handoff not in releaseMetadata | fixed in the iteration-3 wave (run two's candidate): item 0c added; 0b names the handoff in `releaseMetadata` |
| V3-21 | PL-18 | non-blocking | shipped no-folder wording had no text check | fixed in the iteration-3 wave (run two's candidate): as DO-20; the Russian reworded and checked again |
| V3-22 | PL-19 | non-blocking | item 6 leaves out the board search | fixed in the iteration-3 wave (run two's candidate): item 6 tells §6 about the board search and what CO-576 and CO-579 leave |

### Run two, 3ce7a69d (superseded)

Candidate `3ce7a69ddbd367f20b0ef50c1f58ecc72c02c3b0`. Five fresh reviewers; their reports and receipts are in
`docs/evidence/reviews/0.3.21/iteration-3-3ce7a69d/` (kept as the record). 22 findings, 3 blocking: PL-20, the candidate
failed `bash scripts/ci.sh fast` (the `launch.css` rule run one added sat in the block ported from the prototype, and the
mockup coverage was built before its receipts' repin; both fixed in `21317159` and `31ec15f6`, which follow it); ER-15,
run one's ER-12 fix made a file name miss every document that cites it with its folder; DA-10, run one's ER-14 split
left the sweep silent about the newest thread read's cap, from which it judges answered requests. Every new test was
watched failing on the old code. The reviewer text naming a longer CO number in the errors report is written in words there, since the
register gate reads it as a row reference (ADR-0096 redaction).

| Row | Finding | Severity | Defect | Disposition |
|---|---|---|---|---|
| V3-23 | UX-14 | non-blocking | a failed 6-hour read dropped the day already read | fixed in the run-two wave (run three's candidate): as ER-19 |
| V3-24 | UX-15 | non-blocking | board_narrowed claimed a capped window read whole | fixed in the run-two wave (run three's candidate): `board_narrowed` says «of that window only its oldest messages: the newest were not read» when the board is capped; test «ER-19, UX-14 (run two)» |
| V3-25 | UX-16 | non-blocking | hyphenated query words searched only as ids | ruled: CO-578 (its row names the case and two ways to fix it) |
| V3-26 | UX-17 | non-blocking | words past the cap named only in a field when there are hits | fixed in the run-two wave (run three's candidate): the note with hits names them too, and the tool's description names `not_searched` |
| V3-27 | ER-15 | blocking | the ER-12 fix made a file name miss the documents citing it with its folder | fixed in the run-two wave (run three's candidate): a path also reads as its tails after each `/`, an id matches a longer term only where it goes on with a separator; test «ER-15 (run two)», watched failing; spec §2 says so |
| V3-28 | ER-16 | non-blocking | per-folder and repository-standard names still linked claims | fixed in the run-two wave (run three's candidate): `GENERIC_NAMES` gains them; test «ER-16, ER-17, DO-25 (run two)», watched failing |
| V3-29 | ER-17 | non-blocking | a versioned name cut to its major | fixed in the run-two wave (run three's candidate): a name is cut at its first dot followed by a letter; same test |
| V3-30 | ER-18 | non-blocking | the sweep no longer named the newest read's cap | fixed in the run-two wave (run three's candidate): the sweep's receipt names `threads` when either read stopped; test «ER-18, DA-10 (run two)», watched failing |
| V3-31 | ER-19 | non-blocking | a failed 6-hour read dropped the day's messages | fixed in the run-two wave (run three's candidate): what one day read before it did not fit is kept, capped; test «ER-19, UX-14 (run two)», watched failing |
| V3-32 | DO-24 | non-blocking | ER-13's disposition true only for the 1-hour read | fixed in the run-two wave (run three's candidate): as ER-19 |
| V3-33 | DO-25 | non-blocking | four lock files still linked | fixed in the run-two wave (run three's candidate): as ER-16 |
| V3-34 | DO-26 | non-blocking | §3.9 and CO-572 said every capped read is logged | fixed in the run-two wave (run three's candidate): §3.9, CO-572 and the CHANGELOG say which read each reports |
| V3-35 | DO-27 | non-blocking | the start grace missing in three places | fixed in the run-two wave (run three's candidate): CO-565, §3.2 and the handoff say «worked or started» |
| V3-36 | DO-28 | non-blocking | CO-583's reason wrong for request-no-folder | fixed in the run-two wave (run three's candidate): CO-583 says the new kind inherits the older kinds' shape |
| V3-37 | DO-29 | non-blocking | a header and the handoff's watcher line stale | fixed in the run-two wave (run three's candidate): the header names moved, started and open tasks; the handoff watches one wait |
| V3-38 | DA-10 | blocking | the sweep silent about the newest read's cap | fixed in the run-two wave (run three's candidate): as ER-18, with spec §3.9 and the CHANGELOG |
| V3-39 | DA-11 | non-blocking | a failed 6-hour read; a capped window said read whole | fixed in the run-two wave (run three's candidate): as ER-19 and UX-15 |
| V3-40 | DA-12 | non-blocking | a live-claims read cut at its bound read as nobody holds it | fixed in the run-two wave (run three's candidate): `liveClaims` says `capped`, hits without a holder are `holder_unknown`, `capped` names «live claims»; test «DA-12 (run two)», watched failing |
| V3-41 | PL-20 | blocking | the candidate failed ci.sh fast and its fixes follow it | fixed in the run-two wave (run three's candidate): run two is superseded and iteration 3 runs again on the commit carrying `21317159`, `31ec15f6` and this wave, with `bash scripts/ci.sh fast` read green first; the Protocol says so |
| V3-42 | PL-21 | non-blocking | no upgrade paragraph for 0.3.21 | fixed in the run-two wave (run three's candidate): `## Unreleased` opens with «Upgrading», `release-mac.md` gains the 0.3.21 paragraph and its schema |
| V3-43 | PL-22 | non-blocking | AGENTS.md does not name the North Star sections | fixed in the run-two wave (run three's candidate): AGENTS.md «The North Star sections Fabric serves»: §4, §6, §10, G5, G10, G25, G29 and the duty to tell fabric-workspace |
| V3-44 | PL-23 | non-blocking | the handoff's waits and next task stale | fixed in the run-two wave (run three's candidate): one wait named with its watcher; the next task names run three's candidate |

### Run three

On the candidate the run-two wave lands, with `bash scripts/ci.sh fast` read green before the reviewers start; five
fresh reviewers.

## Release close

What is owed around the tag, in order; each item is checked off here with its receipt.

0. Before the release commit: at least 5 GB free (`df -h`); one full hosted `ci` run green on the final candidate.
0b. The release commit (the version, `## 0.3.21`, `docs/launch/release-gate.json` with the handoff
   `docs/handoffs/2026-11-14-release-0321.md` in `releaseMetadata`) and its landing on `main` by fast-forward (runbook
   step 1; the 0.3.21 review, iteration 2, PL-9; iteration 3, PL-17).
0c. On `main` after the release commit: iteration 3's ruled findings join their carry-over rows and the general plan's
   lanes, which the gate refuses after `verifiedCommit` (as 0.3.20's item 9; iteration 3, PL-17).
1. The CI release run green on every platform, the published release and its notes from `## 0.3.21`.
2. Install 0.3.21 on this Mac by [the runbook](../../launch/release-mac.md#upgrading-an-existing-database) (no schema
   step): the board switch and «Служба доски» off before the quit, the lifecycle broker's `fabric.desktop` held, the
   bundle checked and replaced, then the broker released and `always_on` again, both switches on once 0.3.21 reads back.
2b. The published DMG smoked (runbook step 7: `--mcp-only` and `packaged-helpers.test.mjs`), CO-575's helpers read as
   `Fabric Helper` on the installed bundle (`ps -o comm=`), and with room on the disk the window check carried from
   0.3.20 (2b below).
3. The Mac Studio by its host agent, asked on the board, with 0.3.20's carried Studio items 3 and 4: each space's
   `schema_version()` read first, a space still on 101 upgraded by the runbook (migration 129) before 0.3.21, the
   Switchboard version and «Служба доски» as 0.3.20's item 3 names them (iteration 3, PL-16).
4. One live `fabric_board_search` call from a coding session against the installed board, its answer read.
4b. The dispatcher watched live for an hour on the installed board: an idle project's request starts a run (CO-565),
   a request to a project with no folder reaches «На проверке» after 30 minutes (CO-573 item 9), and the ops log
   names a failed start's cause (CO-573 item 13); with it 0.3.20's carried items 6 and 8 where a run offers them.
5. The runbook's steps 9 to 11 (with 0.3.20's carried item 10).
6. North Star G29 and §6 in fabric-workspace, told on the board: what of the 10-minute push 0.3.21 carries and what
   CO-571 leaves (PL-2), and that agents now search the board (`fabric_board_search`, `similar_work`, the advice
   `work.search-the-board`) with what that leaves, CO-576 (meaning, not only words) and CO-579 (across projects)
   (iteration 3, PL-19).

### Carried from 0.3.20's close

Open when 0.3.21 was cut (the 0.3.21 review, iteration 1, PL-5); each is done when its receipt is written here or in
0.3.20's ledger: 3, the Studio's install from each space's own schema (iteration 3, PL-16); 2b, the window check of the published DMG (`chat-activation-native`), with room on the disk; 4, one
live run on the Studio seen end to end; 5, the nightly `platforms` run confirming CO-560; 6, CO-563 on a live `-p` run;
7, migration 129 on the installed board and the hyperframes thread told; 8, a dispatched run that asks a question; 10,
the runbook's steps 9 to 11. Owner: this repository's release session; the Studio's items by its host agent. Their place
in the order above (PL-9): 2b with item 2b, 4 with item 3, 6 and 8 with item 4b, 10 with item 5 (its condition, the scheduled workspace publication working again, is met since `2edab709`; iteration
3, PL-15); 3 with item 3; 5 (the nightly
`platforms` run) is read the morning after the tag; 7 (migration 129) is read on the installed board at item 2.

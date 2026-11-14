# Board search: who works on what, and what a piece of work connects to

Date: 2026-11-14. Owner: this repository. Scenario: [SCN-140](../../ux/scenarios.md#scn-140-agents-ask-fabric-who-is-working-on-what-claim-their-task-are-warned-of-related-work-and-release-it)
(amended the same day). North Star: [§6, Fabric's board as the task tracker of the agents](https://github.com/passioncode-ai/fabric-workspace/blob/main/knowledge/north-star.md#6-how-agents-exchange-work-and-information).

**The request.** The operator, this repository's session `0eb9017f`, 2026-11-14: «хочу чтобы агенты делали раг поиск по
доске когда ищут связи кто чем занят». Before this, an agent learned who works on what only by listing:
`fabric_work_list` gives this project's live claims and at most 40 open tasks (with up to 20 returned from review), `com.list` pages the board oldest first,
and neither finds a task, a note or a request by its subject. Related work was flagged only by structure (the same
backlog row, a task link, an overlapping folder), never by what the work is about.

**Vision check.** Serves the vision's coordination layer (`docs/ux/vision.md`; [ADR-0133](../../adr/0133-agents-are-created-composed-and-fixed-in-fabric-and-fabric-is-the-harness-every-coding-agent-reaches.md)):
Fabric always knows where what is being done and can coordinate the agents. No person-facing surface changes.

## 1. The tool

`fabric_board_search` on every session's MCP server, beside `fabric_work_list` (`apps/desktop/src/main/workTools.ts`,
region `board-search-tool`):

| Argument | Meaning |
| --- | --- |
| `query` | 2 to 300 characters: the words of the subject, in Russian and English, ids as written |
| `kinds` | which parts: `tasks`, `notes`, `board`, `projects`; default all |
| `limit` | hits, 1 to 30; default 10 |
| `days` | how far back by the last move or message, 1 to 90; default 30 |
| `includeClosed` | also done and cancelled tasks, to find who did it before; default true |

The answer: `hits`, best first, each with its `kind`, `score`, `matched` (the query's own words that matched),
`snippet`, and what it is: a task with `held_by` (session, agent, how it came in, since, life, what it touches) or
`last_held_by` (who released it last and how); a note with its task and author; a board request with its target
project by name, capability and state; a message with its sender; a project with its capabilities. `who` groups the
hits by holder (a session and its agent, or a project) and says whether any of its hits is live work. `read` counts
what was read; `capped` names a read stopped at its bound; `degraded` names a part that could not be read, with why.
When the live claims could not be read, each task hit carries `holder_unknown` and the answer's `holders` says so, so
a hit without `held_by` is never read as «nobody holds it». A query of stop words alone searches nothing and says so.

`fabric_work_claim` also answers `similar_work` (at most three) when another session's claim that has not lapsed reads
like the task being claimed, by its title and what it touches: two shared words, or half of the words of its title and
touched names, or a file or folder name both claims touch (a name every repository has, such as `src`, `index` or
`README`, `CHANGELOG`, `tsconfig` or a lock file, links nothing, neither as a name nor as a word; a name is read up to its
first dot, so `index.test.ts` reads as `index`, and one under four letters links nothing; the 0.3.21 review, iteration 2,
ER-8, and iteration 3, ER-11)
(`apps/desktop/src/shared/boardSearch.ts#similarClaims`). A hint, never a refusal, beside the structural `related`.

`fabric_whoami`'s rules carry the advice `work.search-the-board` (`apps/desktop/src/shared/protocolObligations.ts`):
search before starting or claiming, and whenever looking for who works on what. Advice, because nothing checks it.

## 2. The ranking

Lexical, by decision: the estate's embedding policy (Observatory's `embedding-policy/1`, PB-137 N-003) sends no
caller's query to a remote model, and the board holds the operator's words. The agent calling the tool is the model
that reads the hits, so retrieval here only has to find them (`apps/desktop/src/shared/boardSearch.ts`, region
`board-search`):

- A text's terms: ids whole in lower case (`co-571`, `fabric_work_list`, `boarddispatchrun.ts`) beside their parts;
  a camelCase word whole beside its parts; every word reduced to its stem by a light suffix rule per script (Russian
  endings longest first, English `-ing`, `-ed`, `-es`, `-s`, `-ies`, `-er`, ...), leaving at least three letters; `ё`
  read as `е`; stop words of both languages dropped.
- BM25 (k1 1.2, b 0.75) over the title, weighted three, and the text; a term of five letters or more also matches a
  longer or shorter term it is a prefix of, at half weight; an id only as the start of a longer document term, never
  by a shorter word it begins with (`boardDispatchRun.ts` does not match `board`; the 0.3.21 review, iteration 3, ER-12).
- The score is BM25 times the share of the query's words that matched (one half to one), times recency
  (1 + 0.5 e^(-age/14 days)), times 1.3 for live work (a task a live claim holds, a request still open).
- A document matching none of the query's words is not answered.

Across languages it matches only the words given in each: the description tells the agent to put both. A semantic
index (embeddings computed on this Mac) is left for when the embedding policy names a local model ([CO-576](2026-08-16-software-fabric-carryover.md)).

## 3. What is read

One project's board, as its session may see it (`apps/desktop/src/main/boardSearchRead.ts`, region
`board-search-read`):

| Part | Read | Bound |
| --- | --- | --- |
| tasks | the project's tasks moved or started in the window, and every open one; with closed ones unless asked not to | 500 (`TASK_ROWS`), named `capped` when full |
| claims | the live claims, as `fabric_work_list` reads them; the claims released in the window, newest first | 1 000 released (`CLAIM_ROWS`) |
| notes | the task notes written in the window, newest first | 1 000 (`NOTE_ROWS`) |
| board | `com.list` with `since`, through the session's own reader door. It pages oldest first, so a window is used only when it fits whole: one day, then 7 days, then the asked window are tried narrowest first and the widest that fits is kept; when one day does not fit, 6 hours, then 1 hour | 5 pages (`BOARD_PAGES`) a window; a last hour that does not fit keeps its oldest 500 and is named `capped` |
| projects | `com.directory`: every other project's name and capabilities (each answered as `{capability, responder}`, `boardService.ts#commsDirectorySchema`) | 5 pages of 100 |

Other projects' tasks are not read: a session sees its own project only (the rule `scope.one-project`), and other
projects' work shows here only as the board messages its project takes part in and as their capabilities.

Every part stands alone: one that fails is named in `degraded` and the others still answer. When every part asked for
failed, the answer says nothing was searched, never that nothing matches; when nothing matches, it says the words were
not found, not that nobody works on it. The tool writes nothing.

## 3a. Cost

The ranking runs in Fabric's main process on every call. Its cost is linear in what it reads: ids are found by
joining neighbouring words, never by a backtracking pattern (the 0.3.21 review, iteration 1, ER-1: one 64 KB message of
one unbroken word took 5 s), each document is read to its first 6 000 characters and each word to 64, and a term's
prefix walk over a document is done once (ER-3), and a query is searched for its first 12 words in its own order, an id
counting as one (`boardSearch.ts#QUERY_WORDS`; ER-9; the 0.3.21 review, iteration 3, DA-9 and DO-19); the words past
them are named in the answer's `not_searched`, never said as not found (UX-11). The read bounds allow 2 500 documents (500 tasks, 1 000 notes, 500 messages, 500
projects). Measured on this Mac on 2 000 documents (the 0.3.21 review, iteration 2, ER-9; iteration 3, DO-18): 0.8 s with a 14-word vocabulary,
1.3 to 2.5 s warm with a realistic one, 4.4 s on a first call, and 8.5 s cold for a 300-character query of absent words
before the 12-word cap. The main process waits that long; a worker is CO-578. No test bounds this by wall-clock time
(PL-13: such a bound failed on a loaded machine); the tests check the bounds themselves.

## 4. Tests

`apps/desktop/src/shared/boardSearch.test.ts` (terms, stems, ids, ranking, recency and live work, snippet, similar
claims, generic names linking nothing, a 64 KB unbroken word, the text, word and query bounds); `apps/desktop/test/board-search-read.test.mjs`
(holders now and last, a request's target by name, a project's capabilities in the directory's own shape, a capability
alone finding its project, a failed part named while the others answer, every part failing, unread claims marking hits,
a query of stop words, the board read narrowest first and said when narrowed, the released claims capped, nothing
matching). Planted defects watched failing: the Russian stems removed, the live-work raise removed, the window narrowing
removed, a failed read not named, the backtracking id pattern restored, the generic-name filter removed, the query cap
removed.

## 5. Out of scope

Other projects' tasks and claims (the project boundary stays; who works on what across projects is CO-579); a
person-facing search screen; an index kept between calls (each call reads within its bounds and ranks at most 2 500
documents, directory included, each read to its first 6 000 characters, `boardSearch.ts#TEXT_MAX`; how far one busy
project's window narrows was not measured; a narrowed board read is said in `board_narrowed`).

# Board search: who works on what, and what a piece of work connects to

Date: 2026-11-14. Owner: this repository. Scenario: [SCN-140](../../ux/scenarios.md#scn-140-agents-ask-fabric-who-is-working-on-what-claim-their-task-are-warned-of-related-work-and-release-it)
(amended the same day). North Star: [§6, Fabric's board as the task tracker of the agents](https://github.com/passioncode-ai/fabric-workspace/blob/main/knowledge/north-star.md#6-how-agents-exchange-work-and-information).

**The request.** The operator, this repository's session `0eb9017f`, 2026-11-14: «хочу чтобы агенты делали раг поиск по
доске когда ищут связи кто чем занят». Before this, an agent learned who works on what only by listing:
`fabric_work_list` gives this project's live claims and at most 20 open tasks, `com.list` pages the board oldest first,
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

`fabric_work_claim` also answers `similar_work` (at most three) when another session's live claim reads like the task
being claimed: two shared words, or half of the task's words, or a file or folder name both claims touch
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
  longer or shorter term it is a prefix of, at half weight.
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
| board | `com.list` with `since`, through the session's own reader door: the window; when it does not fit in 5 pages of 100, the last 7 days; then the last day | 5 pages (`BOARD_PAGES`); a last day that does not fit keeps its oldest 500 and is named `capped` |
| projects | `com.directory`: every other project's name and capabilities | 5 pages of 100 |

Other projects' tasks are not read: a session sees its own project only (the rule `scope.one-project`), and other
projects' work shows here only as the board messages its project takes part in and as their capabilities.

Every part stands alone: one that fails is named in `degraded` and the others still answer. When every part asked for
failed, the answer says nothing was searched, never that nothing matches; when nothing matches, it says the words were
not found, not that nobody works on it. The tool writes nothing.

## 4. Tests

`apps/desktop/src/shared/boardSearch.test.ts` (terms, stems, ids, ranking, recency and live work, snippet, similar
claims); `apps/desktop/test/board-search-read.test.mjs` (holders now and last, a request's target by name, a project's
capabilities, a failed part named while the others answer, every part failing, the board window narrowing to 7 days
and 1, nothing matching). Planted defects watched failing: the Russian stems removed, the live-work raise removed, the
window narrowing removed, a failed read not named.

## 5. Out of scope

Other projects' tasks and claims (the project boundary stays); a person-facing search screen; an index kept between
calls (each call reads within its bounds; at the measured board of 2026-11-13, 326 request threads a week, a 30-day
window narrows to 7 days or one).

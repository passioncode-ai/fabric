# ADR-0194: A session sees who works on what across the estate, as titles, agents and times only

**Status:** proposed · 2026-11-14 · carry-over row CO-579 · records the operator's answer to question `6c3764b6` on the
Board (2026-11-14, 02:52 UTC, option `open-summary`: «Открыть сводку: название задачи, агент, с какого времени») ·
narrows the obligation `scope.one-project` (`apps/desktop/src/shared/protocolObligations.ts`) for one read · follows the
board search of 0.3.21 ([its spec](../evidence/specs/2026-11-14-board-search.md), §5 «Out of scope»).

## Context

On 2026-11-14 the operator asked that agents search the board when they look for who works on what
(«хочу чтобы агенты делали раг поиск по доске когда ищут связи кто чем занят»). Fabric 0.3.21 ships
`fabric_board_search`, which reads one project's tasks, notes and claims: the obligation `scope.one-project` refuses any
other project's content (`scopedStore.ts#OutOfScope`, mode REFUSED). Other projects show only as board messages the
session's project takes part in and as their capabilities. So an agent starting work on a subject cannot learn that
another project's agent is on it now, which is the half of the ask a single project cannot answer.

The question asked the operator to widen what a session sees, because that is an access-level decision and not the
agent's (the operator's rules: «мы тормозим только ... там, где идет вопрос уровня доступа»). The operator chose to
open a summary to every session of the estate: for each project, its live claims as the task's title, the agent and
since when, and nothing else.

## Decision

1. **One read crosses projects, and only these fields.** A session may read, for every active project of its own
   estate, the live claims (not released, not lapsed) as: the project's id and display name, the claimed task's title,
   the claiming agent's label (`work_claims.agent`, or the runtime when none), and `claimed_at`. Never a task's
   instruction, brief, notes, status history, the claim's `touches`, a session id, a folder or a file name.
2. **The database draws the line, not the caller.** The read is one function, `estate_live_claims_reader(p_estate,
   p_reader_project)`, `security definer`, which returns exactly those columns for the given estate and refuses an
   estate the reader's project is not in. The scoped store gains no wider select: `scope.one-project` stays enforced
   for every table read, and this function is its one named exception (the obligation's text says so).
3. **Through the board search, said as another project's.** `fabric_board_search` gains the part `elsewhere`: other
   projects' live claims ranked by the same words against their titles, each hit naming the project, the agent and
   since when, and a note that only titles are visible and the project is asked with `com.submit`. `similar_work` on a
   claim stays within the project.
4. **Bounded and said.** At most 500 live claims a read, the newest first; a read at its bound is named in `capped`.

## Consequences

- Schema 103: one migration adds the function and its grant to `authenticated` only through the session's own door
  (the hub calls it with the session's estate and project, never from an argument).
- `scope.one-project`'s text names the exception, and `check-obligations.mjs` keeps it enforced for the store.
- A title is the one piece of another project's work a session now reads. A title written with a secret or a person's
  data would reach other projects' agents; the claim's title is already shown on the operator's home and the Board, and
  `checkReference` refuses a secret-bearing title at claim time.
- The release that ships it carries an upgrade step (migration to 103) and reviews as any schema step does.

## Not decided here

Search by meaning over other projects' titles (CO-576, Observatory's local model); reading other projects' notes or
briefs (the operator chose titles only).

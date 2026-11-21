# ADR-0208: A project's queue has one order: the owner's rank over a walk of the dependencies, and an agent only proposes

**Status:** accepted · 2026-11-21 · the owner's order from Telegram, relayed by the CEO (board request `f6537624`;
board requests `204ecd3a` and `81e15eb7`; amendment A-2, request `3d7bf548`; set to P0 by the reconciliation A-3) ·
keeps [ADR-0014](0014-the-event-journal-is-the-spine-and-every-register-is-a-projection.md) (the journal is the
spine), [ADR-0053](0053-a-link-is-one-act-and-provenance-is-not-dependency.md) (`blocks` and `follows` are the
dependency edges) and [ADR-0035](0035-the-board-is-a-query-and-the-ceo-is-a-mechanism-before-it-is-an-agent.md) (the
board is a query) · tactics decided by the agent under
[ADR-0205](0205-decisions-split-by-level-strategy-is-the-persons-tactics-the-agents.md).

## Context

The owner, 2026-11-21, through the CEO:

> И в первую очередь сделали то, чтобы приоритизация, как доски на таску упадет

and in board request `81e15eb7`:

> ПРАВИЛА: если таска почти закончена — НЕ менять резко приоритет, не переключать. Если есть смысл подождать — ждём.
> Оптимизация = максимальный финальный результат, а не промежуточный.

The research of 2026-11-20 (`docs/evidence/plans/2026-11-20-task-manager/README.md` on `feat/pages-wave`) found that
priority existed only as `position` inside a goal, written by one screen; the kanban showed the queue newest first,
`fabric_work_list` by start time and the backlog routine by `position`, so three readers gave three orders and the
owner had nowhere to set his own. Dependencies were recorded (`task_links`) and ordered nothing.

## Decision

1. **The owner's order is an event of its own.** `task.ranked@1 {task_id, rank}` projects into `project_tasks.rank`:
   a number per project, lower first, fractional so that one move between two placed tasks is one event. It is not
   `task.prioritised@1`, whose projector overwrites `goal_id`; order inside a goal stays what it was.
2. **Only the person orders.** The projector takes `task.ranked@1` from a person and ignores it from anyone else. No
   agent tool writes it.
3. **An agent proposes, the person decides.** `task.rank.proposed@1 {task_id, after_task_id, why}` is kept on the task
   until the person accepts it (a `task.ranked@1`, one press) or declines it (`task.rank.declined@1`). This is the
   recommended option of question `c45cce40`.
4. **The order is computed, never stored.** One pure function (`apps/desktop/src/shared/taskRank.ts#orderQueue`) walks
   the open tasks and their `blocks` and `follows` links: a prerequisite before what waits for it; ready before blocked;
   then the owner's rank, inherited by prerequisites from everything that waits for them; then the critical path (the
   longest chain of open tasks); then the longer chain, the more unblocked, the earlier filed.
5. **The owner's rank beats the critical path.** He moves; the walk makes his order workable by raising what his task
   waits for. The critical path orders everything he did not place.
6. **Work under way is not reordered.** Only the queue is placed. A task in work or in review keeps its place and
   counts as an open prerequisite.
7. **Every reader takes that order first**: the Board's kanban, the backlog routine's brief and `fabric_work_list`. A
   reader that cannot read it says so and shows its older order; it never presents a guess as the board's order.

## Consequences

- Schema 104 (migration 131): two columns on `project_tasks`, three event types, the projector `apply_task_rank`.
- A drag is honest about what it writes: a drop under unplaced tasks pins them too, so more than one event may follow
  one move; a move between placed tasks stays one.
- The order costs one read of the open tasks and the links per reading, bounded at 2 000 and 5 000 and named when a
  bound is met.
- Not built here, and open (CO-621): a proposal for a whole reordering at once; scores (ICE) that agents propose;
  matching an incoming task against the existing ones (request `204ecd3a`); the priority of projects (task
  `ac9bc489`); horizons and key results from the research's later steps.
- An agent that wants one task before another should link them (`fabric_task_link`): the order then follows from the
  work itself, with no proposal for the owner to read.

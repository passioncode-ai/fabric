# Task priority on the board: handoff at the owner's pause

Record of 2026-11-21, branch `feat/task-rank` from `origin/main` at `608f5416`, worktree
`~/DATA/_worktrees/fabric-task-rank`. Fabric task `0704bca1` (session `d0f6fc18`). No code is written yet: the run
stopped in task-pipeline stage 0 (intake) on the owner's pause.

## Why it stopped

The owner's word of 2026-11-21 about 03:30 (CEO window): every session stands while the reconciling agent
(fabric-workspace `25879d0f`) checks all of the owner's orders and sets priorities. Nothing is released. Work resumes
on the CEO's signal with that agent's decision, which may change this task's scope or place.

## The order

Telegram, 2026-11-21 about 03:15, relayed by the CEO (board request `f6537624`; brief
`ceo/inbox/2026-11-21-spec-protocol-prioritization-process-brief.md` in Fabric's data folder, item 2): build task
prioritisation on the board now. Step 1 «Приоритет» of the research on `feat/pages-wave`
(`docs/evidence/plans/2026-11-20-task-manager/README.md`, section 5), plus an automatic rank by dependencies
(`blocks`, `follows`) with the critical path first. The owner moves, the CEO proposes (question `c45cce40`,
recommended option). Board requests `204ecd3a` and `81e15eb7` (merged), amendment A-2 item 4 (`3d7bf548`), task row
`ac9bc489`.

## Done

- Worktree and branch created; Fabric task `0704bca1` claimed with its brief (what, why, expected).
- File agreement asked of session `8343a070` (blockers) on the project board: thread `4a86b197`, message `8a277834`.
  No answer read yet.
- Code read; the facts the design stands on:
  - `task.prioritised@1` writes `goal_id` and an integer `position`, only from `PlanSection.tsx`; unusable for a
    project-wide order (it overwrites `goal_id`).
  - The kanban queue is read newest first, 100 rows, in `workRead.ts#readTaskBoard`; `fabric_work_list` reads open
    tasks by `started_at` in `workTools.ts`; the backlog routine sorts by `position` in
    `backlogBrief.ts#inPriorityOrder` (read in `routineTick.ts`).
  - `task_links`: row `(task_id, rel, target_id)`; `blocks` means `task_id` blocks the target, `follows` means
    `task_id` comes after the target (`taskTools.ts`, tool `fabric_task_link`). Cycles are refused at the write door.
  - A schema step is one migration file: the next is suffix 130, schema 103. It must add its line to
    `apply_projections` (latest body in migration 124) and admit 103 in `ceo_private_archive_canonical` (latest body
    in migration 129). No other branch on `origin` added a migration when this was read.
  - A new event needs: an `event_types` row, a projector function, `event.<type>` sentences in `i18n/en.ts` and
    `ru.ts`, and an owner line in `desktopIngress.ts`.

## Decisions taken so far (the agent's, tactical; not yet in an ADR)

1. `task.ranked@1 {task_id, rank}`: a fractional rank per project in `project_tasks.rank`. Only the person's event is
   projected; one written by an agent is ignored by the projector.
2. `task.rank.proposed@1 {task_id, after_task_id | null, why}` from an agent (the CEO), kept as
   `project_tasks.rank_proposal`; the owner accepts with one press (which writes `task.ranked@1`) or declines
   (`task.rank.declined@1`). A rank written for the task clears its proposal.
3. One pure function, new `shared/taskRank.ts`, orders a project's queue for every reader: a priority-driven
   topological walk (a prerequisite always before what waits for it). Keys, in order: ready before blocked; the
   owner's rank, inherited by prerequisites from everything that waits for them; on the critical path (the longest
   open chain); longer chain behind it; more tasks unblocked; filed earlier.
4. Tasks in work and in review are never reordered (the owner's rule in `81e15eb7`: a nearly finished task does not
   lose its place).
5. A drag in the queue of one project pins what the owner saw: unranked tasks above the drop point get ranks too, so
   the list he arranged is the list he gets. Ranks are respaced when a gap runs out of precision.
6. Readers that take the order: the kanban queue (ranked rows read first so the cap of 100 never hides them), the
   backlog routine's brief, `fabric_work_list`'s open tasks with the reason for each place.
7. Out of scope: goal horizons, key results, ICE scores, smart matching of incoming tasks, project priorities
   (`ac9bc489`), any change to `task_links`.

## Open

- Everything in the build: migration 130, `shared/taskRank.ts` with tests, the three readers, the write path
  (reorder, accept and decline), the agent tool for a proposal, the kanban's drag, buttons and marks, both locales
  with the copy check, scenario SCN-173, an ADR (reserve with `agent_sync.py reserve ADR`), the design map, the backlog
  row, the release.
- The answer of `8343a070` on shared files and on whether it adds a migration.
- The MacBook's disk is under the 12 GB line: typecheck, vitest and the DB suites run on the build machine
  (`pnpm` is not on its non-login PATH). Pure `shared/` tests run
  locally with `node --experimental-strip-types --test`.

## Exact next task, after the CEO's signal

1. Read the reconciling agent's decision and the thread `4a86b197`; adjust scope and files if either says so.
2. Continue task-pipeline at stage 0: write the brief and spec to `docs/evidence/specs/2026-11-21-task-rank.md` from
   the decisions above, then stage 5 test first: `apps/desktop/test/task-rank.test.mjs` for `shared/taskRank.ts`.

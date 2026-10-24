# Fabric 0.3.12, wave 2: project onboarding, the project page and the business wall

**Date:** 2026-10-23. **Owner:** P-25 ([backlog](../backlog.md)), wave 2 of
[the triage](../plans/2026-10-23-release-0312-triage.md#the-waves-of-0312). **Status:** built in 0.3.12 (slices S1 to S6 on 2026-10-23, S7 and the release review's fixes on 2026-10-24),
narrowed where [the amendments below](#amendments-2026-10-24-what-was-built) say so. Gathered as a spec on 2026-10-23;
the text above the amendments is that spec as it was decided, kept readable.

**Why this page.** The operator, 2026-10-23 (ADR-0176 §1): a task starts only once its spec is whole. Wave 2's spec is
already the operator's words: the walk of 2026-10-22/23 (OF-20, OF-24 to OF-27, OF-31, OF-32, OF-39, OF-40, OF-37's
second half; [the walk](../plans/2026-10-15-fabric-simple/2026-10-23-operator-walk.md)), its decisions D-5 and D-6, and
the scenarios they amended (SCN-165, SCN-171, SCN-175). What follows answers the questions they leave open, each by the
operator's recorded decisions first, then the project's goal, then the safest reversible choice (the operator,
2026-10-23: «выбирай лучшие решения для меня»). Each answer is open to the operator's review.

## What should happen

A project added to Fabric is understood without the person explaining it: an agent onboards it and writes what it is
and is for, its goal, its business, its relations and its plan; the project page shows **Цель, Команда, План**, the
people from Git beside the agents and a small analytics strip; the board never joins projects of two businesses the
operator keeps apart; and a graph shows how the projects relate.

## Why

The operator's walk: the goal read from a README is wrong (OF-24), several people work on some projects and Fabric sees
only agents (OF-27), a project added is not processed (OF-31), nothing maps how projects relate (OF-32), and one
broadcast joined unrelated businesses against the operator's rule of 2026-10-18 (CO-368).

## True when it is done

1. Adding a project (or «Найти связи» on a project) files an onboarding task with a whole brief (SCN-171, SCN-176); an
   agent that takes it records the project's profile through the hub, and the page shows it.
2. The project page reads, top to bottom: back, the head, «Нужны вы», «Агенты на проекте», **Цель · Команда · План**,
   the project's kanban strip, analytics, then «Идеи и материалы» folded (SCN-165 as amended).
3. Команда lists the agents at work and the people who committed to the project's repositories, from Git, only on that
   page (D-5).
4. The board refuses a new thread or an announcement whose projects carry two different businesses; a project without a
   business is not walled (CO-368). Two projects with one name are told apart by their repository (CO-369).
5. The graph opens whole and centred on a project (SCN-175).
6. Every place it touches still works: the home, the kanban, Comms, the hub's other tools (the operator's rule of
   2026-10-23, «не ломать то, что работает»).

**2026-10-24, as built** (each point is detailed in [the amendments](#amendments-2026-10-24-what-was-built)): 1 holds
for a project added to Fabric and for «Познакомиться с проектом» on its page; «Найти связи» was not built and is
narrowed to that one offer. 2 and 3 are narrowed: the page shipped in its own order, «Вопросы ко мне» stands for
«Нужны вы», the people from Git are in «Что это за проект» (Команда lists the project's agents), and «Идеи и
материалы» was not built. 4 holds, widened to every post into a walled thread. 5 is narrowed: the graph opens whole,
or on one project with only its direct neighbours. 6 is the release review's (its ledger,
`docs/evidence/plans/2026-10-24-release-0312-verification.md`).

## Out of scope, and what must not change

- **Notifications outside Fabric (OF-40)** go to 0.4.0: Fabric has no Telegram bot (it told the board so on
  2026-10-23, threads `a28f6852`, `969af4f0`), and reaching the operator's chat needs Fabric to call the communicator,
  a new outbound channel that belongs with agents first. Recorded in CO-401 when this spec landed.
- **The display pass that localizes with a model (OF-37's second half)** goes to 0.4.0: it spends on a model for every
  text shown, and needs a spending record first (the operator's spending rule).
- Documents in a project's repository keep their language (D-2). Fabric writes nothing into a project's repository
  during onboarding; the agent writes the profile through the hub.
- No address is shown outside the project page (D-5).

## Decisions (the questions the scenarios leave open)

| # | Question | Decision | Reason |
|---|---|---|---|
| W2-1 | Where does a project's profile live? | Journal first: a new event `project.profiled@1` (goal, summary, business, relations, plan as done and next, each in the working language; the author session), projected into columns on `projects` (`goal`, `summary`, `business`, `profiled_at`, `profiled_by`) and a `project_relations` table | Journal-as-spine (ADR-0014); the projector is extended by adding a function (`apply_project_profile`), never by rewriting it |
| W2-2 | One schema step in 0.3.12? | Yes, one: migration `20261023000123_project_profile.sql` (schema 96), after the reserved 121 and 122. 0.3.13's integrity fixes keep their own single step | Onboarding cannot store a profile without it; the triage's "one step" was about not making six, and two releases with one each is still the fewest |
| W2-3 | How does an agent write the profile? | A hub tool `fabric_project_profile` (its own project only, `scope.one-project`), every field optional, each call a new event; an empty field clears it | The agent onboarding the project is already in it; the scope wall holds |
| W2-4 | What is a business? | A short name the profile carries (`business`), set by the onboarding agent from what it finds (the GitHub owner, the organization in Observatory's registry, the README), editable by the person on the project page | The operator's rule of 2026-10-18 names businesses, not repositories; a name the person can correct beats an inferred grouping nobody sees |
| W2-5 | The wall's rule | A new thread, or an announcement, whose participants carry two different non-empty businesses is refused with the projects named; an unknown business walls nothing | Refusing on unknown would block the board on day one, before onboarding ran |
| W2-6 | People from Git | Read live from each repository (`git log --format` over the last 365 days, at most 2 000 commits, deduplicated by email), names and last commit; cached 10 minutes; nothing stored | D-5: read, not asked; storing addresses would need a privacy record |
| W2-7 | The onboarding task | Filed when a project is added (one per project, never twice) with a brief whose three parts are written, so the intake rule is met; started only when the person starts it or a routine does | Starting agents by itself is CO-409's wake (0.4.0) |
| W2-8 | Analytics (OF-39) | Per project from the journal: tasks done per week (last 8), lead time (created to done, median), time in review (median), questions waiting and the oldest age, the share reopened; read only | «Read from the journal; no new tracking» (OF-39) |
| W2-9 | The graph | Nodes: projects (summary), and the businesses above them; edges: same business, a relation the profile names, board threads between the two (count), a request from one to the other. Not-cloned repositories of the same GitHub owner come in a later slice when a GitHub read exists | SCN-175; GitHub has no read in Fabric today |
| W2-10 | The agent page (CO-393, OF-30, OF-09) | On Агенты a row of «Агенты в работе» selects its agent and opens the agent's page beside the list (below it in a narrow window); Главная's rows keep opening the console or the project. The page, in the flow's order: the agent's name, project and state; «Открыть консоль», «Открыть проект», «Открыть задачу» where each exists; «Задача» (the claimed task or that it holds none); «Сейчас делает»; «Результаты» (its events that count as results: a task finished or moved to done, a delivery accepted); «Что делал» (every event of its session, newest first, grouped by day, with the note when earlier ones are left out). Read from the session's history (`terminal.history`, the window `SESSION_HISTORY_WINDOW`), again when the journal moves; a failed read is said in its place with «Повторить» | The session history already reads any session's events (an enrolled agent's too); a page beside the list is what OF-30 asked, and Главная's one-press console stays as SCN-163 promises |

## Slices, in order

| Slice | What | Rows | Needs |
|---|---|---|---|
| S1 | The profile: migration 123, `project.profiled@1`, `fabric_project_profile`, the read | OF-24 (data), OF-31 (data) | nothing |
| S2 | The business wall and the directory's names | CO-368, CO-369 | S1 |
| S3 | The onboarding task when a project is added, and «Найти связи» | OF-31; CO-367 and CO-329 moved to 0.3.13 (2026-10-23, below) | S1 |
| S4 | The project page: Цель, Команда (agents and Git people), План and the kanban strip, analytics, «Идеи и материалы», the way back and its scroll, last activity | OF-20, OF-24 to OF-27, OF-39, CO-388, CO-394; CO-307 moved to 0.3.13 (2026-10-23, below) | S1 |
| S5 | The graph | OF-32, SCN-175 | S1 |
| S6 | The places the walk named and their words: «Нужны вы» (CO-391), quotas gone (CO-392), the agent page (CO-393), История (CO-395), the splash's language (CO-306), failure wording (CO-313), screens and flows (CO-400) | the rows named | S4 for CO-394 |
| S7 | The walk's remaining items, added by the triage on 2026-10-23: the Board's agent filter, cancelled tasks and remembered filters, Comms' «Ждут ответа» and the thread under a post, the task page's blockers and moves, the trackpad swipe back (CO-401) | CO-401 | S6 |

Each slice lands on its own with its gate, its scenarios and the map, and never leaves `main` broken.

**2026-10-24, the slices as they landed:** S1 `18962127`, S2 `98e708a3`, S3 `819a60c6`, S4 in three parts (S4a
`b9abae41`, S4b `a6ca87e6`, S4c `8670aa13`), S5 `d03e970c`, S6 `e4995f30` (CO-392), `e3719e38` (CO-306), `2f49d8f3`
(CO-391), `9e90de50` (CO-395), `1b93606c` (CO-313), `70da6627` (CO-393), `9a50002f` (CO-400), `e8d5a4aa` (CO-394), and
a seventh slice the triage added for the walk's remaining items, S7 `86ae2b39` (CO-401). The release review's fixes to
this wave: `7e5185b3`, `33daef36`, `5a47a91d`, `8d555271`, `fa9729cf`, `33f6795e`, `441af121` and `1dee1c0a`. Moved out
of the wave on 2026-10-23 ([the triage](../plans/2026-10-23-release-0312-triage.md)): CO-367 and CO-329 to 0.3.13 with
the tracking of turns (attributing work to a project needs the hooks' turn facts read per repository, and CO-329's
first rule an owner list the profile does not carry), and CO-307 to 0.3.13's schema step (a project's last activity
needs a journal read grouped by project, an SQL function, and 0.3.12 kept its one schema step for migration 123).

## Amendments, 2026-10-24: what was built

Each note is dated and sits under the decision it amends; the decision's own text in the table above is unchanged.

- **W2-1 (2026-10-24):** built as decided, with one more column: `projects.plan jsonb` holds the plan (done and next)
  beside `goal`, `summary`, `business`, `profiled_at` and `profiled_by`
  (`supabase/migrations/20261023000123_project_profile.sql`).
- **W2-3 (2026-10-24):** a call that names no field is refused («name at least one field»); an empty `goal` or
  `summary` clears it; `plan` must be an object of `done` and `next` and is replaced whole, and `relations`, when given,
  replace the whole list (`apps/desktop/src/main/projectOnboarding.ts#agentProfilePayload`, the tool
  `fabric_project_profile` in `apps/desktop/src/main/agentSurface.ts`). A profile for a project this estate no longer
  holds is refused in plain words before anything is journaled (DA-9).
- **W2-4 (2026-10-24, the release review DA-2, ER-2):** the business is the person's, because the wall reads it and the
  party it walls must not be able to take it down. The onboarding agent may set it only while none is recorded; an
  empty business from an agent is refused (an agent never clears it), a different one while one is set is refused with
  the person's route (the project page), and the same one in another case is dropped so the person's spelling stays; a
  read of the current business that fails refuses a business the call names and lets the other fields through. The
  person's value from the project page always applies (`apps/desktop/src/main/projectOnboarding.ts#agentProfilePayload`).
- **W2-5 (2026-10-24, DO-9):** the wall refuses a new thread whose participants carry two different non-empty
  businesses, a post of any kind (a message, a request, a finding, an announcement) into an existing thread whose
  participants already carry two, and a participant's reply into such a thread
  (`apps/desktop/src/main/boardService.ts#businessesJoined`, region `business-wall-check`). A read that fails walls
  nothing and is logged. **A gap:** a responder's fenced `com.reply` and its `com.complete` are not walled; carried in
  CO-418 (0.3.13).
- **W2-6 (2026-10-24, DO-10, UX-6, ER-3):** one `git log` per repository, not per folder: a project's folders are
  grouped by Git's common directory, so a repository's checkouts and worktrees are read once; a commit seen in two
  groups (two clones of one remote) is counted once, by its hash. A reading where every repository was read is cached
  for 10 minutes; a partial one is not cached, so a failure is read again on the next open, and the page says which
  folders were not read and why; concurrent first reads of one project share one reading
  (`apps/desktop/src/main/gitPeople.ts#readGitPeople`).
- **W2-7 (2026-10-24, DA-5, ER-6):** filing is one act: a press that finds the onboarding task with part of its brief
  unwritten writes the missing parts; two presses for one project run one after the other, so the creation and the
  brief are journaled once; every failure, a refused read of the existing task included, is logged (`onboarding.file`)
  before it is thrown (`apps/desktop/src/main/projectOnboarding.ts#createOnboardingFiler`). «Найти связи» was not built:
  the one offer on a project is «Познакомиться с проектом», shown until an agent records a goal or a summary (setting
  only the business keeps it, DA-3).
- **W2-8 (2026-10-24, DA-1, DA-4):** a task reaches done by the person's close (`task.closed@1`), since an agent never
  moves a task to a terminal state; the closes are read with the moves, each as a move to its outcome, so a close as done
  counts as done (`apps/desktop/src/shared/projectAnalytics.ts#withCloses`). The journal is read newest
  first, paged past the gateway's 1 000 rows up to 5 000, and a read that reaches that bound is said on the page («самые
  ранние недели могут быть посчитаны не полностью»); the open questions are read oldest first and counted exactly
  (`apps/desktop/src/shared/projectAnalytics.ts#projectAnalytics`, the `projects:analytics` handler in
  `apps/desktop/src/main/index.ts`). An index for that read is CO-418 (0.3.13).
- **W2-9 (2026-10-24, DO-21):** what the graph draws: businesses as columns (the projects without one, and the targets
  outside Fabric, as columns of their own); lines for the relations the profile names (a target matching no project is
  drawn as a node outside Fabric) and one dashed line per pair of projects that share board threads, with how many
  messages they hold. No «same business» or «request» edge is drawn, and no not-cloned repository: that still waits for a
  GitHub read. It opens whole from «Граф проектов» under the rail's list; from a project's graph mark on the rail or
  «Связи» on its page it shows that project and only its direct neighbours, with «Весь граф» back to the whole
  (`apps/desktop/src/shared/projectGraph.ts#aroundProject`, `apps/desktop/src/renderer/src/launch/GraphScreen.tsx`).
  Not built in 0.3.12: «Повторить» on a failed read and a legend for the dashed lines (CO-418, 0.3.13).
- **The project page (S4, 2026-10-24):** it shipped in this order, not the order of point 2: the way back; the head
  (name, purpose, «Сейчас») with «Доска проекта», «План» and «Связи»; then, in the main column, the way («Где мы»), or
  «Начните с первого результата» for a project with no task, «Вопросы ко мне» (this project's part of «Нужны вы») and
  the kanban strip; beside it, «Агенты на проекте», the goal while none is recorded, «Что это за проект» (the summary,
  «Цель», «План», «Бизнес», «Связанные проекты», «Люди (из Git)»), «Как идёт работа», «Команда» (the project's agents),
  «Ритм работы» and «Ресурсы и настройки», folded (`apps/desktop/src/renderer/src/launch/ProjectLaunch.tsx`). «Идеи и
  материалы» was not built in 0.3.12.

## Amendments, 2026-10-24, the release review's iteration 2

- **W2-4 (iteration 2, DA-1, DA-2, ER-2):** once the person has written a project's business (cleared included), no
  agent sets it; an agent may record one only where no person ever wrote it (`main/projectOnboarding.ts#writeAgentProfile`,
  a `project.profiled@1` naming `business` with a person as actor). The person's and an agent's writes run one at a
  time per project in the main process (`projectProfileLock`). An owner read that fails refuses the business, lets the
  other fields through, and is logged. A rebuild from the journal still takes the last event; enforcing the rule in
  the projector is a schema step (CO-418). The W2-4 note above saying other fields go through when the business read
  fails held only after this change.
- **W2-5 (iteration 2, ER-3, ER-4, DA-4):** the wall reads archived projects too (an archived namesake does not rename
  a project in `com.directory`); its reads page by key, not offset; one 5-second deadline covers a post's whole check;
  a read that fails, answers nothing or runs out of time walls nothing and is logged with its reason (fail open, as
  W2-5's row decided: refusing on an unknown business would block the board).
- **W2-6 (iteration 2, ER-6):** at most four `git` runs at once; a reading with a repository unread is held 60 seconds
  (a complete one 10 minutes).
- **W2-8 (iteration 2, ER-5, DA-3):** the analytics read pages by `seq` below the last row read, so a growing journal is
  neither counted twice nor skipped.


# Fabric 0.3.12, wave 2: project onboarding, the project page and the business wall

**Date:** 2026-10-23. **Owner:** P-25 ([backlog](../backlog.md)), wave 2 of
[the triage](../plans/2026-10-23-release-0312-triage.md#the-waves-of-0312). **Status:** spec gathered, not built.

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

## Slices, in order

| Slice | What | Rows | Needs |
|---|---|---|---|
| S1 | The profile: migration 123, `project.profiled@1`, `fabric_project_profile`, the read | OF-24 (data), OF-31 (data) | nothing |
| S2 | The business wall and the directory's names | CO-368, CO-369 | S1 |
| S3 | The onboarding task when a project is added, and «Найти связи» | OF-31, CO-367, CO-329 | S1 |
| S4 | The project page: Цель, Команда (agents and Git people), План and the kanban strip, analytics, «Идеи и материалы», the way back and its scroll, last activity | OF-20, OF-24 to OF-27, OF-39, CO-388, CO-307, CO-394 | S1 |
| S5 | The graph | OF-32, SCN-175 | S1 |
| S6 | The places the walk named and their words: «Нужны вы» (CO-391), quotas gone (CO-392), the agent page (CO-393), История (CO-395), the splash's language (CO-306), failure wording (CO-313), screens and flows (CO-400) | the rows named | S4 for CO-394 |

Each slice lands on its own with its gate, its scenarios and the map, and never leaves `main` broken.

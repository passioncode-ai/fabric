# Fabric's tasks: how they work today, and a product layer for the project page

Research of 2026-11-20 on branch `feat/ceo-window-place` at `f82c78d2` (read only). Paths are
relative to the repository root. Outside sources were opened on 2026-11-20.

## Коротко для владельца

- Таск-менеджер у нас свой и не «на коленке»: каждая задача сначала пишется в журнал событий, а таблицы строятся из
  него. Есть пять состояний (очередь, в работе, на проверке, готово, отменено), правило «агент сам задачу не закрывает»,
  захваты задач агентами с истечением и арбитражем. Это ядро прочное.
- Чего нет: продуктового слоя. Цели есть, но это только заголовок. Нет OKR и метрик, нет горизонтов «сейчас / дальше /
  потом», нет оценки приоритета, нет режима «Приоритет» с перетаскиванием (поле порядка в базе есть, экрана нет).
- Бэклог живёт в двух местах: строки в markdown-реестрах репозитория и задачи Fabric; связаны только адресом строки.
  Запросы с доски проектов будят агента, но задачу не создают.
- Готовые open-source трекеры (Plane, Huly, Vikunja и др.) под капот брать не советую: лицензии AGPL ломают нашу
  двойную лицензию, стеки чужие, модель «человек ведёт задачи, агенты исполнители» прямо запрещена нашим anti-vision.
  Локально в `~/DATA` такой проект не найден.
- Рекомендую: оставить своё ядро и добавить поверх продуктовый слой из 5 шагов: режим «Приоритет», горизонты целей,
  ключевые результаты с метриками, продуктовые заметки (возможности), история проекта и решений.
- Решить с вами: кто может менять порядок (только вы или и CEO по вашим словам), какие метрики считаем ключевыми, и
  оставляем ли markdown-реестры источником бэклога.

## 1. How Fabric's tasks work today, as built

### 1.1 Where a task is stored

- **The journal is the only writer.** `journal` is append-only, ordered per estate, written only through
  `append_event()` (`supabase/migrations/20260831000001_migration_one.sql:110`); every register is a projection rebuilt
  from it ([ADR-0014](../../../adr/0014-the-event-journal-is-the-spine-and-every-register-is-a-projection.md)).
- **`project_tasks`** began as "the text plus the session it produced"
  (`supabase/migrations/20260831000004_tasks.sql:9`) and grew into the board in migration 16: `title`, `section`,
  `goal_id`, `position`, `origin_kind`, `origin_ref`, `assigned_by`, the brief (`brief_what`, `brief_why`,
  `brief_expected`) and `closed_reason` (`supabase/migrations/20260905000016_operating_surfaces.sql:47`). The status
  ladder is `backlog, running, review, done, cancelled` (same file, line 75).
- **Neighbours:** `task_notes` (append-only working context, line 81) and `task_links` (`blocks`, `follows`,
  `spawned`, to a task or a goal, a DAG whose cycles are refused at the write boundary, line 107;
  [ADR-0053](../../../adr/0053-a-link-is-one-act-and-provenance-is-not-dependency.md)); `leases` (current holder only,
  line 186); `work_claims` (who claimed what, how they came in, what they touch, how it ended) and `task_sources` (the
  backlog row a task serves, by repository, path and id: an address, never a copy), both in
  `supabase/migrations/20261011000095_work_claims.sql:40` and `:75`.
- **Goals and priority:** `goals` is `id, project_id, title, autonomy`
  (`20260831000001_migration_one.sql:53`); `task.prioritised@1` writes `goal_id` and an integer `position`
  (`20260908000033_projector_scope.sql:383`); projects carry a declared `priority_tier`
  (`20260906000029_priority_and_trust.sql:14`).

### 1.2 How a task is created (every writer of `task.created@1`)

| Source | Where |
|---|---|
| An agent files work, origin required | `fabric_task_create`, `apps/desktop/src/main/taskTools.ts:148`; origin kinds in `apps/desktop/src/shared/origin.ts#ORIGIN_KINDS` |
| An agent claims a backlog row or a new row | `fabric_work_claim`, `apps/desktop/src/main/workTools.ts:450` (files the task at line 298) |
| The person starts work in a console (also the CEO's `fabric_ceo_session_start`, routines and chains, which launch through it) | `apps/desktop/src/main/index.ts:2115` |
| The person files an idea | `IPC.tasksFileIdea`, `apps/desktop/src/main/index.ts:2875` |
| «Поручить агенту B»: a task in B plus a board request | `apps/desktop/src/main/crossProjectAssign.ts:64` |
| Project onboarding | `apps/desktop/src/main/projectOnboarding.ts:89` |

Backlog rows in Markdown are a second, separate home. `docs/backlog-sources.json` declares 15 table sources (eight
of them in `docs/evidence/backlog.md`, plus the carry-over ledger
`docs/evidence/specs/2026-08-16-software-fabric-carryover.md`, 589 `CO-*` rows), which the workspace publishes as the
read-only common backlog ([ADR-0098](../../../adr/0098-workspace-federates-repository-backlogs.md) §1, §2). Fabric does
not import them; an agent links a task to a row (`apps/desktop/src/main/backlogSource.ts#resolveBacklogSource` checks
that the id appears in the file).

Board requests between projects (`com.*`) do not create tasks: "the board dispatcher starts a session for a request
without filing a task" (`apps/desktop/src/shared/workDirections.ts`, header comment).

### 1.3 States and who moves them

`apps/desktop/src/shared/ladder.ts#LADDER` and `#mayMove`: an agent moves between backlog, running and review only;
done and cancelled are the person's (`fabric_task_move`, `taskTools.ts:551`). An agent may close only with the
operator's relayed words (`fabric_task_close`, `taskTools.ts:581`;
[ADR-0184](../../../adr/0184-an-agent-closes-a-task-on-the-operators-relayed-decision.md)). A claim moves its task to
running and a `done` release moves it to review (`workTools.ts:450`, `:612`). The sweep returns tasks nobody holds to
backlog and closes a review older than three days as done by the system actor
(`apps/desktop/src/main/workRelease.ts#acceptReviewByDefault`). A task starts only with a full brief
([ADR-0176](../../../adr/0176-a-task-is-grilled-to-a-full-spec-and-crosses-machines-by-trust.md)).

### 1.4 Where tasks are shown

- **Kanban** (`apps/desktop/src/renderer/src/launch/KanbanBoard.tsx`): backlog, running, abandoned, review, done,
  read by `apps/desktop/src/main/workRead.ts#readTaskBoard`. The backlog column is ordered by filing order
  (`order('seq')`), not by `position`.
- **Project page** (`apps/desktop/src/renderer/src/launch/ProjectLaunch.tsx`): «Вопросы ко мне», «Направления
  работы» (`ProjectDirections`, line 175), the agents here, the goal (only `project.purpose`), the profile
  (`ProjectProfile.tsx`), eight-week flow analytics (`apps/desktop/src/shared/projectAnalytics.ts#projectAnalytics`:
  done per week, lead time, review time, reopened share), team and rhythm.
- **Directions of work** (`apps/desktop/src/shared/workDirections.ts#composeDirections`): each task in exactly one
  row (to review, from you, from backlog via `task_sources`, from plan via `goal_id`, from agents) plus requests from
  and to other projects (`apps/desktop/src/main/projectRequests.ts#readProjectRequests`, 30 days, 200 each way).
- **Plan** (`apps/desktop/src/renderer/src/PlanSection.tsx`): goals with their open tasks; «attach» appends a task at
  the end of a goal (line 77). It is the only caller of `tasks.prioritise`.
- **Detailed project board** (`apps/desktop/src/renderer/src/ProjectHome.tsx:790`): drag moves a card between
  columns, never within one.

### 1.5 Diagram

```
 SOURCES                                WRITE DOOR                    PROJECTIONS            SHOWN ON
 agent: fabric_task_create ----+
 agent: fabric_work_claim -----+
 person: console / idea -------+--> journal (append-only) --> project_tasks ----------> Kanban (KanbanBoard)
 CEO / routine / chain launch -+    task.created@1             task_links, task_notes   Project page:
 cross-project assign ---------+    task.moved@1               leases, work_claims        Направления работы
 project onboarding -----------+    task.closed@1              task_sources --------->    Plan (goals)
                                    task.prioritised@1         goals                      Analytics (8 weeks)
 Markdown registers (backlog.md, ---- linked by address only (task.source.linked@1)
   carry-over, plans) ---------> workspace publication (read-only common backlog, ADR-0098)
 com.* board requests ---------> dispatcher wakes a session (no task) --> «От других проектов» row
```

### 1.6 Solid and improvised

Solid: one spine with replayable projections; an enforced ladder with a permission rule; claims arbitrated by the
projector, not by the tool; origin required; cycle-safe links; every read names its caps.

Improvised or thin:
- Priority exists only as an integer `position` per goal, set by «append to end»; no screen orders it. The agents'
  backlog routine already sorts by it project-wide (`apps/desktop/src/shared/backlogBrief.ts#backlogBrief`), so two
  goals' "position 1" tie.
- `goals` carry no measure, horizon or status; the project page's "goal" is the free-text `purpose`.
- Two backlogs (Markdown rows, `project_tasks`) joined by an address; rows not linked are invisible in Fabric.
- Requests between projects never become tasks, so their work is not on the kanban.
- "Board" means three things: the ranked attention queue ([ADR-0035](../../../adr/0035-the-board-is-a-query-and-the-ceo-is-a-mechanism-before-it-is-an-agent.md)),
  the kanban and the inter-project `com.*` board.

## 2. Gaps against the owner's ask for the project page

| Asked | Today | Gap |
|---|---|---|
| Backlog | Kanban backlog column; Markdown rows outside | No single ordered backlog; unlinked rows invisible |
| «Приоритет», drag to order | `task.prioritised@1` and `position` exist; only `PlanSection.tsx:77` writes them | No ordering screen; position scoped to a goal |
| OKR | `goals` (title, autonomy) | No objective/key-result split, no target, no period |
| Metrics | Flow metrics from the journal (`projectAnalytics.ts`) | No product metric (users, revenue, retention), no link from a goal to a number |
| Product notes | `task_notes` per task; project memory facts | No place for opportunities, insights or research tied to a goal |
| Graph of how the project moved | Done per week (8 weeks); graph of relations between projects (`GraphScreen.tsx`) | No timeline of milestones, goals reached, releases |
| Decisions taken | ADRs in the repo; answered questions are decisions (ADR-0035) | Not shown on the project page together |

## 3. Product frameworks worth applying

| Framework (source) | On a Fabric project page | Data Fabric already has | Cost |
|---|---|---|---|
| Now / Next / Later ([ProdPad](https://www.prodpad.com/blog/invented-now-next-later-roadmap/), opened 2026-11-20): horizons instead of dates, each item tied to an objective | Three lanes of goals; tasks follow their goal | `goals`, `task.prioritised@1` | Low: one horizon field on goals |
| OKRs ([What Matters](https://www.whatmatters.com/faqs/okr-meaning-definition-example), 2026-11-20): one objective, 3 to 5 measurable key results | Goal card with key results and a progress line | `goals`; flow metrics | Medium: key results and readings |
| North Star and input metrics ([Amplitude](https://amplitude.com/blog/product-north-star-metric), 2026-11-20): one value metric, 3 to 5 input metrics the team moves | One headline number per project, key results as its inputs | None in Fabric; analytics agents hold product metrics | Medium: a metric source over MCP |
| RICE ([Intercom](https://www.intercom.com/blog/rice-simple-prioritization-for-product-managers/), 2026-11-20): reach x impact x confidence / effort; ICE ([Growth Method](https://growthmethod.com/ice-framework/), 2026-11-20): impact, confidence, ease, 1 to 10 | Optional score on a backlog card; the «Приоритет» mode sorts by it, the person drags to override | `position` | Low: a score event, agents propose |
| Opportunity solution tree ([Product Talk](https://www.producttalk.org/opportunity-solution-trees/), 2026-11-20): outcome, opportunities, solutions, assumption tests | Product notes as opportunities under a key result; tasks as solutions | `task_links` to goals; memory facts | Medium to high: a new link target |
| Shape Up ([Basecamp](https://basecamp.com/shapeup/2.2-chapter-08), 2026-11-20): six-week bets, appetite, circuit breaker | A goal as a bet with an appetite; the sweep flags work past it | Analytics lead time; the sweep | Medium |
| JTBD ([Christensen Institute](https://www.christenseninstitute.org/theory/jobs-to-be-done/), 2026-11-20) | The job a project serves, in the profile | `docs/ux/foundation.md` via super-ux; project profile | Low: text field |
| Story mapping ([Jeff Patton](https://jpattonassociates.com/story-mapping/), 2026-11-20): a model of the user's journey | Scenarios as columns, tasks below | `docs/ux/scenarios.md` (SCN ids) | High: a new view |
| Dual-track ([SVPG](https://www.svpg.com/dual-track-agile/), 2026-11-20): discovery produces validated backlog items, delivery ships | Two lanes: notes and experiments, then tasks | `task_type`, origin kinds | Low as a filter |

The best fit for an agent-run project: Now/Next/Later over goals, OKRs whose key results read numbers, ICE as the
agents' proposed order with the person's drag on top, and opportunities as product notes (a light OST).

## 4. Open-source task managers as an engine

**Local search.** Folder names at `~/DATA` top level, `~/DATA/_worktrees`, `_refs`, `_scout-src`, `_downloads`,
`worktrees`, `_wt`: no checked-out task manager or kanban. Nearest: `_refs/Codync` (Apache-2.0, messaging coding
agents from a phone, not a tracker), `founder-board-agent`, `task-pipeline`, `agent-sync` (our own tools). If the owner
meant something else "лежит у нас", it needs naming.

Repository facts read with `gh api repos/<repo>` on 2026-11-20:

| Candidate | License | Stack | Local beside Supabase | Notes |
|---|---|---|---|---|
| [Plane](https://github.com/makeplane/plane) | AGPL-3.0 | TypeScript + Django; compose: web, api, workers, Postgres, Redis, RabbitMQ, MinIO | Heavy (13 services) | Strongest product (cycles, modules, intake); MIT [MCP server](https://github.com/makeplane/plane-mcp-server) |
| [Huly](https://github.com/hcengineering/platform) | EPL-2.0 | TypeScript; CockroachDB, Redpanda, Elastic, MinIO | Very heavy | README: "repository is frozen", "Hosted Huly has shut down" |
| [Vikunja](https://github.com/go-vikunja/vikunja) | AGPL-3.0 | Go, REST (OpenAPI) | Light | Personal tasks, no product layer |
| [Focalboard](https://github.com/mattermost-community/focalboard) | AGPL-3.0 or Mattermost commercial (LICENSE.txt) | TypeScript + Go | Light | README: "currently not maintained" |
| [Kanboard](https://github.com/kanboard/kanboard) | MIT | PHP | Needs a PHP runtime | Classic kanban |
| [Taiga](https://github.com/taigaio/taiga-back) | MPL-2.0 | Python/Django | Medium | Scrum oriented |
| [OpenProject](https://github.com/opf/openproject) | GPL-3.0 | Ruby | Heavy | Portfolio, Gantt |
| [Leantime](https://github.com/Leantime/leantime) | AGPL-3.0 | PHP | Medium | Goals focused |
| [Planka](https://github.com/plankanban/planka) | PLANKA Community License + commercial (LICENSE.md) | JavaScript | Medium | Not OSI open source |
| [AppFlowy](https://github.com/AppFlowy-IO/AppFlowy) | AGPL-3.0 | Dart/Rust | Own sync | Notion-like |
| [WeKan](https://github.com/wekan/wekan) | MIT | Meteor | Needs MongoDB | Trello-like |
| [Backlog.md](https://github.com/MrLesk/Backlog.md) | MIT | TypeScript | Files in Git | Markdown tasks for humans and AI agents |
| [beads](https://github.com/gastownhall/beads) | MIT | Go, Dolt | Own DB | Dependency graph for coding agents, claim, PyPI `beads-mcp` |
| [Vibe Kanban](https://github.com/BloopAI/vibe-kanban) | Apache-2.0 | Rust | Local | README: "Vibe Kanban is sunsetting" |

**What the licenses mean here.** Fabric ships as `AGPL-3.0-only OR LicenseRef-PassionCode-Commercial`
(`package.json:26`). The commercial option exists only while PassionCode can license all of the code; vendoring AGPL,
GPL or EPL code (Plane, Vikunja, Focalboard, Leantime, AppFlowy, OpenProject, Huly) would make the commercial edition
impossible without a licence from that vendor. Running one as a separate server reached over its API is not a derived
work, but it is then a second product to install, upgrade and back up on every machine. MIT and Apache code (Kanboard,
WeKan, Backlog.md, beads) is license-safe, yet none shares our stack (Electron + Supabase + journal).

**Fit with Fabric's model.** Every candidate stores state in mutable rows; Fabric's rule is "every register is a
projection of the journal" (ADR-0014). Adopting one means either two truths (a sync that drifts, which ADR-0035 §1
rejects for the board) or replacing the journal for tasks, which breaks claims (`work_claims` has a foreign key to
`project_tasks`), the dispatcher, the sweep, the MCP task and work tools (`taskTools.ts`, `workTools.ts`) and replay. Most of all,
`docs/ux/vision.md:66` names in the anti-vision "a human task tracker with agents attached as assignees", which is
what Plane, Taiga, OpenProject and the rest are. Migration cost: high; risk: the board that works today.

Worth borrowing as ideas: beads' "ready" queue (unblocked work only) and dependency graph, Backlog.md's acceptance
criteria as a field, Plane's intake (triage) and cycles. An optional later adapter could publish a project to Plane
over its MCP server one way, never as the source.

## 5. Recommendation

**Keep Fabric's own model and add the product layer on the journal.** Reasons: the core is solid and already agent
native (section 1.6); the anti-vision and ADR-0014 rule out an external tracker as the source; licences block
embedding the strongest candidates; the missing parts are product concepts, not task plumbing.

New vocabulary, each with `event_types` rows, an `i18n` feed sentence, a projector function added beside the others
(the repository's migration rule) and grants with RLS:

- `task.ranked@1` (project-wide rank, fractional so one drag is one event) projected into `project_tasks.rank`.
  A new event rather than reusing `task.prioritised@1`, because that projector overwrites `goal_id` with whatever the
  payload carries (`20260908000033_projector_scope.sql:383`). `backlogBrief.ts` and `fabric_work_list` read rank first.
- `goal.horizon.set@1` (now, next, later) and `goal.closed@1` on `goals`.
- `key_result.defined@1` and `key_result.measured@1` into `key_results(goal_id, title, metric_ref, baseline, target,
  period)` and `key_result_readings(value, at, source)`. A metric reference names Fabric's own flow metrics first, then
  an analytics agent's MCP metric.
- Product notes: memory facts with a new closed category (`20260909000050_insight_category.sql:46`), linked to a key
  result; `task_links.target_kind` widened to `opportunity` (a check constraint change, line 107).
- `task.scored@1` (ICE), proposed by agents, never reordering by itself.

Staged plan:

1. **«Приоритет» mode on the project page.** Sortable backlog, drag writes `task.ranked@1` by the person (the CEO only
   with relayed words, as ADR-0184); the kanban's backlog column and the backlog routine follow the rank. No change to
   claims or the dispatcher.
2. **Horizons over goals.** Now/Next/Later lanes on the project page; the goal panel shows real goals instead of
   `purpose`.
3. **Key results with metrics.** Key results under a goal, readings journalled, flow metrics first; a reading that
   cannot be taken says so, never zero.
4. **Product notes and requests as work.** Opportunities under key results; an accepted board request may file a task
   in the receiving project's backlog (same tie as `crossProjectAssign.ts`).
5. **Project history.** A timeline projection of goals reached, key-result readings, releases and decisions
   (answered questions, ADRs linked by path), drawn on the project page.

To decide with the owner:
- Who may reorder: only the owner, or also the CEO and PM agents on his words.
- Rank per project (recommended) or per goal.
- OKR period (quarter, six-week bets) and which metric sources count for each project.
- Whether Markdown registers stay the backlog's source (ADR-0098) with Fabric linking rows, or Fabric tasks become the
  source and registers a publication. Changing that is a new ADR.
- Whether the three-day accept-by-default in review stays when key results judge the outcome.

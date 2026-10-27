# Simple Fabric: the main screen and an agent's screen

**Status:** built in 0.3.14, wave 4 ([plan](../evidence/plans/2026-10-26-release-0314-plan.md#built-the-simple-fabric-wave-4)), with the lead's defaults for the open choices · 2026-10-26 · plan row P-28 · mockup:
[docs/reports/2026-10-26-simple-fabric/mockup.html](../reports/2026-10-26-simple-fabric/mockup.html)

This was the proposal the operator accepted with his review of the mockup; wave 4 settled its open choices with their
defaults, amended SCN-158, SCN-166 and SCN-162 and rewrote SCR-84, SCR-85 and SCR-87 in the changes that built it
(super-ux: scenarios first). Its second review is [v2](2026-10-26-simple-fabric-v2.md).

## The operator's words

The operator, 2026-10-26, a voice dictation in this repository's session, verbatim:

> смотри давай скорректируем сейчас нашу стратегию немножко по фабрику значит нас на самом главном типа вот открываю
> dashboard значит что я хочу видеть вот слева эта менюшка с проектами сортированные в алфавитном порядке все окей там
> же я могу переключить проекты либо агенты и агенты сразу который типа он, плюс ветка, там наверное, в которой он
> работает Вот, эти агенты, типа проект-агенты я приключаю, значит, по центру ваш фабрик SEO, сверху там ритм работы,
> статистика, вот, типа, окей, блок статистики, проработаем еще, типа, хочу, чтобы он был более информативный. Дальше,
> типа, вот этот будет по центру, значит, у нас идет... По центру у нас идет в работе блок главный. Там у нас по
> каждому нашему агенту Точнее, по каждому нашему сначала проекту. Внутри проекта может быть несколько агентов. Значит,
> сначала идет по каждому проекту, типа, какой у нас, мы пишем проект, типа, чем вообще, какие у нас внутри есть
> агенты. агенты репортили туда типа и так вот по всем агентам все я открываю вижу все свои работающие проекты агенты
> в них типа чем мы сделаем дальше я могу провалиться в любой агента открыть увижу конкретно его уже типа задачу то
> есть типа этот агент он сразу же должен быть на экране конкретно что за агент его вот эта история его работы типа
> сразу же я вижу типа Сначала что конкретно делают, чтобы сверху вниз я листал, и это те таски, которые он уже
> закрывал, какие-то summary, mailstone, которыми он ушел. Сейчас, с правой стороны, какие-то настройки, есть ли
> вопросы, продумать, тут куча всяких блоков, журналов, какие-то непонятные агенты, настройки очень сложные сейчас
> пользоваться, каждый экран это невероятный труд. Давай попробуем сейчас это максимально упростить и вот перейти к
> тому состоянию, которое я тебе сейчас описал, для того, чтобы фабрик стал используемым. Плюс, если мы делаем связь
> из каких-то проектов, то есть у нас там какие-то фиксы надо делать в дашборде, какие-то в e-mail, какие-то еще где-то,
> у нас всегда есть два способа. Либо открыть консоль с агентом внутри этого проекта, либо перейти в фабрик. Перейти в
> фабрик, это значит, что мы создаем агента в этого проекта в фабрике, типа, и он получает задачу оттуда. Но по сути,
> когда мы открываем агента в фабрике, мы должны тоже уметь подключаться к этим сессиям, то есть уметь открывать эту
> сессию. то есть агентскую. Она не всегда, когда мы нажимаем на агент, она не сразу открывается. Сначала мы показываем
> все-таки ее там статус, планинг и так далее, но мы справа где-то должны видеть ее актуальную сессию, чтобы это видно
> было, что он сейчас работает, статус агента там какой, и можно было открыть ее, чтобы сессия открылась и можно было
> ее посмотреть.

Read as: one home that answers "which projects are at work, which agents in each, on what, and what they last
reported"; one agent screen that answers "what it does now and what it has done, newest first", with its live session
beside it and opened only on press; a right column that holds only what needs the person; everything else out of the
main path; and two named ways to hand work to another project.

## Vision check

Aligned. It serves the alignment test's points 1 and 4 (docs/ux/vision.md, §9): the home is grouped by **project**
first and an agent appears only inside the project it works in, so the Project stays the operating unit and each
agent row carries its task and its last report (an operating loop made visible, not a chat). Point 2: an agent is named
by its runner and session, never as the owner of the work; the task, its brief and its history stay with the project,
so a runner can be replaced. Point 3: the cross-project handoff (part 5) is an explicit, recorded request with an owner
on each side, not a console typed into silently.

Anti-vision, checked line by line: it is **not a multi-chat cockpit**. The home shows no console; a session opens only
when the person presses «Открыть сессию» on one agent, and the main column is project groups, not a grid of sessions.
It is not a task tracker with agents as assignees: the unit on the home is the project, and a task appears only as
what an agent is doing or as the subject of a question. It copies no provider state.

## What 0.3.14 already delivers

From [the 0.3.14 plan](../evidence/plans/2026-10-26-release-0314-plan.md), on `release/0.3.14`:

- An agent's tasks newest first, each expandable to its brief and openable: `work.session`
  (`apps/desktop/src/main/workRead.ts#readSessionTasks`, `apps/desktop/src/shared/sessionTasks.ts#composeSessionTasks`)
  shown as «Задачи» on the agent page (`apps/desktop/src/renderer/src/launch/AgentPage.tsx#AgentPage`).
- An agent's current task is its newest running one: claim, else Fabric-launched task, else the task of its newest
  stage report; untitled kept (`apps/desktop/src/shared/homeLive.ts#composeHome`).
- «Брошено» apart from «В работе», counted on the home, the Board and a project's glance
  (`apps/desktop/src/shared/taskBoard.ts#composeTaskBoard`, `apps/desktop/src/renderer/src/launch/HomeWork.tsx#HomeWorkLanes`).
- Nudges on every turn, the `work-unclaimed` and `brief-missing` findings, `fabric_whoami`'s `waiting` block
  (`apps/desktop/src/main/sessionWaiting.ts#readWaiting`): the sync half that makes agents report, which this design
  needs in order to have anything to show.

## What this adds

1. A left column with an alphabetical project list and a Проекты / Агенты toggle; the agents view names each working
   agent's project and git branch.
2. A home whose centre is a statistics strip and «В работе» grouped by project; «Где остановились», the two lanes, the
   live feed and the projects table leave it.
3. An agent screen whose top is «Сейчас», whose body is the 0.3.14 task list enriched with each task's milestones and
   closing summary, and whose right column is the live session card with «Открыть сессию».
4. A right column on the home that holds only «Нужны вы».
5. Two named cross-project actions on a task: «Открыть консоль в B» and «Поручить агенту B в Fabric».

## 1. The left column

**Today.** The rail (`apps/desktop/src/renderer/src/launch/LaunchShell.tsx#LaunchShell`, region `rail`): «Создать», four
places (`PLACES`: Главная, Агенты, История, Настройки), then «Проекты», ordered favourites first and then by last
activity (`apps/desktop/src/shared/railProjects.ts#railProjects`), each with a live dot, a star, a waiting count and a
graph button.

**Changes.**

1. The column keeps the brand and «Создать» at the top.
2. Below them a two-way toggle, «Проекты» | «Агенты» (a segmented control, the choice remembered for the window like the
   scroll positions are).
3. **Проекты** lists the projects **at work**, **alphabetically** (`localeCompare` on the name, the locale's collation):
   a project where an agent works, a task is in work or in review, something waits for the person, the person pinned
   it, or it is on screen. A quiet last row «Все проекты · N» unfolds every active project in place, alphabetically,
   and folds back. Each row keeps the live dot (an agent at work in it, a terminal-joined one included), the star as a
   mark only, and the gold count of questions waiting. A row opens the project page (SCR-86). *Amended 2026-10-27 (the
   mockup parity, [rail gap 1](../reports/2026-10-27-mockup-parity/gaps/2026-10-27-rail.md)): the operator approved the mockup's
   seven rows, not a list of every project; the rule is `apps/desktop/src/shared/railProjects.ts#projectsAtWork`,
   tested in `railProjects.test.ts` «projectsAtWork».*
4. **Агенты** lists every agent at work now, one row each: the runner («Claude Code», «Codex»), its project, and the git
   branch it works on in monospace, with a dot for its state (работает, молчит). Sorted by project name, then by most
   recent sign of life. A row opens the agent screen (part 3). An agent that is only installed, idle or disconnected is
   not listed here: those live in Настройки → «Агенты для кода на этом компьютере» (SCR-89), which already lists them.
5. At the foot, two quiet links: «История» and «Настройки». Главная is the brand itself (press it to come home).

**Where the branch comes from.**

- A console Fabric holds: its folder is known (`TerminalSession.cwd`, `apps/desktop/src/shared/types.ts`), and the
  existing repository reader returns the branch (`apps/desktop/src/main/repoState.ts#createRepoStateReader`, M56). New:
  a bounded read per live console, cached for the reading's 15 s.
- A coding agent that joined from a terminal: Fabric deliberately keeps only a digest of its folder
  (`session.enrolled@1`, `supabase/migrations/20261011000090_session_enrollment.sql`), and the turn hook carries
  "no path, no branch" (`fabric_session_observe`, `apps/desktop/src/main/workTools.ts#registerWorkTools`). New: an
  optional `branch` on the turn, sent by the adapter's hook. 0.3.14 promises no new protocol, so this is 0.3.15; until
  then such a row says «ветка неизвестна» (open choice 3).

**Removed.** The rail's places list (Агенты becomes the toggle; Главная the brand), the graph button on each row (the
project page's «Связи» stays the way to the graph), the favourites-first ordering.

## 2. The centre of the home

**Today.** `apps/desktop/src/renderer/src/EstateHome.tsx#EstateHome`: the greeting with `HomeRhythm` (28-day events
sparkline, `apps/desktop/src/renderer/src/launch/HomeParts.tsx#HomeRhythm`) and `HomeStats` (four counts:
agents working, tasks in work, waiting, on review; `apps/desktop/src/renderer/src/launch/HomeWork.tsx#HomeStats`);
then «Нужны вы» (`HomeParts.tsx#HomeBoard`), «Где остановились», the board's waiting requests
(`launch/HomeBoardWaiting.tsx`), «Кто что делает» in two lanes, the projects table, «Ещё» with the profile and the
journal feed; in the side column «Агенты в работе» (`HomeWork.tsx#HomeAgents`) and the live feed (`HomeParts.tsx#HomeLive`).

### 2a. «Ритм работы», the statistics strip

**Amended 2026-10-26, the operator's review of the mockup** (verbatim, in this repository's session): «мокап топчик, но
фотку агента сео и вот того персонажа и статистику активности график нужно вренуть ввер а так идея топ, еще давай
прорабоатем получе но мне нраивтся направление». So the top of the home keeps, in this order: the CEO's face and
character with the greeting and «Мой облик» (`apps/desktop/src/renderer/src/launch/FabricAvatar.tsx#FabricAvatar`,
the greeting in `EstateHome.tsx#EstateHome`); the activity chart as it is today, the journal's events a day over 28
days (`HomeParts.tsx#HomeRhythm`), not replaced by tasks handed in a day; then the six numbers below. The paragraph
about the sparkline's new meaning further down is withdrawn by this note; the six numbers stand.


One line of six numbers under the face, the greeting and the activity chart. Each number opens where it is counted.

| Number | Label | Source in Fabric | Exists today |
|---|---|---|---|
| agents at work now | «Агентов работает» | `HomeView.live` without `stale` (`homeLive.ts#composeHome`) | yes, `HomeStats` |
| tasks handed in today | «Сдано сегодня» | `task.moved@1` with `to: review` and `task.closed@1` since local midnight, the same events `apps/desktop/src/shared/projectAnalytics.ts#projectAnalytics` counts per project | new: an estate count over today's events |
| waiting for the person | «Ждут вас» | the person's count already shown in the greeting (questions, access requests, refusals, plus `comms.waiting`) | yes |
| on review, with the old part | «На проверке · N дольше 3 дней» | `HomeView.review` and each `ReviewItem.since` | count yes; the "older than 3 days" split new (the 0.3.14 audit found 71 of 115) |
| abandoned | «Брошено» | `HomeView.abandoned` (0.3.14) | yes, as a lane link; new as a number |
| working without a task | «Без задачи» | the sweep's `work-unclaimed` finding (`apps/desktop/src/shared/abandonedSweep.ts#findAbandoned`): sessions that changed files with no claim | new for the person (today `AGENT_ONLY_KINDS` keeps it for agents) |

The sparkline changes meaning from "events a day" to **tasks handed in a day** over 14 days, which says whether the
work moves rather than whether the journal is noisy; days that could not be read stay hatched, as today. A number whose
read failed shows the unknown placeholder `HomeStats` uses, with the reason on hover, as today.

### 2b. «В работе», grouped by project

The main block. One card per project that has an agent at work or a task in work, ordered by the newest sign of life.

1. **The project's head:** its name (opens the project page), one line on what it is (the project profile's `summary`,
   `project.profiled@1`; when none, «Описание не записано» with «Познакомиться с проектом», which exists on SCR-86),
   and the counts «2 агента · 3 в работе · 1 ждёт вас».
2. **One row per agent at work in it:** runner, branch (part 1), state dot and how long since its last sign; its
   **current task** in plain words (`LiveAgent.task`, 0.3.14's rule), opening the task page; its **last report**: the
   newest stage report's text with «шаг N из M» and its time (`LiveAgent.doing`, `StageRow`), else «Ещё не сказал, что
   делает». The row opens the agent screen.
3. **Tasks in work with no agent row** in the project (a claim whose session is quiet) show as one muted line under the
   agents, «Задача без агента: …»; abandoned work is not here, it is counted in the strip.
4. **Projects with nothing at work** fold into one line under the cards: «Тихо: Copylot, Mobile Publisher и ещё 4»,
   each name a link.

Data: everything is in `work.home` (`HomeView.live`, `inWork`, `abandoned`), grouped by `projectId` in the renderer; the
summary is one extra field per project in the same read. No new IPC.

**Removed from the home:** «Где остановились» (the left column and «В работе» answer it), «Кто что делает» with its two
lanes «В работе» and «Закончили» (replaced by 2b; finished work lives on the agent screen and the project page),
«Агенты в работе» (folded into 2b), the projects table (the left column), «Ещё» with the profile and the journal feed
(see part 4), the live feed `HomeLive`.

## 3. An agent's screen

**Today.** Агенты (`apps/desktop/src/renderer/src/launch/AgentsScreen.tsx#AgentsScreen`): the chosen agent in the centre
with two tabs, «Работа» and «Консоль»; the roster grouped by state on the right (`agentRoster.ts#composeRoster`). «Работа»
is `AgentPage`: the task, what it does, «Задачи» (0.3.14), results, the history closed by default. «Консоль» mounts
the live `SessionWindow` as soon as the tab is chosen.

**Changes.** The screen is reached from the agents toggle, a «В работе» row, or a Board card's «Сессия …» (0.3.14 route
`{kind: 'agents', session}`). Two columns.

1. **Header:** the runner and session («Claude Code · сессия 3f9a21c0»), the project (a link), the branch, a state chip
   (работает / молчит 12 мин / сессия закончилась), and the buttons «Открыть задачу» and «Открыть проект».
2. **«Сейчас»**, at the top: the current task in plain words with its brief's «Что должно произойти», the newest stage
   report with «шаг N из M», how long it has held the task, and the milestones of this task so far (its stage reports,
   oldest at the bottom). This is what the agent does, said by the agent, with times.
3. **«Задачи»**, below it, scrolling down, newest first: 0.3.14's list (`work.session`). Each row: the task in plain
   words, its project when it is not this one, its ending («сдана на проверку», «отпущена», «передана», «держит
   сейчас»), when, and how many times taken. A row expands in place to:
   - the brief (what, why, expected), as 0.3.14;
   - **«Чем закончил»**: the release's `note` (`work.released@1` carries it; written by `fabric_work_release`) and any
     named result handed on (`fabric_task_handoff`). New in the view, data present;
   - **«Вехи»**: the stage reports that named this task (`StageRow.task_id`), each with its step and time. New in the
     view, data present;
   - «Открыть задачу».
4. The session's raw history (`describeEvent` rows) stays at the foot, closed, as 0.3.14 ships it.

**The right column: the session card.**

- What is observed: «Работает · последний знак 40 с назад», or «Молчит 12 мин», or «Сессия закончилась 18:40»; the
  heartbeat's phase when it sent one («ждёт: вопрос»), labelled as the agent's own claim.
- Where the session is: «в Fabric» (a console Fabric holds), «в терминале вне Fabric», or «в Fabric Dashboards» (from
  Switchboard's sessions, CO-457, 0.3.15).
- **«Открыть сессию»**, the column's one primary button. For a console Fabric holds it opens that console as a tab in
  the top bar (`ConsoleTabs`, the existing `onAsTab`), never before the press. For a session elsewhere the button says
  where it is and opens it there when Fabric can (Dashboards' `open_link`), else explains why it cannot.
- «Отключить» for an agent that joined from a terminal, as today on «Работа».
- The agent's open questions to the person, if any (the same cards as the home's right column, filtered to its session).

**Removed.** The «Работа» / «Консоль» tabs (the console no longer mounts on selection); the state-grouped roster on the
right of Агенты (the left column's agents view replaces it for working agents, Настройки for the rest); «Результаты»
as a separate list of event types (the task rows' «Чем закончил» says it in words).

## 4. The right column of the home: only what needs the person

Keeps: «Нужны вы» (`HomeBoard`: questions with their options as buttons, access requests, refusals) and below it the
board requests no agent can answer (`HomeBoardWaiting`). When nothing waits it says «Ничего не ждёт вашего решения»
and the column stays narrow.

Where every other place goes:

| Place today | Decision | Where |
|---|---|---|
| «Нужны вы» | keep | home, right column |
| board requests nobody answers (`HomeBoardWaiting`) | keep | home, right column, under «Нужны вы» |
| «Где остановились» | remove | answered by the left column and «В работе» |
| «Кто что делает» (two lanes) | remove | «В работе» grouped by project; finished work on agent and project pages |
| «Агенты в работе» box | fold | into «В работе» |
| live feed (`HomeLive`), journal feed in «Ещё» | move | История (SCR-88, «Что делали агенты» already shows it) |
| profile («Мой облик») in «Ещё» | move | Настройки → Ещё (already there as «Мой облик») |
| projects table | remove | left column, project page |
| Board (SCR-41) | keep, off the rail | reached from the strip («На проверке», «Брошено») and the project page's «Доска» |
| Переписка (Comms) | keep behind «Ещё» | Настройки → Ещё (already) |
| Граф проектов | keep, off the rail | the project page's «Связи» |
| Агенты place, its roster | replace | the left column's agents view and the agent screen; idle and installed agents in Настройки |
| Plan, Pulse, Releases, Where work is, Help, Persona | hide behind «Ещё» | Настройки → Ещё; those already superseded stay retired |
| Настройки | keep | the left column's foot |

## 5. Work that needs another project

A task in project A (the task page, `apps/desktop/src/renderer/src/TaskPage.tsx`) needs a change in project B (a fix in
Dashboards, in the mail service). The task page gains one action, «Нужна правка в другом проекте», which asks for B and
one sentence of what is needed, then offers two buttons:

1. **«Открыть консоль в B».** Starts a coding agent console in B's folder with a first instruction composed from the
   sentence and a link back to A's task. Exists: `terminal.open(projectId, optionId, firstInstruction)`
   (`apps/desktop/src/shared/types.ts`, the `terminal` API), the launch menu with the fallback order (ADR-0125), the
   console tab. New: only the button and the composed instruction.
2. **«Поручить агенту B в Fabric».** Records the ask on the board as a request from A to B and files it as **B's task**,
   linked to A's task. B's agents meet it in `fabric_whoami`'s `waiting` (0.3.14) and in B's «Очередь»; one claims it
   with `fabric_work_claim`; when it releases done, Fabric answers the request on its thread, and A's task shows «B
   сделал: …». If B has no agent at work, the confirmation offers «Запустить агента в B на этой задаче»
   (`tasks.startExisting`, exists).
   - Exists: `com.submit` for agents (`apps/desktop/src/main/boardTools.ts`), `fabric_task_create` and `fabric_task_link`
     for agents, `tasks.fileIdea(projectId, text)` and `tasks.startExisting(taskId)` in the window, `fabric_whoami`'s
     `waiting`.
   - New: the window cannot submit to the board today (the `comms` API is read-only), so the operator's submit through
     the operator's door; the projection of a request addressed to B into a task in B's backlog with the request as its
     source; the done release answering the request; A's task showing the linked task's state.

Both buttons leave a record in A's task: «Консоль открыта в B, 18:42» or «Поручено B: задача …».

## Removed overall, in one list

The rail's four places as a list; «Где остановились»; «Кто что делает» and its lanes; the projects table on the home;
«Агенты в работе» as a box; the live feed and the journal on the home; the agent page's «Консоль» tab and its eager
mount; the Агенты roster grouped by state; «Результаты» as event types. Nothing here deletes data or a read: each read
that fed a removed place still feeds История, the project page or the agent screen.

## Open choices for the operator

1. **Stars in the project list.** Default: strictly alphabetical, the star kept as a mark only. Alternative: favourites
   first, then alphabetical.
2. **What «Поручить агенту B» records.** Default: a board request projected into a task in B (one record per side,
   answered on done). Alternative, smaller: only a task filed in B's backlog with a link to A's task (`tasks.fileIdea`,
   no board thread).
3. **The branch of an agent that joined from a terminal.** Default: an optional `branch` on the turn hook in 0.3.15,
   «ветка неизвестна» until then. Alternative: show a branch only for consoles Fabric holds.
4. **The Агенты place.** Default: removed; the toggle and the agent screen replace it, and idle or installed agents move
   to Настройки. Alternative: keep it as a full list of every agent, reached from the toggle's «Все агенты».

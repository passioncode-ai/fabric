# Simple Fabric, v2: the detailed design after the operator's second review

**Status:** partly built in 0.3.14 · 2026-10-26 · follows [v1](2026-10-26-simple-fabric.md) and its
[mockup](../reports/2026-10-26-simple-fabric/mockup.html) · release plans
[0.3.14](../evidence/plans/2026-10-26-release-0314-plan.md) (P-28) and 0.3.15 (P-29, target 2026-11-05).

**Settled 2026-10-26.** 0.3.14 built R-1 to R-7, R-12 and R-19 from this design
([plan §Built: the simple Fabric](../evidence/plans/2026-10-26-release-0314-plan.md#built-the-simple-fabric-wave-4));
R-24 was relayed by fabric-workspace (its `fbb79343`) and R-26, the move to Colima, is fabric-workspace's window. The
rest, R-8 to R-11, R-13 to R-18 and R-20 to R-22, with «Вопросов к вам нет» (R-11's first group, which §6 below had
put in 0.3.14), is 0.3.15 (P-29, 2026-11-05). The organization slice is named by its date, 2026-11-21 (P-27), never
renumbered again, not «0.3.16» as §6, §8 and §9 below proposed. Where §4.2 described how a split is linked, the
mechanism 0.3.14 ships is the one that section now states. Two rows of the proposal shipped narrower after the
release review's iteration 2: §4.5's «waiting» is said only for a wait Fabric observed (a fresh heartbeat), and a
Fabric console silent for a minute is «Простаивает» (DA-5, `f1799a2a`); §4.9's lanes gained «Все» first, «Брошено»
and «Не найдены» (UX-14, UX-20, DA-4, `13b00fd9`).

What follows was the proposal for the operator to accept or correct, kept as written apart from §4.2 and §8's
announcement. Like v1 it changed no scenario: the scenarios it touches
(SCN-140, SCN-158, SCN-166, SCN-172, SCN-173, SCN-174) are amended in the same change that builds each part
(super-ux: scenarios first). Every Russian string below is a proposal; each is checked with Copylot (`copylot_check`,
register `ui`, the project's voice) in the change that ships it.

## 0. The operator's words

The operator, 2026-10-26, a voice dictation relayed to this design session, verbatim:

> Касаемо качества информации на дашборде, сейчас оно, вот фабрик, допустим, в работе, фабрик, рабочее место для
> агентов, то есть описание. Мне нужно, типа, не описание проекта, а мне нужно описание, чтобы конкретно, типа, что мы
> там делаем, в чём заключается наш, типа, этот, если... или вообще, типа, лучше сократить, просто, типа, как проект,
> типа, как фабрик. Хотя описание тоже гуд, мы будем различать, нехорошо. Дальше вот код-код агенты внутри, и там вот
> исправление после первого ревью. Но типа я вообще не в курсе, это какая-то более уже локальная задача
> декомпозированная, мне интересует более high value, какая задача конкретно была, цель, то есть какая у него
> изначально операторская. Типа и все, а вот это, это уже меняется, это динамическая, то есть это типа текущий шаг,
> типа как прогресс. Вот. Дальше, под этим дашбордом, дальше проекты все good, агенты все good. Когда переходим в
> агента, супер, стало получше, давай еще поработаем. То есть задачи сразу же открыть сессию, допустим, открываю, да,
> хорошо вижу типа агенты. Ммм. Кстати, давай вот в списке агентов слева, когда я открываю каких-то разных агентов.
> чтобы я нажимал, когда он открывался «Агентов», А также добавим рядом еще иконочку типа такой консольки, если я
> нажимаю на иконочку, у меня сразу же открывается вся сеть с консолью. А также навигация, вот назад, вперед, вот эти
> кнопки, там на главную, она должна быть на всех экранах, чтобы можно было качественно пользоваться этим интерфейсом.
> Вот, дальше задачи какие есть у кладкода, вот какие задачи, да, я открываю агента, он есть, плюс мне нужно понимать,
> какой агент, какую функцию выполняет, есть еще, знаешь, функции агента, он типа кодер, он наблюдатель, он следит за
> агентом фабрика, то есть он как кодер, агент запущенный в агенте фабрики для того, чтобы принимать задачи с доски,
> или он просто туда зашел, нужно идти тоже здесь, чтобы мы видели, разделять и у них внутри дашборда, чтобы эта
> информация была, и мы могли корректно пользоваться. А потом типа запросы от других агентов хочется видеть. Типа вот
> там, где сессия, вот сбоку вопросы. этого агента. Вопросов к вам нету, А вот еще есть вопросы к этому агенту, к
> другим агентам. Это можно, то есть у этого агента есть задача текущая, потом есть задачи, которые он уже делал. Ум.
> Вот тут вот передано, на проверке, в работе, то есть тут супер. Также еще должны быть задачи, которые предлагают ему
> взять другие агенты, они здесь в очереди, они тоже берутся в работу. Короче, здесь проверить, ну, в целом, мне уже
> намного больше нравится, чем было. Давай дорабатывать это дальше, прорабатывать детальнее, продумывай, какие
> юзкейсы. Вот еще все должно быть максимально просто, нативно, но в то же время информативно. Я зашел, понял, где мы
> что делаем, какие вопросы. если есть какие-то горячие вопросы, решаем. Какие-то экраны с уведомлениями еще не
> хватает. Хочется немножко экрана с уведомлениями. чтобы можно было Вот, кстати, классная идея сделать типа сверху,
> открывать типа вкладки, то есть слева проекты мы будем открывать, слева будут проекты и агенты, а когда мы
> открываем какую-то сессию, она открывается сверху у нас как вкладки браузера, и с разных агентов я эти сессии могу
> открывать, они у меня сверху вот как вкладки браузера здесь вот открываются в нашей типа дашборде. Было бы так
> здорово, было бы удобно между ними, потом быстро тоже между этими сессиями перескакивать. А также у каждой сессии
> должен быть статус отображаться, там зелененький, красненький, желтенький, также типа ожидания, идол, типа
> мониторинг какой-то. И статус, когда сессия является активной сессией, принимающей задачи с доски для какого-то
> проекта или агента. Если есть несколько таких сессий на проекте, то одна из них основная, а все остальные просто
> работают. Рак-то еще туда дальше надо передать. Вот это все разбери на смыслы, детально зафиксируй, продумай,
> проработай, в документации запиши, проработай структуру, хритектуру, связи между другими разными экосистемными
> проектами. Всем агентам пешин-кода передай, что надо делать, и давай делай, мы выкатим уже наконец. Также уйдем от
> нашего типа уже наконец-то арпстека, перейдем наконец на ту ту, которую мы там делали раньше, чтобы облегчить вообще
> работу. раскатились как бы все и все работает и эффективной использовать память.

Readings of dictation slips, stated so they can be corrected: «код-код агенты» is Claude Code agents; «вся сеть с
консолью» is «сессия с консолью» (the session's console); «кладкод» is Claude Code; «пешин-кода» is PassionCode;
«арпстека» is OrbStack, and «ту, которую мы там делали раньше» is the move to Colima; «Рак-то ещё туда дальше надо
передать» is read as «как-то ещё туда дальше надо передать», that the primary role must be passable to another
session (R-22). «Вопросов к вам нету» is read as the empty state the operator expects to see.

### What the operator saw

The mockup's card for Fabric read «Рабочее место для агентов: проекты, задачи и сессии на этом компьютере.» (the
project profile's `summary`, `apps/desktop/src/renderer/src/launch/HomeInWork.tsx#Card`), and its agent row's task read
«Исправления после первого ревью 0.3.14» with «шаг 4 из 6» (`HomeInWork.tsx#AgentRow`: `LiveAgent.task.summary` and
`LiveAgent.doing`). The operator's two objections are to exactly those two lines.

## 1. The meanings

Each distinct want, as one requirement, with the phrase it comes from.

| Id | Requirement | From |
|---|---|---|
| R-1 | A project's card on the home says what is being done in it now (the work's current aim), not what the project is in general. | «не описание проекта, а ... что мы там делаем» |
| R-2 | When no current aim is known, the card shows only the project's name; the general description stays available elsewhere (the project page, a hover) and is never mistaken for the aim. | «или вообще лучше сократить, просто как проект»; «описание тоже гуд, мы будем различать» |
| R-3 | An agent's row and screen lead with its high-value task: the operator's original goal, the root of the work it is doing. | «мне интересует более high value, какая задача конкретно была, цель ... изначально операторская» |
| R-4 | The agent's current decomposed step is shown under the goal as progress (step N of M, what it does now), visibly secondary and changing. | «это уже меняется, это динамическая, ... текущий шаг, как прогресс» |
| R-5 | A press on an agent in the left list opens that agent's screen. | «в списке агентов слева ... чтобы я нажимал, когда он открывался» |
| R-6 | Beside each agent in the left list, a console icon opens its session's console directly, in one press. | «иконочку типа такой консольки, ... сразу же открывается ... с консолью» |
| R-7 | Back, forward and home are visible controls on every screen. | «назад, вперед, ... на главную, она должна быть на всех экранах» |
| R-8 | Every agent shows its function: coder, observer, monitor, board responder (launched to take the board's tasks), or a session that only joined. | «какой агент, какую функцию выполняет ... кодер, наблюдатель, ... принимать задачи с доски, или он просто туда зашел» |
| R-9 | The function is distinguishable everywhere the agent appears (left list, home, agent screen, tabs), so the person can use each correctly. | «разделять и у них внутри дашборда, чтобы эта информация была» |
| R-10 | Beside an agent's session, the requests other agents (other projects) sent to it are listed. | «запросы от других агентов хочется видеть. ... там, где сессия, вот сбоку» |
| R-11 | Beside the session, its questions are split three ways: to you (the person), to this agent, and from it to other agents; each empty part says so («Вопросов к вам нет»). | «вопросы этого агента. Вопросов к вам нету, ... вопросы к этому агенту, к другим агентам» |
| R-12 | An agent's screen keeps its current task and the tasks it already did, with their states: in work, in review, handed over. | «задача текущая, потом есть задачи, которые он уже делал. ... передано, на проверке, в работе, ... супер» |
| R-13 | An agent's screen shows a queue of tasks other agents propose it take, each takeable into work from there. | «задачи, которые предлагают ему взять другие агенты, они здесь в очереди, они тоже берутся в работу» |
| R-14 | Every screen is simple and native-looking yet informative: on entering, the person knows where work happens, what is being done and what is asked. | «максимально просто, нативно, но в то же время информативно. Я зашел, понял, где мы что делаем, какие вопросы» |
| R-15 | A hot question is answerable where it appears, without a detour. | «если есть какие-то горячие вопросы, решаем» |
| R-16 | A notifications screen lists what Fabric told or would tell the person, read and unread. | «экраны с уведомлениями еще не хватает» |
| R-17 | Sessions open as browser-like tabs along the top, from any agent; the left column stays projects and agents. | «слева будут проекты и агенты, а когда мы открываем какую-то сессию, она открывается сверху ... как вкладки браузера» |
| R-18 | Switching between open session tabs is quick (one press, a keyboard shortcut). | «быстро тоже между этими сессиями перескакивать» |
| R-19 | Every session shows a status colour with a word: working (green), waiting (yellow), error (red), idle (grey), monitoring (blue). | «зелененький, красненький, желтенький, также типа ожидания, идол, типа мониторинг» |
| R-20 | A session that takes a project's board tasks is marked as that project's responder. | «статус, когда сессия является активной сессией, принимающей задачи с доски» |
| R-21 | When several sessions work in one project, one is the primary responder and the others are marked as just working. | «одна из них основная, а все остальные просто работают» |
| R-22 | The primary role passes on: to another session when the primary ends, and by the person's choice. | «как-то ещё туда дальше надо передать» (read) |
| R-23 | This design, its structure, architecture and relations to the ecosystem's projects are written down. | «в документации запиши, проработай структуру, архитектуру, связи» |
| R-24 | Every PassionCode agent is told what to do (through the board, by the lead). | «Всем агентам PassionCode передай, что надо делать» |
| R-25 | It ships now: a release, not only a design. | «давай делай, мы выкатим уже наконец» |
| R-26 | This Mac moves its containers from OrbStack to Colima, to use memory efficiently. | «уйдем от ... OrbStack, перейдем на ту, которую мы делали раньше, ... эффективней использовать память» |

Vision check: aligned. R-1 to R-4 make the Project and its operator goal the operating unit on screen (alignment test
point 1); R-8, R-20 and R-21 name an agent's function as observed, so a runner stays replaceable (point 2); R-10, R-11
and R-13 keep cross-project work an explicit, recorded request (point 3). The anti-vision's first line, the multi-chat
cockpit, is the risk in R-17 and R-18; it is held by four rules: the home shows no console; a tab opens only on the
person's press; the first, pinned place is the projects overview, never a grid of terminals; and a tab shows its
project and goal, so a session is always read as a project's worker.

## 2. Use cases

Each walk names the screens of §3. «›» is one press.

**UC-1. The morning open.** The person opens Fabric. Home (§3.1): the face and greeting, the activity chart, the six
numbers; «В работе» lists three project cards, each led by its current aim (R-1), e.g. «Fabric: выпуск 0.3.14 к 29
октября»; under it two agent rows, each with its goal (R-3) and «шаг 4 из 6 · проверяю страницу агента» (R-4) and a
coloured status (R-19). The right column «Нужны вы» holds two questions. The bell in the top bar shows «3». In ten
seconds the person knows where work happens and what is asked (R-14).

**UC-2. A hot question.** In «Нужны вы» a card reads «Copylot · Кодер спрашивает: выпускать 1.4 с неполным переводом
на польский?» with its options as buttons. The person presses «Выпускать без польского» (R-15). The card leaves; the
agent's yellow dot turns green within one reading, because its heartbeat phase leaves `waiting`. Nothing else opened.

**UC-3. Following one agent.** Left list › Агенты › «Claude Code · Fabric · release/0.3.14» (R-5). Agent screen
(§3.3): header with role «Кодер» (R-8), status «Работает» green. «Цель»: «Выпустить Fabric 0.3.14, экстренный выпуск
агентов и синхронизации» (the root task, R-3); «Сейчас»: «Исправления после первого ревью 0.3.14», «шаг 4 из 6» and a
progress bar (R-4). Below, «Задачи» in three lanes, «В работе», «На проверке», «Передано» (R-12), and «Предлагают
взять» (R-13). Right: the session card and the three question groups (R-11).

**UC-4. Three sessions in tabs.** From UC-3 the person presses «Открыть сессию»: a tab «Fabric · Claude Code» opens
along the top with a green dot (R-17). Back › home (R-7), then in the left list the console icon beside «Codex ·
Copylot» (R-6): a second tab opens with a yellow dot. A third from the project page of Mobile Publisher. ⌘2, ⌘3, ⌘4
switch among them; ⌃Tab cycles (R-18). The pinned first tab «Обзор» returns to wherever the person last was among the
pages. Closing a tab (×) leaves its session running (ADR-0031 §2, as `ConsoleTabs` says today).

**UC-5. A session not held by Fabric.** The left list shows «Claude Code · webpilot · main» joined from a terminal,
role «Зашёл». Its console icon is drawn as a terminal outside Fabric. A press opens a tab whose body is that agent's
screen with the card «Сессия идёт в терминале вне Fabric» and, once Switchboard and Dashboards serve it (CO-457), «Открыть
в Fabric Dashboards». No terminal is drawn that Fabric does not hold (R-17's limit, open choice 4).

**UC-6. A task for another project's agent.** On a Fabric task the person presses «Нужна правка в другом проекте»,
picks fabric-dashboards and writes «Сессии должны показывать статус цветом, как в Fabric». «Поручить агенту в Fabric
Dashboards» records a board request from Fabric to fabric-dashboards (v1 §5). In fabric-dashboards' primary responder
session (R-21) it appears in «Запросы от других проектов» (R-10) and in that agent's «Предлагают взять» (R-13); the
Fabric task shows «Поручено fabric-dashboards · в очереди», later «взято», later «сделано: …».

**UC-7. Taking a proposed task.** On Copylot's coder screen «Предлагают взять» holds «Проверить тексты 0.3.14 (от
Fabric)». Two buttons: «Взять в этой сессии», which delivers it to the session as a nudge on its next turn (no typing
into a terminal), and «Запустить новую сессию на ней», which starts a console on that task (`tasks.startExisting`). The
row moves to «В работе» when the agent claims it.

**UC-8. The primary responder dies.** Project fabric-dashboards has two sessions; A is «Дежурный · основная», B
«Кодер · просто работает». A's process ends. Its board slot lease lapses within 60 s (`board_lease_until`, migration
104); A's tab turns grey «Закончилась» and its row shows «Основной больше нет: доска проекта ждёт дежурного». The
next session that enrolls takes the slot (`com.enroll` replaces a lapsed holder) and becomes «основная» (R-22). The
person can press «Сделать основной» on B, which asks B to take the slot (later: an operator door to
`com.responder_replace`, §4.6).

**UC-9. The notifications screen.** The person was away overnight. The bell reads «7». «Уведомления» (§3.5) lists,
newest first: «Fabric · задача сдана на проверку · 03:12», «Copylot спрашивает · 04:40», «Сессия Codex упёрлась в
лимит · 05:33», each with «Открыть» and, for a question, its answer buttons (R-15). «Только непрочитанные» filters.
A macOS notification's click lands here on its own row, not on a bare focused window as today.

**UC-10. A red session.** A tab turns red, «Ошибка: процесс завершился с кодом 1» (a console Fabric holds, its
`exitCode`) or «Упёрся в лимит аккаунта до 06:10» (Switchboard's recovery read, later). The agent screen's session card
says what is observed and offers «Перезапустить в этой папке» for a Fabric console, or Switchboard's account choice
for a limit stop.

**UC-11. Three sessions in one project, told apart.** The project page of Fabric lists «Кодер · release/0.3.14 ·
работает», «Наблюдатель · main · читает доску», «Монитор · расписание каждые 30 мин · ждёт следующего запуска». The
person sees at once which one writes code, which one only reads, and which one runs on a routine (R-8, R-9), and which
one, if any, is «основная» (R-21).

**UC-12. Back and forward across pages.** Home › a project › its agent › a task › ‹ › ‹ returns to the project at the
scroll where the person left it (CO-388's restore), › goes forward again, ⌂ goes home. The same three buttons are on
every screen, a session tab included (R-7).

## 3. Structure

### 3.0 The frame

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ‹  ›  ⌂ │ [Обзор] [● Fabric · Claude Code ×] [● Copylot · Codex ×] …     🔔 3          │ top bar
├───────────────┬──────────────────────────────────────────────┬───────────────────────┤
│ Fabric        │                                              │                       │
│ ＋ Создать    │            the page (§3.1 to §3.6)           │   the right panel     │
│ [Проекты|Аг.] │                                              │   (what needs you,    │
│ list          │                                              │    the session card)  │
│ …             │                                              │                       │
│ История       │                                              │                       │
│ Настройки     │                                              │                       │
└───────────────┴──────────────────────────────────────────────┴───────────────────────┘
```

**The top bar** (R-7, R-16, R-17, R-18). Left: «Назад» ‹ (⌘[), «Вперёд» › (⌘]), «Главная» ⌂; each disabled, not
hidden, when it has nowhere to go, so the bar never shifts. Then the tabs: a pinned «Обзор» (the pages: home, project,
agent, task, notifications, settings), then one tab per opened session, each a status dot (§4.5), project, runner, and
on hover its goal and role. Right: the bell «Уведомления» with the unread count. ⌘1 is «Обзор», ⌘2 to ⌘9 the session
tabs in order, ⌃Tab and ⌃⇧Tab cycle (to be checked against Fabric's and the terminal's own shortcuts on build; a
console that has focus keeps its keys except these). History (‹ ›) is one list across pages and tabs: a travel to a
closed tab is skipped, as `App.tsx` already skips a console whose tab was closed.

**The left column** (R-5, R-6, R-9). The brand (press: home), «＋ Создать», the toggle «Проекты | Агенты» (built in
0.3.14, `7f014ec0`). Проекты: alphabetical, each with its live dot and waiting count. Агенты: every agent at work, one
row each, two lines:

- line 1: status dot (§4.5), runner, project, and on the right the console icon (R-6);
- line 2, muted: role badge (R-8) and branch, e.g. «Кодер · release/0.3.14», «Дежурный · основная · main».

A press on the row opens the agent screen (R-5); a press on the icon opens or focuses its session tab (R-6). The icon
has three forms: a filled console (Fabric holds the console: opens a tab with the terminal), an outlined console with
an arrow (the session runs outside Fabric: opens a tab with its agent screen and where it runs, UC-5), absent with a
tooltip (an agent with no session now). At the foot: «История», «Настройки».

**The right panel**, per page: only what needs the person or belongs beside the session. It narrows when empty.

### 3.1 Main (home)

Top, in this order, as the operator's first review fixed: face and greeting, the activity chart, the six numbers
(`374e21d7`). Then «В работе» by project (`68e1e726`), changed by R-1 to R-4:

- the card's head: the project's name, then **its current aim** (R-1, §4.1) in one line, e.g. «выпуск 0.3.14 к 29
  октября»; when none is known, the name alone (R-2). The description moves to the name's hover and the project page;
  never shown in the card's text line;
- each agent row: status dot, runner, role badge, branch; then **«Цель:»** the goal (R-3) in the row's main type; then
  the step line, muted and smaller: a thin progress bar when the agent gave step and of_steps, «шаг 4 из 6 · проверяю
  страницу агента» (R-4); the current subtask's title appears in this line only when it differs from the goal;
- the quiet projects in one line, as built.

Right panel: «Нужны вы» (questions with their options as buttons, access requests, refusals) and the board requests
nobody can answer; each answerable in place (R-15). Empty: «Ничего не ждёт вашего решения».

### 3.2 Project

Head: name, current aim (R-1), and the description in a quieter line under it (R-2: here both are shown, labelled
«Сейчас» and «О проекте»). Then «Кто работает» (R-21): every session in the project with dot, role, branch, goal, the
primary marked «основная», the rest «просто работает», and «На доске никто не дежурит» when no slot is held. Then the
project's tasks by lane and «Очередь проекта» (backlog plus queued board requests). Right panel: the project's
questions to the person, the board requests to it and from it.

### 3.3 Agent

Header: runner, «сессия 3f9a21c0», project link, branch, role badge with «основная» when it holds the slot, status
chip with its word. Buttons: «Открыть сессию» (primary), «Открыть проект».

Body, top to bottom:

1. **«Цель»** (R-3): the root task's title and «Что должно произойти», who set it («поставили вы 25 октября», from the
   root's origin), «Открыть цель».
2. **«Сейчас»** (R-4): the current task when it differs from the goal, the newest stage report with the progress bar
   and «шаг N из M», how long it has held it, its milestones so far (v1 §3).
3. **«Задачи»** (R-12), three lanes as tabs in one list: «В работе», «На проверке», «Передано» (each with its count),
   then «Готово» paged; a row expands to brief, «Чем закончил», «Вехи» (v1 §3).
4. **«Предлагают взять»** (R-13): tasks and board requests other agents put to its project and not yet taken, each
   with who proposed it and «Взять в этой сессии» or «Запустить новую сессию на ней» (UC-7).
5. The raw history, closed (as 0.3.14).

Right panel, beside the session (R-10, R-11): the **session card** (what is observed, where it runs, «Открыть сессию»,
«Отключить» for a joined agent), then **«Вопросы»** in three groups: «К вам» (its open questions to the person, with
answer buttons; empty: «Вопросов к вам нет»), «К этому агенту» (board requests addressed to its project that this
session holds or that wait for its project), «От него другим» (requests its session sent, with their states). Then
**«Запросы от других проектов»** when its project is the target and nobody took them.

### 3.4 Task

As SCN-174 today, plus: the goal it serves (its root, R-3) as a breadcrumb «Цель › … › эта задача»; who holds it with
role and status; the cross-project actions of v1 §5.

### 3.5 Notifications (R-16)

One list, newest first, grouped by day. Each row: what, project, when, «Открыть», and inline answers for a question.
Filters: «Все», «Непрочитанные», «Вопросы», «Сдано», «Ошибки». «Отметить всё прочитанным». Rows that resolved stay
listed, struck as «решено 09:14», so the person sees what happened while away. An OS notification's click opens this
screen on its row.

### 3.6 Settings

Unchanged from 0.3.13, plus «Уведомления» settings (which kinds also ring the system, quiet hours) and the idle and
installed agents (v1 §1.4).

## 4. Data and architecture

The rule this section keeps: no new wire protocol in 0.3.14 (fabric-workspace's condition: reminders and abandoned
work stay on DEC-0126 and `work.swept@1`). What needs one is named with its owner and goes to 0.3.15 or later.

### 4.1 The project's current aim (R-1, R-2)

| Source | Exists | Notes |
|---|---|---|
| The goals (§4.2) of the project's running tasks, most recent first | data yes (`project_tasks`, `task_links`), composition new | the primary choice: «what we are doing there» is literally the root of the work in progress |
| `projects.plan->next[0]` (`project.profiled@1`, `supabase/migrations/20261023000123_project_profile.sql`) | yes, sparse | when nothing runs: the next planned step, labelled «Дальше:» |
| `projects.goal` | yes, sparse | the project's standing aim, used only on the project page («О проекте»), never as the card line |
| `projects.summary` | yes, read by `apps/desktop/src/shared/homeProjects.ts#groupInWork` | the description; moves to the hover and the project page (R-2) |

Change: `InWorkCard` gains `aim: { text, from: 'goal' | 'plan' } | null`, composed in the renderer from the same
`work.home` read plus the root titles of §4.2; `summary` stays for the hover. No new IPC beyond §4.2's extra read.

### 4.2 An agent's goal and its step (R-3, R-4)

The goal is the **root of the task's decomposition**. The decomposition already exists in the data:

- `task_links (task_id, rel 'spawned', target_id)` means `task_id` was spawned from `target_id`
  (`supabase/migrations/20260905000016_operating_surfaces.sql`), and
  `apps/desktop/src/main/chainAdvance.ts` reads the same map for a chain's provenance. Fabric writes it itself when
  an agent files a task with `fabric_task_create` (`apps/desktop/src/main/agentSurface.ts`, the `link_tasks` call
  with `p_rel: 'spawned'`), from one parent (`apps/desktop/src/shared/spawnParent.ts#spawnParentOf`): the task Fabric
  launched the session on, else, for a session that joined from its own terminal, enrolled or came through the hub,
  the one task it holds a live claim on in that project. With no such claim, several, or a claims read that failed,
  it links nothing and the answer says why (`spawned_from`, `spawned_from_why`); the agent may then link the piece
  itself with `fabric_task_link {taskId: <piece>, rel: 'spawned', targetTaskId: <parent>}`, whose description states
  that direction. (Corrected 2026-10-26, the 0.3.14 release review, iteration 2, PL-1, DA-1, DO-2: this section first
  said Fabric links a piece whenever an agent working a task creates another, which held only for launched sessions,
  `3648fd30`.)
- `project_tasks.origin_kind` and `origin_ref` say why a task exists (`fabric_task_create`'s origin: observation,
  person, task, document, memory); `origin_kind = 'person'` is the operator's own ask. `assigned_by`, `goal_id`
  (`goals.title`) add to it.

Rule: from the current task (`LiveAgent.task`, `apps/desktop/src/shared/homeLive.ts#composeHome`), walk `spawned` to
the root (bounded at 10 hops, cycle-safe: links are a DAG, `task_links_refuse_cycle`). The goal is the root's title
(else `brief_what`); when the root's `goal_id` is set, the goal's title leads. When the current task is the root, the
goal is the task and the step line shows only the stage report. `origin_kind = 'person'` is said as «поставили вы».

The step is today's `LiveAgent.doing` (the newest `agent_stages` row: `stage`, `step`, `of_steps`, `note`) and, when it
differs from the root, the current task's title.

What is missing:

1. **Agents rarely decompose through Fabric.** The audit of 2026-10-26 found 149 tasks, most without a brief; a
   terminal session's work often has no task at all, and the operator's first prompt in the coding agent is never
   seen by Fabric (hooks carry counts only, `fabric_session_observe`). So the goal is unknown for most sessions today.
   Fix without protocol: a rule in `fabric_whoami` (an ADVICE obligation in
   `apps/desktop/src/shared/protocolObligations.ts`, beside `claim.before-working`): «Claim the person's request as
   one task whose title is that request in one line (origin person); file each piece you split off with
   fabric_task_create while that task is the one task you hold claimed in this project», so Fabric links the piece as
   spawned from it (above). And the same sentence in the adapter's `working-with-fabric` skill (ask, §8). Until agents
   follow it, a task with no link is its own root, so the row shows the current task itself in the goal's place,
   labelled «Цель» only when the person set it (origin person; UX-13, `13b00fd9`); an agent holding no task says
   «Задачи не взял» (UX-12), and «Цель не названа» is left for a row whose goal could not be found.
2. **One extra read** in `readHome` (`apps/desktop/src/main/workRead.ts#readHome`): `task_links` for `rel = 'spawned'`
   among the projects at work, and the root tasks' titles. Bounded like the other reads; capped is named in `capped`.

### 4.3 The left list's open and console icon (R-5, R-6)

Exists: the agents toggle and `onAgent(session)` routing to `{ kind: 'agents', session }` (`App.tsx`,
`LaunchShell` `agents` prop); consoles as tabs (`apps/desktop/src/renderer/src/launch/ConsoleTabs.tsx#ConsoleTabs`,
the `openConsole` context in `apps/desktop/src/renderer/src/consoles.tsx`); a row's `console: boolean` in
`LiveAgent` and `RosterRow`. New: the icon button per row calling `openConsole(sessionId)` when `console` is true, the
external form when not (§3.0). Pure renderer; 0.3.14-sized.

### 4.4 Back, forward, home (R-7)

Exists: a route history of 50 with ⌘[ and ⌘] (`apps/desktop/src/renderer/src/App.tsx`, `travelRef`, `past`, `future`),
scroll restore (CO-388), skipping removed projects and closed consoles. The comment above `LaunchShell` says «No Back
of Fabric's own» (0.3.7 wave 3, SCN-162): R-7 reverses that decision, so the change records it in SCN-162 and SCN-058.
New: three buttons bound to `travelRef.current('back' | 'forward')` and `goTo({ kind: 'home' })`, their disabled state
from `past` and `future` lengths (held in state, not refs, so the buttons re-render). Pure renderer; 0.3.14-sized.

### 4.5 Session status (R-19)

One function, `sessionStatus(...)` in `shared/`, from signals that exist, observed first and claimed second (the
protocol's rule that a report is the agent's claim, `progress.report-stage` in `protocolObligations.ts`):

| Status | Word | Colour | When (first that holds) | Sources |
|---|---|---|---|---|
| error | «Ошибка» | red | a Fabric console ended with a non-zero `exitCode` or a failed `termination`; the agent's heartbeat phase is `blocked`; later: Switchboard reports the session stopped on a limit | `TerminalSession` (`apps/desktop/src/shared/types.ts`), `session_heartbeats.phase` (`supabase/migrations/20260909000040_agent_heartbeat.sql`), Switchboard `recovery` (CO-457) |
| waiting | «Ждёт» | yellow | heartbeat phase `waiting` (with `waiting_kind` question, grant or continuation); an open question from this session to the person; a Fabric console silent for a minute while its task runs (said as «молчит, возможно ждёт», as `agentRoster.ts` already does) | `session_heartbeats`, questions, `TerminalSession.lastActivityAt` |
| working | «Работает» | green | a sign within the stale window and either console output in the last minute or a stage report or turn since | `LiveAgent.lastSignAt`, `stale`, `TerminalSession` |
| monitoring | «Дежурит» | blue | role is responder, monitor or observer (§4.6) and nothing is wrong: on duty with nothing to do is not idle | §4.6 |
| idle | «Простаивает» | grey | signs but holds no task and produced nothing; `TerminalSession.state === 'idle'`; `stale` | `homeLive.ts`, `agentRoster.ts#composeRoster` (`quiet`) |
| ended | «Закончилась» | grey outline | the session ended (console `ended`, `session.ended`) | as today |

Colour never stands alone: a word, and a shape per status for colour-blind reading. Today's roster states
(`AgentState` in `apps/desktop/src/renderer/src/launch/agentRoster.ts`) map into it; it replaces the two-state dot
(`rail-dot live | quiet`) in the left list, the home rows and the tabs.

### 4.6 Roles and the primary responder (R-8, R-9, R-20, R-21, R-22)

A role is **observed** by Fabric from signals that exist, and may later be **declared** by the agent; the two are shown
apart, as every claim is.

| Role | Russian | Observed when | Signals in Fabric today |
|---|---|---|---|
| responder | «Дежурный по доске» | the session holds a live `board_responder_slots` slot (`holder_enrollment` live, `lease_until` ahead) | `supabase/migrations/20261012000104_project_board_responders.sql`, `comms.responder_enrolled@1`; also a board-only session (`surface: 'board'`, `cameIn: 'hub'`, `apps/desktop/src/main/agentSurface.ts#joinBoard`) |
| monitor | «Монитор» | started by a routine on a schedule | a running task's `routineId` (`shared/types.ts`), the routine tick |
| coder | «Кодер» | holds a claim or a Fabric-launched task and its turns change files | `work_claims`, `task.session.attached@1`, `fabric_session_observe` turn counts (`filesChanged`, lines) |
| observer | «Наблюдатель» | signs, reads (board, memory, work list) and changes no files over its turns | turn counts zero; tool calls without effects |
| joined | «Зашёл» | enrolled from a terminal with no claim, stage or file change yet | `session.enrolled@1`, `cameIn: 'enrolled'` (`apps/desktop/src/shared/workClaims.ts#CameIn`) |

`came_in` (launched, enrolled, handed-off, hub) is shown too, as «запущен Fabric», «из терминала», «передан», «через
хаб», since it answers «он просто туда зашёл» directly.

**The primary.** The board already has the operator's idea built in: one responder slot per (project, capability),
one live enrollment per slot, a generation that only grows, a lapsed holder replaced by the next `com.enroll`, a live
one replaced by `com.responder_replace` (migration 104; `apps/desktop/src/main/boardTools.ts`). So «основная» is the
slot holder, and «просто работает» is every other session in the project. Two facts to say plainly:

- The directory read on 2026-10-26 21:09 UTC (`com.directory`, 79 projects) lists **no capability for any project**:
  no session is a responder anywhere today. R-20 and R-21 are therefore a design for a role nobody plays yet; the
  first step is that a project's agents enroll.
- A project may hold several capabilities with different holders. The operator's «основная» is one per project. The
  proposal: a reserved default capability every project's primary enrolls under (e.g. `project.work`), defined by the
  contract (ask, §8); until then Fabric marks the holder of the oldest live slot in the project as «основная» and
  lists the others with their capability.

Handing the role on (R-22): when the holder ends, its lease lapses in 60 s and the slot waits for the next enroll; the
project page says «На доске никто не дежурит» and offers «Назначить основной» on another session, delivered to that
session as a nudge to call `com.enroll` (an agent's act; Fabric never types into a terminal). A direct operator
replacement (the operator's door calling `com.responder_replace`) is new and waits for the contract's word on whether
the operator may move a slot.

**Declared roles** (later): an optional `role` at enrollment (`fabric-mcp` flag, the adapter) and on Fabric's own
launch («Запустить дежурного» in the launch menu, which starts a console whose first instruction is to enroll). New
protocol: the contract and the adapter (§8).

### 4.7 Questions and requests beside the session (R-10, R-11)

| Group | Source | Exists |
|---|---|---|
| «К вам» | the person's questions filtered by the asking session (the attention queue's questions, `apps/desktop/src/shared/attention.ts`) | yes, filter new |
| «К этому агенту» | `board_requests` with `target_project` = its project, queued, or held by an attempt of this session's enrollment (`board_attempts`) | data yes; the operator read exists (`board_threads_operator`, migration 108); per-session filter new |
| «От него другим» | `board_messages` of kind request whose `principal` names this session, with the request's state | data yes, read new |
| «Запросы от других проектов» | `comms.waiting` (`apps/desktop/src/renderer/src/launch/HomeBoardWaiting.tsx`) filtered to its project | yes |

`fabric_whoami`'s `waiting` block (`apps/desktop/src/main/sessionWaiting.ts#readWaiting`) is the agent's half of the
same facts; the window reads the operator's door, never the agent's.

### 4.8 The queue an agent can take from (R-13)

«Предлагают взять» is its project's work nobody holds that another agent put there: backlog tasks whose `origin_kind`
is `task` with a task of another session (or spawned from one), and board requests addressed to the project still
queued. Exists: the backlog (`project_tasks.status = 'backlog'`), `tasks.startExisting(taskId)` for «Запустить новую
сессию на ней», `comms.waiting`. New: «Взять в этой сессии» as an `offered` nudge (`apps/desktop/src/shared/abandonedSweep.ts#nudgeText`
already carries kinds to a session on its turns and `fabric_work_list`); a new nudge kind is additive within the
shape DEC-0126 and 0.3.14 fixed, so it is 0.3.15 and needs the adapter to print it (0.51.2 prints nudges already). The
projection of a board request into a task in the target project is v1 §5's open choice 2.

### 4.9 Lanes (R-12)

Exists: `work.session` (`apps/desktop/src/main/workRead.ts#readSessionTasks`,
`apps/desktop/src/shared/sessionTasks.ts#composeSessionTasks`) with endings «Сдал», «Передал другому агенту»,
«Отпустил»; the Board's lanes (`apps/desktop/src/shared/taskBoard.ts#composeTaskBoard`). New: grouping the agent's list
into the three lanes in the renderer. 0.3.14-sized.

### 4.10 Notifications (R-16)

Exists: the notifier (`apps/desktop/src/main/index.ts`, `decideNotification`, `apps/desktop/src/shared/notify.ts`)
tells the attention queue's items once each; what it told lives in memory (`told`) and is forgotten when an item
leaves. The queue is derived (`apps/desktop/src/shared/attention.ts#attentionOf`, kinds access, refused, review,
abandoned, proposal). Resolutions are in the journal (`resolutionsOf`). A click only focuses the window.

New: a notifications read that lists the queue's live items plus the journal's resolutions and completions of the last
seven days (grants, decisions, `task.moved@1` to review, `work.released@1` done, board answers to the operator); a
read mark kept locally in `userData` (the person's own state, not a projection; no migration); the click routing to
`{ kind: 'notifications', id }`. No new event type. 0.3.15-sized.

### 4.11 Tabs from any agent (R-17, R-18)

Exists: tabs for consoles Fabric holds (SCN-172, `ConsoleTabs`), a detach to a separate window
(`window.fabric.windows.openSession`). New: the pinned «Обзор» tab; a tab kind for a session Fabric does not hold
(the agent screen with its session card, UC-5); the status dot (§4.5) and goal on each tab; ⌘1 to ⌘9 and ⌃Tab. A
session held by Dashboards opens through its `open_link` (`fabric-dashboards://service/...`, never a guessed URL) once
CO-457 lands; Fabric does not draw another product's terminal.

### 4.12 The branch (part of R-9)

Built for consoles Fabric holds (`apps/desktop/src/main/agentBranches.ts`). For a terminal-joined agent the turn hook
carries no branch by contract (`fabric_session_observe`: «no path, no branch»), so it stays «ветка неизвестна» until
the contract allows an optional branch and the adapter sends it (v1 open choice 3; §8).

## 5. Ecosystem relations

| Project | What Fabric needs from it | What it needs from Fabric | Where | Owner |
|---|---|---|---|---|
| fabric-agent-adapter | print the `offered` nudge (0.3.15); the `working-with-fabric` skill's rule to claim the operator's request as the root task and file splits while it is claimed; a heartbeat with phase `waiting` before a wait; later an optional `--role` at enroll and `branch` on the turn | the nudge kinds and the rule's text, the role vocabulary | new ask (§8 message 2); earlier thread of request `dfb43ffb` for nudges | adapter |
| fabric-agent-contract | an optional `role` at enrollment and `branch` on `fabric_session_observe` (privacy reviewed: a branch name can carry a ticket or a person's name); a reserved default capability meaning «the project's primary»; whether the operator may move a slot (`com.responder_replace` through the operator's door) | Fabric's reading of roles and primary | new ask (§8 message 3) | contract |
| fabric-dashboards | one sessions screen (MD-12, CO-457): its `open_link` for sessions it holds; the same status vocabulary and colours (§4.5) so a session reads the same in both | Fabric's rows match Switchboard's (`SessionRow`), the status function's definition | thread `d683f99d` (request `55db8ac8`, answer `c443d88c`) | Dashboards; Fabric CO-457 |
| fabric-switchboard | `sessions --all` and `recovery` for limit stops (red, UC-10); the account behind a session | nothing new | the CO-457 thread with Dashboards; a short note (§8 message 4) | Switchboard |
| project-observatory | the project profile's `plan.next` kept current by onboarding agents; the machine's memory and swap read (`observatory_machine`) for the Colima window | none | message (§8 message 5) | Observatory |
| local lifecycle broker | the hold on `fabric.desktop` during the Colima window, so no agent's `ensure_running` relaunches Fabric (what aborted the first window) | none | operator's machine rule; the window's steps (§7) | broker owner (fabric-workspace in that window) |
| fabric-workspace | the release numbering (§6), the Colima window and its signal, relaying the announcement to every PassionCode agent (R-24), the operator queue for §9 | this document | message (§8 message 1) | fabric-workspace |
| passioncode (launcher) | Colima installed and awaited on members' Macs (V-4) | the Colima steps proven here | existing ledger rows | launcher |

## 6. Phasing

Settled 2026-10-26: 0.3.14 built items 1 to 5 and item 6's lanes; «Вопросов к вам нет» moved to 0.3.15. The next release is 0.3.15 (P-29, 2026-11-05) as recommended below, and the organization slice is named by its date, 2026-11-21 (P-27), not «0.3.16». In the table, ER-7's checked move goes with that slice's schema step (CO-461), and CO-456 needs no schema step and stays in 0.3.15; a terminal agent's branch (CO-459) is 0.3.15's only if the contract decides the turn's `branch` by then.

**0.3.14 (2026-10-29), already on `release/0.3.14`:** the left column with the toggle and branches (`7f014ec0`), the six
numbers under the face and chart (`374e21d7`), «В работе» by project (`68e1e726`), and, in the working tree, the
agent screen with «Сейчас», tasks and the session card.

**Proposed to add to 0.3.14** (all renderer or one bounded read; no protocol, no migration; each with its tests and
scenario amendment):

1. Back, forward, home in the top bar (R-7, §4.4); SCN-162's «no Back of Fabric's own» amended.
2. The console icon in the left agents list (R-5, R-6, §4.3).
3. The goal with the step as progress on home rows and the agent screen (R-3, R-4, §4.2): the `spawned` walk in
   `readHome`, «Цель не названа» when no root, the rule text in `fabric_whoami` (an ADVICE obligation, not a wire
   change).
4. The card's aim line (R-1, R-2, §4.1), the description on hover.
5. The status word and colour from today's signals (R-19, §4.5) on rows and tabs, without Switchboard's limit read.
6. The agent screen's lanes «В работе», «На проверке», «Передано» (R-12, §4.9) and «Вопросов к вам нет» (R-11's first
   group).

If the date is tight, 1, 2 and 3 are the must; 4 to 6 slide to the next release whole.

**The next release.** Recommendation: the simple Fabric's second half ships as **0.3.15, target 2026-11-05**, and
the organization slice (P-27) is renumbered **0.3.16 with its date 2026-11-21 unchanged**, the same move fabric-workspace
agreed for 0.3.14 on 2026-10-26. A patch number (0.3.14.x) is not allowed by the version scheme; a 0.3.16 shipped before
0.3.15 is not either. The alternative, folding it into 0.3.15 on 2026-11-21, makes the operator wait three weeks for
what he asked to use now and loads the organization release. Contents:

| Item | Requirements | Depends on |
|---|---|---|
| Notifications screen and click routing | R-16 | none |
| Tabs: pinned «Обзор», tabs for sessions Fabric does not hold, ⌘1 to ⌘9, ⌃Tab, goal and role on hover | R-17, R-18 | none for Fabric's own; Dashboards' `open_link` for theirs (CO-457) |
| Observed roles and badges, `came_in` words | R-8, R-9 | none |
| Primary marked from the slot holder, «На доске никто не дежурит», «Назначить основной» as a nudge | R-20, R-21, R-22 (part) | agents enrolling at all; the contract's default capability for the exact rule |
| Questions in three groups and requests beside the session | R-10, R-11 | none (operator reads exist) |
| «Предлагают взять» with «Взять в этой сессии» (the `offered` nudge) | R-13 | adapter prints it (additive) |
| Cross-project hand-off (v1 §5) | UC-6 | v1 open choice 2 |
| Switchboard's sessions and limit stops (CO-457) | R-19 red, UC-10 | Switchboard, Dashboards 0.9.0 |
| A checked move (ER-7 of the 0.3.14 review) and CO-456 | none of these | the schema step |

**Later, each with its dependency:** declared roles at enrollment and Fabric's «Запустить дежурного» (contract and
adapter); the branch of terminal-joined agents (contract privacy decision, adapter hook); the operator moving a slot
directly (contract); notifications beyond the OS (the personal communicator's Telegram, operator's own only);
monitoring as a routine kind with its schedule on the row (routines).

## 7. The move to Colima (R-26)

**What the operator asked:** leave OrbStack for Colima, as prepared before, so everything runs and memory is used
efficiently.

**The condition** fabric-workspace set after the first window failed: more than 15 GB free and swap under 16 GB
(`workspace/knowledge/integration.md`, the ledger rows of 2026-10-26 on «OrbStack to Colima»), because the first
window copied a live volume with 147 MB free and an agent's `ensure_running` relaunched Fabric a minute after the
operator's quit.

**Today, measured read-only on 2026-10-26 at 21:09 UTC:**

- `df -h ~`: 460 GiB, 403 GiB used, **2.4 GiB free** (100%).
- `sysctl vm.swapusage`: total 33 792 MB, **used 32 879 MB**, free 913 MB.
- 48 GB of RAM (`hw.memsize`).
- `docker context show`: `orbstack`. `colima list`: no instance (`/opt/homebrew/bin/colima` installed).
- Running in OrbStack: Fabric's stack (`supabase_db_fabric`, `_rest_`, `_auth_`, `_kong_`), `webpilot-db-1`,
  `webpilot-redis-1`, `aion-test-pg`, and **OrbStack's own Kubernetes** (`coredns`, `local-path-provisioner`); 98
  volumes.

The condition is far from met: 12.6 GB more disk and about 17 GB less swap. The machine is at a level where board
writes failed before (`integration.md`, 2026-10-26 02:00 UTC).

**What it would take:**

1. Memory first, reversible: turn off OrbStack's Kubernetes, which nobody's plan names (an operator or fabric-workspace
   decision; `orb config set k8s.enable false`, back with `true`); close idle agent sessions, which only the person
   does (LC-18), since swap is filled by live sessions.
2. Disk: about 13 GB to free, each item by its owner's word: test databases' volumes (never a container with
   `AutoRemove`), the Android SDK if unused, old build outputs whose `git ls-files` is empty. Never iOS simulator
   runtimes or Xcode components (this machine's rule).
3. An honest expectation: Colima runs a fixed-size VM (`--memory`), OrbStack a dynamic one; moving saves memory only
   with a small fixed VM (4 GB, as planned) and without Kubernetes. The move alone does not empty swap.

**Steps**, from the record kept at `617e5c14` (`docs/evidence/plans/2026-10-26-release-0313-verification.md`, «Rollout
on the operator's Mac, with the move to Colima»), adapted: 0.3.14 adds no migration, so there is no migration step.

0. Measure: more than 15 GB free and swap under 16 GB; otherwise stop.
1. Prove Colima on a disposable profile: a throwaway Supabase project with its own ports, addressed per command
   (`DOCKER_CONTEXT=colima-<profile>`, never `docker context use`), `supabase start`, `status` names the keys, then
   `colima delete --profile <profile> --force`.
2. Hold `fabric.desktop` through the lifecycle broker's owner (`lifecycle.py hold --target-id fabric.desktop`), list
   the live consoles, and the person quits Fabric.
3. Backup with no writer: `pg_dump` with the PostgreSQL 17 client to `pre-colima-0.3.14.dump`, the schema version and
   the journal count written beside it.
4. `supabase stop` on OrbStack, keeping its volumes (the rollback); `colima start --disk <GB> --memory 4 --cpu 4`, the
   disk at most the free space less 15 GB; the stopped `supabase_db_fabric` volume copied into Colima's engine (a
   live volume never); other owners' volumes only on their word; then `docker context use colima` with no Fabric
   running. Fabric finds Docker through the current context (`apps/desktop/src/main/dockerPing.ts#dockerContextHost`).
5. Release the hold; the person opens Fabric. Verify: the version, the schema, the journal count of step 3, the hub
   `pid` live, `docker context show` reads `colima`, `supabase_db_fabric` in `docker ps` there, the sweep's
   `work.swept@1` within six minutes. Then stop OrbStack; its volumes stay until the release close.
6. Going back: hold, the person quits, `pg_dump` from Colima, `docker context use orbstack`, OrbStack started, its
   volume restored from that dump if newer, release the hold, the person opens Fabric.

Owner of the window: fabric-workspace (it runs the process); this design only asks for it (§8 message 1).

## 8. Board messages to send

Drafts for the lead to post with `com.submit`; each is a request unless marked. Project ids from `com.directory`
(2026-10-26 21:09 UTC).

**1. To fabric-workspace** (`5f8f0a54-c99b-4251-9b1e-0e9bec30508d`), request, capability `decision.ask`, by
2026-10-28.

> Fabric: the operator's second review of the simple Fabric (2026-10-26) asks for more than fits 0.3.14. Design:
> docs/ux/2026-10-26-simple-fabric-v2.md. Three asks. (1) Numbering: 0.3.14 (2026-10-29) takes back, forward and home,
> the console icon in the agents list and an agent's goal with its step as progress; the rest (notifications, tabs
> from any agent, roles, the primary responder, questions beside the session) ships as 0.3.15 on 2026-11-05, and the
> organization slice becomes 0.3.16 with its date 2026-11-21 unchanged. Do you agree, as with 0.3.14's renumbering?
> (2) The operator asked to move this Mac to Colima now. Measured 21:09 UTC: 2.4 GiB free, swap 32.9 of 33.8 GB used,
> OrbStack's Kubernetes running. Your condition (15 GB free, swap under 16 GB) is far off. Please put to the operator,
> in one batch: turning OrbStack's Kubernetes off, the disk items to free, and closing idle sessions; then signal the
> window (steps in §7). (3) The operator asked that every PassionCode agent be told what to do: please relay the
> announcement below to every project you steer.

Announcement to relay (kind announcement, through fabric-workspace; part (b) corrected 2026-10-26 by the 0.3.14 release
review, iteration 2, DO-2, to the mechanism `3648fd30` ships, after the first wording promised a link Fabric made only
for launched sessions):

> From Fabric, on the operator's word of 2026-10-26 («Всем агентам PassionCode передай, что надо делать»): Fabric now
> shows each agent's goal and its current step to the operator. To be seen correctly: (a) claim the person's request
> as one task whose title is that request in one line; (b) file each piece you split off with fabric_task_create while
> that task is the one task you hold claimed in the project: Fabric links it as spawned from that task (the answer's
> spawned_from names it; with no claim or several, spawned_from_why says why, and you link it with fabric_task_link,
> taskId the piece, targetTaskId the task it came from); without a link the operator sees your current task as your
> goal; (c) report your stage with step and of_steps; (d) send a
> heartbeat with phase waiting before you wait on a question; (e) read your project's board at start and answer
> requests addressed to it. Nothing here is new protocol.

**2. To fabric-agent-adapter** (`bee477be-99d1-4814-afa1-a1a8b2e7d836`), request, by 2026-11-02.

> Fabric 0.3.15 (proposed 2026-11-05) shows an agent's goal (the root of its spawned tasks), its role and its status
> colour (design: docs/ux/2026-10-26-simple-fabric-v2.md §4). Asks: (1) in the working-with-fabric skill, the rule
> «claim the person's request as one task; file splits with fabric_task_create while it is claimed»; (2) a heartbeat
> with phase waiting before the agent waits on the person; (3) print a new nudge kind `offered` (a task the operator
> offered this session) as you print nudges since 0.51.2; (4) later, with the contract: an optional --role at enroll
> and a branch on the turn. Can (1) to (3) land by 2026-11-02?

**3. To fabric-agent-contract** (`82651c70-4598-4c52-bc6d-1b429cac7649`), request, by 2026-11-05.

> Fabric asks three decisions for the simple Fabric (docs/ux/2026-10-26-simple-fabric-v2.md §4.6, §4.12): (1) a
> reserved default capability meaning «the project's primary responder» (proposed `project.work`), so «основная»
> has one rule; (2) may the operator, through Fabric's operator door, call com.responder_replace to move a slot to
> another session; (3) an optional `role` (coder, observer, monitor, responder) at enrollment and an optional `branch`
> on fabric_session_observe, with a privacy rule for branch names. Today no project declares any capability (directory,
> 2026-10-26 21:09 UTC).

**4. To fabric-switchboard** (`476eb6af-e271-40e4-9e60-4d8681c1c4af`), message, no deadline.

> For CO-457 (Fabric 0.3.15): Fabric will colour a session red «упёрся в лимит до HH:MM» from your `recovery` read and
> show its account from `sessions --all`, read only, never `handovers run` or `recovery claim`. Is `recovery`'s shape
> stable enough to read by 2026-11-05?

**5. To fabric-dashboards** (`4a313b30-b944-483d-84d7-1b3bdd2967fa`), reply on thread `d683f99d`, by 2026-11-03.

> Fabric will show sessions as tabs with a status word and colour: working green, waiting yellow, error red, idle
> grey, on duty blue, ended outline (docs/ux/2026-10-26-simple-fabric-v2.md §4.5). For one sessions screen (MD-12),
> will Dashboards use the same vocabulary? A session Dashboards holds opens from Fabric's tab through your open_link.

**6. To project-observatory** (`66217c89-8fd4-8418-a2e0-1ea27604764b`), message, no deadline.

> Fabric's home will show a project's current aim from its running work, else the profile's plan.next. Onboarding
> agents that record a profile: please keep plan.next current. And for the Colima window: fabric-workspace will read
> your machine section for memory and swap before it starts.

## 9. Open choices for the operator

Settled 2026-10-26 (see the status above): choice 1 as 0.3.15 on 2026-11-05 with the organization slice named by its
date, 2026-11-21, instead of «0.3.16»; choice 5 is fabric-workspace's window. The rest stay open for 0.3.15.

1. **Numbering.** Default: the second half ships as 0.3.15 on 2026-11-05 and the organization slice becomes 0.3.16 on
   2026-11-21. Alternative: everything in 0.3.15 on 2026-11-21.
2. **The card's line.** Default: the current aim from running work, else «Дальше:» from the profile's plan, else the
   name alone; the description only on hover and the project page. Alternative: the name alone always.
3. **The primary.** Default: the holder of the project's responder slot (the contract's default capability once it
   exists). Alternative: a Fabric-only pin the person sets on a session, independent of the board.
4. **Tabs for sessions Fabric does not hold.** Default: a tab with that agent's screen and where its session runs
   (no terminal drawn). Alternative: tabs only for consoles Fabric holds.
5. **Colima now.** Default: approve, in one batch through fabric-workspace, turning OrbStack's Kubernetes off, the
   disk items to free and closing idle sessions; the window follows when the condition holds. Alternative: wait until
   the disk recovers on its own.

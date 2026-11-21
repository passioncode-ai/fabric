# Spec: the CEO's own board, creation and lists, the session manager, PassionCode cloud (2026-11-20)

Date: 2026-11-20. Fabric session `8343a070`, branch `feat/ceo-board-ux`. Stage 4 of the task-pipeline run (spec); the
plan is [plan.md](plan.md). Source: [the owner's words](owner-words.md), parts 1 to 4, verbatim, and the CEO's order that
carried them (part 4 changed the priority: fix what blocks work first; design the interface with the owner by mockups).

## Коротко для владельца

- Сначала починено то, что мешает работать (4 починки, ветка `feat/ceo-board-ux`, выпуск 0.3.27): задача доходит до
  сессии, которую запускает CEO, и CEO знает, дошла ли; сообщение CEO, пока он работает, больше не теряется (было 5 из
  20); проект по голосу находится; текст задачи не печатается в шелл.
- Экраны (создание, главная, проекты слева, агенты с дашбордом, менеджер сессий, доска CEO, компьютер, иконка) пока
  только мокапами в [mockups/](mockups/index.html): выбираем вместе, потом строим.
- Доска CEO и база знаний строятся на уже начатом едином индексе (ветка `feat/knowledge-graph`, ADR-0199, ADR-0200),
  не рядом с ним. Вы сказали «в этом апдейте»: 0.3.21 и следующие уже выпущены, поэтому это ближайший выпуск после
  0.3.27.
- Цены и офферы (свой ключ по подписке, облачные раннеры, «виртуальная компания») ваши решения: в плане варианты, не
  выбор.

## 1. The asks

Each phrase of the owner is one ask. «Now» is this session; a wave is in [plan.md](plan.md).

| Ask | The owner (part) | What it means | Where |
|---|---|---|---|
| A1 | «давай базовые вещи … чиним … что сейчас мешает нам работать» (4) | fix what blocks work now, and look for half-done work that is not visible at once | now, wave 0 |
| A2 | «Там, где кнопка создать … Открыть папку с проектами, создать проект, создать агента, создать новую сессию в root» (1) | «Создать» holds the four ways to start; «Новая сессия» leaves the global place | wave A (design), wave B (build) |
| A3 | «покажем … последние закрытые сессии или … последние работающие активные проекты» (1) | Главная shows recently closed sessions and recently active projects | waves A, B |
| A4 | «фильтрануть по имени … сортировка по последним активностям … human activity … agent activity, фильтр типа select … По организации» (1), «разворачиваются … на какую-нибудь галочку … нажать на сессию, сразу же перейти» (2) | the left column's projects: search, sort by the person's or the agents' activity, filter by organisation, expand to sessions | waves A, B |
| A5 | «одной организации может быть несколько организаций на GitHub … несколько юридических организаций … кто к чему относится … где какой доступ» (1) | the corporate graph: organisation, its GitHub organisations, its legal entities, its projects, with access | wave C |
| A6 | «у агентов может быть несколько сессий … кнопочку дэшборда … D … открыть также здесь внутри дэшборд» (2) | agent rows list their sessions; a D button opens the agent's dashboard inside Fabric | waves A, D |
| A7 | «подумай, нужно ли нам … Fabric Dashboard переводить» (2) | decide and justify whether Fabric Dashboards moves into Fabric | wave A (proposal), wave G |
| A8 | «менеджер сессии … отдельно меню … какие на этом компьютере, на другом … менеджинг прав, команды … свитчборд» (3) | a «Сессии» menu item: every session by machine, rights, commands, on Switchboard's mechanisms | waves A, D |
| A9 | «чтобы остался только один Fabric … все остальные … как модули … не делали два раза одного кода» (3) | review of duplicated code across Switchboard, Dashboards, Inbox, the adapter; plan and ADR draft only | wave G |
| A10 | «у него тоже был свой борт … планы … все организации … разделенные» (1) | the CEO's own board inside Fabric, findable in search and Dashboards, plans per organisation | wave C |
| A11 | «одна такая большая база знаний … с векторной, со связями, с рак-поисками» (1) | one knowledge base about the owner, projects, directions and agents' work, by the Sound Engine and Data Room method | wave C |
| A12 | «бэкапилась … на облако … passion code облачный» (1) | the CEO board's data backed up to PassionCode's cloud (passioncode-platform) | wave C |
| A13 | «Фабрик сделаем после установки, проработаем отбординг» (1) | PassionCode cloud in Fabric after install; an onboarding that explains how to use it | wave F |
| A14 | «продавать … наш ключ … за подписку … облачных … раннеров … образ, на котором фабрик стоит … виртуальная компания … отдельный оффер» (1) | offers to sell; variants only, the owner decides | wave F |
| A15 | «аналитика … по всем экранам … анонимная … изобретем аналитику агентскую» (4) | anonymous usage events on every screen, plus task-level, intent-aware analytics | wave E |
| A16 | «иконка аватарки нашего приложения … меняем SEO-иконку … менять аватарку» (4) | Fabric's app icon is the CEO's avatar, one setting | wave I |
| A17 | «несколько инстансов … два SEO … профайл … опционально … закладываем архитектуру и пишем веклог» (4) | several Fabric instances or profiles: architecture and a backlog row only | wave H |
| A18 | «отслеживание нагрузки … диска … обсерваторию … отдельный экран … не тянуть весь интерфейс» (4) | one compact machine screen, everything else under the hood | waves A, D |

## 2. What is true when this order is done

- A1: every fix carries a test that fails on the old code and passes now, and the release notes name it. Done for four
  blockers (section 3); the rest are rows with evidence.
- A2 to A8, A16, A18: the owner chose among the mockups; scenarios, flows and `docs/ux/product-model.json` carry the
  choice; each built screen passes its scenario on the built app.
- A10 to A12: the CEO answers «what is planned for organisation X» and «who has access to Y» from its board, with
  citations (quote, source, date), and the board's data has a restorable copy in PassionCode's cloud.
- A9: an accepted ADR and a migration plan the owners of Switchboard, Dashboards, Inbox and the adapter answered.
- A13, A14: a written onboarding and an offer sheet with variants; prices stay the owner's decision.
- A15: an event catalogue (event, status, screens with `file#symbol`, properties) by the operator's event rules (no event
  renamed, a moved button keeps its name), with the consent rule of ADR-0127 kept.
- A17: an architecture note and one backlog row; one instance stays the default.

Out of scope here: publishing outward, spending above a limit, moving code between repositories, and any price.
Must not change: what works today (the board, the CEO, the consoles); events already in the catalogue.

## 3. Wave 0, done in this session (fix what blocks work)

| Fix | Evidence before | Commit | Test that fails on the old code |
|---|---|---|---|
| A session the CEO starts gets its task; `first_task` says what became of it | session 0d842f8b waited 40 min on an empty prompt; Claude Code's own transcript has no user turn until the CEO typed the task again at 13:41 UTC; the delivery result was dropped unless it threw (`consoleOpen.ts` before `3dbbe573`) | `3dbbe573` | `apps/desktop/test/console-open.test.mjs` (3 tests), `apps/desktop/test/ceo-agent.test.mjs` «start says what became of the first task» |
| A message to a working CEO is written after 3 s | 5 of 20 `ceo.agent.delivered` were `readiness_timeout` (operations log 2026-11-19 and 20); a busy Claude Code gave one 400 ms gap in 44; a message typed mid-turn was answered (probe on a live Claude Code, 2026-11-20) | `1f682c6a` | `apps/desktop/test/delivery-queue.test.mjs` «a working console that never goes quiet …» |
| The CEO finds a project by its spoken name | 10 `ipc.ceo-agent:voice-tool` refusals («sound engine» named two projects; two projects named «fabric-agents-database») | `d5b4b0cc` | `apps/desktop/test/ceo-agent.test.mjs` «a project by id, folder, name or words …» |
| A task in words is never typed into a plain shell | the CEO, 2026-11-20: sessions b62ca935, 2bbea018, ed5b1667 printed the task into zsh («parse error near `)'») | `2fcd0996` | `console-open.test.mjs` «a plain shell is never typed a task in words», `ceo-agent.test.mjs` «start refuses a task in words for a plain shell» |

The probe that ruled out a startup race: a Fabric-timed paste into a fresh Claude Code 2.1.329, in the project folder of
session 0d842f8b and in this repository, landed in the input box every time (2026-11-20). The 40 minutes are therefore
not proven to be one of the two causes fixed; the fix makes the next one visible (`terminal.first-instruction`) and tells
the CEO at once.

Found and not fixed here (rows, see [plan.md](plan.md#wave-0-what-blocks-work)): a hub client refused 401 every 20 s
since Fabric's restart at 12:08 UTC, with no client named in the log; the duplicate CEO projects (task `543e0340`);
board dispatch runs that end without an answer.

## 4. Decisions taken here, and why

- **The knowledge base builds on the estate index, not beside it.** `feat/knowledge-graph` (ADR-0199, ADR-0200, task
  `57781f0d`, in review, 7 commits past main) already indexes every session, transcript, task and commit with a graph and
  the CEO's direct tools. A second index would be two truths. The CEO board adds organisations, legal entities, access and
  plans to that graph.
- **Fabric Dashboards: embed, do not absorb (proposal for the owner).** Fabric opens a service's dashboard inside its own
  window through the same `fabric-service/0.1` descriptor and `open_link` contract Fabric Dashboards uses; Fabric
  Dashboards stays the host for a person without Fabric. Moving it whole would put a second product UI inside Fabric,
  which part 4 refuses («не тянуть весь интерфейс»).
- **Order: blockers, then design with the owner, then build.** Part 4 sets it.

# UX Scenarios

<!-- Managed with super-ux (ux-contract v4). Update in the same change as any user-facing behavior change. -->

## First release · CEO-first · 2026-09-25

Target revision authorised by the operator. SCN-095/096 and FLW-55/56 govern the R0 entry and continuation. Earlier dated source → manual name/purpose → review creation descriptions are retained as history, **superseded for the first-release route**. SCN-031/059 now enter through CEO identity → ready executor → source picker → automatic discovery → sourced insight. Aesthetic customisation is optional; no manual name/purpose or separate project-check screen is a prerequisite. Optional starter/organisation/idea capabilities remain in the wider catalog and are not the new-user default. Native Coverage and Product observations are unchanged.

## Index

| ID | Title | Feature | Persona | Traces | Status | Last audit |
|---|---|---|---|---|---|---|
| SCN-001 | Create a project from a starter | Projects | P-01 | ST-001, FLW-01 | validated | 2026-09-09 PARTIAL |
| SCN-002 | Create a portfolio observer | Projects | P-01 | ST-001, FLW-01 | validated | 2026-09-09 FAIL |
| SCN-003 | Add or replace an admitted agent | Agents | P-01 | ST-002, ST-006, FLW-02 | validated | 2026-09-09 PARTIAL |
| SCN-004 | Provider cannot be bound | Agents | P-01 | ST-002, FLW-02 | validated | 2026-09-09 FAIL |
| SCN-005 | Connect and scope an external account | Connections | P-01 | ST-003, FLW-03 | validated | 2026-09-09 FAIL |
| SCN-006 | Scan all project cards | Monitoring | P-01 | ST-004, FLW-04 | validated | 2026-09-09 PARTIAL |
| SCN-007 | Open an affected project from attention | Monitoring | P-01 | ST-004, ST-005, FLW-04 | validated | 2026-09-09 PARTIAL |
| SCN-008 | Inspect and recover a run | Runs | P-01 | ST-005, FLW-04 | validated | 2026-09-09 PARTIAL |
| SCN-009 | Replace an agent without moving its routine | Runs | P-01 | ST-006, FLW-02, FLW-04 | validated | 2026-09-09 PARTIAL |
| SCN-010 | Observer submits a proposal | Cross-project findings | P-01 | ST-007, FLW-05 | validated | 2026-09-09 FAIL |
| SCN-011 | Target PM resolves a proposal once | Cross-project findings | P-01 | ST-007, FLW-05 | validated | 2026-09-09 FAIL |
| SCN-012 | Promote memory through an accepted artifact | Memory | P-01 | ST-007, FLW-05 | validated | 2026-09-09 PARTIAL |
| SCN-013 | Join an estate with explicit roles | Membership | P-03 | ST-008, FLW-06 | draft | 2026-09-09 FAIL |
| SCN-014 | Resolve an interaction from a role workspace | Role work | P-03 | ST-009, FLW-06 | draft | 2026-09-09 FAIL |
| SCN-015 | Adapt an existing repository into a provider | Agent foundry | P-04 | ST-010, FLW-07 | draft | 2026-09-09 FAIL |
| SCN-016 | Create and admit a new provider | Agent foundry | P-01, P-04 | ST-011, FLW-07 | draft | 2026-09-09 FAIL |
| SCN-017 | Bootstrap or conformance fails safely | Agent foundry | P-04 | ST-010, ST-011, FLW-07 | draft | 2026-09-09 FAIL |
| SCN-018 | Add a provider view to a role workspace | Workspace | P-02 | ST-012, FLW-08 | draft | 2026-09-09 FAIL |
| SCN-019 | Resolve a customer request with human fallback | Support | P-02, P-03 | ST-013, FLW-09 | draft | 2026-09-09 FAIL |
| SCN-020 | Turn a production signal into a verified release | Reliability | P-01 | ST-014, FLW-10 | draft | 2026-09-09 FAIL |
| SCN-021 | Research, validate, publish and measure content | Growth | P-02, P-03 | ST-015, FLW-11 | draft | 2026-09-09 FAIL |
| SCN-022 | Create and connect scoped MCP access | External control | P-01, P-02 | ST-016, FLW-12 | draft | 2026-09-09 FAIL |
| SCN-023 | External agent participates within its MCP scope | External control | P-01, P-02 | ST-016, FLW-12 | draft | 2026-09-09 FAIL |
| SCN-024 | MCP access is denied or revoked safely | External control | P-01, P-02 | ST-016, FLW-12 | draft | 2026-09-09 FAIL |
| SCN-025 | Work in a project's hosted terminal | Terminal | P-01 | ST-017, FLW-13 | draft | 2026-09-09 PARTIAL |
| SCN-026 | Follow the estate through the journal feed | Monitoring | P-01 | ST-004, FLW-04 | retired | 2026-09-09 PARTIAL |
| SCN-027 | Approve, refuse or watch the floor refuse | Autonomy | P-01 | ST-018, FLW-14 | draft | 2026-09-09 PARTIAL |
| SCN-028 | Open a project as a tab and configure it | Projects | P-01 | ST-001, ST-019, FLW-15 | draft | 2026-09-09 PARTIAL |
| SCN-029 | Launch an agent and open its session window | Agents | P-01 | ST-017, ST-020, FLW-16 | draft | 2026-09-09 BLOCKED |
| SCN-030 | Read the project workspace canvas | Workspace | P-01 | ST-021, FLW-17 | retired | 2026-09-09 PARTIAL |
| SCN-031 | Onboard a project in a new tab | Projects | P-01 | ST-001, ST-022, FLW-18 | draft | 2026-09-09 BLOCKED |
| SCN-032 | Ask for work and watch what it opened | Projects | P-01 | ST-023, ST-024, FLW-18 | draft | 2026-09-09 PARTIAL |
| SCN-033 | Attach and detach repositories | Projects | P-01 | ST-022, FLW-18 | draft | 2026-09-09 PARTIAL |
| SCN-034 | Open a file and save it against an agent's edit | Files | P-01 | ST-025, FLW-19 | draft | 2026-09-09 BLOCKED |
| SCN-035 | Read what an agent says it is doing | Agents | P-01 | ST-026 | draft | 2026-09-09 BLOCKED |
| SCN-036 | Read what a finished session actually did | Agents | P-01 | ST-026 | draft | 2026-09-09 PARTIAL |
| SCN-037 | See who remembered something, and what memory could not answer | Memory | P-01 | ST-007 | draft | 2026-09-09 PARTIAL |
| SCN-038 | Evaluate the shift from vibe coding to passion coding | Public website | P-05 | ST-027, FLW-20 | draft | 2026-09-09 BLOCKED |
| SCN-039 | See what this project remembers, and what it could not answer | Memory | P-01 | ST-028, FLW-21 | draft | 2026-09-09 PARTIAL |
| SCN-040 | Rejoin a project by reading its decisions | Memory | P-01 | ST-029, FLW-21 | draft | 2026-09-09 PARTIAL |
| SCN-041 | Work a board the agents keep current | Tasks | P-01 | ST-030, FLW-22 | draft | 2026-10-08 PARTIAL |
| SCN-042 | Ask the manager, and get an artefact rather than advice | Manager | P-01 | ST-031, FLW-24, FLW-57 | draft | 2026-09-09 FAIL |
| SCN-043 | Lead with the projects actually being worked | Projects | P-01 | ST-032, FLW-21 | draft | 2026-09-09 PARTIAL |
| SCN-044 | Read what the estate has actually done | Manager | P-01 | ST-033, FLW-21 | retired | 2026-09-09 PARTIAL |
| SCN-045 | Rejoin a task by reading its own page | Tasks | P-01 | ST-034, FLW-22 | draft | 2026-10-08 PARTIAL |
| SCN-046 | Judge direction from goals and the graph | Planning | P-01 | ST-035, FLW-23 | draft | 2026-09-09 PARTIAL |
| SCN-047 | See what a project's agents may do, and hold them to it | Harness | P-01 | ST-036, FLW-24 | draft | 2026-10-08 PARTIAL |
| SCN-048 | Find anything the estate holds from one field | Search | P-01 | ST-028, FLW-21 | draft | 2026-09-09 PARTIAL |
| SCN-049 | Watch every agent from one screen | Agents | P-01 | ST-037, FLW-21 | draft | 2026-09-09 PARTIAL |
| SCN-050 | Answer a scoped question and see whether work received it | Board/questions | P-01 | ST-030, ST-034, FLW-25 | draft | 2026-09-09 PARTIAL |
| SCN-051 | Inspect a manager settlement and override it by a new decision | Decisions/authority | P-01 | ST-029, ST-030, FLW-26 | draft | 2026-09-09 FAIL |
| SCN-052 | Read one execution iteration without confusing report and observation | Runs | P-01 | ST-034, ST-037, FLW-27 | draft | 2026-09-09 PARTIAL |
| SCN-053 | Inspect agent history, project history and the target plan as distinct views | Graphs | P-01 | ST-030, ST-035, ST-037, FLW-23, FLW-27 | draft | 2026-09-09 PARTIAL |
| SCN-054 | Trace how a decision changed and what evidence was supplied | Decision history | P-01 | ST-029, ST-034, FLW-28 | draft | 2026-09-09 PARTIAL |
| SCN-055 | Handle what needs attention and read what happened | Inbox | P-01 | ST-028, ST-033, FLW-21, FLW-29 | retired | 2026-09-09 FAIL |
| SCN-056 | Inspect every cycle and the evidence for its state | Cycles | P-01 | ST-030, ST-033, ST-037, FLW-30 | retired | 2026-09-09 PARTIAL |
| SCN-057 | Preview the next context and inspect the exact past pack | Memory/context | P-01 | ST-028, ST-029, ST-034, FLW-31 | draft | 2026-09-09 PARTIAL |
| SCN-058 | Follow evidence through a collapsed interface without losing context | Navigation/disclosure | P-01 | ST-028, ST-034, ST-037, FLW-27, FLW-28, FLW-29, FLW-30, FLW-31 | draft | 2026-09-09 PARTIAL |
| SCN-059 | Reach first value progressively and resume an unfinished draft | Onboarding | P-01 | ST-001, ST-022, ST-023, FLW-32 | draft | 2026-09-09 PARTIAL |
| SCN-060 | Return to existing work across projects without losing scope | Navigation/continuity | P-01 | ST-019, ST-028, ST-032, ST-034, FLW-33 | draft | 2026-09-09 PARTIAL |
| SCN-061 | Choose and replace a manager with visible authority and host readiness | Manager lifecycle | P-01, P-02 | ST-002, ST-006, ST-031, ST-036, ST-037, FLW-34 | draft | 2026-09-09 FAIL |
| SCN-062 | Turn a retrospective episode into a verified lesson and detect regression | Retrospectives | P-01 | ST-028, ST-029, ST-030, ST-033, ST-034, FLW-35 | retired | 2026-09-09 PARTIAL |
| SCN-063 | Inspect service feedback and stop outbound work honestly | Service feedback/privacy | P-01, P-02 | ST-028, ST-033, ST-036, FLW-35 | draft | 2026-09-09 FAIL |
| SCN-064 | Inspect declared storage and import a verified mirror without partial writes | Storage/sync | P-01, P-02 | ST-001, ST-022, ST-028, ST-033, FLW-36 | draft | 2026-09-09 PARTIAL |
| SCN-065 | Restore an archive into a fresh Estate and open it | Backup/recovery | P-01, P-02 | ST-001, ST-028, ST-033, FLW-36 | draft | 2026-09-09 FAIL |
| SCN-066 | Return from authentication to the same invitation with current membership | Membership | P-02, P-03 | ST-008, ST-009, FLW-06 | draft | 2026-09-09 FAIL |
| SCN-067 | Record a first task and distinguish admission from delivery acknowledgement | Task admission | P-01 | ST-023, ST-024, ST-034, ST-037, FLW-32 | draft | 2026-09-09 FAIL |
| SCN-068 | Маршрут работы | Маршрут работы | P-01 | FLW-37; SCR-49 | draft | 2026-09-09 FAIL |
| SCN-069 | Цели и приёмка | Цели и приёмка | P-01 | FLW-38; SCR-50 | draft | 2026-09-09 PARTIAL |
| SCN-070 | Квоты и использование | Квоты и использование | P-01 | FLW-39; SCR-51 | draft | 2026-09-09 PARTIAL |
| SCN-071 | Настройки рабочего пространства | Настройки рабочего пространства | P-01 | FLW-40; SCR-52 | draft | 2026-09-09 PARTIAL |
| SCN-072 | Уведомления и маршруты | Уведомления и маршруты | P-01 | FLW-41; SCR-53 | draft | 2026-09-09 FAIL |
| SCN-073 | Диагностика | Диагностика | P-01 | FLW-42; SCR-54 | retired | 2026-10-08 PARTIAL |
| SCN-074 | Архив и удаление | Архив и удаление | P-01 | FLW-43; SCR-55 | draft | 2026-09-09 FAIL |
| SCN-075 | Редактор цикла | Редактор цикла | P-01 | FLW-44; SCR-56 | draft | 2026-09-09 PARTIAL |
| SCN-076 | Сервисные терминалы | Сервисные терминалы | P-01 | FLW-45; SCR-57 | draft | 2026-09-09 FAIL |
| SCN-077 | Встроенный браузер | Встроенный браузер | P-01 | FLW-46; SCR-58 | draft | 2026-09-09 FAIL |
| SCN-078 | Предпросмотр медиа | Предпросмотр медиа | P-01 | FLW-47; SCR-59 | draft | 2026-09-09 FAIL |
| SCN-079 | Diff выбранного файла | Diff выбранного файла | P-01 | FLW-48; SCR-60 | draft | unobserved |
| SCN-080 | Документ и происхождение задач | Документ и происхождение задач | P-01 | FLW-49; SCR-61 | draft | unobserved |
| SCN-090 | Catch up on a project you left, and lose nothing by looking | Digest | P-01 | FLW-21, SCR-31 | draft | unobserved |
| SCN-081 | Добавить аккаунт провайдера | Provider accounts | P-01 | ST-002, ST-006, FLW-50 | draft | 2026-09-09 BLOCKED |
| SCN-082 | Выбрать аккаунт для новых разговоров | Provider accounts | P-01 | ST-002, ST-006, FLW-50 | draft | 2026-09-09 BLOCKED |
| SCN-083 | Продолжить разговор с другим аккаунтом | Provider accounts | P-01 | ST-002, ST-006, FLW-51 | draft | 2026-09-09 BLOCKED |
| SCN-084 | Дождаться безопасной остановки или отменить переход | Provider accounts | P-01 | ST-002, ST-006, FLW-51 | draft | 2026-09-09 BLOCKED |
| SCN-085 | Восстановить разговор после сбоя смены | Provider accounts | P-01 | ST-002, ST-006, FLW-51 | draft | 2026-09-09 BLOCKED |
| SCN-086 | Проверить квоту и удалить локальный аккаунт | Provider accounts | P-01 | ST-002, ST-006, FLW-52 | draft | 2026-09-10 возраст показан, непрочитанное не 0%, заблокированное удаление недоступно с причиной на самой кнопке; `ProviderAccounts.test.tsx` |
| SCN-087 | Увидеть границы поддержки и доступа | Provider accounts | P-01 | ST-002, ST-006, FLW-52 | draft | 2026-09-10 SCR-62 рендерит ограничение первым блоком; `ProviderAccounts.test.tsx` |
| SCN-088 | Включить автоматическую смену аккаунта | Provider accounts | P-01 | ST-006, FLW-53 | draft | 2026-09-09 BLOCKED |
| SCN-089 | Остановить автосмену и пережить отсутствие кандидата | Provider accounts | P-01 | ST-006, FLW-53 | draft | 2026-09-10 состояние вычисляется, удержание отличено от исчерпания; `ProviderAccounts.test.tsx` |
| SCN-091 | Вернуться к агенту у его консоли, прочитав его собственный контекст | Agents | P-01 | ST-038, ST-026, ST-034, FLW-54, FLW-21 | draft | unobserved |
| SCN-092 | Вернуться в estate холодным и дойти до первого решения | Navigation/continuity | P-01 | ST-018, ST-029, ST-032, ST-037, ST-038, FLW-54 | draft | unobserved |
| SCN-093 | Fabric встречает возвращение и отмечает веху, ничего не выдумывая | Manager/Gamification | P-01 | ST-039, ST-029, ST-018, FLW-54, FLW-21 | retired | unobserved |
| SCN-094 | Открыть дашборд как страницу Fabric и прочитать путь до «сейчас» | Manager/Gamification | P-01 | ST-040, ST-039, ST-029, FLW-54, FLW-21 | retired | 2026-10-08 PARTIAL |
| SCN-095 | Configure Fabric and discover a real project | CEO-first onboarding | P-01 | ST-001, ST-022, ST-031, FLW-55 | draft | unobserved |
| SCN-096 | Stop an executor and continue the same work | Agent continuity | P-01 | ST-006, ST-017, ST-034, FLW-56 | draft | unobserved |
| SCN-097 | Export and import my private conversation history | Backup/recovery | P-01 | ST-001, ST-028, ST-033, FLW-58 | draft | unobserved |
| SCN-098 | See every agent on this Mac | Agent registry | P-01 | ST-041, FLW-59 | draft | — |
| SCN-099 | First scan and an empty registry | Agent registry | P-01 | ST-041, FLW-59 | draft | — |
| SCN-100 | An agent that cannot be used | Agent registry | P-01 | ST-041, FLW-59 | draft | — |
| SCN-101 | Open an agent's dashboard | Agent registry | P-01 | ST-041, FLW-59 | draft | — |
| SCN-102 | Returning: the registry changed since my last visit | Agent registry | P-01 | ST-041, FLW-59 | draft | — |
| SCN-103 | See MCP servers through Project Observatory | MCP servers | P-01 | ST-042, FLW-60 | draft | — |
| SCN-104 | MCP servers without Project Observatory | MCP servers | P-01 | ST-042, FLW-60 | draft | — |
| SCN-105 | Give Fabric a task; it picks the project and the agent | Tasking | P-01 | ST-043, FLW-61 | draft | — |
| SCN-106 | First use of an agent in a project | Tasking | P-01 | ST-043, FLW-61 | draft | — |
| SCN-107 | An agent waits for my choice | Interaction points | P-01 | ST-044, FLW-61 | draft | — |
| SCN-108 | A job fails or its result is unknown | Tasking | P-01 | ST-043, FLW-61 | draft | — |
| SCN-109 | A coding agent calls Fabric within its grant | External control | P-01 | ST-045, FLW-62 | draft | — |
| SCN-110 | Ask the floating Fabric to change what is on screen | Floating CEO | P-01 | ST-046, FLW-63 | draft | — |
| SCN-111 | Micro-controls on the screen | Floating CEO | P-01 | ST-046, FLW-63 | draft | — |
| SCN-112 | Fabric composes a pipeline and I approve it | Pipelines | P-01 | ST-047, FLW-64 | draft | — |
| SCN-113 | A pipeline fails its checks | Pipelines | P-01 | ST-047, FLW-64 | draft | — |
| SCN-114 | Reuse a global pipeline; replace an agent | Pipelines | P-01 | ST-047, FLW-64 | draft | — |
| SCN-115 | Read a run as one graph | Traces | P-01 | ST-048, FLW-65 | draft | — |
| SCN-116 | Debug a failed branch; an incomplete trace | Traces | P-01 | ST-048, FLW-65 | draft | — |
| SCN-117 | Use Fabric tools in a project and globally | Fabric tools | P-01 | ST-049, FLW-66 | draft | — |
| SCN-118 | A tool cannot be enabled or fails | Fabric tools | P-01 | ST-049, FLW-66 | draft | — |
| SCN-119 | Accept an optimizer proposal | Optimizer | P-01 | ST-049, FLW-66 | draft | — |
| SCN-120 | Decline or wait on a proposal | Optimizer | P-01 | ST-049, FLW-66 | draft | — |
| SCN-121 | Ask Fabric to make a new agent | Agent production | P-01 | ST-050, FLW-67 | draft | — |
| SCN-122 | Turn an existing project into an agent | Agent production | P-01 | ST-050, FLW-67 | draft | — |
| SCN-123 | Agent production fails a gate | Agent production | P-01 | ST-050, FLW-67 | draft | — |
| SCN-124 | Fabric answers from memory with sources | Memory | P-01 | ST-051, FLW-68 | draft | — |
| SCN-125 | Nothing in memory, or memory unavailable | Memory | P-01 | ST-051, FLW-68 | draft | — |
| SCN-126 | First run: name and look, your projects folder, the four actions, the family's own agents first | First run | P-01 | ST-001, ST-022, ST-045, FLW-69, FLW-71, FLW-78 | draft | — |
| SCN-127 | Add an existing project from one folder | Start paths | P-01 | ST-001, ST-031, FLW-70 | draft | 2026-10-08 PARTIAL |
| SCN-128 | Scan a projects folder and tick what becomes a Project | Start paths | P-01 | ST-001, ST-031, FLW-71, FLW-69 | draft | — |
| SCN-129 | Create a new project in a new folder or as an idea | Start paths | P-01 | ST-001, FLW-72 | draft | — |
| SCN-130 | Start a new agent inside a project | Start paths | P-01 | ST-050, FLW-73 | draft | — |
| SCN-131 | Adapt an existing agent into an ecosystem agent | Start paths | P-01 | ST-050, FLW-74 | draft | — |
| SCN-132 | An external agent asks for access and the operator decides | Hub | P-01 | ST-045, FLW-75 | draft | — |
| SCN-133 | Connect a product to Fabric by the product's own consent | Hub | P-01 | ST-045, FLW-76 | draft | — |
| SCN-134 | See that Fabric shares usage counts, and turn them off for every PassionCode app | Settings | P-01 | FLW-40 | draft | — |
| SCN-135 | Launch through the fallback order: an open session first, otherwise the next coding agent that can start | Settings | P-01 | FLW-40 | draft | — |
| SCN-136 | Create an ecosystem agent | Start paths | P-01 | ST-050, FLW-73 | draft | — |
| SCN-137 | A coding agent opened outside Fabric starts working in a project | Hub | P-01 | ST-045, FLW-77 | draft | — |
| SCN-138 | Set up the family's own agents first — Project Observatory, then Fabric Dashboards — in the Setup console | First run | P-01 | ST-045, ST-001, FLW-78, FLW-79 | draft | — |
| SCN-139 | Set up a family product's MCP with any coding agent, and see Fabric verify it | Setup | P-01 | ST-045, FLW-79 | draft | — |
| SCN-140 | Agents ask Fabric who is working on what, claim their task, are warned of related work, and release it | Coordination | P-01 | ST-030, ST-037, ST-045, FLW-80 | draft | — |
| SCN-141 | See where work is across every project — sessions, claims, review, and sessions with no project | Manager | P-01 | ST-004, ST-037, ST-030, FLW-81 | retired | — |
| SCN-142 | Open Fabric from a product's button, in that product's project, and go on in a coding agent | Manager | P-01 | ST-031, ST-045, FLW-82 | draft | — |
| SCN-143 | See what projects tell each other | Project communications | P-01 | FLW-83, SCR-81 | draft | unobserved |
| SCN-146 | A restored estate shows its project messages, and nothing in it acts | Project communications | P-01 | FLW-83, SCR-81 | draft | unobserved |
| SCN-144 | A project's request is answered by whichever agent holds its responder slot, and a replaced agent cannot finish it | Project communications | P-01 | FLW-84, SCR-81 | draft | unobserved |
| SCN-145 | The operator lets an agent answer a project's requests | Hub | P-01 | ST-045, FLW-85, SCR-76 | draft | unobserved |
| SCN-147 | See who answers each request and how it ended, and settle one nobody can | Project communications | P-01 | FLW-83, SCR-81 | draft | unobserved |
| SCN-148 | The owner pauses and resumes a thread, a project's answering or one responder slot | Project communications | P-01 | FLW-91, SCR-81, SCR-82, SCR-76 | draft | unobserved |
| SCN-149 | The owner lists or unlists a project for other projects, after seeing what they would see | Project communications | P-01 | FLW-92, SCR-83, SCR-52, SCR-76 | draft | unobserved |
| SCN-156 | Search what projects have told each other | Project communications | P-01 | FLW-83, SCR-81 | draft | unobserved |
| SCN-157 | See what waits for a project | Project communications | P-01 | FLW-83, SCR-81 | draft | unobserved |
| SCN-158 | See on the home who is doing what, in plain words | Home | P-01 | ST-037, FLW-21, SCR-30 | draft | unobserved |
| SCN-159 | Open a project and see where it came from, where it is and where it goes | Projects | P-01 | ST-032, FLW-21, SCR-31 | draft | unobserved |
| SCN-160 | See which coding agents this computer runs, and set how it behaves | Settings | P-01 | FLW-40, SCR-52 | draft | unobserved |
| SCN-161 | Fabric opens while its stack is still starting | Startup | P-01 | ST-033, FLW-21, SCR-30 | draft | unobserved |
| SCN-162 | Move between the five places and the projects from the rail | Shell | P-01 | ST-032, ST-037, FLW-93, SCR-84 | implemented | unobserved |
| SCN-163 | See on Главная what needs me, what is being done now, and my projects | Home | P-01 | ST-037, ST-044, ST-032, FLW-94, SCR-85 | implemented | unobserved |
| SCN-164 | Answer a question in plain words with one press, and take the answer back | Questions | P-01 | ST-044, ST-030, FLW-94, SCR-85, SCR-86, SCR-88 | draft | unobserved |
| SCN-165 | Open a project and steer it from one page | Projects | P-01 | ST-032, ST-034, ST-030, FLW-95, SCR-86 | implemented | unobserved |
| SCN-166 | See every agent and open its console in one press | Agents | P-01 | ST-037, ST-041, ST-050, FLW-96, SCR-87 | implemented | unobserved |
| SCN-167 | A coding agent opened outside Fabric is let in, and the person disconnects it with one press | Agents | P-01 | ST-045, FLW-96, SCR-87, SCR-88 | draft | unobserved |
| SCN-168 | Read every act in История — who did it, when and to what | History | P-01 | ST-033, ST-034, FLW-97, SCR-88 | implemented | unobserved |
| SCN-169 | Undo an act, or read why it cannot be undone | History | P-01 | ST-033, FLW-97, SCR-88 | draft | unobserved |
| SCN-170 | Set how Fabric behaves in Настройки | Settings | P-01 | FLW-40, SCR-89 | implemented | unobserved |
| SCN-171 | Start something new from «Создать» — a project, an agent, or a projects folder | Start paths | P-01 | ST-001, ST-050, FLW-98, SCR-90 | implemented | unobserved |
| SCN-172 | Keep several consoles open as tabs along the top and switch between them | Shell | P-01 | ST-032, ST-037, FLW-93, FLW-96, SCR-84, SCR-87 | implemented | unobserved |
| SCN-173 | See all the work as a board and follow a task through its stages | Board | P-01 | ST-037, FLW-99, SCR-41 | implemented | unobserved |
| SCN-174 | Open a task and read what it is, why, and what will be ready | Task | P-01 | ST-037, FLW-100, SCR-32 | implemented | unobserved |
| SCN-175 | See how a project is connected to the others on a graph | Projects | P-01 | ST-037, SCR-40 | implemented | unobserved |
| SCN-176 | A task starts only once its spec is whole, gathered by questions | Task | P-01 | ST-037, SCR-32 | implemented | unobserved |
| SCN-177 | Work another project's agent should do crosses by the machine's trust | Board | P-01 | ST-037, SCR-41 | implemented | unobserved |
| SCN-178 | See which projects have not answered an announcement | Project communications | P-01 | FLW-83, SCR-81 | implemented | unobserved |

## Telemetry — stated once, because no scenario should assert it separately

**No telemetry emitter exists in v1.** Every `Telemetry:` line below names the event a
surface *would* emit; what actually exists is the Event Journal, and the journal event
named in each scenario's steps is the real record. Audited 2026-08-31 (AUD-A08 / B10 /
028): treat these lines as planned instrumentation, not as shipped behaviour.

## Personas

Personas are defined in `foundation.md`; this scenario set uses P-01 Estate operator,
P-02 Organization owner/team admin, P-03 Member/specialist and P-04 Provider builder.

## Projects

### SCN-001: Create a project from a starter
- **Persona:** P-01
- **Feature:** Projects
- **Traces:** ST-001, FLW-01 (JTBD-01, JRN-01/#1..6)
- **Entry point:** SCR-01 Create project action or project-list empty state
- **Preconditions:** operator is authenticated; no project with the same identity exists
- **Steps:**
  1. Operator starts project creation -> SCR-02 asks for name, purpose and starter and previews every seeded agent/routine.
  2. Operator supplies a purpose and selects Software product -> the preview recommends a PM role plus optional Developer and QA without making them permanent types.
  3. Operator selects owned assets and continues -> SCR-06 offers existing estate connections without exposing credentials.
  4. Operator reviews scope, agents, bindings and routines -> the system displays planned changes, current readiness and effect ceilings.
  5. Operator saves reviewed setup -> one Project identity and its producer-owned revision return. Managed activation separately requires one admitted PM and current scope/capability evidence; cancelling activation keeps the saved Project.
- **Expected result:** one persistent Project exists independently of any goal; saved setup and managed activation are distinct, and only managed activation promises an admitted PM.
- **Alt paths:** Empty starter may save purpose with explicit unconfigured PM/executor; cancelling before Save creates no Project, cancelling later setup preserves the saved Project. Recommendations create no grants or runnable bindings.
- **UI elements:** Create project button; name and purpose fields; starter radios; scope selectors; connection resource selectors; review; Save project; Set up managed operation; Activate when ready.
- **States covered:** empty, loading, error, success
- **Errors & recovery:** missing input or scope shows an inline error and preserves the draft; admission/binding failure blocks activation and links to the failed gate; save failure retains the entire draft for retry.
- **Telemetry:** `project_creation_completed` with template_ref, seeded_agent_count, connection_binding_count
- **Status:** validated
- **Coverage:** none yet — project creation is built (`apps/desktop/src/renderer/src/Onboarding.tsx`), the STARTER it describes is not: nothing offers a template to create from
- **Product:** unobserved

### SCN-002: Create a portfolio observer
- **Persona:** P-01
- **Feature:** Projects
- **Traces:** ST-001, FLW-01 (JTBD-01, JRN-01/#1..6)
- **Entry point:** SCR-01 Create project
- **Preconditions:** at least one managed project exists
- **Steps:**
  1. Operator chooses Portfolio observer starter -> SCR-02 previews PM, observer/analyst agents and reporting routines.
  2. Operator selects All current and future projects -> SCR-12 explains that the dynamic selector grants read visibility, not ownership or effects.
  3. Operator binds Cloudflare and Google resources read-only -> SCR-06 shows account subjects, resource selectors and eligible observer agents.
  4. Operator activates -> Portfolio Observer appears as an ordinary project card with repository and production health marked not-configured.
- **Expected result:** an ordinary Project targets all current/future projects and has no implied write authority over them.
- **Alt paths:** All current freezes the current project set; Selected requires at least one project or asset.
- **UI elements:** starter radio; scope mode radios; resource selectors; eligible-agent checkboxes; Activate.
- **States covered:** empty, error, success
- **Errors & recovery:** dynamic scope without operator confirmation remains blocked; an effect-level connection binding is rejected unless a specific grant exists.
- **Telemetry:** `project_creation_completed` with template_ref=portfolio-observer, scope_mode
- **Status:** validated
- **Coverage:** none yet — an observer that watches across projects needs a producer other than the operator (M20), which is unscheduled
- **Product:** unobserved

## Agents

### SCN-003: Add or replace an admitted agent
- **Persona:** P-01
- **Feature:** Agents
- **Traces:** ST-002, ST-006, FLW-02 (JTBD-01, JRN-01/#5)
- **Entry point:** SCR-04 Add agent or Replace
- **Preconditions:** project exists; provider has a passing capability-scoped admission
- **Steps:**
  1. Operator chooses a role/capability -> SCR-05 lists compatible providers and distinguishes discovery from admission.
  2. Operator selects a provider -> terminal/runtime, binding revision, account pool and available grants are shown.
  3. Operator narrows grants and reviews affected routines -> future assignments and unchanged historical runs are explicit.
  4. Operator saves -> a new project configuration revision binds the agent and SCR-04 shows it.
- **Expected result:** the project gains the agent capability; existing runs remain pinned and routines retain their identities and schedules.
- **Alt paths:** replacing the PM requires an atomic one-for-one successor; disabling an optional agent leaves its routines waiting for an eligible provider.
- **UI elements:** role search; provider card; Use provider; grant controls; routine mapping; Create revision.
- **States covered:** loading, empty, error, success
- **Errors & recovery:** a grant above project ceiling is blocked; revision conflict shows the newer diff and asks the operator to reapply the draft.
- **Telemetry:** `project_agent_binding_created` with role, profile_kind, replaced_binding
- **Status:** validated
- **Coverage:** none yet
- **Product:** unobserved

### SCN-004: Provider cannot be bound
- **Persona:** P-01
- **Feature:** Agents
- **Traces:** ST-002, FLW-02 (JTBD-01, JRN-01/#5)
- **Entry point:** SCR-05 provider result
- **Preconditions:** a provider is discovered but its declaration, identity, protocol or semantic admission gate is missing/failed
- **Steps:**
  1. Operator opens the provider -> the failed and unverified gates are shown independently.
  2. Operator attempts to use it -> project binding is refused before credentials or project data are supplied.
  3. Operator opens adaptation instructions or selects another admitted provider -> the project draft remains intact.
- **Expected result:** no project access is created and no discovered provider is presented as compatible merely because it exists.
- **UI elements:** provider card; gate table; Use provider disabled control with reason; adaptation link; Back.
- **States covered:** empty, error, success
- **Errors & recovery:** registry unavailable is separate from admission failure; retry registry or complete the named Fabric compatibility gate.
- **Telemetry:** `project_agent_binding_refused` with failed_gate, provider_revision
- **Status:** validated
- **Coverage:** none yet
- **Product:** unobserved

## Connections

### SCN-005: Connect and scope an external account
- **Persona:** P-01
- **Feature:** Connections
- **Traces:** ST-003, FLW-03 (JTBD-01, JRN-01/#3..4)
- **Entry point:** SCR-06 Connect or reuse account
- **Preconditions:** project and eligible agent binding exist
- **Steps:**
  1. Operator chooses an existing connection or starts provider OAuth -> SCR-07 names the provider and preserves the project context.
  2. Provider returns an account subject -> operator confirms it before resource discovery continues.
  3. Operator selects resources, read/draft/effect ceiling and eligible project agents -> SCR-07 shows the complete binding review without any token value.
  4. Operator saves -> SCR-06 displays the project connection binding and its health.
- **Expected result:** one estate connection is reused through a narrower versioned project binding and secret values never enter project configuration.
- **Alt paths:** unexpected account disconnects the candidate; OAuth denial returns to the same project draft; an existing account bypasses OAuth but not resource review.
- **UI elements:** existing connection list; OAuth action; account subject; resource selectors; access radios; agent checkboxes; Bind selected resources.
- **States covered:** loading, empty, error, success
- **Errors & recovery:** OAuth expiry offers retry; no selected resource/agent blocks save; removed resource marks only that binding stale and offers reselection.
- **Telemetry:** `project_connection_binding_created` with provider, resource_count, access_ceiling
- **Status:** validated
- **Coverage:** none yet
- **Product:** unobserved

## Monitoring

### SCN-006: Scan all project cards
- **Persona:** P-01
- **Feature:** Monitoring
- **Traces:** ST-004, FLW-04 (JTBD-02, JRN-02/#1)
- **Entry point:** application start at SCR-01
- **Preconditions:** one or more projects exist
- **Steps:**
  1. Estate projection loads -> cards retain stable positions and show projection timestamp.
  2. Operator compares attention, execution, connection, production, repository and freshness dimensions -> each value exposes an observation or trace receipt.
  3. Operator reviews PM, agent counts, active work, last/next run and last report -> absent repository/production is shown as not-configured rather than failed.
- **Expected result:** the operator can identify which project and dimension needs attention without accepting an unsupported composite status.
- **Alt paths:** filters narrow projects without changing counts; no projects shows the creation empty state.
- **UI elements:** search/filter; project cards; health dimensions; attention count; last/next run links; Create project.
- **States covered:** loading, empty, error, success
- **Errors & recovery:** projector failure keeps last data as stale with retry; one source failure affects only its dimension.
- **Telemetry:** `estate_projects_viewed` with project_count, attention_total, stale_dimension_count
- **Amended 2026-10-11 (UXAC01-REQ-004, UXAC02-REQ-007):** what is waiting is one reading for every card, said once above them rather than as a chip on each. A source that refused, or a refusal window that was cut, keeps the counts that did arrive and says "Part of what needs you did not arrive: {reason}. The counts below are real and are not totals." A read that answered nothing says "What needs you could not be read: {reason}. The cards below carry no counts — that is missing, not zero." and the cards show no counts. A complete read adds nothing, and a read not yet made shows nothing rather than a zero (`apps/desktop/src/shared/attention.ts#waitingProblem`, `apps/desktop/src/shared/attention.ts#waitingCounts`, `apps/desktop/src/renderer/src/EstateHome.tsx#EstateHome`, checked by `apps/desktop/src/renderer/src/attentionHonesty.test.tsx`).
- **Status:** validated
- **Coverage:** none yet
- **Product:** unobserved

### SCN-007: Open an affected project from attention
- **Persona:** P-01
- **Feature:** Monitoring
- **Traces:** ST-004, ST-005, FLW-04 (JTBD-02, JRN-02/#1..3)
- **Entry point:** SCR-01 attention dimension or notification deep link
- **Preconditions:** project has an attention item linked to a receipt/run
- **Steps:**
  1. Operator opens the project -> SCR-03 keeps the selected failing dimension and receipt in context.
  2. Operator compares active work, connections, reports and next routines -> unrelated sections remain available if one source fails.
  3. Operator opens the responsible run -> SCR-09 leads with typed result, proof and notVerified before transcript.
- **Expected result:** the source of attention is traceable from estate card to project and exact run/observation.
- **UI elements:** attention indicator; project link; health receipt; run link; report link.
- **States covered:** loading, error, success
- **Errors & recovery:** a missing receipt is displayed as unverified with refresh/trace recovery, never replaced by an agent conclusion.
- **Alt paths:** a refused act in the queue offers Allow once. The button is busy while the grant is issued, then says
  "Allowed once, until {time}" and offers nothing more. The refusal leaves the queue and the project card's
  count because the grant resolves it: a grant, or a later allowing decision, for the same floor class and
  target, in that project or estate-wide. Repeated refusals of one act are one item, dated from the first.
  A failed grant is said and the button comes back. A refusal made after the grant (the grant expired unused,
  or was spent) is open again. On the Board the granted row stays in the detail after it leaves the queue,
  marked Allowed once with its "until" in the app's language, without Waiting or Next time, until the person
  closes it or picks another (0.3.2 verification UX-3, UX-4).
- **Telemetry:** `attention_item_opened` with project_id, dimension, receipt_kind
- **Amended 2026-10-11 (UXAC02-REQ-007):** every surface that lists what needs the person — the home's board, the project page and the Board — says a partial read the same way: "Part of this could not be read ({sources}), so this list is incomplete.", naming each source that did not answer, while the items that did answer stay listed and actionable; a read that failed outright says "The board could not be read: {reason}" and lists nothing as clear. Every source consulted is named in the receipts, answered or not, so one refusal cannot hide the projects it did not touch (`apps/desktop/src/shared/attention.ts#obligationReceipts`, `apps/desktop/src/renderer/src/launch/BoardScreen.tsx`, `apps/desktop/src/renderer/src/launch/HomeParts.tsx`, `apps/desktop/src/renderer/src/launch/ProjectLaunch.tsx`). The project card's count follows SCN-006's reading.
- **Status:** validated
- **Coverage:** `apps/desktop/src/shared/attention.ts`, `apps/desktop/src/renderer/src/launch/ObligationActs.tsx`, `apps/desktop/src/shared/attention.test.ts`, `apps/desktop/src/renderer/src/launch/ObligationActs.test.tsx`
- **Product:** unobserved

## Runs

### SCN-008: Inspect and recover a run
- **Persona:** P-01
- **Feature:** Runs
- **Traces:** ST-005, FLW-04 (JTBD-02, JRN-02/#2..4)
- **Entry point:** SCR-08 run row or deep link
- **Preconditions:** run exists in running, waiting or terminal state
- **Steps:**
  1. Operator opens the run -> SCR-09 shows pinned project/routine/agent/provider revisions and monotonic trace state.
  2. Operator reviews done, proof, scope, notVerified, artifacts and checker verdict -> partial artifacts remain available on failure/cancel.
  3. Operator selects an available retry, pause or cancel -> the action preview names target and required grant.
  4. Operator confirms an authorised action -> a new attempt/event is recorded without mutating the old trace.
- **Expected result:** the operator understands what became true and performs at most one authorised recovery action.
- **Alt paths:** return without action; request a grant; open the terminal trace only after the typed result.
- **UI elements:** event timeline; revision links; result tabs; artifacts; retry/pause/cancel; approval/grant dialog.
- **States covered:** loading, error, success
- **Errors & recovery:** reconnect resumes from monotonic event id; unauthorised action preserves the run and opens approval; retry exhaustion returns best partial result.
- **Telemetry:** `run_recovery_requested` with run_status, action, authorised
- **Status:** validated
- **Coverage:** none yet
- **Product:** unobserved

### SCN-009: Replace an agent without moving its routine
- **Persona:** P-01
- **Feature:** Runs
- **Traces:** ST-006, FLW-02, FLW-04 (JTBD-01, JTBD-02, JRN-01/#5, JRN-02/#2)
- **Entry point:** SCR-04 Replace agent or SCR-08 routine assignment
- **Preconditions:** routine has past runs and one preferred agent binding
- **Steps:**
  1. Operator selects a replacement admitted provider -> affected routines and future resolution are previewed.
  2. Operator creates a new project revision -> the routine id, trigger, concurrency and catch-up remain unchanged.
  3. Next tick fires -> its run pins the new project/agent/provider revision.
  4. Operator opens an old run -> it still names the previous revisions and artifacts.
- **Expected result:** schedule and history survive provider replacement; only future runs use the successor binding.
- **UI elements:** Replace; provider selector; affected-routines table; revision diff; next-run and old-run links.
- **States covered:** loading, error, success
- **Errors & recovery:** no eligible replacement leaves the routine waiting/disabled with a named reason; active run is never rebound.
- **Telemetry:** `project_agent_binding_replaced` with affected_routine_count, active_run_count
- **Status:** validated
- **Coverage:** none yet
- **Product:** unobserved

## Cross-project findings

### SCN-010: Observer submits a proposal
- **Persona:** P-01
- **Feature:** Cross-project findings
- **Traces:** ST-007, FLW-05 (JTBD-03, JRN-02/#3..4)
- **Entry point:** SCR-10 finding produced by an observer routine
- **Preconditions:** source project can read the target project/asset; finding has observations and a target PM
- **Steps:**
  1. Operator or source PM opens the finding -> source, target, requested outcome, evidence freshness and unverified surfaces are visible.
  2. Source PM submits -> an immutable idempotent Proposal appears in the target project's attention queue.
  3. Source project report links to the pending target resolution -> no target goal/node is created yet.
- **Expected result:** evidence crosses the project boundary as a proposal, not a direct graph or memory write.
- **Alt paths:** duplicate idempotency key returns the existing proposal; stale evidence requests refresh before submission.
- **UI elements:** finding row; source/target labels; evidence; Submit proposal; Refresh evidence.
- **States covered:** loading, empty, error, success
- **Errors & recovery:** target missing/retired or PM unavailable leaves the finding unresolved with a recoverable routing error.
- **Telemetry:** `cross_project_proposal_submitted` with source_project, target_project, finding_id
- **Status:** validated
- **Coverage:** none yet
- **Product:** unobserved

### SCN-011: Target PM resolves a proposal once
- **Persona:** P-01
- **Feature:** Cross-project findings
- **Traces:** ST-007, FLW-05 (JTBD-03, JRN-02/#4..5)
- **Entry point:** target project's attention queue or proposal notification
- **Preconditions:** unresolved proposal targets this project and has retrievable evidence
- **Steps:**
  1. Operator opens SCR-11 -> target context, source, requested outcome and evidence are displayed.
  2. Operator accepts, refuses or supersedes -> the system previews the exact resolution and any target PM goal creation.
  3. Operator confirms -> one append-only resolution is stored and both project views link to it.
- **Expected result:** target project retains decomposition authority and the same proposal cannot produce duplicate work.
- **Alt paths:** acceptance asks target PM to create its own goal/graph; refusal records reason; supersede links a replacement proposal/goal.
- **UI elements:** evidence; Accept; Refuse; Supersede; Request refresh; resolution preview.
- **States covered:** loading, error, success
- **Errors & recovery:** already-resolved proposal shows the existing resolution and disables duplicate action; stale evidence blocks resolution until refreshed.
- **Telemetry:** `cross_project_proposal_resolved` with resolution, source_project, target_project
- **Amended 2026-09-10 (UX28-12):** the Errors & recovery line — "already-resolved proposal shows the existing resolution and disables
  duplicate action" — is now KEPT, and it was the half that was silently broken rather than merely unbuilt. `proposals.decide` has carried the
  checker's receipt since M168 (a reason code, a remedy, and whether retrying could ever work), and `AttentionPanel` called it as
  `void … .catch(onError)` — so the four `ok: false` returns that never throw reached nobody, and a refused acceptance looked exactly like a
  successful one. The panel now keeps the answer keyed by the proposal it was about, names the task an acceptance created, shows the refusal
  with its remedy, and stops offering an act it has already taken — without waiting for the projection to drop the row, because
  read-your-own-write through a projector is not immediate. Steps 1–3 stay UNBUILT and are not claimed: SCR-11 does not exist, nothing previews
  a resolution before it is committed, `supersede` is not among the product's declared decisions (`accepted`, `declined` only), and no
  cross-project view links to a resolution. The scenario is AHEAD of the code here rather than stale — the first card of this cycle where the
  right answer was neither "fix the code" nor "fix the document", but "keep both and say which half is which".
- **Amended 2026-10-11 (UXAC03-REQ-007) — the workspace half:** each workspace act on the estate home says what it did, at the action, outside the question's own banner (which disappears once answered). Adopting says "Adopted: {projects} project(s) and {agents} agent binding(s) came in, keeping their own ids."; a refused adoption says "That workspace was not adopted: {reason}."; a folder written without version control says "The folder is written and it is NOT under version control: {reason}. …"; an act that threw says "That did not go through: {reason}. Look at the answer above before trying again." and the state is read again. A closed dialog says nothing, and a folder that became a repository needs no sentence because the question goes away (`apps/desktop/src/shared/workspaceAct.ts#saidOfAdopt`, `apps/desktop/src/shared/workspaceAct.ts#saidOfChoose`, `apps/desktop/src/shared/workspaceAct.ts#saidOfThrow`, checked by `apps/desktop/src/shared/workspaceAct.test.ts` and `apps/desktop/src/renderer/src/workspaceHonesty.test.tsx`).
- **Status:** validated
- **Coverage:** the resolve-once half only — `apps/desktop/src/main/commands/proposalCommands.ts`, `apps/desktop/src/shared/proposals.ts`, `apps/desktop/src/renderer/src/launch/ObligationActs.tsx`, `apps/desktop/src/renderer/src/launch/BoardScreen.test.tsx`, `apps/desktop/src/shared/proposals.test.ts`. NOT covered: SCR-11, the resolution preview of step 2, `supersede`, and the cross-project links of step 3.
- **Product:** unobserved

## Memory

### SCN-012: Promote memory through an accepted artifact
- **Persona:** P-01
- **Feature:** Memory
- **Traces:** ST-007, FLW-05 (JTBD-03, JRN-02/#4..5)
- **Entry point:** accepted proposal, report or project-memory item
- **Preconditions:** item has evidence, provenance, confidence and target scope; policy allows reviewed promotion
- **Steps:**
  1. Operator reviews the candidate -> source project, run, evidence, contradictions, confidence and expiry/decay are visible.
  2. Operator chooses Estate knowledge or target-project transfer -> the policy explains the new owner and required acceptance.
  3. Operator confirms -> a new promoted record is created with a back-link; the source memory item is unchanged.
- **Expected result:** no project writes another project's memory directly and every promoted fact retains provenance.
- **Alt paths:** target-project transfer remains pending until target PM acceptance; promotion can be refused without deleting source memory.
- **UI elements:** memory candidate; evidence/provenance; target selector; Promote; Refuse; acceptance state.
- **States covered:** loading, error, success
- **Errors & recovery:** missing evidence/confidence blocks promotion; contradictory estate knowledge requires explicit supersession rather than overwrite.
- **Telemetry:** `memory_promotion_resolved` with destination, resolution, confidence_band
- **Status:** validated
- **Coverage:** none yet
- **Product:** unobserved

## Membership and role work

### SCN-013: Join an estate with explicit roles
- **Persona:** P-03
- **Feature:** Membership
- **Traces:** ST-008, FLW-06 (JTBD-04, JRN-03/#1..2)
- **Entry point:** membership invitation deep link
- **Preconditions:** invitation is unexpired; inviter is an owner; person is authenticated
- **Steps:**
  1. Member opens the invitation -> SCR-14 names the estate, inviter, roles, visible projects, allowed action classes and explicit exclusions.
  2. Member accepts -> membership is recorded with the reviewed revision and SCR-13 opens in the granted role.
  3. Member switches role/project -> SCR-13 recomputes its projection and removes context not authorized in the new selection.
- **Expected result:** the person joins with informed, attributable scope and receives no credential or implicit access outside the declared roles.
- **Alt paths:** decline creates no membership; changed scope requires a fresh review; expired/revoked invitation cannot be accepted.
- **UI elements:** estate/inviter identity; role list; project visibility; action/exclusion summary; Accept; Decline.
- **States covered:** loading, error, success
- **Errors & recovery:** expired or changed invitation offers refresh/contact-owner; partial acceptance is not silently inferred.
- **Telemetry:** `membership_invitation_resolved` with resolution, role_count, project_scope_kind
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-014: Resolve an interaction from a role workspace
- **Persona:** P-03
- **Feature:** Role work
- **Traces:** ST-009, FLW-06 (JTBD-04, JRN-03/#2..5)
- **Entry point:** SCR-13 queue row or notification deep link
- **Preconditions:** unresolved interaction point addresses a role held by the member
- **Steps:**
  1. Member opens the item -> SCR-14 shows kind, requester, project, typed payload, evidence freshness, SLA/escalation and allowed resolutions.
  2. Member writes a response, attaches an artifact or selects an approval -> the system previews any external effect and the policy/grant that would authorize it.
  3. Member confirms -> one append-only resolution records actor and policy revision; an allowed effect runs through the estate connection and attaches its receipt.
  4. SCR-13 removes the resolved item and exposes the receipt/history.
- **Expected result:** one human contribution closes or advances the interaction without duplicate effects or unrelated estate exposure.
- **Alt paths:** delegable item can be served by the member's admitted automation under canary; non-delegable item hides that path; member may escalate/request context.
- **UI elements:** queue; SLA; evidence; response/artifact controls; Delegate when allowed; effect preview; Submit resolution.
- **States covered:** loading, empty, error, success
- **Errors & recovery:** already-resolved item opens the existing receipt; denied effect preserves the draft and requests a grant; stale evidence requests refresh.
- **Telemetry:** `interaction_point_resolved` with kind, role, delegated, effect_class, sla_state
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

## Agent foundry

### SCN-015: Adapt an existing repository into a provider
*(Amended 2026-10-03 by [ADR-0100](../adr/0100-first-run-and-start-paths.md) §6: converting an agent runs inside Fabric with a dry-run plan, an adapter on a branch and the conformance probe — SCN-131; the recipe model below remains the documented manual fallback.)*
- **Persona:** P-04
- **Feature:** Agent foundry
- **Traces:** ST-010, FLW-07 (JTBD-05, JRN-04/#1..4)
- **Entry point:** SCR-05 no-provider state or SCR-15 Adapt existing
- **Preconditions:** user can access the source repository; capability/consumer is named
- **Steps:**
  1. Builder chooses Adapt existing, source/profile and capability -> SCR-15 resolves pinned contract, adapter and skill-pack revisions.
  2. Builder generates and copies the recipe -> it states checksum, expiry, dry-run requirement, expected outputs and that it carries no estate credential.
  3. Coding agent inspects the repository and emits a change plan -> builder accepts, narrows or cancels before writes.
  4. Coding agent applies the minimal adapter and runs fixtures -> a provider bundle, diff and local validation report are produced.
  5. Builder returns the report -> SCR-16 runs independent conformance against the exact revision.
- **Expected result:** the existing project remains architecturally owned by its author and produces a reproducible provider bundle or a precise failed gate.
- **Alt paths:** unsupported surface proposes an HTTP/MCP/A2A/local adapter without rewriting business code; rerunning the recipe is idempotent.
- **UI elements:** Adapt/Create; capability; source/profile; version/checksum panel; Copy recipe; report upload; conformance gates.
- **States covered:** loading, error, success
- **Errors & recovery:** integrity mismatch or unreviewed change plan stops before writes; local failure preserves report and offers a regenerated fix recipe.
- **Telemetry:** `agent_bootstrap_completed` with intent=adapt, profile, local_result, changed_file_count
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-016: Create and admit a new provider
- **Persona:** P-01, P-04
- **Feature:** Agent foundry
- **Traces:** ST-011, FLW-07 (JTBD-05, JRN-04/#1..5)
- **Entry point:** SCR-15 Create new or an agent-production project
- **Preconditions:** named project/routine consumer and capability exist or vocabulary change is approved
- **Steps:**
  1. Builder chooses Create and a transport profile -> SCR-15 previews scaffold, required fixtures and lifecycle.
  2. Copied recipe creates the provider project/bundle and runs local golden/planted fixtures.
  3. SCR-16 independently checks identity/provenance, shape, protocol, semantics and declared effects for the exact revision.
  4. Owner reviews requested capability, view, cost and effect surfaces and admits the revision at the initial tier.
  5. Owner optionally opens SCR-05 and creates a separate project binding with scope, ceiling, budget and mandatory checker canary.
- **Expected result:** exact provider revision is admitted; no project access exists until the separate binding is saved; canary/promotion history remains attached to the revision/binding.
- **Alt paths:** admit now and bind later; reject with reason; new revision repeats conformance rather than mutating admission.
- **UI elements:** profile/scaffold preview; fixture results; gate table; Admit exact revision; Reject; Bind with canary.
- **States covered:** loading, empty, error, success
- **Errors & recovery:** a passing local report cannot override failed independent conformance; binding ceiling/budget failures preserve admission and return to setup.
- **Telemetry:** `provider_revision_admitted` with profile, capability_count, initial_tier, bind_now
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-017: Bootstrap or conformance fails safely
- **Persona:** P-04
- **Feature:** Agent foundry
- **Traces:** ST-010, ST-011, FLW-07 (JTBD-05, JRN-04/#2..5)
- **Entry point:** SCR-15 recipe/report state or SCR-16 failed gate
- **Preconditions:** bootstrap or independent conformance did not complete successfully
- **Steps:**
  1. Builder opens failure -> exact phase, gate, inputs, logs/receipt and files changed so far are shown.
  2. System distinguishes integrity/auth expiry, local adaptation, contract shape, protocol and semantic failure.
  3. Builder rolls back generated changes, edits manually or generates a fix recipe pinned to the same target contract.
  4. Builder reruns -> existing passing receipts are reused only when their inputs/checksums are unchanged.
- **Expected result:** no admission, binding, credential or partial hidden installation exists; recovery preserves user code and evidence.
- **UI elements:** phase/gate list; changed-file report; Roll back generated changes; Regenerate fix recipe; Retry; Open docs.
- **States covered:** loading, error, success
- **Errors & recovery:** cleanup failure lists remaining generated paths without deleting user-owned files; expired short-lived exchange can be reissued without changing the recipe target.
- **Telemetry:** `agent_bootstrap_failed` with phase, gate, recovery_selected
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

## Workspace composition

### SCN-018: Add a provider view to a role workspace
- **Persona:** P-02
- **Feature:** Workspace
- **Traces:** ST-012, FLW-08 (JTBD-06, JRN-03/#2..4)
- **Entry point:** SCR-17 Add view or admitted-provider detail
- **Preconditions:** provider revision is admitted; view declares a structured fallback and requested data/tools
- **Steps:**
  1. Owner selects target estate/project/role and provider view -> SCR-17 shows provenance, requested data/tool scope and fallback.
  2. Owner narrows eligible roles/context, selects an admitted grid span and places the view without overlap.
  3. Owner sets/reviews the canonical keyboard and reading order, then previews narrow linearization, extension unavailable and permission-denied states.
  4. Owner publishes -> a new layout revision is stored and SCR-13 renders the sandboxed view or structured fallback for eligible members.
- **Expected result:** the role gains a useful interface while PassionCode.ai retains layout, permission, accessibility and action authority.
- **Alt paths:** remove/reorder/resize within admitted spans creates another revision; unavailable extension uses fallback; revoked provider removes interactive rendering but preserves canonical work/evidence; a spatial canvas is not offered in this editor.
- **UI elements:** view catalog; provenance; scope controls; constrained grid surface; span presets; canonical-order controls; responsive/accessibility preview; Publish layout revision.
- **States covered:** loading, empty, error, success
- **Errors & recovery:** missing fallback, overbroad scope, overlap, invalid span, focus-order failure or unadmitted revision blocks publish, identifies the tile and offers the nearest valid placement/order.
- **Telemetry:** `workspace_layout_published` with role, view_count, provider_view_count, fallback_count
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

## Closed operating loops

### SCN-019: Resolve a customer request with human fallback
- **Persona:** P-02, P-03
- **Feature:** Support
- **Traces:** ST-013, FLW-09 (JTBD-07, JRN-03/#2..5)
- **Entry point:** inbound mailbox/chat event or SCR-18 Support inbox
- **Preconditions:** estate connection is healthy; support project owns the channel; customer identity/context policy is available
- **Steps:**
  1. Inbound event is normalized and deduplicated -> SCR-18 shows one request with source receipt, customer/account and SLA.
  2. Support provider retrieves authorized knowledge and proposes/executes a response inside its ceiling -> independent policy/checker result attaches to the request.
  3. If sensitive, uncertain or effect-bearing, one typed interaction appears in the support role workspace -> SCR-14 shows the minimal context and allowed paths.
  4. Member resolves or approves -> response is sent through the estate connection under the recorded policy/grant.
  5. Delivery/effect receipt is observed -> SCR-18 resolves the request and links any product defect proposal to its target PM.
- **Expected result:** the customer receives one attributable response; unresolved or sensitive work has one human owner; product work crosses as a proposal rather than a direct backlog mutation.
- **Alt paths:** safe FAQ closes agent-only; failed delivery remains open for retry/reconciliation; duplicate event returns the existing request.
- **UI elements:** support queue; source/customer/SLA; knowledge/evidence; draft; interaction; effect preview; send and receipt.
- **States covered:** loading, empty, error, success
- **Errors & recovery:** identity ambiguity requests human selection without merging customers; missing knowledge blocks confident answer; expired grant preserves response draft.
- **Telemetry:** `support_request_resolved` with path, interaction_required, delivery_result, defect_proposed
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-020: Turn a production signal into a verified release
- **Persona:** P-01
- **Feature:** Reliability
- **Traces:** ST-014, FLW-10 (JTBD-02, JTBD-07, JRN-02/#1..5)
- **Entry point:** SCR-10 sourced crash/log/synthetic finding or incident notification
- **Preconditions:** asset has an owning project; finding includes observation receipt and routing key
- **Steps:**
  1. Rule-first routing sends the finding to the owning project's PM -> source/target and evidence remain immutable.
  2. PM accepts and creates a new graph revision -> SCR-19 shows reproduce, diagnose, implement, test, review, release and monitor nodes with named payload edges.
  3. Developer and QA providers execute in isolated workspaces -> typed results and independent checker verdicts gate each dependent node.
  4. Release step previews target and production effect -> valid grant or non-delegable owner approval is required.
  5. Release receipt starts monitoring -> incident closes only when a new observation proves recovery; regression creates a new attempt/graph rather than rewriting history.
- **Expected result:** source signal, accepted work, code/test evidence, authorization, release receipt and recovery observation form one trace.
- **Alt paths:** refused/superseded finding records resolution; irreproducible issue remains open with `notVerified`; rollback is a new effect and receipt.
- **UI elements:** finding; graph; node result/checker; release target/grant; effect receipt; monitor observation; retry/rollback.
- **States covered:** loading, error, success
- **Errors & recovery:** checker rejection returns to its producer without advancing; unavailable policy fails closed at release; monitor timeout leaves incident unresolved.
- **Telemetry:** `incident_lifecycle_completed` with source_kind, graph_attempts, release_result, recovery_observed
- **Status:** draft
- **Coverage:** none yet
- **Amended 2026-09-29 (ADR-0084, launch-releases):** steps 4–5's release receipt now has a record of its own: a person records a release with what went in (tasks) and why (decisions), and its verification — accepted or failed, with the receipt — as a second record; a rollback is a new release naming the one it replaces, and the old record is kept as it was (`record_release`, `verify_release`, migration 69; `apps/desktop/test/releases-db.test.mjs`, `launch/ReleasesScreen.test.tsx`). Not yet: the graph, the grant preview at the release step and the monitoring that closes the incident; the status and coverage above are unchanged.
- **Product:** unobserved

### SCN-021: Research, validate, publish and measure content
- **Persona:** P-02, P-03
- **Feature:** Growth
- **Traces:** ST-015, FLW-11 (JTBD-07, JRN-02/#3..5)
- **Entry point:** scheduled research routine, SEO finding or SCR-20 manual brief
- **Preconditions:** declared research sources and target project facts exist; channel connection is scoped
- **Steps:**
  1. Research provider produces sourced, fresh topic artifacts -> SCR-20 shows relevance and evidence, not generated posts.
  2. Owner/marketing role accepts a topic -> writer/SMM providers create channel-specific drafts from approved facts.
  3. Independent editorial, SEO and channel checkers validate claims, search intent, duplication and channel constraints -> rejected artifacts return with stored verdicts.
  4. Publisher/owner reviews public identity, account, timing and effect -> publication proceeds only under the applicable grant/interaction.
  5. Channel receipts attach to artifacts; analytics and Search Console collectors create subsequent observations -> the next research routine and any technical SEO proposal cite them.
- **Expected result:** every public artifact is sourced, independently checked, authorized, receipted and connected to its measured feedback.
- **Alt paths:** Reddit opportunity may produce a helpful reply draft rather than a post; technical SEO finding routes to target PM; stale source requires refresh before approval.
- **UI elements:** topic/source; audience/channel; drafts; checker verdicts; identity/account/schedule; approval/grant; receipts; measurement.
- **States covered:** loading, empty, error, success
- **Errors & recovery:** no channel identity or expired grant blocks publication but preserves approved draft; API failure reconciles before retry to prevent duplicate posts.
- **Telemetry:** `content_cycle_advanced` with channel, stage, checker_result, publication_result, measurement_received
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-022: Create and connect scoped MCP access
- **Persona:** P-01, P-02
- **Feature:** External control
- **Traces:** ST-016, FLW-12 (JTBD-08, JRN-05/#1..3)
- **Entry point:** SCR-21 MCP access empty state or Create access action
- **Preconditions:** authenticated Estate owner; at least one visible Project; remote MCP endpoint available
- **Steps:**
  1. Owner starts Create access -> SCR-22 requires an explicit Project set, resource/command scopes, effect ceiling and expiry.
  2. Owner reviews effective access and excluded Projects -> the review names that future Projects are not included and starting a Run does not grant its Effects.
  3. Owner creates the binding -> the credential and copy-ready client configuration appear once; the stored detail immediately replaces the secret with credential id/fingerprint.
  4. Owner adds the configuration to an external MCP client -> discovery returns only tools/resources authorized by the binding.
  5. Fabric records the successful connection/discovery with credential id, principal, Project set, protocol and policy revision but never the raw value.
- **Expected result:** the external client is connected through one immutable, expiring Project-scoped binding and no owner session or downstream credential was shared.
- **Alt paths:** local Fabric uses an equivalent loopback/stdio binding; rotation creates a new credential while retaining binding/audit lineage; connection test can be retried without re-revealing the old secret.
- **UI elements:** Project selector; resource/command scopes; effect ceiling; expiry; excluded-Project preview; one-time reveal; client configuration; fingerprint; test receipt.
- **States covered:** loading, empty, error, success, one-time-reveal
- **Errors & recovery:** missing scope/expiry blocks issuance; failed discovery identifies transport/auth/version/scope layer; a lost one-time value is rotated, never recovered.
- **Telemetry:** `mcp_access_created` with binding_id, project_count, scope_count, expiry_class; no credential value
- **Status:** draft
- **Coverage:** `apps/desktop/src/main/sessionBundle.ts`, `apps/desktop/src/shared/servers.ts`, `apps/desktop/src/shared/servers.test.ts`
- **Product:** unobserved

### SCN-023: External agent participates within its MCP scope
- **Persona:** P-01, P-02
- **Feature:** External control
- **Traces:** ST-016, FLW-12 (JTBD-08, JRN-05/#3..4)
- **Entry point:** connected external MCP client or SCR-22 connection test
- **Preconditions:** active unexpired credential; binding includes the target Project and operation
- **Steps:**
  1. Client lists or reads Project resources -> only authorized projections appear with revision, freshness and receipts.
  2. Client submits an Artifact/Proposal/Interaction response or calls `fabric_run_start` with typed input and an idempotency key -> Fabric rechecks Project, scope and policy.
  3. Allowed command is appended to the Event Journal -> the response returns one command/Artifact/Proposal/WorkflowRun identity, not an untracked success string.
  4. Long work returns an MCP Task when negotiated or a Fabric WorkflowRun/resource handle -> the client disconnects and resumes the same identity by polling.
  5. SCR-22 and SCR-09 show the initiating credential id, principal, policy receipt, Project and outcome; the worker receives only its normal WorkflowRun bundle.
- **Expected result:** the external agent participates through the same Project, policy, journal, checker and durable WorkflowRun lifecycle as an internal request.
- **Alt paths:** duplicate idempotency key with identical arguments returns the original receipt; submitted work may await checker/PM acceptance; input-required resumes through the task/interaction contract.
- **UI elements:** authorized resource/tool list; projection freshness; command/Run receipt; task status; audit filters; linked Run detail.
- **States covered:** loading, error, success
- **Errors & recovery:** dropped connection resumes by Task/Run id; conflicting idempotency reuse is rejected; failed/cancelled Run preserves partial evidence and current state.
- **Telemetry:** `mcp_control_call_completed` with binding_id, project_id, operation, policy_outcome, durable_handle_kind, result
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-024: MCP access is denied or revoked safely
- **Persona:** P-01, P-02
- **Feature:** External control
- **Traces:** ST-016, FLW-12 (JTBD-08, JRN-05/#4..5)
- **Entry point:** out-of-scope client call, expired credential or Revoke access on SCR-22
- **Preconditions:** binding exists; caller attempts an excluded Project/scope or owner is authorized to revoke
- **Steps:**
  1. Client requests an excluded Resource URI or changes `projectId` in a tool call -> ingress and policy checks deny before any read or journal mutation.
  2. Owner opens SCR-22 -> detail shows last use, active Runs and exactly what revocation stops.
  3. Owner selects Revoke access and confirms -> new discovery, reads and commands fail; private caches are invalidated.
  4. If an admitted Run exists, Fabric keeps its immutable history and shows that revocation did not claim cancellation -> owner may request explicit Run cancellation if scoped.
  5. Any later Effect re-authorizes under current Project policy -> expired/revoked/indeterminate authority never grants it.
- **Expected result:** excluded or revoked access produces no unauthorized read/mutation, while existing Run state remains truthful and separately controllable.
- **Alt paths:** rotation overlaps old/new credentials only for a declared grace window; policy outage is indeterminate and fails closed; stale projection is visible only under an unexpired visibility lease and clearly marked stale.
- **UI elements:** denial receipt; last use; active Runs; Revoke access confirmation; revocation receipt; explicit cancel action; policy diagnostics safe summary.
- **States covered:** error, success, revoked
- **Errors & recovery:** failed revocation leaves old status visible and offers retry; cancellation request reports cooperative/current state rather than “cancelled” until proven.
- **Telemetry:** `mcp_access_denied_or_revoked` with binding_id, reason, project_id_if_authorized_to_log, active_run_count, revocation_result
- **Status:** draft
- **Coverage:** `apps/desktop/src/main/agentSurface.ts`, `apps/desktop/test/agent-surface.test.mjs`
- **Product:** unobserved

## Terminal

### SCN-025: Work in a project's hosted terminal
- **Persona:** P-01
- **Feature:** Terminal
- **Traces:** ST-017, FLW-13 (JTBD-02, JRN-02/#1)
- **Amended 2026-08-31:** sessions are launched from the project's Agents section and open in
  their own window (SCN-029); this scenario keeps the session's own behaviour — live, typeable,
  reattaching. The earlier tab-per-terminal entry point is superseded by the project tab bar.
- **Entry point:** SCR-03 Agents section launcher; agent tile on the project home
- **Preconditions:** project exists with a bound repository path; the pinned Claude Code binary resolves
- **Steps:**
  1. Operator opens the project's Agents section -> the empty state explains that a session opens in its own window, and the launcher names the directory it will start in.
  2. Operator starts the session -> a real PTY spawns in the project cwd, `terminal.opened` is journalled, the prompt is typeable.
  3. Operator works interactively -> output streams live; the session is the agent's actual session, not a transcript.
  4. Operator closes the session window and reopens it from its tile -> SCR-25 reattaches to the running PTY with scrollback intact.
  5. Operator ends the session -> `terminal.closed` is journalled; from slice 2 the transcript is captured as an artifact.
- **Expected result:** the session is the one the agent actually runs in, typeable and reattachable, and its lifecycle exists as journal events with receipts. It lives in its own window so the project panel stays readable behind it.
- **Alt paths:** a project may hold several sessions at once, each with its own window and tile.
- **UI elements:** terminal viewport; Start session; End session; session status; tab per project.
- **States covered:** empty, loading, error, success, reattached
- **Errors & recovery:** spawn failure names the cwd and binary checked and offers retry without journalling an open; a killed PTY marks the tab ended, never silently blank.
- **Amended 2026-10-06 (audit A2-001):** resizing the window of an ended session is a no-op on both sides — the view does not send it, and `PtyManager.resize` returns unless the session is running — rather than an `ioctl EBADF` throw inside a raw listener.
- **Telemetry:** `terminal_session_opened` with project_id, cwd_bound, reattach:boolean — no keystroke content, no transcript body
- **Amended 2026-10-11 (UXAC04-REQ-008):** while a read refuses, the session window says which of four things it is. Before any answer, a refused read says "This session could not be read: {reason}. That says nothing about the session itself — it is about the read."; with the terminal already on screen, a refused refresh keeps it and says "This reading is not current: {reason}. What is below is the last answer, not the latest one."; a session the estate no longer has says "This session is gone. You can close the window."; the next read that answers clears the caveat, and an answer for another session or a closed window is dropped (`apps/desktop/src/shared/sessionReading.ts#sessionSays`, `apps/desktop/src/renderer/src/SessionWindow.tsx#SessionWindow`, checked by `apps/desktop/src/renderer/src/SessionWindow.test.tsx` and `apps/desktop/src/shared/sessionReading.test.ts`).
- **Status:** draft
- **Coverage:** `apps/desktop/src/main/pty.ts`, `apps/desktop/src/renderer/src/SessionWindow.tsx`, `apps/desktop/test/pty-launch-failure.test.mjs` (PtyManager's launch, its refusals and its journalling), `apps/desktop/test/scrollback.test.mjs` (reattach to the retained output); `apps/desktop/test/pty.test.mjs` only echoes through raw node-pty
- **Product:** unobserved

## Monitoring

### SCN-026: Follow the estate through the journal feed
- **Persona:** P-01
- **Feature:** Monitoring
- **Traces:** ST-004, FLW-04 (JTBD-02, JRN-02/#1)
- **Entry point:** SCR-01 activity feed panel
- **Preconditions:** at least one journalled event exists
- **Steps:**
  1. Operator opens the estate home -> the feed replays from the journal table from the last seen id (never from the live stream alone).
  2. A new event lands -> Realtime wakes the feed and the missing range is read from the table, in order, without gaps.
  3. Operator READS a row -> it says what happened in a sentence ("a task note became project memory"), never the event type identifier. The raw type stays reachable as the row's title for anyone debugging, and nowhere else.
  4. Operator opens a feed row -> it links to its receipt: the project, run or terminal event that produced it.
  5. Operator disconnects and reconnects -> the feed resumes from the last seen id with nothing skipped.
- **Expected result:** the feed is a view over the durable trace (ADR-0027); every fact opens its receipt, and every row is legible to the person being asked to check it. A receipt nobody can read is not a receipt.
- **Alt paths:** filter by project; jump from a feed row to the run detail.
- **UI elements:** feed list; per-event sentence; per-event receipt link; project filter; unread marker from last seen id.
- **States covered:** empty, loading, error, success
- **Errors & recovery:** a Realtime outage degrades to on-demand replay with a stale banner; the feed never invents order — it shows the table's. An event with no sentence falls back to the RAW TYPE and never to the lookup key: a missing key renders as itself, and `event.task.moved@1` on screen is the identifier plus a prefix that means nothing.
- **Telemetry:** `feed_replayed` with from_seq, event_count, reconnect:boolean
- **Amended 2026-10-11 (UXAC02-REQ-007):** the feed is its own read, apart from what is waiting. Before it is read it says "reading the journal…", never "The journal is empty"; a partial reading of what is waiting is said once above the project cards (SCN-006), not inside the feed; and a read position that cannot be used is said above the feed instead of marking anything read (`apps/desktop/src/renderer/src/Feed.tsx`, `apps/desktop/src/renderer/src/EstateHome.tsx#EstateHome`).
- **Status:** retired
- **Retired 2026-10-17 (0.3.7 wave 1, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** the live feed is cut (0.3.7 plan §5); every act, with its actor and its «Отменить», is read in История (SCN-168).
- **Coverage:** step 3 and its fallback — `apps/desktop/src/renderer/src/Feed.test.tsx`; every registered event type has a sentence, both directions — `scripts/check-design.mjs`. Replay, ordering and reconnection (steps 1, 2, 5): none yet
- **Product:** unobserved

## Autonomy

### SCN-027: Approve, refuse or watch the floor refuse
- **Persona:** P-01
- **Feature:** Autonomy
- **Traces:** ST-018, FLW-14 (JTBD-02, JRN-02/#2)
- **Entry point:** SCR-24 queue badge; run detail blocked state
- **Preconditions:** a node asked a question the fabric may not answer itself (ADR-0007), or a floored action was attempted
- **Steps:**
  1. A node blocks on `canUseTool` -> `node.asked` is journalled and the queue badge increments.
  2. Operator opens the item -> SCR-24 shows the node, its goal's autonomy level, the requested action class and the evidence.
  3. Operator approves -> a one-shot grant is issued where the action is floored, the appropriate answer/grant receipt is journalled; addressed continuation resumes only after separate admission and acknowledgement, with the execution snapshot kept distinct from a verification checkpoint.
  4. Alternatively the operator refuses -> the refusal is recorded with a reason and the node fails resumable.
  5. A floored action with no grant never waits -> it appears in the refusals section with its receipt, already denied by the schema constraint.
- **Expected result:** escalation is the exception and every resolution carries a receipt; nothing floored happens silently and nothing floored defaults open.
- **Alt paths:** the question times out (default 30 min) -> `escalation_expired`, the node is resumable and the item stays visible as expired.
- **UI elements:** queue ordered by wait/SLA; item detail; Approve issuing a one-shot grant; Refuse with reason; receipts; refusals section.
- **States covered:** empty, loading, error, success
- **Errors & recovery:** a resolution that fails to persist retries without double-resuming the node (idempotent by question id); policy `indeterminate` is shown as a denial with diagnostics, never as pending.
- **Telemetry:** `question_resolved` with question_id, verdict, action_class, waited_seconds, floored:boolean — no payload content
- **Amended 2026-10-11 (UXAC02-REQ-007):** the queue this scenario names is, in the product today, the Board's list of what needs the person. A partial read says "Part of this could not be read ({sources}), so this list is incomplete." above the list; a failed read says "The board could not be read: {reason}"; neither is ever shown as an empty, clear queue (`apps/desktop/src/renderer/src/launch/BoardScreen.tsx`, `apps/desktop/src/renderer/src/launch/BoardScreen.test.tsx`). The escalation itself stays unbuilt, as Coverage says.
- **Status:** draft
- **Coverage:** `apps/desktop/src/main/policy.ts`, `apps/desktop/src/renderer/src/launch/ObligationActs.tsx`, `apps/desktop/test/policy.test.mjs` — the grant policy and the attention acts only. The escalation itself is not built: no blocking `canUseTool`, no `node.asked@1`, no Refuse-with-reason that fails a node as resumable, no 30-minute expiry, no resume after a grant (audit 2026-10-05 A2-005, CO-217 in `docs/evidence/specs/2026-08-16-software-fabric-carryover.md`).
- **Product:** unobserved


## Projects

### SCN-028: Open a project as a tab and configure it
- **Persona:** P-01
- **Feature:** Projects
- **Traces:** ST-001, ST-019, FLW-15 (JTBD-01, JTBD-02)
- **Entry point:** SCR-01 estate home project card; the tab bar
- **Preconditions:** at least one project exists, or the empty state offers creation
- **Steps:**
  1. Operator opens the estate home with no projects -> the empty state explains what a project is and offers creation inline.
  2. Operator creates a project -> `project.created@1` is journalled, the card appears from the projection and the project opens as a tab.
  3. Operator opens Settings on the project header -> name and purpose become editable in place. The repository is ATTACHED through the system picker, never typed: a path an operator types is a path nobody opened, and the file boundary is the root that was opened rather than a string that resembles one.
  4. Operator saves -> `project.configured@1` is journalled ONCE for every field the panel owns, the configuration revision becomes the sequence of that event, and the header shows the new values.
  5. Operator closes the tab -> the project remains; reopening it from the estate home restores the same view.
- **Expected result:** projects are browser-like tabs over persistent workspaces; every configuration change is an event with a revision, not a silent mutation.
- **Alt paths:** creating with only a name is valid; a project with no repository attached leaves sessions defaulting to the home directory, and a repository is removed by DETACHING it rather than by clearing a field.
- **UI elements:** tab bar with home, project tabs and close controls; project header; Settings; Save revision.
- **States covered:** empty, loading, error, success
- **Errors & recovery:** an empty name blocks the save with the draft preserved; a failed append surfaces the error banner and leaves the header unchanged.
- **Telemetry:** `project_updated` with project_id, fields_changed, config_revision
- **Amended 2026-09-10 (UX28-15):** step 3 and the alt path described a freely typed repository path, and THE CODE WAS RIGHT — this is the
  inverse of the seven findings before it. `ProjectHome.tsx` renders `repo_path` as text and a repository is attached through
  `repos.choose()` and `repos.attach`, which is the opened-root boundary the product has enforced all along. The scenario was the stale
  side, and UX28-11's exclusion ("no arbitrary direct repository-path setting that bypasses opened-root boundary") is a rule the product
  already keeps. Corrected here rather than in UX28-11, because UX28-11 declares this card as its execution dependency and would
  otherwise have had to guess the reconciliation or make it twice.
- **Amended 2026-09-10 (UX28-11):** step 4 named `project.updated@1` and said the revision "increments" — and BOTH halves were stale. The panel
  sent two commands for one press (`projects.update`, then conditionally `projects.updateSettings`), so one save produced two revisions and a
  failure of the second reported a half-saved project as untouched — the opposite of this scenario's own Errors & recovery, which has always
  promised that "a failed append surfaces the error banner and leaves the header unchanged". It is now one append of `project.configured@1`
  against the revision the operator typed at, refused before the journal if the base moved. And a revision does not increment: since
  `supabase/migrations/20260908000037_deterministic_config_revision.sql` it IS the sequence of the event that set it, which is what makes a
  rebuilt estate reproduce it. The word "increments" is how a later reader ends up writing `revision + 1`.
- **Status:** draft
- **Amended 2026-10-17 (0.3.7 wave 1, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** the tab strip goes (0.3.7 plan §2, §5): a project opens in the main area from the rail's list (SCN-162). Its name and purpose save as the person leaves the field — no revision banner; a conflict is settled by the later write and both writes are in История with «Отменить» (SCN-165, SCN-169).
- **Coverage:** `apps/desktop/src/renderer/src/ProjectHome.tsx`, `apps/desktop/src/renderer/src/App.tsx`, `apps/desktop/test/file-roots.test.mjs`, `apps/desktop/src/shared/projectSettings.ts`, `apps/desktop/src/main/commands/projectSettingsCommand.ts`, `apps/desktop/src/renderer/src/ProjectHeader.test.tsx`, `apps/desktop/test/project-settings.test.mjs`, `supabase/migrations/20260910000059_project_configured.sql`
- **Product:** unobserved

## Agents

### SCN-029: Launch an agent and open its session window
- **Persona:** P-01
- **Feature:** Agents
- **Traces:** ST-017, ST-020, FLW-16 (JTBD-02)
- **Entry point:** SCR-03 Agents section
- **Preconditions:** the project is open as a tab; at least one launch option is available
- **Steps:**
  1. Operator picks a launch option -> the selector lists what can hold a session today (an agent session, or a plain terminal), marking anything unavailable on this machine.
  2. Operator launches -> a PTY starts in the project's directory, `terminal.opened@1` is journalled with the chosen option, and the session opens in its own window.
  3. Operator returns to the project tab -> the session appears as a tile in the agents grid with its state, last activity and the last line of output.
  4. Operator clicks the tile -> the existing session window is focused rather than a second one opened.
  5. Operator closes the session window -> the session keeps running and the tile stays live; ending it from the tile journals `terminal.closed@1`.
- **Expected result:** agents are sessions with a visible short status on the project page and a full terminal in their own window; closing a window is not ending work.
- **Alt paths:** a launch option whose binary is missing is disabled with the reason; a project with no repository path starts the session in the home directory.
- **UI elements:** launch selector; Launch; agent tiles with state badge, tail and uptime; tile close; session window header.
- **States covered:** empty, loading, error, success
- **Errors & recovery:** a spawn failure names the program and directory and journals nothing as opened; an ended session remains as a dismissible tile with its exit code.
- **Telemetry:** `agent_session_launched` with project_id, option_id, cwd_bound — no keystrokes, no output body
- **Status:** draft
- **Coverage:** `apps/desktop/src/main/pty.ts`, `apps/desktop/src/shared/agents.ts`, `apps/desktop/src/shared/agents.test.ts`
- **Product:** unobserved

## Workspace

### SCN-030: Read the project workspace canvas
- **Persona:** P-01
- **Feature:** Workspace
- **Traces:** ST-021, FLW-17 (JTBD-02, JTBD-06)
- **Entry point:** SCR-03 Workspace panel -> Open canvas
- **Preconditions:** the project is open as a tab
- **Steps:**
  1. Operator opens the canvas -> a constrained grid renders host-generated widgets: the agents running here, recent project activity, and the results slot.
  2. Operator reads a widget -> every fact traces to its projection; nothing is asserted without a source.
  3. Operator returns to the project home -> the canvas keeps its layout revision; nothing about the visit is destructive.
- **Expected result:** the workspace exists as a slot layout the operator can read today and providers can render into later, without the layout moving when they do.
- **Alt paths:** with nothing running, every widget shows its own empty state rather than an empty page.
- **UI elements:** canvas grid; widget frames with tier label; back to project.
- **States covered:** empty, success
- **Errors & recovery:** a widget whose projection is unavailable states that its evidence is stale instead of rendering zero as a fact.
- **Telemetry:** `workspace_opened` with project_id, widget_count, layout_revision
- **Status:** retired
- **Retired 2026-10-17 (0.3.7 wave 1, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** the project's workspace canvas is cut (0.3.7 plan §5); what was on it — the agents here, recent activity, results — is the project page (SCN-165) and История (SCN-168).
- **Coverage:** none yet
- **Product:** unobserved


### SCN-031: Onboard a project in a new tab
- **Architecture boundary (ADR-0061):** saving setup may leave PM/executor unconfigured; no fake provider, grant or enabled routine is created. Managed activation has its own admitted-PM gate; manual capabilities retain their actual gates.
- **Persona:** P-01
- **Feature:** Projects
- **Traces:** ST-001, ST-022, FLW-18 (JTBD-01)
- **Entry point:** the tab bar's new-tab action; the estate home's empty state
- **Preconditions:** none — this is the first thing a new operator sees
- **Steps:**
  1. Operator opens the application with nothing created -> the estate home explains what a project is and offers to create the first one.
  2. Operator opens a new tab -> the tab IS the onboarding form, and no Project is committed until Create; started drafts are saved locally.
  3. Operator names the project and gives it a purpose -> both are plain fields, no identifier and no URL.
  4. Operator chooses repositories through the system folder picker -> chosen folders are listed, the first is marked primary, and any of them can be removed before saving.
  5. Operator chooses where memory is stored -> local is available and cloud states why it is not.
  6. Operator chooses the default agent -> the list marks anything unavailable on this machine.
  7. Operator saves -> `project.created@1` and one `project.repo.attached@1` per repository are journalled, and the same tab becomes the project's home.
- **Expected result:** onboarding is an addressable draft; an unsaved draft creates no business Project. A saved Project exposes its purpose and explicit setup state, including deferred PM/executor. Native store/IPC evidence remains separate from target prototype behavior.
- **Alt paths:** a second new tab opens a second independent draft; closing a changed draft requires the existing discard choice. Restored and newly opened drafts retain different IDs and stable future Project IDs; named drafts show their own names in the tab strip. First installation can save its first local draft without an existing drafts file.
- **UI elements:** name; purpose; repository list with picker and remove; memory choice with reasons; default-agent selector; Create project; Cancel.
- **States covered:** empty, loading, error, partial, stale, conflict, denied, unknown, success
- **Errors & recovery:** an empty name blocks the save with the draft preserved; a failed append leaves the draft editable and shows the error. Late hydration merges saved drafts with current typing without switching away from the new draft; no save runs before hydration. An unreadable file is not replaced by defaults or new typing. Its saved working-set references remain intact while hydration is pending or storage is unreadable; an unreadable draft is not evidence that its subject was deleted. A recovered last-good copy is explicitly reported before reopening its drafts. New input stays editable without prematurely replacing the saved tabs.
- **Target refinement · AD03 (2026-09-17):** `onboarding` and `launch-start` are aliases of one creation state addressed by Estate + draft ID. Global add, empty Estate, optional persona save/skip and Help resume converge on that state; new draft is an explicit action. Resolve Estate before retrieving the draft. Existing Project Help resumes that exact Project, not a creation draft.
- **Target click contract:** source → name/expected result → frozen review → one Project result. Executor, starter/stages and observer scope are optional disclosures; no mandatory provider/account/avatar step. Changing fields invalidates review. Pending/unknown requests keep the original reviewed payload and identity for reconciliation; a changed payload under that identity refuses.
- **Target source/duplicate contract:** idea has effective source none before duplicate lookup, review and create. A previously typed repo can remain in draft input for toggling back but does not become a source/target of the idea. Repository duplicates are scoped to the same Estate; archived gives exact recovery, purged is not resurrected. Folder selection is explicit and partial/denied/cancelled scan cannot silently create candidates.
- **Target recovery:** two drafts/two Estates stay separate; Help retains exact draft and step; cancel retains the addressed page-local draft, discard affects only that draft. Loading/denied/conflict/partial/unknown states cannot silently create or accept unreviewed data. A lost page-local example is labelled expired, never replaced with Atlas history. Mockup clicks do not prove native restart durability (AD02/04).
- **Telemetry:** `project_onboarded` with repo_count, memory_backend, default_agent
- **Status:** draft
- **Amended 2026-10-17 (0.3.7 wave 1, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** «Создать» replaces the tab-per-draft start (SCN-171); closing a changed draft discards it at once, no question, and История offers «Восстановить» for it (SCN-169).
- **Coverage:** `apps/desktop/src/renderer/src/Onboarding.tsx`
- **Product:** unobserved

### SCN-032: Ask for work and watch what it opened
- **Amended 2026-09-01 (M43):** a task whose session cannot be accounted for — the app was
  quit or crashed while it ran — now closes on the next start as **not accounted for**,
  with the reason, and never as *finished with code 0*. Before this it stayed *running*
  forever, which is a positive claim by an app that has no way to know.
- **Persona:** P-01
- **Feature:** Projects
- **Traces:** ST-023, ST-024, FLW-18 (JTBD-01, JTBD-02)
- **Amended 2026-08-31:** this scenario described a two-card kickoff block shown only while
  a project had never run anything. That block is gone: its meaning moved into the Task
  block, where the same starting instruction is a named preset. The properties it existed
  to protect survive and are checked below — the instruction is visible and editable
  before it is sent, and the choice is journalled.
- **Entry point:** the Task block on the project home
- **Preconditions:** the project exists and has a primary repository
- **Steps:**
  1. Operator writes what should happen, or picks a preset -> the instruction appears in
     the field in full and stays editable; a preset never sends anything by itself.
  1b. A preset that READS the project (M121) carries its count in the label — "Continue
     from the backlog (4)" — and hands the agent the items themselves, so the session does
     not open by rediscovering what Fabric already knows. It is offered only when its
     source has something in it: an offer that cannot be honoured is worse than no offer,
     and the board is where an empty backlog is stated. A list longer than eight is
     truncated **and says so**, with the true count kept, because a silently shortened list
     reads as the whole of it.
  2. Operator picks the agent -> the project's default is preselected and any option
     unavailable on this machine is disabled with its reason.
  3. Operator runs it -> `task.started@1` records the instruction, the agent and the
     preset it came from; a session opens in the primary repository and the instruction is
     typed into it once the program's prompt is up.
  4. The task appears under the field as running, with the time it started and a way into
     its session.
  5. The session ends -> `task.finished@1` records the exit code and the row shows how it
     ended; the instruction can be used again in one click.
- **Expected result:** asking for work is one field and one button; what was asked, who was
  asked and how it ended are all recoverable afterwards.
- **Alt paths:** a preset can be edited before running and is still recorded as that preset;
  a task with no repository bound starts in the home directory.
- **UI elements:** instruction field; agent selector; Run; preset buttons (constant, and
  data-backed ones carrying their count); task history rows with Open session and Use again.
- **Not offered, and why:** M121 also names "errors in production". Nothing in this product
  observes production yet (M129), so the shortcut is absent rather than opening a session to
  look at a signal we do not collect.
- **States covered:** empty, loading, error, success
- **Errors & recovery:** a spawn failure reports the program and directory and no task is
  recorded as started; an empty instruction cannot be run.
- **Telemetry:** `task_started` with option_id, preset, instruction_length — never the
  instruction body
- **Amended 2026-10-08 (0.3.3 onboarding, plan R3a):** the first shortcut is «Set up this project with the agent»: its instruction has the session read the repository, record what it learns in project memory with the file each fact came from, ask the owner to confirm a one-sentence purpose and whatever else it cannot decide, and file the next three pieces of work as tasks — with tools a connected session already holds, and changing no file. It fills the field like any shortcut; nothing runs until Run.
- **Status:** draft
- **Coverage:** `apps/desktop/src/renderer/src/Tasks.tsx`, `apps/desktop/src/shared/presets.ts`, `apps/desktop/src/renderer/src/Tasks.test.tsx`
- **Product:** unobserved

### SCN-033: Attach and detach repositories
- **Persona:** P-01
- **Feature:** Projects
- **Traces:** ST-022, FLW-18 (JTBD-01)
- **Entry point:** project home, repositories panel
- **Preconditions:** the project exists
- **Steps:**
  1. Operator opens the repositories panel -> attached repositories are listed with the primary marked.
  2. Operator adds one through the folder picker -> `project.repo.attached@1` is journalled and the file tree can be browsed from the primary.
  3. Operator removes the primary -> the next repository is promoted automatically and the project's working directory follows it.
  4. Operator removes the last repository -> the project keeps working; sessions fall back to the home directory and the file panel says what is missing.
  5. An agent commits or switches branch while the operator watches -> the strip follows within a moment, without the operator asking for it and without an agent running to move the feed.
- **Expected result:** a project holds a set of repositories, one of them primary, and the primary is derived rather than typed. What the strip says about them is current, not current-as-of-whenever-the-page-was-opened.
- **Alt paths:** attaching a folder already attached is a no-op rather than a duplicate. A file merely EDITED in the working tree touches nothing under `.git` and so is seen on the panel's own ten-second reading rather than instantly — the delay is bounded and stated, never silent.
- **UI elements:** repository rows with primary chip and remove; folder picker.
- **States covered:** empty, success, error
- **Errors & recovery:** an unreadable folder shows in the file panel as unreadable rather than as empty. A refresh that fails leaves the last good reading with its error carried, rather than blanking the strip or raising a banner every ten seconds.
- **Telemetry:** `project_repo_changed` with action, repo_count
- **Status:** draft
- **Amended 2026-10-17 (0.3.7 wave 1, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** removing a folder, the primary one included, happens at once with no `window.confirm` ([ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md) §1); the foot of the page says «Папка убрана · Отменить», and История adds it back (SCN-165, SCN-169). The folders live in «Папки проекта» on the one project page.
- **Coverage:** `apps/desktop/src/main/index.ts`, `apps/desktop/src/renderer/src/ProjectHome.tsx`, `apps/desktop/src/shared/repoWatch.ts`, `apps/desktop/src/renderer/src/EstateAgents.test.tsx`
- **Product:** unobserved


## Files

### SCN-034: Open a file and save it against an agent's edit
- **Persona:** P-01
- **Feature:** Files
- **Traces:** ST-025, FLW-19 (JTBD-02)
- **Entry point:** the Files tree on the project home
- **Preconditions:** the project has a primary repository
- **Steps:**
  1. Operator clicks a file -> it opens in its own window with syntax highlighting, and the
     content hash read at that moment is remembered.
  2. Operator edits -> the header marks the file unsaved; nothing is written yet.
  3. Operator saves while nothing else touched the file -> the file is written and the
     header marks it saved.
  4. An agent changes the same file while it is open, and the operator saves -> nothing is
     overwritten. A banner states what happened and the window shows a side-by-side diff of
     the version on disk against the operator's.
  5. Operator chooses: take the version on disk, or keep their own and save over it. Either
     choice is explicit; there is no third path where one silently wins. "Keep mine and save"
     overwrites exactly the disk version the diff showed: if an agent changed the file again
     after that, the diff comes back with the newer version instead of writing over it. When
     the banner appears the focus moves to its sentence, never to one of the two actions, so a
     keystroke typed as it appears decides nothing.
- **Expected result:** a file can be edited beside working agents without either side losing
  work by surprise.
- **Alt paths:** the file can be opened in the system editor instead; a file too large to
  open says so rather than hanging. A file that is not text (a NUL byte, or bytes that are not
  valid UTF-8 — an image, a PDF, an archive) opens read-only with a sentence saying so and
  Open in system editor; it has no Save and Fabric never writes it. Saving an untouched buffer
  writes nothing (except a file with a byte-order mark or mixed line endings, which the editor normalises: CO-221), and a save keeps the same editor, so what is typed while it is in flight stays
  in the buffer and stays marked unsaved; when that save comes back as a conflict, the person's side
  of the diff is the buffer, keystrokes typed during the save included. A second save while one is in
  flight does nothing. A file deleted on disk while open is said as deleted, not as changed: Close
  without saving, or Save it again, which creates it again only if nothing new appeared at that path
  (0.3.2 verification UX-5, UX-6, ER-5). Fabric quits, is stopped or crashes while the file has unsaved
  changes -> nothing waits and nothing is lost: the unsaved buffer was kept as the operator typed
  (ADR-0106), and the next time the file opens a banner says "Unsaved changes from {time} were kept"
  with Restore them / Discard them. When the file changed on disk since, restoring opens the same
  side-by-side diff as step 4, so the version on disk is never overwritten silently.
- **Boundary:** Fabric reads and writes only inside the folders the operator has opened —
  the repositories attached to a project, and anything chosen through the folder picker,
  because choosing a folder is the operator saying yes to it. A path outside all of them
  is refused with the reason, and so is a symlink inside a repository that points out of
  it. Detaching a repository closes it again. This is invisible in normal use: the tree
  only offers what is already open.
- **UI elements:** file rows in the tree; editor window with Save and Open in system editor;
  conflict banner with Take the version on disk / Keep mine and save; diff view; kept-changes banner
  with Restore them / Discard them.
- **States covered:** loading, success, unsaved, conflict, error, refused-outside-project, kept-changes
- **Errors & recovery:** an unreadable or oversized file reports why and the window can be
  closed; a failed write leaves the buffer intact and the file untouched; a path outside
  every open folder names the boundary rather than reporting a missing file, so the
  operator can attach the repository instead of hunting a phantom.
- **Telemetry:** `file_saved` with language, conflict:boolean, resolution — never file content
- **Status:** draft
- **Coverage:** `apps/desktop/src/main/files.ts`, `apps/desktop/src/renderer/src/EditorWindow.tsx`, `apps/desktop/test/files.test.mjs`, `apps/desktop/src/main/editorRecovery.ts`, `apps/desktop/test/editor-recovery.test.mjs`, `apps/desktop/src/renderer/src/EditorWindow.recovery.test.tsx`
- **Product:** unobserved


### SCN-035: Read what an agent says it is doing
- **Persona:** P-01
- **Feature:** Agents
- **Traces:** ST-026 (JTBD-02)
- **Entry point:** the Agents grid on the project home
- **Preconditions:** a session is running and its agent is connected to the agent surface
- **Steps:**
  0. The session starts -> Fabric compiles what the project already knows into a bounded, cited pack and hands it to the agent, recording exactly what went in. The agent starts informed rather than starting by guessing, and what it was told is recoverable afterwards.
  1. The agent reports its stage through Fabric's own tool -> the claim is journalled as the agent speaking, and the latest one is kept per session.
  2. Operator looks at the tile -> the stage appears under a label that says the agent said it, **followed by how long ago it said it**, above the output Fabric observed and the state Fabric measured.
  3. Operator compares -> an agent claiming to run tests while its session has produced nothing for ten minutes is visibly a claim against an observation, not one status contradicting itself. When the account falls more than two minutes behind the last thing Fabric saw, the age is marked: the agent is working and has stopped narrating, and that is worth seeing without arithmetic.
  4. A session launched as a plain terminal shows no claim at all, because nothing there speaks the protocol.
- **Expected result:** the operator can follow progress without reading a transcript, and can never mistake what an agent asserted for what the system measured.
- **Alt paths:** an agent that never reports shows only observation, which is the honest default rather than an error.
- **UI elements:** agent tile with the claim line, its label and its age; the observed state badge; the output tail.
- **States covered:** empty (no claim), success
- **Errors & recovery:** a claim always carries its age, so a three-hour-old account cannot sit unmarked beside a four-second-old measurement; the surface being down means sessions still run and simply cannot report.
- **Telemetry:** planned only — see the note at the top of this file; the journal event is the record.
- **Status:** draft
- **Amended 2026-10-14 (plain language):** the stage is what the operator reads on the home and the project page, so the harness asks for it as one plain sentence the project's owner understands without context, in their language — the work and its aim, never a file, a command or an internal id ("Делаем версию, в которой компьютер не засыпает, пока работает агент, и выкатываем"): `fabric_stage_report`'s `stage`, the `progress.report-stage` obligation, `fabric_task_brief`'s «what» (the task's summary) and a claimed task's title say so. The home reads the latest stage per session (`workRead.ts#readHome`).
- **Coverage:** `apps/desktop/src/main/agentSurface.ts`, `apps/desktop/src/shared/protocolObligations.ts`, `apps/desktop/src/main/workTools.ts`, `apps/desktop/src/renderer/src/ProjectHome.tsx`, `apps/desktop/src/renderer/src/AgentTile.test.tsx` (the claim's label, age and stale mark), `apps/desktop/test/work-claims-db.test.mjs` (the home reads the stage and the brief)
- **Product:** unobserved

### SCN-036: Read captured session history, including recovery after a crash
- **Persona:** P-01
- **Feature:** Agents
- **Traces:** ST-026 (JTBD-02)
- **Entry point:** Sessions recorded, on the project home; Memory source reference
- **Preconditions:** a session has a saved capture or a retained recovery spool
- **Steps:**
  1. Normal finalization retains sanitized output until a durable receipt. On restart, bounded background recovery retries retained captures automatically.
  2. Operator opens Sessions recorded -> one row per capture, ordered by recording sequence. A recovered partial record says its ending was not observed; recording time never substitutes for process end time.
  3. Operator reads the excerpt, then opens the admitted body and exact historical context. Truncation/redaction and missing source states stay explicit; private credentials are not reproduced as verbatim history.
  4. The digest says history was captured. Only independently observed end provenance permits the session-ended label. A legacy record is not upgraded to observed by inference.
  5. An agent searches permitted history or receives a newly compiled pack, with capture provenance. Reading evidence does not authorize continuation; Stop/fencing remains a separate gate.
- **Expected result:** known history survives the executor and app restart, with uncertainty preserved rather than invented success.
- **Alt paths:** proved empty capture has an explicit receipt; unknown ending keeps null end/exit; unavailable or corrupt evidence stays local for repair/retry. Historical @1 bytes and identities are unchanged.
- **UI elements:** compact history row, unknown-ending marker, excerpt, detailed source/coverage, exact past context, digest capture label.
- **States covered:** empty, loading, captured, partial recovery, legacy, unavailable
- **Errors & recovery:** lost reply retries the same command; mismatched receipt never deletes local evidence; current runtime generations remain owned by their pending finalizer. Background recovery never stops an agent or releases a writer lease.
- **Telemetry:** journal receipt records capture; no raw output in diagnostic logs.
- **Status:** draft
- **Amended 2026-10-17 (0.3.7 wave 1, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** the transcripts section of the project is cut (0.3.7 plan §5); a finished console's record opens from its act in История (SCN-168) and from the agent's view in Агенты (SCN-166).
- **Coverage:** `apps/desktop/src/main/transcriptRecovery.ts`, `apps/desktop/src/main/transcripts.ts`, `apps/desktop/src/renderer/src/ProjectHome.tsx`, migration 63; focused SQL/reader tests in harness packet. Native full walkthrough not yet accepted.
- **Product:** unobserved

### SCN-037: See who remembered something, and what memory could not answer
- **Persona:** P-01
- **Feature:** Memory
- **Traces:** ST-007 (JTBD-02)
- **Entry point:** the Memory panel and the statistics strip on the project home
- **Preconditions:** the project has been worked in
- **Steps:**
  1. Operator opens Memory -> every fact says who recorded it: the operator wrote it, or an agent reported it. Those are different kinds of evidence and the panel no longer makes them look the same.
  2. Operator reads a fact an agent recorded -> it is marked as that agent's account, so it can be weighed rather than believed.
  3. Operator finds a fact that has stopped being true -> they choose Correct this and write the replacement. The old fact is **not edited and not deleted**: it stops answering searches, is marked corrected, and stays readable behind a toggle, so the correction is reversible and the project can still say what it used to believe.
  4. Operator searches memory and finds nothing -> the search says nothing matches, and that search is counted.
  5. Operator looks at the MEMORY PANEL -> one line reads how many times memory was asked and had nothing, out of how many times it was asked at all. A project where nothing was ever asked and a project where nothing was ever found are different projects, and the rate is UNKNOWN for the first rather than nought per cent. (This step said "the strip" until 2026-09-10 — the amendment below removed those two cells in M112, and the step went on sending the reader to them.)
- **Expected result:** the operator can tell a fact they wrote from a fact an agent asserted, and can see whether memory is being used and whether it is answering — instead of inferring both from how full it looks.
- **Alt paths:** a fact recorded before this shipped shows its source as unrecorded rather than guessing; a project nobody has searched shows zero of zero rather than a flattering ratio.
- **Amended 2026-09-05 (M112):** this promised two cells on the statistics strip —
  "memory asked, nothing found" and "facts corrected since" — that M57 removed. Their
  strings sat in the registry unrendered until a check for dead rows found them, so the
  scenario had been describing a screen nobody could see for three weeks. **The counts
  themselves are not lost:** the memory surface (SCN-039, M135) shows retrievals and
  misses, which is where they belong — beside the store they are about rather than in a
  strip of unrelated numbers.
- **UI elements:** the Memory panel with a source marker per fact, a Correct this action, a corrected-since marker and a show/hide toggle. The two strip cells are gone; misses and corrections are on the memory surface.
- **States covered:** empty (nothing asked yet), success
- **Errors & recovery:** a retrieval that cannot be recorded never fails the search it was recording — the answer matters more than the bookkeeping, and the failure is logged.
- **Telemetry:** planned only — see the note at the top of this file; the journal event is the record.
- **Status:** draft
- **Coverage:** `apps/desktop/src/main/agentSurface.ts`, `apps/desktop/src/renderer/src/ProjectHome.tsx`, migrations 10 and 11
- **Product:** unobserved

### SCN-038: Evaluate the shift from vibe coding to passion coding
- **Persona:** P-05
- **Feature:** Public website
- **Traces:** ST-027, FLW-20 (JTBD-09, JRN-06/#1..5)
- **Entry point:** `passioncode.ai`, GitHub organization profile, repository social card or README
- **Preconditions:** none; the reader may know coding agents but not PassionCode.ai, Fabric or the category terms
- **Steps:**
  1. Reader opens the page -> SCR-29 leads with “From vibe coding to passion coding” and the primary positioning.
  2. Reader continues -> the page contrasts directing agents one by one with operating durable Projects without dismissing vibe coding as a starting point.
  3. Reader inspects the Project model -> purpose, team, Routines, authority, Evidence and learning appear as one persistent frame from zero to one.
  4. Reader checks the agent-agnostic claim -> the page distinguishes durable Agent roles from replaceable Providers and keeps people accountable.
  5. Reader checks availability -> the page states that the public surface and foundation exist while the hosted product is not publicly available.
  6. Reader chooses a CTA -> the GitHub organization opens, or the reader moves to the repository map on the same page.
- **Expected result:** the reader can explain the category transition, product/kernel boundary and present status without inferring autonomous operation or a public runtime.
- **Alt paths:** without CSS the semantic reading order and links remain complete; without images the wordmark and headings still identify the product; at narrow widths every comparison becomes a single column.
- **UI elements:** wordmark; category eyebrow; primary heading; two CTAs; transition comparison; Project operating frame; principles; repository map; current-status note; footer.
- **States covered:** success, image unavailable, narrow viewport, reduced motion
- **Errors & recovery:** a private or unavailable repository is labelled by role rather than offered as a download; no page function depends on a script or external API.
- **Telemetry:** none — no analytics or persistent state in v1
- **Amended 2026-09-10 (UX28-15):** two registers in this repository disagreed about this scenario and one of them had to give. It read
  `Status: implemented` while the board's own BL-017 records `passioncode.ai` answering HTTP 522 — Cloudflare unable to reach the origin,
  measured twice on 2026-08-25 and still `open`. The website may well be built; what this repository has no evidence for is that a reader
  can REACH it, which is what this scenario's expected result is about. So the status is `external` rather than `implemented`, and the card's
  choice between "inspect the owning external repo" and "explicitly block" is taken as the second: the subject lives in
  `passioncode-ai.github.io`, this tree cannot resolve a citation into another repository, and calling an unresolvable prose claim `Coverage`
  makes a register assert what it cannot check. S11 owns the rebranding decisions inside that repo; this row owns only the boundary.
- **Status:** draft
- **Coverage:** none from this repository — the subject is `passioncode-ai.github.io`, and a citation this tree cannot resolve is not a
  citation. The status is `draft` because that is what this REPOSITORY can say: the vocabulary is draft, validated, implemented or retired,
  and it has no token for "built and owned elsewhere", so the weakest true claim is the right one. It is not a statement that the website
  does not exist — it is a statement that nothing here proves it does. `external` was written here first and the linter refused it, which is
  the rule working: an unrecognised status reads as no status, and every rule keyed on one silently stops applying. The reachability of the
  address is tracked as BL-017 on the board, which is the one claim about it this estate CAN measure
- **Product:** unobserved

### SCN-039: See what this project remembers, and what it could not answer
- **Persona:** P-01
- **Feature:** Memory
- **Traces:** ST-028, FLW-21 (JTBD-02)
- **Entry point:** Memory, from the project page
- **Preconditions:** the project has been worked in at least once
- **Steps:**
  1. Operator opens Memory -> four stores are named on one surface: facts, session transcripts, context packs, retrievals. Each says what it holds, who wrote it and when it was last read.
  2. Operator reads the retrieval row -> hits and misses are counted separately. A miss says nobody wrote it down, not that the thing is untrue.
  3. Operator opens a store -> its rows carry their source, and an agent's account is marked as that agent's rather than shown beside the operator's as equal evidence.
  4. Operator finds a store that has never been read -> the surface says so plainly instead of showing a flattering total.
- **Expected result:** the project's knowledge is inspectable — the operator can say what is stored, who put it there, whether it is being used and whether it answers.
- **Alt paths:** a store that fails to read shows the failure and the age of the last successful read, never a stale number presented as current.
- **UI elements:** the Memory screen: one row per store with holds / written by / last read; a miss counter beside the hit counter; drill-in to each store.
- **States covered:** empty (a store with nothing in it), loading (before any store has been read), success, error (a store that will not read)
- **Errors & recovery:** a store that cannot be read never blanks the others; it reports its own failure in its own row. A store nobody has asked about says NOT READ, which is neither the empty answer nor the refusal; a count that came back without a number is not zero; and a reading that includes any unasked store is partial rather than whole.
- **Telemetry:** planned only; the journal event is the record.
- **Amended 2026-09-10 (UX28-07):** step 4 and the alt path above were right from the start and the code did not do them. A store nobody had asked about rendered the REFUSAL sentence with an empty reason, so "never read" read as "broken" — and the counts carried no age at all, so a figure was as old as whenever it was read and read as current. Both are now the count's own fields. Two more were found in the same eight lines and neither is in this scenario's text: the counts used the RAW database client with a hand-written project filter, bypassing the one place `scopeFilters` applies an estate filter — which is what turns an id from somewhere else into "no such project" — and `result.count ?? 0` turned a missing count header into zero. The read is extracted, so the bypass is unreachable rather than avoided: it receives a scoped store and nothing else. And the third state exposed a latent defect in `fullyRead`, which asked only whether a store had no PROBLEM and therefore called a never-read overview complete.
- **Named rather than implied:** "drill-in to each store" in the UI elements above is NOT built — two of six figures are pressable, and the panel says why the rest are not (CO-153). "Who wrote it" per store is not built either: the counts say what and when, not by whom.
- **Status:** draft
- **Coverage:** `apps/desktop/src/shared/memoryOverview.ts`, `apps/desktop/src/main/memoryOverviewRead.ts`, `apps/desktop/src/renderer/src/MemoryOverviewSection.tsx`, `apps/desktop/src/shared/memoryOverview.test.ts`, `apps/desktop/src/renderer/src/MemoryOverviewSection.test.tsx`, `apps/desktop/test/memory-overview-read.test.mjs`. `draft` rather than `built` because the drill-in this scenario's step 3 describes is CO-153 and unbuilt
- **Product:** unobserved

### SCN-040: Rejoin a project by reading its decisions
- **Persona:** P-01
- **Feature:** Memory
- **Traces:** ST-029, FLW-21 (JTBD-02)
- **Entry point:** the top of the project page, on open
- **Preconditions:** the project has journalled work behind it
- **Steps:**
  1. Operator opens a project they have not touched for days -> the first thing on the page is what was DECIDED, newest first, not what was typed.
  2. Operator reads a line -> it cites what it rests on: a journal event, a transcript, a recorded fact. The citation opens.
  3. Operator sees the digest's own age -> when it was compiled, so a stale summary cannot be mistaken for a current one.
  4. Operator asks for it again -> the CEO recompiles from the journal, and a line it can no longer support is dropped rather than carried forward.
- **Expected result:** the operator rejoins the work knowing why it stands where it does, without reading a transcript.
- **Alt paths:** a project with nothing journalled says there is nothing to summarise yet, rather than compiling an empty narrative; a line whose source has been superseded is shown as superseded, not silently removed.
- **UI elements:** the "where we left off" band at the top of the project page: decision, its age, its citation; a recompile action carrying the compiled-at time.
- **States covered:** empty (nothing journalled), loading, success
- **Errors & recovery:** a compile that fails leaves the previous digest visible WITH its age, and says the refresh failed — never a blank band.
- **Telemetry:** planned only.
- **Status:** draft
- **Amended 2026-10-17 (0.3.7 wave 1, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** the project's Decisions section is cut (0.3.7 plan §5); decisions are read in История under «Что: решения», filtered to the project (SCN-168).
- **Coverage:** `apps/desktop/src/shared/decisions.ts`, `apps/desktop/src/renderer/src/DecisionsSection.tsx`, `apps/desktop/src/shared/decisions.test.ts`
- **Product:** unobserved
- **Planned first-work extension:** Empty projects retain the same always-reachable create-idea/task control. Append failure retains the draft; successful append exposes its canonical task. S01; no existing task prerequisite.

### SCN-041: Work a board the agents keep current

R0 revision 2026-09-26: every Board ticket opens its own CEO conversation, pinned to the Project and ticket. User supplies intent in free conversation; Fabric produces a structured proposed outcome (decision, task, acceptance, next step). Read, discuss and close never resolve a ticket. Applying an outcome uses an idempotent command; launching work remains a separately admitted operation. Deferred/resolved tickets retain the conversation and may reopen. Plan entry uses CEO conversation rather than a mandatory task form. Project tabs own project navigation; the left rail contains sections only. Floating CEO launcher preserves identity, style selection, scope and sourced statistics. Mockup engineering controls are hidden in product mode and accessible in review mode.

- **Persona:** P-01
- **Feature:** Tasks
- **Traces:** ST-030, FLW-22 (JTBD-02, JTBD-07)
- **Entry point:** the project page
- **Preconditions:** the project has at least one task
- **Steps:**
  1. Operator looks at the board -> work sits in columns, and every card names who assigned it, to whom, and the observation or request it came from.
  2. An agent finishes a step -> it moves its own card through the system task skill, and the board updates without the operator retyping anything.
  3. An agent finds adjacent work -> a new card appears, marked as raised by that agent, addressed to the developer or to the CEO by what it is.
  4. Operator drags a card themselves -> the move is recorded as theirs, and the card keeps saying who raised it originally.
  5. Operator opens a card -> it links to the document or event it came from, and back.
- **Expected result:** the state of the project's work is a project fact that agents maintain, with every card accountable to a person or an agent by name.
- **Alt paths:** a card an agent raises with no evidence behind it is refused at creation rather than shown unsourced; a card whose assignee is ambiguous goes to the CEO to route rather than being assigned silently.
- **UI elements:** the board with columns backlog / running / review / done; a card carrying assigned-by, assigned-to and its source link; drag as an operator action.
- **States covered:** empty (no tasks), success, in flight (one command per card), unconfirmed (recorded and the projection has not caught up), refused (the ladder declined it), rejected (no answer came back), error
- **Errors & recovery:** a move that fails to journal snaps back and says so — the board never shows a state the journal does not hold. A REFUSAL and a REJECTION are different events and end the same way: the card returns to where the record has it, and the reason is announced. A command that succeeded while the refetch after it did not leaves the card where the operator put it and says it is not yet confirmed by the record, with a check-again that reconciles rather than re-issuing the command.
- **Telemetry:** planned only.
- **Amended 2026-09-05 (M124):** a task carries the DOCUMENT it came out of, and from
  the task you can see the others that document produced. The panel names the document
  rather than saying "related", because which document these came from is the only thing
  that makes the list trustworthy. A ref's trailing line or range is a LOCATION and not
  part of the document: two tasks from different lines of one file are siblings, and the
  reverse lookup that compares whole refs would have shown an empty list forever while
  looking built. A list longer than twenty says how many it did not show.
- **Amended 2026-09-10 (UX28-04):** the clause above said the board never shows a state the journal does not hold, and for one
  path it did. A REFUSED command — the ladder declining — put the card back and named the reason. A REJECTED one — the main process
  throwing, the transport dying — had no `catch` at all: the throw escaped a `void apply(...)` call site as an unhandled rejection,
  the optimistic entry was never withdrawn, and the card sat in a column it never reached for the rest of the session with nothing on
  screen. Three more rules now hold. ONE COMMAND PER CARD, and the lock is per task rather than per board, so a slow command on one
  card does not stop work on another. THE RECORD OUTRANKS THE GUESS: an optimistic position survives only while the record still
  shows what it showed when the guess was made, so a task somebody else moved somewhere third, and a row that left the list and came
  back, both drop the guess instead of overriding the record with it. And CONFIRMED IS NOT RECONCILED: a command that succeeded while
  the refetch failed says the card is not yet confirmed rather than claiming the command failed — one means look again, the other
  means it did not happen.
- **Status:** draft
- **Amended 2026-10-17 (0.3.7 wave 1, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** the Board is no longer a place of its own: a project's board is a block of its page with «Вся доска» (SCN-165); a card moved by the person moves at once with «Отменить», and the move back is the inverse in История (SCN-169).
- **Coverage:** `apps/desktop/src/shared/ladder.ts`, `apps/desktop/src/renderer/src/components/Board.tsx`, `apps/desktop/test/operating-surfaces.test.mjs`, `ProjectHome.tsx#BoardSection`, `apps/desktop/src/renderer/src/BoardSection.test.tsx`. UX28-04 closed the rejection path and the three rules above; the keyboard move is a native `select` and stays one, which is the card's own exclusion. `draft` rather than `built` because no run has watched an agent move its own card on a live board
- **Product:** unobserved

### SCN-042: Ask the manager, and get an artefact rather than advice

*2026-10-22 (0.3.10): an open side panel sits beside the page, which narrows; the agents grid takes one column up to 1440 px beside it.*
- **Persona:** P-01
- **Feature:** Manager
- **Traces:** ST-031, FLW-24, FLW-57 (JTBD-01, JTBD-05)
- **Entry point:** the CEO, reachable from every surface
- **Preconditions:** an estate exists
- **Steps:**
  1. Operator opens the CEO from inside a project -> it already knows which project, and its proposals are scoped to it. From the estate home the same control proposes estate-level work instead.
  2. Operator describes what they want done -> the CEO answers with a SPECIFICATION they can read and edit: role, provider, the MCP servers it needs, its trigger, what it produces, its permission mode and its budget.
  3. Operator confirms -> the CEO creates the binding and the routine, and the conversation ends in a recorded change rather than in text.
  4. Operator asks something the CEO cannot resolve -> it says what it would need, and offers to raise it as a task rather than guessing.
  5. Operator closes the chat without confirming -> nothing was created, and the CEO says so plainly.
- **R0 single entry 2026-09-26:** the floating avatar opens/focuses the conversation directly; it has no adjacent chat/profile/settings control. Appearance, name and response style are in Settings, never a first-use gate. Task titles, Project insight and Plan open a reusable object-bound discussion with its Project, typed source reference, draft and transcript. Opening does not launch work or accept a result. A new message after an applied outcome starts a new proposal, retaining the prior decision and task; applying explicitly creates a next step. Missing sources fail without fallback to another task. See [single-entry handoff](../launch/single-entry.md).
- **R0 refinement 2026-09-26 — conversation workspace:** project materials are selected by toggle chips (none / one / multiple / all currently available Projects), without changing the conversation or erasing the draft. A ticket keeps its owner attached; extra Projects are references, not authority. Each included Project supplies plan, decisions and primary/related source index. A message captures that selection; later chip changes do not rewrite old messages or grant commands new scope. “None” removes added project materials/attachments, not prior conversation history; a separate new conversation clears that history.
- **R0 controls:** icon launcher and minimize; compact bottom composer; Enter sends and Shift+Enter inserts a line, IME composition does not send. Inline shortcut, project-selection, context/plan, attachment and outcome widgets keep decisions in the transcript. A command needs an explicit destination when several Projects are selected. Long Project lists use a searchable picker; small sets stay directly visible. Attachment removal, invalid URL, cancelled selection and reopening preserve the draft. Known fixture secrets are redacted before storage; native scanning, uploads, durable persistence and model responses remain unimplemented.
- **First slice · 2026-09-28 (plan C1–C5, SCR-64, FLW-57):** until the CEO worker exists, a message is kept, not answered. The conversation shows, each in its own words: *not yet activated* (writes refused, the draft stays on this Mac, the reason is "private history recovery is not available yet"); *saved on this Mac* (draft autosaved); *saved, no reply yet* (accepted, no model reply is claimed); *sending result unknown* (checked again with the same operation, never resent); *refused* with its named reason (draft conflict, offline, local capacity, unresolved send, authority changed, retry limit); *recovered* (the last good draft after a restart, labelled); *draft conflict* (the newer text survives); *capacity full* (a list of kept drafts and sends with Forget, Discard and Check again; a send whose result is unknown cannot be discarded); *local history unreadable* (not shown as empty); *unavailable* (denied: no content, no draft). Choosing several Projects or All as context is refused visibly in this slice; None and One work. Enter sends, Shift+Enter inserts a line, IME composition never sends, Escape and minimise keep the draft.
- **Expected result:** a conversation with the manager terminates in an artefact — a binding, a proposal, a task or a journalled decision — or in nothing, stated.
- **Alt paths:** an agent that needs access it cannot be granted is proposed with the need named and left not-running until the grant exists; a request that crosses into another project leaves as a proposal to that project's manager rather than acting there.
- **UI elements:** the floating manager control on every surface; the chat panel; the agent specification card with its editable fields; the confirm action.
- **States covered:** empty (a fresh estate with nothing to propose), success, error (creation refused), not-activated, saved-locally, accepted-pending, commit-unknown, refused, recovered, draft-conflict, capacity-full, local-recovery-required, denied, unsupported-context
- **Errors & recovery:** a creation that fails leaves the specification on screen with the reason, so the operator can fix it rather than retype it. A send whose result is unknown is reconciled by the same operation ID and is never discarded to free space; a stale draft never overwrites newer text; an unreadable local history is reported as unreadable, not empty.
- **Telemetry:** planned only.
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-043: Lead with the projects actually being worked
- **Persona:** P-01
- **Feature:** Projects
- **Traces:** ST-032, FLW-21 (JTBD-02)
- **Entry point:** the estate home
- **Preconditions:** two or more projects exist
- **Steps:**
  1. Operator opens the home -> "My projects" lists every project once: up to five favourites lead in the operator's own order, the rest follow by their latest activity, newest first. Each card says what the project is (its purpose) and what its agents are doing now in their own words ("Now: …"), or how long it has been quiet, with its live agents, what waits on the operator and what waits for review.
  2. Operator pins a project (★) -> it joins the favourites; at five, pinning a sixth asks which to release rather than silently dropping one.
  3. Operator moves a favourite up or down (↑ ↓) -> it swaps with its neighbour among the favourites, and the order survives a restart; it changes no task priority. The rest carry no arrows: their order is the work itself.
  4. Operator has one project -> no favourites or order controls are offered, because ranking one of one is ceremony.
- **Expected result:** a portfolio of many does not bury the two being worked today.
- **Alt paths:** an archived favourite leaves the row and says so rather than showing as a dead card.
- **UI elements:** "My projects" on the estate home (SCR-30/SCR-01); ★ on each row, ↑ ↓ on favourites; the card's «Сейчас: …» / «Тихо уже …» line; the release prompt at the limit.
- **States covered:** empty (no favourites chosen yet), quiet project (no agent, last activity shown), success
- **Errors & recovery:** a pin that fails to record leaves the row unchanged and reports it. A pin refused because the set is full is NEITHER a failure nor a success — nothing is written and nothing is dropped — and it is reported as its own thing, because a full disk and a full favourites list are not the same news.
- **Telemetry:** planned only.
- **Amended 2026-09-10 (UX28-10):** all three steps and the alt path were right from the day they were written and the contract did none of them. `togglePin` appended without limit, so "up to five" was a sentence here and nothing else; nothing asked which to release; the pin control rendered on every card at any project count; and an archived favourite left the row in silence. The limit and the threshold are numbers in the contract now, `togglePin` returns a RESULT rather than an array — the old signature could only return a list, so a caller had no way to be told "this would be the sixth" — and a replacement is one write, because two would leave a window with four pinned and lose the released one if the second failed. UX28-10 asked whether the threshold is still intended: it is, and this scenario's own reason is why — ranking five of six saves nobody a scroll. That is recorded as a judgement rather than a measurement, since nobody has watched an operator with six projects.
- **Amended 2026-09-29 (launch design SCR-30/SCR-01):** the operator chose the launch prototype (`docs/reports/product.html`) over this scenario's threshold of six, so the threshold is one and the home's "My projects" carries ★ ↑ ↓ on every row, as the design does at four projects. The order of the unpinned projects is a preference of this machine (`project-order.json`), like the pins; a pinned project moves among the pins, whose order is the favourites list itself (`planMove`). The design's sentence under the list says what the order is not: it does not change the priority of any project's tasks.
- **Amended 2026-10-14 (operator request — the home shows who is doing what):** "the projects, all of them, the most recent ones I worked on at the top, favourites above them, and from the home it must be clear what each project is and what task its agents have now". The rest of the list is ordered by activity (`homeLive.ts#orderProjects`), not by hand, so the arrows stay on favourites only; a card's «now» is a working agent's stage report, else its claimed task's summary (`homeLive.ts#composeHome`), and never the task's instruction, which is a prompt.
- **Status:** draft
- **Coverage:** `apps/desktop/src/shared/favourites.ts`, `apps/desktop/src/main/favourites.ts`, `apps/desktop/src/renderer/src/EstateHome.tsx`, `apps/desktop/src/shared/homeLive.ts`, `apps/desktop/src/shared/homeLive.test.ts`, `apps/desktop/src/shared/favourites.test.ts`, `apps/desktop/src/renderer/src/halfShipped.test.tsx`. `draft` rather than `built` because no run has watched an operator with more than six projects choose which to release
- **Product:** unobserved

### SCN-044: Read what the estate has actually done
- **Persona:** P-01
- **Feature:** Manager
- **Traces:** ST-033, FLW-21 (JTBD-02)
- **Entry point:** the manager's profile, from its control on the estate home
- **Preconditions:** the estate has journalled work
- **Steps:**
  1. Operator opens the profile -> figures describing the estate's own record: projects under management, agents bound, work completed, releases.
  2. Operator reads a figure -> it names the register it was counted from, and the count is recomputed rather than stored.
  3. Operator looks for a figure the system does not measure -> it is absent. Nothing is estimated and nothing is awarded.
- **Expected result:** the profile is a measurement surface for the estate, checkable line by line.
- **Alt paths:** a fresh estate shows zeroes with their sources rather than an encouraging placeholder.
- **UI elements:** the manager profile panel; one row per figure with its source register named.
- **States covered:** empty (a fresh estate), success
- **Errors & recovery:** a figure whose register cannot be read shows as unavailable with the reason, never as zero.
- **Telemetry:** planned only.
- **Status:** retired
- **Retired 2026-10-17 (0.3.7 wave 1, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** the profile block on the home is cut (0.3.7 plan §5); what the estate has done is read in История (SCN-168), Главная says the state in one sentence (SCN-163).
- **Coverage:** `apps/desktop/src/renderer/src/ProfileSection.tsx`, `apps/desktop/src/shared/types.ts#EstateSummary`, the `estate:summary` handler in `apps/desktop/src/main/index.ts`. CORRECTED 2026-09-10 (UX28-03): this row cited `apps/desktop/src/shared/digest.ts`, `apps/desktop/src/renderer/src/DigestSection.tsx` and `apps/desktop/src/shared/digest.test.ts`, which are the project page's "where we left off" band and not the manager's profile at all — so the digest appeared covered by a scenario about something else, and had no scenario of its own until SCN-090
- **Product:** unobserved

### SCN-045: Rejoin a task by reading its own page
- **Persona:** P-01
- **Feature:** Tasks
- **Traces:** ST-034, FLW-22 (JTBD-02, JTBD-07)
- **Entry point:** a card on the board, or the task's own address
- **Preconditions:** the task exists and at least one agent has worked it
- **Steps:**
  1. Operator opens a task -> the page states what is being done, why, and the result expected. The agent drafted it; the page says so.
  2. Operator disagrees with the reasoning -> they edit it. Their version stands and the agent's stays readable underneath, so a correction is never a silent overwrite.
  3. Operator reads the notes -> each is a separate entry with its author and time, newest first. Nothing has been rewritten, because notes are append-only.
  4. Operator finds a note that will outlive this task -> they promote it to project memory. The fact moves; the task keeps a LINK, and the note is marked as promoted.
  5. Operator looks at resources -> files, documents, decisions and the session, every one of them a link. No document's content has been copied onto the task.
  6. Operator reads what the task did outside -> its receipts, each resolving to the journal row that recorded it.
- **Expected result:** the operator can rejoin any piece of work cold, and knows for every line whether a person or an agent put it there.
  7. Operator moves to a sibling task before their edit has been saved -> what they typed stays with the task it was typed for. The new page shows ITS brief, and coming back returns the unsaved words. Nothing typed for one task is ever written to another.
- **Alt paths:** a task nobody has worked shows only what created it, and says the rest is not filled in rather than showing empty headings; a promoted note cannot be promoted twice; a task whose detail fails to load says so in place and Back is still reachable, rather than leaving a dead end.
- **UI elements:** the task page: brief with its authorship line, append-only notes with a promote action, fields panel, related tasks, resources as links, transition history, receipts.
- **States covered:** empty (created, not started), loading, success, error (a resource that no longer resolves; a detail that failed to load; a save that failed)
- **Errors & recovery:** a resource whose target is gone says so in place and keeps the reference, rather than disappearing and taking the trail with it. **A failed save keeps the text in the box** — a save that fails and also empties the field is the same data loss the save existed to prevent. A response for a task the operator has already left is discarded, never rendered under the task now on screen. One edit blurred twice is recorded once.
- **Telemetry:** planned only.
- **Status:** draft
- **Coverage:** `apps/desktop/src/renderer/src/TaskPage.tsx`, `apps/desktop/src/renderer/src/TaskPage.test.tsx`
- **Product:** unobserved

### SCN-046: Judge direction from goals and the graph
- **Persona:** P-01
- **Feature:** Planning
- **Traces:** ST-035, FLW-23 (JTBD-02, JTBD-07)
- **Entry point:** the plan widget on the project page
- **Preconditions:** the project has at least one goal
- **Steps:**
  1. Operator opens the Project plan preview → SCR-40 target-plan destination opens the declared plan revision.
  2. Goals show planned membership, completed, active and remaining work from the same snapshot; completed tasks do not disappear from the denominator.
  3. Operator follows a requirement/goal edge → its declaration source and affected task are shown; orphan tasks remain visible and can be assigned a goal through the existing command.
  4. Operator opens a task → SCR-32 opens that task; Back restores plan revision and selection.
  5. Operator follows the separately named Project history link → SCR-40 project-history opens as its own addressable view; history is not overlaid as a different meaning on the same graph.
- **Expected result:** the operator can name the next dependency before a goal closes and distinguish intended work from recorded history.
- **Alt paths:** a goal with no tasks says it is undecomposed rather than complete; a project with no goals offers to derive them rather than showing an empty canvas.
- **UI elements:** target-plan preview and full graph/list, selected revision, source links, orphan backlog and in-place goal assignment, separate history navigation.
- **States covered:** empty (no goals), success, error (a graph that cannot be built)
- **Errors & recovery:** partial reads retain known goal/task membership with coverage and age; invalid normative dependency cycle is refused by the command with a named relation; historical cycles are not rejected by that rule. A closed list NOBODY COUNTED is treated as a floor, exactly as one known to be cut short is: "unknown" is not "nothing was cut", and a missing coverage is the same claim as unknown.
- **Telemetry:** planned only.
- **Amended 2026-09-10 (UX28-08):** step 2's rule held and the panel then undid it in one comparison. `coverageOfList` answers a capped read with THREE values, and the plan wrote `truncated === true` — so "nobody counted how many closed tasks exist" read as "nothing was cut", and a goal reported a real fraction of a list nobody had counted. A project with three open and forty done, capped at twenty, showed "2 of 3 done" as a measurement. The honest reading was already written in two other surfaces, in two different idioms, and a gate now refuses the comparison that has nowhere to put the third answer — TypeScript accepts it, being legal and well-typed and wrong. The alt path above ("a goal with no tasks says it is undecomposed rather than complete") and orphan work always being listed were both already built and neither had a test; both have one now.
- **Named rather than implied:** steps 1, 4 and 5 are NOT built and this card's own exclusions forbid the way there — the three graph routes need producer contracts that do not exist, and SCR-40 says S10 must reconcile ADR-0042's wording first (CO-156). Back restoring the revision and the selection is CO-149. And the AGE this scenario's Errors clause asks for beside the coverage is not shown: the plan says how complete a reading is and not how old, which is the CO-144 family.
- **Status:** draft
- **Coverage:** `apps/desktop/src/shared/plan.ts`, `apps/desktop/src/shared/planProgress.ts`, `apps/desktop/src/renderer/src/PlanSection.tsx`, `apps/desktop/src/shared/plan.test.ts`, `apps/desktop/src/shared/planProgress.test.ts`, `apps/desktop/src/renderer/src/PlanSection.test.tsx`, `scripts/check-coverage-reads.mjs`
- **Product:** unobserved
- **Target migration:** FLW-27 / SCR-40 under proposed ADR-0045; existing coverage is legacy goal-preview coverage, not proof of the new history views.

### SCN-047: See what a project's agents may do, and hold them to it
- **Persona:** P-01
- **Feature:** Harness
- **Traces:** ST-036, FLW-24 (JTBD-05, JTBD-07)
- **Entry point:** the harness panel on the project page
- **Preconditions:** the project exists
- **Steps:**
  1. Operator opens the harness -> the agents bound here, the skills installed, and the MCP servers, each with the state of its grant.
  2. Operator sees a server marked as needing a grant -> the agent that needs it is visibly not running for that reason, rather than failing quietly at three in the morning.
  3. Operator reads the contract -> the tools an agent uses to claim a task, report progress, move it, see its neighbours' leases, leave a note and release. The contract is the tool list; no document on disk is its source.
  4. An agent claims a task -> another agent asks for the leases in its scope and sees the first one holding it before starting.
  5. Operator adds an agent -> the mandatory task skill is installed with it, not optionally.
- **Expected result:** what agents may do in this project is visible, and the rules they follow cannot drift from the product that enforces them.
- **Alt paths:** an agent bound without the mandatory skill is refused at binding time; a lease whose holder died is released by its TTL and the release is journalled.
- **UI elements:** the harness screen: agents with state, skills with the mandatory one marked, servers with grant state, and the tool contract as a table.
- **States covered:** empty (a project with no agents of its own), loading, success, partial (one figure of several answered), error (a grant that cannot be read), not-configured (the surface is not listening)
- **Errors & recovery:** a server whose grant cannot be read shows as unavailable with the reason; the agent that depends on it does not start and says which grant it is waiting for. Every figure that comes from a read can say it could not be read, and one refusal of several is a PARTIAL reading rather than a whole one. A figure that is estate-wide says so, because a grant is not scoped to a project.
- **Telemetry:** planned only.
- **Amended 2026-09-10 (UX28-05):** the clause above was already right and the code did not do it. Three grant figures came from reads whose
  `error` was never looked at, then `live.count ?? 0` — so a refused grants table read as "no live authority here", the most reassuring answer
  the panel can give and the one it had no evidence for. Every read-derived figure is now a `ReadEnvelope` (S14), which cannot express an
  answer with no measurement behind it. The handler also took `projectId` and never used it: two projects rendered the same snapshot, and
  `grants` has no project column at all, so the figures are LABELLED estate-wide rather than filtered — the card offers both routes and only
  one exists. And three different things were called "agents": what this MACHINE has installed, the agents created IN this project (M125),
  and what a permission mode is ALLOWED to do. They are three lists now.
- **Named rather than implied:** step 5 and the alt path above describe the mandatory task skill being installed with an agent and a binding
  without it being refused. **That machinery does not exist** — `mandatory` appears nowhere in the binding path — and it is M123's, recorded
  in the M146 row as "delivers M123's tool CONTRACT and not its skill installation". The panel therefore shows no skills row: an empty one
  would read as "no skills installed" for a feature that was never built.
- **Status:** draft
- **Amended 2026-10-17 (0.3.7 wave 1, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** the project's Harness section is cut from the project page (0.3.7 plan §4–§5); what an agent is given — rules and tools — is read in that agent's view, «Что получает агент», in Агенты (SCN-166).
- **Coverage:** `apps/desktop/src/shared/agents.ts`, `apps/desktop/src/shared/agentSpec.ts`, `apps/desktop/src/shared/agentSpec.test.ts`, `apps/desktop/src/shared/harness.ts`, `apps/desktop/src/main/harnessRead.ts`, `apps/desktop/src/renderer/src/HarnessSection.tsx`, `apps/desktop/src/renderer/src/HarnessSection.test.tsx`, `apps/desktop/test/harness-read.test.mjs`, `scripts/check-surface-tools.mjs`. `draft` rather than `built` because the skills half is M123's and unbuilt, and no run has watched an operator hold an agent to this panel
- **Product:** unobserved

### SCN-048: Find anything the estate holds from one field
- **Persona:** P-01
- **Feature:** Search
- **Traces:** ST-028, FLW-21 (JTBD-02)
- **Entry point:** the search control on the estate home
- **Preconditions:** the estate holds at least one project
- **Steps:**
  1. Operator types -> results are grouped BY NATURE, not ranked into one list: projects, tasks, memory facts, transcripts, decisions.
  2. Operator reads a group's count -> a group with nothing in it is absent rather than shown as zero.
  3. Operator opens a result -> the thing itself opens, never a preview of it.
  4. Operator finds nothing -> the screen names which stores were searched, so "nobody wrote it down" stays distinguishable from "not searched".
- **Expected result:** one door to everything, and an honest account of where the answer was looked for.
- **Alt paths:** one store failing leaves the others rendered and says which failed, rather than returning a silently short list that reads as complete.
- **UI elements:** the field; grouped results with per-group counts and show-all; the searched-stores line on an empty result.
- **States covered:** empty (nothing typed), loading, success, error (a store that failed)
- **Errors & recovery:** a failed store never blanks the page; it reports itself and the rest still answers. A refused store is never listed among the places searched, and "nothing matches" cannot be claimed while one is silent.
- **Telemetry:** planned only.
- **Amended 2026-09-10 (UX28-09):** step 1 named five stores from the day it was written and three were searched, so a project's own title and a recorded decision were unfindable from this field. Step 4's promise was kept truthfully about a door two stores narrower than the product behind it — which is the harder kind of wrong, because nothing on screen was false. Decisions are a SUBSET of facts, so adding them meant narrowing the facts group in the same change: a decision is a `memory_facts` row of kind `decision`, and a group beside an unnarrowed facts group would return one row twice under two headings. The empty result now names the stores it searched; it said "in any store", which names none and grows more reassuring as the door widens. And no query writes its own estate filter any more — the scoped store applies it, which was measured by removing a hand-written one and watching nothing change.
- **Status:** draft
- **Coverage:** `apps/desktop/src/shared/search.ts`, `apps/desktop/src/main/searchRead.ts`, `apps/desktop/src/renderer/src/SearchPanel.tsx`, `apps/desktop/src/shared/search.test.ts`, `apps/desktop/src/renderer/src/SearchPanel.test.tsx`, `apps/desktop/test/search-read.test.mjs`. `draft` rather than `built` because no run has watched a person find something they could not otherwise name
- **Product:** unobserved

### SCN-049: Watch every agent from one screen
- **Persona:** P-01
- **Feature:** Agents
- **Traces:** ST-037, FLW-21 (JTBD-02)
- **Entry point:** the agents tab; the live feed on the estate home
- **Preconditions:** at least one session has been opened
- **Steps:**
  1. Operator opens the screen -> every session across every project is listed, agents waiting for an answer at the top.
  2. Operator selects one -> its live console fills the centre with its scrollback, and the right column says where the work is landing: project, repository, folder, branch, how much is changed.
  3. Operator reads the agent's history -> what it DID, from the journal: leases taken, grants received, effects executed, facts recorded. Not what it printed.
  4. Operator follows the task in the header -> the task page opens with this session already named.
  5. Operator types into the console -> the agent receives it without the session moving to another window.
- **Expected result:** the operator moves between agents without opening a project per agent, and can tell in seconds which one needs them.
- **Alt paths:** a session that ends stays in the list dimmed with its exit code rather than disappearing mid-glance; a project whose repository cannot be read shows the failure in place of the branch, never a stale one; selecting a second agent shows nothing of the first one's while the new reading is in flight, and an answer that arrives for the agent the operator has left is discarded rather than rendered under the new name.
- **UI elements:** the three columns — agent list with state, console with input, project meta and agent history; per-agent actions to detach into a window or end the session.
- **States covered:** empty (no sessions ever), loading, success, partial (one source of two answered), error (a repository that will not read), stale
- **Errors & recovery:** an agent whose console cannot attach says so and keeps the rest of the screen usable. The history and the repository reading fail SEPARATELY: one refusing names itself in its own panel and leaves the other's answer on screen, and a failed reading drops its payload rather than leaving the previous answer standing as current.
- **Telemetry:** planned only.
- **Status:** draft
- **Amended 2026-09-10 (UX28-13):** steps 1, 2, 4 and 5 are now kept, and this scenario was RIGHT about all of them from the day it was written —
  the eleventh time this cycle. The centre held `decodePty(agent.excerpt)`, the tail carried in every session listing and honestly labelled stale,
  so step 5 ("Operator types into the console -> the agent receives it without the session moving to another window") had nothing to type into.
  `TerminalView` — the component `SessionWindow` already uses, so there is one renderer hosted twice rather than a second one — is attached for a
  live session, keyed by `sessionId`; its cleanup disposes a renderer object and never ends the session. The list is ordered
  (`shared/sessionOrder.ts`): idle first because that is the agent nobody has answered, then running, then ended, and inside a group the longest
  wait on top, which is `attention.ts`'s own rule. An ended session keeps its snapshot WITH its exit code. The task in the header opens the task
  page, read through `runs.status` as a third independently keyed read. `screens.md`'s SCR-39 record had one state row denying the live console its
  own Elements line promised, and it was corrected there rather than here.
- **Amended 2026-10-17 (0.3.7 wave 1, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** the agents tab becomes the place Агенты (SCN-166): every agent, coding agents on this computer and agents built in Fabric, each with its console one press away; a coding agent that joined from a terminal is shown there with «Отключить» (SCN-167).
- **Coverage:** `apps/desktop/src/shared/agents.ts`, `apps/desktop/src/renderer/src/HarnessSection.tsx`, `apps/desktop/src/shared/agents.test.ts`, `apps/desktop/src/shared/keyedRead.ts`, `apps/desktop/src/renderer/src/EstateAgents.tsx`, `apps/desktop/src/renderer/src/EstateAgents.reads.test.tsx`, `apps/desktop/src/renderer/src/TerminalView.tsx`, `apps/desktop/src/shared/sessionOrder.ts`, `apps/desktop/src/shared/sessionOrder.test.ts`, `apps/desktop/src/renderer/src/EstateAgents.terminal.test.tsx`. UX28-02 keyed the two readings and rendered each one's failure; UX28-13 attached the console, ordered the list and added the task route as a third keyed read. UX28-14 gave the screen a THREE-track grid (`apps/desktop/src/renderer/src/styles.css`, `.project-columns-3`): it had been using the two-track `.project-columns` with three children, so the session list took the wide track, the console took the narrow one and the third panel wrapped to a second row — and `col-main`/`col-side` have no rule anywhere, so placement was positional all along. STILL NOT covered: the staleness AGE this scenario's `stale` state names is computed by `keyedRead.ts#staleness` and not shown here; the per-agent END action named in UI elements, which is destructive and has no confirmation idiom on this screen; and the launch control at the head of the list, which SCR-39's Elements names and nothing builds.
- **Product:** unobserved


## Engineering contract additions — 2026-09-07

Target design only; [shared contract](../architecture/system-contract.md) and proposed ADR-0045–0047 govern the new semantics. These records do not assert shipped screens.

### SCN-050: Answer a scoped question and see whether work received it
- **Persona:** P-01
- **Feature:** Board/questions
- **Traces:** ST-030, ST-034, FLW-25 (JTBD-02, JTBD-07)
- **Entry point:** SCR-30 top-five Board preview, SCR-31 project top-ten preview, or `#/e/:estate/p/:project/board?item=:boardItemId` (proposed local route)
- **Preconditions:** An authenticated operator may read the project; an agent has submitted one accepted authored question, optionally blocking tasks.
- **Steps:**
  1. Operator opens the preview item → SCR-41 opens the exact question with project, author, task, options, consequences, blockers and source receipts.
  2. Operator reads the answer form → the object identity and question revision remain fixed while other Board rows refresh.
  3. Operator submits an answer → pending retains the draft; a committed receipt names the decision and remaining blockers.
  4. Operator reads continuation separately → queued/delivering/acked/needs restart or failure is shown for the addressed task/session.
  5. Operator follows the decision or task → the exact entity opens; Back restores Board scope, filters and selection.
- **Expected result:** The answer is durable and the operator can distinguish decision commit from receipt by the working agent.
- **Alt paths:** A non-blocking question may be answered without stopping work. A task with another open blocking question remains blocked without changing its ladder state. A terminal done/cancelled task cannot reopen; further work creates a new origin-linked task. A previously answered item opens its receipt instead of a new answer form.
- **UI elements:** Question detail, stable option IDs, answer draft, commit status, continuation status, source links, retry/resume actions governed by server capability.
- **States covered:** loading,open,submitting,committed,conflict,withdrawn,partial,stale,delivery pending,acked,needs restart,error
- **Errors & recovery:** Timeout after commit retries the same command ID; a competing answer returns the current receipt; delivery retry never records a second answer or grant. A queued receipt is not proof of delivery: a current fenced owner may finish; an expired pre-write claim may be reclaimed; a possible prior write stays outcome_unknown and is not replayed. Stop or manual terminal input invalidates pending readiness; source failure is not an empty Board.
- **Telemetry:** no new product telemetry implied; command and source receipts are the record.
- **Amended 2026-09-29 (SCR-41 built as a screen):** the Board is a place of its own, reached from «Доска» in the navigation and «Разобрать доску →» on the home, and the CEO side panel that used to hold the obligations is retired. Steps 1–3 run there: a row opens its details with the options, the answer form and the committed receipt or the refusal, and a refused answer keeps its draft (`launch/BoardScreen.test.tsx`). «Разобрано» lists answered questions with the answer and the option chosen. Not yet: step 5's Back restoring filter and selection, and the `?item=` address.
- **Amended 2026-09-29 (L3b):** «На следующий раз» sets an authored question aside with a reason (`defer_question`, migration 68): it stays open and keeps blocking, is listed under its own tab with the reason, and «Вернуть на доску» returns it (`reopen_question`); answering it settles it and clears the deferral. «+ Добавить тему» writes an open question onto a chosen project as the owner (`ask_topic`), answered by the same `answer_question`. Each command is idempotent on its command id, stable per attempt on screen (`launch/BoardScreen.test.tsx`, `apps/desktop/test/board-deferral-db.test.mjs`).
- **Status:** draft
- **Amended 2026-10-06 (audit A3-001):** after an answer commits, the Board re-reads and the answered question leaves the open list; the detail stays on that row, marked Answered, with the receipt (recorded, what it unblocked, what is still blocked, delivery), until the person closes it or picks another row.
- **Amended 2026-10-17 (0.3.7 wave 1, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** questions are answered where they wait — «Ждёт вас» on Главная or «Вопросы» on the project page — with the options as buttons, and an answer is taken back with «Отменить» (SCN-164).
- **Coverage:** `apps/desktop/src/renderer/src/launch/BoardScreen.tsx`, `apps/desktop/src/renderer/src/launch/BoardScreen.test.tsx` — the Board screen. The project page's "Needs you" panel (`BoardPanel.tsx`) still loses the receipt on the re-read its answer triggers (0.3.2 verification UX-2, CO-222).
- **Product:** unobserved

### SCN-051: Inspect a manager settlement and override it by a new decision
- **Persona:** P-01
- **Feature:** Decisions/authority
- **Traces:** ST-029, ST-030, FLW-26 (JTBD-02, JTBD-07)
- **Entry point:** SCR-41 settled-by-manager history or SCR-33 decision detail
- **Preconditions:** A settlement proposal or committed settlement has a question, subject, typed basis and source version; the operator has appropriate authority.
- **Steps:**
  1. Operator opens the settlement → sees who decided, the exact cited fact/prior answer, subject and applicability, and the affected tasks.
  2. Operator opens assessment details → original/replacement, criticality components, trust ceiling and hard-floor reasons are shown with their snapshot.
  3. Operator chooses override → provides or confirms the replacement answer through the same human commit boundary; the previous decision remains linked as superseded.
  4. Operator follows affected work → new decision delivery is visible separately; already executed effects are not presented as undone.
- **Expected result:** The operator can inspect and correct accountable decisions without a fabricated explanation of model reasoning.
- **Alt paths:** No current basis or a human-decision reversal blocks automatic settlement and leaves an actionable Board question. Unknown provenance is not inferred to be agent-authored.
- **UI elements:** Standing settlements list, basis/source links, assessment disclosure, original/replacement view, override action, affected work links.
- **States covered:** proposed,checking,settled,requires-human,rejected,overridden,stale-basis,partial,error
- **Errors & recovery:** A stale decision or trust revision is revalidated on commit; a rejected override retains input and explains recovery; past effects require their own compensating work.
- **Telemetry:** no new product telemetry implied; command and source receipts are the record.
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-052: Read one execution iteration without confusing report and observation
- **Persona:** P-01
- **Feature:** Runs
- **Traces:** ST-034, ST-037, FLW-27 (JTBD-02, JTBD-07)
- **Entry point:** M189 preview on SCR-31 agent/task card or SCR-32 task page
- **Preconditions:** A task has a recorded admitted TaskRun, or a launch request has been denied before admission.
- **Steps:**
  1. Operator reads the preview → sees the stable TaskRun, current plan revision, claimed done/total, active path, blocker and age/source of the latest observation.
  2. Operator expands → all declared steps and parallel active paths are visible; reported status and independent verification remain separate.
  3. Operator selects an older run or plan revision → that snapshot stays selected while new events arrive.
  4. Operator opens full run history → SCR-40 project-history route is scoped to the task/run; a checkpoint or question opens its exact source.
  5. Operator returns → the selected run/revision and disclosure state are restored.
- **Expected result:** The operator can explain what this iteration intended, what was reported, what Fabric observed and what was verified.
- **Alt paths:** No plan is stated as no declaration, not zero percent. An admitted failed spawn is a failed TaskRun; a pre-admission denial has a command receipt but no Run. Native LLM turns are not invented as iterations.
- **UI elements:** Run status widget, revision/iteration history, plan steps, blockers, evidence links, freshness and observation coverage.
- **States covered:** no-plan,declared,active,blocked,done-claim,verified,failed,skipped,replanning,old-revision,unknown,reconnect,error
- **Errors & recovery:** A late response for a previous task/run is discarded; a stale feed keeps the last successful snapshot with age; an unavailable detector cannot label the agent stalled.
- **Telemetry:** no new product telemetry implied; command and source receipts are the record.
- **Amended 2026-09-10 (AX-02):** the three promises in Errors & recovery are now KEPT, and two of them were being broken in a way nothing could see.
  `deriveLiveness` was correct and BOTH its callers built its input as a literal, so each decided for itself what it did not know and they decided
  differently: the watcher classified the observation gap and read `session.oriented@1`, and the widget's reader passed no gap at all and
  `orientedAt: null` on every call. Measured against one fresh, oriented, beating session, the watcher answered `working | available` and the widget
  `stalled | available` — a healthy agent reported broken, at COMPLETE coverage, with the reason "Fabric has no record of it reading its rules" for a
  record that existed and that this reader never asked for. "An unavailable detector cannot label the agent stalled" needed a third answer rather than
  a more careful caller: `classifyOrientation` treated `null` and `undefined` identically, so "no orientation recorded" and "nobody read the
  orientation" were one value with two meanings. And "a stale feed keeps the last successful snapshot with age" kept the snapshot and showed no age,
  because the widget re-read only on `session.lastActivityAt` — which moves when the PTY prints, so a heartbeat that STOPS, an answered question and a
  host waking from sleep were all invisible to it. Steps 2–5 stay unbuilt: no expansion, no older-run selection, no SCR-40 route, no restore.
- **Status:** draft
- **Coverage:** the run-status widget and the reading behind it — `apps/desktop/src/shared/livenessInput.ts`, `apps/desktop/src/main/livenessRead.ts`, `apps/desktop/src/shared/liveness.ts`, `apps/desktop/src/main/runtimeObserver.ts`, `apps/desktop/test/liveness-callers.test.mjs`, `apps/desktop/src/renderer/src/AgentTile.test.tsx`. NOT covered: the expansion of step 2, the older-run and plan-revision selection of step 3, the SCR-40 route of step 4 and the restore of step 5 — and plan steps remain zero because `PlanRevision` and `StepClaim` are not built (M188 named them).
- **Product:** unobserved

### SCN-053: Inspect agent history, project history and the target plan as distinct views
- **Persona:** P-01
- **Feature:** Graphs
- **Traces:** ST-030, ST-035, ST-037, FLW-23, FLW-27 (JTBD-02, JTBD-07)
- **Entry point:** Project history/plan previews, agent history link, Board source or Task run history link
- **Preconditions:** The operator can read the project; graph coverage may be partial or contain unlinked legacy records.
- **Steps:**
  1. Operator opens a preview → SCR-40 opens the matching addressable destination: agent history, project history or target plan, with exact scope and selected entity.
  2. Operator follows an edge → inspector names its relation and source; creation, assignment, claim, handoff production/consumption and requirement are not conflated.
  3. Operator opens target plan → sees the selected declaration revision, goals, task membership, dependencies and outcomes, with completed membership retained.
  4. Operator opens a node → the exact task/run/question/decision/source opens; Back restores graph scope, as-of, selection and filters.
  5. Operator switches graph to outline/list → the same semantic view and objects remain available by keyboard; pagination names omitted/remaining data.
- **Expected result:** The operator understands recorded history and intended dependencies without mistaking one for the other.
- **Alt paths:** Decision history opens its own SCR-33 destination. DID history may contain returning work and is not rejected by a normative dependency DAG guard. Empty unlinked data is a readable list, not fabricated edges.
- **UI elements:** Distinct routes/titles, graph/outline/list presentation, scope/filter controls, source inspector, source-linked nodes/edges, coverage and pagination.
- **States covered:** empty,unlinked,partial,truncated,loading,ready,stale,reconnect,old-plan,missing-source,denied-source,error
- **Errors & recovery:** Missing targets remain boundary stubs with explanation; failed reads preserve the previous snapshot; new live events do not silently replace the selected historical plan.
- **Telemetry:** no new product telemetry implied; command and source receipts are the record.
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-054: Trace how a decision changed and what evidence was supplied
- **Persona:** P-01
- **Feature:** Decision history
- **Traces:** ST-029, ST-034, FLW-28 (JTBD-02, JTBD-07)
- **Entry point:** SCR-31 Decisions preview, SCR-41 answered question, SCR-34 fact or task source link
- **Preconditions:** At least one decision record exists, or the operator is inspecting a project with no decisions.
- **Steps:**
  1. Operator opens SCR-33 → sees current decisions and replacements with person/agent/system/unknown authorship.
  2. Operator opens a decision → reads author-provided rationale and explicit citations, affected tasks, and supersession lineage.
  3. Operator opens supplied context → sees the exact recorded pack/version if available, separately from retrievals recorded later and explicit basis citations.
  4. Operator follows a source → exact fact/question/transcript/artifact opens; Back restores the decision/branch/as-of.
- **Expected result:** The operator can reconstruct recorded decision lineage and evidence without any claim to reveal private model reasoning.
- **Alt paths:** A single decision with no edges remains a list. Multiple replaced predecessors all remain visible. An unavailable historical pack is marked incomplete, not replaced with the current pack.
- **UI elements:** Decision list/graph, authorship, valid period, supersession edges, rationale/citations, supplied-context and retrieval receipts, affected-work links.
- **States covered:** empty,list,lineage,branch,legacy-incomplete,cycle-diagnostic,missing-source,partial,stale,error
- **Errors & recovery:** Cycles, depth limits, unknown actors and missing refs are visible diagnostics. Scope denial retains the parent record but does not expose the protected source.
- **Telemetry:** no new product telemetry implied; command and source receipts are the record.
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-055: Handle what needs attention and read what happened
- **Persona:** P-01
- **Feature:** Inbox
- **Traces:** ST-028, ST-033, FLW-21, FLW-29 (JTBD-02)
- **Entry point:** SCR-30 Inbox preview or `#/e/:estate/inbox` (proposed local route)
- **Preconditions:** The operator has an estate scope; some module sources may be unavailable or not implemented.
- **Steps:**
  1. Operator opens SCR-42 → Needs you and Happened are distinct lanes with source coverage and last read time.
  2. Operator opens Needs you → exact canonical Board item and its resolving action open; it cannot be removed by marking read.
  3. Operator reads Happened → a sanitized notable event shows actor/project/time/source links; marking visible items read changes only this operator's read state.
  4. Operator follows a source and returns → lane, filters, item and cursor are preserved.
- **Expected result:** Unresolved work remains accountable while informational events can be read without becoming another task store.
- **Alt paths:** A resolved obligation leaves Needs you but its history remains accessible; a producer with no observations is marked unknown/planned rather than clear.
- **UI elements:** Two lanes, filters, canonical subject links, sanitized detail disclosure, read action only for Happened, source coverage.
- **States covered:** loading,empty,unread,read,partial,stale,reconnect,source-missing,error
- **Errors & recovery:** Receiving an event or failing a read never advances read watermark. Duplicate replay is deduped by source ID. Two operators do not change each other's read state.
- **Telemetry:** no new product telemetry implied; command and source receipts are the record.
- **Status:** retired
- **Retired 2026-10-17 (0.3.7 wave 1, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** the Board and Inbox as places of their own are cut (0.3.7 plan §2, §5): what needs the person is on Главная (SCN-163, SCN-164), what happened is in История (SCN-168).
- **Coverage:** none yet
- **Product:** unobserved

### SCN-056: Inspect every cycle and the evidence for its state
- **Persona:** P-01
- **Feature:** Cycles
- **Traces:** ST-030, ST-033, ST-037, FLW-30 (JTBD-02, JTBD-07)
- **Entry point:** SCR-30 cycle summary, project Automations, Inbox issue or system-map cycle node
- **Preconditions:** There are declared cycle configurations or a planned cycle inventory; scheduler/monitor coverage may be incomplete.
- **Steps:**
  1. Operator opens SCR-43 → each cycle has kind/project, enabled configuration/cadence/placement, observation state and last outcome as separate fields.
  2. Operator opens a cycle → reads tick receipts, due/missed policy, last started work, last verified outcome and source coverage.
  3. Operator opens a tick/source → follows its task/run/blocking input or failure receipt, and returns without losing selected cycle.
  4. If permitted, operator requests wake → receives admitted/refused/coalesced receipt through the normal guard; the screen waits for observed outcome.
- **Expected result:** The operator can distinguish disabled, not due, skipped, running, failed and unobserved cycles and act on the actual cause.
- **Alt paths:** App-off without an outside monitor is unknown observation, not proof of a stall. A routine task start is not a verified cycle success. Planned CEO/retro/letter cycles are labelled planned.
- **UI elements:** Cycle table and detail, config/health/outcome columns, cadence/next due policy, source/tick links, guarded wake action.
- **States covered:** planned,disabled,inflight,not-due,skipped,waiting,working,quiet,stalled,gone,unknown,partial,error
- **Errors & recovery:** DST/sleep/catch-up follows each cycle policy; unknown next due is explicit. DB read failure retains last state with age. No manual wake bypasses admission or starts a duplicate.
- **Telemetry:** no new product telemetry implied; command and source receipts are the record.
- **Noted 2026-09-10 (AX-02):** this scenario's alt path — "app-off without an outside monitor is unknown observation, not proof of a stall" — is the same
  doctrine AX-02 enforced in the derivation, and it is now enforced there: an unread input degrades the coverage and a suspended host owns its own
  silence. **Coverage stays `none yet` deliberately**, because SCR-43 does not exist: the rule holding underneath is not the screen being built, and
  claiming this scenario on the strength of a shared helper is exactly the substitution the cycle refuses.
- **Status:** retired
- **Retired 2026-10-17 (0.3.7 wave 1, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** the project's Automations section is cut (0.3.7 plan §5); a cycle's runs are acts in История (SCN-168) and its agent is read in Агенты (SCN-166).
- **Coverage:** none yet
- **Product:** unobserved

### SCN-057: Preview the next context and inspect the exact past pack
- **Persona:** P-01
- **Feature:** Memory/context
- **Traces:** ST-028, ST-029, ST-034, FLW-31 (JTBD-02, JTBD-07)
- **Entry point:** SCR-34 Memory, task/run pack receipt or decision context link
- **Preconditions:** Project memory is readable in at least one supported backend; historical artifacts may be incomplete.
- **Steps:**
  1. Operator opens Next context → a dry preview reads current inputs without starting a session or writing a lockfile.
  2. Operator reads included/omitted items → sees why, source versions, budget unit and measured usage; a failed source is partial, not empty.
  3. Operator opens a past pack → receives the recorded immutable artifact or exact versioned reconstruction with compiler/budget revision; otherwise legacy incomplete is stated.
  4. Operator follows a fact/transcript/lineage → exact source opens; Mirror sync shows its own covered/exported cursor separately from runtime events.
- **Expected result:** The operator can inspect what a future run would receive and what an earlier run actually received without conflating them.
- **Alt paths:** Character budget remains characters; token measurement names tokenizer/version separately. Cloud unavailable is explicit. Full import/restore stays outside this read-only preview.
- **UI elements:** Next/past distinct routes, included/omitted list, source/version/hash, compiler and budget, coverage, lineage and mirror state.
- **States covered:** no-facts,no-history,complete,partial-source,over-budget,unsupported-backend,legacy-incomplete,mirror-drift,stale,error
- **Errors & recovery:** Rename, brief edits and compiler upgrade never change an old pack hash. Missing historical inputs do not trigger a closest-current substitution. Dry preview has no append/spawn side effects.
- **Telemetry:** no new product telemetry implied; command and source receipts are the record.
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-058: Follow evidence through a collapsed interface without losing context
- **Persona:** P-01
- **Feature:** Navigation/disclosure
- **Traces:** ST-028, ST-034, ST-037, FLW-27, FLW-28, FLW-29, FLW-30, FLW-31 (JTBD-02, JTBD-07)
- **Entry point:** Any preview, search result, graph node or evidence link into SCR-31/32/33/34/40/41/42/43
- **Preconditions:** The operator uses keyboard or pointer; the target may sit inside a closed disclosure.
- **Steps:**
  1. Operator activates a named source link → route resolver validates canonical scope and loads the exact target.
  2. Required parent disclosures open → focus reaches the target heading/entity without revealing unrelated panels.
  3. New live data arrives → primary state updates without resetting selected revision, collapsed state or keyboard focus.
  4. Operator returns → original route/filter/scroll/selection/focus is restored.
- **Expected result:** Progressive disclosure reduces overload while every fact and resolving action remains reachable.
- **Alt paths:** Missing/denied target produces a local explanation and retains the source. Graph outline/list is equivalent at narrow width and for keyboard users.
- **UI elements:** One disclosure primitive, named links/buttons, typed route resolver, local failure/return affordance.
- **States covered:** collapsed,expanded,target-loading,targeted,missing,denied,live-update,error
- **Errors & recovery:** No nested buttons, unresolved aria references or color-only meaning; reduced motion retains content; narrow/200% zoom retains the main action and readable inspector.
- **Telemetry:** no new product telemetry implied; command and source receipts are the record.
- **Amended 2026-10-23 (0.3.12, CO-388):** going back with ⌘[ (or forward with ⌘]) opens the page at the scroll position it was left at; any other move opens a page at its top (`apps/desktop/src/renderer/src/launch/LaunchShell.tsx`, `apps/desktop/src/renderer/src/launch/Rail.test.tsx`).
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-059: Reach first value progressively and resume an unfinished draft
- **Persona:** P-01
- **Feature:** Onboarding
- **Traces:** ST-001, ST-022, ST-023, FLW-32, FLW-55 (JTBD-01, JTBD-02)
- **Entry point:** SCR-30 New project, first launch or a restored SCR-27 source draft.
- **Preconditions:** The operator can select a source; saved work remains readable without a working executor. An agent scan requires a ready, scoped executor.
- **Steps:**
  1. Operator starts → SCR-36 offers usable Fabric name/avatar defaults; SCR-05 resolves executor readiness; saved setup skips completed steps.
  2. Operator selects a project folder or project-root folder using the native picker, or enters a URL → SCR-27 saves source identity, derives a display name and begins permitted read-only discovery without a manual purpose/review gate.
  3. Operator switches away or restarts → the same estate/draft/selection and observed scan state return; process activity is re-observed, never inferred from a saved spinner.
  4. Fabric observes the project → SCR-31 shows sourced facts, inferred purpose marked as inference, coverage and a proposed next action; missing facts are explicit.
  5. Operator chooses the next action → stable project/task receipts preserve identity; executor admission remains a separate authority boundary under SCN-067.
- **Expected result:** A sourced understanding of the selected project and a resumable next action, with no retyping of folder, project name or information recoverable from sources.
- **Alt paths:** The user may leave setup to read saved projects; missing executor retains the source but cannot complete a scan. Idea-only and advanced starter paths remain retained optional capabilities, not mandatory first-launch stages.
- **UI elements:** Fabric defaults, executor readiness, Choose folder button, selected folder chip, URL field, discovery stages, sourced insight, resume action.
- **States covered:** new,draft,resumed,source-selected,scanning,partial,empty,denied,duplicate,unknown-create,error
- **Errors & recovery:** Picker cancellation preserves the previous source; late scan responses remain bound to scan/source revision. Unknown create outcome reconciles the same request identity. Duplicate source opens the existing project; archived source offers explicit restoration. Failed persistence retains the draft and never reports saved.
- **Telemetry:** planned only; first value requires a sourced insight and usable next action, not a click or fabricated success.
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved


### SCN-060: Return to existing work across projects without losing scope
- **Persona:** P-01
- **Feature:** Navigation/continuity
- **Traces:** ST-019, ST-028, ST-032, ST-034, FLW-33 (JTBD-01, JTBD-02)
- **Entry point:** Application restart, SCR-30, an Inbox item, search hit or a typed deep link.
- **Preconditions:** The operator has at least two accessible projects or a persisted working set; a linked source may have been revoked, removed or changed.
- **Steps:**
  1. Operator returns → accessible project tabs and local drafts are restored without recreating projects or starting sessions; missing entries are explained rather than silently replaced.
  2. Operator opens SCR-42 Needs you or a change digest on SCR-31 → exact project, task or question identity is carried by the link; counts and freshness name the source snapshot.
  3. Operator opens a deep link to SCR-32 while another project is active → trusted scope is checked before reading; the correct project and task are selected and the previous return target is preserved.
  4. Operator switches between two task drafts while reads or saves are pending → each draft and response remains bound to its project/task/generation; no late result replaces the newly selected context.
  5. Operator follows task → question → decision or source and presses Back → scope, filters, selection, draft and any pinned historical revision are restored.
- **Expected result:** The operator resumes the actual addressed work without leaking context, losing drafts or confusing a link with authority.
- **Alt paths:** An unavailable project remains a recoverable working-set entry only without exposing its protected content. A missing or denied source stays local to the link and retains the parent context; it never falls back to an arbitrary project. Closing a tab does not close its task or session.
- **UI elements:** Restored tabs, digest, Inbox, typed links, scope label, return target, local-draft status and source-local unavailable state.
- **States covered:** restoring,restored,stale,partial,draft-restored,deep-link-loading,denied,missing,scope-changed,error
- **Errors & recovery:** Local draft hydration must complete with a readable snapshot before the saved working set can be replaced. Unreadable draft storage preserves its references and reports recovery-required; it does not describe saved drafts as deleted projects. Read failures retain the last authorised snapshot with age; revocation clears the protected projection. Passive replay does not advance the operator read watermark. A project-only link is not permission to bypass estate membership.
- **Telemetry:** no new product telemetry implied; durable commands, local operation receipts and source observations are the record.
- **Implementation tasks:** S01, S02, S09, S13, S14, M185, M187. See [engineering contracts](../architecture/engineering-specs.json); proposed semantics do not assert released provider compatibility.
- **Prototype:** [target prototype](../reports/product.html#screen-SCR-31) — fictional fixture; not product coverage.
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved


### SCN-061: Choose and replace a manager with visible authority and host readiness
- **Persona:** P-01, P-02
- **Feature:** Manager lifecycle
- **Traces:** ST-002, ST-006, ST-031, ST-036, ST-037, FLW-34 (JTBD-01, JTBD-02, JTBD-05, JTBD-07)
- **Entry point:** SCR-44 from project agents, estate manager settings or a cycle readiness issue.
- **Preconditions:** The operator may manage the estate CEO or project product-manager role slot; available choices have explicit provider/profile/conformance evidence and activation gates.
- **Steps:**
  1. Operator opens SCR-44 → the role slot scope, configured binding revision, provider/profile, budget and fixed tool/checker boundary are visible separately from observed host and invocation status.
  2. Operator selects a candidate → preview names capability gaps, placement, source readiness, compatibility and expected cost coverage; an installed CLI alone is not a certified manager.
  3. Operator requests replacement → existing admissions stop and a bounded checkpoint/drain is attempted; the old epoch is invalidated before a new binding is admitted and receives its new epoch/context.
  4. Operator inspects the result → the original history, decisions and memory remain; the new manager must acknowledge its addressed continuation. A still-running old native process is labelled residue or unknown and cannot write with its revoked epoch.
  5. Operator suspends/revokes authority or observes the app host going offline → authority, configured choice, host observation and last invocation outcome stay distinct; the screen does not invent an always-on manager.
- **Expected result:** A selectable manager can change without losing project governance or admitting two authoritative writers.
- **Alt paths:** A deterministic core may be available with ModelPort absent; judgement remains unavailable rather than stubbed. A failed replacement leaves a visible safe suspended/transitioning state, not a fake active default. Native resume requires the exact authorised provider session/profile and adapter acknowledgement; otherwise a fresh invocation uses the recorded Fabric pack.
- **UI elements:** Role slot selector, binding/profile comparison, readiness and cost coverage, replace/suspend controls, handoff timeline, epoch receipt, exact pack and invocation links.
- **States covered:** unconfigured,configured,checking,uncertified,ready,transitioning,checkpoint-pending,admission-refused,ack-pending,suspended,host-offline,unknown,error
- **Errors & recovery:** A delayed old-epoch command is refused without domain mutation. Unknown spawn or checkpoint outcome is reconciled before a paid duplicate invocation. Missing authority/pack source blocks dependent admission. Revocation does not pretend a previously completed effect was undone.
- **Telemetry:** no new product telemetry implied; durable commands, local operation receipts and source observations are the record.
- **Implementation tasks:** M194, M166, M167, M175, M176, S15, S02, S03. See [engineering contracts](../architecture/engineering-specs.json); proposed semantics do not assert released provider compatibility.
- **Prototype:** [target prototype](../reports/product.html#screen-SCR-44) — fictional fixture; not product coverage.
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved


### SCN-062: Turn a retrospective episode into a verified lesson and detect regression
- **Persona:** P-01
- **Feature:** Retrospectives
- **Traces:** ST-028, ST-029, ST-030, ST-033, ST-034, FLW-35 (JTBD-02, JTBD-07)
- **Entry point:** SCR-45 from Memory, a CEO cycle or an episode-linked Board item.
- **Preconditions:** An authorised scope has source observations or insights; verification inputs and observation coverage may be incomplete.
- **Steps:**
  1. Operator opens SCR-45 → an episode names category, scope, stable subject, source occurrences, applicability revision and separate verified-distinct and unknown counts.
  2. Operator refreshes or reads several reports about the same incident → they remain one occurrence; a configured threshold counts distinct verified occurrences rather than views, refreshes or repeated prose.
  3. Operator reviews a proposed correction → cited basis, recorded rationale, owner and verification plan are inspectable; checker approval is distinct from an agent proposal.
  4. Operator opens the related SCR-41 question or SCR-32 resolution task → a process discussion uses kind=decision and topic=process in the proposed target contract, preserving the existing question-kind enum.
  5. Operator follows accepted → implementing → verifying → verified or regressed → the result names the verification window and required source evidence; missing coverage remains unknown, and a later recurrence preserves the prior episode history.
- **Expected result:** A retrospective produces attributable corrective work and measured verification instead of merely accumulating repeated feedback.
- **Alt paths:** Project is the default insight category. Agents, harness, fabric and process remain distinct categories; category alone never authorises outbound export. Dismissal or insufficient evidence preserves the recorded basis and suppresses repeat resurfacing according to the owning lifecycle. A raw incident is not automatically a verified lesson.
- **UI elements:** Episode list/detail, category/scope, distinct occurrences, source inspector, proposal/checker result, decision/task links, verification window, verified/regressed history.
- **States covered:** observing,review-due,proposed,accepted,implementing,verifying,verified,regressed,dismissed,insufficient-evidence,partial,error
- **Errors & recovery:** Duplicate source identity cannot raise the threshold. A stale applicability revision or absent verification source blocks a verified claim. Rebuild/replay retains suppression and episode links; no model self-report substitutes for independent observation. A source belonging to another project is refused IN PLACE with its raw ref and the reason, and is never opened here and never re-pointed at the other project; a source whose owner nobody could establish is not offered at all, because falling back on the project the row was read in is the same mistake with better manners.
- **Telemetry:** no new product telemetry implied; durable commands, local operation receipts and source observations are the record.
- **Implementation tasks:** M154, M182, M184, M168, S15, S14. See [engineering contracts](../architecture/engineering-specs.json); proposed semantics do not assert released provider compatibility.
- **Amended 2026-09-10 (UX28-06):** the source inspector this scenario names was opening the wrong project. A lesson's `source_ref` may point at a task recorded anywhere, and the row handed the resolver THE PAGE'S project as though it were the source's — so a source from another project opened inside this one, carrying that project's id. The row's project and the ref's project are two different facts and were one argument. The ref's owner now comes from the read (one bounded `selectIn`), the resolver refuses a mismatch it can finally see, and a row that does not know declines rather than guessing. **Named, not implied:** `fact` and `transcript` still resolve to the PROJECT rather than the thing, because no surface can focus one of either (CO-148); Back returns to a page and not to a place (CO-149).
- **Status:** retired
- **Retired 2026-10-17 (0.3.7 wave 1, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** the project's Retro section is cut (0.3.7 plan §5); its episodes are acts in История (SCN-168).
- **Coverage:** `apps/desktop/src/shared/entityRef.ts#destinationOf`, `apps/desktop/src/shared/retroView.ts#evidenceOf`, `apps/desktop/src/renderer/src/RetroSection.tsx`, `apps/desktop/src/shared/entityRef.test.ts`, `apps/desktop/src/renderer/src/RetroSection.test.tsx`. UX28-06 closed the cross-project hole and the unresolved-target rendering; the lifecycle this scenario describes (observing → verified/regressed) is M154/M184's and is not built
- **Product:** unobserved


### SCN-063: Inspect service feedback and stop outbound work honestly
- **Persona:** P-01, P-02
- **Feature:** Service feedback/privacy
- **Traces:** ST-028, ST-033, ST-036, FLW-35 (JTBD-02, JTBD-07)
- **Entry point:** SCR-46 from a service-category retrospective or estate settings.
- **Preconditions:** Local insight collection and outbound activation are separate capabilities. Proposed ADR-0047 and its default preference are not treated as accepted policy or a released endpoint contract.
- **Steps:**
  1. Operator opens SCR-46 → local intake preference and outbound policy are separate; local collection is default-on in the target contract, while outbound remains inactive until its actual endpoint, schema, privacy/transport metadata and retention gates are satisfied.
  2. Operator inspects an eligible service candidate → the exact versioned allowlisted payload, excluded fields and relevant transport/retention disclosure are visible; the preview never claims that removing IDs alone proves anonymity.
  3. Operator sees send eligibility → only agents/harness/fabric categories may qualify; project/process, free text, file basenames/paths, identities, transcript and arbitrary metadata are not sent by the v1 allowlist. Current policy revision and suppression are checked at dispatch.
  4. Operator turns outbound off or suppresses a candidate → pending intents are durably suppressed; an in-flight attempt that might already have reached the endpoint remains unknown until a receipt or reconciliation settles it.
  5. Operator later re-enables the permitted policy or opens a restored estate → suppressed old candidates do not become sendable again; previously accepted server data shows its known receipt and actual retention/deletion capability instead of promising remote erasure.
- **Expected result:** The operator can distinguish local improvement data, proposed outbound policy and actual delivery state, including the limits of opt-out after dispatch.
- **Alt paths:** Without an active endpoint contract, payload preview may be a labelled local dry preview and Send stays unavailable. An unavailable local suppression/policy store is fail-closed for export. Future default-on structured export remains a proposed activation decision, not silently approved by this scenario.
- **UI elements:** Local intake setting, outbound activation gate, exact payload preview, policy/schema revision, candidate suppression, pending/inflight/accepted statuses, server receipts and retention explanation.
- **States covered:** local-only,activation-gated,preview,eligible,pending,suppressed,inflight,unknown,accepted,rejected,opted-out,quarantined,error
- **Errors & recovery:** Opt-out cannot recall already dispatched bytes; unknown is not relabelled cancelled. Re-enable, schema migration and replay do not resurrect tombstoned feedback. Restore remains outbound-off/quarantined until current authority and suppression are revalidated.
- **Telemetry:** no new product telemetry implied; durable commands, local operation receipts and source observations are the record.
- **Implementation tasks:** M183.local, M183.upstream, M182, S12, S14. See [engineering contracts](../architecture/engineering-specs.json); proposed semantics do not assert released provider compatibility.
- **Prototype:** [target prototype](../reports/product.html#screen-SCR-46) — fictional fixture; not product coverage.
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved


### SCN-064: Inspect declared storage and import a verified mirror without partial writes
- **Persona:** P-01, P-02
- **Feature:** Storage/sync
- **Traces:** ST-001, ST-022, ST-028, ST-033, FLW-36 (JTBD-01, JTBD-02)
- **Entry point:** SCR-47 from Memory sync, project settings or an import action.
- **Preconditions:** The operator may inspect the selected estate; an import archive/manifest may be available and a target estate may be empty or concurrently changing.
- **Steps:**
  1. Operator opens SCR-47 → authoritative journal, projections/cache, identity/operational state, local preferences and external/local blobs are classified separately; covered source cursor, exported cursor and last verified coverage are not collapsed into a sync switch.
  2. Operator inspects the mirror → format/schema/projector versions, checksum manifest, included/excluded entity kinds and local divergence are shown; generated YAML is not called a complete backup.
  3. Operator selects Import → full parse/schema/cross-reference validation produces a preview with preserved IDs, entity counts, missing relations, path rebindings, input digest and expected target revision before any mutation.
  4. Operator commits that preview to an empty isolated target → the boundary rechecks scope, target emptiness/revision and digest, then records one atomic import and operation receipt.
  5. Operator opens the receipt → committed coverage is visible, or conflict/validation failure explains why no partial import became authoritative; repository paths require explicit local-root validation before executable use.
- **Expected result:** A declared-layer import is inspectable, atomic and distinct from full backup recovery or bidirectional synchronisation.
- **Alt paths:** Legacy mirror formats remain partial with explicit excluded kinds. User-diverged YAML gets a diff before overwrite. Large or unsupported archives are refused before writes; there is no silent chunk/merge mode and no automatic git commit or push.
- **UI elements:** Storage-class inventory, source/export cursors, mirror/backup coverage, manifest validation, import preview, expected-revision conflict and operation receipt.
- **States covered:** reading,current,partial,diverged,authority-unavailable,validating,preview,importing,committed,conflict,invalid-manifest,error
- **Errors & recovery:** A second concurrent import returns conflict instead of mixing estates. A fault before transaction commit leaves zero committed imported entities; retry uses the same operation/command identity. Failed generation or rebuild retains the previous readable generation.
- **Telemetry:** no new product telemetry implied; durable commands, local operation receipts and source observations are the record.
- **Implementation tasks:** S12, S14, M198, M191, S02. See [engineering contracts](../architecture/engineering-specs.json); proposed semantics do not assert released provider compatibility.
- **Prototype:** [target prototype](../reports/product.html#screen-SCR-47) — fictional fixture; not product coverage.
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved


### SCN-065: Restore an archive into a fresh Estate and open it
- **Persona:** P-01, P-02
- **Feature:** Backup/recovery
- **Traces:** ST-001, ST-028, ST-033, FLW-36 (JTBD-01, JTBD-02)
- **Entry point:** SCR-48 from SCR-47 storage settings, or from SCR-65 before importing private history.
- **Preconditions:** The operator is the current owner of the Estate they are working in (the control Estate) on this Mac. An archive file exists. Decided by [ADR-0079](../adr/0079-private-conversation-archives-preserve-history-not-authority.md); replaces the earlier read-only-activation design of this scenario.
- **Steps:**
  1. Operator chooses an archive → Fabric verifies the file before anything is written: format, size limits, completeness and digest. A refusal names its reason (not a Fabric archive, too large, incomplete, altered, unsupported version) and writes nothing.
  2. Operator confirms the restore → Fabric creates a new, empty Estate and restores the history into it in one step, owned by the same person as the control Estate. Archive authors and names grant nobody access.
  3. Operator reads the result → three facts are shown separately: *history restored*, *access to the new Estate verified*, *not opened yet*. The restored Estate has no queued work, no running agent and no restored grant.
  4. Operator chooses Open this Estate → Fabric records it as the active Estate and restarts into it; after the restart the Estate is shown as *opened*.
- **Expected result:** Past work is back as history in its own Estate, owned by the operator who restored it, with nothing restarted or re-sent.
- **Alt paths:** The operator can stay in the current Estate and open the restored one later: every Estate this Mac restored for them, other than the one open, is listed under "Restored Estates you can open". A restore whose reply was lost is looked up by the same operation and returns the same Estate, never a second one; it stays listed under "Restores waiting for a result" with Check again after the panel closes or Fabric restarts. A member who is not the owner of the control Estate cannot restore.
- **UI elements:** archive picker; verification result with reason; restore confirmation naming the new Estate; three result facts; Open this Estate with restart notice; restores waiting for a result; restored Estates you can open.
- **States covered:** empty, verifying, refused, restoring, result-unknown, history-restored, access-verified, opening, opened, denied, error
- **Errors & recovery:** Any failure rolls the whole restore back: no half-created Estate, owner or history. A result that is unknown is checked with the same operation ID. Revoked or changed ownership of the control Estate refuses the restore. A call that fails ends in a refusal or a Check again, never on "Restoring…"; an archive file that cannot be read again is refused with its operation, which stays checkable. Fabric keeps its own private copy of the archive from before the first call until the result is known, so moving the original does not lose the restore. A failed Open keeps the restored result, names why and can be tried again. The word "backup" is not used until end-to-end restore has been accepted.
- **Telemetry:** no new product telemetry; the operation receipt is the record.
- **Implementation tasks:** A1-3, A1-6 of the [first-slice plan](../evidence/plans/2026-09-27-first-slice-plan.md); S12, S14.
- **Prototype:** [target prototype](../reports/product.html#screen-SCR-48) — fictional fixture; not product coverage.
- **Status:** draft
- **Coverage:** `apps/desktop/src/renderer/src/PrivateHistoryPanel.tsx` (restore section, pending and restored lists), `apps/desktop/src/main/privateHistory.ts#restore` / `#pending` / `#restoredEstates`, `restore_estate_verified`, `apps/desktop/src/main/activeEstate.ts`. Tests: `PrivateHistoryPanel.test.tsx`, `apps/desktop/test/private-history-service.test.mjs`, `apps/desktop/test/private-history-native-db.test.mjs` (owned cluster), `apps/desktop/test/active-estate.test.mjs`.
- **Product:** unobserved

### SCN-066: Return from authentication to the same invitation with current membership
- **Persona:** P-02, P-03
- **Feature:** Membership
- **Traces:** ST-008, ST-009, FLW-06 (JTBD-04)
- **Entry point:** SCR-14 invitation deep link, before or after authentication.
- **Preconditions:** An owner issued a single-use expiring invitation for an intended identity. S09 v1 membership visibility is estate-wide; project-private membership is not simulated by hidden UI controls.
- **Steps:**
  1. Invitee opens SCR-14 → sees the safe estate/role preview and signs in if needed; a scoped return intent is preserved without leaving a raw credential in the product route.
  2. Authentication completes → SCR-14 restores that exact invitation and revalidates intended identity, expiry, revocation and membership revision before exposing authorised estate content.
  3. Invitee reviews and accepts → the trusted membership command records one acceptance; duplicate submit/retry returns the same outcome rather than duplicate membership.
  4. Invitee enters allowed project work or the available role surface → the visible estate-wide scope and owner/member capabilities match server authority; owner-only grants and role changes are not offered as member powers.
  5. An owner revokes or changes membership while the invitee has cached UI → subsequent reads/commands revalidate authority and protected cached content is removed; already performed effects remain history.
- **Expected result:** Authentication does not lose the invitation or broaden its authority; acceptance and revocation have inspectable current receipts.
- **Alt paths:** Wrong-account sign-in permits switching identity without consuming the invitation. Expired, revoked, already accepted or changed invitations resolve to a safe named state. A last-owner change is refused by the authoritative membership rule. Full role workspace remains the later M39 capability.
- **UI elements:** Invitation/auth-return state, intended identity check, estate-wide visibility preview, owner/member role label, Accept receipt and revoked/expired recovery.
- **States covered:** signed-out,auth-return,verifying,valid,wrong-identity,expired,revoked,already-accepted,accepting,accepted,role-changed,error
- **Errors & recovery:** Auth cancellation retains the safe return intent. No failed acceptance creates half-membership. Old auth sessions do not retain rights after membership revision change; effect dispatch rechecks current authority.
- **Telemetry:** no new product telemetry implied; durable commands, local operation receipts and source observations are the record.
- **Implementation tasks:** S09, S02, S03, M38, M39. See [engineering contracts](../architecture/engineering-specs.json); proposed semantics do not assert released provider compatibility.
- **Prototype:** [target prototype](../reports/product.html#screen-SCR-14) — fictional fixture; not product coverage.
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved


### SCN-067: Record a first task and distinguish admission from delivery acknowledgement
- **Persona:** P-01
- **Feature:** Task admission
- **Traces:** ST-023, ST-024, ST-034, ST-037, FLW-32 (JTBD-01, JTBD-02, JTBD-07)
- **Entry point:** SCR-32 create/admission subview from SCR-31 or progressive onboarding.
- **Preconditions:** An authorised project exists, possibly without a repository; a task draft has stable identity. Execution context, runner, budget and authority may be unready.
- **Steps:**
  1. Operator records what should change, why and the expected result → a durable Task can exist before execution; its fixture display key is not an implementation milestone ID.
  2. Operator requests execution → the same Task identity is used and the preview checks permitted execution context, runner capability, current scope, budget and blockers. Missing prerequisites preserve the task/draft and return a pre-admission refusal receipt without a TaskRun.
  3. Admission succeeds → a new TaskRun and spawn intent are recorded atomically with pinned configuration/binding; later spawn failure becomes a terminal outcome of that admitted run.
  4. Operator sees a timeout or unknown launch outcome → reconciliation follows the same command/admission identity; the UI does not create another task or paid run merely because a reply was lost.
  5. Delivery proceeds → queued/sent/acknowledged or needs-restart states are distinct; PTY write is not acknowledgement. SCR-32 and SCR-09 retain links to the exact TaskRun, transport and delivery receipts.
- **Expected result:** The first task remains durable and accountable through rejection, admission, spawn and delivery without false completion or duplicate execution.
- **Alt paths:** No repository is acceptable for recording intent; an executable action still requires a certified applicable context/profile. Existing unfinished work may receive another admitted iteration; done/cancelled tasks cannot reopen and further work creates a new linked Task. Runner/session configuration does not prove execution or acceptance.
- **UI elements:** Task draft/brief, readiness preview, stable task identity, admission receipt, TaskRun inspector, spawn outcome and delivery/ack states.
- **States covered:** draft,task-recorded,checking,pre-admission-refused,admitted,spawn-pending,spawn-failed,unknown,reconciling,delivery-pending,acked,needs-restart,error
- **Errors & recovery:** Double submit and post-commit timeout use the same command identity. A late response cannot overwrite another task draft. Unknown dispatch is never an automatic retry; lack of provider acknowledgement remains explicit. Every queued instruction survives FIFO ordering or has a failure receipt. A silent/spinning CLI times out without a blind write. Receiver ACK may arrive before the writer commits its receipt: exact session and digest are validated and acceptance must not be lost.
- **Telemetry:** no new product telemetry implied; durable commands, local operation receipts and source observations are the record.
- **Implementation tasks:** S04, M103, M188, S13, S14, S02, S03.boundary. See [engineering contracts](../architecture/engineering-specs.json); proposed semantics do not assert released provider compatibility.
- **Prototype:** [target prototype](../reports/product.html#screen-SCR-32) — fictional fixture; not product coverage.
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved


### SCN-068: Маршрут работы
- **Persona:** P-01
- **Feature:** Маршрут работы
- **Traces:** FLW-37; SCR-49
- **Entry point:** Навигация рабочего пространства или соответствующая карточка проекта.
- **Preconditions:** Чтение scope подтверждено; изменение требует текущих полномочий.
- **Steps:** Изменение → проверка этапов → причина → новая версия → будущий допуск. Начатый прогон закреплён на прежней версии.
- **Expected result:** Редактировать этапы, отделы, навыки и gates без изменения уже начатого прогона.
- **Alt paths:** stage-edit, validation-error, version-preview, committed, old-version-pinned. Неизвестный исход сверяется по тому же запросу; отказ не расширяет scope.
- **UI elements:** Идентичность объекта, источник, ревизия, предпросмотр последствий, квитанция.
- **Errors & recovery:** Черновик сохраняется по объекту; старый снимок не допускает запись; доступная история остаётся читаемой.
- **Implementation tasks:** M18, M188
- **Prototype:** [Интерактивный путь](../reports/product.html#view-pipeline).
- **Amended 2026-10-11 (AX17-REQ-004):** verdict and owners from the 2026-09-09 audit's per-scenario record (`docs/audit/2026-09-09-final/scenarios-050-078.json`, static source trace, not re-audited since), which this scenario never received because it had no index row then: failed against the target; owners corrected — M188 added. Its gap as the audit read it: No production versioned pipeline editor; route union has no destination. New scenario lacks index row, lowering discoverability.
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved


### SCN-069: Цели и приёмка
- **Persona:** P-01
- **Feature:** Цели и приёмка
- **Traces:** FLW-38; SCR-50
- **Entry point:** Навигация рабочего пространства или соответствующая карточка проекта.
- **Preconditions:** Чтение scope подтверждено; изменение требует текущих полномочий.
- **Steps:** Цель → критерии → задача в плане → результат → явная приёмка. Непривязанные задачи и неготовые критерии остаются видимыми.
- **Expected result:** Задать цель, критерии, границы автономности и состав задач; принять результат отдельно от выполнения задач.
- **Alt paths:** draft, task-linked, ready-for-review, rejected, accepted, superseded. Неизвестный исход сверяется по тому же запросу; отказ не расширяет scope.
- **UI elements:** Идентичность объекта, источник, ревизия, предпросмотр последствий, квитанция.
- **Errors & recovery:** Черновик сохраняется по объекту; старый снимок не допускает запись; доступная история остаётся читаемой.
- **Implementation tasks:** M144, M190
- **Prototype:** [Интерактивный путь](../reports/product.html#view-goals).
- **Amended 2026-10-11 (AX17-REQ-004):** verdict and owners from the 2026-09-09 audit's per-scenario record (`docs/audit/2026-09-09-final/scenarios-050-078.json`, static source trace, not re-audited since), which this scenario never received because it had no index row then: partly met; owners corrected — M190 added. Its gap as the audit read it: No criterion versions, explicit result acceptance/rejection, autonomy limits or supersession route. Task completion remains distinct from goal acceptance only in target design.
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved


### SCN-070: Квоты и использование
- **Persona:** P-01
- **Feature:** Квоты и использование
- **Traces:** FLW-39; SCR-51
- **Entry point:** Навигация рабочего пространства или соответствующая карточка проекта.
- **Preconditions:** Чтение scope подтверждено; изменение требует текущих полномочий.
- **Steps:** Показатель → источник и срок сброса → ограниченная возможность → допустимое действие восстановления. Неизмеренные расходы не становятся нулём; цена без решения не подставляется.
- **Expected result:** Различать доступную квоту провайдера, ёмкость автоматизаций, записанные расходы и подписку Estate.
- **Alt paths:** measured, unavailable, quota-limited, reset-pending, capacity-paused, terms-open. Неизвестный исход сверяется по тому же запросу; отказ не расширяет scope.
- **UI elements:** Идентичность объекта, источник, ревизия, предпросмотр последствий, квитанция.
- **Errors & recovery:** Черновик сохраняется по объекту; старый снимок не допускает запись; доступная история остаётся читаемой.
- **Implementation tasks:** M83, M94, M171
- **Prototype:** [Интерактивный путь](../reports/product.html#view-usage).
- **Amended 2026-10-11 (AX17-REQ-004):** verdict and owners from the 2026-09-09 audit's per-scenario record (`docs/audit/2026-09-09-final/scenarios-050-078.json`, static source trace, not re-audited since), which this scenario never received because it had no index row then: partly met; owners corrected — M171 added. Its gap as the audit read it: No unified usage/capacity/cost/source detail; unreadable quota can disappear instead of explain. Manager cost is unmeasured, subscription terms remain open.
- **Status:** draft
- **Amended 2026-10-23 (0.3.12, CO-392; the operator's walk D-3):** account quotas are Switchboard's, so Fabric shows none: the project page's quota cells, the quota screen and the window's 60-second read are gone. The main process still reads the quota, only before an unattended start (a routine or a chain step is held on an exhausted quota; `apps/desktop/src/main/quota.ts`, `apps/desktop/src/main/routineTick.ts`).
- **Coverage:** none in the interface since 0.3.12 (CO-392); the unattended hold, the quota read before a routine or a chain step starts, is in `apps/desktop/src/main/routineTick.ts` (`createRoutineTick`) over `apps/desktop/src/main/quota.ts`
- **Product:** unobserved


### SCN-071: Настройки рабочего пространства
- **Persona:** P-01
- **Feature:** Настройки рабочего пространства
- **Traces:** FLW-40; SCR-52
- **Entry point:** Навигация рабочего пространства или соответствующая карточка проекта.
- **Preconditions:** Чтение scope подтверждено; изменение требует текущих полномочий.
- **Steps:** Глобальная настройка → проектный override → проверка сужения прав → новая ревизия. Повышение прав не следует из настройки интерфейса.
- **Expected result:** Настроить тему, локаль, поведение пробуждения, хранение и допустимые проектные ограничения.
- **Alt paths:** inherited, overridden, validation-error, saved, read-only. Неизвестный исход сверяется по тому же запросу; отказ не расширяет scope.
- **UI elements:** Идентичность объекта, источник, ревизия, предпросмотр последствий, квитанция.
- **Errors & recovery:** Черновик сохраняется по объекту; старый снимок не допускает запись; доступная история остаётся читаемой.
- **Implementation tasks:** M72, M73, S14
- **Prototype:** [Интерактивный путь](../reports/product.html#view-estate-settings).
- **Amended 2026-10-11 (AX17-REQ-004):** verdict and owners from the 2026-09-09 audit's per-scenario record (`docs/audit/2026-09-09-final/scenarios-050-078.json`, static source trace, not re-audited since), which this scenario never received because it had no index row then: partly met; owners corrected — M152 removed as an owner, which the audit found wrong; S14 added. Its gap as the audit read it: No integrated settings screen for storage/inherited project override/revision checks; scenario references M152 (answer lifecycle) as settings owner, which is incorrect.
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved


### SCN-072: Уведомления и маршруты
- **Persona:** P-01
- **Feature:** Уведомления и маршруты
- **Traces:** FLW-41; SCR-53
- **Entry point:** Навигация рабочего пространства или соответствующая карточка проекта.
- **Preconditions:** Чтение scope подтверждено; изменение требует текущих полномочий.
- **Steps:** Личная привязка → подтверждение субъекта → выбор проектного маршрута → review раскрытия → правило → квитанция доставки. Отказ запроса полномочия остаётся отдельным обязательством.
- **Expected result:** Настроить адрес и типы уведомлений с явным scope; не потерять обязательство после прочтения события.
- **Alt paths:** unbound, challenge, bound, route-review, muted, consent-required, delivery-unknown. Неизвестный исход сверяется по тому же запросу; отказ не расширяет scope.
- **UI elements:** Идентичность объекта, источник, ревизия, предпросмотр последствий, квитанция.
- **Errors & recovery:** Черновик сохраняется по объекту; старый снимок не допускает запись; доступная история остаётся читаемой.
- **Implementation tasks:** M159, M160, M161, M162, M163, M164, M165, M185
- **Prototype:** [Интерактивный путь](../reports/product.html#view-notifications).
- **Amended 2026-10-11 (AX17-REQ-004):** verdict and owners from the 2026-09-09 audit's per-scenario record (`docs/audit/2026-09-09-final/scenarios-050-078.json`, static source trace, not re-audited since), which this scenario never received because it had no index row then: failed against the target; owners corrected — M185 added. Its gap as the audit read it: No bound identity challenge/channel route/consent/delivery receipt UI. Needs-you obligations must stay with Board; cannot create second task store to implement notification read state.
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved


### SCN-073: Диагностика

*2026-10-22: Diagnostics still renders in the project page's side column and, from 0.3.10, shows the operations log's new wording; whether it goes is CO-387 (0.3.11).*
*2026-10-23 (0.3.11, CO-387): Diagnostics is off the project page; the operations log and the build line close История, folded as «Журнал Fabric и версия» (`apps/desktop/src/renderer/src/launch/HistoryScreen.tsx#OpsLog`).*
- **Persona:** P-01
- **Feature:** Диагностика
- **Traces:** FLW-42; SCR-54
- **Entry point:** Навигация рабочего пространства или соответствующая карточка проекта.
- **Preconditions:** Чтение scope подтверждено; изменение требует текущих полномочий.
- **Steps:** Проблема → диагностика источника → отбор безопасных строк → предпросмотр → локальный экспорт. Недоступность источника и пустой журнал различаются.
- **Expected result:** Прочитать состояние источников и безопасный журнал; экспортировать проверяемый набор без секретов.
- **Alt paths:** healthy, partial, source-error, filtered, redacted-export. Неизвестный исход сверяется по тому же запросу; отказ не расширяет scope.
- **UI elements:** Идентичность объекта, источник, ревизия, предпросмотр последствий, квитанция.
- **Errors & recovery:** Черновик сохраняется по объекту; старый снимок не допускает запись; доступная история остаётся читаемой.
- **Amended 2026-10-06 (audit A7-001; wording corrected by 0.3.2 verification DO-18, UX-9):** after the local stack starts, and again whenever the last check is more than five minutes old, Fabric tries each stack port on every non-loopback IPv4 address of this Mac. If one answers, a warning stands above every screen, naming the ports and interfaces (never the addresses), why it matters (the stack's default password) and the remedy, which belongs to the container engine and is the person's to apply (CO-219); the check is recorded as `stack.exposed-on-network`. Nothing answering shows nothing.
- **Implementation tasks:** M81, S05
- **Prototype:** [Интерактивный путь](../reports/product.html#view-diagnostics).
- **Amended 2026-10-11 (AX17-REQ-004):** verdict and owners from the 2026-09-09 audit's per-scenario record (`docs/audit/2026-09-09-final/scenarios-050-078.json`, static source trace, not re-audited since), which this scenario never received because it had no index row then: partly met; owners corrected — S05 added. Its gap as the audit read it: No export selection/preview/redacted export surface. Successful refresh does not clear prior problem; metadata failure swallowed. Diagnostic log is rotating evidence, not archived agent trajectory.
- **Status:** retired
- **Retired 2026-10-17 (0.3.7 wave 1, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** Diagnostics is cut (0.3.7 plan §5); every failure is an act in История (SCN-168) with our sentence and the machine's words beneath it.
- **Coverage:** `apps/desktop/src/renderer/src/DiagnosticsSection.tsx`, `apps/desktop/src/renderer/src/launch/HistoryScreen.tsx`, `apps/desktop/src/main/stackExposure.ts`, `apps/desktop/src/renderer/src/StackExposureNotice.tsx`, `apps/desktop/src/renderer/src/StackExposureNotice.test.tsx`, `apps/desktop/test/stack-exposure.test.mjs` — the ops log, its level filter and the build line, and the stack exposure warning on the home (`EstateHome.tsx`, 0.3.11 review DO-6); safe-row selection and the redacted local export are not built.
- **Product:** unobserved


### SCN-074: Архив и удаление
- **Persona:** P-01
- **Feature:** Архив и удаление
- **Traces:** FLW-43; SCR-55
- **Entry point:** Навигация рабочего пространства или соответствующая карточка проекта.
- **Preconditions:** Чтение scope подтверждено; изменение требует текущих полномочий.
- **Steps:** Review активной работы → архив → восстановление, либо отдельное удаление с повторной проверкой условий и подтверждением точного объекта.
- **Expected result:** Отделить обратимое архивирование проекта от необратимого удаления данных.
- **Alt paths:** active, blocked-running, archived, restore, purge-review, purged. Неизвестный исход сверяется по тому же запросу; отказ не расширяет scope.
- **UI elements:** Идентичность объекта, источник, ревизия, предпросмотр последствий, квитанция.
- **Errors & recovery:** Черновик сохраняется по объекту; старый снимок не допускает запись; доступная история остаётся читаемой.
- **Implementation tasks:** M77, S12, S09
- **Prototype:** [Интерактивный путь](../reports/product.html#view-archive).
- **Amended 2026-10-11 (AX17-REQ-004):** verdict and owners from the 2026-09-09 audit's per-scenario record (`docs/audit/2026-09-09-final/scenarios-050-078.json`, static source trace, not re-audited since), which this scenario never received because it had no index row then: failed against the target; owners corrected — S12, S09 added. Its gap as the audit read it: No operator archive/restore/purge review UI or exact-object command path; generic confirmation is insufficient. Purge must be designed separately from journal-replayable archival.
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved


### SCN-075: Редактор цикла
- **Persona:** P-01
- **Feature:** Редактор цикла
- **Traces:** FLW-44; SCR-56
- **Entry point:** Навигация рабочего пространства или соответствующая карточка проекта.
- **Preconditions:** Чтение scope подтверждено; изменение требует текущих полномочий.
- **Steps:** Триггер → входы и типы → политики отсутствия/пустоты/возраста → проверка DAG → основание → новая версия → отдельные прогоны → граница → Proposal PM.
- **Expected result:** Определить триггер, типизированный граф данных и ограничение полных прогонов.
- **Alt paths:** draft, invalid-cycle, revision-preview, saved, paused, missing-input, empty-input, stale-input, bounded, reconciled. Неизвестный исход сверяется по тому же запросу; отказ не расширяет scope.
- **UI elements:** Идентичность объекта, источник, ревизия, предпросмотр последствий, квитанция.
- **Errors & recovery:** Черновик сохраняется по объекту; старый снимок не допускает запись; доступная история остаётся читаемой.
- **Implementation tasks:** M66, M67, M68, M90, S04, S15
- **Prototype:** [Интерактивный путь](../reports/product.html#view-routine-editor).
- **Amended 2026-10-11 (AX17-REQ-004):** verdict and owners from the 2026-09-09 audit's per-scenario record (`docs/audit/2026-09-09-final/scenarios-050-078.json`, static source trace, not re-audited since), which this scenario never received because it had no index row then: partly met; owners corrected — S04, S15 added. Its gap as the audit read it: No versioned typed DAG editor/event inputs/missing-empty-stale policies or run pinned config. Parent owns additional runtime chain admission defects.
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved


### SCN-076: Сервисные терминалы
- **Persona:** P-01
- **Feature:** Сервисные терминалы
- **Traces:** FLW-45; SCR-57
- **Entry point:** Навигация рабочего пространства или соответствующая карточка проекта.
- **Preconditions:** Чтение scope подтверждено; изменение требует текущих полномочий.
- **Steps:** Выбор службы → её терминал и generation → запрос probe → измеренный healthy/unhealthy или unknown → закрытие вкладки отдельно от остановки → новая generation.
- **Expected result:** Наблюдать службы Claude Swap и agentgateway независимо от допуска агента.
- **Alt paths:** unmeasured, probe-pending, healthy, unhealthy, unknown, closed-tab, exited, new-generation. Неизвестный исход сверяется по тому же запросу; отказ не расширяет scope.
- **UI elements:** Идентичность объекта, источник, ревизия, предпросмотр последствий, квитанция.
- **Errors & recovery:** Черновик сохраняется по объекту; старый снимок не допускает запись; доступная история остаётся читаемой.
- **Implementation tasks:** M10
- **Prototype:** [Интерактивный путь](../reports/product.html#view-service-terminal).
- **Amended 2026-10-11 (AX17-REQ-004):** verdict and owners from the 2026-09-09 audit's per-scenario record (`docs/audit/2026-09-09-final/scenarios-050-078.json`, static source trace, not re-audited since), which this scenario never received because it had no index row then: failed against the target; owners confirmed as they were. Its gap as the audit read it: No service terminal generation/probe/healthy-unknown lifecycle for gateway and Claude Swap. Do not reuse agent admission as service readiness.
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved


### SCN-077: Встроенный браузер
- **Persona:** P-01
- **Feature:** Встроенный браузер
- **Traces:** FLW-46; SCR-58
- **Entry point:** Навигация рабочего пространства или соответствующая карточка проекта.
- **Preconditions:** Чтение scope подтверждено; изменение требует текущих полномочий.
- **Steps:** Цитата → проверка http/https → предпросмотр адреса → отдельный sandbox → источник либо недоступность → назад/вперёд. Cmd-click означает явный внешний переход, popup запрещён.
- **Expected result:** Открывать адресованную цитату с видимым адресом, историей навигации и изоляцией.
- **Alt paths:** pending, loaded, invalid-url, source-missing, popup-blocked, external-request. Неизвестный исход сверяется по тому же запросу; отказ не расширяет scope.
- **UI elements:** Идентичность объекта, источник, ревизия, предпросмотр последствий, квитанция.
- **Errors & recovery:** Черновик сохраняется по объекту; старый снимок не допускает запись; доступная история остаётся читаемой.
- **Implementation tasks:** M74, M75
- **Prototype:** [Интерактивный путь](../reports/product.html#view-internal-browser).
- **Amended 2026-10-11 (AX17-REQ-004):** verdict and owners from the 2026-09-09 audit's per-scenario record (`docs/audit/2026-09-09-final/scenarios-050-078.json`, static source trace, not re-audited since), which this scenario never received because it had no index row then: failed against the target; owners corrected — M75 added. Its gap as the audit read it: No isolated browser production surface. Scenario lists only M74 but sandbox/browser owner is M75; fix trace before assigning agents.
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved


### SCN-078: Предпросмотр медиа
- **Persona:** P-01
- **Feature:** Предпросмотр медиа
- **Traces:** FLW-47; SCR-59
- **Entry point:** Навигация рабочего пространства или соответствующая карточка проекта.
- **Preconditions:** Чтение scope подтверждено; изменение требует текущих полномочий.
- **Steps:** Ссылка файла → точный asset → изображение или страница PDF → смена страницы → возврат к источнику. Недоступный asset и отсутствующий loader отличаются.
- **Expected result:** Показать выбранное изображение или страницу PDF с происхождением и состоянием загрузчика.
- **Alt paths:** image, pdf-page-1, pdf-page-2, source-missing, no-loader, reveal-request. Неизвестный исход сверяется по тому же запросу; отказ не расширяет scope.
- **UI elements:** Идентичность объекта, источник, ревизия, предпросмотр последствий, квитанция.
- **Errors & recovery:** Черновик сохраняется по объекту; старый снимок не допускает запись; доступная история остаётся читаемой.
- **Implementation tasks:** M74, M76
- **Prototype:** [Интерактивный путь](../reports/product.html#view-media-preview).
- **Amended 2026-10-11 (AX17-REQ-004):** verdict and owners from the 2026-09-09 audit's per-scenario record (`docs/audit/2026-09-09-final/scenarios-050-078.json`, static source trace, not re-audited since), which this scenario never received because it had no index row then: failed against the target; owners corrected — M75 removed as an owner, which the audit found wrong; M74, M76 added. Its gap as the audit read it: No image/PDF production preview. Scenario points to M75 (browser), actual preview owner M76; assigning by scenario would implement wrong module.
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved


### SCN-079: Diff выбранного файла
- **Persona:** P-01
- **Feature:** Diff выбранного файла
- **Traces:** FLW-48; SCR-60
- **Entry point:** Навигация рабочего пространства или соответствующая карточка проекта.
- **Preconditions:** Чтение scope подтверждено; изменение требует текущих полномочий.
- **Steps:** Файл → выбранные disk revision и buffer generation → вычисленная разница → unified/split → редактор. Пропавшая ревизия не подменяется пустым файлом.
- **Expected result:** Сравнить точную сохранённую ревизию файла с текущим буфером.
- **Alt paths:** unchanged, changed, split, unified, source-missing, conflict. Неизвестный исход сверяется по тому же запросу; отказ не расширяет scope.
- **UI elements:** Идентичность объекта, источник, ревизия, предпросмотр последствий, квитанция.
- **Errors & recovery:** Черновик сохраняется по объекту; старый снимок не допускает запись; доступная история остаётся читаемой.
- **Implementation tasks:** M76, M62
- **Prototype:** [Интерактивный путь](../reports/product.html#view-file-diff).
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved


### SCN-080: Документ и происхождение задач
- **Persona:** P-01
- **Feature:** Документ и происхождение задач
- **Traces:** FLW-49; SCR-61
- **Entry point:** Навигация рабочего пространства или соответствующая карточка проекта.
- **Preconditions:** Чтение scope подтверждено; изменение требует текущих полномочий.
- **Steps:** Идея с origin → запрет запуска идеи → отдельная research task → документ-основание → список sibling tasks → адресованная задача.
- **Expected result:** Связать идею, отдельное исследование и задачи с точным документом и его ревизией.
- **Alt paths:** document, missing-document, idea, research-created, sibling-linked, origin-unavailable. Неизвестный исход сверяется по тому же запросу; отказ не расширяет scope.
- **UI elements:** Идентичность объекта, источник, ревизия, предпросмотр последствий, квитанция.
- **Errors & recovery:** Черновик сохраняется по объекту; старый снимок не допускает запись; доступная история остаётся читаемой.
- **Implementation tasks:** M124, M130, M134
- **Prototype:** [Интерактивный путь](../reports/product.html#view-document).
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-081: Добавить аккаунт провайдера
- **Persona:** P-01
- **Feature:** Provider accounts
- **Traces:** ST-002, ST-006, FLW-50; SCR-62
- **Entry point:** Настройки → Аккаунты ИИ
- **Preconditions:** Пользователь вправе управлять своим входом; CLI доступен на выбранном устройстве.
- **Steps:** Оставить системный вход или нажать «Добавить аккаунт»; пройти официальный вход; проверить показанную личность и сохранить профиль.
- **Expected result:** Новый проверенный аккаунт доступен только в выбранном runtime; существующий вход и разговоры сохранены.
- **Alt paths:** Отмена и истечение входа удаляют staging; повторный subject возвращает существующий профиль; неизвестная личность не считается успешным входом.
- **UI elements:** Аккаунт, устройство, подтверждённая личность, действие и квитанция результата.
- **Errors & recovery:** Отмена и истечение входа удаляют staging; повторный subject возвращает существующий профиль; неизвестная личность не считается успешным входом.
- **Implementation tasks:** M199
- **Prototype:** [Адрес макета](../reports/product.html#view-provider-accounts) · [проект контракта](../architecture/provider-accounts.md).
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-082: Выбрать аккаунт для новых разговоров
- **Persona:** P-01
- **Feature:** Provider accounts
- **Traces:** ST-002, ST-006, FLW-50; SCR-62
- **Entry point:** Строка аккаунта → Для новых разговоров
- **Preconditions:** Есть два проверенных аккаунта и текущий разговор на A.
- **Steps:** Назначить B по умолчанию; проверить текущий разговор на A; при новом запуске увидеть разрешённый аккаунт B.
- **Expected result:** Существующие разговоры сохраняют выбранный аккаунт; новый запуск закрепляет identity и ревизию.
- **Alt paths:** Старая ревизия, отозванный доступ или внешний дрейф system login требуют повторного чтения; чужой аккаунт не подставляется.
- **UI elements:** Аккаунт, устройство, подтверждённая личность, действие и квитанция результата.
- **Errors & recovery:** Старая ревизия, отозванный доступ или внешний дрейф system login требуют повторного чтения; чужой аккаунт не подставляется.
- **Implementation tasks:** M199
- **Prototype:** [Адрес макета](../reports/product.html#view-provider-accounts) · [проект контракта](../architecture/provider-accounts.md).
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-083: Продолжить разговор с другим аккаунтом
- **Persona:** P-01
- **Feature:** Provider accounts
- **Traces:** ST-002, ST-006, FLW-51; SCR-63
- **Entry point:** Разговор → Аккаунт → Продолжить с другим
- **Preconditions:** A и B одного провайдера и runtime; адаптер подтвердил resume, scope разрешён, checkpoint сохранён.
- **Steps:** Выбрать B; прочитать результат предварительной проверки; продолжить; проверить B и ту же историю; тем же путём вернуться на A.
- **Expected result:** Native conversation и Task сохраняются; Session и TaskRun новые; старые эффекты не повторены; другой разговор остаётся на A.
- **Alt paths:** Неподдерживаемая история, иной provider/org scope или неверный workspace останавливают подготовку.
- **UI elements:** Аккаунт, устройство, подтверждённая личность, действие и квитанция результата.
- **Errors & recovery:** Неподдерживаемая история, иной provider/org scope или неверный workspace останавливают подготовку.
- **Implementation tasks:** M199
- **Prototype:** [Адрес макета](../reports/product.html#view-account-switch) · [проект контракта](../architecture/provider-accounts.md).
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-084: Дождаться безопасной остановки или отменить переход
- **Persona:** P-01
- **Feature:** Provider accounts
- **Traces:** ST-002, ST-006, FLW-51; SCR-63
- **Entry point:** Запрос смены во время работы
- **Preconditions:** Текущий turn или effect ещё не завершён.
- **Steps:** Поставить переход в ожидание границы; отменить до остановки либо дождаться подтверждённого checkpoint.
- **Expected result:** До границы аккаунт A продолжает владеть разговором; отмена убирает только запрос перехода.
- **Alt paths:** Тишина PTY не является границей; неизвестный effect блокирует переход и требует сверки, таймер не запускает B.
- **UI elements:** Аккаунт, устройство, подтверждённая личность, действие и квитанция результата.
- **Errors & recovery:** Тишина PTY не является границей; неизвестный effect блокирует переход и требует сверки, таймер не запускает B.
- **Implementation tasks:** M199
- **Prototype:** [Адрес макета](../reports/product.html#view-account-switch) · [проект контракта](../architecture/provider-accounts.md).
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-085: Восстановить разговор после сбоя смены
- **Persona:** P-01
- **Feature:** Provider accounts
- **Traces:** ST-002, ST-006, FLW-51; SCR-63
- **Entry point:** Сохранённая операция после ошибки или перезапуска
- **Preconditions:** Старый процесс остановлен; целевой resume не подтверждён.
- **Steps:** Прочитать фазу и квитанцию; сверить неизвестный результат по тому же ID; восстановить A только после подтверждения отсутствия нового writer.
- **Expected result:** Интерфейс различает восстановлено, остановлено и результат неизвестен; не выдаёт новый switch за retry.
- **Alt paths:** Нет старого входа или отозвано право — сохранённая история остаётся доступна только в разрешённом scope, автоматического продолжения нет.
- **UI elements:** Аккаунт, устройство, подтверждённая личность, действие и квитанция результата.
- **Errors & recovery:** Нет старого входа или отозвано право — сохранённая история остаётся доступна только в разрешённом scope, автоматического продолжения нет.
- **Implementation tasks:** M199
- **Prototype:** [Адрес макета](../reports/product.html#view-account-switch) · [проект контракта](../architecture/provider-accounts.md).
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-086: Проверить квоту и удалить локальный аккаунт
- **Persona:** P-01
- **Feature:** Provider accounts
- **Traces:** ST-002, ST-006, FLW-52; SCR-62
- **Entry point:** Строка аккаунта → Квота или Удалить
- **Preconditions:** Прочитан тот же auth context, который использует запуск.
- **Steps:** Проверить источник и возраст квоты; при необходимости войти снова; запросить удаление и просмотреть зависимые разговоры.
- **Expected result:** Квота атрибутирована аккаунту; удаление блокируется активными зависимостями; история не удаляется.
- **Alt paths:** Недоступность источника показана как неизвестно, не ноль; новая identity не получает кеш A; удаление default требует выбора замены.
- **UI elements:** Аккаунт, устройство, подтверждённая личность, действие и квитанция результата.
- **Errors & recovery:** Недоступность источника показана как неизвестно, не ноль; новая identity не получает кеш A; удаление default требует выбора замены.
- **Implementation tasks:** M199
- **Prototype:** [Адрес макета](../reports/product.html#view-provider-accounts) · [проект контракта](../architecture/provider-accounts.md).
- **Status:** draft
- **Coverage:** `apps/desktop/src/renderer/src/ProviderAccounts.test.tsx` — возраст рядом с каждым показанным числом, непрочитанное показано как «не прочитано» с причиной (не 0%), заблокированное удаление недоступно и причина стоит на самой кнопке, а не в баннере — но до компонента ещё нельзя дойти из приложения: IPC-канала и точки входа в настройках нет, поэтому сценарий остаётся `draft`
- **Product:** unobserved

### SCN-087: Увидеть границы поддержки и доступа
- **Persona:** P-01
- **Feature:** Provider accounts
- **Traces:** ST-002, ST-006, FLW-52; SCR-63
- **Entry point:** Переход к недоступному профилю или разговору
- **Preconditions:** Другое устройство, неподдерживаемая версия или изменившееся полномочие.
- **Steps:** Прочитать конкретное ограничение; вернуться к разрешённому аккаунту либо выбрать отдельный новый разговор с проверенным переносом контекста.
- **Expected result:** Нельзя назвать перенос текста восстановлением той же сессии; полномочия не расширяются наличием логина.
- **Alt paths:** Отзыв доступа между подготовкой и commit блокирует продолжение; private account и чужая история скрыты.
- **UI elements:** Аккаунт, устройство, подтверждённая личность, действие и квитанция результата.
- **Errors & recovery:** Отзыв доступа между подготовкой и commit блокирует продолжение; private account и чужая история скрыты.
- **Implementation tasks:** M199
- **Prototype:** [Адрес макета](../reports/product.html#view-account-switch) · [проект контракта](../architecture/provider-accounts.md).
- **Status:** draft
- **Coverage:** `apps/desktop/src/renderer/src/ProviderAccounts.test.tsx` — ограничение выведено первым блоком, до любого органа управления, и текст берётся из измеренной матрицы (`limitationOf`), а не из литерала — но до компонента ещё нельзя дойти из приложения: IPC-канала и точки входа в настройках нет, поэтому сценарий остаётся `draft`
- **Product:** unobserved

### SCN-088: Включить автоматическую смену аккаунта
- **Persona:** P-01
- **Feature:** Provider accounts — automatic switching
- **Traces:** ST-006, FLW-53; SCR-63
- **Entry point:** Разговор → Автопереключение
- **Preconditions:** Разрешённый pool, тот же provider/runtime/data scope, подтверждённые identity и native resume.
- **Steps:** Выбрать pool и стратегию; включить для этого разговора; получить свежую квоту выше порога; дождаться подтверждённой границы; автоматически продолжить на подходящем аккаунте.
- **Expected result:** Второе подтверждение не требуется; native conversation, черновик, другая сессия и общий бюджет сохранены. Новая Session/TaskRun и причина смены записаны.
- **Alt paths:** Нет fresh candidate или resume support — hold; уже выполненные effects не повторяются. consume-first может выбрать более ранний подтверждённый weekly reset до порога; best при тех же данных остаётся.
- **UI elements:** Enable/pause, pool, strategy, threshold, состояние и квитанция.
- **Errors & recovery:** Quota source unavailable не считается исчерпанием; истёкший токен сначала проходит согласованный refresh; revoked/disabled аккаунт исключён.
- **Implementation tasks:** M199.auto, M199.resume, M199.ui, M199.acceptance
- **Prototype:** [Автопереключение](../reports/product.html#view-account-switch)
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-089: Остановить автосмену и пережить отсутствие кандидата
- **Persona:** P-01
- **Feature:** Provider accounts — automatic switching
- **Traces:** ST-006, FLW-53; SCR-63
- **Entry point:** Автопереключение → ожидает границы / нет кандидатов
- **Preconditions:** Режим включён; идёт turn, cooldown либо pool исчерпан.
- **Steps:** Исключить резервный аккаунт или поставить режим на паузу; проверить удержание queued switch; при исчерпании увидеть причину и следующий probe; после подтверждённого обновления снова рассчитать кандидата.
- **Expected result:** Нет переключения на исключённый/неизвестный аккаунт и нет повторного spawn; пауза до stop отменяет intent; после stop разрешена только безопасная recovery.
- **Alt paths:** Restart сохраняет cooldown/quarantine/pending operation; manual pin останавливает auto для разговора; resetAt требует свежей проверки.
- **UI elements:** Pause, исключение из pool, hold reason, cooldown, next check и operation receipt.
- **Errors & recovery:** Policy/authority изменилась между tick и commit — stale intent не исполняется. Unknown outcome сверяется по тому же switch ID.
- **Implementation tasks:** M199.auto, M199.usage, M199.ui, M199.acceptance
- **Prototype:** [Автопереключение](../reports/product.html#view-account-switch?state=busy)
- **Status:** draft
- **Coverage:** `apps/desktop/src/renderer/src/ProviderAccounts.test.tsx` — состояние вычисляется из решения и фазы (`autoStateOf`), удержание отличено от исчерпания и от остывания, каждый непригодный аккаунт назван с причиной — но до компонента ещё нельзя дойти из приложения: IPC-канала и точки входа в настройках нет, поэтому сценарий остаётся `draft`
- **Product:** unobserved

### SCN-090: Catch up on a project you left, and lose nothing by looking
- **Persona:** P-01
- **Feature:** Digest
- **Traces:** FLW-21 (JTBD-02), SCR-31
- **Entry point:** the "where we left off" band at the top of the project page
- **Preconditions:** the operator has opened this project before, so there is a mark to read from
- **Steps:**
  1. Operator opens a project they left days ago -> the band lists what happened since they were last here, oldest first, every line a record that opens rather than a summary someone wrote.
  2. Operator reads it and moves on -> leaving acknowledges exactly the lines that were on screen, so returning shows what arrived after them and returning twice shows nothing.
  3. Something happens while the operator is still on the page -> the band refreshes and the new lines appear BELOW what was already there; nothing is acknowledged by the refresh itself.
  4. Operator opens a task from the board -> the band is not on screen behind it, so what was shown counts as read; closing the task shows whatever arrived while it was open.
- **Expected result:** looking at the digest never costs the operator news they have not read, and returning to a project answers "what did I miss" rather than "what is here".
- **Alt paths:** a project opened for the first time says so instead of reporting nothing new, and still establishes the mark — which is what makes the second visit mean "since you were here"; an event of a kind the digest does not display still moves the boundary, so unread kinds cannot pile up into a backlog that only grows.
- **UI elements:** the band with one row per line — kind chip, text, age; a staleness line carrying the age of the last good reading and the reason a refresh failed; a retry beside it.
- **States covered:** first-visit, loading, nothing-new, lines, stale (a refresh that failed with a reading still worth showing), error (nothing read and refused)
- **Errors & recovery:** a refresh that fails keeps the previous digest visible WITH its age and says why, never a blank band and never a silent acknowledgement; a first read that fails says so rather than showing the waiting line or the empty one; a journal head that cannot be read leaves the digest showable and acknowledges nothing.
- **Telemetry:** planned only.
- **Amended 2026-10-06 (audit A4-002, A4-003):** step 3 now holds in code. A refresh acknowledges nothing: every re-read starts from the same mark, so the lines on screen stay and new ones join them; the mark moves only when the person leaves the project's digest. Each content read is paged to the end (no 1000-row gateway cap), so the boundary never acknowledges a line that was not read.
- **Status:** draft
- **Coverage:** `apps/desktop/src/shared/digest.ts`, `apps/desktop/src/main/digestRead.ts`, `apps/desktop/src/renderer/src/DigestSection.tsx`, `apps/desktop/src/shared/digest.test.ts`, `apps/desktop/src/renderer/src/DigestSection.test.tsx`, `apps/desktop/test/digest-boundary.test.mjs`. UX28-03 made the boundary travel with the reading and rendered the staleness line; the digest had NO scenario of its own before this — its only registry mention was a coverage line on SCN-044, which is about the manager's profile. `draft` rather than `built` because no run has watched a person catch up on a real project with it.
- **Product:** unobserved

### SCN-091: Вернуться к агенту у его консоли, прочитав его собственный контекст
- **Persona:** P-01
- **Feature:** Agents
- **Traces:** ST-038, ST-026, ST-034, FLW-54, FLW-21 (JTBD-02)
- **Entry point:** строка агента на SCR-39; вопрос из инбокса; сессия задачи со страницы SCR-32; отдельное окно сессии SCR-25
- **Preconditions:** хотя бы одна сессия открыта; у агента может быть задача, вопрос — или ни того, ни другого
- **Steps:**
  1. Оператор открывает консоль агента — на экране агентов или в отдельном окне сессии -> рядом с терминалом открываются контекстные панели; наверху — вопрос, ждущий ответа, с возрастом ожидания. Панели — часть поверхности консоли, а не отдельная страница: wherever the console is open, the extra panels are there (operator decision, 2026-09-12).
  2. Оператор читает «что мы делаем» -> бриф задачи: что, зачем, ожидаемый результат — с автором (агент написал — сказано явно) и ссылкой на страницу задачи.
  3. Оператор читает прогресс -> заявление агента с давностью, помеченное как заявление (правило SCN-035), рядом с наблюдаемым состоянием; план задачи: закрыто / сейчас / дальше.
  4. Оператор читает «мои решения здесь» -> хронология команд и ответов, данных этому агенту: инструкция запуска, ответы на вопросы, гранты; каждая строка цитирует журнальную запись и открывается.
  5. Оператор отвечает на вопрос прямо в панели -> ответ журналируется тем же механизмом, что на доске вопросов (SCN-050), вопрос уходит из полосы, агент продолжает; окно не менялось.
  6. Оператор отцепляет сессию в отдельное окно -> SCR-25 несёт те же панели как первоклассные элементы: один компонент, размещённый дважды, и никакой из них не «опциональный ящик».
- **Expected result:** контекст одного агента восстановлен и решение принято у консоли, без разматывания транскрипта и без смены экрана; заявление агента ни разу не выглядело как измерение системы.
- **Alt paths:** агент без задачи показывает сессию и место работы, а про остальные панели говорит, что их не из чего собрать; plain-терминал показывает наблюдение и историю команд, без заявлений (нечему говорить протоколом — правило SCN-035); вопрос, разрешённый другим путём, пока панель открыта, помечается разрешённым, а не исчезает.
- **UI elements:** полоса вопроса с ответом inline и возрастом; бриф-виджет с авторством и переходом на SCR-32; прогресс — заявление + наблюдение + план задачи; журнальная история действий (что агент СДЕЛАЛ — правило SCN-049); хронология решений и команд оператора; ссылки-цитаты на каждой строке.
- **States covered:** empty (ни задачи, ни вопросов), loading, success, partial (одна из панелей не прочиталась), stale, error
- **Errors & recovery:** панели читаются независимо — отказавшая именует себя и не гасит соседние; ответ, не прошедший журнал, остаётся в поле с причиной и не теряется; ответ, пришедший для агента, которого оператор уже покинул, отбрасывается (правило SCN-049); устаревшее чтение несёт возраст последнего удачного.
- **Telemetry:** planned only — журнальное событие остаётся записью.
- **Status:** draft
- **Amended 2026-10-06 (audit A5-001, 0.3.2 verification UX-5):** the agent's history shows its newest 200 events in the order they happened, and says when the session has earlier ones the list leaves out (the read takes one beyond the window).
- **Coverage:** `apps/desktop/src/renderer/src/EstateAgents.tsx`, `apps/desktop/src/shared/sessionHistory.ts`, `apps/desktop/src/shared/sessionHistory.test.ts`, `apps/desktop/src/renderer/src/EstateAgents.test.tsx` — the history window; the console return itself is not covered here.
- **Product:** unobserved

### SCN-092: Вернуться в estate холодным и дойти до первого решения
- **Persona:** P-01
- **Feature:** Navigation/continuity
- **Traces:** ST-018, ST-029, ST-032, ST-037, ST-038, FLW-54 (JTBD-02)
- **Entry point:** запуск приложения после перерыва; возвращение к окну
- **Preconditions:** estate работал без оператора: есть журнал, могут быть открытые вопросы
- **Steps:**
  1. Оператор открывает Fabric -> дашборд ведёт вниманием: сколько агентов ждут, избранные проекты первыми; на карточках — ждёт / работает / тихо и последний/следующий запуск.
  2. Оператор открывает старейший вопрос -> консоль агента открывается с вопросом наверху контекстных панелей (SCN-091); проект и задача названы, спуск не потерял адрес.
  3. Оператор отвечает -> счётчик внимания уменьшается; показанное признано прочитанным (граница SCN-090), повторный вход показывает только новое.
  4. Оператор спускается в проект с карточки -> «пока вас не было» и лента решений, затем доска и план; при необходимости — следующая команда через поле запроса или Fabric.
  5. Оператор поднимается по крошке -> вкладки и черновики на месте (правила SCN-060); следующий вопрос или конец.
- **Expected result:** от холодного открытия до первого осмысленного действия — один спуск по раскладушке, без чтения транскриптов; повторный возврат стоит дешевле первого, потому что граница прочитанного сдвинулась честно.
- **Alt paths:** пустой estate предлагает создать проект (SCN-059), а не показывает нулевые полосы; когда ничего не ждёт — дашборд говорит это явно и ведёт к «Было»; вопрос, разрешившийся, пока оператор шёл к нему, показан разрешённым, а не исчезнувшим.
- **UI elements:** заголовок внимания с возрастом старейшего ожидания; карточки с избранными первыми; инбокс двумя дорожками; контекстные панели у консоли агента; крошка Estate / Проект / Агент как один жест подъёма.
- **States covered:** first-visit, loading, nothing-waiting, lines, partial, stale, error
- **Errors & recovery:** уровень, не прочитавшийся целиком, — частичное чтение с именованным отказом, никогда не пустой экран; неотвеченный вопрос не теряется от навигации — он остаётся в «Needs you», пока не разрешён (правило SCN-055).
- **Telemetry:** planned only — журнальным прокси времени-до-решения служит возраст ожидания вопроса.
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-093: Fabric встречает возвращение и отмечает веху, ничего не выдумывая
- **Persona:** P-01
- **Feature:** Manager/Gamification
- **Traces:** ST-039, ST-029, ST-018, FLW-54, FLW-21 (JTBD-02)
- **Entry point:** холодное открытие дашборда SCR-30; закрытие цели или вехи в проекте
- **Preconditions:** estate имеет журнал; CEO-провайдер может быть привязан или нет
- **Steps:**
  1. Оператор открывает Fabric холодным -> над дайджестом приветственная полоса от
     Fabric: одно предложение с фактами и возрастами («3 решения; 1 вопрос ждёт 2 ч»),
     каждый факт открывается в свою запись. Это озвученный дайджест, не вторая сводка —
     границу прочитанного двигает тот же механизм (правило SCN-090).
  2. Цель закрывается -> в полосе «Было» появляется строка-веха с орнаментным бейджем
     (ярлык, не контрол) и словом рядом, с цитатой журнального события; появляется один
     раз — повторный вход не переигрывает момент.
  3. Fabric предлагает поднять автономию -> interrupt-чип с уликами («10 прогонов без
     вмешательства — предлагаю уровень 2»); решение остаётся оператору через очередь
     одобрений (механика SCN-027), отказ журналируется с распиской.
  4. Оператор включает reduced motion -> все моменты статичны, содержание полное,
     ни одна петля не выживает.
- **Expected result:** возвращение начинается с одного голоса, который цитирует записи;
  праздник не двигает layout, не блокирует и не действует сам; ничего не награждено —
  всё пересчитано.
- **Alt paths:** пустой estate — Fabric представляется и ведёт к созданию первого
  проекта (SCN-059), а не показывает нулевые полосы; источник вехи позже superseded —
  строка помечена superseded, не стёрта и не переиграна (правило SCN-040); CEO-провайдер
  не привязан — полоса помечена «компилировано системой», без голоса персонажа.
- **UI elements:** приветственная полоса со знаком Fabric; строка-веха с бейджем и
  словом; interrupt-чип предложения с уликами; маркер источника голоса (Fabric/система);
  цитаты на каждой строке.
- **States covered:** first-visit, empty, loading, success, stale, error
- **Errors & recovery:** компиляция полосы не удалась — предыдущая остаётся видимой с
  возрастом и причиной (правило SCN-090); предложение, не прошедшее журнал, остаётся на
  экране с причиной; празднование никогда не рядом со стримящим терминалом (правило
  циферблатов foundation).
- **Telemetry:** planned only — журнальное событие остаётся записью.
- **Status:** retired
- **Retired 2026-10-17 (0.3.7 wave 1, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** the profile block and its greeting voice on the home are cut (0.3.7 plan §5); Главная's heading says the state in one plain sentence (SCN-163).
- **Coverage:** none yet
- **Product:** unobserved

### SCN-094: Открыть дашборд как страницу Fabric и прочитать путь до «сейчас»
- **Persona:** P-01
- **Feature:** Manager/Gamification
- **Traces:** ST-040, ST-039, ST-029, FLW-54, FLW-21 (JTBD-02)
- **Entry point:** холодное открытие дашборда SCR-30; вью решений SCR-33; страница Fabric SCR-36
- **Preconditions:** estate имеет журнал; аватар может быть сгенерирован или нет
- **Steps:**
  1. Оператор открывает дашборд -> верх — компактная полоса Fabric: персональный аватар, имя/роль, мини-график значимых событий за 28 дней и пульс с возрастом наблюдения; справа в верхней строке компактное «Где остановились»; ниже независимые колонки: доска → проекты и Live. На узком экране: профиль/ритм → возврат → доска → проекты → Live.
  2. Оператор открывает полосу «Решения» -> единый таймлайн: маркер «мы сейчас здесь» сверху со срезом и числом работ, ниже — как мы сюда пришли, новое сверху; каждый элемент раскрывается до основания и открывает источник.
  3. Оператор открывает полный таймлайн -> та же лента целиком; рядом граф показывает ТЕ ЖЕ записи нодами, растущими слева направо; выбор ноды открывает её запись.
  4. Оператор генерирует своего Фабрика на странице Fabric -> выбирает стиль, получает персональный облик; облик появляется везде, где показан Fabric, и не меняет никаких полномочий (ADR-0057).
- **Expected result:** первый экран помогает выбрать вопрос на доске или продолжить проект. Компактный профиль/пульс не вытесняют эти действия; график открывает источники, Live показывает начало, ожидание и передачу результата без выдачи их за принятую работу. Подробная история раскрывается по запросу; формулы прогресса остаются в Пульсе.
- **Alt paths:** аватар не сгенерирован — нейтральный знак, не пустое место; пустой журнал — уровень 1 с честной подписью и таймлайн из одного маркера «мы сейчас здесь»; граф недоступен — таймлайн остаётся полным представлением (правило SCN-053: список эквивалентен).
- **UI elements:** компактная верхняя полоса (цветной аватар, имя·роль, 28-дневный мини-график, пульс и следующий обзор); доска; «Где остановились» с решением/сейчас/дальше; проекты; Live с раскрытием источника и паузой показа; стили облика и «Сгенерировать моего Фабрика»; таймлайн с маркером «сейчас», chip-видами и раскрытием; переключение таймлайн/граф; подписи регистров у каждой цифры.
- **States covered:** first-visit, empty, loading, success, stale, error
- **Errors & recovery:** регистры уровня не прочитались — уровень не показывается вовсе (незнание ≠ единица), строка говорит какой регистр молчит; генерация в макете — демонстрация без вызова модели и говорит это словами; таймлайн при отказе чтения держит предыдущую ленту с возрастом (правило SCN-090).
- **Telemetry:** planned only — журнальное событие остаётся записью.
- **Status:** retired
- **Retired 2026-10-17 (0.3.7 wave 1, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** Pulse and the dashboard page are cut (0.3.7 plan §2, §5); what was done is read in История (SCN-168).
- **Coverage:** none yet — прототип (`scripts/product/workbench.mjs` view `estate`/`profile`, `renderers.mjs` view `decisions`) — целевой дизайн, не runtime
- **Product:** unobserved

## Персональный Fabric и пульс · 2026-09-15

Целевое уточнение по запросу оператора, режим Update; подробности [P-01…P-06](../launch/pulse.md). Это интерактивный дизайн, не повышение runtime Coverage/Product.

- SCN-094: в знакомстве с Fabric выбрать характер и вариант цветного аватара, сгенерировать ещё варианты, сохранить или пропустить; один выбранный облик на Home и у Fabric в остальных приоритетных экранах. Изменение черновика не меняет сохранённый облик; повторный вход его сохраняет. Генерация SVG в R0 работает без модели; AI-адаптер позже сохраняет тот же контракт asset revision.
- SCN-094, SCN-093: график значимых результатов и решений за 7/28 дней открывает список источников дня; unknown coverage отличается от нуля; каждый счётчик определён. Heartbeat и токены не дают прогресс. Пустая история не содержит выдуманного streak.
- SCN-040, SCN-090, SCN-091: пульс отдельно показывает наблюдение host/agent, возраст, фазу, ожидание и известный результат. Разрыв связи оставляет датированный снимок. Пауза ленты не останавливает агентов; новые события показываются по явному действию без скачка фокуса.
- SCN-046: следующий обзор связан с cycle definition и окном; enabled, last observation, last outcome и next due не сливаются. Пропущенное окно desktop при выключенном приложении не было исполнено.
- SCN-094, SCN-053: релиз открывается из графика/проекта: изменения → задача/решение → build → публикация в среду → независимая проверка; статус кандидата не выдается за verified. Откат сохраняет исходную запись. Чужой проект не подставляется при отсутствии данных.
- Общие recovery: loading/empty/error/denied/partial/conflict доступны в макете; conflict не применяет выбранный аватар до перечитывания; отказ доступа скрывает данные; источники статистики недоступны — неизвестно, не ноль. Макет явно обозначает синтетические данные и не выполняет deploy/LLM/runtime commands.

## Приоритетный запуск · 2026-09-15

Уточнение SCN-090, SCN-091, SCN-094, SCN-041, SCN-046 и SCN-053 по запросу оператора; детализация target остаётся draft. [Текущий вход](../launch/README.md).

- SCN-094: верх Home — узнаваемый аватар Fabric, имя/роль и компактный накопительный прогресс с объяснимыми входами; затем актуальная доска рядом с «Где остановились», под доской featured-проекты с изменяемым порядком, справа под возвратом — Live. Подробный график и релизы открываются из верхней полосы/навигации. Порядок проектов не меняет бизнес-приоритет. Нет источника статистики — нет выдуманных счётчиков.
- SCN-041: доска поддерживает ежедневный разбор и ручные темы с источником; состояния актуально/на следующий раз/разобрано. Отложить можно с причиной, закрыть — с итогом. Просмотр и начало разбора не закрывают обязательство; итог обсуждения не равен допуску запуска. Темы сохраняются для следующего разбора; новые задачи не копируются в независимый task store.
- SCN-090: проект показывает цель, последнее решение, текущее состояние, следующий шаг, доску, агентов и циклы. Недоступность источника не трактуется как здоровая тишина.
- SCN-091: агент показывает исходный бриф, исторический пакет конкретного запуска, инструкции оператора, принятые решения, предыдущие задачи/сессии, последнее наблюдение и дальнейший план. Предварительный следующий пакет явно не передан. Содержимое пакета не выдаётся за скрытые рассуждения модели.
- SCN-046/SCN-053: отдельное планирование раскрывает портфель → проект → цель → работу → этапы; breadcrumb возвращает на родительский уровень. DID и SHOULD имеют отдельные подписи и представления; связь зависимости подписана, расположение проектов не создаёт зависимость. Доступен эквивалентный список.
- Все пять мест: loading, empty, error, denied, partial/stale, conflict и recovery. В макете это адресуемые состояния; runtime coverage не меняется. Дополнительные переходы: Home → Board → Agent → Project → Planning; Board → source → back; Agent → historical run → its pack.

## Сверка целевых макетов · 2026-09-07

[Контракт макетов](mockup-contract.md) и [матрица приёмки](../reports/completeness.html#matrix)
уточняют executable target для существующих сценариев, не меняя их runtime coverage.
Первый проект: независимые drafts → обзор starter → stable create → отдельный PM gate.
Вопрос: submitting/unknown/conflict → одна квитанция → отдельная доставка.
Обязательство: адресный resolver изменяет source, затем все previews читают результат.
Циклы: выбранная routine → окно → допуск → полный Run → проверка → boundary Proposal;
unknown сверяет прежний tickId. Контекст памяти и графа привязан к фактическому Run.
Проверки: `scripts/test/product-integrated.browser.cjs`,
`product-workbench.browser.cjs`, `product-schedule.browser.mjs`.

## Компактный Home · 2026-09-15

Уточнение SCN-094/040/090 по прямому запросу оператора; [спецификация и проверка](../launch/home-layout.md). Target остаётся draft; runtime Coverage/Product не меняются.

- При 1280×720 доска и «Где остановились» начинаются на одной высоте под компактной полосой; главный переход к разбору виден сразу.
- Mini-chart — один переход к полной аналитике, без 28 дополнительных tab stops. В Пульсе доступны день, тип события, источник и формула.
- Live: время, агент, проект, короткое действие; подробности и источник по раскрытию. Начало работы не доказывает текущую активность; передача результата не равна его принятию.
- Пауза относится только к показу. Новые события не сдвигают чтение автоматически; оператор явно показывает накопленное. Ошибка источника сохраняет возраст снимка.
- На узком экране порядок остаётся доска → возврат → проекты → Live; состояние проекта и приоритет вопроса не скрываются ради экономии места.


## Доступность R0 · 2026-09-16

Текущая детализация target поверх SCN-094/090/091/041/042/047/050/056/075; прежние dated snapshots сохраняют историческую композицию. [Выполнение и матрица](../launch/r0-ui.md). Coverage/Product не повышаются проверкой прототипа.

- SCN-094: компактный возврат сверху справа; ниже Board/Projects и Live — независимые стеки. Дни графика показывают значение на hover/focus; один Tab-вход, стрелки/Home/End и Enter до источников выбранного дня. Live зелёный только при свежем показе; paused/unknown статичны; reduced-motion отключает пульсацию.
- SCN-031/059/060/043: созданный проект появляется на Home; переход сохраняет project ID. Перестановка локальна и не меняет приоритет обязательств. Чужие данные не подставляются в пустой проект.
- SCN-041/050: Board читает исходные обязательства с точным destination; заметка разбора не выдаёт grant. Контекстный пример CTX-Q-12 отделён от staging Q-12. Ответ → запись → pending delivery → отдельное подтверждение; review → принять/вернуть с замечанием. Partial/conflict сохраняют чтение и черновик, удерживая запись; denied скрывает содержимое.
- SCN-091/052: прошлый запуск имеет свой статус, пакет и консоль; текущий открывается явно. Предложенный следующий пакет не переписывает прошлый.
- SCN-042: Home → Fabric (всё пространство); проект/задача → Fabric (точная область). Текст или голосовой пример → проверка/исправление → отправка → предложение → явный адресат → запись с квитанцией → Board → исходная реплика. Отказ callback не считается сохранением; повтор использует тот же request ID.
- SCN-042/047/075: «Создать агента» / «Настроить цикл» → scoped draft → ручная форма → проверка → сохранение; активация отдельна. Смена цикла не переносит черновик другого ID. Неизвестный ID показывает missing.
- OF-07/08/09: голос в макете демонстрирует record/stop/processing/transcript/review/cancel и denied/device/silence/interrupted/STT errors; отправка никогда не происходит автоматически. Журнал хранит ID, время, исходный текст, исправленную версию и область; переключение контекста прерывает запись. Durable restart, реальный capture/STT и исправления атрибуции входят в runtime-пакеты, а не подтверждены этим примером.

## Уточнение CEO и знакомства · 2026-09-16

Применяется к SCN-031/042/044/059/093/094; Status остаётся draft, Product — unobserved. [REQ и контракт](../launch/ceo-onboarding.md).

- SCN-042: открыть Fabric с любого рабочего экрана → панель поверх справа, без смены сетки/scroll основной страницы; фокус в поле, Escape возвращает к launcher. На узком экране диалог заполняет viewport; фон и draft не уничтожаются. Source-link фокусирует исходную реплику. Имя и аватар едины.
- SCN-042: спросить о проектах/контексте/доске → scoped sourced answer, exact links, без создания Task. «Создай задачу» → настоящая Task с receipt; «добавь тему» → отдельная тема Board. Неясный проект требует выбора; read/paused не выдаются за отсутствие данных. Настройки/циклы/harness достигаются через тот же command/form path. Unsupported intent предлагает примеры, а не обещает исполнение.
- SCN-044/094: уровень знакомства выводится из наблюдаемых milestones и раскрывает основание; он не изменяет authority/provider capabilities. Начальный аватар можно оставить, обучение пропустить.
- SCN-031/059: «Начать» → папка проектов / один проект / идея → read-only discovery → выбор одного первого проекта → название/результат → кандидат агента или позже → review → create receipt. Denied/partial/no-repos/cancel/deduplicated candidates имеют разные состояния; выбранное сохраняется. В прототипе scan обозначен примером.
- SCN-059: созданный Project → знакомство Fabric → первая рабочая Task → учебная Board-тема → обзор продолжения. Все записи принадлежат реальному созданному в макете ID, не Atlas. Guide отдельно отмечает completed/skipped; переход по ссылке сам по себе не доказывает сохранение/активацию.
- SCN-059: «Позже» скрывает обучение, сохраняет бизнес-данные; «Продолжить знакомство» возвращает exact estate/project/revision. После ACL loss содержимое скрыто. Draft/create dedupe не пересекают Estate. Restart persistence требует runtime; память страницы не объявляется durable.

## Уточнение спокойного интерфейса · 2026-09-16

SCN-040/041/045/052/090/091/093/094: первый слой отвечает «что происходит, что требует меня, что дальше»; технические параметры, источники и проверка макета раскрываются отдельно. Критические ошибки, pending outcome и восстановление не скрываются. Действия Task/Run не дублируются; brief сначала читается, затем явно редактируется. Настройка агента имеет одну форму и один адресный результат.

SCN-093: scope находится над composer. При открытии используется текущий Project либо общий контекст; ручная смена scope меняет разговор, сохраняя основной экран. Черновики областей не переносятся. Контекстные ссылки (project/task/decision/event) добавляются явно, показываются плашками и снимаются до отправки; исходная реплика хранит snapshot ссылок. Ссылки из другого проекта не меняют адресата записи. Утраченный доступ блокирует отправку с недоступным источником. «Обсудить с Fabric» прикладывает текущий объект без автоматической отправки.

SCN-031/059/094: уход из знакомства не считается выполнением этапа; завершение — по результатам. Дубликат архивного проекта предлагает адресное восстановление и сохраняет черновик. Помощь начинается с трёх частых задач, полный каталог раскрывается. Статус сценариев и production observation остаются прежними: это target UI.

## First-release canonical additions · 2026-09-25

### SCN-095: Configure Fabric and discover a real project
- **Persona:** P-01
- **Feature:** CEO-first onboarding
- **Traces:** ST-001, ST-022, ST-031, FLW-55 (JTBD-01, JTBD-02)
- **Entry point:** First launch; global New project; launch-start/onboarding aliases; saved setup resume; SCR-64 CEO asks to add a source.
- **Preconditions:** Before entry, startup verifies the database against the compiled schema range. Missing/invalid packaged build identity, unknown/older/newer schema blocks workspace services before recovery, writes or agent launch. Absent manifest in an unpackaged development run alone may use the compiled range. Identity and provider readiness belong to the estate; source selection belongs to its draft. No source content or persona choice grants write authority. *(Amended 2026-10-10 by [ADR-0131](../adr/0131-a-database-only-the-old-seed-has-touched-is-given-to-the-local-operator.md), 0.3.4: after the schema check the operator's identity is established; a default Estate only the old seed has touched is first granted to the local operator, and any other identity refusal is the native startup error's own cause, `identity-refused`, with the reason in its details.)*
- **Steps:**
  1. Operator opens SCR-36 r0-setup → sees Fabric name and colour avatar with usable defaults, optional customisation and one continuation action.
  2. Operator chooses Claude Code or Codex on SCR-05 r0-provider → Fabric checks installation, authentication and required capabilities. Missing installation offers instructions/open official installer; auth-required offers login and recheck. These actions never claim readiness before observation.
  3. Operator opens SCR-27 r0-source → chooses one project folder or a parent folder in a system picker; URL is the only typed source address. Cancel returns focus and preserves earlier selection.
  4. *(Amended 2026-10-03 by [ADR-0100](../adr/0100-first-run-and-start-paths.md): a parent folder is now SCN-128's checklist — each ticked repository becomes its own Project.)* Fabric enters SCR-27 r0-discovery → records scan identity, reads only the chosen scope and reports stages/sources. A parent folder produces candidate sources; operator selects several together, the first selected is the primary and can be changed. One Project contains the primary and related sources, each with its own reference, purpose, read status and authority. Related sources never silently become separate top-level Projects or writable roots. Repository instructions remain data until admitted by policy.
  5. Fabric derives the name and reports what the project is, known guides, Git state, recent work and unknowns on SCR-30 r0-home / SCR-31 r0-project. Every fact links to source/revision; a proposed next action stays a proposal until admitted.
  6. Operator accepts or corrects the next action, opens its task or continues later → the same Project owns facts, history and decisions, independent of provider.
- **Expected result:** First value is an inspectable sourced project overview and saved continuation. The operator supplies source and intent only where discovery cannot establish them; no required rename, purpose form or separate review/check step.
- **Alt paths:** Saved CEO with ready provider goes directly to source; saved CEO with unready provider goes to recovery. Reading saved work remains reachable when the application schema is admitted; an unsupported newer database is not promised a safe read-only mode. No-source/empty folder offers choose another source or record an idea without inventing repository facts. Generation of avatar variants is optional and does not delay discovery.
- **UI elements:** Name/avatar defaults; provider readiness and recheck; folder picker and selected-source chip; URL field; scan stages/cancel; partial-result panel; source disclosures; compact dashboard with Board/Projects and Resume/Live.
- **States covered:** first-visit,ready,loading,missing-provider,auth-required,unsupported,source-selected,picker-cancel,scanning,partial,empty,denied,duplicate,cancelled,stale,unknown,error
- **Errors & recovery:** Startup schema failure uses the existing native error dialog: safe reason and Retry for a fresh schema observation; an older database names the bundled stack folder, `supabase migration up --local` and the release runbook, requiring stopped writers, verified backup and copy rehearsal before that command; artifact errors require installing/rebuilding and restarting. Retry does not migrate, resume work or imply compatibility. No raw database errors/credentials. The prototype exposes these fixtures only in its review tools, and repeating a failed check stays blocked. Failed/missing executor blocks agent scan only. Permission denial offers choose another folder/retry after access change. URL authentication, unreachable source and invalid URL have local recovery. Cancelled scan cannot later overwrite a newer source. Timeout preserves partial facts and unknown status. Duplicate identity reconciles once; no double project on retry. Re-entry never restarts an uncertain run blindly. Macros/commands/dependency installation found in a repository are not executed during read-only observation. *(0.3.5 review: the dialog's remedies are each OS's own — scoop and Docker Desktop on Windows, the Supabase CLI release packages and Docker Engine on Linux, never brew, OrbStack or a DMG there; a schema version that could not be read says which way it failed — no answer in time, no connection, an error from the database, or an answer that is not a schema version — and that cause is in the copied details and the log, never the database's own text.)*
- **Design rationale:** Progressive disclosure and one primary action; recognition through the system picker; CEO performs interpretation while the operator controls scope and effects.
- **Telemetry:** planned only; measure sourced insight → next action saved → successful return, never synthetic progress.
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-096: Stop an executor and continue the same work
- **Persona:** P-01
- **Feature:** Agent continuity
- **Traces:** ST-006, ST-017, ST-034, FLW-56 (JTBD-01, JTBD-02, JTBD-07)
- **Entry point:** SCR-32 r0-work terminal/task, SCR-39 agent, SCR-64 scoped CEO stop request.
- **Preconditions:** Task, run, session and process identities are separate. A resumable context can be reconstructed from persisted observations without cooperation from a hung agent.
- **Steps:**
  1. Operator requests stop → r0-work shows stop-requested, preserves output and waits for observed process/child-command termination; closing the terminal is independent.
  2. Operator encounters timeout → can check the same Stop again or explicitly confirm force termination of the selected Session; cancellation of that confirmation leaves the unknown state unchanged; confirmed stopped appears only after observation, otherwise unknown remains and concurrent continuation in the same writable worktree is blocked.
  3. Operator opens Context for continuation → sees goal/criteria, decisions, summary, exact recent tail, files/uncommitted changes, branch/worktree/HEAD, checks, unknown effects and next plan with source revisions.
  4. Operator selects Continue → chooses native resume if supported, a fresh session of the same provider, or another ready provider. A fresh Claude Code is not a native resume and never revives the old process.
  5. Fabric verifies source revision, access, provider capability, worktree and old executor state → creates one linked continuation run, loads the chosen context and observes acknowledgement separately from spawn.
  6. Operator sees the new executor's current work and can navigate the old run and its unchanged historical context.
- **Expected result:** The same task can continue after voluntary stop, crash or replacement without losing observable context or allowing an old and new writer to silently overlap.
- **Alt paths:** Completed accepted work starts a linked new task if scope changes. Same-provider native resume unavailable offers fresh session with context. Copy/export context is available without starting a successor. User may stop and leave indefinitely.
- **UI elements:** Stop, stopping status, force termination, observed stopped/unknown, context disclosure/copy, Continue chooser, provider readiness, prior-run chain.
- **States covered:** running,stop-requested,stop-timeout,stopped,unknown,context-building,context-partial,ready,unsupported,auth-required,branch-changed,starting,spawn-failed,delivery-pending,continued,view-detached,backend-lost
- **Errors & recovery:** Never declare stopped from button ACK. Reconcile unknown commands before retry; no automatic Git reset/commit or uncommitted-change deletion. Stale HEAD/source requires refreshed pack. Provider failure preserves old run and pack. Duplicate continue uses the same request identity. Credentials and hidden model reasoning are not context payload. Read permission loss removes protected content.
- **Implementation boundary (2026-09-27):** native Home/Project AgentTile and detached Session expose requested/verified/unknown/refused Stop receipts; Workspace exposes the same state. Root exit never marks Task finished. Unknown retains inspection and blocks dismissal/new writable admission. Provider quiescence and portable Continue remain unaccepted; module/renderer tests do not promote this full scenario to native coverage.
- **View and execution · 2026-09-28 ([ADR-0081](../adr/0081-codex-execution-uses-an-owned-authenticated-loopback-backend.md)):** the terminal window is a view of the agent, not the agent. Closing or losing the window shows *window closed — the agent is still working* and offers Reattach; it never stops anything. If Fabric loses the agent's backend, every window of that agent shows *connection to the agent lost* and stops accepting input; the work is not reported stopped. An agent whose end cannot be confirmed stays *outcome unknown*. Stop turns off input in every open window of that agent at once.
- **Telemetry:** planned only; stop observation and linked run receipts are evidence, not UI event counts.
- **Status:** draft
- **Amended 2026-10-17 (0.3.7 wave 1, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** «Остановить» stops at once — no confirmation, the force step included ([ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md) §1); the foot of the place says «Остановлено · Отменить», and the inverse starts the console again from where it stood (SCN-169).
- **Amended 2026-10-19 ([ADR-0170](../adr/0170-the-person-says-an-ended-runs-work-is-over.md), CO-327):** when the agent's process has ended and its Stop cannot be proved (no provider receipt), the console says so and offers «Работа закончена»; pressing it frees the task (back to the queue, its claim gone) and the act line offers «Отменить», which holds the task again unless it has moved on since. Only a person can say it, and not while the process runs.
- **Coverage:** none yet
- **Product:** unobserved
- **Amended 2026-10-20 ([0.3.7 review](../evidence/reviews/0.3.7/iteration-1/2026-10-20-ux.md), UX-1, UX-5):** after «Работа закончена» the console says «Вы отметили: работа закончена», not that Fabric confirmed the stop. After «Отменить» the console again shows the stop as unconfirmed and offers «Работа закончена»; it never offers «Убрать из списка» while the stop is unresolved. A refused «Работа закончена» says why in our words, with the machine's words on their own line.

### SCN-097: Export and import my private conversation history
- **Persona:** P-01
- **Feature:** Backup/recovery
- **Traces:** ST-001, ST-028, ST-033, FLW-58 (JTBD-01, JTBD-02)
- **Entry point:** SCR-52 Settings → SCR-65 Private history.
- **Preconditions:** The operator has private conversations with Fabric in an Estate they belong to. Import needs an Estate restored from the matching archive (SCN-065). Decided by [ADR-0079](../adr/0079-private-conversation-archives-preserve-history-not-authority.md).
- **Steps:**
  1. Operator chooses Export private history → Fabric writes a new file readable only by this user and never overwrites an existing one; the result says exported, with the file name, or names why it failed.
  2. After restoring an Estate, operator chooses Import private history and picks the file → Fabric checks that it is this person's history for exactly this restored Estate before writing anything.
  3. Operator confirms → the conversations come back as history: *history restored; nothing will be sent*. No draft, pending send or agent work is revived.
- **Expected result:** Each person carries their own private history between installations; nobody else's history and no authority travels with it.
- **Alt paths:** Another person imports their own file into the same restored Estate independently: an archive whose private history belongs to someone else is still restored, and the result says *private history not imported: it belongs to someone else* (ADR-0079 §4). Cancelling leaves nothing half-written. A result that is unknown is looked up with the same operation, never repeated blindly.
- **UI elements:** Export private history; Import private history; file picker; verification result with reason; confirmation; result with "nothing will be sent".
- **States covered:** empty, exporting, exported, export-refused, verifying, refused, importing, result-unknown, imported, denied, error
- **Errors & recovery:** Refusals name a fixed reason without showing any message text, digest or path: stale (history changed during export), not this person's history, not this Estate, altered, incomplete, too large, unsupported version, already imported. A failed import leaves the restored Estate usable with private history unavailable: the result says *restored; private history not imported: <reason>*, and the Estate can be opened. The file is kept until the import result is known — Fabric's own private copy, taken before the first call.
- **Telemetry:** no new product telemetry; the import receipt is the record.
- **Implementation tasks:** A1-1, A1-2, A1-4, A1-6 of the [first-slice plan](../evidence/plans/2026-09-27-first-slice-plan.md).
- **Status:** draft
- **Coverage:** import is fused with restore (SCN-065): `apps/desktop/src/main/privateHistory.ts#exportHistory` / `#restore`, `apps/desktop/src/renderer/src/PrivateHistoryPanel.tsx`. Tests: `apps/desktop/test/private-history-service.test.mjs`, `apps/desktop/test/private-history-native-db.test.mjs`, `apps/desktop/test/private-history-db.test.mjs` (owned cluster), `PrivateHistoryPanel.test.tsx`. No separate Import private history action yet.
- **Product:** unobserved

### Target refinement · 2026-09-26 · team visibility and one conversation

SCN-041/042 and the existing return-to-context scenarios: Home shows current work across Projects; Project shows only its own team/work. Each row identifies role/provider, Project, Task and observed state, and opens the exact session. Continuations replace the predecessor in the current roster; other stopped tasks remain reachable. Empty, complete, waiting review, stopping and unknown have explicit treatments. Unknown outcome never authorizes a replacement execution. Attention filter and history remain distinct from Live events.

SCN-042: card, typed reply and reviewed dictation resolve to one addressed proposal/version and command path. Accept records one result; cancel declines only that proposal; a question preserves it; refinement invalidates its previous buttons. Ambiguous destination asks for selection, and a reply cannot silently choose an unrelated Project. An applied proposal remains a receipt, not a reusable action. Prototype parser examples are bounded; native intent resolution and durable commands remain unimplemented. See [operator workspace acceptance and packets](../launch/operator-workspace.md).


## Memory workspace refinement · 2026-09-26

SCN-057: SCR-34 adds the R0 memory workspace: from Home, Project or Work, choose visible project scope, search sessions/decisions, inspect source attribution and exact Run, then attach the source to the existing Fabric conversation. Filters and source selection never launch a process. Next context and exact past context remain distinct. Search→timeline→bounded source range is the target native read contract; denied/missing refs share a safe response, revocation rechecks before expansion and compile. Empty history, no matches, partial capture, index lag and unavailable source are separate states. The R0 fixture uses only page-local known Projects/Runs/Board decisions; it does not claim real transcript ingestion, grants or token counting. MEM-P0…P7 in docs/launch/memory/plan.md own native delivery; Coverage and Product remain unchanged.

SCN-039: SCR-34 keeps six native store counts and freshness as implementation evidence; target memory workspace leads with useful search and last work rather than large counters. Source coverage stays visible and does not imply complete capture. A summary cannot overwrite an operator Decision.

## Agent registry, in-machine protocol, pipelines, traces · 2026-09-29

Source: the approved [design](../evidence/specs/2026-09-29-agent-registry-design.md) (REQ-01…REQ-24). Module ids AR-n are the design's modules (§12).

### SCN-098: See every agent on this Mac
- **Persona:** P-01
- **Feature:** Agent registry
- **Traces:** ST-041, FLW-59 (JTBD-05)
- **Entry point:** SCR-30 Estate home → Agents; SCR-04 Agents → Add agent.
- **Preconditions:** Coding agents are installed (runner catalogue), services have descriptors in `services/`, providers have entries in `providers/`; Fabric has its own agents.
- **Steps:**
  1. Operator opens Agents → the registry shows three groups — Coding agents, Your agents, Fabric agents — each card with name, version, health and capabilities; the last scan time is shown.
  2. Operator opens a card → it shows source (runner catalogue, service, provider, Fabric), manifest revision, capabilities with their effects, the projects it is bound in, and one primary action by state.
- **Expected result:** Every agent available on this Mac is visible once, in its group, with what it can do and whether it is healthy.
- **Alt paths:** Search by name or capability; filter by health. Fabric agents always appear, even with nothing else installed.
- **UI elements:** Group headers; agent cards; health badge (text + icon, never colour alone); capability chips; last-scan time; search; filter; primary action per card.
- **States covered:** loading, success, partial, empty, error
- **Errors & recovery:** A source that cannot be read (for example `services/` unreadable) is named in a banner while the other sources still show; the scan never blocks the screen.
- **Telemetry:** registry scan duration and counts per source (ops log only).
- **Implementation tasks:** design module AR-2 ([design](../evidence/specs/2026-09-29-agent-registry-design.md#12-modules-stages-310-run-per-module-ids-ar-0ar-11-so-they-never-collide-with-backlog-m-ids)).
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-099: First scan and an empty registry
- **Persona:** P-01
- **Feature:** Agent registry
- **Traces:** ST-041, FLW-59 (JTBD-05)
- **Entry point:** SCR-05 Agent registry on first open.
- **Preconditions:** Fabric was just installed; no coding agent or own agent is installed.
- **Steps:**
  1. Operator opens Agents for the first time → a loading state keeps the group headers visible while the first scan runs (at most a few seconds per source).
  2. Scan finishes with only Fabric's agents → the Coding agents group says none were found and names the supported CLIs; Your agents explains how an agent becomes visible (install it with its installer, or ask Fabric to make one).
- **Expected result:** An empty registry teaches what would appear there and how, without inventing agents.
- **Alt paths:** Operator asks Fabric to make an agent from the empty state (FLW-67).
- **UI elements:** Group headers; empty explanations; list of supported coding agents; Make an agent action.
- **States covered:** loading, empty, success
- **Errors & recovery:** A scan that times out for one runner shows that runner as `not answering` rather than absent.
- **Telemetry:** none.
- **Implementation tasks:** design module AR-2 ([design](../evidence/specs/2026-09-29-agent-registry-design.md#12-modules-stages-310-run-per-module-ids-ar-0ar-11-so-they-never-collide-with-backlog-m-ids)).
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-100: An agent that cannot be used
- **Persona:** P-01
- **Feature:** Agent registry
- **Traces:** ST-041, FLW-59 (JTBD-05)
- **Entry point:** SCR-05 Agent registry → an agent card.
- **Preconditions:** One provider entry points at an invalid `fabric-agent.json`; one service port answers as another service; one CLI's version command fails.
- **Steps:**
  1. Operator opens the invalid provider → the card says `manifest invalid` with the first failing field and the file path; no use action is offered.
  2. Operator opens the foreign service → the card says the port answers as another service (`foreign`) and names both ids; no token is sent to it.
  3. Operator opens the CLI → the card says the version check failed, with the command's error line.
- **Expected result:** Unusable agents are visible with the exact reason and cannot be bound by mistake.
- **Alt paths:** Operator asks Fabric to fix the manifest; Fabric proposes the change in the agent's repository (never writes it silently).
- **UI elements:** Problem line per card; Fix with Fabric action; copyable path.
- **States covered:** error, partial
- **Errors & recovery:** Every problem names its cause; none shows as healthy; a later scan that sees the fix clears the problem.
- **Telemetry:** none.
- **Implementation tasks:** design module AR-2 ([design](../evidence/specs/2026-09-29-agent-registry-design.md#12-modules-stages-310-run-per-module-ids-ar-0ar-11-so-they-never-collide-with-backlog-m-ids)).
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-101: Open an agent's dashboard
- **Persona:** P-01
- **Feature:** Agent registry
- **Traces:** ST-041, FLW-59 (JTBD-05)
- **Entry point:** SCR-05 Agent registry → a service card → Open dashboard.
- **Preconditions:** The agent runs as a service with a dashboard surface.
- **Steps:**
  1. Operator chooses Open dashboard → Fabric opens `fabric-dashboards://service/<id>.<instance>`; Fabric Dashboards comes forward on that service, signed in by its own login code.
  2. Fabric Dashboards is not installed → the card says so and links to its download; nothing opens in a browser tab by surprise.
- **Expected result:** Dashboards are watched in Fabric Dashboards; Fabric never becomes a second dashboard host.
- **Alt paths:** The service is stopped → the action is still offered; Fabric Dashboards shows it stopped with its start control.
- **UI elements:** Open dashboard; not-installed note with link.
- **States covered:** success, error
- **Errors & recovery:** The URL scheme failing to open is reported with the reason; no token appears in any URL.
- **Telemetry:** none.
- **Implementation tasks:** design module AR-2 ([design](../evidence/specs/2026-09-29-agent-registry-design.md#12-modules-stages-310-run-per-module-ids-ar-0ar-11-so-they-never-collide-with-backlog-m-ids)).
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-102: Returning: the registry changed since my last visit
- **Persona:** P-01
- **Feature:** Agent registry
- **Traces:** ST-041, FLW-59 (JTBD-05)
- **Entry point:** SCR-05 Agent registry, returning.
- **Preconditions:** Since the last visit, one agent was installed, one removed, one updated.
- **Steps:**
  1. Operator opens Agents → new agents carry a `new` mark, the updated one shows its old and new version, and a removed agent that was bound in a project stays listed as `missing` with its projects.
- **Expected result:** Changes since the last visit are visible without reading a log; a missing bound agent is never silently dropped.
- **Alt paths:** Operator asks Fabric to replace a missing agent in its projects (SCN-114 path).
- **UI elements:** New mark; version change line; missing state with bound projects.
- **States covered:** success, partial
- **Errors & recovery:** A missing agent's projects show the gap as attention, not as a failure of Fabric.
- **Telemetry:** none.
- **Implementation tasks:** design module AR-2 ([design](../evidence/specs/2026-09-29-agent-registry-design.md#12-modules-stages-310-run-per-module-ids-ar-0ar-11-so-they-never-collide-with-backlog-m-ids)).
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-103: See MCP servers through Project Observatory
- **Persona:** P-01
- **Feature:** MCP servers
- **Traces:** ST-042, FLW-60 (JTBD-02)
- **Entry point:** SCR-05 Agent registry → MCP servers.
- **Preconditions:** Project Observatory is installed and answering.
- **Steps:**
  1. Operator opens MCP servers → each server shows its name, where it is declared (which agents' configs), transport, and whether it answers, from Observatory's inventory with its time.
  2. Operator opens a server → it lists the agents that declare it and the projects whose agents may use it.
- **Expected result:** MCP servers are seen apart from agents, from one inventory.
- **Alt paths:** Filter by agent; show only servers that do not answer.
- **UI elements:** Server rows; declared-in list; health; inventory time.
- **States covered:** loading, success, stale
- **Errors & recovery:** A server that does not answer is shown as such, never removed from the list.
- **Telemetry:** none.
- **Implementation tasks:** design module AR-2 ([design](../evidence/specs/2026-09-29-agent-registry-design.md#12-modules-stages-310-run-per-module-ids-ar-0ar-11-so-they-never-collide-with-backlog-m-ids)).
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-104: MCP servers without Project Observatory
- **Persona:** P-01
- **Feature:** MCP servers
- **Traces:** ST-042, FLW-60 (JTBD-02)
- **Entry point:** SCR-66 MCP servers.
- **Preconditions:** Project Observatory is not installed, or installed but not answering.
- **Steps:**
  1. Not installed → the tab lists the servers Fabric itself is configured with and one line: install Project Observatory to see every MCP server on this Mac, with a link.
  2. Installed but not answering → the last inventory is shown with its age and the reason; nothing is presented as current.
- **Expected result:** The operator always knows how complete the list is.
- **Alt paths:** Operator installs Observatory → the next open shows the full inventory.
- **UI elements:** Recommendation line; age of inventory; reason.
- **States covered:** observatory-missing, stale, error
- **Errors & recovery:** A read failure names Observatory's answer; Fabric never scans configs itself as a hidden second inventory.
- **Telemetry:** none.
- **Implementation tasks:** design module AR-2 ([design](../evidence/specs/2026-09-29-agent-registry-design.md#12-modules-stages-310-run-per-module-ids-ar-0ar-11-so-they-never-collide-with-backlog-m-ids)).
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-105: Give Fabric a task; it picks the project and the agent
- **Persona:** P-01
- **Feature:** Tasking
- **Traces:** ST-043, FLW-61 (JTBD-07)
- **Entry point:** SCR-64 CEO conversation (floating avatar).
- **Preconditions:** At least one admitted agent can do the task; the project exists.
- **Steps:**
  1. Operator writes the task → Fabric answers with a plan: the project, the agent or pipeline, why, and what would have an effect; nothing starts yet.
  2. Operator confirms → a job starts; the project shows it running with its trace link; Fabric reports progress in the conversation.
  3. The job completes → Fabric summarises the result envelope (done, proof, scope, not verified) and links the run.
- **Expected result:** Any task goes through one conversation, and the work is receipted in its project.
- **Alt paths:** No project fits → Fabric proposes a new project or the general workspace project and asks before creating it.
- **UI elements:** Plan card with project, agent, reason and effects; Confirm; job state; result summary with link.
- **States covered:** planning, proposal, running, completed, error
- **Errors & recovery:** A plan Fabric cannot make (no capable agent) says so and offers to make an agent (SCN-121).
- **Telemetry:** task-to-result time; tokens per job (from usage).
- **Implementation tasks:** design module AR-3 ([design](../evidence/specs/2026-09-29-agent-registry-design.md#12-modules-stages-310-run-per-module-ids-ar-0ar-11-so-they-never-collide-with-backlog-m-ids)).
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-106: First use of an agent in a project
- **Persona:** P-01
- **Feature:** Tasking
- **Traces:** ST-043, FLW-61 (JTBD-07)
- **Entry point:** SCR-64 CEO conversation → plan needs an unbound agent.
- **Preconditions:** The chosen agent is declared but not bound in this project.
- **Steps:**
  1. Fabric's plan says the agent is not in this project and proposes to bring it in → Operator confirms once → admission probes run (SCR-16) and, when they pass, a binding is created with the narrowest grants the task needs.
  2. A probe fails → Fabric names the failed gate and the probe's output, keeps the plan, and offers another agent or a fix.
- **Expected result:** An agent enters a project only through admission and binding, in one confirmation.
- **Alt paths:** The agent is already admitted elsewhere → only the binding step runs.
- **UI elements:** Bring-in proposal; probe progress; gate results; binding summary.
- **States covered:** probing, admitted, failed
- **Errors & recovery:** Registry unavailable is distinct from admission failed (SCN-004 rule). Nothing with an effect runs before binding.
- **Telemetry:** none.
- **Implementation tasks:** design module AR-3 ([design](../evidence/specs/2026-09-29-agent-registry-design.md#12-modules-stages-310-run-per-module-ids-ar-0ar-11-so-they-never-collide-with-backlog-m-ids)).
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-107: An agent waits for my choice
- **Persona:** P-01
- **Feature:** Interaction points
- **Traces:** ST-044, FLW-61 (JTBD-07)
- **Entry point:** SCR-24 Approval queue; attention list.
- **Preconditions:** A running job returns `input_required` with options.
- **Steps:**
  1. Fabric turns the question into an interaction point: it appears in the project and in attention with the agent's options and what each means.
  2. Operator picks an option → the job resumes; the choice is recorded on the run.
  3. The point is delegable and Fabric answers → the answer and its reason appear on the point; the operator can see and change future delegation.
- **Expected result:** No job stalls silently and none proceeds on a guess.
- **Alt paths:** Operator answers from the conversation instead of the queue; both resolve the same point once.
- **UI elements:** Interaction point with options; who answered; reason; delegation note.
- **States covered:** pending, answered, delegated, expired
- **Errors & recovery:** An expired point names what happened to the job (cancelled by the agent or still waiting); a secret is never asked in the form — it goes to the credential flow.
- **Telemetry:** time-to-answer.
- **Implementation tasks:** design module AR-3 ([design](../evidence/specs/2026-09-29-agent-registry-design.md#12-modules-stages-310-run-per-module-ids-ar-0ar-11-so-they-never-collide-with-backlog-m-ids)).
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-108: A job fails or its result is unknown
- **Persona:** P-01
- **Feature:** Tasking
- **Traces:** ST-043, FLW-61 (JTBD-07)
- **Entry point:** SCR-09 Run detail; SCR-64 CEO conversation.
- **Preconditions:** A job was started.
- **Steps:**
  1. The agent goes down mid-job → the run shows `failed_known` with the agent's last event; Fabric offers retry or another agent.
  2. The reply is lost → the run shows `outcome_unknown`; Fabric looks the job up by its id before anything else; it never starts it again blindly.
- **Expected result:** Failures are named and recoverable; unknown outcomes are resolved, not duplicated.
- **Alt paths:** The agent comes back and reports the job completed → the run closes with that result.
- **UI elements:** Failure line; retry; choose another agent; Check again.
- **States covered:** failed, unknown, completed
- **Errors & recovery:** Retry reuses the idempotency key where the capability requires it.
- **Telemetry:** none.
- **Implementation tasks:** design module AR-3 ([design](../evidence/specs/2026-09-29-agent-registry-design.md#12-modules-stages-310-run-per-module-ids-ar-0ar-11-so-they-never-collide-with-backlog-m-ids)).
- **Status:** draft
- **Coverage:** `apps/desktop/src/renderer/src/launch/AgentWorkspace.tsx#useRunStatus` (read again every 5 s until the run is read as ended), `#RunCallout` (an ended run names its outcome; `outcome_unknown` offers Check again, which reads the run's record again), `apps/desktop/src/renderer/src/TaskPage.tsx` (the rail names the state or outcome in words and says «unreadable» when the status read fails; audit A5-018); `apps/desktop/src/renderer/src/launch/AgentWorkspace.test.tsx`, `apps/desktop/src/renderer/src/TaskPage.test.tsx`. Retry and «choose another agent» from the run are not built.
- **Product:** unobserved

### SCN-109: A coding agent calls Fabric within its grant
- **Persona:** P-01
- **Feature:** External control
- **Traces:** ST-045, FLW-62 (JTBD-08)
- **Entry point:** External MCP client (for example Claude Code) → Fabric MCP.
- **Preconditions:** Fabric wrote its MCP entry into the agent's config with a scoped credential in a header.
- **Steps:**
  1. The agent calls a Fabric tool for its project → the call runs, is recorded, and appears as a span in the run's trace.
  2. The agent calls another agent through Fabric outside its grant → Fabric refuses with the reason; SCR-22 shows the refusal.
- **Expected result:** One protocol connects agents, and every call is scoped and traced.
- **Alt paths:** The credential is revoked → the next call is refused; the agent's config entry is removed by Fabric when it disconnects the agent.
- **UI elements:** Calls and refusals list in SCR-22.
- **States covered:** calls, refused
- **Errors & recovery:** A credential never appears in a URL, argument or log line.
- **Telemetry:** calls per agent (ops log).
- **Implementation tasks:** design module AR-3 ([design](../evidence/specs/2026-09-29-agent-registry-design.md#12-modules-stages-310-run-per-module-ids-ar-0ar-11-so-they-never-collide-with-backlog-m-ids)).
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-110: Ask the floating Fabric to change what is on screen
- **Persona:** P-01
- **Feature:** Floating CEO
- **Traces:** ST-046, FLW-63 (JTBD-02)
- **Entry point:** Floating avatar on any screen.
- **Preconditions:** A pipeline is open.
- **Steps:**
  1. Operator opens the avatar → the conversation shows the attached context (this pipeline, this stage).
  2. Operator says "put a checker before publishing" → Fabric proposes the change on this pipeline with the new graph; the operator confirms; a new version is saved and the screen updates.
- **Expected result:** Edits are sentences to Fabric, grounded in what the operator is looking at.
- **Alt paths:** Operator detaches the context to ask about something else.
- **UI elements:** Context chip (view and selection); proposal with preview; Confirm; Decline.
- **States covered:** context-attached, proposal, applied, declined
- **Errors & recovery:** An ambiguous target ("this" with two selections) makes Fabric ask which; context is knowledge, never authority.
- **Telemetry:** none.
- **Implementation tasks:** design module AR-4 ([design](../evidence/specs/2026-09-29-agent-registry-design.md#12-modules-stages-310-run-per-module-ids-ar-0ar-11-so-they-never-collide-with-backlog-m-ids)).
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-111: Micro-controls on the screen
- **Persona:** P-01
- **Feature:** Floating CEO
- **Traces:** ST-046, FLW-63 (JTBD-02)
- **Entry point:** SCR-49 Маршрут работы; SCR-05 Agent registry.
- **Preconditions:** A pipeline or list is open.
- **Steps:**
  1. Operator renames a pipeline or stage inline → saved and recorded.
  2. Operator drags a stage within its lane, toggles a stage off, or pins a preferred agent → the change applies directly, is recorded, and the checks re-run.
- **Expected result:** Tiny edits need no conversation; everything larger does.
- **Alt paths:** Undo within the same session reverts the last micro-change.
- **UI elements:** Inline rename; drag handle; stage toggle; pin.
- **States covered:** success, blocked
- **Errors & recovery:** A micro-change that breaks a check (for example moving an effect before its checker) is refused with the check's reason.
- **Telemetry:** none.
- **Implementation tasks:** design module AR-4 ([design](../evidence/specs/2026-09-29-agent-registry-design.md#12-modules-stages-310-run-per-module-ids-ar-0ar-11-so-they-never-collide-with-backlog-m-ids)).
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-112: Fabric composes a pipeline and I approve it
- **Persona:** P-01
- **Feature:** Pipelines
- **Traces:** ST-047, FLW-64 (JTBD-07)
- **Entry point:** SCR-64 CEO conversation → SCR-49 Маршрут работы.
- **Preconditions:** Agents with the needed capabilities are admitted.
- **Steps:**
  1. Operator asks for a repeatable chain → Fabric proposes a pipeline: stages, the capability and agent of each, checkers, interaction points, as a graph.
  2. Checks pass (compatible edges, a checker before each effect, no cycle) → Operator approves → version 1 is saved at project or global scope.
- **Expected result:** Repeated work runs as a proven, versioned pipeline.
- **Alt paths:** Operator asks for a change before approving (SCN-110).
- **UI elements:** Graph; stage cards; check results; scope choice; Approve.
- **States covered:** proposed, checking, approved, versioned
- **Errors & recovery:** A proposal that cannot pass the checks is never saved.
- **Telemetry:** none.
- **Implementation tasks:** design module AR-5 ([design](../evidence/specs/2026-09-29-agent-registry-design.md#12-modules-stages-310-run-per-module-ids-ar-0ar-11-so-they-never-collide-with-backlog-m-ids)).
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-113: A pipeline fails its checks
- **Persona:** P-01
- **Feature:** Pipelines
- **Traces:** ST-047, FLW-64 (JTBD-07)
- **Entry point:** SCR-49 Маршрут работы.
- **Preconditions:** A proposed or edited pipeline.
- **Steps:**
  1. An edge is incompatible → the edge is marked with the missing or mistyped field, and Fabric proposes a converter tool or another agent.
  2. An effect has no checker upstream, or the graph has a cycle → the stage or loop is marked with the rule it breaks.
- **Expected result:** Broken pipelines are stopped at design time with an exact reason.
- **Alt paths:** Operator accepts Fabric's fix → checks re-run.
- **UI elements:** Marked edge or stage; rule text; proposed fix.
- **States covered:** blocked, checking
- **Errors & recovery:** Checks are structural; the mandatory checker remains the guard for meaning.
- **Telemetry:** none.
- **Implementation tasks:** design module AR-5 ([design](../evidence/specs/2026-09-29-agent-registry-design.md#12-modules-stages-310-run-per-module-ids-ar-0ar-11-so-they-never-collide-with-backlog-m-ids)).
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-114: Reuse a global pipeline; replace an agent
- **Persona:** P-01
- **Feature:** Pipelines
- **Traces:** ST-047, FLW-64 (JTBD-07)
- **Entry point:** SCR-49 Маршрут работы (global) → a project.
- **Preconditions:** A global pipeline exists; the project has bindings for its capabilities.
- **Steps:**
  1. Operator (or Fabric) uses the global pipeline in a project → it runs with that project's bindings.
  2. An agent is replaced in the project → the stage keeps its capability; the next run resolves the new agent; past runs keep the old one in their trace.
- **Expected result:** Pipelines survive agent changes and travel between projects.
- **Alt paths:** A capability has no binding in the project → Fabric proposes one (SCN-106).
- **UI elements:** Scope badge; used-by list; resolved agent per run.
- **States covered:** success, blocked
- **Errors & recovery:** Missing bindings block the run before it starts, with the stage named.
- **Telemetry:** none.
- **Implementation tasks:** design module AR-5 ([design](../evidence/specs/2026-09-29-agent-registry-design.md#12-modules-stages-310-run-per-module-ids-ar-0ar-11-so-they-never-collide-with-backlog-m-ids)).
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-115: Read a run as one graph
- **Persona:** P-01
- **Feature:** Traces
- **Traces:** ST-048, FLW-65 (JTBD-02)
- **Entry point:** SCR-09 Run detail → Trace.
- **Preconditions:** A run with nested agent calls.
- **Steps:**
  1. Operator opens Trace → the graph shows where the run started, each call as a node (caller, callee, capability, outcome, usage, time), branches, and waits for a person.
  2. Operator opens a node → its input, output, error and usage; links to the agent and the interaction point.
- **Expected result:** A chain of agents reads as one workflow.
- **Alt paths:** The run is still going → nodes appear live.
- **UI elements:** Graph; node detail; outcome icons with text; usage totals.
- **States covered:** loading, live, complete, error
- **Errors & recovery:** A node whose payload is private shows that it exists, not its content.
- **Telemetry:** none.
- **Implementation tasks:** design module AR-6 ([design](../evidence/specs/2026-09-29-agent-registry-design.md#12-modules-stages-310-run-per-module-ids-ar-0ar-11-so-they-never-collide-with-backlog-m-ids)).
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-116: Debug a failed branch; an incomplete trace
- **Persona:** P-01
- **Feature:** Traces
- **Traces:** ST-048, FLW-65 (JTBD-02)
- **Entry point:** SCR-67 Run trace.
- **Preconditions:** A run failed in a nested call; one agent did not report its spans.
- **Steps:**
  1. The failed node is highlighted with its error and the path that led to it.
  2. The agent that reported nothing is drawn as one node marked `incomplete`, never as empty success.
- **Expected result:** Failures are found in the graph; gaps in evidence are visible.
- **Alt paths:** Operator asks Fabric why it failed → Fabric answers from the trace with node citations.
- **UI elements:** Failure highlight; incomplete marker; Ask Fabric.
- **States covered:** complete, incomplete, error
- **Errors & recovery:** Missing trace data never fabricates nodes.
- **Telemetry:** none.
- **Implementation tasks:** design module AR-6 ([design](../evidence/specs/2026-09-29-agent-registry-design.md#12-modules-stages-310-run-per-module-ids-ar-0ar-11-so-they-never-collide-with-backlog-m-ids)).
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-117: Use Fabric tools in a project and globally
- **Persona:** P-01
- **Feature:** Fabric tools
- **Traces:** ST-049, FLW-66 (JTBD-07)
- **Entry point:** SCR-68 Fabric tools (project or estate).
- **Preconditions:** Tools exist at both scopes.
- **Steps:**
  1. Operator opens Tools in a project → project tools and global tools, each with inputs, outputs, effect, test status and usage.
  2. An agent calls a tool through Fabric → the call appears in the trace like any other.
- **Expected result:** Scripts that replace agent work are first-class and traced.
- **Alt paths:** Operator disables a tool → pipelines using it are marked blocked until it is re-enabled or replaced.
- **UI elements:** Tool list; scope badge; test status; enable toggle; usage.
- **States covered:** empty, list, enabled, disabled
- **Errors & recovery:** An empty Tools section explains that tools come from accepted optimizer proposals or from asking Fabric.
- **Telemetry:** tool calls and tokens saved (estimated from replaced stages).
- **Implementation tasks:** design module AR-8 ([design](../evidence/specs/2026-09-29-agent-registry-design.md#12-modules-stages-310-run-per-module-ids-ar-0ar-11-so-they-never-collide-with-backlog-m-ids)).
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-118: A tool cannot be enabled or fails
- **Persona:** P-01
- **Feature:** Fabric tools
- **Traces:** ST-049, FLW-66 (JTBD-07)
- **Entry point:** SCR-68 Fabric tools.
- **Preconditions:** A tool's test fails; another tool errors at runtime.
- **Steps:**
  1. Operator tries to enable the tool with a failing test → it stays disabled; the failing fixture and its diff are shown.
  2. A tool errors in a run → the node shows the error; the pipeline stage fails like any stage.
- **Expected result:** Only tested scripts run; failures are ordinary, visible failures.
- **Alt paths:** Operator asks Fabric to fix the tool → a new version with its test is proposed.
- **UI elements:** Disabled reason; fixture diff; runtime error.
- **States covered:** disabled, failing
- **Errors & recovery:** A tool runs inside the caller's execution context; it never gets wider access than the caller.
- **Telemetry:** none.
- **Implementation tasks:** design module AR-8 ([design](../evidence/specs/2026-09-29-agent-registry-design.md#12-modules-stages-310-run-per-module-ids-ar-0ar-11-so-they-never-collide-with-backlog-m-ids)).
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-119: Accept an optimizer proposal
- **Persona:** P-01
- **Feature:** Optimizer
- **Traces:** ST-049, FLW-66 (JTBD-07)
- **Entry point:** SCR-69 Optimizer proposals; attention.
- **Preconditions:** The optimizer found a repeated deterministic sub-path in recent traces.
- **Steps:**
  1. Operator opens the proposal → it shows the traces behind it, the proposed script and its test, the stages it replaces and the expected token saving.
  2. Operator accepts → the tool is created at the chosen scope and a new pipeline version uses it; nothing changed before acceptance.
- **Expected result:** Token-saving changes are grounded in real runs and applied only by the operator.
- **Alt paths:** Operator asks Fabric to adjust the proposal first.
- **UI elements:** Proposal detail; evidence traces; script and test; saving; Accept; Decline.
- **States covered:** list, detail, accepted
- **Errors & recovery:** The proposal cannot accept itself (DEC-0012).
- **Telemetry:** proposals accepted and realised saving.
- **Implementation tasks:** design module AR-9 ([design](../evidence/specs/2026-09-29-agent-registry-design.md#12-modules-stages-310-run-per-module-ids-ar-0ar-11-so-they-never-collide-with-backlog-m-ids)).
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-120: Decline or wait on a proposal
- **Persona:** P-01
- **Feature:** Optimizer
- **Traces:** ST-049, FLW-66 (JTBD-07)
- **Entry point:** SCR-69 Optimizer proposals.
- **Preconditions:** Proposals exist; one has thin evidence.
- **Steps:**
  1. Operator declines with a reason → recorded; the same pattern is not proposed again unless new evidence changes it.
  2. A proposal based on too few runs is marked `needs more runs` and cannot be accepted yet.
- **Expected result:** The optimizer learns from refusals and never pushes thin evidence.
- **Alt paths:** No proposals → the section says the optimizer is watching and when it last ran.
- **UI elements:** Decline reason; needs-more-runs marker; empty state with last run.
- **States covered:** empty, declined, detail
- **Errors & recovery:** none.
- **Telemetry:** none.
- **Implementation tasks:** design module AR-9 ([design](../evidence/specs/2026-09-29-agent-registry-design.md#12-modules-stages-310-run-per-module-ids-ar-0ar-11-so-they-never-collide-with-backlog-m-ids)).
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-121: Ask Fabric to make a new agent
- **Persona:** P-01
- **Feature:** Agent production
- **Traces:** ST-050, FLW-67 (JTBD-05)
- **Entry point:** SCR-64 CEO conversation → SCR-15 Agent foundry.
- **Preconditions:** A coding agent from the runner catalogue is available as a base.
- **Steps:**
  1. Operator says what the agent should do → Fabric opens a production project and asks the intake questions (one capability, its consumer, effects).
  2. Fabric produces the agent on the chosen base: capabilities and schemas, `fabric-agent.json`, evals, install (a provider entry or a service) → admission (SCR-16) → canary binding.
  3. The agent appears in the registry as your agent, with its evals and binding.
- **Expected result:** Agents are made inside Fabric and come out protocol-correct and wired in.
- **Alt paths:** Operator names a project that will use it → the canary binding is created there.
- **UI elements:** Production project; intake; stage progress; admission results; registry card.
- **States covered:** intake, producing, admitted
- **Errors & recovery:** Any failed stage keeps the draft (SCN-123).
- **Telemetry:** production time.
- **Implementation tasks:** design module AR-7 ([design](../evidence/specs/2026-09-29-agent-registry-design.md#12-modules-stages-310-run-per-module-ids-ar-0ar-11-so-they-never-collide-with-backlog-m-ids)).
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-122: Turn an existing project into an agent
*(Amended 2026-10-03 by [ADR-0100](../adr/0100-first-run-and-start-paths.md) §6: converting an agent runs inside Fabric with a dry-run plan, an adapter on a branch and the conformance probe — SCN-131; this scenario remains the model for a project with a callable surface.)*
- **Persona:** P-01
- **Feature:** Agent production
- **Traces:** ST-050, FLW-67 (JTBD-05)
- **Entry point:** SCR-05 Agent registry → New agent → From a project.
- **Preconditions:** A repository with a callable surface (API, CLI, MCP).
- **Steps:**
  1. Operator picks the project → Fabric inspects it without executing it and proposes the profile and capabilities; the operator confirms.
  2. Fabric writes the adapter's files into the project on a branch (never over existing files), runs the probes, and admits it.
- **Expected result:** Existing work becomes a Fabric agent without hand-wiring.
- **Alt paths:** Inspection finds no callable surface → Fabric says so and proposes making a new agent instead.
- **UI elements:** Project picker; inspection result; proposed profile; branch name; admission results.
- **States covered:** intake, producing, blocked, admitted
- **Errors & recovery:** Files are proposed on a branch in the project's repository; nothing is written to its main line.
- **Telemetry:** none.
- **Implementation tasks:** design module AR-7 ([design](../evidence/specs/2026-09-29-agent-registry-design.md#12-modules-stages-310-run-per-module-ids-ar-0ar-11-so-they-never-collide-with-backlog-m-ids)).
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-123: Agent production fails a gate
- **Persona:** P-01
- **Feature:** Agent production
- **Traces:** ST-050, FLW-67 (JTBD-05)
- **Entry point:** SCR-15 Agent foundry; SCR-16 Conformance and admission.
- **Preconditions:** Production reached evals or admission.
- **Steps:**
  1. An eval or probe fails → production stops at that gate; the draft, the failing case and its output are kept; Fabric proposes a fix.
- **Expected result:** No half-made agent is admitted; nothing is lost.
- **Alt paths:** Operator abandons production → the draft is archived, not deleted.
- **UI elements:** Gate result; failing case; Fix; Abandon.
- **States covered:** blocked, failed
- **Errors & recovery:** A gate failure never removes an earlier admitted revision.
- **Telemetry:** none.
- **Implementation tasks:** design module AR-7 ([design](../evidence/specs/2026-09-29-agent-registry-design.md#12-modules-stages-310-run-per-module-ids-ar-0ar-11-so-they-never-collide-with-backlog-m-ids)).
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-124: Fabric answers from memory with sources
- **Persona:** P-01
- **Feature:** Memory
- **Traces:** ST-051, FLW-68 (JTBD-02)
- **Entry point:** SCR-64 CEO conversation.
- **Preconditions:** The project has recorded facts and transcripts, in Russian and English.
- **Steps:**
  1. Operator asks what was decided about something → Fabric answers with citations to facts or transcripts it used; each citation opens in SCR-34.
- **Expected result:** Fabric does not make the operator repeat themselves, and shows what it relied on.
- **Alt paths:** Operator asks across projects → Fabric searches only projects the operator is in and says which.
- **UI elements:** Answer; citations; open citation.
- **States covered:** answered
- **Errors & recovery:** Search covers Russian and English text in full.
- **Telemetry:** memory retrievals per answer (existing retrieval log).
- **Implementation tasks:** design module AR-10 ([design](../evidence/specs/2026-09-29-agent-registry-design.md#12-modules-stages-310-run-per-module-ids-ar-0ar-11-so-they-never-collide-with-backlog-m-ids)).
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-125: Nothing in memory, or memory unavailable
- **Persona:** P-01
- **Feature:** Memory
- **Traces:** ST-051, FLW-68 (JTBD-02)
- **Entry point:** SCR-64 CEO conversation.
- **Preconditions:** The question has no recorded answer; or the database is down.
- **Steps:**
  1. Nothing recorded → Fabric says it has no record and asks or proposes to record the answer once given.
  2. Memory unavailable → Fabric says memory cannot be read now and does not answer from it.
- **Expected result:** Fabric never invents a memory.
- **Alt paths:** none.
- **UI elements:** Answer states; Record this.
- **States covered:** no-memory, memory-unavailable
- **Errors & recovery:** Unavailable memory never degrades into an unsourced answer.
- **Telemetry:** none.
- **Implementation tasks:** design module AR-10 ([design](../evidence/specs/2026-09-29-agent-registry-design.md#12-modules-stages-310-run-per-module-ids-ar-0ar-11-so-they-never-collide-with-backlog-m-ids)).
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

## Start paths · 2026-10-03 ([ADR-0100](../adr/0100-first-run-and-start-paths.md))

The first run and the five ways a project or an agent comes into Fabric. These supersede SCN-095
step 4 (a parent folder is now a checklist, each ticked repository its own Project) and its "no
personalisation form" line (the operator chose name and look first, 2026-10-03).

<!-- The 0.3.x title's anchor, kept on purpose: code regions and dated reports cite it. -->
<a id="scn-126-first-run-name-look-coding-agents-where-to-start"></a>

### SCN-126: First run: name and look, your projects folder, the four actions, the family's own agents first
- **Persona:** P-01
- **Feature:** First run
- **Traces:** ST-001, ST-022, ST-045, FLW-69, FLW-71, FLW-78 (JTBD-01, JTBD-02, JTBD-08); 0.4.0 plan REQ-09…REQ-12, REQ-39, REQ-40; [ADR-0100](../adr/0100-first-run-and-start-paths.md), [ADR-0129](../adr/0129-onboarding-is-four-actions-and-agent-work-runs-in-the-coding-agents-console.md), [ADR-0133](../adr/0133-agents-are-created-composed-and-fixed-in-fabric-and-fabric-is-the-harness-every-coding-agent-reaches.md), [ADR-0135](../adr/0135-setup-runs-in-the-persons-coding-agent-and-fabric-shows-what-it-observes.md), [ADR-0136](../adr/0136-a-folder-joins-a-project-by-a-pick-or-by-consent.md)
- **Entry point:** First launch of an estate with no project, after the project list is known; Help → Walk through the first run again; the next start after a first run that was left unfinished; a fresh profile after the documented reset (REQ-44).
- **Preconditions:** The settings file and the project list have been read. `settings.firstRun.completedAt` is null. No step grants authority: the name, language and look are preferences; the projects folder is read only because the person chose it in the system picker (ADR-0100 §7); detection reads `--version` and, only for an exactly observed supported build, a bounded read-only sign-in status; anything installed or registered is installed or registered by the person's coding agent in the Setup console, on the person's consent there — Fabric itself installs nothing and writes no agent's configuration (ADR-0135 §3).
- **Steps:**
  1. Operator sees SCR-70 step 1 «Fabric and you» → one sentence of what Fabric is (where you create agents, compose them into workflows and fix them — and the harness every coding agent reaches, ADR-0133); the language preselected from the system's preferred language (`ru*` → Russian, otherwise English; plan R-08); a name for their Fabric (optional; empty keeps "Fabric", 40 characters); the look as one row of characters, the greeting and the face updating live (variants and generation live in Profile) → Continue saves name, language and look; Skip keeps the defaults.
  2. Operator sees step 2 «Where your projects live» → one folder field: «Choose folder…» the first time; the system picker opens at the last folder chosen in Fabric (the home folder the very first time) → after a choice the field shows the full path and «Change…», and the choice is remembered for the next picker → «Scan this folder» (the step's one primary action).
  3. Operator sees step 3 «Your projects» → Fabric scans the folder read-only (SCN-128, first-run mode) with a live count and Stop → a checklist: every repository found is ticked; a worktree or a nested repository sits unticked under its parent; a top-level folder that is not a repository is listed unticked, saying Fabric reads no history in it; a folder already in a Project reads «In <project>» and cannot be ticked → «Import N as projects» (sticky) creates one Project per ticked row, row by row, each row showing its result → «N projects imported» → Continue.
  4. Operator sees step 4 «What would you like to do first?» → the four actions, one primary: **Create an agent** (primary), Convert an agent, Open a project, Create a project → choosing one marks it as where the first run will end («Next: Create an agent», with Change); «Decide later» marks none → Continue.
  5. Operator sees step 5 «First, the family's own agents» (SCR-77 inside the first run, SCN-138) → the coding agents on this Mac, one honest line each. The operator picks which one does their work: each row is a radio; every installed agent that answered can be picked whatever its sign-in state, and one not installed or not answering is disabled and says why and what to do (REQ-40). The pick is saved at Continue as the head of the fallback order (ADR-0125), which the agent actions preselect from; an untouched default writes nothing; a refused save says why and offers Continue without saving. Check again re-reads with the latest-request fence. Below, Project Observatory, then the Fabric Dashboards agent, each with what it gives and its observed state → «Set up with <coding agent>» opens the Setup console on the picked agent (a signed-out pick is asked to sign in first — the console never starts on it, ADR-0135 §5); the checklist ticks each step only when Fabric observes it → both verified → Continue. Continue is labelled "Continue without an agent" only when no agent can be picked, and remains usable while the check is pending.
  6. Fabric records the first run as finished → Home, with the person's name in the hero; when step 4 marked an action, that action's screen opens over Home (SCR-74, SCR-75, SCR-71/SCR-72 or SCR-73) with Home one Back away, and the agent actions find the adapter skills and Fabric's MCP already in the coding agent.
- **Expected result:** The first run is finished once (`settings.firstRun.completedAt` holds the moment); the estate holds one Project per ticked folder and nothing else; Project Observatory and the Fabric Dashboards agent are installed from verified downloads, registered in the chosen coding agent and verified by their proving calls — or skipped with the person's reason recorded; the person is on Home or on the action chosen in step 4; no step is a dead end.
- **Alt paths:** Back on steps 2–5; Back past step 3 never deletes an imported Project and says the imported ones stay. Skip on step 1. «I have no projects yet» on step 2 → step 4, which says nothing was imported and still offers Open a project. «Choose another folder» on step 3 → step 2 with the path kept. An import that left rows failed → «Continue with N imported», or Import again for the failed rows. Step 5 skipped with a reason → SCN-138's skip; Home then shows one «Finish setting up» card. Help → Walk through the first run again on an estate that has projects → step 3 marks every folder already held «In <project>», step 5 shows what is already verified, and finishing changes nothing already done. Fabric quits mid-run → the next start reopens the first run at the step it was left on, with the folder, the imports and the setup observations kept.
- **UI elements:** five-step progress (Fabric and you · Projects folder · Your projects · First action · Family agents); the one-sentence lede; language choice; name field with hint and 40-character limit; one row of characters; the folder field with its path, «Choose folder…» / «Change…»; «Scan this folder»; «I have no projects yet»; the scan's live count and Stop; the checklist (SCR-72 rows); «Import N as projects»; the four actions with one primary, «Next: …» with Change, and «Decide later»; the Setup checklist (SCR-77); Back, Skip, Continue.
- **States covered:** first-visit,language-system,saving,not-saved,folder-unset,picker-cancel,folder-chosen,denied,no-projects-yet,scanning,slow,cancelled,results,empty,no-repositories,duplicate,importing,partial,imported,choose-action,action-chosen,choose-agent,choice-not-saved,setup,setup-skipped,finishing,finish-failed,resumed,skipped
- **Errors & recovery:** A name, language or look that is not saved says why and offers Continue without saving (the defaults stay). A cancelled picker leaves the step unchanged. macOS refusing the chosen folder (Documents, Desktop, Downloads, a removable volume) → "Fabric could not read <folder>: macOS did not allow it", with Open System Settings (Privacy & Security → Files and Folders) and Choose another folder; nothing is scanned. An empty folder → "Nothing in <folder>" with Change… and I have no projects yet. A folder with no repositories → its plain folders, unticked, with "No git repositories here — a folder you tick becomes a project without history Fabric can read". A slow scan keeps its count moving; after 10 s it says the folder is large, keep waiting or Stop and choose a narrower one; Stop → step 2 with "Scan stopped — nothing was imported". The scan's bound, unreadable, deep and linked-folder gaps are said as in SCN-128. A row that fails to import keeps its reason, stays ticked, and Import retries it with the same id. The finish cannot be recorded → "Fabric could not record that the first run is finished; it will open again next time" with Try again, and the person still reaches Home. An unknown project list never triggers the first run; an estate that already holds projects is never walked back through it unasked.
- **Design rationale:** The operator's order (REQ-39, 2026-10-11 evening): the person's own projects come in before anything else is asked, so the first value — "Fabric found my projects" — arrives at step 3 and needs nothing installed; the four actions come before setup so that the chosen action opens with the skills and Fabric's MCP already in the coding agent, which closes review F-02 (the agent actions stopping on a terminal command); the family's own agents come before any other because Observatory keeps the keys every later product connection needs (SCN-133) and Dashboards is where Fabric's work is seen outside Fabric (REQ-18, SCN-142). The look stays on step 1 because the operator asked for name and look first; it is one row, not three near-identical variants (review F-05). Every step can be skipped and says what is lost. The agent check is information, not a gate; the choice is a preference, never a gate (REQ-40).
- **Telemetry:** planned only; the setup step's events are SCN-138's.
- **Amended 2026-10-22 (P-24, [ADR-0172](../adr/0172-the-interface-language-is-the-agents-working-language.md)):** step 1 asks the language first, as two native radios (English, Русский) preselected from the system's language, under «Язык» and the line «На нём Fabric говорит с вами и на нём пишут ваши агенты: задачи, отчёты, сообщения на доске и документацию для вас. Его можно сменить в Настройках.» A choice is written to Settings at once, so the rest of the first run reads in it, and from then on `fabric_whoami` names it to every agent (`start/FirstRun.tsx`, region `first-run-language`; `shared/protocol.ts#buildProtocol`). A write that fails says why (`settings.notSaved`) and the step stays usable.
- **Rewritten 2026-10-11 (0.4.0 plan REQ-39 with REQ-09…REQ-12 and REQ-40, ADR-0135):** the first run is name and look → projects folder → scan and import → the four actions → the family's own agents → Home, replacing the 0.3.x order (name and look → coding agents → four actions). The coding-agent rows of the old step 2 now live in step 5 (SCN-138), where the agent they choose is the one that runs the setup. The amendments below are the history of the 0.3.x first run and no longer describe the steps.
- **Amended 2026-10-11 (REQ-40, built in the shipped order):** in the code's current order the agent choice is step 2 (`FirstRun.tsx`, region `first-run-agent-choice`): a radiogroup of native radios, every installed agent that answered pickable signed in or not, the unavailable ones disabled with why and what to do (install command with Copy, run once, Check again); the pick saved at Continue as the head of the fallback order, re-read before the write; an untouched default writes nothing. Step 5 above carries the same choice when the 0.4.0 order lands.
- **Amended 2026-10-07 (ADR-0125):** step 2 lists every catalogued coding agent, now six — Kimi Code joins as *installed* (runs as itself, not connected) — and the list is read from the catalogue instead of a copy of it. Kimi Code has no install command here, because none was verified from its vendor; `kimi` in `~/.kimi-code/bin`, where its installer puts it, is found.
- **Amended 2026-10-06 (0.3.2 verification DO-13):** "connected to Fabric's tools" is the agent row's declared connection (`connectsToSurface`), not yet a probe of a live session (ADR-0119 amendment 4, plan AS-03). Cline starts in Ask (`--auto-approve false`) unless the session is Bypass.
- **Amended 2026-10-08 (0.3.3 onboarding, four actions — operator):** step 3 is the four actions of the start menu in two pairs: **Agent** — Create an agent (SCN-136), Adapt an existing agent (SCN-131); **Project** — Open a project (one folder, SCN-127, or a folder of repositories, SCN-128), Create a project (SCN-129). Fabric is the person's way into the PassionCode.ai ecosystem: the agent actions run in the console of the coding agent chosen there; Fabric opens it and builds no chat of its own (ADR-0123).
- **Status:** draft
- **Amended 2026-10-17 (0.3.7 wave 1, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** the first run follows the onboarding plan's five steps (persona → coding agents → connection → projects → first project at work, decided by the operator 2026-10-13); the usage-counts question is asked in step 1, beside the language, and is not a banner (ADR-0160 §5, SCN-134); the projects step runs «Создать»'s paths (SCN-171).
- **Coverage:** partial — the 0.3.x first run (name and look, agent detection, the four actions): apps/desktop/src/renderer/src/start/FirstRun.tsx; apps/desktop/src/renderer/src/start/StartPaths.test.tsx; the agent choice (REQ-40): apps/desktop/src/renderer/src/start/FirstRun.tsx region `first-run-agent-choice`, apps/desktop/src/shared/builderChoice.ts (`mayPick`, `withHead`); CO-176 main observer `apps/desktop/src/main/executorAuth.ts`, disposable-process negatives `apps/desktop/test/executor-auth.test.mjs`. The 0.4.0 order (the folder, the scan and the import inside the first run, the family setup step) has none yet. Local source/fixture proof does not establish packaged native or account-identity acceptance.
- **Product:** unobserved
- **2026-10-23 (0.3.11, ADR-0174):** the shipped hint says agents write tasks, notes, reports and board messages in the language, and that a project's repository keeps its own language («…задачи, заметки, отчёты и сообщения на доске. Документы в репозитории проекта остаются на языке проекта…»); the earlier quote naming «документацию для вас» is retired.

### SCN-127: Add an existing project from one folder
- **Persona:** P-01
- **Feature:** Start paths
- **Traces:** ST-001, ST-031, FLW-70 (JTBD-01)
- **Entry point:** Start menu → Add a project; first run step 3.
- **Preconditions:** The folder is chosen in this window's native picker; Fabric reads only it.
- **Steps:**
  1. Operator selects Choose a folder → the native picker opens; cancel returns to the step unchanged.
  2. Fabric reads the folder (git with every config-driven program switched off) → SCR-71 shows its name (editable), git kind and branch, remote (credentials removed), last commit with date, stack, and the projects that already hold it.
  3. Operator confirms Add project → the Project is created with the folder attached → its page opens.
- **Expected result:** One new Project holding exactly the chosen folder; nothing in the folder changed.
- **Alt paths:** A folder already in a project shows "already in …" with Open that project and offers no Add. A plain folder (not git) can be added and says what Fabric will not see. Choose another folder at any time.
- **UI elements:** Choose a folder; reading state; name field; facts list; already-in notice; not-a-repository notice; Add project; Choose another folder.
- **States covered:** idle,picker-cancel,reading,ready,duplicate,not-git,creating,failed,created
- **Errors & recovery:** A failed create says why, keeps the folder and the name; a retry is the same create (the same id), never a second Project. A folder outside the window's grant is refused by the main process.
- **Design rationale:** Recognition over recall — the operator confirms what Fabric found rather than typing it.
- **Telemetry:** planned only.
- **Amended 2026-10-08 (0.3.3 onboarding, R2):** the facts list also shows what the folder says it is (as SCN-128's amendment of the same day), and Add project makes it the purpose.
- **Amended 2026-10-08 (four actions):** the entry is Start menu → Open a project → One folder; Scan a folder of projects (SCN-128) is the other choice of the same action.
- **Status:** draft
- **Amended 2026-10-17 (0.3.7 wave 1, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** reached from «Создать» as «Открыть проект из папки» under the folder choice (SCN-171); the project is added at once with «Отменить».
- **Coverage:** apps/desktop/src/renderer/src/start/StartPaths.tsx; apps/desktop/src/main/projectDiscovery.ts; apps/desktop/test/project-discovery.test.mjs
- **Product:** unobserved

### SCN-128: Scan a projects folder and tick what becomes a Project
- **Persona:** P-01
- **Feature:** Start paths
- **Traces:** ST-001, ST-031, FLW-71, FLW-69 (JTBD-01); 0.4.0 plan REQ-39
- **Entry point:** Start menu → Scan a projects folder; the first run's step 3, on the folder its step 2 chose (SCN-126); the start card's "N not added yet".
- **Preconditions:** The parent folder is chosen in this window's picker. The scan is read-only.
- **Steps:**
  1. Operator selects Choose a folder to scan → the picker opens.
  2. Fabric walks the folder breadth first (bounded, cancellable; does not enter dependency trees, build output and similar folders unless one is itself a repository; never hidden folders or symlinks out of it; git runs with config-driven programs off) → SCR-72 lists every repository with name, last commit, stack and its path relative to the folder, grouped by product (a worktree under its repository, a nested repository under its parent).
  3. Operator filters and ticks (Tick all shown ticks the head of each product; a worktree or nested part is ticked only by hand and then warns that it becomes a separate Project; Clear) → Add N as projects (sticky at the bottom) creates one Project per ticked repository, in order, showing each row's result and a failed row's reason.
  4. Operator sees the summary → Open the first one, or leaves the unticked ones for later.
- **Expected result:** One Project per ticked repository; nothing created for an unticked one; the last scan is kept so unticked candidates can be imported later.
- **Alt paths:** Stop during the scan returns to the start and says nothing was added. Scan again opens the picker at the same folder. Leaving the screen stops a running scan. An already-imported repository is marked "In <project>", cannot be ticked, and opens that project. The kept last scan is shown when the path opens; it is not a grant.
- **UI elements:** Choose a folder to scan; scanning with Stop; summary (count, parts of another repository, folder, date); truncation notice; filter; group heads; candidate rows with checkbox, pills and in-project link; Add N as projects; per-row added/not added.
- **States covered:** idle,picker-cancel,scanning,slow,cancelled,denied,results,empty,no-repositories,plain-folder,truncated,unreadable,deep,symlinks,kept-unreadable,not-kept,no-match,duplicate,part-ticked,importing,partial,imported,failed
- **Errors & recovery:** A walk stopped by its bound says the list is not the whole folder; folders that could not be read — and repositories whose inspection failed — are counted as a gap. Folders deeper than the scan goes, and linked folders it does not follow, are counted and said, with how to reach a repository there; Stop leaves the scanning state at once and a late answer is ignored; a kept list that cannot be read is said. A row that failed to import shows its reason, stays ticked, and Add retries it with the same id. A scan error says why and offers to choose again.
- **Design rationale:** Nothing becomes a Project without the operator's tick; Tick all shown ticks one Project per product, so a worktree becomes a separate Project only by a deliberate, warned tick.
- **Telemetry:** planned only.
- **Amended 2026-10-08 (0.3.3 onboarding, R2 — «показал папку, он нашёл мои проекты и сразу всё определил»):** each listed repository also shows what it says it is — its manifest's `description` (package.json, pyproject.toml `[project]`/`[tool.poetry]`, Cargo.toml `[package]`), else the first prose paragraph of its README — in two lines under its name; Add N as projects gives each Project that text as its purpose, marked as the repository's words with the file it came from («From README.md: …», ADR-0129 — not the owner's statement). A repository that says nothing gets no purpose rather than an invented one; a README that is a link is not followed; the purpose is edited like any other.
- **Amended 2026-10-08 (plan R3a):** the summary after adding also offers «Set up {name} with the agent» (the first created project, named), which opens the first created project with that shortcut already in its task field and the field in view; nothing starts until the operator presses Run.
- **Amended 2026-10-08 (four actions):** the entry is Start menu → Open a project → A folder of projects.
- **Amended 2026-10-11 (0.4.0 plan REQ-39 — the first run's folder step, and the default ticks everywhere):**
  1. **First-run mode.** SCN-126 step 3 runs this scan on the folder chosen in its step 2; the summary's «Set up {name} with the agent» is not offered there (the first run goes on to its step 4). Everywhere — first run and start menu alike — the picker opens at the last folder chosen in Fabric (the home folder the very first time), and the chosen folder is shown as its full path with «Change…» (the operator's interface rule of 2026-10-09: folders through the system picker, its last location remembered).
  2. **Default ticks.** When the list appears, every repository at the head of a product is ticked; a worktree or a nested repository stays unticked (ticking it still warns that it becomes a Project of its own); a top-level folder that is not a repository is listed too — **plain-folder**, unticked, «not a repository: Fabric reads no history in it» — and a ticked one becomes a Project holding a plain folder, as SCN-127's not-git. Tick all shown and Clear keep their meaning; a row already in a Project stays a ticked, disabled box.
  3. **denied** — macOS refuses the chosen folder itself (privacy for Documents, Desktop, Downloads, a removable volume): the reason in words, Open System Settings (Privacy & Security → Files and Folders) and Choose another folder; nothing is scanned and nothing is kept.
  4. **no-repositories** — the folder holds folders but no repository: the plain folders, unticked, with "No git repositories here — a folder you tick becomes a project without history Fabric can read"; **empty** stays for a folder with nothing in it, with Change… (and, in the first run, I have no projects yet).
  5. **slow** — a scan still walking after 10 s keeps its count moving and says the folder is large: keep waiting, or Stop and choose a narrower one.
- **Status:** draft
- **Amended 2026-10-17 (0.3.7 wave 1, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** reached from «Создать» → «Открыть папку с проектами», its primary choice (SCN-171), grouped by owner with the active projects ticked as the onboarding plan §2 draws; adding happens at once and «{N} проектов добавлено · Отменить» takes it back.
- **Coverage:** apps/desktop/src/renderer/src/start/StartPaths.tsx; apps/desktop/src/main/projectDiscovery.ts; apps/desktop/src/main/startPaths.ts; target-only legacy R0 scan checklist: scripts/product/first-release.mjs (CO-180), scripts/test/first-release.test.mjs. Prototype checks do not certify native acceptance.
- **Product:** unobserved

### SCN-129: Create a new project in a new folder or as an idea
- **Persona:** P-01
- **Feature:** Start paths
- **Traces:** ST-001, FLW-72 (JTBD-01)
- **Entry point:** Start menu → New project; first run step 3.
- **Preconditions:** A new folder is created only under a parent chosen in this window's picker.
- **Steps:**
  1. Operator sees the new-project form (a draft that survives a restart, AD02) → types a name and, optionally, what it is for.
  2. Operator chooses where it lives: Create a new folder for it (choose the parent; optionally start it as a git repository) — the folder joins the draft's repositories — or adds existing repositories, or none (only an idea for now).
  3. Operator selects Save → the Project is created with its repositories attached → its page opens.
- **Expected result:** A new Project; with a folder, the folder exists under the chosen parent and, when asked, is a git repository on `main`.
- **Alt paths:** Change location; switch to an idea at any point.
- **UI elements:** Name; purpose; repositories with Add repository and Create a new folder for it; git checkbox; folder problem line; memory backend; default agent; Save; Cancel.
- **States covered:** idle,invalid-name,no-parent,creating,exists,outside,failed,created,left-on-disk
- **Errors & recovery:** A folder that already exists, an invalid folder name (separators, a leading dot, control or text-direction characters), a location not chosen in this window and a failed mkdir/git init each say what happened; nothing is added. A failed git init removes the half-made folder, so the retry is not refused as "exists". The parent folder is not opened to the window: only the new folder is.
- **Design rationale:** The idea path keeps "zero to one progressively" honest: a project can exist before its code does.
- **Amended 2026-10-11 (REQ-40, built):** the default coding agent starts on an installed one (fallback order first, `shared/builderChoice.ts#installedDefault`); greyed-out ones say why and what to do.
- **Telemetry:** planned only.
- **Status:** draft
- **Amended 2026-10-17 (0.3.7 wave 1, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** reached from «Создать» → «Создать проект» (SCN-171): name, where it lives and the first task, then the project opens; «Проект создан · Отменить».
- **Coverage:** apps/desktop/src/renderer/src/Onboarding.tsx; apps/desktop/src/main/projectFolder.ts; apps/desktop/src/main/startChoices.ts
- **Product:** unobserved

### SCN-130: Start a new agent inside a project
- **Persona:** P-01
- **Feature:** Start paths
- **Traces:** ST-050, FLW-73 (JTBD-05)
- **Entry point:** The project's Team (`#sec-agents`) → Create an agent. (Until 2026-10-08 also Start menu → New agent; see the amendment.)
- **Preconditions:** An agent belongs to a project (CONTEXT: an Agent is a provider revision bound into one project).
- **Steps:**
  1. Operator opens a project's Team (`#sec-agents`) → Fabric reads the agents created in it before saying there are none.
  2. (Until 2026-10-08 the start menu led here by choosing a project first; the onboarding's «Create an agent» is now SCN-136.)
  3. Operator opens Create an agent → name, what it is for, the coding agent it runs in (those not available on this computer are listed, disabled), the servers it needs from those the project grants → Create the agent.
  4. Fabric confirms "Created <name>." and lists the agent with what it reaches (M125).
- **Expected result:** The agent exists in that project, named once, reaching only the servers it asked for.
- **Alt paths:** With no project, the path offers Add a project and New project. An agent made by asking the CEO is SCN-121.
- **UI elements:** Project choice; no-project notice with the two paths; the team's agent list; the create form with its field hints.
- **States covered:** loading,no-project,choose-project,reading,unreadable,empty,invalid,saving,failed,created
- **Errors & recovery:** An unknown project list shows loading, never "no project". An unreadable agent list says so in place with Try again, never "none yet". A taken or too-long name and a too-short purpose are named under their field before the click; no available program is said, not hidden. A refused create keeps everything typed and shows the reason in the form; the project holds one agent per name, checked by the form and again by the handler.
- **Design rationale:** One place creates agents; the start path only routes to it, and the form shares its limits with the handler (`shared/agentSpec.ts`).
- **Telemetry:** planned only.
- **Amended 2026-10-08 (four actions):** no longer a start path. «Create your own agent» in the onboarding is SCN-136 — a new ecosystem agent with its own repository; this scenario, an agent with a role inside an existing project, is reached from the project's Team (`#sec-agents`) only.
- **Status:** draft
- **Coverage:** apps/desktop/src/renderer/src/CreatedAgents.tsx
- **Product:** unobserved

### SCN-131: Adapt an existing agent into an ecosystem agent
- **Persona:** P-01
- **Feature:** Start paths
- **Traces:** ST-050, FLW-74 (JTBD-05), SCR-75; operator request 2026-10-08 (D2, D3); ADR-0123, ADR-0129
- **Entry point:** Start menu → Agent → Adapt an existing agent (card button «Adapt an agent»); first run step 3.
- **Preconditions:** The agent's folder exists on this computer (a script, a service, an MCP server, a CLI). At least one coding agent is installed.
- **Steps:**
  1. Operator selects Choose the agent's folder → the native picker opens; cancel returns unchanged.
  2. Fabric reads the folder without running anything (the same reading as SCN-127) → shows its name, git state and branch, stack, what it says it is, and the Projects that already hold it; then the four steps that will follow: the coding agent inspects without running, shows the plan, adapts the agent **on its own branch** with the Fabric Agent Adapter skills, and runs the conformance check.
  3. Fabric says whether the Fabric Agent Adapter skills are installed for the coding agent chosen below — with the version, or with the install command and Copy, and Check again.
  4. Operator chooses the coding agent (the first in the fallback order that is installed and answers; else the first found that connects to Fabric's tools; else the first found — preselected, as SCN-136; unavailable ones are listed with why) → Start the adaptation.
  5. Fabric adds the folder as a Project (or uses the Project that already holds it) — its purpose, when the repository says what it is, kept as the repository's words («From README.md: …», ADR-0129) — files the adaptation as a task, starts the coding agent in that folder and opens its console. The conversation — the plan, the questions, the approvals — happens there.
- **Expected result:** A Project for the agent and a running console session adapting it; Fabric itself changed no file in the folder. The coding agent is told to show the plan and wait for a yes, to work only on a new branch `fabric-adapter` made from the branch the folder is on, and not to call the agent compatible with Fabric before every check of the conformance report passes. The Fabric window opens that Project.
- **Alt paths:** The folder is already a Project → the adaptation starts in that Project, no second one is created. The skills are missing → Start stays unavailable until Check again finds them, with the command to install them shown and copyable; Fabric installs nothing. The skills are found only in the shared folder (`~/.agents/skills`) → said so; Start is allowed for a coding agent that may read that folder, and for Claude Code, which reads only its plugins and `~/.claude/skills`, it is "missing". The install command does not cover the chosen agent (Cline, Kimi Code) → said, with "put the skills where it reads them, or choose another coding agent". The folder is not a git repository → said before the start; the coding agent is told to make it one and commit it as it is before changing anything, so the original can be restored.
- **UI elements:** Choose the agent's folder; facts list; the four steps; skills status with Copy and Check again; coding agent choice; Start the adaptation; Choose another folder.
- **States covered:** idle, picker-cancel, reading, ready, skills-missing, checking-skills, no-agent, starting, failed, started
- **Errors & recovery:** A folder that cannot be read, or one outside this window's folders, is refused in words with Choose another folder. A failed Project create, task start or console says why and keeps the choices; a retry uses the same Project, task and session, never a second of any, and the coding agent is fixed from the first launch attempt. Choose another folder begins a new attempt. No coding agent can start → nothing is created and each agent reads with its reason. A failed launch that made no session offers Use another coding agent (a new task in the same Project; the first is cancelled on the board, and a refused cancel is said). Choosing the same folder again — after leaving the screen, or after another folder — is the same attempt. The folder picker or the agents' read failing is said in words with Try again. The instruction keeps anything that looks like a secret out of a first commit and names it in the plan.
- **Design rationale:** The operator decided on 2026-10-08 that adaptation happens in the coding agent's own console (D2); Fabric's part is the folder, the Project, the readiness of the skills and the launch. The plan-before-change and own-branch rules are the skill's own (`adapting-projects-to-fabric`: inspect without execution → scaffold → check).
- **Telemetry:** planned only.
- **Status:** draft
- **Coverage:** apps/desktop/src/renderer/src/start/AgentPaths.tsx (`ConvertAgent`), apps/desktop/src/main/adapterSkills.ts, apps/desktop/src/main/taskRetry.ts, apps/desktop/src/main/projectDiscovery.ts; tests apps/desktop/src/renderer/src/start/StartPaths.test.tsx (`adapt an existing agent`), apps/desktop/test/adapter-skills.test.mjs, apps/desktop/test/task-retry.test.mjs
- **Product:** unobserved

### SCN-132: An external agent asks for access and the operator decides
- **Persona:** P-01
- **Feature:** Hub
- **Traces:** ST-045, FLW-75 (JTBD-08)
- **Entry point:** An agent registered on this Mac (a `services/` descriptor or a `providers/` entry) — or, asking only to work in a project, a coding agent of Fabric's runner catalogue (SCN-137, [ADR-0134](../adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md)) — reads `hub.json`, takes the door token from the file it names, and calls `fabric.access.request` on Fabric's MCP ([ADR-0115](../adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md) §2). Before it sends a binding credential it re-reads `hub.json` and checks that the `pid` there is alive: while Fabric is down any program can hold the port (the tools' descriptions say so).
- **Preconditions:** Fabric is running and its hub is listening; the agent's id resolves in the registry (for an enrollment, in the runner catalogue).
- **Steps:**
  1. The agent asks for capabilities on resources of a product, with its reason → Fabric reads the registry; an id it does not resolve is refused before anything is shown. An ask of Fabric itself (`session.enroll` on one project) is SCN-137's: its id must be a coding agent of the runner catalogue that is available on this computer, and the folder it names must belong to that project — otherwise it is refused before anything is shown.
  2. With a Fabric window in front (shown and focused), a native prompt opens over it, in the operator's language (English or Russian, from Settings): the agent's registry name and id, who installed it and where it came from, what it asks in the product's words ("list and search mail and read mail in news@example.com"; a tool that sends mail says so, and a tool Fabric does not know is said to be unknown), its reason quoted as its own claim on one line, and the same-user floor ("an agent registered as example-agent"). Deny is the default. Nothing the agent or its descriptor wrote can start a line of its own or reorder the text: line breaks, control and bidirectional characters are removed.
  3. With Fabric in the background — hidden, minimised, or open behind another app — a notification says who asks; the request waits in the queue (SCR-41) with the prompt's own facts as a block — who installed it and where it came from, what it asks, its reason, the same-user floor, whether it adds to existing access, that access lasts a year unless revoked — and Deny and Allow below them; clicking the notification, or bringing Fabric's window forward, shows the same prompt. Settings → Agent access (SCR-76) shows the same facts in a card per request, with when the request expires, beside its Allow. Long mailbox names wrap in full before Allow; its accessible name contains the visible “Allow and connect” words. Answering one queue request reloads the board and keeps a named result; choosing another request shows its own Allow/Deny. A plain Allow or Deny in SCR-76 names its result the same way once the card has left the list — "You allowed Example agent to use Fabric Inbox.", "You denied Example agent access to Fabric Inbox.", and for a coding agent's enrollment ([ADR-0134](../adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md)) "You let Claude Code work in Atlas." (CO-207). Keyboard focus moves to the decision result or the affected Settings section. Every one of these words is in the operator's language; machine details appear on their own secondary line, and the agent's own words (its reason, its name) are quoted as they are.
  4. Operator allows → the agent's next status read carries its credential once; its calls are checked against the grants (one capability on one mailbox each, a year unless revoked).
  5. Operator later opens Settings → Agent access (SCR-76) → sees the agent and each grant in plain words → revokes one, or all → the next call is refused.
- **Expected result:** The agent works within what was allowed, nothing wider; every decision and every call that reached (or may have reached) a product is in the journal; a call Fabric stopped before forwarding is journalled once per kind in a ten-minute window and the rest of that window's are counted in one summary (CO-200).
- **Alt paths:** A pending-state read owns the single prompt slot before awaiting; simultaneous requests remain queued. Expiry is checked again after that read. Losing window focus while it waits keeps a live request queued until focus/resume, without opening a background sheet. Standing denials remain authoritative and visible to clear beyond a display-page boundary; a failed or oversized read refuses rather than prompting again.  Deny → the same request is answered "denied" without a prompt until the operator clears the denial in SCR-76. Nobody answers within 10 minutes → expired; the agent asks again. An agent that already has access asks for more → a new prompt says it adds to existing access; asking again for something it already holds extends that grant rather than adding a second one. The product is not connected yet → the prompt's, the queue's and SCR-76's Allow all read "Allow and connect Fabric Inbox" and start SCN-133; if Fabric Inbox cannot be opened, the Allow stands and Fabric says so beside it ("Allowed. Fabric Inbox did not connect: Fabric Inbox could not be opened …") — in the prompt as a follow-up message, in the queue and SCR-76 as a line, never as a failed Allow. An Allow nobody collects within 10 minutes of the decision gives no credential; the agent asks again. Creating an address that forwards its mail elsewhere, or that a reply agent answers, is asked for as its own line ("when creating news@example.com, also forward a copy of its mail…") and granted per address; without that grant the call is refused and nothing is sent.
- **UI elements:** native prompt (Deny, Allow); notification; queue row with the prompt's facts, Allow and Deny; SCR-76 lists.
- **States covered:** loading,unreadable,hub-off,waiting,prompt,notified,allowed,denied,expired,revoked
- **Errors & recovery:** An unreadable access list is said in SCR-76 with Try again, never "no agent has access", and without the transport's wording. A decision on an expired or already answered request is refused, and the refusal is said in the operator's language. A mailbox with an invisible or look-alike character (not printable ASCII) is refused before any prompt, so what is shown is exactly what is granted. A hub whose port is taken says why in SCR-76; sessions Fabric starts keep working.
- **Design rationale:** One prompt per request, not per call — fatigue makes Allow reflexive (ADR-0115, rejected alternatives); the prompt states what Fabric can and cannot prove. Deny stands: the prompt, the queue row and SCR-76 each say that Deny keeps refusing the same request until it is cleared, and SCR-76's Denied requests says what Clear does (2026-10-04, release review I3 U-1), so a stray Enter on the default Deny is never a silent permanent answer.
- **Telemetry:** journal events `access.requested@1`, `access.decided@1`, `access.credential.claimed@1`, `access.grant.revoked@1`, `access.binding.revoked@1`, `access.denial.cleared@1`, `hub.call.forwarded@1`, `hub.call.refusals.summarized@1`.
- **Amended 2026-10-13 (COM-03, [ADR-0149](../adr/0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md) §2):** an agent may also ask Fabric itself to answer one project's requests — `board.respond` on 1 to 8 `board:<project>/<capability>` of ONE project. A coding agent of the runner catalogue or a registered agent may ask it; anything else, an unknown project, a second project or a folder is refused before anything is shown. The prompt and the queue say it as the operator reads it: "Let <agent> answer <capabilities> requests for <project>?", what it may do (take and answer the requests other projects send to that project, for those capabilities) and what it may not (spend, publish or delete through this), the same-user floor and "for a year, unless you revoke it". It is SCN-145's ask.
- **Status:** draft
- **Amended 2026-10-17 (0.3.7 wave 1, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** on the operator's own computer an ask to join a project is SCN-167's and is let in ([ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md) §3). Any other ask of a product's resources is asked as a question on Главная (SCN-164) — who asks, what, why, and «Разрешить» / «Не разрешать» — never as a native prompt, a notification or a queue item; a granted access is withdrawn with «Отозвать» in Агенты or Настройки and with «Отменить» in История.
- **Amended 2026-10-21 (0.3.8, [ADR-0166](../adr/0166-one-attribution-of-folders-to-projects-across-fabric-switchboard-and-observatory.md) amendments):** a registered service or a coding agent may ask Fabric itself for `project.resolve` on the resource `projects` (read which Fabric project a folder belongs to). On the operator's own machine it is allowed at once and recorded as that agent's act, with no prompt; Settings → Agent access shows it as «узнавать, к какому проекту Fabric относится папка», and «Отозвать» ends it: `fabric.project.resolve` answers only while that grant, or a coding agent's enrollment, is live. An agent the person disconnected is refused. The tool descriptions an agent reads say how to ask.
- **Coverage:** apps/desktop/src/main/accessService.ts, apps/desktop/src/main/consentPresenter.ts, apps/desktop/src/main/hubTools.ts, apps/desktop/src/renderer/src/AgentAccessPanel.tsx, apps/desktop/src/renderer/src/launch/ObligationActs.tsx
- **Product:** unobserved

### SCN-133: Connect a product to Fabric by the product's own consent
- **Persona:** P-01
- **Feature:** Hub
- **Traces:** ST-045, FLW-76 (JTBD-08)
- **Entry point:** Settings → Agent access → Connect beside the product; or Allow and connect in SCN-132's prompt.
- **Preconditions:** The product's desktop app is installed and signed in; Project Observatory is installed (its vault keeps the product's key).
- **Steps:**
  1. Operator chooses Connect → Fabric opens the product's connect link; SCR-76 says it is waiting for the answer in the product and disables Connect/Reconnect while the answer is pending. A Reconnect explicitly says the current key stays in use during this wait.
  2. The product's app asks the operator in its own prompt → Allow → the app makes a key through the owner's signed-in session and delivers it to Fabric on this Mac.
  3. Fabric stores the key's secret in Project Observatory's vault, keeps only the key's metadata, and SCR-76 shows the product connected, with its server and date.
- **Expected result:** The product is connected once, with nothing copied by a person; agents with grants reach it through Fabric.
- **Alt paths:** Deny in the product → SCR-76 says the connection was declined, and the refusal is in the journal. The product reports it needs a sign-in, has no server, or could not make the key → SCR-76 shows that reason with Try again. No answer from the product within 10 minutes → "waiting" ends and SCR-76 says no answer came, with Try again. Disconnect → Fabric stops using the connection at once; it does not revoke the key: SCR-76 says the key stays valid in Fabric Inbox → Agent access until the operator revokes it there, and its secret stays in its vault slot (no record names it). Reconnect (a connected product) → the same flow replaces Fabric's key; it is the only way a live connection's key is replaced — Connect is not offered while connected, and Allow and connect in SCN-132 does not reconnect. Only after a successful replacement does SCR-76 say Fabric stopped using the previous key, which stays in the product's Agent access until revoked there. A denied or failed Reconnect retains the current key unless the outcome explicitly says it was lost. A second Connect/Reconnect while one is pending is refused as busy. The callback records the predecessor chosen when consent opened and refuses if that connection changed before recording; the database verifies the predecessor atomically. If Disconnect or another replacement changed it during consent, the localized failure says the connection changed and asks the operator to check its current state; it never claims a disconnected product is already connected.
- **UI elements:** Connect; Reconnect and Disconnect once connected; waiting, declined and failure lines.
- **States covered:** loading,hub-off,waiting,connected,declined,failed
- **Errors & recovery:** SCR-76 accepts only the newest eligible overview: an act invalidates older reads before changing state; polling waits through the act and its fresh read. Late successes/errors or completions after panel cleanup cannot restore stale connections; a current read failure remains unreadable, never empty.  Fabric answers the product within its 10 seconds or not at all: the whole delivery runs inside one 8-second deadline. The secret is stored first, in a vault slot of its own (named by the estate and the connection, so two estates on one Mac never share one), and only then is the connection recorded and the product told yes. Without Project Observatory, with a vault that refuses, or past the deadline, nothing is recorded, the previous connection stays as it was, the product revokes the new key, and SCR-76 says why. A record that itself lands after the deadline is withdrawn at once; on a Reconnect the previous connection had already been replaced by it, so SCR-76 says Fabric Inbox is not connected now and to connect again. A POST that does not carry the attempt's own state (wrong content type, a body that is not a JSON object, no state or an unknown one) is refused and leaves the pending attempt waiting, so the genuine delivery that follows still connects; a delivery that carries the state but is invalid settles that attempt as failed at once; a browser Origin cannot cancel consent. A late record that could not be withdrawn says the recorded connection will not work and to disconnect then connect again. A hub that is not listening disables Connect and Reconnect and gives the remedy for its own cause (invalid setting, registered-agent port claim, another listener, or startup failure) in the operator's language; machine observations are a secondary line. On Windows, where Project Observatory's vault does not run yet, Connect and Reconnect are refused before the product is opened, with that reason in the operator's language: no consent is shown for a key Fabric could not keep (0.3.5 review UX-6).
- **Design rationale:** The product's own app asks, so "keys are issued by a person in the app" still holds; Fabric holds one credential per product and never hands it to an agent (ADR-0115 §4, §6).
- **Telemetry:** journal events `product.connected@1`, `product.disconnected@1`, `product.connect.refused@1` (the product's own Deny or failure).
- **Status:** draft
- **Coverage:** apps/desktop/src/main/productConnect.ts, apps/desktop/src/main/observatoryVault.ts, apps/desktop/src/renderer/src/AgentAccessPanel.tsx
- **Product:** unobserved


### SCN-134: See that Fabric shares usage counts, and turn them off for every PassionCode app
- **Persona:** P-01
- **Feature:** Settings
- **Traces:** passioncode-ai/fabric#12, RM-13, FLW-40
- **Entry point:** the first-run notice at the top of the window, or Settings (SCR-52) → *Share usage counts*.
- **Preconditions:** A release build of Fabric. A source build shows the switch unavailable with the reason.
- **Steps:**
  1. The person opens Settings → the switch is on by default in a release build, and its note says what is counted and what identifies it: installs, days of use and how many projects, products and agents are connected, with the app version, the OS name, a session id and a random installation id every PassionCode app on this Mac shares; never names, paths or content; one switch for every PassionCode app on this Mac. **Amended 2026-10-06 (0.3.2 verification UX-2, DO-2):** the note no longer calls the counts anonymous or omits the id. **Amended 2026-10-08 (ADR-0127, A7-012):** nothing leaves before the person has answered the switch once. On the first start of a release build (and once after an update from 0.3.2) a notice at the top of the window shows the same note, says nothing has been sent yet — or, after an update from 0.3.2, that an earlier version may already have sent counts — and offers the switch (on) and *Continue*; answering it, or the switch in Settings, is the answer. Until then no event is queued, `app_installed` included.
  2. The person turns it off → Fabric writes `analytics: false` into the shared PassionCode file, drops the counts still waiting, and sends nothing more; Fabric Switchboard and Fabric Inbox read the same switch.
  3. Turning it on again → counts resume with the next event; nothing missed while it was off is sent later.
- **Expected result:** The person knows what leaves the Mac and has one switch for all PassionCode apps.
- **Alt paths:** A build without the App Key → the switch is disabled and the note says this build sends nothing. The shared file cannot be read (it does not parse, or its id is not valid) → analytics stays off, the switch is disabled and the note names why; the file is never repaired. The status cannot be read → the note says so, and the switch is disabled rather than shown as off. Another PassionCode app turned the switch → Fabric honours it within the hour. The person turns the switch off on the first-run notice → nothing is sent while the shared switch stays off, and the notice does not come back. The answer cannot be saved → the notice stays and says nothing is sent until it is. Another PassionCode app's notice was answered → Fabric still shows its own once (the answer is per app).
- **UI elements:** the checkbox *Share usage counts*; one note line under it; the first-run notice (a `Banner`: title, the note, *nothing has been sent yet* — or, for an install whose earlier version already queued counts, that an earlier version may already have sent them, the checkbox, *Continue*; focus on *Continue*; a failed save keeps it and says nothing is sent).
- **States covered:** on, off, pending-disclosure, pending-disclosure-sent-before, unavailable-no-key, unavailable-file, unreadable
- **Errors & recovery:** a send that fails is retried after 60 s, then every 10 min, and dropped after 23 h; nothing is shown to the person, and each attempt is one `analytics.flush` line in the operations log.
- **Design rationale:** usage counts are an effect with an owner (the person), a boundary (counts only, release builds only, one shared switch) and a receipt (the operations log), as the vision's alignment test asks.
- **Telemetry:** none in the journal; the operations log records `analytics.flush`.
- **Status:** draft
- **Amended 2026-10-17 (0.3.7 wave 1, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** the usage-counts question is asked once, in the first run's first step beside the language (SCN-126), and the switch lives in Настройки → «Данные» (SCN-170); the first-run notice banner goes (ADR-0160 §5).
- **Coverage:** apps/desktop/src/main/analytics.ts, apps/desktop/src/renderer/src/UsageCountsSetting.tsx, apps/desktop/src/renderer/src/UsageCountsNotice.tsx (the first-run notice, ADR-0127; an install that already sent counts is told so)
- **Product:** unobserved

### SCN-135: Launch through the fallback order: an open session first, otherwise the next coding agent that can start
- **Persona:** P-01
- **Feature:** Settings
- **Traces:** operator request 2026-10-07, ADR-0125, CO-223, contract DEC-0029, FLW-40
- **Entry point:** Settings (SCR-52) → *Fallback order*; then any launcher that offers a coding agent (the project's agents panel, the task panel).
- **Preconditions:** At least one coding agent is installed on this computer.
- **Steps:**
  1. The person adds coding agents to the order and says how each serves — *Start a new session*, *Use an open session, otherwise start one*, *Use an open session only*. The operator's example: Claude Code with *Use an open session only*, then Hermes Agent with *Start a new session*.
  2. Every launcher now offers *Fallback order → <coding agent>* and chooses it by default; the name after the arrow is the coding agent the order resolves to right now.
  3. The person launches with it → Fabric walks the order from the top: an open, idle Claude Code session of this project, in the same permission mode, is brought forward; with none, Hermes Agent starts and answers.
- **Expected result:** The launch is served by the first coding agent in the order that can serve it, and the session record says which one and why the ones above it were passed over (`terminal.opened@1` `route`).
- **Alt paths:** The person picks a coding agent by name → exactly that agent runs, or the launch fails as before; the order is not consulted. A task never uses an open session: it always starts its own. A coding agent that would run with a weaker gate than the first one under the chosen permission mode, or a task's agent that cannot return its result the same way, is passed over. The order is empty → no *Fallback order* choice is offered and nothing changes. A task that records through Fabric's tools (the setup preset) is never given to a coding agent without them: the walk passes over such agents, and over all of them while the agent surface is not listening (ADR-0125 amendment 1); with the setup preset loaded, the task panel's *Fallback order → …* names the agent that walk chooses, not the one a launch without the preset would get (CO-234).
- **UI elements:** the *Fallback order* list in Settings with Up, Down, Remove and Add; the *Fallback order → …* choice in the launchers.
- **States covered:** empty order, order set, resolved, exhausted
- **Errors & recovery:** No coding agent in the order can start → nothing starts, and the person reads each agent with the reason it was passed over (not installed, did not answer, signed out, no open session, cannot run this launch, could not be started, not known to this version); installing, signing in or editing the order fixes it. From the agents panel, a coding agent whose start fails is passed over and the next one is tried; a task fails instead, because it was created for the agent the order chose. A launch whose authority changed is stopped and never retried on another agent.
- **Design rationale:** the person chooses the order and the choice is visible in every launcher; nothing is substituted silently, and a fallback never loosens a gate (vision principle 2: the agent serving the work may change, the Project's purpose, history and evidence do not).
- **Telemetry:** `terminal.opened@1` carries `route` (basis `host-order`, the selected index and every passed-over agent); an exhausted walk and an attach are operations-log lines `runner.fallback-exhausted` and `runner.fallback-attached`.
- **Status:** draft
- **Coverage:** apps/desktop/src/shared/runnerRoute.ts, apps/desktop/src/main/runnerFallback.ts, apps/desktop/src/renderer/src/FallbackOrderSetting.tsx, apps/desktop/src/renderer/src/useFallbackChoice.ts
- **Product:** unobserved
### SCN-136: Create an ecosystem agent
- **Persona:** P-01
- **Feature:** Start paths
- **Traces:** ST-050, FLW-73 (JTBD-05), SCR-74; operator request 2026-10-08 (D1, D3); ADR-0123, ADR-0129
- **Entry point:** Start menu → Agent → Create an agent; first run step 3.
- **Preconditions:** At least one coding agent is installed on this computer.
- **Steps:**
  1. Operator types the agent's name and, in one sentence, what it will do → both are plain fields; the name becomes the folder's name, so Fabric refuses only what a folder name cannot hold: an empty name, more than 80 characters, a leading dot, `/`, `\` or `:`, control characters and text-direction controls (`shared/startPaths.ts#folderNameProblem`).
  2. Operator chooses where its folder goes (the native picker for a parent folder) → the full path of the new folder is shown before anything is created.
  3. Fabric says whether the Fabric Agent Adapter skills are installed for the chosen coding agent (as SCN-131 step 3).
  4. Operator chooses the coding agent (the first in the fallback order that is installed and answers; else the first found that connects to Fabric's tools; else the first found — preselected; the hint says which rule chose it) → Create and open the console.
  5. Fabric creates the folder as a git repository on `main`, creates a Project for it whose purpose is the sentence from step 1, files the build as a task, starts the coding agent in the folder and opens its console. The coding agent builds the agent with `creating-fabric-agents`: it asks its intake questions in the console and creates no file until each has an answer.
- **Expected result:** A new folder, a Project holding it, and a running console session building an agent to the Fabric Agent Contract there, one question at a time; the Fabric window opens that Project.
- **Alt paths:** A folder of that name already exists under the parent → nothing is created, the refusal is said under the Name field and focus returns to it. The skills are missing, found only in the shared folder, unreadable, or not covered by the install command → as SCN-131. The operator leaves the form before anything was made → nothing is created; after the folder was made, leaving and coming back (Back, the sidebar, even mid-request) continues the same attempt with the failure still said.
- **UI elements:** Name; What it will do; Where its folder goes with Choose; the resulting path; coding agent choice with its hint; skills status with Copy and Check again; Create and open the console (looks unavailable until it can go, and a press says what is missing); Try again, Start over, Use another coding agent; Back.
- **States covered:** idle, invalid-name, no-purpose, no-parent, exists, skills-missing, checking-skills, no-agent, creating, failed, failed-after-folder, started
- **Errors & recovery:** An empty or unusable name, an empty sentence and a missing place are said under their field once Create is pressed, and nothing is made. A failed mkdir or git init leaves no half-made folder (as SCN-129). Once the folder exists, a later failure (the Project, the task, the console) says why and that the folder is kept — and its Project, when it was made; the name, the sentence and the place are then fixed (the Project and the task hold them) and Try again continues in that folder with the same Project, task and — once started — session, so a console that did not come forward is said as exactly that and brought forward again, never a second task. The coding agent is fixed from the first launch attempt; when that launch failed before a session existed, Use another coding agent gives the same Project a new task and cancels the first on the board (a refused cancel is said); a task whose session runs is never cancelled, and Start over is not offered while it runs. Start over is the only way to another name, sentence or place: a new attempt; the made folder stays on disk and its Project among the projects, and a recorded task with no running session is cancelled on the board. A failed read of the coding agents, the skills or the folder picker is said in words with Try again or Check again. A session the first try started but could not report is brought forward on retry, never refused as already running. No coding agent can start → nothing is created and each agent reads with its reason.
- **Design rationale:** «Create your own agent» means a new ecosystem agent with its own repository (D1), built in the coding agent's own console (ADR-0123); the in-project role agent stays SCN-130. The form asks only what Fabric needs to create the folder and the Project; everything else the skill's intake grill asks in the console.
- **Telemetry:** planned only.
- **Status:** draft
- **Amended 2026-10-17 (0.3.7 wave 1, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** reached from «Создать» → «Создать агента» and from «Создать агента» in Агенты (SCN-171); the new agent appears in Агенты as it is made.
- **Coverage:** apps/desktop/src/renderer/src/start/AgentPaths.tsx (`CreateAgent`), apps/desktop/src/main/projectFolder.ts, apps/desktop/src/main/adapterSkills.ts, apps/desktop/src/main/taskRetry.ts, apps/desktop/src/shared/builderChoice.ts; tests apps/desktop/src/renderer/src/start/StartPaths.test.tsx (`create an ecosystem agent`, `0.3.3 verification, iteration 1: the agent paths`), apps/desktop/test/adapter-skills.test.mjs, apps/desktop/test/task-retry.test.mjs; decision ADR-0129
- **Product:** unobserved


### SCN-137: A coding agent opened outside Fabric starts working in a project
- **Persona:** P-01
- **Feature:** Hub
- **Traces:** ST-045, FLW-77 (JTBD-08)
- **Entry point:** The person opens a coding agent (Claude Code, Codex, Kilo Code, Hermes Agent) in a terminal, in any Git repository or worktree on this machine. The agent has `fabric-mcp` registered once, with no secret — by the Setup console (SCN-126) or by hand: `claude mcp add --scope user fabric -- "<Fabric>/bin/fabric-mcp" --runner claude-code` ([ADR-0134](../adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md)).
- **Preconditions:** Fabric is installed. The folder is inside an admitted repository or worktree, or it is an eligible unknown Git repository or worktree. A non-Git folder, home or filesystem root, an archived Project, an ambiguous identity and an operator-detached repository are never automatically registered.
- **Steps:**
  1. The agent starts and calls `fabric_whoami` first, as its MCP server's instructions say → while Fabric has not admitted it, the one tool answers what Fabric waits for, never a fake success: Fabric is not running (or its hub is closed, with where to see why), or this folder cannot be registered automatically and why.
  2. Fabric resolves exact, ancestor, worktree and remote identity in that order. An unknown eligible folder is created or attached through the canonical main-process admission service and recorded in the journal, then `session.enroll` is allowed at once as the coding agent's own act. There is no separate + Project → Open a project step and no confirmation prompt.
  3. The agent's tool list changes and `fabric_whoami` answers with the project, its repositories and the rules of the session; the agent works there like a session Fabric started; the feed says "a coding agent opened outside Fabric joined the project".
  4. Later sessions of the same coding agent in the same project join without another registration; Fabric restarting does not register again — the next call reconnects.
  5. Operator revokes the agent or its grant in SCR-76 → its open sessions end and the next call is refused; the agent goes back to asking.
- **Expected result:** A coding agent the person opened themselves reaches Fabric's harness in the correct project without a separate project-creation step or confirmation dialog, with nothing secret in its configuration, and its work is journalled like any session's.
- **Alt paths:** A non-Git or too-broad folder → `no-project`, with no write. More than one Project matches → ambiguity is refused, never guessed. An operator detached or archived the repository → automation does not restore it; only an explicit attach can clear the tombstone. A standing denial → the agent is told it was denied and the denial stands until cleared in SCR-76; admission does not run again. The request expires (10 minutes) → the agent asks again on its next start. The folder belongs to another project than the one asked for → refused before admission. Fabric quits while the agent works → its calls say Fabric closed the session and it reconnects when Fabric is back. A call whose answer was lost (a timeout) → the agent is told the outcome is unknown and to check its effect before acting again; nothing claims it was not done.
- **UI elements:** SCR-76's agent card with its project grant and Revoke; the История entry and feed sentence; no enrollment prompt or queue row.
- **States covered:** not-running,hub-closed,no-project,waiting,allowed,denied,expired,revoked,reconnecting,detached,ambiguous
- **Errors & recovery:** Fabric's hub cannot be verified (a foreign protocol, a dead pid, a token file outside Fabric's folder) → the agent is told Fabric could not be verified and to open Fabric; nothing is sent. A credential Fabric no longer knows → it is forgotten and the agent asks again. Admission or its journal fails → no session is minted and the next call retries idempotently. Writing the credential fails after Allow → the agent says the Allow must be repeated and why.
- **Design rationale:** ADR-0136 resolves identity before any write; ADR-0160 supplies the local, recorded and revocable authority. One canonical admission service handles agent enrollment and the operator's IPC path, so automatic registration cannot become a second set of rules or a write into a sibling product store.
- **Telemetry:** journal events `project.created@1`, `project.repo.attached@1`, `project.repo.detached@1`, `access.requested@1` (callee `fabric`, capability `session.enroll`), `access.decided@1`, `access.credential.claimed@1`, `session.enrolled@1`, `access.grant.revoked@1`, `access.binding.revoked@1`.
- **Amended 2026-10-13 (COM-03):** the enrollment is the session's board enrollment for that one project (ADR-0149 §1): it takes part in the project board as its project. Answering other projects' requests is asked apart (SCN-145); once granted, the enrolled session answers under its own binding's grant, a session Fabric launched under its runner's.
- **Status:** draft
- **Amended 2026-10-17 (0.3.7 wave 1, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** step 2 goes ([ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md) §3): the agent is let in at once, recorded as its own act, and shown in История and in Агенты with «Отключить» (SCN-167); the native prompt, the board item and the Agent-access queue for an enrollment are removed. Steps 3–5 stand, with «Отключить» in place of revoking in SCR-76.
- **Amended 2026-10-17 (automatic project registration, [ADR-0136](../adr/0136-a-folder-joins-a-project-by-a-pick-or-by-consent.md) §2):** the folder no longer needs to be opened manually first. Exact, ancestor, worktree and remote identity attach to the existing Project; an otherwise unknown eligible Git repository is created once. Detach tombstones and archived Projects are not undone, and ambiguity or a non-Git/broad folder is refused.
- **Amended 2026-10-21 (0.3.8, the audit of 0.3.7):** a folder Fabric refuses as too broad (a filesystem root, the home folder, a folder right under it, one that holds other projects) is asked about again after 30 s, then twice as long each time, up to 10 minutes; nothing the person does in Fabric lifts that refusal (a Hermes in the home folder was refused every 30 s for three days). Every other refusal keeps its wait: a detached folder or an ambiguous match 30 s, so undoing a detach in Fabric is seen within 30 s, and a denial 60 s; a repeated failure waits up to a minute; a 503 that names Retry-After is waited out. The agent's own `fabric_whoami` still asks at once and starts the waits over. A coding agent already running keeps the `fabric-mcp` it started with until it is restarted.
- **Coverage:** apps/desktop/src/main/fabricMcp.ts, apps/desktop/src/main/fabricMcpMain.ts, apps/desktop/src/main/sessionEnroll.ts, apps/desktop/src/main/folderResolver.ts, apps/desktop/src/main/projectAdmission.ts, apps/desktop/src/main/accessService.ts, apps/desktop/src/shared/accessWords.ts, apps/desktop/src/renderer/src/AgentAccessPanel.tsx
- **Product:** unobserved

## Agents first — the operator's evening additions · 2026-10-11 ([0.4.0 plan](../evidence/plans/2026-10-11-release-040-agents-first.md#operator-additions-evening))

REQ-38, REQ-39 (its setup step), REQ-41 and REQ-42, with the touchpoints of REQ-16/REQ-17 they need. The first run
itself is SCN-126 (rewritten) and its scan SCN-128 (amended); these are the new behaviours. Every string quoted here
describes the interface; the words themselves are written through `copywriting` when the screens are built.

### SCN-138: Set up the family's own agents first — Project Observatory, then Fabric Dashboards — in the Setup console
- **Persona:** P-01
- **Feature:** First run
- **Traces:** ST-045, ST-001, FLW-78, FLW-79 (JTBD-08, JTBD-01); 0.4.0 plan REQ-10, REQ-11, REQ-35, REQ-39, REQ-40; [ADR-0135](../adr/0135-setup-runs-in-the-persons-coding-agent-and-fabric-shows-what-it-observes.md); the order's home is the knowledge base's `agents-first.md` (plan R-10)
- **Entry point:** The first run's step 5 (SCN-126); Home's «Finish setting up» card after a skip; Settings → Coding agents and products (SCR-77) → «Set up the family's agents».
- **Preconditions:** The setup order is the knowledge base's `agents-first.md`, pinned with the release; Fabric renders it and does not decide it. Fabric itself installs nothing and writes no coding agent's configuration (ADR-0135 §3); the checklist shows only what Fabric observes (§4).
- **Steps:**
  1. Operator sees the coding agents of the runner catalogue (Claude Code, Codex, Kilo Code, Hermes Agent, Cline, Kimi Code), one line each in plain words: installed (its version) · signed in, or "sign in, then check again" · the adapter skills present or not · connected to Fabric (its own MCP list holds `fabric` and a `fabric_whoami` from it reached the hub) → every row is a radio (REQ-40): every installed agent that answered can be picked whatever its sign-in state; the head of the fallback order is preselected when it can be picked, else the first installed one that is signed in and answers, and a hint says which rule chose it; a row not installed or not answering stays visible, disabled, with why and what to do in one line (not installed — the vendor's install command and Copy; did not answer `--version` — run it once, then Check again). The pick is saved at Continue as the head of the fallback order (ADR-0125); an untouched default writes nothing; a refused save says why and offers Continue without saving.
  2. Below, «First, the family's own agents»: **Project Observatory** — keeps the keys your products use and maps your repositories to projects; **Fabric Dashboards agent** — shows your services and Fabric's tasks per project, with Fabric's button on every page. Each carries its observed state: not installed · installed, not registered · registered, not verified · verified (when) → «Set up with <coding agent>» is the step's one primary action.
  3. Fabric opens the Setup console (SCR-25, setup state): the chosen coding agent, started by Fabric in a setup folder of its own with the setup brief and Fabric's session tools → in the console the agent goes step by step and asks the person before each: machine readiness (the Docker engine running, the Supabase CLI, the engine not publishing ports on the network — CO-219) → the adapter skills (the launcher's `update`) → Fabric's MCP in each detected coding agent by that agent's own CLI, then a `fabric_whoami` from it → Project Observatory: download, `SHA256SUMS` verified with GPG against the organization key and `shasum -c`, the platform's own check, install, its MCP line in the coding agent, its proving call → the Fabric Dashboards agent the same way.
  4. Operator answers each step in the console (sign-ins, a key typed into a hidden prompt and an administrator password are the person's, never Fabric's) → beside it SCR-77 ticks a line only when Fabric observes it: the binaries and skills re-detected, `fabric` and each product in the agent's own MCP list, the installed bundle with a valid signature, the product answering Fabric's probe of its well-known document, and the proving call's answer as the agent reported it, marked «reported».
  5. Both products verified → the step says Project Observatory and Fabric Dashboards are set up and answering, each with when it was verified → Continue (in the first run) or Done (from Settings).
- **Expected result:** Project Observatory and the Fabric Dashboards agent are installed from verified downloads, registered in the chosen coding agent, answering, and verified — each line of the checklist an observation with its time; nothing is installed that the person did not allow in the console; the other family products are offered after these two, never before (SCN-139).
- **Alt paths:** «Skip for now» → asks why, one choice — "I'll do it later", "I set them up another way", "I don't want them now", or a few words of their own — and says what is lost (without Observatory, products cannot be connected to Fabric and their keys have no vault; without the Dashboards agent, Fabric's tasks are not shown in Dashboards and its button is not there) → Skip records the reason and continues; Home shows one «Finish setting up» card until setup is done or the card is dismissed. "I set them up another way" → Check again reads the observations; verified lines are done without the console. Observatory already installed and verified → its line says so and the console starts at the Dashboards agent. Only one coding agent on this Mac → it is preselected and still shown as a choice. Observatory fails and the person goes on → «Continue with Fabric Dashboards» sets up the Dashboards agent alone; Observatory stays «not set up» with its reason and «Try again». The console is closed mid-way → the checklist keeps what was observed and offers «Continue setup», which reopens the console at the first unobserved step with the same brief. «Use another coding agent» → the same brief in the other agent; what was observed stays observed. Help → Walk through the first run again with everything verified → each line reads verified and Continue is the only action.
- **UI elements:** coding-agent rows (radio, one state line, the reason when disabled, the install command with Copy); Check again; the two family products with what each gives and its state line; «Set up with <coding agent>»; «Skip for now» with its reason choice and the what-is-lost line; the live checklist (step, observed or reported, time); Continue setup; Try again; Use another coding agent; Continue with Fabric Dashboards; Continue / Done; Home's «Finish setting up» card with Dismiss.
- **States covered:** checking,agents-read,agent-disabled,not-signed-in,choice-not-saved,no-agent,ready,console-open,step-observed,step-reported,verified,not-confirmed,refused-unverified,observatory-failed,dashboards-failed,console-closed,skip-asked,skipped,already-verified,check-failed
- **Errors & recovery:** Detecting the coding agents fails → said, with Check again; Skip for now stays available. No coding agent can run setup → "Setup runs in a coding agent, and none on this Mac can start", each agent with its reason and install command; Skip for now (with a reason) is the way on. A picked agent that is not signed in stays picked, and «Set up with <agent>» says "Sign in to <agent> in its own window, then Check again" instead of starting — the console never starts on a signed-out agent (ADR-0135 §5), while the pick itself is a preference, never a gate. A download whose signature or checksum does not match → the agent stops and installs nothing; the line reads "Download not verified — refused" with the agent's reason quoted; Try again fetches it again. The install fails (disk, permission, the platform's check refused) → "Not installed — stopped at <step>" with the agent's reason quoted as its report; Try again reopens the console at that step; Use another coding agent; Skip with a reason. The agent says a step is done and Fabric cannot observe it → "not confirmed", naming what Fabric looked for ("no `observatory` in Claude Code's MCP list") with Check again. The product is installed and does not answer → "installed, not answering" with Open <product> and Check again. A step needs a credential → the agent asks in a hidden prompt or reads Observatory's vault, never a command line Fabric wrote (LC-04). The Setup console cannot be started → the reason; nothing changed; Try again or another coding agent. Fabric quits mid-setup → the console ends with Fabric; the next start shows what was observed and Continue setup.
- **Design rationale:** ADR-0135: the person's coding agent does the setup in a console the person watches, and Fabric checks and shows. Observatory first because its vault holds the keys of every product connection after it (SCN-133) and its repository map suggests where an agent's folder belongs (ADR-0136); the Dashboards agent second because Dashboards is where Fabric's work is seen outside Fabric (ADR-0139) and it hosts Fabric's button (SCN-142). REQ-40: no agent row is silently unclickable — a row that cannot be chosen says why.
- **Telemetry:** planned with REQ-11 — journal `setup.step.observed@1` (step, product, coding agent, observation kind) and `setup.skipped@1` (the reason as chosen).
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-139: Set up a family product's MCP with any coding agent, and see Fabric verify it
- **Persona:** P-01
- **Feature:** Setup
- **Traces:** ST-045, FLW-79 (JTBD-08); 0.4.0 plan REQ-41, REQ-11; [ADR-0135](../adr/0135-setup-runs-in-the-persons-coding-agent-and-fabric-shows-what-it-observes.md); each product's install, MCP line and proving call live in the knowledge base's `products.md`
- **Entry point:** Settings → Coding agents and products (SCR-77) → a product's «Set up with <coding agent>»; after the first run's family step, the rest of the family under «More from the family»; a product's own skill run in any coding agent outside Fabric — Fabric then shows what it observes.
- **Preconditions:** The product list, each product's MCP line and its proving call come from `products.md`, pinned with the release. The coding agent is installed and signed in.
- **Steps:**
  1. Operator opens SCR-77 → one row per family product (Project Observatory, Fabric Dashboards, Copylot, Asset Foundry, Mobile Publisher, Fabric Inbox, Research Agent and the rest `products.md` lists) and, per coding agent, one cell: verified (when) · registered, not verified · not registered · not installed · not offered for this system.
  2. Operator chooses a row's «Set up with <coding agent>» (the row's one action; «Add to <another agent>», «Remove» and «Copy receipt» in its … menu) → the Setup console (SCR-25, setup) opens briefed for that one product: download, verify (`SHA256SUMS` with GPG, `shasum -c`, the platform's check), install, register its MCP by the agent's own CLI, make the proving call — each step asked in the console.
  3. Fabric observes each step as it lands → the cell moves: installed (version, signature valid) → registered (seen in the agent's own MCP list) → answering (Fabric's probe of the product) → verified, once the agent reports the proving call's answer and the three observations hold.
  4. Operator opens a cell → its receipt: the product and its version, the coding agent and its version, the command the agent used to register the server (no secret in it), the proving call and its answer as reported, Fabric's own observations with their times, the system → «Copy receipt».
- **Expected result:** The product is an MCP of that coding agent on this Mac, set up by the agent from the product's own instructions with no hand edit, and Fabric shows it verified with a receipt anyone can check.
- **Alt paths:** The product is already installed → the console starts at registration. The product was set up outside Fabric → Check again fills the same cells from observation; the proving call reads «not reported» until an agent with Fabric's MCP reports it. «Add to <another agent>» → only the registration and the proving call run. «Remove» → the console, briefed to remove the server from the agent and, when asked, the product; the cell confirms each removal by observation (LC-14). A failure on a product that is a Project in this estate → «File a task in <project>» creates one task there carrying the receipt (one per product, coding agent and failure — a second press opens the first). A product not offered for this system → its cell says so and offers nothing.
- **UI elements:** the product × coding agent table; the row's «Set up with <coding agent>» and its … menu (Add to another agent, Remove, Copy receipt); cell states, each an icon with text; the receipt panel with Copy receipt; File a task in <project>; Check again.
- **States covered:** loading,read,unreadable,not-installed,installed,registered,answering,verified,not-confirmed,refused-unverified,failed,unsupported-os,setup-running,removing,removed,check-failed
- **Errors & recovery:** An observation that cannot be read (an agent's MCP list command fails) → that cell says "could not read <agent>'s MCP list" with Check again, never "not registered". A download that fails verification → refused and nothing installed; the receipt names the file and the check that failed. The registration command fails → the agent's reason quoted; Try again. The product does not answer → "installed, not answering" with Open <product>. The proving call errors → "registered, proving call failed" with the error as reported; Try again. A credential is asked in a hidden prompt or read from Observatory's vault, never on a command line (LC-04). A second setup of the same product while one console is open → refused with "Setup of <product> is already running in <agent>" and Bring it forward.
- **Design rationale:** REQ-41 makes every family product an MCP any coding agent sets up by itself on any machine; Fabric's part is to observe and show, so the matrix of product × agent × result is read from the Mac and never taken from the agent's word (ADR-0135 §4). One action per row, the rest in its menu (the operator's interface rule of 2026-10-09).
- **Telemetry:** planned with REQ-11 — journal `setup.step.observed@1`.
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved

### SCN-140: Agents ask Fabric who is working on what, claim their task, are warned of related work, and release it
- **Persona:** P-01
- **Feature:** Coordination
- **Traces:** ST-030, ST-037, ST-045, FLW-80 (JTBD-02, JTBD-07, JTBD-08); 0.4.0 plan REQ-38, REQ-07, REQ-08; [ADR-0134](../adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md), [ADR-0144](../adr/0144-one-delegation-model-fabric-issues-the-chain-the-callee-checks-it-observatory-meters-it.md); plan R-07 (link, don't copy)
- **Entry point:** Any agent working in a project through Fabric — a session Fabric launched, a coding agent enrolled through `fabric-mcp` (SCN-137), a session handed off from another product's console ([ADR-0140](../adr/0140-a-session-is-handed-its-context-in-one-format-session-handoff-1.md)), or a product agent through the hub within a project its grant names — at the start of a piece of work, as the `working-with-fabric` skill and the session's rules tell it. The operator watches on the project page (SCR-31, «Who is working on what») and in «Where work is» (SCN-141).
- **Preconditions:** The agent's session is in one project. A Fabric task is the run; a backlog row stays the status and is linked by (repository, path, id) (R-07); agent-sync leases are shown read-only (REQ-08).
- **Steps:**
  1. The agent calls `fabric_work_list` → Fabric answers who is working on what in this project: each live claim — the agent (its coding agent or product, and how it came in: launched, enrolled, handed off, through the hub), the task (its board id and title, and the backlog row it links), what it said it will touch (folders, files or patterns), since when, its last sign of life; the open tasks nobody holds; the agent-sync leases held on the repository's registers, read-only.
  2. The agent calls `fabric_work_claim` with its task — a board id, a backlog row by (repository, path, id), which Fabric links to its task (filing one when none exists), or a new row's title with its evidence — and what it will touch → Fabric records the claim (the contract's coordination claim `work.claimed@1`: work, owner, expiry, write scopes) and answers claimed, with its expiry; the project's feed says "an agent claimed a task" (a feed sentence is the event type's, `event.work.claimed@1`; it carries no names), and «Who is working on what» (SCR-31) names the agent and the task.
  3. Another agent holds related work — the same backlog row, a task linked to this one (blocks, follows, spawned), or an overlapping folder or file → the claim's answer carries a warning naming that agent, its task, what overlaps and since when, with the two ways on: coordinate (ask Fabric to hand the work over, or link the tasks) or continue knowing it; the project page marks both claims «related».
  4. While it works, the agent's calls renew the claim (`work.renewed@1`); its stage reports and notes land on the task.
  5. The agent calls `fabric_work_release` with how it ended — done (the task goes to review), handed over (to whom, with the note the next agent reads), or let go (why) → Fabric journals `work.released@1`; the project page and «Where work is» drop the claim; a handover appears in the next agent's `fabric_work_list` as waiting for it.
  6. The operator opens the project page → «Who is working on what»: one row per claim — agent, task, what it touches, since, last sign of life, «related» linking the other row; a claim silent past its expiry reads «no sign since <time>».
- **Expected result:** Before starting, every agent in a project knows who holds what there; its own work is claimed on the project's board; related work is flagged to it and to the operator; every claim and release is journalled and visible on the project page and in «Where work is» — through Fabric, never a second board.
- **Alt paths:** The same task is already claimed → the claim is refused, naming who holds it and since when; the agent may ask Fabric to hand it over (a question to the holder on the board), choose another task, or file a linked one. Two claims of one task at the same moment → the first in the journal holds it and the other is answered as held. A task whose last run Fabric launched is not proved stopped → refused as `unresolved-run` (`held` while that session's lease is live), naming the session, the run, since and until when and where its stop stands; `fabric_work_list` lists it as held, never open, and a lapsed lease is never answered as a race (CO-323). A claim on a task of another project → refused (the session's project only). A handover request → the holder's next `fabric_work_list` shows it; the holder releases with a handover, or declines with a reason. The operator releases a stuck claim from the project page (the row's … menu) → «Release this claim?» names the agent and the task and says the agent is told on its next call → confirm → `work.released@1`, released by the operator; the agent's next call says so. A session ends without releasing → the claim lapses at its expiry and reads «lapsed — the session ended» (manager hygiene on the tick, REQ-17). A product agent whose grant names no such project → refused with "this agent has no access to <project>"; it may ask through SCN-132.
- **UI elements:** (agent side) the three tool answers in plain words, the warning with the other agent, its task and the overlap; (operator side) SCR-31 «Who is working on what» rows with «related» marks and «Release…» in a row's … menu with its confirmation; the feed sentences; SCR-78's claims.
- **States covered:** listing,claimed,related-warned,refused-held,refused-other-project,refused-no-grant,handover-requested,handed-over,released,released-by-operator,lapsed,outcome-unknown,fabric-down,unreadable
- **Errors & recovery:** Fabric not running or its hub closed → `fabric-mcp` says so; the agent tells the person it could not check who else works here, and never says it checked. A call whose answer was lost → the outcome is unknown; the agent reads `fabric_work_list` before claiming again, and a repeated claim with the same key is the same claim, never a second. A backlog row that does not resolve (a repository the project does not hold) → refused, naming the part that did not resolve; the agent may file a new row instead. The board cannot be read → the list says so, never "nobody is working here".
- **Design rationale:** REQ-38: agents coordinate through Fabric before they start. The claim is the contract's coordination claim already in the journal (`work.claimed@1`, with expiry and write scopes), so a warning reads from one place. A warning, not a lock, because related work is not the same work — except the same task, which one agent holds at a time. Vision §3 (ADR-0133): Fabric always knows where what is being done and can coordinate the agents.
- **Telemetry:** journal `work.claimed@1`, `work.renewed@1`, `work.released@1`; the related-work warning is a field of the claim's answer, not an event.
- **Status:** draft
- **Amended 2026-10-17 (0.3.7 wave 1, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** the person's «Release…» on a claimed task happens at once — no three-press confirmation; История records it with «Отменить», which takes the task again for the same agent (SCN-169). The person's screens call it «задача у агента», never a claim.
- **Amended 2026-10-21 (0.3.9, [the core holds](../evidence/plans/2026-10-21-core-reliability/README.md#tracking)):** a claim moves its task from backlog to running, and a `done` release moves it to review (through running when it was still in backlog); a move that cannot happen is said in the answer, never reported as success. A claim released other than `done` (let go, handed over, a session's end, the app's quit) takes the task it moved back to backlog, unless it moved since. A hook's end ends the session when the agent's process is gone, even within 5 minutes of its last sign; fabric-mcp leaves on SIGTERM, SIGHUP, SIGINT or stdin's end. A connected coding agent signs every 2 minutes, so its claims renew while it works and do not lapse.
- **Amended 2026-10-21 (0.3.9, [the core holds](../evidence/plans/2026-10-21-core-reliability/README.md#tracking)):** a session keeps its identity after `/clear` (matched by the agent's process) and, after Fabric restarts, its agent rejoins by itself as a new Fabric session (its claims were released at quit); an end observed before the session enrolled does not end it. `fabric_agents_list` lists every session (SCN-141, where this was read, is retired) in the project, the terminals Fabric runs and the agents enrolled from their own terminals, with how each came in. Expired agent-sync leases are counted, not listed as current.
- **Coverage:** partly — the agent side: `apps/desktop/src/main/workTools.ts#registerWorkTools` (`fabric_work_list`, `fabric_work_claim`, `fabric_work_release`), `apps/desktop/test/work-claims-db.test.mjs`; the operator side: `apps/desktop/src/renderer/src/WhoIsWorking.tsx#WhoIsWorking`. Not yet: product agents through the hub (refused-no-grant, wave 4); 0.3.9: `apps/desktop/src/main/workTools.ts` (a claim moves its task, a done release to review), `apps/desktop/src/main/fabricMcp.ts` (the 2-minute sign), `apps/desktop/test/tracking-surface.test.mjs`
- **Product:** unobserved

### SCN-141: See where work is across every project — sessions, claims, review, and sessions with no project
- **Persona:** P-01
- **Feature:** Manager
- **Traces:** ST-004, ST-037, ST-030, FLW-81 (JTBD-02); 0.4.0 plan REQ-17, REQ-38, canvas C8; [ADR-0136](../adr/0136-a-folder-joins-a-project-by-a-pick-or-by-consent.md) (admission by consent)
- **Entry point:** The sidebar's «Where work is»; Home's estate line; the manager session's `fabric_estate_overview` names the same facts (REQ-16).
- **Preconditions:** The screen reads the journal's projections only — sessions, claims, tasks in review, signs of life — and writes nothing except the consented admission on its last row.
- **Steps:**
  1. Operator opens «Where work is» (SCR-78) → one row per project with work in flight: its live sessions (each with its coding agent and how it came in — launched, enrolled from a terminal, handed off from Dashboards or Switchboard), its claimed tasks (agent, task, since, «related» when flagged), its review queue count, the age of its last sign of life; projects with nothing in flight are counted in one line beneath.
  2. Operator reads the last row, always present: «Sessions with no project» — sessions reporting from a folder no project holds, each with its coding agent, folder and since; "none" when there are none.
  3. Operator opens a session → it comes forward (SCR-25); a claim → its task page (SCR-32); a review count → that project's board on its page (SCR-31), at the review column.
  4. On a session with no project, «Log under a project…» → the consent of ADR-0136 §2: log under the matched project (named, with how it matched) / a new project / don't log here → Allow admits that folder exactly as a pick would; the session moves to its project's row.
- **Expected result:** One screen answers where every piece of work in the estate is right now and who holds it, with the work no project owns named instead of hidden.
- **Alt paths:** Related claims across agents in one project show as a pair in its row. A claim whose session ended without releasing it reads «lapsed: the session ended», as on SCR-31, until its expiry ends it. «Don't log here» → the session stays on the last row as «not logged here» and that folder is not asked about again. A folder too broad to admit (the home folder, a volume's root) → the admission is refused with why, and the session stays on the last row.
- **UI elements:** per-project rows (sessions, claims, review count, last sign of life); the counted idle line; the «Sessions with no project» row with «Log under a project…»; the consent sheet (three choices, Allow, Cancel); the reading time.
- **States covered:** loading,read,nothing-in-flight,unreadable,partial,stale,related,no-project-sessions,none-unowned,admitting,admitted,refused-broad,not-logged
- **Errors & recovery:** A projection that cannot be read → that column says so on every row and the rest stays readable; never a zero. A sign of life older than its window → "no sign for 25 min", never "running". The admission fails → the reason; the session stays where it was; Try again. The estate cannot be read at all → the reason with Try again, never "no work".
- **Design rationale:** Canvas C8: the manager knows where work is. The «Sessions with no project» row is always there, so unattributed work is a visible fact and not an absence (vision principle 4). It differs from Sessions (SCR-39, the console switcher): this answers per project, by claim.
- **Telemetry:** journal `project.repo.attached@1` with `admitted_by: consent` on an admission.
- **Status:** retired
- **Retired 2026-10-17 (0.3.7 wave 1, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** Where work is is cut (0.3.7 plan §2): who is doing what is «Сейчас» on Главная (SCN-163), every agent with its work is Агенты (SCN-166).
- **Coverage:** partly — `apps/desktop/src/renderer/src/launch/WhereWorkScreen.tsx#WhereWorkScreen` and `apps/desktop/src/main/workRead.ts#readWhereWork`; «Log under a project…» and its consent are REQ-17's, wave 5
- **Product:** unobserved

### SCN-142: Open Fabric from a product's button, in that product's project, and go on in a coding agent
- **Persona:** P-01
- **Feature:** Manager
- **Traces:** ST-031, ST-045, FLW-82 (JTBD-01, JTBD-02, JTBD-08); 0.4.0 plan REQ-42, REQ-16, REQ-18; [ADR-0123](../adr/0123-the-conversation-is-the-runtimes-console-and-the-ceo-is-a-session.md) (the conversation is the coding agent's console; the CEO is a session), [ADR-0139](../adr/0139-fabric-is-a-service-its-descriptor-its-well-known-document-and-a-read-only-viewer.md), [ADR-0140](../adr/0140-a-session-is-handed-its-context-in-one-format-session-handoff-1.md)
- **Entry point:** Fabric's button on a page of Fabric Dashboards or of a family product's own dashboard — one component of the contract's service kit (SCR-79).
- **Preconditions:** Fabric is installed on this Mac (its service descriptor is registered, ADR-0139); the kit shows the button only then. The deep links are the contract's: `fabric://chat?service=<service id>&project=<project>` and `fabric://session/new?project=<project>`. Their parameters are the asker's claim: Fabric resolves the project itself (ADR-0136) and starts nothing without the person.
- **Steps:**
  1. Person sees Fabric's button (Fabric's face in the page's bottom corner; its accessible name and tooltip say "Ask <Fabric's name> about <project>") → presses it → the button reads "Opening <name>…" and the system hands the link to Fabric, starting it when it is not running.
  2. Fabric comes forward with the manager session for that project: an open one is brought forward; otherwise the session window (SCR-25, confirm-start) says "Talk to <name> about <project> — asked from <product>, <page>" with the coding agent the fallback order chooses, and Start (one press).
  3. Person presses Start → the manager session runs in the coding agent's own console with the manager's context scoped to that project, the product and the page it came from (`session-handoff/1`); the conversation happens there; the header names the project and the product and carries «Open in a coding agent» and «Back to <product>».
  4. Person chooses «Open in a coding agent» → «Start a working session» (SCR-80): the project's folder (its path, with Change… among the folders the project holds), «Isolated session» (a worktree of its own), the coding agent → Start → a working session in that project opens (SCR-25), handed the conversation so far (`session-handoff/1`); when the fallback order says to use an open session, an idle session of the project is brought forward instead (ADR-0125).
  5. Person chooses «Back to <product>» → the product's page they came from opens (in Fabric Dashboards, by Dashboards' own link).
- **Expected result:** From any product's page, one press reaches Fabric in that product's project, one more starts or continues the conversation in the person's coding agent, the work goes on in a working session in that project, and the way back to the page is one press.
- **Alt paths:** The product's project is not a Fabric project (the resolver finds nothing) → the confirmation offers the estate scope instead, saying "<product>'s project «x» is not in Fabric yet", with Add its folder (SCR-71). The service is not registered on this Mac → the session is scoped to the project only and says the product is not known to this Fabric. Fabric's first run is not finished → the first run opens and the request waits; the conversation is offered when it ends, and also when the person leaves the first run another way, by the rail (0.3.5 review UX-14). Fabric is running with no window (macOS after its last window closed, a background launch, a second launch on Windows or Linux) → the main window opens, then the link (ER-2). Another agent holds a claim on the chosen folder (SCN-140) → «Isolated session» is ticked and locked with "another agent is working in this folder". A link with no project (Dashboards' home page) → the manager session with the estate scope. The button pressed again → the same session comes forward, never a second.
- **UI elements:** the button (face, name, busy line); SCR-25's confirmation (project, product, page, coding agent, Start) and manager header (project, product; Open in a coding agent; Back to <product>); SCR-80's folder path with Change…, «Isolated session» with its reason when locked, the coding agent choice, Start.
- **States covered:** idle,opening,not-opened,confirm-start,running,resumed,project-unknown,service-unknown,first-run-pending,no-agent,launch-sheet,isolation-locked,working-session-open,back-to-product,link-refused,link-unreadable
- **Errors & recovery:** Fabric does not come forward within 15 s → the button says "<name> did not open — open it from Applications" and returns to idle; nothing is retried by itself. No coding agent can start → the session window lists each with its reason (as SCN-135) and «Set up a coding agent» (SCR-77). The working session fails to start → the reason; the manager session stays; Try again. A link with a malformed or unknown parameter → Fabric opens nothing new and says the link was not understood. The projects or their repositories cannot be read → home, with "Fabric could not read your projects to open this link. Try again."; a failed read is never taken as an empty list, so the person is never told the project is missing (ER-1, UX-14). The way back cannot open (Dashboards not installed or not answering) → said in place, with the page's address to copy.
- **Design rationale:** ADR-0123: the conversation is the coding agent's console and the CEO is a session; the button is a launcher into that session, never a chat drawn inside a product — so it adds no cockpit (anti-vision) and keeps the Project the unit: the session is scoped to the product's project. One component from the contract's service kit, so every product shows the same button. A link only opens and asks; a fresh session needs the person's press, so no web page can start agents through a link.
- **Telemetry:** journal `terminal.opened@1` with the manager scope and its `route`; planned: the `service` the request came from.
- **Status:** draft
- **Amended 2026-10-17 (0.3.7 wave 1, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** a deep link opens what it links to (ADR-0160 §5): Fabric comes forward in that project with the conversation started on the coding agent the launch order chooses — no confirm-start step; «Отменить» on the act line stops it.
- **Coverage:** partly — `apps/desktop/src/shared/linkRoute.ts#routeForLink` (the project by the link's id or name, else by the service's registered repository against the projects' remotes; one match only, never a guess), `apps/desktop/src/shared/linkRoute.ts#resolveLink` (a failed read is `link-unreadable`, never an empty list) and `#linkWindowPlan` (a link that finds no window opens one), `apps/desktop/src/main/index.ts` region `fabric-link-handler` (the `fabric://` scheme registered, `open-url` and a second instance's argv, links held until the window exists), `App.tsx` region `fabric-link-open` (the notice; a held link offered when the first run is left by any route); the parser is the contract's, vendored (`apps/desktop/src/shared/contract/fabricLinks.ts`). Until the manager's conversation (REQ-16/REQ-42, wave 5) a chat link opens the project with a notice that the conversation is coming; a session link opens the project to start one
- **Product:** unobserved

## Project communications · 2026-10-11 (COM-06)

### SCN-143: See what projects tell each other

The screen the operator asked for: the project board's messages, read with their own eyes
([ADR-0117](../adr/0117-fabric-hosts-the-project-board-of-fabric-project-comms.md) D3 sanctions the
LOCAL operator's read; the enterprise "admin reads content" question stays open there). The name is
**Comms**, not Board: the kanban owns that word (launch.nav.board), and ADR-0117 amendment 1 kept
"board" out of user-facing text until these screens were designed — this scenario is that design. The screen keeps
that choice in its own messages too (corrected 2026-10-13, wave-2 product finding 9): it calls its source by its name,
**Comms** in English and **«Переписка»** in Russian — "Comms is loading…" / «Читаем переписку…», "Comms did not answer." /
«Переписка не ответила.», "Comms stopped answering. …" / «Переписка перестала отвечать — …» — and never "the board" /
«доска», which on the rail is the kanban («Доска»). The term is in `docs/brand/terminology.md`.

- **Persona:** P-01
- **Feature:** Project communications
- **Traces:** FLW-83, SCR-81; COM-06, COM-07 in [the comms plan](../evidence/plans/2026-10-04-project-communications.md)
- **Entry point:** the left rail's Comms item
- **Preconditions:** an estate exists; projects have exchanged at least one message for the non-empty path
- **Steps:**
  1. Operator opens Comms -> the estate's threads are listed oldest first: subject (or the first words when none), the participant projects BY NAME, how many messages it holds and when the last one was written.
  2. Operator opens a thread -> its messages read oldest first, each naming the sender project and principal — and whether that principal is trusted or merely asserted, the contract's own distinction.
  3. A message that is a request shows its lifecycle as TWO separate facts, the way the contract keeps them: state (queued / claimed / accepted / in_progress / completed / failed_known / cancelled / expired / outcome_unknown) and effect (not_started / started / succeeded_observed / failed_observed / unknown). A reply names the message it answers.
  4. Operator keeps the screen open -> new messages arrive on the poll, appended after the cursor; nothing the operator read is re-ordered or re-fetched away.
  5. Operator asks for earlier history -> one page further back by the same cursor, bounded like the board's own pages, with no message between two pages left out; "the beginning of the thread" is said only once the read has reached the thread's first message (0.3.5 review UX-1).
- **Expected result:** the operator watches projects coordinate without joining a session, and every message on screen is one the board holds — the screen shows the board's truth, never a renderer's cache of it.
- **Alt paths:** the board does not answer -> the screen says the board is unavailable and offers Try again; it NEVER shows an empty list in that case (an empty page is a true answer, an unavailable board is not). A thread the estate does not hold -> said as not found, not as empty. A redacted message keeps its place, id and digest and says its body was removed.
- **UI elements:** the thread list; the thread view with sender/project/principal/provenance per message; request state and effect as two labels; Earlier for history; Try again on failure. NO write control: the operator reads; reply/stop/pause controls arrive with their own scenarios (COM-07's later slices), and no button here promises a recovery the contract does not support.
- **States covered:** loading, empty (no threads yet — said in words), success, unavailable (the board/RPC did not answer), not-found (a thread outside this estate), refused (the read itself was refused), error
- **Errors & recovery:** a failed poll keeps the last confirmed page on screen and says when it was confirmed; the next poll that succeeds resumes from the cursor, so a dropped subscription recovers without the operator. A read that fails mid-history keeps the pages already read and refuses the older page only.
- **Telemetry:** planned only.
- **Amended 2026-10-11 (COM-07, the filter slice):** the thread list narrows, never reorders. Three filters, each "all" by default, combining as AND: by participant project (the estate's projects, by name); by kind (message / request / reply / finding / announcement — a thread matches when it HOLDS a message of that kind, per the aggregate migration 85 adds, not by its last message); and "only threads with an open request" (a request outside the contract's terminal set — completed, failed_known, cancelled, expired — counts as open; outcome_unknown counts as open, because only reconciliation leaves it). A narrowed list with no match says so in words and offers to clear; clearing returns the full list. Narrowing reads nothing new: the operator's thread function already answers with EVERY thread of the estate, so a filter can never make an unanswered board look empty, and it never re-queries the board. Time filters stay deferred — they want the bounded history paging to be complete first.
- **Amended 2026-10-12 (COM-07, the unread slice):** the operator's own "have I seen this" — machine-local, never a fact about the estate. A thread whose last message is newer than this operator's read mark carries a "new" marker in the list, and the rail's Comms item carries a count of such threads, so the board is watchable without opening it. The mark is a seq per thread in the local settings file (`commsReadThrough`, the AX-07 pattern: what THIS person on THIS machine has looked at — an estate carried elsewhere arrives without it, correctly, and it is patched field-scoped, never a whole-settings write). Opening a thread marks it read through its last seq, and new messages that arrive while it is open move the mark — the operator is looking at them. A thread never opened is unread; the first run of the slice shows every thread unread once, and a "mark all read" clears the list in one act — a click per thread would punish a long board. When the board does not answer the badge keeps its last confirmed count rather than vanishing or zeroing: zero is a true answer, silence is not. PARTICIPANT read marks — a project knowing another project read its message — stay deferred below: they belong to the contract, not to this screen.
- **Amended 2026-10-12 (COM-07, the time-filter slice):** the list narrows by last activity — "last 24 hours", "last 7 days", or all time, which is the default. Each window means exactly what it says, measured back from now and inclusive at its edge: a thread last written exactly 24 hours (or 7 days) ago is inside it, one written a moment earlier is not — not "today" or "this week", which would hinge on the calendar and the time zone. The window reads a thread's `lastAt`, a fact the board already answered with, so the slice holds the filter rule: it narrows the answered list and NEVER re-queries the board, and it combines with the other three filters as AND; clearing the filters returns it to all time. A thread with no messages yet has no activity and matches only "all time" — a silent thread is not "old", it is undated, and hiding it under a window would pretend otherwise; a `lastAt` the screen cannot read as a time is treated the same way, as undated, never as old or as new. The windows are wall-clock from the operator's machine; the last-confirmed time beside them is what makes a stale page readable as stale. "Mark all read" (the unread slice) marks EVERY thread of the board read, the ones a filter hides included: it answers the rail's count, which counts every thread, so it is offered while any thread is unread, visible or not — a filter narrows what is shown, never what is marked. This lifts the 2026-10-11 deferral above ("Time filters stay deferred — they want the bounded history paging to be complete first"): that paging was completed in the 0.3.5 review (UX-1), so time filters are no longer deferred and leave the deferred list below.
- **Amended 2026-10-13 (COM-03):** responder data now exists: who holds each project's responder slot per capability, its generation and lease (`board_responders_operator`, migration 87), and the outcome summaries. The screen does not show it yet — the responder indicator ("active", "stale — its lease lapsed, not failed", "absent"), "responder #n", "may have happened — awaiting reconciliation" for `outcome_unknown` and the outcome summary are SCR-81's next slice (wave 4, COM-07); listing or unlisting a project in the project directory is COM-06's operator control, whose database door already exists (`board_set_listing`).
- **Amended 2026-10-13 (wave 4, COM-07 and COM-06 — designed, NOT built; [ADR-0156](../adr/0156-the-estates-owner-may-pause-the-project-board-and-list-or-unlist-projects.md)):** until wave 4's nodes land, the steps and rules above are what the screen does, and nothing below is shipped. (1) **Step 1 becomes a bounded page, newest activity first.** The list reads 50 threads at a time, ordered by last activity (then id), with "Show older threads" / «Показать более старые треды» for the next page by the same keyset; no thread is shown twice or skipped while messages arrive between pages; the screen holds at most 200 threads and lets the oldest page go beyond that. (2) **A filter becomes a read.** The four filters above — participant project, kind held, open request, activity — are applied by the board, not by the screen, so they keep working on a board too large to hold. The 2026-10-11 rule "narrowing reads nothing new and never re-queries the board" is replaced by its purpose, kept whole: a filtered read the board did not answer says "Comms did not answer this filter. The list above is what was last confirmed." / «Переписка не ответила на этот фильтр. Выше — то, что было подтверждено последним.» — never "no match"; "no match" is said only when the board answered zero rows. The participant-project filter stays the entry point another screen may open Comms with. (3) **A fifth filter: the coding agent** ("Coding agent" / «Агент», "All agents" / «Все агенты» by default) — the agents that took part in a thread's requests. (4) **The rail's count** is read from each thread's last seq alone, capped at 5,000 threads; past the cap it says "threads with new messages: 5000+" / «тредов с новыми сообщениями: 5000+», never a smaller number. "Mark all read" uses the same read. (5) **What moves out of the deferred list below:** participant read marks, artifact links and the chain (timeline and related threads) are SCN-147; the responder indicator is SCN-147; pause controls are SCN-148; listing in the project directory is SCN-149; history search is SCN-156; what waits for a project is SCN-157; "virtualized history" is met by the bounded page in (1), with no new dependency. Once those land, the deferred list keeps only the Telegram mirror (COM-08) and a mirror-lag indicator, which has nothing to show until a mirror exists.
- **Amended 2026-10-13 (wave 4's reads — BUILT, nodes W4-1 to W4-6; the pauses, the directory and owner settlement are still only designed):** (1)–(4) of the amendment above are on screen. The list reads 50 threads a page, newest activity first, with "Show older threads"; the five filters — participant project, kind held, coding agent, open request, activity — are the board's reads, combining as AND, and the participant filter keeps its place as the entry point another screen may open Comms with; "no match" is said only from the board's answer, and a filtered read the board did not answer keeps the list last confirmed with "Comms did not answer this filter. The list above is what was last confirmed."; the rail's count reads the heads, "5000+" past the cap; "mark all read" marks every thread the heads name, the ones the page does not hold included. One choice the design left open: at 200 held threads the screen stops offering older pages and says "Showing the newest 200 threads. Narrow the filters to reach older ones." / «Показаны 200 самых новых тредов. Сузьте фильтры, чтобы добраться до более старых.» — dropping the oldest page as the operator asks for an older one would undo the click. A thread that gets a new message while the operator pages moves above the cursor: it leaves the older pages and is on the first page, which the screen reads again on its clock, so no thread is shown twice and none is lost. Participant read marks, artifact links, the responder line, outcomes, the timeline and related threads (SCN-147), search (SCN-156) and what waits for a project (SCN-157) are built with it.
- **Amended 2026-10-14 (release review UX-6, UX-7):** the "Coding agent" filter names each agent the way the rest of Fabric does — "Claude Code", never its id `claude-code` — and the id stays the value the board is asked for. An older page the board did not answer is said under the list, "Comms did not answer, so the older threads were not read. Try again." / «Переписка не ответила, более старые треды не прочитаны. Попробуйте ещё раз.», with the board's own words on a second line, and "Show older threads" stays, asking the same page again; it is never read as the list's end, and it is no longer said as a failed poll.
- **Deferred, said now rather than discovered later:** each has its home, and none is a promise of this screen. Participant read marks (a project seeing that another project read its message — the contract's, not the operator's), artifact links and virtualized history are the rest of COM-07 in [the comms plan](../evidence/plans/2026-10-04-project-communications.md). Pause/stop controls are COM-06's operator controls, which the operator approved for a later wave on 2026-10-12 (decision D9). The Telegram mirror is COM-08. A restored estate (CO-212) now brings its messages back with it — SCN-146, ADR-0149; one restored from an archive written before board history travelled shows none of their texts, and since 2026-10-13 says so instead of saying nothing was exchanged (SCN-146's alternative path).
- **Amended 2026-10-23 ([the walk of 2026-10-22/23](../evidence/plans/2026-10-15-fabric-simple/2026-10-23-operator-walk.md)):** Comms reads as a feed, newest first: each post shows the project, its kind (просьба, ответ, находка, объявление), a short summary and its thread, with a focus filter (one project, requests only, waiting for an answer) (OF-29). Built in 0.3.12 S7 (CO-401): «Ждут ответа» keeps the requests not yet settled or answered, and each post names its thread under it (`apps/desktop/src/renderer/src/launch/CommsFeed.tsx#waitsForAnswer`; test `CommsFeed.test.tsx`).
- **Shipped 2026-10-23 (0.3.11):** «Лента» is what Comms opens on, «Ветки» the second tab; it reads the newest 100 posts through the board's page, newest first, every 15 s while open, and says a board that did not answer with «Попробовать снова». Filters shipped: «Только просьбы» and a project; «waiting for an answer» and the thread named under each post were not built in 0.3.11 (both built in 0.3.12 S7, CO-401: the amendment above). Coverage: `apps/desktop/src/renderer/src/launch/CommsFeed.tsx`, `apps/desktop/src/renderer/src/launch/commsNewest.ts` and their tests.
- **Status:** draft
- **Coverage:** built in this change — `apps/desktop/src/renderer/src/launch/CommsScreen.tsx`, the `comms:threads` / `comms:list` IPC in `apps/desktop/src/main/index.ts` over `apps/desktop/src/main/commsOperatorRead.ts` and `apps/desktop/src/shared/commsRead.ts`, the bridge in `apps/desktop/src/preload/api.ts`, the channel grants in `apps/desktop/src/shared/ipcWindowPolicy.ts`, the route and navigation in `apps/desktop/src/shared/appRoute.ts` and `apps/desktop/src/renderer/src/launch/LaunchShell.tsx` (the unread slice's rail badge); the badge poll and the read-mark writes in `apps/desktop/src/renderer/src/App.tsx`; the operator-local read marks in `apps/desktop/src/shared/types.ts` (`AppSettings.commsReadThrough`) and their patch validation in `apps/desktop/src/shared/appSettings.ts`; Migration 83 (`supabase/migrations/20261011000094_project_board_operator_read.sql`, the operator's read path) and migration 85 (`supabase/migrations/20261011000100_project_board_thread_aggregates.sql`, the filter slice's `kinds`/`openRequests` aggregates); tests `apps/desktop/src/renderer/src/launch/CommsScreen.test.tsx`, `apps/desktop/src/shared/appSettings.test.ts` and `apps/desktop/test/comms-operator-read.test.mjs`; DB tests in `apps/desktop/test/project-board-db.test.mjs`; wave 4 (W4-1…W4-3): the bounded page, the board's filters and the heads in `supabase/migrations/20261013000108_project_board_operator_reads.sql` (`board_thread_page_operator`, `board_thread_heads_operator`), the `comms:thread-page` / `comms:heads` IPC over `commsOperatorRead.ts`, the list's rules in `apps/desktop/src/renderer/src/launch/commsList.ts` (tested in `commsList.test.ts`), the rail's count from the heads in `App.tsx` and `LaunchShell.tsx` ("5000+", `FabricStrip.test.tsx`); DB tests in `apps/desktop/test/project-board-operator-db.test.mjs`; 0.3.9: `apps/desktop/src/main/boardService.ts` (answered, unread, bulk read), `apps/desktop/src/renderer/src/launch/HomeBoardWaiting.tsx`, `apps/desktop/test/project-board-core-holds-db.test.mjs`; 2026-10-23 (OF-29): the feed `apps/desktop/src/renderer/src/launch/CommsFeed.tsx`, «Лента» first in `apps/desktop/src/renderer/src/launch/CommsScreen.tsx`, test `CommsFeed.test.tsx`
- **Product:** unobserved
- **Amended 2026-10-20 (0.3.7 review, UX-4):** Comms opens from Настройки → Ещё. The count of threads with new messages stands on the rail's Настройки item and on the «Переписка между проектами» button («Новые сообщения: N», «N+» when the board cut the heads); at zero, or while the board has not answered, there is no number.
- **Amended 2026-10-24 (0.3.12 release review, iteration 1, UX-17, ER-8, DO-20):** in Russian the screen says «ветка» throughout, never «тред»: the tab «Ветки», «Пока нет ни одной ветки», «Показать более старые ветки», «В ветке: {ветка}» under a post (`launch.comms.*` in `apps/desktop/src/renderer/src/i18n/ru.ts`). «Ждут ответа» that finds nothing says where it looked: «Среди {N} самых новых постов нет просьб, которые ждут ответа. Более ранние просьбы есть в ветках.» (`apps/desktop/src/renderer/src/launch/CommsFeed.tsx#CommsFeed`; test `CommsFeed.test.tsx`). The thread named under a post is built; its name shows when the screen holds that thread in «Ветки» (a post whose thread is not among the threads read shows no name).
- **Amended 2026-10-21 (0.3.9, [the core holds](../evidence/plans/2026-10-21-core-reliability/README.md#board)):** a reply from the asked project answers a request (state «получен ответ»); a request whose target has no live responder says so in its receipt, and one sent without a deadline expires after 7 days; the home shows the requests between projects no agent is answering now and how long the oldest has waited, with «Открыть переписку», and nothing when none wait; it shows no unread count (Comms keeps its own). «Waiting for a project» counts a request its target marked read but did not answer. An agent reads only what is new to it (`com.list` with `unread`) and marks up to 100 messages read in one call.

### SCN-146: A restored estate shows its project messages, and nothing in it acts

The operator restores an estate from an archive and finds the messages its projects exchanged where they were — and
finds that nothing the old estate was doing has started again
([ADR-0149](../adr/0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md) §6,
closing CO-212).

- **Persona:** P-01
- **Feature:** Project communications
- **Traces:** FLW-83, SCR-81; SCN-065 (restore an archive into a fresh estate), SCN-143; COM-02.3 in [the comms plan](../evidence/plans/2026-10-04-project-communications.md)
- **Entry point:** the restore of SCN-065 (SCR-48), then the restored estate's Comms (SCR-81)
- **Preconditions:** an archive taken by this version (it carries `board.json`) or by an earlier one (it does not)
- **Steps:**
  1. Operator restores the archive into a fresh estate (SCN-065) -> the journal comes back first; then the board's threads, messages, bodies and request outcomes come back from `board.json`, each message checked against the journal event at its place.
  2. Operator opens Comms in the restored estate -> the threads and messages read as they did, with the request states the journal recorded; a message whose text was removed before the archive was taken reads as removed.
  3. Nothing acts: no request is claimed, answered or expired because the estate came back, and nothing the archive carried is a permission — its idempotency receipts, outbox and cursors stay behind. Rotating every idempotency window on restore, so that a retry of a call made before the archive cannot land a second time, arrives with the responders' restore settle (COM-03, `board_settle_restored`); until then such a retry is stored again in the restored estate.
- **Expected result:** the restored estate shows what its projects told each other, and none of its old authority is live.
- **Alt paths:** the archive came from before messages travelled -> the estate restores, and the restore says the messages' texts are missing (`board_history: missing`), rather than showing an empty board as if nothing was said. The board file does not match its archive, or was changed after it was written -> the restore is refused before anything is written. A message the journal names and the file lacks is counted as missing, never invented.
- **UI elements:** none new: the restore result carries `board_history` (`restored`, `missing`, or the refusal's code); the History panel does not show it yet — that line arrives with COM-07's later slices.
- **States covered:** restored with texts; restored without texts (old archive); refused before any write (mismatch)
- **Errors & recovery:** a restore whose board step lost its reply is checked again by the same operation, and the database answers a second history as already restored, never as a duplicate.
- **Telemetry:** planned only.
- **Amended 2026-10-13 (COM-03 fix round, wave-2 product finding 17):** the alternative path is now on screen. When the restored board holds no thread but the estate's journal records messages between projects, Comms does not show its empty state ("Projects of this estate have not exchanged any messages yet."); it says "The texts did not come back" / «Тексты не вернулись», with how many messages the journal records and that their texts were not in the archive — nothing was lost from the journal itself. The count is read from the journal only when the board answers an empty list (`journalMessages`, `apps/desktop/src/main/commsOperatorRead.ts`); a count that cannot be read leaves the board's own empty answer. The History panel line for `board_history` is still COM-07's.
- **Amended 2026-10-13 (COM-03):** step 3's wait is over. A restored board settles by projection, appending nothing to the restored journal (ADR-0149 Amendment 1): a request that was claimed is queued again, one in progress becomes "may have happened" (`outcome_unknown`, settled only by an observed reconciliation), accepted work is held, no responder holds a slot (its generation is kept), and every project starts in a fresh idempotency window, so a retry of a call made before the archive is refused (`idempotency_window_expired`), never stored a second time. The directory's unlistings come back with the estate.
- **Status:** draft
- **Coverage:** `supabase/migrations/20261012000103_project_board_lifecycle.sql` (`board_history_export`, `restore_board_history`); `apps/desktop/src/main/backup.ts`, `apps/desktop/src/main/privateHistory.ts` and `apps/desktop/src/shared/archive.ts` (`board.json`); tests `apps/desktop/test/project-board-lifecycle-cases.mjs` (the round trip), `apps/desktop/test/backup-paging.test.mjs` and `apps/desktop/test/private-history-service.test.mjs`
- **Product:** unobserved

### SCN-144: A project's request is answered by whichever agent holds its responder slot, and a replaced agent cannot finish it

One project asks another for work; an agent the operator let answer that capability takes it, and if that agent goes
quiet another takes over — and the first one's late result is refused, never committed
([ADR-0149](../adr/0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md) §2–§5,
contract DEC-0073, the plan's acceptance P:106-107).

- **Persona:** P-01 (watching); the agents act
- **Feature:** Project communications
- **Traces:** FLW-84, SCR-81; SCN-145 (the grant), SCN-143 (where the operator watches); COM-03 in [the comms plan](../evidence/plans/2026-10-04-project-communications.md)
- **Entry point:** a session of the target project — launched by Fabric, enrolled (SCN-137) or a board session (`fabric.board.join`) — whose agent holds a responder grant (SCN-145)
- **Preconditions:** the requesting project sent a request (`com.submit`, kind request) naming the target project and a capability
- **Steps:**
  1. The responder takes the slot: `com.enroll` for the capability -> the slot's generation and lease (60 s of database time) come back; with no grant the answer is "ask the operator" (`not_authorized`) and nothing is written.
  2. It claims the oldest queued request (`com.claim`) -> the request, its digest and an attempt id; nothing queued answers "nothing to claim" and stores nothing, so it may ask again.
  3. It accepts (`com.accept`), may say the effect began (`com.effect_begin`), reports progress (`com.progress`, a note posted once per attempt), and completes with what it observed (`com.complete`); every call carries its fence — request, generation, attempt, digest, revision — and renews the lease.
  4. The responder goes quiet and its lease lapses -> another granted agent enrolls: generation + 1; the first agent's claimed requests return to queued, an effect that had begun becomes "may have happened" (`outcome_unknown`), accepted work is held; the new holder claims and continues.
  5. The first agent comes back with a late result -> refused `fenced` (or `lease_expired`), never committed; the request does not move.
  6. A request that "may have happened" is settled only by the slot's current holder with an observed result (`com.reconcile`).
- **Expected result:** every request is answered by exactly one current holder at a time, and no replaced agent's result is recorded.
- **Alt paths:** the session ends -> its slot is released and nothing moves; a claimed request stays claimed and the next claim takes it again; the next holder turns work in progress into "may have happened". The operator revokes the grant between accept and effect -> the next call is `authority_changed` and the request stays where it was. Another agent takes the slot on purpose (`com.responder_replace` at the generation it read) -> the same replacement, and accepted requests continue only by an explicit checkpoint transfer, posted on their threads. A request's deadline passes before it is accepted -> it expires; accepted work is held. A wrong digest, generation, attempt or revision -> its own refusal, nothing moved.
- **UI elements:** none new in this change: the operator sees the messages and request states in Comms (SCN-143); the responder indicator is SCR-81's next slice.
- **States covered:** granted and absent; active, stale, absent responder; claimed, accepted, in_progress, completed, failed_known, outcome_unknown; fenced, lease_expired, authority_changed, digest_conflict, revision_conflict, observation_required, reconcile_required
- **Errors & recovery:** a write whose answer was lost says it may have been stored, and the same idempotency key tells which; a renewal that fails leaves a lease that lapses in 60 s and a holder that is replaced, never a request stuck forever.
- **Amended 2026-10-13 (wave 4 — designed, NOT built; contract DEC-0079 and DEC-0081, [ADR-0156](../adr/0156-the-estates-owner-may-pause-the-project-board-and-list-or-unlist-projects.md)):** two alternative paths, served once Fabric repins to fabric-agent-contract `a59d04b` or later. (1) **The operator paused it (SCN-148).** When the owner has paused the request's thread, its target project's answering or its (project, capability) slot, the calls that take NEW work on it are refused `held` — `com.enroll` and `com.responder_replace` on a paused slot or a slot of a paused project, `com.claim` of paused work, `com.accept` and `com.effect_begin` on it — with "The operator paused this in Fabric; it takes nothing new until the operator resumes it." The refusal is retryable, stores nothing, and the same call with the same key commits once the operator resumes. An agent whose kit is pinned before DEC-0079 is told `not_authorized` with the same sentence instead. A claim that names no request passes over requests in paused threads and answers "nothing to claim" when only those are left. A pause never refuses `com.complete`, `com.reconcile`, `com.progress`, `com.renew`, the responder's fenced `com.reply`, a cancel or any read, so the current holder always settles what it started; if its session ends under a slot or project pause, the next enroll waits for the resume and its accepted work stays held. Requests sent while the target is paused are not refused: they queue, and their deadlines run. (2) **Nobody holds the slot, so the owner settles (SCN-147).** Step 6's "only the slot's current holder" widens: while NO responder holds the request's slot, the estate's owner may settle an `outcome_unknown` request with an observed result and a summary of what they observed (`com.reconcile` from the owner, `settledBy: "owner"`). A responder that enrolls afterwards finds the request settled, and its late `com.complete` or `com.reconcile` is refused (`invalid_transition`, or `fenced` / `revision_conflict`), never committed.
- **Telemetry:** planned only.
- **Amended 2026-10-13 (COM-03 fix round, migration 88; ADR-0149 Amendment 2, contract DEC-0078):** a takeover's answer names each request it transferred, once, with its revision and the attempt the new holder continues under, so the new holder fences on it straight away; claiming an accepted request is refused and moves nothing (the earlier read-back through `com.claim` is gone). The holder that calls on a request whose outcome became "may have happened" is told to reconcile it (`reconcile_required`), not that it was fenced. Unread counts only messages an agent can read.
- **Status:** draft
- **Coverage:** `supabase/migrations/20261012000104_project_board_responders.sql`; `apps/desktop/src/main/boardService.ts`, `apps/desktop/src/main/boardTools.ts`, `apps/desktop/src/main/agentSurface.ts` (region `board-caller`, `board-release-session`); tests `apps/desktop/test/project-board-responders-db.test.mjs`, `apps/desktop/test/board-service.test.mjs`, `apps/desktop/test/board-surface.test.mjs`
- **Product:** unobserved

### SCN-145: The operator lets an agent answer a project's requests

An agent asks to answer one project's requests for named capabilities, and the operator decides, knowing exactly what
that lets it do ([ADR-0149](../adr/0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md) §2–§4,
[ADR-0134](../adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md) Amendment 7).

- **Persona:** P-01
- **Feature:** Hub
- **Traces:** ST-045, FLW-85, SCR-76; SCN-132 (the ask's flow), SCN-144 (what the grant is used for)
- **Entry point:** a coding agent of the runner catalogue, or a registered agent (a product's service), calls `fabric.access.request` with callee `fabric`, capability `board.respond` and 1 to 8 resources `board:<project id>/<capability>` of one project, with its reason
- **Preconditions:** Fabric is running and its hub is listening; the project exists in this estate
- **Steps:**
  1. Fabric checks the ask before showing anything: the asker must be a coding agent Fabric knows or a registered agent; the project must exist; one ask names one project and no folder -> anything else is refused and nothing is shown.
  2. The prompt opens (or the request waits in the queue and Settings → Agent access), in the operator's language: "Let <agent> answer <capabilities> requests for <project>?", "It may take and answer the requests other projects send to <project> for these capabilities. It cannot spend, publish or delete through this.", the agent's reason quoted as its claim, the same-user floor and "for a year, unless you revoke it". Deny is the default.
  3. Allow -> the grant is listed under the agent in Agent access as "answer <capabilities> requests for <project>", with its expiry and Revoke.
  4. The agent uses it: an enrolled coding agent answers in its own session, a session Fabric launched answers under its runner's grant, and a service joins with `fabric.board.join {projectId}` and gets a board session with the board's tools only.
  5. The operator revokes it -> the agent's slots for those capabilities are released, its next responder call is `authority_changed`, and a board session that held it ends.
- **Expected result:** only agents the operator named answer a project's requests, only for the capabilities named, and the operator can take it back at any time.
- **Alt paths:** Deny -> denied until the operator clears the denial (SCN-132). A launched session whose runner holds no grant on a binding cannot respond until the runner asks — a known limit, closed once `fabric-mcp` is registered for that coding agent. A service that only serves and runs no client loop cannot respond yet: Fabric driving a service's capability is decided later (ADR-0149 §4).
- **UI elements:** the prompt; the queue row ("<agent> asks to answer requests for <project>"); SCR-76's waiting card and grant line, worded as above.
- **States covered:** asked, refused before a prompt, waiting, allowed, denied, revoked
- **Errors & recovery:** the prompt cannot be shown -> the request waits in the queue and Settings, as for any ask (SCN-132).
- **Telemetry:** planned only.
- **Amended 2026-10-13 (COM-03 fix round; ADR-0149 Amendment 2):** (1) **A board session is respond-only.** Step 4's board session gets what the grant promises and nothing more: `com.status`, `com.list` / `com.get` (the threads its project takes part in, to read the requests), `com.reply` in the responder's fenced form only, and `com.enroll`, `com.claim`, `com.renew`, `com.accept`, `com.progress`, `com.effect_begin`, `com.complete`, `com.reconcile`, `com.responder_replace`. It never sends as the project (`com.submit`), cancels its requests (`com.cancel`), marks messages read (`com.read_ack` — the project's read marks are shared with its coding agents) or reads the directory (`com.directory`). (2) **The detail line keeps the contract's caveat:** step 2's second sentence now reads "It may take and answer the requests other projects send to <project> for these capabilities. This grant itself lets it spend, publish or delete nothing; it still has its own tools, and a request is never an approval." — in Russian «Он сможет брать и выполнять запросы, которые другие проекты присылают проекту «<project>» по этим возможностям. Само это разрешение не даёт ему ни тратить деньги, ни публиковать, ни удалять; свои инструменты у него остаются, а запрос никогда не одобрение.» (3) **Russian grammar:** where requests are sent TO, the project takes its own dative form («присылают проекту «<project>»» / «присылают этому проекту»), not the enrollment's locative («в проекте …»). (4) A board session also ends when its client leaves, when any of its grants expires (at its next call), and is capped per binding apart from the agent's coding sessions; step 5 is unchanged.
- **Amended 2026-10-13 (wave 4 — designed, NOT built; [ADR-0156](../adr/0156-the-estates-owner-may-pause-the-project-board-and-list-or-unlist-projects.md), contract DEC-0079):** a pause is not a revocation. When the owner pauses the project's answering or one of its (project, capability) slots (SCN-148), the agent's grant stands: it can still be asked for and allowed, it is still listed in Agents & access, and its next `com.enroll` or `com.claim` is refused `held` until the operator resumes, then goes through under the same grant. To stop an agent answering for good the operator revokes it here (step 5); Comms' pause sheet links to this screen for exactly that ("Open Agents & access" / «Открыть «Агенты и доступ»»), and after a revocation the request's responder reads "absent — the last one's permission was revoked" (SCN-147).
- **Status:** draft
- **Coverage:** `apps/desktop/src/shared/access.ts` (region `board-respond-ask`), `apps/desktop/src/main/accessService.ts` (region `board-respond-request`), `apps/desktop/src/shared/accessWords.ts` (region `board-respond-words`), `apps/desktop/src/main/hubTools.ts` (region `hub-board-join`), `apps/desktop/src/main/index.ts` (region `board-join-wiring`); tests `apps/desktop/src/shared/accessWords.test.ts`, `apps/desktop/test/session-enroll-request.test.mjs`, `apps/desktop/test/board-surface.test.mjs`
- **Product:** unobserved

## Project communications, wave 4 · 2026-10-13 (COM-05, COM-06, COM-07 — designed, not built)

The scenarios of this section are the design wave 4 builds against
([ADR-0156](../adr/0156-the-estates-owner-may-pause-the-project-board-and-list-or-unlist-projects.md); contract
DEC-0079, DEC-0080 and DEC-0081 at fabric-agent-contract `a59d04b`). None of it is on screen yet: each scenario's
Coverage says "none yet" until its node lands, and SCN-143 describes what Comms does today. Comms is the screen's
name in every string («Переписка» in Russian), and "board" / «доска» never appears in them.

### SCN-147: See who answers each request and how it ended, and settle one nobody can

The operator opens a request in Comms and learns, without asking anyone, which agent answers it now, what the
answer was and on whose word — and, as the estate's owner, settles a request whose outcome nobody else can settle
(contract DEC-0081).

- **Persona:** P-01
- **Feature:** Project communications
- **Traces:** FLW-83, SCR-81; SCN-143 (the screen), SCN-144 (who answers), SCN-148 (paused); COM-07 in [the comms plan](../evidence/plans/2026-10-04-project-communications.md)
- **Entry point:** a thread in Comms (SCR-81) that holds a request
- **Preconditions:** the request's target project has, or had, a responder slot for the request's capability
- **Steps:**
  1. Operator opens a thread with a request -> under the request, "Answers it" / «Отвечает» names the target project's current responder for that capability: "Responder #n · <agent> · since <time>" when it is active; "Responder #n · its lease lapsed <time>. That says nothing about whether it worked." when it is stale; "No agent answers <capability> requests for <project> now." when it is absent, with why the last one left and when (its session ended, its permission was revoked, it was replaced, or the estate was restored); "Paused by you. It takes nothing new until you resume it." when the slot or its project is paused (SCN-148). Until the responders are read it says "Checking who answers…", never "absent".
  2. A finished request shows how it ended under it: "What the responder reported" with the outcome summary and its evidence; for a cancelled one, "Why the requester cancelled" with the requester's reason; "No summary was given." only when the facts were read and hold none. A request the owner settled is marked "Settled by the owner", its summary labelled "What the owner observed".
  3. A request in `outcome_unknown` reads "may have happened — awaiting reconciliation" / «может быть, выполнено — ждёт сверки» — never a word that says it succeeded — and says who can settle it: "Only the agent answering <capability> can settle it, with what it observed." while a responder holds the slot; when none does, the owner reads "No agent answers <capability> now. You can settle it with what you observed." and a member reads that the estate's owner can.
  4. Each message lists the participant projects that marked it read — "Marked read by <projects>" — never the sender, and nothing when none has.
  5. Each artifact of a message shows its label (or its id), the short `sha256:` hash with Copy, and "as the sender stated it; Fabric did not check the file". An `https:` link opens in the browser through the app; any other scheme is shown as text that does not open ("Only https links open from here.").
  6. The owner presses "Settle with a summary" on an `outcome_unknown` request whose slot no responder holds -> a sheet asks what they observed: "It was done" (completed) or "It failed" (failed_known), and "What you observed" (1–2000 characters, required); it says that every project in the thread will see that the owner settled it, and that a request nobody observed stays open — it cannot be closed as cancelled. Settle -> the request is completed or failed_known, observed, `settledBy: "owner"`, and "Settled. Every project in the thread sees your summary."
  7. Operator expands "What happened to this request" -> each step from the journal, oldest first: when, from → to, the cause and responder #n; and "Related threads" -> threads between the same projects, or carrying the same file (by hash), each with why it is related.
- **Expected result:** for every request on screen the operator knows who answers it now, how it ended and on whose word; and a request whose responder is gone does not stay unsettled once its owner has observed what happened.
- **Alt paths:** the responders cannot be read -> "Who answers is not known right now." — never "absent". The outcome cannot be read -> "The outcome could not be read." — never "No summary was given.". A responder holds the slot -> no Settle action; the request waits for that responder. A member who is not the estate's owner -> no Settle action. Between showing Settle and confirming it, an agent took the slot -> refused; the sheet says the agent answering it settles it now, and nothing changed. The summary is empty -> refused before it is sent; the board would refuse it too (`observation_required`), and the request stays as it was. Someone settled it first -> "This request was settled before you. Read it again to see how." (`invalid_transition`), and the thread is read again. The answer was lost -> "This may have been saved. Read again to see.", and the request is read again. A request still `in_progress` whose responder left with no successor is not `outcome_unknown`, so the owner cannot settle it; it reaches the owner when its sender cancels it (DEC-0081 item 3). The board does not serve owner settlement yet (Fabric not repinned to DEC-0081) -> the action is not shown at all.
- **UI elements:** the responder line per request; the outcome block (summary, cancel reason, evidence, "Settled by the owner"); the `outcome_unknown` line with who can settle it; "Settle with a summary" — the owner's conditional primary action — and its sheet; "Marked read by"; artifact rows with Copy; the collapsed timeline and related-threads disclosures. No control promises to stop an effect an agent already started.
- **States covered:** responder checking, active, stale, absent (with its cause), paused, unknown; outcome summary, cancel reason, none given, unavailable, settled by the owner; `outcome_unknown` with a holder, with none; settle offered, hidden, confirm, busy, settled, refused-responder-back, summary-required, already-settled, may-have-saved; read by, none; artifact link, text, copied; timeline and related loading, read, empty, unavailable
- **Errors & recovery:** each read fails on its own and says so where its answer would be; what was read stays on screen. The settle sheet never resends by itself: a lost answer is resolved by reading the request again, and the same idempotency key makes a second press the same settlement.
- **Telemetry:** planned only.
- **Status:** draft
- **Amended 2026-10-13 (W4-4, W4-5 — BUILT; the settle action W4-13 is not):** steps 1–5 and 7 are on screen. Until owner settlement is served (W4-13), step 3's request whose slot no responder holds reads, for the owner and a member alike, "No agent answers <capability> now, so nothing settles it until one does." / «Сейчас на <capability> никто не отвечает, поэтому закрыть его некому, пока такой агент не появится.» — no screen offers the owner a settlement it does not serve, and step 6 shows nothing. "Responder #n · <agent> · since <time>" gives the time it took the slot, in the operator's locale; the lapsed lease, the last holder's leaving and the pending panel's oldest message say how long ago. A request whose slot was never held reads absent with no cause. An artifact's Copy says "Copied." / «Скопировано.»; a link the browser did not take says "The link did not open in the browser." / «Ссылка не открылась в браузере.». The timeline says each step's cause in words ("by the responder", "by the requester", "the deadline passed", "the responder was replaced", "handed to the new responder"), "Nothing has happened to it yet." for a request with no step, and "Only the first 200 steps are shown." past its bound; related threads say "No related threads." when there are none.
- **Amended 2026-10-14 (release review UX-6, UX-7):** step 1's `<agent>` is the coding agent's name — "Responder #2 · Claude Code · since …", never the runner id `claude-code`. Step 5's Copy that the clipboard refuses says "Could not copy." / «Не удалось скопировать.» where "Copied." would have been, never nothing.
- **Coverage:** steps 1–5 and 7 built (W4-1, W4-4, W4-5) — the reads `board_responders_operator` (replaced), `board_message_facts_operator`, `board_request_timeline_operator`, `board_related_threads_operator` in `supabase/migrations/20261013000108_project_board_operator_reads.sql`; `apps/desktop/src/main/commsOperatorRead.ts` (`responders`, `facts`, `timeline`, `related`, `openArtifact` — https only); `apps/desktop/src/renderer/src/launch/CommsParts.tsx` (`ResponderLine`, `UnknownLine`, `OutcomeBlock`, `ReadBy`, `ArtifactList`, `Timeline`, `RelatedThreads`) and `CommsScreen.tsx`; tests `apps/desktop/test/project-board-operator-db.test.mjs`, `apps/desktop/test/comms-operator-read.test.mjs`, `apps/desktop/src/renderer/src/launch/CommsScreen.test.tsx`. Step 6, the settle action, is W4-13, after the repin to fabric-agent-contract `43bef18` or later (DEC-0081); the pin is `a59d04b` since W4-1, and Fabric does not serve owner settlement yet
- **Amended 2026-10-14 (0.3.6 release review DO-8):** the repin this waited on has landed: Fabric's contract tests are pinned at fabric-agent-contract `a59d04b` (`apps/desktop/test/contract-consumer-fixtures.mjs#CURRENT_COMMIT`), which carries DEC-0079, DEC-0080 and DEC-0081. Step 6, the owner's settlement, now waits only on building W4-13, named with DEC-0081 in the `OWED` list of `apps/desktop/test/board-service.test.mjs`; until then the board refuses it on purpose.
- **Amended 2026-10-21 (0.3.9, [the core holds](../evidence/plans/2026-10-21-core-reliability/README.md#board)):** a request answered by a reply shows «получен ответ» / "answered", and its timeline names the cause in words («ответом проекта, которого спросили»).
- **Product:** unobserved

### SCN-148: The owner pauses and resumes a thread, a project's answering or one responder slot

The operator stops new work in one place without losing what agents report about work already under way, and
starts it again — or, to stop an agent for good, revokes it ([ADR-0156](../adr/0156-the-estates-owner-may-pause-the-project-board-and-list-or-unlist-projects.md)
§1–§4, contract DEC-0079, operator decision D9).

- **Persona:** P-01
- **Feature:** Project communications
- **Traces:** FLW-91, SCR-81, SCR-82, SCR-76; SCN-144 (what a pause refuses), SCN-145 (the grant a pause does not revoke); COM-06 in [the comms plan](../evidence/plans/2026-10-04-project-communications.md)
- **Entry point:** Comms (SCR-81): an open thread, a request's responder line, or a participant project's name
- **Preconditions:** the person is the estate's owner (in a single-person install, the local operator is)
- **Steps:**
  1. Owner chooses what to pause -> "Pause this thread" on an open thread; "Pause <capability> for <project>" on a request's responder line; "Pause answering for <project>" on a participant project.
  2. The pause sheet opens (SCR-82) -> what stops, for that scope; what keeps going — "what agents report about work already taken, cancels, and deadlines, which still run"; and "A pause cannot stop work an agent already started with its own tools. To stop an agent answering, revoke its permission in Agents & access." with "Open Agents & access". Pause, or Esc to close.
  3. Pause -> "Paused." is announced; the thread or the responder line shows the chip "Paused" / «На паузе». From then on agents' calls that take new work in that scope are refused `held` (SCN-144's alternative path) with "The operator paused this in Fabric; it takes nothing new until the operator resumes it."; calls that settle or report on started work, cancels and reads go on.
  4. Owner presses Resume -> "Resumed." is announced and the chip is gone; an agent's refused call, sent again with the same key, now goes through.
  5. To stop an agent answering rather than pause it -> "Open Agents & access" -> Revoke (SCN-145 step 5) -> its slots are released, and the request's responder reads absent, "The last one's permission was revoked".
- **Expected result:** the owner stops new work in exactly the scope chosen, sees that it is stopped, and starts it again; nothing an agent reports about work already taken is refused, and no screen claims a pause stopped an effect already running.
- **Alt paths:** It was already in that state -> "It was already in that state. Nothing changed." (nothing is recorded). A member who is not the owner -> no pause or resume control; one line, "Only the estate's owner can pause or resume.". The owner's access changed since the window opened -> "Your access changed since this window opened. Reopen it and try again." (`authority_changed`); nothing changed. The thread or project is no longer in this estate -> said as not found. The answer was lost -> "This may have been saved. Read again to see.", and the screen reads the pauses again and shows what they say. A request sent to a paused project or slot is not refused: it waits, and its deadline runs. The responder's session ends under a slot or project pause -> its accepted work stays held and nobody new takes the slot until the resume. A restored estate keeps its pauses, as it keeps its listings.
- **UI elements:** the pause and resume controls (owner only); SCR-82's sheet; the "Paused" chip on a thread and on a responder line; the link to Agents & access; a `role="status"` announcement for each change.
- **States covered:** owner, member; sheet confirm, busy, paused, resumed, already, refused-not-owner, refused-authority-moved, not-found, may-have-saved
- **Errors & recovery:** a pause or resume never retries by itself; a lost answer is settled by reading the pauses again. Nothing on screen says "paused" until a read or a receipt says so.
- **Telemetry:** planned only; the journal event `comms.hold_set@1` is the record.
- **Status:** draft
- **Coverage:** none yet — designed for wave 4 (the SQL doors W4-7, the controls path W4-8, the controls and SCR-82 W4-9; the `held` refusal code after the repin to fabric-agent-contract `d194dd9` or later, DEC-0079 — until then agents are told `not_authorized`)
- **Amended 2026-10-14 (0.3.6 release review DO-8):** the repin the `held` code waited on has landed: Fabric's contract tests are pinned at fabric-agent-contract `a59d04b` (`apps/desktop/test/contract-consumer-fixtures.mjs#CURRENT_COMMIT`), which carries DEC-0079. The `held` refusal now waits only on building W4-7, named with DEC-0079 in the `OWED` list of `apps/desktop/test/board-service.test.mjs`; until then agents are told `not_authorized`.
- **Product:** unobserved

### SCN-149: The owner lists or unlists a project for other projects, after seeing what they would see

Whether other projects find a project in the directory is the owner's choice, made with the exact entry other
projects read in front of them ([ADR-0156](../adr/0156-the-estates-owner-may-pause-the-project-board-and-list-or-unlist-projects.md)
§5–§6, [ADR-0149](../adr/0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md)
Amendment 1 §4, contract DEC-0073 §8).

- **Persona:** P-01
- **Feature:** Project communications
- **Traces:** FLW-92, SCR-83, SCR-52, SCR-76; COM-06 in [the comms plan](../evidence/plans/2026-10-04-project-communications.md); closes CO-286 when built
- **Entry point:** Settings → "Project directory" (SCR-83), also linked from Agents & access (SCR-76)
- **Preconditions:** the estate holds at least one active project
- **Steps:**
  1. Owner opens the project directory -> the estate's active projects, each with "Listed for other projects" / «Виден другим проектам» and its current state, under the line "Which projects other projects can find. Unlisting hides a project from the list only: a project that knows its id still reaches it."
  2. Owner opens "What other projects see" for a project -> exactly the entry the directory gives other projects: its name, and each capability with its responder state (and "paused" when it is); nothing else — no content, no counts. A project no agent may answer for reads "No capabilities: no agent may answer requests for it yet.".
  3. Owner switches it -> "Saving…", then the switch shows what the directory now says, announced; other projects' next directory read lists or omits it.
- **Expected result:** the owner changes who can find a project knowing exactly what is disclosed, and the switch on screen is what the directory says.
- **Alt paths:** the switch is turned before the preview was opened -> the preview opens first; the change waits for it. A member -> the switches are shown read-only with "Only the estate's owner can change this.". The directory cannot be read -> "The directory did not answer." — never an empty list, and no switch is offered. It was already in that state -> nothing is recorded and nothing changes. The owner's access changed -> refused, reopen and try again. The answer was lost -> "This may have been saved. Read again to see.", and the directory is read again. A restored estate keeps its listings (SCN-146).
- **UI elements:** the project list with one switch each; the "What other projects see" preview; the lede; the member line; a `role="status"` announcement.
- **States covered:** loading, read, unavailable, preview, saving, saved, already, refused-not-owner, refused-authority-moved, may-have-saved, member
- **Errors & recovery:** a save never retries by itself; a lost answer is settled by reading the directory again.
- **Telemetry:** planned only; the journal event `comms.directory_listing_set@1` is the record.
- **Status:** draft
- **Coverage:** none yet — designed for wave 4 (the owner check and target-state listing W4-7, SCR-83 W4-10); the database door `board_set_listing` exists, with no Settings control
- **Product:** unobserved

### SCN-156: Search what projects have told each other

The operator finds an old message by its words instead of scrolling every thread (COM-06's historical search).

- **Persona:** P-01
- **Feature:** Project communications
- **Traces:** FLW-83, SCR-81; SCN-143; COM-06 in [the comms plan](../evidence/plans/2026-10-04-project-communications.md)
- **Entry point:** "Search messages" / «Поиск по сообщениям» above Comms' thread list (SCR-81)
- **Preconditions:** projects have exchanged messages
- **Steps:**
  1. Operator types at least two characters (at most 200) and searches -> the newest matching messages first, up to 50: each with its thread, sender project, time and a snippet of up to 200 characters around the words.
  2. Operator asks for more -> the next older results by the same order.
  3. Operator opens a result -> its thread opens at that message, with the messages around it read the way Earlier reads them.
- **Expected result:** a message the board holds is found by its words, and opening it shows it in its thread.
- **Alt paths:** nothing matches -> "No message contains these words." — said only when the search was answered. The search took too long and stopped -> "The search stopped early. Use more specific words.", with what it found before stopping. Comms did not answer -> "Comms did not answer the search." — never "no match". A message whose body was removed is never matched; its words are gone. `%` and `_` in the words are searched as themselves.
- **UI elements:** the search field; the results list; "more"; the link from a result into its thread.
- **States covered:** idle, searching, results, none, stopped early, unavailable
- **Errors & recovery:** a failed search keeps the thread list as it was; searching again is the retry.
- **Telemetry:** planned only.
- **Status:** draft
- **Amended 2026-10-13 (W4-1, W4-5 — BUILT):** fewer than two characters is not searched and says "Type at least two characters." / «Введите хотя бы два символа.»; "More results" / «Ещё результаты» reads the next older page; "Clear the search" / «Сбросить поиск» returns to the list. The time budget is the board's own clock check (2 s), not a statement timeout.
- **Amended 2026-10-14 (release review UX-7, ER-8):** step 2's page of more results that Comms did not answer keeps what was found and keeps "More results", says "Comms did not answer, so there may be more results. Try again." / «Переписка не ответила, результатов может быть больше. Попробуйте ещё раз.», and pressing it asks the same page again — never read as the end of the results, by the same rule as "No message contains these words". A search Comms did not answer shows the board's own words on a second line, under the sentence.
- **Coverage:** built — `board_search_operator` in `supabase/migrations/20261013000108_project_board_operator_reads.sql`; `search` in `apps/desktop/src/main/commsOperatorRead.ts`; `SearchPanel` in `apps/desktop/src/renderer/src/launch/CommsParts.tsx`; tests `apps/desktop/test/project-board-operator-db.test.mjs` (escaping, redaction, the estate, paging, the planted zero budget), `comms-operator-read.test.mjs`, `CommsScreen.test.tsx` ("history search (SCN-156)")
- **Product:** unobserved

### SCN-157: See what waits for a project

A project whose agents are away leaves visible what is waiting for it, so nothing sent to it sinks unseen (COM-05:
"an unavailable owner leaves a visible pending item").

- **Persona:** P-01
- **Feature:** Project communications
- **Traces:** FLW-83, SCR-81; SCN-143, SCN-147; COM-05 in [the comms plan](../evidence/plans/2026-10-04-project-communications.md)
- **Entry point:** Comms (SCR-81): the "Waiting for a project" / «Ждут проект» panel above the thread list
- **Preconditions:** messages were delivered to a project and none of its agents has marked them read
- **Steps:**
  1. Operator opens Comms -> for each project something waits for: "<project>: unread <n>, the oldest <age>; findings <n>, requests <n>", and, when some of those requests have no agent answering, "<n> of them have no agent answering them". Projects are listed by their oldest waiting message, at most 100.
  2. Operator opens a project's row -> the thread list narrows to that project (the participant filter of SCN-143).
- **Expected result:** the operator sees which projects have messages nobody there has read, how old the oldest is, and which requests nobody can answer.
- **Alt paths:** nothing waits -> the panel is collapsed and says so. The read fails -> the panel says it could not be read; the thread list is unaffected. Only messages the board holds are counted, so a restore whose texts did not come back (SCN-146) adds nothing here. A finding's structured members (severity, what it affects, contract DEC-0080) are shown once Fabric repins to it (wave 4, W4-12); until then a finding is a message of kind finding.
- **UI elements:** the collapsible panel; one row per project; the link into the filtered list.
- **States covered:** none, list, unavailable
- **Errors & recovery:** the panel is read again with the thread list's poll; a failure leaves the last confirmed rows with when they were confirmed.
- **Telemetry:** planned only.
- **Status:** draft
- **Amended 2026-10-13 (W4-1, W4-6 — BUILT):** nothing waiting reads "Nothing waits for a project." / «Ничего не ждёт.»; a failed read "What waits could not be read." / «Что ждёт, прочитать не удалось.». The panel is read on the thread list's clock; a failure after a read keeps its rows with when they were confirmed.
- **Amended 2026-10-14 (release review ER-9):** the board answers at most 100 projects and says when it holds more; then the panel says "More projects are waiting than shown: these are the first 100." / «Проектов ждёт больше, чем показано: здесь первые 100.», so the list is never read as the whole.
- **Amended 2026-10-21 (0.3.9, [the core holds](../evidence/plans/2026-10-21-core-reliability/README.md#board)):** a project listed only for a request it read and nobody answered says «nothing unread», its age is the longest wait, and the requests no agent answers are their own count, never «of them».
- **Coverage:** built — `board_pending_operator` in `supabase/migrations/20261013000108_project_board_operator_reads.sql`; `pending` in `apps/desktop/src/main/commsOperatorRead.ts`; `PendingPanel` in `apps/desktop/src/renderer/src/launch/CommsParts.tsx`; tests `apps/desktop/test/project-board-operator-db.test.mjs` ("pending: …"), `comms-operator-read.test.mjs`, `CommsScreen.test.tsx` ("what waits for a project (SCN-157)")
- **Product:** unobserved

### SCN-158: See on the home who is doing what, in plain words
- **Persona:** P-01
- **Feature:** Home
- **Traces:** ST-037, ST-033, FLW-21, SCR-30 (JTBD-02)
- **Entry point:** the estate home
- **Preconditions:** at least one project exists; agents may or may not be working
- **Steps:**
  1. Operator opens the home -> at the top, beside Fabric's identity and the 28-day rhythm, four counts: agents working now, tasks in work, what needs the operator, what waits for review. Each opens where it is counted (the agents, the board).
  2. Operator reads the board -> beside «Нужно вам» (SCN-055), «Кто что делает»: «В работе» — each claimed task, and each task in work that Fabric launched itself, as a plain summary (its brief's «what», else its title), with its project, agent, how long, and the agent's current stage (by its session, else by the stage that names the task); «На проверке» — the tasks in review across projects. A task waiting in «Нужно вам» is named the same plain way, never by its instruction.
  3. Operator reads «Агенты в работе» -> every working session: the agent, its project, what it says it is doing now (its latest stage, with step N of M), else «Работает над: <задача>», else «Ещё не сказал, что делает»; a session that has gone silent is marked «молчит» and sorted after the working ones.
  4. Operator clicks an agent -> its console opens when Fabric holds one; otherwise its project opens. «Все агенты» opens the agents screen.
  5. Operator scans "My projects" -> SCN-043: favourites, then by latest activity, each with «Сейчас: …» or «Тихо уже …».
- **Expected result:** in a few seconds the operator knows what is being done across every project and where they are needed, without opening a transcript.
- **Alt paths:** no agent is working -> «Сейчас ни один агент не работает.» from a READ list; no task in work or in review -> each lane says so.
- **UI elements:** the counts strip (`HomeStats`), the «Кто что делает» panel (`HomeWorkLanes`), «Агенты в работе» (`HomeAgents`) on SCR-30; the project card's «now» line.
- **States covered:** loading («Читаю…»), empty (nobody working, nothing in work or review), error (the reading failed — said, never shown as nobody working), success, stale agent
- **Errors & recovery:** a failed reading says «Неизвестно, кто работает: работу не удалось прочитать.», with the machine's reason on its own line beneath, and keeps the last reading on screen; the next event or the 15-second tick reads again. A console that will not open says why and leaves the home as it was.
- **Telemetry:** planned only.
- **Status:** draft
- **Amended 2026-10-14 (release review UX-5):** a reading that fails is our sentence in the operator's language — «Неизвестно, кто работает: работу не удалось прочитать.», «Не удалось открыть консоль.», «Доску не удалось прочитать.», «Порядок не сохранён.» — and the machine's own words stand on a second line beneath it, never inside the sentence.
- **Amended 2026-10-15 (release review i2 UX-6):** a live task in «В работе» whose agent has reported no stage says «Ещё не сказал, что делает», as «Агенты в работе» does — never a blank line.
- **Amended 2026-10-15 (release review i2 DO-3, states from iteration 1):** a claim whose agent no longer signs for it stays in «В работе» with the pill «никто не отмечается» instead of a stage; the strip's «задач в работе» counts the same set as the lane's heading, so the screen shows one number; a capped reading is a floor — «50+» when 50 tasks wait for review, «200+» past 200 in work; each lane shows six rows and «Ещё N» opens the Board; after a failed reading the counts show «—», never the last numbers as current.
- **Amended 2026-10-17 (0.3.7 wave 1, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** the 0.3.7 target replaces this home with Главная (SCN-163): the numbers, «Ждёт вас» and «Сейчас» in plain words; the jargon pills («молчит», «никто не отмечается», «шаг N из M») become «давно не отзывался — {время}». This scenario stays the description of the home built today until wave 4.
- **Coverage:** `apps/desktop/src/shared/homeLive.ts`, `apps/desktop/src/main/workRead.ts#readHome`, `apps/desktop/src/renderer/src/launch/HomeWork.tsx`, `apps/desktop/src/renderer/src/EstateHome.tsx`; tests `apps/desktop/src/shared/homeLive.test.ts`, `apps/desktop/src/renderer/src/launch/HomeWork.test.tsx`, `apps/desktop/test/work-claims-db.test.mjs`; the real app on a disposable stack: `apps/desktop/test/operator-home-native.mjs` (home, project, settings — 2026-10-14 PASS)
- **Product:** unobserved

### SCN-159: Open a project and see where it came from, where it is and where it goes
- **Persona:** P-01
- **Feature:** Projects
- **Traces:** ST-032, ST-037, FLW-21, SCR-31 (JTBD-02)
- **Entry point:** a project card on the home, a project in the navigation
- **Preconditions:** the project exists; it may have no tasks yet
- **Steps:**
  1. Operator opens the project -> the heading carries its name, its purpose and, when an agent is working, «Сейчас: <what the agent says it is doing>».
  2. Operator reads «Откуда пришли и куда идём» -> three columns: «Сделано недавно» (the newest finished tasks), «Сейчас» (in work, then in review, each with its agent's current stage), «Дальше» (the goal, then the queue in its board order). Every task is its plain summary (its brief's «what», else its title; never its instruction, which is the prompt — a task with neither says «Задача без описания»); a click opens the task.
  3. Operator reads «Вопросы ко мне» -> what on this project waits for the operator, first the most important; «Разобрать вопрос» opens the first on the Board.
  4. Operator glances at «Доска» -> the four columns (backlog, in work, to review, done) with their counts and first cards; «Вся доска» goes to the full board below, «+ Задача» writes a new one.
  5. Operator reads «Агенты на проекте» -> this project's working agents in their own words; a click opens the console Fabric holds.
- **Expected result:** a project left for days is understood in one screen — what was done, what is being done, what comes next, and whether the operator is needed.
- **Alt paths:** a project with no tasks shows the first step («Начните с первого результата» + «Записать задачу») instead of an empty way; no agent working -> «Сейчас ни один агент не работает.».
- **UI elements:** the heading's «Сейчас» line; `ProjectWay`; «Вопросы ко мне»; `ProjectBoardGlance`; «Агенты на проекте» (`HomeAgents` filtered to the project) on SCR-31.
- **States covered:** loading (tasks unread — «Читаю…», never "no tasks"), empty (no tasks; nothing done / nothing now / empty queue per column), partial board read (said), error (questions unreadable — said; console that will not open — said), success
- **Errors & recovery:** the way is read from the tasks the page holds and the agents' words from `work.home`; a failure of either is said in place and the rest of the page stays.
- **Telemetry:** planned only.
- **Status:** draft
- **Amended 2026-10-14 (release review UX-5):** a board, team or console that fails is said in the operator's language — «Доску не удалось прочитать.», «Команду не удалось прочитать.», «Не удалось открыть консоль.» — with the machine's own words on a second line beneath, never inside the sentence.
- **Amended 2026-10-15 (release review i2 DO-2/DO-3/UX-3):** a task is never named by its instruction (step 2) on the way and the board glance; the one exception is «Вопросы ко мне», which shares the Board's attention rows and names a legacy task with neither brief nor title by the first line of its instruction, cut at a word, so the operator can recognise what waits for them; the board glance's «Готово» count is a floor, «20+», when the page read only the newest twenty finished tasks, and «Вся доска» then shows them all.
- **Amended 2026-10-15 (release review i3 UX-1, UX-4, ER-1):** the goal is said once, as «Цель: …» in «Дальше»; the side panel «Цель» appears only while the project has none and then shows its purpose. A tasks read that fails is said on the way and on the board glance — «Задачи проекта не прочитаны…» before any read, «Задачи не перечитались — ниже то, что прочитано раньше.» above an earlier read — never an endless «Читаю…».
- **Amended 2026-10-17 (0.3.7 wave 1, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** the 0.3.7 target is SCN-165 — the same way, questions and board glance on one page, plus «Открыть консоль», «Поставить задачу» and the folders, with no sections below and no sub-navigation. This scenario stays the description of the page built today until wave 4.
- **Coverage:** `apps/desktop/src/shared/projectPath.ts`, `apps/desktop/src/renderer/src/launch/ProjectWay.tsx`, `apps/desktop/src/renderer/src/launch/ProjectLaunch.tsx`; tests `apps/desktop/src/shared/projectPath.test.ts`, `apps/desktop/src/renderer/src/launch/ProjectLaunch.test.tsx`
- **Product:** unobserved

### SCN-160: See which coding agents this computer runs, and set how it behaves
- **Persona:** P-01
- **Feature:** Settings
- **Traces:** FLW-40, SCR-52 (JTBD-02)
- **Entry point:** Settings in the navigation
- **Preconditions:** none
- **Steps:**
  1. Operator opens Settings -> a screen (not a band over another page) with «Агенты для кода на этом компьютере», «Запуск», «Компьютер», «Вид», «Данные и доступ»; the page it replaced stays as it was underneath.
  2. Operator reads the agents -> every agent Fabric knows: installed with its version and path, installed but not answering, or not installed with the vendor's install command. When Switchboard 0.6.31+ publishes its catalogue (`switchboard --json agents status`), its default and switched-off agents are marked and agents only Switchboard knows are added; the line above the list says which source is shown.
  3. Operator sets «Не давать компьютеру засыпать», the fallback order, theme, language or usage counts -> each saves through the settings write and says so if it did not.
- **Expected result:** the operator knows which agents can run here and changes how this computer behaves in one place.
- **Alt paths:** Switchboard absent -> «Switchboard не установлен: показано то, что Fabric нашёл…»; older than 0.6.31 -> «Switchboard старше 0.6.31 и не публикует каталог…»; Switchboard refuses -> «Switchboard отказался отдать каталог…» with its words beneath (0.3.12, CO-313); no answer in 5 s -> «Switchboard не ответил за 5 секунд…» (CO-313); its read fails otherwise -> the reason is said. A setting that is not saved is said at the foot of the screen, pinned in view, until the next saved write or «Скрыть» (CO-313).
- **UI elements:** `SettingsScreen` (SCR-52) — `AgentCatalogPanel`, `FallbackOrderSetting`, the sleep select with its note, theme and language selects, `UsageCountsSetting`, history and agent-access buttons.
- **States covered:** loading («Читаю каталог агентов…»), empty (no agent installed — each row says «не установлен» with its install command), error (detection failed — said; catalogue unreadable — said), success
- **Errors & recovery:** enabling, disabling and choosing the default agent are Switchboard's commands; Fabric reads them and never writes them, and says so under the list.
- **Telemetry:** planned only.
- **Status:** draft
- **Amended 2026-10-14 (release review UX-5):** "its read fails -> the reason is said" now means our sentence, «Каталог Switchboard не прочитан — показано то, что Fabric нашёл на этом компьютере.» (and «Не удалось поискать агентов.» when Fabric's own detection fails), with the machine's reason on a second line beneath it, never in brackets inside the sentence.
- **Amended 2026-10-15 (release review i2 DO-3):** a catalogue Switchboard publishes in a format this Fabric does not read says so in words («…в формате, который этот Fabric не читает…») and shows what Fabric found on this computer; an agent Switchboard says nothing about carries no «установлен»/«не установлен» pill rather than a guess.
- **Amended 2026-10-17 (0.3.7 wave 1, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** the 0.3.7 target splits this screen: the coding agents on this computer move to Агенты (SCN-166); how Fabric behaves stays in Настройки (SCN-170).
- **Amended 2026-10-19 (OF-11, [ADR-0168](../adr/0168-every-catalogue-agent-starts-as-a-console-and-fewer-prompts-is-the-machine-default.md)):** Settings carries «Разрешения агентов», one choice for every agent Fabric starts: «Меньше подтверждений» (chosen by default) or «Проверять вручную», each with its consequence beneath; a launch that names a mode keeps it. Each agent's row says how it starts («Запуск: GOOSE_MODE=auto goose», «gemini --yolo»). Every coding agent of the catalogue can now be started as a console from a project (SCN-166 step 2), not only the five Fabric connects to its surface.
- **Coverage:** `apps/desktop/src/shared/agentCatalog.ts`, `apps/desktop/src/shared/consoleCatalog.ts` (the console table), `apps/desktop/src/shared/agents.ts#preferredMode`, `apps/desktop/src/main/agentCatalogRead.ts`, `apps/desktop/src/renderer/src/launch/SettingsScreen.tsx`, `apps/desktop/src/renderer/src/App.tsx`; tests `apps/desktop/src/shared/agentCatalog.test.ts`, `apps/desktop/src/shared/consoleCatalog.test.ts`, `apps/desktop/test/permission-preference.test.mjs`, `apps/desktop/src/renderer/src/launch/SettingsScreen.test.tsx`. Measured 2026-10-14 on the operator's Mac: Switchboard 0.6.30 → `too-old`; after the upgrade, Switchboard 0.6.31 → the `{ok, data}` envelope read, 30 agents listed (ledger V1-27).
- **Product:** unobserved

### SCN-161: Fabric opens while its stack is still starting
- **Persona:** P-01
- **Feature:** Startup
- **Traces:** ST-033, FLW-21, SCR-30 (JTBD-02)
- **Entry point:** opening Fabric right after Docker (OrbStack) has come back — after a restart, an update, or a sleep
- **Preconditions:** the local stack's containers exist but are not healthy yet, or another `supabase start` is still running
- **Steps:**
  1. Operator opens Fabric -> the splash shows that the stack is starting, with its own last line.
  2. The stack answers «container is not ready: starting», or «supabase start is already running» -> Fabric waits ten seconds and the splash says «База ещё запускается, попытка 2 из 4» (in the interface's language since 0.3.12, CO-306; «The stack is still starting, try 2 of 4» in English); then it starts the stack again. «unhealthy» is a fault, shown at once. A quit during the wait starts nothing more.
  3. Up to four tries in all -> once the stack answers, startup goes on as usual and the home opens (SCN-158); nothing of the wait is left on screen.
- **Expected result:** a stack that only needed another minute never reaches the operator as «The local stack refused to start».
- **Alt paths:** the stack is still starting after the fourth try -> the startup error shows the stack's own last words, as any refusal does. Docker unreachable, a port taken, a broken config, or any refusal other than the two above -> shown at once, never retried: those are the operator's to fix, and a wait would only hide them.
- **UI elements:** the startup splash's progress line; the native startup error sheet (unchanged).
- **States covered:** starting, still-starting (try n of 4), ready, refused (said at once), given-up (after the fourth try)
- **Errors & recovery:** the last refusal is thrown as it was, so the startup sheet and the copied details carry the stack's own words; Retry on that sheet starts the stack again with a fresh count.
- **Telemetry:** planned only.
- **Status:** draft
- **Coverage:** `apps/desktop/src/shared/stackStartRetry.ts` (`stackStartIsTransient`, `startWithRetry`, `STACK_START_RETRY`: four tries, ten seconds apart), `apps/desktop/src/main/env.ts#startStack`; test `apps/desktop/src/shared/stackStartRetry.test.ts` (a starting container waited out; Docker away said at once; the last words thrown after the fourth try); the disk line: `apps/desktop/src/shared/startupFailure.ts` (`diskLowLine`, `freeDiskGb`, `LOW_DISK_BYTES`), `apps/desktop/src/main/index.ts` (the free space in the log and the copy), `startupFailure.test.ts` "a full disk is named"; 0.3.9: `apps/desktop/src/main/hubStandby.ts`, `apps/desktop/src/main/stackWatch.ts`, `apps/desktop/src/shared/stackWatch.ts`, `apps/desktop/src/renderer/src/StackHealthNotice.tsx`, `apps/desktop/test/stack-watch.test.mjs`, `apps/desktop/test/startup-wait.test.mjs`
- **Amended 2026-10-20 (0.3.7 review, ER-4):** when Docker does not answer at start (OrbStack or Docker Desktop still starting, typical at login), Fabric waits up to 90 s, saying «Waiting for Docker to answer» on the splash, and starts the stack as soon as Docker answers; only after the deadline does it show the failure, naming Docker.
- **Amended 2026-10-21 (0.3.8, the audit of 0.3.7):** when the stack will not start, times out, starts silent, loses its database, or fails in a way Fabric cannot classify, and the volume that holds Fabric's data folder has under 3 GB free (3 000 000 000 bytes, decimal, as the line says it), the startup failure says FIRST how much is free there and that Docker stops when the disk runs out (Docker Desktop on Windows, Docker Engine on Linux, OrbStack or Docker Desktop on macOS), in the reader's number format. The figure is what the system reports as free for an ordinary program: on macOS it leaves out space the system could purge, so Finder may show more; on Windows and Linux Docker may keep its data on another volume, so the line is a likely cause, not a proof. The copied details and `startup-failure.log` carry the same number.
- **Amended 2026-10-21 (0.3.9, [the core holds](../evidence/plans/2026-10-21-core-reliability/README.md#stability)):** when Docker or the database is not ready, Fabric no longer shows the failure window and quits: a small window says what it waits for («Fabric ждёт свою базу данных»), the next try (10 s growing to 2 min) and that agents are asked to wait; a background start shows it only when the person activates Fabric. The failure window stays for what will not heal (the CLI or the repository missing, a schema behind or ahead). While Fabric runs, a database or Docker that stops answering is said on every screen («База данных Fabric не отвечает»), Fabric brings it back, and agents get 503 `stack-unavailable`; a disk under 3 GB is named first as the likely cause. While a try runs the notice says «Пробуем сейчас», never while a hold stands; in the wait window a low disk is the first line, and «агентов просят подождать» shows only while Fabric holds the hub's port (else it says agents cannot reach Fabric, with the system's own words on a quieter line «Что ответила система: …»); the window comes forward at the first wait and when the person activates Fabric, not at every try; when Docker is not running, the window and the notice say how to start it on each system; an external stack is waited for, never restarted; a stack stopped with `supabase stop` is not started again until the next launch; no try runs while the containers still run. Each system's own Docker is named: Docker Desktop on Windows, Docker Engine on Linux, OrbStack or Docker Desktop on macOS.
- **Amended 2026-10-24 (0.3.12: CO-306, CO-374 in part; 0.3.12 release review, iteration 1, UX-4, UX-5, DO-20):** the splash speaks the interface's language, so the wait for Docker reads «Жду ответа Docker (N с)» in Russian and "Waiting for Docker to answer (N s)" in English (`apps/desktop/src/shared/splashProgress.ts#splashProgress`). The notice «База данных Fabric не отвечает» stands above a detached console or editor window too, and the window under it shrinks to the space left, so the console's prompt stays in view (`.detached-window`, `apps/desktop/src/renderer/src/App.tsx`); its countdown «Следующая попытка через {N} с.» ticks visibly each second, while a screen reader hears the next try once, as the reading that brought it said it (`apps/desktop/src/renderer/src/StackHealthNotice.tsx#StackHealthNotice`; test `StackHealthNotice.test.tsx`).
- **Amended 2026-10-24, iteration 2 (0.3.12 release review, iteration 2, UX-6):** the notice's hidden announcement names the moment of the next try («Следующая попытка в 14:03:20.»), which stays true however late it is read; the visible countdown ticks outside the live region (`StackHealthNotice.tsx`).
- **Product:** unobserved

## Fabric 0.3.7 — simple: five places, act at once, undo from История · 2026-10-17 ([ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md), [plan](../evidence/plans/2026-10-15-fabric-simple/README.md))

Wave 1 of the 0.3.7 plan: the target behaviour of the five places on the rail — Главная, Проект, Агенты, История,
Настройки — and of «Создать». Designed, NOT built: waves 2–4 build it. Shared rules for every scenario below:

- **An act happens at once** (ADR-0160 §1): no «Вы уверены?», no native dialog, no `window.confirm`. After an act the
  place shows one quiet line at its foot — «{что сделано} · Отменить» — until the next act or until the person leaves
  the place; История keeps it for good (SCN-168, SCN-169).
- **What still asks** (ADR-0160 §4) asks as a question on Главная (SCN-164), never as a pop-up: spending above a
  project's limit or a key's ceiling, publishing outward, deleting what cannot be restored, an act on another person's
  machine.
- **Words for people** (plan §4): a person's screen never shows claim/заявка, lease/аренда, session/сессия, journal/
  журнал, estate/пространство, harness, a runner id, a backlog row, an MCP tool name or a project's internal id. A
  failure is our sentence in the person's language with the machine's own words on a second, quieter line (as the
  0.3.6 review's UX-5 set).
- Every string below is the Russian the person reads; the English twin is drawn beside it in the prototype
  (`product.html#view-simple-home?lang=en` and the other `simple-*` views).

### SCN-162: Move between the five places and the projects from the rail
- **Persona:** P-01
- **Feature:** Shell
- **Traces:** ST-032, ST-037, FLW-93, SCR-84 (JTBD-02)
- **Entry point:** any place of Fabric; the rail is always on the left
- **Preconditions:** Fabric has started; there may be no project yet
- **Steps:**
  1. Person looks at the rail -> from the top: the PassionCode mark with «Fabric», one button «＋ Создать», the five places «Главная», «Агенты», «История», «Настройки» (Проект is opened from the list below, never a sixth fixed entry), then «Проекты» with a compact list (rows 26 px high, OF-04), and nothing at the foot while this computer is fine: one line «этот компьютер · есть что проверить» appears there only when something needs a look (OF-05).
  2. Person reads the projects list -> favourites first (a gold star), then by latest activity; each row is the project's name, a green dot when an agent works there now, and a gold count when something waits for the person; nothing else on the row.
  3. Person presses a place or a project -> it opens in the main area; the pressed row is highlighted; there is no tab strip of places or projects (the only tabs at the top are the open consoles, SCN-172) and no back button of Fabric's own: ⌘[ and the swipe go back, ⌘] forward.
  4. Person presses «＋ Создать» -> «Создать» opens in the main area (SCN-171), not a menu over the page.
  5. Person presses ⌘K -> search opens beside the place, its field focused. The top bar holds only the place's name and the open consoles (OF-05, 2026-10-19): no search field, no profile, no conversation with Fabric (that opens from Help).
- **Expected result:** every place and every project is one press away from anywhere, and the rail alone says where an agent works and where the person is needed.
- **Scroll (0.3.10, 2026-10-22):** a page longer than the window scrolls by the wheel, the trackpad and Tab inside the place, Settings included, while the rail, the top bar, a notice, a side panel and «Отменить» stay where they are; another place, another project or the workspace opened from a project starts at its top. The window itself never scrolls. Going back with ⌘[ opens the previous page at its top, not where it was left (CO-388). The keyboard's PageDown and Space reached the page only once focus was in it (CO-384); since 0.3.11 a move made from the rail puts focus on the new page's first heading, so they scroll it at once. Proof: `scripts/test/shell-scroll.browser.mjs` (the renderer's stylesheets in Chrome: the wheel, focus, Settings, notices, a hidden label, print, a short window), `launch/Rail.test.tsx` (the page reset), `shared/appRoute.test.ts` (`scrollKeyOf`).
- **Alt paths:** no project yet -> the list says «Проектов пока нет» with «Создать проект» (SCN-171); more than twelve projects -> the list scrolls inside the rail and keeps favourites on top; a project's name longer than the rail -> cut with an ellipsis, the full name in its tooltip; the window narrower than 900 px -> the rail folds to icons with the counts, its names in tooltips.
- **UI elements:** the mark and «Fabric · by PassionCode»; «＋ Создать»; the five place rows with Главная's gold count of questions; «Проекты» label; project rows (dot, star, count); the trouble line at the foot, only on trouble; ⌘K for search.
- **States covered:** loading (the list reads — «Читаю проекты…», never "no projects"), empty (no project), error (the list could not be read — «Проекты не прочитаны.» with the machine's words beneath and «Повторить»; the five places stay usable), success
- **Errors & recovery:** the projects list fails -> said in the rail in place of the list, the last reading kept beneath it marked «как было в {время}»; «Повторить» reads again; nothing else on the rail depends on it.
- **Telemetry:** planned only.
- **Status:** implemented
- **Coverage:** apps/desktop/src/renderer/src/launch/LaunchShell.tsx (0.3.7 wave 3, region `rail`: «＋ Создать», Главная with the count of what waits for the person, Агенты, История, Настройки, the projects list with its dot, star and count and its reading, empty and failed states, ⌘K, the foot line only on trouble; since 2026-10-19 no search field, profile or conversation in the shell, OF-04 and OF-05), apps/desktop/src/shared/railProjects.ts (favourites first, then latest activity), apps/desktop/src/renderer/src/launch/rail.css (the fold under 900 px), apps/desktop/src/renderer/src/App.tsx region `rail-wiring` (⌘[ back, ⌘] forward; no tab strip, no Back button); probed in apps/desktop/src/renderer/src/launch/Rail.test.tsx (including the compact row heights, read from rail.css), apps/desktop/src/shared/railProjects.test.ts and apps/desktop/src/renderer/src/entityAddress.test.tsx; 0.3.12 S7 (CO-401): the trackpad's two-finger swipe goes back and forward (`apps/desktop/src/shared/swipeTravel.ts#swipeStep`, wired in `apps/desktop/src/renderer/src/App.tsx`; test `swipeTravel.test.ts`); 0.3.12 S5 and the review: the graph mark on a project row (`apps/desktop/src/renderer/src/launch/LaunchShell.tsx`, `rail.css`)
- **Product:** unobserved
- **Amended 2026-10-20 (0.3.7 review, UX-9, UX-10):** the folded rail keeps its names in tooltips and accessible names; the foot line appears only when this computer's journal cannot be read.
- **2026-10-23 (0.3.11 review, iteration 2, DO-6):** the trackpad swipe back is not built; it is 0.3.12, in CO-401.
- **Amended 2026-10-24 (0.3.12; 0.3.12 release review, iteration 1, UX-11, ER-12):** the trackpad swipe is built: fingers to the right go back, to the left forward, and only a gesture that scrolls nothing under the pointer turns the page; a gesture that scrolled anything sideways (the Board's columns, a wide table) is spent until the fingers pause (`apps/desktop/src/shared/swipeTravel.ts#swipeStep`). Going back or forward with ⌘[, ⌘] or the swipe opens a place where it was left, not at its top (0.3.12 S4c, CO-388; the Scroll paragraph above is 0.3.10's). A project row on the rail is one tab stop: the graph mark beside it (24 px) opens the project's graph for the pointer and is out of the tab order; the keyboard reaches the same graph through «Связи» on the project page (SCN-175); «Граф проектов» under the list shows once there is more than one project (`apps/desktop/src/renderer/src/launch/LaunchShell.tsx`; `Rail.test.tsx`).

### SCN-163: See on Главная what needs me, what is being done now, and my projects
- **Persona:** P-01
- **Feature:** Home
- **Traces:** ST-037, ST-044, ST-032, FLW-94, SCR-85 (JTBD-02)
- **Entry point:** «Главная» on the rail; Fabric opens here
- **Preconditions:** none; there may be no project, no agent and no question
- **Steps:**
  1. Person opens Главная -> a large greeting that says the state in one sentence: «Добрый вечер. Вас ждут 3 вопроса.» (or «Вас ничего не ждёт.»), under it one line «Пять агентов работают в четырёх проектах. Всё остальное идёт без вас.», and three numbers in a hairline strip — «агентов работают», «задач в работе», «на проверке».
  2. Person reads «Ждёт вас» -> the questions waiting for them across projects, the oldest decision first: who asks and from which project, how long ago, the question in plain words, why it matters, and the options as buttons (SCN-164).
  3. Person reads «Сейчас» -> one line per agent at work: its sign, what it says it is doing in its own words, the project, how long; an agent that has said nothing yet shows what it is working on («Работает над: {задача}»); one gone quiet says «давно не отзывался — {время}» and sorts after the rest.
  4. Person presses an agent's line -> its console opens (SCN-166); «Открыть консоль» in the section's heading opens the console of the first agent that works.
  5. Person reads «Проекты» -> favourites first, then by latest activity: the name, «Что сейчас» in a sentence, a thin bar of the way done, the number of agents, when it last changed; a row opens the project (SCN-165).
- **Expected result:** in a few seconds the person knows whether anything needs them, what is being done, and where to go — without opening a project or an agent's console.
- **Alt paths:** nothing waits -> «Ждёт вас» says «Вопросов нет. Агенты работают сами.» and folds to one line; no agent works -> «Сейчас ни один агент не работает.» with «Открыть консоль» on the default coding agent; no project -> the greeting says «Начните с проекта» and the projects section offers «Создать проект» and «Открыть папку с проектами» (SCN-171); the local database is reachable from the network -> it is a question at the top of «Ждёт вас» (SCN-164), never a banner.
- **UI elements:** the greeting heading; the numbers strip; «Ждёт вас» with question cards; «Сейчас» with agent rows and «Открыть консоль»; «Проекты» table; the act line at the foot.
- **States covered:** loading («Читаю…» in each section on its own; numbers show «—», never 0), empty (no question / no agent at work / no project), partial (one section could not be read — said in that section; the others stand), error (nothing could be read — «Fabric не смог прочитать, что происходит.» with the machine's words beneath and «Повторить»), success, stale (an agent quiet past its window)
- **Errors & recovery:** a section that fails says so in its own place in our words with «Повторить» and keeps its last reading marked «как было в {время}»; a count after a failed reading shows «—», never the last number as current; a console that will not open says «Консоль не открылась.» on the agent's line and leaves Главная as it was.
- **Telemetry:** planned only.
- **Amended 2026-10-24 (0.3.12 release review, iteration 1, UX-2, UX-10, UX-14, DO-7):** the greeting is the part of the day and how many decisions wait for the person, in Russian plural forms: «Добрый вечер. Вас ждёт 1 решение.», «Вас ждут 3 решения.», «Вас ждут 5 решений.», or «Вас ничего не ждёт.» (`apps/desktop/src/renderer/src/EstateHome.tsx`, `apps/desktop/src/renderer/src/i18n/translate.ts#pluralForm`, `apps/desktop/src/shared/homeView.ts#dayPart`; test `plural.test.ts`); in English late evening and night both say "Good evening.". «Нужны вы» with nothing for the person says «Ничего не ждёт вашего решения», not that the board is clear; a topic the person raised reads «вы спросили» as its asker. The Board's «Нужны вы» tab is the same reading (SCN-173). The step 1 quotes «Вас ждут 3 вопроса.» and the alternative «Вопросов нет. Агенты работают сами.» are the 0.3.7 target, not what ships.
- **Amended 2026-10-24, iteration 2 (0.3.12 release review, iteration 2, UX-1, UX-10):** the greeting, the «ждут вас» cell, each project's «Ждут вас» and the rail's counts all count the same set, «Нужны вы»: questions, access requests and refusals (one `board.query` with `personOnly`, read in `App.tsx` and handed to `EstateHome.tsx` as `waitingForYou`); reviews stay counted as «на проверке». A question's detail says what it holds in the interface's language («Держит 1 задачу»).
- **Amended 2026-10-23 ([the walk of 2026-10-22/23](../evidence/plans/2026-10-15-fabric-simple/2026-10-23-operator-walk.md)):** «Нужны вы» (the questions) and «Где остановились» are the first two sections (OF-15). What the home lists is what is needed **from the person**, each row saying who asks (agent and project), what for and how long it waits, opening in place to read all of it; rows meant for agents are on the Board screen (SCN-173), not here (OF-14). «Сейчас» becomes «Агенты в работе»: a box that scrolls inside itself, active agents first, then idle ones, each line naming the task the agent holds (its claimed task's title), never its latest action (OF-17, D-4); the box carries the one «Открыть переписку» (OF-16). «Кто что делает» is two columns, «В работе» and «Закончили», and pressing it opens the Board screen (OF-18).
- **Status:** implemented in part (0.3.11, 2026-10-23; 0.3.12 S6, CO-391: what only the person can resolve, the asker named, the greeting line and the option buttons on a question; the 0.3.12 review: the greeting counts decisions). What ships is the walk's order and the amendment of 2026-10-24 below. Not built: the second line of step 1 («Пять агентов работают…»; the numbers strip carries those counts), the greeting «Начните с проекта» for no project (the projects section says «Пока пусто…» with «Создать первый проект»), the thin bar of the way done on a project row, and «Повторить» on a section that failed (a failed section says so in its place with the machine's words beneath, and a section that keeps its last reading marks it «как было в {время}»)
- **Coverage:** since 0.3.11 (the walk's order, OF-14 to OF-18): `apps/desktop/src/renderer/src/launch/HomeParts.tsx`, `apps/desktop/src/renderer/src/launch/HomeWork.tsx`, `apps/desktop/src/renderer/src/EstateHome.tsx`, `apps/desktop/src/shared/homeLive.ts`, with `HomeParts.test.tsx`, `HomeWork.test.tsx` and `homeLive.test.ts`; before 0.3.11 there was none for the place itself (today's home was SCN-158's). Wave 3 moved two notices onto it as questions, never banners: the local database reachable from the network (`apps/desktop/src/renderer/src/StackExposureNotice.tsx`) and the usage-count question (`apps/desktop/src/renderer/src/UsageCountsNotice.tsx`), both rendered by `EstateHome.tsx`; an agent's ask of a product is the board's question reached from it, no native prompt (`apps/desktop/src/main/index.ts`, the hub's `present`); 2026-10-23 (the walk's OF-14 to OF-17): «Нужны вы» with rows that open in place (`apps/desktop/src/renderer/src/launch/HomeParts.tsx#HomeBoard`, test `HomeParts.test.tsx`), «Где остановились» under it (`EstateHome.tsx`), «Агенты в работе» by planned task, active first, scrolling, with «Открыть переписку» (`apps/desktop/src/renderer/src/launch/HomeWork.tsx#HomeAgents`, `HomeWork.test.tsx`); 0.3.12 S6 (CO-391): the person's part only, the asker named, a question answered in place with its options (`apps/desktop/src/renderer/src/launch/HomeParts.tsx#HomeBoard`, `apps/desktop/src/shared/board.ts#PERSON_KINDS`, `HomeParts.test.tsx`, `board.test.ts`), the greeting (`apps/desktop/src/renderer/src/EstateHome.tsx`, `apps/desktop/src/shared/homeView.ts#dayPart`, `homeView.test.ts`)
- **Product:** unobserved

### SCN-164: Answer a question in plain words with one press, and take the answer back
- **Persona:** P-01
- **Feature:** Questions
- **Traces:** ST-044, ST-030, FLW-94, SCR-85, SCR-86, SCR-88 (JTBD-02, JTBD-07)
- **Entry point:** a question card in «Ждёт вас» on Главная, or in «Вопросы» on a project's page
- **Preconditions:** an agent, or Fabric itself, has asked the person something
- **Steps:**
  1. Person reads the card -> who asks (the agent's sign and name, the project, how long ago); the question as a question to the person («Выпускать Fabric 0.3.7 сейчас или дождаться перевода на русский?»); one line of why it matters («Всё остальное проверено. Без перевода русские экраны покажут английский текст в двух местах.»); the options as buttons, the one the agent recommends in gold; each option's effect in its tooltip and, on focus, under the buttons («Выпуск уйдёт пользователям сегодня»).
  2. Person presses an option -> the answer is recorded at once and goes to the agent; the card leaves «Ждёт вас» and the foot of the place says «Ответ «Выпускать сейчас» отправлен · Отменить».
  3. Person presses «Обсудить» (when the agent offers it) -> the asking agent's console opens with the question and its context in front; the card stays waiting.
  4. Person presses «Отменить» (in the foot line or in История) -> the answer is taken back: the card returns to «Ждёт вас» as it was, and the agent is told the answer was withdrawn; both acts stay in История.
- **Expected result:** a decision takes one press, the person sees what each option will do before pressing, and a wrong press is taken back from the same place.
- **Alt paths:** a boundary question (ADR-0160 §4) is drawn the same way and says which boundary it is: money («Можно потратить $14 на прогон проверок на облачной машине?» — «Лимит проекта на этот месяц — $40, потрачено $9.»), publishing outward («Опубликовать новую страницу «Для бизнеса» на сайте?» — «Это видно всем — поэтому спрашиваю.» with «Открыть предпросмотр»), deleting what cannot be restored, an act on another person's machine; Fabric's own question about this computer («База данных Fabric видна из вашей сети.» — «Любой в этой сети может читать ваши проекты.» with «Закрыть доступ из сети» and «Оставить как есть»); an answer the agent already acted on -> «Отменить» says what can no longer be taken back («Агент уже начал выпуск — отменить ответ нельзя, но можно попросить остановиться») and offers «Попросить остановиться»; the question was withdrawn by its agent before the press -> the card says «Вопрос снят агентом» and leaves.
- **UI elements:** question card (agent sign, name, project, time; question; why; option buttons with the recommended one in gold; «Обсудить»; «Открыть предпросмотр» where there is one); the act line «Ответ … отправлен · Отменить».
- **States covered:** waiting, answering (the pressed button busy, the others disabled), answered (the act line), undone (the card back), cannot-undo (said with why), withdrawn, error (the answer did not reach — «Ответ не записан.» with the machine's words beneath; the card stays with the options enabled), empty («Вопросов нет.»)
- **Errors & recovery:** an answer that is not recorded keeps the card with its options and says so; an answer whose outcome is unknown says «Неизвестно, дошёл ли ответ — проверяю» and reads the question again before offering the options, so a second press never answers twice; a question that fails Fabric's check of the board's rules (no options, no why) is shown with «Агент не объяснил, зачем спрашивает» and «Обсудить» only.
- **Telemetry:** planned only.
- **Amended 2026-10-23 ([the walk of 2026-10-22/23](../evidence/plans/2026-10-15-fabric-simple/2026-10-23-operator-walk.md)):** every question also takes the person's own text, not only its options (OF-28): «Ответить своими словами» opens a field; the answer marks the question answered, goes to the asking agent through the board, and the agent reads it at its next `fabric_question_check`. Each question shows its context: the project, the agent, and what it blocks.
- **Status:** draft
- **Coverage:** none yet — waves 2 (reopen as the inverse of answer) and 4 (the card); today's answer is SCN-050's
- **Product:** unobserved

### SCN-165: Open a project and steer it from one page
- **Persona:** P-01
- **Feature:** Projects
- **Traces:** ST-032, ST-034, ST-030, FLW-95, SCR-86 (JTBD-02, JTBD-07)
- **Entry point:** a project in the rail's list, a row of Главная's «Проекты», a question's project name
- **Preconditions:** the project exists; it may have no tasks and no agent yet
- **Steps:**
  1. Person opens the project -> one page, no sub-navigation: the name in a large heading with a star to make it a favourite, its purpose in one sentence beneath, and — when an agent works — «Сейчас: {что агент говорит}».
  2. Person reads «Откуда пришли и куда идём» -> three columns «Сделано», «Сейчас», «Дальше» (the goal first as «Цель: …», then the queue), each task its plain summary with its agent; a task opens its own page.
  3. Person reads «Вопросы» -> this project's questions as cards (SCN-164); none -> «Вопросов нет».
  4. Person glances at «Доска» -> four columns «Очередь», «В работе», «Проверить», «Готово» with counts and the first cards; «Вся доска» opens the whole board in place; a card dragged to another column moves at once and the foot says «Задача перенесена в «Проверить» · Отменить».
  5. Person presses «Открыть консоль» -> the console of the coding agent at work here opens, else a new console starts on the default coding agent in the project's folder (SCN-166).
  6. Person presses «Поставить задачу» -> a field opens in place: what should be done, in the person's words, and «Поставить»; the task appears in «Очередь» at once with «Задача поставлена · Отменить»; «Поставить и начать» also starts a coding agent on it.
- **Expected result:** a project left for days is understood and steered from one page: where it came from, where it goes, what it asks, its board, a console and a new task — all one press.
- **Alt paths:** no tasks -> the way says «Начните с первой задачи» with the field of step 6 open; no agent works -> «Сейчас ни один агент не работает.»; the person renames the project or edits its purpose -> saved as they leave the field, no revision banner (plan §5), the act in История with «Отменить»; «Переписка с другими проектами» at the page's foot opens what this project and others told each other (SCN-143), and «Папки проекта» lists its folders with «Добавить папку» and, per folder, «Убрать» — removed at once, «Папка убрана · Отменить».
- **UI elements:** heading with star; purpose; «Сейчас» line; «Откуда пришли и куда идём»; «Вопросы»; «Доска» glance with «Вся доска»; «Открыть консоль»; «Поставить задачу» field with «Поставить» and «Поставить и начать»; «Папки проекта»; «Переписка с другими проектами»; the act line.
- **States covered:** loading (each block «Читаю…» on its own), empty (no tasks; no questions; no agent), partial (the board or the questions unreadable — said in that block), error (the project could not be read — «Проект не прочитан.» with «Повторить»), missing (the project was removed — «Такого проекта больше нет» with «Открыть История»), success
- **Errors & recovery:** a move, a new task, a rename or a removed folder that is not recorded snaps back and says «Не сохранилось.» with the machine's words beneath; a task's text typed into a failed «Поставить» stays in the field; a console that cannot start says why on the button's line (no coding agent ready -> «Нет готового агента — открыть Агенты»).
- **Telemetry:** planned only.
- **Amended 2026-10-23 ([the walk of 2026-10-22/23](../evidence/plans/2026-10-15-fabric-simple/2026-10-23-operator-walk.md)):** the page's order is: back to the place it came from at the top left above the title (OF-22); the head «откуда · где сейчас · куда», each line naming the agents and tasks behind it (OF-25); «Нужны вы» for this project; «Агенты на проекте», one line per agent with the task it holds (OF-23); **Цель · Команда · План** written by the onboarding agent (OF-24, SCN-171), Команда listing the people found in the repositories' Git history beside the agents (OF-27, D-5); the project's kanban strip (SCN-173 filtered to it, OF-20); an analytics strip in the right column (tasks done this week, in review, waiting for the person, last activity; OF-26, OF-39). Ideas and files sit under «Идеи и материалы», collapsed; automation moves to the project's settings.
- **Amended 2026-10-23 (0.3.12 wave 2, slice S4a; [the spec](../evidence/specs/2026-10-23-0312-w2-project-onboarding.md)):** the side column's «Что это за проект» shows what the onboarding agent recorded (the one-line summary, «Цель», «План» with «Сделано» and «Дальше», «Связанные проекты»), the business the person can correct («Бизнес», saved as they leave the field; the board never joins projects of two businesses), and «Люди (из Git)», the authors of the project's repositories with their commits and last date; a project without a profile shows «Познакомиться с проектом», which files the onboarding task (SCN-171) and opens it. Each part that cannot be read says so on its own (`apps/desktop/src/renderer/src/launch/ProjectProfile.tsx`, `apps/desktop/src/renderer/src/launch/ProjectProfile.test.tsx`). Slice S4b adds «Как идёт работа» beneath it (OF-39, OF-26): tasks done in eight weeks with a bar per week, the median time from task to done and in review, the share sent back from review and the questions waiting with the oldest, read from the journal; what Fabric cannot know says «пока не известно» (`apps/desktop/src/renderer/src/launch/ProjectAnalytics.tsx`, `apps/desktop/src/shared/projectAnalytics.ts`). The project's kanban strip, «Идеи и материалы» and the way back's scroll follow in slice S4c.
- **Status:** implemented in part (0.3.12 W2 S4a to S4c, with the release review's fixes): the page ships as the amendment of 2026-10-24 below says; the steps above are the 0.3.7 target and the walk's order, and where they differ the amendment is what ships. Not built in 0.3.12: «Идеи и материалы» (the folded panel is «Ресурсы и настройки») and the project's last activity in the analytics (CO-307, 0.3.13)
- **Coverage:** `apps/desktop/src/renderer/src/launch/ProjectLaunch.tsx` (the page and its order, «Связи»), `apps/desktop/src/renderer/src/launch/ProjectWay.tsx` (the way and the kanban strip), `apps/desktop/src/renderer/src/launch/ProjectProfile.tsx` («Что это за проект», «Познакомиться с проектом», the business, the people from Git), `apps/desktop/src/renderer/src/launch/ProjectAnalytics.tsx` over `apps/desktop/src/shared/projectAnalytics.ts#projectAnalytics` («Как идёт работа»), `apps/desktop/src/main/gitPeople.ts#readGitPeople`, `apps/desktop/src/main/projectOnboarding.ts#createOnboardingFiler`; tests `ProjectLaunch.test.tsx`, `ProjectProfile.test.tsx`, `projectAnalytics.test.ts`, `apps/desktop/test/git-people.test.mjs`, `apps/desktop/test/project-onboarding.test.mjs`. Before 0.3.12 the page was SCN-159's
- **Amended 2026-10-24 (0.3.12 release review, iteration 1, DA-1 to DA-5, DO-8, DO-10, UX-6, UX-11, ER-1 to ER-3; [the spec](../evidence/specs/2026-10-23-0312-w2-project-onboarding.md#amendments-2026-10-24-what-was-built)):** the page reads, top to bottom: the way back; the head (name, purpose, «Сейчас») with «Доска проекта», «План» and «Связи» (the project's graph, SCN-175); in the main column the way («Где мы»), or «Начните с первого результата» for a project with no task, «Вопросы ко мне» (this project's part of «Нужны вы») and the kanban strip; beside it «Агенты на проекте», «Что это за проект», «Как идёт работа», «Команда» (the project's agents; the people from Git are in «Что это за проект»), «Ритм работы» and «Ресурсы и настройки», folded. «Познакомиться с проектом» stays until an agent records a goal or a summary: the person setting only the business keeps it. «Люди (из Git)» reads one `git log` per repository (its checkouts and worktrees grouped by Git's common directory), counts a commit once by its hash, and says a history it could not read with its folders and Git's reasons («Не прочитан один репозиторий; люди выше из остальных:»); a failed reading is not cached, a complete one is kept 10 minutes. «Как идёт работа» counts the person's close of a task as done, reads the journal newest first, paged up to 5 000 moves, and says when it reached that bound («…самые ранние недели могут быть посчитаны не полностью»). «Бизнес» is the person's: an agent may set it only while none is recorded, and never clears or changes it.
- **Amended 2026-10-24, iteration 2 (0.3.12 release review, iteration 2, ER-9, DA-1, DA-2, ER-6, UX-7):** a project counts as onboarded from a goal, a summary, a plan with items or recorded relations, and its plan shows whenever it has items. The business is the person's once the person wrote it (cleared included): an agent never sets it then, and the person's and an agent's writes run one at a time per project (`main/projectOnboarding.ts#projectProfileLock`, `writeAgentProfile`). People from Git: at most four `git` runs at once, and a reading with a repository unread is held 60 seconds; counts use plural forms («1 commit»).
- **Product:** unobserved

### SCN-166: See every agent and open its console in one press
- **Persona:** P-01
- **Feature:** Agents
- **Traces:** ST-037, ST-041, ST-050, FLW-96, SCR-87 (JTBD-02, JTBD-05)
- **Entry point:** «Агенты» on the rail; an agent's line in Главная's «Сейчас»
- **Preconditions:** none
- **Steps:**
  1. Person opens Агенты -> two groups: «Агенты для кода на этом компьютере» (Claude Code, Codex, Kimi Code, Hermes… each with whether it is ready, its version, and where it works now) and «Агенты, созданные в Fabric» (each with what it is for and its project); every row says in a sentence what the agent is doing now or «Свободен».
  2. Person presses «Консоль» on a row -> the agent's console opens inside Fabric, full size in the main area, as a tab along the top with its project's name (SCN-172), never in a window of its own; it is the console of the project it works in; a free coding agent asks nothing more and starts in the project last opened, its folder named on the button («Консоль в Fabric»).
  3. Person opens a row -> the agent's view: what it is doing, its recent acts (from История), the projects it may work in, and «Что получает агент» — the rules and tools it is given (the harness, moved here from the project page; plan §4).
  4. Person presses «Создать агента» at the top -> «Создать» opens on its agent path (SCN-171).
- **Expected result:** every agent the person has is on one list with what it is doing, and its console is one press away.
- **Alt paths:** a coding agent is not installed -> its row says «Не установлен» with how to install it; one installed but not signed in -> «Нужно войти» with «Открыть консоль, чтобы войти»; a coding agent that joined from a terminal carries «подключился сам» and «Отключить» (SCN-167); no agent built in Fabric -> the group says «Пока нет — создайте первого» with «Создать агента».
- **UI elements:** the two groups; agent rows (sign, name, state sentence, project, «Консоль»); «Создать агента»; the agent view with «Что получает агент»; the act line.
- **States covered:** loading («Ищу агентов на этом компьютере…»), empty (none installed — each known agent listed «Не установлен» with its install line), partial (agents found but what they do unreadable — said per row), error («Не удалось поискать агентов.» with «Повторить»), success, stale (an agent quiet past its window — «давно не отзывался»)
- **Errors & recovery:** a console that cannot open says why on its row («Консоль не открылась: Codex не отвечает.»), with the machine's words beneath; detection that fails keeps the last list marked «как было в {время}».
- **Telemetry:** planned only.
- **Amended 2026-10-23 ([the walk of 2026-10-22/23](../evidence/plans/2026-10-15-fabric-simple/2026-10-23-operator-walk.md)):** the list must load or say why it did not (OF-30: the operator saw «выберите агента слева» with nothing to choose); choosing an agent opens its page beside the list, the page being its flow: the task it holds, what it did, results, then its history.
- **Status:** implemented in part (0.3.12 S6, CO-393): every agent at work with its page beside the list (the task it holds, what it is doing, its results, what it did by day) and its console, project and task one press away. Not built: the two groups of step 1 with each coding agent's readiness (SCN-160 lists them in Settings), «Что получает агент» (step 3) and «Создать агента» at the top
- **Amended 2026-10-24 (0.3.12 release review, iteration 1, UX-3, UX-7, DO-20):** beside the list the place says one of three things until an agent is chosen: the list could not be read («Список агентов не прочитан, поэтому открыть агента нельзя.» with «Повторить»), nobody works («Сейчас ни один агент не работает, открыть некого. Агент появится здесь, когда начнёт работу в проекте.»), or «Выберите агента в списке: здесь будут его задача, что он делал и результаты.»; a chosen agent's page takes focus and scrolls into view (`apps/desktop/src/renderer/src/launch/HomeWork.tsx#AgentsAtWork`; test `AgentPage.test.tsx`). SCR-87 is built, so the OF-09 note below («until SCR-87 is built») is history: the agent's page of CO-393 replaced it. An agent's results do not yet say «только что» or the task and day (CO-418, 0.3.13).
- **Amended 2026-10-24, iteration 2 (0.3.12 release review, iteration 2, UX-3):** focus moves to an agent's page only when the person picks the agent (pressing the chosen one again focuses it at once); a refresh never moves focus (`launch/HomeWork.tsx#AgentsAtWork`).
- **Amended 2026-10-20 (OF-09):** until SCR-87 is built, the agent picked in Агенты shows its flow newest first: each act in words (a task it moved, a decision it recorded, its stage, its session opened) with who wrote it, read also by the agent as the event's actor; «Открыть сессию» opens its console beside it.
- **Coverage:** `apps/desktop/src/renderer/src/launch/AgentPage.tsx` and `apps/desktop/src/renderer/src/launch/HomeWork.tsx#AgentsAtWork` (0.3.12, see the end of this line); before: waves 3–4; today's agents are SCN-049's and SCN-160's lists; 2026-10-23 (OF-30): every agent at work on the Agents place, a terminal's included (`apps/desktop/src/renderer/src/launch/HomeWork.tsx#AgentsAtWork`), and one line when Fabric holds no console (`apps/desktop/src/renderer/src/EstateAgents.tsx`); 0.3.12 S6 (CO-393): the agent page beside the list (`apps/desktop/src/renderer/src/launch/AgentPage.tsx`, `apps/desktop/src/renderer/src/launch/HomeWork.tsx#AgentsAtWork`, test `AgentPage.test.tsx`)
- **Product:** unobserved

### SCN-167: A coding agent opened outside Fabric is let in, and the person disconnects it with one press
- **Persona:** P-01
- **Feature:** Agents
- **Traces:** ST-045, FLW-96, SCR-87, SCR-88 (JTBD-08); [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md) §3, amending ADR-0134 and ADR-0115
- **Entry point:** the person opens a coding agent in a terminal, in a folder of one of their projects (SCN-137's entry)
- **Preconditions:** this computer is the operator's own (ADR-0160 scope); the folder belongs to a project
- **Steps:**
  1. The agent asks Fabric to join the project -> it is let in at once, with the same rules and the same expiry a console Fabric starts gets; no dialog, no queue item, no notification asks the person anything.
  2. Person looks at Агенты or История -> «Codex подключился к проекту Fabric из терминала · 2 мин» in История; in Агенты the agent's row carries «подключился сам» and «Отключить», and «Fabric не может доказать, что это Codex» as a fact on its line (ADR-0160 consequences).
  3. Person presses «Отключить» -> at once: its consoles end, its next call is refused, and it stays out of every project until the person lets it back in; the row says «Отключён» with «Пустить снова»; История records the act with «Отменить».
  4. Person presses «Пустить снова» (or «Отменить» on the disconnect) -> the agent may join again on its next call.
- **Expected result:** a coding agent the person opened themselves works in its project without a question, and the person sees it and can take that back with one press.
- **Alt paths:** the folder is not inside a project -> the agent is told so and nothing is shown to the person but a line in История («Codex открыт в папке вне проектов — {папка}») with «Сделать проектом»; another person's machine (ADR-0144) -> nothing here changes: that still asks per act, as a question on Главная (SCN-164).
- **UI elements:** the История entry; the agent's row with «подключился сам», «Отключить», «Пустить снова» and the proof line.
- **States covered:** joined, disconnected, let-back, outside-projects, error («Не удалось отключить.» with the machine's words beneath — the row stays connected and says so)
- **Errors & recovery:** a disconnect that fails leaves the agent connected and says so on its row; nothing is half-revoked; «Повторить» on the line.
- **Telemetry:** journal `session.enrolled@1` (the agent as actor), `access.binding.revoked@1` (the person as actor).
- **Status:** draft
- **Coverage:** apps/desktop/src/main/keptOut.ts (0.3.7 wave 3: «Отключить» revokes every credential the agent holds and keeps it out of every project until «Пустить снова», each the other's inverse as acts), apps/desktop/src/main/accessService.ts region `kept-out-door` (the kept-out agent refused before any admission write), apps/desktop/src/renderer/src/launch/JoinedAgents.tsx (in Агенты: «подключился сам», the proof line, «Отключить», «Отключён» with «Пустить снова»); the let-in itself is ADR-0164's admission (apps/desktop/src/main/projectAdmission.ts). Probed in apps/desktop/test/kept-out.test.mjs, apps/desktop/test/session-enroll-request.test.mjs and apps/desktop/src/renderer/src/launch/JoinedAgents.test.tsx. Not yet: the «Codex открыт в папке вне проектов» line in История (wave 4)
- **Product:** unobserved

### SCN-168: Read every act in История — who did it, when and to what
- **Persona:** P-01
- **Feature:** History
- **Traces:** ST-033, ST-034, FLW-97, SCR-88 (JTBD-02, JTBD-07)
- **Entry point:** «История» on the rail; «Открыть История» from a place's act line or a missing project
- **Preconditions:** none
- **Steps:**
  1. Person opens История -> every act, newest first, grouped by day («Сегодня», «Вчера», «14 октября»): the time, the actor's sign and name (the person — «Вы», Fabric, or a named agent), the act in a sentence («Codex подключился к проекту Fabric из терминала», «Вы остановили Claude Code в проекте Nicegram», «Kimi Code перенёс задачу «Сборка на macOS 15» в «Проверить»»), the project, and at the right either «Отменить» or a quiet «Нельзя отменить» whose reason opens on hover and focus.
  2. Person filters -> «Кто» (Вы / Fabric / an agent), «Проект», «Что» (вопросы, задачи, агенты, папки, выпуски, решения) and a search field; the filters stay when the person leaves and comes back.
  3. Person opens an act -> its detail beside the list: what changed before and after, its source (the agent's console record, the task, the question), and, for an undone act, the act that undid it.
- **Expected result:** the cause of anything that went wrong can be found in История: who did what, when, on which project, and whether it can be taken back.
- **Alt paths:** nothing yet -> «История пуста: здесь появится каждое действие — ваше и агентов.»; the filters match nothing -> «Ничего не найдено» with «Сбросить фильтры»; releases are «Что: выпуски» (the Releases log becomes this filter, plan §2); decisions are «Что: решения» (the project's Decisions section, cut, is reached here).
- **UI elements:** day groups; act rows (time, actor sign and name, sentence, project, «Отменить» / «Нельзя отменить»); filters «Кто», «Проект», «Что»; search; detail pane.
- **States covered:** loading («Читаю историю…»), empty, filtered-empty, error («История не прочитана.» with the machine's words beneath and «Повторить»), success, long (older days load when the person presses «Ещё раньше»)
- **Errors & recovery:** a failed read keeps what was read before marked «как было в {время}» and says so above it; never an empty list for a failure.
- **Telemetry:** planned only.
- **Amended 2026-10-23 ([the walk of 2026-10-22/23](../evidence/plans/2026-10-15-fabric-simple/2026-10-23-operator-walk.md)):** История must show what agents and people did, newest first, from the journal; the operator found it empty (OF-34). An empty История is shown only when the journal holds no act, and then says so.
- **Status:** implemented in part (0.3.11, 2026-10-23; 0.3.12 S6, CO-395: «Что делали агенты» by day, each row naming who did it). Not built in 0.3.12: История's filters (step 2) and detail pane (step 3); they moved to 0.3.13, carry-over row CO-414 (the triage of 2026-10-24). «Что делали агенты» also lists the person's own events as «Вы» and Fabric's (UX-16, CO-418, 0.3.13)
- **Coverage:** the read is built in the main process (0.3.7 wave 2): `acts.history` in `apps/desktop/src/main/acts.ts` over `act.recorded@1` (`actLog.ts`), newest first, paged by a cursor, filtered by who (`actorKind`), project, what (`category`) and words, each row with its undo state; probed in `apps/desktop/test/acts.test.mjs` and, against the real journal, `acts-db.test.mjs`. The place on the rail is wave 3's minimum: `apps/desktop/src/renderer/src/launch/HistoryScreen.tsx` (newest first by day, who, the sentence, the project, «Отменить» or why not, «Ещё раньше», a failed read said with «Повторить»), probed in `HistoryScreen.test.tsx`. The filters, the detail pane and the agents' own acts (from their events) are wave 4's.; 2026-10-23 (OF-34): «Что делали агенты» under the acts, the journal's events (`apps/desktop/src/renderer/src/launch/HistoryScreen.tsx`); 0.3.12 S6 (CO-395): «Что делали агенты» as History, by day, each row naming who did it, no journal number (`apps/desktop/src/renderer/src/launch/HistoryScreen.tsx#AgentWork`, `apps/desktop/src/renderer/src/Feed.tsx#feedAct`, test `HistoryScreen.test.tsx`)
- **Product:** unobserved

### SCN-169: Undo an act, or read why it cannot be undone
- **Persona:** P-01
- **Feature:** History
- **Traces:** ST-033, FLW-97, SCR-88 (JTBD-07); [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md) §2
- **Entry point:** «Отменить» on an act in История, or in a place's act line right after the act
- **Preconditions:** the act has an inverse: a stopped console (started again where it stood), a released task (taken again), a removed folder (added again), a discarded draft (restored), an answered question (reopened), a moved task (moved back), a disconnected agent (let back in), a renamed project (its old name back)
- **Steps:**
  1. Person presses «Отменить» -> at once, no question: the inverse is done, and the act's row says «Отменено · {время}» with a link to the new act «Вы отменили: …», which itself has «Отменить» (so an undo can be redone).
  2. Person returns to the place of the act -> it is as before the act (the console running from where it stood, the task in its old column, the folder in the project).
- **Expected result:** a wrong press is never permanent when it can be reversed, and both the act and its reversal are in История with their actors.
- **Alt paths:** the act has no inverse -> «Нельзя отменить» says why, before and after: «Сообщение уже доставлено другому проекту», «Выпуск уже опубликован — его можно только заменить новым», «Письмо отправлено»; the object changed since (another agent moved the task again, the folder was deleted from disk) -> «Отменить» says what it would do now («Вернуть задачу в «В работе»? Её с тех пор перенёс Codex») as the button's own text, and a press does that, never a silent overwrite; the inverse needs something that is gone (the coding agent was uninstalled) -> «Отменить нельзя: Codex больше не установлен».
- **UI elements:** «Отменить»; «Отменено · {время}»; «Нельзя отменить» with its reason; the act line in a place.
- **States covered:** undoing (the button busy), undone, redone, cannot-undo, changed-since, error («Не удалось отменить.» with the machine's words beneath; nothing changed, the button enabled again)
- **Errors & recovery:** a failed undo changes nothing and says so; an undo whose outcome is unknown reads the object again before the button is enabled, so a second press never doubles the inverse.
- **Telemetry:** journal: the inverse act with `undoes` naming the act it reverses: `act.recorded@1` (migration 90, suffix 112), one record for every act whatever its own event: the actor, the sentence, the inverse or `why_not`, `undoes`.
- **Status:** draft
- **Coverage:** the inverse of each act is built in the main process (0.3.7 wave 2) and tested do-then-undo-then-redo with both acts in the journal (`apps/desktop/src/main/acts.ts`, `apps/desktop/test/acts.test.mjs`, `apps/desktop/test/acts-db.test.mjs`): a task moved, a claim released, a folder detached or attached, a project renamed, an answered question reopened, a console stopped (started again where it stood), a draft discarded; wave 3 adds a disconnected agent let back in (`apps/desktop/src/main/keptOut.ts`, `apps/desktop/test/kept-out.test.mjs`). The buttons: the act line at a place's foot (`apps/desktop/src/renderer/src/launch/ActLine.tsx`, wired to `acts.undo` in `App.tsx`; probed in `ActLine.test.tsx` and `actLineShell.test.tsx`) and История's rows (`HistoryScreen.tsx`). Not yet: the button's own text when the object changed since (`changedSince`, wave 4), and a message to another project (the operator has no send in the main process).
- **Product:** unobserved
- **Amended 2026-10-20 (0.3.7 review, DA-1):** taking an answer back also ends the decision it recorded, so agents no longer read it and the decisions list no longer shows it; answering again records the one current decision.

### SCN-170: Set how Fabric behaves in Настройки
- **Persona:** P-01
- **Feature:** Settings
- **Traces:** FLW-40, SCR-89 (JTBD-02)
- **Entry point:** «Настройки» on the rail
- **Preconditions:** none
- **Steps:**
  1. Person opens Настройки -> one page of sections with small uppercase labels: «Язык и вид» (язык, тема), «Этот компьютер» (не давать компьютеру засыпать, пока агенты работают), «Запуск агентов» (порядок: кто запускается, если первый не может), «Данные» (передавать счётчики использования; личная история разговоров — экспорт и импорт), «Доступ агентов» (which agents may reach which products, with «Отозвать»).
  2. Person changes a setting -> it saves at once and says «Сохранено» beside it; История records it with «Отменить».
- **Expected result:** how Fabric behaves is set in one place, each change saved at once and reversible.
- **Alt paths:** an agent's access is also visible on its row in Агенты; Switchboard absent or too old -> the launch order says what is shown and why (as SCN-160); a source build -> usage counts «Эта сборка ничего не передаёт».
- **UI elements:** the five sections; selects and switches; «Отозвать»; «Сохранено».
- **States covered:** loading, error (a setting that did not save — «Не сохранилось.» beside it, the old value back), success, unavailable (a setting this build or this computer cannot change, with why)
- **Errors & recovery:** a failed save puts the old value back and says so beside the control; the rest of the page stays usable.
- **Telemetry:** planned only.
- **Amended 2026-10-22 (P-24, [ADR-0172](../adr/0172-the-interface-language-is-the-agents-working-language.md)):** under «Язык» the section says that the agents write in it too: «На нём пишут и ваши агенты: задачи, отчёты, сообщения на доске и документацию для вас. Новый язык агент узнаёт, когда в следующий раз спрашивает у Fabric свои правила.» Rows already on the board stay in the language they were written in.
- **Amended 2026-10-23 ([the walk of 2026-10-22/23](../evidence/plans/2026-10-15-fabric-simple/2026-10-23-operator-walk.md)):** every section says what it changes and holds nothing that belongs elsewhere (OF-33). The account-quota panel is retired: quotas are Switchboard's, and Fabric reads Switchboard where it chooses a runner (OF-35, D-3). «Не давать компьютеру засыпать» is verified on the installed app with `pmset -g assertions` (OF-36). A new switch under «Язык»: «Переводить тексты агентов на язык интерфейса», on by default; off keeps the agents' own language (OF-38).
- **Shipped 2026-10-23 (0.3.11):** the switch reads «Агенты пишут на языке интерфейса»; while it is off, the hint under «Язык» says agents write in their own language. The quota panel's entry is gone from Settings, but Fabric still reads the quota and the project page still shows its cell (CO-392, 0.3.12).
- **Status:** implemented in part (0.3.11, 2026-10-23; 0.3.12: CO-392, CO-407, CO-313). What ships is the amendment of 2026-10-24 below; the section names of step 1 and «Сохранено» after a change (step 2) are not built: they moved to 0.3.13 with CO-348, Settings' section pass (the triage, 2026-10-24)
- **Coverage:** `apps/desktop/src/renderer/src/launch/SettingsScreen.tsx` (0.3.11; before it, none: wave 4 redrew SCN-160's screen); 2026-10-23 (OF-35, OF-38): no quota entry; «Агенты пишут на языке интерфейса» under «Язык» (`apps/desktop/src/renderer/src/launch/SettingsScreen.tsx`, ADR-0174) Since 0.3.11: `apps/desktop/src/renderer/src/launch/SettingsScreen.tsx` (the language and its switch), `apps/desktop/src/shared/appSettings.ts#workingLanguageOf` and `appSettings.test.ts`.; 0.3.12 W3e (CO-407): «Сообщения между сессиями агентов», Claude Code's `crossSessionInbound` by the person's switch (`apps/desktop/src/main/claudeInbound.ts`), and «Готовность Fabric», the launcher doctor's Fabric checks on «Проверить» (`apps/desktop/src/renderer/src/launch/SettingsScreen.tsx#ReadinessPanel`, `apps/desktop/src/main/fabricReadinessRead.ts`)
- **Product:** unobserved
- **Amended 2026-10-20 (0.3.7 review, UX-13, UX-3):** «Компьютер» carries «Запускать Fabric при входе в систему», on by default, only on macOS and Windows in an installed build; on Linux and in a development build the row is absent. A login start opens no window; the note says where to open Fabric (the Dock on macOS, the «Пуск» menu on Windows). When the system does not do what the box says, one line says so: macOS waits for approval in «Объекты входа»; it is turned off in «Объекты входа» or «Автозагрузка»; the system still starts Fabric after the box was cleared; or the system could not be read. «Разрешения агентов» is the same screen's permission choice (SCN-160).
- **2026-10-23 (0.3.11, ADR-0174):** the shipped hint says agents write tasks, notes, reports and board messages in the language, and that a project's repository keeps its own language («…задачи, заметки, отчёты и сообщения на доске. Документы в репозитории проекта остаются на языке проекта…»); the earlier quote naming «документацию для вас» is retired.
- **Amended 2026-10-24 (0.3.12; 0.3.12 release review, iteration 1, DO-4, UX-8, UX-18, UX-20):** the window reads no quota: the quota channel, its strings and the project page's cells are gone (CO-392, `e4995f30`, `362981db`). The page's sections, in order: «Разрешения агентов», «Агенты для кода на этом компьютере», «Когда у агента кончился лимит», «Сообщения между сессиями агентов» and «Готовность Fabric»; beside them «Компьютер», «Вид» (тема, язык and «Агенты пишут на языке интерфейса»), «Данные и доступ» and «Ещё». A settings write that is refused is said once, pinned at the screen's foot: «Настройки не сохранены: {причина}. На экране то, что записано на диске.» (`settings.notSaved`), never beside the control. «Сообщения между сессиями агентов» sets Claude Code's own setting for all its sessions on this computer; a refused write says «Не сохранилось: настройки Claude Code не приняли изменение. Переключатель показывает то, что записано в файле.» with the machine's words beneath and keeps the switch at what the file holds, and a file that does not read says «Файл настроек Claude Code не читается, поэтому Fabric его не трогает.» (`apps/desktop/src/renderer/src/launch/SettingsScreen.tsx#AgentLinksSetting`). «Готовность Fabric» runs the check only on «Проверить»; a check that fails shows our sentence (for example «Проверка не дошла до ответа.») with the machine's words beneath it, apart (`apps/desktop/src/renderer/src/launch/SettingsScreen.tsx#ReadinessPanel`; test `SettingsScreen.test.tsx`).

### SCN-171: Start something new from «Создать» — a project, an agent, or a projects folder
- **Persona:** P-01
- **Feature:** Start paths
- **Traces:** ST-001, ST-050, FLW-98, SCR-90 (JTBD-01, JTBD-05); the [onboarding plan](../evidence/plans/2026-10-13-onboarding-036/README.md) §2–§4, absorbed
- **Entry point:** «＋ Создать» on the rail; «Создать проект» or «Открыть папку с проектами» on an empty Главная; «Создать агента» in Агенты
- **Preconditions:** none
- **Steps:**
  1. Person presses «＋ Создать» -> «Создать» opens in the main area with three choices, one line each of what you get: «Открыть папку с проектами» (primary — «Fabric найдёт все проекты в папке, вы отметите, над какими работать»), «Создать проект» («Новая папка или идея — с первой задачей»), «Создать агента» («Агент со своей задачей, сделанный вашим агентом для кода»).
  2. Person chooses «Открыть папку с проектами» -> the system folder picker (its last location remembered) -> the scan runs in place with a live count; found projects are grouped by owner, then local, then folders without git (folded), the active ones ticked («давно не менялся» on the rest) -> «Работать над отмеченными» adds them at once and lists them with «Открыть»; «{N} проектов добавлено · Отменить» (SCN-128).
  3. Person chooses «Создать проект» -> name, where it lives (a new folder, with git on, or «Пока только идея») and the first task in a sentence -> «Создать» makes it at once and opens it (SCN-165); «Проект создан · Отменить» (SCN-129).
  4. Person chooses «Создать агента» -> what the agent should do in a sentence, which coding agent builds it (the same radio rows everywhere), its project -> «Создать» starts that coding agent's console on it; the new agent appears in Агенты as it is made (SCN-136).
- **Amended 2026-10-23 (0.3.12 wave 2, slice S3; [the spec](../evidence/specs/2026-10-23-0312-w2-project-onboarding.md), W2-7):** a project created by any start path gets one task in its queue, «Познакомиться с проектом {имя}», with its brief's three parts written (what, why, expected), so an agent that starts it reads the project and records its profile through the hub (`fabric_project_profile`) without changing the repository; the task is filed once per project (`apps/desktop/src/main/projectOnboarding.ts#onboardingTaskId`), never for a project that existed, and a failure to file it leaves the project created.
- **Expected result:** every start begins in one place, and each path ends in a working project or agent in at most three steps, without a dialog.
- **Alt paths:** «Открыть проект из папки» (one or several folders as one project) is a line under the folder choice (SCN-127); a folder already in a project -> «Уже в проекте {имя}» with «Открыть»; the scan finds nothing -> «В этой папке проектов не нашлось» with «Выбрать другую папку»; the scan is slow -> «Ищу дольше обычного — можно остановить» after 10 s; macOS refuses to read the folder -> «Нет доступа к папке» with «Открыть настройки macOS».
- **UI elements:** three choice cards; the folder picker; the scan list with groups, ticks, «Отметить все», «Только активные», «Работать над отмеченными»; the project form; the agent form; the act line.
- **States covered:** choosing, scanning, slow, denied, found, empty (nothing found), adding, added, creating, created, error («Не получилось: {что}» with the machine's words beneath; what was typed is kept)
- **Errors & recovery:** a path that fails keeps everything chosen and typed, says what failed in our words, and offers «Повторить»; an add that half-succeeded lists which projects were added and which were not.
- **Telemetry:** planned only.
- **Amended 2026-10-23 ([the walk of 2026-10-22/23](../evidence/plans/2026-10-15-fabric-simple/2026-10-23-operator-walk.md)):** adding a project starts an onboarding task for an agent: what the project is and is for, its repositories and remotes, its goal, its relations to other projects; its result fills the project page (SCN-165) and the graph (SCN-175) (OF-31).
- **Status:** implemented (0.3.7 wave 3: «Создать» in the main area with its three choices, each opening the start path of SCN-127 to SCN-129 and SCN-136; 0.3.12 S3, OF-31: a project created through admission gets its onboarding task, and «Познакомиться с проектом» on the project page files it for a project that has none, SCN-165). Those paths keep their own screens; their redraw in this frame (wave 4's) is not checked here
- **Coverage:** apps/desktop/src/renderer/src/start/StartPaths.tsx region `create-place` (0.3.7 wave 3: «Создать» in the main area with its three choices, one folder or several, an agent built elsewhere, and the unfinished project drafts to go on with), probed in apps/desktop/src/renderer/src/start/CreateChoices.test.tsx and onboardingDraft.persist.test.tsx; each choice opens today's path (SCN-127…SCN-129, SCN-136), which wave 4 redraws in this frame; 0.3.12 S3 (OF-31): the onboarding task filed once per new project (`apps/desktop/src/main/projectOnboarding.ts#createOnboardingFiler`, called from `apps/desktop/src/main/projectAdmission.ts`), test `apps/desktop/test/project-onboarding.test.mjs`
- **Product:** unobserved

### SCN-172: Keep several consoles open as tabs along the top and switch between them
- **Persona:** P-01
- **Feature:** Shell
- **Traces:** ST-032, ST-037, FLW-93, FLW-96, SCR-84, SCR-87 (JTBD-02, JTBD-05); the operator's walk of 2026-10-19, OF-03 ([the walk](../evidence/plans/2026-10-15-fabric-simple/2026-10-19-operator-feedback.md))
- **Entry point:** any «Консоль» or «Открыть консоль» in Fabric: a row in Агенты (SCN-166), «Сейчас» on Главная (SCN-163), the project page (SCN-165), a task's page, «Где идёт работа», a coding agent started from «Создать» (SCN-171)
- **Preconditions:** a coding agent's session runs in the main process, or has ended and is still held there
- **Steps:**
  1. Person presses «Консоль» anywhere -> the console opens inside Fabric, full size in the main area, never in a window of its own; a tab appears in the top bar beside the place's name: the console sign, the project's name (for example «fabric-dashboards»), the coding agent («Claude Code»), and ×; the tab is marked as the one on screen; the rail stays the projects and the places, with the console's project highlighted.
  2. Person opens a second console -> a second tab, in the order they were opened; the person switches between consoles by pressing their tabs, and goes to any place or project from the rail while the consoles stay open as tabs.
  3. Person presses «Консоль» for a session whose tab is already open -> Fabric switches to that tab; no second tab.
  4. Person presses × on a tab, or ⌘W on a console -> the tab goes at once, nothing is asked, and the session goes on running (it is stopped only by «Остановить»); the console beside it comes forward, or, after the last one, the place the person was at before the consoles; the strip leaves the top bar with its last tab.
  5. Person presses «Открыть в отдельном окне» in the console's header -> the same session opens in a window of its own as well; the tab stays.
- **Expected result:** the consoles the person works in are in Fabric itself, one press apart, and the top bar says which are open.
- **Alt paths:** the session ends -> its tab stays with the console's own «завершена» state until the person closes it; the main process lets the session go (it was dismissed) -> its tab goes by itself; the window is reloaded -> the open consoles come back as tabs; Fabric is quit and opened again -> no console tabs, because no session outlives the app; a project's name is not known -> the tab is called by its folder's last part.
- **UI elements:** the console tabs in the top bar (sign, project, coding agent, ×); the console full size (its coding agent, folder and state, «Остановить», the terminal); «Открыть в отдельном окне».
- **States covered:** none open (no strip), one, several, active, reading (the session not read yet: «Читаю сессию…» on the tab), ended (the console says so), gone (the session is no longer held: the tab goes), error (the separate window did not open: said under the console's header with the machine's words)
- **Errors & recovery:** a console that cannot be read says why in place of the terminal and keeps its tab, so the person can close it; a separate window that does not open is said under the header and the console in Fabric stays.
- **Telemetry:** planned only.
- **Status:** implemented
- **Coverage:** apps/desktop/src/renderer/src/consoles.tsx region `console-tabs` (one way for every control to open a console: inside the shell through `OpenConsoleContext`, the separate window only where there is no shell; the list of open consoles, its order, the neighbour after a close, a gone session dropped only once seen, the tab's name, kept for a reload of the window), apps/desktop/src/renderer/src/launch/ConsoleTabs.tsx region `console-tabs-strip` (the strip in the top bar), apps/desktop/src/renderer/src/App.tsx region `console-tabs-shell` (the `console` route, ⌘W, the rail and the title, the place before the consoles), apps/desktop/src/renderer/src/SessionWindow.tsx («Открыть в отдельном окне»); probed in apps/desktop/src/renderer/src/consoleTabsShell.test.tsx (from Агенты: the tab with the sign and the project, no separate window, a second open adds no tab, × ends nothing), apps/desktop/src/renderer/src/launch/ConsoleTabs.test.tsx, apps/desktop/src/renderer/src/consoles.test.tsx and apps/desktop/src/shared/appRoute.test.ts. Not yet: dragging tabs to reorder them, and the product prototype (scripts/product) draws no console tabs
- **Product:** unobserved

### SCN-173: See all the work as a board and follow a task through its stages
- **Persona:** P-01
- **Feature:** Board
- **Traces:** ST-037, FLW-99, SCR-41 (JTBD-02)
- **Entry point:** «Кто что делает» on Главная; «Доска» on a project's page
- **Preconditions:** none; there may be no task
- **Steps:**
  1. Person opens the Board screen -> four columns in the order Fabric enforces: «Очередь», «В работе», «На проверке», «Готово»; «Отменено» is a filter.
  2. Person reads a card -> the task in plain words, its project, the agent that holds it, how long it has been in its column.
  3. Person scrolls -> the columns move sideways when they do not fit, and each column scrolls down on its own.
  4. Person narrows the board -> by project and by agent; the filters are remembered for the next visit.
  5. Person presses a card -> the task's page (SCN-174).
- **Expected result:** the person sees where every task is in the pipeline and opens any one in a press.
- **Alt paths:** no task -> «Задач пока нет»; a project's page shows the same board for that project only.
- **UI elements:** the four columns with their counts; cards; the project and agent filters; «Отменено».
- **States covered:** loading, empty, partial (one project could not be read, said on the board), error with «Повторить», success.
- **Errors & recovery:** a board that cannot be read says so in our words and keeps its last reading marked «как было в {время}».
- **Design rationale:** the operator, 2026-10-22: «хотелось бы видеть её канбаном ... в работе, на проверке»; the columns are Fabric's ladder (`apps/desktop/src/shared/ladder.ts`), not customizable in 0.3.11 (D-1).
- **Telemetry:** planned only.
- **Status:** implemented in part (0.3.11 the kanban and the project filter; 0.3.12 S7, CO-401: the agent filter, «Показывать отменённые» as a fifth column, and the filters remembered for the next visit in Settings' file; the 0.3.12 review: the amendment of 2026-10-24 below). Not built: «Задач пока нет» (each empty column says «Пусто»), «Повторить» on a failed read and «как было в {время}» on the reading kept (a board that cannot be read says «Доску не удалось прочитать.» with the machine's words beneath and keeps its last reading on screen)
- **Amended 2026-10-24 (0.3.12 release review, iteration 1, UX-2, UX-19, ER-9, DA-6, DO-7):** step 1's «Отменено» ships as the switch «Показывать отменённые», which adds a fifth column «Отменено», the most recently cancelled first (by when each was cancelled, `apps/desktop/src/main/workRead.ts#readTaskBoard`). The agent filter applies to «В работе» only, because a card in another column records no agent, and the board says so: «Фильтр по агенту действует только на «В работе»: у задач в других колонках агент не записан, поэтому они показаны все.» A column that could not be read says so in its place with «?» for its count. The Board screen's two views, «По этапам» and «Нужны вы», are part of the way back: going back from a task returns to the view it was opened from. «Нужны вы» lists only the person's part, each row naming who asks, the same reading as Главная's (SCN-163); its tabs are «Актуальное», «Решат агенты» (reviews, proposals and abandoned work, which an agent can settle; empty, «Агентам нечего решать.»), «На следующий раз», «Разобрано» and «Все темы»; with nothing for the person it says «Ничего не ждёт вашего решения» (`apps/desktop/src/renderer/src/launch/BoardScreen.tsx`, `personOnly`; test `BoardScreen.test.tsx`).
- **Amended 2026-10-24, iteration 2 (0.3.12 release review, iteration 2, UX-2, UX-4, UX-5, ER-8):** the Board's second tab is «На проверке» / "To review" (it was «Решат агенты» above): reviews, proposals and abandoned work, which are the person's to look at though no agent waits on them; empty, «Нечего проверять.». It has its own read: a failed read says so with the machine's words, and a list cut at the board's first 100 rows says it (`apps/desktop/src/renderer/src/launch/BoardScreen.tsx`). The tab is part of the route the way back from a task restores (`shared/appRoute.ts`, the board route's `tab`).
- **Coverage:** the kanban `apps/desktop/src/renderer/src/launch/KanbanBoard.tsx` over `apps/desktop/src/shared/taskBoard.ts#composeTaskBoard` (IPC `work:board`), on the Board screen's «По этапам» tab (`apps/desktop/src/renderer/src/launch/BoardScreen.tsx`); tests `KanbanBoard.test.tsx`, `taskBoard.test.ts`; 0.3.12 S7 (CO-401): `apps/desktop/src/renderer/src/launch/KanbanBoard.tsx` (agent, cancelled, remembered), `apps/desktop/src/main/workRead.ts#readTaskBoard` (the cancelled tasks), `apps/desktop/src/shared/appSettings.ts` (`boardFilters`); tests `KanbanBoard.test.tsx`, `taskBoard.test.ts`, `appSettings.test.ts`
- **Product:** unobserved

### SCN-174: Open a task and read what it is, why, and what will be ready
- **Persona:** P-01
- **Feature:** Task
- **Traces:** ST-037, FLW-100, SCR-32 (JTBD-02)
- **Entry point:** a card on the Board screen; a task on a project's page; a question that names a task
- **Preconditions:** the task exists in a project the person can see
- **Steps:**
  1. Person opens a task -> back to where they came from at the top left above the title; the title in plain words.
  2. Person reads the task -> «Для чего эта задача» with «Что должно произойти», «Почему», «Что будет верно, когда задача выполнена» (the brief; labels as shipped in 0.3.11), its state and the history of its moves, who works on it and since when, what blocks it.
  3. Person reads related work -> the project's tasks linked to it (follows, blocks, spawned) and its result once done.
- **Expected result:** the person understands the task without asking its agent.
- **Alt paths:** a task with no brief says «Агент ещё не описал задачу» and shows its title and history.
- **UI elements:** back at the top left; title; the three brief sections; state and history; the agent; links to related tasks; the result.
- **States covered:** loading, empty brief, error with «Повторить», success.
- **Errors & recovery:** a task that cannot be read says so and keeps the way back.
- **Design rationale:** the operator, 2026-10-22: «если провалюсь в задачу, ничего не понятно, о чём эта задача ... сделать нормальную структуру задачи, шаблонный вид» (OF-21, OF-22).
- **Telemetry:** planned only.
- **Status:** implemented in part (0.3.11 the template order and the way back; 0.3.12 S6 the way back named for its place and the empty brief's words, CO-394; 0.3.12 S7 «Что её держит» and «Как двигалась», CO-401; the 0.3.12 review: the amendment of 2026-10-24 below). Not built: «Агент ещё не описал задачу» (an empty brief is said as the amendment says) and «Повторить» on a failed read (a task that cannot be read says so in a banner and keeps the way back)
- **Amended 2026-10-24 (0.3.12 release review, iteration 1, UX-12, UX-13, DO-7):** an empty brief is one sentence. On a task still to do: «Спецификация не собрана: бриф ещё не написан. Агент спросит вас о нём, прежде чем начать, или напишите его сами ниже.» (`task.specEmpty`); on a finished or cancelled one: «Бриф не написан. Его можно написать ниже.» (`task.briefEmpty`). «Как двигалась» names each state in the kanban's column words («Очередь», «В работе», «На проверке», «Готово», «Отменено») and who moved it, «(вы)», «(агент)» or «(Fabric)» (`apps/desktop/src/renderer/src/TaskPage.tsx`; test `TaskPage.test.tsx`).
- **Coverage:** `apps/desktop/src/renderer/src/TaskPage.tsx` opens on the brief (what, why, what will be ready) before the instruction, with «← К проекту» at the top left; test `apps/desktop/src/renderer/src/TaskPage.test.tsx` («a task reads as a template»). The prototype's separate task route (`simple-task`) is not built: a task opens inside its project; 0.3.12 S7 (CO-401): what holds the task (`apps/desktop/src/main/index.ts`, `tasks.detail`'s `blockedBy`) and how it moved (`apps/desktop/src/shared/taskMoves.ts`), on `apps/desktop/src/renderer/src/TaskPage.tsx`; tests `TaskPage.test.tsx`, `taskMoves.test.ts`
- **Product:** unobserved

### SCN-175: See how a project is connected to the others on a graph
- **Persona:** P-01
- **Feature:** Projects
- **Traces:** ST-037, SCR-40 (JTBD-02)
- **Entry point:** the graph icon on a project's row in the rail's projects list; «Граф проектов» for all of them
- **Preconditions:** at least one project; the onboarding agent has recorded relations (SCN-171)
- **Steps:**
  1. Person presses a project's graph icon -> the graph opens centred on that project.
  2. Person reads the graph -> nodes are projects, each with a one-line summary; edges are relations (organization, dependency, board threads, requests between projects).
  3. Person sees what is not here -> a repository of the same GitHub organization that is not cloned on this computer is drawn as a node of its own kind; the organization is drawn as the level above its projects.
  4. Person presses a node -> that project's page (SCN-165).
- **Expected result:** the person sees a project's ecosystem: what it depends on, who talks to it, and what exists without a local folder.
- **Alt paths:** a project with no recorded relation stands alone and says «Связи ещё не найдены» with «Найти связи», which starts the onboarding task.
- **UI elements:** the graph; node summaries; the organization level; the legend (local, not cloned); the graph icon in the projects list.
- **States covered:** loading, a lone project, error with «Повторить», success.
- **Errors & recovery:** an organization that cannot be read is drawn without its uncloned repositories and says so.
- **Design rationale:** the operator, 2026-10-22: «построили карту связи, типа графа ... вижу всю экосистему проекта» (OF-32).
- **Telemetry:** planned only.
- **Status:** implemented in part (0.3.12 wave 2, slice S5, and the release review): what ships is the amendment of 2026-10-24 below. Not built: «Повторить» on a failed read and the legend for the dashed lines (CO-418, 0.3.13); a not-cloned repository of the same GitHub owner (step 3; it waits for a GitHub read Fabric does not have); the organization as a level above its projects (businesses are columns); the full name of a project whose name the node cuts; «Найти связи» (the onboarding offer is «Познакомиться с проектом» on the project page, SCN-165)
- **Coverage:** `apps/desktop/src/renderer/src/launch/GraphScreen.tsx` over `apps/desktop/src/shared/projectGraph.ts` (`composeGraph`, `aroundProject`), the rail's mark and «Граф проектов» in `apps/desktop/src/renderer/src/launch/LaunchShell.tsx`, «Связи» in `apps/desktop/src/renderer/src/launch/ProjectLaunch.tsx`, the read in `apps/desktop/src/main/index.ts` (IPC `projects:graph`); tests `apps/desktop/src/shared/projectGraph.test.ts`, `apps/desktop/src/renderer/src/launch/GraphScreen.test.tsx`, `Rail.test.tsx`, `ProjectLaunch.test.tsx`
- **Amended 2026-10-24 (0.3.12 release review, iteration 1, UX-1, UX-9, UX-10, UX-11, DO-7, DO-21):** the graph is reached three ways: a project's graph mark on the rail (for the pointer), «Связи» on the project's page (for the keyboard) and «Граф проектов» under the rail's list (the whole graph, shown once there is more than one project). Centred on a project, it shows that project and only its direct neighbours, titled «{проект} и его соседи», with «Весь граф»; whole, it is titled «Как связаны проекты». Businesses are columns («Бизнес не указан» and «Вне Fabric» are columns of their own); a line is a relation an onboarding agent recorded, and a dashed line joins two projects that share board threads, saying how many messages they hold in Russian plural forms. Names are readable in both themes (the node takes the page's ink). The same relations are listed as text under «Связи списком (N)». With no relation the graph says «Связи ещё не найдены. Они появятся, когда агенты познакомятся с проектами.»; a failed read says «Не удалось прочитать граф.» with the machine's words beneath and reads again when the journal moves.
- **Product:** unobserved

### SCN-176: A task starts only once its spec is whole, gathered by questions
- **Persona:** P-01
- **Feature:** Task
- **Traces:** ST-037, SCR-32 (JTBD-02)
- **Entry point:** a task set for an agent, by the person in Fabric or by another agent on the board
- **Preconditions:** an agent takes the task (a claim)
- **Steps:**
  1. Agent reads the task -> if what should happen, why, what will be true when done, what is out of scope or a constraint is missing, it asks the person (a question on the board, SCN-164) before anything else.
  2. Person answers -> the agent asks the next missing part, one question at a time, until the spec is whole; it builds nothing, files nothing and hands nothing on meanwhile.
  3. Spec whole -> the agent writes the brief (what, why, expected) and starts; the task page shows it (SCN-174).
- **Expected result:** no task is built from a one-line instruction; the person sees what was agreed before work starts.
- **Alt paths:** the person is away -> the task waits as «Спецификация не собрана» with the open question on «Нужны вы»; a task filed by another agent -> the questions go to that agent's project on the board.
- **UI elements:** «Спецификация не собрана» on the task page, naming the missing parts, and on its card in Очередь and В работе (`shared/taskSpec.ts#specMissing`); the open question on «Нужны вы».
- **States covered:** asking, waiting for an answer, whole, started.
- **Errors & recovery:** a question that cannot be posted keeps the task in the queue and says why.
- **Design rationale:** the operator, 2026-10-23: «при начале и постановке задачи всегда нужно убедиться, что вся спецификация собрана, и не отпускать, пока не собрана грилингом» ([ADR-0176](../adr/0176-a-task-is-grilled-to-a-full-spec-and-crosses-machines-by-trust.md)).
- **Telemetry:** planned only.
- **Amended 2026-10-24 (0.3.12 release review, iteration 1, UX-13):** a task with no brief at all says it in one sentence on its page, «Спецификация не собрана: бриф ещё не написан. Агент спросит вас о нём, прежде чем начать, или напишите его сами ниже.» (`task.specEmpty`); a brief written in part names its missing parts, «Спецификация не собрана, не написано: {части}. Агент спрашивает это, прежде чем начать.» (SCN-174).
- **Status:** implemented (0.3.12, CO-403): the hub's rule `intake.spec-first` at `fabric_whoami`; the spec is whole when the brief's what, why and expected are written (out of scope and constraints belong to expected)
- **Coverage:** `apps/desktop/src/shared/taskSpec.test.ts`, `apps/desktop/src/shared/protocolObligations.test.ts`, `apps/desktop/src/renderer/src/TaskPage.test.tsx`, `apps/desktop/src/renderer/src/launch/KanbanBoard.test.tsx`, `apps/desktop/src/shared/taskBoard.test.ts`, `apps/desktop/src/shared/homeLive.test.ts`
- **Product:** unobserved

### SCN-177: Work another project's agent should do crosses by the machine's trust
- **Persona:** P-01
- **Feature:** Board
- **Traces:** ST-037, SCR-41 (JTBD-02)
- **Entry point:** an agent working on feature A needs a change that another project's agent owns
- **Preconditions:** both projects are on the board; Fabric knows whether this machine is the operator's (Settings)
- **Steps:**
  1. Agent files a request on the owning project's board -> what is needed and why, linked to its task.
  2. On a trusted machine (the operator's own, or a remote one the operator marked as theirs) -> the owning project's agent takes it if online; if none is, the asking agent makes the change itself in that repository under its rules and records it on the request.
  3. On a machine that is not the operator's -> the asking agent never edits the other project; the request waits on the board until that project's agent is online and takes it.
  4. Person reads the board -> sees who asked whom, what for, and who did it.
- **Expected result:** a team's agents pass work between each other through the board, and an organization's machine never writes into a project it does not own.
- **Alt paths:** trust unknown -> treated as not trusted; the owning project has no agent at all -> the request shows on Главная in the block of requests between projects that no agent can answer (`launch/HomeBoardWaiting.tsx`), not in «Нужны вы».
- **UI elements:** «Этот компьютер» in Settings → Компьютер («Не указано», «Мой (личный или мой удалённый)», «Организации, не под моим управлением»), each with what an agent here may do; the request and its outcome on the board.
- **States covered:** filed, taken by the owner, done by the asker (trusted), waiting (untrusted), done.
- **Errors & recovery:** a request the board refuses stays with the asking agent, which says so on its task.
- **Design rationale:** the operator, 2026-10-23: «если проект личный или машина моя ... если агент есть, он подхватит, если нет, второй агент может сам; а если машина не моя, то первый агент заберёт с доски, когда будет онлайн» ([ADR-0176](../adr/0176-a-task-is-grilled-to-a-full-spec-and-crosses-machines-by-trust.md)).
- **Telemetry:** planned only.
- **Status:** implemented (0.3.12, CO-404): `fabric_whoami` names `protocol.machine` and serves the rule for it; «online» is the owning project's responder shown live by `com.directory`
- **Coverage:** `apps/desktop/src/shared/protocol.test.ts`, `apps/desktop/src/shared/appSettings.test.ts`, `apps/desktop/src/renderer/src/launch/SettingsScreen.test.tsx`, `apps/desktop/test/agent-surface.test.mjs`
- **Product:** unobserved

### SCN-178: See which projects have not answered an announcement
- **Persona:** P-01
- **Feature:** Project communications
- **Traces:** FLW-83, SCR-81 (JTBD-02)
- **Entry point:** Comms, the tab «Объявления»
- **Preconditions:** the board answers; a Project announced a finished unit of work to the Projects it touches (the operator's rule of 2026-10-19, thread `c430513b`)
- **Steps:**
  1. Person opens «Объявления» -> every announcement on the board, newest first, each with its author, «ответили N из M», its time and its first lines.
  2. Person reads under an announcement -> the projects that have not answered first, then each answer's type: «учёл» (adapted), «завёл задачу» (row), «не затронут» (not affected) or «ответил».
  3. Person keeps «Ждут ответа» (the default) or presses «Все» -> only announcements some project still owes an answer, or all of them.
  4. Person presses an announcement -> its thread opens in «Ветки».
- **Expected result:** the person sees at a glance which announcements are still open and who owes the answer.
- **Alt paths:** no announcement yet -> «Объявлений на доске пока нет»; every project has answered -> «На все объявления ответили все проекты» under «Ждут ответа»; more than 50 threads hold an announcement -> the newest 50 are read and the page says so.
- **UI elements:** the tab «Объявления»; «Ждут ответа» and «Все»; a row per announcement with the count; the list of who has and has not answered.
- **States covered:** reading, unavailable with «Попробовать снова», empty, all answered, success, capped.
- **Errors & recovery:** a board that does not answer is said with «Попробовать снова», never shown as «nobody owes an answer».
- **Design rationale:** fabric-workspace's ask on thread `c430513b` (2026-10-19) and `27750925`: «a view of announcements with the participants that have not answered, so the operator sees what is still open» (CO-377). A participant has answered when any message of its Project follows the announcement in the thread, a reply to a reminder included; the answer's type is the contract's typed reaction (DEC-0098) when present, else the first word.
- **Telemetry:** planned only.
- **Status:** implemented (2026-10-23, for 0.3.12)
- **Coverage:** `apps/desktop/src/shared/announcements.ts`, `apps/desktop/src/shared/announcements.test.ts`, `apps/desktop/src/renderer/src/launch/CommsAnnouncements.tsx`, `apps/desktop/src/renderer/src/launch/CommsAnnouncements.test.tsx`
- **Product:** unobserved

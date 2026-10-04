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
| SCN-026 | Follow the estate through the journal feed | Monitoring | P-01 | ST-004, FLW-04 | draft | 2026-09-09 PARTIAL |
| SCN-027 | Approve, refuse or watch the floor refuse | Autonomy | P-01 | ST-018, FLW-14 | draft | 2026-09-09 PARTIAL |
| SCN-028 | Open a project as a tab and configure it | Projects | P-01 | ST-001, ST-019, FLW-15 | draft | 2026-09-09 PARTIAL |
| SCN-029 | Launch an agent and open its session window | Agents | P-01 | ST-017, ST-020, FLW-16 | draft | 2026-09-09 BLOCKED |
| SCN-030 | Read the project workspace canvas | Workspace | P-01 | ST-021, FLW-17 | draft | 2026-09-09 PARTIAL |
| SCN-031 | Onboard a project in a new tab | Projects | P-01 | ST-001, ST-022, FLW-18 | draft | 2026-09-09 BLOCKED |
| SCN-032 | Ask for work and watch what it opened | Projects | P-01 | ST-023, ST-024, FLW-18 | draft | 2026-09-09 PARTIAL |
| SCN-033 | Attach and detach repositories | Projects | P-01 | ST-022, FLW-18 | draft | 2026-09-09 PARTIAL |
| SCN-034 | Open a file and save it against an agent's edit | Files | P-01 | ST-025, FLW-19 | draft | 2026-09-09 BLOCKED |
| SCN-035 | Read what an agent says it is doing | Agents | P-01 | ST-026 | draft | 2026-09-09 BLOCKED |
| SCN-036 | Read what a finished session actually did | Agents | P-01 | ST-026 | draft | 2026-09-09 PARTIAL |
| SCN-037 | See who remembered something, and what memory could not answer | Memory | P-01 | ST-007 | draft | 2026-09-09 PARTIAL |
| SCN-038 | Evaluate the shift from vibe coding to passion coding | Public website | P-05 | ST-027, FLW-20 | implemented | 2026-09-09 BLOCKED |
| SCN-039 | See what this project remembers, and what it could not answer | Memory | P-01 | ST-028, FLW-21 | draft | 2026-09-09 PARTIAL |
| SCN-040 | Rejoin a project by reading its decisions | Memory | P-01 | ST-029, FLW-21 | draft | 2026-09-09 PARTIAL |
| SCN-041 | Work a board the agents keep current | Tasks | P-01 | ST-030, FLW-22 | draft | 2026-09-09 PARTIAL |
| SCN-042 | Ask the manager, and get an artefact rather than advice | Manager | P-01 | ST-031, FLW-24, FLW-57 | draft | 2026-09-09 FAIL |
| SCN-043 | Lead with the projects actually being worked | Projects | P-01 | ST-032, FLW-21 | draft | 2026-09-09 PARTIAL |
| SCN-044 | Read what the estate has actually done | Manager | P-01 | ST-033, FLW-21 | draft | 2026-09-09 PARTIAL |
| SCN-045 | Rejoin a task by reading its own page | Tasks | P-01 | ST-034, FLW-22 | draft | 2026-09-09 PARTIAL |
| SCN-046 | Judge direction from goals and the graph | Planning | P-01 | ST-035, FLW-23 | draft | 2026-09-09 PARTIAL |
| SCN-047 | See what a project's agents may do, and hold them to it | Harness | P-01 | ST-036, FLW-24 | draft | 2026-09-09 PARTIAL |
| SCN-048 | Find anything the estate holds from one field | Search | P-01 | ST-028, FLW-21 | draft | 2026-09-09 PARTIAL |
| SCN-049 | Watch every agent from one screen | Agents | P-01 | ST-037, FLW-21 | draft | 2026-09-09 PARTIAL |
| SCN-050 | Answer a scoped question and see whether work received it | Board/questions | P-01 | ST-030, ST-034, FLW-25 | draft | 2026-09-09 PARTIAL |
| SCN-051 | Inspect a manager settlement and override it by a new decision | Decisions/authority | P-01 | ST-029, ST-030, FLW-26 | draft | 2026-09-09 FAIL |
| SCN-052 | Read one execution iteration without confusing report and observation | Runs | P-01 | ST-034, ST-037, FLW-27 | draft | 2026-09-09 PARTIAL |
| SCN-053 | Inspect agent history, project history and the target plan as distinct views | Graphs | P-01 | ST-030, ST-035, ST-037, FLW-23, FLW-27 | draft | 2026-09-09 PARTIAL |
| SCN-054 | Trace how a decision changed and what evidence was supplied | Decision history | P-01 | ST-029, ST-034, FLW-28 | draft | 2026-09-09 PARTIAL |
| SCN-055 | Handle what needs attention and read what happened | Inbox | P-01 | ST-028, ST-033, FLW-21, FLW-29 | draft | 2026-09-09 FAIL |
| SCN-056 | Inspect every cycle and the evidence for its state | Cycles | P-01 | ST-030, ST-033, ST-037, FLW-30 | draft | 2026-09-09 PARTIAL |
| SCN-057 | Preview the next context and inspect the exact past pack | Memory/context | P-01 | ST-028, ST-029, ST-034, FLW-31 | draft | 2026-09-09 PARTIAL |
| SCN-058 | Follow evidence through a collapsed interface without losing context | Navigation/disclosure | P-01 | ST-028, ST-034, ST-037, FLW-27, FLW-28, FLW-29, FLW-30, FLW-31 | draft | 2026-09-09 PARTIAL |
| SCN-059 | Reach first value progressively and resume an unfinished draft | Onboarding | P-01 | ST-001, ST-022, ST-023, FLW-32 | draft | 2026-09-09 PARTIAL |
| SCN-060 | Return to existing work across projects without losing scope | Navigation/continuity | P-01 | ST-019, ST-028, ST-032, ST-034, FLW-33 | draft | 2026-09-09 PARTIAL |
| SCN-061 | Choose and replace a manager with visible authority and host readiness | Manager lifecycle | P-01, P-02 | ST-002, ST-006, ST-031, ST-036, ST-037, FLW-34 | draft | 2026-09-09 FAIL |
| SCN-062 | Turn a retrospective episode into a verified lesson and detect regression | Retrospectives | P-01 | ST-028, ST-029, ST-030, ST-033, ST-034, FLW-35 | draft | 2026-09-09 PARTIAL |
| SCN-063 | Inspect service feedback and stop outbound work honestly | Service feedback/privacy | P-01, P-02 | ST-028, ST-033, ST-036, FLW-35 | draft | 2026-09-09 FAIL |
| SCN-064 | Inspect declared storage and import a verified mirror without partial writes | Storage/sync | P-01, P-02 | ST-001, ST-022, ST-028, ST-033, FLW-36 | draft | 2026-09-09 PARTIAL |
| SCN-065 | Restore an archive into a fresh Estate and open it | Backup/recovery | P-01, P-02 | ST-001, ST-028, ST-033, FLW-36 | draft | 2026-09-09 FAIL |
| SCN-066 | Return from authentication to the same invitation with current membership | Membership | P-02, P-03 | ST-008, ST-009, FLW-06 | draft | 2026-09-09 FAIL |
| SCN-067 | Record a first task and distinguish admission from delivery acknowledgement | Task admission | P-01 | ST-023, ST-024, ST-034, ST-037, FLW-32 | draft | 2026-09-09 FAIL |
| SCN-068 | Маршрут работы | Маршрут работы | P-01 | FLW-37; SCR-49 | draft | unobserved |
| SCN-069 | Цели и приёмка | Цели и приёмка | P-01 | FLW-38; SCR-50 | draft | unobserved |
| SCN-070 | Квоты и использование | Квоты и использование | P-01 | FLW-39; SCR-51 | draft | unobserved |
| SCN-071 | Настройки рабочего пространства | Настройки рабочего пространства | P-01 | FLW-40; SCR-52 | draft | unobserved |
| SCN-072 | Уведомления и маршруты | Уведомления и маршруты | P-01 | FLW-41; SCR-53 | draft | unobserved |
| SCN-073 | Диагностика | Диагностика | P-01 | FLW-42; SCR-54 | draft | unobserved |
| SCN-074 | Архив и удаление | Архив и удаление | P-01 | FLW-43; SCR-55 | draft | unobserved |
| SCN-075 | Редактор цикла | Редактор цикла | P-01 | FLW-44; SCR-56 | draft | unobserved |
| SCN-076 | Сервисные терминалы | Сервисные терминалы | P-01 | FLW-45; SCR-57 | draft | unobserved |
| SCN-077 | Встроенный браузер | Встроенный браузер | P-01 | FLW-46; SCR-58 | draft | unobserved |
| SCN-078 | Предпросмотр медиа | Предпросмотр медиа | P-01 | FLW-47; SCR-59 | draft | unobserved |
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
| SCN-093 | Fabric встречает возвращение и отмечает веху, ничего не выдумывая | Manager/Gamification | P-01 | ST-039, ST-029, ST-018, FLW-54, FLW-21 | draft | unobserved |
| SCN-094 | Открыть дашборд как страницу Fabric и прочитать путь до «сейчас» | Manager/Gamification | P-01 | ST-040, ST-039, ST-029, FLW-54, FLW-21 | draft | unobserved |
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
| SCN-126 | First run: name, look, coding agents, where to start | First run | P-01 | ST-001, ST-022, FLW-69 | draft | — |
| SCN-127 | Add an existing project from one folder | Start paths | P-01 | ST-001, ST-031, FLW-70 | draft | — |
| SCN-128 | Scan a projects folder and tick what becomes a Project | Start paths | P-01 | ST-001, ST-031, FLW-71 | draft | — |
| SCN-129 | Create a new project in a new folder or as an idea | Start paths | P-01 | ST-001, FLW-72 | draft | — |
| SCN-130 | Start a new agent inside a project | Start paths | P-01 | ST-050, FLW-73 | draft | — |
| SCN-131 | Convert an agent built elsewhere into a Fabric agent | Start paths | P-01 | ST-050, FLW-74 | draft | — |
| SCN-132 | An external agent asks for access and the operator decides | Hub | P-01 | ST-045, FLW-75 | draft | — |
| SCN-133 | Connect a product to Fabric by the product's own consent | Hub | P-01 | ST-045, FLW-76 | draft | — |

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
- **Telemetry:** `attention_item_opened` with project_id, dimension, receipt_kind
- **Status:** validated
- **Coverage:** `apps/desktop/src/shared/attention.ts`, `apps/desktop/src/renderer/src/launch/ObligationActs.tsx`, `apps/desktop/src/shared/attention.test.ts`
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
- **Telemetry:** `terminal_session_opened` with project_id, cwd_bound, reattach:boolean — no keystroke content, no transcript body
- **Status:** draft
- **Coverage:** `apps/desktop/src/main/pty.ts`, `apps/desktop/src/renderer/src/SessionWindow.tsx`, `apps/desktop/test/pty.test.mjs`
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
- **Status:** draft
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
- **Status:** draft
- **Coverage:** `apps/desktop/src/main/policy.ts`, `apps/desktop/src/renderer/src/launch/ObligationActs.tsx`, `apps/desktop/test/policy.test.mjs`
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
- **Status:** draft
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
     choice is explicit; there is no third path where one silently wins.
- **Expected result:** a file can be edited beside working agents without either side losing
  work by surprise.
- **Alt paths:** the file can be opened in the system editor instead; a file too large to
  open says so rather than hanging. Fabric quits, is stopped or crashes while the file has unsaved
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
- **Coverage:** `apps/desktop/src/main/agentSurface.ts`, `apps/desktop/src/renderer/src/ProjectHome.tsx`
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
- **Coverage:** `apps/desktop/src/shared/ladder.ts`, `apps/desktop/src/renderer/src/components/Board.tsx`, `apps/desktop/test/operating-surfaces.test.mjs`, `ProjectHome.tsx#BoardSection`, `apps/desktop/src/renderer/src/BoardSection.test.tsx`. UX28-04 closed the rejection path and the three rules above; the keyboard move is a native `select` and stays one, which is the card's own exclusion. `draft` rather than `built` because no run has watched an agent move its own card on a live board
- **Product:** unobserved

### SCN-042: Ask the manager, and get an artefact rather than advice
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
  1. Operator opens the home -> "My projects" lists every project once: up to five favourites lead, the rest follow in the operator's own order.
  2. Operator pins a project (★) -> it joins the favourites; at five, pinning a sixth asks which to release rather than silently dropping one.
  3. Operator moves a project up or down (↑ ↓) -> it swaps with its neighbour inside its group (favourites among favourites, the rest among the rest), and the order survives a restart; it changes no task priority.
  4. Operator has one project -> no favourites or order controls are offered, because ranking one of one is ceremony.
- **Expected result:** a portfolio of many does not bury the two being worked today.
- **Alt paths:** an archived favourite leaves the row and says so rather than showing as a dead card.
- **UI elements:** "My projects" on the estate home (SCR-30/SCR-01); ★ and ↑ ↓ on each row; the release prompt at the limit.
- **States covered:** empty (no favourites chosen yet), success
- **Errors & recovery:** a pin that fails to record leaves the row unchanged and reports it. A pin refused because the set is full is NEITHER a failure nor a success — nothing is written and nothing is dropped — and it is reported as its own thing, because a full disk and a full favourites list are not the same news.
- **Telemetry:** planned only.
- **Amended 2026-09-10 (UX28-10):** all three steps and the alt path were right from the day they were written and the contract did none of them. `togglePin` appended without limit, so "up to five" was a sentence here and nothing else; nothing asked which to release; the pin control rendered on every card at any project count; and an archived favourite left the row in silence. The limit and the threshold are numbers in the contract now, `togglePin` returns a RESULT rather than an array — the old signature could only return a list, so a caller had no way to be told "this would be the sixth" — and a replacement is one write, because two would leave a window with four pinned and lose the released one if the second failed. UX28-10 asked whether the threshold is still intended: it is, and this scenario's own reason is why — ranking five of six saves nobody a scroll. That is recorded as a judgement rather than a measurement, since nobody has watched an operator with six projects.
- **Amended 2026-09-29 (launch design SCR-30/SCR-01):** the operator chose the launch prototype (`docs/reports/product.html`) over this scenario's threshold of six, so the threshold is one and the home's "My projects" carries ★ ↑ ↓ on every row, as the design does at four projects. The order of the unpinned projects is a preference of this machine (`project-order.json`), like the pins; a pinned project moves among the pins, whose order is the favourites list itself (`planMove`). The design's sentence under the list says what the order is not: it does not change the priority of any project's tasks.
- **Status:** draft
- **Coverage:** `apps/desktop/src/shared/favourites.ts`, `apps/desktop/src/main/favourites.ts`, `apps/desktop/src/renderer/src/EstateHome.tsx`, `apps/desktop/src/shared/favourites.test.ts`, `apps/desktop/src/renderer/src/halfShipped.test.tsx`. `draft` rather than `built` because no run has watched an operator with more than six projects choose which to release
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
- **Status:** draft
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
- **Coverage:** none yet
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
- **Status:** draft
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
- **Status:** draft
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
- **Status:** draft
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
- **Alt paths:** The operator can stay in the current Estate and open the restored one later. A restore whose reply was lost is looked up by the same operation and returns the same Estate, never a second one. A member who is not the owner of the control Estate cannot restore.
- **UI elements:** archive picker; verification result with reason; restore confirmation naming the new Estate; three result facts; Open this Estate with restart notice.
- **States covered:** empty, verifying, refused, restoring, result-unknown, history-restored, access-verified, opening, opened, denied, error
- **Errors & recovery:** Any failure rolls the whole restore back: no half-created Estate, owner or history. A result that is unknown is checked with the same operation ID. Revoked or changed ownership of the control Estate refuses the restore. The word "backup" is not used until end-to-end restore has been accepted.
- **Telemetry:** no new product telemetry; the operation receipt is the record.
- **Implementation tasks:** A1-3, A1-6 of the [first-slice plan](../evidence/plans/2026-09-27-first-slice-plan.md); S12, S14.
- **Prototype:** [target prototype](../reports/product.html#screen-SCR-48) — fictional fixture; not product coverage.
- **Status:** draft
- **Coverage:** `apps/desktop/src/main/backup.ts` — ordinary archive verification and low-level restore only; no owner wrapper, no UI.
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
- **Implementation tasks:** M18
- **Prototype:** [Интерактивный путь](../reports/product.html#view-pipeline).
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
- **Implementation tasks:** M144
- **Prototype:** [Интерактивный путь](../reports/product.html#view-goals).
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
- **Implementation tasks:** M83, M94
- **Prototype:** [Интерактивный путь](../reports/product.html#view-usage).
- **Status:** draft
- **Coverage:** none yet
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
- **Implementation tasks:** M72, M73, M152
- **Prototype:** [Интерактивный путь](../reports/product.html#view-estate-settings).
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
- **Implementation tasks:** M159, M160, M161, M162, M163, M164, M165
- **Prototype:** [Интерактивный путь](../reports/product.html#view-notifications).
- **Status:** draft
- **Coverage:** none yet
- **Product:** unobserved


### SCN-073: Диагностика
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
- **Implementation tasks:** M81
- **Prototype:** [Интерактивный путь](../reports/product.html#view-diagnostics).
- **Status:** draft
- **Coverage:** none yet
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
- **Implementation tasks:** M77
- **Prototype:** [Интерактивный путь](../reports/product.html#view-archive).
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
- **Implementation tasks:** M66, M67, M68, M90
- **Prototype:** [Интерактивный путь](../reports/product.html#view-routine-editor).
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
- **Implementation tasks:** M74
- **Prototype:** [Интерактивный путь](../reports/product.html#view-internal-browser).
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
- **Implementation tasks:** M75
- **Prototype:** [Интерактивный путь](../reports/product.html#view-media-preview).
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
- **Coverage:** none yet
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
- **Status:** draft
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
- **Status:** draft
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
- **Preconditions:** Before entry, startup verifies the database against the compiled schema range. Missing/invalid packaged build identity, unknown/older/newer schema blocks workspace services before recovery, writes or agent launch. Absent manifest in an unpackaged development run alone may use the compiled range. Identity and provider readiness belong to the estate; source selection belongs to its draft. No source content or persona choice grants write authority.
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
- **Errors & recovery:** Startup schema failure uses the existing native error dialog: safe reason and Retry for a fresh schema observation; an older database names the bundled stack folder, `supabase migration up --local` and the release runbook, requiring stopped writers, verified backup and copy rehearsal before that command; artifact errors require installing/rebuilding and restarting. Retry does not migrate, resume work or imply compatibility. No raw database errors/credentials. The prototype exposes these fixtures only in its review tools, and repeating a failed check stays blocked. Failed/missing executor blocks agent scan only. Permission denial offers choose another folder/retry after access change. URL authentication, unreachable source and invalid URL have local recovery. Cancelled scan cannot later overwrite a newer source. Timeout preserves partial facts and unknown status. Duplicate identity reconciles once; no double project on retry. Re-entry never restarts an uncertain run blindly. Macros/commands/dependency installation found in a repository are not executed during read-only observation.
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
- **Coverage:** none yet
- **Product:** unobserved

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
- **Alt paths:** Another person imports their own file into the same restored Estate independently. Cancelling leaves nothing half-written. A result that is unknown is looked up with the same operation, never repeated blindly.
- **UI elements:** Export private history; Import private history; file picker; verification result with reason; confirmation; result with "nothing will be sent".
- **States covered:** empty, exporting, exported, export-refused, verifying, refused, importing, result-unknown, imported, denied, error
- **Errors & recovery:** Refusals name a fixed reason without showing any message text, digest or path: stale (history changed during export), not this person's history, not this Estate, altered, incomplete, too large, unsupported version, already imported. A failed import leaves the restored Estate usable with private history unavailable. The file is kept until the import result is known.
- **Telemetry:** no new product telemetry; the import receipt is the record.
- **Implementation tasks:** A1-1, A1-2, A1-4, A1-6 of the [first-slice plan](../evidence/plans/2026-09-27-first-slice-plan.md).
- **Status:** draft
- **Coverage:** none yet
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
- **Coverage:** none yet
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

### SCN-126: First run: name, look, coding agents, where to start
- **Persona:** P-01
- **Feature:** First run
- **Traces:** ST-001, ST-022, FLW-69 (JTBD-01, JTBD-02)
- **Entry point:** First launch of an estate with no project, after the project list is known; Help → Walk through the first run again.
- **Preconditions:** The settings file and the project list have been read. `settings.firstRun.completedAt` is null. No step grants authority: the look is a preference, detection runs `--version` only.
- **Steps:**
  1. Operator sees SCR-70 step 1 → types a name for their Fabric (optional; empty keeps "Fabric"), picks a character and a variant; the greeting and avatar update live → Continue saves the look, Skip keeps the default.
  2. Operator sees step 2 → Fabric lists Claude Code and Codex with one state each: ready (installed with its version and connected to Fabric's tools), installed (runs in a folder as itself, not connected — says so), needs setup (installed, `--version` did not answer: run it once in a terminal; no install command), not installed (the vendor's install command and Copy) → Check again re-reads; Continue is labelled "Continue without an agent" when none is ready.
  3. Operator sees step 3 → the five start paths (SCR-71…75 entries) → choosing one opens it; "Later" goes home.
- **Expected result:** The first run is finished once; `settings.firstRun.completedAt` holds the moment; the operator is on the chosen path or home.
- **Alt paths:** Back on steps 2–3; Skip on step 1; Help reopens the first run for an estate that already has projects.
- **UI elements:** Three-step progress; name field with hint and 40-character limit; character choice; variants and "More variants"; executor rows with state pill, path, install command and Copy; five path cards.
- **States covered:** first-visit,saving,not-saved,checking,found,found-unconnected,unresponsive,missing,check-failed,choose-path,skipped
- **Errors & recovery:** A look that is not saved says why and offers Continue without saving. A detection that fails says so and offers Check again. An installation already holding projects is never walked back through the first run; an unknown project list never triggers it.
- **Design rationale:** One question per step, every step skippable; the agent check is information, not a gate, because Fabric itself is useful before an agent is ready.
- **Telemetry:** planned only.
- **Status:** draft
- **Coverage:** apps/desktop/src/renderer/src/start/FirstRun.tsx; apps/desktop/src/renderer/src/start/StartPaths.test.tsx
- **Product:** unobserved

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
- **Status:** draft
- **Coverage:** apps/desktop/src/renderer/src/start/StartPaths.tsx; apps/desktop/src/main/projectDiscovery.ts; apps/desktop/test/project-discovery.test.mjs
- **Product:** unobserved

### SCN-128: Scan a projects folder and tick what becomes a Project
- **Persona:** P-01
- **Feature:** Start paths
- **Traces:** ST-001, ST-031, FLW-71 (JTBD-01)
- **Entry point:** Start menu → Scan a projects folder; first run step 3; the start card's "N not added yet".
- **Preconditions:** The parent folder is chosen in this window's picker. The scan is read-only.
- **Steps:**
  1. Operator selects Choose a folder to scan → the picker opens.
  2. Fabric walks the folder breadth first (bounded, cancellable; does not enter dependency trees, build output and similar folders unless one is itself a repository; never hidden folders or symlinks out of it; git runs with config-driven programs off) → SCR-72 lists every repository with name, last commit, stack and its path relative to the folder, grouped by product (a worktree under its repository, a nested repository under its parent).
  3. Operator filters and ticks (Tick all shown ticks the head of each product; a worktree or nested part is ticked only by hand and then warns that it becomes a separate Project; Clear) → Add N as projects (sticky at the bottom) creates one Project per ticked repository, in order, showing each row's result and a failed row's reason.
  4. Operator sees the summary → Open the first one, or leaves the unticked ones for later.
- **Expected result:** One Project per ticked repository; nothing created for an unticked one; the last scan is kept so unticked candidates can be imported later.
- **Alt paths:** Stop during the scan returns to the start and says nothing was added. Scan again opens the picker at the same folder. Leaving the screen stops a running scan. An already-imported repository is marked "In <project>", cannot be ticked, and opens that project. The kept last scan is shown when the path opens; it is not a grant.
- **UI elements:** Choose a folder to scan; scanning with Stop; summary (count, parts of another repository, folder, date); truncation notice; filter; group heads; candidate rows with checkbox, pills and in-project link; Add N as projects; per-row added/not added.
- **States covered:** idle,picker-cancel,scanning,cancelled,results,empty,truncated,unreadable,deep,symlinks,kept-unreadable,not-kept,no-match,duplicate,part-ticked,importing,partial,imported,failed
- **Errors & recovery:** A walk stopped by its bound says the list is not the whole folder; folders that could not be read — and repositories whose inspection failed — are counted as a gap. Folders deeper than the scan goes, and linked folders it does not follow, are counted and said, with how to reach a repository there; Stop leaves the scanning state at once and a late answer is ignored; a kept list that cannot be read is said. A row that failed to import shows its reason, stays ticked, and Add retries it with the same id. A scan error says why and offers to choose again.
- **Design rationale:** Nothing becomes a Project without the operator's tick; Tick all shown ticks one Project per product, so a worktree becomes a separate Project only by a deliberate, warned tick.
- **Telemetry:** planned only.
- **Status:** draft
- **Coverage:** apps/desktop/src/renderer/src/start/StartPaths.tsx; apps/desktop/src/main/projectDiscovery.ts; apps/desktop/src/main/startPaths.ts
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
- **Telemetry:** planned only.
- **Status:** draft
- **Coverage:** apps/desktop/src/renderer/src/Onboarding.tsx; apps/desktop/src/main/projectFolder.ts; apps/desktop/src/main/startChoices.ts
- **Product:** unobserved

### SCN-130: Start a new agent inside a project
- **Persona:** P-01
- **Feature:** Start paths
- **Traces:** ST-050, FLW-73 (JTBD-05)
- **Entry point:** Start menu → New agent; first run step 3.
- **Preconditions:** An agent belongs to a project (CONTEXT: an Agent is a provider revision bound into one project).
- **Steps:**
  1. Operator sees the projects → chooses one.
  2. Fabric opens that project's team (`#sec-agents`) and reads the agents created in it before saying there are none.
  3. Operator opens Create an agent → name, what it is for, the coding agent it runs in (those not available on this computer are listed, disabled), the servers it needs from those the project grants → Create the agent.
  4. Fabric confirms "Created <name>." and lists the agent with what it reaches (M125).
- **Expected result:** The agent exists in that project, named once, reaching only the servers it asked for.
- **Alt paths:** With no project, the path offers Add a project and New project. An agent made by asking the CEO is SCN-121.
- **UI elements:** Project choice; no-project notice with the two paths; the team's agent list; the create form with its field hints.
- **States covered:** loading,no-project,choose-project,reading,unreadable,empty,invalid,saving,failed,created
- **Errors & recovery:** An unknown project list shows loading, never "no project". An unreadable agent list says so in place with Try again, never "none yet". A taken or too-long name and a too-short purpose are named under their field before the click; no available program is said, not hidden. A refused create keeps everything typed and shows the reason in the form; the project holds one agent per name, checked by the form and again by the handler.
- **Design rationale:** One place creates agents; the start path only routes to it, and the form shares its limits with the handler (`shared/agentSpec.ts`).
- **Telemetry:** planned only.
- **Status:** draft
- **Coverage:** apps/desktop/src/renderer/src/start/StartPaths.tsx, apps/desktop/src/renderer/src/CreatedAgents.tsx
- **Product:** unobserved

### SCN-131: Convert an agent built elsewhere into a Fabric agent
- **Persona:** P-01
- **Feature:** Start paths
- **Traces:** ST-050, FLW-74 (JTBD-05)
- **Entry point:** Start menu → Convert an agent (shown as planned).
- **Preconditions:** Designed by ADR-0100 §6; built by AR-7/AR-11. Until then the path explains itself and offers no action.
- **Steps:**
  1. Operator chooses the agent's folder → Fabric reads it and nothing else.
  2. Fabric shows a dry-run plan: the manifest, the MCP entry, every file that would change.
  3. Operator approves → their coding agent writes the adapter on its own branch with the Fabric Agent Adapter skills; the main branch is not touched.
  4. The conformance probe runs → green: the agent enters the registry; red: the findings, and the branch stays for another attempt.
- **Expected result:** A Fabric-compatible agent in the registry, with the probe's receipt; or a red receipt and no registry entry.
- **Alt paths:** Today (planned state): install the adapter skills with the launcher and ask the coding agent to adapt the project (SCN-015 recipe model).
- **UI elements:** Planned pill; four-step explanation; today's command.
- **States covered:** planned
- **Errors & recovery:** Not applicable while planned; the screen never offers an action that pretends to run.
- **Design rationale:** The operator approves a plan before any write; the probe, not the author, decides compatibility.
- **Telemetry:** planned only.
- **Status:** draft
- **Coverage:** apps/desktop/src/renderer/src/start/StartPaths.tsx (the planned screen only; the conversion itself is not built — AR-11)
- **Product:** unobserved

### SCN-132: An external agent asks for access and the operator decides
- **Persona:** P-01
- **Feature:** Hub
- **Traces:** ST-045, FLW-75 (JTBD-08)
- **Entry point:** An agent registered on this Mac (a `services/` descriptor or a `providers/` entry) reads `hub.json`, takes the door token from the file it names, and calls `fabric.access.request` on Fabric's MCP ([ADR-0115](../adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md) §2). Before it sends a binding credential it re-reads `hub.json` and checks that the `pid` there is alive: while Fabric is down any program can hold the port (the tools' descriptions say so).
- **Preconditions:** Fabric is running and its hub is listening; the agent's id resolves in the registry.
- **Steps:**
  1. The agent asks for capabilities on resources of a product, with its reason → Fabric reads the registry; an id it does not resolve is refused before anything is shown.
  2. With a Fabric window in front (shown and focused), a native prompt opens over it, in the operator's language (English or Russian, from Settings): the agent's registry name and id, who installed it and where it came from, what it asks in the product's words ("list and search mail and read mail in news@example.com"; a tool that sends mail says so, and a tool Fabric does not know is said to be unknown), its reason quoted as its own claim on one line, and the same-user floor ("an agent registered as example-agent"). Deny is the default. Nothing the agent or its descriptor wrote can start a line of its own or reorder the text: line breaks, control and bidirectional characters are removed.
  3. With Fabric in the background — hidden, minimised, or open behind another app — a notification says who asks; the request waits in the queue (SCR-41) with the prompt's own facts as a block — who installed it and where it came from, what it asks, its reason, the same-user floor, whether it adds to existing access, that access lasts a year unless revoked — and Deny and Allow below them; clicking the notification, or bringing Fabric's window forward, shows the same prompt. Settings → Agent access (SCR-76) shows the same facts in a card per request, with when the request expires, beside its Allow. Long mailbox names wrap in full before Allow; its accessible name contains the visible “Allow and connect” words. Answering one queue request reloads the board and keeps a named result; choosing another request shows its own Allow/Deny. Keyboard focus moves to the decision result or the affected Settings section. Every one of these words is in the operator's language; machine details appear on their own secondary line, and the agent's own words (its reason, its name) are quoted as they are.
  4. Operator allows → the agent's next status read carries its credential once; its calls are checked against the grants (one capability on one mailbox each, a year unless revoked).
  5. Operator later opens Settings → Agent access (SCR-76) → sees the agent and each grant in plain words → revokes one, or all → the next call is refused.
- **Expected result:** The agent works within what was allowed, nothing wider; every decision and every call is in the journal.
- **Alt paths:** A pending-state read owns the single prompt slot before awaiting; simultaneous requests remain queued. Expiry is checked again after that read. Losing window focus while it waits keeps a live request queued until focus/resume, without opening a background sheet. Standing denials remain authoritative and visible to clear beyond a display-page boundary; a failed or oversized read refuses rather than prompting again.  Deny → the same request is answered "denied" without a prompt until the operator clears the denial in SCR-76. Nobody answers within 10 minutes → expired; the agent asks again. An agent that already has access asks for more → a new prompt says it adds to existing access; asking again for something it already holds extends that grant rather than adding a second one. The product is not connected yet → the prompt's, the queue's and SCR-76's Allow all read "Allow and connect Fabric Inbox" and start SCN-133; if Fabric Inbox cannot be opened, the Allow stands and Fabric says so beside it ("Allowed. Fabric Inbox did not connect: Fabric Inbox could not be opened …") — in the prompt as a follow-up message, in the queue and SCR-76 as a line, never as a failed Allow. An Allow nobody collects within 10 minutes of the decision gives no credential; the agent asks again. Creating an address that forwards its mail elsewhere, or that a reply agent answers, is asked for as its own line ("when creating news@example.com, also forward a copy of its mail…") and granted per address; without that grant the call is refused and nothing is sent.
- **UI elements:** native prompt (Deny, Allow); notification; queue row with the prompt's facts, Allow and Deny; SCR-76 lists.
- **States covered:** loading,unreadable,hub-off,waiting,prompt,notified,allowed,denied,expired,revoked
- **Errors & recovery:** An unreadable access list is said in SCR-76 with Try again, never "no agent has access", and without the transport's wording. A decision on an expired or already answered request is refused, and the refusal is said in the operator's language. A mailbox with an invisible or look-alike character (not printable ASCII) is refused before any prompt, so what is shown is exactly what is granted. A hub whose port is taken says why in SCR-76; sessions Fabric starts keep working.
- **Design rationale:** One prompt per request, not per call — fatigue makes Allow reflexive (ADR-0115, rejected alternatives); the prompt states what Fabric can and cannot prove.
- **Telemetry:** journal events `access.requested@1`, `access.decided@1`, `access.credential.claimed@1`, `access.grant.revoked@1`, `access.binding.revoked@1`, `access.denial.cleared@1`, `hub.call.forwarded@1`.
- **Status:** draft
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
- **Errors & recovery:** SCR-76 accepts only the newest eligible overview: an act invalidates older reads before changing state; polling waits through the act and its fresh read. Late successes/errors or completions after panel cleanup cannot restore stale connections; a current read failure remains unreadable, never empty.  Fabric answers the product within its 10 seconds or not at all: the whole delivery runs inside one 8-second deadline. The secret is stored first, in a vault slot of its own (named by the estate and the connection, so two estates on one Mac never share one), and only then is the connection recorded and the product told yes. Without Project Observatory, with a vault that refuses, or past the deadline, nothing is recorded, the previous connection stays as it was, the product revokes the new key, and SCR-76 says why. A record that itself lands after the deadline is withdrawn at once; on a Reconnect the previous connection had already been replaced by it, so SCR-76 says Fabric Inbox is not connected now and to connect again. An invalid delivery settles its single pending attempt as failed immediately; a browser Origin cannot cancel consent. A late record that could not be withdrawn says the recorded connection will not work and to disconnect then connect again. A hub that is not listening disables Connect and Reconnect and gives the remedy for its own cause (invalid setting, registered-agent port claim, another listener, or startup failure) in the operator's language; machine observations are a secondary line.
- **Design rationale:** The product's own app asks, so "keys are issued by a person in the app" still holds; Fabric holds one credential per product and never hands it to an agent (ADR-0115 §4, §6).
- **Telemetry:** journal events `product.connected@1`, `product.disconnected@1`, `product.connect.refused@1` (the product's own Deny or failure).
- **Status:** draft
- **Coverage:** apps/desktop/src/main/productConnect.ts, apps/desktop/src/main/observatoryVault.ts, apps/desktop/src/renderer/src/AgentAccessPanel.tsx
- **Product:** unobserved

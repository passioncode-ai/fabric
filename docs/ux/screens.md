# UI Screen Registry

<!-- Managed with super-ux (ux-contract v4). The design map: every screen and
state with its Figma frame, wireframe, code coverage, and related UX/UI
resources. Update in the same change as any interface change; when Figma is
enabled, update the frame and re-verify its link in the same change. A screen
whose code diverges from its record here is a "drifted" finding. -->

## First-release target precedence · 2026-09-25

The R0 route family below supersedes earlier mandatory name/purpose/review entry layouts. Existing native evidence and dated layouts remain historical; this revision is target design only. The shared CEO panel is a right overlay, not a layout-shifting column. First launch enters r0-setup; saved ready CEO enters r0-source for another project. The release map r0-map excludes later catalog capabilities while preserving their original addresses.

## Index

| ID | Screen | Used by | Figma | Status | Coverage |
|---|---|---|---|---|---|
| SCR-01 | Estate projects | FLW-01, FLW-04 | none — text-only | built | `apps/desktop/src/renderer/src/EstateHome.tsx` |
| SCR-02 | Create project | FLW-01 | none — text-only | built | `apps/desktop/src/renderer/src/Onboarding.tsx` |
| SCR-03 | Project overview | FLW-01, FLW-04, FLW-05 | none — text-only | built | `apps/desktop/src/renderer/src/ProjectHome.tsx` |
| SCR-04 | Agents | FLW-01, FLW-02 | none — text-only | designed | none yet |
| SCR-05 | Agent catalog and setup | FLW-02 | none — text-only | designed | none yet |
| SCR-06 | Connections | FLW-01, FLW-03 | none — text-only | designed | none yet |
| SCR-07 | Connect account | FLW-03 | none — text-only | designed | none yet |
| SCR-08 | Runs and schedule | FLW-04 | none — text-only | designed | none yet |
| SCR-09 | Run detail | FLW-04 | none — text-only | designed | none yet |
| SCR-10 | Reports and findings | FLW-05 | none — text-only | designed | none yet |
| SCR-11 | Proposal review | FLW-05 | none — text-only | designed | none yet |
| SCR-12 | Project settings | FLW-01, FLW-02 | none — text-only | designed | none yet |
| SCR-13 | Role workspace | FLW-06, FLW-08 | none — text-only | designed | none yet |
| SCR-14 | Membership and interaction detail | FLW-06 | none — text-only | designed | none yet |
| SCR-15 | Agent foundry and bootstrap | FLW-07 | none — text-only | designed | none yet |
| SCR-16 | Conformance and admission | FLW-07 | none — text-only | designed | none yet |
| SCR-17 | Workspace editor | FLW-08 | none — text-only | designed | none yet |
| SCR-18 | Support inbox | FLW-09 | none — text-only | designed | none yet |
| SCR-19 | Work graph and release | FLW-10 | none — text-only | designed | none yet |
| SCR-20 | Content cycle | FLW-11 | none — text-only | designed | none yet |
| SCR-21 | MCP access | FLW-12 | none — text-only | designed | none yet |
| SCR-22 | MCP access detail | FLW-12 | none — text-only | designed | none yet |
| SCR-23 | Hosted terminal | — | none — text-only | retired | none — superseded by SCR-25 |
| SCR-24 | Approval queue | FLW-14, FLW-21 | none — text-only | designed | none yet |
| SCR-25 | Session window | FLW-16, FLW-94, FLW-95, FLW-96, FLW-98 | none — text-only | built | `apps/desktop/src/renderer/src/SessionWindow.tsx` |
| SCR-26 | Workspace canvas | FLW-17 | none — text-only | built | `apps/desktop/src/renderer/src/Workspace.tsx` |
| SCR-27 | Onboarding | FLW-18, FLW-32 | none — text-only | built | `apps/desktop/src/renderer/src/Onboarding.tsx` |
| SCR-28 | Editor window | FLW-19 | none — text-only | designed | none yet |
| SCR-29 | Public landing page | FLW-20 | none — repository-first | designed | static site |
| SCR-30 | Estate home | FLW-21, FLW-32, FLW-33 | none — text-only | built | `apps/desktop/src/renderer/src/launch/LaunchShell.tsx` |
| SCR-31 | Project page | FLW-21, FLW-22, FLW-23, FLW-24, FLW-32, FLW-33 | none — text-only | built | `apps/desktop/src/renderer/src/launch/ProjectLaunch.tsx` |
| SCR-32 | Task page | FLW-22, FLW-23, FLW-32, FLW-33, FLW-95, FLW-100 | none — text-only | built | `apps/desktop/src/renderer/src/TaskPage.tsx` |
| SCR-33 | Decision history (target; legacy preview remains) | FLW-21, FLW-26, FLW-28 | none — text-only | designed | none yet |
| SCR-34 | Project memory | FLW-21, FLW-22, FLW-31, FLW-34, FLW-35, FLW-36 | none — text-only | built | `apps/desktop/src/renderer/src/MemoryOverviewSection.tsx` |
| SCR-35 | Project harness | FLW-24 | none — text-only | built | `apps/desktop/src/renderer/src/HarnessSection.tsx` |
| SCR-36 | Estate record | FLW-21 | none — text-only | built | `apps/desktop/src/renderer/src/ProfileSection.tsx` |
| SCR-37 | Search results | FLW-21 | none — text-only | built | `apps/desktop/src/renderer/src/SearchPanel.tsx` |
| SCR-38 | Harness tool | FLW-24 | none — text-only | designed | none yet |
| SCR-39 | Estate agents | FLW-21, FLW-27 | none — text-only | built | `apps/desktop/src/renderer/src/launch/AgentsScreen.tsx` |
| SCR-40 | Graph explorer family | FLW-23, FLW-27 | none — text-only | built | `apps/desktop/src/renderer/src/launch/PlanScreen.tsx` |
| SCR-41 | Ranked Board and question detail | FLW-25, FLW-26, FLW-27, FLW-28, FLW-29, FLW-75, FLW-99 | none — text-only | built | `apps/desktop/src/renderer/src/launch/BoardScreen.tsx` |
| SCR-42 | Inbox | FLW-21, FLW-29 | none — text-only | retired | none yet |
| SCR-43 | Cycles | FLW-30 | none — text-only | designed | none yet |
| SCR-44 | Manager lifecycle | FLW-34 | none — text-only | designed | none yet |
| SCR-45 | Retrospectives | FLW-35 | none — text-only | retired | none yet |
| SCR-46 | Service feedback settings | FLW-35 | none — text-only | designed | none yet |
| SCR-47 | Storage and sync | FLW-36 | none — text-only | designed | none yet |
| SCR-48 | Restore | FLW-36 | none — text-only | designed | `apps/desktop/src/main/backup.ts` |
| SCR-49 | Маршрут работы | FLW-37 | none — interactive HTML | designed | none yet |
| SCR-50 | Цели и приёмка | FLW-38 | none — interactive HTML | designed | none yet |
| SCR-51 | Квоты и использование | FLW-39 | none — interactive HTML | designed | none yet |
| SCR-52 | Настройки рабочего пространства | FLW-40 | none — interactive HTML | built | `apps/desktop/src/renderer/src/launch/SettingsScreen.tsx` |
| SCR-53 | Уведомления и маршруты | FLW-41 | none — interactive HTML | designed | none yet |
| SCR-54 | Диагностика | FLW-42 | none — interactive HTML | retired | none yet |
| SCR-55 | Архив и удаление | FLW-43 | none — interactive HTML | designed | none yet |
| SCR-56 | Редактор цикла | FLW-44 | none — interactive HTML | designed | none yet |
| SCR-57 | Сервисные терминалы | FLW-45 | none — interactive HTML | designed | none yet |
| SCR-58 | Встроенный браузер | FLW-46 | none — interactive HTML | designed | none yet |
| SCR-59 | Предпросмотр медиа | FLW-47 | none — interactive HTML | designed | none yet |
| SCR-60 | Diff выбранного файла | FLW-48 | none — interactive HTML | designed | none yet |
| SCR-61 | Документ и происхождение задач | FLW-49 | none — interactive HTML | designed | none yet |
| SCR-62 | Аккаунты ИИ | FLW-50, FLW-52 | none — existing paperclip prototype | designed | none yet |
| SCR-63 | Продолжить разговор с другим аккаунтом | FLW-51, FLW-52 | none — existing paperclip prototype | designed | none yet |
| SCR-64 | CEO conversation | FLW-57, FLW-24 | none — interactive HTML | designed | `apps/desktop/src/main/ceoConversationService.ts` |
| SCR-65 | Private history | FLW-58 | none — interactive HTML | designed | none yet |
| SCR-66 | MCP servers | FLW-60 | none — text spec | designed | none yet |
| SCR-67 | Run trace | FLW-65 | none — text spec | designed | none yet |
| SCR-68 | Fabric tools | FLW-66 | none — text spec | designed | none yet |
| SCR-69 | Optimizer proposals | FLW-66 | none — text spec | designed | none yet |
| SCR-70 | First run | FLW-69, FLW-82 | none — text spec | built | apps/desktop/src/renderer/src/start/ |
| SCR-71 | Add a project | FLW-70, FLW-98 | none — text spec | built | apps/desktop/src/renderer/src/start/ |
| SCR-72 | Scan a projects folder | FLW-71, FLW-69, FLW-98 | none — text spec | built | apps/desktop/src/renderer/src/start/ |
| SCR-73 | New project | FLW-72, FLW-98 | none — text spec | built | apps/desktop/src/renderer/src/Onboarding.tsx |
| SCR-74 | Create an agent | FLW-73, FLW-98 | none — text spec | built | apps/desktop/src/renderer/src/start/AgentPaths.tsx |
| SCR-75 | Adapt an existing agent | FLW-74 | none — text spec | built | apps/desktop/src/renderer/src/start/AgentPaths.tsx |
| SCR-76 | Agent access | FLW-75, FLW-76 | none — text spec | built | apps/desktop/src/renderer/src/AgentAccessPanel.tsx |
| SCR-77 | Setup: coding agents and products | FLW-78, FLW-79, FLW-69 | none — text spec | designed | none yet |
| SCR-78 | Where work is | FLW-81, FLW-80 | none — text spec | built | apps/desktop/src/renderer/src/launch/WhereWorkScreen.tsx |
| SCR-79 | Fabric button in a product | FLW-82 | none — text spec | blocked | none yet |
| SCR-80 | Start a working session | FLW-82 | none — text spec | designed | none yet |
| SCR-81 | Project comms | FLW-83 | none — text spec | built | apps/desktop/src/renderer/src/launch/CommsScreen.tsx |
| SCR-82 | Pause sheet | FLW-91 | none — text spec | designed | none yet |
| SCR-83 | Project directory | FLW-92 | none — text spec | designed | none yet |
| SCR-84 | Rail | FLW-93 | none — interactive HTML | built | `apps/desktop/src/renderer/src/launch/LaunchShell.tsx` |
| SCR-85 | Главная | FLW-93, FLW-94 | none — interactive HTML | built | apps/desktop/src/renderer/src/EstateHome.tsx |
| SCR-86 | Проект | FLW-93, FLW-94, FLW-95, FLW-98 | none — interactive HTML | built | `apps/desktop/src/renderer/src/launch/ProjectLaunch.tsx` |
| SCR-87 | Агенты | FLW-93, FLW-95, FLW-96, FLW-98 | none — interactive HTML | built | `apps/desktop/src/renderer/src/launch/AgentsScreen.tsx` |
| SCR-88 | История | FLW-93, FLW-95, FLW-97 | none — interactive HTML | built | `apps/desktop/src/renderer/src/launch/HistoryScreen.tsx` |
| SCR-89 | Настройки | FLW-40, FLW-93 | none — interactive HTML | built | apps/desktop/src/renderer/src/launch/SettingsScreen.tsx |
| SCR-90 | Создать | FLW-93, FLW-96, FLW-98 | none — interactive HTML | built | `apps/desktop/src/renderer/src/start/StartPaths.tsx` |

## Design system

- **Style pack:** `paperclip` (SHELEG), adopted 2026-08-31 — see `foundation.md` → Design tooling
- **Figma file:** «Fabric», SSHLG team — [`jYWp36tCEe9lxM0INAyXW2`](https://www.figma.com/design/jYWp36tCEe9lxM0INAyXW2) (0.4.0 REQ-43, created 2026-10-11; to be moved into the folder «PassionCode», one file per product). 14 pages: cover and index, foundations (153 variables from `tokens.passioncode.css`, `tokens.app.css`, `tokens.paperclip.css`, dark default and light), 30 components bound to variables, and 293 frames named `SCR-xx · <screen> · <state>` for every 0.4.0 screen and state in this file; what is not drawn and why is on its cover page. It is the target the screens wave builds to; this file stays the source of truth
- **Tokens in code:** `apps/desktop/src/renderer/src/tokens.paperclip.css` (pack, verbatim) + `tokens.app.css` (semantic aliases); enforced by `scripts/check-design.mjs`
- **Component source:** none yet
- **Assets:** none yet

<a id="launch-chrome"></a>
### Launch chrome — the scope bar and the Fabric strip (0.3.3 UI pass, 2026-10-08)

The frame every launch screen shares, matched to the prototype (`scripts/product/report-template.html`,
`scripts/product/controller.js`, `scripts/product/launch.mjs`, `scripts/product/pulse.mjs`) and owned by
`apps/desktop/src/renderer/src/launch/LaunchShell.tsx` and `launch/FabricStrip.tsx`:

- **Scope bar:** breadcrumb, then **Search** and **Profile**. Profile opens SCR-36 «Ваш Fabric» (the
  prototype's `view-profile` is SCR-36) and is marked current while it is open.
- **«Обсудить с Fabric»** under the scope bar on every launch screen except Home, the start paths (and the
  first run) and Help — the screens that already are the start of that conversation — and the guide, whose card
  carries its own beside the project it is about; settings and a draft tab are not launch screens. It opens the
  CEO chat. The set is `NO_DISCUSS` in `launch/LaunchShell.tsx`.
- **Fabric strip:** face, name, the newest journal event in the scope, and «Пульс», on Board, Pulse,
  Releases, Planning, Project and Agent. Estate scope says «все проекты», project scope names the project;
  before the journal has answered it says it is reading, and an empty journal says nothing is recorded yet.
  The board keeps its own reading time (the board read's `asOf`), so its line says «последнее наблюдение».
- **Stack exposure warning** (SCN-073 amendment of 2026-10-06), when it stands: the risk in one sentence,
  one row per container engine with the command as code and a copy button, and why Fabric cannot fix it
  itself behind a disclosure.

Not drawn, on purpose: the agent screen's «История на графе» — the prototype sends it to SCR-40's
agent-history graph, which the app does not have yet; a button to the project's history would be a
different destination under the same name.

## Web surfaces

- **Web surfaces:** yes — `https://passioncode.ai/` is the public, static,
  English-primary landing page, with source in
  `passioncode-ai/passioncode-ai.github.io`.
- **Marketing calibration:** `DESIGN_VARIANCE 7 · MOTION_INTENSITY 3 · VISUAL_DENSITY 4`.
  The approved PassionCode.ai brand tokens and mark replace a generic style pack for this
  surface. Motion is omitted in v1, so the implemented intensity is intentionally calm.

## Screens

### SCR-01: Estate projects
- **0.3.7 target (2026-10-17, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** the estate's projects list moves to the rail (SCR-84) and to Главная's «Проекты» (SCR-85).
- **Used by:** FLW-01 entry; FLW-04 steps 1–2
- **Purpose:** let the operator compare projects and find the next exception without opening provider dashboards.
- **Elements:** project cards with name, purpose, primary repository and live-session count; the estate activity feed; **New project** / **Create the first project** primary action.
- **Not built (kept as design intent):** search/filter, PM identity, independent health dimensions, last/next run, last report — none exist in the desktop app.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | projection loading/reconnecting | none | stable card skeletons and last projection timestamp |
  | empty | no projects | none | explains projects and offers Create project |
  | error | projection unavailable | none | preserves last sourced projection as stale and offers retry |
  | success | projection available | none | cards sort by attention then operator preference; every health fact opens its receipt |
- **Coverage:** `apps/desktop/src/renderer/src/EstateHome.tsx`
- **Scenarios:** SCN-001, SCN-006, SCN-007
- **Resources:** `schemas/project-dashboard.schema.json`; durable read-model projector
- **Status:** designed

### SCR-02: Create project
- **Used by:** FLW-01 steps 1–2
- **Purpose:** capture purpose and choose a starter without turning it into a permanent type.
- **Elements:** name; purpose; empty/software/portfolio/content/support starter radios; recommended-agent/routine preview; **Continue** primary action; cancel. Saved setup and managed activation are distinct under ADR-0061; preview creates no admitted binding.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | success | valid input | none | starter preview names every seeded object and remains editable |
  | error | name/purpose missing or duplicate id | none | inline error; all input preserved |
- **Coverage:** none yet
- **Scenarios:** SCN-001, SCN-002
- **Resources:** project template registry; `schemas/project-blueprint.schema.json`
- **Status:** designed

### SCR-03: Project overview
- **Amended 2026-08-31:** this screen is the content of a project tab. It leads with the Task
  block (instruction, agent, Run, presets and task history), then the Agents grid, then
  collapsed Files and Workflows; the right column carries Repositories, the workspace entry
  (SCR-26), Memory and the project journal. A narrow statistics strip under the header
  navigates to those sections rather than only displaying counts. Sessions open in SCR-25 and
  files in SCR-28, never inside this screen.
- **Used by:** FLW-01 success; FLW-04 step 2; FLW-05 success; FLW-15/16/17
- **Purpose:** show one project's accountable organisation and current state.
- **Elements:** purpose/scope/config revision; PM; attention queue; active agents and work; independent health dimensions; repository status when bound; current goals; next routines; recent reports/proposals; **Open attention item** primary action; secondary navigation to Work, Agents, Runs, Schedule, Connections, Reports, Memory, Settings.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | projection loading | none | section skeletons retain navigation |
  | error | one source unavailable | none | only the affected dimension becomes stale/error with receipt and recovery |
  | success | projection available | none | status facts link to observations/traces; `not-configured` is neutral |
- **Coverage:** `apps/desktop/src/renderer/src/ProjectHome.tsx`, `apps/desktop/src/renderer/src/Tasks.tsx`, `apps/desktop/src/renderer/src/components/FileTree.tsx`
- **Scenarios:** SCN-001, SCN-007, SCN-011
- **Resources:** project detail projection; proposal inbox
- **Status:** designed

### SCR-04: Agents
- **Used by:** FLW-01 review; FLW-02 entry/success
- **Purpose:** manage project membership separately from provider registration.
- **Elements:** exactly-one PM row; optional agent rows with role, provider/binding revision, status, capabilities, routines, connection access, grants, last/next run; **Add agent** primary action; replace, disable, retire.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | empty | saved setup or project draft has unresolved PM | none | blocks activation and opens PM selection |
  | error | PM missing, provider unadmitted or binding invalid | none | names the independent failed gate and recovery |
  | success | bindings valid | none | replacement preview shows future-runs-only effect |
- **Coverage:** none yet
- **Scenarios:** SCN-001, SCN-003, SCN-004
- **Resources:** Fabric Agent Contract binding/admission records
- **Status:** designed

### SCR-05: Agent catalog and setup
- **Used by:** FLW-02 steps 1–2
- **Purpose:** choose a compatible provider for a needed project capability and expose its admission state.
- **Elements:** role/capability search; provider cards; profile (MCP/A2A/local runner); contract/admission revision; health; terminal/runtime; cost hint; **Use this provider** primary action; conformance detail.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | registry query | none | keeps selected role/capability visible |
  | empty | no admitted provider | none | offers compatible-provider instructions without inventing a fallback |
  | error | registry or admission unavailable | none | no project binding can be created; retry/detail available |
  | success | providers returned | none | admitted and merely discovered providers are visually distinct |
- **Coverage:** none yet
- **Scenarios:** SCN-003, SCN-004
- **Resources:** Fabric Agent Contract registry/admission; `fabric-agent-adapter`
- **Status:** designed

### SCR-06: Connections
- **Used by:** FLW-01 connection step; FLW-03 entry/success
- **Purpose:** show estate accounts as narrowed project resource bindings without revealing credentials.
- **Elements:** provider/account subject; connection health; binding revision; selected resources; access ceiling; eligible agents; last collector run; **Connect or reuse account** primary action; edit/disable binding.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | connection/health query | none | account subjects and previous state remain visible as stale |
  | empty | no bindings | none | explains account reuse and least privilege |
  | error | OAuth expired, resource removed or collector failing | none | affected binding names reconnect/reselect recovery |
  | success | bindings valid | none | resource and agent allowlists are explicit; secrets never render |
- **Coverage:** none yet
- **Scenarios:** SCN-001, SCN-005
- **Resources:** connection service; credential-vault references; connector health
- **Status:** designed

### SCR-07: Connect account
- **Used by:** FLW-03 steps 1–4
- **Purpose:** establish or reuse one estate connection and create one scoped project binding.
- **Elements:** existing connections; provider OAuth action; returned account subject; resource selectors; read/draft/effect access radios; eligible-agent checkboxes; **Bind selected resources** primary action; disconnect candidate.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | OAuth redirect/resource discovery | none | progress names provider and preserves project draft |
  | error | OAuth denied/expired, unexpected account, no resources or save failure | none | precise recovery; no candidate connection is silently retained |
  | success | account verified and selections valid | none | review shows account subject, resources, ceiling and agents before save |
- **Coverage:** none yet
- **Scenarios:** SCN-005
- **Resources:** provider OAuth; resource discovery APIs
- **Status:** designed

### SCR-08: Runs and schedule
- **Used by:** FLW-04 steps 2–3
- **Purpose:** unify immutable run history and future routine ticks without putting schedules on agents.
- **Elements:** running/waiting/failed filters; timeline/table; routine name and revision; assigned agent; trigger; next tick; concurrency/catch-up; result status; **Open run** primary action; routine enable/pause/edit.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | history/schedule loading | none | current filter and last timestamp retained |
  | empty | no runs/routines for filter | none | distinguishes no routines from no matching history |
  | error | scheduler or trace store unavailable | none | independent section error and retry; existing rows remain stale |
  | success | data available | none | next run is derived from routine and current preferred agent binding |
- **Coverage:** none yet
- **Scenarios:** SCN-008, SCN-009
- **Resources:** routine scheduler; run/trace store
- **Status:** designed

### SCR-09: Run detail
- **Used by:** FLW-04 steps 3–5
- **Purpose:** let the operator judge an execution from typed evidence before terminal detail.
- **Elements:** run state/timeline; pinned project, routine, graph, agent/provider and binding revisions; input snapshot; done/proof/scope/notVerified/artifacts; checker verdict; costs; errors; expandable terminal trace; **contextual recovery action** primary; cancel/pause/retry/grant actions.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | live trace reconnect | none | durable last event remains with reconnect status |
  | error | missing receipt, failed/cancelled run or unauthorised action | none | separates run failure from unavailable evidence and preserves partial artifacts |
  | success | running or terminal record available | none | monotonic event feed resumes; result remains the summary source |
- **Coverage:** none yet
- **Scenarios:** SCN-007, SCN-008
- **Resources:** Fabric result envelope; durable trace/event store
- **Status:** designed

### SCR-10: Reports and findings
- **Used by:** FLW-05 entry
- **Purpose:** review outputs from observers, analysts, QA, support, SEO and other project agents.
- **Elements:** type/source/target/severity/status filters; report and finding list; evidence freshness; target project; resolution; **Open finding/proposal** primary action.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | report index loading | none | existing results remain stale with timestamp |
  | empty | no results for filter | none | names filter/scope and next scheduled routine |
  | error | report store unavailable or artifact missing | none | retry and source-run link remain available |
  | success | results returned | none | cross-project items show source and target project explicitly |
- **Coverage:** none yet
- **Scenarios:** SCN-010, SCN-011
- **Resources:** report/finding store; observation snapshots
- **Status:** designed

### SCR-11: Proposal review
- **Used by:** FLW-05 steps 1–5
- **Purpose:** let the target PM resolve a cross-project request once and keep provenance.
- **Elements:** source/target project; requested outcome; observations/proof; freshness; idempotency key; existing resolution; **Accept** primary action when allowed; refuse; supersede; request refresh.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | proposal/evidence loading | none | target identity and no-action state remain visible |
  | error | stale/missing evidence, target mismatch or already resolved | none | blocks duplicate/effect; shows existing resolution or refresh path |
  | success | unresolved valid proposal | none | decision preview states what the target PM will create; source project receives resolution link |
- **Coverage:** none yet
- **Scenarios:** SCN-010, SCN-011, SCN-012
- **Resources:** proposal journal; target PM graph service
- **Status:** designed

### SCR-12: Project settings
- **Used by:** FLW-01 scope/review; FLW-02 grant review
- **Purpose:** version project purpose, scope, cross-project policy, memory policy, agent/account defaults and rollback.
- **Elements:** config revision/history; purpose; target-scope radios and selectors; all-current-and-future explanation; cross-project proposal policy; memory promotion policy; default terminal/account pool; grants; diff; **Create new revision** primary action; rollback-as-new-revision.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | error | invalid scope, missing PM, overbroad grant or concurrent revision | none | exact field/gate and rebase/recovery; active runs remain pinned |
  | success | valid draft | none | diff identifies future-run impact before save |
- **Coverage:** none yet
- **Scenarios:** SCN-001, SCN-002, SCN-003, SCN-012
- **Resources:** project revision store; grant policy; `schemas/project-blueprint.schema.json`
- **Status:** designed

### SCR-13: Role workspace
- **Used by:** FLW-06 steps 2–6; FLW-08 success
- **Purpose:** give a member one focused projection of the work, evidence and views addressed to their roles.
- **Elements:** estate/project/role switcher; open/due/escalated queue; SLA; requester; evidence freshness; saved host-owned constrained grid with canonical reading order; provider views with fallback; **Open next item** primary action; receipts/history.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | queue/layout reconnect | none | last authorized projection remains stale; no removed role data is cached into the new view |
  | empty | no addressed items | none | shows next routine/SLA expectation and available role tools without inventing work |
  | error | one view, queue or membership check fails | none | isolates the failed tile; structured fallback and queue navigation remain available |
  | success | authorized projection available | none | prioritizes SLA/urgency; every item names project, interaction kind and requester; narrow view linearizes tiles in canonical order |
- **Coverage:** none yet
- **Scenarios:** SCN-013, SCN-014, SCN-018
- **Resources:** interaction-point projection; membership policy; layout revisions; MCP Apps-compatible host
- **Status:** designed

### SCR-14: Membership and interaction detail
- **Used by:** FLW-06
- **Purpose:** make joining and resolving work explicit without exposing credentials or unrelated context.
- **Elements:** estate identity; roles; visible projects; allowed action classes and exclusions; typed task payload; evidence/receipts; SLA/escalation; human/delegated path; effect preview; **Accept invitation** or **Submit resolution** primary action depending state.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | invitation/task/evidence query | none | identity and no-action posture remain visible |
  | error | invite expired/changed, evidence unavailable, already resolved or effect denied | none | preserves response draft and provides refresh/escalation/existing-receipt path |
  | success | valid invitation or unresolved task | none | review names what becomes visible/allowed or exactly what the resolution will cause |
- **Coverage:** none yet
- **Scenarios:** SCN-013, SCN-014, SCN-066
- **Resources:** membership service; interaction journal; effect policy
- **Status:** designed
- **Addressable subviews (target only):** Invitation/auth-return and typed interaction are addressable states of SCR-14. Preserve a safe return intent through authentication, then revalidate intended identity/expiry/revocation before acceptance. S09 v1 membership is estate-wide owner/member; do not simulate project-private visibility or the later M39 role workspace.

### SCR-15: Agent foundry and bootstrap
- **Used by:** FLW-07 steps 1–4
- **Purpose:** generate a safe, reproducible handoff for adapting an existing project or creating a provider.
- **Elements:** Adapt/Create intent; named consumer/project; capability selector/proposal; source/profile; pinned contract/adapter/skill revisions and checksums; no-secret notice; copy recipe; local report upload; **Generate recipe** primary action.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | profile/version resolution | none | retains intent and source; does not emit a partial recipe |
  | error | capability unresolved, source unsupported, integrity check or local report failed | none | names exact failed gate and preserves inputs for regeneration |
  | success | complete pinned recipe/report | none | shows expiry, versions, expected changed files, dry-run and revocation/reissue action |
- **Coverage:** none yet
- **Scenarios:** SCN-015, SCN-016, SCN-017
- **Resources:** `fabric-agent-adapter`; Fabric Agent Contract; Agent Bootstrap Recipe generator
- **Status:** designed

### SCR-16: Conformance and admission
- **Used by:** FLW-07 steps 5–6
- **Purpose:** separate independent compatibility evidence, estate trust and project authority.
- **Elements:** provider revision/provenance/signature; shape/protocol/semantic/effect gates; fixtures and receipts; requested capabilities/views/cost/effects; admission tier; **Admit exact revision** primary action; reject; generate fix recipe; bind/canary secondary action.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | conformance execution | none | streams named gates without implying admission |
  | error | any gate, identity or provenance check fails | none | exact evidence and repair path; admission action disabled; no project context supplied |
  | success | all mandatory gates pass | none | admission review still requires owner decision and remains separate from binding |
- **Coverage:** none yet
- **Scenarios:** SCN-015, SCN-016, SCN-017
- **Resources:** conformance service; admission registry; provider eval/provenance store
- **Status:** designed

### SCR-17: Workspace editor
- **Used by:** FLW-08 steps 1–5
- **Purpose:** let an owner compose a host-governed role workspace from built-in projections and admitted provider views.
- **Elements:** target estate/project/role; constrained non-overlapping grid; admitted span/height presets; view catalog; data/tool/role scope; structured fallback preview; explicit canonical reading/focus order; narrow/keyboard preview; revision diff; **Publish layout revision** primary action; remove/reorder/resize/rollback-as-new-revision.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | layout/view catalog query | none | current published revision remains previewable |
  | empty | no custom views | none | starts from required queue/evidence projections and offers Add view |
  | error | view unadmitted, fallback missing, scope exceeds role, overlap, invalid span or focus-order failure | none | blocks publish and identifies the view and recoverable constraint |
  | success | valid draft | none | previews desktop tracks, narrow linearization, keyboard order and complete scope diff before publish |
- **Coverage:** none yet
- **Scenarios:** SCN-018
- **Resources:** immutable Estate + Project + Role layout revision store; provider-view registry; sandbox host; ADR-0024
- **Status:** designed

### SCR-18: Support inbox
- **Used by:** FLW-09 steps 1–5
- **Purpose:** unify normalized customer requests, agent handling and human fallback without turning the mailbox into the work store.
- **Elements:** channel/customer/account; deduplication/thread; intent/sensitivity; assigned provider/role; SLA; knowledge/evidence; draft/response and delivery receipt; **Open next request** primary action.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | source/queue reconnect | none | last authorized rows remain stale with source timestamps |
  | empty | no open requests | none | shows connection health and next SLA/routine rather than a generic empty message |
  | error | source, identity match, knowledge or delivery failed | none | request remains open and names retry/escalation/reconciliation path |
  | success | requests available | none | sorts by SLA/sensitivity and distinguishes agent-handled, waiting-human and sent-with-receipt |
- **Coverage:** none yet
- **Scenarios:** SCN-019
- **Resources:** mailbox/chat connectors; support project; interaction points; delivery receipts
- **Status:** designed

### SCR-19: Work graph and release
- **Used by:** FLW-10 steps 2–5
- **Purpose:** show the immutable work graph, independent gates and production effect as one evidence chain.
- **Elements:** source finding/incident; graph revision; node owner/provider; typed inputs/results; checker verdicts; dependencies; release target/grant; effect receipt; monitor observation; **Next required action** primary action.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | graph/run projection reconnect | none | immutable completed nodes and latest event remain visible |
  | error | node/check/release/monitor failed | none | failure attaches to its phase; partial artifacts and recovery action remain accessible |
  | success | graph active or terminal | none | incident closes only when a recovery observation satisfies the acceptance condition |
- **Coverage:** none yet
- **Scenarios:** SCN-020
- **Resources:** goal graph; checker verdict store; release connection; observability receipts
- **Status:** designed

### SCR-20: Content cycle
- **Used by:** FLW-11 steps 1–6
- **Purpose:** connect sourced opportunities, channel artifacts, independent checks, publication authority and measured feedback.
- **Elements:** topic/source/freshness; audience/channel/project facts; draft artifacts; editorial/SEO/channel verdicts; publishing identity/account/schedule; grant/approval; publication receipts; analytics/Search Console observations; **Advance next eligible item** primary action.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | research/content/measurement projection | none | stage columns retain last receipts and timestamps |
  | empty | no eligible topics/drafts/measurements | none | names next research/measurement routine and allows a manual brief |
  | error | source stale, checker rejected, identity/grant absent, publish or measurement failed | none | item stays in its accountable stage with verdict/recovery |
  | success | cycle items available | none | each artifact shows source, responsible role, checker and next gate; SEO development findings route to target PM |
- **Coverage:** none yet
- **Scenarios:** SCN-021
- **Resources:** research/content projects; SEO checker; channel connections; analytics/Search Console collectors
- **Status:** designed

### SCR-21: MCP access
- **Used by:** FLW-12 entry and step 1
- **Purpose:** let an Estate owner see and create external MCP access without treating credentials as members or administrator sessions.
- **Elements:** binding name/fingerprint; principal/client; explicit Projects; resource/command scopes; effect ceiling; expiry/status; last use; active Runs; **Create access** primary action; open, rotate credential and revoke access secondary actions.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | binding/audit projection loading | none | existing rows remain visible as stale without secret values |
  | empty | no MCP access bindings | none | explains that access connects an external agent to selected Projects and offers Create access |
  | error | binding or audit projection unavailable | none | preserves filters and identifies which evidence is stale; no broad fallback is inferred |
  | success | authorized bindings available | none | rows lead with Project set, scopes, expiry/status and last use; revoked entries remain auditable |
- **Coverage:** none yet
- **Scenarios:** SCN-022, SCN-023, SCN-024
- **Resources:** MCP access-binding projection; authorization/audit service; ADR-0026
- **Status:** designed

### SCR-22: MCP access detail
- **Used by:** FLW-12 steps 2–6
- **Purpose:** create, connect, audit, rotate and revoke one MCP access binding while making credential and Run semantics explicit.
- **Elements:** name/client identity; Project selector; resource/command scopes; effect ceiling; expiry; effective/excluded access review; endpoint/protocol; one-time credential/configuration reveal; fingerprint; discovery test; call audit; linked Runs; **Create access**, **Rotate credential** or **Revoke access** contextual primary action; explicit Run cancellation when allowed.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | detail/audit/test loading | none | binding identity and no-action posture remain visible |
  | one-time-reveal | credential just issued or rotated | none | raw value and client configuration are shown once; leaving requires confirmation that it cannot be recovered |
  | error | validation, issuance, discovery, rotation or revocation failed | none | names what failed, what remains active and one retry/recovery; never echoes the token |
  | success | active draft/binding and evidence available | none | shows exact Projects/scopes, policy lineage, last use, receipts and active Runs without raw secret |
  | revoked | revocation receipt stored | none | states that new control/read stopped, history remains and in-flight Runs need explicit cancellation if desired |
- **Coverage:** none yet
- **Scenarios:** SCN-022, SCN-023, SCN-024
- **Resources:** access-binding/credential service; MCP protected-resource metadata; policy receipts; Run/audit projections; ADR-0026
- **Status:** designed

### SCR-23: Hosted terminal
- **Superseded 2026-08-31 by SCR-25.** The terminal was designed as a tab inside the project
  screen; sessions ship as detached windows instead, so this record describes a surface that
  was never built and will not be. Kept as the reasoning behind SCR-25, not as a target.
- **Used by:** — (FLW-13 retired with it)
- **Purpose:** a real, typeable Claude Code PTY session per project, rendered inside the product (ADR-0008 §3, ADR-0031) — the session itself, not a transcript view.
- **Elements:** terminal viewport (xterm.js); session tabs per project; session status (running/ended); Start session action on empty; End session secondary action; journal markers for open/close.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | empty | no session running for this project | none | explains what a hosted session is and offers Start session in the bound repository |
  | loading | PTY spawning | none | tab shows the cwd being opened; input disabled until the shell prompt |
  | error | spawn fails (binary missing, cwd gone) | none | names the cwd and binary checked; offers retry; nothing is journalled as opened |
  | success | live PTY streaming | none | keystrokes reach the session; output streams; `terminal.opened` journalled once |
  | reattached | window reopened over a running session | none | scrollback restored from the live PTY buffer; input immediately live |
- **Coverage:** none yet
- **Scenarios:** SCN-025
- **Resources:** node-pty session in the main process; journal `terminal.*` events; ADR-0008; ADR-0031
- **Status:** designed

### SCR-24: Approval queue
- **Used by:** FLW-14 all steps, FLW-21 (the attention control's destination)
- **Purpose:** the single surface for every question the fabric may not answer itself — escalations, floored actions awaiting a one-shot grant, and automatic refusals with their receipts (ADR-0004/0007/0028).
- **Elements:** queue ordered by wait/SLA; item detail with node, goal, autonomy level, action class, evidence; Approve (issues a one-shot grant where floored), Refuse and typed-answer actions; receipt links; refusals section.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | empty | a complete scoped unresolved query returns no items | none | says that no items await this operator in the measured scope and opens the last available resolution; it makes no claim about autonomous success or module health |
  | loading | queue projection loading | none | existing items stay visible as stale |
  | error | projection unavailable | none | names the stale evidence; resolution actions disabled rather than optimistic |
  | success | items present | none | each item names the exact effect, subject and scope. Approval issues the applicable typed one-shot grant; an authored answer uses `question.answered` through M152.commit. Commit, performed effect and continuation ack remain separate receipts |
- **Coverage:** none yet
- **Scenarios:** SCN-027
- **Resources:** work.ask question rows; policy receipts; grants; ADR-0007; ADR-0028
- **Status:** designed


### SCR-25: Session window
- **Used by:** FLW-16 steps 2–4; FLW-54; FLW-78, FLW-79 (the Setup console); FLW-81; FLW-82 (the manager session); FLW-94, FLW-95, FLW-96, FLW-98 (0.3.7 target)
- **Purpose:** one session in full — the terminal the agent actually runs in (ADR-0008 §3), detached so the project view stays readable behind it.
- **Elements:** header with the launch option, working directory and state badge; full-height terminal viewport; the session survives closing this window.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | session being read from the host | none | placeholder; no input accepted yet |
  | success | live session | none | scrollback replayed on open, keystrokes reach the session, resize propagates |
  | ended | the agent's work ended and the end was observed | none | the exit is shown inline; the buffer stays readable |
  | view-detached | this window closed or lost its view while the agent keeps working | none | "Window closed — the agent is still working"; Reattach; nothing is stopped ([ADR-0081](../adr/0081-codex-execution-uses-an-owned-authenticated-loopback-backend.md)) |
  | backend-lost | Fabric lost the agent's backend | none | "Connection to the agent lost"; input is off in every window of this agent; the work is not reported stopped |
  | outcome-unknown | the end of the work cannot be confirmed | none | stays unknown with the last observed output; no new writer for the same work |
  | missing | session no longer exists | none | states plainly that it is gone and the window can be closed |
  | setup | the Setup console runs (SCN-138, SCN-139; ADR-0135) | none | header «Setting up with <coding agent>» and what the brief covers (the family's agents, or one product); the coding agent's own console below, where it asks before each step; beside it, SCR-77's checklist of what Fabric observes, so the person sees the agent's words and Fabric's observations side by side; closing the window ends nothing Fabric observed and SCR-77 offers Continue setup |
  | confirm-start | a Fabric button or a `fabric://chat` link asks for the manager session and none is open for that project (SCN-142) | none | «Talk to <name> about <project> — asked from <product>, <page>», the coding agent the fallback order chooses (Change), Start as the one primary; nothing starts before Start; a malformed link opens nothing and says the link was not understood (link-refused); projects that could not be read open home and say so, never "not in your list" (link-unreadable) |
  | manager | the manager session runs (REQ-16, ADR-0123) | none | header: Fabric's face and name, the scope (the project, or «all projects»), the product and page it came from; «Open in a coding agent» (SCR-80) and «Back to <product>»; the coding agent's console below — the conversation is that console, never a chat Fabric draws |
  | project-unknown | the asking product's project resolves to no Fabric project | none | the confirmation says "<product>'s project «x» is not in Fabric yet", offers Start with all projects, and Add its folder (SCR-71) |
  | no-agent | no coding agent can start the session | none | each coding agent with the reason it was passed over (as SCN-135) and «Set up a coding agent» (SCR-77); nothing starts |
- **Coverage:** `apps/desktop/src/renderer/src/SessionWindow.tsx`, `apps/desktop/src/renderer/src/TerminalView.tsx`
- **Scenarios:** SCN-025, SCN-029, SCN-091, SCN-138, SCN-139, SCN-141, SCN-142
- **Resources:** main-process PTY sessions; journal `terminal.*`; ADR-0008; ADR-0031
- **Status:** designed

- **Account continuation proposal:** Ссылка «Продолжить с другим аккаунтом» ведёт в SCR-63 / FLW-51; SCN-083, M199. Только целевой макет, runtime не реализован.
- **Planned extension — V1 context panels (target, not current coverage):** по решению оператора 2026-09-12 (the context panels belong wherever the agent console is open) это окно несёт контекстные панели SCN-091 как первоклассные элементы рядом с терминалом, тем же компонентом, что и SCR-39: полоса вопроса с ответом inline и возрастом; бриф задачи (что/зачем/ожидаемый результат, с авторством и переходом на SCR-32); прогресс — заявление агента рядом с наблюдением и план задачи закрыто/сейчас/дальше; хронология команд и ответов оператора этому агенту, каждая строка с журнальной цитатой. Сегодня окно рендерит только header + `TerminalView` (`SessionWindow.tsx`) — панелей нет, и это зафиксировано как зазор, а не как поставка. FLW-54; SCN-091; план: `docs/ux/plans/2026-09-12-v1-context-reentry.md`, веха V1-M1.

### SCR-26: Workspace canvas
- **0.3.7 target (2026-10-17, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** superseded by the project page SCR-86 and История SCR-88 — the workspace canvas is cut (plan §5, SCN-030 retired). It stays built until wave 4 removes it; then this row becomes retired.
- **Used by:** FLW-17
- **Purpose:** the project's dashboard as a constrained grid of widgets (ADR-0024), host-generated today and provider-rendered later (ADR-0020) without the layout moving.
- **Elements:** grid with admitted spans; widget frames carrying a title and their tier; agents widget; activity widget; results slot; back to the project.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | empty | nothing running and no events | none | each widget shows its own empty state rather than an empty page |
  | success | projections available | none | widgets render from projections; every fact opens its receipt |
  | error | a projection is unavailable | none | that widget states its evidence is stale; zero is never rendered as a fact |
- **Coverage:** `apps/desktop/src/renderer/src/Workspace.tsx`
- **Scenarios:** SCN-030
- **Resources:** journal projections; session state; ADR-0020; ADR-0024
- **Status:** designed


### SCR-27: Onboarding
- **Used by:** FLW-18, FLW-32
- **Purpose:** a new tab IS the project's setup form; nothing reaches the register until it is saved, so an abandoned draft leaves no half-project behind.
- **Elements:** R0: native folder picker, selected folder chip/change action, optional URL field, automatic discovery stages and cancel/retry, derived project identity and sourced insight. No required manual name, purpose or project-check page in the R0 target. *(Amended 2026-10-03 by [ADR-0100](../adr/0100-first-run-and-start-paths.md) §4: the shipped New project path is this draft-backed form with a required name — SCR-73 — until the R0 target is built.)* Historical native form remains separately evidenced below; optional idea/starter capabilities remain outside the default R0 path.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | double submit | create pressed twice, or retried after a slow response | none | target: reconcile the same immutable reviewed request, refuse changed payload under the same identity (AD04 owns native command integrity) |
  | empty | a fresh source draft after CEO readiness | none | Choose folder is focused; URL is an alternative and a selected source can be changed without typing a path |
  | hydrating | initial disk read pending | none | new input stays in its own draft; no write until the read completes |
  | unreadable | draft file cannot be read | none | preserve current input and damaged bytes; show read failure and do not persist defaults |
  | error | save refused | none | the whole draft is preserved and editable; the reason is shown |
  | success | save accepted | none | the same tab becomes the project home, with the repositories already attached |
- **Coverage:** `apps/desktop/src/renderer/src/Onboarding.tsx`
- **Scenarios:** SCN-031, SCN-033, SCN-059
- **Resources:** `project.created@1`, `project.repo.attached@1`; native folder dialog in the main process
- **Status:** designed
- **Addressable subviews (target only):** New/resumed project draft, optional repository/setup and stable project-create receipt. Preserve the SCR-02 starter intent as an optional advanced branch; no full organisational activation is required to record first project/task intent.


- **Target composition · R0 revision:** CEO identity (SCR-36) → readiness (SCR-05) → source picker → automatic discovery → sourced dashboard. The earlier AD03 source/purpose/review target is superseded for R0, with its transaction integrity retained. Help and navigation retain Estate/draft/source/scan identity; a second draft is explicit.
- **Target scan checklist (CO-180):** `r0-source` / `r0-discovery` follow ADR-0100 §3: each ticked repository becomes its own Project; no batch primary-source selector or implicit related-source aggregation. Imported rows open their exact Project and cannot be ticked again. Explicit reference sources of an existing Project and pinned Run context remain separate from scan-batch creation. Target prototype coverage: `scripts/product/first-release.mjs`, `scripts/test/first-release.test.mjs`; this does not upgrade native coverage.

- **Target recovery states:** pending/unknown show original request and reconciliation; denied/loading/conflict/partial preserve input and explain the blocked action; archived duplicate opens its exact recovery. A valid idea ignores an earlier repository path at review and commit. These target states do not upgrade native coverage.

### SCR-28: Editor window
- **Used by:** FLW-19
- **Purpose:** read and correct one repository file beside working agents, and make a conflicting save a decision rather than an accident.
- **Elements:** file name and path; unsaved/saved marker; Save; Open in system editor; conflict banner with Take the version on disk / Keep mine and save; the editor, and in conflict a side-by-side diff.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | file being read | none | nothing is editable until the content and its hash arrive |
  | success | file open | none | syntax highlighting by extension; the theme follows the app's |
  | unsaved | buffer differs from what was read | none | the header says so; nothing is written until Save |
  | conflict | the file changed on disk before Save | none | nothing is written; both versions are shown side by side and the operator chooses |
  | error | unreadable, oversized or failed write | none | the reason is stated and the buffer is kept |
  | save settles late | a write response arrives after further typing | none | only the saved buffer generation is acknowledged; an older response never replaces newer input, which remains dirty (target S01) |
  | close with unsaved buffer | the window is closed while dirty | none | asks before discarding and preserves the buffer when cancelled (target S01) |
- **Coverage:** `apps/desktop/src/renderer/src/EditorWindow.tsx`
- **Scenarios:** SCN-034
- **Resources:** main-process file read/write with a content hash; Monaco editor and its diff view
- **Status:** designed

### SCR-29: Public landing page
- **Used by:** FLW-20
- **Purpose:** explain the move from directing agents to operating Projects, establish the product/kernel boundary and provide an honest next path.
- **Elements:** PassionCode.ai wordmark and approved mark; category eyebrow; primary positioning; two CTAs; vibe/passion comparison; Project frame with purpose, team, Routines, authority, Evidence and learning; operating loop; agent-agnostic principles; repository map; current-status note; footer.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | success | static assets available | none | full dark-first brand page with semantic reading order |
  | image unavailable | SVG/PNG blocked | none | wordmark, headings and all navigation remain complete |
  | narrow viewport | viewport below 720 px | none | comparisons and Project frame collapse to one column; no horizontal scroll |
  | reduced motion | operating-system preference | none | identical page; v1 has no required animation |
- **Web surface:**
  - **Route:** `/`
  - **Answers:** what PassionCode.ai is, how passion coding differs from vibe coding, what a Project keeps and what exists today
  - **Indexable:** yes; canonical → `https://passioncode.ai/`
  - **Without JS:** all copy, diagrams, status and links render in semantic HTML
  - **Entity:** `schema.org/Organization` for PassionCode.ai
- **Coverage:** none from this repository — the subject is `passioncode-ai.github.io`, and a citation this tree cannot resolve is not a citation (UX28-15). Corrected together with SCN-038, which read `implemented` while the board's BL-017 records the address answering HTTP 522; the two registers disagreed and the one with no evidence gave way
- **Scenarios:** SCN-038
- **Resources:** approved SVG mark; 1200×630 social card; `docs/brand/`
- **Status:** designed

### SCR-30: Estate home
- **0.3.7 target (2026-10-17, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** superseded by the rail SCR-84 and Главная SCR-85: no tab strip, no profile block, no Pulse, no live feed, no «Ещё на этой странице» (plan §5). It stays built until wave 4 rebuilds the home; then this row becomes retired.
- **0.3.9 (2026-10-21, [the core holds](../evidence/plans/2026-10-21-core-reliability/README.md#board)):** a «Ждут между проектами» panel shows the requests between projects that no agent can answer, how long the oldest has waited, and «Открыть переписку»; it is absent when nothing waits. A lost database is said by a notice on this and every screen («База данных Fabric не отвечает»), with the next try and, under 3 GB free, the disk.
- **Amended 2026-10-26 (0.3.14, P-28, [plan](../evidence/plans/2026-10-26-release-0314-plan.md)):** the SCN-158 states below now render on Главная (SCR-85): an agent's task is its newest running one and an untitled task is kept; abandoned work leaves «В работе» for «Брошено: N» (SCR-85's amendment of the same date).
- **Used by:** FLW-21, FLW-32, FLW-33, FLW-54, FLW-69, FLW-78
- **Purpose:** the first screen after launch — who the manager is, what it has done, which projects lead, and what is happening across all of them right now.
- **Elements:** compact manager header (colour portrait, name/role, meaningful-events sparkline and sourced pulse); priority Board beside a resume card (decision/now/next); projects below Board and restrained agent activity below resume; controls (search, attention with count, quota, chat, new project, settings); favourites up to five; all projects by activity with per-project agent summary; live feed; floating manager control.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  | a card with obligations | anything is waiting in that project | none | says how many, from the SAME items the CEO panel lists — not a query of its own. Two numbers describing one thing on two surfaces is worse than one surface having none: the operator cannot tell which is wrong, so neither is usable |
  | a card with nothing waiting | the queue holds nothing for it | none | no chip at all, rather than a zero. A card asks "is anything waiting" and gets a straight no |
  | pinned projects | the operator pinned any | none | their own section above, in the order they were PINNED — re-sorting by name or activity would silently undo a decision made with a click |
  | the rest | always | none | a PARTITION, not an overlay: a pinned project appears once. Shown twice, the operator can act on the wrong card and any count beside either list becomes uninterpretable |
  | everything pinned | nothing left below | none | says so, rather than an empty grid |
  | a project card | always | none | TWO SIBLING controls, never nested: the name opens the project and the pin pins it. An interactive `Panel` is a real `<button>`, so a button inside it would be invalid — the trap `TaskCard` avoided in step 4 and this walked into |
  | CEO panel, open | the floating control is pressed | none | it PUSHES rather than covers — a panel that overlays the board hides the thing you opened it to act on. The content narrows and nothing is hidden |
  | what is waiting | derived from state, never from a notification store | none | refusals first (somebody is blocked now), then work in review, then work nobody is doing. Within a kind, the thing waiting longest is first: neglect is the ordering, not novelty |
  | nothing waiting | the queue is empty | none | says so as a measurement. **Nothing can be dismissed** — an item leaves when the thing it names is resolved, because a queue you can mark as read is a queue that lies |
  | no model | always, for now | none | the panel says plainly that nothing here talks back, and names what a conversation would take: a provider, a key, a budget. An empty text box would imply one exists |
  |---|---|---|---|
  | loading | before the estate has been read | none | the counts are absent, not zero — M108's rule |
  | empty | no projects yet | none | the header shows zeroes with their registers named; favourites are not offered |
  | success | projects exist | none | favourites lead; a project with an agent waiting sorts up |
  | chat open | the manager control is pressed | none | the chat becomes a THIRD column; nothing already on screen is hidden. The thread is the PROJECT's — the estate has its own and switching projects switches threads |
  | figure pressed | any counted figure | none | opens the register it was counted from; a figure that names a register and does not open it is a claim wearing a citation |
  | default | the first run has just finished (FLW-69) | none | the persona's name in the hero, the imported projects listed; when an action was chosen in the first run its screen opens over Home, which stays one Back away |
  | finish-setting-up | the first run's family step was skipped (SCN-138) | none | one card «Finish setting up» naming what is not set up and the reason the person gave; it opens SCR-77 at the family step; Dismiss removes it, and SCR-77 stays reachable from Settings |
  | counts strip (SCN-158) | `work.home` has answered | none | four counts — agents working now, tasks in work, what needs the operator, what waits for review — on their own row; each opens where it is counted. Before the reading answers they are absent, not zero |
  | who is doing what (SCN-158) | `work.home` has answered | none | «Кто что делает»: «В работе» and «На проверке» across projects, each task as its plain summary (brief «what», else title — never its instruction) with project, agent, how long and the agent's current stage; each lane that holds nothing says so |
  | agents at work (SCN-158) | `work.home` has answered | none | «Агенты в работе»: each working session, its latest stage in the agent's words (step N of M), else «Работает над: …», else «Ещё не сказал, что делает»; a silent one is marked «молчит» and sorted last; a click opens the console Fabric holds, else the project. None working: «Сейчас ни один агент не работает.» from a read list |
  | work reading failed (SCN-158) | `work.home` failed | none | «Неизвестно, кто работает: работу не удалось прочитать.», the machine's reason on its own line beneath, the last reading kept on screen and the counts shown as «—»; read again on the next journal mark or the 15-second tick — never shown as nobody working |
  | silent claim (SCN-158) | a claim's agent no longer signs for it | none | the task stays in «В работе» with the pill «никто не отмечается» instead of a stage; the strip counts it, so the strip and the lane heading show one number |
  | capped reading (SCN-158) | 50 tasks wait for review, or 200 are in work | none | the counts are floors — «50+», «200+»; each lane shows six rows and «Ещё N» opens the Board; after a failed reading the strip shows «—», never the last numbers as current |
  | project card now (SCN-158, SCN-043) | a project has a working agent, or none | none | «Сейчас: <stage>» or «Тихо уже <time>»; favourites in their order, then the rest by latest activity — no manual order for the rest |
- **Coverage:** `apps/desktop/src/renderer/src/EstateHome.tsx`, `apps/desktop/src/renderer/src/launch/HomeWork.tsx` (`useHome`, `HomeStats`, `HomeWorkLanes`, `HomeAgents`), `apps/desktop/src/shared/homeLive.ts`, read by `apps/desktop/src/main/workRead.ts#readHome` (2026-10-14, SCN-158; the real app on a disposable stack: `apps/desktop/test/operator-home-native.mjs`); the manager header, CEO panel and five lanes stay as described above
- **Scenarios:** SCN-043, SCN-044, SCN-059, SCN-060, SCN-092, SCN-093, SCN-126, SCN-138, SCN-158
- **Resources:** `projects`, `agent_bindings`, journal; the portrait contract in `docs/brand/ui.md`
- **Status:** built
- **Prototype now renders the V1 five-lane home (2026-09-12, target design, not coverage):** operator brief — the home lacked an avatar and statistics, and the focus on returning to context was not visible. The mockup (`scripts/product/workbench.mjs`, view `estate`) now leads with the Fabric greeting band (mark + the digest voiced with the oldest wait age), a measured stat row where every figure names its register (SCN-044's rule applied to the home), then the five lanes in the fixed order Вопросы → Сейчас → Было → Дальше → Решения with ONE lane open on arrival (Вопросы if any, else Было) — the раскладушка of `plans/2026-09-12-v1-design-language.md` §1–§3. Tested mechanics survived recomposition: pin-project, host-unavailable/host-ready, sources table, CEO launcher (browser suites re-run green). The bespoke empty welcome is unchanged.
- **Planned extension (not current coverage):** Board top5, Inbox and cycle summaries use scoped coverage and separate destinations. FLW-25/29/30; SCN-050/055/056. See [engineering contract](../architecture/system-contract.md).
- **Addressable subviews (target only):** Restored working set and resume-draft entry preserve operator intent. SCR-01 resolves to project-inventory intent here, not a duplicate estate route.

### SCR-31: Project page
- **0.3.7 target (2026-10-17, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** superseded by Проект SCR-86 — one page with no sections below the board and no per-project rail links (plan §2, §5). It stays built until wave 4.
- **Used by:** FLW-21, FLW-22, FLW-23, FLW-24, FLW-32, FLW-33, FLW-54, FLW-80, FLW-81
- **Purpose:** the working surface of one project, answering in order: where we left off, what to ask for, what is in flight.
- **Elements:** header with branch and repository state; attention chips; where-we-left-off digest with citations; give-a-task field with shortcuts; kanban board with drag; project live feed; plan widget; agent noticeboard; harness entry; collapsed memory, files and journal; floating manager control.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  | digest, first visit | no mark for this project | none | says so. Never having looked and having looked and found nothing are different facts, and only one of them is reassuring |
  | digest, nothing new | read, and nothing happened since | none | says that instead. The mark advances when the operator LEAVES, so returning shows what they missed and returning twice shows nothing — they just saw it |
  | recovered history | restart capture committed | none | capture label and unknown ending; timestamp is recording time, never invented process end. Opening shows retained source and exact past context. Legacy provenance is not observed completion |
  | digest with lines | anything happened | none | chronological across kinds, because catching up is a story rather than a report by category. Every line carries the store and row that opens it — composed, never generated |
  | permission picker | an agent with modes is selected | none | the modes appear beside the agent. A BLOCKED mode is shown and disabled with its reason, never hidden — a choice that is absent teaches nothing, and one refused with a reason is a decision the operator can argue with |
  | agent changed | a different agent is picked | none | the mode resets to that agent's default: changing the agent changes what the modes MEAN, and carrying a word from another vocabulary would be worse than asking again |
  | board card, moving | the operator picks a destination or drops the card | none | the card moves at once and the projection catches up. A REFUSED move puts it back **and says why, in the ladder's own words** — the revert is fine, the silence is the defect |
  | board card, cancelling | `Cancel…` is chosen | none | asks for the reason before anything moves, and will not proceed without one. A task that disappears without a reason is a decision nobody can find later |
  | board column, droppable | a card is being dragged that may legally land here | none | only the columns the ladder allows offer themselves. The operator is never invited to make a move that will be refused |
  | board, not read | the page has opened and the projection has not answered | none | every column is silent — no counts, no "empty". A column that says "empty" before it has read is asserting something it does not know (M108) |
  | board, read and empty | no task has ever been filed here | none | one line for the whole board, not four empty columns: four ways of saying nothing is noise, and the operator's question is "is anything here", not "is Review here" |
  | board, holding work | tasks exist in any state | none | four columns — backlog, running, review, done — each stating its count. `cancelled` sits in `done` carrying its reason, because a fifth column spends a quarter of the width on work nobody is doing and hiding it loses the reason |
  | board card | any task | none | never without its provenance: the glyph for who filed it and the handoff between whom it moved (M130). A live card opens its session; a closed one offers its instruction again — both replaced by the task page in step 5 |
  | tab switched mid-flight | an IPC answer arrives after the operator switched projects | none | every in-flight answer carries the project it was asked for and is dropped elsewhere; draft text in the task field belongs to its project and travels with the tab (UX-01) |
  | use again over a draft | the operator picks a past task while the field holds text | none | asks before replacing, exactly as presets do; the new draft's provenance is its own, never the borrowed preset id (UX-14) |
  | instruction sent | the task is launched | none | delivered as ONE bracketed-paste block once the agent is OBSERVED to be listening — it has printed something and then gone quiet. Never on a timer, and a newline in the textarea is content rather than Enter (UX-15 / M103). An agent that never falls quiet gets it after 30s, out loud: an instruction silently never sent is the failure being replaced, not an improvement on it |
  |---|---|---|---|
  | loading | before projections are read | none | panels say they are reading rather than showing empty copy |
  | first step | a project with no tasks and no history | none | offers exactly two actions — set a task, or open an agent. A project that has just been created must not open on an empty board |
  | empty | tasks existed and were cleared | none | the digest says there is nothing to summarise yet; the board shows its columns |
  | success | work exists | none | the board is authoritative only after the journal accepts a move |
  | move refused | `task.moved@1` not accepted | none | the card returns to its column and the failure is stated |
  | who-is-working | claims are live in this project (SCN-140, REQ-38) | none | the section «Who is working on what»: one row per claim — the agent (coding agent or product, how it came in), the task with its backlog row, what it touches, since, last sign of life; the row's one action opens the agent's session when Fabric holds a console for it — for an agent enrolled from its own terminal or reaching Fabric through the hub the row says "runs in a terminal outside Fabric" / "runs outside Fabric" instead, since opening it could only say the session is gone (0.3.5 review UX-3); «Release…» sits in its … menu; agent-sync leases are listed beneath, read-only, only when the repository uses agent-sync (its `.claude/agent-sync.json`) |
  | who-is-working unclaimed | a session works in this project without a claim (an enrolled agent before it claims, a terminal Fabric launched) | none | a row per such session — the agent, how it came in, since, "no task claimed" — with Open session when Fabric holds its console, else where it runs (0.3.5 review UX-4) |
  | who-is-working leases-unread | the repository uses agent-sync and its remote could not be read | none | one line, the reason in the operator's language, said once; a repository with no remote says "has no remote, so it carries no agent-sync leases", not a failure (0.3.5 review UX-5) |
  | who-is-working unreadable | the claims could not be read | none | "Fabric could not read who is working here" with Try again, the machine's words on a secondary line (0.3.5 review UX-10); never "nobody" |
  | who-is-working related | two claims overlap (same backlog row, linked tasks, or overlapping folders or files) | none | both rows carry «related» and name each other and what overlaps; nothing is blocked |
  | who-is-working none | no claim is live, no task is held and no session Fabric knows of works here | none | one line: nobody is working in this project right now — from a read board, never before it answers, and never while a session without a claim is listed (0.3.5 review UX-4) |
  | who-is-working stale | a claim is past its expiry with no sign of life, or lapsed with its session | none | «no sign since <time>», or «lapsed — the session ended», never "working" |
  | release confirm | «Release…» chosen on a claim | none | a confirmation naming the agent and the task: the claim ends now and the agent is told on its next call; Release and Cancel, Cancel focused |
  | the way (SCN-159) | the page's tasks are read | none | «Откуда пришли и куда идём»: «Сделано недавно» → «Сейчас» (in work, then in review, each with its agent's stage) → «Дальше» (the goal, then the queue in board order); each task its plain summary; a project with no tasks shows its first step instead. Before the tasks are read: «Читаю…», never "no tasks" |
  | board glance (SCN-159) | the page's tasks are read | none | four columns with their counts and first cards; «Вся доска» goes to the full board, «+ Задача» writes one; a partial read says so |
  | done is a floor (SCN-159) | the page read only the newest 20 finished tasks | none | «Готово 20+» in the glance; «Вся доска» shows them all; a task with no brief and no title is «Задача без описания», never its instruction |
  | agents on the project (SCN-159) | `work.home` has answered | none | «Агенты на проекте»: this project's working agents in their own words; a click opens the console Fabric holds; a console that will not open says why |
- **Coverage:** partly — `apps/desktop/src/renderer/src/ProjectHome.tsx` holds the panels this recomposes; «Who is working on what» (who-is-working, related, none, stale, release confirm) is `apps/desktop/src/renderer/src/WhoIsWorking.tsx#WhoIsWorking`, read by `apps/desktop/src/main/workRead.ts#readProjectWork`; the way, the board glance and the agents on the project (SCN-159, 2026-10-14) are `apps/desktop/src/renderer/src/launch/ProjectWay.tsx` (`ProjectWay`, `ProjectBoardGlance`) over `apps/desktop/src/shared/projectPath.ts`, in `apps/desktop/src/renderer/src/launch/ProjectLaunch.tsx`
- **Scenarios:** SCN-040, SCN-041, SCN-060, SCN-140, SCN-159
- **Resources:** `project_tasks`, journal, `agent_stages`, leases
- **Status:** built
- **Planned extension (not current coverage):** Board top10; separately addressed Project history, Target plan and Decisions previews; per-agent/task TaskRun widget. FLW-25/27/28/31; SCN-050/052/053/054/057/058. See [engineering contract](../architecture/system-contract.md).
- **Addressable subviews (target only):** SCR-03 overview is an intent of this same project surface. Deep links carry exact authorised project/entity/return context; a missing or denied source never falls back to another project.

### SCR-32: Task page
- **Amended 2026-10-23 (0.3.12, CO-400; [the walk](../evidence/plans/2026-10-15-fabric-simple/2026-10-23-operator-walk.md)), what ships today:** the page follows the task template (SCN-174): back to the place it was opened from at the top left above the title; «Для чего эта задача» with «Что должно произойти», «Почему», «Что будет верно, когда задача выполнена»; its state, who works on it and since when. Flow: FLW-100.
- **Amended 2026-10-24 (0.3.12 S7, CO-401; 0.3.12 release review, iteration 1, DO-5, UX-12, UX-13):** «Что её держит» (what blocks the task, or «Её ничего не держит.») and «Как двигалась» (each move in the kanban's column words, «Очередь», «В работе», «На проверке», «Готово», «Отменено», with who moved it, «(вы)», «(агент)» or «(Fabric)») are built. An empty brief is one sentence: on a task still to do «Спецификация не собрана: бриф ещё не написан. Агент спросит вас о нём, прежде чем начать, или напишите его сами ниже.», on a finished or cancelled one «Бриф не написан. Его можно написать ниже.». A task that cannot be read says so in a banner with the way back; there is no «Повторить». Code: `apps/desktop/src/renderer/src/TaskPage.tsx`, `apps/desktop/src/shared/taskMoves.ts`, `tasks.detail`'s `blockedBy` in `apps/desktop/src/main/index.ts`.
- **Used by:** FLW-22, FLW-23, FLW-32, FLW-33, FLW-54, FLW-81; FLW-95 (0.3.7 target); FLW-100 (0.3.12)
- **Purpose:** one task's own page — the working context of that task, filled in by the agents working it and editable by the operator. Not a second documentation: knowledge lives in `docs/` and in project memory, and this page links to it.
- **Elements:** title with type, section and lease; brief (what / why / expected result) with its authorship line; append-only notes with a promote-to-memory action; fields panel; related tasks; resources as links only; transition history; receipts for external effects; the manager chat scoped to this task.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  | brief with two writers | an agent drafted it and the operator changed a section | none | both stay readable: the live text is the operator's, and what the agent proposed is kept beside it. An override never erases a draft |
  | a note worth keeping | the operator presses "move to memory" | none | the note is NOT copied and NOT deleted — a fact is recorded first, then the note is marked with where it went, so a crash between the two can never leave a pointer to a fact that does not exist |
  | a note already promoted | it carries a fact id | none | shows where it went instead of offering the action again; a second promotion is refused with "it is in memory once", and the projector will not repoint it even if a second event reaches the journal |
  | receipts | always | none | rendered by the SAME `Feed` the estate uses. A second renderer for journal rows is a second chance to disagree about what an event means |
  |---|---|---|---|
  | empty | created, not yet worked | none | only origin is shown; the rest says it is not filled in |
  | success | an agent has worked it | none | every section names who wrote it and when |
  | edited | the operator overrides an agent's text | none | the operator's version stands; the agent's stays readable |
  | promoted | a note becomes a project fact | none | the note is marked promoted and the page keeps a link, never a copy |
  | closing | the operator ends the task from its own page | none | close, return to backlog and cancel are here; CANCEL REQUIRES A REASON, because a task that vanished without one is a lost decision |
- **Coverage:** `apps/desktop/src/renderer/src/TaskPage.tsx` (the template and the way back; 0.3.11, 0.3.12; what holds it and how it moved, 0.3.12 S7), test `apps/desktop/src/renderer/src/TaskPage.test.tsx`
- **Scenarios:** SCN-045, SCN-060, SCN-067
- **Resources:** `project_tasks`, `memory_facts`, `effect_intents`, `session_transcripts`
- **Status:** built
- **Planned extension (not current coverage):** TaskRun and plan revision widget; answer commit/continuation and blockers are distinct; exact graph/source backlinks; task-bound drafts survive navigation. FLW-25/27/28/31; SCN-050/052/058. See [engineering contract](../architecture/system-contract.md).
- **Addressable subviews (target only):** Create/edit task and admission are addressable subviews of this Task surface. Task creation, pre-admission refusal, admitted TaskRun/spawn, delivery and provider acknowledgement remain distinct; a new page or store is not required.

### SCR-33: Decision history
- **Used by:** FLW-21, FLW-26, FLW-28
- **Purpose:** Trace decision changes, actor responsibility and exact recorded evidence. Target-plan membership moves to separately addressed SCR-40 SHOULD; existing goal list remains a legacy preview until migration.
- **Elements:** Current decisions/list or lineage graph; person/agent/system/unknown authorship; supersession branches; author rationale and explicit citations; supplied pack/retrieval receipts separate; affected tasks; source inspector and return.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | empty | No decisions after complete read | none | No invented history. |
  | list | No supported supersession edges | none | Readable decisions with sources; no forced diagram. |
  | lineage | Recorded replacements exist | none | All predecessors visible; no hidden rootless corrupt data. |
  | incomplete | Legacy or missing historical evidence | none | Label exact missing coverage; never substitute latest pack. |
  | stale/error | Refresh fails | none | Retain last snapshot with age and retry. |
  | override | Operator changes decision | none | Use new human decision commit; original retained, effects not implied undone. |
- **Coverage:** none yet
- **Scenarios:** SCN-040, SCN-051, SCN-054, SCN-058
- **Resources:** Current DecisionsSection.tsx/decisions.ts are legacy list coverage; future DecisionHistoryPage.tsx not yet implementing this contract.
- **Status:** designed

### SCR-34: Project memory
- **Used by:** FLW-21, FLW-22, FLW-31, FLW-34, FLW-35, FLW-36
- **Purpose:** one surface over the four stores the project keeps, so its knowledge is inspectable rather than assumed.
- **Elements:** store inventory (holds / written by / last read); facts with their source marker and corrected state; the miss counter beside the hit counter; drill-in per store.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  | six counts | the stores answered | none | facts held now, corrected ones kept, times asked, times empty, sessions captured, packs compiled. Counts rather than claims |
  | a store that did not answer | a read failed | none | shows its problem instead of a zero. In front of a person a confident zero is MORE convincing than in front of an agent, and the banner says the picture is partial |
  | the miss rate | the retrieval log was read and is not empty | none | "N% of M came back empty". Never asked → there is no rate, said in words: a rate with no denominator is not zero |
  | what it could not answer | always | none | its own panel, not a number in a corner. These are things nobody has written down yet, and a memory screen showing only what it HOLDS is exactly the one that cannot answer whether memory works |
  |---|---|---|---|
  | loading | before any store has been read | none | rows say they are reading |
  | empty | a store with nothing in it | none | says so plainly rather than showing a flattering total |
  | success | stores hold content | none | a miss reads as "nobody wrote it down", never as "untrue" |
  | error | a store will not read | none | that row reports its own failure; the others still render |
- **Coverage:** none yet
- **Scenarios:** SCN-039, SCN-057, SCN-062, SCN-064
- **Resources:** `memory_facts`, `session_transcripts`, `session_context_packs`, `memory_retrievals`
- **Status:** designed
- **Planned extension (not current coverage):** Addressable Next context, exact Past pack, fact lineage and retrievals; declared-mirror sync with per-store partial/error states. FLW-31; SCN-057/058. See [engineering contract](../architecture/system-contract.md).
- **Addressable subviews (target only):** Next context, exact Past pack and fact lineage remain addressable subviews here, with immutable PackRef/FactRef and a return target. Detailed declared storage operations open SCR-47; backup recovery opens SCR-48; retro and outbound settings open SCR-45/SCR-46.

### SCR-35: Project harness
- **0.3.7 target (2026-10-17, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** superseded by «Что получает агент» in the agent's view on Агенты, SCR-87 (plan §4). It stays built until wave 4 removes it from the project page.
- **Used by:** FLW-24
- **Purpose:** what this project's agents are and what they may do — and the tool contract they work the board through.
- **Elements:** bound agents with state and permission mode; skills with the mandatory task skill marked; MCP servers with grant state; the tool contract table (claim, report, move, list leases, note, release).
- **States:**
  | State | Trigger | Figma frame | Behavior |
  | agents | always | none | which can run HERE, whether each is installed on this machine, and what each may be launched as — with a blocked mode named as blocked rather than hidden |
  | servers | the surface is up | none | exactly ONE, and the panel says that is enforced: sessions launch with strict MCP config, so whatever else the machine has configured is invisible from inside. Auditing that otherwise means reasoning about a global config |
  | servers, surface down | it failed to start | none | says a session here would have no tools at all, rather than showing an empty list that reads as "none configured" |
  | tools | always | none | every tool with what it is for, and whether it LEAVES A RECORD. No call counts: there is no call log, and not every tool journals, so a count taken from the journal would show the silent ones as unused — a number worse than none, and the panel says so. The figures are RENDERED from the tool list rather than written here: this line carried hand-written counts until 2026-09-10, and they had drifted by six |
  | authority | always | none | open, spent and expired counted separately. An open grant is a door that is open; a spent one is history; an expired one is a permission nobody used |
  |---|---|---|---|
  | empty | no agents bound | none | the contract is still shown: it is what an agent will be held to |
  | success | agents bound | none | an agent blocked on a missing grant says which grant |
  | error | a grant cannot be read | none | shown as unavailable with the reason; the dependent agent does not start |
- **Coverage:** `apps/desktop/src/renderer/src/HarnessSection.tsx`, `apps/desktop/src/shared/harness.ts`, `apps/desktop/src/main/harnessRead.ts`, `apps/desktop/src/renderer/src/HarnessSection.test.tsx`, `apps/desktop/test/harness-read.test.mjs` (UX28-05). The `error` row above was specified from the start and the code answered `0` until this change. The `skills with the mandatory task skill marked` element is NOT built — it is M123's — and no skills row is shown rather than an empty one that would read as "none installed"
- **Scenarios:** SCN-047
- **Resources:** `agent_bindings`, `grants`, the agent surface tool list
- **Status:** designed

### SCR-36: Estate record
- **0.3.7 target (2026-10-17, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** the profile block is cut from the home (plan §5; SCN-044, SCN-093 retired). The record stays built until wave 4.
- **Used by:** FLW-21
- **Startup boundary (first-release entry):** Before this screen, a schema/build failure uses the existing native startup dialog. No project data or chat is shown; recovery/agent services have not started in this attempt. Retry rechecks the schema; invalid build identity requires restart. Prototype review tools offer explicit compatible/older/newer/unavailable/invalid-build examples and never infer success from Retry. *(Amended 2026-10-10 by [ADR-0131](../adr/0131-a-database-only-the-old-seed-has-touched-is-given-to-the-local-operator.md), 0.3.4: after the schema check the operator's identity is established; a default Estate only the old seed has touched is first granted to the local operator, and any other identity refusal is the native startup error's own cause, `identity-refused`, with the reason in its details.)*
- **Purpose:** the estate's own record, as measurements with their registers named.
- **Elements:** portrait; tenure; figures each naming the register it was counted from; tasks-per-day series.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  | what has been done | the estate has a record | none | counted from rows: projects, sessions, tasks closed, facts, decisions, authorisations, events. A store that could not be read says so rather than showing zero |
  | length of service | anything has been recorded | none | whole days from the first event. An estate whose first event is TODAY says "started today"; one with NOTHING recorded has no length of service, which is not the same as zero |
  | the portrait | always | none | **visibly empty, with what it would take.** A portrait needs an image nobody has generated and a name is a decision about this product's character rather than something the record knows. A screen inventing either asserts something nobody chose, and the operator would then be arguing with their own product about who it is |
  |---|---|---|---|
  | empty | a fresh estate | none | zeroes with their sources, never an encouraging placeholder |
  | success | journalled work exists | none | every figure is recomputed rather than stored |
  | error | a register cannot be read | none | that figure reads unavailable with the reason, never zero |
- **Coverage:** none yet
- **Scenarios:** SCN-044
- **Resources:** `projects`, `agent_bindings`, `effect_intents`, journal
- **Status:** designed
- **Prototype target — страница Fabric (2026-09-12, target design, not coverage):** the profile view in the mockup now opens as Fabric's company page: the personal generated avatar (style presets + «Сгенерировать моего Фабрика», demo without a model call), the computed level with its formula line and register inputs, days worked, and the measured record groups below. Operator decision closes the avatar brand-review question; the look never changes authority (ADR-0057). SCN-094.

### SCR-37: Search results
- **Used by:** FLW-21
- **Purpose:** one door to everything the estate holds, answering a typed question across projects, tasks, memory, transcripts and decisions.
- **Elements:** one field; results grouped BY NATURE rather than ranked into one list — projects, tasks, memory facts, transcripts, decisions — each group carrying its own count and its own "show all"; a result opens the thing itself, never a preview of it.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  | results | anything matched | none | GROUPED by store, never merged. Facts and sessions come back RANKED from a tsvector; tasks have no index and are matched by substring, and the group says so — merging them would imply an ordering across incomparable scorers, and the reader would take the top as the best answer |
  | nothing matched | every store answered | none | "nothing matches, in any store" — a claim, and only made when it is one |
  | a store stayed silent | one read failed | none | INCONCLUSIVE, naming which. "We looked everywhere and found nothing" and "we looked in two of three places" are different answers, and only one settles the question |
  | found but partial | hits, and a store still silent | none | the count is of what ANSWERED, with a banner saying this is not everything. A failed store counted as zero would make the total a measurement of our luck |
  |---|---|---|---|
  | empty | nothing typed | none | shows what is searchable rather than a blank page |
  | no matches | a query nobody matched | none | says which stores were searched, so "nobody wrote it down" is distinguishable from "not searched" |
  | success | matches exist | none | grouped by nature; a group with none is absent, not shown as zero |
  | partial | one store failed | none | the others render and the failed store says so — never a silently short list |
- **Coverage:** none yet
- **Scenarios:** SCN-048
- **Resources:** `projects`, `project_tasks`, `memory_facts`, `session_transcripts`, journal
- **Status:** designed

### SCR-38: Harness tool
- **Used by:** FLW-24
- **Purpose:** one tool of the agent contract, in full — so the rule an agent is held to can be read by the person who holds them to it.
- **Elements:** what it does, what it accepts, what it returns; who called it in the last week and how often; how many calls it refused and why; the events it writes.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | empty | never called | none | the contract is still shown; usage says never called rather than zero |
  | success | calls exist | none | callers and refusals are counted from the journal, not stored |
  | error | usage cannot be read | none | the contract renders and usage says it is unavailable |
- **Coverage:** none yet
- **Scenarios:** SCN-047
- **Resources:** the agent surface tool list; journal
- **Status:** designed

### SCR-39: Estate agents
- **0.3.7 target (2026-10-17, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** superseded by Агенты SCR-87 (SCN-166). It stays built until wave 4.
- **Amended 2026-10-26 (0.3.13 release review, iteration 1, UX-11):** the app no longer draws this screen: since 0.3.13 (CO-419) Агенты SCR-87 is the one place for every agent, its work and its console (`apps/desktop/src/renderer/src/launch/AgentsScreen.tsx#AgentsScreen`). `apps/desktop/src/renderer/src/EstateAgents.tsx` stays in the tree with its tests and is mounted by no screen; the index row points at what draws the place now.
- **Used by:** FLW-21, FLW-27, FLW-54
- **Purpose:** every running agent across every project on one screen — who is working, what they are doing now, and where the work is landing. The single list M86 asked for, unscoped as M71 asked, with M70's console.
- **Elements:** a launch control at the head of the list — this is where a hand reaches for one, and a screen that shows agents and cannot start one sends the operator back to a project to do it; agent list by activity with waiting ones first and finished ones dimmed; the selected agent's live console with its input; the task it holds; project meta — repository, folder, branch, changed and untracked counts, view files; the agent's HISTORY of actions from the journal, which is not its transcript.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  | the list | any session exists anywhere | none | every session in every project, with its project, its agent and its observed state. Switching is one click, which was the point of asking for the screen |
  | the centre | one is selected | none | the SESSION while it lives — `TerminalView`, the same component SCR-25 uses, attached to the selected session with its input. Amended 2026-09-10 (UX28-13): this row said the centre "does not update as the agent runs", which contradicted this record's own Elements line ("the selected agent's live console with its input") and the `detached` state below it — a screen whose centre never attaches has no cannot-attach state. The reasoning it carried was about a second RENDERER, and that still holds: there is one component, hosted twice, so there is nothing to disagree. An ENDED session keeps the decoded snapshot with its exit code, because there is nothing to attach to |
  | its history | one is selected | none | the agent's own claims and what Fabric observed, in ONE ordered list. Splitting them into two panels would let a reader take either as the account, and keeping them apart in the store exists so they can be read against each other here |
  | where it is working | one is selected | none | the repository, the branch, how many files changed, and what permission mode it was launched under |
  | nothing running | no sessions at all | none | says so for the estate, not per project |
  |---|---|---|---|
  | empty | no session ever opened | none | says how to start one rather than showing three empty columns |
  | success | sessions exist | none | waiting agents sort to the top; a finished one dims and keeps its exit code |
  | detached | the console cannot attach | none | says so and leaves the rest of the screen usable; a detached console is a view problem, never a stopped agent |
  | backend-lost | Fabric lost the agent's backend | none | the agent's row and console say "connection to the agent lost"; input is off; the agent is not shown as stopped |
  | repo unreadable | git fails for that project | none | the failure replaces the branch; a stale branch is never shown as current |
- **Coverage:** the list order, the attach lifecycle and the ended-session snapshot — `apps/desktop/src/renderer/src/EstateAgents.tsx`, `apps/desktop/src/shared/sessionOrder.ts`, `apps/desktop/src/renderer/src/TerminalView.tsx`, `apps/desktop/src/shared/sessionOrder.test.ts`, `apps/desktop/src/renderer/src/EstateAgents.terminal.test.tsx`. NOT covered: the launch control at the head of the list, the task the agent holds, and view-files — all named in Elements and none built
- **Scenarios:** SCN-049, SCN-052, SCN-053, SCN-091
- **Resources:** the PTY manager, `agent_stages`, `project_repos`, journal
- **Status:** designed
- **Planned extension (not current coverage):** Agent/project scoped recorded-history preview and TaskRun widget; binding/session/runner identities are separate. FLW-27; SCN-052/053/058. See [engineering contract](../architecture/system-contract.md).
- **Planned extension — V1 context panels (target, not current coverage):** правая колонка «Where it is working» расширяется до контекстных панелей SCN-091 в порядке Вопросы → Сейчас → Было → Дальше → Решения: (1) вопрос выбранного агента с ответом inline — переиспользуется механизм `BoardPanel.tsx#AnswerForm`, не второй; (2) бриф задачи что/зачем/ожидаемый результат — сегодня отсутствует на этой поверхности, единственный дом — `TaskPage.tsx`; (3) заявление агента рядом с наблюдением (уже правило центра) и план закрыто/сейчас/дальше; (4) «что агент сделал» — существующая журнальная панель центра; (5) хронология команд и ответов оператора ЭТОМУ агенту — сегодня отсутствует в рендерере целиком. Место работы (repo/branch/changed) остаётся строкой в той же колонке. FLW-54; SCN-091/092; план: `docs/ux/plans/2026-09-12-v1-context-reentry.md`, веха V1-M1.
- **Addressable subviews (target only):** Agent detail is a selected binding/session subview here with stable scope/ref. Provider/binding, native transport and TaskRun identities remain separate; SCR-25 remains the single live terminal renderer and SCR-44 owns manager authority lifecycle.

## Engineering contract additions — 2026-09-07

Target design only; [shared contract](../architecture/system-contract.md) and proposed ADR-0045–0047 govern the new semantics. These records do not assert shipped screens.

### SCR-40: Graph explorer family
- **Amended 2026-10-24 (0.3.12 W2 S5, SCN-175; 0.3.12 release review, iteration 1, UX-1, UX-9):** a fourth view of the family ships: the project graph (`apps/desktop/src/renderer/src/launch/GraphScreen.tsx`). Businesses are columns; lines are the relations the onboarding agents recorded, and a dashed line joins two projects that share board threads; whole from «Граф проектов», or one project with only its direct neighbours from the rail's graph mark or «Связи». Of the states below it has loading, empty («Связи ещё не найдены. Они появятся, когда агенты познакомятся с проектами.») and error («Не удалось прочитать граф.» with the machine's words beneath, read again when the journal moves); the relation legend and «Повторить» are not built (CO-418, 0.3.13). The three recorded-history and plan views keep this record.
- **Used by:** FLW-23, FLW-27
- **Purpose:** Three addressable semantic views: agent recorded history, project recorded history, target plan. SCR-33 remains decision history. S10 must explicitly reconcile ADR-0042 screen wording before implementation.
- **Elements:** Route title and scope; as-of/plan revision; selected entity; graph/outline/list presentation of identical semantics; relation legend; source inspector; coverage, cursor and hidden counts; backlinks. Local routes `/graphs/agent-history`, `/graphs/project-history`, `/graphs/target-plan`; these are separate destinations, not one DID/SHOULD toggle.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | No successful snapshot | none | Name scope and source read; no invented totals. |
  | empty | All required sources successfully read and no nodes | none | Explain absence; retain direction link or create-first-work action where authorized. |
  | unlinked | Nodes exist but no supported edges | none | Show readable list and say no recorded relations; do not invent a graph. |
  | history | DID route snapshot available | none | Show recorded transitions/source-labelled causal relations; do not enforce normative dependency DAG on history. |
  | plan | SHOULD revision selected | none | Show declared goal/task membership and dependencies; completed membership stays in denominator. |
  | partial | Any source failed/truncated/legacy incomplete | none | Keep known nodes, boundary stubs and exact/at-least/unknown totals; offer retry/more. |
  | live update | New events after current as-of | none | Show pending updates without replacing selected history/revision/focus. |
  | error | Initial or refresh query fails | none | Initial error offers retry; refresh retains last snapshot with age. |
  | source missing | Linked source absent or denied | none | Keep selected node and parent context; explain only permitted missing information. |
- **Coverage:** none yet
- **Scenarios:** SCN-046, SCN-052, SCN-053, SCN-058
- **Resources:** GraphReadService target contract; journal/projections, TaskRun+plan revisions, typed task links, questions/answers, handoffs/needs, source receipts. Future implementation: GraphExplorerPage.tsx; not current Coverage.
- **Status:** designed

### SCR-41: Ranked Board and question detail
- **Amended 2026-10-23 (0.3.12, CO-400; [the walk](../evidence/plans/2026-10-15-fabric-simple/2026-10-23-operator-walk.md)), what ships today:** the Board screen is a kanban (SCN-173): four columns in the enforced order, «Очередь», «В работе», «На проверке», «Готово», with the project filter; a card opens the task's page (SCR-32). The ranked list of what waits for the person is the same screen's second mode, reached from «Нужны вы» on Главная, and lists only the person's part (CO-391). Code: `apps/desktop/src/renderer/src/launch/BoardScreen.tsx`, `apps/desktop/src/renderer/src/launch/KanbanBoard.tsx`. Flow: FLW-99.
- **Amended 2026-10-24 (0.3.12 S7, CO-401; 0.3.12 release review, iteration 1, DO-5, UX-2, UX-19, ER-9, DA-6):** the kanban's agent filter, «Показывать отменённые» (a fifth column «Отменено», the most recently cancelled first) and the filters remembered for the next visit are built. The agent filter applies to «В работе» only and says so. Each empty column says «Пусто»; a board that cannot be read says «Доску не удалось прочитать.» with the machine's words beneath and no «Повторить», keeping its last reading on screen; a column that could not be read says so in its place. «Нужны вы» lists only the person's part, each row naming who asks, with the tabs «Актуальное», «Решат агенты» (reviews, proposals and abandoned work an agent can settle), «На следующий раз», «Разобрано», «Все темы»; empty, it says «Ничего не ждёт вашего решения». Which of the two views is open is part of the way back from a task.
- **Amended 2026-10-24, iteration 2 (0.3.12 release review, iteration 2, UX-2, UX-4, ER-8):** the second tab is «На проверке» (reviews, proposals, abandoned work; empty «Нечего проверять.»), with its own read: a failure and a list cut at 100 rows are said; the tab is part of the way back.
- **Amended 2026-10-24, iteration 3 (0.3.12 release review, iteration 3, UX-2, UX-3, ER-2, ER-3):** the tab carries its count («На проверке · N»), the list re-reads on an access request, a failed source is said on «Все», and a later failed read keeps the earlier rows with their time.
- **Amended 2026-10-26 (0.3.14, P-28, [plan](../evidence/plans/2026-10-26-release-0314-plan.md)), what ships now (SCN-173):** a card in «В работе» names its session («Сессия <eight characters>»), a link to that agent on Агенты (SCR-87) beside the card's own press; «Брошено», a column right after «В работе» with its explaining line, holds work no claim and no live session is on, uncounted in «В работе»; «Готово» pages with «Показать ещё 20» when its page was cut (`apps/desktop/src/renderer/src/launch/KanbanBoard.tsx#KanbanBoard`; `apps/desktop/src/shared/taskBoard.ts#composeTaskBoard`; test `KanbanBoard.test.tsx`).
- **Amended 2026-10-26 (the 0.3.14 release review, iteration 1, [plan](../evidence/plans/2026-10-26-release-0314-plan.md#review-iteration-1)), what ships now (SCN-173):** a «Брошено» card names its session as text, «Сессия <eight characters> больше не на связи», no link (UX-1); the link's name is «Сессия <id>: открыть агента» (UX-6); «Показать ещё 20» says «Читаем ещё…» while it reads and stops at 500 with a sentence that older finished tasks are not listed (UX-5); «Брошено» is drawn as the other columns, its note quiet (UX-4; `apps/desktop/src/renderer/src/launch/KanbanBoard.tsx#KanbanBoard`, `apps/desktop/src/renderer/src/launch/launch.css`).
- **0.3.7 target (2026-10-17, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** superseded by «Ждёт вас» on Главная SCR-85 and «Вопросы» and «Доска» on Проект SCR-86 — the Board is no longer a place of its own, and its review ritual and access-request items go (plan §1, §5; ADR-0160 §3). It stays built until wave 3.
- **Used by:** FLW-25, FLW-26, FLW-27, FLW-28, FLW-29, FLW-75; FLW-99 (0.3.12)
- **Purpose:** One scoped union of unresolved authored questions and derived obligations, separate from task Kanban; one source for home top5/project top10/full/counters.
- **Elements:** Scope/filter/grouping, stable rank with component disclosure, canonical selected item, owner/age/source/blockers, options with consequences, answer draft, commit receipt and continuation receipt separately, full-list cursor. Grants route to SCR-24 authority detail where needed.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | No successful union read | none | No zero badge or clear claim. |
  | empty | Complete unresolved query returns zero | none | Only state no unresolved items in this scope; do not claim autonomous work is succeeding. |
  | open question | Selected authored question open | none | Answer form tied to question revision; impacts and primary action visible. |
  | derived obligation | Review/refusal/lease/proposal unresolved | none | Offer the action that resolves underlying state; no dismiss/read action. |
  | access request | A registered agent's request waits for consent (SCN-132, ADR-0115) | none | Titled "<agent> asks to use <product>"; the native prompt's facts as a block — who it is, what it asks, its reason as its claim, the same-user floor, whether it adds to access, that access lasts a year — then Deny and Allow (or "Allow and connect <product>") in their own row; settles to Allowed or Denied, and an Allow whose product could not be opened says so beside it; leaves when answered or expired. In the operator's language. |
  | delivery unknown | Possible write without conclusive receipt | none | Keep committed answer visible; inspect addressed session; no automatic resend or closed-loop claim. |
  | delivery queued | Another dispatcher owns a fenced pending instruction | none | Show waiting separately from written and accepted. |
  | submitting | Answer command pending | none | Retain draft and identity; prevent duplicate submission, support same command retry. |
  | committed | Answer accepted | none | Show decision receipt and remaining blockers; delivery remains separate. |
  | continuing | Response not yet acknowledged | none | Queued/delivering/acked/retryable/needs restart visible with exact target. |
  | conflict | Another answer or revision won | none | Show current receipt and preserve unsent draft for copying; no overwrite. |
  | partial or stale | Union source failed or aged | none | Retain known rows and coverage; do not silently re-rank while interacting. |
  | resolved history | Resolved item reached by link | none | Open immutable receipt with return, not fake missing/open item. |
- **Coverage:** `apps/desktop/src/renderer/src/launch/BoardScreen.tsx` (the kanban and the person's part; 0.3.11, 0.3.12), `apps/desktop/src/renderer/src/launch/KanbanBoard.tsx`, `apps/desktop/src/main/workRead.ts#readTaskBoard`, with `BoardScreen.test.tsx` and `KanbanBoard.test.tsx`
- **Scenarios:** SCN-050, SCN-051, SCN-053, SCN-055, SCN-058
- **Resources:** QuestionService, BoardService, AnswerService, ContinuationService target contracts; questions/question_blocks, current obligations, command and decision receipts.
- **Status:** built

### SCR-42: Inbox
- **Superseded 2026-10-17 by the 0.3.7 target ([ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** the Inbox and Pulse are cut (0.3.7 plan §2, §5; SCN-055, SCN-094 retired): what needs the person is Главная, SCR-85; what happened is История, SCR-88. Kept as the record of the design.
- **Used by:** FLW-21, FLW-29
- **Purpose:** A view of attention owed and informational events, with operator-specific read state only for the informational lane.
- **Elements:** Needs you/Happened lanes; source coverage/freshness; project/kind/time filters; canonical source links; sanitized detail disclosure; mark-visible-read only in Happened; stable cursor.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | empty | Successfully read lane has no items | none | Name scope and last read; not an assertion all modules are healthy. |
  | needs-you | Unresolved Board items | none | Use same Board query and exact resolving action; no mark-read/dismiss. |
  | happened | Notable events present | none | Show actor/project/source/time; read state per operator. |
  | partial | Some producers unavailable/planned | none | Name missing coverage; never count as zero. |
  | reconnecting | Live observation resumes | none | Dedup source events; keep cursor and selection; read watermark unchanged. |
  | error | Read fails | none | Keep last-good lane with age and retry. |
  | source unavailable | Deep link cannot resolve | none | Retain event and return; permitted explanation, no arbitrary fallback. |
- **Coverage:** none yet
- **Scenarios:** SCN-044, SCN-055, SCN-058
- **Resources:** BoardService and safe notable-event query; journal, read cursor/preferences scoped to operator.
- **Status:** retired

### SCR-43: Cycles
- **0.3.7 target (2026-10-17, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** the project's Automations section is cut (plan §5; SCN-056 retired); this estate-level design stays designed and off the rail.
- **Used by:** FLW-30
- **Purpose:** Inspect every declared cycle with configuration, observed health and last outcome separated; unavailable detectors remain unknown.
- **Elements:** Kind/project/cadence/placement/enabled columns; observed health/source/age; last tick/start/outcome; next due with policy/timezone; filter/sort; source inspector; guarded wake; planned/coverage badges.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | planned | Cycle capability not implemented | none | Label planned; no fake cadence success. |
  | disabled | Configuration disabled | none | Show any already inflight work separately. |
  | scheduled | Valid cadence with available scheduler | none | Show next due policy, not prediction of success. |
  | not due or skipped | Tick receipt records no work | none | Name reason; no failure inferred. |
  | inflight | Admitted tick/task executing | none | Show source TaskRun and independent health. |
  | unknown | No usable detector or app-off observation | none | Say coverage absent; do not invent stalled. |
  | exception | Verified failure/stall/missing input | none | Named cause, receipt and resolving action. |
  | partial/error | Store or detector unavailable | none | Retain previous state with age and source coverage. |
  | wake pending | Manual request submitted | none | Show admitted/refused/coalesced; success only after outcome receipt. |
- **Coverage:** none yet
- **Scenarios:** SCN-056, SCN-058
- **Resources:** CycleReadService target; S15 tick receipts, routines/chain configs, M178–M181 detectors where available.
- **Status:** designed

### SCR-44: Manager lifecycle
- **Used by:** FLW-34
- **Purpose:** Inspect or change the estate CEO/project product-manager assignment without losing authority, evidence or continuity.
- **Elements:** Role slot and scope; configured binding/provider/profile revisions; host/runner/authority/source readiness; budget and usage coverage; fixed tool/checker boundary; replace/suspend action; checkpoint, epoch/fence and continuation receipts; invocation/pack links.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | Slot or readiness sources loading | none | Preserve scope; configured identity is not a live health measurement. |
  | empty | No configured slot binding | none | Show eligible choices and unmet gates without inventing a default manager. |
  | ready | Certified profile and current admission prerequisites | none | Allow the authorised next action; placement and cost coverage remain visible. |
  | handoff | Replacement accepted | none | Show stop admissions, checkpoint/drain, invalidate old epoch, admit new binding/context and acknowledgement separately. |
  | unknown | Host offline, app closed or detector unavailable | none | Keep configured choice and last outcome; do not claim always-on execution or dead process. |
  | revoked | Authority suspended or old epoch invalidated | none | Old writer cannot mutate; possible residual native process is separately observed or unknown. |
  | error | Admission, checkpoint or reconciliation failed | none | Keep previous evidence and safe transitioning/suspended state with the exact recovery boundary. |
  | success | Binding/continuation receipt recorded | none | Show the exact committed assignment and acknowledged invocation; history and memory remain linked. |
  | stale | Source/policy/binding revision changed | none | Keep the aged snapshot; require current readiness before a dependent mutation. |
- **Coverage:** none yet
- **Scenarios:** SCN-061
- **Resources:** RoleSlot, Binding, Readiness, ManagerInvocation and M194 BindCommand target DTOs; proposed manager ADR and canonical sibling compatibility gate; [shared engineering contract](../architecture/system-contract.md).
- **Implementation tasks:** M194, M166, M167, M175, M176, S15, S02, S03.
- **Prototype:** [target prototype](../reports/product.html#screen-SCR-44) — fictional fixture; not product coverage.
- **Status:** designed


### SCR-45: Retrospectives
- **Superseded 2026-10-17 by the 0.3.7 target ([ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** the Retro section is cut (0.3.7 plan §5; SCN-062 retired); episodes are acts read in История, SCR-88.
- **Used by:** FLW-35
- **Purpose:** Turn distinct observed occurrences into checked corrective work and a verified or regressed lesson.
- **Elements:** Category/scope/subject; episode applicability and state; distinct occurrence evidence; proposed resolution and recorded rationale; checker result; process question/task links; verification window and required sources; dismiss/history controls.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | Episode/source read pending | none | No zero occurrence count or verified badge before coverage arrives. |
  | empty | Complete episode read returns none | none | Explain the measured scope; no claim that agents or processes never fail. |
  | observing | Incidents insufficient or unverified | none | Separate verified-distinct and unknown counts; repeated reports of one incident count once. |
  | proposed | Correction has not passed review | none | Show basis, checker and owner; agent prose is not authority. |
  | verifying | Corrective work accepted or implemented | none | Show expected signals and observation window; task done is not lesson verified. |
  | success | Verification evidence satisfies the declared plan | none | Show verified outcome with source receipts; retain original incident and change. |
  | regressed | Later qualifying occurrence contradicts the lesson | none | Preserve prior verified history and show the new evidence for review. |
  | dismissed | Owning lifecycle records dismissal | none | Keep basis/history and durable suppression; replay does not resurface a dismissed duplicate. |
  | error | Required source unavailable or version conflict | none | Keep known episode; result unknown or review required, not verified. |
  | stale | Applicability or source revision aged | none | Recheck before correction/verification; preserve selected episode. |
- **Coverage:** none yet
- **Scenarios:** SCN-062, SCN-063
- **Resources:** Episode, Occurrence and ResolutionProposal; process questions use target kind=decision/topic=process, not a silent enum addition; [shared engineering contract](../architecture/system-contract.md).
- **Implementation tasks:** M154, M182, M184, M168, S15, S14.
- **Prototype:** [target prototype](../reports/product.html#screen-SCR-45) — fictional fixture; not product coverage.
- **Status:** retired


### SCR-46: Service feedback settings
- **Used by:** FLW-35
- **Purpose:** Explain local collection and exact outbound eligibility, delivery, suppression and retention limits.
- **Elements:** Separate local-intake and outbound settings; activation gate and policy/schema revisions; eligible service categories; exact payload preview and omissions; metadata/retention disclosure; durable outbox/suppression states; server receipts; opt-out and quarantine.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | Policy/outbox source read pending | none | Do not imply that export is enabled or safe; dispatch fails closed without current policy/suppression. |
  | local-only | No activated outbound endpoint/privacy contract | none | Local default-on collection is separate; outbound stays inactive. Proposed ADR-0047 default is not accepted by this UI. |
  | empty | No eligible local candidates after complete read | none | No fabricated transmission history or all-safe claim. |
  | preview | Candidate and schema available | none | Display exact allowlisted bytes/fields plus relevant metadata/retention disclosure; removing IDs does not prove anonymity. |
  | pending | Eligible outbox intent exists | none | Show policy revision and stable delivery identity; pending is not sent. |
  | opted-out | Operator disables outbound | none | Suppress pending; do not reactivate suppressed backlog on re-enable. |
  | unknown | Attempt may have reached endpoint before opt-out | none | State that dispatch cannot be recalled; wait for server receipt/reconciliation. |
  | success | Endpoint has an accepted receipt | none | Name actual receipt and retention/deletion capability; do not promise remote erasure. |
  | quarantined | Restored policy/outbox or missing current suppression proof | none | Remain outbound-off until the separate activation/revalidation contract is satisfied. |
  | error | Payload gate, endpoint or local policy read fails | none | Preserve safe local state and named refusal; secrets/raw text are not printed in error. |
  | stale | Policy/schema/consent changed | none | Invalidate old eligibility preview; recheck current suppression before dispatch. |
- **Coverage:** none yet
- **Scenarios:** SCN-063
- **Resources:** M183 local/upstream target DTOs; proposed privacy ADR-0047; actual endpoint/schema/transport metadata/retention activation gates; [shared engineering contract](../architecture/system-contract.md).
- **Implementation tasks:** M183.local, M183.upstream, M182, S12, S14.
- **Prototype:** [target prototype](../reports/product.html#screen-SCR-46) — fictional fixture; not product coverage.
- **Status:** designed


### SCR-47: Storage and sync
- **Used by:** FLW-36
- **Purpose:** Inspect data authority, declared mirror coverage, import plans and recoverable operations without treating cache or YAML as complete history.
- **Elements:** Five storage classes; endpoint identity safe; source/export cursor and projector version; per-store availability; mirror coverage/checksums/divergence; import validation/preview/digest/path rebindings; operation receipts; verified backup/rebuild links.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | Storage sources loading | none | Name requested authority; no fabricated current/synced badge. |
  | empty | Mirror or backup not configured | none | Show not configured and eligible setup; not zero data. |
  | partial | Manifest excludes entity kinds or legacy format | none | Name included/excluded coverage; do not advertise full-restorable state. |
  | diverged | Generated file changed locally | none | Show diff and review before overwrite; no automatic reverse sync or git push. |
  | preview | Import validated before mutation | none | Show stable IDs, expected empty target/revision, digest, missing relations and path rebindings. |
  | importing | Atomic import command pending | none | Preserve operation identity; unknown response is reconciled rather than repeated under new identity. |
  | conflict | Target revision or emptiness changed | none | No mixed/partial import; preserve reviewed input and offer revalidation. |
  | success | Operation/generation verified | none | Show exact receipt and coverage; mirror still is not backup. |
  | error | Validation/write/rebuild/read failure | none | Keep old readable generation; identify the failed source or operation. |
  | stale | Source cursor ahead or authority unavailable | none | Show distinct source and exported watermarks with age, never current from an empty cache. |
- **Coverage:** none yet
- **Scenarios:** SCN-064, SCN-065
- **Resources:** MirrorManifestV2, ImportPlan, StorageRead and OperationReceipt target contracts; coherent BackupArchive is separate; [shared engineering contract](../architecture/system-contract.md).
- **Implementation tasks:** S12, S14, M198, M191, S02.
- **Prototype:** [target prototype](../reports/product.html#screen-SCR-47) — fictional fixture; not product coverage.
- **Status:** designed


### SCR-48: Restore
- **Used by:** FLW-36
- **Purpose:** Restore an archive's history into a new Estate owned by the operator, then open it by choice ([ADR-0079](../adr/0079-private-conversation-archives-preserve-history-not-authority.md)).
- **Elements:** Choose archive (primary while empty); verification result with a named reason; the new Estate's name; Restore (primary after verification); three result facts — history restored, access verified, not opened yet; Open this Estate with a restart notice (primary after restore); Stay here.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | Archive or operation read pending | none | Show the operation, not a restored Estate. |
  | empty | No archive chosen | none | Explain what an archive restores (history only) and choose one; nothing is written. |
  | verifying | Format, limits, completeness and digest being checked | none | Nothing is written until the archive passes. |
  | refused | Archive fails a check | none | Name the reason (not a Fabric archive, too large, incomplete, altered, unsupported version); nothing was written. |
  | restoring | Restore running | none | One step: new Estate, same owner, history; input retained. |
  | result-unknown | Reply lost | none | Check again with the same operation; never start a second restore. |
  | history-restored | Restore committed | none | History restored; access verified; not opened yet. No queued work, no running agent, no restored grant. |
  | opening | Open chosen | none | The Estate is recorded as active; Fabric restarts into it. |
  | opened | After the restart | none | The restored Estate is the active one. |
  | denied | Operator is not the owner of the current Estate | none | Restore unavailable, with the reason; nothing written. |
  | error | Restore failed | none | Everything rolled back; no half-created Estate; the archive file is untouched. |
- **Coverage:** `apps/desktop/src/renderer/src/PrivateHistoryPanel.tsx` (the restore section) over `apps/desktop/src/main/privateHistory.ts` and `restore_estate_verified`; Open this Estate records the choice (`apps/desktop/src/main/activeEstate.ts`) and restarts.
- **Scenarios:** SCN-065
- **Resources:** ADR-0079; [restore authority](../launch/harness-r0/restore-authority.md#native-compatibility-follow-up--2026-09-27); first-slice plan A1-3, A1-6.
- **Implementation tasks:** A1-3, A1-6; S12, S14.
- **Prototype:** [target prototype](../reports/product.html#screen-SCR-48) — fictional fixture; not product coverage.
- **Status:** designed

### SCR-49: Маршрут работы
- **Purpose:** Редактировать этапы, отделы, навыки и gates без изменения уже начатого прогона.
- **Elements:** Изменение → проверка этапов → причина → новая версия → будущий допуск. Начатый прогон закреплён на прежней версии.
- **Primary action:** Изменение
- **Scenarios:** SCN-068
- **Flows:** FLW-37
- **Implementation tasks:** M18
- **Prototype:** [Адрес макета](../reports/product.html#view-pipeline); контракт [mockup-contract.md](mockup-contract.md).
- **Status:** designed
- **Coverage:** none yet

| State | Trigger | Animation | Behavior |
|---|---|---|---|
| loading | соответствующий ответ источника | none | Чтение собственного источника; не показывать выдуманные нули. |
| empty | соответствующий ответ источника | none | Подтверждённое отсутствие записей с действием начала работы. |
| error | соответствующий ответ источника | none | Источник или проверка отказали; черновик сохранён и ошибка названа. |
| success | соответствующий ответ источника | none | Изменение → проверка этапов → причина → новая версия → будущий допуск. Начатый прогон закреплён на прежней версии. |
| permission | соответствующий ответ источника | none | Нет допуска — защищённые данные скрыты, изменение заблокировано. |
| stale | соответствующий ответ источника | none | Показать разрешённый снимок; изменение только после повторного чтения. |

- **Domain states:** stage-edit, validation-error, version-preview, committed, old-version-pinned.


### SCR-50: Цели и приёмка
- **Purpose:** Задать цель, критерии, границы автономности и состав задач; принять результат отдельно от выполнения задач.
- **Elements:** Цель → критерии → задача в плане → результат → явная приёмка. Непривязанные задачи и неготовые критерии остаются видимыми.
- **Primary action:** Цель
- **Scenarios:** SCN-137
- **Flows:** FLW-38
- **Implementation tasks:** M144
- **Prototype:** [Адрес макета](../reports/product.html#view-goals); контракт [mockup-contract.md](mockup-contract.md).
- **Status:** designed
- **Coverage:** none yet

| State | Trigger | Animation | Behavior |
|---|---|---|---|
| loading | соответствующий ответ источника | none | Чтение собственного источника; не показывать выдуманные нули. |
| empty | соответствующий ответ источника | none | Подтверждённое отсутствие записей с действием начала работы. |
| error | соответствующий ответ источника | none | Источник или проверка отказали; черновик сохранён и ошибка названа. |
| success | соответствующий ответ источника | none | Цель → критерии → задача в плане → результат → явная приёмка. Непривязанные задачи и неготовые критерии остаются видимыми. |
| permission | соответствующий ответ источника | none | Нет допуска — защищённые данные скрыты, изменение заблокировано. |
| stale | соответствующий ответ источника | none | Показать разрешённый снимок; изменение только после повторного чтения. |

- **Domain states:** draft, task-linked, ready-for-review, rejected, accepted, superseded.


### SCR-51: Квоты и использование
- **Purpose:** Различать доступную квоту провайдера, ёмкость автоматизаций, записанные расходы и подписку Estate.
- **Elements:** Показатель → источник и срок сброса → ограниченная возможность → допустимое действие восстановления. Неизмеренные расходы не становятся нулём; цена без решения не подставляется.
- **Primary action:** Показатель
- **Scenarios:** SCN-070
- **Flows:** FLW-39
- **Implementation tasks:** M83, M94
- **Prototype:** [Адрес макета](../reports/product.html#view-usage); контракт [mockup-contract.md](mockup-contract.md).
- **Status:** designed
- **Coverage:** none yet

| State | Trigger | Animation | Behavior |
|---|---|---|---|
| loading | соответствующий ответ источника | none | Чтение собственного источника; не показывать выдуманные нули. |
| empty | соответствующий ответ источника | none | Подтверждённое отсутствие записей с действием начала работы. |
| error | соответствующий ответ источника | none | Источник или проверка отказали; черновик сохранён и ошибка названа. |
| success | соответствующий ответ источника | none | Показатель → источник и срок сброса → ограниченная возможность → допустимое действие восстановления. Неизмеренные расходы не становятся нулём; цена без решения не подставляется. |
| permission | соответствующий ответ источника | none | Нет допуска — защищённые данные скрыты, изменение заблокировано. |
| stale | соответствующий ответ источника | none | Показать разрешённый снимок; изменение только после повторного чтения. |

- **Domain states:** measured, unavailable, quota-limited, reset-pending, capacity-paused, terms-open.


### SCR-52: Настройки рабочего пространства
- **0.3.7 target (2026-10-17, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** superseded by Настройки SCR-89 (SCN-170); the coding agents on this computer move to Агенты SCR-87. It stays built until wave 4.
- **Purpose:** Настроить тему, локаль, поведение пробуждения, хранение и допустимые проектные ограничения.
- **Elements:** Глобальная настройка → проектный override → проверка сужения прав → новая ревизия. Повышение прав не следует из настройки интерфейса. Переключатель «Делиться счётчиками использования» — один для всех приложений PassionCode (SCN-134, [ANALYTICS.md](../ANALYTICS.md)).
- **Primary action:** Глобальная настройка
- **Scenarios:** SCN-071, SCN-134, SCN-135, SCN-160
- **Used by:** FLW-40
- **Flows:** FLW-40
- **Implementation tasks:** M72, M73, M152
- **Prototype:** [Адрес макета](../reports/product.html#view-estate-settings); контракт [mockup-contract.md](mockup-contract.md).
- **Status:** designed
- **Coverage:** apps/desktop/src/renderer/src/launch/SettingsScreen.tsx (2026-10-14: the screen, the agents on this computer from Switchboard's catalogue or Fabric's own detection, the launch fallback order, sleep, look, and data and access — usage counts and the buttons to private history and Agent access), apps/desktop/src/renderer/src/UsageCountsSetting.tsx, apps/desktop/src/renderer/src/UsageCountsNotice.tsx, apps/desktop/src/renderer/src/FallbackOrderSetting.tsx; the estate-scoped half (estate name, default memory, CEO trust, project priority) is designed, not built

| State | Trigger | Animation | Behavior |
|---|---|---|---|
| loading | соответствующий ответ источника | none | Чтение собственного источника; не показывать выдуманные нули. |
| empty | соответствующий ответ источника | none | Подтверждённое отсутствие записей с действием начала работы. |
| error | соответствующий ответ источника | none | Источник или проверка отказали; черновик сохранён и ошибка названа. |
| success | соответствующий ответ источника | none | Глобальная настройка → проектный override → проверка сужения прав → новая ревизия. Повышение прав не следует из настройки интерфейса. |
| permission | соответствующий ответ источника | none | Нет допуска — защищённые данные скрыты, изменение заблокировано. |
| stale | соответствующий ответ источника | none | Показать разрешённый снимок; изменение только после повторного чтения. |

- **Domain states:** inherited, overridden, validation-error, saved, read-only.
- **Amended 2026-10-14 (wave 3, SCN-160 — BUILT):** Settings is a screen of its own, not a band over another page; the page it was opened over stays mounted underneath (`SettingsScreen.tsx#SettingsScreen`). It groups «Агенты для кода на этом компьютере» (`AgentCatalogPanel`: Fabric's own detection — version and path, not answering, or not installed with the vendor's install command — joined with Switchboard's catalogue when Switchboard 0.6.31+ publishes one; the line above the list says which source is shown: «Читаю каталог агентов…», from Switchboard, Switchboard absent, older than 0.6.31, or its read failed with the reason; a detection that failed says «Не удалось поискать агентов: …»; under the list, that enabling, disabling and the default agent are Switchboard's), «Запуск» (the fallback order), «Компьютер» (sleep, with what the OS will not do), «Вид» (theme, language) and «Данные и доступ» (usage counts, private history and restore, Agent access). Where the amendments below say "the Settings band" or "the settings band", read this screen.
- **Amended 2026-10-15 (release review i3 UX-5):** the index says `built` for the screen and its agent catalogue (SCN-160); the estate-scoped half of this record stays designed, not built.
- **Amended 2026-10-15 (release review i2 DO-3):** the agent catalogue's states — Switchboard's catalogue read; too old; not installed; a format this Fabric does not read (said in words); the read failed (our sentence, the machine's reason on a second line) — each still lists what Fabric found on this computer; an agent Switchboard says nothing about carries no installed/missing pill.
- **Amended 2026-10-13 (wave 4, COM-06 — designed, NOT built):** the Settings band (superseded 2026-10-14: Settings is a screen, see the amendment above; the entry is on that screen) carries an entry "Project directory" / «Каталог проектов» that opens SCR-83: which projects other projects can find, with the preview of what they see; the owner changes it (SCN-149, FLW-92). It replaces the declared stub of CO-286.
- **Amended 2026-10-11 (0.4.0 REQ-41, REQ-39):** Settings carries an entry «Coding agents and products» that opens SCR-77 — the coding agents on this Mac and the family's products, each product × agent verified by observation (SCN-139), and the family's agents step for an estate that skipped it in the first run (SCN-138). The page of its own with Agents & access first is REQ-21's (wave 6).
- **Amended 2026-10-08 (0.3.3 verification DO-13, UX-7):** the settings band of the app carries two 0.3.3 parts of
  this screen. *Share usage counts* (SCN-134, `UsageCountsSetting.tsx`) is one of the two places that answer the
  usage-counts disclosure; the other is the first-run notice at the top of the window (`UsageCountsNotice.tsx`,
  ADR-0127) — states: pending (the note, "nothing has been sent yet" or, for an install that already sent, that an
  earlier version may already have sent them; the switch, on; Continue), saving, failed (the notice stays and says nothing is sent), answered
  (gone). *Fallback order* (SCN-135, `FallbackOrderSetting.tsx`, ADR-0125): heading, note, one aligned row per
  coding agent with its session choice and Up, Down, Remove named for that agent, and Add. The prototype does not
  draw either yet (CO-225).


### SCR-53: Уведомления и маршруты
- **Purpose:** Настроить адрес и типы уведомлений с явным scope; не потерять обязательство после прочтения события.
- **Elements:** Личная привязка → подтверждение субъекта → выбор проектного маршрута → review раскрытия → правило → квитанция доставки. Отказ запроса полномочия остаётся отдельным обязательством.
- **Primary action:** Личная привязка
- **Scenarios:** SCN-072
- **Flows:** FLW-41
- **Implementation tasks:** M159, M160, M161, M162, M163, M164, M165
- **Prototype:** [Адрес макета](../reports/product.html#view-notifications); контракт [mockup-contract.md](mockup-contract.md).
- **Status:** designed
- **Coverage:** none yet

| State | Trigger | Animation | Behavior |
|---|---|---|---|
| loading | соответствующий ответ источника | none | Чтение собственного источника; не показывать выдуманные нули. |
| empty | соответствующий ответ источника | none | Подтверждённое отсутствие записей с действием начала работы. |
| error | соответствующий ответ источника | none | Источник или проверка отказали; черновик сохранён и ошибка названа. |
| success | соответствующий ответ источника | none | Личная привязка → подтверждение субъекта → выбор проектного маршрута → review раскрытия → правило → квитанция доставки. Отказ запроса полномочия остаётся отдельным обязательством. |
| permission | соответствующий ответ источника | none | Нет допуска — защищённые данные скрыты, изменение заблокировано. |
| stale | соответствующий ответ источника | none | Показать разрешённый снимок; изменение только после повторного чтения. |

- **Domain states:** unbound, challenge, bound, route-review, muted, consent-required, delivery-unknown.


### SCR-54: Диагностика
- **Superseded 2026-10-17 by the 0.3.7 target ([ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** Diagnostics is cut (0.3.7 plan §5; SCN-073 retired); a failure is an act read in История, SCR-88, with our sentence and the machine's words beneath it.
- **Purpose:** Прочитать состояние источников и безопасный журнал; экспортировать проверяемый набор без секретов.
- **Elements:** Проблема → диагностика источника → отбор безопасных строк → предпросмотр → локальный экспорт. Недоступность источника и пустой журнал различаются.
- **Primary action:** Проблема
- **Scenarios:** SCN-073
- **Flows:** FLW-42
- **Implementation tasks:** M81
- **Prototype:** [Адрес макета](../reports/product.html#view-diagnostics); контракт [mockup-contract.md](mockup-contract.md).
- **Status:** retired
- **Coverage:** none yet

| State | Trigger | Animation | Behavior |
|---|---|---|---|
| loading | соответствующий ответ источника | none | Чтение собственного источника; не показывать выдуманные нули. |
| empty | соответствующий ответ источника | none | Подтверждённое отсутствие записей с действием начала работы. |
| error | соответствующий ответ источника | none | Источник или проверка отказали; черновик сохранён и ошибка названа. |
| success | соответствующий ответ источника | none | Проблема → диагностика источника → отбор безопасных строк → предпросмотр → локальный экспорт. Недоступность источника и пустой журнал различаются. |
| permission | соответствующий ответ источника | none | Нет допуска — защищённые данные скрыты, изменение заблокировано. |
| stale | соответствующий ответ источника | none | Показать разрешённый снимок; изменение только после повторного чтения. |

- **Domain states:** healthy, partial, source-error, filtered, redacted-export.


### SCR-55: Архив и удаление
- **Purpose:** Отделить обратимое архивирование проекта от необратимого удаления данных.
- **Elements:** Review активной работы → архив → восстановление, либо отдельное удаление с повторной проверкой условий и подтверждением точного объекта.
- **Primary action:** Review активной работы
- **Scenarios:** SCN-074
- **Flows:** FLW-43
- **Implementation tasks:** M77
- **Prototype:** [Адрес макета](../reports/product.html#view-archive); контракт [mockup-contract.md](mockup-contract.md).
- **Status:** designed
- **Coverage:** none yet

| State | Trigger | Animation | Behavior |
|---|---|---|---|
| loading | соответствующий ответ источника | none | Чтение собственного источника; не показывать выдуманные нули. |
| empty | соответствующий ответ источника | none | Подтверждённое отсутствие записей с действием начала работы. |
| error | соответствующий ответ источника | none | Источник или проверка отказали; черновик сохранён и ошибка названа. |
| success | соответствующий ответ источника | none | Review активной работы → архив → восстановление, либо отдельное удаление с повторной проверкой условий и подтверждением точного объекта. |
| permission | соответствующий ответ источника | none | Нет допуска — защищённые данные скрыты, изменение заблокировано. |
| stale | соответствующий ответ источника | none | Показать разрешённый снимок; изменение только после повторного чтения. |

- **Domain states:** active, blocked-running, archived, restore, purge-review, purged.


### SCR-56: Редактор цикла
- **Purpose:** Определить триггер, типизированный граф данных и ограничение полных прогонов.
- **Elements:** Триггер → входы и типы → политики отсутствия/пустоты/возраста → проверка DAG → основание → новая версия → отдельные прогоны → граница → Proposal PM.
- **Primary action:** Триггер
- **Scenarios:** SCN-075
- **Flows:** FLW-44
- **Implementation tasks:** M66, M67, M68, M90
- **Prototype:** [Адрес макета](../reports/product.html#view-routine-editor); контракт [mockup-contract.md](mockup-contract.md).
- **Status:** designed
- **Coverage:** none yet

| State | Trigger | Animation | Behavior |
|---|---|---|---|
| loading | соответствующий ответ источника | none | Чтение собственного источника; не показывать выдуманные нули. |
| empty | соответствующий ответ источника | none | Подтверждённое отсутствие записей с действием начала работы. |
| error | соответствующий ответ источника | none | Источник или проверка отказали; черновик сохранён и ошибка названа. |
| success | соответствующий ответ источника | none | Триггер → входы и типы → политики отсутствия/пустоты/возраста → проверка DAG → основание → новая версия → отдельные прогоны → граница → Proposal PM. |
| permission | соответствующий ответ источника | none | Нет допуска — защищённые данные скрыты, изменение заблокировано. |
| stale | соответствующий ответ источника | none | Показать разрешённый снимок; изменение только после повторного чтения. |

- **Domain states:** draft, invalid-cycle, revision-preview, saved, paused, missing-input, empty-input, stale-input, bounded, reconciled.


### SCR-57: Сервисные терминалы
- **Purpose:** Наблюдать службы Claude Swap и agentgateway независимо от допуска агента.
- **Elements:** Выбор службы → её терминал и generation → запрос probe → измеренный healthy/unhealthy или unknown → закрытие вкладки отдельно от остановки → новая generation.
- **Primary action:** Выбор службы
- **Scenarios:** SCN-076
- **Flows:** FLW-45
- **Implementation tasks:** M10
- **Prototype:** [Адрес макета](../reports/product.html#view-service-terminal); контракт [mockup-contract.md](mockup-contract.md).
- **Status:** designed
- **Coverage:** none yet

| State | Trigger | Animation | Behavior |
|---|---|---|---|
| loading | соответствующий ответ источника | none | Чтение собственного источника; не показывать выдуманные нули. |
| empty | соответствующий ответ источника | none | Подтверждённое отсутствие записей с действием начала работы. |
| error | соответствующий ответ источника | none | Источник или проверка отказали; черновик сохранён и ошибка названа. |
| success | соответствующий ответ источника | none | Выбор службы → её терминал и generation → запрос probe → измеренный healthy/unhealthy или unknown → закрытие вкладки отдельно от остановки → новая generation. |
| permission | соответствующий ответ источника | none | Нет допуска — защищённые данные скрыты, изменение заблокировано. |
| stale | соответствующий ответ источника | none | Показать разрешённый снимок; изменение только после повторного чтения. |

- **Domain states:** unmeasured, probe-pending, healthy, unhealthy, unknown, closed-tab, exited, new-generation.


### SCR-58: Встроенный браузер
- **Purpose:** Открывать адресованную цитату с видимым адресом, историей навигации и изоляцией.
- **Elements:** Цитата → проверка http/https → предпросмотр адреса → отдельный sandbox → источник либо недоступность → назад/вперёд. Cmd-click означает явный внешний переход, popup запрещён.
- **Primary action:** Цитата
- **Scenarios:** SCN-077
- **Flows:** FLW-46
- **Implementation tasks:** M74
- **Prototype:** [Адрес макета](../reports/product.html#view-internal-browser); контракт [mockup-contract.md](mockup-contract.md).
- **Status:** designed
- **Coverage:** none yet

| State | Trigger | Animation | Behavior |
|---|---|---|---|
| loading | соответствующий ответ источника | none | Чтение собственного источника; не показывать выдуманные нули. |
| empty | соответствующий ответ источника | none | Подтверждённое отсутствие записей с действием начала работы. |
| error | соответствующий ответ источника | none | Источник или проверка отказали; черновик сохранён и ошибка названа. |
| success | соответствующий ответ источника | none | Цитата → проверка http/https → предпросмотр адреса → отдельный sandbox → источник либо недоступность → назад/вперёд. Cmd-click означает явный внешний переход, popup запрещён. |
| permission | соответствующий ответ источника | none | Нет допуска — защищённые данные скрыты, изменение заблокировано. |
| stale | соответствующий ответ источника | none | Показать разрешённый снимок; изменение только после повторного чтения. |

- **Domain states:** pending, loaded, invalid-url, source-missing, popup-blocked, external-request.


### SCR-59: Предпросмотр медиа
- **Purpose:** Показать выбранное изображение или страницу PDF с происхождением и состоянием загрузчика.
- **Elements:** Ссылка файла → точный asset → изображение или страница PDF → смена страницы → возврат к источнику. Недоступный asset и отсутствующий loader отличаются.
- **Primary action:** Ссылка файла
- **Scenarios:** SCN-078
- **Flows:** FLW-47
- **Implementation tasks:** M75
- **Prototype:** [Адрес макета](../reports/product.html#view-media-preview); контракт [mockup-contract.md](mockup-contract.md).
- **Status:** designed
- **Coverage:** none yet

| State | Trigger | Animation | Behavior |
|---|---|---|---|
| loading | соответствующий ответ источника | none | Чтение собственного источника; не показывать выдуманные нули. |
| empty | соответствующий ответ источника | none | Подтверждённое отсутствие записей с действием начала работы. |
| error | соответствующий ответ источника | none | Источник или проверка отказали; черновик сохранён и ошибка названа. |
| success | соответствующий ответ источника | none | Ссылка файла → точный asset → изображение или страница PDF → смена страницы → возврат к источнику. Недоступный asset и отсутствующий loader отличаются. |
| permission | соответствующий ответ источника | none | Нет допуска — защищённые данные скрыты, изменение заблокировано. |
| stale | соответствующий ответ источника | none | Показать разрешённый снимок; изменение только после повторного чтения. |

- **Domain states:** image, pdf-page-1, pdf-page-2, source-missing, no-loader, reveal-request.


### SCR-60: Diff выбранного файла
- **Purpose:** Сравнить точную сохранённую ревизию файла с текущим буфером.
- **Elements:** Файл → выбранные disk revision и buffer generation → вычисленная разница → unified/split → редактор. Пропавшая ревизия не подменяется пустым файлом.
- **Primary action:** Файл
- **Scenarios:** SCN-079
- **Flows:** FLW-48
- **Implementation tasks:** M76, M62
- **Prototype:** [Адрес макета](../reports/product.html#view-file-diff); контракт [mockup-contract.md](mockup-contract.md).
- **Status:** designed
- **Coverage:** none yet

| State | Trigger | Animation | Behavior |
|---|---|---|---|
| loading | соответствующий ответ источника | none | Чтение собственного источника; не показывать выдуманные нули. |
| empty | соответствующий ответ источника | none | Подтверждённое отсутствие записей с действием начала работы. |
| error | соответствующий ответ источника | none | Источник или проверка отказали; черновик сохранён и ошибка названа. |
| success | соответствующий ответ источника | none | Файл → выбранные disk revision и buffer generation → вычисленная разница → unified/split → редактор. Пропавшая ревизия не подменяется пустым файлом. |
| permission | соответствующий ответ источника | none | Нет допуска — защищённые данные скрыты, изменение заблокировано. |
| stale | соответствующий ответ источника | none | Показать разрешённый снимок; изменение только после повторного чтения. |

- **Domain states:** unchanged, changed, split, unified, source-missing, conflict.


### SCR-61: Документ и происхождение задач
- **Purpose:** Связать идею, отдельное исследование и задачи с точным документом и его ревизией.
- **Elements:** Идея с origin → запрет запуска идеи → отдельная research task → документ-основание → список sibling tasks → адресованная задача.
- **Primary action:** Идея с origin
- **Scenarios:** SCN-080
- **Flows:** FLW-49
- **Implementation tasks:** M124, M130, M134
- **Prototype:** [Адрес макета](../reports/product.html#view-document); контракт [mockup-contract.md](mockup-contract.md).
- **Status:** designed
- **Coverage:** none yet

| State | Trigger | Animation | Behavior |
|---|---|---|---|
| loading | соответствующий ответ источника | none | Чтение собственного источника; не показывать выдуманные нули. |
| empty | соответствующий ответ источника | none | Подтверждённое отсутствие записей с действием начала работы. |
| error | соответствующий ответ источника | none | Источник или проверка отказали; черновик сохранён и ошибка названа. |
| success | соответствующий ответ источника | none | Идея с origin → запрет запуска идеи → отдельная research task → документ-основание → список sibling tasks → адресованная задача. |
| permission | соответствующий ответ источника | none | Нет допуска — защищённые данные скрыты, изменение заблокировано. |
| stale | соответствующий ответ источника | none | Показать разрешённый снимок; изменение только после повторного чтения. |

- **Domain states:** document, missing-document, idea, research-created, sibling-linked, origin-unavailable.

### SCR-62: Аккаунты ИИ
- **Purpose:** Подключить необязательные аккаунты на выбранном устройстве и выбрать вход для новых разговоров.
- **Elements:** Аккаунт и устройство → проверенное состояние → адресованное действие → квитанция. История и ожидающий текст видны только в разрешённом разговоре.
- **Primary action:** Добавить аккаунт
- **Scenarios:** SCN-081, SCN-082, SCN-086
- **Flows:** FLW-50, FLW-52
- **Implementation tasks:** M199
- **Prototype:** [Адрес макета](../reports/product.html#view-provider-accounts); [контракт](../architecture/provider-accounts.md).
- **Status:** designed
- **Coverage:** none yet

| State | Trigger | Animation | Behavior |
|---|---|---|---|
| loading | чтение аккаунтов или операции | none | Не подставлять системный аккаунт вместо неизвестного. |
| empty | managed profiles отсутствуют | none | Системный вход остаётся доступен; подключение необязательно. |
| error | источник не ответил | none | Последний снимок отмечен; повторить чтение. |
| success | подтверждена identity и нужная квитанция | none | Назвать аккаунт, разговор и область действия изменения. |
| permission | право отозвано | none | Скрыть защищённые данные и запретить действие. |
| stale | ревизия изменилась | none | Повторно прочитать до изменения. |

- **Domain states:** ready, empty, login-pending, auth-required, runtime-offline, stale.

### SCR-63: Продолжить разговор с другим аккаунтом
- **Purpose:** Продолжить ту же историю через проверенную остановку и восстановление.
- **Elements:** Аккаунт и устройство → проверенное состояние → адресованное действие → квитанция. История и ожидающий текст видны только в разрешённом разговоре.
- **Primary action:** Проверить переход
- **Scenarios:** SCN-083, SCN-084, SCN-085, SCN-087, SCN-088, SCN-089
- **Flows:** FLW-51, FLW-52, FLW-53
- **Implementation tasks:** M199
- **Prototype:** [Адрес макета](../reports/product.html#view-account-switch); [контракт](../architecture/provider-accounts.md).
- **Status:** designed
- **Coverage:** none yet

| State | Trigger | Animation | Behavior |
|---|---|---|---|
| loading | чтение аккаунтов или операции | none | Не подставлять системный аккаунт вместо неизвестного. |
| empty | managed profiles отсутствуют | none | Системный вход остаётся доступен; подключение необязательно. |
| error | источник не ответил | none | Последний снимок отмечен; повторить чтение. |
| success | подтверждена identity и нужная квитанция | none | Назвать аккаунт, разговор и область действия изменения. |
| permission | право отозвано | none | Скрыть защищённые данные и запретить действие. |
| stale | ревизия изменилась | none | Повторно прочитать до изменения. |

- **Domain states:** ready, busy, resume-failed, unknown, unsupported, auth-required, denied.

- **Automatic switching:** Явно включаемый pool/strategy/threshold; monitoring, waiting-boundary, cooling-down, exhausted, held, paused. Включение разрешает дальнейшие подходящие смены без второго confirmation. SCN-088/089; ADR-0052.

### SCR-64: CEO conversation

*2026-10-22 (0.3.10): the panel sits beside the page, which narrows, and scrolls inside itself; the page keeps its own scroll.*
- **Used by:** FLW-57, FLW-24
- **Purpose:** The one conversation with Fabric, opened from the avatar on every surface, that keeps what the operator says and tells the truth about each send.
- **Elements:** header with Fabric's name and the conversation scope; history and New; the conversation, the only growing area; context chips (None, one Project; several and All refused in this slice); composer with Send (the one primary action); per-message state line; kept drafts and sends list when capacity is full; minimise.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | conversation being read | none | the composer is available; no message is shown as sent |
  | empty | no messages yet | none | one sentence on what Fabric can do now, and the composer |
  | not-activated | chat not switched on yet | none | "Messages are kept on this Mac until private history recovery is available"; Send is off; the draft saves |
  | saved-locally | a draft is saved | none | "Saved on this Mac" beside the composer |
  | accepted-pending | send accepted | none | "Saved, no reply yet"; no typing indicator, no reply is claimed |
  | commit-unknown | send result not known | none | "Result unknown — Check again"; the same operation is checked, never resent |
  | refused | send refused | none | the named reason (offline, local capacity, unresolved send, changed access, retry limit) and the draft kept |
  | recovered | a draft restored after restart | none | "Recovered after restart" on the draft |
  | draft-conflict | newer text exists elsewhere | none | the newer text is kept and shown; the older one can be copied |
  | capacity-full | local limit reached | none | list of kept drafts and sends with Forget, Discard and Check again; a send with an unknown result cannot be discarded |
  | local-recovery-required | local history unreadable | none | "Local history cannot be read" — not an empty conversation |
  | unsupported-context | several Projects or All chosen | none | "This version works with no Project or one Project"; the choice is not applied |
  | denied | no access | none | "Unavailable"; no messages and no draft are shown |
  | error | unexpected failure | none | the draft is kept; the reason is shown |
- **Entry:** its own floating Fabric avatar (`.fabric-button`), beside the attention and search buttons; one side panel is open at a time, so the attention panel keeps its own way in.
- **Coverage:** `apps/desktop/src/renderer/src/CeoChat.tsx` over `window.fabric.ceo` (IPC `ceo:*`, `apps/desktop/src/main/ceoChatBinding.ts`, `apps/desktop/src/main/ceoConversationService.ts`); every state above has an RTL test in `CeoChat.test.tsx`. The gate opens while private recovery is available (first-slice plan C5, `index.ts` `ceoChatActivation`); a new conversation is opened on the server before its first send and only known conversations are read. The real app was driven through this screen by `apps/desktop/test/chat-activation-native.test.mjs`: sent from the composer, shown as saved with no reply yet, read back after a cold restart.
- **Scenarios:** SCN-042
- **Resources:** [conversation service](../launch/harness-r0/ceo-conversation-service.md); [chat workspace](../launch/chat-workspace.md); ADR-0067, ADR-0075; first-slice plan C1–C5.
- **Implementation tasks:** C1, C2, C3, C4, C5 of the first-slice plan.
- **Status:** designed

### SCR-65: Private history
- **Used by:** FLW-58
- **Purpose:** Export and import one person's private conversation history; nothing else.
- **Elements:** Export private history; Import private history; file picker; verification result with a named reason; confirmation; result; the note that the file is private to this user and is not encrypted.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | reading whether import is possible here | none | both actions stay hidden until known |
  | empty | nothing exported or imported yet | none | explains what travels (your conversations as history) and what does not (access, drafts, pending sends) |
  | exporting | writing the file | none | a new file is written; no existing file is replaced |
  | exported | file written and verified | none | "Exported" with the file name |
  | export-refused | history changed during export, or writing failed | none | the reason; any half-written file removed; the original history untouched |
  | verifying | checking an import file | none | nothing is written yet |
  | refused | import file fails a check | none | the named reason, without any message text or path |
  | importing | import running | none | one step; the file is kept |
  | result-unknown | reply lost | none | "Check again" with the same operation |
  | imported | import committed | none | "History restored; nothing will be sent" |
  | denied | not this person's history or not a member | none | unavailable, with the reason |
  | error | import failed | none | rolled back; the restored Estate stays usable without private history |
  | operations-unread | the restores waiting for a result, or the estates restored here, could not be read | none | says which list could not be read, with Check again; never shown as nothing waiting (0.3.5 review ER-10) |
- **Coverage:** `apps/desktop/src/renderer/src/PrivateHistoryPanel.tsx` (opened from settings) over `window.fabric.history` and `apps/desktop/src/main/privateHistory.ts`; RTL tests in `PrivateHistoryPanel.test.tsx`, the service on an owned PostgreSQL. Import is part of restore: migration 66 imports private history only into a verified restore.
- **Scenarios:** SCN-097
- **Resources:** ADR-0079; [private archive contract](../launch/harness-r0/ceo-private-archive.md); first-slice plan A1-1, A1-2, A1-4, A1-6.
- **Implementation tasks:** A1-6 of the first-slice plan.
- **Status:** designed

## Общая оболочка и состояния · 2026-09-07

На целевых продуктовых экранах постоянный CEO launcher имеет scope и отдельную
историю. Desktop chat сдвигает область, mobile chat заменяет её отдельной панелью.
Полные графы различаются по смыслу; previews не имитируют полный history.
[Контракт](mockup-contract.md) описывает identity, source failure и recovery,
а [сверка](../reports/completeness.html#matrix) — исходное расхождение и проверку.
Профиль и Inbox показывают независимые source receipts; отказ одного регистра
не обнуляет другие. Число экранов и визуальный макет не изменяют Coverage выше.

## Приоритетная визуальная композиция · 2026-09-15

[Карта запуска](../reports/product.html#view-launch-map) связывает адресуемые target-варианты существующих экранов: SCR-30 → launch-home, SCR-41 → launch-board, SCR-31 → launch-project, SCR-39 → launch-agent, SCR-40 → launch-plan. Старые варианты и идентификаторы сохранены для сравнения и остальных возможностей.

Home: профиль Fabric и компактные измеримые показатели сверху; доска — основная рабочая зона; проекты с избранным и кнопками порядка; лента сбоку. Board: источник, ответственный, приоритет, итог и перенос. Agent: собственная левая панель задачи/запуска/сессии, tabs Сейчас/Контекст/Решения/Задачи и сессии/Дальше и раскрываемая консоль. Planning: breadcrumb, уровни состава, типизированные зависимости, отдельная история и список. На узком экране вторичные колонки идут ниже; граф прокручивается внутри своей области.

Это production-like браузерный макет на синтетических данных, а не реализованный runtime. Статусы и Coverage существующих SCR не повышаются.

## Персональный Fabric и пульс · 2026-09-15

Уточнение target, SCN-094/093/040/046/090/091/053; [спецификация](../launch/pulse.md).

| Screen | Адресуемый вариант | Обязательные детали |
|---|---|---|
| SCR-36 | launch-persona | Цветной аватар, характер, варианты, генерация, выбор, явное сохранение/пропуск; конфликт сохраняет черновик |
| SCR-30 | launch-home | Компактная верхняя полоса: профиль + мини-график + пульс; доска рядом с возвратом, проекты и Live ниже; полная аналитика по переходу |
| SCR-42 | launch-pulse | Период/тип событий/день; текстовый список; свежесть/покрытие/следующий цикл; пауза просмотра и накопленные изменения |
| SCR-42 | launch-releases | Проект/среда, кандидат/публикация/проверка/откат, состав и основания, квитанция |
| SCR-31, SCR-39, SCR-40, SCR-41 | launch-project/agent/plan/board | Тот же аватар и контекстный переход к пульсу; сохранённый scope; история отдельно от плана |

Состояния каждого нового варианта: ready, loading, empty, error, denied, partial, conflict. Макет не меняет поле Coverage канонических экранов.

### Композиция launch-home · 2026-09-15

Целевой вариант SCR-30 описан в [Home layout](../launch/home-layout.md). Верх содержит профиль, мини-график и пульс; рабочая сетка — Board/Resume, Projects/Live. Колонки переходят в один поток на узком экране. Старый view estate сохранён как исторический вариант, не альтернативный приоритет запуска. Никакое изменение макета не повышает runtime coverage.


## R0: текущая композиция и раскрытие · 2026-09-16

Эта запись уточняет dated Home 2026-09-15; target design, не runtime delivery. [Матрица и доказательства](../launch/r0-ui.md).

| Поверхность | Сразу | По раскрытию / следующему действию |
|---|---|---|
| SCR-30 | Цветной Fabric и ритм рядом; компактный возврат справа; Board/Projects и Live независимыми колонками | Значение дня hover/focus → источники; последнее решение; Live event context; настройки и команда |
| SCR-41 | Приоритетные исходные обязательства и темы; project/type/source | Точный вопрос/результат, итог/причина, квитанция; отложенные и разобранные фильтры |
| SCR-31/39 | Цель, наблюдаемая фаза, последнее решение и следующий шаг | Исторический пакет выбранного запуска, старая консоль, журнал новых реплик/поручений |
| CEO panel (SCN-042) | Явная область, поручение/агент/цикл, текст и голосовой пример | Transcript review; source/original/revision; target и receipt; модель/сеть/микрофон ошибки |
| SCR-05 | Именованная конфигурация и инструкция, сохранение | Каталог Provider и расширенный допуск |
| SCR-56 | Название, trigger/cadence, видимое обязательное основание, preview/save | Входные данные/DAG/policies, история версий; включение отдельно |

Голосовой микрофон и STT не вызываются прототипом. Все 7 common states имеют render-ветви; функциональный PASS требует проверки конкретного перехода, а не наличия заголовка.

## CEO, setup и обучение · 2026-09-16

SCR-64 / SCN-042: общий fixed right overlay поверх неизменной host grid; header/status/scope сверху, conversation — единственная растущая scroll-area, composer снизу. Desktop сохраняет доступ к фону, mobile использует полный dialog. Закрытие не сбрасывает форму или просмотр.
SCR-27 / SCN-031/059: `launch-start` — отдельная setup-страница с одной основной задачей на шаг, progress сверху, форма слева, краткое объяснение справа; на узком экране одна колонка. Advanced fields не показаны до запроса.
SCR-31/44 / SCN-059/042: `launch-guide` — progression выбранного Project, один next action и foldable checklist. `launch-help` — руководство с примерами, доступное из Fabric; текст сценария не принимается за runtime capability.
Home/Board/Project/Agent/Plan/Pulse/Config: общая сетка и распределение visible/details описаны в [CEO/onboarding handoff](../launch/ceo-onboarding.md); текущая source map сохраняет старые экраны.

## Иерархия без потери деталей · 2026-09-16

SCR-64: fixed chat → conversation → composer со scope/attachments → текст/голос/send; источник/полномочия/симуляции в раскрытиях. Ручная область не навигирует основной экран. Shared «Обсудить с Fabric» доступен на объектных экранах.

SCR-32/09: текущее состояние и основной переход выше параметров; сохранённый brief в режиме чтения, отдельное редактирование; pending/errors видимы. SCR-05: одна конфигурационная форма; optional promotion отдельно. SCR-12/52: основная конфигурация и её scope, observer/история/диагностика раскрываются по необходимости. Общая навигация стабильна между launch и legacy views; весь каталог остаётся доступен через «Все разделы».

`launch-design` — интерактивная карта композиции всех представлений: назначение, первичный слой, раскрытие, приёмка и переход к макету. Это способ изучить целевой дизайн, не production coverage.

## First-release screen family · 2026-09-25

Bindings reuse canonical surfaces, not native coverage. Each view supports loading, empty, error, denied, partial, stale and conflict with local recovery. Prototype installation, scanning, voice, process stop and context transfer must be labelled simulated; no native receipt is implied.

| View | Canonical screen / scenario / flow | Primary visible content and action | Detail and failure recovery |
|---|---|---|---|
| r0-setup | SCR-36; SCN-095; FLW-55 | Fabric colour avatar/name with usable defaults; Continue | Optional variants/name editing; failed save keeps draft; read saved work exit |
| r0-provider | SCR-05; SCN-095/096; FLW-55/56 | Claude Code/Codex, observed readiness, one current recovery/continue action | Installation/auth/capability detail and recheck; no pretend ready; switch default applies to future runs |
| r0-source | SCR-27; SCN-059/095; FLW-55 | Choose folder, selected chip; alternative URL; no path/name/purpose field | One project/parent folder; native cancellation returns focus; access/URL errors local; selected scope readable |
| r0-discovery | SCR-27; SCN-095; FLW-55 | Observed stages, source and Cancel; proceed automatically on ready insight | Partial facts, denied folders, empty results, retry same request; candidates require a selection; stale observations carry timestamp |
| r0-home | SCR-30; SCN-094/095; FLW-55 | Compact persona/pulse; Board and Projects; Resume and Live; next action | Sourced insight and freshness; no invented counts or success; empty project offers source picker |
| r0-project | SCR-31; SCN-090/095; FLW-55 | What this project is, now/next, key insight, source-linked next action | Guides/Git/recent work/unknowns; inferred purpose distinct from observed facts; edit optional after discovery |
| r0-work | SCR-32; SCN-091/096; FLW-56 | Task goal/status/next action; terminal; Stop or Continue | Context, old runs, tests/diff; stop requested vs observed; native resume vs fresh same provider vs other provider; unknown blocks overlapping writer |
| r0-board | SCR-41; SCN-041/050; FLW-25 | Prioritised questions and results requiring operator; resolve selected item | Sources, answer receipt/delivery, defer with return condition; unavailable source stays unknown |
| r0-plan | SCR-40; SCN-046/053; FLW-23 | Goal → tasks → runs/results; list or graph; next permitted task | Typed dependencies, blockers, evidence, milestones; planned vs occurred distinct; keyboard equivalent list |
| r0-settings | SCR-52; SCN-071/095; FLW-40/55 | CEO identity, base executor, source access, bounded defaults | Provider recheck, scopes and permissions, optional cycle settings; changing defaults does not mutate active runs |
| r0-map | SCR-30; SCN-058/095/096; FLW-55/56 | Release-only journey and screen cards opening exact routes | States, entry/recovery and ownership; retained full catalog linked separately; no runtime completion claims |
| r0-guide | SCR-44; SCN-042/059/095; FLW-55 | One next useful lesson for the current real project; resume/skip | Three practical CEO examples, context scope, text/voice logging, full manual on demand; links are not completion evidence |

SCR-36: r0-setup belongs to SCN-095/FLW-55 and shares identity with Home and the CEO panel; saved avatar has one revision. Cosmetic work is optional and grants no authority.
SCR-05: r0-provider belongs to SCN-095/096, FLW-55/56. Ready means an observed compatible executor, not binary detection alone. Saved work can be read while unavailable. Instructions/setup are separate from execution grant.
SCR-27: r0-source and r0-discovery belong to SCN-095, FLW-55. launch-start/onboarding retain source identity and route to missing CEO/readiness prerequisites; legacy manual field requirements are superseded.
SCR-30: r0-home and r0-map belong to SCN-095/096, FLW-55/56; dashboard preserves first insight, resume and live freshness; the map is a design artifact.
SCR-31: r0-project belongs to SCN-095/FLW-55; facts carry sources and inference labels; historical snapshots are read-only and never presented as current.
SCR-32: r0-work belongs to SCN-096/FLW-56; stop completion comes from observed executor termination. Context is task-owned and copyable without starting a replacement.
SCR-52: r0-settings belongs to SCN-095/FLW-55; changes are versioned, source selections use the same picker contract throughout the target interface.
SCR-44: r0-guide belongs to SCN-095/FLW-55; the SCR-64 CEO overlay shares command paths with direct UI, carries scope above composer and never sends an example automatically.

### Shared layout and access contract for R0

One primary next action per setup state. At desktop width, task/Board content has priority, side panels form independent stacks and detail drawers do not force unrelated expansion. At narrow width: current status/primary action first, supporting panels below; CEO becomes a full-height dialog with focus restored on close. Visible labels, keyboard-operable picker/dialog/actions, focus-visible and textual status accompany colours. Live can pause its display without stopping agents. Reduced-motion preserves status without pulses. The folder picker has one scope/result/cancel contract everywhere, including settings, repository attachment, discovery roots and terminal working-directory selection; browser simulation must not imply native filesystem access.

### R0 refinement · 2026-09-26

SCR-27 / SCN-095 / FLW-55: collection selection uses checkboxes, first selected primary and explicit main switch; one Project retains related sources. SCR-40 / SCN-041/046: conversation starts planning; no required task-title form. SCR-41 / SCN-041: clickable ticket opens an independent conversation, proposed outcome, admitted task and returned result. SCR-44 / SCN-042: floating identity launcher, profile/style/statistics, project/ticket-bound composer. Technical review controls are opt-in; top tabs own projects, sidebar owns sections. Target only; native coverage unchanged.

## R0 shared conversation component · 2026-09-26

SCN-042 / FLW-24 uses the same floating conversation on every R0 screen, including SCR-40 plan and SCR-41 ticket. Header: persona, history, new conversation, minimize — icon controls with accessible names/tooltips. Transcript: readable message body, short metadata, trusted context/plan/destination/outcome widgets. Composer: one line that grows to a bounded height, context chips, attachment chips, microphone example and send icon; Enter sends, Shift+Enter breaks a line, IME composition does not send. Small sets are visible; only long project lists open searchable selection. Extra reference context never changes ticket owner. Profile variants/style/counts stay available through avatar. Native denial hides the conversation; page-local demo state is not durable history. [Component and state contract](../launch/chat-workspace.md).

### R0 single entry · 2026-09-26

Shared SCR-64 conversation: one floating avatar opens chat, identity in header is static; only history/new/minimize controls are in the panel. SCR-52 Settings houses name, avatar presets, response style and example statistics. R0 welcome has one executor CTA. SCR-31 Project insight, SCR-40 task titles/Plan and SCR-32 work expose object-bound discussion. Header identifies owner and subject; context inspector shows source. Minimize preserves draft. Existing brand/type/spacing tokens retained. See [component and state contract](../launch/single-entry.md); native status unchanged.

### Target refinement · 2026-09-26 · operator workspace

- SCR-30: compact identity/rhythm and return tile in the top band; Board then Projects in the main column; current team starts opposite Board, followed immediately by Live. Team row has role/provider, Project, Task, textual observed state and one exact-session entry. Attention is semantic color plus text; History contains accepted and handed-to-rework results.
- SCR-31: project goal at top; Board and work first, overview below; scoped team and checkpoint beside them, related context below. Default provider settings do not substitute for the actual run's executor.
- SCR-32: exact run/session destination, task context, real-state stop/resume gates in the target model, previous session navigation. Superseded attempt is inspectable but cannot resume over the current attempt. Reviewed/reworked display state agrees with roster and checkpoint.
- SCR-64: prose transcript, user replies and a distinct proposal card. Card header identifies Project/state/version; body shows result and criteria; separate footer contains one primary action and decline. Same action can be expressed in text; ambiguous text keeps state. Settings and avatar entry retain the preceding iteration's contract.

These are target-prototype refinements of existing scenarios, not native implementation coverage. [Detailed decisions, test matrix and handoff](../launch/operator-workspace.md).


## Memory workspace refinement · 2026-09-26

SCR-34: R0 memory workspace (r0-memory) extends SCN-039/057 and FLW-31. Header shows scope; compact project chips and search sit above the list; category chips use Everything/Sessions/Decisions; selected source appears in an adjacent inspector on desktop and below on narrow screens. Source has attribution, Project/Task/Run, coverage, original context and nearby events. Attach to Fabric preserves exact source identity and opens the same floating chat; Open work resolves the exact Run. UI selection is page-local fixture state; durable ingestion, source grants and range search require MEM-P1/P2/P6. Current native counters remain partial coverage, not proof that this target workspace exists.

### Stop presentation refinement · 2026-09-27

SCR-25 / SCR-31 / SCR-39: the native Session and AgentTile share Stop controls and receipt states. The session link is a separate button; controls are never nested inside a clickable card. Pending disables repeat submission; unknown/refused keeps inspection and retry. Force requires a separate confirmation scoped to this Session. Only verified termination permits dismissal. Agent status takes precedence over stale root liveness. SCR-30 Workspace uses the same status vocabulary. SCR-32 target r0-work mirrors explicit Force confirmation and retry; it remains a simulation, not provider acceptance. SCN-096 / FLW-56 full continuation coverage remains unobserved.

SCR-34 recovery state · 2026-09-27: the target mockup includes a clearly labelled “Пример: после сбоя” selector. The selected sample shows partial source, unknown end/exit and separate capture time; attach preserves the example source identity and never starts work. Actual desktop Project history/digest have nullable-time readers and explicit provenance; target workspace remains a mockup, not native acceptance.

## Agent registry, in-machine protocol, pipelines, traces · 2026-09-29

Source: the approved [design](../evidence/specs/2026-09-29-agent-registry-design.md). Visual layer
through `sheleg-design` on the PassionCode tokens; no Figma (brief Q9). Health, outcome and check
results always pair text with an icon — colour is never the only signal.

### SCR-66: MCP servers
- **Used by:** FLW-60
- **Purpose:** List every MCP server on this Mac apart from agents, from Project Observatory's inventory.
- **Elements:** server rows (name, declared in, transport, health); inventory time; filter by agent; show-not-answering toggle; server detail (declaring agents, projects that may use it); the Observatory recommendation line when absent.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | asking Observatory | none | headers stay; last inventory shown greyed with its age if one exists |
  | success | inventory read | none | rows with health text + icon and the inventory time |
  | observatory-missing | Observatory not installed | none | Fabric's own configured servers + one line with the install link |
  | stale | Observatory installed, not answering | none | last inventory with its age and the reason; nothing called current |
  | error | inventory unreadable | none | the reason; Fabric's own servers still listed |
- **Coverage:** none yet
- **Scenarios:** SCN-103, SCN-104
- **Resources:** design §4; Project Observatory `machine.mcp.inventory` capability (module AR-2).
- **Implementation tasks:** design module AR-2.


### SCR-67: Run trace
- **Used by:** FLW-65
- **Purpose:** Read one run as one graph across nested agent calls, to understand and debug it.
- **Elements:** trace graph (nodes: caller → callee, capability, outcome with text, usage, time; branches; waits for a person); node detail (input, output, error, usage, links to agent and interaction point); totals (tokens, cost, wall time); Ask Fabric about this run.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | assembling spans | none | the run header stays; the graph fills as spans arrive |
  | live | run still going | none | new nodes appear; the active node is marked |
  | complete | run ended, all spans present | none | full graph with totals |
  | incomplete | an agent reported no spans | none | that agent is one node marked incomplete, never shown as success |
  | error | trace unreadable | none | the reason; the run's own result still shown |
- **Coverage:** none yet
- **Scenarios:** SCN-115, SCN-116
- **Resources:** design §5 (trace context), §8; OpenTelemetry GenAI span names (pinned version).
- **Implementation tasks:** design module AR-6.

### SCR-68: Fabric tools
- **Used by:** FLW-66
- **Purpose:** The scripts Fabric owns and serves as tools, per project and global.
- **Elements:** tool rows (name, scope, inputs, outputs, effect, test status, usage, tokens saved); enable toggle; tool detail (script, test fixtures, versions, the proposal it came from); Ask Fabric for a tool.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | empty | no tools | none | explains that tools come from accepted proposals or from asking Fabric |
  | list | tools exist | none | project and global tools, scope badges |
  | enabled | tool enabled | none | callable through Fabric; usage counted |
  | disabled | disabled or test failing | none | the reason; pipelines using it marked blocked |
  | failing | runtime error seen | none | last error and the run it happened in |
- **Coverage:** none yet
- **Scenarios:** SCN-117, SCN-118
- **Resources:** design §9; DEC-0013 execution contexts.
- **Implementation tasks:** design module AR-8.

### SCR-69: Optimizer proposals
- **Used by:** FLW-66
- **Purpose:** Review what the optimizer proposes to save tokens, grounded in traces, and accept or decline it.
- **Elements:** proposal list (pattern, expected saving, evidence count, scope); proposal detail (evidence traces, the script and its test, stages replaced, pipeline diff); Accept; Decline with reason; needs-more-runs marker; last optimizer run.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | empty | no proposals | none | says the optimizer is watching and when it last ran |
  | list | proposals exist | none | sorted by expected saving |
  | detail | a proposal open | none | evidence first, then the change |
  | accepted | operator accepted | none | links to the created tool or pipeline version |
  | declined | operator declined | none | the reason; the pattern is not re-proposed without new evidence |
- **Coverage:** none yet
- **Scenarios:** SCN-119, SCN-120
- **Resources:** design §9; DEC-0012.
- **Implementation tasks:** design module AR-9.

### Refinements of existing screens · 2026-09-29 (agent registry design)

- **SCR-05 becomes the agent registry.** Three groups (Coding agents, Your agents, Fabric agents) from four sources (runner catalogue, `services/`, `providers/`, Fabric); card = name, source, version, health (text + icon), capabilities with effects, bound projects, one primary action by state (Use in a project · Fix with Fabric · Open dashboard in Fabric Dashboards); tab MCP servers → SCR-66; New agent → SCR-15. Added state **partial**: one source unreadable, the others shown, the failing source named. Existing admitted-versus-discovered distinction stays. Scenarios SCN-098…SCN-104, SCN-122.
- **SCR-64 carries the open screen.** The conversation shows a context chip for the attached view and selection (`CeoContext@2`: view, route, selection); detach is one action. New states: **context-attached**, **proposal** (a change on the open object with preview), **applied**, **declined**, **answered** (with memory citations), **no-memory**, **memory-unavailable**. Plans for tasks show project, agent or pipeline, reason and effects before anything starts. Scenarios SCN-105, SCN-110, SCN-112, SCN-121, SCN-124, SCN-125.
- **SCR-24 receives agent questions.** An `input_required` job becomes an interaction point with the agent's options; new state **delegated** shows that Fabric answered and why. Scenario SCN-107.
- **SCR-09 links the trace and names unknown outcomes.** Trace → SCR-67; states **failed** (`failed_known`) and **unknown** (`outcome_unknown`, with Check again that looks the job up by id). Scenarios SCN-108, SCN-115.
- **SCR-15 / SCR-16 run agent production inside Fabric.** SCR-15 shows the production project started from the conversation or from SCR-05 (intake, producing, blocked); SCR-16 shows probe and admission results for first use in a project (SCN-106) and for produced agents (SCN-121…SCN-123).
- **SCR-22 lists routed calls and refusals** for agents reaching Fabric over MCP (SCN-109).
- **SCR-49 (Маршрут работы) is the pipeline screen of this design** — not a new screen. Refined: stages bind a capability and show the resolved agent; a graph view with named payloads on edges, checker and interaction-point markers; check results per edge (compatibility, checker before effect, no cycle) with Fabric's proposed fix; scope project / global with a used-by list; micro-controls (inline rename, drag within a lane, stage toggle, pin preferred agent); everything else is asked of the floating Fabric. New states: **proposed**, **checking**, **blocked**, **approved**, **versioned**. Scenarios SCN-110…SCN-114 beside SCN-068.

## Start paths · 2026-10-03 (ADR-0100)

### SCR-70: First run
- **Used by:** FLW-69; FLW-82 (a request waiting for the first run)
- **Purpose:** Meet Fabric once, in the operator's order (REQ-39): name, language and look → the folder where projects live → the projects found, imported → the first action → the family's own agents → Home.
- **Elements:** five-step progress (Fabric and you · Projects folder · Your projects · First action · Family agents); **step 1** — the one-sentence lede (what Fabric is, ADR-0133), language choice preselected from the system, name field (hint, 40 characters), one row of characters with the live greeting and face; **step 2** — the folder field showing the chosen path with «Choose folder…» / «Change…» (the system picker, opening at the last folder chosen in Fabric), «Scan this folder» (primary), «I have no projects yet»; **step 3** — SCR-72 inside the first run (scan, checklist, «Import N as projects»); **step 4** — the four actions with **Create an agent** primary, Convert an agent, Open a project, Create a project, «Next: …» with Change, «Decide later»; **step 5** — SCR-77 inside the first run: the coding agents as a radiogroup of native radios (every installed agent that answered pickable whatever its sign-in state; not installed or not answering disabled with why and what to do), the pick saved at Continue as the head of the fallback order, then the two family products and «Set up with <coding agent>»; Back, Skip, Continue on every step — on step 5 Continue reads "Continue without an agent" only when the agents are read and none can be picked — while they are still being looked for it reads plain "Continue" — and stays usable while the check is pending (REQ-40; 0.3.5 review UX-15).
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | first-visit | empty estate, first run not finished | none | step 1 with the defaults: language from the system, name empty ("Fabric"), the first character |
  | language-system | the system's preferred language read | none | Russian preselected for `ru*`, otherwise English; changing it re-renders the step at once |
  | saving | Continue on step 1 | none | Continue busy until name, language and look are saved |
  | not-saved | saving refused | none | the reason and Continue without saving; the defaults stay |
  | folder-unset | step 2, no folder chosen yet | none | «Choose folder…» and «I have no projects yet»; «Scan this folder» is not offered until a folder is chosen |
  | picker-cancel | the picker closed without a folder | none | the step as it was |
  | folder-chosen | a folder chosen in the picker | none | the full path, «Change…», and «Scan this folder» as the primary; the folder is remembered for the next picker |
  | no-projects-yet | «I have no projects yet» | none | step 4 says nothing was imported and keeps all four actions |
  | choose-action | step 4 | none | the four actions, Create an agent primary, «Decide later» |
  | action-chosen | one action picked | none | «Next: <action>» with Change; Continue goes to step 5 |
  | choose-agent | step 5 (in the code's current order, step 2), agents read | none | a radiogroup: every installed agent that answered is pickable signed in or not (its sign-in line is its description); not installed or not answering is disabled and says why and what to do; Check again re-reads with the latest-request fence; an untouched default writes nothing at Continue (REQ-40) |
  | choice-not-saved | saving the pick as the head of the fallback order was refused | none | the reason and Continue without saving; the order stays as it was |
  | finishing | step 5 left (verified or skipped) | none | Continue busy while the finish is recorded |
  | finish-failed | the finish could not be recorded | none | "it will open again next time" with Try again; Home is still reached |
  | resumed | Fabric restarted mid-run | none | the first run reopens at the step it was left on, the folder, the imports and the observations kept |
  | skipped | the first run ended with nothing chosen | none | first run marked finished; Home; Help → Walk through the first run again reopens it |
  | long-content | a long name, a long folder path, a long product description | none | the path wraps in full with its last segment visible; the name is cut at 40 characters by the field |
- **Axes:** viewport: 1024, 1440; theme: light, dark; text: default, 200%; locale: en, ru
- **Coverage:** apps/desktop/src/renderer/src/start/FirstRun.tsx (the 0.3.x three steps, with the REQ-40 agent choice in region `first-run-agent-choice` and apps/desktop/src/shared/builderChoice.ts; the 0.4.0 order is designed, not built)
- **Scenarios:** SCN-126, SCN-128, SCN-138, SCN-142
- **Resources:** [ADR-0100](../adr/0100-first-run-and-start-paths.md), [ADR-0129](../adr/0129-onboarding-is-four-actions-and-agent-work-runs-in-the-coding-agents-console.md), [ADR-0135](../adr/0135-setup-runs-in-the-persons-coding-agent-and-fabric-shows-what-it-observes.md); the 0.4.0 plan REQ-09…REQ-12, REQ-39, REQ-40.
- **Implementation tasks:** P-01; 0.4.0 REQ-39 (wave 3)
- **Amended 2026-10-11 (REQ-39):** redrawn from the 0.3.x three steps (name and look → coding agents → where to start). The coding-agent states of the old step 2 — found, found-unconnected, unresponsive, missing, check-failed and the four sign-in states — now belong to SCR-77 (its agent rows), where the chosen agent runs the setup.

### SCR-71: Add a project
- **Used by:** FLW-70; FLW-98 (0.3.7 target)
- **Purpose:** Turn one chosen folder into a Project after confirming what Fabric found.
- **Elements:** Choose a folder; facts (path, git kind, branch, remote, last commit, stack); name; already-in notice; not-git notice; Add project; Choose another folder.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | idle | path opened | none | choose prompt |
  | picker-cancel | picker closed without a folder | none | nothing changes |
  | reading | folder chosen | none | busy line with the folder |
  | ready | facts read | none | name and facts |
  | duplicate | folder already in a project | none | notice with Open that project; no name field, no Add |
  | not-git | plain folder | none | notice of what Fabric will not see |
  | creating | Add pressed | none | Add busy |
  | failed | create or read failed | none | reason; the same create on retry |
  | created | project made | none | the project's page |
- **Coverage:** apps/desktop/src/renderer/src/start/StartPaths.tsx
- **Scenarios:** SCN-127
- **Resources:** [ADR-0100](../adr/0100-first-run-and-start-paths.md).
- **Implementation tasks:** P-01

### SCR-72: Scan a projects folder
- **Used by:** FLW-71; FLW-69 (the first run's step 3); FLW-98 (0.3.7 target)
- **Purpose:** List every repository in a chosen folder and create one Project per ticked row.
- **Elements:** Choose a folder to scan; Stop; summary; truncation notice; filter; Tick all shown; Clear; grouped candidate rows; Add N as projects; per-row result.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | idle | path opened | none | choose prompt, read-only note |
  | picker-cancel | picker closed without a folder | none | nothing changes |
  | scanning | walk running | none | busy line and Stop |
  | cancelled | Stop pressed | none | back to the prompt with a stopped notice |
  | results | walk finished | none | grouped checklist |
  | empty | no repositories | none | says none were found |
  | truncated | walk stopped by its bound | none | says the list is not the whole folder |
  | unreadable | folders could not be read | none | counts them as a gap |
  | deep | folders past the depth limit | none | counts them and says how to reach a repository there |
  | symlinks | linked folders not followed | none | counts them and says to scan the folder a link points to |
  | kept-unreadable | the last scan cannot be read | none | says so with the reason, and the prompt to scan |
  | not-kept | the scan's list could not be saved | none | says it will not be here next time; an import is re-marked only from a kept list of the same folder |
  | no-match | the search hides every row | none | says nothing matches and how to see every repository |
  | duplicate | candidate already in a project | none | a ticked, disabled box; In <project> opens it |
  | part-ticked | a worktree or nested repository ticked | none | warning that it becomes its own project |
  | importing | Add pressed | none | progress N of M |
  | partial | some rows failed | none | added and not-added counts; failed rows keep their reason and stay ticked |
  | imported | all rows added | none | summary and Open the first |
  | failed | the scan itself failed | none | reason and the prompt again |
  | first-run | shown as the first run's step 3 (SCN-126) | none | inside SCR-70's frame and progress, on the folder step 2 chose; no Choose prompt; after the import the summary offers Continue (to step 4) instead of «Open the first» and «Set up {name} with the agent» |
  | slow | the walk is still running after 10 s | none | the count keeps moving; one line says the folder is large — keep waiting, or Stop and choose a narrower one |
  | denied | macOS refused the chosen folder itself | none | "Fabric could not read <folder>: macOS did not allow it", Open System Settings (Privacy & Security → Files and Folders) and Choose another folder; nothing scanned, nothing kept |
  | no-repositories | folders found, none of them a repository | none | the plain folders, unticked, with "No git repositories here — a folder you tick becomes a project without history Fabric can read" |
  | plain-folder | a top-level folder that is not a repository, among repositories | none | listed unticked with «not a repository: Fabric reads no history in it»; ticked, it becomes a Project holding a plain folder |
- **Amended 2026-10-11 (REQ-39):** repositories at the head of a product arrive **ticked** (worktrees and nested repositories stay unticked); the picker opens at the last folder chosen in Fabric and the chosen folder is shown as its path with «Change…».
- **Coverage:** apps/desktop/src/renderer/src/start/StartPaths.tsx
- **Scenarios:** SCN-128, SCN-126
- **Resources:** [ADR-0100](../adr/0100-first-run-and-start-paths.md).
- **Implementation tasks:** P-01

### SCR-73: New project
- **Used by:** FLW-72; FLW-98 (0.3.7 target)
- **Purpose:** Start a project from nothing: in a new folder or as an idea.
- **Elements:** the draft-backed form: name; purpose; repositories with Add repository and Create a new folder for it (disabled until a name is typed); git checkbox; folder problem line; memory backend; default agent by its own name; Save.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | idle | path opened | none | empty form |
  | invalid-name | name cannot be a folder | none | the problem in words |
  | no-parent | location picker closed without a folder | none | nothing changes; the form keeps what it had |
  | creating | folder being made | none | Create a new folder busy |
  | exists | folder already there | none | refusal, no Project |
  | outside | location not granted | none | refusal, choose again |
  | failed | mkdir/git/create failed | none | reason; a half-made folder is removed, so retry creates it again |
  | created | folder made | none | the folder, named after the project, joins the repositories with a "new folder" chip; Save creates the Project |
  | left-on-disk | a made folder removed from the form | none | says the folder stays on disk; Fabric deletes no folder |
- **Coverage:** apps/desktop/src/renderer/src/Onboarding.tsx
- **Scenarios:** SCN-129
- **Resources:** [ADR-0100](../adr/0100-first-run-and-start-paths.md).
- **Implementation tasks:** P-01

### SCR-74: Create an agent
- **Used by:** FLW-73; FLW-98 (0.3.7 target)
- **Purpose:** Create a new ecosystem agent: its folder, its Project, and a coding agent's console that builds it (SCN-136).
- **Elements:** Name; What it will do; Where its folder goes with Choose and the resulting path; Fabric Agent Adapter skills status (installed + version, or install command with Copy and Check again); coding agent choice; Create and open the console; Back.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | idle | opened | none | empty form; the coding agent preselected by its rule (the first in the fallback order that is installed and answers; else the first found that connects to Fabric's tools; else the first found), the hint naming which |
  | invalid-name | separator, leading dot, control or text-direction character, empty | none | said under the field once typed or once Create is pressed; nothing is made |
  | no-purpose | the sentence is empty | none | said under the field once Create is pressed; nothing is made |
  | no-parent | no folder chosen | none | said under Where once Create is pressed; nothing is made |
  | exists | a folder of that name is under the parent | none | said under the Name field, focus back on it; nothing created |
  | skills-missing | the adapter skills are not where the chosen agent reads skills (for Claude Code, found only in the shared folder counts as not there) | none | install command, Copy, Check again; when the command does not cover the agent, said so; Create does nothing |
  | checking-skills | Check again | none | busy line |
  | no-agent | no coding agent can start | none | each agent with its reason and Check again; Create looks unavailable and a press says why |
  | creating | Create pressed | none | busy, form locked |
  | failed | mkdir or git init refused | none | reason; nothing made; form kept |
  | failed-after-folder | the Project, the task or the console failed after the folder was made | none | reason (a console that did not open is said as that), and that the folder — and its Project, if made — is kept; name, sentence and place fixed, the coding agent too once a launch was tried; Try again continues with the same Project, task and session; Use another coding agent (a launch that made no session) is a new task in the same Project, the first cancelled on the board; Start over begins a new attempt and cancels a recorded task with no running session; leaving and coming back keeps it all |
  | started | console opened | none | the console window comes forward; the Fabric window opens the new Project |
- **Coverage:** apps/desktop/src/renderer/src/start/AgentPaths.tsx (`CreateAgent`); apps/desktop/src/main/adapterSkills.ts; apps/desktop/src/main/taskRetry.ts; apps/desktop/src/renderer/src/App.tsx (`onCreated` opens the Project)
- **Scenarios:** SCN-136
- **Resources:** [ADR-0123](../adr/0123-the-conversation-is-the-runtimes-console-and-the-ceo-is-a-session.md), [the brief](../evidence/plans/2026-10-08-onboarding-four-actions.md).
- **Implementation tasks:** REQ-02, REQ-04

### SCR-75: Adapt an existing agent
- **Used by:** FLW-74
- **Purpose:** Adapt an agent built elsewhere to the Fabric Agent Contract on a new branch, in a coding agent's console (SCN-131).
- **Elements:** Choose the agent's folder; facts list (as SCR-71); the four steps that follow; skills status with Copy and Check again; coding agent choice; Start the adaptation; Choose another folder.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | idle | opened | none | the four steps and Choose |
  | picker-cancel | picker closed | none | unchanged |
  | reading | folder chosen | none | busy line |
  | ready | facts read | none | facts, already-in Projects, the four steps, Start |
  | skills-missing | as SCR-74 | none | as SCR-74 |
  | checking-skills | Check again | none | busy line |
  | no-agent | no coding agent can start | none | each agent with its reason; Start disabled |
  | starting | Start pressed | none | busy, choices locked |
  | failed | read, Project, task or console refused | none | reason; choices kept; retry with the same Project, task and session; the coding agent fixed from the first launch; Choose another folder is a new attempt |
  | started | console opened | none | the console window comes forward; the Fabric window opens the Project |
- **Coverage:** apps/desktop/src/renderer/src/start/AgentPaths.tsx (`ConvertAgent`); apps/desktop/src/main/adapterSkills.ts; apps/desktop/src/main/taskRetry.ts; apps/desktop/src/renderer/src/App.tsx (`onCreated` opens the Project)
- **Scenarios:** SCN-131
- **Resources:** [ADR-0123](../adr/0123-the-conversation-is-the-runtimes-console-and-the-ceo-is-a-session.md), [the brief](../evidence/plans/2026-10-08-onboarding-four-actions.md).
- **Implementation tasks:** REQ-03, REQ-04

### SCR-76: Agent access
- **0.3.7 target (2026-10-17, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** the request queue for a coding agent joining a project is removed (ADR-0160 §3): the agent is let in and shown in Агенты SCR-87 with «Отключить»; an agent's access to products is read in Настройки SCR-89 → «Доступ агентов». It stays built until wave 3.
- **Amended 2026-10-17 (automatic project registration, [ADR-0136](../adr/0136-a-folder-joins-a-project-by-a-pick-or-by-consent.md)):** a `session.enroll` request never appears as a waiting card. An eligible unknown Git folder becomes a grant and a history entry after canonical admission; product and responder access requests keep their existing prompt, denial and expiry states.
- **Used by:** FLW-75, FLW-76, FLW-77, FLW-85
- **Purpose:** What registered agents on this Mac — and coding agents working in a project ([ADR-0134](../adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md)) — may do through Fabric, what is waiting for an answer, and which products are connected — opened from Settings ([ADR-0115](../adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md)).
- **Elements:** where agents reach Fabric, or why they cannot; Products — one card each, the text first and Connect (or Reconnect and Disconnect once connected) on their own line under it, and the last connect outcome; waiting requests, one card each headed by the agent's name — who installed it and where it came from, what it asks in plain words, its reason as its claim, the same-user floor, whether it adds to existing access, that access lasts a year unless revoked, when the request expires, Deny and Allow (or "Allow and connect <product>"); agents with access, one card each, each grant in plain words with its expiry (a date in the operator's locale) and Revoke, and Revoke all; denied requests with Clear the denial. Every button names whose it is to a screen reader — an agent's buttons in their own label, a product's buttons through the group they sit in, which carries the product's name (2026-10-05, release review I3 U-4); the accessible Allow name includes the visible connect action. Long resources wrap in full, controls wrap at narrow widths, and completion moves keyboard focus to the affected section. Machine diagnostics are a secondary line below the localised reason. Every word is in the operator's language.
- **Amended 2026-10-13 (COM-03, SCN-145):** a waiting card and a grant can be a responder grant: the card says "Let <agent> answer <capabilities> requests for <project>?" with what it may do (take and answer the requests other projects send to that project, for those capabilities) and may not (spend, publish or delete through this), the floor and "for a year, unless you revoke it"; the grant line reads "answer <capabilities> requests for <project>" with its expiry and Revoke. Revoking it releases the agent's slots and ends a board session that held it. Used by FLW-85.
- **Amended 2026-10-13 (wave 4 — designed, NOT built; SCN-145 and SCN-148 amendments):** Comms' pause sheet (SCR-82) links here as the way to stop an agent answering for good: revoking its responder grant releases its slots (FLW-91). A pause leaves a responder grant listed and unchanged. The project directory (SCR-83) is linked from here, beside the grants that decide which capabilities a project lists.
- **Amended 2026-10-13 (COM-03 fix round, SCN-145 amendment):** the responder card's "may not" sentence keeps the contract's caveat — "This grant itself lets it spend, publish or delete nothing; it still has its own tools, and a request is never an approval." — and in Russian the project requests are sent to takes the dative («присылают проекту «<project>»» / «этому проекту»).
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | first read | none | busy line |
  | unreadable | the overview could not be read | none | says so with Try again; never "no agent has access" |
  | hub-off | the hub's port could not be taken | none | warning with the remedy for the specific cause in the operator's language; the machine's observation as a second line; Connect/Reconnect disabled; sessions unaffected |
  | read | overview read | none | the four lists; an empty list says so in words — denied requests included |
  | waiting | a connect link was opened and its 10 minutes have not passed | none | waiting for the answer in the product; Connect/Reconnect disabled; a Reconnect says the current key remains in use |
  | connected | the product delivered its key, the vault kept it and it was recorded within the deadline | none | server and date, Reconnect, Disconnect; after Disconnect, the key remains valid in the product; only after successful Reconnect, the previous key remains valid there. No such claim when Reconnect merely opens the product |
  | declined | the operator denied in the product | none | says it was declined |
  | failed | the product reported a failure; the vault refused or was too slow; no answer within 10 minutes; a Reconnect whose new key was withdrawn | none | the reason in warning ink, separated from the connected line; Try again when not connected; a withdrawn Reconnect says the product is not connected now |
  | vault-unavailable | Connect or Reconnect pressed on Windows, where Project Observatory's vault does not run yet (CO-245) | none | refused before the product is opened, the reason in the operator's language; no consent is shown for a key Fabric could not keep (0.3.5 review UX-6) |
- **Coverage:** apps/desktop/src/renderer/src/AgentAccessPanel.tsx
- **Scenarios:** SCN-132, SCN-133, SCN-137 (an enrollment is said as "<coding agent> asks to work in <project>", its grant as "works in <project> — until <date>", with the folder Fabric resolved and the same-user floor; never "connect")
- **Resources:** [ADR-0115](../adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md), [ADR-0134](../adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md).
- **Implementation tasks:** AR-3.1, AR-3.4

## Agents first — the operator's evening additions · 2026-10-11 (0.4.0 plan REQ-38, REQ-39, REQ-41, REQ-42)

Four new screens, and new states on SCR-25, SCR-30, SCR-31, SCR-70 and SCR-72 (marked «Amended 2026-10-11» in
their entries). Status and text-only frames as every 0.4.0 screen until the design track (REQ-43) links its Figma
frames; the visual layer is the recorded style pack's tokens.

### SCR-77: Setup: coding agents and products
- **Used by:** FLW-78, FLW-79; FLW-69 (the first run's step 5)
- **Purpose:** One place to see the coding agents on this Mac and the family's products, start their setup in the person's coding agent, and read what Fabric observed — never the agent's claims (ADR-0135 §4).
- **Elements:** **Coding agents** — one row each: name, one state line (installed with version · signed in or "sign in, then check again" · adapter skills · connected to Fabric), a radio when it can run setup, the reason in one line when it cannot, the vendor's install command with Copy when not installed; Check again. **First, the family's own agents** — Project Observatory and the Fabric Dashboards agent, each with what it gives and its state line; «Set up with <coding agent>» (the primary); «Skip for now» with its reason choice and what-is-lost line. **Products** (outside the first run) — a table, one row per family product from `products.md`, one column per coding agent, each cell an icon with text (verified with when · registered, not verified · not registered · not installed · not offered for this system); the row's one action «Set up with <coding agent>» and its … menu (Add to another agent, Remove, Copy receipt). **The live checklist** while a setup runs: each step, observed or reported, with its time; Continue setup; Try again; Use another coding agent; Continue with Fabric Dashboards. **The receipt panel** of a cell: product and version, coding agent and version, the register command (no secret), the proving call and its answer as reported, Fabric's observations with times, the system; Copy receipt; File a task in <project>.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | first-run | shown as the first run's step 5 | none | inside SCR-70's frame: the coding agents and the two family products only; Continue when both are verified or skipped |
  | loading | observations being read | none | the rows keep their places with "checking"; no state is guessed |
  | checking | Check again pressed | none | a busy line; the previous observations stay greyed with their age |
  | agents-read | the coding agents observed | none | one honest line per agent as a radio; the preselected row (the head of the fallback order when pickable) and the hint naming the rule that chose it; the pick is saved at Continue as the head of the fallback order, an untouched default writes nothing (REQ-40) |
  | agent-disabled | an agent is not installed or did not answer | none | its row stays visible and disabled with why and what to do in one line (not installed + install command and Copy; not installed with no install command known for this system — install it as its maker describes, then Check again, never "run the command below" (0.3.5 review UX-8); did not answer `--version` — run it once, then Check again, naming the program by its name without path or `.exe`/`.cmd` on any system (UX-9)) |
  | sign-in-unsupported-os | Windows or Linux, where Fabric reads no sign-in yet | none | "Fabric does not read sign-in on this system yet", never a sentence about the agent's version; the row stays pickable (0.3.5 review UX-7) |
  | not-signed-in | the picked agent's sign-in status says signed out | none | the row stays pickable; «Set up with <agent>» says "Sign in to <agent> in its own window, then Check again" instead of starting — the console never starts on it (ADR-0135 §5) |
  | choice-not-saved | saving the pick as the head of the fallback order was refused | none | the reason and Continue without saving |
  | no-agent | no coding agent can run setup | none | "Setup runs in a coding agent, and none on this Mac can start", each agent with its reason; Skip for now |
  | check-failed | detection itself failed | none | the reason and Check again; never "not installed" |
  | ready | an agent chosen | none | «Set up with <agent>» enabled as the one primary |
  | console-open | the Setup console runs (SCR-25 setup) | none | the checklist live beside it; «Set up» replaced by «Bring the console forward» |
  | step-observed | Fabric observed a step | none | the line ticked with what was observed and when |
  | step-reported | the agent reported a step Fabric cannot observe directly (the proving call's answer) | none | marked «reported», with the answer quoted as the agent's |
  | not-confirmed | the agent says done, Fabric does not observe it | none | "not confirmed", naming what Fabric looked for; Check again |
  | refused-unverified | a download failed its signature or checksum | none | "Download not verified — refused", nothing installed, the agent's reason quoted; Try again |
  | failed | an install, a registration or a proving call failed | none | "stopped at <step>" with the agent's reason as its report; Try again, Use another coding agent, Skip with a reason (and Continue with Fabric Dashboards when Observatory failed) |
  | verified | installed, registered, answering, and the proving call reported | none | "verified" with when; the receipt one press away |
  | console-closed | the console closed mid-way | none | what was observed stays; «Continue setup» reopens at the first unobserved step |
  | skip-asked | «Skip for now» pressed | none | the reason choice (later · set up another way · not now · own words) and what is lost per product; Skip and Cancel |
  | skipped | skipped with a reason | none | the reason recorded; in the first run, Continue; Home shows «Finish setting up» |
  | already-verified | everything already verified | none | each line verified with its time; Continue / Done only |
  | read | the products table read (outside the first run) | none | one row per product, one cell per coding agent |
  | unreadable | the products table cannot be read | none | the reason and Check again; never an empty table |
  | not-installed | the product's bundle is not on this Mac | none | the cell "not installed"; the row's action sets it up |
  | installed | bundle found, signature valid | none | the cell "installed" with the version |
  | registered | the product's server in the agent's own MCP list | none | the cell "registered" |
  | answering | the product answered Fabric's probe | none | the cell "answering" |
  | unsupported-os | the product is not offered for this system | none | the cell says so; no action |
  | setup-running | a console already runs for this product | none | a second setup refused with "already running in <agent>" and Bring it forward |
  | removing | Remove chosen; the console removes | none | the cell shows each removal as observed |
  | removed | the server (and, if asked, the product) observed gone | none | the cell back to "not registered" / "not installed" |
  | long-content | many products and agents | none | the table scrolls inside its own frame with the product column fixed; no page-wide horizontal scroll |
- **Axes:** viewport: 1024, 1440; theme: light, dark; text: default, 200%; locale: en, ru
- **Coverage:** none yet
- **Scenarios:** SCN-138, SCN-139, SCN-126
- **Resources:** [ADR-0135](../adr/0135-setup-runs-in-the-persons-coding-agent-and-fabric-shows-what-it-observes.md); the knowledge base's `agents-first.md` (the order) and `products.md` (install, MCP line, proving call per product), pinned with the release; the planned `setupFacts` observation module and the `setup-machine` session preset (plan C5).
- **Status:** designed
- **Implementation tasks:** 0.4.0 REQ-10, REQ-11, REQ-39, REQ-40, REQ-41 (wave 3)

### SCR-78: Where work is
- **0.3.7 target (2026-10-17, [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)):** superseded by «Сейчас» on Главная SCR-85 and by Агенты SCR-87 — Where work is is cut (plan §2; SCN-141 retired). It stays built until wave 3 removes it; then this row becomes retired.
- **Used by:** FLW-81, FLW-80
- **Purpose:** The manager's estate view: per project, the live sessions, the claimed tasks, the review queue and the last sign of life — and, always, the sessions no project owns (plan C8, REQ-17).
- **Elements:** one row per project with work in flight — live sessions (coding agent, how it came in: launched, enrolled from a terminal, handed off from Dashboards or Switchboard), claimed tasks (agent, task, since, «related»), review count, last sign of life; one counted line for the projects with nothing in flight ("More projects with nothing in flight: N" — a label and a count, never a plural it cannot form, UX-13); the last row «Sessions with no project», always shown — each session's coding agent, folder and since, with «Log under a project…»; the consent sheet (log under the matched project, named with how it matched / a new project / don't log here; Allow, Cancel); the reading time.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | first read | none | the rows' places with "reading"; no count shown before it is read |
  | read | projections read | none | the project rows, the idle line, the last row |
  | nothing-in-flight | no project has work in flight | none | one line saying so, the idle projects counted, and the last row |
  | unreadable | the estate cannot be read | none | "Fabric could not read where work is" and Try again, the machine's words on a secondary line (0.3.5 review UX-10); never "no work" |
  | partial | one projection cannot be read | none | that column says so on every row; the rest stays readable |
  | no-console | a session Fabric holds no console for (enrolled from a terminal, through the hub) | none | its row says where it runs and opens nothing; a row with a console opens its session window (0.3.5 review UX-3) |
  | stale | a sign of life older than its window | none | "no sign for <minutes>", never "running" |
  | related | two claims in a project overlap | none | the pair shown together with what overlaps |
  | no-project-sessions | sessions report from folders no project holds | none | the last row lists them with «Log under a project…» |
  | none-unowned | no such session | none | the last row says "none" — it is never hidden |
  | admitting | Allow pressed in the consent sheet | none | the session's row busy |
  | admitted | the folder admitted | none | the session moves to its project's row |
  | refused-broad | the folder is too broad to admit | none | the reason (the home folder, a volume's root); the session stays on the last row |
  | not-logged | «Don't log here» chosen | none | the session stays as «not logged here»; that folder is not asked about again |
  | long-content | many projects or long folder paths | none | rows wrap; paths keep their last segment visible |
- **Axes:** viewport: 1024, 1440; theme: light, dark; text: default, 200%; locale: en, ru
- **Coverage:** partly — `apps/desktop/src/renderer/src/launch/WhereWorkScreen.tsx#WhereWorkScreen` (loading, read, nothing-in-flight, unreadable, partial for the review column, stale, related, no-project-sessions, none-unowned), read by `apps/desktop/src/main/workRead.ts#readWhereWork`; the consent sheet (admitting, admitted, refused-broad, not-logged) is REQ-17's, wave 5
- **Scenarios:** SCN-141, SCN-140
- **Resources:** the journal's projections (sessions, `work.claimed@1` claims, tasks in review, heartbeats); [ADR-0136](../adr/0136-a-folder-joins-a-project-by-a-pick-or-by-consent.md) §2 for the admission; the viewer tool `fabric.work.overview` of [ADR-0139](../adr/0139-fabric-is-a-service-its-descriptor-its-well-known-document-and-a-read-only-viewer.md) reads the same facts.
- **Status:** designed
- **Implementation tasks:** 0.4.0 REQ-17, REQ-38 (waves 2 and 5)

### SCR-79: Fabric button in a product
- **Used by:** FLW-82
- **Purpose:** Fabric's floating button on every page of Fabric Dashboards and of each family product's dashboard — one component of the contract's service kit — that opens the manager session in that product's project (REQ-42). Rendered by the products; drawn and owned here.
- **Elements:** a round button in the page's bottom corner with Fabric's face; its accessible name and tooltip «Ask <Fabric's name> about <project>» (or «Ask <name>» with no project); a one-line busy label «Opening <name>…»; a one-line failure label with its hint. One action; no menu, no chat.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | idle | the page shows, Fabric's descriptor is registered on this Mac | none | the face only; it never covers the page's own primary action (the kit keeps it clear of the page's bottom bar) |
  | focus | hover or keyboard focus | none | the label «Ask <name> about <project>» beside the face; Enter or Space presses it |
  | opening | pressed | none | «Opening <name>…»; a second press does nothing until it settles |
  | not-opened | Fabric did not come forward within 15 s | none | "<name> did not open — open it from Applications"; back to idle after it is read; nothing retried by itself |
  | absent | Fabric is not installed on this Mac (no descriptor) | none | the button is not rendered at all |
- **Axes:** viewport: 1024, 1440; theme: light, dark (the host page's); text: default, 200%; locale: en, ru (the host page's)
- **Coverage:** none yet
- **Scenarios:** SCN-142
- **Resources:** the contract decision REQ-42 asks for (the button in the service kit; deep links `fabric://chat?service=…&project=…` and `fabric://session/new?project=…`); [ADR-0123](../adr/0123-the-conversation-is-the-runtimes-console-and-the-ceo-is-a-session.md); [ADR-0139](../adr/0139-fabric-is-a-service-its-descriptor-its-well-known-document-and-a-read-only-viewer.md) (the descriptor that tells the kit Fabric is here).
- **Status:** blocked — the button's component, its placement rules and the two deep links are a decision of the contract repository (`fabric-agent-contract`, owner: its maintainers with Fabric Dashboards), not yet written (REQ-42's check names it)
- **Implementation tasks:** 0.4.0 REQ-42 (wave 5)

### SCR-80: Start a working session
- **Used by:** FLW-82
- **Purpose:** Start (or bring forward) a working session in a project from the manager session's «Open in a coding agent», with the folder and isolation chosen in the same sheet (the operator's interface rule of 2026-10-09).
- **Elements:** the project's name; the folder — its full path with «Change…» (the system picker, limited to the folders the project holds, opening at the last one chosen); «Isolated session» checkbox (a worktree of its own), with its one-line reason when locked; the coding agent choice (the fallback order's choice preselected, its hint naming why); what the session is handed (the conversation so far, as `session-handoff/1`); Start (primary), Cancel.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | default | opened from the manager session | none | the project's primary folder, Isolated session unticked, the coding agent preselected |
  | folder-changed | another folder of the project chosen | none | the new path; the picker remembers it |
  | isolation-locked | another agent holds a claim on the chosen folder (SCN-140) | none | Isolated session ticked and disabled, "another agent is working in this folder" |
  | attach-open | the fallback order says to use an open session and an idle one of this project exists | none | Start reads «Bring forward <agent>'s session»; nothing new is started |
  | starting | Start pressed | none | Start busy; the choices locked |
  | failed | the session could not start | none | the reason; the choices kept; Try again; the manager session stays |
  | no-agent | no coding agent can start | none | each with its reason (as SCN-135) and «Set up a coding agent» (SCR-77) |
- **Axes:** viewport: 1024, 1440; theme: light, dark; text: default, 200%; locale: en, ru
- **Coverage:** none yet
- **Scenarios:** SCN-142
- **Resources:** [ADR-0125](../adr/0125-an-agent-launch-may-follow-the-operators-fallback-order.md) (the fallback order), [ADR-0140](../adr/0140-a-session-is-handed-its-context-in-one-format-session-handoff-1.md) (the handed context); the 0.4.0 plan REQ-33 (no two agents in one folder after an unknown outcome).
- **Status:** designed
- **Implementation tasks:** 0.4.0 REQ-42, REQ-16 (wave 5)

### SCR-81: Project comms
- **Amended 2026-10-23 (0.3.12, CO-400; [the walk](../evidence/plans/2026-10-15-fabric-simple/2026-10-23-operator-walk.md)), what ships today:** Comms reads as a feed, newest first (OF-29): each post with its project, its kind (просьба, ответ, находка, объявление), a short summary and its thread, with a focus filter (one project, requests only, waiting for an answer); it opens from Настройки → Ещё. Code: `apps/desktop/src/renderer/src/launch/CommsScreen.tsx`. Scenario: SCN-143.
- **Amended 2026-10-24 (0.3.12 release review, iteration 1, DO-20, UX-17, ER-8):** three tabs: «Лента», «Ветки» and «Объявления» (which announcements a project still owes an answer, SCN-178, CO-377). In Russian the screen says «ветка», never «тред». «Ждут ответа» in the feed that finds nothing says it looked at the newest posts and that earlier requests are in the threads. Code: `apps/desktop/src/renderer/src/launch/CommsFeed.tsx`, `apps/desktop/src/renderer/src/launch/CommsAnnouncements.tsx`.
- **0.3.9 (2026-10-21, [the core holds](../evidence/plans/2026-10-21-core-reliability/README.md#board)):** a request's state may be «получен ответ» / "answered", caused by a reply from the asked project («ответом проекта, которого спросили»).
- **Used by:** FLW-83
- **Purpose:** The project board's threads and messages, read by the operator — what projects tell each other, with each request's state and effect as two separate facts ([ADR-0117](../adr/0117-fabric-hosts-the-project-board-of-fabric-project-comms.md) D3: the local operator's read is sanctioned; COM-06/COM-07).
- **Elements:** the filter bar — participant project (the estate's projects, by name), kind (the contract's five; a thread matches when it HOLDS a message of that kind), "only threads with an open request", and activity — last 24 hours / last 7 days / all time, measured back from now and inclusive at the edge, read from the thread's `lastAt` the board already answered with, an undated thread (no messages, or a time that does not parse) matching only "all time" — each at its widest by default, combining as AND, narrowing the answered list and never re-querying the board (SCN-143, amended 2026-10-11 and 2026-10-12); the unread marks — a "new" marker on a thread whose last message is newer than this operator's read mark, a count of such threads on the rail's Comms item, a thread marked read through its last seq while it is open, "mark all read" for the first run's everything-unread, marking every thread of the board, the ones a filter hides included (it answers the rail count); the marks are machine-local settings (`commsReadThrough`), never a fact about the estate (SCN-143, amended 2026-10-12); the thread list — subject or first words, participant projects by name, message count, when the last message was written; the thread view — messages oldest first, each with sender project, principal and its provenance (trusted or asserted), a request carrying state and effect as two labels, a reply naming the message it answers by its sender and first words (or "an earlier message" when that message is not on the page — never its id, 0.3.5 review UX-11), a redacted message keeping id and digest with its removal said; the open thread headed as the list names it (subject, else its first words); Earlier for one page further back, with no gap between pages, and "The beginning of the thread" only once the read has reached the thread's first seq (0.3.5 review UX-1); Try again on failure; when the shown page was last confirmed. No write control — the operator reads (SCN-143).
- **Amended 2026-10-13 (COM-03) — a later wave, not built here:** per request, the target project's current responder for its capability — "active", "stale — its lease lapsed, not that it failed" or "absent" — and its generation as "responder #n"; `outcome_unknown` said as "may have happened — awaiting reconciliation"; the outcome summary under a finished request. The data exists (`board_responders_operator`, `board_outcomes`, migration 87); the screen's slice is COM-07's wave 4. Still no write control (SCN-143).
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | first read | none | busy line |
  | empty | the estate holds no threads | none | says so in words — an empty list is a true answer |
  | texts-missing | no thread, but the journal records messages (a restore whose board history did not come back, SCN-146) | none | "The texts did not come back" with the journal's count and that the texts were not in the archive; never the empty state (2026-10-13) |
  | read | threads or messages read | none | the lists above, with the last-confirmed time |
  | filtered-empty | the filters match no thread | none | said in words, with Clear the filters; never reads as the estate's empty answer or the board's silence |
  | unavailable | the board/RPC did not answer | none | "Comms did not answer." / «Переписка не ответила.» with Try again, the machine's own words on a secondary line (0.3.5 review UX-10); NEVER an empty list. The screen names its source "Comms" / «Переписка», never "the board" (SCN-143, corrected 2026-10-13) |
  | not-found | a thread outside this estate | none | said as not found, not as empty |
  | failed | one poll or one history page failed | none | the last confirmed page stays, saying when it was confirmed; the next success resumes from the cursor |
- **Coverage:** `apps/desktop/src/renderer/src/launch/CommsScreen.tsx`; the `comms:threads` / `comms:list` IPC in `apps/desktop/src/main/index.ts` over `apps/desktop/src/main/commsOperatorRead.ts` (the read path: unavailable is never empty, the board's refusals travel unchanged) and `apps/desktop/src/shared/commsRead.ts` (the shapes); the bridge in `apps/desktop/src/preload/api.ts`, the channel grants in `apps/desktop/src/shared/ipcWindowPolicy.ts`; the aggregates in migration 85 (`supabase/migrations/20261011000100_project_board_thread_aggregates.sql`); the unread slice — the rail badge and badge poll in `apps/desktop/src/renderer/src/launch/LaunchShell.tsx` and `apps/desktop/src/renderer/src/App.tsx`, the operator-local read marks `AppSettings.commsReadThrough` (`apps/desktop/src/shared/types.ts`) and their patch validation (`apps/desktop/src/shared/appSettings.ts`); tests `apps/desktop/src/renderer/src/launch/CommsScreen.test.tsx`, `apps/desktop/src/shared/appSettings.test.ts`, `apps/desktop/test/comms-operator-read.test.mjs` and `apps/desktop/test/project-board-db.test.mjs` (the aggregate block)
- **Scenarios:** SCN-143
- **Resources:** [ADR-0117](../adr/0117-fabric-hosts-the-project-board-of-fabric-project-comms.md), [the comms plan](../evidence/plans/2026-10-04-project-communications.md).
- **Implementation tasks:** COM-07
- **Amended 2026-10-13 (wave 4 — designed, NOT built; SCN-143 amendment, SCN-147, SCN-148, SCN-156, SCN-157; [ADR-0156](../adr/0156-the-estates-owner-may-pause-the-project-board-and-list-or-unlist-projects.md); contract DEC-0079, DEC-0081):** the elements and states above are what the screen shows today; this paragraph and the table under it are the design wave 4 builds, and none of it is on screen yet. "No write control" (above, and SCN-143) holds until then; after it, the screen's only writes are the owner's pause and resume (through SCR-82) and the owner's "Settle with a summary".
  - **The list:** a bounded page of 50, newest activity first, with "Show older threads" / «Показать более старые треды», holding at most 200 threads; the filters are board reads, plus "Coding agent" / «Агент» ("All agents" / «Все агенты»); a filtered read the board did not answer says "Comms did not answer this filter. The list above is what was last confirmed." / «Переписка не ответила на этот фильтр. Выше — то, что было подтверждено последним.»; the rail count past 5,000 reads "threads with new messages: 5000+" / «тредов с новыми сообщениями: 5000+». Above the list: "Search messages" / «Поиск по сообщениям» (SCN-156) and the "Waiting for a project" / «Ждут проект» panel (SCN-157), collapsed when nothing waits.
  - **Per request:** the responder line "Answers it" / «Отвечает» — active "Responder #{n} · {agent} · since {since}" / «Отвечающий №{n} · {agent} · с {since}»; stale "Responder #{n} · its lease lapsed {since}. That says nothing about whether it worked." / «Отвечающий №{n} · срок аренды истёк {since}. Это ничего не говорит о том, получилось ли у него.»; absent "No agent answers {capability} requests for {project} now." / «Сейчас никто не отвечает на запросы {capability} к проекту «{project}».» with why the last one left; paused "Paused by you. It takes nothing new until you resume it." / «Вы поставили на паузу. Ничего нового не берётся, пока вы не возобновите.»; unknown "Who answers is not known right now." / «Кто отвечает — сейчас неизвестно.». Under a finished request: "What the responder reported" / «Что сообщил отвечающий», "Why the requester cancelled" / «Почему запрос отменили», "No summary was given." / «Итог не описан.», "The outcome could not be read." / «Итог прочитать не удалось.». `outcome_unknown` reads "may have happened — awaiting reconciliation" / «может быть, выполнено — ждёт сверки», with who can settle it: "Only the agent answering {capability} can settle it, with what it observed." / «Закрыть его может только агент, отвечающий на {capability}, — по тому, что он увидел.»; with no responder, to the owner "No agent answers {capability} now. You can settle it with what you observed." / «Сейчас на {capability} никто не отвечает. Вы можете закрыть запрос по тому, что увидели.», to a member "No agent answers {capability} now; the estate's owner can settle it with what they observed." / «Сейчас на {capability} никто не отвечает; закрыть запрос может владелец пространства — по тому, что он увидел.». The timeline "What happened to this request" / «Что происходило с запросом» and "Related threads" / «Связанные треды», collapsed.
  - **"Settle with a summary" / «Закрыть с итогом»** — the owner's conditional primary action (contract DEC-0081; the contract's SCR-19 draws the same action): shown only on an `outcome_unknown` request whose slot no responder holds, only to the estate's owner, and only once Fabric serves owner settlement. Its sheet: "Settle this request with what you observed" / «Закрыть запрос по тому, что вы увидели»; "What happened" / «Что произошло» — "It was done" / «Сделано» (completed) or "It failed" / «Не получилось» (failed_known); "What you observed" / «Что вы увидели», 1–2000 characters, required; "Settle only what you checked yourself. Every project in this thread will see that you settled it, and your summary." / «Закрывайте только то, что проверили сами. Все проекты треда увидят, что запрос закрыли вы, и ваш итог.»; "A request nobody observed stays open: it cannot be closed as cancelled." / «Запрос, исход которого никто не видел, остаётся открытым: отменённым его закрыть нельзя.»; Settle / «Закрыть» and Cancel. A settled request carries "Settled by the owner" / «Закрыто владельцем», its summary under "What the owner observed" / «Что увидел владелец».
  - **Per message:** "Marked read by {projects}" / «Отмечено прочитанным: {projects}»; artifacts with "{hash} · as the sender stated it; Fabric did not check the file" / «{hash} · так указал отправитель; Fabric файл не проверял», Copy / «Копировать», and "Only https links open from here." / «Отсюда открываются только ссылки https.».
  - **Owner controls:** "Pause this thread" / «Поставить тред на паузу», "Pause {capability} for {project}" / «Поставить на паузу {capability} у «{project}»», "Pause answering for {project}" / «Поставить на паузу ответы проекта «{project}»», "Resume" / «Возобновить»; each opens SCR-82. The chip "Paused" / «На паузе» on a paused thread and on a paused responder line. A member sees no control and one line, "Only the estate's owner can pause or resume." / «Ставить на паузу и возобновлять может только владелец пространства.».
  - **Wave-4 states (designed):**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | more | the page answered `more` | none | "Show older threads" loads the next page by the same keyset |
  | filter-unavailable | a filtered read did not answer | none | the last confirmed list stays with "Comms did not answer this filter…"; never "no match" |
  | badge-capped | the heads read reached its 5,000 cap | none | the rail count reads "5000+", never a smaller number |
  | responder-checking | responders not read yet | none | "Checking who answers…"; never "absent" |
  | responder-active / stale / absent / paused | the responders read | none | the words above; absent gives the last cause and time when known |
  | responder-unknown | the responders read failed | none | "Who answers is not known right now."; never "absent" |
  | outcome | the facts read | none | summary, cancel reason, "none given" (only from a successful read), unavailable, or settled by the owner |
  | settle-offered | `outcome_unknown`, no responder holds the slot, the reader is the owner, owner settlement served | none | "Settle with a summary" as the request's primary action |
  | settle-confirm | Settle with a summary pressed | none | the sheet; Settle disabled until a choice and 1–2000 characters; Esc closes, focus returns to the trigger |
  | settle-busy | Settle pressed | none | the sheet locked; a second press does nothing |
  | settled | the board answered the settlement | none | "Settled. Every project in the thread sees your summary." / «Закрыто. Все проекты треда видят ваш итог.»; the request re-read |
  | settle-refused-responder | an agent took the slot first (`not_authorized`) | none | "An agent answers {capability} again, so it settles this request. Nothing changed." / «На {capability} снова отвечает агент — закрывает запрос он. Ничего не изменилось.» |
  | settle-summary-required | the summary is empty (`observation_required`) | none | "Write what you observed: a settlement needs it." / «Опишите, что вы увидели: без этого запрос не закрыть.» |
  | settle-already | settled by someone first (`invalid_transition`) | none | "This request was settled before you. Read it again to see how." / «Запрос уже закрыли до вас. Обновите, чтобы увидеть как.» |
  | settle-may-have-saved | the answer was lost | none | "This may have been saved. Read again to see." / «Возможно, это сохранилось. Обновите, чтобы проверить.»; the request re-read |
  | paused-chip | the pauses read names this thread or slot | none | "Paused" / «На паузе» beside it, with Resume for the owner |
  | hold-member | `subject().owner` is false | none | no pause, resume or settle control; one line saying who can |
  | search-idle / searching / results / none / stopped-early / unavailable | the search read | none | as SCN-156; "none" only from an answered search |
  | pending-none / list / unavailable | the pending read | none | as SCN-157; the panel collapsed when nothing waits |
  | timeline / related — loading, read, empty, unavailable | expanded | none | each read alone, collapsed by default |
  - **Keyboard and motion:** every control is a button or a switch with a visible label; the settle sheet traps focus like SCR-82; `prefers-reduced-motion` turns off sheet transitions; each pause, resume and settlement is announced through `role="status"`.
- **Amended 2026-10-13 (wave 4's reads — BUILT, nodes W4-1 to W4-6):** the list, the per-request and per-message lines, search, the pending panel and their states in the table above are on screen; the pause controls, the "Paused" chip, the member line, "Settle with a summary" and its sheet (SCR-82, W4-7 to W4-9 and W4-13) are not. Until W4-13 serves owner settlement, `outcome_unknown` with no responder holding the slot reads "No agent answers {capability} now, so nothing settles it until one does." / «Сейчас на {capability} никто не отвечает, поэтому закрыть его некому, пока такой агент не появится.» for the owner and a member alike, and no settle control is shown. Words added in the build, each en + ru in the registry:
  | State | Words |
  |---|---|
  | list-capped (200 held, the board has older) | "Showing the newest {count} threads. Narrow the filters to reach older ones." / «Показаны {count} самых новых тредов. Сузьте фильтры, чтобы добраться до более старых.» — "Show older threads" is not offered |
  | filtered-empty | "Comms answered: no thread matches all of them. Clear the filters to see every thread." / «Переписка ответила: под все фильтры сразу не подходит ни один тред. Сбросьте фильтры, чтобы увидеть все треды.» (the filter is a read now) |
  | artifact copied / not opened by the browser | "Copied." / «Скопировано.»; "The link did not open in the browser." / «Ссылка не открылась в браузере.» |
  | timeline empty / bounded | "Nothing has happened to it yet." / «С запросом пока ничего не происходило.»; "Only the first 200 steps are shown." / «Показаны только первые 200 шагов.»; each step's cause in words: "by the responder" / «отвечающим», "by the requester" / «отправителем запроса», "the deadline passed" / «истёк срок», "the responder was replaced" / «отвечающего заменили», "handed to the new responder" / «передан новому отвечающему»; a step with no generation drops "responder #n" |
  | related empty | "No related threads." / «Связанных тредов нет.» |
  | search controls | "Search" / «Найти»; "More results" / «Ещё результаты»; "Clear the search" / «Сбросить поиск»; "Searching…" / «Ищем…»; "Type at least two characters." / «Введите хотя бы два символа.» |
  | pending none / unavailable | "Nothing waits for a project." / «Ничего не ждёт.»; "What waits could not be read." / «Что ждёт, прочитать не удалось.» |

  "since {since}" on the active responder line is the time the holder took the slot, in the operator's locale; the stale lease, the last holder's leaving and the pending panel's oldest message are "… ago" / «… назад». Coverage: `apps/desktop/src/renderer/src/launch/CommsScreen.tsx`, `CommsParts.tsx`, `commsList.ts`; the nine wave-4 channels (`comms:thread-page`, `comms:heads`, `comms:responders`, `comms:facts`, `comms:timeline`, `comms:related`, `comms:search`, `comms:pending`, `comms:open-artifact`, main window only) in `apps/desktop/src/main/index.ts` over `apps/desktop/src/main/commsOperatorRead.ts` and `apps/desktop/src/shared/commsRead.ts`, with `apps/desktop/src/preload/api.ts` and `apps/desktop/src/shared/ipcWindowPolicy.ts`; migration `supabase/migrations/20261013000108_project_board_operator_reads.sql` (schema 89); tests `CommsScreen.test.tsx`, `commsList.test.ts`, `FabricStrip.test.tsx` (the "5000+" badge), `apps/desktop/test/comms-operator-read.test.mjs`, `apps/desktop/test/ipc-window-policy.test.mjs`, `apps/desktop/test/project-board-operator-db.test.mjs`.

### SCR-82: Pause sheet
- **Used by:** FLW-91
- **Purpose:** Confirm a pause or a resume of one scope on the project board — a thread, a project's answering, or one (project, capability) responder slot — saying exactly what stops, what keeps going and what a pause cannot do ([ADR-0156](../adr/0156-the-estates-owner-may-pause-the-project-board-and-list-or-unlist-projects.md) §2–§4; contract DEC-0079). Opened from Comms (SCR-81); owner only. Designed, NOT built.
- **Elements:** the title naming the scope ("Pause this thread" / «Поставить тред на паузу», "Pause {capability} for {project}" / «Поставить на паузу {capability} у «{project}»», "Pause answering for {project}" / «Поставить на паузу ответы проекта «{project}»», or "Resume" / «Возобновить»); what stops, by scope — thread: "Stops: new messages and replies in this thread, and agents taking new work from its requests." / «Остановится: новые сообщения и ответы в этом треде и новая работа по его запросам.»; project: "Stops: agents taking new work for {project} — taking its slots, claiming, accepting and starting its requests. Messages to {project} still arrive and wait." / «Остановится: агенты не берут новую работу для проекта «{project}» — не занимают его слоты, не берут, не принимают и не начинают его запросы. Сообщения проекту «{project}» по-прежнему приходят и ждут.»; slot: "Stops: agents taking new {capability} requests for {project}. Requests still arrive and wait; their deadlines run." / «Остановится: агенты не берут новые запросы {capability} для проекта «{project}». Запросы по-прежнему приходят и ждут; их сроки идут.»; what keeps going: "Keeps: what agents report about work already taken, cancels, and deadlines, which still run." / «Продолжится: отчёты агентов о взятой работе, отмены и сроки — они идут.»; what a pause cannot do: "A pause cannot stop work an agent already started with its own tools. To stop an agent answering, revoke its permission in Agents & access." / «Пауза не остановит то, что агент уже начал своими инструментами. Чтобы агент перестал отвечать, отзовите разрешение в «Агенты и доступ».» with "Open Agents & access" / «Открыть «Агенты и доступ»» (SCR-76); the primary action "Pause" / «Поставить на паузу» (or "Resume" / «Возобновить»), and Cancel. No control here promises to halt an effect already running.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | confirm | opened from a pause or resume control | none | the texts above; focus on the primary action; focus is trapped in the sheet; Esc closes and returns focus to the trigger |
  | busy | the primary action pressed | none | the action busy, the sheet locked; a second press does nothing |
  | paused | the board recorded the pause | none | "Paused." / «На паузе.» announced through `role="status"`; the sheet closes; the chip appears |
  | resumed | the board recorded the resume | none | "Resumed." / «Возобновлено.» announced; the chip is gone |
  | already | the scope was already in that state (`repeated: true`) | none | "It was already in that state. Nothing changed." / «Уже было так. Ничего не изменилось.» |
  | refused-not-owner | the person is not the estate's owner (`not_authorized`) | none | "Only the estate's owner can pause or resume." / «Ставить на паузу и возобновлять может только владелец пространства.» |
  | refused-authority-moved | the owner's membership changed since the window opened (`authority_changed`) | none | "Your access changed since this window opened. Reopen it and try again." / «С момента открытия окна ваш доступ изменился. Откройте заново и повторите.» |
  | not-found | the thread, project or slot is not in this estate | none | said as not found; nothing changed |
  | may-have-saved | the answer was lost | none | "This may have been saved. Read again to see." / «Возможно, это сохранилось. Обновите, чтобы проверить.»; the screen reads the pauses again and shows what they say |
- **Motion:** `prefers-reduced-motion` turns the sheet's transition off.
- **Axes:** viewport: 1024, 1440; theme: light, dark; text: default, 200%; locale: en, ru
- **Coverage:** none yet
- **Scenarios:** SCN-148
- **Resources:** [ADR-0156](../adr/0156-the-estates-owner-may-pause-the-project-board-and-list-or-unlist-projects.md); contract DEC-0079 (the matrix a pause applies, fabric-agent-contract `src/comms-hold.ts` and its vectors); SCR-76 for revocation.
- **Status:** designed
- **Implementation tasks:** COM-06 (wave 4: W4-7, W4-8, W4-9)

### SCR-83: Project directory
- **Used by:** FLW-92
- **Purpose:** Choose which of the estate's projects other projects can find in the project directory, seeing the exact entry they would read before changing it ([ADR-0156](../adr/0156-the-estates-owner-may-pause-the-project-board-and-list-or-unlist-projects.md) §5–§6; [ADR-0149](../adr/0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md) Amendment 1 §4; contract DEC-0073 §8). In the Settings band (SCR-52), linked from Agents & access (SCR-76). Replaces the declared stub of CO-286. Designed, NOT built.
- **Elements:** the title "Project directory" / «Каталог проектов»; the lede "Which projects other projects can find. Unlisting hides a project from the list only: a project that knows its id still reaches it." / «Какие проекты видны другим проектам. Скрытый проект пропадает только из списка: тот, кто знает его id, по-прежнему до него дотянется.»; one row per active project — its name, the switch "Listed for other projects" / «Виден другим проектам», and "What other projects see" / «Что видят другие проекты», which opens the preview: the project's name and each capability with its responder state (active, stale, absent) and "paused" where the owner paused it, and nothing else — or "No capabilities: no agent may answer requests for it yet." / «Возможностей нет: отвечать на запросы к нему пока никому не разрешено.».
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | first read | none | busy line |
  | read | the directory and the listings read | none | the rows above, each switch showing what the directory says |
  | unavailable | the directory did not answer | none | "The directory did not answer." / «Каталог не ответил.» with Try again; never an empty list; no switch offered |
  | preview | "What other projects see" opened, or a switch pressed before its preview was seen | none | the preview opens first; the switch changes only from inside it |
  | saving | the change confirmed | none | the switch busy; the others usable |
  | saved | the board recorded it | none | the switch shows the directory's answer, announced through `role="status"` |
  | already | it was already in that state | none | nothing recorded; nothing changed |
  | refused | not the owner, or the owner's access changed since the window opened | none | "Only the estate's owner can change this." / «Изменить может только владелец пространства.», or reopen and try again |
  | may-have-saved | the answer was lost | none | "This may have been saved. Read again to see."; the directory read again |
  | member | `subject().owner` is false | none | the switches shown read-only with the owner-only line |
- **Axes:** viewport: 1024, 1440; theme: light, dark; text: default, 200%; locale: en, ru
- **Coverage:** none yet
- **Scenarios:** SCN-149
- **Resources:** [ADR-0156](../adr/0156-the-estates-owner-may-pause-the-project-board-and-list-or-unlist-projects.md); the database door `board_set_listing` (migration 87), which wave 4 gives its owner check; SCR-52 (where it lives), SCR-76 (the link to it).
- **Status:** designed
- **Implementation tasks:** COM-06 (wave 4: W4-7, W4-8, W4-10); closes CO-286

## Fabric 0.3.7 — simple: five places · 2026-10-17 ([ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md), [plan](../evidence/plans/2026-10-15-fabric-simple/README.md))

Target design of wave 1, drawn in `docs/reports/product.html` as the `simple-*` views, in Russian and English
(`?lang=en`), in the Aperture-like style the operator asked for ([sketch](../evidence/plans/2026-10-15-fabric-simple/style-2026-10-16/README.md)):
neutral graphite surfaces, hairline borders, large calm medium-weight headings, small uppercase section labels, gold
only for the one primary action and the counts that need the person. Designed, NOT built. No screen here has a
confirmation dialog: an act happens at once and leaves the act line «{что сделано} · Отменить» at the foot of the
place (ADR-0160). The screens they replace carry a dated note.

### SCR-84: Rail
- **Used by:** FLW-93
- **Purpose:** The one navigation of Fabric: «＋ Создать», the five places and the projects list, always on the left (plan §2). Replaces the tab strip, the back button and the per-project links.
- **Elements:** the PassionCode mark with «Fabric · by PassionCode»; «＋ Создать» (light secondary button); «Главная» with a gold count of waiting questions, «Агенты», «История», «Настройки»; the label «Проекты»; one compact row per project (26 px, OF-04): name, a green dot when an agent works there, a gold star for a favourite, a gold count when something waits; at the foot nothing while this computer is fine, and one line «этот компьютер · есть что проверить» when it is not (OF-05, 2026-10-19: no profile block, no search field, no conversation with Fabric in the shell; search is ⌘K).
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | the projects list is read | none | «Читаю проекты…» in place of the list; the places usable |
  | empty | no project yet | none | «Проектов пока нет» with «Создать проект» |
  | error | the list could not be read | none | «Проекты не прочитаны.» with the machine's words beneath and «Повторить»; the last reading beneath it marked «как было в {время}» |
  | success | the list read | none | favourites first, then by latest activity |
  | folded | the window narrower than 900 px | none | icons with their counts, names in tooltips |
- **Scroll (2026-10-22):** the window never scrolls; the shell has the window's height and each page under the top bar scrolls by itself (`main.content`, and Settings beside it); a notice above the page scrolls inside itself past a third of the place (15 % in a window at most 640 px high), and the page keeps 40 % of the place (a third in a short window), while the act line comes first and scrolls inside itself past 40 % (30 % in a window at most 640 px high); the rail, the top bar, a side panel and the act line stay put; another place, project or the workspace starts at the top, and Settings does not reset the page under it; an absolutely placed element is placed against its page, so the window itself never scrolls; content that does not wrap never moves the page sideways (a long token breaks, `pre` and a table scroll inside themselves); a notice's own buttons stay at its foot while its text scrolls (CO-385); a move made from the rail puts focus on the new page's first heading, so the keyboard scrolls it (CO-384) (`LaunchShell.tsx#LaunchShell`, `placeKey`; `rail.css`; `scripts/test/shell-scroll.browser.mjs`).
- **Axes:** viewport: 1024, 1440; theme: dark, light; text: default, 200%; locale: ru, en
- **Coverage:** apps/desktop/src/renderer/src/launch/LaunchShell.tsx (0.3.7 wave 3: «＋ Создать», the four places, the projects list with dot, star and count, its loading, empty and error states, the foot line, ⌘K for search with no search field since 2026-10-19), apps/desktop/src/renderer/src/launch/rail.css (the fold under 900 px), apps/desktop/src/shared/railProjects.ts (favourites first, then latest activity); ⌘[ and ⌘] in apps/desktop/src/renderer/src/App.tsx region `rail-wiring`; the trackpad swipe in `apps/desktop/src/shared/swipeTravel.ts#swipeStep` (0.3.12 S7). The foot names the person «Вы»: Fabric holds no person's name
- **Amended 2026-10-24 (0.3.12; 0.3.12 release review, iteration 1, UX-11, ER-12):** each project row carries a graph mark (24 px, for the pointer, out of the tab order, so a row is one tab stop) that opens the project's graph; «Граф проектов» under the list opens the whole graph once there is more than one project (SCN-175). The trackpad swipe goes back and forward, and a gesture that scrolled anything under the pointer does not turn the page.
- **Scenarios:** SCN-162
- **Resources:** the plan §2; the sketch `docs/evidence/plans/2026-10-15-fabric-simple/style-2026-10-16/fabric-style.html`
- **Status:** built
- **Implementation tasks:** 0.3.7 wave 3

### SCR-85: Главная
- **Amended 2026-10-23 (0.3.12, CO-400; [the walk](../evidence/plans/2026-10-15-fabric-simple/2026-10-23-operator-walk.md)), what ships today:** «Ждёт вас» and «Сейчас» are retired as named here. In order: the greeting (the part of the day and how many questions wait for the person) with the numbers strip; «Нужны вы», only what the person resolves (questions, access requests, refusals), each row naming who asks and opening in place, a question answered there with its options as buttons; «Где остановились»; «Кто что делает» in two lanes, «В работе» and «Закончили», a row opening its task; «Агенты в работе», a box that scrolls on its own, active agents first, each by the task it holds, with «Открыть переписку»; the projects. Code: `apps/desktop/src/renderer/src/EstateHome.tsx`, `apps/desktop/src/renderer/src/launch/HomeParts.tsx`, `apps/desktop/src/renderer/src/launch/HomeWork.tsx`. Scenario: SCN-163.
- **Amended 2026-10-24 (0.3.12 release review, iteration 1, UX-2, UX-10, UX-14, DO-7, DO-20):** the greeting counts decisions in Russian plural forms («Добрый вечер. Вас ждут 3 решения.», «Вас ждёт 1 решение.», «Вас ничего не ждёт.»); «Нужны вы» with nothing for the person says «Ничего не ждёт вашего решения». Of the Elements below, the top bar carries no search field and no date (search is ⌘K), the greeting has no second summary line, and the projects list has no way bar; the empty states «Вопросов нет. Агенты работают сами.» and «Начните с проекта» are not built (with no project, the projects section says «Пока пусто…» with «Создать первый проект»). A section that fails says so in its place with the machine's words beneath, and one that keeps its last reading marks it «как было в {время}»; «Повторить» is not offered there.
- **Amended 2026-10-26 (0.3.14, P-28, [plan](../evidence/plans/2026-10-26-release-0314-plan.md)), what ships now (SCN-158):** «Агенты в работе» names each agent's current task: its newest live claim whose task still runs, else the running task Fabric launched in its session, else the task its newest stage report names; an untitled task is said as untitled, never dropped, and «Открыть его задачу» opens it in its own project (`apps/desktop/src/shared/homeLive.ts#composeHome`). «В работе» holds only work an agent or a live session is on; work with neither is not counted there, and the lane shows «Брошено: N», which opens the Board's «Брошено» column (`apps/desktop/src/renderer/src/launch/HomeWork.tsx#HomeWorkLanes`; tests `homeLive.test.ts`, `HomeWork.test.tsx`).
- **Used by:** FLW-93, FLW-94
- **Purpose:** What needs the person, what is being done now, and their projects — the place Fabric opens on (plan §2). Replaces the home, the Board screen, Where work is, Pulse and the live feed.
- **Elements:** the top bar with the place's name, the date and the search field (⌘K); the greeting heading («Добрый вечер. Вас ждут 3 вопроса.») and its one-line summary; the numbers strip («агентов работают», «задач в работе», «на проверке»); «Ждёт вас» — question cards (agent sign and name, project, time; the question; why; options as buttons, the recommended one gold; «Обсудить»); «Сейчас» — one row per agent at work (sign, its own sentence, project, how long) with «Открыть консоль ↗»; «Проекты» — a table (name with star, «Что сейчас», the way bar, agents, updated); the act line at the foot.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | first read | none | each section «Читаю…» on its own; numbers «—» |
  | empty | no question, no agent at work, or no project | none | «Ничего не ждёт вашего решения» / «Сейчас ни один агент не работает.» / «Начните с проекта» with «Создать проект» and «Открыть папку с проектами» (the 0.3.7 target, not built: the amendment above) |
  | partial | one section could not be read | none | that section says so with «Повторить»; the others stand |
  | error | nothing could be read | none | «Fabric не смог прочитать, что происходит.» with the machine's words beneath and «Повторить» |
  | success | read | none | the greeting, the numbers, the three sections |
  | stale | an agent quiet past its window | none | «давно не отзывался — {время}», sorted last |
  | answered | an option pressed and recorded | none | the card leaves; the act line «Ответ «…» отправлен · Отменить» |
  | undone | «Отменить» pressed on an answer | none | the card back as it was |
  | cannot-undo | the agent already acted on the answer | none | «Агент уже начал — отменить ответ нельзя» with «Попросить остановиться» |
  | boundary | a money, publishing, deletion or other-machine question | none | the same card, its why naming the boundary («Лимит проекта — $40, потрачено $9.») |
- **Axes:** viewport: 1024, 1440; theme: dark, light; text: default, 200%; locale: ru, en
- **Coverage:** `apps/desktop/src/renderer/src/EstateHome.tsx`, `apps/desktop/src/renderer/src/launch/HomeParts.tsx`, `apps/desktop/src/renderer/src/launch/HomeWork.tsx` (0.3.11 and 0.3.12, see the amendment above)
- **Scenarios:** SCN-163, SCN-164
- **Resources:** SCN-158 (the home built today); ADR-0160 §4–§5
- **Status:** built
- **Implementation tasks:** 0.3.7 waves 2 and 4

### SCR-86: Проект
- **Amended 2026-10-24 (0.3.12 W2 S4a to S4c; 0.3.12 release review, iteration 1, DO-8, DA-1 to DA-5), what ships today:** the way back; the head (name, purpose, «Сейчас») with «Доска проекта», «План» and «Связи» (the project's graph, SCN-175); in the main column the way («Где мы», or «Начните с первого результата» for a project with no task), «Вопросы ко мне» and the kanban strip of four columns; beside it «Агенты на проекте», «Что это за проект» (the summary, «Цель», «План», «Бизнес» the person sets, «Связанные проекты», «Люди (из Git)»; «Познакомиться с проектом» until an agent records a goal, a summary, a plan with items or relations), «Как идёт работа» (tasks done in eight weeks, the median times, the share sent back from review, the questions waiting), «Команда», «Ритм работы» and «Ресурсы и настройки», folded. Each panel that cannot be read says so on its own. Not built in 0.3.12: «Идеи и материалы» and the project's last activity (CO-307, 0.3.13). Scenario: SCN-165.
- **Amended 2026-10-26 (the 0.3.14 release review, iteration 1, [plan](../evidence/plans/2026-10-26-release-0314-plan.md#review-iteration-1)), what ships now:** the board glance counts «Брошено» apart from «В работе», with «Брошено: N» to the Board, as Главная and the Board do (UX-9; `apps/desktop/src/renderer/src/launch/ProjectWay.tsx#ProjectBoardGlance`).
- **Used by:** FLW-93, FLW-94, FLW-95, FLW-98
- **Purpose:** One page per project — where it came from and where it goes, its questions, its board, a console and a new task (plan §2). Replaces the project page's twenty sections and its six rail links.
- **Elements:** heading with the name, a star and the purpose; «Сейчас: …»; «Открыть консоль» and «Поставить задачу» (gold, the page's one primary action); «Откуда пришли и куда идём» in three columns «Сделано», «Сейчас», «Дальше»; «Вопросы»; «Доска» glance (four columns, counts, first cards) with «Вся доска»; «Папки проекта» with «Добавить папку» and «Убрать»; «Переписка с другими проектами»; the act line.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | first read | none | each block «Читаю…» on its own |
  | empty | no tasks | none | «Начните с первой задачи» with the task field open |
  | partial | the board or the questions unreadable | none | that block says so; the rest stands |
  | error | the project could not be read | none | «Проект не прочитан.» with «Повторить» |
  | missing | the project was removed | none | «Такого проекта больше нет» with «Открыть История» |
  | success | read | none | the blocks above |
  | task-added | «Поставить» recorded | none | the task in «Очередь»; «Задача поставлена · Отменить» |
  | moved | a card moved | none | «Задача перенесена в «Проверить» · Отменить» |
- **Axes:** viewport: 1024, 1440; theme: dark, light; text: default, 200%; locale: ru, en
- **Coverage:** `apps/desktop/src/renderer/src/launch/ProjectLaunch.tsx`, `apps/desktop/src/renderer/src/launch/ProjectWay.tsx`, `apps/desktop/src/renderer/src/launch/ProjectProfile.tsx`, `apps/desktop/src/renderer/src/launch/ProjectAnalytics.tsx` (0.3.12 W2 S4, see the amendment above)
- **Scenarios:** SCN-165, SCN-164
- **Resources:** SCN-159 (the page before 0.3.12); the plan §5's cut list
- **Status:** built
- **Implementation tasks:** 0.3.7 waves 2 and 4

### SCR-87: Агенты
- **Amended 2026-10-23 (0.3.12, CO-400; [the walk](../evidence/plans/2026-10-15-fabric-simple/2026-10-23-operator-walk.md)), what ships today:** the place lists every agent at work, a console Fabric holds or an agent that joined from a terminal, each by the task it holds; a row selects its agent and the agent's page opens beside the list: the task, what it is doing, its results, what it did by day, with its console, project and task one press away (CO-393). Below: «Подключились сами» and the consoles Fabric holds. Not built: the two groups with each coding agent's readiness (Settings lists them, SCR-89), «Что получает агент», «Создать агента». Code: `apps/desktop/src/renderer/src/launch/AgentPage.tsx`, `apps/desktop/src/renderer/src/launch/HomeWork.tsx`, `apps/desktop/src/renderer/src/launch/JoinedAgents.tsx`, `apps/desktop/src/renderer/src/EstateAgents.tsx`. Scenario: SCN-166.
- **Amended 2026-10-24 (0.3.12 release review, iteration 1, UX-3, UX-7):** until an agent is chosen the place says one of three things beside the list: «Список агентов не прочитан, поэтому открыть агента нельзя.» with «Повторить», «Сейчас ни один агент не работает, открыть некого. Агент появится здесь, когда начнёт работу в проекте.», or «Выберите агента в списке: здесь будут его задача, что он делал и результаты.»; a chosen agent's page takes focus and scrolls into view.
- **Amended 2026-10-24, iteration 2 (0.3.12 release review, iteration 2, UX-3):** focus moves to the agent's page only on the person's pick; a refresh never moves it.
- **Amended 2026-10-26 (0.3.13, CO-419), what ships now:** an agents screen. The centre holds the chosen agent with two tabs, «Работа» (default) and «Консоль»; the list on the right holds every agent grouped by state, «Работают сейчас», «Ждут вас», «Простаивают», «Отключены», each row the agent, its project, one line and when it was last heard from. A joined agent's «Отключить» or «Пустить снова» is on its own «Работа». Under 850 px the list sits above the centre. The three stacked lists of 0.3.12 are gone from the place (SCN-166's amendment of 2026-10-26). Coverage: `apps/desktop/src/renderer/src/launch/AgentsScreen.tsx#AgentsScreen`, `apps/desktop/src/renderer/src/launch/agentRoster.ts#composeRoster`; test `apps/desktop/src/renderer/src/launch/AgentsScreen.test.tsx`.
- **Amended 2026-10-26, iteration 1 (0.3.13 release review, iteration 1, UX-1, UX-2, UX-3):** a group says it is empty only once the reads that fill it have answered («Работают сейчас» and the quiet consoles after who works now and the consoles; «Простаивают» and «Отключены» also after the joined and the installed agents); until then it says «Чтение…», and after a failed read «Неизвестно: выше произошла ошибка чтения.» (the failure itself is said above the list). «На этом компьютере агенты не найдены» only when every read answered; a failed read of the installed agents has «Повторить». A plain shell («Терминал») is a console, not an agent, and is not listed. A console that has printed nothing for a minute is said as what is observed: the group «Возможно, ждут вас», the row «консоль молчит» and «Консоль ничего не выводит уже {время}. Возможно, агент ждёт вашего ответа.», never that it waits: no runner reports that it does. Code: `apps/desktop/src/renderer/src/launch/AgentsScreen.tsx#AgentsScreen`, `apps/desktop/src/renderer/src/launch/agentRoster.ts#composeRoster`. Test: `apps/desktop/src/renderer/src/launch/AgentsScreen.test.tsx`.
- **Amended 2026-10-26, iterations 2 and 3 (0.3.13 release review, iteration 2, UX-3 to UX-5; iteration 3, UX-2, UX-3):** an unread work read is said on the agent's page and on its row («Не удалось прочитать, что он делает.»); «Консоль» of an agent at work with no console here says it works outside Fabric, or that where its console is could not be read.
- **Amended 2026-10-26 (0.3.14, P-28, [plan](../evidence/plans/2026-10-26-release-0314-plan.md)), what ships now (SCN-166):** the agent's «Работа» tab lists «Задачи» above its history, newest first: per task its project, status, when taken or launched, how it ended or «Держит её сейчас», and how many times taken; a row opens in place to the brief and «Открыть задачу». Reading, none, a failed read with «Прочитать задачи снова» and a list cut at 100 are each said. The history follows, closed by default, its rows naming their task. A Board card's «Сессия …» opens this screen on that agent (`apps/desktop/src/renderer/src/launch/AgentPage.tsx#AgentPage`; `apps/desktop/src/renderer/src/launch/AgentsScreen.tsx#AgentsScreen`; `apps/desktop/src/main/workRead.ts#readSessionTasks`; tests `AgentPage.test.tsx`, `AgentsScreen.test.tsx`).
- **Amended 2026-10-26 (the 0.3.14 release review, iteration 1, [plan](../evidence/plans/2026-10-26-release-0314-plan.md#review-iteration-1)), what ships now (SCN-166):** each ending in words of its own and an unknown one as not recorded (UX-8); the history's heading above its disclosure «Показать историю сессии» (UX-4); rows as text links in a two-column grid, task rows with padding and a turning chevron (UX-3, UX-4); the picked agent kept in the route so the way back from its task reopens it (UX-2); focus moves to the page on arrival once the agent's row is read (UX-7) (`apps/desktop/src/renderer/src/launch/AgentPage.tsx#AgentPage`, `apps/desktop/src/renderer/src/launch/AgentsScreen.tsx#AgentsScreen`).
- **Used by:** FLW-93, FLW-95, FLW-96, FLW-98
- **Purpose:** Every agent — coding agents on this computer and agents built in Fabric — with what each is doing, its console one press away, and «Создать агента» (plan §2). Replaces Agents, Settings' catalogue, Agent access's list and created agents.
- **Elements:** «Создать агента» (gold); «Агенты для кода на этом компьютере» and «Агенты, созданные в Fabric», each row: sign, name, state sentence, project, «Консоль»; «подключился сам», «Отключить», «Пустить снова» and the proof line for an agent that joined from a terminal; the agent's view with «Что получает агент»; the act line.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | detection runs | none | «Ищу агентов на этом компьютере…» |
  | empty | no coding agent installed | none | each known agent «Не установлен» with how to install |
  | partial | found, but what they do unreadable | none | said per row |
  | error | detection failed | none | «Не удалось поискать агентов.» with «Повторить»; the last list kept |
  | success | read | none | the two groups |
  | stale | an agent quiet past its window | none | «давно не отзывался — {время}» |
  | joined | a coding agent joined from a terminal | none | its row «подключился сам» with «Отключить» |
  | disconnected | «Отключить» pressed | none | «Отключён» with «Пустить снова»; act line «Codex отключён · Отменить» |
- **Axes:** viewport: 1024, 1440; theme: dark, light; text: default, 200%; locale: ru, en
- **Coverage:** `apps/desktop/src/renderer/src/launch/AgentsScreen.tsx#AgentsScreen`, `apps/desktop/src/renderer/src/launch/agentRoster.ts#composeRoster`, `apps/desktop/src/renderer/src/launch/AgentPage.tsx` (0.3.13, see the amendments above); before 0.3.13 `HomeWork.tsx#AgentsAtWork`, `JoinedAgents.tsx` and `EstateAgents.tsx`
- **Scenarios:** SCN-166, SCN-167
- **Resources:** ADR-0160 §3; SCR-39, SCR-76 (built today)
- **Status:** built
- **Implementation tasks:** 0.3.7 waves 3 and 4

### SCR-88: История
- **Amended 2026-10-26 (0.3.13, CO-414), what ships now:** the filters «Кто», «Проект», «Что» and «Поиск» above the acts, kept while the window is open, with «Ничего не найдено.» and «Сбросить фильтры» when they match nothing; the act's sentence opens the detail pane beside the list (SCN-168's amendment of 2026-10-26). Coverage: `apps/desktop/src/renderer/src/launch/HistoryScreen.tsx#HistoryScreen`; test `apps/desktop/src/renderer/src/launch/HistoryScreen.test.tsx`.
- **Amended 2026-10-26, iteration 1 (0.3.13 release review, iteration 1, UX-4, UX-5, UX-6, UX-10):** a reading belongs to the filters it was read under: when the filters change the list says «Читаю историю…» until their read answers, and a failed read keeps only what was read under the same filters, never another filter's acts. The detail pane's undo row is labelled «Можно ли отменить»; an act undone by one that is not among the acts read says «Отменено: более позднее действие, которого нет в этом списке». «Закрыть» returns focus to the act's sentence, and the pane is brought into view when it opens (under 850 px it sits below the list). In «Что делали агенты» a row that opens nothing says why beside it, where a keyboard and a screen reader reach it, with no event type. Code: `apps/desktop/src/renderer/src/launch/HistoryScreen.tsx#HistoryScreen`, `#ActDetail`, `#AgentWork`. Test: `apps/desktop/src/renderer/src/launch/HistoryScreen.test.tsx`.
- **Amended 2026-10-26, iterations 2 and 3 (0.3.13 release review, iteration 2, UX-6; iteration 3, UX-1, UX-3):** the pane's undo lines read «Отменено действием: …» («…более поздним действием, которого нет в этом списке»); «Что делали агенты» emptied by «Кто» or «Проект» says «Ничего не найдено.» with «Сбросить фильтры».
- **Used by:** FLW-93, FLW-95, FLW-97
- **Purpose:** Every act — by the person, by Fabric, by a named agent — with when, on what, and «Отменить» where an inverse exists or why not where none (plan §2, ADR-0160 §2). Replaces the journals, Pulse, Diagnostics and the Releases log. Below the acts: «Что делали агенты», the journal's events in plain words (OF-34), and, folded at the foot, «Журнал Fabric и версия», the operations log and the build line, read only when opened (CO-387, 0.3.11).
- **Elements:** filters «Кто», «Проект», «Что» and a search field; acts grouped by day; each row: time, actor's sign and name, the act in a sentence, project, «Отменить» or «Нельзя отменить» (its reason on hover and focus); the detail pane (before and after, source, the act that undid it); «Ещё раньше».
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | first read | none | «Читаю историю…» |
  | empty | no act yet | none | «История пуста: здесь появится каждое действие — ваше и агентов.» |
  | filtered-empty | filters match nothing | none | «Ничего не найдено» with «Сбросить фильтры» |
  | error | the history could not be read | none | «История не прочитана.» with «Повторить»; an earlier reading kept and marked |
  | success | read | none | days of acts |
  | long | older acts exist | none | «Ещё раньше» loads them when the person presses it |
  | undoing | «Отменить» pressed | none | the button busy |
  | undone | the inverse recorded | none | «Отменено · {время}» beside «Вы отменили: …» with its own «Отменить» |
  | cannot-undo | no inverse | none | «Нельзя отменить» with why |
  | changed-since | the object changed after the act | none | the button says what it will do now |
- **Axes:** viewport: 1024, 1440; theme: dark, light; text: default, 200%; locale: ru, en
- **Coverage:** apps/desktop/src/renderer/src/launch/HistoryScreen.tsx (0.3.7 wave 3: acts newest first by day, who did each, «Отменить» or why not, «Ещё раньше», the failed read with «Повторить»), apps/desktop/src/renderer/src/launch/ActLine.tsx (the act line at a place's foot), apps/desktop/src/renderer/src/launch/actWords.ts; the read is wave 2's `acts.history` (apps/desktop/src/main/acts.ts); «Что делали агенты» by day with who did each (0.3.12 S6, CO-395, `apps/desktop/src/renderer/src/launch/HistoryScreen.tsx`). the filters and the detail pane, built in 0.3.13 (CO-414; see the amendments above)
- **Scenarios:** SCN-168, SCN-169, SCN-164, SCN-167
- **Resources:** ADR-0014 (the journal), ADR-0160
- **Status:** built
- **Implementation tasks:** 0.3.7 wave 2

### SCR-89: Настройки
- **Amended 2026-10-23 (0.3.12, CO-400; [the walk](../evidence/plans/2026-10-15-fabric-simple/2026-10-23-operator-walk.md)), what ships today:** the account quotas are gone from Fabric (they are Switchboard's, D-3, CO-392); the coding agents' catalogue from Switchboard sits here with what Fabric found on this computer, naming a refusal and a missed deadline apart from a failure; «Этот компьютер» sets whether this machine is the person's own (ADR-0176); a setting that is not saved is said at the screen's foot, pinned in view (CO-313). Code: `apps/desktop/src/renderer/src/launch/SettingsScreen.tsx`. Scenario: SCN-170, SCN-160.
- **Amended 2026-10-24 (0.3.12 W3e, CO-407; 0.3.12 release review, iteration 1, DO-4, UX-8, UX-18, UX-20):** the sections as shipped, in order: «Разрешения агентов», «Агенты для кода на этом компьютере», «Когда у агента кончился лимит», «Сообщения между сессиями агентов», «Готовность Fabric»; beside them «Компьютер», «Вид», «Данные и доступ», «Ещё». The Elements' section names below («Язык и вид», «Запуск агентов», «Данные», «Доступ агентов») and «Сохранено» are the 0.3.7 target, moved to 0.3.13 with CO-348 (Settings' section pass). A refused settings write is said once at the screen's foot, «Настройки не сохранены: {причина}. На экране то, что записано на диске.», never beside the control. «Сообщения между сессиями агентов» switches Claude Code's own setting for all its sessions here; a refused write says «Не сохранилось: настройки Claude Code не приняли изменение. Переключатель показывает то, что записано в файле.» with the machine's words beneath and keeps the switch at what the file holds; an unreadable file is said apart. «Готовность Fabric» runs the launcher's read-only check on «Проверить»; a failed check shows our sentence with the machine's words beneath.
- **Amended 2026-10-26 (0.3.13, Settings' section pass, CO-392's rest, CO-348; 0.3.13 release review, iteration 1, UX-9, UX-11), what ships now:** the Elements' sections are built, in this order: «Язык и вид», «Этот компьютер», «Запуск агентов», «Данные», «Доступ агентов», then «Ещё» (SCN-170's amendment of 2026-10-26). «Сохранено» shows beside the control whose change was written, until the next change; a refused write says nothing beside it and stays pinned at the foot. In «Запуск агентов», beside «Разрешения агентов», «Доверять папке, в которой запускается сессия Claude Code» (on by default); where `FABRIC_TRUST_AGENT_FOLDERS=0` keeps folder trust off, the switch shows off, cannot be changed and says why beneath it («Отключено на этом компьютере: переменная FABRIC_TRUST_AGENT_FOLDERS=0 отключает доверие папкам независимо от состояния этого переключателя.»). Code: `apps/desktop/src/renderer/src/launch/SettingsScreen.tsx#SettingsScreen`, `#AgentPermissionsSetting`; `apps/desktop/src/shared/folderTrust.ts#folderTrustOverridden`. Test: `apps/desktop/src/renderer/src/launch/SettingsScreen.test.tsx`.
- **Used by:** FLW-40, FLW-93
- **Purpose:** How Fabric behaves, on one page of sections; every change saved at once and reversible (plan §2). Replaces Settings, Quotas and Private history as a section.
- **Elements:** sections with small uppercase labels — «Язык и вид» (язык, тема), «Компьютер» (не давать засыпать; «Запускать Fabric при входе в систему», only on macOS and Windows in an installed build, amended 2026-10-20), «Запуск агентов» (порядок), «Данные» (счётчики использования; личная история — экспорт и импорт), «Доступ агентов» (who may reach which product, «Отозвать»); «Сохранено» beside a saved control.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | first read | none | each section «Читаю…» |
  | empty | no agent has access to any product | none | «Доступ агентов» says «Ни одному агенту не открыт доступ к продуктам» |
  | error | a setting did not save | none | «Настройки не сохранены: {причина}. На экране то, что записано на диске.» pinned at the screen's foot; the controls show what is on disk |
  | success | read | none | the sections |
  | unavailable | this build or computer cannot change a setting | none | the control disabled with why; a control that does nothing here (launch at login on Linux or in a development build) is not drawn |
- **Axes:** viewport: 1024, 1440; theme: dark, light; text: default, 200%; locale: ru, en
- **Coverage:** `apps/desktop/src/renderer/src/launch/SettingsScreen.tsx` (see the amendment above)
- **Scenarios:** SCN-170
- **Resources:** SCR-52 (built today), SCN-134, SCN-135
- **Status:** built
- **Implementation tasks:** 0.3.7 wave 4

### SCR-90: Создать
- **Used by:** FLW-93, FLW-96, FLW-98
- **Purpose:** The one place every start begins — a projects folder, a project or an agent — in the main area, never a pop-up (plan §2; the onboarding plan §2–§4, absorbed).
- **Elements:** three choice cards with one line of what you get — «Открыть папку с проектами» (primary), «Создать проект», «Создать агента» — and «Открыть проект из папки» under the first; the scan list (owner groups, ticks, «давно не менялся», «Отметить все», «Только активные», «Работать над отмеченными»); the project form (name, where it lives, first task, «Создать»); the agent form (what it does, which coding agent, project, «Создать»); the act line.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | choosing | opened | none | the three cards |
  | scanning | a folder picked | none | the live count, «Остановить» |
  | slow | scanning past 10 s | none | «Ищу дольше обычного — можно остановить» |
  | denied | macOS refused the folder | none | «Нет доступа к папке» with «Открыть настройки macOS» |
  | found | the scan finished | none | the groups, the active ticked |
  | empty | nothing found | none | «В этой папке проектов не нашлось» with «Выбрать другую папку» |
  | adding | «Работать над отмеченными» pressed | none | the button busy |
  | added | added | none | the list with «Открыть»; «{N} проектов добавлено · Отменить» |
  | creating | «Создать» pressed | none | the button busy |
  | created | created | none | the project or the agent's console opens |
  | error | a path failed | none | «Не получилось: {что}» with the machine's words beneath; what was chosen and typed kept |
  | loading | the agents for the agent form are read | none | «Ищу агентов…» |
  | success | the chosen path finished | none | as added or created |
- **Axes:** viewport: 1024, 1440; theme: dark, light; text: default, 200%; locale: ru, en
- **Coverage:** apps/desktop/src/renderer/src/start/StartPaths.tsx region `create-place` (0.3.7 wave 3: the three choices, one folder or several, an agent built elsewhere, and the unfinished drafts); the paths behind each choice are SCN-127…SCN-129 and SCN-136's screens, redrawn in this frame in wave 4
- **Scenarios:** SCN-171, SCN-127, SCN-128, SCN-129, SCN-136
- **Resources:** SCR-71…SCR-74 (built today, redrawn here); [onboarding plan](../evidence/plans/2026-10-13-onboarding-036/README.md)
- **Status:** built
- **Implementation tasks:** 0.3.7 wave 4

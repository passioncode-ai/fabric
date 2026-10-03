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
| SCR-25 | Session window | FLW-16 | none — text-only | built | `apps/desktop/src/renderer/src/SessionWindow.tsx` |
| SCR-26 | Workspace canvas | FLW-17 | none — text-only | built | `apps/desktop/src/renderer/src/Workspace.tsx` |
| SCR-27 | Onboarding | FLW-18, FLW-32 | none — text-only | built | `apps/desktop/src/renderer/src/Onboarding.tsx` |
| SCR-28 | Editor window | FLW-19 | none — text-only | designed | none yet |
| SCR-29 | Public landing page | FLW-20 | none — repository-first | designed | static site |
| SCR-30 | Estate home | FLW-21, FLW-32, FLW-33 | none — text-only | built | `apps/desktop/src/renderer/src/launch/LaunchShell.tsx` |
| SCR-31 | Project page | FLW-21, FLW-22, FLW-23, FLW-24, FLW-32, FLW-33 | none — text-only | built | `apps/desktop/src/renderer/src/launch/ProjectLaunch.tsx` |
| SCR-32 | Task page | FLW-22, FLW-23, FLW-32, FLW-33 | none — text-only | built | `apps/desktop/src/renderer/src/TaskPage.tsx` |
| SCR-33 | Decision history (target; legacy preview remains) | FLW-21, FLW-26, FLW-28 | none — text-only | designed | none yet |
| SCR-34 | Project memory | FLW-21, FLW-22, FLW-31, FLW-34, FLW-35, FLW-36 | none — text-only | built | `apps/desktop/src/renderer/src/MemoryOverviewSection.tsx` |
| SCR-35 | Project harness | FLW-24 | none — text-only | built | `apps/desktop/src/renderer/src/HarnessSection.tsx` |
| SCR-36 | Estate record | FLW-21 | none — text-only | built | `apps/desktop/src/renderer/src/ProfileSection.tsx` |
| SCR-37 | Search results | FLW-21 | none — text-only | built | `apps/desktop/src/renderer/src/SearchPanel.tsx` |
| SCR-38 | Harness tool | FLW-24 | none — text-only | designed | none yet |
| SCR-39 | Estate agents | FLW-21, FLW-27 | none — text-only | built | `apps/desktop/src/renderer/src/EstateAgents.tsx` |
| SCR-40 | Graph explorer family | FLW-23, FLW-27 | none — text-only | built | `apps/desktop/src/renderer/src/launch/PlanScreen.tsx` |
| SCR-41 | Ranked Board and question detail | FLW-25, FLW-26, FLW-27, FLW-28, FLW-29 | none — text-only | built | `apps/desktop/src/renderer/src/launch/BoardScreen.tsx` |
| SCR-42 | Inbox | FLW-21, FLW-29 | none — text-only | designed | none yet |
| SCR-43 | Cycles | FLW-30 | none — text-only | designed | none yet |
| SCR-44 | Manager lifecycle | FLW-34 | none — text-only | designed | none yet |
| SCR-45 | Retrospectives | FLW-35 | none — text-only | designed | none yet |
| SCR-46 | Service feedback settings | FLW-35 | none — text-only | designed | none yet |
| SCR-47 | Storage and sync | FLW-36 | none — text-only | designed | none yet |
| SCR-48 | Restore | FLW-36 | none — text-only | designed | `apps/desktop/src/main/backup.ts` |
| SCR-49 | Маршрут работы | FLW-37 | none — interactive HTML | designed | none yet |
| SCR-50 | Цели и приёмка | FLW-38 | none — interactive HTML | designed | none yet |
| SCR-51 | Квоты и использование | FLW-39 | none — interactive HTML | designed | none yet |
| SCR-52 | Настройки рабочего пространства | FLW-40 | none — interactive HTML | designed | none yet |
| SCR-53 | Уведомления и маршруты | FLW-41 | none — interactive HTML | designed | none yet |
| SCR-54 | Диагностика | FLW-42 | none — interactive HTML | designed | none yet |
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
| SCR-70 | First run | FLW-69 | none — text spec | built | apps/desktop/src/renderer/src/start/ |
| SCR-71 | Add a project | FLW-70 | none — text spec | built | apps/desktop/src/renderer/src/start/ |
| SCR-72 | Scan a projects folder | FLW-71 | none — text spec | built | apps/desktop/src/renderer/src/start/ |
| SCR-73 | New project | FLW-72 | none — text spec | built | apps/desktop/src/renderer/src/Onboarding.tsx |
| SCR-74 | New agent | FLW-73 | none — text spec | built | apps/desktop/src/renderer/src/start/ |
| SCR-75 | Convert an agent | FLW-74 | none — text spec | built | apps/desktop/src/renderer/src/start/StartPaths.tsx |
| SCR-76 | Agent access | FLW-75, FLW-76 | none — text spec | built | apps/desktop/src/renderer/src/AgentAccessPanel.tsx |

## Design system

- **Style pack:** `paperclip` (SHELEG), adopted 2026-08-31 — see `foundation.md` → Design tooling
- **Figma library:** none — Figma disabled for this iteration
- **Tokens in code:** `apps/desktop/src/renderer/src/tokens.paperclip.css` (pack, verbatim) + `tokens.app.css` (semantic aliases); enforced by `scripts/check-design.mjs`
- **Component source:** none yet
- **Assets:** none yet

## Web surfaces

- **Web surfaces:** yes — `https://passioncode.ai/` is the public, static,
  English-primary landing page, with source in
  `passioncode-ai/passioncode-ai.github.io`.
- **Marketing calibration:** `DESIGN_VARIANCE 7 · MOTION_INTENSITY 3 · VISUAL_DENSITY 4`.
  The approved PassionCode.ai brand tokens and mark replace a generic style pack for this
  surface. Motion is omitted in v1, so the implemented intensity is intentionally calm.

## Screens

### SCR-01: Estate projects
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
- **Used by:** FLW-16 steps 2–4; FLW-54
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
- **Coverage:** `apps/desktop/src/renderer/src/SessionWindow.tsx`, `apps/desktop/src/renderer/src/TerminalView.tsx`
- **Scenarios:** SCN-025, SCN-029, SCN-091
- **Resources:** main-process PTY sessions; journal `terminal.*`; ADR-0008; ADR-0031
- **Status:** designed

- **Account continuation proposal:** Ссылка «Продолжить с другим аккаунтом» ведёт в SCR-63 / FLW-51; SCN-083, M199. Только целевой макет, runtime не реализован.
- **Planned extension — V1 context panels (target, not current coverage):** по решению оператора 2026-09-12 (the context panels belong wherever the agent console is open) это окно несёт контекстные панели SCN-091 как первоклассные элементы рядом с терминалом, тем же компонентом, что и SCR-39: полоса вопроса с ответом inline и возрастом; бриф задачи (что/зачем/ожидаемый результат, с авторством и переходом на SCR-32); прогресс — заявление агента рядом с наблюдением и план задачи закрыто/сейчас/дальше; хронология команд и ответов оператора этому агенту, каждая строка с журнальной цитатой. Сегодня окно рендерит только header + `TerminalView` (`SessionWindow.tsx`) — панелей нет, и это зафиксировано как зазор, а не как поставка. FLW-54; SCN-091; план: `docs/ux/plans/2026-09-12-v1-context-reentry.md`, веха V1-M1.

### SCR-26: Workspace canvas
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
- **Used by:** FLW-21, FLW-32, FLW-33, FLW-54
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
- **Coverage:** none yet
- **Scenarios:** SCN-043, SCN-044, SCN-059, SCN-060, SCN-092, SCN-093
- **Resources:** `projects`, `agent_bindings`, journal; the portrait contract in `docs/brand/ui.md`
- **Status:** designed
- **Prototype now renders the V1 five-lane home (2026-09-12, target design, not coverage):** operator brief — the home lacked an avatar and statistics, and the focus on returning to context was not visible. The mockup (`scripts/product/workbench.mjs`, view `estate`) now leads with the Fabric greeting band (mark + the digest voiced with the oldest wait age), a measured stat row where every figure names its register (SCN-044's rule applied to the home), then the five lanes in the fixed order Вопросы → Сейчас → Было → Дальше → Решения with ONE lane open on arrival (Вопросы if any, else Было) — the раскладушка of `plans/2026-09-12-v1-design-language.md` §1–§3. Tested mechanics survived recomposition: pin-project, host-unavailable/host-ready, sources table, CEO launcher (browser suites re-run green). The bespoke empty welcome is unchanged.
- **Planned extension (not current coverage):** Board top5, Inbox and cycle summaries use scoped coverage and separate destinations. FLW-25/29/30; SCN-050/055/056. See [engineering contract](../architecture/system-contract.md).
- **Addressable subviews (target only):** Restored working set and resume-draft entry preserve operator intent. SCR-01 resolves to project-inventory intent here, not a duplicate estate route.

### SCR-31: Project page
- **Used by:** FLW-21, FLW-22, FLW-23, FLW-24, FLW-32, FLW-33, FLW-54
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
- **Coverage:** partly — `apps/desktop/src/renderer/src/ProjectHome.tsx` holds the panels this recomposes
- **Scenarios:** SCN-040, SCN-041, SCN-060
- **Resources:** `project_tasks`, journal, `agent_stages`, leases
- **Status:** designed
- **Planned extension (not current coverage):** Board top10; separately addressed Project history, Target plan and Decisions previews; per-agent/task TaskRun widget. FLW-25/27/28/31; SCN-050/052/053/054/057/058. See [engineering contract](../architecture/system-contract.md).
- **Addressable subviews (target only):** SCR-03 overview is an intent of this same project surface. Deep links carry exact authorised project/entity/return context; a missing or denied source never falls back to another project.

### SCR-32: Task page
- **Used by:** FLW-22, FLW-23, FLW-32, FLW-33, FLW-54
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
- **Coverage:** none yet
- **Scenarios:** SCN-045, SCN-060, SCN-067
- **Resources:** `project_tasks`, `memory_facts`, `effect_intents`, `session_transcripts`
- **Status:** designed
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
- **Used by:** FLW-21
- **Startup boundary (first-release entry):** Before this screen, a schema/build failure uses the existing native startup dialog. No project data or chat is shown; recovery/agent services have not started in this attempt. Retry rechecks the schema; invalid build identity requires restart. Prototype review tools offer explicit compatible/older/newer/unavailable/invalid-build examples and never infer success from Retry.
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
- **Used by:** FLW-25, FLW-26, FLW-27, FLW-28, FLW-29
- **Purpose:** One scoped union of unresolved authored questions and derived obligations, separate from task Kanban; one source for home top5/project top10/full/counters.
- **Elements:** Scope/filter/grouping, stable rank with component disclosure, canonical selected item, owner/age/source/blockers, options with consequences, answer draft, commit receipt and continuation receipt separately, full-list cursor. Grants route to SCR-24 authority detail where needed.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | No successful union read | none | No zero badge or clear claim. |
  | empty | Complete unresolved query returns zero | none | Only state no unresolved items in this scope; do not claim autonomous work is succeeding. |
  | open question | Selected authored question open | none | Answer form tied to question revision; impacts and primary action visible. |
  | derived obligation | Review/refusal/lease/proposal unresolved | none | Offer the action that resolves underlying state; no dismiss/read action. |
  | delivery unknown | Possible write without conclusive receipt | none | Keep committed answer visible; inspect addressed session; no automatic resend or closed-loop claim. |
  | delivery queued | Another dispatcher owns a fenced pending instruction | none | Show waiting separately from written and accepted. |
  | submitting | Answer command pending | none | Retain draft and identity; prevent duplicate submission, support same command retry. |
  | committed | Answer accepted | none | Show decision receipt and remaining blockers; delivery remains separate. |
  | continuing | Response not yet acknowledged | none | Queued/delivering/acked/retryable/needs restart visible with exact target. |
  | conflict | Another answer or revision won | none | Show current receipt and preserve unsent draft for copying; no overwrite. |
  | partial or stale | Union source failed or aged | none | Retain known rows and coverage; do not silently re-rank while interacting. |
  | resolved history | Resolved item reached by link | none | Open immutable receipt with return, not fake missing/open item. |
- **Coverage:** none yet
- **Scenarios:** SCN-050, SCN-051, SCN-053, SCN-055, SCN-058
- **Resources:** QuestionService, BoardService, AnswerService, ContinuationService target contracts; questions/question_blocks, current obligations, command and decision receipts.
- **Status:** designed

### SCR-42: Inbox
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
- **Status:** designed

### SCR-43: Cycles
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
- **Status:** designed


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
- **Scenarios:** SCN-069
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
- **Purpose:** Настроить тему, локаль, поведение пробуждения, хранение и допустимые проектные ограничения.
- **Elements:** Глобальная настройка → проектный override → проверка сужения прав → новая ревизия. Повышение прав не следует из настройки интерфейса.
- **Primary action:** Глобальная настройка
- **Scenarios:** SCN-071
- **Flows:** FLW-40
- **Implementation tasks:** M72, M73, M152
- **Prototype:** [Адрес макета](../reports/product.html#view-estate-settings); контракт [mockup-contract.md](mockup-contract.md).
- **Status:** designed
- **Coverage:** none yet

| State | Trigger | Animation | Behavior |
|---|---|---|---|
| loading | соответствующий ответ источника | none | Чтение собственного источника; не показывать выдуманные нули. |
| empty | соответствующий ответ источника | none | Подтверждённое отсутствие записей с действием начала работы. |
| error | соответствующий ответ источника | none | Источник или проверка отказали; черновик сохранён и ошибка названа. |
| success | соответствующий ответ источника | none | Глобальная настройка → проектный override → проверка сужения прав → новая ревизия. Повышение прав не следует из настройки интерфейса. |
| permission | соответствующий ответ источника | none | Нет допуска — защищённые данные скрыты, изменение заблокировано. |
| stale | соответствующий ответ источника | none | Показать разрешённый снимок; изменение только после повторного чтения. |

- **Domain states:** inherited, overridden, validation-error, saved, read-only.


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
- **Purpose:** Прочитать состояние источников и безопасный журнал; экспортировать проверяемый набор без секретов.
- **Elements:** Проблема → диагностика источника → отбор безопасных строк → предпросмотр → локальный экспорт. Недоступность источника и пустой журнал различаются.
- **Primary action:** Проблема
- **Scenarios:** SCN-073
- **Flows:** FLW-42
- **Implementation tasks:** M81
- **Prototype:** [Адрес макета](../reports/product.html#view-diagnostics); контракт [mockup-contract.md](mockup-contract.md).
- **Status:** designed
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
- **Used by:** FLW-69
- **Purpose:** Meet Fabric once: name and look, the coding agents on this Mac, where to start.
- **Elements:** three-step progress; name, character, variants; executor rows (state, version, path, install command, Copy, Check again); the five path cards; Back, Skip, Later.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | first-visit | empty estate, first run not finished | none | step 1 with defaults |
  | saving | Continue on step 1 | none | Continue busy until the look is saved |
  | not-saved | look save refused | none | reason and Continue without saving |
  | checking | detection running | none | busy line |
  | found | agent answered --version and Fabric reaches its session | none | ready pill and version |
  | found-unconnected | agent answered, Fabric does not reach its session | none | installed pill and a note that it runs in the folder as itself |
  | unresponsive | on PATH, no answer | none | needs-setup pill and the run-once advice, no install command |
  | missing | not on PATH | none | not-installed pill and install command with Copy |
  | check-failed | detection itself failed | none | reason and Check again |
  | choose-path | step 3 | none | five cards |
  | skipped | Later on step 3 (Skip on step 1 only moves to step 2) | none | first run marked finished; home, Help reopens it |
- **Coverage:** apps/desktop/src/renderer/src/start/FirstRun.tsx
- **Scenarios:** SCN-126
- **Resources:** [ADR-0100](../adr/0100-first-run-and-start-paths.md).
- **Implementation tasks:** P-01

### SCR-71: Add a project
- **Used by:** FLW-70
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
- **Used by:** FLW-71
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
- **Coverage:** apps/desktop/src/renderer/src/start/StartPaths.tsx
- **Scenarios:** SCN-128
- **Resources:** [ADR-0100](../adr/0100-first-run-and-start-paths.md).
- **Implementation tasks:** P-01

### SCR-73: New project
- **Used by:** FLW-72
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

### SCR-74: New agent
- **Used by:** FLW-73
- **Purpose:** Route to the agent form of the project the agent belongs to; the form's own states (reading, unreadable, empty, invalid, saving, failed, created) are SCN-130 steps 2–4 on the project's team.
- **Elements:** project list; no-project notice with Add a project and New project.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | project list unknown | none | busy line |
  | no-project | estate has no project that is not archived | none | notice with two paths |
  | choose-project | projects exist | none | one button per project |
- **Coverage:** apps/desktop/src/renderer/src/start/StartPaths.tsx
- **Scenarios:** SCN-130
- **Resources:** [ADR-0100](../adr/0100-first-run-and-start-paths.md).
- **Implementation tasks:** P-01

### SCR-75: Convert an agent
- **Used by:** FLW-74
- **Purpose:** Explain the planned conversion and today's manual route, with no action that pretends to run.
- **Elements:** planned pill; four steps; today's command.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | planned | AR-7/AR-11 not built | none | explanation and command only |
- **Coverage:** apps/desktop/src/renderer/src/start/StartPaths.tsx (the planned state; the conversion itself is AR-7/AR-11)
- **Scenarios:** SCN-131
- **Resources:** [ADR-0100](../adr/0100-first-run-and-start-paths.md).
- **Implementation tasks:** AR-7, AR-11

### SCR-76: Agent access
- **Used by:** FLW-75, FLW-76
- **Purpose:** What registered agents on this Mac may do through Fabric, what is waiting for an answer, and which products are connected — opened from Settings ([ADR-0115](../adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md)).
- **Elements:** where agents reach Fabric, or why they cannot; products with Connect or Disconnect and the last connect outcome; waiting requests with the agent, what it asks in plain words, its reason as its claim, Deny and Allow; agents with access, each grant in plain words with its expiry and Revoke, and Revoke all; denied requests with Clear the denial.
- **States:**
  | State | Trigger | Figma frame | Behavior |
  |---|---|---|---|
  | loading | first read | none | busy line |
  | unreadable | the overview could not be read | none | says so with Try again; never "no agent has access" |
  | hub-off | the hub's port could not be taken | none | warning with the reason; Connect disabled; sessions unaffected |
  | read | overview read | none | the four lists; an empty list says so in words |
  | waiting | a connect link was opened | none | waiting for the answer in the product |
  | connected | the product delivered its key and the vault kept it | none | server and date, Disconnect |
  | declined | the operator denied in the product | none | says it was declined |
  | failed | the product reported a failure, or the vault refused | none | the reason |
- **Coverage:** apps/desktop/src/renderer/src/AgentAccessPanel.tsx
- **Scenarios:** SCN-132, SCN-133
- **Resources:** [ADR-0115](../adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md).
- **Implementation tasks:** AR-3.1, AR-3.4

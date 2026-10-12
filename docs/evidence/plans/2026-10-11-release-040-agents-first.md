# Plan · 2026-10-11 · Fabric 0.4.0 — agents first: the harness every coding agent reaches, the manager that knows where work is

Operator requests, 2026-10-10 and 2026-10-11 (in Russian, summarised; each becomes REQ rows below):

1. **Review of the new user's path** (2026-10-10): every screen and component of setting up the machine and the
   agents, checked for design, quality, storytelling and clarity; nothing superfluous on any screen; the accent on
   agency — Fabric is where agents are **created**, **composed into workflows**, **refined and fixed**; it becomes
   the main app; it is also an MCP server, so a coding agent even in a plain open console knows how to reach
   Fabric's harness.
2. **One plan, one pass** (2026-10-11): gather every request into one plan, resolve the questions, plan the
   implementation so it closes in one pass, and new features fit natively into the system.
3. **The manager flow** (2026-10-11): a Fabric agent in Fabric Dashboards showing current tasks per project;
   projects join Fabric's working list automatically when we work on them, repositories attributed to the right
   project; the harness gives any coding agent the instructions to log and track its work and add tasks, so the
   whole working process is journalled; then Fabric is the **manager agent** — it always knows where what was done,
   manages plans, sees what to improve, coordinates agents itself or collects what it needs from the operator.
4. **Close the whole board** with these requests, designed against the final state of the system, not through
   intermediate ones.
5. **The method** (2026-10-11): research, audit and task gathering first; place everything on one canvas over the
   current logic; design the integration and the whole new system; plan from the post-integration target; waves
   that each close in one pass, each followed by a verification, finishing, fixing and documentation pass; questions
   to the operator collected and asked at the end; codified in the standard approach (task-pipeline, routing).
6. **Other products' asks** (fabric-dashboards-76, 2026-10-10 and 2026-10-11 — the spend policy, REQ-36; brief
   [`2026-10-10-agents-first-brief.md`](https://github.com/passioncode-ai/fabric-dashboards/blob/agent/fd39-agents-first/docs/evidence/briefs/2026-10-10-agents-first-brief.md)):
   RM-09 (the first run installs and registers the family products through the coding agent, one consent per
   product), CO-194 (Fabric-started sessions reach the products' MCP), one context-pack convention across products,
   the same pack for a Fabric agent opened in Dashboards' console and the reverse.
7. **In flight:** CO-238 — Windows and Linux (branch `agent/windows-linux-035`, green on four runners).

Run: `task-pipeline` (Proof of Done) in **wave mode** (this plan is its first use; the doctrine is being added to
task-pipeline on branch `feat/wave-mode`, see [Method](#method)). Lease `release-040-plan` (run r-22786ba16).
Branch `agent/release-040-plan`.

Vision alignment (AGENTS.md hard rule): the operator chose to **amend the vision** (decision D-01): Fabric is
where agents are created, composed into workflows and fixed, and the harness every coding agent reaches; the
Project stays the operating unit (an agent is built as a Project, a workflow lives in a Project). The anti-vision
is unchanged — and the CEO chat, the one surface that contradicted it (a second chat cockpit), retires here (P-13).

## Contents

- [Decisions](#decisions)
- [Sources](#sources)
- [The review — what a new user meets today](#the-review)
- [Canvas — the target state over the current logic](#canvas)
- [Ownership — one home per fact](#ownership)
- [ADRs this release writes](#adrs)
- [REQ table](#req-table)
- [Waves](#waves)
- [Questions for the operator](#questions)
- [Method](#method)
- [Carried](#carried)

<a id="decisions"></a>
## Decisions

Operator, 2026-10-11 (one batch, recommended answers taken):

| # | Question | Answer |
|---|---|---|
| D-01 | Vision says «we operate Projects, not agents; agents replaceable, not central» — how to reconcile the agent-factory accent | **Amend the vision** (§1, §3, §7): agents are created, composed and fixed in Fabric; Fabric is the harness every coding agent reaches; the Project stays the operating unit. New ADR |
| D-02 | What one pass ships | **Everything, as 0.4.0**: Windows/Linux, agents-first (harness for any console, the Setup console, the agent registry, workflows), the cleanup of every screen, the CEO chat retired (P-13), Russian from the main process (CO-225), self-update with Windows/Linux feeds (P-12). Three verification iterations over the whole |
| D-03 | What a coding agent opened in a plain terminal may do in Fabric's harness | **The full working set in a project**: it connects through `fabric-mcp` (registration holds no secret), its first call asks for access, the operator allows once per agent + project (folder → project); then the same tools a Fabric-launched session has; revocable. New ADR beside ADR-0115 |
| D-04 | Who installs the adapter skills, connects Fabric to the agents and installs the family products | **The coding agent, in a Setup console** opened by Fabric with a setup brief — skills → Fabric's MCP in each agent → products one at a time (verified `SHA256SUMS` + GPG, a proving call), one consent per step; the interface shows the result as a checklist; removal is symmetric. Fabric itself still writes nothing (ADR-0129 §4 is refined by a new ADR) |

Resolved from the sources, not asked (each with its ground):

| # | Question | Resolution | Ground |
|---|---|---|---|
| R-01 | Name of the shared pack format | **`session-handoff/1`** — not `execution-packet/1`, which in Fabric is the content-addressed integrity manifest (`executionPacket.ts:17-32`) and in task-pipeline the dispatch packet (`execution-packet.schema.json`); its schema lives in `fabric-agent-contract` beside `execution-context.schema.json` | one name, one meaning; one home per fact (knowledge base) |
| R-02 | How a workflow of agents is composed | a **versioned workflow** in a project (`workflow.defined@1`, `workflow.revised@1`), steps are an agent session or an `agent.call` to a registered service; materialised into tasks + `follows` links so `chainAdvance` runs it; **the coding agent composes and revises it through MCP tools**, the operator approves a revision, the screen shows the graph, the runs and the diff | principle 8 Agents first (knowledge base, operator 2026-10-10); ADR-0009, ADR-0045, ADR-0054 |
| R-03 | Routine / Automation / Cycle / Chain naming (CO-099) | **Workflow** = the versioned graph; **Schedule** = what starts a workflow on time or on an event (today's routine); a **run** = one execution. «Automations», «Cycles», «Rhythm of work» retire as labels | CO-099; CONTEXT.md has no Chain/Workflow/Harness entries |
| R-04 | Fabric in Dashboards without breaking ADR-0031 (no local web dashboard of Fabric's own) | Fabric writes its own `fabric-service/0.1` descriptor and answers `/.well-known/fabric-service` with tiles and a **read-only viewer MCP** (`fabric.work.overview`, `fabric.project.tasks`); no `dashboard` surface; Dashboards draws the tasks-per-project view natively (its P-07.3) | Dashboards ADR-0012 §5, ADR-0016; ADR-0083 |
| R-05 | Auto-adding projects vs the folder boundary (ADR-0100 §7) | a **consented admission**: the first time an agent reports from an unadmitted folder, one prompt — log under the matched project / a new project / don't log here; Allow admits that folder exactly as a pick would | ADR-0100 §7; LC-07 ask once at first need |
| R-06 | Observatory's repository map | a **suggestion source** only, read over the existing interop call; Fabric stores a link (`projects.observatory_id`), never a copy | one home per fact; Observatory owns estate identity |
| R-07 | Logging work: Fabric journal vs backlog rows vs agent-sync vs Observatory | **link, don't copy**: a Fabric task is the *run* and carries `source: {repository, path, id}` of the backlog row, which stays the canonical *status*; agent-sync leases are shown read-only; Observatory continuity keys to the Fabric task id | ADR-0001; `knowledge/backlog.md` |
| R-08 | Default language | the system's preferred language at the first start (`ru*` → ru), stored as the setting, changeable in step 1 | `shared/types.ts:416` hard-codes `en` |
| R-09 | Design surface | text and the prototype (`docs/reports/product.html`), no Figma — as 0.3.3 and Dashboards D-8 | `docs/ux/screens.md` → Design system |
| R-10 | Where the setup order lives | in the knowledge base (`knowledge/agents-first.md`), one home; Fabric's setup brief and Dashboards' Setup console render the same order | Inbox B-81 «the order is the launcher owner's»; adapter#49 |

<a id="sources"></a>
## Sources

| Source | What it holds for this release |
|---|---|
| The live walk, 2026-10-10 | 4 walks (en, ru, two targeted), ~80 screens of the built 0.3.4 on a disposable stack, a fresh profile and an isolated home; screenshots kept locally (media stays out of Git) — findings in [The review](#the-review) |
| Two audits, 2026-10-10 | scenarios vs code for the new user's journey; how a plain-terminal agent reaches Fabric |
| `docs/adr/` | ADR-0115 (hub: registered agents only), ADR-0119 §2 (never write an agent's user config to connect a run), ADR-0123 (no chat; P-13), ADR-0129 §4 (installs nothing), ADR-0100 §7 (folder boundary), ADR-0026 (northbound MCP bindings), ADR-0009/0045/0054 (pipelines, runs, one gate), ADR-0121 (self-update, proposed); next free **ADR-0133**, the pipeline reservation ADR-0132 must move past every new ADR (`test/audit_regressions/fix-pf-06.03.py`) |
| `docs/evidence/backlog.md` | Now = CO-238; P-12, P-13 «after 0.3.4, order with 0.3.5 undecided»; lanes 1–13; no P-16 row although the port brief names one |
| Carry-over ledger | CO counter at **247** (main's text says 244; the port branch used 244–246); CO-194, CO-225, CO-099, CO-220, CO-239, CO-240, CO-242 open |
| `docs/evidence/retro.md` | standing instructions R-001…R-010 bind this run (R-001 propagate a hierarchy change; R-006 watched failing; R-010 verify a surface the way its user meets it — MCP with a real client) |
| Knowledge base (`workspace/knowledge/`, main `e66b3a0`, ahead of the pin `88ac2692`) | principle 8 Agents first and `agents-first.md` (operator 2026-10-10); RM-09; `products.md` install + MCP lines; `platforms.md` PL-01…PL-10; `lifecycle.md` LC-04/07/14/16 |
| Fabric Dashboards `origin/main` 3615e0f (FD-39 landed, PR #67) | `session` pack in `src/core/handoff.ts`; descriptor and well-known document (`packages/service-host/src/*`); `service_context` |
| CLIs on this Mac, 2026-10-11 | Claude Code 2.1.296: `claude mcp add --scope user <name> -- <cmd>`, `--append-system-prompt[-file]`, `--mcp-config`, `--strict-mcp-config`; Codex 0.162.1: `codex mcp add <name> -- <cmd>`; Kilo 7.4.17: `kilo mcp add`; Hermes: `hermes mcp`; launcher: `update`, `status`, `restore`, `uninstall` (no `onboard`) |
| Code graph | stale (`graphify-out/graph.json`, 2026-09-01) — reach is read from the code; refreshed at the close |

<a id="the-review"></a>
## The review — what a new user meets today (0.3.4, walked 2026-10-10)

Blockers of the agent-factory promise:

- **F-01** A coding agent in a plain terminal cannot use Fabric: working tools exist only behind a per-session
  bearer (`agentSurface.ts:422`); the hub serves registered agents asking for products (`hubTools.ts:59-62`); the door
  token rotates per start and `hub.json` disappears on quit, so no static registration works; Codex, Cline, Kimi get
  no Fabric tools even inside Fabric (`shared/agents.ts:188,271,293`); README says otherwise (`README.md:112-117`).
- **F-02** «Create an agent» and «Adapt» stop on a terminal command on a clean machine
  (`adapterSkills.ts:28`, `AgentPaths.tsx:198-215`); the first run's step 2 never checks the skills.
- **F-03** Claude Code shows «Ready» without a sign-in; the console then opens on Claude's login screen with no
  word from Fabric.
- **F-04** A built agent appears nowhere as an agent: Team says «No agent has been set up», the task title is the raw
  instruction naming `creating-fabric-agents`, «Set up agents» is a session monitor; SCN-121…123 have no coverage.

Major:

- **F-05** Step 1 is an avatar chooser («Variant» ×3 near-identical); its lede says nothing of agents or the harness.
- **F-06** Step 2 repeats one sign-in sentence six times and shows binary paths; unconnected agents get no action.
- **F-07** Step 3: two primary buttons, card titles repeat their buttons, agent actions live under «+ Project», no
  workflow concept.
- **F-08** Home: the first card offers keeping the «estate» in a folder and prints `project_tasks`; «There is
  movement» on an empty estate; the hero says «Fabric» though the person named it (`EstateHome.tsx:421`; also
  `BoardScreen.tsx:365`); no «Create an agent».
- **F-09** Project page ≈ 4 screens: the legacy column stack under the new launch page (`ProjectHome.tsx:374-470`),
  ~20 empty panels, tool names and the MCP URL on screen, four boards, two new-task buttons, duplicate
  `id="sec-board"` (`BoardPanel.tsx:68`, `ProjectHome.tsx:668`), the goal is «From README.md: …», a double negative
  (`en.ts:1689`), dead branch `ProjectHome.tsx:392`.
- **F-10** App settings: labels detached from controls, Quotas appended, `CO-096` on screen; Agent access is a ghost
  button opening a side panel that never says how to connect an agent.
- **F-11** `setup-surface-down` tells the person to start the hub «in the settings» — no such control (`en.ts:1952`).
- **F-12** New project form in the old style, no explicit «only an idea», no Back, a disabled «Cloud».
- **F-13** The network-exposure warning takes a third of every screen and names the live stack's port.
- **F-14** Russian: default English, no system detection; main-process English, machine ids (`pty.signal`,
  `stack.exposed-on-network`), «Из README.md: Answers…».
- **F-15** One feature, four names: Cycles, Project cycles, Automations, Routines (CO-099).
- **F-16** Planning page shows internal principles («colour never stands in for a state», «SHOULD · …»).
- **F-17** The session window gives only the runner name, a raw path and «Stop execution».
- **F-18** Machine readiness (Docker, Supabase CLI) appears only as a startup failure.

<a id="canvas"></a>
## Canvas — the target state over the current logic

One picture of 0.4.0. Each node says what it is today (as-is), what it becomes (to-be), and the seam it meets. Every
REQ lands on a node; nothing below is an intermediate shape a later wave undoes.

```
                 ┌───────────────────────── coding agents (Claude Code, Codex, Kilo, Hermes, …) ─────────────────────────┐
                 │  launched by Fabric        opened in a terminal         hosted by Dashboards / Switchboard consoles      │
                 └──────┬─────────────────────────────┬───────────────────────────────┬─────────────────────────────────┘
                        │ session-handoff/1 pack       │ fabric-mcp (stdio)            │ session-handoff/1 pack
                        ▼                              ▼                               ▼
   ┌─────────────────────────────── C1 Harness: one session surface, three ways in ───────────────────────────────┐
   │ mint (launched) · enroll (door tool → resolver C2 → consent → session token) · hand-off (pack, same token)    │
   │ tools: fabric_* + com.* (SURFACE_TOOLS) — the same set for every way in · revocable · journalled              │
   └────────┬────────────────────────┬───────────────────────────┬───────────────────────────┬───────────────────┘
            ▼                        ▼                           ▼                           ▼
   C2 Resolver & attribution   C4 Work log protocol      C6 Agents registry & build   C7 Workflows
   folder → project, consented  preamble + skill + hooks   built/adapted, conformance   versioned graphs of agent steps
            │                        │                           │                           │
            └──────────────┬─────────┴─────────────┬─────────────┴───────────────┬───────────┘
                           ▼                       ▼                             ▼
                    JOURNAL (spine, ADR-0014) → projections → C8 Manager (CEO session, estate tools, hygiene)
                           │                                                     │
                           ▼                                                     ▼
              C9 Fabric as a service (descriptor, well-known, viewer MCP) → Dashboards / Observatory read
   C5 Setup console (first run) · C10 Screens · C3 Pack format · C11 Platforms & self-update · C12 Release
```

### C1 — Harness: one session surface, three ways in

- **As-is.** A session bearer is minted only for sessions Fabric launches (`agentSurface.ts:422`), scoped to one
  project and task (`AgentScope`, `:187`); the hub's door gives an outside agent `fabric.access.request|status` only,
  and admits only registered `services/`/`providers/` ids (`hubTools.ts:59-62`, `agentRegistry.ts:443`); the stdio
  bridge needs URL and bearer in its environment (`mcpStdioBridgeMain.ts:8-29`) and lives inside app.asar.
- **To-be.**
  - **`fabric-mcp`**, a stdio launcher shipped outside the asar per OS (macOS `Contents/Resources/bin/fabric-mcp`,
    Windows `resources\bin\fabric-mcp.cmd`, Linux `resources/bin/fabric-mcp`), reads `hub.json` on every connect,
    checks the `pid` is alive and is Fabric, reads the door token from the file `hub.json` names, and relays to the
    hub. Registration is static and secret-free: `claude mcp add --scope user fabric -- <path>/fabric-mcp`,
    `codex mcp add fabric -- <path>/fabric-mcp`.
  - **Enrollment**: a door tool `fabric.session.enroll {cwd, runtime, runtimeSessionId}` → C2 resolves the project →
    if no standing grant for (runtime, project), one consent prompt names the agent, the folder and the project →
    Allow mints the **same** project-scoped session scope a launched session gets (a third principal kind, its own
    server built like the session server — ADR-0115's rule that authority is the server a principal is given,
    `hubTools.ts:2-5`). The grant is standing and revocable (Agents & access); every enrollment is journalled.
  - Tools: one catalogue (`SURFACE_TOOLS`) for every way in; `fabric_whoami` returns the pack text itself (today it
    names a file an ACP runner may not see, `agentSurface.ts:1001-1014`).
  - **Family products in sessions (CO-194)**: a session's `mcp.json` may carry a product's server when the operator
    granted that product to that project (the existing `<granted>` entries, `sessionBundle.ts:148-176`), consented in
    Agents & access; `--strict-mcp-config` stays for launched sessions.
  - Codex, Cline, Kimi Code: connected through `fabric-mcp` (stdio is the common denominator), then marked connected
    only after a probe (ADR-0119 §4).
- **Seams.** `accessService.ts:41` (`HubPrincipal`), `hubTools.ts:95` (`hubServerFor`), `agentSurface.ts:703-781`
  (resolve, budget), `mcpStdioBridgeMain.ts`, `hub.ts` (export the reader), `electron-builder.yml` (extraResources),
  migration (enrollment grants: table, grants + RLS in migration 4's shape, `event_types` rows + `event.*` sentences).

### C2 — Resolver and attribution

- **As-is.** Folder → project by exact real path only (`startChoices.ts:240-255`); `project_repos` has no remote and
  no uniqueness across projects (`…000003_onboarding_foundations.sql:15-26`); the scan reads remotes for display only.
- **To-be.** `resolveProjectForFolder(path) → {projectId|null, how, confidence}`: exact real path → longest attached
  ancestor → `git rev-parse --git-common-dir` (worktrees) → normalized `remote_key` (`host/owner/name`) → Observatory's
  `implemented_by` map as a suggestion. `project_repos` gains `remote_key`, `kind` (`primary|checkout|worktree`) and
  uniqueness on `(estate_id, real path)`. Admission by consent (R-05) journals `project.repo.attached@1` with
  `admitted_by: consent`. Too-broad folders are still refused (`admitRepoPaths`).
- **Seams.** `startChoices.ts`, `projectDiscovery.ts:181,377`, a migration, ADR-0100 §7 amendment.

### C3 — Pack format `session-handoff/1` (shared with Dashboards)

- **As-is.** Fabric: per-session dir 0700, `mcp.json` with a one-shot bearer, `context.md` compiled and cited
  (`contextPack.ts`), the preamble naming one tool (`shared/preamble.ts:19-26`), per-adapter argv
  (`sessionBundle.ts:223-331`). Dashboards: persistent per agent key, a stdio `mcp.json` with no secret, its own brief
  wording, no `--strict-mcp-config`.
- **To-be.** One schema in `fabric-agent-contract` (`schemas/session-handoff.schema.json`): the files (`context.md`,
  `mcp.json`, optional `brief.md`/`task.md`), their modes, where they live (userData, never the repository), lifetime
  (per session or per agent key — both allowed, declared), the preamble rule (one named first tool, no rules), the
  first live call (`fabric_whoami` / `service_context`), the per-runtime argv table (Claude: the joined `--mcp-config=<path>`, which
  closes the variadic list — Switchboard #141, Dashboards #68), limits (brief ≤ 1000 chars inline, 16 × 1024 for Switchboard in-place). Fabric
  writes it; Dashboards conforms; a Fabric agent opened in Dashboards' console and a Dashboards agent opened from
  Fabric carry the same pack.

### C4 — Work-log protocol: every coding agent knows how to log and track

- **As-is.** A launched session gets the preamble and the protocol rules from `fabric_whoami`
  (`protocolObligations.ts`); a terminal agent gets nothing; no skill teaches using Fabric from outside; four parallel
  claims on one piece of work (agent-sync lease, backlog row, Fabric lease, Observatory checkpoint).
- **To-be.**
  - A **`working-with-fabric`** skill in `fabric-agent-adapter`: find Fabric (`hub.json`, pid), ask the lifecycle
    broker to start it when down, call `fabric_whoami` first, claim → stage reports → notes → handoff, create tasks
    with `source: {repository, path, id}` of the backlog row, what a refusal means.
  - A **session hook pack** (COM-04, owner fabric-agent-adapter) for Claude Code: SessionStart enrolls (C1) and
    returns the preamble as context; Stop journals `session.turn.observed@1` (HEAD, files, diff size — no content);
    SessionEnd journals `session.ended@1`. Codex: the MCP entry plus the first prompt (advice, until its hooks are
    verified).
  - **Link, don't copy** (R-07): `fabric_task_create|claim` accept `source`; `fabric_leases_list` also shows
    agent-sync's lease refs read-only.

### C5 — Setup console and the first run (RM-09)

- **As-is.** Three steps: persona → coding agents (detect, `--version`) → four actions; skills checked only inside the
  agent forms; nothing connects or installs (ADR-0129 §4).
- **To-be.** A first run of three steps, each skippable and saying what is lost:
  1. **Fabric and you** — one sentence of what Fabric is (agents created, composed, fixed; the harness every coding
     agent reaches), the language (system default), a name; the look moves to Profile.
  2. **Your coding agents** — per agent one honest line: installed · signed in (or «sign in, then check again»; the
     sign-in is the person's) · skills · connected to Fabric; one primary action: **Set up with <agent>**, which opens
     the **Setup console**: the person's coding agent with a setup brief built from `knowledge/agents-first.md` (R-10):
     machine readiness (Docker, Supabase CLI) → the adapter skills (`npx @passioncode-ai/passioncode@latest update`)
     → Fabric's MCP in each detected agent (`claude mcp add …`, `codex mcp add …`) and the proving call
     `fabric_whoami` → the family products one at a time (download, `SHA256SUMS` + GPG, the platform's own check,
     install, MCP line, proving call — Dashboards, Switchboard, Observatory, Inbox per `products.md`), each step on
     the person's consent in the console. The checklist on screen reads **observed facts** (re-detection, MCP lists,
     installed bundles, proving calls through the hub), never the agent's claims. Removal is symmetric (LC-14).
  3. **Start** — Create an agent · Adapt an agent · Open a project · Create a project, one primary.
- **Seams.** `start/FirstRun.tsx`, `executorDetect.ts`, `executorAuth.ts` (readers per version), `adapterSkills.ts`,
  a new `setupFacts.ts` (observations), the session preset `setup-machine`, ADR-0129 §4 refinement, SCN-126.

### C6 — Agents: registry, build status, admission

- **As-is.** The `create-agent`/`adapt-agent` preset sits on a task row only (`TaskRow.preset`, `shared/types.ts:189`);
  role agents are `agent_bindings` (`…000021_created_agents.sql`); no conformance ingest; «Set up agents» is
  `EstateAgents` (sessions).
- **To-be.** An **Agents** page: every ecosystem agent built or adapted here — building (its session, where to answer),
  built, conformance passed/failed (the contract's `conformance-report` ingested as an event against the task),
  admitted by the operator (ADR-0019 invariant 4: adaptation ≠ admission), installed (its registry entry linked by
  repository). Events `agent.build.started@1`, `agent.build.reported@1`, `agent.admitted@1`, projector
  `apply_agent_builds`. The session view is renamed **Sessions**; the role form is **Add a team role**. The project
  page of an agent being built says «Your agent is being built in the Claude Code window — answer its questions there».

### C7 — Workflows of agents

- **As-is.** Routines (`routines` table, `routineTick.ts`), chains as `task_links` `follows` + handoffs
  (`chainAdvance.ts:127`), one 60 s cycle (`index.ts:2153`); no workflow entity, no versions, no `agent.call` step, no
  editor.
- **To-be.** `workflows` + `workflow_revisions` from `workflow.defined@1` / `workflow.revised@1` (projector
  `apply_workflows`); a step is `agent` (a session of a named agent or runner) or `call` (`agent.call` to a registered
  service, under an internal principal); a run materialises tasks + links so `chainAdvance` runs it under the one gate
  (ADR-0054) with the named runner (ADR-0125 §5); a **schedule** starts a workflow (today's routines become schedules,
  migrated by an event, history kept). MCP tools for the coding agent: `fabric_workflow_list|get|propose|revise|run`;
  the operator approves a proposed revision on the Workflow screen (graph, runs, diff); a failed run offers **Fix
  with agent** (a console with the failure's pack).

### C8 — Manager agent

- **As-is.** CEO chat (`CeoChat`, to retire, P-13); manager rows M153, M157, M158, M166, M175, M183, M184, M194 all
  proposed; agent reads scoped to one project (`scopedStore.ts:197-199`).
- **To-be.** The CEO is a session (ADR-0123) — «Discuss with Fabric» opens it in the person's coding agent with an
  **estate scope**: `fabric_estate_overview`, `fabric_estate_tasks`, `fabric_task_assign` (refusable), board posts,
  `fabric_question_ask`; deterministic hygiene on the tick (M166/M153: stale questions withdrawn, exact duplicates
  merged, escalation); an estate screen **Where work is** — per project: live sessions (launched, enrolled,
  Switchboard), claimed tasks, the review queue, heartbeat age — and a mandatory **Sessions with no project** row.
  The private CEO archive stays readable and exportable.

### C9 — Fabric as a service: Dashboards and Observatory read it

- **As-is.** Fabric publishes no descriptor (`agentRegistry.ts` only reads); its port answers `/mcp` and connect only.
- **To-be.** `services/fabric.default.json` written at start (`lifecycle.manager: none`, origin the hub's stable
  port, a 0600 viewer token); `/.well-known/fabric-service` with tiles (running / review / waiting on you / sessions
  with no project), events from the feed sentences, `surfaces.mcp` = the read-only viewer server
  (`fabric.work.overview`, `fabric.project.tasks`, a new `viewer` scope kind). Dashboards lists Fabric and draws the
  tasks-per-project view (its row, P-07.3). Observatory reads the journal export (COM-10) instead of its retired
  session source.

### C10 — Screens (the review's findings)

Home, project page, settings, new project, planning, board, session window, network warning, the start screens and the
help page are redrawn to their scenarios: one primary action per screen, nothing a new user cannot act on, no machine
id or internal principle on screen, the persona's name everywhere, Russian complete. The legacy project column stack
and `Workspace.tsx` are removed, not hidden; the settings become a page of their own with Agents & access first.

### C11 — Platforms and self-update

The port lands (temporary push trigger removed, signing on), `fabric-mcp` and the Setup console know per-OS paths
(NSIS folder found, not assumed), sign-in readers on Windows/Linux (CO-244); self-update per ADR-0121 with a signed
feed per OS (closes CO-246).

### C12 — Release and the family

Three verification iterations, the release gate, the site's Windows/Linux keys, the knowledge base (`products.md`
Fabric's MCP line and proving call, `agents-first.md` Fabric's row, RM-09), the contract PR (`session-handoff/1`),
the adapter PR (`working-with-fabric`, the hook pack), the walk harness refreshed to the new flows.

<a id="ownership"></a>
## Ownership — one home per fact

| Fact | Home | Others |
|---|---|---|
| Repositories, checkouts and which project they implement (estate identity) | Observatory registry | Fabric: a link (`observatory_id`) and the consented `project_repos` rows |
| A folder admitted for agent work in a project | Fabric `project_repos` | — |
| Work runs: tasks-as-runs, claims, stages, heartbeats, questions, decisions, sessions and turns | Fabric journal | Observatory reads an export; Dashboards shows it through MCP |
| Backlog and roadmap row status | the owning repository's register, published by the workspace | Fabric tasks link by `(repository, path, id)` |
| File leases on guarded registers | agent-sync git refs | Fabric shows them read-only |
| The setup order of the family | `knowledge/agents-first.md` | Fabric's and Dashboards' setup consoles render it |
| The pack format | `fabric-agent-contract` `session-handoff/1` | Fabric, Dashboards, Switchboard conform |
| Service health and hosting | each service; Dashboards hosts | Dashboards stores nothing |

<a id="adrs"></a>
## ADRs this release writes

Ids reserved from the counter 2026-10-11 (keys `release-040-adr-*`); written in wave 0.

1. **[ADR-0133](../../adr/0133-agents-are-created-composed-and-fixed-in-fabric-and-fabric-is-the-harness-every-coding-agent-reaches.md) — the vision: agents are created, composed and fixed in Fabric; Fabric is the harness every coding agent reaches**
   (D-01) — amends `docs/ux/vision.md` §1/§3/§7, CONTEXT.md (Harness, Workflow, Schedule, Ecosystem agent, Setup
   console, Session handoff, Enrollment), R-001 propagation.
2. **[ADR-0134](../../adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md) — any coding agent enrolls into a project through the hub, on consent** (D-03) — beside ADR-0115: the third
   principal, the standing grant, `fabric-mcp`, CO-194's product servers in sessions.
3. **[ADR-0135](../../adr/0135-setup-runs-in-the-persons-coding-agent-and-fabric-shows-what-it-observes.md) — setup runs in the person's coding agent; Fabric observes the result** (D-04) — refines ADR-0129 §4 and ADR-0119
   §2 (the registration is the agent's own consented, reversible act).
4. **[ADR-0136](../../adr/0136-a-folder-joins-a-project-by-a-pick-or-by-consent.md) — a folder joins a project by a pick or by consent** (R-05) — amends ADR-0100 §7; the resolver.
5. **[ADR-0137](../../adr/0137-workflows-are-versioned-graphs-of-agent-steps-and-a-schedule-starts-them.md) — workflows are versioned graphs of agent steps; a schedule starts them** (R-02, R-03).
6. **[ADR-0138](../../adr/0138-the-agent-registry-records-what-was-built-what-conformed-and-what-the-operator-admitted.md) — the agent registry: built, conformance, admitted** (C6).
7. **[ADR-0139](../../adr/0139-fabric-is-a-service-its-descriptor-its-well-known-document-and-a-read-only-viewer.md) — Fabric is a service: descriptor, well-known document, viewer scope** (R-04).
8. **[ADR-0140](../../adr/0140-a-session-is-handed-its-context-in-one-format-session-handoff-1.md) — `session-handoff/1`** (R-01) — with the contract repository and Dashboards.
9. **ADR-0144 — one model of delegation and access across the agents** (REQ-37, CO-258; key `delegation-model-adr`, reserved 2026-10-11, written in wave 2 with the contract DEC).
10. Amendments written 2026-10-11: ADR-0100 (2, §7 by consent), ADR-0115 (37, the enrolled principal), ADR-0119 (5, the config write is the agent's act), ADR-0121 (3, target 0.4.0 with a feed per OS), ADR-0123 (3, P-13 in 0.4.0), ADR-0129 (1, §4). The pipeline reservation moved to ADR-0141; next free ADR-0142.

<a id="req-table"></a>
## REQ table

Frozen: adding is free, removing needs the operator. Each REQ names its check.

| REQ | Requirement | Node | Verified by |
|---|---|---|---|
| REQ-01 | A coding agent opened in a plain terminal reaches Fabric through `fabric-mcp` registered with no secret, survives Fabric restarts, refuses a dead or foreign `pid` | C1 | a real Claude Code client against the built app (R-010): register, restart Fabric, call; planted stale pid watched failing |
| REQ-02 | Its first call enrolls: one consent naming agent, folder, project; Allow → the full session tool set in that project; revocable; journalled | C1, C2 | DB test + real client; revoke → next call refused |
| REQ-03 | Codex, Kilo, Hermes reach the same set through `fabric-mcp`; «connected» is a probe result | C1 | per-runner probe on this Mac; catalogue test |
| REQ-04 | A Fabric-launched session can reach a family product's MCP when granted for the project (CO-194) | C1 | session bundle test + a granted product listed in the session |
| REQ-05 | Folder → project resolution: exact, ancestor, worktree, remote; suggestion from Observatory; consented admission; uniqueness across projects | C2 | resolver unit tests incl. worktree and scp remote; DB uniqueness test |
| REQ-06 | `session-handoff/1` published in the contract; Fabric's bundle conforms; Dashboards' pack conforms; a Fabric agent opens in Dashboards' console with the same pack and the reverse | C3 | contract validator on both outputs; a cross-product walk |
| REQ-07 | `working-with-fabric` skill and the Claude Code hook pack: a terminal session is enrolled, its turns journalled (no content), its end recorded | C4 | a real session in a terminal; journal rows; adapter repo tests |
| REQ-08 | Tasks link to backlog rows by `(repository, path, id)`; agent-sync leases shown read-only | C4 | tool test; a lease visible in `fabric_leases_list` |
| REQ-09 | First run step 1: what Fabric is, language (system default), name; look in Profile | C5 | walk en/ru; settings default test |
| REQ-10 | Step 2: one honest line per agent (installed, signed in, skills, connected), no repeated sentences or paths; one primary «Set up with <agent>» | C5 | walk; sign-in readers per version tests |
| REQ-11 | The Setup console: machine readiness → skills → Fabric MCP per agent + proving call → products one at a time verified (`SHA256SUMS` + GPG + platform check) with consent; checklist from observed facts; symmetric removal | C5 | walk on a clean home; each fact source unit-tested; a planted unverified download refused |
| REQ-12 | Step 3: four actions, one primary; nav entry «+ New» | C5, C10 | walk |
| REQ-13 | Agents page: building / built / conformance / admitted / installed; build status on the project page; Sessions and Team roles renamed | C6 | walk; DB projector tests |
| REQ-14 | Workflows: define, revise (operator-approved), run, schedule; steps agent or call; Fix with agent on a failed run; MCP tools for the coding agent | C7 | DB tests; chainAdvance tests; a real client composing a two-step workflow |
| REQ-15 | Routines migrate to schedules with history; one name per concept in en/ru (CO-099) | C7 | migration test; string lint |
| REQ-16 | CEO as a session with the estate scope; the CEO chat and its host removed; archive readable and exportable (P-13) | C8 | walk; surface test for the estate tools; archive export test |
| REQ-17 | Manager hygiene on the tick (M166/M153) and the «Where work is» screen with «Sessions with no project» | C8 | tick tests; walk |
| REQ-18 | Fabric's descriptor, well-known document and viewer MCP; Dashboards lists Fabric with tasks per project | C9 | Dashboards' health probe against the built app; viewer tool test |
| REQ-19 | Home: persona name, one primary pair (Create an agent · Open a project), no estate-folder card on first view, no false «movement» | C10 | walk; `EstateHome` test |
| REQ-20 | Project page: launch + tasks + team + workflows; legacy stack and `Workspace.tsx` removed; unique anchors; no tool names or MCP URL; goal not a README quote | C10 | walk; anchor uniqueness test |
| REQ-21 | Settings page of its own; Agents & access first; how to connect an agent shown; Quotas its own page; no ids on screen | C10 | walk |
| REQ-22 | New project form restyled with «only an idea» and Back (CO-179) | C10 | walk |
| REQ-23 | Planning, Board, session window, help, network warning reworded and compacted to their scenarios | C10 | walk; brand lint |
| REQ-24 | Russian complete: coded main-process refusals (CO-225), no machine ids on screen | C10 | ru walk; `check-design` ratchet; a planted English refusal watched failing |
| REQ-25 | Windows/Linux: the port lands, signing on, per-OS `fabric-mcp` and setup paths, sign-in readers (CO-244) | C11 | platforms run on four runners; operator's Windows PC smoke |
| REQ-26 | Self-update per OS with signed feeds (P-12, closes CO-246) | C11 | updater tests; an update from 0.4.0-rc to 0.4.0 on each OS runner |
| REQ-27 | Every open board item is closed with evidence or carried with an id and a reason | all | the coverage table at the close against `inventory.json` |
| REQ-28 | Scenarios, flows, screens, product model, design map, CONTEXT, ADRs, knowledge base and README describe 0.4.0 | all | gates: `ci.sh fast`, docs, registers, map, brand lint |
| REQ-29 | Wave mode codified in task-pipeline and the routing; this release runs by it | method | task-pipeline `npm run test:all`, `claude plugin validate --strict`; family update installed |
| REQ-30 | Release 0.4.0 through CI with three verification iterations and the operator's approvals by direct link | C12 | release run; verification ledger |
| REQ-31 | Security on the harness's way in: per-window IPC authorisation (CO-091, BLOCKING), the stack never answers on the LAN after setup (CO-219), the same-uid floor stated (CO-090) | C1, C5 | a planted foreign-window call refused; a LAN probe after the Setup console's engine step |
| REQ-32 | Data integrity before new tables: migration numbering 78/79 settled (CO-199), write rules out of the replay path (CO-201), hub calls bounded in the journal (CO-200), the `…0002` second owner retired (CO-242) | C2 | fresh vs upgraded database replay equality; a looping caller bounded; DB tests |
| REQ-33 | Session concurrency: one launch per session (CO-229), no two agents in one folder after an unknown outcome (CO-236), one `task.created@1` per caller id across processes (CO-233) | C1 | race tests with two launchers and two processes |
| REQ-34 | Register hygiene: stale rows closed with receipts, duplicates merged with both ids kept, CO-215/CO-216's 252 deferred audit findings expanded into ids and assigned to nodes | all | the inventory re-measured; `check-registers`, `check-plan-ids` |
| REQ-35 | Real providers accepted end to end — Claude and Codex through the Setup console (N1, CO-186, AS-13, M199) | C5 | the acceptance receipts the rows name |
| REQ-36 | Spend policy ([fabric-dashboards brief, PR #72](https://github.com/passioncode-ai/fabric-dashboards/pull/72); operator 2026-10-11): a project's monthly limit and auto-approve threshold are **dynamic per project** — at its first paid run Fabric proposes options computed from that project (its agents' `costPresets`, its recent spend from usage reports, the kind of work; e.g. ~1×, 2×, 4× the expected month, or «no project limit»), the expected month preselected and the inputs shown; the estate total across all keys is USD 1,000 a month (Observatory's L0); an agent's declared cost presets offered at launch; admission reads grant state (unknown = deny, ADR-0023); hub share grants carry the contract's shape — `spend` = mode (unlimited | limited) + `limits[]` over any of the windows total, task, project, day, week, month together, **payer: owner** (operator 2026-10-11) — and the guest view shows the remaining amount per window. Contract: DEC-0037 spend policy and grants with amounts ([fabric-agent-contract #28](https://github.com/passioncode-ai/fabric-agent-contract/pull/28), `934ca60`: schemas `spend-policy`, `grant-check`, standing-grant `spend`, manifest `costPresets`, usage `byGrant`, FAC-SEM-047) and DEC-0038 ([#29](https://github.com/passioncode-ai/fabric-agent-contract/pull/29), `1e7a7d6`); amounts such as the estate total live in configuration, not the contract | C1, C6 | DB tests; a launch over the limit refused; the proposal computed from a fixture project's presets and spend; a guest grant capped |
| REQ-37 | **Delegation and access model across the agents — the operator's main task (CO-258, 2026-10-11).** One decision over the roll call's P1–P8 and its six contradictions ([copylot-agent `9f729f4`](https://github.com/ssheleg/copylot-agent/blob/9f729f4/docs/handoffs/2026-10-11-delegation-rollcall.md)): caller identity on the wire, the on-behalf-of chain that only narrows, the scope vocabulary, one grant store and `grant check`, narrowed short tokens, portable operator approval, common refusal codes, session TTL — within the operator's constraints in `knowledge/authority.md` (never another agent's key, owner pays, windows together, USD 1,000 estate total, human gates human). ADR-0144 + a fabric-agent-contract DEC; then a message to each owning session with what it changes; fabric-workspace-91 records each id in authority.md/RM-03 | C1, C9 | the audit of the roll call against the repositories (each claim a `file:line`); the ADR and DEC; the contract's fixtures; in Fabric, `agent.call` carrying the chain and a refused over-broad call in DB tests (wave 4); one acknowledgement per owning session |
| REQ-38 | **Agents coordinate through Fabric before they start** (operator, 2026-10-11 evening): any agent — a coding agent through the harness or a product agent through the hub — asks Fabric «who is working on what here» before it starts, claims its task (an id on its project's board, or a new row), and sees a warning when another agent holds related work; claims and releases are journalled and visible on the project page and in the manager's «Where work is»; related tasks across agents link and hand over through Fabric, never through a second board | C4, C8 | MCP tools `fabric_work_list` / `fabric_work_claim` / `fabric_work_release` with DB tests; two enrolled sessions on one project — the second is warned; the claim shown on the project page |
| REQ-39 | **The first run in the operator's order** (operator, 2026-10-11 evening): name and look → choose the folder where projects live (system picker, remembered, path + Change) → scan it → a checklist of the projects found (pre-checked when a repository, unchecked otherwise) → import the checked ones as projects → the four actions (create a project, open one, create an agent, convert an agent) → set up the family's own agents first: Project Observatory, then the Fabric Dashboards agent, each verified, before any other agent; nothing on the way is a dead end («lost after the persona screen» is the defect this closes) | C5, C10 | the walk on a fresh profile (scripted, screenshots); scan → import of a fixture folder with 3 repositories and 1 plain folder; Observatory and Dashboards verified by their proving calls |
| REQ-40 | **Bug: a coding agent cannot be chosen in the first run** (operator, 2026-10-11 evening) — found, reproduced in a test, fixed, and every agent row selectable or saying why not | C5 | a failing component test before the fix; the walk |
| REQ-41 | **Every family product is an MCP any coding agent sets up by itself on any user's machine** (operator, 2026-10-11 evening): for each product — Observatory, Dashboards, Copylot, Foundry, Publisher, Inbox, research-agent, the rest of the family list — Claude Code (and Codex) following the product's own skill installs it, registers its MCP and makes the proving call with no hand edit; measured on a clean macOS user account; the matrix product × agent × result is published, and every failure becomes a row on its product's board | C5, C12 | the matrix report with a receipt per cell (command, exit code, proving call answer); failures filed with their owners |
| REQ-42 | **The Fabric agent's floating button in every product** (operator, 2026-10-11 evening): Fabric Dashboards and each product's dashboard show Fabric's button (one component from the contract's service kit); it opens a conversation with Fabric scoped to that product and project (the manager session, P-13), and from it «Open in a coding agent» starts or resumes a session in that project; the link back from Fabric opens the product's page | C8, C9 | a contract decision (the button, its deep links `fabric://chat?service=…&project=…` and `fabric://session/new?project=…`); Dashboards shows it; a product opens Fabric's conversation in the right project; the session opens |
| REQ-43 | **The design in Figma** (operator, 2026-10-11 evening): file «Fabric» in the SSHLG team ([`jYWp36tCEe9lxM0INAyXW2`](https://www.figma.com/design/jYWp36tCEe9lxM0INAyXW2), to be moved by the operator into the folder «PassionCode», one file per product), every 0.4.0 screen and state from `docs/ux/screens.md` and the flows, on the app's tokens; it is the target the screens wave builds to and is kept in step with the scenarios | C10 | the file's pages listed against `screens.md` (every screen and state, or a recorded reason); tokens from `tokens.css` |
| REQ-44 | **A clean start on this Mac** (operator, 2026-10-11 evening): after the release is published, the operator's live database is dumped and kept, Fabric's local data is reset to a first run (database, `userData`, registry enrollments, hub files) by a documented, reversible procedure, and the released build is installed — so the operator walks the first run on a clean install | C12 | the dump's path, size and restore rehearsal; the reset procedure in the runbook; the installed version; Fabric opens on its first-run screen |
| REQ-45 | **Runner and model profiles across the estate — a main task (CO-261, ADR-0147; operator via frame-agent-84, 2026-10-11).** Fabric publishes `registry/models.json` and `registry/model-profiles.json` and checks `shared/agents.ts` against `registry/runners.json`; Settings gains the estate defaults (runner per kind of work, model profile per class) and per-agent/per-project overrides written into bindings; a launch whose L1 classes leave no model is refused with the policy named; Switchboard drops its own key and model (T6) | C6, C1 | the contract decision (fabric-agent-contract-75); registry files validated by its schemas; a Settings test writing a binding; a refused launch in a test; Switchboard on an Observatory key |

<a id="operator-additions-evening"></a>
## The operator's additions, 2026-10-11 evening

Two dictated messages the same evening (in the session's transcript): Fabric as the manager agent that knows every
agent, project and plan and optimises routes; every coding agent with the skills on the harness automatically; agents
marking their work and coordinating before they start; the first run as folder → scan → pick → import, then the four
actions, then Observatory and Dashboards first; the agent choice in the first run broken; every product an MCP any agent
sets up itself on any machine, verified; Fabric's floating button in Dashboards and every product; the design in Figma
(SSHLG team, folder PassionCode, a file per product); and the end state — released, installed here, local data reset.
Most of it was already in this plan (REQ-01…REQ-18); what was not is REQ-38…REQ-44. The design track (REQ-43) runs
beside the waves from now, so the screens wave builds to it.

<a id="status-2026-10-11-evening"></a>
## Status and strategy — 2026-10-11, end of day

**Where we are going (unchanged, sharpened).** 0.4.0 makes Fabric the place agents are created, composed and fixed,
the harness every coding agent reaches, and the manager that knows where work is; it ships on macOS, Windows and Linux,
and the operator walks its first run on a clean install. Two estate-wide decisions now frame the agents around it:
the delegation model (ADR-0144, contract DEC-0039…0042) with **proof at the machine boundary** (amendment 4 — on this
machine the operator's instruction is the authority), and **runner and model profiles** (ADR-0147, CO-261).

**Done.** Waves 0 and 1 are on `main` (`812876cf`). Wave 2 so far: agent coordination (REQ-38 claims, REQ-08 backlog
sources, CO-256, the hook pack's D1–D5) verified — `ci.sh fast` green and its DB test 29/29 on a disposable stack — and
main's COM-06/07 merged in (migration renumbered 92 → 95, schema 84, the private archive admitting 83 and 84). Outside
Fabric: contract DEC-0039/0040/0041/0042 merged; the `working-with-fabric` skill and hooks in fabric-agent-adapter PR #53;
Observatory's meter, slot release and keyserver rules; Dashboards' Fabric button and `session-handoff/1` pack; every
agent owner's delegation row filed; the Figma file with 293 frames.

**Open in wave 2.** P4 (REQ-03 runner probes, REQ-04 product MCP under a grant, REQ-33 concurrency) and P2 (the session
bundle on `session-handoff/1`, the dead gateway path removed) as unverified WIP branches; P5 (the closed module named in
the public repository — licensing); adapter PR #53 merged and released once D1–D5 are on main, then the live REQ-07
check; ADR for the organisation extension of ADR-0144 (asked by Vesta) reserved for wave 4.

**The board.** 701 items: 21 in wave 0 and 18 in wave 1 (16 and 17 closed with receipts), 18 · 18 · 34 · 36 · 40 · 8
in waves 2–7, and 508 carried after 0.4.0 with an id and a reason. Carry-over: 197 of 261 rows carry work.

**What went wrong today, and the rule each one becomes.**
- A merge commit carried conflict blocks and every docs gate passed → a conflict-marker gate in `ci.sh`
  (`scripts/check-conflict-markers.mjs`), watched catching the real case at `6587d097`.
- Main's schema step left the private archive admitting only up to 82 → a schema step always extends the archive's
  admitted versions in code and in SQL together (to be a test in wave 3: the admitted list must contain the schema
  contract's maximum).
- Parallel landings on `main` collided on migration numbers and on the pipeline's reserved ADR → land each finished
  packet sooner, rebase before writing a migration, take migration numbers at merge time, never earlier.
- Two hand-resolved files were overwritten by a bulk «take ours» → resolve derived files by name lists only, never by
  «every conflicted file».
- Background agents stopped at API session limits three times → work-in-progress commits pushed at once, a tracked
  handoff ([wave 2](../../handoffs/2026-10-11-release-040-wave2.md)), fewer and larger packets.
- The disk filled and Docker's VM stopped twice (BTRFS write errors) → no stack-backed tests below 5 GB free; every
  disposable stack and agent worktree removed as soon as its branch lands; the live stack checked read-only after a stop.
- A peer relayed «the operator approves everything» → approvals are taken only from the operator or the operator's own
  instructions file, never from another session.

**Strategy from here.**
1. Finish wave 2 (P4, P2, P5), land it on `main`, release the adapter's 0.10.0, run the live enrolled-session check.
2. Wave 3 (the first run in the operator's order, the Setup console, Observatory and Dashboards first, every product's
   MCP set up by an agent and verified) is the first thing the operator sees — it gets the Figma frames as its target.
3. Wave 4 is lighter after amendment 4: the issuer for share grants and cross-machine calls, the registry, workflows,
   the spend policy, runner and model profiles, and the organisation ADR.
4. Waves 5–7 as planned (manager and Fabric as a service with the `fabric://` handler; screens to the Figma frames;
   Windows/Linux and self-update).
5. Wave 8: three verification iterations, the release by tag (approval by checks), install here, dump the operator's
   database, reset Fabric's local data, and the first run walked on a clean install.
Operator questions are batched at the end; today there is one: the Figma folder «PassionCode».

<a id="decision-2026-10-12-0-3-5"></a>
## Decision, 2026-10-12: what is on `main` ships as 0.3.5

The operator, 2026-10-12 («проверь баги и исправь … релиз версии»): the release that carries what is on `main`
is **0.3.5**, not 0.4.0. This amends D-02 ("everything, as 0.4.0") and the status above without rewriting them:

- **0.3.5** ([P-17](../backlog.md#general-development-plan), [ledger](2026-10-12-release-035-verification.md)) ships
  waves 0 and 1 and wave 2's packet P1 as landed — `fabric-mcp` and enrollment (REQ-05, ADR-0134), claims and the
  work screens (REQ-38, REQ-08), the first-run agent choice (REQ-40), CO-254 and CO-242 — with Windows and Linux
  (CO-238, REQ-25 without the updater), the operator's board (COM-06/07) and the `fabric://` handler (wave 5's link
  handling, REQ-42's first half). Windows installers are signed (`AZURE_SIGNING_ENABLED` switched on 2026-10-12,
  passioncode-ai/.github #41).
- **0.4.0** keeps everything else in this plan: the rest of wave 2 (P2 `session-handoff/1`, P4 runner probes and
  product MCP under a grant), waves 3–8, self-update (P-12, REQ-26), the manager session (P-13, REQ-16/REQ-42's
  second half) and the per-OS sign-in readers and runtime tuples (CO-244, CO-251).
- **The clean first run moves to 0.3.5.** The operator's order of 2026-10-11 («новая сборка выпущена, переустановлена на
  этом компьютере, локальные данные Fabric очищены, чтобы протестировать с нуля») is carried out at 0.3.5's release close:
  the database dumped, upgraded 79 → 84, the app installed, then the local data reset for a fresh first run. Strategy
  step 5's wave-8 walk stays, on 0.4.0.


<a id="waves"></a>
## Waves

Cut from the canvas: each wave closes in one pass and leaves the product working. After each wave: verify (full
suite and gates, the live walk of what the wave touched, blind readers), finish and fix, update the documents and the
map, land, re-measure the inventory and re-cut the remaining waves.

The board items each wave closes are listed in the inventory
([`2026-10-11-release-040-inventory.json`](2026-10-11-release-040-inventory.json), fields `node`, `wave`, `release`),
assigned by [`scripts/plan/release-040-waves.py`](../../../scripts/plan/release-040-waves.py) — explicit id lists per
wave, duplicate clusters follow their member, a closable stale row goes to wave 0; re-run it after every wave.

| Wave | REQs | Board items (count, examples) | Why here |
|---|---|---|---|
| 0 · Decisions and registers | REQ-34; ADRs 1–8 written, vision and CONTEXT amended, P-16 = 0.4.0 | 33 — stale rows closed with receipts (CO-001, CO-088, CO-115, CO-163, M0, M16, M105, S11, P-01, AD01 …), lease-blocked UXAC rows | every later wave builds on them; no code |
| 1 · Walking skeleton: the harness | REQ-01, REQ-02, REQ-05 (core), REQ-31, REQ-32 | 21 — CO-091, CO-090, CO-199, CO-200, CO-201, CO-242, AR-3.1/3.2/3.4, the port's W1–W3/W5 merged as the base | the spine every other node hangs on, on integral data |
| 2 · Pack and log protocol | REQ-03, REQ-04, REQ-06, REQ-07, REQ-08, REQ-33, REQ-37 (the decision), REQ-38 | 18 — CO-194, CO-229, CO-233, CO-236, CO-176, CO-244, CO-220, AS-03, AS-06, COM-04, COM-05 | all speak the session surface of wave 1 |
| 3 · Setup console and first run | REQ-09…REQ-12, REQ-35, REQ-24 (start screens), REQ-39, REQ-40, REQ-41 | 16 — CO-177, CO-180, CO-219, CO-235, N1, CO-186, AS-13, M199, SCN-081…085/088 | needs the harness to prove «connected» |
| 4 · Agents, workflows, spend | REQ-13…REQ-15, REQ-36, REQ-37 (Fabric's hub part), REQ-45 | 34 — AR-2, AR-5, AR-7, AR-11, M18, M37, CO-099, CO-188, CO-227, SCN-112…114, SCN-121…123 | need the surface and the journal events |
| 5 · Manager and Fabric as a service | REQ-16…REQ-18, REQ-42 | 36 — P-13 (CO-168, M126, AR-4, SCN-110/111), M153, M166, M194, P-06, P-07, COM-02/03, CO-212 | read everything waves 1–4 journal |
| 6 · Screens | REQ-19…REQ-23, the rest of REQ-24 | 36 — CO-179, CO-225, CO-231, CO-232, CO-239, CO-240, the back/route-history cluster (CO-149, L3c, AX05*), read age and feed cursor clusters, CO-215/CO-216's screen findings | final shapes once the features exist |
| 7 · Platforms and self-update | REQ-25, REQ-26 | 3 — P-12, CO-245, CO-246 (the port's W4 rides wave 2) | the port merges early (wave 1 base), its per-OS paths and the updater close here |
| 8 · Release | REQ-27…REQ-30, REQ-44 | — | three iterations over the whole |

**Wave 0 re-cut, 2026-10-11.** Wave 0 closed or narrowed 21 items with receipts (the inventory's `closedInWave0`,
`narrowedInWave0`); 14 it found still open keep their ids and now ride their node's wave (`keptInWave0`; five were
code fixes the first cut sent to wave 0: CO-203, CO-205, CO-206, CO-207 → wave 1, CO-234 → wave 1); the 10 items
without an id have ids (CO-248…CO-253 or an existing owner). CO-215 and CO-216 are narrowed to their expansion,
[`2026-10-11-release-040-co215-216.json`](2026-10-11-release-040-co215-216.json) — 252 findings under the audit's own
ids (W1 44, W3 11, W4 38, W5 23, W6 124, W7 10, after 0.4.0 1, settled 1), each to be re-read against the tree
before it is fixed. Counts per wave after the re-cut: W0 21, W1 26, W2 18, W3 17, W4 34, W5 36, W6 40, W7 5 (197).

**Wave 1, 2026-10-11 — the walking skeleton is proven.** A real MCP client over stdio runs `fabric-mcp` in a
project's folder against the built app on a disposable stack: one tool and "waiting for the operator" before
consent; the operator's Allow in Agents & access; the tool list changes and `fabric_whoami` names the project; Fabric
restarts and the next call works without asking (ADR-0134 amendment 1). On the way the walk found that the desktop
journal had refused every hub event since 0.3.1 — the ADR-0115 path had never run live (CO-254, fixed, with a gate
that reads every event type main appends). CO-091 (BLOCKING) is closed and its narrowed bridge verified in a live
launch for all three window kinds; CO-199, CO-200 (ADR-0142), CO-201 and CO-242 are closed; the port is merged into
the base. Re-cut: the embedded browser (CO-102, M75, SCN-077, AX15-REQ-004) leaves 0.4.0 — it was in wave 1 only
because CO-091 gated it, and no request of this release needs it; CO-237 and CO-250/CO-251 ride wave 7; AR-3.2
closes in wave 3 with the Setup console. Then CO-203, CO-205, CO-206 (ADR-0115 amendments 38–39), CO-207 and CO-234 closed,
and the 44 audit findings of the wave: 31 fixed, 7 stale with receipts, A7-016 and A7-033 decided from the sources
(ADR-0050 §4; what to keep), A7-023 carried as CO-255, A6-036/038/041 fixed with the hub rows. The schema is 82
(migrations 82, 90 and 91), a schema step the release notes must say (ADR-0121: self-update never crosses one); the
pipeline's reserved migrations moved to 92/93 and its ADR to 0143. Electron's fuses are on with run-as-node kept
(fabric-mcp and the helpers need it); the first packaged build must show the app starts with asar integrity on.

**Wave 1's fix round, 2026-10-11 — the blind reviews' findings closed.** The three readers failed wave 1; the fix
round closed every finding: a revocation ends enrolled sessions, the folder is Fabric's fact, the enroll loop is bounded,
a client error keeps the session (ADR-0134 amendment 2); the enrollment is said in words on every surface, en and ru;
the fused packaged app starts — `fabric-mcp`, the MCP bridge, the ACP shell and the app — and a release refuses a bundle
whose `fabric-mcp` does not answer MCP (runbook step 5 and 7; the binary staying a Node interpreter is CO-259). The
first-run agent choice (REQ-40) is fixed ahead of wave 3; the operator's evening additions (REQ-38…REQ-44) are planned,
their scenarios written (SCN-138…SCN-142, FLW-78…FLW-82, SCR-77…SCR-80) and the Figma track started (REQ-43);
ADR-0144 decided the delegation model and every owning agent filed its row; release approval moved to checks
(fabric#28, ADR-0145), so the pipeline's reserved ADR is now 0146. Carried: CO-256 (enrolled sessions not yet listed),
CO-257 (enrollment files after an uninstall), CO-259.

**The rest of the board — the program after 0.4.0.** 504 of the 701 items do not close in 0.4.0: they are umbrella
milestones, unbuilt scenarios and multi-packet plans (memory and context, MEM-P0…P7; the board's COM-06…14 and
Telegram; estate domains BL-* and the cost ledger CL-*; the UX28/AX/UXAC cards beyond the clusters above; the agent
registry's AR-6/8/9/10; adoption packets AD02…AD24). They stay on the same canvas, by node (C1 91, C6 83, C12 79,
C8 73, C10 71, C5 45, C2 26, C7 25, C11 11), and are cut into the next waves after 0.4.0 lands — from the state
0.4.0 leaves, never from today's guess. No item is dropped: each keeps its id and its register.

The port branch merges into this release's base at wave 1 so every wave builds and tests on all three platforms.

<a id="questions"></a>
## Questions for the operator

Asked once, at the end of planning; until answered the plan proceeds on the recommendation, marked **assumed**.

| # | Question | Assumed | Waves it touches |
|---|---|---|---|
| Q-01 | A terminal agent's consent: standing per (agent, project), or per session? | standing, revocable | 1 |
| Q-02 | Fabric under Dashboards' Background (no dashboard surface of its own) or with a small dashboard page? | Background, viewer MCP only (keeps ADR-0031) | 5 |
| Q-03 | agent-sync's run journal moves into Fabric's journal (a `fabric` record plane in agent-sync)? | proposed to agent-sync's owner, outside this release | 2 |
| Q-04 | The hook pack and `working-with-fabric` ship in fabric-agent-adapter (COM-04's owner)? | yes; 0.4.0 depends on that adapter release | 2 |
| Q-05 | Who pays for a share grant? | **answered 2026-10-11 by the operator (relayed by fabric-dashboards-76, DEC-0038): the owner pays**; limits by any of the windows together | 4 |

Outward acts are never assumed: publishing the release, the signing switch PR, messages to people.

<a id="method"></a>
## Method

This plan is the first run of **wave mode**: W0 intake (one inventory) → W1 audit (the live walk) → W2 questions
closed from the sources, one batch to the operator at the end of planning → W3 the canvas → W4 waves → W5 the wave
loop (build, verify, finish and fix, document, land, re-measure) → W6 close. The doctrine is added to task-pipeline
as `references/waves.md` and the `/task-pipeline waves` mode (branch `feat/wave-mode`, v1.92.0), with the routing
block's planning sentence, after the family round in flight (`feat/family-round-1010`, v1.91.0) lands.

<a id="carried"></a>
## Carried

Every open item not closed in 0.4.0 keeps its id in its own register and its `node`/`wave` in the inventory
(`release: program`). Re-measured at the close of every wave; the coverage table at the release close lists each of
the 701 as closed with evidence, or carried with its id and the reason.

Inventory, 2026-10-11 (701 items; the collector `workspace/lib/backlog.mjs#collectBacklog` at `403faab9`, 628 rows
from 15 sources, plus the port branch and hand-added sources): carry-over 209 (main 206, port 3), backlog 158,
scenarios with no or partial coverage 121, verification rows never shipped 81, AR 41, adoption 36, COM 13, AS 10,
MEM 8, FR 7, port modules and N1/L3c 7, items without an id 10 (NOID-01…10, given ids in wave 0). Areas: agents and
registry 119, screens 103, sessions and runners 65, other 64, onboarding 56, memory 43, board 42, workflows 39,
data 37, docs 36, security 32, harness 31, release 30, i18n 4. 175 items sit in duplicate clusters (one fix closes a
cluster).

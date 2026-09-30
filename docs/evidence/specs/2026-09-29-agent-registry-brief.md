# Brief — agent registry, chains, the in-machine MCP protocol, traces, optimizer, memory

Status: **grill closed** (task-pipeline stage 0 complete; stage 1 next). Date: 2026-09-29. Owner: operator.
This file is the record of the request: nothing the operator said may be lost, so each request is kept as a
neutral English paraphrase beside its reading (verbatim wording redacted for publication on 2026-09-30, ADR-0096).
Additions made during the grill are **additive** — they extend the main line, never replace it
(operator, 2026-09-29).

## 1. The main line

Fabric gets an **agent registry**: everything on this machine that can act as an agent is
found and shown; agents can be given work directly and used as steps of chains/pipelines that
Fabric runs. The whole system — contract, adapter, Fabric, Fabric Dashboards, the launcher,
Project Observatory, the operator's own agents — is reviewed so the result is one coherent,
final design, with scenarios, UI, errors, and the plan to update the agents to the protocol.

## 2. Operator statements (paraphrased)

| Id | Request (paraphrased) | Reading |
|---|---|---|
| OS-01 | Scan for the agents that support the protocol and show which ones are available. | Discovery + a registry view. |
| OS-02 | Let Fabric add chains and attach agents: installed coding agents (such as Claude Code and Codex), agents the operator created, and Fabric's own agents. | Three kinds of agents: installed coding agents; the operator's own (custom/personal) agents; Fabric's agents. Chains; attaching agents. |
| OS-03 | Think the system through — relationships, design, every interface, scenario, UI and error — then review it and design the final corrected solution. | Full design: relationships, UX scenarios, UI, error paths, reviewed and final. |
| OS-04 | The agents themselves will probably need updating so that they understand the protocol. | Migration plan for every agent. |
| OS-05 | Draw up one overall plan over the whole system: code, infrastructure projects and every agent. | One plan across all repositories. |
| OS-06 | The agent registry lives inside Fabric and lists everything available on the machine. (Q1) | The registry lives in Fabric and lists everything available on the machine. |
| OS-07 | Show MCP servers too, but separately, since they are not agents; they are already in Observatory, which should be recommended everywhere and can already connect to Fabric as a plugin. (Q2) | MCP servers are shown, as their own kind, not agents; their inventory comes from Project Observatory, which Fabric recommends everywhere. |
| OS-08 | Agents should work inside and interact with each other over MCP, and agents on the machine should reach these projects over MCP — an internal interaction protocol. | An in-machine interaction protocol over MCP: agents ↔ agents, machine agents → Fabric projects. |
| OS-09 | Custom agents the operator builds should be managed, with their dashboards visible, and be usable inside pipelines launched from Fabric. | Custom agents: managed, their dashboards visible, usable as pipeline steps run by Fabric. |
| OS-10 | Dashboards is simply the place where every dashboard hangs — agents' results or monitoring; Agents is where a task is given directly from Fabric or an agent is used in a chain. (Q3) | Fabric Dashboards stays the separate place where every dashboard hangs (monitoring). Agents in Fabric are doers: direct tasks and chain steps. |
| OS-11 | Extend MCP and a Fabric convention for the future now, and mark real A2A as a separate track to work out later. (Q4) | MCP + a Fabric convention now, designed to extend; real A2A is a separate later track. |
| OS-12 | Write the narrative and naming everywhere: PassionCode is the organization, agent-agnostic, for AI-native teams; Fabric is the desktop CEO agent that plans, manages agents, runs projects and works with data, extended by Fabric-prefixed tools (Fabric Inbox, Fabric Dashboards) and made compatible through the contract and adapter; every repository keeps the same narrative, and Fabric Workspace is the main, always-true knowledge base, brought current at the end. | Narrative and naming rule across all repos; Fabric Workspace is the knowledge base and is updated to the truth at the end of this run. ("SEO" in the original request is read as **CEO**, per ADR-0057.) |
| OS-13 | Log these agents in the protocol so that complex chains of agents calling agents read as one workflow — how it started, where it went, how it branched, what succeeded and failed — visualised and debuggable. | Cross-agent trace: one workflow graph across nested agent calls, with branches and outcomes; visualise and debug. |
| OS-14 | An optimizer agent that sees the patterns in use and helps optimise the path to save tokens — where scripts can be used, custom tools created, data converted or computed more precisely, or a chain automated without agents — plus a custom-tools section per project and global. | Optimizer agent over traces; a Custom tools section, per project and global. |
| OS-15 | Fabric is the CEO agent: open a chat and give it any task, even creating a new project, and it carries the task out with full access; the user talks to the CEO and observes only to monitor, and general tasks use the shared workspace. (Q5) | CEO-first: the operator talks to Fabric; Fabric chooses project (or creates one), agents and tools; the UI is for observing; a manual path remains. |
| OS-16 | Memory is not covered yet: where it lives and how it works; a separate repository is possible, but keeping it inside Fabric seems better since it is Fabric's own memory; add a review. | A memory review: where it lives, how it is built; operator leans to keeping it inside Fabric. |
| OS-17 | Anything added on top is added before the existing scope, not instead of it, and no word or meaning may be lost. | Additive scope; this ledger is the guard. |
| OS-18 | Creating a new agent should go through Fabric using every protocol — from a base such as Claude Code, or by converting a project into an agent — so that it is wired correctly to everything, and Fabric must be able to start that process from inside. | Agent creation runs inside Fabric: from a base (e.g. a Claude Code runner) or by converting a project, producing a protocol-correct agent that is wired to everything (manifest, service or provider entry, capabilities, admission, binding). Builds on ADR-0015/0019, M125 and the adapter's two skills. |
| OS-19 | With a screen open, the floating CEO can be asked to change it, because it has the open screen in context — much better than an editing interface; only basic micro-controls (rename, small edit icons, drag to reorder) are direct, and which ones to offer needs thought. (Q6) | Editing goes through the floating CEO, which knows the open screen and its context; direct manipulation is limited to cheap micro-controls (rename, small edit affordances, drag to reorder), chosen at spec time. |
| OS-20 | Workspace is not only about Fabric but about every tool — the big wiki of how things work (MCP, communication, protocols, using agents), while what the products are is on the site; every detail must be recorded there, and this must be strictly enforced. (Q7) | Fabric Workspace = the big wiki for every tool: how things work (MCP, communication, protocols, using agents). The public site covers what the products are. Publishing is enforced, not remembered. |
| OS-21 | Define how contribution works so that agents in any repository always come and read the rules first — where things are, how to name them, how the system works — through a dedicated skill or a hard rule. | A contribution entry that every agent in every PassionCode.ai repository reads first (rules, naming, how the system works), enforced by a skill/rule rather than memory. Builds on org-index `RULES.md` and the launcher's `working-in-passioncode` skill (passioncode 0.1.5). |
| OS-22 | Code carries blocks marking where a feature, module or special condition starts, with references to the documentation, so an agent can quickly find and check the truth. | Code region markers: feature/module/special-condition blocks in code carry a reference to their documentation anchor; a gate checks that every marker resolves. |
| OS-23 | Strongly recommend installing sshlg-skills so work follows the pipeline with one documentation format (agent-sync, task-pipeline), adaptable to a team's style on the same base. | Contributors are strongly advised to install the sshlg-skills family so process and documentation share one base format; teams may adapt it. |

## 3. Decisions so far (grill)

| Q | Decision | Source |
|---|---|---|
| Q1 | The registry is inside Fabric and lists **every agent available on the machine**; discovery shows, admission + project binding are what let an agent work (ADR-0012/0019 unchanged). | OS-06 |
| Q2 | Four sources of agents: (1) installed coding agents via a runner catalogue shipped with Fabric; (2) local services via `services/` descriptors; (3) the operator's agents that are not services via a new `providers/` directory written by their installers; (4) Fabric's own (built-in CEO and PM seat, agents created in Fabric). **MCP servers are a separate kind, not agents**, inventoried by Project Observatory. | OS-07 |
| Q3 | Fabric Dashboards stays the separate monitoring app for every dashboard; Fabric's registry shows an agent's state and capabilities and opens its dashboard in Fabric Dashboards. | OS-10 |
| Q4 | The interaction wire is **MCP plus a Fabric convention** (capabilities as tools declared in the manifest; long work as a job with events and a result envelope; "awaiting your choice" as an interaction point). Real A2A is a separate later track. | OS-11 |
| Q5 | **CEO-first**: the operator gives Fabric any task in chat; Fabric picks or creates the project, the agents and the tools; the UI is for observation; direct manual assignment stays possible. | OS-15 |
| Q6 | Chains are composed by the CEO and shown as a graph before they run; they are versioned pipelines (ADR-0009) at two levels, project and global. Changes are asked of the **floating CEO, which knows the open screen**; direct manipulation is limited to micro-controls (rename, edit affordance, drag to reorder) selected at spec time by one rule: cheap to build and obvious without explanation. | OS-19 |
| Q7 | Documents stay beside their code (edited in the same change); **Fabric Workspace becomes the one place to read, for every tool**: it aggregates all family repositories, opens with the narrative and naming rule, publishes automatically on each merge to `main`, and a check in each repository fails when the workspace lags it. Contribution rules are read first by every agent in every repository (OS-21); code carries doc-linked region markers (OS-22); the sshlg-skills family is the recommended base (OS-23). | OS-20…23 |
| Q8 | Naming: a **new ADR supersedes ADR-0018** (PassionCode.ai = the organization; Fabric = the product and CEO agent; Fabric X = its tools). The app bundle id `ai.passioncode.desktop` **stays** (ADR-0070); the leftover `/Applications/PassionCode.app` is removed. **Project Observatory keeps its name** without the Fabric prefix, described as "Fabric-compatible, Fabric's observe layer, works without it". | operator, 2026-09-29: all three recommendations accepted |
| Q9 | Design surface: **Fabric's own system only** — `docs/ux/product-model.json` → `scripts/product/` → `docs/reports/product.html` on the PassionCode tokens, with `sheleg-design` for the visual layer. **No Figma for now**: much is already built there, and a second copy is not wanted. (Figma was chosen, then withdrawn the same minute; no file was created.) | operator, 2026-09-29: proceed without Figma for now |
| Q10 | This run: the **whole design** (stages 1–4: docs study, architecture and module map, specs with scenarios/screens/errors, plan per module) **plus module 0, the truth layer** (naming ADR, narrative in every repository, Fabric Workspace as the wiki of all tools with automatic publication and a lag check, contribution rules read first, code region markers with a gate). Every other module is built later, one run each, walking skeleton first. | operator, 2026-09-29: option (a) chosen |

## 4. Source ledger (stage-0 harvest, 2026-09-29)

| Source | Found |
|---|---|
| Fabric CONTEXT.md, ADRs, code | Provider/Agent/Binding model (ADR-0012/0013/0019/0021/0043), `AGENTS` constant of 3 runners (`shared/agents.ts`), `which`-only CLI detection (`main/pty.ts#binaryExists`), created agents (`agent.registered@1` → `agent_bindings`), chains (`task_links`, `task_handoffs`, `chain.dispatch@1`, `shared/chain.ts`), routines, runs, N1 provider execution (`shared/providerExecution.ts`, `main/codexLoopback.ts`). Next free ADR id 0086 (0085 reserved). |
| Fabric UX | SCR-04 Agents, **SCR-05 Agent catalog and setup (designed, not built)**, SCR-39 Estate agents (built); scenarios SCN-003/004/009 validated, SCN-023/049 and others draft. |
| Fabric backlog | M32 capability registry, M34 transports + provider probe, M93 catalogue of ready agents, M69, M92 — proposed; 70/197 milestones shipped. |
| Fabric retro | R-001…R-008 bind this run (R-001: a model change propagates to glossary, vision, architecture, schemas, UX in the same run). |
| Fabric vision | Anti-vision forbids a multi-chat cockpit, a task tracker with agents as assignees, a generic integration dashboard; alignment test of five questions. |
| fabric-agent-contract | Manifest with mcp / a2a / local-runner profiles; admission and binding schemas; work graph (run/node); DEC-0001…0015; FAC-SEM-000…012. No provider directory, no runner catalogue, no capability catalogue, no chain schema, no project-assignment schema. |
| fabric-agent-adapter 0.4.3 | Three skills; `adapt_project.py` writes `fabric-agent.json` + lock + schemas + probes into a project. |
| fabric-dashboards 0.1.0 | Descriptor discovery, state precedence, launchd control, embedded dashboards; 25 draft scenarios; `fabricManifest` typed but unread. |
| Machine inventory | CLIs: claude 2.1.284 (`claude mcp serve`), codex 0.157.1 (`codex exec`, app-server), cursor-agent, gemini (ACP), opencode (ACP), goose (ACP), kilo (ACP). Services: 4 descriptors (project-observatory and three personal agents); 2 running services without a descriptor (:8791, :8788). Only project-observatory ships `fabric-agent.json`. Launcher 0.1.7 installed. |
| Wiki | `projects/fabric` — V1 "return to context": Dashboard → Project → Agent × five lanes. |
| Figma | No Fabric file is registered. |
| Memory, naming | Harvest agents running (results go to §7 and §8). |

## 5. Gaps found (they become design inputs)

G-01 no provider directory for agents that are not services · G-02 coding-agent CLIs have no
descriptor or detection beyond `which` · G-03 `runnerKind` is a free string · G-04 no capability
catalogue, so chain compatibility cannot be checked · G-05 no chain/pipeline payload schema in
the contract · G-06 no schema for assigning an agent to a project · G-07 `fabricManifest` ↔
`extensions[service].descriptor` never cross-checked · G-08 service extension key differs
between Dashboards docs and the contract · G-09 well-known lists no capabilities and no A2A;
the A2A profile requires https, so a loopback peer cannot be declared · G-10 no admission
store · G-11 contract pins drift across repos · G-12 CONTEXT profile names (`peer-agent`,
`capability-provider`) differ from the schema (`a2a`, `mcp`) · G-13 ADR-0034 routes MCP through
a machine gateway that was decommissioned 2026-09-14 · G-14 no trace context across agent
calls · G-15 task assignment is always `operator` today.

## 6. Carry-over ledger

| Id | Item | Status |
|---|---|---|
| CO-AR-01 | Real A2A (loopback peers, Agent Cards) — separate track | open (OS-11) |
| CO-AR-02 | The flagship product's plugin passes its bearer token on the command line; the key was printed by a `pgrep -fl` during the harvest and must be treated as exposed and rotated | open — operator |
| CO-AR-03 | Fabric.app and PassionCode.app share bundle id `ai.passioncode.desktop` | open |
| CO-AR-04 | Services running without a descriptor (:8791 preview, :8788 bridge) | open |
| CO-AR-05 | ADR-0034 (machine gateway) is stale since 2026-09-14 | open — superseded by this design |
| CO-AR-07 | `ci.sh fast` fails one environment check: Claude Code on this machine updated to 2.1.285 while `shared/providerCapabilityMatrix.ts` pins 2.1.284; re-run the provider probes and re-pin (N1 owners). Not caused by this run; identical on `main` | resolved 2026-09-29 — re-pinned to 2.1.285 (version-only, rows stay `unverified`), branch `agent/repin-claude-2.1.285` |
| CO-AR-08 | Timing-sensitive app tests fail under this machine's load and pass alone: `apps/desktop/test/native-view-host.test.mjs` (load 101, `connected` vs `outcome_unknown`, 3/3 alone) and `ceo-conversation-host.test.mjs:88` (load 96, `setTimeout(30)` waves, 3/3 alone) | open |
| CO-AR-06 | The naming check and the Workspace aggregation cover repositories outside Fabric, so they land in those repositories under their own rules | resolved — `org-index` `scripts/check_names.py` (PRs #2–#7); host `passioncode-ai/fabric-workspace#1`; exporter in this branch |
| CO-AR-09 | Publish on merge and the scheduled lag check (AR-0.5): the publisher commits a pin to Fabric `main` and runs the full gate, so running it from CI or a hook means an unattended writer on `main` beside concurrent sessions, and parent CI cannot read the private tool repositories. Until the operator decides who may write that pin and where it runs, publication stays a manual `node scripts/workspace.mjs publish` and lag a manual `lag` | resolved 2026-09-30 — the operator asked the Workspace to stay current; ADR-0093 and `workspace.mjs sync` + `scripts/install-workspace-sync.sh` (launchd, every two hours, publishes only when something is behind) |

## 7. Memory review (OS-16) — measured 2026-09-29

**Where the "brains" are.** One append-only journal in Fabric's local Supabase Postgres
(ADR-0014; Docker volume `supabase_db_fabric`, port 54322). Memory tables are projections of it:
`memory_facts` (2,646 rows), `session_transcripts` (357), `memory_retrievals` (1,749),
`session_context_packs` (0), 157,753 journal events. Full-text search only (English
configuration); no embeddings, no vector extension. Three MCP tools expose it:
`fabric_memory_search`, `fabric_transcripts_search`, `fabric_memory_remember`
(`apps/desktop/src/main/agentSurface.ts`). App files live in
`~/Library/Application Support/@fabric/desktop` (the dev package name, not "Fabric").

| Concept | State |
|---|---|
| Journal, facts with author and validity window, transcripts, retrieval log, insight categories, retro reader, memory overview, search, MCP tools | built |
| Context packs | built (M49) but **never produced** on this machine: 0 packs, 0 `context.compiled@1` |
| Memory Kernel, estate knowledge (`memory.estate.*`), `memory.promote`, learning contrast (DEC-0012), CEO retro tick, `fabric_feedback` | designed only |
| **The CEO ("Fabric") reading memory** | **absent** — no reference in the CEO conversation code |
| Embeddings / vector store | absent (ADR-0032 excludes them until measured) |

Contradictions: DEC-0014 pilots an `mcp-memory-service` backend while ADR-0032/0069 forbid a second
store (compatible only as a rebuildable copy); DEC-0004 names a missing `docs/specification/memory.md`;
transcript search is English-only and capped at 400,000 characters while the operator works in
Russian; 408 `agents/trap` facts accumulate with no export path.

Separate repository or inside Fabric: the **canonical memory stays inside Fabric** — ADR-0014 and
ADR-0032 make it a projection of the journal, and a store kept elsewhere "is not a projection".
What already lives outside is the **interface** (`fabric-agent-contract` memory-and-learning spec and
schema); a storage backend may be a replaceable adapter (DEC-0014). Fabric Workspace is
publication, not memory (ADR-0048; it excludes databases and transcripts). Project Observatory's
recorded narrative, the Obsidian wiki and claude-mem are not connected to Fabric.

## 8. Narrative and naming (OS-12) — audit of 11 repositories at `origin/main`, 2026-09-29

Every repository agrees that **Fabric is the CEO agent**. Three parts of the intended story are
told nowhere yet: PassionCode.ai as the **organization**, the Fabric-prefixed tools as **Fabric's
own extensions**, and Fabric Workspace as the **main source of truth**.

| Where | Says | Intended |
|---|---|---|
| fabric `CONTEXT.md:12`, ADR-0070:7, site `docs/brand/terminology.md:36`, org GitHub profile | PassionCode.ai = "umbrella toolkit" | PassionCode.ai = the organization |
| fabric ADR-0018:14, ADR-0057:22, `docs/vision.md:1` | PassionCode.ai is "the user-facing product and platform", "powered by Fabric" | Fabric is the product |
| site `index.html:42`; READMEs of fabric-dashboards, contract, adapter, passioncode | "PassionCode.ai — the agent-agnostic operating system for AI-native teams" | the OS/kernel claim belongs to Fabric |
| fabric `package.json:5` | "Fabric — the kernel behind PassionCode.ai" | Fabric, the CEO agent |
| fabric `README.md:46`, `CONTEXT.md:21`; switchboard `docs/SPEC.md:5`; site `index.html:61`, `fabric/index.html` | Inbox and Switchboard are "standalone"/"independent of Fabric"; the prefix means "project ownership" | Fabric-prefixed tools extend Fabric (and may also work alone) |
| switchboard `docs/BRIEF.md:2` | "a new Fabric organization project" | the organization is PassionCode.ai |
| workspace `README.md:28,35-36`, `AGENTS.md:7-10`, fabric `docs/architecture/report-workspace.md` | the workspace is a generated snapshot; canonical docs live beside the code | Fabric Workspace is the main knowledge base |
| contract `CONTEXT.md:8`, `docs/DECISIONS.md:52` | Fabric = a host; CEO = a role a provider fills | Fabric is the CEO agent |
| adapter `README.md:20,49`; fabric-dashboards `README.md:44-45` | the adapter repository is private | it is public since 2026-09-29 |
| adapter `README.md:12` vs `AGENTS.md:5` | repo → provider vs "Project → providers" | any agent becomes Fabric-compatible |
| switchboard `README.md:1` vs `tauri.conf.json:3` | "Switchboard" vs "Fabric Switchboard" | one name |
| `/Applications/PassionCode.app` (0.1.0) and `Fabric.app` (0.2.0), same `ai.passioncode.desktop` | a leftover pre-rename install | one app, Fabric |
| workspace `README.md:6` vs fabric `README.md:8` | a Heroku URL vs `wiki.passioncode.ai` | one address |
| fabric-vr GitHub description vs org-index | "virtual desktop with an AI voice agent" vs "never renders a desktop; no assistant" | one story |

Proposed rule (to be ratified): **PassionCode.ai** = the organization (domain, GitHub org, npm scope,
bundle-id root, design system, launcher; "by PassionCode.ai", never an app name). **Fabric** = the CEO
agent, the desktop app and its engine ("Fabric kernel" only in technical documents). **Fabric X** =
a tool that extends Fabric (Fabric Inbox, Fabric Dashboards, Fabric Switchboard, Fabric VR); its
README's first paragraph says what it adds to Fabric and that it also works alone. **Fabric Agent
Contract / Fabric Agent Adapter** = the compatibility layer ("makes any agent Fabric-compatible");
protocol ids stay lowercase (`fabric-service/0.1`). **Fabric Workspace** = the knowledge base.
Products of the organization that do not extend Fabric keep their own name + "by PassionCode.ai".

**Reconciled with ADR-0086** (accepted by the operator the same day in another run): the
positioning "PassionCode.ai — A toolkit for AI-native teams." and the line "The agent-agnostic
operating system for AI-native teams." stay with PassionCode.ai. The audit's proposal to move the
operating-system line to Fabric is therefore **dropped**. The naming ADR of this run (next free id
ADR-0090) complements ADR-0086: PassionCode.ai is the organization, whose toolkit is for AI-native
teams; Fabric is the product and the CEO agent; Fabric X names Fabric's tools. The naming check
extends Fabric's existing `scripts/check-narrative.sh` rather than adding a second gate.

Open for the operator: supersede ADR-0018's "PassionCode.ai is the product"; the app bundle id
(ADR-0070 froze it); Fabric Workspace as the editable source vs a published copy; whether Project
Observatory takes the Fabric prefix.

## 9. REQ table (frozen: adding is free, removing needs the operator)

| REQ | Requirement | From | Verified by |
|---|---|---|---|
| REQ-01 | The registry in Fabric lists every agent available on this machine, from four sources: runner catalogue (installed coding agents), `services/` descriptors, a new `providers/` directory, Fabric's own agents | OS-01, OS-06, Q1, Q2 | spec + scenario; later a test per source against fixtures and this machine's inventory |
| REQ-02 | The three kinds are distinct and named: coding agents, the operator's own agents, Fabric agents | OS-02 | glossary entry + screen spec |
| REQ-03 | MCP servers are shown as their own kind (not agents), inventoried by Project Observatory; Fabric recommends installing Observatory | OS-07 | spec + scenario incl. "Observatory not installed" |
| REQ-04 | One in-machine interaction protocol over MCP: agent ↔ agent, and machine agents → Fabric projects (northbound, ADR-0026) | OS-08 | contract extension spec + conformance rules |
| REQ-05 | Agents declare capabilities as MCP tools in their manifest; long work is a job with events and a result envelope (DONE/PROOF/SCOPE/NOT VERIFIED); "awaiting your choice" is an interaction point | Q4 | contract schema + fixtures + probe |
| REQ-06 | The operator gives Fabric (the CEO) any task in chat; Fabric picks or creates the project, the agents and the tools; a manual path remains | OS-15, Q5 | scenarios + CEO tool list |
| REQ-07 | An agent enters a project through admission (probes) and binding, offered on first use | Q1, Q5 | scenario incl. probe failure |
| REQ-08 | Chains are composed by the CEO, shown as a graph before they run, checked for input/output compatibility, include a checker, and are saved as versioned pipelines at project and global level | Q6 | contract chain schema + scenario + compatibility rule |
| REQ-09 | The floating CEO knows the open screen and its context and edits through chat; direct micro-controls are chosen by one rule (cheap, obvious) | OS-19 | screen spec lists each micro-control with its reason |
| REQ-10 | The registry shows an agent's state and capabilities and opens its dashboard in Fabric Dashboards | OS-10, Q3 | scenario incl. "Dashboards not installed" |
| REQ-11 | Every agent call carries one trace; Fabric assembles one workflow graph across nested calls with branches and outcomes, to visualise and debug | OS-13 | contract trace-context rule + scenario |
| REQ-12 | An optimizer agent reads traces and proposes scripts or tools to save tokens; proposals never apply themselves | OS-14 | spec + DEC-0012 compliance |
| REQ-13 | A Custom tools section, per project and global | OS-14 | glossary + screen spec |
| REQ-14 | Creating an agent runs inside Fabric — from a runner base or by converting a project — and yields a protocol-correct, fully wired agent | OS-18 | flow + scenario + adapter mapping |
| REQ-15 | A migration plan updates every existing agent (the operator's own agents, Project Observatory) to the protocol | OS-04 | plan rows per agent, each with its own check |
| REQ-16 | Memory: review recorded (§7) and a target design (the CEO reads memory; stays inside Fabric; interface in the contract) | OS-16 | design section + ADR if a decision changes |
| REQ-17 | A new ADR supersedes ADR-0018; the narrative and naming rule hold in every repository; `PassionCode.app` removed | OS-12, Q8 | naming check (script) over all repositories, 0 findings |
| REQ-18 | Fabric Workspace is the wiki of every tool, published automatically on merge, with a lag check in each repository | OS-20, Q7 | the lag check watched red, then green |
| REQ-19 | A contribution entry that every agent in every PassionCode.ai repository reads first | OS-21 | the entry resolves from each repository's AGENTS.md; skill/rule installed |
| REQ-20 | Code region markers reference documentation; a gate fails on a marker that does not resolve | OS-22 | gate watched red on a planted broken marker |
| REQ-21 | Contribution docs recommend the sshlg-skills family as the shared base | OS-23 | text in the contribution entry |
| REQ-22 | Every screen and flow names its error, empty and loading states | OS-03 | scenario checklist per feature |
| REQ-23 | One plan across all repositories, per module, with the order and the checks | OS-05 | plan file; REQ set == union of `Implements:` |
| REQ-24 | ADR-0034 (machine gateway) is superseded by the interaction design | G-13 | new ADR |

Carry-over added: CO-AR-06 — the naming check and the Workspace aggregation cover repositories
outside Fabric, so they land in those repositories under their own rules.

## 10. AR-0 — what was done (2026-09-29)

| Task | Where | Receipt |
|---|---|---|
| AR-0.1 | ADR-0090 | `docs/adr/0090-names-passioncode-is-the-organization-fabric-is-the-ceo-and-its-tools-carry-its-name.md`, commit `a33a3b9` |
| AR-0.2 | `CONTEXT.md`, brand terms, `scripts/check-narrative.sh` (`NAMING_RETIRED`) | the gate refused a planted "PassionCode.ai is the product" line, commit `a33a3b9` |
| AR-0.3 | README / AGENTS of every repository | `org-index` `python3 scripts/check_names.py` over `origin/main`; Observatory `#82` merged `c16b51c` |
| AR-0.4 | `/Applications/PassionCode.app` moved to the Trash | `mdfind kMDItemCFBundleIdentifier == 'ai.passioncode.desktop'` lists `/Applications/Fabric.app` and a local build output `apps/desktop/dist/mac-arm64/Fabric.app`; no PassionCode.app |
| AR-0.5 | host `fabric-workspace#1`; `scripts/workspace-snapshot.mjs`, `scripts/workspace-sources.mjs`, `workspace.config.json#sources`, `node scripts/workspace.mjs lag` | `node --test scripts/test/workspace-sources.test.mjs` 9/9 with two planted defects caught (receipt digest skipped; rewritten history read as ancestor); a real export of 13 repositories (1707 files) loaded by the host and read in a browser at 1440 and 390 px; `lag` red (exit 1, 13 `unpublished`) before the first publication. After publication (`f9891f5`, workspace `eeae351`, 1707 files): `lag` exit 0, 13 `current`; `check --require-child` → `sources: recomputed`, `child: verified`. Publish on merge → CO-AR-09 |
| AR-0.6 | `passioncode-ai/.github` `CONTRIBUTING.md` | PR #3 merged |
| AR-0.7 | `passioncode` 0.1.8 `hooks/repo-rules.js` | `test/repo-rules.test.js`; published by npm trusted publishing |
| AR-0.8 | `scripts/check-regions.mjs` in `ci.sh` | `scripts/test/check-regions.test.mjs` 3/3, a broken reference refused |

The live export found what the fixtures had not: four hidden tool files inside tool
repositories' `docs/` (`.gitkeep`, `.docpaths-allow`) that the host refuses. The exporter now
skips hidden segments for sources and refuses any path the host cannot serve
(`scripts/workspace-snapshot.mjs#hostServable`), so such a path fails the export rather than the
deployment.

`ci.sh fast` runs under `set -e`, so the CO-AR-07 pin failure stops it at "provider capability"
and every later step goes unread. Run one step at a time, those steps found one real failure:
`test/audit_regressions/fix-pf-06.03.py`. ADR-0090 had been written past the prose reservation
0089 of the [pipeline persistence contract](../plans/task-pipeline-persistence-contract.md).
The reservation moved to 0091 through agent-sync
(`pipeline-reservation-after-names-20260929`) under that document's collision rule, and the
check went green. Until CO-AR-07 is re-pinned, a fast gate that is red for CO-AR-07 alone is
not a verdict on the later steps. Those steps have to be run and read separately.

## 11. Wave 2 — the other repositories (2026-09-30)

Run by parallel agents, one per repository, so no two wrote the same file. Each landed its own
PRs under its repository's rules; the org-index run index
[`docs/runs/2026-09-29-agent-registry`](https://github.com/passioncode-ai/org-index/tree/main/docs/runs/2026-09-29-agent-registry)
lists them, and org-index `ONBOARDING.md` §6 carries the verified install and MCP commands.

| Plan row | Where | Receipt |
|---|---|---|
| AR-1.1–1.5 | fabric-agent-contract PRs #8–#13, `2ea54f7` | `pnpm run check` 162 tests; DEC-0016, DEC-0017 (rulings on OQ-0001…0007), DEC-0018 (every `outputSchema` has an object root) |
| AR-1.6 | fabric-agent-adapter v0.5.2 (`b7a6b8e`) | kits answer `initialize`; a real `claude` client lists the sample's 4 tools; 125 + 15 tests |
| AR-2.2 (Dashboards half) | fabric-dashboards `packages/service-host` (`@passioncode-ai/fabric-service-host`, not on npm) | shared state-precedence vectors run in the app; Fabric consumes it by commit (AR-2.2 Fabric half open) |
| AR-2.5 | Fabric Dashboards 0.3.0 | `fabric-dashboards://service/<id>.<instance>`; e2e 3/3 |
| AR-2.6 (Observatory half) | Project Observatory 0.9.1 | `machine.mcp.inventory` read 6 configs on the operator's Mac with no value or home path in the output; Fabric's SCR-66 is open |
| AR-11.1 (Observatory) | Project Observatory 0.9.1 | `fabric-interop/0.1`; probe 0 FAIL, 5 interop rules NOT_RUN over stdio and covered by its own `test_interop.py` |

Released for a second contributor the same day: Fabric Switchboard 0.4.0-beta.1 (notarized; the
CLI serves `switchboard mcp`), Fabric Inbox 0.7.1 (first signed, notarized DMG), the launcher
0.1.11 (adapter v0.5.2).

**The finding that matters most:** every test of the MCP surfaces passed while no real client
could use them. The adapter kit never answered `initialize` (0.5.0 and 0.5.1), and Observatory
0.9.0's union `outputSchema` without an object root was rejected by Claude Code 2.1.285 while the
Python SDK accepted it. Both were found only by running the newcomer path with the real `claude`
CLI. R-010 in the [retro](../retro.md) makes that the rule.

Open: Fabric consumes `@passioncode-ai/fabric-service-host` and pins the contract when AR-2
starts; the Switchboard plugin needs to degrade without the CLI before the launcher carries it
(operator's choice); Observatory's MCP over HTTP (C3.6) so the probe's five interop rules run.


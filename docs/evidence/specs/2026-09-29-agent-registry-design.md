# Design — Fabric's agent registry, the in-machine MCP protocol, chains, traces, tools, memory, and the truth layer

Status: **approved** by the operator on 2026-09-29 (an instruction to proceed); task-pipeline stage 2 closed.
Date: 2026-09-29. Brief: [2026-09-29-agent-registry-brief.md](2026-09-29-agent-registry-brief.md)
(REQ-01…REQ-24, decisions Q1–Q10). This is a dated record; the living documents it changes are
named in §13 and change in the module that lands them.

**Vision alignment.** Everything here serves the Project: agents are found so that a Project
can use them, never to supervise more sessions (anti-vision 1); the operator talks to the CEO
and watches, rather than assigning tasks to agents like a tracker (anti-vision 3); every call
leaves a trace and a receipt that closes the observe-to-verify loop (alignment test 3 and 4);
agents stay replaceable because chains bind capabilities, not agents (principle 2).

## 1. The picture

```
                  operator
                     │ chat (floating CEO, knows the open screen)
                     ▼
   ┌──────────────── Fabric (CEO agent, desktop app, kernel) ────────────────┐
   │  Registry  ──  Projects ── Pipelines (chains) ── Runs + Trace graph     │
   │     │             │             │                     │                  │
   │     │         Memory (journal)  │                Optimizer agent         │
   │     │                           │                     │                  │
   │  Fabric MCP hub (northbound, ADR-0026) ◄── every call goes through it    │
   │     │           │                 │                  │                   │
   └─────┼───────────┼─────────────────┼──────────────────┼───────────────────┘
         │           │                 │                  │
   coding agents   your agents     Fabric tools       MCP servers
   (claude, codex, (services and   (custom tools,     (inventory from
    gemini… via     providers,      project/global)    Project Observatory)
    runner          over MCP)
    catalogue)
         │
   Fabric Dashboards — separate app: every dashboard, for watching
```

## 2. Names (the rule every artifact below uses)

| Term | Meaning | Not |
|---|---|---|
| **Agent** | something that takes an outcome and owns its loop (contract `CONTEXT.md`) | an MCP server |
| **Coding agent** | an installed agent CLI Fabric can drive: Claude Code, Codex, Gemini CLI, goose, OpenCode, Cursor agent, Kiro, … | a service |
| **Your agent** (the operator's own agent) | an agent someone built for their own work that speaks the Fabric protocol — as a local service (`services/`) or as a provider entry (`providers/`) | a PassionCode.ai product |
| **Fabric agent** | an agent that belongs to Fabric: the CEO ("Fabric"), the product-manager seat, the optimizer, and agents created in Fabric from a prompt | an external provider |
| **MCP server** | a tool server agents connect to; inventoried by Project Observatory | an agent |
| **Fabric tool** (custom tool) | a script-backed tool Fabric owns and serves over MCP, scoped to a project or global | an MCP server someone else runs |
| **Capability** | a named, versioned thing an agent can do (`store.listing.publish`), with input and output schemas | a tool name chosen ad hoc |
| **Pipeline** (chain) | a versioned sequence/graph of stages, each binding a capability (ADR-0009) | a script |
| **Trace** | one workflow graph of every call made for one run, across nested agents | a log file |

## 3. Registry (REQ-01, REQ-02, REQ-10)

**Sources.** Discovery reads; it never grants access (ADR-0012) and never runs agent code, except
the version command of a catalogued runner binary.

| # | Source | What it finds | How |
|---|---|---|---|
| 1 | **Runner catalogue** (data shipped with Fabric: `registry/runners.json`, versioned) | coding agents | per runner: binary names, version command and pattern, drive mode (`claude-headless`, `codex-app-server`, `codex-exec`, `acp`), config home, where it declares MCP servers and in which format, skills directory. Detected = binary on PATH + version answered within 5 s |
| 2 | **`services/`** descriptors (`fabric-service/0.1`, DEC-0015) | your agents that run as services | read descriptors, then `/.well-known/fabric-service`; the manifest via `fabricManifest` |
| 3 | **`providers/`** entries (new, beside `services/`) | your agents that are not services (CLI or stdio MCP) | `providers/<id>.json`: `{protocol: "fabric-provider/0.1", id, manifest: <path to fabric-agent.json>, run: {mcp: {stdio: [...]} or {url}}, installedBy, source.repository}` — written by the agent's installer (the adapter) |
| 4 | **Fabric** | Fabric agents | the CEO, the PM seat, created agents (`agent_bindings`), the optimizer |

**Model.** A registry entry is a projection, rebuilt from the journal (ADR-0014): `registry.observed@1`
records what a scan saw (source, kind, id, version, manifest hash, health); nothing is written
for an unchanged scan. Entry states: `discovered` → `declared` (manifest read and valid) →
`admitted` (ADR-0019, per revision) → bound in N projects. Health is separate from state:
`ready | degraded | stopped | down | foreign | unreadable` (the fabric-dashboards precedence,
shared rather than copied — §12 AR-2).

**Screen.** SCR-05 "Agent catalog" becomes the registry: three groups (coding agents, your
agents, Fabric agents), each card showing kind, version, health, capabilities, projects it is
bound in, and one primary action by state (`Use in a project` · `Fix manifest` · `Install
Fabric Dashboards to see its dashboard`). "Open dashboard" opens the agent's service in Fabric
Dashboards through a URL scheme `fabric-dashboards://service/<id>.<instance>`; without Fabric
Dashboards installed, the card says so and links to it.

## 4. MCP servers (REQ-03)

A separate tab, **MCP servers**, not part of the agent list. Its data comes from Project
Observatory's machine inventory (read-only capability `machine.mcp.inventory`, served over
Observatory's MCP): server name, where it is declared (which agents' configs), transport, whether
it answers. Without Observatory the tab shows only the servers Fabric itself is configured with
(`projects.mcp_servers`) and one line: "Install Project Observatory to see every MCP server on
this Mac." Fabric recommends Observatory wherever it runs; it is never required.

## 5. The in-machine protocol — `fabric-interop/0.1` (REQ-04, REQ-05, REQ-11, REQ-24)

A new extension of the Fabric Agent Contract (like `fabric-service/0.1`), on **MCP 2026-07-28**.
No new wire (DEC-0002).

**Hub.** Fabric is the hub. Every call between agents goes **through Fabric's MCP** (the
northbound surface of ADR-0026), which is where grants, audit and the trace are enforced; an
agent never needs another agent's token. Coding agents reach Fabric the same way: Fabric writes
its MCP entry (with a scoped credential in a header, never the URL) into each runner's config
from the runner catalogue. This **supersedes ADR-0034** (the machine gateway is gone since
2026-09-14).

**Capabilities.** An agent declares each capability in its manifest (`capabilities[]`, contract
schema) and serves it as an MCP tool of the same name, with `inputSchema`/`outputSchema`;
tool annotations follow the declared `effect` (`none` → `readOnlyHint`; `delete` →
`destructiveHint`; `idempotency: required` → `idempotentHint`).

**Jobs (long work).**
- When both sides support the official `io.modelcontextprotocol/tasks` extension, a call becomes
  an MCP Task (`working | input_required | completed | failed | cancelled`).
- Otherwise — today's clients — the tool returns a **job handle** in `structuredContent`
  (`{job: {id, status}}`), and the agent serves `fabric.job.get` and `fabric.job.cancel` with the
  same states. Either way the result is the Fabric result envelope (DONE / PROOF / SCOPE /
  NOT VERIFIED, DEC-0011) plus `usage` (input/output/cache tokens, cost, wall time).
- Progress is `notifications/progress` while the call is open, and the agent's events feed
  (`fabric-service`) for everything after.

**Awaiting your choice.** An agent that needs a decision returns `input_required` with an
elicitation form (a titled single-select enum for "pick a title variant"). Fabric turns it into
an **interaction point** (ADR-0017): the CEO may answer when the point is delegable; otherwise it
reaches the operator. Secrets are never elicited in form mode (MCP rule); they go through the
URL mode to the operator's credential flow.

**Trace.** Every request carries W3C `traceparent`/`tracestate` in `_meta` (SEP-414, normative
in 2026-07-28). An agent MUST propagate it to every call it makes and MUST put `trace_id` and
`span_id` on the events it publishes. Span names follow OpenTelemetry GenAI conventions
(`invoke_agent {name}`, `execute_tool {name}`), pinned to one semconv version because they are
still "Development".

**Auth on loopback.** The spec leaves localhost auth open ("MAY negotiate custom
authentication"): the token file of `fabric-service/0.1` for services; for Fabric's hub, a
credential minted per caller and per project scope (the existing `agentSurface.ts#mint`,
widened from one session to one MCP access binding). A2A over loopback is **CO-AR-01**.

## 6. Tasking through the CEO (REQ-06, REQ-07)

The operator tells Fabric anything in chat. Fabric (the CEO loop of ADR-0039) decides: which
project (or a new one, or the general workspace project for one-off tasks), which pipeline or
agent, which tools. The CEO gets the tools ADR-0039 already names (`create_task`,
`query_memory`, …) plus `agent_call` and `pipeline_run`. When the chosen agent is not bound to
the project, the CEO proposes admission (probes) and binding in one step; the operator confirms
once. The manual path stays: the same actions are on the screens.

## 7. Pipelines (REQ-08, REQ-09)

ADR-0009 finally gets its tables: `pipelines` (versioned records), `pipeline_stages` (capability,
preferred binding, checker flag, interaction points), scope `project` or `estate` (global,
reused by projects). A stage **binds a capability, and shows the agent chosen for it** — the
provider is resolved at run start (agent-composition §2), so replacing an agent never breaks a
pipeline. Before a pipeline is saved or run: every edge passes the **compatibility check** (the
producer's `outputSchema` provides every required property of the consumer's `inputSchema`
with a compatible type), every effectful stage has a checker upstream, and the graph is acyclic.

The CEO composes and edits pipelines. The operator sees the graph (the same renderer as the trace
graph, before the run) and asks the **floating CEO**, which receives the open screen as context:
`CeoContext@2` adds `view`, `route` and `selection` to today's `CeoContext@1`. Direct
micro-controls — the rule is "cheap to build and obvious without explanation": rename a pipeline
or stage, reorder stages by drag within a lane, toggle a stage off, pin/unpin a preferred agent.
Everything else is a sentence to the CEO.

## 8. Traces (REQ-11)

Every run is one trace. Fabric journals a span for each call it routes (`trace.span@1`: trace,
span, parent, kind `invoke_agent | execute_tool | interaction`, caller, callee, capability,
outcome, usage, timing) and folds in the spans agents report on their events feeds. A **Run graph**
screen draws the tree/graph: where it started, how it branched, what failed and where it waited
for a person, with the evidence of each step; any node opens the call's input, output and error.

## 9. Fabric tools (custom tools) and the optimizer (REQ-12, REQ-13)

**Fabric tools** are scripts Fabric owns and serves through its hub as MCP tools: a versioned
registry object `{name, scope: project|estate, entrypoint, inputSchema, outputSchema, effect,
tests}`, run inside the execution context of the caller's binding (DEC-0013). A tool without a
passing test fixture cannot be enabled. Section **Tools** in a project and in the estate.

**The optimizer** is a Fabric agent run by a routine over traces. It finds repeated deterministic
sub-paths (the same tool sequence with the same shape of data), token-heavy stages whose
outputs are predictable, and conversions an LLM performs that a script would do exactly. It
proposes: a Fabric tool (with the script and its test), a pipeline change, or a stage replaced by
a tool — each as a proposal with the traces that motivate it and the expected saving. A proposal
never applies itself (DEC-0012); accepting it creates the tool or the new pipeline version.

## 10. Creating an agent inside Fabric (REQ-14, REQ-15)

"Make me an agent that…" or "turn this project into an agent" starts an **agent production
project** (ADR-0015) that the CEO runs through a pipeline built from the adapter's two skills:
intake → choose a base (a runner from the catalogue, e.g. Claude Code, or the existing project) →
capabilities and schemas → `fabric-agent.json` → evals from recorded failures → install (a
`providers/` entry, or a service through the kit) → admission probes → canary binding. The result
appears in the registry as "your agent". The same path migrates existing agents (§12 AR-11).

## 11. Memory (REQ-16)

Memory stays inside Fabric, as projections of the journal (ADR-0014/0032); the interface stays in
the contract. Target in this design: the CEO reads memory (`query_memory`, today absent);
full-text search gets a Russian configuration and no 400,000-character cap; context packs are
actually produced for delegated sessions; trace spans and optimizer proposals are memory facts
with their evidence; the 408 accumulated `agents/trap` facts get their export path (M183).
Project Observatory's recorded narrative is read through its MCP when present — never copied into
a second store.

## 12. Modules (stages 3→10 run per module; ids AR-0…AR-11 so they never collide with backlog M-ids)

| Module | Delivers | REQ | Repositories |
|---|---|---|---|
| **AR-0 Truth layer** (this run) | ADR-0090 names (complements ADR-0086, supersedes ADR-0018's product claim); narrative in every repository; Fabric Workspace = the wiki of every tool, published on merge, lag-checked; the contribution entry every agent reads first; code region markers + gate; `PassionCode.app` removed | 17–21, 23 | fabric, fabric-workspace, org-index, the public `.github` profile repo, every family repository |
| **AR-1 Contract** | `fabric-interop/0.1` (capabilities over MCP, jobs, elicitation → interaction point, trace context, usage); `fabric-provider/0.1` entry; runner catalogue schema; pipeline schema + compatibility rule; fixes G-07, G-08, G-11, G-12 | 4, 5, 8, 11 | fabric-agent-contract, fabric-agent-adapter |
| **AR-2 Registry — walking skeleton** | the four sources, registry projection, SCR-05 built with the three kinds, MCP servers tab via Observatory, "Open in Fabric Dashboards" (URL scheme in Fabric Dashboards); shared service-host code extracted from Fabric Dashboards | 1, 2, 3, 10 | fabric, fabric-dashboards, project-observatory |
| **AR-3 Hub and tasking** | the hub on ADR-0026, MCP entry written into runner configs, CEO tools `agent_call` / `create_task`, jobs, interaction points from elicitation, admission + binding on first use; ADR superseding ADR-0034 | 4, 5, 6, 7, 24 | fabric |
| **AR-4 Floating CEO context** | `CeoContext@2` (view, route, selection); the micro-controls | 9 | fabric |
| **AR-5 Pipelines** | tables, CEO composition, graph view, compatibility check, checker, project/global | 8 | fabric |
| **AR-6 Traces** | spans, trace assembly, Run graph screen | 11 | fabric (+ kits emit trace ids) |
| **AR-7 Agent production** | the in-Fabric creation/conversion pipeline | 14 | fabric, fabric-agent-adapter |
| **AR-8 Fabric tools** | tool registry, tool host, Tools sections | 13 | fabric |
| **AR-9 Optimizer** | the optimizer agent and its proposals | 12 | fabric |
| **AR-10 Memory** | CEO reads memory, Russian search, context packs, exports | 16 | fabric |
| **AR-11 Agent migrations** | each existing agent gains a manifest, capabilities, jobs and trace propagation — one row per agent, in its own repository (the operator's agents stay private) | 15 | each agent's repository |

UX (REQ-22): every module's stage 3 writes its stories, flows, scenarios (with error, empty and
loading states) and screens in `docs/ux/`, and its views in `docs/ux/product-model.json`
(Q9: no Figma).

Order: AR-0 → AR-1 → AR-2 → AR-3 (the walking skeleton ends here: a registry that sees all four
sources and the CEO giving one agent one job with a trace line) → AR-4 → AR-5 → AR-6 → AR-10 → AR-7 →
AR-8 → AR-9 → AR-11 (migrations start as soon as AR-1 lands, one agent at a time).

## 13. Living documents that change

Fabric: `CONTEXT.md` (Coding agent, Your agent, Fabric agent, MCP server, Fabric tool, Trace,
Registry), `docs/architecture/agent-composition.md`, `mcp-control-surface.md`,
`project-memory.md`, ADRs 0090+ (names; hub supersedes 0034; `CeoContext@2`), `docs/ux/*`,
`docs/evidence/backlog.md` (M32/M34/M93 absorbed), the design map. Contract: `service.md`
sibling `interop.md`, `CONTEXT.md` profile names. Every family README and AGENTS.md (AR-0).

## 14. Risks

- **MCP Tasks has no client support yet** → the job-handle convention is the default, Tasks an
  upgrade when both sides negotiate it.
- **The hub is a single point of failure** → an agent keeps its own dashboard and CLI; Fabric
  down means no new routed calls, never lost work (jobs live in the agent).
- **Scanning executes `--version`** of CLIs → only catalogued binaries, 5 s timeout, no shell.
- **Schema compatibility is structural, not semantic** → the checker stage stays mandatory
  before effects.
- **Private agents inside a product** → the operator's agents are discovered on the operator's
  machine only; no Fabric artifact names them (org rule, 2026-09-29).

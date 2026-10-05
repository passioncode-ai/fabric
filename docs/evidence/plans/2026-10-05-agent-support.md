# Agent support: the popular agents as Fabric runners and clients (P-10)

**Owner:** Fabric · **Created:** 2026-10-05 · **Decision:** [ADR-0119](../../adr/0119-acp-is-the-generic-runner-drive-and-runners-are-catalogue-rows.md)
· **Research:** [RPT fabric/2026-10-05-openrouter-agent-support](../../reports/2026-10-05-openrouter-agent-support/README.md)
· **Roadmap:** RM-05 (choice of the primary agent, more harnesses) · **Lane:** 6 · Agents

**Operator request, 2026-10-05:** support the agents of OpenRouter's app ranking, roughly the top
30; describe the support in the project and on the site, each agent on a page; make it real,
including running the harness on another agent than Claude Code, for example Hermes.

## Tasks

| ID | Task | Depends on | Status |
|---|---|---|---|
| AS-01 | Research: the top-30 ranking, what each agent exposes (ACP, MCP client, headless, auth, config home), Fabric and Switchboard today, the support matrix | — | **done** 2026-10-05 (the report; ACP `initialize` probes of Kilo 7.4.17 and Cline 3.0.46 in `raw/probes/`) |
| AS-02 | ADR-0119: ACP is the generic drive, runners are catalogue rows, "connected" is a probe result | AS-01 | **done** 2026-10-05 |
| AS-03 | Runner catalogue schema and `registry/runners.json` with the Tier-0/1 rows (Claude Code, Codex, Hermes, Kilo, Cline, omp, pi, OpenClaw, OpenHands, Cursor), each with its sources; a schema test; `agents.ts` reads it, keeping today's three runners byte-identical in behaviour | AS-02 | open |
| AS-04 | The `acp` driver in main against a fixture ACP agent: `initialize` → `session/new` (HTTP surface when `mcpCapabilities.http`, else the stdio bridge) → brief as first prompt → `session/update` into the journal → `session/cancel` on stop → `session/load` on resume. Planted defects watched being caught: no MCP server in `session/new`; the credential in argv; a permission auto-approved under `ask`; no `cancel` on stop | AS-03 | open |
| AS-05 | The stdio bridge: `fabric mcp-bridge`, MCP over stdio relayed to the session's surface, credential from its environment only (Cline 3.0.46 declares no HTTP MCP) | AS-04 | open |
| AS-06 | Probes and the three states (installed / responding / connected) per row; the probe transcript of each pinned build committed as a fixture; the first-run executor list and Settings read them | AS-04 | open |
| AS-07 | Hermes Agent: install a pinned build, probe it, connect it; a Project Agent bound to Hermes runs a task end to end | AS-04, AS-06 | open |
| AS-08 | Kilo and Cline (installed on this machine), then omp, pi, OpenClaw, OpenHands, Cursor: one row and one probe each | AS-05, AS-06 | partial — **Kilo Code connected 2026-10-05** in Fabric's terminal sessions through a session config in `KILO_CONFIG_CONTENT` (adapter `config-content-env`; modes ask, which sets Kilo's permissions since its default allows every tool, and bypass, declared `none`); proven end to end on Kilo 7.4.17 with the bundle compiler's own output (`raw/probes/kilo-7.4.17-bundle-end-to-end.txt`); its sign-in is reported unsupported until a status reader is measured. Cline next (ACP without HTTP MCP: needs AS-05's bridge) |
| AS-09 | Routines on runners without quota: a Project budget policy (turns or spend) the runner enforces; otherwise manual, said in the interface | AS-07 | open |
| AS-10 | `/ux` scenarios: choosing the Project's coding agent, a runner's states, a failed probe; the "Claude Code or Codex" wording in scenarios and CONTEXT widened | AS-03 | open |
| AS-11 | The public support page (passioncode.ai): every top-30 agent with its category and the state its probe proves, the client-only agents with their hub entry; updated from the catalogue, never ahead of it | AS-06 | open |
| AS-12 | Switchboard: a provider trait, then isolated accounts for Hermes (`HERMES_HOME`), Cline (`CLINE_DATA_DIR`), Kilo (`KILO_CONFIG_DIR`), omp, pi, OpenClaw; an `openai-chat` managed route; OpenRouter-key accounts from Project Observatory's vault | AS-03 | open (fabric-switchboard) |
| AS-13 | Codex: wire the built app-server backend (ADR-0081) into session launch | — | open (lane 5, N1) |

## Order

AS-03 → AS-04 → AS-05/AS-06 → AS-07 (Hermes, the first non-Claude connected runner) → AS-08 → AS-11.
AS-10 runs beside AS-03; AS-12 is Switchboard's own track; AS-09 before any unattended routine on a
new runner.

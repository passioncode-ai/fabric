# ADR-0119 — ACP is the generic runner drive, and runners are catalogue rows

**Status:** accepted · 2026-10-05 · operator request 2026-10-05 (support the popular agents of
OpenRouter's ranking, «топ-30 условно», and run the harness on another agent than Claude Code,
«например, на Hermes») · research
[RPT fabric/2026-10-05-openrouter-agent-support](../reports/2026-10-05-openrouter-agent-support/README.md)
· plan [2026-10-05-agent-support](../evidence/plans/2026-10-05-agent-support.md) (P-10)

## Context

Fabric connects one coding agent. `AGENTS` in `apps/desktop/src/shared/agents.ts` holds three
rows: Claude Code (connected through `--mcp-config --strict-mcp-config`), Codex (launched in a PTY,
not connected) and a shell. Every other agent is absent. OpenRouter's app ranking of 2026-10-05 has
15 agents or agent harnesses in its top 30; Hermes Agent alone uses 18.9% of the top-200 daily
tokens, more than Claude Code (10.7%) and Codex (4.96%) together
([report §2](../reports/2026-10-05-openrouter-agent-support/README.md#2-the-ranking)).

Writing one bespoke adapter per agent does not scale and is the trap `agents.ts` already names:
a declared agent that borrows another's flags starts with no tools and no complaint. The research
found one open protocol most of them speak. In the Agent Client Protocol (ACP, Apache-2.0),
`session/new` carries the session's MCP servers, HTTP headers included
([ACP session setup](https://agentclientprotocol.com/protocol/session-setup)): the same
per-session, nothing-on-disk injection Fabric already does for Claude Code. Eight of the top-30
agents speak it natively or through a listed adapter (43.8% of top-200 daily tokens).

Measured here on 2026-10-05 (`raw/probes/` of the report, `acp-initialize-probe.mjs`):

- `kilo acp` (Kilo 7.4.17) answers `initialize` with `mcpCapabilities {http: true, sse: true}`
  and `loadSession: true`.
- `cline --acp` (Cline 3.0.46) answers with **no** `mcpCapabilities`: only stdio MCP servers, the
  protocol's baseline. An HTTP surface cannot be handed to it as such.

## Decision

### 1. ACP is the generic drive mode for a runner

A runner that speaks ACP is driven by one driver in Fabric's main process: spawn the agent's ACP
command in the Project's worktree, `initialize`, `session/new` with Fabric's surface, the brief as
the first `session/prompt`, `session/update` into the session journal, `session/cancel` on stop,
`session/load` on resume when the agent declares `loadSession`. The driver is code with its own
tests against a fixture agent; an agent is never driven by guessing its flags.

### 2. Fabric's surface reaches the agent per session, never through its own config

- When `initialize` declares `mcpCapabilities.http`, `session/new.mcpServers` carries
  `{type: "http", name: "fabric", url, headers: [{name: "Authorization", value: "Bearer <one-shot>"}]}`
  with the same one-shot scope credential `sessionBundle.ts` mints for Claude Code.
- When it does not (Cline 3.0.46), `session/new` carries a **stdio** server: Fabric's own bridge
  process, which relays MCP to the surface and holds the credential in its environment, never in
  its arguments.
- The agent's own globally configured MCP servers are skipped where the agent offers a switch
  (Hermes: `HERMES_ACP_SKIP_CONFIGURED_MCP=1`), the equivalent of `--strict-mcp-config`.
- Fabric never writes into an agent's user configuration to connect a run. Writing a hub entry
  into a user config (agent-registry spec AR-3) stays a separate, consented, reversible act for
  agents that cannot be driven at all.

### 3. Runners are catalogue rows; drivers stay code

`agents.ts:10-16` kept the list in code "until the first time an agent must exist without a
release". That trigger is met: the agent landscape moves weekly. Runner descriptions move to a
versioned catalogue (`registry/runners.json`, shipped with the app) that names, per runner: the
binaries, how its version is read, the drive modes in preference order with their arguments and
environment, how MCP is injected, its auth model and config home, its quota source and its
licence. The catalogue says *what* a runner is; a driver (`pty`, `acp`, later `print-jsonl`,
`claude-stream`, `codex-app-server`) says *how* it is driven. A row naming a driver Fabric does not
have is refused, as `surfaceAdapter: 'unimplemented'` is today.

### 4. "Connected" is a probe result, not a flag

A runner is shown in three honest states: **installed** (its binary answers its version
command), **responding** (its drive mode answers `initialize` with the capabilities the row
needs), **connected** (a scripted session called a Fabric tool and got the answer back). Only a
probed build is called connected; the probe's transcript is committed as a fixture. A row in the
catalogue claims nothing by being there (`harness-runtime.md`, a provider is admitted on proven
capability).

### 5. Permissions are Fabric's to answer

`session/request_permission` is answered from the runner's permission mode: `plan` refuses
writes, `ask` goes to the person's approval surface and is **never** auto-approved, `bypass` allows
and carries today's `containment: 'none'` consequences. An agent whose ACP bridge cannot route a
permission to Fabric does not get `ask`.

### 6. Quota is per runner, and an unknown quota never runs a routine unattended

`routineTick` blocks a routine when no quota can be read. A runner with `quota.source: none` (every
new one today) runs routines only once the Project sets an explicit budget (turns or spend) the
runner can enforce; until then its routines stay manual and the interface says why.

### 7. Models stay the agent's

Fabric records the model a run reports; it does not route models in v1. A model gateway (one
OpenRouter key per Project, metering) may be injected per row later, never required: a Fabric
that only works through its own gateway would be the proprietary runtime the anti-vision rules out.

## Consequences

- `SurfaceAdapter` gains `'acp-session'`; `ProviderExecutionBinding.provider.id` widens from
  `'claude-code' | 'codex-cli'` to catalogue ids; the `'claude-code'` fallbacks become the
  Project's declared default runner.
- Detection (`executorDetect`), auth readers (`executorAuth`) and the first-run executor list read
  the catalogue. An agent with no non-interactive auth-status command is reported as auth
  `unknown`, never as signed in.
- Account switching for the new runners is Switchboard's (its own track: a provider trait and an
  isolation handle per agent, `HERMES_HOME`, `CLINE_DATA_DIR`, `KILO_CONFIG_DIR`, …).
- Agents that cannot be driven (desktop-only apps, IDEs) are supported only as *clients* of
  Fabric's hub (ADR-0115), documented per agent; they never appear as runners.
- The public support page lists each agent with exactly the state the probes prove.

## Vision check

Serves principle 2, "we keep agents replaceable, not central", and alignment question 2 (change
the Agent or Provider without losing purpose, authority, Routines, Evidence or history)
(`docs/ux/vision.md`). The three anti-vision lines it touches and their guards are in
[report §9](../reports/2026-10-05-openrouter-agent-support/README.md#9-vision-and-anti-vision-check):
a runner is the execution binding of a Project Agent, not a new chat; ACP is open and model routing
optional; an agent's own memory, skills and sessions are not mirrored into Fabric.

## Alternatives rejected

- **One bespoke adapter per agent** — the cost grows with the list, and each guess is a silent
  failure mode (`agents.ts`).
- **Write Fabric into each agent's MCP config** — touches the person's configuration, outlives the
  run, and leaks a long-lived credential into a file the agent shares with everything else.
- **Drive every agent through its print/JSON mode** — loses permissions, cancellation and resume,
  and needs one parser per dialect; kept as a fallback driver for agents without ACP.

## Amendments

### Amendment 1 — 2026-10-05: a terminal session takes its config from the runner's own content variable

§2 covers a runner driven over ACP. A runner the person works with in Fabric's terminal (a PTY session,
as Claude Code is) is told about Fabric before it starts, by its own per-launch mechanism, never by
its user configuration. The adapter `config-content-env` does this for a runner that reads a whole
config document from one environment variable which **outranks the project's own config file**. Kilo
Code is the first: `KILO_CONFIG_CONTENT` carries the `fabric` server with the session's bearer, the
brief as an instruction file in the session directory, and the chosen mode's permissions. Measured on
Kilo 7.4.17 (`raw/probes/kilo-7.4.17-config-precedence.txt`): a project `kilo.json` overrides
`KILO_CONFIG` (a file) but not `KILO_CONFIG_CONTENT`. Through the file, a project could loosen the
session's permissions, or point the `fabric` name at another URL that inherits its Authorization header.
Kilo's own default allows every tool, so its `ask` mode sets the permissions rather than inheriting
them, and a mode whose config allows everything is declared `none` (`check-containment.mjs` rule 3).

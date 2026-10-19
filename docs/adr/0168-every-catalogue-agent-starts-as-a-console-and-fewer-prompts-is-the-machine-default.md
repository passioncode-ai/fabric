# ADR-0168: Every catalogue agent starts as a console, and fewer prompts is the machine default

**Status:** accepted · 2026-10-19 · records the operator's instruction of 2026-10-19 (OF-11: every coding agent Orca
knows, each with its launch command and the argument that skips its permission prompts, one permission choice offered
for all agents, fewer prompts by default, one catalogue across products) · decides CO-305 (a machine default for the
permission mode, which [ADR-0125](0125-an-agent-launch-may-follow-the-operators-fallback-order.md) left per
launch) and closes CO-304 (OpenCode as its own runner) · final pass step F3.

## Context

Fabric could start seven runners (`shared/agents.ts`): Claude Code, Codex, Kilo, Hermes, Cline, Kimi Code and the
shell. Settings already showed Switchboard's catalogue of 30 coding agents, but an agent Fabric had no descriptor for
was display only: `launchOption`, `mayLaunch`, `fabric-mcp --runner` and `isCodingAgent` all refused it. OpenCode had
registered `fabric-mcp --runner opencode` on this Mac and was refused at start (exit 2).

The permission mode was chosen per launch and the project page's console launch had no picker, so every console started
in the runner's own default: Claude Code asked before each tool. The operator works the other way (Orca, measured
2026-10-19: «Agent Permissions: Yolo / Manual», one choice for every agent, Yolo selected).

## Decision

1. **Every coding agent of the catalogue is a runner Fabric can start as a console.** The agents Fabric has no
   descriptor for come from one table, `shared/consoleCatalog.ts`: Switchboard's id, Orca's program and Orca's
   argument (or environment) that skips the agent's prompts. A model choice Switchboard adds to its own command is
   Switchboard's and is not copied. `zed` and `warp` are left out: they open an application, not an agent in a
   terminal. The table is Fabric's copy until the contract publishes the catalogue as a data file (CT-60).
2. **A catalogue console is not an executor.** It gets no Fabric surface (`connectsToSurface: false`, adapter `none`,
   result channel `none`), so it cannot be a created agent or carry a task's result. An agent that should speak to the
   board registers `fabric-mcp --runner <id>` itself; `fabric-mcp` now accepts every runner with a program, OpenCode
   included.
3. **Containment is declared, never assumed** (FA-09). A bypass mode is `none`. A manual mode is `runner-gated` only
   for an agent whose maker documents that it asks by default; an agent whose default is unmeasured (OpenCode, Pi,
   OpenClaw and the others without a switch) is `none` in its only mode. Goose's modes set `GOOSE_MODE`, so a
   permission mode may carry an environment as well as arguments.
4. **One permission choice for the machine.** Settings → «Разрешения агентов» holds `fewer-prompts` (the default, as
   the operator chose) or `manual`. A launch that names no mode takes the agent's bypass mode under `fewer-prompts`
   and its asking mode under `manual`; a launch that names a mode keeps it, and the journal still records the mode the
   runner received (`terminal.opened@1`). Pickers preselect the same mode.
5. **Pickers list what can start.** A runner connected to the surface is always listed (a missing one disabled with
   its reason); a catalogue console only when this machine has its program.

## Consequences

- A console started from the project page with nothing chosen now runs with fewer prompts. Nothing stands between such
  a session and the operator's files; Fabric's floor still refuses a floored effect for a `none` mode, and the
  transcript redactor still matches secret shapes only (the bypass warning says so).
- Settings shows each agent's start line (`GOOSE_MODE=auto goose`, `gemini --yolo`) so the choice is visible.
- When CT-60 lands, `consoleCatalog.ts` is read from the contract's file and this table goes.
- Not decided here: enabling, disabling and the default agent stay Switchboard's (its commands); Fabric reads them.

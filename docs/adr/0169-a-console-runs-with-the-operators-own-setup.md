# ADR-0169: A console runs with the operator's own setup

**Status:** accepted · 2026-10-19 · records the operator's instruction of 2026-10-19 (final pass step F4: the
operator's own MCP servers, Observatory among them, and their own coding-agent setup in the sessions Fabric starts) ·
decides CO-325 and CO-324, and the PATH half of CO-326 · narrows M127's "a session sees Fabric's tools and nothing
else" to the sessions of created agents.

## Context

A console Fabric started was a different program from the one in the operator's terminal:

- **Claude Code** ran with `--strict-mcp-config`, so every user and plugin MCP server was absent, Observatory among
  them, which the operator's rules tell agents to consult first for credentials.
- **Codex** ran in a fresh `CODEX_HOME` inside the session directory: the operator's `AGENTS.md`, plugins, hooks,
  trust, model and sandbox were gone, and `auth.json` was copied, so a token rotation in the session could sign the
  operator's own copy out.
- **The PATH** of an app started from the Dock is bare; Fabric appended the installers' folders, so `/opt/homebrew/bin`
  came before `~/.local/bin` whatever the login shell said.

Measured on 2026-10-19 with Claude Code 2.1.299 (`claude -p … --mcp-config probe.json --debug mcp`, the debug log of
that run): without `--strict-mcp-config` the server `fabric` from `--mcp-config` is the one Claude connects to (the
operator's user-scope `fabric`, which runs `fabric-mcp`, never starts), and every other user and plugin server loads
(Observatory, fabric-dashboards, the plugin servers). The precedence of `--mcp-config` against the user scope is not
documented by Anthropic; this measurement is what the decision rests on.

## Decision

1. **A Claude Code console keeps the operator's MCP servers.** It launches with `--mcp-config` and without
   `--strict-mcp-config`; Fabric's server keeps the name `fabric`, which wins over the operator's own (measured).
2. **A Codex console runs in the operator's own `CODEX_HOME`.** Fabric's server (a random per-session name, as
   before) and the preamble arrive as `-c` overrides (`mcp_servers.<name>.url`, `.bearer_token_env_var`,
   `developer_instructions`; Codex 0.163); the credential stays in the environment, never in argv; no `auth.json` is
   copied. When the operator's Codex config declares a server named `fabric`, it is switched off for that launch only
   (`-c mcp_servers.fabric.enabled=false`), so the session enrolls once.
3. **Isolation stays where a declared set is the whole grant.** A created agent's session, and any session that
   carries gateway role keys, keeps `--strict-mcp-config` (Claude) or the isolated `CODEX_HOME` (Codex): M127's rule
   that a partial or wider grant is the defect still holds there. `FABRIC_STRICT_MCP=1` restores isolation for every
   session.
4. **The launch PATH follows the login shell first.** At start Fabric reads the login shell's `PATH` once
   (`$SHELL -ilc`, between markers, 3 s deadline), puts it first, then what the process inherited, then the installers'
   folders; a shell that does not answer leaves the old order and is recorded (`env.shell-path`).

## Consequences

- A console sees what the operator's terminal sees, credentials included as their own tools hold them; Fabric copies no
  key and writes none into a session directory for this.
- If a later Claude Code changes the precedence of `--mcp-config`, the operator's `fabric-mcp` would start beside
  Fabric's server and enroll the session a second time; the session would still reach Fabric. The test pins the
  arguments, not Claude's behaviour; re-measure on a Claude Code upgrade.
- The Harness panel says a console keeps the operator's servers and a created agent sees only its own.
- Not decided here: Hermes's model key (the rest of CO-326) and which binary each runner resolves to when several are
  installed beyond the login shell's order.

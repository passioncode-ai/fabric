# Surface probes: Codex 0.162.1 and Kimi Code 2.1.1 (2026-10-11)

The return trigger on the Codex row (`apps/desktop/src/shared/agents.ts`: «someone runs
`codex` against a known MCP config and records what it takes») and the ADR-0119 rule
«probe first, then connect» for Kimi Code, executed against one fixture: a minimal
Streamable-HTTP MCP server (`raw/probes/fixture-mcp.mjs`) that requires
`Authorization: Bearer probe-token-123` (401 otherwise), serves one tool `probe_ping`,
and logs every request with whether the bearer arrived and verified.

## Codex 0.162.1 — what it takes

Setup: isolated `CODEX_HOME` (0700) with `auth.json` copied from the operator's
`~/.codex` (needed for the model), then
`codex mcp add probe --url http://127.0.0.1:47331/mcp --bearer-token-env-var FABRIC_PROBE_TOKEN`,
which wrote (`raw/probes/codex-home-config.toml`):

```toml
[mcp_servers.probe]
url = "http://127.0.0.1:47331/mcp"
bearer_token_env_var = "FABRIC_PROBE_TOKEN"
```

Measured:

1. **Transport and bearer — works.** `codex exec` initialized the fixture and listed
   tools; every request carried the bearer from the named env var and verified
   server-side (`raw/probes/codex-0.162.1-mcp-bearer.jsonl`).
2. **Tool call end-to-end — works.** `probe_ping("hello-codex")` → `pong: hello-codex`;
   the fixture log shows `initialize` → `tools/list` → `tools/call`, all authenticated
   (`raw/probes/codex-0.162.1-tool-call-end-to-end.jsonl`). Note: under
   `codex exec`'s default approval policy the MCP call is auto-cancelled
   («MCP tool call requires approval, but approval policy is never» — the known
   upstream gap [openai/codex#24135](https://github.com/openai/codex/issues/24135));
   the call above was proven with `--dangerously-bypass-approvals-and-sandbox`.
   Fabric launches Codex as an interactive TUI, where an MCP call prompts the person —
   the runner-gated ask, same posture as the ACP shell's.
3. **Project config SHADOWS the home config.** With `.codex/config.toml` in the
   working directory pointing `[mcp_servers.probe]` at a dead port (47332), Codex
   contacted only 47332; the home config's server at 47331 saw nothing. A project can
   therefore redirect any PREDICTABLE server name — and a redirected
   `bearer_token_env_var` would hand that server the session's credential. Mitigation
   chosen for the adapter: the session's server name and token env var are random per
   session, so the project has no name to shadow. Residue: Codex 0.162.1 has no
   `--ignore-project-config` (`codex exec --help`, 2026-10-11), so a project can still
   inject ADDITIONAL MCP servers — unchanged from how Codex already runs unconnected;
   the credential itself sits behind the random name, one-shot claim, 120 s window,
   loopback bind and rate limit.
4. **Preamble delivery — via `$CODEX_HOME/AGENTS.md`.** Neither
   `-c instructions=…` nor `-c experimental_instructions_file=…` appeared in
   `codex debug prompt-input`; a marker in `$CODEX_HOME/AGENTS.md` did (grep count 1).
   The adapter writes Fabric's preamble there.

## Kimi Code 2.1.1 — ACP with HTTP MCP, no bridge

Probe: `raw/probes/kimi-acp-probe.mjs` speaks ACP to `kimi acp` over stdio the way
Fabric's `acp-shell` does (initialize → session/new with the fixture as an HTTP MCP
server → one prompt asking for `probe_ping`; permission requests answered
`allow_once` — in Fabric the person answers them). Full transcript:
`raw/probes/kimi-acp-transcript.jsonl`.

Measured:

1. `initialize` answers; `agentCapabilities.mcpCapabilities = {http: true, sse: true}` —
   Kimi takes Fabric's surface over HTTP directly, no stdio bridge
   (`acpShell.surfaceFor` picks `spec.http`). `authMethods`: one terminal login flow;
   not needed here — the machine was signed in and `session/new` opened without
   `authenticate`.
2. `session/new` accepted the MCP server; the fixture log shows `initialize`,
   `tools/list`, `tools/call` — all with the bearer verified — and the agent called
   `probe_ping("hello-kimi")` (transcript: `tool_call` `mcp__probe__probe_ping`,
   fixture log in the transcript's companion run). The turn ended `end_turn`.

## Consequences

- Codex gets a new surface adapter (`codex-config-home`): per-session `CODEX_HOME`
  (0700) with `config.toml` (0600), random server name and token env var, copied
  `auth.json`, and the preamble in `AGENTS.md`.
- Kimi Code connects through the existing `acp-session` adapter; its descriptor gains
  the mode configs the shell reads (`acpMode`).
- Cline stays unconnected (its `session/new` demands sign-in; no probe got past it —
  unchanged), and the plain Terminal has nothing to connect by design.

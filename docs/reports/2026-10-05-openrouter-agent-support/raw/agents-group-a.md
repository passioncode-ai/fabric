# Raw: agent capability facts, group A

Fetched 2026-10-05 from official docs and repositories. Every bullet names the URL it was
read from. Where a docs site is generated from a repository, the repository's markdown on
`main` was read directly (marked "src"). A field not found in official material says
**unverified**. This is raw input for the report, not the report.

Fetched with `WebFetch` (summarized pages) and `curl`/`gh api` (raw markdown, repo metadata).
Repo license values come from `gh api repos/<owner>/<repo> --jq .license.spdx_id`.

---

## 1. Hermes Agent (Nous Research)

- **what**: self-improving personal agent with a learning loop (creates skills from experience); CLI plus a messaging gateway (Telegram, Discord, Slack, WhatsApp, Signal, Email). Category: **personal agent** with a CLI coding surface. https://github.com/NousResearch/hermes-agent , https://hermes-agent.nousresearch.com/
- **install + launch**: `curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash` (Windows: `iex (irm https://hermes-agent.nousresearch.com/install.ps1)`); launch `hermes` (TUI), `hermes gateway` (messaging), `hermes setup` (wizard). https://github.com/NousResearch/hermes-agent
- **auth**:
  - OAuth/subscription: Nous Portal (`hermes setup --portal`), OpenAI Codex (ChatGPT device-code OAuth; browser PKCE via `hermes auth add openai-codex --browser`), GitHub Copilot (device code, or `COPILOT_GITHUB_TOKEN`/`GH_TOKEN`/`gh auth token`), Anthropic OAuth (works only on Claude Max **with purchased extra usage credits**; Pro cannot use it), xAI SuperGrok, Qwen OAuth, MiniMax OAuth, OpenRouter PKCE (`hermes auth add openrouter --type oauth`, mints a key into the credential pool). src: https://github.com/NousResearch/hermes-agent/blob/main/website/docs/integrations/providers.md
  - API keys in `~/.hermes/.env`: `OPENROUTER_API_KEY`, `OPENAI_API_KEY` (+ `OPENAI_BASE_URL`), `ANTHROPIC_API_KEY`, `ANTHROPIC_TOKEN` (setup-token), many more. src: https://github.com/NousResearch/hermes-agent/blob/main/website/docs/reference/environment-variables.md
  - Files: `~/.hermes/config.yaml` (settings), `~/.hermes/.env` (secrets), `~/.hermes/auth.json` (OAuth credentials). Can import Codex CLI credentials from `~/.codex/auth.json`; Anthropic OAuth prefers Claude Code's own credential store. https://hermes-agent.nousresearch.com/docs/user-guide/configuration ; src providers.md (above)
- **MCP client**: yes.
  - Config: `~/.hermes/config.yaml`, YAML key `mcp_servers.<name>` with `command`/`args`/`env` (stdio) or `url`/`headers` (HTTP); `transport: sse` switches HTTP to SSE; `auth: oauth` for OAuth 2.1 (DCR/PKCE); `trust: full|untrusted`; `${VAR}` / `${env:VAR}` interpolation from the profile's `.env`. src: https://github.com/NousResearch/hermes-agent/blob/main/website/docs/reference/mcp-config-reference.md
  - Transports: stdio, Streamable HTTP (default for `url`), SSE (opt-in). Bearer token via `headers.Authorization`. Same file.
  - CLI: `hermes mcp add <name> [--url URL] [--command CMD] [--auth oauth|header] [--args ...]`, plus `list`, `remove`, `test`, `configure`, `login`, `install <catalog-entry>`. src: https://github.com/NousResearch/hermes-agent/blob/main/website/docs/reference/cli-commands.md
  - Also an MCP **server**: `hermes mcp serve` (stdio; exposes conversations/messages). Same file; https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp
- **custom base URL / OpenAI-compatible**: yes. `config.yaml` → `model.provider: custom`, `model.base_url: http://…/v1`, `model.api_key` or `model.key_env`; or `hermes model` → "Custom endpoint". `OPENAI_BASE_URL` is honored only for the `openai-api` provider. OpenRouter is a first-class provider (`OPENROUTER_API_KEY`). `HERMES_CODEX_BASE_URL` routes the ChatGPT-subscription provider through a proxy. src providers.md, environment-variables.md (above)
- **headless**:
  - `hermes chat --oneshot -q "…"` (answer and exit; implied on non-TTY stdio), `hermes -z "…"` (final text only; exit codes 0/1/2/130), `--usage-file <path>` (JSON usage/cost report). src cli-commands.md (above)
  - Structured output: `hermes chat -q "…" --format stream-json` (JSONL with `system/text/tool_use/tool_result/result`). Same file.
  - Resume: `--resume <id|title|latest>` / `-r`, `--continue [name]` / `-c`. Same file.
  - ACP: `hermes acp` (ACP server over stdio for editors). src: https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/acp.md
  - API server: OpenAI-compatible HTTP endpoint (`API_SERVER_ENABLED=true`, `API_SERVER_KEY` in `.env`, served by `hermes gateway`). src: https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/api-server.md
  - SDK: **unverified** (no SDK package found in the docs read).
- **multiple accounts/profiles**: yes. `HERMES_HOME` selects the config/data home (default `~/.hermes`). Profiles: `hermes profile create <name>` → `~/.hermes/profiles/<name>/` with its own `config.yaml`, `.env`, `auth.json`, sessions; select with `-p/--profile <name>` or `hermes profile use`. Caveat: Anthropic/Codex/xAI OAuth refresh tokens are single-use, so clones keep reading root `~/.hermes/auth.json` unless `hermes -p <name> auth add <provider>` is run. src environment-variables.md; https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/profiles.md
- **license**: MIT. `gh api repos/NousResearch/hermes-agent` → `MIT`.

---

## 2. Claude Code (Anthropic)

- **what**: Anthropic's agentic coding tool; terminal CLI (also IDE extensions, desktop, web). Category: **CLI coding agent**. https://code.claude.com/docs/en/setup
- **install + launch**: `curl -fsSL https://claude.ai/install.sh | bash`, or `brew install --cask claude-code`; launch `claude`. src: https://code.claude.com/docs/en/setup.md
- **auth**: https://code.claude.com/docs/en/authentication
  - Subscription OAuth via `/login` (Pro, Max, Team, Enterprise), Claude Console (with or without an API key), Bedrock / Agent Platform (Vertex) / Foundry, Claude apps gateway SSO.
  - Env: `ANTHROPIC_API_KEY` (`X-Api-Key`), `ANTHROPIC_AUTH_TOKEN` (`Authorization: Bearer`), `CLAUDE_CODE_OAUTH_TOKEN` (one-year token from `claude setup-token`), `CLAUDE_CODE_OAUTH_REFRESH_TOKEN`, `ANTHROPIC_PROFILE`, `apiKeyHelper` setting. https://code.claude.com/docs/en/env-vars
  - Precedence: cloud provider → `ANTHROPIC_AUTH_TOKEN` → `ANTHROPIC_API_KEY` → `apiKeyHelper` → `CLAUDE_CODE_OAUTH_TOKEN` → Anthropic profile/WIF → `/login` OAuth. https://code.claude.com/docs/en/authentication
  - Storage: macOS Keychain (fallback `~/.claude/.credentials.json`, mode 0600); Linux `~/.claude/.credentials.json`; with `CLAUDE_CONFIG_DIR` the file and the Keychain entry are keyed to that directory. https://code.claude.com/docs/en/authentication
- **MCP client**: yes. https://code.claude.com/docs/en/mcp
  - CLI: `claude mcp add --transport http <name> <url> --header "Authorization: Bearer …"`; stdio `claude mcp add [--env K=V] <name> -- <cmd> [args]`; `claude mcp add-json <name> '<json>'`; `--scope local|project|user`; `claude mcp list|get|remove|login`.
  - Files: `.mcp.json` (project, JSON `mcpServers`), `~/.claude.json` (local and user scope). Keys: `type` (`stdio|http|sse|ws`), `command`/`args`/`env`, `url`/`headers`/`headersHelper`/`oauth`/`timeout`; `${VAR}` / `${VAR:-default}` expansion.
  - Transports: stdio, streamable HTTP, SSE (**deprecated**), WebSocket. Static `headers` plus dynamic `headersHelper` (script returns JSON headers, re-run on 401/403). OAuth supported.
  - Headless: `--mcp-config <file-or-json>`. https://code.claude.com/docs/en/headless
- **custom base URL / OpenAI-compatible**: base URL **yes**, OpenAI format **no**. `ANTHROPIC_BASE_URL` points at a gateway that must speak **Anthropic Messages** (`/v1/messages`), or Bedrock InvokeModel (`ANTHROPIC_BEDROCK_BASE_URL` + `CLAUDE_CODE_USE_BEDROCK=1`), or Vertex rawPredict (`ANTHROPIC_VERTEX_BASE_URL` + `CLAUDE_CODE_USE_VERTEX=1`). No OpenAI Chat Completions format is listed. "Anthropic … doesn't support routing Claude Code to non-Claude models through any gateway." `ANTHROPIC_CUSTOM_HEADERS` adds headers; `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1` reads `/v1/models`. Setting only `ANTHROPIC_BASE_URL` without a gateway credential keeps the subscription login as the credential. https://code.claude.com/docs/en/llm-gateway-protocol , https://code.claude.com/docs/en/llm-gateway , https://code.claude.com/docs/en/env-vars
- **headless**: https://code.claude.com/docs/en/headless , https://code.claude.com/docs/en/cli-reference
  - `claude -p "…"` with `--output-format text|json|stream-json` (stream-json needs `--verbose`; `--include-partial-messages` for token deltas); `--input-format stream-json`; `--json-schema` → `structured_output`; `--bare` (skips hooks/plugins/MCP/CLAUDE.md, never reads OAuth/keychain, needs `ANTHROPIC_API_KEY` or `apiKeyHelper`); `--permission-mode`, `--permission-prompts none`, `--max-turns`, `--max-budget-usd`.
  - Events: `system/init` (lists `mcp_servers`, `mcp_server_errors`, plugins), `system/api_retry`, final `result` with `session_id` and `total_cost_usd`.
  - Resume: `--continue`/`-c`, `--resume <session-id|transcript path>`, `--fork-session`.
  - SDK: Agent SDK for Python and TypeScript (repos `anthropics/claude-agent-sdk-python`, `anthropics/claude-agent-sdk-typescript`). https://code.claude.com/docs/en/agent-sdk/overview
  - ACP: **not in official docs** (`curl https://code.claude.com/docs/llms.txt | grep -ci acp` → `0`).
- **multiple accounts/profiles**: yes. `CLAUDE_CONFIG_DIR` (default `~/.claude`); official multi-account recipe `alias claude-work='CLAUDE_CONFIG_DIR=~/.claude-work claude'`; each directory has its own settings, history and login. Exception: two keyless Console sign-ins are stored outside the config directory and are not separated. https://code.claude.com/docs/en/authentication
- **license**: proprietary. `LICENSE.md` in `anthropics/claude-code`: "© Anthropic PBC. All rights reserved. Use is subject to Anthropic's Commercial Terms of Service." https://raw.githubusercontent.com/anthropics/claude-code/main/LICENSE.md

---

## 3. OpenAI Codex CLI

- **what**: OpenAI's local coding agent (CLI, also IDE extension and desktop app). Category: **CLI coding agent**. https://github.com/openai/codex
- **install + launch**: `curl -fsSL https://chatgpt.com/codex/install.sh | sh`, `npm install -g @openai/codex`, or `brew install --cask codex`; launch `codex`. https://github.com/openai/codex/blob/main/README.md
- **auth**: (developers.openai.com/codex/* now 308-redirects to learn.chatgpt.com)
  - ChatGPT sign-in (browser OAuth) via `codex login` — recommended, uses the Plus/Pro/Business/Edu/Enterprise plan; API key via `printenv OPENAI_API_KEY | codex login --with-api-key`; device code (beta) `codex login --device-auth`. https://learn.chatgpt.com/docs/auth
  - Storage: `cli_auth_credentials_store = file|keyring|auto|ephemeral`; `file` → `auth.json` under `CODEX_HOME` (default `~/.codex`). https://learn.chatgpt.com/docs/auth , https://learn.chatgpt.com/docs/config-file/config-reference
  - CI: `CODEX_API_KEY=<key> codex exec --json "…"` (set only for that invocation). https://learn.chatgpt.com/docs/non-interactive-mode
- **MCP client**: yes. https://learn.chatgpt.com/docs/extend/mcp?surface=cli
  - CLI: `codex mcp add <name> [--env K=V] -- <stdio-command>`; `codex mcp add <name> --url <http-url> [--oauth-client-id …]`; `codex mcp login <name>`. A `--bearer-token-env-var` CLI flag: **unverified** (not on the page read; the config key exists).
  - Config: `~/.codex/config.toml` (and project `.codex/config.toml`), TOML tables `[mcp_servers.<name>]`. Stdio keys `command`, `args`, `env`, `env_vars`, `cwd`; HTTP keys `url`, `bearer_token_env_var`, `http_headers`, `env_http_headers`; common `enabled`, `startup_timeout_sec`, `tool_timeout_sec`, `enabled_tools`, `disabled_tools`. https://learn.chatgpt.com/docs/config-file/config-reference
  - Transports: stdio, streamable HTTP ("`mcp_servers.<id>.url` — Endpoint for an MCP streamable HTTP server"). SSE: **not documented**. Auth: bearer tokens, OAuth, ChatGPT session auth.
- **custom base URL / OpenAI-compatible**: yes, with a constraint. `openai_base_url` overrides the built-in OpenAI provider; custom providers via `model_provider = "<id>"` + `[model_providers.<id>]` with `name`, `base_url`, `env_key`, `wire_api`, `http_headers`, `env_http_headers`, `query_params`, or command-backed `[model_providers.<id>.auth]`. **`wire_api`: "`responses` is the only supported value"** — the upstream must implement the OpenAI Responses API (no Chat Completions). Built-in `amazon-bedrock`; `--oss` with `oss_provider = "ollama"|"lmstudio"`. OpenRouter-specific example: **not in docs**. https://learn.chatgpt.com/docs/config-file/config-advanced , https://learn.chatgpt.com/docs/config-file/config-reference
- **headless**:
  - `codex exec "…"` (final message to stdout, progress to stderr); `--json` → JSONL events `thread.started`, `turn.started`, `item.*`, `turn.completed`; `--output-schema <file>`; `-o/--output-last-message <path>`; `codex exec resume --last "…"` or by session ID; `--ephemeral`; `--skip-git-repo-check`; `--sandbox read-only|workspace-write|danger-full-access`; `--ignore-user-config`. https://learn.chatgpt.com/docs/non-interactive-mode
  - App server: `codex app-server` — JSON-RPC 2.0 over stdio JSONL (default), experimental WebSocket (`--listen ws://127.0.0.1:4500`), Unix socket. https://learn.chatgpt.com/codex/app-server
  - SDK: `npm install @openai/codex-sdk` (TypeScript; `baseUrl` option maps to `--config openai_base_url=…`); a Python SDK lives in `sdk/python`. https://github.com/openai/codex/blob/main/sdk/typescript/README.md
  - ACP: **not in official docs read**.
- **multiple accounts/profiles**: `CODEX_HOME` (default `~/.codex`) holds `config.toml`, `auth.json`, history. Profiles: `codex --profile <name>` overlays `~/.codex/<name>.config.toml`; since Codex 0.134.0, `[profiles.<name>]` in `config.toml` and the `profile = "…"` selector are no longer read. Profiles are config layers, not separate logins; separate accounts need separate `CODEX_HOME`. https://learn.chatgpt.com/docs/config-file/config-advanced
- **license**: Apache-2.0. `gh api repos/openai/codex` → `Apache-2.0`.

---

## 4. OpenClaw

- **what**: open-source personal AI assistant that runs locally and operates across chat apps (WhatsApp, Telegram, Discord …) through a Gateway. Category: **personal agent**. Stewarded by the OpenClaw Foundation. https://openclaw.ai/
- **install + launch**: `curl -fsSL https://openclaw.ai/install.sh | bash` (or `npm install -g openclaw@latest --allow-scripts=openclaw`); onboarding `openclaw onboard`. https://openclaw.ai/ ; src: https://github.com/openclaw/openclaw/blob/main/docs/install/index.md
- **auth**: src: https://github.com/openclaw/openclaw/blob/main/docs/concepts/oauth.md
  - OAuth "subscription auth": OpenAI Codex (ChatGPT OAuth), Anthropic Claude CLI reuse / `claude -p` (setup-token also supported); OpenRouter OAuth (`openclaw onboard --auth-choice openrouter-oauth`) or key (`--auth-choice openrouter-api-key`). src: https://github.com/openclaw/openclaw/blob/main/docs/providers/openrouter.md
  - API keys: recommended in `~/.openclaw/.env` (= `$OPENCLAW_STATE_DIR/.env`) or the `env` block of `~/.openclaw/openclaw.json`. src: https://github.com/openclaw/openclaw/blob/main/docs/help/environment.md
  - Credential storage: shared `~/.openclaw/state/openclaw.sqlite`; per-agent `~/.openclaw/agents/<agentId>/agent/openclaw-agent.sqlite` (tables `auth_profile_store`, `auth_profile_state`); legacy `auth-profiles.json` migrated. src oauth.md (above)
- **MCP client**: yes (OpenClaw-managed registry projected into its runtimes). src: https://github.com/openclaw/openclaw/blob/main/docs/cli/mcp.md
  - CLI: `openclaw mcp add <name> --command npx --arg -y --arg …`, `openclaw mcp set <name> '<json>'`, `list|show|status|doctor|probe|login|logout|unset`. src: https://github.com/openclaw/openclaw/blob/main/docs/cli/mcp/registry.md
  - Config: `~/.openclaw/openclaw.json` (JSON5), key `mcp.servers.<name>`; stdio `command`/`args`/`env`/`cwd`; HTTP `url`, `headers`, `transport: "streamable-http"` (canonical; `type: "http"` accepted), `auth: "oauth"`, `connectionTimeoutMs`, `requestTimeoutMs`, `sslVerify`, `clientCert`/`clientKey`. src: https://github.com/openclaw/openclaw/blob/main/docs/cli/mcp/transports.md
  - Transports: stdio, SSE, Streamable HTTP. Bearer via `headers.Authorization` (ignored while `auth: "oauth"`). MCP OAuth tokens in `<state-dir>/state/openclaw.sqlite`. Same file.
  - Also an MCP **server**: `openclaw mcp serve` (stdio; channel conversations). src cli/mcp.md
- **custom base URL / OpenAI-compatible**: yes. `models.providers.<id>` with `baseUrl`, `apiKey: "${ENV}"`, `api: "openai-completions" | "anthropic-messages" | …`, `models: [...]`. OpenRouter is a built-in provider (`openrouter/<provider>/<model>`). src: https://github.com/openclaw/openclaw/blob/main/docs/concepts/model-providers/custom-providers.md
- **headless**: src: https://github.com/openclaw/openclaw/blob/main/docs/cli/agent.md
  - `openclaw agent exec "…"` — embedded single turn without a Gateway, "the recommended headless entry point for CI"; `--message-file <path|->`, `--cwd`, `--json` (stable JSON envelope on stdout); exit 0/1/2 (timeout, default 600 s).
  - `openclaw agent -m "…"` via the Gateway with a selector `--to | --session-key | --session-id | --agent`; `--local` runs embedded.
  - Streamed JSONL event output: **unverified** (docs describe a single JSON envelope).
  - ACP: `openclaw acp` — ACP over stdio, bridged to the Gateway over WebSocket; `initialize/newSession/prompt/cancel/listSessions/resumeSession` implemented, `loadSession` partial. src: https://github.com/openclaw/openclaw/blob/main/docs/cli/acp.md
  - SDK: **unverified**.
- **multiple accounts/profiles**: yes. `OPENCLAW_HOME`, `OPENCLAW_STATE_DIR`, `OPENCLAW_CONFIG_PATH`, `OPENCLAW_PROFILE`; global flags `--profile <name>` (state under `~/.openclaw-<name>`) and `--dev` (`~/.openclaw-dev`). Personal model accounts: `models accounts login`. src help/environment.md; https://github.com/openclaw/openclaw/blob/main/docs/cli/index.md
- **license**: MIT. `gh api repos/openclaw/openclaw` → `MIT`.

---

## 5. OpenHands CLI (All Hands AI)

- **what**: terminal UI for the OpenHands software-engineering agent; also `openhands web`, `openhands serve` (GUI in Docker), `openhands cloud`. Category: **CLI coding agent**. docs.all-hands.dev 308-redirects to docs.openhands.dev. https://docs.openhands.dev/openhands/usage/cli/installation.md
- **install + launch**: `uv tool install openhands --python 3.12` or `curl -fsSL https://install.openhands.dev/install.sh | sh`; launch `openhands`. https://docs.openhands.dev/openhands/usage/cli/installation.md
- **auth**:
  - `openhands login [--server-url URL]` authenticates with OpenHands Cloud and fetches settings (recommended); otherwise first run prompts for LLM provider and API key. https://docs.openhands.dev/openhands/usage/cli/quick-start.md , https://docs.openhands.dev/openhands/usage/cli/command-reference.md
  - Env: `LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL` — applied only with `--override-with-envs`, not persisted. `OPENHANDS_CLOUD_URL`. Same page.
  - Files: `~/.openhands/agent_settings.json` (`llm.model`, `llm.api_key`, `llm.base_url`), `~/.openhands/cli_config.json`, `~/.openhands/mcp.json`, `~/.openhands/conversations/`. Same page.
  - ChatGPT/Claude subscription OAuth for the CLI: **unverified** (not in the CLI docs read).
- **MCP client**: yes. https://docs.openhands.dev/openhands/usage/cli/mcp-servers.md
  - CLI: `openhands mcp add <name> --transport http|sse|stdio [--header "K: V"]… [--env K=V]… [--auth oauth] [--enabled|--disabled] <target> [-- args]`; `list|get|remove|enable|disable`.
  - File: `~/.openhands/mcp.json`, JSON `mcpServers` (FastMCP client format: `command`/`args`/`env`; URL entries).
  - Transports: stdio, HTTP, SSE; headers repeatable (bearer and API-key headers shown); OAuth via `--auth oauth`.
- **custom base URL / OpenAI-compatible**: yes, through LiteLLM: model `openai/<model>` plus Base URL for OpenAI-compatible proxies; OpenRouter as `openrouter/<provider>/<model>`; `LLM_BASE_URL` / `llm.base_url`. https://docs.openhands.dev/openhands/usage/llms/openai-llms.md , https://docs.openhands.dev/openhands/usage/llms/openrouter.md
- **headless**:
  - `openhands --headless -t "…"` or `-f task.txt` (always auto-approve); `--json` → JSONL events (`{"type":"action",…}`, `{"type":"observation",…}`); exit 0/1/2. https://docs.openhands.dev/openhands/usage/cli/headless.md , command-reference.md
  - Resume: `--resume [ID]`, `--resume --last`. https://docs.openhands.dev/openhands/usage/cli/resume.md
  - ACP: `openhands acp [--resume [ID]] [--last] [--always-approve|--llm-approve] [--streaming]` (Zed, JetBrains, VS Code ACP extension, Toad). https://docs.openhands.dev/openhands/usage/cli/ide/overview.md , command-reference.md
  - SDK: the OpenHands Agent SDK is documented under https://docs.openhands.dev/sdk/ (index in https://docs.openhands.dev/llms.txt); its package name: **unverified**.
- **multiple accounts/profiles**: no documented profile feature. Source code reads `OPENHANDS_PERSISTENCE_DIR` (default `~/.openhands`), `OPENHANDS_CONVERSATIONS_DIR`, `OPENHANDS_WORK_DIR` — source, not docs. https://github.com/OpenHands/OpenHands-CLI/blob/main/openhands_cli/locations.py
- **license**: MIT. `gh api repos/OpenHands/OpenHands-CLI` → `MIT`.

---

## 6. pi coding agent (pi.dev)

- **what**: "minimal agent harness" — a coding agent CLI extended through TypeScript extensions, skills, themes and packages; deliberately ships no sub-agents, permission popups or plan mode. Category: **CLI coding agent**. `badlogic/pi-mono` now resolves to `earendil-works/pi` (package `packages/coding-agent`). https://pi.dev/ ; `gh api repos/badlogic/pi-mono` → `earendil-works/pi`
- **install + launch**: `curl -fsSL https://pi.dev/install.sh | sh` or `npm install -g --ignore-scripts @earendil-works/pi-coding-agent` (Node ≥ 22.19); launch `pi`. src: https://github.com/earendil-works/pi/blob/main/packages/coding-agent/README.md
- **auth**:
  - `/login [provider]` → OAuth or API key, saved to `<agent-dir>/auth.json` (`~/.pi/agent/auth.json`). src: https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/providers.md
  - OAuth providers: Anthropic (Claude Pro/Max), OpenAI (Sign in with ChatGPT), OpenAI Codex legacy (ChatGPT Plus/Pro), GitHub Copilot, OpenRouter (PKCE mints a key). src: https://github.com/earendil-works/pi/blob/main/packages/ai/README.md
  - Env keys: `ANTHROPIC_API_KEY` (+ `ANTHROPIC_OAUTH_TOKEN`, `ANTHROPIC_AUTH_TOKEN`), `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `COPILOT_GITHUB_TOKEN`, ~35 others; `auth.json` keys may be `!command` for secret managers. src providers.md
  - Precedence: `--api-key` → `auth.json` → `models.json` `apiKey` → env/ambient. src: https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/models.md
- **MCP client**: yes. src: https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/mcp.md
  - CLI: `pi mcp add <name> -- <cmd …>`; `pi mcp add <name> --url <url> --bearer-token-env-var <VAR>`; `-l/--local` writes project config; `--env K='${VAR}'`; `pi mcp list`; in-session `/mcp`.
  - Files: user `~/.pi/agent/mcp.json`, project `.pi/mcp.json` (after project trust); JSON `mcpServers` with `command`/`args`/`env` or `url`/`headers`/`oauth`.
  - Transports: stdio, streamable HTTP; "The legacy SSE transport is not supported." OAuth for HTTP servers without an `Authorization` header (DCR or registered client).
- **custom base URL / OpenAI-compatible**: yes. `~/.pi/agent/models.json` providers with `baseUrl` and `api: "openai-completions" | "openai-responses" | anthropic | google`-compatible; OpenRouter built in (`OPENROUTER_API_KEY`). src models.md; packages/ai/README.md
- **headless**: src: https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/cli.md
  - `pi -p/--print "…"` (final text), `pi --mode json "…"` (JSONL events), `pi --mode rpc` (JSONL commands on stdin, responses and events on stdout; docs `rpc.md`, `rpc-commands.md`).
  - Resume: `-c/--continue`, `-r/--resume` (picker), `--session <path|id>`, `--session-id <id>`, `--fork <path|id>`.
  - SDK: `import { createAgentSession } from "@earendil-works/pi-coding-agent"`. src: https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md
  - ACP: **not in official docs** (no ACP file in the repo tree; `gh api …/git/trees/main?recursive=1 | grep acp` → none).
- **multiple accounts/profiles**: `PI_CODING_AGENT_DIR` overrides the agent/config directory (default `~/.pi/agent`); `PI_CODING_AGENT_SESSION_DIR` / `--session-dir` for sessions. Named profiles: **not documented**. src: https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/environment-variables.md
- **license**: MIT. `gh api repos/earendil-works/pi` → `MIT`.

---

## 7. omp (oh-my-pi)

- **what**: `omp` is **oh-my-pi**, "Coding agent with the IDE wired in", built by Stencil Labs; a **fork of Pi** (badlogic/pi-mono) by Mario Zechner, with a native Rust core (in-process ripgrep/glob/bash), subagents, debugger attach, Collab sessions. Category: **CLI coding agent**. https://omp.sh/ ; src: https://github.com/can1357/oh-my-pi/blob/main/README.md
- **install + launch**: `curl -fsSL https://omp.sh/install | sh`, `brew install can1357/tap/omp`, `bun install -g @oh-my-pi/pi-coding-agent`, Nix flake; Windows `irm https://omp.sh/install.ps1 | iex`; launch `omp`. src README.md
- **auth**:
  - OAuth providers: Anthropic, OpenAI Codex, Google Antigravity, SuperGrok, Cursor, GitHub Copilot, Devin, Qwen Portal; "plan" (coding-plan subscription) providers: Kimi, MiniMax, Z.AI/GLM, Alibaba and others; `/login` or `omp login`. src README.md
  - Env: `ANTHROPIC_OAUTH_TOKEN` (wins over `ANTHROPIC_API_KEY`), `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENAI_CODEX_OAUTH_TOKEN`, `GEMINI_API_KEY`, many more. Optional auth broker/gateway (`omp auth-broker`, `omp auth-gateway`, `OMP_AUTH_BROKER_URL`/`OMP_AUTH_BROKER_TOKEN`). src: https://github.com/can1357/oh-my-pi/blob/main/docs/environment-variables.md
  - Storage: runtime state including `agent.db` under `~/.omp/agent/` (per profile `~/.omp/profiles/<name>/agent/`). Exact credential file: **unverified** (docs name `agent.db` as runtime state). src: https://github.com/can1357/oh-my-pi/blob/main/docs/config-usage.md
- **MCP client**: yes. src: https://github.com/can1357/oh-my-pi/blob/main/docs/mcp-config.md
  - Files: project `.omp/mcp.json`, user `~/.omp/agent/mcp.json` (profile `~/.omp/profiles/<name>/agent/mcp.json`); JSON `mcpServers` with `type: "stdio"|"http"|"sse"`, `command`/`args`/`env`, `url`, `headers`, `oauth`. Also auto-discovers servers from Claude Code (`~/.claude.json`, `.mcp.json`), Cursor, Codex, Gemini CLI, Windsurf, OpenCode, VS Code configs.
  - Transports: stdio, Streamable HTTP, SSE. https://github.com/can1357/oh-my-pi/blob/main/docs/mcp-protocol-transports.md
  - Add a server: in-session `/mcp add`; a top-level `omp mcp` CLI subcommand is **not listed** in the CLI reference. src: https://github.com/can1357/oh-my-pi/blob/main/docs/cli-reference.md
- **custom base URL / OpenAI-compatible**: yes. `~/.omp/agent/models.yml` providers with `baseUrl`, `api: openai-completions | openai-responses | anthropic-messages | …`, `apiKey`, `models`. OpenRouter built in. src README.md
- **headless**: src cli-reference.md
  - `omp -p "…"` (final text), `--mode json` (JSONL events: session header, `message_update`, `message_end`), `--mode rpc` (line-delimited JSON over stdio, "not JSON-RPC 2.0"), `--mode rpc-ui`, `--no-ui`, `--max-time`.
  - ACP: `omp acp` or `--mode acp` (ACP server over stdio).
  - Resume: `-c/--continue`, `-r/--resume [id]`, `--session [id]`, `--fork`.
  - SDK: "The Node SDK embeds the session in your process" (README); package entry: **unverified**.
- **multiple accounts/profiles**: yes. `--profile <name>` / `OMP_PROFILE` (legacy `PI_PROFILE`) → isolated auth, sessions, settings, caches under `~/.omp/profiles/<name>/`; `--alias <name>` makes a shell shortcut; `PI_CONFIG_DIR` (config root dirname, default `.omp`); `PI_CODING_AGENT_DIR` (default profile only). src cli-reference.md, config-usage.md, environment-variables.md
- **license**: MIT. `gh api repos/can1357/oh-my-pi` → `MIT`.

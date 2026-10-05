# Agents group C — raw research notes

Raw input for the report `2026-10-05-openrouter-agent-support`. Every page cited was fetched with WebFetch on
2026-10-05 from official docs, repos or package registries. Anything not confirmed on a fetched page is marked
**unverified**. Agents covered: Cursor CLI, Zed, CodeGPT, Letta Code, HackerAI, LangChain/LangGraph/Deep Agents,
Goose, Roo Code, Crush, Qwen Code, Gemini CLI, OpenCode, Aider, plus the Agent Client Protocol (ACP).

Fields per agent: what + category · install + launch · auth · MCP client · custom base URL / OpenAI-compatible ·
headless · config-dir override · license.

---

## 1. Cursor CLI (`agent`, formerly `cursor-agent`)

- **What + category:** Cursor's terminal coding agent (a CLI agent). The same binary can also run as an ACP server.
  https://cursor.com/docs/cli/installation , https://cursor.com/docs/cli/acp
- **Install + launch:**
  - macOS/Linux/WSL: `curl https://cursor.com/install -fsS | bash`
  - Windows: `irm 'https://cursor.com/install?win32=true' | iex`
  - The binary is `agent` in `~/.local/bin`, which must be on PATH. Launch with `agent`; update with `agent update`
    (it also auto-updates by default).
  - The old name `cursor-agent` is not on the current page.
  - https://cursor.com/docs/cli/installation
- **Auth:**
  - Subscription login: `agent login` (browser), plus `agent status`, `agent whoami` and `agent logout`.
  - API key: the `CURSOR_API_KEY` env var or `--api-key <key>`.
  - ACP mode also takes `--auth-token` / `CURSOR_AUTH_TOKEN`.
  - The docs only say credentials are "securely stored locally"; the exact location is **unverified**.
  - https://cursor.com/docs/cli/reference/authentication , https://cursor.com/docs/cli/acp
- **MCP client: yes.**
  - Config is shared with the editor: `.cursor/mcp.json` (project) and `~/.cursor/mcp.json` (global).
  - Format: `{"mcpServers":{"<name>":{...}}}`
    - stdio: `command`, `args`, `env`, `envFile`
    - remote: `url` + `headers` (headers are supported)
    - OAuth: an `auth` block (`CLIENT_ID`, `CLIENT_SECRET`, `scopes`); the desktop callback is
      `http://localhost:8787/callback`
    - interpolation: `${env:VAR}`, `${userHome}`, `${workspaceFolder}`
  - Transports: stdio, HTTP, SSE.
  - CLI: `agent mcp list | list-tools <id> | login <id> | enable <id> | disable <id>`. There is no `mcp add`;
    servers are added by editing the JSON. `--approve-mcps` auto-approves them.
  - https://cursor.com/docs/mcp , https://cursor.com/docs/cli/mcp , https://cursor.com/docs/cli/reference/parameters
- **Custom base URL / OpenAI-compatible: no CLI flag documented.**
  - The parameters page lists no endpoint or base-URL flag (a `-H/--header` flag does exist).
  - Models come from Cursor: `--model`, `--list-models`, `agent models`.
  - https://cursor.com/docs/cli/reference/parameters
- **Headless:**
  - `-p/--print`. Add `--force` (alias `--yolo`) for edits to actually apply.
  - `--output-format text|json|stream-json`. `stream-json` is NDJSON with these events:
    - `system/init` (carries `session_id`, `model`, `apiKeySource`)
    - `user`, `assistant`
    - `tool_call` started/completed
    - `result`
  - `--stream-partial-output` streams deltas.
  - Session resume: `--resume [chatId]`, `--continue`, `agent ls`, `agent resume`, `agent create-chat`.
  - Other flags: `--sandbox <mode>`, `--trust`, `--workspace <path>`, `--mode`, `--plan`, `-w/--worktree`.
    There is also an `agent worker start` subcommand.
  - ACP: `agent acp` speaks JSON-RPC 2.0 over stdio with NDJSON framing, e.g.
    `agent --api-key "$CURSOR_API_KEY" acp`. Documented clients: Zed, JetBrains, Neovim (avante.nvim).
  - An SDK is **unverified**.
  - https://cursor.com/docs/cli/headless , https://cursor.com/docs/cli/reference/output-format ,
    https://cursor.com/docs/cli/reference/parameters , https://cursor.com/docs/cli/acp
- **Config-dir override:**
  - `CURSOR_CONFIG_DIR`. On Linux/BSD, `XDG_CONFIG_HOME` also works (`$XDG_CONFIG_HOME/cursor/cli-config.json`).
  - Defaults: `~/.cursor/cli-config.json`, plus a project `.cursor/cli.json` that holds permissions only.
  - Whether `CURSOR_CONFIG_DIR` also moves credentials or `mcp.json` is **unverified**.
  - https://cursor.com/docs/cli/reference/configuration
- **License:** proprietary (no open-source license is published). **Unverified** on the pages fetched.

## 2. Zed — Agent Panel and external agents over ACP

- **What + category:** an editor and ACP client.
  - Its built-in agent, the Agent Panel, has tool calling, checkpoints, parallel threads, and per-thread profiles
    that pick built-in and MCP tools.
  - https://zed.dev/docs/ai/agent-panel.md
- **Install + launch:**
  - Open the panel with `agent: new thread` in the command palette, or the ✨ icon in the status bar.
  - The `zed` CLI has `--wait`, `--new`, `--add`, `--reuse`, `--existing`, `--diff`, `--foreground`,
    `--user-data-dir`, among others.
  - The editor's install command was not fetched (**unverified**).
  - https://zed.dev/docs/ai/agent-panel.md , https://zed.dev/docs/reference/cli.md
- **Auth:**
  - Zed account: GitHub OAuth in the browser (`client: sign in`, `read:user` scope).
    - Pro: hosted models with $5/month of token credit, then provider rates plus 10%.
    - Free: your own keys or external agents only.
  - Provider keys as env vars: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` (falls back to
    `GOOGLE_AI_API_KEY`), `MISTRAL_API_KEY`, `DEEPSEEK_API_KEY`, `XAI_API_KEY`, `OPENCODE_API_KEY`,
    `OPENROUTER_API_KEY`.
  - Keys entered in the UI go to the system keychain, not `settings.json`. Env vars take precedence over the keychain.
  - Settings files: `~/.config/zed/settings.json` (macOS/Linux), `%APPDATA%\Zed\settings.json` (Windows),
    `.zed/settings.json` (project).
  - https://zed.dev/docs/authentication.md , https://zed.dev/docs/account/plans-and-pricing.md ,
    https://zed.dev/docs/ai/use-api-access , https://zed.dev/docs/configuring-zed.md
- **MCP client: yes.**
  - Settings key `context_servers`.
    - local: `command`, `args`, `env`
    - remote: `url` + `headers` (e.g. `"Authorization": "Bearer <token>"`); with no Authorization header Zed runs
      the standard MCP OAuth flow
  - Servers can also come from extensions or Settings → AI → MCP Servers.
  - Which remote transport is used (streamable HTTP or SSE) is **unverified**.
  - Zed's MCP servers "may be forwarded to External Agents over ACP".
  - https://zed.dev/docs/ai/mcp , https://zed.dev/docs/ai/external-agents
- **Custom base URL: yes.**
  - `language_models.openai_compatible.<provider>` with `api_url` and
    `available_models[{name, display_name, max_tokens}]`. The key is read from the env var `<PROVIDER_NAME>_API_KEY`.
  - `language_models.anthropic_compatible` also takes `custom_headers`.
  - OpenRouter is built in and reads `OPENROUTER_API_KEY`.
  - https://zed.dev/docs/ai/use-api-access , https://zed.dev/docs/ai/llm-providers
- **ACP (as a client):**
  - `agent_servers` types: `registry`, `custom`, `extension`. Extensions are phased out since v1.5.0 in favour of the
    ACP Registry.
  - Custom example: `{"agent_servers":{"my-agent":{"type":"custom","command":"node","args":["…","--acp"],"env":{}}}}`
  - Registry agents: Claude Agent, Codex, Gemini CLI, OpenCode, Copilot, Cursor, Pi Coding Agent, Poolside.
  - Each external agent handles its own auth and billing. Zed profiles and Skills do not apply to them.
  - https://zed.dev/docs/ai/external-agents , https://zed.dev/docs/extensions/agent-servers.md
- **Headless:** none documented for the Zed Agent; the CLI reference has no agent mode (**unverified** beyond that).
  https://zed.dev/docs/reference/cli.md
- **Config-dir override:** the `--user-data-dir <path>` flag. No env var is documented.
  https://zed.dev/docs/configuring-zed.md
- **License:** GPL-3.0-or-later, with Apache-2.0 components where marked. https://github.com/zed-industries/zed

## 3. CodeGPT (codegpt.co)

- **What + category:** an AI coding assistant and agent extension for IDEs.
  - Hosts: VS Code (`DanielSanMedium.dscodegpt`, also on Open VSX), JetBrains, Cursor.
  - Features: chat, Agent Mode (create/edit/delete files, run terminal commands with approval), autocomplete.
  - Plans: Free (10 interactions/day), Pro $10/month, Teams $30/seat.
  - https://codegpt.co/ , https://marketplace.visualstudio.com/items?itemName=DanielSanMedium.dscodegpt ,
    https://docs.codegpt.co/docs/tutorial-features/tools
- **Install + launch:**
  - Search "CodeGPT" in the VS Code or Cursor Extensions view, or JetBrains Plugins
    (https://plugins.jetbrains.com/plugin/24372-codegpt-chat--ai-agents).
  - Ports 54112/54113 must be free.
  - **There is no official CLI.** The npm `codegpt` package and `appleboy/CodeGPT` are unrelated third-party tools.
  - https://docs.codegpt.co/docs/tutorial-basics/installation
- **Auth:**
  - A CodeGPT account (sign-up at https://app.codegpt.co) for CodeGPT Pro. The login method (Google, GitHub or
    email) is **unverified**.
  - Or BYOK: provider API keys entered in the extension UI, billed by the provider.
  - Env var names and where keys are stored are **unverified**.
  - https://docs.codegpt.co/docs/tutorial-ai-providers/codegpt , https://www.codegpt.co/docs/api-keys
- **MCP client: yes.**
  - Settings (gear) → MCP Configuration → "Open MCP Config File" opens `mcp.json`, format
    `{"mcpServers":{"<name>":{"command":…,"args":[…]}}}`. Then click "Refresh Server Connections".
  - Only stdio `command`/`args` are documented. The on-disk path, `env`, `url`/`headers`, remote transports and
    OAuth are **unverified**.
  - https://docs.codegpt.co/docs/tutorial-features/mcp
- **Custom base URL: yes**, through the "Custom" provider: API key, model, and "Custom Link (completion endpoint)".
  - Pro and Teams plans only.
  - OpenAI compatibility is not stated explicitly.
  - 24 providers are listed (Ollama, LM Studio, Azure, Bedrock, GitHub Copilot, Gemini CLI, …). **OpenRouter is not
    listed.**
  - https://docs.codegpt.co/docs/tutorial-ai-providers/custom , https://docs.codegpt.co/docs/category/-ai-providers
- **Headless:** none; it runs only inside the IDE. JSON output, resume and ACP are **unverified**. A separate
  "CodeGPT Plus API" exists for its hosted agents.
  https://docs.codegpt.co/docs/codegpt_plus_api , https://developers.codegpt.co/
- **Config-dir override:** **unverified** (none documented).
- **License:** **unverified**. No license or source repo is shown; it is likely proprietary.

## 4. Letta (Letta Code CLI)

- **What + category:** Letta Code is a stateful coding agent.
  - Features: git-versioned memory (MemFS), skills, subagents, crons, messaging channels.
  - Surfaces: terminal CLI, desktop app, chat.letta.com. It ships with the Letta Agent SDK and a self-hosted App Server.
  - https://github.com/letta-ai/letta-code , https://docs.letta.com/llms.txt
- **Install + launch:**
  - `npm install -g @letta-ai/letta-code` (Node.js 22.19+), then `letta`.
  - Tutorial agent: `letta --new-agent --personality tutorial`.
  - npm latest is 0.34.4; the binary is `letta`.
  - https://github.com/letta-ai/letta-code , https://docs.letta.com/llms.txt ,
    https://registry.npmjs.org/@letta-ai/letta-code/latest
- **Auth:**
  - Letta Cloud OAuth: "Sign in with Letta" on first run, or `/login` / `letta setup`. `--backend cloud` forces the
    cloud backend.
  - Local mode needs no account: `--backend local`.
  - `LETTA_API_KEY` ("API key for authentication (alternative to OAuth)") for headless use.
  - BYOK through `/connect` or `letta connect`: OpenAI, Anthropic, Gemini, coding plans, local endpoints.
    OpenRouter works with an API key or OAuth.
  - Settings files: `~/.letta/settings.json` (global), `.letta/settings.json` (project, committable),
    `.letta/settings.local.json` (personal).
  - Where provider keys are stored on disk is **unverified**.
  - https://docs.letta.com/reference/settings/index.md , https://docs.letta.com/configuration/models ,
    https://docs.letta.com/platform/cli/reference
- **MCP client:**
  - CLI: partial. `/mcp` "Manage MCP servers" exists, but the CLI's MCP config file path and format are **unverified**.
    https://docs.letta.com/platform/cli/slash-commands/index.md
  - Agent SDK: yes.
    - `mcpServers` takes stdio, `type:"http"` (Streamable HTTP) and `type:"sse"`; remote servers take a `headers` object.
    - Tools are named `mcp__<server>__<tool>`.
    - https://docs.letta.com/agent-sdk/mcp/index.md
  - Letta also hosts its own MCP server at `https://api.letta.com/mcp`. It takes a bearer header only; OAuth-only
    clients are not supported. https://docs.letta.com/platform/hosted-mcp
- **Custom base URL:**
  - `LETTA_BASE_URL` points at a self-hosted Letta server.
  - On the model side, `/connect` adds OpenAI-compatible endpoints ("specifying a base URL and API key").
  - The CLI sends an explicit `reasoning_effort` to custom gateways.
  - https://docs.letta.com/reference/settings/index.md , https://docs.letta.com/configuration/models
- **Headless:**
  - `letta -p "..."`; stdin can be piped in.
  - `--output-format text|json|stream-json`. JSON includes `agent_id`, `conversation_id` and token usage.
  - `--input-format stream-json` makes the channel bidirectional.
  - Agent and session flags: `--agent/-a <id>`, `--conversation <id>`, `--name`, `--new`, `--new-agent`,
    `--resume/-r`, `--ephemeral`, `--yolo`, `-m/--model`.
  - SDK: `@letta-ai/letta-agent-sdk`. The App Server uses a WebSocket protocol.
  - https://docs.letta.com/platform/cli/headless , https://docs.letta.com/platform/cli/reference
- **ACP: yes, through an adapter:** `npx -y @letta-ai/letta-acp`.
  - Documented clients: Zed (`agent_servers`), JetBrains (`~/.jetbrains/acp.json`), Obsidian (third-party plugin).
  - Env vars: `LETTA_ACP_BACKEND` (e.g. `cloud-oauth`), `LETTA_AGENT_ID`, `LETTA_ACP_MODEL`.
  - https://docs.letta.com/platform/acp
- **Config-dir override:**
  - `LETTA_LOCAL_BACKEND_DIR` moves local agent state (default `~/.letta/lc-local-backend`).
  - An env var that relocates all of `~/.letta` is **unverified**.
  - https://docs.letta.com/reference/settings/index.md
- **License:** Apache-2.0. https://raw.githubusercontent.com/letta-ai/letta-code/main/LICENSE

## 5. HackerAI (hackerai.co)

- **What + category:** an "AI-Powered Penetration Testing Assistant". It is not a general coding-agent CLI.
  - It is a web app with Ask and Agent modes, plus a desktop app.
  - A local CLI client lets Agent mode run commands on your own machine.
  - https://hackerai.co , https://hackerai.co/product , https://hackerai.co/download
- **Install + launch:**
  - Desktop: macOS universal, Windows x64, Linux .deb/.AppImage (x64/arm64).
  - Local client: `npx @hackerai/local@latest --token YOUR_TOKEN`, or `npm install -g @hackerai/local` then
    `hackerai-local --token YOUR_TOKEN`.
  - The client exits after about 1 h idle and runs commands "on your OS without isolation".
  - https://hackerai.co/download ,
    https://help.hackerai.co/en/articles/12961920-connecting-a-hackerai-agent-to-your-local-machine
- **Auth:**
  - A HackerAI account (WorkOS).
  - The local client takes `--token`, copied from Settings → Remote Control → "Copy connect command".
  - The self-hosted repo's env vars: `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `ABLITERATION_API_KEY`, plus S3 and
    E2B credentials.
  - https://help.hackerai.co/en/articles/12961920-connecting-a-hackerai-agent-to-your-local-machine ,
    https://github.com/hackerai-tech/hackerai
- **MCP client:** **unverified**. It is not mentioned in the README, the product page or the help article.
- **Custom base URL:**
  - Hosted product: **unverified**.
  - Self-hosted repo: models go through OpenRouter (`OPENROUTER_API_KEY`). A base-URL setting is **unverified**.
  - https://github.com/hackerai-tech/hackerai
- **Headless:** there is no CLI agent mode. The local client only executes commands for the remote agent.
  Self-hosted Agent mode runs on Trigger.dev and E2B. ACP: **unverified** (none found).
  https://github.com/hackerai-tech/hackerai
- **Config-dir override:** **unverified**.
- **License:** the two sources disagree.
  - The LICENSE file says "Apache License Version 2.0, Copyright (c) 2025 HackerAI, LLC. All rights reserved."
  - The README badge says "Apache 2.0 with Commercial Restrictions".
  - https://raw.githubusercontent.com/hackerai-tech/hackerai/main/LICENSE , https://github.com/hackerai-tech/hackerai

## 6. LangChain / LangGraph / Deep Agents (Deep Agents Code, `dcode`)

- **What + category:** a framework and harness stack.
  - LangChain: the agent framework (`create_agent`).
  - LangGraph: the runtime, server and CLI underneath.
  - Deep Agents: the `deepagents` SDK (`create_deep_agent`), built on LangGraph.
  - Deep Agents Code (`dcode`, PyPI `deepagents-code` 0.1.80): a prebuilt terminal coding agent.
  - The older `deepagents-cli` (0.3.0) is marked DEPRECATED on PyPI.
  - https://github.com/langchain-ai/deepagents , https://pypi.org/pypi/deepagents-code/json ,
    https://pypi.org/pypi/deepagents-cli/json
- **Install + launch:**
  - CLI: `curl -LsSf https://langch.in/dcode | bash`, then `dcode`. Windows: use WSL.
  - SDK: `pip install deepagents` or `uv add deepagents`.
  - https://docs.langchain.com/oss/python/deepagents/cli , https://docs.langchain.com/oss/deepagents/code/quickstart
- **Auth:**
  - API keys: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, and so on. `DEEPAGENTS_CODE_{NAME}` is
    read before `{NAME}`.
  - Global secrets go in `~/.deepagents/.env`.
  - The `/auth` TUI or `dcode auth set|list|remove|path` writes `auth.json` under the profile's `.state/`.
    `auth set` reads the key from stdin or `--from-env`.
  - Subscription login: provider `openai_codex` signs in with a ChatGPT browser login. No Claude-subscription
    login is documented.
  - https://docs.langchain.com/oss/deepagents/code/configuration ,
    https://docs.langchain.com/oss/deepagents/code/credentials ,
    https://docs.langchain.com/oss/deepagents/code/cli-reference
- **MCP client (dcode): yes**, using a Claude-Code-compatible `.mcp.json` with the `mcpServers` key.
  - Discovery order, lowest precedence first:
    1. `~/.deepagents/.mcp.json`
    2. `<project>/.deepagents/.mcp.json`
    3. `<project>/.mcp.json`
  - Entries merge by name.
  - Flags and env:
    - `--mcp-config PATH` adds a source with the highest precedence.
    - `--no-mcp` turns MCP off.
    - `--trust-project-mcp` / `DEEPAGENTS_CODE_DANGEROUSLY_ENABLE_PROJECT_MCP_SERVERS` control project trust.
  - Transports: stdio (default), `"type":"sse"`, `"type":"http"` (streamable; `streamable_http` is an alias).
  - Remote servers take `headers`, with `${VAR}` / `${VAR:-default}` interpolation.
  - OAuth: `"auth":"oauth"` plus `dcode mcp login`. It cannot be combined with an Authorization header.
  - https://docs.langchain.com/oss/deepagents/code/mcp-tools
- **MCP client (framework):**
  - `langchain.mcp.MCPAdapter` (langchain ≥ v1.4.0): stdio, streamable HTTP or in-memory FastMCP; bearer,
    OAuth 2.1 or per-user auth.
  - `langchain-mcp-adapters` (0.3.2) has a documented migration path to it.
  - https://docs.langchain.com/oss/python/langchain/mcp , https://pypi.org/pypi/langchain-mcp-adapters/json
- **Custom base URL / OpenAI-compatible: yes.**
  - dcode `config.toml`: `[models.providers.<name>]` with `base_url`, `api_key_env`, `class_path`. The docs say
    "Any service that exposes an OpenAI-compatible or Anthropic-compatible API also works out of the box".
  - OpenRouter: `dcode --install openrouter`, then `/model openrouter:<model>`, with `OPENROUTER_API_KEY` and the
    `langchain-openrouter` package.
  - Framework: `init_chat_model(..., base_url=...)`, or `model_provider="openrouter"` / `ChatOpenRouter`.
  - https://docs.langchain.com/oss/deepagents/code/providers , https://docs.langchain.com/oss/python/langchain/models
- **Headless:**
  - `-n/--non-interactive "task"`. Piped stdin turns this on automatically (10 MiB max); `--stdin` forces it.
  - `-q/--quiet` prints only the agent's response to stdout; `--no-stream` buffers it.
  - `--max-turns` and `--timeout` exit with code 124 when exceeded.
  - Other flags: `-M/--model provider:model`, `-r/--resume [ID]`, `-a/--agent`, `-y/--auto-approve`, `--yolo`,
    `-S/--shell-allow-list`, `--sandbox`.
  - `--json` covers management subcommands only (envelope `{"schema_version":1,...}`). A JSON or JSONL stream of
    agent turns is **unverified**.
  - The framework has a server and API through `langgraph-cli`.
  - https://docs.langchain.com/oss/deepagents/code/cli-reference , https://pypi.org/pypi/langgraph-cli/json
- **ACP: yes, two ways.**
  - `dcode --acp` ("Run as an ACP server over stdio").
  - SDK: `deepagents-acp` (`AgentServerACP(agent)` with `run_agent`, over stdio), plus the JS `npx deepagents-acp`.
  - DeepAgents is listed in Zed's ACP agent directory.
  - https://docs.langchain.com/oss/deepagents/code/cli-reference , https://docs.langchain.com/oss/python/deepagents/acp ,
    https://www.npmjs.com/package/deepagents-acp , https://zed.dev/acp/agent/deepagents
- **Config-dir override:**
  - `DEEPAGENTS_HOME` moves the whole profile: `config.toml`, `.env`, `.mcp.json`, hooks, agents, skills, and
    `.state/` (sessions and credentials).
  - It must be set in the launching shell, not in a `.env` file. `dcode config path` shows the resolved locations.
  - https://docs.langchain.com/oss/deepagents/code/configuration
- **License:** MIT for deepagents, langchain, langgraph, deepagents-code, deepagents-acp and langchain-openrouter.
  https://raw.githubusercontent.com/langchain-ai/deepagents/main/LICENSE ,
  https://raw.githubusercontent.com/langchain-ai/langgraph/main/LICENSE ,
  https://raw.githubusercontent.com/langchain-ai/langchain/master/LICENSE

---

## 7. Goose

- **What + category:** an open-source general-purpose agent, shipped as a desktop app, CLI and API.
  - **The repo has moved:** `github.com/block/goose` now resolves to `aaif-goose/goose` (Agentic AI Foundation,
    Linux Foundation).
  - Docs: https://goose-docs.ai/
  - https://github.com/aaif-goose/goose , https://api.github.com/repos/block/goose
- **Install + launch:**
  - CLI: `curl -fsSL https://github.com/aaif-goose/goose/releases/download/stable/download_cli.sh | bash`, or
    `brew install block-goose-cli`.
  - Desktop: `brew install --cask block-goose`.
  - Launch: `goose configure`, then `goose session`.
  - https://github.com/aaif-goose/goose/blob/main/documentation/docs/getting-started/installation.md
- **Auth:**
  - API keys through env vars or `goose configure`: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`
    (plus `OPENROUTER_HOST`, `OPENROUTER_PARAMETERS`), `TETRATE_API_KEY`, and others.
  - Browser login options:
    - ChatGPT Codex: OAuth with a Plus/Pro subscription.
    - OpenRouter and Tetrate: an "Automatic setup" browser flow.
    - Subscription CLIs as providers: `cursor-agent`, `claude-acp`, `codex-acp`.
  - Model selection: `GOOSE_PROVIDER`, `GOOSE_MODEL`.
  - Secrets go in the system keyring, falling back to a plain-text `secrets.yaml` when `GOOSE_DISABLE_KEYRING` is set.
  - https://github.com/aaif-goose/goose/blob/main/documentation/docs/getting-started/providers.md ,
    https://github.com/aaif-goose/goose/blob/main/documentation/docs/guides/environment-variables.md ,
    https://github.com/aaif-goose/goose/blob/main/documentation/docs/guides/config-files.md
- **MCP client: yes** (Goose calls servers "extensions").
  - Config: `~/.config/goose/config.yaml` (Windows: `%APPDATA%\Block\goose\config\config.yaml`), key `extensions:`.
  - Extension types:
    - `builtin`, `platform`
    - `stdio`: `cmd`, `args`, `envs`, `env_keys`, `timeout`
    - `streamable_http`: `uri`, `headers: {}`, `envs`, `env_keys`, `timeout`
  - **SSE is not supported** (migrate old configs to `streamable_http`).
  - Adding a server: `goose configure` → Add Extension. Per-run flags: `--with-extension "name:cmd…"`,
    `--with-streamable-http-extension <url>`, `--with-builtin`.
  - Remote OAuth with a pre-registered client is supported.
  - https://github.com/aaif-goose/goose/blob/main/documentation/docs/guides/config-files.md ,
    https://github.com/aaif-goose/goose/blob/main/documentation/docs/getting-started/using-extensions.md
- **Custom base URL: yes.**
  - `OPENAI_HOST` + `OPENAI_BASE_PATH` (default `v1/chat/completions`) + `OPENAI_CUSTOM_HEADERS`; also `ANTHROPIC_HOST`.
  - Custom providers (OpenAI-, Anthropic- or Ollama-compatible) are JSON files in `~/.config/goose/custom_providers/`
    with `base_url` and `headers`.
  - https://github.com/aaif-goose/goose/blob/main/documentation/docs/getting-started/providers.md
- **Headless:**
  - `goose run -t "<text>"`, or `-i <file|->` for a file or stdin.
  - Flags: `-q`, `--no-session`, `-n/--name`, `-r/--resume`, `--output-format text|json|stream-json`.
  - Interactive resume: `goose session --resume [--session-id|--name|--path]`, plus `--fork`.
  - ACP over stdio: `goose acp`.
  - Server: `goose serve` (ACP over HTTP and WebSocket on `127.0.0.1:3284`; needs `GOOSE_SERVER__SECRET_KEY`).
  - https://github.com/aaif-goose/goose/blob/main/documentation/docs/guides/goose-cli-commands.md ,
    https://github.com/aaif-goose/goose/blob/main/documentation/docs/gdk/acp/index.md
- **Config-dir override:**
  - `GOOSE_PATH_ROOT` creates `config/`, `data/` and `state/` under the given root. The docs suggest it for running
    multiple configurations.
  - https://github.com/aaif-goose/goose/blob/main/documentation/docs/guides/environment-variables.md
- **License:** Apache-2.0. https://api.github.com/repos/aaif-goose/goose

## 8. Roo Code

- **What + category:** a VS Code extension with multi-mode agents (`RooVeterinaryInc.roo-cline`).
  - **Discontinued:** "The Roo Code Extension was shut down on May 15th". The repo was archived on 2026-05-15.
  - The README points to the ZooCode fork (github.com/Zoo-Code-Org/Zoo-Code) and to Cline.
  - https://github.com/RooCodeInc/Roo-Code , https://api.github.com/repos/RooCodeInc/Roo-Code
- **Install + launch:**
  - Extension: the VS Code Marketplace.
  - CLI (`apps/cli` in the repo):
    `curl -fsSL https://raw.githubusercontent.com/RooCodeInc/Roo-Code/main/apps/cli/install.sh | sh`, then
    `roo "prompt" -w <dir>`.
  - https://github.com/RooCodeInc/Roo-Code/blob/main/apps/cli/README.md
- **Auth:**
  - API keys, pasted in the settings panel.
  - CLI: `-k/--api-key`, or `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `GOOGLE_API_KEY`,
    `VERCEL_AI_GATEWAY_API_KEY`.
  - Credential location is **unverified**.
  - https://roocodeinc.github.io/Roo-Code/providers/openrouter (docs.roocode.com now 301-redirects there)
- **MCP client: yes.**
  - Global `mcp_settings.json` ("Edit Global MCP") and project `.roo/mcp.json`; the project file wins on name clashes.
  - Format `{"mcpServers":{…}}`:
    - stdio: `command`, `args`, `cwd`, `env`, `alwaysAllow`, `disabled`
    - remote: `type: "streamable-http" | "sse"` with `url` and `headers`
  - No MCP CLI command is documented.
  - https://roocodeinc.github.io/Roo-Code/features/mcp/using-mcp-in-roo
- **Custom base URL: yes.**
  - The "OpenAI Compatible" provider takes Base URL, API Key and Model; the model needs native tool calling.
  - The OpenRouter provider has a "Use custom base URL" checkbox.
  - https://roocodeinc.github.io/Roo-Code/providers/openai-compatible ,
    https://roocodeinc.github.io/Roo-Code/providers/openrouter
- **Headless:**
  - CLI `roo -p/--print "<prompt>"` with `--output-format text|json|stream-json`.
  - `--stdin-prompt-stream` takes NDJSON commands.
  - Other flags: `--create-with-session-id <uuid>`, `--provider` (default `openrouter`), `-m`, `--mode`,
    `--ephemeral`, `--oneshot`.
  - ACP, server mode and SDK: **unverified**.
  - https://github.com/RooCodeInc/Roo-Code/blob/main/apps/cli/README.md
- **Config-dir override:** none documented. `ROO_INSTALL_DIR` and `ROO_BIN_DIR` only affect installation.
  https://github.com/RooCodeInc/Roo-Code/blob/main/apps/cli/README.md
- **License:** Apache-2.0. https://github.com/RooCodeInc/Roo-Code

## 9. Crush (charmbracelet/crush)

- **What + category:** a terminal TUI coding agent from Charm, with LSP and MCP. Its official provider is Charm
  Hyper, which has a free tier. https://github.com/charmbracelet/crush
- **Install + launch:**
  - `brew install charmbracelet/tap/crush`, `npm install -g @charmland/crush`,
    `go install github.com/charmbracelet/crush@latest`, winget, scoop, AUR, nix.
  - Launch with `crush`.
  - https://github.com/charmbracelet/crush
- **Auth:**
  - API keys pasted in the model picker, or env vars: `HYPER_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
    `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `HF_TOKEN`, `OPENCODE_API_KEY`, plus AWS, Azure and
    Vertex vars.
  - Account login: `crush login [hyper|copilot|openai (ChatGPT)|grok]`.
  - https://github.com/charmbracelet/crush , https://github.com/charmbracelet/crush/blob/main/internal/cmd/login.go
- **Config:**
  - The primary config is now `crushrc` (a Bash script). Lookup order: `./.crushrc` → `./crushrc` →
    `~/.config/crush/crushrc`.
  - Legacy `.crush.json` / `crush.json` is still read but deprecated.
  - State lives in `~/.local/share/crush/crush.json`.
  - https://github.com/charmbracelet/crush/blob/main/docs/config/README.md
- **MCP client: yes.**
  - Transports: `stdio`, `http`, `sse`.
  - crushrc: `mcp add <name> --type http --url … --header Authorization "Bearer $X"`.
  - JSON: `"mcp":{name:{type, command, args, env, url, headers, timeout}}`.
  - Built-in MCP OAuth: `"oauth": true`, `oauth_client_id`, `oauth_client_secret`, `oauth_callback_port`.
  - https://github.com/charmbracelet/crush
- **Custom base URL: yes.**
  - crushrc: `provider add <id> --type openai-compat --base-url … --api-key "$KEY"`.
  - JSON: `"providers":{id:{type:"openai-compat", base_url, api_key}}`.
  - Use type `openai` for OpenAI proxies. The Anthropic type takes `--extra-header`.
  - https://github.com/charmbracelet/crush
- **Headless:**
  - `crush run "<prompt>"` (stdin works).
  - Flags: `-q`, `-m provider/model`, `-s/--session <id>`, `-C/--continue`. Global flags: `-y/--yolo`, `-c/--cwd`,
    `-D/--data-dir`.
  - **No JSON or JSONL output flag.**
  - `crush server` runs a client/server backend over TCP or a Unix socket.
  - ACP and SDK: **unverified** (none found).
  - https://github.com/charmbracelet/crush/blob/main/internal/cmd/run.go ,
    https://github.com/charmbracelet/crush/blob/main/internal/cmd/server.go
- **Config-dir override:** `CRUSH_GLOBAL_CONFIG` and `CRUSH_GLOBAL_DATA`; also `--data-dir` and `CRUSH_SKILLS_DIR`.
  https://github.com/charmbracelet/crush
- **License:** FSL-1.1-MIT. https://github.com/charmbracelet/crush/raw/main/LICENSE.md

## 10. Qwen Code (QwenLM/qwen-code)

- **What + category:** an open-source terminal coding agent, with a daemon, web shell and SDKs.
  https://github.com/QwenLM/qwen-code , https://qwenlm.github.io/qwen-code-docs/en/users/overview
- **Install + launch:**
  - `npm install -g @qwen-code/qwen-code@latest` (Node 22+), `brew install qwen-code`, or the standalone script.
  - Launch with `qwen`, then `/auth`.
  - https://github.com/QwenLM/qwen-code
- **Auth:**
  - **Qwen OAuth is discontinued:** its free tier ended on 2026-04-15 and it is gone from `/auth`.
  - Current options: ModelStudio Coding Plan (a subscription key `sk-sp-…`), Token Plan, an API key, or third-party
    providers.
  - Env vars:
    - OpenAI-compatible: `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL` (alias `QWEN_MODEL`)
    - Anthropic: `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL`
    - Gemini: `GEMINI_API_KEY`
  - Keys can also go in the `env` block of `settings.json`.
  - Settings files: `~/.qwen/settings.json` and `.qwen/settings.json`.
  - https://github.com/QwenLM/qwen-code/blob/main/docs/users/configuration/auth.md ,
    https://github.com/QwenLM/qwen-code/blob/main/docs/users/configuration/settings.md
- **MCP client: yes.**
  - Config key `mcpServers`:
    - stdio: `command`, `args`, `cwd`, `env`
    - streamable HTTP: `httpUrl` + `headers`
    - SSE: `url` + `headers`
  - CLI: `qwen mcp add [--scope user] --transport http|sse|stdio <name> <url|cmd> [-e K=V]`, plus OAuth flags.
  - https://github.com/QwenLM/qwen-code/blob/main/docs/users/features/mcp.md
- **Custom base URL: yes.** `OPENAI_BASE_URL`, or `modelProviders.openai[]` entries with `id`, `baseUrl`, `envKey`.
  OpenRouter is named explicitly. https://github.com/QwenLM/qwen-code/blob/main/docs/users/configuration/auth.md
- **Headless:**
  - `qwen -p "<text>"` with `--output-format json|stream-json` (JSONL).
  - Resume: `--continue` / `--resume <sessionId>`. Sessions are stored as JSONL under `~/.qwen/projects/<cwd>/chats`.
  - ACP: `qwen --acp`.
  - `qwen serve` (v0.16-alpha): HTTP + SSE on `127.0.0.1:4170` through an ACP bridge; token via `QWEN_SERVER_TOKEN`.
  - SDKs: TypeScript, Python, Java.
  - https://github.com/QwenLM/qwen-code/blob/main/docs/users/features/headless.md ,
    https://github.com/QwenLM/qwen-code/blob/main/docs/users/integration-zed.md ,
    https://github.com/QwenLM/qwen-code/blob/main/docs/users/qwen-serve.md
- **Config-dir override:** `QWEN_HOME` (default `~/.qwen`: credentials, settings, memory, skills) and
  `QWEN_RUNTIME_DIR`. https://github.com/QwenLM/qwen-code/blob/main/docs/users/configuration/settings.md
- **License:** Apache-2.0. https://api.github.com/repos/QwenLM/qwen-code

## 11. Gemini CLI (google-gemini/gemini-cli)

- **What + category:** Google's open-source terminal coding agent. https://github.com/google-gemini/gemini-cli
  - **Status:** the CLI reference says "Gemini CLI was replaced by Antigravity CLI on June 18th, 2026" for unpaid
    and Google One users. https://geminicli.com/docs/cli/cli-reference/
- **Install + launch:** `npx @google/gemini-cli`, `npm install -g @google/gemini-cli` or `brew install gemini-cli`,
  then `gemini`. https://github.com/google-gemini/gemini-cli
- **Auth:**
  - Sign in with Google (OAuth); a Code Assist licence also needs `GOOGLE_CLOUD_PROJECT`.
  - Gemini API key: `GEMINI_API_KEY`.
  - Vertex AI: ADC, `GOOGLE_APPLICATION_CREDENTIALS`, or `GOOGLE_API_KEY` + `GOOGLE_GENAI_USE_VERTEXAI=true`;
    also `GOOGLE_CLOUD_LOCATION`.
  - `.env` lookup: the first `.env` found walking up from the cwd, then `~/.gemini/.env`.
  - The OAuth cache `~/.gemini/oauth_creds.json` is only mentioned in GitHub issues, not the docs (**unverified**).
  - https://geminicli.com/docs/get-started/authentication/ , https://github.com/google-gemini/gemini-cli/issues/6170
- **MCP client: yes.**
  - Config: `mcpServers` in `~/.gemini/settings.json` (user) or `.gemini/settings.json` (project).
  - Keys:
    - transport: `command` (stdio), `url` (SSE), `httpUrl` (streamable HTTP)
    - `args`, `env`, `cwd`, `headers`, `timeout`, `trust`, `oauth`
    - `authProviderType`: `dynamic_discovery` | `google_credentials` | `service_account_impersonation`
  - CLI: `gemini mcp add [-t stdio|sse|http] [-e K=V] [-H header] [-s user|project] <name> <commandOrUrl>`.
  - https://geminicli.com/docs/tools/mcp-server/
- **Custom base URL:** partial.
  - `GOOGLE_GEMINI_BASE_URL` and `GOOGLE_VERTEX_BASE_URL` move the Gemini and Vertex endpoints.
  - **No OpenAI-compatible provider is documented.**
  - https://geminicli.com/docs/reference/configuration
- **Headless:**
  - `-p/--prompt`, or a non-TTY stdin.
  - `-o/--output-format text|json|stream-json`. The JSONL events are `init`, `message`, `tool_use`, `tool_result`,
    `error`, `result`.
  - Exit codes: 0, 1, 42 (input error), 53 (turn limit).
  - `--approval-mode default|auto_edit|yolo|plan`.
  - Sessions: `-r/--resume latest|<index>`, `--list-sessions`.
  - SDK: **unverified**.
  - https://geminicli.com/docs/cli/headless/ , https://geminicli.com/docs/cli/cli-reference/
- **ACP: yes, as an agent:** `gemini --acp` (JSON-RPC over stdio; MCP server details arrive in `initialize`).
  - The reference table still lists the legacy `--experimental-acp` flag; PR #29371 fixes the reference.
  - https://geminicli.com/docs/cli/acp-mode/ , https://github.com/google-gemini/gemini-cli/pull/29371
- **Config-dir override:** `GEMINI_CLI_HOME` (root for user-level config and storage), and
  `GEMINI_CLI_SYSTEM_SETTINGS_PATH`. https://geminicli.com/docs/reference/configuration
- **License:** Apache-2.0. https://github.com/google-gemini/gemini-cli

## 12. OpenCode (sst/opencode → anomalyco/opencode)

- **What + category:** an open-source coding agent with a TUI, desktop app and IDE extension. The repo is now
  `anomalyco/opencode`. https://opencode.ai/docs/
- **Install + launch:** `curl -fsSL https://opencode.ai/install | bash`, `npm install -g opencode-ai` or
  `brew install anomalyco/tap/opencode`, then `opencode`. https://opencode.ai/docs/
- **Auth:**
  - Keys are added with `/connect` or `opencode auth login [-p provider] [-m method]` and stored in
    `~/.local/share/opencode/auth.json`.
  - Config values support `{env:VAR}` and `{file:path}` substitution.
  - https://opencode.ai/docs/providers/ , https://opencode.ai/docs/cli/ , https://opencode.ai/docs/config/
- **MCP client: yes.**
  - Config: the `mcp` key in `opencode.json`.
    - local: `{"type":"local","command":[...],"environment":{},"enabled","timeout"}`
    - remote: `{"type":"remote","url","headers":{...},"oauth","enabled","timeout"}`
  - OAuth is automatic (Dynamic Client Registration). Use `oauth:{clientId,clientSecret,scope}` for a pre-registered
    client, or `false` to switch it off.
  - CLI: `opencode mcp add|auth|list|logout|debug`. Tokens are stored in `~/.local/share/opencode/mcp-auth.json`.
  - Which remote transport is used (SSE or streamable HTTP) is **unverified**.
  - https://opencode.ai/docs/mcp-servers/
- **Custom base URL: yes.**
  - `provider.<id>.options.baseURL` on any provider.
  - A custom provider uses
    `{"npm":"@ai-sdk/openai-compatible","options":{"baseURL","apiKey":"{env:X}","headers"},"models":{...}}`.
  - OpenRouter is built in.
  - https://opencode.ai/docs/providers/
- **Headless:**
  - `opencode run`. Flags: `--format default|json`, `-c/--continue`, `-s/--session`, `-m/--model`, `--agent`,
    `--attach`, `-f/--file`.
  - `opencode serve`: an HTTP server, basic auth via `OPENCODE_SERVER_PASSWORD`.
  - `opencode acp`: ACP over stdio (nd-JSON).
  - SDK: `@opencode-ai/sdk` (`createOpencode()`, `createOpencodeClient()`; default `127.0.0.1:4096`).
  - https://opencode.ai/docs/cli/ , https://opencode.ai/docs/sdk/
- **Config-dir override:** `OPENCODE_CONFIG` (file), `OPENCODE_CONFIG_DIR` (directory), `OPENCODE_CONFIG_CONTENT`
  (inline JSON). An env var that moves the `auth.json` data dir is **unverified**. https://opencode.ai/docs/config/
- **License:** MIT. https://raw.githubusercontent.com/anomalyco/opencode/dev/LICENSE

## 13. Aider (Aider-AI/aider)

- **What + category:** an open-source pair-programming CLI with git integration. https://github.com/Aider-AI/aider
- **Install + launch:**
  - `python -m pip install aider-install && aider-install`, `curl -LsSf https://aider.chat/install.sh | sh`, or
    `pipx install aider-chat`.
  - Launch, e.g. `aider --model sonnet --api-key anthropic=<key>`.
  - https://aider.chat/docs/install.html
- **Auth:**
  - API keys only: `--api-key PROVIDER=KEY` (`AIDER_API_KEY`), `--openai-api-key`, `--set-env`.
  - OpenRouter: `OPENROUTER_API_KEY` with models named `openrouter/<provider>/<model>`. Since v0.80.0 aider offers
    to OAuth against OpenRouter when no model or keys are given.
  - Files: `.env` (git root, or `--env-file`), `.aider.conf.yml` (home → git root → cwd, later wins).
  - https://aider.chat/docs/config/options.html , https://aider.chat/docs/llms/openrouter.html ,
    https://raw.githubusercontent.com/Aider-AI/aider/main/HISTORY.md , https://aider.chat/docs/config/aider_conf.html
- **MCP client: no.** There are no MCP options, and HISTORY.md never mentions MCP.
  https://aider.chat/docs/config/options.html
- **Custom base URL: yes.** `OPENAI_API_BASE` + `OPENAI_API_KEY`, or `--openai-api-base`, with models named
  `openai/<model>`. https://aider.chat/docs/llms/openai-compat.html
- **Headless:**
  - Flags: `--message/-m`, `--message-file`, `--yes-always`, `--no-stream`, `--no-auto-commits`.
  - `--restore-chat-history` resumes a chat.
  - **No JSON output, no server/RPC mode, no ACP.**
  - Python API: `Coder.create(...).run("...")`, documented as "not officially supported".
  - https://aider.chat/docs/config/options.html , https://aider.chat/docs/scripting.html
- **Config-dir override:** no single env var; use `--config` and `--env-file` / `AIDER_ENV_FILE`.
  https://aider.chat/docs/config/options.html
- **License:** Apache-2.0. https://github.com/Aider-AI/aider

---

## 14. Agent Client Protocol (ACP)

- **What:** a standard protocol between editors/IDEs and coding agents.
  - Local agents use JSON-RPC over stdio. Remote agents over HTTP/WebSocket are work in progress.
  - It reuses MCP's JSON types where possible.
  - https://agentclientprotocol.com/overview/introduction
- **Spec + SDKs:**
  - Repo: `agentclientprotocol/agent-client-protocol`. Protocol v1 is stable; schemas are in `schema/v1` and
    `schema/v2`.
  - SDKs: Rust `agent-client-protocol`, TypeScript `@agentclientprotocol/sdk`, Python, Kotlin, Java.
  - https://github.com/agentclientprotocol/agent-client-protocol , https://agentclientprotocol.com/libraries/typescript
- **License:** Apache-2.0. https://github.com/agentclientprotocol/agent-client-protocol
- **Agents (40 listed):**
  - AgentPool, Augment Code, AutoDev, Blackbox AI, Bub (bub-acp-server)
  - **Claude Agent** via Zed's adapter `zed-industries/claude-agent-acp` (the old name claude-code-acp is gone)
  - Claw Orchestrator, Cline
  - **Codex CLI** via `agentclientprotocol/codex-acp`
  - Code Assistant, Construct, crow-cli, **Cursor**, Docker cagent, fast-agent, Factory Droid, fount, **Gemini CLI**
  - GitHub Copilot CLI
  - **Goose**, Hermes Agent, Junie, Kaagum, Kimi CLI, Kiro CLI, localharness, Minion Code, Mistral Vibe, OpenClaw,
    **OpenCode**, OpenHands
  - Pi (pi-acp), Poolside, Qoder CLI, **Qwen Code**, Raxol, siGit Code, Stakpak, stdio Bus, VT Code
  - **Aider is not listed.**
  - Also implementing ACP, from their own docs but outside this list: Letta Code (`@letta-ai/letta-acp`),
    Deep Agents (`dcode --acp`, listed in Zed's directory).
  - https://agentclientprotocol.com/overview/agents , https://docs.letta.com/platform/acp ,
    https://zed.dev/acp/agent/deepagents
- **Clients/editors (16 listed):**
  - **Zed** and **JetBrains**, both native
  - Neovim: CodeCompanion, agentic.nvim, avante.nvim, hermes.nvim
  - Emacs: agent-shell.el
  - VS Code: ACP Client, ACP Patchbay, ACP Pro, Multicoder, Poolside Assistant, Exo
  - Visual Studio: Poolside Assistant
  - Obsidian: Agent Client, Agent Console, Copilot for Obsidian, Obsidian Harness
  - Sublime Text, Qt Creator, Unity (two clients), Pulsar
  - Chrome ACP, ACP Sidebar, Anycode, Open Knowledge
  - https://agentclientprotocol.com/overview/clients

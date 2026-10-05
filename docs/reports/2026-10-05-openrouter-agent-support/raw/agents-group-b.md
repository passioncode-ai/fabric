# Agents, group B: auth, MCP, base URL, headless, profiles (raw input)

Fetched 2026-10-05 from official sites, docs and repositories. Every bullet names the URL it came from. "unverified" means no official page or source file confirmed the fact. "Source:" means the fact was read from the vendor's own repository or published npm bundle, not from a docs page. Where two official pages disagree, both are quoted.

---

## 1. Kilo Code (VS Code / JetBrains extension and Kilo CLI)

- **what:** an open-source coding agent. The CLI (`kilo`) is a TUI coding agent. The current VS Code extension is "built on the Kilo CLI" and ships as the pre-release version on the Marketplace. Category: CLI coding agent + IDE extension. The docs carry the banner "Kilo has been acquired by Anaconda". Sources: https://kilo.ai/docs/getting-started/installing, https://kilo.ai/docs/code-with-ai/platforms/cli-reference
- **install + launch:** `npm install -g @kilocode/cli`, then `kilo`. A `-baseline` build exists for CPUs without AVX. The extension installs from the VS Code Marketplace or Open VSX, or as a VSIX from GitHub Releases. JetBrains installation steps: unverified (the docs show a JetBrains tab but no content was retrievable). Sources: https://kilo.ai/docs/cli, https://kilo.ai/docs/getting-started/installing
- **auth:**
  - Kilo account sign-in through a browser flow (email, ChatGPT, Google, Apple, GitHub, GitLab, Discord, LinkedIn, Anaconda, SSO). A Kilo API key can be copied from app.kilo.ai, profile page. https://kilo.ai/docs/getting-started/setup-authentication
  - CLI: `/connect` inside the TUI. `kilo auth login [url] [-p provider] [-m method]`, `kilo auth list`, `kilo auth logout [provider]`. https://kilo.ai/docs/code-with-ai/platforms/cli-reference
  - BYOK through config, e.g. `"apiKey": "{env:OPENAI_API_KEY}"`. `{env:}` resolves only in trusted config: global `~/.config/kilo`, `KILO_CONFIG` / `KILO_CONFIG_CONTENT`, or MDM config. A project `kilo.json` cannot use `{env:VAR}`. https://kilo.ai/docs/code-with-ai/platforms/cli
  - Env overrides: `KILO_PROVIDER`; for the kilocode provider, `KILOCODE_<FIELD>` (e.g. `KILOCODE_MODEL`); for other providers, `KILO_<FIELD>` (e.g. `KILO_API_KEY` → `apiKey`). `KILO_ORG_ID` selects the organization for `kilo run`. https://kilo.ai/docs/code-with-ai/platforms/cli
  - Credential store: `auth.json`, "same credential store as VS Code". https://github.com/Kilo-Org/kilocode/blob/main/packages/kilo-docs/pages/ai-providers/edenai.md. Location in source: `path.join(global.data, "auth.json")`, where `data = $XDG_DATA_HOME/kilo`, i.e. `~/.local/share/kilo/auth.json` by default. https://github.com/Kilo-Org/kilocode/blob/main/packages/core/src/credential.ts, https://github.com/Kilo-Org/kilocode/blob/main/packages/core/src/global.ts
- **MCP client:** yes.
  - Config: the `"mcp"` key (not `mcpServers`) in `~/.config/kilo/kilo.json[c]` (global) or `./kilo.json[c]` / `./.kilo/kilo.json[c]` (project). https://kilo.ai/docs/automate/mcp/using-in-cli
  - Entry keys: `type: "local"` with `command` (array), `environment`, `enabled`, `timeout`; or `type: "remote"` with `url`, `headers`, `enabled`, `timeout`, `oauth`. https://kilo.ai/docs/automate/mcp/using-in-kilo-code
  - Transports: STDIO, Streamable HTTP (primary remote), SSE (deprecated). https://kilo.ai/docs/automate/mcp/using-in-kilo-code
  - CLI: `kilo mcp add [name] --url <url> --header KEY=VALUE --env KEY=VALUE`, `kilo mcp list`, `kilo mcp auth [name]` (OAuth), `kilo mcp logout`, `kilo mcp debug <name>`. https://kilo.ai/docs/code-with-ai/platforms/cli-reference
  - Remote headers: yes (`headers` key, `--header`).
- **base URL / OpenAI-compatible:** yes.
  - `provider.openai-compatible.options.baseURL` + `apiKey` + `models`. https://kilo.ai/docs/code-with-ai/agents/custom-models
  - A built-in OpenRouter provider exists (`provider.openrouter`, options forwarded as `providerOptions.openrouter`). https://kilo.ai/docs/ai-providers/openrouter
  - A local gateway works through openai-compatible `baseURL`, which is confirmed by the same page.
- **headless:**
  - `kilo run "msg"` with `--auto` (auto-approve), `--format json` (raw JSON events), `-c/--continue`, `-s/--session <id>`, `-m provider/model`, `--agent`, `--attach <url>` to a running server. Exit codes 0 / 124 timeout / 1. https://kilo.ai/docs/code-with-ai/platforms/cli-reference, https://kilo.ai/docs/cli
  - `kilo serve` is a headless HTTP server (`--port`, `--hostname`, default 127.0.0.1; basic auth via `KILO_SERVER_PASSWORD` / `KILO_SERVER_USERNAME`). https://kilo.ai/docs/code-with-ai/platforms/cli-reference
  - `kilo acp` is the ACP server. https://kilo.ai/docs/code-with-ai/platforms/cli-reference
  - `kilo export` / `kilo import` move sessions as JSON. https://kilo.ai/docs/code-with-ai/platforms/cli-reference
- **profiles / config dir:**
  - `KILO_CONFIG` (config file), `KILO_CONFIG_CONTENT` (inline config). https://kilo.ai/docs/code-with-ai/platforms/cli
  - `KILO_CONFIG_DIR` overrides the global config dir (source: `config: Flag.KILO_CONFIG_DIR ?? Path.config`). https://github.com/Kilo-Org/kilocode/blob/main/packages/core/src/global.ts, https://github.com/Kilo-Org/kilocode/blob/main/packages/core/src/flag/flag.ts
  - Credentials sit under the XDG data dir, not the config dir. Isolating an account therefore needs `XDG_DATA_HOME` as well (inferred from source, not documented).
  - `kilo profile` shows the Kilo account profile only; it is not a profile switcher. https://kilo.ai/docs/code-with-ai/platforms/cli-reference
- **license:** MIT (GitHub API `license.spdx_id`). https://github.com/Kilo-Org/kilocode

## 2. Cline (IDE extension, Cline CLI, SDK)

- **what:** an open-source coding agent shipped as an IDE extension, a CLI/TUI, Kanban, a desktop app and a TypeScript SDK. All share one harness and the global config in `~/.cline/`. Category: IDE ext + CLI coding agent + SDK. https://docs.cline.bot/getting-started/config, https://docs.cline.bot/sdk/overview
- **install + launch:** `npm i -g cline`, then `cline` (interactive) or `cline "task"`. `cline -i` opens the TUI. https://docs.cline.bot/usage/cli-overview, https://docs.cline.bot/cli/cli-reference
- **auth:**
  - Three paths: Cline (usage-billing), which is "sign in with Google/GitHub/email" through OAuth; ClinePass, a $9.99/month subscription; BYOK. https://docs.cline.bot/getting-started/authorizing-with-cline
  - CLI: `cline auth` (alias `cline a`) "runs the same auth flow as IDE setup". Per-run override: `-P/--provider <id>`, `-k/--key <api-key>`, `-m/--model`. Flags of `cline auth` itself: unverified. https://docs.cline.bot/cli/cli-reference
  - Subscription providers: "Claude Code" (uses the locally installed `claude` CLI and its Max/Pro login) https://docs.cline.bot/provider-config/anthropic; "OpenAI Codex" (browser OAuth with an OpenAI account) https://docs.cline.bot/provider-config/openai
  - Keys stored in `~/.cline/data/settings/providers.json`. https://docs.cline.bot/getting-started/config
  - Provider env vars for API keys: unverified (not documented).
- **MCP client:** yes.
  - CLI file: `~/.cline/mcp.json` (MCP page). The config page instead lists `~/.cline/data/settings/cline_mcp_settings.json`, and the CLI reference lists project `.cline/mcp.json`. The official pages disagree. https://docs.cline.bot/mcp/mcp-overview, https://docs.cline.bot/getting-started/config, https://docs.cline.bot/cli/cli-reference
  - Format: `mcpServers.<name>` with `command`, `args`, `env`, `disabled`, `autoApprove` (stdio), or `type: "streamableHttp"` / `"sse"`, `url`, `headers`. Omitting `type` defaults to legacy `sse`. https://docs.cline.bot/mcp/mcp-overview
  - CLI: `cline mcp` is an interactive wizard (list/add/edit/enable/disable/delete; asks for URL and headers for remote). Read-only listing: `cline config mcp [--json]`. https://docs.cline.bot/mcp/mcp-overview
  - Transports: stdio, Streamable HTTP (recommended), SSE (legacy). Remote headers: yes.
- **base URL / OpenAI-compatible:** yes.
  - "OpenAI Compatible" provider with Base URL + API Key + Model ID. https://docs.cline.bot/provider-config/openai-compatible
  - Native OpenRouter provider with an optional "Use custom base URL". https://docs.cline.bot/provider-config/openrouter
  - The documentation shows this in the settings UI. The CLI key or flag for base URL is unverified; the CLI reads the same `providers.json`.
- **headless:**
  - Headless activates with `--json`, piped stdin or redirected stdout. https://docs.cline.bot/usage/cli-overview
  - `--json` gives NDJSON (`type` ask/say, `text`, `ts`, `say`/`ask`, `reasoning`, `partial`). `--auto-approve <bool>` defaults to true outside ACP. Also `-p/--plan`, `-t/--timeout`, `--id <session-id>` (resume), `cline history`, `-z/--zen` (run in background hub). https://docs.cline.bot/cli/cli-reference
  - ACP: `cline --acp` over stdio for Zed, JetBrains, Neovim and others; auto-approve is off by default in ACP. https://docs.cline.bot/usage/acp
  - Local hub daemon at `CLINE_HUB_ADDRESS`, default `127.0.0.1:25463`. https://docs.cline.bot/cli/cli-reference
  - SDK: `npm install @cline/sdk` (`@cline/core`, `@cline/agents`, `@cline/llms`). https://docs.cline.bot/sdk/overview
- **profiles / config dir:**
  - `--config <path>` (default `~/.cline/data/settings`), `--data-dir <path>` ("isolated local state", default `~/.cline`), env `CLINE_DATA_DIR` ("replaces `~/.cline/data/`"). https://docs.cline.bot/cli/cli-reference, https://docs.cline.bot/getting-started/config
  - Also `CLINE_SANDBOX_DATA_DIR`, `CLINE_HOOKS_DIR`. https://docs.cline.bot/cli/cli-reference
- **license:** Apache-2.0 (GitHub API). https://github.com/cline/cline

## 3. Freebuff (Codebuff)

- **what:** "the only 100% free coding agent", with "powerful coding models, funded by ads". It is the rebranded Codebuff repository: the README of `CodebuffAI/codebuff` is titled "Freebuff" and says "Freebuff is built on Codebuff, the open multi-agent framework". Products: Desktop, CLI, Web, Cloud, Chat. Category: CLI coding agent (also a desktop app). https://freebuff.com/, https://github.com/CodebuffAI/codebuff (README)
- **install + launch:** `npm install -g freebuff`, then `freebuff` (Node 18+). Subcommand: `freebuff login`. https://freebuff.com/cli. Source: https://github.com/CodebuffAI/codebuff/blob/main/cli/src/cli-args.ts
- **auth:**
  - "No API key, no credit card" https://freebuff.com/
  - Login prints or opens a URL for browser sign-in, tied to a machine fingerprint. Source: https://github.com/CodebuffAI/codebuff/blob/main/cli/src/login/plain-login.ts
  - Credentials file: `<configDir>/credentials.json`, mode tightened to 0600. Default config dir is `~/.config/manicode`. Source: https://github.com/CodebuffAI/codebuff/blob/main/cli/src/utils/auth.ts, https://github.com/CodebuffAI/codebuff/blob/main/cli/src/utils/config-dir.ts
  - Free access is metered in "Freebucks"; text ads; prompts may be analysed to personalize ads. https://github.com/CodebuffAI/codebuff (README)
  - The Codebuff SDK uses `CODEBUFF_API_KEY`. https://github.com/CodebuffAI/codebuff/blob/main/sdk/README.md
- **MCP client:** yes.
  - `mcp.json` with `mcpServers`, loaded from `{cwd}/.agents/mcp.json`, `{cwd}/../.agents/mcp.json` and `~/.agents/mcp.json`. Repository-scoped files need consent or `--trust-agents`. Source: https://github.com/CodebuffAI/codebuff/blob/main/sdk/src/agents/load-mcp-config.ts, https://github.com/CodebuffAI/codebuff/blob/main/cli/src/cli-args.ts
  - Entry schema: `type: "stdio"` with `command`, `args`, `env` (`"$VAR"` resolved from the environment); or `type: "http" | "sse"` with `url`, `params`, `headers`. Source: https://github.com/CodebuffAI/codebuff/blob/main/common/src/types/mcp.ts
  - Remote headers: yes. CLI command to add a server: none (no `mcp` subcommand in cli-args.ts).
- **base URL / OpenAI-compatible:** no evidence. Models come from Freebuff's curated catalog over its own backend. Desktop can run locally installed Claude Code and Codex "using your existing provider account". Pointing it at OpenRouter or a gateway: unverified / not offered. https://github.com/CodebuffAI/codebuff (README)
- **headless:**
  - Freebuff CLI: none. It takes no prompt argument ("Freebuff: simplified CLI - no prompt args"). Flags: `--continue [conversation-id]`, `--cwd`, `--trust-agents`. Source: https://github.com/CodebuffAI/codebuff/blob/main/cli/src/cli-args.ts
  - Codebuff CLI takes a prompt plus `--agent`, `--lite`/`--max`/`--plan` (same file).
  - SDK: `@codebuff/sdk`. ACP: none found in the repository tree.
- **profiles / config dir:** `FREEBUFF_CONFIG_DIR` (must be an absolute path) replaces `~/.config/manicode`. Source: https://github.com/CodebuffAI/codebuff/blob/main/cli/src/utils/config-dir.ts
- **license:** GitHub repo Apache-2.0 (GitHub API). The npm package `freebuff` declares MIT, with repository `CodebuffAI/freebuff-private` (registry metadata, v0.2.15). https://github.com/CodebuffAI/codebuff, https://registry.npmjs.org/freebuff/latest

## 4. Command Code

- **what:** "the best coding agent for open models", a CLI-first terminal agent that learns the user's "taste" (`taste-1`). Org `CommandCodeAI` on GitHub (the former Langbase org; its repos are langbase-sdk, BaseAI and others). Category: CLI coding agent. The npm bundle also ships a VS Code extension (`vsix/commandcode-vscode.vsix`). https://commandcode.ai/, https://commandcode.ai/docs/llms.txt, https://github.com/CommandCodeAI
- **install + launch:** `npm i -g command-code@latest` (Node 22+), then `cmd` (`cmdc` on native Windows). https://commandcode.ai/docs/quickstart
- **auth:**
  - `cmd login` opens a browser ("Authorize"); alternatively paste an API key created in Studio. `cmd logout`, `cmd whoami`. Stored in `~/.commandcode/auth.json`. https://commandcode.ai/docs/quickstart, https://commandcode.ai/docs/reference/cli
  - Env `COMMAND_CODE_API_KEY` appears in the bundle (`COMMAND_CODE_API_KEY_ENV_VAR`) but not in the docs. Source: npm `command-code@1.74.1` `dist/`
  - BYOK does not need a Command Code login. https://commandcode.ai/docs/byok
- **MCP client:** yes. https://commandcode.ai/docs/mcp
  - `cmd mcp add --transport http <name> <url>`, `cmd mcp add <name> -- <command>`, `cmd mcp add-json <name> '<json>'`, `cmd mcp list`. Flags `--transport stdio|http`, `--scope local|project|user`, `--env KEY=value`, `--header "Header: value"` (HTTP only).
  - Files: local `~/.commandcode/projects/<slug>/mcp.json`, project `.mcp.json`, user `~/.commandcode/mcp.json`. Format: `mcpServers.<name>` with `type`, `url`, `headers`, `env`.
  - Transports: stdio, http; SSE not listed. OAuth 2.0 supported for HTTP servers. Remote headers: yes.
- **base URL / OpenAI-compatible:** yes.
  - `~/.commandcode/providers.json`: `baseURL`, `apiKey` (`"$ENV_VAR"`, `"{env:VAR}"`, `"!command"`, `false`), `api` = `openai-completions` | `openai-responses` | `anthropic-messages`, `models`.
  - Added through `/connect` (the llms.txt says "/providers add"); keys go to `~/.commandcode/auth.json` (0600); raw secrets in providers.json are rejected.
  - OpenRouter, Ollama, Vercel AI Gateway, Cloudflare AI Gateway and HF Router are named as working.
  - https://commandcode.ai/docs/byok
- **headless:**
  - `-p/--print [query]`, `--output-format text|json`, `--yolo`, `--permission-mode default|plan|accept-edits|yolo|dont-ask`, `--max-turns`, `-r/--resume [name]`, `-c/--continue`, `-m/--model`, `-w/--worktree`, `--list-models`. https://commandcode.ai/docs/reference/cli
  - ACP: `cmd acp` "Run as an Agent Client Protocol (ACP) agent over stdio (for Zed and other ACP clients)". This is in the bundle, not the docs. Source: npm `command-code@1.74.1` `dist/`
  - SDK: unverified.
- **profiles / config dir:** no documented override. A grep of the bundle found no config-dir env var; the dir name `.commandcode` is a constant. Only a `HOME` override would isolate it (inference).
- **license:** proprietary. npm `license: "UNLICENSED"`, no repository field. https://registry.npmjs.org/command-code/latest. The GitHub repo `CommandCodeAI/command-code` has no license (GitHub API `null`).

## 5. DeepSeek Harness (`dsh`)

- **what:** "an open-source agent harness developed by DeepSeek AI" with an "everything-is-a-plugin" architecture on Cordis; developer preview, "THERE WILL BE COMPATIBILITY-BREAKING CHANGES". Entry points: Web UI, Desktop (Electron), headless, ACP, SDK. Category: framework + agent (Web UI / desktop). https://github.com/deepseek-ai/deepseek-harness
- **install + launch:** `npx @deepseek-ai/dsh web`, which serves the Web UI at `http://127.0.0.1:3080` (`--no-open` to skip the browser). From source: `pnpm install && pnpm run build && pnpm dsh web`. Docs: https://deepseek-harness.github.io/deepseek-harness/. https://github.com/deepseek-ai/deepseek-harness
- **auth:**
  - API keys only. Settings → Models; the DeepSeek key is stored in `$DSH_HOME/.credentials.yaml`. "Providers that sign in with OAuth, such as Codex, are not supported here yet." https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/providers.md
  - Credential resolution order: inherited env, `$DSH_HOME/.credentials.yaml`, `./.env`, `$DSH_HOME/.env`. Search uses `DEEPSEEK_API_KEY`. A provider row can name `apiKeyEnv: <VAR>`. https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/cli/reference/README.md
  - The base bundle has "default-on DeepSeek session-log upload" and OTel upload (same file).
- **MCP client:** yes, through the plugin `@deepseek-ai/dsh-mcp-client`.
  - Configured as a Cordis YAML row: `name: '@deepseek-ai/dsh-mcp-client'`, `config: {serverName, transport: stdio, command, args, env, cwd}`; or `transport: streamable-http` with `url` and `headers`.
  - Lives in `$DSH_HOME/profiles/<name>/cordis.patch.yml`, `$DSH_HOME/cordis.patch.yml`, or a `dsh web --patch <file>` overlay. Tools appear as `mcp__<serverName>__<tool>`.
  - Transports: stdio, Streamable HTTP. SSE: not mentioned. Remote headers: yes.
  - https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/mcp-memory.md
- **base URL / OpenAI-compatible:** yes.
  - "Custom model API": Provider ID, base URL, API protocol `openai-completions` | `openai-responses` | `anthropic-messages`, credential, models.
  - YAML under `llm-pi-ai` → `providers.<id>` with `baseURL`, `api`, `apiKeyEnv`, `models`; headers, timeouts and retry are configurable in `cordis.patch.yml`.
  - Built-in catalog includes `anthropic`, `openai`, `moonshotai`, `zai`.
  - https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/providers.md
- **headless:**
  - `dsh --profile headless "job"` runs one fresh persisted session, prints only the final text on stdout (reasoning goes to stderr) and exits 0 on `completed`, else 1.
  - `dsh --profile acp` serves ACP over stdio. `dsh --profile sdk` serves JSON-RPC over stdio (used by the Python SDK wheel). `--resume <id>` belongs to the `tui` profile.
  - Structured JSON output for headless: unverified (plain text).
  - https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/cli/README.md, https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/cli/reference/README.md
- **profiles / config dir:** first-class profiles at `$DSH_HOME/profiles/<name>` (`dsh <name>`, `--profile`, `--from-default-profile`). `DSH_HOME` defaults to `~/.dsh` (log path stated as "`$DSH_HOME/logs/` (default `~/.dsh/logs/`)"). https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/cli/reference/README.md
- **license:** MIT (GitHub API + README). https://github.com/deepseek-ai/deepseek-harness

## 6. ZCode (Z.ai)

- **what:** "a full-featured Agentic Development Environment (ADE) designed for long-horizon tasks" with the first-party "ZCode Agent", tuned for GLM-5.3. Desktop app for macOS, Windows and Linux, v3.14.4. Category: desktop app. https://docs.z.ai/devpack/tool/zcode, https://zcode.z.ai/en/docs/install
- **install + launch:** download the .dmg / .exe / .AppImage / .deb / .rpm from the download page and launch the app. There is no CLI install. https://zcode.z.ai/en/docs/install
- **auth:**
  - First launch offers "Continue with Z.ai" or "Continue with BigModel" ("authorize and sign in" through a browser authorization flow; the GLM Coding Plan quota is used directly), or "Use API Key". Team Plan entries appear after sign-in. https://zcode.z.ai/en/docs/configuration
  - Coding Plan base URLs: OpenAI `https://api.z.ai/api/coding/paas/v4`, Anthropic `https://api.z.ai/api/anthropic`. https://docs.z.ai/devpack/tool/zcode
  - Provider config file: `~/.zcode/v2/config.json`; a provider's `options` recognise `apiKey`, `baseURL`, `apiKeyRequired`, `headers`. https://zcode.z.ai/en/docs/configuration
  - Env vars: unverified (none documented).
- **MCP client:** yes. https://zcode.z.ai/en/docs/mcp-services
  - Settings → MCP Servers → New MCP Server (form or full JSON), with scope User or Workspace. Can import servers from Claude Code or Codex CLI.
  - Files: User `~/.zcode/cli/config.json` → `mcp.servers`; Workspace `<root>/.zcode/config.json` → `mcp.servers`; also `~/.agents/mcp.json` and `<root>/.agents/mcp.json` → `mcpServers`.
  - Keys: `command`, `args`, `env`, `type`, `url`, `headers`, `enable`.
  - Transports: stdio, HTTP, SSE. Authorization header or OAuth for remote servers.
  - Note: the MCP page names `~/.zcode/cli/config.json` while the providers page names `~/.zcode/v2/config.json`. Both are official.
- **base URL / OpenAI-compatible:** yes. "Add Provider" for any Anthropic- or OpenAI-protocol service (name, base URL, key, model IDs). OpenRouter is documented with base URL `https://openrouter.ai/api`. https://zcode.z.ai/en/docs/configuration
- **headless:** none documented. Remote control goes through bots (WeChat, Feishu, Telegram) and mobile. ACP, SDK: unverified. https://zcode.z.ai/, https://zcode.z.ai/en/docs/agents
- **profiles / config dir:** unverified (no override documented).
- **license:** unverified. No public source repository was found; presumed proprietary.

## 7. Proto Agent (ERP•AI)

- **what:** "a desktop app from ERP•AI that does business work for you", "the agent console for finance, ops, HR, sales, and support". Electron, alpha, v0.2.122 (2026-09-29). Code-signed by Deskera Holdings Ltd. Category: desktop app (personal/business agent). https://proto.erp.ai/, https://github.com/erphq/proto-releases
- **install + launch:** download `Proto-aarch64.dmg` / `Proto-x64-setup.exe` / `Proto-x86_64.AppImage` from GitHub Releases and launch the app. The release also carries `neo-ai-cli.tgz` and `neo-ai-<ver>.tgz` assets; their purpose is unverified (not inspected, because the license forbids reverse engineering). https://github.com/erphq/proto-releases/releases
- **auth:** "Proto uses ERP•AI's managed AI plan by default". Alternatively "add your own key from a provider such as OpenAI, Anthropic, Google Gemini, OpenRouter, or Fireworks, or use Codex with a ChatGPT account" https://proto.erp.ai/. The README's first-run step is "paste an OpenRouter or Fireworks API key". Keys are stored locally ("your API keys … live on your machine"). https://github.com/erphq/proto-releases. File paths and env vars: unverified.
- **MCP client:** yes ("ERP, CRM, sheets, inboxes — connect over MCP"). https://github.com/erphq/proto-releases. Config path, format, transports and headers: unverified.
- **base URL / OpenAI-compatible:** OpenRouter as a key provider: yes (above). Custom base URL or local gateway: unverified. The README says "Works on Claude, Gemini, GLM, Llama, Ollama, and more", which suggests a local endpoint but documents no base-URL setting. https://github.com/erphq/proto-releases
- **headless:** unverified (none documented).
- **profiles / config dir:** unverified.
- **license:** proprietary, closed source: "may not be redistributed, modified, or reverse-engineered"; free during alpha. https://github.com/erphq/proto-releases, https://proto.erp.ai/

## 8. Strix (usestrix/strix)

- **what:** "open-source AI pentesting tool": autonomous multi-agent penetration testing in a Docker sandbox. There is also the managed Strix Cloud (app.strix.ai). Category: CLI security agent. https://github.com/usestrix/strix, https://strix.ai/
- **install + launch:** `curl -sSL https://strix.ai/install | bash` (PyPI package `strix-agent`), needs Docker. Run: `strix --target ./app-directory`. `strix view` opens a local web viewer on 127.0.0.1 with a tokened link. https://github.com/usestrix/strix
- **auth:**
  - API key via env `STRIX_LLM` (LiteLLM-style model id, e.g. `openrouter/z-ai/glm-5.3`) + `LLM_API_KEY`. https://github.com/usestrix/strix
  - Subscription: `strix auth login chatgpt` + `STRIX_LLM="chatgpt/gpt-5.4"`, `strix auth status` / logout. https://github.com/usestrix/strix
  - Cloud: `strix cloud login` (browser, "one credential per install"). https://github.com/usestrix/strix
  - Config persisted to `~/.strix/cli-config.json`. https://docs.strix.ai/advanced/configuration
- **MCP client:** yes.
  - `~/.strix/mcp-servers.json` holds a JSON list of `{name, transport: "stdio"|"http", command, args, url, auth: {kind: "bearer", token}, allowed_tools, notes}`.
  - Override with `--mcp-config <path>` or `STRIX_MCP_CONFIG`. Tools namespaced `<name>_<tool>`.
  - Transports: stdio, http; SSE not listed. Remote auth: only a bearer token via `auth`; arbitrary headers are not documented.
  - https://docs.strix.ai/integrations/mcp, https://github.com/usestrix/strix
- **base URL / OpenAI-compatible:** yes.
  - `LLM_API_BASE` (also `OPENAI_API_BASE`, `LITELLM_BASE_URL`, `OLLAMA_API_BASE`), `STRIX_API_TYPE` (chat completions vs responses), `LLM_EXTRA_HEADERS`.
  - OpenRouter is native (`openrouter/...`) and the default recommended route.
  - https://docs.strix.ai/advanced/configuration, https://docs.strix.ai/llm-providers/openrouter
- **headless:**
  - `-n/--non-interactive` with exit code 2 when vulnerabilities are found; `--fail-on <severity>`, `--scan-mode`, `--scope-mode diff --diff-base`, `--max-budget`, `--max-turns`, `--config <file>`.
  - Results are written to `strix_runs/<run-name>`. Sending a message resumes a budget-parked scan.
  - `strix cloud …` prints JSON when stdout is not a TTY or with `--json`.
  - ACP, SDK: none documented. Strix ships as skills for other agents: `npx skills add usestrix/strix`.
  - https://docs.strix.ai/usage/cli, https://github.com/usestrix/strix
- **profiles / config dir:** `--config <path>` replaces `~/.strix/cli-config.json`; `STRIX_MCP_CONFIG` for MCP. A dir-level override env var (e.g. `STRIX_HOME`): unverified (not documented). https://docs.strix.ai/usage/cli, https://docs.strix.ai/integrations/mcp
- **license:** Apache-2.0 (GitHub API + README badge). https://github.com/usestrix/strix

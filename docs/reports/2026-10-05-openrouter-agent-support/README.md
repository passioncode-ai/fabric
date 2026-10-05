---
report:
  id: fabric/2026-10-05-openrouter-agent-support
  aliases: [RPT-2026-10-05-openrouter-agents]
  title: "Supporting OpenRouter's top-30 agents in Fabric and Switchboard"
  kind: research
  project: fabric
  domains: [agents, integrations]
  as_of: 2026-10-05
  status: active
  valid_until: 2026-11-05
  summary: >-
    OpenRouter's daily app ranking (fetched 2026-10-05) is dominated by agent harnesses: 15 of the
    top 30 are agents. Hermes Agent alone has 18.9% of top-200 tokens. Fabric connects only Claude Code
    today, and Switchboard switches only Claude and Codex accounts. Eight of the top-30 agents speak the
    open Agent Client Protocol (ACP), whose session/new carries per-session MCP servers. The recommended
    move is one generic ACP runner driver plus a runner catalogue, with Hermes Agent as the first
    non-Claude connected runner.
  sources:
    - {name: "OpenRouter app ranking", url: "https://openrouter.ai/apps", read_at: 2026-10-05}
    - {name: "ACP session setup", url: "https://agentclientprotocol.com/protocol/session-setup", read_at: 2026-10-05}
    - {name: "ACP agents list", url: "https://agentclientprotocol.com/overview/agents", read_at: 2026-10-05}
    - {name: "ACP clients list", url: "https://agentclientprotocol.com/overview/clients", read_at: 2026-10-05}
    - {name: "Hermes Agent repo", url: "https://github.com/NousResearch/hermes-agent", read_at: 2026-10-05}
    - {name: "Hermes ACP", url: "https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/acp.md", read_at: 2026-10-05}
    - {name: "Hermes MCP config", url: "https://github.com/NousResearch/hermes-agent/blob/main/website/docs/reference/mcp-config-reference.md", read_at: 2026-10-05}
    - {name: "Hermes CLI commands", url: "https://github.com/NousResearch/hermes-agent/blob/main/website/docs/reference/cli-commands.md", read_at: 2026-10-05}
    - {name: "Hermes providers", url: "https://github.com/NousResearch/hermes-agent/blob/main/website/docs/integrations/providers.md", read_at: 2026-10-05}
    - {name: "Hermes profiles", url: "https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/profiles.md", read_at: 2026-10-05}
    - {name: "Claude Code headless", url: "https://code.claude.com/docs/en/headless", read_at: 2026-10-05}
    - {name: "Claude Code MCP", url: "https://code.claude.com/docs/en/mcp", read_at: 2026-10-05}
    - {name: "Claude Code LLM gateway", url: "https://code.claude.com/docs/en/llm-gateway", read_at: 2026-10-05}
    - {name: "Claude Code authentication", url: "https://code.claude.com/docs/en/authentication", read_at: 2026-10-05}
    - {name: "Codex non-interactive", url: "https://learn.chatgpt.com/docs/non-interactive-mode", read_at: 2026-10-05}
    - {name: "Codex config reference", url: "https://learn.chatgpt.com/docs/config-file/config-reference", read_at: 2026-10-05}
    - {name: "Codex app-server", url: "https://learn.chatgpt.com/codex/app-server", read_at: 2026-10-05}
    - {name: "Kilo CLI reference", url: "https://kilo.ai/docs/code-with-ai/platforms/cli-reference", read_at: 2026-10-05}
    - {name: "Kilo MCP in CLI", url: "https://kilo.ai/docs/automate/mcp/using-in-cli", read_at: 2026-10-05}
    - {name: "Cline CLI reference", url: "https://docs.cline.bot/cli/cli-reference", read_at: 2026-10-05}
    - {name: "Cline ACP", url: "https://docs.cline.bot/usage/acp", read_at: 2026-10-05}
    - {name: "Cline MCP", url: "https://docs.cline.bot/mcp/mcp-overview", read_at: 2026-10-05}
    - {name: "Freebuff / Codebuff", url: "https://github.com/CodebuffAI/codebuff", read_at: 2026-10-05}
    - {name: "oh-my-pi (omp)", url: "https://github.com/can1357/oh-my-pi/blob/main/docs/cli-reference.md", read_at: 2026-10-05}
    - {name: "Command Code CLI", url: "https://commandcode.ai/docs/reference/cli", read_at: 2026-10-05}
    - {name: "Command Code MCP", url: "https://commandcode.ai/docs/mcp", read_at: 2026-10-05}
    - {name: "pi coding agent CLI", url: "https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/cli.md", read_at: 2026-10-05}
    - {name: "DeepSeek Harness", url: "https://github.com/deepseek-ai/deepseek-harness", read_at: 2026-10-05}
    - {name: "OpenClaw ACP", url: "https://github.com/openclaw/openclaw/blob/main/docs/cli/acp.md", read_at: 2026-10-05}
    - {name: "OpenClaw MCP", url: "https://github.com/openclaw/openclaw/blob/main/docs/cli/mcp.md", read_at: 2026-10-05}
    - {name: "OpenHands CLI headless", url: "https://docs.openhands.dev/openhands/usage/cli/headless.md", read_at: 2026-10-05}
    - {name: "OpenHands CLI MCP", url: "https://docs.openhands.dev/openhands/usage/cli/mcp-servers.md", read_at: 2026-10-05}
    - {name: "ZCode MCP", url: "https://zcode.z.ai/en/docs/mcp-services", read_at: 2026-10-05}
    - {name: "Proto releases", url: "https://github.com/erphq/proto-releases", read_at: 2026-10-05}
    - {name: "Strix MCP", url: "https://docs.strix.ai/integrations/mcp", read_at: 2026-10-05}
    - {name: "Cursor CLI headless", url: "https://cursor.com/docs/cli/headless", read_at: 2026-10-05}
    - {name: "Cursor CLI ACP", url: "https://cursor.com/docs/cli/acp", read_at: 2026-10-05}
    - {name: "Zed external agents", url: "https://zed.dev/docs/ai/external-agents", read_at: 2026-10-05}
    - {name: "Zed MCP", url: "https://zed.dev/docs/ai/mcp", read_at: 2026-10-05}
    - {name: "CodeGPT MCP", url: "https://docs.codegpt.co/docs/tutorial-features/mcp", read_at: 2026-10-05}
    - {name: "Letta CLI headless", url: "https://docs.letta.com/platform/cli/headless", read_at: 2026-10-05}
    - {name: "Letta ACP", url: "https://docs.letta.com/platform/acp", read_at: 2026-10-05}
    - {name: "HackerAI", url: "https://github.com/hackerai-tech/hackerai", read_at: 2026-10-05}
    - {name: "Deep Agents Code CLI", url: "https://docs.langchain.com/oss/deepagents/code/cli-reference", read_at: 2026-10-05}
    - {name: "Fabric baseline", url: "https://github.com/passioncode-ai/fabric/tree/08eafb4b", read_at: 2026-10-05}
    - {name: "Switchboard baseline", url: "https://github.com/passioncode-ai/fabric-switchboard/tree/a20c4ce", read_at: 2026-10-05}
  produced_by: {agent: "Claude Code (Opus 5.5)", task: "OpenRouter top-30 agent support research"}
  supersedes: []
  consumers: [fabric, fabric-switchboard, fabric-agent-adapter]
---

# Supporting OpenRouter's top-30 agents in Fabric and Switchboard

**The question.** The operator wants Fabric and Fabric Switchboard to support the most popular agents
on OpenRouter's global app ranking. This report covers what is on that list, what each agent exposes
to a host, what Fabric and Switchboard support today, and what to build first.

**Baselines.**
- Fabric is read at `08eafb4b` (main, 2026-10-05).
- Switchboard is read at `a20c4ce` (main, 2026-10-05). The research first read `ba2c0ac`, a work-in-progress branch
  (`agent/other-agents`) built on `a20c4ce`; every Switchboard line cited below is identical at both (checked with
  `git show` line by line), so the public commit is cited.
- The ranking was fetched 2026-10-05T11:32:39Z.
- Raw data is in [`raw/`](raw/):
  - [`raw/fetched_at.txt`](raw/fetched_at.txt): fetch receipt and sha256.
  - [`raw/apps.html`](raw/apps.html): the page as fetched.
  - [`raw/apps.data.json`](raw/apps.data.json): the decoded ranking object.
  - [`raw/ranking-day-top200.csv`](raw/ranking-day-top200.csv), plus `-week-` and `-month-` variants.
  - Per-agent fact sheets with a URL on every bullet: [`raw/agents-group-a.md`](raw/agents-group-a.md),
    [`raw/agents-group-b.md`](raw/agents-group-b.md), [`raw/agents-group-c.md`](raw/agents-group-c.md).
  - [`raw/hermes-acp.txt`](raw/hermes-acp.txt): a verbatim copy of Hermes' ACP doc.

## 1. Answer first

1. **The ranking is mostly agent harnesses.** 15 of the daily top 30 are agents or agent harnesses.
   The leader is **Hermes Agent at 18.9%** of top-200 daily tokens. Then come Kilo Code 11.5%,
   Claude Code 10.7%, Cline 9.85%, Freebuff 7.74%, omp 7.6% and Codex 4.96%. The other 15 are chat,
   roleplay, games, frameworks or SaaS ([§2](#2-the-ranking)).
2. **Fabric connects exactly one of them, Claude Code.** Fabric launches Claude Code and Codex in a PTY.
   Only Claude Code gets Fabric's tools, through `--mcp-config` ([§4](#4-fabric-today)).
3. **Switchboard knows exactly two providers.** `Provider { Claude, Codex }`
   ([§5](#5-switchboard-today)).
4. **The cheapest broad path is ACP.** The Agent Client Protocol's `session/new` carries the session's
   `mcpServers`, HTTP headers included ([ACP session setup](https://agentclientprotocol.com/protocol/session-setup)).
   That is the same per-session, strict-MCP shape Fabric already uses for Claude Code.
   - Natively ACP: Hermes, Kilo, Cline, omp, OpenClaw, OpenHands and Cursor.
   - Through a listed adapter: pi.
   - Together that is **43.8% of top-200 daily tokens**, on top of the 15.7% that Claude Code and
     Codex already cover.
   - One ACP driver plus catalogue rows reaches all of them ([§7](#7-the-plan)).
5. **Hermes Agent is the right first non-Claude runner.**
   - It is #1 by share, MIT-licensed, and has `hermes acp`.
   - It registers MCP servers that the host sends in `session/new` (`raw/hermes-acp.txt:59-60`).
   - Its `HERMES_ACP_SKIP_CONFIGURED_MCP=1` is the equivalent of Claude's `--strict-mcp-config`
     (`raw/hermes-acp.txt:325-337`).
   - The concrete plan is in [§8](#8-running-fabrics-harness-on-hermes-agent).

## 2. The ranking

**How it was fetched.**
- The page is server-rendered. The ranking object `{popular, trending, leaderboards, globalRankingMap}`
  was decoded from the `self.__next_f` RSC payload of `https://openrouter.ai/apps`
  (receipt: `raw/fetched_at.txt`).
- `globalRankingMap` holds 200 apps each for `day`, `week` and `month`.
- The page's own JSON-LD calls the default view "Daily global app ranking" and lists the first 20
  (`raw/apps.html`).

**How to read the numbers.**
- **Share** is an app's tokens divided by the sum over the listed top 200. It is not a share of all
  OpenRouter traffic.
- **The `rank` field skips 1, 8, 12, 16, 18, 24 and 33 in the daily list** (`raw/apps.data.json`). The
  table below uses list position. The gaps most likely belong to apps that are not shown publicly.
  That is an inference: OpenRouter does not say.
- **The top of the list is stable across periods.** The same leaders appear in the weekly and monthly
  views. Hermes' share grows with the window: 18.9% daily, 20.05% weekly, 24.42% monthly
  (`raw/ranking-*-top200.csv`).

**Columns.**
- **ACP:** whether the agent speaks the Agent Client Protocol.
- **Fabric:** `C` = connected runner, `P` = launched but not connected, `—` = absent.
- **Switchboard:** `Y` = provider supported.
- **Tier:** the proposed priority, defined in [§7.1](#71-tiers-popularity--feasibility).
- **Category:** OpenRouter's own tags in parentheses, then this report's classification.

| # | App | Category | Day share | MCP client | Headless / drive | ACP | Fabric | Switchboard | Tier |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Hermes Agent | (personal-agent, cli-agent) personal agent + CLI | 18.90% | yes, `~/.hermes/config.yaml` `mcp_servers` | `hermes -z`, `chat -q --format stream-json` | `hermes acp` | — | — | **1** |
| 2 | Kilo Code | (cli-agent, ide-extension) | 11.50% | yes, `kilo.json` `mcp` | `kilo run --auto --format json`, `kilo serve` | `kilo acp` | — | — | **1** |
| 3 | Claude Code | (cli-agent) | 10.70% | yes, `.mcp.json`, `--mcp-config` | `-p --output-format stream-json` | adapter only | **C** | **Y** | 0 |
| 4 | Cline | (ide-extension, cli-agent) | 9.85% | yes, `mcpServers` (path disputed) | `--json` NDJSON | `cline --acp` | — | — | **1** |
| 5 | Freebuff | (untagged) ad-funded CLI coding agent (ex-Codebuff) | 7.74% | yes, `.agents/mcp.json` | **none** (no prompt argument) | no | — | — | 3 |
| 6 | omp (oh-my-pi) | (cli-agent) | 7.60% | yes, `~/.omp/agent/mcp.json` | `-p`, `--mode json\|rpc` | `omp acp` | — | — | **1** |
| 7 | Codex | (cli-agent) | 4.96% | yes, `config.toml` `[mcp_servers]` | `exec --json`, `app-server` | adapter (`codex-acp`) | **P** | **Y** | 0 |
| 8 | Command Code | (programming-app, cli-agent, …) | 3.98% | yes, `cmd mcp add` | `-p --output-format json` | `cmd acp` (in bundle, not in docs) | — | — | 2 |
| 9 | pi | (cli-agent) | 3.70% | yes, `~/.pi/agent/mcp.json` | `-p`, `--mode json\|rpc` | adapter `pi-acp` | — | — | **1** |
| 10 | DeepSeek Harness | (untagged) harness: web/desktop, developer preview | 2.65% | yes, plugin `dsh-mcp-client` | `dsh --profile headless` (text) | `--profile acp` | — | — | 2 |
| 11 | OpenClaw | (personal-agent, cli-agent) | 1.82% | yes, `openclaw.json` `mcp.servers` | `agent exec --json` (envelope) | `openclaw acp` | — | — | **1** |
| 12 | OpenHands | (cli-agent) | 1.34% | yes, `~/.openhands/mcp.json` | `--headless --json` JSONL | `openhands acp` | — | — | **1** |
| 13 | ZCode | (programming-app) desktop ADE | 1.03% | yes, `~/.zcode/cli/config.json` | none documented | unverified | — | — | 3 |
| 14 | Proto Agent | (personal-agent, …) desktop business agent | 0.90% | yes (details unverified) | unverified | unverified | — | — | 3 |
| 15 | LangChain | (untagged) framework; `dcode` CLI | 0.83% | yes (`MCPAdapter`; `dcode` `.mcp.json`) | `dcode -n -q` | `dcode --acp` | — | n/a | 2 |
| 16 | ISEKAI ZERO | (game) roleplay adventures | 0.79% | n/a | n/a | n/a | n/a | n/a | — |
| 17 | Lemonade | (programming-app) AI tool for Roblox games | 0.77% | n/a | n/a | n/a | n/a | n/a | — |
| 18 | HighLevel | (untagged) CRM/marketing SaaS | 0.57% | n/a | n/a | n/a | n/a | n/a | — |
| 19 | Nous Research API | (general-chat) API/chat; Hermes' Nous Portal provider | 0.42% | n/a | n/a | n/a | n/a | n/a | — |
| 20 | Hello Minds (Ethoswarm) | (roleplay, personal-agent, creative-writing) | 0.40% | n/a | n/a | n/a | n/a | n/a | — |
| 21 | Strix | (cli-agent) security / pentest agent | 0.35% | yes, list format, bearer token only | `strix -n` (exit 2 = findings) | no | — | — | 2 |
| 22 | Cursor | (programming-app, cli-agent) | 0.33% | yes, `~/.cursor/mcp.json` | `agent -p --output-format stream-json` | `agent acp` | — | — | **1** |
| 23 | Janitor AI | (roleplay) | 0.33% | n/a | n/a | n/a | n/a | n/a | — |
| 24 | Zed Editor | (programming-app) editor; ACP **client** | 0.32% | yes, `context_servers` | none | client | — | — | 3 |
| 25 | Aura.agent2.verification_observation_agent | (untagged) unidentified; origin `geniusplugin.vercel.app`, no description | 0.29% | unknown | unknown | unknown | — | — | — |
| 26 | CodeGPT | (ide-extension, cli-agent, cloud-agent) IDE only | 0.28% | yes (stdio documented) | none | no | — | — | 3 |
| 27 | Descript | (video-gen) video/podcast editor | 0.27% | n/a | n/a | n/a | n/a | n/a | — |
| 28 | Craft | (roleplay, game, …) AI RPGs | 0.23% | n/a | n/a | n/a | n/a | n/a | — |
| 29 | Letta | (cli-agent, cloud-agent) stateful agent CLI/platform | 0.22% | partial (SDK yes; CLI `/mcp`, path unverified) | `letta -p --output-format stream-json` | adapter `letta-acp` | — | — | 2 |
| 30 | HackerAI | (untagged) pentest web/desktop app | 0.20% | unverified | none (local client only executes) | no | — | — | 3 |

Receipts for each row:
- **Categories, descriptions and shares:** `raw/apps.data.json` and `raw/ranking-day-top200.csv`.
- **Capability cells:** the agent's section in `raw/agents-group-{a,b,c}.md`, each bullet with its doc URL.
- **The ACP column:** [agentclientprotocol.com/overview/agents](https://agentclientprotocol.com/overview/agents),
  plus each agent's own ACP doc as cited in the raw files. One exception: Command Code's `cmd acp` is
  read from its npm bundle 1.74.1, not from its docs (`raw/agents-group-b.md` §4).

**Names the operator expected, below the top 30** (daily list position, `raw/ranking-day-top200.csv`):

| Agent | Daily position | Note |
|---|---|---|
| goose | 37 | |
| Roo Code | 53 | **shut down; repository archived 2026-05-15** (`raw/agents-group-c.md` §8) |
| Crush | 54 | |
| Qwen Code | 63 | |
| Factory Droid | 107 | |
| Continue | 132 | |
| AiderDesk | 150 | |
| OpenCode, Gemini CLI, Aider, Windsurf | — | not in the top 200 at all |

These agents mostly route models through their own backends or vendors rather than through OpenRouter.
The ranking measures OpenRouter traffic, not overall popularity. Several of them (goose, Qwen Code,
Gemini CLI, OpenCode) speak ACP, so the same driver covers them at near-zero extra cost
(`raw/agents-group-c.md` §7, §10–12).

## 3. What each agent exposes to a host

This table covers the agents only. Every cell is backed by a URL in the named raw file and section.

| Agent | Auth model | Config-dir / profile override (for account isolation) | Model base-URL override | License | Raw |
|---|---|---|---|---|---|
| Hermes Agent | OAuth (Nous Portal, ChatGPT/Codex, Copilot, Anthropic Max with extra credits, OpenRouter PKCE) or keys in `~/.hermes/.env`; tokens in `~/.hermes/auth.json` | `HERMES_HOME`; `hermes profile` and `-p` (OAuth refresh tokens are single-use, so profiles share the root `auth.json` unless re-logged in) | `model.provider: custom` + `model.base_url`; OpenRouter built in | MIT | A §1 |
| Kilo Code | Kilo account (browser) or BYOK; `~/.local/share/kilo/auth.json` | `KILO_CONFIG_DIR` / `KILO_CONFIG`; credentials follow `XDG_DATA_HOME` (from source) | `provider.openai-compatible.options.baseURL`; OpenRouter built in | MIT | B §1 |
| Claude Code | `/login` OAuth (Keychain) or `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN` / `CLAUDE_CODE_OAUTH_TOKEN` | `CLAUDE_CONFIG_DIR` (the official multi-account recipe) | `ANTHROPIC_BASE_URL`, **Anthropic Messages format only**; non-Claude models are not supported | proprietary | A §2 |
| Cline | Cline account, ClinePass, Claude Code or Codex subscription, BYOK; `~/.cline/data/settings/providers.json` | `CLINE_DATA_DIR`, `--data-dir`, `--config` | OpenAI Compatible provider; OpenRouter with a custom base URL (UI; CLI key unverified) | Apache-2.0 | B §2 |
| Freebuff | browser login, no API key; `~/.config/manicode/credentials.json` | `FREEBUFF_CONFIG_DIR` | no (its own catalogue) | Apache-2.0 repo / MIT npm | B §3 |
| omp | OAuth (Anthropic, Codex, Copilot, Cursor, …) or env keys | `--profile` / `OMP_PROFILE`, `PI_CODING_AGENT_DIR` | `~/.omp/agent/models.yml` `baseUrl` + `api` | MIT | A §7 |
| Codex | ChatGPT OAuth or API key; `auth.json` or keyring | `CODEX_HOME` (`--profile` layers config only; it is not a separate login) | `openai_base_url` / `[model_providers]`, **Responses API only** | Apache-2.0 | A §3 |
| Command Code | `cmd login` (browser) or API key; `~/.commandcode/auth.json` | **none**; only a `HOME` override would isolate it | `~/.commandcode/providers.json` `baseURL` + `api` | proprietary | B §4 |
| pi | `/login` OAuth (Claude, ChatGPT, Copilot, OpenRouter) or env; `~/.pi/agent/auth.json` | `PI_CODING_AGENT_DIR` | `models.json` `baseUrl` + `api` | MIT | A §6 |
| DeepSeek Harness | API keys only; `$DSH_HOME/.credentials.yaml`; **session logs upload to DeepSeek by default** | `DSH_HOME` + named profiles | custom provider `baseURL`, `api` | MIT | B §5 |
| OpenClaw | OAuth (Codex, Claude CLI reuse, OpenRouter) or `~/.openclaw/.env` | `OPENCLAW_HOME`, `OPENCLAW_STATE_DIR`, `--profile` | `models.providers.<id>.baseUrl` | MIT | A §4 |
| OpenHands | `openhands login` (Cloud) or `LLM_API_KEY`; `~/.openhands/agent_settings.json` | not documented (source reads `OPENHANDS_PERSISTENCE_DIR`) | `LLM_BASE_URL` (LiteLLM) | MIT | A §5 |
| ZCode | Z.ai / BigModel browser sign-in or API key | unverified | Add Provider (OpenAI or Anthropic protocol) | unverified | B §6 |
| Strix | `STRIX_LLM` + `LLM_API_KEY`, `strix auth login chatgpt` | `--config` only | `LLM_API_BASE` | Apache-2.0 | B §8 |
| Cursor CLI | `agent login` or `CURSOR_API_KEY` | `CURSOR_CONFIG_DIR` (whether credentials move with it is unverified) | no | proprietary (unverified) | C §1 |
| Letta Code | Letta OAuth, `LETTA_API_KEY`, BYOK | `LETTA_LOCAL_BACKEND_DIR` (partial) | `/connect` adds OpenAI-compatible endpoints | Apache-2.0 | C §4 |
| Deep Agents `dcode` | keys in `~/.deepagents/.env`, ChatGPT login | `DEEPAGENTS_HOME` | `[models.providers] base_url` | MIT | C §6 |

## 4. Fabric today

All evidence below is at `08eafb4b`.

**The runner list is a static array of three.** `AGENTS` in
`apps/desktop/src/shared/agents.ts:108-177` holds:
- `claude-code`: `connectsToSurface: true`, `surfaceAdapter: 'mcp-config-flag'`, `resultChannel: 'surface'`.
- `codex`: `surfaceAdapter: 'none'`, `resultChannel: 'none'`.
- `shell`.

The adapter type is `SurfaceAdapter = 'mcp-config-flag' | 'none' | 'unimplemented'` (`agents.ts:67`).
`unimplemented` exists so that a declared agent "refuses rather than quietly borrowing the flags of
whoever went first" (`agents.ts:62-66`).

**How a session starts.**
- Every session is an interactive PTY: `node-pty` spawn of `program` with bundle args
  (`apps/desktop/src/main/pty.ts:326-337`).
- For Claude Code, the bundle compiler writes a 0600 `mcp.json` holding the Fabric surface URL and a
  one-shot `Authorization: Bearer` header (`apps/desktop/src/main/sessionBundle.ts:144-172`).
- It then passes `--mcp-config … --strict-mcp-config --append-system-prompt …`
  (`sessionBundle.ts:221-243`). Fabric never writes into an agent's own config.

**Codex has a headless backend, but it is not wired into a session.**
- ADR-0081 builds an owned `codex app-server --listen ws://127.0.0.1:0 --ws-auth capability-token`
  under `sandbox-exec` with a private `CODEX_HOME` (`apps/desktop/src/main/codexLoopback.ts:98-99`;
  `docs/adr/0081-codex-execution-uses-an-owned-authenticated-loopback-backend.md`).
- It is not wired into session launch.

**Detection, auth and quota cover only these two.**
- Install commands exist only for `claude-code` and `codex` (`apps/desktop/src/main/executorDetect.ts:61-64`).
- Detection is filtered to those two ids (`apps/desktop/src/main/index.ts:3230`).
- Auth readers are pinned to `claude auth status --json` 2.1.289 and `codex login status` 0.160.0
  (`apps/desktop/src/main/executorAuth.ts:9-12`).
- Quota is read only from the Claude Code Keychain item (`apps/desktop/src/main/quota.ts:39`).
- Routines block when quota is null (`apps/desktop/src/main/routineTick.ts:39-40`). **An unattended
  routine on any other agent is therefore blocked by construction** until a per-runner quota policy exists.

**Several places assume Claude Code by default.**
- A chain follower falls back to `'claude-code'` (`apps/desktop/src/main/chainAdvance.ts:448`).
- The execution binding's provider union is `'claude-code' | 'codex-cli'`
  (`apps/desktop/src/shared/providerExecution.ts:16`).

**The hub admits any external MCP client.**
- `hub.json` (`fabric-hub/0.1`, default port 47070) plus a door token lets any local MCP client
  request access (`apps/desktop/src/main/hub.ts`; ADR-0115).
- The agent must discover `hub.json` itself (`docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md`).
- Every top-30 agent with an HTTP MCP client and headers could use it today. Nothing teaches them to.

**Multi-agent support is already the documented intent.**
- ADR-0021 names the `local_harness` placement for "Claude Code, Codex, OpenCode, Kilo, Pi, Goose or a
  DeepSeek/Kimi-based conforming client" (`docs/adr/0021-execution-placement-is-declared-per-provider-binding.md:15-18`).
- The agent-registry spec defines a **runner catalogue** `registry/runners.json`
  (`docs/evidence/specs/2026-09-29-agent-registry-design.md:57-59`):
  - drive modes `claude-headless`, `codex-app-server`, `codex-exec`, `acp`;
  - a config home, an MCP config location and format, and a skills directory per runner.
- The same spec says "Fabric writes its MCP entry … into each runner's config from the runner
  catalogue" (`:93-97`).
- **`registry/runners.json` does not exist.** `registry/` holds only `domains.yaml` and `README.md`.
- `docs/architecture/external-contracts.md:270` leaves the headless interfaces of Cursor and OpenClaw
  as open question 4. §3 above answers it: both have them (`agent -p --output-format stream-json`;
  `openclaw agent exec --json`), and both have ACP.

**No ADR pins Claude Code as the only harness.**
- `docs/architecture/harness-runtime.md:16` records that only Claude Code's MCP configuration is implemented.
- `harness-runtime.md:48` admits a provider on proven capability, "not presence in a list".
- `CONTEXT.md:181-188` defines "Coding agent" as Claude Code and Codex. Its *connected* is a static
  flag, not a measurement.

**There is no model or base-URL routing.** `ANTHROPIC_BASE_URL` is deliberately not stripped
(`apps/desktop/src/shared/authResolution.ts:51-55`). There is no OpenRouter or LLM-wallet code
(the codebase map grepped `src/` for both).

## 5. Switchboard today

**Two providers, no shared abstraction.**
- `Provider { Claude, Codex }` (`crates/switchboard-core/src/lib.rs:44-47`).
- `AuthKind { ApiKey, SetupToken, OAuth }` (`lib.rs:59-65`).
- There is no provider trait. Behaviour sits in `match` arms across `credential.rs`, `projects.rs`,
  `rotation.rs` and `launch.rs`.

**How it isolates and routes accounts.**
- **Isolation:** each login gets a fresh `CLAUDE_CONFIG_DIR` or `CODEX_HOME`
  (`crates/switchboard-runtime/src/launch.rs:442-448`).
- **Managed routing:**
  - Claude gets `ANTHROPIC_BASE_URL` pointed at the local proxy plus a local `ANTHROPIC_AUTH_TOKEN`.
  - Codex gets a `[model_providers.switchboard]` block with `base_url=…/v1` (`launch.rs:888-904`).
  - The proxy speaks only Anthropic `messages` and OpenAI `responses` upstreams.
- **MCP:** Switchboard registers its own MCP server into both CLIs (`crates/switchboard-runtime/src/agents.rs:62-65`).

**The docs scope it to these two.** `README.md:5` says Claude Code and Codex; `docs/SPEC.md:12` says
"Provider | Claude Code, Codex CLI | provider adapters". No roadmap item names Hermes, Kilo, Cline,
OpenCode, Gemini or OpenRouter keys (grep across the repository, per the codebase map).

## 6. Support matrix: what support would mean

**Three distinct things are meant by "support"**, and each has its own cost.

- **(A) Reach Fabric.** The agent, running anywhere, can call Fabric's tools.
  - Path 1: an MCP client entry pointing at the hub (ADR-0115 door token).
  - Path 2: Fabric injects its surface per session.
- **(B) Be Fabric's runner/harness.** Fabric starts the agent for a Project Agent binding, a routine or
  a chain step, then gets its tools to it, its result back, stop, resume and a receipt.
- **(C) Switch accounts.** Switchboard holds several identities and launches the CLI with one of them.
  - Isolated: a config-dir env var.
  - Managed: a base-URL proxy.

| Agent | (A) Reach Fabric: mechanism | (B) Runner: best drive mode | (C) Switchboard: isolation handle | Blockers / caveats |
|---|---|---|---|---|
| Hermes | ACP `session/new` mcpServers; or a `mcp_servers` YAML entry with `headers` | ACP (`hermes acp`); fallback `chat -q --format stream-json` | `HERMES_HOME` / profiles | single-use OAuth refresh tokens across profiles; ACP bridge permissions ([§8](#8-running-fabrics-harness-on-hermes-agent)) |
| Kilo Code | ACP; or `kilo mcp add --url --header` | ACP (`kilo acp`); fallback `kilo run --format json` | `KILO_CONFIG_DIR` + `XDG_DATA_HOME` | credential location inferred from source |
| Claude Code | **done** (`--mcp-config --strict-mcp-config`) | PTY today; owned stdio/`-p` built but not wired | `CLAUDE_CONFIG_DIR` (**done**) | none new |
| Cline | ACP; or a `mcpServers` entry | ACP (`cline --acp`; auto-approve is off in ACP); fallback `--json` | `CLINE_DATA_DIR` | three disputed MCP file paths, so prefer ACP injection |
| Freebuff | `.agents/mcp.json` entry (http + headers) | PTY only (no prompt argument, no headless) | `FREEBUFF_CONFIG_DIR` | ad-funded; prompts may be analysed for ads (`raw/agents-group-b.md` §3) |
| omp | ACP; or `.omp/mcp.json` | ACP (`omp acp`); fallback `--mode rpc` | `OMP_PROFILE` | none known |
| Codex | `[mcp_servers]` with `bearer_token_env_var` in the private `CODEX_HOME` | owned `app-server` (built, ADR-0081, N1 pending) | `CODEX_HOME` (**done**) | Responses-API-only base URL |
| Command Code | `cmd mcp add --transport http --header` | `-p --output-format json`; ACP undocumented | **none**; `HOME` override only | proprietary; ACP must be probed |
| pi | ACP via `pi-acp`; or `pi mcp add --url --bearer-token-env-var` | `--mode rpc` (native) or `pi-acp` | `PI_CODING_AGENT_DIR` | adapter is third-party |
| DeepSeek Harness | ACP; or `dsh-mcp-client` YAML row | ACP (`--profile acp`) | `DSH_HOME` / profiles | **default-on session-log upload to DeepSeek**; developer preview with breaking changes |
| OpenClaw | ACP; or `openclaw mcp set` | ACP (`openclaw acp`, `loadSession` partial) | `OPENCLAW_HOME`, `--profile` | Gateway-bridged |
| OpenHands | ACP; or `openhands mcp add --header` | ACP (`openhands acp`); fallback `--headless --json` | `OPENHANDS_PERSISTENCE_DIR` (source only) | none known |
| ZCode | manual MCP entry (UI or JSON) | not drivable (desktop, no headless) | unverified | (A) only |
| Proto | MCP (details unverified) | not drivable | unverified | proprietary, no reverse engineering allowed |
| LangChain / `dcode` | ACP (`dcode --acp`); or `--mcp-config` | ACP | `DEEPAGENTS_HOME` | the framework itself is served by `fabric-agent-adapter`, not the runner catalogue |
| Strix | `mcp-servers.json` (bearer token) | `strix -n` as a routine tool, not a general runner | `--config` | specialist; needs Docker |
| Cursor | ACP; or `~/.cursor/mcp.json` | ACP (`agent acp`); fallback `-p --output-format stream-json` | `CURSOR_CONFIG_DIR` (credentials unverified) | no model base URL |
| Zed | `context_servers` entry pointing at the hub | n/a (it is a client, not an agent) | n/a | (A) only |
| CodeGPT | `mcp.json` (stdio documented) | not drivable | unverified | (A) only, through a stdio bridge |
| Letta | ACP via `letta-acp`; SDK `mcpServers` | ACP adapter or `-p --output-format stream-json` | partial | adapter |
| HackerAI | unverified | not drivable | unverified | out of scope |

The other 9 top-30 entries (ISEKAI ZERO, Lemonade, HighLevel, Nous Research API, Hello Minds,
Janitor AI, Aura, Descript, Craft) are not agents a host can drive. Fabric has nothing to support
there. Their categories are recorded in [§2](#2-the-ranking).

## 7. The plan

### 7.1 Tiers (popularity × feasibility)

Shares are of top-200 daily tokens, from `raw/ranking-day-top200.csv`.

| Tier | Agents | Day share | Why this tier |
|---|---|---|---|
| **0: finish what exists** | Claude Code, Codex | 15.66% | Claude is connected. Codex's app-server backend is built but unwired. ADR-0081 N1 and `harness-runtime.md:142` already make it the release blocker |
| **1: one ACP driver** | Hermes, Kilo, Cline, omp, pi (through `pi-acp` or `--mode rpc`), OpenClaw, OpenHands, Cursor | 43.79% | All have an MCP client with HTTP + headers and a native or listed ACP mode. One driver serves them all |
| **2: per-agent work** | Command Code, DeepSeek Harness, `dcode` (LangChain), Strix, Letta; plus goose, Qwen Code, Gemini CLI, OpenCode from outside the top 30 | 8.03% (top-30 members only) | ACP is undocumented (Command Code) or behind an adapter (Letta). Or there is a policy risk: DeepSeek's log upload. Or it is a specialist (Strix). The outside-top-30 ACP agents cost one catalogue row each |
| **3: reach Fabric only** | Freebuff, ZCode, Proto, Zed, CodeGPT, HackerAI | — | No headless or drivable surface. At most (A): a documented hub entry |

### 7.2 The generic abstraction: a runner catalogue plus a small set of drivers

The registry spec already names the data file and the `acp` drive mode
(`docs/evidence/specs/2026-09-29-agent-registry-design.md:57-59`). The proposal makes that concrete.
It keeps the existing rule that adapters are code and refuse when unimplemented (`agents.ts:62-66`).

**Rows are data; drivers are code.** `registry/runners.json`, versioned and shipped with Fabric, has
one row per runner:

```jsonc
{
  "id": "hermes-agent",
  "label": "Hermes Agent",
  "binaries": ["hermes"],
  "version": { "args": ["--version"], "pattern": "…", "verifiedBuilds": ["<probed build>"] },
  "install": { "command": "curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash", "source": "<doc URL>" },
  "drive": [
    { "mode": "acp", "args": ["acp"], "env": { "HERMES_ACP_SKIP_CONFIGURED_MCP": "1" } },
    { "mode": "print-jsonl", "args": ["chat", "--oneshot", "-q", "{prompt}", "--format", "stream-json"] },
    { "mode": "pty", "args": [] }
  ],
  "mcp": {
    "inject": ["acp-session"],                          // ordered preference, see below
    "userConfig": { "path": "~/.hermes/config.yaml", "format": "yaml", "key": "mcp_servers" }
  },
  "auth": { "model": ["oauth", "api-key"], "home": { "env": "HERMES_HOME", "default": "~/.hermes" }, "statusArgs": null },
  "model": { "baseUrl": { "configKey": "model.base_url", "wire": ["openai-chat"] } },
  "quota": { "source": "none" },
  "permissions": { "plan": "…", "ask": "…", "bypass": "…" },
  "license": "MIT",
  "docs": ["https://github.com/NousResearch/hermes-agent/…/acp.md"]
}
```

**Drivers are code, one per drive mode.** Each is a module behind a shared interface: `start`, `send`,
`events`, `cancel`, `resume`, `stop`.

| Driver | Status | What it does |
|---|---|---|
| `pty` | exists | today's `pty.ts` |
| `claude-stream` | exists, unwired | owned stdio |
| `codex-app-server` | exists, unwired | ADR-0081 |
| **`acp`** | **new** | an ACP client in main over the agent's stdio, on the Apache-2.0 TypeScript SDK `@agentclientprotocol/sdk` (`raw/agents-group-c.md` §14) |
| `print-jsonl` | new | a parser per event dialect: Claude/Cursor/Letta stream-json, Codex `exec --json`, OpenHands `--json`, pi/omp `--mode json` |

**MCP injection preference, safest first:**
1. **`acp-session`.** Send Fabric's surface in `session/new.mcpServers` as
   `{type:"http", name:"fabric", url, headers:[{name:"Authorization", value:"Bearer <one-shot>"}]}`
   ([ACP session setup](https://agentclientprotocol.com/protocol/session-setup)). Do this only when
   `initialize` reports `agentCapabilities.mcpCapabilities.http: true`. Nothing is written to disk,
   it is per session, and the credential is scoped.
2. **`cli-flag`.** A per-launch config file, the way Claude Code's `--mcp-config` works today.
   `dcode --mcp-config` and `strix --mcp-config` / `STRIX_MCP_CONFIG` follow the same pattern.
3. **`config-home`.** An isolated per-session home (e.g. `CODEX_HOME`, as ADR-0081 does). This
   **separates the agent from the user's login**, so it fits only agents that accept a key or token
   by env.
4. **`user-config`.** Write a named entry into the user's own config: the spec's AR-3 plan
   (`agent-registry-design.md:93-97`). Last resort, for runners that support only (A).
   - Needs the operator's consent, a door-token-only credential and a reversible write.
   - Must use headers, never a URL query string.

**Code changes this implies:**
- `SurfaceAdapter` gains `'acp-session'`.
- `ProviderExecutionBinding.provider.id` widens from the two-member union to catalogue ids.
- The `'claude-code'` fallbacks (`chainAdvance.ts:448`, `workspace.ts:328`) become the Project's
  declared default.
- **`connectsToSurface` stops being a static flag.** It becomes the result of a recorded probe. An
  `initialize` handshake proves the capability, and a scripted tool call proves the surface. This is
  what `harness-runtime.md:48` already demands.
- `agents.ts:10-16` says the array stays code until "the first time an agent must exist without a
  release". Moving rows to data meets that return trigger, and **needs an ADR**.

**Detection, readiness and quota:**
- `executorDetect` and `executorAuth` read their probes from the row.
- An agent with no status command is reported as auth `unknown`, never as signed in.
- **Quota policy per runner.** `routineTick` blocks on a null quota (`routineTick.ts:39-40`).
  Runners with `quota.source: none` need an explicit Project-level budget policy instead: max turns or
  max budget, where the agent supports a flag for it. Without that, routines stay manual. The UI
  says so, rather than pretending.

**Model / base URL is optional and later.** Every Tier-1 agent except Cursor accepts an
OpenAI-compatible base URL (§3).
- A Fabric model gateway (for metering, or one OpenRouter key per Project) can be injected
  per row later.
- **Support does not depend on it**, and Fabric should not force a gateway: see the anti-vision in
  [§9](#9-vision-and-anti-vision-check).
- Claude Code accepts only Anthropic-format gateways, and Codex only Responses-API gateways (§3).

### 7.3 Delivery order

1. **ADR + spec + `/ux` scenarios.**
   - An ADR: "ACP is the generic runner drive mode; runner rows are catalogue data; adapters stay code".
   - Reserve the id with `agent_sync.py reserve ADR`.
   - The runner catalogue schema.
   - Scenario updates for choosing a coding agent: `docs/ux/scenarios.md:2437` and `:3092` today say
     "Claude Code or Codex".
2. **The ACP driver against a fake agent.**
   - Build the driver in main with a fixture ACP agent: a stdio script that records `session/new`.
   - Tests, with planted defects watched being caught:
     - the MCP server is missing from `session/new`;
     - the header leaks into argv;
     - a permission request is auto-approved under `ask`;
     - `cancel` is not sent on stop.
3. **Hermes Agent as the first real row** ([§8](#8-running-fabrics-harness-on-hermes-agent)).
   - Probe one pinned build and commit the probe transcript as a fixture.
   - Flip `connected` only on probe success.
4. **The other Tier-1 rows.** Kilo, Cline, omp, OpenClaw, OpenHands, Cursor, pi: one row plus one
   probe fixture each. These need no new driver code unless a probe fails.
5. **Tier 0 finish.** Wire Codex's app-server backend into session launch (ADR-0081 N1).
6. **Switchboard** ([§7.4](#74-switchboard)).
7. **Tier 2**, case by case. DeepSeek Harness only with its upload disabled and documented.

### 7.4 Switchboard

Per `docs/ux/vision.md:7-8`, Switchboard is a separate enabling tool, so this is its own track.

1. **Replace the `match` arms with a `ProviderAdapter` trait**, mirroring the catalogue row:
   - home env and defaults;
   - login command;
   - auth-file and Keychain locations;
   - managed-routing capability (`anthropic-messages`, `openai-responses`, `openai-chat`).
2. **Add isolated-mode providers in share order**, where an isolation handle exists (§3):
   - Hermes: `HERMES_HOME`. Warn about the single-use OAuth refresh token across profiles.
   - Kilo: `KILO_CONFIG_DIR` + `XDG_DATA_HOME`, to be verified.
   - Cline: `CLINE_DATA_DIR`.
   - omp: `OMP_PROFILE`.
   - pi: `PI_CODING_AGENT_DIR`.
   - OpenClaw: `OPENCLAW_HOME`.
   - Cursor: `CURSOR_CONFIG_DIR`, once a probe proves credentials move with it.
   - **Command Code has no handle**, so leave it out.
3. **Managed routing for these agents needs an `openai-chat` upstream route** in `switchboard-proxy`.
   Today it has only `claude/messages` and `codex/responses`.
4. **An "OpenRouter key" account kind.** Many Tier-1 agents read `OPENROUTER_API_KEY` or mint one by
   OAuth (Hermes, pi, OpenClaw, Kilo). Holding several keys and injecting one per launch is a natural
   extension.
   - Keys must come from Project Observatory's vault, never from a Switchboard file. That is the
     operator's standing secrets rule.

## 8. Running Fabric's harness on Hermes Agent

**Why Hermes.**
- #1 by share: 18.9% daily, 24.4% monthly.
- MIT-licensed.
- It documents exactly the host-owned MCP contract Fabric needs (`raw/hermes-acp.txt`).

**Launch.**
- Driver `acp`: spawn `hermes acp` in the Project worktree as `cwd`.
- Env is `sessionEnvironment(process.env)` plus `HERMES_ACP_SKIP_CONFIGURED_MCP=1`.
  - That env var skips the user's globally configured MCP servers, but "MCP servers supplied by the ACP
    session through `session/new` are still registered" (`raw/hermes-acp.txt:325-337`).
  - This is the equivalent of `--strict-mcp-config` (`sessionBundle.ts:221-243`).
- Runtime profile `owned-stdio` (`providerExecution.ts:5`).

**Fabric's tools.**
- `initialize` → require `agentCapabilities.mcpCapabilities.http`.
- `session/new {cwd, mcpServers:[{type:"http", name:"fabric", url: surface.endpoint, headers:[{name:"Authorization", value:"Bearer <one-shot scope token>"}]}]}`.
  This is the same credential `sessionBundle.ts:144-172` mints today.
- Hermes: "MCP servers that the editor sends with `session/new` are separate. The client asks for them
  per session, and they are always added" (`raw/hermes-acp.txt:59-60`).

**Brief.**
- Claude gets `--append-system-prompt`. `session/new` has only `cwd` and `mcpServers`
  ([ACP session setup](https://agentclientprotocol.com/protocol/session-setup)).
- So the brief and preamble go as the first `session/prompt` content block.
- *To verify in the probe:* does Hermes' ACP adapter expose a system-prompt or instructions extension?

**Permissions.** Fabric answers `session/request_permission` from the runner's permission mode:
- `plan` refuses writes;
- `ask` routes to the operator's approval surface;
- `bypass` allows.

Hermes warns that headless bridges which auto-answer permissions hand the agent `terminal` and
`execute_code` (`raw/hermes-acp.txt:190`, `:286-301`). Two consequences:
- Never auto-approve in `ask`.
- In `plan`, also narrow the toolset with `platform_toolsets.acp` / `agent.disabled_toolsets`, as the
  doc recommends.

**Result.** Hermes calls Fabric's surface tools directly, so `resultChannel: 'surface'` is unchanged.
ACP `session/update` notifications feed the session journal.

**Stop and resume.**
- Stop: `session/cancel`, then terminate the process inside the existing quit drain (AGENTS.md
  lifecycle table).
- Resume: `session/load`, gated on the `loadSession` capability. Hermes persists ACP conversations to
  its session database (`raw/hermes-acp.txt:351-352`).

**Auth and accounts.**
- Fabric does not touch Hermes credentials (`~/.hermes/auth.json`, `.env`).
- Detection is `hermes --version`. No documented non-interactive auth-status command was found, so the
  probe must report auth as `unknown` until one is verified.
- Account choice is Switchboard's job, through `HERMES_HOME` or profiles.

**Model.** Hermes picks its own provider (OpenRouter, Nous Portal, …). Fabric records the model it
observes in the run's receipt, and does not route it in v1.

**Quota.** There is none (`quota.source: none`). Routines on Hermes stay blocked until the Project
sets a budget policy ([§7.2](#72-the-generic-abstraction-a-runner-catalogue-plus-a-small-set-of-drivers)).

**Hermes' own memory and skills stay in Hermes.** Fabric keeps role, routines and Evidence. It does
not mirror Hermes' memory or skill store; see the anti-vision in
[§9](#9-vision-and-anti-vision-check).

**Fallbacks.**
- `print-jsonl`: `hermes chat --oneshot -q … --format stream-json`, which emits JSONL
  `system/text/tool_use/tool_result/result` (`raw/agents-group-a.md` §1). MCP would then need
  `config-home` injection, which loses the user's login. That makes this fallback weaker.
- `pty`: interactive `hermes`, unconnected, like Codex today.

## 9. Vision and anti-vision check

The anti-vision is at `docs/ux/vision.md:49-61`; the alignment test at `:76-88`.

**Aligned overall.**
- Principle 2, "We keep agents replaceable, not central" (`vision.md:40-41`).
- Alignment question 2, "Can the Agent or Provider change without losing purpose, authority, Routines,
  Evidence or history?" (`vision.md:82-83`).
- Today's Claude-only connection is the gap here. A catalogue plus an open protocol closes it.

**What this work touches in the anti-vision, and the guard for each:**

| Anti-vision line (`vision.md`) | Risk from this work | Guard |
|---|---|---|
| "a multi-chat cockpit that makes one person supervise more agent sessions…" (`:53-54`) | Ten runners can turn into ten chat tabs | A runner is only the execution binding of a Project Agent, chosen in the binding, not a new place to chat. No "all agents" session grid |
| "a proprietary agent runtime that requires Projects to adopt one model, vendor or private session format" (`:55-56`) | The current state (Claude-only connected) leans toward this; a Fabric-mandated model gateway would too | ACP is an open Apache-2.0 protocol. Model routing stays optional and per row ([§7.2](#72-the-generic-abstraction-a-runner-catalogue-plus-a-small-set-of-drivers)) |
| "a generic integration dashboard that copies provider state without closing a Project's observe-to-verify loop" (`:60-61`) | Mirroring each agent's sessions, memory, skills and quota pages into Fabric | Import only receipts tied to Fabric runs. Do not mirror Hermes memory or skills, OpenClaw channels, and so on |

**Alignment questions 3 and 5** (`vision.md:84-88`):
- Each new runner effect needs an owner, a boundary and a receipt: permission mapping, strict MCP, and
  the probe fixture.
- Adoption is progressive. A runner shows "on this machine / responding / connected (probed build)"
  honestly, and never claims connection from catalogue presence (`harness-runtime.md:48`).
- Unattended routines stay off until a quota or budget policy exists.

**Switchboard** stays out of the Project loop, as `vision.md:7-8` already says.

## 10. Unverified items that a probe must settle before shipping a row

- Hermes: a system-prompt channel over ACP; a non-interactive auth-status command; exact
  `mcpCapabilities` values on a pinned build.
- Kilo: the credential location under `XDG_DATA_HOME` (read from source, not documented).
- Cline: which of the three MCP file paths the CLI reads. ACP injection avoids the question.
- Command Code: `cmd acp` behaviour (read from the bundle, not documented).
- Cursor: whether `CURSOR_CONFIG_DIR` moves credentials.
- OpenHands: `OPENHANDS_PERSISTENCE_DIR` (read from source, not documented).
- `pi-acp`: provenance and maintenance.
- Whether each ACP agent actually honours HTTP MCP servers sent in `session/new`. The spec makes only
  stdio mandatory ([ACP session setup](https://agentclientprotocol.com/protocol/session-setup)).
  Where an agent supports stdio only, Fabric would need a stdio→HTTP bridge to the surface.

## 11. Next task

1. Reserve an ADR id (`agent_sync.py reserve ADR`). Draft the ADR "ACP as the generic runner drive
   mode, with a data runner catalogue" under the agent-sync lease, together with the catalogue schema
   in `docs/evidence/specs/`.
2. Then build the `acp` driver against a fixture agent (§7.3 step 2).
3. Hermes Agent is the first real row.

**What this research did not do.** It changed no code and committed nothing. It did not run
`reports.py index`, update the design map, or publish the workspace. Those belong to the iteration that
acts on this report.

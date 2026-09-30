# External contracts

> Current harness correction, 2026-09-27: the runner inventory below is a historical 2026-08-16 snapshot, not evidence for current CLI builds. Measured installed builds are Claude Code 2.1.283 and Codex 0.157.1. The old SIGTERM-as-interrupt and Node=session shorthand must not define current Stop/resume behavior. Use the [exact-build provider packet](../launch/harness-r0/providers.md) and [observed Stop contract](../launch/harness-r0/stop.md). All current provider capabilities still require native receipts.

What the outside world imposes on this architecture. Every claim here carries its source
and the date it was taken: **2026-08-16** for stage 1 of run
`2026-08-16-software-fabric`, and its own date where a source was added afterwards. The
architecture and the data-flow document cite this file rather than restating it.

A number without a source in this file is a defect.

Fabric's own northbound MCP server contract is canonical in
[`mcp-control-surface.md`](mcp-control-surface.md). Its upstream requirements were fetched
from MCP `2026-07-28` on 2026-08-30: HTTP authorization treats the server as an OAuth
resource server; tool/resource discovery may vary by per-request authorization; the Tasks
extension supplies durable handles for long operations. This file continues to own vendor
and source constraints rather than duplicating that domain surface.

---

## 1. The runner — and the finding that changes the build

**Claude Code ships almost the entire runner.** The fabric's node contract — *one task,
one result, one agent, with a budget, a permission ceiling, an isolated workspace and an
escalation path* — maps onto flags and options that already exist. The runner is a
**driver**, not a system to build.

Source: `claude --help` on the installed binary (**v2.1.223**), and
`code.claude.com/docs/en/agent-sdk/typescript` + `/docs/en/headless`.

### Two channels, and which one this project uses

| Channel | What it is | Verdict for the fabric |
|---|---|---|
| **Agent SDK** — `@anthropic-ai/claude-agent-sdk` | Library, `query({prompt, options})` returns `Query extends AsyncGenerator<SDKMessage>` | **Primary.** Typed, in-process, gives callbacks the CLI cannot |
| **CLI headless** — `claude -p` | Subprocess, `--output-format stream-json` | Fallback and the model for non-Claude agents (Cursor, OpenClaw) |

The SDK is TypeScript and Python only. Anything else drives the CLI as a subprocess —
which is exactly what the fabric must do for Cursor and OpenClaw anyway, so the runner
needs **both shapes regardless**. That is the argument for a `RunnerAdapter` interface
rather than a Claude-specific runner.

### Node requirement → the option that already implements it

| The fabric needs | Agent SDK option | CLI flag |
|---|---|---|
| Node id **is** the session id | `sessionId` | `--session-id <uuid>` |
| Resume a node | `resume`, `forkSession` | `--resume`, `--fork-session` |
| Resume at an exact point in the transcript | `resumeSessionAt: "<message uuid>"` | — |
| **A hard money ceiling per node** | `maxBudgetUsd` | `--max-budget-usd` |
| Loop guard | `maxTurns` | — |
| Autonomy level | `permissionMode`: `default` / `dontAsk` / `bypassPermissions` / `plan` | `--permission-mode` |
| The floor, as deny rules | `disallowedTools: ['Bash(rm *)']` | `--disallowedTools` |
| **Escalation to the operator** | `canUseTool` callback | — (CLI cannot) |
| One node, one **typed** result | `outputFormat: {type:'json_schema', schema}` | `--json-schema` |
| Departments, defined at spawn | `agents: Record<string, AgentDefinition>` | `--agents <json>` |
| Isolated workspace | `cwd`, `additionalDirectories` | `--worktree`, `--add-dir` |
| Per-node MCP surface | `mcpServers` + `strictMcpConfig` | `--mcp-config`, `--strict-mcp-config` |
| Skills / plugins per node | `skills`, `plugins` | `--plugin-dir`, `--plugin-url` |
| **Transcripts into our own store** | `sessionStore` + `sessionStoreFlush` | — |
| Interrupt a running node | `abortController`, `q.interrupt()` | SIGTERM |
| Live control while running | `q.setPermissionMode()`, `q.setModel()`, `q.getContextUsage()` | — |
| Full run observability | `hooks`, `includeHookEvents`, `includePartialMessages`, `forwardSubagentText` | same flags |

**Three of these are load-bearing enough to name individually.**

- **`canUseTool` is the escalation path, and it is a callback, not a poll.** When the
  permission flow falls through to a prompt, the fabric's function is called and the node
  blocks on its return. The approval queue, Telegram, macOS notification and webhook all
  hang off this one hook. It is *not* invoked for auto-approved tools or
  `AskUserQuestion` — so the queue must handle those separately.
- **`maxBudgetUsd` puts the money floor in the runtime, not only in our schema.** ADR-0004
  said a constraint in the database beats an instruction a model can argue with; this is a
  second, independent floor below that one.
- **`sessionStore` mirrors transcripts to an external backend.** Agent transcripts land in
  Supabase as they are produced, rather than being scraped afterwards.

### Gotchas that would each have cost a debugging session

1. **`claude -p` rejects `--bg`.** Print mode and background-agent mode are mutually
   exclusive. The fabric's async execution comes from the SDK's async generator, not from
   `--bg`. (`/docs/en/headless`)
2. **A `-p` session in an untrusted folder still runs that project's hooks and connects
   its MCP servers.** There is no trust dialog and no per-server prompt in non-interactive
   mode. **The fabric clones other people's repositories**, so this is a live remote-code-
   execution path: cloning a repo and running a node in it executes whatever sits in its
   `.claude/settings.json`. Mitigation is `--bare` / `settingSources: []` plus
   `strictMcpConfig`, and it is a hard requirement, not a hardening nicety.
   (`/docs/en/headless`, *What runs before you trust a folder*)
3. **`--bare` never reads OAuth credentials or the keychain** — it needs
   `ANTHROPIC_API_KEY`. So the safe mode and the subscription-auth mode are the same
   choice, not two independent ones. See §2.
4. **`env` replaces `process.env`, it does not merge.** A runner that passes `env` without
   spreading the parent loses `PATH`. (SDK Options table)
5. **SIGTERM aborts the turn, kills the Bash process tree, runs `SessionEnd` hooks, exits
   143.** A clean cancel path exists; use it instead of SIGKILL.
6. **Background Bash tasks are killed ~5 s after the result**; background subagents are
   waited on, capped at 10 minutes (`CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS`).
7. **`total_cost_usd` is a client-side estimate** and can differ from the bill. The
   fabric's spend figures must say so wherever they are shown.
8. **Feature-detect with the `capabilities` array in `system/init`**, never by comparing
   version strings.
9. **Cross-directory resume by session id works only from v2.1.223.** The 2026-08-16 inventory was
   exactly 2.1.223. This is historical, not the current installed version or readiness.

---

## 2. Authentication, and a constraint with a price tag

> "Unless previously approved, Anthropic does not allow third party developers to offer
> claude.ai login or rate limits for their products, including agents built on the Claude
> Agent SDK. Use the API key authentication methods instead."
> — `/docs/en/agent-sdk/overview`

For the fabric as the operator's own tool, run by the operator on the operator's machine,
this is not engaged — nothing is being offered to a third party. **It engages the moment
any of this is sold or shared**, which has already been considered for the operator's
adjacent personal-assistant system. The consequence is a cost-model fork, not a code change:

| Mode | Auth | Cost |
|---|---|---|
| Personal tool (today) | subscription login, or `ANTHROPIC_API_KEY` | flat, already paid |
| Anything offered to others | `ANTHROPIC_API_KEY` only | metered per token |

And note the collision with gotcha 3: `--bare` — the mitigation for the untrusted-repo
hook problem — forces the API-key path anyway. **The safe runner is the metered runner.**
Budget accordingly rather than discovering it at the first cloned repository.

---

## 3. Data sources — what each one will and will not give

### Google Search Console

Source: `developers.google.com/webmaster-tools/limits`, fetched 2026-08-16.

| Scope | Limit |
|---|---|
| Search Analytics, per site | 1 200 QPM |
| Search Analytics, per user | 1 200 QPM |
| Search Analytics, per project | 40 000 QPM · 30 000 000 QPD |
| URL Inspection, per site | 600 QPM · 2 000 QPD |
| All other resources, per user | 20 QPS · 200 QPM |

Load quotas are measured in **10-minute** (short-term) and **1-day** (long-term)
intervals — a burst that respects the per-minute figure can still trip the 10-minute one.

**The row ceiling is not in the docs, and the operator's own production data is the better
source.** Another project's SEO agent measured Google truncating a day at **5 000 rows** —
1 232 days out of 5 853 across three properties sitting exactly on it. A collector that
does not page past 5 000 silently under-reports a fifth of its history. This is a
requirement (REQ-016), not a footnote.

### Google Analytics 4 Data API

Source: `developers.google.com/analytics/devguides/reporting/data/v1/quotas`, fetched
2026-08-16. Standard (free) properties, per quota category (Core / Realtime / Funnel):

| Quota | Limit |
|---|---|
| Tokens per day | 200 000 |
| Tokens per hour | 40 000 |
| Tokens per project per property per hour | 14 000 |
| Concurrent requests | 10 |
| Server errors per hour | 10 |

Token cost scales with rows, dimensions, filters, date range and cardinality — most
requests cost ≤ 10 tokens. **Send `returnPropertyQuota: true` and record the actual
consumption per call**; a collector that estimates its own quota use is guessing.

The per-property-per-hour figure is the binding one at this estate's size: 14 000 tokens
across however many properties the fabric watches, not 40 000.

### Cloudflare

**Measured, not fetched.** On 2026-08-16 the recon made 3 zone-list calls plus 66
zone-detail calls in one burst with no throttling. That is evidence the working set fits
comfortably, and it is **not** a documented limit — the published per-user ceiling must be
read and recorded before the collector runs on a schedule. Recorded as an open item rather
than asserted.

### Supabase local stack

Source: context7 `/supabase/cli`, and `supabase/config.toml` generated locally.

- `supabase init` → `supabase start` → `supabase status`.
- **`supabase db reset` recreates the Postgres container, applies every migration in
  order, then applies the seed file — and discards every manual change.** This is the
  fixtures answer from the brief: the recreate-from-nothing command exists and is one line.
- `supabase migration new <name>` creates an empty timestamped script;
  `supabase migration down --last n` rolls back locally.
- Local ports as generated: API 54321, DB 54322, Studio 54323, Inbucket 54324, pooler 54329.

### PostHog — candidate for the signal layer, nothing chosen

Source: `github.com/PostHog/posthog` README at `master` and `posthog.com/docs/api`,
`posthog.com/docs/api/rate-limits`, all fetched 2026-08-25 on the operator's direction.
**Nothing in this estate emits to PostHog today.** This row exists so a later run reads
what it would give instead of re-deriving it, and it decides nothing.

Why it is worth a row at all: it collapses sources this file currently keeps apart.
Product and web analytics ("a GA-like dashboard"), session replays, error tracking, logs,
feature flags, experiments, surveys, a data warehouse that syncs external tools, pipelines
to "25+ tools or any webhook", and **AI observability** — "capture traces, generations,
latency, and cost for your LLM-powered app", which is the fabric's own agent runs rather
than the estate's traffic. Its `Self-driving mode` states the same thesis this project
does — "turn signals in your product data (errors, rage clicks, failed queries, and more)"
into work — which makes it a reference point as much as a dependency.

Reading data out is one interface: private `GET`/`POST` endpoints on `us.posthog.com` /
`eu.posthog.com` (Cloud) or the self-hosted domain, authenticated by a **personal API
key** — which the docs say gives "the same access as if you were logged into your PostHog
instance". Project secret keys (beta) and OAuth exist; the personal key is both the
easiest and the widest of the three, and a collector holding one holds the whole account.

| Endpoint class | Limit |
|---|---|
| Analytics — insights, persons, session recordings | 240/min · 1200/hour |
| Query endpoint (SQL) | 2400/hour |
| `events/values` | 60/min · 300/hour |
| The rest of the CRUD surface | 480/min · 4800/hour |
| Feature-flag local evaluation | 600/min |
| Public POST-only — `/e`, `/i/v0/e`, `/flags` | no request-level limit |

**The binding constraint is not a number, it is a scope:** "These limits apply to the
entire team (i.e. all users within your PostHog organization)." Forty properties read from
one organization share 2400 query-calls an hour with every other script and every human in
it — GA4's per-property hour (§3 above) one level higher, and the same lesson: a collector
records its actual consumption and backs off on the organization's behalf. Higher limits
are refused in writing — "at this time, we are not offering higher limits than these" —
with `endpoints` and `batch exports` named as the way around.

Hosting decides whether this is a source or an operational dependency. The repository is
"available under the MIT expat license, except for the `ee` directory", with a
`posthog-foss` mirror "purged of all proprietary code and features". Self-hosting is one
Docker line and simultaneously discouraged: "open source deployments should scale to
approximately 100k events per month, after which we recommend migrating to a PostHog
Cloud", and "we _do not_ provide customer support or offer guarantees for open source
deployments". Cloud's free tier is 1M events, 5k recordings, 1M flag requests, 100k
exceptions and 1500 survey responses per month, usage-priced after that.

---

## 4. What this changes

Three consequences the module map at stage 2 has to absorb.

1. **The runner module shrinks and the adapter boundary appears.** Not "build an agent
   execution engine" but "drive the Agent SDK, and define a `RunnerAdapter` the CLI-shaped
   agents (Cursor, OpenClaw) implement the same way."
2. **Sandboxing moves from *later* to *milestone one of the runner*.** Gotcha 2 is a
   remote-code-execution path that opens the first time an agent clones a repository the
   operator does not own. `--bare` / `settingSources: []` / `strictMcpConfig` are the
   default, not the hardened profile.
3. **`canUseTool` is the harness interrupt, not the durable wait.** The approval queue is
   not a polling loop over pending rows: the adapter converts the callback into
   ADR-0022's persisted suspend contract and releases the live harness process. Resume
   creates or reconnects the pinned runner session from the checkpoint; a runner that can
   only hold a process for the whole wait fails the durable passport for multi-day work.

---

## 5. Unresolved

| # | Question | Blocks |
|---|---|---|
| 1 | Cloudflare's documented per-user rate limit | scheduled collection |
| 2 | Does `sessionStore` support a Postgres backend directly, or does it need an adapter? | the observability seam |
| 3 | Can `canUseTool` block for minutes without the node timing out — and what is the timeout? | the escalation design (§4.3) |
| 4 | Cursor and OpenClaw headless interfaces — do they expose anything like `--output-format stream-json`? | the `RunnerAdapter` interface |
| 5 | PostHog: a source for the estate's products, the fabric's own LLM telemetry, or both — and Cloud or self-hosted, given the ~100k events/month self-host ceiling | the M11 connector shape |

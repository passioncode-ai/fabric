# Contracts — locked for the agent registry (stage 3)

Status: **locked 2026-09-29** for modules AR-1…AR-6; a change after this date is a new revision of
this file with its reason. Design: [2026-09-29-agent-registry-design.md](2026-09-29-agent-registry-design.md).
External grounds (all fetched 2026-09-29): MCP specification revision `2026-07-28` and its
official Tasks extension `io.modelcontextprotocol/tasks` (stable at `2026-07-28`); MCP `_meta`
trace keys `traceparent`/`tracestate`/`baggage` (SEP-414, normative); W3C Trace Context Level 1;
OpenTelemetry GenAI semantic conventions (Development — pinned by version in AR-6); ACP v1
(stdio JSON-RPC); Codex `app-server` (the MCP server mode was removed); Claude Code headless
(`-p --output-format stream-json`, `--mcp-config`, `--strict-mcp-config`).

The normative homes are the Fabric Agent Contract (`docs/specification/interop.md`,
`provider.md`, `runners.md`, `pipeline.md` and their schemas) — module AR-1 moves each section
below there verbatim and adds fixtures. Until then this file is the lock.

## C1. `fabric-provider/0.1` — an agent that is not a service

File: `<fabric home>/providers/<id>.json` (same root as `services/`; `FABRIC_PROVIDERS_DIR`
overrides), mode 0600, written only by the agent's installer, removed by its uninstaller.

| Field | Type | Rule |
|---|---|---|
| `protocol` | const `"fabric-provider/0.1"` | required |
| `id` | `^[a-z][a-z0-9-]{1,62}$` | required; unique across `providers/` and `services/` |
| `name`, `summary` | string ≤ 80 / ≤ 200 | required / optional |
| `manifest` | absolute or `~/` path to `fabric-agent.json` | required; the manifest's `provider.id` names this entry |
| `run` | one of `{mcp: {stdio: {command: [argv…], env: {NAME: "secret-ref:…"}}}}` or `{mcp: {url: "http://127.0.0.1:<port>/mcp"}}` | required; argv arrays only, never a shell string; env values are secret references, never values (DEC-0013) |
| `source.repository` | URL | optional |
| `installedAt`, `installedBy` | RFC 3339, string | required |
| `extensions` | object of absolute-URI keys | optional; unknown keys preserved |

Rules: **FAC-SEM-013** an id appears in at most one of `services/` and `providers/`;
**FAC-SEM-014** `manifest` resolves and its `provider.id` equals the entry's `id`;
**FAC-SEM-015** `run.mcp.stdio.env` holds no literal secret (a value matching the secret patterns
the adapter already refuses fails validation).

## C2. Runner catalogue — installed coding agents

Shipped with Fabric as data (`registry/runners.json`, versioned with the app), schema in the
contract (`runners.schema.json`). One entry per runner kind:

```json
{
  "kind": "claude-code",
  "name": "Claude Code",
  "binaries": ["claude"],
  "version": {"argv": ["--version"], "pattern": "^(\\d+\\.\\d+\\.\\d+)", "timeoutMs": 5000},
  "drive": "claude-headless",
  "drives": {
    "claude-headless": {"argv": ["-p", "--output-format", "stream-json", "--verbose", "--strict-mcp-config", "--mcp-config", "{mcpConfig}"]}
  },
  "mcpConfig": {"file": "~/.claude.json", "format": "claude-json", "key": "mcpServers"},
  "skillsDir": "~/.claude/skills",
  "docs": "https://code.claude.com/docs/en/headless"
}
```

`drive` ∈ `claude-headless | codex-app-server | codex-exec | acp`. Initial catalogue: `claude-code`
(claude-headless), `codex` (codex-app-server; ADR-0081), `gemini-cli`, `goose`, `opencode`,
`cursor-agent`, `kiro` (acp). `mcpConfig.format` ∈ `claude-json | codex-toml | cursor-json |
gemini-json | opencode-json | kiro-json | none`. Detection runs **only** the catalogued version
argv, without a shell, with the timeout; a binary not in the catalogue is never executed.
**FAC-SEM-016** a runner entry names exactly one default `drive` present in `drives`.

## C3. `fabric-interop/0.1` — how agents are called

Extension key: `https://fabric.passioncode.ai/agent-contract/extensions/interop/0.1` (the same
host and path shape as the contract's `service/0.1` key; the Dashboards docs' other spelling is
fixed in AR-1).

**C3.1 Capabilities.** Each `capabilities[]` entry of the manifest whose profile is `mcp` is
served as an MCP tool whose `name` equals the capability `name`, whose `inputSchema` and
`outputSchema` are the capability's schemas (JSON Schema 2020-12). Annotations derive from the
declared effect: `effect: none` → `readOnlyHint: true`; `effect` ∈ `delete | merge | deploy |
change-policy` → `destructiveHint: true`; `idempotency: required` → `idempotentHint: true`.
**FAC-SEM-017** a served tool's schemas equal the manifest's (a probe compares them).

**C3.2 Jobs.** A capability whose work may outlive one request declares `"job": true` in its
interop extension block. Then:

- if the request negotiated `io.modelcontextprotocol/tasks`, the server MAY return an MCP Task;
- otherwise the tool returns, in `structuredContent`,
  `{"job": {"id": "<opaque>", "status": "working"}}`, and the agent serves two tools:
  `fabric.job.get {id}` → `{"job": {id, status, statusMessage?, updatedAt, pollIntervalMs?,
  inputRequests?, result?, error?}}` and `fabric.job.cancel {id}` → the same shape.
- `status` ∈ `working | input_required | completed | failed | cancelled` (the MCP Task states);
  terminal: `completed | failed | cancelled`.
- `result` is the **result envelope**: `{done: [...], proof: [...], scope: {...}, notVerified:
  [...], output: <outputSchema value>, usage: {inputTokens, outputTokens, cacheReadTokens?,
  cacheWriteTokens?, costUsd?, wallMs}}` (DEC-0011 collections plus usage).
- A job id is stable across restarts of the agent; `fabric.job.get` for an unknown id answers
  `isError: true` with `unknown-job`, never a fresh job.

**C3.3 Awaiting a choice.** A job or call that needs a person returns `input_required` with MCP
elicitation `inputRequests` in **form mode**; a choice is a single-select enum with titles
(`oneOf: [{const, title}]`). Fabric maps it to an interaction point (ADR-0017) and answers with
`tasks/update` (Task) or `fabric.job.get` + `inputResponses` (job handle). **FAC-SEM-018** form
mode never requests a secret (MCP rule); secrets use URL mode.

**C3.4 Trace.** Every request carries `_meta.traceparent` (W3C, lowercase hex) and MAY carry
`tracestate`. An agent MUST: (a) start its work as a child span of that parent; (b) put the same
trace id, as a new child span, on every outgoing call; (c) add `traceId` and `spanId` to every
event it publishes on its `fabric-service` events feed. **FAC-SEM-019** a job result without a
trace id is accepted but its span is recorded `incomplete`.

**C3.5 The hub.** Fabric's MCP is the only route between agents: an agent reaches another agent
by calling Fabric's `agent.call {agentId, capability, input, idempotencyKey?}` (and
`fabric.job.get/cancel` for the job it returns). Fabric enforces the caller's MCP access binding
(ADR-0026), mints the callee's credential itself, and journals one span per hop. Credentials
travel only in headers (`Authorization: Bearer <token>`); never in a URL, argv, or log.

**C3.6 Discovery surface.** A service's well-known document MAY add
`surfaces.mcp.capabilities: [<capability names>]` so a host can list capabilities without the
token; the manifest remains the authority.

## C4. Pipeline — `pipeline/0.1`

A versioned record (ADR-0009), stored in Fabric and exportable as JSON:

```json
{
  "id": "article-publish", "version": 3, "scope": "estate",
  "reason": "checker before publish",
  "stages": [
    {"id": "research", "capability": "research.topics", "preferred": "claude-code", "produces": "ranked-topics"},
    {"id": "draft", "capability": "copy.write", "needs": ["research"], "produces": "draft"},
    {"id": "check", "checker": true, "needs": ["draft"], "produces": "verdict"},
    {"id": "publish", "capability": "site.publish", "needs": ["check"], "effect": "publish"}
  ]
}
```

Rules (checked before save and before run):
- **PL-1 compatibility** — for each edge `a → b`, every property `b`'s `inputSchema` requires
  exists in `a`'s `outputSchema` with a compatible JSON type (string ⊆ string, integer ⊆ number,
  object recursion on required properties, array on `items`); an unresolvable `$ref` fails.
- **PL-2 checker** — every stage whose capability effect is not `none`/`draft` has a checker
  stage on every path from the start.
- **PL-3 acyclic** — `needs` forms a DAG.
- **PL-4 resolvable** — at run start every capability resolves to one admitted binding in the
  project; `preferred` is a hint, not a binding.
- A running pipeline pins its version; editing creates version n+1 with a `reason`.

## C5. Registry projection (Fabric-internal)

Event `registry.observed@1` (journal): `{source: runner|service|provider|fabric, kind:
coding-agent|your-agent|fabric-agent, id, instance?, version?, manifestHash?, health, problems:
[{code, detail}], scannedAt}` — written only when an entry changes. Health ∈ `ready | degraded |
stopped | down | foreign | unreadable | not-answering`. Problem codes: `manifest-invalid`,
`manifest-missing`, `foreign`, `duplicate`, `version-failed`, `port-claimed`, `id-collision`.
Feed sentence key `event.registry.observed` (i18n), per the narrative gate.

## C6. MCP inventory from Project Observatory

Observatory capability `machine.mcp.inventory` (read-only, `effect: none`) over Observatory's
MCP: `{servers: [{name, declaredIn: [{agent, file}], transport: stdio|streamable-http|sse,
answers: true|false|null, checkedAt}], inventoryAt}`. Fabric caches the last answer with its time
and never scans agent configs itself as a second inventory.

## Tracks of stage 3 (recorded, not silent)

| Track | Owner | This design |
|---|---|---|
| Does — behaviour | super-ux | ST-041…051, FLW-59…68, SCN-098…125, SCR-66…69 + refinements (commit `55738fe`) |
| Looks — visual | sheleg-design | Fabric's existing calm product system and PassionCode tokens; mockups in `product.html`; no Figma (Q9). The trace mockup is a call list; the drawn graph uses the shared graph renderer in AR-6 |
| Sounds — copy | copywriting | interface strings are written per module at build time against Fabric's brand pack; this design fixes only terms (§2 of the design) |

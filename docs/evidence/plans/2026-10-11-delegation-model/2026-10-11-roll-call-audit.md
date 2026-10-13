# Audit W1: the delegation roll call checked against owners' sources (CO-258 / ADR-0144)

Date: 2026-10-11. This audit is read-only: nothing was edited, committed or pushed in any repository. The input was the roll call `copylot-agent@9f729f4:docs/handoffs/2026-10-11-delegation-rollcall.md`. Every repository was fetched first and then read at the owner's default remote branch with `git show` or `git grep`. Paths below are relative to the repository named in the row. `B:` marks a non-default branch, named in the row.

> **Redacted 2026-10-13 under [ADR-0096](../../../adr/0096-dated-records-are-redacted-for-publication.md):** the names of the operator's private agents, their sessions, repositories, paths and limits are replaced by neutral words; details kept in the operator's private records. Nothing this record finds or decides changed.

Default refs read:
- copylot-agent 225b30c
- project-observatory cdd513e, with the code in project-observatory-open-source 5621e01
- fabric-dashboards e1593bb
- fabric-inbox 54c50a3
- asset-foundry a044b9a
- a private product agent (its ref kept in the operator's private records)
- mobile-publisher-agent 44392d1
- sshlg-growth `origin/feat/config-foundation` 169a094 (no `origin/main`; `origin/HEAD` points here)
- traffic-growth-agent `origin/master` 7c63d584
- appvillis-dataroom-agent 5ac5c81
- sshlg-brand-agent 85732cb
- the operator's private agents' repository (its ref kept in the operator's private records)
- nicegramappbot 349a1a4
- prowl-app `origin/master` c68d3afe (0xDEV is the same remote; prowlagent is an empty local repo with no commits)
- nicegram-business fd671f2a (nba submodule pin 5e9b9b9c)
- sshlg-analytics c371541 and sshlg-analytics-agent ec2dc6b
- cmo-creative-agent: `origin/main` 441256c has no code; the code is on `B=origin/feat/appvillis-data-foundation-2026-10-04` 92e9b2b
- agent-stack 73eb353 and sshlg-skills e558287
- sms-activate-app-website 28801f7
- screen-record-studio dab2e937
- dataroom b10e6aa
- longevity-app 92fd9fb3 (stale; the evidence is on `origin/agent/claude/AIONB-80`)
- webpilot fee1f4c (stale; the evidence is on `origin/claude/fabric-service-20261005`)
- fabric-agent-contract 1e7a7d6
- fabric-workspace ea1c487
- Fabric worktree `ux-review-1010` at 26b9fc97

Verdicts: **C** CONFIRMED · **P** PARTLY · **W** WRONG · **U** UNVERIFIED.

## 1. Per-agent rows

| Agent | (1) Caller identity | (2) On-behalf-of | (3) Levels / money | (4) Status |
|---|---|---|---|---|
| copylot-agent | **C**. One token: `src/service/mcp/route.ts:34-35`. Job access is by owner workspace: `main.ts:264-270` | **C**. None in `src/service/**` | **P**. Per-tool `effect` none/draft/charge/**delete** (`fabric-agent.json:29-300`), not checked per caller. `MAX_CHARGE_EXCEEDED` per call: `db/migrations/002_execution.sql:451`. Wallet per workspace: `:445`. A scope vocabulary is only *proposed*: `config/access-policy.yaml:3,43-56` | **C**. AU-07 `docs/BACKLOG.md:111`; SP-01 `:139`; DEC-0039 one token `docs/DECISIONS.md:848-868` |
| project-observatory | **C**. stdio is one principal class, "the operator's local agent", capped at `propose` (OSS `observatory/engine/access_binding.py:18-21`). HTTP memory uses a bearer, sha256 bound to a binding (`:14-24,55-58`). Keyserver: one token, and `X-Observatory-Caller` is a label only (`tools/keyserver.py:94,102,547-555`; DEC-0242 private `docs/DECISIONS.md:12706`) | **C**. None. A binding records `issuedBy`/`via` only (`access_binding.py:52,207`) | **C**. `EFFECTS=("read","propose")` (`:44-51`). Assistant budgets daily/monthly/velocity: `agent/providers.py:438-444`. `use_secret.py` checks no principal | **P**. Bindings are released (0.16.0, aa6788d). OBS-55…59 are **open board rows** in OSS `docs/backlog.md:63-67`, not a design doc; there is no `grant check` code in any Observatory repo |
| fabric-dashboards | **C**. stdio MCP, no auth: `src/mcp/server.ts:1` | **P/W**. Not "its own name": it calls each service **with that service's descriptor token** (`src/core/monitor.ts:331`, `probe.ts:25-51`), which also mints login codes (`probe.ts:37`) | **P**. Control is wider than start/stop/restart: `doctor`/`update` run descriptor commands (`server.ts:86-99`). A read-only `spend` tool reports others' spend (`:118`) | **C**. Brief `:42-49,72`; FD-40 `docs/backlog.md:48` |
| fabric-inbox | **C**. CF Access service token `common_name`: `workers/mcp/keys.ts:1-6,22,101-109`. 0.15.0 also gives each console session its own key (`CHANGELOG.md:14-15`) | **C**. `X-Fabric-Accounts` narrows only: `workers/mcp/scope.ts:174-176`. It names **accounts, not a principal**. The relay uses its own token: `workers/relay/script.ts:31` | **C**. read/mail/admin `keys.ts:11,42`; drafts/send; daily 50 (max 1000) `:13-16`; expiry 30d/90d/1y `access.ts:12`; revoke `:108`; 5-minute confirm code `protocol.ts:132-148`; ledger `ledger.ts:5-31` | **P**. `CHANGELOG.md:8` has 0.15.0, but only `v0.15.0-rc.1` is tagged. Deployment of 0.15.0 is **U**. B-62 (narrowing deploy attestation) is open: `docs/evidence/backlog.md:88` |
| asset-foundry | **P**. Local: one `FOUNDRY_TOKEN` (`foundry/server.py:150-154`). The bridge key identifies a **project, not an agent**: "Tokens identify projects" (`foundry/bridge.py:8,64-117`; 7-day TTL; revoke) | **C**. `traceparent` from `_meta` (`fabric_tools.py:28-75`). Idempotency is prefixed by project (`bridge.py:248`). Toward a private product agent it uses **its own caller token** (`shared/secrets.py:276`) | **C+**. Per-project job/day/month; `approve_above_usd` (`cli.py:273`); emergency stops $500/24h and $1000/30d (`shared/budget.py:73-76`). Omitted from the row: a $50/day aggregate (`:87`) and a velocity ×6 pause (`:79-90`). Per-key tool allow-list `bridge.py:178` | **C** (docs). ADR-0012/0019/0021/0025 exist. Running: **U** (its MCP refused connection this session) |
| a private product agent | **C**. Per-caller identity (service→`agent`, caller token→`caller:<id>`, cookie→`operator`) and a CLI to add, rotate and revoke callers | **P**. It does use the **target's descriptor token** to call Copylot and Foundry. It does **not** forward `traceparent`: it only receives and echoes it | **P**. Own jobs only; no scopes. Its daily authoring cap is **global**, not per caller, and so are its money ceilings | **C**. Fabric interop accepted in its own ADR; installed locally. BL-056/057 on its own board. Paths, port and figures: details kept in the operator's private records |
| mobile-publisher | **C**. One `X-Publisher-Token` (`publisher/auth.py:3-4,99-101`); channel label `server.py:203,795`. It also has `host.token` and an operator key (`auth.py:5-10`) | **W**. Not its own name. To Foundry it sends **Foundry's own service token file** (`foundry/client.py:9-11,40-41`); to Copylot, `COPYLOT_SESSION_TOKEN` plus `X-Copylot-Owner` (`copywriter/copylot.py:16-30`) | **C**. auto/confirm/human (`changes.py:26`); approval bound to the plan hash (`:569,618-625`); freeze `:105-112`. The daily budget `app_daily_usd` is for paid data only (`facade.py:2643`) | **P**. Release `0.2.0-fdc1ec5fb30d` (`docs/HANDOFF.md:9`). ADR-0020 and ADR-0024 are not about access; the auth ADR is **ADR-0010**. No `fabric-agent.json`. `auth:"own"` is in the generated well-known (`publisher/fabric.py:54-57`): DEC-0024 adoption is **C** |
| sshlg-growth | **P**. Roles with one bearer each (`src/auth.ts:14,36-51`); Fabric service token maps to agent/reader over https (`:91-105`). Revenue: one **shared unscoped `REVENUE_TOKEN`** plus per-producer tokens (`src/revenue/routes.ts:17`, `server.ts:40-53`) | **C**. No outbound calls | **C+**. Reader routes `auth.ts:59-78`; doors read/operate `src/fabric/config.ts:65-66`. The analyst may also `guardrail-stop` (effect publish) (`mcp/capabilities.ts:286,313`) | **C**. 0.4.0 in prod (169a094). D-57 is a probe receipt, not access (`docs/runbook.md:581`) |
| traffic-growth-agent | **C**. `SurfaceToken` `packages/core/src/surface/tokens.ts:50-90,136-141` | **C**. Shared `PROWL_MCP_TOKEN` (`apps/worker/src/jobs/backlinks.ts:21-27`) | **P**. Scopes `tokens.ts:23`, checked in `surface/call.ts:70-261`. The monthly limit is a **global $50** (`packages/providers/src/budget.ts:16`), plus per-*account* bounds (`envelope.ts:60-68`). Nothing per token | **C**. `docs/ops/mcp-surface.md:3,166-169` |
| appvillis-dataroom-agent | **C**. `appvillis_agent/__main__.py:15-34`; job store per consumer `service.py:90-110` | **P**. No agent calls. The relay uses a shared env `LOG_EVENT_TOKEN` (`automations/dataroom/notification_relay.py:48-72`) | **P**. Vocabulary is wider than listed: `stores:*`, `marketing:*`, `costs:write`, `collection:read` (`agent_queries.py:19-33`, `external_cycle.py:234`) | **P**. Prod evidence `docs/evidence/2026-10-10-production.md:128`. Plan §9 is decisions, not a prod receipt |
| sshlg-brand-agent | **C**. `service.token` guards only the events feed (`brandagent/server.py:114-117`); board has no token (`:22-27,166`); AU1 `docs/evidence/backlog.md:89` | **P**. `WEBPILOT_CALLER_TOKEN_BRAND_AGENT`, falling back to the **shared `WEBPILOT_MCP_TOKEN`** (`publishers.py:345-369`). `approvedBy` is the literal `"owner"` (`:497`) | **C+**. L0–L3 `autonomy.py:3-11`; HMAC grant on digest ≤ 24 h (`grants.py:8-91`), with the **HMAC key shared with WebPilot** (`:13-15`); $100 base and **$300 video ceiling** (`plan/strategy.json:1944-1945`) | **C**. `ee6c3f7`; `docs/evidence/retro.md:50` |
| the operator's private agents (one repository: a lifecycle broker, the operator's notification agent, an ad-operations bot) | **P**. The ad-operations bot's owner token is only an MCP memory facade, **off in prod**; live surfaces use env bearers plus an HMAC cookie. The lifecycle broker: a sha256 token hash, a grant revision, allowed tools and targets, allowed callers, an operator proxy. The notification agent: one token | **P**. Own bearers, no actor header. `actor` exists only inside the notification relay as the Telegram sender check | **P**. The confirm-gate (bound to an intent signature) is the ad-operations bot's only; its auto-publish bypasses it. No wallet | **P**. The lifecycle broker's `auth:"own"` **C**. The relay's prod deployment is pending. The lifecycle broker is local launchd, not hosted. Paths: details kept in the operator's private records |
| nicegramappbot | **C**. `FABRIC_SERVICE_TOKEN` (`config.py:565`, `web/fabric.py:140-153`), `auth:"descriptor"` (`:398`) | **C**. None | **P**. MCP is read-only (`web/mcp.py:10-13`). The same token mints a **write-capable operator console session** (`fabric.py:60-61,922`). Monthly model budget per service (`:278-287`) | **C**. `docs/handoffs/2026-10-09-community-moderator/README.md:95` |
| prowl | **P**. `ApiKey` `prowl_…` (`persistence/models.py:150-165`). OAuth tokens resolve to an API-key row (`web/oauth_provider.py`), so this is **one mechanism**. Prowl sees the user and key, never the agent | **C**. `PROVIDER_COUNT = 17` exactly (`mcp_server/_contracts.py:89`) | **C**. `key_policy.py:15-173`; IP allowlist `auth.py:509-521`; 120/min; hold→settle `wallet.py:1171,1216`. The wallet is per user; keys only cap | **C**. `docs/DEPLOYMENT.md:3-20` |
| nicegram-business | **P**. s2s is one bearer per direction plus HMAC (`nba:lib/s2s-inbound.ts:11-18`). The MCP token is **per connection, bound to one account**, not per org (`app/api/v1/mcp/route.ts:36-58`; `McpConnection.account_id`) | **P**. Org travels in the `X-Org-Id` **header** (`s2s-inbound.ts:122`); the actor is in the body and **enforced** (`403 actor_not_grant_recipient`, `contracts/account-session-connect.openapi.yaml:6986`) | **P**. DEC-0441 `DECISIONS.md:5353`, 0489 `:5843`, 0490 `:5857`. DEC-0656 (`:8118`) is re-issue UX, not delegation. MCP tiers R/L/W are missing from the row (`MCP_AGENT.md:221-234`) | **P/W**. Human delegation is in prod. MCP is **deferred and returns 404 in prod** (`nba:docs/CORE_RELEASE.md:37,74`; DEC-0614). The cite is `SECURITY.md:390-398`, and those lines are *requirements* |
| sshlg-analytics | **P**. The App Key is public (it ships in the app), so it identifies an app but is not a credential. The readonly ClickHouse user `growth_reader` is for **sshlg-growth**; the operator uses the full user (`scripts/clickhouse-admin.sh:7-13`). The Fabric adapter's `FABRIC_SERVICE_TOKEN` is missing from the row (`scripts/fabric-service.py:7-15`) | **P**. It reads growth's DB directly via `docker exec` (`scripts/event-privacy.py:82-99`) | **P**. There is no read/ingest/admin vocabulary, only separate mechanisms | **C**. `README.md:7-25` |
| cmo-creative-agent | **C**. `B:fabric-agent.json`: one local-runner capability, no surfaces. The protocol section's claim that cmo **adopted `auth:"own"`** is **W**: it is planned as R15-08 (`B:docs/development/plan.json:18555-18564`) | **P**. It uses the org-wide shared `appvillis/prod/META_ADS_TOKEN` (`B:docs/adr/0004-autonomous-paid-cmo.md:56-57,137`) | **C**. `B:cmo_agent/creative/authorize.py:1-68` (≤ 7 d); L0–L4 `execution/autonomy.py:58`. Only L1 is built | **C**. ADR-0004 and the code are on B only. R07-28 (standing authorization ≤ **30 d**) is PLANNED and does **not** wait on `grant check` (`B:docs/development/tasks/R07-28.md`) |
| sshlg-skills | **C**. No service | — | — | **P**. `gateway.md` is in **agent-stack** (`plugins/agent-stack/skills/agent-interop/references/gateway.md:49,54,108-109,160`), not sshlg-skills. "No on-behalf-of mechanism" is **C** |
| sms-activate-app-website | **W**. It publishes an LLM-agent API with personal `vpn_…` Bearer keys (`server/api-docs.ts:696,894-902`; `README.md:947`) | **P/W**. The HMAC is site→bot (`server/internal-signature.ts:4-27`). An **act-as** channel exists: `x-internal-api-key` + `x-act-as-user-id` (`server/account-proxy.ts:23-26`) | **P**. CSRF `account-proxy.ts:396`; rate limit `api-path.ts:17`. A user key **spends the account balance** (`api-docs.ts:901`) | **P**. In prod (v447). "No delegation" is **W** |
| screen-record-studio | **P**. A licensing/Stripe backend with one `ADMIN_TOKEN` (`backend/src/app.ts:321-337`); nothing faces agents | **C** | **U**. No task limit found | **C** |
| dataroom (nicegram) | **C**. No service | — | — | **C**. The slot-borrowing observation is on `B=origin/claude/kb-registry-20261011` only (`docs/handoffs/2026-10-11-knowledge-base/design.md:93-97`; `brief.md:28`). The operator's permission for it is **U** (no record) |
| longevity-app (AION) | **C** (branch only). App Attest `B:apps/api/src/attest/app-attest.ts` | **W**. The revenue token is **per producer** `REVENUE_TOKEN_AION` (`B:.do/app.production.yaml:133`), not shared | **P**. Also `link-proof` writes. AI spend is a per-tier turn quota, not USD (`B:packages/domain/src/agent/quota.ts:1-18`) | **C**. H-36; `B:docs/plan/live-plan.md:49` |
| webpilot | **C**, but on branch B only (`origin/main` fee1f4c has none of it). `B:src/service/callers.ts:16-52`; per-caller jobs `mcp/jobs.ts:90,162`; ADR-0016 | **C** (B) | **C** (B). `callers.ts:9-28`; ceiling `api.ts:235`; grant `src/delegation/grant.ts:10-159`; `effect-not-delegable` `mcp/flows.ts:121`. Single use is **U**: replay returns the earlier result (`act.ts:117`) | **P**. "In prod" means a local launchd build 5e50878, **itself only on B**. C17 (045f698) is on B, "done, not deployed" (`B:docs/evidence/2026-10-11-projects-handoff.md:10-11`) |

Corrections to the roll call's "Что общее" (what the rows have in common):
- **Item 2, nobody passes on-behalf-of:** **C**. It is stronger than stated. `traceparent` is **not** forwarded by the private product agent; it only receives and echoes it.
- **Item 3, borrowing the callee's agent token:** **C**, and wider than stated. Besides the private product agent→Copylot/Foundry and publisher→Foundry, **fabric-dashboards uses every service's descriptor token**. Foundry→the private product agent is the counter-example: it uses a caller token issued by that agent.
- **Item 4, money per project or service:** **C**. The roll call presented the private product agent's daily limit and traffic-growth's monthly limit as caller-level; both are global. Only webpilot (on branch B) budgets per caller.
## 2. "Already in protocol": the cited lines checked

Refs: fabric-agent-contract `origin/main` 1e7a7d6; fabric-workspace `origin/main` ea1c487 (re-fetched; newer than the roll call); project-observatory `origin/main` cdd513e; project-observatory-open-source `origin/main` 5621e01.

| Claim | Verdict | Evidence | Correction / note |
|---|---|---|---|
| fabric-service/0.1: one descriptor token per service, `service.md:470-495` | PARTLY | The rule itself is at `docs/specification/service.md:250-252`: the token is in `auth.tokenFile`, mode 0600, header only. Lines 470-494 are the Surfaces table plus *MCP credentials*. `:481-484`: the descriptor token is the **host's** credential (well-known, feed, usage, login code), and by default MCP takes it too | The cite should be `:250-252` + `:481-494`. `:256-258` adds the same-user floor: "Loopback reachability is not authorization" |
| DEC-0024 allows `surfaces.mcp.auth: "own"` but does not require it (`DECISIONS.md:437`) | CONFIRMED (path) | The file is `docs/DECISIONS.md:437-466`. Status: "Accepted source change; consumer adoption pending" (`:440`). Spec at `service.md:486-494`; schema at `schemas/service-well-known.schema.json:208` | Adopters: the private lifecycle broker CONFIRMED (path kept in the operator's private records). cmo is **WRONG**: only planned as R15-08, and it has no surface. Mobile-publisher CONFIRMED (generated well-known `publisher/fabric.py:54-57`) |
| Copylot refused it: DEC-0039/FD-07 "one token" | CONFIRMED | copylot-agent `docs/DECISIONS.md:848-868`, `docs/BACKLOG.md:51` | DEC-0039 is **Copylot's** own DEC, not a contract DEC. The contract ends at DEC-0038 |
| `service.md:173` forbids caller identities in usage | CONFIRMED | `service.md:172-173`: "MUST NOT put prompts, outputs or caller identities in it" | — |
| interop C3.5 hub `agent.call` (`interop.md:190-196`); the callee does not learn the original caller | CONFIRMED | `docs/specification/interop.md:190-201`: "Fabric enforces the caller's MCP access binding (ADR-0026), mints the callee's credential itself, and journals one span per hop". `schemas/interop-agent-call.schema.json` takes exactly `{agentId, capability, input, idempotencyKey?}` with `additionalProperties:false`. `schemas/interop-request-meta.schema.json` carries `traceparent`/`tracestate`/`baggage` only | No schema anywhere carries a caller, principal, chain or `grantRef` toward a callee. The only cross-hop link is `traceparent`. `memory-and-learning.md:14-17` makes "Fabric the authority for caller scope" for memory only |
| DEC-0037/0038: `spend-policy.md:61-91`; grant `spend` block | CONFIRMED | `docs/DECISIONS.md:1269-1331` (DEC-0037), `:1333-1362` (DEC-0038, amends `limitUsd/period` to `mode` + `limits[{window,limitUsd}]`). `spend-policy.md:40-54`. `schemas/governance.schema.json:26-32` | — |
| `principalKind: agent \| session \| external` | CONFIRMED | `schemas/governance.schema.json:26` | — |
| grant-check: "allowed + receipt + reservation" or "denied + code + level" | CONFIRMED | `schemas/grant-check.schema.json` (allowed requires `receipt, grantRef, reservedUsd, expiresAt, checkedAt`). `spend-policy.md:83-95`. Denial codes `limit-reached, no-grant, grant-expired, grant-revoked, principal-unproven, credential-source-refused, unknown-state` (`:89-90`). Levels L0-L3 | This is the only **contract-level** refusal-code set for authority today |
| Principal proven by a per-session token the registry issues | CONFIRMED | `spend-policy.md:61-71`; `DECISIONS.md:1298-1300`. Also: "a label the caller supplies about itself is advisory" (`:67`) | It defines **no wire field** for presenting that token to a callee. It authenticates the agent to the **registry** only |
| `byGrant` attribution | CONFIRMED | `schemas/service-usage.schema.json:58-69` (`grantRef`); `spend-policy.md:85-88` | Contradiction 4 holds only if `grantRef` is opaque. Nothing tells a callee which `grantRef` a call is under, so a callee cannot fill `byGrant` |
| No consumer has adopted DEC-0037/38 | CONFIRMED | DEC-0038 `:1336` "before any consumer adopted it". `grant check` code: none in project-observatory, project-observatory-open-source or project-observatory-contract (G1 grep) | — |
| `governance-and-roles.md:15-30` effect classes | CONFIRMED | `:16-31`: publish/send/reply/charge/delete/merge/deploy/change-policy; default `draft-only`; standing-grant fields | — |
| authority.md: rules, L0-L3, $1,000, product table "not filed yet" | PARTLY (stale) | `knowledge/authority.md:9-24` (3 rules), `:29-38` (levels), `:50-51` ($1,000), `:53-58` (owner pays, DEC-0038). At ea1c487 a new section `:63-91` "One delegation model (in progress)" already restates P1-P8 and the 6 contradictions and names CO-258/ADR-0144 | The Fabric row now says `CO-258` (`:103`); the others are still "not filed yet" (`:101-105`). **Inconsistency:** authority.md's L0 is "each upstream key's ceiling, plus one estate total" (`:35`), spend-policy.md's L0 is the estate total only (`:20`). authority.md `:101` claims the contract put "`grantRef` on execution context", but **no contract schema has it** (see C3.5 row) |
| RM-03 "per-agent grants", `roadmap.md:86,173-218`, research, open | CONFIRMED | `knowledge/roadmap.md:86` (`research \| open`), `:173-218` | — |
| Observatory `ARCHITECTURE.md:604`: identity and grants are the gateway's | CONFIRMED | project-observatory `docs/ARCHITECTURE.md:604`: "Gateway owns identity and grants … this server holds no caller identity". Gateway retired 2026-09-14: `docs/DECISIONS.md:12630-12638` | The line is stale, and it contradicts Observatory's own `access_binding.py`, which holds principals (open-source `observatory/engine/access_binding.py:14-58`) |
| OBS-55…59 exist only as design | PARTLY | They are **open board rows**, not a design doc: project-observatory-open-source `docs/backlog.md:63-67`. OBS-55 registry + `grant check`; OBS-56 estate cap; OBS-57 `use_secret run` authorizes; OBS-58 per-project keys; OBS-59 durable approvals. None are in private project-observatory or in org-index | "In Observatory there is neither a design doc nor code" is right. They exist as board rows only, on the open-source repo's board |
| Board rows waiting | CONFIRMED (sample) | Switchboard `docs/evidence/backlog.md:79` (SB-72), `:103` (SB-96), `:104` (SB-97, grant id in usage). the private product agent's own board (BL-056/057). brand `docs/evidence/backlog.md:89` (AU1). FD-40 `fabric-dashboards docs/backlog.md:48`. Copylot `BACKLOG.md:111,139` | CMO R07-28 does **not** wait on `grant check`: its blockers are internal (G3, `cmo B:docs/development/tasks/R07-28.md`) |

## 3. Fabric's own side (worktree `ux-review-1010`, HEAD 26b9fc97, branch `agent/release-040-wave1`)

### 3.1 Principals and the credential each holds

| Principal | Credential | Where held / checked | What it may do |
|---|---|---|---|
| **Launched session** (PTY, coding agent Fabric started) | one-shot bearer, spent on one MCP `initialize`, then bound to the transport's session id (never on disk) | `agentSurface.ts:23-35`; minted by `AgentSurface.mint`; written into the session's `mcp.json` as `Authorization: Bearer` (`sessionBundle.ts:154-158,291-303`) | session tools (`fabric_*`, `com.*`) scoped to one estate/project/session; "the scope is the credential's, never the caller's claim" (`agentSurface.ts:21-22`); board principal `{kind:'agent', id: sessionId, provenance:'trusted'}` (`agentSurface.ts:2261-2266`) |
| **Door** (any agent on the Mac) | door token: 32 random bytes, base64url, file 0600 named by `hub.json`, **shared by every agent**, rotated each start | `hub.ts:98-123`; matched at `agentSurface.ts:737-738` | `fabric.access.request`, `fabric.access.status`, `fabric.session.enroll` (resolves the folder only) (`hubTools.ts:63`); 5x budget (`agentSurface.ts:766-767`) |
| **Binding** (registered agent after operator Allow) | long-lived binding credential; Fabric stores only its sha256 `verifier` (`access_bindings.verifier`, migration 76 `:80-97`); handed over once at first status read (`:10-13`); enrolled coding agents keep it in `enrollments/<runner>.credential` 0600 (ADR-0134 Amendment 1 `:62-66`) | lookup `agentSurface.ts:740-753` | `agent.call`, `fabric.access.grants`, request, status, enroll (`hubTools.ts:64`) |
| **Enrolled session** (ADR-0134, third principal) | the same one-shot session bearer as a launched session, minted only if the binding holds a live grant `callee=fabric, capability=session.enroll, resource=project:<uuid>` | `sessionEnroll.ts:44-68`; journals `session.enrolled@1` with `binding_id`, `grant_id`, `runner` (`:54-63`) | the session tool catalogue for one project, no task |
| **Fabric toward a product** | **one credential per connected product** (Cloudflare Access client id + secret), secret in Observatory's vault, read per call | `product_connections` (migration 76 `:134-154`, `level in (read,mail,admin)`, `send in (drafts,send)`); ADR-0115 §4 (`:97-120`) | forwarded calls |
| **Session → project MCP servers** (M127) | machine **agentgateway** role key `FABRIC_AGW_KEY` from Fabric's env, sent as `x-agw-key` | `gateway.ts:1-33`; `sessionBundle.ts:160-167,293-323`; allowlist `projects.mcp_servers` (`index.ts:905-915`) | reach a project's declared servers. **The gateway was retired 2026-09-14** (Observatory `DECISIONS.md:12630`), so this path is a live code path with a dead backend |

### 3.2 What the hub stores

- `access_requests` (migration 76 `:47-73`): agent_id, callee, capabilities[1..32], resources[1..64], reason, registry snapshot, `asked_by_binding`, 10-minute expiry, status pending/allowed/denied. Migration 77 `:75-76` adds `poll_verifier`.
- `access_bindings` (`:80-97`): verifier only; claimed/revoked.
- `access_grants` (`:103-124`): binding × callee × **one capability** × **one resource**, decided_by/at, `expires_at` required (≤ 366 d, migration 82 `:12`; default 1 y, `shared/access.ts:21`), revocable. It has **no amount, no spend, no window and no payer**.
- Callees admitted: `CONNECTABLE_PRODUCTS = ['fabric-inbox']` plus `fabric` itself for `session.enroll` (`shared/access.ts:29-37`). The hub's grant store covers **no other agent**.
- Legacy one-shot `grants` (migration 1 `20260831000001_migration_one.sql:80-90`): `floor_class in (money, deletion, publication)`, target, precondition, expiry, `consumed_at`. **ADR-0028**, not ADR-0023 (ADR-0023 is the Cedar-style policy port, `docs/adr/0023-…md:9-27`; no `PolicyDecisionPort` exists in code). It is single-use through `grant_reservations` (migration 34 `:66-80`). It is issued as `grant.issued@1` (`policy.ts:166-173`). Its refusals are prose `{verdict:'refuse', reason, needs}` (`policy.ts:354-388`). "M137" matches nothing in the repo (`git grep M137`). The table is kept apart on purpose (migration 76 `:30-31`).
- `agent_bindings` (migration 1 `:63-76`): role per project (one PM). This is a **role assignment, not a credential**, and it is unrelated to ADR-0026 bindings.
- ADR-0026 (`docs/adr/0026-…md:30-53`): "every credential resolves to one immutable MCP access binding" with project ids, scopes, effect ceiling, expiry. Point 8: workers "never receive the external MCP credential". The hub's `access_bindings` + `access_grants` is the shipped subset. There is no effect ceiling column and no project-id set.

### 3.3 What a callee receives on `agent.call` (forwarded)

`productForwarder.ts:96-100,174-176`: headers `CF-Access-Client-Id`, `CF-Access-Client-Secret` (**Fabric's** product credential, the same for every caller), `X-Fabric-Accounts` (the granted mailboxes, narrowing only), and `_meta.traceparent`. There is **no** caller agentId, binding id, grant id, chain or approval. The `idempotencyKey` is not forwarded either; Fabric keeps it itself (`hubCall.ts:32-36`). Fabric Inbox therefore attributes every hub call to the `fabric` key's `common_name`.

What Fabric keeps instead: one `hub.call.forwarded@1` span per hop, with caller binding, callee, capability, args hash, `grant_ids`, outcome and `error_code` (`hubCall.ts:14-21`; migration 76 `:44`). Repeated refusals are summarised as `hub.call.refusals.summarized@1` (migration 82 `:27-33`). Attribution lives **only in Fabric's journal**.

Calls to any local fabric-service agent through the hub are refused with `unknown-callee` (`hubCall.ts:371-373`). Agent-to-agent calls between local services today do not go through Fabric at all, despite C3.5's "the only route between agents".

### 3.4 Refusal codes in Fabric

- `agent.call` (`hubCall.ts:337-450`): `invalid-arguments`, `unknown-callee`, `access-required` (carries the ready `fabric.access.request` arguments, `shared/access.ts:460-476`), `product-not-connected`, `product-credential-unavailable`, `product-error`, `outcome-unknown`, `hub-unavailable`, `cancelled`.
- Forwarder (`productForwarder.ts:68`): `product-unreachable`, `product-refused`, `product-error`, `product-outdated`, `cancelled`.
- Enroll (`sessionEnroll.ts:14-16`): `needs-grant`, `no-project`, `bad-folder`.
- Connect (`shared/access.ts:582-586`): 20 codes (`hub-off` … `not-connected`).
- Hub down (`shared/access.ts:656`): `port-setting`, `port-claimed`, `port-taken`, `not-started`.
- Floor (`policy.ts`): prose reasons, no codes.
- None of these overlap the contract's grant-check codes. The closest pairs are `access-required` ≈ `no-grant` and `outcome-unknown` ≈ none.

## 4. Distinct mechanisms: raw material for one decision

### 4.1 Identity issuers (who mints the credential a caller presents)

| # | Mechanism | Issued by | Granularity | Users |
|---|---|---|---|---|
| I1 | Descriptor service token (`auth.tokenFile`, 0600) | each service, for its host | one per service, shared by all callers | copylot, nicegramappbot, sshlg-analytics-agent (agent class), research-agent (`local`), Foundry local, brand events feed. Also **borrowed** by fabric-dashboards, the private product agent and mobile-publisher to call others (contract `service.md:250-252`) |
| I2 | Per-caller token minted by a service CLI, sha256 stored | the callee | per calling agent | the private product agent's client CLI, research-agent `consumers add`, webpilot (B), traffic-growth `SurfaceToken`, appvillis `Principal`, sshlg-fabric-server `sfs_…` per source |
| I3 | Per-project bridge key | callee (Foundry `bridge.py:64-117`) | per project | asset-foundry |
| I4 | Role bearer | callee env | per role | sshlg-growth, sshlg-analytics-agent, the ad-operations bot's views, research-agent roles |
| I5 | Credential hash + grant revision | broker policy | per caller × tools × targets | the private lifecycle broker (path kept in the operator's private records) |
| I6 | IdP service token (Cloudflare Access `common_name`) | the product's app, on a person's Allow | per key | fabric-inbox; Fabric holds one (`product_connections`) |
| I7 | Per-user API key / OAuth (resolving to the key) | product | per user | prowl, sms-activate (`vpn_…`), nicegram-business MCP (per connection) |
| I8 | Self-named label | caller | none (advisory) | Observatory keyserver `X-Observatory-Caller`, publisher channel label |
| I9 | Fabric session one-shot bearer | Fabric (`AgentSurface.mint`) | per session × project | sessions Fabric launches; enrolled sessions (ADR-0134) |
| I10 | Fabric door token (shared) + binding credential (sha256 verifier) | Fabric hub, on operator Allow | per Mac / per agent | registered agents, coding agents (ADR-0115/0134) |
| I11 | Observatory access binding (bearer sha256, principal, audience, scopes, expiry) | Observatory | per principal | Observatory HTTP memory (OSS `access_binding.py:14-58`) |
| I12 | Registry per-session token | Observatory registry (designed only) | per session × agent × project | DEC-0037, `spend-policy.md:61-71`. **No implementation** |
| I13 | agentgateway role key `x-agw-key` | the retired machine gateway | per role | Fabric `sessionBundle.ts:160-167` (M127). **Its backend was retired 2026-09-14** |
| I14 | stdio (no credential; OS process) | — | none | Observatory MCP, Dashboards MCP, Switchboard MCP |
| I15 | Operator session cookie / login code minted with the descriptor token | each service | operator | most fabric-service agents (contract DEC-0024 rationale) |

### 4.2 Grant and authority stores

| # | Store | Shape | Amount? | Users |
|---|---|---|---|---|
| G1 | Fabric `grants` (ADR-0028, migration 1 `:80-90`) | floor_class money/deletion/publication × target, one-shot (`grant_reservations`) | no | Fabric effects floor |
| G2 | Fabric hub `access_grants` (ADR-0115, migration 76 `:103-124`) | binding × callee × capability × resource, expiry ≤ 366 d | no | Fabric→fabric-inbox, `session.enroll` |
| G3 | Contract standing grant + `spend` (DEC-0037/38, `schemas/governance.schema.json:26-32`) | principalKind, windows, payer owner, credentialSource | yes | nobody yet |
| G4 | Observatory registry (OBS-55, OSS `docs/backlog.md:63`) | as G3 plus `grant check` | yes | design row only |
| G5 | Observatory access bindings (`access_binding.py`) | principal × scopes × project × effect ceiling | no | Observatory memory |
| G6 | Inbox keys (`workers/mcp/keys.ts`) | level × send × accounts × expiry × daily send limit | send count | fabric-inbox |
| G7 | lifecycle grants (`allowedTools/Targets`, `grantRevision`) | caller × tool × target | no | the private lifecycle broker |
| G8 | WebPilot/brand HMAC grant on payload digest (≤ 24 h) | `{grantId, issuer, approvedBy, approvedAt, expiresAt, payloadDigest, signature}` (`grants.py:90-91`); key shared by brand and webpilot | no | brand, webpilot (B) |
| G9 | Prowl key policy (allow/deny categories, day/total spend claim) | per key against a user wallet | yes | prowl |
| G10 | nicegram-business PersonalDelegationGrant + dispatch admission (`request_fingerprint` JCS SHA-256) | person → recipient × chats × actions × expiry | no | nicegram-business |
| G11 | cmo spend authorization (TTY, `cmo.spend-authorization/1`, ≤ 7 d; standing ≤ 30 d planned) | amount × currency × validity | yes | cmo (B) |
| G12 | Project MCP server list `projects.mcp_servers` (M127, `index.ts:905-915`) | project × server names | no | Fabric sessions via the gateway |
| G13 | Copylot proposed `access-policy.yaml` | project_service_token + grants + scopes | — | proposal only (`config/access-policy.yaml:3`) |

### 4.3 Money limits (none per calling agent, except webpilot B and research-agent's consumer ownership)

Per service or global:
- Foundry: project job/day/month, $50/day aggregate, emergency $500/24h and $1000/30d.
- the private product agent: a global daily job cap and global money ceilings (figures kept in the operator's private records).
- traffic-growth: $50/month global.
- research-agent: lanes $70/$63; orders over $0.50 wait for the operator.
- nicegramappbot: monthly model budget.
- sshlg-analytics-agent: `MODEL_BUDGET_USD`.
- Observatory assistant: daily/monthly/velocity.
- brand: $100 base, $300 video.
- publisher: `app_daily_usd`.

Per call:
- copylot `maxChargeUsd`.

Per caller and project:
- webpilot (B only).

Contract levels: L0–L3 (`spend-policy.md:14-23`).

Estate total: $1,000/month (`authority.md:50`). Enforced by nobody (OBS-56 open).

### 4.4 Approval formats (no two alike; none portable)

| Format | Binding | Channel | Users |
|---|---|---|---|
| plan hash approval row | `{change_set_id, hash}` | operator session | mobile-publisher (`changes.py:569-625`) |
| HMAC grant on text digest | payload digest, ≤ 24 h | board (no auth, AU1) | brand, webpilot |
| TTY ceremony, two typed confirmations | cap × currency × validity, local integrity only | TTY | cmo |
| Telegram second press / intentSig | SHA-256 of intent, consume-once | Telegram | the ad-operations bot; Foundry (ADR-0025) |
| 5-minute confirm code | per irreversible action | tool round-trip | fabric-inbox |
| one-use dispatch admission (JCS SHA-256) | request fingerprint | product UI | nicegram-business |
| operator Allow on a request (device-style consent) | request id → binding + grants | Fabric UI | Fabric hub |
| `grant.issued@1` one-shot floor grant | floor class × target | Fabric UI | Fabric |
| durable approval request + operator-channel confirm token (DEC-0034 OC-6) | `approvalRequest` in grant-check | operator channel | contract only (DEC-0037; OBS-59 open) |
| draft → operator acts | — | operator surface | sshlg-growth, sshlg-analytics-agent (D-71) |

### 4.5 Refusal code sets (all disjoint; none uses the contract's)

- **Contract grant-check:** `limit-reached, no-grant, grant-expired, grant-revoked, principal-unproven, credential-source-refused, unknown-state` (`spend-policy.md:89-90`).
- **Fabric hub:** `access-required, unknown-callee, invalid-arguments, product-not-connected, product-credential-unavailable, product-error, product-unreachable, product-refused, product-outdated, outcome-unknown, hub-unavailable, cancelled, needs-grant, no-project, bad-folder`. Fabric floor: prose reasons only.
- **Observatory bindings:** `no-credential, no-binding, audience-mismatch, binding-revoked, binding-expired, scope-not-bound, effect-above-ceiling, project-not-bound, …` (`access_binding.py:60-74`). Assistant: `budget-unset, budget-reached`.
- **copylot:** `unauthenticated, unbound, forbidden, rate-limited, unknown-job, max-charge-exceeded, insufficient-funds, payg-disabled, payg-cap-exceeded, execution-disabled, idempotency-conflict`.
- **publisher** (snake_case): `unauthorized, operator_session_required, approval_required, writes_frozen, mode_disallows, plan_stale, budget_exceeded, rate_limited, credentials_missing, foundry_refused`.
- **the private product agent:** nine codes of its own (details kept in the operator's private records).
- **traffic-growth:** `-32001 unauthorized, no_such_tool` (used for a missing scope too), `bad_arguments, no_grant, grant_revoked, bound_reached{…}`.
- **sshlg-growth:** `unauthorized, forbidden, rate_limited, dependency_unavailable`.
- **sshlg-analytics-agent:** `unauthorized, forbidden, rate_limited, budget_exhausted, dependency_unavailable, …`.
- **appvillis:** `forbidden, operator_session_required, login_expired, request_origin_forbidden, request_header_required`.
- **brand:** `authorization_mismatch, authorization_expired, bad_signature`. Via webpilot: `wrong_account, target_not_allowed, cap_reached`.
- **lifecycle:** `unauthorized, denied, policy_changed, held_off, not_enrolled, idempotency_conflict, invalid_authority`.
- **nicegram-business:** `unauthenticated, token_expired, relay_revoked, scope_denied, actor_not_grant_recipient, …`.
- **cmo:** `approval_required, approval_reused, authorization_revoked, confirmation_expired, cap_below_plan_budget, validity_too_long, …`.
- **research-agent:** `approval-required`.
- **Prose or HTTP status only:** fabric-inbox, fabric-dashboards, asset-foundry (plus budget pause causes), prowl (`daily_spend_limit` and similar as text).
  - *Correction, 2026-10-12 (from asset-foundry-00, its W-022; this record is otherwise as of 2026-10-11):* Asset
    Foundry no longer belongs here. Since its wave 1 (release 0.2.0-98da9aeb812c, main `5f3f76f`), every code a caller
    can receive over MCP is listed in its caller skill's `references/errors.md` — 123 codes, held by
    `tests/test_errors.py`; the Fabric-tool codes are kebab-case (`unknown-job`, `store-corrupt`, `job-failed`,
    `tool-error`, `refused`).

### 4.6 Scope / level vocabularies ("level" means at least eight things)

- **Contract:**
  - effect classes publish/send/reply/charge/delete/merge/deploy/change-policy, default `draft-only` (`governance-and-roles.md:16-31`);
  - spend levels L0–L3 (`spend-policy.md:14-23`). authority.md's L0 differs ("each key's ceiling plus estate total", `:35`).
- **Fabric:**
  - floor classes money/deletion/publication;
  - hub capability = the callee's tool name, resource = `cloudflare:<addr>`/`gmail:<id>`/`project:<uuid>`;
  - `product_connections.level` read/mail/admin (Inbox's vocabulary hard-coded, migration 76 `:142-143`).
- **Inbox:** read < mail < admin, drafts|send, accounts[].
- **Observatory:** `memory.read/search/record/checkpoint/handoff`, effects read/propose, class ceiling public/project-internal/confidential.
- **traffic-growth:** `estate:read`, `metrics:read`, `audit:write`.
- **appvillis:** `aggregates:<p>`, `team_totals`, `operator`, `dashboard:refresh`, `stores:*`, `marketing:*`, `costs:write`, `collection:read`.
- **sshlg-growth:** roles operator/reader/agent/analyst; doors read/operate.
- **sshlg-analytics-agent:** caller class operator/agent × tool effect none/draft.
- **copylot:** effect none/draft/charge/delete; proposed `content.*`, `billing.manage`.
- **publisher:** auto/confirm/human.
- **Autonomy levels:** brand L0–L3 per channel; cmo L0–L4 × operation class.
- **nicegram-business:** owner/admin/member, MCP R/L/W, `read:messages`.
- **Prowl:** provider categories, OAuth scope `mcp`.
- **Tool lists:** lifecycle tools × targets; Foundry bridge tool list × project.

## 5. What the roll call missed

**Agents with a service surface absent from the table:**
- **research-agent** (`origin/main` 8c9aaea). Per-consumer tokens via `research-agent consumers add`, sha256 stored; "subscriptions, orders and spend belong to that name" (`src/research_agent/consumers.py:1-12`); `agent:<name>` (`mcp_server.py:123-136`). Roles service/host/operator (`auth.py:31-34`). Lane caps; orders over $0.50 wait for the operator (`config/budgets.yaml:7-20`); `approval-required` (`desk.py:15,234`). It is the **only agent that attributes spend to the calling agent by name**. `synthesis/agent-estate.md:62` still calls it "design stage", which is stale.
- **fabric-switchboard** (d852781). stdio MCP with **write** tools (`switchboard_chain_set`, `switchboard_openrouter_model`, `crates/switchboard-cli/src/mcp.rs:61,66`), so there is no caller identity. One OpenRouter key per service from the vault (`switchboard-core/src/agent_keys.rs:1-8`). SB-96 says chain pins can borrow any project's key (`docs/evidence/backlog.md:103`). The roll call lists its rows but not the agent.
- **sshlg-fabric-server** (6b6b102, Heroku). Per-source `sfs_…` tokens with scopes `emit/read/ack` and a kind allowlist (`src/auth.mjs:4-32`). It is a scoped-token scheme of its own.
- **sshlg-analytics-agent** (ec2dc6b). It is a separate agent; the roll call's "sshlg-analytics" row describes Aptabase. Caller class operator/agent via one shared bearer (`src/fabric/service.ts:174`, `src/mcp/registry.ts:10`). It calls sshlg-growth with its own role token `ANALYST_TOKEN` (`src/growth/client.ts:9,57`). `MODEL_BUDGET_USD`; 60 asks per hour per caller class.
- **agentic-inbox** (93b86c6). CF Access JWT; "once a teammate passes the shared Access policy, they can access all mailboxes" (`workers/app.ts:62-80`). Its `/mcp` has no per-caller identity (`:83-88`).
- **passioncode-platform** (ca8111d). Intake HMAC shared with the site Worker, plus one admin token (`src/config.ts:57,89`). No agent callers.
- **The ad-operations bot** is a separate estate agent, folded into the private agents' row. A standalone checkout of it is a stale copy; the source lives in the private agents' repository (paths kept in the operator's private records).
- **Fabric hub** appears only in the protocol section, not as a row. It is both a caller (Fabric→Inbox with one key) and a callee.

**Mechanisms missed:**
- **Fabric's dead gateway path:** M127 `projects.mcp_servers` plus `x-agw-key` from `FABRIC_AGW_KEY` (`apps/desktop/src/main/gateway.ts:1-33`, `sessionBundle.ts:160-167,293-323`). The backend was retired 2026-09-14, so a project that declares servers is refused at launch.
- **ADR-0023 policy port** (Cedar-style, `allow/deny/indeterminate` with receipts and codes like `grant_required`): accepted, but there is **no implementation** (`git grep PolicyDecisionPort` finds nothing).
- **ADR-0026's binding** (project ids, scopes, effect ceiling) is only partly realised by the hub tables: no effect ceiling, no project set.
- **The hub stores attribution only in Fabric's journal.** `hub.call.forwarded@1` holds the caller binding and `grant_ids`. The callee gets Fabric's product credential, `X-Fabric-Accounts` and `traceparent` only (`productForwarder.ts:96-100,174-176`), so Fabric Inbox attributes all hub traffic to one key.
- **C3.5 vs reality:** "Fabric's MCP is the only route between agents" (`interop.md:192`), but the hub routes only to `fabric-inbox` (`hubCall.ts:371-373`). Every local agent-to-agent call (the private product agent→Copylot/Foundry, publisher→Foundry/Copylot, Foundry→the private product agent, analytics-agent→growth, brand→webpilot) goes direct, with borrowed or per-callee tokens.
- **`authority.md:101`** says the contract put `grantRef` "on execution context". No contract schema has it: `grantRef` is only in `grant-check` and in usage `byGrant`. A callee cannot learn which grant a call is under.
- **Same-user floor:** contract `service.md:256-258`, `spend-policy.md:69-71`, Fabric `agentSurface.ts:23-35`, ADR-0134 `:49`. Every local scheme (I1, I2, I9, I10, I12) is "accidental/confused borrowing" protection only. This is a decision constraint the roll call never states.
- **Shared secrets across agents:**
  - brand and webpilot share the HMAC grant key (`sshlg-brand-agent brandagent/grants.py:13-15`);
  - sshlg-growth has an unscoped `REVENUE_TOKEN` beside the per-producer ones;
  - cmo uses an org-wide Meta token;
  - the brand agent falls back to the shared `WEBPILOT_MCP_TOKEN`.
- **Act-as / on-behalf-of mechanisms that do exist:**
  - sms-activate `x-act-as-user-id` (`server/account-proxy.ts:23-26`);
  - nicegram-business `actor_user_id`, enforced by `actor_not_grant_recipient`.
  
  These are the only enforced on-behalf-of fields in the estate. Both are human-user delegation, not agent chains.
- **Stale default branches:**
  - webpilot `origin/main` (2026-09-29) has none of its claimed access model;
  - cmo `origin/main` has no code;
  - longevity-app `origin/main` is 2026-08-16;
  - sshlg-growth has no `main`.
  
  "In prod" for webpilot and lifecycle means a local launchd install built from a feature branch.
- **Not verifiable locally:** seo-domain-intelligence (not in `~/DATA`). `inventory/agents.json` is absent from project-observatory `origin/main` and from the vault, so there is no generated agent inventory to check completeness against.

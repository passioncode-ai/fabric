# Audit W1: the delegation roll call checked against owners' sources (CO-258 / ADR-0144)

Date: 2026-10-11. This audit is read-only: nothing was edited, committed or pushed in any repository. The input was the roll call kept in the writing agent's private repository at `9f729f4`. Every repository was fetched first and then read at the owner's default remote branch with `git show` or `git grep`. Paths below are relative to the repository named in the row; for private repositories they are kept in the operator's private records. `B:` marks a non-default branch.

> **Redacted 2026-10-13 under [ADR-0096](../../../adr/0096-dated-records-are-redacted-for-publication.md):** the names of the operator's private agents and projects (every project outside the public PassionCode products), their sessions, repositories, paths, environment names and limits are replaced by neutral roles; details kept in the operator's private records. Nothing this record finds or decides changed.

Default refs read:
- the writing agent
- project-observatory cdd513e, with the code in project-observatory-open-source 5621e01
- fabric-dashboards e1593bb
- fabric-inbox 54c50a3
- the media agent
- a private product agent (its ref kept in the operator's private records)
- the store-publishing agent
- the growth service (it has no `main`; read at its default feature branch)
- the traffic agent
- the data-room agent
- the brand agent
- the operator's private agents' repository (its ref kept in the operator's private records)
- the messenger bot
- the market-data product
- the messenger business platform
- the analytics stack and the analytics agent
- the marketing agent: its default branch has no code; the code is on a feature branch (B)
- agent-stack 73eb353 and sshlg-skills e558287
- a consumer web product
- a desktop product's licensing backend
- a knowledge-base project
- a mobile app (stale; the evidence is on a feature branch)
- the browser agent (stale; the evidence is on a feature branch)
- fabric-agent-contract 1e7a7d6
- fabric-workspace ea1c487
- Fabric worktree `ux-review-1010` at 26b9fc97

The refs read in private repositories: details kept in the operator's private records.

Verdicts: **C** CONFIRMED · **P** PARTLY · **W** WRONG · **U** UNVERIFIED.

## 1. Per-agent rows

| Agent | (1) Caller identity | (2) On-behalf-of | (3) Levels / money | (4) Status |
|---|---|---|---|---|
| the writing agent | **C**. One token; job access is by owner workspace | **C**. None | **P**. Per-tool `effect` none/draft/charge/**delete**, not checked per caller. A per-call charge ceiling; a wallet per workspace. A scope vocabulary is only *proposed* | **C**. AU-07 and SP-01 on its board; its own DEC-0039, one token |
| project-observatory | **C**. stdio is one principal class, "the operator's local agent", capped at `propose` (OSS `observatory/engine/access_binding.py:18-21`). HTTP memory uses a bearer, sha256 bound to a binding (`:14-24,55-58`). Keyserver: one token, and `X-Observatory-Caller` is a label only (`tools/keyserver.py:94,102,547-555`; DEC-0242 private `docs/DECISIONS.md:12706`) | **C**. None. A binding records `issuedBy`/`via` only (`access_binding.py:52,207`) | **C**. `EFFECTS=("read","propose")` (`:44-51`). Assistant budgets daily/monthly/velocity: `agent/providers.py:438-444`. `use_secret.py` checks no principal | **P**. Bindings are released (0.16.0, aa6788d). OBS-55…59 are **open board rows** in OSS `docs/backlog.md:63-67`, not a design doc; there is no `grant check` code in any Observatory repo |
| fabric-dashboards | **C**. stdio MCP, no auth: `src/mcp/server.ts:1` | **P/W**. Not "its own name": it calls each service **with that service's descriptor token** (`src/core/monitor.ts:331`, `probe.ts:25-51`), which also mints login codes (`probe.ts:37`) | **P**. Control is wider than start/stop/restart: `doctor`/`update` run descriptor commands (`server.ts:86-99`). A read-only `spend` tool reports others' spend (`:118`) | **C**. Brief `:42-49,72`; FD-40 `docs/backlog.md:48` |
| fabric-inbox | **C**. CF Access service token `common_name`: `workers/mcp/keys.ts:1-6,22,101-109`. 0.15.0 also gives each console session its own key (`CHANGELOG.md:14-15`) | **C**. `X-Fabric-Accounts` narrows only: `workers/mcp/scope.ts:174-176`. It names **accounts, not a principal**. The relay uses its own token: `workers/relay/script.ts:31` | **C**. read/mail/admin `keys.ts:11,42`; drafts/send; daily 50 (max 1000) `:13-16`; expiry 30d/90d/1y `access.ts:12`; revoke `:108`; 5-minute confirm code `protocol.ts:132-148`; ledger `ledger.ts:5-31` | **P**. `CHANGELOG.md:8` has 0.15.0, but only `v0.15.0-rc.1` is tagged. Deployment of 0.15.0 is **U**. B-62 (narrowing deploy attestation) is open: `docs/evidence/backlog.md:88` |
| the media agent | **P**. Local: one token. The bridge key identifies a **project, not an agent** (with a TTL and revocation) | **C**. `traceparent` from `_meta`. Idempotency is prefixed by project. Toward the private product agent it uses **its own caller token** | **C+**. Per-project job/day/month limits; an approval threshold; emergency stops. Omitted from the row: an aggregate daily cap and a velocity pause. A per-key tool allow-list | **C** (docs). Its ADRs exist. Running: **U** (its MCP refused connection this session) |
| a private product agent | **C**. Per-caller identity (service→`agent`, caller token→`caller:<id>`, cookie→`operator`) and a CLI to add, rotate and revoke callers | **P**. It does use the **target's descriptor token** to call the writing agent and the media agent. It does **not** forward `traceparent`: it only receives and echoes it | **P**. Own jobs only; no scopes. Its daily authoring cap is **global**, not per caller, and so are its money ceilings | **C**. Fabric interop accepted in its own ADR; installed locally. BL-056/057 on its own board. Paths, port and figures: details kept in the operator's private records |
| the store-publishing agent | **C**. One token header; a channel label. It also has a host token and an operator key | **W**. Not its own name. To the media agent it sends **the media agent's own service token file**; to the writing agent, the writing agent's session token plus an owner header | **C**. auto/confirm/human; approval bound to the plan hash; a freeze. Its daily budget is for paid data only | **P**. A released build. The ADRs the roll call cites are not about access; its auth ADR is another one. No `fabric-agent.json`. `auth:"own"` is in the generated well-known: DEC-0024 adoption is **C** |
| the growth service | **P**. Roles with one bearer each; the Fabric service token maps to agent/reader over https. Revenue: one **shared unscoped revenue token** plus per-producer tokens | **C**. No outbound calls | **C+**. Reader routes; doors read/operate. The analyst may also stop a guardrail (effect publish) | **C**. In prod at the read commit. D-57 is a probe receipt, not access |
| the traffic agent | **C**. A per-client surface token | **C**. A shared MCP token for the market-data product | **P**. Scopes, checked per call. The monthly limit is **global**, plus per-*account* bounds. Nothing per token | **C**. Its MCP-surface document |
| the data-room agent | **C**. A job store per consumer | **P**. No agent calls. The relay uses a shared env token | **P**. The vocabulary is wider than listed: stores, marketing, costs write, collection read | **P**. A production evidence record. Plan §9 is decisions, not a prod receipt |
| the brand agent | **C**. Its service token guards only the events feed; the board has no token (AU1) | **P**. A per-caller token for the browser agent, falling back to **the browser agent's shared MCP token**. `approvedBy` is the literal `"owner"` | **C+**. L0–L3 autonomy; an HMAC grant on a digest ≤ 24 h, with the **HMAC key shared with the browser agent**; a base budget and a higher video ceiling | **C**. Its retro record |
| the operator's private agents (one repository: a lifecycle broker, the operator's notification agent, an ad-operations bot) | **P**. The ad-operations bot's owner token is only an MCP memory facade, **off in prod**; live surfaces use env bearers plus an HMAC cookie. The lifecycle broker: a sha256 token hash, a grant revision, allowed tools and targets, allowed callers, an operator proxy. The notification agent: one token | **P**. Own bearers, no actor header. `actor` exists only inside the notification relay as the Telegram sender check | **P**. The confirm-gate (bound to an intent signature) is the ad-operations bot's only; its auto-publish bypasses it. No wallet | **P**. The lifecycle broker's `auth:"own"` **C**. The relay's prod deployment is pending. The lifecycle broker is local launchd, not hosted. Paths: details kept in the operator's private records |
| the messenger bot | **C**. The descriptor token, `auth:"descriptor"` | **C**. None | **P**. MCP is read-only. The same token mints a **write-capable operator console session**. A monthly model budget per service | **C**. Its handoff record |
| the market-data product | **P**. A per-user API key. OAuth tokens resolve to an API-key row, so this is **one mechanism**. It sees the user and key, never the agent | **C**. Its provider count matches | **C**. A key policy; an IP allowlist; a rate limit; hold→settle. The wallet is per user; keys only cap | **C**. Its deployment document |
| the messenger business platform | **P**. s2s is one bearer per direction plus HMAC. The MCP token is **per connection, bound to one account**, not per org | **P**. The org travels in a **header**; the actor is in the body and **enforced** (`403 actor_not_grant_recipient`) | **P**. Its DECs on delegation; one cited DEC is re-issue UX, not delegation. MCP tiers R/L/W are missing from the row | **P/W**. Human delegation is in prod. MCP is **deferred and returns 404 in prod**. The cited security lines are *requirements* |
| the analytics stack | **P**. The app key is public (it ships in the app), so it identifies an app but is not a credential. The read-only database user is for **the growth service**; the operator uses the full user. The Fabric adapter's service token is missing from the row | **P**. It reads the growth service's database directly | **P**. There is no read/ingest/admin vocabulary, only separate mechanisms | **C**. Its README |
| the marketing agent | **C**. `B:fabric-agent.json`: one local-runner capability, no surfaces. The protocol section's claim that it **adopted `auth:"own"`** is **W**: it is planned as R15-08 | **P**. It uses an org-wide shared ads token | **C**. A spend authorization (≤ 7 d); L0–L4 autonomy. Only L1 is built | **C**. Its ADR and the code are on B only. R07-28 (standing authorization ≤ **30 d**) is PLANNED and does **not** wait on `grant check` |
| sshlg-skills | **C**. No service | — | — | **P**. `gateway.md` is in **agent-stack** (`plugins/agent-stack/skills/agent-interop/references/gateway.md:49,54,108-109,160`), not sshlg-skills. "No on-behalf-of mechanism" is **C** |
| a consumer web product | **W**. It publishes an LLM-agent API with personal Bearer keys | **P/W**. The HMAC is site→bot. An **act-as** channel exists: an internal API key plus an act-as user-id header | **P**. CSRF; a rate limit. A user key **spends the account balance** | **P**. In prod. "No delegation" is **W** |
| a desktop product's licensing backend | **P**. A licensing and payments backend with one admin token; nothing faces agents | **C** | **U**. No task limit found | **C** |
| a knowledge-base project | **C**. No service | — | — | **C**. The slot-borrowing observation is on a feature branch only. The operator's permission for it is **U** (no record) |
| a mobile app | **C** (branch only). App Attest | **W**. The revenue token is **per producer**, not shared | **P**. Also proof-link writes. AI spend is a per-tier turn quota, not USD | **C**. Its live plan |
| the browser agent | **C**, but on branch B only (its default branch has none of it). Per-caller tokens; per-caller jobs | **C** (B) | **C** (B). Per-caller budgets with a ceiling; a delegation grant; `effect-not-delegable`. Single use is **U**: replay returns the earlier result | **P**. "In prod" means a local launchd build, **itself only on B**. C17 is on B, "done, not deployed" |

Corrections to the roll call's "Что общее" (what the rows have in common):
- **Item 2, nobody passes on-behalf-of:** **C**. It is stronger than stated. `traceparent` is **not** forwarded by the private product agent; it only receives and echoes it.
- **Item 3, borrowing the callee's agent token:** **C**, and wider than stated. Besides the private product agent→the writing and media agents and the store-publishing agent→the media agent, **fabric-dashboards uses every service's descriptor token**. The media agent→the private product agent is the counter-example: it uses a caller token issued by that agent.
- **Item 4, money per project or service:** **C**. The roll call presented the private product agent's daily limit and the traffic agent's monthly limit as caller-level; both are global. Only the browser agent (on branch B) budgets per caller.
## 2. "Already in protocol": the cited lines checked

Refs: fabric-agent-contract `origin/main` 1e7a7d6; fabric-workspace `origin/main` ea1c487 (re-fetched; newer than the roll call); project-observatory `origin/main` cdd513e; project-observatory-open-source `origin/main` 5621e01.

| Claim | Verdict | Evidence | Correction / note |
|---|---|---|---|
| fabric-service/0.1: one descriptor token per service, `service.md:470-495` | PARTLY | The rule itself is at `docs/specification/service.md:250-252`: the token is in `auth.tokenFile`, mode 0600, header only. Lines 470-494 are the Surfaces table plus *MCP credentials*. `:481-484`: the descriptor token is the **host's** credential (well-known, feed, usage, login code), and by default MCP takes it too | The cite should be `:250-252` + `:481-494`. `:256-258` adds the same-user floor: "Loopback reachability is not authorization" |
| DEC-0024 allows `surfaces.mcp.auth: "own"` but does not require it (`DECISIONS.md:437`) | CONFIRMED (path) | The file is `docs/DECISIONS.md:437-466`. Status: "Accepted source change; consumer adoption pending" (`:440`). Spec at `service.md:486-494`; schema at `schemas/service-well-known.schema.json:208` | Adopters: the private lifecycle broker CONFIRMED (path kept in the operator's private records). The marketing agent is **WRONG**: only planned as R15-08, and it has no surface. The store-publishing agent CONFIRMED (its generated well-known) |
| The writing agent refused it: DEC-0039/FD-07 "one token" | CONFIRMED | its decision register and board (details kept in the operator's private records) | DEC-0039 is **the writing agent's** own DEC, not a contract DEC. The contract ends at DEC-0038 |
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
| Board rows waiting | CONFIRMED (sample) | Switchboard `docs/evidence/backlog.md:79` (SB-72), `:103` (SB-96), `:104` (SB-97, grant id in usage). the private product agent's own board (BL-056/057). the brand agent's board (AU1). FD-40 `fabric-dashboards docs/backlog.md:48`. the writing agent's board (AU-07, SP-01) | The marketing agent's R07-28 does **not** wait on `grant check`: its blockers are internal (G3, on its branch B) |

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
| I1 | Descriptor service token (`auth.tokenFile`, 0600) | each service, for its host | one per service, shared by all callers | the writing agent, the messenger bot, the analytics agent (agent class), the research agent (`local`), the media agent locally, the brand agent's events feed. Also **borrowed** by fabric-dashboards, the private product agent and the store-publishing agent to call others (contract `service.md:250-252`) |
| I2 | Per-caller token minted by a service CLI, sha256 stored | the callee | per calling agent | the private product agent's client CLI, the research agent's consumer CLI, the browser agent (B), the traffic agent's surface tokens, the data-room agent's principals, the event server's per-source tokens |
| I3 | Per-project bridge key | callee (the media agent's bridge) | per project | the media agent |
| I4 | Role bearer | callee env | per role | the growth service, the analytics agent, the ad-operations bot's views, the research agent's roles |
| I5 | Credential hash + grant revision | broker policy | per caller × tools × targets | the private lifecycle broker (path kept in the operator's private records) |
| I6 | IdP service token (Cloudflare Access `common_name`) | the product's app, on a person's Allow | per key | fabric-inbox; Fabric holds one (`product_connections`) |
| I7 | Per-user API key / OAuth (resolving to the key) | product | per user | the market-data product, a consumer web product, the messenger business platform's MCP (per connection) |
| I8 | Self-named label | caller | none (advisory) | Observatory keyserver `X-Observatory-Caller`, the store-publishing agent's channel label |
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
| G8 | The browser and brand agents' HMAC grant on a payload digest (≤ 24 h) | `{grantId, issuer, approvedBy, approvedAt, expiresAt, payloadDigest, signature}`; the key is shared by both | no | the brand agent, the browser agent (B) |
| G9 | The market-data product's key policy (allow/deny categories, day/total spend claim) | per key against a user wallet | yes | the market-data product |
| G10 | The messenger business platform's personal delegation grant + dispatch admission (a JCS SHA-256 request fingerprint) | person → recipient × chats × actions × expiry | no | the messenger business platform |
| G11 | The marketing agent's spend authorization (TTY, ≤ 7 d; standing ≤ 30 d planned) | amount × currency × validity | yes | the marketing agent (B) |
| G12 | Project MCP server list `projects.mcp_servers` (M127, `index.ts:905-915`) | project × server names | no | Fabric sessions via the gateway |
| G13 | The writing agent's proposed access policy | project_service_token + grants + scopes | — | proposal only |

### 4.3 Money limits (none per calling agent, except the browser agent's branch B and the research agent's consumer ownership)

Per service or global (figures kept in the operator's private records):
- the media agent: per-project job/day/month limits, an aggregate daily cap and emergency stops.
- the private product agent: a global daily job cap and global money ceilings (figures kept in the operator's private records).
- the traffic agent: a global monthly cap.
- the research agent: lane caps; orders over a threshold wait for the operator.
- the messenger bot: a monthly model budget.
- the analytics agent: a model budget.
- Observatory assistant: daily/monthly/velocity.
- the brand agent: a base budget and a video ceiling.
- the store-publishing agent: a daily paid-data budget.

Per call:
- the writing agent: a per-call charge ceiling.

Per caller and project:
- the browser agent (B only).

Contract levels: L0–L3 (`spend-policy.md:14-23`).

Estate total: $1,000/month (`authority.md:50`). Enforced by nobody (OBS-56 open).

### 4.4 Approval formats (no two alike; none portable)

| Format | Binding | Channel | Users |
|---|---|---|---|
| plan hash approval row | `{change_set_id, hash}` | operator session | the store-publishing agent |
| HMAC grant on text digest | payload digest, ≤ 24 h | board (no auth, AU1) | the brand agent, the browser agent |
| TTY ceremony, two typed confirmations | cap × currency × validity, local integrity only | TTY | the marketing agent |
| Telegram second press / intentSig | SHA-256 of intent, consume-once | Telegram | the ad-operations bot; the media agent (its own ADR) |
| 5-minute confirm code | per irreversible action | tool round-trip | fabric-inbox |
| one-use dispatch admission (JCS SHA-256) | request fingerprint | product UI | the messenger business platform |
| operator Allow on a request (device-style consent) | request id → binding + grants | Fabric UI | Fabric hub |
| `grant.issued@1` one-shot floor grant | floor class × target | Fabric UI | Fabric |
| durable approval request + operator-channel confirm token (DEC-0034 OC-6) | `approvalRequest` in grant-check | operator channel | contract only (DEC-0037; OBS-59 open) |
| draft → operator acts | — | operator surface | the growth service, the analytics agent (D-71) |

### 4.5 Refusal code sets (all disjoint; none uses the contract's)

- **Contract grant-check:** `limit-reached, no-grant, grant-expired, grant-revoked, principal-unproven, credential-source-refused, unknown-state` (`spend-policy.md:89-90`).
- **Fabric hub:** `access-required, unknown-callee, invalid-arguments, product-not-connected, product-credential-unavailable, product-error, product-unreachable, product-refused, product-outdated, outcome-unknown, hub-unavailable, cancelled, needs-grant, no-project, bad-folder`. Fabric floor: prose reasons only.
- **Observatory bindings:** `no-credential, no-binding, audience-mismatch, binding-revoked, binding-expired, scope-not-bound, effect-above-ceiling, project-not-bound, …` (`access_binding.py:60-74`). Assistant: `budget-unset, budget-reached`.
- **the writing agent:** `unauthenticated, unbound, forbidden, rate-limited, unknown-job, max-charge-exceeded, insufficient-funds, payg-disabled, payg-cap-exceeded, execution-disabled, idempotency-conflict`.
- **the store-publishing agent** (snake_case): `unauthorized, operator_session_required, approval_required, writes_frozen, mode_disallows, plan_stale, budget_exceeded, rate_limited, credentials_missing`, and one code naming the media agent.
- **the private product agent:** nine codes of its own (details kept in the operator's private records).
- **the traffic agent:** `-32001 unauthorized, no_such_tool` (used for a missing scope too), `bad_arguments, no_grant, grant_revoked, bound_reached{…}`.
- **the growth service:** `unauthorized, forbidden, rate_limited, dependency_unavailable`.
- **the analytics agent:** `unauthorized, forbidden, rate_limited, budget_exhausted, dependency_unavailable, …`.
- **the data-room agent:** `forbidden, operator_session_required, login_expired, request_origin_forbidden, request_header_required`.
- **the brand agent:** `authorization_mismatch, authorization_expired, bad_signature`. Via the browser agent: `wrong_account, target_not_allowed, cap_reached`.
- **lifecycle:** `unauthorized, denied, policy_changed, held_off, not_enrolled, idempotency_conflict, invalid_authority`.
- **the messenger business platform:** `unauthenticated, token_expired, relay_revoked, scope_denied, actor_not_grant_recipient, …`.
- **the marketing agent:** `approval_required, approval_reused, authorization_revoked, confirmation_expired, cap_below_plan_budget, validity_too_long, …`.
- **the research agent:** `approval-required`.
- **Prose or HTTP status only:** fabric-inbox, fabric-dashboards, the media agent (plus budget pause causes), the market-data product (spend-limit causes as text).
  - *Correction, 2026-10-12 (from the media agent's owner session, its W-022; this record is otherwise as of 2026-10-11):* the
    media agent no longer belongs here. Since its wave 1, every code a caller can receive over MCP is listed in its
    caller skill's error reference — 123 codes, held by a test; the Fabric-tool codes are kebab-case (`unknown-job`,
    `store-corrupt`, `job-failed`, `tool-error`, `refused`).

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
- **the traffic agent:** `estate:read`, `metrics:read`, `audit:write`.
- **the data-room agent:** `aggregates:<p>`, `team_totals`, `operator`, `dashboard:refresh`, `stores:*`, `marketing:*`, `costs:write`, `collection:read`.
- **the growth service:** roles operator/reader/agent/analyst; doors read/operate.
- **the analytics agent:** caller class operator/agent × tool effect none/draft.
- **the writing agent:** effect none/draft/charge/delete; proposed `content.*`, `billing.manage`.
- **the store-publishing agent:** auto/confirm/human.
- **Autonomy levels:** the brand agent L0–L3 per channel; the marketing agent L0–L4 × operation class.
- **the messenger business platform:** owner/admin/member, MCP R/L/W, `read:messages`.
- **the market-data product:** provider categories, OAuth scope `mcp`.
- **Tool lists:** lifecycle tools × targets; the media agent's bridge tool list × project.

## 5. What the roll call missed

**Agents with a service surface absent from the table:**
- **The research agent.** Per-consumer tokens added through its CLI, sha256 stored; "subscriptions, orders and spend belong to that name"; `agent:<name>`. Roles service/host/operator. Lane caps; orders over a threshold wait for the operator; `approval-required`. It is the **only agent that attributes spend to the calling agent by name**. The operator's estate map still called it "design stage", which is stale.
- **fabric-switchboard** (d852781). stdio MCP with **write** tools (`switchboard_chain_set`, `switchboard_openrouter_model`, `crates/switchboard-cli/src/mcp.rs:61,66`), so there is no caller identity. One OpenRouter key per service from the vault (`switchboard-core/src/agent_keys.rs:1-8`). SB-96 says chain pins can borrow any project's key (`docs/evidence/backlog.md:103`). The roll call lists its rows but not the agent.
- **The event server** (hosted). Per-source tokens with scopes `emit/read/ack` and a kind allowlist. It is a scoped-token scheme of its own.
- **The analytics agent.** It is a separate agent; the roll call's analytics row describes the analytics stack. Caller class operator/agent via one shared bearer. It calls the growth service with its own role token. A model budget; a per-hour ask limit per caller class.
- **A team mail product.** CF Access JWT; "once a teammate passes the shared Access policy, they can access all mailboxes". Its `/mcp` has no per-caller identity.
- **The site's intake backend.** Intake HMAC shared with the site Worker, plus one admin token. No agent callers.
- **The ad-operations bot** is a separate estate agent, folded into the private agents' row. A standalone checkout of it is a stale copy; the source lives in the private agents' repository (paths kept in the operator's private records).
- **Fabric hub** appears only in the protocol section, not as a row. It is both a caller (Fabric→Inbox with one key) and a callee.

**Mechanisms missed:**
- **Fabric's dead gateway path:** M127 `projects.mcp_servers` plus `x-agw-key` from `FABRIC_AGW_KEY` (`apps/desktop/src/main/gateway.ts:1-33`, `sessionBundle.ts:160-167,293-323`). The backend was retired 2026-09-14, so a project that declares servers is refused at launch.
- **ADR-0023 policy port** (Cedar-style, `allow/deny/indeterminate` with receipts and codes like `grant_required`): accepted, but there is **no implementation** (`git grep PolicyDecisionPort` finds nothing).
- **ADR-0026's binding** (project ids, scopes, effect ceiling) is only partly realised by the hub tables: no effect ceiling, no project set.
- **The hub stores attribution only in Fabric's journal.** `hub.call.forwarded@1` holds the caller binding and `grant_ids`. The callee gets Fabric's product credential, `X-Fabric-Accounts` and `traceparent` only (`productForwarder.ts:96-100,174-176`), so Fabric Inbox attributes all hub traffic to one key.
- **C3.5 vs reality:** "Fabric's MCP is the only route between agents" (`interop.md:192`), but the hub routes only to `fabric-inbox` (`hubCall.ts:371-373`). Every local agent-to-agent call (the private product agent→the writing and media agents, the store-publishing agent→the media and writing agents, the media agent→the private product agent, the analytics agent→the growth service, the brand agent→the browser agent) goes direct, with borrowed or per-callee tokens.
- **`authority.md:101`** says the contract put `grantRef` "on execution context". No contract schema has it: `grantRef` is only in `grant-check` and in usage `byGrant`. A callee cannot learn which grant a call is under.
- **Same-user floor:** contract `service.md:256-258`, `spend-policy.md:69-71`, Fabric `agentSurface.ts:23-35`, ADR-0134 `:49`. Every local scheme (I1, I2, I9, I10, I12) is "accidental/confused borrowing" protection only. This is a decision constraint the roll call never states.
- **Shared secrets across agents:**
  - the brand agent and the browser agent share the HMAC grant key;
  - the growth service has an unscoped revenue token beside the per-producer ones;
  - the marketing agent uses an org-wide ads token;
  - the brand agent falls back to the browser agent's shared MCP token.
- **Act-as / on-behalf-of mechanisms that do exist:**
  - a consumer web product's act-as user-id header;
  - the messenger business platform's actor user id, enforced by `actor_not_grant_recipient`.
  
  These are the only enforced on-behalf-of fields in the estate. Both are human-user delegation, not agent chains.
- **Stale default branches:**
  - the browser agent's default branch has none of its claimed access model;
  - the marketing agent's default branch has no code;
  - a mobile app's default branch is two months old;
  - the growth service has no `main`.
  
  "In prod" for the browser agent and the lifecycle broker means a local launchd install built from a feature branch.
- **Not verifiable locally:** an SEO agent (not checked out on this machine). `inventory/agents.json` is absent from project-observatory `origin/main` and from the operator's wiki, so there is no generated agent inventory to check completeness against.

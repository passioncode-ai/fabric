# The delegation model across the agents — adoption plan and per-agent changes (2026-10-11)

The decision is [ADR-0144](../../../adr/0144-one-delegation-model-fabric-issues-the-chain-the-callee-checks-it-observatory-meters-it.md)
(CO-258, release 0.4.0 REQ-37). Its inputs: the roll call of 25 sessions
([copylot-agent `9f729f4`](https://github.com/ssheleg/copylot-agent/blob/9f729f4/docs/handoffs/2026-10-11-delegation-rollcall.md))
and the [audit](audit.md) of every claim against the owner's default branch. This page is a dated record: the
per-agent rows say what each owning session changes, and their status lives on that agent's own board, not here.

## In one paragraph

Fabric's hub is the estate's one **issuer**: it signs a 10-minute delegation token (JWT, RFC 8693 `act` chain) naming
the person the work is for, the chain of agents acting, one callee, the capabilities and effect ceiling, and the grant
it is under. The callee checks it **offline** against the estate's published keys and acts for that person, naming its
caller. Calls go direct; the hub is not a proxy except for products whose credential it holds. One grant format (the
contract's standing grant with `spend`) and one store (the hub's grants, decided in Fabric); Observatory **meters**
spend against the grant's windows and the estate total and releases vault slots only to a token whose grant names
them. One approval document (`approval/1`), one set of refusal codes. Calling a service with that service's own descriptor
token is retired: no new caller does it, the existing ones switch at step 5.

## Order

| Step | What | Owner | Gate to the next |
|---|---|---|---|
| 0 | **Decision** — ADR-0144 (this) | Fabric | written |
| 1 | **Contract** — one DEC in fabric-agent-contract: delegation-token profile and its fixtures; `approval/1`; the refusal codes; the grant's `audience`/`capabilities`/effect ceiling; well-known `auth.delegation` (`issuer`, `jwks`); L0 = estate total **and** each key's ceiling; C3.5 "the only issuer, not the only route"; the kit's session lifetime; a verifier in the kit (`verifyDelegation`, `verifyApproval`) with planted-defect tests | Fabric (the contract has no live owner session) | DEC merged, kit released |
| 2 | **Issuer** — Fabric 0.4.0 wave 4: the estate key in Observatory's vault, the JWKS, `fabric.delegation.mint` / `introspect`, `fabric.approval.request`, `access_grants` in the contract shape (schema step), the header on forwarded calls, `delegation.minted@1`, the consent and grant screens | Fabric | a minted token verified by the kit's verifier; a refused over-broad mint; DB tests |
| 3 | **Meter** — Observatory: `grant-check` verifies the token and reserves against the grant's windows and the estate total (OBS-55, OBS-56); `use_secret.py run` releases a slot only under a grant naming it (OBS-57) | project-observatory | a reservation refused at the window; a slot refused without a grant |
| 4 | **Callees adopt** — each service accepts the token (kit verifier), maps its refusals onto the codes, stops issuing per-agent tokens to estate agents, fills usage `byGrant` | each owner (rows below) | its own board row, with a test that a token for another audience is refused |
| 5 | **Callers switch** — every outbound call mints through the hub instead of borrowing a descriptor token or a shared token | each owner | no descriptor token presented to a capability (a grep and a test per repo) |
| 6 | **Approvals move** to `approval/1` between agents | each owner with an approval gate | the old shared key retired |

Steps 4–6 per agent may run in any order once 1–3 exist; an agent that only receives (no outbound calls) has no step 5.

## Per agent — what to change

Facts from the [audit](audit.md) §1 and §5; "step" refers to the order above.

| Agent (session) | Today [audit] | Changes | Steps |
|---|---|---|---|
| copylot-agent (copylot-agent-e6) | one token for every caller; per-call `maxChargeUsd`; wallet per workspace | accept the token: author of a job = outermost `act` (AU-07), job access by `sub` + caller; charge against the token's grant via Observatory's grant-check (SP-01); revisit DEC-0039 "one token" → descriptor token for the host only; `effect` already declared per tool — keep | 4 |
| project-observatory (-85, -3d) | stdio has no caller; HTTP bindings; keyserver's self-named caller header; no `grant check` | be the meter (step 3); keyserver trusts the token, not `X-Observatory-Caller`; stdio MCP stays the operator's local agent; correct `ARCHITECTURE.md:604` (identity is the hub's, the gateway is gone) | 3, 4 |
| fabric-dashboards (-76) | calls every service with that service's descriptor token, which can mint login codes | read feeds, well-known and usage with the descriptor token as the host (allowed); every capability call (control, `doctor`/`update` that act) through a minted token; FD-40 builds on the grant-check of step 3 | 5 |
| fabric-inbox (-df) | per-key Cloudflare Access identity; `X-Fabric-Accounts` narrowing; confirm codes | accept `Fabric-Delegation` on hub-forwarded calls and attribute to its chain (not to the `fabric` key alone); keep its keys for people and outside callers; map refusals; confirm codes stay for people, `approval/1` between agents | 4, 6 |
| asset-foundry (-e9, -ec) | one local token; bridge key per project; per-project budgets; calls frame-agent with a caller token | accept the token (caller = agent, project from the grant); budgets per grant beside per project; calls to frame-agent through a minted token; Telegram second press → `approval/1` between agents | 4, 5, 6 |
| frame-agent (-84) | per-caller tokens by CLI; calls Copylot and Foundry with their descriptor tokens; global daily cap | accept the token instead of `client add` for estate agents; calls to Copylot/Foundry through minted tokens (no descriptor tokens); forward `traceparent` (it only echoes it); per-caller caps from the grant; BL-057 by the kit's session lifetime | 4, 5 |
| mobile-publisher-agent (-61) | one agent token; sends Foundry's own service-token file to Foundry; Copylot session token + owner header | stop sending Foundry's token — mint for Foundry and Copylot; accept the token on its own MCP (`auth:"own"` stays for people); plan-hash approval → `approval/1` when the approver is reached from another agent | 4, 5, 6 |
| sshlg-growth (-79) | a bearer per role; one unscoped revenue token beside per-producer ones | roles become capability sets on the wire; accept the token; retire the unscoped revenue token (per-producer only) | 4 |
| traffic-growth-agent (-af) | per-client `SurfaceToken` with scopes; shared Prowl token; $50/month global | accept the token, its scopes = capabilities; per-caller limits from the grant; Prowl through Prowl's own per-key model (an outside provider: its key stays, held by the owner) | 4 |
| appvillis-dataroom-agent (-b1) | `Principal(consumer, scopes)`; relay with a shared env token | accept the token, scopes = capabilities; relay token per producer | 4 |
| sshlg-brand-agent (-85, -a8) | `service.token` on the feed only; board without auth (AU1); HMAC grant key shared with webpilot; falls back to webpilot's shared token | board behind the token (AU1); calls to webpilot through minted tokens, no fallback; HMAC grants → `approval/1` (the shared key retired with webpilot) | 4, 5, 6 |
| sshlg-personal-os (-62) | local-lifecycle: credential hash × tools × targets; communicator: one token; adops-bot confirm-gate | lifecycle accepts the token beside its policy (its `allowedCallers` = the grant's actor); communicator accepts the token; adops-bot confirm-gate → `approval/1` for agent callers | 4, 6 |
| nicegramappbot (-35) | one service token, which also mints a write-capable operator session | accept the token on MCP; the descriptor token stops minting a write session for agents (people only, by login code) | 4 |
| prowl (0xdev-d3) | per-user key or OAuth | an outside provider: no change to its model; estate agents call it with the owner's key held by the owner's agent (never borrowed) | — |
| nicegram-business (-7b) | per-connection MCP token (MCP off in prod); enforced `actor` | when its MCP returns, accept the token alongside per-connection tokens; its human delegation stays its own | 4 (deferred with its MCP) |
| sshlg-analytics (-99) and sshlg-analytics-agent | App Key per app; a shared bearer per caller class; calls growth with its role token | analytics-agent accepts the token; calls growth through a minted token | 4, 5 |
| cmo-creative-agent (-9b) | TTY spend authorization; org-wide ads token; no surface | when its surface lands, `auth.delegation` from the start; spend authorization → a grant with windows; standing authorization (R07-28) is that grant | 4, 6 (with its surface) |
| webpilot (-5c) | per-agent caller tokens + a shared one; per-caller budgets; HMAC grant shared with brand (all on a branch) | accept the token instead of per-agent caller tokens; retire the shared `WEBPILOT_MCP_TOKEN`; HMAC → `approval/1`; land the branch | 4, 6 |
| research-agent | per-consumer tokens; spend attributed per caller | accept the token (its consumer = the actor); keep per-caller attribution, by grant | 4 |
| fabric-switchboard | stdio MCP with write tools; one provider key per service | write tools behind the token when exposed beyond stdio; SB-96 (chain pins borrowing a project's key) → the grant's `credentialSource` | 4 |
| sshlg-fabric-server | per-source scoped tokens | accept the token for estate agents; keep per-source tokens for outside sources | 4 |
| sms-activate-app-website (-e2) | personal agent API keys spending the balance; an act-as channel | outside users' agents: no change; estate agents (if any) through the token | — |
| agentic-inbox | Cloudflare Access; `/mcp` without per-caller identity | `/mcp` behind the token | 4 |
| passioncode-platform | intake HMAC, admin token; no agent callers | none until an agent calls it | — |
| screen-record-studio (-9d), dataroom (-72), longevity-app (-09), sshlg-skills (-e6) | no agent-facing surface | none now; a future surface declares `auth.delegation`; agent-stack's interop doctrine (`gateway.md`) gets the on-behalf-of model | — (sshlg-skills: doctrine) |
| Fabric (fabric-90) | the hub forwards Fabric's one Inbox key, the account narrowing and `traceparent`; project MCP servers through a retired gateway (M127, `x-agw-key`) | the issuer (step 2); the header on forwarded calls; remove the dead gateway path (a session's project servers by the token instead) | 1, 2 |

## Messages

Each owning session receives its row with a link to ADR-0144 and this page, and the instruction that nothing changes on
the wire before steps 1–2, except one rule that holds now: **no new code calls a capability with another service's
descriptor token** — existing calls keep working until that caller's step 5. fabric-workspace-91 records each decision id in `knowledge/authority.md` and RM-03.

# The delegation model across the agents — adoption plan and per-agent changes (2026-10-11)

The decision is [ADR-0144](../../../adr/0144-one-delegation-model-fabric-issues-the-chain-the-callee-checks-it-observatory-meters-it.md)
(CO-258, release 0.4.0 REQ-37). Its inputs: the roll call of 25 sessions
(kept in the writing agent's private repository at `9f729f4`)
and the [audit](2026-10-11-roll-call-audit.md) of every claim against the owner's default branch. This page is a dated record: the
per-agent rows say what each owning session changes, and their status lives on that agent's own board, not here.

> **Redacted 2026-10-13 under [ADR-0096](../../../adr/0096-dated-records-are-redacted-for-publication.md):** the names of the operator's private agents and projects (every project outside the public PassionCode products), their sessions, repositories, paths, environment names and limits are replaced by neutral roles; details kept in the operator's private records. Nothing this record finds or decides changed.

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

Facts from the [audit](2026-10-11-roll-call-audit.md) §1 and §5; "step" refers to the order above.

| Agent (session) | Today [audit] | Changes | Steps |
|---|---|---|---|
| the writing agent | one token for every caller; a per-call charge ceiling; a wallet per workspace | accept the token: author of a job = outermost `act` (AU-07), job access by `sub` + caller; charge against the token's grant via Observatory's grant-check (SP-01); revisit its DEC-0039 "one token" (its own decision, not the contract's) → descriptor token for the host only; `effect` already declared per tool — keep | 4 |
| project-observatory (-85, -3d) | stdio has no caller; HTTP bindings; keyserver's self-named caller header; no `grant check` | be the meter (step 3); keyserver trusts the token, not `X-Observatory-Caller`; stdio MCP stays the operator's local agent; correct `ARCHITECTURE.md:604` (identity is the hub's, the gateway is gone) | 3, 4 |
| fabric-dashboards (-76) | calls every service with that service's descriptor token, which can mint login codes | read feeds, well-known and usage with the descriptor token as the host (allowed); every capability call (control, `doctor`/`update` that act) through a minted token; FD-40 builds on the grant-check of step 3 | 5 |
| fabric-inbox (-df) | per-key Cloudflare Access identity; `X-Fabric-Accounts` narrowing; confirm codes | accept `Fabric-Delegation` on hub-forwarded calls and attribute to its chain (not to the `fabric` key alone); keep its keys for people and outside callers; map refusals; confirm codes stay for people, `approval/1` between agents | 4, 6 |
| the media agent | one local token; bridge key per project; per-project budgets; calls the private product agent with a caller token | accept the token (caller = agent, project from the grant); budgets per grant beside per project; calls to that agent through a minted token; Telegram second press → `approval/1` between agents | 4, 5, 6 |
| a private product agent | per-caller tokens by CLI; calls the writing and media agents with their descriptor tokens; global daily cap | accept the token instead of `client add` for estate agents; calls to them through minted tokens (no descriptor tokens); forward `traceparent` (it only echoes it); per-caller caps from the grant; BL-057 by the kit's session lifetime | 4, 5 |
| the store-publishing agent | one agent token; sends the media agent's own service-token file to it; the writing agent's session token + owner header | stop sending the media agent's token — mint for the media and writing agents; accept the token on its own MCP (`auth:"own"` stays for people); plan-hash approval → `approval/1` when the approver is reached from another agent | 4, 5, 6 |
| the growth service | a bearer per role; one unscoped revenue token beside per-producer ones | roles become capability sets on the wire; accept the token; retire the unscoped revenue token (per-producer only) | 4 |
| the traffic agent | per-client surface token with scopes; a shared market-data token; a monthly cap per account (tenant), provider spend only — corrected by its owner | accept the token, its scopes = capabilities; per-caller limits from the grant; the market-data product through its own per-key model (an outside provider: its key stays, held by the owner) | 4 |
| the data-room agent | principals (consumer, scopes); relay with a shared env token | accept the token, scopes = capabilities; relay token per producer | 4 |
| the brand agent | its service token on the feed only; board without auth (AU1); HMAC grant key shared with the browser agent; falls back to the browser agent's shared token | board behind the token (AU1); calls to the browser agent through minted tokens, no fallback; HMAC grants → `approval/1` (the shared key retired with the browser agent) | 4, 5, 6 |
| the operator's private agents (one repository) | the lifecycle broker: credential hash × tools × targets; the operator's notification agent: one token; an ad-operations bot's confirm-gate | the lifecycle broker accepts the token beside its policy (its allowed callers = the grant's actor); the notification agent accepts the token; the bot's confirm-gate → `approval/1` for agent callers | 4, 6 |
| the messenger bot | one service token, which also mints a write-capable operator session | accept the token on MCP; the descriptor token stops minting a write session for agents (people only, by login code) | 4 |
| the market-data product | per-user key or OAuth | an outside provider: no change to its model; estate agents call it with the owner's key held by the owner's agent (never borrowed) | — |
| the messenger business platform | per-connection MCP token (MCP off in prod); enforced `actor` | when its MCP returns, accept the token alongside per-connection tokens; its human delegation stays its own | 4 (deferred with its MCP) |
| the analytics stack and the analytics agent | app key per app; a shared bearer per caller class; calls the growth service with its role token | the analytics agent accepts the token; calls the growth service through a minted token | 4, 5 |
| the marketing agent | TTY spend authorization; org-wide ads token; no surface | when its surface lands, `auth.delegation` from the start; spend authorization → a grant with windows; standing authorization (R07-28) is that grant | 4, 6 (with its surface) |
| the browser agent | per-agent caller tokens + a shared one; per-caller budgets; HMAC grant shared with the brand agent (all on a branch) | accept the token instead of per-agent caller tokens; retire the shared MCP token; HMAC → `approval/1`; land the branch | 4, 6 |
| the research agent | per-consumer tokens; spend attributed per caller | accept the token (its consumer = the actor); keep per-caller attribution, by grant | 4 |
| fabric-switchboard | stdio MCP with write tools; one provider key per service | write tools behind the token when exposed beyond stdio; SB-96 (chain pins borrowing a project's key) → the grant's `credentialSource` | 4 |
| the event server | per-source scoped tokens | accept the token for estate agents; keep per-source tokens for outside sources | 4 |
| a consumer web product | personal agent API keys spending the balance; an act-as channel | outside users' agents: no change; estate agents (if any) through the token | — |
| a team mail product | Cloudflare Access; `/mcp` without per-caller identity | `/mcp` behind the token | 4 |
| the site's intake backend | intake HMAC, admin token; no agent callers | none until an agent calls it | — |
| a desktop product's licensing backend, a knowledge-base project, a mobile app, sshlg-skills (-e6) | no agent-facing surface | none now; a future surface declares `auth.delegation`; agent-stack's interop doctrine (`gateway.md`) gets the on-behalf-of model | — (sshlg-skills: doctrine) |
| Fabric (fabric-90) | the hub forwards Fabric's one Inbox key, the account narrowing and `traceparent`; project MCP servers through a retired gateway (M127, `x-agw-key`) | the issuer (step 2); the header on forwarded calls; remove the dead gateway path (a session's project servers by the token instead) | 1, 2 |

## Messages

Each owning session receives its row with a link to ADR-0144 and this page, and the instruction that nothing changes on
the wire before steps 1–2, except one rule that holds now: **no new code calls a capability with another service's
descriptor token** — existing calls keep working until that caller's step 5. fabric-workspace-91 records each decision id in `knowledge/authority.md` and RM-03.

## Rows filed by the owners (2026-10-11)

Each owner filed its row on its own board and named it back; the status lives there.

| Agent | Row | Where |
|---|---|---|
| the writing agent | AU-07 (SP-01 refers to it) | details kept in the operator's private records |
| project-observatory | OBS-55, OBS-57, OBS-62 (owner: the -3d session; it also answers the signing key's vault slot) | passioncode-ai/project-observatory-dashboard PR #201 |
| fabric-dashboards | FD-44 (step 5), FD-45 (Fabric's floating button, REQ-42) | fabric-dashboards `main`, #84 and #85 |
| fabric-inbox | B-83 | passioncode-ai/fabric-inbox PR #69, `4a06957` |
| the media agent | B-56 | details kept in the operator's private records |
| the growth service | RB-33 (the unscoped revenue token's retirement waits on another product's own producer token) | details kept in the operator's private records |
| the traffic agent | B-001 | details kept in the operator's private records |
| the data-room agent | DR-003 | details kept in the operator's private records |
| the brand agent | AU7 (closes AU1 when done) | details kept in the operator's private records |
| the operator's private agents | BL-1117 | details kept in the operator's private records |
| the messenger bot | FD1 | details kept in the operator's private records |
| the analytics agent | W-13 | details kept in the operator's private records |
| the browser agent | BL-015 | details kept in the operator's private records |
| the store-publishing agent | BL-360 | details kept in the operator's private records |
| agent-stack (sshlg-skills) | B-155, the interop doctrine | ssheleg/agent-stack#42 |
| a private product agent | BL-059 (folds BL-056, BL-057) | details kept in the operator's private records |
| the messenger business platform | B-765 (deferred until its MCP returns) | details kept in the operator's private records |
| a second research agent (a local HTTP MCP, distinct from the research agent above) | B-020 (step 4, callee side; its contract pin moves to the merged DEC-0039/0041) | its own board |

**A ruling for step 5, asked by fabric-dashboards:** `POST /fabric/v1/login-code` is the host's operation — the contract
lists the login code among the descriptor token's host uses (`service.md` §Surfaces) — so a host minting a sign-in for
the dashboard it shows keeps using the descriptor token; it is not a capability call.

**A ruling for the browser agent's C17 (BL-015):** each per-agent project link the operator confirmed becomes a standing grant —
`audience` the browser agent, `capabilities` its tools that link allows, `project` the linked project, `effectCeiling` from
C13's effect classes; the operator's confirmation in C17 is the grant decision (DEC-0039's grant shape).

**Step 1 done, 2026-10-11:** fabric-agent-contract DEC-0039 and DEC-0040 merged (`8e49fbd`, PR #30) after a blind
seam review and its re-check; the meter verifies an onward token minted for it (aud = the meter), presented in
`Authorization`; follow-ups are CO-260 and two adapter rows in the contract's handoff.

**The machine boundary, 2026-10-11 (ADR-0144 amendment 4, the operator).** On this machine the operator's instruction is
the authority: no token, approval or grant record is needed locally, money limits and human gates still bind. Every row
above is required only for a service reachable from another machine or from an external caller (a share grant); for the
rest it is optional attribution. Owners keep their rows and re-scope them; none has to change a local path.

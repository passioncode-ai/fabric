# ADR-0144 — One delegation model: Fabric issues the chain, the callee checks it, Observatory meters it

**Status:** accepted.
**Date:** 2026-10-11. **Decided by:** Fabric, on the operator's instruction of 2026-10-11 relayed by copylot-agent-e6:
the agents' delegation and access is Fabric's main task, Fabric decides and tells each agent what to change
(CO-258, release 0.4.0 REQ-37). **Inputs:** the roll call of 25 sessions
([copylot-agent `9f729f4`](https://github.com/ssheleg/copylot-agent/blob/9f729f4/docs/handoffs/2026-10-11-delegation-rollcall.md))
and its audit against every owner's default branch ([audit](../evidence/plans/2026-10-11-delegation-model/2026-10-11-roll-call-audit.md),
`[audit §n]` below). **Amends** [ADR-0115](0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md)
(the hub's grant gains the contract's shape and becomes the estate's one grant store),
[ADR-0026](0026-fabric-exposes-a-project-scoped-policy-enforced-mcp-control-surface.md) (the binding is the hub's), the contract's interop C3.5 (the
hub is the only *issuer*, not the only *route*) and DEC-0037 (the registry's session token is the hub's delegation
token). **Within** the operator's standing rules ([`knowledge/authority.md`](https://github.com/passioncode-ai/fabric-workspace/blob/main/knowledge/authority.md)):
never another agent's key — call its capability; the owner pays; a grant is unlimited or limited by windows that hold
together; per-project limits are dynamic; the estate total is USD 1,000 a month; human gates stay human.
**Plan of adoption and the per-agent changes:** [2026-10-11-delegation-model](../evidence/plans/2026-10-11-delegation-model/README.md).

## Context

Measured 2026-10-11 [audit §4]: fifteen ways a caller gets the credential it presents (I1–I15), thirteen grant and
authority stores (G1–G13), ten approval formats, about eighteen refusal-code sets with no two overlapping, and "level"
used for at least eight different things. What that costs, each a fact of the audit:

- **A callee cannot tell callers apart.** Six services hand one descriptor token to every caller [§1]; three agents
  call another service with *that service's own* descriptor token, which in some also mints operator login codes
  (fabric-dashboards → every service, frame-agent → Copylot and Foundry, mobile-publisher → Foundry) [§1, §5].
- **Nobody passes "on whose behalf".** No contract schema carries a caller, chain or grant toward a callee: the hub's
  `agent.call` forwards Fabric's one Inbox key, the account narrowing and `traceparent` — nothing of the original
  caller ([`productForwarder.ts`](../../apps/desktop/src/main/productForwarder.ts), [audit §3.3]). Copylot's
  "author = caller" (AU-07) is unreachable.
- **Money is bounded per service or project, never per calling agent** — except webpilot (on a branch) and
  research-agent [§4.3]. The estate total is enforced by nobody (OBS-56 open).
- **Four candidate grant stores**: Fabric's one-shot `grants` (ADR-0028), the hub's `access_grants` (no amount, no
  window, no payer), the contract's standing grant with `spend` (DEC-0037/0038, adopted by nobody), Observatory's
  registry (board rows OBS-55…59 only) [§2, §3.2].
- **Three issuers of identity**: the hub's binding (ADR-0115), the registry's session token (DEC-0037, unbuilt), each
  service's `own` tokens (DEC-0024) [§2].
- **The hub is not the route it claims to be**: interop C3.5 says Fabric's MCP is the only route between agents, but
  the hub reaches only Fabric Inbox; every other agent-to-agent call goes direct with a borrowed or per-callee token
  ([`hubCall.ts`](../../apps/desktop/src/main/hubCall.ts) `unknown-callee`, [audit §5]).
- **Shared secrets across agents**: brand and webpilot share one HMAC grant key; an unscoped revenue token beside the
  per-producer ones; an organization-wide ads token [§5].

All local schemes share one floor the roll call never stated: a token file readable by the operator's account is
readable by any process of that account (contract `service.md` §"Loopback reachability is not authorization",
CO-090). Nothing below lifts that floor; it removes *accidental* and *confused* borrowing, gives every hop an
attributable name, and lets a limit hold per caller.

## Decision

### 1. One issuer: the estate's Fabric hub signs who is acting and for whom (P1, P2, contradictions 2 and 3)

- **The delegation token** is a JWT (RFC 7519) signed with the estate's Ed25519 key (`alg: EdDSA`), in the shape of
  OAuth 2.0 Token Exchange (RFC 8693): `iss` the estate hub, `sub` the **principal** — the person of the estate on
  whose behalf the work runs (the operator, or an external person under a share grant) — and `act` the **actor
  chain**, the agent now calling outermost and each earlier agent nested inside it (`act.act…`), at most four deep.
  Claims: `aud` exactly one callee agent id; `scope` the callee's capability names; `effect` the ceiling (§3); `grant`
  the grant reference(s) the call is under (§4); `spend` the remaining amount per window the issuer computed at mint;
  `project` when the grant is project-bound; `exp` at most **10 minutes** after `iat`; `jti` unique.
- **Minting is a token exchange at the hub.** A caller presents what proves it — a binding credential (an agent
  registered on this Mac, ADR-0115), a session bearer (a session Fabric started or enrolled, ADR-0134), or a
  delegation token it received (to call onward) — and asks for an audience and capabilities. The hub mints only
  within a live grant, and a downstream token only **narrows** its parent: the scope a subset, the effect ceiling no
  higher, the `exp` no later, the spend no more than what remains, the principal the same. Attenuation is the
  issuer's check, so a callee never has to reason about a chain.
- **The callee checks, offline**: signature against the estate's published keys, `aud` is itself, `exp`, the called
  capability in `scope`, its effect within `effect`. It acts for `sub`, names the outermost `act` as its caller, and
  records the chain with the work. A service that accepts delegation tokens issues no per-agent token of its own to
  an agent of the estate (DEC-0024's `own` tokens remain for people and callers outside the estate).
- **The descriptor token goes back to being the host's credential only** — the well-known document, the events feed,
  the usage report, the login code (contract `service.md` §Surfaces) — and is never presented to call a capability.
  Calling another service's capability with that service's own descriptor token is retired by this decision: no new
  caller does it, and the existing ones (fabric-dashboards, frame-agent, mobile-publisher) switch to minted tokens once
  the issuer exists — until then their calls keep working.
- **The proof-of-identity sources reconcile into one chain**: the hub binding is how an agent proves itself *to the
  hub*; the registry session token of DEC-0037 *is* this delegation token; the session bearer stays Fabric's own
  surface credential. Observatory issues no identity (§4).
- **The estate's signing key** lives in Project Observatory's vault (Fabric creates no Keychain item, AGENTS.md
  §Lifecycle), is read once when the hub starts and held in memory; its public keys are published as a JWKS in the
  hub document (`hub.json` `jwks`), at the hub's `/.well-known/jwks.json`, and in Fabric's service descriptor
  (ADR-0139), so a cloud service of the estate verifies without reaching the Mac. Rotation keeps the previous key
  published for one token lifetime.
- **Fabric must be running to mint.** A caller without a valid token asks the lifecycle broker to ensure Fabric is
  running (enrolled with `backgroundLaunch: true`, CO-192), then mints; with no hub it is refused `issuer-unavailable`
  and does nothing — never falls back to a borrowed token.

### 2. The hub issues; the call goes direct (C3.5 amended)

A call carrying a delegation token goes straight from caller to callee; the hub is the only **issuer**, not the only
**route**. The hub keeps forwarding where it holds the credential itself (a connected product such as Fabric Inbox,
ADR-0115 §4): there it attaches the delegation token to the forwarded call (header `Fabric-Delegation`), so the callee
sees the chain whichever way the call came. Every mint and every forward is journalled (`delegation.minted@1`, summarised
per grant and minute as `hub.call.forwarded@1` is today), so attribution survives in Fabric's journal even when the
callee keeps none.

### 3. One vocabulary: capability × effect × resource; "level" is spend only (P3, contradiction 5)

- **What a call may do** is the callee's **capability** (its tool name), its **effect** class from the contract's
  governance vocabulary — `none` (read), `draft`, `send`, `reply`, `publish`, `charge`, `delete`, `merge`, `deploy`,
  `change-policy` — and the **resource** patterns it touches. Each capability declares its effect in
  `fabric-agent.json` (Copylot already does); a capability without one is treated as the highest effect it could
  have. A read-only door refuses a token whose capability is not read-only.
- **A product's own presets** (Inbox's read / mail / admin, Growth's reader / agent / analyst, Publisher's auto /
  confirm / human) stay product words for a set of capabilities; on the wire they are the capabilities.
- **"Level" means a spend level and nothing else**: L0–L3 of the contract's spend policy. L0 is the limits no grant
  can raise — the estate total (USD 1,000 a month) **and** each provider key's own ceiling; the contract's
  `spend-policy.md` is amended to say both (it says the estate total only; `authority.md` says both). Autonomy levels
  inside a product (brand L0–L3, CMO L0–L4) are that product's own and are not called levels on the wire.

### 4. One grant format, one grant store, one meter (P4, contradictions 1, 4 and 6)

- **The format** is the contract's standing grant (`governance.schema.json` `standing-grant` with DEC-0037/0038's
  `spend`), extended by the contract decision that accompanies this record with `audience` (the callee agent),
  `capabilities` and the effect ceiling. Payer: the owner.
- **The store is the hub's `access_grants`**, grown to that shape — the operator decides grants in Fabric (the prompt,
  the queue, Settings → Agent access), revokes them there, and they are journalled there. One grant (binding × callee
  × capability × resource) becomes one grant per (principal, actor, audience) with its capabilities, resources,
  effect ceiling, windows and expiry. ADR-0115's request and decision flow is unchanged.
- **Fabric's one-shot `grants` (ADR-0028) are not delegation grants**: they are Fabric's own approvals at its effect
  floor (money, deletion, publication) and become the first producer of §6's approval document.
- **Observatory is the meter, not a second store**: it answers DEC-0037's `grant-check` — given a delegation token
  and an amount, it reserves against the grant's windows and the estate total and returns the receipt — and it
  releases a vault slot to `use_secret.py run` only for a token whose grant names that credential source (OBS-55,
  OBS-56, OBS-57 re-scoped). Observatory holds no caller identity; it verifies the hub's tokens. Its
  `ARCHITECTURE.md` line that "the gateway owns identity and grants" is stale since 2026-09-14.
- **Usage reports attribute by `grantRef` only** (`byGrant`), which is now possible because the token carries it; the
  contract's rule that usage carries no caller identity stands, and the mapping grant → chain is in Fabric's journal.

### 5. Short, narrowed, revocable (P5)

A delegation token lives at most 10 minutes and names one callee; there is no long-lived token between agents.
Revoking a grant stops minting at once; tokens already out die within their lifetime; the hub also publishes
`grant.revoked` on Fabric's events feed (ADR-0139), which a callee MAY follow to cut sooner. A callee MAY also ask the
hub whether a `jti` is still good (`fabric.delegation.introspect`, RFC 7662's shape) for an irreversible effect.

### 6. An operator's approval is a document any service can check (P6)

`approval/1` is a JWS by the same estate key over: the **action digest** (SHA-256 of the RFC 8785 canonical JSON of
the action, the way nicegram-business and Publisher already bind approvals to a fingerprint), the audience, the
approver (a person of the estate), the method (`prompt` in Fabric, the operator channel — Telegram through the
communicator, DEC-0034 OC-6 — or a device check), `iat`, `exp` at most 24 hours, and a `jti` the callee consumes once.
A callee that needs approval refuses `approval-required` with the action digest; the caller obtains the approval
through the hub (`fabric.approval.request`), which asks the operator and returns the document. Products keep their own
gates for people who use them directly; between agents this one document replaces the shared HMAC key of brand and
webpilot, the plan-hash rows, the TTY ceremony and the confirm codes.

### 7. One set of refusal codes (P7)

The contract's codes, kebab-case, in `error.code`, product detail in `error.data`: `unauthenticated`,
`token-expired`, `wrong-audience`, `scope-not-granted`, `effect-above-ceiling`, `no-grant`, `grant-expired`,
`grant-revoked`, `limit-reached` (with the window), `approval-required` (with the action digest),
`approval-invalid`, `approval-reused`, `principal-unproven`, `credential-source-refused`, `chain-too-deep`,
`issuer-unavailable`, `unknown-state`. DEC-0037's grant-check codes are a subset and keep their meaning. Fabric's hub
maps its own: `access-required` → `no-grant` (still carrying the ready request), `needs-grant` → `no-grant`.

### 8. Session lifetimes in the service kit (P8)

An operator's browser session on a service (login code → cookie) lives 12 hours, refreshed by use up to 7 days, ends on
logout and on the descriptor token's rotation; the contract's service kit carries it as a default a service may only
shorten (frame-agent BL-057).

## Consequences

- **The contract decides the wire** in one decision beside this record — the delegation-token profile, `approval/1`,
  the refusal codes, the grant's `audience`/`capabilities`, the well-known `auth.delegation` (`issuer`, `jwks`), the L0
  wording, C3.5's issuer/route wording, the kit's session lifetime — with schemas, fixtures and a verifier in the kit,
  so a service adopts by calling one function rather than writing its own check.
- **Fabric builds the issuer in 0.4.0** (REQ-37, wave 4, with REQ-36's spend policy): the estate key, the JWKS,
  `fabric.delegation.mint` / `introspect`, `fabric.approval.request`, `access_grants` grown to the contract shape (a
  schema step), the header on forwarded calls, `delegation.minted@1`, the consent and grant screens showing actor,
  audience, capabilities and windows. Until then nothing changes on the wire.
- **Every agent has a row of work** in the [plan](../evidence/plans/2026-10-11-delegation-model/README.md), sent to its
  owning session; none has to change before the contract decision and Fabric's issuer exist, and no new code borrows
  another service's descriptor token from now on.
- **Same-user floor unchanged**: a process of the operator's account can still read a binding credential file. The
  gain is attribution, narrowing and per-caller limits, not protection from a hostile local process; a product that
  needs that (money at scale) adds an approval (§6) or a device check.
- **Fabric becomes a dependency of every cross-agent call.** That is the cost of one issuer; the lifecycle broker keeps
  Fabric available in the background, tokens are cheap to mint, and a call with no hub fails closed with
  `issuer-unavailable`, never open.
- Rejected: **Observatory as issuer** (it does not hold the operator's consent surface, and its architecture holds no
  identity); **per-callee tokens everywhere** (today's state: thirteen stores, nothing per chain); **macaroons or
  biscuits** for offline attenuation by the caller (no library across the estate's four languages; issuer-side
  narrowing gives the same guarantee with plain JWT verifiers every stack has).

## Amendments

### Amendment 1 — 2026-10-11: how the meter reads a grant; the call and task windows

Asked by project-observatory-3d while building the meter (OBS-55); decided here and in fabric-agent-contract DEC-0041.

- **The meter reads a projection of the grant, not a second store.** The hub writes every grant it holds, in the
  contract's standing-grant shape at its latest revision with its state, to `<Fabric userData>/grants/<meta.id>.json`
  — 0600 in a 0700 directory, atomically (temp file and rename), on every issue, revision, revocation and expiry —
  and names the directory in `hub.json` (`grantsDir`). The meter looks up the token's `grant` reference
  `<meta.id>#<meta.revision>` there and denies (`no-grant`, `grant-revoked`, `grant-expired`, `unknown-state`) when the
  file is missing, unreadable, at another revision, or not `active`. The file authorises nothing alone: the meter still
  verifies the onward token. Rejected: a hub read capability, because the meter would then deny every check while
  Fabric is closed even within a token's lifetime.
- **Per-call maximum.** Exceeding a grant's `perCallMaxUsd` is `limit-reached` with window `call` (a refusal window, not a
  grant limit window), level L3.
- **The task window.** The token gains an optional `task` claim — the Fabric task the work runs under, set by the hub
  when the session or run has one. The meter keys the `task` window on it, else on `act.session`, else on the token's
  `jti`.
- **The meter's name.** Agent `project-observatory`, capability `grant.check` (effect `none`), declared in its service
  descriptor; the onward token for it has `aud` `project-observatory` and scope `grant.check`.

### Amendment 2 — 2026-10-11: the task window's key; a vault slot released under a grant

Asked by fabric-agent-contract-75 (the review of DEC-0041, PR #32) and by project-observatory-3d (OBS-57).

- **The task window's key, superseding amendment 1's sentence.** The meter keys the `task` window on the token's
  `task` claim; else on the first `act.session` found walking the chain from the outermost actor of the token presented
  to it; else on the **grant itself** (`grant:<ref>`), so spend with no task and no session shares one window per grant.
  Never on the request's `tokenJti`: that field is unsigned, so a callee could open a fresh window with every check and
  pass the L2 limit. Fail closed: the widest window.
- **A vault slot is released under a grant that names it (OBS-57).** `use_secret.py run` releases a slot only to a
  delegation token with `aud` `project-observatory`, scope `secret.use`, effect `none`, whose grant's
  `spend.credentialSource` is `{kind: project-key, ref: "<project>/<env>/<NAME>"}` for exactly that slot; a `capability`
  source never releases a slot (the owner's capability is called instead). The value enters only the child process's
  environment. The token arrives in the environment variable `FABRIC_DELEGATION_TOKEN`, which `use_secret.py` reads
  and removes before `exec`, never logged and never in argv. The agent using the slot mints that token from the hub
  under its own grant, or onward from the token of the work it is doing on someone's behalf. Refusals: `no-grant`,
  `credential-source-refused` (the token's project is not the slot's), `principal-unproven`, `grant-revoked` /
  `grant-expired` from the projection, `unknown-state` when the projection cannot be read.

### Amendment 3 — 2026-10-11: one grant per token; the meter's hop; approvals; one refusal form

Answers to fabric-agent-contract-75's audit of DEC-0037…0040 (F-B-301, F-B-305, F-B-306, F-B-311, F-B-314):

- **One grant per token** (F-B-305). A delegation token names exactly one grant (`grant` has at most one item in 0.1);
  an onward token keeps the same reference. A callee cannot point the meter at a grant the token was not minted under.
- **The meter's hop is outside the depth limit** (F-B-306). A token whose `aud` is the meter, scope `grant-check` and
  effect `none` may be one actor deeper than the chain limit (five); no other token may.
- **No `device` approval yet** (F-B-314). `approval.method` is `prompt` or `operator-channel`; a device check returns
  with its own decision. Fabric issues only those two.
- **One refusal form** (F-B-301). The meter answers a grant-check `denied` document whose code is from the one set; the
  callee passes that code unchanged into the `error.code` of its own refusal (DL-19).
- **DEC-0039 tightens a service rule** (F-B-311): the operator-session lifetime is a MUST, so a kit cookie longer than
  seven days now breaks the contract; the contract marks DEC-0039 as a tightening and defines when a descriptor token
  "rotates".
- Observed in the meter's port (project-observatory-dashboard #210): a grant whose `credentialSource` names another
  agent's key fails the standing-grant schema, so the meter answers `unknown-state` rather than
  `credential-source-refused` — fail closed, the same outcome for the caller.

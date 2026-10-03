# Proposal (ADR-0115 when filed) — A local agent reaches a cloud product through Fabric, on the operator's consent

**Status:** draft proposal · 2026-10-03 · becomes `docs/adr/0115-…` when the docs lease is free (the ADR id is reserved then, `agent_sync.py reserve ADR`) · supersedes ADR-0034 (the route) · extends ADR-0026 (the binding) · AR-3.1

## Context

The operator, on 2026-10-03, said what a local agent reaching a cloud product should feel like:
"something pops up, you authorise, and it goes on" — with no key made in another app and pasted
into a third. The first case is a local research service that has to read one mailbox,
`news@example.com`, in Fabric Inbox. Fabric Inbox's server is a Cloudflare Worker behind Access.

Today that takes four manual steps:
1. Fabric Inbox → Agent access → make a key.
2. Copy the Client ID.
3. Copy the Client Secret.
4. Store both in the agent's own secret store.

The key that comes out reads every mailbox on every domain.

ADR-0034 put cross-agent MCP traffic through the machine's agentgateway. That gateway was
switched off on 2026-09-14. Since then every project that declares `mcp_servers` is refused, and
ADR-0034's own table already names the right long answer: *"Through Fabric — proxied by our own
surface: every call seen, meterable and refusable … not built."*

What has changed since ADR-0034 was written:

- **Fabric Inbox can limit an agent key to mailboxes.** This is AP-11 in fabric-inbox PR #16. A
  limited key sees only tools that stay inside a mailbox, and every route call is checked against
  the key's mailboxes.
- **The contract already defines the hub call.** `fabric-interop/0.1` C3.5 defines
  `agent.call {agentId, capability, input, idempotencyKey?}`: Fabric enforces the caller's binding
  and mints or holds the callee's credential, which travels in headers only.
- **Fabric already has a door toward agents.** `agentSurface.ts` is a Streamable HTTP server whose
  credential resolves to a scope. Today it opens only for sessions Fabric started itself.

## Decision

### 1. One door, a second way in

`AgentSurface` gets an **external ingress** for agents registered on this machine. These are the
`fabric-service/0.1` descriptors in `services/` and the `fabric-provider/0.1` entries in `providers/`
(AR-2.2, the reader only). It stays one server, as the surface's header requires. The only
difference is where the credential came from.

Fabric publishes its own `fabric-service/0.1` descriptor with a stable loopback port, so a local
agent can find the surface the same way Fabric Dashboards finds every other service.

### 2. Admission is a device-style consent, not a pasted key

The flow follows OAuth device authorization (RFC 8628), adapted to loopback:

1. **The agent asks.** It calls `fabric.access.request {agentId, callee, capabilities[], resources[],
   reason}` using the **door token**: the `auth.tokenFile` of Fabric's own descriptor. The door token
   authorizes asking and nothing else.
2. **Fabric checks the agent exists.** `agentId` must resolve in the registry; otherwise the request is
   refused before anyone sees a prompt.
3. **The operator sees one prompt.** It is a native dialog, asynchronous, with a parent window: the
   lesson at `index.ts:4100-4108`. When Fabric is in the background, an OS notification is shown
   instead, with the same request in the attention queue (SCR-24). The prompt states:
   - the agent's **registry** name and id, and where it was installed from (`installedBy`,
     `source.repository`);
   - what it asks for, in the product's own words ("read mail in news@example.com");
   - why it asks (the `reason`, quoted as the agent's own claim);
   - **Allow** and **Deny**.
4. **The agent waits.** It polls `fabric.access.status {requestId}` and gets
   `pending | allowed | denied | expired`. A request expires after 10 minutes. On Allow, the first
   poll returns the **binding credential exactly once**.
5. **The agent stores the credential.** It keeps it the way it keeps every secret: in Project
   Observatory's vault, under its own project. Fabric stores only a verifier (ADR-0026 §3).

What the prompt cannot prove, stated as the surface's header states it: every local process runs as
the same user. Fabric can show that the request names a registered agent; it cannot prove which
process sent it. The prompt therefore says *"an agent registered as example-agent"*, not "example-agent".

### 3. Grants are standing, narrow and revocable

**Allow** writes an **access grant**. Its fields:
- binding;
- callee;
- capability;
- resource pattern, e.g. `cloudflare:news@example.com`;
- decided by;
- decided at;
- expiry (default 1 year);
- revoked at.

**Deny** writes a refusal row. The same request then returns `denied` until the operator clears it.

Asking for a new capability or resource is a new request and a new prompt (incremental consent).
Nothing widens silently.

Revocation stops the next call immediately (ADR-0026 §9). The grant list is shown with a Revoke
action; the minimal list lives in the existing Settings surface.

### 4. The callee's credential never leaves Fabric

`agent.call` resolves `callee` in the registry. A cloud product is `placement: remote`, with an
https origin.

- **Per product, once.** Fabric holds **one** credential for each product, connected once. For
  Fabric Inbox this is an agent key named "Fabric", made once in Fabric Inbox. That key is one key
  for the whole hub, not one per agent.
- **Where it is kept.** The key is read through Project Observatory's door: `use_secret.py run
  --vault-only` or the Observatory MCP, decided in the plan. It is held in memory only and never
  written to a session bundle, a log or the journal.
- **Every forwarded call is narrowed to the grant.** Fabric checks that the call's resource
  arguments fit the grant's resource pattern. It also sends the grant's resources to the product in
  a **narrowing header**, which the product intersects with the key's own scope (fabric-inbox:
  `X-Fabric-Accounts`, applied through the AP-11 `scopedApi`; it can narrow, never widen). The grant
  is therefore enforced twice: by Fabric, and by the product's own server.
- **Journal.** Each hop writes one journal span, child of the caller's `traceparent` (C3.4). The
  span records caller binding id, callee, capability, redacted argument hash, outcome and the grant
  that allowed it.

### 5. What is refused

- **Calling a product without a grant.** The answer is `access-required`, with the
  `fabric.access.request` arguments that would ask for it. It is a refusal, never a pass-through.
- **A credential for the callee in the agent's hands.** Direct stays refused (ADR-0034 consequence 1
  carries over).
- **A prompt for an `agentId` that is not in the registry.**
- **Any grant without an expiry.**

## Consequences

- The four-step paste disappears. Connecting a product to Fabric is a once-per-product act; each new
  agent costs one click.
- The gateway path goes away. `ServerSource 'fabric'`, today "declared and unimplemented → REFUSES",
  becomes the implemented route, and `'gateway'` is retired together with ADR-0034.
- Fabric gains standing grants and long-lived binding credentials. This needs a migration:
  `access_bindings`, `access_grants`, `access_requests`. The one-shot floor `grants` table is
  untouched.
- The surface's rule 3 ("a handshake, not a password") is narrowed, not dropped:
  - sessions Fabric starts keep the one-shot bearer;
  - an external binding is long-lived and revocable, which is the only way an agent that restarts
    can keep working;
  - its floor is the same-user floor, written into the prompt.
- AGENTS.md:147 ("creates no Keychain item") still holds: product credentials live in Observatory's
  vault, not in Fabric.

## Rejected alternatives

| Alternative | Why rejected |
|---|---|
| **Each product grows its own consent prompt and hands the agent a key** (a bridge in Fabric Inbox) | Each product reinvents consent, and the agent ends up holding a product key. The operator chose the hub, 2026-10-03. |
| **The agent's descriptor token as proof of identity** | That token authenticates calls *into* the agent, and any same-user process can read it. |
| **Prompt on every call** | Fatigue makes Allow automatic, which is worse than no prompt. |
| **One Fabric credential with no narrowing at the product** | Fabric would be the only line of defence. The product's own scope check costs one header. |

## Plan (AR-3, the vertical slice)

| Slice | Packet | What it delivers |
|---|---|---|
| S1 | AR-2.2 (Fabric part) | Registry reader for `services/` and `providers/` |
| S2 | AR-3.1 | Migration, external ingress, Fabric's own descriptor, `agent.call` |
| S3 | AR-3.4 | Device-style consent: native prompt, attention fallback, request/status, grants, revoke |
| S4 | — | Product credential via Observatory, forwarder, narrowing header (plus fabric-inbox `X-Fabric-Accounts`) |
| S5 | — | The first consumer, wired in its own private repository |

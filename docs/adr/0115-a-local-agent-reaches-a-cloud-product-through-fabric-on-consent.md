# ADR-0115 — A local agent reaches a cloud product through Fabric, on the operator's consent

**Status:** accepted · 2026-10-03 · supersedes ADR-0034's route (the machine gateway) · extends ADR-0026 (the binding) · AR-3.1, AR-3.4 · operator decision 2026-10-03 ("through Fabric, in slices"; "the product connects without copying")

## Context

The operator, on 2026-10-03, said what a local agent reaching a cloud product should feel like:
**"something pops up, you authorise, and it goes on"**. There should be no key made in one app and
pasted into a third.

The first case is a local research service that must read one mailbox in Fabric Inbox. Fabric
Inbox's server is a Cloudflare Worker behind Access. Today that takes four manual steps: make a key
in Fabric Inbox → Agent access, copy two values, and store them. The key that comes out reads every
mailbox on every domain.

ADR-0034 routed cross-agent MCP traffic through the machine's agentgateway. That gateway was
switched off on 2026-09-14. Every project that declares `mcp_servers` has been refused since. ADR-0034's
own table already names the right long answer: *"Through Fabric — proxied by our own surface: every
call seen, meterable and refusable … not built."*

What makes it buildable now:

- **Fabric Inbox can scope a key to mailboxes** (AP-11, `passioncode-ai/fabric-inbox#16`). A key
  limited to mailboxes sees only tools that stay inside a mailbox, and every route call it makes is
  checked against its accounts.
- **The contract defines the hub call.** `fabric-interop/0.1` C3.5 is `agent.call {agentId,
  capability, input, idempotencyKey?}`. Fabric enforces the caller's binding and holds the callee's
  credential, which travels in headers only.
- **Fabric already has a door toward agents.** `apps/desktop/src/main/agentSurface.ts` is a
  Streamable HTTP server whose credential resolves to a scope. Today it opens only for sessions Fabric
  started itself.

## Decision

### 1. One door, a second way in

`AgentSurface` gains an **external ingress** for agents registered on this machine. "Registered"
means listed as `fabric-service/0.1` descriptors in `services/` or as `fabric-provider/0.1` entries
in `providers/`. The ingress is AR-2.2, the reader only.

It stays one server, as the surface's header requires. The only difference is where the credential
came from.

**Discovery.** Fabric is an app, not a launchd service, so it does not publish a `fabric-service`
descriptor. While running it keeps a stable loopback port and writes
`~/Library/Application Support/ai.passioncode.fabric/hub.json` (mode 0600):

```json
{ "protocol": "fabric-hub/0.1", "origin": "http://127.0.0.1:<port>", "mcp": "/mcp",
  "doorTokenFile": "<path, 0600>", "pid": 0, "startedAt": "<iso>" }
```

It removes the file on quit. An agent that finds no live hub asks the local lifecycle broker to
`ensure_running` Fabric, which is already enrolled on demand.

### 2. An agent is admitted by device-style consent, not by a pasted key

This adapts RFC 8628 (device authorization) to loopback.

1. **The agent asks.** It calls the MCP tool `fabric.access.request {agentId, callee, capabilities[],
   resources[], reason}`, carrying the **door token** as its bearer. The door token allows asking and
   nothing else. It may be reused, and it is never spent.
2. **Fabric checks the agent is registered.** `agentId` must resolve in the registry. If it does not,
   the request is refused before any prompt.
3. **The operator sees one prompt.** It is a native dialog, asynchronous, with a parent window
   (lesson at `index.ts:4100-4108`). When Fabric is in the background, an OS notification is shown
   and the request is placed in the attention queue (SCR-24). The prompt states:
   - the agent's **registry** name and id, and where it came from (`installedBy`,
     `source.repository`);
   - what it asks, in the product's words (for example "read mail in news@example.com");
   - why, quoting the agent's `reason` as its own claim;
   - **Allow** / **Deny**.
4. **The agent polls.** `fabric.access.status {requestId}` returns `pending`, `allowed`, `denied` or
   `expired`. A request expires after 10 minutes. On Allow, the first status read returns the
   **binding credential exactly once**.
5. **Storage.** The agent stores the credential the way it stores every secret: in Project
   Observatory's vault. Fabric keeps only a verifier (ADR-0026 §3).

**What the prompt cannot prove.** Every local process runs as the same user. Fabric can show that
the request names a registered agent; it cannot prove which process sent it. The prompt therefore
says *"an agent registered as example-agent"*. This is the same-user floor stated in the surface's
header, now stated to the operator.

### 3. Grants are standing, narrow and revocable

**Allow** writes an **access grant** with these fields: binding, callee, capability, resource
pattern (e.g. `cloudflare:news@example.com`), decided by, decided at, expiry (default 1 year), and
revoked at.

**Deny** writes a refusal. The same request is then answered `denied` until the operator clears it.

A new capability or a new resource needs a new request and a new prompt (incremental consent).
Nothing widens silently.

Revoking stops the next call (ADR-0026 §9). The grants are listed with a Revoke action.

### 4. A product is connected once, by the product's own consent

Fabric holds **one credential per connected product**. It obtains it without the operator copying
anything. The first product is Fabric Inbox.

1. **Fabric opens the product's connect link.** For Fabric Inbox:
   `fabric-inbox://connect?client=Fabric&client_id=fabric&level=admin&callback=http://127.0.0.1:<port>/fabric/v1/connect/fabric-inbox&state=<nonce>`.
   - `callback` must be a loopback `http` URL.
   - `state` is 22–128 characters, single use, and expires in 10 minutes.
2. **The product's app asks the operator.** The Fabric Inbox desktop app shows its own native
   prompt: "Connect Fabric to Fabric Inbox? — Admin: …" with **Allow** / **Deny**.
3. **On Allow, the app mints the key.** It creates the key through the owner's existing signed-in
   session: `POST /api/agent-keys`, the same route a person uses in Agent access. A person clicked
   Allow in the app, so "keys are issued by a person in the app" still holds.
4. **The app delivers the key.** It POSTs `{state, outcome, server, mcpUrl, key:{id, clientId,
   level, send, expiresAt}, clientSecret}` to the callback.
   - If the callback does not answer 2xx within 10 s, the app revokes the key and says so.
   - Deny is delivered as `{state, outcome:"denied"}`.
5. **Fabric stores it.** Fabric checks `state`, then stores the secret through Project Observatory's
   door: `vault.py put fabric <env> FABRIC_INBOX_CLIENT_SECRET`, value on stdin. Non-secret
   metadata goes to Fabric's own store. In memory the value lives only for the duration of a call.
   - Without Observatory installed, the connection is refused with that reason; it is not kept
     anywhere weaker.
   - AGENTS' "creates no Keychain item" still holds.

### 5. Every forwarded call is narrowed twice

`agent.call {agentId: <callee>, capability, input, idempotencyKey}`, made with a binding
credential, works as follows:

1. **Resolve.** Fabric resolves the callee among its connected products.
2. **Check the grant.** Fabric checks that the caller's grant covers the capability, and that the
   input's resource arguments fit the grant's resource pattern.
3. **Narrow at the product too.** Fabric sends the grant's resources in a **narrowing header** that
   the product intersects with the key's own scope. Fabric Inbox's header is `X-Fabric-Accounts`;
   it can narrow, never widen.
4. **Journal.** Each hop writes one journal span, a child of the caller's `traceparent` (C3.4). The
   span records:
   - caller binding id;
   - callee and capability;
   - redacted argument hash;
   - the grant that allowed it;
   - outcome.

**Product setup asked for in the same consent.** An action like "create the mailbox you asked to
read" runs **without** the narrowing header, because it acts on the workspace. It runs only when
the caller's grant names it as a capability of its own, which the operator saw in the prompt.

### 6. Refused

- **A call with no grant.** The answer is `access-required` together with the
  `fabric.access.request` arguments that would ask for access. It is not passed through.
- **Handing the callee's credential to the agent.** Direct stays refused; ADR-0034 consequence 1
  carries over.
- **A prompt for an unregistered `agentId`.**
- **A grant without an expiry.**
- **A connect callback that is not loopback.**
- **A product secret kept outside the vault.**

## Consequences

- The paste disappears. A product is connected once, with one click in the product's own app.
  Each agent then needs one click in Fabric.
- `ServerSource 'fabric'` becomes the implemented route. Today it is "declared and unimplemented →
  REFUSES". `'gateway'` is retired with this record.
- **Storage.** Fabric gains standing grants and long-lived binding credentials:
  `access_bindings`, `access_grants`, `access_requests` and `product_connections`. The one-shot floor
  `grants` table is untouched.
- **Credential lifetime.** The surface's rule 3 ("a handshake, not a password") is narrowed, not
  dropped:
  - sessions Fabric starts keep their one-shot bearer;
  - an external binding is long-lived and revocable, which is the only way a service that restarts
    keeps working;
  - its floor is the same-user floor, written into the prompt.
- Fabric Inbox gains a connect link with its own consent, and the `X-Fabric-Accounts` narrowing
  header. Both are in its repository.

## Rejected alternatives

| Alternative | Why rejected |
|---|---|
| Each product prompts and hands the agent a key | Every product would reinvent consent, and the agent would hold a product key. |
| The agent's descriptor token as its identity | That token authenticates calls *into* the agent, and any same-user process can read it. |
| A prompt on every call | Fatigue makes Allow reflexive. |
| The operator makes the product key by hand | That is the paste this record removes. It stays possible as a manual fallback, and is never the path. |
| A Fabric `fabric-service` descriptor for discovery | Fabric is an app, not a launchd service. A descriptor would claim a lifecycle it does not have. |

## Slices

| Slice | Scope |
|---|---|
| S1 | AR-2.2: registry reader |
| S2 | AR-3.1: stable port and `hub.json`; external ingress; migration; `agent.call` |
| S3 | AR-3.4: access request/status, native prompt plus attention fallback, grants, revoke |
| S4 | Product connections: connect link, callback, vault store, forwarder with narrowing |
| S5 | First consumer, in its own private repository |

Fabric Inbox's half (AP-11 scope, the narrowing header, the connect link) lands in
`passioncode-ai/fabric-inbox`.

## Amendments — security review of PR #7 (2026-10-03)

The decision stands. An adversarial review of the S2–S4 implementation found ways around it, and closing them
made five points explicit. Each is enforced in code and covered by a test.

1. **§1 — `hub.json` does not prove who holds the port.** While Fabric is down, any program can listen on the
   hub's port. An agent must re-read `hub.json` and check that its `pid` is alive before sending a binding
   credential. If the file is absent, or its pid is dead, there is no hub, whatever answers on the port. The
   hub's `fabric.access.*` tool descriptions say this to the agent (`apps/desktop/src/main/hubTools.ts`).
2. **§2 — the prompt is the operator's words.** Text that came from outside Fabric is shown on one line, with
   control, line-break, zero-width and bidirectional characters removed. This covers the reason, the registry's
   name, `installedBy` and `source.repository`, and the resources. The reason is quoted and cut at 300
   characters. The attention queue and Settings → Agent access show the same facts as the prompt before their
   Allow (`consentFacts` in `apps/desktop/src/shared/access.ts`).
3. **§3 — one live grant per binding, callee, capability and resource.** A second Allow of the same thing
   extends that grant. Migration 76 enforces it with the index `access_grants_one_live`.
4. **§4 — record first, then the secret; reconnect is explicit.** `product.connected@1` is journalled before
   the vault slot is switched. A vault that refuses the secret has that record withdrawn. A connected product
   is connected again only by the operator's Reconnect.
5. **§5 — narrowing and setup carry only what was shown.** An account id follows the product's own rule, with
   no `,`, `:` or `%` and a dot in the domain. A narrowing entry containing a separator or a line break is not
   sent. `create_address` forwards only the address's own fields. `forwardTo` and `agent` are capabilities of
   their own, `create_address.forward_to` and `create_address.reply_agent`, granted per address. No request to
   a product follows a redirect. The forwarder's deadline bounds the whole exchange. An idempotency key replays
   only answers the product produced, kept per binding.

## Amendments — release verification of 0.3.1, iteration 1: what the record says (2026-10-04)

The decision stands. Independent verification of `67a5dc42` ([ledger](../evidence/plans/2026-10-04-hub-verification.md))
found sentences above that do not describe what was built. They are corrected here; the text above is not edited.

6. **Consequences — the routes.** `ServerSource 'fabric'` is implemented for **external registered agents only**: an
   agent registered in `services/` or `providers/` reaches a product through the hub. For a session Fabric starts,
   `'fabric'` still refuses (`apps/desktop/src/shared/servers.ts`, `planServers`, "no grant model for a product yet",
   CO-194). `'gateway'` is **not** removed from the code: it stays in `ServerSource` and `planServers`, and is
   unreachable because the machine gateway has been switched off since 2026-09-14. "Retired with this record" means
   retired as a route, not deleted.
7. **§1 — which slice is the ingress.** AR-2.2 is the registry **reader** (S1). The ingress, the stable port and
   `hub.json` are AR-3.1 (S2), as the Slices table says.
8. **§2.3 — where the parent-window lesson lives, and where the request is queued.** The lesson is cited by
   symbol, not by line: the startup-failure dialog in `apps/desktop/src/main/index.ts`, the comment that begins
   "A PARENT WINDOW, not a free-standing dialog". A request shown while Fabric is in the background is an `access`
   row in the attention queue of **SCR-41** (FLW-75), not SCR-24: SCR-24, the approval queue, is designed only.
9. **§3, §5 — no resource pattern exists.** A grant names **one exact resource**, normalised the way the product
   reads it (`cloudflare:news@example.com`), and a call is covered only when every resource it names equals a
   granted one (`coverage` in `apps/desktop/src/shared/access.ts`). "Resource pattern" above means that exact,
   normalised resource; there is no wildcard or pattern syntax.
10. **§4.4, §4.5 — what the product may deliver, and how the vault is written.** Besides `connected` and
    `denied`, the product may deliver `{state, outcome:"failed", error}` (`no_server`, `sign_in_required`,
    `mint_failed`); Fabric records it as the last attempt and keeps no key. The vault is written with
    `vault.py put` for a new slot and `vault.py rotate` when the slot already exists, value on stdin in both.

## Amendments — release verification of 0.3.1, iteration 1: what the code now does (2026-10-04)

The decision stands. These are the behaviours iteration 1 found missing or unsafe and the branch
`agent/hub-0.3.1-verification` changed; each is enforced in code and named with its test in the
[ledger](../evidence/plans/2026-10-04-hub-verification.md) (V1 rows). The text above is not edited.

11. **§2.2 — a poll secret per request (RFC 8628's device code).** The answer that CREATES a request carries
    `pollSecret` (32 random bytes, base64url); Fabric journals only its sha256 (`access_requests.poll_verifier`,
    migration 77). Through the door, `fabric.access.status` takes `{requestId, pollSecret}`, compares in constant
    time, and answers a wrong or missing secret exactly as an unknown id (`unknown-request`). Asking the same thing
    again while it waits returns the same `requestId` and **no** secret, so another holder of the door token cannot
    read the answer or collect the credential the operator granted on someone else's prompt. A binding reading its
    own incremental request needs no secret. Requests written before migration 77 carry no verifier and cannot be
    read through the door; their agents ask again.
12. **§2.4 — the credential is collected within 10 minutes of the decision, or never.** The first door read after
    Allow carries the binding credential only within `CREDENTIAL_CLAIM_WINDOW_MS` (10 minutes,
    `apps/desktop/src/shared/access.ts`); after it the status says so and the agent asks again. Migration 76's
    header ("a restart between Allow and that read loses nothing") holds inside that window only. A binding whose
    credential can no longer be collected is not listed as an agent with access in Settings → Agent access.
13. **§4.4 — the callback keeps the product's 10 s, or keeps nothing.** One deadline, `CALLBACK_DEADLINE_MS` = 8 s
    (`productConnect.ts`), covers reading the body, the vault write and the record. The order is now **secret first,
    record second**: the secret is stored, then `product.connected@1` is appended only while the deadline holds and
    the product is still waiting, then 200. Past the deadline, or when the product hangs up, nothing is recorded and
    the answer is not 2xx, so the product revokes its key; a record that itself lands late is withdrawn at once
    (`product.disconnected@1`). This replaces amendment 4's record-first order. **Reconnect:** a failed or slow vault
    leaves the previous connection live; only a record that lands late on a Reconnect has already superseded it, and
    the outcome then says the previous connection was lost (`withdrawn`, `previousLost`) and asks to connect again.
14. **§4.5 — a secret slot per estate and per connection.** The vault slot is
    `FABRIC_INBOX_CLIENT_SECRET_<ESTATE HEX>_<CONNECTION HEX>` (project `fabric`, env `local`): connecting in one estate
    never overwrites another's, and a Reconnect never overwrites the key the live connection still uses. A slot no
    record names is inert; superseded slots stay in the vault until removed there (`vault.py remove`). Migration 77
    refuses a `secret_ref` that is not exactly `{project, env, name}`, so no value can be journalled.
15. **§4.6 — Disconnect does not revoke the key.** Disconnect stops Fabric using the connection at once; Fabric does
    not call the product. Settings → Agent access says the key stays valid in Fabric Inbox → Agent access until the
    operator revokes it there. The product's own Deny or failure is journalled as `product.connect.refused@1`.
16. **§3 — restored history is not authority (ADR-0077's rule, applied here).** An archive restored into an estate
    brings its hub history as history: a binding it created is projected revoked (`restore-boundary`) and never gets a
    verifier, its grants are revoked, a restored connection is removed; the operator consents and reconnects again.
    The four hub tables are guarded at the door like every other global id (ADR-0103; migration 77).
17. **§2.3 — the operator's language.** The prompt, the queue row and Settings → Agent access receive facts, never
    English sentences, and phrase them from `en.ts`/`ru.ts` (`apps/desktop/src/shared/accessWords.ts`); the native
    prompt reads the operator's language from settings when it opens. An account id that is not printable ASCII is
    refused, so what the prompt shows is byte-for-byte what is granted.
18. **§1 — the port on both loopbacks, and the origin as written.** The hub's port is also held on `[::1]` (a Mac
    without IPv6 skips it), and every tool description says to use `hub.json`'s origin exactly as written, never
    `localhost`. The door's budget is per request (status) or per agent (request) under a door-wide ceiling of five
    budgets; unknown bearers spend a quarter-budget before any database read.
19. **§5 — the contract on the wire.** What an agent can rely on, in one place:

    | Tool (principal) | Input | Answer |
    |---|---|---|
    | `fabric.access.request` (door, binding) | `{agentId, callee, capabilities[], resources[], reason}` | `{requestId, status: pending\|denied, expiresAt, pollSecret?, note}` |
    | `fabric.access.status` (door: + `pollSecret`; binding) | `{requestId, pollSecret}` | `{requestId, status: pending\|allowed\|denied\|expired, expiresAt, credential?, bindingId?, grants?, note}` |
    | `fabric.access.grants` (binding) | `{}` | `{agentId, grants: [{callee, capability, resource, expiresAt}]}` |
    | `agent.call` (binding) | `{agentId, capability, input, idempotencyKey?}` | the product's own answer, or a refusal |

    A refusal is `isError: true` with `{error: {code, message, data?}}`. Codes: `refused` (the request was not
    accepted; read the message), `unknown-request` (no such request, or a wrong poll secret), `hub-unavailable`
    (Fabric could not complete it; retry later), `unknown-callee`, `invalid-arguments`, `access-required` (`data`
    carries the `fabric.access.request` arguments to ask with), `product-not-connected`,
    `product-credential-unavailable`, `idempotency-conflict` (the key was used with other arguments), `cancelled`
    (the caller hung up before the product was reached), `product-unreachable`, `product-refused`, `product-error`.
    Retrying can succeed after `hub-unavailable`, `product-credential-unavailable`, `product-unreachable` and
    `cancelled` (with the same `idempotencyKey`); the others need the operator or a different request. HTTP: 401 for
    an unknown or revoked credential, 429 with `retry-after` when a budget is spent, 503 with `retry-after` when the
    hub cannot check credentials.

## Verification iteration 2 clarifications — 2026-10-04

These amendments supersede conflicting wire/availability wording in amendment 19; the original
record above remains as historical decision context.

20. **The forwarded answer is an interop envelope.** `agent.call` returns the
    `fabric-interop/0.1` result envelope with product output in `output`, not a bare product answer.
    A product-declared error is that envelope with `outcome: failed` and `isError: true`.
    A Fabric refusal is instead `isError: true` plus `{error:{code,message,data?}}`.
    Agents distinguish these shapes before reading `error.code`.
21. **An uncertain call is never promised safe retry.** Once `tools/call` may have been written,
    a failure records `outcome-unknown` for that idempotency key. The key cannot send again even
    after cache expiry; bounded retained/tombstoned memory may refuse new keys when full. Cancellation
    before any tool-call write may retry with the same key; cancellation/timeout after the boundary
    requires reconciliation. Runtime memory is not durable across process replacement; callers must
    reconcile side effects after restart. Revocation clears retained results, not prior effect facts.
22. **The listener admits native loopback clients.** Host must equal the published loopback address
    and port exactly; a request bearing browser Origin is refused before credential lookup. JSON-RPC
    batches are refused, so one budget charge cannot admit hundreds of tools. Existing verifier hints
    preload before listening to avoid unknown-token floods locking out a valid key after restart;
    a hint only skips the unknown budget, while live authentication still checks revocation.
    HTTP 421 is wrong Host, 403 browser Origin, 400 batch/malformed envelope, 413 oversized body,
    401 invalid/revoked credential, 429 budget, and 503 unavailable credential verification.
23. **Product scope is checked before forwarding.** Narrowed calls require the product's initialized
    server identity and supported narrowing version (Fabric Inbox >=0.9.0). A missing/older claim is
    `product-outdated` before a tool call. Version evidence is a compatibility check, not an attestation
    of arbitrary remote code. Exact origin and configured product trust remain required.
24. **Storage boundaries enforce writer promises.** Candidate migration filename suffix 80 (schema
    count 78) checks canonical IDs, event-key allowlists and reconnect predecessor CAS; archive replay
    retains history while removing pending poll authority. A restored request cannot gain a credential
    merely by retaining its source polling secret. Connector serialization complements DB CAS and does
    not replace it. Restore acceptance is checked through owned disposable-PG fixtures.
25. **Vault demand is bounded.** At most four secret reads run at a time, with a bounded waiting queue.
    Engine location/interpreter resolution is single-flight; credential values are never cached there.
    Cancellation leaves the wait queue and aborts a running handover. A full queue is a refusal, not
    an unbounded process or main-loop stall.
26. **Discovery is not process identity.** `hub.json` PID liveness distinguishes absence from a running
    process, but cannot prove that a reused PID belongs to Fabric. Clients use the origin verbatim and
    authenticate the scoped call; they must not infer authority from PID, bot name or registry visibility.
    Project communication enrollment is a separately scoped future capability, not an automatic extension
    of the product-call binding described here.

27. **Tool names retain the documented contract deviation until the owner publishes it.** Fabric
    accepts MCP product tool-name underscores under CO-193 / [fabric-agent-contract#8](https://github.com/passioncode-ai/fabric-agent-contract/issues/8).
    Strict clients using the previous published capability-name schema refuse those arguments.
    The owner correction must cover both the shared definition and manifest capability declarations;
    issue existence or a pushed source branch does not prove published contract/client compatibility.

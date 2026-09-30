# The federation seam: slots, delegation, and the artifact aperture

- **Status:** Accepted
- **Consequences / affects:** `docs/architecture/federation.md` (canonical design),
  `CONTEXT.md` (Interaction point, Member), `docs/evidence/backlog.md` (M39, M40),
  carry-over rows CO-070, CO-072, CO-074; upstream: `fabric-agent-contract`
  (profile `human`, profile "estate as provider")
- **Source:** operator vision 2026-08-27/28; the transport and security semantics are
  taken from the pinned doctrine — A2A v1.0 and the gateway duties in
  `agent-stack/agent-interop`, read 2026-08-28

Estates hold humans and other estates at their boundary, and one set of rules governs
every crossing. Five decisions:

1. **A human's place in a chain is an interaction point, and an interaction point is a
   capability call.** Its record declares `kind` (`respond` | `initiate` | `approve`),
   the role it addresses, `delegable`, an SLA with an escalation target, and typed
   payload/resolution schemas. The member surface is nothing but the projection of
   interrupts addressed to one's roles; resolving one is an event carrying the actor
   and the policy revision. A member never holds a credential — an approval triggers
   an effect through the organization's own connection binding under a grant whose
   precondition names the role.
2. **Delegation is a property of the point, and accountability does not delegate.** A
   `delegable` point may be served by the member's own estate — their personal chain
   fulfils the slot. A point whose meaning *is* the human — a refund confirmation,
   anything floored — declares `delegable: false`, and no automation crosses it by
   construction. However a slot is served, the resolution reads "member M via
   provider X": attribution stays on the person, the consuming chain's checker still
   gates the artifact, and a young delegation runs under a canary until promoted —
   trust is earned by watched runs for humans' automations exactly as for agents
   (ADR-0015 §5).
3. **The aperture rule: between any two estates — and between an organization and a
   member — only artifacts cross, only through declared points.** No implicit memory
   sharing exists at any level. A member sees the task payload, not the
   organization's memory; the organization sees the resolution artifact, not the
   member's estate. A2A's first principle — peers collaborate without shared memory,
   tools or context — is what makes the federation safe, and a configurable hole in
   it would return every price of ADR-0016 at once, unobservably. Widening a share is
   a new declared point with a grant, never a toggle.
4. **The transport is A2A v1.0; the internal artifact model is Part-compatible**
   (`text | raw | url | data` + mediaType), so crossing an estate boundary is a
   projection, not a translation. The task lifecycle is adopted as-is:
   `INPUT_REQUIRED` is a question rather than a failure — a slot waiting on a person
   for days is a legal state; terminal is terminal, and continuation is a new task
   under the same `contextId`, which maps one-to-one onto the interaction point's
   thread. Push notifications carry multi-day work; polling is the floor every
   client can fall back to. v1 binding is HTTP+JSON/REST; estate cards live at the
   well-known URI with sensitive capability detail only behind the authenticated
   extended card.
5. **The federation plane is a gateway and owes the eight gateway duties** —
   terminate and re-establish the protocol, federate behind one endpoint with
   consistent namespacing, carry server-initiated events across reconnects,
   authorize per tool and per caller, pin protocol revisions, **detect change in an
   advertised surface after admission** (the rug-pull), emit one audit trail with
   the identity on every hop, and route model traffic through the same seam so the
   wallet and the policy see one stream. Policy is enforced at each hop: authority
   does not travel with context.

**The consequence worth naming out loud:** because a slot is a capability and the
aperture is protocol-shaped, **the harness behind any provider is invisible at the
boundary.** An organization admitting a member's automation — or another estate's
agent — sees conformance, artifacts and checker verdicts, never the vendor inside.
Runner choice becomes a per-estate preference, with its measured limits recorded in
the runner conformance matrix (CO-074).

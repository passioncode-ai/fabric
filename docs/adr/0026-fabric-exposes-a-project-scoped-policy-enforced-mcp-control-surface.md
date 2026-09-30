# ADR-0026: Fabric exposes a project-scoped, policy-enforced MCP control surface

- **Status:** Accepted
- **Date:** 2026-08-30
- **Source:** operator request, 2026-08-30; M15; MCP specification revision 2026-07-28
- **Affects:** `CONTEXT.md`, `docs/vision.md`, `docs/architecture/mcp-control-surface.md`,
  `docs/architecture/passioncode-platform.md`, `docs/architecture/federation.md`,
  `docs/architecture/project-workspaces.md`, `docs/evidence/backlog.md`, `docs/ux/`

## Context

Fabric already consumes MCP capabilities through its Integration plane. The operator also
needs the inverse direction: another agent should be able to connect to Fabric, see only
selected Projects, obtain current authorized context, submit artifacts or proposals and
start or control permitted Runs. Different agents need different credentials and different
authority without receiving an Estate-wide administrator session.

A generic API token in front of database endpoints would bypass the architecture already
settled by ADR-0013, ADR-0014, ADR-0022 and ADR-0023. A long-lived `tools/call` would also
recreate a second, non-durable Run lifecycle outside Fabric.

## Decision

1. Fabric exposes a **northbound MCP server**. This is distinct from Fabric's existing
   southbound MCP-client role. Both use MCP, but one admits external commands into Fabric
   and the other invokes capabilities from Fabric Runs.
2. The normative remote transport is Streamable HTTP. A local deployment may provide a
   stdio/loopback adapter, but it must resolve the same principal and access binding; local
   transport never implies all-Project authority.
3. Every credential resolves to one immutable **MCP access binding** owned by an Estate.
   The binding declares credential id, principal/client identity, an explicit finite set of
   Project ids, allowed resource/action scopes, effect ceiling, issue/expiry/revocation
   state and policy revision lineage. A raw credential is shown only at issuance, stored as
   a verifier and never logged.
4. The credential authenticates; it does not authorize by itself. At ingress, discovery,
   resource read, tool admission, credential release and every resulting Effect, Fabric
   evaluates principal + action + resource + context through ADR-0023. Missing, expired,
   revoked or indeterminate state denies the operation.
5. MCP Resources expose authorized projections with revision, provenance and freshness.
   MCP Tools admit typed commands such as starting/cancelling a Run, submitting an Artifact
   or Proposal, and resolving an Interaction point. There is no generic SQL, shell, arbitrary
   event append or unrestricted “execute” tool.
6. Every mutating call requires a stable idempotency key. The adapter appends a command to
   Fabric's Event Journal before acknowledging it and returns the existing command, Run or
   receipt on replay. The MCP server owns no parallel work database.
7. A long-running operation returns an MCP Tasks handle when the client negotiated that
   extension. Otherwise the tool returns a Fabric durable handle plus an authorized Resource
   URI for polling. Connection lifetime never determines Run lifetime.
8. Starting a Run authorizes admission, not ambient delegation. Workers receive only their
   existing per-Run bundle and scoped credentials. They never receive the external MCP
   credential. Run history pins the initiating access-binding id and decision receipt for
   attribution.
9. Revocation blocks new MCP requests immediately. An admitted Run and its history are not
   silently deleted or reported cancelled. Future Effects still re-authorize under Project
   policy; stopping work is an explicit `run.cancel` request and cancellation remains
   cooperative under ADR-0022.
10. `tools/list`, `resources/list` and templates are filtered by the request's current
    binding. Notifications are an acceleration only; clients must be able to poll after a
    reconnect. Every call writes an audit row with credential id (never secret), principal,
    Project, operation, redacted argument hash, policy/entity revisions, outcome and causal
    command/Run/receipt ids.

## Consequences

- External agents can participate in automation chains without becoming Fabric Providers,
  Estate members with broad sessions or database clients.
- “Control the whole Fabric” means the union of explicitly bound Projects and operations;
  no credential gains implicit access to current or future Projects.
- MCP remains a capability seam. When another autonomous Estate/agent is delegated an
  opaque outcome with its own task lifecycle, A2A remains the correct protocol.
- OAuth 2.1 protected-resource discovery and audience-bound tokens are the interoperability
  target for remote human-delegated clients. Service credentials may use a separately
  provisioned opaque bearer value, but must resolve to the same binding and policy checks.
- CO-059/065, CO-069/071, CO-078 and CO-081/082 remain implementation gates; this decision
  does not claim the server exists in code.

## Rejected alternatives

- **One Estate administrator token:** rejected because its blast radius grows whenever a
  Project is created and cannot express least privilege.
- **Project id supplied only as a tool argument:** rejected because a caller could change
  the argument; Project scope must also be in the binding and policy decision.
- **Direct database/API passthrough:** rejected because it bypasses journal, projections,
  policy receipts and durable Run semantics.
- **A2A for every control call:** rejected because the caller is using Fabric capabilities,
  not delegating an opaque peer outcome.
- **Cancel every Run when its token is revoked:** rejected because revocation of control
  access and cancellation of admitted durable work are different auditable decisions.

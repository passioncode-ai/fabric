# Fabric MCP control surface

**Status:** canonical direction under [ADR-0026](../adr/0026-fabric-exposes-a-project-scoped-policy-enforced-mcp-control-surface.md)
**Protocol pin:** MCP `2026-07-28`; Tasks extension checked 2026-08-30
**Implementation status:** architecture only; no server is implemented in this repository

> **Vocabulary note, 2026-09-08 (S10 · [ADR-0045](../adr/0045-workflow-runs-task-runs-and-explicit-iterations.md)):**
> where this document says **run** it means a **WorkflowRun** — one execution of one
> pinned graph version, the wire's `run_id`. A **TaskRun** is a different identity: one
> admitted attempt at one Task. The bare word is no longer used alone, and
> [`CONTEXT.md`](../../CONTEXT.md) defines both. This note clarifies the reading; the
> text below is unchanged and remains the record of its own decision.


## 1. Boundary and topology

Fabric speaks MCP in two directions:

```mermaid
flowchart LR
  EA[External agent / automation] -->|northbound MCP · scoped control| FMCP[Fabric MCP adapter]
  FMCP --> AUTH[Identity + access binding]
  AUTH --> POL[PolicyDecisionPort]
  POL --> CP[Control-plane ports]
  CP --> J[(Event Journal)]
  J --> RUN[DurableExecutionPort]
  RUN -->|southbound MCP · scoped capability| TOOL[Tool servers]
```

The northbound adapter terminates MCP and translates admitted requests into existing
Fabric domain commands and projection reads. It does not proxy arbitrary HTTP, expose the
database or create another orchestration state store. The southbound side remains the
per-Run capability surface compiled into a Provider binding.

Remote deployments use one Streamable HTTP resource endpoint. Authorization, rather than
URL shape or connection state, determines the visible Estate/Project surface. Local
deployments may add stdio or loopback transport but use the same binding resolver.

## 2. Access model

An MCP credential is a replaceable proof that points to an immutable access binding:

```text
credential id -> MCP access binding revision
                 ├─ estate id
                 ├─ principal / client identity
                 ├─ explicit project ids[]
                 ├─ resource scopes[]
                 ├─ command scopes[]
                 ├─ effect ceiling
                 ├─ issued / expires / revoked
                 └─ policy lineage
```

The raw bearer value is shown once, retained only as a verifier and excluded from URLs,
MCP arguments, traces, tool results and audit rows. Rotation creates a new credential; a
scope change creates a new binding revision. Neither operation edits history.

V1 accepts an explicit finite Project set. “Every current and future Project” is not a
shortcut or checkbox on token creation: it is a dynamic Estate authority that requires a
separately reviewed Grant once CO-059/065 settles its algebra.

Suggested command scopes are orthogonal rather than misleading role names:

| Scope | Allows | Does not imply |
|---|---|---|
| `project.read` | authorized Project projections and configuration metadata | memory outside the Project or vault values |
| `run.read` | Run status, typed result, evidence and permitted trace projection | terminal secrets or another Project's Runs |
| `artifact.submit` | submit a typed Artifact to one Project aperture | acceptance, memory promotion or Effect |
| `proposal.submit` | address a Proposal to a Project PM | direct backlog/node mutation |
| `run.start` | admit a declared Routine/graph/capability Run | permission for every Effect inside it |
| `run.cancel` | request cooperative cancellation | proof that work or external effects stopped |
| `interaction.respond` | answer an addressed Interaction point | authority outside that point's declared choices |

An Estate may issue several credentials over different bindings. A credential's effective
authority is always the intersection of its binding, current principal membership, Project
policy, Estate floor and operation context.

## 3. MCP surface

### Resources — current authorized context

Resource discovery and reads expose projections, not tables. Candidate URI templates:

```text
fabric://estate/projects
fabric://estate/projects/{project_id}
fabric://estate/projects/{project_id}/attention
fabric://estate/projects/{project_id}/runs/{run_id}
fabric://estate/projects/{project_id}/artifacts/{artifact_id}
fabric://estate/projects/{project_id}/interactions/{interaction_id}
```

Every payload carries its Project id, projection revision, `observedAt`, freshness/stale
state and resolvable receipts. Sensitive fields are omitted at projection time rather than
redacted after serialization. Resource and template lists may vary by per-request
authorization, as MCP 2026-07-28 permits. Cache scope is private; a revocation or policy
change invalidates the relevant list/read cache.

### Tools — admitted domain commands

The first stable tool namespace is deliberately small:

| Tool | Typed outcome |
|---|---|
| `fabric_run_start` | admitted Run id plus MCP Task or Fabric polling handle |
| `fabric_run_cancel` | cancellation request receipt and current Run state |
| `fabric_artifact_submit` | immutable Artifact id and checker/acceptance next state |
| `fabric_proposal_submit` | Proposal id, target PM and resolution resource URI |
| `fabric_interaction_respond` | idempotent Interaction resolution receipt or `input_required` |

All mutating inputs include `projectId`, `idempotencyKey`, the expected Project/config
revision where concurrency matters, and a typed payload. Project id is checked against the
binding and again by policy; it is never trusted because it appeared in a valid schema.
There is no `fabric_execute`, raw event append, shell, SQL or arbitrary Provider-call tool.

## 4. Request and Run lifecycle

```mermaid
sequenceDiagram
  participant C as MCP client
  participant M as Fabric MCP adapter
  participant P as PolicyDecisionPort
  participant J as Event Journal
  participant D as DurableExecutionPort

  C->>M: tools/call + bearer credential + idempotency key
  M->>P: principal, operation, Project, request context
  P-->>M: allow / deny / indeterminate + decision receipt
  alt denied or indeterminate
    M-->>C: typed MCP tool error; no command appended
  else allowed
    M->>J: append admitted command + decision receipt
    J->>D: project command creates or signals Run
    D-->>M: durable Run/task handle
    M-->>C: CreateTaskResult or Fabric handle + Resource URI
  end
```

Duplicate idempotency keys in the same binding + Project + operation return the original
command/Run/receipt. A key reused for different arguments is rejected as a conflict.

When the client negotiates `io.modelcontextprotocol/tasks`, effect-bearing or long-running
calls return an MCP Task. `tasks/get`, `tasks/update` and `tasks/cancel` map to the same
durable Run/interrupt contract accepted by ADR-0022. Without Tasks support, the tool returns
a Fabric handle and authorized Resource URI; polling is still possible after reconnect.

Notifications are best-effort acceleration. A client must persist task/Run ids and poll;
no Run depends on an open SSE stream.

## 5. Revocation and failure semantics

| Condition | Fabric response |
|---|---|
| missing, malformed or unknown credential | transport authorization failure; no MCP surface disclosed beyond required discovery metadata |
| expired or revoked credential/binding | deny read and command admission; invalidate private caches |
| Project absent from binding | deny even if the request's `projectId` exists and the principal can access it elsewhere |
| scope absent | least-privilege scope challenge where applicable; no partial mutation |
| policy missing/error/timeout | `indeterminate` under ADR-0023; no read, credential release, command or Effect |
| stale projection | return only if its visibility lease remains valid, label stale and attach last receipt; never present as current |
| duplicate mutating call | return original identity/receipt when arguments match; reject conflicting reuse |
| client disconnect | Run continues durably; client resumes by task/Run id |
| cancellation requested | record request and current state; never claim cancellation before worker/effect reconciliation proves it |
| credential revoked during a Run | new MCP control stops; Run history remains; every later Effect still re-authorizes under Project policy |

## 6. Audit and security invariants

Every protocol hop records credential id, principal/client, Estate, Project, MCP method,
tool/resource identity, redacted argument hash, idempotency key, policy/entity revisions,
decision outcome, causal command/Run/Artifact/receipt ids, protocol revision and time. The
secret value, raw vault material and unrestricted payload are never audit fields.

Remote HTTP follows MCP's OAuth resource-server model: protected-resource metadata,
audience-bound tokens, least-privilege scopes, HTTPS and short-lived access tokens. A
service token provisioned in the Fabric owner surface is an alternative credential
acquisition path, not an alternative authorization model; it resolves to the same binding.

Tool/resource output is untrusted input to the calling agent. The server publishes precise
schemas, but the client must still validate and contextualize results. Fabric independently
validates every incoming argument and re-authorizes every hop. Direct internal paths do not
bypass those checks merely because a gateway already checked them.

## 7. Protocol boundary and non-goals

- MCP is correct when an external agent uses a Fabric capability whose schema Fabric owns.
- A2A remains correct when Fabric delegates an opaque outcome to an autonomous peer with its
  own task and artifact lifecycle.
- An external MCP client does not become a Provider, Project Agent, Estate member or worker
  merely by holding a credential.
- This surface does not grant raw memory synchronization, database access, secret export,
  arbitrary event publication, code execution or automatic acceptance of submitted work.

## 8. Implementation gates

Before this surface ships, fixtures must prove:

1. two credentials over different Project sets receive different deterministic
   `tools/list`/`resources/list` surfaces;
2. a valid token cannot cross its Project set by changing `projectId` or a Resource URI;
3. expiry, revocation and policy indeterminate all deny without mutation;
4. the same idempotency key replays one receipt, while changed arguments conflict;
5. a dropped client resumes the same Task/Run; cancellation is never overstated;
6. one-time credential reveal, rotation and logs never expose the raw value;
7. all allowed commands appear in the Event Journal with policy and causal receipts;
8. direct internal invocation and MCP invocation produce the same domain command contract.

## 9. Primary-source receipts

- [MCP specification 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28)
  — stateless per-request capability negotiation and protocol primitives; fetched
  2026-08-30 through `/specification/latest`.
- [MCP Authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/)
  and [security considerations](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/security-considerations)
  — OAuth resource-server role, protected-resource discovery, scope challenges, audience
  binding and token security; fetched 2026-08-30.
- [MCP Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools) and
  [Resources](https://modelcontextprotocol.io/specification/2026-07-28/server/resources) —
  model-controlled operations versus application-controlled context, with authorized
  discovery surfaces; fetched 2026-08-30.
- [MCP Tasks extension](https://modelcontextprotocol.io/extensions/tasks/overview) — durable
  task handles, polling, input-required and cooperative cancellation; fetched 2026-08-30.

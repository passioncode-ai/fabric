# Task brief — Fabric MCP control surface

**Status:** locked from the operator's 2026-08-30 request
**Run:** `fabricmcp0830`
**Scope:** architecture, contracts, UX scenarios and delivery state; no runtime implementation

## Request

Fabric itself must be connectable as an MCP server. An external agent may receive a
credential limited to selected Projects and a declared access ceiling, then read current
state, submit information and invoke admitted operations such as starting a Run. Several
credentials may coexist with different Project sets and different authority.

## Source ledger

| Source | What it establishes | Freshness / receipt | Contradictions |
|---|---|---|---|
| Operator request, 2026-08-30 | Fabric is both an MCP consumer and a northbound MCP control surface; credentials differ by Project and access | this brief | none; it sharpens M15 |
| [`CONTEXT.md`](../../../CONTEXT.md) | Project is the durable authority boundary; Grant is named, specific and expiring; Run is immutable | read 2026-08-30 | no credential-shaped term existed for this seam |
| [ADR-0013](../../adr/0013-project-is-a-persistent-agent-workspace.md), [ADR-0014](../../adr/0014-the-event-journal-is-the-spine-and-every-register-is-a-projection.md) | Project owns work/history; commands and results must enter the journal/projection lifecycle | read 2026-08-30 | none |
| [ADR-0022](../../adr/0022-durable-execution-is-an-adapter-over-the-event-journal.md), [ADR-0023](../../adr/0023-policy-is-an-embedded-decision-port-that-never-grants-on-uncertainty.md) | long work uses durable handles; every effect is re-authorized and uncertainty cannot grant access | read 2026-08-30 | none |
| [`docs/evidence/backlog.md`](../backlog.md) M15 | an MCP management surface was proposed | read 2026-08-30 | its old wording described only Fabric reaching tool servers; this run makes the direction explicitly bidirectional |
| `graphify-out/graph.json` (derived, gitignored) | MCP currently appears at provider, gateway, federation and external-contract seams; no northbound control contract exists | built at `acfa1c7`; 0 commits behind at harvest | current; refresh owed after docs change |
| [MCP 2026-07-28 Authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/) | HTTP MCP servers are OAuth resource servers; resource metadata, audience binding and least-privilege scope challenges are defined | fetched 2026-08-30; `/specification/latest` redirected to `2026-07-28` | none |
| [MCP 2026-07-28 Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools) and [Resources](https://modelcontextprotocol.io/specification/2026-07-28/server/resources) | tools are model-controlled operations; resources are application-controlled read context; both lists may vary by per-request authorization | fetched 2026-08-30 | none |
| [MCP Tasks extension](https://modelcontextprotocol.io/extensions/tasks/overview) | long-running calls may return a durable task handle with polling, input-required, completion and cooperative cancellation | fetched 2026-08-30 | extension rather than core; a non-Tasks fallback is required |

## Requirements

| ID | Requirement | Verification |
|---|---|---|
| MCP-REQ-001 | Fabric is explicitly both an MCP client and an MCP server, with the two directions named separately | ADR and protocol-allocation review |
| MCP-REQ-002 | One credential resolves to an immutable Estate-owned access binding with explicit Projects, allowed operations, expiry and revocation | ADR/domain review; no ambient all-Projects default |
| MCP-REQ-003 | Authentication never replaces policy: every request and every resulting effect is checked against current membership, binding and policy | failure-matrix review against ADR-0023 |
| MCP-REQ-004 | Read operations expose authorized, freshness-labelled projections/resources, never raw vault values, hidden memory or unfiltered journal rows | resource catalog and negative-boundary review |
| MCP-REQ-005 | Mutating tools accept typed inputs and idempotency keys, append a command to the Event Journal and return a command/run/receipt identity | tool catalog and lifecycle review |
| MCP-REQ-006 | Long Runs use MCP Tasks when negotiated and a Fabric durable-handle fallback otherwise; a dropped connection never owns execution state | compatibility and recovery review against ADR-0022 |
| MCP-REQ-007 | Revocation blocks new calls immediately and is re-evaluated on the next effect; it does not silently erase already-admitted history or pretend cancellation succeeded | revocation scenario and failure semantics review |
| MCP-REQ-008 | Owner UX covers create, one-time credential reveal, connect, audit, rotate and revoke; external-agent UX covers allowed read/write/run and denied paths | ST/FLW/SCR/SCN trace plus UX lint |
| MCP-REQ-009 | Public open-source narrative remains free of private economics | `bash scripts/check-narrative.sh` |

## Locked design choices

- The northbound surface is a thin protocol adapter over existing control-plane ports; it
  owns no separate Project, policy, Run or memory database.
- A credential references an access binding. Raw credentials are never stored or logged;
  authorization is derived from the live binding and policy revision on every request.
- V1 Project scope is an explicit finite set. A dynamic all-current/future selector is not
  inferred from a broad token and requires a separately reviewed future Grant.
- Read context is MCP Resources. Effects and command admission are MCP Tools. Long work is
  represented by MCP Tasks when available, never by holding `tools/call` open.
- Starting a Run authorizes admission only. The Run executes under its pinned Project,
  Agent/provider and policy/grant revisions; the caller's credential is not forwarded to a
  worker or external system.
- Revoking MCP access stops control and visibility through that credential. Existing Run
  history remains immutable; stopping a Run is an explicit, authorized cancellation.

## Inherited open dependencies

- CO-059/065: final unified effect and budgeted-Grant algebra.
- CO-069/071: vault custody, identity/session and RLS implementation.
- CO-078: event envelope and schema evolution.
- CO-081/082: retention/export and production service objectives/rate limits.

These dependencies constrain implementation; none changes the control-surface boundary
settled here.

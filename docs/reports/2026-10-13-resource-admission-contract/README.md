---
report:
  id: fabric/2026-10-13-resource-admission-contract
  title: "CO-282: local resource admission wave"
  kind: review
  project: fabric
  domains: [architecture]
  as_of: 2026-10-13
  status: draft
  valid_until: 2026-10-27
  summary: >-
    Continuation of the harness wave: local resource preflight and pending durable SQL
    reservation can be implemented before project-board access. Source, isolated tests,
    active schema, native enforcement and portable contract acceptance remain distinct.
  sources:
    - name: Resource implementation packets
      path: docs/execution/harness-waves/resource-implementation.md
      read_at: 2026-10-13
    - name: Local resource authority decision
      path: docs/adr/0152-resource-preflight-and-durable-reservation-are-distinct.md
      read_at: 2026-10-13
  produced_by: {agent: codex, task: CO-282}
  supersedes: []
  consumers: [fabric]
---

# CO-282 — local resource admission wave

This wave extends the [first repair review](../2026-10-13-harness-wave-review/README.md).
It does not supersede its immutable source receipts. The first review's11-node snapshot
is historical; the living graph includes subsequent tasks.

## Implementation boundary

[ADR-0152](../../adr/0152-resource-preflight-and-durable-reservation-are-distinct.md) records
local design authority. Fabric board access blocks owner requests, not internal injected
functions or isolated SQL implementation. The R1 preflight cannot grant admission. R2 uses
the current migration62 protections and remains pending DDL while104–106 ordering resolves.
No live schema, private database, portable contract or native/provider behavior is certified.

## Checks and open work

Implementation and independent review are in progress. No test result is asserted here yet.
The [execution graph](../../execution/harness-waves/graph.json) owns task state; the six
resource packets retain negative tests and the distinction between source and activation.

# ADR-0182: Fabric does not write `session-handoff/1`; the format belongs to Fabric Dashboards and the contract

**Status:** accepted · 2026-10-25, the operator's decision В-7 ([the audit of 2026-10-25, §6](../reports/2026-10-25-audit-and-plan/README.md#6-решения-оператора-2026-10-25-грилинг-этого-прохода),
its table row В-7: «`session-handoff/1` Fabric **не пишет**; формат за Dashboards и контрактом»), recorded 2026-10-26
by the 0.3.13 release review, iteration 1, PL-11 · supersedes in part
[ADR-0140](0140-a-session-is-handed-its-context-in-one-format-session-handoff-1.md) · plan row P-16, REQ-06.

## Context

ADR-0140 made `session-handoff/1` the one format for handing a session its context and named Fabric a conforming
writer. The writer was never built on `main`: `git grep session-handoff -- apps` finds only comments in
`apps/desktop/src/shared/contract/secretShape.ts`. The unverified branch `agent/w2-handoff` conflicted with ADR-0169,
which later changed how Fabric assembles an operator's console. On 2026-10-25 the operator decided that Fabric does not
write the format; the audit pass deleted the branch (`29c8de91`).

## Decision

1. Fabric does not write `session-handoff/1` and does not claim to conform to it. A session Fabric starts keeps
   Fabric's per-session bundle (`apps/desktop/src/main/sessionBundle.ts#createBundleCompiler`) with
   `execution-packet/1` as its integrity layer, assembled as ADR-0169 says.
2. The format, its schema and its conformance belong to Fabric Dashboards and fabric-agent-contract.
3. What stays from ADR-0140: Fabric's files live in its user-data folder, never in a repository; the preamble names
   exactly one first tool (`fabric_whoami`) and holds no rules.
4. ADR-0140's symmetry (decision 4) is withdrawn for Fabric's side: a Fabric Dashboards console that opens an agent of a
   Fabric project uses Dashboards' own pack.
5. If Fabric later needs to hand a session to another product in this format, a new record decides it, with a writer
   test the contract's validator runs.

## Consequences

- REQ-06 of the 0.4.0 plan narrows to "Dashboards' pack conforms"; ADR-0140's index row reads "accepted; superseded in
  part by ADR-0182". No code changes.
- Rejected: building the writer in 0.3.13 (the operator's other option in В-7), because the format's owners are
  Dashboards and the contract and Fabric's own bundle already carries what its sessions need.

## Amendments

- 2026-10-26: the Context's measurement undercounts. `git grep session-handoff -- apps` finds comments in two files,
  `apps/desktop/src/shared/contract/secretShape.ts` and `apps/desktop/src/shared/contract/folder-attribution/secret-shape.ts`
  (three lines each), and fifteen lines in the vendored contract's fixtures
  (`apps/desktop/test/fixtures/fabric-agent-contract/current/catalogue.json`); none is a writer, so the decision stands
  (the 0.3.13 release review, iteration 2, DO-10).

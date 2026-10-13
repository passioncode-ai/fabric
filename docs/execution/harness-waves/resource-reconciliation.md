# R4 — bounded local resource reconciliation

This is an opt-in internal kernel, not an installed recovery loop. No `index.ts`
composition, timer, migration activation, sampler, native observer or portable
contract changes are included. It uses the existing pending 107 ledger and release
RPC. Source baseline: `a3ad1cb5e47a88ab1fc3882f90ebe1478c1622e6`.

<a id="contract"></a>
## Contract

[`createResourceReconciliation`](../../../apps/desktop/src/main/resourceReconciliation.ts)
takes an explicitly configured Estate/host/pool, a trusted service-role database
client, page size (1–100), maximum pages (1–100), whole-sweep deadline (1–30000 ms)
and an optional scope-bound continuation cursor. No capacity defaults or agent
input select its scope. It reads `resource_reservations` through actual database
query calls, orders by the unique admission journal sequence, and fetches one
extra row to distinguish an exhausted page from a truncated page.

Each selected row must carry the same Estate/host/pool, valid reservation/run/session
identity, positive safe-integer run ordinal, admission sequence and numeric fence.
Malformed pages, duplicate identities, invalid ordering, accessor properties and
out-of-scope rows are unavailable evidence. They cause no release calls for that
page. Missing readings/schema/permissions are not an empty successful scan.

The only command is `release_resource_reservation`, with the exact durable Estate,
reservation, run, session and canonical fence. There is no call to cancel an
admission, end a run, release a task claim, signal a process or request provider
cancellation. A task's absence from local memory, age, expired lease or journalled
ending does not enter the release decision.

The release RPC remains the authority. In
[`pending 107`](../../../supabase/pending-migrations/20261013000107_resource_reservations.sql),
`release_resource_reservation` checks identity, held children, run ordinal and
`run_ownership_unresolved` under its locks. In
[`migration 62`](../../../supabase/migrations/20260927000062_managed_stop.sql), that
predicate requires an ended run plus a verified operational Stop or the exact
never-spawned compensation receipt. Replayed journal claims alone cannot establish
this proof. This module does not reimplement the predicate in JavaScript.

A successful RPC is insufficient for the kernel's `released` result: it must carry
literal `released: true`, boolean `repeated` and a positive safe receipt sequence;
a second scoped database read must confirm the same immutable identity in state
`released` with the same `released_seq`. SQL's known unresolved-execution or held-child
refusal produces `retained`. All other refusals, malformed replies, transport errors,
identity changes and failed readbacks produce `unknown`. A lost RPC reply never
becomes a local release confirmation, even if the database actually committed it.

## Bounded continuation and uncertainty

Concurrent calls on one instance share one sweep. Each attempted identity advances
the cursor even when retained or unknown, so repeatedly starting at the head cannot
starve later entries. The cursor can be stored and supplied to a new instance; the
caller owns checkpoint persistence. A completed held-row query wraps the next sweep
to the beginning, so parents retained for children and other old held rows are retried.
A timeout returns the last attempted cursor and does not consume late results. It
cannot cancel an already submitted database transaction. A timed-out operation retains
the instance's one I/O slot until its underlying promise actually settles. Further sweeps
return `prior_io_unresolved` immediately without starting queries or commands. Late
settlement opens the slot but never becomes a result for the timed-out sweep. This
bound is per instance: composition must reuse the instance, not replace it to bypass
a stuck operation. SQL idempotency remains necessary across actual process restarts
and uncertain retries.

`scan: complete` means the current held-row query reached its end, **not** that all
resources are released, all unknown effects resolved, or a concurrent insertion was
seen. Returned per-row outcomes preserve uncertainty. In particular, a row released
by SQL after a lost reply may disappear from later held-row pages; that absence must
not overwrite the earlier `unknown` outcome. Persisting/reconciling those outcomes
and restoring journal-marker-without-ledger inventories are subsequent work. An empty
operational ledger is not proof that a restored Estate has no unresolved resources.
This is not a snapshot scan or a fairness guarantee under continuous insertion.

## Focused verification

```sh
node --experimental-strip-types --test apps/desktop/test/resource-reconciliation.test.mjs
```

Result on this source iteration: **37 passed, 0 failed**, exit 0. Tests invoke the
production kernel with an injected database transport and inspect its actual scoped
queries/RPC arguments. They cover durable readback, a recreated controller, concurrent
sweeps, bounded resume and wrapping, held parents, malformed identities/pages/receipts,
unknown release, failed readback, missing schema, timeout and late completion. The
transport's controlled SQL verdict is a fixture, not a second implementation of Stop.
No native process, model, live database or schema activation ran.

Independent review rejected initial `fbab9257`: repeated sweeps after timeout could
accumulate uncancellable database promises. The correction keeps the outstanding
operation separate from the finished sweep. Query and release regressions each make
ten further calls while the original operation never settles, require exactly one
operation, then settle it late and require a fresh read before continuing.

Real SQL integration for this new caller: **NOT_RUN**, pending the serialized owned
PostgreSQL test slot. The prepared [caller fixture](../../../apps/desktop/test/resource-reconciliation-db.test.mjs)
imports the production kernel, translates its fluent query to a real scoped SQL
projection, and invokes the real release RPC as `service_role` through bounded psql.
It requires the existing pending-107 runner's disposable socket database; run it after
`resource-reservation-db.test.mjs` in that same cluster. The fixture covers compensated
release, a recreated scanner, unresolved ownership, parent/child release order and
a changed-fence negative control. Syntax validation passed; execution is not yet a receipt. Existing R2 SQL acceptance is linked from the
[resource review](../../reports/2026-10-13-resource-admission-contract/README.md#r2--reviewed-pending-reservation-authority)
and does not certify this new transport caller. Before activation, exercise this
kernel against an owned fixture applying the active chain plus pending 107: unresolved
process/provider/Stop states must remain held, valid exact-generation proof must
release, duplicate completion must not mint another release, and restore must retain
uncertainty. Independent source review and combined type/gate checks are also pending.

## Continuation and lessons applied

[Current retro](../../evidence/retro.md#recent-log) R-003/006/007 requires operational
authority and meaningful negative cases: this implementation delegates release to SQL
and checks changed-identity readback instead of inferring process death. R-009 keeps
its new caller acceptance separate from previous R2 fixtures. Local implementation
is permitted while board admission is unavailable; no cross-project owner acceptance
is inferred.

Next executable unit: isolated SQL integration of this kernel, then durable unknown
outcome/checkpoint storage and targeted retry after restart. Production scheduling,
restored-marker inventory, current native/provider observers and all entry-path
coverage remain open. Pending DDL promotion still needs the owning migration order
(104 is integrated; 105–106 remain reserved). Trusted policy/sampler work governs
admission, not release proof. No grant, file lease, spend authorization, installed
agent change or full R4 completion is claimed.

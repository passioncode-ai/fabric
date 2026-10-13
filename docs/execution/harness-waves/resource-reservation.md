# R2 — Internal durable resource reservation

Status: implemented as **pending DDL**, verified only in an owned disposable
PostgreSQL fixture. No active schema, installed application, default pool,
portable protocol or native runner enforcement is introduced by this packet.
The parent [resource decomposition](resource-implementation.md#r2-atomic-shared-reservation)
owns scope; the R1 preflight is advisory and cannot allocate this ledger.

## Authority and state

Source: [`20261013000107_resource_reservations.sql`](../../../supabase/pending-migrations/20261013000107_resource_reservations.sql).
It extends the **current migration62** admission/Stop semantics, not the older
migration61 bodies. The original begin/validate functions are renamed, revoked
from client roles and invoked by resource-aware wrappers. Existing unreserved
admissions retain their existing behavior; R3 must select the resource RPC before
any claim about managed-path enforcement.

One explicitly configured `(host_id, pool_id)` holds capacity across Estates.
Only the trusted `service_role` kernel can configure, observe, admit, cancel or
release. Neither agent inputs nor renderer requests may select a pool, capacity,
observation or policy revision as authority. There is no automatic configuration
and no machine-global inference. The caller adapter must inject the configured
scope and an independently resolved demand/ownership identity.

All four quantities are nonnegative safe integers: `workerSlots`, `memoryBytes`,
`diskBytes`, `cpuMilliCores` (1000 per CPU core). PostgreSQL uses exact `numeric`
arithmetic for sums; individual quantities cannot exceed JavaScript's safe
integer maximum. An executing task's `own_demand.workerSlots` is at least one.
An unknown, future or stale observation refuses admission and pre-spawn checks.
The configured freshness interval is explicit; a null or missing reading is
never zero. Identical timestamp with different observed values is refused.

Accounting is intentionally conservative: **root reservations + observed usage**.
No overlap credit is accepted. R1 can represent measured overlap, but an adapter
for this ledger must use an explicit zero overlap. A future sampler may reduce
double counting only after binding overlap to coherent reservation identities.
Reservations bound estimates; they do not enforce OS process memory/CPU limits.

Each reservation binds the Estate, task, run, session, run ordinal, host/pool,
immutable demand and own demand, optional parent, and eight identity fields:
`reservationId`, `attemptId`, positive numeric `fence`, `ownerId`, role
(`builder` / `reviewer` / `test`), `inputDigest`, `scopeDigest`,
`localPolicyRevision`. Digests are lowercase SHA-256. These fields identify the
attempt; they do **not** grant spend, provider access or a mutable-file lease.
After safe-integer validation, `fence` is stored as a canonical JSON integer.
Accepted numeric spellings `1.0`, `1.00` and `1e0` therefore recover the same
reservation and release/cancel with canonical text `1`; malformed, fractional
and out-of-range values remain refused (SQL admission normalization and the
`fence-scale` production SQL regression).

An admission transaction takes the Estate lock, session/reservation identity
locks, pool row lock and existing task locks. No pool transaction takes another
Estate's lock. The original `admit_task_launch` creates its authority/attempt and
journal receipts in that same transaction; failed reservation persistence rolls
back admission too. Repeating the exact identity returns its original run and
current held/released state. Changed demand, scope/input identity, parent or pool
refuses instead of allocating again. A legacy admission cannot be retroactively
converted into a second resource authority.

`demand` is an allocation envelope; `own_demand` is the part occupied by this
task itself. A child's envelope is debited from its parent's remainder after
the parent's own demand and existing child allocations. Child admission is
restricted to the same Estate, host, pool, owner and policy; the root is charged
once. Grandchildren use the same rule. A parent cannot release while any child
allocation is held. This prevents a child from minting a second pool or spending
its parent's own worker slot.

Operational reservations are protected tables, not journal projections. The
`resource.reserved@1` event is a historical binding marker; it cannot create or
release capacity. Replay preserves operational rows. Restoring that marker
without the local ledger refuses launch as `resource_reservation_unknown`.
History cannot import a live pool or release proof.

Release requires the exact Estate/reservation/run/session/fence and the existing
`run_ownership_unresolved` decision from migration62: a trusted observed stop or
recorded never-spawned compensation, with the matching run ordinal. Raw
`run.ended`/Stop events, elapsed leases and cancellation signals are insufficient.
Release is idempotent and never recreates a previously released reservation.

For an admission whose spawn permission was **never consumed**,
`cancel_resource_admission` takes the same locks, requires the matching lease and
generation, and rejects any launching/bound/terminal evidence. It records an
operational compensation before releasing. This is distinct from claiming an
already-started process stopped. After begin, use existing trusted
`fail_task_launch(false)` or observed Stop, then release. No automatic expiry or
background reconciliation loop is added here.

## Internal call surface

All functions are service-only except private helpers, which are revoked from
all client roles. Table mutations are also revoked from `service_role`.

| Function | Inputs / result |
|---|---|
| `configure_resource_pool` | Explicit host, pool, policy revision, capacity and max-age milliseconds; boolean. A held allocation prevents policy changes. Same revision cannot acquire different policy bytes. |
| `observe_resource_pool` | Exact host/pool/revision, complete observed vector, captured timestamp; boolean. No inferred overlap. |
| `admit_resource_task_launch` | Existing Estate/task/actor/session; injected host/pool; binding; demand and own demand; optional parent; existing trigger/person/membership revision. Returns the ordinary admission receipt plus `resource_reservation: { reservation_id, state, run_ordinal }`, or `admitted:false` and `reason_code`. |
| `begin_task_run_launch`, `validate_task_run_launch` | Existing argument shapes. Resource reservations add current reading/ledger checks before the preserved generation/authority checks. |
| `release_resource_reservation` | Exact Estate, reservation, run, session and fence (canonical base-10 integer text); `{ released, repeated?, receipt_seq?, reason_code? }`. |
| `cancel_resource_admission` | Same exact identity; only an unconsumed managed spawn permission can produce never-begun compensation. Same release result shape. |

No new MCP endpoint, renderer command or portable schema is published. SQL error
or a missing RPC response remains an unknown outcome: recover the same identity;
never retry with a new reservation/session to bypass uncertainty. Native cleanup,
host restarts and periodic reconciliation remain R4 work. The same-user database
service credential remains the existing trusted-kernel floor.

## Verification

Run from the repository root:

```sh
node apps/desktop/test/run-resource-reservation-db.mjs
```

The [runner](../../../apps/desktop/test/run-resource-reservation-db.mjs) owns one
temporary Unix-socket-only PostgreSQL cluster, requires 1.5 GiB free before it
starts, applies the real migration chain, then explicitly applies the pending
DDL. It does not add107 to the application's schema migration registry. It runs
the existing continuation, managed-launch and managed-stop SQL regressions before
the [resource tests](../../../apps/desktop/test/resource-reservation-db.test.mjs)
and removes its cluster in `finally`. `FABRIC_PG_BIN` selects local PostgreSQL
binaries; no database URL supplied by the operator is used by the runner.

Verified on 2026-10-13 with Node26.10.0 and local PostgreSQL17: the command exits0.
Coverage includes shared cross-Estate concurrency, child contention and own-slot
charging, safe integers, incomplete/stale/future readings, disk refusal,
idempotent response recovery, changed retry inputs, before-spawn refusal,
explicit never-begun cancellation, exact release, equivalent numeric fence
spellings across retry/cancel/compensated release, forged journal/lease expiry,
real projection replay and restore, and attempted writes from denied roles.
The restore fixture remaps synthetic entity IDs to avoid collisions and calls
the real journal restore projector; it is not a private-archive/UI acceptance.
A transaction-local negative control replaces the real capacity checker with
an always-eligible function: an otherwise refused request is admitted, proving
the capacity assertion detects its removal; rollback restores the function.

The independent review found that accepted JSON fence `1.0` was stored with
its scale while release/cancel compared canonical caller text `1`. Admission now
normalizes only validated integer fences before storage. One bounded rerun of
the command above passed the new raw-JSON retry/cancel/compensated-release
regression and all existing SQL suites, exit 0; the owned cluster was removed.
This correction leaves the DDL pending and does not activate an installed pool.

The first run reached the negative control after all preceding cases passed,
then failed because its replacement SQL omitted the existing function parameter
names. That fixture defect was corrected; it was not a product failure.

## Promotion and next task

`supabase/pending-migrations/` is **not** read by application migration tools.
Positions104–106 belong to existing work; the filename107 is a proposal, not a
claim that it has been applied. Activating107 before the reserved older filenames
would make later fresh-install and upgrade order diverge. Preserve their ordering
or agree a new ordered allocation with their owner before promotion. Do not
renumber another workstream or use `--include-all` as a substitute.

At promotion: recheck the then-current admission/Stop function bodies, move the
reviewed DDL into the active chain in its accepted order, append its digest to
the migration ledger, update the schema admission contract and archive/readers
as required by that schema change, and rerun fresh/upgrade, privilege and focused
resource fixtures. R3's opt-in caller integration must require the installed
capability and refuse a missing migration. R4 owns broader recovery, native
termination proof and durable wakeups. Portable consumers remain subject to
fabric-agent-contract owner acceptance. No operator approval is invented for
the independently executable local work.

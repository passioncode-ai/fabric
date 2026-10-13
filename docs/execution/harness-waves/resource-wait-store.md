# Pending durable resource wait store

Status: **IMPLEMENTED; OWNED-CLUSTER DATABASE FIXTURE PASS; NOT ACTIVE**.
N-019 provides the storage producer for the [R5 kernel](resource-wait-queue.md).
Pending108 follows pending107 and preserves reserved105–106; neither this document
nor the fixture applies migrations to the application's database.

## Server contract

[`20261013000108_resource_wait_queue.sql`](../../../supabase/pending-migrations/20261013000108_resource_wait_queue.sql)
defines operational `resource_wait_scopes` and `resource_wait_rows`, service-only
configure/insert/read/page/CAS RPCs and private validation helpers. Direct table
access is denied even to service_role; anon/authenticated have neither tables nor
RPC execution. No journal replay reconstructs dispatch ownership.

An explicit configured total-row cap includes terminal tombstones. Each scope is
one estate/host/pool and receives monotonically increasing safe-integer ordinals.
Insert retries return the exact existing immutable input, even when terminal;
changed input, reused session/attempt or another active wait for the task refuses.
Records are never silently removed to free capacity.

The initial producer accepts only a task with **no historical task_runs**, in its
actual estate/project, status backlog/open, and no pre-existing session binding.
Its UUID session must not have task-run, reservation, admission, terminal-open,
terminal-close or enrollment evidence. A reservation using the supplied attempt
also refuses. This is deliberately narrower than general historical-task retries.
A cancelled never-admitted task can use a fresh session/attempt after its previous
wait becomes terminal; existing identity tombstones remain immutable.

Lock order is Estate (same4242 lock as admission), global session (same6061),
attempt6108, queue scope, then row/task. A transaction never acquires another
estate or explicit resource pool FOR UPDATE lock; foreign keys retain their
normal PostgreSQL key-share locking. Claim/begin use the **database clock** for due,
claim expiry and task deadline checks, not caller timestamps. Begin repeats
never-started checks and rejects any older active row. Pages include claimed,
dispatch_started and unknown heads; there is no SKIP LOCKED bypass.

CAS checks exact revision+1, immutable input/ordinal, safe timestamps, claim shape
and the transition graph. Terminal/unknown rows cannot become waiting. Active
claims cannot be taken over; only expired pre-effect claims can be reclaimed.
`dispatched` requires a matching active task run. `refused_before_start` requires
never-admitted evidence or an exact ended failed_known run with its compensation
operational run_launch_compensations receipt bound to ended_seq and no held resource reservation. None of these transitions stops
or frees a process. Cancellation cannot overwrite begun or unknown work.

Queue session/attempt uniqueness is enforced **within this store**. Pending107
admission does not consult these queue rows or take attempt6108; a different
session may enter a bypassing R2 path with the same attempt string later. The
shared session lock protects same-session admission/insert races; universal
cross-ledger attempt uniqueness and all-path scheduling remain R3 composition
work. Input/scope digests are immutable bindings, not server-computed proof of
current task content, grants or machine capacity. The injected currentness and
managed admission gates remain mandatory.

## Client boundary

[`createResourceWaitStore`](../../../apps/desktop/src/main/resourceWaitStore.ts)
implements the kernel's port against the RPCs and binds every call to one scope.
RPC errors, missing receipts, wrong scope/id, malformed page envelope and nonboolean
CAS replies throw safe errors rather than becoming an empty/successful queue.
The kernel validates full returned record shapes and immutable identity before
acting. Queue configuration is intentionally outside this adapter; use one
long-lived kernel instance for its retained operation/backpressure bound.

## Verification

The proposed fixture is
[`resource-wait-store-db.test.mjs`](../../../apps/desktop/test/resource-wait-store-db.test.mjs).
Root's existing `run-resource-reservation-db.mjs` applies pending107 then108
explicitly on its owned Unix-socket-only PostgreSQL cluster and runs the fixture.
Two fixture corrections were required before acceptance. The initial capacity
race reused `attempt-12`/`attempt-14` from the preceding recovery fixture;
production SQL correctly refused those reserved attempts. New fixture attempts
now have a distinct namespace, and an explicit cross-ledger reuse case remains.
The compensation case then called `fail_task_launch(false)` before actual managed
`begin_task_run_launch`. Queue `dispatch_started` is not managed launch permission.
The fixture now verifies `process_evidence` refusal before begin, performs the
actual begin command, and compares forged journal evidence with genuine
operational compensation. Production SQL/client validation was unchanged.

After these corrections, on 2026-10-13:

```sh
node apps/desktop/test/run-resource-reservation-db.mjs
```

Exit **0** on one disposable Unix-socket-only PostgreSQL cluster. All six fixture
stages passed: continuation dispatch, managed launch, managed stop, R2 reservations,
R4 recovery and pending108 wait storage. The N-019 fixture covers configured capacity
and concurrent insert/CAS, scoped FIFO, immutable identity, prior native-session
exclusion, unknown-effect retention, genuine versus forged compensation, production
client+kernel recreation, committed begin with a lost RPC reply and zero redispatch,
and actual anon/authenticated RPC/table denial plus service-role direct-write denial.
This is a builder execution receipt; independent review is recorded separately.
No active migration manifest, app composition,
cycle, board, timer or native process is changed here.

## Next integration

After independent review and owned-cluster acceptance, root integrates source,
graph/CI/docs and reserves actual activation separately. R4 stop proof is still
required to reclaim running resources. Queue cleanup/retention, explicit queue
configuration, production currentness, restart reconciliation of unknown effects
and native all-path acceptance remain separate work. R5 is not complete.

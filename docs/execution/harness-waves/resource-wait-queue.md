# Internal resource wait queue preparation

Status: **R5 PREPARATION; NOT WIRED; NO PRODUCTION DURABILITY**. This module is
an internal dependency-injected kernel, not a second launcher or a portable
protocol. The owning requirement is [R5](resource-implementation.md#r5--durable-waits-deduplicated-wakes-and-fairness).

## Contract

[`createResourceWaitQueue`](../../../apps/desktop/src/main/resourceWaitQueue.ts)
provides enqueue, one bounded pass and cancellation. Only never-started managed
work is admitted through an independent `neverStarted` callback. Input binds the
estate/host/pool, task, session, attempt, owner fence, input/scope digests, condition,
resume point, declared demand, idempotency id and deadline. Snapshots are copied
and frozen. No API releases a process or resource reservation.

The **trusted store port** must implement linearizable insert/read/CAS and an
oldest-active-row page within one scope. Insert deduplicates exact input, rejects
changed identity, enforces queue capacity, allocates a unique strictly increasing
safe-integer ordinal and atomically verifies never-started eligibility. It must
retain identity tombstones, forbid conflicting session/attempt reuse, and never
silently evict uncertain rows. CAS atomically enforces expected revision,
revision+1 and immutable input/ordinal. Each page contains at most the requested
limit (explicit 1–100); an older blocked/unknown row must never be omitted.
There is **no implementation of this store** in this change. The in-memory fixture
is not evidence of any SQL constraint, permission or disk durability.

A pass considers only the oldest active head. A claim may be reclaimed after its
expiry only before `dispatch_started`. Readiness, ownership and authority are
rechecked; changed evidence invalidates the row, unknown evidence defers it.
A revision-fenced begin is persisted before calling the injected dispatcher.
The dispatcher must re-enter existing managed admission with the exact identity,
consume/obey the single-use permit at its effect boundary and preserve its own
final currentness checks. Reporting a start without that permit becomes unknown.
The kernel does not itself call managed admission, a provider or a native process.

Cancellation can win against waiting/claimed work. Once begin won, cancellation
reports the existing state and does not assert termination. Lost begin or dispatch
replies preserve `dispatch_started`/`outcome_unknown`, which normal passes never
reclaim. Restart reconciliation requires a separate trusted producer. Confirmed
pre-start refusal is terminal **for that attempt**, because reusing the resource
adapter's cached attempt cannot establish fresh eligibility. A new attempt needs
an independently verified no-effect outcome; it is not minted by a polling loop.

## Fairness and cost

The explicit policy is strict FIFO per estate/host/pool, with head-of-line
blocking. Small jobs cannot bypass an older resource-blocked job. This deliberately
sacrifices throughput and can block unrelated work behind uncertain evidence.
One pass reads one bounded page and advances at most one row. Continued polling,
bounded earlier arrivals/holds, eventual resolution of earlier conditions,
sufficient finite pool capacity and **all relevant admissions obeying this
queue/policy** are required for eventual admission. Tests of this ordering do not
establish estate-wide fairness while other launch paths bypass the queue.

Clock readings are trusted epoch milliseconds for persisted deadlines. A reading
before the stored update is refused. Expiry never grants approval. Claim duration,
page size and dependency timeout are explicit constructor bounds; there is no
background polling timer, default policy or worker created by construction.

One factory instance permits at most one top-level operation. A dependency timeout
revokes that operation and its permit immediately, but retains its busy slot until
all underlying dependency promises actually settle. Repeated enqueue/pass/cancel
calls return `busy` without starting more dependencies. Nested permit reads share
the same operation token. A late or retained permit cannot start another read.
The worst in-flight port fanout is a dispatcher plus its one nested permit read;
there is no per-retry accumulation. A dependency that never settles keeps this
instance busy indefinitely. This is backpressure, not proof it was cancelled.
Production composition must reuse the instance, not construct one per retry;
there is no machine-wide limit across independently constructed instances.

## Verification

`node --experimental-strip-types --test apps/desktop/test/resource-wait-queue.test.mjs`
executes the production kernel with a fake clock and shared in-memory CAS fixture.
The initial candidate passed 21 tests, including restart/concurrent-worker races,
changed authority at the final boundary, cancellation before/after begin, lost
begin/settlement replies, malformed pages and inputs, and strict FIFO.
Three executable negative controls remove final authority checking, the unknown
replay fence and FIFO selection; each selected behavioral test exits 1 on the
mutant. The original control runner inherited Node's test-child marker and did
not execute the child test; clearing that marker fixed the harness before the
accepted control run. Temporary mutant files are removed after the check.

**Rejected candidate and correction:** initial commit `e5f8e290` bounded response
time only. The four regression tests selected by `--test-name-pattern
"ten repeated|late nested|nested permit dependency|retained permit"` all failed
against that implementation (exit 1), then all passed after retaining operation
ownership and revoking late permits (exit 0). The corrected complete suite passes
25 tests, including the three mechanism-removal controls. The initial mutation
control marker issue above is a harness correction, not a production defect.

The retained-slot tests repeat each entry point ten times after timeout and check
one outstanding dependency, then settle it and verify that a fresh operation can
proceed. The nested-permit tests also assert no new store read after timeout.
They use unresolved promises and fake time, not real network cancellation.

## Remaining integration

A real durable queue migration/store, atomic ownership and replay tests,
R2/pending107 activation, R3 production composition/currentness and exact receipt
hydration remain required. R4 proof is required before reclaiming live resources;
it is not a prerequisite to queuing never-started work. Queue reconciliation,
producer permissions, cycle/quit composition, background cadence, native acceptance
and external callback compatibility are NOT_RUN. Existing board cancellation or
board upkeep does not satisfy those requirements.

Retros applied: R-006 requires the executable negative controls; R-007 requires
this explicit fake-store boundary; R-003 reserves real database-role probes for
the future SQL producer. Root owns the shared plan, CI wiring, map and handoff.

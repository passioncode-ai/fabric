# Retained pool registry storage (N034 slice A)

## Contract

`apps/desktop/src/main/resourcePoolRegistry.ts` is a real-filesystem storage substrate.
The generic API does not produce observed worker inventory, retire a unit, or authorize
execution. N035 adds a private controlled-origin extension consumed by the
[concrete factory](resource-controlled-pool.md#contract), which connects declaration-first N031 registration. **Every registry result has
`complete: false` and `executionAuthorized: false`.** An observed result proves only
this storage operation under the stated cooperative filesystem assumptions.

The factory takes one trusted fixed `PoolRegistryConfig`: canonical existing
`installationRoot`, installation `hostId`, logical `poolId`, owning `estateId`, and
explicit `maxUnits`, `maxRecordBytes`, `maxRegistryBytes`, `timeoutMs`. No capacity
or pool policy defaults are chosen. The trusted existing stop-host identity object
is captured; its installation ID is independently checked against the actual
`stop-host/installation-id` file. Object and invocation substitution refuse.

The derived location hashes a domain plus host and pool. Estate, invocation and
policy do not select another directory. The immutable binding fixes the estate;
changing that estate cannot create a parallel empty ledger for the same pool.

## Durable format and operations

- `provision()` is an explicit first-provision operation. It commits an immutable
  installation-level `resource-pool-bindings/<key>.json` anchor **before** creating
  `resource-pools/<key>/genesis.json` and the initial sealed `head.json`. The anchor
  binds registry UUID, host, pool, estate and genesis hash outside the ledger.
  Existing anchors are never overwritten or adopted by provision. Partial provision
  is unknown and may require a separately designed recovery procedure.
- `acquire()` requires the existing anchor/genesis/head. It exclusively creates
  `writer.lock`, retains its inode and exact bytes, and publishes an
  unsealed head bound to a fresh writer epoch before returning an opaque handle.
  The creation descriptor closes explicitly; the retained file owns lifetime exclusion. Later operations re-open bounded no-follow handles and check the original inode and bytes. No PID, age, TTL or empty-directory heuristic steals a writer. Existing locks
  and an unsealed head with a missing lock both refuse. An ambiguous acquisition
  retains its lock; automatic crash recovery is intentionally absent.
- `append(handle, declaration)` adds an immutable `unit.retained` record with a
  sequence and predecessor hash, then atomically renames a synced head and syncs
  the parent directory. The head binds registry/genesis, host/pool/estate, sequence,
  retained declaration count, final hash, writer epoch and sealed status. Each
  declaration has a unique UUID, originating invocation, full-policy binding
  revision, intent-record digest and coverage digest. These are **trusted storage
  declarations**, not independently verified N031 facts or proof that a process exists.
- `snapshot(handle)` validates the whole bounded chain and returns immutable
  historical declarations. It counts all retained declarations, including those
  from old invocations and policies. It has no caller-exclusion or retirement API.
- `seal(handle)` synchronously stops admission of new operations, drains the actual
  pending operation, validates the registry, commits a sealed head for the exact
  writer epoch, and removes only its inode-checked writer lock. File and directory
  barriers precede acknowledgement. A new instance can then acquire and retain
  the historical chain. Timeout, unfinished append or corruption leaves uncertainty;
  late dependency completion cannot initiate fresh seal work.

Exact append retry under the same writer uses the same declaration identity and canonical bytes. Anchor, head and records must match their canonical bytes; `headSha256` hashes the actual validated head bytes. Seal acknowledgement is cached only for the exact original opaque handle. A
retained pending operation alone may reconcile its one event/head publication;
other appends and snapshots refuse while it is unresolved. Already committed
exact retries re-sync both event and head plus directories before acknowledgement.
A fully written file whose fsync failed can be retried; a partial/conflicting file
is not blindly repaired or adopted. A scratch head left by interrupted acquire or
seal likewise remains conservative uncertainty, not a permission to reset.

## Bounds and trust

The single long-lived instance admits at most one outstanding ordinary operation.
A caller deadline returns unknown but retains occupancy until every actually
started dependency settles. Seal has one cached drain operation, not an unbounded
queue of requests. Optional trusted `beforeIO`/`afterIO` hooks permit fault injection
around real filesystem operations; they cannot substitute file contents or facts.

Directory enumeration stops at the configured maximum plus fixed metadata overhead.
Reads allocate at most `maxRecordBytes + 1`, use no-follow/nonblocking descriptors,
and reject nonregular files, multiple links, invalid UTF-8, size/identity changes,
unknown keys/versions, unexpected files, missing records, duplicate units and broken
chains. Record count and cumulative record bytes have independent finite bounds.
This bounds module allocation and returned scans, not arbitrary filesystem/kernel
latency. Timeout bounds caller waiting, not an uncancellable system call.

The installation root must already be canonical and trusted. Path and inode checks
are sampled currentness checks; they are not atomic filesystem snapshots or hostile
administrator protection. The separate anchor detects ledger removal while the
anchor remains. Deletion or rollback of both ledger and external anchor is not
detectable without an external durable authority, even if stop-host identity remains.
Changing process privileges, network filesystems and adversarial concurrent path
replacement are not certified by these tests. No raw filesystem errors enter the
result union.

## Controlled composition and remaining activation

N034's original storage-only acceptance remains in its source-bound archive. N035
adds `describe` and a factory-private `admitEpoch` path: an inert module readback
recognizes an opaque construction capability; caller-authored markers cannot select it.
Controlled genesis cannot adopt a generic ledger. Each canonical immutable epoch
contains full validated policy and exact coverage bytes, referenced from the head;
retained declarations bind that epoch. `maxEpochs` separately bounds historical growth.
Failed epoch publication stays unknown; no automatic repair or downgrade is added.

The actual N031 writer now optionally appends its canonical retained declaration
before its supplementary intent event. The actual N035 factory alone owns that writer
and projects complete conservative coverage for its controlled creation domain.
Registry API results remain incomplete. Orphan declarations stay charged. This is
not proof that a process exists or that the whole host is controlled. See the
[factory contract](resource-controlled-pool.md#durable-domain) for root trust,
permanent poison, ticket checks and clean-handoff restrictions.
No live configuration, `index.ts` wiring, SQL migration or installed behavior changes.

The eventual accounting contract must also resolve **own-intent double charging**:
registering an intent before reservation, counting all retained intents, then adding
new R1 demand with N027's no-overlap credit can refuse even the first capacity-one
launch. Held reservations plus observed declarations can also conservatively count
the same logical unit twice. N034 does not solve this by excluding a supplied attempt
ID. Any credit requires actual source-bound phase/ticket evidence and a reviewed
accounting contract. Every unretired declaration remains stored and counted here.

## Validation

Focused real-filesystem checks live in
`apps/desktop/test/resource-pool-registry.test.mjs` and run with:

```sh
node --experimental-strip-types --test apps/desktop/test/resource-pool-registry.test.mjs
```

They exercise provision and restart, exact retry, missing ledger/records, conflicting
writers, inode replacement, historical retention, finite counts, faulted fsync and
head publication, unresolved I/O occupancy, and seal drain behavior. Test transport
hooks inject faults around actual filesystem operations; no native agent, provider,
DB, retirement, complete coverage or whole-harness acceptance is claimed.

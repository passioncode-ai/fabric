# Internal resource pool publisher

## Contract

N025 implements the local producer-to-pending107 seam. It does not activate the
pending migration, configure a running host, wire admission, grant ownership or
start a sampler loop. Every result carries `executionAuthorized: false`.

`createResourcePoolPublisher` in
[`resourcePoolPublisher.ts`](../../../apps/desktop/src/main/resourcePoolPublisher.ts)
accepts a trusted raw policy, an independently supplied host identifier, the
trusted sampler dependencies, a Supabase client and an explicit deadline. It
validates and freezes the policy through
[`resourceHostPolicy.ts`](../../../apps/desktop/src/main/resourceHostPolicy.ts)
and owns its
[`resourceHostSampler.ts`](../../../apps/desktop/src/main/resourceHostSampler.ts).
There is no caller-observation parameter and no capacity default.

Use one long-lived publisher for one fixed policy and pool. `configure()` creates
an absent pool or reads an exactly matching policy. Changing an existing policy
requires an explicit `{ revision, generation }` expectation, with the exact prior
stored binding revision. The producer never
refreshes that expectation automatically. A configuration result confirms only
policy readback; it does not certify an observation or readiness.

`publish()` reads the exact configured policy and generation, invokes the owned
sampler, validates its complete source-bound observation, reads the same policy
and generation again, checks the current host/boot identity, then calls
`observe_resource_pool`. Memory and disk units are bytes; CPU is milli-cores;
workers are complete-inventory slots. Configured memory/disk/CPU ceilings must
not exceed sampled physical totals. No overcommit allowance is assumed. Missing
worker inventory and other unknown measurements never become zero.

The publisher sends the captured generation to the pending107/N024 RPC and
requires exact readback of the stored host, pool, revision, generation, capacity, maximum
age, observed vector and timestamp. A1 → B2 → A3 cannot attach generation3 to an
A1 sample or confirm an uncertain generation1 write. PostgreSQL numeric-offset timestamps are converted to the exact epoch after
local calendar validation. Supported offsets range from -14:00 to +14:00;
invalid offsets and unknown -00:00 refuse. Sub-millisecond nonzero digits are
refused rather than truncated into a false match. Policy maximum age is measured against epoch milliseconds; I/O
expiration uses monotonic time. Sampler elapsed time remains distinct.

## Uncertainty and bounded work

A write intent is retained before dispatch. Transport rejection, malformed
responses and a lost reply yield structured uncertainty without connection
errors or host paths. Further writes refuse until `reconcile()` reads the exact
intended generation and, for observations, the exact vector and timestamp.
A superseded or absent result remains unresolved; it does not trigger another
write or sampling attempt. Exact committed but stale/restarted-host observation
readback clears the confirmed intent and returns refusal, permitting a later
explicit fresh publication.

All public operations share one retained outstanding-I/O slot. A deadline bounds
caller wait, not the dependency's lifetime. The slot remains occupied until the
actual promise settles. Late completion cannot issue a follow-up read, sample or
write; reconciliation is explicit. This is per publisher instance, not a global
lock or cancellation guarantee. The nested sampler has its own retained slot;
if it times out internally, it can return unknown while retaining that sampling
I/O. Later publication attempts can perform serialized SQL reads but cannot
start another sampling dependency until the retained sampler work settles. The
bound is per component, not one global outstanding dependency across both. Ordinary accidentally asynchronous native-Promise
clock values are rejected and their rejection is consumed. Arbitrary thenable
accessors are not invoked.

## Concrete database seam

The RPC-only adapter calls `read_resource_pool({ p_host, p_pool })`. This dedicated
service-only server read must validate both identifiers and return exactly the
eight documented fields or null. Pools are kernel data shared across Estates, so
there is no fabricated Estate predicate, generic table fallback or scope-map
allowlist. The ordinary scoped store must continue to refuse this unknown table. It calls `configure_resource_pool` with explicit
expected revision/generation and `observe_resource_pool` with the captured
configuration generation. The service role is supplied by trusted composition;
this module does not discover or acquire credentials.

Its pending contract is
[`20261013000107_resource_reservations.sql`](../../../supabase/pending-migrations/20261013000107_resource_reservations.sql).
SELECT/RPC authorization and transactional behavior belong to that SQL contract.
The exposed `bindingRevision` is `policy-sha256-v1:<sha256>` over JSON of the
complete canonical, validated, frozen N022 policy. The validator establishes
field/vector/profile order and normalizes the disk path. The versioned prefix
identifies this canonical schema; changing that schema requires a new binding
version. The digest includes the human revision, host/pool, every capacity and
demand profile, disk path/device, maximum age, sampling window and timeout.
SQL `policy_revision` stores this binding revision. Readback and both writes use
it; no field subset stands in for full policy identity. A changed full policy
therefore requires explicit previous binding/generation CAS. An old publisher
cannot silently reconfigure or publish against the replacement.

`policy.localPolicyRevision` remains the original human revision for N022 worker
inventory and source evidence. It is not interchangeable with `bindingRevision`.
Future composition must pass the stored binding revision to R1/R2 checks that
compare against the SQL pool revision, while preserving the original label in
sampler evidence. This module does not wire that translation into admission or
claim a server-wide restriction on other service-role callers of the generic
pending107 RPC. Existing rows with human revisions require explicit CAS; they
are not silently adopted as complete-policy bindings.

Publisher fixture success does not establish real database behavior. The
publisher neither reads nor fabricates reservation/overlap vectors. An observed
usage vector and configured ceiling alone are insufficient for R1 admission or
R2 reservation.

## Verification and remaining boundaries

Focused production-module tests:

```sh
node --experimental-strip-types --test apps/desktop/test/resource-pool-publisher.test.mjs
```

The candidate fixture run passed 54 tests (exit0). It covers successful complete
publication, policy-only confirmation, explicit CAS expectations, lost committed
write replies, generation ABA, exact shape/vector/timestamp readback, physical
ceilings, missing inventory, changed host identity, stale committed observations,
shared outstanding work and malformed/failed RPC responses. It also covers
rejected/fulfilled native-Promise clocks and a hostile thenable getter. Tests use
the actual sampler with injected host measurements and a Supabase RPC-shaped fixture. Five new
full-policy binding negatives fail against the preserved original candidate and
pass after correction. The independent two-disk counterexample was also replayed
against that original candidate (exit1). Explicit binding CAS and canonical-order
controls pass on the correction.

Five controlled mutations of production source each make their selected test
fail (exit1): removing intended-generation comparison, physical-memory ceiling,
observation readback, outstanding slot, or clock-rejection consumption. These are
source-bound negative controls for a new module, not a historical regression.
The builder receipt preserves each command, hash and output.

Actual publisher-to-PostgreSQL integration, native runtime wiring, production
service-role configuration, full worker inventory, timer/watcher scheduling,
process restart persistence of uncertain intents, and admission acceptance remain
**NOT_RUN / not implemented in this module**. A new publisher can explicitly
adopt a read-back exact policy after restart; it cannot reconstruct a previous
instance's unresolved observation intent. Composition must retain uncertainty
outside this in-memory instance before claiming restart-safe publication.

Actual owned SQL first exposed a UTC-only parser assumption: PostgreSQL returned
the committed observation with `+02:00`, and the publication remained unknown.
The corrected parser accepts the same exact millisecond instant with a supported
numeric offset while retaining calendar, offset and precision checks. Four new
positive offset cases fail against the preserved UTC-only source and pass after
correction; the UTC control already passed. Invalid calendar/offset/precision
and different-millisecond cases remain unconfirmed. SQL rerun is recorded by the
separate database fixture receipt, not inferred from these focused checks.

The combined scope gate rejected the original generic table read. The correction
uses a dedicated host/pool read RPC rather than weakening that gate. The RPC-only
positive fixture fails against the old generic-read candidate and passes after
correction. Missing/denied RPCs and foreign host/pool returned rows cause no write.
The unchanged scope and operations checkers pass on a temporary overlay of the
combined source with this correction. Real SQL read permissions and exact server
projection are verified separately with the pending migration and owned database
fixture; client tests alone do not prove that server ACL.

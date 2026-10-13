# Resource attempt observations — bounded local R6 preparation

This implements a local subset of [R6](resource-implementation.md#r6-resource-measurements-and-evidence-bound-feedback).
The production functions are `createResourceAttemptObservation`,
`summarizeResourceObservations`, `compareResourceObservations` in
[`resourceAttemptObservation.ts`](../../../apps/desktop/src/main/resourceAttemptObservation.ts),
and optional instrumentation in the existing
[`createResourceLaunchAdapter`](../../../apps/desktop/src/main/resourceLaunchAdapter.ts).
It adds no scheduler, portable event, SQL migration, external lesson store or
automatic policy promotion. Application composition in `index.ts` remains outside
this packet; the resource adapter itself is still opt-in preparation, as described
by the [launch adapter contract](resource-launch-adapter.md).

## Contract

The optional `observations` dependency supplies a synchronous local sink and an
optional monotonic `now` function. Its default clock is `performance.now()`.
The adapter emits at its actual admission, currentness, cancellation and
compensated-release boundaries. It does not insert an asynchronous wait or change
the authority result. A thrown diagnostic clock/sink cannot grant or deny work.
An accidentally rejected ordinary native Promise sink or clock result is consumed; exotic
Promise subclasses or constructor overrides are outside the synchronous trusted
dependency contract. No arbitrary thenable getter is inspected. The sink must also
be bounded and non-reentrant: synchronous diagnostic code can consume CPU or
perform side effects, so this is not a timing-neutral sandbox for an untrusted
observer. No claim of runtime latency neutrality follows from exception isolation.

Admission timing starts when a validated, new session enters the adapter and ends
when its outcome is known locally. It includes preflight and RPC latency. It is
**not queue delay**, SQL reservation duration, process runtime, throughput or
provider cost. Invalid input and adapter-capacity refusals before creation of a
tracked entry are outside this attempt corpus. Same-session idempotent callers
share one admission observation. Late RPC results after a timeout do not rewrite
the unknown observation into success.

Each observation has fixed phase, outcome and reason enums, a hashed
Estate/task/session identity, optional hashed policy/snapshot tuples, requested
and reserved vectors, and a duration or `null`. Raw actor/owner names, task
instructions, paths, transport errors, arbitrary SQL reasons and credentials are
not accepted fields. Policy and snapshot digests bind their host and pool too.
The `reserved` vector is the allocation from the last confirmed admission receipt,
**not current pool use**; its presence on a release observation does not mean the
allocation is still held. Requested demand remains unknown when preflight did not
yield a validated eligible request. No actual observation of physical resource
use is inferred from demand or allocation.

The collector stores at most the explicit `maxRecords` bound (1–10,000). Identity,
phase and condition deduplicate repeated observations, retaining the first
sample; duplicates are counted separately and never become corroboration. Changed
request/allocation/policy/snapshot evidence within the same condition is invalid,
not a duplicate; only the repeat's elapsed duration may differ. A
contradictory second admission outcome for one attempt is invalid. A full store
rejects additional records and reports dropped observations; it never silently
evicts history. Invalid and dropped counts make the export incomplete. These
counts describe collector inputs, not a complete process lifetime: data produced
before attachment, after a restart or while an external sink is unavailable is
not known by this in-memory collector.

`export()` returns a detached, bounded JSON-compatible snapshot. The strict
reducer revalidates it, including accessor-free record arrays, exact field sets,
safe resource integers and duplicate/conflicting admission evidence. Unknown
timing remains unknown; a measured zero remains zero. Summaries expose known and
unknown timing sample counts. Queue delay, physical peak usage, energy saved and
lessons helped explicitly remain `null`.

## Comparison and feedback boundary

`compareResourceObservations` requires a declared mode (`synthetic` or
`observed`) and SHA-256 digests for task set, acceptance scope, environment,
policy and source. Different task/acceptance/environment manifests, incomplete
corpora, unknown admission outcomes/timing, policy mismatches or different
admission outcome counts refuse comparison. Policy and source may differ; that
is what a bounded before/after exercise needs to describe.

These manifests are caller-supplied evidence bindings, not a proof that tasks or
environments are equivalent. A passing comparison returns a descriptive mean
admission-latency difference, `helped: not_established`, `energySaved: null` and
`policyPromotion: false`. It never concludes causal improvement. Aggregated
outcome counts cannot establish per-task counterfactual equivalence, and runtime
usage reduction needs actual resource measurements. No policy can be adopted by
putting a lesson or confidence score into a receipt: extra fields are refused.

The [parent feedback contract](admission-feedback.md#feedback-at-dispatch-and-completion)
continues to distinguish found, applied and helped. This module does not retrieve
lessons or write adoption records. Observatory owns aggregation/lesson quality;
task-pipeline owns adoption in its work; fabric-agent-contract owns portable
schemas. Existing local occurrence grouping in
[`memoryContract.ts`](../../../apps/desktop/src/shared/memoryContract.ts)
remains independent; the collector is not a second memory store.

## Verification and durable export

Focused command from the repository root:

```sh
node --experimental-strip-types --test apps/desktop/test/resource-attempt-observation.test.mjs
node --experimental-strip-types --test apps/desktop/test/resource-launch-adapter.test.mjs
```

Local focused verification on 2026-10-13: the new suite passed 17 tests and the
existing adapter suite passed 43 tests, both exit 0. A strict TypeScript check of
the two changed production modules and their imported types exited 0. These are
focused results; the integrator owns the final tree's full gate.

The new tests drive the production adapter with fake RPC, currentness and clocks,
then run the production collector/reducer. They cover confirmed outcomes,
timeouts, refused/unknown distinctions, repeats, bounded overflow, invalid
quantities, conflicting evidence, getters, unsupported secret/lesson fields,
diagnostic failures and comparison constraints. The test named
`bounded synthetic export records before/after actual adapter observations without savings claims`
can persist its JSON artifact at an explicitly supplied owned path:

```sh
FABRIC_RESOURCE_OBSERVATION_EXPORT=/absolute/owned/path/synthetic.json \
  node --experimental-strip-types --test apps/desktop/test/resource-attempt-observation.test.mjs
```

The file includes exact production source SHA-256 values, both input manifests,
both corpora, comparison output and limits; the test caps it at 32 KiB. Its 10 ms
and 6 ms admission inputs are injected values, not an observed speedup. Persist
that artifact in the owning report's `raw/` directory with the command/exit and
candidate receipt when integrating. A rotating operations log alone is not this
durable corpus: [`ops.ts`](../../../apps/desktop/src/main/ops.ts) deliberately
caps its disposable JSONL and reports known write loss.

Negative controls replaced the adapter with exact base `a3ad1cb5` source and,
separately, removed the actual collector's same-condition deduplication/conflict
block. Both exited 1 on the corresponding observation/dedup assertions; the
second control failed three tests. The original import URLs were preserved, so
the tests still called the production module with normal dependency resolution. A test that only
constructs a record cannot prove the adapter emits one (retro rules R-006/R-007).
This focused acceptance does not establish native/Windows/provider performance,
active migration107, installed runtime enforcement or measured energy savings.

## Next integration seams

The local observation path is executable without COM, native agents or external
stores. Actual queue delay needs R5's authoritative enqueue/dispatch timestamps;
reservation duration needs an authoritative same-clock ledger interval; physical
peaks need a host measurement source. Joining those later must preserve missing
values and attribution instead of substituting adapter timing. Durable production
export and process-restart continuity require an owning composition and retention
policy. Lesson selection/adoption receipts require the lesson owner's revision,
applicability and adoption evidence; none is manufactured by this packet.

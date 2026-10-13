# CO-282 — proposed resource admission implementation packets

**PROPOSAL — not operator approval, implemented scheduling or runtime acceptance.**
This is an implementation decomposition of the [admission and feedback
specification](admission-feedback.md), under the [harness waves
plan](../../evidence/plans/2026-10-13-harness-waves.md). It does not change task
status. R1–R6 below are local packet labels, not allocated register IDs.

Source inspection is pinned to Fabric commit
`4808f83b7538a0ed4bc24d8da3cac3e2eafefd2b` on 2026-10-13. Source links below
resolve at that commit; they describe that snapshot, not an installed application.
All proposed acceptance cases are **NOT_RUN**. This decomposition used read-only
source inspection; it did not run scheduler tests, native processes, providers,
database migrations or a broad suite.

## Existing mechanisms and their limits

| Existing source | Implemented boundary at the pinned commit | Consequence for this proposal |
|---|---|---|
| [`createUnattendedAdmission`][quota] | Consumes a quota reading for an unattended launch, synchronously within one process; its header explicitly disclaims durability and a second-process guarantee. | Preserve the quota gate. It is not a CPU, memory, disk or worker reservation. |
| [`index.ts` composition][composition] | One unattended admission instance is supplied to routine and chain execution. | Reuse the common composition point, without treating existing shared quota consumption as a shared resource pool. |
| [`ownedBackendProcessRegistry` limits][backend-limits], [`start`][backend-start] | A local owned-backend registry refuses capacity beyond its `active: 8` bound, with other history/owner checks. | This cap does not establish a common bound for PTYs, reviewers or test processes. |
| [`admitExistingTask`][admit], [`createManagedLaunch`][launch] | Durable `admit_task_launch` admission, guarded launch generation, validation before spawn, process binding and failure compensation. | Extend the existing authority/attempt path; do not introduce a competing launch coordinator. |
| [`chain.dispatch` intent][chain] | Intent is journalled before spawn and names the admitted run; projected work includes an immutable node revision. | Reuse this dispatch identity and recovery seam. |
| [`createManagedStop`][stop], [`runLifecycle.reconcile`][reconcile] | Stop distinguishes observation from requests/signals; reconciliation reports unobserved runs without declaring them ended. | Preserve uncertainty when reconciling capacity. |
| [`fabric_work_claim` readback][claims] | Claim ownership is read back from the journal projection after writing. | A task claim is not a resource reservation. Declared touched paths do not by themselves prove exclusive file locking. |
| [`runCyclePasses`][cycle], [`tickBoard`][board-tick], [`index.ts` board call][board-call] | Cycle passes run sequentially with isolated failure handling; board upkeep performs maintenance and explicitly starts no agent work. | A durable condition-to-dispatch watcher executor is new work in these seams, not an already established board capability. |

## Proposed design decisions and owner boundaries

These are recommendations for the owning implementation review, **not settled
ADRs or approvals**:

1. Fabric owns one resource admission authority for managed work. Builders,
   reviewers and tests consume the same configured pool. Task-pipeline supplies
   eligible nodes, immutable input identities and evidence requirements; it does
   not acquire an independent scheduler or pool.
2. Keep task eligibility, mutable-scope ownership, authority, quota, resource
   capacity and process observation distinct. Admission combines their current
   receipts. A resource reservation grants neither spend nor a file lease.
3. Bind resource accounting to durable attempts and fences. Admission must be
   atomic at the selected host/pool scope. In-memory accounting alone cannot be
   advertised as cross-process or restart-safe enforcement.
4. Requested, reserved and observed usage are different values. An absent or
   stale reading remains unknown; required unknown readings refuse admission
   rather than becoming zero usage. Resource readings are policy inputs, not a
   promise that the OS will never exceed an estimate.
5. Releasing execution capacity while waiting requires evidence that the
   corresponding worker is no longer consuming that capacity. Merely marking a
   still-running session as waiting does not reclaim its memory or process slot.
6. Portable reservation, fence, cancellation, receipt and event schemas consumed
   outside Fabric belong first to **fabric-agent-contract**. Fabric may develop
   injected local interfaces, but must not publish a competing protocol from its
   consumer code. Protocol acceptance requires the owner's reviewed schema,
   pinned consumer integration and compatibility tests. Owner routing remains
   as described in [owner packets](owner-packets.md).

The initial pool scope, capacity defaults, reading freshness thresholds, fair
queue policy and external protocol revision remain design decisions to settle
in R1/R2 review. Session limits in the parent specification are not machine-wide
defaults. No new repository, public protocol name or migration filename is
allocated by this document.

<a id="r1-resource-demand-and-decision-contract"></a>
## R1 — Resource demand and decision contract

**Owner:** Fabric admission module; fabric-agent-contract owns any portable wire
shape. **Depends on:** the parent specification and explicit choice of pool/host
scope. **Proposed state:** not implemented here.

**Touches:** `apps/desktop/src/shared/admission.ts`,
`apps/desktop/src/shared/unattendedAdmission.ts`,
`apps/desktop/src/main/managedLaunch.ts` (types), and the parent specification.
The existing [admission receipt][receipt] and [launch dependency interface][launch-types]
are the starting points, not an authorization to overload quota semantics.

Define resource demand, role, input closure, reservation identity, attempt/fence,
reading freshness and nested-child accounting. Specify how mutable-scope
exclusion is independently evidenced; do not infer it from `touches` metadata.
Define explicit refusal/unknown outcomes and keep requested/reserved/observed
values separate.

**Acceptance — NOT_RUN:** extend
`apps/desktop/src/shared/admission.test.ts` with builder/reviewer demands accepted
by the same model. Negative cases: malformed demand, unsupported resource class,
missing or stale required readings, incompatible protocol revision and an
ownership assertion without its required evidence are refused. Tests must call
the production decision code, not duplicate its logic in fixtures.

**Exit/integration:** reviewed local contract and owner packet for portable
fields. No runtime enforcement claim; no foreign contract edits from this packet.

## R2 — Atomic shared reservation

**Owner:** Fabric database/admission module. **Depends on:** R1.

**Touches:** `apps/desktop/src/main/admitExisting.ts`,
`apps/desktop/src/main/managedLaunch.ts`; a **new migration** adjoining the
existing `supabase/migrations/20260909000044_admit_task_launch.sql` and
`supabase/migrations/20260927000061_managed_task_launch.sql` mechanisms. Those
historical migration files are reference seams, not proposed rewrite targets.
Allocate the new filename through the repository's normal process.

Atomically attach capacity reservation to the durable admitted attempt and its
fence, within the chosen host/pool scope. Repeated admission of the same attempt
must recover its existing receipt. Define child reservation charging so a child
cannot create a second unmetered pool. Retain unknown outcomes for ambiguous
database responses, consistent with the [current receipt contract][receipt].

**Acceptance — NOT_RUN:** extend
`apps/desktop/test/managed-launch-db.test.mjs`. Positive: independent builder and
reviewer reservations fit in the common pool. Negative: simultaneous admissions
cannot oversubscribe; repeat requests do not reserve twice; nested children
cannot evade the bound; insufficient disk reserve refuses before spawn; a lost
database response cannot cause blind retry with a fresh attempt.

**Exit/integration:** isolated database fixture proves atomicity and durable
receipt recovery. It does not prove native/provider enforcement. The portable
receipt remains subject to the fabric-agent-contract boundary above.

## R3 — Enforce resource admission on managed entry paths

**Owner:** Fabric launcher and runner adapters. **Depends on:** R2.

**Touches:** `apps/desktop/src/main/index.ts` ([composition][managed-composition]),
`managedLaunch.ts`, `routineTick.ts`, `chainAdvance.ts`, `backendLaunch.ts`,
`pty.ts` and `ownedBackendProcessRegistry.ts` in that same directory.

Validate the common resource receipt immediately before owned spawn, preserving
authority and quota gates. Inventory operator, routine, chain, answer and backend
paths against actual call sites. Unsupported autonomous paths must explicitly
refuse rather than silently bypass admission. The backend's existing local cap
is an additional bound until a reviewed change reconciles it with the common
pool; this packet does not simply raise or remove it.

**Acceptance — NOT_RUN:** extend `apps/desktop/test/managed-launch.test.mjs`,
`routine-tick.test.mjs`, `chain-launch-failure.test.mjs` and
`owned-backend-process-registry.test.mjs`. Positive: reviewer A overlaps
independent builder B when their combined demand fits. Negative: no managed
entry path bypasses the pool; changed input closure, stale fence or failed
preparation prevents spawn and produces correct reservation compensation;
unsupported host capability refuses. Record each covered adapter separately.

**Exit/integration:** path-by-path enforcement evidence. Mocked adapter tests do
not establish all-host native acceptance. Serialize edits to `managedLaunch.ts`
with R2/R4 even when independent tests are prepared in parallel.

## R4 — Release and crash reconciliation

**Owner:** Fabric run lifecycle and owned-process modules. **Depends on:** R2;
may proceed beside R3 with exclusive file ownership.

**Touches:** `apps/desktop/src/main/managedStop.ts`, `runLifecycle.ts`,
`workRelease.ts`, `ownedBackendProcessRegistry.ts`, `managedLaunch.ts`.

Release exactly once after confirmed never-spawned compensation or adequate
observation that owned resources ended. Preserve the existing distinction
between [provider cancellation acceptance, signals and quiescence][stop].
Missing local sessions are [unobserved, not automatically ended][reconcile].
Task-claim release is a separate event from process/capacity release. Reconcile
expired reservations against owned process/session identity; never terminate a
foreign process merely to balance accounting.

**Acceptance — NOT_RUN:** extend `apps/desktop/test/managed-stop.test.mjs`,
`run-lifecycle.test.mjs` and `work-release-session.test.mjs`. Positive: confirmed
owned completion or never-spawned compensation releases its reservation once.
Negative: cancellation request, claim release, timeout, lost handle or signal
alone cannot free a running reservation; duplicate completion cannot release
another attempt's capacity; an expired worker cannot publish current completion;
crash recovery leaves unresolved resources visible and fenced.

**Exit/integration:** deterministic lifecycle tests plus explicit unobserved
states. Native process/provider stop acceptance remains separate. Portable stop
or fence changes require fabric-agent-contract ownership.

## R5 — Durable waits, deduplicated wakes and fairness

**Owner:** Fabric dispatch/cycle module. **Depends on:** R2 and R4; consumes R3's
enforced dispatch path.

**Touches:** `apps/desktop/src/main/chainAdvance.ts`, `continuationDelivery.ts`,
`index.ts`, `boardService.ts`, and `apps/desktop/src/shared/cyclePort.ts`.
A new durable watcher/queue domain and migration are required; names are to be
allocated during implementation, not represented as existing files here.

Reuse [run-bound dispatch intent][chain] and [failure-isolated cycle passes][cycle]
for durable condition-to-dispatch work. Record owner, condition, deadline,
next-check, authorized action, cancellation, idempotency key and resume point.
On wake recheck current inputs, ownership and authority. Board [request
cancellation][board-cancel] must not be mistaken for process termination.
Implement bounded polling or supported event wakes, backpressure and the
reviewed fairness policy without starting a competing skill-side scheduler.

**Acceptance — NOT_RUN:** extend
`apps/desktop/test/continuation-exactly-once.test.mjs`, `chain.test.mjs`,
`board-service.test.mjs` and `apps/desktop/src/shared/cyclePort.test.ts`.
Positive: an eligible authorized wake dispatches once; an aged expensive task
eventually enters under stated finite-capacity assumptions. Negative: duplicate
wake, restart, cancellation and timeout do not duplicate effects; uncertain
external effects are reconciled before retry; changed inputs invalidate wake;
silence never grants approval; a stream of cheap work cannot indefinitely starve
eligible expensive work. A waiting live process still consumes its resources.

**Exit/integration:** fake-clock tests execute real queue decisions. Runtime
watcher enforcement and external callback compatibility need their own receipts;
existing board upkeep is not acceptance of this new executor.

## R6 — Resource measurements and evidence-bound feedback

**Owner:** Fabric observation/dispatch modules; Observatory owns measurement
aggregation and lesson quality, task-pipeline owns lesson adoption in its work.
**Depends on:** R1 for definitions; runtime wiring follows R2–R5.

**Touches:** `apps/desktop/src/main/runtimeObserver.ts`, `index.ts`, `opsSink.ts`,
`apps/desktop/src/shared/cyclePort.ts` and `opsLog.ts`.

Extend [runtime observations][observer] and [cycle receipts][cycle-receipt] with
attributable queue delay, reservation duration, refusal/reconciliation reason,
and requested/reserved/observed resource values. Preserve condition deduplication.
Record applicable lesson revision, selection/rejection and the actual decision
changed by adoption. The parent specification owns the distinction between
found, applied and helped; retrieval counts cannot stand in for outcome gain.

**Acceptance — NOT_RUN:** extend
`apps/desktop/test/runtime-observer.test.mjs` and
`apps/desktop/src/shared/cyclePort.test.ts`. Positive: a fixed synthetic task
produces attributable metrics and identifies the decision an adopted lesson
changed. Negative: repeated observations do not become independent evidence;
missing observations stay unknown; foreign notes cannot replace current policy;
retrieval alone cannot mark a lesson helped; secret material is excluded from
portable receipts. Pure fixtures do not demonstrate real resource savings.

**Exit/integration:** compatible event receipts for the owning consumers, then a
bounded before/after measurement on equivalent tasks. Any portable event schema
change follows fabric-agent-contract; this packet does not duplicate Observatory's
lesson store or infer its implementation from this Fabric source snapshot.

## Bounded rollout and asynchronous verification

Recommended dependency order: **R1 → R2 → {R3, R4, R6} → R5**; R6's final wiring
waits for the features it observes. R3/R4/R6 share some integration files, so
parallel preparation is conditional on exclusive ownership and a designated
integrator. Shared-file edits are not made concurrently merely because packet
dependencies permit parallel work.

Begin with deterministic decision and database tests using injected clocks and
resource readings. Reproduce each negative control against missing enforcement
before repairing it. Start independent review when each bounded module is ready;
seam tests wait only for their producers. Keep a single configured expensive
check slot during this run, as the parent specification declares, rather than
launching a full suite for every packet.

Roll out first to an explicitly configured owned host/pool and supported managed
paths. Reconcile active attempts before changing policy or reverting enforcement;
rollback must not erase reservations or orphan running work. Compare equivalent
tasks for queue delay, throughput, peak use, review cost and repeated failures.
Unknown observations, uncovered paths and native/provider tests not run stay
visible in the receipt. Do not claim machine-wide, all-agent or protocol runtime
acceptance until the required paths enforce the contract or explicitly refuse.

## Source references

[quota]: https://github.com/passioncode-ai/fabric/blob/4808f83b7538a0ed4bc24d8da3cac3e2eafefd2b/apps/desktop/src/shared/unattendedAdmission.ts#L19-L75
[composition]: https://github.com/passioncode-ai/fabric/blob/4808f83b7538a0ed4bc24d8da3cac3e2eafefd2b/apps/desktop/src/main/index.ts#L2442-L2487
[backend-limits]: https://github.com/passioncode-ai/fabric/blob/4808f83b7538a0ed4bc24d8da3cac3e2eafefd2b/apps/desktop/src/main/ownedBackendProcessRegistry.ts#L39
[backend-start]: https://github.com/passioncode-ai/fabric/blob/4808f83b7538a0ed4bc24d8da3cac3e2eafefd2b/apps/desktop/src/main/ownedBackendProcessRegistry.ts#L186-L195
[admit]: https://github.com/passioncode-ai/fabric/blob/4808f83b7538a0ed4bc24d8da3cac3e2eafefd2b/apps/desktop/src/main/admitExisting.ts#L32-L43
[launch]: https://github.com/passioncode-ai/fabric/blob/4808f83b7538a0ed4bc24d8da3cac3e2eafefd2b/apps/desktop/src/main/managedLaunch.ts#L57-L103
[chain]: https://github.com/passioncode-ai/fabric/blob/4808f83b7538a0ed4bc24d8da3cac3e2eafefd2b/apps/desktop/src/main/chainAdvance.ts#L420-L461
[stop]: https://github.com/passioncode-ai/fabric/blob/4808f83b7538a0ed4bc24d8da3cac3e2eafefd2b/apps/desktop/src/main/managedStop.ts#L108-L151
[reconcile]: https://github.com/passioncode-ai/fabric/blob/4808f83b7538a0ed4bc24d8da3cac3e2eafefd2b/apps/desktop/src/main/runLifecycle.ts#L155-L163
[claims]: https://github.com/passioncode-ai/fabric/blob/4808f83b7538a0ed4bc24d8da3cac3e2eafefd2b/apps/desktop/src/main/workTools.ts#L397-L420
[cycle]: https://github.com/passioncode-ai/fabric/blob/4808f83b7538a0ed4bc24d8da3cac3e2eafefd2b/apps/desktop/src/shared/cyclePort.ts#L174-L231
[board-tick]: https://github.com/passioncode-ai/fabric/blob/4808f83b7538a0ed4bc24d8da3cac3e2eafefd2b/apps/desktop/src/main/boardService.ts#L365-L380
[board-call]: https://github.com/passioncode-ai/fabric/blob/4808f83b7538a0ed4bc24d8da3cac3e2eafefd2b/apps/desktop/src/main/index.ts#L2538-L2540
[receipt]: https://github.com/passioncode-ai/fabric/blob/4808f83b7538a0ed4bc24d8da3cac3e2eafefd2b/apps/desktop/src/shared/admission.ts#L22-L60
[launch-types]: https://github.com/passioncode-ai/fabric/blob/4808f83b7538a0ed4bc24d8da3cac3e2eafefd2b/apps/desktop/src/main/managedLaunch.ts#L15-L35
[managed-composition]: https://github.com/passioncode-ai/fabric/blob/4808f83b7538a0ed4bc24d8da3cac3e2eafefd2b/apps/desktop/src/main/index.ts#L3148
[board-cancel]: https://github.com/passioncode-ai/fabric/blob/4808f83b7538a0ed4bc24d8da3cac3e2eafefd2b/apps/desktop/src/main/boardService.ts#L280-L288
[observer]: https://github.com/passioncode-ai/fabric/blob/4808f83b7538a0ed4bc24d8da3cac3e2eafefd2b/apps/desktop/src/main/runtimeObserver.ts#L212-L234
[cycle-receipt]: https://github.com/passioncode-ai/fabric/blob/4808f83b7538a0ed4bc24d8da3cac3e2eafefd2b/apps/desktop/src/main/index.ts#L2542-L2557


## Implementation continuation — local R1/R2

The operator-authorized continuation starts R1 as N-012 and R2 as N-013 in the living graph.
The detailed proposal above remains the historical design, not an assertion of implementation.
[ADR-0152](../../adr/0152-resource-preflight-and-durable-reservation-are-distinct.md) settles
only the local preflight/durable-authority distinction and pending-migration boundary.
N-012 uses a separate internal `resourceAdmission.ts`, preserving the existing DB receipt.
N-013 starts from migration62's current stop/compensation-protected functions; the older44/61
links above are historical seams, not sufficient function bodies to copy.

Migration107 stays outside the active migration directory until reserved104–106 ordering
resolves. Isolated fixture application may verify its source without activating the schema
or changing the supported range. Portable owner acceptance and native enforcement remain open.
Board unavailability does not block these local-only implementations.

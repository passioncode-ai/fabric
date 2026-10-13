# Prepared managed worker units

## Contract

This is opt-in source preparation for ADR-0154. It binds a newly admitted ordinary resource-required managed launch to one durable logical unit and an opaque, actually spawned PTY object. It always reports `complete:false` and `executionAuthorized:false`. There is no provider-retirement operation, complete worker inventory, installed migration, pool configuration or active resource enforcement in this change.

`createResourceManagedUnit` in `apps/desktop/src/main/resourceManagedUnit.ts` composes the actual N028 assignment manager, N031 intent store, resource admission adapter and `PtyManager`. `createManagedLaunch` consumes it; `index.ts` forwards the optional owned-unit handle into the existing `ptys.open` call. Main still does not construct or install a required resource adapter/unit manager. The actual consumer wiring can be exercised with injected SQL/native boundaries without activating a policy.

### Identity and storage

The trusted constructor accepts an explicit full host policy and finite entry/I/O bounds. `readResourceHostPolicy` validates and freezes that policy against the supplied host identity. Its complete canonical digest derives the SQL `policy-sha256-v1:` revision. The human revision remains a separate N031 field. A task cannot supply a purported digest or substitute an arbitrary counts callback.

Preparation allocates an actual N028 handle for the exact prepared task/session, registers its intent and independently reads both back. The mapping's `r-*` run id is never used as SQL `task_run_id`. Only a returned observed preparation confirms the assignment for admission; in-flight or failed preparations expose no handle, including after late settlement. The retained entry holds exact prepared/assignment/intent objects and captures collaborator/method references; substitutions refuse. Assignment and worker records do not establish R1 held ownership or complete input closure.

The resource adapter's `readBinding(receipt,prepared)` returns its existing frozen entry only for the original owned receipt object and original still-owned prepared packet. A copied receipt with identical values is insufficient. The unit attaches the actual reservation/attempt/fence/input/scope/policy binding to the same N028 attempt, SQL run ordinal and prepared content digest. The full input digest remains distinct from the raw content digest. `ownDemand.workerSlots` must equal one; a larger total demand envelope remains conservative reservation accounting and is not reported as multiple live units.

N031 `admission.attached` and `process.attached` records are immutable parent-digest chains with exact-retry durability barriers. Their writer validates storage/provenance, not SQL or native authority. This adapter supplies admission fields from the actual private resource entry and process fields from `PtyManager`'s held object. A lost attachment reply blocks begin, retains evidence and uses only the existing SQL cancellation path; it cannot invent retirement. Native capability, currentness and observation remain unavailable until attachAdmission has returned true after its final deadline/binding check. A late internal allocation stays private; exact same-receipt reconciliation can confirm it without minting another token.

### Existing launch sequence

The required managed path refuses missing/mismatched units, chain, a supplied admission and instruction override before new admission. Legacy calls without resources preserve their ordinary behavior.

1. Compile prepared input once; allocate/read assignment and durably register intent before resource admission.
2. Admit through the existing resource adapter; persist/read its exact admission attachment before `begin_task_run_launch`.
3. Obtain a preallocated opaque native-unit handle. The existing PTY path resolves its executable asynchronously, then invokes the final guard: resource refresh, unit provenance/attachment refresh, prepared-content refresh, final SQL validation.
4. Preserve the existing no-await interval between the final guard and synchronous native spawn. No storage write is inserted in that interval.
5. As soon as the spawned `LiveSession` is established, bind the handle synchronously to that exact object. Capture the actual process group using the existing `processBoundary`; setup failures retain the process/session and intent.
6. Before task bind/dispatch, independently observe the owned handle and persist/read its process attachment. Unavailable capture or attachment produces the existing process-started unknown failure path and stop request; it never compensates as a no-process failure.

These external refreshes establish sampled currentness, not atomic validation across every await. They do not establish R1 held ownership or complete input authority.

`PtyManager.observeOwnedUnit` checks the private WeakMap and current map object before and after process observation. A copied handle, recycled session entry or changed process reference cannot redirect it. The actual POSIX observer checks PID/group/start and keeps escaped-descendant uncertainty. A process identity cannot be reconstructed from a journalled PID after restart.

### Retention, unknown results and bounds

A caller deadline ends waiting, not I/O. Every retained unit shares one operation slot across methods; maxEntries bounds the number of such slots. Late settlement frees the slot but cannot start a subsequent read/write from the expired operation. Initial preparation outcome is cached even when unknown, so retrying the same packet cannot allocate another assignment or replay spawn. Durable records and entries have no expiry-based cleanup.

Tree quiescence is explicitly separate from provider quiescence. The result can say `processState:'quiescent'` and `providerQuiescent:null`; that does not retire the unit or release a reservation. Root exit, signal acknowledgement, missing in-memory process, restart, changed boot, raw journal claims and local callbacks provide no retirement operation. Darwin/Linux owned-group observations remain subject to the existing cooperative process-boundary limitations; Windows or unreadable captures stay unknown.

A future complete conservative inventory could count every unretired controlled intent, including possibly alive/uncertain units, exactly once under proven exclusive launch coverage. Provider uncertainty would block retirement rather than erase such a unit. This adapter does not implement that coverage protocol and never feeds its known subset to N022 as complete. Foreign/legacy/free terminals and backends are outside this logical pool; physical host CPU, memory and disk readings still include their effects.

## Verification and limits

`apps/desktop/test/resource-worker-launch.test.mjs` exercises actual N028 files and installed pinned identity derivation, actual ScopedStore/context compiler, N031 immutable files, ResourceLaunchAdapter, ManagedLaunch, PtyManager and processBoundary. SQL replies, R1 capacity/ownership and native spawn/process snapshots are synthetic; no provider request or real agent process is made. The fixture skips explicitly if the pinned installed identity script is unavailable, without installing it.

Focused controls cover exact binding, wrong attempt, foreign/copy handles, replaced session object, capture/journal failure after spawn, PID reuse/escaped descendants, retained provider uncertainty, real assignment/native I/O timeout bounds, changed intent coverage during resource refresh, committed attachment with lost reply, absent required dependency, and in-flight/late-failed preparation never reaching resource admission. The adapter suite separately checks exact receipt/packet identity and method replacement. Existing N029 fixtures use labelled coordinator-only unit stand-ins to retain their isolated content assertions; they are not durable/native proof.

Builder and independent receipts record exact source hashes and check counts. Original missing-unit consumer behavior and the rejected unit-before-resource refresh ordering are preserved for negative replay. Root's whole-project gate, actual SQL conformance and future native/provider activation remain separate acceptance requirements.

## N033 child environment correlation

The ordinary required path calls the actual captured N028 `childEnvironment` method with its owned assignment handle. It accepts exactly one plain data key, `AGENT_SYNC_RUN_ID`, carrying the producer's bounded child key. It does not reconstruct the installed agent-sync run-ID algorithm or use the durable `runId` as an environment value.

Admission attachment retains a frozen copy in the opaque PTY token. Unit currentness rereads the actual assignment environment and compares it before prepared-content currentness and the final SQL validation. PTY applies that one-key token patch after inherited, descriptor and bundle environment layers, with no extra await between the final guard and synchronous spawn. Unresourced launches retain their existing environment precedence.

Unknown, rejected, stale or malformed environment reads refuse the required launch. A timed-out read keeps the existing occupied-operation boundary until settlement; late success does not confirm a failed attachment. Copied native tokens cannot inject an environment. The PTY manager is trusted internal infrastructure, not an authentication boundary against arbitrary same-process callers.

This binds a Fabric child process environment to the existing durable assignment; it does not prove that the child used the key, acquired a lease, owns the mutable scope, holds a numeric fence, or completes inventory coverage. Currentness remains sampled across external awaits. No native provider run or activation is claimed.

Evidence: `apps/desktop/test/resource-worker-launch.test.mjs` exercises actual N028 records and actual PTY environment construction with an injected synthetic spawn: conflicting parent/descriptor/bundle values, changed record bytes, extra keys, getters, producer refusal/rejection, timeout with late settlement, copied token refusal, and unchanged legacy precedence. The synthetic spawn checks the final SQL call is immediately before spawn.

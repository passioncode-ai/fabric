# Ordinary controlled worker-slot overlap: bounded source proposal

DESIGN ONLY. Read-only review; no code, SQL, benchmark, tests, provider calls or root writes. Scope: one N035-controlled ordinary root launch with ownDemand.workerSlots = 1. No child, chain or wait-queue dispatch activation. No R1 held authority or full input closure is manufactured.

## Current source phases and obstruction

1. managedLaunch.ts:75–80 prepares an actual N029 packet then N032 unit. N028 mints attemptId itself (resourceRunAssignment.ts:198). N031 controlled registration commits the N034 declaration before its event; uncertain subsequent work never removes the declaration.
2. N035 private inventory reads ALL retained declarations before calling trusted preflight. Intent is already one observed worker. R1 still adds full demand (resourceAdmission.ts:193–221). Its reservedObserved means observed usage already covered by a reservation, not an unreserved intent.
3. N025 publisher validates a physical/logical sample but retains only vector/time/boot/snapshot ID (resourcePoolPublisher.ts:85–105,183–199). Membership identities and registry head relation do not reach SQL.
4. Pending107 resource_pool_problem:137–146 evaluates held roots + observed + extra under the pool lock. admit_resource_task_launch:187–219 preserves exact retry and generation ownership, then inserts the actual reservation. N027 accounting:354–365 separately rejects gross held+observed. Both must use the same revised accounting, not just R1.
5. N032 attaches actual admission and native ticket only afterward. Releasing a reservation never retires the retained declaration. Capacity-one stays occupied after release until a separately proven retirement contract exists.

## Smallest defensible new contract

Worker slots ONLY. Other axes retain the current conservative sums; no inferred memory, CPU or disk overlap. First supported own intent belongs to an ordinary root request; parent requests receive no new own-intent credit. Continue existing nested allocation checks unchanged.

### A. Atomic controlled observation cut

Add a versioned internal service-only observation RPC, not optional caller overlap numbers on the existing RPC. The production caller is N025 composed inside the actual N035 domain, using its private writer and exact identity readback. Tool/task inputs cannot select a sample, membership list, trusted host or producer capability. A service credential is trusted kernel authority already; SQL cannot authenticate a JavaScript WeakMap or independently verify local FS provenance. Actual privileged transport/configuration remains an activation requirement, not a claim derived from a local registry.

One immutable cut binds host/pool, full policy bindingRevision, configurationGeneration, registryId/genesis digest, writer epoch, committed retained sequence/head hash, observationId/content digest, sampledAt, actual observed vector and a bounded unique membership set. Require observed.workerSlots = membership count, complete actual source coverage and no overflow/truncation. Rows include exact unitId, declaration/intent digest, origin epoch/policy, plus actual estate/task/session/attempt identity when established by the factory's real N028/N031 mapping. Historical/orphan rows without that mapping remain members and charged; they get NO credit.

Capture the worker cut during the same actual sampler call, not a second unrelated registry read combined with the old vector. Current N022 sample drops the membership evidence, so preserve a private sample receipt connecting its exact worker read to the vector and N025 write. Factory owns the publisher integration; a generic callback returning complete:true/list is not an implementation of this contract. Publisher lost reply retains exact cut intent and reconciles against server readback of the SAME full content/revision/generation, not merely vector/time. Legacy observe RPC writes must clear overlap membership for that observation; no inheritance of an earlier list.

SQL updates vector + observation membership relation atomically under the existing pool lock. Reject same ID with changed bytes, reused revision with different generation, stale published head/count within the same registry, backwards timestamp and changed identities. Registry identity cannot silently switch with a policy revision. Stable per-unit binding facts persist across successive cuts; do not delete them when publishing a new view. Reusing a historical binding is allowed only for the identical unit/declaration identity already stored, not by matching a string supplied in the new request. If restore loses these facts, keep the units charged without credit.

Cooperative currentness remains bounded by freshness. Do not call an old-but-fresh cut the latest local registry. Before a candidate uses own credit, its exact declaration must be included in the confirmed published cut, and the factory must still own that cut's domain. Uncertain publish/currentness poisons the N035 invocation as today. No fallback to a fabricated empty list.

### B. SQL-derived union accounting, never client subtraction

Let O be the count of all members in the accepted observation, R the sum of held ROOT worker demand, C the number of exact observed units injectively linked to held ordinary ROOT reservations, and I the candidate's exact published unreserved own member (0 or 1).

  effectiveWorkerSlots = R + O - C
  prospectiveWorkerSlots = effectiveWorkerSlots + request.workerSlots - I

An observed unit maps to at most one reservation, and a reservation gets at most one unit credit. Require own_demand.workerSlots = 1 for credited rows and exact same host/pool/registry, estate/task/session/attempt and stored immutable binding. Child reservations never add C; parent envelopes remain charged once through R. Historical units lacking proof remain in O. Bounds C <= O and C <= R are additional assertions, not substitutes for the injective join.

I is distinct from C: it is not reservedObserved. I requires the actual candidate's source-owned declaration/mapping and an exact row in this published cut, no prior reservation/admission for that unit, and no link counted in C. Claim/link it only with actual successful admit+reservation insert, in the same transaction and established lock order. Existing exact reservation retry returns its original identity and does not consume another credit. A released or previously admitted unit never becomes a fresh own-intent credit. Never use max(0, ...) to hide an inconsistent negative result.

Use the same SQL join semantics in the coherent accounting read and final pool capacity check. The read is advisory; final admission recomputes under locks against current observation/generation and authoritative reservation state. A concurrently changed cut/configuration rejects or uses a newly coherently validated cut, never combines old O with new C. Preserve estate → session → reservation → pool ordering and restore/journal/fence protections. Do not add a publication lock path that later acquires estate/session locks and reverses this order.

The server must derive credits from its accepted producer cut and operational reservation facts. Passing unitId/fence/digest in an admission request only selects candidates to compare; it never creates evidence. A caller-supplied credit count or request echoed into a proof response is insufficient.

### C. R1 and reader projection

Extend the versioned accounting result with explicit worker-only C plus candidate-specific I proof bound to the exact request identity, observation ID and configuration generation. Actual coherent reader prepares the immutable proof; R1 validates its source-bound currentness through a trusted checker, using distinct ownIntentAlreadyObserved semantics rather than overloading reservedObserved. Its existing demand.workerSlots >= 1 invariant stays. Other overlap vector components remain zero. R1 may then expose additional worker charge request.workerSlots - I while keeping original demand unchanged. The final SQL check remains authoritative even if the advisory read races.

This requires a narrow resourceLaunchAdapter/factory composition change so external trusted preflight cannot substitute an unrelated context/candidate identity for the actual assignment. It does not implement the missing ownership/fence/full-input producer; those requirements must still succeed independently.

## Pending108 boundary

resource_wait_queue.sql:80–87 never-started proof rejects prior reservations; state CAS/claim expiry/FIFO are independent of capacity. A wait claim is not a unit, observation or credit. Do not alter this state machine for ordinary overlap. N035 currently mints its own attempt/session through actual preparation, whereas a stored queue row already binds those fields. Routing queue dispatch through this factory needs an actual identity-preserving admission handoff; passing the queued attempt as caller data is not that proof. Queue integration remains separately unimplemented, not implicitly certified by this packet. Ambiguous dispatch must remain retained, never reset to waiting or free capacity.

## Acceptance and negative cases

- Empty capacity-one controlled pool: actual declaration-first path publishes one member; I=1, prospective=1. After real admission, same member has C=1,I=0,R=1,O=1. This proves worker-slot accounting only; physical axes and authority can still refuse.
- Two concurrent candidates cannot consume one member, reuse session/attempt, or double-credit one root; capacity-one admits at most one under actual SQL concurrency.
- Exact retry stable; changed demand/fence/input/scope/task/session/estate/pool/declaration or policy generation refuses. Released reservation remains O and cannot become I again.
- Child reservation and parent/root envelope cannot obtain duplicate credit. Unsupported parent own-credit refuses explicitly.
- Orphan/missing historical mapping remains O. Missing cut, truncated list, duplicate IDs, corrupt head relation, restored missing operational rows, unknown producer or publisher lost reply never yields credit or zero.
- Atomic vector/membership replacement under concurrent read/admission; observation ABA, same ID changed bytes, old writer/head with newer timestamp and policy-label reuse fail. Legacy vector-only write cannot retain prior membership credit.
- All existing auth, journal restore, compensate/release, configuration CAS and queued lost-reply/FIFO cases remain green. Use one isolated scheduled SQL cluster; no new live runtime action.

## Scope and sequencing

One bounded implementation packet can define/test the versioned cut + server joins and update N025/N027/R1/adapter/factory integration together. It reuses existing producers, not a new generic scheduling framework. The existing pending107 filename is historical test DDL, not a promised activation number: collision with the owner's migration work remains unresolved. Allocate the future pending migration honestly under the ledger policy; do not assert an available number or enable schema automatically.

Local code and isolated fixture work are executable without COM consent. Production readiness separately needs actual R1 held/fence/full dependency closure, trusted app-root and privileged publisher composition, active migration ordering, measured native path and policy installation. No provider retirement or all-host process completeness claim is included. This removes first-launch worker double charge; it does not create infinite reuse of an unretired capacity-one pool.

## Independent design review and implementation sequence

[The source-bound review](../../reports/2026-10-13-resource-admission-contract/raw/overlap-design-review/packet.md), with [13 input hashes](../../reports/2026-10-13-resource-admission-contract/raw/overlap-design-review/inputs.json), found no arithmetic counterexample under the stated assumptions. It did not execute tests or certify earlier implementation by this contributor. Before credit is implemented:

- Prove retained-set preservation and append ancestry, not only increasing count/head sequence. No retirement exists, so a newer cut cannot omit an old member.
- Use a versioned admission envelope carrying exact generation, cut and unit identity. The current eight-key resource binding cannot carry these fields, and policy-label equality cannot distinguish A1→B2→A3.
- Persist consumed linkage so release or restoration cannot manufacture a fresh own-intent credit. Missing history is not proof of first use.
- Apply identical union semantics to coherent read, first admission and final begin/validate checks. Exact historical receipt recovery does not itself authorize a current spawn.

The smallest independently testable storage slice is service-only immutable cut publication/readback with all overlap credits still zero. It is a prerequisite, not the capacity-one fix. The next slices are atomic reservation linkage/shared SQL accounting, then actual sampler/publisher/R1/factory composition. These remain design proposals under REQ009, without allocated implementation nodes or claimed schema activation. Local source work needs no COM consent; runtime ordering/authority still do. At-most-one admission is safety, not progress: two simultaneous intents can conservatively exhaust a capacity-one pool, and an unretired consumed unit cannot be recycled by release alone.

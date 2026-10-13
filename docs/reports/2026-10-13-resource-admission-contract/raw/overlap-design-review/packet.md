# Own-intent overlap: independent bounded source review

Status: DESIGN_REVIEW_ONLY. No implementation, tests, SQL cluster, native launch or repository writes. Reviewer authored earlier R1/N025/N027/N032/N035 components; this is independent review of the new proposal, not independent acceptance of those prior implementations. Exact input bytes: inputs.json.

## Verdict

The proposed worker-only union is sound under its stated identity and completeness assumptions. No arithmetic counterexample found: effective=R+O-C and prospective=effective+demand-I preserve full root envelopes and retain every unknown unit. Existing conservative behavior is correct fail-closed behavior, not permission to subtract a caller count. The full proposal is a coordinated new internal accounting contract, not a narrow bug fix. It needs operational schema/link history and actual producer/admission integration. It does NOT require COM consent or a new portable contract to author and test pending local source. Activation, full ownership/fence/input closure and native validation remain separate.

## Confirmed current seams

- resourceControlledPool.ts:125-128 reduces actual registry snapshot to worker IDs; its private sampler is constructed here. preflight receives assignment/inventory at93-95, but no real publisher is constructed. A caller-supplied callback cannot be presented as shipped source composition.
- resourceWorkerInventory.ts:256-277 commits declaration before intent and returned handle. Declaration contains intent checksum and origin/policy, not the full task/session identity (resourcePoolRegistry.ts:15-16,39-42). Mapping must come from actual current N028/N031 readback. Historical/orphan declarations remain charged even without that mapping.
- resourceHostSampler.ts:11-17 accepts worker inventory; ResourceHostObservation:26-44 omits membership/registry lineage. resourcePoolPublisher.ts:58-59 and85-105 further retain only vector/time/boot/snapshot. Two unrelated reads cannot certify a single cut.
- resourceAdmission.ts:193-221 subtracts only reservedObserved then adds full request. Unreserved own intent is a distinct proof, never reservedObserved.
- pending107:134-147 computes held roots+observed+extra. admission:187-201 retries before new capacity check,236 reuses pool check for existing launch; begin/validate wrappers depend on it. Changing only new admission leaves final launch blocked.
- pending107:326-365 and resourcePoolAccounting.ts:76-89 independently reject gross reserved+observed. Their exact legacy output shape must not silently change.

## Required design precision before credit implementation

1. **Observation lineage must preserve the set, not only monotonic numbers.** Proposal25 requires stale head/count rejection and stable bindings, but must explicitly reject a later same-registry cut that omits/replaces any previously retained member. With no retirement contract, every known declaration persists. Greater sequence/count alone cannot prove append ancestry. Same sequence with different head also must refuse; epoch transitions may change head metadata legitimately, so bind committed declaration lastDigest/sequence separately from mutable writer/seal head. Retain unknown when exact lineage cannot be established. This is an underspecified validator, not an observed implemented defect.
2. **Generation and cut need an actual versioned admission field.** Current pending107164-168 accepts exactly eight binding keys and has neither configurationGeneration nor observationId. localPolicyRevision alone cannot distinguish policy A1→B2→A3. Adding data to existing JSON will be rejected. A new versioned RPC/envelope must retain expected generation+cut+unit identity in operational state and validate exact retry/first consume explicitly. Do not silently change old positional signatures or weaken their exact checks.
3. **Restoration must not recreate first-use eligibility.** Absence of reservation/link history is not proof of never-admitted. Persist one-time consumed linkage/tombstones independently of released state, and mark restored or missing linkage credit-ineligible. A fresh cut with echoed identical identity must not reconstruct I after history loss. Current journal reserved markers already distinguish lost operational authority; extend this discipline to the new link, rather than interpreting missing rows as unused.
4. **Bind all checks, including begin/validate, to the same semantics.** Versioned coherent read, R1 advisory projection, first admission, and resource_launch_problem must agree. On retry clarify original receipt recovery versus permission to spawn now; an old receipt can remain identifiable while current generation/capacity refuses launch.
5. **Bound cardinality deliberately.** Fixed explicit maxMembers+1 and maxRoots+1, canonical payload-byte budget, immutable row counts, numeric sums and bounded returned materialization. PostgreSQL LIMIT is not a hard physical scan/time bound. Member lists never truncate to apparent completeness. Registry maximum, sampler worker maximum and SQL bound may differ; incompatible limits refuse rather than silently lower O.

## Proposed smallest independently implementable packet

Working label: OWN-CUT-STORE (not an allocated graph ID).

Objective: durable versioned service-only storage/readback of one complete controlled observation cut with immutable retained membership and explicit lineage. It is a reusable server boundary, NOT capacity-one admission acceptance. All overlap credit remains zero; all existing admission/read/launch calculations stay conservative.

Owned files after root allocation: one NEW pending migration with number allocated from the real ledger, one focused real PostgreSQL fixture, one contract doc. Existing runner wiring remains root-owned. If legacy observe/configure must invalidate new current-cut pointers, use narrow reviewed function replacement in the new pending migration while preserving signatures/returns and original validation semantics. Do not edit active migrations or allocate a filename by guessing.

Proposed functions (names provisional): observe_controlled_resource_pool_v1(cut), read_controlled_resource_pool_cut_v1(host,pool,expectedRevision,expectedGeneration,maxMembers). Preserve existing read_resource_pool eight fields and read_resource_pool_accounting output. Service-only execute; no direct client table writes. SQL accepts privileged kernel assertions, not JavaScript capability authentication.

Storage: immutable registry identity; declaration facts keyed by registry+unit with exact checksum/origin; current cut binds policy digest revision+generation, observation ID, exact canonical content digest, timestamp, vector, bounded complete membership, committed declaration sequence/lastDigest, writer/head metadata. Cut and resource_pools vector/time update in one transaction under pool lock. No estate/session lock acquired by publisher. Historical facts survive policy change/legacy observation; only eligibility of the current cut is invalidated. Exact replay does not refresh timestamps or overwrite later cut. Missing operational history refuses credit forever in this slice (which grants none).

Acceptance for this slice, using production SQL, one scheduled isolated cluster:
- ACL negatives for anon/authenticated; malformed/null/duplicate/oversize/overflow/future/stale inputs refuse without partial writes.
- Same ID exact retry stable; changed bytes refuse; no timestamp refresh on retry. Lost reply readback resolves ONLY the exact immutable cut.
- Concurrent vector/cut reads see a coherent pair; snapshot scope is one statement, not promises about future admission.
- Same-registry omitted/replaced prior member refuses; unknown/orphan members retained; same sequence contradictory lineage refuses; legitimate exact epoch handoff explicitly represented.
- Configuration A1→B2→A3 cannot reuse A1 cut; legacy vector-only observe clears current-cut eligibility; invalidation does not erase retained unit facts.
- Capacity-one declaration O=1 remains refused by unchanged ordinary R1/admission when adding demand1. This negative proves no accidental early authority. Existing107/108 suites must stay green when scheduled; not run here.

This slice is not the only possible decomposition; its value is a real durable prerequisite with no new admission authority. Avoid calling its completion a fix to capacity-one.

## Subsequent minimum capacity-one closure

A second server slice atomically injectively links a published candidate to a real successful ordinary-root reservation, computes C/I in shared SQL union logic, preserves tombstones, and updates final launch validation plus versioned coherent reader. A third source-consumer slice preserves actual sampled membership through N022/N025, composes publisher inside N035 from private handles, binds actual assignment before R1, projects trusted C/I proofs, then uses versioned admission. These can be authored in stacked branches once contracts freeze. Actual first declaration→publish→R1→SQL reservation→final SQL→owned spawn tests must use real modules, with synthetic process transport explicitly labelled. No waiter/child/retirement activation.

Capacity-one cannot recycle after release: retained declaration remains O and previously consumed I cannot return. Two candidates published together may conservatively both refuse at capacity1; at-most-one admission is safety, not guaranteed progress/fairness. The scope must not promise the latter.

## Boundaries

Full proposal expands internal accounting authority across schema and several existing modules, but does not require inventing ownership or policy defaults. Local source work is executable now under normal ownership; actual SQL run waits for root resource admission. No COM/foreign owner gate blocks source work. Active migration ordering, privileged production transport, trusted app-root/policy installation, R1 held/fence/full dependency closure and native acceptance remain real activation prerequisites. No broad new migration activation or native/provider action was performed or authorized by this review.

# CO-282 — portable harness waves handoff

Start with [the execution plan](../evidence/plans/2026-10-13-harness-waves.md) and
[the current graph](../execution/harness-waves/graph.json). **CO-282 is partial.**
First-wave repairs and bounded local resource implementations exist; active resource
enforcement, cross-owner acceptance and native acceptance remain open.

## Current source and bounded results

Integration branch: `agent/harness-integrated-20261013` in `passioncode-ai/fabric`;
last fully gated pushed source checkpoint `6c8b3718302dd7a3e981ce792f9c0c13db780b27`;
[full-fast receipt](../reports/2026-10-13-resource-admission-contract/raw/closing/n031-fast.json)
binds tree `3253ccc739b2387da2cf713bdc0746f905f4caac`, exit0,1208.8seconds.
A later source-bound owned PostgreSQL run passed all eight stages in28.86seconds;
[N027 receipt](../reports/2026-10-13-resource-admission-contract/raw/closing/n027-sql.json).
N027 is closed as pending-SQL source acceptance; N030 still tracks combined delivery/publication. Earlier producer
source `f2576c109f1de55179e07c7398aa2c4564e12087` and recovery source
`ae197a1552231a9252754f9ee296736f94269471` is historical.
Merge `cc123baf67753d817282fdd686365051ae897d66` preserves main privacy changes through
`f4e21d18fd5b077291652b0508fde2ba43378b1a`. The producer source has its own verified branch-delivery receipt below; neither
checkpoint is a main merge, product installation or publication receipt.

| Unit | Source and evidence | Acceptance boundary |
|---|---|---|
| N-012 / R1 | Accepted `d984d98358b82824695e0636d8f3e0c50ec6eb82`, integrated as `c5bb122f`; [review receipt](../reports/2026-10-13-resource-admission-contract/raw/r1-review-receipt.json) | Advisory local eligibility only; 106 focused tests and independent arithmetic/binding checks. It cannot reserve capacity or authorize execution. |
| N-013 / R2 | Fixed and independently accepted `0b0ad6a9dd9e14a58762e0fc5aaf982bd5789af1`, integrated as `aba21213`; [reservation implementation and checks](../execution/harness-waves/resource-reservation.md#verification) | Pending SQL tested in an owned isolated database. Numeric fence normalization closes the review finding; the ledger is not active in the installed schema. |
| N-014 / R3 preparation | Fix `ae23efc24e4d83800aeb8b7d26e1074a7fcd2dab`, integrated as `981c5afc`; [adapter contract and checks](../execution/harness-waves/resource-launch-adapter.md) | 44 focused tests pass. Async currentness now precedes final SQL validation; ordinary and pre-admitted negative cases require zero spawns. No production composition or universal entry-path enforcement. |
| N-015 final PTY preparation | `9b83706ed61373c205113dc84518a8c3a371f889` | Independent production-manager regression passes fixed and fails on exact parent source; synthetic spawn only, no native/Windows claim. |

The [resource-wave review](../reports/2026-10-13-resource-admission-contract/README.md)
collects the continuation evidence. [ADR-0152](../adr/0152-resource-preflight-and-durable-reservation-are-distinct.md)
permits local injected code and isolated durable implementation before external board
admission. Source acceptance, active schema, configured policy and native behavior are
separate claims. N-007/N-008 must close against the expanded candidate, not inherit the
first-wave completion. Final graph reconciliation and delivery receipts follow integration.

**Verified recovery checkpoint:** full `bash scripts/ci.sh fast` PASS at
`ae197a1552231a9252754f9ee296736f94269471`, exact tree
`73f62899eceb74f60445f506ac1e950b03709aff`; [receipt](../reports/2026-10-13-resource-admission-contract/raw/recovery-wave-fast.json).
N016 recovery, N017 wait kernel and N018 observations are present there. Subsequent
N019 durable store and N020 adapter timeout correction require their own acceptance.
Main documentation through `7e51da91099c13abbcd2a29a62fae59d2b6bafdb` is preserved
in `d96f62e7`: union219/286 carry-over rows, next CO287.

N020: seven new regressions fail on original source; corrected adapter/observations
pass67 tests and five independent adversarial checks.
[Portable receipt](../reports/2026-10-13-resource-admission-contract/raw/n020/README.md).
N019: actual SQL application succeeded but the first fixture incorrectly reused
R4 attempt IDs; the ledger correctly refused both. Fixture c6f5ce5b namespaces them
and retains an explicit collision-refusal test. The next fixture correction calls actual managed begin before testing compensation and also verifies pre-begin refusal. All six stages of the owned resource SQL runner now pass, exit0; [builder receipt](../reports/2026-10-13-resource-admission-contract/raw/n019/final/receipt.json).

Source review and module tests do not establish active schema, installed runtime,
production composition, all-host behavior or owner adoption.

## Historical first-wave receipts

These immutable receipts remain useful; they do not certify the expanded resource wave.

- `agent/harness-waves-20261013` at `de50e9e0fddf9f5fa37cd063fb3659cdc274bbff`:
  pushed historical source and segmented checks.
- `agent/harness-integrated-tested-20261013` at
  `179e71e94682a8d609c32647473ca09f3130d146`: historical full-fast PASS, tree
  `d41e70d134bc2469c8f324afe3adae8b1cb24a5b`.
  [Receipt](../reports/2026-10-13-harness-wave-review/raw/integrated-fast-receipt.json)
  records exit 0, 53 compiler checks, 25 enrollment, 45 MCP and 35 ACP tests plus the rest
  of fast. Docker/native/provider checks were NOT_RUN; toolchain reproducibility unverified.
- Integration `12ff522b04aafaeaa485a91c5ceb53f04d9e0d18` and subsequent closeout:
  [branch delivery readback](../reports/2026-10-13-harness-wave-review/raw/branch-delivery-receipt.json),
  [affected-input compiler receipt](../reports/2026-10-13-harness-wave-review/raw/final-compiler-receipt.json)
  and [PR 31](https://github.com/passioncode-ai/fabric/pull/31).

The [first-wave review](../reports/2026-10-13-harness-wave-review/README.md) preserves
rejected candidates and negative replay fixtures. Repairs cover enrollment identity and
serialization, whole-context limits, acknowledged ACP mode and required Fabric surface,
and MCP cooldown/late-link cleanup. Its nine locally delivered nodes out of eleven were
a historical scope count, not completion of product requirements.

## Latest board readiness

At09:08UTC the bounded watcher observed the local DB answering HTTP200 and official
`fabric_whoami` returning `waiting` for project-access consent. Recovery happened outside
this run; this run did not restart the stack. [Readback](../reports/2026-10-13-resource-admission-contract/raw/closing/board-readiness-0908.json).
MCP registration was approved, but project consent remains a separate human gate. Owner
packets N009/N010 remain NOT_SENT. The single bounded watcher rechecks every120seconds,
closes each MCP child, and stops after90minutes or ready/denied; it grants nothing itself.

## Latest combined check and owner refresh

The first N032/N033 combined fast run failed after2047.37seconds on the written-never-read ratchet: `Target.taskRunId` and `TaskRun.taskRunId` now have readers and must leave its shrinking baseline. [Unchanged-tree failure receipt](../reports/2026-10-13-resource-admission-contract/raw/closing/n033-first-fast.json), [original log](../reports/2026-10-13-resource-admission-contract/raw/closing/n033-first-fast.log). This is not a full-gate PASS; later stages did not run. Only those two obsolete entries are removed. A fresh combined run remains required.

The [owner refresh](../reports/2026-10-13-resource-admission-contract/raw/owner-refresh-0919/receipt.json) confirms pipeline PR112 merged/source1.94.0; release and inspected installed payloads remain1.93.3. This is source progress, not owner adoption or native consumption. [Publication check reuse](../execution/harness-waves/publication-reuse-packet.md) is a bounded future optimization proposal; current publication gates are preserved.

## Current wave and bounded next architecture

N032 integrates actual immutable intent/admission/process binding; N033 fixes actual
child run-label propagation. N034 implements the bounded pool-history storage slice under independent review, with incomplete/unauthorized outputs; it does not yet attach the concrete controlled factory. Their source acceptance is tracked in the graph and does
not replace complete occupancy or writer authority. The next architecture is captured
in [the controlled-pool packet](../execution/harness-waves/controlled-pool-next-packet.md):
fixed installation/pool identity, exclusive persistent writer, a durable complete event
head, clean handoff and conservative retention across restarts. An unclean crash refuses
instead of stealing an owner. Capacity-one/own-intent double charging needs exact
source-bound overlap semantics; a subset cannot be called zero or complete.

N026/N028 now implement selected snapshots and run correlation. Remaining R1held work
needs actual acquisition provenance and a locally issued serialized generation checked
at the supported effects; no integer can be invented from a Git SHA. Cooperative claims
are not OS filesystem enforcement. Complete dependency closure and activation remain
separate from these implemented bounded primitives. These are local architectural
prerequisites, not falsely blocked by a missing COM message.

## Exact next work and dependencies

1. Verified merged source1b63e81c11e3327c26f930e93656ac7a2b11fcb6 passed fast
   at tree76bc7d64fb93c1b0db5db28bc905b6d5c96c55c5, exit0,707.51s;
   [receipt](../reports/2026-10-13-resource-admission-contract/raw/closing/merged-1b63-fast.json).
   N022–N025 now have scoped source review and seven-stage actual SQL PASS; receipts
   live under raw/n022–n025 in the resource report. Combined producer source `f2576c109f1de55179e07c7398aa2c4564e12087`
   passed full fast at tree `5ac7a0e834fe38e572d56188ac52b8c38616cc58`, exit0,873.64s;
   [receipt](../reports/2026-10-13-resource-admission-contract/raw/closing/producer-f257-fast.json).
   Source is pushed; N022–25 and N007 are closed against that bounded result. Their activation
   boundaries remain explicit; no module result activates the installed runtime.
2. Finish the corrected N032/N033 combined gate, bind its result to the final source, then complete branch delivery and workspace publication. N026/N028 already implement bounded selected snapshots and run correlation; N029 already supplies once-prepared content. Continue local implementation from [the controlled-pool packet](../execution/harness-waves/controlled-pool-next-packet.md). Complete inventory, actual cooperative ownership/fencing and full dependency closure remain separate requirements; ref observations and overlap warnings are not held authority.
3. Before activation, resolve migration ordering with the owners of reserved positions
   105–106 after COM-03 applied104; pending 107 is not active DDL. Recheck current admission/Stop protections,
   migration ledger, schema contract, fresh/upgrade/restore and privilege behavior.
   Configure trusted host/pool policy and a fresh sampler explicitly. Production composition,
   all global launch paths, compiled input-closure binding and native termination/recovery proof still
   need implementation and acceptance. A reservation grants neither spend nor file leases.
4. Historical runtime blocker before the09:08UTC readiness readback: OrbStack stopped again with ENOSPC. One start briefly
   restored healthy Fabric DB, HTTP200 and official MCP project-consent `waiting`.
   The distinct boot at06:07:18UTC ended at06:09:23UTC with storage-full writes;
   [recurrence receipt](../reports/2026-10-13-resource-admission-contract/raw/closing/live-stack-recurrence.json).
   The earlier recovery receipt timestamp records report construction, not probe time.
   No repeated restart or volume reset was attempted. Stable disk headroom and DB
   readiness must come first; then recheck consent through official MCP.
   N009/N010 remain blocked / NOT_SENT. After actual access use official
   `fabric_whoami` → `com.status` → `com.list` → project-addressed `com.submit`.
5. Refresh upstream heads before submitting the
   [owner packets](../execution/harness-waves/owner-packets.md): pipeline provenance and
   idempotency, Observatory lesson contract, hub host routing and MCP profiles. Portable
   protocol publication and cross-owner adoption require their actual owner acceptance.

## Working boundaries

Read the relevant [retro lessons](../evidence/retro.md) before each packet and record which
changed behavior. ADR/grant authority outranks observations; repetition does not promote a
lesson into policy. The [admission/feedback specification](../execution/harness-waves/admission-feedback.md)
and [host matrix](../execution/harness-waves/host-matrix.md) preserve the distinction between
configuration, discovery and observed native consumption.

Keep one heavy-check slot, clean owned fixtures, retain uncertainty and invalidate verdicts
when their inputs change. No live database/provider, service restart or foreign process is
needed for local fixture work. Keep credentials, private machine paths and dependency trees
out of delivery. Hosted CI was not dispatched. Workspace publication is separate and must
follow its owning skill and current source relationship; a pushed branch does not establish
publication, installed behavior or completion of CO-282.


## COM03 wave2 integration and N021

Main ac874946 is retained, including respond-only board tools, grants, runner identity
and UI/docs/model outputs. [N021 receipts](../reports/2026-10-13-resource-admission-contract/raw/n021/README.md)
cover the board-join concurrency correction; both coding identity and separate board cap
survive. The incoming deferred carryover patch is not applied: it proposes another CO282.
The deferred SQL107 also requires order reconciliation before active promotion. Canonical
CO282 stays partial;286 rows/219 open is the validated union, not the future patch counts.


## Producer delivery checkpoint

The source above is pushed and independently read from a clean GitHub-origin checkout:
[receipt](../reports/2026-10-13-resource-admission-contract/raw/closing/producer-fresh-checkout/portable-receipt.json).
24 accepted source hashes and61 relative entry targets resolve. N022–25, N007 and
N008 close only their bounded source/review/delivery contracts:23of25 graph nodes are
complete; N009/N010 retain actual owner acceptance and remain blocked / NOT_SENT.
CO282 stays partial. This checkpoint is not a main merge or product release.
Workspace publication and the report index follow through their owning commands;
`docs/workspace-receipt.json` owns the publication identity, not this narrative.

At that checkpoint, the next local implementation was the [selected-input packet](../execution/harness-waves/input-scope-next-packet.md).
It names source ordering, trusted assignment, exact bytes and negative cases.
Compiler packet/chain instruction and run-to-lease binding must be resolved before
resource-required production composition; these are future composition prerequisites,
not observed failures in ordinary launch behavior. No global writer enforcement or
complete worker inventory is inferred from these primitives.


## Historical selected-input and accounting continuation

This is the earlier continuation snapshot. Current results at the top supersede its pending SQL and integration statuses; original failures and source receipts remain history.

N026 source and focused independent acceptance are recorded in
[the input receipt](../reports/2026-10-13-resource-admission-contract/raw/n026/README.md).
Its initial TypeScript narrowing failure is fixed; combined gate and source delivery
remain open for this continuation. N027 now owns the locally executable coherent
reserved-accounting read. The historical23/25 count above belongs to the producer
checkpoint and is not the expanded graph's completion count.

The [source-specific prerequisite review](../reports/2026-10-13-resource-admission-contract/raw/n026/composition-prerequisite-review.json)
orders further composition: coherent reserved accounting; actual run/lease assignment
and explicit membership; once-prepared context/instruction; one composed managed path.
A new Fabric-owned semantic decision must define cooperative ownership versus enforced
isolation and attempt fencing before assigning a held verdict. Matching N023/N026
observations alone cannot manufacture that authority. These local steps do not require
COM permission; activation and owner acceptance keep their actual prerequisites.

Report index generator preserved all172 previous IDs and produced174. The default
push refused existing52/72 divergence; task-owned generated output is available at
branch `agent/fabric-harness-report-index-20261013`, commit
`099c052b3cd90749176341f04ae83b554802b01b` in `ssheleg/obsidian-memory-vault`.
No foreign history was rewritten and the default wiki index is not claimed updated.

N027 source is integrated with focused independent acceptance and desktop typecheck;
[actual SQL remains separately scheduled](../reports/2026-10-13-resource-admission-contract/raw/n027/README.md).
N028 implementation runs in a temporary overlay on the accepted N026 bytes, per
[the assignment packet](../execution/harness-waves/run-assignment-packet.md). The
expanded graph includes these pending integration/check tasks; no global completion
or installed enforcement is implied.


## Historical N026–N030 checkpoint and worker-entry planning

The following describes an earlier checkpoint, not current next actions. N031 is accepted at6c8b3718; actual N027 SQL subsequently passed. N032/N033 require the corrected combined gate. Latest official COM readback is waiting for project consent, not database-unavailable.

N026 selected input, N027 pool accounting and N028 local run assignment are integrated
for combined verification. N028 source archive is [portable](../reports/2026-10-13-resource-admission-contract/raw/n028/README.md); its root typecheck and27 focused checks passed,
with a subsequently accepted scope-drift correction: sourcee51e8e04 binds the actual
ScopedStore closure object,29 focused checks and6 independent controls pass. N029 once-prepared launch input
is integrated with100 focused and5 independent controls after fixing scope drift,
pending compiler I/O and preserving ordinary compiler fail-fast behavior.
N030 owns the shared CI script; graph/packet audit reports no scope findings.

The corrected combined fast gate passed and its exact source was pushed, with
[remote readback](../reports/2026-10-13-resource-admission-contract/raw/closing/n030-branch-delivery.json).
N026/N028/N029 are closed as bounded source modules. Exact next task: integrate the
independently reviewed N031 durable intent substrate, then the N032 concrete managed
consumer after its independent review. Run current combined checks and ordinary workspace
publication. Actual accounting SQL is still
NOT_RUN for insufficient disk headroom; do not weaken the runner reserve to make it green.
The scheduled publisher's earlier failure was a rejected non-fast-forward parent push
after child deployment; preserve its receipt, never force-push or claim it publishes this
branch. Official Fabric board remains database-unavailable; no owner packet was sent.


The first N030 combined run failed only at its reached release-provenance classifier;
it is not a full-suite pass. Sourcea06566fe makes the already-enforced project repository
explicit to that existing classifier; commands and checker are unchanged.31 focused,
8 independent and the index control pass. [ADR0154](../adr/0154-logical-worker-pools-retain-unresolved-start-intents.md)
and N031/N032 own durable logical worker entry followed by actual launcher binding.
N031 source2ff89b1 has18 focused and4 independent checks after an actual failed-fsync
retry defect was reproduced and corrected. Root integration is underway; its acceptance
does not cover N032's subsequent event extension. N032's reviewed concrete scope is now
under isolated implementation. Both graph rows remain pending until their delivery
receipts; neither supplies complete worker inventory or native resource enforcement.


## Continuation at10:39UTC: failed gate corrected, next source wave

The N032/N033/N034 combined gate failed after2078.94seconds at the observability checker, with unchanged indexed tree3610a84313f47747eaa245084967dae311af217f. [Failure](../reports/2026-10-13-resource-admission-contract/raw/closing/n034-first-fast.json) and [log](../reports/2026-10-13-resource-admission-contract/raw/closing/n034-first-fast.log) preserve the result. Six catch blocks now explain their fail-closed typed refusal or capability withholding; no runtime behavior changed. Focused ops/ratchet/shell checks pass. No subsequent full-gate PASS yet.

N035 composes the actual controlled creation domain, currently under correction and verification. N036 preserves all gates while moving the expensive compiler after source-only refusals and removing six duplicate calls; actual performance savings remain unmeasured. The graph now has36nodes:28done,2blocked,6pending. Native activation, effective capacity-one overlap, all-host entry coverage and owner acceptance remain separate work.

[Observatory readback](../reports/2026-10-13-resource-admission-contract/raw/closing/observatory-readback-1004.json) found service degraded and the last10collector ticks timed out; a current service response does not make historical registry observations fresh. No collector or service was restarted.


## Integrated N035 and resource-pressure continuation

N035 exact9-file candidate is copied with [integration evidence](../reports/2026-10-13-resource-admission-contract/raw/closing/n035-integration.json) and [portable producer/reviewer archive](../reports/2026-10-13-resource-admission-contract/raw/n035/README.md).18focused plus3independent controls/type checks passed; oldfactory replay is expected RED. No active runtime or complete host-coverage claim. The next mandatory action is the combined final source gate, then source commit/push, exact-HEAD focused binding and graph closeout, followed by normal workspace publication.

The standalone old launch fixture rerun was27/29, exit1; no acceptance was inferred. Five ordinary setup budgets now allow5000ms while explicit deadline tests and production config are untouched, statically reviewed. The full test must actually pass. At10:48UTC disk headroom fell below200MiB and one peer shell received ENOSPC. Root removed only its generated isolated-worktree apps/desktop/out (30,429,687bytes); the next gate must rebuild it. No foreign work/process/service was changed. A new heavy gate requires restored disk headroom.


## Corrected legacy fixture verification

The first setup-budget candidate failed28/29 because one1100ms native-delay regression implicitly relied on the old1000ms fixture default. This is a fixture coupling, not a product failure. Both timed cases now declare1000ms explicitly; corrected29/29pass on unchanged integrated N035 source in the [receipt](../reports/2026-10-13-resource-admission-contract/raw/closing/n035-legacy-corrected.json). [Original failed candidate](../reports/2026-10-13-resource-admission-contract/raw/closing/n035-legacy-first.json) remains. Static unchanged-body review had not established semantic timing parity. The resource-waiting full gate was cancelled before execution for this correction and must be rearmed on the new candidate.

The [next overlap proposal](../execution/harness-waves/own-intent-overlap-packet.md) is DESIGN ONLY; no new SQL, capacity credit, runtime activation or retirement has been implemented by that packet.


## Durable source checkpoint before final acceptance

This expanded source iteration is checkpointed on the working branch while the final combined gate remains pending for disk headroom. It is not a completed pipeline stage, main integration, installation, publication or acceptance of N030/N032–N036. N035 focused18, independent3, targeted types, integrated ops and corrected legacy29 pass within their recorded scopes. The cancelled resource wait ran no full gate. Preserve both earlier full-gate failures and every fixture correction. Resume by running the complete fast command on this committed candidate when resources allow; exact committed-HEAD execution avoids borrowing a historical-HEAD result.

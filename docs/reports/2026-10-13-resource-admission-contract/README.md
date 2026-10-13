---
report:
  id: fabric/2026-10-13-resource-admission-contract
  title: "CO-282: local resource admission wave"
  kind: review
  project: fabric
  domains: [architecture]
  as_of: 2026-10-13
  status: active
  valid_until: 2026-10-27
  summary: >-
    Continuation of the harness wave: local resource preflight and pending durable SQL
    reservation are implemented and independently reviewed before project-board access. Source, isolated tests,
    active schema, native enforcement and portable contract acceptance remain distinct.
  sources:
    - name: Resource implementation packets
      path: docs/execution/harness-waves/resource-implementation.md
      read_at: 2026-10-13
    - name: Local resource authority decision
      path: docs/adr/0152-resource-preflight-and-durable-reservation-are-distinct.md
      read_at: 2026-10-13
  produced_by: {agent: codex, task: CO-282}
  supersedes: []
  consumers: [fabric]
---

<sub>ssheleg skills — task-pipeline · agent-sync · agent-stack · evidence-docs · project-reports</sub>

# CO-282 — local resource admission wave

This wave extends the [first repair review](../2026-10-13-harness-wave-review/README.md).
It does not supersede its immutable source receipts. The first review's11-node snapshot
is historical; the living graph includes subsequent tasks.

## Implementation boundary

[ADR-0152](../../adr/0152-resource-preflight-and-durable-reservation-are-distinct.md) records
local design authority. Fabric board access blocks owner requests, not internal injected
functions or isolated SQL implementation. The R1 preflight cannot grant admission. R2 uses
the current migration62 protections and remains pending DDL after COM-03 applied104;105–106 remain reserved.
No live schema, private database, portable contract or native/provider behavior is certified.

## Checks and open work

R1, pending R2 SQL and opt-in adapter preparation have scoped independent acceptance.
Combined fast validation is pending; N-016–N-018 continue local recovery/wait/observation preparation. active runtime enforcement is not claimed.
The [execution graph](../../execution/harness-waves/graph.json) owns task state; the six
resource packets retain negative tests and the distinction between source and activation.


## R1 — reviewed local decision

Source `d984d98358b82824695e0636d8f3e0c50ec6eb82`, integrated byte-identically as
`c5bb122f`:106 production-function tests pass. [Receipt](raw/r1-review-receipt.json)
binds source/tests, commands, original rejected artifacts and accepted replay scripts.
Independent reviewer ran5016 seeded BigInt arithmetic cases plus identity, missing-reading,
nested-accounting and adversarial property checks. Eight extra Promise/thenable cases pass.

The first candidate7797d1fb exposed a trusted-provider error boundary: an accidental async
proof rejection was refused but later emitted an unhandled rejection. The builder identified
it; the reviewer independently reproduced it. The fix observes ordinary native Promise
rejections without invoking arbitrary thenable getters. Exotic Promise subclasses/constructor
overrides remain outside the supported trusted synchronous dependency contract.

All results explicitly deny execution authorization and require reservation. Ownership proof
is independently injected local evidence, not a request boolean or portable authentication.
No capacity ledger, quota, process or live host was mutated by R1. Full combined validation
will follow R2 integration; this scoped receipt does not certify future source changes.


## R2 — reviewed pending reservation authority

The original candidate `2b72bd37626270ee8c7a12378cac11670aaf9122` was rejected
by independent review: numeric fence `1.0` was admitted but a canonical `1` could
not release it. The [rejected receipt](raw/r2-rejected/receipt.json) records why
exit0 from the probe was not acceptance: this case printed a semantic counterexample.

The correction `0b0ad6a9dd9e14a58762e0fc5aaf982bd5789af1`, integrated as
`aba21213`, canonicalizes validated numeric fences before retry comparison/storage.
The [accepted independent receipt](raw/r2-fixed/receipt.json) binds source hashes,
real SQL fixtures and six raw-number cancellation/release controls. Both builder
and reviewer ran separate socket-only disposable PostgreSQL clusters and removed
them. Existing dispatch, managed launch and Stop cases passed with the pending SQL.

Atomic pool admission, exact retry binding, parent/child accounting, role boundaries
and operational release/restore checks have fixture evidence. This is not active
schema, distributed stress, measured savings or native/provider acceptance.
Portable archived scripts use `FABRIC_REVIEW_ROOT=<checkout>`; original local receipt
and artifact digests are retained while private paths are parameterized/redacted.

## N-014 — opt-in R3/R4 adapter preparation

Candidate `29639beb72902a567a1bd69f08f48dcd7ecb20bc` passed42 focused tests but
was rejected by review: SQL authority could become stale during an awaited local
currentness callback, and the coordinator still spawned. The correction
`ae23efc24e4d83800aeb8b7d26e1074a7fcd2dab`, integrated as`981c5afc`, runs that
refresh before the final SQL check. Ordinary and pre-admitted paths now have separate
regressions.44 focused tests pass; root replay of the independent counterexample
confirms zero spawns. [Receipt and replay](raw/r3-review-receipt.json).

Required mode never falls back to legacy admission. Exact resource receipts bind both
launch paths; release hooks retain uncertain ownership. Production composition does
not enable this adapter. Trusted policy/readings/input providers, complete native boundary,
free-terminal/backend coverage and full R4 recovery remain open. The [adapter
contract](../../execution/harness-waves/resource-launch-adapter.md#contract) lists these
limits. Preparing the seam does not complete the full R3/R4 resource packets.

## N-015 — executable preparation before final authority

The production PTY manager awaited executable resolution after its final authority
callback, including an async wrapper on non-Windows hosts. Correction
`9b83706ed61373c205113dc84518a8c3a371f889`, integrated as`79aa9e5b`, completes
that preparation first. The [independent receipt](raw/n015/receipt.json) records the
production-manager test passing fixed and failing with exact parent source while the
test stays unchanged. Root replay of the portable negative loader also fails at the
intended assertion. Spawn itself is synthetic; no native or Windows acceptance is
inferred, and an asynchronous authority lookup is not an atomic remote lock.

## Coordination finding and recovery

Installed agent-sync1.22.1 could report its own expired resource lease as acquired
without updating its remote timestamp. Independent source review confirmed the branch;
the [owner packet](../../execution/harness-waves/owner-packets.md#agent-sync--expired-own-git-lease-reported-as-acquired)
remains NOT_SENT. This run disclosed the false-success interval, reaped only its own
expired refs, then reacquired them. No foreign lease or installed skill was changed.
A foreign reservation-document lease delayed reconciliation without blocking the
independent PTY fix. The bounded watcher acquired it on its20th attempt, then stopped.
Agent-sync reserved ADR-0153 for the unexecuted pipeline reservation; its own collision
rule moved unused0150 after ADR-0152. The targeted `fix-pf-06.03.py` check now passes.
At that point reserved migrations104–106 and all applied ADRs remained unchanged.
The later COM-03 merge applies104 from its owner;105–106 remain reserved.

## Preflight and historical dispatch snapshot

[Preflight receipt](raw/preflight-receipt.json) records passing types/docs before the
last narrow edits and the corrected reservation check. It also preserves a separate
failed command: `node scripts/unified-plan.mjs check` selects the old2026-10-04
research cut when no current pointer exists, and correctly refuses stale source
revisions and uncovered canonical work. That dated snapshot was not rewritten or
used to dispatch this run; the CO-282 task-pipeline graph owns this bounded execution.
The mandatory fast tier independently tests fresh compiler/reconciliation behavior.
No claim is made that the historical research cut is now a current whole-project queue.

## Integration with COM-03

The first expanded fast attempt froze tree`63742182d4e233f650053b3630d32eb76ba36e85`
(now commit`61db9885`) and failed when main advanced to migration104/ledger87.
[Failed receipt](raw/pre-com03-fast-receipt.json). The candidate bytes did not change;
the shared remote-tracking base did. No later gate was inferred green.

Merge`a3ad1cb5` preserves COM-03 code, migration ledger, responder binding and UX
projections from main`3d7e7752`. [Independent seam review](raw/com03-merge-review.json)
records37 enrollment/request tests and source hashes. Pending resource107 stays outside
the active chain;105–106 remain reserved. Full combined acceptance follows below.

The [new owner reconciliation](../../execution/harness-waves/owner-packets.md#latest-skill-hub-release-reconciliation--2026-10-13)
recognizes released hubv1.62.1 catalogue/profile improvements and its bounded native
visibility evidence, retaining Fabric-isolated and unsupported-host gaps. Older owner
packets must not request work that this released source already completes.

## Runtime boundary

The latest official MCP read returned `failed`: the hub cannot check credentials. The
[read-only diagnostic](raw/closing/live-stack-diagnostic.json) found OrbStack stopped after
disk-full I/O errors and the database gateway unreachable. Earlier `waiting`, `starting`
and429 observations are historical; project consent must be rechecked after recovery. Board
requests, acknowledgements, owner acceptance and Observatory lesson delivery are NOT_SENT.
Registration persists from the operator's earlier explicit approval. No sign-in, grant,
service restart, private token, installed Fabric change or live provider call was performed.



## Probe gate correction

The COM-03 candidate tree769ba6c3 failed the probe-format gate because a child-script
template delimiter in the R1 regression was indented. No production code changed:
the delimiter now follows the gate format, check-probes passes, and106 R1 tests pass.
[Rejected combined receipt](raw/com03-fast-rejected.json) preserves exit1 and log digest.
Subsequent checks certify the changed test bytes separately from the prior R1 receipt.


## N-016–N-019 — recovery, waits and measurements

N-016 source5b9af8e5 corrects the initial scanner: timed-out I/O retains its slot
until actual settlement. Root runs37 focused tests and replays the same tests against
fbab9257: two expected failures. [Function receipt](raw/r4/receipt.json). A real
PostgreSQL caller test then exposed RLS-hidden rows under a service role without
BYPASSRLS. Pending107 now explicitly permits service-role SELECT, still denies client
reads and table writes, and indexes the scoped held-row scan. The corrected SQL run
passes; [rejected and corrected receipts](raw/r4/sql-corrected.json) retain the boundary.
Extra privilege assertions from8c5a870 pass in the combined ae197a15 run. Comments-only d71922ba
explain structured uncertainty without logging raw database errors.

N-017's internal wait kernel preserves never-started identities, CAS ownership, FIFO
head selection and the unreplayable begun-effect barrier. Review rejected timeout I/O
accumulation and an accidentally asynchronous clock rejection; candidates57d7f36e
and66bf406a correct them. Independent acceptance at66bf406a passes26 tests, four old-source negative regressions and async-clock/late-permit controls; [receipt](raw/r5/receipt.json), [normalization](raw/r5/normalization.json).
N-019 is the allocated pending108 real SQL/CAS-store producer; until it passes, shared
in-memory fixtures do not establish durable wait persistence. Neither module enables
a production timer or proves fairness across bypassing launch paths.

N-018 was independently reviewed at17aadd81:17 new and43 existing adapter tests pass,
plus1041 independent conflict/allowlist/accessor controls. [Builder receipt](raw/r6/receipt.json),
[independent receipt](raw/r6/independent-receipt.json), and [bounded synthetic data](raw/r6/synthetic.json).
Review fixed conflicting observations counted as duplicates and a rejected async clock.
Root replay on comments-only e42366eb passes the same60 tests and1041 controls.
This exports local diagnostic evidence; unknown timing/usage is not zero, and neither
synthetic deltas nor lesson retrieval prove savings, causal benefit or policy authority.

The temporary deinitialization of the owned workspace for disk reserve caused a separate
compiler prerequisite failure, [recorded here](raw/probe-fixed-prerequisite-rejected.json).
The exact pinned child was restored, then all53 compiler tests passed. No gate was waived.


## Combined recovery checkpoint and adapter correction

Commit `ae197a1552231a9252754f9ee296736f94269471`, tree
`73f62899eceb74f60445f506ac1e950b03709aff`, passed the complete fast tier in615.87s.
[Receipt](raw/recovery-wave-fast.json). This includes real R4 SQL under a non-BYPASSRLS
service role. It does not certify subsequent N019/N020 changes.

N020 independently reproduces the timeout finding in the launch adapter: six sequential
timeouts started six unresolved operations per method. Corrected d4ae7a29 retains one
shared slot per entry across current/cancel/release; independent entries remain parallel.
Seven new tests fail against original source,67 adapter/observation tests pass corrected
source; the separate reviewer adds reentry,100-repeat and cross-entry controls.
[Portable evidence](raw/n020/README.md). Scope remains one reused adapter instance,
not transport cancellation, installed runtime or global scheduling.


## N019 SQL fixture diagnosis and remaining activation

The first combined resource runner applied pending107/108 and passed legacy launch/Stop,
R2 and R4. Its wait-store concurrency assertion then failed because prior R4 fixtures
had already reserved both generic attempt IDs. [Builder diagnosis](raw/n019/receipt.json) and [first root log](raw/n019/fabric-harness-wait-store-db.log) preserve the failure. Actual SQL diagnostics found both inputs
well formed and both identities already reserved. Candidate c6f5ce5b namespaces wait
fixture IDs and explicitly checks that a pre-existing reservation identity still refuses.
A subsequent run returned NOT_RUN before startup at the1.5GiB disk reserve gate.
No capacity assertion or role restriction was weakened. Corrected SQL acceptance remains incomplete and must be recorded separately;
a prepared fixture is not an accepted durable queue.

[Activation prerequisites](../../execution/harness-waves/resource-activation-prerequisites.md)
name actual producers and missing policy/sampling/ownership evidence. Local preparation
is not blocked by COM consent. Active migration order, native execution and owner
contracts retain their separate gates. No further placeholder store is required for R4
capacity safety: durable SQL release authority plus retained uncertainty already exists.


## Corrected N019 actual SQL acceptance

After disk recovered, the automatic bounded watcher resumed the single owned cluster.
The next failure was another fixture error: queue dispatch_started was mistaken for
managed begin. The fixture now asserts pre-begin compensation refusal, calls the real
managed begin, then contrasts operational compensation with forged journal evidence.
Production SQL and client bytes were unchanged.

[Final builder receipt](raw/n019/final/receipt.json) and [complete log](raw/n019/final/after.log)
record exit0 for all six stages; [independent review](raw/n019/final/independent-review.json) accepts the exact source hashes. Coverage includes scoped FIFO/CAS concurrency, prior-session
exclusion, real client/kernel restart, committed CAS with a lost response and zero
redispatch, and actual role denials. Previous failed/NOT_RUN receipts remain historical.
This is pending-DDL acceptance in a disposable cluster; active schema, policy, sampler,
exclusive ownership producer, production scheduler and native acceptance remain open.


## Merged checkpoint and concrete producers

Merged source `1b63e81c11e3327c26f930e93656ac7a2b11fcb6`, tree
`76bc7d64fb93c1b0db5db28bc905b6d5c96c55c5`, passed complete fast in707.51s,
including all six actual resource SQL stages.
[Exact receipt](raw/closing/merged-1b63-fast.json). This retains COM03 wave2 through
ac874946 and N021 serialization; it does not cover the later producers below.

N022's [independent review](raw/n022/independent-review.json) accepts the explicit
host policy and bounded OS sampler. A real early timer wake caused the original29-test
candidate to refuse sampling; the correction waits for the monotonic
sampling deadline. Missing complete worker inventory still returns unknown, never0.
The real OS smoke supports physical readings only, not worker coverage or admission.

N023's [review and replay](raw/n023/README.md) accept the read-only exact Git lease
snapshot. Reusing N017's documented clock lesson fixed rejected native Promises at
all three clock sites. This is concrete lesson retrieval→application→verification;
it does not prove Observatory adoption or change a standing authority rule.

N024's [actual SQL receipt](raw/n024/root-sql-receipt.json) and
[independent review](raw/n024/independent-review.json) accept revision+generation CAS
and old-generation observation refusal, including A1→B2→A3. The original SQL control
fails as intended. A failed control setup hit an ambiguous overload; its corrected
transaction removes the conflicting overload and rolls back afterwards. Both logs
remain available. Pending107 is not an applied production migration.

N025's [preserved reviews and actual SQL replay](raw/n025/README.md) cover complete-policy
identity, frozen-generation publication and reconciliation of committed lost replies.
Independent review found the same-human-version/different-disk collision; the complete
policy digest correction refuses it. Actual SQL found valid timezone-offset readback
was refused; strict exact-instant parsing fixes it. All seven owned SQL stages pass.
The final combined producer gate remains separate from these module receipts.
Cross-project owner packets remain NOT_SENT at project-access consent.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — modular waves and review
- [`agent-sync`](https://github.com/ssheleg/agent-sync) — exclusive ownership
- [`agent-stack`](https://github.com/ssheleg/agent-stack) — admission boundaries
- [`evidence-docs`](https://github.com/ssheleg/task-pipeline) — source-bound evidence
- `project-reports` — durable report — not a skill this family ships

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>


## Producer source acceptance and stack recovery

Source `f2576c109f1de55179e07c7398aa2c4564e12087`, tree
`5ac7a0e834fe38e572d56188ac52b8c38616cc58`, passed full fast in873.64s,
exit0 with identical before/after tree. [Receipt](raw/closing/producer-f257-fast.json)
and [normalized command output](raw/closing/producer-f257-fast.txt). This includes
170 Vitest files/2053 tests and actual owned SQL, including all seven resource stages.
Stack-backed/browser tests were NOT_RUN;12 host plants skipped without workspace
node_modules; dependency-installation reproducibility remains UNVERIFIED.

The generic pool read was rejected by the unchanged scope gate. A dedicated
service-only host/pool read RPC now returns exactly eight fields or null. Its
[independent review](raw/n025/rpc-read/independent/receipt.json) accepts54 focused
checks and9 independent probes; actual SQL tests deny anon/authenticated execution.
The function grants neither launch permission nor exclusive host ownership.

After the earlier database failure, one `orbctl start` resumed the local machines.
Fabric DB became healthy, API returned200 and official MCP reached project consent
`waiting`. [Recovery receipt](raw/closing/live-stack-recovery.json). Owner requests
remain NOT_SENT; this recovery is not an installed-source or integrity acceptance.
The [next local packet](../../execution/harness-waves/input-scope-next-packet.md)
bounds remaining input/scope and run-binding work without inventing a COM prerequisite.


[Independent fresh-checkout delivery](raw/closing/producer-fresh-checkout/portable-receipt.json)
verified the pushed source,24 accepted hashes and61 entry targets without installing
or re-running tests. The25-node graph now has23 completed bounded deliverables and
2 blocked owner-acceptance nodes; CO282 remains partial. Completed historical packet
inputs are retained instead of being restamped to a newer plan.


## Latest runtime correction and documentation gate

The recovery above was brief. A distinct OrbStack boot at06:07:18UTC stopped at
06:09:23UTC with errno28/StorageFull. [Independent recurrence receipt](raw/closing/live-stack-recurrence.json).
The first recovery record now names its timestamp `recordedAt`; successful probes
were not individually timestamped. It does not establish continued availability.
No second restart or volume reset was attempted. Current board access is unavailable;
consent must be checked again after stable database recovery.

The documentation candidate tree `1f610a105ef7cfee1197149734405b20503ae65f` passed
fast in996.38s, [receipt](raw/closing/producer-closeout-fast.json). Its resource SQL
runner explicitly returned NOT_RUN because free disk was below1.5GiB; this is not a
new SQL PASS. Unchanged resource code retains the separately recorded seven-stage
PASS at f2576c1. This runtime correction and receipt attachment are a subsequent
documentation-only delta, checked separately before publication; no runtime code changed.

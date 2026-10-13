# CO-282 — autonomous delivery and portable harness: execution plan

Owner: Fabric. Tracks: RM-12 / RM-23 (the organization roadmap owns track status).
Requested 2026-10-13: modular research, specification, implementation and asynchronous
review/fix waves; all agents receive the applicable rules, reuse lessons and report evidence.
This plan is an executable proposal plus a scoped implementation queue, not a claim that
all hosts or upstream projects already comply. The carry-over ledger owns CO-282 status.

## Source and authority

Fabric baseline: `a5b78e4919d82c6eae88bee72e59eba3e0c1fbae`.
The [dated research snapshot](../../reports/2026-10-13-autonomy-layer-map/README.md)
remains immutable. The [09:19UTC owner refresh](../../reports/2026-10-13-resource-admission-contract/raw/owner-refresh-0919/receipt.json) confirms hub #209 and task-pipeline #112 merged; pipeline main78c42124 carries source1.94.0, while the latest release and inspected Codex/Claude payloads remain1.93.3. PR114 acceptance is not established here. The reviewed graph/lesson/iteration bytes are unchanged from the earlier candidate, so the remaining provenance findings persist. Do not turn installation, configured routes, a compiled
bundle or a passing fake into native agent acceptance.

- Identity: `apps/desktop/src/main/sessionEnroll.ts` (`enrollSession`, `ofRuntime`).
- Delivery: `sessionBundle.ts`, `pty.ts`, `acpShell.ts` in that main directory;
  `apps/desktop/src/shared/agents.ts` owns the runner catalogue.
- Context: `contextPack.ts` (`compileContextPack`, `MandatoryContextUnmet`).
- Capability and skill discovery: `adapterSkills.ts`, `executorReadiness` in `apps/desktop/src/shared/agents.ts`;
  launcher declaration, effective configuration and successful execution are separate evidence.
- MCP routing: `gateway.ts`, `apps/desktop/src/shared/servers.ts`; configuration is not health.
- Contracts: `workspace/knowledge/agents-first.md`, `authority.md`, `principles.md`;
  current ADRs and grants outrank retrieved retrospective advice.
- Delivery machinery: installed task-pipeline 1.93.3 `references/waves.md`,
  `scripts/graph.py`, `scripts/plan_audit.py`; these validate a queue, not a scheduler.

## Requirements

| ID | Observable outcome | Owner |
|---|---|---|
| REQ-001 | Each native runtime identity keeps its own pending enrollment and rejoin identity; retries are bounded | Fabric enrollment |
| REQ-002 | The requested supported runner mode reaches its actual transport; a missing required surface fails before spawn | Fabric adapters |
| REQ-003 | Context never exceeds its declared character budget; essential instructions and missing-source warnings are not silently truncated | Fabric context |
| REQ-004 | Every catalogue host has explicit launch, instruction, MCP, identity, resume and acceptance capability evidence | Fabric harness + adapter owner |
| REQ-005 | Modules have exclusive edit scopes, content-bound inputs, dependencies, negative acceptance and resumable handoffs | task-pipeline; this Fabric execution packet |
| REQ-006 | Review evidence binds candidate, inputs, dispatch, round and report digest; replay cannot manufacture independent reviews | task-pipeline |
| REQ-007 | Lessons are retrieved before dispatch and recorded after work, with provenance, applicability, expiry and adopted authority | Observatory contract + task-pipeline consumer |
| REQ-008 | Skill and MCP discovery is lazy and host-aware; declared, enabled, healthy, authorized and observed are distinct | skills hub + gateway + Fabric adapters |
| REQ-009 | Builders and reviewers share resource admission; a ready module can be reviewed while another builds | Fabric harness scheduler + task-pipeline |
| REQ-010 | Source truth, docs, handoff and acceptance converge on the same reviewed candidate; unresolved dependencies remain visible | every module owner |

## Ownership and implementation boundaries

| Layer | What changes here | What stays with its owner |
|---|---|---|
| Individual skills | Short entry, narrow trigger, contracts and evidence-based instructions | Specialized how-to references; no copied global doctrine |
| Routing / skills hub | Semantic discovery, explicit owner, host-specific visibility, bounded catalogue | No runtime lease or scheduler semantics in prose |
| task-pipeline | DAG, packets, question rounds, review provenance, invalidation and convergence | Does not impersonate native runtime enforcement |
| Fabric harness | Admission, effective modes, session identity, context budgets, cancellation, capability receipts | Native host limitations must be surfaced, not labelled supported |
| MCP / gateway | Per-capability grants, health and lazy lifetime, transport-aware routing | OAuth consent and plugin-managed processes retain their owning channel |
| Observatory | Structured lessons, search/filter contract, outcomes, spend/latency observations | A note cannot amend policy or grant authority |

Cross-project asks go through the Fabric project board, addressed to a project. The board
is not available to this session. Operator-approved MCP registration completed. The official
`fabric_whoami` first returned `no-project`, then recognized the project and returned
`waiting` for operator project-access consent. A later read returned HTTP429 call-budget
exhaustion; this run closed its temporary MCP child to stop its polling. No enrollment or
board submission succeeded. Owner packets can be prepared here but are NOT_SENT;
writing another project's HANDOFF or messaging its session is not a substitute. This is a
real dependency for upstream integration, not a reason to stop independent Fabric repairs.

## Waves and dependency frontier

1. **Wave 0, recover and specify:** pin sources, reproduce defects, create cold-reader
   packets, validate graph and ownership. No broad implementation before this plan commit.
2. **Wave 1, independent repairs:** N-001 enrollment; N-002 mode transport and mandatory
   surface; N-003 context budgets. Separate worktrees and non-overlapping edit scopes.
   N-004 inventories capabilities without changing the same runner files concurrently.
3. **Wave 2, continuous review:** as each patch is committed, another agent reviews its
   diff and negative cases at that SHA. Root performs integration tests serially. Findings
   return to the owning node; a fix invalidates that node's acceptance and its dependents.
4. **Wave 3, host and owner convergence:** N-004 checks effective context/MCP paths;
   N-005 packages upstream provenance/lesson issues; N-006 defines resource and lifecycle
   acceptance. Implement only in the owning repository through its admitted channel.
5. **Wave 4, integration review/fix loops:** N-007 replays boundary cases and runs the
   repository gate on the combined candidate. N-008 documents exact outcomes and handoff.
   A failing or unavailable check is never rounded up to PASS. Repeat 2–4 for findings.
6. **Observed follow-up, N-011:** an official pending MCP client reached HTTP429. Source
   inspection shows server Retry-After is lost and failed-state polling retries in3s.
   Reproduce that boundary with an injected HTTP peer, honor server cooldown without
   whoami bypass, independently review, then include it in N-007. Aggregate incident
   attribution remains unmeasured; no budget increase or consent bypass is authorized.

The graph and [packets](../../execution/harness-waves/packets/) are the dispatch form.
They do not replace the canonical CO register or create editable copies of upstream tasks.
N-009/N-010 remain blocked on owner admission and actual upstream acceptance; recording NOT_SENT does not complete them. N-007 reviews the available Fabric candidate without waiting for those external nodes, and cannot close CO-282.
Node completion requires output plus evidence; dispatch order follows actual dependencies,
not a barrier waiting for every module in a wave. Do not invent several independent reviews
by collecting the same report multiple times.

## Task contracts

| Node | Change / deliverable | Positive acceptance | Negative acceptance |
|---|---|---|---|
| N-001 | Match spare enrollment by native runtime identity, retain bounded retries | Same runtime retry reuses pending token; A and B rejoin their own sessions | B cannot acquire A's pending bearer; null identity cannot alias known identity; revocation/cap still hold |
| N-002 | Preserve supported mode semantics in ACP and refuse missing required bundle | Compile actual catalogue modes into effective process/session requests | Plan cannot silently become ask; no token-bearing spawn without required surface; invalid mode refuses |
| N-003 | Bound every UTF-16 code unit (`String.length`) counted by the context contract | Default and large packs compile; exact reported chars match final text | Oversize essential head, tiny/invalid budgets, omission footer and failed-source warning cannot overflow or vanish |
| N-004 | Evidence matrix and effective-context isolation review | Each host row cites source and observed test level | Missing sign-in, unsupported hooks or unprobed isolation cannot become native PASS |
| N-005 | Cross-owner change packets for existing pipeline/hub/Observatory work | Candidate receipts, scoped lesson round trip and host discovery contract | Foreign HEAD, old digest, report replay, unadopted lesson and unfiltered search are rejected |
| N-006 | Admission/lifecycle specification using existing scheduler seams | One admission pool accounts for builders/reviewers and watchers release work | Retry storm, orphan watcher, expired lease, full disk and duplicate dispatch cannot create unbounded work |
| N-011 | Respect MCP HTTP429 Retry-After and bound failure retries | Valid server cooldown delays reconnect; connection can resume after deadline | Missing/malformed/unbounded header uses a bounded fallback; repeated whoami cannot bypass cooldown; no secret in error metadata |
| N-007 | Independent review and combined focused/repository gates | Tests refer to exact integrated source; known fixture scope declared | Old reports and unrelated green checks cannot certify changed candidate |
| N-009 | Observatory lesson producer/consumer acceptance, after owner board admission | Scoped lesson written, retrieved and cited with provenance | Unadopted note cannot override an ADR; missing filter cannot silently broaden retrieval |
| N-010 | Skills/MCP owner acceptance, after owner board admission | Effective host discovery and admitted MCP set have native receipts | Installed or configured alone cannot certify loaded skills or isolated tools |
| N-012 | Internal resource preflight decision, resource packet R1 | Injected host/pool limits, fresh observations and verified ownership produce eligibility for reservation only | Malformed, stale, wrong-scope, missing-ownership and mismatched nested accounting inputs refuse or remain unknown; no fabricated permit or reservation |
| N-013 | Internal durable resource ledger, resource packet R2 | Atomic admission/reservation, identical retry recovery and proof-bound release in an owned database fixture | Capacity races, changed retries, foreign/stale release, child capacity minting and restored journal claims cannot bypass the ledger; pending DDL never implies active schema |
| N-008 | Final handoff with source, outputs, open gates and exact next action | Fresh checkout resolves all local links and packets | No claim of installed, native, integrated or released from a branch push |

## Host acceptance matrix: evidence to collect

| Host | Declared transport | Required checks |
|---|---|---|
| Claude Code | explicit MCP config, strict server selection | plan/ask/bypass, appended instructions, automatic native ID and hook rejoin, missing-surface refusal |
| Codex | isolated CODEX_HOME | generated AGENTS, approved instruction discovery, operator auth handling, project MCP overlays, explicit native ID fallback |
| Kilo | KILO_CONFIG_CONTENT | ask/bypass, effective brief, server precedence and unrelated-server sentinel, explicit ID fallback |
| Hermes | ACP with stdio MCP bridge | ask/bypass, skip configured MCP, first prompt, session/new and declared recovery limits |
| Kimi Code | ACP HTTP MCP | plan/ask/bypass global flag semantics, session mode semantics, configured-server sentinel, first prompt |
| Cline | plain runner; external enrollment is separate | explicit unsupported Fabric executor status until surface/brief delivery exists; native sign-in is a human gate |
| Shell | terminal only | never advertised as an autonomous executor |

A host being installed is not proof it read a skill. For instruction acceptance use a
harmless sentinel and a receipt naming effective path, host/version, input digest, scope and
result. Never copy entire global homes or secrets into session context to make discovery pass.
No live paid-model invocation is necessary for compiler or protocol regressions.

## Feedback loop and question rounds

Before a node: read applicable authority, the last relevant accepted lesson, sibling output
contracts and changed files. Retrieve a bounded set by project/module/failure kind; a zero-hit
query is not proof no history exists. Record source revision, applicability and reason chosen.
After a node: record observed symptom, cause, fix, positive/negative test, host/version and
candidate digest. Separate hypothesis, observed lesson, corroborated lesson and adopted rule.
Only an authorized policy change promotes advice into authority. Contradictions return a
finding to the source owner; a consumer never silently overwrites the canonical rule.

Batch nonblocking questions at review boundaries with options, consequence and affected
nodes. Stop only dependent work for an unresolved decision. Current round: no operator
choice is needed for the three demonstrated repairs. Board registration is completed;
project-access consent and native sign-ins remain human gates. No adapter workaround is
an answer to consent, and a later transport failure does not establish a grant or denial.

## Resource and recovery policy for this run

At most three workers plus root; no nested fan-out. Small isolated worktrees, no package
installation or duplicated Electron builds to test pure logic. One expensive test/build slot
shared with reviewers; light read-only analysis may overlap. Check free space before builds.
If the full gate cannot run with available dependencies, record the exact precondition and
continue focused checks; do not disable assertions to manufacture a green gate.

Waits carry owner, reason, prerequisite, next check and next action. Poll external reviews at
1–2 minute cadence only when a durable watcher can act; an unavailable board has no polling
endpoint and is recorded as such. Do not leave an unmanaged infinite shell loop. Reclaim only
this run's worktrees and temporary links, never foreign processes, refs, leases or edits.

## Completion and evidence

For each patch: source commit, test command/exit, reviewer identity and report digest,
limitations and any fix that invalidates the report. For combined delivery: map update,
link checks, documentation/register gates, types and required `bash scripts/ci.sh fast`.
No full hosted suite is dispatched after a push. Push task-owned branch and verify remote
SHA; this is reviewable delivery, not merge, release, installation or workspace publication.

CO-282 closes only when Fabric repairs and all required owner/native acceptance dependencies
have evidence. A completed subset is explicitly named; upstream delivery and runtime gates
cannot be replaced with a longer plan. Continuation is in the wave handoff and execution
receipts; source facts stay beside their owning code.

### N-007 fast-gate retention

Integration review found the four enrollment/request/MCP/ACP suites already in the full
package chains, but absent from the mandatory fast tier. N-007 also retains these existing
regressions in `scripts/ci.sh`, sequentially after session-bundle. This adds no provider
calls or live stack use; ACP keeps its existing force-exit runner policy. Positive check:
fast executes all four suites. Negative evidence: deleting the mechanisms already failed
the corresponding saved regressions; CI wiring is inspected separately from behavior.
The final candidate must preserve main4e227922 session hooks and pass the combined gate.


### N-012 — independent continuation at the board gate

The operator authorized continued implementation without questions. Resource packet R1
explicitly permits an injected local interface before portable schema acceptance. Therefore
board admission does not block this bounded work. Implement `resourceAdmission.ts` and its
production-function tests, with all host/pool scope and capacity policy injected. No global
capacity defaults, DB fields, public protocol version, quota mutation or launch integration
are selected here. The result is eligibility for reservation, never authority or atomic
reservation. R2/R3 must provide durability and actual entry-path enforcement separately.

Touches: `apps/desktop/src/shared/resourceAdmission.ts`,
`apps/desktop/test/resource-admission.test.mjs`, fast CI wiring and the resource packet.
Independent review targets malformed runtime inputs, exact capacity boundaries, unknown
readings, ownership/fence/input binding and nested demand accounting. The builder owns two
new files in an isolated worktree; root owns integration/docs, a different reviewer owns
adversarial acceptance. One expensive-check slot still applies.


### N-013 — pending durable implementation without migration-order bypass

R2 may be implemented and exercised against an owned database before external board admission.
Its correct base is migration62's operational authority, not a copy of61. Reserve host/pool
capacity atomically with an admitted attempt, recover identical retries, and preserve exact
run/session/generation proof on release. Configuration and observations are trusted internal
inputs; a caller cannot raise its own pool limits. Children consume a parent envelope.

The migration-order gate requires append order, while COM-03 has applied104 and105–106 remain reserved by existing work.
Therefore the new107 SQL belongs under `supabase/pending-migrations/` and is explicitly
applied only by owned fixtures. R2 itself does not change active migrations, their ledger or schema support. Promotion depends on resolution of those owning reservations; no owner is silently
renumbered. This splits useful source/test progress from an actual activation dependency.
R3–R6 retain their separate packet obligations; R2 is not their runtime acceptance.


### N-014 — opt-in launch adapter preparation

Prepare the internal adapter for R3/R4 without claiming their full runtime acceptance.
An explicitly required configuration must combine R1 eligibility with R2 atomic admission,
validate the exact resource receipt before both ordinary and pre-admitted chain launch,
and retain reservation capacity on any ambiguous outcome. No configuration keeps the
legacy behavior explicitly outside resource enforcement. Never fall back from required
resource admission to the legacy RPC when schema, policy or evidence is unavailable.

The adapter may cancel a never-begun admission or release after operational compensation;
a signal, session disappearance or expired lease cannot prove process/provider quiescence.
The pending migration, production composition, current input closure, fresh resource sampler,
free-terminal/backend coverage and native/provider acceptance remain separate prerequisites.
Tests use injected clients and production functions; they cannot certify those missing paths.


### N-015 — native launch preparation order

Close the separately identified local R3 prerequisite: `pty.ts` must complete asynchronous
executable resolution (including the always-async wrapper on other hosts) before invoking its final managed `beforeSpawn` check.
No asynchronous preparation may intervene between an accepted final check and the actual
owned spawn. Preserve mandatory Fabric surface, modes, enrollment markers and existing
platform behavior. A source-order or injected-function regression has its explicit scope;
it never certifies native Windows, provider quiescence or machine-wide resource enforcement.


### N-016–N-018 — independently executable recovery, waits and observation

N-016 prepares a bounded resource reconciliation scanner using durable held reservation
identities and the existing authoritative release RPC. It never infers quiescence from
missing sessions, lease expiry, cancellation or a task claim; repeated/restarted scans
retain ambiguous results. Production scheduling and active DDL remain separate.

N-017 prepares an internal never-started wait/wake kernel with a trusted CAS-store port,
immutable input and attempt binding, fenced begin and explicit uncertain outcomes. Strict
per-pool FIFO head selection prevents this queue bypassing an older expensive item, but
eventual starts require finite holds and all competing admissions respecting that policy.
Injected shared-store restart fixtures do not certify durable SQL or production scheduling.
A separately allocated persistence migration and real coordinator wiring remain producers.

N-018 prepares a bounded allowlisted observation/reduction module and optional resource
launch adapter instrumentation. Missing queue delay and observed usage remain unknown;
identity hashes, deduplication and explicit overflow prevent repeated samples becoming new
evidence. Synthetic paired comparison requires matching task, acceptance and environment
manifests; no fixture proves energy savings, lesson benefit or policy authority.

These three modules use isolated builders, then different reviewers and negative cases.
N-016 and N-017 own new files only; N-018 alone owns resourceLaunchAdapter.ts. Root owns
plan, graph, CI and registers. One expensive test/DB slot serves the wave. No active DDL,
index wiring, foreign project edits, native process or live-provider actions are included.


### N-019 — durable wait-store producer

This run allocates pending filename `supabase/pending-migrations/20261013000108_resource_wait_queue.sql`
for the internal CAS-store producer behind N-017. It follows pending107 and does not
occupy reserved105–106 or enter the active migration ledger. The trusted service alone
configures bounded per-scope capacity. SQL enforces immutable task/session/attempt identity,
actual never-started state, FIFO order, revision and permitted state transitions. Unknown
begun effects remain reconciliation barriers; elapsed time never authorizes replay.
The client adapter and owned PostgreSQL fixture must exercise real service-role RPCs and
client-role denials. No portable protocol, production loop or active schema is implied.


### N-020 — retain timed-out launch adapter operations

Actual repeated-call probes found that each timed-out `current`, `cancelUnbegun` or
`releaseCompensated` could start another unresolved operation for the same cached entry.
Retain one shared operation slot per entry until its underlying I/O settles, return
false/unknown while busy, and never adopt a late reply as permission. Different entries
remain independent. A hung currentness query conservatively retains capacity because
release must not bypass that unresolved operation. Scope is this adapter instance; no
transport cancellation or restart-wide boundedness is implied.

N-020 owns resourceLaunchAdapter.ts, its existing test and resource-launch-adapter.md.
Independent review runs the seven new regressions against the exact old source, the
corrected adapter plus R6 observation suite and source-bound negative receipts.


### N-021 — preserve bounded board admission through COM03 integration

Incoming ac874946 adds board-only sessions but bypasses the existing binding serializer.
Reuse that serializer for complete board grant validation and minting. Keep independent
board/coding caps, exact runtime identity and unrelated bindings parallel. Acceptance:
five old-source RED regressions,33 corrected enrollment cases, four independent controls,
and merged board/context/PTY seams. No new distributed lock or native guarantee is claimed.

Incoming deferred migration107 collides with our preparation107; neither filename reserves
an active ledger position. Its unapplied carryover patch also proposes an unrelated CO282.
Do not apply it over this run's CO282. Preserve both historical artifacts, keep canonical
286 rows/219 open, and reconcile owner IDs/order before activation or owner delivery.


<a id="concrete-producers"></a>
### N-022–N-025 — concrete producers before activation

The verified combined checkpoint1b63e81c completed fast, including the real pending
resource SQL runner. Local activation prerequisites still name executable source work.
N022 builds explicit immutable host policy and real OS memory/CPU/disk sampling, with
a trusted complete worker inventory required instead of inferred zero. N023 reads
actual exact Git lease objects and revalidates their ref, owner and expiry; it reports
a snapshot, never a numeric external fence or a fabricated run/input binding.

N024 fixes a newly found delayed-writer rollback in pending107: configuration changes
need exact previous revision and monotonic generation. Observation publication also
binds generation so A1→B2→A3 cannot admit an A1 sample. Exact idempotent configuration
replay preserves observation and generation; held capacity still blocks replacement.
N025 combines the actual policy/read producer with bounded pending SQL publication
and exact readback. The complete validated policy binds to a versioned SHA-256 SQL
revision, distinct from the human revision. An unknown write is reconciled, not treated
as permission. Readback compares exact instants across supported numeric timezone offsets.
A service-only host/pool read RPC supplies the exact eight-field projection; the generic
scoped-store checker remains unchanged and no Estate predicate is fabricated.

These nodes do not install policy, activate DDL or create a complete worker inventory
from a PTY list. Source-owned task/input closure, actual run↔lease binding, production
composition and native/write-boundary enforcement retain their explicit prerequisites.
One heavy DB/build slot remains shared; temporary builders cannot mutate root inputs.


### N-026 — selected input and mutable-scope snapshot

Execute the existing [input/scope packet](../../execution/harness-waves/input-scope-next-packet.md)
as a bounded local producer. A fixed trusted assignment selects exact paths and explicit
bounds; real raw bytes, root/parent/open-file identity, HEAD and bounded index metadata
are observed before and after. Optional identity/lease readers refresh independently.
No renderer digest, task touches or inherited run string can override that assignment.
The module always returns executionAuthorized:false. It neither claims complete dependency
closure nor wires admission, acquires a lease, activates DDL or enforces hostile writers.

Implementer and independent reviewer use separate temporary fixtures; parent integration
waits for frozen hashes. Reuse the previous timeout/async-clock lessons. The early real-Git
review found that stage entries alone miss assume-unchanged flags: retain its original RED
and require corrected metadata-sensitive replay. One heavy slot remains shared; no installs.


### N-027 — coherent bounded pool accounting read

The independent composition review at193b0e1e found that R1 needs reserved totals
while N025's publisher read intentionally exposes only eight policy/observation fields.
Add a separate service-only RPC and actual read adapter. Preserve that existing contract.
One MVCC snapshot must bind exact host/pool, policy digest, generation, observation and
root-held reservation sums; children are already charged in their root and released rows
do not count. Read at most the configured logical root bound plus one before aggregation.
Truncation, absent observation, malformed totals and overflow remain unknown, never zero.

The client validates full policy digest and exact generation; no overlap credit is a
conservative accounting choice, not measured overlap evidence. Retain one outstanding RPC
after timeout. No physical MVCC scan bound or future atomic admission is inferred.
Real service-role SQL checks must cover privileges, other pool/host decoys, child/root
accounting, bound/overflow refusal and coherent currentness. Active DDL remains separate.
This source-owned producer is permitted by ADR0152 and is not blocked on COM.


### N-028 — trusted run assignment and identity correlation

Execute the [bounded assignment packet](../../execution/harness-waves/run-assignment-packet.md)
in an isolated builder overlay stacked on accepted N026 bytes. Graph closure waits
for committed integrated source; temporary dependent implementation does not claim that
the predecessor is already delivered.

Read the approved exact manifest and estate-scoped task/project membership, persist
one immutable bounded local mapping, derive/read back the actual hash-pinned installed
agent-sync function result with explicit short key, and refuse key/run/session collisions.
Use independent N023 lease evidence with explicit unattributed-observation semantics.
The child environment patch replaces inherited identity only at later trusted composition.
All results remain executionAuthorized:false and ownership:unproven. No numeric fence,
R1 held, native CLI acceptance, foreign lease mutation or production wiring is invented.

Owned files use exclusive creation, bounded retained-record reads and a transaction lock.
Partial writes, unsettled I/O, unavailable identity, changed manifest and restart remain
unknown; no expired-ID reuse or stale-lock stealing. Actual installed-function readback
is explicitly narrower than the full CLI, whose whoami also mutates local legacy notes.


### N-029 — once-prepared managed launch input

The [prepared launch packet](../../execution/harness-waves/prepared-launch-packet.md)
changes the actual existing consumers: read supported task/target, compile the existing
context once before required admission, propagate the same immutable instruction body
and context through admission, PTY/bundle materialization and dispatch. Compare returned
SQL identity/instruction before begin and refresh prepared currentness before the final
resource/SQL guard. Refusal cannot infer cancellation or release without existing proof.

Support only newly admitted managed ordinary tasks in this slice. Required mode refuses
pre-admitted/chain/override and unsupported targets at the shared admission door before
reservation. Existing ordinary non-resource paths preserve their behavior. Partial body
and context identity is called contentDigest; it does not replace full inputDigest or bind
the later run-derived delivery header before that run exists. No new compiler/blob store,
resource configuration, active DDL, ownership grant or native acceptance is introduced.


### N-030 — shared integration and retained checks

One root integrator owns `scripts/ci.sh` after the four parallel producer/consumer
modules. This avoids concurrent shared-script edits while independent reviews continue.
Run focused checks as each module lands, then one combined fast gate in the single heavy
slot. Actual accounting SQL is required for N027 acceptance; disk refusal is NOT_RUN.
Persist exact source hashes and original failure controls, commit and push the task branch,
then publish through the existing workspace contract and verify its exact source binding.
No native admission, installed policy activation, product release or COM delivery follows
from a source check. N009/N010 remain dependent on restored official board access.


### N-031/N-032 — durable logical worker entry and actual launcher binding

[ADR0154](../../adr/0154-logical-worker-pools-retain-unresolved-start-intents.md)
defines an explicit Fabric-controlled logical pool, one durable unit per worker slot.
N031 first persists bounded crash-gap-safe intents using actual N028 assignment readback.
It returns incomplete inventory; a manifest or empty directory cannot prove coverage.
Temporary implementation may stack on accepted N028 while the integration graph waits
for committed receipts. No root mutation occurs during a frozen gate.

N032 then binds actual required ordinary managed/PtyManager entry before native creation,
actual owned unit identity and concrete no-spawn or process/provider retirement evidence.
Known unretired units and uncertain termination are retained. A future complete conservative
unit set requires proved controlled entry coverage and intact durable history, not every
unit proved live; missing provider quiescence still prevents retirement. Existing ordinary
non-resource launch behavior remains unchanged. No policy activation or complete inventory
is inferred from the N031 primitive. The concrete N032 source scope was reviewed and is
now being implemented in isolated overlays. It consumes the exact owned resource-adapter
binding, rather than reconstructing an attempt from a public admission receipt. The N031
owner extends its typed immutable event schema separately; the N032 owner changes the
actual managed/PTY consumers. The root integrator owns shared CI wiring. No operator
permission or foreign board admission is missing for this bounded local implementation.

N030's SQL/publication completion is not a runtime input of N032 source preparation.
N032 depends on N029 and N031 source contracts; its final integration still requires
the current combined check. The previous N030 dependency is removed to avoid a false
barrier on an unrelated unavailable database fixture. This does not waive N027 SQL
acceptance or N030 publication.

### N026–N030 source checkpoint

Source `8e683c3a71d094fa46dc1369ad74e5413cd4f13e` is pushed and remote-read back;
tree `d13d7773cead07b7b6f1424898ebca3033f787de` passed full fast in744.68seconds
without source changes. [Receipt](../../reports/2026-10-13-resource-admission-contract/raw/closing/n030-fast.json).
N026, N028 and N029 close as bounded source modules. N027 remains open because its
real SQL runner refused insufficient disk headroom; N030 retains SQL/publication work.
Browser/stack-backed acceptance and toolchain reproducibility remain unverified.

### N-033 — actual child run-label propagation

Composition review found that the actual N028 `childEnvironment(handle)` producer was
not consumed by N032/PTyManager: the spawned process could inherit its parent's run
label. N033 passes only the confirmed producer's allowlisted `AGENT_SYNC_RUN_ID` through
the private owned unit token and applies it after inherited, descriptor and bundle values.
Stale, substituted or missing binding refuses before the final SQL guard. No asynchronous
operation is inserted between that guard and synchronous spawn; legacy paths stay unchanged.
The packet closes correlation propagation only, not authenticated identity or R1held.

### N031 committed checkpoint and incoming source union

N031 source `6c8b3718302dd7a3e981ce792f9c0c13db780b27`, tree
`3253ccc739b2387da2cf713bdc0746f905f4caac`, passed full fast in1208.8seconds without
source changes and is remote-read back. The node is closed only for durable bounded
intent storage. [Receipt](../../reports/2026-10-13-resource-admission-contract/raw/closing/n031-fast.json).
Main `7bdd94de8d19c807f9cb4419299e2ad8b1a53cdb` is being integrated into the task branch;
all291 carry-over IDs and643 actual HTML IDs are retained, with unchanged generated
matrix semantics and18 plan IDs. [Union check](../../reports/2026-10-13-resource-admission-contract/raw/closing/main-7bdd-union.json).
This source merge does not claim a merge into main or a current workspace publication.

### Subsequent controlled-pool boundary

The [next controlled-pool packet](../../execution/harness-waves/controlled-pool-next-packet.md)
records the remaining completeness design and actual negatives before implementation.
A stable pool identity, exclusive lifetime writer and committed history/cardinality are
required; an empty directory, current PTY map or adapter manifest proves none of them.
All historical unretired intents remain charged; current run authority is a separate check.
Own-intent/reservation overlap must be bound to actual source identity to avoid falsely
admitting capacity, while avoiding double-charge refusal at capacity one. The current
N031/N032 implementation intentionally remains incomplete and inactive.


### N-034 — retained controlled-pool registry, storage slice only

The first locally executable slice of the controlled-pool packet owns a new real-filesystem registry, its tests and contract. An immutable installation-level anchor precedes the ledger; a lifetime O_EXCL writer file, canonical head/cardinality and predecessor chain detect missing history. The writer drains before a sealed clean handoff. Unclean restart never steals an owner. All old unretired declarations remain counted across invocation/policy changes. Actual append retry must retain its identity and confirm file and directory barriers; caller timeout retains the occupied I/O slot. Capacity, bytes and scans are finite.

Every output remains incomplete and unauthorized. Trusted storage declarations are not N031 provenance, worker observations, complete entry coverage or R1 held authority. Concrete factory composition is the dependent next slice, not a property invented by this storage layer. Independent review already found and required correction of cached seal receipt replay with a foreign handle and noncanonical head bytes; the original test process also exposed abandoned FileHandle lifetime errors. Original failures remain evidence, and clean process exit is required in addition to passing assertions.


### N-035 — concrete controlled-pool creation path

Compose the actual N028 assignment, N029 prepared inputs, N031 intent store, N034 retained registry, N032 managed unit, resource adapter, shared admission, managed launcher and PTY path. The factory owns its writer, dependencies and single-use creation tickets; it exposes only launch, snapshot and close. No default activation is added in index. Its app-identity input remains explicitly trusted; this source slice does not prove an unforgeable canonical installation root on every host.

A fresh controlled genesis and bounded immutable writer-epoch descriptors retain full validated policy and concrete coverage provenance. A preexisting generic ledger cannot become complete by relabelling it. N031 constructs canonical intent bytes from actual assignment, durably appends the matching retained declaration FIRST, then acknowledges the supplementary intent event. Orphan declarations remain charged. Current handles stay strict; older unretired declarations survive old membership/policy/invocation changes.

Only the concrete factory can produce a complete conservative logical set for this domain. A private ticket binds exact confirmed preparation, intent, admission, writer epoch and native token. PTY consumes it synchronously after final SQL and immediately before spawn; no asynchronous operation crosses that interval. Close revokes new tickets synchronously.

A permanent uncertainty latch avoids false clean-drain claims: any failed, busy, refused, timed-out or unknown operation, including failed snapshot and started-with-unknown-delivery, prevents sealing this invocation. Retry never clears it. Close during an active operation conservatively poisons that operation because its final currentness check sees closing. Clean handoff therefore requires an already successful settled creation path and a final latch/count check. The creation-drain deadline cannot leave a late sealing continuation. Once sealing starts, the registry owns its own deadline; an ambiguous unlink acknowledgement remains unknown and does not guarantee the lock still exists. This is creation/registry handoff, not termination of PTY, journal callbacks or providers. No retirement or stale-lock stealing is added.

Completeness does not fix conservative capacity-one refusal. Existing local admission and SQL charge observed intent plus request/reservations. A separate exact phase/identity-bound overlap contract is required before efficient activation; never subtract a caller-echoed attempt or unknown occupancy. R1 held authority, complete dependency closure, active migrations, configured runtime and native/provider acceptance remain separate and are not manufactured here.

Checks: actual modules and real owned filesystem with synthetic native boundary; declaration-first failures/orphans, exact lost-reply retry, controlled-vs-generic genesis, copied/reused/foreign tickets, close during SQL, permanent uncertainty latch, late close continuation, historical membership removal, missing records, changed captured dependencies, clean restart and explicit capacity-one refusal. Preserve existing generic storage and legacy launch suites. Independent review precedes integration; one heavy test slot.

Only actual delivery states `acked` and `delivering` qualify as successful launch outcomes. A native start with retryable, rejected, queued, malformed or unknown delivery remains visible in its actual launch result while permanently poisoning clean handoff. Private post-SQL ticket validation proves this captured same-process capability lifecycle, not a synchronous filesystem epoch refresh.

### N-036 — bounded verification efficiency

Move the unchanged three-suite unified compiler command after source-only gates and before the build. Two failed unchanged-tree runs spent2047.37 and2078.94seconds before the ratchet and observability refusals respectively. Six compiler-test assertions previously invoked the same `check()` twice; capture one result per assertion without removing scenarios. Independent review checks executable shell-command parity and exact six replacements. The complete final gate remains mandatory; no timing savings or receipt reuse is claimed.

N036 also separates ordinary filesystem setup budget from explicit timeout regressions in the worker-launch fixture. A same-source rerun passed27/29; two failures never reached final SQL/native spawn. Five ordinary fixture deadlines use5000ms; explicit20/1000/1500ms regression overrides and all production deadlines remain unchanged. This is a proposed fixture correction requiring the actual rerun, not acceptance from static inspection.

The actual N036 rerun caught an implicit default coupling omitted by static review: a1100ms injected delay no longer crossed the5000ms default. Two timed cases now explicitly retain their original1000ms. Corrected29/29pass on exact integrated sources; the28/29failure is preserved. The full combined gate remains owed.

The [worker-slot overlap proposal](../../execution/harness-waves/own-intent-overlap-packet.md) is a bounded subsequent design, not implemented or admitted work. It requires an atomic published member cut, injective SQL joins and actual source identity; R1 held/full-input/native/configuration and retirement remain separate. [Source pins](../../execution/harness-waves/own-intent-overlap-source-pins.json).

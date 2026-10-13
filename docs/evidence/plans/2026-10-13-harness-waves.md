# CO-282 — autonomous delivery and portable harness: execution plan

Owner: Fabric. Tracks: RM-12 / RM-23 (the organization roadmap owns track status).
Requested 2026-10-13: modular research, specification, implementation and asynchronous
review/fix waves; all agents receive the applicable rules, reuse lessons and report evidence.
This plan is an executable proposal plus a scoped implementation queue, not a claim that
all hosts or upstream projects already comply. The carry-over ledger owns CO-282 status.

## Source and authority

Fabric baseline: `a5b78e4919d82c6eae88bee72e59eba3e0c1fbae`.
The [dated research snapshot](../../reports/2026-10-13-autonomy-layer-map/README.md)
remains immutable. This plan records a later slice: hub #209 is now merged; task-pipeline
#112/#114 remain candidate work. Do not turn installation, configured routes, a compiled
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

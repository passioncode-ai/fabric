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

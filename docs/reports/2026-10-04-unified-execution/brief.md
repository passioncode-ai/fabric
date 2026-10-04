# Brief — unified research and execution

Source baseline: `41f994a709990ad72621fa834768a8833e7d93e1`, 2026-10-04.
Operator request: resume Claude Code, research every lane using expert/developer primary sources, design bounded cold-agent packets, consolidate and prioritize one queue, implement the first available task while peers research future work, report cross-task discoveries immediately. The user explicitly authorizes autonomous work and subagents; no additional intake question is needed. Existing release approvals, database migration and private commercial boundaries survive that instruction.

## REQ spine

| ID | Deliverable | Check |
|---|---|---|
| REQ-001 | Recover exact Claude stop and verify current publication/branches | raw/recovery.json and Git/status receipts |
| REQ-002 | Research all twelve lanes with primary documentation and developer discussions | twelve lane coverage records and source URLs dated 2026-10-04 |
| REQ-003 | Every canonical lane id mapped to a bounded packet or explicit design/decision activation task | `node scripts/unified-plan.mjs check` |
| REQ-004 | Context, contracts, failure modes, source pin, steps, validation and DoD travel with each packet | packet output + cold-reader review; design work is not called implementation-ready |
| REQ-005 | Single prioritized dependency queue, no second delivery-status home | plan.json and deterministic `next` |
| REQ-006 | Immediate peer messages and durable cross-task impact decisions | protocol.md, impacts.json and CLI blocking-impact negative control |
| REQ-007 | Execute first available prerequisite and verify it | queue CLI and meaningful planted-defect tests; P-08 existing owners preserved |
| REQ-008 | Durable tracked report, map, handoff, branch delivery and publication evidence | checks/receipt.json, remote SHA, publication receipt |

## Sources harvested

| Source | Meaning/freshness |
|---|---|
| Claude session b37c8ba2-bd28-4fce-975a-12edea3e6a14, tail | 07:22Z final working result, 08:50Z attempted this request without work; sanitized recovery only, no credential/session export |
| docs/handoffs/2026-10-03-onboarding-and-plan.md | Owns prior completed work; exact next task P-08 |
| docs/evidence/backlog.md#general-development-plan | ADR-0101 twelve lanes and Now/Next; canonical work ids preserved |
| docs/evidence/plans/2026-10-04-hub-verification.md | Only iteration1 closed at baseline; v2 fixes in foreign worktrees |
| docs/ux/vision.md and scenarios/flows/screens | Durable Project, replaceable agents, explicit effects, truthful state, progressive adoption |
| CONTEXT.md, docs/adr/, architecture/system-contract.md | Terms and accepted architecture outrank old plans |
| workspace/knowledge/{vision,principles,how-to-work,rules,backlog,plans}.md | Organisation doctrine and cross-repository ownership |
| docs/AGENT_SYNC.md and live config | Git CAS lease; isolated worktree, record plane degraded fs without token |
| docs/evidence/retro.md | Standing R001–R010 read; recent log queried on research/plan/parallel/provider; no historical baseline reset |
| Report catalogue | lifecycle active and private fleet draft; fleet details stay private, not copied into public Fabric |
| Code graph | no canonical graphify-out graph found; source search fallback |

Contradictions: prior workspace source stale versus current report pin; publication did complete at 07:34Z, despite Claude not observing it. Lifecycle PR results from Claude are claims until individual live checks; this run verifies refs and publication, not every product runtime. Old schema76 wording must be reconciled with migrations77+ at dispatch.

## Selected pipeline profile

Five stages: recovery/intake → per-lane research → convergence/design/packets → first available prerequisite implementation and checks → source handoff/publication. Scope/evidence/deps/resume apply throughout. This is a researched execution programme, not a claim that the entire product roadmap is implemented. Decisions reversing accepted ADRs remain proposed until operator judgment. Model: current parent model, inherited by every subagent; no override. Browser/API present; optional graph absent. UX validation runs against existing scenarios; no UI/copy/theme changes are included in first prerequisite.

Vision alignment: preserves the Project as the durable operating unit and closes observation→accountable work→verification without changing effect authority.

## First available task

P-08's release-readiness owner is already working in hubfix2-core and hubfix2-surface. Do not write their files. Execute `UP-01`, the queue/context/impact compiler needed to safely dispatch the unified programme and hand P-08 its cross-lane inputs; then P-08 owner consumes reviewed findings before iteration3/release. N1 and P-06.1 retain their own prerequisites and receipts.

## Resume

Read README.md → plan.json → run `node scripts/unified-plan.mjs next`; obtain a new project lease and fresh origin/main before any guarded write. A stale source stops dispatch and produces a new dated cut, never silently overwrites this research snapshot.

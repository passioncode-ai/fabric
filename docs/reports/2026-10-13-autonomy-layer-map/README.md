---
report:
  id: fabric/2026-10-13-autonomy-layer-map
  title: "Autonomous delivery: ownership, asynchronous verification and learning"
  kind: decision-input
  project: fabric
  domains: [orchestrator, automation, memory, mcp, architecture]
  as_of: 2026-10-13
  status: draft
  valid_until: 2026-10-20
  summary: >-
    Continue the existing task-pipeline iteration and skills loading work.
    Separate skill doctrine, routing, distribution, capability admission, runtime execution,
    protocol ownership and learning. This is a researched proposal, not runtime acceptance.
  sources:
    - {name: Fabric source, url: "https://github.com/passioncode-ai/fabric/tree/e09ad8fb0d2be7e25e43b832b8dc664392d14077", read_at: 2026-10-13}
    - {name: Existing iteration candidate, url: "https://github.com/ssheleg/task-pipeline/pull/112", read_at: 2026-10-13}
    - {name: Accepted loading plan, url: "https://github.com/ssheleg/sshlg-skills/pull/208", read_at: 2026-10-13}
  produced_by: {agent: codex, task: autonomy-layer-map}
  supersedes: []
  consumers: [fabric, task-pipeline, sshlg-skills]
---

<sub>ssheleg skills — skill-search · task-pipeline · make-skill · working-with-fabric · project-reports · agent-harness · evidence-docs · maintaining-fabric-workspace</sub>

# Autonomous delivery: ownership, asynchronous verification and learning

## Scope and interpretation

The requested outcome is a predictable autonomous delivery loop: research the whole problem,
cut it into modules with explicit seams, work concurrently within resource limits, resolve
questions in batches, verify each ready module immediately, integrate against shared contracts,
and retain lessons that change subsequent work. A faster run must preserve acceptance quality.

This report supplies the initial vision and ownership map requested by the operator. It does
not approve a new protocol, replace an owner's backlog, or claim the implementation is complete.
It supports existing **RM-12** (memory) and **RM-23** (agent skill layers); their status remains
in fabric-workspace. The proposal serves Fabric vision sections 2, 3 and 9: the Project retains
purpose, evidence, authority and learning across replaceable agents. No product screen changed.

## Verified starting points

1. **An iteration candidate already covers much of the request.** task-pipeline
   [#112](https://github.com/ssheleg/task-pipeline/pull/112), head
   `ad3d0894d070530c941b746b747c71333fe2bb77`, was OPEN when queried. Its
   [iteration doctrine](https://github.com/ssheleg/task-pipeline/blob/ad3d0894d070530c941b746b747c71333fe2bb77/plugins/task-pipeline/skills/task-pipeline/references/iteration.md)
   defines dossiers, convergence passes, batched questions, per-node asynchronous certification,
   seam checks and a local/shared lesson loop. Companion [#114](https://github.com/ssheleg/task-pipeline/pull/114)
   was also OPEN (`e1d5b062ef830c0a2d7695bef7ea319d704639d8`). These are candidates, not installed acceptance.
2. **Loading optimization has an accepted owner plan.** Hub
   [#208](https://github.com/ssheleg/sshlg-skills/pull/208) was MERGED at
   `edc6b9c590bd86ff19cb5201f1d22114e6b3c5c3`. Its
   [plan](https://github.com/ssheleg/sshlg-skills/blob/edc6b9c590bd86ff19cb5201f1d22114e6b3c5c3/docs/evidence/plans/2026-10-13-load-optimization.md)
   owns L1 pack visibility, L2 MCP inventory/switch (Observatory PB-159), L3 pipeline alignment,
   L4 measurement and L5 project domain plugins. Fabric RM-23 and Dashboards FD-61 are named dependencies.
   Plan acceptance does not prove those changes are installed or effective.
3. **The local lessons index has an integration dependency.** Hub
   [#209](https://github.com/ssheleg/sshlg-skills/pull/209) was OPEN. Do not silently treat the
   candidate index path and owner registration as a completed installation.
4. **Older checkout pointers can restart finished work.** Hub's
   [handoff at 7ed620f](https://github.com/ssheleg/sshlg-skills/blob/7ed620fa58ae7daaf46b31cb3334f7e99192181b/docs/HANDOFF.md)
   records integration waves closed and task-pipeline 1.93.3 shipped. It separately leaves
   routing eval W4-C open. It is older than #208 and must be read with that newer plan.
5. **Fabric has useful runtime foundations.**
   [sessionBundle.ts at the inspected revision](https://github.com/passioncode-ai/fabric/blob/e09ad8fb0d2be7e25e43b832b8dc664392d14077/apps/desktop/src/main/sessionBundle.ts#L106)
   narrows declared MCP servers to project grants before minting credentials and verifies a
   content-addressed context packet. This proves source behavior, not end-to-end operation in every host.
   [contextPack.ts](https://github.com/passioncode-ai/fabric/blob/e09ad8fb0d2be7e25e43b832b8dc664392d14077/apps/desktop/src/main/contextPack.ts)
   distinguishes missing/partial memory and mandatory context. Keep and extend these contracts.
6. **Fabric's product vision already includes a shared harness.**
   [ADR-0133](../../adr/0133-agents-are-created-composed-and-fixed-in-fabric-and-fabric-is-the-harness-every-coding-agent-reaches.md)
   and [vision](../../ux/vision.md) retain the Project as the operating unit. A new replacement
   agent runtime is unnecessary for this proposal.

PR states were queried with `gh pr view <id> -R <owner/repo> --json state,headRefOid,mergeCommit`;
#208 additionally with `mergedAt`. These are dated observations. No model replay, host reload,
paid eval, product deployment or full system acceptance was performed for this report.

## Ownership by layer

| Layer | Owns | Optimize here | Does not prove |
|---|---|---|---|
| Individual skill | Procedure for a bounded job, inputs, outputs, failure cases | Short core; conditional references; deterministic scripts; remove duplicate doctrine; counterexample/eval before tuning | A runtime enforces prose |
| Routing | Choosing the smallest sufficient skill set for the task and stage | Task concepts, dependencies, route reasons, ambiguity handling; paired recall/precision eval | A hidden skill is discoverable with adequate quality |
| Skills hub | Catalog, versions, installation, host visibility and provenance | Small visible core; domain packs per project; reversible host changes; source/package/installed/loaded receipts | An existing session reloaded an updated skill |
| MCP inventory and selection | Effective host/project/session configuration, capability availability | Project-scoped allowlists, on-demand schema exposure where supported, collisions and inactive entry detection | Configured equals started, or schemas equal process cost |
| Lifecycle broker / capability owner | Service lifetime and state isolation | Share only stateless services; idle policy and cleanup; preserve per-session identity | A shared process is safe for stateful credentials or sessions |
| Fabric harness | Session admission, context packets, work claims, queue, checkpoints, watches and results | One resource budget for builders, reviewers and tests; resumable waits; artifact-bound evidence | Every external host supports every enforcement hook |
| fabric-agent-contract | Versioned inter-product wire and compatibility | Existing contracts first; one identifier vocabulary, receipts, supersession and partial states | A schema alone implements delivery |
| Observatory | Agent work evidence, retrieval, measurement and learning quality | Filter lesson kinds before candidate limits; provenance, applicable scope, reuse/result evidence | A recorded or retrieved lesson improved work |
| Project repository | Canonical task/contract/docs/retro and accepted implementation | One source per fact; propagation checks in the change; committed cold-reader packets | A copied report is current runtime state |

MCP inventory/switch follows the already assigned L2/PB-159 work. Gateway policy is one
implementation underneath this division, not a second owner of the whole optimization system.

## Proposed execution contract

Use the existing graph and iteration machinery; fill missing fields or checks in its owner.
A bounded task packet needs: requirement IDs, module and owner, input artifact revisions,
outputs, files it may change, contract/seam versions, true dependencies, risk, acceptance,
resource class, scope of authority, relevant lessons, and resume point.

**A graph frontier is only a candidate list.** Admission also needs file/contract ownership,
resource availability, authority, and input freshness. Do not confuse ordering, a lease,
a spend grant and process capacity. A ready node may wait for a heavy-check slot while a
small independent node proceeds. Do not start more work just to keep every slot occupied.

Recommended resource classes are light research, model review, CPU build, disk-heavy test,
browser/device and provider-bound work. Limits are configuration and measured locally;
no numerical default is asserted as universally optimal. Count reviewers and independent
subagents too. Keep a disk reserve, owned scratch cleanup, deadlines, retry caps and a
queue with aging so a long or expensive task is not starved by short ones.

**Asynchronous verification binds to an artifact.** Start local checks and review after a
module is committed with its required input versions. The receipt identifies candidate SHA,
input/contract digests, check command/version, environment and result. Subsequent edits
invalidate affected receipts. Checks for unrelated modules remain usable only when their
input closure remains unchanged. Test each seam when its members are ready; final acceptance
uses a frozen integration revision. A collection of green branch checks is not that acceptance.

**Question rounds unblock only affected nodes.** Reuse the candidate's queue and triggers:
frontier blocked, five accumulated questions, or wave boundary. Record source attempts,
recommended answer, consequences and blocked nodes. Reversible internal assumptions carry
expiry/revisit conditions. Unknown authority, consent, secrets and spending are never inferred
from elapsed time. Owner answers must arrive through the authorized project board.

**A watcher is recorded work.** It needs an owner, watched condition, deadline, durable resume
point, idempotency key, allowed next action and cancellation/cleanup. Recovery rechecks the
condition and authority. A watcher must not merge a changed candidate or repeat an uncertain
external effect merely because an earlier operation timed out. Prefer shared event-driven
watching over a polling process per task where the host supports it.

## Learning that changes the next run

Target cycle: **observation → project retro → scoped lesson proposal → retrieval for a new
task → recorded application or justified rejection → outcome check → candidate skill/routing/
runtime change → eval and rollout → measured result or rollback.**

Keep the three claims separate: **found**, **applied**, **helped**. A retrieval hit proves only
found. A task record should cite the lesson revision and the action it changed. Helped needs
an outcome comparison with comparable tasks/inputs; token savings alone do not prove better
acceptance. Preserve negative results and corrections rather than only successful anecdotes.

Retrieve a bounded task-specific set using module, failure class and task concepts. Keep
scope, source, status, conflicts, supersession and omitted critical context visible. Repetition
is evidence to investigate; copied notes do not provide independent corroboration. A shared
lesson must never grant authority or override a current owner decision just by becoming
`observed`. The candidate's promotion language needs this explicit seam review.

Generalized lessons may enter the shared store only under its privacy and admission contract.
Do not move raw transcripts, private paths or customer/project text into public skills.
A standalone install keeps its local fallback; Fabric/Observatory availability adds verified
capabilities without silently becoming a universal prerequisite.

## What to measure

| Outcome | Useful measures | Guard against |
|---|---|---|
| Delivery | Time to accepted module, critical-path wait, rework and abandoned attempts | More simultaneous agents mistaken for throughput |
| Context | Effective instruction/schema tokens, selected skills, omissions, route recall | File size mistaken for actual model load |
| Machine | Active process count, RSS/CPU, peak scratch, queue delay and free disk | Declared MCP entries mistaken for running processes |
| Quality | Escaped defects, stale-document failures, seam regressions, invalidated receipts | Fewer checks mistaken for efficiency |
| Learning | Applicable retrieval, cited use, rejected lessons with reasons, repeat failure rate | Retro count mistaken for learning |
| Cost | Provider usage and machine time per accepted outcome | Savings obtained by reducing scope or quality |

First take a bounded baseline on representative tasks. Compare candidate against it with
fixed inputs and an independent acceptance check. Set budgets only from measured constraints.
Do not claim a percentage improvement before the experiment exists.

## Bounded continuation packets

These are proposed review packets against existing owner work, not new canonical task IDs.

| Packet | Owner / existing entry | Inputs → output | Acceptance / dependency |
|---|---|---|---|
| A: reconcile current work | Hub #208 L1–L5; pipeline #112/#114 | Current heads, owner answers, installed receipts → one source-pinned integration map | No stale checkout used as current; decisions already made are not re-asked |
| B: async verification seam | task-pipeline #112/#114 | Node/contract revisions → explicit receipt invalidation and seam rules | Changed dependency rejects stale green; unrelated node proceeds; blocked node does not stop frontier |
| C: resource admission | Fabric harness, coordinate existing owner plan | Runtime capability matrix + bounded measurements → one queue budget contract | Builders/reviewers/tests share limits; recovery and scratch cleanup; no starvation; no claim of universal enforcement |
| D: selective skills/MCP | Hub #208 L1/L2/L4/L5, Observatory PB-159, Fabric RM-23, FD-61 | Effective config and usage → reversible per-project exposure | Needed capability remains available; unrelated tools absent where host permits; no credential copying; active sessions preserved |
| E: lesson round trip | Pipeline #112, hub #209, Observatory lesson work | Retro → emitted lesson → store → next task → outcome | Producer and consumer schemas match; relevant result survives crowded history; found/applied/helped distinct |
| F: enforcement and improvement | Owner of each host adapter + common contracts | Required controls and actual capabilities → conformance matrix and eval | Supported controls tested positively/negatively; unsupported host explicitly degraded; one public claim matches evidence |

A precedes dependent changes. B, D and E can be researched and reviewed independently.
C and F use their contracts and existing runtime capabilities. Heavy validation shares one
admission mechanism rather than creating a second parallel pool. Review a ready packet while
other packets are still being prepared. Integration waits only on actual shared seams.

## First decision round

Most process intent is already authorized by the request and existing plans. These are the
remaining design questions to resolve from owner records first, then batch only genuine gaps:

- Which resource constraints are measured and enforceable in each host today, and who owns
  admission when the coding agent was not launched by Fabric?
- What exact evidence promotes a lesson into binding project guidance? Store confidence must
  remain separate from operator authority and version compatibility.
- Does mandatory repeated model certification improve outcomes enough to justify its cost for
  low-risk changes? Measure the current candidate first; do not silently lower its recorded risk.
- Which owner decision reconciles old gateway-first instructions with current project-scoped
  MCP/lifecycle design? Propagate one source instead of maintaining contradictory instructions.

## Session method, limits and handoff

Three bounded read-only research workers inspected pipeline/hub, Observatory/knowledge,
and MCP configuration semantics; the parent checked live PR states and Fabric source seams.
No broad build fan-out was launched. Private operational inventories and transcript contents
are deliberately excluded from this public report. Peer-session exports were treated as leads;
PR claims used above were checked independently. No message was sent through a substitute
channel when Fabric board tools were absent: board reporting remains **NOT_REPORTED**.

Exact next task: **review the #112/#114 candidate together with #208 L3 and Observatory's
lesson producer/consumer contract; attach findings to the existing owners through Fabric when
that channel is available.** In particular, test stale verification after a fix, lesson schema
compatibility, and admission of reviewers under the same resource budget as builders.
Do not restart closed integration waves or create another memory store.

[Validation and delivery handoff](../../handoffs/2026-10-13-autonomy-layer-map.md) records checks
and remaining publication work. This proposal does not change roadmap/task statuses.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- `skill-search` — searched the whole catalog; `task-pipeline` — analyzed module execution.
- `make-skill` — separated auditing from edits/releases; `agent-harness` — separated harness layers.
- `working-with-fabric` — checked board availability; `project-reports` — report format and home.
- `evidence-docs` — source and claim boundaries; `maintaining-fabric-workspace` — map/publication rules.

The last four support Fabric/project reporting; they do not replace the family delivery router.

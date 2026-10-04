# Plan — agent registry, in-machine protocol, pipelines, traces, tools, memory, truth layer

Date: 2026-09-29. Brief: [../specs/2026-09-29-agent-registry-brief.md](../specs/2026-09-29-agent-registry-brief.md)
(REQ-01…REQ-24). Design: [../specs/2026-09-29-agent-registry-design.md](../specs/2026-09-29-agent-registry-design.md).
Contracts: [../specs/2026-09-29-agent-registry-contracts.md](../specs/2026-09-29-agent-registry-contracts.md).
UX: ST-041…051, FLW-59…68, SCN-098…125, SCR-66…69 (commit `55738fe`).

Every task is TDD: a failing test first, watched red on a planted defect, then the code, then the
module's gate. Each module is its own run (stages 5→10) and lands under its repository's rules;
the operator's own agents are changed only in their private repositories (AR-11).

## Canonical module status — 2026-10-01

This table owns module status for the common backlog. The task tables below retain the
acceptance detail; the dated knowledge-base checkpoint does not override this source.
Status receipts: [brief §10 and §11](../specs/2026-09-29-agent-registry-brief.md#10-ar-0--what-was-done-2026-09-29).
Partial delivery in a dependent tool does not complete Fabric's module.

| ID | Item | Status | Source / next prerequisite |
|---|---|---|---|
| AR-0 | Truth layer, names, workspace and contribution rules | done | brief §10; current common-backlog publication is recorded in the organization-quality run |
| AR-1 | Agent contract and adapter kits | partial | Published contract `2ea54f7` and adapter v0.5.2; AR-1.5 consumer pin compatibility remains open (brief §11, org-index X-4) |
| AR-2 | Registry walking skeleton | partial | Dashboards service-host and deep link plus Observatory inventory delivered; Fabric's registry reader (AR-2.2, S1 of ADR-0115) merged to main in 67a5dc42 (PR #7); next: AR-2.1/2.3/2.4, SCR-66 and the walking-skeleton acceptance; brief §11 |
| AR-3 | Hub, northbound MCP and tasking | partial | S1–S4 of [ADR-0115](../../adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md) merged to main in 67a5dc42 (PR #7), unreleased (ships in 0.3.1, plan P-08): AR-3.1 and AR-3.4 partial for EXTERNAL agents, ahead of AR-2 under ADR-0115 because they need only the AR-2.2 reader; AR-3.2, AR-3.3, AR-3.5 and AR-3.6 not started and still require AR-2 and its walking-skeleton acceptance |
| AR-4 | Floating CEO context and micro-controls | planned | task acceptance below |
| AR-5 | Versioned pipelines | planned | task acceptance below; no persistence execution claimed |
| AR-6 | Cross-agent traces | planned | task acceptance below |
| AR-7 | Agent production pipeline | planned | task acceptance below |
| AR-8 | Tool registry and host | planned | task acceptance below |
| AR-9 | Optimizer proposals | planned | task acceptance below |
| AR-10 | Memory with citations and context packs | planned | task acceptance below |
| AR-11 | Existing-agent protocol migration | partial | Observatory delivered in brief §11; private agents remain in their private repositories |

## AR-0 — truth layer (this run)

| Task | Does | Implements | Check | Status |
|---|---|---|---|---|
| AR-0.1 | ADR-0090 (reserved through agent-sync): PassionCode.ai is the organization, whose toolkit is for AI-native teams (ADR-0086 kept); Fabric is the product and CEO agent; Fabric X names Fabric's tools; Fabric Agent Contract/Adapter make any agent Fabric-compatible; Fabric Workspace is the wiki of every tool; supersedes ADR-0018's "PassionCode.ai is the product" | REQ-17 | ADR index row; `scripts/check-docs.sh` | done — brief §10/§11 acceptance |
| AR-0.2 | Fabric's glossary and brand terms carry the rule (`CONTEXT.md` under a lease; `docs/brand/terminology.md`); `scripts/check-narrative.sh` extended with the naming rule and planted-defect cases | REQ-17 | the gate watched red on a planted "PassionCode.ai is the product" line | done — brief §10/§11 acceptance |
| AR-0.3 | The narrative fixed in every family repository at the lines the audit named (brief §8): contract, adapter, Dashboards, Inbox, Switchboard, launcher, site, org-index, workspace; each first paragraph says what the tool adds to Fabric and that it also works alone | REQ-17 | a naming check script run over every repository: 0 findings | done — brief §10/§11 acceptance |
| AR-0.4 | `/Applications/PassionCode.app` removed from the operator's Mac (a leftover 0.1.0 install of the same bundle id) | REQ-17 | `mdfind kMDItemCFBundleIdentifier == ai.passioncode.desktop` lists only `Fabric.app` | done — brief §10/§11 acceptance |
| AR-0.5 | Fabric Workspace becomes the wiki of every tool: an aggregation manifest names each family repository and the documents it contributes; publish on merge (the workspace's existing publisher, triggered per repository); a lag check (`workspace lag`) fails a repository whose `main` is newer than the published pin beyond a grace period | REQ-18 | lag check watched red on a stale pin, green after publish | done — brief §10/§11 acceptance |
| AR-0.6 | The contribution entry: a public `CONTRIBUTING.md` in the org's `.github` profile repository (default for every repository) with the read-first order — this repository's `AGENTS.md`, the org rules, the naming rule, how the system works (link to Fabric Workspace) — and the recommended base (the sshlg-skills family: task-pipeline, agent-sync; plus the `@passioncode-ai/passioncode` launcher with its `working-in-passioncode` skill) | REQ-19, REQ-21 | every family repository's `AGENTS.md` links it; a link check | done — brief §10/§11 acceptance |
| AR-0.7 | `working-in-passioncode` gains the read-first rule, the naming rule and the code-marker rule; the launcher's session-start hook prints one line "read CONTRIBUTING + AGENTS.md first" when the working directory is a `passioncode-ai` repository | REQ-19 | hook test with a fake repository | done — brief §10/§11 acceptance |
| AR-0.8 | Code region markers: `#region <slug> — docs: <path>#<anchor>` … `#endregion <slug>` in the comment syntax of the file; a checker script (`check-regions`) in Fabric's `ci.sh` that fails an unmatched region or a `docs:` reference whose file or anchor does not resolve; the rule documented in AGENTS.md and the contribution entry | REQ-20 | checker watched red on a planted broken anchor | done — brief §10/§11 acceptance |

## AR-1 — contract (fabric-agent-contract, fabric-agent-adapter)

| Task | Does | Implements | Check | Status |
|---|---|---|---|---|
| AR-1.1 | `interop.md` + schemas: capabilities as tools, jobs, result envelope with usage, elicitation → interaction point, trace context, hub `agent.call` (C3) | REQ-04, REQ-05, REQ-11 | positive/negative fixtures; FAC-SEM-017…019 | done — brief §10/§11 acceptance |
| AR-1.2 | `provider.md` + schema for `providers/` entries (C1) | REQ-01 | fixtures; FAC-SEM-013…015 | done — brief §10/§11 acceptance |
| AR-1.3 | `runners.md` + schema for the runner catalogue (C2) | REQ-01, REQ-02 | fixtures; FAC-SEM-016 | done — brief §10/§11 acceptance |
| AR-1.4 | `pipeline.md` + schema and the compatibility rule PL-1…PL-4 (C4), with a reference checker | REQ-08 | fixtures incl. an incompatible edge, a missing checker, a cycle | done — brief §10/§11 acceptance |
| AR-1.5 | Fix G-07 (manifest ↔ descriptor cross-check rule), G-08 (one extension key spelling), G-11 (one contract pin across repositories), G-12 (profile names in CONTEXT match the schema) | REQ-04 | semantic-rule tests; pin check | partial — published contract corrections; consumer pin compatibility remains org-index X-4, brief §11 |
| AR-1.6 | Adapter kits emit trace context and job handles; `building-fabric-services` and `adapting-projects-to-fabric` teach interop; new `providers/` writer in the kit | REQ-05, REQ-11, REQ-14 | kit tests; conformance probe gains interop rules | done — brief §10/§11 acceptance |

## AR-2 — registry (walking skeleton, part 1)

| Task | Does | Implements | Check | Status |
|---|---|---|---|---|
| AR-2.1 | Runner catalogue data + detection (catalogued argv only, timeout, no shell) | REQ-01, REQ-02 | tests with fake binaries; planted uncatalogued binary never executed | not recorded |
| AR-2.2 | Readers for `services/` (shared service-host code extracted from Fabric Dashboards into a package both apps use) and `providers/` | REQ-01, REQ-10 | the shared state-precedence tests run in both apps | partial — brief §11; Fabric's reader merged to main in 67a5dc42 (PR #7) (`apps/desktop/src/main/agentRegistry.ts`, `apps/desktop/test/agent-registry.test.mjs`): both directories into one registry keyed `id[.instance]`, malformed files logged with reasons, FAC-SEM-010/013; it follows the contract schemas instead of the unpublished service-host package; state precedence and private-agent work not delivered |
| AR-2.3 | `registry.observed@1` event, projection, feed sentence; Fabric agents as entries | REQ-01, REQ-02 | projector test; narrative gate | not recorded |
| AR-2.4 | SCR-05 as the registry (three groups, problems, primary actions) — SCN-098…102 | REQ-01, REQ-02, REQ-22 | RTL tests per state | not recorded |
| AR-2.5 | `fabric-dashboards://service/<id>.<instance>` URL scheme in Fabric Dashboards; "Open dashboard" in Fabric — SCN-101 | REQ-10 | e2e in Fabric Dashboards; not-installed state | partial — Dashboards scheme/e2e delivered; Fabric Open dashboard action has no acceptance receipt |
| AR-2.6 | Observatory `machine.mcp.inventory` capability; SCR-66 MCP servers — SCN-103/104 | REQ-03 | tests incl. Observatory absent and stale | partial — brief §11; remaining Fabric/private-agent work is not delivered |

## AR-3 — hub and tasking (walking skeleton, part 2)

| Task | Does | Implements | Check | Status |
|---|---|---|---|---|
| AR-3.1 | Northbound MCP (ADR-0026) extended with `agent.call`, `fabric.job.get/cancel` routing, grants, spans; ADR superseding ADR-0034 | REQ-04, REQ-24 | contract probe against Fabric; refusal tests | partial — decided by [ADR-0115](../../adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md) (supersedes ADR-0034). Merged to main in 67a5dc42 (PR #7): one surface on a stable port with `hub.json` and a door token; binding credentials (sha256 verifier, revocable); migration 76; `agent.call` to Fabric Inbox with grant check, `X-Fabric-Accounts` narrowing, one `hub.call.forwarded@1` span per hop and the interop envelope (`hub-door-db.test.mjs`, `hub-products.test.mjs`, `hub-access-db.test.mjs`; release verification for 0.3.1 in [its ledger](2026-10-04-hub-verification.md)). Not done: `fabric.job.get/cancel` routing (Fabric Inbox's tools are synchronous), session-declared `source: 'fabric'` servers (CO-194), a live run with the Fabric Inbox app (CO-195) |
| AR-3.2 | Fabric's MCP entry written into each catalogued runner's config (header credential), removed on disconnect | REQ-04 | config-writer tests per format; no credential in URL/argv | not recorded |
| AR-3.3 | CEO tools `agent_call`, `create_task`, `pipeline_run` on the ADR-0039 loop; plan-before-effect in the conversation — SCN-105 | REQ-06 | CEO tool tests | not recorded |
| AR-3.4 | First-use admission + binding in one confirmation — SCN-106 | REQ-07 | probe-failure scenario test | partial — device-style consent per ADR-0115 §2–3 merged to main in 67a5dc42 (PR #7) for EXTERNAL agents (SCN-132/133, SCR-76): registry-checked requests, a native prompt with a parent window or a notification and a queue row, Allow/Deny/expiry/standing denial, the credential handed over once, incremental consent, revoke (`consent-presenter.test.mjs`, `AgentAccessPanel.test.tsx`); first use of an agent INSIDE a project (SCN-106, admission probes) not done |
| AR-3.5 | Jobs, interaction points from elicitation, delegation, unknown outcomes — SCN-107/108/109 | REQ-05, REQ-06 | job-state tests; no blind retry | not recorded |
| AR-3.6 | Walking-skeleton acceptance: the registry sees all four sources on this Mac and the CEO gives one agent one job whose trace has a line per hop | REQ-01, REQ-06, REQ-11 | recorded run on the operator's Mac | not recorded |

## AR-4…AR-11

| Task | Does | Implements | Check | Status |
|---|---|---|---|---|
| AR-4.1 | `CeoContext@2` (view, route, selection) + context chip; ADR for the context shape | REQ-09 | conversation tests | not recorded |
| AR-4.2 | Micro-controls (rename, drag within a lane, toggle, pin) with the rule and undo — SCN-111 | REQ-09 | RTL tests; check re-run on change | not recorded |
| AR-5.1 | `pipelines`, `pipeline_stages` tables (grants + RLS like migration 4), events, projector functions | REQ-08 | migration and projector tests | not recorded |
| AR-5.2 | CEO composition, graph view on SCR-49, PL-1…PL-4 in Fabric, project/global scope — SCN-112…114 | REQ-08 | planted incompatible edge caught | not recorded |
| AR-6.1 | `trace.span@1`, assembly across routed hops and reported spans; SCR-67 drawn with the shared graph renderer — SCN-115/116 | REQ-11 | incomplete-agent test | not recorded |
| AR-7.1 | Agent production pipeline inside Fabric (intake → base or project → manifest → evals → install → admission → canary) — SCN-121…123 | REQ-14 | production of one sample agent end to end | not recorded |
| AR-8.1 | Fabric tools registry, tool host over the hub, SCR-68 — SCN-117/118 | REQ-13 | tool without passing test cannot be enabled | not recorded |
| AR-9.1 | Optimizer agent (routine over traces), proposals on SCR-69 — SCN-119/120 | REQ-12 | proposal never applies itself | not recorded |
| AR-10.1 | CEO `query_memory` with citations; Russian full-text configuration and no length cap; context packs produced; `agents/trap` export (M183) — SCN-124/125 | REQ-16 | memory eval fixture extended with Russian cases | not recorded |
| AR-11.1 | One migration row per existing agent — Project Observatory, then each of the operator's own agents in its private repository: manifest, capabilities, jobs, trace propagation, `providers/` or service descriptor; conformance probe PASS | REQ-15 | per-agent probe report | partial — brief §11; remaining Fabric/private-agent work is not delivered |

## Cross-cutting

| Task | Does | Implements | Check | Status |
|---|---|---|---|---|
| X.1 | Every module writes the error, empty and loading states of its screens and flows in the same change | REQ-22 | `docs/ux/lint.py`, `pnpm run gates:docs` | not recorded |
| X.2 | This plan is the one plan across repositories; each module's run updates its rows and the org-index run index | REQ-23 | REQ set comparison below | not recorded |

## REQ set comparison

The brief's REQ set must equal the union of `Implements:` above. Computed, not typed:
Computed 2026-09-29 by reading the REQ rows of the brief and the `Implements:` column of every
task row above: **brief 24, implemented 24, missing none, extra none.**

## Note, 2026-10-03 — what the start paths delivered into AR-2.1

The first run's coding-agent detection ([ADR-0100](../../adr/0100-first-run-and-start-paths.md),
`apps/desktop/src/main/executorDetect.ts`, plan row P-01) is a first part of AR-2.1: it runs only the
catalogued programs (`AGENTS` in `shared/agents.ts`) with `--version`, a timeout and no shell, and is
tested with fake binaries (`apps/desktop/test/executor-detect.test.mjs`). AR-2.1 itself stays
**not recorded** here: the runner catalogue data and the registry's own detection are not built. This
note is appended; the table above is the record of 2026-09-29.

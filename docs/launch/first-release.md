<sub>ssheleg skills — task-pipeline · super-ux · sheleg-design · copywriting · agent-sync · maintaining-fabric-workspace</sub>

# First release · CEO-first entry

Status: target-design revision authorised by the operator on 2026-09-25. This document does not claim native implementation or release readiness.

## Brief and source ledger

Objective: let a newcomer configure Fabric, select a working executor and choose a project folder; Fabric discovers the project and presents a sourced overview without asking the operator to retype information already in the project. The same division of work applies to tasks, decisions, plans and continuation.

Sources: `docs/ux/vision.md` (durable Project, replaceable providers, gradual adoption); `docs/ux/scenarios.md`, `flows.md`, `screens.md` (canonical behaviour); `docs/launch/adoption/README.md` and AD03–AD24 (existing implementation backlog); `scripts/product/guided.mjs` (prior source/purpose/review form); `apps/desktop/src/shared/agents.ts` (Codex terminal is not yet an admitted Fabric executor).

Contradictions: the previous target requires manual name/purpose/review before useful context and postpones executor setup. The operator explicitly replaces that first-launch path with CEO setup → executor readiness → folder selection → observation → insight. Existing creation transaction integrity remains; a technical validation is automatic, not an extra review screen. Persona defaults are usable immediately. A missing executor prevents an agent scan, but never prevents seeing saved work or retaining a selected folder.

Vision alignment: the Project owns the observed facts, history and plan; replacing a provider does not replace Fabric or the Project. No file instructions or observed repository content grant additional authority.

Delivery: interactive target mockup, canonical UX propagation, release-only screen map, implementation packets and evidence. Native runtime implementation is subsequent work. Current model retained; no model switch or automation is required. Existing brand tokens and HTML component system retained. Publication is the already-authorised private workspace publication, not a product deployment.

## Requirements and checks

| ID | Requirement | Acceptance |
|---|---|---|
| FR01 | CEO first, editable name/colour avatar with usable defaults | Setup reaches provider choice without mandatory aesthetic work |
| FR02 | Replaceable base executor, missing/install/login/failed readiness | No scan without ready executor; recovery preserves setup |
| FR03 | Folder selection by picker throughout current target | No editable local path field; cancel preserves prior selection; URL stays a URL field |
| FR04 | Automatic observation, no project naming or review gate | Select folder → progress → own sourced overview; no fabricated history |
| FR05 | Partial, empty, denied, duplicate, cancelled and stale scan | Explicit recovery; no repeated imports or false completion |
| FR06 | Human/CEO/executor ownership across R0 | Each release screen has primary action, next state and recovery |
| FR07 | Stop and continuation | Stop requested differs from confirmed; same/new session and other provider are distinct |
| FR08 | Interactive release map and consistent visual design | Every mapped screen opens; keyboard, narrow viewport and context tested |
| FR09 | Preservation and handoff | Old ideas/anchors retained; changed plan named; native gaps not marked built |

## Delivery sequence

1. Inspect existing routes, source controls, skills and coordination. Complete.
2. Canonical scenario/flow/screen revision and release route model.
3. Interactive CEO-first screens and shared folder selection control.
4. Behaviour, keyboard and rendered review; fix findings.
5. Rebuild reports, run repository gates, record native gaps, commit/push and publish workspace.

## Design rubric

Product workbench, existing PassionCode tokens. One primary next action per entry step; source selection never needs a typed filesystem path. Setup has a visible exit/resume; observation shows real categories rather than decorative percentages. At 1280px the next action remains reachable; at 390px panels stack without losing actions. Details, sources and technical settings are disclosures. Motion is limited to existing feedback and respects reduced-motion. A missing agent cannot produce a successful observation. These are acceptance targets, not claims of tests already run.

## Review and verification · 2026-09-25

Delivered target sources: [12-view renderer](../../scripts/product/first-release.mjs), [shared picker](../../scripts/product/folder-picker.mjs), [route model](../ux/product-model.json), [strategy and native packets](first-release-strategy.md), [ADR-0063](../adr/0063-ceo-first-discovery-and-explicit-continuation.md). Canonical UX remains draft/unobserved where native evidence is absent.

Independent source review found and this iteration corrected: provider readiness leaking between Claude Code and Codex; late callbacks after source/provider changes; pending continuation overriding an explicit choice on another project; overwritten stopped task runs; collection scan inventing candidates for an empty folder; private project names retained in denied chrome; context questions misclassified as stop; a partial scan not refreshing the same project. Tests name these boundaries in [first-release.test.mjs](../../scripts/test/first-release.test.mjs).

Additional maintenance found by the local gate: `claude --version` returned `2.1.282 (Claude Code)` and `codex --version` returned `codex-cli 0.157.0` on 2026-09-25. [Provider matrix](../../apps/desktop/src/shared/providerCapabilityMatrix.ts) current pins were advanced with every current capability still `unverified`; historical observed rows remain unchanged. No login, credential-store or inference probe was performed.

Checks actually run before source commit:

- `node --test scripts/test/first-release.test.mjs scripts/test/folder-picker.test.mjs scripts/test/adoption-*.test.mjs scripts/test/product-*.test.mjs`: 214 passed, 0 failed. This is fixture/source acceptance, not native process evidence.
- Negative probe imported an in-memory copy with the observed-stop guard removed. The unchanged-run assertion failed as intended; original source was untouched.
- In-app browser at `127.0.0.1:4333/product.html`: CEO entry, observed readiness fixture, folder dialog Escape/reopen/select, automatic observation, derived `atlas` name, suggested task → plan → run → stop → new Codex session after its own check; scoped CEO question, close chat and screen map. No editable filesystem path was needed. Latest run-history/pending/candidate fixes additionally have focused unit cases; every browser state permutation was not manually traversed.
- Rendered inspection at 1280×720 and 390×844. On narrow view, right chat becomes full-width, scope/composer remain reachable; screen map measured `documentWidth=390`, `innerWidth=390`. Browser error log: empty. This is bounded visual/keyboard review, not a complete assistive-technology certification.
- Source re-review relocated legacy completeness citations after module imports/controller insertion. Historical browser hashes remain historical; old creation-helper dispositions do not certify the superseded onboarding alias.

Coordination: `agent_sync.py record --decision ADR-0063` succeeded. `reconcile` exits 1 for pre-existing unmatched ADR/CO records and deliberately unimplemented carry-over; this iteration does not claim global reconciliation or close native work.

`bash scripts/ci.sh fast` completed with exit 0 on 2026-09-25; stack-backed probes did not run. The focused provider-capability suite also passed 22 tests. New first-release/picker tests are included in the fast script. Publication is separately verified with `node scripts/workspace.mjs check --require-child`; its receipt records the published source and child revision.

## Native work and exact handoff

Next task: **FR-A — native CEO setup and entry routing**, followed by the bounded FR-B provider-readiness slice, using [the shared contract and packets](first-release-strategy.md#bounded-native-implementation-packets). First inspect the existing desktop settings/provider producers and AD04/AD05/AD16 bindings, then implement persisted persona/default-provider and readiness states without granting execute authority from mere selection. Follow with FR-C directory observation. Do not port the fixture reducers into production or promote Codex to admitted on the strength of these mockups.

Open work is [CO-168](../evidence/specs/2026-08-16-software-fabric-carryover.md), with prior CO-166/167 preserved: real native picker and source-reference boundary, provider detection/auth/capability evidence, durable observation and project identity, OS process-tree stop proof, authority/branch-aware context handoff, persistence/restart and voice capture/STT. FR-A…FR-G define preconditions, outputs and negative checks. All advanced ideas remain in the prior adoption backlog and full catalog.

Prototype state is page-local and resets on reload. Folder dialog, observations, run output, voice transcript and provider checks are explicitly examples; no real files, microphone or agents are accessed. Board acceptance records the operator's decision, not an invented independent check. The mockup is a reviewable target for the first release, not a release-readiness receipt.

Temporary worker checkouts are local editing aids; their artifacts were integrated into this owning repository. No pending member implementation branch or production submodule pin is introduced by this design iteration.

## Tools actually used

- `task-pipeline`: bounded plan, implementation and independent review.
- `super-ux`: scenario → flow → screen and release route model.
- `sheleg-design`: existing tokens, visual hierarchy and responsive composition.
- `copywriting`: action labels, state and recovery copy against the brand pack.
- `agent-sync`: exclusive register lease, ADR/carry-over numbering and journal.
- `maintaining-fabric-workspace`: private wiki publication and receipt verification (project skill, outside the family).

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

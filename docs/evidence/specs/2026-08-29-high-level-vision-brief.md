# Task brief — high-level-vision

> Stage-0 brief for run `2026-08-29-high-level-vision`, confirmed by the operator
> on 2026-08-29. Protocol and technology recommendations are not treated as current
> until Stage 1 verifies them against primary sources.

- **Date:** 2026-08-29
- **Task:** reconcile the operator's new PassionCode.ai vision with Fabric's
  existing decisions and produce a coherent high-level product, architecture and
  scenario narrative that can guide later product design and implementation.
- **UI verdict:** yes — administrator, owner, participant and specialist workspaces,
  task queues, dashboards and agent-supplied views are part of the vision.
- **Coordination:** branch `codex/high-level-vision`; lease `VISION-NARRATIVE`.

## Knowledge sources

| Source | What it says about this task | Freshness | Authority | Stale after this run? |
|---|---|---|---|---|
| Operator request and five attached transcript screenshots, 2026-08-29 | PassionCode.ai as an agent-agnostic harness/automation environment; project-specific teams of agents and people; closed support, ops, content, SEO, development and release loops; scoped participant workspaces; optional agent-rendered widgets; open ecosystem and paid bundles | current | operator | no |
| Operator follow-up, 2026-08-29 — copyable agent bootstrap | A lightweight onboarding surface should let a person create a new Fabric-compatible agent or adapt an existing project by copying one generated recipe into their coding agent; the recipe finds or installs the required skills, inspects the project, scaffolds compatibility and returns it for admission and binding | current | operator | no |
| Operator follow-up, 2026-08-29 — public narrative boundary | The repository should carry one coherent brand narrative, a publish-ready organization profile and a clear guide. Public open-source surfaces describe the open system and omit internal product economics and unpublished distribution details | current | operator | no |
| `docs/vision.md` | Fabric began as one operator's estate, was amended into a platform of federated estates, but still says it is not a general-purpose agent framework | amended 2026-08-27/28 | ratified product vision | **yes** |
| ADR-0013 | Project is a persistent workspace with one PM, agent/connection bindings, goals, routines, runs, reports and isolated memory; templates seed rather than type | accepted 2026-08-27 | decision | no, unless the new vision changes cardinality |
| ADR-0016 | Organization equals Estate; global people join through memberships; multi-tenancy starts at migration 1; org #1 ships before platform-wide work | accepted 2026-08-28 | decision | possibly — product/brand boundary must be clarified |
| ADR-0017 | Humans and other estates meet chains through typed interaction points; only artifacts cross declared apertures; transport/harness is hidden behind conformance | accepted 2026-08-28 | decision | no for the seam; protocol revision must be reverified |
| `CONTEXT.md` | Canonical ontology for assets, projects, routines, runs, agents, estates, memberships and interaction points | current at HEAD | glossary | yes if new UI/render/work-item terms are accepted |
| `docs/architecture/project-workspaces.md` | Canonical project, account-binding, memory, routine, observer and dashboard model | current at HEAD | architecture | **yes** — human/project workspace projections are incomplete |
| `docs/architecture/federation.md` | Canonical estate, identity, delegation, access and cross-estate artifact boundary | current at HEAD | architecture | **yes** — broader participant workspaces and project staffing need reconciliation |
| `docs/architecture/agent-composition.md` | Capability registry, provider binding, bundle compilation, transport adapters, marketplace costing | proposal plus accepted amendments | architecture proposal | **yes** — parts still inherit superseded ADR-0011 scope wording |
| `docs/architecture/agent-family.md` and backlog M19–M37 | The same research→content→publishing, SEO, ops, support and developer loops already exist as proposals; marketplace and economic surfaces are costed but not settled | proposal, 2026-08-24/28 | proposal/work list | **yes** |
| `docs/ux/{foundation,flows,screens,scenarios}.md` | Validated operator-only project creation, agent binding, connection, monitoring and proposal flows across 12 text-designed screens | current at HEAD | UX source | **yes** — owner/member/specialist and composable-view scenarios are absent |
| `fabric-agent-contract` | Normative compatibility profiles, admission, immutable binding, typed results/evidence and governance | local `main`, consulted 2026-08-29 | external contract | possibly — render surface and human/estate profiles are not yet established |
| `fabric-agent-adapter` | Existing software/API/MCP/A2A/local runners can be wrapped into a version-pinned Fabric provider bundle; it does not supply the host/runtime | local `main`, consulted 2026-08-29 | implementation companion | no |
| `graphify-out/graph.json` | Reachability index connects Project, Estate, Membership, project workspace, federation and agent-family design | built at exact HEAD `45731f0`; measured 0 commits and 0 days behind | index | **yes — refresh after the documentation change** |
| Obsidian project wiki/context pack | Related designs cover consent-based delegation, durable async agents, common artifact stores, multi-project coding workspaces and knowledge graphs | queried 2026-08-29 | contextual, untrusted until reconciled | update the Fabric page after acceptance |
| `docs/evidence/retro.md` | R-001 requires ontology propagation across glossary, vision, architecture, schemas, UX and derived surfaces | current; read in full | standing instruction | stamp if a hierarchy/cardinality ADR is added |

**Contradictions:** (1) `docs/vision.md:131-132` rejects a general-purpose agent
framework while the operator now names an agent-agnostic harness/framework as the
product; (2) Fabric is already the platform of estates under Passion Code, but the
requested PassionCode.ai name does not yet say whether it names that product or a
separate commercial layer; (3) the current UX has only the estate operator, while
the request makes owners, employees and cross-company specialists first-class;
(4) the member surface is currently a typed interruption queue, while the request
adds persistent role workspaces, agent-building and composable widgets; (5) the
marketplace sections were frozen under superseded ADR-0011 and have not been
reconciled with ADR-0016; (6) compatibility covers execution and artifacts, not a
safe UI/render contract. The first contradiction is blocked on Decision 1 below;
the rest are the design work of this run.

## Documentation inventory

| Question | Answer |
|---|---|
| Regime | governed — seeded in this run at `docs/DOCMAP.md` |
| Decision home | `docs/adr/` (`ADR-NNNN`), exclusively |
| Open/deferred questions | the append-only `CO-NNN` ledger in the original software-fabric carry-over file |
| Doc map | `docs/DOCMAP.md`, seeded this run with canonical homes and propagation matrix |
| Gate | `bash scripts/check-docs.sh`, seeded this run; structural scope only |
| Shared state | agent-sync lease `VISION-NARRATIVE` on a task branch |
| Intent vs as-built | documentation and schemas exist; host runtime/UI are not implemented; this run changes intent documents, not runtime |

- **Entry audit:** yes — the operator explicitly asked to compare the vision with
  current documentation. Findings will be delivered as the gap matrix and plan,
  not silently fixed while discovered.
- **Knowledge wiki:** installed and queried; external notes remain contextual.
- **Retro:** one standing instruction, R-001; inspected but not fired yet.
- **Retro archive:** queried by vision/project/agent/human/workspace/federation;
  no additional archived entry matched.
- **Code graph:** current at HEAD; refresh owed after edits.
- **Work-list:** `docs/evidence/backlog.md`; current architecture direction includes
  M19–M41, with most agent-family rows proposed or decided-unscheduled.
- **Source checkout:** task branch was created from `origin/main` at `45731f0`;
  measured 0 commits behind before the first edit.

## Scope

- **In scope:** high-level product thesis and boundaries; canonical concept model;
  control/execution/data/knowledge/identity/policy/experience planes; agent, workflow
  and human collaboration rules; concrete B2B SaaS scenarios; composable workspace
  and rendering contract at architectural level; deployment/topology options;
  security, tenancy, observability, economics and lifecycle implications; technology
  capability map and selection criteria; documentation gap matrix; staged roadmap;
  working name, positioning line and provisional slogan; copyable bootstrap onboarding
  for creating a new compatible provider or adapting an existing project.
- **Out of scope:** choosing vendors merely by preference; detailed API/schema or DB
  migrations; production code; visual design/Figma; pricing numbers; legal conclusions;
  publishing to external systems; implementing marketplace settlement or billing.

## Requirements

| ID | Requirement | Verification | Status |
|---|---|---|---|
| HV-REQ-001 | One falsifiable high-level vision states who the product serves, the job it owns and what it is not | `docs/vision.md` review against the confirmed brief | met — ADR-0018 + vision amendment |
| HV-REQ-002 | A current-vs-proposed gap matrix classifies agreement, extension, contradiction, stale copy and open decision | evidence table with `file:line` receipts | met — platform architecture §16 |
| HV-REQ-003 | The reference architecture defines system planes, boundaries, ownership, trust and event/artifact flow without binding to one agent vendor | architecture document plus consistency review against ADR-0013/16/17 | met — platform architecture §§3–13 |
| HV-REQ-004 | Concrete B2B SaaS scenarios trace support, ops, research/content, SEO, development/release and human escalation end to end | new/updated `SCN-*` scenarios and flow trace | met — FLW-09..11, SCN-019..021 |
| HV-REQ-005 | Administrator and participant workspaces, scoped widgets/views and third-party renderers have explicit safety and degradation rules | UX source update plus architecture contract review | met — ADR-0020, FLW-06/08, SCN-013/014/018 |
| HV-REQ-006 | Technology recommendations distinguish required capabilities from replaceable products and cite current primary specifications | primary-source ledger with retrieval dates | met — platform architecture §§13/17 |
| HV-REQ-007 | A staged roadmap separates org #1, team collaboration, federation and open ecosystem, with dependency and decision gates | roadmap/module map review against backlog | met — platform architecture §15 |
| HV-REQ-008 | PassionCode.ai naming, category line and slogan are recorded as provisional brand hypotheses, not architecture facts | brand section explicitly marked provisional | met — ADR-0018 + platform architecture §1 |
| HV-REQ-009 | Every accepted ontology/scope change propagates to its canonical homes and stale derived surfaces are marked or refreshed | R-001 inventory, link/schema/UX checks | met — §16 reconciliation; gates pass |
| HV-REQ-010 | Graph and knowledge sources consulted at Stage 0 are refreshed or explicitly left with an owner and deadline | Graphify commit match plus source-ledger closeout | met — Graphify refreshed after the final evidence commit; wiki remains contextual and unchanged because no canonical wiki write was authorized |
| HV-REQ-011 | A low-friction agent-onboarding journey supports both “adapt this repository” and “create a new provider,” beginning with a copyable bootstrap recipe and ending with conformance, admission and an explicit project binding | UX scenario trace plus compatibility-lifecycle review against `fabric-agent-adapter` and the normative contract | met — ADR-0019, FLW-07, SCN-015..017 |
| HV-REQ-012 | One brand pack governs a publish-ready organization profile, an English guide and a Russian adaptation; public open-source surfaces contain no internal product-economics narrative | brand lint, narrative gate and public-surface review | met — `docs/brand/`, `docs/public/organization-profile.md`, `docs/guides/` |

## Users and context

- Solo founder/operator running several software products.
- Co-owners administering one AI-native company together.
- Employees or contractors who receive a role-scoped workspace and may work across
  several estates without receiving their credentials or memory.
- Agent/provider authors who adapt existing software or ship new capabilities.
- Builders working in Claude Code, Codex, Cursor or another coding harness who want
  to turn the current repository into a provider without first learning Fabric's
  contract vocabulary.
- Customers/end users who interact through support and product surfaces, not through
  the Fabric control plane.

The architecture must support local terminals, remote services and hosted execution;
project isolation; long-lived asynchronous work; explicit grants; evidence-carrying
results; cross-project and cross-estate boundaries; and replaceable agent runtimes.

## Decisions locked

| # | Decision | Chosen | Rationale |
|---|---|---|---|
| 1 | Relationship of PassionCode.ai and Fabric | PassionCode.ai is the user-facing product; Fabric is its technical kernel, runtime and open compatibility layer | One product keeps identity, tenancy, projects, billing and marketplace policy coherent while allowing the Fabric contract and adapters to remain reusable technical surfaces. Confirmed by the operator 2026-08-29. |
| 2 | Project ontology | Retain ADR-0013: persistent project, templates seed rather than type | The new scenarios fit configuration and composition without a type explosion. |
| 3 | Organization/tenant ontology | Retain ADR-0016: Organization = Estate, Person is global, Membership scopes access | It already covers solo, team and multi-company participation. |
| 4 | Inter-estate boundary | Retain ADR-0017: typed points and artifact-only aperture | It preserves isolation and makes delegation auditable. |
| 5 | Architectural stance | Agent-agnostic at capability/contract boundaries, not lowest-common-denominator internally | Replaceability comes from conformance and adapters, not pretending all harnesses behave alike. |
| 6 | Workflow stance | Deterministic workflow first; autonomous agents only where open-ended judgment is required | It lowers cost and makes the closed loop auditable. |
| 7 | Design medium for this run | Text and diagrams only; no Figma | The request is architecture and narrative, not visual composition. |
| 8 | Copyable onboarding prompt | Treat it as a version-pinned bootstrap recipe, never as the compatibility contract or an implicit grant | The recipe may install or find the adapter and drive authoring, but only the resulting manifest, fixtures, conformance evidence, admission record and project binding create trust or authority. |
| 9 | Public narrative boundary | Open-source surfaces explain the public product, open kernel, contracts and contribution path; internal economics and unpublished distribution details stay outside those surfaces | The reader gets one coherent technical story without exposing internal product notes or turning open-source documentation into an offer page. Confirmed by the operator 2026-08-29. |

## Autonomy

| Stage | Answer |
|---|---|
| Model | GPT-5.6-sol, most capable available in this session |
| Escalation | Decide reversible in-repository structure autonomously; stop for product identity, money/pricing, legal posture, public promises or outward acts |
| Pacing | `pipeline.json` absent, so loop mode is off; manual gates remain |
| External sources | Read official specifications and the two named companion repositories; propose changes outside this repository, never push them |
| Duplicates | `docs/DOCMAP.md` names one canonical home per fact; `docs/vision.md` remains the single vision home |
| Fixtures | Documentation-only run; schema checks apply only if schemas change; no runtime fixture is claimed |
| Work-list | `docs/evidence/backlog.md`; read at harvest and closeout |
| Setup audit | yes, explicitly entailed by the operator's comparison request |
| Stage 1 | Verify MCP/A2A, auth/tenancy, durable execution and safe embedded-app claims from primary sources current on 2026-08-29 |
| Stage 2 | Treat as a platform; decompose into modules and deliver one coherent architecture set at the end |
| Stage 3 | UX scenario tracing required; text-only, no Figma |
| Stages 4–5 | Base `origin/main`; work on `codex/high-level-vision`; commits allowed after manual brief confirmation; do not push external repositories |
| Stage 5 integration | Local reconciliation only after final gate; no remote push without explicit operator direction |
| Stages 6–7 | Run documentation, link, schema-if-touched and UX checks; no deployment |
| Stage 8 | Not applicable — no runtime release |
| Stage 9 | Update canonical docs, mark derived snapshots, refresh Graphify; wiki update only after accepted architecture |
| Stage 10 | Operator signs off; unresolved items receive concrete `CO-*`/backlog homes; read retro and carry-over in full |

## Done criteria

- The operator can follow at least the six named operating loops from trigger to
  verified outcome and human handoff without an undefined transition.
- Every system responsibility has one owning plane and one canonical document.
- Agent/runtime products remain replaceable behind explicit capability contracts.
- Tenant, credential, memory and authority boundaries remain intact across projects,
  people and estates.
- The gap matrix and roadmap make all deferred choices visible and addressable.
- Structural documentation checks pass and the knowledge graph matches the final commit.

## Open assumptions and risks

- PassionCode.ai/Fabric naming is settled at the architectural level; brand voice,
  final trademark clearance and market-tested copy remain later brand work.
- A third-party UI/render extension is a larger trust boundary than a data widget;
  the design must not equate JSON views with arbitrary executable code.
- A copied bootstrap prompt is an untrusted instruction surface and can drift. It
  therefore needs a visible recipe version, idempotent re-runs, least-privilege
  installation, no embedded long-lived secret, a dry-run or diff before writes and
  a conformance result independently checked by Fabric.
- Hosted customer code, custody of credentials, billing and refunds, and marketplace payouts
  remain separate obligations even if one subscription bundles first-party agents.
- Current local docs cite protocol versions that may have changed; Stage 1 must verify
  them before the architecture repeats them.

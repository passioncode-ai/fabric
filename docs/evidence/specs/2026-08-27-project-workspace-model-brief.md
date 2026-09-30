# Task brief — persistent project workspaces

> Stage-0 intake artifact. Confirmed by the operator in the 2026-08-27 conversation
> before this document was written.

- **Date:** 2026-08-27
- **Task:** redefine a Fabric project as the persistent container where agents,
  connections, routines, runs, reports and memory live; specify the dashboard UX and
  commit explanatory machine-readable schemas and examples.
- **UI verdict:** yes — architecture and behaviour are specified in Markdown; this run
  does not draw or implement the UI.

## Knowledge sources

| Source | What it says about this task | Fresh? | Authority |
|---|---|---|---|
| operator conversation, 2026-08-27 | projects are created first; every project contains its own agents; a portfolio observer is an ordinary project with broad scope | current | operator decision |
| `CONTEXT.md` | currently defines a project as time-bounded work under a goal, while ADR-0010 already makes projects the top-level organisational unit | 2026-08-26 | glossary; contradicted by the new operator decision |
| `docs/vision.md` | CEO → projects is the product shape, but its detailed ontology still places projects under goals | 2026-08-26 | vision; partially stale |
| `docs/adr/0003-*` | assets outlive work and must not be collapsed into projects | current | accepted decision; retained |
| `docs/adr/0010-*` | CEO decomposes first into projects; each project has one manager and its own agents | current | accepted decision; strengthened by this change |
| `docs/adr/0012-*` and `fabric-agent-contract` `0.1.0` | external agents are attached through a versioned compatibility/admission/binding boundary | 2026-08-26 | accepted contract |
| `docs/architecture/{agent-family,agent-composition,work-producing-agents}.md` | defines roles, capability bundles, work graphs and findings but lacks the persistent project/container model | 2026-08-26 | architecture intent; propagation target |
| `docs/evidence/retro.md` | no standing instructions and no prior error entry for this class | 2026-08-27 | binding run history |
| code and database migrations | no application code or domain migrations exist yet; only `supabase/config.toml` is present | current | implementation evidence |

**Contradictions:** the operator's decision reverses the `Goal → Project` hierarchy in
`CONTEXT.md` and the original brief. ADR-0010 already says `CEO → Project`, so the old
documents disagree with each other as well as with the new decision. The new ADR is the
single resolution; old ADRs remain append-only.

## Scope

### In scope

- Persistent Project ontology and the new `Estate → Project → Goal/Routine → Graph → Run`
  hierarchy.
- Exactly one Product Manager per project; other agents are seeded by templates and may
  be added, replaced or removed.
- Estate-level account connections, project-scoped bindings and agent-scoped grants.
- Deterministic connectors/collectors separated from agents that analyse observations.
- A portfolio-observer project as an ordinary project with cross-project read scope and a
  proposal seam into target projects.
- Project memory isolation and explicit promotion/cross-project transfer.
- Dashboard information architecture, flows, screen/state registry and scenarios.
- JSON Schemas for the project blueprint, dashboard read model and cross-project proposal,
  plus representative examples.
- Versioning, replacement and rollback rules for project configuration.

### Out of scope

- Database migrations, API implementation, collectors, orchestrator runtime or UI code.
- OAuth application setup and live Cloudflare/Google account connection.
- Figma frames or visual identity decisions; Markdown is the requested artifact.
- Live compatibility admission for third-party agents.
- Migrating existing stored data: no project rows exist yet.

## Requirement spine

| ID | Requirement | Verification | Status |
|---|---|---|---|
| PW-REQ-001 | Project is the persistent top-level workspace under an estate; goals and routines live inside it | ADR, glossary and vision agree under doc search | verified |
| PW-REQ-002 | Every project has one PM; templates seed optional agents, and a software developer is not mandatory for observer projects | architecture cardinality diagram + JSON Schema | verified |
| PW-REQ-003 | Connections are estate-level secret references reused through project bindings and narrowed through agent grants | architecture spec + schema fields; secret-value grep is empty | verified |
| PW-REQ-004 | Connectors collect deterministic observations once; agents analyse snapshots and do not own OAuth ingestion | data-flow diagram + component responsibilities | verified |
| PW-REQ-005 | Portfolio Observer is an ordinary project, not a parallel system layer; it can target selected or all current/future projects | example validates structurally; scenario covers dynamic scope | verified |
| PW-REQ-006 | Cross-project effects travel as proposals to the target PM unless a specific grant authorises more | schema and scenario error/approval path | verified |
| PW-REQ-007 | Routines own schedules; runs pin routine, agent binding and configuration revisions | schema + lifecycle diagram | verified |
| PW-REQ-008 | Project and estate dashboards expose status, agents, active work, run history, next runs, connections, reports and attention items | flows/screens/scenarios trace all requested surfaces | verified |
| PW-REQ-009 | Project memory is isolated; global or target-project promotion is explicit, evidence-backed and auditable | architecture memory diagram + scenario | verified |
| PW-REQ-010 | Machine-readable schemas and representative observer/product examples are committed and parse without errors | `python3 scripts/check-project-schemas.py` exit 0 | verified |
| PW-REQ-011 | UX chain follows the project's scenario contract and passes its linter | super-ux `ux_lint.py` exit 0 | verified |
| PW-REQ-012 | All affected intent docs are updated in the same change and the coordination record names what landed | doc search, `agent_sync.py record`, reconcile and finish | built — merge/finish pending |

The spine is frozen. Appending is allowed; removing or narrowing a row requires an
explicit operator decision in the carry-over ledger.

## Locked decisions

| Decision | Result |
|---|---|
| Primary organisational object | persistent Project workspace |
| Project hierarchy | Estate → Project → goals/routines → graph → nodes/runs |
| Global actor | one CEO per estate, outside project work graphs |
| Mandatory project actor | exactly one Product Manager |
| Other agents | template-seeded and optional; attach from the Fabric-compatible registry |
| Account ownership | estate-level Connection; projects receive resource-scoped bindings |
| Schedule ownership | Routine, not Agent |
| Portfolio observer | normal project with broad target scope |
| Cross-project writes | Proposal to target PM by default; direct effect needs a grant |
| Collection boundary | connector collects; agent interprets |
| UI artifact this run | Markdown foundation, flows, screens and scenarios; no Figma |
| Schemas | explanatory JSON Schema Draft 2020-12 plus checked examples; not a claim of implemented storage |

## Autonomy and delivery

| Area | Decision |
|---|---|
| Model | current model; model selection remains agent/provider-owned |
| Run mode | no configured loop mode; continue autonomously through this confirmed documentation scope |
| Coordination | git lease `PROJECT-WORKSPACE-MODEL`, branch `feat/project-workspace-model` |
| Decision ID | reserved `ADR-0013` |
| Escalation | stop for scope expansion, external publication or destructive replacement; reversible repository documentation is authorised |
| Integration | commit on branch, validate, then land through `agent_sync.py merge --push` |
| Deploy | none |
| Acceptance | operator requested the commit; pipeline evidence and a clean pushed repository close the run |

## Done

- A future contributor can answer “what is a project?”, “where does an account live?”,
  “what owns a schedule?” and “how does a portfolio observer affect another project?”
  from one architecture document and the matching schemas.
- Both project examples, the dashboard projection and the proposal artifact parse and
  satisfy the local schema consistency checker.
- Every requested dashboard surface is represented in flows, screens and scenarios.
- No document still asserts the old hierarchy as current without pointing to ADR-0013.

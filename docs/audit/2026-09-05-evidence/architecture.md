# Архитектурный аудит Fabric — 2026-09-05

Снимок `844c7a3c787d3f1bc87703a548e6099fc546a880`. Read-only. Проверены 33 ADR, 12 архитектурных документов, 3 схемы и 4 примера, 15 миграций и швы с двумя связанными репозиториями.

Основной вывод: архитектура описана существенно дальше кода; это допустимый план. Риски возникают там, где shipped-механизм не исполняет уже принятую гарантию или документ называет один контракт, а код использует другой.

## Находки по швам

### ARCH-01 · P1 · Shipped authority writes bypass the journal projection transaction

**Шов:** L1→L5 / journal→authority. Grant/effect state is neither atomically produced nor replayable. A failure after the event but before the row gives a durable claim without the represented state; the grant id is generated only after its event and cannot be recovered from that event.

Доказательства:
- [0014-the-event-journal-is-the-spine-and-every-register-is-a-projection.md:22](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/adr/0014-the-event-journal-is-the-spine-and-every-register-is-a-projection.md#L22) — Every state change is an event; every register is rebuildable without identity changes.
- [iteration-1-modules.md:76](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/architecture/iteration-1-modules.md#L76) — Append and synchronous projections are one transaction.
- [policy.ts:79](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/apps/desktop/src/main/policy.ts#L79) — grant.issued append followed by direct grants insert, with no grant id in event.
- [policy.ts:188](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/apps/desktop/src/main/policy.ts#L188) — effect append, effect_intents insert, grants update, consumed append are separate calls.
- [20260903000015_authority_plane.sql:19](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/supabase/migrations/20260903000015_authority_plane.sql#L19) — Only registers event types; no authority projector.
- [backlog.md:519](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/evidence/backlog.md#L519) — M137/M138/M139 marked shipped.

**Проверка:** Static direct call-chain confirmed; live concurrency probe delegated to core audit.

**Исправление:** Move grant creation, consumption and effect receipt projections behind the append transaction. Mint stable ids before append. Use an effect intent/attempt/observed-outcome state machine for the filesystem boundary; recording an effect cannot itself make filesystem writes atomic with Postgres. Reconcile crash/unknown outcomes explicitly.

**Приёмка:** Planted failures before/after each write leave one coherent state; journal-only rebuild preserves grant/effect ids and consumption; concurrent attempts cannot spend one grant twice.

**Существующий план:** M137, M138, M139, M3, ADR-0014, ADR-0027, ADR-0028.

### ARCH-02 · P1 · Projection rebuild is not idempotent and the equality test omits the drifting fields

**Шов:** L5→L6 / projection→replay. Every replay increments config_revision again; project.created does not reset status/configuration metadata. Rebuild can invent revisions or retain corruption while reporting success.

Доказательства:
- [20260831000005_agent_surface.sql:151](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/supabase/migrations/20260831000005_agent_surface.sql#L151) — Latest rebuild implementation only replays all events over current tables.
- [20260901000014_supersede_guard.sql:48](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/supabase/migrations/20260901000014_supersede_guard.sql#L48) — project.created conflict update does not reset config_revision/status; subsequent updates increment revision.
- [20260901000014_supersede_guard.sql:58](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/supabase/migrations/20260901000014_supersede_guard.sql#L58) — config_revision = config_revision + 1 on each replay.
- [planted.test.mjs:699](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/packages/schema/test/planted.test.mjs#L699) — P5 compares only id/name/status/repo_path and memory id/claim.
- [iteration-1-modules.md:90](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/architecture/iteration-1-modules.md#L90) — Every projector promises rebuild() == current.

**Проверка:** Static proof and deficient P5 assertion inspected; live SQL verification requested from core.

**Исправление:** Make projection application deterministic from journal identity/sequence; rebuild into a clean or correctly reset generation while preserving references, and define orphan handling. Verify all projection columns, not selected examples.

**Приёмка:** On representative data compare complete logical rowsets before/after two rebuilds; plant corrupted config_revision/status/primary repo/validity data; restore original rows and identities; no extra journal facts created.

**Существующий план:** M1, ADR-0014, ADR-0027.

### ARCH-03 · P1-before-slice3 · The canonical NodeResult facade cannot satisfy the exact contract it claims to implement

**Шов:** L2→L3 / host→normative contract. A runner built from the canonical module specification will produce envelopes rejected by Fabric Agent Contract. This is an implementation blocker for slice 3, not evidence that the presently unbuilt SDK runner is malfunctioning.

Доказательства:
- [iteration-1-modules.md:423](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/architecture/iteration-1-modules.md#L423) — Says aligned with contract 0.1.0, then done/scope/notVerified strings and extra costUsdEstimate.
- [0012-agent-compatibility-is-an-external-versioned-contract.md:14](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/adr/0012-agent-compatibility-is-an-external-versioned-contract.md#L14) — Normative external repository; exact revision; do not copy schemas.
- [result.schema.json:6](https://github.com/passioncode-ai/fabric-agent-contract/blob/489737051828fafec92463df04b6a6fd3280c7b7/schemas/result.schema.json#L6) — Requires id/contractVersion/outcome/createdAt/producer in addition to four proof fields.
- [result.schema.json:12](https://github.com/passioncode-ai/fabric-agent-contract/blob/489737051828fafec92463df04b6a6fd3280c7b7/schemas/result.schema.json#L12) — done is array; scope object at 40; notVerified array at 52; additionalProperties false at 69.

**Проверка:** Executed Draft202012 validation against git show 489737051828fafec92463df04b6a6fd3280c7b7: 9 violations including three wrong field types.

**Исправление:** Consume one machine-readable exact revision and derive/import result types. Either use the normative envelope directly or define and test an explicit internal-to-external translator; put local cost metadata outside the closed envelope. Synchronize the documentation in the same change.

**Приёмка:** The documented NodeResult example and a real runner result pass the pinned conformance validator; missing proof scope and extra top-level cost field fail; no copied parallel envelope survives.

**Существующий план:** M6, M17, M32, M34, CO-074, ADR-0012.

### ARCH-04 · P2 · Project blueprint validation accepts impossible manager and capability bindings

**Шов:** L3→L6 / schema→semantic gate. The explanatory schema suite prints a green boundary verdict for two active PMs, a retired sole PM, and a routine requesting a capability absent from its selected provider binding. Future consumers cannot rely on the advertised project-boundary fixture coverage.

Доказательства:
- [check-project-schemas.py:73](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/scripts/check-project-schemas.py#L73) — Only checks selected manager id resolves, not total active PM count/status.
- [check-project-schemas.py:85](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/scripts/check-project-schemas.py#L85) — Only checks preferred agent exists, not whether it can serve capability.
- [project-blueprint.schema.json:69](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/schemas/project-blueprint.schema.json#L69) — Generic agentBinding array does not enforce manager cardinality.
- [verification.md:15](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/evidence/verification.md#L15) — PW-REQ-002 claims manager-resolution verification.

**Проверка:** Executed checker in temporary copy for each planted mutation: each returned exit 0 and OK: 3 schemas and 4 examples are valid; 4 invalid boundary probes were rejected.

**Исправление:** Add semantic project validation for exactly one enabled manager and valid routine/binding capability relation, including disabled/retired eligibility. Name fallback policy explicitly if capability selection may legitimately change.

**Приёмка:** All three isolated mutated examples below fail; current examples pass. Add negative fixtures for duplicate PM, retired PM, unknown/unbound capability and disabled routine selection, without duplicating the normative provider schema.

**Существующий план:** PW-REQ-002, PW-REQ-007, M32, M35, ADR-0012, ADR-0013.

### ARCH-05 · P2 · The implemented MCP session profile and the canonical protocol pin describe different protocols

**Шов:** L2→L5 / protocol→implementation. The local server depends on initialize and mcp-session-id, while all current architecture points to stateless MCP 2026-07-28. A client following the canonical pin is refused as uninitialized. Blind SDK upgrading would also invalidate the security rationale of the one-use credential handshake.

Доказательства:
- [mcp-control-surface.md:4](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/architecture/mcp-control-surface.md#L4) — Protocol pin MCP 2026-07-28.
- [adopted-doctrine.md:185](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/architecture/adopted-doctrine.md#L185) — server/discover replaces initialize and per-request metadata is the declared doctrine.
- [agentSurface.ts:255](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/apps/desktop/src/main/agentSurface.ts#L255) — Stateful StreamableHTTP transport; session id generated.
- [agentSurface.ts:267](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/apps/desktop/src/main/agentSurface.ts#L267) — Requests without initialized session refused.
- [package.json:22](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/apps/desktop/package.json#L22) — SDK ^1.30.0.
- [backlog.md:86](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/evidence/backlog.md#L86) — M15 labels the locally served half southbound, despite its Fabric-server direction.

**Проверка:** Installed SDK exports latest 2025-11-25 and supports no 2026 revision. Official 2026 specification and Tasks overview fetched 2026-09-05 confirm stateless/per-request capabilities.

**Исправление:** Record a supported-protocol matrix separating the current loopback session profile from the planned northbound 2026 profile. State the compatibility and auth transition explicitly. If upgrading, redesign the credential binding for stateless requests before replacing the handshake.

**Приёмка:** Contract tests cover one supported legacy client and one 2026 client or give the latter an explicit unsupported-version outcome; docs and SDK-supported version set match; replay/revocation/credential-scope fixtures survive the transition.

**Существующий план:** M15, M34, CO-074, ADR-0026.

### ARCH-06 · P2 · Canonical navigation and delivery state contradict the implemented project

**Шов:** L4↔L5 / status→implemented surface. Readers cannot determine what exists, and obsolete open decisions can be reopened while unfinished clauses marked shipped disappear from the plan.

Доказательства:
- [README.md:51](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/README.md#L51) — Says database/dashboard/runtime are not implemented.
- [README.md:75](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/README.md#L75) — 32 ADRs vs measured 33.
- [README.md:96](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/README.md#L96) — Verification ledger called empty despite populated rows.
- [mcp-control-surface.md:5](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/architecture/mcp-control-surface.md#L5) — Says no server implemented.
- [2026-08-16-software-fabric-carryover.md:12](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/evidence/specs/2026-08-16-software-fabric-carryover.md#L12) — CO-001 shell choice remains open although ADR-0031 chooses Electron.
- [federation.md:180](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/architecture/federation.md#L180) — v1 table says partitioned journal; ADR-0027 and same document line26 defer it.
- [backlog.md:163](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/evidence/backlog.md#L163) — M48 includes tiered fact reads yet is shipped; current facts search has no tier.
- [agentSurface.ts:490](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/apps/desktop/src/main/agentSurface.ts#L490) — Fact search returns flat claim rows; tier selector is absent.

**Проверка:** Re-derived via filesystem: 33 ADRs, 12 architecture markdown files, 15 migrations; verification rows present. Status contradictions verified at cited lines.

**Исправление:** Update entry-point current-state paragraphs and resolve superseded CO rows by referencing their deciding ADRs. Split partial milestone acceptance from the original scope; preserve unfinished tiered-fact work as a counted extension of M48. Generate counts from canonical registries and add a small status drift gate for mechanical claims.

**Приёмка:** Measured counts print next to claims; README reflects current desktop/database/local MCP versus planned runtime; CO-001 resolves to ADR-0031; M48 has an explicit outstanding clause or evidence proving it shipped; no future work is labelled runtime merely because design exists.

**Существующий план:** CO-001, M16, M48, M15, M117, ADR-0031.

### ARCH-07 · P2-before-board · Task has three meanings and no accepted mapping to the future work lifecycle

**Шов:** L1→L2 / Task→Run ontology. The current PTY request is promised to become a Run with the same id; the planned board task instead persists through planning, sessions and work history. Implementing board and runner separately risks assigning incompatible lifecycle/cardinality semantics to one id.

Доказательства:
- [CONTEXT.md:233](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/CONTEXT.md#L233) — Task on its own is explicitly forbidden; no Task definition.
- [20260831000004_tasks.sql:4](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/supabase/migrations/20260831000004_tasks.sql#L4) — Task = instruction plus session; promises to become a Run retaining identity.
- [0030-a-run-is-one-execution-of-one-graph.md:17](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/adr/0030-a-run-is-one-execution-of-one-graph.md#L17) — Run is one graph execution; terminal state immutable.
- [backlog.md:193](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/evidence/backlog.md#L193) — M54 task detail owns multiple sessions and commits.
- [backlog.md:485](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/evidence/backlog.md#L485) — M122 board becomes canonical task state.
- [backlog.md:537](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/evidence/backlog.md#L537) — M143 task has brief, append-only notes, transitions and effects.

**Проверка:** Cross-document contradiction directly observed; no choice made during this read-only audit.

**Исправление:** Decide and document the work-item, execution Run, graph Node, terminal Session, and MCP Task mapping before new schema or screen work. Name cardinalities and state transitions; specify migration of existing project_tasks ids and receipt links. A task-to-many-runs model is a candidate, not a silently adopted decision.

**Приёмка:** One planned task can undergo the accepted retry/continuation flow without mutating a terminal Run or losing old session/transcript history; all screen states and APIs trace to the same enum and entity definition.

**Существующий план:** M54, M79, M122, M123, M124, M143, ADR-0030.

### ARCH-08 · P2 · Withdrawal of the old external provider was applied to one section but not its dependent architecture

**Шов:** L0→L2 / scope change→dependencies. The foundry bootstrap still requires a product explicitly removed from this estate on 2026-09-03; active sections still assert code ownership and integration with it. Following the plan would reintroduce the withdrawn dependency.

Доказательства:
- [work-producing-agents.md:72](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/architecture/work-producing-agents.md#L72) — Operator removed a side project from estate scope 2026-09-03.
- [work-producing-agents.md:87](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/architecture/work-producing-agents.md#L87) — Still says Fabric consumes that provider.
- [work-producing-agents.md:112](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/architecture/work-producing-agents.md#L112) — Still says we own its code.
- [agent-production.md:145](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/architecture/agent-production.md#L145) — Still first measured external provider.
- [agent-production.md:181](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/architecture/agent-production.md#L181) — Still bootstrap product #4.
- [README.md:88](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/README.md#L88) — Still claims the example is current.

**Проверка:** Scope-change and remaining instructions read directly; historical registry measurements are not treated as bugs by themselves.

**Исправление:** Propagate withdrawal through active dependency/bootstrapping sections and scope notes, retaining historical measurements as explicitly historical. Choose a current authorized sample provider when the foreign-provider milestone opens; do not silently substitute another product.

**Приёмка:** Scope search returns the withdrawn name only in dated historical evidence or explicit exclusions; M37 bootstrap has a runnable named current consumer/provider or an explicit prerequisite.

**Существующий план:** M37, CO-051, ADR-0029.

### ARCH-09 · P1 · Transcript decoding changes what was displayed while the raw evidence is discarded

**Шов:** L2→L5 / transcript→durable evidence. The primary session memory can contain text never displayed (backspace/cursor writes) or omit text that remained visible. A checksum of the transformed text does not restore the source that was deleted.

Доказательства:
- [0032-project-memory-is-verbatim-first-and-built-not-adopted.md:30](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/adr/0032-project-memory-is-verbatim-first-and-built-not-adopted.md#L30) — Primary durable memory is whole verbatim transcript.
- [transcripts.ts:9](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/apps/desktop/src/main/transcripts.ts#L9) — Claims deterministic transport decode identical to what operator saw; raw not retained.
- [transcripts.ts:83](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/apps/desktop/src/main/transcripts.ts#L83) — Regex strips cursor movement and backspace; last CR segment replaces full line.
- [transcripts.test.mjs:33](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/apps/desktop/test/transcripts.test.mjs#L33) — Tests equal-length progress repaint only.

**Проверка:** Executed direct imports of production decodePty: inputs yielded XY, abcX, abcX respectively. Source preservation and decoder mismatch are proven; impact on real captured Claude UI traces not quantified.

**Исправление:** Preserve primary input/output evidence with explicit capture semantics; use a real terminal-state decoder for display-derived text or a structured runner transcript. Keep searchable decoded text as a derived projection, mark truncation/loss modes, and version decoder semantics. Decide retention of raw bytes without silently claiming full losslessness.

**Приёмка:** Fixture abc\rXY renders XYc; abc\bX renders abX; abc\x1b[2DX renders aXc; actual terminal repaint traces retain the required source. Tests fail when control handling is replaced with stripping; prior capture limitations remain visible.

**Существующий план:** M45, ADR-0032, CO-081, CO-082.

### ARCH-10 · P2 · The detailed module design is not an as-built map for the components already shipped

**Шов:** L2→L5 / storage and policy facade. Memory is described as content-addressed Storage but persists full body in both journal JSON and a SQL text projection. The promised signature-compatible policy port instead has allow/refuse, no returned receiptSeq, and no autonomy/accessCeiling inputs. These are material integration and capacity differences, not reasons to implement the entire future architecture now.

Доказательства:
- [iteration-1-modules.md:175](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/architecture/iteration-1-modules.md#L175) — Says transcripts whole/content-addressed in Storage.
- [federation.md:83](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/architecture/federation.md#L83) — Session transcript Storage row.
- [index.ts:302](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/apps/desktop/src/main/index.ts#L302) — Appends full transcript body into journal payload.
- [20260901000014_supersede_guard.sql:135](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/supabase/migrations/20260901000014_supersede_guard.sql#L135) — Projects full transcript body into session_transcripts.
- [iteration-1-modules.md:100](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/architecture/iteration-1-modules.md#L100) — Promises signature-compatible decide with allow/deny/indeterminate and receiptSeq.
- [policy.ts:27](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/apps/desktop/src/main/policy.ts#L27) — Actual EffectRequest has caller-supplied floorClass; Decision is allow/refuse without receipt identity.

**Проверка:** Only packages/schema and packages/journal exist. Policy/memory/runner are currently app-main modules; direct code and migration read verified data path.

**Исправление:** Add explicit as-built/diet mapping to canonical module sections with current code homes and APIs, and keep future ports separately versioned. Either adapt Policy to the promised port now or remove the compatibility claim and record its bounded migration task. Document current SQL transcript storage and its backup/retention implications; Storage adoption needs the existing artifact-store gate.

**Приёмка:** An API fixture compiles against declared policy signature and checks receipt identity and indeterminate behavior; inventory states exactly which data is SQL versus blob Storage and proves journal→projection relation; no directory/package diagram implies packages that do not exist.

**Существующий план:** M137, M45, CO-054, CO-081, CO-082, ADR-0023, ADR-0032.

## По каждому модулю

| Модуль | Код сейчас | Оценка | План / находки |
|---|---|---|---|
| schema | packages/schema + supabase/migrations | Implemented substrate; 15 migrations, planted suite; generated Database types absent despite design. | M1/M3; ARCH-01, ARCH-02, ARCH-04 |
| journal | packages/journal/src/index.ts | Implemented append and finite replay; projection registry/subscription API described but absent; SQL handles projection dispatch. | M1; ARCH-01, ARCH-02 |
| policy | apps/desktop/src/main/policy.ts | Implemented floor helper for forced-save, not full autonomy/minimum PARC port. | M3/M137–M140; ARCH-01, ARCH-10 |
| runner | apps/desktop/src/main/pty.ts + sessionBundle.ts | Interactive local PTY/session credentials implemented; SDK worker and formal result runtime planned. | M6/M16/M17/M33; ARCH-03, ARCH-05, ARCH-09 |
| work | apps/desktop/src/main/index.ts + project_tasks projection | Thin instruction/session task lifecycle; nodes/chains/routines/queue/durable engine planned. | M2/M6/M14/M79/M122; ARCH-07 |
| memory | apps/desktop/src/main/transcripts.ts + contextPack.ts + agentSurface.ts | Implemented project FTS/facts/transcripts/retrieval log/context lockfile; storage and tier facade do not match all claims. | M44–M49; ARCH-06, ARCH-09, ARCH-10 |
| connectors | no runtime package; docs/architecture/external-contracts.md | Intentionally slice4 design: Google OAuth, Cloudflare quotas, scheduler and watermarks must be resolved before unattended collection. | M4/M9/M11/M12/M13/CO-004/014/043/057/063; новых дефектов не установлено |
| proposals | schemas/proposal.schema.json (explanatory) | Intentionally slice4 design; target PM routing accepted, resolution-store ownership CO-051 open; withdrawn sample still in bootstrap. | M20/M37/CO-035/051; ARCH-08 |
| desktop | apps/desktop/src/main + preload + shared/types + renderer | 14 main modules, centralized IPC/control-plane; all DB access remains main-side. UX/core lanes audit concrete screen and failure behavior. | M16/M42–M145; ARCH-05, ARCH-06, ARCH-07 |
| external-contract | $HOME/DATA/fabric-agent-contract | 13 schemas at exact host pin 489737...; current HEAD differs but schema diff host→adapter pin is empty; changed docs alone do not prove wire incompatibility. | ADR-0012/M32/M34; ARCH-03 |
| external-adapter | $HOME/DATA/fabric-agent-adapter | Public installer version 0.3.1, exact contract pin 20a818...; no runtime dependency from fabric yet; template/admission lifecycle remains separate. | ADR-0019/M37; новых дефектов не установлено |

## Все 33 решения

| ADR | Статус исполнения | Оценка и существующий план |
|---|---|---|
| [ADR-0001](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/adr/0001-the-fabric-owns-the-portfolio-layer-and-writes-to-nothing-else.md) | implemented-boundary | The operator's personal-assistant system/Linear remain outside product; no dependency found in runtime. M1.  |
| [ADR-0002](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/adr/0002-declared-data-is-mirrored-to-git-observed-data-is-not.md) | partial-with-explicit-diet | Supabase exists; declared git mirror remains slice-3 deferred. No automatic demand to build mirror in this audit. M1/CO-054.  |
| [ADR-0003](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/adr/0003-an-asset-is-not-a-project.md) | partial/superseded-hierarchy | Asset≠project retained; Goal→Project hierarchy superseded by ADR-0013. Assets table still future, project repositories exist. M1.  |
| [ADR-0004](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/adr/0004-autonomy-is-a-goal-field-standing-on-a-floor-in-the-schema.md) | partial-defective | Goal autonomy and floor table exist; effect enforcement and authority persistence incomplete. M3/M137–M140. ARCH-01, ARCH-10 |
| [ADR-0005](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/adr/0005-a-rebuilt-graph-is-a-new-version-not-a-mutation.md) | planned | Immutable graphs/typed edges decided; graph runtime is slice3+; no shipped-graph claim. M2.  |
| [ADR-0006](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/adr/0006-the-fabric-collects-google-data-itself.md) | planned | Independent Google collection deliberately accepted; OAuth and pagination/watermark probes must precede collector rollout. M9/CO-004/CO-014.  |
| [ADR-0007](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/adr/0007-the-fabric-answers-by-default-and-escalation-is-the-exception.md) | planned | Autonomy-derived answers and escalation awaiting work runtime; floor cannot be delegated silently. M14/M140/CO-016/CO-025.  |
| [ADR-0008](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/adr/0008-the-fabric-is-standalone-and-the-terminal-runs-inside-it.md) | partial | Hosted PTY works; CEO monitoring and formal nodes remain future. Standalone choice is justified by recorded operator decision. M16/M17. ARCH-09 |
| [ADR-0009](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/adr/0009-the-development-pipeline-is-data-the-operator-can-edit.md) | planned | Versioned editable pipeline/skills not implemented; remain M18/CO-026. M18/CO-026.  |
| [ADR-0010](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/adr/0010-the-unit-of-organisation-is-the-project-not-the-department.md) | partial | Project-oriented UI/data built; manager role renamed by ADR-0012; exactly-one PM admission future. M35. ARCH-04 |
| [ADR-0011](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/adr/0011-the-fabric-is-an-estate-tool-and-the-product-branch-is-a-named-seam.md) | superseded | Scope choice explicitly superseded by ADR-0016/0018; keep old record unchanged. ADR-0016/0018.  |
| [ADR-0012](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/adr/0012-agent-compatibility-is-an-external-versioned-contract.md) | external-contract-built/host-planned | Normative repo and adapter exist; host binding/admission not yet; copied NodeResult facade drifts. M32/M34. ARCH-03, ARCH-04 |
| [ADR-0013](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/adr/0013-project-is-a-persistent-agent-workspace.md) | partial | Persistent project/repositories/settings/memory implemented; connections/routines/bindings remain slice3+. M1/M35. ARCH-02, ARCH-07 |
| [ADR-0014](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/adr/0014-the-event-journal-is-the-spine-and-every-register-is-a-projection.md) | partial-defective | Journal spine broadly followed but authority code adds direct nonreplayable writes. M1/M137. ARCH-01, ARCH-02 |
| [ADR-0015](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/adr/0015-agent-production-is-a-pipeline-over-an-ordinary-project.md) | planned | Foundry as ordinary-project pipeline not implemented; adapter starter exists externally; withdrawn provider still bootstrap requirement. M37/CO-055/CO-056. ARCH-08 |
| [ADR-0016](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/adr/0016-the-fabric-is-a-platform-of-estates.md) | partial | Estate/actor schema exists; app runtime intentionally org1 only. Members/federation deferred. M38–M41/CO-069/071.  |
| [ADR-0017](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/adr/0017-the-federation-seam-slots-delegation-and-the-artifact-aperture.md) | planned | A2A aperture, interaction points, delegation not shipped; privacy/vault/identity gates named. M39–M41/CO-070/072/073.  |
| [ADR-0018](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/adr/0018-passioncode-is-the-product-fabric-is-the-kernel.md) | accepted-direction | Product/kernel distinction recorded and repository boundaries available; not a guarantee of independent kernel packaging today. ADR-0018.  |
| [ADR-0019](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/adr/0019-agent-onboarding-is-a-bootstrap-and-admission-lifecycle.md) | external-tool-partial | External adapter scaffolds; product recipe generator, auth, admission and canary remain planned. M37/M34.  |
| [ADR-0020](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/adr/0020-provider-views-are-sandboxed-extensions-and-layout-is-host-owned.md) | planned | Only host tier0 widgets currently; provider sandbox/views/fallback not claimed shipped. M15/iteration3.  |
| [ADR-0021](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/adr/0021-execution-placement-is-declared-per-provider-binding.md) | partial | Local desktop only; placement-per-binding is future with actual binding runtime. No undeclared hosted fallback seen. M40/CO-074.  |
| [ADR-0022](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/adr/0022-durable-execution-is-an-adapter-over-the-event-journal.md) | explicitly-deferred | Durable engine behind port intentionally deferred CO-083; live-process wait is documented interim; no bug merely from missing Temporal. CO-083/M6.  |
| [ADR-0023](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/adr/0023-policy-is-an-embedded-decision-port-that-never-grants-on-uncertainty.md) | partial-incompatible | Floor helper implemented; full policy port/evaluator still future. Current facade is not signature compatible as module design promises. M137/M140. ARCH-01, ARCH-10 |
| [ADR-0024](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/adr/0024-v1-workspaces-use-a-constrained-responsive-grid.md) | partial | Host grid tier0 exists; immutable layout revisions/admitted spans/provider fallback still future. UX lane assesses concrete layout. iteration3/CO-076.  |
| [ADR-0025](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/adr/0025-the-commercial-unit-is-an-estate-subscription-with-managed-continuity-and-agent-credits.md) | internal-design | Estate subscription/continuity/credits accepted internal direction; billing/pricing not implemented. CO-075/CO-080.  |
| [ADR-0026](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/adr/0026-fabric-exposes-a-project-scoped-policy-enforced-mcp-control-surface.md) | partial-legacy-local-profile | Project-scoped loopback server exists; external principal binding/idempotent control commands remain M15; protocol profile undocumented. M15. ARCH-05, ARCH-06 |
| [ADR-0027](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/adr/0027-the-event-journal-orders-per-estate-and-replays-from-the-table.md) | partial-defective | Per-estate sequence, synchronous SQL and bounded lock retries implemented; rebuild fails full state equivalence. M1. ARCH-01, ARCH-02 |
| [ADR-0028](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/adr/0028-one-effects-algebra-and-the-floor-lives-in-the-schema.md) | partial | Floor schema and decision receipt ordering present; minimum composition not supplied by current helper. Future effects need complete vocabulary. M3/M137–M140/CO-059. ARCH-01, ARCH-10 |
| [ADR-0029](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/adr/0029-a-proposal-terminates-at-the-target-product-manager.md) | planned-with-residue | Target PM decision propagated in main routing diagram; old CEO and withdrawn provider prose remain. M20/CO-035/CO-051. ARCH-08 |
| [ADR-0030](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/adr/0030-a-run-is-one-execution-of-one-graph.md) | planned-conflicting-task-evolution | Run grain accepted; current project_tasks promises identity-preserving conversion while new board has persistent-work grain. M79/M122/M143. ARCH-07 |
| [ADR-0031](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/adr/0031-the-v1-surface-is-a-macos-desktop-app-with-the-terminal-inside.md) | implemented-shell/partial-runtime | Electron+React+xterm/node-pty workspace exists. UtilityProcess SDK runners remain slice3. CO-001 should close. M16/M17/CO-001. ARCH-06 |
| [ADR-0032](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/adr/0032-project-memory-is-verbatim-first-and-built-not-adopted.md) | partial-defective-evidence | Transcripts, FTS, provenance, validity, context packs exist; lossy PTY decode and mismatched storage/tier claims remain. M45–M49. ARCH-06, ARCH-09, ARCH-10 |
| [ADR-0033](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/adr/0033-the-public-category-is-the-shift-from-vibe-coding-to-passion-coding.md) | accepted-public-direction | Brand/category alignment is explicitly direction, not runtime guarantees; implementation-state paragraphs drift. public-launch. ARCH-06 |

## Все архитектурные документы

| Документ | Назначение | Проверка |
|---|---|---|
| [adopted-doctrine.md](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/architecture/adopted-doctrine.md) (200 строк) | Contract of evidence, governance, observability, skills | Doctrine claims MCP2026; code legacy. Full scores/checkers still planned. |
| [agent-composition.md](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/architecture/agent-composition.md) (377 строк) | Design proposal with explicit supersession notes | Capability/binding/transport boundaries sensible; old user tier wording survives outside historical table, and bundle-in-worktree differs from actual private session bundle. |
| [agent-family.md](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/architecture/agent-family.md) (245 строк) | 19-role candidate catalogue, future sequencing | No absence of optional agents counted as bug; external publication/account identity prerequisites remain CO-036/038. |
| [agent-production.md](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/architecture/agent-production.md) (222 строк) | Ordinary-project foundry, M37 | Foundry depends on M32/M34; withdrawn provider still bootstrap dependency. |
| [external-contracts.md](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/architecture/external-contracts.md) (269 строк) | Dated external requirements and unresolved vendor assumptions | MCP source rechecked; all vendor quotas and SDK options not independently revalidated. Treat as dated evidence until relevant rollout. |
| [federation.md](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/architecture/federation.md) (192 строк) | Explicit future design/tenant and aperture model | Org1-first prevents overbuilding; partitioning/storage table contradictions. |
| [iteration-1-modules.md](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/architecture/iteration-1-modules.md) (467 строк) | Current next-slice module design and diet | Main source for seam audit; as-built packages/APIs/storage not consistently distinguished. |
| [iterations.md](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/architecture/iterations.md) (83 строк) | Canonical sequence and gated horizons | Future work has explicit return triggers; unfinished slices are planned work, not defects. |
| [mcp-control-surface.md](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/architecture/mcp-control-surface.md) (213 строк) | Canonical northbound future contract | Good scope/revocation/idempotency failure matrix; local server status/profile contradiction. |
| [passioncode-platform.md](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/architecture/passioncode-platform.md) (425 строк) | Six-plane architecture and operating loop | Clear project/kernel and per-binding placement; broad statements are direction, not proof of runtime. |
| [project-workspaces.md](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/architecture/project-workspaces.md) (232 строк) | Project ownership/revisions/routines/connections, explanatory schemas | Useful shape and failure boundaries; project semantic gate incomplete. |
| [work-producing-agents.md](https://github.com/passioncode-ai/fabric/blob/844c7a3c787d3f1bc87703a548e6099fc546a880/docs/architecture/work-producing-agents.md) (180 строк) | Observations/proposals route to target PM | Decision correct; CEO and withdrawn-provider paragraphs not fully reconciled. |

## План с зависимостями

1. **Recoverable authority and deterministic projections** — ARCH-01, ARCH-02. Зависит от: можно начать независимо. Extend M137–M139 and M1; align core-security results before implementation.

2. **Preserve transcript evidence and truthfully document capture/storage** — ARCH-09, ARCH-10. Зависит от: можно начать независимо. Extend M45; retention/storage decision CO-054/081/082.

3. **Reconcile current capability/status matrix and enforce schema semantics** — ARCH-04, ARCH-06, ARCH-08. Зависит от: можно начать независимо. Existing docs/registers under lease; no duplicate decision registry.

4. **Freeze compatible Task/Run and result/policy ports before board/runtime** — ARCH-03, ARCH-07, ARCH-10. Зависит от: ARCH-01, ARCH-02. M6/M17/M79/M122/M143 and normative contract.

5. **Declare MCP compatibility/security transition then external admission** — ARCH-05. Зависит от: ARCH-03, ARCH-10. M15/M34/CO-074; preserve credential-revocation fixtures.

6. **Continue existing iteration ladder after observed org1 closed loop** — существующие milestones. Зависит от: ARCH-01, ARCH-02, ARCH-03, ARCH-07. Slices3–6; then M38–M41. No advanced horizon pull-forward.

## Измерения и границы

- **exact-pinned NodeResult validation**: 9 contract violations at revision 489737051828fafec92463df04b6a6fd3280c7b7; string done/scope/notVerified invalid; 5 required top-level fields absent; costUsdEstimate forbidden.

- **false-green blueprint semantic validation**: Two PMs, retired PM, and unbound routine capability separately injected into temporary copy; all 3 checker executions exit0 with unchanged green output.

- **production PTY decoder**: abc\rXY -> XY; abc\bX -> abcX; abc\u001b[2DX -> abcX.

- **count re-derivation**: README says 32 ADRs; filename inventory and ADR index contain 33; 12 architecture docs; 15 SQL migrations; workspace packages journal/schema only.

- **MCP external source check**: Official 2026-07-28 spec confirms stateless/per-request negotiation; Tasks overview confirms server/discover. Installed SDK1.30 latest protocol 2025-11-25.

- Core/security agent owns live SQL/permission/race and full test execution; ARCH-01/02 need their live evidence merged.

- UX agent owns all screen/mockup/screenshot/a11y checks; ADR24 assessment here is architectural only.

- Full historic vendor quotas, licensing, price measurements and scientific memory benchmarks were not independently reproduced. Claude SDK source URL fetch failed due tool content-length limit.

- No provider admission runtime or cross-estate hosted deployment exists to execute those future-path guarantees. Their absence is recorded as planned scope, not a failing runtime.

- No real transcript corpus loss-rate or storage growth benchmark measured; decoder counterexamples are exact but prevalence is unknown.

- Linked contract and adapter reviewed for pin/schema/interface relation, not full standalone repository/security audits.

- Dated derived HTML snapshots explicitly marked historical were not treated as current architecture claims.

Первичные внешние источники: [MCP 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28), [Tasks](https://modelcontextprotocol.io/extensions/tasks/overview), прочитаны 2026-09-05.

Использован метод task-pipeline/references/audit.md; запись является входом для общего отчёта, а не правкой реестров проекта.

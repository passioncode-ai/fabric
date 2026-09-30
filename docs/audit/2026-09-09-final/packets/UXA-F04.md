# UXA-F04 — Receipt-first run detail and independent project health

[Общий контекст](../COMMON.md) · [План](../index.md#plan)


### id
UXA-F04

### title
Receipt-first run detail and independent project health

### priority
strategic

### existing_owners
- M5
- M65
- M188
- M186
- S13

### scenarios
- SCN-006
- SCN-007
- SCN-008

### files
- apps/desktop/src/shared/taskRun.ts
- apps/desktop/src/main/index.ts
- apps/desktop/src/renderer/src/TaskPage.tsx
- apps/desktop/src/renderer/src/EstateHome.tsx
- apps/desktop/src/shared/entityRef.ts

### context
TaskRun core exists, but task page does not expose pinned revisions, typed result/checker/artifacts/recovery preview. Cards are storage/live-session summaries.

### solution
Publish supported observations independently and create run-detail projection keyed by immutable TaskRun identity; distinguish WorkflowRun and verification checkpoint.

### substeps
- Specify run identity and available historical revision fields with migration strategy.
- Expose done/proof/scope/notVerified/checker and partial artifacts, plus known missing evidence.
- Implement permitted recovery preview/retry as new admission and explicit cancellation state.
- Attach each card health dimension to observation+timestamp and exact destination.

### dependencies
- M188 remaining lineage/WorkflowRun contracts per capability
- UXA-C02 source envelopes
- S03 authority

### acceptance_and_negative_tests
- Old run is immutable after retry/rebinding; cancellation requested is not cancelled until observed.
- Partial artifact survives failure; missing checker does not read verified.
- One unavailable health source leaves other dimensions usable; not-configured differs from failed.

### exclusions
Do not promise full WorkflowRun graph from existing TaskRun table; do not invent composite health score.

### unknowns
Which revision snapshots already durable must be measured before additive schema design.

### disposition
proposed-remediation-not-implemented

### source_commit
d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d

### evidence_level
source-trace; production incidence not measured

### owner
M5, M65, M188, M186, S13

### context_files
- apps/desktop/src/shared/taskRun.ts
- apps/desktop/src/main/index.ts
- apps/desktop/src/renderer/src/TaskPage.tsx
- apps/desktop/src/renderer/src/EstateHome.tsx
- apps/desktop/src/shared/entityRef.ts

### solution_steps
- Specify run identity and available historical revision fields with migration strategy.
- Expose done/proof/scope/notVerified/checker and partial artifacts, plus known missing evidence.
- Implement permitted recovery preview/retry as new admission and explicit cancellation state.
- Attach each card health dimension to observation+timestamp and exact destination.

### positive_acceptance
- Old run is immutable after retry/rebinding; cancellation requested is not cancelled until observed.
- Partial artifact survives failure; missing checker does not read verified.
- One unavailable health source leaves other dimensions usable; not-configured differs from failed.

### negative_acceptance
- Old run is immutable after retry/rebinding; cancellation requested is not cancelled until observed.
- Partial artifact survives failure; missing checker does not read verified.
- One unavailable health source leaves other dimensions usable; not-configured differs from failed.

### execution_dependencies
- FA-02
- UX28-02

### dependency_rule
These IDs order the corrective implementation only. Preserve canonical and external gates in dependencies/depends_on; contract/fixture work may start earlier. No automatic activation from this graph.

## Исходники исследованной ревизии



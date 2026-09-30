# UXA-F01 — Capability bindings, replacement, and starter activation

[Общий контекст](../COMMON.md) · [План](../index.md#plan)


### id
UXA-F01

### title
Capability bindings, replacement, and starter activation

### priority
strategic

### existing_owners
- M32
- M34
- M35
- M17
- M66

### scenarios
- SCN-001
- SCN-002
- SCN-003
- SCN-004
- SCN-009

### files
- apps/desktop/src/main/index.ts
- apps/desktop/src/main/pty.ts
- apps/desktop/src/main/routineTick.ts
- apps/desktop/src/renderer/src/Onboarding.tsx
- apps/desktop/src/renderer/src/ProjectHome.tsx
- supabase/migrations
- docs/architecture/agent-production.md

### context
Current agents are runner configurations; project creation has no PM starter. Provider admission and project binding are distinct durable acts.

### solution
Build exact-revision admission/binding command and one-for-one PM replacement before richer starter UX; derive starter review from same commands.

### substeps
- Inventory existing schema/contracts and M17/M125 to avoid duplicate agent entities.
- Pin manifest/capability/effect ceilings and admission revision; fail before access on missing gate.
- Commit replacement against expected configuration revision; keep past TaskRuns immutable and routine identity/trigger unchanged.
- Implement provider-selection gate table and affected-routine review; activate starter atomically or retain recoverable draft.

### dependencies
- M34 admission probe
- M32 capability vocabulary
- M188 run lineage
- S09 authenticated owner for multi-user authority

### acceptance_and_negative_tests
- Unadmitted/new revision cannot inherit admission; grant above project ceiling refused.
- Two concurrent PM swaps preserve exactly one PM; old active run pins old revision; next tick uses successor.
- Cancellation before activation creates no configured project; failed transaction preserves all draft fields.

### exclusions
Do not reopen M17 launcher delivery; do not invent second real runner or capability vocabulary.

### unknowns
Named consumer/provider revision and initial supported capabilities required before implementation.

### disposition
proposed-remediation-not-implemented

### source_commit
d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d

### evidence_level
source-trace; production incidence not measured

### owner
M32, M34, M35, M17, M66

### context_files
- apps/desktop/src/main/index.ts
- apps/desktop/src/main/pty.ts
- apps/desktop/src/main/routineTick.ts
- apps/desktop/src/renderer/src/Onboarding.tsx
- apps/desktop/src/renderer/src/ProjectHome.tsx
- supabase/migrations
- docs/architecture/agent-production.md

### solution_steps
- Inventory existing schema/contracts and M17/M125 to avoid duplicate agent entities.
- Pin manifest/capability/effect ceilings and admission revision; fail before access on missing gate.
- Commit replacement against expected configuration revision; keep past TaskRuns immutable and routine identity/trigger unchanged.
- Implement provider-selection gate table and affected-routine review; activate starter atomically or retain recoverable draft.

### positive_acceptance
- Unadmitted/new revision cannot inherit admission; grant above project ceiling refused.
- Two concurrent PM swaps preserve exactly one PM; old active run pins old revision; next tick uses successor.
- Cancellation before activation creates no configured project; failed transaction preserves all draft fields.

### negative_acceptance
- Unadmitted/new revision cannot inherit admission; grant above project ceiling refused.
- Two concurrent PM swaps preserve exactly one PM; old active run pins old revision; next tick uses successor.
- Cancellation before activation creates no configured project; failed transaction preserves all draft fields.

### execution_dependencies
- FA-02

### dependency_rule
These IDs order the corrective implementation only. Preserve canonical and external gates in dependencies/depends_on; contract/fixture work may start earlier. No automatic activation from this graph.

## Исходники исследованной ревизии



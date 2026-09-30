# UXA-F06 — Reviewed estate memory promotion and target transfer

[Общий контекст](../COMMON.md) · [План](../index.md#plan)


### id
UXA-F06

### title
Reviewed estate memory promotion and target transfer

### priority
strategic

### existing_owners
- CO-081
- M135
- M182
- M154

### scenarios
- SCN-012

### files
- apps/desktop/src/shared/memoryContract.ts
- apps/desktop/src/renderer/src/TaskPage.tsx
- apps/desktop/src/renderer/src/ProjectHome.tsx
- apps/desktop/src/main/commands
- supabase/migrations

### context
Local note promotion exists and must remain distinct from cross-project/estate authority.

### solution
Append destination-owned reviewed record with immutable provenance/backlink; target transfer pending until acceptance.

### substeps
- Specify confidence, provenance, source reachability, expiry/decay and contradiction fields.
- Add promotion command/checker and target acceptance transaction without source mutation.
- Implement review UI and supersession lineage.

### dependencies
- UXA-F03 cross-project target authority
- S09 owner identity for estate-level promotion

### acceptance_and_negative_tests
- Missing evidence/confidence blocks promotion; conflicting knowledge requires explicit supersession.
- Refusal retains source; duplicate command does not duplicate promoted record.
- Source agent cannot directly mutate destination memory.

### exclusions
Do not add second local memory store or rebuild shipped M135 transparency.

### unknowns
Confidence/decay policy and who accepts estate knowledge need explicit product decision.

### disposition
proposed-remediation-not-implemented

### source_commit
d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d

### evidence_level
source-trace; production incidence not measured

### owner
CO-081, M135, M182, M154

### context_files
- apps/desktop/src/shared/memoryContract.ts
- apps/desktop/src/renderer/src/TaskPage.tsx
- apps/desktop/src/renderer/src/ProjectHome.tsx
- apps/desktop/src/main/commands
- supabase/migrations

### solution_steps
- Specify confidence, provenance, source reachability, expiry/decay and contradiction fields.
- Add promotion command/checker and target acceptance transaction without source mutation.
- Implement review UI and supersession lineage.

### positive_acceptance
- Missing evidence/confidence blocks promotion; conflicting knowledge requires explicit supersession.
- Refusal retains source; duplicate command does not duplicate promoted record.
- Source agent cannot directly mutate destination memory.

### negative_acceptance
- Missing evidence/confidence blocks promotion; conflicting knowledge requires explicit supersession.
- Refusal retains source; duplicate command does not duplicate promoted record.
- Source agent cannot directly mutate destination memory.

### execution_dependencies
- UXA-F03

### dependency_rule
These IDs order the corrective implementation only. Preserve canonical and external gates in dependencies/depends_on; contract/fixture work may start earlier. No automatic activation from this graph.

## Исходники исследованной ревизии



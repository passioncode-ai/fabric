# UXA-F03 — Observer evidence and cross-project proposal authority

[Общий контекст](../COMMON.md) · [План](../index.md#plan)


### id
UXA-F03

### title
Observer evidence and cross-project proposal authority

### priority
strategic

### existing_owners
- M20
- M129
- M4
- M9

### scenarios
- SCN-002
- SCN-007
- SCN-010
- SCN-011
- SCN-020

### files
- apps/desktop/src/main/commands/proposalCommands.ts
- apps/desktop/src/shared/proposals.ts
- apps/desktop/src/shared/attention.ts
- apps/desktop/src/main/agentSurface.ts
- supabase/migrations
- docs/ux/flows.md

### context
Current proposals only restart loop-bound work in same project. No cross-project evidence/routing contract is carried.

### solution
Add explicit source/target observation envelope and target PM resolution contract; reuse atomic decision machinery without conflating proposal kinds.

### substeps
- Select first observer source and owning-project route.
- Define read visibility vs effect authority and dynamic scope confirmation.
- Submit immutable evidence/freshness/idempotency envelope without target graph write.
- Resolve accept/refuse/supersede under target authority; acceptance asks target PM to create work, preserving source links.
- Render both project views and stale/missing-target recovery.

### dependencies
- UXA-F01 capability bindings
- UXA-F02 first connector
- M188 graph/task lineage

### acceptance_and_negative_tests
- Duplicate same key returns same proposal; conflicting reuse refused.
- Source cannot directly write target tasks/memory; stale evidence blocks decision.
- Concurrent target decisions create at most one work request; supersession preserves history.

### exclusions
No separate replacement for M168; no auto-creation of target goals by source agent.

### unknowns
First live observation provider and retired-project routing policy must be named.

### disposition
proposed-remediation-not-implemented

### source_commit
d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d

### evidence_level
source-trace; production incidence not measured

### owner
M20, M129, M4, M9

### context_files
- apps/desktop/src/main/commands/proposalCommands.ts
- apps/desktop/src/shared/proposals.ts
- apps/desktop/src/shared/attention.ts
- apps/desktop/src/main/agentSurface.ts
- supabase/migrations
- docs/ux/flows.md

### solution_steps
- Select first observer source and owning-project route.
- Define read visibility vs effect authority and dynamic scope confirmation.
- Submit immutable evidence/freshness/idempotency envelope without target graph write.
- Resolve accept/refuse/supersede under target authority; acceptance asks target PM to create work, preserving source links.
- Render both project views and stale/missing-target recovery.

### positive_acceptance
- Duplicate same key returns same proposal; conflicting reuse refused.
- Source cannot directly write target tasks/memory; stale evidence blocks decision.
- Concurrent target decisions create at most one work request; supersession preserves history.

### negative_acceptance
- Duplicate same key returns same proposal; conflicting reuse refused.
- Source cannot directly write target tasks/memory; stale evidence blocks decision.
- Concurrent target decisions create at most one work request; supersession preserves history.

### execution_dependencies
- UXA-F01
- UXA-F02

### dependency_rule
These IDs order the corrective implementation only. Preserve canonical and external gates in dependencies/depends_on; contract/fixture work may start earlier. No automatic activation from this graph.

## Исходники исследованной ревизии



# UXA-C05 — Preserve unread session state through AgentsSection

[Общий контекст](../COMMON.md) · [План](../index.md#plan)


### id
UXA-C05

### title
Preserve unread session state through AgentsSection

### priority
P2

### existing_owners
- M108

### scenarios
- SCN-025

### files
- apps/desktop/src/renderer/src/ProjectHome.tsx

### context
Parent accepts sessions|null but passes sessions??[] into required-array AgentsSection; EmptyState read={sessions!==null} can never represent loading.

### solution
Keep null through boundary and render skeleton/loading until first read.

### substeps
- Change section prop contract to nullable.
- Remove early fallback; filter only after preserving unread state.
- Review affected count/empty copy and loader rejection branch.

### dependencies


### acceptance_and_negative_tests
- Hold terminal.list promise: reading shown, never no agents.
- Resolve []: actual empty state; reject: error/unknown not zero.

### exclusions
No new state framework; reuse existing EmptyState sentinel.

### unknowns
May overlap later-scenario audit; deduplicate with SCN-029/049 loading-state task.

### disposition
merged-evidence-subtask

### source_commit
d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d

### evidence_level
source-trace; production incidence not measured

### owner
M108

### context_files
- apps/desktop/src/renderer/src/ProjectHome.tsx

### solution_steps
- Change section prop contract to nullable.
- Remove early fallback; filter only after preserving unread state.
- Review affected count/empty copy and loader rejection branch.

### positive_acceptance
- Hold terminal.list promise: reading shown, never no agents.
- Resolve []: actual empty state; reject: error/unknown not zero.

### negative_acceptance
- Hold terminal.list promise: reading shown, never no agents.
- Resolve []: actual empty state; reject: error/unknown not zero.

### execution_dependencies


### dependency_rule
These IDs order the corrective implementation only. Preserve canonical and external gates in dependencies/depends_on; contract/fixture work may start earlier. No automatic activation from this graph.

### execution_owner
UX28-02

## Исходники исследованной ревизии



# UXA-F08 — Constrained provider-view workspace host

[Общий контекст](../COMMON.md) · [План](../index.md#plan)


### id
UXA-F08

### title
Constrained provider-view workspace host

### priority
strategic

### existing_owners
- M37
- CO-091

### scenarios
- SCN-018

### files
- apps/desktop/src/renderer/src/Workspace.tsx
- apps/desktop/src/shared/appRoute.ts
- apps/desktop/src/preload/index.ts
- docs/ux/scenarios.md
- docs/ux/flows.md

### context
Fixed current workspace does not prove extension isolation or layout publish.

### solution
Implement admitted structured fallback and bounded sandbox bridge before configurable role grid.

### substeps
- Specify allowed view/data/action protocol and deny ambient IPC.
- Build nonoverlap/span/reading-order validated layout revision.
- Preview narrow linearization, keyboard, unavailable/revoked/denied fallback.

### dependencies
- UXA-F05 admitted views
- UXA-F07 role permissions
- CO-091 bridge boundary

### acceptance_and_negative_tests
- Malicious provider cannot invoke ambient main IPC or broaden scope.
- Invalid span/overlap/focus order refuses publish without losing layout.
- Revoked extension preserves canonical evidence; keyboard+screen-reader walk and 200% reflow.

### exclusions
No unconstrained spatial canvas, drag-only editing or replacement canonical data.

### unknowns
Figma disabled; visual/browser keyboard verification must be newly performed when surface exists.

### disposition
proposed-remediation-not-implemented

### source_commit
d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d

### evidence_level
source-trace; production incidence not measured

### owner
M37, CO-091

### context_files
- apps/desktop/src/renderer/src/Workspace.tsx
- apps/desktop/src/shared/appRoute.ts
- apps/desktop/src/preload/index.ts
- docs/ux/scenarios.md
- docs/ux/flows.md

### solution_steps
- Specify allowed view/data/action protocol and deny ambient IPC.
- Build nonoverlap/span/reading-order validated layout revision.
- Preview narrow linearization, keyboard, unavailable/revoked/denied fallback.

### positive_acceptance
- Malicious provider cannot invoke ambient main IPC or broaden scope.
- Invalid span/overlap/focus order refuses publish without losing layout.
- Revoked extension preserves canonical evidence; keyboard+screen-reader walk and 200% reflow.

### negative_acceptance
- Malicious provider cannot invoke ambient main IPC or broaden scope.
- Invalid span/overlap/focus order refuses publish without losing layout.
- Revoked extension preserves canonical evidence; keyboard+screen-reader walk and 200% reflow.

### execution_dependencies
- UXA-F05
- UXA-F07

### dependency_rule
These IDs order the corrective implementation only. Preserve canonical and external gates in dependencies/depends_on; contract/fixture work may start earlier. No automatic activation from this graph.

## Исходники исследованной ревизии



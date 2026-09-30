# UXA-F11 — Complete per-runner permission interception and approval interaction

[Общий контекст](../COMMON.md) · [План](../index.md#plan)


### id
UXA-F11

### title
Complete per-runner permission interception and approval interaction

### priority
strategic

### existing_owners
- M140
- M155
- S03
- M152

### scenarios
- SCN-027

### files
- apps/desktop/src/main/agentSurface.ts
- apps/desktop/src/main/policy.ts
- apps/desktop/src/main/sessionBundle.ts
- apps/desktop/src/renderer/src/AttentionPanel.tsx
- apps/desktop/src/renderer/src/BoardPanel.tsx

### context
fabric_effect_request intercepts only voluntary requests; current docs correctly retain unverified per-runner hook boundary.

### solution
Implement verified hook for each admitted runner or expose capability as unsupported; use canonical question/grant lifecycle and separate commit/delivery/ack/effect outcome.

### substeps
- Measure runner hook support and unsafe bypass paths with concrete tools.
- Map intercepted requested operation→floor/action target without trusting agent-supplied authority.
- Render requested operation/autonomy/evidence, one-shot grant or refusal reason, timeout/expired state.
- Resume addressed run after separate admission/ack; handle indeterminate as explicit refusal diagnostics.

### dependencies
- Verified runner hook
- M152 continuation
- S03 effects lifecycle

### acceptance_and_negative_tests
- Runner skips fabric_effect_request and directly invokes floored tool: intercepted/refused before effect.
- Timeout and duplicate answer cannot double-resume; floor unknown fails closed.
- Grant issuance never displays executed, delivered never displays acknowledged.

### exclusions
No claim that unsupported runner is safe based on prompt instruction; no second question store.

### unknowns
Only known supported runner can be admitted to effect-bearing scope until hook proven.

### disposition
proposed-remediation-not-implemented

### source_commit
d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d

### evidence_level
source-trace; production incidence not measured

### owner
M140, M155, S03, M152

### context_files
- apps/desktop/src/main/agentSurface.ts
- apps/desktop/src/main/policy.ts
- apps/desktop/src/main/sessionBundle.ts
- apps/desktop/src/renderer/src/AttentionPanel.tsx
- apps/desktop/src/renderer/src/BoardPanel.tsx

### solution_steps
- Measure runner hook support and unsafe bypass paths with concrete tools.
- Map intercepted requested operation→floor/action target without trusting agent-supplied authority.
- Render requested operation/autonomy/evidence, one-shot grant or refusal reason, timeout/expired state.
- Resume addressed run after separate admission/ack; handle indeterminate as explicit refusal diagnostics.

### positive_acceptance
- Runner skips fabric_effect_request and directly invokes floored tool: intercepted/refused before effect.
- Timeout and duplicate answer cannot double-resume; floor unknown fails closed.
- Grant issuance never displays executed, delivered never displays acknowledged.

### negative_acceptance
- Runner skips fabric_effect_request and directly invokes floored tool: intercepted/refused before effect.
- Timeout and duplicate answer cannot double-resume; floor unknown fails closed.
- Grant issuance never displays executed, delivered never displays acknowledged.

### execution_dependencies


### dependency_rule
These IDs order the corrective implementation only. Preserve canonical and external gates in dependencies/depends_on; contract/fixture work may start earlier. No automatic activation from this graph.

## Исходники исследованной ревизии



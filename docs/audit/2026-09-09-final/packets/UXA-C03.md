# UXA-C03 — Render typed proposal decision refusal at the action

[Общий контекст](../COMMON.md) · [План](../index.md#plan)


### id
UXA-C03

### title
Render typed proposal decision refusal at the action

### priority
P1

### existing_owners
- M168
- M106

### scenarios
- SCN-011

### files
- apps/desktop/src/renderer/src/AttentionPanel.tsx
- apps/desktop/src/main/commands/proposalCommands.ts
- apps/desktop/src/shared/proposals.ts

### context
The command deliberately resolves {ok:false,rejection}; the only renderer caller uses .catch and discards resolved result. User sees no answer on checker unavailable/already decided.

### solution
Handle returned union, display says/remedy/retryability beside proposal, disable duplicate in-flight action and reload on committed result.

### substeps
- Add stable pending/error/result state keyed by proposal id.
- Handle ok:false without clearing evidence or draft.
- On success display receipt/task destination and refresh immediately.
- Use existing checker reason codes and translation contract.

### dependencies


### acceptance_and_negative_tests
- Mock fulfilled {ok:false} for checker_unavailable and already_decided: message rendered without unhandled rejection.
- Two clicks/windows produce one task; losing window shows existing decision/refusal, never silent success.
- Network rejection remains distinguishable from known refusal.

### exclusions
Do not rewrite core transaction or convert all typed refusals back to exceptions.

### unknowns
No independent runtime component reproduction yet; command/caller mismatch is statically certain.

### disposition
proposed-remediation-not-implemented

### source_commit
d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d

### evidence_level
source-trace; production incidence not measured

### owner
M168, M106

### context_files
- apps/desktop/src/renderer/src/AttentionPanel.tsx
- apps/desktop/src/main/commands/proposalCommands.ts
- apps/desktop/src/shared/proposals.ts

### solution_steps
- Add stable pending/error/result state keyed by proposal id.
- Handle ok:false without clearing evidence or draft.
- On success display receipt/task destination and refresh immediately.
- Use existing checker reason codes and translation contract.

### positive_acceptance
- Mock fulfilled {ok:false} for checker_unavailable and already_decided: message rendered without unhandled rejection.
- Two clicks/windows produce one task; losing window shows existing decision/refusal, never silent success.
- Network rejection remains distinguishable from known refusal.

### negative_acceptance
- Mock fulfilled {ok:false} for checker_unavailable and already_decided: message rendered without unhandled rejection.
- Two clicks/windows produce one task; losing window shows existing decision/refusal, never silent success.
- Network rejection remains distinguishable from known refusal.

### execution_dependencies


### dependency_rule
These IDs order the corrective implementation only. Preserve canonical and external gates in dependencies/depends_on; contract/fixture work may start earlier. No automatic activation from this graph.

## Исходники исследованной ревизии



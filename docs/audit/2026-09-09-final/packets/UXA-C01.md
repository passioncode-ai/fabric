# UXA-C01 — Use journal revision, not visible feed length, for home freshness

[Общий контекст](../COMMON.md) · [План](../index.md#plan)


### id
UXA-C01

### title
Use journal revision, not visible feed length, for home freshness

### priority
P1

### existing_owners
- M42
- M102

### scenarios
- SCN-006
- SCN-026

### files
- apps/desktop/src/renderer/src/App.tsx
- apps/desktop/src/renderer/src/EstateHome.tsx
- apps/desktop/src/renderer/src/BoardPanel.tsx

### context
App caps feed at 500; EstateHome attention effect and child BoardPanel watch length. From event 501 onward new obligations do not trigger refresh until remount.

### solution
Pass the existing monotonic feedMark through EstateHome and use event-aware invalidation; preserve display cap.

### substeps
- Trace all feed-length refresh consumers and distinguish display counts from revision signals.
- Add explicit feedMark prop to home and use it for attention/BoardPanel.
- Where M102 supplies per-source invalidation, share it rather than add a broad second poller.

### dependencies


### acceptance_and_negative_tests
- Mount with 500 events, add event 501 while count unchanged: Board and attention reload and render new obligation.
- Slow replay does not overlap; unknown/error does not become zero; no reload from unrelated event once invalidation is narrowed.

### exclusions
Do not remove cap or redo durable replay.

### unknowns
No runtime component test run in this audit; static dependency reproduction only.

### disposition
merged-evidence-subtask

### source_commit
d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d

### evidence_level
source-trace; production incidence not measured

### owner
M42, M102

### context_files
- apps/desktop/src/renderer/src/App.tsx
- apps/desktop/src/renderer/src/EstateHome.tsx
- apps/desktop/src/renderer/src/BoardPanel.tsx

### solution_steps
- Trace all feed-length refresh consumers and distinguish display counts from revision signals.
- Add explicit feedMark prop to home and use it for attention/BoardPanel.
- Where M102 supplies per-source invalidation, share it rather than add a broad second poller.

### positive_acceptance
- Mount with 500 events, add event 501 while count unchanged: Board and attention reload and render new obligation.
- Slow replay does not overlap; unknown/error does not become zero; no reload from unrelated event once invalidation is narrowed.

### negative_acceptance
- Mount with 500 events, add event 501 while count unchanged: Board and attention reload and render new obligation.
- Slow replay does not overlap; unknown/error does not become zero; no reload from unrelated event once invalidation is narrowed.

### execution_dependencies


### dependency_rule
These IDs order the corrective implementation only. Preserve canonical and external gates in dependencies/depends_on; contract/fixture work may start earlier. No automatic activation from this graph.

### execution_owner
UX28-02

## Исходники исследованной ревизии



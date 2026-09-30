# UXA-C06 — Reconcile terminal/feed UX contracts and add real receipt navigation

[Общий контекст](../COMMON.md) · [План](../index.md#plan)


### id
UXA-C06

### title
Reconcile terminal/feed UX contracts and add real receipt navigation

### priority
P2

### existing_owners
- S13
- M42
- M112

### scenarios
- SCN-025
- SCN-026

### files
- docs/ux/foundation.md
- docs/ux/flows.md
- docs/ux/screens.md
- docs/ux/scenarios.md
- apps/desktop/src/renderer/src/Feed.tsx
- apps/desktop/src/shared/entityRef.ts
- apps/desktop/src/renderer/src/App.tsx

### context
SCN-025 amended detached windows, ST-017/FLW-13 retain terminal tab. SCN-026 promises Realtime and per-row receipt links absent from Feed.

### solution
Keep canonical intended transport explicit: reconcile polling contract if intentionally accepted, or implement Realtime-as-wake without abandoning durable replay. Use canonical destinationOf for navigable event subjects, honest nonnavigable fallback.

### substeps
- Fix terminal successor chain without reviving retired SCR-23.
- Decide whether Realtime is a requirement or obsolete implementation wording; record acceptance.
- Map event→typed subject by registered event schemas, preserving seq/receipt.
- Add project filter and unread cursor only with explicit durable/persisted semantics; refresh route model/mockups.

### dependencies
- UXA-C01
- UXA-C02

### acceptance_and_negative_tests
- Every supported feed event opens exact subject/receipt; unknown/missing subject states unverified and does not invent task id.
- Restart/reconnect replay ordering tested against gaps and duplicate wakeups.
- FLW terminal chain names detached SCR-25 and remains traceable; linter no new errors.

### exclusions
Do not delete historical dated audit; Product unobserved and disabled Figma are not bugs.

### unknowns
Realtime wording is canonical drift requiring explicit choice, not permission to silently weaken user behavior.

### disposition
merged-evidence-subtask

### source_commit
d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d

### evidence_level
source-trace; production incidence not measured

### owner
S13, M42, M112

### context_files
- docs/ux/foundation.md
- docs/ux/flows.md
- docs/ux/screens.md
- docs/ux/scenarios.md
- apps/desktop/src/renderer/src/Feed.tsx
- apps/desktop/src/shared/entityRef.ts
- apps/desktop/src/renderer/src/App.tsx

### solution_steps
- Fix terminal successor chain without reviving retired SCR-23.
- Decide whether Realtime is a requirement or obsolete implementation wording; record acceptance.
- Map event→typed subject by registered event schemas, preserving seq/receipt.
- Add project filter and unread cursor only with explicit durable/persisted semantics; refresh route model/mockups.

### positive_acceptance
- Every supported feed event opens exact subject/receipt; unknown/missing subject states unverified and does not invent task id.
- Restart/reconnect replay ordering tested against gaps and duplicate wakeups.
- FLW terminal chain names detached SCR-25 and remains traceable; linter no new errors.

### negative_acceptance
- Every supported feed event opens exact subject/receipt; unknown/missing subject states unverified and does not invent task id.
- Restart/reconnect replay ordering tested against gaps and duplicate wakeups.
- FLW terminal chain names detached SCR-25 and remains traceable; linter no new errors.

### execution_dependencies
- UX28-02

### dependency_rule
These IDs order the corrective implementation only. Preserve canonical and external gates in dependencies/depends_on; contract/fixture work may start earlier. No automatic activation from this graph.

### execution_owner
UX28-06

## Исходники исследованной ревизии



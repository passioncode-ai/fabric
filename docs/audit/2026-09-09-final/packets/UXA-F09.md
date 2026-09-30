# UXA-F09 — Close one bounded operating loop at a time

[Общий контекст](../COMMON.md) · [План](../index.md#plan)


### id
UXA-F09

### title
Close one bounded operating loop at a time

### priority
strategic

### existing_owners
- M27
- CO-085
- M39
- M25
- M129
- M21
- M128
- CO-036
- S03.effects
- S08

### scenarios
- SCN-019
- SCN-020
- SCN-021

### files
- docs/architecture/iterations.md
- docs/ux/flows.md
- apps/desktop/src/main/commands
- apps/desktop/src/main/agentSurface.ts
- supabase/migrations

### context
Support, reliability and growth share evidence→checker→authorized effect→observed result; none exists end-to-end. They need distinct domain packets, not a universal speculative framework.

### solution
Plan three bounded child tasks: support single-channel intake/reply; production single-asset incident/recovery; content single-channel approved post/measurement. Use common authority/effect receipts.

### substeps
- Support: normalize/dedupe inbound, customer ambiguity and minimal role context, draft/send/reconcile delivery.
- Reliability: source receipt→target acceptance→reproduce/fix/check→release grant→monitor new observation; rollback new effect.
- Growth: sourced topic→accepted facts→draft→independent editorial/SEO/channel checks→one-shot grant→publication receipt→collector feedback.
- For each freeze named provider payload/effect idempotency and negative fixtures before live pilot.

### dependencies
- UXA-F02 named connectors
- UXA-F03 proposals
- UXA-F04 run result
- UXA-F07 role work where needed
- External credentials/budget/test resource

### acceptance_and_negative_tests
- Support duplicate event/ambiguous identity/failed delivery remain one honest request.
- Reliability checker rejection never advances, policy outage refuses release, monitor timeout remains unresolved.
- Growth stale evidence/absent public identity/expired grant blocks publish; lost API response reconciled before retry.

### exclusions
Do not implement unspecified channels; no paid live actions or standing publication grant inferred from plan.

### unknowns
CO-085 support channel, CO-086 crash source and CO-036 standing grant remain explicit gates; split these 3 child packets before execution.

### disposition
proposed-remediation-not-implemented

### source_commit
d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d

### evidence_level
source-trace; production incidence not measured

### owner
M27, CO-085, M39, M25, M129, M21, M128, CO-036, S03.effects, S08

### context_files
- docs/architecture/iterations.md
- docs/ux/flows.md
- apps/desktop/src/main/commands
- apps/desktop/src/main/agentSurface.ts
- supabase/migrations

### solution_steps
- Support: normalize/dedupe inbound, customer ambiguity and minimal role context, draft/send/reconcile delivery.
- Reliability: source receipt→target acceptance→reproduce/fix/check→release grant→monitor new observation; rollback new effect.
- Growth: sourced topic→accepted facts→draft→independent editorial/SEO/channel checks→one-shot grant→publication receipt→collector feedback.
- For each freeze named provider payload/effect idempotency and negative fixtures before live pilot.

### positive_acceptance
- Support duplicate event/ambiguous identity/failed delivery remain one honest request.
- Reliability checker rejection never advances, policy outage refuses release, monitor timeout remains unresolved.
- Growth stale evidence/absent public identity/expired grant blocks publish; lost API response reconciled before retry.

### negative_acceptance
- Support duplicate event/ambiguous identity/failed delivery remain one honest request.
- Reliability checker rejection never advances, policy outage refuses release, monitor timeout remains unresolved.
- Growth stale evidence/absent public identity/expired grant blocks publish; lost API response reconciled before retry.

### execution_dependencies
- UXA-F02
- UXA-F03
- UXA-F04
- UXA-F07

### dependency_rule
These IDs order the corrective implementation only. Preserve canonical and external gates in dependencies/depends_on; contract/fixture work may start earlier. No automatic activation from this graph.

## Исходники исследованной ревизии



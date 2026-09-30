# UXA-C02 — Keep partial attention and source freshness visible across all consumers

[Общий контекст](../COMMON.md) · [План](../index.md#plan)


### id
UXA-C02

### title
Keep partial attention and source freshness visible across all consumers

### priority
P1

### existing_owners
- S14
- M147
- M151
- M190

### scenarios
- SCN-006
- SCN-007
- SCN-026
- SCN-027

### files
- apps/desktop/src/main/index.ts
- apps/desktop/src/shared/types.ts
- apps/desktop/src/renderer/src/AttentionPanel.tsx
- apps/desktop/src/renderer/src/EstateHome.tsx
- apps/desktop/src/renderer/src/BoardPanel.tsx

### context
readAttentionWithSources measures failures and truncation; readAttention discards both. Panel can say clear after refused source read. EstateHome catch also clears badge. Board envelope is the stronger existing implementation.

### solution
Use one source-aware query contract for panel/home/board; preserve last data labeled stale; render unavailable source and capped history beside counts.

### substeps
- Map all attention.list consumers including notifier and source-appropriate error behavior.
- Return ReadEnvelope or reuse board obligation envelope without dropping failed/truncated data.
- Block clear/zero claims while relevant sources failed; retain accessible retry and data age.
- Ensure authored questions and derived obligations remain separate types and obligations cannot be marked read.

### dependencies
- UXA-C01

### acceptance_and_negative_tests
- Fail each source independently: unaffected rows survive; no false clear/zero; failed source named.
- 51 policy rows including older refusal show truncation or resolve complete outstanding set; one source outage does not hide other projects.
- Recover source: stale badge disappears and data refreshes.

### exclusions
Do not call generic polling stale evidence an authorization lease; do not invent unsupported production health.

### unknowns
Whether attention queue should derive unresolved policy obligations beyond fixed 50-event history needs explicit source contract; current truncation must be exposed immediately.

### disposition
merged-evidence-subtask

### source_commit
d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d

### evidence_level
source-trace; production incidence not measured

### owner
S14, M147, M151, M190

### context_files
- apps/desktop/src/main/index.ts
- apps/desktop/src/shared/types.ts
- apps/desktop/src/renderer/src/AttentionPanel.tsx
- apps/desktop/src/renderer/src/EstateHome.tsx
- apps/desktop/src/renderer/src/BoardPanel.tsx

### solution_steps
- Map all attention.list consumers including notifier and source-appropriate error behavior.
- Return ReadEnvelope or reuse board obligation envelope without dropping failed/truncated data.
- Block clear/zero claims while relevant sources failed; retain accessible retry and data age.
- Ensure authored questions and derived obligations remain separate types and obligations cannot be marked read.

### positive_acceptance
- Fail each source independently: unaffected rows survive; no false clear/zero; failed source named.
- 51 policy rows including older refusal show truncation or resolve complete outstanding set; one source outage does not hide other projects.
- Recover source: stale badge disappears and data refreshes.

### negative_acceptance
- Fail each source independently: unaffected rows survive; no false clear/zero; failed source named.
- 51 policy rows including older refusal show truncation or resolve complete outstanding set; one source outage does not hide other projects.
- Recover source: stale badge disappears and data refreshes.

### execution_dependencies


### dependency_rule
These IDs order the corrective implementation only. Preserve canonical and external gates in dependencies/depends_on; contract/fixture work may start earlier. No automatic activation from this graph.

### execution_owner
UX28-02

## Исходники исследованной ревизии



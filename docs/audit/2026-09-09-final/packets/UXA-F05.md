# UXA-F05 — Foundry host integration using existing adapter and contract

[Общий контекст](../COMMON.md) · [План](../index.md#plan)


### id
UXA-F05

### title
Foundry host integration using existing adapter and contract

### priority
strategic

### existing_owners
- M32
- M34
- M37

### scenarios
- SCN-004
- SCN-015
- SCN-016
- SCN-017

### files
- docs/architecture/agent-production.md
- apps/desktop/src/shared/appRoute.ts
- apps/desktop/src/main/index.ts
- $HOME/DATA/fabric-agent-adapter
- $HOME/DATA/fabric-agent-contract

### context
Adapter and normative contracts already exist outside desktop; generation is not admission.

### solution
Host recipe/report/conformance lifecycle with exact pins and author-reviewed minimal change plan; reuse CLI artifacts.

### substeps
- Read exact adapter/contract pins and existing fixture schemas.
- Create signed/checksummed/expiring recipe with no estate credentials; require dry run and review before writes.
- Receive local report with changed files/checksums; execute independent conformance on exact revision.
- Admit separately from project binding, canary and earned promotion.
- Recovery preserves report and user code; rollback only generated task-owned paths.

### dependencies
- UXA-F01 capability/admission primitives
- Pinned adapter/contract release

### acceptance_and_negative_tests
- Tampered/expired recipe stops before write; local pass cannot override failed independent conformance.
- Unchanged rerun is idempotent; changed checksum invalidates old receipt.
- Cleanup failure lists leftovers and never deletes user-owned edits.

### exclusions
Do not recreate scaffold, auto-admit from schema pass, or publish/update installed plugin during audit.

### unknowns
Host execution sandbox and report trust model remain design decisions; no current desktop implementation.

### disposition
proposed-remediation-not-implemented

### source_commit
d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d

### evidence_level
source-trace; production incidence not measured

### owner
M32, M34, M37

### context_files
- docs/architecture/agent-production.md
- apps/desktop/src/shared/appRoute.ts
- apps/desktop/src/main/index.ts
- $HOME/DATA/fabric-agent-adapter
- $HOME/DATA/fabric-agent-contract

### solution_steps
- Read exact adapter/contract pins and existing fixture schemas.
- Create signed/checksummed/expiring recipe with no estate credentials; require dry run and review before writes.
- Receive local report with changed files/checksums; execute independent conformance on exact revision.
- Admit separately from project binding, canary and earned promotion.
- Recovery preserves report and user code; rollback only generated task-owned paths.

### positive_acceptance
- Tampered/expired recipe stops before write; local pass cannot override failed independent conformance.
- Unchanged rerun is idempotent; changed checksum invalidates old receipt.
- Cleanup failure lists leftovers and never deletes user-owned edits.

### negative_acceptance
- Tampered/expired recipe stops before write; local pass cannot override failed independent conformance.
- Unchanged rerun is idempotent; changed checksum invalidates old receipt.
- Cleanup failure lists leftovers and never deletes user-owned edits.

### execution_dependencies
- UXA-F01

### dependency_rule
These IDs order the corrective implementation only. Preserve canonical and external gates in dependencies/depends_on; contract/fixture work may start earlier. No automatic activation from this graph.

## Исходники исследованной ревизии



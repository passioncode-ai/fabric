# UXA-F02 — Account/resource connection product

[Общий контекст](../COMMON.md) · [План](../index.md#plan)


### id
UXA-F02

### title
Account/resource connection product

### priority
strategic

### existing_owners
- M4
- M9
- M127

### scenarios
- SCN-005
- SCN-002

### files
- apps/desktop/src/shared/servers.ts
- apps/desktop/src/main/sessionBundle.ts
- apps/desktop/src/main/index.ts
- docs/ux/flows.md
- docs/architecture/external-contracts.md

### context
Gateway server grants are not account subject/resource authorization.

### solution
Implement estate connection plus versioned project resource binding through explicit OAuth/static-token port and existing gateway rule.

### substeps
- Choose one real provider/resource and document authoritative scopes.
- Model candidate subject confirmation, binding ceiling, selected resources/agents and expiry/health.
- Handle denial/expiry/wrong account without losing project draft.
- Keep secrets in approved custody; send only opaque refs and safe health to renderer.

### dependencies
- Named external service/account
- S03 effect authorization
- S09 identity for shared estates

### acceptance_and_negative_tests
- Wrong account stops discovery and candidate can be disconnected.
- No selected resource/agent refuses save; revoked resource makes only affected binding stale.
- Tokens absent from config/journal/UI and retry does not duplicate connections.

### exclusions
No blanket OAuth integration and no gateway rewrite.

### unknowns
Provider, account, custody and callback transport must be selected; no paid/effect calls during planning.

### disposition
proposed-remediation-not-implemented

### source_commit
d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d

### evidence_level
source-trace; production incidence not measured

### owner
M4, M9, M127

### context_files
- apps/desktop/src/shared/servers.ts
- apps/desktop/src/main/sessionBundle.ts
- apps/desktop/src/main/index.ts
- docs/ux/flows.md
- docs/architecture/external-contracts.md

### solution_steps
- Choose one real provider/resource and document authoritative scopes.
- Model candidate subject confirmation, binding ceiling, selected resources/agents and expiry/health.
- Handle denial/expiry/wrong account without losing project draft.
- Keep secrets in approved custody; send only opaque refs and safe health to renderer.

### positive_acceptance
- Wrong account stops discovery and candidate can be disconnected.
- No selected resource/agent refuses save; revoked resource makes only affected binding stale.
- Tokens absent from config/journal/UI and retry does not duplicate connections.

### negative_acceptance
- Wrong account stops discovery and candidate can be disconnected.
- No selected resource/agent refuses save; revoked resource makes only affected binding stale.
- Tokens absent from config/journal/UI and retry does not duplicate connections.

### execution_dependencies


### dependency_rule
These IDs order the corrective implementation only. Preserve canonical and external gates in dependencies/depends_on; contract/fixture work may start earlier. No automatic activation from this graph.

## Исходники исследованной ревизии



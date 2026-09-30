# UXA-F07 — Real membership and role interaction delivery

[Общий контекст](../COMMON.md) · [План](../index.md#plan)


### id
UXA-F07

### title
Real membership and role interaction delivery

### priority
strategic

### existing_owners
- M38
- M39
- S09
- M149
- M151
- M152

### scenarios
- SCN-013
- SCN-014

### files
- apps/desktop/src/shared/membership.ts
- apps/desktop/src/main/index.ts
- apps/desktop/src/renderer/src/BoardPanel.tsx
- supabase/migrations/20260909000052_membership_authority.sql
- docs/ux/flows.md

### context
Current application is service-role plus literal operator; S09 protects last owner but does not establish identity.

### solution
Authenticate at trusted ingress, use existing membership revision floor, implement invitation review and role queue with truthful v1 estate-wide visibility.

### substeps
- Choose identity and delivery transport; safe return intent after authentication.
- Bind intended invitation identity/revision/expiry and reject wrong identity/revocation.
- Acceptance/decline idempotent, renewed review on scope change; do not broaden into per-project ACL silently.
- Build role-aware interaction projection and response/effect authorization using current answer/continuation lifecycle.

### dependencies
- Real second user/test estate
- Identity provider and session custody
- S03 external effect port

### acceptance_and_negative_tests
- Two identities cannot access each other estate; revoked/changed membership rechecked at commit and clears private context.
- Last-owner floor survives service-role SQL and concurrent revocation.
- Lost response retries same acceptance/resolution; no duplicate external effect.

### exclusions
No demo login claiming security; no per-project ACL by renderer filter; no replacement approval queue.

### unknowns
Provider choice/transport and v1 estate-wide wording are activation prerequisites.

### disposition
proposed-remediation-not-implemented

### source_commit
d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d

### evidence_level
source-trace; production incidence not measured

### owner
M38, M39, S09, M149, M151, M152

### context_files
- apps/desktop/src/shared/membership.ts
- apps/desktop/src/main/index.ts
- apps/desktop/src/renderer/src/BoardPanel.tsx
- supabase/migrations/20260909000052_membership_authority.sql
- docs/ux/flows.md

### solution_steps
- Choose identity and delivery transport; safe return intent after authentication.
- Bind intended invitation identity/revision/expiry and reject wrong identity/revocation.
- Acceptance/decline idempotent, renewed review on scope change; do not broaden into per-project ACL silently.
- Build role-aware interaction projection and response/effect authorization using current answer/continuation lifecycle.

### positive_acceptance
- Two identities cannot access each other estate; revoked/changed membership rechecked at commit and clears private context.
- Last-owner floor survives service-role SQL and concurrent revocation.
- Lost response retries same acceptance/resolution; no duplicate external effect.

### negative_acceptance
- Two identities cannot access each other estate; revoked/changed membership rechecked at commit and clears private context.
- Last-owner floor survives service-role SQL and concurrent revocation.
- Lost response retries same acceptance/resolution; no duplicate external effect.

### execution_dependencies


### dependency_rule
These IDs order the corrective implementation only. Preserve canonical and external gates in dependencies/depends_on; contract/fixture work may start earlier. No automatic activation from this graph.

## Исходники исследованной ревизии



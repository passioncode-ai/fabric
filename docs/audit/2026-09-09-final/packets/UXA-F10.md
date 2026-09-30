# UXA-F10 — Northbound MCP binding lifecycle

[Общий контекст](../COMMON.md) · [План](../index.md#plan)


### id
UXA-F10

### title
Northbound MCP binding lifecycle

### priority
strategic

### existing_owners
- M15
- M188
- S03

### scenarios
- SCN-022
- SCN-023
- SCN-024

### files
- apps/desktop/src/main/agentSurface.ts
- apps/desktop/src/main/sessionBundle.ts
- apps/desktop/src/shared/servers.ts
- apps/desktop/src/main/commands
- docs/ux/flows.md

### context
Internal session surface is scoped, but external clients need estate-owned immutable expiring binding and owner lifecycle.

### solution
Extend transport using durable external binding/principal and typed control commands; preserve internal session credentials as distinct kind.

### substeps
- Issue explicit project-set/scopes/effect ceiling/expiry with one-time reveal and safe fingerprint.
- Filter discovery/resources before read; check binding scope/idempotency/policy at every command.
- Return durable command/artifact/TaskRun identity; negotiate MCP tasks only when supported.
- Rotate/revoke with audit lineage/cache invalidation and distinguish active-run cancellation.

### dependencies
- UXA-F07 owner identity
- M188 durable run controls
- S03 current authorization

### acceptance_and_negative_tests
- Future project excluded; spoofed projectId denied before read/mutation; lost secret rotates, never recovered.
- Duplicate same key yields same receipt; changed args refuse.
- Revocation stops new read/control but history remains, effect reauthorizes, cancel only reports observed state.

### exclusions
Do not distribute owner session or downstream credential; do not turn southbound session token into permanent access.

### unknowns
External endpoint deployment/auth mechanism and negotiated protocol version require explicit contract review.

### disposition
proposed-remediation-not-implemented

### source_commit
d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d

### evidence_level
source-trace; production incidence not measured

### owner
M15, M188, S03

### context_files
- apps/desktop/src/main/agentSurface.ts
- apps/desktop/src/main/sessionBundle.ts
- apps/desktop/src/shared/servers.ts
- apps/desktop/src/main/commands
- docs/ux/flows.md

### solution_steps
- Issue explicit project-set/scopes/effect ceiling/expiry with one-time reveal and safe fingerprint.
- Filter discovery/resources before read; check binding scope/idempotency/policy at every command.
- Return durable command/artifact/TaskRun identity; negotiate MCP tasks only when supported.
- Rotate/revoke with audit lineage/cache invalidation and distinguish active-run cancellation.

### positive_acceptance
- Future project excluded; spoofed projectId denied before read/mutation; lost secret rotates, never recovered.
- Duplicate same key yields same receipt; changed args refuse.
- Revocation stops new read/control but history remains, effect reauthorizes, cancel only reports observed state.

### negative_acceptance
- Future project excluded; spoofed projectId denied before read/mutation; lost secret rotates, never recovered.
- Duplicate same key yields same receipt; changed args refuse.
- Revocation stops new read/control but history remains, effect reauthorizes, cancel only reports observed state.

### execution_dependencies
- UXA-F07
- FA-02

### dependency_rule
These IDs order the corrective implementation only. Preserve canonical and external gates in dependencies/depends_on; contract/fixture work may start earlier. No automatic activation from this graph.

## Исходники исследованной ревизии



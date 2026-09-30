# UXA-C04 — Recover terminal metadata loading and name launch cwd

[Общий контекст](../COMMON.md) · [План](../index.md#plan)


### id
UXA-C04

### title
Recover terminal metadata loading and name launch cwd

### priority
P2

### existing_owners
- M16
- M17
- M106

### scenarios
- SCN-025

### files
- apps/desktop/src/renderer/src/SessionWindow.tsx
- apps/desktop/src/renderer/src/ProjectHome.tsx
- apps/desktop/src/main/index.ts
- apps/desktop/src/main/pty.ts

### context
SessionWindow catches initial get only; onExit/poll get reject without handler. Once initial error set, later successful get never clears it. Launcher hides cwd although main resolves it.

### solution
Use one cancellable metadata loader for initial/poll/exit/retry with last-known stale state; show effective cwd before launch and explicit ended/missing state.

### substeps
- Factor loader with request generation/alive guard and finally state.
- Clear recoverable error after successful load; retain terminal view/scrollback on refresh error.
- Expose effective cwd preflight including absent-repo behavior; surface SpawnFailure program/cwd.
- Compare get snapshot versus stream subscription timing and add cursor/replay handshake only if loss demonstrated.

### dependencies


### acceptance_and_negative_tests
- Initial read fails then succeeds: window becomes usable without recreation.
- Poll/onExit failure renders recoverable stale state and no unhandled rejection.
- Spawn invalid cwd/program: no terminal.opened; success close/reopen yields same PTY and transcript.
- Continuous output during attach contains no lost/duplicated byte range, tested against real PTY.

### exclusions
Do not claim live PTY test passed from static code. Do not change unsupported runner permission semantics.

### unknowns
Snapshot→subscribe gap may drop bytes; needs deterministic real PTY race test before classification as observed defect.

### disposition
proposed-remediation-not-implemented

### source_commit
d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d

### evidence_level
source-trace; production incidence not measured

### owner
M16, M17, M106

### context_files
- apps/desktop/src/renderer/src/SessionWindow.tsx
- apps/desktop/src/renderer/src/ProjectHome.tsx
- apps/desktop/src/main/index.ts
- apps/desktop/src/main/pty.ts

### solution_steps
- Factor loader with request generation/alive guard and finally state.
- Clear recoverable error after successful load; retain terminal view/scrollback on refresh error.
- Expose effective cwd preflight including absent-repo behavior; surface SpawnFailure program/cwd.
- Compare get snapshot versus stream subscription timing and add cursor/replay handshake only if loss demonstrated.

### positive_acceptance
- Initial read fails then succeeds: window becomes usable without recreation.
- Poll/onExit failure renders recoverable stale state and no unhandled rejection.
- Spawn invalid cwd/program: no terminal.opened; success close/reopen yields same PTY and transcript.
- Continuous output during attach contains no lost/duplicated byte range, tested against real PTY.

### negative_acceptance
- Initial read fails then succeeds: window becomes usable without recreation.
- Poll/onExit failure renders recoverable stale state and no unhandled rejection.
- Spawn invalid cwd/program: no terminal.opened; success close/reopen yields same PTY and transcript.
- Continuous output during attach contains no lost/duplicated byte range, tested against real PTY.

### execution_dependencies


### dependency_rule
These IDs order the corrective implementation only. Preserve canonical and external gates in dependencies/depends_on; contract/fixture work may start earlier. No automatic activation from this graph.

## Исходники исследованной ревизии



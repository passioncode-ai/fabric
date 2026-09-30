# ADR-0063 — CEO-first discovery and explicit execution continuation

**Status:** accepted target direction · 2026-09-25. Native implementation remains unverified.
**Source:** operator's explicit 2026-09-25 request: configure CEO and base executor before selecting a folder; no manual project naming/review; agents can be stopped and continued in an existing or fresh same/different-provider session.
**Refines:** ADR-0061 entry order for the default first-launch path, without changing its separation of persistence and managed activation.
**Retains:** Project-owned purpose/history, independent PM admission, explicit authority, exact command identity, saved work without a live executor, and provider interchangeability.

## Context

At source [473ba9a](https://github.com/passioncode-ai/fabric/tree/473ba9a4d3ba3250c6d41e7e0007b2ece256533c), `scripts/product/guided.mjs` and `new-project.mjs` required typed source/name/purpose and an explicit review before creation. That sequence asks an operator to reconstruct facts the project already contains. `apps/desktop/src/shared/agents.ts` distinguishes an integrated executor from a plain terminal; installed CLI alone does not prove readiness.

## Decision

1. Estate-level Fabric setup uses an immediately usable name/avatar. A selected provider is replaceable and must pass required capability/authentication checks before an agent observation; this does not automatically activate every project's PM or developer.
2. Local paths are selected using the host directory chooser everywhere. A URL is a separate input. Cancellation retains the previous selection. An inaccessible directory has an explicit recovery. Parent-directory discovery proposes candidates; it does not silently import every child.
3. The default local entry is CEO → ready executor → directory selection → bounded observation → sourced overview. Directory selection starts the declared read operation. Naming, guessed purpose and technical validation are not separate operator gates. The directory supplies the initial name; interpretation of purpose is a hypothesis until accepted. Saving an idea and reading existing work remain possible without an executor.
4. Observation does not execute repository instructions, change files, pull Git, grant permissions or upload everything in a selected directory. Reading scope, exclusions, provider data transfer and exact observations are explicit in the native contract. Missing observations are unknown, never clean results.
5. Stop is an independent user command. A request, observed exit, timeout/unknown and forced termination are separate states. The old writer must be known stopped before replacement; closing a terminal view is not stop. Context is assembled from saved records and the worktree even when the old agent cannot summarise.
6. Continuation offers provider-native resume where certified, a fresh session using the same provider, or a fresh session using another verified provider. New runs link predecessor and context snapshot; branch/HEAD/worktree/uncommitted changes and unknown effects are reconciled before execution. A completed accepted task is not silently reopened.
7. The first-release design is a dedicated, connected `r0-*` slice in the existing report. Historical screens/ideas remain reachable in the full catalogue. Fixture transitions never certify native readiness, STT, file access or process termination.

## Propagation and acceptance

Canonical behaviour: SCN-095/096, FLW-55/56 and affected existing entries in [scenarios](../ux/scenarios.md), [flows](../ux/flows.md), [screens](../ux/screens.md). The [strategy and bounded native packets](../launch/first-release-strategy.md) assign user/CEO/executor ownership and retain earlier AD packets. The [iteration handoff](../launch/first-release.md) records checks and limitations. No ontology, authority floor or schema migration is changed by this target iteration.

Pure prototype transitions are checked by `node --test scripts/test/first-release.test.mjs scripts/test/folder-picker.test.mjs`; browser observations have their own receipt. Native checks must demonstrate actual directory selection, denied access, provider capability, process-tree termination, no competing writer, exact continuation and cold restart. CO-168 owns the implementation gap; a mockup cannot close it.

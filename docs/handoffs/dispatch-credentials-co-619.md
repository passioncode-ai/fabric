# Handoff: dispatch credentials (CO-619)

Status: paused at a safe point on 2026-11-21 by the owner's pause (the Fabric CEO window, about 03:30). Nothing is
merged, released or deployed. Branch `feat/dispatch-credentials`, source commit `d0ad8577`.

## Objective

A board run's opening packet names the credential slots its capability needs, so Observatory can hand the run its keys
(board request 8eb58906; spec [§3.4](../evidence/specs/2026-11-04-on-demand-sessions.md#34-the-packet)).

## Done

- `apps/desktop/src/shared/dispatchCredentials.ts`: the parser of the target project's
  `.fabric/dispatch-credentials.json` (`dispatch-credentials/1`, names only, no `project` field, 64 KB, 16 slots).
- `apps/desktop/src/main/boardDispatchRun.ts#credentialsFor` and `boardDispatchWiring.ts#declaredCredentials`: the
  opening write carries `credentials` for a request run; inbox and resume runs, an absent or malformed file name none.
- Tests `apps/desktop/test/dispatch-credentials.test.mjs`; spec §3.4, carry-over row CO-619, backlog lane 12, design map,
  `AGENTS.md` lifecycle row.

## Checks actually run (on `d0ad8577`)

tsc (node) exit 0; `board-dispatch-run` 148/148; `dispatch-credentials` 5/5 (the plant watched failing);
`check-registers`, `check-plan-ids`, `check-regions`, `check-private`, `check-docs`, `check-design-map` exit 0.
Not run: `bash scripts/ci.sh fast` (it needs the workspace dependencies set up, which the disk guard refuses on the
MacBook).

## Open

- Board request 8eb58906 is held by another dispatched run (slot `change.request` active, generation 40); this session
  did not reply or complete it.
- Observatory's workflow checkpoint, close and retro of this run were not written (its MCP was disconnected).
- A mandate slot field belongs to fabric-agent-contract; a key in another project's slot needs Observatory's own route.

## Next task

Wait for the Fabric CEO's signal with the reconciler's decision. Then, if this work stays in priority: run
`bash scripts/ci.sh fast` on the Mac Studio on this branch, open the PR, land it by fast-forward, and tell the holder of
request 8eb58906 the branch on its thread.

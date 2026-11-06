# Digest edges, the digest collector, and Fabric's gaps for the Studio (2026-11-06)

## Objective

After 0.3.16's rollout: CO-509 (the digest's edges), CO-503 (the daily digests to Observatory), and the operator's word
of 2026-11-05 relayed on the board (thread `1fe66e6e`): Fabric's gaps for the organization's machines and the Studio.

## Done (on `main`, hosted CI green on each)

- `1af5c3da`: CO-509, the digest written as the contract's DEC-0153 says (the quit hour kept and written at start,
  `previous` from the last hourly line, slept hours not written, 4095 names a day plus `ops.overflow`, pruning).
- `7fcbd647`: the digest's tests run in the package's test chain (they never did).
- `26620e1a`: CO-503, the contract's DEC-0153 vectors pinned with their source receipt
  (`apps/desktop/test/fixtures/fabric-agent-contract-ops-digest/`), `foldDay` fixed to pass all 15; the OD-9 collector
  (`apps/desktop/src/main/opsDigestCollector.ts`), not wired yet.
- `5db38233`: [the Studio gaps spec](../evidence/specs/2026-11-06-studio-spaces-gaps.md), rows CO-513 to CO-518.
- `603da12f`: CO-517, a run that cannot take a board request asks the operator (`board.read-at-start`).
- `620dac15`: CO-518, [moving Fabric to another machine](../launch/release-mac.md#moving-fabric-to-another-machine-or-another-macos-user).
- `b8c0a38c`: the rule's words for a session without a slot (answer once, no work, end).
- 0.3.16 rolled out on the operator's Mac (the 0.3.16 ledger, «Rollout on the operator's Mac»).
- `79d86736`, `f6818ca0` and the change after them: CO-520, private data out of the public tree (home path, denylisted
  terms, real addresses) and the gate `scripts/check-private.mjs` in `scripts/ci.sh fast` and the operator's pre-push
  hook. Rewriting the already published history is the operator's decision (ADR-0096, amendment of 2026-11-06).
- The change after `b36199a0`: CO-510 (a retried «Поручить агенту B» files no second task), CO-521 / SCN-179 (a task in
  review asks one decision: the agent's words, «Принять», «Вернуть в работу», «Отменить задачу», a comment the agents
  read in `fabric_work_list`), CO-522 / SCN-180 filed (Fabric coordinating every coding session, draft), and
  [Fabric's part of the estate reconciliation](../reports/2026-11-06-estate-flows-fabric/README.md) (board thread
  `eefa7959`, due 2026-11-07 10:00 UTC).

## Open, with what each waits on

- **CO-513, CO-514**: the contract's DEC-0154 (draft on branch `agent/studio-ports-owner-20261106`, accepted and tagged
  by 2026-11-07). Claim names agreed: `ai.passioncode.desktop.hub`, `ai.passioncode.desktop.stack`.
- **CO-503, wiring the collector**: Observatory 0.34.0 with `ops_digest_record` (OBS-330), and an access binding the
  operator issues in a terminal (`project-observatory full access-binding issue service:fabric --project
  project:<Fabric's slug> --scope ops.digest.record ...`, board thread `f7758225`, `917a0ec0`). Other services' lines
  wait for the hub's delegation token.
- **CO-515** with the contract's G7; **CO-516** with the organization slice (PLAT-137).
- Human gates: the analytics secret (thread `cb1df3d5`), the person's look at 0.3.16, and whether to rewrite the
  published history that still holds the private bytes CO-520 removed from the tree.

## Checks run

`bash scripts/ci.sh fast` (exit 0) before each commit; hosted `ci` success on `1af5c3da`, `7fcbd647`, `26620e1a`,
`5db38233`, `603da12f`, `620dac15`.

## Next task

The organization paused new work until the shared source of truth (board `1d417ba1`); what the operator asks
directly stays allowed. First: answer the reconciliation's follow-ups on thread `eefa7959`; then CO-522's spec
(what exists and what is missing per step of SCN-180); then CO-512's remaining edges. Earlier plan below.


When DEC-0154 is tagged: CO-513 (a recorded port block per macOS user for the bundled stack,
`apps/desktop/src/main/bundledStack.ts`), then CO-514 (fabric-mcp checks the hub listener's uid). Until then, take the
next open row by its date from the [general development plan](../evidence/backlog.md#general-development-plan).

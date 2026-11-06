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

## Open, with what each waits on

- **CO-513, CO-514**: the contract's DEC-0154 (draft on branch `agent/studio-ports-owner-20261106`, accepted and tagged
  by 2026-11-07). Claim names agreed: `ai.passioncode.desktop.hub`, `ai.passioncode.desktop.stack`.
- **CO-503, wiring the collector**: Observatory 0.34.0 with `ops_digest_record` (OBS-330), and an access binding the
  operator issues in a terminal (`project-observatory full access-binding issue service:fabric --project
  project:<Fabric's slug> --scope ops.digest.record ...`, board thread `f7758225`, `917a0ec0`). Other services' lines
  wait for the hub's delegation token.
- **CO-515** with the contract's G7; **CO-516** with the organization slice (PLAT-137).
- Human gates: the analytics secret (thread `cb1df3d5`), the person's look at 0.3.16.

## Checks run

`bash scripts/ci.sh fast` (exit 0) before each commit; hosted `ci` success on `1af5c3da`, `7fcbd647`, `26620e1a`,
`5db38233`, `603da12f`, `620dac15`.

## Next task

When DEC-0154 is tagged: CO-513 (a recorded port block per macOS user for the bundled stack,
`apps/desktop/src/main/bundledStack.ts`), then CO-514 (fabric-mcp checks the hub listener's uid). Until then, take the
next open row by its date from the [general development plan](../evidence/backlog.md#general-development-plan).

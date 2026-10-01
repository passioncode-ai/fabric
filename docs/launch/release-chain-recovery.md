# Release-chain publication recovery — 2026-10-01

Objective: finish publication after the Observatory 0.10.0, Fabric Agent Adapter 0.5.5 and
PassionCode.ai launcher 0.1.14 releases. The operator requested continuation of the interrupted
session. The owning cross-repository entry is
[org-index release-chain recovery](https://github.com/passioncode-ai/org-index/blob/8947257334d35ecb05c667debb0e9067deef0b9e/docs/runs/2026-10-01-release-chain/README.md).

## Observed blocker and bounded repair

The workspace sync from source `f7602c93` stopped in `bash scripts/ci.sh fast` at
`scripts/check-provider-capability.mjs`: the matrix named Codex CLI 0.157.1 but `codex --version`
returned `codex-cli 0.159.3`. `claude --version` returned `2.1.286 (Claude Code)`.

The existing upgrade policy in `apps/desktop/src/shared/providerCapability.ts` says an upgrade
invalidates capability verdicts. `providerCapabilityMatrix.ts` already generates every current
row as `unverified`, retaining the historical observations separately. This repair changes
the Codex build pin and dates the version-only observation. It does not assert login isolation,
native resume or any other capability, and changes no account, credential or provider session.

Scope: the matrix, this handoff, the living map and its source stamp, and the in-iteration merge
entry. No new scenario, screen, architecture decision or release is introduced. The existing
M199 probe work remains in its [own packet](../evidence/plans/2026-09-09-provider-accounts-backlog.md).

## Requirements and checks

| Requirement | Verification |
|---|---|
| Pin the installed CLI without borrowing historical verdicts | `node scripts/check-provider-capability.mjs`; previously failed on the actual mismatch |
| Preserve historical receipts and keep every current row unverified | `node --test apps/desktop/test/provider-capability-upgrade.test.mjs` |
| Keep the living map honest and current | `node scripts/check-design-map.mjs --refresh`, then `node scripts/check-design-map.mjs` |
| Integrate only checked source | `bash scripts/ci.sh fast` before the source commit |
| Publish and pin the source plus sibling records | dedicated workspace sync, then `node scripts/workspace.mjs check --require-child` and `lag --grace-hours 0` |

The failing sync made no deployment or parent receipt commit. Browser suites were NOT_RUN in
that attempt because `FABRIC_PLAYWRIGHT_MODULE` and `FABRIC_CHROME` were not configured; no
browser-rendering claim follows from the fast gate. The separate computer-use browser channel
was unavailable in this session too.

## Handoff

After integration, run the existing workspace sync; its canonical receipt is
[`../workspace-receipt.json`](../workspace-receipt.json). Verify the remote Fabric pin and
published source identities. Then follow the central index for launcher issue #19 and the
Observatory update-recollection follow-up. The matrix's future capability probes remain M199;
this version observation does not complete them.

Keep transcript exports, credentials, local logs, dependency trees and other sessions' branches
local-only. The source branch is `codex/provider-cli-0.159.3`; integrate by fast-forward after
the required local gate, with the merge-log entry inside this same source iteration.

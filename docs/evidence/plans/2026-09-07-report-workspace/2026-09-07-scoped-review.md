# Scoped re-review — workspace publication fixes, 2026-09-07

Reviewed `/tmp/fabric-workspace-fix-review.diff`, current parent `scripts/workspace*.mjs` and their tests, plus attached child `c510c3e` link/version changes. This was read-only inspection; existing passing suites were not rerun and no deployment was attempted.

## Original findings

| Finding | Review result | Evidence |
|---|---|---|
| RW-R1 failed final push / repeated publication | Addressed | `workspace-release.mjs:8` requires a clean parent and complete child check before recognizing a completed pointer; publisher retries the parent push without export/commit. The command fixture exercises failed then successful final push and preserves both SHAs. A staged pending receipt cannot take this early-return path. |
| RW-R2 host-only release | Addressed | `workspace.mjs:24` permits only the changed child gitlink (plus receipt under resume); `workspace-release.mjs:16` retains the canonical source A when only publication paths changed and validates its complete manifest. Child origin must remain an ancestor, with no force-push. The real local-Git command fixture exercises host-only commit and preserves source A. |
| RW-R3 running snapshot identity | Addressed in implementation; remote verification still required | `workspace-release.mjs:39` performs bounded HTTP attempts, checks anonymous version denial and authenticated exact source/digest/build/release, and requires a current successful Heroku release. Child version metadata uses actual Heroku build/release variables and does not replace missing data with an expected source. |
| RW-R4 malformed receipt/manifest | Addressed | `workspace-snapshot.mjs:64` requires full immutable SHAs, digest, app and positive release; the source must be an ancestor. `:79` compares the full canonical manifest before byte verification. This closes both prior negative-probe cases. |
| RW-R5 historical HTML links | Addressed | Child `lib/documents.mjs:60` edits navigation href source offsets without reserializing script/style content. The supplied actual-content receipt measures seven broken links becoming zero and unchanged CSP for all 16 exported HTML pages. |

I found no remaining blocking defect in these five fixes. The pending-parent-commit path now correctly avoids `completedPublication`, continues with source A, verifies the release again, then commits the staged pin/receipt rather than exporting parent B as a new source.

## Small remaining status defect

**RW-N1 · P2 — A valid staged receipt is presented as an already-finished next step.**

Location: `scripts/workspace.mjs:14`.

Trigger: deployment has succeeded and `workspace` plus `docs/workspace-receipt.json` are staged, but the final parent commit has not succeeded. `checkReceipt` deliberately accepts this state so it can serve the precommit gate. Therefore `status` prints verified child data followed by `NEXT: open ...`, even though the durable parent pointer still needs committing/pushing. The fixed `completedPublication` recognizes the distinction, but status does not use it.

Suggested repair: retain the valid snapshot information, explicitly label the parent pin as pending, and print `NEXT: node scripts/workspace.mjs publish --resume`. Do not change `checkReceipt` to reject staged pins, because publication uses that gate before committing. This is a status/next-action defect; it does not reopen the corrected publisher recovery behavior.

## Boundaries

- Root reports 9 parent protocol tests, 23 map cases, and 14 host tests passed; I inspected their relevant cases rather than rerunning identical suites.
- Heroku labs metadata availability, actual authenticated remote version, release readiness, final source export, final Git pins, final CI and remote browser behavior remain the root implementer's deployment checks.
- No Fabric agents, database, remotes, credentials or repository files were changed by this review.

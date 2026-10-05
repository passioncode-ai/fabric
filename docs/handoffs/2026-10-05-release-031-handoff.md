# Handoff · 2026-10-05 · Fabric 0.3.1 released to main, publication repaired, tails cleaned

Entry point for the next agent. It records a moment; it is not rewritten later.

## Objective

Finish the work the interrupted Codex session left in this repository: take the 0.3.1 consent-hub
candidate through its third verification iteration, put the release commit on main, keep the
workspace publication working, and remove stale worktrees and branches.

## Done (commits on `main`)

| Commit | What |
|---|---|
| `0b6dd1d0` | Release commit: version 0.3.1, finalized `## 0.3.1` changelog, the fifteen review receipts, the closed hub ledger, `docs/launch/release-gate.json` (`verifiedCommit` `469b4bc6`). `node scripts/release-mac.mjs --check-only --tag v0.3.1` printed "release: Fabric 0.3.1 at 0b6dd1d03e1c (v0.3.1) is on origin/main and its release gate is clear" (exit 0). |
| `b07d4e74` | CO-208 (the scheduled workspace pin passes the verified-candidate check in its exact shape) and CO-209 (the release-gate test no longer asserts the dated ledger's state). CO-179 moved to before 0.3.2. |
| `3347f232` | Prowl Agent prerequisites as proposed rows AR-3.7…AR-3.11 in the agent registry plan. |
| `c9e8a467` | The workspace export skips git bookkeeping files (`.gitkeep`, `.gitignore`, `.gitattributes`); the fast tier builds HEAD's snapshot. Publication had stopped on 22 such files. |
| this change | `ci.sh` cleans its temporary files; the `pnpm` command gate; `test:contract-consumer` restored; this handoff. |

## Checks actually run

- `scripts/ci.sh full` at `469b4bc6` (the verified candidate), workspace submodule synced: exit 0, 878 s.
- `scripts/ci.sh fast` at `b07d4e74`: exit 0. At `c9e8a467`: exit 0.
- At the release commit `0b6dd1d0` itself, `ci.sh fast` stopped on the CO-209 test, which turned false at that commit by design. The commit cannot carry the fix: it may change only release metadata. `b07d4e74` fixes the test.
- Gate, changelog and verified-candidate checks at `0b6dd1d0`: `[]`, `null`, `null`.

## Branches removed on 2026-10-05

Every one was an ancestor of main, or `git merge-tree --write-tree origin/main <tip>` gave main's own tree, or (where it conflicted) its commits were in main by `git cherry` and a line comparison. Each can be restored with `git push origin <sha>:refs/heads/<name>`.

| Branch | Tip |
|---|---|
| agent/hub-0.3.1-v2-surface-resume | `beda3c857e55e5b3e3edbb8986fee7d55b328446` |
| agent/hub-docs-plan-dispositions-20261004 | `53adddb57a43c44f8f82840d0e6c1e6ac0af7132` |
| codex/ad02-write-authority-review-20261004 | `5ea14dd513a739009c1fdefc266ece173f97fb4b` |
| codex/claude-recovery-20261004 | `3b2878fc9283db5fc9a81697ba8538a01630b8d9` |
| codex/co179-native-fixture-20261004 | `ebe9d77151247cb1be015c6be6902b5b84be365c` |
| codex/co179-native-review-20261004 | `4db89847b8d084caa6703b2751f0bdf8da05fa92` |
| codex/co193-consumer-regression-20261004 | `26ac9843f9238d5ea658295ded5fc7776b74ed4f` |
| codex/com-board-scenarios-20261004 | `1b516af195f12f2f76b20080491715c047e6d3f4` |
| codex/com-local-lifecycle-research-20261004 | `fbb649ee4719115da0d4abbd171814b04c2e77c8` |
| codex/contract-consumer-review-20261004 | `0c5735c9c1f2cdb85a5995d5b411555e216b56c7` |
| codex/hub-i2-dispositions-check-20261004 | `d92146fecb771b179a408a9e8f7f11e6b7845784` |
| codex/hub-i3-data-20261004 | `d286d3cf4ab2cee837ce6fd001799ac725a0a0e3` |
| codex/hub-i3-docs-20261004 | `43ef216270d48712d07af450d50c9c13fce3221d` |
| codex/hub-i3-errors-20261004 | `ae94574ad99fb1c0e98dbe16ef5cc01abb9f2cd6` |
| codex/hub-i3-plan-20261004 | `7291c1c9fbd842e1befff147429761266cd95c36` |
| codex/hub-i3-ux-20261004 | `b3fd19597132dc7db72de86ca6895a06c81cfade` |
| codex/hub-upgrade-rehearsal | `8718873332481226202c05e1953d365e609ee51e` |
| codex/onboarding-visual-20261004 | `4de188d37a38db48ee8bf75ddab2c48323ae0bed` |
| codex/project-comms-architecture-20261004 | `86872d9e4fe3c31fa9fcd629e52dbed5ed6db5c8` |
| codex/release-review-receipts-20261004 | `e13fb147b791f9a88fc3e9f47ff61d1576867e0d` |
| codex/telegram-board-transport-research | `b9aa8bffa33223b4159cad3101ec879afbbd1f6e` |
| codex/unified-canonical-coverage-20261004 | `a95bb28746573af0f2007b4186e3d2a1f83fa764` |
| codex/unified-compiler-recheck-20261004 | `e4244c3505e60b824aeed8890c19c19bceeb3c8e` |
| codex/unified-compiler-review-20261004 | `5847458132614dc41feaf19ac8459c2b4c8f4b8e` |
| codex/unified-owner-reconciliation-20261004 | `cf16bc851d14e42b9df683b16928acba38d9b589` |
| codex/unified-owner-reconciliation-recheck-20261004 | `a02600447e08ceb9b403693afac72a9e54e64eb2` |
| codex/unified-owner-reconciliation-review-20261004 | `9a1a07fc5d993ffcf53c891681fa4b04746b1d3c` |
| codex/hub-i3-fixes-20261004, agent/p08-converge-20261004, agent/p08-i3-fixes-20261005, agent/p08-i3-round2-20261005, agent/post-release-031, agent/prowl-prereqs-landing | ancestors of main |
| agent/prowl-prereqs-20261004 | `d4195c1d` (its change re-applied as `3347f232`) |

Kept: `codex/com01-contract-candidate-20261004` (`ac230309`). It is a work-in-progress COM-01 contract draft whose README links files that do not exist. It is raw input for the COM-01 owner, not something to land. Also kept: `agent/release-0.3.1` (`0b6dd1d0`, already on main), until the tag exists.

One correction is on record. A first pass deleted twelve branches that still differed from main: a zsh loop never split the file list, so the comparison always read "no difference". All twelve were restored at their exact tips within minutes and then judged one by one. Eleven were superseded, and one (co193) carried the single line restored here.

## Open — the operator's steps

1. Push the tag and approve the release: `git tag -a v0.3.1 0b6dd1d0 -m "Fabric 0.3.1" && git push origin v0.3.1`, then approve the `release` environment as a release-approver. CI signs, notarizes and publishes.
2. Install 0.3.1. Only after that, upgrade the database to schema 78 per `docs/launch/release-mac.md` (backup with the PostgreSQL 17 client first). CO-198 still lacks rehearsal commands.
3. The decisions carried in the register: CO-177, CO-178, CO-202 (restored standing denial), and the rank of the Prowl rows AR-3.7…AR-3.11 against later work.

## Open — agent work, in order

1. After the tag: CO-197, the knowledge pages say 0.3.1 is released (a `fabric-workspace` PR), then `node scripts/workspace.mjs publish`.
2. CO-179: restyle the New project form (SCR-73) through sheleg-design, before 0.3.2.
3. 0.3.2 candidates by their own rows: CO-206 (deadline on hub database calls), CO-199 (migration filename order, before any migration with suffix 78/79), CO-200, CO-203, CO-205, CO-207.
4. The general development plan's Now line (`docs/evidence/backlog.md#general-development-plan`).

## Next task

Run `python3 ~/.local/share/observatory-agent-updates/agent_updates.py check`, read `docs/evidence/backlog.md#general-development-plan`, and take the first agent item above whose prerequisite is met. CO-179 needs no operator step.

# Branch consolidation — 2026-09-27

## Objective and entry point

The R0 harness wave of 2026-09-27 ran as parallel member packets, one Codex worktree
each. When it stopped (last file write 07:49 local, nothing after for thirteen hours)
it left 37 worktrees besides the main checkout (34 Codex, 2 under `~/DATA`, 1 Orca),
35 local branches besides the integration branch and `main`, 24
`origin/codex/*` branches and 9 `origin/fix/*` branches from 2026-09-10. The
operator asked for one branch holding everything current and a plan that says
where R0 stands.

Entry point after this consolidation: `main`, fast-forwarded to the tip of
`codex/context-audit-2026-09-14`. The living plan is
[`docs/launch/harness-r0/README.md`](../../launch/harness-r0/README.md). Every
commit that was reachable from a branch or a worktree is reachable from `main`
or from an annotated `archive/*` tag listed below; every uncommitted file is
reachable from an `archive/wip/*` tag.

## Method — what was measured

The integration branch absorbed member packets as rewritten combined commits,
not merges, so ancestry answers almost nothing: 28 tips carried commits that are
not ancestors of the base `ea1dfda`. Three questions were asked per tip instead,
each by a command:

1. `git merge-tree --write-tree <base> <tip>` — does merging the tip change the
   base tree at all? For 9 of the 28 the result tree was the base tree itself.
2. For the 19 tips that conflicted: of the lines the tip adds over its merge
   base (12+ characters, `workspace/` and `node_modules` excluded), how many
   occur verbatim in the base's copy of the same file? 91.8 % … 99.8 % per tip.
3. For each residual, which side is later — read in the diff, not from dates.
   Example: `docs/launch/harness-r0/ceo-conversations.md` on
   `codex/ceo-conversation-contract` still says "Status: proposed … no
   conversation schema … is implemented"; the base copy was rewritten after the
   implementation landed (`796f6e1`, `193d9f5`). Migration
   `20260927000060_continuation_dispatch.sql` on the detached
   `harness-r0-delivery` tip lacks `project_id` and the `service_role` revoke the
   base copy carries. Every residual inspected was an earlier draft.

Uncommitted files were compared blob by blob with `git hash-object` against the
base and against `git log --all --find-object`.

## Disposition

### Integrated in this change — present nowhere else

| Source | What | Evidence |
|---|---|---|
| worktree `backend-process-registry` (untracked) | `apps/desktop/src/main/ownedBackendProcessRegistry.ts`, its test and [report](../../../apps/desktop/test/reports/owned-backend-process-registry.md) | Rerun on the base: 17 groups PASS, owned groups cleaned. A planted defect — authority change no longer fences the owner — failed the sixth group with `AssertionError`, rc 1, then the file was restored byte-identical. Strict single-file `tsc` rc 0. |
| main worktree (uncommitted) | [ADR-0079](../../adr/0079-private-conversation-archives-preserve-history-not-authority.md), its register row, the reservation move in the [persistence contract](task-pipeline-persistence-contract.md) | ADR-0079 and ADR-0080 were returned by agent-sync to run `r-1d9cd5615`; landed under leases held by run `r-7746d4d1c`. |

### Preserved, not integrated — unfinished packets

| Tag | Content | Why not integrated |
|---|---|---|
| `archive/wip/ceo-private-archive-codec` | `archiveJson.ts` (82 lines), `ceoPrivateArchive.ts` (176 lines) | No tests exist. ADR-0079 §5 requires frozen JS/SQL golden vectors and a negative corpus first. |
| `archive/wip/ceo-private-archive-sql` | `20260927000066_ceo_private_archive.sql` (130 lines) | No SQL check exists; the runtime schema contract stays 65–65 until the complete 66 chain passes, per ADR-0079. |

Both are the first entries of the [next tasks](../../launch/harness-r0/README.md#передача).

### Archived — content already on the main line

Annotated tags carry the tip and the measurement in their message; pushed to
`origin` and verified SHA-for-SHA with `git ls-remote`.

| Tag | Measurement |
|---|---|
| `archive/agent-http-ingress`, `archive/ceo-host-sql`, `archive/ceo-host-tls`, `archive/codex-tui-startup-probe`, `archive/local-state-private-guard`, `archive/native-protocol-probe`, `archive/provider-stop-ordering`, `archive/release-toolchain-pin`, `archive/restore-authority-boundary` | merge-tree yields the base tree unchanged |
| `archive/ceo-conversation-contract` 92.9 %, `archive/ceo-conversation-host` 98.2 %, `archive/ceo-conversation-service` 95.8 %, `archive/ceo-private-archive` 99.4 %, `archive/command-ingress-binding` 99.4 %, `archive/harness-bundle-cleanup` 99.5 %, `archive/harness-r0-delivery` 91.8 %, `archive/harness-redaction-sinks` 99.7 %, `archive/ingress-sql-acceptance` 99.5 %, `archive/managed-launch-sql` 99.8 %, `archive/native-stop-runtime` 98.0 %, `archive/native-view-host` 99.0 %, `archive/native-view-lifecycle` 99.1 %, `archive/provider-execution` 99.6 %, `archive/r0-pty-queue` 94.3 %, `archive/startup-schema-readiness` 94.7 %, `archive/transcript-finalization` 98.8 %, `archive/transcript-recovery-sql` 99.1 % | share of added lines present verbatim in the base; residuals are earlier drafts |
| `archive/inbox-product-links` | its one commit only moves `docs/workspace-receipt.json` to an older workspace pin, superseded by later pins |

Nine branches were ancestors of the base and were deleted without a tag:
`backend-process-registry`, `ceo-private-archive-codec`, `ceo-private-archive-sql`,
`harness-launch-lifecycle`, `managed-launch-runtime`, `observed-stop-runtime`,
`passioncode-toolkit-launch`, `stop-native-binding`, `transcript-ending-recovery`.
The nine `origin/fix/*` branches of 2026-09-10 are ancestors of both `main` and
the base.

Reachability check after tagging, over every local and remote branch tip plus the
two detached worktree heads: 47 tips, 0 unreachable from the base or an
`archive/*` tag.

### Uncommitted work in the worktrees

Each dirty worktree was snapshotted through a temporary index (the worktree
itself untouched) into a commit whose parent is that worktree's HEAD, then
tagged. Every changed file's blob in the tag was checked equal to the file on disk.

| Tag | Files | Verdict |
|---|---|---|
| `archive/wip/backend-process-registry` | 3 | integrated, above |
| `archive/wip/ceo-private-archive-codec` | 2 | unfinished, preserved |
| `archive/wip/ceo-private-archive-sql` | 1 | unfinished, preserved |
| `archive/wip/harness-launch-lifecycle` | 22 | 21 blobs exist in history; `admission.ts` 88 of 90 lines in the base — superseded draft |
| `archive/wip/harness-observed-stop` | 7 | 6 in history; `pty-launch-failure.test.mjs` 81 of 81 lines in the base — superseded |
| `archive/wip/native-stop-runtime` | 2 | `managedStop.ts` 157 of 165 lines in the base — superseded |
| `archive/wip/provider-stop-ordering` | 2 | both blobs exist in history |
| `archive/wip/stop-native-binding` | 45 | 32 in history; 13 differ by 1–5 lines each from later base copies — superseded |
| `archive/wip/transcript-ending-recovery` | 23 | 14 in history; 9 differ by 0–4 lines — superseded |

Two worktrees held only `node_modules` (`command-ingress-binding`, `r0-pty-queue`).
No stashes existed.

### Removed by its own tool

`~/orca/workspaces/.orca-preparing/657-…` was a worktree **locked** by the Orca
tool, detached at `a838073`, an ancestor of both `main` and the base, and was
excluded from removal. Orca removed it itself: at 21:24 local it was listed, and
the parent `.orca-preparing/` directory is empty with mtime 21:27, before any
removal here began. `git worktree prune` then dropped the dangling record. The 36
worktrees removed by this consolidation are the 34 Codex and the 2 `~/DATA` ones.

## Final state

| Check | Command | Result |
|---|---|---|
| `main` fast-forwarded, no force | `git push origin <tip>:refs/heads/main` | `a838073..5858295`, then `git ls-remote origin refs/heads/main` = `5858295` |
| Source iteration and workspace pin | `node scripts/workspace.mjs check --require-child` | source `d71b7a8`, workspace `e93af37`, 882 files, child verified |
| One branch on the remote | `git ls-remote --heads origin` | `refs/heads/main` only — 24 `codex/*`, 9 `fix/*` and `codex/context-audit-2026-09-14` deleted after every tip was checked reachable from `main` or an `archive/*` tag (34 checked, 0 unreachable) |
| One branch locally | `git branch -vv` | `main` tracking `origin/main`; `codex/context-audit-2026-09-14` deleted at the same SHA as `main` |
| No worktrees | `git worktree list` | the main checkout only |
| Tags on the remote | `git ls-remote --tags origin 'refs/tags/archive/*'` | 41, each SHA equal to the local tag |

To resume an archived or preserved line: `git switch -c <new-branch> archive/<name>`
(or `archive/wip/<name>`), then rebase onto `main`.

# Handoff — onboarding, start paths, icon, general plan (2026-10-03)

Branch `claude/onboarding-and-plan` (pushed; not on `main`). The branch head is the commit that carries
this file; `git log origin/claude/onboarding-and-plan -1` names it. Brief, REQ table and REQ status:
[docs/evidence/plans/2026-10-03-onboarding-and-plan.md](../evidence/plans/2026-10-03-onboarding-and-plan.md#req-status-after-iteration-1).
Verification ledger (P-02): [docs/evidence/plans/2026-10-03-verification.md](../evidence/plans/2026-10-03-verification.md).
Decisions: [ADR-0100](../adr/0100-first-run-and-start-paths.md), [ADR-0101](../adr/0101-the-general-development-plan.md).
The plan everyone works to: [general development plan](../evidence/backlog.md#general-development-plan).

## Done (on the branch)
- First run (name/look → coding agents → five start paths), add a project, scan a projects folder as a
  checklist, new project through the draft form with "Create a new folder for it", the new-agent entry
  and the agent form with every state (`CreatedAgents.tsx`), the planned convert screen; SCN-126…131,
  FLW-69…74, SCR-70…75; the Fabric app icon (`assets/brand/app-icon/`, `scripts/build-app-icon.mjs`).
- The general plan: eleven lanes citing only open work; `scripts/check-plan-ids.mjs` refuses unknown
  id forms, empty lanes and finished work.
- **Verification iteration 1** (five independent reviewers): 68 findings, each fixed or ruled with a
  register id — [ledger §Iteration 1](../evidence/plans/2026-10-03-verification.md#iteration-1).
  Includes two merged builder branches: `claude/release-review-fixes` (migration 70, chain, digest,
  quota, search, context; `90b012dc`…`745ba358`) and `claude/ci-full-disposable-stack` (`c0f7339f`:
  `ci.sh full` on a disposable stack, a guard against the live ports, `scripts/residue-report.mjs`).
  Migration 71 restores `append_event`'s lock timeout and event-type check (lost in 63/64).
- Separately on `main` (`afb62b82`): Claude Code 2.1.288 re-pin and `scripts/repin-provider-builds.mjs`.

## Checks run for this state
- `VITEST_MAX_WORKERS=4 bash scripts/ci.sh fast` with `FABRIC_PLAYWRIGHT_MODULE` and `FABRIC_CHROME`
  set (see the commit message for the exit code of the run that preceded it).
- All 13 owned-cluster runners (`apps/desktop/test/run-*-db.mjs`, `run-ceo-host-sql.mjs`) on 71
  migrations: exit 0.
- Planted defects watched failing for every new test (listed per finding in the ledger).

## Open — exact next task
1. **Iteration 2** of P-02: five fresh reviewers who have not seen iteration 1 (protocol in the
   ledger; the reviewer brief names the levels and the rules). Diff to review: `0ca25630..HEAD`.
   Then fix everything, record `V2-n`, repeat for **iteration 3**, which must end with zero blocking.
2. Before the release: `bash scripts/ci.sh full` (now safe — disposable stack), the live walk ×3
   (`pnpm --filter @fabric/desktop exec electron-vite build`, then
   `node scripts/walk/start-paths.mjs <out> [--theme light] [--locale ru]`).
3. **P-03**: `scripts/release-mac.mjs` 0.3.0 (notarized DMG; the App Store Connect key through
   `use_secret.py`), install and walk on this Mac, publish on passioncode.ai (authorized by the operator
   on 2026-10-03), the merge-log entry, land by fast-forward, `node scripts/workspace.mjs sync`, and the
   knowledge-base pages (`workspace/knowledge/products.md`, `plans.md` — AR-1 is partial, not done).

## Human steps
- CO-181: whether to remove the test residue from the live local database
  (`node scripts/residue-report.mjs` counts it read-only; nothing has been deleted).

## Notes
- Guarded files are edited under the agent-sync lease (run `r-516254241` holds
  `docs/evidence/backlog.md`); take a fresh one if it has expired.
- Asset Foundry project `fabric` is registered; icon job `job_01M3ZC9B3DYDH7ECV6ECECD45T` was cancelled
  ($0.012) — the operator chose the vector composition.
- The operator's transcript export `2026-10-01-134213-…txt` was moved out of the repository root (it
  broke the map gate) into the session scratchpad, which was later cleared; it is not recoverable, and
  the operator was told.

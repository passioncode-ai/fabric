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
- The general plan: twelve lanes citing only open work, every open carry-over row in one of them; `scripts/check-plan-ids.mjs` refuses unknown
  id forms, empty lanes and finished work.
- **Verification iteration 1** (five independent reviewers): 68 findings, each fixed or ruled with a
  register id — [ledger §Iteration 1](../evidence/plans/2026-10-03-verification.md#iteration-1).
  Includes two merged builder branches: `claude/release-review-fixes` (migration 70, chain, digest,
  quota, search, context; `90b012dc`…`745ba358`) and `claude/ci-full-disposable-stack` (`c0f7339f`:
  `ci.sh full` on a disposable stack, a guard against the live ports, `scripts/residue-report.mjs`).
  Migration 71 restores `append_event`'s lock timeout and event-type check (lost in 63/64).
- **Verification iteration 3** (five fresh reviewers): 58 findings, each fixed or ruled, none blocking open —
  [ledger §Iteration 3](../evidence/plans/2026-10-03-verification.md#iteration-3). Merged
  `claude/iter3-data-fixes` (migration 73: a session belongs to one estate at the door, ids locked, the
  import exemption, casefolded names, gateway probes) and `claude/iter3-boundary-fixes` (no submodule
  driver, candidates pinned to the walk, a per-suite limit, refusals as codes). P-02 is done; the release
  gate reads the ledger clear.
- **Verification iteration 2** (five fresh reviewers): 55 findings, each fixed or ruled —
  [ledger §Iteration 2](../evidence/plans/2026-10-03-verification.md#iteration-2). Merged
  `claude/iter2-data-fixes` (migration 72, the full tier runs every suite through
  `scripts/run-test-chains.mjs`) and `claude/iter2-boundary-fixes` (one hardened `gitRun`, repository
  paths admitted per window, a scan the disk cannot hang). ADR-0103 records the write-boundary rule;
  `scripts/release-mac.mjs` now refuses without the ledger's exit (`docs/launch/release-gate.json`).
- Separately on `main` (`afb62b82`): Claude Code 2.1.288 re-pin and `scripts/repin-provider-builds.mjs`.

## Checks run for this state
- `VITEST_MAX_WORKERS=4 bash scripts/ci.sh full` with `FABRIC_PLAYWRIGHT_MODULE` and `FABRIC_CHROME` set:
  exit 0 — the fast tier (browser suites 15 of 15), the 13 owned-cluster runners on 73 migrations, and a
  disposable stack (73 migrations + seed) where 96 suites ran and 96 passed; the stack was removed.
- Walk ×3 on a disposable stack (`node scripts/test-stack.mjs run -- node scripts/walk/start-paths.mjs …`,
  dark/en, light/ru, dark/ru): 10/10 each, including the sticky-footer assertion on 29 repositories.
- The release gate on the ledger: `releaseGateProblems` returns no problem for version 0.3.0.
- Planted defects watched failing for every new test (listed per finding in the ledger).

## Open — exact next task
1. **Land on `main`** by fast-forward after `bash scripts/ci.sh fast` on the branch head: write the
   `docs/MERGES.md` entry inside the change (AGENTS.md iteration contract), refresh the map, push `main`,
   then `node scripts/workspace.mjs sync` and the fabric-workspace PR for `knowledge/plans.md` (AR-1
   partial, AR-2 in lane 6, a link to the general plan and its Now/Next) and, after publication,
   `knowledge/products.md` (Fabric 0.3.0).
2. **P-03**: bump `apps/desktop/package.json` to 0.3.0, then
   `python3 ~/DATA/project-observatory/tools/use_secret.py run apple-publisher-kj35uyyl22 ASC_API_KEY_P8_B64,ASC_KEY_ID,ASC_ISSUER_ID -- node scripts/release-mac.mjs`
   — it refuses unless HEAD is `origin/main` and the ledger is clear (`docs/launch/release-gate.json`);
   install in /Applications and walk; publish on passioncode.ai (authorized by the operator on 2026-10-03).
   Measure CO-191 (quit on SIGTERM) before walking the packaged app.

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

# Handoff — onboarding, start paths, icon, general plan (2026-10-03)

Branch `claude/onboarding-and-plan` @ `7697923c` (pushed; not on `main`). Brief and REQ table:
[docs/evidence/plans/2026-10-03-onboarding-and-plan.md](../evidence/plans/2026-10-03-onboarding-and-plan.md).
Verification ledger: [docs/evidence/plans/2026-10-03-verification.md](../evidence/plans/2026-10-03-verification.md).
Decisions: [ADR-0100](../adr/0100-first-run-and-start-paths.md), [ADR-0101](../adr/0101-the-general-development-plan.md).

## Done (on the branch)
- First run (name/look → executor detection → five start paths), add a project, scan a projects
  folder as a checklist, new project via the draft form with "Create a new folder for it", new-agent
  entry, planned convert screen; SCN-126..131, FLW-69..74, SCR-70..75, prototype views, journeys,
  adoption inventory; Fabric app icon (`assets/brand/app-icon/`, `scripts/build-app-icon.mjs`);
  general plan in `docs/evidence/backlog.md#general-development-plan` + `scripts/check-plan-ids.mjs`.
- Live walk of the built app: `node scripts/walk/start-paths.mjs <out> [--theme light] [--locale ru]`
  — 10/10 in dark/en, light/ru, dark/ru (needs `electron-vite build` and the local stack).
- Separately on `main` (`afb62b82`): Claude Code 2.1.288 re-pin and `scripts/repin-provider-builds.mjs`.

## Open — exact next task
1. **Merge `origin/main` into the branch** (expect trivial conflicts: `providerCapabilityMatrix.ts`,
   `scripts/ci.sh` repin line duplicated, `scripts/lib/repin-provider-builds.mjs` region marker,
   `docs/MERGES.md`, `docs/reports/map.html`), then `node scripts/check-design-map.mjs --refresh`.
2. Run `VITEST_MAX_WORKERS=4 bash scripts/ci.sh fast` to exit 0 (last full run before the final
   fixes was not repeated; this handoff file itself makes the map stamp stale until refreshed).
3. **P-02: three independent verification iterations** (protocol in the verification ledger), five
   fresh reviewers per iteration: UX/UI/visual (screenshots from the walk), errors/boundaries (probe
   the fileRoots boundary, FABRIC_WALK_PICK seam, scan cancel races), code↔docs (regions, ADRs,
   coverage fields, CONTEXT terms), data/memory/orchestration/harness (first establish whether
   `ci.sh full` is isolated from the operator's live stack before running it), plan/roadmap/workspace.
   Iteration 1 was started on 2026-10-03 and interrupted before any report; restart it.
4. Fix every finding (or rule it with a CO id), record each as `V<n>-<k>` in the ledger.
5. Only then **P-03**: `scripts/release-mac.mjs` 0.3.0 (notarized DMG), install and walk on this Mac,
   publish on passioncode.ai (operator authorized DMG + site publication on 2026-10-03), workspace
   publish, knowledge-base pages (`workspace/knowledge/products.md`, `plans.md`).

## Notes
- The agent-sync lease on the guarded files (run `r-07dbb329a`) was not renewed; take a fresh one.
- Asset Foundry project `fabric` was registered; icon job `job_01M3ZC9B3DYDH7ECV6ECECD45T` cancelled
  ($0.012 spent) — the operator chose the vector composition.
- The operator's transcript export `2026-10-01-134213-…txt` was moved out of the repo root (it broke
  the map gate) into the session scratchpad, which was later cleared; it is not in the repository.

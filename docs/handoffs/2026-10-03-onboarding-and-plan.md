# Handoff — onboarding, start paths, icon, general plan (2026-10-03)

> **Note, 2026-10-03 (later the same day):** the release-approval rule below was amended by [ADR-0113](../adr/0113-any-release-approver-may-approve-the-tag-pusher-included.md): any member of `release-approvers` may approve, the person who pushed the tag included; an agent never approves.

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
- **Confirmation pass after iteration 3** (one more independent verifier of the iteration-3 fixes): two
  further holes closed — migration 74 (one canonical id spelling at the door and in the journal; command
  ingress now refuses an upper-case or non-hyphenated id with `invalid_identifier`, a contract change) and
  file roots that refuse a repository path which became a link or resolves too broad — recorded as
  V3-59…V3-65. A re-verification closed two more: migration 75 (no projector or internal command callable
  by API roles; a fast-tier sweep enforces it) and file roots that grant a stored path only while it is its
  own canonical spelling — V3-66…V3-68.
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
- **The product lifecycle contract (P-05, [ADR-0106](../adr/0106-fabric-adopts-the-product-lifecycle-contract.md)).**
  An audit of nine products ([report](https://github.com/passioncode-ai/fabric-workspace/blob/main/docs/reports/2026-10-03-lifecycle-audit/README.md),
  [contract LC-01…LC-15](https://github.com/passioncode-ai/fabric-workspace/blob/main/knowledge/lifecycle.md)) found an idle Fabric
  that never quit (CO-191). `src/main/quit.ts` owns quitting; `quota.ts` holds every credential outcome;
  `scripts/workspace.mjs` runs everything through `scripts/lib/bounded-run.mjs` (deadline, process group,
  machine-wide lock, watchdog, status, rotation); the stack starts without the services Fabric never calls;
  `AGENTS.md` → *Lifecycle*. The other products' packets are open PRs in their own repositories (below).
- **The agent learning loop and Fix in Fabric, designed** ([ADR-0109](../adr/0109-agent-learning-lives-in-fabric-and-problems-become-proposals.md),
  [spec](../evidence/specs/2026-10-03-agent-learning-loop-and-fix-in-fabric.md)): P-06 and P-07 in lane 8.

## Checks run for this state
- `VITEST_MAX_WORKERS=4 bash scripts/ci.sh full` with `FABRIC_PLAYWRIGHT_MODULE` and `FABRIC_CHROME` set:
  exit 0 — the fast tier (browser suites 15 of 15), the 13 owned-cluster runners, and a
  disposable stack (migrations + seed) where 96 suites ran and 96 passed; the stack was removed.
- Walk ×3 on a disposable stack (`node scripts/test-stack.mjs run -- node scripts/walk/start-paths.mjs …`,
  dark/en, light/ru, dark/ru): 10/10 each, including the sticky-footer assertion on 29 repositories.
- The release gate on the ledger: `releaseGateProblems` returns no problem for version 0.3.0.
- Planted defects watched failing for every new test (listed per finding in the ledger).
- Lifecycle (2026-10-03, after main was merged in): `bash scripts/ci.sh fast` exit 0; walk ×2 on a
  disposable stack 11/11 each, including the new `app-quits-gracefully` step (the app exited by itself,
  code 0) and 0 leftover processes; `apps/desktop/test/quit.test.mjs` fails on the old quit pattern (the
  real Electron process was still alive 20 s after SIGTERM) and passes on the coordinator.

## Open — exact next task
Done on 2026-10-04: **Fabric 0.3.0 released** (P-03) — tag `v0.3.0` on `5193022c`, prerelease in
passioncode-ai/fabric, verified (SHA256SUMS, GPG, attestation, notarization), installed in /Applications,
served by passioncode.ai; the operator's live database migrated 69 → 75 after a dump
(`~/DATA/_backups/fabric-local-db/fabric-live-schema69-20261004-015446.dump`, 0600) and a rehearsal on a
copy; fabric#4 and fabric#5 verified on the released build and closed.

1. **P-08 — Fabric 0.3.1 with the hub** (ADR-0115): the fabric-dashboards session runs its verification
   on `agent/hub-0.3.1-verification`. 0.3.0 requires exactly schema 75: migration 76 reaches the live
   database only after 0.3.1 is installed, with the same backup → rehearsal → `supabase migration up`.
2. **P-06.1 and P-07.1** ([ADR-0109](../adr/0109-agent-learning-lives-in-fabric-and-problems-become-proposals.md),
   [spec](../evidence/specs/2026-10-03-agent-learning-loop-and-fix-in-fabric.md)): the learning loop's data
   model and the `fabric://` door.
3. **The lifecycle PRs have landed in every product** (2026-10-04, with each repository's full gate green):
   adapter #28 `88308f3`, launcher #30 `78f83cb`, switchboard #23 `f0b8d7f`, dashboards #21 `56eccde`,
   okolos #11 `abf77b5`, inbox #12 `dc532a0`, vr #9 `3d6179f`. The merged branches are deleted. Three
   releases are waiting for the release flow and the operator's approval: adapter 0.7.0 (FAA-06), then
   launcher 0.1.28 (PC-11) with the adapter re-pinned (PC-10), and switchboard `v0.5.4-beta.1` (SB-34).
   Okolos: the feed agent is installed (B-138); snapshot v54 is committed (B-139), and the snapshot's
   14-day limit now falls on 2026-10-18.
4. The broker's `backgroundLaunch` enrolment for Fabric is BL-1077 in sshlg-personal-os (awaits the
   operator's go).

### Backlog consolidation, 2026-10-04 — where each board lives

Every unfinished item, open PR and issue was recorded in its owner's board. The common backlog
(<https://wiki.passioncode.ai/backlog>) is generated from these boards. `node scripts/workspace.mjs lag`
reported all 13 sources current at 01:36Z, with fabric-vr one commit within grace.

| Repository | Board | Landed at | Rows |
|---|---|---|---|
| fabric | `docs/evidence/backlog.md` | `82e4bc06`, `c7388fa9` | P-03 done, P-08; CO-191/192 closed |
| fabric-workspace | `knowledge/plans.md`, `knowledge/products.md` | `e39620c` (#32) | Fabric 0.3.0, Now P-08 |
| org-index | `BACKLOG.md` (X-rows) | #35 (peer project-observatory-ce) | X-26…X-30; X-28 covers fabric-workspace #14 and org-index #31 |
| fabric-dashboards | `docs/backlog.md` | `6679100` | FD-03…FD-08 |
| fabric-switchboard | its board | `9685a49` | SB-27…SB-30 |
| fabric-inbox | `docs/evidence/backlog.md` | `8881962` | B-41…B-46 (now has a Status column) |
| okolos | `docs/backlog.md` | `02f9a61`, `9bdd8e4d` | B-134, B-135 (done → Observatory OBS-32), B-138…B-141 |
| fabric-vr | `docs/evidence/backlog.md` | `8176144`, `9f6f311`, `d5eebcb` | B-261…B-273; DEC-0105 amends DEC-0104 |
| fabric-agent-adapter | its board | `e2899c8` | FAA-01…FAA-05 |
| fabric-agent-contract | its board | `71cdd6e` | CT-01 |
| passioncode | its board | `69de003`, `afcced7` | PC-03…PC-06, PC-08, PC-09 |
| project-observatory-dashboard | `docs/backlog.md` | `071760c` (#141), `0419742f` (#143) | OBS-14…OBS-30, OBS-32 |
| passioncode-ai.github.io | its board | `8ed6d1c`, `25e138f` | SITE-006 closed, SITE-009/010 |

The scheduled publication (`ai.passioncode.fabric-workspace-sync`) failed every run from 2026-10-03 13:12Z
until 2026-10-04 01:23Z. Its first successful run since then ended `published` at 01:35Z. The causes and
fixes are recorded in [ADR-0106 § third amendment](../adr/0106-fabric-adopts-the-product-lifecycle-contract.md#third-amendment--the-scheduled-sync-in-launchds-environment-2026-10-04).

## Human steps
- Releases: any member of `release-approvers` approves the protected `release` environment, the tag's pusher included ([ADR-0113](../adr/0113-any-release-approver-may-approve-the-tag-pusher-included.md)).
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

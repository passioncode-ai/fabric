# Handoff — Fabric 0.3.5 bug-fix wave (2026-10-12)

**Objective.** The operator's order of 2026-10-12: find and fix bugs in waves — search, research and architecture,
implementation, validation to the end — then release a version, update the docs, the wiki, the plan, the board and
the organization's roadmap, and commit and push everything. The release is **0.3.5**: everything on `main` (Windows
and Linux, `fabric-mcp`, the project board, claims) plus `fabric://` links and this wave's fixes. 0.4.0 stays the
agents-first plan ([plan](../evidence/plans/2026-10-11-release-040-agents-first.md)).

**Done** (landed on `main` by fast-forward; the merge commit is in [docs/MERGES.md](../MERGES.md)):
- `fabric://` links: the scheme registered (`electron-builder.yml` `protocols`), `main/index.ts` region
  `fabric-link-handler`, `shared/linkRoute.ts#routeForLink`; a link that starts Fabric waits in
  `shared/linkOutbox.ts#createLinkOutbox` until the page claims it (`links:pending`); one that arrives during the
  first run waits for it and is offered after (`renderer/src/linkArrival.ts`).
- The blind product review's findings (16): fixed in code — links (2, 4, 12), work screens (5, 6), the feed
  sentence aligned in SCN-140 (10, the rest is CO-262), platform words (3; `platformWords.test.ts`), the
  `fabric-mcp` waiting sentence (15), the schema refusal's remedy in the operator's language (16;
  `main/schemaReadiness.ts#SchemaWhy`, `shared/startupFailure.ts`), guard on every release job (9;
  `scripts/test/release-mac.test.mjs#jobsMissingGuard`), the analytics agent counts (13;
  `main/analytics.ts#agentCounts`); in docs — CHANGELOG 0.3.5 with schema 84 and Upgrading (1, 7, 8, 11), README's
  per-OS `fabric-mcp` paths (8); recorded — SCN-142's kit precondition (14) as CO-263.
- `scripts/ci.sh` keeps a Mac's display awake for the run (`caffeinate -d -i`, once): the real-Electron dialog case
  of `quit.test.mjs` does not finish while the display sleeps (the case CO-210 recorded, resolved 2026-10-11).
- The public workspace config no longer names the closed module; `relay` joins it. No private source list is needed
  while the closed modules stay out of the snapshot (fabric-workspace-91 agreed).

**Status at 2026-10-12 07:40 (iteration 2 under way):**
- Iteration 1 closed and landed: `main` at `3570f116` (67 findings, 13 blocking, all disposed in the
  [ledger](../evidence/plans/2026-10-12-release-035-verification.md#iteration-1)). The workspace pin `df3eeb92` by the
  scheduled sync was merged in.
- Iteration 2 ran on `3570f116` (four of five reviewers; the errors reviewer stopped at an API session limit and is
  re-run). Its blocking findings are fixed on `agent/rv2-fixes`: `release.yml` did not parse (DO-1; every release.yml run
  since `c98a0817` had no jobs) — fixed, and `scripts/check-workflows.py` now parses every workflow in `ci.sh`; the
  hosted Linux fast tier (PL-1; two startup-dialog tests read the host platform) — the tests name darwin, and the
  branch's hosted fast tier passed; «Who is working» re-reads each minute (UX-1); the review count reaches the board
  (UX-2); sessions with no project show their folder and open (UX-3). The replay corruption DA-1 reaches only the repair
  tool and is ruled into CO-265.
- The hosted full tier's `run-managed-stop-db` failed on Linux because the native Stop suite runs only on a measured
  runtime (CO-251); it now reports NOT_RUN for that suite and runs the rest.

**Open work, in order:**
1. Land `agent/rv2-fixes` after `bash scripts/ci.sh fast`; the hosted `ci` run on that commit must be green (the guard).
2. Iteration 3 on that commit, five fresh reviewers; its candidate becomes `verifiedCommit`.
3. The release commit: `apps/desktop/package.json` 0.3.5, `## 0.3.5` finalized, `docs/launch/release-gate.json` for
   0.3.5 with the three receipt groups. Then the rehearsal `v0.3.5-rc.1` (`publish=false`) on that commit — it can run only
   once the gate is clear and the changelog final (iteration 2, PL-2) — proving the Windows signature and the native
   installs; then the tag `v0.3.5` and the run watched to publication.
4. The operator's database upgraded 79 → 84 by the runbook (the rehearsal on its dump passed), the app installed
   through the lifecycle broker, the data dumped and the local Fabric data reset for a clean first run (decided: at
   0.3.5, the operator's order of 2026-10-11; the 0.4.0 plan's *Decision, 2026-10-12* records it).
5. After the release: `workspace/knowledge/` (the roadmap's released column; RM-05, RM-13, RM-19, RM-25; `plans.md`'s
   Now line; `platforms.md`'s signing wording) by a fabric-workspace PR; `workspace.mjs publish`.
6. Unfinished wave-2 packets for 0.4.0: P4 `agent/w2-runners` (`ff08f02c`), P2 `agent/w2-handoff` (`29c8de91`).

**Questions for the operator (none blocks the release):**
- Windows ships with fixes proven off-host (CO-267: the quit guard's filter, the Stop order, `.cmd` quoting, a spaced
  user name, the up-front Connect refusal). Release them now with CO-267, or hold Windows until a Windows PC smoke?
  The default taken: release, since the release jobs install and start each Windows build natively.
- The Figma folder «PassionCode» in team SSHLG and moving the file «Fabric» into it.

**Decisions.** The release is 0.3.5, not 0.4.0. A claim whose session ended reads «lapsed: the session ended» on both
work screens. The feed keeps one sentence per event type (CO-262). The startup dialog's copied details stay English;
the remedy is translated per refusal.

**Checks actually run:** see the landing's entry in [docs/MERGES.md](../MERGES.md) and the commit message; each new
test was watched failing on a planted defect (outbox 3/3, arrival 2 plants, work screens 5 plants, platform words 1,
`fabric-mcp` 1, schema remedy 2, release guard on the old workflow, analytics 1).

**Next task:** step 1 of the open work above.

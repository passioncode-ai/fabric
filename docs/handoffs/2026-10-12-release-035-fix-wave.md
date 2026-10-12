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
  of `quit.test.mjs` does not finish while the display sleeps (CO-210).
- The public workspace config no longer names the closed module; `relay` joins it. No private source list is needed
  while the closed modules stay out of the snapshot (fabric-workspace-91 agreed).

**Status at 2026-10-12 06:30 (after the 0.3.5 verification's iteration 1):**
- Step 1 below is **done**: `main` at `895302f1` is "Pin published Fabric workspace 9c31660d63b6", and
  `node scripts/workspace.mjs check --require-child` passed (org-index #62 gave `passioncode-platform` its
  `snapshot_reason`; fabric-workspace #155 names 0.3.5 in the roadmap and products).
- Iteration 1 ran on `895302f1`: 67 findings, 13 blocking, every one disposed in the
  [ledger](../evidence/plans/2026-10-12-release-035-verification.md#iteration-1); the fixes are on `agent/rv1-fixes`.
- Windows signing is on (passioncode-ai/.github #41; `AZURE_SIGNING_ENABLED` true in Fabric's release environment).
- The 79 → 84 upgrade was rehearsed on the operator's database dump (`pre-0.3.5-2026-10-12.dump`): PASS.

**Open work, in order:**
1. Land `agent/rv1-fixes` on `main` after `bash scripts/ci.sh fast`; read the hosted `ci` run on that commit (it was
   red on Linux since `812876cf`, PL-1).
2. A `v0.3.5-rc.1` rehearsal (`publish=false`) once the version is 0.3.5 on a commit of main: proves the Windows
   signature, the native installs and the guard.
3. Iterations 2 and 3 on fresh candidates, five fresh reviewers each; then `docs/launch/release-gate.json` for 0.3.5.
4. The release commit (version 0.3.5, `## 0.3.5` finalized), the tag, the run watched to publication.
5. The operator's database upgraded 79 → 84 by the runbook, the app installed through the lifecycle broker, the
   data dumped and reset for a clean first run (the operator's original order).
6. After the release: `workspace/knowledge/` (roadmap's released column, RM-05/RM-13/RM-25 rows, plans' Now line) by a
   fabric-workspace PR; `workspace.mjs publish`.
7. Unfinished wave-2 packets for 0.4.0: P4 `agent/w2-runners` (`ff08f02c`), P2 `agent/w2-handoff` (`29c8de91`).

**Questions for the operator (none blocks the release):** the Figma folder «PassionCode» in team SSHLG and moving the
file «Fabric» into it; whether to reset the local Fabric data right after installing 0.3.5 (planned, per the
original order; the dump is kept).

**Decisions.** The release is 0.3.5, not 0.4.0. A claim whose session ended reads «lapsed: the session ended» on both
work screens. The feed keeps one sentence per event type (CO-262). The startup dialog's copied details stay English;
the remedy is translated per refusal.

**Checks actually run:** see the landing's entry in [docs/MERGES.md](../MERGES.md) and the commit message; each new
test was watched failing on a planted defect (outbox 3/3, arrival 2 plants, work screens 5 plants, platform words 1,
`fabric-mcp` 1, schema remedy 2, release guard on the old workflow, analytics 1).

**Next task:** step 1 of the open work above.

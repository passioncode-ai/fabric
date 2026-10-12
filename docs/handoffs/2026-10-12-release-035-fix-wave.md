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

**Released (2026-10-12):** [Fabric v0.3.5](https://github.com/passioncode-ai/fabric/releases/tag/v0.3.5), release run
38244634190 green (guard, preflight, macOS, both Windows signed and verified, both Linux, publish), tag on the release
commit `eee9190f`, verified commit `816d2284`. The downloaded DMG checked: `SHA256SUMS` OK, GPG "Good signature",
`spctl` "Notarized Developer ID", staple valid. The rehearsal v0.3.5-rc.1 found the Windows signing argument split by
cmd.exe (fixed in `816d2284`); v0.3.5-rc.2 was green. The close commit marks P-17 done, CO-238 resolved, and updates
`docs/brand/facts.md` and the overview guides.

**Open after the release:** the operator's database upgrade and the install (open work step 6: Fabric was running,
started outside the broker, so quitting it is the operator's step), the knowledge base PR (step 7), the workspace
publication, and 0.4.0 (P-16).

**Status at the release commit (2026-10-12):** the final candidate `89718e92` is `main` and `verifiedCommit`; the
hosted `ci` is green on it, fast and full (run 38219258686 — the earlier dispatch 38216066979 failed on an install-step
rate limit and three stale tests, fixed in `89718e92`); the five rechecks passed; the release gate is clear. Next: the
`v0.3.5-rc.1` rehearsal on the release commit, then the tag (open work steps 4–5).

**Status at 2026-10-12 09:15 (iteration 3 closing):**
- Iterations 1 and 2 are closed and on `main` (`01783787`): 67 and 52 findings, every one disposed in the
  [ledger](../evidence/plans/2026-10-12-release-035-verification.md). The hosted `ci` fast tier is green on it
  (run 38214741453); the dispatched full tier and the native platform builds were started on it (runs 38216066979,
  38216064295).
- Iteration 3 read `01783787` (five fresh reviewers): one blocking finding (UX-1, the project page called Codex and
  Kimi Code not connected). Its fix and the cheap non-blocking ones make the final candidate on `agent/rv3-final`; the
  rest are CO-270…CO-273. Five fresh reviewers recheck the final candidate's delta, as 0.3.4 did; their reports go in
  `docs/handoffs/2026-10-12-release-035-i3-recheck-*.md`, declared as release metadata.
- The nightly gates now choose by the cron that fired (iteration 3 PL-1): no nightly batch had run since 2026-10-02.

**Open work, in order:**
1. Land the final candidate after `bash scripts/ci.sh fast`; the hosted `ci` on it green.
2. The five rechecks on the final candidate; the ledger's iteration 3 section and receipts name it; it is `verifiedCommit`.
3. The release commit (only release metadata after `verifiedCommit`): `apps/desktop/package.json` 0.3.5, `## 0.3.5`
   finalized, `docs/launch/release-gate.json` (version, ledger, `verifiedCommit`, three receipt groups, the recheck
   reports in `releaseMetadata`), the ledger's release-close section, `docs/MERGES.md`, the map's entry and refresh.
4. The rehearsal `v0.3.5-rc.1` (`publish=false`) on the release commit: the first signed Windows build, the native
   installs and the guard. A failure that needs a source change makes a new candidate.
5. The tag `v0.3.5` on the release commit; the run watched to publication; the downloads checked (SHA256SUMS, GPG,
   `spctl`, the Authenticode signature).
6. The operator's database: it was dumped before anything (`pre-0.3.5-2026-10-12.dump`, rehearsed PASS); quit the
   running Fabric through the lifecycle broker, upgrade 79 → 84 by the runbook, install 0.3.5, start it and verify the
   estate; then — the operator's order of 2026-10-11 — dump it again and reset the local Fabric data for a clean first
   run (the 0.4.0 plan's *Decision, 2026-10-12* says the same order).
7. After the release: `docs/brand/facts.md` and the overview guides name 0.3.5 and its platforms (iteration 3 DO-5);
   `workspace/knowledge/` (roadmap's released column, RM-05, RM-13, RM-25; `plans.md`) by a fabric-workspace PR;
   `workspace.mjs publish`.
8. Unfinished wave-2 packets for 0.4.0: P4 `agent/w2-runners` (`ff08f02c`), P2 `agent/w2-handoff` (`29c8de91`).

**Questions for the operator (none blocks the release):**
- Windows ships with fixes proven off-host (CO-267: the quit guard's filter, the Stop order, `.cmd` quoting, a spaced
  user name, the up-front Connect refusal). Release them now with CO-267, or hold Windows until a Windows PC smoke?
  The default taken: release, since the release jobs install and start each Windows build natively — which covers
  starting the app, not the CO-267 paths (iteration 3 PL-7).
- The Figma folder «PassionCode» in team SSHLG and moving the file «Fabric» into it.

**Decisions.** The release is 0.3.5, not 0.4.0. A claim whose session ended reads «lapsed: the session ended» on both
work screens. The feed keeps one sentence per event type (CO-262). The startup dialog's copied details stay English;
the remedy is translated per refusal.

**Checks actually run:** see the landing's entry in [docs/MERGES.md](../MERGES.md) and the commit message; each new
test was watched failing on a planted defect (outbox 3/3, arrival 2 plants, work screens 5 plants, platform words 1,
`fabric-mcp` 1, schema remedy 2, release guard on the old workflow, analytics 1).

**Next task:** step 6 of the open work above — the operator's database and the install, once Fabric is quit.

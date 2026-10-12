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

**Open work, in order:**
1. `node scripts/workspace.mjs publish` after this landing (the hosted workspace check has been red since
   2026-10-11 18:54 because no publish followed the landings), then `node scripts/workspace.mjs check --require-child`.
2. Release verification of 0.3.5: three iterations by independent reviewers (ux, errors, docs, data, plan), each with
   reports and receipts under `docs/evidence/reviews/0.3.5/`, then `docs/launch/release-gate.json` for 0.3.5
   (`scripts/test/release-gate.test.mjs` shows the shape). It needs subagents; they were cut off by the API session
   limit at 03:30 (resets 08:00 Europe/Warsaw).
3. The release: version bump in `apps/desktop/package.json` to 0.3.5, `## 0.3.5` (drop "unreleased"), the release PR,
   the tag `v0.3.5` on main (approval by checks, ADR-0145), the run watched to publication.
4. The operator's database (schema 79) upgraded to 84 by the runbook (dump, rehearsal on a copy), the app installed
   through the lifecycle broker, then — per the operator's original order — the data dumped and the local Fabric data
   reset for a clean first run.
5. Docs after the release: `workspace/knowledge/` (roadmap's released column, products, plans) by a fabric-workspace
   PR; the wiki by `workspace.mjs sync`.
6. Unfinished wave-2 packets: P4 `agent/w2-runners` (`ff08f02c`, WIP: REQ-03, REQ-04 with the gateway removed per
   SH-9, CO-233), P2 `agent/w2-handoff` (`29c8de91`, WIP: vendor DEC-0042 from `213e5a3`). Their worktrees were removed
   to free disk; the branches are on origin.

**Decisions.** The release is 0.3.5, not 0.4.0. A claim whose session ended reads «lapsed: the session ended» on both
work screens. The feed keeps one sentence per event type (CO-262). The startup dialog's copied details stay English;
the remedy is translated per refusal.

**Checks actually run:** see the landing's entry in [docs/MERGES.md](../MERGES.md) and the commit message; each new
test was watched failing on a planted defect (outbox 3/3, arrival 2 plants, work screens 5 plants, platform words 1,
`fabric-mcp` 1, schema remedy 2, release guard on the old workflow, analytics 1).

**Next task:** step 1 above, then step 2 once subagents are available.

# Handoff — after Fabric 0.3.5: the operator's clean first run (2026-10-12, evening)

**Objective.** The operator's standing order for this release: install the new build on this Mac and clean the local
Fabric data so the operator can test from scratch; then finish what the release left open. Continues
[the 0.3.5 fix wave](2026-10-12-release-035-fix-wave.md).

**Done.**
- 0.3.5 installed in `/Applications`, the operator's database upgraded 79 → 84; Fabric started clean on schema 84.
- The operator's local data reset for a clean first run (operator's order). Backups in
  `~/Library/Application Support/Fabric/backups/`: `pre-wipe-2026-10-12.dump` and `pre-wipe-2026-10-12-final.dump`
  (33 estates, 2 514 events, 16 projects — all rehearsal residue), the archived user files in
  `pre-wipe-2026-10-12-userdata/`. After: one estate (`org #1`, the seed), one event, no project; `settings.json` keeps
  theme, `ru`, keep-awake and `firstRun.completedAt: null`. Undo: quit Fabric, `pg_restore --clean` the final dump,
  move the archived files back. `supabase db reset` did not work on CLI 2.114 — CO-277 has the sequence that did.
- The home screen's folder banner names its absences in the reader's words (`EstateHome.tsx#workspace-absences`),
  landed at `b9d7c89b`.
- Carry-over CO-277…CO-281 (`bb0e6870`): the CLI reset, contract wave 4 (CT-19), RM-28's Fabric packets (verdicts sent
  to passioncode-platform-61, including the PB-144 skill-layer split), the spend-policy projection (Observatory P21),
  two load-sensitive tests. On branch `agent/load-tests`: `quit.test.mjs`'s settle is ordered after the coordinator's
  `setImmediate`; the `.git` watch probe waits up to 20 s; CO-281 stays open for the real-Electron SIGTERM case at
  load 380. CO-261, CO-226, CO-192 and one backlog sentence redacted
  (ADR-0096): they no longer name private agents, their repositories or paths; the rest of the tree is
  heygen-hyperframes-vr-28's redaction pass.
- fabric-agent-contract P6-06 agreed for CO-263: an app with `lifecycle.manager: "person"` writes its descriptor on a
  start where none exists or where its version differs from `installedBy.tool`'s; liveness stays in `hub.json`.

**Open.**
- The workspace publication: the 2-hourly sync failed three times today (a race with a merge, then its internal
  `ci.sh fast` past 30 min at load 300–500). Retry `node scripts/workspace.mjs publish` at a low load, then
  `node scripts/workspace.mjs check --require-child`.
- OrbStack exposes the stack's ports 54321/54322 to the LAN (Fabric's own banner). The fix
  `orbctl config set docker.expose_ports_to_lan false` needs an engine restart that stops every session's
  containers — the operator's decision.
- The machine's lifecycle broker never verifies `fabric.desktop` (`verification_pending`): reported to the broker's
  owner; Observatory OBS-79.
- The COM lane is heygen-hyperframes-vr-28's (agreed 2026-10-12); this run touches nothing in COM-*.
- CO-263 waits for P6-06's DEC and commit; CO-267 (Windows on-host proof), CO-270…CO-280, 0.4.0 P-16.

**Checks run.** `ci.sh fast` green on `b9d7c89b`'s content and on `bb0e6870`'s before its rebase (one post-rebase run
failed only `quit.test.mjs`'s idle-quit case, which this branch fixes); on this branch the fixed cases pass and the
real-Electron SIGTERM case failed at load 380 (CO-281 open); register, plan-id, region and design-map gates on every change.

**Next task.** Retry the workspace publication at a low load; then read the operator's report of the first run.

## Update — 2026-10-13, 00:30

- The workspace was published at `bde534f2` (https://wiki.passioncode.ai, child `0c397afd`; its pin is commit
  `b1839252` on branch `agent/load-tests`, superseded by the next publication). A publication for `e09ad8fb`
  left its child `ea325a4a` on the workspace's main but failed its final gate on the `.git` watch probe: the
  20 s wait of `bde534f2` queued echoes that broke the probe's negative cases. Fixed on `agent/watch-drain`.
- DEC-0069 (CO-263) and DEC-0072 (CO-278, ADR-0109's amendment) are pinned; RM-21's DV-FAB-01/02 are in CO-279.
- Open: ADR register row for ADR-0109 ("amended 2026-10-13") — `docs/adr/README.md` is leased by another run.

**Next task.** Publish from `main` after this lands (`node scripts/workspace.mjs publish`, which resumes from
`ea325a4a` or supersedes it), then `node scripts/workspace.mjs check --require-child`.

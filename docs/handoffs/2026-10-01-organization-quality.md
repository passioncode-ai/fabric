# Organization quality — Fabric source handoff

## Objective and ownership

The operator requested consistent licenses, names, documentation and agent rules across
PassionCode.ai, a common vision-linked backlog in Workspace, and an updated public website.
[ADR-0098](../adr/0098-workspace-federates-repository-backlogs.md) records the source contract.
The multi-repository run index is in org-index `docs/runs/2026-10-01-organization-quality/`.
This repository owns the source selector, source declarations, architecture and living map;
Workspace owns collection and presentation. No native Fabric product feature is added.

## Changes and evidence

- `docs/backlog-sources.json` declares existing Fabric milestone, finding, cost and carry-over
  tables; their IDs and original statuses stay canonical. The source registration is guarded.
  The current execution queue wins explicitly over older milestone summaries through declared
  `excludeIds`; the S1–S6 product slices are also included. Duplicate identities still fail. The registry plan now owns explicit AR-0–AR-11 module
  states linked to its existing acceptance receipts, so the next planned product direction
  appears in the common backlog rather than only in a dated knowledge-base narrative.
- `scripts/workspace-snapshot.mjs` now exports root `BACKLOG.md` and `ROADMAP.md` from member
  repositories. The regression first failed on BACKLOG.md, then all 10 snapshot tests passed.
  Hidden configuration and runtime files remain excluded by the same allow-list test.
- The first `bash scripts/ci.sh fast` attempt failed at
  `apps/desktop/test/claude-control-transport.test.mjs:72`: a 5 ms real clock expired before
  enqueue under concurrent compilation, yielding `not_sent` rather than `outcome_unknown`.
  Lost-reply and timer-starved reply fixtures now control the monotonic clock and assert the
  write boundary explicitly. The pre-send expiry test remains separate; runtime code is unchanged.
- A second fast attempt reached 1,526 passing renderer tests but timed out on draft hydration
  under concurrent cross-repository compilation. The isolated draft suite passed 9/9; the final
  run uses `VITEST_MAX_WORKERS=4` to bound concurrency without skipping any tests or widening assertions.
- The third gate reached the audit regressions and caught the existing pipeline reservation
  falling behind new ADR-0098. Its established collision rule now reserves ADR-0099 through
  agent-sync, preserving historical reservations and applied records; the focused regression passes.
- The living map has `#iteration-2026-10-01-organization-quality` and `#workspace-backlog`.
- `gitleaks dir --redact` scanned 44.23 MB and reported no leaks, exit 0. The generic audit
  collector matched synthetic redaction test inputs; those regex candidates are not live-key evidence.

## Delivery and next task

`VITEST_MAX_WORKERS=4 bash scripts/ci.sh fast` completed with exit 0 after the reservation
correction; stack-backed probes were not run. Final plan/source declarations were also
checked with `bash scripts/check-docs.sh` and `node scripts/check-design-map.mjs` (exit 0).
Commit and land this verified source iteration.
All member source changes must land before exporting the common backlog snapshot. Commit the
Workspace host changes, export through `workspace.mjs` (never edit generated content), run its
strict content/backlog checks, then publish and verify `check --require-child` and `lag`.
The publication receipt supplies the final immutable source/child/release identities.
This source handoff is not a deployment receipt; the owning org-index run records delivery.

Local-only: credentials, raw logs, caches, temporary checkouts and third-party dependencies.
Exact follow-up after publication: take the next ready item from the common backlog using its
canonical source and dependency evidence; do not restart this documentation review from chat.

Independent final source review corrected two overbroad AR statuses: AR-1.5's consumer
pin compatibility and AR-2.5's Fabric-side dashboard action stay partial. The cited
brief proves contract/adapter and Dashboards delivery, not those remaining consumers.
AR-1's module summary now matches that narrower evidence; acceptance text is preserved.

# ADR-0098 — Workspace federates repository backlogs

**Status:** accepted architecture decision; implementation acceptance is recorded separately.
**Date:** 2026-10-01. **Decided by:** the operator's instruction to keep the common backlog in
project Workspace, merge each project's local backlog into it, and make the rule explicit to agents.
Extends [ADR-0093](0093-fabric-workspace-is-the-knowledge-base-agents-read-first-and-update-last.md).

## Context

The knowledge base owns cross-repository direction, while org-index's `BACKLOG.md` owns
cross-repository operational rows and individual repositories own their delivery registers.
Copying these rows into a second editable board would violate one home per fact. Publication
already pins all repositories to commits, but its documentation allow-list omitted root
`BACKLOG.md`: the new regression in `scripts/test/workspace-snapshot.test.mjs` reproduced that omission.

## Decision

1. Fabric Workspace owns the common, read-only backlog and its organization-wide contract in
   `knowledge/backlog.md`. It composes canonical local rows; it never becomes another writable
   task-status database. The published `/backlog` is for people and its JSON representation for agents.
2. Each repository declares its local sources in `docs/backlog-sources.json`. Sources name an
   existing document, a parsing format and a goal from the workspace contract. A task identity
   includes repository, canonical document and stable local ID. Historical rows keep their IDs.
3. Cross-repository tasks have one canonical owner, with links to dependent work. The existing
   org-index `X-*` register remains a source with its history; ownership of the aggregate moves
   to Workspace. New cross-cutting knowledge is edited in Workspace, product work beside its code.
4. Collection uses each publication's immutable source revisions and the host's own deployed
   revision. Each row carries its original status and source location. Unknown task status
   remains unknown. Missing sources, duplicate identities or incomplete repository coverage make
   the aggregate incomplete; none silently becomes an empty or complete backlog. No priority score or delivery date is invented from the goal label.
5. Agents read direction and the common view, edit only canonical local rows under the owner's
   lease, run its gates, land, and publish. Scheduled sync refreshes committed source snapshots;
   publication is asynchronous, so the displayed revision and `workspace.mjs lag` identify freshness.
   This is a merge of source views, not bidirectional synchronization or an automatic Git merge.
6. Root `BACKLOG.md` and `ROADMAP.md` join the export allow-list. Private configuration and
   implementation code remain excluded. The organization checker compares workspace membership
   with its repository inventory, including the host itself and `.github` under `org-github`.

## Consequences

- Existing local formats remain authoritative; adapters and declared columns avoid a mass rewrite.
- Source updates and documentation stay in one change. The common view appears after publication,
  not merely after a branch push. A branch is not a release and a prototype is not runtime proof.
- This is project documentation infrastructure. It does not turn Fabric's runtime into a human
  task tracker, change its anti-vision, or claim that planned CEO orchestration already ships.
- Acceptance: workspace collector regression tests and authenticated route checks, org-index
  `scripts/check_backlog.py`, Fabric snapshot tests, fast gate and strict publication verification.

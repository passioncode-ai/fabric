# ADR-0093 — Fabric Workspace is the knowledge base agents read first and update last

**Status:** accepted architecture decision; changes where cross-cutting knowledge is edited.
**Date:** 2026-09-30. **Decided by:** the operator, naming the Workspace the main working repository and
knowledge base that an agent reads before it starts work and updates after it finishes, and
choosing "Workspace as the main repository" among the options offered, 2026-09-30. **Supersedes in part**
[ADR-0048](0048-fabric-workspace-is-a-versioned-private-publication.md): the Workspace is no
longer only a publication. Its snapshot contract (source pins, digests, receipts) is unchanged.

## Context

Knowledge that belongs to no single repository — the vision of the whole organization, the
principles every product follows, the way agents work, the cross-repository plan, the repository
format — lived in three places: Fabric's `docs/`, org-index `RULES.md`, and each agent's memory.
The Workspace published all repositories' documents (AR-0.5) but nobody edited it, so it could
only ever be as current as its last publication.

## Decision

1. **`knowledge/` in `fabric-workspace` is edited directly** and is the one home of cross-cutting
   knowledge: vision, principles, how to work, the repository standard, products, plans, licensing,
   and the organization's rules (moved from org-index `RULES.md`, which becomes a pointer).
2. **Repository facts stay in their repository** — a product's design, decisions, scenarios and
   code — and reach the Workspace through the snapshot under `repos/<id>/`, as before. A fact has
   one home; `knowledge/` links to it rather than copying it.
3. **The work protocol, in every repository, for people and agents alike:**
   - *Before work:* read `knowledge/` — the local clone `fabric-workspace/knowledge/`
     (`clone_all.sh` makes it) or wiki.passioncode.ai — then the repository's `AGENTS.md`.
   - *After work:* if a cross-cutting fact changed, update `knowledge/` in the same run; update
     the repository's own docs in the change; then publish (`node scripts/workspace.mjs publish`
     from a Fabric checkout) or leave it to the sync job.
4. **The host serves `knowledge/` from its own deployed commit** as the first section of the
   wiki. It is covered by the deployment identity the publisher already verifies
   (`deployment.workspace_commit`), not by the source snapshot.
5. **Kept current by a job, not by memory:** `node scripts/workspace.mjs sync` publishes when
   `lag` reports a stale source or `knowledge/` moved; run on a schedule on the operator's Mac.
   This resolves brief CO-AR-09.

## Consequences

- Every repository's `AGENTS.md` opens with the protocol above; the org `CONTRIBUTING.md`, the
  `working-in-passioncode` skill and the launcher's session-start line say the same.
- Links to org-index `RULES.md` are repointed to `knowledge/rules.md`.
- An agent without access to the private wiki still has the knowledge through the clone.

# ADR-0136 — A folder joins a project by a pick or by consent

**Status:** accepted · 2026-10-11 · resolution R-05 and R-06 of the
[0.4.0 plan](../evidence/plans/2026-10-11-release-040-agents-first.md#decisions) (from the operator's request that
projects join Fabric's working list when we work on them and repositories are attributed to the right project) ·
amends [ADR-0100](0100-first-run-and-start-paths.md) §7 (the folder boundary) · plan row P-16, canvas node C2,
REQ-05.

## Context

Fabric reads only folders the person chose in a picker, or the candidates of its own scan (ADR-0100 §7). A folder is
matched to a Project by its exact real path only (`startChoices.ts#indexImported`), so a worktree, a subfolder or a
second clone of the same repository matches nothing; `project_repos` stores no remote and allows one path in two
projects (`…000003_onboarding_foundations.sql`). With [ADR-0134](0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md)
an agent reports from whatever folder it runs in; silently admitting that folder would break the boundary, and
refusing it would keep the work invisible.

## Decision

1. **One resolver**, `resolveProjectForFolder(path) → {projectId | null, how, confidence}`, tries in order: the
   exact real path; the longest admitted ancestor; the main repository of a worktree (`git rev-parse
   --git-common-dir`); the normalized remote (`host/owner/name`, scp form folded into https, `.git` removed, never a
   credential); Observatory's repository-to-project map as a **suggestion** only.
2. **A second way in: consent.** When an agent first reports from a folder no Project holds, the operator is asked
   once: log the work under the matched Project / a new Project / don't log here. Allow admits *that folder* exactly
   as a pick would — the same `admitRepoPaths` rules, a too-broad folder still refused — and journals
   `project.repo.attached@1` with `admitted_by: consent`. Silence admits nothing.
3. **One folder, one Project.** `project_repos` gains `remote_key`, `kind` (`primary | checkout | worktree`) and
   uniqueness on (estate, real path); extra clones and worktrees of a Project's repository join it as non-primary
   rows.
4. **Observatory owns estate identity** (which repositories implement which project); Fabric keeps a link
   (`projects.observatory_id`), never a copy of the map.

## Consequences

- A migration (two columns, a unique index — existing duplicates reported, not dropped), the resolver module with
  unit tests for worktrees, scp remotes and ancestors, the consent prompt beside the enrollment prompt.
- ADR-0100 §7 now reads: Fabric reads folders the person chose in a picker, its own scan's candidates, **and folders
  the operator admitted on an agent's report**.

## Evidence

- The manager-flow research, 2026-10-11 (the plan, canvas C2: `startChoices.ts#indexImported`, `projectDiscovery.ts#shownRemote`,
  Observatory `survey.py:39-59`).

## Amendments

### Amendment 1 — 2026-10-11: §2 is not built yet

Wave 1 built resolution by pick and by the folder of an admitted repository or its worktree
(`folderResolver.ts#resolveProjectForFolder`, ADR-0134 amendment 2). §2 — a folder that belongs to no project admitted
on the agent's report and the operator's consent — is wave 2's (REQ-05); until then such a folder answers `no-project`
and the agent is told to open it in Fabric first (SCN-137).

### Amendment 2 — 2026-10-17: automatic registration through the canonical enrollment path

ADR-0160 changes §2 on the operator's own machine: an eligible unknown Git repository or worktree no longer waits for
a consent prompt or a separate **+ Project → Open a project** step. `fabric.session.enroll` first proposes the folder's
deterministic project identity without writing. The normal `fabric.access.request` path validates the coding agent and
standing denial, then `projectAdmission.ts` creates or attaches through the same journal/projector functions used by
IPC. `session.enroll` is allowed at once as the coding agent's own act. No Electron event is fabricated, and no
Switchboard or Project Observatory store is read as a write target.

The resolver now covers exact, longest-ancestor, worktree and normalized remote identity, in that order. Two matching
Projects are an ambiguity and are refused. A non-Git folder, home or filesystem root is refused. An archived Project or
a detach recorded by the operator is not resurrected; `project_repo_removals` holds the tombstone until an explicit
attach clears it. Re-entry is idempotent, including a retry after project creation but before the enrollment grant.

The decision this amendment carries out is recorded as [ADR-0164](0164-a-folder-with-no-project-is-attributed-by-fabric-never-handed-to-the-person.md).

Evidence: `apps/desktop/test/folder-resolver.test.mjs`, `project-admission.test.mjs`,
`session-enroll-request.test.mjs`, `session-enroll.test.mjs`, and the repository-identity group in
`command-ingress-db.test.mjs` (every migration through `20261018000114` on an owned disposable PostgreSQL cluster).

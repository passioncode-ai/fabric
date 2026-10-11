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

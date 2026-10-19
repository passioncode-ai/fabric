# ADR-0166: One attribution of folders to projects across Fabric, Switchboard and Observatory

**Status:** accepted · 2026-10-19 · records the operator's instruction of 2026-10-19 (coding agents attribute the
folders they work in automatically; a new repository is a new project, a worktree or another branch joins the existing
one; one attribution system through Observatory, Switchboard and Fabric) · amends
[ADR-0164](0164-a-folder-with-no-project-is-attributed-by-fabric-never-handed-to-the-person.md) and builds
[ADR-0136](0136-a-folder-joins-a-project-by-a-pick-or-by-consent.md) §4 · cross-repository run
[org-index `docs/runs/2026-10-19-unified-attribution`](https://github.com/passioncode-ai/org-index/blob/5fb77fe/docs/runs/2026-10-19-unified-attribution/README.md)
· CO-331, CO-329.

## Context

Since the 2026-10-17 run, Fabric, Fabric Switchboard and Project Observatory each register a coding agent's folder on
their own. Each keeps its own rules and its own id: Fabric a UUID derived from the main checkout's path
(`folderResolver.ts#folderProjectId`), Switchboard a pool slug, Observatory `project:<slug>`. Measured on 2026-10-19
they give different answers for a plain folder, for an agent started in a subfolder of a repository, for a repository
whose owner a project lists and for a repository a project's agent worked in, and none records the others' ids. The run
index holds the measured table.

## Decision

1. **The rules are the contract's.** Folder attribution is one rule set with vectors in fabric-agent-contract (the run's
   D1, D2). Fabric runs those vectors in its gate and keeps no rule of its own beside them. Until the decision is
   pinned, ADR-0164's rules stand, with the corrections below that the run already decided.
2. **A folder is rooted at its Git top level.** A coding agent started in a subfolder of a repository attributes the
   repository, not the subfolder: the top level (`git rev-parse --show-toplevel`), then the main checkout for a
   worktree. Only a folder outside Git is rooted at itself.
3. **A tombstone is the folder's.** A detach keeps automation off that folder. It no longer keeps every other clone of
   the same remote off as well; another clone the agent opens attaches by remote as before.
4. **The owner and work rules** (Switchboard's ranks, CO-329) join at the ranks the contract gives them.
5. **The canonical id is Observatory's `project:<slug>`.** Fabric keeps its own Project id for its own storage and
   records the canonical one beside it (`projects.observatory_id`, ADR-0136 §4). At admission Fabric asks Observatory's
   attribution capability for the folder and reports its own id as the alias `fabric:<uuid>`. When Observatory does not
   answer, Fabric attributes by the same rules locally, journals the act as it does today, and reports the alias when
   Observatory answers again. A conflict between the two answers is reported, never resolved by guessing.
6. **Storage is unchanged.** Fabric writes only its own database; it never writes Observatory's or Switchboard's files.

## Consequences

- The same folder gets the same canonical project in the three products, and Fabric's Project carries that id.
- Decisions 2 and 3 change Fabric's behaviour now; 4 and 5 follow the contract decision and Observatory's capability,
  which their owners build (requests on the project board, thread `617c8cbe`).
- A Fabric Project created before decision 5 lands has no canonical id until its next admission or a backfill pass.

## Evidence

- Code: `apps/desktop/src/main/sessionEnroll.ts#resolveAgentFolder`, `apps/desktop/src/main/projectDiscovery.ts`,
  `apps/desktop/src/main/projectAdmission.ts#enroll`.
- Tests: `apps/desktop/test/session-enroll.test.mjs`, `apps/desktop/test/project-admission.test.mjs`,
  `apps/desktop/test/automatic-registration-scenario.test.mjs`.

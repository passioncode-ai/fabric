# ADR-0164: A folder with no project is attributed by Fabric, never handed to the person

**Status:** accepted · 2026-10-18 · records the operator's instruction of 2026-10-17 (a coding agent in a folder that
is no project yet must not be told to have a person add it in Fabric; projects add themselves, the history shows when
and by which agent, and a project's new folder is attributed to it automatically, "like Switchboard") · applies
[ADR-0160](0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md) to the folder of an
enrolling coding agent · the mechanism is
[ADR-0136](0136-a-folder-joins-a-project-by-a-pick-or-by-consent.md) amendment 2, which replaces §2's consent step ·
retires the "the person's step" answer of
[ADR-0134](0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md) · CO-328.

## Context

A coding agent with `fabric-mcp` registered enrolls from the folder it runs in (`fabric.session.enroll`, ADR-0134).
Until this decision a folder no admitted folder held answered `no-project` with a sentence telling the agent that
adding it is the person's step, in Fabric (+ Project → Open a project), and that it must never create a project
itself. ADR-0136 §2 planned a consent prompt for such a folder; it was never built (ADR-0136 amendment 1). The operator
complained about exactly that sentence.

Two implementations were written on 2026-10-17 in parallel: run `r-r9631f5d5219` (branch
`agent/auto-project-registration-20261017`) and Fabric's own session for CO-328 (branch `agent/co328-auto-attribution`,
kept for reading). Fabric keeps the first: one admission service, repository identity in the database and detach
tombstones. The second's owner rule and work rule are carried as CO-329.

## Decision

1. **Resolution first.** The exact admitted folder, the longest admitted ancestor, a worktree of an admitted
   repository, then the normalized `origin` remote (`folderResolver.ts#resolveProjectForFolder`). Two Projects
   matching at one step is an ambiguity, refused; Fabric does not guess.
2. **Otherwise Fabric attributes the folder itself.** An eligible unknown Git repository or worktree gets a Project
   whose id is derived from the estate and the main checkout's real path (`folderResolver.ts#folderProjectId`), named
   after that folder, with the main checkout attached as primary; a worktree of an unknown repository creates at its
   main checkout. A clone of a known repository attaches as a checkout by remote. `session.enroll` proposes without a
   write; `fabric.access.request` checks the runner and a standing denial first, then the one main-process admission
   service (`projectAdmission.ts`) writes, and the grant follows at once on the operator's own machine (ADR-0160).
3. **Refusals name the agent's own next step.** Not inside a Git repository, a home folder or filesystem root, an
   ambiguity, an archived Project or a folder the operator detached: `no-project`, with a sentence that never hands the
   folder to the person (`sessionEnroll.ts`, region `session-enroll`).
4. **Every attribution is the agent's act, in the journal.** `project.created@1` and `project.repo.attached@1` with
   the actor `{kind: agent, id: <runner>}` and `admitted_by: agent`; the access request and decision are recorded as
   the coding agent's own.
5. **Undo is the inverse act, and automation respects it.** A detach (`project.repo.detached@1`) leaves a tombstone in
   `project_repo_removals`; automatic enrollment does not attach that folder or remote again. An explicit attach,
   including undoing the detach, clears the tombstone.

## Consequences

- No separate **+ Project → Open a project** step stands between a coding agent and its Project.
- Switchboard's two further rules are not built yet: an origin owner the project lists, and a repository that a
  project's agent changes from inside that project's folder (`crates/switchboard-runtime/src/suggest.rs`). CO-329.
- A worktree is attributed through its main checkout and gets no row of its own; worktrees come and go.

## Evidence

- Code: `apps/desktop/src/main/folderResolver.ts`, `apps/desktop/src/main/projectAdmission.ts`,
  `apps/desktop/src/main/sessionEnroll.ts`, `apps/desktop/src/main/accessService.ts`, the wiring in
  `apps/desktop/src/main/index.ts` (region `session-enroll-wiring`), migration
  `supabase/migrations/*_project_repo_identity.sql`.
- Tests: `apps/desktop/test/automatic-registration-scenario.test.mjs` (two rounds over real repositories, a worktree
  and a clone), `project-admission.test.mjs`, `folder-resolver.test.mjs`, `session-enroll.test.mjs`,
  `session-enroll-request.test.mjs`, the repository-identity group of `command-ingress-db.test.mjs`.

## Amendments

**2026-10-18, a plain folder too (the operator: «добавление всегда авто»).** A folder that is not inside a Git
repository is no longer refused: it becomes its own Project the same way a repository does, named after the folder,
journalled as the agent's act and undoable by its detach. Decision 3's first refusal goes. What stays refused is a
container: a filesystem root, the home folder, a folder right under home (Documents, Desktop, Downloads, the work root),
and a plain folder that already holds another Project's folder. A plain folder is only ever created, never attached to
an existing Project, because it has no remote or worktree to match by (`sessionEnroll.ts#resolveAgentFolder`,
`projectAdmission.ts#enroll`). Tests: `session-enroll.test.mjs` (a plain folder becomes its own project; a container
is too broad, both watched failing first), `automatic-registration-scenario.test.mjs`, `project-admission.test.mjs`.


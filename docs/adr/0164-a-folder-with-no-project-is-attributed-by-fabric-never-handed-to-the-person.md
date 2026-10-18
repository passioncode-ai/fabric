# ADR-0164 — A folder with no project is attributed by Fabric, never handed to the person

**Status:** accepted · 2026-10-18 · records the operator's instruction of 2026-10-17 (a coding agent in a folder that
is no project yet must not be told to have a person add it in Fabric → + Project; projects are added by themselves and
the history shows when and by which agent; a project's new folder is attributed to it automatically, "like Switchboard
does now") · applies [ADR-0160](0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)
(act, record, undo) to the folder of an enrolling agent · reverses [ADR-0136](0136-a-folder-joins-a-project-by-a-pick-or-by-consent.md)
§2 (the consent step) and the "the person's step" answer of [ADR-0134](0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md)
amendment 6 · CO-328.

## Context

A coding agent with `fabric-mcp` registered enrolls from the folder it runs in (`fabric.session.enroll`, ADR-0134).
Until this decision Fabric resolved that folder by the exact admitted path, the longest admitted ancestor or a
worktree's main repository (`folderResolver.ts#resolveProjectForFolder`), and any other folder answered `no-project`
with a sentence telling the agent that adding the folder is the person's step, in Fabric (+ Project → Open a project),
and that it must never create a project or attach a folder itself (`sessionEnroll.ts#NO_PROJECT_MESSAGE` before this
change). ADR-0136 §2 planned a consent prompt for such a folder; it was never built (ADR-0136 amendment 1).

The operator's rule since ADR-0160 is that on their own machine an act happens at once, is recorded with its actor and
can be undone; a dialog — or a sentence that hands the act to the person — is not the boundary. Switchboard already
attributes folders this way (`crates/switchboard-runtime/src/suggest.rs`, `classify`: a worktree, a clone with the same
normalized origin, an origin owner the project lists; a tie is no answer).

## Decision

1. **Resolution first, unchanged.** The exact admitted folder, the longest admitted ancestor, a worktree of an
   admitted repository (`resolveProjectForFolder`). A worktree is resolved, never attached: worktrees come and go, and
   its main checkout already names the project.
2. **Otherwise Fabric attributes the folder itself** (`folderResolver.ts#decideAttribution`), in this order, the first
   single answer winning; two projects matching at one step is a tie, which that step leaves unanswered:
   1. **Refused** when the folder, or the checkout it is in, is too broad (a filesystem root, the home folder or a
      folder above it — `files.ts#isTooBroad`, so a dotfiles repository rooted at the home folder is refused too);
      when it is not inside a git repository (Fabric makes a project only of a repository; the agent is told to
      `git init` or to work inside one); or when the checkout holds folders of projects Fabric already has (projects
      never nest — `~/DATA` is refused this way).
   2. **`same-remote`** — the one project holding a repository whose `origin` has the same normalized key
      (`host/owner/name`, lower case, scp and https folded, `.git` and any user removed —
      `shared/workClaims.ts#remoteKey`). A second clone joins its project.
   3. **For an agent already working in projects** (the projects its binding holds a live `session.enroll` grant on):
      **`sibling`** — its project is the only project with folders in the checkout's parent folder (that parent not
      too broad); **`owner`** — its only project with a repository of the same remote owner (`host/owner`). This is
      "a project has several folders and a new one is created": the project's own agent attributes it.
   4. **`owner`** — the only project in the estate with a repository of that owner.
   5. **`new-project`** — a new project rooted at the checkout's top level (`git rev-parse --show-toplevel`; for a
      worktree, its main checkout), named after that folder, its folder attached as primary, and the asking runner as
      its default agent.
   An archived project takes no folder; its folders still count for "holds other projects' folders". The remote is
   read when it is needed (the bounded, hardened `agentSyncLeases.ts#originOf`, cached five minutes), never stored:
   no migration, and a remote that changes is read as it is now.
3. **Every attribution is the agent's act, in the journal.** `project.repo.attached@1` (and before it, for a new
   project, `project.created@1`), with the actor `{kind: agent, id: <runner>}` — the binding's runner, or through the
   hub's door the runner the agent names (`runner`, recorded with `via: door`), an unnamed one as `coding-agent` — and
   the payload's `attributed: {cause, runner, via, binding_id, runtime_session_id, remote_key}`
   (`shared/commandIngress.ts` checks it). The main process does it, not a window (`folderAttribution.ts`), one
   attribution at a time and resolving again first, so two agents starting in one new folder make one project. The
   answer the agent gets says what Fabric did (`attributed: {cause, created}` and one sentence), and the enrollment
   goes on: the door names the project to ask for, a binding with a grant gets its session.
4. **Undo is the inverse act, never a deletion.** An attach is undone by `project.repo.detached@1`; a made project
   by detaching its folder and `project.archived@1`. Both inverses exist in the journal's vocabulary today; История
   and its **Отменить** are the 0.3.7 plan's wave 2. An attribution undone by the person must not be made again by
   the next enrollment from that folder: that memory belongs to the same wave (the inverse act records it), and until
   it ships an undone folder is attributed again on the agent's next start.
5. **What the agent is told.** A refusal answers `no-project` with `reason` (`too-broad`, `not-a-repository`,
   `contains-projects`) and a sentence naming the agent's own next step; nothing in it is the person's step. The
   read-only paths (the access ask's folder check) say that enrolling from the folder attributes it.

## Consequences

- ADR-0136 §2 (consent) is replaced by §2 above; §1's "Observatory's suggestion" and §3's stored `remote_key` and
  `kind` are not needed for this and stay unbuilt. ADR-0134 amendment 6's "the person's step" sentence is retired.
- The enrollment ask that follows still needs the operator's grant until the 0.3.7 plan's wave 3 lets the coding agent
  in (ADR-0160 §3); this decision removes only the folder step before it.
- An agent working in an unrelated new repository of the same owner as one project's repositories will put it in that
  project. That is the rule the operator asked for ("like Switchboard"); the record and its inverse are the remedy.

## Evidence

- The operator's instruction, 2026-10-17 (CO-328).
- Code: `apps/desktop/src/main/folderResolver.ts` (regions `folder-resolver`, `folder-attribution`),
  `apps/desktop/src/main/folderAttribution.ts`, `apps/desktop/src/main/sessionEnroll.ts` (region
  `session-enroll-attribute`), the wiring in `apps/desktop/src/main/index.ts` (region `folder-attribution-wiring`).
- Tests: `apps/desktop/test/folder-attribution.test.mjs` (each rule, ties, refusals, the act, its serialization),
  `apps/desktop/test/session-enroll.test.mjs` (the enrollment attributes, then goes on),
  `apps/desktop/src/shared/commandIngress.test.ts` (the `attributed` payload).
- Switchboard's `classify`, `crates/switchboard-runtime/src/suggest.rs` (fabric-switchboard), read 2026-10-18.

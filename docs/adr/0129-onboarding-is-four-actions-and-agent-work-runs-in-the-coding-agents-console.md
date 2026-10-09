# ADR-0129 — Onboarding is four actions, and the agent work runs in the coding agent's console

**Status:** accepted · 2026-10-08 · operator decisions D1–D4 of the
[onboarding brief](../evidence/plans/2026-10-08-onboarding-four-actions.md) (asked one at a time, each with a
recommended answer; the operator took every recommendation) · amends
[ADR-0100](0100-first-run-and-start-paths.md) §5 and §6 · applies [ADR-0123](0123-the-conversation-is-the-runtimes-console-and-the-ceo-is-a-session.md) ·
plan row P-14 · found missing by the 0.3.3 verification, iteration 1 (PL-7, DO-4).

## Context

ADR-0100 made the start a menu of five paths. Two of them were about agents: §5, "a new agent", meant a role agent
inside an existing project (SCN-130), reached by choosing the project and opening its team; §6, "converting an
agent", was to run inside Fabric — a dry run, then a registry entry for an agent that passed the probe — and until
AR-7/AR-11 built it the menu showed it as planned.

On 2026-10-08 the operator asked for Fabric to be the way into the PassionCode.ai ecosystem: the onboarding offers
four actions — create your own agent, turn an agent built elsewhere into an ecosystem agent, open a working
project, create a project — and the work inside happens in the consoles of coding agents the person already uses,
"so that we do not build chats of our own" (ADR-0123). That reverses what §5 and §6 say an agent action is.

## Decision

1. **The start menu and the first run's last step offer four actions in two pairs** (SCN-126, SCR-70):
   *Agent* — create one (SCN-136, SCR-74), adapt one built elsewhere (SCN-131, SCR-75); *Project* — open one
   (one folder, SCN-127, or a folder of them, SCN-128), create one (SCN-129).
2. **"Create an agent" is a new ecosystem agent with a repository of its own (D1)**, not a role inside a project:
   Fabric creates the folder as a git repository and a Project for it, then starts the chosen coding agent there
   with the `creating-fabric-agents` skill, which asks its intake questions in the console. The role agent of
   §5 (SCN-130) stays, reached from the project's Team only.
3. **"Adapt an existing agent" runs in the coding agent's console with `adapting-projects-to-fabric` (D2)**, on a
   new branch `fabric-adapter` taken from the branch the folder is on, after the agent has shown its plan and had
   a yes; a folder that is not yet a repository is committed as it is first, with anything that looks like a
   secret kept out. Fabric writes nothing in the folder. It does not admit the agent to the registry: the skill's
   conformance report says what passed, and admission stays AR-7/AR-11's (the registry plan), unchanged.
4. **Fabric checks the Fabric Agent Adapter skills and installs nothing (D2).** Before either agent action starts it
   says whether the two skills are where the chosen coding agent reads skills, with the version — or the one
   command that installs them, to copy, and says when that command does not cover the chosen agent.
5. **The coding agent is chosen in the form (D3)**: the first one in the operator's fallback order (ADR-0125) that
   is installed and answers, else the first found; the hint says which rule chose it.
6. **A retry is the same attempt.** The window names the Project and the task before the first try; a retry after a
   failure reuses them (`main/taskRetry.ts`), brings forward a session that is still running, and never makes a
   second folder, Project or task. Another coding agent after a failed launch is a new task in the same Project.
7. **0.3.3 ships this (D4)**, with everything done since 0.3.2; self-update (P-12) moves after it.

## Consequences

- ADR-0100 §5 and §6 are superseded by points 2 and 3.

<a id="boundary"></a>
**The boundary.** ADR-0100 §7 still holds for every folder a start path reads, creates or attaches: only folders
chosen in this window's picker (or made by it), refused otherwise before anything is journalled. The skills check
(point 4) is the one read outside it: it reads the coding agents' own configuration — `~/.claude/settings.json`,
`~/.claude/plugins/installed_plugins.json` (or `CLAUDE_CONFIG_DIR`), the agents' skills folders and
`~/.agents/skills` — as regular files only, a bounded size and a bounded time each, and grants nothing: it reports
whether two skills are there and names a file it could not read.
- AR-7 (agent production, SCN-121…123) and AR-11 (conversion with admission) keep their scope: the console route
  produces an agent and a conformance report; registering and admitting it is still theirs. SCN-121 ("ask Fabric
  to make a new agent") and SCN-122 now sit beside SCN-136 and SCN-131 and are re-read when AR-7 is planned.
- The CEO conversation itself is not retired by this record; that is P-13 (ADR-0123), after 0.3.3.

## Evidence

- Brief and decisions: [`2026-10-08-onboarding-four-actions.md`](../evidence/plans/2026-10-08-onboarding-four-actions.md).
- Code: `apps/desktop/src/renderer/src/start/StartPaths.tsx#StartCards`, `start/AgentPaths.tsx`,
  `apps/desktop/src/main/adapterSkills.ts`, `apps/desktop/src/main/taskRetry.ts`, `apps/desktop/src/shared/builderChoice.ts`.
- Tests: `apps/desktop/src/renderer/src/start/StartPaths.test.tsx`, `apps/desktop/test/adapter-skills.test.mjs`,
  `apps/desktop/test/task-retry.test.mjs`, `apps/desktop/src/shared/builderChoice.test.ts`.

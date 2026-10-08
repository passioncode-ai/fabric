# Plan · 2026-10-08 · Onboarding into the ecosystem: four actions (0.3.3)

Operator request, 2026-10-08 (in Russian, summarised): the onboarding is built around four actions — **create your
own agent**, **turn an existing agent into an ecosystem agent**, **open a working project**, **create a new project**.
Fabric is the person's onboarding into the PassionCode.ai ecosystem: it helps build new agents and adapt existing
ones, and the work happens inside the consoles of the coding agents the person already has — Fabric builds no chat
of its own, as in the other projects of the ecosystem ([ADR-0123](../../adr/0123-the-conversation-is-the-runtimes-console-and-the-ceo-is-a-session.md)).
Then: work the UX of every start screen until no question remains, test, update the docs, release.

Run: `task-pipeline` (Proof of Done), run r-9a7a12bb5. Prior iterations the same day: launch chrome and Russian
(`a7fa444c`), the scan's purpose and «Set up with the agent» (branch `agent/onboarding-scan-20261008`, `c1d0b426`).

## Decisions (grill, operator 2026-10-08)

| # | Question | Answer |
|---|---|---|
| D1 | What «create your own agent» means | a **new ecosystem agent** — its own repository, built by a coding agent in its console with the `creating-fabric-agents` skill; the in-project role agent (SCN-130) stays on the project's team |
| D2 | How «turn an existing agent into an ecosystem agent» works | **through the agent's console**: the folder becomes a project; the coding agent adapts it with `adapting-projects-to-fabric` on its own branch — plan first, then the conformance probe. Fabric checks the skills are installed and shows the install command; it installs nothing itself |
| D3 | Who does the work | a **choice in the form**, defaulting to the first available agent in the operator's fallback order (ADR-0125), usually Claude Code; unavailable ones listed with why |
| D4 | What 0.3.3 ships | everything done today **plus** the four actions, released through CI by the runbook — three verification iterations, the operator's approvals by direct link |

Recorded, not asked: the design is text-only plus the prototype — Figma is off for this product
(`docs/ux/screens.md` → Design system).

## Sources

| Source | What it holds for this task |
|---|---|
| `docs/evidence/retro.md` | R-006 (a check counts only once watched failing), R-009 (an environment-stopped gate is no verdict on the later steps), R-010 (a surface is verified the way its user meets it) |
| `docs/evidence/backlog.md` | 185 of 226 carry-over rows open; CO-221 (main-process English), CO-225 (prototype gaps) touch onboarding |
| `docs/evidence/verification.md` | 84 rows at `never` |
| `docs/ux/scenarios.md` | SCN-126 first run, SCN-127 add, SCN-128 scan, SCN-129 new project, SCN-130 agent in a project, SCN-131 convert (planned only) |
| ADR-0123, ADR-0125 | the console is the conversation; the fallback order picks a runner |
| `fabric-agent-adapter@passioncode` 0.8.0 | `creating-fabric-agents`, `adapting-projects-to-fabric` (contract 0.1.0); installed by `npx @passioncode-ai/passioncode@latest update` (0.1.30) |
| Code graph | none — `graphify-out/` is not built in this repository |

## REQ table

Frozen: adding is free, removing needs the operator.

| REQ | Requirement | Verified by |
|---|---|---|
| REQ-01 | The start menu and first-run step 3 lead with four actions in two pairs — Agent: Create · Turn an existing one into an ecosystem agent; Project: Open · Create — and nothing else competes with them | `StartPaths.test.tsx`; ru/en walk |
| REQ-02 | Create an agent: name, what it does, where its folder goes, which coding agent builds it → a new folder (a git repository on `main`) and a Project whose purpose is what it does → the coding agent's console opens with the build instruction (`creating-fabric-agents`) | unit and integration tests; a runtime probe that the console opens |
| REQ-03 | Turn an existing agent into an ecosystem agent: choose its folder → what Fabric found and what will happen (own branch, plan first, probe) → the coding agent → the folder becomes a Project (or the one that already holds it) → the console opens with the adapt instruction (`adapting-projects-to-fabric`); Fabric itself never touches the main branch | tests; runtime probe |
| REQ-04 | Before either agent action, Fabric says whether the Fabric Agent Adapter skills are installed — for Claude Code (its enabled plugin) and in the shared skills folder — with the version, or the install command with Copy; it never installs | detection tests with planted homes |
| REQ-05 | Open a working project offers both ways — one folder, or scan a folder of repositories — under one action | tests; walk |
| REQ-06 | Create a new project is the existing new-project form (SCN-129), reached from the same menu | walk |
| REQ-07 | The role agent of SCN-130 is reached from a project's Team, not from the onboarding menu | test; walk |
| REQ-08 | Every start screen, in ru and en, at 1280 and 1440: no English in the Russian window, nothing past the window, every state says what happens next and what is not done | walk receipts; `ux-audit` |
| REQ-09 | Docs: SCN-126/130/131 rewritten and a scenario for creating an agent; flows and screens; the prototype; the knowledge base; release notes | linters, design map, product report |
| REQ-10 | Release 0.3.3 through CI by `docs/launch/release-mac.md`, three verification iterations, approvals by direct link | the release run and its receipts |

## Modules and state (handoff)

| Module | What | REQ | State |
|---|---|---|---|
| M1 | start menu and first-run step 3 in two pairs; «Open» joins one folder and the scan | 01, 05, 06, 07 | next |
| M2 | Create an agent: form → folder + git (`projectFolder`) → `projects.create` → `tasks.start` with the build instruction → `windows.openSession` | 02 | open |
| M3 | Turn an existing agent into an ecosystem agent: folder → `start.inspect` facts + the four steps → `tasks.start` with the adapt instruction on its own branch | 03 | open |
| M4 | adapter-skill detection per agent: Claude Code's enabled plugin `fabric-agent-adapter@passioncode` or `~/.claude/skills`, the agent's own skills folder, the shared `~/.agents/skills` (said as "shared; whether this agent reads it is not checked") | 04 | open |
| M5 | scenarios (SCN-126 step 3, SCN-130 → Team, SCN-131 real, a new create-agent scenario), screens, prototype, copy, `ux-audit` of every start screen | 08, 09 | stage 3 started: `ux-scenarios` Update workflow |
| M6 | release 0.3.3 by `docs/launch/release-mac.md` | 10 | open |

Grounding read for the instructions (stage 1): `creating-fabric-agents` opens with an intake grill in the console and
creates no file until every row is answered; `adapting-projects-to-fabric` runs inspect (no execution) → pin the
contract → scaffold → implement → `adapt_project.py check` → conformance report. So Fabric's form needs only a name,
what it does, a folder and the coding agent; the agent asks the rest in its own console.

**Exact next task:** M5's scenario edits in `docs/ux/scenarios.md` (Update workflow, entries back to `draft`), then M1.

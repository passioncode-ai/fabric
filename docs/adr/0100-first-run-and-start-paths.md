# ADR-0100 — The first run and the start paths

**Status:** accepted; implemented for the first run, adding a project, scanning a projects folder,
creating a project and the entry to a new agent; converting an agent is designed, not built.
**Date:** 2026-10-03. **Decided by:** the operator, in the grill of run
`2026-10-03-onboarding-and-plan` ([brief](../evidence/plans/2026-10-03-onboarding-and-plan.md),
decisions D1–D5). **Amends:** [ADR-0063](0063-ceo-first-discovery-and-explicit-continuation.md)
§1 (the name is a step of its own, not only an immediately usable default) and §3 (the coding-agent
check informs and can be skipped; it is not a gate before the folder); [ADR-0065](0065-conversation-led-work-and-context-bundles.md)
§1 where selected folders formed one Project with related sources — a scan is now a checklist of
separate Projects; SCN-095 step 4 and ONB-01 of `docs/launch/ceo-onboarding.md`;
`docs/launch/single-entry.md` and FLW-55's "no personalisation form"; SCN-015's recipe model as the
default for converting an agent. Everything else in ADR-0063 and ADR-0065 stands.

## Context

The six ways a person starts with Fabric were specified three times over and built once. The code
created a project from one form (`Onboarding.tsx#save` → `IPC.projectsCreate`) and an agent from a
prompt (`IPC.agentsCreate`); there was no first run, no folder scan and no conversion. The UX layer
contradicted itself: SCN-095 made every repository in a parent folder ONE Project, ONB-01 said a scan
creates no Project at all, `single-entry.md` forbade a personalisation step that FLW-55 still drew,
and converting an agent had two incompatible models (SCN-015 copy a recipe out; SCN-122 Fabric drives
it). The operator settled each one.

## Decision

<a id="first-run"></a>
1. **The first run** (SCN-126, SCR-70) is three steps, each skippable: *your Fabric* — a name and a
   look (persona: name, character, variant), which changes how Fabric looks and never what it may
   do; *coding agents* — Claude Code and Codex detected on PATH by `--version`: **ready** (installed and
   connected to Fabric's tools — `connected` is the runner catalogue's `connectsToSurface`, not a
   measurement), **installed** (runs in a folder as itself, not connected — Codex today),
   **needs setup** (installed, did not answer: run it once; no install command is offered), **not
   installed** (the vendor's install command); sign-in is not verified here (CO-176); *where to start*
   — the start paths. It is shown once,
   to an estate with no project, and only after the project list is known; finishing or skipping
   stamps `settings.firstRun.completedAt`. Help reopens it. An installation with projects is never
   walked back through it.
<a id="add-project"></a>
2. **Adding a project** (SCN-127, SCR-71): one folder from the native picker → a read-only preview
   (git kind, branch, remote, last commit, stack, and the projects that already hold it) → the
   operator confirms a name → `projects.create` with the folder attached. A folder already in a
   project offers that project instead of a duplicate. A plain folder may be added and says what
   Fabric will not see.
<a id="scan"></a>
3. **Scanning a projects folder** (SCN-128, SCR-72) is a CHECKLIST. A bounded, cancellable,
   read-only, breadth-first walk lists every repository under the chosen folder; worktrees are grouped
   under their repository and nested repositories under the enclosing one; **each ticked repository
   becomes its own Project**; nothing is created without a tick; "Tick all shown" ticks the head of
   each product only — a worktree or nested part becomes a Project only when ticked by hand, with a
   warning; already-imported repositories are marked and cannot be ticked; the last scan is kept and
   shown, and adding from it later goes through the checked create. Dependency trees, build output and
   similar noise-named folders are not entered (but one that is itself a repository is listed); hidden
   folders and symlinks out of the chosen folder never are. The walk runs git only through
   `gitRun.ts` with every config-driven program switched off — signature, pager, fsmonitor, hooks,
   repository-defined filter and diff drivers — lazy fetch off and every transport refused, so a
   repository's own config cannot make the scan execute anything (amended after verification
   iteration 2, which ran a planted uploadpack through a partial clone); a remote URL loses its credentials before it is shown or kept. What the walk could not
   cover is said: stopped by its bound, folders that could not be read (a folder read abandoned after
   its timeout, and a repository whose inspection failed, count here), folders past the depth limit,
   linked folders not followed, and a scan whose list could not be kept. The walk finds repositories
   first and inspects them afterwards, a few at a time, so slow ones cannot starve the rest.
   Re-scanning on a schedule is not built (CO-177).
<a id="new-project"></a>
4. **Creating a project** (SCN-129, SCR-73): a name, an optional purpose, and a home — a new folder
   under a chosen parent (optionally `git init`) or only an idea with no folder yet.
<a id="new-agent"></a>
5. **A new agent** (SCN-130, SCR-74) belongs to a project: the path chooses the project and opens
   its team, where the existing agent form (`CreatedAgents.tsx#CreatedAgents`) lives.
<a id="convert"></a>
6. **Converting an agent** (SCN-131, SCR-75) happens inside Fabric with a plan: choose the agent's
   folder → a dry run lists the manifest, the MCP entry and every file that would change → the
   operator's coding agent writes the adapter on its own branch with the Fabric Agent Adapter skills
   → the conformance probe decides, and only a passing agent enters the registry. Until AR-7/AR-11
   build it, the start menu shows this path as **planned**, explains it, and gives today's manual
   route; it offers no action that pretends to run.
<a id="boundary"></a>
7. **The boundary.** Every folder these paths read is one the operator chose in this window's
   picker (`fileRoots`, S02.roots); the main process refuses anything else as outside. A folder chosen
   as the PARENT of a new project is not opened: the window may create new project folders directly in
   it — reusable while the window lives, each folder granted to that window — and may not read, list or
   write anything else there. A kept scan is shown, never granted. `projects.create` and `repos.attach`
   admit a repository path only when it is absolute, an existing folder taken by its real path, and
   either reachable from the calling window or a candidate main listed for that window's latest or kept
   scan, pinned to the path the walk itself recorded and lying under that scan's folder; the filesystem
   root and the home folder are always refused, and so is a repository another project already holds;
   anything else is refused before it is journalled, with a code the window translates
   (`startChoices.ts#admitRepoPaths`, `repo-path-refused:<code>`). An
   admitted project's folders join the estate's roots and the git watch at once. The only exception is the walk harness's `FABRIC_WALK_PICK`, which answers the
   picker in an UNPACKAGED run and is ignored by a packaged app.
<a id="app-icon"></a>
8. **The app icon** is the PassionCode.ai mark from its source SVG, composed on a graphite macOS
   tile (Apple's 1024 grid) and rendered by `scripts/build-app-icon.mjs`; the PNG is bound to the SVG
   by manifest, so a hand edit fails `--check`. Four generated candidates did not keep the mark; the
   operator chose the vector (2026-10-03).

## Consequences

- `shared/startPaths.ts` is the one definition of the shapes; `main/projectDiscovery.ts`,
  `main/executorDetect.ts` and `main/startPaths.ts` produce them; the renderer is
  `renderer/src/start/`. Each carries a `#region … docs:` marker pointing here.
- The scan is asynchronous I/O in the main process, so a large folder never freezes the windows.
- SCN-095 step 4 carries an amendment note pointing here in the same change. ONB-01
  (`docs/launch/ceo-onboarding.md`) and `docs/launch/single-entry.md` are dated records and keep their
  wording; this record supersedes them where they differ. SCN-015 remains as the documented manual
  fallback, not the default.
- Sidebar *New project* and the estate home's empty state open the start menu. Its *New project*
  path is the draft-backed form (`Onboarding.tsx`), so a half-described project still survives a
  restart (AD02); the form gained *Create a new folder for it* (`#region new-project-folder`).
- Not built here, and owned by the plan ([ADR-0101](0101-the-general-development-plan.md)) or the
  carry-over register: conversion (AR-7, AR-11), the three-group agent registry (AR-2), sign-in
  verification of a detected coding agent (CO-176), re-scanning on a schedule (CO-177), the New project
  form's restyle to the launch language (CO-179), and redrawing the older r0 prototype views (CO-180).

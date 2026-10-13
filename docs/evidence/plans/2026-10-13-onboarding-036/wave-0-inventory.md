# Wave 0 — open onboarding items, measured against the code (2026-10-13)

Read-only survey of `origin/main` `a5b78e49` plus this run's plan. 30 items: 4 built, 15 partial, 9 not built, 2 not
checked (SCN-132, SCN-133). Paths under `apps/desktop/src/`. A dated record; status changes land in each item's
owning register, never here.

| id | what | register | measured (receipt) | area | wave |
|---|---|---|---|---|---|
| SCN-126 | First run | draft | partial: `start/FirstRun.tsx` has 3 steps; no folder, scan, products | first run | 1, 3 |
| REQ-09 | Step 1: what Fabric is, language, name | 0.4.0 wave 3 | partial: no `locale` in `FirstRun.tsx` | first run | 3 |
| REQ-10 | One honest line per coding agent | 0.4.0 wave 3 | partial: `FirstRun.tsx:224-226`; sign-in read on macOS only (`main/executorAuth.ts`, CO-244) | first run | 3 |
| REQ-12 | Four actions, one primary; «+ New» in the nav | 0.4.0 wave 3 | partial: `FirstRun.tsx:269`; no `nav.new` | first run | 3 |
| REQ-39 | First run in the operator's order with folder, scan, pre-ticked list | 0.4.0 wave 3 | not built as one flow: scan only outside the first run; nothing pre-ticked (`start/StartPaths.tsx:234`) | first run | 2, 3 |
| REQ-40 | Coding agent chosen in the first run | 0.4.0 wave 3 | **built** in 0.3.5: `FirstRun.tsx:202-213`, `start/StartPaths.test.tsx:168,833` — open in the register | first run | close |
| CO-176 | Sign-in of a detected agent unchecked | open | **built on macOS**: `main/executorAuth.ts`; Windows/Linux remain (CO-244) | first run | close (macOS) |
| SCN-127 | Add a project from one folder | draft | partial: `chooseFolder` picks one folder (`shared/types.ts:1373`) | start paths | 2, 3 |
| SCN-128 | Scan and tick | draft | partial: groups by parent path (`shared/startPaths.ts:216`), nothing pre-ticked | start paths | 2, 3 |
| multi-folder | One project from several folders | — | partial: `multiSelections` exists for `repos.choose` (`main/index.ts:4366`), the Open path picks one | start paths | 2, 3 |
| SCN-129 | Create a project | draft | built (`Onboarding.tsx`) | start paths | 3 (redraw) |
| CO-177 | No scheduled re-scan | open | not built | start paths | carried |
| CO-179 | New-project form in the old component style | open | not built | start paths | 3 |
| CO-180 | Old prototype views of one project with related sources | open | partial: `scripts/product/controller.js:118,167` | start paths | 1 |
| SCN-130 / SCN-136 | Start / create an agent | draft | built: `start/AgentPaths.tsx` | agents | 3 (redraw) |
| SCN-131 | Adapt an agent | draft | partial (CO-188) | agents | 1, 3 |
| CO-188 | Convert-an-agent states designed only as planned | open | not built | agents | 1 |
| CO-235 | A finished onboarding task stays open on the board | open | not built | agents | 4 |
| REQ-11 | **Setup console**: readiness, skills, Fabric MCP per agent, products verified | 0.4.0 wave 3 | **not built**: no `SetupConsole` | products | **2** |
| REQ-41 | Every family product set up by an agent; results matrix | 0.4.0 wave 3 | not built | products | 2, 5 |
| REQ-35 | Claude and Codex accepted end to end through the Setup console | 0.4.0 wave 3 | not built (needs REQ-11) | products | 5 |
| step 3 | PassionCode tools found and offered | 0.3.6 plan | not built | products | 2, 3 |
| SCN-133 | Connect a product by its own consent | draft | not checked | products | 1 |
| first impact | Agent posts a note on the board | 0.3.6 plan | partial: `com.submit` (`main/boardTools.ts:34`); the setup preset records memory, questions, tasks (`shared/runnerRoute.ts:56-60`), no board note | first impact | 4 |
| REQ-24 / CO-225 | Russian complete; coded refusals | 0.4.0 waves 3, 6 | partial: refusals still English (CO-221 UX-12) | cross-cutting | 3 (start screens) |
| CO-219 | Stack reachable on the LAN | open | partial: warning in `main/stackExposure.ts`; this machine fixed 2026-10-13 by `docker.expose_ports_to_lan false` | cross-cutting | carried |
| SCN-134 / SCN-135 | Usage-counts switch; fallback order | draft | built: `UsageCountsSetting.tsx`, `FallbackOrderSetting.tsx` | cross-cutting | — |
| SCN-132 | External agent asks for access | draft | not checked | cross-cutting | — |

**Register findings.** `docs/backlog-sources.json` does not list the 0.4.0 plan, `docs/ux/scenarios.md` or this plan;
the 0.4.0 REQ table has no status column; REQ-40 and CO-176 (macOS) are shipped but open; SCN-129, SCN-130, SCN-136,
SCN-134, SCN-135 are built but still `draft`. Each is fixed in its own register in the wave named above.

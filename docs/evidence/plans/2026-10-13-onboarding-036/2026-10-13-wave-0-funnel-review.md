# Wave 0 — the onboarding funnel as built (2026-10-13)

Read-only review of `origin/main` `a5b78e49` for the 0.3.6 onboarding run (the operator's order of 2026-10-13:
redesign the first run, the start paths and the scan so the person opens a folder, sees every project they work on,
picks which ones Fabric works on, and lands in a project where agents already write on the board). Paths are
repository-relative; R = `apps/desktop/src/renderer/src`, RU = `R/i18n/ru.ts`, SC = `docs/ux/scenarios.md`. Line
numbers are this commit's; this is a dated record and is not rewritten.

| id | sev | screen | finding | receipt | direction |
|---|---|---|---|---|---|
| F-01 | blocker | First run | Still the 0.3.x order — name and look → coding agents → four actions. The 2026-10-11 rewrite of SCN-126 (projects folder, scan and import, PassionCode products) is not built; the scenario itself says so. | `R/start/FirstRun.tsx:25,39-48`; SC:3147-3153, 3161, 3167, 3451 | One wizard: persona → coding agents (a default) → products → projects → land in a project. |
| F-02 | blocker | End of funnel | No path ends with agents working: finishing goes to Home or a start path; after an import the scan screen stays; «Set up with the agent» only fills the task text and waits for Run; an agent not connected to Fabric's tools "won't report to Fabric". | `R/App.tsx:908-911, 927-935`; RU:2071 | The last step opens the chosen project and starts its setup on the picked, connected agent. |
| F-03 | major | Start cards | «Открыть проект» with «Одна папка» / «Папка с проектами» reads as one project's folder; the buttons are nouns, not acts. | `R/start/StartPaths.tsx:96-99`; RU:1931-1935 | Separate acts: open project (one or several folders) and scan a projects folder. |
| F-04 | major | First run → scan | The first run is recorded finished when a card is clicked, before anything is imported; quitting mid-import never brings it back. | `R/App.tsx:902-909`; SC:3155 | Record it finished only after its last step; keep the step reached. |
| F-05 | major | Scan list | Flat and dense: name, two README lines, kind · date · commit subject, path, two stack pills per row; repositories nested up to two levels inside others are listed; a group head shows only for a group of more than one; nothing is ticked by default (the 2026-10-11 amendment ticks product heads). | `R/start/StartPaths.tsx:391, 411-424`; `apps/desktop/src/main/projectDiscovery.ts:411`; SC:3216 | One line per product, parts folded under it, grouped by owner, heads pre-ticked, details on expand. |
| F-06 | major | Scan | Missing states: no live count, no «slow» after 10 s, no «denied» with Open System Settings, no plain-folder / no-repositories listing; an empty result is a dead-end sentence. | `R/start/StartPaths.tsx:348-352, 375-376`; SC:3157, 3217-3219 | Each state with its action. |
| F-07 | major | After import | The imported projects are hard to find: only the first gets Open / Set up; the sidebar lists projects in collapsed groups of six with no heading, count or filter; Home's «Мои проекты» sits below the board. | `R/start/StartPaths.tsx:368-373`; `R/launch/LaunchShell.tsx:143-151`; `R/EstateHome.tsx:472-492` | A result list of every imported project; the sidebar names «Проекты (N)» with a filter. |
| F-08 | major | Start menu, first-run step 3 | Two primary buttons on the start menu (Create agent, One folder); first-run step 3's footer has none. | `R/start/StartPaths.tsx:88, 97`; `R/start/FirstRun.tsx:285-288` | One primary per screen. |
| F-09 | major | No coding agent | «Продолжить без агента» leads to step 3 where «Создать агента» is still primary but cannot work. | `R/start/FirstRun.tsx:259`; `R/start/StartPaths.tsx:88`; `R/start/AgentPaths.tsx:114-121`; SC:3383 | With no agent, Open project is primary and the agent cards say what to install. |
| F-10 | major | Create / adapt agent | Missing adapter skills block Start until a terminal command is run — the dead end SCN-126's step 5 exists to close. | `R/start/AgentPaths.tsx:195-196, 212, 228`; SC:3159 | Install the skills in the first run's setup step. |
| F-11 | major | Persona | Character choice plus a variant grid plus «more»; the scenario says one row of characters, variants in Profile; no language choice. | `R/start/FirstRun.tsx:97-116`; SC:3148 | One row; a language choice. |
| F-12 | minor | Copy | Home has three names: «Позже — на главную», «Главная», the sidebar's «Fabric». | RU:1914, 1916, 804 | One name. |
| F-13 | minor | IA | «+ Проект» opens a menu that also holds the agent actions; the first-run lede sends there. | RU:807, 1913; `R/App.tsx:764` | One entry named for what it holds. |
| F-14 | minor | Copy | English and anglicisms: «Скиллы Fabric Agent Adapter», «рабочая копия (worktree)», «MCP, A2A», «Git», «Стек». | RU:1948-1952, 2025, 2109, 2018, 2021 | Plain Russian; product names only where needed. |
| F-15 | minor | Terms | «протоколу Fabric» where the glossary says Fabric Agent Contract; «Создать агента» names both the ecosystem agent and a project's role agent; the scenario says Convert, the UI Адаптировать. | RU:2013, 2016, 2105, 1475 vs 1928; SC:3151; `CONTEXT.md:195-202` | Align with CONTEXT.md. |
| F-16 | minor | Machine text | Raw `String(e)` errors in the new-project form; each agent's full binary path and `--version`; scan depth limits on screen. | `R/Onboarding.tsx:70, 72, 83`; `R/start/FirstRun.tsx:229`; RU:1887, 2045 | `explainError`; paths in a details line. |
| F-17 | minor | New project | «Создать для него новую папку…» disabled until a name is typed, no reason; the git checkbox beside «Выбрать папку…» though it affects only the new folder; the hint points to re-running the first run. | `R/Onboarding.tsx:211-216`; RU:1367 | Say why; group the checkbox with its act. |
| F-18 | minor | New project | Opens as a separate draft tab, outside the first run; Cancel closes to Home. | `R/App.tsx:908, 919, 630, 1050` | Keep the first run's progress and Back. |
| F-19 | minor | Cards | Card titles repeat their buttons; the symbol marks are decoration only. | RU:1921/1936, 2012/1928; `R/start/StartPaths.tsx:72-75` | Title says what you get; the button is the verb. |
| F-20 | minor | Agent choice | Radios in the first run, a `<select>` with reasons hidden in disabled options in the agent paths. | `R/start/FirstRun.tsx:202-253`; `R/start/AgentPaths.tsx:128-134` | One radio-row component. |
| F-21 | minor | Stack down | `refreshProjects` has no catch: a failed `projects.list()` leaves `projects` null, the first run is never offered and nothing says why (whether the startup screen already covers it is unchecked). | `R/App.tsx:333-335, 458, 546` | The error with Try again. |
| F-22 | minor | Long paths | Full absolute paths in «Сканируем…», «Читаем…», the scan summary and the facts list, broken mid-segment by `overflow-wrap:anywhere`. | `R/start/StartPaths.tsx:175, 350, 358`; `R/start/start.css:43, 46` | `~/…` with the last segment; full path on hover. |
| F-23 | minor | Unscenarioed | The variant grid and «more»; the «не добавлено: N» count on the first-run cards; the create-agent attempt kept for the window's life; a kept old list shown in place of the picker when the scan opens. | `R/start/FirstRun.tsx:106-116, 273-284`; `R/start/AgentPaths.tsx:248`; `R/start/StartPaths.tsx:249-251` | Into scenarios, or removed. |

Focus and keyboard are mostly sound: headings take focus, agent rows are native radios, focus moves to scan results.

**The funnel's biggest gaps.** (1) The first run is the 0.3.x order with no folder, import or products step (F-01,
F-11). (2) No path ends in a working project with connected agents writing on the board (F-02, F-10). (3) The scan is
noisy, misses states, and «Папка с проектами» is misread (F-03, F-05, F-06). (4) Imported projects are hard to find and
an unfinished import is never resumed (F-04, F-07). (5) The hierarchy is inconsistent — two primaries, three names for
Home, «+ Проект» holding agent actions, English terms (F-08, F-12…F-15).

Method: one read-only review pass over the renderer start screens, `App.tsx` routing and the scenarios; the real-app
walk (`scripts/walk/start-paths.mjs`, ru, light) is recorded beside this file when it completes.

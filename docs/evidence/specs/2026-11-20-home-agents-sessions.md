# Главная, проект и агенты: сессии этого Mac видны и открываются, CEO справа (0.3.26)

Date: 2026-11-20. One spec for the recent fixes the operator gave across sessions, shipped as one release.

Sources, the operator's words:

- 2026-11-20, the Fabric CEO session: «на главной вёрстка поползла: чат должен быть справа, а не снизу».
- 2026-11-20, this session: «давай с UI багами на главной и на странице проекта и на странице агента чтобы можно было
  видеть всех агентов запускать открывать сессии и открывать последнюю, собери все правки с прошлых сессий недавние что
  тоже давал в одну спеку и выкати апдейт».
- 2026-11-20, this session, with a Fabric Dashboards screenshot of 15 running sessions on this Mac: «в дашборде вот вижу
  сессии а в фабрике не вижу тоже разобраться как отображаем сессии и обновляем».
- 2026-11-20, this session: the board's projects (Аня, Morpheus, PM, Studio, Sound Engine, Dissy, Riffly, Fabric,
  Dashboards, Switchboard) kept alive and on plan; one machine showing one count of sessions and agents; the session
  manager installed as a service with any of our software; every product's MCP checked; automatic updates and sessions
  back after a restart; two or three rounds of fixes, then the release.
- 2026-11-19, the owner's order to the CEO agent, board request `eef5abeb` (the launch journal, a press on an agent opens
  its console, «новую или последнюю», sessions outside Fabric): [its spec](2026-11-19-session-launch-journal.md).
- 2026-11-19, the owner on the CEO popup (relayed in board request `3aa89c92`): the redesign, the call as a panel in the
  chat, the character's voice, the CEO's stop ([ADR-0197](../../adr/0197-the-ceo-is-a-console-session-fabric-keeps-with-a-fallback-runner.md) amendment 2).

## 1. What this release carries

| # | Before | After | Where |
|---|---|---|---|
| 1 | «Спросить CEO» sat inside the main column; whenever «В работе» took the right column the main column was 595 to 835 px (built app, 1280 to 1680 px windows), so the card fell under the hero | The top row (the hero and the CEO card) spans the home above both columns; the card stands at the top right at 1280, 1440 and 1680 px and stacks only under a 640 px content area | `EstateHome.tsx`, `launch/launch.css` (the `.lh-top` container rules) |
| 2 | Агенты and the rail listed only the sessions Fabric holds (its consoles and the fabric-mcp sessions of this run); the Switchboard panel read `sessions --all`, Switchboard's own launches; the «outside» panel read Claude Code's files in `~/.claude` and Switchboard's runtimes only | One list of this Mac's sessions outside Fabric's consoles: Claude Code's files joined with Switchboard's `sessions --rows`, the list Fabric Dashboards shows, one read in flight kept 20 s; state is Switchboard's group (running, waiting, needs you) when it names the session, else the file's status | `main/machineSessions.ts#createMachineSessions`, `main/index.ts` (`switchboardRows`) |
| 3 | Those sessions showed only on Агенты with nothing selected | «На этом Mac вне Fabric · N» in the rail's «Агенты», each with its state; a press opens Агенты; the panel is first on Агенты and folded under an open agent's page | `launch/LaunchShell.tsx`, `launch/AgentsScreen.tsx`, `launch/MachineSessions.tsx` |
| 4 | No record of who started a console; a press on an agent opened its page; no new or last session from a project | The launch journal, a press opens the console, «＋» and «↻» on a project, «+ Новая сессия» and the recent sessions on Агенты ([2026-11-19 spec](2026-11-19-session-launch-journal.md)) | `feat/session-launch-journal` |
| 5 | «Завершить сессию» sent SIGTERM and waited; Claude Code often outlived it | The person's press kills a console still running after 0.8 s; a console whose process is gone leaves with its tab | `fix/session-end-fast` |
| 6 | The CEO popup and button as of 0.3.24; the CEO could not be stopped | The popup redesigned, the call a panel in the chat, the character's face on the button, the voice by character, a stop that holds (prepared as 0.3.25, never published) | `feat/ceo-popup-redesign` |
| 7 | The floating CEO button threw when the bridge had no CEO, and took the whole shell down (`Cannot read properties of undefined (reading 'status')` in `<CeoButton>`; 29 window tests red on the 0.3.25 release commit) | The button renders with no CEO on the bridge | `886e555e` |

0.3.25 was prepared and reviewed but never tagged: its fix of row 7 landed after its verified commit, and the release
gate admits no code change after it. Its changes ship in 0.3.26 with this release's own three review iterations.

## 2. Counts: one machine, one count

The operator saw different numbers of sessions in Fabric and in Fabric Dashboards on the same Mac. The sources measured
on 2026-11-20 between 04:40 and 05:20 UTC (this Mac):

| Source | What it lists | Count |
|---|---|---|
| Fabric 0.3.24 Агенты | sessions Fabric holds | 2 |
| Claude Code's files (`~/.claude` and Switchboard runtimes) | live Claude Code processes | 12 |
| `switchboard --json sessions --rows` | every session in groups | running 10, waiting 5, needs you 9 (some ended or gone) |
| Fabric Dashboards «Все сессии», this Mac | its own grouping | «Идут: 15» |

Fabric now counts as Switchboard groups them (row 2). The definition Dashboards uses differs from Switchboard's groups;
one definition for every product is asked of Switchboard and Dashboards on the board (§4).

## 3. Verification on the built app

- `scripts/test-stack.mjs` disposable stack with `scripts/fixtures/launch-estate.sql`, the built candidate under a
  temporary HOME (its hub files there, the operator's Fabric untouched), 1280, 1440 and 1680 px windows. Before: the card
  under the hero at all three (the card's top below the hero's bottom). After: the card at the hero's top (y = 68) at all
  three.
- With the temporary HOME linked to `~/.claude` and Switchboard's data folder (read only): the rail lists 16 sessions
  of this Mac, Агенты the same 16 with «Идут: 4 · ждут: 8 · нужны вы: 4».
- Tests: `test/session-resume.test.mjs` «every session of this Mac» (red before the change), `Rail.test.tsx` «Агенты
  lists every session of this Mac outside Fabric».

## 4. What is not in this release, and who owns it

| Item | Owner | Where it is tracked |
|---|---|---|
| The session manager (session host and lifecycle) installed as a service with any of our software, so Fabric alone brings it | Switchboard, with Fabric installing it when absent | board request `31261095` (Dashboards to Switchboard); Fabric task `c0e6b2d2` |
| One definition of «running / waiting / needs you» for Switchboard, Dashboards and Fabric | Switchboard (the source), Dashboards | board request filed with this release |
| Fabric's own automatic update (no updater yet) | Fabric | CO-246 |
| The sub-agents inside a session shown on its row | Fabric | task filed with this release |
| Sessions back after a restart of the session manager | Switchboard (`boot_resume`), Fabric's consoles under the session host (task `dbeb4fcd`) | those rows |
| A live probe of every product's MCP (Fabric, the board, Switchboard, Dashboards) | each product | the release close's MCP check (`machine.mcp.refresh`) |

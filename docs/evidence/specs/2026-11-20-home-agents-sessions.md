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
| 2 | Агенты and the rail listed only the sessions Fabric holds (its consoles and the fabric-mcp sessions of this run); the Switchboard panel read `sessions --all`, Switchboard's own launches; the «outside» panel read Claude Code's files in `~/.claude` and Switchboard's runtimes only | One list of this computer's sessions outside Fabric's consoles: Claude Code's files joined with Switchboard's `sessions --rows`, the source Fabric Dashboards reads; one read in flight, fresh 20 s from when it settled, a listing waiting at most 3 s for it; state is Switchboard's group (running, waiting, needs you) when it names the session, else the file's status. Fabric's own consoles are excluded by their process, not only by the journal. Fabric lists the same sessions as Dashboards and counts them by Switchboard's groups, and beside them the live processes among them, since Switchboard's groups also hold sessions whose process is gone (Switchboard's reply of 2026-11-20 on `7c726479`); Dashboards' own grouping is not changed here (§2, CO-603) | `main/machineSessions.ts#createMachineSessions`, `main/index.ts` (`switchboardRows`) |
| 3 | Those sessions showed only on Агенты with nothing selected | «На этом компьютере вне Fabric · N» in the rail's «Агенты», each with its state; a press opens Агенты; the panel is first on Агенты and folded under an open agent's page | `launch/LaunchShell.tsx`, `launch/AgentsScreen.tsx`, `launch/MachineSessions.tsx` |
| 4 | No record of who started a console; a press on an agent opened its page; no new or last session from a project | The launch journal, a press opens the console, «＋» and «↻» on a project, «+ Новая сессия» and the recent sessions on Агенты ([2026-11-19 spec](2026-11-19-session-launch-journal.md)) | `feat/session-launch-journal` |
| 5 | «Завершить сессию» sent SIGTERM and waited; Claude Code often outlived it | The person's press kills a console still running after 0.8 s; a console whose process is gone leaves with its tab | `fix/session-end-fast` |
| 6 | The CEO popup and button as of 0.3.24; the CEO could not be stopped | The popup redesigned, the call a panel in the chat, the character's face on the button, the voice by character, a stop that holds (prepared as 0.3.25, never published) | `feat/ceo-popup-redesign` |
| 7 | The floating CEO button, new in 0.3.25, threw when the bridge carried no CEO, which only the window tests' mocks do (`Cannot read properties of undefined (reading 'status')` in `<CeoButton>`; 29 window tests red on the 0.3.25 release commit). No published build had the button | The button renders with no CEO on the bridge | `886e555e` |
| 8 | Another app could open a session in Fabric only by `fabric://session/new` | `fabric://session/open` and `fabric://session/continue` (the contract's DEC-0189, re-vendored at `4c978495`): open a console Fabric holds by its id or its runner session id, else Агенты; continue of a session a Fabric console runs opens that console, of any other asks first (naming its folder, agent, state and the app that asked, with «Продолжить в Fabric»), then moves a running session or continues an ended one from its transcript, one continue of a session at a time | `shared/linkRoute.ts#routeForLink`, `shared/contract/fabricLinks.ts`, `launch/ContinueSessionAsk.tsx` |

0.3.25 was prepared and reviewed but never tagged: its fix of row 7 landed after its verified commit, and the release
gate admits no code change after it. Its changes ship in 0.3.26 with this release's own three review iterations.

## 2. Counts: one machine, the same sessions

The operator saw different numbers of sessions in Fabric and in Fabric Dashboards on the same Mac. The sources measured
on 2026-11-20 between 04:40 and 05:20 UTC (this Mac):

| Source | What it lists | Count |
|---|---|---|
| Fabric 0.3.24 Агенты | sessions Fabric holds | 2 |
| Claude Code's files (`~/.claude` and Switchboard runtimes) | live Claude Code processes | 12 |
| `switchboard --json sessions --rows` | every session in groups | running 10, waiting 5, needs you 9 (some ended or gone) |
| Fabric Dashboards «Все сессии», this Mac | its own grouping | «Идут: 15» |

Fabric now lists the sessions Switchboard lists and counts them as Switchboard groups them, with the live processes counted apart (row 2): Switchboard answered on 2026-11-20 that its needs-you and waiting groups also hold sessions whose process is gone. The numbers on
the two screens can still differ: Dashboards groups its own way and counts Fabric's own consoles, which Fabric shows as
its agents rather than «вне Fabric». One definition for every product is asked of Switchboard and Dashboards (board
request `7c726479`, CO-603).

## 2a. The operator's asks and where each went

| Ask (2026-11-20) | In 0.3.26 | Left, with its owner |
|---|---|---|
| The CEO chat at the right of the home, not below | Row 1 | none |
| On the home, the project page and the agent page: see every agent, start one, open sessions, open the last one | The left column on every screen, the project's row included: «＋» new session, «↻» its last Claude Code session; Агенты: «+ Новая сессия», the recent sessions, a press on an agent opens its console, this computer's sessions outside Fabric (rows 2 to 4) | The project page's own body has no new controls; the rail's row is its answer in this release |
| Fabric shows the sessions Dashboards shows, with one count | The same sessions (row 2) | One definition of the count (CO-603 (1), board request `7c726479`) |
| Sessions opened from any app | `fabric://session/open`, `continue` (row 8) | «Подключить сюда» for Dashboards (a session's feed), promised 21.11 on board thread `3ca40854`: this repository's release session, CO-603 (10) |
| The session manager as a service installed by any product | none | Switchboard first (CO-603 (2), board requests `7c726479`, `31261095`), Fabric task `c0e6b2d2` |
| Every product's MCP working | Fabric's board tools publish flat schemas (CHANGELOG) | A live probe at the release close (CO-603 (8)) |
| Automatic updates, sessions back after a restart | none in Fabric | Fabric's updater: P-12 (RM-19), P-27; sessions after restart: CO-603 (5) |
| The board's projects alive and on plan | Read and reported in the session of 2026-11-20 | Fabric's sweep and dispatcher, the PM agents (CO-603 (9)) |
| Sub-agents inside a session | none | task `ccd5c232` (CO-603 (4)) |

## 3. Verification on the built app

- Screenshots of the home before and after, at 1440 and 1280 px, on the demo estate:
  [`before-home-1440.jpg`](../reviews/0.3.26/shots/before-home-1440.jpg),
  [`after-home-1440.jpg`](../reviews/0.3.26/shots/after-home-1440.jpg),
  [`after-home-1280.jpg`](../reviews/0.3.26/shots/after-home-1280.jpg). The screenshots of Агенты and the rail with
  this computer's real sessions are not committed: they name private projects.
- `scripts/test-stack.mjs` disposable stack with `scripts/fixtures/launch-estate.sql`, the built candidate under a
  temporary HOME (its hub files there, the operator's Fabric untouched), 1280, 1440 and 1680 px windows. Before: the card
  under the hero at all three (the card's top below the hero's bottom). After: the card at the hero's top (y = 68) at all
  three.
- With the temporary HOME linked to `~/.claude` and Switchboard's data folder (read only), on candidate `314c9566`:
  the rail listed 16 sessions of this computer, Агенты the same 16 with «Идут: 4 · ждут: 8 · нужны вы: 4». This reading
  predates the iteration-1 fixes (Fabric's consoles excluded by process, sessions with no state counted); the release
  ledger records the reading on the verified candidate.
- Tests: `test/session-resume.test.mjs` «every session of this Mac» (red before the change), `Rail.test.tsx` «Агенты
  lists every session of this computer outside Fabric».

## 4. What is not in this release, and who owns it

| Item | Owner | Where it is tracked |
|---|---|---|
| The session manager (session host and lifecycle) installed as a service with any of our software, so Fabric alone brings it | Switchboard, with Fabric installing it when absent | board request `31261095` (Dashboards to Switchboard); Fabric task `c0e6b2d2`; CO-603 (2). Switchboard's answer of 2026-11-20 (`7c726479`): `fabric-sessions install --if-newer` is its plan SB-397 (W3.1), not built yet |
| One definition of «running / waiting / needs you» for Switchboard, Dashboards and Fabric | Switchboard (the source), Dashboards | board request `7c726479`, CO-603 |
| Fabric's own automatic update (no updater yet) | Fabric | plan rows P-12 (RM-19) and P-27, CO-603 |
| The sub-agents inside a session shown on its row | Fabric | task `ccd5c232`, CO-603 |
| Sessions back after a restart of the session manager | Switchboard (`boot_resume`), Fabric's consoles under the session host (task `dbeb4fcd`) | those rows, CO-603 (5) |
| A live probe of every product's MCP (Fabric, the board, Switchboard, Dashboards) | each product | the release close's MCP check (`machine.mcp.refresh`), CO-603 (8) |
| «На этом компьютере / на других» for agents and the tidier session window, promised on board thread `3ca40854` for 20.11 21:00 | Fabric | moved to the next release on that thread; CO-603 (6) |

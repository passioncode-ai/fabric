# 0.3.7 wave 4: the operator's walk of 2026-10-19

The operator opened Fabric on 2026-10-19 (a screenshot of a Claude Code console in Fabric) and listed what is wrong,
then sent Orca's agent settings as the model for Fabric's. Each item gets an id here, and wave 4 ([the plan](README.md),
§6) works through them, scenarios first (`docs/ux/scenarios.md`), then the prototype, then the code. Status lives in
this table until each item's scenario or carry-over row takes it over.

| Id | What the operator saw | What it must be | Status |
|---|---|---|---|
| OF-01 | A console opened on a Claude Code session showed `^[[I^[[?1;2c`, then `[session ended - exit 1]`, at Claude's trust prompt | A console opens and stays open; the trust prompt answers only to the person | fixed 2026-10-19: re-mounting a console replays the session's output into xterm, which answered the queries in it again (device attributes, focus) into the live program, and their ESC was the prompt's «Esc to cancel»; while a replay is parsed these replies are dropped (`renderer/src/terminalReplies.ts`, `TerminalView.tsx`; `terminalReplies.test.ts`, failing first). OF-12 removes the prompt itself |
| OF-02 | The console's header said «Остановка не подтверждена» with «Проверить остановку» and «Остановить принудительно» for a session that had simply ended | A session that ended says so, with its exit code | open, with CO-327 |
| OF-03 | Consoles are not where the work is | A coding agent's console opens inside Fabric as a full view; open consoles are tabs along the top, each with a console icon and its project's name (for example «fabric-dashboards»); the left rail stays the projects. No other top tabs | open |
| OF-04 | The projects on the left are a long list with large gaps | A compact projects list on the rail, redesigned | open |
| OF-05 | The header carries search, the profile, «Обсудить с Fabric» and other clutter | One clean header | open |
| OF-06 | Clicking a project on the rail expands it | Clicking a project opens its overview at once | open |
| OF-07 | The home jumps while it refreshes; «where you stopped» switches between projects | The home holds still; «where you stopped» is the last thing the person stopped on | open |
| OF-08 | Agents at work are shown as silent while they are working | An agent at work is shown at work | open |
| OF-09 | An agent's page shows nothing of what it did | An agent's page is its flow, newest first: plan, tasks, what was done, results, decisions, then the history below; a button opens its console right there to go on working with it | open |
| OF-10 | (whatever else the walk finds) | | open |
| OF-11 | Fabric's settings know a few coding agents | Every coding agent Orca knows (13 installed, 32 more to install on the operator's machine): each with its launch command and the argument that skips its permission prompts, enabled or not, a default agent, and one permission choice (fewer prompts, the default for all, or manual checks), offered for all agents at once. One catalogue for every product (Fabric, Switchboard, Orca's list as the reference), not a list per product | open |
| OF-12 | Claude Code asks «Do you trust this folder?» in every console Fabric starts | When Fabric starts an agent in a project's folder, the folder is trusted already (a setting, on by default, as in Orca: «Trust the folder when Orca starts an agent»); folders already trusted stay trusted | open |
| OF-13 | Fabric, Switchboard and Observatory each keep their own projects | One project identity with **Fabric as the core**: Fabric's project is the canonical one, and Observatory's knowledge (repositories, sites, accounts) and Switchboard's pools and accounts are matched to it. This corrects decision D3 of the 2026-10-19 attribution run, which had made Observatory's `project:<slug>` canonical | open: ADR-0166 amendment, board thread `617c8cbe` |

Sources: the operator's two messages of 2026-10-19 in Fabric's session (Russian, paraphrased above), with the
screenshot of the `company-assessment-agent` console and the text of Orca's Settings, Agents page.

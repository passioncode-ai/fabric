# Fabric's consoles in Switchboard's session host (CO-584)

**Status:** draft for review · 2026-11-14 · carry-over row CO-584 · the operator, this repository's session `0eb9017f`,
2026-11-14: «чтобы твои агенты, которые там сессии вот эти, они были связаны тоже грамотно со switchboard, с life cycle,
все это грамотно связывалось» · serves fabric-switchboard's session lifecycle SL-1, SL-4, SL-6 and SL-8
(`docs/plans/2026-11-13-session-lifecycle.md` in fabric-switchboard, `1afacfff`) · follows CO-585 (opening a hosted
session here, built on `feat/estate-work-summary`, `e2060244`).

## 1. Where we stand

- A console Fabric starts spawns its coding agent in a PTY of its own (`apps/desktop/src/main/pty.ts#PtyManager`, `open`):
  the program, its flags and its environment come from the runner's descriptor, the session's bundle and the permission
  verdict, and node-pty spawns it directly.
- So Switchboard keeps no launch record for it. On the MacBook on 2026-11-13, 31 of 32 Claude Code processes ran outside
  Switchboard's records, Fabric's consoles among them (the lifecycle plan, «Where we stand»). That breaks SL-1 (every
  session started by an owner that records it) and SL-8 (one view of what runs).
- The session dies with Fabric: a quit drains and ends every PTY within 10 s (AGENTS.md, Lifecycle, «PTY sessions and
  coding-agent runners»). An update or «Перезапустить Fabric» ends every agent at work. That breaks SL-6.
- Fabric Dashboards' console already starts its agents through Switchboard: `switchboard launch --provider <p> --mode
  managed --working-directory <folder> --in-place --hosted --surface dashboards -- <args>` (fabric-dashboards
  `src/core/switchboard.ts#inPlaceArgv`, `src/electron/console.ts`, FD-211), and ends them with `switchboard sessions end`.

## 2. What changes

1. **A console of Claude Code or Codex starts through Switchboard when Switchboard can host it.** The argv becomes
   `<switchboard> launch --provider claude|codex --mode managed --working-directory <cwd> --in-place --hosted
   --surface fabric -- <the runner's arguments>`, where the runner's arguments are exactly what `PtyManager.open` passes
   today (the bundle's command or arguments, then the verdict's). The environment is today's (`sessionEnvironment`, the
   descriptor's, the verdict's, the bundle's): an in-place launch keeps the caller's environment except Switchboard's own
   conflicting names (fabric-switchboard `crates/switchboard-runtime/src/launch.rs`, the list at lines 45 to 60), and
   none of Fabric's session variables is on it. Every other runner (Kimi Code, Hermes, a plain shell) keeps the direct PTY.
2. **The console learns its launch id from the agent itself.** Switchboard gives every launched session its own
   `SWITCHBOARD_LAUNCH_ID` (fabric-switchboard `crates/switchboard-runtime/src/launches.rs`, `ENV`). `fabric-mcp`, the
   agent's child, sends it with its enrolment, and the session's enrolment record keeps it (`session.enrolled@1` gains
   an optional `switchboardLaunchId`). A console whose agent never enrols has no launch id and reattaches by folder and
   start time, as Dashboards' merge pairs a console with its Switchboard twin
   (`apps/desktop/src/shared/vendor/dashboardsSessions.ts#mergeSessions`).
3. **Quitting Fabric leaves a hosted console's session running.** The quit drain detaches a hosted console (its PTY ends,
   which is the `switchboard launch --in-place` client, not the session) instead of ending it. «Остановить» on the
   console ends the session with `switchboard sessions end <launch_id>`, as Dashboards' Stop does.
4. **Fabric reattaches at start.** For each hosted console it held at quit (kept in `userData`: its launch id, project,
   runner and tab), Fabric reads `switchboard --json sessions` and, when the launch is still `attachable`, opens its tab
   again with `switchboard attach <launch_id>` (the CO-585 path). One that ended is said in its tab as ended, with how.
5. **Without Switchboard, or one that cannot host, the console starts as today,** and its first line says so once: «Сессия
   запущена без Switchboard: она закончится, если закрыть Fabric.» The check is `switchboard launch --help` naming
   `--hosted` and `switchboard sessions --help` naming `end`, the same test Dashboards makes (`launchFeatures`).
6. **The switch.** Settings → «Запуск агентов» gains «Запускать агентов через Switchboard, чтобы сессии переживали
   перезапуск Fabric», on by default once item 7 is met and the live check of §5 passed.
7. **What Switchboard adds first:** `--surface fabric` on `launch` (Switchboard 0.7.80 takes `cli`, `dashboards`,
   `recovery`; the launch record's reader already knows `fabric` for dispatched runs). Asked on fabric-switchboard's board.

## 3. What does not change

The bundle, the session credential, the permission verdict, the folder trust (OF-12) and the context pack are made as
today, before the spawn and in the same order; only the program the PTY runs changes. A console's scrollback, transcript
capture and delivery queue read the PTY as today. The board dispatcher's runs already go through `switchboard dispatch`
and are not touched.

## 4. Open questions, with the default taken

| Question | Default |
|---|---|
| Does the session host pass the launching client's environment to the agent unchanged? | Verified on this Mac before the switch defaults on; a variable lost there blocks the default, not the build |
| What does a console show while it reattaches? | «Подключаюсь к сессии…» in its tab until `attach` prints, then the session's own screen |
| Managed or isolated mode? | `managed`, as Dashboards' console: the folder's group selects the account |
| A hosted session nobody reattaches to | Switchboard closes it after its idle time (SL-4); Fabric's sweep sees its claim lapse as today |

## 5. Checks

- Unit: the argv for Claude Code and Codex with and without the bundle's command; a runner other than the two keeps the
  direct PTY; the fallback line once; the quit drain detaches a hosted console and ends a direct one.
- Main: the launch id from the enrolment reaches the console's record; reattach of an attachable launch, an ended one,
  and a Switchboard that does not answer.
- Live on this Mac before the default turns on: start a console, quit Fabric, see the session in `switchboard sessions`
  as attachable, start Fabric, see the tab back on the same conversation.
- AGENTS.md's Lifecycle row for PTY sessions says which consoles outlive Fabric, in the same change.

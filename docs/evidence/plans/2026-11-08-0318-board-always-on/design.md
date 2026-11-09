# 0.3.18: the board's service, design (task-pipeline stage 2)

Follows [the brief](brief.md) (stages 0 and 1). Decision record: [ADR-0192](../../../adr/0192-the-board-is-a-service-launchd-keeps.md).

**Corrected 2026-11-09** (the 0.3.18 release review, iteration 2, PL-22): what was built differs from this design in
the places marked *As built*; [ADR-0192's amendment 1](../../../adr/0192-the-board-is-a-service-launchd-keeps.md#amendment-1-2026-11-09-what-ends-fabric-and-who-owns-the-service)
holds the rules. The rest of this record is the design as it was written.

## What changes for the person

One switch in Settings, the one that exists today as «Запускать Fabric при входе в систему» (CO-322). It becomes
«Служба доски: Fabric работает в фоне всегда», on by default, and it means more than before:

| | Switch on (default) | Switch off |
|---|---|---|
| At login | Fabric starts without a window | Fabric does not start |
| The process ends abnormally (a crash, a kill, memory pressure) | macOS starts it again in the background (*As built:* within the throttle, up to 60 s) | it stays ended |
| The person quits from the menu or with Cmd+Q | the windows close and the Dock icon goes; the hub, the board and the terminals keep running | Fabric quits as today (LC-01's 10 s deadline) |
| Logout, restart, shutdown | Fabric quits as today | Fabric quits as today |
| Opening Fabric again (Dock, Finder, a `fabric://` link) | the running service shows its window | Fabric starts as today |

The person's way to stop the board on purpose is the switch. Turning it off while Fabric runs leaves the current
process running until the person quits it; the next quit then ends it.

## How it works (macOS)

1. **The service's property list ships inside the app**, at `Contents/Library/LaunchAgents/ai.passioncode.desktop.board.plist`
   (electron-builder `mac.extraFiles`): `Label` the same name, `BundleProgram` `Contents/MacOS/Fabric`,
   `ProgramArguments` `[Fabric, --background]`, `RunAtLoad` true, `KeepAlive` `{SuccessfulExit: false}` (started again
   after an abnormal end, not after a clean exit), `ProcessType` `Interactive`, `LimitLoadToSessionType` `Aqua`,
   `ThrottleInterval` 10, `AssociatedBundleIdentifiers` `ai.passioncode.desktop`. *As built:* `ThrottleInterval` 60
   and no `LimitLoadToSessionType`; a copy that loses the single-instance lock exits 75 so launchd tries again once a
   minute (`apps/desktop/build/launchd/ai.passioncode.desktop.board.plist`, `shared/loginItem.ts#LAUNCHD_RETRY_EXIT`).
2. **Registration** (`loginItem.ts#loginItemFor`): on macOS the switch registers
   `{ type: 'agentService', serviceName: 'ai.passioncode.desktop.board.plist' }` instead of `mainAppService`, and
   once removes the old `mainAppService` registration so login does not start Fabric twice (*As built:* only when the
   switch is off or once macOS reads the service as enabled, `shared/loginItem.ts#legacyLoginItemAction`). The system's status is
   read back with the same `serviceName` (`loginItemState`), so Settings keeps saying what macOS reports
   (`requires-approval` asks the person to allow «Fabric» in Login Items, as today).
3. **The quit path** (`quit.ts#createQuitCoordinator`): a new input `keepRunning()` says whether a quit the person asked
   for should only hide. It is true when the switch is on, the build is packaged on macOS, and no system end is under
   way. `beforeQuit` then cancels the quit, closes every window and hides the Dock icon; it records
   `app.quit-held` in the operations log. A system end is known from Electron's `powerMonitor` `shutdown` event and
   from a logout's `before-quit` that follows it; then the quit proceeds as today.
4. **A second start** reaches the running instance through the existing `requestSingleInstanceLock` and
   `second-instance` handler, which shows the Dock icon again and opens a window.
5. **Turning the switch off** unregisters the service first (`openAtLogin: false` for the agent service), so launchd no
   longer keeps the process; the running process stays until the next quit, which then ends it.

**Windows** keeps its Run entry with `--background` (no keep-alive there in 0.3.18; recorded in the ADR). **Linux**
registers nothing, as today, and draws no switch. A development build registers nothing.

## What stays the same

The machine's lifecycle broker, where present, still supervises Fabric (`always_on` on the operator's Mac since
2026-11-08); two supervisors agree because the broker starts Fabric only when no instance runs. *As built:* the
reverse is not true of launchd, which starts its own copy at login and once a minute while another copy holds the lock;
that copy exits 75 (ADR-0192 amendment 1, rule 5; measured in CO-549). The hub's port, `hub.json`
and its standby on start are unchanged. The stack (Docker or Colima) remains a separate dependency.

## Work graph (stage 4 details each node)

| Node | What | Files | Depends on |
|---|---|---|---|
| N1 | The property list in the bundle and its packaging check | `apps/desktop/build/launchd/ai.passioncode.desktop.board.plist`, `electron-builder.yml`, `scripts/after-pack-*.mjs` | none |
| N2 | `loginItemFor` and `loginItemState` for the agent service, the one-time removal of `mainAppService` | `apps/desktop/src/shared/loginItem.ts`, `apps/desktop/src/main/index.ts#applyLoginItem` | N1 (the name) |
| N3 | Quit holds while the service is on: `keepRunning()` in the quit coordinator, the system-end signal, Dock icon hide and show | `apps/desktop/src/main/quit.ts`, `apps/desktop/src/main/index.ts` | none |
| N4 | Settings: the switch's words and its explanation of what it now does | `apps/desktop/src/renderer/src/launch/SettingsScreen.tsx`, `i18n/ru.ts`, `i18n/en.ts` | N2 |
| N5 | Docs: `AGENTS.md#lifecycle`, scenario of the switch, CHANGELOG, design map | `AGENTS.md`, `docs/ux/scenarios.md`, `CHANGELOG.md`, `docs/reports/map.html` | N2, N3, N4 |
| N6 | Proof on the operator's Mac with a packaged build: kill the main process, it returns; Quit, the board still answers; switch off, Quit ends it | a receipt in this folder | N1 to N5 |

Edges carry: N1 gives N2 the service's name; N2 and N3 give N4 the behaviour the words must describe; N1 to N4 give N5
what the docs state; everything gives N6 the build it proves.

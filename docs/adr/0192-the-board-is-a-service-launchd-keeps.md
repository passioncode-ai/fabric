# ADR-0192: The board is a service launchd keeps; quitting hides Fabric, the switch stops it

**Status:** accepted · 2026-11-08 · task `296b88c5` (0.3.18) · records the operator's word of 2026-11-08 in session
`5d9bed98` (paraphrased, ADR-0096 §5: the board the agents talk through must exist whatever happens to the software,
and it stops only when the person turns its automatic start off in Settings) · amends
[ADR-0106](0106-fabric-adopts-the-product-lifecycle-contract.md) (LC-01: Cmd+Q ends the process) and CO-322's
launch at login · designed in [the 0.3.18 board-always-on design](../evidence/plans/2026-11-08-0318-board-always-on/design.md).

## Context

The hub (the agent surface and the project board) runs inside Fabric's main process. On 2026-11-08 it disappeared for
every agent several times in one day: a machine broker stopped the app on an idle timer 54 times over its log, and once
the process ended under memory pressure. Every time the board went with it, and the agents lost the channel they
coordinate through. Fabric's own launch at login (CO-322, `mainAppService`) starts it once at login and never again
after it ends, and Cmd+Q ends it on purpose (LC-01).

## Decision

1. **On macOS the board's service is Fabric's main process, kept by launchd.** Fabric registers a launch agent from a
   property list inside its bundle (`agentService`, `KeepAlive` on an abnormal end, `RunAtLoad`), replacing the
   `mainAppService` login item. The process starts at login without a window and starts again after any abnormal end.
2. **Quitting hides; the switch stops.** While the service is on, the person's Quit closes the windows and hides the
   Dock icon, and the hub, the board and the terminals keep running. Logout, restart and shutdown still end the process
   within LC-01's deadline.
3. **One switch.** Settings' «Запускать Fabric при входе в систему» becomes «Служба доски», on by default, stored under
   the same key (`launchAtLogin`). Off unregisters the launch agent, and the next quit ends Fabric as before.
4. **Windows and Linux unchanged in 0.3.18.** Windows keeps its Run entry with `--background`; Linux registers nothing.
5. **The hub in a process of its own is the next step, not this one** (CO-545): it removes the shared fate of the
   window and the hub that this record keeps.

## Consequences

- LC-01's "Cmd+Q ends the process" no longer holds on macOS while the service is on; `AGENTS.md#lifecycle` says so.
- A machine broker that also supervises Fabric agrees with launchd: it starts Fabric only when no instance runs.
- macOS may ask the person once to allow Fabric's background item in Login Items; Settings already says when it waits
  for that approval.
- A memory leak in the window still takes the hub until CO-545; launchd shortens that outage to seconds.

## Evidence

The operator's report and the outages of 2026-11-08 (CO-322's row in the carry-over ledger); Electron 44.9.3's
`app.setLoginItemSettings` and `app.getLoginItemSettings` (`docs/api/app.md` at tag `v44.9.3`), read for the design's
stage 1.

## Amendments

### Amendment 1, 2026-11-09: what ends Fabric and who owns the service

The 0.3.18 release review (iterations 1 and 2, `docs/evidence/plans/2026-11-09-release-0318-verification.md`) found the
decision above too coarse for a service two supervisors and several copies of Fabric can reach. These rules refine
decisions 1 to 3 and replace the first two consequences; the review id that asked for each is in brackets.

1. **A quit the system or Fabric asks for ends Fabric.** A signal (SIGTERM, SIGHUP, SIGINT: the lifecycle broker,
   `launchctl`, `kill`), logout, restart and shutdown, «Перезапустить Fabric» and the Quit of a start that failed or has
   not finished are never held (PL-3, ER-2, ER-4, UX-3). The signal listeners are added once Electron is ready, because
   Electron 44 replaces a listener added while the main module loads (ER-13). A signal that ends launchd's own copy ends
   it with 0 even when its drain runs into the deadline, so launchd's `KeepAlive` does not start again what the signal
   stopped; any other quit that needs the deadline still exits 3 (UX-18). A failed start's Quit exits 0 everywhere,
   since Electron ends a quit with 0 whatever `process.exitCode` says (ER-17).
2. **Only the Fabric on the operator's own data folder owns the service.** A start with `--user-data-dir` (any
   spelling Chromium reads) or a smoke run never registers, removes or holds for it (PL-4).
3. **The Quit holds only while macOS reads the service as enabled**, the switch is on and the start has finished: the
   system's state, not the wish (PL-5, ER-2). Settings says which of the two Quit does now (UX-13).
4. **0.3.17's login item goes only after the service runs.** It is removed when the switch is off, or once macOS reads
   the agent service back as enabled; while the service waits for approval, is not found or cannot be read, the old
   item stays, so the Mac still starts Fabric at login (PL-5, ER-3).
5. **launchd's losing copy retries once a minute.** A copy launchd starts while another Fabric holds the single-instance
   lock exits 75 (EX_TEMPFAIL), so `KeepAlive {SuccessfulExit: false}` tries again, and the property list's
   `ThrottleInterval` is 60; it sets no `LimitLoadToSessionType` (PL-6). A losing copy sweeps nothing the running one
   may be writing (DA-11). Whether the running copy should hand over to launchd instead is CO-549's measurement (PL-18).
6. **launchd's label stays with its process.** `XPC_SERVICE_NAME` is read once at start and the board's label removed
   from the environment, so no terminal, agent, helper or relaunch Fabric starts takes itself for launchd's copy
   (PL-21, ER-16).
7. **«Перезапустить Fabric» is the restart** (UX-3). It sits above Quit in the app menu (in the File menu on Windows and
   Linux). Where launchd keeps the service, a detached helper waits for the process to end and asks launchd for the
   job (`launchctl kickstart`); when launchd refuses, it opens the app by its id and leaves a note the next start
   records (ER-15). Elsewhere Electron relaunches the app. With live terminal sessions it asks once, Cancel the default
   (UX-15). Every advice that used to say quit and reopen names this item, the reasons agents relay included (UX-12).

Consequences, corrected: a machine broker and launchd do not simply agree. The broker starts Fabric only when no
instance runs, but launchd starts its own copy at login and once a minute while another copy holds the lock; that copy
exits 75 at once (PL-18, ER-14). After an abnormal end launchd starts Fabric again within its throttle, up to 60
seconds, not "within seconds". `launchctl bootout` stops only a copy launchd started; a copy the person opened stays
until it is quit with the switch off (DO-11).

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

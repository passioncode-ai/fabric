# N6 receipt (d): the switch off, then Quit ends Fabric; the switch on, launchd takes the board again

Date: 2026-11-10, 01:03:02Z to 01:06:13Z. Ledger: [Release close, item 5.6](../2026-11-09-release-0318-verification.md#owed-in-0318s-release-close) (PL-8).

- **Build:** `v0.3.18-rc.2` on `bbc90b7ae4bccd65e9b8a8d8e95cb9582a14f359`; DMG sha256
  `8c3db3519b4026bedf1d686eddc5f66608fe5b9ff6e1cb207bde6bcb0f2e8ede`, Developer ID Application (team `KJ35UYYL22`),
  `Notarized Developer ID` ([the build](n6-rc2-build.md)).
- **Actor and authority:** the coordinator (session `5d9bed98`), on the operator's delegation of 2026-11-05, under the
  broker's owner hold (`held_off`, revision 30).
- **Bar:** with a live terminal session open, «Служба доски» off in Settings, then Quit: Fabric ends, and the session
  with it; then the switch on again, and launchd's copy takes the board within 60 s (or after a `kickstart`).

## Route taken

The screen was locked, so no window act (Settings, a new terminal session) was possible. The switch was turned by the
documented file route instead ([the ledger's item 9](../2026-11-09-release-0318-verification.md#owed-in-0318s-release-close),
"When 0.3.18 cannot open Settings"): with Fabric stopped, `launchAtLogin` set in `userData/settings.json`, then one start,
which applies it to the system.

## Observed

Off, then Quit:

- SIGTERM to launchd's copy, pid 38500, at 01:03:02Z (ops log `app.quit-signal` SIGTERM at 01:03:02.765Z); it ended.
- `settings.json`: `launchAtLogin` `false`.
- One start from `/Applications/Fabric.app` (ops log `app.started` 0.3.18, `background: false`, at 01:03:03.644Z): the
  job `ai.passioncode.desktop.board` was gone from `launchctl print` (the service unregistered).
- Quit (an Apple event, as the menu's Quit) at 01:03:23Z. The ops log holds no record after 01:03:23.509Z until the
  next `app.started` at 01:04:12.562Z, and the coordinator read `hub.json` removed: Fabric ended.
- The probe's own line "Fabric still running after quit" is about another process: its pid pick (11317) matched a
  coding agent's `fabric-mcp` child that runs the Fabric binary (`Fabric …/app.asar/out/main/fabric-mcp.js --runner
  claude-code`, started 2026-11-08, still alive at 01:13Z by `ps -p 11317`), not the opened copy.

On again:

- `settings.json`: `launchAtLogin` `true` (and `dispatchBoardRequests` `false`, see CO-556 in the ledger); one start
  from `/Applications/Fabric.app` (pid 61944; ops log `app.started` at 01:04:12.562Z) registered the job again:
  `state = spawn scheduled`, `runs = 1`, `last exit code = 75`.
- SIGTERM to pid 61944 at 01:05:18Z (ops log `app.quit-signal` SIGTERM at 01:05:18.367Z). 55 s later `hub.json`
  named launchd's copy, pid 80545 (ops log `app.started`, `background: true`, at 01:06:13.391Z); `launchctl print`:
  `state = running`, `runs = 3`, `pid = 80545`.

## Verdict

Pass for the switch: off unregisters the service and lets Quit end Fabric; on registers it again and launchd's copy
takes the board within 60 s (55 s).

**Unproven:** the live terminal session part (a session opened from Fabric's window ends with the Quit) needs a window
act; it waits until the screen is unlocked. The switch was turned through `settings.json`, not through Settings, so the
Settings line itself was not read.

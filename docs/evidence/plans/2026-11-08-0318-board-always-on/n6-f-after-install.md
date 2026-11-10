# N6 receipt (f): the state right after the install

Date: 2026-11-10, 00:52:42Z to 00:56:43Z. Ledger: [Release close, item 5.1](../2026-11-09-release-0318-verification.md#owed-in-0318s-release-close) (ER-14, PL-18).

- **Build:** `v0.3.18-rc.2` on `bbc90b7ae4bccd65e9b8a8d8e95cb9582a14f359`; `Fabric-0.3.18-universal.dmg` sha256
  `8c3db3519b4026bedf1d686eddc5f66608fe5b9ff6e1cb207bde6bcb0f2e8ede`, Developer ID Application (team `KJ35UYYL22`),
  `spctl`: `Notarized Developer ID` ([the build](n6-rc2-build.md)).
- **Actor and authority:** the coordinator (session `5d9bed98`, outside any Fabric terminal), on the operator's
  delegation of 2026-11-05, under the owner hold of the lifecycle broker's `fabric.desktop` (policy `held_off`,
  revision 30; before it `always_on`, revision 29).
- **Setup:** the copy opened from `/Applications/Fabric.app` at 00:39:06Z (`app.started` 0.3.18 at 00:39:10Z, pid
  65741) held the single-instance lock; launchd's job `ai.passioncode.desktop.board` was registered.

## Observed

Five samples, one a minute (`launchctl print gui/<uid>/ai.passioncode.desktop.board`, `hub.json`'s pid, `ps` of that
pid, and System Events' background-only read of the Fabric process):

| UTC | job state | runs | last exit code | `hub.json` pid | that pid's CPU time | background only |
|---|---|---|---|---|---|---|
| 00:52:42 | spawn scheduled | 14 | 75 (EX_TEMPFAIL) | 65741 (`/Applications/Fabric.app/Contents/MacOS/Fabric`, up 13:36) | 0:36.00 | false |
| 00:53:43 | spawn scheduled | 15 | 75 | 65741 | 0:37.55 | false |
| 00:54:43 | spawn scheduled | 16 | 75 | 65741 | 0:38.52 | false |
| 00:55:43 | spawn scheduled | 17 | 75 | 65741 | 0:39.62 | false |
| 00:56:43 | spawn scheduled | 18 | 75 | 65741 | 0:40.26 | false |

The broker read `held_off` for `fabric.desktop`, and its `events.jsonl` held no `circuit_open`.

## Verdict

As designed: while another copy holds the lock, launchd starts its copy once a minute (`ThrottleInterval` 60), that
copy exits 75 (`shared/loginItem.ts#secondInstanceExitCode`) and launchd schedules the next spawn; the copy that holds
the lock keeps `hub.json`. One run a minute, each ending at once.

Not read: the losing copies' own CPU time (each ended before a sample could name its pid) and whether they show in the
Dock (no screen recording: the screen was locked). ER-14's remainder stays with CO-549.

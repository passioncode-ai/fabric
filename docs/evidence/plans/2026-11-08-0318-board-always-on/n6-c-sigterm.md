# N6 receipt (c): SIGTERM ends launchd's copy, launchd leaves it ended

Date: 2026-11-10, 00:59:27Z to 01:01:31Z. Ledger: [Release close, item 5.5](../2026-11-09-release-0318-verification.md#owed-in-0318s-release-close) (PL-3).

- **Build:** `v0.3.18-rc.2` on `bbc90b7ae4bccd65e9b8a8d8e95cb9582a14f359`; DMG sha256
  `8c3db3519b4026bedf1d686eddc5f66608fe5b9ff6e1cb207bde6bcb0f2e8ede`, Developer ID Application (team `KJ35UYYL22`),
  `Notarized Developer ID` ([the build](n6-rc2-build.md)).
- **Actor and authority:** the coordinator (session `5d9bed98`), on the operator's delegation of 2026-11-05, under the
  broker's owner hold (`held_off`, revision 30).
- **Bar:** `last exit code = 0`; no new pid for two minutes (`SuccessfulExit false`); `launchctl kickstart` starts it
  again and its pid equals `hub.json`'s.

## Observed

- SIGTERM to launchd's copy, pid 94392, at 00:59:27Z; it ended after 1 s. `launchctl print`: `state = not running`,
  `runs = 21`, `last exit code = 0`.
- Two minutes later: `state = not running`, `runs = 21`, `last exit code = 0` (no new spawn).
- `launchctl kickstart gui/<uid>/ai.passioncode.desktop.board` at 01:01:30Z: the job's pid 38500 equalled
  `hub.json`'s after 1 s.

## Verdict

Pass.

**Deviation:** the SIGTERM came about 12 s after that copy's spawn, not more than 60 s as the ledger asks. The case
does not depend on the throttle (a clean exit is not restarted at all), so the verdict stands; the deviation is
recorded as such.

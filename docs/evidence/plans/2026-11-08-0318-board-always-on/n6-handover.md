# N6 receipt: the board handed to launchd

Date: 2026-11-10, 00:57:58Z. Ledger: [Release close, item 5.2](../2026-11-09-release-0318-verification.md#owed-in-0318s-release-close)
(PL-3; ER-22's measurement, DO-19).

- **Build:** `v0.3.18-rc.2` on `bbc90b7ae4bccd65e9b8a8d8e95cb9582a14f359`; DMG sha256
  `8c3db3519b4026bedf1d686eddc5f66608fe5b9ff6e1cb207bde6bcb0f2e8ede`, Developer ID Application (team `KJ35UYYL22`),
  `Notarized Developer ID` ([the build](n6-rc2-build.md)).
- **Actor and authority:** the coordinator (session `5d9bed98`), on the operator's delegation of 2026-11-05, under the
  broker's owner hold (`held_off`, revision 30).
- **Bar (written before):** the signalled copy ends (exit 0) and within 60 s launchd's next start takes the lock: the
  job's `pid` equals `hub.json`'s.

## Observed

- SIGTERM to the opened copy, pid 65741, at 00:57:58Z; it ended after 1 s. The ops log: `app.quit-signal`,
  `{"signal":"SIGTERM"}`.
- 17 s later `hub.json` named pid 88607, and `launchctl print`: `state = running`, `runs = 20`, `pid = 88607`,
  `last exit code = 75` (the exit of launchd's previous, losing copy).

## Verdict

Pass. A signalled copy that launchd did not start is replaced by launchd's within a minute (17 s here, since the
throttle counts from the last spawn about a minute earlier); this is ER-22's measurement.

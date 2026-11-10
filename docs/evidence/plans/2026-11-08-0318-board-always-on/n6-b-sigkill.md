# N6 receipt (b): SIGKILL, launchd brings the board back

Date: 2026-11-10, 00:58:54Z. Ledger: [Release close, item 5.4](../2026-11-09-release-0318-verification.md#owed-in-0318s-release-close)
(REQ-1 of [the brief](brief.md), amended for 0.3.18 by PL-28).

- **Build:** `v0.3.18-rc.2` on `bbc90b7ae4bccd65e9b8a8d8e95cb9582a14f359`; DMG sha256
  `8c3db3519b4026bedf1d686eddc5f66608fe5b9ff6e1cb207bde6bcb0f2e8ede`, Developer ID Application (team `KJ35UYYL22`),
  `Notarized Developer ID` ([the build](n6-rc2-build.md)).
- **Actor and authority:** the coordinator (session `5d9bed98`), on the operator's delegation of 2026-11-05, under the
  broker's owner hold (`held_off`, revision 30).
- **Bar (written before the run, PL-28):** a new pid answers within 70 s of the kill; a copy that ran 60 s since its
  spawn is expected back within 10 s.

## Observed

- SIGKILL to launchd's copy, pid 88607, at 00:58:54Z.
- 21 s later `hub.json` named the new pid 94392, and `launchctl print`: `state = running`, `runs = 21`, `pid = 94392`,
  `last terminating signal = Killed: 9`.

## Verdict

Pass against the 70 s bar (21 s).

**Deviation:** the kill came about 40 s after that copy's spawn (88607 was spawned about 00:58:15Z, 17 s after the
hand-over's SIGTERM at 00:57:58Z), not after the 60 s the ledger asks, so launchd's throttle held the respawn until
60 s from the previous spawn. The 10 s expectation for a copy past its throttle was not exercised by this kill.
REQ-1's amendment in the brief carries this measurement after the `v0.3.18` tag.

# N6 receipt (e): a logout or a restart is not cancelled

Date: 2026-11-10. Ledger: [Release close, item 5.7](../2026-11-09-release-0318-verification.md#owed-in-0318s-release-close) (PL-7, PL-33).

- **Build:** `v0.3.18-rc.2` on `bbc90b7ae4bccd65e9b8a8d8e95cb9582a14f359`; DMG sha256
  `8c3db3519b4026bedf1d686eddc5f66608fe5b9ff6e1cb207bde6bcb0f2e8ede`, Developer ID Application (team `KJ35UYYL22`),
  `Notarized Developer ID` ([the build](n6-rc2-build.md)).
- **Owner:** the person. A logout ends the coordinator's own processes, and logging back in is a human gate.

## State

**Unproven.** No logout or restart has happened on the rc. It is read after the person's next logout or restart: the
ops log's quit line before it (an `app.quit-signal`, or the quit record macOS's logout leaves), and `launchctl print`'s
`runs` for `ai.passioncode.desktop.board` after the login. The release notes already say a logout and a restart end
Fabric.

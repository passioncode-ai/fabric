# N6 receipt (a): Quit from the menu hides Fabric, the board answers

Date: 2026-11-10, 00:58:29Z. Ledger: [Release close, item 5.3](../2026-11-09-release-0318-verification.md#owed-in-0318s-release-close)
(REQ-2 of [the brief](brief.md)).

- **Build:** `v0.3.18-rc.2` on `bbc90b7ae4bccd65e9b8a8d8e95cb9582a14f359`; DMG sha256
  `8c3db3519b4026bedf1d686eddc5f66608fe5b9ff6e1cb207bde6bcb0f2e8ede`, Developer ID Application (team `KJ35UYYL22`),
  `Notarized Developer ID` ([the build](n6-rc2-build.md)).
- **Actor and authority:** the coordinator (session `5d9bed98`), on the operator's delegation of 2026-11-05, under the
  broker's owner hold (`held_off`, revision 30).
- **Bar:** after Quit, no window and no Dock icon, the process alive, and the board answers.

## Observed

- Quit (an Apple event to the app, as its menu's Quit) to launchd's copy, pid 88607, at 00:58:29Z.
- Afterwards pid 88607 was alive; System Events read the Fabric process as background only (`true`; the probe printed
  `true, false`) with 0 windows; `launchctl print`: `state = running`, `pid = 88607`.
- The board answered: `com.status` over the hub said the board is ready.

## Verdict

Pass. The ledger's probe `GET <hub origin>/.well-known/fabric-service` does not exist on the hub (404 on rc.2, and no
such route in `apps/desktop/src/main`): "the board answers" was read through `com.status` instead. The probe is a defect
of the ledger, carried in CO-549.

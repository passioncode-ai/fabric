# AD02 assembled native observations — source 2e06e501

Root drove the real Electron44 window through CUA against the assembled renderer built from `2e06e5013595ec96b52b85cae2c486050632565b`. This is a new source cut; the earlier [native packet](../ad02-native-20261004/README.md) remains historical. The test host uses actual Draft/local-state modules and the production renderer/preload in contained temporary storage. It does not load production main, a provider, database or operator userData.

## Observed cases

| Case | Actual native observation | Disk/audit check |
|---|---|---|
| Four drafts | Two restored drafts and two newly entered drafts; all four names/purposes observed after a real process restart | Four distinct Draft IDs and future Project IDs; two process starts |
| Unreadable storage | Read-error banner, editable unsaved input; original tab references retained across two processes; no false deletion notice | Zero Draft/tab saves in both processes; original two tab IDs unchanged |
| Last-good recovery | Both original drafts and their purposes restored; the recovery reason remains visible | Initial read `recovered`; actual two Draft IDs retained; later save committed |
| Delayed hydration | Name/purpose entered while the first snapshot was delayed 60000ms; both old tabs subsequently appeared while the new form and focused purpose stayed current | One initial Draft read; no Draft/tab writes before the delayed snapshot returned; all three drafts retained |
| Empty first install | First draft entered and observed again after a real process restart | Two process starts; one durable draft with the full name/purpose |

The first-install immediate AX capture briefly showed only `F` in Purpose while the typing action was still settling. The subsequent restarted observation already contained the complete `First install local draft only` before the repeated paste. Both observations are retained; the transient snapshot is not used as proof of the full text.

Each case has copied marker, audit, settings and Draft files. AX text and PNGs were captured from the actual CUA-bound window, not a DOM simulator. [Checks and artifact hashes](checks.json) bind the source/build and observations. The delayed-read assertion uses audit timestamps and verifies that every save occurs at least sixty seconds after the initial read request.

## Limits and next task

The isolated AD02 host refuses persona/CEO/scan handlers; first-run therefore appears on startup even when the saved draft strip has restored. Root explicitly opened each saved draft to verify its contents. This does not prove startup focus with a configured production persona. Native project creation, production handler registration, multi-window conflict recovery, VoiceOver, live providers/database and installed upgrade are NOT_RUN here.

These five bounded recovery cases passed; this packet does not itself close AD02, CO-179, P-08 or release. Next: drive the separately contained CO-179 host against the same current renderer for native keyboard, lower-control reachability, EN/RU, theme/zoom and backend/error states, then run the frozen candidate's owned disposable full tier and independent acceptance reviews.

# CO-179.1 stable source-bound rendering

Actual hidden Electron44 captures, synthetic owned fixtures, 2026-10-04.
Sixteen PNGs personally inspected; eight valid Onboarding pairs. This is
initial rendered-viewport evidence, not independent native user interaction
acceptance. The [author handoff](../2026-10-04-onboarding-visual.md) owns context,
source scope, history and the exact root next task. [Index](index.json) owns PNG
hashes, source revisions, dimensions and geometry; each raw receipt records
complete production/build/host pins and equal capture-boundary snapshots.

Before: fixture owner's ff7 production baseline. After: author source
`65b1dd25ba1360da0da34b5d9c92885952c9fbe7`. All eight pairs differ in
exactly `renderer/src/Onboarding.tsx` and `renderer/src/Onboarding.launch.css`.
Host: immutable `4df3079e01dd3493bf8ae302549de603257f4a26`, SHA256
`afd35dd2d5d1c12f3f2f8d3a9a402cd9181b460ec0a3f2017eb748e0b352fffb`.
Fixture branch b951 is receipt-only and carries identical host bytes.

| Fixture / locale / client size | Actual PNG comparison | Main bottom before → after | After clientHeight / scrollHeight | Full receipt |
| --- | --- | --- | --- | --- |
| balanced / en / 640×900 | [before](before-balanced-en-640x900.png) · [after](after-balanced-en-640x900.png) | 1142.71 → 900.00 | 735 / 1070 | [receipt](after-balanced-en-640x900.json) |
| balanced / en / 960×900 | [before](before-balanced-en-960x900.png) · [after](after-balanced-en-960x900.png) | 900.00 → 900.00 | 855 / 1070 | [receipt](after-balanced-en-960x900.json) |
| balanced / en / 1440×900 | [before](before-balanced-en-1440x900.png) · [after](after-balanced-en-1440x900.png) | 900.00 → 900.00 | 855 / 1084 | [receipt](after-balanced-en-1440x900.json) |
| balanced / ru / 640×900 | [before](before-balanced-ru-640x900.png) · [after](after-balanced-ru-640x900.png) | 1165.74 → 900.00 | 735 / 1097 | [receipt](after-balanced-ru-640x900.json) |
| balanced / ru / 960×900 | [before](before-balanced-ru-960x900.png) · [after](after-balanced-ru-960x900.png) | 900.00 → 900.00 | 855 / 1070 | [receipt](after-balanced-ru-960x900.json) |
| balanced / ru / 1440×900 | [before](before-balanced-ru-1440x900.png) · [after](after-balanced-ru-1440x900.png) | 900.00 → 900.00 | 855 / 1084 | [receipt](after-balanced-ru-1440x900.json) |
| long-repos / en / 760×1000 | [before](before-long-repos-en-760x1000.png) · [after](after-long-repos-en-760x1000.png) | 1222.53 → 1000.00 | 835 / 1152 | [receipt](after-long-repos-en-760x1000.json) |
| long-repos / ru / 760×1000 | [before](before-long-repos-ru-760x1000.png) · [after](after-long-repos-ru-760x1000.png) | 1222.53 → 1000.00 | 835 / 1152 | [receipt](after-long-repos-ru-760x1000.json) |

All candidate main bounds fit the client viewport and have an internal scroll
extent. All measured scroll widths equal client widths; there is no measured
horizontal overflow. Native scrolling and control reachability still require
root's interactive acceptance. Narrow screenshots only show the top part of
the form, not a promise that every control is simultaneously visible.

Fresh replay uses only the fixture owner's two unchanged test host blobs in
an owned checkout. Build that checkout before preparing its fixtures:

```sh
pnpm --filter @fabric/desktop build
node apps/desktop/test/onboarding-visual-native-harness.mjs --prepare balanced --locale ru --width 640 --height 900
# Launch that checkout's Electron44 binary with the absolute harness path,
# --fixture <owned directory printed above> --probe.
```

Repeat balanced EN/RU at640/960/1440×900 and long-repos EN/RU at760×1000.
Never reuse a prepared fixture across source/build/host changes. The host waits
for the configured exact form, stable geometry >=500ms and two-frame paint
boundaries, then compares state before/after capture before synthetic bridge
probes. Root must use fresh combined-source receipts after App/ARIA integration.
The hidden probe is test instrumentation, not production IPC or a native click.

No lower-scrolled frame, native keyboard/AX/VoiceOver, 200% text, busy/folder
refusal/left-on-disk rendering, full gate, hosted CI, installation or release is
claimed. Historical invalid captures remain in their separate folders and are
not relabelled as this stable source.

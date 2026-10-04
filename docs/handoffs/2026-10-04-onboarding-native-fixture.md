<sub>ssheleg skills — task-pipeline · working-in-passioncode</sub>

# CO179 contained native fixture capability — 2026-10-04

## Scope and contract

This source-only prerequisite implements `CO-179.fixture` from the published
[`484600a338f2c413333e57c09a28712b8559c401` dossier](https://github.com/passioncode-ai/fabric/blob/484600a338f2c413333e57c09a28712b8559c401/docs/evidence/plans/unified-leaves/CO-179.json)
§`fixture_prerequisite_dossier`. The author branch `codex/co179-native-fixture-20261004` begins at
`ff7eb7f3a955fc43a30b302c1a68e3fee2d896c0`. It creates only the two declared test-host files and
this unguarded handoff/receipt packet. Production renderer/main/preload/IPC declarations, the AD02
harness, source authority, shared styles, UX scenarios, registers and maps remain root-owned.
Neither CO-179 nor AD02 is closed by this packet.

The host loads the real built renderer and sandboxed production CJS preload. It hashes every
current product source file and built renderer/preload file; the marker pins the host's own bytes
as well. Source/build/host drift refuses and requires a freshly prepared fixture and semantic
review. All eight small actual Draft/local-state dependency modules are transpiled from the product
source into the owned fixture. Loading compares their bytes with freshly generated current-source
output as well as marker hashes: replacing a compiled module and its recorded hash cannot
self-approve it. Product main is only hashed as source; it is never imported or booted.

The six requested typed synthetic boundaries are parent folder selection, folder result,
repository selection, project-create result, memory backend options and runner options. A
TypeScript compile-time witness checks fixture results against current `NewFolderInput`,
`NewFolderResult`, `CreateProjectInput`, `ProjectRow`, `MemoryBackendOption`, `LaunchOption`,
`PersonaRead` and `CeoChatStatus`. These types remain the product declarations, not a new interface.
Synthetic create records exact accepted inputs in audit and a ProjectRow in memory. Folder success
returns a synthetic owned path without mkdir or git. Only Draft/settings/tab storage uses the real
atomic product disk machinery, under isolated test userData.

## Entry points and containment

- [Host](../../apps/desktop/test/onboarding-visual-native-harness.mjs)
- [Boundary tests](../../apps/desktop/test/onboarding-visual-native-harness.test.mjs)
- [Executed-check ledger](2026-10-04-onboarding-native-fixture.json)
- [Native synthetic capability receipts](2026-10-04-onboarding-native-fixture-probes.json)
- [Baseline hidden rendering capture](2026-10-04-onboarding-native-fixture-baseline.png) — source-bound test image; no CUA acceptance

Prepare requires an already built product renderer/preload; use the existing source build:

```sh
pnpm --filter @fabric/desktop build
node apps/desktop/test/onboarding-visual-native-harness.mjs --prepare balanced --locale en
node apps/desktop/test/onboarding-visual-native-harness.mjs --prepare long-repos --locale ru --width 760 --height 1000
```

Each prepare prints a new direct system-temp fixture root. No app is launched by preparation.
The temp root and storage directories are 0700; marker, compiled modules and fixture writes are
0600. Missing/wrong marker, foreign roots, symlinks, source/build/host/module drift and malformed
config fail closed. Every IPC request is bounded to 64 KiB, depth 8, width 64, fixed input types and
owned paths. An unregistered channel never falls back to production. The live window and its main
frame own each native IPC call. Delayed requests snapshot their inputs and refuse a closed owner
before a response can mutate synthetic project state.

Known presets are `balanced`, `long-repos`, `none`, `single`, `two`, `unread`, `creating`, `saving`,
`refusal`, `folder-exists`, `folder-outside`, `folder-failed`, `folder-invalid`, `cancel`,
`repo-refusal`, `empty`, `corrupt`. Config keys and modes are strict. Delays are 0..20000 ms;
host timeout is 1000..120000 ms, with each delay less than that timeout. Default timeout is 60000 ms.
The exported `scenarioConfig` and `prepareFixture` support reviewed combinations, viewport and
bounded delays. There is no arbitrary response, channel or script configuration. `long-repos`
seeds an actual persisted Draft with one long owned synthetic path, not a real repository.

Launch through the existing Electron44 binary (or `pnpm --filter @fabric/desktop exec electron` if
that checkout's development binary is present), using only this test host:

```sh
<Electron44> apps/desktop/test/onboarding-visual-native-harness.mjs --fixture <printed-fixture>
<Electron44> apps/desktop/test/onboarding-visual-native-harness.mjs --fixture <printed-fixture> --probe
```

Manual launch shows `Fabric · CO179 synthetic fixture`; app name is `Fabric CO179 Synthetic Fixture`.
Drive visible acceptance with CUA. `--probe` hides the window and uses dedicated test instrumentation
to inspect the actual rendered form and exercise the production preload bridge. It writes local
`probe.json`, `audit.jsonl` and a bounded `page.png` using dedicated `capturePage()` before bridge
probes. Capture records actual content size, pixels, hash, bytes and source/build/host pins; it is
source-bound rendering evidence, not CUA acceptance. No output path or script is configurable. The
window uses requested content dimensions, and the host quits after its probe. It is a **synthetic native host capability** receipt,
not screenshot/visual acceptance, real project create, live folder creation or AD02 acceptance.
An in-memory browser partition, isolated userData/sessionData/logs/crashDumps, denied network and
foreign local-file requests, denied permissions/downloads/windows/navigation/webviews and a bounded
host lifetime prevent connection to the live app. Electron's own renderer process is inherent to
this native host; no product provider/executor subprocess is started.

Required unrelated read stubs are explicit: seeded metadata, empty terminal/feed/favourites/board,
closed CEO status, default fixture persona, and unavailable gateway/workspace. Their synthetic
values are audited. Writes other than owned Draft/tabs storage, including settings write, remain
blocked. The host does not start Supabase, access a DB/journal/vault/account, invoke a native chooser,
spawn a coding agent, or import production main. Installed app and plugin state stay local-only.

## Checks actually run

| Command / receipt | Result |
|---|---|
| Initial missing-host Node test before implementation | RED, exit 1; AD02 read stubs cannot cover the visual state matrix |
| `pnpm install --offline --frozen-lockfile --ignore-scripts` | exit 0; existing development dependencies, no lock/manifest change |
| `pnpm --filter @fabric/desktop build` | exit 0; actual main/preload/renderer compiled; compiled main never loaded by host |
| `node --check apps/desktop/test/onboarding-visual-native-harness.mjs` | exit 0 |
| `node --test apps/desktop/test/onboarding-visual-native-harness.test.mjs` | exit 0; 11 tests, 0 skips |
| `node scripts/check-regions.mjs` and `git diff --cached --check` | exit 0; 116 closed markers and all references resolve |
| Hidden real Electron44 `--probe` | 7/7 exit 0: balanced EN; long-repos RU 760×1000; none EN; single EN; two RU; unread EN; refusal EN |

The native receipt includes common exact pins for 472 product source files, 190 build files and
the host SHA-256. It shows the real default runner select excluding the null-program terminal,
configured available/unavailable memory controls, exact synthetic typed bridge results and a real
refusal of privileged settings write. Node negatives cover foreign paths/symlinks, unknown config
and channels, mutated compiled module plus forged hash, oversized payload, actual isolated Draft
round-trip, refusal/cancellation, snapshot ownership and no late closed-window mutation. Live
transport/process API spies remain at zero through refused requests and positive synthetic create.

Native initialization found Electron ESM cannot complete bootstrap while this host awaits
`app.whenReady()` at top level. The new host invokes its async launcher without top-level await,
with catch/exit and a timeout. Root was notified about the existing AD02 shape; this packet does
not edit that independently owned harness or claim its native acceptance.

Full converged fast/app gates, CUA screenshots, styled native matrix, real CLI/providers, live
stack/DB/chooser/create, hosted CI, release, installation, wiki sync and report index are NOT_RUN by
this author. Root owns the assembled candidate, shared documentation and independent acceptance.

## Follow-up: bounded state and read-only geometry

The initial source candidate is immutable `07b4626dec8d0713433ce60c4b34b06284e43544`; its original
11-test and seven native receipts above remain historical. An authenticated fresh remote clone of
that commit installed existing dependencies offline with scripts disabled, built the product and
replayed 11/11 containment tests with a clean tree (each command exit 0).

A final saturation audit then showed three actual RED negatives on that candidate: the 65th
synthetic project, 513th request and audit bytes beyond 8 MiB were accepted. The follow-up enforces
64 distinct synthetic ProjectRows, 512 total fixture IPC requests (including refused registered
channels) and an 8 MiB audit ceiling checked before append. Refused overflow does not expand the
record map or audit file. `node --test --test-name-pattern='hard.*ceiling'` was exit 1 with all three
negatives failing before the fix; the full final containment suite is now **14/14**, exit 0, zero
skips. No production interface or authority changes.

At the visual author's request, `probe.json` now also records bounded read-only initial geometry
before bridge probes: document client/scroll dimensions, fixed content/form/header/paragraph/repo
selectors, rectangles and relevant computed width/min-width/overflow/font/white-space fields. Up
to 16 nodes per fixed selector and 64 total records are admitted. There is no caller-provided
selector or script, and no style mutation. This helps locate an observed clipping seam; it does not
approve that seam or the styled visual matrix.

The [follow-up native slice](2026-10-04-onboarding-native-fixture-followup.json) records all seven
actual Electron44 probes/captures again at the new host byte hash. All exit 0, with configured and
actual content dimensions equal. The original baseline image/receipts are preserved; the new slice
has its own exact source/build/host pins and geometry. Root owns importing both commits, fresh
assembled fixtures and independent CUA/AD02 acceptance.

## Follow-up: stable capture boundary

Visual-author inspection found actual first-run and journal PNGs at EN640/EN960, and an
EstateHome PNG at long-repository RU760, while the later bridge/geometry snapshots reported the
Onboarding form. The `07b4626` and `991524a` slices remain historical bridge receipts; their
captures cannot establish paired visual acceptance. The original files are preserved.

Three actual RED assertions (`node --test --test-name-pattern='capture boundary|screenshot
transition|stable capture' apps/desktop/test/onboarding-visual-native-harness.test.mjs`, exit 1,
three failures) demonstrated the missing boundary before this fix. The host now requires exact
seeded name/purpose, draft tabs and active draft, repository paths, selected agent and option
availability, memory radio states and configured viewport. It waits for fonts, requires an
unchanged full read-only geometry/form snapshot for at least 500 ms, then waits for two renderer
animation frames. Exact predicates and equal geometry snapshots are checked immediately before
and after capture, with another two-frame paint barrier. A transition triggers a bounded retry;
missing state or frames returns `NOT_READY`, never an empty capture pass. No state, style or
animation override is injected.

The [stable capture slice](2026-10-04-onboarding-native-fixture-stable-capture.json) records nine
fresh Electron44 replays at the final host byte hash: the previous seven scenarios plus the two
EN640/EN960 race regressions. All nine exit 0; each capture has equal before/after snapshots,
matching initial state and content dimensions, and at least 500 ms of stability. The complete
containment suite passes **17/17**, zero skips. This author also inspected the actual new
[640 PNG](2026-10-04-onboarding-native-fixture-stable-640.png) and
[960 PNG](2026-10-04-onboarding-native-fixture-stable-960.png): both show the seeded Onboarding
form and tabs. These two source-bound images prove capture state, not the styled matrix, control
reachability, CUA acceptance or AD02. Root/visual author must repeat paired evidence with this
host and the assembled renderer; old pairs are not reused as accepted evidence.

## Pushed stable-source replay

Exact stable host code commit `4df3079e01dd3493bf8ae302549de603257f4a26` was pushed and the
remote branch verified. The earlier clean authenticated cold clone fetched that branch and
advanced with `git merge --ff-only FETCH_HEAD`, both exit 0. Its existing real product build is
unchanged by these test-host-only follow-ups. It replayed 17/17 containment tests, verified the
host SHA, 472 source/190 build pins, all nine equal capture boundaries and both PNG byte hashes.
One fresh native EN640×900 replay from that exact pushed commit also exited 0 with equal seeded
pre/post-capture state. The cold checkout remained clean. This receipt-only follow-up preserves
those exact code bytes and does not replace independent assembled-candidate acceptance.

## Exact next task

Root/visual author: import the immutable two host files into the owning checkout, build that
checkout's real current renderer/preload and prepare fresh fixtures. Copying the two commit-addressed
host blobs unchanged into an isolated author worktree is supported; `import.meta.url` derives its
own checkout, and a fixture prepared elsewhere is refused. Run the containment gate and replay
native capability before using this host for the full styled state matrix through CUA. Keep actual
production-main/AD02 restart acceptance separate and retain blocked predicates until their own
receipts pass. Root reconciles maps/registers/merge documentation and runs the converged gate;
no release, install or full hosted dispatch follows from the author branch push.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — TDD and bounded source delivery
- `working-in-passioncode` — org pin and handoff policy — not a skill this family ships

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>

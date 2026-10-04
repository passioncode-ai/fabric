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

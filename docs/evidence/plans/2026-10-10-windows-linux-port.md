# Fabric on Windows and Linux — brief (0.3.5, CO-238)

Run `2026-10-10-windows-linux-port`. Plan row P-16 ([general development plan](../backlog.md#general-development-plan)).
Organization standard: [platforms](https://github.com/passioncode-ai/fabric-workspace/blob/main/knowledge/platforms.md)
(PL-01…PL-09), first implemented by Fabric Switchboard, then Fabric Inbox and Fabric Dashboards.

## Request and decisions

- Operator, 2026-10-09: every PassionCode.ai product runs natively on Apple silicon and Intel Macs, on Windows and on
  Linux («все проекты должны поддерживать новые процессоры интел и эпл и виндовс и линукс»).
- Operator, 2026-10-10: «Надо сделать адаптацию сборки под Windows, чтобы всё корректно работало. И под линукс тоже.»;
  later the same day, «давай сразу поддержку на виндовс собирать и выпускать как другие приложения наши».
- D1 — Windows signing: Azure Trusted (Artifact) Signing, as PL-03 and the other products do.
- D2 — Verification: GitHub runners for Windows x64/arm64 and Ubuntu x64/arm64, an OrbStack Linux VM on this Mac, and
  a manual smoke on the operator's own Windows computer.
- D3 — Packages: x64 and arm64 each; NSIS (per-user) for Windows; AppImage and .deb for Linux (PL-01, PL-02).
- D4 — Version: 0.3.5 (0.3.4 became the fresh-install fix with universal macOS, the operator's call 2026-10-10).

## Source ledger

| Source | What it gives |
|---|---|
| `knowledge/platforms.md` PL-01…PL-09 and its *Lessons from the ports* | the shared rules: packages, signing, updates, secrets, places, links and processes, CI, services |
| fabric-inbox and fabric-dashboards (Electron) | the electron-builder win/linux config, the release jobs and the nightly platform jobs this port copies |
| fabric-agent-contract DEC-0032, DEC-0033 | the services folder per OS, the supervisor names, the Windows token-file ACL rule |
| this repository, measured 2026-10-10 | `process.platform` in 9 main modules; `/bin/sh` in 2; `/bin/zsh` default shell; the Keychain read in `quota.ts`; POSIX process groups in `processBoundary.ts`; 17 files that set 0600 modes; node-pty ships prebuilds for darwin and win32 only (none for Linux) |

## Modules (walking skeleton first)

| Module | What it delivers | REQs |
|---|---|---|
| W1 Packaging and CI | electron-builder targets (NSIS x64/arm64; AppImage and .deb x64/arm64), node-pty per platform (win32 prebuilds; built from source on Linux), the release jobs on native runners with Azure signing, the nightly platform jobs with an install-and-start smoke | REQ-01…REQ-04 |
| W2 Start | the app reaches its first window on Windows and Linux: PATH, the bundled stack folder per OS, the startup remedies per OS, Docker Desktop / Docker Engine as the stack's prerequisite | REQ-05…REQ-07 |
| W3 Processes and terminals | default shell per OS, `where` on Windows, the quit deadline without `/bin/sh`, a Windows process-tree stop (`taskkill /T` behind an identity check), the Observatory vault call without `/bin/sh` | REQ-08…REQ-11 |
| W4 Files and secrets | data and log places per PL-06; token files Fabric writes with the DEC-0033 ACL on Windows; the coding-agent sign-in and quota readers without the macOS Keychain | REQ-12…REQ-14 |
| W5 Product surfaces | the menu and icon per OS, the services folder and supervisor names (DEC-0032), the docs: a platform runbook, the lifecycle table per OS, the first-run scenario's prerequisite | REQ-15…REQ-17 |

## REQ table

| REQ | Requirement | Verified by |
|---|---|---|
| REQ-01 | A release carries `Fabric-X.Y.Z-win-x64.exe`, `-win-arm64.exe`, `-linux-x64.AppImage`, `-linux-arm64.AppImage`, `-linux-x64.deb`, `-linux-arm64.deb` beside the universal DMG, in `SHA256SUMS`, GPG-signed and attested | the release run's asset list and `shasum -c` |
| REQ-02 | The Windows installers are Authenticode-signed through Azure in the protected `release` environment; unsigned builds never publish | `Get-AuthenticodeSignature` on the runner; the job's environment |
| REQ-03 | Each package installs and starts on its own runner (Windows x64/arm64, Ubuntu x64/arm64 under Xvfb) — the app reaches its first window or its own startup dialog, never a crash | the platform jobs' smoke step |
| REQ-04 | The nightly batch builds and smokes every platform without signing (rules §3: no push/PR full suites) | the nightly run naming one job per OS and architecture |
| REQ-05 | On Windows and Linux the PATH the app runs with finds `supabase`, `docker` and the coding agents where their installers put them | a unit test per OS of the PATH builder; the smoke |
| REQ-06 | The startup remedies name the stack folder each OS actually uses | `stack-folder.test.mjs` per OS |
| REQ-07 | With Docker missing or stopped, the startup dialog says so and how to fix it on that OS | `startupFailure` cases per OS |
| REQ-08 | A terminal session starts the OS's shell (Windows: PowerShell, else `COMSPEC`; Linux: `$SHELL`, else `/bin/bash`) | `pty` launch tests per OS |
| REQ-09 | Detecting an executable uses `where` on Windows and never `/usr/bin/env` | detection tests per OS |
| REQ-10 | Quit ends the app within its deadline on every OS, with no POSIX shell | the quit tests per OS |
| REQ-11 | Stopping a session ends its process tree on Windows (`taskkill /T`, only for a still-owned root) | a Windows runner test |
| REQ-12 | Data, logs and the hub file live where PL-06 says, per OS | path tests per OS |
| REQ-13 | A token file Fabric writes on Windows carries the DEC-0033 ACL (owner and grants: the user, SYSTEM, Administrators; protected) | a Windows runner test reading the ACL |
| REQ-14 | Coding-agent sign-in and quota read the agents' own credential files on Windows and Linux (no Keychain), read-only and bounded | reader tests per OS |
| REQ-15 | The services folder and the supervisor names follow DEC-0032 per OS | `agentRegistry` path tests per OS |
| REQ-16 | The application menu and icon are right per OS (no macOS app menu on Windows/Linux) | `menu.test.mjs` per OS |
| REQ-17 | The docs say what runs where: a platform runbook beside `release-mac.md`, the lifecycle table per OS (PL-06), the first-run scenario's Docker prerequisite per OS | `check-docs.sh`, the UX lint |

Deferred at the brief, each a carry-over row when its module starts: the native view host on Windows/Linux (it throws
off macOS and nothing in the app creates it today), measured runtime tuples for win32/linux (nothing in the app reads
them yet), self-update feeds per platform (P-12).

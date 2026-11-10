# N6 receipt: the build under test, v0.3.18-rc.2

Date: 2026-11-10 (UTC). Ledger: [the 0.3.18 verification, Release close, item 2](../2026-11-09-release-0318-verification.md#owed-in-0318s-release-close).
Every N6 receipt in this folder names this build; its SHA-256 and signer are repeated in each.

| What | Value | Read by |
|---|---|---|
| Release commit | `bbc90b7ae4bccd65e9b8a8d8e95cb9582a14f359` (`release: Fabric 0.3.18 on the run-three candidate d5861ddb`), on `origin/main` | `git merge-base --is-ancestor bbc90b7a origin/main`, exit 0 |
| Tag | `v0.3.18-rc.2` on `bbc90b7a` | `git ls-remote origin 'refs/tags/v0.3.18*'`: `bbc90b7a… refs/tags/v0.3.18-rc.2`, with no peeled line, so the tag is lightweight where item 2 wrote `git tag -a` (a deviation without effect on the build; `v0.3.18` is to be annotated) |
| Release run | `release.yml` run 42720627493, `workflow_dispatch` on `v0.3.18-rc.2`, `publish=false`, 2026-11-09 23:27:41Z to 2026-11-10 00:29:07Z | `gh run view 42720627493`: guard, preflight, macos, windows (windows-latest, x64), windows (windows-11-arm, arm64), linux (ubuntu-24.04, x64), linux (ubuntu-24.04-arm, arm64), publish / publish: all `success` |
| Artifact | `signed-release-v0.3.18-rc.2`, 12 files | `shasum -a 256 -c SHA256SUMS`: 12 lines `OK` |
| macOS DMG | `Fabric-0.3.18-universal.dmg`, 273 432 926 bytes, sha256 `8c3db3519b4026bedf1d686eddc5f66608fe5b9ff6e1cb207bde6bcb0f2e8ede` | `fabric-0.3.18-mac.json` and `SHA256SUMS` |
| macOS signer | Developer ID Application (team `KJ35UYYL22`), hardened runtime; notarization of the DMG `Accepted`; `spctl -a -t open --context context:primary-signature`: `Notarized Developer ID` | `codesign -dvv`, `spctl`, `fabric-0.3.18-mac.json` (`checks.codesignDeepStrict: passed`, every Mach-O arm64 and x86_64) |
| Windows SMOKE (PL-14) | x64 and arm64: `windows_authenticode` `SIGNED (Azure Artifact Signing)`; `installed-start` pass (the app started and named its stack's absence, `supabase-cli-missing`); `fabric-mcp` pass (answered `initialize` and listed `fabric_whoami`, exited 0 when its stdin ended) | `fabric-0.3.18-windows-x64.json`, `fabric-0.3.18-windows-arm64.json` |
| Linux SMOKE (PL-14) | x64 and arm64: `installed-start` pass, `fabric-mcp` pass, as above | `fabric-0.3.18-linux-x64.json`, `fabric-0.3.18-linux-arm64.json` |

Each SMOKE receipt names the commit `bbc90b7ae4bccd65e9b8a8d8e95cb9582a14f359` and version `0.3.18`.

`v0.3.18-rc.1` (on the superseded release commit `a86481ca`, run 42689818347) was never installed and is not this
build.

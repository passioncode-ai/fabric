# ADR-0111 — Fabric is released from CI

**Status:** accepted.
**Date:** 2026-10-03. **Decided by:** the operator's organization decision of 2026-10-03 that every
PassionCode.ai product signs its published builds only in GitHub Actions
([release-signing README](https://github.com/passioncode-ai/.github/blob/main/release-signing/README.md),
[design](https://github.com/passioncode-ai/.github/blob/main/docs/release-signing/DESIGN.md), Fabric's row in
"The products"). Supersedes nothing; changes how plan row P-03 is carried out, not what it asks.

## Context

Fabric 0.2.0 (2026-09-29) was built, signed and notarized on the operator's Mac by
`scripts/release-mac.mjs`, with the operator's Developer ID found in the login keychain by a team id written
into `apps/desktop/electron-builder.release.yml` (`identity: "KJ35UYYL22"`), and published by hand as a
prerelease `fabric-v0.2.0` of the website repository, because this repository was private then
([release-mac.md](../launch/release-mac.md), receipt
[`fabric-0.2.0-mac.json`](../releases/fabric-0.2.0-mac.json)). This repository is public now
(`gh repo view passioncode-ai/fabric --json visibility` → `PUBLIC`, 2026-10-03), so its own releases are a
public download.

The organization's rule: the signing keys live only in each repository's protected `release` environment;
a member of `release-approvers` who did not push the tag approves; admins cannot bypass; every published
file is attested (Sigstore) and listed in a GPG-signed `SHA256SUMS`. The `release` environment and its
secrets already exist here (APPLE_TEAM_ID, the CI Developer ID, the App Store Connect key, the
organization GPG key).

## Decision

### 1. A release is a `vX.Y.Z` tag on main, built and signed by `.github/workflows/release.yml`

- `preflight` (no secret, no environment): `node scripts/release-mac.mjs --check-only --tag <tag>` — the
  commit is on `origin/main` (its tip, or a tag on main that main has since moved past: ancestry, not
  equality), the tag names the version in `apps/desktop/package.json` (or a `-rc.N` rehearsal of it), and
  the release gate (`docs/launch/release-gate.json`, P-02) is clear.
- `macos` (environment `release`, waits for approval): `passioncode-ai/.github/actions/apple-signing@v1`
  makes a throwaway keychain with the CI Developer ID and names the identity; `release-mac.mjs` builds with
  it, and the job uploads the DMG and its receipt as `release-macos`; the keychain is removed on every path.
- `publish` (`release-publish.yml@v1`, environment `release`, a second approval): attests every file,
  writes and signs `SHA256SUMS`, and creates the release in this repository with the `CHANGELOG.md`
  section `## X.Y.Z` as its notes. A published release is never rewritten. While Fabric is an early
  preview (0.x) every release is marked a **prerelease** (`prerelease: "true"` in the publish call), as
  0.2.0 was; the tag stays `vX.Y.Z`, matching `apps/desktop/package.json`, rather than a `-preview.N` tag
  the version does not carry. Ending the preview is a one-line change to `auto`.
- A rehearsal is a `vX.Y.Z-rc.N` tag (the push trigger ignores it) plus
  `gh workflow run release.yml --ref vX.Y.Z-rc.N -f publish=false`: the signed set is kept as a workflow
  artifact for 14 days and no release is created.

### 2. Notarization stays with electron-builder and the script, using the API key

Of the two shapes the organization allows, Fabric keeps the one it had: electron-builder notarizes and
staples the app with the App Store Connect key (the script maps `ASC_*` to `APPLE_API_KEY*`), then builds
and signs the DMG around the stapled app; the script notarizes and staples the DMG and checks both —
`codesign --verify --deep --strict` and the signer read back from the app (`codesign -dvv`), `spctl` on the
app (execute) and the DMG (`context:primary-signature`), `stapler validate` on both. The shared `notarize`
action would have to run between electron-builder's app and DMG steps, which means splitting the build
into a `--dir` pass and a `--prepackaged` pass; the result would be the same two stapled, assessed files
with more moving parts. Every shipped Mac file is the DMG, and the DMG is stapled and assessed.

### 3. No identity or team is written into Fabric

The release config names no identity, so on its own it builds unsigned (the base config's
`identity: null`). The script takes the identity from `--identity` or `FABRIC_SIGN_IDENTITY` (CI passes the
action's output) and gives electron-builder a config that extends the release config with it, without the
certificate-type prefix electron-builder refuses; in CI the identity is looked up only in the action's
keychain (`CSC_KEYCHAIN`). The receipt's `signed` and `team` are read from the signature, not written.

### 4. A build made anywhere else is a debug build

The script still runs on a person's Mac with their own identity and the key from the secret store, for
debugging the build. Its receipt says `local debug build (never published)`, and it is never published or
attached to a release.

## Consequences

- The website's download (`passioncode-ai/passioncode-ai.github.io`, `fabric/release.json`) keeps pointing
  at `fabric-v0.2.0` in the website repository, which stays valid. From the first CI release on, the
  website's own change points `fabric/release.json` at this repository's release
  (`https://github.com/passioncode-ai/fabric/releases/download/vX.Y.Z/Fabric-X.Y.Z-arm64.dmg`, the SHA-256 from
  its `SHA256SUMS`). That is the website's work, named in [release-mac.md](../launch/release-mac.md); this
  repository does not write to it.
- `CHANGELOG.md` becomes the home of release notes: an `## Unreleased` section collects them and the release
  pull request renames it `## X.Y.Z`.
- Affects: [`.github/workflows/release.yml`](../../.github/workflows/release.yml),
  [`scripts/release-mac.mjs`](../../scripts/release-mac.mjs),
  [`scripts/lib/release-mac.mjs`](../../scripts/lib/release-mac.mjs) and its test
  [`scripts/test/release-mac.test.mjs`](../../scripts/test/release-mac.test.mjs),
  [`apps/desktop/electron-builder.release.yml`](../../apps/desktop/electron-builder.release.yml),
  [`docs/launch/release-mac.md`](../launch/release-mac.md), [`CHANGELOG.md`](../../CHANGELOG.md), the
  [README](../../README.md) and the [design map](../reports/map.html#changelog).

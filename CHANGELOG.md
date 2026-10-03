# Changelog

Release notes for Fabric. The release pull request renames `## Unreleased` to `## X.Y.Z`; the release
workflow publishes that section as the notes of the `vX.Y.Z` release
([docs/launch/release-mac.md](docs/launch/release-mac.md), [ADR-0111](docs/adr/0111-fabric-is-released-from-ci.md)).
Earlier versions: 0.2.0 (2026-09-29), receipt [`docs/releases/fabric-0.2.0-mac.json`](docs/releases/fabric-0.2.0-mac.json).

## Unreleased

- **Releases are built and signed in CI.** A `vX.Y.Z` tag on main runs `.github/workflows/release.yml`:
  after a member of `release-approvers` approves, the DMG is signed with the organization's CI Developer ID,
  notarized and stapled, then attested (Sigstore), listed in a GPG-signed `SHA256SUMS` and published as a
  prerelease of this repository while Fabric is an early preview. No signing identity or team id is written into the repository any more; a
  build made on a laptop is a debug build and is never published.

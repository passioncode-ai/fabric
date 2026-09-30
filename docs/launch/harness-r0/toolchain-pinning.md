<sub>ssheleg skills — task-pipeline · evidence-docs</sub>

# Desktop toolchain verification packet

## Objective and scope

Close the false implication that hashing any `toolchain.lock.json` verifies the
actual build tools. This packet adds one measured local profile, a verifier,
strict packaging entry and two-build comparison. It does **not** qualify a
universal release target or prove reproducible native packaging.

Parent integration owns the shared map/registers, workflow and package-script
wiring. No dependency upgrade, install, vendor/model launch, account access,
release, signing or deployment belongs to this packet.

## Measured inputs and decisions

Source baseline: `b08166567f3fdd68166baa70cb2b625bd283fcfd`.
Integration prerequisites: transcript migration63 from
`e2d41226ab9a0f168106c4ae60545fa3bb9356ed` and the startup-owner's
`apps/desktop/src/shared/schemaContract.json`. Verification used local copies of
those two files; neither is re-owned or committed by this packet. A standalone
checkout of this branch needs those prerequisite packets before the manifest
producer can pass. The new producer intentionally refuses the baseline's older
migration inventory rather than silently claiming compatibility.
Measurements taken 2026-09-27:

- `node --version`: `v26.8.2`; `uname -sm`: `Darwin arm64`;
  `uname -r`: `25.6.0`; `sw_vers`: macOS `26.6.2`, build `25G83`.
- `pnpm --version` in this project: `11.21.0`. With package-manager switching
  disabled, the PATH executable instead reports `12.4.1`. The version selector
  had obscured this difference. An already cached standalone `11.21.0` was used
  explicitly; its private machine path is deliberately not committed.
- The exact package versions in [the profile](../../../toolchain.lock.json)
  were read from the installed desktop package manifests and compared with
  [the dependency lock](../../../pnpm-lock.yaml). Electron's installed
  `dist/version` also reports `44.0.0`.
- The installed `node_modules/.pnpm/lock.yaml` and tracked lock both hash to
  `942096860e7443ee0cb00573d5746d5c5b21cc232aed7db7a09502f0d7ded069`.

The profile covers host/kernel, Node, pnpm, installed CLI entrypoint presence,
Electron distribution version metadata, selected build-tool package versions
and both dependency-lock hashes. It does **not** authenticate installed binary
bytes or pin Xcode/SDK, Supabase/Postgres, a container image, CI runner image,
network resources, environment-variable effects, certificates or signatures.
Package versions and lock integrity are evidence about declared/installed
inputs, not an assertion that an arbitrary compromised local filesystem is safe.

The producer also replaces the unsupported rolling `migration count - 10`
compatibility window with the startup guard's shared `FabricSchemaContract@1`
(minimum63, maximum63). It refuses malformed contracts, reversed windows and
any migration inventory beyond the explicitly declared maximum. Fixture checks
cover floor63, wrong types, absent fields, maximum64 and an extra migration64.
This is a declared/tested reader contract, not a promise that future schemas work.

The existing CI workflow at this baseline requests Node `24` and a latest
runner; its database job requests Supabase `latest`. Those are separate,
**unqualified** targets for this local profile. They were not changed. General
CI/development manifest generation may continue with `toolchainDigest:null` and
explicit failure reasons. Strict packaging refuses a nonmatching environment.

## Implementation and use

[The verifier](../../../scripts/lib/toolchain.mjs) requires the exact pin shape,
non-ranged versions, the current host, pnpm declaration and executable version,
installed tools, and matching tracked/installed dependency locks. Missing or
malformed pins never produce a digest. It neither installs nor selects another
pnpm version. `FABRIC_PNPM_EXECUTABLE` may name an already installed version;
otherwise the PATH executable is checked as-is.

```sh
# Set this only to an existing executable; there is no download helper.
export FABRIC_PNPM_EXECUTABLE=/absolute/path/to/existing/pnpm-11.21.0
node scripts/check-toolchain.mjs
node scripts/compare-bundle-builds.mjs
node scripts/package-pinned.mjs
```

The package wrapper verifies before invoking the existing package script and
sets `FABRIC_REQUIRE_TOOLCHAIN=1`. The manifest producer verifies again after
the bundle build, before writing a strict manifest. Pnpm dependency auto-install
is disabled with an error policy. The unchanged packager configuration currently
uses `identity: null`; this command is **not** a signed release pipeline.

The comparison script invokes the existing electron-vite CLI with the current
Node directly, avoiding pnpm's automatic dependency installation. It clears only
the checkout's generated `apps/desktop/out` before each build, then compares all
relative paths, sizes and SHA256 file checksums. It does not compare generated
manifest timestamps, `.app` output or signing data.

An initial `pnpm exec` comparison attempt triggered pnpm's implicit install
check because the isolated worktree borrowed dependency links. Pnpm refused
`ERR_PNPM_UNSAFE_MODULES_DIR` before removing the shared dependency target.
The final direct-CLI comparison avoids that path; no install was retried.
The dependencies were borrowed read-only; links are not part of the commit.

## Evidence and limits

`node --test scripts/test/toolchain.test.mjs scripts/test/build-identity.test.mjs`
passed **8 tests**. Negative fixtures reject arbitrary JSON, omitted/ranged
pins, wrong host/Node/pnpm, absent executable, wrong lock and missing package
metadata/CLI entrypoints, stale installed locks and unqualified schema changes. Real copied-script fixtures prove strict refusal creates no manifest
and never invokes the packaging command after refusal; a successful fixture verifies strict manifest and no-auto-install flags reach the package script. Development emits a null digest. With the prerequisite overlays, actual strict manifest generation and `node scripts/check-release.mjs` also passed (schema63–63). Consumer/UI receipt handling is separately owned by the startup packet; this producer packet alone does not prove end-to-end display.

The actual [two-build receipt](toolchain-comparison.json) records **191 files**
per build and equal digest
`6c2a744818616cff1aa0636282d78b43c453e09a83fe761a295b6ebec18553e9`.
There were no differing paths. This establishes repeatable bundle output for
**two clean output-directory builds in one checkout on one dependency tree**.
It does not establish independent clean-install reproduction, another host,
native package determinism, signed-package determinism or full release readiness.
The source working tree contained this packet and local dependency links; it
was not presented as a clean release artifact.

## Handoff and exact next work

Integrate the bounded scripts/profile/tests and run the verifier in the parent
checkout with the explicitly selected installed pnpm. Wire strict preflight and
these fixtures and the startup owner's scoped manifest consumer into the release entry only after review; retain generic CI's
unverified status until its own exact target is measured. Run two independent
frozen-lockfile installations/builds in the qualified release environment, then
compare unsigned packaged artifacts, native modules and all declared exclusions.
Qualify signing/notarization separately. Never convert the limited comparison
receipt into a claim that signed packages or database migrations reproduce.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — bounded release tooling packet and checks
- [`evidence-docs`](https://github.com/ssheleg/task-pipeline) — measured pin and two-build evidence with explicit limits

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>

# Releasing Fabric for macOS

The release is one DMG for Apple silicon: Developer ID signed, hardened runtime, notarized and
stapled — the app inside and the DMG itself. **It is built and signed only in CI**, by
[`.github/workflows/release.yml`](../../.github/workflows/release.yml) in this repository's protected
`release` environment ([ADR-0111](../adr/0111-fabric-is-released-from-ci.md); the organization's
[release signing](https://github.com/passioncode-ai/.github/blob/main/release-signing/README.md)). The
workflow runs [`scripts/release-mac.mjs`](../../scripts/release-mac.mjs) with
[`apps/desktop/electron-builder.release.yml`](../../apps/desktop/electron-builder.release.yml), which extends
the local packaging config; `pnpm --dir apps/desktop package` keeps building the unsigned folder.

## What the installed app needs

- **macOS on Apple silicon.** The build is `arm64` only.
- **Docker** (Docker Desktop or OrbStack) running, and the **Supabase CLI** (`brew install supabase/tap/supabase`).
  The app ships its stack project (`config.toml`, `seed.sql`, the migrations) in `Contents/Resources/stack`
  and keeps a working copy in `~/Library/Application Support/Fabric/stack`
  ([`bundledStack.ts`](../../apps/desktop/src/main/bundledStack.ts)); on first start `supabase start` creates
  the database and applies every migration. It needs no checkout of this repository. When Docker or the CLI is
  missing, the startup dialog names which ([`startupFailure.ts`](../../apps/desktop/src/shared/startupFailure.ts)).
- **Schema upgrades are not automatic.** A newer build whose schema is ahead of an existing database stops
  with the exact command to run in that stack folder; Fabric never migrates a database on its own.

## How a release is made

A **`vX.Y.Z` tag on main** launches a release. Nothing else does: no laptop holds the release key, and a
build signed anywhere but the `release` environment is a debug build that is never published.

1. **Land, then release.** The release pull request lands on `main` first: `version` in
   [`apps/desktop/package.json`](../../apps/desktop/package.json) is `X.Y.Z`, the `## X.Y.Z (unreleased)` (or `## Unreleased`) section of
   [`CHANGELOG.md`](../../CHANGELOG.md) is renamed `## X.Y.Z` (it becomes the release notes), and
   `bash scripts/ci.sh fast` is green.
   **The release gate.** [`docs/launch/release-gate.json`](release-gate.json) names the version and the
   verification ledger that clears it ([general plan](../evidence/backlog.md#general-development-plan),
   P-02). The script refuses a tree with any file flagged skip-worktree or assume-unchanged, takes the
   version from the commit, and reads both files from the commit; it refuses unless the ledger has exactly one section per
   iteration (three), each linking its reviewer reports, every finding row disposed (fixed, ruled, not a
   defect, not recoverable, stopped), and each ending with its one line
   `Exit for iteration N: … Blocking findings open: none.`, and unless the ledger's title names exactly the
   version it clears — each release has its own ledger; 0.3.0's is
   [`2026-10-03-verification.md`](../evidence/plans/2026-10-03-verification.md), 0.3.1's (the hub) is
   [`2026-10-04-hub-verification.md`](../evidence/plans/2026-10-04-hub-verification.md), and the bump to
   0.3.1 points the gate at it (`scripts/lib/release-gate.mjs`, tested by
   `scripts/test/release-gate.test.mjs`).
   Preflight also requires exactly one nonempty finalized `## X.Y.Z` changelog entry.
   The gate names `verifiedCommit`, a full commit SHA reviewed by the final iteration. It must
   be an ancestor of the release commit. After it, only named release metadata and the desktop
   package version may change; runtime/build/dependency changes require a new verified candidate.
   The package comparison rejects changes beyond `version`. Checked by
   `scripts/lib/release-mac.mjs#verifiedCandidateProblem` and release-input regression tests.
   The current historical 0.3.0 gate has no candidate pin; it is not permission to rerelease 0.3.0.
2. **Push the tag** on the release commit: `git tag -a vX.Y.Z <commit on main> -m "Fabric X.Y.Z" && git push origin vX.Y.Z`.
   A published release is never rewritten; a fix is a new tag.
3. **`preflight`** runs without secrets: `node scripts/release-mac.mjs --check-only --tag vX.Y.Z` refuses
   unless the commit is on `origin/main` (its tip, or a tag on main that main has moved past — ancestry,
   not equality), the tag names the version the commit carries, and the release gate is clear.
4. **Approval.** The `macos` job waits for the `release` environment. A member of `release-approvers` —
   whoever pushed the tag included ([ADR-0113](../adr/0113-any-release-approver-may-approve-the-tag-pusher-included.md))
   — opens the run and approves ("Review deployments"); admins cannot bypass. An agent never approves.
5. **`macos`** builds on `macos-latest`: `passioncode-ai/.github/actions/apple-signing@v1` makes a throwaway
   keychain with the CI Developer ID and names it; `release-mac.mjs --tag vX.Y.Z` gets that identity in
   `FABRIC_SIGN_IDENTITY` and the keychain in `CSC_KEYCHAIN`, and the App Store Connect key as the
   secrets `ASC_*` (written to a mode-600 temporary file, never printed or put in argv). electron-builder
   signs the app, notarizes and staples it, and builds and signs the DMG; the script notarizes and staples
   the DMG. It fails unless `codesign --verify --deep --strict` passes on the app and the signer read back
   from it is a Developer ID Application with the hardened runtime, Gatekeeper accepts the app and the DMG,
   and the stapled tickets of both validate. The DMG and its receipt `fabric-X.Y.Z-mac.json` (size,
   SHA-256, notarization id, signer, team, the checks, the CI run) are uploaded as `release-macos`; the
   keychain is deleted on every path.
6. **`publish`** waits for a second approval (it holds the GPG key), then attests every file (Sigstore),
   writes `SHA256SUMS` and `SHA256SUMS.asc`, and publishes the release **in this repository**, marked a
   prerelease while Fabric is an early preview (`prerelease: "true"`, ADR-0111 §1):
   `https://github.com/passioncode-ai/fabric/releases/tag/vX.Y.Z`. Verify a download with
   `gpg --verify SHA256SUMS.asc SHA256SUMS`, `shasum -a 256 -c SHA256SUMS --ignore-missing` and
   `gh attestation verify Fabric-X.Y.Z-arm64.dmg --owner passioncode-ai --signer-repo passioncode-ai/.github` —
   the attestation is signed by the organization's shared publish workflow, so `-R passioncode-ai/fabric` alone
   fails ("verifying with issuer sigstore.dev"; the shared workflow's own note, measured 2026-10-03).
7. Smoke the published DMG on this Mac: install it, then `FABRIC_APP_EXECUTABLE=/Applications/Fabric.app/Contents/MacOS/Fabric
   FABRIC_PLAYWRIGHT_MODULE=<playwright> node apps/desktop/test/chat-activation-native.test.mjs` — the packaged
   app starts from its own stack, the window is named Fabric, the chat saves and survives a cold restart.
8. Take the site's screenshots from the packaged app on a **fresh English demo estate** —
   `psql "$DB_URL" -v ON_ERROR_STOP=1 -v estate=<new uuid> -v lang=en -f scripts/fixtures/launch-estate.sql`
   — never from an estate a walk has already written into.
9. **The website is the website's change.** `passioncode-ai/passioncode-ai.github.io` serves
   `/fabric/download/macos` from its `fabric/release.json`, which still points at the 0.2.0 prerelease in
   the website repository (valid). For the first CI release, the website's own pull request sets `tag`
   `vX.Y.Z`, `repository` `passioncode-ai/fabric`, `releaseUrl`
   `https://github.com/passioncode-ai/fabric/releases/tag/vX.Y.Z`, `downloads.macos`
   `https://github.com/passioncode-ai/fabric/releases/download/vX.Y.Z/Fabric-X.Y.Z-arm64.dmg` and `sha256` from the
   release's `SHA256SUMS`, plus the screenshots and the brand facts row; then `npm run deploy` and the live
   receipt ([site handoff](https://github.com/passioncode-ai/passioncode-ai.github.io/blob/main/docs/HANDOFF.md)).
   Download the asset anonymously and check its SHA-256 and `spctl -a -t open --context context:primary-signature`
   before pointing anything at it. This repository does not write to the website.

### Rehearsal

Push `vX.Y.Z-rc.N` on a commit of main (the push trigger ignores `-rc` tags; never reuse or move a tag),
then `gh workflow run release.yml --ref vX.Y.Z-rc.N -f publish=false`. Every job runs and waits for the same
approvals; the signed, attested and summed set is kept as the workflow artifact
`signed-release-vX.Y.Z-rc.N` for 14 days, and no release is created. The release gate applies to a
rehearsal too: a version whose gate is not clear stops at `preflight`.

### A local build is a debug build

The same script runs on a Mac with a person's own Developer ID, to debug the build. The key comes from
the secret store and is never printed:

```bash
python3 ~/DATA/project-observatory/tools/use_secret.py run apple-publisher-kj35uyyl22 \
  ASC_API_KEY_P8_B64,ASC_KEY_ID,ASC_ISSUER_ID -- node scripts/release-mac.mjs --identity '<your Developer ID Application name, or its team id>'
```

Its receipt says `local debug build (never published)`. It is never published or attached to a release.

**Before CI (0.2.0).** The steps above replaced a by-hand release: the operator built, signed and
notarized on their Mac and published the DMG as a prerelease `fabric-v<version>` of the website repository,
because this repository was private then.

**0.2.0, 2026-09-29:** receipt [`docs/releases/fabric-0.2.0-mac.json`](../releases/fabric-0.2.0-mac.json)
(commit `f356999`, SHA-256 `ae04aabd…9ae6`, DMG notarization Accepted); packaged smoke PASS; published as
[`fabric-v0.2.0`](https://github.com/passioncode-ai/passioncode-ai.github.io/releases/tag/fabric-v0.2.0) and
offered on [passioncode.ai/fabric](https://passioncode.ai/fabric/#download) (site PRs #7 and #8, Worker version
`3726c08e-4a39-4d3b-8678-2edcb58c3716`).

## Upgrading an existing database

This section is the upgrade procedure, **not an executed upgrade receipt**. Fabric never migrates
an existing database automatically. The 0.3.1 candidate's compiled contract admits schema **78**
(the number of applied migration files); the newest migration's filename ends in **80** because
other work reserved filenames. Do not use `max(version)` or a filename suffix as schema readiness.
The actual guard is `public.schema_version()` against `src/shared/schemaContract.json`.

1. Stop Fabric and every enrolled writer/adapter. A quiet window does not prove the database has
   no writers: inspect the registered services and database connections. Do not upgrade beneath
   another running session. Keep the installed 0.3.0 database at schema 75 until a verified signed
   0.3.1 build is available. First install that build, attempt startup once so its bundled stack is
   copied, then quit: readiness refuses old data before domain services start.
2. Make a private backup outside the checkout before any migration. The local stack uses loopback
   database port 54322. The following commands prompt for the existing database password; never
   put it in argv or a tracked file. A prepared private mode-600 PGPASSFILE is also supported by
   PostgreSQL. Name the backup deliberately and retain the dump, existing build, stack config and
   journal event count together. Dumps contain private data; do not attach them to issues.

   ```sh
   umask 077
   mkdir -p "$HOME/Library/Application Support/Fabric/backups"
   PGHOST=127.0.0.1 PGPORT=54322 PGUSER=postgres PGDATABASE=postgres \
     pg_dump --password --format=custom \
     --file="$HOME/Library/Application Support/Fabric/backups/pre-0.3.1.dump"
   PGHOST=127.0.0.1 PGPORT=54322 PGUSER=postgres PGDATABASE=postgres \
     psql --password -v ON_ERROR_STOP=1 \
     -c 'select public.schema_version(); select count(*) from public.journal;'
   ```

   Confirm the actual local stack port before using this example; another configured stack needs
   its own connection settings. `pg_restore --list <dump>` verifies the archive can be parsed;
   only restoring it into a disposable database proves it can be restored.
3. Restore the dump into a **separate disposable stack**, with its own project id, port block and
   volumes. Never point a rehearsal at `fabric` or ports 54321/54322. Apply the installed candidate's
   migration set there; compare schema_version, journal count and replayed projections. Exercise
   an existing estate's queries and the new authority boundaries. Restored hub requests must not
   collect old source credentials or authorize pending work. The coordinated `scripts/ci.sh full`
   uses disposable data, but its synthetic fixture is not a rehearsal of this private dump. Record
   those checks separately. Do not proceed if the backup restore or candidate rehearsal fails.
4. With writers still stopped and the verified backup retained, apply to the working bundled stack:

   ```sh
   cd "$HOME/Library/Application Support/Fabric/stack"
   supabase migration up --local
   PGHOST=127.0.0.1 PGPORT=54322 PGUSER=postgres PGDATABASE=postgres \
     psql --password -v ON_ERROR_STOP=1 \
     -c 'select public.schema_version(); select count(*) from public.journal;'
   ```

   `schema_version()` must equal the installed build's minimum/maximum (78 for this candidate).
   Compare the journal count with the backup receipt; do not accept a startup error as a successful
   migration. Start the installed build, verify the estate and a bounded task/consent workflow, then
   restart enrolled writers one by one. Record installed version/build and actual read/effect results.
5. If migration or startup acceptance fails, stop all writers again. Preserve the failed database
   and diagnostics privately, restore the tested backup into a clean compatible stack, and install
   the corresponding old signed build. Do not run old code on a newer schema or try to reverse
   journal/projector changes with ad hoc SQL. A restored archive's history is not fresh authority;
   follow the restore boundary and reconnect/consent as required. Document the exact rollback receipt.

The schema-behind startup message names this section and the command, but is not authorization to
skip backup/rehearsal. Acceptance of the 75→78 and 77→78 seeded rehearsal belongs to the converged
verification ledger. Live private-dump rehearsal and live upgrade remain operator-state checks.

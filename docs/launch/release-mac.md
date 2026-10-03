# Releasing Fabric for macOS

The release is one DMG for Apple silicon: Developer ID signed, hardened runtime, notarized and
stapled — the app inside and the DMG itself. It is built by [`scripts/release-mac.mjs`](../../scripts/release-mac.mjs)
from [`apps/desktop/electron-builder.release.yml`](../../apps/desktop/electron-builder.release.yml), which
extends the local packaging config; `pnpm --dir apps/desktop package` keeps building the unsigned folder.

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

## Cut a release

0. **The release gate.** [`docs/launch/release-gate.json`](release-gate.json) names the version and the
   verification ledger that clears it ([general plan](../evidence/backlog.md#general-development-plan),
   P-02). `scripts/release-mac.mjs` refuses unless that ledger has three iterations, each ending
   `Exit for iteration N: … Blocking findings open: none.` (`scripts/lib/release-gate.mjs`, tested by
   `scripts/test/release-gate.test.mjs`).
1. Bump `version` in [`apps/desktop/package.json`](../../apps/desktop/package.json), commit, and run
   `bash scripts/ci.sh fast`. The script refuses a dirty tree, so the build manifest names a real commit.
2. Build, sign, notarize and verify — the notarization key comes from the secret store and is never printed:

   ```bash
   python3 ~/DATA/project-observatory/tools/use_secret.py run apple-publisher-kj35uyyl22 \
     ASC_API_KEY_P8_B64,ASC_KEY_ID,ASC_ISSUER_ID -- node scripts/release-mac.mjs
   ```

   It fails unless `codesign --verify --deep --strict` passes on the app, Gatekeeper accepts the app and the
   DMG, and the stapled tickets of both validate. It writes the receipt `docs/releases/fabric-<version>-mac.json`
   (size, SHA-256, notarization id, the checks).
3. Smoke the built app: `FABRIC_APP_EXECUTABLE=apps/desktop/dist/mac-arm64/Fabric.app/Contents/MacOS/Fabric
   FABRIC_PLAYWRIGHT_MODULE=<playwright> node apps/desktop/test/chat-activation-native.test.mjs` — the packaged
   app starts from its own stack, the window is named Fabric, the chat saves and survives a cold restart.
4. Publish the DMG as an asset of a **prerelease** in the public site repository
   `passioncode-ai/passioncode-ai.github.io` (tag `fabric-v<version>`): the source repository is private, so
   its own releases are not a public download. Download the asset anonymously and check its SHA-256 and
   `spctl -a -t open --context context:primary-signature` before pointing anything at it.
5. Take the site's screenshots from the packaged app on a **fresh English demo estate** —
   `psql "$DB_URL" -v ON_ERROR_STOP=1 -v estate=<new uuid> -v lang=en -f scripts/fixtures/launch-estate.sql`
   — never from an estate a walk has already written into.
6. On the site: `fabric/release.json` (tag, asset URL, SHA-256), the screenshots, the brand facts row, then
   PR → `main` → `npm run deploy`, and the live receipt ([site handoff](https://github.com/passioncode-ai/passioncode-ai.github.io/blob/main/docs/HANDOFF.md)).
   The Worker serves `/fabric/download/macos` as a no-store, noindex redirect to the asset.

**0.2.0, 2026-09-29:** receipt [`docs/releases/fabric-0.2.0-mac.json`](../releases/fabric-0.2.0-mac.json)
(commit `f356999`, SHA-256 `ae04aabd…9ae6`, DMG notarization Accepted); packaged smoke PASS; published as
[`fabric-v0.2.0`](https://github.com/passioncode-ai/passioncode-ai.github.io/releases/tag/fabric-v0.2.0) and
offered on [passioncode.ai/fabric](https://passioncode.ai/fabric/#download) (site PRs #7 and #8, Worker version
`3726c08e-4a39-4d3b-8678-2edcb58c3716`).

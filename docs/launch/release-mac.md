# Releasing Fabric for macOS

The release is one universal DMG for Apple silicon and Intel Macs (from 0.3.4; Apple silicon only before): Developer ID signed, hardened runtime, notarized and
stapled — the app inside and the DMG itself. **It is built and signed only in CI**, by
[`.github/workflows/release.yml`](../../.github/workflows/release.yml) in this repository's protected
`release` environment ([ADR-0111](../adr/0111-fabric-is-released-from-ci.md); the organization's
[release signing](https://github.com/passioncode-ai/.github/blob/main/release-signing/README.md)). The
workflow runs [`scripts/release-mac.mjs`](../../scripts/release-mac.mjs) with
[`apps/desktop/electron-builder.release.yml`](../../apps/desktop/electron-builder.release.yml), which extends
the local packaging config; `pnpm --dir apps/desktop package` keeps building the unsigned folder.

## What the installed app needs

- **macOS on Apple silicon or Intel.** From 0.3.4 the build is universal (`arm64` and `x86_64`; up to 0.3.3, `arm64`
  only). Electron 44.0.0's npm darwin-x64 build was measured under Rosetta and admitted as a runtime; the packaged app's
  framework is joined and re-signed, so neither architecture of the shipped app matches a measured tuple, as the arm64
  one never did (N1; nothing in the app reads the tuple yet). The coding-agent
  sign-in readers know the x64 builds of Claude Code 2.1.289 and Codex 0.160.0 (those exact builds; any other build
  is reported as unverified)
  ([receipt](harness-r0/checks.md#intel-x86_64-runtimes--2026-10-09)).
- **Windows and Linux, from 0.3.5** (CO-238): a per-user NSIS installer for Windows x64 and arm64, an AppImage and a
  `.deb` for Linux x64 and arm64, published on [GitHub Releases](https://github.com/passioncode-ai/fabric/releases)
  beside the DMG (the website offers macOS only until its own change, step 9). The local stack needs Docker Desktop
  (Windows, WSL2) or Docker Engine (Linux) and the Supabase CLI there too; the data folders and the rest are in
  `AGENTS.md`, *Lifecycle*, *On Windows and Linux*. Not read there yet: a coding agent's sign-in (CO-244); not
  available on Windows: a product's secret through Project Observatory's vault (CO-245).
- **Docker** (Docker Desktop or OrbStack) running, and the **Supabase CLI** (`brew install supabase/tap/supabase`).
  The app ships its stack project (`config.toml`, `seed.sql`, the migrations) in `Contents/Resources/stack`
  and keeps a working copy in `~/Library/Application Support/@fabric/desktop/stack`
  ([`bundledStack.ts`](../../apps/desktop/src/main/bundledStack.ts)); on first start `supabase start` creates
  the database and applies every migration. It needs no checkout of this repository. When Docker or the CLI is
  missing, the startup dialog names which ([`startupFailure.ts`](../../apps/desktop/src/shared/startupFailure.ts)).
- **Schema upgrades are not automatic.** A newer build whose schema is ahead of an existing database stops
  with the exact command to run in that stack folder; Fabric never migrates a database on its own.

## Universal macOS

From 0.3.4 the release is one universal app (Apple silicon and Intel). electron-builder packs an
x64 and an arm64 app and joins them; node-pty keeps each architecture in its own
`prebuilds/darwin-<arch>/` folder, so `scripts/after-pack-universal.mjs` replaces both with one
universal file (`scripts/lib/universal-mac.mjs`), the `files` filter in `electron-builder.yml`
keeps Windows and Linux prebuilds out, and the joined app — and the release receipt's
`checks.universal` — is refused while any Mach-O lacks a slice. Tested by
`scripts/test/universal-mac.test.mjs`. Runtime admission (`apps/desktop/src/main/runtimeAdmission.ts`)
and executor sign-in readers (`executorAuth.ts`) are measured per architecture; an x86_64 tuple is
added only after their suites pass on it.

## How a release is made

A **`vX.Y.Z` tag on main** launches a release. Nothing else does: no laptop holds the release key, and a
build signed anywhere but the `release` environment is a debug build that is never published.

1. **Land, then release.** The release pull request lands on `main` first: `version` in
   [`apps/desktop/package.json`](../../apps/desktop/package.json) is `X.Y.Z`, the `## X.Y.Z (unreleased)` (or `## Unreleased`) section of
   [`CHANGELOG.md`](../../CHANGELOG.md) is renamed `## X.Y.Z` **and finalized** (it becomes the release notes:
   no "(unreleased)" heading for the version may remain, and the section may not say it is not released yet —
   preflight refuses both, `scripts/lib/release-mac.mjs#changelogProblem`), and `bash scripts/ci.sh fast` is green.
   **The release gate.** [`docs/launch/release-gate.json`](release-gate.json) names the version and the
   verification ledger that clears it ([general plan](../evidence/backlog.md#general-development-plan),
   P-02). The script refuses a tree with any file flagged skip-worktree or assume-unchanged, takes the
   version from the commit, and reads both files from the commit; it refuses unless the ledger has exactly one section per
   iteration (three), each linking its reviewer reports, every finding row disposed (fixed, ruled, not a
   defect, not recoverable, stopped), and each ending with its one line
   `Exit for iteration N: … Blocking findings open: none.`, and unless the ledger's title names exactly the
   version it clears — each release has its own ledger; 0.3.0's is
   [`2026-10-03-verification.md`](../evidence/plans/2026-10-03-verification.md), 0.3.1's (the hub) is
   [`2026-10-04-hub-verification.md`](../evidence/plans/2026-10-04-hub-verification.md), 0.3.2's is [`2026-10-06-release-032-verification.md`](../evidence/plans/2026-10-06-release-032-verification.md), 0.3.3's is [`2026-10-08-release-033-verification.md`](../evidence/plans/2026-10-08-release-033-verification.md), 0.3.4's is [`2026-10-10-release-034-verification.md`](../evidence/plans/2026-10-10-release-034-verification.md), 0.3.5's is [`2026-10-12-release-035-verification.md`](../evidence/plans/2026-10-12-release-035-verification.md), and each release's version bump points the gate at its own
   ledger (`scripts/lib/release-gate.mjs`, tested by
   `scripts/test/release-gate.test.mjs`).
   Preflight also requires exactly one nonempty finalized `## X.Y.Z` changelog entry.
   The gate names `verifiedCommit`, a full commit SHA reviewed by the final iteration. It must
   be an ancestor of the release commit. After it, only named release metadata and the desktop
   package version may change; runtime/build/dependency changes require a new verified candidate.
   The package comparison rejects changes beyond `version`. Checked by
   `scripts/lib/release-mac.mjs#verifiedCandidateProblem` and release-input regression tests.
   The current historical 0.3.0 gate has no candidate pin; it is not permission to rerelease 0.3.0.
   **Review receipts.** The gate also carries `reviewReceipts` (schema `fabric-release-reviews/1`): three
   iterations, each naming its exact `candidateCommit` and five reviews, one per level (`ux`, `errors`, `docs`,
   `data`, `plan`). Each review names a report (`.md`) and a receipt (`.json`) anywhere under `docs/`, committed in the
   release commit; reports and receipts **added after `verifiedCommit`** must sit under `docs/reports/` or
   `docs/evidence/reviews/`. A receipt names the schema, version, iteration,
   level, report path and candidate, the report's SHA-256, a `reviewerRun` used nowhere else, `status: closed`, an
   empty `blockingFindingsOpen` and every finding with a disposition and evidence. The three candidates are distinct
   commits that exist in this repository, each an ancestor of `verifiedCommit` and none before an earlier one in
   history (from 0.3.12; before it each had to be an ancestor of the next); iteration 3's equals `verifiedCommit`; and
   each ledger section names its candidate in full (`scripts/lib/release-gate.mjs`, the history checks in
   `scripts/lib/release-mac.mjs#verifiedCandidateProblem`). Reports written for iterations 1 and 2 before this
   packet existed are committed as their reports and receipts for their own candidates. Reviewer independence is
   not machine-checkable: the gate only refuses a reused `reviewerRun`.
   After `verifiedCommit` only these may change: `CHANGELOG.md`, `docs/launch/release-gate.json`, the ledger,
   `docs/MERGES.md`, `docs/reports/map.html`, the declared review reports and receipts, the Markdown documents
   under `docs/handoffs/` or `docs/reports/` that the gate lists in `releaseMetadata`, and the desktop package
   `version`. The scheduled workspace publication may also land between the two: a new `workspace` submodule
   pin with its `docs/workspace-receipt.json` passes only in that exact shape — the path still a gitlink, the
   receipt schema 1 and naming the pinned commit (CO-208, `publicationPinProblem`). Anything else under those
   names is refused like any other change.
2. **Push the tag** on the release commit: `git tag -a vX.Y.Z <commit on main> -m "Fabric X.Y.Z" && git push origin vX.Y.Z`.
   A published release is never rewritten; a fix is a new tag.
3. **`preflight`** runs without secrets: `node scripts/release-mac.mjs --check-only --tag vX.Y.Z` refuses
   unless the commit is on `origin/main` (its tip, or a tag on main that main has moved past — ancestry,
   not equality), the tag names the version the commit carries, and the release gate is clear.
4. **Approval by checks** ([ADR-0145](../adr/0145-fabric-releases-are-approved-by-checks-and-pushing-the-tag-is-the-decision.md)).
   The `guard` job (`passioncode-ai/.github/actions/release-guard@v1`) passes the tag only when `main` contains the
   tagged commit and `ci.yml` passed on that commit — with no run it starts one on the tag and waits; otherwise it
   refuses with the reason and the run's link. Every job that holds the `release` environment — `macos`,
   `windows`, `linux` — needs it, and `publish` needs those (`scripts/test/release-mac.test.mjs` checks the first);
   the environment has no reviewers and admins cannot bypass it. Pushing the tag (step 2) is the release decision: only team
   `release-approvers` may push a `v*` tag (ruleset `release-tags`).
5. **`macos`** builds on `macos-latest`: `passioncode-ai/.github/actions/apple-signing@v1` makes a throwaway
   keychain with the CI Developer ID and names it; `release-mac.mjs --tag vX.Y.Z` gets that identity in
   `FABRIC_SIGN_IDENTITY` and the keychain in `CSC_KEYCHAIN`, and the App Store Connect key as the
   secrets `ASC_*` (written to a mode-600 temporary file, never printed or put in argv). electron-builder
   signs the app, notarizes and staples it, and builds and signs the DMG; the script notarizes and staples
   the DMG. It fails unless the app's Electron fuses, read back from the built binary, are the ones
   `apps/desktop/electron-builder.yml` declares (`scripts/lib/release-mac.mjs#RELEASE_FUSES`: run-as-Node on for
   the helpers; `NODE_OPTIONS`, `--inspect` and loading an app from outside the asar off; asar integrity on), the
   app's own `bin/fabric-mcp` answers as an MCP server (the check of step 7, made on the built bundle before its
   signature is verified), `codesign --verify --deep --strict` passes on the app and the signer read back
   from it is a Developer ID Application with the hardened runtime, Gatekeeper accepts the app and the DMG,
   and the stapled tickets of both validate. The DMG and its receipt `fabric-X.Y.Z-mac.json` (size,
   SHA-256, notarization id, signer, team, the checks, the CI run) are uploaded as `release-macos`; the
   keychain is deleted on every path.
6. **`windows` and `linux`, then `publish`.** `windows` and `linux` build natively on their runners (x64 and arm64 each)
   and upload the installers with their receipts. `windows` installs the NSIS build, starts it once in SMOKE mode with
   `--mcp` (the packaged `fabric-mcp` check above) and uninstalls it; `linux` installs the `.deb` and starts it the same
   way — the AppImage is built and published, not started. Windows signs through Azure Artifact Signing when the release environment's
   `AZURE_SIGNING_ENABLED` is `true` (passioncode-ai/.github `release-signing/products.json`); otherwise the
   receipt says `windows_authenticode: NOT_SIGNED` and the job refuses release notes that do not say so
   (`.github/workflows/release.yml`, the windows job's notes check). Linux packages are not code-signed; the
   published `SHA256SUMS` is GPG-signed and every file is attested.
   **`publish`** (it holds the GPG key) runs once `macos`, `windows` and `linux` have passed, then attests every file (Sigstore),
   writes `SHA256SUMS` and `SHA256SUMS.asc`, and publishes the release **in this repository**, marked a
   prerelease while Fabric is an early preview (`prerelease: "true"`, ADR-0111 §1):
   `https://github.com/passioncode-ai/fabric/releases/tag/vX.Y.Z`. Verify a download with
   `gpg --verify SHA256SUMS.asc SHA256SUMS`, `shasum -a 256 -c SHA256SUMS --ignore-missing` and
   `gh attestation verify Fabric-X.Y.Z-universal.dmg --owner passioncode-ai --signer-repo passioncode-ai/.github` —
   the attestation is signed by the organization's shared publish workflow, so `-R passioncode-ai/fabric` alone
   fails ("verifying with issuer sigstore.dev"; the shared workflow's own note, measured 2026-10-03).
7. Smoke the published DMG on this Mac: install it, then `FABRIC_APP_EXECUTABLE=/Applications/Fabric.app/Contents/MacOS/Fabric
   FABRIC_PLAYWRIGHT_MODULE=<playwright> node apps/desktop/test/chat-activation-native.test.mjs` — the packaged
   app starts from its own stack, the window is named Fabric, the chat saves and survives a cold restart. The probe
   starts the binary with `--remote-debugging-port=0` and drives the window over `chromium.connectOverCDP`
   (`apps/desktop/test/helpers/app-launch.mjs`): Playwright's `_electron.launch` waits for `--inspect`, which the
   fused binary ignores (`enableNodeCliInspectArguments: false`), so it can no longer start a release build.
   **The helpers and the MCP entry, from the bundle.** The fuses decide whether the binary still runs as Node on an
   entry inside `app.asar`, so this is checked on the artifact, never on the sources:
   - `node scripts/smoke-platform.mjs --exe /Applications/Fabric.app/Contents/MacOS/Fabric --mcp-only` runs the
     install's `Contents/Resources/bin/fabric-mcp --runner claude-code` (ADR-0134) with a throwaway home, so no hub is
     found, sends `initialize` and `tools/list`, and passes only when it answers with server `fabric` and exactly its
     waiting tool `fabric_whoami`, prints nothing on stdout but JSON-RPC, and exits 0 when its stdin ends
     (`scripts/lib/smoke-platform.mjs#packagedMcpCheck`). `--mcp-only` starts nothing else, so the Mac's live stack is
     not touched. The same check runs in step 5 (`scripts/release-mac.mjs` refuses the build) and, with `--mcp`, after
     the SMOKE start of the Windows and Linux installs (`.github/workflows/release.yml`, `platforms.yml`), where its
     verdict lands in the receipt as `checks['fabric-mcp']`.
   - `FABRIC_APP_EXECUTABLE=… node --test apps/desktop/test/packaged-helpers.test.mjs` runs the same check, then the
     stdio MCP bridge (`app.asar/out/main/mcp-bridge.js`) against a bearer-checking fixture surface and the ACP shell
     (`acp-shell.js`) against a fixture agent, including its reaper (`<binary> -e`, Node mode), which must end the
     agent when the shell is SIGKILLed. No stack, window or hub is involved.

   A release
   whose verification ledger names more release-close checks lists them in its own *Release close* section (0.3.3:
   the first-run boot on the operator's database, CO-228; the roadmap PR before the tag, CO-196).
8. Take the site's screenshots from the packaged app on a **fresh English demo estate** —
   `psql "$DB_URL" -v ON_ERROR_STOP=1 -v estate=<new uuid> -v lang=en -f scripts/fixtures/launch-estate.sql`
   — never from an estate a walk has already written into.
9. **The website is the website's change.** `passioncode-ai/passioncode-ai.github.io` picks Fabric's build by
   itself: its always-current resolver (site `docs/DEPLOYMENT.md#always-current-versions`, roadmap RM-15) offers
   the newest release that carries every asset its policy `releases/products.json` names, and a release without it
   is skipped. Read 2026-10-10: `fabric.assets.macos` is `Fabric-{version}-arm64.dmg`, and
   `/fabric/download/macos` redirected to `v0.3.3/Fabric-0.3.3-arm64.dmg` (the site followed 0.3.3 on its own,
   site commit `d19bd337`). **From 0.3.4 the release carries `Fabric-X.Y.Z-universal.dmg` only**, so the site's own
   pull request changes that pattern to `Fabric-{version}-universal.dmg` — merged once `vX.Y.Z` is published, since
   before that no release carries the new name — together with the page's platform copy (Apple silicon and
   Intel), the screenshots and the brand facts row; then `npm run deploy` and the live receipt
   ([site handoff](https://github.com/passioncode-ai/passioncode-ai.github.io/blob/main/docs/HANDOFF.md)). The
   receipt is the live redirect: `curl -sI https://passioncode.ai/fabric/download/macos` names
   `vX.Y.Z/Fabric-X.Y.Z-universal.dmg`. Download the asset anonymously and check its SHA-256 and
   `spctl -a -t open --context context:primary-signature` before pointing anything at it. This repository does not
   write to the website.
   **Windows and Linux (from 0.3.5):** the site offers them since its commit `e9d39ef` (SITE-046, 2026-10-15):
   `https://passioncode.ai/fabric/download/windows-x64`, `/linux-x64-deb` and `/linux-x64-appimage` each answered 302
   to the v0.3.12 asset on GitHub on 2026-10-26 (CO-269). Check the three after a release as the Mac one is checked.
10. **Publish and pin the workspace from the release commit.** After the tag, from a clean `main`:
    `node scripts/workspace.mjs publish`, then `node scripts/workspace.mjs check --require-child`; record the
    source commit, the workspace digest and the parent pin together in the release's verification ledger
    ([publication contract](../architecture/report-workspace.md)). A hosted identity readback is a separate
    acceptance. Done for 0.3.4: `check --require-child` PASS at source `22807eb7`, workspace `d132bb1f`
    (0.3.4 ledger, *Release close — state on 2026-10-10*). This step was CO-197's recurring item until 2026-10-11.
11. **Keep the knowledge base current.** In `fabric-workspace` (`workspace/knowledge/`): Fabric's row and the
    released column of the roadmap, `products.md` and `plans.md`, and every RM track the release served — by a
    fabric-workspace pull request merged **before the tag** when the roadmap names the release as coming, and
    after publication for the released column. A dated checkpoint in those pages stays as it is. Done for
    0.3.4: fabric-workspace PR #92 (`8639492c`) before the tag, the pages after publication (0.3.4 ledger
    *Release close* item 5). This step was CO-196's recurring item until 2026-10-11.

### Rehearsal

Push `vX.Y.Z-rc.N` on a commit of main (the push trigger ignores `-rc` tags; never reuse or move a tag),
then `gh workflow run release.yml --ref vX.Y.Z-rc.N -f publish=false`. Every job runs behind the same `guard`
as a release (no reviewers, nothing to approve); the signed, attested and summed set is kept as the workflow artifact
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
an existing database automatically. **0.3.3 adds no migration**: like 0.3.2 it admits schema 79, so a 0.3.2
database needs nothing, and a 0.3.0 or 0.3.1 database takes this same procedure. **0.3.4 adds none either** (79). It
changes the seed a new database gets, and at start it grants the local operator a default estate only the old seed
has touched — its creation, and at most an agent's access request written while a start was failing — which is the
database every fresh install since 0.2.0 made and then refused
([ADR-0131](../adr/0131-a-database-only-the-old-seed-has-touched-is-given-to-the-local-operator.md)). A database
anyone has used is not changed by it. That repair runs only past the schema check: a database a 0.3.2 or 0.3.3
install made (79) is repaired on 0.3.4's first start; one a 0.3.0 or 0.3.1 install made (75, 78), or a 0.2.0 one
(69), is refused for its schema first and is repaired once this procedure has taken it to 79 (measured for 0.3.0 by
the 0.3.4 verification, iteration 1, UX-2). **The shorter way, only if Fabric never opened a window on that Mac**:
such a database holds nothing, so it may be discarded instead of upgraded — quit Fabric, then
`cd "$HOME/Library/Application Support/@fabric/desktop/stack" && supabase stop --no-backup`, which removes the
bundled stack's containers and volumes; the next start makes a new database with 0.3.4's seed. Never do this to a
database Fabric has opened: there is no undo. Below, `X.Y.Z` is the version
you install (0.3.2 or later). The 0.3.2 compiled contract admits schema **79** (the number of applied
migration files); the newest migration's filename ends in **81** because other work reserved filenames. Do not
use `max(version)` or a filename suffix as schema readiness. The actual guard is `public.schema_version()`
against [the compiled schema contract](../../apps/desktop/src/shared/schemaContract.json). 0.3.2's one new
migration is `20261005000081_project_board.sql`, the project board's core (ADR-0117, COM-02.1): an installed
0.3.1 database is at **78** and an installed 0.3.0 database at **75**; 0.3.2 refuses either until this procedure
has run. It is the same procedure from either: `supabase migration up` applies every missing migration in
order, so a 0.3.0 database goes **75 → 79 in one step** (migrations 76, 77, the file with suffix 80, then 81 —
the order a fresh install applies them), with no 0.3.1 in between. Once a database is at 79 only 0.3.2 or later
opens it. Read your schema first (step 2) and use that number wherever `FROM` appears below.

**0.3.5 admits schema 84** — five migrations past 0.3.4's 79, applied in order:
`20261011000082_write_rules_at_the_door.sql` moves the hub's write rules out of replay (CO-201) and registers the
refusal summary (CO-200); `20261011000090_session_enrollment.sql` registers `session.enrolled@1`, the event of a coding
agent opened outside Fabric joining a project (ADR-0134); `20261011000091_grants_from_the_journal.sql` projects the floor's
`grants` (money, deletion and publication effects) from the journal; `20261011000094_project_board_operator_read.sql` lets the operator read the project board (COM-06/COM-07); `20261011000095_work_claims.sql` projects agents' claims (`work_claims`) and the backlog rows
tasks link to (`task_sources`), and registers `task.source.linked@1`, `work.handover.requested@1` and
`session.turn.observed@1` (REQ-38, REQ-08, the session hooks' D4). `schema_version()` counts applied migrations, so
79 + 5 = **84**, whatever the suffixes say. The procedure is the same with 84 in place of 79. A
database at 79 upgrades in order (82 sorts after 81), which `scripts/check-migration-order.mjs` holds for every
later migration (CO-199): no new filename may sort below the newest one recorded in `supabase/migration-ledger.json`.
At start, 0.3.5 also retires the old seed's second owner `…0002` from a database the 0.3.4 repair gave the local
operator — a revoke through the membership door (`desktop-bootstrap:seed-retire`, compare-and-set at the revision read),
never a delete, and only while that membership is still the seed's own and its person has no sign-in — and the
profile's "Running for N days" counts from the repair, not from the failed install (CO-242, `seedRepair.ts#retireSeedOwner`).
Floor grants (the short-lived grants for money, deletion and publication effects, at most an hour) written before
migration 91 (`grants_from_the_journal`) carry no project, and after the upgrade they still serve every project until
they expire or are spent (91's own note; no journal event names them, so a restore never recreates them). Nothing
revokes them; upgrade at least an hour after the last such grant, or let them expire.

**0.3.6 admits schema 89** — five migrations past 0.3.5's 84, applied in order:
`20261011000100_project_board_thread_aggregates.sql` (count 85: the Comms thread list's kinds and open requests),
`20261012000103_project_board_lifecycle.sql` (count 86: the project board's lifecycle, ADR-0149 — epochs, reply,
cancel, expiry, deliveries, the outbox, board history in the archive) and
`20261012000104_project_board_responders.sql` (count 87: the board's responders, ADR-0149 Amendment 1 — slots,
enrollments, attempts, the fence, release, the project directory) and
`20261013000107_project_board_w2_fixes.sql` (count 88: the board's wave-2 fixes, ADR-0149 Amendment 2 — functions
replaced in place, `transferred` in the replace receipt) and `20261013000108_project_board_operator_reads.sql` (count
89: the operator's reads of the board, ADR-0156 §8 — the bounded thread page, heads, message facts, the request
timeline, related threads, history search, what waits for a project, and `settledBy` on complete and reconcile
transitions). 84 + 5 = **89**, whatever the suffixes say (101/102 and 105/106 were never applied; they were the
pipeline's prose reservation, since moved to 117/118). The procedure is the same with 89 in place of 84. Migration 86 rewrites the board's stored idempotency receipts once, to the shape without
`seq`; an archive taken before it has no `board.json`, and restores with the board's texts missing. Migration 87 adds
tables and functions only and rewrites no stored row; migration 88 replaces functions only; migration 89 adds
functions and one partial index on the journal and rewrites no stored row.

**0.3.7 admits schema 94**, five migrations past 0.3.6's 89, applied in order:
`20261017000112_acts_and_reopened_answers.sql` (count 90: `act.recorded@1`, the one record of an operator act with its
inverse, and the command that takes an answer back, `reopen_answered_question`; three partial indexes on the journal,
one table constraint dropped so a reopened question can be answered again, functions and two event types; no stored
row rewritten), `20261018000113_project_repo_identity.sql` (count 91: normalized remote and repository-kind identity,
detach tombstones and their projection; it rewrites every stored `project_repos` row once to add its identity, and it
creates the estate-path unique index only when the database holds no duplicate path, raising a `WARNING` and skipping
the index otherwise, CO-341), `20261018000114_private_archive_source.sql` (count 92: schemas 91 and 92 as private-archive
sources in code and SQL), `20261019000115_run_over_attestation.sql` (count 93: the person's «Работа закончена» on a run
whose process ended, ADR-0170, and 93 as an archive source) and `20261020000116_withdrawn_answer_closes_decision.sql`
(count 94: the `memory_facts.withdrawn_seq` column and its replaced supersession check, a projector that closes the decision fact a withdrawn answer
recorded and one pass over the journal that closes decisions withdrawn at schemas 90 to 93, three journal indexes for an
agent's history read, 94 as an archive source). 89 + 5 = **94**, whatever the suffixes say (109 is the board's; 117/118 are the pipeline's prose
reservation). The procedure is the same with 94 in place of 89.

**0.3.8 admits schema 94**, as 0.3.7 does: it adds no migration, so a database already at 94 needs no upgrade step.
**0.3.9 admits schema 95** (migration `20261021000120_board_core_holds.sql`, the board's answered requests and cursor key): a database at 94 takes the upgrade below, `FROM` 94. In the first minute after it, the board answers the queued requests their target already replied to and expires the others that have no deadline of their own once their message is 7 days old, at the tick, without writing a deadline into the row (`deadline` stays null; `board_tick` reads the message's time, migration 120 §7a). On the operator's database 9 of the 10 queued requests read `answered` two minutes after the 2026-10-22 upgrade; the tenth expires at the first tick after 2026-10-28 23:19 UTC unless answered (CO-381). The migration reaches the stack folder only by step 1's first start of the 0.3.9 bundle, never by hand (step 1 says why); never run `supabase` inside the signed bundle. (Until 2026-10-26 this paragraph told a hand copy from the installed bundle's stack; 0.3.13's release review, iteration 2, DO-8, removed it.)
**0.3.10 admits schema 95**, as 0.3.9 does: it adds no migration, so a database at 95 needs no upgrade step and the upgrade is the bundle alone; going back to 0.3.9 is the 0.3.9 bundle alone. A 0.3.8 install (schema 94) going straight to 0.3.10 takes the 94 to 95 step above, with migration 120 from the installed 0.3.10 bundle (the bundle's first start copies it into the stack folder, step 1), with Fabric quit.

**0.3.11 admits schema 95**, as 0.3.9 and 0.3.10 do: it adds no migration (no file under `supabase/` changed since v0.3.10), so the upgrade is the bundle alone and going back to 0.3.10 is the 0.3.10 bundle alone. One setting is new, `agentLanguage` in `settings.json`; 0.3.10 does not know it, so going back and then changing a setting drops a switched-off working language, and the next 0.3.11 starts with it on again (the 0.3.11 review, DA-5).

**0.3.12 admits schema 96** (migration `20261023000123_project_profile.sql`, a project's profile: `project.profiled@1`, columns on `projects`, `project_relations`): a database at 95 takes the upgrade below, `FROM` 95. Going back to 0.3.11 after it refuses the database (0.3.11 admits only 95), so a rollback is the 0.3.11 bundle with the backup taken before the upgrade. Two settings are new, `machineTrust` and `boardFilters` (and, from 0.3.11, `agentLanguage`); 0.3.11 does not know the first two, so going back and changing a setting drops them: the next 0.3.12 reads the computer as not said (not trusted) and the Board's remembered filters as none. 0.3.11 keeps at most 4 096 Comms read marks and drops a longer list on its first settings write, so after a rollback a
large estate's threads read as unread again (0.3.12 keeps up to 5 000). The migration reaches the stack folder only by step 1's first start of the new build, never by hand (step 1 says why; the 0.3.12 rollout's hand copy was removed by 0.3.11's next start).

**0.3.13 admits schema 98** (migrations `20261026000124_one_schema_step.sql`, 0.3.13's one schema step, and `20261026000125_board_reader_count_held.sql`, which gives com.list's `unread` and com.status's count back their v0.3.12 answer for readers pinned before the contract's DEC-0135, CO-437): a database at 96 takes the upgrade below, `FROM` 96, migrations 124 and 125, and a database at 95 (0.3.11) takes it `FROM` 95, migrations 123, 124 and 125 in one `supabase migration up` (the operator's Mac, 2026-10-26: 0.3.12 was never rolled out there). The older builds refuse a schema-98 database (0.3.12 admits only 96, 0.3.11 only 95), so a rollback is the bundle the database came from with the backup taken before the upgrade: 0.3.12 from 96, 0.3.11 from 95. One setting is new, `trustAgentFolders`; an older build does not know it, so going back and changing a setting drops it, and the next 0.3.13 reads folder trust as on (the default). Besides functions and indexes, the migration changes rows: duplicate `project_repos` rows of one folder keep the first attached (the primary and `projects.repo_path` are recomputed) and the unique `(estate_id, path)` index migration 113 may have skipped is created (CO-341); `project_repos.kind` is set from `is_primary`; decision facts in the chain of a withdrawn answer close (CO-355); `questions.resolution_id` is filled for answered questions that lost it (CO-357); `projects.business` is replayed from the journal under the person's rule and `business_set_by` is new (CO-418); `deliveries.created_at` and `task_runs.created_at` take their event's time (CO-418). After it, `select count(*) from pg_indexes where indexname = 'project_repos_unique_estate_path'` reads 1. A database without that index may hold duplicates, and the step-3 rehearsal then reports `project_repos lost rows`: before the backup read `select count(*) from pg_indexes where indexname = 'project_repos_unique_estate_path'` and, when it reads 0, `select count(*) - count(distinct (estate_id, path)) from project_repos` (d); the rehearsal's one expected difference is then `project_repos` losing exactly d rows, and any other lost row stops the upgrade as step 3 says. A database that has the index (the operator's Mac had it at schema 94, the 0.3.8 review's data level) holds no duplicate and loses nothing (0.3.13's release review, iteration 2, DO-4; teaching the rehearsal this allowance is CO-449). A development database that applied migration 115's early bytes (between `cdc841f6` and `c6cf39e0`, CO-342) is rebuilt from a fresh stack, not upgraded; `node scripts/check-migration-order.mjs --history` refuses any later rewrite of a recorded entry.

**0.3.14 (not yet released) admits schema 98**, the same as 0.3.13: it adds no migration (`supabase/migrations/` still ends at `20261026000125_board_reader_count_held.sql`, 98 files, and `git diff --stat c05c30ef..release/0.3.14 -- supabase` prints nothing) and no setting. A database at 98 needs nothing, so upgrading from 0.3.13 is the new bundle alone and going back is the 0.3.13 bundle alone; a database at 96 or 95 takes 0.3.13's upgrade below first, then opens 0.3.14. Before installing it on a machine, update its Fabric agent adapter to 0.51.2 or later (`@passioncode-ai/fabric-agent-adapter`, FAA-142), so the session hooks print the reminders a turn's answer shows; with an older adapter the reminders still come in `fabric_work_list` and `fabric_heartbeat` (the 0.3.14 release review, iteration 1, PL-1). A session Fabric launched reports no turns with any adapter (its session hooks stay silent there), so, like Codex and Kimi, it gets its reminders only in `fabric_work_list` and `fabric_heartbeat` (iteration 2, DO-6).

1. Stop Fabric and every enrolled writer/adapter. A quiet window does not prove the database has
   no writers: inspect the registered services and database connections. Do not upgrade beneath
   another running session. Keep the installed database at its schema until a verified signed X.Y.Z
   build is available. First install that build, attempt startup once so its bundled stack is copied,
   then quit: readiness refuses old data before domain services start.
   **Nobody opens Fabric again until step 4 is done**, and the migrations come only from the new
   build's own start, never copied by hand: every start writes its bundle's migrations into the stack
   folder and removes every other one (`apps/desktop/src/main/bundledStack.ts#materializeStack`). Measured
   on the 0.3.12 rollout, 2026-10-24: migration 123 was copied by hand under 0.3.11, the person reopened
   Fabric from the Dock 11 seconds after quitting (the system log's `Dock: LAUNCH: Asking CSUI to launch 1
   items`), 0.3.11's start removed the file, and `supabase migration up` applied nothing (schema stayed 95).
   Tell the person before step 1 that the app stays closed until you say so.
   On a Mac with the lifecycle broker, hold the target before the person quits
   (`lifecycle.py hold --target-id fabric.desktop`, with the broker service stopped for the edit) and
   release it after step 4 (`hold --release`): an agent that needs the hub asks the broker to start Fabric
   (`lifecycle.ensure_running`). Measured 2026-10-26: Fabric quit at 03:57:12Z, an agent's ensure reopened it
   at 03:58:40Z (the broker's log, caller `local-agents`), and 0.3.11 started the stack again under the
   rollout.
2. Make a private backup outside the checkout before any migration. The local stack uses loopback
   database port 54322. The following commands prompt for the existing database password; never
   put it in argv or a tracked file. A prepared private mode-600 PGPASSFILE is also supported by
   PostgreSQL. Name the backup deliberately and retain the dump, existing build, stack config and
   journal event count together. Dumps contain private data; do not attach them to issues.

   The stack runs PostgreSQL 17, and `pg_dump` refuses to dump a server newer than itself: use a
   PostgreSQL 17 client, not whatever `pg_dump` is first on `PATH` (on the operator's Mac that is 14.24,
   measured 2026-10-04). Homebrew's `postgresql@17` installs one at the path below; check it first.

   ```sh
   umask 077
   PGBIN=/opt/homebrew/opt/postgresql@17/bin
   "$PGBIN/pg_dump" --version   # must print 17.x
   mkdir -p "$HOME/Library/Application Support/Fabric/backups"
   # FROM: 75 for an installed 0.3.0, 78 for 0.3.1, 79 for 0.3.2 to 0.3.4, 84 for 0.3.5, 89 for 0.3.6, 94 for 0.3.7 and 0.3.8, 95 for 0.3.9 to 0.3.11, 96 for 0.3.12 — read it, do not assume it
   PGHOST=127.0.0.1 PGPORT=54322 PGUSER=postgres PGDATABASE=postgres \
     "$PGBIN/psql" --password -v ON_ERROR_STOP=1 \
     -c 'select public.schema_version(); select count(*) from public.journal;'
   # A new name: an earlier backup (pre-0.3.1.dump) and the rehearsal receipt beside it are kept
   PGHOST=127.0.0.1 PGPORT=54322 PGUSER=postgres PGDATABASE=postgres \
     "$PGBIN/pg_dump" --password --format=custom \
     --file="$HOME/Library/Application Support/Fabric/backups/pre-X.Y.Z.dump"
   ```

   Confirm the actual local stack port before using this example; another configured stack needs
   its own connection settings. `"$PGBIN/pg_restore" --list <dump>` verifies the archive can be parsed;
   only restoring it into a disposable database proves it can be restored.
3. Rehearse the upgrade on the dump in a **separate disposable stack** (CO-198), from a Fabric source checkout
   with Docker and the Supabase CLI:

   ```sh
   FABRIC_PG_BIN=/opt/homebrew/opt/postgresql@17/bin \
     node scripts/rehearse-upgrade.mjs --from FROM --ref vX.Y.Z \
     --dump "$HOME/Library/Application Support/Fabric/backups/pre-X.Y.Z.dump"
   ```

   It starts a stack with its own project id, port block and volumes and **no** migrations (Supabase's roles,
   extensions and auth only), restores the dump's `public` schema and migration ledger, copies in the
   candidate's migrations (`--ref`: the release tag, read with `git archive`) and applies them with
   `supabase migration up --local`, the command of step 4. It compares `schema_version()` (must equal the
   candidate's admitted schema), the journal count (must not change) and every public table's row count
   (none may lose rows), writes a mode-600 receipt beside the dump (`<dump>.rehearsal.json`: numbers and the
   dump's sha256, never a row), removes the stack and exits 0 only on PASS. It never addresses `fabric` or
   ports 54321/54322. Proven on a synthetic 0.3.0-shaped dump (`--make-fixture 75`; receipt in
   [the CO-198 record](../handoffs/2026-10-05-co198-upgrade-rehearsal.md)). What it does not prove, it says in the
   receipt: open the restored estate in the app only after step 4. Exercise
   an existing estate's queries and the new authority boundaries. Restored hub requests must not
   collect old source credentials or authorize pending work. The coordinated `scripts/ci.sh full`
   uses disposable data, but its synthetic fixture is not a rehearsal of this private dump. Record
   those checks separately. Do not proceed if the backup restore or candidate rehearsal fails.
4. With writers still stopped and the verified backup retained, apply to the working bundled stack:

   ```sh
   PGBIN=/opt/homebrew/opt/postgresql@17/bin   # the PostgreSQL 17 client from step 2
   cd "$HOME/Library/Application Support/@fabric/desktop/stack"
   supabase migration up --local
   PGHOST=127.0.0.1 PGPORT=54322 PGUSER=postgres PGDATABASE=postgres \
     "$PGBIN/psql" --password -v ON_ERROR_STOP=1 \
     -c 'select public.schema_version(); select count(*) from public.journal;'
   ```

   `schema_version()` must equal the installed build's minimum/maximum (79 for 0.3.2 to 0.3.4, 84 for 0.3.5, 89 for 0.3.6, 94 for 0.3.7 and 0.3.8, 95 for 0.3.9 to 0.3.11, 96 for 0.3.12, 97 for 0.3.13).
   Compare the journal count with the backup receipt; do not accept a startup error as a successful
   migration. Start the installed build, verify the estate and a bounded task/consent workflow, then
   restart enrolled writers one by one. Record installed version/build and actual read/effect results.
5. If migration or startup acceptance fails, stop all writers again. Preserve the failed database
   and diagnostics privately, restore the tested backup into a clean compatible stack, and install
   the corresponding old signed build. The restore half is the one step 3 exercised (a stack with no
   migrations, then `pg_restore --schema public --schema supabase_migrations --single-transaction` and
   `supabase migration up --local` to the OLD build's migrations); it has not been run against the working
   stack itself, so record each command and its output as the rollback receipt. Do not run old code on a newer schema or try to reverse
   journal/projector changes with ad hoc SQL. A restored archive's history is not fresh authority;
   follow the restore boundary and reconnect/consent as required. Document the exact rollback receipt.

The schema-behind startup message names this section and the command, but is not authorization to
skip backup/rehearsal. The seeded rehearsals of each release belong to its verification ledger (0.3.1:
75 → 78 and 77 → 78; 0.3.2: 75 → 79 and 78 → 79, in the
[0.3.2 ledger](../evidence/plans/2026-10-06-release-032-verification.md)). The live private-dump rehearsal and the
live upgrade remain operator-state checks.

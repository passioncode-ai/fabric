#!/usr/bin/env node
// The build says what it is, once, at build time (S07).
//
// MEASURED BEFORE THIS EXISTED: nothing in the running application identified
// the build. `meta.info()` returned the estate and the window; no screen showed
// a version, a commit or a schema window. An operator reporting a defect could
// not say what they were running, and the card's own sentence — the installed
// 0.1.0 differs from HEAD — was unanswerable from inside the product.
//
// WRITTEN HERE AND READ AS A FILE, NEVER RE-DERIVED AT RUNTIME. A packaged app
// has no repository under it, so asking git at runtime answers about whatever
// directory it was launched from — with total confidence, about somebody else's
// work. This runs in the checkout that is being built and its output travels
// with the artifact.
//
// A DIRTY BUILD IS RECORDED, NOT REFUSED. A local build with uncommitted
// changes is a legitimate thing to make; a build that carries a commit sha
// while containing code that commit does not have is not. So the flag ships
// beside the sha and every reader shows them together.

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { verifyToolchain } from './lib/toolchain.mjs'

import {
  ARTIFACT_ABSENT,
  artifactDigest,
  buildIdOf,
  collectArtifactFiles,
  sha256
} from './lib/build-identity.mjs'

// The repository this describes is the one this SCRIPT lives in, not whatever
// directory the caller happened to be standing in. `process.cwd()` made the
// producer unusable from the packaging script, which runs inside
// `apps/desktop` — it would have read that folder as the repository root and
// answered about a tree that does not exist.
const ROOT = path.resolve(import.meta.dirname, '..')
// `path.resolve`, never `path.join`: an absolute output path handed in as an
// argument used to be GLUED onto the repository root, so a caller who named an
// exact destination got a file somewhere else entirely — under a `var/` tree
// inside the checkout — and no error said so.
const OUT = path.resolve(ROOT, process.argv[2] ?? 'apps/desktop/resources/build-manifest.json')

const git = (args) =>
  execFileSync('git', ['-c', 'core.fsmonitor=', '-c', 'core.hooksPath=/dev/null', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 8_000_000
  }).trim()

let commitSha = 'unknown'
let sourceDirty = true
try {
  commitSha = git(['rev-parse', 'HEAD'])
  // `--porcelain` lists what differs from HEAD. Anything at all makes this
  // build something no commit describes.
  sourceDirty = git(['status', '--porcelain']) !== ''
} catch {
  // Not a checkout. The manifest still generates — and it says the source is
  // dirty, because an unknown provenance is not a clean one. Failing towards
  // "this cannot be trusted as a release" is the safe direction.
}

const pkg = JSON.parse(readFileSync(path.join(ROOT, 'apps/desktop/package.json'), 'utf8'))

let lockfileSha256 = 'absent'
try {
  lockfileSha256 = sha256(readFileSync(path.join(ROOT, 'pnpm-lock.yaml')))
} catch {
  // No lockfile: recorded as absent rather than as a digest of nothing, so a
  // reader cannot compare two builds and find them equal for want of one.
}

// The startup guard and producer consume one compatibility declaration. A
// migration count is an inventory, not evidence that ten older schemas work.
const migrations = readdirSync(path.join(ROOT, 'supabase/migrations'))
  .filter((f) => f.endsWith('.sql'))
const schemaContract = JSON.parse(readFileSync(path.join(ROOT, 'apps/desktop/src/shared/schemaContract.json'), 'utf8'))
if (schemaContract?.schema !== 'FabricSchemaContract@1' || Object.keys(schemaContract).sort().join(',') !== 'maximum,minimum,schema' ||
  !Number.isSafeInteger(schemaContract.minimum) || !Number.isSafeInteger(schemaContract.maximum) ||
  schemaContract.minimum < 1 || schemaContract.minimum > schemaContract.maximum || schemaContract.maximum !== migrations.length) {
  throw new Error('Schema compatibility contract is invalid or differs from shipped migrations; qualify the new schema explicitly')
}
const schemaMin = schemaContract.minimum
const schemaMax = schemaContract.maximum

const toolchainVerification = verifyToolchain(ROOT)
const toolchainDigest = toolchainVerification.digest
if (process.env.FABRIC_REQUIRE_TOOLCHAIN === '1' && toolchainVerification.status !== 'verified') {
  console.error(`toolchain: ${toolchainVerification.reasons.join(', ')}`)
  process.exit(1)
}

// The files that make up the artifact, and whether there IS one.
//
// This runs AFTER the build in `ci.sh`, so an empty list here means the bundle
// genuinely was not produced — not that the manifest was written too early.
// Before FA-01 the producer ran at step 5 and the build at step 20, so every
// manifest described the PREVIOUS build's `out/` or nothing at all, and both
// looked like a successful measurement.
const ARTIFACT_DIR = path.join(ROOT, 'apps/desktop/out')
const files = collectArtifactFiles(ARTIFACT_DIR)
const digest = artifactDigest(files)

const manifest = {
  // @2, not @1: `artifactDigest` is REQUIRED, and a reader that accepted a
  // manifest without it would be accepting an identity that cannot separate two
  // different bundles. An older manifest is refused by schema rather than read
  // around — which is the whole reason the field is in the schema string.
  schema: 'BuildManifest@2',
  // Content, not arithmetic about content. The formula lives in one file that
  // the release gate imports too, so the two can never drift into agreeing
  // about a build neither of them describes.
  buildId: buildIdOf({ commitSha, sourceDirty, lockfileSha256, artifactDigest: digest }),
  artifactDigest: digest,
  commitSha,
  sourceDirty,
  builtAtUtc: new Date().toISOString(),
  appVersion: pkg.version,
  lockfileSha256,
  schemaMin,
  schemaMax,
  journalReadVersions: [1],
  adapterContractRevision: 'fac-0.1.0',
  toolchainDigest,
  toolchainVerification,
  files: files.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
}

// The producer creates the directory it writes into. `apps/desktop/resources`
// is generated and git-ignored, so on every fresh checkout it does not exist —
// and this script used to exit 1 with ENOENT there, failing CI BEFORE the build
// it was meant to describe. Making the output directory is the producer's job,
// not a precondition it silently assumes somebody else met.
mkdirSync(path.dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(manifest, null, 2) + '\n')
console.log(
  `manifest: ${manifest.appVersion} ${commitSha.slice(0, 7)}${sourceDirty ? '+dirty' : ''} · ` +
    `schema ${schemaMin}–${schemaMax} · ` +
    `${digest === ARTIFACT_ABSENT ? 'NO bundle, so this manifest identifies source only' : `${files.length} file(s), artifact ${digest.slice(0, 12)}`} · ` +
    `${toolchainDigest ? 'host toolchain versions verified; reproducibility not established' : `toolchain UNVERIFIED (${toolchainVerification.reasons.join(', ')}); reproducibility not established`}`
)

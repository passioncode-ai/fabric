// Which build is this, and is it allowed to touch this database (S07).
//
// MEASURED AT HEAD, and it is the whole reason this file exists: NOTHING in
// the running application says which build it is. `meta.info()` returns the
// estate and the window and nothing else; no screen shows a version, a commit
// or a schema window. The card's own sentence — "установленная 0.1.0
// отличается от HEAD" — is unanswerable from inside the product, so an operator
// reporting a defect cannot say what they were running and nobody can ask.
//
// THE IDENTITY COMES FROM THE ARTIFACT, NEVER FROM GIT AT RUNTIME. This is the
// card's sharpest invariant and it is not a style choice:
//
//   a packaged app has no repository under it, so `git rev-parse` answers about
//   whatever directory it was launched from — the operator's home, or a project
//   they happen to be sitting in. It would report a commit with total
//   confidence and that commit would be a fact about somebody else's work.
//
//   a dev run DOES have a repository, and it is a moving one. The answer would
//   change between the build and the question, which makes it a reading of now
//   rather than of what is running.
//
// So the manifest is written once, at build time, and read back as a file. When
// there is no manifest the answer is `null` and the surface says "this build
// does not identify itself" — which is true and useful — rather than a commit
// nobody can trust.
//
// AND A SCHEMA WINDOW IS A REFUSAL, NOT A HINT. An unknown schema does not
// migrate itself: the app declares the range it was built against, and outside
// it this build refuses to start its workspace services. `unknown` is kept as its
// own answer because a manifest that cannot be read and a database that cannot
// be read are different failures and only one of them is about the build.

// @2 since FA-01. @1's `buildId` was a digest of the file COUNT, so two bundles
// with the same number of files and different code inside them shared an
// identity. That is not a weaker field to read around — it is an identity that
// cannot do the one thing identity is for, so the schema string moved and every
// @1 manifest is refused by name.
export const MANIFEST_SCHEMA = 'BuildManifest@2'

export interface ManifestFile {
  relativePath: string
  sha256: string
  sizeBytes: number
}

export interface ToolchainVerification {
  scope: 'desktop-bundle-and-packager-versions'
  status: 'verified' | 'unverified'
  profile: string | null
  digest: string | null
  reasons: string[]
}

export interface BuildManifest {
  schema: typeof MANIFEST_SCHEMA
  buildId: string
  commitSha: string
  /**
   * Whether the checkout had uncommitted changes when this was built.
   *
   * NOT omitted when true and NOT a build failure: an unsigned local build is a
   * legitimate thing to make and to inspect. What is illegitimate is a build
   * that carries a commit sha while containing code that commit does not have —
   * so the flag travels with the sha and every reader shows them together.
   */
  sourceDirty: boolean
  builtAtUtc: string
  appVersion: string
  /** The dependency tree this was built against, as one digest. */
  lockfileSha256: string
  /**
   * One digest over every file the artifact contains, paths included.
   *
   * REQUIRED, and it is what makes `sameBuild` mean anything: source and
   * dependencies do not determine a bundle, because `out/` is git-ignored and a
   * rebuilt byte leaves the tree clean and the commit unchanged. Without this
   * field two different pieces of software answer "is what is installed what we
   * released" with yes.
   *
   * The producer writes the word `absent` when there is no bundle. It is
   * deliberately NOT a digest — see `sameBuild`, which refuses anything that is
   * not a measurement rather than comparing sentinels.
   */
  artifactDigest: string
  /** The schema range this build knows how to speak. Inclusive. */
  schemaMin: number
  schemaMax: number
  /** The versions of the journal this build can READ. Separate from the schema
   *  window: reading an older event is not the same as running on an older
   *  database. */
  journalReadVersions: number[]
  /** The agent contract this build promises outward. */
  adapterContractRevision: string
  /** What produced it — the toolchain pin, when there is one. Null says there
   *  is not, rather than implying a reproducible build. */
  toolchainDigest: string | null
  toolchainVerification?: ToolchainVerification
  files: ManifestFile[]
}

/** Every reason a manifest can fail to be an answer. */
export type ManifestReadFailure =
  /** No manifest file. A dev run, or a build that predates this. */
  | 'absent'
  /** There is a file and it is not a manifest we understand. */
  | 'unreadable'
  /** It is a manifest of a schema this build does not know. */
  | 'wrong_schema'

export type ManifestRead =
  | { ok: true; manifest: BuildManifest }
  | { ok: false; why: ManifestReadFailure; says: string }

const REQUIRED: (keyof BuildManifest)[] = [
  'schema',
  'buildId',
  'commitSha',
  // `sourceDirty` is deliberately NOT here: it has its own check below, so an
  // absent one and a non-boolean one get the sentence that says why the field
  // matters rather than a generic "missing".
  'builtAtUtc',
  'appVersion',
  'lockfileSha256',
  'artifactDigest',
  'schemaMin',
  'schemaMax',
  'journalReadVersions',
  'adapterContractRevision',
  'files'
]

/**
 * Read a manifest out of whatever the artifact carried.
 *
 * Deliberately strict: a manifest missing a field is `unreadable`, not a
 * manifest with a hole in it. A partially-trusted identity is the shape that
 * lets a build claim a commit while omitting the flag that says the source was
 * dirty.
 */
export function readManifest(raw: unknown): ManifestRead {
  if (raw === null || raw === undefined)
    return {
      ok: false,
      why: 'absent',
      says: 'this build carries no manifest, so it cannot say which source it came from'
    }
  if (typeof raw !== 'object')
    return { ok: false, why: 'unreadable', says: 'the manifest is not an object' }

  const m = raw as Record<string, unknown>
  if (m.schema !== MANIFEST_SCHEMA)
    return {
      ok: false,
      why: 'wrong_schema',
      says: `the manifest says ${String(m.schema)}, and this build reads ${MANIFEST_SCHEMA}`
    }
  if (typeof m.sourceDirty !== 'boolean')
    return {
      ok: false,
      why: 'unreadable',
      says: 'the manifest does not say whether the source was clean, and a commit sha without that is a claim about code this build may not contain'
    }
  const missing = REQUIRED.filter((k) => m[k] === undefined || m[k] === null)
  if (missing.length)
    return {
      ok: false,
      why: 'unreadable',
      says: `the manifest is missing ${missing.join(', ')} — a partial identity is not one`
    }
  if (!validSchemaRange(m) ||
      !['buildId', 'commitSha', 'builtAtUtc', 'appVersion', 'lockfileSha256', 'artifactDigest', 'adapterContractRevision']
        .every(k => typeof m[k] === 'string' && (m[k] as string).length > 0) ||
      !Array.isArray(m.journalReadVersions) || !m.journalReadVersions.length || !m.journalReadVersions.every(positiveInteger) ||
      !Array.isArray(m.files) || !m.files.every(f => f && typeof f === 'object' &&
        typeof f.relativePath === 'string' && typeof f.sha256 === 'string' &&
        Number.isSafeInteger(f.sizeBytes) && f.sizeBytes >= 0) ||
      (m.toolchainDigest != null && typeof m.toolchainDigest !== 'string'))
    return { ok: false, why: 'unreadable', says: 'the manifest contains invalid fields or schema bounds' }
  if (m.toolchainVerification !== undefined && !validToolchainVerification(m.toolchainVerification, m.toolchainDigest))
    return { ok: false, why: 'unreadable', says: 'the manifest contains an invalid toolchain verification receipt' }
  return { ok: true, manifest: raw as BuildManifest }
}

const positiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0

const validSchemaRange = (m: { schemaMin?: unknown; schemaMax?: unknown }): boolean =>
  positiveInteger(m.schemaMin) && positiveInteger(m.schemaMax) && m.schemaMin <= m.schemaMax

function validToolchainVerification(value: unknown, digest: unknown): value is ToolchainVerification {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const v = value as Record<string, unknown>
  if (Object.keys(v).sort().join(',') !== 'digest,profile,reasons,scope,status' ||
      v.scope !== 'desktop-bundle-and-packager-versions' ||
      !Array.isArray(v.reasons) || !v.reasons.every(r => typeof r === 'string' && r.length > 0) ||
      !(v.profile === null || (typeof v.profile === 'string' && v.profile.length > 0)) || v.digest !== digest) return false
  if (v.status === 'verified')
    return typeof v.profile === 'string' && typeof v.digest === 'string' && /^[0-9a-f]{64}$/.test(v.digest) && !v.reasons.length
  return v.status === 'unverified' && v.digest === null && v.reasons.length > 0
}

// ————————————————————————————————————————————————————————— may it run at all

export type Compatibility = 'compatible' | 'read_only' | 'incompatible' | 'unknown'

export interface CompatibilityVerdict {
  compatibility: Compatibility
  /** A code a support conversation can quote, beside a sentence a person can
   *  read. Both, because one of them travels in a screenshot. */
  reasonCode:
    | 'in_window'
    | 'database_ahead'
    | 'database_behind'
    | 'no_manifest'
    | 'manifest_unreadable'
    | 'schema_unreadable'
  says: string
}

/**
 * May this build work against this database?
 *
 * A newer schema is refused: this build has no verified forward-compatible
 * read model. The retained `read_only` type is a legacy DTO value, not a claim
 * that current startup provides that mode.
 *
 * `unknown` is kept as its own answer. A manifest that will not read and a
 * database whose version will not read are different failures — the first is
 * about this build and the second about that estate — and collapsing them into
 * `incompatible` sends the operator to reinstall over a database outage.
 */
export function compatibilityOf(input: {
  manifest: BuildManifest | null
  /** The schema version the database reports, or null when it could not be
   *  read — which is not version zero. */
  runtimeSchema: number | null
}): CompatibilityVerdict {
  if (!input.manifest)
    return {
      compatibility: 'unknown',
      reasonCode: 'no_manifest',
      says: 'this build does not identify itself, so whether it matches this estate cannot be decided'
    }
  if (!validSchemaRange(input.manifest))
    return { compatibility: 'unknown', reasonCode: 'manifest_unreadable', says: 'the build manifest has invalid schema bounds' }
  if (!positiveInteger(input.runtimeSchema))
    return {
      compatibility: 'unknown',
      reasonCode: 'schema_unreadable',
      says: 'the estate did not report its schema version, which is not the same as it being out of date'
    }
  const { schemaMin, schemaMax } = input.manifest
  if (input.runtimeSchema > schemaMax)
    return {
      compatibility: 'incompatible',
      reasonCode: 'database_ahead',
      says: `this estate is at schema ${input.runtimeSchema} and this build knows up to ${schemaMax}; this build cannot open it safely`
    }
  if (input.runtimeSchema < schemaMin)
    return {
      compatibility: 'incompatible',
      reasonCode: 'database_behind',
      says: `this estate is at schema ${input.runtimeSchema} and this build needs at least ${schemaMin}; it will NOT migrate the estate on its own`
    }
  return {
    compatibility: 'compatible',
    reasonCode: 'in_window',
    says: `schema ${input.runtimeSchema} is inside this build's window (${schemaMin}–${schemaMax})`
  }
}

/** Whether this build may WRITE. One place decides, so a surface cannot infer
 *  it from a string and get `unknown` wrong in the permissive direction. */
export function mayWrite(v: CompatibilityVerdict): boolean {
  return v.compatibility === 'compatible'
}

// ——————————————————————————————————————————————————— what a person is shown

export interface BuildLine {
  /** What to put in front of a person. Always answerable — the absence of a
   *  manifest is itself the answer, and it is the one that most needs saying. */
  says: string
  /** The short form for a screenshot: version and the first of the sha. */
  short: string
  /** True when this build cannot say what it is, so the surface can mark it
   *  rather than presenting an absence as a version. */
  unidentified: boolean
  /** True when the source had uncommitted changes; shown BESIDE the sha rather
   *  than instead of it. */
  dirty: boolean
}

const SHORT_SHA = 7

export function buildLine(read: ManifestRead): BuildLine {
  if (!read.ok)
    return {
      says: read.says,
      short: 'unidentified build',
      unidentified: true,
      dirty: false
    }
  const m = read.manifest
  const sha = m.commitSha.slice(0, SHORT_SHA)
  return {
    says:
      `${m.appVersion} · ${sha}${m.sourceDirty ? ' + uncommitted changes' : ''}` +
      ` · built ${m.builtAtUtc}` +
      `${m.toolchainVerification?.status === 'verified' ? ' · desktop bundle and packager versions verified; reproducibility not established' : ' · toolchain versions unverified; reproducibility not established'}`,
    short: `${m.appVersion} ${sha}${m.sourceDirty ? '+' : ''}`,
    unidentified: false,
    dirty: m.sourceDirty
  }
}

/**
 * Are these two builds the same thing?
 *
 * Used to answer "is what is installed what we released". A dirty build is
 * never equal to anything, INCLUDING ITSELF: two builds from the same commit
 * with different uncommitted changes share a sha and are different software,
 * and the whole point of the flag is that the sha stops being an identity.
 */
export function sameBuild(a: BuildManifest | null, b: BuildManifest | null): boolean {
  if (!a || !b) return false
  if (a.sourceDirty || b.sourceDirty) return false
  // An artifact digest that is not a digest is not a measurement, and two
  // non-measurements are not a match. Checked as a SHAPE rather than against a
  // shared sentinel, so the producer keeps the only copy of the word it writes
  // and this still refuses `absent`, `unknown`, `''` and anything else that
  // arrives where a fingerprint was promised.
  if (!isDigest(a.artifactDigest) || !isDigest(b.artifactDigest)) return false
  return (
    a.commitSha === b.commitSha &&
    a.lockfileSha256 === b.lockfileSha256 &&
    a.artifactDigest === b.artifactDigest
  )
}

const isDigest = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)

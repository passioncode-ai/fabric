import { describe, expect, it } from 'vitest'
import {
  MANIFEST_SCHEMA,
  buildLine,
  compatibilityOf,
  mayWrite,
  readManifest,
  sameBuild,
  type BuildManifest
} from './buildManifest.ts'

const manifest = (over: Partial<BuildManifest> = {}): BuildManifest => ({
  schema: MANIFEST_SCHEMA,
  buildId: 'b1',
  commitSha: '6122ba61e041a05964e3c3c377e3e2dd5e034bbb',
  sourceDirty: false,
  builtAtUtc: '2026-09-09T12:00:00Z',
  appVersion: '0.1.0',
  lockfileSha256: 'aa'.repeat(32),
  schemaMin: 40,
  schemaMax: 50,
  journalReadVersions: [1],
  adapterContractRevision: 'fac-0.1.0',
  toolchainDigest: null,
  artifactDigest: 'cc'.repeat(32),
  files: [],
  ...over
})

describe('a partial identity is not one', () => {
  it('reads a whole manifest', () => {
    const got = readManifest(manifest())
    expect(got.ok).toBe(true)
  })

  it('says ABSENT rather than inventing, when there is no manifest', () => {
    // A dev run is a legitimate thing. What is not legitimate is answering with
    // a commit read from whatever directory the app was launched in.
    const got = readManifest(null)
    expect(got.ok).toBe(false)
    if (!got.ok) {
      expect(got.why).toBe('absent')
      expect(got.says).toMatch(/cannot say which source/i)
    }
  })

  it('refuses a manifest missing a field rather than reading around the hole', () => {
    const { lockfileSha256: _drop, ...partial } = manifest()
    const got = readManifest(partial)
    expect(got.ok).toBe(false)
    if (!got.ok) expect(got.says).toMatch(/lockfileSha256/)
  })

  it('refuses a commit sha that does not say whether the source was clean', () => {
    // The field the whole flag exists for: a sha with no dirty flag is a claim
    // about code this build may not contain.
    const got = readManifest({ ...manifest(), sourceDirty: undefined })
    expect(got.ok).toBe(false)
    if (!got.ok) expect(got.says).toMatch(/clean/i)
  })

  it('refuses the manifest of an EARLIER build of this same product', () => {
    // FA-01. @1 carried an identity derived from the file COUNT. It is not a
    // manifest with one weaker field; it is an identity that cannot separate two
    // different bundles, and reading around it would let an installed build of
    // unknown content answer "which build is this".
    const got = readManifest({ ...manifest(), schema: 'BuildManifest@1' })
    expect(got.ok).toBe(false)
    if (!got.ok) expect(got.why).toBe('wrong_schema')
  })

  it('refuses a manifest that does not say what the artifact contains', () => {
    const { artifactDigest: _dropped, ...without } = manifest()
    const got = readManifest(without)
    expect(got.ok).toBe(false)
    if (!got.ok) expect(got.why).toBe('unreadable')
  })

  it('refuses a manifest of a schema it does not read', () => {
    const got = readManifest({ ...manifest(), schema: 'BuildManifest@9' })
    expect(got.ok).toBe(false)
    if (!got.ok) expect(got.why).toBe('wrong_schema')
  })
})

describe('the schema window is a refusal, not a hint', () => {
  it('runs inside its window', () => {
    const v = compatibilityOf({ manifest: manifest(), runtimeSchema: 45 })
    expect(v.compatibility).toBe('compatible')
    expect(mayWrite(v)).toBe(true)
  })

  it('refuses a database that moved past the verified read model', () => {
    // No forward-compatible read model has been established.
    const v = compatibilityOf({ manifest: manifest(), runtimeSchema: 51 })
    expect(v.compatibility).toBe('incompatible')
    expect(v.reasonCode).toBe('database_ahead')
    expect(mayWrite(v)).toBe(false)
    expect(v.says).toMatch(/cannot open it safely/i)
  })

  it('refuses a database behind its window and does NOT offer to migrate it', () => {
    const v = compatibilityOf({ manifest: manifest(), runtimeSchema: 20 })
    expect(v.compatibility).toBe('incompatible')
    expect(v.says).toMatch(/will NOT migrate/)
    expect(mayWrite(v)).toBe(false)
  })

  it('says UNKNOWN, not incompatible, when the estate did not answer', () => {
    // A database outage and an out-of-date build are different failures, and
    // collapsing them sends the operator to reinstall over the wrong one.
    const v = compatibilityOf({ manifest: manifest(), runtimeSchema: null })
    expect(v.compatibility).toBe('unknown')
    expect(v.reasonCode).toBe('schema_unreadable')
    expect(v.says).toMatch(/not the same as it being out of date/i)
    expect(mayWrite(v)).toBe(false)
  })

  it('says UNKNOWN when the build cannot identify itself', () => {
    const v = compatibilityOf({ manifest: null, runtimeSchema: 45 })
    expect(v.compatibility).toBe('unknown')
    expect(v.reasonCode).toBe('no_manifest')
    expect(mayWrite(v)).toBe(false)
  })

  it('never lets an unknown answer permit a write', () => {
    for (const runtimeSchema of [null, 20, 51])
      expect(mayWrite(compatibilityOf({ manifest: manifest(), runtimeSchema }))).toBe(false)
    expect(mayWrite(compatibilityOf({ manifest: null, runtimeSchema: 45 }))).toBe(false)
  })
})

describe('what a person is shown, and it is always answerable', () => {
  it('carries the version, the short sha and when it was built', () => {
    const line = buildLine(readManifest(manifest()))
    expect(line.short).toBe('0.1.0 6122ba6')
    expect(line.says).toMatch(/0\.1\.0/)
    expect(line.says).toMatch(/2026-09-09/)
    expect(line.unidentified).toBe(false)
  })

  it('shows the uncommitted changes BESIDE the sha, never instead of it', () => {
    const line = buildLine(readManifest(manifest({ sourceDirty: true })))
    expect(line.short).toContain('6122ba6')
    expect(line.short).toContain('+')
    expect(line.dirty).toBe(true)
  })

  it('never treats a bare pin digest as observed verification or reproducibility', () => {
    for (const toolchainDigest of [null, 'sha256:abc'])
      expect(buildLine(readManifest(manifest({ toolchainDigest }))).says)
        .toContain('toolchain versions unverified; reproducibility not established')
  })

  it('shows only the scope established by a valid toolchain version receipt', () => {
    const digest = 'd'.repeat(64)
    const receipt = { scope: 'desktop-bundle-and-packager-versions' as const, status: 'verified' as const,
      profile: 'local-desktop', digest, reasons: [] }
    const good = manifest({ toolchainDigest: digest, toolchainVerification: receipt })
    expect(buildLine(readManifest(good)).says).toContain('versions verified; reproducibility not established')
    for (const toolchainVerification of [ { ...receipt, digest: null }, { ...receipt, scope: 'all' },
      { ...receipt, reasons: ['mismatch'] }, { ...receipt, status: 'unverified' }, { ...receipt, profile: null },
      { ...receipt, digest: 'bad' }, { ...receipt, extra: true } ])
      expect(readManifest({ ...good, toolchainVerification }).ok).toBe(false)
    expect(readManifest(manifest({toolchainVerification: {...receipt,status:'unverified',digest:null,reasons:['pin_absent']}})).ok).toBe(true)
  })

  it('answers for a build that cannot identify itself, and marks it', () => {
    const line = buildLine(readManifest(null))
    expect(line.unidentified).toBe(true)
    expect(line.short).toBe('unidentified build')
    // Not an empty string: the absence is the most important thing to say.
    expect(line.says.length).toBeGreaterThan(20)
  })
})

describe('is what is installed what we released', () => {
  it('matches two clean builds of the same source', () => {
    expect(sameBuild(manifest(), manifest({ buildId: 'b2', builtAtUtc: 'later' }))).toBe(true)
  })

  it('separates two builds of one commit whose BUNDLES differ', () => {
    // The failure this closes: `sameBuild` compared source and dependencies and
    // nothing else, so a bundle rebuilt with a changed byte — same commit, same
    // lockfile, clean tree because `out/` is ignored — compared EQUAL to the
    // release it was not.
    expect(sameBuild(manifest(), manifest({ artifactDigest: 'dd'.repeat(32) }))).toBe(false)
  })

  it('never calls two builds that have no bundle the same build', () => {
    // `absent` is not a measurement, so two of them are not a match.
    const unbuilt = manifest({ artifactDigest: 'absent' })
    expect(sameBuild(unbuilt, unbuilt)).toBe(false)
  })

  it('separates two builds of the same commit with different dependencies', () => {
    expect(sameBuild(manifest(), manifest({ lockfileSha256: 'bb'.repeat(32) }))).toBe(false)
  })

  it('never calls a DIRTY build equal to anything, including itself', () => {
    // Two builds from one commit with different uncommitted changes share a sha
    // and are different software. That is the whole point of the flag.
    const dirty = manifest({ sourceDirty: true })
    expect(sameBuild(dirty, dirty)).toBe(false)
    expect(sameBuild(dirty, manifest())).toBe(false)
  })

  it('is false when either side does not identify itself', () => {
    expect(sameBuild(manifest(), null)).toBe(false)
    expect(sameBuild(null, null)).toBe(false)
  })
})

describe('strict schema values', () => {
  it('fails closed on malformed runtime numbers and manifest bounds', () => {
    for (const value of [NaN, Infinity, -Infinity, '45', undefined, 0, -1, 45.1, Number.MAX_SAFE_INTEGER + 1, {}, []]) {
      expect(mayWrite(compatibilityOf({manifest:manifest(),runtimeSchema:value as number}))).toBe(false)
      for (const field of ['schemaMin','schemaMax']) {
        const invalid = manifest({ [field]: value })
        expect(readManifest(invalid).ok).toBe(false)
        expect(mayWrite(compatibilityOf({manifest:invalid,runtimeSchema:45}))).toBe(false)
      }
    }
    expect(readManifest(manifest({schemaMin:51})).ok).toBe(false)
  })
})

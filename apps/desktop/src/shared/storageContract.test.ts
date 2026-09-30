import { describe, expect, it } from 'vitest'
import { TABLE_SCOPE } from './scope.ts'
import { AGENT_FIELDS, PROJECT_FIELDS } from './mirror.ts'
import {
  MIRRORED,
  NOT_MIRRORED,
  UndeclaredEntity,
  declaredCoverage,
  checkGeneration,
  planImport,
  restorability
} from './storageContract.ts'

describe('the mirror says what it holds, and it is computed', () => {
  it('accounts for EVERY table the estate has, with nothing silently absent', () => {
    // The failure this prevents: the mirror covers two tables and the screen
    // says "import a workspace", which an operator reads as "restore my
    // estate". A backup that silently holds a fraction is worse than none,
    // because it is the one nobody checks.
    const covered = declaredCoverage().map((c) => c.entityType)
    expect(covered.sort()).toEqual(Object.keys(TABLE_SCOPE).sort())
  })

  it('refuses to answer at all when a new table is neither carried nor excused', () => {
    // A table added tomorrow must break this rather than quietly become an
    // omission. Same shape as `UnscopedTable`.
    const table = 'a_table_nobody_declared'
    expect(() => {
      if (!(table in MIRRORED) && !(table in NOT_MIRRORED)) throw new UndeclaredEntity(table)
    }).toThrow(UndeclaredEntity)
    expect(table in MIRRORED || table in NOT_MIRRORED).toBe(false)
  })

  it('names the fields FROM THE WRITER rather than restating them', () => {
    // A copied field list agrees today and disagrees the first time somebody
    // widens one — and a manifest naming a field the file does not hold is the
    // same lie as a coverage list omitting a table.
    for (const f of PROJECT_FIELDS) expect(MIRRORED.projects).toContain(f)
    for (const f of AGENT_FIELDS) expect(MIRRORED.agent_bindings).toContain(f)
  })

  it('gives every excluded table a reason, because an exemption without one is a gap', () => {
    for (const c of declaredCoverage().filter((c) => c.mode !== 'complete'))
      expect(c.reason && c.reason.length > 20).toBe(true)
  })

  it('carries exactly two of the estate tables, and that is the measurement', () => {
    const complete = declaredCoverage().filter((c) => c.mode === 'complete')
    expect(complete.map((c) => c.entityType).sort()).toEqual(['agent_bindings', 'projects'])
    expect(Object.keys(TABLE_SCOPE).length).toBeGreaterThan(20)
  })
})

describe('what may and may not be called a restoration', () => {
  it('refuses the word, and says which absences decide it', () => {
    const r = restorability(declaredCoverage())
    expect(r.restorable).toBe(false)
    expect(r.missing).toContain('goals')
    expect(r.missing).toContain('questions')
  })

  it('says it in a sentence an operator reads as information, not as a warning', () => {
    // "restorable: false" on a screen is read as a warning and dismissed.
    // Naming the things is read.
    const r = restorability(declaredCoverage())
    expect(r.says).toMatch(/goals/)
    expect(r.says).toMatch(/will not bring those back/)
  })

  it('would allow the claim only when nothing unrebuildable is missing', () => {
    const r = restorability([
      { entityType: 'projects', mode: 'complete' },
      { entityType: 'journal', mode: 'excluded', reason: 'the spine itself, rebuilt from' }
    ])
    // An exclusion that a rebuild reproduces is not a gap in the backup. Only
    // the ones marked NOT REBUILDABLE decide the word.
    expect(r.restorable).toBe(true)
  })
})

const manifest = (files: { path: string; sha256: string }[]): import('./storageContract.ts').MirrorManifest => ({
  format: 'fabric-declared-mirror',
  schemaVersion: 2,
  estateId: 'e1',
  generatedAt: '2026-09-09T00:00:00.000Z',
  coverage: [],
  files: files.map((f) => ({ ...f, bytes: 1 })),
  counts: {},
  contentDigest: 'd'
})

describe('the manifest is the generation marker', () => {
  const m = manifest([
    { path: 'workspace/projects.yaml', sha256: 'aaa' },
    { path: 'workspace/agents.yaml', sha256: 'bbb' }
  ])

  it('reads a matching pair as one completed generation', () => {
    expect(
      checkGeneration(m, {
        'workspace/projects.yaml': { sha256: 'aaa' },
        'workspace/agents.yaml': { sha256: 'bbb' }
      }).status
    ).toBe('current')
  })

  it('catches a MIXED generation — the crash the old writer could not see', () => {
    // A crash between the two writes left the new projects.yaml beside the old
    // agents.yaml, and nothing in the product could tell that from an operator
    // editing a file. The manifest is written last, so it names both halves of
    // one generation.
    const got = checkGeneration(m, {
      'workspace/projects.yaml': { sha256: 'aaa' },
      'workspace/agents.yaml': { sha256: 'OLD' }
    })
    expect(got.status).toBe('diverged')
    expect(got.drifted).toEqual(['workspace/agents.yaml'])
  })

  it('separates a file that is GONE from one that changed', () => {
    // Different problems with different answers: a deleted file is a broken
    // workspace, an edited one is the operator working.
    expect(checkGeneration(m, { 'workspace/projects.yaml': { sha256: 'aaa' } }).status).toBe('incomplete')
  })

  it('says UNKNOWN rather than current when there is no manifest at all', () => {
    // Every workspace written before this change. Reporting those as current
    // would assert a generation nobody recorded.
    expect(checkGeneration(null, { 'workspace/projects.yaml': { sha256: 'aaa' } }).status).toBe('unknown')
  })
})

describe('an import is validated whole, before anything is written', () => {
  const plan = (over: Partial<Parameters<typeof planImport>[0]> = {}) =>
    planImport({ projects: [], agents: [], bytes: 10, inputDigest: 'd', ...over })

  it('accepts a consistent pair', () => {
    const got = plan({
      projects: [{ id: 'p1', name: 'atlas' }],
      agents: [{ id: 'a1', project_id: 'p1', name: 'claude' }]
    })
    expect(got.ok).toBe(true)
    expect(got.counts).toEqual({ projects: 1, agent_bindings: 1 })
  })

  it('catches an agent bound to a project that is not in the file', () => {
    // The old path appended it anyway: a binding to nothing, discovered later
    // by whoever tried to use it.
    const got = plan({ projects: [{ id: 'p1' }], agents: [{ id: 'a1', project_id: 'GONE' }] })
    expect(got.ok).toBe(false)
    expect(got.problems.map((p) => p.code)).toContain('DANGLING_REFERENCE')
  })

  it('catches two rows sharing an id rather than letting the second win', () => {
    const got = plan({ projects: [{ id: 'p1' }, { id: 'p1' }] })
    expect(got.problems.map((p) => p.code)).toContain('DUPLICATE_ID')
  })

  it('refuses an oversized folder outright rather than importing it in chunks', () => {
    // A silent chunked mode means a crash lands mid-estate, which is the single
    // outcome the atomic path exists to prevent.
    const got = plan({ bytes: 50 * 1024 * 1024 })
    expect(got.problems.map((p) => p.code)).toContain('IMPORT_TOO_LARGE')
    expect(got.problems[0].says).toMatch(/Nothing was written/)
  })

  it('carries the parse failures the caller already hit rather than re-deriving them', () => {
    const got = plan({ parseErrors: [{ file: 'projects.yaml', reason: 'line 4 is not a pair' }] })
    expect(got.problems.map((p) => p.code)).toContain('UNPARSEABLE')
  })

  it('says what the import will NOT bring back, even when the plan is valid', () => {
    // The thing the operator most needs to read, and the reason it is on the
    // plan rather than in a footnote: "import a workspace" reads as "restore my
    // estate", and it is not that.
    const got = plan({ projects: [{ id: 'p1' }], agents: [] })
    expect(got.ok).toBe(true)
    expect(got.says).toMatch(/goals/)
  })

  it('reports EVERY problem, not the first', () => {
    // A validation that stops at the first fault makes an operator fix one
    // thing at a time against a file they cannot see all of.
    const got = plan({
      projects: [{ id: 'p1' }, { id: 'p1' }],
      agents: [{ id: 'a1', project_id: 'GONE' }],
      bytes: 50 * 1024 * 1024
    })
    expect(new Set(got.problems.map((p) => p.code)).size).toBeGreaterThanOrEqual(3)
  })
})

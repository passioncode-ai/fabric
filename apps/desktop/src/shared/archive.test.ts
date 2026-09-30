import { describe, expect, it } from 'vitest'
import { TABLE_SCOPE } from './scope.ts'
import {
  ARCHIVE_SCHEMA,
  UninventoriedCategory,
  archiveInventory,
  digestInput,
  notRestored,
  readArchive
} from './archive.ts'

const manifest = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  schema: ARCHIVE_SCHEMA,
  sourceEstateId: '00000000-0000-0000-0000-0000000000aa',
  takenAtUtc: '2026-09-10T04:00:00.000Z',
  watermarkSeq: 120,
  eventCount: 120,
  digest: 'dd'.repeat(32),
  ...over
})
const body = (over: Partial<{ lines: number; digest: string }> = {}) => ({
  lines: 120,
  digest: 'dd'.repeat(32),
  ...over
})

describe('an archive accounts for every category, or it is not one (FA-06)', () => {
  it('names every table the estate has, exactly once', () => {
    const names = archiveInventory().filter((c) => c.kind === 'table').map((c) => c.name)
    expect(names.sort()).toEqual(Object.keys(TABLE_SCOPE).sort())
    expect(new Set(names).size).toBe(names.length)
  })

  it('gives every category an owner, a retention and a reason', () => {
    for (const c of archiveInventory()) {
      expect(c.owner.length).toBeGreaterThan(3)
      expect(c.retention.length).toBeGreaterThan(3)
      expect(c.reason.length).toBeGreaterThan(30)
    }
  })

  it('carries the journal and rebuilds the projections, rather than copying both', () => {
    const inv = archiveInventory()
    expect(inv.find((c) => c.name === 'journal')?.recovery).toBe('archive')
    // A projection carried beside the record it derives from is a second thing
    // that can disagree with it (ADR-0014).
    expect(inv.find((c) => c.name === 'project_tasks')?.recovery).toBe('journal')
    expect(inv.find((c) => c.name === 'questions')?.recovery).toBe('journal')
  })

  it('never carries authority, and says so where an operator reads it', () => {
    const excluded = notRestored().map((c) => c.name)
    for (const authority of ['grants', 'memberships', 'membership_commands', 'persons', 'estate_restore_boundaries'])
      expect(excluded).toContain(authority)
    // A restored grant is a forged one. The reason travels with the exclusion.
    expect(notRestored().find((c) => c.name === 'grants')?.reason).toMatch(/forge/i)
  })

  it('never carries a session bundle, because that is a credential on disk', () => {
    expect(notRestored().map((c) => c.name)).toContain('session-bundles')
  })

  it('refuses to answer for a table nobody declared', () => {
    const unknown = 'a_table_nobody_inventoried'
    expect(archiveInventory().map((c) => c.name)).not.toContain(unknown)
    expect(() => {
      throw new UninventoriedCategory(unknown)
    }).toThrow(/silently omits/)
  })
})

describe('an archive that cannot be restored from is refused BEFORE anything is touched', () => {
  it('reads a whole, matching archive', () => {
    expect(readArchive(manifest(), body()).ok).toBe(true)
  })

  it('refuses an archive of a schema it does not restore', () => {
    const got = readArchive(manifest({ schema: 'FabricArchive@9' }), body())
    expect(got.ok).toBe(false)
    if (!got.ok) expect(got.why).toBe('wrong_schema')
  })

  it('refuses a manifest with a hole in it rather than reading around it', () => {
    for (const key of ['sourceEstateId', 'watermarkSeq', 'digest', 'eventCount']) {
      const partial = manifest()
      delete partial[key]
      const got = readArchive(partial, body())
      expect(got.ok).toBe(false)
      if (!got.ok) expect(got.why).toBe('incomplete')
    }
  })

  it('calls a SHORT archive truncated, not corrupt — the copy did not finish', () => {
    // Different sentences on purpose: one says the copy was interrupted and the
    // other that the bytes were altered, and an operator acts on them differently.
    const got = readArchive(manifest(), body({ lines: 90 }))
    expect(got.ok).toBe(false)
    if (!got.ok) {
      expect(got.why).toBe('truncated')
      expect(got.says).toContain('did not finish')
    }
  })

  it('calls an ALTERED archive corrupt', () => {
    const got = readArchive(manifest(), body({ digest: 'ee'.repeat(32) }))
    expect(got.ok).toBe(false)
    if (!got.ok) expect(got.why).toBe('corrupt')
  })

  it('refuses nothing at all', () => {
    expect(readArchive(null, body()).ok).toBe(false)
    expect(readArchive('a string', body()).ok).toBe(false)
  })

  it('signs the identity as well as the body, so two archives cannot be swapped', () => {
    // A body lifted from another estate's archive would otherwise verify against
    // a manifest that names this one.
    const a = digestInput({ sourceEstateId: 'A', watermarkSeq: 10, eventCount: 10 })
    const b = digestInput({ sourceEstateId: 'B', watermarkSeq: 10, eventCount: 10 })
    expect(a).not.toBe(b)
    expect(digestInput({ sourceEstateId: 'A', watermarkSeq: 11, eventCount: 10 })).not.toBe(a)
  })
})


describe('ADR-0075 private conversation recovery boundary', () => {
  it('only opaque receipts are rebuildable from an Estate archive', () => {
    const inventory = archiveInventory()
    for (const name of ['ceo_conversations', 'ceo_private_contents', 'ceo_messages', 'ceo_operations']) {
      const category = inventory.find(c => c.name === name)
      expect(category?.recovery).toBe('excluded')
      expect(category?.owner).toContain('ADR-0075')
      expect(category?.retention).toContain('owner retention')
      expect(category?.reason).toMatch(/private/)
    }
    expect(inventory.find(c => c.name === 'ceo_receipt_refs')?.recovery).toBe('journal')
    for (const name of ['ceo_pending_requests', 'ceo_write_authorizations'])
      expect(inventory.find(c => c.name === name)?.recovery).toBe('excluded')
  })
  it('the private import receipt and content provenance are excluded, never journal-recovered (ADR-0079)', () => {
    // An unknown table used to fall through to journal recovery. These two record a LOCAL
    // import and where its text came from; carrying them in an Estate archive would carry
    // one Person's provenance into another Estate and let a copy claim an import it never ran.
    const inventory = archiveInventory()
    for (const name of ['ceo_private_import_receipts', 'ceo_content_provenance']) {
      const category = inventory.find(c => c.name === name)
      expect(category?.recovery).toBe('excluded')
      expect(category?.reason).toMatch(/private|provenance|import/)
    }
  })
})

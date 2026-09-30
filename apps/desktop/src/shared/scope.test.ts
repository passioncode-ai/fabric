import { describe, expect, it, vi } from 'vitest'
import { createScopedStore } from '../main/scopedStore.ts'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import {
  TABLE_SCOPE,
  UnscopedTable,
  scopeFilters,
  scopeOwnership,
  tableScope,
  withinScope,
  type Scope
} from './scope'

const ESTATE: Scope = { kind: 'estate', estateId: 'E' }
const PROJECT: Scope = { kind: 'project', estateId: 'E', projectId: 'P' }

// ————————————————————————————————————————————————— the schema, read not recalled
//
// The map is a claim ABOUT THE DATABASE, so it is checked against the database's
// own definition rather than against memory. Both directions matter: a table the
// map has never heard of is a hole, and an entry naming a column that does not
// exist is worse than the hole — it compiles, returns nothing, and reads as an
// empty table (the P21 failure mode this whole slice exists downstream of).

const MIGRATIONS = path.resolve(__dirname, '../../../../supabase/migrations')

function schemaColumns(): Map<string, Set<string>> {
  const sql = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(path.join(MIGRATIONS, f), 'utf8'))
    .join('\n')

  const columns = new Map<string, Set<string>>()
  const create = /create table(?: if not exists)?\s+(\w+)\s*\(([\s\S]*?)\n\)\s*;/g
  for (let m = create.exec(sql); m; m = create.exec(sql)) {
    const set = columns.get(m[1]) ?? new Set<string>()
    for (const line of m[2].split('\n')) {
      const col = /^ {2}(\w+)\s+\S/.exec(line)
      if (col) set.add(col[1])
    }
    columns.set(m[1], set)
  }
  const alter = /alter table (\w+)\s+add column(?: if not exists)? (\w+)/g
  for (let m = alter.exec(sql); m; m = alter.exec(sql)) {
    const set = columns.get(m[1]) ?? new Set<string>()
    set.add(m[2])
    columns.set(m[1], set)
  }
  const dropped = /drop table(?: if exists)?\s+(\w+)/g
  for (let m = dropped.exec(sql); m; m = dropped.exec(sql)) columns.delete(m[1])
  return columns
}

describe('the map and the schema agree', () => {
  const schema = schemaColumns()

  it('found the migrations at all', () => {
    // A parse that silently matched nothing would make every check below pass.
    expect(schema.size).toBeGreaterThan(20)
    expect(schema.get('project_tasks')).toContain('estate_id')
  })

  it('every table in the schema has an entry', () => {
    const missing = [...schema.keys()].filter((t) => !TABLE_SCOPE[t]).sort()
    expect(missing).toEqual([])
  })

  it('every entry names a table that exists', () => {
    const ghosts = Object.keys(TABLE_SCOPE)
      .filter((t) => !schema.has(t))
      .sort()
    expect(ghosts).toEqual([])
  })

  it('every scoped entry names columns the table actually has', () => {
    const wrong: string[] = []
    for (const [table, policy] of Object.entries(TABLE_SCOPE)) {
      if ('global' in policy || 'private' in policy) continue
      const cols = schema.get(table)
      if (!cols) continue
      if (!cols.has(policy.estate)) wrong.push(`${table}.${policy.estate}`)
      if (policy.project && !cols.has(policy.project)) wrong.push(`${table}.${policy.project}`)
    }
    expect(wrong.sort()).toEqual([])
  })

  it('an exemption from project scoping carries its reason', () => {
    // Silence here would be indistinguishable from an oversight, which is the
    // whole failure mode this map exists to remove.
    for (const [table, policy] of Object.entries(TABLE_SCOPE)) {
      if ('projectMeansEstateWideWhenNull' in policy)
        expect(policy.projectMeansEstateWideWhenNull.length).toBeGreaterThan(30)
      if ('global' in policy) expect(policy.global.length).toBeGreaterThan(30)
      if ('private' in policy) expect(policy.private.length).toBeGreaterThan(30)
    }
  })

  it('a table carrying project_id is scoped by it, not left estate-wide', () => {
    // Otherwise one project's window reads another project's rows inside the
    // same estate, which is half the boundary and reads as the whole one.
    const loose: string[] = []
    for (const [table, policy] of Object.entries(TABLE_SCOPE)) {
      if ('global' in policy || 'private' in policy) continue
      const cols = schema.get(table)
      if ('projectMeansEstateWideWhenNull' in policy) continue
      if (cols?.has('project_id') && policy.project !== 'project_id') loose.push(table)
    }
    expect(loose.sort()).toEqual([])
  })
})

describe('scopeFilters', () => {
  it('narrows by estate alone under an estate scope', () => {
    expect(scopeFilters('project_tasks', ESTATE)).toEqual([['estate_id', 'E']])
  })

  it('narrows by estate AND project under a project scope', () => {
    expect(scopeFilters('project_tasks', PROJECT)).toEqual([
      ['estate_id', 'E'],
      ['project_id', 'P']
    ])
  })

  it('selects the project row itself, because `projects` keys on id', () => {
    expect(scopeFilters('projects', PROJECT)).toEqual([
      ['estate_id', 'E'],
      ['id', 'P']
    ])
  })

  it('narrows `estates` by id, which is where the estate id lives on that table', () => {
    expect(scopeFilters('estates', ESTATE)).toEqual([['id', 'E']])
  })

  it('leaves an estate-wide table estate-wide even under a project scope', () => {
    expect(scopeFilters('estate_settings', PROJECT)).toEqual([['estate_id', 'E']])
  })

  it('returns nothing for a table the map declares global', () => {
    expect(scopeFilters('event_types', PROJECT)).toEqual([])
  })

  it('refuses a table it has never heard of instead of passing it through', () => {
    expect(() => scopeFilters('secrets', ESTATE)).toThrow(UnscopedTable)
    // The message has to say what to do, or the next person deletes the check.
    expect(() => tableScope('secrets')).toThrow(/TABLE_SCOPE/)
  })
})

describe('withinScope', () => {
  it('lets an estate scope reach any project in it', () => {
    expect(withinScope(ESTATE, 'anything')).toBe(true)
  })

  it('refuses a project scope another project', () => {
    expect(withinScope(PROJECT, 'P')).toBe(true)
    expect(withinScope(PROJECT, 'other')).toBe(false)
  })
})

describe('scopeOwnership', () => {
  const schema = schemaColumns()

  it('never writes the row’s own key from a scope', () => {
    // `projects` narrows by `id`; inserting under a project scope must not
    // rename the row to the scope's project.
    expect(scopeOwnership('projects', PROJECT)).toEqual([['estate_id', 'E']])
    expect(scopeOwnership('estates', ESTATE)).toEqual([])
  })

  it('still writes genuine ownership columns', () => {
    expect(scopeOwnership('project_tasks', PROJECT)).toEqual([
      ['estate_id', 'E'],
      ['project_id', 'P']
    ])
  })

  it('drops nothing but `id` — every other narrowing column is real ownership', () => {
    // The rule "a narrowing column called `id` is the row's own key" is only
    // safe while that is true of the schema. Asserted, not assumed.
    for (const [table, policy] of Object.entries(TABLE_SCOPE)) {
      if ('global' in policy || 'private' in policy) continue
      for (const column of [policy.estate, policy.project]) {
        if (column && column !== 'id') expect(schema.get(table)).toContain(column)
      }
    }
    expect(scopeOwnership('project_tasks', ESTATE)).toEqual([['estate_id', 'E']])
  })
})


describe('private content and restore authority require an authorized port', () => {
  const tables = ['ceo_conversations', 'ceo_private_contents', 'ceo_messages',
    'ceo_operations', 'ceo_pending_requests', 'ceo_receipt_refs', 'ceo_write_authorizations', 'estate_restore_boundaries',
    'ceo_private_import_receipts', 'ceo_content_provenance']
  it('refuses every generic read/write before constructing a database query', async () => {
    const from = vi.fn(() => { throw new Error('unexpected_query') })
    const db = { from } as unknown as Parameters<typeof createScopedStore>[0]
    for (const scope of [ESTATE, PROJECT]) {
      const store = createScopedStore(db, scope)
      for (const table of tables) {
        expect(() => scopeOwnership(table, scope)).toThrow('private_table_requires_authorized_port')
        expect(() => store.select(table, '*')).toThrow('private_table_requires_authorized_port')
        expect(() => store.insert(table, {})).toThrow('private_table_requires_authorized_port')
        expect(() => store.update(table, {})).toThrow('private_table_requires_authorized_port')
        expect(() => store.delete(table)).toThrow('private_table_requires_authorized_port')
        await expect(store.selectIn(table, '*', 'id', [])).rejects.toThrow('private_table_requires_authorized_port')
        await expect(store.selectIn(table, '*', 'id', ['known-id'])).rejects.toThrow('private_table_requires_authorized_port')
      }
    }
    expect(from).not.toHaveBeenCalled()
  })
})

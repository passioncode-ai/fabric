// The rail's projects list (SCN-162 step 2, amended 0.3.14): alphabetical in the locale's collation, a favourite marked
// in place, archived projects never; and the latest activity read from the journal's own events.
import { describe, expect, it } from 'vitest'
import { lastActivityOf, railProjects } from './railProjects.ts'

const p = (id: string, name: string, over: Partial<{ status: 'active' | 'archived'; created_at: string }> = {}) =>
  ({ id, name, status: over.status ?? 'active', created_at: over.created_at ?? '2026-10-01T00:00:00Z' })

describe('railProjects', () => {
  // 0.3.14, the simple Fabric (docs/ux/2026-10-26-simple-fabric.md §1, open choice 1): strictly alphabetical in the
  // locale's collation, Russian and Latin names together; a favourite keeps its star as a mark and moves nowhere.
  it('lists every project alphabetically in the locale\'s collation, Russian and Latin names together', () => {
    const projects = [p('z', 'Zulu'), p('a', 'alpha'), p('e', 'Ёлка'), p('r', 'Арбуз'), p('y', 'Яндекс'), p('b', 'Beta'), p('t', 'project 10'), p('n', 'project 9'), p('g', 'Жук')]
    expect(railProjects(projects, [], 'en').map((r) => r.name)).toEqual(['alpha', 'Beta', 'project 9', 'project 10', 'Zulu', 'Арбуз', 'Ёлка', 'Жук', 'Яндекс'])
    expect(railProjects(projects, [], 'ru').map((r) => r.name)).toEqual(['Арбуз', 'Ёлка', 'Жук', 'Яндекс', 'alpha', 'Beta', 'project 9', 'project 10', 'Zulu'])
  })

  it('keeps a favourite in its alphabetical place, marked, never first', () => {
    const rows = railProjects([p('a', 'Alpha'), p('b', 'Beta'), p('c', 'Gamma'), p('d', 'Delta')], ['c', 'a'], 'en')
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'd', 'c'])
    expect(rows.map((r) => r.favourite)).toEqual([true, false, false, true])
  })

  it('never lists an archived project, even a pinned one', () => {
    const rows = railProjects([p('a', 'Alpha', { status: 'archived' }), p('b', 'Beta')], ['a'], 'en')
    expect(rows.map((r) => r.id)).toEqual(['b'])
  })

  it('orders two projects of the same name by id, so the list never reshuffles between reads', () => {
    expect(railProjects([p('b2', 'Same'), p('a1', 'same')], [], 'en').map((r) => r.id)).toEqual(['a1', 'b2'])
  })

  it('ignores a pin whose project no longer exists', () => {
    expect(railProjects([p('a', 'Alpha')], ['gone', 'a'], 'en').map((r) => r.id)).toEqual(['a'])
  })
})

describe('lastActivityOf', () => {
  it('keeps the newest event time per project and skips estate-wide events', () => {
    expect(lastActivityOf([
      { project_id: 'a', occurred_at: '2026-10-17T10:00:00Z' },
      { project_id: 'a', occurred_at: '2026-10-18T09:00:00Z' },
      { project_id: null, occurred_at: '2026-10-19T09:00:00Z' },
      { project_id: 'b', occurred_at: '2026-10-16T09:00:00Z' }
    ])).toEqual({ a: '2026-10-18T09:00:00Z', b: '2026-10-16T09:00:00Z' })
  })

  it('answers nothing for a feed not read yet', () => {
    expect(lastActivityOf(null)).toEqual({})
  })
})

// The rail's projects list (SCN-162 step 2): favourites first in the order they were pinned, then by latest
// activity, archived projects never; and the latest activity read from the journal's own events.
import { describe, expect, it } from 'vitest'
import { lastActivityOf, railProjects } from './railProjects.ts'

const p = (id: string, name: string, over: Partial<{ status: 'active' | 'archived'; created_at: string }> = {}) =>
  ({ id, name, status: over.status ?? 'active', created_at: over.created_at ?? '2026-10-01T00:00:00Z' })

describe('railProjects', () => {
  it('puts favourites first, in the order they were pinned, then the rest by latest activity', () => {
    const rows = railProjects(
      [p('a', 'Alpha'), p('b', 'Beta'), p('c', 'Gamma'), p('d', 'Delta')],
      ['c', 'a'],
      { b: '2026-10-17T10:00:00Z', d: '2026-10-18T10:00:00Z' }
    )
    expect(rows.map((r) => r.id)).toEqual(['c', 'a', 'd', 'b'])
    expect(rows.map((r) => r.favourite)).toEqual([true, true, false, false])
  })

  it('never lists an archived project, even a pinned one', () => {
    const rows = railProjects([p('a', 'Alpha', { status: 'archived' }), p('b', 'Beta')], ['a'], {})
    expect(rows.map((r) => r.id)).toEqual(['b'])
  })

  it('falls back to when a project was created, then to its name, when nothing has happened in it', () => {
    const rows = railProjects(
      [p('a', 'Zulu', { created_at: '2026-10-01T00:00:00Z' }), p('b', 'Alpha', { created_at: '2026-10-01T00:00:00Z' }), p('c', 'Mid', { created_at: '2026-10-05T00:00:00Z' })],
      [],
      {}
    )
    expect(rows.map((r) => r.id)).toEqual(['c', 'b', 'a'])
  })

  it('ignores a pin whose project no longer exists', () => {
    expect(railProjects([p('a', 'Alpha')], ['gone', 'a'], {}).map((r) => r.id)).toEqual(['a'])
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

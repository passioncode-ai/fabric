// The rail's projects list (SCN-162 step 2, amended 0.3.14): alphabetical in the locale's collation, a favourite marked
// in place, archived projects never; and the latest activity read from the journal's own events.
import { describe, expect, it } from 'vitest'
import { lastActivityOf, liveProjectsOf, projectsAtWork, railProjects } from './railProjects.ts'

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

// The mockup parity, 2026-10-27 (rail gap 1, spec §1 item 3 amended): the rail lists the projects at work, the rest
// one press away behind «Все проекты · N».
describe('railProjects names', () => {
  it('prints the display name main resolved and keeps the slug for the hover', () => {
    const rows = railProjects([{ ...p('c', 'copylot-agent'), displayName: 'Copylot' }, p('b', 'beta')], [], 'en')
    expect(rows.map((r) => [r.name, r.slug])).toEqual([['beta', 'beta'], ['Copylot', 'copylot-agent']])
  })
})

describe('projectsAtWork', () => {
  const all = railProjects(
    [p('a', 'Alpha'), p('b', 'Beta'), p('c', 'Gamma'), p('d', 'Delta'), p('e', 'Epsilon'), p('f', 'Phi'), p('g', 'Quiet'), p('h', 'Zeta')],
    ['f'], 'en')
  const none = { live: new Set<string>(), pulses: null, waiting: null, current: null }
  const pulse = (projectId: string, over: Partial<{ live: number; inWork: number; review: number }> = {}) =>
    ({ projectId, live: 0, inWork: 0, review: 0, ...over })

  it('keeps a project where an agent works, a task is in work or in review, the person is waited for, pinned or on screen', () => {
    const rows = projectsAtWork(all, {
      live: new Set(['a']),
      pulses: [pulse('b', { inWork: 1 }), pulse('c', { review: 2 }), pulse('g'), pulse('h', { live: 1 })],
      waiting: { d: 1, g: 0 },
      current: 'e'
    })
    expect(rows.map((r) => r.name)).toEqual(['Alpha', 'Beta', 'Delta', 'Epsilon', 'Gamma', 'Phi', 'Zeta'])
    expect(rows.some((r) => r.id === 'g')).toBe(false)
  })

  it('keeps the full list\'s alphabetical order and its favourite marks', () => {
    const rows = projectsAtWork(all, { ...none, live: new Set(['h', 'a']) })
    expect(rows.map((r) => r.id)).toEqual(['a', 'f', 'h'])
    expect(rows.find((r) => r.id === 'f')?.favourite).toBe(true)
  })

  it('lists only the pinned and the open project while nothing is read yet, never every project', () => {
    expect(projectsAtWork(all, { ...none, current: 'c' }).map((r) => r.id)).toEqual(['c', 'f'])
    expect(projectsAtWork(all, none).map((r) => r.id)).toEqual(['f'])
  })
})

describe('liveProjectsOf', () => {
  it('lights a project for a running terminal, a terminal-joined agent at work, or a pulse that counts one', () => {
    const live = liveProjectsOf(
      [{ projectId: 't', running: true }, { projectId: 'ended', running: false }],
      [{ projectId: 'j', stale: false }, { projectId: 'q', stale: true }, { projectId: null, stale: false }],
      [{ projectId: 'p', live: 1 }, { projectId: 'z', live: 0 }])
    expect([...live].sort()).toEqual(['j', 'p', 't'])
  })

  it('with a reading that judged work, lights only where an agent is AT work: a connected one, or an idle console, does not', () => {
    const live = liveProjectsOf(
      [{ projectId: 'idle-console', running: true }],
      [{ projectId: 'w', stale: false, atWork: true }, { projectId: 'c', stale: false, atWork: false }],
      [{ projectId: 'p', live: 3, atWork: 1 }, { projectId: 'z', live: 2, atWork: 0 }])
    expect([...live].sort()).toEqual(['p', 'w'])
  })

  it('keeps a project busy for its agents at work, not for its merely connected ones', () => {
    const [a, b] = railProjects([p('a', 'Alpha'), p('b', 'Beta')], [], 'en')
    const rows = projectsAtWork([a, b], { live: new Set(), pulses: [{ projectId: 'a', live: 4, atWork: 0, inWork: 0, review: 0 }, { projectId: 'b', live: 1, atWork: 1, inWork: 0, review: 0 }], waiting: null, current: null })
    expect(rows.map((r) => r.id)).toEqual(['b'])
  })

  it('lights nothing before anything is read', () => {
    expect(liveProjectsOf(null, null, null).size).toBe(0)
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

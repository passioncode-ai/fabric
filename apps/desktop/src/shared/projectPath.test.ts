import { describe, expect, it } from 'vitest'
import { legacyTaskLine, pathSummary, projectPath, type PathTask } from './projectPath'

const task = (id: string, status: PathTask['status'], over: Partial<PathTask> = {}): PathTask => ({
  id, status, title: 'Task ' + id, brief_what: null, instruction: 'do ' + id, started_at: '2026-10-01T00:00:00Z', finished_at: null, moved_at: null, position: null, ...over
})

describe('pathSummary', () => {
  it('the brief, then the title, and never the instruction (UX-3)', () => {
    expect(pathSummary({ title: 'T', brief_what: 'Компьютер не засыпает' })).toBe('Компьютер не засыпает')
    expect(pathSummary({ title: 'Ship it', brief_what: null })).toBe('Ship it')
    expect(pathSummary({ title: null, brief_what: null })).toBe('')
  })
})

describe('legacyTaskLine', () => {
  it('names an untitled legacy task by its first line, cut at a word', () => {
    expect(legacyTaskLine({ title: null, brief_what: null, instruction: '\n  Fix the login form\nmore' })).toBe('Fix the login form')
    const long = legacyTaskLine({ title: null, brief_what: null, instruction: 'word '.repeat(60) })
    expect(long.endsWith('…')).toBe(true)
    expect(long.length).toBeLessThanOrEqual(121)
  })
})

describe('projectPath', () => {
  const tasks = [
    task('d1', 'done', { finished_at: '2026-10-10T00:00:00Z' }),
    task('d2', 'done', { finished_at: '2026-10-12T00:00:00Z' }),
    task('d3', 'done', { moved_at: '2026-10-11T00:00:00Z' }),
    task('d4', 'done', { finished_at: '2026-10-01T00:00:00Z' }),
    task('r1', 'running', { moved_at: '2026-10-13T00:00:00Z' }),
    task('v1', 'review', { moved_at: '2026-10-12T00:00:00Z' }),
    task('b1', 'backlog', { position: 2 }),
    task('b2', 'backlog', { position: 1 }),
    task('b3', 'backlog', { started_at: '2026-09-01T00:00:00Z' }),
    task('c1', 'cancelled')
  ]
  const p = projectPath(tasks)

  it('came from: the newest done first, three of them', () => {
    expect(p.done.map((i) => i.id)).toEqual(['d2', 'd3', 'd1'])
  })
  it('now: in work, then in review', () => {
    expect(p.now.map((i) => i.id)).toEqual(['r1', 'v1'])
  })
  it('next: the queue in its board order, unpositioned last', () => {
    expect(p.next.map((i) => i.id)).toEqual(['b2', 'b1', 'b3'])
  })
  it('the board counts every task of a column, cancelled in none', () => {
    expect(Object.fromEntries(Object.entries(p.columns).map(([k, v]) => [k, v.count]))).toEqual({ backlog: 3, running: 1, review: 1, done: 4 })
    expect(p.columns.done.items).toHaveLength(3)
  })
  it('an empty project has an empty way, not a missing one', () => {
    expect(projectPath([])).toEqual({ done: [], now: [], next: [], columns: { backlog: { count: 0, items: [] }, running: { count: 0, items: [] }, review: { count: 0, items: [] }, done: { count: 0, items: [] } } })
  })
})

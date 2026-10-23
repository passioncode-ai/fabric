// The Board screen's kanban (the operator's walk OF-19, SCN-173, D-1): Fabric's ladder as four columns.
import { describe, expect, it } from 'vitest'
import { composeTaskBoard } from './taskBoard'
import type { HomeView } from './homeLive.ts'

const home: HomeView = {
  live: [],
  inWork: [{ taskId: 'r1', projectId: 'p1', projectName: 'Fabric', summary: 'New home', agent: 'claude-code', sessionId: 's1', console: true, since: '2026-10-22T10:00:00Z', doing: null, live: true }],
  review: [{ taskId: 'v1', projectId: 'p2', projectName: 'Site', summary: 'Landing copy', since: '2026-10-22T09:00:00Z' }],
  done: [{ taskId: 'd1', projectId: 'p1', projectName: 'Fabric', summary: 'Email sign-in', since: '2026-10-21T00:00:00Z' }],
  projects: [],
  readAt: '2026-10-23T00:00:00Z'
}
const projects = [{ id: 'p1', name: 'Fabric' }, { id: 'p2', name: 'Site' }]

describe('composeTaskBoard', () => {
  it('lays the ladder out as Очередь, В работе, На проверке, Готово, each card with its project, agent and age', () => {
    const b = composeTaskBoard({ home, queued: [{ id: 'q1', project_id: 'p2', title: 'Dark theme', brief_what: null, status: 'backlog', updated_at: '2026-10-18T00:00:00Z' }], projects, queuedLimit: 100 })
    expect(b.columns.map((c) => c.stage)).toEqual(['backlog', 'running', 'review', 'done'])
    expect(b.columns[0].cards[0]).toMatchObject({ taskId: 'q1', projectName: 'Site', summary: 'Dark theme', agent: null })
    expect(b.columns[1].cards[0]).toMatchObject({ taskId: 'r1', agent: 'claude-code' })
    expect(b.columns[2].cards[0]).toMatchObject({ taskId: 'v1', projectName: 'Site' })
    expect(b.columns[3].cards[0]).toMatchObject({ taskId: 'd1' })
    expect(b.projects).toEqual(projects)
  })
  it('drops queued tasks of projects it does not know, and says when a column was cut at its limit', () => {
    const queued = [
      { id: 'q1', project_id: 'gone', title: 'Orphan', brief_what: null, status: 'backlog', updated_at: null },
      { id: 'q2', project_id: 'p1', title: 'A', brief_what: null, status: 'backlog', updated_at: null }
    ]
    const b = composeTaskBoard({ home: { ...home, reviewCapped: true }, queued, projects, queuedLimit: 2 })
    expect(b.columns[0].cards.map((c) => c.taskId)).toEqual(['q2'])
    expect(b.columns[0].capped).toBe(true)
    expect(b.columns[2].capped).toBe(true)
    expect(b.columns[1].capped).toBe(false)
  })
})

describe('the spec flag reaches the cards that can still start (ADR-0176 §1)', () => {
  it('flags a queued task whose brief lacks a part, and carries the home\'s flag for work in progress', () => {
    const queued = [
      { id: 'q1', project_id: 'p1', title: 'Short', brief_what: 'Do it', brief_why: null, brief_expected: null, status: 'backlog', updated_at: null },
      { id: 'q2', project_id: 'p1', title: 'Whole', brief_what: 'a', brief_why: 'b', brief_expected: 'c', status: 'backlog', updated_at: null },
      { id: 'q3', project_id: 'p1', title: 'Unread', brief_what: null, status: 'backlog', updated_at: null }
    ]
    const flagged = { ...home, inWork: [{ ...home.inWork[0], specMissing: true }] }
    const b = composeTaskBoard({ home: flagged, queued, projects, queuedLimit: 100 })
    expect(b.columns[0].cards.map((c) => c.specMissing)).toEqual([true, false, undefined])
    expect(b.columns[1].cards[0].specMissing).toBe(true)
    expect(b.columns[2].cards[0].specMissing).toBeUndefined()
  })
})

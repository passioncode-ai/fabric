import { describe, expect, it } from 'vitest'
import { composeSessionTasks, SESSION_TASKS_LIMIT, type SessionClaimRow, type SessionTaskRow } from './sessionTasks'

const claim = (work_id: string, claimed_at: string, extra: Partial<SessionClaimRow> = {}): SessionClaimRow => ({
  work_id, project_id: 'p1', claimed_at, released_at: null, released_how: null, ...extra
})
const task = (id: string, extra: Partial<SessionTaskRow> = {}): SessionTaskRow => ({
  id, project_id: 'p1', title: 'Title ' + id, brief_what: null, brief_why: null, brief_expected: null, status: 'running', started_at: '2026-10-20T00:00:00Z', ...extra
})
const projects = [{ id: 'p1', name: 'Fabric' }, { id: 'p2', name: 'Site' }]

describe('composeSessionTasks', () => {
  it('lists the tasks newest first, one row per task: the newest claim wins and the claims are counted', () => {
    const v = composeSessionTasks({
      claims: [
        claim('t1', '2026-10-26T08:00:00Z', { released_at: '2026-10-26T09:00:00Z', released_how: 'let-go' }),
        claim('t2', '2026-10-26T10:00:00Z'),
        claim('t1', '2026-10-26T11:00:00Z')
      ],
      launched: [],
      tasks: [task('t1', { brief_what: ' Компьютер  не засыпает ', brief_why: 'why', brief_expected: 'exp' }), task('t2', { status: 'review' })],
      projects
    })
    expect(v.tasks.map((t) => t.taskId)).toEqual(['t1', 't2'])
    expect(v.tasks[0]).toMatchObject({
      summary: 'Компьютер не засыпает', projectName: 'Fabric', status: 'running', claimedAt: '2026-10-26T11:00:00Z',
      releasedAt: null, releasedHow: null, claims: 2, via: 'claim', brief: { what: 'Компьютер не засыпает', why: 'why', expected: 'exp' }
    })
    expect(v.tasks[1]).toMatchObject({ summary: 'Title t2', status: 'review', claims: 1 })
    expect(v.capped).toBe(false)
  })

  it('keeps a released claim with when and how it ended', () => {
    const v = composeSessionTasks({ claims: [claim('t1', '2026-10-26T08:00:00Z', { released_at: '2026-10-26T09:00:00Z', released_how: 'done' })], launched: [], tasks: [task('t1')], projects })
    expect(v.tasks[0]).toMatchObject({ releasedAt: '2026-10-26T09:00:00Z', releasedHow: 'done' })
  })

  it('adds the tasks Fabric launched in the session, by when they started, and never twice', () => {
    const v = composeSessionTasks({
      claims: [claim('t1', '2026-10-26T08:00:00Z')],
      launched: [task('t1', { started_at: '2026-10-26T07:00:00Z' }), task('t3', { project_id: 'p2', started_at: '2026-10-26T12:00:00Z' })],
      tasks: [task('t1')],
      projects
    })
    expect(v.tasks.map((t) => [t.taskId, t.via, t.claims])).toEqual([['t3', 'launch', 0], ['t1', 'claim', 1]])
    expect(v.tasks[0]).toMatchObject({ projectName: 'Site', claimedAt: '2026-10-26T12:00:00Z', releasedAt: null })
  })

  it('keeps a task with no title or brief, and a task whose row was not found, with an empty summary', () => {
    const v = composeSessionTasks({ claims: [claim('t1', '2026-10-26T08:00:00Z'), claim('t9', '2026-10-26T07:00:00Z')], launched: [], tasks: [task('t1', { title: null })], projects: [] })
    expect(v.tasks.map((t) => [t.taskId, t.summary, t.status, t.projectName])).toEqual([['t1', '', 'running', null], ['t9', '', 'unknown', null]])
    expect(v.tasks[1].brief).toEqual({ what: null, why: null, expected: null })
  })

  it('shows at most the limit and says so', () => {
    const many = Array.from({ length: SESSION_TASKS_LIMIT + 5 }, (_, i) => claim('t' + i, new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString()))
    const v = composeSessionTasks({ claims: many, launched: [], tasks: [], projects })
    expect(v.tasks).toHaveLength(SESSION_TASKS_LIMIT)
    expect(v.tasks[0].taskId).toBe('t' + (SESSION_TASKS_LIMIT + 4))
    expect(v.capped).toBe(true)
    expect(composeSessionTasks({ claims: [], launched: [], tasks: [], projects, readCapped: true }).capped).toBe(true)
  })

  it('no tasks is an empty list, not a failure', () => {
    expect(composeSessionTasks({ claims: [], launched: [], tasks: [], projects })).toEqual({ tasks: [], capped: false })
  })
})

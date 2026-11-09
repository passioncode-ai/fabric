import { describe, expect, it } from 'vitest'
import { composeDirections, directionOfTask, directionTaskOfSession, requestWord, taskWord, type DirectionTask, type ProjectRequest } from './workDirections'
import type { SessionTask } from './sessionTasks'

const NOW = Date.parse('2026-11-09T12:00:00Z')
const DAY = 24 * 3600_000
const ago = (days: number): string => new Date(NOW - days * DAY).toISOString()
const task = (id: string, over: Partial<DirectionTask> = {}): DirectionTask => ({
  id, status: 'backlog', title: 'Task ' + id, brief_what: null, origin_kind: 'observation', assigned_by: null, goal_id: null,
  started_at: ago(1), finished_at: null, moved_at: null, ...over
})
const request = (id: string, over: Partial<ProjectRequest> = {}): ProjectRequest => ({
  requestId: id, threadId: 'th-' + id, from: 'p2', to: 'p1', capability: 'code.review', subject: null, state: 'queued', at: ago(1), changedAt: null, ...over
})

describe('directionOfTask: one row per task, by SCN-181\'s order', () => {
  const sources = new Set(['t-backlog', 't-person-backlog'])
  it('a task in review is the outgoing «waiting for your review», whatever its origin', () => {
    expect(directionOfTask(task('t', { status: 'review', origin_kind: 'person' }), sources)).toBe('toReview')
  })
  it('the operator first: a person\'s task or one with no origin (it predates origins, the board says «by you»)', () => {
    expect(directionOfTask(task('t', { origin_kind: 'person' }), sources)).toBe('fromYou')
    expect(directionOfTask(task('t', { origin_kind: null }), sources)).toBe('fromYou')
    expect(directionOfTask(task('t-person-backlog', { origin_kind: 'person', goal_id: 'g' }), sources)).toBe('fromYou')
  })
  it('then the backlog, then the plan, then the agents', () => {
    expect(directionOfTask(task('t-backlog', { goal_id: 'g' }), sources)).toBe('fromBacklog')
    expect(directionOfTask(task('t-goal', { goal_id: 'g' }), sources)).toBe('fromPlan')
    for (const kind of ['observation', 'document', 'memory', 'task', 'something-new'])
      expect(directionOfTask(task('t', { origin_kind: kind }), sources)).toBe('fromAgents')
  })
  it('a task is never filed under another project: no task records a board request as its origin', () => {
    expect(directionOfTask(task('t', { origin_kind: 'task', assigned_by: 'agent:abc' }), sources)).not.toBe('fromProjects')
  })
})

describe('composeDirections', () => {
  it('orders the rows as the scenario lists them, omits empty rows, and lists each row newest first', () => {
    const rows = composeDirections({
      projectId: 'p1', now: NOW,
      tasks: [
        task('a1', { started_at: ago(3) }), task('a2', { started_at: ago(1) }),
        task('y1', { origin_kind: 'person', status: 'running', moved_at: ago(2) }),
        task('r1', { status: 'review', moved_at: ago(0.5) })
      ],
      requests: [request('in1'), request('out1', { from: 'p1', to: 'p3', at: ago(2) })],
      projectNames: new Map([['p2', 'Billing'], ['p3', 'Docs']])
    })
    expect(rows.map((r) => r.direction)).toEqual(['fromProjects', 'fromYou', 'fromAgents', 'toReview', 'toProjects'])
    expect(rows.find((r) => r.direction === 'fromAgents')!.items.map((i) => (i.kind === 'task' ? i.id : ''))).toEqual(['a2', 'a1'])
    const incoming = rows[0].items[0]
    expect(incoming.kind === 'request' && incoming.projectName).toBe('Billing')
    const outgoing = rows.at(-1)!.items[0]
    expect(outgoing.kind === 'request' && outgoing.projectName).toBe('Docs')
  })

  it('every task is in exactly one row', () => {
    const tasks = [
      task('1', { origin_kind: 'person' }), task('2', { status: 'review' }), task('3', { goal_id: 'g' }), task('4'), task('5', { origin_kind: null, goal_id: 'g' }),
      task('6', { status: 'done', finished_at: ago(2) })
    ]
    const rows = composeDirections({ projectId: 'p1', now: NOW, tasks, sources: [{ task_id: '4', path: 'docs/backlog.md', row_id: 'CO-1' }] })
    const ids = rows.flatMap((r) => r.items.map((i) => (i.kind === 'task' ? i.id : '')))
    expect(ids.slice().sort()).toEqual(['1', '2', '3', '4', '5', '6'])
    const backlog = rows.find((r) => r.direction === 'fromBacklog')!.items[0]
    expect(backlog.kind === 'task' && backlog.source).toEqual({ path: 'docs/backlog.md', rowId: 'CO-1' })
  })

  it('a finished task older than seven days leaves the rows; a recent one stays with its word', () => {
    const rows = composeDirections({ projectId: 'p1', now: NOW, tasks: [
      task('old', { status: 'done', finished_at: ago(8) }), task('cancelled-old', { status: 'cancelled', moved_at: ago(9) }),
      task('new', { status: 'done', finished_at: ago(6) }), task('ancient-open', { started_at: ago(90) })
    ] })
    const ids = rows.flatMap((r) => r.items.map((i) => (i.kind === 'task' ? i.id : '')))
    expect(ids).toEqual(['new', 'ancient-open'])
    const done = rows[0].items[0]
    expect(done.kind === 'task' && done.word).toBe('done')
  })

  it('a request is incoming or outgoing by its two projects; a finished one older than seven days leaves; one to itself is incoming only', () => {
    const rows = composeDirections({ projectId: 'p1', now: NOW, tasks: [], requests: [
      request('in-open', { at: ago(40) }),
      request('in-old', { state: 'answered', at: ago(20), changedAt: ago(10) }),
      request('in-recent', { state: 'expired', at: ago(20), changedAt: ago(2) }),
      request('self', { from: 'p1', to: 'p1' }),
      request('elsewhere', { from: 'p2', to: 'p3' })
    ] })
    expect(rows.map((r) => r.direction)).toEqual(['fromProjects'])
    expect(rows[0].items.map((i) => (i.kind === 'request' ? i.requestId : ''))).toEqual(['self', 'in-recent', 'in-open'])
  })

  it('names the agent on a task and dates a card by when it last moved', () => {
    const rows = composeDirections({ projectId: 'p1', now: NOW, tasks: [task('t', { status: 'running', moved_at: ago(2), started_at: ago(5) })], agents: new Map([['t', 'codex']]) })
    const card = rows[0].items[0]
    expect(card.kind === 'task' && card.agent).toBe('codex')
    expect(card.kind === 'task' && card.at).toBe(ago(2))
    expect(card.kind === 'task' && card.word).toBe('working')
  })

  it('no requests read (null) leaves the request rows out; the task rows stay', () => {
    expect(composeDirections({ projectId: 'p1', now: NOW, tasks: [task('t')], requests: null }).map((r) => r.direction)).toEqual(['fromAgents'])
  })

  it('a summary is the brief, then the title, never the instruction', () => {
    const rows = composeDirections({ projectId: 'p1', now: NOW, tasks: [task('a', { brief_what: 'Keep the invite' }), task('b', { title: null })] })
    const sums = rows[0].items.map((i) => (i.kind === 'task' ? i.summary : null))
    expect(sums).toContain('Keep the invite')
    expect(sums).toContain('')
  })
})

describe('the words of a state', () => {
  it('a task', () => {
    expect(['backlog', 'running', 'review', 'done', 'cancelled', 'odd'].map(taskWord)).toEqual(['queued', 'working', 'review', 'done', 'cancelled', 'unknown'])
  })
  it('a request: submitted without a transition waits', () => {
    expect([null, 'queued', 'claimed', 'accepted', 'in_progress', 'answered', 'completed', 'expired', 'cancelled', 'failed_known', 'outcome_unknown', 'odd'].map(requestWord))
      .toEqual(['waiting', 'waiting', 'working', 'working', 'working', 'answered', 'done', 'expired', 'cancelled', 'failed', 'unknown', 'unknown'])
  })
})

describe('an agent\'s task as a task of the rows', () => {
  const st = (over: Partial<SessionTask> = {}): SessionTask => ({
    taskId: 't', projectId: 'p1', projectName: 'Atlas', summary: 'S', title: 'T', brief: { what: 'W', why: null, expected: null }, status: 'running',
    claimedAt: ago(1), releasedAt: null, releasedHow: null, claims: 1, via: 'claim', ...over
  })
  it('carries its origin, goal and times; a task whose row was not read is never the person\'s', () => {
    const d = directionTaskOfSession(st({ origin: { kind: 'person', assignedBy: null, goalId: 'g', movedAt: ago(0.5), finishedAt: null, startedAt: ago(3) } }))
    expect(d).toMatchObject({ id: 't', title: 'T', brief_what: 'W', origin_kind: 'person', goal_id: 'g', started_at: ago(3), moved_at: ago(0.5) })
    const unread = directionTaskOfSession(st({ status: 'unknown' }))
    expect(directionOfTask(unread, new Set())).toBe('fromAgents')
    expect(unread.started_at).toBe(ago(1))
  })
})

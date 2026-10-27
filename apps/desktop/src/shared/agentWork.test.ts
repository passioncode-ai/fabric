// At work, apart from connected (the mockup parity, 2026-10-27, home gaps D3, D4, D7).
import { describe, expect, it } from 'vitest'
import type { HomeView, LiveAgent } from './homeLive'
import { AT_WORK_MS, withWorkSignals, workOf } from './agentWork'

const now = Date.parse('2026-10-27T10:00:00Z')
const ago = (minutes: number): string => new Date(now - minutes * 60_000).toISOString()
const agent = (sessionId: string, over: Partial<LiveAgent> = {}): LiveAgent => ({
  sessionId, projectId: 'p1', projectName: 'p1', agent: 'claude-code', console: false, startedAt: ago(120), lastSignAt: ago(0), stale: false, doing: null, task: null, ...over
})
const view = (live: LiveAgent[]): HomeView => ({
  live, inWork: [], review: [], done: [], readAt: new Date(now).toISOString(),
  projects: [{ projectId: 'p1', now: null, live: live.length, inWork: 0, review: 0, lastActivityAt: null }, { projectId: 'p2', now: null, live: 0, inWork: 0, review: 0, lastActivityAt: null }]
})

describe('workOf', () => {
  it('a keep-alive ping (a fresh last sign) alone is connected, not at work', () => {
    expect(workOf(agent('a'), {}, now)).toEqual({ atWork: false, workAt: null })
  })
  it('holding a task is at work while a work signal is within the hour, and its claim time is the work time', () => {
    expect(workOf(agent('a', { task: { id: 't', projectId: 'p1', summary: 's', heldSince: ago(45) } }), {}, now)).toEqual({ atWork: true, workAt: ago(45) })
    // DA-3: an old claim kept alive by the window's ping alone is not at work.
    expect(workOf(agent('a', { task: { id: 't', projectId: 'p1', summary: 's', heldSince: ago(90) } }), {}, now)).toEqual({ atWork: false, workAt: ago(90) })
    expect(workOf(agent('a', { task: { id: 't', projectId: 'p1', summary: 's', heldSince: ago(90) }, doing: { text: 'x', note: null, step: null, ofSteps: null, at: ago(40) } }), {}, now).atWork).toBe(true)
    // DA-10: past its sign window an agent is quiet, never at work.
    expect(workOf(agent('a', { stale: true, doing: { text: 'x', note: null, step: null, ofSteps: null, at: ago(2) } }), {}, now).atWork).toBe(false)
  })
  it('a stage report, a working heartbeat, a turn or console output within the window is at work; older is not', () => {
    expect(workOf(agent('a', { doing: { text: 'x', note: null, step: null, ofSteps: null, at: ago(5) } }), {}, now).atWork).toBe(true)
    expect(workOf(agent('a', { heartbeat: { phase: 'working', at: ago(5), waitingOn: null } }), {}, now).atWork).toBe(true)
    expect(workOf(agent('a', { heartbeat: { phase: 'waiting', at: ago(5), waitingOn: 'question' } }), {}, now).atWork).toBe(false)
    expect(workOf(agent('a'), { turnAt: new Map([['a', ago(3)]]) }, now).atWork).toBe(true)
    expect(workOf(agent('a', { console: true }), { outputAt: new Map([['a', ago(1)]]) }, now).atWork).toBe(true)
    const old = workOf(agent('a', { doing: { text: 'x', note: null, step: null, ofSteps: null, at: new Date(now - AT_WORK_MS - 60_000).toISOString() } }), {}, now)
    expect(old.atWork).toBe(false)
    expect(old.workAt).not.toBeNull()
  })
})

describe('withWorkSignals', () => {
  it('orders at work first by newest work, counts connected and «без задачи», and judges each project', () => {
    const v = withWorkSignals(view([
      agent('idle'),
      agent('noTask', { doing: { text: 'x', note: null, step: null, ofSteps: null, at: ago(2) } }),
      agent('task', { task: { id: 't', projectId: 'p1', summary: 's', heldSince: ago(30) } }),
      agent('gone', { stale: true, lastSignAt: ago(60) })
    ]), {}, now)
    expect(v.live.map((a) => a.sessionId)).toEqual(['noTask', 'task', 'idle', 'gone'])
    expect(v.atWork).toEqual({ agents: 2, connectedIdle: 1, noTask: 1, noTaskSessions: ['noTask'] })
    expect(v.projects[0]).toMatchObject({ atWork: 2, workAt: ago(2) })
    expect(v.projects[1]).toMatchObject({ atWork: 0, workAt: null })
  })
  it('ER-1: a task carried from an earlier session id is not work now without a fresh sign', () => {
    const now = Date.parse('2026-10-27T10:00:00Z')
    const carried = agent('a', { task: { id: 't', projectId: 'p1', summary: 's', heldSince: '2026-10-27T08:00:00Z', fromEarlierSession: true } })
    expect(workOf(carried, {}, now).atWork).toBe(false)
    expect(workOf({ ...carried, doing: { text: 'x', note: null, step: null, ofSteps: null, at: '2026-10-27T09:55:00Z' } }, {}, now).atWork).toBe(true)
  })
})

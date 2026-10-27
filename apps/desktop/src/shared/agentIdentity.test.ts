// One agent, one identity across its Fabric session ids (the mockup parity, 2026-10-27, home gaps D5, D6).
import { describe, expect, it } from 'vitest'
import type { HomeView, LiveAgent, StageRow } from './homeLive'
import { joinByRuntime } from './agentIdentity'

const agent = (sessionId: string, over: Partial<LiveAgent> = {}): LiveAgent => ({
  sessionId, projectId: 'p1', projectName: 'p1', agent: 'claude-code', console: false, startedAt: '2026-10-27T09:00:00Z', lastSignAt: '2026-10-27T10:00:00Z', stale: false, doing: null, task: null, ...over
})
const view = (live: LiveAgent[]): HomeView => ({ live, inWork: [], review: [], done: [], projects: [], readAt: '2026-10-27T10:00:00Z' })
const stage = (sessionId: string, text: string, at: string): StageRow => ({ session_id: sessionId, project_id: 'p1', task_id: null, stage: text, step: 2, of_steps: 5, note: null, reported_at: at })

describe('joinByRuntime', () => {
  const base = {
    now: Date.parse('2026-10-27T10:00:00Z'),
    runtimeOf: new Map([['new', 'rt-1']]),
    siblings: new Map([['rt-1', ['old1', 'old2', 'new']]]),
    stages: [stage('old1', 'Older step', '2026-10-27T07:00:00Z'), stage('old2', 'Writing the read', '2026-10-27T08:30:00Z')],
    heartbeats: [{ session_id: 'old2', phase: 'working', last_received_at: '2026-10-27T08:40:00Z', waiting_kind: null }],
    claims: [
      { work_id: 'tDone', project_id: 'p1', owner_session: 'old1', claimed_at: '2026-10-27T08:50:00Z', released_at: '2026-10-27T08:55:00Z', released_how: 'done' },
      { work_id: 'tRun', project_id: 'p1', owner_session: 'old2', claimed_at: '2026-10-27T08:00:00Z', released_at: '2026-10-27T09:00:00Z', released_how: 'lapsed' }
    ],
    tasks: [
      { id: 'tDone', project_id: 'p1', title: 'Done one', brief_what: null, status: 'review' },
      { id: 'tRun', project_id: 'p1', title: 'Fix the reading', brief_what: 'Make the home read the journal', status: 'running' }
    ]
  }
  it('takes the newest stage, heartbeat and running task from the earlier session ids of the same runtime session', () => {
    const a = joinByRuntime(view([agent('new')]), base).live[0]
    expect(a.doing).toMatchObject({ text: 'Writing the read', step: 2, ofSteps: 5 })
    expect(a.heartbeat).toEqual({ phase: 'working', at: '2026-10-27T08:40:00Z', waitingOn: null })
    expect(a.task).toMatchObject({ id: 'tRun', title: 'Fix the reading', what: 'Make the home read the journal', heldSince: '2026-10-27T08:00:00Z', fromEarlierSession: true })
  })
  it('keeps what the current id holds when it is newer, and leaves an agent with no runtime id alone', () => {
    const now = agent('new', { doing: { text: 'Now', note: null, step: null, ofSteps: null, at: '2026-10-27T09:50:00Z' }, task: { id: 'tNow', projectId: 'p1', summary: 'now' } })
    const other = agent('solo')
    const v = joinByRuntime(view([now, other]), base)
    expect(v.live[0].doing?.text).toBe('Now')
    expect(v.live[0].task?.id).toBe('tNow')
    expect(v.live[1]).toBe(other)
  })
  it('never shows a task another live agent holds now', () => {
    const holder = agent('holder', { task: { id: 'tRun', projectId: 'p1', summary: 'x' } })
    const v = joinByRuntime(view([agent('new'), holder]), base)
    expect(v.live[0].task).toBeNull()
  })
  it('ER-8 (0.3.15 review, iteration 2): an earlier id\'s stage report from another project stays that project\'s', () => {
    const other = { ...base, stages: [{ ...stage('old2', 'Work in the other project', '2026-10-27T08:30:00Z'), project_id: 'p2' }, stage('old1', 'Older step', '2026-10-27T07:00:00Z')] }
    expect(joinByRuntime(view([agent('new')]), other).live[0].doing?.text).toBe('Older step')
  })
  it('ER-1: never carries a claim released on purpose or long ago, and gives one task to one agent', () => {
    const on = (how: string, at: string) => ({ ...base, claims: [{ work_id: 'tRun', project_id: 'p1', owner_session: 'old2', claimed_at: '2026-10-01T08:00:00Z', released_at: at, released_how: how }] })
    expect(joinByRuntime(view([agent('new')]), on('done', '2026-10-27T09:59:00Z')).live[0].task).toBeNull()
    expect(joinByRuntime(view([agent('new')]), on('let-go', '2026-10-27T09:59:00Z')).live[0].task).toBeNull()
    expect(joinByRuntime(view([agent('new')]), on('lapsed', '2026-10-02T08:00:00Z')).live[0].task).toBeNull()
    expect(joinByRuntime(view([agent('new')]), on('lapsed', '2026-10-27T09:30:00Z')).live[0].task?.id).toBe('tRun')
    const two = { ...base, runtimeOf: new Map([['new', 'rt-1'], ['new2', 'rt-1']]) }
    const v = joinByRuntime(view([agent('new'), agent('new2')]), two)
    expect(v.live.filter((a) => a.task?.id === 'tRun')).toHaveLength(1)
  })
})

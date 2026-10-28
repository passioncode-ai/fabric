// What an agent's screen says of each task from the session's own history (0.3.14, the simple Fabric,
// docs/ux/2026-10-26-simple-fabric.md §3): its milestones (the stage reports that name the task, or that fall inside the
// session's hold of it), how it ended (the release's note, the named results handed on), and the agent's own word on
// its phase (its newest heartbeat).
import { describe, expect, it } from 'vitest'
import { lastPhase, taskTrail } from './agentTrail.ts'

const ev = (seq: number, type: string, at: string, payload: Record<string, unknown> = {}) => ({ seq, type, occurred_at: at, payload })

describe('taskTrail', () => {
  const history = [
    ev(1, 'agent.stage.reported@1', '2026-10-26T09:00:00Z', { task_id: null, stage: 'Reading the plan', step: 1, of_steps: 3, note: null }),
    ev(2, 'agent.stage.reported@1', '2026-10-26T10:05:00Z', { task_id: null, stage: 'Writing the test', step: 2, of_steps: 3, note: 'planted defect' }),
    ev(3, 'agent.stage.reported@1', '2026-10-26T10:30:00Z', { task_id: 't2', stage: 'Fixing the board', step: 1, of_steps: 2, note: null }),
    ev(4, 'task.handoff@1', '2026-10-26T10:40:00Z', { task_id: 't1', name: 'report', value: 'docs/report.md' }),
    ev(5, 'work.released@1', '2026-10-26T10:45:00Z', { work: 't1', how: 'done', note: 'Counts changes between turns. Tests: the sweep.' }),
    ev(6, 'agent.stage.reported@1', '2026-10-26T11:00:00Z', { task_id: null, stage: 'After the release', step: null, of_steps: null, note: null })
  ]
  const holds = [{ taskId: 't1', from: '2026-10-26T10:00:00Z', to: '2026-10-26T10:45:00Z' }]

  it('takes a task\'s milestones from the reports naming it, and from the unnamed ones inside its hold, newest first', () => {
    const trail = taskTrail(history, holds)
    expect(trail.get('t1')?.milestones.map((m) => m.text)).toEqual(['Writing the test'])
    expect(trail.get('t1')?.milestones[0]).toMatchObject({ step: 2, ofSteps: 3, note: 'planted defect', at: '2026-10-26T10:05:00Z' })
    expect(trail.get('t2')?.milestones.map((m) => m.text)).toEqual(['Fixing the board'])
  })

  it('says how a task ended in the agent\'s words and names what it handed on', () => {
    const t1 = taskTrail(history, holds).get('t1')!
    expect(t1.endings).toEqual([{ how: 'done', note: 'Counts changes between turns. Tests: the sweep.', at: '2026-10-26T10:45:00Z' }])
    expect(t1.handoffs).toEqual([{ name: 'report', value: 'docs/report.md', at: '2026-10-26T10:40:00Z' }])
  })

  it('a still-open hold takes the unnamed reports from its start onwards', () => {
    const trail = taskTrail(history, [{ taskId: 't3', from: '2026-10-26T10:50:00Z', to: null }])
    expect(trail.get('t3')?.milestones.map((m) => m.text)).toEqual(['After the release'])
  })

  it('an empty or blank release note is no ending to tell', () => {
    const trail = taskTrail([ev(1, 'work.released@1', '2026-10-26T10:45:00Z', { work: 't1', how: 'done', note: '  ' })], [])
    expect(trail.get('t1')?.endings ?? []).toEqual([])
  })
})

describe('lastPhase', () => {
  it('is the newest heartbeat\'s phase, the agent\'s own claim, with when it said it', () => {
    expect(lastPhase([ev(1, 'agent.heartbeat@1', 'a', { phase: 'working' }), ev(2, 'agent.heartbeat@1', 'b', { phase: 'waiting', waiting_kind: 'question' }), ev(3, 'session.started@1', 'c')]))
      .toEqual({ phase: 'waiting', waitingOn: 'question', at: 'b' })
    expect(lastPhase([ev(1, 'agent.heartbeat@1', 'a', { phase: 'something-new' })])).toBeNull()
    expect(lastPhase([])).toBeNull()
  })
})

describe('a stage report just before a claim (the mockup parity, agent gaps «Вехи»)', () => {
  it('belongs to the claim made within the grace after it; one made long before, or covered by another hold, does not', async () => {
    const { STAGE_BEFORE_CLAIM_MS } = await import('./agentTrail.ts')
    const trail = taskTrail([
      ev(1, 'agent.stage.reported@1', '2026-10-27T09:58:00Z', { stage: 'Starting the rhythm read' }),
      ev(2, 'agent.stage.reported@1', '2026-10-27T09:00:00Z', { stage: 'Long before' }),
      ev(3, 'agent.stage.reported@1', '2026-10-27T10:30:00Z', { stage: 'Inside t1' })
    ], [{ taskId: 't1', from: '2026-10-27T10:00:00Z', to: null }])
    expect(STAGE_BEFORE_CLAIM_MS).toBe(5 * 60_000)
    expect(trail.get('t1')?.milestones.map((m) => m.text)).toEqual(['Inside t1', 'Starting the rhythm read'])
  })
})

// CO-470 (0.3.15 review, iteration 1, DA-7): a report stamped with task A, made just before the agent released A and
// claimed B, is B's; one stamped with a task the session kept holding stays on it.
describe('a stamped stage report and the next claim (CO-470)', () => {
  it('moves to the task claimed within the grace when the stamped one was released within it; stays otherwise', () => {
    const holds = [
      { taskId: 'A', from: '2026-10-27T09:00:00Z', to: '2026-10-27T10:01:00Z' },
      { taskId: 'B', from: '2026-10-27T10:02:00Z', to: null },
      { taskId: 'C', from: '2026-10-27T08:00:00Z', to: null }
    ]
    const trail = taskTrail([
      ev(1, 'agent.stage.reported@1', '2026-10-27T10:00:00Z', { task_id: 'A', stage: 'Starting the next fix' }),
      ev(2, 'agent.stage.reported@1', '2026-10-27T09:30:00Z', { task_id: 'A', stage: 'Halfway through A' }),
      ev(3, 'agent.stage.reported@1', '2026-10-27T10:00:30Z', { task_id: 'C', stage: 'Still on C' })
    ], holds)
    expect(trail.get('B')?.milestones.map((m) => m.text)).toEqual(['Starting the next fix'])
    expect(trail.get('A')?.milestones.map((m) => m.text)).toEqual(['Halfway through A'])
    expect(trail.get('C')?.milestones.map((m) => m.text)).toEqual(['Still on C'])
  })
})

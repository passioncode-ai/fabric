// The left column's «Агенты» view (0.3.14, the simple Fabric, docs/ux/2026-10-26-simple-fabric.md §1 item 4): every agent
// at work now, one row each, with its runner, project and git branch, sorted by project name, then by its newest sign.
import { describe, expect, it } from 'vitest'
import type { LiveAgent } from './homeLive.ts'
import { railAgents } from './railAgents.ts'

const live = (sessionId: string, projectName: string | null, over: Partial<LiveAgent> = {}): LiveAgent => ({
  sessionId, projectId: projectName ? `p-${projectName}` : null, projectName, agent: 'claude-code', console: true,
  startedAt: '2026-10-26T10:00:00Z', lastSignAt: '2026-10-26T12:00:00Z', stale: false, doing: null, task: null, ...over
})

describe('railAgents', () => {
  it('sorts by project name in the locale\'s collation, then by the newest sign of life', () => {
    const rows = railAgents([
      live('s1', 'Fabric', { lastSignAt: '2026-10-26T11:00:00Z' }),
      live('s2', 'copylot'),
      live('s3', 'Fabric', { lastSignAt: '2026-10-26T12:30:00Z' }),
      live('s4', 'Арбуз')
    ], 'en')
    expect(rows.map((r) => r.sessionId)).toEqual(['s2', 's3', 's1', 's4'])
  })

  it('says working or quiet from what Fabric observed, never from the agent\'s claim', () => {
    const [a, b] = railAgents([live('s1', 'A'), live('s2', 'B', { stale: true })], 'en')
    expect(a.state).toBe('working')
    expect(b.state).toBe('quiet')
  })

  it('carries a branch only when Fabric read one; otherwise null, which the column says as unknown', () => {
    const rows = railAgents([live('s1', 'A', { branch: 'release/0.3.14' }), live('s2', 'B', { console: false }), live('s3', 'C', { branch: null })], 'en')
    expect(rows.map((r) => r.branch)).toEqual(['release/0.3.14', null, null])
  })

  it('puts an agent with no project last, its sign of life deciding among them', () => {
    const rows = railAgents([live('s1', null), live('s2', 'Zulu')], 'en')
    expect(rows.map((r) => r.sessionId)).toEqual(['s2', 's1'])
  })

  it('carries each agent\'s status word from what Fabric observes of its console (R-19)', () => {
    const rows = railAgents([live('s1', 'A'), live('s2', 'B'), live('s3', 'C', { stale: true })], 'en', [
      { sessionId: 's1', state: 'idle', exitCode: null }, { sessionId: 's2', state: 'ended', exitCode: 2 }
    ])
    // DA-5: a console silent for a minute is idle, never «waiting»; a wait is said only when Fabric observed one.
    expect(rows.map((r) => r.status)).toEqual(['idle', 'error', 'idle'])
  })

  it('ER-18: takes the agent\'s fresh heartbeat, as «В работе» and the agent page do; an old one falls back to what is observed', () => {
    const rows = railAgents([
      live('s1', 'A', { heartbeat: { phase: 'waiting', at: '2026-10-26T12:00:00Z', waitingOn: 'question' } }),
      live('s2', 'B', { heartbeat: { phase: 'blocked', at: '2026-10-24T23:00:00Z', waitingOn: null } })
    ], 'en', [])
    expect(rows.map((r) => r.status)).toEqual(['waiting', 'working'])
  })
})

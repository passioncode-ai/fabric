// «В работе» grouped by project (0.3.14, the simple Fabric, docs/ux/2026-10-26-simple-fabric.md §2b): one card per project
// with an agent at work or a task in work, ordered by its newest sign of life; each card names its agents and the tasks
// in work no agent row holds; projects with nothing at work fold into one quiet line, alphabetically.
import { describe, expect, it } from 'vitest'
import type { LiveAgent, WorkItem } from './homeLive.ts'
import { groupInWork } from './homeProjects.ts'

const live = (sessionId: string, projectId: string | null, at: string, over: Partial<LiveAgent> = {}): LiveAgent => ({
  sessionId, projectId, projectName: projectId ? projectId.toUpperCase() : null, agent: 'claude-code', console: true,
  startedAt: '2026-10-26T08:00:00Z', lastSignAt: at, stale: false, doing: null, task: null, ...over
})
const work = (taskId: string, projectId: string, sessionId: string | null, since: string, liveNow = true): WorkItem => ({
  taskId, projectId, projectName: projectId.toUpperCase(), summary: taskId, agent: 'claude-code', sessionId, console: false, since, doing: null, live: liveNow
})
const projects = [
  { id: 'fab', name: 'Fabric', status: 'active' as const, summary: 'Agents at work, on this computer.' },
  { id: 'cop', name: 'Copylot', status: 'active' as const, summary: null },
  { id: 'obs', name: 'Observatory', status: 'active' as const, summary: null },
  { id: 'res', name: 'research agent', status: 'active' as const, summary: null },
  { id: 'old', name: 'Old', status: 'archived' as const, summary: null }
]

describe('groupInWork', () => {
  it('makes one card per project at work, the newest sign of life first, its agents newest first', () => {
    const g = groupInWork({
      live: [live('a1', 'fab', '2026-10-26T11:00:00Z'), live('a2', 'cop', '2026-10-26T12:00:00Z'), live('a3', 'fab', '2026-10-26T11:30:00Z')],
      inWork: [], projects, locale: 'en'
    })
    expect(g.cards.map((c) => c.projectId)).toEqual(['cop', 'fab'])
    expect(g.cards[1].agents.map((a) => a.sessionId)).toEqual(['a3', 'a1'])
    expect(g.cards[1].name).toBe('Fabric')
    expect(g.cards[1].summary).toBe('Agents at work, on this computer.')
    expect(g.cards[0].summary).toBeNull()
  })

  it('lists a task in work no agent row of its project holds as a line of its own, and counts every task in work', () => {
    const g = groupInWork({
      live: [live('a1', 'fab', '2026-10-26T11:00:00Z', { task: { id: 't1', projectId: 'fab', summary: 't1' } })],
      inWork: [work('t1', 'fab', 'a1', '2026-10-26T10:00:00Z'), work('t2', 'fab', 'gone', '2026-10-26T09:00:00Z', false), work('t3', 'obs', null, '2026-10-26T12:30:00Z', false)],
      projects, locale: 'en'
    })
    const fab = g.cards.find((c) => c.projectId === 'fab')!
    expect(fab.orphans.map((w) => w.taskId)).toEqual(['t2'])
    expect(fab.inWork).toBe(2)
    // A project with only a task in work, no agent, is a card too: its newest sign is the task's.
    expect(g.cards[0].projectId).toBe('obs')
    expect(g.cards[0].agents).toEqual([])
  })

  it('folds the active projects with nothing at work into one line, alphabetically, the archived never', () => {
    const g = groupInWork({ live: [live('a1', 'fab', '2026-10-26T11:00:00Z')], inWork: [], projects, locale: 'en' })
    expect(g.quiet.map((p) => p.name)).toEqual(['Copylot', 'Observatory', 'research agent'])
  })

  it('keeps an agent with no project, in a card of its own at the end', () => {
    const g = groupInWork({ live: [live('a1', null, '2026-10-26T13:00:00Z'), live('a2', 'fab', '2026-10-26T11:00:00Z')], inWork: [], projects, locale: 'en' })
    expect(g.cards.map((c) => c.projectId)).toEqual(['fab', null])
    expect(g.cards[1].agents[0].sessionId).toBe('a1')
  })

  it('counts the projects and the agents at work, a quiet agent among them', () => {
    const g = groupInWork({ live: [live('a1', 'fab', '2026-10-26T11:00:00Z'), live('a2', 'cop', '2026-10-26T11:00:00Z', { stale: true })], inWork: [], projects, locale: 'en' })
    expect([g.projectsAtWork, g.agentsAtWork]).toEqual([2, 2])
  })

  // The operator's second review, 2026-10-26 (v2 §4.1, R-1, R-2): the card says what is being done there now: its
  // running work's goal, newest first, else the profile's next planned step; the description is not the card's line.
  it('names the card\'s aim from its agents\' goals, newest first, else the plan\'s next step, else nothing', () => {
    const g = groupInWork({
      live: [
        live('a1', 'fab', '2026-10-26T11:00:00Z', { goal: { taskId: 't1', projectId: 'fab', text: 'Older goal', what: null, byPerson: false, isTask: true } }),
        live('a2', 'fab', '2026-10-26T12:00:00Z', { goal: { taskId: 't2', projectId: 'fab', text: 'Ship 0.3.14', what: null, byPerson: true, isTask: false } }),
        live('a3', 'cop', '2026-10-26T12:00:00Z', { goal: null }),
        live('a4', 'obs', '2026-10-26T12:00:00Z')
      ],
      inWork: [],
      projects: projects.map((p) => p.id === 'cop' ? { ...p, plan: { done: [], next: ['Voice overlays per channel', 'later'] } } : p),
      locale: 'en'
    })
    const by = (id: string) => g.cards.find((c) => c.projectId === id)!
    expect(by('fab').aim).toEqual({ text: 'Ship 0.3.14', from: 'goal' })
    expect(by('cop').aim).toEqual({ text: 'Voice overlays per channel', from: 'plan' })
    expect(by('obs').aim).toBeNull()
  })
})

describe('groupInWork by work, not by keep-alive (the mockup parity, home gaps D3, D4)', () => {
  const now = '2026-10-27T10:00:00Z'
  it('orders cards by the newest work, then what waits on the person, then the name; never by the newest ping', () => {
    const g = groupInWork({
      live: [
        live('a1', 'fab', now, { atWork: true, workAt: '2026-10-27T09:00:00Z' }),
        live('a2', 'cop', now, { atWork: true, workAt: '2026-10-27T09:30:00Z' }),
        live('a3', 'obs', now, { atWork: true, workAt: '2026-10-27T09:00:00Z' }),
        live('a4', 'res', '2026-10-27T10:00:05Z', { atWork: false, workAt: null })
      ],
      inWork: [], projects, locale: 'en', waitingByProject: { obs: 2 }
    })
    expect(g.cards.map((c) => c.projectId)).toEqual(['cop', 'obs', 'fab', 'res'])
    expect(g.connectedIdle).toBe(1)
  })
  it('with atWorkOnly the connected agents fold out of the cards and are counted, not carded', () => {
    const g = groupInWork({
      live: [live('a1', 'fab', now, { atWork: true, workAt: '2026-10-27T09:00:00Z' }), live('a2', 'cop', now, { atWork: false, workAt: null }), live('a3', 'cop', now, { atWork: false, workAt: null, stale: true })],
      inWork: [], projects, locale: 'en', atWorkOnly: true
    })
    expect(g.cards.map((c) => c.projectId)).toEqual(['fab'])
    expect(g.connectedIdle).toBe(1)
    expect(g.agentsAtWork).toBe(1)
    expect(g.quiet.map((q) => q.id)).toContain('cop')
  })
  it('with atWorkOnly a quiet agent that still holds its task keeps its row, and its task is never «without an agent»', () => {
    const t = { id: 't1', projectId: 'cop', summary: 'Links open in their own window' }
    const g = groupInWork({
      live: [live('a1', 'fab', now, { atWork: true, workAt: '2026-10-27T09:00:00Z' }), live('a2', 'cop', '2026-10-27T09:40:00Z', { atWork: false, workAt: '2026-10-27T09:20:00Z', stale: true, task: t })],
      inWork: [work('t1', 'cop', 'a2', '2026-10-27T09:20:00Z', false)], projects, locale: 'en', atWorkOnly: true
    })
    const cop = g.cards.find((c) => c.projectId === 'cop')!
    expect(cop.agents.map((a) => a.sessionId)).toEqual(['a2'])
    expect(cop.orphans).toEqual([])
    expect([g.agentsAtWork, g.agentsQuiet, g.connectedIdle]).toEqual([2, 1, 0])
  })
  it('DA-15 (0.3.15 review, iteration 3): a connected agent that holds its task past the hour keeps its row, never «without an agent»', () => {
    const t = { id: 't1', projectId: 'cop', summary: 'A long build' }
    const g = groupInWork({
      live: [live('a2', 'cop', now, { atWork: false, workAt: null, task: t })],
      inWork: [work('t1', 'cop', 'a2', '2026-10-27T07:00:00Z', true)], projects, locale: 'en', atWorkOnly: true
    })
    const cop = g.cards.find((c) => c.projectId === 'cop')!
    expect(cop.agents.map((a) => a.sessionId)).toEqual(['a2'])
    expect(cop.orphans).toEqual([])
    // CO-484: connected and holding its task is idle, not silent.
    expect([g.agentsQuiet, g.agentsIdle, g.connectedIdle]).toEqual([0, 1, 0])
  })
  it('prints and sorts every project by its display name, the slug kept as the identity', () => {
    const slugs = [
      { id: 'fab', name: 'fabric', status: 'active' as const },
      { id: 'cop', name: 'copylot-agent', status: 'active' as const, displayName: 'Copylot' },
      { id: 'obs', name: 'observatory', status: 'active' as const }
    ]
    const names = { fab: { name: 'Fabric', from: 'descriptor' as const, derived: false }, obs: { name: 'Observatory', from: 'slug' as const, derived: true } }
    const g = groupInWork({ live: [live('a1', 'fab', now, { atWork: true, workAt: now })], inWork: [], projects: slugs, locale: 'en', atWorkOnly: true, names })
    expect(g.cards[0].name).toBe('Fabric')
    expect(g.quiet).toEqual([{ id: 'cop', name: 'Copylot' }, { id: 'obs', name: 'Observatory' }])
  })
  it('an older reading that did not judge work keeps every agent on its card, by its newest sign', () => {
    const g = groupInWork({ live: [live('a1', 'fab', '2026-10-27T09:00:00Z'), live('a2', 'cop', '2026-10-27T09:30:00Z')], inWork: [], projects, locale: 'en', atWorkOnly: true })
    expect(g.cards.map((c) => c.projectId)).toEqual(['cop', 'fab'])
    expect(g.connectedIdle).toBe(0)
  })
})

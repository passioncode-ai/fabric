// @vitest-environment jsdom
// Агенты as an agents screen (CO-419; SCN-166, SCN-167): the list by state on the right, the chosen agent's «Работа»
// and «Консоль» in the centre, «Отключить» on a joined agent's own page (SX-26), installed agents with no session
// (SX-20), and each empty or failed read said as what it is (SX item 2).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

vi.mock('../SessionWindow', () => ({
  SessionWindow: ({ sessionId }: { sessionId: string }) => <div data-testid="session-window">{sessionId}</div>
}))

import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { AgentsScreen } from './AgentsScreen'
import { composeRoster } from './agentRoster'
import type { HomeView, LiveAgent } from '../../../shared/homeLive'
import type { HubOverview } from '../../../shared/access'
import type { ExecutorRow } from '../../../shared/startPaths'
import type { TerminalSession } from '../../../shared/types'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const now = new Date().toISOString()
const earlier = new Date(Date.now() - 3_600_000).toISOString()
const working: LiveAgent = { sessionId: 's1', projectId: 'p1', projectName: 'Fabric', agent: 'claude-code', console: true, startedAt: now, lastSignAt: now, stale: false,
  doing: null, task: { id: 't1', summary: 'Keep the computer awake' } }
const joinedLive: LiveAgent = { sessionId: 's2', projectId: 'p2', projectName: 'Site', agent: 'codex', console: false, startedAt: now, lastSignAt: now, stale: false, doing: { text: 'Writing the copy', note: null, step: null, ofSteps: null, at: now }, task: null }
const session = (over: Partial<TerminalSession>): TerminalSession => ({
  sessionId: 's1', projectId: 'p1', cwd: '/x', program: 'claude', optionId: 'claude-code', permissionMode: null, excerpt: '', written: 0,
  running: true, state: 'running', startedAt: earlier, lastActivityAt: now, tail: '', exitCode: null, ...over
})
const grant = (project: string) => ({ grantId: `g-${project}`, callee: 'fabric', capability: 'session.enroll', resource: `project:${project}`, line: { text: '' }, expiresAt: now })
const hub = (over: Partial<HubOverview> = {}): HubOverview => ({
  hub: { listening: true, origin: 'http://127.0.0.1:47070' }, products: [], pending: [], denials: [],
  agents: [{ bindingId: 'b1', agent: { agentId: 'codex', name: 'Codex', installedBy: null, repository: null, codingAgent: true }, since: earlier, grants: [grant('p2')] }],
  keptOut: { readable: true, agents: [] }, ...over
} as unknown as HubOverview)
const executors: ExecutorRow[] = [
  { id: 'claude-code', label: 'Claude Code', connected: true, state: 'found', version: '2.3', path: '/bin/claude', install: null },
  { id: 'codex', label: 'Codex', connected: true, state: 'found', version: '0.9', path: '/bin/codex', install: null },
  { id: 'kimi-code', label: 'Kimi Code', connected: false, state: 'found', version: '1.4', path: '/bin/kimi', install: null },
  { id: 'hermes', label: 'Hermes', connected: false, state: 'found', version: '0.2', path: '/bin/hermes', install: null, authentication: { state: 'not-authenticated', method: null, reason: null } },
  { id: 'goose', label: 'Goose', connected: false, state: 'missing', version: null, path: null, install: 'brew install goose' }
]
const projects = [{ id: 'p1', name: 'Fabric' }, { id: 'p2', name: 'Site' }]

function stub(o: { home?: () => Promise<HomeView>; overview?: () => Promise<HubOverview>; exec?: () => Promise<ExecutorRow[]> } = {}) {
  const api = {
    work: { home: vi.fn(o.home ?? (async (): Promise<HomeView> => ({ live: [working, joinedLive], inWork: [], review: [], done: [], projects: [], readAt: now }))) },
    hub: {
      overview: vi.fn(o.overview ?? (async () => hub())),
      disconnectAgent: vi.fn(async () => ({ ok: true as const, seq: 7 })),
      letAgentIn: vi.fn(async () => ({ ok: true as const, seq: 8 }))
    },
    start: { executors: vi.fn(o.exec ?? (async () => executors)) },
    settings: { agentCatalog: vi.fn(async () => ({ source: 'absent', reason: 'not-installed', detail: null })) },
    terminal: { history: vi.fn(async () => []) },
    windows: { openSession: vi.fn(async () => {}) }
  }
  vi.stubGlobal('window', Object.assign(window, { fabric: api }))
  return api
}
const show = (sessions: TerminalSession[] | null = [session({})], onCreate = vi.fn()) => {
  render(<I18nProvider locale="en"><AgentsScreen mark={0} hubMark={0} sessions={sessions} projects={projects} onOpenProject={vi.fn()} onOpenTask={vi.fn()} onCreate={onCreate} /></I18nProvider>)
  return { onCreate }
}
const group = (key: 'working' | 'waiting' | 'idle' | 'off') => screen.getByRole('heading', { name: new RegExp(`^${en[`agentsPlace.group.${key}`]}`) }).parentElement as HTMLElement

describe('the roster (agentRoster.composeRoster)', () => {
  it('groups by state: a console waiting on the person, a silent one, an installed one free, the ones that cannot start off', () => {
    const r = composeRoster({
      live: [working, { ...joinedLive, stale: true }],
      sessions: [session({}), session({ sessionId: 's3', state: 'idle', optionId: 'kimi-code' }), session({ sessionId: 's4', state: 'ended', optionId: 'shell' })],
      projects, executors, catalog: null, hub: hub()
    })
    expect(r.working.map((x) => x.key)).toEqual(['session:s1'])
    expect(r.waiting.map((x) => x.key)).toEqual(['session:s3'])
    expect(r.idle.map((x) => [x.key, x.state])).toEqual([['session:s2', 'quiet'], ['session:s4', 'ended']])
    // Claude Code, Codex and Kimi Code are their sessions' rows: never a second «free» row for the same agent (SX-3).
    expect(r.off.map((x) => [x.runner, x.state])).toEqual([['goose', 'missing'], ['hermes', 'signin']])
    expect(r.idle.find((x) => x.key === 'session:s2')?.joinedAgentId).toBe('codex')
    // An agent at work whose console stopped and waits for input waits for the person, whatever it last signed.
    const waiting = composeRoster({ live: [working], sessions: [session({ state: 'idle' })], projects, executors: [], catalog: null, hub: null })
    expect(waiting.waiting.map((x) => x.key)).toEqual(['session:s1'])
    expect(waiting.working).toEqual([])
  })

  it('a joined agent with no session is idle and still carries «Отключить»; a disconnected one is off', () => {
    const r = composeRoster({ live: [], sessions: [], projects, executors: [], catalog: null,
      hub: hub({ keptOut: { readable: true, agents: [{ agentId: 'gemini', name: 'Gemini', at: earlier }] } }) })
    expect(r.idle.map((x) => [x.key, x.state, x.joinedAgentId, x.projectName])).toEqual([['joined:codex', 'joined', 'codex', 'Site']])
    expect(r.off.map((x) => [x.key, x.state])).toEqual([['out:gemini', 'out']])
  })
})

describe('Агенты (CO-419)', () => {
  it('lists every agent by state, each with its name, project, one line and when it was last heard from', async () => {
    stub()
    show()
    await within(group('working')).findByText('Claude Code')
    const work = within(group('working')).getByText('Claude Code').closest('button')!
    expect(work.textContent).toContain('Fabric')
    expect(work.textContent).toContain(en['launch.home.agents.workingOn'].replace('{task}', 'Keep the computer awake'))
    expect(work.textContent).toContain(en['agentsPlace.state.working'])
    expect(within(group('working')).getByText('Codex')).toBeTruthy()
    expect(within(group('idle')).getByText('Kimi Code').closest('button')!.textContent).toContain(en['agentsPlace.line.free'].replace('{version}', '1.4'))
    expect(within(group('off')).getByText('Hermes Agent').closest('button')!.textContent).toContain(en['agentsPlace.state.signin'])
    expect(within(group('off')).getByText('Goose').closest('button')!.textContent).toContain(en['agentsPlace.state.missing'])
    expect(within(group('waiting')).getByText(en['agentsPlace.groupEmpty.waiting'])).toBeTruthy()
    // No raw session state reaches the screen (SX-3).
    expect(document.body.textContent).not.toMatch(/\b(running|idle|ended)\b/)
  })

  it('«Работа» is the chosen agent first; «Консоль» draws its live console in place, «Открыть вкладкой» moves it to a tab', async () => {
    const api = stub()
    show()
    fireEvent.click(await within(group('working')).findByText('Claude Code'))
    await screen.findByTestId('agent-page')
    expect(screen.getByRole('button', { name: en['agentsPlace.tab.work'] }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('Keep the computer awake')).toBeTruthy()
    expect(screen.queryByTestId('session-window')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: en['agentsPlace.tab.console'] }))
    expect((await screen.findByTestId('session-window')).textContent).toBe('s1')
    fireEvent.click(screen.getByRole('button', { name: en['agentsPlace.console.asTab'] }))
    await waitFor(() => expect(api.windows.openSession).toHaveBeenCalledWith('s1'))
  })

  it('a joined agent carries «Отключить» on its own page; once out it says so with «Пустить снова» (SX-26)', async () => {
    const api = stub()
    show()
    fireEvent.click(await within(group('working')).findByText('Codex'))
    await screen.findByTestId('agent-page')
    expect(screen.getByText(en['joined.proof'].replace('{name}', 'Codex'))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en['joined.disconnect'] }))
    await waitFor(() => expect(api.hub.disconnectAgent).toHaveBeenCalledWith('codex'))
    // Its console is in its terminal, not in Fabric: said, never a blank pane (SX item 5).
    fireEvent.click(screen.getByRole('button', { name: en['agentsPlace.tab.console'] }))
    expect(screen.getByText(en['agentsPlace.console.terminal'])).toBeTruthy()
  })

  it('a disconnected agent is off and lets back in from its page', async () => {
    const api = stub({
      home: async () => ({ live: [], inWork: [], review: [], done: [], projects: [], readAt: now }),
      overview: async () => hub({ agents: [], keptOut: { readable: true, agents: [{ agentId: 'codex', name: 'Codex', at: earlier }] } })
    })
    show([])
    fireEvent.click(await waitFor(() => within(group('off')).getByText('Codex')))
    fireEvent.click(await screen.findByRole('button', { name: en['joined.letIn'] }))
    await waitFor(() => expect(api.hub.letAgentIn).toHaveBeenCalledWith('codex'))
  })

  it('a refused disconnect leaves the agent connected and says why on its page', async () => {
    const api = stub()
    api.hub.disconnectAgent.mockImplementation(async () => ({ ok: false, reason: 'failed', says: 'hub refused' }) as never)
    show()
    fireEvent.click(await within(group('working')).findByText('Codex'))
    fireEvent.click(await screen.findByRole('button', { name: en['joined.disconnect'] }))
    expect(await screen.findByText('hub refused')).toBeTruthy()
    expect(screen.getByRole('button', { name: en['joined.disconnect'] })).toBeTruthy()
  })

  it('reading, empty and failed are each said as what they are', async () => {
    stub({ home: () => new Promise(() => {}), overview: () => new Promise(() => {}), exec: () => new Promise(() => {}) })
    show(null)
    expect(screen.getByText(en['agentsPlace.reading'])).toBeTruthy()
    // Nothing read yet is not «no agent»: neither the empty place nor an empty group is said.
    expect(screen.queryByText(en['agentsPlace.empty'])).toBeNull()
    expect(screen.queryByText(en['agentsPlace.groupEmpty.working'])).toBeNull()
    cleanup()
    stub({ home: async () => ({ live: [], inWork: [], review: [], done: [], projects: [], readAt: now }), overview: async () => hub({ agents: [] }), exec: async () => [] })
    show([])
    await screen.findByText(en['agentsPlace.empty'])
    expect(screen.getByText(en['agentsPlace.groupEmpty.working'])).toBeTruthy()
    cleanup()
    const api = stub({ home: async () => { throw new Error('stack refused') } })
    show([])
    await screen.findByText(en['agentsPlace.workUnread'])
    expect(screen.getByText('stack refused')).toBeTruthy()
    // The installed agents are still listed: one failed read does not empty the place.
    expect(await within(group('idle')).findByText('Kimi Code')).toBeTruthy()
    api.work.home.mockImplementation(async () => ({ live: [working], inWork: [], review: [], done: [], projects: [], readAt: now }))
    fireEvent.click(screen.getAllByRole('button', { name: en['common.retry'] })[0])
    await within(group('working')).findByText('Claude Code')
  })

  it('«Создать агента» opens «Создать» on its agent path', async () => {
    stub()
    const { onCreate } = show()
    fireEvent.click(screen.getByRole('button', { name: en['agentsPlace.create'] }))
    expect(onCreate).toHaveBeenCalled()
  })
})

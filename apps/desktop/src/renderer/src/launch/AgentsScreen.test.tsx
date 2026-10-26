// @vitest-environment jsdom
// The agent's screen and the roster (CO-419; SCN-166, SCN-167; amended 0.3.14 by the simple Fabric,
// docs/ux/2026-10-26-simple-fabric.md §3 and open choice 4): the roster by state now lives in Настройки (`AgentRoster`),
// the chosen agent's screen has no tabs and opens its console only on «Открыть сессию»; «Отключить» stays on a joined
// agent's own page (SX-26), installed agents with no session are listed (SX-20), and each empty or failed read is said
// as what it is (SX item 2).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

vi.mock('../SessionWindow', () => ({
  SessionWindow: ({ sessionId }: { sessionId: string }) => <div data-testid="session-window">{sessionId}</div>
}))

import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { AgentRoster, AgentsScreen } from './AgentsScreen'
import { composeRoster } from './agentRoster'
import type { HomeView, LiveAgent } from '../../../shared/homeLive'
import type { HubOverview } from '../../../shared/access'
import type { ExecutorRow } from '../../../shared/startPaths'
import type { TerminalSession } from '../../../shared/types'
import { OpenConsoleContext } from '../consoles'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const now = new Date().toISOString()
const earlier = new Date(Date.now() - 3_600_000).toISOString()
const working: LiveAgent = { sessionId: 's1', projectId: 'p1', projectName: 'Fabric', agent: 'claude-code', console: true, startedAt: now, lastSignAt: now, stale: false,
  doing: null, task: { id: 't1', projectId: 'p1', summary: 'Keep the computer awake' } }
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
    work: { home: vi.fn(o.home ?? (async (): Promise<HomeView> => ({ live: [working, joinedLive], inWork: [], review: [], done: [], projects: [], readAt: now }))), session: vi.fn(async () => ({ tasks: [], capped: false })) },
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
  const onSelect = vi.fn()
  render(<I18nProvider locale="en"><AgentRoster mark={0} hubMark={0} sessions={sessions} projects={projects} onSelect={onSelect} /></I18nProvider>)
  return { onCreate, onSelect }
}
/** The agent's screen, arrived at for one agent (a row of the left column, Настройки' list, a «В работе» row). */
const screenFor = (o: { session?: string; agent?: string; sessions?: TerminalSession[] | null; onPick?: (k: string) => void; onCreate?: () => void } = {}) =>
  render(<I18nProvider locale="en"><AgentsScreen mark={0} hubMark={0} sessions={o.sessions === undefined ? [session({})] : o.sessions} projects={projects} onOpenProject={vi.fn()} onOpenTask={vi.fn()}
    onCreate={o.onCreate ?? vi.fn()} initialSession={o.session ?? null} initialAgent={o.agent ?? null} onPick={o.onPick} /></I18nProvider>)
const group = (key: 'working' | 'waiting' | 'idle' | 'off') => screen.getByRole('heading', { name: new RegExp(`^${en[`agentsPlace.group.${key}`]}`) }).parentElement as HTMLElement

describe('the roster (agentRoster.composeRoster)', () => {
  it('groups by state: a console waiting on the person, a silent one, an installed one free, the ones that cannot start off', () => {
    const r = composeRoster({
      live: [working, { ...joinedLive, stale: true }],
      sessions: [session({}), session({ sessionId: 's3', state: 'idle', optionId: 'kimi-code' }), session({ sessionId: 's4', state: 'ended', optionId: 'kilo' })],
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

  // 0.3.13 review, iteration 1, UX-3: a plain shell is a console, not an agent, and a minute of silence is only silence.
  it('leaves a plain shell out, and dates a quiet console by its last output, not by the agent\'s last sign', () => {
    const quietSince = new Date(Date.now() - 600_000).toISOString()
    const r = composeRoster({
      live: [{ ...working, sessionId: 's9', agent: 'shell' }, working],
      sessions: [session({ sessionId: 's7', optionId: 'shell', state: 'idle' }), session({ sessionId: 's9', optionId: 'shell', state: 'idle' }),
        session({ state: 'idle', lastActivityAt: quietSince })],
      projects, executors: [], catalog: null, hub: null
    })
    expect(Object.values(r).flat().map((x) => x.key)).toEqual(['session:s1'])
    expect(r.waiting[0].heardAt).toBe(quietSince)
  })

  it('a joined agent with no session is idle and still carries «Отключить»; a disconnected one is off', () => {
    const r = composeRoster({ live: [], sessions: [], projects, executors: [], catalog: null,
      hub: hub({ keptOut: { readable: true, agents: [{ agentId: 'gemini', name: 'Gemini', at: earlier }] } }) })
    expect(r.idle.map((x) => [x.key, x.state, x.joinedAgentId, x.projectName])).toEqual([['joined:codex', 'joined', 'codex', 'Site']])
    expect(r.off.map((x) => [x.key, x.state])).toEqual([['out:gemini', 'out']])
  })
})

describe('the roster in Настройки (CO-419, moved by 0.3.14)', () => {
  it('lists every agent by state, each with its name, project, one line and when it was last heard from; a row opens its screen', async () => {
    stub()
    const { onSelect } = show()
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
    fireEvent.click(within(group('idle')).getByText('Kimi Code'))
    expect(onSelect).toHaveBeenCalledWith(expect.stringContaining('kimi-code'))
  })

  it('Настройки lists only the groups it is given: the idle and the off', async () => {
    stub()
    render(<I18nProvider locale="en"><AgentRoster mark={0} hubMark={0} sessions={[session({})]} projects={projects} groups={['idle', 'off']} onSelect={vi.fn()} /></I18nProvider>)
    expect(await within(group('idle')).findByText('Kimi Code')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: new RegExp(`^${en['agentsPlace.group.working']}`) })).toBeNull()
  })

  it('reading, empty and failed are each said as what they are', async () => {
    stub({ home: () => new Promise(() => {}), overview: () => new Promise(() => {}), exec: () => new Promise(() => {}) })
    show(null)
    expect(screen.getByText(en['agentsPlace.reading'])).toBeTruthy()
    // Nothing read yet is not «no agent»: no empty group is said.
    expect(screen.queryByText(en['agentsPlace.groupEmpty.working'])).toBeNull()
    cleanup()
    stub({ home: async () => ({ live: [], inWork: [], review: [], done: [], projects: [], readAt: now }), overview: async () => hub({ agents: [] }), exec: async () => [] })
    show([])
    await screen.findByText(en['agentsPlace.groupEmpty.working'])
    cleanup()
    const api = stub({ home: async () => { throw new Error('stack refused') } })
    show([])
    await screen.findByText(en['agentsPlace.workUnread'])
    expect(screen.getByText('stack refused')).toBeTruthy()
    // The installed agents are still listed: one failed read does not empty the list.
    expect(await within(group('idle')).findByText('Kimi Code')).toBeTruthy()
    api.work.home.mockImplementation(async () => ({ live: [working], inWork: [], review: [], done: [], projects: [], readAt: now }))
    fireEvent.click(screen.getAllByRole('button', { name: en['common.retry'] })[0])
    await within(group('working')).findByText('Claude Code')
  })

  // 0.3.13 review, iteration 1, UX-1: a failed read is never «no agent found», and it can be read again.
  it('a failed read of the installed agents never says no agent was found, and «Повторить» reads them again', async () => {
    let fail = true
    const api = stub({
      home: async () => ({ live: [], inWork: [], review: [], done: [], projects: [], readAt: now }),
      overview: async () => hub({ agents: [] }),
      exec: async () => { if (fail) throw new Error('spawn ENOENT'); return executors }
    })
    show([])
    await screen.findByText(en['agentsPlace.installedUnread'])
    expect(within(group('idle')).queryByText(en['agentsPlace.groupEmpty.idle'])).toBeNull()
    expect(within(group('off')).getByText(en['agentsPlace.groupUnread'])).toBeTruthy()
    fail = false
    fireEvent.click(screen.getByRole('button', { name: en['common.retry'] }))
    expect(await within(group('idle')).findByText('Kimi Code')).toBeTruthy()
    expect(api.start.executors).toHaveBeenCalledTimes(2)
    expect(screen.queryByText(en['agentsPlace.installedUnread'])).toBeNull()
  })

  // 0.3.13 review, iteration 1, UX-2: a group whose reads are still out says it is reading, never that it is empty.
  it('a group is called empty only once the reads that fill it have answered', async () => {
    stub({ home: async () => ({ live: [], inWork: [], review: [], done: [], projects: [], readAt: now }), overview: () => new Promise(() => {}), exec: () => new Promise(() => {}) })
    show([])
    await waitFor(() => within(group('working')).getByText(en['agentsPlace.groupEmpty.working']))
    expect(within(group('waiting')).getByText(en['agentsPlace.groupEmpty.waiting'])).toBeTruthy()
    for (const g of ['idle', 'off'] as const) {
      expect(within(group(g)).queryByText(en[`agentsPlace.groupEmpty.${g}`])).toBeNull()
      expect(within(group(g)).getByText(en['agentsPlace.groupReading'])).toBeTruthy()
    }
  })

  // 0.3.13 review, iteration 1, UX-3: a shell at its prompt is not listed; a quiet agent console says what is observed.
  it('a quiet console says it has printed nothing and that the agent may be waiting, never that it waits', async () => {
    const quietSince = new Date(Date.now() - 600_000).toISOString()
    stub({ home: async () => ({ live: [], inWork: [], review: [], done: [], projects: [], readAt: now }), overview: async () => hub({ agents: [] }), exec: async () => [] })
    show([session({ sessionId: 's7', optionId: 'shell', program: 'zsh', state: 'idle', lastActivityAt: quietSince }), session({ state: 'idle', lastActivityAt: quietSince })])
    const row = (await within(group('waiting')).findByText('Claude Code')).closest('button')!
    expect(row.textContent).toContain(en['agentsPlace.line.silent'].replace('{time}', '10m'))
    expect(row.textContent).toContain(en['agentsPlace.state.waiting'])
    expect(screen.queryByText('Terminal')).toBeNull()
  })

  it('iteration 3 UX-2: the list\'s row says what was not read too, never «has not said yet»', async () => {
    stub({ home: async () => { throw new Error('stack refused') }, overview: async () => hub({ agents: [] }), exec: async () => [] })
    show([session({})])
    const row = (await screen.findByText('Claude Code')).closest('button')!
    expect(row.textContent).toContain(en['agentPage.doingUnread'])
    expect(row.textContent).not.toContain(en['launch.home.agents.silent'])
  })
})

describe('the agent\'s screen (0.3.14, the simple Fabric §3)', () => {
  it('has no «Работа» / «Консоль» tabs and mounts no console on choosing; «Открыть сессию» opens it as a tab', async () => {
    const api = stub()
    const opened: string[] = []
    render(<I18nProvider locale="en"><OpenConsoleContext.Provider value={async (id) => { opened.push(id) }}>
      <AgentsScreen mark={0} hubMark={0} sessions={[session({})]} projects={projects} onOpenProject={vi.fn()} onOpenTask={vi.fn()} onCreate={vi.fn()} initialSession="s1" />
    </OpenConsoleContext.Provider></I18nProvider>)
    const page = await screen.findByTestId('agent-page')
    expect(page.textContent).toContain('Keep the computer awake')
    expect(screen.queryByRole('button', { name: en['agentsPlace.tab.work'] })).toBeNull()
    expect(screen.queryByRole('button', { name: en['agentsPlace.tab.console'] })).toBeNull()
    expect(screen.queryByTestId('session-window')).toBeNull()
    const card = screen.getByRole('complementary', { name: en['agentScreen.session'] })
    expect(card.textContent).toContain(en['agentScreen.where.fabric'])
    fireEvent.click(within(card).getByRole('button', { name: en['agentScreen.openSession'] }))
    await waitFor(() => expect(opened).toEqual(['s1']))
    expect(api.windows.openSession).not.toHaveBeenCalled()
  })

  it('without an agent chosen it says to choose one in the left column, and offers «Создать агента»', async () => {
    stub()
    const onCreate = vi.fn()
    screenFor({ onCreate })
    expect(await screen.findByText(en['agentScreen.pick'])).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en['agentsPlace.create'] }))
    expect(onCreate).toHaveBeenCalled()
  })

  it('a joined agent carries «Отключить» on its own page; its session is in its terminal, said, never a button', async () => {
    const api = stub()
    screenFor({ session: 's2' })
    await screen.findByTestId('agent-page')
    expect(screen.getByText(en['joined.proof'].replace('{name}', 'Codex'))).toBeTruthy()
    const card = screen.getByRole('complementary', { name: en['agentScreen.session'] })
    expect(card.textContent).toContain(en['agentScreen.sessionElsewhere'])
    expect(within(card).queryByRole('button', { name: en['agentScreen.openSession'] })).toBeNull()
    fireEvent.click(within(card).getByRole('button', { name: en['joined.disconnect'] }))
    await waitFor(() => expect(api.hub.disconnectAgent).toHaveBeenCalledWith('codex'))
  })

  it('a disconnected agent is off and lets back in from its page', async () => {
    const api = stub({
      home: async () => ({ live: [], inWork: [], review: [], done: [], projects: [], readAt: now }),
      overview: async () => hub({ agents: [], keptOut: { readable: true, agents: [{ agentId: 'codex', name: 'Codex', at: earlier }] } })
    })
    screenFor({ agent: 'out:codex', sessions: [] })
    fireEvent.click(await screen.findByRole('button', { name: en['joined.letIn'] }))
    await waitFor(() => expect(api.hub.letAgentIn).toHaveBeenCalledWith('codex'))
  })

  it('a refused disconnect leaves the agent connected and says why on its page', async () => {
    const api = stub()
    api.hub.disconnectAgent.mockImplementation(async () => ({ ok: false, reason: 'failed', says: 'hub refused' }) as never)
    screenFor({ session: 's2' })
    fireEvent.click(await screen.findByRole('button', { name: en['joined.disconnect'] }))
    expect(await screen.findByText('hub refused')).toBeTruthy()
    expect(screen.getByRole('button', { name: en['joined.disconnect'] })).toBeTruthy()
  })

  it('iteration 2 UX-3: when who works was not read, a console\'s task and action are unknown, never none', async () => {
    stub({ home: async () => { throw new Error('stack refused') }, overview: async () => hub({ agents: [] }), exec: async () => [] })
    screenFor({ session: 's1' })
    const page = await screen.findByTestId('agent-page')
    expect(await within(page).findByText(en['agentPage.taskUnread'])).toBeTruthy()
    expect(within(page).getByText(en['agentPage.doingUnread'])).toBeTruthy()
    expect(screen.queryByText(en['agentPage.noTask'])).toBeNull()
  })

  it('iteration 2 UX-4: an agent at work with no console here and the joined agents unread is not known to be anywhere', async () => {
    stub({ overview: async () => { throw new Error('hub refused') } })
    screenFor({ session: 's2', sessions: [] })
    const card = await screen.findByRole('complementary', { name: en['agentScreen.session'] })
    expect(card.textContent).toContain(en['agentScreen.where.unknown'])
    expect(card.textContent).toContain(en['agentScreen.sessionUnknown'])
  })
})

// 0.3.14: a board card's «Session …» opens Agents on that agent's page.
describe('arriving for one agent (0.3.14)', () => {
  it('opens that agent\'s page as if it had been picked', async () => {
    stub()
    render(<I18nProvider locale="en"><AgentsScreen mark={0} hubMark={0} sessions={[session({})]} projects={projects} onOpenProject={vi.fn()} onOpenTask={vi.fn()} onCreate={vi.fn()} initialSession="s1" /></I18nProvider>)
    const page = await screen.findByTestId('agent-page')
    expect(page.textContent).toContain('Keep the computer awake')
  })
})

// The 0.3.14 review, iteration 1: UX-2, the agent picked is kept in the route, so the way back from its task reopens it;
// UX-7, an arrival before the roster is read still moves focus to the agent's page once it is drawn.
describe('the chosen agent across a task and back (review, iteration 1)', () => {
  it('UX-2: a pick is told to the shell, and arriving with it reopens that agent', async () => {
    stub()
    const onPick = vi.fn()
    screenFor({ session: 's2', onPick })
    await screen.findByTestId('agent-page')
    await waitFor(() => expect(onPick).toHaveBeenCalledWith('session:s2'))
    cleanup()
    stub()
    render(<I18nProvider locale="en"><AgentsScreen mark={0} hubMark={0} sessions={[session({})]} projects={projects} onOpenProject={vi.fn()} onOpenTask={vi.fn()} onCreate={vi.fn()} initialAgent="session:s2" /></I18nProvider>)
    const page = await screen.findByTestId('agent-page')
    expect(page.textContent).toContain('Writing the copy')
  })

  it('UX-7: arriving for an agent whose row is read after the screen mounts moves focus to its page', async () => {
    let answer: (v: HomeView) => void = () => {}
    const api = stub({ home: () => new Promise<HomeView>((resolve) => { answer = resolve }) })
    render(<I18nProvider locale="en"><AgentsScreen mark={0} hubMark={0} sessions={[]} projects={projects} onOpenProject={vi.fn()} onOpenTask={vi.fn()} onCreate={vi.fn()} initialSession="s1" /></I18nProvider>)
    await waitFor(() => expect(api.work.home).toHaveBeenCalled())
    expect(screen.queryByTestId('agent-page')).toBeNull()
    answer({ live: [working, joinedLive], inWork: [], review: [], done: [], projects: [], readAt: now } as HomeView)
    await screen.findByTestId('agent-page')
    await waitFor(() => expect(document.activeElement?.id).toBe('agent-page-title'))
  })
})

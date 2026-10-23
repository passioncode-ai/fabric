// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { AgentPage } from './AgentPage'
import { AgentsAtWork } from './HomeWork'
import type { HomeView, LiveAgent } from '../../../shared/homeLive'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const now = new Date().toISOString()
const agentA: LiveAgent = { sessionId: 's1', projectId: 'p1', projectName: 'Fabric', agent: 'claude-code', console: true, startedAt: now, lastSignAt: now, stale: false,
  doing: { text: 'Making the keep-awake setting', note: null, step: 1, ofSteps: 2, at: now }, task: { id: 't1', summary: 'Keep the computer awake' } }
const agentB: LiveAgent = { sessionId: 's2', projectId: 'p2', projectName: 'Site', agent: 'codex', console: false, startedAt: now, lastSignAt: now, stale: true, doing: null, task: null }
const view: HomeView = { live: [agentA, agentB], inWork: [], review: [], done: [], projects: [], readAt: now }
const ev = (seq: number, type: string, payload: Record<string, unknown> = {}) => ({ estate_id: 'e', seq, type, actor: { kind: 'agent', id: 's1' }, project_id: 'p1', occurred_at: now, payload })
const show = (ui: React.ReactNode) => render(<I18nProvider locale="en">{ui}</I18nProvider>)

describe('the agent page beside the list on Агенты (CO-393)', () => {
  // 0.3.12 review UX-3 (OF-30): «choose an agent» with nobody to choose, or with the list unread, sent the person looking.
  it('says there is no agent, or that the list was not read with a retry, instead of «choose an agent»', async () => {
    const home = vi.fn(async (): Promise<HomeView> => ({ ...view, live: [] }))
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { home }, terminal: { history: vi.fn(async () => []) } } }))
    show(<AgentsAtWork mark={0} onOpen={vi.fn()} page={(a, c) => <AgentPage agent={a} mark={0} onConsole={c} onOpenProject={vi.fn()} />} />)
    await screen.findByText(en['agentPage.none'])
    expect(screen.queryByText(en['agentPage.pick'])).toBeNull()
    cleanup()
    const failing = vi.fn(async (): Promise<HomeView> => { throw new Error('stack refused') })
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { home: failing }, terminal: { history: vi.fn(async () => []) } } }))
    show(<AgentsAtWork mark={0} onOpen={vi.fn()} page={(a, c) => <AgentPage agent={a} mark={0} onConsole={c} onOpenProject={vi.fn()} />} />)
    await screen.findByText(en['agentPage.unread'])
    expect(screen.queryByText(en['agentPage.pick'])).toBeNull()
    failing.mockImplementation(async () => view)
    fireEvent.click(screen.getByRole('button', { name: en['common.retry'] }))
    await screen.findByText(en['agentPage.pick'])
  })

  // 0.3.12 review UX-7: focus stayed on the row and nothing scrolled, so below 850 px the page opened out of sight.
  it("a chosen agent's page takes focus and comes into view", async () => {
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { home: vi.fn(async () => view) }, terminal: { history: vi.fn(async () => []) } } }))
    const into = vi.fn()
    Element.prototype.scrollIntoView = into
    show(<AgentsAtWork mark={0} onOpen={vi.fn()} page={(a, c) => <AgentPage agent={a} mark={0} onConsole={c} onOpenProject={vi.fn()} />} />)
    await screen.findByText(en['agentPage.pick'])
    fireEvent.click(screen.getAllByRole('button', { pressed: false })[0])
    await screen.findByTestId('agent-page')
    await waitFor(() => expect(document.activeElement?.id).toBe('agent-page-title'))
    expect(into).toHaveBeenCalled()
  })

  it('a row selects its agent and opens its page instead of leaving the place; nothing is chosen at first', async () => {
    const history = vi.fn(async (_id: string) => [ev(1, 'task.claimed@1'), ev(2, 'task.moved@1', { to: 'done' })])
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { home: vi.fn(async () => view) }, terminal: { history } } }))
    const onOpen = vi.fn()
    show(<AgentsAtWork mark={0} onOpen={onOpen} page={(a, c) => <AgentPage agent={a} mark={0} onConsole={c} onOpenProject={onOpen} />} />)
    await screen.findByText(en['agentPage.pick'])
    fireEvent.click(screen.getAllByRole('button', { pressed: false })[0])
    const page = await screen.findByTestId('agent-page')
    expect(onOpen).not.toHaveBeenCalled()
    expect(history).toHaveBeenCalledWith('s1')
    expect(page.textContent).toContain('Keep the computer awake')
    expect(page.textContent).toContain('Making the keep-awake setting')
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1)
  })

  it('lists its results apart from everything it did, and opens its console, project and task', async () => {
    vi.stubGlobal('window', Object.assign(window, { fabric: { terminal: { history: vi.fn(async () => [ev(1, 'task.claimed@1'), ev(2, 'task.moved@1', { to: 'done' }), ev(3, 'task.moved@1', { to: 'review' })]) } } }))
    const onConsole = vi.fn(), onOpenProject = vi.fn(), onOpenTask = vi.fn()
    show(<AgentPage agent={agentA} mark={0} onConsole={onConsole} onOpenProject={onOpenProject} onOpenTask={onOpenTask} />)
    const results = await screen.findByRole('list', { name: en['agentPage.results'] })
    expect(results.querySelectorAll('li')).toHaveLength(1)
    expect(screen.getByRole('list', { name: en['agentPage.did'] }).querySelectorAll('li')).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: en['launch.home.agents.openConsole'] }))
    fireEvent.click(screen.getByRole('button', { name: en['launch.home.agents.openProject'] }))
    fireEvent.click(screen.getByRole('button', { name: en['agentPage.openTask'] }))
    expect(onConsole).toHaveBeenCalledWith('s1')
    expect(onOpenProject).toHaveBeenCalledWith('p1')
    expect(onOpenTask).toHaveBeenCalledWith('p1', 't1')
  })

  it('an agent with no console, no task and no history says so; a failed read is said with «Retry»', async () => {
    const history = vi.fn(async (_id: string): Promise<unknown[]> => { throw new Error('database away') }).mockRejectedValueOnce(new Error('database away')).mockResolvedValueOnce([])
    vi.stubGlobal('window', Object.assign(window, { fabric: { terminal: { history } } }))
    show(<AgentPage agent={agentB} mark={0} onConsole={vi.fn()} onOpenProject={vi.fn()} />)
    expect(screen.queryByRole('button', { name: en['launch.home.agents.openConsole'] })).toBeNull()
    expect(screen.getByText(en['agentPage.noTask'])).toBeTruthy()
    await screen.findByText(en['agentPage.unreadable'])
    fireEvent.click(screen.getByRole('button', { name: en['acts.retry'] }))
    await waitFor(() => expect(screen.getByText(en['agents.noHistory'])).toBeTruthy())
    expect(screen.getByText(en['agentPage.noResults'])).toBeTruthy()
  })
})

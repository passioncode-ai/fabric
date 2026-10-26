// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { ru } from '../i18n/ru'
import { AgentPage } from './AgentPage'
import { AgentsAtWork } from './HomeWork'
import type { HomeView, LiveAgent } from '../../../shared/homeLive'
import type { SessionTask, SessionTasksView } from '../../../shared/sessionTasks'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const now = new Date().toISOString()
const agentA: LiveAgent = { sessionId: 's1', projectId: 'p1', projectName: 'Fabric', agent: 'claude-code', console: true, startedAt: now, lastSignAt: now, stale: false,
  doing: { text: 'Making the keep-awake setting', note: null, step: 1, ofSteps: 2, at: now }, task: { id: 't1', projectId: 'p1', summary: 'Keep the computer awake' } }
const agentB: LiveAgent = { sessionId: 's2', projectId: 'p2', projectName: 'Site', agent: 'codex', console: false, startedAt: now, lastSignAt: now, stale: true, doing: null, task: null }
const view: HomeView = { live: [agentA, agentB], inWork: [], review: [], done: [], projects: [], readAt: now }
const ev = (seq: number, type: string, payload: Record<string, unknown> = {}) => ({ estate_id: 'e', seq, type, actor: { kind: 'agent', id: 's1' }, project_id: 'p1', occurred_at: now, payload })
const noTasks = vi.fn(async (_id: string): Promise<SessionTasksView> => ({ tasks: [], capped: false }))
const show = (ui: React.ReactNode) => render(<I18nProvider locale="en">{ui}</I18nProvider>)

describe('the agent page beside the list on Агенты (CO-393)', () => {
  // 0.3.12 review UX-3 (OF-30): «choose an agent» with nobody to choose, or with the list unread, sent the person looking.
  it('says there is no agent, or that the list was not read with a retry, instead of «choose an agent»', async () => {
    const home = vi.fn(async (): Promise<HomeView> => ({ ...view, live: [] }))
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { home, session: noTasks }, terminal: { history: vi.fn(async () => []) } } }))
    show(<AgentsAtWork mark={0} onOpen={vi.fn()} page={(a, c) => <AgentPage agent={a} mark={0} onConsole={c} onOpenProject={vi.fn()} />} />)
    await screen.findByText(en['agentPage.none'])
    expect(screen.queryByText(en['agentPage.pick'])).toBeNull()
    cleanup()
    const failing = vi.fn(async (): Promise<HomeView> => { throw new Error('stack refused') })
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { home: failing, session: noTasks }, terminal: { history: vi.fn(async () => []) } } }))
    show(<AgentsAtWork mark={0} onOpen={vi.fn()} page={(a, c) => <AgentPage agent={a} mark={0} onConsole={c} onOpenProject={vi.fn()} />} />)
    await screen.findByText(en['agentPage.unread'])
    expect(screen.queryByText(en['agentPage.pick'])).toBeNull()
    failing.mockImplementation(async () => view)
    fireEvent.click(screen.getByRole('button', { name: en['common.retry'] }))
    await screen.findByText(en['agentPage.pick'])
  })

  // 0.3.12 review UX-7: focus stayed on the row and nothing scrolled, so below 850 px the page opened out of sight.
  it("a chosen agent's page takes focus and comes into view", async () => {
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { home: vi.fn(async () => view), session: noTasks }, terminal: { history: vi.fn(async () => []) } } }))
    const into = vi.fn()
    Element.prototype.scrollIntoView = into
    show(<AgentsAtWork mark={0} onOpen={vi.fn()} page={(a, c) => <AgentPage agent={a} mark={0} onConsole={c} onOpenProject={vi.fn()} />} />)
    await screen.findByText(en['agentPage.pick'])
    fireEvent.click(screen.getAllByRole('button', { pressed: false })[0])
    await screen.findByTestId('agent-page')
    await waitFor(() => expect(document.activeElement?.id).toBe('agent-page-title'))
    expect(into).toHaveBeenCalled()
  })

  // 0.3.12 review, iteration 2, UX-3: pressing the agent already chosen left the "picked" flag up, and the next reading of
  // the place moved focus to the page's heading from wherever the person had gone, a text field included.
  it('focus moves only on the person\'s pick, never on a later reading', async () => {
    const home = vi.fn(async () => view)
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { home, session: noTasks }, terminal: { history: vi.fn(async () => []) } } }))
    Element.prototype.scrollIntoView = vi.fn()
    const ui = (mark: number) => (
      <I18nProvider locale="en">
        <input aria-label="elsewhere" />
        <AgentsAtWork mark={mark} onOpen={vi.fn()} page={(a, c) => <AgentPage agent={a} mark={0} onConsole={c} onOpenProject={vi.fn()} />} />
      </I18nProvider>
    )
    const { rerender } = render(ui(0))
    await screen.findByText(en['agentPage.pick'])
    const row = screen.getAllByRole('button', { pressed: false })[0]
    fireEvent.click(row)
    await waitFor(() => expect(document.activeElement?.id).toBe('agent-page-title'))
    fireEvent.click(screen.getAllByRole('button', { pressed: true })[0])
    const field = screen.getByLabelText('elsewhere') as HTMLInputElement
    field.focus()
    expect(document.activeElement).toBe(field)
    rerender(ui(1))
    await waitFor(() => expect(home).toHaveBeenCalledTimes(2))
    await new Promise((r) => setTimeout(r, 20))
    expect(document.activeElement, 'a reading of the place does not move focus').toBe(field)
  })

  it('a row selects its agent and opens its page instead of leaving the place; nothing is chosen at first', async () => {
    const history = vi.fn(async (_id: string) => [ev(1, 'task.claimed@1'), ev(2, 'task.moved@1', { to: 'done' })])
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { home: vi.fn(async () => view), session: noTasks }, terminal: { history } } }))
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
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { session: noTasks }, terminal: { history: vi.fn(async () => [ev(1, 'task.claimed@1'), ev(2, 'task.moved@1', { to: 'done' }), ev(3, 'task.moved@1', { to: 'review' })]) } } }))
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
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { session: noTasks }, terminal: { history } } }))
    show(<AgentPage agent={agentB} mark={0} onConsole={vi.fn()} onOpenProject={vi.fn()} />)
    expect(screen.queryByRole('button', { name: en['launch.home.agents.openConsole'] })).toBeNull()
    expect(screen.getByText(en['agentPage.noTask'])).toBeTruthy()
    await screen.findByText(en['agentPage.unreadable'])
    fireEvent.click(screen.getByRole('button', { name: en['acts.retry'] }))
    await waitFor(() => expect(screen.getByText(en['agents.noHistory'])).toBeTruthy())
    expect(screen.getByText(en['agentPage.noResults'])).toBeTruthy()
  })

  // 0.3.14 (the operator, 2026-10-26): «перейти на агента, посмотреть его флоу, как он по задачам шёл ... сверху самая
  // последняя ... на каждую задачу можно было развернуть, перейти к ней».
  const task = (id: string, extra: Partial<SessionTask> = {}): SessionTask => ({
    taskId: id, projectId: 'p1', projectName: 'Fabric', summary: 'Task ' + id, brief: { what: null, why: null, expected: null }, status: 'running',
    claimedAt: '2026-10-26T10:00:00Z', releasedAt: null, releasedHow: null, claims: 1, via: 'claim', ...extra
  })

  it('lists its tasks newest first above the history; each expands to its brief and opens the task', async () => {
    const session = vi.fn(async (_id: string): Promise<SessionTasksView> => ({ tasks: [
      task('t2', { brief: { what: 'Make the board honest', why: 'Dead work hides live work', expected: 'Abandoned work is apart' }, status: 'review' }),
      task('t1', { summary: '', status: 'done', claimedAt: '2026-10-25T10:00:00Z', releasedAt: '2026-10-25T12:00:00Z', releasedHow: 'done', claims: 3 })
    ], capped: false }))
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { session }, terminal: { history: vi.fn(async () => [ev(1, 'task.claimed@1')]) } } }))
    const onOpenTask = vi.fn()
    show(<AgentPage agent={agentA} mark={0} onOpenProject={vi.fn()} onOpenTask={onOpenTask} />)
    const list = await screen.findByRole('list', { name: en['agentPage.tasks'] })
    expect(session).toHaveBeenCalledWith('s1')
    const rows = list.querySelectorAll(':scope > li')
    expect(rows).toHaveLength(2)
    expect(rows[0].textContent).toContain('Task t2')
    expect(rows[0].textContent).toContain(en['board.review'])
    expect(rows[1].textContent).toContain(en['launch.home.work.untitled'])
    expect(rows[1].textContent).toContain(en['agentPage.ended.done'].replace(' {time}', ''))
    const first = rows[0].querySelector('details')!
    expect(first.open).toBe(false)
    fireEvent.click(first.querySelector('summary')!)
    expect(first.textContent).toContain('Dead work hides live work')
    fireEvent.click(within(first as HTMLElement).getByRole('button', { name: en['agentPage.openThisTask'] }))
    expect(onOpenTask).toHaveBeenCalledWith('p1', 't2')
    // The raw history is below, closed until the person opens it.
    const history = (await screen.findByRole('list', { name: en['agentPage.did'] })).closest('details')!
    expect(history.open).toBe(false)
    expect(list.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  // The 0.3.14 review, iteration 1: UX-8, each ending in words of its own and an unknown one said as not recorded, in
  // Russian too; UX-4, the history's heading stands outside its disclosure.
  it('UX-8: an ending is said by how it ended, never «Закончил» for one the agent did not cause; an unknown ending is not shown raw', async () => {
    const ended = (how: string) => task('t' + how.length, { releasedAt: '2026-10-26T11:00:00Z', releasedHow: how })
    const session = vi.fn(async (): Promise<SessionTasksView> => ({ tasks: [ended('operator'), ended('lapsed'), ended('weird-how'), task('l1', { via: 'launch', claims: 0 })], capped: false }))
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { session }, terminal: { history: vi.fn(async () => []) } } }))
    render(<I18nProvider locale="ru"><AgentPage agent={agentA} mark={0} onOpenProject={vi.fn()} onOpenTask={vi.fn()} /></I18nProvider>)
    const list = await screen.findByRole('list', { name: ru['agentPage.tasks'] })
    const text = list.textContent ?? ''
    expect(text).toContain(ru['agentPage.ended.operator']!.replace(' {time}', ''))
    expect(text).toContain(ru['agentPage.ended.lapsed']!.replace(' {time}', ''))
    expect(text).toContain('как именно, не записано')
    expect(text).not.toContain('weird-how')
    expect(text).not.toContain('Закончил ')
    expect(text).toContain('Запущена через Fabric')
  })

  it('UX-4: the history\'s heading stands outside its disclosure, which says what it opens', async () => {
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { session: vi.fn(async () => ({ tasks: [], capped: false })) }, terminal: { history: vi.fn(async () => [ev(1, 'task.claimed@1')]) } } }))
    show(<AgentPage agent={agentA} mark={0} onOpenProject={vi.fn()} onOpenTask={vi.fn()} />)
    const history = (await screen.findByRole('list', { name: en['agentPage.did'] })).closest('details')!
    expect(history.querySelector('summary h4')).toBeNull()
    expect(history.querySelector('summary')!.textContent).toBe(en['agentPage.historyOpen'])
    expect(screen.getByRole('heading', { name: en['agentPage.did'] }).closest('details')).toBeNull()
  })

  it('says its tasks are being read, that it has none, or that they could not be read with a retry', async () => {
    let answer: () => Promise<SessionTasksView> = () => new Promise(() => {})
    const session = vi.fn(async () => answer())
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { session }, terminal: { history: vi.fn(async () => []) } } }))
    show(<AgentPage agent={agentA} mark={0} onOpenProject={vi.fn()} />)
    expect(await screen.findByText(en['agentPage.tasksReading'])).toBeTruthy()
    cleanup()
    answer = async () => { throw new Error('database away') }
    show(<AgentPage agent={agentA} mark={0} onOpenProject={vi.fn()} />)
    await screen.findByText(en['agentPage.tasksUnreadable'])
    expect(screen.queryByText(en['agentPage.noTasks'])).toBeNull()
    answer = async () => ({ tasks: [], capped: false })
    fireEvent.click(screen.getByRole('button', { name: en['agentPage.tasksRetry'] }))
    await screen.findByText(en['agentPage.noTasks'])
  })

  it('a history row names its task and opens it', async () => {
    const session = vi.fn(async (): Promise<SessionTasksView> => ({ tasks: [task('t7', { summary: 'Ship the agents page' })], capped: false }))
    const history = vi.fn(async () => [ev(1, 'work.claimed@1', { work: 't7' }), ev(2, 'session.started@1')])
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { session }, terminal: { history } } }))
    const onOpenTask = vi.fn()
    show(<AgentPage agent={agentA} mark={0} onOpenProject={vi.fn()} onOpenTask={onOpenTask} />)
    const did = await screen.findByRole('list', { name: en['agentPage.did'] })
    await waitFor(() => expect(did.textContent).toContain('Ship the agents page'))
    fireEvent.click(within(did).getByRole('button', { name: 'Ship the agents page' }))
    expect(onOpenTask).toHaveBeenCalledWith('p1', 't7')
    expect(within(did).getAllByRole('button')).toHaveLength(1)
  })

  it('a move row and a release row name their task too (0.3.14, eventSubject)', async () => {
    const session = vi.fn(async (): Promise<SessionTasksView> => ({ tasks: [task('t8', { summary: 'Fix the board' })], capped: false }))
    const history = vi.fn(async () => [ev(1, 'task.moved@1', { task_id: 't8', to: 'review' }), ev(2, 'work.released@1', { work: 't8', how: 'done' })])
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { session }, terminal: { history } } }))
    show(<AgentPage agent={agentA} mark={0} onOpenProject={vi.fn()} onOpenTask={vi.fn()} />)
    const did = await screen.findByRole('list', { name: en['agentPage.did'] })
    await waitFor(() => expect(within(did).getAllByRole('button', { name: 'Fix the board' })).toHaveLength(2))
  })
})

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

  // 0.3.14, the simple Fabric §3: «Результаты» as event types are gone; the session card's «Открыть сессию» opens the
  // console only when pressed; the header opens the project and the task.
  it('opens its session from the session card, and its project and task from the header; no «Результаты» list', async () => {
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { session: noTasks }, terminal: { history: vi.fn(async () => [ev(1, 'task.claimed@1'), ev(2, 'task.moved@1', { to: 'done' }), ev(3, 'task.moved@1', { to: 'review' })]) } } }))
    const onConsole = vi.fn(), onOpenProject = vi.fn(), onOpenTask = vi.fn()
    show(<AgentPage agent={agentA} mark={0} onConsole={onConsole} onOpenProject={onOpenProject} onOpenTask={onOpenTask} />)
    await screen.findByRole('list', { name: en['agentPage.did'] })
    expect(screen.queryByRole('list', { name: en['agentPage.results'] })).toBeNull()
    // The mockup parity: the heading is the runner alone; the session id is in the line under it.
    expect(screen.getByRole('heading', { name: 'Claude Code' })).toBeTruthy()
    expect(document.querySelector('.as-meta')?.textContent).toContain(`${en['agentScreen.sessionWord']} s1`)
    const card = screen.getByRole('complementary', { name: en['agentScreen.session'] })
    expect(onConsole).not.toHaveBeenCalled()
    fireEvent.click(within(card).getByRole('button', { name: en['agentScreen.openSession'] }))
    fireEvent.click(screen.getByRole('button', { name: en['agentScreen.openProject'] }))
    fireEvent.click(screen.getByRole('button', { name: en['agentPage.openThisTask'] }))
    expect(onConsole).toHaveBeenCalledWith('s1')
    expect(onOpenProject).toHaveBeenCalledWith('p1')
    expect(onOpenTask).toHaveBeenCalledWith('p1', 't1')
  })

  it('an agent with no console, no task and no history says so; a failed read is said with «Retry»', async () => {
    const history = vi.fn(async (_id: string): Promise<unknown[]> => { throw new Error('database away') }).mockRejectedValueOnce(new Error('database away')).mockResolvedValueOnce([])
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { session: noTasks }, terminal: { history } } }))
    show(<AgentPage agent={agentB} mark={0} onConsole={vi.fn()} onOpenProject={vi.fn()} />)
    expect(screen.queryByRole('button', { name: en['agentScreen.openSession'] })).toBeNull()
    expect(screen.getByText(en['agentScreen.sessionElsewhere'])).toBeTruthy()
    expect(screen.getByText(en['agentPage.noTask'])).toBeTruthy()
    await screen.findByText(en['agentPage.unreadable'])
    fireEvent.click(screen.getByRole('button', { name: en['acts.retry'] }))
    await waitFor(() => expect(screen.getByText(en['agents.noHistory'])).toBeTruthy())
  })

  it('UX-16 (0.3.15 review, iteration 2): a time that does not parse leaves its clause out, never a dash or «?»', async () => {
    const bad = 'not a time'
    const session = vi.fn(async (): Promise<SessionTasksView> => ({ tasks: [
      { taskId: 't1', projectId: 'p1', projectName: 'Fabric', summary: 'Keep the computer awake', brief: { what: null, why: null, expected: null },
        status: 'review', claimedAt: bad, releasedAt: bad, releasedHow: 'done', claims: 1, via: 'claim' }
    ], capped: false }))
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { session }, terminal: { history: vi.fn(async () => []) } } }))
    const agent: LiveAgent = { ...agentA, lastSignAt: bad, startedAt: bad, doing: { ...agentA.doing!, at: bad } }
    const { container } = show(<AgentPage agent={agent} mark={0} onOpenProject={vi.fn()} onOpenTask={vi.fn()} />)
    await waitFor(() => expect(container.textContent).toContain(en['agentPage.ended.doneReview'].replace(' {time}', '')))
    expect(container.textContent).toContain(en['duration.unknown'])
    expect(container.textContent).not.toContain('\u2014')
    expect(container.textContent).not.toMatch(/ \?|\? |NaN/)
  })

  it('«Сейчас» names the task with its brief, its newest report with its step, how long it is held and its milestones', async () => {
    const t = (iso: string) => iso
    const session = vi.fn(async (): Promise<SessionTasksView> => ({ tasks: [
      { taskId: 't1', projectId: 'p1', projectName: 'Fabric', summary: 'Keep the computer awake', brief: { what: 'The Mac stays awake while an agent works', why: null, expected: null },
        status: 'running', claimedAt: new Date(Date.now() - 2 * 3600_000).toISOString(), releasedAt: null, releasedHow: null, claims: 1, via: 'claim' }
    ], capped: false }))
    const history = vi.fn(async () => [
      { ...ev(1, 'agent.stage.reported@1', { task_id: 't1', stage: 'Reading the power settings', step: 1, of_steps: 2 }), occurred_at: t(new Date(Date.now() - 3600_000).toISOString()) },
      { ...ev(2, 'agent.heartbeat@1', { phase: 'waiting', waiting_kind: 'question' }) }
    ])
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { session }, terminal: { history } } }))
    show(<AgentPage agent={agentA} mark={0} onOpenProject={vi.fn()} onOpenTask={vi.fn()} />)
    const now = screen.getByRole('region', { name: en['agentScreen.now'] })
    expect(now.textContent).toContain('Keep the computer awake')
    expect(now.textContent).toContain('step 1 of 2')
    expect(now.textContent).toContain('Making the keep-awake setting')
    await waitFor(() => expect(now.textContent).toContain('The Mac stays awake while an agent works'))
    expect(now.textContent).toContain(en['agentScreen.held'].replace('{time}', '2h'))
    await waitFor(() => expect(now.textContent).toContain('Step 1. Reading the power settings'))
    // The agent's own word on its phase, labelled as its claim.
    const card = screen.getByRole('complementary', { name: en['agentScreen.session'] })
    expect(card.textContent).toContain(en['agentScreen.claim'])
    // UX-19: what it waits on in words, never the raw code.
    expect(card.textContent).toContain(`${en['agentScreen.phase.waiting']} (${en['agentScreen.waitingOn.question']})`)
    expect(card.textContent).not.toContain('(question)')
  })

  // The operator's second review, 2026-10-26 (R-3, R-4): the goal, who set it, and «Открыть цель»; the step in «Сейчас»
  // carries its progress bar. The mockup parity, wave 1: the goal is a line inside «Сейчас», above the task, never a
  // box of its own, and a task with no goal named says nothing about it.
  it('shows the goal as a line inside «Сейчас» above the task, with who set it, and the step as progress', async () => {
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { session: noTasks }, terminal: { history: vi.fn(async () => []) } } }))
    const onOpenTask = vi.fn()
    show(<AgentPage agent={{ ...agentA, goal: { taskId: 't0', projectId: 'p1', text: 'Ship 0.3.14', what: 'The release the operator asked for', byPerson: true, isTask: false } }}
      mark={0} onOpenProject={vi.fn()} onOpenTask={onOpenTask} />)
    expect(screen.queryByRole('region', { name: en['agentScreen.goal'] })).toBeNull()
    const now = screen.getByRole('region', { name: en['agentScreen.now'] })
    const goal = now.querySelector('.as-now-goal') as HTMLElement
    expect(goal.textContent).toContain(en['agentScreen.goalLine'].replace('{goal}', 'Ship 0.3.14'))
    expect(goal.textContent).toContain(en['agentScreen.goalByPerson'])
    expect(goal.getAttribute('title')).toBe('The release the operator asked for')
    fireEvent.click(within(goal).getByRole('button', { name: en['agentScreen.openGoal'] }))
    expect(onOpenTask).toHaveBeenCalledWith('p1', 't0')
    const task = now.querySelector('.as-now-task') as HTMLElement
    expect(goal.compareDocumentPosition(task) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(now).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('1')
    cleanup()
    show(<AgentPage agent={{ ...agentA, goal: null }} mark={0} onOpenProject={vi.fn()} onOpenTask={vi.fn()} />)
    expect(screen.getByRole('region', { name: en['agentScreen.now'] }).querySelector('.as-now-goal')).toBeNull()
    expect(screen.queryByText(en['launch.home.inWork.noGoal'])).toBeNull()
  })

  // R-19: the header's chip is the status, from the console and the agent's own word.
  it('says the session\'s status in its chip: an error when its console failed, waiting when the agent says it waits', async () => {
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { session: noTasks }, terminal: { history: vi.fn(async () => []) } } }))
    show(<AgentPage agent={agentA} mark={0} onOpenProject={vi.fn()} terminal={{ state: 'ended', exitCode: 1 }} />)
    expect(document.querySelector('.as-status')?.textContent).toContain(en['status.error'])
    cleanup()
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { session: noTasks }, terminal: { history: vi.fn(async () => [ev(1, 'agent.heartbeat@1', { phase: 'waiting' })]) } } }))
    show(<AgentPage agent={agentA} mark={0} onOpenProject={vi.fn()} />)
    await waitFor(() => expect(document.querySelector('.as-status')?.textContent).toContain(en['status.waiting']))
  })

  it('a task row opens to «Чем закончил» in the agent\'s words and its «Вехи», or says there are none', async () => {
    const session = vi.fn(async (): Promise<SessionTasksView> => ({ tasks: [
      { taskId: 't5', projectId: 'p1', projectName: 'Fabric', summary: 'Nudge work without a task', brief: { what: null, why: null, expected: null },
        status: 'review', claimedAt: '2026-10-26T10:00:00Z', releasedAt: '2026-10-26T11:00:00Z', releasedHow: 'done', claims: 1, via: 'claim' },
      { taskId: 't6', projectId: 'p1', projectName: 'Fabric', summary: 'Board cards name the session', brief: { what: null, why: null, expected: null },
        status: 'review', claimedAt: '2026-10-26T08:00:00Z', releasedAt: '2026-10-26T09:00:00Z', releasedHow: 'done', claims: 1, via: 'claim' }
    ], capped: false }))
    const history = vi.fn(async () => [
      { ...ev(1, 'agent.stage.reported@1', { task_id: null, stage: 'Found the sweep', step: 2, of_steps: 3 }), occurred_at: '2026-10-26T10:30:00Z' },
      { ...ev(2, 'task.handoff@1', { task_id: 't5', name: 'report', value: 'docs/sweep.md' }), occurred_at: '2026-10-26T10:55:00Z' },
      { ...ev(3, 'work.released@1', { work: 't5', how: 'done', note: 'Counts changes between turns.' }), occurred_at: '2026-10-26T11:00:00Z' }
    ])
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { session }, terminal: { history } } }))
    show(<AgentPage agent={{ ...agentA, task: null }} mark={0} onOpenProject={vi.fn()} onOpenTask={vi.fn()} />)
    const list = await screen.findByRole('list', { name: en['agentPage.tasks'] })
    await waitFor(() => expect(list.textContent).toContain('Counts changes between turns.'))
    const [first, second] = [...list.querySelectorAll(':scope > li')] as HTMLElement[]
    expect(first.textContent).toContain(en['agentScreen.endedHow'])
    expect(first.textContent).toContain('Handed on “report”: docs/sweep.md')
    expect(first.textContent).toContain('Step 2. Found the sweep')
    expect(second.textContent).toContain(en['agentScreen.noEnding'])
    expect(second.textContent).toContain(en['agentScreen.noTaskMilestones'])
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
    // The operator's second review (R-12): in lanes, each counted; the 0.3.14 review, iteration 2, UX-20: «All» first
    // and open, every task newest first.
    const lanes = screen.getByRole('group', { name: en['agentScreen.lanes'] })
    expect(within(lanes).getAllByRole('button')[0].textContent).toContain(en['agentScreen.lane.all'])
    expect(within(lanes).getByRole('button', { name: new RegExp(`^${en['agentScreen.lane.all']}`) }).getAttribute('aria-pressed')).toBe('true')
    expect(within(lanes).getByRole('button', { name: new RegExp(`^${en['agentScreen.lane.done']}`) }).textContent).toContain('1')
    expect(within(lanes).queryByRole('button', { name: new RegExp(`^${en['agentScreen.lane.missing']}`) }), 'no «Not found» tab with nothing in it').toBeNull()
    expect(list.querySelectorAll(':scope > li')).toHaveLength(2)
    fireEvent.click(within(lanes).getByRole('button', { name: new RegExp(`^${en['agentScreen.lane.review']}`) }))
    const rows = screen.getByRole('list', { name: en['agentPage.tasks'] }).querySelectorAll(':scope > li')
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toContain('Task t2')
    expect(rows[0].querySelector('.ap-pill')?.textContent).toBe(en['agentScreen.pill.review'])
    const first = rows[0].querySelector('details')!
    expect(first.open).toBe(false)
    fireEvent.click(first.querySelector('summary')!)
    expect(first.textContent).toContain('Dead work hides live work')
    fireEvent.click(within(first as HTMLElement).getByRole('button', { name: en['agentPage.openThisTask'] }))
    expect(onOpenTask).toHaveBeenCalledWith('p1', 't2')
    // The raw history is below, closed until the person opens it.
    const history = (await screen.findByRole('list', { name: en['agentPage.did'] })).closest('details')!
    expect(history.open).toBe(false)
    expect(screen.getByRole('list', { name: en['agentPage.tasks'] }).compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    fireEvent.click(within(lanes).getByRole('button', { name: new RegExp(`^${en['agentScreen.lane.done']}`) }))
    const done = screen.getByRole('list', { name: en['agentPage.tasks'] }).querySelectorAll(':scope > li')
    expect(done).toHaveLength(1)
    expect(done[0].textContent).toContain(en['launch.home.work.untitled'])
    expect(done[0].textContent).toContain(en['agentPage.ended.done'].replace(' {time}', ''))
  })

  // The 0.3.14 review, iteration 1: UX-8, each ending in words of its own and an unknown one said as not recorded, in
  // Russian too; UX-4, the history's heading stands outside its disclosure.
  it('UX-8: an ending is said by how it ended, never «Закончил» for one the agent did not cause; an unknown ending is not shown raw', async () => {
    const ended = (how: string) => task('t' + how.length, { releasedAt: '2026-10-26T11:00:00Z', releasedHow: how })
    const session = vi.fn(async (): Promise<SessionTasksView> => ({ tasks: [ended('operator'), ended('lapsed'), ended('weird-how'), task('l1', { via: 'launch', claims: 0 })], capped: false }))
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { session }, terminal: { history: vi.fn(async () => []) } } }))
    render(<I18nProvider locale="ru"><AgentPage agent={agentA} mark={0} onOpenProject={vi.fn()} onOpenTask={vi.fn()} /></I18nProvider>)
    expect((await screen.findByRole('list', { name: ru['agentPage.tasks'] })).textContent).toContain('запущена через Fabric')
    fireEvent.click(within(screen.getByRole('group', { name: ru['agentScreen.lanes'] })).getByRole('button', { name: new RegExp(`^${ru['agentScreen.lane.handed']}`) }))
    const list = screen.getByRole('list', { name: ru['agentPage.tasks'] })
    const text = list.textContent ?? ''
    expect(text).toContain(ru['agentPage.ended.operator']!.replace(' {time}', ''))
    expect(text).toContain('как именно, не записано')
    expect(text).not.toContain('weird-how')
    expect(text).not.toContain('Закончил ')
    // UX-14: a lapsed claim is not «Передано»: it is in «Брошено», as the Board names it.
    expect(text).not.toContain(ru['agentPage.ended.lapsed']!.replace(' {time}', ''))
    fireEvent.click(within(screen.getByRole('group', { name: ru['agentScreen.lanes'] })).getByRole('button', { name: new RegExp(`^${ru['agentScreen.lane.dropped']}`) }))
    expect(screen.getByRole('list', { name: ru['agentPage.tasks'] }).textContent).toContain(ru['agentPage.ended.lapsed']!.replace(' {time}', ''))
  })

  // UX-4, then the mockup parity: the history is one muted line that opens, named for assistive technology on the
  // disclosure itself, with no heading of its own; its summary says what it opens.
  it('UX-4: the history\'s disclosure is named and says what it opens; no heading inside its summary', async () => {
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { session: vi.fn(async () => ({ tasks: [], capped: false })) }, terminal: { history: vi.fn(async () => [ev(1, 'task.claimed@1')]) } } }))
    show(<AgentPage agent={agentA} mark={0} onOpenProject={vi.fn()} onOpenTask={vi.fn()} />)
    const history = (await screen.findByRole('list', { name: en['agentPage.did'] })).closest('details')!
    expect(history.querySelector('summary h4')).toBeNull()
    expect(history.querySelector('summary')!.textContent).toBe(en['agentPage.historyOpen'])
    expect(history.getAttribute('aria-label')).toBe(en['agentScreen.history'])
    expect(screen.queryByRole('heading', { name: en['agentPage.did'] })).toBeNull()
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

// The 0.3.14 review, iteration 2.
describe('the agent page, review iteration 2 (UX-11, UX-13, ER-20, DA-4)', () => {
  it('UX-11: the history rows take the two-column grid; the rule names a class the page renders', async () => {
    const { readFileSync } = await import('node:fs')
    const path = await import('node:path')
    const css = readFileSync(path.join(process.cwd(), 'src/renderer/src/launch/launch.css'), 'utf8')
    const rule = css.match(/([^{}]*)\{grid-template-columns:52px minmax\(0,1fr\)\}/)
    expect(rule?.[1]).toMatch(/\.ap-history \.hx-act/)
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { session: noTasks }, terminal: { history: vi.fn(async () => [ev(1, 'task.claimed@1')]) } } }))
    show(<AgentPage agent={agentA} mark={0} onOpenProject={vi.fn()} />)
    await screen.findByRole('list', { name: en['agentPage.did'] })
    expect(document.querySelector('.ap-history .hx-act')).toBeTruthy()
  })

  it('UX-13: a task that is its own root is not called «Goal»; it shows once, under «Now»', () => {
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { session: noTasks }, terminal: { history: vi.fn(async () => []) } } }))
    show(<AgentPage agent={{ ...agentA, goal: { taskId: 't1', projectId: 'p1', text: 'Keep the computer awake', what: null, byPerson: false, isTask: true } }} mark={0} onOpenProject={vi.fn()} />)
    expect(screen.queryByRole('region', { name: en['agentScreen.goal'] })).toBeNull()
    expect(screen.getAllByText('Keep the computer awake')).toHaveLength(1)
    cleanup()
    // The person set it: the goal says so, and «Now» does not repeat the same task.
    show(<AgentPage agent={{ ...agentA, goal: { taskId: 't1', projectId: 'p1', text: 'Keep the computer awake', what: null, byPerson: true, isTask: true } }} mark={0} onOpenProject={vi.fn()} />)
    const goal = screen.getByRole('region', { name: en['agentScreen.now'] }).querySelector('.as-now-goal')!
    expect(goal.textContent).toContain(en['agentScreen.goalIsTask'])
    expect(goal.textContent).toContain(en['agentScreen.goalByPerson'])
    expect(screen.getAllByText('Keep the computer awake')).toHaveLength(1)
  })

  it('ER-20: a failed goals read is said where the goal would be', () => {
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { session: noTasks }, terminal: { history: vi.fn(async () => []) } } }))
    show(<AgentPage agent={agentA} goalsUnread="task_links refused" mark={0} onOpenProject={vi.fn()} />)
    expect(screen.getByRole('region', { name: en['agentScreen.now'] }).querySelector('.as-now-goal')!.textContent).toContain(en['launch.home.inWork.goalsUnread'])
  })

  it('DA-4: a task whose row was not found is in «Not found», never in «Done»', async () => {
    const session = vi.fn(async (): Promise<SessionTasksView> => ({ tasks: [
      { taskId: 'gone', projectId: 'p1', projectName: 'Fabric', summary: 'Gone', brief: { what: null, why: null, expected: null }, status: 'unknown',
        claimedAt: now, releasedAt: null, releasedHow: null, claims: 1, via: 'claim' }
    ], capped: false }))
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { session }, terminal: { history: vi.fn(async () => []) } } }))
    show(<AgentPage agent={agentA} mark={0} onOpenProject={vi.fn()} />)
    await screen.findByRole('list', { name: en['agentPage.tasks'] })
    const lanes = screen.getByRole('group', { name: en['agentScreen.lanes'] })
    expect(within(lanes).getByRole('button', { name: new RegExp(`^${en['agentScreen.lane.missing']}`) }).textContent).toContain('1')
    // Not counted as done: the mockup parity offers no chip for an empty lane, so «Done» is absent.
    expect(within(lanes).queryByRole('button', { name: new RegExp(`^${en['agentScreen.lane.done']}`) })).toBeNull()
  })
})

// The mockup parity, wave 1 (docs/reports/2026-10-27-mockup-parity/gaps/2026-10-27-agent.md).
describe('the agent page, the mockup parity (wave 1)', () => {
  const stub = (tasks: SessionTask[] = []) => vi.stubGlobal('window', Object.assign(window, {
    fabric: { work: { session: vi.fn(async () => ({ tasks, capped: false })) }, terminal: { history: vi.fn(async () => []) }, projects: { list: vi.fn(async () => []) } }
  }))
  const row = (id: string, extra: Partial<SessionTask> = {}): SessionTask => ({
    taskId: id, projectId: 'p1', projectName: 'Fabric', summary: 'Task ' + id, brief: { what: null, why: null, expected: null }, status: 'running',
    claimedAt: new Date().toISOString(), releasedAt: null, releasedHow: null, claims: 1, via: 'claim', ...extra
  })

  it('«← Home» above the header goes home; the status is a pill first in the header line, tinted by status', async () => {
    stub()
    const onHome = vi.fn()
    show(<AgentPage agent={agentA} mark={0} onOpenProject={vi.fn()} onHome={onHome} />)
    fireEvent.click(screen.getByRole('button', { name: en['agentScreen.backHome'] }))
    expect(onHome).toHaveBeenCalled()
    const meta = document.querySelector('.as-meta')!
    expect(meta.firstElementChild?.classList.contains('as-status')).toBe(true)
    expect(meta.firstElementChild?.className).toContain('s-working')
    expect(meta.textContent).toContain(`${en['agentScreen.projectWord']} Fabric`)
    cleanup()
    // No way home given: no dead link.
    stub()
    show(<AgentPage agent={agentA} mark={0} onOpenProject={vi.fn()} />)
    expect(screen.queryByRole('button', { name: en['agentScreen.backHome'] })).toBeNull()
  })

  it('«Сейчас» always names the task, even when the goal is the task the agent split from itself', () => {
    stub()
    show(<AgentPage agent={{ ...agentA, goal: { taskId: 't1', projectId: 'p1', text: 'Keep the computer awake', what: null, byPerson: false, isTask: true } }} mark={0} onOpenProject={vi.fn()} />)
    const now = screen.getByRole('region', { name: en['agentScreen.now'] })
    expect(now.querySelector('.as-now-task')?.textContent).toBe('Keep the computer awake')
    expect(now.querySelector('.as-now-goal')).toBeNull()
  })

  it('a task row: the status as a pill, the meta in lower case with «at» for today, the agent\'s own project not repeated', async () => {
    stub([row('t1'), row('t2', { status: 'review', releasedAt: new Date().toISOString(), releasedHow: 'done', projectId: 'p9', projectName: 'Site' })])
    show(<AgentPage agent={agentA} mark={0} onOpenProject={vi.fn()} onOpenTask={vi.fn()} />)
    const list = await screen.findByRole('list', { name: en['agentPage.tasks'] })
    const [first, second] = [...list.querySelectorAll(':scope > li')] as HTMLElement[]
    expect(first.querySelector('.ap-pill')?.textContent).toBe(en['agentScreen.pill.inWork'])
    expect(first.querySelector('.ap-pill')?.className).toContain('l-inWork')
    const meta = first.querySelector('.ap-task-meta')!.textContent!
    expect(meta.startsWith('taken at ')).toBe(true)
    expect(meta).not.toContain('Fabric')
    expect(second.querySelector('.ap-task-meta')!.textContent).toContain('Site')
    expect(second.querySelector('.ap-task-meta')!.textContent).toContain('handed in for review at ')
    // The chevron leads the summary.
    expect(first.querySelector('summary')!.firstElementChild?.classList.contains('ap-chev')).toBe(true)
    expect(screen.getByText(en['agentPage.tasksSub'].replace('{count}', '2'))).toBeTruthy()
  })

  it('«Нужна правка в другом проекте» in a task row opens the panel inline and closes it again', async () => {
    stub([row('t1')])
    show(<AgentPage agent={agentA} mark={0} onOpenProject={vi.fn()} onOpenTask={vi.fn()} projectOf={(id) => (id === 'p1' ? { id: 'p1', name: 'Fabric' } : null)} />)
    const list = await screen.findByRole('list', { name: en['agentPage.tasks'] })
    const toggle = within(list).getByRole('button', { name: en['xp.title'] })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(within(list).getByRole('group', { name: en['xp.title'] })).toBeTruthy()
    fireEvent.click(toggle)
    expect(within(list).queryByRole('group', { name: en['xp.title'] })).toBeNull()
    cleanup()
    // No project row in hand: the action is not offered.
    stub([row('t1')])
    show(<AgentPage agent={agentA} mark={0} onOpenProject={vi.fn()} onOpenTask={vi.fn()} />)
    expect(within(await screen.findByRole('list', { name: en['agentPage.tasks'] })).queryByRole('button', { name: en['xp.title'] })).toBeNull()
  })

  it('the session card: «Агент» with the version and, for a console in Fabric, the permission mode; started today in words', () => {
    stub()
    show(<AgentPage agent={agentA} mark={0} onOpenProject={vi.fn()} runnerVersion="2.4.1" permission="bypass" where="fabric" />)
    const card = screen.getByRole('complementary', { name: en['agentScreen.session'] })
    expect(card.textContent).toContain(`${en['agentScreen.agentLabel']}Claude Code 2.4.1 · ${en['agentScreen.permission.bypass']}`)
    expect(card.textContent).toContain('today at ')
    expect(card.querySelector('.as-status')).toBeTruthy()
    cleanup()
    stub()
    // A terminal outside Fabric: the version alone; nothing known: no «Agent» row.
    show(<AgentPage agent={agentA} mark={0} onOpenProject={vi.fn()} runnerVersion="2.4.1" permission="bypass" where="terminal" />)
    expect(screen.getByRole('complementary', { name: en['agentScreen.session'] }).textContent).not.toContain(en['agentScreen.permission.bypass'])
    cleanup()
    stub()
    show(<AgentPage agent={agentA} mark={0} onOpenProject={vi.fn()} />)
    expect(screen.getByRole('complementary', { name: en['agentScreen.session'] }).textContent).not.toContain(en['agentScreen.agentLabel'])
  })

  it('heads «Сейчас» and each task card with the task\'s title, its «what» the muted line; an old task\'s ending from its release note; the runner\'s version from the read', async () => {
    const tasks = [
      row('t1', { title: 'Keep-awake setting', summary: 'Keep the computer awake while an agent works', brief: { what: 'Keep the computer awake while an agent works', why: null, expected: null } }),
      row('t9', { title: 'Old release', summary: 'Ship it', status: 'review', releasedAt: new Date().toISOString(), releasedHow: 'done', releaseNote: 'Shipped; tests green.' })
    ]
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { session: vi.fn(async () => ({ tasks, capped: false, runner: { id: 'claude-code', label: 'Claude Code', version: '2.4.1' } })) },
      terminal: { history: vi.fn(async () => []) } } }))
    const agent = { ...agentA, task: { id: 't1', projectId: 'p1', summary: 'Keep the computer awake while an agent works', title: 'Keep-awake setting', what: 'Keep the computer awake while an agent works' } }
    const { container } = show(<AgentPage agent={agent} mark={0} onOpenProject={vi.fn()} where="terminal" />)
    expect(container.querySelector('.as-now-task')?.textContent).toBe('Keep-awake setting')
    expect(container.querySelector('.as-now-what')?.textContent).toBe('Keep the computer awake while an agent works')
    const list = await screen.findByRole('list', { name: en['agentPage.tasks'] })
    expect([...list.querySelectorAll('.ap-task-title')].map((b) => b.textContent)).toEqual(['Keep-awake setting', 'Old release'])
    expect(list.textContent).toContain('Shipped; tests green.')
    await waitFor(() => expect(screen.getByRole('complementary', { name: en['agentScreen.session'] }).textContent).toContain('Claude Code 2.4.1'))
  })

  it('«Вопросы этого агента»: not read is said as such, never «none»; read and empty says none; read shows each as a «Нужны вы» card with its answers', async () => {
    stub()
    show(<AgentPage agent={agentA} mark={0} onOpenProject={vi.fn()} />)
    const q = () => screen.getByRole('region', { name: en['agentScreen.questions'] })
    // An older session read with no questions in it: not read, never «none».
    await waitFor(() => expect(q().textContent).toContain(en['agentScreen.questionsNotRead']))
    expect(q().textContent).not.toContain(en['agentScreen.questionsNone'])
    cleanup()
    const view = (over: Partial<SessionTasksView>) => vi.fn(async (_id: string): Promise<SessionTasksView> => ({ tasks: [], capped: false, ...over }))
    const answer = vi.fn(async (_input: unknown) => ({ committed: true, repeated: false, unblocked: [], stillBlocked: [], continuations: [] }))
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { session: view({ questions: [] }) }, terminal: { history: vi.fn(async () => []) }, questions: { answer } } }))
    show(<AgentPage agent={agentA} mark={0} onOpenProject={vi.fn()} />)
    await waitFor(() => expect(q().textContent).toContain(en['agentScreen.questionsNone']))
    cleanup()
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { session: view({ questions: [{ id: 'q1', projectId: agentA.projectId, taskId: null, text: 'Delete three containers?',
      why: 'Only a new start of the stack brings them back.', kind: 'decision', options: [{ id: 'del', label: 'Delete' }, { id: 'keep', label: 'Keep' }], askedAt: new Date().toISOString(), revision: 4 }] }) },
      terminal: { history: vi.fn(async () => []) }, questions: { answer } } }))
    show(<AgentPage agent={agentA} mark={0} onOpenProject={vi.fn()} />)
    const card = await within(q()).findByRole('article', { name: 'Delete three containers?' })
    expect(card.textContent).toContain('Only a new start of the stack brings them back.')
    expect(within(card).getByRole('button', { name: 'Delete' }).className).toContain('gold')
    fireEvent.click(within(card).getByRole('button', { name: 'Keep' }))
    await waitFor(() => expect(answer).toHaveBeenCalled())
    expect(answer.mock.calls[0]?.[0]).toMatchObject({ questionId: 'q1', expectedRevision: 4, chosenOption: 'keep' })
    cleanup()
    // A failed read of the questions is said as not read, with its reason on hover.
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { session: view({ questionsUnread: 'away' }) }, terminal: { history: vi.fn(async () => []) } } }))
    show(<AgentPage agent={agentA} mark={0} onOpenProject={vi.fn()} />)
    await waitFor(() => expect(within(q()).getByTitle('away').textContent).toBe(en['agentScreen.questionsNotRead']))
  })
})

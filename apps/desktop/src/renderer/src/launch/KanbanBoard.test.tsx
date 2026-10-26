// The Board screen's kanban (the operator's walk OF-19, SCN-173, D-1): four columns of Fabric's ladder, scrolling
// sideways and down, filtered by project and agent.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { KanbanBoard } from './KanbanBoard'
import type { TaskBoardView } from '../../../shared/taskBoard'

const board: TaskBoardView = {
  columns: [
    { stage: 'backlog', capped: false, cards: [{ taskId: 'q1', projectId: 'p2', projectName: 'Site', summary: 'Dark theme', agent: null, since: null }] },
    { stage: 'running', capped: false, cards: [{ taskId: 'r1', projectId: 'p1', projectName: 'Fabric', summary: 'New home', agent: 'claude-code', since: null }] },
    { stage: 'review', capped: true, cards: [{ taskId: 'v1', projectId: 'p2', projectName: 'Site', summary: 'Landing copy', agent: null, since: null }] },
    { stage: 'done', capped: false, cards: [] }
  ],
  projects: [{ id: 'p1', name: 'Fabric' }, { id: 'p2', name: 'Site' }],
  readAt: '2026-10-23T00:00:00Z'
}
const install = (read: () => Promise<unknown>) => vi.stubGlobal('window', Object.assign(window, { fabric: { work: { board: vi.fn(read) } } }))
const show = (props: Partial<Parameters<typeof KanbanBoard>[0]> = {}) =>
  render(<I18nProvider locale="en"><KanbanBoard feedMark={0} onOpen={vi.fn()} {...props} /></I18nProvider>)

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('the kanban board', () => {
  it('shows the four columns in the ladder\'s order with their counts, and a capped one as a floor', async () => {
    install(async () => board)
    const { container } = show()
    await waitFor(() => expect(screen.getByText('New home')).toBeTruthy())
    const heads = [...container.querySelectorAll('.lk-col h3')].map((h) => h.textContent)
    expect(heads).toEqual([`${en['launch.kanban.backlog']} 1`, `${en['launch.kanban.running']} 1`, `${en['launch.kanban.review']} 1+`, `${en['launch.kanban.done']} 0`])
    expect(container.querySelector('.lk-board')).toBeTruthy()
  })
  it('narrows to one project, or to the project it is opened for', async () => {
    install(async () => board)
    show()
    await waitFor(() => expect(screen.getByText('Dark theme')).toBeTruthy())
    fireEvent.change(screen.getByLabelText(en['launch.kanban.project']), { target: { value: 'p1' } })
    expect(screen.queryByText('Dark theme')).toBeNull()
    expect(screen.getByText('New home')).toBeTruthy()
    cleanup()
    install(async () => board)
    show({ projectId: 'p2' })
    await waitFor(() => expect(screen.getByText('Dark theme')).toBeTruthy())
    expect(screen.queryByText('New home')).toBeNull()
  })
  it('opens a card\'s task in its project, and says in our words when the board cannot be read', async () => {
    install(async () => board)
    const onOpen = vi.fn()
    show({ onOpen })
    fireEvent.click(await waitFor(() => screen.getByText('Landing copy')))
    expect(onOpen).toHaveBeenCalledWith('p2', 'v1')
    cleanup()
    install(async () => { throw new Error('the queue could not be read: timeout') })
    show()
    await waitFor(() => expect(screen.getByText(en['launch.kanban.unreadable'])).toBeTruthy())
  })
})

describe('the kanban, after the 0.3.11 review', () => {
  it('reads one project\'s tasks for a project\'s board, filtered in the query (DA-2)', async () => {
    install(async () => board)
    show({ projectId: 'p2' })
    await waitFor(() => expect(screen.getByText('Dark theme')).toBeTruthy())
    expect((window as unknown as { fabric: { work: { board: ReturnType<typeof vi.fn> } } }).fabric.work.board).toHaveBeenCalledWith('p2')
  })
  it('drops a project filter whose project left the list, rather than emptying every column (ER-10)', async () => {
    let view = board
    install(async () => view)
    const { rerender } = show()
    await waitFor(() => expect(screen.getByText('New home')).toBeTruthy())
    fireEvent.change(screen.getByLabelText(en['launch.kanban.project']), { target: { value: 'p1' } })
    expect(screen.queryByText('Dark theme')).toBeNull()
    view = { ...board, projects: [{ id: 'p2', name: 'Site' }] }
    rerender(<I18nProvider locale="en"><KanbanBoard feedMark={1} onOpen={vi.fn()} /></I18nProvider>)
    await waitFor(() => expect(screen.getByText('Dark theme')).toBeTruthy())
  })
  it('says a column it could not read, never «Empty», and its count is unknown (ER-5)', async () => {
    install(async () => ({ ...board, columns: board.columns.map((c) => (c.stage === 'done' ? { ...c, unread: 'timeout' } : c)) }))
    const { container } = show()
    await waitFor(() => expect(screen.getByText(/timeout/)).toBeTruthy())
    const done = [...container.querySelectorAll('.lk-col h3')].at(-1)!
    expect(done.textContent).toMatch(/\?/)
    expect(done.textContent).not.toMatch(/\b0\b/)
  })
  it('drops a filter whose project left, so it does not come back by itself (iteration 3, ER-4)', async () => {
    let view = board
    install(async () => view)
    const { rerender } = show()
    await waitFor(() => expect(screen.getByText('New home')).toBeTruthy())
    fireEvent.change(screen.getByLabelText(en['launch.kanban.project']), { target: { value: 'p1' } })
    view = { ...board, projects: [{ id: 'p2', name: 'Site' }] }
    rerender(<I18nProvider locale="en"><KanbanBoard feedMark={1} onOpen={vi.fn()} /></I18nProvider>)
    await waitFor(() => expect(screen.getByText('Dark theme')).toBeTruthy())
    view = board
    rerender(<I18nProvider locale="en"><KanbanBoard feedMark={2} onOpen={vi.fn()} /></I18nProvider>)
    await waitFor(() => expect(screen.getByText('New home')).toBeTruthy())
    expect(screen.getByText('Dark theme')).toBeTruthy()
  })
})

describe('a task whose spec is not gathered says so on its card (ADR-0176 §1, SCN-176)', () => {
  it('marks only the cards the read flagged', async () => {
    const flagged: TaskBoardView = {
      ...board,
      columns: [
        { stage: 'backlog', capped: false, cards: [{ taskId: 'q1', projectId: 'p2', projectName: 'Site', summary: 'Dark theme', agent: null, since: null, specMissing: true }] },
        { stage: 'running', capped: false, cards: [{ taskId: 'r1', projectId: 'p1', projectName: 'Fabric', summary: 'New home', agent: 'claude-code', since: null, specMissing: false }] },
        { stage: 'review', capped: false, cards: [] },
        { stage: 'done', capped: false, cards: [] }
      ]
    }
    install(async () => flagged)
    show()
    const queued = await waitFor(() => screen.getByText('Dark theme').closest('button') as HTMLElement)
    expect(queued.textContent).toContain(en['launch.kanban.specMissing'])
    expect((screen.getByText('New home').closest('button') as HTMLElement).textContent).not.toContain(en['launch.kanban.specMissing'])
  })
})

describe('the Board\'s agent filter, «Отменено» and remembered filters (CO-401)', () => {
  const withCancelled: TaskBoardView = { ...board, cancelled: { capped: false, cards: [{ taskId: 'c1', projectId: 'p1', projectName: 'Fabric', summary: 'Old idea', agent: null, since: null }] } }
  it('filters by agent, shows cancelled tasks as a fifth column only when asked, and keeps every choice', async () => {
    install(async () => withCancelled)
    const onRemember = vi.fn()
    show({ onRemember })
    await waitFor(() => expect(screen.getByText('New home')).toBeTruthy())
    expect(screen.queryByText('Old idea')).toBeNull()
    fireEvent.change(screen.getByLabelText(en['launch.kanban.agent']), { target: { value: 'claude-code' } })
    // 0.3.12 review ER-9: only «In work» records an agent, so only it is filtered; the queue and review stay whole and the
    // filter says why, rather than reading as «Empty».
    expect(screen.getByText('Dark theme')).toBeTruthy()
    expect(screen.getByText('Landing copy')).toBeTruthy()
    expect(screen.getByText(en['launch.kanban.agentOnlyRunning'])).toBeTruthy()
    expect(screen.getByText('New home')).toBeTruthy()
    expect(onRemember).toHaveBeenLastCalledWith({ project: null, agent: 'claude-code', cancelled: false })
    fireEvent.change(screen.getByLabelText(en['launch.kanban.agent']), { target: { value: '' } })
    expect(screen.queryByText(en['launch.kanban.agentOnlyRunning'])).toBeNull()
    fireEvent.click(screen.getByLabelText(en['launch.kanban.showCancelled']))
    expect(screen.getByRole('region', { name: en['launch.kanban.cancelled'] }).textContent).toContain('Old idea')
    expect(onRemember).toHaveBeenLastCalledWith({ project: null, agent: null, cancelled: true })
  })
  it('opens with the remembered filters; a project\'s own board never writes its project into them', async () => {
    install(async () => withCancelled)
    const onRemember = vi.fn()
    show({ remembered: { project: 'p2', agent: null, cancelled: true }, projectId: 'p1', onRemember })
    await waitFor(() => expect(screen.getByText('New home')).toBeTruthy())
    expect(screen.getByRole('region', { name: en['launch.kanban.cancelled'] })).toBeTruthy()
    fireEvent.click(screen.getByLabelText(en['launch.kanban.showCancelled']))
    expect(onRemember).toHaveBeenLastCalledWith({ project: 'p2', agent: null, cancelled: false })
  })
  it('a reading without the cancelled tasks says so in their column, never an empty one', async () => {
    install(async () => board)
    show({ remembered: { project: null, agent: null, cancelled: true } })
    expect((await screen.findByRole('region', { name: en['launch.kanban.cancelled'] })).textContent).toContain(en['launch.kanban.cancelledUnread'])
  })
})

// 0.3.14 (the operator, 2026-10-26): a card in work names its session and opens its agent; dead work is «Abandoned», apart
// and not counted in «In work»; «Done» pages beyond its first 20.
describe('the board\'s agents, abandoned work and finished pages (0.3.14)', () => {
  const withWork: TaskBoardView = {
    ...board,
    columns: board.columns.map((c) => c.stage === 'running' ? { ...c, cards: c.cards.map((x) => ({ ...x, sessionId: '0a1b2c3d-1111-4222-8333-444444444444' })) } : c.stage === 'done' ? { ...c, capped: true, cards: [{ taskId: 'd1', projectId: 'p1', projectName: 'Fabric', summary: 'Shipped', agent: null, since: null }] } : c),
    abandoned: [{ taskId: 'a1', projectId: 'p1', projectName: 'Fabric', summary: 'Left behind', agent: 'codex', sessionId: null, since: null }]
  }
  it('a running card names its session and opens its agent, apart from opening the task', async () => {
    install(async () => withWork)
    const onOpen = vi.fn(), onAgent = vi.fn()
    show({ onOpen, onAgent })
    const agent = await screen.findByRole('button', { name: en['launch.kanban.openAgent'].replace('{id}', '0a1b2c3d') })
    expect(agent.textContent).toContain(en['launch.kanban.session'].replace('{id}', '0a1b2c3d'))
    fireEvent.click(agent)
    expect(onAgent).toHaveBeenCalledWith('0a1b2c3d-1111-4222-8333-444444444444')
    expect(onOpen).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('New home'))
    expect(onOpen).toHaveBeenCalledWith('p1', 'r1')
  })
  it('abandoned work is its own column after «In work», not counted there', async () => {
    install(async () => withWork)
    const { container } = show()
    await waitFor(() => expect(screen.getByText('Left behind')).toBeTruthy())
    const heads = [...container.querySelectorAll('.lk-col h3')].map((h) => h.textContent)
    expect(heads.slice(0, 3)).toEqual([`${en['launch.kanban.backlog']} 1`, `${en['launch.kanban.running']} 1`, `${en['launch.kanban.abandoned']} 1`])
  })
  it('«Done» reads 20 more when its first page was cut', async () => {
    install(async () => withWork)
    show()
    const more = await screen.findByRole('button', { name: en['launch.kanban.more'].replace('{count}', '20') })
    fireEvent.click(more)
    const read = (window as unknown as { fabric: { work: { board: ReturnType<typeof vi.fn> } } }).fabric.work.board
    await waitFor(() => expect(read).toHaveBeenLastCalledWith(null, 40))
  })
})

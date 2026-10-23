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

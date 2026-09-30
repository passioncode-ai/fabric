import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ProjectLaunch } from './ProjectLaunch'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { boardEntries, cutBoard } from '../../../shared/board'
import { envelope } from '../../../shared/readEnvelope'
import type { ProjectRow, TaskRow } from '../../../shared/types'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const STAMP = '2026-09-11T00:00:00Z'
const project = { id: 'p1', name: 'Atlas', purpose: 'Team access without losing context', repo_path: null, status: 'active' } as unknown as ProjectRow
const question = { id: 'q-1', projectId: 'p1', projectName: 'Atlas', text: 'Which context goes to the next agent?', kind: 'decision' as const,
  askedAt: '2026-09-10T00:00:00Z', blocks: 1, servesActiveGoal: false, revision: 1, options: [] }
const boardWith = (questions: typeof question[], sources = [{ name: 'questions', status: 'ok' as const, asOf: STAMP }]) => envelope({
  data: cutBoard(boardEntries({ questions, attention: [], projectWeightOf: () => 1, now: new Date(STAMP) }), 10), sources, asOf: STAMP, freshness: 'fresh'
})
const task = (id: string, title: string, status = 'running') => ({ id, title, instruction: title, status }) as unknown as TaskRow

function mount({ board = boardWith([question]), tasks = [task('t-1', 'Keep the invite after sign-in')] as TaskRow[] | null,
  goals = [{ id: 'g1', project_id: 'p1', title: 'Launch team access', autonomy: 'safe', created_at: STAMP }], agents = [] as unknown[] } = {}) {
  const query = vi.fn(async () => board)
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, {
    fabric: { board: { query }, goals: { list: vi.fn(async () => goals) }, agents: { list: vi.fn(async () => agents) } }
  }))
  const on = { onBoard: vi.fn(), onPlan: vi.fn(), onOpenTask: vi.fn(), onNewTask: vi.fn(), onSection: vi.fn() }
  render(
    <I18nProvider locale="en">
      <ProjectLaunch project={project} tasks={tasks} sessions={[]} feedMark={0} lastEventAt={null} {...on} />
    </I18nProvider>
  )
  return { query, ...on }
}

describe('the top of a project (SCR-31/SCR-03)', () => {
  it('reads THIS project\'s board, and the next step is its first question, opened on the Board', async () => {
    const { query, onBoard } = mount()
    await waitFor(() => expect(screen.getByText(en['launch.project.attention'].replace('{count}', '1'))).toBeTruthy())
    expect(query).toHaveBeenCalledWith({ projectId: 'p1', limit: 10 })
    fireEvent.click(screen.getByRole('button', { name: en['launch.project.review'] }))
    // The row's own address, as the producer composes it — the Board opens exactly this row.
    expect(onBoard).toHaveBeenCalledWith(boardWith([question]).data!.items[0].ref)
  })

  it('with nothing waiting and no tasks, the next step is the first result — not a calm claim', async () => {
    const { onNewTask } = mount({ board: boardWith([]), tasks: [] })
    await waitFor(() => expect(screen.getByText(en['launch.project.firstResult'])).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: en['launch.project.writeTask'] }))
    expect(onNewTask).toHaveBeenCalled()
  })

  it('unread tasks are said to be reading, never "no tasks"', async () => {
    mount({ tasks: null })
    await waitFor(() => expect(screen.getAllByText(en['estate.reading']).length).toBeGreaterThan(0))
    expect(screen.queryByText(en['launch.project.noTasks'])).toBeNull()
  })

  it('a partial board read is said, and is not a clear board', async () => {
    mount({ board: boardWith([], [{ name: 'questions', status: 'ok', asOf: STAMP }, { name: 'obligations/refusals', status: 'error', asOf: null, errorCode: 'denied' } as never]) })
    await waitFor(() => expect(screen.getByText(/obligations\/refusals/)).toBeTruthy())
    expect(screen.queryByText(en['launch.home.board.clear'])).toBeNull()
  })

  it('shows the recorded goal, the team, and a task row that opens its task', async () => {
    const { onOpenTask, onSection } = mount({ agents: [{ id: 'a1', project_id: 'p1', name: 'Builder', runner_id: 'claude-code' }] })
    await waitFor(() => expect(screen.getByText('Launch team access')).toBeTruthy())
    await waitFor(() => expect(screen.getByText('Builder')).toBeTruthy())
    fireEvent.click(screen.getByText('Keep the invite after sign-in'))
    expect(onOpenTask).toHaveBeenCalledWith('t-1')
    fireEvent.click(screen.getByRole('button', { name: en['launch.project.setupTeam'] }))
    expect(onSection).toHaveBeenCalledWith('sec-agents')
  })
})

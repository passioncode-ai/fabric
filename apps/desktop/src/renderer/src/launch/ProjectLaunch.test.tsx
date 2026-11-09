import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
const task = (id: string, title: string, status = 'running', over: Record<string, unknown> = {}) =>
  ({ id, title, instruction: title, status, started_at: STAMP, finished_at: null, moved_at: null, position: null, brief_what: null, ...over }) as unknown as TaskRow
const NOW = new Date().toISOString()
/** The home's reading for this project: one agent at work on t-1, in its own words. */
const homeView = {
  live: [{ sessionId: 's1', projectId: 'p1', projectName: 'Atlas', agent: 'claude-code', console: true, startedAt: NOW, lastSignAt: NOW, stale: false,
    doing: { text: 'Shipping the invite fix', note: null, step: 1, ofSteps: 2, at: NOW }, task: { id: 't-1', summary: 'Keep the invite after sign-in' } }],
  inWork: [{ taskId: 't-1', projectId: 'p1', projectName: 'Atlas', summary: 'Keep the invite after sign-in', agent: 'claude-code', sessionId: 's1', console: true, since: NOW,
    doing: { text: 'Shipping the invite fix', note: null, step: 1, ofSteps: 2, at: NOW } }],
  review: [],
  projects: [{ projectId: 'p1', now: { text: 'Shipping the invite fix', agent: 'claude-code', at: NOW }, live: 1, inWork: 1, review: 0, lastActivityAt: NOW }],
  readAt: NOW
}

function mount({ board = boardWith([question]), tasks = [task('t-1', 'Keep the invite after sign-in')] as TaskRow[] | null,
  goals = [{ id: 'g1', project_id: 'p1', title: 'Launch team access', autonomy: 'safe', created_at: STAMP }], agents = [] as unknown[],
  agentsList, boardQuery, requests, sources }: { board?: ReturnType<typeof boardWith>; tasks?: TaskRow[] | null; goals?: unknown[]; agents?: unknown[];
  agentsList?: () => Promise<unknown>; boardQuery?: () => Promise<unknown>; requests?: () => Promise<unknown>; sources?: () => Promise<unknown> } = {}) {
  const query = vi.fn(boardQuery ?? (async () => board))
  const openSession = vi.fn(async () => {})
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, {
    fabric: { board: { query }, goals: { list: vi.fn(async () => goals) }, projects: { analytics: vi.fn(async () => ({ donePerWeek: [0,0,0,0,0,0,0,0], leadHours: null, reviewHours: null, reopenedShare: null, questionsWaiting: 0, oldestQuestionAt: null, weeks: 8 })), relations: vi.fn(async () => []), people: vi.fn(async () => ({ people: [], unread: [] })), setBusiness: vi.fn(), onboard: vi.fn() }, agents: { list: vi.fn(agentsList ?? (async () => agents)) }, work: { home: vi.fn(async () => homeView), sources: vi.fn(sources ?? (async () => ({ sources: [], capped: false }))) },
      comms: { projectRequests: vi.fn(requests ?? (async () => ({ requests: [], names: {}, capped: false, windowDays: 30 }))) },
      windows: { openSession } }
  }))
  const on = { onBoard: vi.fn(), onPlan: vi.fn(), onOpenTask: vi.fn(), onOpenRequest: vi.fn(), onNewTask: vi.fn(), onSection: vi.fn() }
  render(
    <I18nProvider locale="en">
      <ProjectLaunch project={project} tasks={tasks} sessions={[]} feedMark={0} lastEventAt={null} {...on} />
    </I18nProvider>
  )
  return { query, openSession, ...on }
}

describe('the top of a project (SCR-31/SCR-03)', () => {
  // 0.3.12 review UX-11: the keyboard's way to a project's graph, now that the rail's mark is not a tab stop.
  it('offers the graph around the project from its heading', async () => {
    mount()
    cleanup()
    const onGraph = vi.fn()
    render(<I18nProvider locale="en"><ProjectLaunch project={project} tasks={[]} sessions={[]} feedMark={0} lastEventAt={null} onBoard={vi.fn()} onPlan={vi.fn()} onOpenTask={vi.fn()} onNewTask={vi.fn()} onSection={vi.fn()} onGraph={onGraph} /></I18nProvider>)
    fireEvent.click(screen.getByRole('button', { name: en['launch.project.graph'] }))
    expect(onGraph).toHaveBeenCalled()
  })
  it('reads THIS project\'s board, and the next step is its first question, opened on the Board', async () => {
    const { query, onBoard } = mount()
    await waitFor(() => expect(screen.getByText(en['launch.project.questions'])).toBeTruthy())
    await waitFor(() => expect(screen.getByText(question.text)).toBeTruthy())
    expect(query).toHaveBeenCalledWith({ projectId: 'p1', limit: 10, personOnly: true })
    fireEvent.click(screen.getByRole('button', { name: en['launch.project.review'] }))
    // The row's own address, as the producer composes it — the Board opens exactly this row.
    expect(onBoard).toHaveBeenCalledWith(boardWith([question]).data!.items[0].ref)
  })

  // 0.3.12 review, iteration 3, UX-1: «Вопросы ко мне» counted the whole board (5) while the rail beside it counted the
  // person's part (2), and listed a proposal and two reviews as questions.
  it('«Questions for you» is the person\'s part; the project\'s reviews and proposals are a count that opens «To review»', async () => {
    const att = (kind: 'review' | 'proposal', id: string) => ({ kind, ref: kind === 'review' ? { kind: 'task', id } : { kind: 'proposal', id }, projectId: 'p1', projectName: 'Atlas',
      title: kind + ' ' + id, detail: null, since: STAMP, ...(kind === 'proposal' ? { proposal: { id, depth: 1, bound: 3 } } : {}) })
    const entries = boardEntries({ questions: [question, { ...question, id: 'q-2', text: 'Second question' }], attention: [att('review', 'r1'), att('review', 'r2'), att('proposal', 'pr1')] as never,
      projectWeightOf: () => 1, now: new Date(STAMP) })
    const { PERSON_KINDS } = await import('../../../shared/board')
    const boardQuery = async (q?: unknown) => envelope({ data: cutBoard((q as { personOnly?: boolean }).personOnly ? entries.filter((e) => PERSON_KINDS.has(e.kind)) : entries, (q as { limit: number }).limit),
      sources: [{ name: 'questions', status: 'ok' as const, asOf: STAMP }], asOf: STAMP, freshness: 'fresh' as const })
    const onReview = vi.fn()
    mount({ boardQuery: boardQuery as () => Promise<unknown> })
    cleanup()
    render(<I18nProvider locale="en"><ProjectLaunch project={project} tasks={[]} sessions={[]} feedMark={0} lastEventAt={null} onBoard={vi.fn()} onReview={onReview} onPlan={vi.fn()} onOpenTask={vi.fn()} onNewTask={vi.fn()} onSection={vi.fn()} /></I18nProvider>)
    const panel = (await screen.findByText(en['launch.project.questions'])).closest('section')!
    await waitFor(() => expect(within(panel).getByText('Second question')).toBeTruthy())
    expect(within(panel).getByText('2', { selector: '.lp-pill' })).toBeTruthy()
    expect(within(panel).queryByText(/review r1|proposal pr1/)).toBeNull()
    fireEvent.click(await within(panel).findByRole('button', { name: en['launch.project.toReview'].replace('{count}', '3') }))
    expect(onReview).toHaveBeenCalled()
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
    // The goal is said once, in the way's «Next» (0.3.6 review i3 UX-4); no second goal panel beside it.
    await waitFor(() => expect(screen.getByText(en['launch.project.way.goal'].replace('{goal}', 'Launch team access'))).toBeTruthy())
    expect(screen.queryByText('Launch team access')).toBeNull()
    await waitFor(() => expect(screen.getByText('Builder')).toBeTruthy())
    fireEvent.click(screen.getAllByText('Keep the invite after sign-in')[0])
    expect(onOpenTask).toHaveBeenCalledWith('t-1')
    fireEvent.click(screen.getByRole('button', { name: en['launch.project.setupTeam'] }))
    expect(onSection).toHaveBeenCalledWith('sec-agents')
  })

  it('says where the project came from, where it is and where it goes — in the agents\' own words', async () => {
    const { onOpenTask, openSession } = mount({ tasks: [
      task('t-1', 'Keep the invite after sign-in'),
      task('t-0', 'Email sign-in', 'done', { finished_at: '2026-09-10T00:00:00Z', brief_what: 'People sign in with their email' }),
      task('t-2', 'Team roles', 'backlog', { position: 1 })
    ] })
    await waitFor(() => expect(screen.getByText(en['launch.project.nowLine'].replace('{text}', 'Shipping the invite fix'))).toBeTruthy())
    const step = (key: 'launch.project.way.from' | 'launch.project.way.now' | 'launch.project.way.next') => within(screen.getByText(en[key]).closest('.lp-way-step') as HTMLElement)
    expect(step('launch.project.way.from').getByText('People sign in with their email')).toBeTruthy()
    expect(step('launch.project.way.now').getByText('Shipping the invite fix')).toBeTruthy()
    expect(step('launch.project.way.next').getByText(en['launch.project.way.goal'].replace('{goal}', 'Launch team access'))).toBeTruthy()
    expect(step('launch.project.way.next').getByText('Team roles')).toBeTruthy()
    // SCN-181: the board glance is replaced by the directions of work; every task here predates origins, so «From you»,
    // and the task finished on 2026-09-10 is older than a week, so it has left the rows (it stays in «From»).
    await waitFor(() => expect(screen.getByText(en['launch.project.directions.row.fromYou']).querySelector('.lp-count')?.textContent).toBe('2'))
    expect(screen.queryByText(en['launch.project.glance.title'])).toBeNull()
    fireEvent.click(screen.getAllByText('Team roles')[0])
    expect(onOpenTask).toHaveBeenCalledWith('t-2')
    // This project's agent, opened in the console Fabric holds.
    expect(screen.getByText(en['launch.project.agentsHere'])).toBeTruthy()
    fireEvent.click(screen.getByTitle(en['launch.home.agents.openConsole']))
    expect(openSession).toHaveBeenCalledWith('s1')
  })

})

describe('a failure on the project page is our sentence, the machine\'s words apart (UX-5)', () => {
  it('a console that does not open, and a team that cannot be read', async () => {
    const { openSession } = mount({ agentsList: async () => { throw new Error('permission denied for table agents') } })
    const team = await screen.findByText(en['launch.project.teamUnreadable'])
    expect(team.textContent).not.toContain('permission denied')
    expect(screen.getByText('permission denied for table agents')).toBeTruthy()
    openSession.mockRejectedValueOnce(new Error('no window for session s1'))
    fireEvent.click(await screen.findByTitle(en['launch.home.agents.openConsole']))
    const consoleSaid = await screen.findByText(en['launch.home.agents.consoleFailed'])
    expect(consoleSaid.textContent).not.toContain('no window')
    expect(screen.getByText('no window for session s1')).toBeTruthy()
  })

  it('a board that cannot be read', async () => {
    mount({ boardQuery: async () => { throw new Error('board_query: function does not exist') } })
    const said = await screen.findByText(en['needsYou.unreadable'])
    expect(said.textContent).not.toContain('function does not exist')
    expect(screen.getByText('board_query: function does not exist')).toBeTruthy()
  })
})

describe('«Directions of work» (SCN-181, CO-543)', () => {
  const NOW_ISO = new Date().toISOString()
  const dirTasks = [
    task('t-1', 'Keep the invite after sign-in', 'running', { origin_kind: null, moved_at: NOW_ISO }),
    task('t-obs', 'Sign-in fails on long addresses', 'backlog', { origin_kind: 'observation' }),
    task('t-b', 'Access audit', 'backlog', { origin_kind: 'document' }),
    task('t-g', 'Team roles', 'backlog', { origin_kind: 'observation', goal_id: 'g1' }),
    task('t-r', 'Import the old board', 'review', { origin_kind: 'observation', moved_at: NOW_ISO })
  ]
  const requests = async () => ({
    requests: [
      { requestId: 'r-in', threadId: 'th-in', from: 'p2', to: 'p1', capability: 'code.review', subject: 'Review the API page', state: 'queued', at: NOW_ISO, changedAt: null },
      { requestId: 'r-out', threadId: 'th-out', from: 'p1', to: 'p3', capability: 'pricing', subject: null, state: 'answered', at: NOW_ISO, changedAt: NOW_ISO }
    ],
    names: { p2: 'Docs', p3: 'Billing' }, capped: false, windowDays: 30
  })
  const sources = async () => ({ sources: [{ task_id: 't-b', path: 'docs/backlog.md', row_id: 'CO-41' }], capped: false })
  const rowOf = (key: 'fromProjects' | 'fromYou' | 'fromBacklog' | 'fromPlan' | 'fromAgents' | 'toReview' | 'toProjects') =>
    within(screen.getByText(en[`launch.project.directions.row.${key}`]).closest('.lp-dir-row') as HTMLElement)

  it('one row per direction in the scenario\'s order, each card opens its task or its thread', async () => {
    const { onOpenTask, onOpenRequest } = mount({ tasks: dirTasks, requests, sources })
    await waitFor(() => expect(screen.getByText(en['launch.project.directions.row.fromBacklog'])).toBeTruthy())
    await waitFor(() => expect(screen.getByText(en['launch.project.directions.row.fromProjects'])).toBeTruthy())
    const order = [...document.querySelectorAll('.lp-dir-row')].map((r) => r.getAttribute('data-direction'))
    expect(order).toEqual(['fromProjects', 'fromYou', 'fromBacklog', 'fromPlan', 'fromAgents', 'toReview', 'toProjects'])
    expect(rowOf('fromProjects').getByText('Docs')).toBeTruthy()
    expect(rowOf('fromProjects').getByText(/waiting/)).toBeTruthy()
    expect(rowOf('toProjects').getByText('Billing')).toBeTruthy()
    expect(rowOf('toProjects').getByText('pricing')).toBeTruthy()
    expect(rowOf('fromBacklog').getByText('CO-41 in docs/backlog.md')).toBeTruthy()
    // The agent on a task in work is said on its card.
    expect(rowOf('fromYou').getByText(/in work · claude-code/)).toBeTruthy()
    fireEvent.click(rowOf('toReview').getByText('Import the old board'))
    expect(onOpenTask).toHaveBeenCalledWith('t-r')
    fireEvent.click(rowOf('fromProjects').getByText('Review the API page'))
    expect(onOpenRequest).toHaveBeenCalledWith('th-in')
  })

  it('requests that cannot be read are said on their own row; the task rows stay', async () => {
    mount({ tasks: dirTasks, sources, requests: async () => { throw new Error('board_requests: permission denied') } })
    const said = await screen.findByText(en['launch.project.directions.requestsUnreadable'])
    expect(said.closest('.lp-dir-row')?.getAttribute('data-direction')).toBe('requests')
    expect(screen.getByText('board_requests: permission denied')).toBeTruthy()
    expect(screen.getByText(en['launch.project.directions.row.toReview'])).toBeTruthy()
  })

  it('backlog rows that cannot be read are said, and a task then stands in another row', async () => {
    mount({ tasks: dirTasks, requests, sources: async () => { throw new Error('task_sources: away') } })
    await screen.findByText(en['launch.project.directions.sourcesUnreadable'])
    expect(screen.queryByText(en['launch.project.directions.row.fromBacklog'])).toBeNull()
  })

  it('unread tasks are «Reading…», never quiet; tasks that cannot be read are said', async () => {
    mount({ tasks: null })
    await waitFor(() => expect(screen.getByText(en['launch.project.directions.reading'])).toBeTruthy())
    expect(screen.queryByText(en['launch.project.directions.quiet'])).toBeNull()
  })

  it('only finished work older than a week: said as quiet, never an empty strip', async () => {
    mount({ tasks: [task('t-old', 'Old', 'done', { finished_at: '2026-01-01T00:00:00Z' })] })
    await screen.findByText(en['launch.project.directions.quiet'])
    expect(document.querySelector('.lp-dir-row')).toBeNull()
  })
})

// «В работе» on the home, grouped by project (0.3.14, the simple Fabric, docs/ux/2026-10-26-simple-fabric.md §2b).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { ru } from '../i18n/ru'
import type { HomeView } from '../../../shared/homeLive'
import type { ProjectRow } from '../../../shared/types'
import { HomeInWork } from './HomeInWork'

afterEach(() => cleanup())

const now = new Date().toISOString()
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()
const project = (id: string, name: string, summary: string | null = null): ProjectRow => ({
  id, name, estate_id: 'e', purpose: null, repo_path: null, status: 'active', config_revision: 1, created_at: now,
  memory_backend: 'local', default_agent: 'claude-code', mcp_servers: [], summary
})
const view: HomeView = {
  live: [
    { sessionId: 's1', projectId: 'fab', projectName: 'Fabric', agent: 'claude-code', console: true, startedAt: now, lastSignAt: now, stale: false, branch: 'release/0.3.14',
      doing: { text: 'Checking the agent page', note: null, step: 4, ofSteps: 6, at: now }, task: { id: 't1', projectId: 'fab', summary: 'Fixes after the first review' } },
    { sessionId: 's2', projectId: 'fab', projectName: 'Fabric', agent: 'codex', console: false, startedAt: now, lastSignAt: minutesAgo(14), stale: true, branch: null,
      doing: null, task: null }
  ],
  inWork: [
    { taskId: 't1', projectId: 'fab', projectName: 'Fabric', summary: 'Fixes after the first review', agent: 'claude-code', sessionId: 's1', console: true, since: now, doing: null, live: true },
    { taskId: 't9', projectId: 'fab', projectName: 'Fabric', summary: 'One sessions screen', agent: 'claude-code', sessionId: 'gone', console: false, since: minutesAgo(300), doing: null, live: false }
  ],
  review: [], done: [], projects: [], readAt: now
}
const projects = [project('fab', 'Fabric', 'A workplace for agents.'), project('cop', 'Copylot'), project('mob', 'Mobile Publisher')]

function show(over: Partial<React.ComponentProps<typeof HomeInWork>> = {}, locale: 'en' | 'ru' = 'en') {
  const props = { reading: { view, problem: null }, projects, waitingByProject: { fab: 1 }, onProject: vi.fn(), onAgent: vi.fn(), onTask: vi.fn(), ...over }
  render(<I18nProvider locale={locale}><HomeInWork {...props} /></I18nProvider>)
  return props
}

describe('«В работе» grouped by project', () => {
  it('heads with how many projects and agents are at work, and names each project with its one line and counts', () => {
    show()
    const section = screen.getByRole('region', { name: en['launch.home.inWork.title'] })
    expect(section.textContent).toContain('1 project · 2 agents')
    const card = screen.getByRole('article', { name: 'Fabric' })
    expect(card.textContent).toContain('A workplace for agents.')
    expect(card.textContent).toContain('2 agents')
    expect(card.textContent).toContain('2 in work')
    expect(card.textContent).toContain('1 waits for you')
  })

  it('gives each agent its runner, branch, current task and last report, the row opening its screen', () => {
    const p = show()
    const card = screen.getByRole('article', { name: 'Fabric' })
    const rows = within(card).getAllByRole('listitem')
    expect(rows[0].textContent).toContain('Claude Code')
    expect(rows[0].textContent).toContain('release/0.3.14')
    expect(rows[0].textContent).toContain('step 4 of 6')
    expect(rows[0].textContent).toContain('Checking the agent page')
    expect(rows[1].textContent).toContain(en['rail.agents.branchUnknown'])
    expect(rows[1].textContent).toContain(en['launch.home.agents.silent'])
    expect(rows[1].textContent).toContain(en['launch.home.inWork.noTask'])
    fireEvent.click(within(rows[0]).getByRole('button', { name: /Claude Code/ }))
    expect(p.onAgent).toHaveBeenCalledWith('s1')
    fireEvent.click(within(rows[0]).getByRole('button', { name: 'Fixes after the first review' }))
    expect(p.onTask).toHaveBeenCalledWith('fab', 't1')
  })

  // The operator's second review, 2026-10-26 (R-3, R-4): the goal in the row's main type, the step as progress below it,
  // the current subtask named in the step line only when it differs from the goal.
  it('leads an agent\'s row with its goal, the step below as progress, and «Цель не названа» when none is named', () => {
    const goalView: HomeView = { ...view, live: [
      { ...view.live[0], goal: { taskId: 't0', projectId: 'fab', text: 'Ship 0.3.14', what: null, byPerson: true, isTask: false } },
      { ...view.live[1], goal: null }
    ] }
    const p = show({ reading: { view: goalView, problem: null } })
    const rows = within(screen.getByRole('article', { name: 'Fabric' })).getAllByRole('listitem')
    expect(rows[0].textContent).toContain(en['launch.home.inWork.goal'].replace('{goal}', 'Ship 0.3.14'))
    const bar = within(rows[0]).getByRole('progressbar')
    expect(bar.getAttribute('aria-valuenow')).toBe('4')
    expect(bar.getAttribute('aria-valuemax')).toBe('6')
    // The subtask differs from the goal: it is named in the step line, and opens its task.
    fireEvent.click(within(rows[0]).getByRole('button', { name: 'Fixes after the first review' }))
    expect(p.onTask).toHaveBeenCalledWith('fab', 't1')
    fireEvent.click(within(rows[0]).getByRole('button', { name: en['launch.home.inWork.goal'].replace('{goal}', 'Ship 0.3.14') }))
    expect(p.onTask).toHaveBeenCalledWith('fab', 't0')
    expect(rows[1].textContent).toContain(en['launch.home.inWork.noGoal'])
  })

  it('names a task in work no agent holds on a line of its own', () => {
    const p = show()
    const card = screen.getByRole('article', { name: 'Fabric' })
    expect(card.textContent).toContain(en['launch.home.inWork.orphan'])
    fireEvent.click(within(card).getByRole('button', { name: 'One sessions screen' }))
    expect(p.onTask).toHaveBeenCalledWith('fab', 't9')
  })

  it('folds the quiet projects into one line, each a link; a project with no description offers to get to know it', () => {
    const p = show({ reading: { view: { ...view, live: [{ ...view.live[0], projectId: 'cop', projectName: 'Copylot' }], inWork: [] }, problem: null } })
    const quiet = screen.getByText(en['launch.home.inWork.quiet']).closest('p') as HTMLElement
    expect(within(quiet).getAllByRole('button').map((b) => b.textContent)).toEqual(['Fabric', 'Mobile Publisher'])
    fireEvent.click(within(quiet).getByRole('button', { name: 'Mobile Publisher' }))
    expect(p.onProject).toHaveBeenCalledWith('mob')
    const card = screen.getByRole('article', { name: 'Copylot' })
    expect(card.textContent).toContain(en['launch.home.inWork.noSummary'])
    fireEvent.click(within(card).getByRole('button', { name: en['launch.home.inWork.getToKnow'] }))
    expect(p.onProject).toHaveBeenCalledWith('cop')
  })

  it('says reading, a failed read and nothing at work apart, never one for another', () => {
    show({ reading: { view: null, problem: null } })
    expect(screen.getByText(en['estate.reading'])).toBeTruthy()
    cleanup()
    show({ reading: { view: null, problem: 'database away' } })
    expect(screen.getByText(en['launch.home.work.unreadable'])).toBeTruthy()
    expect(screen.queryByText(en['launch.home.inWork.none'])).toBeNull()
    cleanup()
    show({ reading: { view: { ...view, live: [], inWork: [] }, problem: null } })
    expect(screen.getByText(en['launch.home.inWork.none'])).toBeTruthy()
  })

  it('speaks Russian in Russian', () => {
    show({}, 'ru')
    expect(screen.getByRole('region', { name: ru['launch.home.inWork.title'] }).textContent).toContain('1 проект · 2 агента')
    expect(screen.getByRole('article', { name: 'Fabric' }).textContent).toContain('1 ждёт вас')
  })
})

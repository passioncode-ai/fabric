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
const project = (id: string, name: string, summary: string | null = null, plan: ProjectRow['plan'] = null): ProjectRow => ({
  id, name, estate_id: 'e', purpose: null, repo_path: null, status: 'active', config_revision: 1, created_at: now,
  memory_backend: 'local', default_agent: 'claude-code', mcp_servers: [], summary, plan
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
    // The approved mockup (gap map E1): the cards sit on the page, the section is no panel of its own.
    expect(section.className).not.toContain('lp-panel')
    const card = screen.getByRole('article', { name: 'Fabric' })
    // The operator's second review (R-1, R-2): the description is the name's hover, never the card's line.
    expect(card.textContent).not.toContain('A workplace for agents.')
    expect(within(card).getByRole('button', { name: 'Fabric' }).getAttribute('title')).toBe('A workplace for agents.')
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
    // The mockup-parity pass (gap map E6): «no task» is said in the quiet report type, never as a task line.
    expect(rows[1].querySelector('.lh-arow-task')).toBeNull()
    expect(within(rows[1]).getByText(en['launch.home.inWork.noTask']).className).toContain('lh-arow-report')
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
    // UX-12: an agent that took no task says so, never «no goal named».
    expect(rows[1].textContent).toContain(en['launch.home.inWork.noTask'])
    expect(rows[1].textContent).not.toContain(en['launch.home.inWork.noGoal'])
  })

  // The 0.3.14 review, iteration 2.
  it('UX-13: a task that is its own root is the task line, never «Goal:», and not the card\'s aim', () => {
    const own: HomeView = { ...view, live: [{ ...view.live[0], goal: { taskId: 't1', projectId: 'fab', text: 'Fixes after the first review', what: null, byPerson: false, isTask: true } }, view.live[1]] }
    show({ reading: { view: own, problem: null }, projects: [project('fab', 'Fabric', null, { done: [], next: ['Release notes'] }), ...projects.slice(1)] })
    const card = screen.getByRole('article', { name: 'Fabric' })
    expect(card.textContent).not.toContain(en['launch.home.inWork.goal'].replace('{goal}', ''))
    expect(card.querySelector('.lh-proj-aim')?.textContent).toBe(en['launch.home.inWork.next'].replace('{text}', 'Release notes'))
  })

  it('UX-22: a Plan goal over a task an agent filed under it leads the row as «Goal:», the task the step, and is the card\'s aim', () => {
    // The shape `main/agentGoals.ts#withGoals` returns for the probe's case (test/agent-goals.test.mjs, UX-22).
    const named: HomeView = { ...view, live: [{ ...view.live[0], goal: { taskId: 't1', projectId: 'fab', text: 'Ship 0.3.14 by Friday', what: null, byPerson: false, isTask: false } }, view.live[1]] }
    show({ reading: { view: named, problem: null } })
    const card = screen.getByRole('article', { name: 'Fabric' })
    expect(card.textContent).toContain(en['launch.home.inWork.goal'].replace('{goal}', 'Ship 0.3.14 by Friday'))
    expect(card.querySelector('.lh-arow-report')?.textContent).toContain('Fixes after the first review')
    expect(card.querySelector('.lh-proj-aim')?.textContent).toContain('Ship 0.3.14 by Friday')
  })

  it('ER-20: a failed goals read is said, and the plan\'s step is not shown as the aim', () => {
    show({ reading: { view: { ...view, goalsUnread: 'task_links refused' }, problem: null }, projects: [project('fab', 'Fabric', null, { done: [], next: ['Release notes'] }), ...projects.slice(1)] })
    expect(screen.getByText(en['launch.home.inWork.goalsUnread'])).toBeTruthy()
    expect(screen.getByRole('article', { name: 'Fabric' }).querySelector('.lh-proj-aim')).toBeNull()
  })

  it('UX-17, UX-18, UX-21: «Working» is said in a word; a failed reading offers a retry; the head names the quiet agents', () => {
    const retry = vi.fn()
    show({ reading: { view, problem: null } })
    const rows = within(screen.getByRole('article', { name: 'Fabric' })).getAllByRole('listitem')
    expect(rows[0].textContent).toContain(en['status.working'])
    expect(document.querySelector('.lh-inwork-head')?.textContent).toContain(en['launch.home.inWork.agentsQuiet'].replace('{count}', '1'))
    cleanup()
    show({ reading: { view: null, problem: 'stack refused', retry } })
    fireEvent.click(screen.getByRole('button', { name: en['common.retry'] }))
    expect(retry).toHaveBeenCalled()
  })

  // The operator's second review (R-1): the card's line is what is being done there now.
  it('says the card\'s aim: its running work\'s goal, else «Дальше:» and the plan\'s next step', () => {
    const withGoal: HomeView = { ...view, live: [{ ...view.live[0], goal: { taskId: 't0', projectId: 'fab', text: 'Ship 0.3.14', what: null, byPerson: true, isTask: false } }, view.live[1]] }
    show({ reading: { view: withGoal, problem: null } })
    expect(screen.getByRole('article', { name: 'Fabric' }).querySelector('.lh-proj-aim')?.textContent).toBe('Ship 0.3.14')
    cleanup()
    show({ projects: [project('fab', 'Fabric', null, { done: [], next: ['Release notes'] }), ...projects.slice(1)] })
    expect(screen.getByRole('article', { name: 'Fabric' }).querySelector('.lh-proj-aim')?.textContent).toBe(en['launch.home.inWork.next'].replace('{text}', 'Release notes'))
  })

  // R-19: the status from the console Fabric holds, in a word beside the dot's colour and shape.
  it('says an agent\'s status in a word when it is not simply working', () => {
    show({ terminals: [{ sessionId: 's1', state: 'ended', exitCode: 0, exitSignal: 9, stoppedByFabric: false }] })
    const rows = within(screen.getByRole('article', { name: 'Fabric' })).getAllByRole('listitem')
    // ER-19: a console killed by a signal Fabric did not send reads as an error, not as a clean end.
    expect(rows[0].textContent).toContain(en['status.error'])
    expect(rows[0].querySelector('.rail-dot')?.className).toContain('s-error')
    expect(rows[1].textContent).toContain(en['status.idle'])
  })

  it('names a task in work no agent holds on a line of its own', () => {
    const p = show()
    const card = screen.getByRole('article', { name: 'Fabric' })
    expect(card.textContent).toContain(en['launch.home.inWork.orphan'])
    fireEvent.click(within(card).getByRole('button', { name: 'One sessions screen' }))
    expect(p.onTask).toHaveBeenCalledWith('fab', 't9')
  })

  it('folds the quiet projects into one line, each a link; a card with no aim known shows its name alone', () => {
    const p = show({ reading: { view: { ...view, live: [{ ...view.live[0], projectId: 'cop', projectName: 'Copylot' }], inWork: [] }, problem: null } })
    const quiet = screen.getByText(en['launch.home.inWork.quiet']).closest('p') as HTMLElement
    expect(within(quiet).getAllByRole('button').map((b) => b.textContent)).toEqual(['Fabric', 'Mobile Publisher'])
    fireEvent.click(within(quiet).getByRole('button', { name: 'Mobile Publisher' }))
    expect(p.onProject).toHaveBeenCalledWith('mob')
    const card = screen.getByRole('article', { name: 'Copylot' })
    expect(card.querySelector('.lh-proj-aim')).toBeNull()
    fireEvent.click(within(card).getByRole('button', { name: 'Copylot' }))
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

// The mockup parity, wave 2 (docs/reports/2026-10-27-mockup-parity/gaps/home.md D3, D4, D9): rows only for agents at
// work, the connected in one line, the task's title heading the row, the hold time under the time, display names.
describe('«В работе» by work, not by connection (the mockup parity)', () => {
  const atWork: HomeView = {
    live: [
      { sessionId: 'w1', projectId: 'fab', projectName: 'fabric', agent: 'claude-code', console: true, startedAt: now, lastSignAt: now, stale: false, atWork: true, workAt: minutesAgo(1),
        doing: null, task: { id: 't1', projectId: 'fab', summary: 'Close the five levels of review before the release', title: 'Fixes after the first review', what: 'Close the five levels of review before the release', heldSince: minutesAgo(104) } },
      { sessionId: 'w2', projectId: 'cop', projectName: 'copylot-agent', agent: 'codex', console: false, startedAt: now, lastSignAt: now, stale: false, atWork: true, workAt: minutesAgo(3),
        doing: { text: 'Checking 12 languages', note: null, step: 3, ofSteps: 5, at: minutesAgo(3) }, task: null },
      { sessionId: 'i1', projectId: 'mob', projectName: 'mobile-publisher', agent: 'claude-code', console: false, startedAt: now, lastSignAt: now, stale: false, atWork: false, workAt: null, doing: null, task: null },
      { sessionId: 'i2', projectId: 'mob', projectName: 'mobile-publisher', agent: 'claude-code', console: false, startedAt: now, lastSignAt: now, stale: false, atWork: false, workAt: null, doing: null, task: null }
    ],
    inWork: [], review: [], done: [], projects: [], readAt: now,
    atWork: { agents: 2, connectedIdle: 2, noTask: 1, noTaskSessions: ['w2'] },
    displayNames: { cop: { name: 'Copylot', from: 'descriptor', derived: false }, mob: { name: 'Mobile Publisher', from: 'slug', derived: true } }
  }
  const slugs = [project('fab', 'fabric'), project('cop', 'copylot-agent'), project('mob', 'mobile-publisher')]

  it('cards only the agents at work, ordered by their newest work; the merely connected are one quiet line', () => {
    show({ reading: { view: atWork, problem: null }, projects: slugs, waitingByProject: {} })
    const cards = screen.getAllByRole('article')
    expect(cards.map((c) => within(c).getByRole('heading').textContent)).toEqual(['fabric', 'Copylot'])
    expect(screen.queryByRole('list', { name: /Mobile Publisher/ })).toBeNull()
    const idle = screen.getByText(en['launch.home.inWork.connectedIdle'].replace('{count}', '2'))
    expect(idle.getAttribute('title')).toBe(en['launch.home.inWork.connectedIdleWhy'])
    // The quiet line names the project with no agent at work by its display name.
    expect(screen.getByRole('button', { name: 'Mobile Publisher' })).toBeTruthy()
  })

  it('heads a row with the task\'s title, its «what» the hover and the quiet line, and says how long it has held the task', () => {
    show({ reading: { view: atWork, problem: null }, projects: slugs, waitingByProject: {} }, 'ru')
    const row = screen.getAllByRole('listitem')[0]
    const title = within(row).getByRole('button', { name: 'Fixes after the first review' })
    expect(title.getAttribute('title')).toBe('Close the five levels of review before the release')
    expect(row.querySelector('.lh-arow-what')?.textContent).toBe('Close the five levels of review before the release')
    expect(row.querySelector('.lh-arow-held')?.textContent).toBe('держит 1 ч 44 мин')
    expect(document.body.textContent).not.toMatch(/—/)
  })
})

// The home's «who is doing what» (operator request 2026-10-14): agents in their own words, a click into the console
// Fabric holds or else into the project, a silent agent marked, an unreadable reading said — never "nobody works".
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { ru } from '../i18n/ru'
import { AgentsAtWork, HomeAgents, HomeStats, HomeWorkLanes, useHome, type HomeReading } from './HomeWork'
import type { HomeView } from '../../../shared/homeLive'

const now = new Date().toISOString()
const view: HomeView = {
  live: [
    { sessionId: 's1', projectId: 'p1', projectName: 'Fabric', agent: 'claude-code', console: true, startedAt: now, lastSignAt: now, stale: false,
      doing: { text: 'Making a version where the computer stays awake', note: null, step: 2, ofSteps: 4, at: now }, task: null },
    { sessionId: 's2', projectId: 'p2', projectName: 'Site', agent: 'codex', console: false, startedAt: now, lastSignAt: now, stale: true,
      doing: null, task: { id: 't2', summary: 'New landing page' } }
  ],
  inWork: [{ taskId: 't2', projectId: 'p2', projectName: 'Site', summary: 'New landing page', agent: 'codex', sessionId: 's2', console: false, since: now, doing: null, live: true }],
  review: [{ taskId: 't3', projectId: 'p1', projectName: 'Fabric', summary: 'Keep-awake setting', since: now }],
  done: [{ taskId: 't4', projectId: 'p1', projectName: 'Fabric', summary: 'Email sign-in', since: now }],
  projects: [],
  readAt: now
}
const read: HomeReading = { view, problem: null }
const show = (ui: React.ReactNode) => render(<I18nProvider locale="en">{ui}</I18nProvider>)

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('home: agents at work, by their planned task (the operator\'s walk OF-16, OF-17, D-4)', () => {
  const task = (id: string) => ({ id, summary: 'Planned task ' + id })
  const agent = (sessionId: string, stale: boolean, withTask: boolean) => ({
    sessionId, projectId: 'p1', projectName: 'Fabric', agent: 'claude-code', console: true, startedAt: now, lastSignAt: now, stale,
    doing: { text: 'Reading a file ' + sessionId, note: null, step: null, ofSteps: null, at: now }, task: withTask ? task(sessionId) : null
  })
  it('names the task an agent holds before its latest action, and falls back to the action only without one', () => {
    const r: HomeReading = { view: { ...view, live: [agent('a', false, true), agent('b', false, false)] }, problem: null }
    show(<HomeAgents reading={r} onOpen={() => {}} onSession={() => {}} onAll={() => {}} />)
    expect(screen.getByText(/Planned task a/)).toBeTruthy()
    expect(screen.queryByText(/Reading a file a/)).toBeNull()
    expect(screen.getByText(/Reading a file b/)).toBeTruthy()
  })
  it('lists active agents before quiet ones, every one of them, in a box that scrolls', () => {
    const live = [agent('q1', true, true), agent('a1', false, true), ...Array.from({ length: 9 }, (_, i) => agent('a' + (i + 2), false, true))]
    const r: HomeReading = { view: { ...view, live }, problem: null }
    const { container } = show(<HomeAgents reading={r} onOpen={() => {}} onSession={() => {}} onAll={() => {}} />)
    const items = [...container.querySelectorAll('.lh-agent-list > li')]
    expect(items).toHaveLength(11)
    expect(items.at(-1)!.className).toContain('is-stale')
    expect(container.querySelector('.lh-agent-list')!.classList.contains('lh-scrollbox')).toBe(true)
  })
  it('carries the one «Открыть переписку»', () => {
    const onComms = vi.fn()
    show(<HomeAgents reading={read} onOpen={() => {}} onSession={() => {}} onAll={() => {}} onComms={onComms} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open the comms' }))
    expect(onComms).toHaveBeenCalled()
  })
})

describe('home: who does what, in two columns (the operator\'s walk OF-18)', () => {
  it('shows «В работе» (review marked inside it) and «Закончили», and its heading opens the board', () => {
    const onBoard = vi.fn()
    const { container } = show(<HomeWorkLanes reading={read} onOpen={() => {}} onSession={() => {}} onBoard={onBoard} />)
    const lanes = [...container.querySelectorAll('.lh-lane h4')].map((h) => h.textContent ?? '')
    expect(lanes).toHaveLength(2)
    expect(lanes[0]).toMatch(/In work/)
    expect(lanes[1]).toMatch(/Finished/)
    expect(screen.getByText('Keep-awake setting').closest('.lh-lane')!.textContent).toMatch(/In work/)
    expect(screen.getByText('Email sign-in')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Open the board' }))
    expect(onBoard).toHaveBeenCalled()
  })
})

describe('home: who is doing what', () => {
  it('shows each agent in its own words, with its step, and marks a silent one', () => {
    show(<HomeAgents reading={read} onOpen={() => {}} onSession={() => {}} onAll={() => {}} />)
    expect(screen.getByText(/Making a version where the computer stays awake/)).toBeTruthy()
    expect(screen.getByText(/step 2 of 4/)).toBeTruthy()
    expect(screen.getByText('Working on: New landing page')).toBeTruthy()
    expect(screen.getByText('silent')).toBeTruthy()
  })

  it('opens the console Fabric holds, and the project when it holds none', () => {
    const onSession = vi.fn(), onOpen = vi.fn()
    show(<HomeAgents reading={read} onOpen={onOpen} onSession={onSession} onAll={() => {}} />)
    fireEvent.click(screen.getByTitle('Open its console'))
    expect(onSession).toHaveBeenCalledWith('s1')
    fireEvent.click(screen.getByTitle('Open its project'))
    expect(onOpen).toHaveBeenCalledWith('p2')
  })

  it('a failed reading is said, and no "nobody is working" is shown', () => {
    show(<HomeAgents reading={{ view: null, problem: 'database away' }} onOpen={() => {}} onSession={() => {}} onAll={() => {}} />)
    expect(screen.getByRole('alert').textContent).toContain('database away')
    expect(screen.queryByText(/No agent is working/)).toBeNull()
  })

  it('a failed reading is OUR sentence in the operator\'s language, with the machine\'s words on their own line (UX-5)', () => {
    const problem = 'the claimed tasks could not be read: relation "project_tasks" does not exist'
    render(<I18nProvider locale="ru"><HomeAgents reading={{ view: null, problem }} onOpen={() => {}} onSession={() => {}} onAll={() => {}} /></I18nProvider>)
    render(<I18nProvider locale="ru"><HomeWorkLanes reading={{ view: null, problem }} onOpen={() => {}} onSession={() => {}} /></I18nProvider>)
    const said = screen.getAllByText(ru['launch.home.work.unreadable']!)
    expect(said).toHaveLength(2)
    for (const s of said) expect(s.textContent).not.toContain('project_tasks')
    expect(screen.getAllByText(problem)).toHaveLength(2)
  })

  it('the lanes and the counts come from the same reading', () => {
    show(<>
      <HomeStats reading={read} waiting={3} onAgents={() => {}} onBoard={() => {}} />
      <HomeWorkLanes reading={read} onOpen={() => {}} onSession={() => {}} />
    </>)
    // one working (the silent one is not counted as working), one in work, three need you, one to review
    expect(screen.getByText('agents working').previousSibling?.textContent).toBe('1')
    expect(screen.getByText('need you').previousSibling?.textContent).toBe('3')
    expect(screen.getAllByText('New landing page').length).toBeGreaterThan(0)
    expect(screen.getByText('Keep-awake setting')).toBeTruthy()
  })

  it('useHome reads work.home and keeps the last view when a later read fails', async () => {
    let n = 0
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { work: { home: async () => { if (n++) throw new Error('gone'); return view } } } }))
    const seen: HomeReading[] = []
    function Probe({ mark }: { mark: number }) { seen.push(useHome(mark)); return null }
    const r = show(<Probe mark={1} />)
    await waitFor(() => expect(seen.at(-1)?.view).toBe(view))
    r.rerender(<I18nProvider locale="en"><Probe mark={2} /></I18nProvider>)
    await waitFor(() => expect(seen.at(-1)?.problem).toBe('gone'))
    expect(seen.at(-1)?.view).toBe(view)
  })

  it('a claim nobody signs for is shown as such, and the counts are not current after a failed read', () => {
    const stale: HomeReading = { view: { ...view, inWork: [{ ...view.inWork[0], live: false }], reviewCapped: true }, problem: null }
    show(<>
      <HomeStats reading={stale} waiting={0} onAgents={() => {}} onBoard={() => {}} />
      <HomeWorkLanes reading={stale} onOpen={() => {}} onSession={() => {}} />
    </>)
    expect(screen.getByText('nobody signing')).toBeTruthy()
    // One "in work" number on the screen: the strip counts what the lane lists, the silent claim included (release review i2 DO-3).
    expect(screen.getByText('tasks in work').previousSibling?.textContent).toBe('1')
    expect(screen.getByRole('heading', { name: /In work/ }).textContent).toContain('1')
    expect(screen.getByText('to review').previousSibling?.textContent).toBe('1+')
    cleanup()
    show(<HomeStats reading={{ view, problem: 'gone' }} waiting={null} onAgents={() => {}} onBoard={() => {}} />)
    expect(screen.getByText('agents working').previousSibling?.textContent).toBe('—')
  })
})


describe('the Agents place lists every agent at work, not only Fabric\'s consoles (the operator\'s walk OF-30)', () => {
  it('reads work.home and shows each agent with the task it holds, an agent from a terminal included', async () => {
    const terminal = { ...view.live[1], sessionId: 's9', console: false, stale: false, task: { id: 't9', summary: 'Refund replies' }, doing: null }
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { home: vi.fn(async () => ({ ...view, live: [terminal] })) } } }))
    show(<AgentsAtWork mark={0} onOpen={() => {}} />)
    expect(await screen.findByText(/Refund replies/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: /Agents at work/ })).toBeTruthy()
  })
})

describe('agents on a project page take one line each (the operator\'s walk OF-23)', () => {
  it('does not repeat the project name and marks the rows compact', () => {
    const { container } = show(<HomeAgents reading={read} projectId="p1" title="Agents here" onOpen={() => {}} onSession={() => {}} />)
    const rows = [...container.querySelectorAll('.lh-agent-list > li')]
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).not.toMatch(/Fabric/)
    expect(container.querySelector('.lh-agent-list')!.classList.contains('lh-compact')).toBe(true)
  })
})

describe('0.3.11 review, iteration 1', () => {
  it('an agent with no console here and no project is a row, not a button that does nothing (ER-5)', () => {
    const lost = { ...view, live: [{ ...view.live[1], sessionId: 's9', projectId: null, projectName: null, console: false }] }
    const { container } = show(<HomeAgents reading={{ view: lost, problem: null }} onSession={() => {}} onOpen={() => {}} />)
    expect(container.querySelector('.lh-agent-list button')).toBeNull()
    expect(container.querySelector('.lh-agent-list .lh-agent')).toBeTruthy()
  })
  it('«Закончили» that could not be read says so, never «nothing finished» (ER-7)', () => {
    show(<HomeWorkLanes reading={{ view: { ...view, done: [], doneUnread: 'the finished tasks could not be read: timeout' }, problem: null }} onOpen={() => {}} onSession={() => {}} />)
    expect(screen.getByText(/timeout/)).toBeTruthy()
    expect(screen.queryByText(/Nothing finished/i)).toBeNull()
    expect([...document.querySelectorAll('.lh-lane h4')].at(-1)!.textContent).toMatch(/\?/)
  })
})

describe('a lane opens the task, as the kanban\'s card does (CO-394)', () => {
  it('opens the task of a row in work, in review or finished; a row whose agent has a console opens the console', () => {
    const onOpenTask = vi.fn(), onOpen = vi.fn(), onSession = vi.fn()
    show(<HomeWorkLanes reading={read} onOpen={onOpen} onOpenTask={onOpenTask} onSession={onSession} />)
    fireEvent.click(screen.getByText('New landing page'))
    fireEvent.click(screen.getByText('Keep-awake setting'))
    fireEvent.click(screen.getByText('Email sign-in'))
    expect(onOpenTask.mock.calls).toEqual([['p2', 't2'], ['p1', 't3'], ['p1', 't4']])
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('without a task opener (an older host) a lane still opens the project', () => {
    const onOpen = vi.fn()
    show(<HomeWorkLanes reading={read} onOpen={onOpen} onSession={() => {}} />)
    fireEvent.click(screen.getByText('Email sign-in'))
    expect(onOpen).toHaveBeenCalledWith('p1')
  })
})

describe('after a failed read the lanes say the view is the last one (CO-313)', () => {
  it('names the time of the kept reading under the failure, and nothing when the read is current', () => {
    const at = '2026-10-23T09:05:00Z'
    const time = new Date(at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })
    const { container, rerender } = show(<HomeWorkLanes reading={{ ...read, problem: 'database away', readAt: at }} onOpen={() => {}} onSession={() => {}} />)
    expect(container.textContent).toContain(`as it was at ${time}`)
    rerender(<I18nProvider locale="en"><HomeAgents reading={{ ...read, problem: 'database away', readAt: at }} onOpen={() => {}} onSession={() => {}} onAll={() => {}} /></I18nProvider>)
    expect(container.textContent).toContain(`as it was at ${time}`)
    rerender(<I18nProvider locale="en"><HomeWorkLanes reading={{ ...read, readAt: at }} onOpen={() => {}} onSession={() => {}} /></I18nProvider>)
    expect(container.textContent).not.toContain("as it was at")
  })
})

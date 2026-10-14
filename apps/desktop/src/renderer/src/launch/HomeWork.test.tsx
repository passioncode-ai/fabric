// The home's «who is doing what» (operator request 2026-10-14): agents in their own words, a click into the console
// Fabric holds or else into the project, a silent agent marked, an unreadable reading said — never "nobody works".
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { ru } from '../i18n/ru'
import { HomeAgents, HomeStats, HomeWorkLanes, useHome, type HomeReading } from './HomeWork'
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
  projects: [],
  readAt: now
}
const read: HomeReading = { view, problem: null }
const show = (ui: React.ReactNode) => render(<I18nProvider locale="en">{ui}</I18nProvider>)

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

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
    expect(screen.getByText('tasks in work').previousSibling?.textContent).toBe('0')
    expect(screen.getByText('to review').previousSibling?.textContent).toBe('1+')
    cleanup()
    show(<HomeStats reading={{ view, problem: 'gone' }} waiting={null} onAgents={() => {}} onBoard={() => {}} />)
    expect(screen.getByText('agents working').previousSibling?.textContent).toBe('—')
  })
})


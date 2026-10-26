// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { ProjectBoardGlance, ProjectWay } from './ProjectWay'
import type { ProjectPath } from '../../../shared/projectPath'

const show = (ui: React.ReactNode) => render(<I18nProvider locale="en">{ui}</I18nProvider>)
const empty = { count: 0, items: [] }
const path: ProjectPath = { done: [], now: [], next: [], columns: { backlog: empty, running: empty, review: empty, done: empty } } as unknown as ProjectPath

afterEach(cleanup)

// A tasks read that fails is said on both panels, before and after a first read (0.3.6 review i3 ER-1, UX-1).
describe('a project whose tasks could not be read', () => {
  it('says so instead of reading forever, on the way and the board glance', () => {
    show(<>
      <ProjectWay path={null} inWork={null} goal={null} problem="gone" onOpenTask={() => {}} onPlan={() => {}} />
      <ProjectBoardGlance path={null} problem="gone" onOpenTask={() => {}} onBoard={() => {}} onNewTask={() => {}} />
    </>)
    expect(screen.getByText(en['launch.project.way.unreadable'])).toBeTruthy()
    expect(screen.getByText(en['launch.project.glance.unreadable'])).toBeTruthy()
    expect(screen.queryByText(en['estate.reading'])).toBeNull()
  })
  it('says a failed reload above what was read before', () => {
    show(<ProjectWay path={path} inWork={null} goal={null} problem="gone" onOpenTask={() => {}} onPlan={() => {}} />)
    expect(screen.getByText(en['launch.project.way.stale'])).toBeTruthy()
  })
})

// The 0.3.14 review, iteration 1, UX-9: a project's own glance counts «Брошено» apart, as the home and the Board do.
describe('a project\'s glance and its abandoned work', () => {
  it('leaves abandoned work out of «В работе» and says it apart, with the way to the Board', () => {
    const item = (id: string) => ({ id, summary: `Task ${id}`, at: '2026-10-26T10:00:00Z' })
    const running = { count: 3, items: [item('r1'), item('r2'), item('gone')] }
    const p = { ...path, columns: { ...path.columns, running } } as unknown as ProjectPath
    let boards = 0
    show(<ProjectBoardGlance path={p} abandoned={[{ taskId: 'gone' }]} onOpenTask={() => {}} onBoard={() => { boards++ }} onNewTask={() => {}} />)
    const heading = screen.getByRole('heading', { name: new RegExp(`^${en['board.running']}`) })
    expect(heading.textContent).toContain('2')
    expect(screen.queryByText('Task gone')).toBeNull()
    screen.getByRole('button', { name: en['launch.home.work.abandoned'].replace('{count}', '1') }).click()
    expect(boards).toBe(1)
  })
})

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

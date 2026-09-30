import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { PlanScreen } from './PlanScreen'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { envelope } from '../../../shared/readEnvelope'
import type { ProjectRow, TaskRow } from '../../../shared/types'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const STAMP = '2026-09-11T00:00:00Z'
const projects = [
  { id: 'p1', name: 'Atlas', purpose: 'Team access', repo_path: null, status: 'active' },
  { id: 'p2', name: 'Studio', purpose: 'A new service', repo_path: null, status: 'active' },
  { id: 'p3', name: 'Old', purpose: 'Gone', repo_path: null, status: 'archived' }
] as unknown as ProjectRow[]
const task = (id: string, goal: string | null, status = 'backlog', position: number | null = null) =>
  ({ id, title: 'Task ' + id, instruction: 'Task ' + id, status, goal_id: goal, position }) as unknown as TaskRow

function mount({ tasks = [task('t1', 'g1', 'backlog', 1), task('t2', 'g1', 'done'), task('t3', null)], truncated = false as boolean | 'unknown', level = { at: 'portfolio' } as never } = {}) {
  const api = {
    board: { query: vi.fn(async () => envelope({ data: { items: [], total: 2, hidden: 0, countsByProject: { p1: 2 } }, sources: [{ name: 'questions', status: 'ok', asOf: STAMP }], asOf: STAMP, freshness: 'fresh' })) },
    goals: { list: vi.fn(async () => [{ id: 'g1', project_id: 'p1', title: 'Launch team access', autonomy: 'safe', created_at: STAMP }]) },
    tasks: { list: vi.fn(async () => ({ tasks, closed: { truncated, says: '' } })) }
  }
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: api }))
  const on = { onProject: vi.fn(), onTask: vi.fn() }
  render(<I18nProvider locale="en"><PlanScreen projects={projects} feed={[]} feedMark={0} level={level} {...on} /></I18nProvider>)
  return { api, ...on }
}
/** The canvas's own nodes — the list under it repeats them on purpose. */
const canvas = () => within(document.querySelector('.lp-nodes') as HTMLElement)
const expand = (i = 0) => fireEvent.click(canvas().getAllByRole('button', { name: en['launch.plan.expand'] })[i])

describe('planning, level by level (SCR-40)', () => {
  it('starts with every live project, each with what waits on you, and never an archived one', async () => {
    mount()
    await waitFor(() => expect(screen.getAllByText(en['estate.waiting'].replace('{count}', '2')).length).toBeGreaterThan(0))
    expect(screen.getAllByText('Atlas').length).toBeGreaterThan(0)
    expect(screen.queryByText('Old'), 'an archived project was planned').toBeNull()
    expect(document.body.textContent, 'a raw registry key reached the screen').not.toMatch(/launch\.plan\./)
  })

  it('opens a project into its goals, with progress counted, and work no goal holds shown as its own node', async () => {
    const { api } = mount()
    await waitFor(() => expect(canvas().getAllByRole('button', { name: en['launch.plan.expand'] }).length).toBe(2))
    expand(0)
    await waitFor(() => expect(screen.getAllByText('Launch team access').length).toBeGreaterThan(0))
    expect(api.goals.list).toHaveBeenCalledWith('p1')
    expect(screen.getAllByText(en['launch.plan.measured'].replace('{done}', '1').replace('{total}', '2')).length).toBeGreaterThan(0)
    expect(screen.getAllByText(en['launch.plan.unattached']).length, 'work without a goal disappeared').toBeGreaterThan(0)
  })

  it('a capped read of closed work is a floor, said so, never a fraction', async () => {
    mount({ truncated: 'unknown', level: { at: 'project', projectId: 'p1' } as never })
    await waitFor(() => expect(screen.getAllByText(en['launch.plan.atLeast'].replace('{done}', '1').replace('{total}', '2')).length).toBeGreaterThan(0))
    expect(screen.queryByText(en['launch.plan.measured'].replace('{done}', '1').replace('{total}', '2'))).toBeNull()
  })

  it('opens a goal into its open work in priority order, and a work node opens its task', async () => {
    const { onTask } = mount({ level: { at: 'project', projectId: 'p1' } as never })
    await waitFor(() => expect(canvas().getAllByRole('button', { name: en['launch.plan.expand'] }).length).toBe(2))
    expand(0)
    await waitFor(() => expect(screen.getAllByText('Task t1').length).toBeGreaterThan(0))
    expect(screen.queryByText('Task t2'), 'closed work was planned as open').toBeNull()
    fireEvent.click(canvas().getAllByRole('button', { name: en['launch.plan.openTask'] })[0])
    expect(onTask).toHaveBeenCalledWith('p1', 't1')
  })

  it('the breadcrumb goes back up without losing the way', async () => {
    mount({ level: { at: 'project', projectId: 'p1' } as never })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Atlas' })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: en['launch.plan.all'] }))
    await waitFor(() => expect(screen.getAllByText('Studio').length).toBeGreaterThan(0))
  })
})

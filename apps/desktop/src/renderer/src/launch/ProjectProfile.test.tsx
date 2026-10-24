// W2 S4 (OF-24, OF-27, SCN-165 as amended): the project page's profile panel.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { ProjectProfile } from './ProjectProfile'
import type { ProjectRow } from '../../../shared/types'

const base = { id: 'p1', estate_id: 'e', name: 'fabric', purpose: null, repo_path: null, status: 'active', config_revision: 0, created_at: 'x', memory_backend: 'local', default_agent: 'claude-code', mcp_servers: [] } as ProjectRow
const install = (over: Record<string, unknown> = {}) => {
  const api = {
    relations: vi.fn(async () => [{ kind: 'depends-on', target: 'fabric-agent-contract', note: 'the contract' }]),
    people: vi.fn(async () => ({ people: [{ name: 'Ada', email: 'ada@example.invalid', commits: 12, lastAt: '2026-10-20T10:00:00Z' }], unread: [], read: 1 })),
    setBusiness: vi.fn(async (_id: string, b: string) => ({ ...base, business: b || null })),
    onboard: vi.fn(async () => ({ taskId: 't-onboard', filed: true })),
    ...over
  }
  vi.stubGlobal('window', Object.assign(window, { fabric: { projects: api } }))
  return api
}
const show = (project: ProjectRow, onOpenTask = vi.fn()) =>
  render(<I18nProvider locale="en"><ProjectProfile project={project} feedMark={0} onOpenTask={onOpenTask} /></I18nProvider>)
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('the project page says what the project is (W2 S4)', () => {
  it('without a profile, offers to get to know the project, and opens the task it files', async () => {
    const api = install({ relations: vi.fn(async () => []) })
    const onOpenTask = vi.fn()
    show(base, onOpenTask)
    expect(screen.getByText(en['launch.profile.none'])).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en['launch.profile.onboard'] }))
    await waitFor(() => expect(onOpenTask).toHaveBeenCalledWith('t-onboard'))
    expect(api.onboard).toHaveBeenCalledWith('p1')
  })

  it('says when the onboarding task could not be filed, and the button works again', async () => {
    // A project with no profile has no relations either: an agent records them with the rest (iteration 2, ER-9).
    install({ relations: vi.fn(async () => []), onboard: vi.fn(async () => { throw new Error('journal refused') }) })
    show(base)
    fireEvent.click(screen.getByRole('button', { name: en['launch.profile.onboard'] }))
    await waitFor(() => expect(screen.getByText(en['launch.profile.onboardFailed'])).toBeTruthy())
    expect((screen.getByRole('button', { name: en['launch.profile.onboard'] }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('with a profile, shows the goal, the plan, the relations and the people from Git', async () => {
    install()
    show({ ...base, profiled_at: '2026-10-23T00:00:00Z', goal: 'Steer every project', summary: 'The CEO agent', plan: { done: ['0.3.11'], next: ['0.3.12'] } })
    expect(screen.getByText('Steer every project')).toBeTruthy()
    expect(screen.getByText('The CEO agent')).toBeTruthy()
    expect(screen.getByText('0.3.11')).toBeTruthy()
    expect(screen.getByText('0.3.12')).toBeTruthy()
    expect(screen.queryByRole('button', { name: en['launch.profile.onboard'] })).toBeNull()
    await waitFor(() => expect(screen.getByText(/Depends on fabric-agent-contract/)).toBeTruthy())
    await waitFor(() => expect(screen.getByText(/Ada, 12 commits/)).toBeTruthy())
  })

  // 0.3.12 review, iteration 2, ER-9: an agent told to leave out what it cannot find recorded a plan and no goal, and the
  // page offered «Get to know the project» again and hid the plan.
  it('a recorded plan with no goal or summary counts as onboarded, and the plan shows', async () => {
    install({ relations: vi.fn(async () => []) })
    show({ ...base, profiled_at: '2026-10-23T00:00:00Z', profiled_by: 'agent', goal: null, summary: null, plan: { done: [], next: ['Ship 0.3.12'] } } as ProjectRow)
    expect(screen.getByText('Ship 0.3.12')).toBeTruthy()
    expect(screen.queryByRole('button', { name: en['launch.profile.onboard'] })).toBeNull()
    expect(screen.queryByText(en['launch.profile.none'])).toBeNull()
  })
  it('recorded relations alone count as onboarded too, once they are read', async () => {
    install()
    show({ ...base, goal: null, summary: null, plan: null } as ProjectRow)
    await waitFor(() => expect(screen.getByText(/Depends on fabric-agent-contract/)).toBeTruthy())
    expect(screen.queryByRole('button', { name: en['launch.profile.onboard'] })).toBeNull()
  })
  // 0.3.12 review, iteration 2, UX-7: "Ann, 1 commits".
  it('counts one commit in the singular, and a few in Russian\'s own form', async () => {
    install({ people: vi.fn(async () => ({ people: [{ name: 'Ada', email: 'ada@example.invalid', commits: 1, lastAt: '2026-10-20T10:00:00Z' }], unread: [], read: 1 })) })
    show(base)
    await waitFor(() => expect(screen.getByText(/Ada, 1 commit,/)).toBeTruthy())
    cleanup()
    install({ people: vi.fn(async () => ({ people: [{ name: 'Ada', email: 'ada@example.invalid', commits: 2, lastAt: '2026-10-20T10:00:00Z' }], unread: [], read: 1 })) })
    render(<I18nProvider locale="ru"><ProjectProfile project={base} feedMark={0} onOpenTask={vi.fn()} /></I18nProvider>)
    await waitFor(() => expect(screen.getByText(/Ada: 2 коммита,/)).toBeTruthy())
  })

  it('keeps the offer when only the person\'s business was recorded, and never says an agent recorded no goal (DA-3)', async () => {
    install()
    // Setting the business journals project.profiled@1 too, which stamps profiled_at; no agent has run.
    show({ ...base, business: 'PassionCode', profiled_at: '2026-10-23T00:00:00Z', profiled_by: 'operator', goal: null, summary: null })
    expect(screen.getByRole('button', { name: en['launch.profile.onboard'] })).toBeTruthy()
    expect(screen.getByText(en['launch.profile.none'])).toBeTruthy()
    expect(screen.queryByText(en['launch.profile.noGoal'])).toBeNull()
    expect((screen.getByLabelText(en['launch.profile.business']) as HTMLInputElement).value).toBe('PassionCode')
  })

  it('saves the business the person types, once, and says when it was not saved', async () => {
    const api = install()
    show({ ...base, business: 'PassionCode' })
    const field = screen.getByLabelText(en['launch.profile.business']) as HTMLInputElement
    expect(field.value).toBe('PassionCode')
    fireEvent.blur(field)
    expect(api.setBusiness).not.toHaveBeenCalled()
    fireEvent.change(field, { target: { value: 'Appvillis' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    await waitFor(() => expect(api.setBusiness).toHaveBeenCalledWith('p1', 'Appvillis'))
    cleanup()
    install({ setBusiness: vi.fn(async () => { throw new Error('refused') }) })
    show(base)
    const again = screen.getByLabelText(en['launch.profile.business']) as HTMLInputElement
    fireEvent.change(again, { target: { value: 'X' } })
    fireEvent.blur(again)
    await waitFor(() => expect(screen.getByText(en['launch.profile.businessFailed'])).toBeTruthy())
  })

  it('says a read it could not make, never an empty list', async () => {
    install({ relations: vi.fn(async () => { throw new Error('no table') }), people: vi.fn(async () => { throw new Error('git gone') }) })
    show(base)
    await waitFor(() => expect(screen.getByText(en['launch.profile.relationsUnreadable'])).toBeTruthy())
    await waitFor(() => expect(screen.getByText(en['launch.profile.peopleUnreadable'])).toBeTruthy())
    expect(screen.queryByText(en['launch.profile.noRelations'])).toBeNull()
  })

  it('says the history could not be read, with its folders, when no repository was read; never «no commits» (UX-6, ER-3)', async () => {
    install({ people: vi.fn(async () => ({ people: [], unread: [{ path: '/w/plain', reason: 'fatal: not a git repository' }], read: 0 })) })
    show(base)
    await waitFor(() => expect(screen.getByText(en['launch.profile.peopleUnread'])).toBeTruthy())
    expect(screen.getByText('/w/plain: fatal: not a git repository')).toBeTruthy()
    expect(screen.queryByText(en['launch.profile.noPeople'])).toBeNull()
    expect(screen.queryByText(/people above/i)).toBeNull()
  })

  it('with part of the history unread, never says «the people above» when none is shown, and counts one repository in the singular', async () => {
    install({ people: vi.fn(async () => ({ people: [], unread: [{ path: '/w/b', reason: 'fatal: bad object' }], read: 1 })) })
    show(base)
    await waitFor(() => expect(screen.getByText(en['launch.profile.noPeopleSome'])).toBeTruthy())
    expect(screen.queryByText(/people above/i)).toBeNull()
    expect(screen.queryByText(en['launch.profile.noPeople'])).toBeNull()
    cleanup()
    install({ people: vi.fn(async () => ({ people: [{ name: 'Ada', email: 'ada@example.invalid', commits: 2, lastAt: '2026-10-20T10:00:00Z' }], unread: [{ path: '/w/b', reason: 'fatal: bad object' }], read: 1 })) })
    show(base)
    await waitFor(() => expect(screen.getByText(en['launch.profile.peopleSomeOne'])).toBeTruthy())
    expect(screen.queryByText(/1 repositories/)).toBeNull()
    expect(screen.getByText('/w/b: fatal: bad object')).toBeTruthy()
  })
})

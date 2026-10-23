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
    people: vi.fn(async () => ({ people: [{ name: 'Ada', email: 'ada@example.invalid', commits: 12, lastAt: '2026-10-20T10:00:00Z' }], unread: [] })),
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
    const api = install()
    const onOpenTask = vi.fn()
    show(base, onOpenTask)
    expect(screen.getByText(en['launch.profile.none'])).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en['launch.profile.onboard'] }))
    await waitFor(() => expect(onOpenTask).toHaveBeenCalledWith('t-onboard'))
    expect(api.onboard).toHaveBeenCalledWith('p1')
  })

  it('says when the onboarding task could not be filed, and the button works again', async () => {
    install({ onboard: vi.fn(async () => { throw new Error('journal refused') }) })
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
})

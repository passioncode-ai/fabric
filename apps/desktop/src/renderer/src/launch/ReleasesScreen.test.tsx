import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ReleasesScreen } from './ReleasesScreen'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import type { ReleaseCommandResult, ReleaseEntry } from '../../../shared/releases.ts'
import type { ProjectRow } from '../../../shared/types'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const projects = [{ id: 'p1', name: 'Atlas', status: 'active' }, { id: 'p2', name: 'Studio', status: 'active' }] as unknown as ProjectRow[]
const release = (over: Partial<ReleaseEntry>): ReleaseEntry => ({
  id: 'r0000000-0000-4000-8000-000000000001', projectId: 'p1', projectName: 'Atlas', name: 'Atlas 0.4.2', environment: 'Demo / local',
  summary: 'History survives a change of session', recordedAt: '2026-09-14T18:42:00Z', seq: 2, tasks: [], decisions: [],
  rollsBack: null, rolledBackBy: null, outcome: null, receipt: null, verifiedAt: null, status: 'candidate', ...over
})
const ok = (data: ReleaseEntry[], sources = [{ name: 'releases', status: 'ok' }, { name: 'tasks', status: 'ok' }]) => ({ data, sources })

function mount({ list = ok([]) as unknown, record = vi.fn(async (): Promise<ReleaseCommandResult> => ({ state: 'committed', repeated: false, seq: 9, releaseId: 'new' })),
  verify = vi.fn(async (): Promise<ReleaseCommandResult> => ({ state: 'committed', repeated: false, seq: 10, releaseId: 'x' })), projectId = null as string | null,
  tasks = [{ id: 't1', status: 'done', title: 'Link the runs', instruction: 'x' }, { id: 't2', status: 'backlog', title: 'Later', instruction: 'y' }] } = {}) {
  const api = {
    releases: { list: vi.fn(async () => list), record, verify },
    tasks: { list: vi.fn(async () => ({ tasks, closed: { truncated: false, says: '' } })) },
    decisions: { list: vi.fn(async () => ({ lineages: [{ current: { id: 'd1', claim: 'History belongs to the project' }, replaced: [] }], orphans: [], coverage: {} })) }
  }
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: api }))
  const on = { onPulse: vi.fn(), onBoard: vi.fn() }
  render(<I18nProvider locale="en"><ReleasesScreen projects={projects} feed={[]} projectId={projectId} {...on} /></I18nProvider>)
  return { api, record, verify, ...on }
}

describe('releases with their basis (launch-releases)', () => {
  it('shows what went in, why, and a candidate as a candidate — the plan is not the result', async () => {
    mount({ list: ok([release({ tasks: [{ id: 't1', text: 'Link the runs' }, { id: 't9abcdef', text: null }], decisions: [{ id: 'd1', text: 'History belongs to the project' }] })]) })
    const detail = await screen.findByRole('region', { name: 'Atlas 0.4.2' })
    expect(within(detail).getByText('Link the runs')).toBeTruthy()
    expect(within(detail).getByText(en['launch.releases.unreadRef'].replace('{id}', 't9abcdef')), 'an unread task vanished from what went in').toBeTruthy()
    expect(within(detail).getByText('History belongs to the project')).toBeTruthy()
    expect(within(detail).getByText(en['launch.releases.verify.candidate'])).toBeTruthy()
    expect(within(detail).getAllByText(en['launch.releases.status.candidate']).length).toBeGreaterThan(0)
    expect(document.body.textContent, 'a raw registry key reached the screen').not.toMatch(/launch\.releases\./)
  })

  it('a rolled-back release keeps its record and names what replaced it; it offers no second rollback', async () => {
    const old = release({ id: 'old', name: 'Atlas 0.4.1', status: 'rolled_back', outcome: 'accepted', receipt: 'demo-check-041', rolledBackBy: 'new', seq: 1 })
    const back = release({ id: 'new', name: 'Atlas 0.4.0 again', rollsBack: 'old', seq: 3 })
    mount({ list: ok([back, old]) })
    fireEvent.click(await screen.findByRole('button', { name: /Atlas 0\.4\.1/ }))
    const detail = screen.getByRole('region', { name: 'Atlas 0.4.1' })
    expect(within(detail).getByText(en['launch.releases.verify.accepted'].replace('{receipt}', 'demo-check-041'))).toBeTruthy()
    expect(within(detail).getByText(en['launch.releases.rolledBackBy'].replace('{name}', 'Atlas 0.4.0 again'))).toBeTruthy()
    expect(within(detail).queryByRole('button', { name: en['launch.releases.rollback'] })).toBeNull()
  })

  it('project tabs narrow the list; «All projects» names each release\'s project', async () => {
    mount({ list: ok([release({ id: 'b', projectId: 'p2', projectName: 'Studio', name: 'Studio 0.2.1', seq: 3 }), release({ id: 'a' })]) })
    await screen.findByRole('region', { name: 'Studio 0.2.1' })
    expect(screen.getByRole('button', { name: /Studio 0\.2\.1.*Studio/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Atlas' }))
    expect(screen.queryByRole('button', { name: /Studio 0\.2\.1/ })).toBeNull()
    expect(screen.getByRole('region', { name: 'Atlas 0.4.2' })).toBeTruthy()
  })

  it('no releases is said honestly; an unread source is not presented as none', async () => {
    mount()
    await waitFor(() => expect(screen.getByText(en['launch.releases.empty.title'])).toBeTruthy())
    cleanup()
    mount({ list: ok([], [{ name: 'releases', status: 'error' }]) })
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/releases/))
    expect(screen.queryByText(en['launch.releases.empty.title']), 'an unread source read as «no releases»').toBeNull()
  })

  it('records a release with the finished tasks and decisions chosen, then shows it', async () => {
    const { api, record } = mount({ projectId: 'p1' })
    fireEvent.click(await screen.findByRole('button', { name: en['launch.releases.record'] }))
    fireEvent.change(screen.getByLabelText(en['launch.releases.form.name']), { target: { value: 'Atlas 0.4.2' } })
    fireEvent.change(screen.getByLabelText(en['launch.releases.form.environment']), { target: { value: 'Demo / local' } })
    await waitFor(() => expect(screen.getByLabelText(/Link the runs/)).toBeTruthy())
    expect(screen.queryByLabelText(/Later/), 'a task not finished was offered as what went in').toBeNull()
    fireEvent.click(screen.getByLabelText(/Link the runs/))
    fireEvent.click(screen.getByLabelText(/History belongs to the project/))
    fireEvent.click(screen.getByRole('button', { name: en['launch.releases.save'] }))
    await waitFor(() => expect(record).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'p1', name: 'Atlas 0.4.2', environment: 'Demo / local', taskIds: ['t1'], decisionIds: ['d1'], rollsBack: null
    })))
    await waitFor(() => expect(api.releases.list).toHaveBeenCalledTimes(2))
  })

  it('an unconfirmed record keeps the same attempt, so a retry cannot record it twice; a refusal says why', async () => {
    const record = vi.fn(async (): Promise<ReleaseCommandResult> => ({ state: 'unconfirmed' }))
    mount({ projectId: 'p1', record })
    fireEvent.click(await screen.findByRole('button', { name: en['launch.releases.record'] }))
    fireEvent.change(screen.getByLabelText(en['launch.releases.form.name']), { target: { value: 'Atlas 0.4.2' } })
    fireEvent.change(screen.getByLabelText(en['launch.releases.form.environment']), { target: { value: 'Demo' } })
    fireEvent.click(screen.getByRole('button', { name: en['launch.releases.save'] }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(en['launch.releases.unconfirmed']))
    fireEvent.click(screen.getByRole('button', { name: en['launch.releases.save'] }))
    await waitFor(() => expect(record).toHaveBeenCalledTimes(2))
    const [first, second] = record.mock.calls.map((c) => (c as unknown as [{ commandId: string; releaseId: string }])[0])
    expect(second.commandId, 'a retry became a second act').toBe(first.commandId)
    expect(second.releaseId).toBe(first.releaseId)
    record.mockResolvedValueOnce({ state: 'refused', refusal: 'not_in_project' })
    fireEvent.click(screen.getByRole('button', { name: en['launch.releases.save'] }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(en['launch.releases.refused.not_in_project']))
  })

  it('a rollback is a new release naming the one it replaces, in the same environment', async () => {
    const { record } = mount({ list: ok([release({ status: 'verified', outcome: 'accepted', receipt: 'demo' })]) })
    fireEvent.click(await screen.findByRole('button', { name: en['launch.releases.rollback'] }))
    expect(screen.getByRole('heading', { name: en['launch.releases.form.rollbackTitle'].replace('{name}', 'Atlas 0.4.2') })).toBeTruthy()
    expect((screen.getByLabelText(en['launch.releases.form.environment']) as HTMLInputElement).value).toBe('Demo / local')
    fireEvent.change(screen.getByLabelText(en['launch.releases.form.name']), { target: { value: 'Atlas 0.4.1 again' } })
    fireEvent.click(screen.getByRole('button', { name: en['launch.releases.save'] }))
    await waitFor(() => expect(record).toHaveBeenCalledWith(expect.objectContaining({ rollsBack: 'r0000000-0000-4000-8000-000000000001', projectId: 'p1' })))
  })

  it('records a verification with its outcome and receipt; the board is one step away', async () => {
    const { verify, onBoard } = mount({ list: ok([release({})]) })
    fireEvent.click(await screen.findByRole('button', { name: en['launch.releases.verifyAct'] }))
    fireEvent.click(screen.getByLabelText(en['launch.releases.outcome.failed']))
    const save = screen.getByRole('button', { name: en['launch.releases.save'] }) as HTMLButtonElement
    expect(save.disabled, 'a verification without its receipt could be recorded').toBe(true)
    fireEvent.change(screen.getByLabelText(en['launch.releases.receipt']), { target: { value: 'Returned the pack of another run' } })
    fireEvent.click(save)
    await waitFor(() => expect(verify).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'failed', receipt: 'Returned the pack of another run', projectId: 'p1' })))
    fireEvent.click(screen.getByRole('button', { name: en['launch.releases.toBoard'] }))
    expect(onBoard).toHaveBeenCalledWith('p1')
  })
})

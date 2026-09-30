import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PulseScreen } from './PulseScreen'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { FEED_WINDOW } from '../../../shared/homeView.ts'
import type { FeedEvent, ProjectRow, TerminalSession } from '../../../shared/types'

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-29T12:00:00')) })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })
const projects = [{ id: 'p1', name: 'Atlas', status: 'active' }, { id: 'p2', name: 'Studio', status: 'active' }] as unknown as ProjectRow[]
const ev = (seq: number, at: string, type: string, project: string | null = 'p1', actor = 'agent'): FeedEvent =>
  ({ estate_id: 'e', seq, type, actor: { kind: actor, id: 'x' }, project_id: project, occurred_at: at, payload: {} })

function mount({ feed = [ev(1, '2026-09-29T09:00:00', 'question.answered@1', 'p1', 'person'), ev(2, '2026-09-29T10:00:00', 'task.created@1'), ev(3, '2026-09-28T10:00:00', 'task.created@1', 'p2')] as FeedEvent[] | null,
  sessions = [] as TerminalSession[] | null, routines = [] as unknown[], projectId = null as string | null,
  releases = { data: [], sources: [{ name: 'releases', status: 'ok' }] } as unknown } = {}) {
  const api = {
    runs: { status: vi.fn(async () => ({ data: { observation: { liveness: 'waiting' }, claim: { phase: 'blocked' } } })) },
    routines: { list: vi.fn(async () => routines) },
    windows: { openSession: vi.fn(async () => {}) },
    releases: { list: vi.fn(async () => releases) }
  }
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: api }))
  const on = { onBoard: vi.fn(), onProject: vi.fn(), onReleases: vi.fn() }
  render(<I18nProvider locale="en"><PulseScreen projects={projects} feed={feed} sessions={sessions} projectId={projectId} {...on} /></I18nProvider>)
  return { api, ...on }
}

describe('the pulse (SCR-42)', () => {
  it('opens on today, lists its events newest first, and filters decisions apart', async () => {
    mount()
    expect(screen.getByRole('heading', { name: '2026-09-29' })).toBeTruthy()
    const titles = () => [...document.querySelectorAll('.fp-event b')].map((b) => b.textContent)
    expect(titles()).toEqual([en['event.task.created@1'], en['event.question.answered@1']])
    fireEvent.click(screen.getByRole('button', { name: en['launch.pulse.kind.decision'] }))
    expect(titles()).toEqual([en['event.question.answered@1']])
    expect(document.body.textContent, 'a raw registry key reached the screen').not.toMatch(/launch\.pulse\.|event\./)
  })

  it('a day the window cannot see is unknown, never a quiet day — even for one project', async () => {
    const full = Array.from({ length: FEED_WINDOW }, (_, i) => ev(i + 1, i === 0 ? '2026-09-20T10:00:00' : '2026-09-27T10:00:00', 'task.created@1', i % 2 ? 'p1' : 'p2'))
    mount({ feed: full, projectId: 'p1' })
    fireEvent.change(screen.getByLabelText(en['launch.pulse.dayLabel']), { target: { value: '2026-09-19' } })
    expect(screen.getByText(en['launch.pulse.notRead'])).toBeTruthy()
    fireEvent.change(screen.getByLabelText(en['launch.pulse.dayLabel']), { target: { value: '2026-09-22' } })
    expect(screen.getByText(en['launch.pulse.none']), 'a visible quiet day was called unknown').toBeTruthy()
  })

  it('names what was observed of a running session, apart from what the agent says', async () => {
    mount({ sessions: [{ sessionId: 's1', projectId: 'p1', program: 'claude', running: true }] as unknown as TerminalSession[] })
    await waitFor(() => expect(screen.getByText(en['launch.agent.liveness.waiting'])).toBeTruthy())
    expect(screen.getByText(en['launch.agent.claims'].replace('{phase}', en['launch.agent.phase.blocked']))).toBeTruthy()
  })

  it('says when no cycle is on, and names the next one when there is', async () => {
    mount()
    await waitFor(() => expect(screen.getByText(en['launch.pulse.noCycles'])).toBeTruthy())
    cleanup()
    mount({ routines: [{ id: 'r1', project_id: 'p1', instruction: 'Morning review', option_id: 'claude-code', every_minutes: 240, kind: 'fixed', enabled: true, last_run_at: null, last_task_id: null }] })
    await waitFor(() => expect(screen.getByText('Morning review')).toBeTruthy())
    expect(screen.getByText(en['launch.pulse.neverRan'])).toBeTruthy()
  })

  it('shows the latest release that STANDS verified — never a candidate, never one rolled back — and opens it', async () => {
    const rel = (id: string, status: string, name: string) => ({ id, projectId: 'p1', name, environment: 'Demo / local', summary: null, recordedAt: '2026-09-28T10:00:00Z', status })
    const { onReleases } = mount({ releases: { data: [rel('c', 'candidate', 'Atlas 0.4.3'), rel('b', 'rolled_back', 'Atlas 0.4.2'), rel('a', 'verified', 'Atlas 0.4.1')], sources: [{ name: 'releases', status: 'ok' }] } })
    await waitFor(() => expect(screen.getByText('Atlas 0.4.1')).toBeTruthy())
    expect(screen.queryByText('Atlas 0.4.3'), 'a candidate was offered as a result').toBeNull()
    fireEvent.click(screen.getByRole('button', { name: en['launch.pulse.releaseOpen'] }))
    expect(onReleases).toHaveBeenCalledWith({ id: 'a', projectId: 'p1' })
    fireEvent.click(screen.getByRole('button', { name: en['launch.pulse.releases'] }))
    expect(onReleases).toHaveBeenLastCalledWith()
  })

  it('an unread release source is said, never read as «no verified release»', async () => {
    mount({ releases: { data: [], sources: [{ name: 'releases', status: 'error', errorCode: 'x' }] } })
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/releases/))
    expect(screen.queryByText(en['launch.pulse.noVerified'])).toBeNull()
  })
})

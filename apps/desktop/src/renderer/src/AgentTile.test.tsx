// The chip that only refreshed when the terminal printed (AX-02).
//
// `AgentTile` read `runs.status` on `[session.sessionId,
// session.lastActivityAt]`, and `lastActivityAt` moves only when the PTY
// prints something. So every change the widget exists to show was invisible to
// it: a heartbeat that STOPS produces no output, an answered question produces
// no output, and a host waking from sleep produces no output. The chip said
// `working` for exactly as long as the agent stayed silent — the one moment it
// needed to say something else.
//
// The card's positive acceptance in its own words: "data updates with no PTY
// output refresh widget". These cases drive the real component with a fake
// clock, because the trigger is an interval and a probe that cannot advance
// time cannot see one.
//
// AND A RETAINED SNAPSHOT SAYS ITS AGE. A failed refresh leaves the tile as it
// was, which is right — a widget must not blank the thing it decorates — but
// until now nothing said the answer had stopped being refreshed, so a reading
// from ten minutes ago looked exactly like one from a second ago.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { AgentTile } from './ProjectHome'
import { I18nProvider } from './i18n'
import { POLL_MS } from '../../shared/repoWatch'
import type { TerminalSession } from '../../shared/types'
import type { RunStatusView } from '../../shared/runStatus'

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  visible('visible')
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
  vi.unstubAllGlobals()
})

/** `document.visibilityState` is getter-only, so `Object.assign` throws on it —
 *  the poll guard reads it and a probe has to be able to move it. */
const visible = (state: 'visible' | 'hidden'): void => {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
}

const session = (over: Partial<TerminalSession> = {}): TerminalSession =>
  ({
    sessionId: 's-1',
    projectId: 'p1',
    cwd: '/x',
    program: 'claude',
    optionId: 'claude-code',
    permissionMode: null,
    excerpt: '',
    written: 0,
    running: true,
    state: 'running',
    startedAt: '2026-09-10T00:00:00Z',
    lastActivityAt: '2026-09-10T00:00:00Z',
    tail: '',
    exitCode: null,
    ...over
  }) as TerminalSession

const view = (liveness: string, coverage = 'available'): RunStatusView =>
  ({
    taskId: null,
    taskTitle: null,
    runRef: null,
    ordinal: null,
    runState: null,
    runOutcome: null,
    claim: { phase: null, reportedAt: null, waitingOn: null },
    observation: {
      liveness,
      reason: 'because',
      coverage,
      processRunning: true,
      lastOutputAt: null
    },
    blockers: 0,
    steps: { done: 0, declared: 0, skipped: 0, failed: 0 }
  }) as unknown as RunStatusView

function stub(answers: RunStatusView[], asOf?: string) {
  let n = 0
  const status = vi.fn(async () => {
    const data = answers[Math.min(n, answers.length - 1)]
    n++
    return { data, sources: [], asOf: asOf ?? new Date().toISOString(), availability: 'complete', freshness: 'fresh' }
  })
  vi.stubGlobal(
    'window',
    Object.assign(globalThis.window ?? {}, {
      fabric: { runs: { status }, windows: { openSession: vi.fn(async () => {}) }, terminal: { end: vi.fn() } }
    })
  )
  return { status }
}

const show = (s: TerminalSession) =>
  render(
    <I18nProvider locale="en">
      <AgentTile session={s} claim={null} onSessionsChanged={async () => {}} onError={vi.fn()} />
    </I18nProvider>
  )

describe('the chip refreshes without the terminal printing', () => {
  it('re-reads the status on a bounded tick', async () => {
    // THE DEFECT. Nothing about this session changes: no output, no new
    // activity timestamp. The estate's answer changes, and the widget has to
    // notice.
    const { status } = stub([view('working'), view('stalled')])
    show(session())
    await waitFor(() => expect(screen.getByText('working')).toBeTruthy())
    expect(status, 'the fixture must have answered once before the tick').toHaveBeenCalledTimes(1)

    // Time passes. The terminal prints nothing.
    await vi.advanceTimersByTimeAsync(POLL_MS + 100)
    await waitFor(() => expect(status.mock.calls.length).toBeGreaterThan(1))
    await waitFor(() =>
      expect(
        screen.getByText('stalled'),
        'the chip never re-read, so a stalled agent kept reading as working'
      ).toBeTruthy()
    )
  })

  it('and does not poll while the window is hidden', async () => {
    // The other direction, so the fix is not "poll forever": a background
    // window asking every ten seconds is a cost nobody sees and nobody wants.
    const { status } = stub([view('working')])
    show(session())
    await waitFor(() => expect(status).toHaveBeenCalledTimes(1))
    visible('hidden')
    await vi.advanceTimersByTimeAsync(POLL_MS * 3)
    expect(status, 'a hidden window kept polling').toHaveBeenCalledTimes(1)
  })
})

describe('a retained reading says how old it is', () => {
  it('shows the age once the snapshot is stale', async () => {
    // The reading is old on arrival, which is what a retained snapshot looks
    // like after a failed refresh.
    const old = new Date(Date.now() - POLL_MS * 10).toISOString()
    stub([view('working')], old)
    show(session())
    await waitFor(() => expect(screen.getByText('working')).toBeTruthy())
    await waitFor(() =>
      expect(
        screen.getByRole('status').textContent,
        'a stale reading was shown as though it were current'
      ).toMatch(/read .* ago/)
    )
  })

  it('but a fresh one carries no age at all', async () => {
    // An age on every reading is noise, and noise teaches the operator to skip
    // the one that matters.
    stub([view('working')], new Date().toISOString())
    show(session())
    await waitFor(() => expect(screen.getByText('working')).toBeTruthy())
    expect(screen.queryByRole('status'), 'a fresh reading announced its age').toBeNull()
  })
})

describe('a reading that rests on nothing observed is not a confident state', () => {
  it('keeps the chip quiet when the coverage is unobserved', async () => {
    // M181's rule, and AX-02's third negative acceptance from the UI side: an
    // unread input degrades the coverage, and a degraded coverage must not be
    // painted as a diagnosis.
    stub([view('stalled', 'unobserved')])
    show(session())
    await waitFor(() => expect(screen.getByText('stalled')).toBeTruthy())
    const chip = screen.getByText('stalled').closest('span')
    expect(chip?.className, 'an unobserved reading was painted as a confident state').not.toMatch(/danger|warn/)
  })
})

// SCN-035 (audit 2026-10-05 A2-045): the claim says it is the agent speaking, says how long ago, and is marked
// when it falls more than two minutes behind the last thing Fabric observed (`ProjectHome.tsx#claimIsBehind`).
describe('what the agent says, beside what Fabric saw', () => {
  const claimAt = (reportedAt: string) => ({ sessionId: 's-1', stage: 'running tests', step: 2, ofSteps: 5, note: null, reportedAt })
  const tile = (s: TerminalSession, reportedAt: string | null) =>
    render(
      <I18nProvider locale="en">
        <AgentTile session={s} claim={reportedAt ? claimAt(reportedAt) : null} onSessionsChanged={async () => {}} onError={vi.fn()} />
      </I18nProvider>
    )

  it('names the agent as the source and carries the age', async () => {
    stub([view('working')])
    const now = Date.now()
    const { container } = tile(session({ lastActivityAt: new Date(now).toISOString() }), new Date(now - 30_000).toISOString())
    const claim = container.querySelector('.claim')
    expect(claim?.querySelector('.claim-label')?.textContent).toBe('the agent says')
    expect(claim?.querySelector('.claim-stage')?.textContent).toBe('running tests · step 2 of 5')
    expect(claim?.querySelector('.claim-age')?.textContent, 'a claim without its age reads as current').toBe(' · said 30s ago')
    expect(claim?.className, 'a thirty-second-old account was marked stale').toBe('claim')
  })

  it('marks an account more than two minutes behind the last observed output', async () => {
    stub([view('working')])
    const now = Date.now()
    const { container } = tile(session({ lastActivityAt: new Date(now).toISOString() }), new Date(now - 180_000).toISOString())
    const claim = container.querySelector('.claim')
    expect(claim?.className, 'an agent that stopped narrating was not marked').toBe('claim claim-stale')
    expect(claim?.querySelector('.claim-age')?.getAttribute('title')).toBe('this account is older than the last thing Fabric saw')
  })

  it('and a session nothing reported for shows no claim at all', async () => {
    stub([view('working')])
    const { container } = tile(session({ optionId: 'shell' }), null)
    expect(container.querySelector('.claim')).toBeNull()
  })
})

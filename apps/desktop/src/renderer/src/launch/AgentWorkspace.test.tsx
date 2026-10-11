import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ConsoleDetails, ContextTab, RUN_STATUS_POLL_MS, RunCallout, useRunStatus } from './AgentWorkspace'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const wrap = (node: React.ReactNode) => render(<I18nProvider locale="en">{node}</I18nProvider>)
const stub = (fabric: Record<string, unknown>) => vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric }))

describe('the agent workspace (SCR-39)', () => {
  it('says how a run stands in words, keeping the agent\'s claim apart from what was observed', () => {
    const view = { data: { observation: { liveness: 'waiting', lastOutputAt: '2026-09-29T09:18:00Z' }, claim: { phase: 'blocked' } } }
    wrap(<RunCallout sessionId="s1" status={{ view: view as never, failed: null }} />)
    expect(screen.getByText(en['launch.agent.liveness.waiting'])).toBeTruthy()
    expect(document.body.textContent).toContain(en['launch.agent.claims'].replace('{phase}', en['launch.agent.phase.blocked']))
    expect(document.body.textContent).toContain(en['launch.agent.timeIsNotWork'])
    expect(document.body.textContent, 'a machine word reached the screen').not.toMatch(/\bwaiting\b(?! )|launch\.agent\./)
  })

  it('a task that never ran says so, and an unreadable status is said, not guessed', () => {
    wrap(<RunCallout sessionId={null} status={{ view: null, failed: null }} />)
    expect(screen.getByText(en['launch.agent.noRun'])).toBeTruthy()
    cleanup()
    wrap(<RunCallout sessionId="s1" status={{ view: null, failed: 'timeout' }} />)
    expect(screen.getByRole('alert').textContent).toContain('timeout')
  })

  it('shows the pack this run was given, or says it is not held — never the next one in its place', async () => {
    const context = vi.fn(async () => ({ held: false, why: 'no_packet', says: 'This run was started before packs were kept.' }))
    const preview = vi.fn(async () => ({ markdown: '# next', sha256: 'x', compilerRevision: 1, budget: 4000, chars: 6, includedFacts: 2, includedTranscripts: 1, omittedFacts: 0, omittedTranscripts: 0, read: {} }))
    stub({ transcripts: { context }, memory: { preview } })
    wrap(<ContextTab projectId="p1" sessionId="s1" />)
    await waitFor(() => expect(screen.getByText(en['launch.agent.context.notHeld'])).toBeTruthy())
    expect(preview, 'the next pack was read in place of the past one').not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: en['launch.agent.context.next'] }))
    await waitFor(() => expect(screen.getByText(en['launch.agent.context.nextTitle'])).toBeTruthy())
    expect(preview).toHaveBeenCalledWith('p1')
  })

  it('reads the console only when it is opened', async () => {
    const scrollback = vi.fn(async () => ({ text: 'npm test\n12 passing', written: 20 }))
    stub({ terminal: { scrollback } })
    wrap(<ConsoleDetails sessionId="s1" />)
    expect(scrollback, 'the console was read before anyone asked').not.toHaveBeenCalled()
    const details = document.querySelector('details.lp-console') as HTMLDetailsElement
    details.open = true
    fireEvent(details, new Event('toggle'))
    await waitFor(() => expect(screen.getByText(/12 passing/)).toBeTruthy())
  })
})

// Audit A5-018: the run's outcome reached the renderer and no component read it; the status was read once.
describe('how a run ended (A5-018)', () => {
  const ended = (runOutcome: string | null) => ({ data: { ordinal: 2, runState: 'ended', runOutcome, observation: { liveness: 'gone', lastOutputAt: null }, claim: { phase: null } } })

  it('an ended run says how it ended, in words', () => {
    wrap(<RunCallout sessionId="s1" status={{ view: ended('failed_known') as never, failed: null }} />)
    expect(document.body.textContent).toContain(en['launch.agent.runEnded'].replace('{outcome}', en['launch.agent.runOutcome.failed_known']))
    expect(document.body.textContent, 'a machine word reached the screen').not.toMatch(/failed_known|launch\.agent\./)
  })

  it('an unknown outcome — or none recorded — offers Check again, which reads the run once more', () => {
    const again = vi.fn()
    wrap(<RunCallout sessionId="s1" status={{ view: ended(null) as never, failed: null, again }} />)
    expect(document.body.textContent).toContain(en['launch.agent.runOutcome.outcome_unknown'])
    fireEvent.click(screen.getByRole('button', { name: en['launch.agent.checkAgain'] }))
    expect(again).toHaveBeenCalledTimes(1)
  })

  it('a known outcome offers nothing to check', () => {
    wrap(<RunCallout sessionId="s1" status={{ view: ended('completed') as never, failed: null, again: () => {} }} />)
    expect(screen.queryByRole('button', { name: en['launch.agent.checkAgain'] })).toBeNull()
  })

  it('the status is read again while the run has not ended, and no longer once it has', async () => {
    vi.useFakeTimers()
    try {
      const states = ['active', 'ended']
      const status = vi.fn(async () => ({ data: { ordinal: 1, runState: states.shift() ?? 'ended', runOutcome: 'completed', observation: { liveness: 'working', lastOutputAt: null }, claim: { phase: null } } }))
      stub({ runs: { status } })
      const Probe = (): React.JSX.Element => { const s = useRunStatus('s1'); return <p>{s.view?.data?.runState ?? 'none'}</p> }
      wrap(<Probe />)
      await vi.advanceTimersByTimeAsync(0)
      expect(status).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(RUN_STATUS_POLL_MS)
      expect(status).toHaveBeenCalledTimes(2)
      expect(screen.getByText('ended')).toBeTruthy()
      await vi.advanceTimersByTimeAsync(RUN_STATUS_POLL_MS * 3)
      expect(status, 'an ended run was polled').toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})

// The detached session window could not recover, and could not say it was gone
// (UXA-C04).
//
// MEASURED at `29f084d`, in sixty-four lines that contain four separate ways to
// lose the truth:
//
//   1. `error` IS NEVER CLEARED. The initial `get` catches into it, and the
//      render short-circuits on `error` before anything else. The five-second
//      poll keeps succeeding underneath and the window stays dead for the life
//      of the process — one transient hiccup on mount and the operator has to
//      close and reopen a window onto a session that is running fine.
//   2. THE POLL AND `onExit` HAVE NO CATCH. `void …then(…)` with no rejection
//      handler is an unhandled rejection every five seconds while the main
//      process is unreachable.
//   3. `then((s) => s && setSession(s))` DROPS THE ONE ANSWER THAT MATTERS.
//      `terminal.get` answers null for a session the main process no longer
//      has, and `s &&` throws that away — so a reaped session keeps rendering
//      its last-known state for ever. The `onExit` handler's own comment says
//      it exists so the header does not say "running" over a dead shell; the
//      null case defeats exactly that.
//   4. NO ALIVE GUARD. A `get` still in flight when `sessionId` changes lands
//      on the new window, which is the same overlap UXA-C01 fixed on the
//      estate home.
//
// And the error is rendered inside `EmptyState read` — this codebase's marker
// for a MEASUREMENT. An IPC failure presented as a measured fact about the
// session, which is the same misuse UXA-C02 removed from the CEO panel.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { SessionWindow } from './SessionWindow'
import { I18nProvider } from './i18n'
import { en } from './i18n/en'
import type { TerminalSession } from '../../shared/types'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const session = (over: Partial<TerminalSession> = {}): TerminalSession =>
  ({
    sessionId: 's1',
    projectId: 'p1',
    cwd: '/repo/atlas',
    program: 'claude',
    optionId: 'claude-code',
    permissionMode: null,
    excerpt: '',
    written: 0,
    running: true,
    state: 'running',
    startedAt: '2026-09-11T00:00:00Z',
    lastActivityAt: '2026-09-11T00:00:00Z',
    ...over
  }) as TerminalSession

function stub(get: (id: string) => Promise<TerminalSession | null>) {
  const exits: ((id: string) => void)[] = []
  vi.stubGlobal(
    'window',
    Object.assign(globalThis.window ?? {}, {
      fabric: {
        terminal: {
          get: vi.fn(get),
          onExit: (h: (id: string) => void) => {
            exits.push(h)
            return () => {}
          },
          scrollback: async () => ({ text: '', written: 0 }),
          onData: () => () => {},
          write: () => {},
          resize: () => {}
        }
      }
    })
  )
  return { exits }
}

const show = (sessionId = 's1') =>
  render(
    <I18nProvider locale="en">
      <SessionWindow sessionId={sessionId} />
    </I18nProvider>
  )

/** Drive the five-second poll without waiting five seconds. */
const tick = async (ms = 5100): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe('a window onto one session', () => {
  it('ignores a stale pending read after a newer verified Stop', async () => {
    let resolveOld!: (s: TerminalSession) => void
    let calls = 0
    const { exits } = stub(async () => ++calls === 1 ? new Promise<TerminalSession>(r => { resolveOld = r }) : session({ termination: {sessionId:'s1',state:'stopped',reasonCode:'termination_observed',receiptSeq:12} }))
    show()
    await act(async () => { exits[0]('s1') })
    expect(screen.getByText('Stop verified')).toBeTruthy()
    await act(async () => { resolveOld(session({ termination: {sessionId:'s1',state:'requested',reasonCode:'stop_requested'} })) })
    expect(screen.getByText('Stop verified')).toBeTruthy()
    expect(screen.queryByRole('button', {name:'Stopping…'})).toBeNull()
  })

  it('shows the session when the read answers — the fixture is the working case', async () => {
    stub(async () => session())
    show()
    await waitFor(() => expect(screen.getByText('/repo/atlas')).toBeTruthy())
  })

  it('RECOVERS when a failed first read is followed by a good one', async () => {
    // The window used to die on the first failure for the life of the process:
    // `error` is checked before everything and nothing ever cleared it, while
    // the poll went on succeeding underneath.
    let first = true
    stub(async () => {
      if (first) {
        first = false
        throw new Error('the bridge is not answering')
      }
      return session()
    })
    vi.useFakeTimers()
    show()
    await act(async () => {})
    expect(screen.getByText(/not answering/), 'the first read failed').toBeTruthy()
    await tick()
    expect(screen.getByText('/repo/atlas'), 'and the next one succeeded').toBeTruthy()
    expect(screen.queryByText(/not answering/)).toBeNull()
  })

  it('says the session is GONE when the main process no longer has it', async () => {
    // `then((s) => s && setSession(s))` dropped the null, so a reaped session
    // kept rendering as running — the exact thing the exit handler exists to
    // prevent, defeated by the case it does not handle.
    let alive = true
    stub(async () => (alive ? session() : null))
    vi.useFakeTimers()
    show()
    await act(async () => {})
    expect(screen.getByText('/repo/atlas')).toBeTruthy()
    alive = false
    await tick()
    expect(screen.getByText(en['session.gone'])).toBeTruthy()
  })

  it('keeps the session on screen when a REFRESH fails, and says the reading is stale', async () => {
    // A failed refresh is not a reason to take away a terminal the operator is
    // reading — the cheaper mistake, chosen and said. And the refusal must be
    // CAUGHT: the poll and the exit handler had no rejection handler at all, so
    // an unreachable main process produced an unhandled rejection every five
    // seconds. An uncaught one fails this file outright, which is the second
    // half of what this case watches.
    let good = true
    stub(async () => {
      if (good) {
        good = false
        return session()
      }
      throw new Error('the bridge went away')
    })
    vi.useFakeTimers()
    show()
    await act(async () => {})
    expect(screen.getByText('/repo/atlas')).toBeTruthy()
    await tick()
    expect(screen.getByText(/went away/), 'the failed refresh is said').toBeTruthy()
    expect(screen.getByText('/repo/atlas'), 'and the terminal is still there').toBeTruthy()
  })

  it('and the same holds when the EXIT handler re-reads and the read refuses', async () => {
    // The two re-reads are separate call sites and only one of them was ever
    // guarded. A rule held at one door of two is this cycle's commonest defect.
    let good = true
    const { exits } = stub(async () => {
      if (good) {
        good = false
        return session()
      }
      throw new Error('nobody is there')
    })
    vi.useFakeTimers()
    show()
    await act(async () => {})
    expect(screen.getByText('/repo/atlas')).toBeTruthy()
    await act(async () => {
      for (const fire of exits) fire('s1')
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.getByText(/nobody is there/)).toBeTruthy()
    expect(screen.getByText('/repo/atlas')).toBeTruthy()
  })
})

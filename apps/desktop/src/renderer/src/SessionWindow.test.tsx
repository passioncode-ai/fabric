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
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { SessionWindow } from './SessionWindow'
import { OpenConsoleContext } from './consoles'
import { I18nProvider } from './i18n'
import { en } from './i18n/en'
import { ru } from './i18n/ru'
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
        },
        // Who already works in the project (board task 4f83a67f): nobody, unless a test says otherwise.
        work: { launchCheck: vi.fn(async () => ({ overlaps: [], alsoWorking: [], console: [] })) }
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

  // 0.3.7 review UX-16: the failure is our sentence, the machine's words on their own line beneath it, never one paragraph.
  it('a separate window that did not open says so in our words, with the machine words on their own line', async () => {
    stub(async () => session())
    render(
      <I18nProvider locale="en">
        <SessionWindow sessionId="s1" onDetach={() => Promise.reject(Error("Error invoking remote method 'windows:open-session': Error: no display"))} />
      </I18nProvider>
    )
    ;(await screen.findByRole('button', { name: 'Open in a separate window' })).click()
    const note = await screen.findByRole('alert')
    expect(note.querySelector('.lp-meta')?.textContent).toBe('The separate window did not open.')
    expect(note.querySelector('.error-detail')?.textContent).toBe('no display')
  })

  // The operator, 2026-11-17: embedded under its tab, the console repeats no navigation (the top bar names the session);
  // the terminal fills the page, and one bar UNDER it holds the state, the folder (short, the whole path on hover), the
  // end of the session and the separate window.
  it('embedded: no second header, the terminal first and one bar under it with the state, folder and acts', async () => {
    stub(async () => session({ cwd: '/Users/example/DATA/atlas-desktop/Atlas desktop' }))
    const onDetach = vi.fn(async () => {})
    render(
      <I18nProvider locale="en">
        <SessionWindow sessionId="s1" onDetach={onDetach} />
      </I18nProvider>
    )
    const bar = await screen.findByRole('contentinfo', { name: en['session.bar'] })
    expect(document.querySelector('.session-head')).toBeNull()
    expect(screen.queryByText(/^←/)).toBeNull()
    const embedded = document.querySelector('.session-embedded')!
    expect([...embedded.children].map((c) => c.className)).toEqual(['terminal-host', 'session-bar'])
    const cwd = bar.querySelector('.session-cwd')!
    expect(cwd.textContent).toBe('…/atlas-desktop/Atlas desktop')
    expect(cwd.getAttribute('title')).toBe('/Users/example/DATA/atlas-desktop/Atlas desktop')
    expect(bar.querySelector('.as-status.s-working')).toBeTruthy()
    const end = within(bar).getByRole('button', { name: en['session.stop.action'] })
    expect(end.getAttribute('title')).toBe(en['session.stop.actionHelp'])
    expect(within(bar).queryByRole('button', { name: en['session.new'] })).toBeNull()
    within(bar).getByRole('button', { name: en['consoles.detach'] }).click()
    expect(onDetach).toHaveBeenCalled()
    expect(document.querySelector('.session-box')).toBeNull()
  })

  // The operator, 2026-11-19: «кнопка зависает а надо быстро закрыл и все». A press whose stop saw the process go leaves
  // at once (`shared/stop.ts#processGone`); a stop that could not see it stays, with «Проверить остановку».
  it('«Завершить сессию» closes the console at once once its process is gone, and only then', async () => {
    for (const [answer, closes] of [
      [{ sessionId: 's1', state: 'outcome_unknown', reasonCode: 'provider_termination_unproved', managed: false }, true],
      [{ sessionId: 's1', state: 'stopped', reasonCode: 'unmanaged_agent_observed', managed: false }, true],
      [{ sessionId: 's1', state: 'outcome_unknown', reasonCode: 'termination_unproved', managed: false }, false]
    ] as const) {
      stub(async () => session())
      const end = vi.fn(async () => answer)
      const dismiss = vi.fn(async () => {})
      Object.assign(window.fabric.terminal, { end, dismiss })
      render(
        <I18nProvider locale="en">
          <SessionWindow sessionId="s1" onDetach={async () => {}} />
        </I18nProvider>
      )
      const bar = await screen.findByRole('contentinfo', { name: en['session.bar'] })
      await act(async () => { within(bar).getByRole('button', { name: en['session.stop.action'] }).click() })
      await waitFor(() => expect(end).toHaveBeenCalledWith('s1', { force: false }))
      await waitFor(() => expect(dismiss).toHaveBeenCalledTimes(closes ? 1 : 0))
      cleanup()
    }
  })

  // The operator, 2026-11-17 («более качественные завершения»): once the session has ended, the bar offers what comes
  // next: a new session of the same coding agent in the same project, opened as its own console.
  it('an ended session offers a new one with the same agent and permissions, opened as its console', async () => {
    const opened = session({ sessionId: 's2' })
    const open = vi.fn(async () => opened)
    stub(async () => session({ running: false, state: 'ended', exitCode: 0, permissionMode: 'fewer-prompts' }))
    ;(window as unknown as { fabric: { terminal: Record<string, unknown> } }).fabric.terminal.open = open
    const openConsole = vi.fn(async () => {})
    render(
      <I18nProvider locale="en">
        <OpenConsoleContext.Provider value={openConsole}>
          <SessionWindow sessionId="s1" onDetach={async () => {}} />
        </OpenConsoleContext.Provider>
      </I18nProvider>
    )
    const again = await screen.findByRole('button', { name: en['session.new'] })
    expect(again.getAttribute('title')).toBe(en['session.newHelp'].replace('{runner}', 'Claude Code'))
    await act(async () => { again.click() })
    expect(open).toHaveBeenCalledWith('p1', 'claude-code', undefined, 'fewer-prompts')
    expect(openConsole).toHaveBeenCalledWith('s2')
  })

  it('0.3.23 review, iteration 1, UX-6: while the check reads who works, the button keeps its name and says no start', async () => {
    stub(async () => session({ running: false, state: 'ended', exitCode: 0 }))
    const fabric = (window as unknown as { fabric: { terminal: Record<string, unknown>; work: Record<string, unknown> } }).fabric
    let answer!: (v: unknown) => void
    fabric.work.launchCheck = vi.fn(() => new Promise((r) => { answer = r }))
    fabric.terminal.open = vi.fn(async () => session({ sessionId: 's2' }))
    render(<I18nProvider locale="en"><SessionWindow sessionId="s1" onDetach={async () => {}} /></I18nProvider>)
    const again = await screen.findByRole('button', { name: en['session.new'] })
    await act(async () => { again.click() })
    expect(again.textContent).toBe(en['session.new'])
    expect((again as HTMLButtonElement).disabled).toBe(true)
    await act(async () => { answer({ overlaps: [], console: [],
      alsoWorking: [{ claimId: 'c1', heldBy: 'other', agent: 'Codex', taskTitle: 'Board fix', since: new Date().toISOString(), why: [] }] }) })
    expect(fabric.terminal.open).not.toHaveBeenCalled()
  })

  it('board task 4f83a67f: a new session first says who already works in the project; it starts only when asked', async () => {
    const open = vi.fn(async () => session({ sessionId: 's2' }))
    stub(async () => session({ running: false, state: 'ended', exitCode: 0 }))
    const fabric = (window as unknown as { fabric: { terminal: Record<string, unknown>; work: Record<string, unknown> } }).fabric
    fabric.terminal.open = open
    fabric.work.launchCheck = vi.fn(async () => ({ overlaps: [], console: [],
      alsoWorking: [{ claimId: 'c1', heldBy: 'other', agent: 'Codex', taskTitle: 'Board fix', since: new Date().toISOString(), why: [] }] }))
    render(<I18nProvider locale="en"><SessionWindow sessionId="s1" onDetach={async () => {}} /></I18nProvider>)
    const again = await screen.findByRole('button', { name: en['session.new'] })
    await act(async () => { again.click() })
    expect(open).not.toHaveBeenCalled()
    expect(await screen.findByText(en['launchCheck.alsoTitle'])).toBeTruthy()
    // 0.3.23 review, iteration 1, UX-6: the check started nothing, so the button never said «Starting…».
    expect(screen.queryByRole('button', { name: en['session.newStarting'] })).toBeNull()
    await act(async () => { screen.getByRole('button', { name: en['launchCheck.wait'] }).click() })
    expect(screen.queryByText(en['launchCheck.alsoTitle'])).toBeNull()
    expect(open).not.toHaveBeenCalled()
    // UX-7: «Wait» takes the note away and gives the focus back to «New session».
    expect(document.activeElement).toBe(again)
    await act(async () => { again.click() })
    await act(async () => { (await screen.findByRole('button', { name: en['launchCheck.start'] })).click() })
    expect(open).toHaveBeenCalledWith('p1', 'claude-code', undefined, null)
  })

  it('a new session that does not start says so in our words, the machine words on their own line', async () => {
    stub(async () => session({ running: false, state: 'ended', exitCode: 0 }))
    ;(window as unknown as { fabric: { terminal: Record<string, unknown> } }).fabric.terminal.open = vi.fn(async () => { throw new Error('claude: command not found') })
    render(<I18nProvider locale="en"><SessionWindow sessionId="s1" onDetach={async () => {}} /></I18nProvider>)
    const again = await screen.findByRole('button', { name: en['session.new'] })
    await act(async () => { again.click() })
    const note = await screen.findByRole('alert')
    expect(note.querySelector('.lp-meta')?.textContent).toBe(en['session.newFailed'])
    expect(note.querySelector('.error-detail')?.textContent).toBe('claude: command not found')
  })

  // 0.3.22 review, iteration 2, ER-1: a detached window may not open a terminal (`terminalOpen` is main-only), so its
  // «New session» could only ever fail; the ended session's own window offers none.
  it('the separate window of an ended session offers no new session it could not start', async () => {
    stub(async () => session({ running: false, state: 'ended', exitCode: 0 }))
    render(<I18nProvider locale="en"><SessionWindow sessionId="s1" /></I18nProvider>)
    await screen.findByText('Claude Code')
    expect(screen.queryByRole('button', { name: en['session.new'] })).toBeNull()
  })

  // CO-472 (0.3.15 review UX-10): the console's header says the agent's status word and colour, as the agent page and the
  // rail do, from the one `sessionStatus` function; never the terminal's own state chip.
  it('CO-472: the header says the agent page\'s status word, not the terminal state', async () => {
    stub(async () => session({ state: 'idle' }))
    const { unmount } = render(<I18nProvider locale="ru"><SessionWindow sessionId="s1" /></I18nProvider>)
    await waitFor(() => expect(document.querySelector('.session-head .as-status.s-idle')).toBeTruthy())
    expect(document.querySelector('.session-head .as-status')?.textContent).toBe(ru['status.idle'])
    expect(document.querySelector('.session-head .chip')).toBeNull()
    unmount()
    stub(async () => session())
    render(<I18nProvider locale="ru"><SessionWindow sessionId="s1" /></I18nProvider>)
    await waitFor(() => expect(document.querySelector('.session-head .as-status.s-working')?.textContent).toBe(ru['agentScreen.state.working']))
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

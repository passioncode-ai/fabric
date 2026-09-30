// The estate agents panel showed a stale snapshot and called it output (UX28-13).
//
// SCR-39's panel has three columns and the middle one held
// `decodePty(agent.excerpt)` — the tail carried in every session listing,
// captured by whichever poll last ran. It is honestly LABELLED stale
// (`agents.outputStale`), which is why this was never a lie; it is simply not
// the session. So the card's positive acceptance — "typing reaches selected
// live session without detach" — was unreachable from here: there was nothing
// to type into.
//
// `TerminalView` already exists and `SessionWindow` already uses it, and the
// card says to use it rather than write another one ("do not create second
// decoder"). Everything below is about the ATTACH LIFECYCLE, because that is
// what the negative acceptance is about and what breaks when one view becomes
// two hosts:
//
//   switching A→B must not write A's bytes into B's terminal;
//   two attaches must not leave two PTY listeners;
//   a failed scrollback must not cost the live stream;
//   and closing the view must not end the session, which lives in main.
//
// XTERM IS MOCKED, deliberately and narrowly. Not to avoid jsdom — to make the
// bytes assertable: the mock's `write` records what each terminal received, so
// "B never showed A's output" is checked directly rather than inferred from
// listener bookkeeping. The byte-ORDERING rule is not re-tested here;
// `mergeReplay` owns it and says so in `TerminalView`'s own comment.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

/** Every terminal the run created, in mount order, with what it was written. */
const terminals: { writes: string[]; focused: number; disposed: boolean }[] = []

vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    writes: string[] = []
    focused = 0
    disposed = false
    constructor() {
      terminals.push(this as never)
    }
    open(): void {}
    loadAddon(): void {}
    write(data: string): void {
      this.writes.push(data)
    }
    focus(): void {
      this.focused++
    }
    dispose(): void {
      this.disposed = true
    }
    onData(): { dispose: () => void } {
      return { dispose: () => {} }
    }
    cols = 80
    rows = 24
  }
}))
vi.mock('@xterm/addon-fit', () => ({ FitAddon: class { fit(): void {} } }))

import { EstateAgents } from './EstateAgents'
import { I18nProvider } from './i18n'
import type { ProjectRow, TerminalSession } from '../../shared/types'

beforeEach(() => {
  terminals.length = 0
})
// `ResizeObserver` is in `test/jsdom-gaps.ts`, not here. It was here first, and
// that file's own header says why it should not have been: a polyfill hidden
// inside one spec is a polyfill the next author does not find — and the next
// author was the sibling spec in this same directory, which crashed with an
// empty body and an assertion about something else entirely.

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const project = { id: 'p1', name: 'Atlas', estate_id: 'e1' } as ProjectRow

const session = (over: Partial<TerminalSession>): TerminalSession =>
  ({
    sessionId: 's-a',
    projectId: 'p1',
    cwd: '/atlas',
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

const RUNNING = session({ sessionId: 's-a' })
const OTHER = session({ sessionId: 's-b' })
const ENDED = session({
  sessionId: 's-z',
  running: false,
  state: 'ended',
  exitCode: 137,
  excerpt: 'the last thing it said'
})

/**
 * The window surface, with the PTY channels recorded.
 *
 * `onData` hands back an unsubscribe, and whether the consumer calls it is the
 * whole of "repeated attach does not duplicate PTY listener" — so the stub
 * counts registrations and removals rather than trusting either.
 */
function stub(over: { scrollbackFails?: boolean; runs?: Record<string, unknown> } = {}) {
  const dataListeners: ((id: string, data: string, written: number) => void)[] = []
  const exitListeners: ((id: string, code: number) => void)[] = []
  let removed = 0
  const api = {
    runs: {
      status: vi.fn(async (sessionId: string) => over.runs?.[sessionId] ?? null)
    },
    terminal: {
      onData: vi.fn((cb: (id: string, data: string, written: number) => void) => {
        dataListeners.push(cb)
        return () => {
          removed++
          const i = dataListeners.indexOf(cb)
          if (i >= 0) dataListeners.splice(i, 1)
        }
      }),
      onExit: vi.fn((cb: (id: string, code: number) => void) => {
        exitListeners.push(cb)
        return () => {
          const i = exitListeners.indexOf(cb)
          if (i >= 0) exitListeners.splice(i, 1)
        }
      }),
      scrollback: vi.fn(async (_sessionId: string) =>
        over.scrollbackFails ? Promise.reject(new Error('scrollback refused')) : null
      ),
      write: vi.fn(),
      resize: vi.fn(),
      end: vi.fn(),
      history: vi.fn(async () => [])
    },
    projects: {
      repoStates: vi.fn(async () => []),
      onRepoChanged: vi.fn(() => () => {})
    },
    windows: { openSession: vi.fn() }
  }
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: api }))
  return { api, dataListeners, exitListeners, removals: () => removed }
}

const show = (sessions: TerminalSession[], onError = vi.fn()) => {
  const view = render(
    <I18nProvider locale="en">
      <EstateAgents sessions={sessions} projects={[project]} onOpen={vi.fn()} onError={onError} />
    </I18nProvider>
  )
  return { view, onError }
}

/** Click a session row by the project label it renders. */
const select = async (label: string): Promise<void> => {
  const rows = await waitFor(() => screen.getAllByText((_, el) => el?.textContent?.includes(label) === true))
  fireEvent.click(rows[rows.length - 1])
}

describe('the selected live session is the session, not a snapshot of it', () => {
  it('attaches a terminal for a running agent', async () => {
    stub()
    show([RUNNING])
    fireEvent.click(screen.getByText(/Atlas/))
    // THE FIXTURE IS THE CASE: a running session, so there is something to
    // attach to. An ended one is the other test below.
    expect(RUNNING.running, 'the fixture must be a live session').toBe(true)
    await waitFor(() => expect(terminals.length, 'no terminal was attached').toBe(1))
  })

  it('and does not steal focus when the selection changes', async () => {
    // `TerminalView` focuses on mount, which is right in its own window and
    // wrong in a three-column panel: arrowing down the list would drop focus
    // into the terminal on every row. The card asks for keyboard focus to be
    // PLANNED, so the pane takes focus on a click into it rather than on being
    // rendered beside a list the operator is still reading.
    stub()
    show([RUNNING])
    fireEvent.click(screen.getByText(/Atlas/))
    await waitFor(() => expect(terminals.length).toBe(1))
    expect(terminals[0].focused, 'the embedded terminal grabbed focus on mount').toBe(0)
  })

  it('but an ENDED session shows its last output as stale, with the exit code', async () => {
    // The exclusion — "no stale console labelled live" — kept from the other
    // side: an ended session has nothing to attach to, so the snapshot is the
    // honest thing to show, and its exit code is the fact that explains it.
    stub()
    show([ENDED])
    fireEvent.click(screen.getByText(/Atlas/))
    await waitFor(() => expect(screen.getByText(/the last thing it said/)).toBeTruthy())
    expect(terminals.length, 'a terminal was attached to a session that has ended').toBe(0)
    expect(screen.getByText(/137/), 'the exit code is not shown').toBeTruthy()
  })
})

describe('switching agents cannot leak the one before it', () => {
  it('never writes A’s output into B’s terminal', async () => {
    const { dataListeners } = stub()
    show([RUNNING, OTHER])
    fireEvent.click(screen.getAllByText(/Atlas/)[0])
    await waitFor(() => expect(terminals.length).toBe(1))
    // Switch to B. `sessionId` keys the effect, so this is a fresh attach.
    fireEvent.click(screen.getAllByText(/Atlas/)[1])
    await waitFor(() => expect(terminals.length).toBe(2))
    const before = terminals[1].writes.length
    // A's bytes arrive late, addressed to A.
    for (const cb of dataListeners) cb('s-a', 'A SAID THIS', 11)
    expect(
      terminals[1].writes.slice(before).join(''),
      "the previous agent's output reached the new agent's terminal"
    ).not.toContain('A SAID THIS')
  })

  it('and leaves exactly one PTY listener behind, however many times it attaches', async () => {
    // The negative acceptance in its own words. `onData` hands back an
    // unsubscribe; two attaches with one unsubscribe is a terminal written
    // twice per byte, which reads as an agent repeating itself.
    const { dataListeners, api } = stub()
    show([RUNNING, OTHER])
    fireEvent.click(screen.getAllByText(/Atlas/)[0])
    await waitFor(() => expect(terminals.length).toBe(1))
    fireEvent.click(screen.getAllByText(/Atlas/)[1])
    await waitFor(() => expect(terminals.length).toBe(2))
    fireEvent.click(screen.getAllByText(/Atlas/)[0])
    await waitFor(() => expect(terminals.length).toBe(3))
    expect(api.terminal.onData.mock.calls.length, 'three attaches should have registered three times').toBe(3)
    expect(dataListeners.length, 'a PTY listener survived its terminal').toBe(1)
  })
})

describe('the view is not the session', () => {
  it('does not end the session when the view goes away', async () => {
    // The session lives in main. `term.dispose()` disposes a renderer object;
    // ending the work is `terminal.end`, and closing a pane must never call it.
    const { api } = stub()
    const { view } = show([RUNNING])
    fireEvent.click(screen.getByText(/Atlas/))
    await waitFor(() => expect(terminals.length).toBe(1))
    view.unmount()
    expect(terminals[0].disposed, 'the terminal object was not disposed').toBe(true)
    expect(api.terminal.end, 'closing the view ended the session').not.toHaveBeenCalled()
  })

  it('and a refused scrollback costs the replay, not the live stream', async () => {
    // `TerminalView` already answers this correctly and nothing asserted it: a
    // failed replay attaches anyway, because a terminal showing what happens
    // NEXT beats a blank one. Asserted here so the behaviour cannot be
    // refactored away quietly.
    const { dataListeners } = stub({ scrollbackFails: true })
    const { onError } = show([RUNNING])
    fireEvent.click(screen.getByText(/Atlas/))
    await waitFor(() => expect(terminals.length).toBe(1))
    await waitFor(() => expect(dataListeners.length).toBe(1))
    for (const cb of dataListeners) cb('s-a', 'LIVE AFTER A FAILED REPLAY', 26)
    await waitFor(() =>
      expect(
        terminals[0].writes.join(''),
        'a failed replay took the live stream with it'
      ).toContain('LIVE AFTER A FAILED REPLAY')
    )
    expect(onError, 'a failed replay raised a banner for something the operator cannot act on').not.toHaveBeenCalled()
  })
})

describe('the queue puts what is waiting first', () => {
  it('orders idle, then running, then ended', async () => {
    // An idle agent has stopped producing and nobody has answered it — the one
    // state `sessionTone` paints `warn`, and the one worth looking at first.
    // Ended is an absence rather than a failure, so it goes last whatever its
    // exit code. Driven by the STATE CHIPS in document order, which is what a
    // reader actually sees.
    stub()
    const idle = session({ sessionId: 's-i', state: 'idle', lastActivityAt: '2026-09-10T00:00:05Z' })
    show([ENDED, RUNNING, idle])
    const chips = screen.getAllByText(/^(idle|running|ended)$/)
    expect(chips.length, 'the fixture must render all three states').toBe(3)
    expect(chips.map((c) => c.textContent)).toEqual(['idle', 'running', 'ended'])
  })

  it('and within one state the longest wait is on top', async () => {
    // `attention.ts`'s rule, reused rather than re-decided: inside a group, the
    // thing that has been waiting longest comes first.
    const { api } = stub()
    const older = session({ sessionId: 's-old', state: 'idle', lastActivityAt: '2026-09-10T00:00:01Z' })
    const newer = session({ sessionId: 's-new', state: 'idle', lastActivityAt: '2026-09-10T09:00:00Z' })
    show([newer, older])
    const rows = screen.getAllByRole('button').filter((b) => b.className.includes('row-interactive'))
    expect(rows.length, 'the fixture must render two selectable rows').toBe(2)
    // THE ID IS NOT RENDERED, so the order is asserted through WHICH session
    // attaching the top row asks for. The first version of this compared
    // `textContent` against `'claude-code'` — which both rows contain, so it
    // passed in either order: an assertion that cannot fail is not one.
    fireEvent.click(rows[0])
    await waitFor(() => expect(api.terminal.scrollback).toHaveBeenCalled())
    expect(
      api.terminal.scrollback.mock.calls[0][0],
      'the top row is not the session that has been waiting longest'
    ).toBe('s-old')
  })

  it('and a reorder does not move the selection', async () => {
    // "Selected agent remains stable during reorder" — stable by CONSTRUCTION,
    // because the selection is a session id rather than an index. Asserted
    // because a later refactor to an index would look harmless.
    stub()
    const { view } = show([ENDED, RUNNING])
    const rows = screen.getAllByRole('button').filter((b) => b.className.includes('row-interactive'))
    expect(rows.length, 'the fixture must render both sessions').toBe(2)
    // RUNNING sorts first, so row 0 is the live one and attaches a terminal.
    fireEvent.click(rows[0])
    await waitFor(() => expect(terminals.length).toBe(1))
    view.rerender(
      <I18nProvider locale="en">
        <EstateAgents sessions={[RUNNING, ENDED]} projects={[project]} onOpen={vi.fn()} onError={vi.fn()} />
      </I18nProvider>
    )
    // THE TRANSITION THAT MUST NOT HAPPEN: a re-attach. One terminal still,
    // because the same session is still selected.
    await waitFor(() => expect(terminals.length, 'the reorder re-attached the terminal').toBe(1))
    expect(terminals[0].disposed, 'the reorder disposed the attached terminal').toBe(false)
  })
})

describe('history follows what happens', () => {
  it('re-reads the session history when that session ends', async () => {
    // The positive acceptance asks for events to update the history, and there
    // is no journal push channel — the renderer has four live channels and none
    // of them carries events. A session ENDING is pushed, though, and it is
    // exactly the event a reader is waiting to see, so that one is immediate
    // rather than up to a poll late.
    const { api, exitListeners } = stub()
    show([RUNNING])
    fireEvent.click(screen.getByText(/Atlas/))
    await waitFor(() => expect(api.terminal.history).toHaveBeenCalledTimes(1))
    // TWO listeners, and both belong here: `TerminalView` registers one to
    // print its own "[session ended — exit N]" line, and the panel registers
    // one to re-read the history. This assertion said `toBe(1)` first, against
    // correct code — two consumers of one channel is not a leak, because each
    // hands back its own unsubscribe (the case above counts those).
    expect(exitListeners.length, 'the panel is not listening for a session ending').toBeGreaterThanOrEqual(2)
    for (const cb of exitListeners) cb('s-a', 0)
    await waitFor(() =>
      expect(
        api.terminal.history.mock.calls.length,
        'the history was not re-read when the session ended'
      ).toBeGreaterThan(1)
    )
  })

  it('and ignores another session ending', async () => {
    // The keyed rule again, from the push side: an event about somebody else
    // must not re-read this subject, or a busy estate re-reads the shown
    // history on every unrelated exit.
    const { api, exitListeners } = stub()
    show([RUNNING, OTHER])
    fireEvent.click(screen.getAllByText(/Atlas/)[0])
    await waitFor(() => expect(api.terminal.history).toHaveBeenCalledTimes(1))
    const before = api.terminal.history.mock.calls.length
    for (const cb of exitListeners) cb('s-b', 0)
    // WAIT FOR THE POSITIVE FIRST would prove nothing here — the claim IS an
    // absence. So the negative is asserted after a real turn of the event loop
    // rather than in the same tick.
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(
      api.terminal.history.mock.calls.length,
      "another session's ending re-read the shown history"
    ).toBe(before)
  })
})

describe('the task in the header belongs to the agent in front of you', () => {
  const envelope = (taskId: string | null, taskTitle: string | null) => ({
    data: taskId === null ? null : { taskId, taskTitle, runRef: null, ordinal: null },
    availability: 'complete',
    freshness: 'fresh',
    asOf: '2026-09-10T00:00:00Z',
    sources: []
  })

  it('opens the task page with this session’s task', async () => {
    // SCN-049 step 4, and the card's "task route stable" half.
    const { api } = stub({ runs: { 's-a': envelope('t-77', 'Ship the ledger') } })
    const onOpen = vi.fn()
    render(
      <I18nProvider locale="en">
        <EstateAgents sessions={[RUNNING]} projects={[project]} onOpen={onOpen} onError={vi.fn()} />
      </I18nProvider>
    )
    fireEvent.click(screen.getByText(/Atlas/))
    await waitFor(() => expect(api.runs.status).toHaveBeenCalledWith('s-a'))
    const link = await waitFor(() => screen.getByText(/Ship the ledger/))
    fireEvent.click(link)
    expect(onOpen).toHaveBeenCalledWith('p1', { kind: 'task', id: 't-77' })
  })

  it('and a session holding no task offers no route at all', async () => {
    // A bare terminal is a real thing, not a broken run — `data: null` inside a
    // complete envelope. An empty link would send the operator nowhere and
    // read as a task that failed to load.
    const { api } = stub({ runs: { 's-a': envelope(null, null) } })
    render(
      <I18nProvider locale="en">
        <EstateAgents sessions={[RUNNING]} projects={[project]} onOpen={vi.fn()} onError={vi.fn()} />
      </I18nProvider>
    )
    fireEvent.click(screen.getByText(/Atlas/))
    await waitFor(() => expect(api.runs.status).toHaveBeenCalledWith('s-a'))
    expect(screen.queryByText(/^Task:/), 'a session with no run offered a task route').toBeNull()
  })

  it('and switching agents never shows the one before it', async () => {
    // The negative acceptance: "switch A→B cannot show A repo/history" — and
    // the task route is the one where a stale answer sends work to the wrong
    // row, not merely displays the wrong text.
    const { api } = stub({
      runs: { 's-a': envelope('t-A', 'A’s task'), 's-b': envelope('t-B', 'B’s task') }
    })
    render(
      <I18nProvider locale="en">
        <EstateAgents sessions={[RUNNING, OTHER]} projects={[project]} onOpen={vi.fn()} onError={vi.fn()} />
      </I18nProvider>
    )
    fireEvent.click(screen.getAllByText(/Atlas/)[0])
    await waitFor(() => expect(screen.getByText(/A’s task/)).toBeTruthy())
    fireEvent.click(screen.getAllByText(/Atlas/)[1])
    await waitFor(() => expect(api.runs.status).toHaveBeenCalledWith('s-b'))
    // WAIT FOR THE POSITIVE FIRST, then assert the absence.
    await waitFor(() => expect(screen.getByText(/B’s task/)).toBeTruthy())
    expect(screen.queryByText(/A’s task/), "the previous agent's task stayed in the header").toBeNull()
  })
})

describe('an answer that arrives for the agent you left', () => {
  it('is discarded rather than rendered under the new name', async () => {
    // SCN-049's alt path in its own words. THIS is the case the guards exist
    // for, and it is not the switch: it is A's read RESOLVING after the
    // operator has moved to B. A plant proved the switch case is covered twice
    // over — the pending-reset effect and the render-time `forSubject` each
    // block it alone — so neither of them was load-bearing in any probe. The
    // mechanism that actually decides this is `keyedRead#settled`, which drops
    // a settlement whose subject is not the current one.
    let releaseA = (_v: unknown) => {}
    const api = {
      terminal: {
        onData: vi.fn(() => () => {}),
        onExit: vi.fn(() => () => {}),
        scrollback: vi.fn(async (_id: string) => null),
        write: vi.fn(),
        resize: vi.fn(),
        history: vi.fn(async () => [])
      },
      projects: { repoStates: vi.fn(async () => []), onRepoChanged: vi.fn(() => () => {}) },
      windows: { openSession: vi.fn() },
      runs: {
        status: vi.fn(
          (sessionId: string) =>
            sessionId === 's-a'
              ? new Promise((resolve) => {
                  releaseA = resolve
                })
              : Promise.resolve({
                  data: { taskId: 't-B', taskTitle: 'B’s task', runRef: null, ordinal: null },
                  availability: 'complete',
                  freshness: 'fresh',
                  asOf: 'x',
                  sources: []
                })
        )
      }
    }
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: api }))
    render(
      <I18nProvider locale="en">
        <EstateAgents sessions={[RUNNING, OTHER]} projects={[project]} onOpen={vi.fn()} onError={vi.fn()} />
      </I18nProvider>
    )
    fireEvent.click(screen.getAllByText(/Atlas/)[0])
    await waitFor(() => expect(api.runs.status).toHaveBeenCalledWith('s-a'))
    // Move to B while A's read is still in flight, and let B land.
    fireEvent.click(screen.getAllByText(/Atlas/)[1])
    await waitFor(() => expect(screen.getByText(/B’s task/)).toBeTruthy())
    // NOW A answers, for an agent nobody is looking at.
    releaseA({
      data: { taskId: 't-A', taskTitle: 'A’s task', runRef: null, ordinal: null },
      availability: 'complete',
      freshness: 'fresh',
      asOf: 'x',
      sources: []
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(screen.queryByText(/A’s task/), "a late answer was rendered under the new agent's name").toBeNull()
    expect(screen.getByText(/B’s task/), "the late answer replaced the current agent's task").toBeTruthy()
  })
})

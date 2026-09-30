// A card that could not be put back (UX28-04).
//
// The optimistic overlay here is careful and its comment is right: `moving` is
// a separate map rather than a mutation of the rows precisely so an optimistic
// state CAN be withdrawn, and a REFUSED command — `{ ok: false, reason }` —
// already puts the card back and says why. That half was built.
//
// What was not built is the other kind of failure. `await window.fabric.tasks
// .move(...)` sat outside any `try`, and the call site is `void apply(...)`.
// So a command that REJECTS rather than refusing — the main process throwing,
// the transport dying, the handler not registered — threw out of `apply`,
// which left three things at once:
//
//   * an unhandled promise rejection,
//   * `moving[task.id]` never deleted, so the card sits in the column it never
//     reached, for the rest of the session,
//   * and nothing on screen. The refused path has a banner; this path has no
//     `catch` to raise one.
//
// A refusal and a rejection are not the same event and were never meant to
// behave the same way — but they must both end with the card where the record
// says it is.
//
// Two more the card names, and both are about the overlay outliving its
// answer: a second click while the first command is unresolved, and an
// authoritative row that has moved somewhere ELSE while an optimistic entry
// still points at the operator's target.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { BoardSection } from './ProjectHome'
import { I18nProvider } from './i18n'
import type { TaskRow } from '../../shared/types'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const task = (over: Partial<TaskRow> = {}): TaskRow =>
  ({
    id: 't1',
    project_id: 'p1',
    title: 'Survey the repository',
    instruction: 'survey it',
    status: 'backlog',
    task_type: null,
    origin_kind: 'person',
    assigned_by: null,
    assigned_to: null,
    closed_reason: null,
    abandoned_reason: null,
    moved_by_kind: null,
    ...over
  }) as TaskRow

function stub(over: Record<string, unknown> = {}) {
  const api = {
    tasks: {
      move: vi.fn(async () => ({ ok: true })),
      close: vi.fn(async () => ({ ok: true })),
      fileIdea: vi.fn(async () => ({ ok: true }))
    },
    ...over
  }
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: api }))
  return api
}

const board = (rows: TaskRow[] | null, onMoved = vi.fn(async () => {})) => {
  const r = render(
    <I18nProvider locale="en">
      <BoardSection
        projectId="p1"
        tasks={rows}
        onReuse={vi.fn()}
        onMoved={onMoved}
        onOpen={vi.fn()}
      />
    </I18nProvider>
  )
  return { ...r, onMoved }
}

/** The column a card is currently rendered in, by walking up to the column. */
const columnOf = (title: string): string | null => {
  const card = screen.queryByText(title)
  if (!card) return null
  const column = card.closest('.board-column')
  return column?.querySelector('.board-column-title, h3, header')?.textContent ?? column?.textContent ?? null
}

/**
 * The failure the operator is shown, reached the way a screen reader reaches
 * it. A `data-testid` was tried first and silently dropped — `Banner` takes no
 * rest props, and TypeScript does not object because a hyphenated JSX
 * attribute bypasses excess-property checking. `role="alert"` is what the
 * component actually carries, and asserting it also asserts the failure is
 * ANNOUNCED rather than merely rendered.
 */
/** Choose a move from a card's own select — the keyboard path the card keeps. */
const move = (to: string): void => {
  const select = document.querySelector('select.task-card-move') as HTMLSelectElement
  if (!select) throw new Error('no move control on the card')
  select.value = to
  select.dispatchEvent(new Event('change', { bubbles: true }))
}

describe('a command that REJECTS puts the card back', () => {
  it('does not leave it in a column it never reached', async () => {
    // THE MEASURED DEFECT. `{ ok: false }` was handled; a rejection was not,
    // so the optimistic entry was never deleted and the card stayed put — in
    // the wrong column — with nothing on screen to say so.
    stub({
      tasks: {
        move: vi.fn(async () => {
          throw new Error('the main process went away')
        }),
        close: vi.fn(async () => ({ ok: true })),
        fileIdea: vi.fn(async () => ({ ok: true }))
      }
    })
    board([task()])
    expect(columnOf('Survey the repository')).toMatch(/Backlog/)
    move('running')
    await waitFor(() => expect(screen.queryByRole('alert')).toBeTruthy())
    expect(columnOf('Survey the repository')).toMatch(/Backlog/)
  })

  it('and says what happened, in the operator’s own words rather than a stack', async () => {
    stub({
      tasks: {
        move: vi.fn(async () => {
          throw new Error('the main process went away')
        }),
        close: vi.fn(async () => ({ ok: true })),
        fileIdea: vi.fn(async () => ({ ok: true }))
      }
    })
    board([task()])
    move('running')
    await waitFor(() => expect(screen.queryByRole('alert')).toBeTruthy())
    expect(screen.getByRole('alert').textContent).toMatch(/the main process went away/)
  })

  it('a REFUSAL still behaves as it already did — this is not a rewrite of that path', async () => {
    stub({
      tasks: {
        move: vi.fn(async () => ({ ok: false, reason: 'the ladder does not allow it' })),
        close: vi.fn(async () => ({ ok: true })),
        fileIdea: vi.fn(async () => ({ ok: true }))
      }
    })
    board([task()])
    move('running')
    await waitFor(() => expect(screen.queryByRole('alert')).toBeTruthy())
    expect(screen.getByRole('alert').textContent).toMatch(/the ladder does not allow it/)
    expect(columnOf('Survey the repository')).toMatch(/Backlog/)
  })

  it('and a rejection does not become an unhandled promise', async () => {
    // The call site is `void apply(...)`, so a throw out of `apply` had nowhere
    // to land. Asserted by listening for the rejection the runtime would
    // report, because "no unhandled rejection" is otherwise invisible.
    const unhandled: unknown[] = []
    const listener = (e: PromiseRejectionEvent): void => {
      unhandled.push(e.reason)
      e.preventDefault()
    }
    window.addEventListener('unhandledrejection', listener)
    try {
      stub({
        tasks: {
          move: vi.fn(async () => {
            throw new Error('boom')
          }),
          close: vi.fn(async () => ({ ok: true })),
          fileIdea: vi.fn(async () => ({ ok: true }))
        }
      })
      board([task()])
      move('running')
      await waitFor(() => expect(screen.queryByRole('alert')).toBeTruthy())
      await new Promise((r) => setTimeout(r, 10))
      expect(unhandled).toEqual([])
    } finally {
      window.removeEventListener('unhandledrejection', listener)
    }
  })
})

describe('one card, one command in flight', () => {
  it('a second choice while the first is unresolved issues no second command', async () => {
    // Two commands for one task is two answers to reconcile in whatever order
    // they arrive, and the later one wins by accident rather than by being
    // later. The move control is disabled while the card is unresolved.
    let release: (v: { ok: true }) => void = () => {}
    const api = stub({
      tasks: {
        move: vi.fn(() => new Promise<{ ok: true }>((r) => (release = r))),
        close: vi.fn(async () => ({ ok: true })),
        fileIdea: vi.fn(async () => ({ ok: true }))
      }
    })
    board([task()])
    move('running')
    await waitFor(() => expect(api.tasks.move).toHaveBeenCalledTimes(1))

    // The control is disabled, so the second attempt cannot even be made.
    const select = document.querySelector('select.task-card-move') as HTMLSelectElement
    expect(select.disabled).toBe(true)

    release({ ok: true })
    await waitFor(() => expect(select.disabled).toBe(false))
    expect(api.tasks.move).toHaveBeenCalledTimes(1)
  })

  it('and another card is not blocked by it', async () => {
    let release: (v: { ok: true }) => void = () => {}
    const api = stub({
      tasks: {
        move: vi.fn((id: string) =>
          id === 't1' ? new Promise<{ ok: true }>((r) => (release = r)) : Promise.resolve({ ok: true as const })
        ),
        close: vi.fn(async () => ({ ok: true })),
        fileIdea: vi.fn(async () => ({ ok: true }))
      }
    })
    board([task(), task({ id: 't2', title: 'Read the ledger' })])
    const selects = Array.from(document.querySelectorAll('select.task-card-move')) as HTMLSelectElement[]
    expect(selects).toHaveLength(2)
    selects[0].value = 'running'
    selects[0].dispatchEvent(new Event('change', { bubbles: true }))
    await waitFor(() => expect(api.tasks.move).toHaveBeenCalledTimes(1))
    // A lock on one task is not a lock on the board.
    expect(selects[1].disabled).toBe(false)
    release({ ok: true })
  })
})

describe('the record outranks the operator’s guess', () => {
  it('an optimistic target is dropped when the row has moved somewhere else', async () => {
    // Somebody else — an agent, another window — moved the task while this
    // command was in flight. The overlay pointed at `running` and the record
    // says `review`; the overlay used to win, because it was only cleared when
    // the row reached the target it named.
    const api = stub({
      tasks: {
        move: vi.fn(async () => ({ ok: true })),
        close: vi.fn(async () => ({ ok: true })),
        fileIdea: vi.fn(async () => ({ ok: true }))
      }
    })
    const { rerender } = board([task()])
    move('running')
    await waitFor(() => expect(api.tasks.move).toHaveBeenCalled())

    // The refetch brings back a THIRD state, not the one asked for.
    rerender(
      <I18nProvider locale="en">
        <BoardSection
          projectId="p1"
          tasks={[task({ status: 'review' })]}
          onReuse={vi.fn()}
          onMoved={vi.fn(async () => {})}
          onOpen={vi.fn()}
        />
      </I18nProvider>
    )
    await waitFor(() => expect(columnOf('Survey the repository')).toMatch(/Review/))
  })

  it('and a row that has left the list entirely takes its overlay with it', async () => {
    // Checking that the card is GONE proves nothing — the row left the list,
    // so of course it is. The leak is only observable when the row comes BACK:
    // a stale overlay would put it in the column the operator once asked for,
    // however long ago and whatever the record now says.
    const api = stub()
    const only = (rows: TaskRow[]) => (
      <I18nProvider locale="en">
        <BoardSection
          projectId="p1"
          tasks={rows}
          onReuse={vi.fn()}
          onMoved={vi.fn(async () => {})}
          onOpen={vi.fn()}
        />
      </I18nProvider>
    )
    const { rerender } = board([task()])
    move('running')
    await waitFor(() => expect(api.tasks.move).toHaveBeenCalled())

    // Out of the list — a filter, a cap, a project switch.
    rerender(only([task({ id: 't2', title: 'Read the ledger' })]))
    await waitFor(() => expect(screen.queryByText('Survey the repository')).toBeNull())

    // Back, and the record says it never left the backlog.
    rerender(only([task({ status: 'backlog' })]))
    await waitFor(() => expect(screen.queryByText('Survey the repository')).toBeTruthy())
    expect(columnOf('Survey the repository')).toMatch(/Backlog/)
  })
})

describe('the keyboard path the card keeps', () => {
  it('the move control is a select, so moving needs no pointer', () => {
    // The card's exclusion, asserted rather than assumed: "preserve keyboard
    // move alternative; do not replace with drag-only interaction". A `select`
    // is keyboard and screen-reader native, and it makes the legal moves
    // VISIBLE rather than discoverable by trying.
    stub()
    board([task()])
    const select = document.querySelector('select.task-card-move')
    expect(select).toBeTruthy()
    expect(select?.tagName).toBe('SELECT')
    expect(Array.from(select?.querySelectorAll('option') ?? []).length).toBeGreaterThan(1)
  })
})

describe('confirmed is not the same as reconciled', () => {
  it('a successful move whose refetch does not bring the row says the card is unconfirmed', async () => {
    // The command succeeded. The refetch is what failed — `loadTasks` catches
    // its own error, so the board is never told. Claiming the command failed
    // would be a lie in the other direction; the honest line is that the card
    // is where the operator put it and the record has not said so yet.
    const api = stub()
    board([task()])
    move('running')
    await waitFor(() => expect(api.tasks.move).toHaveBeenCalled())
    // `tasks` never changes — the refetch brought nothing back.
    await waitFor(() => expect(screen.queryByTestId('board-unconfirmed')).toBeTruthy())
    expect(screen.getByTestId('board-unconfirmed').textContent).toMatch(/not yet confirmed/)
    // And it is NOT the failure banner: this command did not fail.
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('and the check-again reconciles rather than re-issuing the command', async () => {
    const api = stub()
    const { onMoved } = board([task()])
    move('running')
    await waitFor(() => expect(screen.queryByTestId('board-reconcile')).toBeTruthy())
    const refetches = onMoved.mock.calls.length
    const commands = api.tasks.move.mock.calls.length
    screen.getByTestId('board-reconcile').click()
    await waitFor(() => expect(onMoved.mock.calls.length).toBeGreaterThan(refetches))
    // Re-sending a command that already succeeded is how one intention
    // becomes two.
    expect(api.tasks.move).toHaveBeenCalledTimes(commands)
  })

  it('and stays silent while the command is still unresolved', async () => {
    // THE WINDOW THAT MATTERS, and the first version of these cases never
    // observed it: they rerendered with the settled row, by which point the
    // guess is already cleared and the line is absent either way. Holding the
    // command open is the only way to see whether it flashes.
    let release: (v: { ok: true }) => void = () => {}
    const api = stub({
      tasks: {
        move: vi.fn(() => new Promise<{ ok: true }>((r) => (release = r))),
        close: vi.fn(async () => ({ ok: true })),
        fileIdea: vi.fn(async () => ({ ok: true }))
      }
    })
    board([task()])
    move('running')
    await waitFor(() => expect(api.tasks.move).toHaveBeenCalled())
    // In flight. The card is simply in flight, and a line that appeared here
    // would appear on every normal move.
    expect(screen.queryByTestId('board-unconfirmed')).toBeNull()
    release({ ok: true })
    // Settled, and the record still does not hold it — NOW it is worth saying.
    await waitFor(() => expect(screen.queryByTestId('board-unconfirmed')).toBeTruthy())
  })

  it('but a move the record confirms says nothing at all', async () => {
    // Asserted rather than reasoned about: while the command is unresolved the
    // card is in flight, and this line must not flash on every normal move —
    // a warning that appears every time is one nobody reads the time it counts.
    const api = stub()
    const only = (rows: TaskRow[]) => (
      <I18nProvider locale="en">
        <BoardSection projectId="p1" tasks={rows} onReuse={vi.fn()} onMoved={vi.fn(async () => {})} onOpen={vi.fn()} />
      </I18nProvider>
    )
    const { rerender } = board([task()])
    move('running')
    await waitFor(() => expect(api.tasks.move).toHaveBeenCalled())
    // The refetch brings the row back in the state that was asked for.
    rerender(only([task({ status: 'running' })]))
    await waitFor(() => expect(screen.queryByTestId('board-unconfirmed')).toBeNull())
    expect(columnOf('Survey the repository')).toMatch(/Running/)
  })
})

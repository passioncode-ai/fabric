// The history a person has read, and the position that survives a restore
// (AX-07).
//
// MEASURED at `08882bd`: the whole of `shared/inbox.ts` — 144 lines, two lanes,
// a compare-and-swap cursor, an emptiness vocabulary separating "nothing
// happened" from "nothing is wired" — was consumed by NOTHING but its own unit
// test. Eleventh instance of this cycle's recurring shape, and the first where
// the unread thing is an entire MODULE. Its own header states the invariant
// that matters — a cursor "cannot be called by anything that merely received
// data" — and with no callers at all that sentence was vacuously true.
//
// THE DEFECT THAT LOSES SOMETHING: `throughSeq` is a position in ONE journal,
// and a restore mints a generation whose sequence starts again. A saved
// position of 9000 against an estate whose highest seq is 12 marks everything
// read — an operator who has never looked at this estate is shown an empty
// feed and told they are up to date.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EstateHome } from './EstateHome'
import { I18nProvider } from './i18n'
import { NO_MARKS } from '../../shared/feedMarks'
import type { FeedEvent } from '../../shared/types'
import { whole } from '../../../test/envelopes'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const ev = (seq: number): FeedEvent => ({
  estate_id: 'e1',
  seq,
  type: 'task.note.promoted@1',
  actor: { kind: 'system', id: 'x' },
  project_id: null,
  occurred_at: '2026-09-11T00:00:00Z',
  payload: {}
})

function stub() {
  vi.stubGlobal(
    'window',
    Object.assign(globalThis.window ?? {}, {
      fabric: {
        workspace: { state: vi.fn(async () => ({ path: null, git: 'yes' })) },
        favourites: { list: async () => [] },
        board: { query: async () => ({ rows: [], total: 0 }) },
        attention: { list: async () => whole([]) },
        estate: { summary: async () => null, profile: async () => null },
        memory: { overview: async () => null }
      }
    })
  )
}

const show = (feed: FeedEvent[] | null, readThroughSeq: number, onRead = vi.fn(async () => {})) =>
  render(
    <I18nProvider locale="en">
      <EstateHome
        projects={[]}
        sessions={[]}
        feed={feed}
        marks={NO_MARKS}
        readThroughSeq={readThroughSeq}
        onRead={onRead}
        onOpen={vi.fn()}
        onNew={vi.fn()}
      />
    </I18nProvider>
  )

describe('the estate says how much of its history is unread', () => {
  it('counts what this operator has not seen', async () => {
    stub()
    show([ev(1), ev(2), ev(3)], 1)
    // Two of three are past the cursor.
    await waitFor(() => expect(screen.getByText(/Mark 2 as read/)).toBeTruthy())
  })

  it('and offers nothing to mark when everything has been seen', async () => {
    // The other direction, and it is what keeps the control meaningful: a
    // button that is always there is furniture.
    stub()
    show([ev(1), ev(2)], 2)
    await waitFor(() => expect(screen.getByText(/Journal|History|What happened/i)).toBeTruthy())
    expect(screen.queryByText(/Mark .* as read/)).toBeNull()
  })

  it('marks read only as far as what is ON SCREEN', async () => {
    // `visibleThroughSeq` is the highest seq RENDERED, never the highest known,
    // so an act cannot swallow rows the operator never saw.
    stub()
    const onRead = vi.fn(async () => {})
    show([ev(4), ev(5)], 0, onRead)
    await waitFor(() => expect(screen.getByText(/Mark 2 as read/)).toBeTruthy())
    fireEvent.click(screen.getByText(/Mark 2 as read/))
    await waitFor(() => expect(onRead).toHaveBeenCalledWith(5))
  })

  it('and ARRIVAL alone never moves it', async () => {
    // The invariant `inbox.ts` states and could not enforce while it had no
    // callers. Rendering a feed is receiving data; the cursor moves from an act
    // and from nothing else.
    stub()
    const onRead = vi.fn(async () => {})
    show([ev(1), ev(2), ev(3)], 0, onRead)
    await waitFor(() => expect(screen.getByText(/Mark 3 as read/)).toBeTruthy())
    expect(onRead, 'the feed arrived and nobody read it').not.toHaveBeenCalled()
  })
})

describe('a position from another generation does not hide the estate', () => {
  it('shows the whole history again and says why', async () => {
    // A restore starts the sequence over. The saved position is past everything
    // the estate holds, so it is refused — and the reset goes to NOTHING read,
    // because showing an item twice costs a glance and hiding one costs the
    // thing it was about.
    stub()
    show([ev(1), ev(2)], 9000)
    await waitFor(() => expect(screen.getByText(/Mark 2 as read/)).toBeTruthy())
    expect(screen.getByText(/generation is\s+restored|past everything this estate holds/i)).toBeTruthy()
  })

  it('but says nothing on an estate whose history is simply short', async () => {
    // The boundary: a cursor exactly at the head is the most attentive operator,
    // not a restore, and printing the notice there would make it furniture.
    stub()
    show([ev(1), ev(2)], 2)
    await waitFor(() => expect(screen.getByText(/Journal|History|What happened/i)).toBeTruthy())
    expect(screen.queryByText(/past everything this estate holds/i)).toBeNull()
  })
})

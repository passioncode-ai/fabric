// A digest that emptied itself by refreshing (UX28-03).
//
// M133's doctrine is right and is not what changed: the mark advances when the
// operator LEAVES, so returning shows what they missed and returning twice
// shows nothing. What was wrong is WHICH boundary "here" meant.
//
// `digest.seen(projectId)` read the journal's CURRENT head and marked that
// seen. The panel's effect depends on `feedMark`, so every arriving event
// re-ran it — and the cleanup of the previous run marked the head that those
// very events had just moved. The refresh acknowledged the news it was
// refreshing FOR. The operator saw "nothing new" and the events were gone for
// good, with the panel behaving exactly as designed at every step.
//
// The cleanup also fired when the read had FAILED, on purpose, with a comment
// explaining that a digest which could not be shown must not become a
// permanent backlog. The concern is real; the remedy threw away news nobody had
// seen. The boundary read WITH the payload fixes both: it sweeps kinds the
// digest does not display up to the head it read at, and it cannot sweep past
// what a successful read covered.
//
// These cases are the card's own negative acceptance, in its order.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { DigestSection } from './DigestSection'
import { I18nProvider } from './i18n'
import { en } from './i18n/en'
import type { Digest, FabricApi, ProjectRow } from '../../shared/types'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const project = { id: 'p1', name: 'Fabric', default_agent: 'claude-code' } as ProjectRow

const lines = (seqs: number[], boundary: number): Digest => ({
  state: 'lines',
  boundary,
  lines: seqs.map((seq) => ({
    kind: 'decision' as const,
    seq,
    at: '2026-09-10T00:00:00.000Z',
    text: `decision at ${seq}`,
    source: { store: 'memory_facts', id: `f${seq}` }
  }))
})

/**
 * The digest surface, with the read and the acknowledgement both observable.
 *
 * `seen` is typed from the real API rather than as a bare `vi.fn()`: the
 * argument list is exactly what these cases assert about, and a mock that
 * accepts anything would have let the assertions be written against a shape
 * the product does not have.
 */
function stub(read: () => Promise<Digest>) {
  const api = {
    digest: {
      read: vi.fn(read),
      seen: vi.fn<FabricApi['digest']['seen']>(async () => {})
    }
  }
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: api }))
  return api
}

const show = (feedMark: number, onError = vi.fn()) =>
  render(
    <I18nProvider locale="en">
      <DigestSection project={project} feedMark={feedMark} onError={onError} />
    </I18nProvider>
  )

const panel = (feedMark: number, onError = vi.fn()): React.ReactElement => (
  <I18nProvider locale="en">
    <DigestSection project={project} feedMark={feedMark} onError={onError} />
  </I18nProvider>
)

describe('a refresh cannot acknowledge the news it is refreshing for', () => {
  it('acknowledges nothing on a refresh, and only the boundary on screen when the person leaves', async () => {
    // THE MEASURED DEFECT. Read at head 100 showing two lines; three events
    // arrive and the mark moves to 103. The old code marked 103 seen — the
    // three unshown events included. The boundary of what was SHOWN is 100.
    // The feed mark and the boundary are DELIBERATELY different numbers. They
    // can be in the product — the mark is what this renderer has seen arrive,
    // the boundary is the head the main process read — and when a fixture makes
    // them equal, "acknowledge the mark" and "acknowledge what was shown" agree
    // and a plant swapping one for the other goes unnoticed. Measured: it did.
    const api = stub(async () => lines([98, 99], 100))
    const { rerender, unmount } = render(panel(70))
    await waitFor(() => expect(screen.getByText('decision at 99')).toBeTruthy())

    // Nothing was acknowledged, so main reads from the same mark: the old lines and the new ones.
    api.digest.read.mockResolvedValue(lines([98, 99, 101, 102, 103], 103))
    rerender(panel(71))
    await waitFor(() => expect(screen.getByText('decision at 103')).toBeTruthy())

    // Audit 2026-10-05 A4-002: a refresh acknowledges nothing, and the lines being read stay.
    expect(api.digest.seen).not.toHaveBeenCalled()
    expect(screen.getByText('decision at 99')).toBeTruthy()

    unmount()
    // Leaving acknowledges what was on screen, exactly once, and nothing older is sent on its own.
    await waitFor(() => expect(api.digest.seen).toHaveBeenCalledWith(project.id, 103))
    expect(api.digest.seen.mock.calls).toEqual([[project.id, 103]])
  })

  it('and the new items stay on screen rather than being swept by their own arrival', async () => {
    const api = stub(async () => lines([98], 100))
    const { rerender } = render(panel(70))
    await waitFor(() => expect(screen.getByText('decision at 98')).toBeTruthy())
    api.digest.read.mockResolvedValue(lines([101], 101))
    rerender(panel(71))
    await waitFor(() => expect(screen.getByText('decision at 101')).toBeTruthy())
    // Stated as a property of every call rather than as the absence of one
    // particular call: `not.toHaveBeenCalledWith(p, 101)` was trivially true
    // against the old code, which called `seen(p)` with ONE argument and no
    // boundary at all. An assertion that cannot fail against the defect it
    // names is not an assertion.
    for (const call of api.digest.seen.mock.calls) {
      expect(call, 'every acknowledgement carries a boundary').toHaveLength(2)
      expect(call[0]).toBe(project.id)
      // 100 is the only payload that has left the screen; 101 is still on it.
      expect(call[1]).toBeLessThanOrEqual(100)
    }
  })
})

describe('a failed read cannot advance the mark', () => {
  it('acknowledges nothing at all when nothing was ever shown', async () => {
    const onError = vi.fn()
    const api = stub(async () => {
      throw new Error('the digest could not be read')
    })
    const { unmount } = show(0, onError)
    await waitFor(() => expect(onError).toHaveBeenCalled())
    unmount()
    // NOT called. The old code called it here deliberately, to stop an
    // unshowable digest becoming a permanent backlog — and in doing so threw
    // away news nobody had seen. The next successful read sweeps to its own
    // boundary, which handles the backlog without discarding anything.
    expect(api.digest.seen).not.toHaveBeenCalled()
  })

  it('and a failed REFRESH advances only to the last payload that was shown', async () => {
    const api = stub(async () => lines([98, 99], 100))
    const { rerender, unmount } = render(panel(100))
    await waitFor(() => expect(screen.getByText('decision at 99')).toBeTruthy())
    api.digest.read.mockRejectedValue(new Error('the store went away'))
    rerender(panel(105))
    await waitFor(() => expect(screen.queryByTestId('digest-stale')).toBeTruthy())
    unmount()
    expect(api.digest.seen).not.toHaveBeenCalledWith(project.id, 105)
    expect(api.digest.seen).toHaveBeenCalledWith(project.id, 100)
  })
})

describe('a failed refresh keeps the last digest, says its age, and offers a retry', () => {
  it('keeps the lines rather than blanking the panel', async () => {
    const api = stub(async () => lines([98, 99], 100))
    const { rerender } = render(panel(100))
    await waitFor(() => expect(screen.getByText('decision at 99')).toBeTruthy())
    api.digest.read.mockRejectedValue(new Error('the store went away'))
    rerender(panel(105))
    await waitFor(() => expect(screen.queryByTestId('digest-stale')).toBeTruthy())
    // Still there — and LABELLED, which is the difference between showing
    // something old and asserting it is current.
    expect(screen.getByText('decision at 99')).toBeTruthy()
    expect(screen.getByTestId('digest-stale').textContent).toMatch(/the store went away/)
  })

  it('and the retry asks again, without waiting for the next event', async () => {
    const api = stub(async () => lines([98], 100))
    const { rerender } = render(panel(100))
    await waitFor(() => expect(screen.getByText('decision at 98')).toBeTruthy())

    // Drive it into the failure first — the retry belongs to that state and is
    // correctly absent while the panel is healthy.
    api.digest.read.mockRejectedValue(new Error('nope'))
    rerender(panel(101))
    await waitFor(() => expect(screen.queryByTestId('digest-stale')).toBeTruthy())

    // THE POINT: a re-read the operator can ask for. Without it the panel waits
    // for the next journal event to try again, which may be hours, and until
    // then it shows an age that only grows.
    api.digest.read.mockResolvedValue(lines([98, 101], 101))
    const before = api.digest.read.mock.calls.length
    screen.getByTestId('digest-retry').click()
    await waitFor(() => expect(api.digest.read.mock.calls.length).toBeGreaterThan(before))
    // And the retry that succeeded clears the label rather than leaving the
    // panel looking broken with fresh data in it.
    await waitFor(() => expect(screen.queryByTestId('digest-stale')).toBeNull())
    expect(screen.getByText('decision at 101')).toBeTruthy()
  })

  it('an initial read that failed has no lines to keep, and says so', async () => {
    stub(async () => {
      throw new Error('nothing to fall back to')
    })
    render(panel(0))
    await waitFor(() => expect(screen.queryByTestId('digest-failed')).toBeTruthy())
    expect(screen.getByTestId('digest-failed').textContent).toMatch(/nothing to fall back to/)
    // NOT the waiting state. `queryByText(en['digest.nothingNew'])` was the
    // first version of this assertion and it could not fail: with `read={false}`
    // and no `waiting` prop, `EmptyState` renders an empty paragraph and that
    // text never appears either way. The panel now SAYS it is reading, which is
    // both better and checkable — and a failure must replace that sentence
    // rather than sit under it.
    expect(screen.queryByText(en['digest.reading'])).toBeNull()
  })
})

describe('a boundary the journal could not supply is not a boundary', () => {
  it('acknowledges nothing when the read carried no boundary', async () => {
    const api = stub(async () => ({ state: 'nothing-new', boundary: null }) as Digest)
    const { unmount } = render(panel(0))
    await waitFor(() => expect(api.digest.read).toHaveBeenCalled())
    unmount()
    // A null boundary means the head could not be read. Marking `now` seen
    // instead is the very substitution this card removes.
    expect(api.digest.seen).not.toHaveBeenCalled()
  })

  it('but "nothing happened" with a boundary still advances, so unshown KINDS do not pile up', async () => {
    // The concern behind the old always-advance cleanup, kept: an event of a
    // kind the digest does not display still moves the boundary, because the
    // boundary is the journal head the read was taken at rather than the
    // highest line on screen.
    const api = stub(async () => ({ state: 'nothing-new', boundary: 420 }) as Digest)
    const { unmount } = render(panel(0))
    await waitFor(() => expect(api.digest.read).toHaveBeenCalled())
    unmount()
    expect(api.digest.seen).toHaveBeenCalledWith(project.id, 420)
  })

  it('and a first visit establishes the mark, which is what makes a second visit mean anything', async () => {
    const api = stub(async () => ({ state: 'first-visit', boundary: 7 }) as Digest)
    const { unmount } = render(panel(0))
    await waitFor(() => expect(screen.getByText(en['digest.firstVisit'])).toBeTruthy())
    unmount()
    expect(api.digest.seen).toHaveBeenCalledWith(project.id, 7)
  })
})

it('recovered history is readable without claiming completion or fabricating a time', async () => {
  stub(async () => ({ state: 'lines', boundary: 8, lines: [{ kind: 'capture', seq: 8, at: null,
    text: 'Recovered partial output', source: {store: 'session_transcripts', id: 'recovered'} }] }))
  show(8)
  await screen.findByText('Recovered partial output')
  expect(screen.getByText(en['digest.kind.capture'])).toBeTruthy()
  expect(screen.getByText(en['digest.timeUnknown'])).toBeTruthy()
  expect(screen.queryByText(en['digest.kind.session'])).toBeNull()
  expect(document.body.textContent).not.toContain('NaN')
})

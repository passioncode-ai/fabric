// A failed read of what is waiting rendered as a measured calm (UXA-C01).
//
// MEASURED at `2e4b25e`. THREE readers of `attention.list()` sit on the estate
// home, two of them within ten lines of the third:
//
//   - `AttentionPanel` (SCR-30) keeps an `alive` flag and reports a rejection
//     through `onError`, so a failure is said and the last list is kept;
//   - `BoardPanel`, rendered at the top of this very screen, keeps an `alive`
//     flag and a `problem` state, and renders the problem;
//   - `EstateHome`'s own effect does NEITHER. It is written
//     `.catch(() => setWaiting({}))`, so a read that could not be made becomes
//     "nothing is waiting on any project", silently, on every card at once.
//
// M147 is quoted in this file's own comment for why the cards and the panel
// share one query: "two numbers describing the same thing, on two surfaces, is
// worse than one surface having none — the operator cannot tell which is wrong,
// so neither is usable". On a failure the panel says something went wrong and
// the cards say the estate is calm. That is the disagreement M147 forbids,
// arrived at from the error path instead of from a second query.
//
// UXA-C02 CONTINUES IT FROM THE OTHER SIDE. Everything above is about the call
// REJECTING. The main process reads five sources for this queue and, when one
// of them refuses, returns the rows it did get — successfully. So the promise
// resolves, the banner above never fires, and a queue missing every refusal in
// the estate is rendered as the whole queue. `readAttentionWithSources`
// measures exactly that — which source failed, and whether the refusal window
// was cut — and the IPC handler used to drop both on the floor, through a
// wrapper whose own comment said callers had "nowhere to put the receipts"
// while `board.query`, reading the same function, had the place.
//
// A refusal is the HIGHEST-ranked obligation in `attention.ts` — somebody is
// blocked right now — so the state this erases is the one that matters most.
//
// The second half is the overlap. The effect follows `marks.all`, which moves
// on every journal event, and it holds no `alive` flag: two reads in flight
// resolve in whatever order the main process answers, and an older answer
// overwrites a newer one. The card's own acceptance names this — "slow replay
// does not overlap; unknown/error does not become zero".

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { EstateHome } from './EstateHome'
import { I18nProvider } from './i18n'
import { NO_MARKS, type FeedMarks } from '../../shared/feedMarks'
import type { AttentionItem } from '../../shared/attention'
import { envelope, type ReadEnvelope } from '../../shared/readEnvelope'
import type { ProjectRow } from '../../shared/types'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const project = (id: string): ProjectRow => ({
  id,
  estate_id: 'e1',
  name: `name-${id}`,
  purpose: null,
  repo_path: null,
  status: 'active',
  config_revision: 1,
  created_at: '2026-09-11T00:00:00Z',
  memory_backend: 'local',
  default_agent: 'claude',
  mcp_servers: []
})

const refusal = (projectId: string, seq: number): AttentionItem => ({
  kind: 'refused',
  ref: { kind: 'refusal', id: String(seq) },
  projectId,
  projectName: `name-${projectId}`,
  title: 'the research MCP',
  detail: 'a grant would unblock it',
  since: '2026-09-11T00:00:00Z',
  grantable: { floorClass: 'mcp', target: 'research', askedBecause: null }
})

const stamp = '2026-09-11T00:00:00Z'

/**
 * The envelope the main process builds, built HERE BY THE SAME FUNCTION.
 *
 * `envelope()` derives availability from the receipts and refuses to be told
 * otherwise, so a fixture cannot be more generous than the product: writing
 * `complete` beside a failed source is not expressible.
 */
const answered = (items: AttentionItem[]): ReadEnvelope<AttentionItem[]> =>
  envelope({
    data: items,
    sources: [{ name: 'obligations/reviews', status: 'ok', asOf: stamp }],
    asOf: stamp,
    freshness: 'fresh'
  })

/** Four sources answered and the refusals did not — the case the card is about. */
const partly = (items: AttentionItem[]): ReadEnvelope<AttentionItem[]> =>
  envelope({
    data: items,
    sources: [
      { name: 'obligations/reviews', status: 'ok', asOf: stamp },
      { name: 'obligations/refusals', status: 'error', asOf: null, errorCode: 'permission denied for table journal' }
    ],
    asOf: stamp,
    freshness: 'fresh'
  })

/** Nothing answered at all. */
const nothing = (): ReadEnvelope<AttentionItem[]> =>
  envelope({
    data: [],
    sources: [{ name: 'obligations/reviews', status: 'error', asOf: null, errorCode: 'the store is not answering' }],
    asOf: null
  })

/** Complete, but the refusal window was cut — an OMISSION, not an error. */
const cut = (items: AttentionItem[]): ReadEnvelope<AttentionItem[]> =>
  envelope({
    data: items,
    sources: [{ name: 'obligations/refusals', status: 'ok', asOf: stamp }],
    omitted: [{ count: null, reason: 'refusals older than the last 50 policy decisions were not read' }],
    asOf: stamp,
    freshness: 'fresh'
  })

/** Only what this screen reaches for on mount; `attention.list` is the subject. */
function stub(list: () => Promise<ReadEnvelope<AttentionItem[]>>): void {
  vi.stubGlobal(
    'window',
    Object.assign(globalThis.window ?? {}, {
      fabric: {
        favourites: { list: async () => [], toggle: async () => [] },
        workspace: { state: async () => ({ git: 'declined' }) },
        board: { query: async () => ({ rows: [], total: 0 }) },
        attention: { list },
        estate: { summary: async () => null, profile: async () => null },
        memory: { overview: async () => null }
      }
    })
  )
}

const show = (marks: FeedMarks = NO_MARKS) =>
  render(
    <I18nProvider locale="en">
      <EstateHome
        projects={[project('p1')]}
        sessions={[]}
        feed={[]}
        marks={marks}
        readThroughSeq={0}
        onRead={async () => {}}
        onOpen={vi.fn()}
        onNew={vi.fn()}
      />
    </I18nProvider>
  )

const at = (all: number): FeedMarks => ({ all, byFamily: {} })

describe('what is waiting is either counted or said to be unreadable', () => {
  it('counts what the read returned — the fixture IS the waiting case', async () => {
    // Asserted first, so the cases below are about the ERROR path rather than
    // about a card that would never have shown a chip anyway.
    stub(async () => answered([refusal('p1', 7)]))
    show()
    await waitFor(() => expect(screen.getByText(/1 waiting on you/)).toBeTruthy())
  })

  it('does NOT report an outage when the estate is genuinely calm', async () => {
    // The other direction, so the rule is not "always complain": a measured
    // empty queue is an answer, and a screen that qualifies it teaches the
    // operator to ignore the qualification on the day it is true.
    stub(async () => answered([]))
    show()
    await waitFor(() => expect(screen.getAllByText(/name-p1/).length).toBeGreaterThan(0))
    expect(screen.queryByText(/could not be read/i)).toBeNull()
    expect(screen.queryByText(/waiting on you/)).toBeNull()
  })

  it('SAYS SO when the read could not be made, instead of showing calm cards', async () => {
    // The defect. `.catch(() => setWaiting({}))` turns an outage into
    // "nothing is waiting", on every card, with nothing said anywhere.
    stub(async () => {
      throw new Error('the bridge is not answering')
    })
    show()
    await waitFor(() =>
      expect(screen.getByText(/could not be read|not answering/i)).toBeTruthy()
    )
    // And it does not invent a count to go with the outage.
    expect(screen.queryByText(/waiting on you/)).toBeNull()
  })

  it('and a slow read cannot overwrite the answer that came after it', async () => {
    // `marks.all` moves on every journal event, so two reads overlap routinely.
    // Without an alive flag the loser of the race wins the screen.
    let releaseStale: (e: ReadEnvelope<AttentionItem[]>) => void = () => {}
    const stale = new Promise<ReadEnvelope<AttentionItem[]>>((resolve) => {
      releaseStale = resolve
    })
    const list = vi
      .fn<() => Promise<ReadEnvelope<AttentionItem[]>>>()
      .mockReturnValueOnce(stale)
      .mockResolvedValue(answered([refusal('p1', 9)]))
    stub(list)
    const { rerender } = show(at(1))
    rerender(
      <I18nProvider locale="en">
        <EstateHome
          projects={[project('p1')]}
          sessions={[]}
          feed={[]}
          marks={at(2)}
          readThroughSeq={0}
          onRead={async () => {}}
          onOpen={vi.fn()}
          onNew={vi.fn()}
        />
      </I18nProvider>
    )
    await waitFor(() => expect(screen.getByText(/1 waiting on you/)).toBeTruthy())
    releaseStale(answered([refusal('p1', 1), refusal('p1', 2), refusal('p1', 3)]))
    await stale
    await new Promise((r) => setTimeout(r, 0))
    expect(list).toHaveBeenCalledTimes(2)
    expect(screen.getByText(/1 waiting on you/), 'the newer answer stands').toBeTruthy()
    expect(screen.queryByText(/3 waiting on you/)).toBeNull()
  })
})

describe('a partial read is not a complete one (UXA-C02)', () => {
  it('keeps the rows that DID answer, so one outage does not hide the other projects', async () => {
    // The card's own acceptance: fail each source independently and the
    // unaffected rows survive. Dropping to "could not be read" here would be
    // the opposite mistake and just as wrong.
    stub(async () => partly([refusal('p1', 7)]))
    show()
    await waitFor(() => expect(screen.getByText(/1 waiting on you/)).toBeTruthy())
  })

  it('and SAYS which source did not answer, so the counts are not read as totals', async () => {
    stub(async () => partly([refusal('p1', 7)]))
    show()
    await waitFor(() => expect(screen.getByText(/refusals|permission denied/i)).toBeTruthy())
  })

  it('does not call the estate calm when the read was partial and returned nothing', async () => {
    // The worst shape of this defect: the refusals source refuses, no other
    // obligation exists, and the screen shows a calm estate as a MEASUREMENT.
    stub(async () => partly([]))
    show()
    await waitFor(() => expect(screen.getAllByText(/name-p1/).length).toBeGreaterThan(0))
    await waitFor(() => expect(screen.getByText(/refusals|permission denied/i)).toBeTruthy())
  })

  it('says so when every source refused, and shows no counts at all', async () => {
    stub(async () => nothing())
    show()
    await waitFor(() => expect(screen.getByText(/could not be read|not answering/i)).toBeTruthy())
    expect(screen.queryByText(/waiting on you/)).toBeNull()
  })

  it('and a CUT refusal window is said too, though every source answered', async () => {
    // `truncated` was measured beside `failed` and discarded with it. A refusal
    // older than the window is simply not in the queue, and silence about that
    // is the same lie in a different shape.
    stub(async () => cut([refusal('p1', 7)]))
    show()
    await waitFor(() => expect(screen.getByText(/1 waiting on you/)).toBeTruthy())
    expect(screen.getByText(/older than|not read/i), 'the omission is on the screen').toBeTruthy()
  })

  it('but a COMPLETE read says nothing extra', async () => {
    stub(async () => answered([refusal('p1', 7)]))
    show()
    await waitFor(() => expect(screen.getByText(/1 waiting on you/)).toBeTruthy())
    expect(screen.queryByText(/could not be read/i)).toBeNull()
    expect(screen.queryByText(/did not answer/i)).toBeNull()
    expect(screen.queryByText(/older than/i)).toBeNull()
  })
})

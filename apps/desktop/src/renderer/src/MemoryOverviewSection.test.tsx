// One source failing must not hide another that succeeded (S14 · REQ-S14-7).
//
// MEASURED BEFORE THIS FILE EXISTED. The panel fetched both reads through one
// `Promise.all` and set both pieces of state in its `then`. So a `misses` query
// that threw — a missing grant, a dropped connection — discarded a perfectly
// good `overview` that had already come back, and the panel rendered its
// loading state forever while the error went to a banner somewhere else.
//
// The panel is the right place to prove it: `memoryOverview.ts` already models
// a store that could not be read, and every one of those six honest numbers was
// thrown away by the fetch above it.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryOverviewSection } from './MemoryOverviewSection'
import type { MemoryMiss, ProjectRow } from '../../shared/types'
import type { MemoryOverview, StoreCount } from '../../shared/memoryOverview'
import { en } from './i18n/en'

afterEach(cleanup)

const project = { id: 'p1', name: 'atlas', estate_id: 'e1' } as ProjectRow

const AT = '2026-09-10T00:00:00.000Z'
const count = (rows: number): StoreCount => ({ rows, problem: null, asOf: AT })
const overview: MemoryOverview = {
  facts: count(5),
  superseded: count(0),
  retrievals: count(20),
  misses: count(3),
  transcripts: count(2),
  packs: count(1)
}
// Spelled out with no cast: a partial object cast to the type stops being a
// fixture for it, and the first run then fails inside the component.
const misses: MemoryMiss[] = [
  {
    store: 'facts',
    query: 'where is the deploy key',
    askedAt: '2026-09-08T00:00:00Z',
    bySession: null
  }
]

function stub(api: { overview: () => Promise<MemoryOverview>; misses: () => Promise<MemoryMiss[]> }): void {
  // Only the two calls this panel makes. A fuller stub would let the test pass
  // against a panel that started calling something else.
  ;(globalThis as unknown as { window: { fabric: unknown } }).window.fabric = {
    memory: { overview: api.overview, misses: api.misses }
  }
}

describe('the panel reads its two sources independently', () => {
  it('shows the counts when both answered', async () => {
    stub({ overview: () => Promise.resolve(overview), misses: () => Promise.resolve(misses) })
    render(<MemoryOverviewSection project={project} feedMark={1} />)
    expect(await screen.findByText('5')).toBeTruthy()
    expect(await screen.findByText(/deploy key/)).toBeTruthy()
  })

  it('still shows the overview when the misses read fails', async () => {
    // The whole point. Five facts were successfully counted; a failure in the
    // other query must not take them off the screen.
    stub({
      overview: () => Promise.resolve(overview),
      misses: () => Promise.reject(new Error('permission denied for table memory_retrievals'))
    })
    render(<MemoryOverviewSection project={project} feedMark={1} />)
    expect(await screen.findByText('5')).toBeTruthy()
  })

  it('says the misses could not be read, rather than showing none', async () => {
    stub({
      overview: () => Promise.resolve(overview),
      misses: () => Promise.reject(new Error('permission denied for table memory_retrievals'))
    })
    render(<MemoryOverviewSection project={project} feedMark={1} />)
    await waitFor(() => expect(screen.getByText(/permission denied/)).toBeTruthy())
    // An empty-state sentence here would be the lie: "nothing was ever asked"
    // and "the question could not be asked" are different facts.
    expect(screen.queryByText(/nothing memory could not answer/i)).toBeNull()
  })

  it('still shows the misses when the overview read fails', async () => {
    stub({
      overview: () => Promise.reject(new Error('overview is unreachable')),
      misses: () => Promise.resolve(misses)
    })
    render(<MemoryOverviewSection project={project} feedMark={1} />)
    expect(await screen.findByText(/deploy key/)).toBeTruthy()
    await waitFor(() => expect(screen.getByText(/unreachable/)).toBeTruthy())
  })

  it('offers a retry for the source that failed', async () => {
    const missesCall = vi.fn(() => Promise.reject(new Error('permission denied')))
    stub({ overview: () => Promise.resolve(overview), misses: missesCall })
    render(<MemoryOverviewSection project={project} feedMark={1} />)
    await waitFor(() => expect(screen.getByText(/permission denied/)).toBeTruthy())
    const retry = screen.getByRole('button', { name: /try again|повтор/i })
    // And it actually re-reads: a button that renders and does nothing is the
    // shape of the defect this file exists for, one layer along.
    expect(missesCall).toHaveBeenCalledTimes(1)
    fireEvent.click(retry)
    await waitFor(() => expect(missesCall).toHaveBeenCalledTimes(2))
  })
})

describe('a count says when it was taken, and never-read is its own answer (UX28-07)', () => {
  it('shows the age of the counts', async () => {
    // A count with no age is as old as whenever it was read and reads as now.
    // The card's negative acceptance: a stale source cannot present a current
    // count.
    const old: MemoryOverview = {
      ...overview,
      facts: { rows: 5, problem: null, asOf: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() }
    }
    stub({ overview: () => Promise.resolve(old), misses: () => Promise.resolve(misses) })
    render(<MemoryOverviewSection project={project} feedMark={1} />)
    await waitFor(() => expect(screen.queryByTestId('memory-counts-age')).toBeTruthy())
    expect(screen.getByTestId('memory-counts-age').textContent).toMatch(/4h|hour/i)
  })

  it('and says NOT READ for a store nobody asked about, which is not a refusal', async () => {
    // These rendered identically before: a never-read store has no problem, so
    // `memory.unreadable` was formatted with an empty reason and read as a
    // broken store rather than an unasked one.
    stub({ overview: () => Promise.resolve({ ...overview, packs: { rows: null, problem: null, asOf: null } }), misses: () => Promise.resolve(misses) })
    render(<MemoryOverviewSection project={project} feedMark={1} />)
    await waitFor(() => expect(screen.getByText(en['memory.notRead'])).toBeTruthy())
    // NOT the refusal sentence with an empty reason, which is exactly what a
    // never-read store used to render. The first version of this assertion
    // matched /could not be read/i and hit the PANEL'S OWN LEDE, which explains
    // the rule in the same words — a check that matches the prose about itself.
    const emptyReason = en['memory.unreadable'].replace('{reason}', '').trim()
    expect(screen.queryByText(emptyReason)).toBeNull()
  })

  it('and a refusal still names its reason', async () => {
    stub({ overview: () => Promise.resolve({ ...overview, packs: { rows: null, problem: 'the packs table refused', asOf: null } }), misses: () => Promise.resolve(misses) })
    render(<MemoryOverviewSection project={project} feedMark={1} />)
    await waitFor(() => expect(screen.getByText(/the packs table refused/)).toBeTruthy())
    expect(screen.queryByText(en['memory.notRead'])).toBeNull()
  })

  it('and a never-read store makes the reading partial rather than whole', async () => {
    // The latent defect the third state exposed: `fullyRead` asked whether
    // every store had no PROBLEM, which a never-read store also does not — so
    // the panel called the reading complete about stores it had never looked at.
    stub({ overview: () => Promise.resolve({ ...overview, packs: { rows: null, problem: null, asOf: null } }), misses: () => Promise.resolve(misses) })
    render(<MemoryOverviewSection project={project} feedMark={1} />)
    await waitFor(() => expect(screen.getByText(en['memory.partial'])).toBeTruthy())
  })
})

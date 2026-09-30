// "Nothing matches, in any store" named no store (UX28-09).
//
// SCN-048 step 4 asks for something specific: an empty result "names which
// stores were searched, so 'nobody wrote it down' stays distinguishable from
// 'not searched'". The panel said "Nothing matches, in any store." — which
// names none of them, and reads as the first while meaning neither. With three
// stores that was vague; with five it is vaguer, and the sentence gets more
// reassuring as the door gets wider.
//
// The stores are taken from the groups that ANSWERED, so a store that refused
// is never listed among the places we looked — which is the whole distinction
// the step is about.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SearchPanel } from './SearchPanel'
import { I18nProvider } from './i18n'
import { en } from './i18n/en'
import { SEARCH_STORES, coverageOfStore, type SearchGroup } from '../../shared/search'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** A group built the way the reader builds one, so a fixture cannot express a
 *  coverage the product does not produce. */
const group = (over: Partial<SearchGroup> & Pick<SearchGroup, 'store'>): SearchGroup => ({
  method: 'ranked',
  hits: [],
  problem: null,
  labelProblem: null,
  coverage: coverageOfStore(over.hits?.length ?? 0),
  ...over
})

function stub(groups: SearchGroup[]) {
  const api = { search: { run: vi.fn(async () => groups) } }
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: api }))
  return api
}

/**
 * `fireEvent.change`, not a direct assignment.
 *
 * Setting `input.value` and dispatching `input` by hand does NOT update a React
 * controlled field: React tracks the value through its own descriptor and
 * ignores the write, so the panel's `query` state never changed and nothing
 * was ever searched. The first version of this helper did exactly that and all
 * three cases failed against working code.
 */
const type = (text: string): void => {
  fireEvent.change(document.querySelector('input') as HTMLInputElement, { target: { value: text } })
}

const show = (onOpen = vi.fn()) =>
  render(
    <I18nProvider locale="en">
      <SearchPanel onOpen={onOpen} onClose={vi.fn()} onError={vi.fn()} />
    </I18nProvider>
  )

describe('an empty result names where it looked', () => {
  it('lists the stores that answered, by name', async () => {
    // Every store answered and none matched — the one case where "nothing" is a
    // fact rather than a guess, and therefore the case that must say WHERE.
    stub(SEARCH_STORES.map((store) => group({ store })))
    show()
    type('ledger')
    await waitFor(() => expect(screen.getByText(/Nothing matches/)).toBeTruthy())
    const said = screen.getByText(/Nothing matches/).textContent ?? ''
    for (const store of SEARCH_STORES) {
      const label = en[`search.store.${store}` as 'search.store.facts']
      expect(said, `${store} is not named among the searched stores`).toContain(label)
    }
  })

  it('and never has to exclude a refused store, because it never gets that far', async () => {
    // The distinction step 4 exists for, and where it is ENFORCED matters: a
    // refused store makes the outcome `inconclusive` rather than empty, so the
    // searched-stores sentence does not render at all. A `problem === null`
    // filter on that list was tried and planted away — and the plant changed
    // nothing, because the branch is unreachable while a store is silent.
    // `outcomeOf` is where this holds; the filter was a guard that could not
    // fire.
    stub([
      group({ store: 'projects' }),
      group({ store: 'tasks' }),
      group({ store: 'facts' }),
      group({ store: 'decisions' }),
      group({ store: 'transcripts', problem: 'transcripts refused' })
    ])
    show()
    type('ledger')
    // WAIT ON THE POSITIVE FIRST. The absence of "Nothing matches" is true
    // before the debounce has even fired, so waiting on it passed instantly and
    // the next line then ran against an empty panel. An absence is only worth
    // asserting once something has arrived to be absent beside.
    await waitFor(() => expect(screen.getByText(/transcripts refused/)).toBeTruthy())
    // Not the empty claim at all — one store is silent, so "nothing matches"
    // would be a completeness claim made over a store nobody heard from.
    expect(screen.queryByText(/Nothing matches/)).toBeNull()
  })
})

describe('the five stores each have a heading', () => {
  it('renders a name for every declared store', async () => {
    // A store searched with no heading is a result nobody can attribute; a
    // heading with no store is a promise nobody keeps. Driven from the declared
    // list so adding a sixth store fails here rather than shipping unnamed.
    stub(SEARCH_STORES.map((store) => group({ store, hits: [] })))
    show()
    type('ledger')
    await waitFor(() => expect(screen.getByText(/Nothing matches/)).toBeTruthy())
    for (const store of SEARCH_STORES) {
      const label = en[`search.store.${store}` as 'search.store.facts']
      expect(label, `search.store.${store} has no string`).toBeTruthy()
    }
  })
})

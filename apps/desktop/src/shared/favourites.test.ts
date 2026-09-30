import { describe, expect, it } from 'vitest'
import {
  FAVOURITE_LIMIT,
  FAVOURITE_THRESHOLD,
  arrangeRest,
  moveWithin,
  planMove,
  offersFavourites,
  partitionByFavourite,
  replacePin,
  togglePin
} from './favourites.ts'

const p = (id: string): { id: string } => ({ id })
const all = [p('a'), p('b'), p('c'), p('d')]

describe('pinned projects', () => {
  it('lets no project appear twice, and loses none', () => {
    const { pinned, rest } = partitionByFavourite(all, ['c', 'a'])
    const seen = [...pinned, ...rest].map((x) => x.id).sort()
    expect(seen).toEqual(['a', 'b', 'c', 'd'])
    expect(seen.length).toBe(new Set(seen).size)
  })

  it('keeps the order they were PINNED in, not the order they arrive in', () => {
    // Re-sorting a list the operator arranged would silently undo a decision
    // they made with a click.
    expect(partitionByFavourite(all, ['c', 'a']).pinned.map((x) => x.id)).toEqual(['c', 'a'])
  })

  it('skips a favourite whose project is gone rather than rendering a hole', () => {
    const { pinned } = partitionByFavourite(all, ['a', 'deleted', 'b'])
    expect(pinned.map((x) => x.id)).toEqual(['a', 'b'])
  })

  it('with nothing pinned, every project is in the rest', () => {
    expect(partitionByFavourite(all, []).rest.map((x) => x.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(partitionByFavourite(all, []).pinned).toEqual([])
  })

  it('with everything pinned, the rest is empty rather than a copy', () => {
    const { pinned, rest } = partitionByFavourite(all, ['a', 'b', 'c', 'd'])
    expect(pinned).toHaveLength(4)
    expect(rest).toEqual([])
  })

  it('does not mutate what it was given', () => {
    const favourites = ['b']
    partitionByFavourite(all, favourites)
    expect(favourites).toEqual(['b'])
    expect(all.map((x) => x.id)).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('pinning and unpinning', () => {
  it('adds to the END, where the operator expects what they just did', () => {
    expect(togglePin(['a'], 'b')).toEqual({ kind: 'pinned', favourites: ['a', 'b'] })
  })

  it('removes without disturbing the others', () => {
    expect(togglePin(['a', 'b', 'c'], 'b')).toEqual({ kind: 'unpinned', favourites: ['a', 'c'] })
  })

  it('is its own inverse', () => {
    // Threaded through the result rather than chained on an array: the claim is
    // unchanged — pin then unpin returns the list you started with — and the
    // shape it travels in is what UX28-10 changed, so that a caller cannot
    // reach for a list without first looking at what happened.
    const pinned = togglePin(['a'], 'b')
    expect(pinned.kind).toBe('pinned')
    expect(togglePin(pinned.favourites, 'b')).toEqual({ kind: 'unpinned', favourites: ['a'] })
  })

  it('does not mutate the list it was given', () => {
    const before = ['a']
    togglePin(before, 'b')
    expect(before).toEqual(['a'])
  })
})

// ── THE LIMIT, THE THRESHOLD, AND WHAT HAPPENS AT THE EDGE (UX28-10) ────────
//
// SCN-043 has said three things since it was written, and the contract did none
// of them:
//
//   step 1 — "up to five favourites lead". `togglePin` appended without limit.
//   step 2 — "at five, pinning a sixth asks which to release rather than
//            silently dropping one". Nothing asked; a sixth was simply added.
//   step 3 — "six projects or fewer: no favourites step is offered anywhere,
//            because ranking five of six is ceremony". The pin button rendered
//            on every card at any count.
//
// And the alt path: "an archived favourite leaves the row and says so rather
// than showing as a dead card". It left the row — `partitionByFavourite` skips
// a project it cannot find, deliberately, so that a transient failure to load
// does not unpin anything — and said nothing at all.
//
// SEVENTH card running where the scenario was right and the code was not.

describe('the limit is declared, and pinning past it asks rather than drops', () => {
  it('adds up to the limit', () => {
    const five = ['a', 'b', 'c', 'd', 'e']
    expect(five.length, 'the fixture must BE the limit, or this proves nothing').toBe(
      FAVOURITE_LIMIT
    )
    const change = togglePin(five.slice(0, 4), 'e')
    expect(change.kind).toBe('pinned')
    expect(change.kind === 'pinned' && change.favourites).toEqual(five)
  })

  it('and refuses the sixth WITHOUT dropping anything', () => {
    // The whole point of step 2: the operator chooses. A silent drop takes a
    // decision they made with a click and undoes it without telling them.
    const five = ['a', 'b', 'c', 'd', 'e']
    const change = togglePin(five, 'f')
    expect(change.kind).toBe('at-limit')
    expect(change.kind === 'at-limit' && change.favourites).toEqual(five)
    expect(change.kind === 'at-limit' && change.limit).toBe(FAVOURITE_LIMIT)
  })

  it('unpinning is never at the limit, because it makes room', () => {
    const change = togglePin(['a', 'b', 'c', 'd', 'e'], 'c')
    expect(change.kind).toBe('unpinned')
    expect(change.kind === 'unpinned' && change.favourites).toEqual(['a', 'b', 'd', 'e'])
  })

  it('and a replacement is ONE change, not an unpin followed by a pin', () => {
    // Two writes would leave a window where four are pinned, and a failure
    // between them would lose the released one without gaining the new one.
    const next = replacePin(['a', 'b', 'c', 'd', 'e'], 'b', 'f')
    expect(next).toEqual(['a', 'c', 'd', 'e', 'f'])
    expect(next.length).toBe(FAVOURITE_LIMIT)
  })

  it('a replacement that names a project not pinned changes nothing', () => {
    // Refused rather than appended: "release z, pin f" when z is not pinned is
    // a stale screen, and honouring half of it would exceed the limit.
    expect(replacePin(['a', 'b', 'c', 'd', 'e'], 'z', 'f')).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
})

describe('below the threshold, ranking is ceremony', () => {
  // AMENDED 2026-09-29 (SCN-043 step 3, the launch design SCR-30/SCR-01): the
  // home's "My projects" list carries ★ ↑ ↓ on every row from the second
  // project on. Ranking one of one is still ceremony, so a single project is
  // offered neither.
  it('offers no favourites for one project or none', () => {
    expect(FAVOURITE_THRESHOLD).toBe(1)
    for (const count of [0, 1]) expect(offersFavourites(count), `${count} projects`).toBe(false)
  })

  it('and offers them from the second project on', () => {
    for (const count of [2, 4, 7, 20]) expect(offersFavourites(count), `${count} projects`).toBe(true)
  })
})

describe('the order of the rest is the operator\'s', () => {
  const rest = [p('a'), p('b'), p('c'), p('d')]
  it('follows the stored order, and leaves an unknown project where it arrived, after the known', () => {
    expect(arrangeRest(rest, ['c', 'a']).map((x) => x.id)).toEqual(['c', 'a', 'b', 'd'])
  })

  it('ignores an id the list no longer holds, and loses nobody', () => {
    const out = arrangeRest(rest, ['gone', 'd']).map((x) => x.id)
    expect(out).toEqual(['d', 'a', 'b', 'c'])
    expect([...out].sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('with no stored order, is the order the projects arrived in', () => {
    expect(arrangeRest(rest, []).map((x) => x.id)).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('moving one step', () => {
  it('swaps with the neighbour in the direction asked', () => {
    expect(moveWithin(['a', 'b', 'c'], 'b', 'up')).toEqual(['b', 'a', 'c'])
    expect(moveWithin(['a', 'b', 'c'], 'b', 'down')).toEqual(['a', 'c', 'b'])
  })

  it('at an edge, or for an id not in the list, changes nothing', () => {
    expect(moveWithin(['a', 'b'], 'a', 'up')).toEqual(['a', 'b'])
    expect(moveWithin(['a', 'b'], 'b', 'down')).toEqual(['a', 'b'])
    expect(moveWithin(['a', 'b'], 'z', 'up')).toEqual(['a', 'b'])
  })

  it('never mutates the list it was given', () => {
    const ids = ['a', 'b']
    moveWithin(ids, 'b', 'up')
    expect(ids).toEqual(['a', 'b'])
  })
})

describe('a favourite whose project is not there is reported, not just skipped', () => {
  it('names the ones it could not place', () => {
    // It is skipped on purpose — deleting it on a read would mean a transient
    // failure to load a project quietly unpins it — and that is exactly why the
    // surface has to SAY so: otherwise a pinned project just is not there.
    const split = partitionByFavourite([{ id: 'a' }, { id: 'c' }], ['a', 'gone', 'c'])
    expect(split.pinned.map((p) => p.id)).toEqual(['a', 'c'])
    expect(split.missing).toEqual(['gone'])
  })

  it('and reports none when every favourite is present', () => {
    const split = partitionByFavourite([{ id: 'a' }], ['a'])
    expect(split.missing).toEqual([])
  })

  it('and the stored preference is untouched either way', () => {
    // The preference is the operator's; a read is not the place it changes.
    const favourites = ['a', 'gone']
    partitionByFavourite([{ id: 'a' }], favourites)
    expect(favourites).toEqual(['a', 'gone'])
  })
})

describe('which list an arrow writes', () => {
  it('a pinned project moves among the pins, which are the favourites list itself', () => {
    expect(planMove(['a', 'b'], ['c', 'd'], 'b', 'up')).toEqual({ list: 'pins', next: ['b', 'a'] })
  })

  it('any other moves among the unpinned, as the screen shows them', () => {
    expect(planMove(['a'], ['c', 'd'], 'd', 'up')).toEqual({ list: 'order', next: ['d', 'c'] })
  })

  it('a stale screen that still lists a pinned id among the rest cannot write it into the order', () => {
    expect(planMove(['a'], ['a', 'c', 'd'], 'c', 'up')).toEqual({ list: 'order', next: ['c', 'd'] })
  })
})

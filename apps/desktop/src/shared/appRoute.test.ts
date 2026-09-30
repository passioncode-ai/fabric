import { describe, expect, it } from 'vitest'
import {
  addressKey,
  asOfAt,
  entityAt,
  focusFor,
  focusSurvives,
  returnableTo,
  revealAt,
  routeToEntity,
  routeToProject,
  sameRoute,
  withoutAddress,
  type AppRoute,
  type Focus
} from './appRoute.ts'

const focus: Focus = {
  projectId: 'p1',
  ref: { kind: 'task', id: 't1' }
}

describe('the shell is in one place at a time', () => {
  it('leaves the agents view by arriving somewhere else', () => {
    // Not by a second setter at the call site: the previous shape was
    // `active` plus a boolean, and a click that set only the first left the
    // agents list on screen over the project it had just opened.
    const from: AppRoute = { kind: 'agents' }
    const to = routeToProject('p1')
    expect(to).toEqual({ kind: 'project', projectId: 'p1' })
    expect(to.kind === from.kind).toBe(false)
  })

  it('has no state where it is both at the agents view and at a project', () => {
    const route: AppRoute = { kind: 'agents' }
    // The type is the mechanism; this asserts the value shape it produces.
    expect(Object.keys(route)).toEqual(['kind'])
  })
})

describe('a focus is addressed, consumed, and can expire', () => {
  it('is honoured only by the screen it was addressed to', () => {
    expect(focusFor(focus, 'p1')).toEqual({ kind: 'task', id: 't1' })
    expect(focusFor(focus, 'p2')).toBeNull()
  })

  it('is nothing at all when there is none', () => {
    expect(focusFor(null, 'p1')).toBeNull()
  })

  it('does not survive its project being closed', () => {
    expect(focusSurvives(focus, ['p1', 'p2'])).toBe(true)
    expect(focusSurvives(focus, ['p2'])).toBe(false)
  })

  it('is DERIVED from the address, so the route can still say where we are', () => {
    // The case that used to sit here asserted `focus.returnTo` — a field the
    // product read nowhere, whose only consumer was this line claiming it had
    // been written. That is the shape `check-written-never-read.mjs` was built
    // for, and it caught it only once tests stopped counting as readers.
    const route: AppRoute = { kind: 'project', projectId: 'p1', at: { kind: 'task', id: 't1' } }
    expect(revealAt(route, null)).toEqual(focus)
    // A project with no entity reveals nothing, and is still a place.
    expect(revealAt({ kind: 'project', projectId: 'p1' }, null)).toBeNull()
    expect(revealAt({ kind: 'home' }, null)).toBeNull()
  })

  it('is served ONCE per visit, and the address outlives the serving', () => {
    // The old shape cleared the request when the screen honoured it, which
    // also cleared the only record of where the operator was. Now a latch
    // closes and the address stays — so a re-render does not drag them back to
    // a task they have scrolled away from, and the place is still nameable.
    const route: AppRoute = { kind: 'project', projectId: 'p1', at: { kind: 'task', id: 't1' } }
    const key = addressKey(route)
    expect(key, 'an addressed route has a key to latch on').toBeTruthy()
    expect(revealAt(route, key)).toBeNull()
    expect(entityAt(route), 'the address survives being served').toEqual({ kind: 'task', id: 't1' })
  })

  it('and the same entity reached again is a NEW visit', () => {
    // Two search hits on one task are two visits, and both must reveal. The
    // latch is reset by navigation rather than remembering addresses for ever,
    // which is why this is a latch and not a second copy of the address.
    const route: AppRoute = { kind: 'project', projectId: 'p1', at: { kind: 'task', id: 't1' } }
    expect(revealAt(route, null)).toEqual(focus)
  })

  it('and a different revision of one entity is a different address', () => {
    const now: AppRoute = { kind: 'project', projectId: 'p1', at: { kind: 'task', id: 't1' } }
    const past: AppRoute = { kind: 'project', projectId: 'p1', at: { kind: 'task', id: 't1' }, asOf: '9' }
    expect(addressKey(now)).not.toBe(addressKey(past))
    // Serving one does not silence the other.
    expect(revealAt(past, addressKey(now))).not.toBeNull()
  })

  it('and clearing the reveal narrows to the project, which is still a place', () => {
    const route: AppRoute = { kind: 'project', projectId: 'p1', at: { kind: 'task', id: 't1' } }
    expect(withoutAddress(route)).toEqual({ kind: 'project', projectId: 'p1' })
    expect(withoutAddress({ kind: 'agents' })).toEqual({ kind: 'agents' })
  })
})

describe('the way back, which nothing read until AX-05', () => {
  // `Focus.returnTo` was written on EVERY navigation and read by nothing, with
  // a comment above it explaining why it existed. Fifth field of that shape in
  // one cycle, and the reason `scripts/check-written-never-read.mjs` exists.
  it('returns to the origin when it is somewhere else', () => {
    expect(returnableTo({ kind: 'agents' }, { kind: 'project', projectId: 'a' })).toEqual({ kind: 'agents' })
    expect(returnableTo({ kind: 'home' }, { kind: 'project', projectId: 'a' })).toEqual({ kind: 'home' })
    expect(
      returnableTo({ kind: 'project', projectId: 'a' }, { kind: 'project', projectId: 'b' })
    ).toEqual({ kind: 'project', projectId: 'a' })
  })

  it('and offers NOTHING when the origin is where you already are', () => {
    // A Back to the current place is a control that does nothing, and a control
    // that does nothing teaches the operator to ignore the one that does.
    expect(returnableTo({ kind: 'project', projectId: 'a' }, { kind: 'project', projectId: 'a' })).toBeNull()
    expect(returnableTo({ kind: 'home' }, { kind: 'home' })).toBeNull()
    expect(returnableTo({ kind: 'agents' }, { kind: 'agents' })).toBeNull()
    expect(returnableTo({ kind: 'draft', id: 'd1' }, { kind: 'draft', id: 'd1' })).toBeNull()
  })

  it('and nothing at all when there is no origin', () => {
    expect(returnableTo(null, { kind: 'home' })).toBeNull()
  })

  it('but two different drafts are two places', () => {
    expect(returnableTo({ kind: 'draft', id: 'd1' }, { kind: 'draft', id: 'd2' })).toEqual({
      kind: 'draft',
      id: 'd1'
    })
  })
})

describe('an entity has an address, and only when a screen can reach it', () => {
  // The shell could say which PROJECT it was at and nothing narrower, so a
  // question or a decision could not be linked to, compared or restored.
  // `Focus` carried the entity as a one-shot request the receiving screen had
  // to clear — and a request is not a location.
  it('addresses a task inside its project', () => {
    const got = routeToEntity({ ref: { kind: 'task', id: 't-1' }, projectId: 'p1' })
    expect(got.addressed).toBe(true)
    if (!got.addressed) throw new Error('unreachable')
    expect(got.route).toEqual({ kind: 'project', projectId: 'p1', at: { kind: 'task', id: 't-1' } })
    expect(entityAt(got.route)).toEqual({ kind: 'task', id: 't-1' })
  })

  it('and carries a revision, because two readings of one entity are two places', () => {
    const got = routeToEntity({ ref: { kind: 'task', id: 't-1' }, projectId: 'p1', asOf: '512' })
    if (!got.addressed) throw new Error('expected an address')
    expect(asOfAt(got.route)).toBe('512')
    // Same entity, different revision: NOT the same place. A screen that cannot
    // tell them apart invites a past reading to be acted on as the present one.
    const now = routeToEntity({ ref: { kind: 'task', id: 't-1' }, projectId: 'p1' })
    if (!now.addressed) throw new Error('expected an address')
    expect(sameRoute(got.route, now.route)).toBe(false)
  })

  it('REFUSES an address no screen can reach, and says where to go instead', () => {
    // `destinationOf` has four answers and only one is an address. Assembling
    // the route by hand would put a location on screen that no screen can
    // reach — the confident-answer defect wearing a route.
    const fact = routeToEntity({ ref: { kind: 'fact', id: 'f-1' }, projectId: 'p1' })
    expect(fact.addressed, 'a fact is not focusable by any surface that exists').toBe(false)
    if (fact.addressed) throw new Error('unreachable')
    expect(fact.fallback).toEqual({ kind: 'project', projectId: 'p1' })
    expect(fact.why, 'a refusal with no reason is a wall').toBeTruthy()
  })

  it('and refuses one with no project at all', () => {
    const orphan = routeToEntity({ ref: { kind: 'refusal', id: '77' }, projectId: null })
    expect(orphan.addressed).toBe(false)
    if (orphan.addressed) throw new Error('unreachable')
    expect(orphan.fallback).toEqual({ kind: 'home' })
  })

  it('and a project route with no entity is still a real place', () => {
    expect(entityAt({ kind: 'project', projectId: 'p1' })).toBeNull()
    expect(entityAt({ kind: 'home' })).toBeNull()
    expect(asOfAt({ kind: 'agents' })).toBeNull()
  })

  it('and the same project at the same entity is the same place', () => {
    const a = { kind: 'project' as const, projectId: 'p1', at: { kind: 'task' as const, id: 't' } }
    const b = { kind: 'project' as const, projectId: 'p1', at: { kind: 'task' as const, id: 't' } }
    expect(sameRoute(a, b)).toBe(true)
    expect(sameRoute(a, { kind: 'project', projectId: 'p1' })).toBe(false)
  })
})

describe('the Board is a place, scoped or not (SCR-41)', () => {
  it('two boards of different projects are different places, and a different row is another address', () => {
    expect(sameRoute({ kind: 'board', projectId: 'p1' }, { kind: 'board', projectId: 'p1' })).toBe(true)
    expect(sameRoute({ kind: 'board', projectId: 'p1' }, { kind: 'board', projectId: 'p2' })).toBe(false)
    expect(sameRoute({ kind: 'board' }, { kind: 'board', projectId: 'p1' })).toBe(false)
    expect(sameRoute({ kind: 'board', projectId: 'p1', item: 'a' }, { kind: 'board', projectId: 'p1', item: 'b' })).toBe(false)
  })

  it('Back from one project\'s board to the estate board goes somewhere; to the same board, nowhere', () => {
    expect(returnableTo({ kind: 'board' }, { kind: 'board', projectId: 'p1' })).toEqual({ kind: 'board' })
    expect(returnableTo({ kind: 'board', projectId: 'p1' }, { kind: 'board', projectId: 'p1', item: 'x' })).toBeNull()
  })
})

describe('Releases are a place, and one release is an address (ADR-0084)', () => {
  it('a different release is another address; the same one reached again is the same place', () => {
    expect(sameRoute({ kind: 'releases', projectId: 'p1', release: 'r1' }, { kind: 'releases', projectId: 'p1', release: 'r1' })).toBe(true)
    expect(sameRoute({ kind: 'releases', projectId: 'p1', release: 'r1' }, { kind: 'releases', projectId: 'p1', release: 'r2' })).toBe(false)
    expect(sameRoute({ kind: 'releases' }, { kind: 'releases', projectId: 'p1' })).toBe(false)
  })

  it('Back from one project\'s releases to every project\'s goes somewhere; to the same project, nowhere', () => {
    expect(returnableTo({ kind: 'releases' }, { kind: 'releases', projectId: 'p1' })).toEqual({ kind: 'releases' })
    expect(returnableTo({ kind: 'releases', projectId: 'p1' }, { kind: 'releases', projectId: 'p1', release: 'r1' })).toBeNull()
    expect(returnableTo({ kind: 'pulse' }, { kind: 'releases' })).toEqual({ kind: 'pulse' })
  })
})

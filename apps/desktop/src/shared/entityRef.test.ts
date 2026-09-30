import { describe, expect, it } from 'vitest'
import {
  ENTITY_KINDS,
  destinationOf,
  formatRef,
  parseRef,
  taskOf,
  type EntityKind,
  type EntityRef
} from './entityRef.ts'

describe('one name for one thing', () => {
  it('round-trips every kind it knows', () => {
    for (const kind of ENTITY_KINDS) {
      const ref: EntityRef = { kind, id: 'x-1' }
      expect(parseRef(formatRef(ref))).toEqual(ref)
    }
  })

  it('keeps an id that contains a colon whole', () => {
    // A `work_id` may carry one. An id that loses its tail addresses a
    // different thing — or nothing — while still looking like a valid ref.
    expect(parseRef('work:repo:branch:7')).toEqual({ kind: 'work', id: 'repo:branch:7' })
  })

  it('refuses rather than guessing', () => {
    expect(parseRef('nonsense:1')).toBeNull()
    expect(parseRef('task:')).toBeNull()
    expect(parseRef(':1')).toBeNull()
    expect(parseRef('task')).toBeNull()
    expect(parseRef('')).toBeNull()
  })

  it('never double-prefixes, whatever it is handed', () => {
    // The defect this file exists for: `${kind}:${alreadyPrefixedId}`.
    const ref = parseRef('review:review:t1')
    expect(ref).toBeNull()
  })
})

describe('where a ref opens, and the three answers that are not a click', () => {
  it('lands on the task itself', () => {
    const d = destinationOf({ ref: { kind: 'task', id: 't1' }, projectId: 'p1' })
    expect(d).toEqual({ at: 'exact', projectId: 'p1', focus: { kind: 'task', id: 't1' } })
  })

  it('keeps the operator on the row where the act lives', () => {
    // Answering, granting and deciding all happen on the row. Navigating away
    // to "the project" would take the button with it.
    expect(destinationOf({ ref: { kind: 'question', id: 'q1' }, projectId: null })).toMatchObject({
      at: 'here',
      act: 'answer'
    })
    expect(destinationOf({ ref: { kind: 'refusal', id: '7' }, projectId: null })).toMatchObject({
      at: 'here',
      act: 'grant'
    })
    expect(destinationOf({ ref: { kind: 'proposal', id: 'p' }, projectId: 'p1' })).toMatchObject({
      at: 'here',
      act: 'decide'
    })
  })

  it('says WHY it is only opening the project', () => {
    const d = destinationOf({ ref: { kind: 'fact', id: 'f1' }, projectId: 'p1' })
    expect(d.at).toBe('project')
    if (d.at === 'project') {
      expect(d.projectId).toBe('p1')
      expect(d.why).toMatch(/fact/i)
      // The entity is still named, so the row can say what it did NOT open.
      expect(d.ref.id).toBe('f1')
    }
  })

  it('refuses to open a task page for work that is not a task', () => {
    // `AttentionPanel.taskIdOf` treated a lease's `work_id` as a task id, so an
    // expired lease over anything else navigated to a task that does not exist.
    const d = destinationOf({ ref: { kind: 'work', id: 'w1' }, projectId: 'p1' })
    expect(d.at).toBe('project')
    expect(taskOf({ kind: 'work', id: 'w1' })).toBeNull()
  })

  it('has an answer with no project at all', () => {
    const d = destinationOf({ ref: { kind: 'task', id: 't1' }, projectId: null })
    expect(d.at).toBe('unaddressable')
    if (d.at === 'unaddressable') expect(d.why).toBeTruthy()
  })

  it('never returns a destination with no reason attached', () => {
    for (const kind of ENTITY_KINDS)
      for (const projectId of ['p1', null]) {
        const d = destinationOf({ ref: { kind, id: 'x' }, projectId })
        if (d.at === 'project' || d.at === 'unaddressable') expect(d.why.length).toBeGreaterThan(0)
      }
  })
})

// ── WHOSE REF IS IT? (UX28-06) ─────────────────────────────────────────────
//
// `destinationOf` takes `projectId` — "the project the ROW claims" — and had no
// way to be told whose the REF is. Two callers pass the item's own project and
// are right. `RetroSection` passes THE PAGE'S project beside a ref that came
// out of `item.evidence`, which is a fact recorded anywhere: a retro item whose
// evidence names a task in another project resolved to `at: 'exact'` with THIS
// page's project and THAT project's task id, and the caller opened it.
//
// The card's negative acceptance says a cross-project target must say
// unavailable without routing to another entity. The fix is in the contract
// rather than at the call site: a resolver that cannot be told the owner cannot
// refuse a mismatch, and every caller has to remember instead.

describe('a ref belongs to a project, and the resolver is told which', () => {
  it('refuses a ref owned by another project rather than opening it here', () => {
    const d = destinationOf({
      ref: { kind: 'task', id: 't-from-elsewhere' },
      projectId: 'p1',
      owner: 'p2'
    })
    expect(d.at).toBe('unaddressable')
    expect(d.at === 'unaddressable' && d.why).toMatch(/another project/i)
  })

  it('and never rewrites the destination to the owning project either', () => {
    // "Without routing to another entity" cuts both ways: silently opening p2
    // would be a jump the operator did not ask for, out of the project they
    // are looking at.
    const d = destinationOf({
      ref: { kind: 'task', id: 't-from-elsewhere' },
      projectId: 'p1',
      owner: 'p2'
    })
    expect(JSON.stringify(d)).not.toContain('p2')
  })

  it('opens exactly when the owner agrees', () => {
    const d = destinationOf({ ref: { kind: 'task', id: 't1' }, projectId: 'p1', owner: 'p1' })
    expect(d).toMatchObject({ at: 'exact', projectId: 'p1' })
  })

  it('and an owner nobody knows is not the same as an owner that matches', () => {
    // The honest case, and the common one: a row that knows its project and not
    // the ref's. It resolves as before — this contract adds a check, it does
    // not invent knowledge.
    const d = destinationOf({ ref: { kind: 'task', id: 't1' }, projectId: 'p1', owner: null })
    expect(d).toMatchObject({ at: 'exact', projectId: 'p1' })
  })

  it('refuses a mismatch for every kind that lands somewhere, not only tasks', () => {
    // A fact and a transcript resolve to `at: 'project'`, which is still a
    // place — and still the wrong project.
    for (const kind of ['fact', 'transcript', 'work']) {
      const d = destinationOf({
        ref: { kind: kind as EntityKind, id: 'x' },
        projectId: 'p1',
        owner: 'p2'
      })
      expect(d.at, `${kind} routed into the wrong project`).toBe('unaddressable')
    }
  })

  it('but a ref that resolves HERE is not about a project at all', () => {
    // Answering a question happens on the row the operator is looking at. There
    // is no navigation to get wrong, so an owner mismatch cannot arise — and
    // refusing it would take away the button.
    const d = destinationOf({ ref: { kind: 'question', id: 'q1' }, projectId: 'p1', owner: 'p2' })
    expect(d).toMatchObject({ at: 'here', act: 'answer' })
  })
})

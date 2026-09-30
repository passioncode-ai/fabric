import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { advanceCursor, dedupeNeedsYou, emptiness, unreadCount, type NeedsYouItem, cursorFor, type HappenedItem } from './inbox.ts'

const happened = (seq: number): HappenedItem => ({
  id: `e:${seq}`,
  seq,
  kind: 'task.moved@1',
  title: 'a task moved',
  occurredAt: '2026-09-09T00:00:00Z',
  projectId: 'p1',
  subjectRef: 'task:t1',
  severity: 'info'
})

describe('an obligation cannot be marked read', () => {
  it('has no readState field at all', () => {
    // The absence is the mechanism, not a convention: a surface cannot render a
    // checkbox beside an obligation, and no command can be written to clear
    // one. `attention.ts` already says why — a queue you can mark as read is a
    // queue that lies.
    const item: NeedsYouItem = {
      ref: 'question:q1',
      projectId: 'p1',
      title: 'which database?',
      sourceRef: 'question:q1',
      priority: 10
    }
    expect(Object.keys(item)).not.toContain('readState')
    expect(Object.keys(item)).not.toContain('read')
    expect(Object.keys(item)).not.toContain('dismissed')
  })

  it('counts unread over the HAPPENED lane only', () => {
    // An obligation is not unread. It is unmet, and counting it as unread
    // invites clearing it by looking.
    expect(unreadCount([happened(1), happened(2), happened(3)], { throughSeq: 1 })).toBe(2)
  })

  it('keeps one row per obligation', () => {
    const dup: NeedsYouItem = { ref: 'r', projectId: null, title: 't', sourceRef: 's', priority: 1 }
    expect(dedupeNeedsYou([dup, { ...dup }, { ...dup, ref: 'other' }])).toHaveLength(2)
  })
})

describe('the cursor never moves by itself', () => {
  it('moves when a person says what they saw', () => {
    const got = advanceCursor({ cursor: { throughSeq: 5 }, visibleThroughSeq: 9, expectedThroughSeq: 5 })
    expect(got.moved).toBe(true)
    expect(got.cursor.throughSeq).toBe(9)
  })

  it('refuses a move answering a screen that has changed', () => {
    // Another window moved the cursor while this one was open. Applying it
    // would mark read whatever arrived in between, which nobody looked at.
    const got = advanceCursor({ cursor: { throughSeq: 7 }, visibleThroughSeq: 9, expectedThroughSeq: 5 })
    expect(got.moved).toBe(false)
    if (!got.moved) expect(got.reason).toMatch(/moved somewhere else/)
    expect(got.cursor.throughSeq).toBe(7)
  })

  it('refuses to go backwards', () => {
    const got = advanceCursor({ cursor: { throughSeq: 9 }, visibleThroughSeq: 4, expectedThroughSeq: 9 })
    expect(got.moved).toBe(false)
    expect(got.cursor.throughSeq).toBe(9)
  })

  it('moves only as far as what was VISIBLE, never to the newest', () => {
    // The whole reason the command carries the seen seq: a cursor jumped to the
    // head marks read everything that arrived while the person was reading.
    const got = advanceCursor({ cursor: { throughSeq: 0 }, visibleThroughSeq: 3, expectedThroughSeq: 0 })
    expect(got.cursor.throughSeq).toBe(3)
    expect(unreadCount([happened(1), happened(2), happened(3), happened(4)], got.cursor)).toBe(1)
  })
})

describe('empty is three different answers', () => {
  it('separates verified empty from an unwired producer', () => {
    // "All clear" and "nothing is watching" look identical on a screen and mean
    // opposite things.
    expect(emptiness({ itemCount: 0, producersWired: true, allSourcesRead: true }).state).toBe('verified_empty')
    const un = emptiness({ itemCount: 0, producersWired: false, allSourcesRead: true })
    expect(un.state).toBe('uninstrumented')
    expect(un.says).toMatch(/not the same as nothing having happened/)
  })

  it('reports an unreadable source before anything else', () => {
    expect(emptiness({ itemCount: 0, producersWired: false, allSourcesRead: false }).state).toBe(
      'source_unavailable'
    )
  })

  it('says nothing special when there are items', () => {
    expect(emptiness({ itemCount: 2, producersWired: true, allSourcesRead: true }).state).toBe('has_items')
  })
})

describe('a cursor from another generation does not hide the estate', () => {
  // MEASURED at `08882bd`. `throughSeq` is a position in ONE journal, and a
  // restore mints a new generation whose sequence starts again. A cursor saved
  // at 9000 against an estate whose highest seq is now 12 marks everything read
  // — so an operator who has never looked at this estate is shown an empty feed
  // and told they are up to date. `unreadCount` returns 0 and is not lying; the
  // cursor is.
  //
  // This is the packet's own negative acceptance — "restored generation rejects
  // obsolete cursor" — and it is the half that loses VISIBILITY rather than
  // data, which is why it is taken first.
  it('refuses a cursor that points past everything the estate holds', () => {
    const got = cursorFor({ saved: { throughSeq: 9000 }, highestSeq: 12 })
    expect(got.usable).toBe(false)
    if (got.usable) throw new Error('unreachable')
    expect(got.cursor.throughSeq, 'and it starts from nothing read, never from everything read').toBe(0)
    expect(got.says).toMatch(/generation|restor/i)
  })

  it('and the whole feed is unread again, rather than silently empty', () => {
    // The file's own builder, so the fixture cannot express a shape the
    // product does not produce.
    const items = [1, 2, 3].map(happened)
    const stale = cursorFor({ saved: { throughSeq: 9000 }, highestSeq: 3 })
    expect(unreadCount(items, stale.cursor)).toBe(3)
  })

  it('but a cursor inside the estate is used as it stands', () => {
    // The other direction, and it is what keeps the first meaningful: if every
    // cursor were reset, marking things read would never survive a restart.
    const got = cursorFor({ saved: { throughSeq: 2 }, highestSeq: 12 })
    expect(got.usable).toBe(true)
    expect(got.cursor.throughSeq).toBe(2)
  })

  it('and a cursor exactly at the head is fine', () => {
    // The boundary: having read everything is a normal state, not an impossible
    // one, and an off-by-one here would reset the cursor of the most attentive
    // operator on every launch.
    const got = cursorFor({ saved: { throughSeq: 12 }, highestSeq: 12 })
    expect(got.usable).toBe(true)
    expect(got.cursor.throughSeq).toBe(12)
  })

  it('and an estate with no events at all keeps a zero cursor rather than resetting', () => {
    // `highestSeq: 0` means nothing has happened yet — not that the cursor is
    // from another generation. Treating an empty estate as a restore would
    // print the reset sentence on a first launch.
    const got = cursorFor({ saved: { throughSeq: 0 }, highestSeq: 0 })
    expect(got.usable).toBe(true)
  })
})

describe('reading the history never dismisses an obligation', () => {
  // AX-16's negative acceptance, checked against work this cycle shipped TWO
  // iterations ago rather than assumed: `readThroughSeq` marks the happened
  // lane read, and the notifier's `told` set suppresses a repeat telling. If
  // either reached the needs-you lane, an obligation would leave the operator's
  // queue because they glanced at the journal — which is the difference between
  // unread and unmet.
  it('the unread count is about happened items and nothing else', () => {
    const items = [1, 2, 3].map(happened)
    // Everything read.
    expect(unreadCount(items, { throughSeq: 3 })).toBe(0)
    // And the needs-you lane has no cursor at all: `unreadCount` takes
    // HappenedItem, so an obligation cannot be passed to it even by mistake.
    expect(unreadCount([], { throughSeq: 9999 })).toBe(0)
  })

  it('and an obligation is deduped by its ref, never by whether it was read', () => {
    // `dedupeNeedsYou` keys on `ref`, which is what the obligation IS. Nothing
    // in it consults a cursor, a told-set or a timestamp — so no act of reading
    // can remove a row from this lane.
    const one: NeedsYouItem = {
      ref: 'question:q1',
      title: 'answer me',
      projectId: null,
      sourceRef: 'task:t1',
      priority: 3
    }
    const same = { ...one, title: 'answer me (again)' }
    expect(dedupeNeedsYou([one, same]).length).toBe(1)
    expect(dedupeNeedsYou([one, same])[0].ref).toBe('question:q1')
    expect(Object.keys(one).sort()).toEqual(['priority', 'projectId', 'ref', 'sourceRef', 'title'])
  })

  it('and the TYPE has nowhere to mark one read, which is the mechanism', () => {
    // ASSERTED ON THE DECLARATION, not on an instance. The first version of
    // this checked `Object.keys` of a fixture — and a plant that added an
    // OPTIONAL `readAt?: string` to the interface left it green, because an
    // optional field is absent from a value that does not set it. The claim is
    // about the shape, so the shape is what must be read.
    // `import.meta.url` is not a file URL under vitest's transform, so the path
    // is resolved from the test file's own directory instead.
    const source = readFileSync(path.join(__dirname, 'inbox.ts'), 'utf8')
    const body = source.slice(
      source.indexOf('export interface NeedsYouItem'),
      source.indexOf('export interface HappenedItem')
    )
    const declared = [...body.matchAll(/^\s*(\w+)\??:/gm)].map((m) => m[1])
    expect(declared.sort()).toEqual(['priority', 'projectId', 'ref', 'sourceRef', 'title'])
    expect(
      /read|seen|dismiss|mute|acknowledg/i.test(declared.join(' ')),
      'an obligation with somewhere to be marked read is an obligation a glance can clear'
    ).toBe(false)
  })
})

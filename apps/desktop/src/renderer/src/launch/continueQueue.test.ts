// The 0.3.26 review, iteration 3 (ER-18, ER-23, ER-26): the continue asks App shows, one at a time.
import { describe, expect, it } from 'vitest'
import { continueQueue, NO_CONTINUE, type ContinueQueue, type ContinueQueueAction } from './continueQueue'

const A = { session: 'a', from: 'fabric-dashboards' }
const B = { session: 'b' }
const run = (...actions: ContinueQueueAction[]): ContinueQueue => actions.reduce(continueQueue, NO_CONTINUE)

describe('continueQueue', () => {
  it('a link shows its ask; a link for the same session keeps it', () => {
    expect(run({ type: 'link', next: A }).ask).toBe(A)
    const s = run({ type: 'link', next: A }, { type: 'link', next: { session: 'a' } })
    expect(s.ask).toBe(A)
  })
  it('ER-26: a link that arrived during a press is shown after the press succeeds', () => {
    const s = run({ type: 'link', next: A }, { type: 'busy', session: 'a' }, { type: 'link', next: B })
    expect(s.ask).toBe(A)
    expect(s.queued).toBe(B)
    expect(run({ type: 'link', next: A }, { type: 'busy', session: 'a' }, { type: 'link', next: B }, { type: 'busy', session: null }, { type: 'done' }).ask).toBe(B)
  })
  it('after a refusal the queued link waits for the person to close the ask, then shows', () => {
    const refused = run({ type: 'link', next: A }, { type: 'busy', session: 'a' }, { type: 'link', next: B }, { type: 'busy', session: null })
    expect(refused.ask).toBe(A)
    expect(refused.queued).toBe(B)
    expect(continueQueue(refused, { type: 'done' }).ask).toBe(B)
  })
  it('ER-23: a link that replaces an idle ask drops what waited, so nothing stale shows later', () => {
    const s = run({ type: 'link', next: A }, { type: 'busy', session: 'a' }, { type: 'link', next: B }, { type: 'busy', session: null },
      { type: 'link', next: null })
    expect(s).toEqual(NO_CONTINUE)
    expect(continueQueue(continueQueue(s, { type: 'link', next: { session: 'd' } }), { type: 'done' }).ask).toBeNull()
  })
  it('a press in flight is never replaced, by another continue or by any other link', () => {
    const busy = run({ type: 'link', next: A }, { type: 'busy', session: 'a' })
    expect(continueQueue(busy, { type: 'link', next: null }).ask).toBe(A)
    expect(continueQueue(busy, { type: 'link', next: { session: 'a' } })).toBe(busy)
  })
  it('the newest of several waiting links wins', () => {
    expect(run({ type: 'link', next: A }, { type: 'busy', session: 'a' }, { type: 'link', next: B }, { type: 'link', next: { session: 'c' } }).queued).toEqual({ session: 'c' })
  })
  it('a busy report of an ask no longer shown changes nothing', () => {
    expect(continueQueue(NO_CONTINUE, { type: 'busy', session: 'x' })).toBe(NO_CONTINUE)
  })
})

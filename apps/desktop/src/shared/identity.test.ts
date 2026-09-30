import { describe, expect, it } from 'vitest'
import { actorOf, authorityMoved, subjectOf, type Subject } from './identity.ts'

const answer = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  ok: true,
  person_id: '00000000-0000-0000-0000-00000000000a',
  display_name: 'operator',
  auth_user: null,
  role: 'owner',
  revision: 3,
  ...over
})
const subject = (over: Partial<Subject> = {}): Subject => ({
  personId: 'p1',
  displayName: 'operator',
  source: 'single-operator',
  authUser: null,
  role: 'owner',
  revision: 3,
  ...over
})

describe('a subject is established, and uncertainty is not one (FA-07)', () => {
  it('reads a whole answer', () => {
    const got = subjectOf(answer(), null, 'single-operator')
    expect(got.ok).toBe(true)
    if (got.ok) expect(got.subject.revision).toBe(3)
  })

  it('REFUSES when the call itself failed, rather than acting unidentified', () => {
    const got = subjectOf(null, { message: 'unreachable' }, 'single-operator')
    expect(got.ok).toBe(false)
    if (!got.ok) expect(got.why).toBe('unavailable')
  })

  it('REFUSES a null answer rather than reading it as a yes', () => {
    expect(subjectOf(null, null, 'single-operator').ok).toBe(false)
    expect(subjectOf({ person_id: 'x' }, null, 'single-operator').ok).toBe(false)
  })

  it('REFUSES an answer missing what an actor is made of', () => {
    for (const missing of ['person_id', 'role', 'revision']) {
      const partial = answer()
      delete partial[missing]
      expect(subjectOf(partial, null, 'single-operator').ok).toBe(false)
    }
  })

  it('passes a refusal through with its code', () => {
    const got = subjectOf({ ok: false, reason_code: 'not_a_member', says: 'no' }, null, 'single-operator')
    expect(got.ok).toBe(false)
    if (!got.ok) expect(got.why).toBe('not_a_member')
  })

  it('keeps the single operator writing history under the handle it always used', () => {
    // Events already written say `person:operator`. Changing it now would make
    // the record read as though two different people had been working.
    expect(actorOf(subject())).toEqual({ kind: 'person', id: 'operator' })
  })

  it('names an authenticated person by their person id, not by a shared handle', () => {
    expect(actorOf(subject({ source: 'authenticated', personId: 'p9' }))).toEqual({
      kind: 'person',
      id: 'p9'
    })
  })

  it('says authority MOVED when the revision changed, when the role changed, and when it is gone', () => {
    const held = subject()
    expect(authorityMoved(held, subject())).toBe(false)
    expect(authorityMoved(held, subject({ revision: 4 }))).toBe(true)
    expect(authorityMoved(held, subject({ role: 'member' }))).toBe(true)
    // Revoked between the read and the write: the most important case, and the
    // one a boolean comparison of revisions alone would miss.
    expect(authorityMoved(held, null)).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import {
  AUTHORITY_ACTS,
  ROLES,
  VISIBILITY,
  describeVisibility,
  mayPerform,
  mayRevoke,
  visibleEstates,
  type ActorContext
} from './membership.ts'

const now = new Date('2026-09-09T12:00:00Z')
const later = new Date('2026-09-09T13:00:00Z').toISOString()
const earlier = new Date('2026-09-09T11:00:00Z').toISOString()

const actor = (over: Partial<ActorContext> = {}): ActorContext => ({
  personId: 'p1',
  estateId: 'e1',
  role: 'owner',
  membershipRevision: 4,
  sessionExpiry: later,
  ...over
})

describe('nobody is permitted before somebody is identified', () => {
  it('refuses a call with no verified identity, and says that is what happened', () => {
    // "No context" and "not permitted" are different answers, and only the
    // second is about the person.
    const d = mayPerform({ actor: null, act: 'grant_membership', estateId: 'e1', now })
    expect(d.ok).toBe(false)
    if (!d.ok) {
      expect(d.because).toBe('no_context')
      expect(d.says).toMatch(/nobody to permit/i)
    }
  })

  it('refuses an expired session before looking at the role', () => {
    // An owner whose session ran out is not an owner right now, and the reason
    // must not read as a permission problem.
    const d = mayPerform({
      actor: actor({ role: 'owner', sessionExpiry: earlier }),
      act: 'grant_membership',
      estateId: 'e1',
      now
    })
    expect(d.ok).toBe(false)
    if (!d.ok) {
      expect(d.because).toBe('session_expired')
      expect(d.says).toMatch(/says nothing about what you may do/i)
    }
  })
})

describe('what an owner may do and a member may not', () => {
  it('lets an owner perform every authority act', () => {
    for (const act of AUTHORITY_ACTS)
      expect(mayPerform({ actor: actor(), act, estateId: 'e1', now }).ok).toBe(true)
  })

  it('refuses a member every one of them, with the act named', () => {
    for (const act of AUTHORITY_ACTS) {
      const d = mayPerform({ actor: actor({ role: 'member' }), act, estateId: 'e1', now })
      expect(d.ok).toBe(false)
      if (!d.ok) {
        expect(d.because).toBe('not_owner')
        expect(d.says).toMatch(/does not grant themselves authority/i)
      }
    }
  })

  it('knows exactly the roles and acts the estate has', () => {
    expect(ROLES).toEqual(['owner', 'member'])
    expect(AUTHORITY_ACTS).toEqual([
      'grant_membership',
      'revoke_membership',
      'bind_agent',
      'issue_grant',
      'change_policy'
    ])
  })
})

describe('a foreign estate discloses nothing', () => {
  it('answers the same for an estate that is not yours and one that is not there', () => {
    const foreign = mayPerform({ actor: actor(), act: 'issue_grant', estateId: 'e2', now })
    const absent = mayPerform({ actor: actor(), act: 'issue_grant', estateId: 'nonexistent', now })
    expect(foreign.ok).toBe(false)
    expect(absent.ok).toBe(false)
    if (!foreign.ok && !absent.ok) {
      expect(foreign.because).toBe(absent.because)
      // The same sentence, so the wording cannot be read as a signal either.
      expect(foreign.says).toBe(absent.says)
      expect(foreign.says).toMatch(/no such estate/i)
    }
  })
})

describe('a decision read is a decision that can go stale', () => {
  it('refuses when the membership moved under the decision', () => {
    const d = mayPerform({
      actor: actor({ membershipRevision: 4 }),
      act: 'revoke_membership',
      estateId: 'e1',
      currentRevision: 5,
      now
    })
    expect(d.ok).toBe(false)
    if (!d.ok) expect(d.because).toBe('revision_moved')
  })

  it('does not demand a revision from a caller that is not making one', () => {
    for (const currentRevision of [null, undefined])
      expect(
        mayPerform({ actor: actor(), act: 'issue_grant', estateId: 'e1', currentRevision, now }).ok
      ).toBe(true)
  })

  it('accepts a matching revision', () => {
    expect(
      mayPerform({ actor: actor(), act: 'issue_grant', estateId: 'e1', currentRevision: 4, now }).ok
    ).toBe(true)
  })
})

describe('the last owner, said before the database has to say it', () => {
  it('refuses revoking the last owner and names the cost', () => {
    const d = mayRevoke({ targetRole: 'owner', owners: 1 })
    expect(d.ok).toBe(false)
    if (!d.ok) {
      expect(d.says).toMatch(/intact and unreachable/i)
      expect(d.says).toMatch(/add the new owner first/i)
    }
  })

  it('allows it once there is another owner', () => {
    expect(mayRevoke({ targetRole: 'owner', owners: 2 }).ok).toBe(true)
  })

  it('never blocks revoking a member, however few owners there are', () => {
    expect(mayRevoke({ targetRole: 'member', owners: 1 }).ok).toBe(true)
  })
})

describe('what a membership actually lets somebody see, said out loud', () => {
  it('is estate-wide in this version, and the type says so', () => {
    expect(VISIBILITY).toBe('estate_wide')
    expect(visibleEstates(actor())).toEqual(['e1'])
    expect(visibleEstates(null)).toEqual([])
  })

  it('tells an owner inviting somebody what that person will see', () => {
    // An operator inviting a colleague is deciding what they will see, and the
    // honest sentence is the difference between an informed invitation and a
    // surprise. Per-project access is NOT faked by filtering in the renderer.
    const said = describeVisibility('member')
    expect(said).toMatch(/every project in this estate/i)
    expect(said).toMatch(/not something this version can do/i)
    expect(describeVisibility('owner')).toMatch(/change who else has access/i)
  })
})

describe('an actor context is built, never received', () => {
  it('exports no way to make one from a payload', async () => {
    const mod = await import('./membership.ts')
    for (const name of Object.keys(mod))
      expect(name.toLowerCase()).not.toMatch(/frompayload|fromrequest|parseactor|trustactor/)
  })
})

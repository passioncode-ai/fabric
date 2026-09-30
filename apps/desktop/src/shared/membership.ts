// Who this person is, and what that lets them do (S09).
//
// MEASURED AT HEAD, and it decides what this file may honestly claim:
//
//   `OPERATOR_ACTOR` is the literal `{ kind: 'person', id: 'operator' }` — a
//   string, not a person id, referencing nothing. `ORG1` is a hardcoded estate
//   uuid. The application connects with the SERVICE ROLE key, which bypasses
//   row-level security entirely, so every policy in the schema that keys off
//   `auth.uid()` has never been exercised by this product. There is one person
//   and one estate, and the card's own sentence — the vision is a team one and
//   there is no proof of two live users — is exact.
//
// SO THIS IS NOT AN AUTHENTICATION LAYER AND DOES NOT PRETEND TO BE. It is the
// decision table that an authenticated context will consult, plus the type that
// makes it impossible to consult it with something a renderer sent. The floor
// underneath — the last owner, the revision, the idempotent command — is in the
// database, where it holds against the writer this product actually is
// (ADR-0049).
//
// AN ACTOR CONTEXT IS BUILT, NEVER RECEIVED. The field that matters is not on
// the type by accident: there is no `fromPayload` here and no constructor that
// takes one. A context arrives from a verifier that checked a session, or the
// call has no context and is refused — and `check-actor.mjs` refuses a handler
// that reads a person id off the wire, because the version that trusts the
// renderer is shorter and works in every test.

export const ROLES = ['owner', 'member'] as const
export type Role = (typeof ROLES)[number]

/**
 * Who is acting, as established by something that checked.
 *
 * `membershipRevision` travels with it because authority is READ, a decision is
 * made on it, and the write happens later. Between the two a revoke can land,
 * and the revision is what makes that visible instead of silent.
 */
export interface ActorContext {
  personId: string
  estateId: string
  role: Role
  membershipRevision: number
  /** When the session behind this stops being evidence. A context with no
   *  expiry is a credential, and this is not one. */
  sessionExpiry: string
}

/** Everything a person can be refused. Named, because a support conversation
 *  quotes the code and the operator reads the sentence. */
export type Refusal =
  | 'no_context'
  | 'session_expired'
  | 'not_owner'
  | 'estate_mismatch'
  | 'revision_moved'

export type Decision = { ok: true } | { ok: false; because: Refusal; says: string }

/**
 * The acts that change who may do what. Owner-only, and the list is closed:
 * a capability added by forgetting to check is the failure this shape exists
 * to prevent.
 */
export const AUTHORITY_ACTS = [
  'grant_membership',
  'revoke_membership',
  'bind_agent',
  'issue_grant',
  'change_policy'
] as const
export type AuthorityAct = (typeof AUTHORITY_ACTS)[number]

/**
 * May this actor perform this act, on this estate, against this reading?
 *
 * The order is the design. A missing context is refused before anything else,
 * because "no context" and "not permitted" are different answers and only the
 * second is about the person. Expiry comes next: a context that has run out is
 * not evidence of anything, whatever role it names.
 */
export function mayPerform(input: {
  actor: ActorContext | null
  act: AuthorityAct
  estateId: string
  /** What the membership was when this decision was read, when the caller
   *  brought one. Null means the caller is not making a compare-and-set. */
  currentRevision?: number | null
  now: Date
}): Decision {
  const { actor } = input
  if (!actor)
    return {
      ok: false,
      because: 'no_context',
      says: 'this call arrived with no verified identity, so there is nobody to permit'
    }
  if (new Date(actor.sessionExpiry) <= input.now)
    return {
      ok: false,
      because: 'session_expired',
      says: 'the session behind this expired; sign in again — this says nothing about what you may do'
    }
  if (actor.estateId !== input.estateId)
    // UNIFORM with an estate that does not exist. A caller learns nothing about
    // whether the other estate is real.
    return {
      ok: false,
      because: 'estate_mismatch',
      says: 'there is no such estate for this identity'
    }
  if (
    input.currentRevision !== null &&
    input.currentRevision !== undefined &&
    input.currentRevision !== actor.membershipRevision
  )
    return {
      ok: false,
      because: 'revision_moved',
      says: 'your membership changed while this was being decided; read it again'
    }
  if (actor.role !== 'owner')
    return {
      ok: false,
      because: 'not_owner',
      says: `${input.act.replace(/_/g, ' ')} is the owner's, and a member does not grant themselves authority`
    }
  return { ok: true }
}

/**
 * What a member CAN see.
 *
 * In v1 a membership is estate-wide, and that is stated rather than softened. A
 * project-only membership is a separate capability and it will not be faked by
 * filtering in the renderer: a filter is a display, the row is still sent, and
 * an operator told "you can only see this project" would be wrong about what
 * left the machine.
 */
export const VISIBILITY = 'estate_wide' as const

export function visibleEstates(actor: ActorContext | null): string[] {
  return actor ? [actor.estateId] : []
}

/**
 * What the interface must SAY about that.
 *
 * Not a footnote: an operator inviting a colleague is deciding what that person
 * will see, and the honest sentence is the difference between an informed
 * invitation and a surprise.
 */
export function describeVisibility(role: Role): string {
  return role === 'owner'
    ? 'An owner sees every project in this estate and can change who else has access.'
    : 'A member sees every project in this estate. Per-project access is not something this version can do — so invite somebody only if the whole estate is meant for them.'
}

/**
 * Is this transfer safe to attempt?
 *
 * The answer the caller needs BEFORE the database refuses it, so the interface
 * can say "add the new owner first" rather than surfacing a constraint. The
 * database is still the floor — this is the courtesy, not the rule.
 */
export function mayRevoke(input: {
  targetRole: Role
  /** How many owners the estate has, as read. */
  owners: number
}): Decision {
  if (input.targetRole === 'owner' && input.owners <= 1)
    return {
      ok: false,
      because: 'not_owner',
      says:
        'this is the last owner. Removing it would leave the estate intact and unreachable — nobody could grant a membership. Add the new owner first; a transfer is one transaction, not two.'
    }
  return { ok: true }
}

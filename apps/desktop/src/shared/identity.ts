// Who is acting, and the one place that may say so (FA-07 · S09).
//
// MEASURED at d28c321: the operator's identity had THREE definitions — the
// constant `OPERATOR_ACTOR` in `index.ts` and the same object written out twice
// more in `pty.ts` — and nothing forbade a fourth. `check-actor.mjs` already
// refuses an actor RECEIVED from a caller, which is the escalation that matters
// first; what it did not refuse was an actor INVENTED at a call site, which is
// how a fourth definition arrives and disagrees with the other three.
//
// A SUBJECT IS ESTABLISHED, NEVER RECEIVED, AND NEVER WRITTEN OUT BY HAND. The
// port in `main/identity.ts` is the only producer, it resolves against `persons`
// and `memberships` in the database, and every actor in this product comes from
// it.
//
// AND THE PROVIDER IS NOT CHOSEN HERE. Which identity provider this product uses
// is an activation decision the operator owns. What this file fixes is the
// SHAPE: a subject carries where it came from, so "there is one operator and
// nobody has logged in" is a recorded state rather than an appearance of
// authentication. The day a provider lands, `authenticated` joins the union and
// nothing else in the product changes.

/** Where a subject's authority came from. */
export type SubjectSource =
  /** No provider is configured. One person, on one machine, and it says so. */
  | 'single-operator'
  /** A provider verified them in the trusted process. */
  | 'authenticated'

export interface Subject {
  personId: string
  displayName: string
  source: SubjectSource
  /** The provider's own id for them. Null while none is configured. */
  authUser: string | null
  role: string
  /** What `memberships.revision` said when this was resolved. Authority that
   *  moved after this number was read is authority this subject does not hold. */
  revision: number
}

export type SubjectProblem =
  | 'no_such_person'
  /** Not a member — and the same answer a revoked member gets, deliberately. */
  | 'not_a_member'
  | 'unavailable'

export type SubjectRead =
  | { ok: true; subject: Subject }
  | { ok: false; why: SubjectProblem; says: string }

/**
 * The journal actor for a subject.
 *
 * `person:operator` for the single operator, and that is not laziness: events
 * already written say exactly that, and changing it now would make the history
 * read as though two different people had been working. The person row carries
 * the same handle as its display name, so both resolve to one identity without
 * a single past event being touched.
 */
export function actorOf(subject: Subject): { kind: 'person'; id: string } {
  return { kind: 'person', id: subject.source === 'single-operator' ? 'operator' : subject.personId }
}

/** Read what `resolve_subject` answered, refusing on uncertainty. */
export function subjectOf(
  data: unknown,
  error: { message: string } | null,
  source: SubjectSource
): SubjectRead {
  if (error) return { ok: false, why: 'unavailable', says: `identity could not be resolved: ${error.message}` }
  const r = data as Record<string, unknown> | null
  if (!r || typeof r.ok !== 'boolean')
    return { ok: false, why: 'unavailable', says: 'the identity command returned no verdict' }
  if (!r.ok)
    return {
      ok: false,
      why: (r.reason_code as SubjectProblem) ?? 'not_a_member',
      says: (r.says as string) ?? 'that person may not act in this estate'
    }
  if (typeof r.person_id !== 'string' || typeof r.role !== 'string' || typeof r.revision !== 'number')
    return { ok: false, why: 'unavailable', says: 'the identity answer is missing what an actor is made of' }
  return {
    ok: true,
    subject: {
      personId: r.person_id,
      displayName: (r.display_name as string) ?? 'operator',
      source,
      authUser: (r.auth_user as string | null) ?? null,
      role: r.role,
      revision: r.revision
    }
  }
}

/** Has authority moved since this subject was resolved? */
export function authorityMoved(held: Subject, current: Subject | null): boolean {
  if (!current) return true
  return current.revision !== held.revision || current.role !== held.role
}

// The only place a subject comes from (FA-07 · S09).
//
// MEASURED at d28c321: the operator's identity had three definitions — a
// constant in `index.ts` and the same object written out twice in `pty.ts` — and
// nothing forbade a fourth. `check-actor.mjs` refuses an actor RECEIVED from a
// caller, which is the escalation that matters first; an actor INVENTED at a
// call site is how the fourth definition arrives, and it looks like tidy code.
//
// THE GUARD IS AT THE WRITE, not at every handler. Retro-fitting a membership
// check into a hundred IPC handlers is a hundred places to forget one. Every
// person-actored event in this product goes through the journal, so the journal
// is where the check belongs: one seam, and a revoked membership stops the next
// write rather than the next restart.
//
// SYSTEM ACTORS PASS UNCHECKED, and that is the design. A routine tick and a
// chain advance act as `system` — they have no membership to revoke, and the
// authority they need is checked where it actually lives: admission, the quota
// door, the effects floor. Making them carry a person would invent an operator
// who was asleep.
//
// AND NO PROVIDER IS CHOSEN HERE. Which one this product uses is the operator's
// activation decision; `single-operator` is the recorded state until then,
// rather than an appearance of authentication.

import type { Journal } from '@fabric/journal'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  actorOf,
  authorityMoved,
  subjectOf,
  type Subject,
  type SubjectRead,
  type SubjectSource
} from '../shared/identity.ts'

/** The person the product runs as while no provider is configured. Matches the
 *  row migration 20260910000058 inserts; a literal here and a row there would be
 *  the fourth definition this module exists to prevent, so the gate checks it. */
export const LOCAL_OPERATOR_PERSON = '00000000-0000-0000-0000-00000000000a'

export interface Identity {
  /** Resolve at bootstrap. Nothing acts before this answers. */
  establish(): Promise<SubjectRead>
  /** The held subject's journal actor. Throws if nothing has been established —
   *  an unidentified write is not a write this product makes. */
  actor(): { kind: 'person'; id: string }
  held(): Subject | null
  /** Re-resolve. Refuses when the membership is gone or its authority moved. */
  guard(): Promise<SubjectRead>
  /** A journal that checks membership before every person-actored append. */
  guarded(journal: Journal): Journal
}

export function createIdentity(deps: {
  db: SupabaseClient
  estateId: string
  personId?: string
  source?: SubjectSource
}): Identity {
  const personId = deps.personId ?? LOCAL_OPERATOR_PERSON
  const source = deps.source ?? 'single-operator'
  let subject: Subject | null = null

  const resolve = async (): Promise<SubjectRead> => {
    const { data, error } = await deps.db.rpc('resolve_subject', {
      p_estate_id: deps.estateId,
      p_person_id: personId
    })
    return subjectOf(data, error, source)
  }

  return {
    async establish() {
      const read = await resolve()
      if (read.ok) subject = read.subject
      return read
    },

    actor() {
      if (!subject)
        throw new Error(
          'no subject has been established, and an unidentified write is not one this product makes'
        )
      return actorOf(subject)
    },

    held: () => subject,

    async guard() {
      if (!subject) return { ok: false, why: 'unavailable', says: 'nothing has been established yet' }
      const now = await resolve()
      if (!now.ok) return now
      if (authorityMoved(subject, now.subject))
        return {
          ok: false,
          why: 'not_a_member',
          says:
            `authority moved since this session started: it held revision ${subject.revision} as ${subject.role} ` +
            `and the estate now says revision ${now.subject.revision} as ${now.subject.role}`
        }
      return now
    },

    guarded(journal) {
      const self = this
      return {
        ...journal,
        async append(input: Parameters<Journal['append']>[0]) {
          const kind = (input as { actor?: { kind?: string } }).actor?.kind
          // Only a PERSON is checked. A system actor has no membership to
          // revoke, and its authority is checked where that authority lives.
          if (kind === 'person') {
            const ok = await self.guard()
            if (!ok.ok)
              throw new Error(
                `this write was refused at the identity boundary: ${ok.says}`
              )
          }
          return journal.append(input)
        }
      } as Journal
    }
  }
}

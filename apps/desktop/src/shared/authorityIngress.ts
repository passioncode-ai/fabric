// The safe sink sits at authority INGRESS, not on one surface (S03).
//
// MEASURED: `redactPayload` ran inside `AgentSurface.appendRedacted` and
// nowhere else. `policy.ts` appends `policy.decided@1` carrying `asked_because`
// — the agent's own words, verbatim (M140) — and `target`, and it redacted
// neither. So a secret in an agent's reason reached the journal and, through
// it, the operator's attention queue: the exact leak M195 closed, one door
// along. M106's lesson in a new place — the guarantee belongs to the boundary
// that owes it, not to the call sites that happen to remember.
//
// AND A TARGET IS NOT REDACTED. It is REFUSED.
//
// This is the rule the whole module exists for, and it is not obvious. Every
// other field can be scrubbed and still mean what it meant: a reason with a
// token removed is the same reason. A TARGET cannot. `target` is what the grant
// is FOR — it is compared, character for character, when the permission is
// looked up later. Rewriting `https://api.example.com?key=sk-live-x` into
// `https://api.example.com?key=[redacted: token]` produces a grant for a string
// nobody asked about and nobody will ever match, and the operator authorises an
// act described to them in terms that are not the act.
//
// So the secret-bearing target is refused with an explanation, and the caller
// fixes the input rather than receiving a permission for something else.

import { redact, type RedactionCount } from './redact.ts'

export type TargetCheck =
  | { ok: true; target: string }
  | { ok: false; says: string; remedy: string; rules: string[] }

/**
 * May this string be an authority target?
 *
 * Only if scrubbing it would change nothing. A target that redaction would
 * touch carries a secret, and the two available outcomes — keep the secret, or
 * grant a different permission — are both wrong.
 */
export function checkAuthorityTarget(target: string): TargetCheck {
  const { text, redactions } = redact(target)
  if (text === target) return { ok: true, target }
  return {
    ok: false,
    says:
      'that target carries something secret, so it cannot be the thing a permission is granted for. ' +
      'Scrubbing it would produce a permission for a different string than the one you asked about — ' +
      'and the operator would be approving an act described in terms that are not the act.',
    remedy:
      'Name the resource without the credential: the host and path, an account id, a file path. ' +
      'The secret belongs in the connection, not in what the permission is about.',
    rules: redactions.map((r) => r.rule)
  }
}

/** Fields that are FREE TEXT: scrubbed, because a reason with a token removed
 *  is still the same reason. Everything else in an authority payload is either
 *  an identifier or the target, which are handled differently. */
const FREE_TEXT = new Set(['reason', 'asked_because', 'note', 'says', 'why', 'evidence', 'observation_ref'])

export interface IngressResult {
  payload: Record<string, unknown>
  redactions: RedactionCount[]
}

/**
 * Scrub the free text in an authority payload, on the way in.
 *
 * Deliberately narrow: it does NOT walk the whole payload the way
 * `redactPayload` does. An authority payload's other fields are uuids, class
 * names and a target — and a target must never be quietly rewritten here,
 * because `checkAuthorityTarget` has already refused the ones that would be.
 */
export function redactAuthorityPayload(payload: Record<string, unknown>): IngressResult {
  const out: Record<string, unknown> = {}
  const counts = new Map<string, number>()
  for (const [key, value] of Object.entries(payload)) {
    if (FREE_TEXT.has(key) && typeof value === 'string') {
      const { text, redactions } = redact(value)
      out[key] = text
      for (const r of redactions) counts.set(r.rule, (counts.get(r.rule) ?? 0) + r.count)
    } else {
      out[key] = value
    }
  }
  return { payload: out, redactions: [...counts].map(([rule, count]) => ({ rule, count })) }
}

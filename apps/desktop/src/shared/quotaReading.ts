// Which question the quota panel is answering (AX-14).
//
// MEASURED at `8652799`: the estate panel rendered ONE sentence when `quota`
// was null — "No quota to show — Claude Code is not signed in on this machine."
// — inside an `EmptyState read`, this codebase's marker for a MEASUREMENT. Null
// arrived from three places:
//
//   1. the reader genuinely had nothing to say, which is what the sentence
//      means and the only case where it is true;
//   2. the IPC read FAILED and `App.tsx` caught it with `setQuota(null)`, so the
//      product diagnosed the operator's account when it could not even ask;
//   3. nothing had been read yet, because the initial state IS null — so the
//      first paint said it, before anyone looked.
//
// The third is M108's own rule, applied in this codebase to `projects`,
// `sessions` and `feed` in as many words — "null until it has been read; the
// empty array is a MEASUREMENT" — and not applied to quota.

import type { Quota } from './types.ts'

/**
 * THREE STATES, because the sentence was answering three questions.
 *
 * `read: false` is not a quota of any kind; it is the absence of a look.
 */
export type QuotaReading =
  | { read: false }
  | { read: true; quota: Quota | null }
  | { read: true; failed: string }

/** Did the read happen and produce an answer this screen can render? */
export function quotaOf(reading: QuotaReading): Quota | null {
  return reading.read && 'quota' in reading ? reading.quota : null
}

/**
 * Why a reading is partial, in the operator's terms rather than in the
 * reader's.
 *
 * `Quota.problem` carries six values and the panel rendered every one of them
 * as "last read {age} ago". Throttled is not stale. Rejected is not stale. The
 * reader models the causes carefully; the operator was told about age.
 */
export const QUOTA_PROBLEM_KEYS = {
  'no-credential': 'estate.quotaNoCredential',
  unreachable: 'estate.quotaUnreachable',
  rejected: 'estate.quotaRejected',
  empty: 'estate.quotaEmpty',
  throttled: 'estate.quotaThrottled'
} as const

export function quotaProblemKey(problem: NonNullable<Quota['problem']>): string {
  return QUOTA_PROBLEM_KEYS[problem]
}

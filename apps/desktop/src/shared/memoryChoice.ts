// Whether the operator is ASKED where memory lives, or simply told (M99).
//
// Onboarding rendered a radiogroup with two radios, one of them permanently
// disabled and carrying "Hosted estates are not built yet." It was not a dead
// button — it said why, which is better than the milestone's description of it
// — but a radiogroup with one selectable option is not a choice. It asks a
// person to decide something with a single answer, in the form where they are
// deciding what their project actually is.
//
// The milestone's instruction was "take it off the screen until it works", and
// that is what shipped first. THE OPERATOR OVERTURNED IT on 2026-09-05: the
// roadmap the disabled option states out loud is worth more to them than the
// cost of a radio nobody can press, and that is their call to make. It is
// recorded here rather than in a commit nobody re-reads, because the removal
// had a test and the restoration needs one too.
//
// What survives from the removal, and is the more useful half anyway: a single
// DECLARED backend is a statement rather than a radiogroup, an unavailable one
// is rendered but not selectable, and both its name and its description are
// keyed by backend id — the old form chose them with ternaries, so the first
// second available backend would have been labelled "Cloud" and described as
// living in this machine's database.

import type { MemoryBackendOption } from './types.ts'

export interface MemoryChoice {
  /**
   * `unread`   — the list has not arrived yet. NOT the same as "none": saying
   *              "no memory backend" while the answer is in flight is M108's
   *              defect in a new place.
   * `none`     — nothing available. A machine that can store no memory cannot
   *              make a project, and a silent empty field is the worst way to
   *              find that out. The unavailable entries are still shown, because
   *              they are what EXPLAINS the refusal.
   * `statement`— exactly one DECLARED backend. There is nothing to choose
   *              between, so it is told rather than asked.
   * `choice`   — more than one declared. A radiogroup, with the unavailable
   *              ones disabled and carrying their reason.
   */
  kind: 'unread' | 'none' | 'statement' | 'choice'
  /** Everything to render, available or not. */
  shown: MemoryBackendOption[]
  /** What can actually be picked — never inferred from `shown` by a caller. */
  selectable: MemoryBackendOption[]
}

export function memoryChoice(options: MemoryBackendOption[] | null): MemoryChoice {
  if (options === null || options.length === 0)
    return { kind: 'unread', shown: [], selectable: [] }
  const selectable = options.filter((b) => b.available)
  if (selectable.length === 0) return { kind: 'none', shown: options, selectable }
  return { kind: options.length === 1 ? 'statement' : 'choice', shown: options, selectable }
}

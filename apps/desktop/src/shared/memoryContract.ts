// What an insight is ABOUT, and what actually happened to the correction (M182).
//
// MEASURED BEFORE THIS EXISTED, and the second half is a live lie to an agent.
//
// ONE. `fabric_memory_remember` takes `kind: note|finding|decision|trap`, and
// that is the only axis it has. `kind=trap` cannot say whether the trap belongs
// to THIS project, to the agent runner, to the harness, or to Fabric itself —
// so a lesson about a runner's file tool and a lesson about this repository's
// build are the same row, and neither can be filtered out of the other's
// context pack. That is the card's own sentence: kind=trap does not say whether
// the problem is the project's or Fabric's.
//
// TWO, and it is the one that ships a falsehood. `apply_memory_facts` refuses an
// agent's attempt to bury a person's fact — correctly — with a WHERE clause:
//
//     and not (memory_facts.actor_kind = 'person' and e.actor->>'kind' = 'agent')
//
// A WHERE clause that matches nothing raises nothing. The agent's own claim is
// still written, which is right; but the tool then returned
// `{ recorded: true, superseded: <the id it asked for> }` — echoing the REQUEST
// back as though it were the outcome. The agent is told its correction landed,
// the person's fact still answers every search, and the two facts now
// contradict each other with one of them believed retired. Same shape as the
// effect that reported success before the act (ADR-0050): a request is not an
// outcome, and only an observation may say what happened.
//
// SO A CORRECTION HAS AN OUTCOME, IT IS COMPUTED WHERE THE REFUSAL HAPPENS, and
// the writer reads it back rather than restating what it asked for.
//
// AND AN OCCURRENCE IS NOT A MENTION. Three task runs hitting one incident and
// writing three facts about it are three facts and ONE occurrence; counting
// them as three is how "this has happened three times" becomes true of
// something that happened once — the exact number M184's threshold will fire
// on. Identity is the capture episode, not the fact and not the run.

/**
 * WHOSE lesson this is. Closed, and closed on purpose: a free-text category is
 * a filter nobody can build, and the first misspelling silently creates a
 * category of one.
 *
 * Orthogonal to `kind`, which says what SORT of statement it is. A trap in the
 * harness and a trap in this project are both `kind: 'trap'`; they differ here.
 */
export const INSIGHT_CATEGORIES = ['project', 'agents', 'harness', 'fabric', 'process'] as const
export type InsightCategory = (typeof INSIGHT_CATEGORIES)[number]

/** What every fact recorded before this existed is. Not a guess: the old writer
 *  had one subject, the project it was written in. */
export const DEFAULT_CATEGORY: InsightCategory = 'project'

/**
 * The SUBJECT, as a stable key.
 *
 * A namespace and a key, never a path: a basename is neither a stable subject
 * nor a privacy filter — two projects both containing `index.ts` are not one
 * subject, and a local path in a shared key leaks the operator's disk layout.
 */
export const ABOUT_NAMESPACES = [
  'project',
  'provider',
  'skill',
  'fabric-component',
  'process'
] as const
export type AboutNamespace = (typeof ABOUT_NAMESPACES)[number]

export interface AboutRef {
  namespace: AboutNamespace
  key: string
}

const KEY_CAP = 256

/**
 * The one normalisation, so `Claude-Code`, `claude code ` and `claude_code` are
 * one subject rather than three of one.
 *
 * Returns null for anything it cannot make a key of — an unnormalisable subject
 * is no subject, and inventing one merges claims that were never about the same
 * thing.
 */
export function normaliseAbout(
  input: { namespace?: string; key?: string } | null | undefined
): AboutRef | null {
  if (!input) return null
  const namespace = (input.namespace ?? '').trim() as AboutNamespace
  if (!ABOUT_NAMESPACES.includes(namespace)) return null
  const key = (input.key ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, KEY_CAP)
  return key === '' ? null : { namespace, key }
}

/** Two facts are about the same thing exactly when this matches. Never used
 *  ALONE to merge claims: the same subject is where two contradictory findings
 *  live, not proof that they are one finding. */
export function aboutKey(about: AboutRef | null): string | null {
  return about ? `${about.namespace}:${about.key}` : null
}

/**
 * What HAPPENED to a requested correction. Four answers, and three of them are
 * the writer being told its request did not land.
 */
export const CORRECTION_OUTCOMES = [
  /** Nothing was asked. The default, so a plain record cannot read as a
   *  correction that worked. */
  'not_requested',
  /** The named fact's window closed. The only outcome that means "corrected". */
  'superseded',
  /** The new claim was written and the old one still stands, deliberately: an
   *  agent may not bury what a person recorded, and a fact already corrected is
   *  not corrected twice. Both are visible and a person decides. */
  'conflict_proposed',
  /** There was nothing to correct — no such fact in this project. */
  'rejected'
] as const
export type CorrectionOutcome = (typeof CORRECTION_OUTCOMES)[number]

export interface Correction {
  status: CorrectionOutcome
  /** Why, whenever the status is not the one that was asked for. Never null on
   *  a conflict or a rejection: an outcome the writer cannot act on is a
   *  refusal it will simply retry. */
  reason: string | null
  /** The fact that was NAMED. Kept on every outcome, so the writer can say what
   *  it tried to correct even when it did not. */
  previousRef: string | null
}

/** Was this correction actually applied? The one place that decides, so no
 *  caller re-derives it from a status string. */
export function corrected(c: Correction): boolean {
  return c.status === 'superseded'
}

/** The sentence a person or an agent reads. It names the outcome, never the
 *  request — the defect this module exists for was a receipt that echoed what
 *  had been asked. */
export function describeCorrection(c: Correction): string {
  switch (c.status) {
    case 'not_requested':
      return 'recorded; nothing was corrected'
    case 'superseded':
      return 'recorded, and the fact it corrects has stopped answering searches'
    case 'conflict_proposed':
      return `recorded BESIDE the earlier fact, which still stands — ${c.reason ?? 'the correction was not applied'}`
    case 'rejected':
      return `recorded; the correction was not applied — ${c.reason ?? 'there was nothing to correct'}`
  }
}

/**
 * HOW an occurrence came to be counted, which decides whether it may count.
 *
 * An agent asserting "this is a new occurrence" is a claim about the world made
 * by the party with an interest in the number. It is recorded and it is
 * PROVISIONAL: a threshold that fires on agent-proposed occurrences fires on
 * whatever an agent decided to call distinct.
 */
export const OCCURRENCE_GROUPINGS = ['host_observed', 'reviewed', 'agent_proposed'] as const
export type OccurrenceGrouping = (typeof OCCURRENCE_GROUPINGS)[number]

export interface OccurrenceOrigin {
  /** The system that captured the episode — `fabric.session`, `fabric.ops`, a
   *  named external adapter. */
  system: string
  /** Its own id for the thing. */
  sourceId: string
  /** Which episode within it. A run correlation is not a recurrence identity:
   *  the same incident retried three times is one episode. */
  episodeKey: string
}

/**
 * The identity of an incident. Everything about it is the CAPTURE, and nothing
 * about it is the fact that mentions it — which is what makes three facts about
 * one incident three facts and one occurrence.
 */
export function occurrenceKey(origin: OccurrenceOrigin | null | undefined): string | null {
  const parts = [origin?.system, origin?.sourceId, origin?.episodeKey].map((p) => (p ?? '').trim())
  return parts.every(Boolean) ? parts.join(' ') : null
}

/** May this occurrence count towards a "this keeps happening" threshold?
 *
 *  Deliberately not a boolean on the row: the answer depends on who established
 *  distinctness, and an agent's own say-so is not an establishment. */
export function countsTowardRecurrence(grouping: OccurrenceGrouping): boolean {
  return grouping !== 'agent_proposed'
}

/**
 * How many times did this actually happen?
 *
 * Returns the countable number AND the provisional one, never their sum: a
 * total that mixes host-observed episodes with an agent's own claims about
 * distinctness is the number M184 would fire on, and it would be wrong in
 * exactly the direction an agent is motivated to make it wrong.
 */
export function recurrence(
  occurrences: readonly { key: string; grouping: OccurrenceGrouping }[]
): { counted: number; provisional: number } {
  const counted = new Set<string>()
  const provisional = new Set<string>()
  for (const o of occurrences)
    (countsTowardRecurrence(o.grouping) ? counted : provisional).add(o.key)
  // An episode established by a host observation is no longer provisional, even
  // if an agent also claimed it.
  for (const k of counted) provisional.delete(k)
  return { counted: counted.size, provisional: provisional.size }
}

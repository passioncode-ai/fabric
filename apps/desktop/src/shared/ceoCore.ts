// The CEO's deterministic core (M166), its first slice for CO-522 wave D.
//
// #region ceo-core — docs: docs/evidence/specs/2026-11-06-fabric-manager-agent.md#1a-the-design-this-builds-on-found-2026-11-06-after-the-first-draft
//
// WHAT IT IS. One pure function from a scoped snapshot to a plan: the Board ranked
// on one scale, the digest since the person last looked, the trust in effect, and
// a plain list of what the core cannot do yet. Same snapshot, same clock, same
// plan; rows in another order give the same order out. No database, no client and
// no model is imported here, so the plan is the same with a provider or without.
//
// WHAT IT IS NOT. A plan grants nothing. It holds no action to execute: question
// hygiene waits for M153 and settlement candidates for M158, and both are named as
// unavailable rather than left empty, because an empty list reads as "nothing to
// do" and an absent capability is not that. Advice needs a model; with none
// configured it says so and never writes text that looks like advice.
//
// It composes what already ships and duplicates no formula: `boardEntries`
// (questionPriority, obligationPriority, rankBoard), `projectWeight`, `ceoTrustFor`
// and `digestOf`.

import { boardEntries, type BoardEntry, type BoardQuestion } from './board.ts'
import type { AttentionItem } from './attention.ts'
import { ceoTrustFor, projectWeight, type CeoTrust, type ProjectSignals } from './projectWeight.ts'
import { digestOf, type Digest, type DigestBoundary, type DigestInput } from './digest.ts'

/** Whether a source this plan stands on was read. A failed read is said, never
 *  filled with an empty list that looks like a quiet day. */
export type SourceRead = 'read' | 'failed'

export interface CoreSnapshot {
  scope: { estateId: string; projectId: string | null }
  /** The journal position the reads were taken at. The executor (M166's
   *  `applyCorePlan`, not built) checks an act against it, so a plan read before
   *  a change is refused after it; the plan carries it once that reader exists. */
  cursor: number | null
  /** Injected, never read from the clock: the same snapshot ranks the same. */
  now: string
  policyRevision: string
  trust: { estate: CeoTrust; projectOverride: CeoTrust | null }
  questions: readonly BoardQuestion[]
  attention: readonly AttentionItem[]
  /** Per project id. A project with no signals weighs 0 and the plan says so. */
  projectSignals: Readonly<Record<string, ProjectSignals>>
  digest: { input: DigestInput; sinceSeq: number | null; boundary: DigestBoundary }
  sources: { questions: SourceRead; attention: SourceRead; digest: SourceRead; facts: SourceRead }
  /** Whether a model is configured for advice. The core never calls it. */
  advisor: 'configured' | null
}

/** What the core cannot do, and why, in fixed words a surface can phrase. */
export type Unavailable =
  | { capability: 'hygiene'; because: 'not-built'; waitsOn: 'M153' }
  | { capability: 'settlement'; because: 'not-built'; waitsOn: 'M158' }
  | { capability: 'settlement'; because: 'trust-ask' }
  | { capability: 'settlement'; because: 'source-unknown'; source: 'facts' }
  | { capability: 'advice'; because: 'not-configured' }
  | { capability: 'ranking'; because: 'source-unknown'; source: 'questions' | 'attention' }
  | { capability: 'digest'; because: 'source-unknown'; source: 'digest' }

export interface CorePlan {
  policyRevision: string
  trust: { estate: CeoTrust; projectOverride: CeoTrust | null; effective: CeoTrust }
  /** Ranked, with each priority's components, so an order can be explained. */
  rankedItems: BoardEntry[]
  /** Project ids an item came from that had no signals: weighed 0, not guessed. */
  unweighedProjects: string[]
  /** Always empty in this slice: the capability is listed in `unavailable`. */
  hygiene: never[]
  settlementCandidates: never[]
  digest: Digest | null
  unavailable: Unavailable[]
  sources: CoreSnapshot['sources']
}

export function planCeoCore(s: CoreSnapshot): CorePlan {
  const now = new Date(s.now)
  const unweighed = new Set<string>()
  const weightOf = (projectId: string | null): number => {
    if (projectId === null) return 0
    const signals = s.projectSignals[projectId]
    if (!signals) {
      unweighed.add(projectId)
      return 0
    }
    return projectWeight(signals).weight
  }

  // A source that failed contributes nothing and is named; the other still ranks.
  const questions = s.sources.questions === 'read' ? s.questions : []
  const attention = s.sources.attention === 'read' ? s.attention : []
  const rankedItems = boardEntries({ questions, attention, projectWeightOf: weightOf, now })

  const effective = ceoTrustFor(s.trust.estate, s.trust.projectOverride)
  const unavailable: Unavailable[] = [{ capability: 'hygiene', because: 'not-built', waitsOn: 'M153' }]
  // The most binding reason first: under `ask` nothing is settled even once M158 lands.
  if (effective === 'ask') unavailable.push({ capability: 'settlement', because: 'trust-ask' })
  else if (s.sources.facts === 'failed') unavailable.push({ capability: 'settlement', because: 'source-unknown', source: 'facts' })
  else unavailable.push({ capability: 'settlement', because: 'not-built', waitsOn: 'M158' })
  if (s.advisor === null) unavailable.push({ capability: 'advice', because: 'not-configured' })
  if (s.sources.questions === 'failed') unavailable.push({ capability: 'ranking', because: 'source-unknown', source: 'questions' })
  if (s.sources.attention === 'failed') unavailable.push({ capability: 'ranking', because: 'source-unknown', source: 'attention' })
  if (s.sources.digest === 'failed') unavailable.push({ capability: 'digest', because: 'source-unknown', source: 'digest' })

  return {
    policyRevision: s.policyRevision,
    trust: { estate: s.trust.estate, projectOverride: s.trust.projectOverride, effective },
    rankedItems,
    unweighedProjects: [...unweighed].sort(),
    hygiene: [],
    settlementCandidates: [],
    digest: s.sources.digest === 'read' ? digestOf(s.digest.input, s.digest.sinceSeq, s.digest.boundary) : null,
    unavailable,
    sources: s.sources
  }
}
// #endregion ceo-core

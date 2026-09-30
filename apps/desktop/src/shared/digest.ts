// Where we left off (M133 · the digest at the top of a project).
//
// COMPOSED, NOT GENERATED. There is no model behind this product, and a summary
// written by one would be a claim about the project rather than a reading of
// it. Every line here IS a row from a store, carrying the id that opens it — so
// the digest can be wrong only in the way the record is wrong, which is the
// only kind of wrong worth having.
//
// The same decision the CEO panel reached: where a model is missing, build the
// half that needs none, and say what the other half would take.
//
// SINCE WHEN. "Where we left off" means since YOU left, not a fixed window — a
// week's digest is a report, and this is meant to be caught up on. The mark
// advances when the operator leaves the project, so returning shows what
// happened while they were gone and returning again shows nothing, which is
// correct: they just saw it.
//
// UNTIL WHEN, which is the half that was missing (UX28-03). A reading carries
// the journal head it was TAKEN AT, and that number — not the head at the
// moment of leaving — is what may be acknowledged. Without it the panel asked
// the journal for its current head when the operator left, and the panel
// re-reads whenever the mark moves: so an arriving event re-ran the effect and
// the cleanup marked the head those very events had just moved. The refresh
// acknowledged the news it was refreshing for, and the news was gone.
//
// The boundary is the HEAD, deliberately, and not the highest line on screen.
// An event of a kind the digest does not display still moves it, so unread
// kinds cannot pile up into a backlog that grows forever — which was the real
// concern behind the old always-advance cleanup, kept without its cost.

export type DigestKind = 'decision' | 'correction' | 'review' | 'session' | 'capture'

export interface DigestLine {
  kind: DigestKind
  /** Ordering, and the reason the digest is a projection rather than a guess. */
  seq: number
  at: string | null
  text: string
  /** What opens it. A line that cannot name its source is not built at all. */
  source: { store: string; id: string }
}

export interface DigestInput {
  decisions: { id: string; claim: string; recorded_at: string; seq: number }[]
  /** A fact that was corrected: news in its own right, and easy to miss. */
  corrections: { id: string; claim: string; recorded_at: string; seq: number; supersedes: string }[]
  reviews: { id: string; title: string | null; instruction: string; at: string; seq: number }[]
  sessions: { session_id: string; annotation: string; ended_at: string | null; captured_at?: string | null; ending_provenance?: 'legacy' | 'observed' | 'unknown'; seq: number }[]
}

/**
 * What a reading may acknowledge.
 *
 * The journal head this reading was taken at. **Null when the head could not be
 * read** — and a null boundary acknowledges NOTHING, because the alternative is
 * asking the journal again later and marking whatever it says then, which is
 * the substitution this field exists to remove.
 */
export type DigestBoundary = number | null

export type Digest =
  | { state: 'first-visit'; boundary: DigestBoundary }
  /** Read, and nothing happened. Different from never having looked. */
  | { state: 'nothing-new'; boundary: DigestBoundary }
  | { state: 'lines'; boundary: DigestBoundary; lines: DigestLine[] }

/**
 * Compose the digest, oldest first.
 *
 * CHRONOLOGICAL because catching up is a story rather than a report: grouping by
 * kind tells you what KINDS of thing happened, and the question here is what
 * happened.
 */
export function digestOf(
  input: DigestInput,
  sinceSeq: number | null,
  boundary: DigestBoundary
): Digest {
  // A FIRST visit still carries a boundary, and acknowledging it is the point:
  // it is what makes the second visit mean "since you were here" rather than
  // "since the beginning".
  if (sinceSeq === null) return { state: 'first-visit', boundary }
  const lines: DigestLine[] = [
    ...input.decisions.map((d) => ({
      kind: 'decision' as const,
      seq: d.seq,
      at: d.recorded_at,
      text: d.claim,
      source: { store: 'memory_facts', id: d.id }
    })),
    ...input.corrections.map((c) => ({
      kind: 'correction' as const,
      seq: c.seq,
      at: c.recorded_at,
      text: c.claim,
      source: { store: 'memory_facts', id: c.id }
    })),
    ...input.reviews.map((r) => ({
      kind: 'review' as const,
      seq: r.seq,
      at: r.at,
      text: r.title ?? r.instruction,
      source: { store: 'project_tasks', id: r.id }
    })),
    ...input.sessions.map((s) => ({
      kind: (s.ending_provenance === 'observed' && s.ended_at ? 'session' : 'capture') as DigestKind,
      seq: s.seq,
      at: s.ending_provenance === 'observed' ? s.ended_at : s.captured_at ?? null,
      text: s.annotation,
      source: { store: 'session_transcripts', id: s.session_id }
    }))
  ]
    .filter((line) => line.seq > sinceSeq)
    .sort((a, b) => a.seq - b.seq)
  return lines.length === 0 ? { state: 'nothing-new', boundary } : { state: 'lines', boundary, lines }
}

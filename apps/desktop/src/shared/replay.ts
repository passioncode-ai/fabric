/**
 * What a view attaching to a live session must write, and in what order.
 *
 * FA-08. Attaching has two halves that race: a replay of what the session has
 * already said, and a subscription to what it says next. Whichever is arranged
 * first decides which failure you get. Replay-then-subscribe loses every byte
 * emitted in the gap — the old shape, and it lost more the busier the session
 * was. Subscribe-then-replay loses nothing but repeats whatever the replay
 * already contained, and a terminal that prints the last screen twice is a bug
 * an operator will report as lost work.
 *
 * The count makes the overlap decidable rather than guessed. Every chunk knows
 * the character count the session had reached when it ended, and the replay
 * knows the count it was taken at; a chunk at or below that count is inside the
 * replay, and one above it is the gap.
 */

/** A chunk held while the replay was in flight. */
export interface HeldChunk {
  data: string
  /** The session's character count after this chunk. */
  written: number
}

export interface ReplaySnapshot {
  text: string
  /** The character count the text ends at. */
  written: number
}

/**
 * The exact sequence to write, oldest first.
 *
 * `replay` is null when the session could not be read — the live stream is
 * still worth showing, so everything held is written rather than nothing.
 */
export function mergeReplay(input: {
  replay: ReplaySnapshot | null
  held: readonly HeldChunk[]
}): string[] {
  const { replay, held } = input
  if (!replay) return held.map((c) => c.data)
  const out: string[] = []
  if (replay.text) out.push(replay.text)
  for (const chunk of held) if (chunk.written > replay.written) out.push(chunk.data)
  return out
}

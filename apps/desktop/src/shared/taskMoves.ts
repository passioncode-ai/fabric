// #region task-moves — docs: docs/ux/scenarios.md#scn-174-open-a-task-and-read-what-it-is-why-and-what-will-be-ready
/**
 * A task's moves along the ladder (SCN-174 step 2, CO-401), newest first, from the journal rows its page already reads:
 * each `task.moved@1` with where it came from, where it went, when and who moved it. A move whose `from` the writer
 * did not record keeps it null rather than guessing it from the move before.
 */
import type { FeedEvent } from './types'

export interface TaskMove { seq: number; at: string; from: string | null; to: string; by: 'person' | 'agent' | 'system' }

export function taskMoves(events: readonly FeedEvent[]): TaskMove[] {
  const by = (kind: string): TaskMove['by'] => (kind === 'person' ? 'person' : kind === 'agent' ? 'agent' : 'system')
  return events
    .filter((e) => e.type === 'task.moved@1' && typeof e.payload?.to === 'string')
    .map((e) => ({ seq: e.seq, at: e.occurred_at, from: typeof e.payload.from === 'string' ? e.payload.from : null, to: e.payload.to as string, by: by(e.actor.kind) }))
    .sort((a, b) => b.seq - a.seq)
}
// #endregion task-moves

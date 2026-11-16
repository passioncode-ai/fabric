// #region turn-verdict — docs: docs/evidence/specs/2026-11-16-turn-end-waits.md#42-while-the-session-is-alive-the-turns-verdict
/**
 * The turn's verdict (T2): whether a live session that ends a turn may simply go on. An agent that stops saying «the next
 * step waits» while nothing it can name blocks it stands still until a person comes back (the operator, 2026-11-16). So
 * a turn's answer says `continue` when the session holds a live claim on an open task, declared no wait, and one of its
 * last two turns changed something, so a loop that changes nothing stops. Fabric never says `stop`: no verdict is stop,
 * the hook's ordinary end. Pure: `workTools.ts` reads the facts, the adapter's Stop hook acts on the answer.
 */

/** A task the session may still work on: a claim not released and not past its expiry, on a task still open. */
export interface HeldTask { taskId: string; title: string | null; status: string; expiresAt: string }
/** One recorded turn of the session, newest first: the HEAD it saw and its counts against HEAD. */
export interface TurnFacts { head: string | null; filesChanged: number | null; linesAdded: number | null; linesRemoved: number | null }

export interface TurnVerdict { next: 'continue'; reason: string; task_id: string }

/** Statuses a held task is still worked in; review, done and cancelled mean the claim's work is over. */
const OPEN = new Set(['backlog', 'running'])

/** Whether the turn `now` changed something against the turn before it: another HEAD, or other counts. An unknown fact
 *  (null) on either side is not a change, so a folder git cannot read never keeps a session going by itself. */
export function turnChanged(now: TurnFacts, before: TurnFacts | undefined): boolean {
  if (!before) return true
  if (now.head && before.head && now.head !== before.head) return true
  const pairs: Array<[number | null, number | null]> = [[now.filesChanged, before.filesChanged], [now.linesAdded, before.linesAdded], [now.linesRemoved, before.linesRemoved]]
  return pairs.some(([a, b]) => a !== null && b !== null && a !== b)
}

/**
 * The verdict for a turn just recorded. `turns` are this session's turns newest first, this one included; three are
 * enough (this turn against the one before, and that one against its own). `waiting` is a declared wait: the session's
 * heartbeat says waiting or blocked.
 */
export function turnVerdict(held: readonly HeldTask[], waiting: boolean, turns: readonly TurnFacts[], now: number): TurnVerdict | null {
  if (waiting) return null
  const task = held.filter((h) => OPEN.has(h.status) && Date.parse(h.expiresAt) > now)
    .sort((a, b) => Date.parse(b.expiresAt) - Date.parse(a.expiresAt))[0]
  if (!task) return null
  const [t0, t1, t2] = turns
  if (!t0) return null
  if (!turnChanged(t0, t1) && !(t1 !== undefined && turnChanged(t1, t2))) return null
  const name = task.title ? `«${task.title}»` : 'the task you hold'
  return {
    next: 'continue',
    task_id: task.taskId,
    reason: `You still hold ${name} and declared no wait, so go on with its next step now. If something you can name blocks it, release with a wait (fabric_work_release with wait: time, question, grant, request or limit); if it is finished, release it done.`
  }
}
// #endregion turn-verdict

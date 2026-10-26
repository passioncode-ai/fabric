// #region agent-trail — docs: docs/ux/2026-10-26-simple-fabric.md#3-an-agents-screen
/**
 * What an agent's screen says of each of its tasks, from the session's own history (`terminal.history`, the newest
 * `SESSION_HISTORY_WINDOW` events naming the session) and its holds (`work.session`): 0.3.14, the simple Fabric,
 * docs/ux/2026-10-26-simple-fabric.md §3.
 *
 * MILESTONES are its stage reports (`agent.stage.reported@1`). One names its task when Fabric launched the session on it
 * (`task_id`); a session that claimed its task reports with no `task_id`, so an unnamed report counts for the task the
 * session held when it was made (from the claim to its release, or until now). Newest first.
 * HOW IT ENDED is the release's note (`work.released@1`, written by `fabric_work_release`) and the named results handed
 * on (`task.handoff@1`). The agent's phase is its newest heartbeat (`agent.heartbeat@1`): a claim, said as one.
 * Pure. Older events than the window are not here, and the screen says so when the window is full.
 */

export interface TrailEvent {
  seq: number
  type: string
  occurred_at: string
  payload: Record<string, unknown> | null
}

export interface Milestone { text: string; step: number | null; ofSteps: number | null; note: string | null; at: string }
export interface Ending { how: string | null; note: string; at: string }
export interface Handoff { name: string; value: string; at: string }
export interface TaskTrail { milestones: Milestone[]; endings: Ending[]; handoffs: Handoff[] }

/** When the session held a task: from its claim to its release, or still. */
export interface Hold { taskId: string; from: string; to: string | null }

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.replace(/\s+/g, ' ').trim() : null)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const time = (iso: string | null | undefined): number => {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isFinite(t) ? t : NaN
}

export function taskTrail(events: readonly TrailEvent[], holds: readonly Hold[]): Map<string, TaskTrail> {
  const out = new Map<string, TaskTrail>()
  const of = (id: string): TaskTrail => {
    let t = out.get(id)
    if (!t) { t = { milestones: [], endings: [], handoffs: [] }; out.set(id, t) }
    return t
  }
  const heldAt = (at: string): string | null => {
    const when = time(at)
    if (!Number.isFinite(when)) return null
    // The newest hold that covers the moment: a re-claim wins over an earlier one.
    let best: Hold | null = null
    for (const h of holds) {
      const from = time(h.from)
      const to = h.to ? time(h.to) : Infinity
      if (Number.isFinite(from) && when >= from && when <= to && (!best || from > time(best.from))) best = h
    }
    return best?.taskId ?? null
  }
  const newestFirst = [...events].sort((a, b) => b.seq - a.seq)
  for (const e of newestFirst) {
    const p = e.payload ?? {}
    if (e.type === 'agent.stage.reported@1') {
      const said = text(p.stage)
      const task = text(p.task_id) ?? heldAt(e.occurred_at)
      if (said && task) of(task).milestones.push({ text: said, step: num(p.step), ofSteps: num(p.of_steps), note: text(p.note), at: e.occurred_at })
    } else if (e.type === 'work.released@1') {
      const task = text(p.work)
      const note = text(p.note)
      if (task && note) of(task).endings.push({ how: text(p.how), note, at: e.occurred_at })
    } else if (e.type === 'task.handoff@1') {
      const task = text(p.task_id)
      const name = text(p.name)
      const value = text(p.value)
      if (task && name && value) of(task).handoffs.push({ name, value, at: e.occurred_at })
    }
  }
  return out
}

export const PHASES = ['reading', 'working', 'waiting', 'verifying', 'blocked'] as const
export type Phase = typeof PHASES[number]

/** The agent's own word on what it is doing (its newest heartbeat), or null when it sent none this build can name. */
export function lastPhase(events: readonly TrailEvent[]): { phase: Phase; waitingOn: string | null; at: string } | null {
  let newest: TrailEvent | null = null
  for (const e of events) if (e.type === 'agent.heartbeat@1' && (!newest || e.seq > newest.seq)) newest = e
  const phase = newest?.payload?.phase
  if (!newest || typeof phase !== 'string' || !(PHASES as readonly string[]).includes(phase)) return null
  return { phase: phase as Phase, waitingOn: text(newest.payload?.waiting_kind), at: newest.occurred_at }
}
// #endregion agent-trail

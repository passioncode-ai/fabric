// #region agent-identity — docs: docs/reports/2026-10-27-mockup-parity/gaps/2026-10-27-home.md#d-data-bugs-wrong-numbers-order-or-missing-fields
/**
 * One agent, one identity, on the read side (the mockup parity, 2026-10-27, home gaps D5, D6). Every enrolment mints a
 * new Fabric session id (`main/sessionEnroll.ts`), so after Fabric restarts, or the agent re-enrols, its stage reports,
 * heartbeats and claims sit under its earlier ids and the home said «Задачи не взял» and «Ещё не сказал, что делает» for
 * everyone. The coding agent's own session id (`runtime_session_id` of `session.enrolled@1`) is the same across them.
 *
 * Here each live agent is joined with its earlier session ids of the same runtime session: its newest stage report and
 * newest heartbeat across them win, and when it holds no task now, the newest task it claimed under any of them that is
 * still running, and that ended by itself within `CARRY_CLAIM_MS`, is shown as its task (`fromEarlierSession`), one task
 * to one agent. Nothing is written: the claims stay released, the agent is
 * still asked to claim again; this only keeps the screens from forgetting who it is.
 *
 * Pure: main reads the rows (`main/agentIdentity.ts`).
 */
import { taskSummary, titleAndWhat, type HomeView, type LiveAgent, type StageRow, type TaskBrief } from './homeLive.ts'

export interface IdentityHeartbeat { session_id: string; phase: string; last_received_at: string; waiting_kind: string | null }
export interface IdentityClaim { work_id: string; project_id: string; owner_session: string; claimed_at: string; released_at: string | null; released_how?: string | null }

/** An earlier claim is carried to the live session only when it ended by itself (the session ended, or it lapsed) and
 *  recently: a claim the agent released on purpose (done, handed over, let go) or the operator released is never
 *  brought back, and one that lapsed hours ago is not the agent's task any more (the 0.3.15 review, iteration 1, ER-1). */
export const CARRY_CLAIM_MS = 2 * 60 * 60_000
const CARRIED_HOW = new Set(['session-ended', 'lapsed'])

export interface IdentityInput {
  /** Each live session's runtime session id. */
  runtimeOf: ReadonlyMap<string, string>
  /** Every Fabric session id known for a runtime session (from its enrolments), the live one included or not. */
  siblings: ReadonlyMap<string, readonly string[]>
  stages: readonly StageRow[]
  heartbeats: readonly IdentityHeartbeat[]
  claims: readonly IdentityClaim[]
  /** The claimed tasks' rows. */
  tasks: readonly TaskBrief[]
  /** The reading's clock (ms); `Date.now()` when absent. */
  now?: number
}

const t = (iso: string | null | undefined): number => {
  const v = iso ? Date.parse(iso) : NaN
  return Number.isFinite(v) ? v : -Infinity
}

export function joinByRuntime(view: HomeView, input: IdentityInput): HomeView {
  const stagesBy = new Map<string, StageRow>()
  for (const s of input.stages) { const p = stagesBy.get(s.session_id); if (!p || t(p.reported_at) < t(s.reported_at)) stagesBy.set(s.session_id, s) }
  const beatBy = new Map(input.heartbeats.map((b) => [b.session_id, b]))
  const taskBy = new Map(input.tasks.map((x) => [x.id, x]))
  const now = input.now ?? Date.now()
  // A task another live agent holds now is that agent's: never shown twice.
  const taken = new Set(view.live.filter((a) => a.task).map((a) => a.task!.id))
  const carried = (c: IdentityClaim): boolean =>
    c.released_at === null || (CARRIED_HOW.has(c.released_how ?? '') && now - t(c.released_at) <= CARRY_CLAIM_MS)
  const picks = new Map<string, IdentityClaim>()
  const live: LiveAgent[] = view.live.map((a) => {
    const rt = input.runtimeOf.get(a.sessionId)
    if (!rt) return a
    const ids = new Set([a.sessionId, ...(input.siblings.get(rt) ?? [])])
    let next: LiveAgent = ids.size > 1 ? { ...a, aliases: [...ids].filter((id) => id !== a.sessionId) } : a
    // The newest stage report across its ids.
    let stage: StageRow | undefined
    for (const id of ids) { const s = stagesBy.get(id); if (s && (!stage || t(stage.reported_at) < t(s.reported_at))) stage = s }
    const said = stage?.stage.replace(/\s+/g, ' ').trim()
    if (stage && said && t(stage.reported_at) > t(a.doing?.at)) {
      next = { ...next, doing: { text: said, note: stage.note?.replace(/\s+/g, ' ').trim() || null, step: stage.step, ofSteps: stage.of_steps, at: stage.reported_at } }
    }
    // The newest heartbeat across its ids.
    let beat: IdentityHeartbeat | undefined
    for (const id of ids) { const b = beatBy.get(id); if (b && (!beat || t(beat.last_received_at) < t(b.last_received_at))) beat = b }
    if (beat && t(beat.last_received_at) > t(a.heartbeat?.at)) next = { ...next, heartbeat: { phase: beat.phase, at: beat.last_received_at, waitingOn: beat.waiting_kind } }
    // No task now: the newest task it claimed under any of its ids that is still running.
    if (!a.task) {
      let claim: IdentityClaim | undefined
      for (const c of input.claims) {
        if (!ids.has(c.owner_session) || taskBy.get(c.work_id)?.status !== 'running' || taken.has(c.work_id) || !carried(c)) continue
        // The same runtime id enrolled in another project is that project's work (DA-6).
        if (a.projectId && c.project_id !== a.projectId) continue
        if (!claim || t(claim.claimed_at) < t(c.claimed_at)) claim = c
      }
      if (claim) picks.set(a.sessionId, claim)
    }
    return next
  })
  // One task goes to one live agent: the session that claimed it last (ER-1: two live sessions of one runtime).
  const owner = new Map<string, string>()
  for (const [sessionId, c] of [...picks].sort((x, y) => t(y[1].claimed_at) - t(x[1].claimed_at))) if (!owner.has(c.work_id)) owner.set(c.work_id, sessionId)
  const withTasks = live.map((a) => {
    const claim = picks.get(a.sessionId)
    if (!claim || owner.get(claim.work_id) !== a.sessionId) return a
    const row = taskBy.get(claim.work_id)
    return { ...a, task: { id: claim.work_id, projectId: claim.project_id, summary: taskSummary(row), ...titleAndWhat(row), heldSince: claim.claimed_at, fromEarlierSession: claim.owner_session !== a.sessionId } }
  })
  return { ...view, live: withTasks }
}
// #endregion agent-identity

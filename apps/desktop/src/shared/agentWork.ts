// #region agent-work — docs: docs/reports/2026-10-27-mockup-parity/gaps/home.md#d-data-bugs-wrong-numbers-order-or-missing-fields
/**
 * At work, apart from connected (the mockup parity, 2026-10-27, home gaps D3, D4, D7). «Working» used to mean any sign
 * of life within ten minutes, and fabric-mcp pings every two minutes on its own, so every open coding-agent window read
 * as working (37 on the operator's Mac with one claim open) and the cards reshuffled with the ping rotation.
 *
 * An agent is AT WORK when it holds a task (and still signs), or within `AT_WORK_MS` it reported a stage, sent a
 * working heartbeat (`working`, `reading`, `verifying`), finished a turn (`session.turn.observed@1`, its own hook), or
 * its Fabric console printed. A keep-alive ping keeps it CONNECTED, never at work. Its WORK TIME is the newest of those
 * signals (the claim's time among them), never a ping; the home orders agents and projects by it.
 *
 * Pure: main reads the turns and the consoles' output times (`main/agentWork.ts`).
 */
import type { HomeView, LiveAgent } from './homeLive.ts'

/** How recent a work signal must be for an agent to read as at work. */
export const AT_WORK_MS = 15 * 60_000

/** The heartbeat phases that say the agent is working (waiting and blocked are not). */
export const WORKING_PHASES: readonly string[] = ['working', 'reading', 'verifying']

export interface WorkSignals {
  /** Each session's newest turn (`session.turn.observed@1`), by session id. */
  turnAt?: ReadonlyMap<string, string>
  /** Each Fabric console's newest output, by session id. */
  outputAt?: ReadonlyMap<string, string>
}

const ms = (iso: string | null | undefined): number => {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isFinite(t) ? t : NaN
}

/** An agent's work time and whether it is at work now. */
export function workOf(a: LiveAgent, signals: WorkSignals, now: number): { atWork: boolean; workAt: string | null } {
  const recent: Array<string | null | undefined> = [
    a.doing?.at,
    a.heartbeat && WORKING_PHASES.includes(a.heartbeat.phase) ? a.heartbeat.at : null,
    signals.turnAt?.get(a.sessionId),
    a.console ? signals.outputAt?.get(a.sessionId) : null
  ]
  let workAt: string | null = null
  for (const s of [...recent, a.task?.heldSince]) if (s && Number.isFinite(ms(s)) && (!workAt || ms(s) > ms(workAt))) workAt = s
  const fresh = recent.some((s) => { const t = ms(s); return Number.isFinite(t) && now - t <= AT_WORK_MS })
  return { atWork: (!!a.task && !a.stale) || fresh, workAt }
}

/** Order: at work first, newest work first, then by agent name and session. */
export function byWork(a: LiveAgent, b: LiveAgent): number {
  const wa = a.workAt ? ms(a.workAt) : -Infinity
  const wb = b.workAt ? ms(b.workAt) : -Infinity
  return Number(!!b.atWork) - Number(!!a.atWork) || (wb === wa ? 0 : wb > wa ? 1 : -1) ||
    Number(a.stale) - Number(b.stale) || String(a.agent ?? '').localeCompare(String(b.agent ?? '')) || (a.sessionId < b.sessionId ? -1 : a.sessionId > b.sessionId ? 1 : 0)
}

/** The home's reading with each agent judged at work or not, the agents ordered by work, and the counts. */
export function withWorkSignals(view: HomeView, signals: WorkSignals, now: number): HomeView {
  const live = view.live.map((a) => ({ ...a, ...workOf(a, signals, now) })).sort(byWork)
  const atWork = live.filter((a) => a.atWork)
  const noTask = atWork.filter((a) => !a.task)
  const projects = view.projects.map((p) => {
    const mine = live.filter((a) => a.projectId === p.projectId && a.atWork)
    const workAt = mine.map((a) => a.workAt).filter((x): x is string => !!x).sort().at(-1) ?? null
    return { ...p, atWork: mine.length, workAt }
  })
  return {
    ...view,
    live,
    projects,
    atWork: { agents: atWork.length, connectedIdle: live.filter((a) => !a.atWork && !a.stale).length, noTask: noTask.length, noTaskSessions: noTask.map((a) => a.sessionId) }
  }
}
// #endregion agent-work

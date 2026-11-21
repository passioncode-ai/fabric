// #region ceo-board-keeper — docs: docs/adr/0197-the-ceo-is-a-console-session-fabric-keeps-with-a-fallback-runner.md#amendment-5-2026-11-21-fabric-keeps-the-ceos-board-slot-and-a-ceotask-request-wakes-its-console
/**
 * The CEO on the board while Fabric keeps its console (ADR-0197 Amendment 5; the owner, 2026-11-21: tasks from his
 * Telegram bot found no live CEO). Two acts, each from main's timers:
 *
 * - `keep()`, every KEEP_MS while the console runs: Fabric holds the `ceo.task` slot as the console's own session
 *   (`AgentSurface#keepResponderSlot`), so the slot reads active for as long as the console lives and goes stale a
 *   minute after it ends, as any responder's.
 * - `wake(requests)`, every minute: a `ceo.task` request that waits for the CEO's project while its console does not run
 *   starts it (`CeoAgent#ensure`), as the board dispatcher starts a project's session. A console the person stopped
 *   stays stopped (`ensure` answers without starting while held). At most once per WAKE_GAP_MS, so a start that keeps
 *   failing does not loop; the console's own nudge then types the request once it runs.
 *
 * Each act's answer is logged when it changes, not on every pass.
 */
import { CEO_BOARD_CAPABILITY, type CeoBoardRequest, type CeoState } from '../shared/ceoAgent.ts'
import type { KeepSlotAnswer } from './agentSurface.ts'

export const KEEP_MS = 30_000
export const WAKE_GAP_MS = 5 * 60_000

export interface CeoBoardKeeperDeps {
  state(): CeoState
  sessionId(): string | null
  projectId(): string | null
  keepSlot(sessionId: string, capability: string): Promise<KeepSlotAnswer>
  ensure(): Promise<unknown>
  record(op: string, outcome: 'ok' | 'failed', detail: Record<string, unknown>): void
  now?: () => number
}

/** The `ceo.task` requests that wait for the CEO's project: not taken yet (queued, or never moved). */
export function waitingForCeo(requests: readonly CeoBoardRequest[], projectId: string): CeoBoardRequest[] {
  return requests.filter((r) => r.to === projectId && r.capability === CEO_BOARD_CAPABILITY && (r.state === null || r.state === 'queued'))
}

export function createCeoBoardKeeper(deps: CeoBoardKeeperDeps) {
  const now = deps.now ?? Date.now
  let lastKeep: string | null = null
  let keeping = false
  let lastWake = 0

  async function keep(): Promise<KeepSlotAnswer | 'not-running'> {
    const id = deps.sessionId()
    if (deps.state() !== 'running' || !id) return 'not-running'
    if (keeping) return 'not-running'
    keeping = true
    try {
      let answer: KeepSlotAnswer
      try { answer = await deps.keepSlot(id, CEO_BOARD_CAPABILITY) } catch (e) { // recorded below through deps.record (the ops log), never silent
        answer = 'unavailable'
        deps.record('ceo.board-slot', 'failed', { session_id: id, error_class: e instanceof Error ? e.constructor.name : typeof e })
      }
      const said = `${id}:${answer}`
      if (said !== lastKeep) {
        lastKeep = said
        deps.record('ceo.board-slot', answer === 'kept' ? 'ok' : 'failed', { session_id: id, answer })
      }
      return answer
    } finally { keeping = false }
  }

  async function wake(requests: readonly CeoBoardRequest[]): Promise<'woken' | 'running' | 'nothing-waits' | 'too-soon' | 'no-project'> {
    const projectId = deps.projectId()
    if (!projectId) return 'no-project'
    const state = deps.state()
    if (state === 'running' || state === 'starting') return 'running'
    const waiting = waitingForCeo(requests, projectId)
    if (!waiting.length) return 'nothing-waits'
    if (lastWake && now() - lastWake < WAKE_GAP_MS) return 'too-soon'
    lastWake = now()
    deps.record('ceo.board-wake', 'ok', { requests: waiting.length, state })
    try { await deps.ensure() } catch (e) { // recorded through deps.record (the ops log), never silent
      deps.record('ceo.board-wake', 'failed', { error_class: e instanceof Error ? e.constructor.name : typeof e })
    }
    return 'woken'
  }

  return { keep, wake }
}
// #endregion ceo-board-keeper

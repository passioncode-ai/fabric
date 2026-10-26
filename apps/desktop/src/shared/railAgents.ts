// #region rail-agents — docs: docs/ux/2026-10-26-simple-fabric.md#1-the-left-column
/**
 * The left column's «Агенты» view (0.3.14, the simple Fabric, docs/ux/2026-10-26-simple-fabric.md §1 item 4): every
 * agent at work now (`work.home`'s `live`), one row each, with its runner, its project and the git branch it works on.
 * Sorted by project name in the locale's collation, an agent with no project last, then by its newest sign of life.
 * The state is what Fabric observes (a sign within the window, else quiet), never the agent's own claim. The branch is
 * the one Fabric read from the folder of a console it holds (`main/agentBranches.ts`); any other row carries null and
 * the column says «ветка неизвестна» (open choice 3: a terminal-joined agent's branch is 0.3.15's).
 * An agent only installed, idle or disconnected is not here: Настройки lists those.
 */
import type { LiveAgent } from './homeLive.ts'
import { nameCollator } from './railProjects.ts'
import { sessionStatus, type SessionStatus } from './sessionStatus.ts'

export interface RailAgent {
  sessionId: string
  runner: string | null
  projectId: string | null
  projectName: string | null
  branch: string | null
  state: 'working' | 'quiet'
  /** Its status word and colour (the operator's second review, R-19, `sessionStatus.ts`). */
  status: SessionStatus
  /** Its newest sign of life, else when it started. */
  heardAt: string
  /** Fabric holds its console. */
  console: boolean
}

const time = (iso: string | null | undefined): number => {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isFinite(t) ? t : 0
}

export function railAgents(live: readonly LiveAgent[], locale: string, terminals?: ReadonlyArray<{ sessionId: string; state: 'running' | 'idle' | 'ended'; exitCode: number | null }> | null): RailAgent[] {
  const termOf = new Map((terminals ?? []).map((x) => [x.sessionId, x]))
  const collator = nameCollator(locale)
  return live
    .map((a): RailAgent => ({
      sessionId: a.sessionId,
      runner: a.agent,
      projectId: a.projectId,
      projectName: a.projectName,
      branch: typeof a.branch === 'string' && a.branch.trim() ? a.branch.trim() : null,
      state: a.stale ? 'quiet' : 'working',
      status: sessionStatus({ stale: a.stale, terminal: a.console ? (termOf.get(a.sessionId) ?? null) : null }),
      heardAt: a.lastSignAt ?? a.startedAt,
      console: a.console
    }))
    .sort((a, b) => {
      if (a.projectName === null || b.projectName === null) {
        if (a.projectName !== b.projectName) return a.projectName === null ? 1 : -1
      } else {
        const byName = collator.compare(a.projectName, b.projectName)
        if (byName) return byName
      }
      return time(b.heardAt) - time(a.heardAt) || (a.sessionId < b.sessionId ? -1 : 1)
    })
}
// #endregion rail-agents

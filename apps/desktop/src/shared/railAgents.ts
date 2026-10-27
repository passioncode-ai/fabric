// #region rail-agents — docs: docs/ux/2026-10-26-simple-fabric.md#1-the-left-column
/**
 * The left column's «Агенты» view (0.3.14, the simple Fabric, docs/ux/2026-10-26-simple-fabric.md §1 item 4): every
 * agent at work now (`work.home`'s `live`), one row each, with its runner, its project and the git branch it works on.
 * Sorted by project name in the locale's collation, an agent with no project last, then by its newest sign of life.
 * The state is what Fabric observes (a sign within the window, else quiet); the status word is `agentStatus`, the one
 * every screen uses (the 0.3.14 review, iteration 2, ER-18). The branch is
 * the one Fabric read from the folder of a console it holds (`main/agentBranches.ts`); any other row carries null and
 * the column says «ветка неизвестна» (open choice 3: a terminal-joined agent's branch belongs to the release of 2026-11-05, CO-459).
 * An agent only installed, idle or disconnected is not here: Настройки lists those. The mockup parity (home gap D3): when
 * the reading judged work, an agent merely connected (fabric-mcp's keep-alive and nothing else) is not here either; an
 * agent at work, and a quiet one that still holds its task, are (`onWorkRow`, the same rule as «В работе»). The project
 * is printed by its display name (`HomeView.displayNames`).
 */
import type { LiveAgent } from './homeLive.ts'
import { nameCollator } from './railProjects.ts'
import { projectDisplayName, type DisplayNames } from './projectDisplayName.ts'
import { onWorkRow } from './homeProjects.ts'
import { agentStatus, type SessionStatus, type StatusTerminal } from './sessionStatus.ts'

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

export function railAgents(
  live: readonly LiveAgent[],
  locale: string,
  terminals?: ReadonlyArray<StatusTerminal & { sessionId: string }> | null,
  names?: DisplayNames | null
): RailAgent[] {
  const termOf = new Map((terminals ?? []).map((x) => [x.sessionId, x]))
  const collator = nameCollator(locale)
  return live
    .filter(onWorkRow)
    .map((a): RailAgent => ({
      sessionId: a.sessionId,
      runner: a.agent,
      projectId: a.projectId,
      // The one name every screen prints (the mockup parity, rail gap 15).
      projectName: a.projectName === null ? null : projectDisplayName({ id: a.projectId, name: a.projectName }, names),
      branch: typeof a.branch === 'string' && a.branch.trim() ? a.branch.trim() : null,
      state: a.stale ? 'quiet' : 'working',
      // ER-18: the same function and inputs as «В работе» and the agent page.
      status: agentStatus(a, termOf.get(a.sessionId) ?? null),
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

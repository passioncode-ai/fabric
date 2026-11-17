// #region console-tabs — docs: docs/ux/scenarios.md#scn-172-keep-several-consoles-open-as-tabs-along-the-top-and-switch-between-them
// A coding agent's console opens INSIDE Fabric (OF-03, SCN-172): every "open the console" control in the main window
// asks the shell through this context, and the shell adds a tab along the top and shows the console in the content
// area. The session lives in the main process (ADR-0031 §2), so a tab is only a view of it: closing the tab never ends
// the session.
//
// Outside the shell (a component rendered on its own, a detached window) there is no provider, and the call falls back
// to the separate console window, which is what every control did before. That keeps one answer to "what does open
// the console do here" per surface, and no control has to know which one it is in.

import { createContext, useContext } from 'react'
import type { ProjectRow, TerminalSession } from '../../shared/types'
import { projectDisplayName } from '../../shared/projectDisplayName.ts'

/** Opens one session's console. Resolves once it is shown; rejects with why it could not be. */
export type OpenConsole = (sessionId: string) => Promise<void>

const separateWindow: OpenConsole = (sessionId) => window.fabric.windows.openSession(sessionId)

export const OpenConsoleContext = createContext<OpenConsole | null>(null)

/** The shell's way of opening a console, or the separate window where there is no shell. */
export function useOpenConsole(): OpenConsole {
  return useContext(OpenConsoleContext) ?? separateWindow
}

/**
 * The open consoles with one more: in the order they were opened, never twice. A second open of a session already
 * open leaves the list as it is (the shell then only switches to its tab).
 */
export function withConsole(open: readonly string[], sessionId: string): string[] {
  return open.includes(sessionId) ? [...open] : [...open, sessionId]
}

/** The open consoles without one. Only the tab goes: the session itself keeps running. */
export function withoutConsole(open: readonly string[], sessionId: string): string[] {
  return open.filter((id) => id !== sessionId)
}

/**
 * Where the shell goes when the console on screen is closed: the tab beside it (the one after, else the one before),
 * or null when it was the last console, and the shell goes back to where the person was before.
 */
export function neighbourOf(open: readonly string[], sessionId: string): string | null {
  const at = open.indexOf(sessionId)
  if (at < 0) return null
  return open[at + 1] ?? open[at - 1] ?? null
}

/**
 * Drops the tabs of sessions the main process no longer holds (dismissed or reaped), but only those that were seen in
 * an earlier list: a console opened a moment after its session started may not be in the list yet, and taking its tab
 * away then would be a tab that vanishes as it appears.
 */
export function prunedConsoles(
  open: readonly string[],
  sessions: readonly TerminalSession[] | null,
  seen: ReadonlySet<string>
): string[] {
  if (sessions === null) return [...open]
  const held = new Set(sessions.map((s) => s.sessionId))
  return open.filter((id) => held.has(id) || !seen.has(id))
}

/**
 * What a console's tab is called: its project's name, else the folder's last part, else null while the session has
 * not been read yet (the tab then says it is reading).
 */
export function consoleTitleOf(
  session: TerminalSession | undefined,
  projects: readonly ProjectRow[] | null
): string | null {
  if (!session) return null
  const project = (projects ?? []).find((p) => p.id === session.projectId)
  if (project) return projectDisplayName(project)
  const parts = session.cwd.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? session.cwd
}

/**
 * The operator, 2026-11-17: two consoles of one project and one coding agent read as two identical tabs. When open
 * tabs share a name and a coding agent, each of them is told apart by the clock time its session started, to the
 * minute, or to the second when two of them started in the same minute; a tab whose name is its own gets nothing.
 * `clock(iso, seconds)` formats a start in the person's language. Answers sessionId -> the time to show.
 */
export function startClocks(
  tabs: readonly { sessionId: string; title: string | null; runner: string | null; startedAt: string | null }[],
  clock: (iso: string, seconds: boolean) => string
): Map<string, string> {
  const groups = new Map<string, { sessionId: string; startedAt: string }[]>()
  for (const tab of tabs) {
    if (tab.title === null || tab.startedAt === null) continue
    const key = `${tab.title}\u0000${tab.runner ?? ''}`
    groups.set(key, [...(groups.get(key) ?? []), { sessionId: tab.sessionId, startedAt: tab.startedAt }])
  }
  const out = new Map<string, string>()
  for (const group of groups.values()) {
    if (group.length < 2) continue
    const minutes = group.map((g) => clock(g.startedAt, false))
    const clash = new Set(minutes.filter((m, i) => minutes.indexOf(m) !== i))
    group.forEach((g, i) => out.set(g.sessionId, clash.has(minutes[i]) ? clock(g.startedAt, true) : minutes[i]))
  }
  return out
}

/**
 * The console's folder as its bar shows it: the last two parts after «…/» when the path is longer, the whole path
 * otherwise; the bar keeps the whole path in its tooltip (the operator, 2026-11-17).
 */
export function shortFolder(cwd: string): string {
  const parts = cwd.split(/[\\/]/).filter(Boolean)
  if (parts.length <= 2) return cwd
  return `…/${parts.slice(-2).join('/')}`
}

const STORE_KEY = 'fabric.consoles.v1'

/**
 * The open consoles, kept for a reload of this window only (sessionStorage): sessions do not outlive the app, so a list
 * kept on disk across a restart would bring back tabs of sessions that are gone. A store that cannot be read or written
 * (a sandboxed renderer without storage) keeps the list in memory, said nowhere because nothing the person did is lost.
 */
export function readOpenConsoles(): string[] {
  try {
    const raw = window.sessionStorage?.getItem(STORE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string' && x.length > 0) : []
  } catch {
    return []
  }
}

export function writeOpenConsoles(open: readonly string[]): void {
  try {
    window.sessionStorage?.setItem(STORE_KEY, JSON.stringify(open))
  } catch {
    // in memory only; see readOpenConsoles
  }
}
// #endregion console-tabs

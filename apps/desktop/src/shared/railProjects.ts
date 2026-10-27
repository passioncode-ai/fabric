// #region rail-projects — docs: docs/ux/scenarios.md#scn-162-move-between-the-five-places-and-the-projects-from-the-rail
/**
 * The projects list on the rail (SCN-162 step 2, amended 0.3.14 by the simple Fabric,
 * docs/ux/2026-10-26-simple-fabric.md §1 and its open choice 1): every active project ALPHABETICALLY in the locale's
 * collation (`Intl.Collator`, numeric, case and accent folded), Russian and Latin names together; a favourite keeps its
 * star as a mark and moves nowhere. An archived project is not on the rail. Two projects of one name keep a stable
 * order by id. Pure: the caller hands in the projects as read, the pins as read and the window's locale.
 *
 * Amended 2026-10-27 (the mockup parity, spec §1 item 3): the rail shows the projects AT WORK (`projectsAtWork`), and a
 * last row «Все проекты · N» unfolds this whole list in place. The name printed is `projectDisplayName`'s.
 */
import { projectDisplayName } from './projectDisplayName.ts'

export interface RailProjectInput {
  id: string
  name: string
  /** The name main resolved for the row (`ProjectRow.displayName`); absent: the stored name. */
  displayName?: string | null
  status: 'active' | 'archived'
  created_at: string
}

export interface RailProject {
  id: string
  /** The name printed (`projectDisplayName`). */
  name: string
  /** The stored name (`projects.name`), the project's identity: the row's hover. */
  slug: string
  favourite: boolean
}

const time = (iso: string | undefined): number => {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isFinite(t) ? t : 0
}

/** The locale's collation for names, folding case and accents and reading digits as numbers. */
export function nameCollator(locale: string): Intl.Collator {
  try {
    return new Intl.Collator(locale, { sensitivity: 'base', numeric: true })
  } catch {
    return new Intl.Collator('en', { sensitivity: 'base', numeric: true })
  }
}

export function railProjects(
  projects: readonly RailProjectInput[],
  pins: readonly string[],
  locale: string
): RailProject[] {
  const collator = nameCollator(locale)
  const pinned = new Set(pins)
  return projects
    .filter((p) => p.status !== 'archived')
    .map((p) => ({ id: p.id, name: projectDisplayName(p), slug: p.name, favourite: pinned.has(p.id) }))
    .sort((a, b) => collator.compare(a.name, b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** What says a project is at work, all of it already read by the shell (no read of its own). */
export interface RailWork {
  /** Projects where an agent works now (`liveProjectsOf`). */
  live: ReadonlySet<string>
  /** The home reading's pulse per project (`HomeView.projects`); null while it has not answered. `atWork`, when the
   *  reading judged it, counts the agents at work; `live` alone counts every connected one (home gap D3). */
  pulses: ReadonlyArray<{ projectId: string; live: number; inWork: number; review: number; atWork?: number }> | null
  /** «Нужны вы» by project; null while unknown. */
  waiting: Readonly<Record<string, number>> | null
  /** The project on screen, which never drops off the rail under the person. */
  current: string | null
}

/**
 * The projects at work (the mockup parity, 2026-10-27, rail gap 1): an agent works there, a task is in work or in
 * review there, something there waits for the person, the person pinned it, or it is on screen. In the full list's
 * order; the rest stay one press away behind «Все проекты · N».
 */
export function projectsAtWork(rows: readonly RailProject[], work: RailWork): RailProject[] {
  const busy = new Set<string>()
  for (const p of work.pulses ?? []) if ((p.atWork ?? p.live) > 0 || p.inWork > 0 || p.review > 0) busy.add(p.projectId)
  return rows.filter((r) =>
    busy.has(r.id) || work.live.has(r.id) || (work.waiting?.[r.id] ?? 0) > 0 || r.favourite || r.id === work.current)
}

/**
 * Where an agent works now, for the rail's green dot (rail gap 4): every agent AT WORK the home reading names
 * (terminal-joined ones included; `agentWork.ts`: a keep-alive ping keeps an agent connected, never at work), and the
 * pulses that count one. A reading that did not judge work (an older main process) falls back to the agents that
 * signed within the window and Fabric's own running terminals, as before; until the reading answers, the terminals alone.
 */
export function liveProjectsOf(
  terminals: ReadonlyArray<{ projectId: string; running: boolean }> | null,
  live: ReadonlyArray<{ projectId: string | null; stale: boolean; atWork?: boolean }> | null,
  pulses: ReadonlyArray<{ projectId: string; live: number; atWork?: number }> | null
): Set<string> {
  const out = new Set<string>()
  const judged = (live ?? []).some((a) => a.atWork !== undefined) || (pulses ?? []).some((p) => p.atWork !== undefined)
  if (!judged) for (const s of terminals ?? []) if (s.running) out.add(s.projectId)
  for (const a of live ?? []) if (a.projectId && (judged ? !!a.atWork : !a.stale)) out.add(a.projectId)
  for (const p of pulses ?? []) if ((judged ? (p.atWork ?? 0) : p.live) > 0) out.add(p.projectId)
  return out
}

/** The newest event time per project, from the events the shell has read; an estate-wide event belongs to none. */
export function lastActivityOf(
  feed: ReadonlyArray<{ project_id: string | null; occurred_at: string }> | null
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const e of feed ?? []) {
    if (!e.project_id) continue
    const seen = out[e.project_id]
    if (!seen || time(e.occurred_at) > time(seen)) out[e.project_id] = e.occurred_at
  }
  return out
}
// #endregion rail-projects

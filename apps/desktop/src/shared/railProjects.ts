// #region rail-projects — docs: docs/ux/scenarios.md#scn-162-move-between-the-five-places-and-the-projects-from-the-rail
/**
 * The projects list on the rail (SCN-162 step 2, amended 0.3.14 by the simple Fabric,
 * docs/ux/2026-10-26-simple-fabric.md §1 and its open choice 1): every active project ALPHABETICALLY in the locale's
 * collation (`Intl.Collator`, numeric, case and accent folded), Russian and Latin names together; a favourite keeps its
 * star as a mark and moves nowhere. An archived project is not on the rail. Two projects of one name keep a stable
 * order by id. Pure: the caller hands in the projects as read, the pins as read and the window's locale.
 */

export interface RailProjectInput {
  id: string
  name: string
  status: 'active' | 'archived'
  created_at: string
}

export interface RailProject {
  id: string
  name: string
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
    .sort((a, b) => collator.compare(a.name, b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((p) => ({ id: p.id, name: p.name, favourite: pinned.has(p.id) }))
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

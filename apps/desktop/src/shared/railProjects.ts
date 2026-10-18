// #region rail-projects — docs: docs/ux/scenarios.md#scn-162-move-between-the-five-places-and-the-projects-from-the-rail
/**
 * The projects list on the rail (SCN-162 step 2, 0.3.7 wave 3): favourites first, in the order the person pinned
 * them, then the rest by latest activity. An archived project is not on the rail. Pure: the caller hands in the
 * projects as read, the pins as read and the latest activity per project.
 *
 * LATEST ACTIVITY is the newest journal event of the project the shell has read (`lastActivityOf`), else when the
 * project was created: a project nobody has touched since it was made sorts by its birth, never above one that moved.
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

export function railProjects(
  projects: readonly RailProjectInput[],
  pins: readonly string[],
  lastActivity: Readonly<Record<string, string>>
): RailProject[] {
  const live = projects.filter((p) => p.status !== 'archived')
  const byId = new Map(live.map((p) => [p.id, p] as const))
  const pinned = pins.filter((id, i) => byId.has(id) && pins.indexOf(id) === i)
  const pinnedSet = new Set(pinned)
  const when = (p: RailProjectInput): number => time(lastActivity[p.id]) || time(p.created_at)
  const rest = live
    .filter((p) => !pinnedSet.has(p.id))
    .sort((a, b) => when(b) - when(a) || a.name.localeCompare(b.name))
  return [
    ...pinned.map((id) => ({ id, name: byId.get(id)!.name, favourite: true })),
    ...rest.map((p) => ({ id: p.id, name: p.name, favourite: false }))
  ]
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

// #region project-names-read — docs: docs/reports/2026-10-27-mockup-parity/gaps/2026-10-27-rail.md#2-where-display-names-could-come-from
/**
 * Every active project's display name (`shared/projectDisplayName.ts#resolveDisplayName`): the projects and their
 * repositories (`project_repos.path`, whose basename is the folder, and `remote_key`) read once, matched against the
 * service descriptors the agent registry already holds. Kept for `TTL_MS`, so the home's 15 s reading does not read the
 * repositories again each time; a read that fails throws (the caller keeps the stored names and says nothing new).
 */
import { disambiguate, resolveDisplayName, type DescriptorName, type DisplayNames, type ResolvedDisplayName } from '../shared/projectDisplayName.ts'
import type { HomeView } from '../shared/homeLive.ts'

type Rows = { rows: Array<Record<string, unknown>>; failed: string | null }
type Answer = PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
interface ProjectsQuery extends Answer { eq(c: string, v: string): ProjectsQuery; limit(n: number): ProjectsQuery }
export interface NamesStore {
  select(table: string, columns: string): unknown
  selectIn(table: string, columns: string, key: string, values: string[]): Promise<Rows>
}

export const TTL_MS = 60_000
const PROJECTS = 500

const basename = (p: unknown): string | null => {
  if (typeof p !== 'string' || !p.trim()) return null
  const parts = p.replace(/[\\/]+$/, '').split(/[\\/]/)
  return parts.at(-1) || null
}

/** The display names of the given projects, from their repositories and the descriptors. Pure. */
export function displayNamesOf(
  projects: ReadonlyArray<{ id: string; name: string }>,
  repos: ReadonlyArray<{ project_id: string; path?: unknown; remote_key?: unknown }>,
  descriptors: readonly DescriptorName[]
): Record<string, ResolvedDisplayName> {
  const out: Record<string, ResolvedDisplayName> = {}
  for (const p of projects) {
    const mine = repos.filter((r) => r.project_id === p.id)
    out[p.id] = resolveDisplayName({
      name: p.name,
      folders: mine.map((r) => basename(r.path)).filter((f): f is string => !!f),
      remotes: mine.map((r) => (typeof r.remote_key === 'string' ? r.remote_key : null))
    }, descriptors)
  }
  return disambiguate(out, Object.fromEntries(projects.map((p) => [p.id, p.name])))
}

export function createDisplayNameReader(store: NamesStore, descriptors: () => readonly DescriptorName[], now: () => number = Date.now, onCapped?: (rows: number) => void) {
  let kept: { at: number; names: Record<string, ResolvedDisplayName> } | null = null
  let inFlight: Promise<Record<string, ResolvedDisplayName>> | null = null
  async function readNow(): Promise<Record<string, ResolvedDisplayName>> {
    const { data, error } = await (store.select('projects', 'id,name') as ProjectsQuery).eq('status', 'active').limit(PROJECTS)
    if (error) throw new Error(`the projects could not be read: ${error.message}`)
    const projects = (data ?? []) as Array<{ id: string; name: string }>
    // Past the bound the rest print their slug; said once per reading, never silent (ER-6).
    if (projects.length >= PROJECTS) onCapped?.(projects.length)
    const repos = await store.selectIn('project_repos', 'project_id,path,remote_key', 'project_id', projects.map((p) => p.id))
    if (repos.failed) throw new Error(`the projects' repositories could not be read: ${repos.failed}`)
    return displayNamesOf(projects, repos.rows as Array<{ project_id: string }>, descriptors())
  }
  return {
    /** The names, read at most once per `TTL_MS`. A read that fails keeps the last names it had, so a passing failure
     *  never turns «Research Agent» back into `research-agent` on every screen (the 0.3.15 review, iteration 1, ER-6);
     *  `onStale` hears why. With nothing kept, the failure is thrown. */
    async read(onStale?: (e: unknown) => void): Promise<DisplayNames> {
      if (kept && now() - kept.at < TTL_MS) return kept.names
      inFlight ??= readNow().then((names) => { kept = { at: now(), names }; return names }).finally(() => { inFlight = null })
      try {
        return await inFlight
      } catch (e) {
        // Not silent: thrown with nothing kept, else told to `onStale`, which main logs as projects.display-names-stale.
        if (!kept) throw e
        onStale?.(e)
        return kept.names
      }
    }
  }
}

/** The home's reading with every project's display name; a read that fails leaves it without them. */
export async function withDisplayNames(view: HomeView, read: () => Promise<DisplayNames>, onError: (e: unknown) => void): Promise<HomeView> {
  try {
    return { ...view, displayNames: { ...(await read()) } }
  } catch (e) {
    // Not silent: `onError` is main's ops.failed('work.display-names-unread'); the screens print the stored names.
    onError(e)
    return view
  }
}
// #endregion project-names-read

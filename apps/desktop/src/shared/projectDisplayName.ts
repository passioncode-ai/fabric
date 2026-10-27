// #region project-display-name — docs: docs/reports/2026-10-27-mockup-parity/gaps/rail.md#2-where-display-names-could-come-from
/**
 * The one name a screen prints for a project (the mockup parity, 2026-10-27, rail gaps 2 and 15). Every place in the
 * shell that shows a project's name (the rail's rows, an agent's row, a console's tab, the top bar's title) asks here, so
 * a display name changes this function and nothing else.
 *
 * Where the name comes from, in order (gap map §2):
 *   1. a future `display_name` on the project (TODO: a nullable column and a per-concern projector function written by
 *      `fabric_project_profile` and the rename act; no migration yet);
 *   2. the Fabric service descriptor whose `id` equals the project's folder name, or whose `source.repository` is one of
 *      the project's repository remotes; the `default` instance first (`resolveDisplayName`, fed by main from
 *      `main/agentRegistry.ts`);
 *   3. the slug humanised («research-agent» → «Research Agent»), marked `derived`, never presented as the project's own.
 * The slug (`projects.name`) stays the project's identity; nothing here renames it.
 */
export interface NamedProject {
  /** The project's id, when the caller has it; the display-name lookup keys on it. */
  id?: string | null
  /** The project's stored name (`projects.name`). */
  name: string
  /** A display name main resolved for this row (`ProjectRow.displayName`); wins over the lookup. */
  displayName?: string | null
}

/** A resolved display name and where it came from. `derived`: a humanised slug, a guess the screens may mark. */
export interface ResolvedDisplayName {
  name: string
  from: 'project' | 'descriptor' | 'slug'
  derived: boolean
}

export type DisplayNames = Readonly<Record<string, ResolvedDisplayName>>

/** The name to print: the row's resolved display name, else the one `names` holds for its id, else the stored name. */
export function projectDisplayName(project: NamedProject, names?: DisplayNames | null): string {
  const own = (project.displayName ?? '').trim()
  if (own) return own
  const looked = project.id && names ? names[project.id] : undefined
  return looked?.name || project.name
}

/** One service descriptor as the registry reads it (`main/agentRegistry.ts#RegistryEntry`). */
export interface DescriptorName {
  id: string
  instance: string | null
  name: string
  repository: string | null
  kind?: 'service' | 'provider'
}

/** A repository address reduced to `host/owner/name`, lower case, without scheme, user, `.git` or trailing slash. */
export function repoKey(url: string | null | undefined): string | null {
  let s = (url ?? '').trim().toLowerCase()
  if (!s) return null
  s = s.replace(/^git\+/, '').replace(/^[a-z]+:\/\//, '').replace(/^[^@/]+@/, '').replace(/:(?!\d)/, '/')
  s = s.replace(/\.git$/, '').replace(/\/+$/, '')
  return s.includes('/') ? s : null
}

/** «research-agent» → «Research Agent»; «agent-stack» → «Agent Stack». Split on `-`, `_` and `.`; each word capitalised. */
export function humaniseSlug(slug: string): string {
  const words = slug.split(/[-_.\s]+/).filter(Boolean)
  return words.length ? words.map((w) => w[0].toUpperCase() + w.slice(1)).join(' ') : slug
}

const rank = (d: DescriptorName): number => (d.instance === 'default' ? 0 : d.instance === null ? 1 : 2)

/**
 * A project's display name from the sources above. `folders` are the basenames of its repository paths, `remotes` its
 * repositories' remotes (`project_repos.remote_key`). A descriptor matched by its id is preferred over one matched by
 * its repository; among equals the `default` instance, then by key.
 */
export function resolveDisplayName(
  project: { name: string; displayName?: string | null; folders?: readonly string[]; remotes?: ReadonlyArray<string | null> },
  descriptors: readonly DescriptorName[]
): ResolvedDisplayName {
  const own = (project.displayName ?? '').trim()
  if (own) return { name: own, from: 'project', derived: false }
  const folders = new Set([project.name, ...(project.folders ?? [])].map((f) => f.trim().toLowerCase()).filter(Boolean))
  const remotes = new Set((project.remotes ?? []).map(repoKey).filter((r): r is string => !!r))
  const named = descriptors.filter((d) => d.name.trim())
  const order = (a: DescriptorName, b: DescriptorName): number => rank(a) - rank(b) || `${a.id}.${a.instance ?? ''}`.localeCompare(`${b.id}.${b.instance ?? ''}`)
  const byId = named.filter((d) => folders.has(d.id.toLowerCase())).sort(order)[0]
  const byRepo = byId ? undefined : named.filter((d) => { const k = repoKey(d.repository); return !!k && remotes.has(k) }).sort(order)[0]
  const hit = byId ?? byRepo
  if (hit) return { name: hit.name.trim(), from: 'descriptor', derived: false }
  return { name: humaniseSlug(project.name), from: 'slug', derived: true }
}
// #endregion project-display-name

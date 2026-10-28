// #region project-display-name — docs: docs/reports/2026-10-27-mockup-parity/gaps/2026-10-27-rail.md#2-where-display-names-could-come-from
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
  /** For a descriptor: matched by the project's own name, by one of its remotes, or by another of its folders (CO-481). */
  via?: 'own' | 'repository' | 'folder'
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
/** Words a slug carries that read as letters, not as a word (the 0.3.15 review, iteration 1, UX-9). */
const ACRONYMS = new Set(['ai', 'api', 'aso', 'cli', 'css', 'db', 'gpt', 'html', 'id', 'ios', 'llm', 'mcp', 'os', 'pr', 'sdk', 'seo', 'sms', 'sql', 'tv', 'ui', 'ux', 'vpn', 'xr'])

export function humaniseSlug(slug: string): string {
  const words = slug.split(/[-_.\s]+/).filter(Boolean)
  return words.length ? words.map((w) => ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)).join(' ') : slug
}

const rank = (d: DescriptorName): number => (d.instance === 'default' ? 0 : d.instance === null ? 1 : 2)

/**
 * A project's display name from the sources above. `folders` are the basenames of its repository paths, `remotes` its
 * repositories' remotes (`project_repos.remote_key`). The project's own descriptor (its id is the project's name) comes
 * first, then one whose repository is a remote of the project, then one whose id is another of its folders, which may be
 * a sibling repository's agent (CO-481, the 0.3.15 review's DA-18); among equals the `default` instance, then by key.
 */
export function resolveDisplayName(
  project: { name: string; displayName?: string | null; folders?: readonly string[]; remotes?: ReadonlyArray<string | null> },
  descriptors: readonly DescriptorName[]
): ResolvedDisplayName {
  const own = (project.displayName ?? '').trim()
  if (own) return { name: own, from: 'project', derived: false }
  const self = project.name.trim().toLowerCase()
  const folders = new Set((project.folders ?? []).map((f) => f.trim().toLowerCase()).filter((f) => f && f !== self))
  const remotes = new Set((project.remotes ?? []).map(repoKey).filter((r): r is string => !!r))
  const named = descriptors.filter((d) => d.name.trim())
  const order = (a: DescriptorName, b: DescriptorName): number => rank(a) - rank(b) || `${a.id}.${a.instance ?? ''}`.localeCompare(`${b.id}.${b.instance ?? ''}`)
  const first = (pick: (d: DescriptorName) => boolean): DescriptorName | undefined => named.filter(pick).sort(order)[0]
  const tiers: Array<[NonNullable<ResolvedDisplayName['via']>, (d: DescriptorName) => boolean]> = [
    ['own', (d) => d.id.toLowerCase() === self],
    ['repository', (d) => { const k = repoKey(d.repository); return !!k && remotes.has(k) }],
    ['folder', (d) => folders.has(d.id.toLowerCase())]
  ]
  for (const [via, pick] of tiers) {
    const hit = first(pick)
    if (hit) return { name: hit.name.trim(), from: 'descriptor', derived: false, via }
  }
  return { name: humaniseSlug(project.name), from: 'slug', derived: true }
}
/**
 * Two projects that would print one name are told apart (CO-481): the one whose own descriptor it is keeps the name, and
 * every other carries its slug after it, «Research Agent (research-agent-copy)». When none owns it, all of them do.
 */
export function disambiguate(
  resolved: Readonly<Record<string, ResolvedDisplayName>>,
  slugs: Readonly<Record<string, string>>
): Record<string, ResolvedDisplayName> {
  const groups = new Map<string, string[]>()
  for (const [id, r] of Object.entries(resolved)) {
    const k = r.name.trim().toLowerCase()
    groups.set(k, [...(groups.get(k) ?? []), id])
  }
  const out: Record<string, ResolvedDisplayName> = { ...resolved }
  for (const ids of groups.values()) {
    if (ids.length < 2) continue
    const owners = ids.filter((id) => resolved[id].from === 'project' || resolved[id].via === 'own')
    const keeper = owners.length === 1 ? owners[0] : null
    for (const id of ids) {
      const slug = slugs[id]
      if (id === keeper || !slug || slug.trim().toLowerCase() === resolved[id].name.trim().toLowerCase()) continue
      out[id] = { ...resolved[id], name: `${resolved[id].name} (${slug})` }
    }
  }
  return out
}
// #endregion project-display-name

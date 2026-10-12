// #region fabric-link-route — docs: docs/ux/scenarios.md#scn-142-open-fabric-from-a-products-button-in-that-products-project-and-go-on-in-a-coding-agent
/**
 * Where a `fabric://` link opens Fabric (contract DEC-0040, SCN-142). A product's button sends the operator here with the
 * product's service id and, when it knows it, the project. Fabric finds the project itself: by the link's project (id or
 * name), else by the service's registered repository (`source.repository`) matched against the remotes of each project's
 * repositories. A link opens a view and nothing else: it starts no session and acts on no words (the contract refuses
 * a link that carries any), so a refused or unmatched link opens home and says why.
 *
 * Until the manager's conversation lands (0.4.0 wave 5, REQ-16/REQ-42) a chat link opens the project with a notice that
 * the conversation is coming; a session link opens the project ready to start one.
 */
import { parseFabricLink } from './contract/fabricLinks.ts'

export interface LinkRouteDeps {
  projects: ReadonlyArray<{ id: string; name: string; remotes: ReadonlyArray<string | null> }>
  /** The registry's services: `key` is `id.instance`. */
  services: ReadonlyArray<{ key: string; id: string; repository: string | null }>
}

export type LinkNotice =
  | 'conversation-soon'
  | 'start-session'
  | 'link-refused'
  | 'project-unknown'
  | 'service-unknown'
  | 'service-in-no-project'
  | 'service-in-many-projects'

export interface LinkRoute {
  route: { kind: 'home' } | { kind: 'project'; projectId: string }
  notice: LinkNotice
}

/** One repository however it is written: host and path, lower-case, without `.git` or a trailing slash; null if not one. */
export function normaliseRepository(url: string): string | null {
  const s = url.trim()
  const scp = /^[\w.-]+@([\w.-]+):(.+)$/.exec(s)
  let host: string
  let pathname: string
  if (scp) {
    host = scp[1]
    pathname = scp[2]
  } else {
    let u: URL
    try {
      u = new URL(s)
    } catch {
      // Not a URL and not git's scp form: no repository to match, so nothing matches it.
      return null
    }
    if (!u.hostname) return null
    host = u.hostname
    pathname = u.pathname
  }
  const path = pathname.replace(/^\/+/, '').replace(/\/+$/, '').replace(/\.git$/i, '')
  if (!path.includes('/')) return null
  return `${host}/${path}`.toLowerCase()
}

const home = (notice: LinkNotice): LinkRoute => ({ route: { kind: 'home' }, notice })

function projectByRef(ref: string, deps: LinkRouteDeps): string | null {
  const byId = deps.projects.find((p) => p.id === ref)
  if (byId) return byId.id
  const named = deps.projects.filter((p) => p.name.toLowerCase() === ref.toLowerCase())
  return named.length === 1 ? named[0].id : null
}

export function routeForLink(url: string, deps: LinkRouteDeps): LinkRoute {
  const parsed = parseFabricLink(url)
  if (!parsed.ok) return home('link-refused')
  const link = parsed.link
  if (link.action === 'session.new') {
    const projectId = projectByRef(link.project, deps)
    return projectId ? { route: { kind: 'project', projectId }, notice: 'start-session' } : home('project-unknown')
  }
  if (link.project !== undefined) {
    const projectId = projectByRef(link.project, deps)
    return projectId ? { route: { kind: 'project', projectId }, notice: 'conversation-soon' } : home('project-unknown')
  }
  const service = deps.services.find((s) => s.key === link.service) ?? deps.services.find((s) => s.id === link.service)
  if (!service) return home('service-unknown')
  const repo = service.repository ? normaliseRepository(service.repository) : null
  if (!repo) return home('service-in-no-project')
  const holders = deps.projects.filter((p) => p.remotes.some((r) => r !== null && normaliseRepository(r) === repo))
  if (holders.length === 0) return home('service-in-no-project')
  if (holders.length > 1) return home('service-in-many-projects')
  return { route: { kind: 'project', projectId: holders[0].id }, notice: 'conversation-soon' }
}
// #endregion fabric-link-route

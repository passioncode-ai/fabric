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
  projects: ReadonlyArray<{ id: string; name: string; remotes: ReadonlyArray<string | null>; folders?: ReadonlyArray<string> }>
  /** The registry's services: `key` is `id.instance`. */
  services: ReadonlyArray<{ key: string; id: string; repository: string | null }>
  /** The Fabric console a session id names: the console's own id, or the runner session id one runs (DEC-0189 SL-4);
   *  null when no console Fabric holds is that session. */
  consoleOf?(sessionId: string): string | null
}

export type LinkNotice =
  | 'conversation-soon'
  | 'start-session'
  | 'link-refused'
  | 'project-unknown'
  | 'service-unknown'
  | 'service-in-no-project'
  | 'service-in-many-projects'
  /** The projects or their repositories could not be read: said, never routed against an empty list (ER-1). */
  | 'link-unreadable'
  /** `session/open` of a console Fabric holds: its console opens (DEC-0189 SL-4). */
  | 'open-session'
  /** `session/open` of a session no Fabric console holds: Агенты shows this computer's sessions, it among them. */
  | 'session-outside'
  /** `session/continue`: the person confirms the move into a Fabric console (DEC-0189 SL-5). */
  | 'continue-session'

export interface LinkRoute {
  route: { kind: 'home' } | { kind: 'project'; projectId: string } | { kind: 'agents'; session: string | null }
  /** `session/continue`: the runner session the person is asked to continue in Fabric. */
  continueSession?: string
  /** The app the link came from (`from`, DEC-0189 SL-1): a claim of the page, recorded, never trusted for anything. */
  from?: string
  notice: LinkNotice
  /** How many earlier links waited past the limit and were not opened (0.3.5 review i2 ER-7); said beside the notice. */
  dropped?: number
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

/** The last segment of a folder, either separator. */
const folderLeaf = (folder: string): string => folder.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? ''

/** A project by its id, else its name, else the name of one of its folders (board thread 3ca40854, 2026-11-19: an app
 *  that knows a session's folder names its repository folder, since a link carries no path). Two projects a name could
 *  mean is no project: the link opens home and says it is unknown. */
function projectByRef(ref: string, deps: LinkRouteDeps): string | null {
  const byId = deps.projects.find((p) => p.id === ref)
  if (byId) return byId.id
  const lower = ref.toLowerCase()
  const named = deps.projects.filter((p) => p.name.toLowerCase() === lower)
  if (named.length) return named.length === 1 ? named[0].id : null
  const byFolder = deps.projects.filter((p) => (p.folders ?? []).some((f) => folderLeaf(f).toLowerCase() === lower))
  return byFolder.length === 1 ? byFolder[0].id : null
}

export function routeForLink(url: string, deps: LinkRouteDeps): LinkRoute {
  const parsed = parseFabricLink(url)
  if (!parsed.ok) return home('link-refused')
  const link = parsed.link
  const from = link.action !== 'chat' && link.from ? { from: link.from } : {}
  if (link.action === 'session.open') {
    const console = deps.consoleOf?.(link.session) ?? null
    return console ? { route: { kind: 'agents', session: console }, notice: 'open-session', ...from }
      : { route: { kind: 'agents', session: null }, notice: 'session-outside', ...from }
  }
  if (link.action === 'session.continue') {
    // A session a Fabric console already runs is opened, not moved again.
    const console = deps.consoleOf?.(link.session) ?? null
    return console ? { route: { kind: 'agents', session: console }, notice: 'open-session', ...from }
      : { route: { kind: 'agents', session: null }, notice: 'continue-session', continueSession: link.session, ...from }
  }
  if (link.action === 'session.new') {
    const projectId = projectByRef(link.project, deps)
    return projectId ? { route: { kind: 'project', projectId }, notice: 'start-session', ...from } : home('project-unknown')
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

export interface LinkReads {
  /** The estate's active projects; throws when they cannot be read. */
  projects(): Promise<ReadonlyArray<{ id: string; name: string }>>
  /** A project's repository remotes; throws when they cannot be read. */
  remotes(projectId: string): Promise<ReadonlyArray<string | null>>
  /** A project's repository folders, for a link that names one by its last segment; none when not given. */
  folders?(projectId: string): Promise<ReadonlyArray<string>>
  services(): LinkRouteDeps['services']
  /** See `LinkRouteDeps.consoleOf`. */
  consoleOf?(sessionId: string): string | null
  /** Where a failed read goes: the log, never the window (the notice says it there). */
  failed(e: unknown): void
}

/**
 * Read what a link needs and route it (0.3.5 review ER-1, UX-14). A list that could not be read is never an empty
 * one: routing a failed read against `[]` said "a project that is not in your list" and pushed the person to add a
 * duplicate, and a read that threw only logged, so the click did nothing. Every failure is `link-unreadable`, at home.
 * A link Fabric refuses is refused before anything is read.
 */
export async function resolveLink(url: string, reads: LinkReads): Promise<LinkRoute> {
  if (!parseFabricLink(url).ok) return home('link-refused')
  try {
    const rows = await reads.projects()
    const projects = await Promise.all(rows.map(async (p) => ({ id: p.id, name: p.name, remotes: await reads.remotes(p.id), folders: (await reads.folders?.(p.id)) ?? [] })))
    return routeForLink(url, { projects, services: reads.services(), ...(reads.consoleOf ? { consoleOf: reads.consoleOf } : {}) })
  } catch (e) {
    reads.failed(e)
    return home('link-unreadable')
  }
}

/**
 * What the main process does with a link as it arrives (0.3.5 review ER-2): before startup has finished it waits
 * (startup opens the window, whose first load opens what waited); with no window — macOS after the last one closed,
 * a `--background` launch, a second instance on Windows or Linux — it waits for the window it opens; otherwise it opens.
 */
export function linkWindowPlan(s: { startupDone: boolean; hasWindow: boolean }): 'hold' | 'hold-and-open-window' | 'open' {
  if (!s.startupDone) return 'hold'
  return s.hasWindow ? 'open' : 'hold-and-open-window'
}
// #endregion fabric-link-route

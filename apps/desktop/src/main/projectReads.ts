// #region project-reads — docs: docs/evidence/plans/2026-11-17-board-apart-waves.md#3-the-waves
/**
 * The project reads the hub's admission and enrolment ask of the database (ADR-0195 W2c.1a): a project, its
 * repositories, the folders each project holds, the folders the person detached, a project for an enrolment, and the
 * repositories with their remotes and agent-sync's lease refs. Until W2c.1a these were functions of `main/index.ts`
 * over its module `store`; they moved here as they stood so the window and the board's entry (`boardMain.ts`) read the
 * same rows the same way. `store` is read per call: the window's store is made at bootstrap and made again on a Retry.
 */
import { createLeaseRefReader, lsRemoteLeases, originOf, type LeaseRefDeps, type LeaseRefsRead } from './agentSyncLeases.ts'
import { ops } from './opsSink.ts'
import type { ScopedStore } from './scopedStore.ts'
import { indexImported } from './startChoices.ts'
import type { ProjectRow, RepoRow } from '../shared/types.ts'

/** How long a repository's remote is kept: the backlog links resolve by it (REQ-08). */
export const REMOTE_TTL_MS = 300_000

export interface ProjectReads {
  read(id: string): Promise<ProjectRow | null>
  listRepos(projectId: string): Promise<RepoRow[]>
  readImported(): Promise<Map<string, { id: string; name: string }[]>>
  listRemovals(): Promise<Array<{ id: string; projectId: string; path: string | null; remoteKey: string | null; kind: 'primary' | 'checkout' | 'worktree' | null }>>
  /** A project of this estate by id, for an enrollment ask (ADR-0134); null when there is none. A failed read throws. */
  enroll(id: string): Promise<{ id: string; name: string } | null>
  projectRepos(projectId: string): Promise<Array<{ path: string; is_primary: boolean }>>
  cachedOrigin(repoPath: string): Promise<string | null>
  reposWithRemotes(projectId: string): Promise<Array<{ path: string; remote: string | null }>>
  leaseRefs(projectId: string): Promise<(LeaseRefsRead & { repository: string }) | null>
}

export function createProjectReads(d: {
  store: () => ScopedStore
  originOf?: LeaseRefDeps['remoteOf']
  lsRemote?: LeaseRefDeps['lsRemote']
  now?: () => number
}): ProjectReads {
  const remoteOf = d.originOf ?? originOf
  const now = d.now ?? Date.now
  // agent-sync's lease refs, read-only and kept a minute (REQ-08); the remotes the backlog links resolve by, kept five.
  const leaseRefReader = createLeaseRefReader({ remoteOf, lsRemote: d.lsRemote ?? lsRemoteLeases })
  const remoteCache = new Map<string, { at: number; remote: Promise<string | null> }>()
  const cachedOrigin = (repoPath: string): Promise<string | null> => {
    const hit = remoteCache.get(repoPath)
    if (hit && now() - hit.at < REMOTE_TTL_MS) return hit.remote
    // A remote that cannot be read resolves by folder only; the address still names the repository by its folder.
    const remote = remoteOf(repoPath).catch((e) => {
      ops.failed('work.origin-read', e as Error, { note: 'this repository resolves backlog rows by its folder only' })
      return null
    })
    remoteCache.set(repoPath, { at: now(), remote })
    return remote
  }
  const projectRepos = async (projectId: string): Promise<Array<{ path: string; is_primary: boolean }>> => {
    const { data, error } = await d.store().select('project_repos', 'path,is_primary').eq('project_id', projectId)
    if (error) throw new Error(`the project's repositories could not be read: ${error.message}`)
    return (data ?? []) as Array<{ path: string; is_primary: boolean }>
  }
  return {
    async read(id) {
      const { data, error } = await d.store().select('projects', '*').eq('id', id).maybeSingle()
      if (error) throw new Error(`project read failed: ${error.message}`)
      return (data as ProjectRow | null) ?? null
    },
    async listRepos(projectId) {
      const { data, error } = await d.store()
        .select('project_repos', '*')
        .eq('project_id', projectId)
        .order('attached_at', { ascending: true })
      if (error) throw new Error(`repositories read failed: ${error.message}`)
      return (data ?? []) as RepoRow[]
    },
    /** Which projects hold each folder, by real path, every page read (`startChoices.ts#indexImported`). */
    async readImported() {
      const store = d.store()
      const [repos, projects] = await Promise.all([
        store.selectAll('project_repos', 'path,project_id', { orderBy: ['project_id', 'path'] }),
        store.selectAll('projects', 'id,name', { orderBy: ['id'] })
      ])
      if (repos.failed || projects.failed) throw new Error(`projects read failed: ${repos.failed ?? projects.failed}`)
      return indexImported(repos.rows, projects.rows)
    },
    async listRemovals() {
      const removed = await d.store().selectAll('project_repo_removals', 'id,project_id,path,remote_key,kind', { orderBy: ['project_id', 'id'] })
      if (removed.failed) throw new Error(`repository removals read failed: ${removed.failed}`)
      return removed.rows.map((row) => ({
        id: String(row.id),
        projectId: String(row.project_id),
        path: row.path === null ? null : String(row.path),
        remoteKey: row.remote_key === null ? null : String(row.remote_key),
        kind: row.kind === null ? null : String(row.kind) as 'primary' | 'checkout' | 'worktree'
      }))
    },
    async enroll(id) {
      const { data, error } = await d.store().select('projects', 'id,name').eq('id', id).maybeSingle()
      if (error) throw new Error(`project read failed: ${error.message}`)
      return (data as { id: string; name: string } | null) ?? null
    },
    projectRepos,
    cachedOrigin,
    async reposWithRemotes(projectId) {
      const repos = await projectRepos(projectId)
      return Promise.all(repos.map(async (r) => ({ path: r.path, remote: await cachedOrigin(r.path) })))
    },
    async leaseRefs(projectId) {
      const repos = await projectRepos(projectId)
      const primary = repos.find((r) => r.is_primary) ?? repos[0]
      if (!primary) return null
      return { ...(await leaseRefReader.read(primary.path)), repository: primary.path }
    }
  }
}
// #endregion project-reads

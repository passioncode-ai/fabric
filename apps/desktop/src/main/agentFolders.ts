// #region agent-folders — docs: docs/architecture/operating-surfaces.md#an-agent-attaches-its-projects-folders
/**
 * CO-489: the project page's «Выбрать папку…» and «Убрать» as a session's own door (the operator's dashboard parity
 * rule, 2026-10-24). A session attaches a repository to ITS project, or detaches one of its project's folders, through
 * the one admission service (`projectAdmission.ts`: the real path, never too broad, one project per folder) and each
 * change is an act the person can undo from History. Two refusals are the person's to lift: a folder the person
 * detached stays detached (the ADR-0164 §5 tombstone; the project page attaches it again), and a folder that is not a
 * repository is not attached, because a plain folder has nothing to match it by (as enrollment, `enroll`).
 */
import path from 'node:path'
import type { ActOutcome, ActActor } from '../shared/acts.ts'
import type { AdmissionActor, AdmissionRepo } from './projectAdmission.ts'
import type { DetachedFolder } from './folderResolver.ts'

export type FolderRefusal =
  | 'not-a-path' | 'missing' | 'not-a-folder' | 'too-broad' | 'held-by-other' | 'not-chosen'
  | 'not-git' | 'detached' | 'already-attached' | 'not-attached' | 'unreadable'

export interface FolderAnswer {
  done: boolean
  reason?: FolderRefusal
  /** What the refusal means and who can lift it, in one line for the agent. */
  says?: string
  folder?: string
  /** The project's folders after the call. */
  folders: string[]
}

export interface AgentFolderDeps {
  attach(projectId: string, paths: string[], actor: AdmissionActor): Promise<void>
  detach(projectId: string, repoId: string, actor: AdmissionActor): Promise<void>
  listRepos(projectId: string): Promise<AdmissionRepo[]>
  listRemovals(): Promise<DetachedFolder[]>
  isRepository(folder: string): Promise<boolean>
  realpath(folder: string): string | null
  note(outcome: ActOutcome, opts: { actor: ActActor }): Promise<unknown>
}

const SAYS: Record<FolderRefusal, string> = {
  'not-a-path': 'give the folder as an absolute path',
  missing: 'no folder is at that path',
  'not-a-folder': 'that path is a file, not a folder',
  'too-broad': 'a home folder, a volume or a folder of projects is never one project\'s folder',
  'held-by-other': 'another project holds this folder; its own session or the person moves it',
  'not-chosen': 'this folder may not be reached from here',
  'not-git': 'only a repository is attached; a plain folder becomes a project of its own when a session starts in it',
  detached: 'the person detached this folder; only the person attaches it again, on the project page',
  'already-attached': 'this folder is already this project\'s',
  'not-attached': 'no folder of this project is at that path',
  unreadable: 'the project\'s folders could not be read now; try again'
}

const refused = (reason: FolderRefusal, folders: string[], folder?: string): FolderAnswer =>
  ({ done: false, reason, says: SAYS[reason], ...(folder ? { folder } : {}), folders })

const codeOf = (e: unknown): FolderRefusal | null => {
  const m = /^repo-path-refused:([a-z-]+):/.exec(e instanceof Error ? e.message : '')
  return m && m[1] in SAYS ? (m[1] as FolderRefusal) : null
}

export function createAgentFolders(d: AgentFolderDeps) {
  const pathsOf = (rows: AdmissionRepo[]): string[] => rows.map((r) => r.path).sort()
  const actorOf = (sessionId: string) => ({ kind: 'agent' as const, id: sessionId })

  async function attach(projectId: string, folder: unknown, sessionId: string): Promise<FolderAnswer> {
    const before = await d.listRepos(projectId).catch(() => null)
    if (!before) return refused('unreadable', [])
    if (typeof folder !== 'string' || !path.isAbsolute(folder)) return refused('not-a-path', pathsOf(before))
    const real = d.realpath(folder)
    if (!real) return refused('missing', pathsOf(before), folder)
    if (before.some((r) => r.path === real)) return refused('already-attached', pathsOf(before), real)
    const removals = await d.listRemovals().catch(() => null)
    if (!removals) return refused('unreadable', pathsOf(before), real)
    if (removals.some((r) => r.path === real)) return refused('detached', pathsOf(before), real)
    if (!(await d.isRepository(real))) return refused('not-git', pathsOf(before), real)
    try {
      await d.attach(projectId, [real], actorOf(sessionId))
    } catch (e) {
      const code = codeOf(e)
      if (code) return refused(code, pathsOf(before), real)
      throw e
    }
    const after = await d.listRepos(projectId)
    const known = new Set(before.map((r) => r.id))
    // Each folder attached is an act with its inverse, as the page's press is (ADR-0160 §2): History undoes it.
    for (const r of after.filter((x) => !known.has(x.id)))
      await d.note({ kind: 'repo.attach', projectId, subject: { type: 'repo', id: r.id, label: r.label ?? r.path },
        said: { key: 'act.repo.attach', params: { folder: r.label ?? r.path } }, inverse: { kind: 'repo.detach', args: { repo_id: r.id } } },
      { actor: actorOf(sessionId) })
    return { done: true, folder: real, folders: pathsOf(after) }
  }

  async function detach(projectId: string, folder: unknown, sessionId: string): Promise<FolderAnswer> {
    const before = await d.listRepos(projectId).catch(() => null)
    if (!before) return refused('unreadable', [])
    if (typeof folder !== 'string' || !path.isAbsolute(folder)) return refused('not-a-path', pathsOf(before))
    // A folder already gone from the disk is still detached by the path the project recorded.
    const real = d.realpath(folder) ?? folder
    const row = before.find((r) => r.path === real || r.path === folder)
    if (!row) return refused('not-attached', pathsOf(before), folder)
    await d.detach(projectId, row.id, actorOf(sessionId))
    // The path, remote and kind make «Отменить» attach the same folder again, clearing the tombstone (as `repo.detach`).
    await d.note({ kind: 'repo.detach', projectId, subject: { type: 'repo', id: row.id, label: row.label ?? row.path },
      said: { key: 'act.repo.detach', params: { folder: row.label ?? row.path } },
      inverse: { kind: 'repo.attach', args: { project_id: projectId, repo_id: row.id, path: row.path, label: row.label, remote_key: row.remote_key ?? null, repo_kind: row.kind ?? null } } },
    { actor: actorOf(sessionId) })
    return { done: true, folder: row.path, folders: pathsOf(await d.listRepos(projectId)) }
  }

  return { attach, detach }
}
// #endregion agent-folders

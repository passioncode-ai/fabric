// #region backlog-source — docs: docs/evidence/plans/2026-10-11-release-040-agents-first.md#c4--work-log-protocol-every-coding-agent-knows-how-to-log-and-track
/**
 * A backlog row named by (repository, path, id), resolved against the project's own repositories (REQ-08, R-07:
 * link, don't copy). Each part is checked in order and the first that does not resolve is named: the repository
 * must be one of this project's (by folder, or by its `origin` remote), the path a file inside it (its real path
 * stays inside the repository), and the id must appear in that file as a whole token. Fabric keeps the address;
 * the row's status stays in its file.
 */
import { open, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { checkSourceShape, resolveRepository, rowAppears, type BacklogSource } from '../shared/workClaims.ts'

/** Larger files are linked without the id being looked for, and the answer says so. */
export const SOURCE_READ_MAX_BYTES = 4_000_000

export type SourceResolution =
  | { ok: true; repository: string; repoPath: string; path: string; rowId: string; idChecked: boolean }
  | { ok: false; part: 'repository' | 'path' | 'id'; reason: string }

export interface SourceDeps {
  /** The project's repositories, each with its `origin` URL (null when it has none or it could not be read). */
  repos(): Promise<Array<{ path: string; remote: string | null }>>
}

export async function resolveBacklogSource(input: Partial<BacklogSource>, deps: SourceDeps): Promise<SourceResolution> {
  const shape = checkSourceShape(input)
  if (!shape.ok) return shape
  const { source } = shape
  const repos = await deps.repos()
  const repo = resolveRepository(source.repository, repos)
  if (!repo)
    return { ok: false, part: 'repository', reason: `${source.repository} is not one of this project's repositories (by folder or by its origin remote)` }
  let root: string
  let file: string
  try {
    root = await realpath(repo.path)
    file = await realpath(path.join(root, source.path))
  } catch {
    return { ok: false, part: 'path', reason: `${source.path} is not a file in that repository` }
  }
  if (file !== root && !file.startsWith(root + path.sep))
    return { ok: false, part: 'path', reason: `${source.path} leads outside the repository` }
  const info = await stat(file).catch(() => null)
  if (!info?.isFile()) return { ok: false, part: 'path', reason: `${source.path} is not a file in that repository` }
  if (info.size > SOURCE_READ_MAX_BYTES)
    return { ok: true, repository: source.repository, repoPath: repo.path, path: source.path, rowId: source.id, idChecked: false }
  const handle = await open(file, 'r')
  let text: string
  try {
    text = (await handle.readFile()).toString('utf8')
  } finally {
    await handle.close()
  }
  if (!rowAppears(text, source.id)) return { ok: false, part: 'id', reason: `${source.id} does not appear in ${source.path}` }
  return { ok: true, repository: source.repository, repoPath: repo.path, path: source.path, rowId: source.id, idChecked: true }
}
// #endregion backlog-source

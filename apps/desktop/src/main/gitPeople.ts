// #region git-people — docs: docs/evidence/specs/2026-10-23-0312-w2-project-onboarding.md#decisions-the-questions-the-scenarios-leave-open
// W2-6 (D-5, OF-27): a project's people are the authors of its repositories' commits, read live from Git (the last 365
// days, at most 2 000 commits per repository), deduplicated by email, cached for ten minutes; nothing is stored. Shown
// only on the project page (D-5: nobody's address leaves it).
//
// One `git log` per REPOSITORY, not per attached folder (DO-10): a project's folders include a repository's checkouts
// and worktrees, so folders are grouped by Git's common directory and one log reads every folder's HEAD of a group at
// once; a commit seen in two groups (two clones of one remote) is counted once, by its hash. Only a reading where every
// repository was read is cached, so a failure is read again on the next open (ER-3); concurrent first reads of one
// project share one reading.
import { execFile } from 'node:child_process'
import path from 'node:path'

export interface GitPerson {
  name: string
  email: string
  commits: number
  /** The newest commit's date, ISO. */
  lastAt: string
}

export interface GitPeopleReading {
  people: GitPerson[]
  /** Folders whose repository could not be read, with Git's reason; the rest still count. */
  unread: Array<{ path: string; reason: string }>
  /** How many repositories were read (a repository with no commits in the year counts as read). */
  read: number
}

const SEP = '\u001f'

/**
 * One `git log --format=%H<US>%an<US>%ae<US>%cI` output into people, merged into `into` by lower-cased email. A commit
 * whose hash is already in `seen` is not counted again (two clones of one repository).
 */
export function addLogLines(into: Map<string, GitPerson>, log: string, seen: Set<string> = new Set()): void {
  for (const line of log.split('\n')) {
    const [hash, name, email, at] = line.split(SEP)
    const key = email?.trim().toLowerCase()
    if (!hash?.trim() || !key || !at) continue
    if (seen.has(hash.trim())) continue
    seen.add(hash.trim())
    const seenPerson = into.get(key)
    if (!seenPerson) { into.set(key, { name: name.trim() || key, email: email.trim(), commits: 1, lastAt: at.trim() }); continue }
    seenPerson.commits += 1
    if (at.trim() > seenPerson.lastAt) { seenPerson.lastAt = at.trim(); if (name.trim()) seenPerson.name = name.trim() }
  }
}

/** Most recent first, then by commits. */
export function orderPeople(people: Iterable<GitPerson>): GitPerson[] {
  return [...people].sort((a, b) => b.lastAt.localeCompare(a.lastAt) || b.commits - a.commits)
}

/** What Fabric asks Git: where a folder's repository lives and its HEAD, and the log of some revisions. */
export interface GitReader {
  /** The folder's common Git directory (absolute) and its HEAD commit, null for a repository without commits. */
  identify(folder: string): Promise<{ commonDir: string; head: string | null }>
  /** The log of `revs` (commit hashes), read in `folder`. */
  log(folder: string, revs: readonly string[]): Promise<string>
}

const git = (folder: string, args: readonly string[]): Promise<string> =>
  new Promise((resolve, reject) => {
    execFile('git', ['-C', folder, ...args], { timeout: 5000, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8' },
      (error, stdout) => (error ? reject(error) : resolve(stdout)))
  })

const systemGit: GitReader = {
  async identify(folder) {
    const commonDir = (await git(folder, ['rev-parse', '--git-common-dir'])).trim()
    let head: string | null = null
    try { head = (await git(folder, ['rev-parse', '-q', '--verify', 'HEAD^{commit}'])).trim() || null } catch {
      // Silence is right: a repository with no commit has no HEAD to read, and it is read as having no commits.
      head = null
    }
    return { commonDir: path.resolve(folder, commonDir), head }
  },
  log: (folder, revs) => git(folder, ['log', '--since=365.days', '-n', '2000', `--format=%H${SEP}%an${SEP}%ae${SEP}%cI`, ...revs, '--'])
}

const reason = (e: unknown): string => (e instanceof Error ? e.message.split('\n')[0] : String(e))

/** The people of these folders' repositories, one log per repository. Never throws: a failure is in `unread`. */
export async function readPeople(folders: readonly string[], reader: GitReader = systemGit): Promise<GitPeopleReading> {
  const groups = new Map<string, { folders: string[]; heads: Set<string> }>()
  const unread: GitPeopleReading['unread'] = []
  const identified = await Promise.all(folders.map(async (folder) => {
    try { return { folder, id: await reader.identify(folder) } } catch (e) { return { folder, problem: reason(e) } }
  }))
  for (const r of identified) {
    if ('problem' in r) { unread.push({ path: r.folder, reason: r.problem as string }); continue }
    const g = groups.get(r.id.commonDir) ?? { folders: [], heads: new Set<string>() }
    g.folders.push(r.folder)
    if (r.id.head) g.heads.add(r.id.head)
    groups.set(r.id.commonDir, g)
  }
  const people = new Map<string, GitPerson>()
  const seen = new Set<string>()
  let read = 0
  for (const g of groups.values()) {
    if (g.heads.size === 0) { read++; continue }
    try { addLogLines(people, await reader.log(g.folders[0], [...g.heads]), seen); read++ } catch (e) {
      // Not silent: every folder of the repository goes back in `unread` with Git's reason, and the project page says them.
      for (const folder of g.folders) unread.push({ path: folder, reason: reason(e) })
    }
  }
  return { people: orderPeople(people.values()), unread, read }
}

const cache = new Map<string, { at: number; reading: GitPeopleReading }>()
const inFlight = new Map<string, Promise<GitPeopleReading>>()
const TTL_MS = 10 * 60_000

/**
 * The people of a project's repositories. A complete reading is cached ten minutes per project and set of folders (a
 * folder attached since is read at once); a reading with a repository unread is not cached. Concurrent reads of one
 * project and set of folders share one reading.
 */
export async function readGitPeople(projectId: string, folders: readonly string[], now = Date.now(), reader: GitReader = systemGit): Promise<GitPeopleReading> {
  const key = `${projectId}\u0000${[...new Set(folders)].sort().join('\u0000')}`
  const hit = cache.get(key)
  if (hit && now - hit.at < TTL_MS) return hit.reading
  const running = inFlight.get(key)
  if (running) return running
  const reading = readPeople([...new Set(folders)], reader).then((r) => {
    for (const k of cache.keys()) if (k.startsWith(`${projectId}\u0000`)) cache.delete(k)
    if (r.unread.length === 0) cache.set(key, { at: now, reading: r })
    return r
  }).finally(() => inFlight.delete(key))
  inFlight.set(key, reading)
  return reading
}
// #endregion git-people

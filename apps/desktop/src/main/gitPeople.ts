// #region git-people — docs: docs/evidence/specs/2026-10-23-0312-w2-project-onboarding.md#decisions-the-questions-the-scenarios-leave-open
// W2-6 (D-5, OF-27): a project's people are the authors of its repositories' commits, read live from Git (the last 365
// days, at most 2 000 commits per repository), deduplicated by email, cached for ten minutes; nothing is stored. Shown
// only on the project page (D-5: nobody's address leaves it).
import { execFile } from 'node:child_process'

export interface GitPerson {
  name: string
  email: string
  commits: number
  /** The newest commit's date, ISO. */
  lastAt: string
}

export interface GitPeopleReading {
  people: GitPerson[]
  /** Repositories whose history could not be read, by folder, with Git's reason; the rest still count. */
  unread: Array<{ path: string; reason: string }>
}

const SEP = '\u001f'

/** One `git log --format=%an<US>%ae<US>%cI` output into people, merged into `into` by lower-cased email. */
export function addLogLines(into: Map<string, GitPerson>, log: string): void {
  for (const line of log.split('\n')) {
    const [name, email, at] = line.split(SEP)
    const key = email?.trim().toLowerCase()
    if (!key || !at) continue
    const seen = into.get(key)
    if (!seen) { into.set(key, { name: name.trim() || key, email: email.trim(), commits: 1, lastAt: at.trim() }); continue }
    seen.commits += 1
    if (at.trim() > seen.lastAt) { seen.lastAt = at.trim(); if (name.trim()) seen.name = name.trim() }
  }
}

/** Most recent first, then by commits. */
export function orderPeople(people: Iterable<GitPerson>): GitPerson[] {
  return [...people].sort((a, b) => b.lastAt.localeCompare(a.lastAt) || b.commits - a.commits)
}

const runLog = (folder: string): Promise<string> =>
  new Promise((resolve, reject) => {
    execFile('git', ['-C', folder, 'log', '--since=365.days', '-n', '2000', `--format=%an${SEP}%ae${SEP}%cI`],
      { timeout: 5000, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8' },
      (error, stdout) => (error ? reject(error) : resolve(stdout)))
  })

const cache = new Map<string, { at: number; reading: GitPeopleReading }>()
const TTL_MS = 10 * 60_000

/** The people of a project's repositories, cached per project for ten minutes. */
export async function readGitPeople(projectId: string, folders: readonly string[], now = Date.now(), log = runLog): Promise<GitPeopleReading> {
  const hit = cache.get(projectId)
  if (hit && now - hit.at < TTL_MS) return hit.reading
  const people = new Map<string, GitPerson>()
  const unread: GitPeopleReading['unread'] = []
  for (const folder of folders) {
    try { addLogLines(people, await log(folder)) } catch (e) {
      // Not silent: the folder and Git's reason go back in `unread`, and the project page says them.
      unread.push({ path: folder, reason: e instanceof Error ? e.message.split('\n')[0] : String(e) })
    }
  }
  const reading = { people: orderPeople(people.values()), unread }
  cache.set(projectId, { at: now, reading })
  return reading
}
// #endregion git-people

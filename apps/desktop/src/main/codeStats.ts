// Statistics that measure the PROJECT, not Fabric (M57, reopened by M113).
//
// The project strip spent its slots on `Memory facts`, `Journal events` and
// `Transcripts` — facts about our own storage, which an operator never asks
// about. M57 was marked shipped and not one of the five numbers it named
// existed anywhere in the product.
//
// WHAT IS MEASURABLE, DECIDED BY MEASURING (2026-09-05, on a 197 000-line
// repository):
//   - commits in a window and the lines they moved: `git log --numstat`, 0.5 s,
//     and no reflog — `@{7 days ago}` needs one and a fresh clone has none.
//   - tracked files and their lines: `git grep -I -c ''`, 30 ms, one process,
//     no shell, binaries skipped.
//
// AND WHAT IS NOT:
//   - "lines of code" is NOT this number and is not shipped under that name.
//     Counting tracked lines in this repository gives 184 178, and its two
//     largest entries are a 32 582-line icon JSON and a 20 185-line font
//     licence. A figure called "lines of code" that is a third data files is
//     precisely the over-claim M113 exists to end, so the number is named for
//     what it actually counts.
//   - tokens and cost are not shippable at all. CO-096 measured the endpoint:
//     it returns utilisation against rate-limit windows, `limit_dollars`,
//     `used_dollars` and `remaining_dollars` all came back null, and nothing in
//     the response is per-project. M57's row is corrected rather than left
//     claiming them.

import { gitRun } from './gitRun.ts'

// Declared in `shared/types.ts` because the renderer reads it too; a second
// definition here is a second thing to keep in step.
export type { CodeStats } from '../shared/types.ts'
import type { CodeStats } from '../shared/types.ts'

export interface CodeStatsDeps {
  git?: (repoPath: string, args: string[]) => Promise<string>
  ttlMs?: number
  now?: () => number
}

/** Longer than the repository state's five seconds: this is heavier and it
 *  answers a question about weeks, not about the last keystroke. */
const DEFAULT_TTL = 60_000

/** `git grep -I -c ''` prints `<path>:<count>`, and a path may contain a colon,
 *  so the count is read from the RIGHT. */
export function parseGrepCounts(out: string): { files: number; lines: number } {
  let files = 0
  let lines = 0
  for (const row of out.split('\n')) {
    if (!row.trim()) continue
    const cut = row.lastIndexOf(':')
    if (cut < 0) continue
    const n = Number(row.slice(cut + 1))
    if (!Number.isFinite(n)) continue
    files++
    lines += n
  }
  return { files, lines }
}

/**
 * `git log --numstat --format=%H` prints the commit's sha on its own line
 * followed by one `added\tremoved\tpath` row per file. Commits are counted by
 * those sha lines; counting the rows would count files.
 *
 * THE FORMAT IS `%H` AND NOT `''` FOR A MEASURED REASON. The first version used
 * `--format=''` and counted blank-line separators, which is what the
 * documentation's shape suggested and what the fixture in the probe encoded.
 * Run against this repository's real output it reported ZERO commits where git
 * says 162: `--format=''` emits no separator at all. The fixture passed because
 * I had written the assumption into it as well as into the parser.
 *
 * A binary file reports `-` for both counts, which is a fact and not a zero.
 */
export function parseNumstat(out: string): { commits: number; added: number; removed: number } {
  let commits = 0
  let added = 0
  let removed = 0
  for (const row of out.split('\n')) {
    const line = row.trim()
    if (!line) continue
    if (/^[0-9a-f]{40}$/.test(line)) {
      commits++
      continue
    }
    const parts = row.split('\t')
    if (parts.length < 3) continue
    // A binary file reports "-" for both counts. That is a fact about the file,
    // not a zero, and adding it as one would understate nothing and overstate
    // the number of files that changed by text.
    if (parts[0] === '-' || parts[1] === '-') continue
    added += Number(parts[0]) || 0
    removed += Number(parts[1]) || 0
  }
  return { commits, added, removed }
}

export function createCodeStatsReader(deps: CodeStatsDeps = {}) {
  const git = deps.git ?? gitRun
  const ttl = deps.ttlMs ?? DEFAULT_TTL
  const now = deps.now ?? Date.now

  const cache = new Map<string, { at: number; stats: CodeStats }>()

  return {
    async read(repoPath: string, windowDays: number): Promise<CodeStats> {
      const key = `${repoPath}::${windowDays}`
      const hit = cache.get(key)
      if (hit && now() - hit.at < ttl) return hit.stats

      const base: CodeStats = {
        trackedFiles: null,
        trackedLines: null,
        commits: null,
        linesAdded: null,
        linesRemoved: null,
        windowDays,
        readAt: new Date(now()).toISOString(),
        error: null
      }
      try {
        // `git grep` exits 1 when nothing matches, which for `''` means an empty
        // repository — a fact, so it is caught here rather than failing the read.
        const [counts, log] = await Promise.all([
          git(repoPath, ['grep', '-I', '-c', '', '--', '.']).catch(() => ''),
          git(repoPath, ['log', `--since=${windowDays} days ago`, '--numstat', '--format=%H'])
        ])
        const c = parseGrepCounts(counts)
        const n = parseNumstat(log)
        Object.assign(base, {
          trackedFiles: c.files,
          trackedLines: c.lines,
          commits: n.commits,
          linesAdded: n.added,
          linesRemoved: n.removed
        })
      } catch (e) {
        // A repository git cannot read is reported as unknown by the caller;
        // there is no second thing to try and nothing the operator can act on.
        base.error = e instanceof Error ? e.message.split('\n')[0] : String(e)
      }
      cache.set(key, { at: now(), stats: base })
      return base
    },

    invalidate(repoPath?: string): void {
      if (!repoPath) cache.clear()
      else for (const k of cache.keys()) if (k.startsWith(`${repoPath}::`)) cache.delete(k)
    }
  }
}

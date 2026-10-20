// #region git-facts — docs: docs/adr/0166-one-attribution-of-folders-to-projects-across-fabric-switchboard-and-observatory.md#decision
/**
 * A folder's Git facts for `fabric.project.resolve` (F9), with the one distinction DEC-0092 asks for: a folder that is
 * not in Git (`none`) is not a folder whose Git could not be read (`unreadable`: a probe that failed or ran out of
 * time). The first is an answer the attribution rules read; the second makes the hub answer `pending` instead of
 * attributing the folder as if it had no Git (0.3.7 review PL-4). Bounded: each git call is killed at `deadlineMs`.
 *
 * Git speaks in the C locale here, because "not a git repository" is recognised by its words.
 */
import { execFile } from 'node:child_process'

export type GitRead =
  | { kind: 'git'; toplevel: string; commonDir: string; origin: string | null }
  | { kind: 'none' }
  | { kind: 'unreadable'; why: string }

export const GIT_FACTS_MS = 3000

/** The words with which git says a folder has no working tree of its own: no repository above it, a bare repository
 *  or the inside of a `.git` folder, or a folder that is not on this computer (an admitted folder since removed). */
const NOT_A_WORK_TREE = /not a git repository|must be run in a work tree|cannot change to/i

type Run = (args: string[], deadlineMs: number) => Promise<{ code: number | null; stdout: string; stderr: string; failed?: string }>

function gitEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, LC_ALL: 'C', LANGUAGE: 'C', GIT_TERMINAL_PROMPT: '0' }
  // A repository named by the environment would answer for every folder alike.
  for (const k of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE']) delete env[k]
  return env
}

export const runGit: Run = (args, deadlineMs) =>
  new Promise((resolve) => {
    execFile('git', args, { encoding: 'utf8', timeout: deadlineMs, killSignal: 'SIGKILL', windowsHide: true, maxBuffer: 1024 * 1024, env: gitEnv() }, (error, stdout, stderr) => {
      if (!error) return resolve({ code: 0, stdout: String(stdout), stderr: String(stderr) })
      const e = error as NodeJS.ErrnoException & { killed?: boolean; signal?: string | null; code?: number | string }
      if (typeof e.code === 'number') return resolve({ code: e.code, stdout: String(stdout), stderr: String(stderr) })
      // Not started (no git) or ended by the deadline: nothing was read.
      resolve({ code: null, stdout: '', stderr: String(stderr ?? ''), failed: e.killed || e.signal ? `no answer within ${deadlineMs} ms` : (e.code ? String(e.code) : e.message) })
    })
  })

export async function readGitFacts(dir: string, opts: { deadlineMs?: number; run?: Run } = {}): Promise<GitRead> {
  const deadlineMs = opts.deadlineMs ?? GIT_FACTS_MS
  const run = opts.run ?? runGit
  const where = await run(['-C', dir, 'rev-parse', '--path-format=absolute', '--show-toplevel', '--git-common-dir'], deadlineMs)
  if (where.failed) return { kind: 'unreadable', why: where.failed }
  if (where.code !== 0) {
    if (where.code === 128 && NOT_A_WORK_TREE.test(where.stderr)) return { kind: 'none' }
    return { kind: 'unreadable', why: `git rev-parse exit ${where.code}: ${where.stderr.trim().split('\n').pop()?.slice(0, 200) ?? ''}` }
  }
  const [toplevel, commonDir] = where.stdout.split('\n').map((l) => l.trim())
  if (!toplevel || !commonDir) return { kind: 'unreadable', why: 'git rev-parse printed no top level or common dir' }
  const origin = await run(['-C', dir, 'config', '--get', 'remote.origin.url'], deadlineMs)
  if (origin.failed) return { kind: 'unreadable', why: origin.failed }
  // Exit 1 is "no such key": a repository without an origin, which the rules read as no identity.
  if (origin.code === 1) return { kind: 'git', toplevel, commonDir, origin: null }
  if (origin.code !== 0) return { kind: 'unreadable', why: `git config exit ${origin.code}` }
  return { kind: 'git', toplevel, commonDir, origin: origin.stdout.trim() || null }
}
// #endregion git-facts

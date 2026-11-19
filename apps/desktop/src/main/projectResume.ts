// #region project-resume — docs: docs/ux/scenarios.md#scn-166-see-every-agent-and-open-its-console-in-one-press
/**
 * «Продолжить последнюю» on a project (the owner, 2026-11-19: «либо новую, либо последнюю, две кнопочки в списке
 * проектов»): the newest Claude Code session of the project that is not running now, wherever it was started (Fabric,
 * a terminal, Switchboard), found from Claude Code's own transcripts: `<config>/projects/<slug>/<id>.jsonl`, where the
 * slug is the folder with every character but a letter or digit turned into «-» (measured on 2.1.299, 2026-11-19), in
 * the person's home and every Switchboard home, for the project's folder, its worktrees and every folder the launch
 * journal saw it in. A transcript with no turn of the person's (a console opened and closed) is not a session to go on.
 */
import { execFile } from 'node:child_process'
import { open, readdir, stat } from 'node:fs/promises'
import path from 'node:path'

export interface LastSession {
  sessionId: string
  cwd: string
  /** The Claude config folder it ran in: the person's own, or a Switchboard home. */
  config: string
  at: number
}

export const claudeSlug = (folder: string): string => folder.replace(/[^A-Za-z0-9]/g, '-')

const UUID_FILE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i
/** How much of a transcript is read to see that the person said something in it. */
const HEAD_BYTES = 256 * 1024

async function hasTurn(file: string): Promise<boolean> {
  let fh: Awaited<ReturnType<typeof open>> | null = null
  try {
    fh = await open(file, 'r')
    const buf = Buffer.alloc(HEAD_BYTES)
    const { bytesRead } = await fh.read(buf, 0, HEAD_BYTES, 0)
    return buf.subarray(0, bytesRead).toString('utf8').includes('"type":"user"')
  } catch { return false /* unreadable: not offered */ } finally { await fh?.close().catch(() => {}) }
}

/** The newest session of these folders not in `running`, or null. At most `scan` files are looked at per folder. */
export async function lastSessionOf(folders: readonly string[], configs: readonly string[], running: ReadonlySet<string>, scan = 200): Promise<LastSession | null> {
  const found: LastSession[] = []
  const seen = new Set<string>()
  for (const config of configs) {
    for (const folder of new Set(folders)) {
      const dir = path.join(config, 'projects', claudeSlug(folder))
      let names: string[]
      try { names = await readdir(dir) } catch { continue /* this home never ran a session here */ }
      for (const name of names.slice(-scan * 4)) {
        const m = UUID_FILE.exec(name)
        if (!m || running.has(m[1]!) || seen.has(m[1]!)) continue
        seen.add(m[1]!)
        try { found.push({ sessionId: m[1]!, cwd: folder, config, at: (await stat(path.join(dir, name))).mtimeMs }) } catch { /* gone between the list and the look */ }
      }
    }
  }
  found.sort((a, b) => b.at - a.at)
  for (const f of found.slice(0, scan)) if (await hasTurn(path.join(f.config, 'projects', claudeSlug(f.cwd), `${f.sessionId}.jsonl`))) return f
  return null
}

/** The worktrees of a repository (`git worktree list --porcelain`, 3 s, no shell); the folder alone on any failure. */
export function gitWorktrees(repo: string): Promise<string[]> {
  return new Promise((resolve) => {
    execFile('git', ['-C', repo, 'worktree', 'list', '--porcelain'], { timeout: 3000, killSignal: 'SIGKILL', windowsHide: true, maxBuffer: 1024 * 1024 },
      (err, stdout) => resolve(err ? [repo] : [repo, ...String(stdout).split('\n').filter((l) => l.startsWith('worktree ')).map((l) => l.slice(9).trim()).filter(Boolean)]))
  })
}

/** The repository a folder belongs to, by git's common directory (a worktree's is its main checkout's `.git`); null
 *  outside a repository. */
export function gitMainFolder(folder: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('git', ['-C', folder, 'rev-parse', '--path-format=absolute', '--git-common-dir'], { timeout: 3000, killSignal: 'SIGKILL', windowsHide: true, maxBuffer: 64 * 1024 },
      (err, stdout) => {
        const common = err ? '' : String(stdout).trim()
        resolve(common && path.basename(common) === '.git' ? path.dirname(common) : null)
      })
  })
}

/** The project whose folder holds this one: the longest repository folder that is it or above it, else the project of
 *  the repository it is a worktree of. */
export async function projectForFolder<P extends { id: string; repo_path: string | null }>(folder: string, projects: readonly P[], mainOf = gitMainFolder): Promise<P | null> {
  const under = (f: string, root: string): boolean => f === root || f.startsWith(root.endsWith(path.sep) ? root : root + path.sep)
  const best = (f: string): P | null => projects.filter((p) => p.repo_path && under(f, p.repo_path)).sort((a, b) => b.repo_path!.length - a.repo_path!.length)[0] ?? null
  const direct = best(folder)
  if (direct) return direct
  const main = await mainOf(folder)
  return main ? best(main) : null
}
// #endregion project-resume

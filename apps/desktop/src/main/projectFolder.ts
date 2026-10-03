// #region project-folder — docs: docs/ux/scenarios.md#scn-129-create-a-new-project-in-a-new-folder-or-as-an-idea
/**
 * A new project's folder (ADR-0100 §4, SCN-129): created under a parent the operator chose, named after
 * the project, optionally a git repository on `main`.
 *
 * ALL OR NOTHING. If `git init` fails after the folder was made, the folder is removed — it is empty but
 * for git's own half-written files — so a retry is not refused as "exists" (iteration 1: the operator was
 * left with an orphan folder and no way forward). ASYNCHRONOUS, because the caller is Electron's main
 * process and a hung git must not freeze every window. No Electron import, so it is tested directly.
 *
 * EVERY REFUSAL SAYS ITS REAL REASON (iteration 2, errors finding 9): "exists" is decided by `mkdir`
 * itself, so a second create racing the first is told the folder exists rather than a raw failure; a
 * hung `git init` is named as a timeout with its limit; an `outside` parent carries a CODE in `detail`,
 * which each window says in its own language.
 */
import { execFile } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { folderNameProblem, type NewFolderInput, type NewFolderResult } from '../shared/startPaths.ts'
import { hardenedGitEnv } from './gitRun.ts'

const GIT_INIT_TIMEOUT_MS = 10000

function gitInit(dir: string, gitBinary: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    // The hardened environment (`gitRun.ts#hardenedGitEnv`): an inherited GIT_DIR / GIT_WORK_TREE made
    // `git init` initialise ANOTHER repository and report success for an empty folder (iteration 3).
    execFile(gitBinary, ['init', '-q', '-b', 'main'], { cwd: dir, timeout: timeoutMs, env: hardenedGitEnv() }, (err) => {
      if (!err) return resolve()
      // `execFile` kills the child on its timeout and reports `killed`; that is a timeout, not a crash.
      if ((err as { killed?: boolean }).killed) return reject(new Error(`git init timed out after ${timeoutMs / 1000} s`))
      reject(err)
    })
  })
}

/**
 * `resolveParent` is the caller's boundary: it returns the resolved parent or throws when the parent is
 * not one this window may create in. `opts.gitBinary` and `opts.gitTimeoutMs` exist for the failure tests.
 */
export async function createProjectFolder(
  input: NewFolderInput,
  resolveParent: (p: string) => string,
  opts: { gitBinary?: string; gitTimeoutMs?: number } = {}
): Promise<NewFolderResult> {
  const problem = folderNameProblem(input?.name)
  if (problem) return { ok: false, reason: 'invalid-name', detail: problem }
  let parent: string
  try {
    parent = resolveParent(input.parent)
  } catch {
    // The boundary's own message is English and names a path; the window translates the code instead.
    return { ok: false, reason: 'outside', detail: 'parent-not-chosen' }
  }
  const target = path.join(parent, input.name.trim())
  try {
    // Not `recursive`: an existing folder must be refused, and `mkdir` decides that atomically.
    await mkdir(target)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EEXIST') return { ok: false, reason: 'exists', detail: target }
    return { ok: false, reason: 'failed', detail: e instanceof Error ? e.message : String(e) }
  }
  if (input.git) {
    try {
      await gitInit(target, opts.gitBinary ?? 'git', opts.gitTimeoutMs ?? GIT_INIT_TIMEOUT_MS)
    } catch (e) {
      // The folder was made by this call a moment ago and holds at most git's partial files: remove it.
      await rm(target, { recursive: true, force: true }).catch(() => undefined)
      return { ok: false, reason: 'failed', detail: e instanceof Error ? e.message : String(e) }
    }
  }
  return { ok: true, path: target }
}
// #endregion project-folder

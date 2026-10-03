// #region project-folder — docs: docs/adr/0100-first-run-and-start-paths.md#decision
/**
 * A new project's folder (ADR-0100 §4, SCN-129): created under a parent the operator chose, named after
 * the project, optionally a git repository on `main`.
 *
 * ALL OR NOTHING. If `git init` fails after the folder was made, the folder is removed — it is empty but
 * for git's own half-written files — so a retry is not refused as "exists" (iteration 1: the operator was
 * left with an orphan folder and no way forward). ASYNCHRONOUS, because the caller is Electron's main
 * process and a hung git must not freeze every window. No Electron import, so it is tested directly.
 */
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { folderNameProblem, type NewFolderInput, type NewFolderResult } from '../shared/startPaths.ts'

const GIT_INIT_TIMEOUT_MS = 10000

function gitInit(dir: string, gitBinary: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(gitBinary, ['init', '-q', '-b', 'main'], { cwd: dir, timeout: GIT_INIT_TIMEOUT_MS, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }, (err) => (err ? reject(err) : resolve()))
  })
}

/**
 * `resolveParent` is the caller's boundary: it returns the resolved parent or throws when the parent is
 * not one this window may create in. `opts.gitBinary` exists for the failure test only.
 */
export async function createProjectFolder(
  input: NewFolderInput,
  resolveParent: (p: string) => string,
  opts: { gitBinary?: string } = {}
): Promise<NewFolderResult> {
  const problem = folderNameProblem(input?.name)
  if (problem) return { ok: false, reason: 'invalid-name', detail: problem }
  let parent: string
  try {
    parent = resolveParent(input.parent)
  } catch (e) {
    return { ok: false, reason: 'outside', detail: e instanceof Error ? e.message : String(e) }
  }
  const target = path.join(parent, input.name.trim())
  if (existsSync(target)) return { ok: false, reason: 'exists', detail: target }
  try {
    await mkdir(target)
  } catch (e) {
    return { ok: false, reason: 'failed', detail: e instanceof Error ? e.message : String(e) }
  }
  if (input.git) {
    try {
      await gitInit(target, opts.gitBinary ?? 'git')
    } catch (e) {
      // The folder was made by this call a moment ago and holds at most git's partial files: remove it.
      await rm(target, { recursive: true, force: true }).catch(() => undefined)
      return { ok: false, reason: 'failed', detail: e instanceof Error ? e.message : String(e) }
    }
  }
  return { ok: true, path: target }
}
// #endregion project-folder

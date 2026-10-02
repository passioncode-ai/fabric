// #region executor-detect — docs: docs/adr/0100-first-run-and-start-paths.md#decision
/**
 * Which coding agents this machine can run, for the first run's second step
 * (ADR-0100, SCN-126). A program is FOUND when it is on PATH and answers
 * `--version` in time; UNRESPONSIVE when it is on PATH and does not answer —
 * a timeout or a failing exit, both of which leave it unusable;
 * MISSING when it is not on PATH. Three states, because "it hung" is not "it is
 * not installed", and telling the operator to install what they already have is
 * the failure this separates.
 *
 * Found is not signed in and not admitted: whether the account works is
 * answered the first time a session runs, by the provider itself. This module
 * says only what the machine has.
 *
 * Install commands are listed only where the vendor publishes them as the
 * install path; a program without one gets `null`, never a guessed command.
 */

import { execFile } from 'node:child_process'
import { accessSync, constants } from 'node:fs'
import path from 'node:path'

export interface ExecutorProbe { id: string; label: string; program: string }
import type { ExecutorRow } from '../shared/startPaths.ts'
export type { ExecutorRow } from '../shared/startPaths.ts'

/** Published install commands (Anthropic and OpenAI documentation). */
const INSTALL: Readonly<Record<string, string>> = {
  'claude-code': 'npm install -g @anthropic-ai/claude-code',
  codex: 'npm install -g @openai/codex'
}

function onPath(program: string, envPath: string): string | null {
  for (const dir of envPath.split(path.delimiter)) {
    if (!dir) continue
    const candidate = path.join(dir, program)
    try {
      accessSync(candidate, constants.X_OK)
      return candidate
    } catch {
      /* next */
    }
  }
  return null
}

function versionOf(file: string, env: Record<string, string>, timeoutMs: number): Promise<string | null | 'timeout'> {
  return new Promise((resolve) => {
    execFile(file, ['--version'], { env, timeout: timeoutMs, killSignal: 'SIGKILL', encoding: 'utf8' }, (err, stdout) => {
      if (err && (err as NodeJS.ErrnoException & { killed?: boolean }).killed) return resolve('timeout')
      if (err) return resolve('timeout') // on PATH but failed to answer: not usable, not missing
      const m = /\d+\.\d+(?:\.\d+)?(?:[-+][\w.]+)?/.exec(stdout)
      resolve(m ? m[0] : stdout.trim() || null)
    })
  })
}

export async function detectExecutors(
  probes: readonly ExecutorProbe[],
  opts: { env: Record<string, string>; timeoutMs?: number }
): Promise<ExecutorRow[]> {
  const timeoutMs = opts.timeoutMs ?? 5000
  return Promise.all(
    probes.map(async (p): Promise<ExecutorRow> => {
      const install = INSTALL[p.id] ?? null
      const file = onPath(p.program, opts.env.PATH ?? '')
      if (!file) return { id: p.id, label: p.label, state: 'missing', version: null, path: null, install }
      const v = await versionOf(file, opts.env, timeoutMs)
      if (v === 'timeout') return { id: p.id, label: p.label, state: 'unresponsive', version: null, path: file, install }
      return { id: p.id, label: p.label, state: 'found', version: v, path: file, install }
    })
  )
}
// #endregion executor-detect

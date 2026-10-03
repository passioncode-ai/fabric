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

import { spawn } from 'node:child_process'
import { accessSync, constants, statSync } from 'node:fs'
import path from 'node:path'

/** `connected`: whether Fabric's own tools reach a session of this agent (`AgentDescriptor.connectsToSurface`). */
export interface ExecutorProbe { id: string; label: string; program: string; connected: boolean }
import type { ExecutorRow } from '../shared/startPaths.ts'
export type { ExecutorRow } from '../shared/startPaths.ts'

/** The vendors' published install commands: Anthropic's native installer, OpenAI's npm package. */
const INSTALL: Readonly<Record<string, string>> = {
  'claude-code': 'curl -fsSL https://claude.ai/install.sh | bash',
  codex: 'npm install -g @openai/codex'
}

function onPath(program: string, envPath: string): string | null {
  for (const dir of envPath.split(path.delimiter)) {
    if (!dir) continue
    const candidate = path.join(dir, program)
    try {
      accessSync(candidate, constants.X_OK)
      // A DIRECTORY of that name is executable-bit "searchable", not a program; keep looking.
      if (!statSync(candidate).isFile()) continue
      return candidate
    } catch {
      /* next */
    }
  }
  return null
}

/**
 * `--version`, in its own process GROUP: a program that spawns children and hangs is killed with all of
 * them on the timeout, never left running behind the first run. Output is read up to 64 KiB — a version
 * line is short, and a program that prints more is not answering the question.
 */
function versionOf(file: string, env: Record<string, string>, timeoutMs: number): Promise<string | null | 'timeout'> {
  return new Promise((resolve) => {
    const child = spawn(file, ['--version'], { env, detached: true, stdio: ['ignore', 'pipe', 'ignore'] })
    let out = ''
    let done = false
    const finish = (v: string | null | 'timeout'): void => { if (!done) { done = true; clearTimeout(timer); resolve(v) } }
    const timer = setTimeout(() => {
      try { process.kill(-(child.pid as number), 'SIGKILL') } catch { /* already gone: nothing left to stop */ }
      finish('timeout')
    }, timeoutMs)
    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (d: string) => { if (out.length < 65536) out += d })
    child.on('error', () => finish('timeout')) // on PATH but could not be started: not usable, not missing
    child.on('close', (code) => {
      if (code !== 0) return finish('timeout') // on PATH but failed to answer: not usable, not missing
      const m = /\d+\.\d+(?:\.\d+)?(?:[-+][\w.]+)?/.exec(out)
      finish(m ? m[0] : out.trim().slice(0, 40) || null)
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
      const base = { id: p.id, label: p.label, connected: p.connected }
      if (!file) return { ...base, state: 'missing', version: null, path: null, install }
      const v = await versionOf(file, opts.env, timeoutMs)
      // Installed but not answering: telling the operator to INSTALL it is the wrong advice (no command).
      if (v === 'timeout') return { ...base, state: 'unresponsive', version: null, path: file, install: null }
      return { ...base, state: 'found', version: v, path: file, install: null }
    })
  )
}
// #endregion executor-detect

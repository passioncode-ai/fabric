// #region executor-auth — docs: docs/ux/scenarios.md#scn-126-first-run-name-look-coding-agents-where-to-start
import { spawn } from 'node:child_process'
import type { ExecutorAuthentication } from '../shared/startPaths.ts'

/** Separate from account identity, tool connectivity, model execution and runtime admission.
 * Read-only commands observed on these exact darwin-arm64 builds on 2026-10-04, and on their
 * official darwin-x64 builds on 2026-10-09 under Rosetta (Claude Code 2.1.289 from its release
 * manifest, checksum-verified; Codex 0.160.0 from npm `@openai/codex@0.160.0-darwin-x64`,
 * integrity-verified): isolated empty profiles answer `{"loggedIn":false,"authMethod":"none"}` exit 1
 * and `Not logged in` exit 1; a synthetic API key / ChatGPT login answers `loggedIn:true` exit 0 and
 * `Logged in using ChatGPT` exit 0 (docs/launch/harness-r0/checks.md "Intel (x86_64) runtimes").
 * An upgrade requires a new reader receipt; no command is guessed for another build.
 */
const READERS: Readonly<Record<string, { version: string; args: readonly string[] }>> = {
  'claude-code': { version: '2.1.289', args: ['auth', 'status', '--json'] },
  codex: { version: '0.160.0', args: ['login', 'status'] }
}
const MEASURED_ARCHS: ReadonlySet<string> = new Set(['arm64', 'x64'])
const METHODS = new Set(['none', 'claude.ai', 'oauth_token', 'api_key', 'api_key_helper', 'third_party'])
const OUTPUT_BYTES = 32768
const DEADLINE_MS = 8000
const DRAIN_MS = 100

function classify(id: string, code: number | null, stdout: string, stderr: string): ExecutorAuthentication {
  const unknown: ExecutorAuthentication = { state: 'unknown', method: null, reason: 'invalid-response' }
  if (id === 'claude-code') {
    if (stderr.trim()) return unknown
    try {
      const data: unknown = JSON.parse(stdout)
      if (!data || typeof data !== 'object' || Array.isArray(data)) return unknown
      const r = data as Record<string, unknown>
      if (typeof r.loggedIn !== 'boolean' || code !== (r.loggedIn ? 0 : 1)) return unknown
      // Account ids, emails, keys and all unrecognised fields stay in local bounded memory.
      const method = typeof r.authMethod === 'string' && METHODS.has(r.authMethod) ? r.authMethod : null
      return { state: r.loggedIn ? 'authenticated' : 'not-authenticated', method, reason: null }
    } catch { /* Report invalid-response through the sanitized envelope; parser errors can contain private vendor output. */ return unknown }
  }
  // Exact measured ChatGPT status, plus the vendor's explicit logged-out answer. No API-key suffix
  // is accepted: that syntax can contain a secret and needs its own format receipt before support.
  const text = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n')
  if (code === 0 && text === 'Logged in using ChatGPT') return { state: 'authenticated', method: 'chatgpt', reason: null }
  if (code === 1 && text === 'Not logged in') return { state: 'not-authenticated', method: 'none', reason: null }
  return unknown
}

export function observeExecutorAuth(input: {
  id: string; version: string | null; file: string; env: Record<string, string>
  timeoutMs?: number; platform?: string; arch?: string
}): Promise<ExecutorAuthentication> {
  const reader = READERS[input.id]
  if (!reader || reader.version !== input.version || (input.platform ?? process.platform) !== 'darwin' || !MEASURED_ARCHS.has(input.arch ?? process.arch)) {
    return Promise.resolve({ state: 'unsupported', method: null, reason: 'unverified-build' })
  }
  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn>
    try { child = spawn(input.file, [...reader.args], { env: input.env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] }) }
    catch { /* The caller receives unavailable; raw spawn errors can expose the private executable/profile path. */ resolve({ state: 'unknown', method: null, reason: 'unavailable' }); return }
    let stdout = ''
    let stderr = ''
    let bytes = 0
    let done = false
    let exited = false
    let code: number | null = null
    let closed = 0
    let drain: NodeJS.Timeout | undefined
    const finish = (result: ExecutorAuthentication): void => {
      if (done) return
      done = true
      clearTimeout(timer)
      clearTimeout(drain)
      // Only this detached process group, on failure AND success: no orphan holding a pipe.
      if (child.pid) { try { process.kill(-child.pid, 'SIGKILL') } catch { /* Already gone. */ } }
      child.stdout?.destroy()
      child.stderr?.destroy()
      stdout = ''
      stderr = ''
      resolve(result)
    }
    const fail = (reason: ExecutorAuthentication['reason']): void => finish({ state: 'unknown', method: null, reason })
    const timeoutMs = Math.max(1, Math.min(DEADLINE_MS, input.timeoutMs ?? DEADLINE_MS))
    const timer = setTimeout(() => fail('timeout'), timeoutMs)
    const settle = (): void => finish(classify(input.id, code, stdout, stderr))
    for (const [stream, which] of [[child.stdout, 'out'], [child.stderr, 'err']] as const) {
      stream?.on('data', (data: Buffer) => {
        if (done) return
        bytes += data.byteLength
        if (bytes > OUTPUT_BYTES) { fail('output-limit'); return }
        if (which === 'out') stdout += data.toString('utf8')
        else stderr += data.toString('utf8')
      })
      stream?.on('close', () => { closed++; if (exited && closed === 2) settle() })
    }
    child.on('error', () => fail('unavailable'))
    child.on('exit', (exitCode) => {
      exited = true
      code = exitCode
      if (closed === 2) settle()
      else drain = setTimeout(settle, DRAIN_MS)
    })
  })
}
// #endregion executor-auth

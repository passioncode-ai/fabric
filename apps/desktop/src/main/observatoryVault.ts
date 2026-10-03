// #region product-secret-vault — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#4-a-product-is-connected-once-by-the-products-own-consent
// Where a connected product's secret lives: Project Observatory's vault, through its own doors
// (ADR-0115 §4, "a product secret kept outside the vault" is refused). Fabric creates no Keychain item
// and writes the secret to no file of its own.
//
//   store:  `python3 "$(project-observatory full-path)/tools/vault.py" put|rotate fabric <env> <NAME>`,
//           the value on STDIN only — never argv, never the environment, never a log line.
//   read:   `use_secret.py where` first, and anything but a vault slot is refused; then
//           `use_secret.py run --env <env> fabric <NAME> -- /bin/sh -c 'printf %s "$NAME" > "$1"' sh <fifo>`.
//           `run` scrubs the value from everything its child PRINTS, so the value cannot come back on
//           stdout; it comes back through a named pipe in a 0700 directory of our own, written by the
//           shell's builtin `printf` from the child's environment — so it is in no argv either — and it
//           is held in memory for the one call that needs it.
//
// THE INTERPRETER is the one Observatory's own launcher names in its first line (its venv), because a
// Dock-launched app's PATH puts the system's `python3` first and the engine's tools are not written
// for it. A launcher without a readable first line falls back to `python3` on PATH.

import { execFile, spawn } from 'node:child_process'
import { constants, closeSync, createReadStream, existsSync, mkdtempSync, openSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { ops } from './opsSink.ts'

export interface SecretSlot {
  project: string
  env: 'local' | 'stage' | 'prod'
  name: string
}

export type VaultAnswer<T extends object = object> = ({ ok: true } & T) | { ok: false; reason: string }

export interface VaultPort {
  put(slot: SecretSlot, value: string): Promise<VaultAnswer>
  read(slot: SecretSlot): Promise<VaultAnswer<{ value: string }>>
}

interface Engine {
  tools: string
  python: string
}

const NAME = /^[A-Z_][A-Z0-9_]{0,127}$/
const PROJECT = /^[a-z0-9][a-z0-9._-]{0,63}$/

function run(
  cmd: string,
  args: string[],
  opts: { input?: string; timeoutMs: number; env?: NodeJS.ProcessEnv }
): Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean; spawnError?: string }> {
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let timedOut = false
    let child
    try {
      child = spawn(cmd, args, { env: opts.env ?? process.env, stdio: ['pipe', 'pipe', 'pipe'] })
    } catch (e) {
      // Not silence: the spawn failure is the answer, and every caller turns it into a refusal with its reason.
      resolve({ code: null, stdout, stderr, timedOut, spawnError: (e as Error).message })
      return
    }
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, opts.timeoutMs)
    child.stdout.on('data', (d: Buffer) => { if (stdout.length < 65536) stdout += d.toString('utf8') })
    child.stderr.on('data', (d: Buffer) => { if (stderr.length < 65536) stderr += d.toString('utf8') })
    child.on('error', (e) => {
      clearTimeout(timer)
      resolve({ code: null, stdout, stderr, timedOut, spawnError: e.message })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code, stdout, stderr, timedOut })
    })
    // The value goes in on stdin and the pipe is closed; an EPIPE from a child that exited early is
    // reported by its exit code, not here.
    child.stdin.on('error', () => undefined)
    child.stdin.end(opts.input ?? '')
  })
}

/** The first line of the reason, with every occurrence of the secret removed. */
function said(text: string, secret?: string): string {
  const line = (text.trim().split('\n').find((l) => l.trim()) ?? '').slice(0, 300)
  return secret ? line.split(secret).join('«redacted»') : line
}

export function createObservatoryVault(opts: {
  /** Overrides the launcher lookup; tests point it at a fake engine. */
  launcher?: string
  env?: NodeJS.ProcessEnv
  timeoutMs?: number
} = {}): VaultPort {
  const env = opts.env ?? process.env
  const timeoutMs = opts.timeoutMs ?? 7000

  async function engine(): Promise<VaultAnswer<{ engine: Engine }>> {
    const launcher = opts.launcher ?? 'project-observatory'
    const found = await new Promise<{ path: string | null; reason?: string }>((resolve) =>
      execFile(launcher, ['full-path'], { env, timeout: 5000 }, (e, stdout) => {
        if (e) {
          const code = (e as NodeJS.ErrnoException).code
          resolve({ path: null, reason: code === 'ENOENT' ? 'Project Observatory is not installed: `project-observatory` was not found on PATH' : `\`project-observatory full-path\` failed: ${said(String((e as Error).message))}` })
        } else resolve({ path: stdout.trim() })
      })
    )
    if (!found.path) return { ok: false, reason: found.reason as string }
    const tools = path.join(found.path, 'tools')
    if (!existsSync(path.join(tools, 'vault.py')) || !existsSync(path.join(tools, 'use_secret.py')))
      return { ok: false, reason: `Project Observatory's engine at ${found.path} has no vault tools` }
    let python = 'python3'
    try {
      const resolved = await new Promise<string>((resolve, reject) =>
        execFile('/usr/bin/which', [launcher], { env, timeout: 2000 }, (e, out) => (e ? reject(e) : resolve(out.trim())))
      )
      const first = readFileSync(path.isAbsolute(launcher) ? launcher : resolved, 'utf8').split('\n')[0]
      const shebang = /^#!(\/\S+python[0-9.]*)\s*$/.exec(first)
      if (shebang && existsSync(shebang[1])) python = shebang[1]
    } catch (e) {
      // The launcher's interpreter is a preference, not a requirement: fall back to python3 and say so.
      ops.record({ op: 'vault.interpreter', outcome: 'ok', level: 'warn', detail: { note: 'using python3 from PATH', reason: String((e as Error).message).slice(0, 200) }, ctx: { correlationId: ops.correlate() } })
    }
    return { ok: true, engine: { tools, python } }
  }

  function checkSlot(slot: SecretSlot): string | null {
    if (!PROJECT.test(slot.project)) return `vault project ${JSON.stringify(slot.project)} is not a folder name`
    if (!['local', 'stage', 'prod'].includes(slot.env)) return `vault env ${JSON.stringify(slot.env)} is not local, stage or prod`
    if (!NAME.test(slot.name)) return `vault name ${JSON.stringify(slot.name)} is not UPPER_SNAKE_CASE`
    return null
  }

  async function where(e: Engine, slot: SecretSlot): Promise<'vault' | 'elsewhere' | 'absent' | { reason: string }> {
    const r = await run(e.python, [path.join(e.tools, 'use_secret.py'), 'where', '--env', slot.env, slot.project, slot.name], { timeoutMs, env })
    if (r.spawnError || r.timedOut) return { reason: r.timedOut ? 'Project Observatory did not answer in time' : `Project Observatory could not be run: ${r.spawnError}` }
    const out = r.stdout.trim()
    if (r.code === 0 && out.startsWith('vault:')) return 'vault'
    if (r.code === 0 && out) return 'elsewhere'
    return 'absent'
  }

  return {
    async put(slot, value) {
      const bad = checkSlot(slot)
      if (bad) return { ok: false, reason: bad }
      if (!value || value.length > 8192) return { ok: false, reason: 'the secret is empty or longer than 8192 characters' }
      const found = await engine()
      if (!found.ok) return found
      const w = await where(found.engine, slot)
      if (typeof w === 'object') return { ok: false, reason: w.reason }
      const verb = w === 'vault' ? 'rotate' : 'put'
      const r = await run(found.engine.python, [path.join(found.engine.tools, 'vault.py'), verb, slot.project, slot.env, slot.name], { input: value, timeoutMs, env })
      if (r.code === 0) {
        ops.record({ op: 'vault.put', outcome: 'ok', detail: { slot: `${slot.project}/${slot.env}/${slot.name}`, verb }, ctx: { correlationId: ops.correlate() } })
        return { ok: true }
      }
      const reason = r.timedOut ? 'Project Observatory did not store the secret in time' : r.spawnError ? `Project Observatory could not be run: ${r.spawnError}` : `the vault refused it: ${said(r.stderr || r.stdout, value)}`
      ops.record({ op: 'vault.put', outcome: 'failed', level: 'error', detail: { slot: `${slot.project}/${slot.env}/${slot.name}`, verb, reason }, ctx: { correlationId: ops.correlate() } })
      return { ok: false, reason }
    },

    async read(slot) {
      const bad = checkSlot(slot)
      if (bad) return { ok: false, reason: bad }
      const found = await engine()
      if (!found.ok) return found
      const w = await where(found.engine, slot)
      if (typeof w === 'object') return { ok: false, reason: w.reason }
      if (w !== 'vault')
        return { ok: false, reason: w === 'elsewhere' ? `${slot.name} resolves to a file outside the vault; Fabric reads a product secret from the vault only` : `${slot.name} is not in the vault under ${slot.project}/${slot.env}; connect the product again` }

      const dir = mkdtempSync(path.join(tmpdir(), 'fabric-secret-'))
      const fifo = path.join(dir, 'value')
      try {
        const made = await run('/usr/bin/mkfifo', ['-m', '600', fifo], { timeoutMs: 2000, env })
        if (made.code !== 0) return { ok: false, reason: `could not make the pipe the secret travels through: ${said(made.stderr)}` }
        const chunks: Buffer[] = []
        const reading = new Promise<void>((resolve, reject) => {
          const stream = createReadStream(fifo)
          stream.on('data', (c) => chunks.push(c as Buffer))
          stream.on('end', () => resolve())
          stream.on('error', reject)
        })
        const child = run(
          found.engine.python,
          [path.join(found.engine.tools, 'use_secret.py'), 'run', '--env', slot.env, slot.project, slot.name, '--', '/bin/sh', '-c', `printf %s "$${slot.name}" > "$1"`, 'sh', fifo],
          { timeoutMs, env }
        )
        const r = await child
        if (r.code !== 0) {
          // The reader is still waiting to open its end; opening the write end once and closing it
          // gives it end-of-file, so no thread is left blocked on a pipe nobody will write.
          try {
            closeSync(openSync(fifo, constants.O_WRONLY | constants.O_NONBLOCK))
          } catch (e) {
            // ENXIO means no reader is waiting any more; nothing is left to release.
            if ((e as NodeJS.ErrnoException).code !== 'ENXIO') ops.failed('vault.read-release', e)
          }
          await reading.catch(() => undefined)
          return { ok: false, reason: r.timedOut ? 'Project Observatory did not hand the secret over in time' : `Project Observatory refused to hand the secret over: ${said(r.stderr)}` }
        }
        await reading
        const value = Buffer.concat(chunks).toString('utf8')
        if (!value) return { ok: false, reason: `${slot.name} is empty in the vault` }
        return { ok: true, value }
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    }
  }
}
// #endregion product-secret-vault

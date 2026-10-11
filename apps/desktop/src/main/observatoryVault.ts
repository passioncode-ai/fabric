// #region product-secret-vault — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#4-a-product-is-connected-once-by-the-products-own-consent
// Where a connected product's secret lives: Project Observatory's vault, through its own doors
// (ADR-0115 §4, "a product secret kept outside the vault" is refused). Fabric creates no Keychain item
// and writes the secret to no file of its own.
//
//   store:  `python3 "$(project-observatory full-path)/tools/vault.py" put|rotate fabric <env> <NAME>`,
//           the value on STDIN only — never argv, never the environment, never a log line.
//   read:   `use_secret.py where` first, and anything but a vault slot is refused (its answer names
//           WHERE a value lives, which is the better refusal); then
//           `use_secret.py run --env <env> --vault-only fabric <NAME> -- /bin/sh -c 'printf %s "$NAME" > "$1"' sh <fifo>`.
//           `--vault-only` makes the read itself refuse anything but the vault, so a value that appears
//           in an env file between `where` and `run` is never used (ER-10, verification iteration 1 for
//           0.3.1). `run` scrubs the value from everything its child PRINTS, so the value cannot come
//           back on stdout; it comes back through a named pipe in a 0700 directory of our own, written by
//           the shell's builtin `printf` from the child's environment — so it is in no argv either — and
//           it is held in memory for the one call that needs it.
//
// THE PIPE NEVER WAITS ON A THREAD (ER-3/ER-4). Opening a FIFO for reading blocks until a writer opens
// it, and `createReadStream` did that open on libuv's thread pool (four threads in Electron's main
// process): four key reads at once stalled every fs call, DNS lookup and async crypto of the app, and a
// `run` that exited 0 without writing parked a thread for ever, so the read never ended and the app
// could not quit. The read end is now opened O_NONBLOCK (returns at once), drained with non-blocking
// reads while `run` lives and once more after it exits; a run that wrote nothing is a refusal, "the vault
// handed nothing over", never a wait. (An inherited extra pipe would need no FIFO at all, but `run`
// starts its child with Python's `close_fds=True`, so an fd 3 never reaches the shell.)
//
// THE INTERPRETER is the one Observatory's own launcher names in its first line (its venv), because a
// Dock-launched app's PATH puts the system's `python3` first and the engine's tools are not written
// for it. A launcher without a readable first line falls back to `python3` on PATH.

import { execFile, spawn } from 'node:child_process'
import { constants, closeSync, existsSync, mkdtempSync, openSync, readFileSync, readSync, rmSync } from 'node:fs'
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
  /** `signal`: the caller that wanted the value has gone; a read still waiting for its turn gives up. */
  read(slot: SecretSlot, options?: { signal?: AbortSignal }): Promise<VaultAnswer<{ value: string }>>
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
  opts: { input?: string; timeoutMs: number; env?: NodeJS.ProcessEnv; signal?: AbortSignal }
): Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean; spawnError?: string }> {
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let timedOut = false
    let child
    try {
      child = spawn(cmd, args, { env: opts.env ?? process.env, stdio: ['pipe', 'pipe', 'pipe'], signal: opts.signal })
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

  async function resolveEngine(): Promise<VaultAnswer<{ engine: Engine }>> {
    // Windows (0.3.5, CO-238): the vault hands a secret over a POSIX FIFO through `/bin/sh`, neither of which Windows
    // has. Said as unavailable, never attempted, so a connected product's secret stays where it is.
    if (process.platform === 'win32')
      return { ok: false, reason: 'Project Observatory\'s vault is not available on Windows yet: it hands a secret over a POSIX pipe' }
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

  // V2 ER-4: cache only the engine location, never its secret. Share the initial lookup across reads.
  let cachedEngine: Promise<VaultAnswer<{ engine: Engine }>> | null = null
  function engine(): Promise<VaultAnswer<{ engine: Engine }>> {
    if (!cachedEngine) cachedEngine = resolveEngine().then((answer) => {
      if (!answer.ok) cachedEngine = null
      return answer
    })
    return cachedEngine
  }
  let active = 0
  const waiting: Array<() => void> = []
  async function limited<T extends object>(signal: AbortSignal | undefined, work: () => Promise<VaultAnswer<T>>): Promise<VaultAnswer<T>> {
    if (signal?.aborted) return { ok: false, reason: 'vault read cancelled' }
    if (active >= 4) {
      if (waiting.length >= 64) return { ok: false, reason: 'the vault read queue is full; try again later' }
      const admitted = await new Promise<boolean>((resolve) => {
        const next = (): void => { signal?.removeEventListener('abort', cancel); resolve(true) }
        const cancel = (): void => {
          const i = waiting.indexOf(next)
          if (i >= 0) waiting.splice(i, 1)
          resolve(false)
        }
        waiting.push(next)
        signal?.addEventListener('abort', cancel, { once: true })
        if (signal?.aborted) cancel()
      })
      if (!admitted) return { ok: false, reason: 'vault read cancelled' }
    } else active++
    try {
      if (signal?.aborted) return { ok: false, reason: 'vault read cancelled' }
      return await work()
    } finally {
      const next = waiting.shift()
      if (next) next() // transfer the slot without a race against a newly arriving caller
      else active--
    }
  }

  function checkSlot(slot: SecretSlot): string | null {
    if (!PROJECT.test(slot.project)) return `vault project ${JSON.stringify(slot.project)} is not a folder name`
    if (!['local', 'stage', 'prod'].includes(slot.env)) return `vault env ${JSON.stringify(slot.env)} is not local, stage or prod`
    if (!NAME.test(slot.name)) return `vault name ${JSON.stringify(slot.name)} is not UPPER_SNAKE_CASE`
    return null
  }

  async function where(e: Engine, slot: SecretSlot): Promise<'vault' | 'elsewhere' | 'absent' | { reason: string }> {
    const r = await run(e.python, [path.join(e.tools, 'use_secret.py'), 'where', '--env', slot.env, slot.project, slot.name], { timeoutMs, env })
    if (r.spawnError) cachedEngine = null
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

    async read(slot, options) {
      return limited(options?.signal, async () => {
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
      let fd: number | null = null
      try {
        const made = await run('/usr/bin/mkfifo', ['-m', '600', fifo], { timeoutMs: 2000, env })
        if (made.code !== 0) return { ok: false, reason: `could not make the pipe the secret travels through: ${said(made.stderr)}` }
        // Non-blocking: the open returns at once although no writer exists yet, and every read below
        // answers at once — data, end-of-file, or EAGAIN while the writer has not written.
        fd = openSync(fifo, constants.O_RDONLY | constants.O_NONBLOCK)
        const chunks: Buffer[] = []
        let size = 0
        const drain = (): void => {
          const buf = Buffer.alloc(16384)
          for (;;) {
            let n: number
            try {
              n = readSync(fd as number, buf, 0, buf.length, null)
            } catch (e) {
              if ((e as NodeJS.ErrnoException).code === 'EAGAIN') return
              throw e
            }
            if (n === 0) return
            size += n
            if (size > 65536) throw new Error('the vault handed over more than 64 KiB; refused')
            chunks.push(Buffer.from(buf.subarray(0, n)))
          }
        }
        // Drained while `run` lives, so a writer is never left blocked on a full pipe.
        const poll = setInterval(() => {
          try {
            drain()
          } catch {
            // The final drain after `run` exits reports it; nothing is dropped silently.
          }
        }, 25)
        let r: Awaited<ReturnType<typeof run>>
        try {
          r = await run(
            found.engine.python,
            [path.join(found.engine.tools, 'use_secret.py'), 'run', '--env', slot.env, '--vault-only', slot.project, slot.name, '--', '/bin/sh', '-c', `printf %s "$${slot.name}" > "$1"`, 'sh', fifo],
            { timeoutMs, env, signal: options?.signal }
          )
        } finally {
          clearInterval(poll)
        }
        try {
          drain()
        } catch (e) {
          return { ok: false, reason: (e as Error).message }
        }
        if (r.spawnError) cachedEngine = null
        if (options?.signal?.aborted) return { ok: false, reason: 'vault read cancelled' }
        if (r.code !== 0)
          return { ok: false, reason: r.timedOut ? 'Project Observatory did not hand the secret over in time' : `Project Observatory refused to hand the secret over: ${said(r.stderr)}` }
        const value = Buffer.concat(chunks).toString('utf8')
        if (!value) return { ok: false, reason: `the vault handed nothing over for ${slot.name}: \`use_secret.py run\` ended without writing the value` }
        return { ok: true, value }
      } finally {
        if (fd !== null) closeSync(fd)
        rmSync(dir, { recursive: true, force: true })
      }
      })
    }
  }
}
// #endregion product-secret-vault

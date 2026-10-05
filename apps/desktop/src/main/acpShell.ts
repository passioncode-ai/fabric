// #region acp-shell — docs: docs/adr/0119-acp-is-the-generic-runner-drive-and-runners-are-catalogue-rows.md#1-acp-is-the-generic-drive-mode-for-a-runner
/**
 * The ACP terminal shell (P-10 AS-04, ADR-0119): the program Fabric starts in a session's terminal
 * for a runner that speaks the Agent Client Protocol (Hermes Agent, Cline, …). It is an ACP CLIENT:
 * it starts the agent over stdio, opens one session whose `session/new` carries Fabric's surface,
 * sends the brief as the first prompt, then turns each line the person types into a prompt and
 * prints what the agent does. A permission the agent asks for is answered by the PERSON at this
 * terminal in `ask` mode — never by this program — and by the mode's rule otherwise.
 *
 * Runs as its own process (`acpShellMain.ts`), so nothing here touches Electron; every edge is
 * injected, which is what lets the test drive it against a fixture agent with no terminal at all.
 *
 * What it never does: write the agent's configuration, put the credential in an argument, keep a
 * permission it was not given, or call a session connected because the agent started.
 */
import { createInterface } from 'node:readline'
import type { Readable, Writable } from 'node:stream'

/** ACP's own MCP server shapes (agentclientprotocol.com/protocol/session-setup). */
export type AcpMcpServer =
  | { type: 'http'; name: string; url: string; headers: { name: string; value: string }[] }
  | { name: string; command: string; args: string[]; env: { name: string; value: string }[] }

/** What Fabric hands the shell in `FABRIC_ACP_SESSION` (the environment, never argv). */
export interface AcpSessionSpec {
  /** The project folder the agent works in; the shell's own working directory when absent
   *  (Fabric starts the shell in the project folder). */
  cwd?: string
  /** Fabric's surface over HTTP, used when the agent declares `mcpCapabilities.http`. */
  http: Extract<AcpMcpServer, { type: 'http' }>
  /** The same surface through Fabric's stdio bridge, for an agent that declares no HTTP MCP. */
  stdio: Exclude<AcpMcpServer, { type: 'http' }>
  /** The brief and Fabric's preamble: the session's first prompt. */
  brief: string
  /** How a permission request is answered. */
  mode: 'ask' | 'bypass'
}

export interface AgentProcess {
  stdin: Writable
  stdout: Readable
  stderr: Readable | null
  kill(signal?: NodeJS.Signals): void
  onExit(listener: (code: number | null) => void): void
}

export interface AcpShellIo {
  /** The person's keystrokes, line by line (the session's PTY). */
  input: Readable
  /** What the person sees. */
  output: Writable
  /** Starts the agent; the shell owns the process until it exits. */
  spawnAgent(): AgentProcess
  /** Ctrl-C at the terminal. The agent runs in its own process group, so only the shell hears it. */
  onInterrupt?(listener: () => void): void
}

export const ACP_PROTOCOL_VERSION = 1
const FRAME_LIMIT = 4 * 1024 * 1024
const REQUEST_TIMEOUT_MS = 120_000
/** A browser sign-in takes a person minutes, not a request's two. */
const AUTH_TIMEOUT_MS = 15 * 60_000
const KILL_GRACE_MS = 3000

type Json = Record<string, unknown>
const record = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v)

/** Picks the surface the agent can take: HTTP when declared, otherwise the stdio bridge. */
export function surfaceFor(initializeResult: unknown, spec: Pick<AcpSessionSpec, 'http' | 'stdio'>): AcpMcpServer {
  const caps = record(initializeResult) && record(initializeResult.agentCapabilities) ? initializeResult.agentCapabilities : {}
  const mcp = record(caps.mcpCapabilities) ? caps.mcpCapabilities : {}
  return mcp.http === true ? spec.http : spec.stdio
}

/** The option a mode chooses without asking, or null when the person must be asked. */
export function automaticChoice(mode: AcpSessionSpec['mode'], options: unknown): string | null {
  if (mode !== 'bypass' || !Array.isArray(options)) return null
  const allow = options.filter(record).find((o) => o.kind === 'allow_once') ?? options.filter(record).find((o) => o.kind === 'allow_always')
  return allow && typeof allow.optionId === 'string' ? allow.optionId : null
}

/** The option a person's answer selects: `y` allows once, anything else rejects once. */
export function answeredChoice(answer: string, options: unknown): string | null {
  if (!Array.isArray(options)) return null
  const wanted = /^\s*y(es)?\s*$/i.test(answer) ? ['allow_once'] : ['reject_once', 'reject_always']
  const hit = options.filter(record).find((o) => wanted.includes(String(o.kind)))
  return hit && typeof hit.optionId === 'string' ? hit.optionId : null
}

/** One line of what the agent did, or null for an update a person does not need to see. */
export function describeUpdate(update: unknown): string | null {
  if (!record(update)) return null
  const content = record(update.content) ? update.content : null
  switch (update.sessionUpdate) {
    case 'agent_message_chunk':
      return content && content.type === 'text' && typeof content.text === 'string' ? content.text : null
    case 'agent_thought_chunk':
      return content && content.type === 'text' && typeof content.text === 'string' ? `\x1b[2m${content.text}\x1b[22m` : null
    case 'tool_call':
      return `\n\x1b[36m• ${String(update.title ?? 'tool')}\x1b[39m${update.status ? ` (${String(update.status)})` : ''}\n`
    case 'tool_call_update':
      return update.status === 'failed' ? `\x1b[31m  failed\x1b[39m\n` : null
    case 'plan':
      return Array.isArray(update.entries)
        ? '\n' + update.entries.filter(record).map((e) => `  ${e.status === 'completed' ? '✓' : '·'} ${String(e.content ?? '')}`).join('\n') + '\n'
        : null
    default:
      return null
  }
}

/** ACP's "authentication required" refusal: code -32000, or a message saying so (agents differ). */
export function isAuthRequired(error: unknown): boolean {
  const e = error as { code?: unknown; message?: unknown } | null
  return e?.code === -32000 || /auth(entication|enticate)? required|call authenticate/i.test(String(e?.message ?? ''))
}

/** A minimal JSON-RPC 2.0 peer over newline-delimited JSON, bounded per frame. */
function peer(proc: AgentProcess, handlers: {
  request(method: string, params: unknown): Promise<unknown>
  notification(method: string, params: unknown): void
  closed(): void
}) {
  let serial = 0
  let buffer = ''
  const pending = new Map<number, { resolve(v: unknown): void; reject(e: Error): void; timer: ReturnType<typeof setTimeout> }>()
  const send = (message: Json): void => { proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n') }
  proc.stdout.setEncoding('utf8')
  proc.stdout.on('data', (chunk: string) => {
    buffer += chunk
    if (buffer.length > FRAME_LIMIT) { buffer = ''; return }
    let newline: number
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim()
      buffer = buffer.slice(newline + 1)
      if (!line) continue
      let message: unknown
      try { message = JSON.parse(line) } catch { continue /* A non-JSON line from the agent is not protocol. */ }
      if (!record(message)) continue
      if (typeof message.method === 'string' && message.id !== undefined) {
        const id = message.id
        handlers.request(message.method, message.params).then(
          (result) => send({ id, result }),
          (error: unknown) => send({ id, error: { code: -32601, message: error instanceof Error ? error.message : 'refused' } })
        )
      } else if (typeof message.method === 'string') handlers.notification(message.method, message.params)
      else if (typeof message.id === 'number' && pending.has(message.id)) {
        const p = pending.get(message.id)!
        pending.delete(message.id)
        clearTimeout(p.timer)
        if (message.error !== undefined) {
          const e = record(message.error) ? message.error : {}
          const err = new Error(typeof e.message === 'string' ? e.message : 'agent error') as Error & { code?: unknown }
          err.code = e.code
          p.reject(err)
        } else p.resolve(message.result)
      }
    }
  })
  proc.stdout.on('close', () => {
    for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error('the agent closed its output')) }
    pending.clear()
    handlers.closed()
  })
  return {
    request(method: string, params: unknown, timeoutMs: number = REQUEST_TIMEOUT_MS): Promise<unknown> {
      const id = ++serial
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} did not answer`)) }, timeoutMs)
        pending.set(id, { resolve, reject, timer })
        send({ id, method, params })
      })
    },
    notify(method: string, params: unknown): void { send({ method, params }) }
  }
}

/** Runs one ACP session in a terminal. Resolves with the exit code the shell should end with. */
export async function runAcpShell(spec: AcpSessionSpec, io: AcpShellIo): Promise<number> {
  const out = (text: string): void => { io.output.write(text) }
  const proc = io.spawnAgent()
  let exited: number | null | undefined
  const agentExit = new Promise<number | null>((resolve) => proc.onExit((code) => { exited = code; resolve(code) }))
  proc.stderr?.on('data', (chunk: Buffer) => { io.output.write(`\x1b[2m${chunk.toString('utf8')}\x1b[22m`) })

  // Permission questions and prompts share the terminal: a question takes the next line.
  const lines = createInterface({ input: io.input, terminal: false })
  const waiting: ((line: string) => void)[] = []
  const queued: string[] = []
  let inputClosed = false
  lines.on('line', (line) => { const next = waiting.shift(); if (next) next(line); else queued.push(line) })
  lines.on('close', () => { inputClosed = true; for (const w of waiting.splice(0)) w('') })
  const nextLine = (): Promise<string | null> =>
    queued.length ? Promise.resolve(queued.shift()!) : inputClosed ? Promise.resolve(null) : new Promise((resolve) => waiting.push((l) => resolve(inputClosed && l === '' ? null : l)))

  let sessionId: string | null = null
  const rpc = peer(proc, {
    async request(method, params) {
      if (method === 'session/request_permission') {
        const p = record(params) ? params : {}
        const call = record(p.toolCall) ? p.toolCall : {}
        const auto = automaticChoice(spec.mode, p.options)
        if (auto) return { outcome: { outcome: 'selected', optionId: auto } }
        out(`\n\x1b[33mThe agent asks to: ${String(call.title ?? call.toolCallId ?? 'use a tool')}. Allow once? [y/N] \x1b[39m`)
        const answer = await nextLine()
        const chosen = answer === null ? null : answeredChoice(answer, p.options)
        return chosen ? { outcome: { outcome: 'selected', optionId: chosen } } : { outcome: { outcome: 'cancelled' } }
      }
      // The shell declared no file system and no terminal capability: the agent uses its own.
      throw new Error(`${method} is not offered by this client`)
    },
    notification(method, params) {
      if (method !== 'session/update' || !record(params)) return
      const text = describeUpdate(params.update)
      if (text) out(text)
    },
    closed() { /* The exit listener reports the end. */ }
  })

  // The end of a session: cancel it on the agent's side, close the agent's input (an ACP agent ends
  // on EOF), then SIGTERM after the grace and SIGKILL after another — within the app's quit drain.
  const stop = async (code: number): Promise<number> => {
    if (sessionId) rpc.notify('session/cancel', { sessionId })
    lines.close()
    if (exited === undefined) {
      proc.stdin.end()
      const term = setTimeout(() => proc.kill('SIGTERM'), KILL_GRACE_MS)
      const kill = setTimeout(() => proc.kill('SIGKILL'), 2 * KILL_GRACE_MS)
      await agentExit
      clearTimeout(term); clearTimeout(kill)
    }
    return code
  }

  let init: unknown
  try {
    init = await rpc.request('initialize', {
      protocolVersion: ACP_PROTOCOL_VERSION,
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
      clientInfo: { name: 'fabric', title: 'Fabric', version: '0' }
    })
  } catch {
    out('\nFabric could not start an ACP session with this agent: it did not answer `initialize`.\n')
    return stop(2)
  }
  const surface = surfaceFor(init, spec)
  const openSession = async (): Promise<string | null> => {
    const created = await rpc.request('session/new', { cwd: spec.cwd ?? process.cwd(), mcpServers: [surface] })
    return record(created) && typeof created.sessionId === 'string' ? created.sessionId : null
  }
  const methods = record(init) && Array.isArray(init.authMethods) ? init.authMethods.filter(record) : []
  try {
    sessionId = await openSession()
  } catch (error) {
    // ACP's sign-in: the agent refuses `session/new` until `authenticate` names one of its methods.
    // The PERSON picks the method here; Fabric never signs in on their behalf.
    if (!isAuthRequired(error) || methods.length === 0) {
      out(`\nThe agent did not open a session${error instanceof Error && error.message ? `: ${error.message}` : ''}.\n`)
      return stop(3)
    }
    out(`\nThe agent asks you to sign in before the session opens:\n` +
      methods.map((m, i) => `  ${i + 1}. ${String(m.name ?? m.id)}${m.description ? ` — ${String(m.description)}` : ''}`).join('\n') +
      `\nType a number to sign in that way, or press Enter to close the session: `)
    const pick = Number.parseInt((await nextLine()) ?? '', 10)
    const method = methods[pick - 1]
    if (!method || typeof method.id !== 'string') { out('\nThe session was not opened.\n'); return stop(3) }
    try {
      await rpc.request('authenticate', { methodId: method.id }, AUTH_TIMEOUT_MS)
      sessionId = await openSession()
    } catch (again) {
      out(`\nSigning in did not open a session${again instanceof Error && again.message ? `: ${again.message}` : ''}.\n`)
      return stop(3)
    }
  }
  if (!sessionId) { out('\nThe agent opened no session (no session id).\n'); return stop(3) }
  out(`\x1b[2mFabric: connected through ${'type' in surface ? 'HTTP' : 'the stdio bridge'}; sending the session brief.\x1b[22m\n`)

  let turn: Promise<unknown> | null = null
  const prompt = (text: string): Promise<unknown> => {
    turn = rpc.request('session/prompt', { sessionId, prompt: [{ type: 'text', text }] })
      .then((r) => { const reason = record(r) ? r.stopReason : null; out(`\n\x1b[2m(${String(reason ?? 'done')})\x1b[22m\n> `) },
        (e: unknown) => { out(`\n\x1b[31mThe turn ended with an error: ${e instanceof Error ? e.message : 'unknown'}\x1b[39m\n> `) })
      .finally(() => { turn = null })
    return turn
  }
  // Ctrl-C while a turn runs cancels that turn (`session/cancel`); the session goes on.
  io.onInterrupt?.(() => {
    if (turn && sessionId) { rpc.notify('session/cancel', { sessionId }); out('\n\x1b[2m(cancelling the turn)\x1b[22m\n') }
    else out('\n\x1b[2mCtrl-D ends the session.\x1b[22m\n> ')
  })
  await prompt(spec.brief)

  for (;;) {
    if (exited !== undefined) { out('\nThe agent exited.\n'); return exited ?? 1 }
    const line = await Promise.race([nextLine(), agentExit.then(() => '\u0000exit')])
    if (line === '\u0000exit') continue
    if (line === null) return stop(0)
    if (!line.trim()) continue
    if (turn) await turn
    await prompt(line)
  }
}

// #endregion acp-shell

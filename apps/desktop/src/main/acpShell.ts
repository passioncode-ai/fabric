// #region acp-shell — docs: docs/adr/0119-acp-is-the-generic-runner-drive-and-runners-are-catalogue-rows.md#amendment-4--2026-10-06-what-the-032-verification-changed-and-what-is-not-built-yet
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
  /** The project's granted gateway servers, as HTTP MCP servers (they live on the machine's gateway). */
  grants?: Extract<AcpMcpServer, { type: 'http' }>[]
  /**
   * The same granted servers, each through its own stdio bridge (same order, same names), for an
   * agent that declares no HTTP MCP (audit 2026-10-06 DA-2: Hermes 0.21.4 was sent none of them).
   * When these cannot carry every grant, the session is refused rather than opened without them.
   */
  grantsOverStdio?: Exclude<AcpMcpServer, { type: 'http' }>[]
}

export interface AgentProcess {
  stdin: Writable
  stdout: Readable
  stderr: Readable | null
  /** Signals the agent's whole process group — its own tools included — not only the agent. */
  kill(signal?: NodeJS.Signals): void
  /** Whether anything in the agent's process group still runs. A group outlives its leader: an
   *  agent that exits on end of input leaves the tools it started running (audit 2026-10-06 DA-1). */
  alive(): boolean
  onExit(listener: (code: number | null) => void): void
}

export interface AcpShellIo {
  /** The person's keystrokes, line by line (the session's PTY). */
  input: Readable
  /** What the person sees. */
  output: Writable
  /** Starts the agent; the shell owns the process until it exits. */
  spawnAgent(): AgentProcess
  /** Ctrl-C at the terminal. The agent runs in its own process group, so only the shell hears it.
   *  Registered when the shell starts: before the session opens it ends the shell (exit 130). */
  onInterrupt?(listener: () => void): void
  /**
   * SIGTERM or SIGHUP to the shell — a session stop or the app's quit. The agent sits in its own
   * process group, so a signal to the PTY's group never reaches it: the shell must end it (audit
   * 2026-10-05 A7-003 — the agent and its children were orphaned to launchd).
   */
  onTerminate?(listener: () => void): void
  /** Request deadlines; a test shortens them. A turn (`session/prompt`) never has one. */
  timeouts?: { requestMs?: number; authMs?: number }
}

export const ACP_PROTOCOL_VERSION = 1
const FRAME_LIMIT = 4 * 1024 * 1024
const REQUEST_TIMEOUT_MS = 120_000
/** A browser sign-in takes a person minutes, not a request's two. */
const AUTH_TIMEOUT_MS = 15 * 60_000
const KILL_GRACE_MS = 3000
const SWEEP_POLL_MS = 50

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

/**
 * The option a person's answer selects: `y` allows once, anything else rejects once. An agent that
 * offers only `allow_always` gets that for `y` (audit 2026-10-05 A7-007 — `y` was sent as
 * `cancelled`), and one that offers only `reject_always` gets that for anything else.
 */
export function answeredChoice(answer: string, options: unknown): string | null {
  if (!Array.isArray(options)) return null
  const offered = options.filter(record)
  const wanted = /^\s*y(es)?\s*$/i.test(answer) ? ['allow_once', 'allow_always'] : ['reject_once', 'reject_always']
  for (const kind of wanted) {
    const hit = offered.find((o) => o.kind === kind)
    if (hit && typeof hit.optionId === 'string') return hit.optionId
  }
  return null
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
function peer(proc: AgentProcess, defaultTimeoutMs: number, handlers: {
  request(method: string, params: unknown): Promise<unknown>
  notification(method: string, params: unknown): void
  closed(): void
}) {
  let serial = 0
  let buffer = ''
  let outputGone = false
  let inputGone = false
  const pending = new Map<number, { resolve(v: unknown): void; reject(e: Error): void; timer: ReturnType<typeof setTimeout> | undefined }>()
  // A write to an agent that stopped reading fails with EPIPE, emitted on its input — unhandled, that
  // crashed the shell with a raw stack (audit 2026-10-06 ER-3). Nothing is lost by ignoring it here:
  // the agent's output closing (below) and its exit report that end to the person.
  proc.stdin.on('error', () => { inputGone = true })
  const send = (message: Json): void => {
    if (inputGone || outputGone || proc.stdin.destroyed || proc.stdin.writableEnded) return
    proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n')
  }
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
    outputGone = true
    for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error('the agent closed its output')) }
    pending.clear()
    handlers.closed()
  })
  return {
    /** `timeoutMs: null` waits for the answer, the agent's exit or nothing — a turn ends that way. */
    request(method: string, params: unknown, timeoutMs: number | null = defaultTimeoutMs): Promise<unknown> {
      const id = ++serial
      // Asked after the agent closed its output, a request would wait for an answer that cannot come.
      if (outputGone) return Promise.reject(new Error('the agent closed its output'))
      if (inputGone) return Promise.reject(new Error('the agent stopped reading its input'))
      return new Promise((resolve, reject) => {
        const timer = timeoutMs === null ? undefined
          : setTimeout(() => { pending.delete(id); reject(new Error(`${method} did not answer`)) }, timeoutMs)
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
  /**
   * The next line typed AFTER now, ahead of any other waiter; lines typed earlier stay queued as
   * prompts. A permission question reads this way: audit 2026-10-05 A7-007 found a line typed ahead
   * during a turn answered the next question before the person had seen it — and so does the sign-in
   * pick (audit 2026-10-06 DO-21(b)). A question can be withdrawn (Ctrl-C): its waiter leaves the
   * queue, so the next line typed stays a prompt (audit 2026-10-06 DA-3).
   */
  const WITHDRAWN = Symbol('withdrawn')
  const asking = new Set<() => void>()
  const freshLine = (): Promise<string | null | typeof WITHDRAWN> =>
    inputClosed ? Promise.resolve(null) : new Promise((resolve) => {
      const waiter = (l: string): void => { asking.delete(withdraw); resolve(inputClosed && l === '' ? null : l) }
      const withdraw = (): void => {
        asking.delete(withdraw)
        const at = waiting.indexOf(waiter)
        if (at >= 0) waiting.splice(at, 1)
        resolve(WITHDRAWN)
      }
      asking.add(withdraw)
      waiting.unshift(waiter)
    })

  let sessionId: string | null = null
  let turn: Promise<unknown> | null = null
  const rpc = peer(proc, io.timeouts?.requestMs ?? REQUEST_TIMEOUT_MS, {
    async request(method, params) {
      if (method === 'session/request_permission') {
        const p = record(params) ? params : {}
        const call = record(p.toolCall) ? p.toolCall : {}
        const auto = automaticChoice(spec.mode, p.options)
        if (auto) return { outcome: { outcome: 'selected', optionId: auto } }
        out(`\n\x1b[33mThe agent asks to: ${String(call.title ?? call.toolCallId ?? 'use a tool')}. Allow once? [y/N] \x1b[39m`)
        const answer = await freshLine()
        if (answer === WITHDRAWN) return { outcome: { outcome: 'cancelled' } }
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
  // Every end, the agent's own included, then sweeps the agent's process group: a group outlives its
  // leader, and an agent that exits promptly on EOF left every tool it started running, orphaned to
  // launchd (audit 2026-10-06 DA-1 / ER-1 — the group was signalled only when the leader outlived
  // the grace).
  let stopping: Promise<number> | null = null
  const stop = (code: number): Promise<number> => (stopping ??= end(code))
  const sweep = async (): Promise<void> => {
    if (!proc.alive()) return
    proc.kill('SIGTERM')
    const deadline = Date.now() + KILL_GRACE_MS
    while (proc.alive() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, SWEEP_POLL_MS))
    if (proc.alive()) proc.kill('SIGKILL')
  }
  const end = async (code: number): Promise<number> => {
    if (sessionId && exited === undefined) rpc.notify('session/cancel', { sessionId })
    for (const withdraw of [...asking]) withdraw()
    lines.close()
    if (exited === undefined) {
      proc.stdin.end()
      const term = setTimeout(() => proc.kill('SIGTERM'), KILL_GRACE_MS)
      const kill = setTimeout(() => proc.kill('SIGKILL'), 2 * KILL_GRACE_MS)
      await agentExit
      clearTimeout(term); clearTimeout(kill)
    }
    await sweep()
    return code
  }

  io.onTerminate?.(() => { void stop(143) })
  // Ctrl-C is heard from the start (audit 2026-10-06 ER-2(b): before the session opened it ended the
  // shell by the default handler and left the agent running). Before the session opens it ends the
  // session, exit 130; afterwards it cancels the turn and withdraws any question pending in it — ACP's
  // prompt-turn §Cancellation (fetched 2026-10-06): "The Client MUST respond to all pending
  // `session/request_permission` requests with the `cancelled` outcome."
  let opened = false
  io.onInterrupt?.(() => {
    if (!opened) { out('\n'); void stop(130); return }
    const questions = [...asking]
    for (const withdraw of questions) withdraw()
    if (turn && sessionId) {
      rpc.notify('session/cancel', { sessionId })
      out(`\n\x1b[2m(${questions.length ? 'the question was withdrawn; ' : ''}cancelling the turn)\x1b[22m\n`)
    } else out('\n\x1b[2mCtrl-D ends the session.\x1b[22m\n> ')
  })

  let init: unknown
  try {
    init = await rpc.request('initialize', {
      protocolVersion: ACP_PROTOCOL_VERSION,
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
      clientInfo: { name: 'fabric', title: 'Fabric', version: '0' }
    })
  } catch (error) {
    // A stop (Ctrl-C, a session stop) during `initialize` is that stop's end, not a failed start.
    if (stopping) return stopping
    // Told to the person at this terminal, with its cause (an agent that never started, one that closed
    // its output, one that did not answer); exit code 2 reaches the journal through the PTY's exit record.
    const cause = error instanceof Error && error.message ? error.message : 'no answer'
    out(`\nFabric could not start an ACP session with this agent: \`initialize\` failed (${cause}).\n`)
    return stop(2)
  }
  const surface = surfaceFor(init, spec)
  const overHttp = 'type' in surface
  const grants = spec.grants ?? []
  // The project's granted servers go with the surface on either path (audit 2026-10-06 DA-2): as HTTP
  // servers to an agent that takes them, else each through its own stdio bridge. A grant that cannot
  // be carried refuses the session, as the bundle refuses a launch missing one (M127): started without
  // a server it was given, the agent looks for the tool, does not find it, and improvises.
  const carried: AcpMcpServer[] = overHttp ? grants : (spec.grantsOverStdio ?? [])
  const names = (list: readonly { name: string }[]): string => list.map((g) => g.name).join(', ')
  if (names(carried) !== names(grants)) {
    out(`\n\x1b[33mFabric: this agent takes no HTTP MCP servers, and the project's ${grants.length} granted server(s) (${names(grants)}) cannot reach it through the stdio bridge, so the session was not opened.\x1b[39m\n`)
    return stop(3)
  }
  const servers: AcpMcpServer[] = [surface, ...carried]
  const openSession = async (): Promise<string | null> => {
    const created = await rpc.request('session/new', { cwd: spec.cwd ?? process.cwd(), mcpServers: servers })
    return record(created) && typeof created.sessionId === 'string' ? created.sessionId : null
  }
  const methods = record(init) && Array.isArray(init.authMethods) ? init.authMethods.filter(record) : []
  try {
    sessionId = await openSession()
  } catch (error) {
    if (stopping) return stopping
    // ACP's sign-in: the agent refuses `session/new` until `authenticate` names one of its methods.
    // The PERSON picks the method here; Fabric never signs in on their behalf.
    if (!isAuthRequired(error) || methods.length === 0) {
      out(`\nThe agent did not open a session${error instanceof Error && error.message ? `: ${error.message}` : ''}.\n`)
      return stop(3)
    }
    out(`\nThe agent asks you to sign in before the session opens:\n` +
      methods.map((m, i) => `  ${i + 1}. ${String(m.name ?? m.id)}${m.description ? ` — ${String(m.description)}` : ''}`).join('\n') +
      `\nType a number to sign in that way, or press Enter to close the session: `)
    const answer = await freshLine()
    if (stopping) return stopping
    const method = typeof answer === 'string' ? methods[Number.parseInt(answer, 10) - 1] : undefined
    if (!method || typeof method.id !== 'string') { out('\nThe session was not opened.\n'); return stop(3) }
    try {
      await rpc.request('authenticate', { methodId: method.id }, io.timeouts?.authMs ?? AUTH_TIMEOUT_MS)
      sessionId = await openSession()
    } catch (again) {
      if (stopping) return stopping
      // The shell's only reader is the person at this terminal: the failure is told there, and the
      // session ends with exit code 3, which the PTY's own exit record carries to the journal.
      out(`\nSigning in did not open a session${again instanceof Error && again.message ? `: ${again.message}` : ''}.\n`)
      return stop(3)
    }
  }
  if (stopping) return stopping
  if (!sessionId) { out('\nThe agent opened no session (no session id).\n'); return stop(3) }
  opened = true
  out(`\x1b[2mFabric: connected through ${overHttp ? 'HTTP' : 'the stdio bridge'}${carried.length ? ` with ${carried.length} granted server(s)` : ''}; sending the session brief.\x1b[22m\n`)

  const prompt = (text: string): Promise<unknown> => {
    // No deadline: a turn — permission waits included — takes as long as it takes, and ends by its
    // answer, by Ctrl-C (`session/cancel`) or by the agent's exit (audit 2026-10-05 A6-001: at 120 s
    // the turn was printed as an error while the agent kept working, and the next line was sent as
    // a second, concurrent prompt).
    turn = rpc.request('session/prompt', { sessionId, prompt: [{ type: 'text', text }] }, null)
      .then((r) => { const reason = record(r) ? r.stopReason : null; out(`\n\x1b[2m(${String(reason ?? 'done')})\x1b[22m\n> `) },
        (e: unknown) => { out(`\n\x1b[31mThe turn ended with an error: ${e instanceof Error ? e.message : 'unknown'}\x1b[39m\n> `) })
      .finally(() => { turn = null })
    return turn
  }
  await prompt(spec.brief)

  for (;;) {
    // Every way out goes through stop(), so the agent's group is swept before the shell exits.
    if (stopping) return stopping
    if (exited !== undefined) { out('\nThe agent exited.\n'); return stop(exited ?? 1) }
    const line = await Promise.race([nextLine(), agentExit.then(() => '\u0000exit')])
    if (line === '\u0000exit') continue
    if (line === null) return stop(0)
    if (!line.trim()) continue
    if (turn) await turn
    await prompt(line)
  }
}

// #endregion acp-shell

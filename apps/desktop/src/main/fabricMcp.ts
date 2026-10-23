// #region fabric-mcp — docs: docs/adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md#decision
// `fabric-mcp` (ADR-0134 §1): the MCP server a coding agent registers once — `claude mcp add --scope user fabric --
// <app>/bin/fabric-mcp --runner claude-code` — with no secret in the registration. To the agent it is one stable
// stdio session; to Fabric it is a client that finds the live hub each time (hub.ts#locateHub), asks the operator
// once for this runner on the folder's project, keeps the binding credentials 0600 in Fabric's registry root, and on
// every start enrolls (fabric.session.enroll) for a one-session bearer — the same a session Fabric launched gets.
//
// Until it holds a session the agent sees ONE tool, fabric_whoami, which says the state in a sentence and is an
// error, never a fake success. When the session opens, the agent is told the tool list changed. When Fabric
// restarts the session's bearer is gone: the proxy finds the new hub and enrolls again, silently under the grant.
//
// ONE CONSENT ACROSS PROCESSES (ADR-0134 amendment 2). A request waiting for the operator is kept on disk beside the
// credentials (`CredentialStore.pending`), so a restarted fabric-mcp — or a second one of the same runner — polls the
// request already on the operator's screen instead of asking again. A runner may hold several credentials (one per
// binding); each is tried, and none is ever overwritten by another.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import type { HubLocation } from './hub.ts'

export const WAITING_TOOL = 'fabric_whoami'

export type ProxyState =
  | { kind: 'starting' }
  | { kind: 'not-running'; reason: string }
  | { kind: 'not-a-hub'; reason: string }
  | { kind: 'no-project'; message: string }
  | { kind: 'waiting'; projectName: string }
  | { kind: 'denied'; projectName: string }
  | { kind: 'connected'; projectName: string; projectId: string }
  /** `hubSaid`: the hub was reached and refused with its own code and reason (a 503 `stack-starting`, review UX-3). */
  | { kind: 'failed'; reason: string; hubSaid?: HubRefusal }
  /** A rejoin (D2) found no live session of its runtime session: it asks nothing and waits to be called. */
  | { kind: 'not-enrolled'; message: string }

/** One tool call to the hub as a short-lived MCP client. A refused credential (HTTP 401/403) is `unauthorized`. */
export type HubCall = (url: string, bearer: string, tool: string, args: Record<string, unknown>) => Promise<
  /** `text`: an error's text when it carried no structured answer (an argument the hub's schema refused, PL-2). */
  { unauthorized: true } | { unauthorized?: false; isError: boolean; value: Record<string, unknown>; text?: string }
>

export interface SessionLink {
  listTools(): Promise<unknown[]>
  callTool(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>>
  close(): Promise<void>
  /** Leaves the session for good, telling Fabric first (the HTTP session's DELETE), then closes; bounded, never
   *  throws. Fabric ends an enrolled session whose agent left, so its claims do not outlive it (0.3.5 review i2 ER-4). */
  leave?(): Promise<void>
  /** One lightweight round trip on the session (MCP ping): the agent's sign of life while it works (TR-4). */
  ping?(): Promise<void>
  /** Set by the proxy: called once when the session ends (Fabric quit, the bearer revoked). */
  onclose?: () => void
}

/** A request with the operator, kept so another start of this runner polls it instead of asking again. `via` is
 *  `door` (polled with the door token and the poll secret) or the id of the credential that asked for more. */
export interface PendingRequest {
  requestId: string
  pollSecret?: string
  via: string
}

/** Where fabric-mcp keeps what it holds: the binding credentials of this runner (one per binding) and the requests
 *  it is waiting on, by resource. Every method may throw; the proxy says what failed. */
export interface CredentialStore {
  /** Every credential of this runner, each with a stable id (its file). */
  list(): Array<{ id: string; credential: string }>
  /** Saves one more credential — never over another — and returns its id. */
  save(credential: string): string
  forget(id: string): void
  pending(resource: string): PendingRequest | null
  keepPending(resource: string, request: PendingRequest): void
  forgetPending(resource: string): void
}

export interface ProxyDeps {
  runner: string
  cwd: string
  locate(): HubLocation
  store: CredentialStore
  hubCall: HubCall
  openSession(url: string, bearer: string): Promise<SessionLink>
  sleep(ms: number): Promise<void>
  log(line: string): void
  /** How often a waiting request is polled. */
  pollMs?: number
  /** Monotonic clock for server-directed rate-limit deadlines; defaults to performance.now(). */
  now?: () => number
  /** A draw in [0, 1) for the jitter added to a server's Retry-After; Math.random by default. */
  random?: () => number
  /** The coding agent's own session id (Claude Code's CLAUDE_CODE_SESSION_ID), sent with every enrollment (D1). */
  runtimeSessionId?: string | null
  /**
   * `--rejoin-only` (D2): join the live session `runtimeSessionId` already holds, through a held credential only —
   * never the door, never a request to the operator, never a new session; otherwise stay not-enrolled.
   */
  rejoinOnly?: boolean
  /** The coding agent's own process (TR-1): fabric-mcp's parent for the agent's own server; for a rejoin, the process
   *  its runtime session id belongs to now. What survives a `/clear`, which gives the agent a new runtime id. */
  agentPid?: number | null
  /** The runtime session id the agent has NOW (Claude Code's session file of the agent's pid), read at each
   *  enrollment; null when unknown, and then `runtimeSessionId` is sent (TR-1). */
  currentRuntimeSessionId?: () => string | null
  /** How often a connected session is signed with a ping (TR-4). Default SIGN_EVERY_MS. */
  signEveryMs?: number
}

/** A connected fabric-mcp signs its session this often, so a working agent reads as live (TR-4): well inside the
 *  10-minute silence rule and the 5-minute claim renewal, one ping per two minutes per agent. */
export const SIGN_EVERY_MS = 2 * 60_000

/** The runtime session ids fabric-mcp passes on: what Fabric's enrollment accepts (`sessionEnroll.ts`). */
export const RUNTIME_SESSION_ID = /^[A-Za-z0-9._:-]{1,128}$/

// #region fabric-mcp-runtime-session — docs: docs/adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md#amendments
/**
 * Which coding-agent session this fabric-mcp serves (D1), or null. `--runtime-session-id` names it for any runner
 * (the hooks' rejoin passes it). Otherwise only Claude Code says: it gives the MCP servers it starts its own session
 * id, CLAUDE_CODE_SESSION_ID (2.1.296). Measured 2026-10-13, nothing else does: Codex 0.162.1 gives an MCP stdio
 * server a fixed dozen variables and no session or thread id, and Kimi Code 2.1.1 passes its whole parent environment
 * and adds none — so a Kimi started inside a Claude Code session carries THAT session's CLAUDE_CODE_SESSION_ID, which
 * must never name the Kimi session. Hence the variable is read for `claude-code` only.
 */
export function runtimeSessionIdOf(runner: string, argv: readonly string[], env: Readonly<Record<string, string | undefined>>): string | null {
  const i = argv.indexOf('--runtime-session-id')
  const flagged = i >= 0 ? argv[i + 1] : undefined
  if (flagged !== undefined) return flagged
  return runner === 'claude-code' ? (env.CLAUDE_CODE_SESSION_ID ?? null) : null
}
// #endregion fabric-mcp-runtime-session

// #region claude-session-files — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#tracking
/**
 * Claude Code's own record of its running sessions (TR-1): `<config>/sessions/<pid>.json`, one per running claude
 * process, whose `sessionId` is the session the process has NOW. `/clear` gives the session a new id and rewrites
 * this file; the MCP servers it started keep the old id in their environment. Read here, bounded, only the `*.json`
 * files (the `*.key` files beside them are never opened), and a record whose `pid` is not its file's name is not
 * believed. Measured 2026-10-21 on Claude Code 2.1: 82 entries; each record carries `pid` and `sessionId`.
 */
export const CLAUDE_SESSION_FILE_MAX = 64 * 1024
export const CLAUDE_SESSION_FILES_MAX = 512
export function claudeSessionsDir(env: Readonly<Record<string, string | undefined>>, home: string): string {
  return path.join(env.CLAUDE_CONFIG_DIR || path.join(home, '.claude'), 'sessions')
}
function readSessionRecord(file: string): { pid: unknown; sessionId: unknown } | null {
  try {
    if (statSync(file).size > CLAUDE_SESSION_FILE_MAX) return null
    const v = JSON.parse(readFileSync(file, 'utf8')) as { pid?: unknown; sessionId?: unknown } | null
    return v && typeof v === 'object' ? { pid: v.pid, sessionId: v.sessionId } : null
  } catch {
    // Absent, unreadable or not JSON: no record, which the caller reads as "not known".
    return null
  }
}
/** The session id the claude process `pid` has now, or null. */
export function claudeSessionOfPid(dir: string, pid: number): string | null {
  if (!Number.isInteger(pid) || pid < 2) return null
  const r = readSessionRecord(path.join(dir, `${pid}.json`))
  return r && r.pid === pid && typeof r.sessionId === 'string' && RUNTIME_SESSION_ID.test(r.sessionId) ? r.sessionId : null
}
/** The claude process whose current session is `runtimeSessionId`, or null. */
export function claudePidOfSession(dir: string, runtimeSessionId: string): number | null {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    // No sessions folder: Claude Code keeps none here, so no process is known.
    return null
  }
  for (const name of names.filter((n) => /^\d{2,10}\.json$/.test(n)).slice(0, CLAUDE_SESSION_FILES_MAX)) {
    const pid = Number(name.slice(0, -'.json'.length))
    if (claudeSessionOfPid(dir, pid) === runtimeSessionId) return pid
  }
  return null
}
/** A pid that can name an agent process (never 0, 1 or a negative). */
export const agentPidOf = (pid: unknown): number | null => (typeof pid === 'number' && Number.isInteger(pid) && pid > 1 && pid < 2 ** 31 ? pid : null)
// #endregion claude-session-files

// #region fabric-mcp-failures — docs: docs/adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md#amendments
/**
 * What a failed call under a session means. A transport failure — the HTTP client could not reach the session (a
 * refused or dropped connection, an HTTP error, the session unknown to a restarted Fabric) — drops the session and
 * enrolls again; an `McpError` raised in the client (the SDK's own request timeout, an answer that does not match
 * the tool's output schema) keeps the session: Fabric is there, the call may well have run. Only a refusal before
 * the call was handled (HTTP 401/403/404, a connection that was never made) lets the answer say nothing was done.
 *
 * Fabric's own refusals of a call it would not take (0.3.5 review iteration 2, ER-3) — 429 (the call budget, too many
 * at once), 413 (a body too large), 408 (a body too slow), 400 (a batch) — are answered before any tool runs, and the
 * session is healthy: they keep the session and are passed on as Fabric's refusal, in its words. Dropping the session
 * on them made the agent read "the outcome is unknown" and enrolled a new session with a fresh call budget, which
 * turned the loop guard into a loop and left the old session holding its claims.
 */
export interface CallFailure {
  /** Whether the session is gone and the proxy must enroll again. */
  drop: boolean
  /** Whether the call can have reached Fabric. */
  mayHaveRun: boolean
  /** Fabric refused the call before any tool ran: its HTTP status and its reason, for the agent. */
  refusal?: { status: number; reason: string }
}

/** HTTP statuses Fabric's surface answers before any tool runs, on a session that stays valid (`agentSurface.ts#handle`). */
const REFUSED_BEFORE_ANY_TOOL = new Set([400, 408, 413, 429])

/** The reason Fabric gave in its refusal body (`{"error": "…"}`, or a JSON-RPC error's message), read from the SDK's
 *  `Error POSTing to endpoint: <body>`; null when there is none. Bounded and one line: it is shown to the agent. */
export function surfaceReason(e: unknown): string | null {
  const message = e instanceof Error ? e.message : typeof e === 'string' ? e : ''
  const at = message.indexOf('{')
  if (at < 0) return null
  let body: unknown
  try {
    body = JSON.parse(message.slice(at))
  } catch {
    // Not Fabric's JSON body (a proxy's page, a truncated answer): no reason to pass on, and the status still says it.
    return null
  }
  const error = (body as { error?: unknown } | null)?.error
  const said = typeof error === 'string' ? error : typeof (error as { message?: unknown } | null)?.message === 'string' ? (error as { message: string }).message : null
  // eslint-disable-next-line no-control-regex
  return said ? said.replace(/[\x00-\x1f\x7f]+/g, ' ').trim().slice(0, 300) || null : null
}

/** What the hub said with a refusal to wait, when the error carries it (FabricRateLimitError, review UX-3). */
export function hubSaidOf(e: unknown): HubRefusal | undefined {
  const err = e as { hubCode?: unknown; hubReason?: unknown } | null
  const code = typeof err?.hubCode === 'string' ? err.hubCode : undefined
  const reason = typeof err?.hubReason === 'string' ? err.hubReason : undefined
  return code || reason ? { ...(code ? { code } : {}), ...(reason ? { reason } : {}) } : undefined
}

/** JSON-RPC code of the SDK's ConnectionClosed: the transport closed under the request. */
const CONNECTION_CLOSED = -32000
const NOT_CONNECTED = new Set(['ECONNREFUSED', 'ENOENT', 'EHOSTUNREACH', 'ENETUNREACH', 'EADDRNOTAVAIL'])

export function classifyFailure(e: unknown): CallFailure {
  const err = e as { name?: unknown; code?: unknown; cause?: { code?: unknown } } | null
  if (err?.name === 'McpError') return { drop: err.code === CONNECTION_CLOSED, mayHaveRun: true }
  // StreamableHTTPError carries the HTTP status as its code. Fabric refused this one call; the session is kept.
  if (typeof err?.code === 'number' && REFUSED_BEFORE_ANY_TOOL.has(err.code))
    // A cooldown keeps code 429 as its marker; the agent is told the status the hub really answered (503, i3 ER-3).
    return { drop: false, mayHaveRun: false, refusal: { status: typeof (err as { status?: unknown }).status === 'number' ? (err as { status: number }).status : err.code,
      // UX-3: a cooldown carries what the hub said (its 503 body); otherwise the reason the SDK kept in its message.
      reason: sayHubRefusal(hubSaidOf(e)) ?? surfaceReason(e) ?? 'no reason given' } }
  // Refused before any tool ran, and the bearer or the session is gone.
  if (typeof err?.code === 'number' && [401, 403, 404].includes(err.code)) return { drop: true, mayHaveRun: false }
  // fetch's TypeError: a connection that was never made sent nothing.
  if (typeof err?.cause?.code === 'string' && NOT_CONNECTED.has(err.cause.code)) return { drop: true, mayHaveRun: false }
  return { drop: true, mayHaveRun: true }
}
// #endregion fabric-mcp-failures

// #region fabric-mcp-cooldown — docs: docs/evidence/plans/2026-10-13-harness-waves.md#task-contracts
/** Server cooldowns are process-local, bounded and never contain a credential or URL. */
export const RATE_LIMIT_FALLBACK_MS = 60_000
export const RATE_LIMIT_MAX_MS = 300_000
/** The hub's wait, honoured up to the cap and clamped to it; a date already past waits only the one-second floor that
 *  keeps a client from spinning; only an answer that is not a number falls back to a minute (CO-314: a 600 s ask used
 *  to become 60 s, and a past date a minute). */
export function boundedRetryMs(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return RATE_LIMIT_FALLBACK_MS
  return Math.min(RATE_LIMIT_MAX_MS, Math.max(1000, Math.ceil(value)))
}
/** What the hub said when it refused with a wait: its machine code and its reason for the agent (review UX-3). */
export interface HubRefusal {
  code?: string
  reason?: string
}

// #region fabric-mcp-hub-refusal — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#tracking
const HUB_CODE = /^[a-z][a-z0-9-]{0,63}$/
/** The hub's refusal body (`{"error": <why>, "code": <code>}`, hubStandby.ts#refuseForStack) as something safe to show:
 *  a code of the hub's own shape, a reason on one line within 300 characters; anything else is dropped. */
export function hubRefusalOf(body: unknown): HubRefusal | undefined {
  const b = body as { error?: unknown; code?: unknown } | null
  if (!b || typeof b !== 'object') return undefined
  const code = typeof b.code === 'string' && HUB_CODE.test(b.code) ? b.code : undefined
  // eslint-disable-next-line no-control-regex
  const reason = typeof b.error === 'string' ? b.error.replace(/[\x00-\x1f\x7f]+/g, ' ').trim().slice(0, 300) || undefined : undefined
  return code || reason ? { ...(code ? { code } : {}), ...(reason ? { reason } : {}) } : undefined
}
/**
 * The sentences fabric-mcp says itself around a hub refusal, with the wait it measured: kept out of the hub's reason
 * when that carries them too, so an agent reads "Nothing of this call was done" once (0.3.9 review iteration 2, UX-7).
 */
const SAID_BY_FABRIC_MCP = [/\s*Nothing of this call was done\.?/g, /\s*Wait and call again\.?/g]
/** "<reason> (<code>)", or whichever of the two the hub gave; null when it gave neither. */
export function sayHubRefusal(said: HubRefusal | undefined): string | null {
  if (!said) return null
  const own = said.reason ? SAID_BY_FABRIC_MCP.reduce((r, re) => r.replace(re, ''), said.reason) : null
  const reason = own ? own.replace(/[.\s]+$/, '') || null : null
  return reason && said.code ? `${reason} (${said.code})` : reason ?? said.code ?? null
}
// #endregion fabric-mcp-hub-refusal

/** The hub asked to wait: a 429, or a 503 that carries Retry-After (the full-disk stall of the 0.3.8 audit answered
 *  2,757 of those in 12 minutes, and each was retried at once; review i2 DA-6). `code` stays 429, the cooldown's
 *  marker; `status` is what the hub answered; `hubCode` and `hubReason` what it said (review UX-3). */
export class FabricRateLimitError extends Error {
  readonly code = 429
  readonly retryAfterMs: number
  readonly status: number
  readonly hubCode?: string
  readonly hubReason?: string
  constructor(delay: unknown, status = 429, said?: HubRefusal) {
    const retryAfterMs = boundedRetryMs(delay)
    const told = sayHubRefusal(said)
    super(`Fabric refused HTTP ${status}${told ? ` (${told})` : ''}; wait ${Math.ceil(retryAfterMs / 1000)} seconds before another request`)
    this.status = status
    this.name = 'FabricRateLimitError'
    this.retryAfterMs = retryAfterMs
    if (said?.code) this.hubCode = said.code
    if (said?.reason) this.hubReason = said.reason
  }
}

// #endregion fabric-mcp-cooldown

/** Whether a tool error is the hub's input schema refusing `key` (an MCP -32602 "Invalid arguments", "Unrecognized
 *  key"), as an older hub answers an argument it does not know (PL-2). */
export function refusesArgument(said: string, key: string): boolean {
  return /invalid arguments|unrecognized key|input validation/i.test(said) && new RegExp(`\\b${key}\\b`).test(said)
}

const errorCode = (v: Record<string, unknown>): string | null => {
  const e = v.error as { code?: unknown } | undefined
  return typeof e?.code === 'string' ? e.code : null
}
const errorMessage = (v: Record<string, unknown>): string => String(((v.error as { message?: unknown } | undefined) ?? {}).message ?? '')
const errorData = (v: Record<string, unknown>): Record<string, unknown> => ((v.error as { data?: Record<string, unknown> } | undefined)?.data ?? {})
const text = (t: string, isError = true): Record<string, unknown> => ({ content: [{ type: 'text', text: t }], ...(isError ? { isError: true } : {}) })

// #region fabric-mcp-broker-wording — docs: docs/adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md#amendments
/** What an agent is told while Fabric is down. Never "open Fabric": an agent reads that as `open -a`, and only the
 *  machine's local lifecycle broker starts an enrolled app (fabric-workspace knowledge/agents-first.md, "Fabric must be
 *  running, and only the broker starts it"). fabric-mcp itself wakes nothing: it is the coding agent's child. */
export const ASK_THE_BROKER =
  'Ask the local lifecycle broker to start it — lifecycle.list, lifecycle.ensure_running, then lifecycle.operation.get ' +
  'until ready — and call this tool again; never start, quit or kill it yourself (no open -a, osascript or pkill). ' +
  'Without the broker, or when it answers held_off or in_use_by_person, tell the person "Fabric is not running" and ' +
  'go on with other work.'
// #endregion fabric-mcp-broker-wording

/** How long the run loop waits before the next pass, by state. A folder that is no project is not asked about every
 *  few seconds: it waits until the agent calls fabric_whoami, or half a minute. */
export const BACKOFF_MS: Record<ProxyState['kind'], number> = {
  starting: 3000, failed: 3000, waiting: 3000, 'not-a-hub': 3000,
  connected: 2000, 'not-running': 5000, 'no-project': 30_000, denied: 60_000, 'not-enrolled': 30_000
}

// #region audit-038-backoff — docs: docs/evidence/plans/2026-10-21-release-038-verification.md#the-audit-that-opened-this-release
/** A folder Fabric refuses as too broad (a filesystem root, the home folder, a folder right under it, one that holds
 *  other projects) waits longer each time it is refused again: the base, doubled per repeat, up to 10 minutes. Nothing
 *  the person does in Fabric lifts that refusal; only starting the agent elsewhere does. A Hermes running in the home
 *  folder was refused as too broad every 30 s for three days (the 0.3.8 audit: 187 of 259 enrollment errors in one
 *  log). Every other no-project refusal (a detached folder, an ambiguous match, a Git read that failed) and a denial
 *  keep their base, because the person can lift them in Fabric or they pass by themselves (0.3.8 review UX-6, i3
 *  UX-1). The agent's own fabric_whoami still wakes every wait at once. */
export const LASTING_NO_PROJECT = 'This folder is too broad for a Project'
export const BACKOFF_GROWS: ReadonlySet<ProxyState['kind']> = new Set(['no-project', 'failed'])
export const BACKOFF_CEILING_MS = 10 * 60_000
/** A failure that repeats (a refused access ask, a hub that keeps failing) grows too, but only to a minute: a short
 *  outage still passes quickly, and a lasting one costs one call a minute instead of twenty (review i2 ER-4). */
export const FAILED_CEILING_MS = 60_000
export function backoffFor(kind: ProxyState['kind'], repeats: number, message?: string): number {
  const base = BACKOFF_MS[kind]
  if (!BACKOFF_GROWS.has(kind) || repeats <= 1) return base
  if (kind === 'no-project' && !message?.startsWith(LASTING_NO_PROJECT)) return base
  return Math.min(kind === 'failed' ? FAILED_CEILING_MS : BACKOFF_CEILING_MS, base * 2 ** Math.min(repeats - 1, 16))
}
// #endregion audit-038-backoff

export class FabricMcpProxy {
  state: ProxyState = { kind: 'starting' }
  private session: SessionLink | null = null
  private hubIdentity: { origin: string; pid: number } | null = null
  private cooldown: { origin: string; pid: number; until: number; said?: HubRefusal } | null = null
  /** A hub that refused `agentPid` (PL-2): a 0.3.7/0.3.8 hub's enroll schema is strict. Enrollments to it go without
   *  the pid until hub.json names another process (Fabric restarted, perhaps into a version that takes it). */
  private pidRefusedBy: { origin: string; pid: number } | null = null
  private closed = false
  private closeWaiters = new Set<() => void>()
  /** Said before the state while there is no session: a credential handed over and lost, which needs a new Allow. */
  private notice: string | null = null
  /** Wakes the run loop out of its backoff (the agent called fabric_whoami). */
  private waker: (() => void) | null = null
  /** Set by the stdio side: tell the agent its tool list changed. */
  onToolsChanged: () => void = () => {}
  /** Set by the stdio side: the run loop ended for good in this state (a rejoin that found no session, TR-11). */
  onFinal: (state: ProxyState) => void = () => {}
  /** When the session was last signed (opened, called, pinged): the next ping is due SIGN_EVERY_MS after it. */
  private signedAt = 0

  private deps: ProxyDeps
  constructor(deps: ProxyDeps) {
    this.deps = deps
  }

  private now(): number { return this.deps.now ? this.deps.now() : performance.now() }

  /** A changed or absent hub invalidates the old deadline, never transfers its credentials. */
  private cooldownRemaining(): number {
    const held = this.cooldown
    if (!held) return 0
    const hub = this.deps.locate()
    if (!hub.ok || hub.origin !== held.origin || hub.pid !== held.pid) {
      this.cooldown = null
      return 0
    }
    const remaining = Math.max(0, held.until - this.now())
    if (!remaining) this.cooldown = null
    return remaining
  }

  private rememberRateLimit(error: unknown): void {
    const e = error as { code?: unknown; retryAfterMs?: unknown } | null
    if (e?.code !== 429 || !this.hubIdentity) return
    // Jitter of up to half the server's delay (2026-10-19, board thread 1afd08e7): clients refused in one moment
    // would otherwise all come back in the same second and be refused together again.
    const delay = boundedRetryMs(e.retryAfterMs)
    const until = this.now() + delay + Math.floor(delay * 0.5 * Math.min(0.999, Math.max(0, (this.deps.random ?? Math.random)())))
    const said = hubSaidOf(error) ?? this.cooldown?.said
    this.cooldown = { ...this.hubIdentity, until: Math.max(until, this.cooldown?.until ?? 0), ...(said ? { said } : {}) }
  }

  private async hubCall(...args: Parameters<HubCall>): ReturnType<HubCall> {
    if (this.closed) throw new Error('Fabric MCP client closed')
    // An in-flight consent status may return a one-shot credential AFTER close. The caller
    // must preserve that response locally, while the pre-send guard prevents another call.
    return this.deps.hubCall(...args)
  }

  /** Closing this proxy also interrupts a pending consent poll, without deciding the request. */
  private async pause(ms: number, woken?: Promise<void>): Promise<void> {
    if (this.closed) return
    let finish!: () => void
    const closed = new Promise<void>((resolve) => { finish = resolve; this.closeWaiters.add(resolve) })
    try { await Promise.race([this.deps.sleep(ms), closed, ...(woken ? [woken] : [])]) }
    finally { this.closeWaiters.delete(finish) }
  }

  private set(state: ProxyState): ProxyState {
    const was = this.state.kind
    this.state = state
    if (was !== state.kind) this.deps.log(`fabric-mcp: ${state.kind}${'reason' in state ? ` — ${state.reason}` : ''}`)
    if (state.kind === 'connected') this.notice = null
    return state
  }

  /** What the agent sees while there is no session: the state, said plainly. */
  waitingAnswer(): Record<string, unknown> {
    const s = this.state
    const said =
      s.kind === 'not-running' ? `Fabric is not running, or its hub is closed (Settings → Agent access says why). ${ASK_THE_BROKER}`
      : s.kind === 'not-a-hub' ? `Fabric's hub could not be verified (${s.reason}). Nothing is sent to it until it can be. If Fabric is not running, ask the local lifecycle broker to start it (lifecycle.ensure_running), never start it yourself; then call this tool again.`
      : s.kind === 'no-project' ? s.message
      : s.kind === 'waiting' ? `Waiting for the operator to allow this coding agent in Fabric to work in the project ${s.projectName} — Fabric is asking them: a prompt in its window, or a notification when Fabric is in the background. Call this tool again in a moment.`
      : s.kind === 'denied' ? `The operator denied this coding agent the project ${s.projectName}. It stays denied until they clear the denial in Fabric (Agent access).`
      : s.kind === 'failed' && s.hubSaid ? `Fabric answered, and asked to wait: ${sayHubRefusal(s.hubSaid)}. Call this tool again in a moment.`
      : s.kind === 'failed' ? `Fabric could not be reached: ${s.reason}.`
      : s.kind === 'not-enrolled' ? s.message
      : 'Connecting to Fabric. Call this tool again in a moment.'
    return { content: [{ type: 'text', text: this.notice ? `${this.notice} ${said}` : said }], isError: true, structuredContent: { fabric: { state: s.kind } } }
  }

  /** The session went away under a call (Fabric quit or restarted; the bearer is gone): forget it, say so, and let
   *  the run loop enroll again. The HTTP client does not notice a vanished server until a request fails. */
  private dropSession(link: SessionLink, why: unknown): void {
    if (this.session !== link) return
    this.session = null
    this.set({ kind: 'starting' })
    this.deps.log(`fabric-mcp: the session ended (${why instanceof Error ? why.message : String(why)}); enrolling again`)
    void link.close().catch(() => {})
    this.onToolsChanged()
    this.wake()
  }

  /** The tools the agent may call now. An McpError of a live session is thrown: the list is unknown, not empty. */
  async tools(): Promise<unknown[]> {
    const remaining = this.cooldownRemaining()
    if (this.session && remaining) throw new FabricRateLimitError(remaining)
    const link = this.session
    if (link) {
      try {
        return await link.listTools()
      } catch (e) {
        this.rememberRateLimit(e)
        const f = classifyFailure(e)
        if (!f.drop) throw e
        // Not silent: dropSession logs the cause to stderr (fabric-mcp runs outside Fabric, with no ops sink) and
        // the agent is told its tools changed.
        this.dropSession(link, e)
      }
    }
    return [{
      name: WAITING_TOOL,
      description: 'Who this session is in Fabric: call it first. Until Fabric has admitted this coding agent to the project of this folder, it says what Fabric is waiting for.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false }
    }]
  }

  async call(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const remaining = this.cooldownRemaining()
    if (remaining) {
      // UX-3: what the hub said with its wait (a 503 `stack-starting` while Fabric starts its database), when it said it.
      const told = sayHubRefusal(this.cooldown?.said)
      return text(`Fabric asked to wait${told ? `: ${told}` : ''}; wait ${Math.ceil(remaining / 1000)} seconds. No new request was sent.`)
    }
    const link = this.session
    if (link) {
      try {
        const answer = await link.callTool(name, args)
        this.signedAt = this.now()
        return answer
      } catch (e) {
        // Logged to stderr (fabric-mcp has no ops sink) and said to the agent in the answer below.
        this.rememberRateLimit(e)
        const f = classifyFailure(e)
        const cause = e instanceof Error ? e.message : String(e)
        this.deps.log(`fabric-mcp: ${name} failed (${cause})`)
        if (f.refusal) {
          const { status, reason } = f.refusal
          const waitMs = (e as { retryAfterMs?: unknown } | null)?.retryAfterMs
          const wait = typeof waitMs === 'number' ? `; wait ${Math.ceil(waitMs / 1000)} seconds before you call again` : '; wait before you call again'
          return text(`Fabric refused ${name} (HTTP ${status}: ${reason}). Nothing of this call was done. The session stays open${status === 429 || status === 503 ? wait : ''}.`)
        }
        if (!f.drop) return text(`${name} failed in the client before its answer arrived (${cause}). The session stays open. The outcome is unknown — check its effect before you act again.`)
        this.dropSession(link, e)
        if (f.mayHaveRun) return text(`The connection to Fabric broke during ${name} (${cause}); reconnecting. The outcome is unknown — check its effect before you act again.`)
        // Fabric's own reason when it gave one (a session it ended, and why); otherwise a restart is the likely cause.
        const why = surfaceReason(e)
        return why
          ? text(`Fabric closed this session before ${name} reached it: ${why}. Reconnecting. Nothing of this call was done — call it again in a moment.`)
          : text(`Fabric restarted or closed this session before ${name} reached it; reconnecting. Nothing of this call was done — call it again in a moment.`)
      }
    }
    if (name === WAITING_TOOL) {
      // The agent is asking: a backoff (a folder that was no project) ends now.
      this.wake()
      return this.waitingAnswer()
    }
    return text(`${name} is not available until Fabric admits this session — call ${WAITING_TOOL}.`)
  }

  /** One pass of the state machine; returns the state it reached. Never throws. */
  async connectOnce(): Promise<ProxyState> {
    if (this.closed) return this.state
    try {
      if (this.cooldownRemaining()) return this.state
      return await this.attempt()
    } catch (e) {
      // The failure becomes the state the agent reads (fabric_whoami) and set() logs it to stderr.
      this.rememberRateLimit(e)
      const hubSaid = hubSaidOf(e)
      return this.set({ kind: 'failed', reason: e instanceof Error ? e.message : String(e), ...(hubSaid ? { hubSaid } : {}) })
    }
  }

  // #region fabric-mcp-keepalive — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#tracking
  /**
   * A held session, looked after on every pass of the run loop (every 2 s): a hub that is gone or restarted (another
   * pid or origin in hub.json: a cheap file read, no network) drops the session at once, so it is enrolled again
   * without waiting for the agent's next call (TR-5); and every SIGN_EVERY_MS one ping signs it (TR-4), so an agent
   * that works without calling Fabric reads as live and its claims renew. A ping refused because the session is gone
   * drops it like a call would; a ping that failed in the client keeps it. Nothing is logged for a sign that went
   * through.
   */
  private async keepAlive(link: SessionLink): Promise<boolean> {
    const hub = this.deps.locate()
    const held = this.hubIdentity
    if (!hub.ok || !held || hub.origin !== held.origin || hub.pid !== held.pid) {
      this.dropSession(link, hub.ok ? 'Fabric restarted (hub.json names another process)' : `Fabric's hub is gone (${hub.reason})`)
      return false
    }
    if (!link.ping || this.now() - this.signedAt < (this.deps.signEveryMs ?? SIGN_EVERY_MS)) return true
    try {
      await link.ping()
      this.signedAt = this.now()
      return true
    } catch (e) {
      this.rememberRateLimit(e)
      const f = classifyFailure(e)
      // A client-side failure (a timeout) keeps the session; the next pass tries again after the interval.
      this.signedAt = this.now()
      if (!f.drop) {
        this.deps.log(`fabric-mcp: a sign of life failed in the client (${e instanceof Error ? e.message : String(e)}); the session is kept`)
        return true
      }
      this.dropSession(link, e)
      return false
    }
  }
  // #endregion fabric-mcp-keepalive

  private async attempt(): Promise<ProxyState> {
    if (this.session && (await this.keepAlive(this.session))) return this.state
    const hub = this.deps.locate()
    if (!hub.ok) return this.set({ kind: hub.code, reason: hub.reason })
    this.hubIdentity = { origin: hub.origin, pid: hub.pid }
    const cwd = this.deps.cwd
    const store = this.deps.store
    // TR-1: the id the agent has now (after a /clear) when it can be read, else the one it started with.
    let now: string | null = null
    if (!this.deps.rejoinOnly && this.deps.currentRuntimeSessionId) {
      try {
        now = this.deps.currentRuntimeSessionId()
      } catch {
        // An unreadable session file is "not known": the id the agent started with is sent instead.
        now = null
      }
    }
    const named = now ?? this.deps.runtimeSessionId
    const runtime = named && RUNTIME_SESSION_ID.test(named) ? named : null
    const agentPid = agentPidOf(this.deps.agentPid)
    const enrollArgs: Record<string, unknown> = { cwd, ...(runtime ? { runtimeSessionId: runtime } : {}), ...(agentPid ? { agentPid } : {}) }

    // #region fabric-mcp-rejoin — docs: docs/adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md#amendments
    if (this.deps.rejoinOnly) {
      const none = (why: string): ProxyState => this.set({ kind: 'not-enrolled', message: `Not enrolled: ${why}. A rejoin asks nothing and starts no session.` })
      if (!runtime) return none('no runtime session id was given')
      for (const { credential } of store.list()) {
        const gone = this.moved(hub)
        if (gone) return gone
        // Nothing is forgotten or saved here: a rejoin leaves the agent's own credentials exactly as it found them.
        const r = await this.enroll(hub, credential, { cwd, runtimeSessionId: runtime, rejoinOnly: true, ...(agentPid ? { agentPid } : {}) })
        if (r.unauthorized) continue
        if (!r.isError) return this.open(hub.mcpUrl, r.value)
      }
      return none('no live Fabric session belongs to this coding-agent session')
    }
    // #endregion fabric-mcp-rejoin

    // Every credential this runner holds, one per binding: the first that enrolls wins; a revoked one is forgotten.
    let need: { data: Record<string, unknown>; bearer: string; via: string } | null = null
    for (const { id, credential } of store.list()) {
      // Each credential leaves only for the hub hub.json names now, with its pid alive (ER-7).
      const gone = this.moved(hub)
      if (gone) return gone
      const r = await this.enroll(hub, credential, enrollArgs)
      if (r.unauthorized) {
        // Revoked, or minted by another Fabric: forget this one; the others (or the door) are tried next.
        store.forget(id)
        this.deps.log(`fabric-mcp: a credential of ${this.deps.runner} was refused and is forgotten`)
        continue
      }
      if (!r.isError) return this.open(hub.mcpUrl, r.value)
      const code = errorCode(r.value)
      if (code === 'no-project' || code === 'bad-folder') return this.set({ kind: 'no-project', message: errorMessage(r.value) })
      if (code !== 'needs-grant') return this.set({ kind: 'failed', reason: `enroll answered ${code}` })
      need ??= { data: errorData(r.value), bearer: credential, via: id }
    }
    // A binding asks for its own agent: on Allow the grant joins the credential already held, nothing new is stored.
    if (need) return this.ask(hub, need.bearer, need.data, need.via)

    const r = await this.enroll(hub, hub.doorToken, enrollArgs)
    if (r.unauthorized) return this.set({ kind: 'not-a-hub', reason: 'the hub refused its own door token' })
    const code = r.isError ? errorCode(r.value) : null
    if (code === 'no-project' || code === 'bad-folder') return this.set({ kind: 'no-project', message: errorMessage(r.value) })
    if (code !== 'needs-grant') return this.set({ kind: 'failed', reason: `the door answered ${code ?? 'a session, which it never should'}` })
    return this.ask(hub, hub.doorToken, errorData(r.value), 'door')
  }

  // #region fabric-mcp-old-hub — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#tracking
  /**
   * `fabric.session.enroll`, offered `agentPid` (TR-1) only while this hub takes it (PL-2). Between installing a newer
   * bundle and Fabric restarting into it, this fabric-mcp meets the running older hub, whose enroll schema is strict
   * (0.3.7, 0.3.8) and refuses the unknown key; every enrollment then failed and every hook rejoin exited 3. A refusal
   * that names `agentPid` is answered by sending the same call once more without it, and the hub is remembered (origin
   * and pid), so its next enrollments go without it at once. Any other refusal is the hub's answer, unchanged.
   */
  private async enroll(hub: { origin: string; mcpUrl: string; pid: number }, bearer: string, args: Record<string, unknown>): ReturnType<HubCall> {
    const offered = 'agentPid' in args
    const { agentPid: _pid, ...without } = args
    const known = this.pidRefusedBy?.origin === hub.origin && this.pidRefusedBy.pid === hub.pid
    if (!offered || known) return this.hubCall(hub.mcpUrl, bearer, 'fabric.session.enroll', offered ? without : args)
    try {
      const r = await this.hubCall(hub.mcpUrl, bearer, 'fabric.session.enroll', args)
      if (r.unauthorized || !r.isError || !refusesArgument(r.text ?? errorMessage(r.value), 'agentPid')) return r
    } catch (e) {
      // An SDK that raises the schema refusal instead of answering it (McpError -32602): the same refusal.
      if (!refusesArgument(e instanceof Error ? e.message : String(e), 'agentPid')) throw e
    }
    this.pidRefusedBy = { origin: hub.origin, pid: hub.pid }
    this.deps.log('fabric-mcp: this Fabric is older and does not take agentPid; enrolling without it until Fabric restarts')
    return this.hubCall(hub.mcpUrl, bearer, 'fabric.session.enroll', without)
  }
  // #endregion fabric-mcp-old-hub

  /**
   * hub.json read again before a credential is sent (0.3.5 review ER-7; the contract in hub.ts's header): null while it
   * still names the hub this pass located, with its pid alive; otherwise the state to stop in. A request that waits
   * with the operator is polled every few seconds for up to ten minutes, and in that time Fabric can quit and another
   * program can take its port: the credential must not follow the old origin there.
   */
  private moved(hub: { origin: string; pid: number }): ProxyState | null {
    const now = this.deps.locate()
    if (!now.ok) return this.set({ kind: now.code, reason: now.reason })
    if (now.origin !== hub.origin || now.pid !== hub.pid)
      return this.set({ kind: 'not-running', reason: 'the Fabric hub changed since this pass found it (Fabric quit or restarted); it is looked for again' })
    return null
  }

  private async ask(hub: { origin: string; mcpUrl: string; pid: number }, bearer: string, need: Record<string, unknown>, via: string): Promise<ProxyState> {
    const url = hub.mcpUrl
    const projectName = typeof need.projectName === 'string' ? need.projectName : 'this project'
    const resource = typeof need.resource === 'string' ? need.resource : ''
    const store = this.deps.store
    const door = via === 'door'

    // A request already with the operator for this resource — asked by an earlier start or another process of this
    // runner — is polled, never asked again.
    const kept = store.pending(resource)
    if (kept && kept.via === via) {
      this.set({ kind: 'waiting', projectName })
      return this.poll(hub, bearer, resource, projectName, kept)
    }

    const stale = this.moved(hub)
    if (stale) return stale
    const asked = await this.hubCall(url, bearer, 'fabric.access.request', {
      agentId: this.deps.runner,
      callee: 'fabric',
      capabilities: ['session.enroll'],
      resources: [resource],
      // Fabric resolves this folder itself and shows the operator its own reading of it (ADR-0134 amendment 2).
      folder: this.deps.cwd,
      reason: `This coding agent, opened in the folder ${path.basename(this.deps.cwd)}, asks to work in the project ${projectName} through Fabric.`
    })
    if (asked.unauthorized) return this.set({ kind: 'not-a-hub', reason: 'the hub refused the request' })
    if (asked.isError) return this.set({ kind: 'failed', reason: errorMessage(asked.value) || 'the request was refused' })
    const requestId = String(asked.value.requestId ?? '')
    const pollSecret = typeof asked.value.pollSecret === 'string' ? asked.value.pollSecret : undefined
    if (asked.value.status === 'denied') return this.set({ kind: 'denied', projectName })
    const immediate = asked.value.status === 'allowed'
    if (!immediate) this.set({ kind: 'waiting', projectName })
    // An already-pending request carries no poll secret through the door: another start asked it and keeps its
    // secret on disk, where the next pass finds it; until then this one waits.
    if (door && !pollSecret) return this.state
    const request: PendingRequest = { requestId, ...(pollSecret ? { pollSecret } : {}), via }
    try {
      store.keepPending(resource, request)
    } catch (e) {
      // Not fatal: this process keeps polling; only another start would ask again.
      this.deps.log(`fabric-mcp: the waiting request could not be kept on disk (${e instanceof Error ? e.message : String(e)}); a restart will ask again`)
    }
    return this.poll(hub, bearer, resource, projectName, request, immediate)
  }

  private async poll(hub: { origin: string; mcpUrl: string; pid: number }, bearer: string, resource: string, projectName: string, request: PendingRequest, immediate = false): Promise<ProxyState> {
    const url = hub.mcpUrl
    const store = this.deps.store
    const door = request.via === 'door'
    const done = (): void => {
      try {
        store.forgetPending(resource)
      } catch (e) {
        // Logged to stderr: a stale entry is harmless — its status reads as decided, and it is dropped then.
        this.deps.log(`fabric-mcp: a decided request could not be removed from disk (${e instanceof Error ? e.message : String(e)})`)
      }
    }
    let first = true
    for (;;) {
      if (!immediate || !first) await this.pause(this.deps.pollMs ?? 3000)
      first = false
      if (this.closed) return this.state
      const gone = this.moved(hub)
      if (gone) return gone
      const st = await this.hubCall(url, bearer, 'fabric.access.status', { requestId: request.requestId, ...(request.pollSecret ? { pollSecret: request.pollSecret } : {}) })
      if (st.unauthorized) return this.set({ kind: 'failed', reason: 'the request could not be read' })
      if (st.isError) {
        // An unknown request (expired from Fabric's store, another Fabric): it is not waited on any longer.
        if (errorCode(st.value) === 'unknown-request') {
          done()
          return this.set({ kind: 'starting' })
        }
        return this.set({ kind: 'failed', reason: 'the request could not be read' })
      }
      const status = st.value.status
      if (status === 'pending') {
        if (this.closed) return this.state
        continue
      }
      done()
      if (status === 'denied') return this.set({ kind: 'denied', projectName })
      if (status === 'expired') return this.set({ kind: 'starting' })
      if (status === 'allowed') {
        if (door) {
          // Another process of this runner collected it: it is on disk once that process has saved it, and the next
          // pass reads it there (asking now, with an older credential, would prompt the operator a second time).
          if (typeof st.value.credential !== 'string')
            return this.set({ kind: 'failed', reason: 'allowed, and the credential was collected by another process of this agent; waiting for it to be saved' })
          try {
            store.save(st.value.credential)
          } catch (e) {
            // Said to the agent (the notice and the state, which set() logs): the credential is gone for good.
            const cause = e instanceof Error ? e.message : String(e)
            this.notice = `The operator allowed this coding agent, but its credential could not be saved (${cause}). Fabric shows a credential only once, so the operator has to allow this agent again.`
            return this.set({ kind: 'failed', reason: `the credential could not be saved (${cause}); the Allow has to be repeated` })
          }
        }
        return this.closed ? this.state : this.attempt()
      }
      return this.set({ kind: 'failed', reason: `unknown request status ${String(status)}` })
    }
  }

  private async open(url: string, value: Record<string, unknown>): Promise<ProxyState> {
    if (this.closed) return this.state
    const s = value.session as { bearer?: unknown; projectId?: unknown; projectName?: unknown } | undefined
    if (!s || typeof s.bearer !== 'string') return this.set({ kind: 'failed', reason: 'the enroll answer carried no session' })
    const link = await this.deps.openSession(url, s.bearer)
    if (this.closed) {
      // close() could not see this link while openSession was pending. Dispose it now;
      // never publish a session or tool-list change after this proxy has closed.
      await (link.leave ? link.leave() : link.close())
      return this.state
    }
    link.onclose = () => {
      if (this.session !== link) return
      this.session = null
      this.set({ kind: 'starting' })
      this.onToolsChanged()
      this.wake()
    }
    this.session = link
    this.signedAt = this.now()
    this.set({ kind: 'connected', projectName: String(s.projectName ?? ''), projectId: String(s.projectId ?? '') })
    this.onToolsChanged()
    return this.state
  }

  private wake(): void {
    const w = this.waker
    this.waker = null
    w?.()
  }

  /** Keep connecting until stopped/closed. whoami may wake ordinary backoff, never a server cooldown. */
  async run(stop: { stopped: boolean }): Promise<void> {
    let last: string | null = null
    let repeats = 0
    while (!stop.stopped && !this.closed) {
      const s = await this.connectOnce()
      if (stop.stopped || this.closed) return
      // TR-11: a rejoin asks once. No live session of its runtime id is the answer, not a state to wait out: a hook
      // that kept retrying held its worker to its deadline and spawned another fabric-mcp on the next turn.
      if (this.deps.rejoinOnly && s.kind === 'not-enrolled') {
        this.onFinal(s)
        return
      }
      const message = s.kind === 'no-project' ? s.message : undefined
      const key = `${s.kind}:${message ?? ''}`
      repeats = key === last ? repeats + 1 : 1
      last = key
      let wokenByAgent = false
      const woken = new Promise<void>((resolve) => { this.waker = () => { wokenByAgent = true; resolve() } })
      await this.pause(Math.max(backoffFor(s.kind, repeats, message), this.cooldownRemaining()), woken)
      this.waker = null
      // The agent asked (fabric_whoami): the next refusal starts from the base again.
      if (wokenByAgent) repeats = 0
    }
  }

  /** The agent is gone (stdin ended): leave the session, so Fabric ends it and releases its claims. */
  async close(): Promise<void> {
    this.closed = true
    for (const finish of this.closeWaiters) finish()
    this.wake()
    const s = this.session
    this.session = null
    if (s) await (s.leave ? s.leave() : s.close())
  }
}
// #endregion fabric-mcp

// #region fabric-mcp-leave-on-exit — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#tracking
/** How long fabric-mcp may spend telling Fabric it leaves before it exits anyway: the leave's own DELETE is bounded at
 *  2 s (`fabricMcpClient.ts#openSessionLink`), and closing its transport after it is quick. */
export const LEAVE_DEADLINE_MS = 5_000

/** The exit code of a process ended by a signal, as a shell reports it (128 + the signal's number). */
const SIGNAL_EXIT: Record<'SIGTERM' | 'SIGHUP' | 'SIGINT', number> = { SIGTERM: 143, SIGHUP: 129, SIGINT: 130 }

/**
 * fabric-mcp tells Fabric it leaves whenever it goes (0.3.9 review iteration 2, ER-2): its agent closing stdin, or a
 * signal (SIGHUP when the terminal closes, SIGTERM from a supervisor, SIGINT). Without this a killed fabric-mcp sent no
 * DELETE, and its session, its claims and the tasks they moved to running stayed until they lapsed. Once: a second
 * signal while leaving changes nothing (the handlers stay installed, so it does not kill the process mid-leave either),
 * and the exit comes at the deadline when Fabric does not answer.
 */
export function leaveOnExit(opts: {
  proc: { on(event: 'SIGTERM' | 'SIGHUP' | 'SIGINT', fn: () => void): unknown; stdin: { once(event: 'end', fn: () => void): unknown } }
  stop: { stopped: boolean }
  leave: () => Promise<void>
  exit: (code: number) => void
  deadlineMs?: number
  log?: (line: string) => void
}): void {
  let leaving = false
  const go = (code: number, why: string): void => {
    if (leaving) return
    leaving = true
    opts.stop.stopped = true
    let done = false
    const finish = (): void => {
      if (done) return
      done = true
      clearTimeout(deadline)
      opts.exit(code)
    }
    // Not unref'd: the exit must come even when nothing else keeps the process alive meanwhile.
    const deadline = setTimeout(() => {
      opts.log?.(`fabric-mcp: Fabric did not confirm the leave (${why}) within ${Math.round((opts.deadlineMs ?? LEAVE_DEADLINE_MS) / 1000)} s; exiting`)
      finish()
    }, opts.deadlineMs ?? LEAVE_DEADLINE_MS)
    opts.leave().then(finish, (e: unknown) => {
      // The leave failed (Fabric gone or refusing): said on stderr, the only channel fabric-mcp has; it exits anyway.
      opts.log?.(`fabric-mcp: leaving on ${why} failed (${e instanceof Error ? e.message : String(e)})`)
      finish()
    })
  }
  for (const signal of ['SIGTERM', 'SIGHUP', 'SIGINT'] as const) opts.proc.on(signal, () => go(SIGNAL_EXIT[signal], signal))
  opts.proc.stdin.once('end', () => go(0, 'stdin end'))
}
// #endregion fabric-mcp-leave-on-exit

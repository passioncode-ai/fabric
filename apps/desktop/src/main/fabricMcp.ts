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
  | { kind: 'failed'; reason: string }
  /** A rejoin (D2) found no live session of its runtime session: it asks nothing and waits to be called. */
  | { kind: 'not-enrolled'; message: string }

/** One tool call to the hub as a short-lived MCP client. A refused credential (HTTP 401/403) is `unauthorized`. */
export type HubCall = (url: string, bearer: string, tool: string, args: Record<string, unknown>) => Promise<
  { unauthorized: true } | { unauthorized?: false; isError: boolean; value: Record<string, unknown> }
>

export interface SessionLink {
  listTools(): Promise<unknown[]>
  callTool(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>>
  close(): Promise<void>
  /** Leaves the session for good, telling Fabric first (the HTTP session's DELETE), then closes; bounded, never
   *  throws. Fabric ends an enrolled session whose agent left, so its claims do not outlive it (0.3.5 review i2 ER-4). */
  leave?(): Promise<void>
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
  /** The coding agent's own session id (Claude Code's CLAUDE_CODE_SESSION_ID), sent with every enrollment (D1). */
  runtimeSessionId?: string | null
  /**
   * `--rejoin-only` (D2): join the live session `runtimeSessionId` already holds, through a held credential only —
   * never the door, never a request to the operator, never a new session; otherwise stay not-enrolled.
   */
  rejoinOnly?: boolean
}

/** The runtime session ids fabric-mcp passes on: what Fabric's enrollment accepts (`sessionEnroll.ts`). */
export const RUNTIME_SESSION_ID = /^[A-Za-z0-9._:-]{1,128}$/

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

/** JSON-RPC code of the SDK's ConnectionClosed: the transport closed under the request. */
const CONNECTION_CLOSED = -32000
const NOT_CONNECTED = new Set(['ECONNREFUSED', 'ENOENT', 'EHOSTUNREACH', 'ENETUNREACH', 'EADDRNOTAVAIL'])

export function classifyFailure(e: unknown): CallFailure {
  const err = e as { name?: unknown; code?: unknown; cause?: { code?: unknown } } | null
  if (err?.name === 'McpError') return { drop: err.code === CONNECTION_CLOSED, mayHaveRun: true }
  // StreamableHTTPError carries the HTTP status as its code. Fabric refused this one call; the session is kept.
  if (typeof err?.code === 'number' && REFUSED_BEFORE_ANY_TOOL.has(err.code))
    return { drop: false, mayHaveRun: false, refusal: { status: err.code, reason: surfaceReason(e) ?? 'no reason given' } }
  // Refused before any tool ran, and the bearer or the session is gone.
  if (typeof err?.code === 'number' && [401, 403, 404].includes(err.code)) return { drop: true, mayHaveRun: false }
  // fetch's TypeError: a connection that was never made sent nothing.
  if (typeof err?.cause?.code === 'string' && NOT_CONNECTED.has(err.cause.code)) return { drop: true, mayHaveRun: false }
  return { drop: true, mayHaveRun: true }
}
// #endregion fabric-mcp-failures

const errorCode = (v: Record<string, unknown>): string | null => {
  const e = v.error as { code?: unknown } | undefined
  return typeof e?.code === 'string' ? e.code : null
}
const errorMessage = (v: Record<string, unknown>): string => String(((v.error as { message?: unknown } | undefined) ?? {}).message ?? '')
const errorData = (v: Record<string, unknown>): Record<string, unknown> => ((v.error as { data?: Record<string, unknown> } | undefined)?.data ?? {})
const text = (t: string, isError = true): Record<string, unknown> => ({ content: [{ type: 'text', text: t }], ...(isError ? { isError: true } : {}) })

/** How long the run loop waits before the next pass, by state. A folder that is no project is not asked about every
 *  few seconds: it waits until the agent calls fabric_whoami, or half a minute. */
export const BACKOFF_MS: Record<ProxyState['kind'], number> = {
  starting: 3000, failed: 3000, waiting: 3000, 'not-a-hub': 3000,
  connected: 2000, 'not-running': 5000, 'no-project': 30_000, denied: 60_000, 'not-enrolled': 30_000
}

export class FabricMcpProxy {
  state: ProxyState = { kind: 'starting' }
  private session: SessionLink | null = null
  /** Said before the state while there is no session: a credential handed over and lost, which needs a new Allow. */
  private notice: string | null = null
  /** Wakes the run loop out of its backoff (the agent called fabric_whoami). */
  private waker: (() => void) | null = null
  /** Set by the stdio side: tell the agent its tool list changed. */
  onToolsChanged: () => void = () => {}

  private deps: ProxyDeps
  constructor(deps: ProxyDeps) {
    this.deps = deps
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
      s.kind === 'not-running' ? 'Fabric is not running, or its hub is closed (Settings → Agent access says why). Open Fabric, then call this tool again.'
      : s.kind === 'not-a-hub' ? `Fabric's hub could not be verified (${s.reason}). Open Fabric, then call this tool again.`
      : s.kind === 'no-project' ? s.message
      : s.kind === 'waiting' ? `Waiting for the operator to allow this coding agent in Fabric to work in the project ${s.projectName} — Fabric is asking them: a prompt in its window, or a notification when Fabric is in the background. Call this tool again in a moment.`
      : s.kind === 'denied' ? `The operator denied this coding agent the project ${s.projectName}. It stays denied until they clear the denial in Fabric (Agent access).`
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
    const link = this.session
    if (link) {
      try {
        return await link.listTools()
      } catch (e) {
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
    const link = this.session
    if (link) {
      try {
        return await link.callTool(name, args)
      } catch (e) {
        // Logged to stderr (fabric-mcp has no ops sink) and said to the agent in the answer below.
        const f = classifyFailure(e)
        const cause = e instanceof Error ? e.message : String(e)
        this.deps.log(`fabric-mcp: ${name} failed (${cause})`)
        if (f.refusal) {
          const { status, reason } = f.refusal
          return text(`Fabric refused ${name} (HTTP ${status}: ${reason}). Nothing of this call was done. The session stays open${status === 429 ? '; wait before you call again' : ''}.`)
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
    try {
      return await this.attempt()
    } catch (e) {
      // The failure becomes the state the agent reads (fabric_whoami) and set() logs it to stderr.
      return this.set({ kind: 'failed', reason: e instanceof Error ? e.message : String(e) })
    }
  }

  private async attempt(): Promise<ProxyState> {
    if (this.session) return this.state
    const hub = this.deps.locate()
    if (!hub.ok) return this.set({ kind: hub.code, reason: hub.reason })
    const cwd = this.deps.cwd
    const store = this.deps.store
    const runtime = this.deps.runtimeSessionId && RUNTIME_SESSION_ID.test(this.deps.runtimeSessionId) ? this.deps.runtimeSessionId : null
    const enrollArgs: Record<string, unknown> = runtime ? { cwd, runtimeSessionId: runtime } : { cwd }

    // #region fabric-mcp-rejoin — docs: docs/adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md#amendments
    if (this.deps.rejoinOnly) {
      const none = (why: string): ProxyState => this.set({ kind: 'not-enrolled', message: `Not enrolled: ${why}. A rejoin asks nothing and starts no session.` })
      if (!runtime) return none('no runtime session id was given')
      for (const { credential } of store.list()) {
        const gone = this.moved(hub)
        if (gone) return gone
        // Nothing is forgotten or saved here: a rejoin leaves the agent's own credentials exactly as it found them.
        const r = await this.deps.hubCall(hub.mcpUrl, credential, 'fabric.session.enroll', { ...enrollArgs, rejoinOnly: true })
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
      const r = await this.deps.hubCall(hub.mcpUrl, credential, 'fabric.session.enroll', enrollArgs)
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

    const r = await this.deps.hubCall(hub.mcpUrl, hub.doorToken, 'fabric.session.enroll', enrollArgs)
    if (r.unauthorized) return this.set({ kind: 'not-a-hub', reason: 'the hub refused its own door token' })
    const code = r.isError ? errorCode(r.value) : null
    if (code === 'no-project' || code === 'bad-folder') return this.set({ kind: 'no-project', message: errorMessage(r.value) })
    if (code !== 'needs-grant') return this.set({ kind: 'failed', reason: `the door answered ${code ?? 'a session, which it never should'}` })
    return this.ask(hub, hub.doorToken, errorData(r.value), 'door')
  }

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
    const asked = await this.deps.hubCall(url, bearer, 'fabric.access.request', {
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
    this.set({ kind: 'waiting', projectName })
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
    return this.poll(hub, bearer, resource, projectName, request)
  }

  private async poll(hub: { origin: string; mcpUrl: string; pid: number }, bearer: string, resource: string, projectName: string, request: PendingRequest): Promise<ProxyState> {
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
    for (;;) {
      await this.deps.sleep(this.deps.pollMs ?? 3000)
      const gone = this.moved(hub)
      if (gone) return gone
      const st = await this.deps.hubCall(url, bearer, 'fabric.access.status', { requestId: request.requestId, ...(request.pollSecret ? { pollSecret: request.pollSecret } : {}) })
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
      if (status === 'pending') continue
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
        return this.attempt()
      }
      return this.set({ kind: 'failed', reason: `unknown request status ${String(status)}` })
    }
  }

  private async open(url: string, value: Record<string, unknown>): Promise<ProxyState> {
    const s = value.session as { bearer?: unknown; projectId?: unknown; projectName?: unknown } | undefined
    if (!s || typeof s.bearer !== 'string') return this.set({ kind: 'failed', reason: 'the enroll answer carried no session' })
    const link = await this.deps.openSession(url, s.bearer)
    link.onclose = () => {
      if (this.session !== link) return
      this.session = null
      this.set({ kind: 'starting' })
      this.onToolsChanged()
      this.wake()
    }
    this.session = link
    this.set({ kind: 'connected', projectName: String(s.projectName ?? ''), projectId: String(s.projectId ?? '') })
    this.onToolsChanged()
    return this.state
  }

  private wake(): void {
    const w = this.waker
    this.waker = null
    w?.()
  }

  /** Keep connecting until `stop()`, waiting between passes by state (BACKOFF_MS); fabric_whoami cuts a wait short. */
  async run(stop: { stopped: boolean }): Promise<void> {
    while (!stop.stopped) {
      const s = await this.connectOnce()
      if (stop.stopped) return
      const woken = new Promise<void>((resolve) => { this.waker = resolve })
      await Promise.race([this.deps.sleep(BACKOFF_MS[s.kind]), woken])
      this.waker = null
    }
  }

  /** The agent is gone (stdin ended): leave the session, so Fabric ends it and releases its claims. */
  async close(): Promise<void> {
    const s = this.session
    this.session = null
    if (s) await (s.leave ? s.leave() : s.close())
  }
}
// #endregion fabric-mcp

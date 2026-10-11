// #region fabric-mcp — docs: docs/adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md#decision
// `fabric-mcp` (ADR-0134 §1): the MCP server a coding agent registers once — `claude mcp add --scope user fabric --
// <app>/bin/fabric-mcp --runner claude-code` — with no secret in the registration. To the agent it is one stable
// stdio session; to Fabric it is a client that finds the live hub each time (hub.ts#locateHub), asks the operator
// once for this runner on the folder's project, keeps the binding credential 0600 in Fabric's registry root, and on
// every start enrolls (fabric.session.enroll) for a one-session bearer — the same a session Fabric launched gets.
//
// Until it holds a session the agent sees ONE tool, fabric_whoami, which says the state in a sentence and is an
// error, never a fake success. When the session opens, the agent is told the tool list changed. When Fabric
// restarts the session's bearer is gone: the proxy finds the new hub and enrolls again, silently under the grant.
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

/** One tool call to the hub as a short-lived MCP client. A refused credential (HTTP 401/403) is `unauthorized`. */
export type HubCall = (url: string, bearer: string, tool: string, args: Record<string, unknown>) => Promise<
  { unauthorized: true } | { unauthorized?: false; isError: boolean; value: Record<string, unknown> }
>

export interface SessionLink {
  listTools(): Promise<unknown[]>
  callTool(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>>
  close(): Promise<void>
  /** Set by the proxy: called once when the session ends (Fabric quit, the bearer revoked). */
  onclose?: () => void
}

export interface ProxyDeps {
  runner: string
  cwd: string
  locate(): HubLocation
  readCredential(): string | null
  writeCredential(credential: string): void
  forgetCredential(): void
  hubCall: HubCall
  openSession(url: string, bearer: string): Promise<SessionLink>
  sleep(ms: number): Promise<void>
  log(line: string): void
  /** How often a waiting request is polled. */
  pollMs?: number
}

const errorCode = (v: Record<string, unknown>): string | null => {
  const e = v.error as { code?: unknown } | undefined
  return typeof e?.code === 'string' ? e.code : null
}
const errorData = (v: Record<string, unknown>): Record<string, unknown> => ((v.error as { data?: Record<string, unknown> } | undefined)?.data ?? {})

export class FabricMcpProxy {
  state: ProxyState = { kind: 'starting' }
  private session: SessionLink | null = null
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
    return state
  }

  /** What the agent sees while there is no session: the state, said plainly. */
  waitingAnswer(): Record<string, unknown> {
    const s = this.state
    const text =
      s.kind === 'not-running' ? 'Fabric is not running on this Mac. Open Fabric, then call this tool again.'
      : s.kind === 'not-a-hub' ? `Fabric's hub could not be verified (${s.reason}). Open Fabric, then call this tool again.`
      : s.kind === 'no-project' ? s.message
      : s.kind === 'waiting' ? `Waiting for the operator to allow this coding agent in Fabric to work in the project ${s.projectName} — the prompt is on their screen. Call this tool again in a moment.`
      : s.kind === 'denied' ? `The operator denied this coding agent the project ${s.projectName}. It stays denied until they clear the denial in Fabric (Agents & access).`
      : s.kind === 'failed' ? `Fabric could not be reached: ${s.reason}.`
      : 'Connecting to Fabric. Call this tool again in a moment.'
    return { content: [{ type: 'text', text }], isError: true, structuredContent: { fabric: { state: s.kind } } }
  }

  /** The tools the agent may call now. */
  /** The session went away under a call (Fabric quit or restarted; the bearer is gone): forget it, say so, and let
   *  the run loop enroll again. The HTTP client does not notice a vanished server until a request fails. */
  private dropSession(link: SessionLink, why: unknown): void {
    if (this.session !== link) return
    this.session = null
    this.set({ kind: 'starting' })
    this.deps.log(`fabric-mcp: the session ended (${why instanceof Error ? why.message : String(why)}); enrolling again`)
    void link.close().catch(() => {})
    this.onToolsChanged()
  }

  async tools(): Promise<unknown[]> {
    const link = this.session
    if (link) {
      try {
        return await link.listTools()
      } catch (e) {
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
        // Not silent: logged by dropSession, and the answer below tells the agent nothing of this call was done.
        this.dropSession(link, e)
        return { content: [{ type: 'text', text: 'Fabric restarted or closed this session; reconnecting. Call this tool again in a moment — nothing of this call was done.' }], isError: true }
      }
    }
    if (name === WAITING_TOOL) return this.waitingAnswer()
    return { content: [{ type: 'text', text: `${name} is not available until Fabric admits this session — call ${WAITING_TOOL}.` }], isError: true }
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
    const credential = this.deps.readCredential()

    if (credential) {
      const r = await this.deps.hubCall(hub.mcpUrl, credential, 'fabric.session.enroll', { cwd })
      if (r.unauthorized) {
        // Revoked, or minted by another Fabric: forget it and ask again through the door.
        this.deps.forgetCredential()
        return this.set({ kind: 'starting' })
      }
      if (!r.isError) return this.open(hub.mcpUrl, r.value)
      const code = errorCode(r.value)
      if (code === 'no-project' || code === 'bad-folder') return this.set({ kind: 'no-project', message: String((r.value.error as { message?: unknown }).message ?? '') })
      if (code !== 'needs-grant') return this.set({ kind: 'failed', reason: `enroll answered ${code}` })
      // A binding asks for its own agent; the answer is the same binding, so nothing new to store.
      return this.ask(hub.mcpUrl, credential, errorData(r.value), false)
    }

    const r = await this.deps.hubCall(hub.mcpUrl, hub.doorToken, 'fabric.session.enroll', { cwd })
    if (r.unauthorized) return this.set({ kind: 'not-a-hub', reason: 'the hub refused its own door token' })
    const code = r.isError ? errorCode(r.value) : null
    if (code === 'no-project' || code === 'bad-folder') return this.set({ kind: 'no-project', message: String((r.value.error as { message?: unknown }).message ?? '') })
    if (code !== 'needs-grant') return this.set({ kind: 'failed', reason: `the door answered ${code ?? 'a session, which it never should'}` })
    return this.ask(hub.mcpUrl, hub.doorToken, errorData(r.value), true)
  }

  private async ask(url: string, bearer: string, need: Record<string, unknown>, door: boolean): Promise<ProxyState> {
    const projectName = typeof need.projectName === 'string' ? need.projectName : 'this project'
    const resource = typeof need.resource === 'string' ? need.resource : ''
    const asked = await this.deps.hubCall(url, bearer, 'fabric.access.request', {
      agentId: this.deps.runner,
      callee: 'fabric',
      capabilities: ['session.enroll'],
      resources: [resource],
      reason: `This coding agent, opened in the folder ${path.basename(this.deps.cwd)}, asks to work in the project ${projectName} through Fabric.`
    })
    if (asked.unauthorized) return this.set({ kind: 'not-a-hub', reason: 'the hub refused the request' })
    if (asked.isError) return this.set({ kind: 'failed', reason: String(((asked.value.error as { message?: unknown }) ?? {}).message ?? 'the request was refused') })
    const requestId = String(asked.value.requestId ?? '')
    const pollSecret = typeof asked.value.pollSecret === 'string' ? asked.value.pollSecret : undefined
    if (asked.value.status === 'denied') return this.set({ kind: 'denied', projectName })
    this.set({ kind: 'waiting', projectName })
    // An already-pending request carries no poll secret through the door: it was created by an earlier start, so
    // this one waits for it to be decided or to expire and then asks afresh.
    if (door && !pollSecret) return this.state
    for (;;) {
      await this.deps.sleep(this.deps.pollMs ?? 3000)
      const st = await this.deps.hubCall(url, bearer, 'fabric.access.status', { requestId, ...(pollSecret ? { pollSecret } : {}) })
      if (st.unauthorized || st.isError) return this.set({ kind: 'failed', reason: 'the request could not be read' })
      const status = st.value.status
      if (status === 'pending') continue
      if (status === 'denied') return this.set({ kind: 'denied', projectName })
      if (status === 'expired') return this.set({ kind: 'starting' })
      if (status === 'allowed') {
        if (door) {
          if (typeof st.value.credential !== 'string') return this.set({ kind: 'failed', reason: 'allowed, but the credential was already collected elsewhere' })
          this.deps.writeCredential(st.value.credential)
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
    }
    this.session = link
    this.set({ kind: 'connected', projectName: String(s.projectName ?? ''), projectId: String(s.projectId ?? '') })
    this.onToolsChanged()
    return this.state
  }

  /** Keep connecting until `stop()`: quick while waiting on the operator, slower while Fabric is down. */
  async run(stop: { stopped: boolean }): Promise<void> {
    while (!stop.stopped) {
      const s = await this.connectOnce()
      if (stop.stopped) return
      await this.deps.sleep(s.kind === 'connected' ? 2000 : s.kind === 'not-running' ? 5000 : s.kind === 'denied' ? 60000 : 3000)
    }
  }

  async close(): Promise<void> {
    const s = this.session
    this.session = null
    if (s) await s.close()
  }
}
// #endregion fabric-mcp

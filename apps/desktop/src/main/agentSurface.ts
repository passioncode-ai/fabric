import { closeHttpServer } from './closeHttpServer.ts'
import { pidAlive } from './hub.ts'
// The agent surface — Fabric's own door, opened toward the agents working in it.
//
// Every session Fabric starts gets a scoped credential and an `mcp.json` pointing
// here, so an agent can ask what it is working on, see who else is running, report
// its own stage, read and write project memory, and leave findings. This is the
// same shape ADR-0026 gives the northbound control surface: one Streamable HTTP
// server, a credential that resolves to a scope, typed tools, everything through
// the journal. The only difference between an agent inside a session and an
// external MCP client is where the credential came from — which is exactly why
// there is one server here and not two.
//
// Two rules hold this together and both are load-bearing:
//
//   1. A CLAIM IS NOT AN OBSERVATION. `fabric_stage_report` records what the agent
//      SAYS about itself. Fabric separately observes the session it actually runs
//      in. They are stored apart (agent_stages vs the session manager) and shown
//      apart. ADR-0008 chose hosted terminals precisely so progress could be read
//      rather than believed; this tool adds the agent's account beside that, never
//      instead of it.
//   2. THE SCOPE IS THE CREDENTIAL'S, NEVER THE CALLER'S CLAIM. A tool argument
//      naming a project is checked against the token's scope. `projectId` in a
//      valid schema proves nothing.
//   3. THE CREDENTIAL IS A HANDSHAKE, NOT A PASSWORD. Every session Fabric starts
//      runs as the same operating-system user, so an `mcp.json` at mode 0600 is
//      unreadable by other PEOPLE and perfectly readable by the next agent. The
//      answer is not a better hiding place — there isn't one — it is lifetime:
//      the bearer opens exactly ONE MCP session and is spent, and every request
//      after that must also carry the session id, which the transport returns to
//      the client that initialised and which is never written to disk. A token
//      copied out of the file after the session started opens nothing.
//      What this does NOT defend against, said plainly because a security note
//      that overclaims is worse than none: a reader that wins the race before the
//      real session initialises, and anything with access to the agent's own
//      process. Same-uid isolation has a floor and this is it.
//
// ADR-0115 ADDS A SECOND WAY IN, and narrows rule 3 rather than dropping it. The same server, on a
// stable loopback port, also admits agents REGISTERED on this machine (`hub.ts`, `hubTools.ts`):
// the door token (in a 0600 file named by `hub.json`) may only ask for access, and a binding
// credential — long-lived, revocable, held as a sha256 — may call `agent.call` within its grants.
// Sessions Fabric starts keep the one-shot bearer above, unchanged: an external credential is
// looked up only when the bearer is not a session's, and it reaches a server with none of the
// session tools. The floor is the same-user floor, now written into the consent prompt.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { StackRefusal } from '../shared/stackWatch.ts'
import { refuseForStack, type AdoptedListeners } from './hubStandby.ts'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { cleanOriginalText, prepareAgentPayload, prepareRetrievalText } from './desktopIngress.ts'
import { factClosure } from '../shared/decisions.ts'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ABOUT_NAMESPACES,
  DEFAULT_CATEGORY,
  INSIGHT_CATEGORIES,
  describeCorrection,
  normaliseAbout,
  type Correction,
  type CorrectionOutcome
} from '../shared/memoryContract.ts'
import { beginAttempt, type AttemptContext } from './toolTrace.ts'
import { SURFACE_TOOLS } from '../shared/surfaceTools.ts'
import { HUB_TOOLS } from './hubTools.ts'
import { RESTART_ITEM_ADVICE } from '../shared/loginItem.ts'
import { stageTaskOf, type LiveClaim } from '../shared/spawnParent.ts'
import { PHASES, WAITING_PHASES } from '../shared/liveness.ts'
import { BOARD_SESSION_OPERATIONS, createBoard, PINNED_COMMS_OPERATIONS, type Board, type BoardCaller } from './boardService.ts'
import { registerBoardTools } from './boardTools.ts'
import { type TaskState } from '../shared/ladder.ts'
import type { AgentAccessDoor as RelayedAccessDoor } from './relayedAccess.ts'
import { registerAccessTools } from './relayedAccessTools.ts'
import type { Journal } from '@fabric/journal'
import type { PtyManager } from './pty'
import type { Policy } from './policy'
import { createScopedStore } from './scopedStore.ts'
import { buildProtocol, protocolHash } from '../shared/protocol.ts'
import { ops } from './opsSink.ts'
import { registerProjectTools } from './projectTools.ts'
import { registerEffectTools } from './effectTools.ts'
import { registerTaskTools } from './taskTools.ts'
import { registerQuestionTools } from './questionTools.ts'
import { assertAgentReference } from './agentReference.ts'
import { readProjectFacts, readThreadParticipants } from './boardWallReads.ts'
import { untilAnsweredOrGone } from './hangUp.ts'
import type { AccessService } from './accessService.ts'
import { ExternalIngress, type HubIngress } from './externalIngress.ts'
import { BodyReadTimeout, BodyTooLarge, readJson, refuse } from './requestBody.ts'
import { registerWorkTools, type LiveSession } from './workTools.ts'
import { currentLeases } from './agentSyncLeases.ts'
import type { SourceResolution } from './backlogSource.ts'
import type { LeaseRefsRead } from './agentSyncLeases.ts'
import { CLAIM_DEFAULT_MINUTES, sessionStale, type CameIn } from '../shared/workClaims.ts'
import type { Nudge } from '../shared/abandonedSweep.ts'
import { QUESTIONS_READ, readWaiting } from './sessionWaiting.ts'
import { APP_VERSION } from '../shared/appVersion.ts'
import type { MachineAgents } from '../shared/machineAgents.ts'
import type { PeerVerdict } from './peerAccount.ts'
import type { FolderAnswer } from './agentFolders.ts'


/** What one credential may see and do. Minted per session, dies with it. */

/** Every tool a Fabric surface registers (the session's, the hub's, a board session's): only these are counted in the
 *  operations digest by their own name (DEC-0153 OD-2, the 0.3.16 review's ER-11, `toolOutcome.ts#callOpName`). */
const KNOWN_TOOLS: ReadonlySet<string> = new Set([
  ...SURFACE_TOOLS.map((t) => t.name), ...HUB_TOOLS.door, ...HUB_TOOLS.binding, ...BOARD_SESSION_OPERATIONS
])
const isKnownTool = (name: string): boolean => KNOWN_TOOLS.has(name)


export interface AgentScope {
  token: string
  estateId: string
  projectId: string
  sessionId: string
  taskId: string | null
  /** How the session came in (REQ-38): launched by Fabric, or enrolled through the hub (ADR-0134). */
  cameIn: CameIn
  /** The coding agent, as Fabric knows it: the runner of a launch or of an enrollment's binding. */
  agent: string | null
  /** The coding agent's own session id, when it enrolled with one (D1); what a rejoin and an observation name. */
  runtimeSessionId: string | null
  /** Which server the scope is given (ADR-0115: authority is the server a principal gets). 'board': a board session from
   *  `fabric.board.join` (ADR-0149 §4) — the `com.*` tools and nothing else. */
  surface: 'session' | 'board'
  /** The hub binding an enrolled or board session came in under; null for a launched session (ADR-0149 §3). */
  bindingId: string | null
  /** When the authority the session came in under ends (a board session: its earliest board.respond grant's expiry, ms):
   *  its next call past it ends the session (ADR-0149 Amendment 2). Absent: no expiry is known here. */
  authorityUntil?: number | null
}

/** How a session was minted: launched (the default) or enrolled, with its runner. */
export interface MintOrigin {
  cameIn: CameIn
  agent: string | null
  runtimeSessionId?: string | null
  /** A bearer the session hooks' rejoin (D2) holds beside the agent's own: its client leaving takes only itself. */
  rejoin?: boolean
  /** The binding it came in under (enrolled, board session), for the board's responder grant (ADR-0149 §3). */
  bindingId?: string | null
  /** 'board': a board session (`fabric.board.join`), given only the respond-only `com.*` tools. */
  surface?: 'session' | 'board'
  /** When the authority it came in under ends, ms (AgentScope.authorityUntil). */
  authorityUntil?: number | null
  /** The coding agent's process, as its own fabric-mcp named it at enrollment (TR-1); what tells a hook's end whether
   *  the agent still runs (review iteration 2, ER-2). */
  agentPid?: number | null
  /** The folder the agent works in, as its enrollment resolved it (CO-498). Kept in memory only, for the screens and
   *  the branch reading; the journal keeps its digest (`session.enrolled@1` `cwd_sha256`). */
  folder?: string | null
}

/** What the claim tools need beyond the database (REQ-38, REQ-08; `workTools.ts`). Absent, they still serve, without backlog links or agent-sync leases. */
export interface SurfaceWorkDeps {
  resolveSource(projectId: string, source: { repository: string; path: string; id: string }): Promise<SourceResolution>
  leaseRefs(projectId: string): Promise<(LeaseRefsRead & { repository: string }) | null>
  /** Ends a session the way its own end would (an enrolled one through EnrolledSessions); default: revoke it here.
   *  `reason`, when given, is what the session's next call is told. */
  endSession?(sessionId: string, reason?: string): void
}

/**
 * The limits that decide how a credential behaves over time. Defaults are
 * chosen for one honest agent working at human pace, not for a benchmark: an
 * agent that reports a stage, searches memory and records a finding uses single
 * digits a minute. A credential that reaches the budget is in a loop.
 */
export interface AgentSurfaceLimits {
  /** How long a minted credential may sit before its session initialises. */
  claimWindowMs: number
  /** Calls one credential may make per window. */
  budgetCalls: number
  budgetWindowMs: number
  /** Maximum time to receive one JSON body, independent of the HTTP server timeout. */
  bodyReadMs: number
}


/** How often a claim holder's calls renew its claims, and how close to its expiry a claim must be to be renewed. */
export const RENEW_EVERY_MS = 5 * 60_000
export const RENEW_WITHIN_MS = 15 * 60_000
/** The agent's own client counts as connected while it signed within this (TR-2): fabric-mcp signs every two minutes
 *  (`fabricMcp.ts#SIGN_EVERY_MS`), so two missed signs and a half mean it is gone or hung. */
export const OWN_CLIENT_LIVE_MS = 5 * 60_000

export const DEFAULT_LIMITS: AgentSurfaceLimits = {
  claimWindowMs: 120_000,
  budgetCalls: 120,
  budgetWindowMs: 60_000,
  bodyReadMs: 10_000
}

/** CO-506: Agent access as an agent's door, with the read `fabric_access_list` shows. */
export interface AgentAccessDoor extends RelayedAccessDoor {
  overview: AccessService['overview']
  /** CO-506 (ADR-0190): the session's own project's board.respond, granted before its com.enroll. */
  grantOwnRespond?: AccessService['grantOwnProjectRespond']
}

export interface AgentSurfaceDeps {
  access?: AgentAccessDoor
  /** A session's nudges from the sweep of abandoned work, taken by the answer that carries them (0.3.13 wave 2, SW-4;
   *  `abandonedSweepRun.ts#createAbandonedSweep`). Absent: no answer carries nudges. */
  nudges?: (sessionId: string, projectId: string) => string[]
  /** The nudges a turn's answer shows (`fabric_session_observe`, 0.3.14 wave 2; review iteration 1, PL-1): from the same
   *  queue, shown and never taken, at most five, the same for a repeat of the turn's idempotencyKey. */
  turnNudges?: (sessionId: string, projectId: string, turnKey: string) => Nudge[]
  /** CO-459 (DEC-0140 PR-3): a turn's reported branch, held by the host for this machine's screens only. */
  reportBranch?: (sessionId: string, branch: string | null) => void
  /** CO-458: a task released done reached review; answers its cross-project board request, if it has one. */
  onDoneInReview?: (taskId: string) => void
  db: SupabaseClient
  journal: Journal
  /** Read late, and it can answer NOTHING. The surface starts listening before
   *  the terminal manager is constructed — `start()` is awaited on the line
   *  after the surface is built, the manager three database round-trips later —
   *  so a request arriving in that window finds this accessor returning
   *  `undefined`. Typing it as always-present made `ptys().get(…)` a crash in
   *  that window instead of an answer, and a 500 is not a refusal: it carries no
   *  reason and leaves no row. Every reader of it below is total. */
  ptys: () => PtyManager | undefined
  /** The decision port. Optional so the probes can stand the surface up
   *  without one; the tool that needs it says so rather than pretending. */
  policy?: Policy
  estateId: string
  /** Injected so the expiry probe does not have to sleep for two minutes. */
  now?: () => number
  /** Whether a process runs on this machine (`hub.ts#pidAlive`); the probe passes its own. */
  pidAlive?: (pid: number) => boolean
  limits?: Partial<AgentSurfaceLimits>
  /** ADR-0115's external ingress. Absent, the surface is exactly the session door it always was. */
  hub?: HubIngress
  work?: SurfaceWorkDeps
  /**
   * A session's credentials are gone (it ended, was revoked, or the app is quitting): its claims are released
   * (REQ-38: a session's claims end with it). Awaited, bounded, by `stop()`; never throws into the caller.
   */
  onSessionEnded?: (sessionId: string, why: 'ended' | 'app-quit') => Promise<void>
  /** The agents' working language (P-24): the interface's locale, or null when the person switched it off or the settings
   *  could not be read (ADR-0174). Absent: English; throwing: none named. */
  language?: () => string | null | undefined
  /** This computer's trust from Settings (ADR-0176 §3), read at each fabric_whoami; null or absent is not trusted. */
  machineTrust?: () => string | null | undefined
  /** The operator, 2026-11-07: the agents and services of this machine (`shared/machineAgents.ts`), read at each
   *  fabric_whoami so a session calls the agent that owns a job; null when the registry could not be read. */
  machineAgents?: () => MachineAgents | null
  /** CO-514 (DEC-0154 HA-2 (b), HA-3): whose process is on the other end of a connection; absent, not checked. */
  peerAccount?: (socket: import('node:net').Socket) => Promise<PeerVerdict>
  /** CO-409 (§3.1): a board request a session stored; the host wakes the dispatcher for it. */
  onRequestStored?: (request: { target: string; capability: string }) => void
  /** CO-489: the project page's folder buttons as the session's door (`agentFolders.ts`); absent, the tools refuse. */
  folders?: {
    attach(projectId: string, folder: unknown, sessionId: string): Promise<FolderAnswer>
    detach(projectId: string, folder: unknown, sessionId: string): Promise<FolderAnswer>
  }
}

/** Why the surface could not take its port. A port is stable or there is no hub: never a fallback. */
export class HubPortUnavailable extends Error {
  readonly port: number
  constructor(port: number, reason: string) {
    super(reason)
    this.name = 'HubPortUnavailable'
    this.port = port
  }
}

/** Everything the surface knows about one credential's life. Never leaves here. */
interface ScopeState {
  scope: AgentScope
  mintedAt: number
  /** Set the moment a credential is spent on its one initialize. */
  claimedAt: number | null
  /** The second half of the handshake; returned to the client, never written down. */
  mcpSessionId: string | null
  transport: StreamableHTTPServerTransport | null
  windowStart: number
  callsInWindow: number
  /** Minted for a rejoin (MintOrigin.rejoin): not the session's own bearer. */
  rejoin: boolean
}

/** How many ended bearers the surface remembers the reason of, so their next call is told it (ER-4). Hashes only. */
const ENDED_REMEMBERED = 256
/** How many sessions' recorded ends a run remembers (DA-1): far more than the sessions one run of Fabric serves. */
const END_RECORDS_REMEMBERED = 4096
const bearerDigest = (token: string): string => createHash('sha256').update(token, 'utf8').digest('hex')

/** A JSON-RPC body that carries a tool call: an agent at work, as a keep-alive ping or a notification is not (CO-565,
 *  CO-571). A batch counts when any of its messages is one. */
export function isWorkCall(body: unknown): boolean {
  const messages = Array.isArray(body) ? body : [body]
  return messages.some((m) => typeof m === 'object' && m !== null && (m as { method?: unknown }).method === 'tools/call')
}

// Moved with the ingress and the task tools (the screens waves S2); exported here as they always were.
export { handoffDisposition, mayPublishHandoff, writeScopeConflicts } from './taskTools.ts'
export { bindingCallBucket, SESSION_WINDOWS_PER_BINDING, type HubIngress } from './externalIngress.ts'
export { BodyTooLarge, MAX_BODY_BYTES } from './requestBody.ts'

export class AgentSurface {
  private states = new Map<string, ScopeState>()
  /**
   * Why a bearer this surface held was ended, by its sha256 (0.3.5 review iteration 2, ER-4): an evicted session's
   * next call is told it was evicted and that its claims went, not "unknown credential", which its client could
   * only read as "Fabric restarted". Bounded (ENDED_REMEMBERED, oldest first out); never the bearer itself.
   */
  private endedWhy = new Map<string, string>()
  /** Sessions already recorded as oriented, with the protocol hash they were last served. In memory on
   *  purpose: the question the journal is asked is "did this session EVER read its rules", so a restart
   *  appending a second row costs nothing, while a table to prevent it would be state kept for tidiness.
   *  A later fabric_whoami that serves DIFFERENT rules (the working language or this computer's trust changed
   *  in Settings) is recorded again with the new hash (CO-399), so the journal says what each session was
   *  oriented to, not only what it was first told. */
  private oriented = new Map<string, string>()
  private http: Server | null = null
  /** The hub port held on [::1] as well (ER-8); null for an ephemeral session port. */
  private http6: Server | null = null
  private port = 0

  private deps: AgentSurfaceDeps
  private now: () => number
  private pidAlive: (pid: number) => boolean
  private limits: AgentSurfaceLimits
  /** ADR-0115's external ingress and its budgets (`externalIngress.ts`). */
  private ingress: ExternalIngress
  /** The project board's participant half (COM-02.2, ADR-0117); its cursor key lives for this run only. */
  private board: Board
  // #region surface-session-registry — docs: docs/ux/scenarios.md#scn-141-see-where-work-is-across-every-project--sessions-claims-review-and-sessions-with-no-project
  /**
   * Every session this surface holds a credential for, launched or enrolled, with its last call (CO-256): the
   * liveness signal other sessions' `fabric_work_list` and the operator's screens read. In memory: it is what this
   * process can vouch for, and a restart is exactly the moment those sessions' bearers stop working.
   */
  private live = new Map<string, { projectId: string; cameIn: CameIn; agent: string | null; runtimeSessionId: string | null; mintedAt: number; lastCallAt: number | null; surface?: 'session' | 'board'; bindingId?: string | null; /** The last call of the session's own client, not a rejoin's (TR-2). */ lastOwnCallAt?: number | null; /** Its last tool call, never a keep-alive ping or a notification: work, as the dispatcher reads it (CO-565, CO-571). */ lastWorkAt?: number | null; /** The agent's process (ER-2, i2). */ agentPid?: number | null; /** Its folder, in memory only (CO-498). */ folder?: string | null }>()
  /** Sessions holding a claim, and when their calls next renew it (REQ-38: "its calls renew the claim"). */
  private claimHolders = new Map<string, number>()
  /** Session-end releases in flight; `stop()` waits for them, bounded. */
  private ending = new Set<Promise<void>>()
  /** Sessions whose `session.ended@1` this run has written or is writing (DA-1): the hook's end or the agent's leave,
   *  whichever comes first, records it; the other records nothing. Bounded, oldest first out. */
  private endRecorded = new Set<string>()
  // #endregion surface-session-registry

  // Assigned in the body rather than declared as a parameter property: Node's
  // type-stripping loader rejects parameter properties, and this class is
  // exercised directly by apps/desktop/test/agent-surface.test.mjs.
  constructor(deps: AgentSurfaceDeps) {
    this.deps = deps
    this.now = deps.now ?? Date.now
    this.pidAlive = deps.pidAlive ?? pidAlive
    this.limits = { ...DEFAULT_LIMITS, ...(deps.limits ?? {}) }
    this.ingress = new ExternalIngress({ limits: this.limits, now: () => this.now(), estateId: deps.estateId })
    this.board = createBoard({
      // i3 ER-1: the wall's reads pass its deadline as `signal`, so a slow read is stopped there.
      rpc: (fn, args, signal) => (signal ? deps.db.rpc(fn, args).abortSignal(signal) : deps.db.rpc(fn, args)),
      // CO-368, CO-369 (0.3.12 W2 S2): the estate's Projects with their business and primary repository, for the wall
      // between businesses and the directory's names; DO-9: an existing thread's participants, for the wall on a post
      // into it. Both throw with their reason, which the board logs before it lets the post through (0.3.12 review i2
      // ER-3, ER-4, DA-3, DA-4; `boardWallReads.ts`).
      projectFacts: (estateId, signal) => readProjectFacts(deps.db, estateId, signal),
      threadParticipants: (estateId, reader, threadId, signal) => readThreadParticipants(deps.db, estateId, reader, threadId, signal),
      onRequestStored: deps.onRequestStored
    })
  }

  /** This computer's trust (ADR-0176 §3). A settings read that throws reads as not trusted: the stricter rule. */
  private readMachineTrust(): string | null {
    try { return this.deps.machineTrust?.() ?? null } catch (e) {
      ops.failed('agentSurface.machine-trust-read', e, { note: 'the settings could not be read; this computer is treated as not trusted' })
      return null
    }
  }

  /** The working language's locale (P-24). A settings read that throws must not cost an agent its rules. */
  private readLanguage(): string | null | undefined {
    try { return this.deps.language?.() } catch (e) {
      // Unknown is not on: the person may have switched it off, so no language is named (0.3.11 review DA-12).
      ops.failed('agentSurface.working-language-read', e, { note: 'the settings could not be read; the rules name no language' })
      return null
    }
  }

  /** The address a session's mcp.json points at. Empty until start() resolves. */
  get endpoint(): string {
    return this.port ? `http://127.0.0.1:${this.port}/mcp` : ''
  }

  /** `http://127.0.0.1:<port>` once listening — what `hub.json` publishes. Empty until then. */
  get origin(): string {
    return this.port ? `http://127.0.0.1:${this.port}` : ''
  }

  /**
   * Listen. `port` 0 (the default, and every probe's) takes an ephemeral port; the app passes the
   * hub's stable port, and a port that cannot be taken is a `HubPortUnavailable` — the caller says
   * why, rather than this moving somewhere an agent's stored origin does not point.
   */
  async start(opts: { port?: number; adopt?: AdoptedListeners | (() => AdoptedListeners) } = {}): Promise<void> {
    if (this.http) return
    // V2 ER-3: after restart, valid bindings must not share the unknown-token lookup bucket.
    // This snapshot is only a budget hint; every request still authenticates against live state, so a warm-up
    // that fails costs the hint, never the surface sessions depend on (I3 E-3).
    try { await this.deps.hub?.access.primeCredentialVerifiers() } catch (e) {
      ops.failed('agentSurface.prime-credential-verifiers', e, { note: 'known bindings share the unknown-bearer budget until they authenticate' })
    }
    // M104 — NOT fire-and-forget. `void this.handle(...)` with three reachable
    // throws inside meant a rejection left `res` unwritten: the agent blocked
    // until its own timeout with its call budget already spent, and the main
    // process logged an unhandled rejection nobody reads. An agent that HANGS is
    // worse than one that fails — it looks like work in progress.
    // #region hub-standby-adopt — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#stability
    // ST-3: the sockets the hub standby held while the stack started are taken over as they are, so the port is never
    // free for a moment and the hub keeps the hub.json the standby published.
    // 0.3.9 review ER-2: given as a function, the handover runs HERE, after the prime above and in the same synchronous
    // step that attaches this surface's handler, so the standby answers every request until the surface does: a request
    // can never reach the sockets while neither handler is on them.
    if (opts.adopt) {
      const adopted = typeof opts.adopt === 'function' ? opts.adopt() : opts.adopt
      const answer = (label: string) => (req: IncomingMessage, res: ServerResponse): void => {
        void this.handle(req, res).catch((e) => {
          ops.failed('agentSurface.agent-surface-the-request-handler-threw', e, { note: `agent surface (${label}): the request handler threw:` })
          if (res.headersSent) res.destroy()
          else AgentSurface.refuse(res, 500, 'the surface failed to handle this request')
        })
      }
      adopted.server.on('request', answer('127.0.0.1'))
      adopted.server6?.on('request', answer('[::1]'))
      this.http = adopted.server
      this.http6 = adopted.server6
      this.port = adopted.port
      return
    }
    // #endregion hub-standby-adopt
    const server = createServer((req, res) => {
      void this.handle(req, res).catch((e) => {
        ops.failed('agentSurface.agent-surface-the-request-handler-threw', e, { note: 'agent surface: the request handler threw:' })
        // Headers already sent means a partial answer is on the wire and the
        // only honest end is to cut it: a second status line would be a lie
        // about a response the client has begun reading.
        if (res.headersSent) res.destroy()
        else AgentSurface.refuse(res, 500, 'the surface failed to handle this request')
      })
    })
    const wanted = opts.port ?? 0
    const taken = (host: string, e: NodeJS.ErrnoException): Error =>
      wanted && (e.code === 'EADDRINUSE' || e.code === 'EACCES')
        ? new HubPortUnavailable(
            wanted,
            `port ${wanted} on ${host} is ${e.code === 'EADDRINUSE' ? 'already in use by another program' : 'not available to this user'}, so agents outside Fabric cannot reach it. ` +
              `Close that program (or choose a free port with FABRIC_HUB_PORT), then ${RESTART_ITEM_ADVICE}`
          )
        : e
    await new Promise<void>((resolve, reject) => {
      server.once('error', (e: NodeJS.ErrnoException) => reject(taken('127.0.0.1', e)))
      // Loopback only: this door is for processes on this machine, and binding
      // wider would put the estate on the network without anyone deciding to.
      server.listen(wanted, '127.0.0.1', () => resolve())
    })
    // THE HUB PORT IS FABRIC'S ON BOTH LOOPBACKS (ER-8). Holding only 127.0.0.1 let another program bind
    // the same port on [::1] (libuv sets SO_REUSEADDR), and an agent dialling `localhost` reached it while
    // hub.json's pid — Fabric's — was alive. A [::1] the system does not have is no risk and is skipped;
    // one another program holds refuses the hub port exactly as 127.0.0.1 taken does.
    if (wanted) {
      const server6 = createServer((req, res) => {
        void this.handle(req, res).catch((e) => {
          ops.failed('agentSurface.agent-surface-the-request-handler-threw', e, { note: 'agent surface ([::1]): the request handler threw:' })
          if (res.headersSent) res.destroy()
          else AgentSurface.refuse(res, 500, 'the surface failed to handle this request')
        })
      })
      const bound6 = await new Promise<Error | 'bound' | 'absent'>((resolve) => {
        server6.once('error', (e: NodeJS.ErrnoException) =>
          resolve(e.code === 'EADDRNOTAVAIL' || e.code === 'EAFNOSUPPORT' ? 'absent' : taken('[::1]', e)))
        server6.listen({ port: wanted, host: '::1', ipv6Only: true }, () => resolve('bound'))
      })
      if (bound6 instanceof Error) {
        await closeHttpServer(server)
        throw bound6
      }
      if (bound6 === 'bound') this.http6 = server6
      else ops.record({ op: 'agentSurface.ipv6-loopback-absent', outcome: 'ok', detail: { port: wanted }, ctx: { correlationId: ops.correlate() } })
    }
    const address = server.address()
    this.port = typeof address === 'object' && address ? address.port : 0
    this.http = server
  }

  async stop(): Promise<void> {
    // The app is quitting: every session still held ends with it, and its claims are released first (bounded, so
    // a database that does not answer cannot hold the quit past its deadline — LC-01).
    for (const sessionId of [...this.live.keys()]) this.sessionEnded(sessionId, 'app-quit')
    if (this.ending.size)
      await Promise.race([Promise.allSettled([...this.ending]), new Promise((r) => setTimeout(r, 3_000).unref?.())])
    for (const token of [...this.states.keys()]) this.drop(token)
    const server = this.http
    const server6 = this.http6
    this.http = null
    this.http6 = null
    this.port = 0
    if (server) await closeHttpServer(server)
    if (server6) await closeHttpServer(server6)
  }

  mint(projectId: string, sessionId: string, taskId: string | null, origin?: MintOrigin): AgentScope {
    // A launched session's runner is the terminal's; a second bearer for a session already held keeps its origin.
    const known = this.live.get(sessionId)
    const scope: AgentScope = {
      token: randomBytes(24).toString('base64url'),
      estateId: this.deps.estateId,
      projectId,
      sessionId,
      taskId,
      cameIn: origin?.cameIn ?? known?.cameIn ?? 'launched',
      agent: origin?.agent ?? known?.agent ?? null,
      runtimeSessionId: origin?.runtimeSessionId ?? known?.runtimeSessionId ?? null,
      surface: origin?.surface ?? known?.surface ?? 'session',
      bindingId: origin?.bindingId ?? known?.bindingId ?? null,
      authorityUntil: origin?.authorityUntil ?? null
    }
    const now = this.now()
    if (!known)
      this.live.set(sessionId, { projectId, cameIn: scope.cameIn, agent: scope.agent, runtimeSessionId: scope.runtimeSessionId, mintedAt: now, lastCallAt: null, surface: scope.surface, bindingId: scope.bindingId, agentPid: origin?.agentPid ?? null, folder: origin?.folder ?? null })
    // TR-1: a rejoin minted under a runtime id the session did not have is the rename the enrollment matched by the
    // agent's process (a /clear): the session carries the new id from now on.
    else if (origin?.rejoin && origin.runtimeSessionId && origin.runtimeSessionId !== known.runtimeSessionId)
      known.runtimeSessionId = origin.runtimeSessionId
    // ER-2 (i2): a process named later (an enrollment that matched the session) is kept; one already named is not
    // replaced by a rejoin's, which is found from the agent's session file and may be absent.
    if (known && typeof origin?.agentPid === 'number' && typeof known.agentPid !== 'number') known.agentPid = origin.agentPid
    // CO-498: a folder named later (a rejoin that resolved it) is kept; one already named is not replaced.
    if (known && typeof origin?.folder === 'string' && origin.folder && !known.folder) known.folder = origin.folder
    // #region surface-unclaimed-sweep — docs: docs/adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md#amendments
    // A bearer no client presented within its claim window is swept here (0.3.5 review iteration 2, ER-5): a hook
    // process that died before its initialize would otherwise stay in the map for the life of the app, because the
    // only other drop is when someone presents it. Its next presentation is told it expired, as before.
    for (const [token, st] of this.states) {
      if (st.claimedAt === null && now - st.mintedAt > this.limits.claimWindowMs) this.forget(token, 'credential expired before its session initialised')
    }
    // #endregion surface-unclaimed-sweep
    this.states.set(scope.token, {
      scope,
      mintedAt: now,
      claimedAt: null,
      mcpSessionId: null,
      transport: null,
      windowStart: now,
      callsInWindow: 0,
      rejoin: origin?.rejoin === true
    })
    return scope
  }

  /** A session that ended can no longer act; its credential goes with it. `reason`, when given, is what the next call
   *  of any of its bearers is told (an eviction, ER-4). */
  revokeSession(sessionId: string, reason?: string): void {
    for (const [token, st] of this.states) {
      if (st.scope.sessionId !== sessionId) continue
      if (reason) this.forget(token, reason)
      else this.drop(token)
    }
    if (this.live.has(sessionId)) this.sessionEnded(sessionId, 'ended')
  }

  /** One bearer goes and nothing else: the session it belongs to goes on (a rejoin bearer replaced, ER-5). */
  revokeCredential(token: string): void {
    this.drop(token)
  }

  /** Drops a bearer and remembers why, by its digest, for its next presentation. */
  private forget(token: string, reason: string): void {
    this.drop(token)
    const key = bearerDigest(token)
    this.endedWhy.delete(key)
    this.endedWhy.set(key, reason)
    while (this.endedWhy.size > ENDED_REMEMBERED) this.endedWhy.delete(this.endedWhy.keys().next().value as string)
  }

  /** The session is gone from this surface; its claims are released through `onSessionEnded` (once). */
  private sessionEnded(sessionId: string, why: 'ended' | 'app-quit'): void {
    if (!this.live.delete(sessionId)) return
    this.claimHolders.delete(sessionId)
    // #region board-release-session — docs: docs/adr/0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md#5-leases-fences-and-the-clock
    // DEC-0073 §5: the session's end releases every responder slot it holds. Best effort: the authority recheck inside
    // every transition is what refuses a released responder; a release that fails leaves a lease that lapses in 60 s.
    const released: Promise<void> = this.board.releaseSession(this.deps.estateId, sessionId).then((n) => {
      if (n === null) ops.record({ op: 'agentSurface.board-release', outcome: 'failed', level: 'warn', detail: { session_id: sessionId, why }, ctx: { correlationId: ops.correlate() } })
    }, (e) => { ops.failed('agentSurface.board-release', e, { note: 'its responder leases lapse in 60 s', session_id: sessionId }) })
      .finally(() => { this.ending.delete(released) })
    this.ending.add(released)
    // #endregion board-release-session
    const hook = this.deps.onSessionEnded
    if (!hook) return
    const p: Promise<void> = hook(sessionId, why).catch((e) => {
      ops.failed('agentSurface.session-end-release', e, { note: 'the ended session\'s claims stay until they lapse', session_id: sessionId })
    }).finally(() => { this.ending.delete(p) })
    this.ending.add(p)
  }

  // #region surface-session-registry-read — docs: docs/ux/scenarios.md#scn-141-see-where-work-is-across-every-project--sessions-claims-review-and-sessions-with-no-project
  /** The sessions this surface holds, one per session (CO-256): launched and enrolled, with their last call. */
  heldSessions(projectId?: string): Array<{ sessionId: string; projectId: string; cameIn: CameIn; agent: string | null; runtimeSessionId: string | null; startedAt: number; lastCallAt: number | null; lastWorkAt: number | null; surface: 'session' | 'board'; folder: string | null }> {
    return [...this.live.entries()]
      .filter(([, s]) => !projectId || s.projectId === projectId)
      .map(([sessionId, s]) => ({ sessionId, projectId: s.projectId, cameIn: s.cameIn, agent: s.agent, runtimeSessionId: s.runtimeSessionId, startedAt: s.mintedAt, lastCallAt: s.lastCallAt, lastWorkAt: s.lastWorkAt ?? null, surface: s.surface ?? 'session', folder: s.folder ?? null }))
  }

  /** What this surface holds of one session; null when nothing (ended, or minted by an earlier run of Fabric). */
  sessionSign(sessionId: string): { lastSignAt: number | null } | null {
    const s = this.live.get(sessionId)
    if (!s) return null
    const pty = this.deps.ptys()?.get(sessionId)
    const ptyAt = pty?.lastActivityAt ? Date.parse(pty.lastActivityAt) : null
    const at = Math.max(s.lastCallAt ?? 0, ptyAt ?? 0)
    return { lastSignAt: at || null }
  }
  /** A project's live sessions for `fabric_work_list`: what this surface holds, and the terminals running there. */
  private projectSessions(projectId: string): LiveSession[] {
    const out = new Map<string, LiveSession>()
    for (const s of this.heldSessions(projectId)) {
      const sign = this.sessionSign(s.sessionId)
      out.set(s.sessionId, { sessionId: s.sessionId, agent: s.agent, cameIn: s.cameIn, startedAt: s.startedAt, lastSignAt: sign?.lastSignAt ?? null })
    }
    for (const p of this.deps.ptys()?.list(projectId) ?? []) {
      if (!p.running) continue
      const held = out.get(p.sessionId)
      const at = Date.parse(p.lastActivityAt)
      if (held) out.set(p.sessionId, { ...held, agent: held.agent ?? p.optionId, lastSignAt: Math.max(held.lastSignAt ?? 0, at) || null })
      else out.set(p.sessionId, { sessionId: p.sessionId, agent: p.optionId, cameIn: 'launched', startedAt: Date.parse(p.startedAt), lastSignAt: at })
    }
    return [...out.values()]
  }
  // #endregion surface-session-registry-read

  // #region session-enroll-credential-state — docs: docs/adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md#amendments
  /** What this surface holds of a bearer: minted and not yet spent on its one initialize (and still within its
   *  claim window), spent by an initialised session, or nothing (never minted, revoked, or expired unclaimed). Read
   *  by the enrollment to hand an unspent bearer out again instead of minting another (`sessionEnroll.ts`). */
  credentialState(token: string): 'unclaimed' | 'claimed' | null {
    const st = this.states.get(token)
    if (!st) return null
    if (st.claimedAt !== null) return 'claimed'
    return this.now() - st.mintedAt > this.limits.claimWindowMs ? null : 'unclaimed'
  }
  // #endregion session-enroll-credential-state

  // #region board-session-join — docs: docs/adr/0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md#4-service-agents-join-with-a-board-session
  /**
   * `fabric.board.join` (ADR-0149 §4): a binding with a live board.respond grant on the Project gets a board session —
   * one bearer, the `com.*` tools only. Answers the bearer with the capabilities and the grants it came in under (a
   * revocation of any of them ends the session), or the board's refusal.
   */
  async joinBoard(binding: { id: string; agent_id: string }, projectId: string, sessionId: string, opts: { authorityUntil?: number | null } = {}): Promise<{ token: string; capabilities: string[]; grants: string[] } | { error: { code: string; message: string } }> {
    const checked = await this.board.joinCheck(this.deps.estateId, binding.id, projectId)
    if ('error' in checked) return { error: { code: checked.error.code, message: checked.error.message } }
    const { token } = this.mint(projectId, sessionId, null, { cameIn: 'hub', agent: binding.agent_id, bindingId: binding.id, surface: 'board', authorityUntil: opts.authorityUntil ?? null })
    return { token, capabilities: checked.capabilities, grants: checked.grants }
  }

  /** The board's own join check (the grants a binding holds on one Project), for the hub's read-again after a mint. */
  /**
   * CO-458: the operator's own acts on the board for one of their Projects, from Fabric's window («Поручить агенту B»):
   * a request sent, a request answered, the epoch it submits under. The principal is the operator, trusted (the window is
   * theirs); the board's walls apply as to any submit (another business is refused before anything is stored).
   */
  operatorBoard(projectId: string, operatorId: string): {
    submit(input: unknown): Promise<Record<string, unknown>>
    reply(input: unknown): Promise<Record<string, unknown>>
    /** `com.cancel` as this Project (the people-ask bridge takes back a request it sent, task 11ebbf83). */
    cancel(input: unknown): Promise<Record<string, unknown>>
    epoch(): Promise<number | null>
  } {
    const caller: BoardCaller = { estateId: this.deps.estateId, projectId, principal: { kind: 'operator', id: operatorId.slice(0, 200), provenance: 'trusted' }, surface: 'session' }
    return {
      submit: (input) => this.board.submit(caller, input) as Promise<Record<string, unknown>>,
      reply: (input) => this.board.reply(caller, input) as Promise<Record<string, unknown>>,
      cancel: (input) => this.board.cancel(caller, input) as Promise<Record<string, unknown>>,
      epoch: async () => {
        const s = await this.board.status(caller) as { idempotency?: { epoch?: unknown } }
        return typeof s?.idempotency?.epoch === 'number' ? s.idempotency.epoch : null
      }
    }
  }

  boardJoinCheck(bindingId: string, projectId: string): ReturnType<Board['joinCheck']> {
    return this.board.joinCheck(this.deps.estateId, bindingId, projectId)
  }

  /** A board.respond grant was revoked: the enrollments it admitted are released (COM03-10). Best effort. */
  async releaseBoardGrant(grantId: string): Promise<void> {
    try {
      if ((await this.board.releaseGrant(this.deps.estateId, grantId)) === null)
        ops.record({ op: 'agentSurface.board-release-grant', outcome: 'failed', level: 'warn', detail: { grant_id: grantId }, ctx: { correlationId: ops.correlate() } })
    } catch (e) {
      ops.failed('agentSurface.board-release-grant', e, { note: 'the authority recheck still refuses its responder', grant_id: grantId })
    }
  }
  // #endregion board-session-join

  /** Test seam and honest accounting: what the surface currently holds. */
  credentialCount(): number {
    return this.states.size
  }

  private drop(token: string): void {
    const st = this.states.get(token)
    this.states.delete(token)
    // Closing the transport tears down the MCP session too, so a client holding
    // the session id gains nothing from the credential outliving the map entry.
    void st?.transport?.close()
  }

  private static refuse(
    res: ServerResponse,
    status: number,
    reason: string,
    extra: Record<string, string> = {},
    attempt?: { refused(reason: string): void }
  ): void {
    refuse(res, status, reason, extra, attempt)
  }

  // #region stack-unavailable-mode — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#stability
  /** Set while the stack is lost (ST-2): every call is refused 503 with this code and Retry-After. */
  private unavailable: StackRefusal | null = null

  /** Enter (a refusal) or leave (null) the stack-unavailable mode. The runtime stack watch sets it on a change of
   *  state, never per tick. */
  setUnavailable(refusal: StackRefusal | null): void {
    this.unavailable = refusal
  }
  // #endregion stack-unavailable-mode

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // V2 ER-3: validate the local destination BEFORE reading any bearer or callback state.
    // Native clients use the published literal loopback origin; browser origins carry no authority here.
    if (![ `127.0.0.1:${this.port}`, `[::1]:${this.port}` ].includes(req.headers.host ?? '')) {
      AgentSurface.refuse(res, 421, 'the Host does not name this Fabric loopback listener')
      return
    }
    if (req.headers.origin !== undefined) {
      AgentSurface.refuse(res, 403, 'browser origins cannot call the Fabric agent surface')
      return
    }
    // CO-514 (DEC-0154 HA-2 (b), HA-3): on a computer several people use, a process of another account is refused
    // before anything of its request is read; one whose account cannot be told is answered with a wait.
    if (this.deps.peerAccount) {
      const verdict = await this.deps.peerAccount(req.socket)
      if (verdict === 'foreign' || verdict === 'unverified') {
        const code = verdict === 'foreign' ? 'peer-foreign-account' : 'peer-unverified'
        ops.record({ op: 'agentSurface.peer-refused', outcome: 'ok', level: 'warn', detail: { code }, ctx: { correlationId: ops.correlate() } })
        // The 0.3.17 review, ER-1: an account that could not be told (a slow or failed table read) is a wait, 503 with
        // Retry-After, never a 403 a client reads as a revoked credential; another account's process is 403.
        const unverified = code === 'peer-unverified'
        res.writeHead(unverified ? 503 : 403, { 'content-type': 'application/json', ...(unverified ? { 'retry-after': '5' } : {}) })
        res.end(JSON.stringify({ error: unverified ? 'peer-unverified: the account of the caller could not be told' : 'peer-foreign-account: another account of this computer called the hub', code }))
        return
      }
    }
    // ST-2: with the database gone every call would fail on its first read; it is told to wait instead, before any
    // credential lookup or body read. A DELETE (a client leaving) still goes through: it costs no answer the client waits on.
    if (this.unavailable && req.method === 'POST') {
      refuseForStack(req, res, this.port, this.unavailable)
      return
    }
    // ADR-0115 §4: a product delivering its key to the callback this hub put in its connect link.
    // Not an MCP route and not bearer-authenticated: the single-use state in the body is the proof.
    // A hub with no published door token is CLOSED: no callback and no external principal, so the
    // surface is exactly the session door it was before ADR-0115 (the app falls back to that when the
    // hub's port could not be taken).
    const hub = this.deps.hub && this.deps.hub.doorToken() !== null ? this.deps.hub : null
    const connect = req.method === 'POST' ? /^\/fabric\/v1\/connect\/([a-z][a-z0-9-]{1,62})$/.exec((req.url ?? '').split('?')[0]) : null
    if (connect && hub?.callback) {
      await hub.callback(connect[1], req, res)
      return
    }
    // An MCP client that leaves says so with DELETE (the transport's terminateSession, ER-4); nothing else but POST.
    const leaving = req.method === 'DELETE'
    if ((req.method !== 'POST' && !leaving) || !req.url?.startsWith('/mcp')) {
      res.writeHead(404).end()
      return
    }
    // S05 — ONE installation, and every exit below is covered by it, including
    // the four that answer 401 before a handler exists and the one inside the
    // SDK where a schema refusal is decided. The context object is filled in as
    // the credential resolves; the record reads it at the end.
    const ctx: AttemptContext = { correlationId: ops.correlate(), estateId: this.deps.estateId }
    const attempt = beginAttempt({ req, res, ctx, knownTool: isKnownTool })

    const auth = req.headers.authorization ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    const st = this.states.get(token)
    if (!st) {
      // A bearer this surface ended with a reason (an eviction): the reason, so the agent knows its claims went.
      const why = token ? this.endedWhy.get(bearerDigest(token)) : undefined
      if (why) {
        AgentSurface.refuse(res, 401, why, {}, attempt)
        return
      }
      // A session's bearer is looked up FIRST and is never confused with an external credential:
      // only a bearer that is not a session's reaches the hub's door (ADR-0115).
      if (token && !leaving && hub && (await this.ingress.handle(token, hub, req, res, ctx, attempt))) return
      // No credential, no scope, no surface. The absence of a token is not a
      // reason to fall back to something broader.
      AgentSurface.refuse(res, 401, 'unknown or revoked credential', {}, attempt)
      return
    }
    ctx.sessionId = st.scope.sessionId
    if (st.scope.projectId) ctx.projectId = st.scope.projectId
    if (leaving) {
      this.leave(token, st, req, res, attempt)
      return
    }

    const now = this.now()

    // #region board-session-expiry — docs: docs/adr/0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md#amendments
    // A grant that EXPIRES fires no revocation listener: the session it admitted is ended at its next call, the way a
    // revocation ends it — its slots released, its next bearer told why (ADR-0149 Amendment 2, wave-2 fix 14).
    if (st.scope.authorityUntil != null && now >= st.scope.authorityUntil) {
      const why = 'this board session ended: the operator\'s board.respond grant it joined under expired. The operator grants it again in Fabric, Agent access in the left column; then join again with fabric.board.join'
      const end = this.deps.work?.endSession
      if (end) end(st.scope.sessionId, why)
      else this.revokeSession(st.scope.sessionId, why)
      AgentSurface.refuse(res, 401, why, {}, attempt)
      return
    }
    // #endregion board-session-expiry

    // A credential minted for a session that never arrived is not a credential
    // waiting patiently, it is a credential lying around. Spawn can fail, and
    // when it does nothing else would ever clear this one.
    if (st.claimedAt === null && now - st.mintedAt > this.limits.claimWindowMs) {
      this.drop(token)
      AgentSurface.refuse(res, 401, 'credential expired before its session initialised', {}, attempt)
      return
    }

    if (now - st.windowStart >= this.limits.budgetWindowMs) {
      st.windowStart = now
      st.callsInWindow = 0
    }
    if (st.callsInWindow >= this.limits.budgetCalls) {
      // 429 rather than a silent slow-down: an agent in a loop must be able to
      // read that it is in one, and a person watching must see it too.
      const retryIn = Math.ceil((st.windowStart + this.limits.budgetWindowMs - now) / 1000)
      ops.record({
        op: 'agentSurface.budgetExhausted',
        outcome: 'ok',
        level: 'warn',
        detail: { calls: this.limits.budgetCalls, window_s: this.limits.budgetWindowMs / 1000, retry_in_s: retryIn },
        ctx: { correlationId: ctx.correlationId, estateId: this.deps.estateId, sessionId: st.scope.sessionId }
      })
      AgentSurface.refuse(
        res,
        429,
        `call budget exhausted: ${this.limits.budgetCalls} calls per ` +
          `${this.limits.budgetWindowMs / 1000}s. Retry in ${retryIn}s.`,
        { 'retry-after': String(Math.max(1, retryIn)) },
        attempt
      )
      return
    }
    st.callsInWindow++

    let body: unknown
    try {
      body = await readJson(req, this.limits.bodyReadMs)
    } catch (e) {
      if (e instanceof BodyTooLarge) {
        AgentSurface.refuse(res, 413, 'request body too large', {'connection':'close'}, attempt)
        return
      }
      if (e instanceof BodyReadTimeout) {
        AgentSurface.refuse(res, 408, 'request body deadline exceeded', {'connection':'close'}, attempt)
        return
      }
      throw e
    }
    attempt.saw(body)
    // V2 ER-5: MCP removed JSON-RPC batches; one HTTP envelope must not bypass per-call budgets.
    if (Array.isArray(body)) {
      AgentSurface.refuse(res, 400, 'JSON-RPC batches are not accepted', {}, attempt)
      return
    }
    const headerSession = headerValue(req, 'mcp-session-id')

    if (isInitialize(body)) {
      if (st.claimedAt !== null) {
        // The whole point of rule 3. A second initialize means a second client,
        // and the only way to have this bearer and not the session id is to have
        // read it from somewhere it was written down.
        ops.record({
          op: 'agentSurface.secondInitialize',
          // A second initialize means a second client, and the only way to have
          // this bearer without the session id is to have read it from
          // somewhere it was written down. This line is the evidence.
          outcome: 'ok',
          level: 'error',
          detail: { note: 'a second client presented this credential; refused' },
          ctx: { correlationId: ctx.correlationId, estateId: this.deps.estateId, sessionId: st.scope.sessionId }
        })
        AgentSurface.refuse(res, 401, 'credential already claimed by an initialised session', {}, attempt)
        return
      }
      // Spend it BEFORE awaiting anything: two initializes arriving together
      // must not both find it unclaimed, and burning it on a failed handshake is
      // the safe direction to be wrong in.
      st.claimedAt = now
      this.touched(st.scope, !st.rejoin)

      const mcp = this.serverFor(st.scope, st.rejoin)
      // M104 — the id is OURS, so both fields can be set before the response
      // goes out. Letting the transport mint it meant `st.transport` and
      // `st.mcpSessionId` were assigned only after `handleRequest` had already
      // flushed the id to the client: a client that read it and sent its first
      // tool call immediately arrived while `st.transport` was still null and
      // was answered 401 — a race that looks exactly like a stolen credential.
      const mcpSessionId = randomUUID()
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => mcpSessionId,
        enableJsonResponse: true
      })
      st.transport = transport
      st.mcpSessionId = mcpSessionId
      try {
        await mcp.connect(transport)
        await untilAnsweredOrGone(transport.handleRequest(req, res, body), res)
      } catch (e) {
        // The credential stays spent — burning it on a failed handshake is the
        // safe direction to be wrong in — but it no longer fails SILENTLY. The
        // transport is cleared so a later call is refused as uninitialised
        // rather than reaching a half-connected one.
        st.transport = null
        st.mcpSessionId = null
        ops.failed('agentSurface.handshake', e, {
          note: 'the credential is spent and unusable; the session must be restarted',
          session_id: st.scope.sessionId
        })
        throw e
      }
      return
    }

    if (st.claimedAt === null || !st.transport) {
      AgentSurface.refuse(res, 401, 'credential has not initialised an MCP session', {}, attempt)
      return
    }
    if (!headerSession || headerSession !== st.mcpSessionId) {
      // Two very different situations arrive here and an operator must be able
      // to tell them apart from the log alone. NO header at all is what a
      // client that ignores the session id would do — the whole surface would
      // appear broken, and this line is how that gets diagnosed in one look. A
      // WRONG header is a second party holding a copied bearer, which is the
      // thing the handshake exists to stop.
      ops.record({
        op: 'agentSurface.sessionMismatch',
        outcome: 'ok',
        // A WRONG header is a second party holding a copied bearer; NO header is
        // a client ignoring the session id, which makes the whole surface look
        // broken. Different severities because they are different incidents.
        level: headerSession ? 'error' : 'warn',
        detail: headerSession
          ? { note: 'a mcp-session-id that is not this credentials — a second party holds this token' }
          : {
              note: 'no mcp-session-id after initialising; the client is not returning it as the MCP spec requires',
              diagnosis: 'if every tool call is failing, that is the bug — not the credential'
            },
        ctx: { correlationId: ctx.correlationId, estateId: this.deps.estateId, sessionId: st.scope.sessionId }
      })
      AgentSurface.refuse(res, 401, 'mcp-session-id does not match this credential', {}, attempt)
      return
    }
    this.touched(st.scope, !st.rejoin, isWorkCall(body))
    await untilAnsweredOrGone(st.transport.handleRequest(req, res, body), res)
  }

  // #region surface-session-leave — docs: docs/adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md#amendments
  /**
   * An MCP client leaving (DELETE with its bearer and its mcp-session-id; 0.3.5 review iteration 2, ER-4). Without it an
   * enrolled session outlived its coding agent and held its claims until the cap ended it — or ended a live one
   * instead. The agent's own bearer of an ENROLLED session ends the session (its claims are released, as at any session
   * end); a rejoin's bearer, or a launched session's (its terminal owns that session), takes only itself.
   */
  private leave(token: string, st: ScopeState, req: IncomingMessage, res: ServerResponse, attempt: { refused(reason: string): void }): void {
    const headerSession = headerValue(req, 'mcp-session-id')
    if (st.claimedAt === null || !st.mcpSessionId || headerSession !== st.mcpSessionId) {
      AgentSurface.refuse(res, 401, 'mcp-session-id does not match this credential', {}, attempt)
      return
    }
    const sessionId = st.scope.sessionId
    // A board session (fabric.board.join) is a session its client owns, like an enrolled one: leaving ends it, so its
    // responder slots are released and it stops being listed as held (wave-2 fix 2).
    const endsSession = (st.scope.cameIn === 'enrolled' || st.scope.surface === 'board') && !st.rejoin
    // DA-1 (TR-13): a coding agent's own fabric-mcp leaving is its end. The hook's end is refused while this client
    // signs (workTools.ts#endRefusal), so the end is journalled here, before the session ends and its claims go.
    if (endsSession && st.scope.cameIn === 'enrolled' && st.scope.surface !== 'board') this.recordAgentLeft(st.scope)
    if (endsSession) (this.deps.work?.endSession ?? ((id: string) => this.revokeSession(id)))(sessionId)
    else this.drop(token)
    ops.record({ op: 'agentSurface.session-left', outcome: 'ok', level: 'info', detail: { ended_session: endsSession, rejoin: st.rejoin },
      ctx: { correlationId: ops.correlate(), estateId: this.deps.estateId, sessionId } })
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ left: true, sessionEnded: endsSession }))
  }
  // #endregion surface-session-leave

  // #region surface-session-left-record — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#tracking
  /** Marks a session's end as recorded; false when it already was (the hook's end or an earlier leave). */
  private claimEndRecord(sessionId: string): boolean {
    if (this.endRecorded.has(sessionId)) return false
    this.endRecorded.add(sessionId)
    while (this.endRecorded.size > END_RECORDS_REMEMBERED) this.endRecorded.delete(this.endRecorded.values().next().value as string)
    return true
  }

  /**
   * `session.ended@1` for an enrolled session whose agent's own fabric-mcp left (its HTTP session's DELETE: the agent
   * closed its stdin, it exited). Facts Fabric saw itself: the session, its runtime ids, when, `observed_by: fabric`,
   * reason `agent-left`; no git facts (the hook's end carries those). Once per session: a hook end already recorded
   * (or in flight) for it wins. Awaited by `stop()`, never thrown into the leave's answer.
   */
  private recordAgentLeft(scope: AgentScope): void {
    const journal = this.deps.journal
    if (!journal || !this.claimEndRecord(scope.sessionId)) return
    const live = this.live.get(scope.sessionId)
    const payload = {
      session_id: scope.sessionId, runtime: scope.agent ?? live?.agent ?? 'unknown', runtime_session_id: live?.runtimeSessionId ?? scope.runtimeSessionId ?? null,
      observed_at: new Date(this.now()).toISOString(), head: null, files_changed: null, lines_added: null, lines_removed: null,
      idempotency_key: `agent-left:${scope.sessionId}`, observed_by: 'fabric', reason: 'agent-left'
    }
    const p: Promise<void> = journal.append({ estateId: scope.estateId, actor: { kind: 'agent', id: scope.sessionId }, projectId: scope.projectId, type: 'session.ended@1', payload } as Parameters<Journal['append']>[0])
      .then(() => {}, (e) => {
        // The end goes unrecorded in History; the session still ends and its claims are released.
        ops.failed('agentSurface.session-left-record', e, { note: 'the session ends, its end is not in the journal', session_id: scope.sessionId })
      })
      .finally(() => { this.ending.delete(p) })
    this.ending.add(p)
  }
  // #endregion surface-session-left-record

  /** A call arrived on this session: its last sign of life (CO-256), and — at most every five minutes — its claims
   *  renewed. Any request counts: a tool call, a hook's turn through a rejoin, and fabric-mcp's own ping while the
   *  agent works (TR-4). `own`: from the session's own client, not a rejoin (TR-2). `work`: a tool call, the work signal
   *  the dispatcher reads (`lastWorkAt`, CO-565), which a keep-alive ping is not. */
  private touched(scope: AgentScope, own = true, work = false): void {
    const now = this.now()
    const s = this.live.get(scope.sessionId)
    if (s) {
      s.lastCallAt = now
      if (own) s.lastOwnCallAt = now
      if (work) s.lastWorkAt = now
    }
    const due = this.claimHolders.get(scope.sessionId)
    if (due === undefined || now < due) return
    this.claimHolders.set(scope.sessionId, now + RENEW_EVERY_MS)
    void this.renewClaims(scope).catch((e) => {
      ops.failed('agentSurface.claim-renew', e, { note: 'the claims run to their expiry unless renewed by a later call', session_id: scope.sessionId })
    })
  }

  /** On-demand spec §3.12: claims Fabric gave this session back at its enrollment are renewed by its calls, as its own. */
  noteClaims(sessionId: string): void {
    if (this.live.has(sessionId) && !this.claimHolders.has(sessionId)) this.claimHolders.set(sessionId, this.now() + RENEW_EVERY_MS)
  }

  // #region claim-renewal — docs: docs/ux/scenarios.md#scn-140-agents-ask-fabric-who-is-working-on-what-claim-their-task-are-warned-of-related-work-and-release-it
  /** Renews this session's claims that expire within the next quarter hour, by the default claim length. */
  private async renewClaims(scope: AgentScope): Promise<void> {
    const store = createScopedStore(this.deps.db, { kind: 'project', estateId: scope.estateId, projectId: scope.projectId })
    const r = await store.select('work_claims', 'id,work_id,expires_at').eq('owner_session', scope.sessionId).is('released_at', null)
    if (r.error) throw new Error(`the claims could not be read: ${r.error.message}`)
    const rows = (r.data ?? []) as Array<{ id: string; work_id: string; expires_at: string }>
    if (!rows.length) {
      this.claimHolders.delete(scope.sessionId)
      return
    }
    const now = this.now()
    for (const c of rows) {
      if (Date.parse(c.expires_at) - now > RENEW_WITHIN_MS) continue
      await this.appendRedacted({
        estateId: scope.estateId, type: 'work.renewed@1', actor: { kind: 'agent', id: scope.sessionId }, projectId: scope.projectId,
        payload: { work: c.work_id, owner: scope.sessionId, expires_at: new Date(now + CLAIM_DEFAULT_MINUTES * 60_000).toISOString(), claim_id: c.id }
      })
    }
  }
  // #endregion claim-renewal

  /**
   * M46 — record that memory was asked, and what it returned, INCLUDING nothing.
   *
   * A hit is self-evident to whoever got it. A miss is invisible to everyone:
   * the agent simply carries on without the thing it did not find, and the
   * absence leaves no trace anywhere. Without this row, "memory is working" and
   * "nobody ever asks it" and "it never matches" all look identical.
   *
   * Never throws into a search. A retrieval that answered and failed to be
   * logged is better than a retrieval that failed because logging did.
   */
  /**
   * The ONE door every agent-written event goes through (M195).
   *
   * `redact()` was applied to transcripts and to nothing an agent wrote through
   * a tool — so a secret in a `memory_facts` claim became a CURRENT fact, and
   * `contextPack` puts current facts into EVERY next session: the leak
   * multiplied through transcripts, and a question carrying one would have
   * reached the Board and Telegram.
   *
   * Fixed HERE and not at the thirteen fields, for M106's reason one layer
   * along: the call sites know what they are writing, and the boundary is what
   * owes the estate a guarantee. A tool written after this — `fabric_question_ask`
   * among them — is covered on the day it is written, without its author
   * knowing this exists.
   *
   * The redaction COUNT rides on the event, the transcript idiom: "this fact
   * was scrubbed of two secrets" stays answerable, and the secret itself never
   * lands anywhere, not even shortened.
   */
  private async appendRedacted(input: {
    estateId: string
    type: string
    actor: { kind: string; id: string }
    projectId?: string | null
    payload: Record<string, unknown>
  }): Promise<{ seq: number }> {
    return this.deps.journal.append({
      ...input,
      payload: prepareAgentPayload(input.type, input.payload)
    } as Parameters<Journal['append']>[0])
  }

  /**
   * WHAT HAPPENED to a correction, read from the row the projector wrote.
   *
   * `append_event` applies the projections inside the same transaction, so by
   * the time the append returns, the outcome is recorded. That is what makes
   * this an observation rather than a second transaction's guess.
   *
   * A read that fails does not become "it worked". The third answer here is the
   * one the caller can act on: the fact was written and we cannot say what
   * became of the correction.
   */
  private async readCorrection(
    store: ReturnType<typeof createScopedStore>,
    factId: string,
    requested: string | null
  ): Promise<Correction> {
    if (!requested) return { status: 'not_requested', reason: null, previousRef: null }
    // Through the SCOPED store (S02): the estate predicate comes from the scope
    // map rather than from this call site remembering to write one.
    const found = await store
      .select('memory_facts', 'correction_outcome,correction_reason,supersedes_requested')
      .eq('id', factId)
      .maybeSingle()
    if (found.error || !found.data)
      return {
        status: 'conflict_proposed',
        reason: `the fact was recorded and the correction could not be confirmed: ${found.error?.message ?? 'the row was not readable'}`,
        previousRef: requested
      }
    const row = found.data as {
      correction_outcome: string
      correction_reason: string | null
      supersedes_requested: string | null
    }
    return {
      status: row.correction_outcome as CorrectionOutcome,
      reason: row.correction_reason,
      previousRef: row.supersedes_requested ?? requested
    }
  }

  private async recordRetrieval(
    scope: AgentScope,
    store: 'facts' | 'transcripts',
    query: string,
    hits: number
  ): Promise<void> {
    try {
      await this.appendRedacted({
        estateId: scope.estateId,
        type: 'memory.retrieved@1',
        actor: { kind: 'agent', id: scope.sessionId },
        projectId: scope.projectId,
        payload: {
          id: randomUUID(),
          session_id: scope.sessionId,
          store,
          query: prepareRetrievalText(query),
          hits
        }
      })
    } catch (e) {
      ops.failed('agentSurface.could-not-record-a-retrieval', e, { note: 'could not record a retrieval:' })
    }
  }

  // #region task-source-link — docs: docs/evidence/plans/2026-10-11-release-040-agents-first.md#c4--work-log-protocol-every-coding-agent-knows-how-to-log-and-track
  private async resolveSourceFor(scope: AgentScope, source: { repository: string; path: string; id: string }): Promise<SourceResolution> {
    assertAgentReference(source.repository)
    assertAgentReference(source.path)
    if (!this.deps.work) return { ok: false, part: 'repository', reason: 'this Fabric resolves no backlog rows' }
    return this.deps.work.resolveSource(scope.projectId, source)
  }

  private async linkSource(scope: AgentScope, taskId: string, s: Extract<SourceResolution, { ok: true }>): Promise<void> {
    await this.appendRedacted({
      estateId: scope.estateId, type: 'task.source.linked@1', actor: { kind: 'agent', id: scope.sessionId }, projectId: scope.projectId,
      payload: { task_id: taskId, repository: s.repository, repo_path: s.repoPath, path: s.path, row_id: s.rowId }
    })
  }
  // #endregion task-source-link

  /** A server instance bound to one scope: the tools close over it, so no tool
   *  can reach a project the credential does not name. */
  private serverFor(scope: AgentScope, rejoin = false): McpServer {
    const { db, journal, ptys } = this.deps
    // S02.a — the credential already named one project, and most tools already
    // carried `.eq('project_id', …)` by hand. This makes it structural: every
    // read below is narrowed to the credential's estate AND project before the
    // tool sees it, so a task id an agent invents cannot resolve outside what it
    // was minted for, and a tool added tomorrow inherits the boundary instead of
    // having to remember it.
    const store = createScopedStore(db, {
      kind: 'project',
      estateId: scope.estateId,
      projectId: scope.projectId
    })
    const server = new McpServer({ name: 'fabric', version: APP_VERSION })

    // ADR-0149 §4 and ADR-0115's rule: a board session is given a server with the board's tools and nothing else, so no
    // session tool — fabric_whoami included — is reachable from it.
    if (scope.surface === 'board') {
      // Respond-only (ADR-0149 Amendment 2): the tools board.respond promises, nothing that writes as the Project.
      registerBoardTools(server, this.board, () => this.boardCaller(scope), PINNED_COMMS_OPERATIONS, BOARD_SESSION_OPERATIONS)
      return server
    }

    server.registerTool(
      'fabric_whoami',
      {
        title: 'Who am I',
        description:
          'What this session is: the project, its repositories, the task that opened it if any, what waits for the project from the board\'s last 7 days (board requests addressed to it and open questions, each with its id; a count of unread answers to its requests; a part not read within its deadline says so), the agents and services this machine has with what each does (machine_agents: call the one that owns a job rather than doing it yourself), and the rules that apply here. Call this first, and take up what waits before new work.',
        inputSchema: {}
      },
      async () => {
        // M123 — the call is journalled, not just served. The preamble that asks
        // for it is an instruction, and an instruction is a claim until
        // something observes the result: a session with no `session.oriented@1`
        // worked without the rules it was bound by, and nothing else would say
        // so. Failing to record it must NOT fail the call — an agent that
        // cannot learn its rules because of our bookkeeping is the worse
        // outcome of the two.
        // One protocol per call, stamped with the server's own clock and zone.
        const protocol = buildProtocol({
          now: new Date(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          // P-24: read per call, so a language changed in Settings reaches the next session that asks.
          language: this.readLanguage(),
          // ADR-0176 §3: read per call too, so a trust the person set reaches the next fabric_whoami.
          machineTrust: this.readMachineTrust()
        })

        const servedHash = protocolHash(protocol)
        const previousHash = this.oriented.get(scope.sessionId)
        if (previousHash !== servedHash) {
          this.oriented.set(scope.sessionId, servedHash)
          try {
            await this.appendRedacted({
              estateId: scope.estateId,
              type: 'session.oriented@1',
              actor: { kind: 'agent', id: scope.sessionId },
              projectId: scope.projectId,
              payload: {
                session_id: scope.sessionId,
                task_id: scope.taskId,
                // WHICH rules were served. "The session was oriented" without
                // this cannot answer what it was oriented TO, and a protocol
                // that changed between two sessions is invisible without it.
                protocol_version: protocol.version,
                protocol_hash: servedHash,
                // CO-399: present when this session was served other rules before, so a change is visible.
                ...(previousHash ? { previous_protocol_hash: previousHash } : {})
              }
            })
          } catch (e) {
            if (previousHash) this.oriented.set(scope.sessionId, previousHash)
            else this.oriented.delete(scope.sessionId)
            ops.failed('agentSurface.could-not-record-that-a-session-read-its', e, { note: 'could not record that a session read its rules:' })
          }
        }

        const [{ data: project }, { data: repos }, { data: task }] = await Promise.all([
          store.select('projects', '*').eq('id', scope.projectId).maybeSingle(),
          store.select('project_repos', 'path,is_primary').eq('project_id', scope.projectId),
          scope.taskId
            ? store.select('project_tasks', '*').eq('id', scope.taskId).maybeSingle()
            : Promise.resolve({ data: null })
        ])
        // M49 — the pack Fabric compiled for this session, handed through the
        // same door as everything else. The lockfile was journalled before the
        // session started, so what is returned here is exactly what was recorded
        // as known.
        const { data: pack } = await store
          .select('session_context_packs', 'chars,fact_ids,transcript_ids,omitted_facts,omitted_transcripts,compiled_at')
          .eq('session_id', scope.sessionId)
          .maybeSingle()
        // 0.3.14 wave 2: what waits for this project, so a new session starts from it (`sessionWaiting.ts`). Bounded; a
        // part that could not be read says so, never zero.
        const waiting = await readWaiting({
          projectId: scope.projectId,
          now: this.now(),
          listPage: (args) => this.board.list(this.boardCaller(scope), args) as Promise<Record<string, unknown>>,
          openQuestions: async () => {
            const q = await store.select('questions', 'id,text').eq('project_id', scope.projectId).eq('status', 'open').order('asked_at').limit(QUESTIONS_READ)
            if (q.error) throw new Error(`the open questions could not be read: ${q.error.message}`)
            return (q.data ?? []) as Array<{ id: string; text: string }>
          }
        })

        // The operator, 2026-11-07: every session learns which agents this machine has (`machine.agents-first`).
        let machineAgents: MachineAgents | null = null
        try {
          machineAgents = this.deps.machineAgents?.() ?? null
        } catch (e) {
          ops.failed('agentSurface.machine-agents', e, { note: 'the registry of this machine could not be read for fabric_whoami' })
        }
        return json({
          session_id: scope.sessionId,
          waiting,
          machine_agents: machineAgents ?? { unread: 'the registry of this machine could not be read; Fabric Dashboards lists the same agents' },
          project: project
            ? { id: project.id, name: project.name, purpose: project.purpose }
            : null,
          repositories: repos ?? [],
          task: task ? { id: task.id, instruction: task.instruction } : null,
          context_pack: pack
            ? {
                file: 'context.md, in the directory this session was given',
                facts: (pack.fact_ids ?? []).length,
                sessions: (pack.transcript_ids ?? []).length,
                omitted_facts: pack.omitted_facts,
                omitted_sessions: pack.omitted_transcripts,
                compiled_at: pack.compiled_at,
                caveat:
                  pack.omitted_facts > 0 || pack.omitted_transcripts > 0
                    ? 'The pack is bounded and did not fit everything. Search memory directly for anything you expect and do not see in it.'
                    : 'The pack holds everything this project currently remembers.'
              }
            : {
                file: null,
                caveat:
                  'No context pack was compiled for this session. You are starting without the project’s memory pre-loaded; search it before assuming anything.'
              },
          // BUILT FROM THE RUNTIME, not written beside it (M177). The ladder
          // that refuses a move is the same object that describes the moves, so
          // the two cannot disagree — and the session is told what today is,
          // because a model with a training cutoff otherwise answers every
          // currency question from memory and sounds certain doing it.
          protocol: {
            version: protocol.version,
            hash: servedHash,
            now: protocol.now,
            language: protocol.language,
            machine: protocol.machine,
            vocabulary: protocol.vocabulary
          },
          rules: protocol.rules
        })
      }
    )

    server.registerTool(
      'fabric_stage_report',
      {
        title: 'Report your stage',
        description:
          'Tell Fabric where you are in the work, so the operator can see it without reading your transcript. Recorded as your own claim, shown beside what Fabric observes about this session. Call it whenever the stage changes.',
        inputSchema: {
          stage: z.string().min(1).max(120).describe('What you are doing now, as one plain sentence the project\'s owner understands without context, in the working language fabric_whoami names (or the person\'s own, when it names none) — the work and its aim, not a file, command or internal id ("Making a version where the computer stays awake while an agent works, then releasing it")'),
          step: z.number().int().positive().optional().describe('Which step you are on'),
          ofSteps: z.number().int().positive().optional().describe('How many steps you expect'),
          note: z.string().max(400).optional().describe('One line of detail, optional')
        }
      },
      async ({ stage, step, ofSteps, note }) => {
        // The mockup parity (agent gaps «Вехи»): a session Fabric did not launch on a task names the ONE task it holds a
        // live claim on in this project (`spawnParent.ts#stageTaskOf`), so its milestones land on that task. A claims
        // read that fails leaves the report unnamed; it is still recorded.
        let taskId: string | null = scope.taskId
        if (!taskId) {
          // Wrapped so a store that throws while building the query (not only one that answers an error) leaves the report
          // unnamed and still recorded (the 0.3.15 gate: `contract-consumer.test.mjs`, a stage report with no database).
          const claims = await (async () => store.select('work_claims', 'work_id,project_id').eq('owner_session', scope.sessionId).is('released_at', null))()
            .catch((e: unknown) => ({ data: null, error: { message: e instanceof Error ? e.message : String(e) } }))
          taskId = stageTaskOf(null, scope.projectId, (claims.data ?? []) as LiveClaim[], claims.error ? claims.error.message : null)
        }
        const event = await this.appendRedacted({
          estateId: scope.estateId,
          type: 'agent.stage.reported@1',
          actor: { kind: 'agent', id: scope.sessionId },
          projectId: scope.projectId,
          payload: {
            session_id: scope.sessionId,
            task_id: taskId,
            stage,
            step: step ?? null,
            of_steps: ofSteps ?? null,
            note: note ?? null
          }
        })
        return json({ recorded: true, seq: event.seq, as: 'claim' })
      }
    )

    server.registerTool(
      'fabric_agents_list',
      {
        title: 'Who else is working here',
        description:
          'Every session in this project, yours marked is_you: the terminals Fabric runs and the agents enrolled from their own terminals, with how each came in (came_in). For each, what Fabric observes (state: a terminal\'s own state, or active or silent for an enrolled agent by its last call or sign; last activity; by what it was observed) and what the agent has claimed about itself (its reported stage). Observation and claim are labelled separately and should not be conflated.',
        inputSchema: {}
      },
      async () => {
        // Not `?? []`: an empty list says "nobody else is working here", and a
        // manager that cannot answer has said nothing at all. An agent told the
        // project is empty will act as if it is alone.
        const manager = ptys()
        if (!manager)
          return json({
            sessions: null,
            unreadable: 'Fabric cannot read its terminal manager right now, so it cannot tell the terminals Fabric runs apart from the agents enrolled from their own terminals, and lists neither. This is not a report that nobody else is working here: it is no report at all. Ask again in a moment.'
          })
        // #region agents-list-every-session — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#tracking
        // TR-6: every session of this project, whichever way it came in: the terminals Fabric runs AND the agents that
        // enrolled through fabric-mcp from their own terminals (the same set fabric_work_list reads). Built from the
        // terminals alone it was always empty on a machine where every agent runs outside Fabric. A stage report is
        // shown only beside a session still here, never for one that ended (TR-14).
        const now = this.now()
        const terminals = new Map(manager.list(scope.projectId).map((p) => [p.sessionId, p]))
        const { data: claims, error: stagesError } = await store
          .select('agent_stages', '*')
          .eq('project_id', scope.projectId)
        const byId = new Map((claims ?? []).map((c) => [c.session_id as string, c]))
        return json({
          ...(stagesError ? { claims_unreadable: `the stage reports could not be read: ${stagesError.message}` } : {}),
          sessions: this.projectSessions(scope.projectId).map((s) => {
            const claim = byId.get(s.sessionId)
            const pty = terminals.get(s.sessionId)
            return {
              session_id: s.sessionId,
              is_you: s.sessionId === scope.sessionId,
              came_in: s.cameIn,
              observed: pty
                ? { agent: s.agent ?? pty.optionId, state: pty.state, started_at: pty.startedAt, last_activity_at: pty.lastActivityAt, exit_code: pty.exitCode, by: 'its terminal in Fabric' }
                : {
                    agent: s.agent,
                    state: sessionStale(s.lastSignAt, s.startedAt, now) ? 'silent' : 'active',
                    started_at: new Date(s.startedAt).toISOString(),
                    last_activity_at: s.lastSignAt ? new Date(s.lastSignAt).toISOString() : null,
                    exit_code: null,
                    by: 'its calls and signs to Fabric'
                  },
              claimed: claim
                ? {
                    stage: claim.stage,
                    step: claim.step,
                    of_steps: claim.of_steps,
                    note: claim.note,
                    reported_at: claim.reported_at,
                    caveat: 'reported by that agent about itself'
                  }
                : null
            }
          })
        })
        // #endregion agents-list-every-session
      }
    )

    server.registerTool(
      'fabric_tasks_list',
      {
        title: 'What has been asked here',
        description:
          'The board of this project: what is waiting, running, in review and closed. A task can exist before anything runs, so this is not a list of sessions.',
        inputSchema: { limit: z.number().int().min(1).max(50).optional() }
      },
      async ({ limit }) => {
        const data = mustRead(
          await store
            .select('project_tasks', 
              'id,title,instruction,option_id,status,section,goal_id,position,origin_kind,origin_ref,assigned_by,assigned_to,exit_code,started_at,finished_at'
            )
            .eq('project_id', scope.projectId)
            .order('started_at', { ascending: false })
            .limit(limit ?? 10),
          'the board'
        )
        return json({ tasks: data ?? [] })
      }
    )

    server.registerTool(
      'fabric_memory_search',
      {
        title: 'Search project memory',
        description:
          'What this project already knows about itself. Search before investigating something from scratch.',
        inputSchema: {
          query: z.string().max(200).optional(),
          includeSuperseded: z
            .boolean()
            .optional()
            .describe('Also return facts that have been corrected since. Off by default.')
        }
      },
      async ({ query, includeSuperseded }) => {
        query = query?.trim() ? cleanOriginalText(query).trim() : ''
        let q = store
          .select('memory_facts', 'id,claim,source_ref,kind,actor_kind,actor_id,recorded_at,valid_to,withdrawn_seq')
          .eq('project_id', scope.projectId)
        // What is true NOW, unless asked otherwise. A corrected fact is kept and
        // readable; it simply stops answering as though nothing had changed.
        if (!includeSuperseded) q = q.is('valid_to', null)
        if (query?.trim())
          q = q.textSearch('search', query.trim(), { type: 'plain', config: 'english' })
        // A failure here must NOT reach `recordRetrieval` below: a miss that
        // never happened would be written into the very log M46 built to
        // measure whether memory answers.
        const data = mustRead(
          await q.order('recorded_at', { ascending: false }).limit(50),
          'project memory'
        )
        await this.recordRetrieval(scope, 'facts', query?.trim() || '(everything)', data.length)
        return json({
          facts: data.map((f) => ({
            ...f,
            // Who said it is part of what it is worth. A note the operator wrote
            // and an agent's report about its own work are different evidence,
            // and an agent reading this must be able to tell them apart (M44).
            // CO-356: a decision whose answer was taken back is `withdrawn`, not corrected (`superseded`).
            ...factClosure(f),
            recorded_by:
              f.actor_kind === 'person'
                ? 'the operator'
                : f.actor_kind === 'agent'
                  ? `another agent (session ${String(f.actor_id).slice(0, 8)})`
                  : (f.actor_kind ?? 'unknown')
          })),
          note:
            data.length === 0
              ? 'Nothing recorded here matches. That means nobody wrote it down, not that it is untrue.'
              : 'A fact recorded by an agent is that agent’s account. Prefer one with a source you can check. If you find one of these to be wrong, record the correction with `supersedes` set to its id rather than writing a contradicting fact beside it.'
        })
      }
    )

    server.registerTool(
      'fabric_transcripts_search',
      {
        title: 'Search what past sessions actually did',
        description:
          'Full-text search over the verbatim output of previous sessions in this project — what was run, what it printed, what failed. This is an OBSERVATION: Fabric recorded it, nobody summarised it. Prefer it over asking another agent what it did. Results are annotations and excerpts; ask for one by session id to read it whole.',
        inputSchema: {
          query: z
            .string()
            .min(2)
            .max(200)
            .optional()
            .describe('Words you expect to appear in the session. Omit when reading one by id.'),
          limit: z.number().int().min(1).max(20).optional(),
          sessionId: z
            .string()
            .uuid()
            .optional()
            .describe('Read one session in full instead of searching')
        }
      },
      async ({ query, limit, sessionId }) => {
        if (!sessionId && !query)
          return json({
            found: false,
            reason: 'give either a query to search for, or a sessionId to read one session whole'
          })
        if (sessionId) {
          // `maybeSingle` returns null for BOTH "no such row" and a failed
          // read, so the error is checked before the absence is reported —
          // otherwise a database that is down says "that session has no
          // transcript", which is a claim about the record rather than about us.
          const one = await store
            .select('session_transcripts', 'session_id,option_id,annotation,body,started_at,ended_at,exit_code,truncated,captured_at,ending_provenance')
            .eq('project_id', scope.projectId)
            .eq('session_id', sessionId)
            .maybeSingle()
          if (one.error) throw new Error(`the transcripts could not be read: ${one.error.message}`)
          const data = one.data
          if (!data) return json({ found: false, reason: 'no transcript for that session in this project' })
          return json({ found: true, tier: 'full', ...data })
        }
        query = cleanOriginalText(query).trim()
        const data = mustRead(
          await store
            .select('session_transcripts', 'session_id,option_id,annotation,excerpt,started_at,ended_at,exit_code,truncated,captured_at,ending_provenance')
            .eq('project_id', scope.projectId)
            .textSearch('search', query as string, { type: 'plain', config: 'english' })
            .order('seq', { ascending: false })
            .limit(limit ?? 5),
          'the transcripts'
        )
        await this.recordRetrieval(scope, 'transcripts', query as string, data.length)
        return json({
          tier: 'excerpt',
          sessions: data,
          // Say it, rather than let an empty result read as "it never happened".
          note:
            data.length === 0
              ? 'No session in this project matched. That means the words were not found, not that the work was not done.'
              : 'Excerpts are head and tail of the real output. Pass sessionId to read one whole.'
        })
      }
    )

    server.registerTool(
      'fabric_memory_remember',
      {
        title: 'Remember something about this project',
        description:
          'Record a fact worth keeping — how something works, why a decision was made, a trap you hit. Cite where you learned it (a file and line, a command and its output). A claim with no source is worth less than no claim.',
        inputSchema: {
          claim: z.string().min(3).max(600).describe('The fact, in one or two sentences'),
          sourceRef: z.string().max(300).optional().describe('Where you learned it'),
          kind: z.enum(['note', 'finding', 'decision', 'trap']).optional(),
          // M182 — WHOSE lesson it is, beside what SORT of statement it is. A
          // trap in your runner and a trap in this repository are both
          // `kind: 'trap'`; without this they are one row and neither can be
          // kept out of the other's context.
          category: z
            .enum(INSIGHT_CATEGORIES)
            .optional()
            .describe(
              'Whose lesson this is: project (this repository, the default), agents (the runner you are), harness (the machine and its tools), fabric (Fabric itself), process (how work is done). Naming a category never widens who may read it.'
            ),
          about: z
            .object({ namespace: z.enum(ABOUT_NAMESPACES), key: z.string().max(256) })
            .optional()
            .describe(
              'The SUBJECT, as a stable key rather than a path — a file basename is not a stable subject and a local path leaks the disk layout.'
            ),
          occurrence: z
            .object({
              system: z.string().max(120).describe('The system that captured the episode'),
              sourceId: z.string().max(200),
              episodeKey: z.string().max(200)
            })
            .optional()
            .describe(
              'The INCIDENT this fact is about, if it is about one. Three facts citing one episode are one occurrence, not three. Your own grouping is recorded as PROVISIONAL until a host observation or a review establishes that the episodes are distinct.'
            ),
          supersedes: z
            .string()
            .uuid()
            .optional()
            .describe(
              'The id of a fact this one corrects. That fact is NOT deleted — its validity window closes and it stops answering searches, so the correction stays reversible and the project can still say what it used to believe. The correction may be REFUSED — you may not bury what a person recorded — and the answer says which happened rather than repeating what you asked for.'
            )
        }
      },
      async ({ claim, sourceRef, kind, category, about, occurrence, supersedes: asked }) => {
        // The schema accepts any UUID spelling; the journal stores canonical lower case (migration 80), so an
        // upper-case id is canonicalised here instead of reaching the database as a raw refusal (I3 A-1).
        const supersedes = asked?.toLowerCase()
        const id = randomUUID()
        assertAgentReference(about?.key)
        const normalised = normaliseAbout(about)
        const event = await this.appendRedacted({
          estateId: scope.estateId,
          type: 'memory.project.recorded@1',
          actor: { kind: 'agent', id: scope.sessionId },
          projectId: scope.projectId,
          payload: {
            id,
            claim,
            source_ref: sourceRef ?? null,
            kind: kind ?? 'note',
            category: category ?? DEFAULT_CATEGORY,
            about: normalised,
            occurrence: occurrence
              ? {
                  system: occurrence.system,
                  source_id: occurrence.sourceId,
                  episode_key: occurrence.episodeKey
                }
              : null,
            supersedes: supersedes ?? null
          }
        })
        // OBSERVED, not restated. This used to return `superseded: supersedes`
        // — the id it had been ASKED to close — while the projector's WHERE
        // clause had silently refused the burial, so the agent believed a fact
        // it can still read had been retired. `append_event` applies the
        // projections in the same transaction, so this read is a reading of
        // what actually happened rather than a second transaction's guess.
        const correction = await this.readCorrection(store, id, supersedes ?? null)
        return json({
          recorded: true,
          id,
          seq: event.seq,
          category: category ?? DEFAULT_CATEGORY,
          about: normalised,
          correction,
          says: describeCorrection(correction)
        })
      }
    )

    // ── The board, from the agent's side (M146 step 3) ───────────────────────
    //
    // Every one of these is closed over `scope.projectId`: a task id from
    // another project reads as "no such task", not as "forbidden", because the
    // door does not admit that the other project exists.
    //
    // The rule they enforce together is in `shared/ladder.ts`: AN AGENT DOES
    // NOT CLOSE ITS OWN TASK. It moves work to review and says what it
    // concluded; accepting or cancelling is the operator's move.

    /** The task, or null when it is not this project's — the same answer. */
    const ownTask = async (
      taskId: string
    ): Promise<{ id: string; status: TaskState; title: string | null; instruction: string } | null> => {
      // The sharpest instance of IMP-04, and it was mine. A failed read made
      // this return null, and every tool built on it then answered "no such
      // task in this project" — a confident statement about the ESTATE
      // produced by a transient failure. Refusing is the honest answer.
      const found = await store
        .select('project_tasks', 'id,status,title,instruction')
        .eq('id', taskId)
        .eq('project_id', scope.projectId)
        .maybeSingle()
      if (found.error) throw new Error(`the board could not be read: ${found.error.message}`)
      return (found.data as { id: string; status: TaskState; title: string; instruction: string } | null) ?? null
    }

    // The task tools (`taskTools.ts`): fabric_task_create, fabric_task_handoff, fabric_task_claim, fabric_task_release,
    // fabric_task_move, fabric_task_close, fabric_task_note, fabric_task_link, fabric_task_brief and fabric_task_accept.
    registerTaskTools(server, {
      store, db, journal, ptys, ownTask, deps: this.deps,
      append: (input) => this.appendRedacted(input),
      resolveSourceFor: (...a) => this.resolveSourceFor(...a),
      linkSource: (...a) => this.linkSource(...a)
    }, scope)

    // CO-506: Agent access's three buttons as this session's door (`relayedAccessTools.ts`): fabric_access_list,
    // fabric_access_decide and fabric_access_revoke.
    registerAccessTools(server, () => this.deps.access, scope)

    // The owner's questions (`questionTools.ts`): fabric_question_ask and fabric_question_check.
    registerQuestionTools(server, { store, append: (input) => this.appendRedacted(input), ownTask }, scope)

    // W2-3 and CO-489: the project's own tools (`projectTools.ts`): fabric_project_profile, fabric_project_folder_attach
    // and fabric_project_folder_detach.
    registerProjectTools(server, {
      db: this.deps.db,
      append: (input) => this.appendRedacted(input),
      folders: () => this.deps.folders
    }, scope)

    server.registerTool(
      'fabric_heartbeat',
      {
        title: 'Say what you are doing',
        description:
          'Say what you are doing, every minute or so, and whenever you start waiting on something. Silence is ambiguous — a long tool call, a question nobody has answered and a crashed process look identical from outside — so this is how the difference gets recorded. Nobody grades you on it: the phase is your claim, not a measurement, and reporting "blocked" is worth more than reporting nothing. If you are waiting on a question or a permission, name it: that is the field that turns a silence into a fact. When the three-minute sweep of abandoned work has something for you, the answer carries nudges: act on them first.',
        inputSchema: {
          beatSeq: z
            .number()
            .int()
            .min(1)
            .describe('1, then 2, then 3 — count your own beats. A repeat is ignored, not an error'),
          phase: z
            .enum(PHASES)
            .describe('What you are doing right now'),
          note: z.string().max(280).optional().describe('One line, if it helps a person reading the list'),
          waitingOn: z
            .object({
              kind: z.enum(['question', 'grant', 'continuation']),
              id: z.string().uuid()
            })
            .optional()
            .describe('Only with phase waiting or blocked: the thing you are stuck on')
        }
      },
      async ({ beatSeq, phase, note, waitingOn }) => {
        if (waitingOn && !WAITING_PHASES.includes(phase))
          return json({
            accepted: false,
            // Refused rather than dropped: an agent whose blocker is silently
            // discarded believes it reported one, and the surface would explain
            // a silence with something nobody claimed.
            reason: `only a waiting or blocked agent names what it is waiting on. You said "${phase}".`
          })

        // The SESSION comes from the credential, never from the arguments. An
        // agent that could name a session could beat on behalf of another one.
        const event = await this.appendRedacted({
          estateId: scope.estateId,
          type: 'agent.heartbeat@1',
          actor: { kind: 'agent', id: scope.sessionId },
          projectId: scope.projectId,
          payload: {
            session_id: scope.sessionId,
            beat_seq: beatSeq,
            phase,
            ...(note ? { note } : {}),
            ...(waitingOn ? { waiting_kind: waitingOn.kind, waiting_id: waitingOn.id } : {})
          }
        })
        // SW-4: the sweep's nudges for this session ride on the beat it sends every minute or so; none, no field.
        const nudges = this.deps.nudges?.(scope.sessionId, scope.projectId) ?? []
        return json({
          ...(nudges.length ? { nudges } : {}),
          accepted: true,
          receipt_seq: event.seq,
          // Said back, because the agent has no clock the estate trusts: the
          // receive time is the database's and this is how the agent learns
          // what was actually recorded.
          note: 'recorded, timed by the server. Beat again in about a minute, or whenever what you are doing changes.'
        })
      }
    )

    // The two effect tools (`effectTools.ts`): fabric_effect_request asks before an act above the floor (ADR-0050),
    // fabric_effect_report says what happened after.
    registerEffectTools(server, { policy: () => this.deps.policy, store, ptys }, scope)

    server.registerTool(
      'fabric_leases_list',
      {
        title: 'Who is holding what',
        description:
          'The tasks currently claimed in this project, and by whom. Check it before you start — the point of a claim is that a neighbour can see it.',
        inputSchema: {}
      },
      async () => {
        // A lease list that answers "nobody holds anything" because it could
        // not read is how two agents start the same work.
        const data = mustRead(
          await store
            .select('leases', 'work_id,owner_session,expires_at,write_scopes')
            .eq('project_id', scope.projectId),
          'the leases'
        )
        const now = Date.now()
        // REQ-08: agent-sync's leases on the repository, read-only, bounded, kept briefly, failing soft with a reason.
        const refs = this.deps.work ? await this.deps.work.leaseRefs(scope.projectId) : null
        return json({
          held: data.map((l) => ({
            task_id: l.work_id,
            owner_session: l.owner_session,
            is_you: l.owner_session === scope.sessionId,
            until: l.expires_at,
            expired: new Date(l.expires_at as string).getTime() <= now,
            write_scopes: l.write_scopes ?? []
          })),
          agent_sync_leases: refs ? currentLeases(refs) : { read: false, reason: this.deps.work ? 'this project has no repository' : 'this Fabric does not read agent-sync leases' },
          note: 'agent-sync leases are shown, never taken here: a lease names a guarded file or a task key on the repository\'s remote, and its holder and expiry are read with agent_sync.py status'
        })
      }
    )

    // The project board (COM-02.2, ADR-0117 §3): a session Fabric started takes part as its own Project, a
    // trusted principal. Identity is closed over the scope, so no argument can name another Project.
    // Claims (REQ-38) and the session's own observations (the hook pack's D4/D5): `workTools.ts`.
    registerWorkTools(server, {
      scope: { ...scope, agent: scope.agent ?? ptys()?.get(scope.sessionId)?.optionId ?? null, rejoin },
      store,
      append: (e) => this.appendRedacted({ estateId: scope.estateId, actor: { kind: 'agent', id: scope.sessionId }, projectId: scope.projectId, ...e }),
      // session.ended@1's owner is named in desktopIngress.ts; workTools builds its payload from typed fields only.
      appendObserved: (e) => journal.append({ estateId: scope.estateId, actor: { kind: 'agent', id: scope.sessionId }, projectId: scope.projectId, ...e } as Parameters<Journal['append']>[0]),
      // DA-1: the hook's end and the agent's leave record one end between them (recordAgentLeft).
      claimEndRecord: () => this.claimEndRecord(scope.sessionId),
      releaseEndRecord: () => { this.endRecorded.delete(scope.sessionId) },
      checkReference: assertAgentReference,
      sessions: () => this.projectSessions(scope.projectId),
      session: (id) => this.sessionSign(id),
      nudges: () => this.deps.nudges?.(scope.sessionId, scope.projectId) ?? [],
      turnNudges: (turnKey) => this.deps.turnNudges?.(scope.sessionId, scope.projectId, turnKey) ?? [],
      reportBranch: (branch) => this.deps.reportBranch?.(scope.sessionId, branch),
      onDoneInReview: (taskId) => this.deps.onDoneInReview?.(taskId),
      // fabric_board_search reads the board through this session's own reader door, as com.list and com.directory do.
      boardList: (args) => this.board.list(this.boardCaller(scope), args) as Promise<Record<string, unknown>>,
      boardDirectory: (args) => this.board.directory(this.boardCaller(scope), args) as Promise<Record<string, unknown>>,
      resolveSource: (source) =>
        this.deps.work
          ? this.deps.work.resolveSource(scope.projectId, source)
          : Promise.resolve({ ok: false, part: 'repository', reason: 'this Fabric resolves no backlog rows' }),
      leaseRefs: () => (this.deps.work ? this.deps.work.leaseRefs(scope.projectId) : Promise.resolve(null)),
      onClaimed: () => {
        if (!this.claimHolders.has(scope.sessionId)) this.claimHolders.set(scope.sessionId, this.now() + RENEW_EVERY_MS)
      },
      // After the answer has gone: ending the session closes the transport this answer travels on.
      endSession: () => {
        setTimeout(() => (this.deps.work?.endSession ?? ((id: string) => this.revokeSession(id)))(scope.sessionId), 1_000).unref?.()
      },
      now: this.now,
      // #region work-tools-session-facts — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#tracking
      sessionStartedAt: () => this.live.get(scope.sessionId)?.mintedAt ?? null,
      currentRuntimeSessionId: () => this.live.get(scope.sessionId)?.runtimeSessionId ?? null,
      ownClientLive: () => {
        const at = this.live.get(scope.sessionId)?.lastOwnCallAt
        return typeof at === 'number' && this.now() - at < OWN_CLIENT_LIVE_MS
      },
      // ER-2 (i2): a known agent process that is gone is an agent that ended, whatever its fabric-mcp signed last.
      agentAlive: () => {
        const pid = this.live.get(scope.sessionId)?.agentPid
        return typeof pid === 'number' ? this.pidAlive(pid) : null
      }
      // #endregion work-tools-session-facts
    })

    // The runner underneath, never a created agent's id (M125): board_grant_for compares the runner's binding (ADR-0149 §3).
    // CO-506 (ADR-0190): a session's com.enroll first grants its own project's answering, on its bearer's project; a
    // refused grant leaves com.enroll to answer not_authorized as before. A board session (ADR-0149) has no such wrapper.
    const runnerOfScope = (): string | null => ptys()?.runnerOf?.(scope.sessionId) ?? ptys()?.get(scope.sessionId)?.optionId ?? null
    const ownBoard: Board = Object.assign(Object.create(this.board) as Board, {
      enroll: async (caller: BoardCaller, args: unknown) => {
        const grant = this.deps.access?.grantOwnRespond
        const capability = (args as { capability?: unknown } | null)?.capability
        if (grant && scope.projectId && typeof capability === 'string') {
          try {
            const r = await grant({ projectId: scope.projectId, capability, bindingId: scope.bindingId, runnerKey: runnerOfScope() })
            if (!r.ok) ops.record({ op: 'board.own-respond', outcome: 'ok', level: 'info', detail: { session_id: scope.sessionId, reason: r.refused }, ctx: { correlationId: ops.correlate() } })
          } catch (e) {
            ops.failed('board.own-respond', e, { session_id: scope.sessionId }) // com.enroll still answers, not_authorized without a grant
          }
        }
        return this.board.enroll(caller, args)
      }
    })
    registerBoardTools(server, ownBoard, () => this.boardCaller(scope, runnerOfScope()))

    return server
  }

  // #region board-caller — docs: docs/adr/0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md#1-participation-comes-with-a-project-session
  /**
   * Who a session is on the board (ADR-0149 §1, §3), from its scope alone: its Project, a trusted principal labelled by
   * its runner, and — for responding — the session, how it came in, its runner and its binding. No argument names any.
   */
  private boardCaller(scope: AgentScope, ptyRunner: string | null = null): BoardCaller {
    const agent = scope.agent ?? ptyRunner
    const cameIn = scope.cameIn === 'unknown' ? null : scope.cameIn
    return {
      estateId: scope.estateId,
      projectId: scope.projectId,
      principal: { kind: 'agent', id: scope.sessionId, ...(agent ? { label: agent.slice(0, 80) } : {}), provenance: 'trusted' },
      // C3: a cursor is bound to what the session takes part under — how it came in, and its binding.
      participationGrant: scope.bindingId ? `${scope.cameIn}:${scope.bindingId}` : scope.cameIn,
      surface: scope.surface === 'board' ? 'board' : 'session',
      ...(cameIn ? { responder: { sessionId: scope.sessionId, cameIn, agent, bindingId: scope.bindingId } } : {})
    }
  }
  // #endregion board-caller
}

/**
 * A read that FAILED is not a read that found nothing (IMP-04).
 *
 * Every read on this surface used to drop `error` on the floor and fall back to
 * an empty array, so a database that could not be reached answered an agent
 * with silence — and silence here is a claim. The memory search was the worst
 * of them: it recorded a MISS in the retrieval log that M46 built to measure
 * whether memory answers, and then told the agent, in the product's own careful
 * wording, "nobody wrote it down, not that it is untrue". A sentence written to
 * prevent one misreading produced a worse one.
 *
 * Throwing is deliberate. The MCP layer turns it into an error result the agent
 * reads, which is the honest answer: I could not look, rather than I looked and
 * there was nothing.
 */
function mustRead<T>(
  result: { data: T[] | null; error: { message: string } | null },
  what: string
): T[] {
  if (result.error) throw new Error(`${what} could not be read: ${result.error.message}`)
  return result.data ?? []
}

function json(value: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] }
}

function headerValue(req: IncomingMessage, name: string): string | null {
  const raw = req.headers[name]
  return Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null)
}

/** True for a single initialize or a batch containing one. */
function isInitialize(body: unknown): boolean {
  const one = (m: unknown): boolean =>
    typeof m === 'object' && m !== null && (m as { method?: unknown }).method === 'initialize'
  return Array.isArray(body) ? body.some(one) : one(body)
}

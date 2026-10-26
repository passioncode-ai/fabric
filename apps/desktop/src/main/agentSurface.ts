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
import { checkAuthorityTarget } from '../shared/authorityIngress.ts'
import { factClosure } from '../shared/decisions.ts'
import { CommandIngressError } from './commandIngressAdapters.ts'
import { linkOutcome, linkRefusal, type LinkVerdict } from '../shared/taskLinks.ts'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ORIGIN_KINDS } from '../shared/origin.ts'
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
import { mayChain } from '../shared/loopBound.ts'
import { PHASES, WAITING_PHASES } from '../shared/liveness.ts'
import { fileProposal } from './commands/proposalCommands.ts'
import { BOARD_SESSION_OPERATIONS, createBoard, PINNED_COMMS_OPERATIONS, type Board, type BoardCaller } from './boardService.ts'
import { registerBoardTools } from './boardTools.ts'
import { TERMINAL, mayMove, type TaskState } from '../shared/ladder.ts'
import type { Journal } from '@fabric/journal'
import type { PtyManager } from './pty'
import type { Policy } from './policy'
import { createScopedStore } from './scopedStore.ts'
import { buildProtocol, protocolHash } from '../shared/protocol.ts'
import { ops } from './opsSink.ts'
import { writeAgentProfile } from './projectOnboarding.ts'
import { readProjectFacts, readThreadParticipants } from './boardWallReads.ts'
import { untilAnsweredOrGone } from './hangUp.ts'
import { QUESTION_KINDS, normaliseAsk } from '../shared/questionAsk.ts'
import { sameToken, type AccessService, type HubPrincipal } from './accessService.ts'
import type { McpServer as HubServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerWorkTools, type LiveSession } from './workTools.ts'
import { currentLeases } from './agentSyncLeases.ts'
import type { SourceResolution } from './backlogSource.ts'
import type { LeaseRefsRead } from './agentSyncLeases.ts'
import { CLAIM_DEFAULT_MINUTES, refusalAfterWrite, runHoldRefusal, sessionStale, type CameIn } from '../shared/workClaims.ts'
import type { Nudge } from '../shared/abandonedSweep.ts'
import { readRunHolds } from './workRead.ts'
import { APP_VERSION } from '../shared/appVersion.ts'

/** Check the complete original before lookup, normalization or legacy text
 * scrubbing. Reference identity is preserved; recognizable secrets refuse the
 * command rather than producing a different target/name. */
function assertAgentReference(value: string | undefined): void {
  if (value !== undefined && !checkAuthorityTarget(value).ok)
    throw new CommandIngressError('secret_in_reference')
}

/** What one credential may see and do. Minted per session, dies with it. */
/**
 * What a repeated hand-off of one name IS (PF-09.02).
 *
 * "Handing the same name twice replaces it" was written for the producer
 * correcting itself BEFORE anyone read the value. Once a follower has left
 * backlog, the old value is CONSUMED — somebody's work stands on it — and a
 * late edit must not mutate it in place: the correction lands as a NEW
 * REVISION and every follower that consumed the old one is named stale.
 */
export function handoffDisposition(
  hadPrior: boolean,
  followers: ReadonlyArray<{ id: string; status: string }>
): { kind: 'first' } | { kind: 'replace' } | { kind: 'revision'; staleDownstream: string[] } {
  if (!hadPrior) return { kind: 'first' }
  const consumed = followers.filter((f) => f.status !== 'backlog').map((f) => f.id)
  if (consumed.length === 0) return { kind: 'replace' }
  return { kind: 'revision', staleDownstream: consumed }
}

/**
 * Which live neighbours' write scopes overlap the requested ones (PF-09.02).
 *
 * A task lease is exclusivity over the TASK; it never protects a FILE — two
 * tasks legitimately claimed can still write one path, and pretending the
 * lease covers it is the false task-only claim. Overlap is prefix-or-equal
 * in either direction, so `src/auth/` collides with `src/auth/login.ts`.
 */
export function writeScopeConflicts(
  requested: readonly string[],
  neighbours: ReadonlyArray<{ work_id: string; owner_session: string; write_scopes: readonly string[] }>
): Array<{ scope: string; with_task: string; held_by: string; their_scope: string }> {
  const overlaps = (a: string, b: string): boolean =>
    a === b || a.startsWith(b) || b.startsWith(a)
  const out: Array<{ scope: string; with_task: string; held_by: string; their_scope: string }> = []
  for (const mine of requested)
    for (const n of neighbours)
      for (const theirs of n.write_scopes)
        if (overlaps(mine, theirs))
          out.push({ scope: mine, with_task: n.work_id, held_by: n.owner_session, their_scope: theirs })
  return out
}

/**
 * Whether THIS session may publish a result onto THIS task (PF-09.01).
 *
 * fabric_task_handoff used to accept any taskId in the project — no live
 * lease, no attempt check — so a foreign or stale session could publish over
 * the current owner. The rule: a result publishes from the task the session
 * IS (its own task), or from a task whose LIVE lease this session holds. A
 * live lease held by another session refuses with the holder named; the
 * caller's own EXPIRED lease refuses as stale (re-claim, then publish) —
 * an expired attempt writing results is the split-brain this closes.
 */
export function mayPublishHandoff(
  scope: { sessionId: string; taskId: string | null },
  taskId: string,
  lease: { owner_session: string; expires_at: string } | null,
  now: number
): { ok: true } | { ok: false; reason: string; heldBy?: string } {
  if (scope.taskId === taskId) {
    // The session's own task — but not while somebody ELSE holds a live lease
    // on it (a takeover after this session's claim lapsed).
    if (lease && lease.owner_session !== scope.sessionId &&
        new Date(lease.expires_at).getTime() > now)
      return {
        ok: false,
        reason: 'another session holds a live claim on this task — a result publishes only from the live owner',
        heldBy: lease.owner_session
      }
    return { ok: true }
  }
  if (!lease)
    return {
      ok: false,
      reason: 'not your task and no claim held — claim it first: a result publishes only from an authenticated owner'
    }
  if (lease.owner_session !== scope.sessionId) {
    if (new Date(lease.expires_at).getTime() > now)
      return {
        ok: false,
        reason: 'another session holds this task',
        heldBy: lease.owner_session
      }
    return {
      ok: false,
      reason: 'the last claim on this task expired and it was not yours — claim it before publishing'
    }
  }
  if (new Date(lease.expires_at).getTime() <= now)
    return {
      ok: false,
      reason: `your claim expired at ${lease.expires_at} — a stale attempt does not publish; re-claim and re-publish`
    }
  return { ok: true }
}

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

/** A backlog row by its address (REQ-08; plan R-07: link, don't copy). */
const SOURCE_SCHEMA = z
  .object({ repository: z.string().min(1).max(300), path: z.string().min(1).max(300), id: z.string().min(1).max(64) })
  .describe('The backlog row this task serves: the repository (its remote — https://github.com/owner/name or owner/name — or its folder), the file\'s path in it, and the row\'s id. Linked, never copied: the row keeps its status in its file.')

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

export interface AgentSurfaceDeps {
  /** A session's nudges from the sweep of abandoned work, taken by the answer that carries them (0.3.13 wave 2, SW-4;
   *  `abandonedSweepRun.ts#createAbandonedSweep`). Absent: no answer carries nudges. */
  nudges?: (sessionId: string, projectId: string) => string[]
  /** The same queue, each nudge whole, for a turn's answer (`fabric_session_observe`, 0.3.14 wave 2). */
  nudgeItems?: (sessionId: string, projectId: string) => Nudge[]
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
}

/** What the surface needs to admit a registered agent from outside (ADR-0115 §1). */
export interface HubIngress {
  /** The current door token; null while none is published. */
  doorToken: () => string | null
  access: Pick<AccessService, 'authenticate' | 'primeCredentialVerifiers' | 'knownCredential'>
  /** A server holding exactly the tools this principal may use. */
  tools: (principal: HubPrincipal) => HubServer
  /** `POST /fabric/v1/connect/<product>`: a product delivering its key (ADR-0115 §4). */
  callback?: (product: string, req: IncomingMessage, res: ServerResponse) => Promise<void>
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

/**
 * Which door bucket a JSON-RPC body spends (ER-7): a status poll its request, an ask its agent, anything
 * else (initialize, tools/list) one shared bucket. The values are only a budget key, never trusted.
 */
function doorBucket(body: unknown): string {
  const first = Array.isArray(body) ? body[0] : body
  const params = (first as { method?: unknown; params?: { name?: unknown; arguments?: Record<string, unknown> } } | null)?.params
  const args = (first as { method?: unknown })?.method === 'tools/call' && params && typeof params.arguments === 'object' && params.arguments ? params.arguments : null
  const id = (v: unknown): string | null => (typeof v === 'string' && v.length <= 128 ? v : null)
  if (args && params?.name === 'fabric.access.status' && id(args.requestId)) return `request:${id(args.requestId)}`
  if (args && params?.name === 'fabric.access.request' && id(args.agentId)) return `agent:${id(args.agentId)}`
  return 'other'
}

/** A binding's ingress is a flood guard this many times its call budget: one binding serves its coding agent in
 *  every project on the machine, and each session's hook costs an initialize and an initialized beside its call. */
const BINDING_INGRESS_FACTOR = 10

/**
 * Which call bucket a binding's JSON-RPC body spends (2026-10-19, board thread 1afd08e7): a `tools/call` naming its
 * coding-agent session spends that session's share, any other call the binding's shared one, and protocol traffic
 * (initialize, tools/list, notifications) only the ingress guard. The values are a budget key, never trusted.
 */
export function bindingCallBucket(bindingId: string, body: unknown): string | null {
  const first = body as { method?: unknown; params?: { arguments?: Record<string, unknown> } } | null
  if (first?.method !== 'tools/call') return null
  const rt = first.params?.arguments?.runtimeSessionId
  return typeof rt === 'string' && rt.length > 0 && rt.length <= 128 ? `binding:${bindingId}:session:${rt}` : `binding:${bindingId}:calls`
}

/** CO-346: the distinct `runtimeSessionId` windows one binding may hold in a budget window; past them its calls share one. */
export const SESSION_WINDOWS_PER_BINDING = 16

export class AgentSurface {
  private states = new Map<string, ScopeState>()
  /** Per binding, the session ids given their own budget window in the current window (CO-346). */
  private bindingSessions = new Map<string, { windowStart: number; ids: Set<string> }>()
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
  /**
   * Calls per external principal per window. The door token is shared by every agent on this Mac, so its
   * calls are budgeted per request (a status poll) or per agent (an ask), never in one bucket that one
   * agent polling in a loop spends for all of them (ER-7, verification iteration 1 for 0.3.1); a door-wide
   * ceiling of five budgets still bounds the whole door. Bearers that turned out to be nobody's share one
   * small budget checked BEFORE the credential lookup, so they cannot each cost a database read.
   */
  private externalBudget = new Map<string, { windowStart: number; calls: number }>()
  /** sha256 of bearers that authenticated recently: still looked up (revocation is checked every time), but never budgeted as unknown. */
  private knownBearers = new Set<string>()
  private http: Server | null = null
  /** The hub port held on [::1] as well (ER-8); null for an ephemeral session port. */
  private http6: Server | null = null
  private port = 0

  private deps: AgentSurfaceDeps
  private now: () => number
  private pidAlive: (pid: number) => boolean
  private limits: AgentSurfaceLimits
  /** Bounded in-flight requests; hashes identify buckets without retaining raw credentials. */
  private externalPending = new Map<string, number>()
  private externalPendingTotal = 0
  /** The project board's participant half (COM-02.2, ADR-0117); its cursor key lives for this run only. */
  private board: Board
  // #region surface-session-registry — docs: docs/ux/scenarios.md#scn-141-see-where-work-is-across-every-project--sessions-claims-review-and-sessions-with-no-project
  /**
   * Every session this surface holds a credential for, launched or enrolled, with its last call (CO-256): the
   * liveness signal other sessions' `fabric_work_list` and the operator's screens read. In memory: it is what this
   * process can vouch for, and a restart is exactly the moment those sessions' bearers stop working.
   */
  private live = new Map<string, { projectId: string; cameIn: CameIn; agent: string | null; runtimeSessionId: string | null; mintedAt: number; lastCallAt: number | null; surface?: 'session' | 'board'; bindingId?: string | null; /** The last call of the session's own client, not a rejoin's (TR-2). */ lastOwnCallAt?: number | null; /** The agent's process (ER-2, i2). */ agentPid?: number | null }>()
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
    this.board = createBoard({
      // i3 ER-1: the wall's reads pass its deadline as `signal`, so a slow read is stopped there.
      rpc: (fn, args, signal) => (signal ? deps.db.rpc(fn, args).abortSignal(signal) : deps.db.rpc(fn, args)),
      // CO-368, CO-369 (0.3.12 W2 S2): the estate's Projects with their business and primary repository, for the wall
      // between businesses and the directory's names; DO-9: an existing thread's participants, for the wall on a post
      // into it. Both throw with their reason, which the board logs before it lets the post through (0.3.12 review i2
      // ER-3, ER-4, DA-3, DA-4; `boardWallReads.ts`).
      projectFacts: (estateId, signal) => readProjectFacts(deps.db, estateId, signal),
      threadParticipants: (estateId, reader, threadId, signal) => readThreadParticipants(deps.db, estateId, reader, threadId, signal)
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
              `Close that program (or choose a free port with FABRIC_HUB_PORT), then quit and reopen Fabric`
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
      this.live.set(sessionId, { projectId, cameIn: scope.cameIn, agent: scope.agent, runtimeSessionId: scope.runtimeSessionId, mintedAt: now, lastCallAt: null, surface: scope.surface, bindingId: scope.bindingId, agentPid: origin?.agentPid ?? null })
    // TR-1: a rejoin minted under a runtime id the session did not have is the rename the enrollment matched by the
    // agent's process (a /clear): the session carries the new id from now on.
    else if (origin?.rejoin && origin.runtimeSessionId && origin.runtimeSessionId !== known.runtimeSessionId)
      known.runtimeSessionId = origin.runtimeSessionId
    // ER-2 (i2): a process named later (an enrollment that matched the session) is kept; one already named is not
    // replaced by a rejoin's, which is found from the agent's session file and may be absent.
    if (known && typeof origin?.agentPid === 'number' && typeof known.agentPid !== 'number') known.agentPid = origin.agentPid
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
  heldSessions(projectId?: string): Array<{ sessionId: string; projectId: string; cameIn: CameIn; agent: string | null; runtimeSessionId: string | null; startedAt: number; lastCallAt: number | null; surface: 'session' | 'board' }> {
    return [...this.live.entries()]
      .filter(([, s]) => !projectId || s.projectId === projectId)
      .map(([sessionId, s]) => ({ sessionId, projectId: s.projectId, cameIn: s.cameIn, agent: s.agent, runtimeSessionId: s.runtimeSessionId, startedAt: s.mintedAt, lastCallAt: s.lastCallAt, surface: s.surface ?? 'session' }))
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
    // The reason reaches the LOG as well as the client. A 401 whose record says
    // only "401" cannot tell an expired credential from a stolen one, and those
    // are the two things anybody reading a 401 is trying to distinguish.
    attempt?.refused(reason)
    res.writeHead(status, { 'content-type': 'application/json', ...extra })
    res.end(JSON.stringify({ error: reason }))
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
    const attempt = beginAttempt({ req, res, ctx })

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
      if (token && !leaving && hub && (await this.handleExternal(token, hub, req, res, ctx, attempt))) return
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
      const why = 'this board session ended: the operator\'s board.respond grant it joined under expired. The operator grants it again in Fabric, Settings → Agent access; then join again with fabric.board.join'
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
    this.touched(st.scope, !st.rejoin)
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
   *  agent works (TR-4). `own`: from the session's own client, not a rejoin (TR-2). */
  private touched(scope: AgentScope, own = true): void {
    const now = this.now()
    const s = this.live.get(scope.sessionId)
    if (s) {
      s.lastCallAt = now
      if (own) s.lastOwnCallAt = now
    }
    const due = this.claimHolders.get(scope.sessionId)
    if (due === undefined || now < due) return
    this.claimHolders.set(scope.sessionId, now + RENEW_EVERY_MS)
    void this.renewClaims(scope).catch((e) => {
      ops.failed('agentSurface.claim-renew', e, { note: 'the claims run to their expiry unless renewed by a later call', session_id: scope.sessionId })
    })
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

  /** A binding's per-session window, unless it already holds SESSION_WINDOWS_PER_BINDING others in this window; then the
   *  binding's one shared window, so varying `runtimeSessionId` cannot raise its budget (CO-346). */
  private boundedCallBucket(bindingId: string, bucket: string | null): string | null {
    const marker = `binding:${bindingId}:session:`
    if (!bucket || !bucket.startsWith(marker)) return bucket
    const now = this.now()
    let seen = this.bindingSessions.get(bindingId)
    if (!seen || now - seen.windowStart >= this.limits.budgetWindowMs) {
      seen = { windowStart: now, ids: new Set() }
      this.bindingSessions.set(bindingId, seen)
      // Bounded like the budget map: bindings whose window has passed are forgotten.
      if (this.bindingSessions.size > 4096)
        for (const [k, v] of this.bindingSessions) if (now - v.windowStart >= this.limits.budgetWindowMs) this.bindingSessions.delete(k)
    }
    const id = bucket.slice(marker.length)
    if (seen.ids.has(id)) return bucket
    if (seen.ids.size >= SESSION_WINDOWS_PER_BINDING) return `binding:${bindingId}:calls`
    seen.ids.add(id)
    return bucket
  }

  /** Spend one call from `key`'s window; false when the window's `limit` is already spent. */
  private spend(key: string, limit: number): boolean {
    const now = this.now()
    const budget = this.externalBudget.get(key) ?? { windowStart: now, calls: 0 }
    if (now - budget.windowStart >= this.limits.budgetWindowMs) {
      budget.windowStart = now
      budget.calls = 0
    }
    if (budget.calls >= limit) {
      this.externalBudget.set(key, budget)
      return false
    }
    budget.calls++
    this.externalBudget.set(key, budget)
    // Bounded: a window's buckets are forgotten once they are old, so request ids cannot grow the map for ever.
    if (this.externalBudget.size > 4096)
      for (const [k, v] of this.externalBudget) if (now - v.windowStart >= this.limits.budgetWindowMs) this.externalBudget.delete(k)
    return true
  }

  // #region hub-external-ingress — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#1-one-door-a-second-way-in
  /**
   * An external principal (ADR-0115): the door token, or a binding credential. Returns false when the
   * bearer is neither, so the caller refuses it exactly as it refuses any unknown bearer.
   *
   * STATELESS, deliberately. A session's bearer is spent on one initialize and paired with a session
   * id; an external credential is reusable by design (an agent that restarts keeps working), so each
   * request gets a fresh server and transport, and there is no session id to steal or to leak.
   */
  private async handleExternal(
    token: string,
    hub: HubIngress,
    req: IncomingMessage,
    res: ServerResponse,
    ctx: AttemptContext,
    attempt: { refused(reason: string): void; saw(body: unknown): void }
  ): Promise<boolean> {
    // Admission is BEFORE credential lookup/body parsing: a partial body otherwise holds a
    // request outside every budget. Door poll buckets remain separate after parsing (ER-7).
    const admissionKey = createHash('sha256').update(token, 'utf8').digest('hex')
    const pending = this.externalPending.get(admissionKey) ?? 0
    if (pending >= Math.max(1, Math.min(32, this.limits.budgetCalls)) || this.externalPendingTotal >= 128) {
      AgentSurface.refuse(res, 429, 'too many concurrent requests', {'connection':'close', 'retry-after':'1'}, attempt)
      return true
    }
    this.externalPending.set(admissionKey, pending + 1)
    this.externalPendingTotal++
    // Released exactly once — when the request ends OR when the caller goes away. The SDK never settles
    // handleRequest for a response closed under it, so a slot freed only after it leaked one per hang-up
    // until the credential (or the whole hub) was refused 429 (I3 E-2).
    let released = false
    const release = (): void => {
      if (released) return
      released = true
      const remaining = (this.externalPending.get(admissionKey) ?? 1) - 1
      if (remaining) this.externalPending.set(admissionKey, remaining)
      else this.externalPending.delete(admissionKey)
      this.externalPendingTotal--
    }
    const closed = new Promise<void>((resolve) => res.once('close', () => { release(); resolve() }))
    try {
      let principal: HubPrincipal | null = null
      const door = hub.doorToken()
      if (door && sameToken(token, door)) principal = { kind: 'door' }
      else {
        const bearerHash = createHash('sha256').update(token, 'utf8').digest('hex')
        // Unknown bearers share one small budget, spent BEFORE the lookup: each would otherwise cost a
        // database read with no budget at all (ER-7). A bearer that authenticated before is not held back.
        if (!hub.access.knownCredential(token) && !this.knownBearers.has(bearerHash) && !this.spend('unknown-bearers', Math.max(1, Math.ceil(this.limits.budgetCalls / 4)))) {
          AgentSurface.refuse(res, 429, 'too many unknown credentials; try again later', { 'retry-after': String(Math.max(1, Math.ceil(this.limits.budgetWindowMs / 1000))) }, attempt)
          return true
        }
        try {
          const binding = await hub.access.authenticate(token)
          if (binding) {
            principal = { kind: 'binding', binding }
            if (this.knownBearers.size >= 1024) this.knownBearers.clear()
            this.knownBearers.add(bearerHash)
          } else this.knownBearers.delete(bearerHash)
        } catch (e) {
          // Not "unknown credential": the credential could not be CHECKED, and an agent told it is
          // unknown would discard a valid one. 503 says try again.
          ops.failed('agentSurface.hub-authenticate', e)
          AgentSurface.refuse(res, 503, 'the hub cannot check credentials right now; try again', { 'retry-after': '5' }, attempt)
          return true
        }
      }
      if (!principal) return false

      // Global door/binding window admission precedes body consumption. The door's per-agent
      // window is charged only once its request identifies an agent or poll (below).
      const ingressKey = principal.kind === 'door' ? 'door' : `binding:${principal.binding.id}`
      if (!this.spend(ingressKey, this.limits.budgetCalls * (principal.kind === 'door' ? 5 : BINDING_INGRESS_FACTOR))) {
        AgentSurface.refuse(res, 429, 'call budget exhausted before body admission', {'connection':'close', 'retry-after':String(Math.max(1, Math.ceil(this.limits.budgetWindowMs / 1000)))}, attempt)
        return true
      }
      let body: unknown
      try {
        body = await readJson(req, this.limits.bodyReadMs)
      } catch (e) {
        if (e instanceof BodyTooLarge) {
          AgentSurface.refuse(res, 413, 'request body too large', {'connection':'close'}, attempt)
          return true
        }
        if (e instanceof BodyReadTimeout) {
          AgentSurface.refuse(res, 408, 'request body deadline exceeded', {'connection':'close'}, attempt)
          return true
        }
        throw e
      }
      attempt.saw(body)
      if (Array.isArray(body)) {
        AgentSurface.refuse(res, 400, 'JSON-RPC batches are not accepted', {}, attempt)
        return true
      }

      // The door's bucket is the request being polled, or the agent asking — never the whole door (ER-7).
      const key = principal.kind === 'door' ? `door:${doorBucket(body)}` : `binding:${principal.binding.id}`
      ctx.sessionId = principal.kind === 'door' ? 'door' : key
      const callKey = principal.kind === 'door' ? key : this.boundedCallBucket(principal.binding.id, bindingCallBucket(principal.binding.id, body))
      if (callKey && !this.spend(callKey, this.limits.budgetCalls)) {
        const now = this.now()
        const bucket = this.externalBudget.get(callKey)
        const retryIn = bucket ? Math.ceil((bucket.windowStart + this.limits.budgetWindowMs - now) / 1000) : 1
        ops.record({ op: 'agentSurface.budgetExhausted', outcome: 'ok', level: 'warn', detail: { principal: callKey, calls: this.limits.budgetCalls, retry_in_s: retryIn }, ctx: { correlationId: ctx.correlationId, estateId: this.deps.estateId } })
        AgentSurface.refuse(res, 429, `call budget exhausted: ${this.limits.budgetCalls} calls per ${this.limits.budgetWindowMs / 1000}s. Retry in ${retryIn}s.`, { 'retry-after': String(Math.max(1, retryIn)) }, attempt)
        return true
      }
      const server = hub.tools(principal)
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
      res.on('close', () => {
        // Each request owns its server and transport; both end with the response.
        void transport.close()
        void server.close()
      })
      await server.connect(transport)
      await Promise.race([transport.handleRequest(req, res, body), closed])
      return true
    } finally {
      release()
    }
  }
  // #endregion hub-external-ingress

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
          'What this session is: the project, its repositories, the task that opened it if any, and the rules that apply here. Call this first.',
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

        return json({
          session_id: scope.sessionId,
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
        const event = await this.appendRedacted({
          estateId: scope.estateId,
          type: 'agent.stage.reported@1',
          actor: { kind: 'agent', id: scope.sessionId },
          projectId: scope.projectId,
          payload: {
            session_id: scope.sessionId,
            task_id: scope.taskId,
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

    server.registerTool(
      'fabric_task_create',
      {
        title: 'File a task on this project’s board',
        description:
          'Put work on the board — something you found that should happen, or a piece you are splitting off. It lands in backlog for the operator to see. You must say where it came from: a card with no evidence behind it is noise on someone else’s board.',
        inputSchema: {
          title: z.string().min(3).max(200).describe('What should happen, in a line the project\'s owner understands without context, in the working language fabric_whoami names (or the person\'s own, when it names none) ("Keep the computer awake while an agent works"); an id goes in source, not here'),
          origin: z
            .object({
              // M124 — `document` and `memory` join the list. Before them an
              // agent filing work from a decision somebody WROTE DOWN had to
              // call it an observation, which is the word for something Fabric
              // measured. The enum is imported rather than retyped: `origin.ts`
              // owns it because it also owns how a ref is walked backwards.
              kind: z.enum(ORIGIN_KINDS),
              ref: z
                .string()
                .min(1)
                .max(300)
                .describe(
                  'The file and line (docs/adr/0014.md:22), the memory fact id, the command, or the task id. A line or range at the end is the LOCATION; the rest is the document, and other tasks from the same document are shown beside this one.'
                )
            })
            .describe('What this came out of. Required — evidence is what makes it actionable'),
          section: z.string().max(80).optional().describe('Where it belongs, if the project uses sections'),
          source: SOURCE_SCHEMA.optional()
        }
      },
      async ({ title, origin, section, source }) => {
        assertAgentReference(origin.ref)
        assertAgentReference(section)
        // REQ-08: the backlog row it serves is resolved BEFORE anything is filed, so a row that does not resolve files nothing.
        const linked = source ? await this.resolveSourceFor(scope, source) : null
        if (linked && !linked.ok)
          return json({ created: false, code: 'source-unresolved', part: linked.part, reason: linked.reason })
        // M68 — how far has this hand-off already travelled?
        //
        // The chain parent is the session's OWN task, not whatever the agent
        // named as origin. An agent working task X that files new work produced
        // it from X; `origin` is its claim about why, and `scope.taskId` is what
        // Fabric observed. Counting the claim would let a chain hide itself by
        // naming something else.
        if (scope.taskId) {
          const { data: links } = await store
            .select('task_links', 'task_id,target_id')
            .eq('rel', 'spawned')
            .eq('target_kind', 'task')
          const from: Record<string, string | undefined> = {}
          for (const l of links ?? []) from[l.task_id as string] = l.target_id as string
          const verdict = mayChain(from, scope.taskId)
          if (!verdict.ok) {
            // M168 — through the ONE door, with the surface's redacting
            // appender handed in. This used to append here, applying `mayChain`
            // and no other rule: a different set from the operator's path, and
            // neither knew about the other.
            const { proposalId } = await fileProposal({
              journal: this.deps.journal,
              estateId: scope.estateId,
              projectId: scope.projectId,
              actor: { kind: 'agent', id: scope.sessionId },
              title,
              origin,
              fromTaskId: scope.taskId,
              depth: verdict.depth,
              bound: verdict.bound,
              append: (e) => this.appendRedacted(e as Parameters<typeof this.appendRedacted>[0])
            })
            return json({
              created: false,
              proposed: true,
              proposal_id: proposalId,
              depth: verdict.depth,
              bound: verdict.bound,
              reason: verdict.reason
            })
          }
        }

        const id = randomUUID()
        const event = await this.appendRedacted({
          estateId: scope.estateId,
          type: 'task.created@1',
          actor: { kind: 'agent', id: scope.sessionId },
          projectId: scope.projectId,
          payload: { id, title, instruction: title, origin, section: section ?? null, task_type: 'development' }
        })
        await this.appendRedacted({
          estateId: scope.estateId,
          type: 'task.assigned@1',
          actor: { kind: 'agent', id: scope.sessionId },
          projectId: scope.projectId,
          payload: { task_id: id, assigned_by: `agent:${scope.sessionId}`, assigned_to: 'operator' }
        })
        if (linked?.ok) await this.linkSource(scope, id, linked)
        // The link is what MAKES the chain. Without it every hand-off is depth
        // one forever and the bound above can never trip — the failure mode that
        // looks exactly like a bound nobody has hit yet.
        //
        // THROUGH THE SAME DOOR (FA-04). This used to append the edge itself,
        // which made it a second writer of `task.linked@1` with none of the
        // command's rules — no scope floor, no topology, no idempotency. A
        // second door is a second set of rules, and they diverge on the day
        // somebody is in a hurry.
        let chained: LinkVerdict | null = null
        if (scope.taskId) {
          const { data, error } = await db.rpc('link_tasks', {
            p_estate_id: scope.estateId,
            p_task_id: id,
            p_rel: 'spawned',
            p_target_id: scope.taskId,
            p_actor: { kind: 'agent', id: scope.sessionId },
            p_project_id: scope.projectId
          })
          // Reported, never swallowed. The task exists either way, and a caller
          // that believes it built a chain when it did not is the failure this
          // link exists to prevent — depth stays one forever and the bound never
          // trips, which looks exactly like a bound nobody has reached.
          chained = linkOutcome(data, error)
        }
        return json({
          created: true,
          id,
          status: 'backlog',
          seq: event.seq,
          ...(linked?.ok ? { source: { repository: linked.repository, path: linked.path, id: linked.rowId, id_checked: linked.idChecked } } : {}),
          ...(chained ? { chained_to: scope.taskId, chained: chained.linked === true,
                          ...(chained.linked ? {} : { chain_reason: chained.says ?? chained.reason_code }) } : {})
        })
      }
    )

    server.registerTool(
      'fabric_task_handoff',
      {
        title: 'Hand something on',
        description:
          'Record a NAMED result of this task, for whatever task follows it. The follower declares which names it needs and does not start without them — so an empty value is the same as no value, and saying nothing here stops the chain rather than starting the next step on a blank. Handing the same name twice replaces it.',
        inputSchema: {
          taskId: z.string().uuid(),
          name: z
            .string()
            .min(1)
            .max(60)
            .describe('What this is, in the follower’s words — the name it asked for'),
          value: z.string().min(1).max(8000).describe('The thing itself, as text a person can read')
        }
      },
      async ({ taskId, name, value }) => {
        assertAgentReference(name)
        const task = await ownTask(taskId)
        if (!task) return json({ recorded: false, reason: 'no such task in this project' })
        // PF-09.01 — publication is authenticated: the session's own task, or a
        // task whose LIVE lease this session holds. Checked before the append…
        const { data: held } = await store
          .select('leases', 'owner_session,expires_at')
          .eq('work_id', taskId)
          .maybeSingle()
        const verdict = mayPublishHandoff(
          { sessionId: scope.sessionId, taskId: scope.taskId },
          taskId,
          (held as { owner_session: string; expires_at: string } | null) ?? null,
          Date.now()
        )
        if (!verdict.ok)
          return json({ recorded: false, reason: verdict.reason,
                        ...(verdict.heldBy ? { held_by: verdict.heldBy } : {}) })
        // PF-09.02 — an accepted output is immutable. A repeat of the same
        // name is a REPLACE only while nothing consumed it; once a follower
        // left backlog, it is a new REVISION and the consumers are named
        // stale rather than silently re-based.
        const [{ data: prior }, { data: followLinks }] = await Promise.all([
          store.select('task_handoffs', 'name').eq('task_id', taskId).eq('name', name),
          store.select('task_links', 'task_id').eq('rel', 'follows')
            .eq('target_kind', 'task').eq('target_id', taskId)
        ])
        let followers: Array<{ id: string; status: string }> = []
        const followerIds = (followLinks ?? []).map((l) => l.task_id as string)
        if (followerIds.length) {
          // Chunked and error-read, the same 414 the chain advancer hit: a list
          // as long as the data becomes a URL the gateway refuses, and
          // `.data ?? []` turned that into "no followers", which here decides
          // the handoff's disposition.
          const read = await store.selectIn('project_tasks', 'id,status', 'id', followerIds)
          if (read.failed) throw new Error(read.failed)
          followers = read.rows.map((r) => ({ id: r.id as string, status: r.status as string }))
        }
        const disposition = handoffDisposition(Boolean(prior?.length), followers)
        const event = await this.appendRedacted({
          estateId: scope.estateId,
          type: 'task.handoff@1',
          actor: { kind: 'agent', id: scope.sessionId },
          projectId: scope.projectId,
          payload: { task_id: taskId, name, value,
                     owner: scope.sessionId,
                     disposition: disposition.kind,
                     stale_downstream: disposition.kind === 'revision' ? disposition.staleDownstream : [],
                     fence: (held as { expires_at?: string } | null)?.expires_at ?? null }
        })
        // …and re-read after: append_event serializes per estate, so the lease
        // read back AFTER our write is the arbitrated truth. Ownership that
        // moved mid-publication is reported, not papered over — the projection
        // arbitrates by seq and the loser's write must not read as accepted.
        const { data: settled } = await store
          .select('leases', 'owner_session,expires_at')
          .eq('work_id', taskId)
          .maybeSingle()
        if (settled && settled.owner_session !== scope.sessionId &&
            new Date(settled.expires_at as string).getTime() > Date.now() &&
            scope.taskId !== taskId)
          return json({ recorded: false,
                        reason: 'ownership moved mid-publication — re-claim and re-publish',
                        held_by: settled.owner_session, seq: event.seq })
        if (disposition.kind === 'revision')
          return json({ recorded: true, name, seq: event.seq, revision: true,
                        stale_downstream: disposition.staleDownstream,
                        note: 'the earlier value was already consumed — this lands as a new revision; the named followers ran on the old one and are stale' })
        return json({ recorded: true, name, seq: event.seq })
      }
    )

    server.registerTool(
      'fabric_task_claim',
      {
        title: 'Take a task',
        description:
          'Claim a task before working on it, so another agent does not start the same work. The claim expires — if you are still on it when it does, claim again. Refused when someone else holds it, and it tells you who and until when.',
        inputSchema: {
          taskId: z.string().uuid(),
          minutes: z.number().int().min(1).max(240).optional().describe('How long you expect to need. Default 30'),
          writeScopes: z
            .array(z.string().min(1))
            .optional()
            .describe('What you intend to write — paths or areas, so a neighbour can see the overlap'),
          source: SOURCE_SCHEMA.optional()
        }
      },
      async ({ taskId, minutes, writeScopes, source }) => {
        for (const reference of writeScopes ?? []) assertAgentReference(reference)
        const task = await ownTask(taskId)
        if (!task) return json({ claimed: false, reason: 'no such task in this project' })
        if (TERMINAL.includes(task.status))
          return json({ claimed: false, reason: `that task is ${task.status}` })
        // REQ-08: the task is linked to the backlog row it serves (an address, never a copy), before the claim.
        if (source) {
          const linked = await this.resolveSourceFor(scope, source)
          if (!linked.ok) return json({ claimed: false, code: 'source-unresolved', part: linked.part, reason: linked.reason })
          await this.linkSource(scope, taskId, linked)
        }

        const { data: held } = await store
          .select('leases', 'owner_session,expires_at')
          .eq('work_id', taskId)
          .maybeSingle()
        const live = held && new Date(held.expires_at as string).getTime() > Date.now()
        // A run Fabric launched for the task holds it until proved stopped; a lapsed lease is not that proof (CO-323).
        const runHold = (await readRunHolds(store, [taskId])).find((h) => h.sessionId !== scope.sessionId) ?? null
        if (runHold) return json(runHoldRefusal(taskId, runHold, held as { expires_at: string } | null, Date.now()))
        if (live && held.owner_session !== scope.sessionId)
          return json({
            claimed: false,
            reason: 'another session holds this task',
            held_by: held.owner_session,
            until: held.expires_at
          })

        const expiresAt = new Date(Date.now() + (minutes ?? 30) * 60_000).toISOString()
        await this.appendRedacted({
          estateId: scope.estateId,
          type: 'work.claimed@1',
          actor: { kind: 'agent', id: scope.sessionId },
          projectId: scope.projectId,
          payload: {
            work: taskId,
            owner: scope.sessionId,
            idempotency_key: `${scope.sessionId}:${taskId}:${expiresAt}`,
            expires_at: expiresAt,
            write_scopes: writeScopes ?? []
          }
        })
        // The read above is a courtesy, not the decision. Two agents that read
        // "free" in the same instant both append, and the PROJECTION arbitrates
        // by seq — so the answer an agent can trust is the one read back after
        // the write. A claim is a command in the contract's own words
        // (`coordination.schema.json` is titled "command or event"), and a
        // command can be refused after it is issued.
        const { data: settled } = await store
          .select('leases', 'owner_session,expires_at')
          .eq('work_id', taskId)
          .maybeSingle()
        if (!settled || settled.owner_session !== scope.sessionId) {
          // Named from what holds the task now — never "the same moment" for a lease that lapsed before the write.
          const holds = await readRunHolds(store, [taskId])
          const { data: holder } = await store.select('work_claims', 'agent,came_in,claimed_at').eq('work_id', taskId).is('released_at', null).maybeSingle()
          return json(refusalAfterWrite({
            taskId, me: scope.sessionId, now: Date.now(),
            lease: settled as { owner_session: string; expires_at: string } | null,
            holder: holder as Parameters<typeof refusalAfterWrite>[0]['holder'],
            hold: holds.find((h) => h.sessionId !== scope.sessionId) ?? null
          }))
        }
        // PF-09.02 — the lease is exclusivity over the TASK, never over a
        // FILE. Overlapping write scopes on other live leases are reported,
        // because the false comfort is believing the task claim covers the
        // path. Reported, not refused: two tasks may legitimately touch one
        // file in sequence — but nobody discovers the overlap at merge time.
        let scopeConflicts: ReturnType<typeof writeScopeConflicts> = []
        if ((writeScopes ?? []).length) {
          const { data: neighbours } = await store
            .select('leases', 'work_id,owner_session,expires_at,write_scopes')
            .eq('project_id', scope.projectId)
          scopeConflicts = writeScopeConflicts(
            writeScopes ?? [],
            (neighbours ?? [])
              .filter((n) => n.work_id !== taskId &&
                new Date(n.expires_at as string).getTime() > Date.now())
              .map((n) => ({ work_id: n.work_id as string,
                             owner_session: n.owner_session as string,
                             write_scopes: (n.write_scopes as string[]) ?? [] }))
          )
        }
        return json({ claimed: true, task_id: taskId, until: settled.expires_at,
                      ...(scopeConflicts.length
                        ? { scope_conflicts: scopeConflicts,
                            note: 'a task lease does not protect a file — coordinate these paths explicitly' }
                        : {}) })
      }
    )

    server.registerTool(
      'fabric_task_release',
      {
        title: 'Let a task go',
        description:
          'Release your claim when you stop working on a task, so someone else can take it. Say how it ended. This does not change the task’s state on the board — moving it is a separate act.',
        inputSchema: {
          taskId: z.string().uuid(),
          outcome: z.enum(['succeeded', 'failed', 'cancelled', 'abandoned'])
        }
      },
      async ({ taskId, outcome }) => {
        const { data: held } = await store
          .select('leases', 'owner_session')
          .eq('work_id', taskId)
          .maybeSingle()
        if (!held) return json({ released: false, reason: 'you do not hold that task' })
        if (held.owner_session !== scope.sessionId)
          return json({ released: false, reason: 'another session holds that task' })
        const event = await this.appendRedacted({
          estateId: scope.estateId,
          type: 'work.released@1',
          actor: { kind: 'agent', id: scope.sessionId },
          projectId: scope.projectId,
          payload: { work: taskId, owner: scope.sessionId, outcome }
        })
        const { data: remaining, error: readError } = await store
          .select('leases', 'owner_session').eq('work_id', taskId).maybeSingle()
        if (readError) return json({ released: false, reason: 'release could not be confirmed', seq: event.seq })
        if (remaining?.owner_session === scope.sessionId)
          return json({ released: false, reason: 'the run is unresolved; stop it and confirm its exit first', seq: event.seq })
        return json({ released: true, seq: event.seq })
      }
    )

    server.registerTool(
      'fabric_task_move',
      {
        title: 'Move a task on the board',
        description:
          'Move a task between backlog, running and review. You cannot mark work done or cancelled — move it to review and say what you concluded; accepting it is the operator’s move.',
        inputSchema: {
          taskId: z.string().uuid(),
          to: z.enum(['backlog', 'running', 'review']),
          note: z.string().max(400).optional().describe('One line on why it moved')
        }
      },
      async ({ taskId, to, note }) => {
        const task = await ownTask(taskId)
        if (!task) return json({ moved: false, reason: 'no such task in this project' })
        const verdict = mayMove('agent', task.status, to as TaskState)
        if (!verdict.ok) return json({ moved: false, reason: verdict.reason })
        const event = await this.appendRedacted({
          estateId: scope.estateId,
          type: 'task.moved@1',
          actor: { kind: 'agent', id: scope.sessionId },
          projectId: scope.projectId,
          payload: { task_id: taskId, from: task.status, to, note: note ?? null }
        })
        return json({ moved: true, from: task.status, to, seq: event.seq })
      }
    )

    server.registerTool(
      'fabric_task_note',
      {
        title: 'Leave a note on a task',
        description:
          'Working notes for one task — what you tried, what you ruled out, where you got to. They are append-only and they are NOT documentation: a note worth keeping past this task gets promoted to project memory, and the task keeps a link to it.',
        inputSchema: {
          taskId: z.string().uuid(),
          body: z.string().min(1).max(4000).describe('Markdown')
        }
      },
      async ({ taskId, body }) => {
        const task = await ownTask(taskId)
        if (!task) return json({ noted: false, reason: 'no such task in this project' })
        const noteId = randomUUID()
        const event = await this.appendRedacted({
          estateId: scope.estateId,
          type: 'task.note.added@1',
          actor: { kind: 'agent', id: scope.sessionId },
          projectId: scope.projectId,
          payload: { task_id: taskId, note_id: noteId, body_md: body }
        })
        return json({ noted: true, note_id: noteId, seq: event.seq })
      }
    )

    server.registerTool(
      'fabric_question_ask',
      {
        title: 'Ask the owner a question',
        description:
          'When you reach a decision you are not entitled to make, ASK — do not guess and do not work around it. The question reaches the owner ranked against everything else waiting, and whatever it blocks stays blocked until it is answered. Give options where there are options: an owner choosing between two named consequences answers in seconds, and an open question waits for them to have time to think. A question that blocks nothing is fine; you may want a decision without being stuck on it.',
        inputSchema: {
          commandId: z
            .string()
            .uuid()
            .describe('Your own id for this ask. Retry with the SAME one and you get the same question back, not a second one in front of a person.'),
          text: z.string().min(1).max(4000),
          kind: z.enum(QUESTION_KINDS).optional().describe('decision by default'),
          topic: z.string().max(80).optional().describe('what it is about, beside the kind — e.g. process'),
          about: z.string().max(200).optional().describe('a stable subject key such as db.version, so a recorded decision on the same subject can settle it without asking'),
          whyBlocked: z.string().max(2000).optional().describe('what cannot proceed, in your words'),
          taskId: z.string().uuid().optional().describe('the task this came out of'),
          options: z
            .array(z.object({ id: z.string().optional(), label: z.string(), consequence: z.string().optional() }))
            .max(8)
            .optional(),
          blocks: z.array(z.string().uuid()).max(20).optional().describe('tasks that cannot proceed until this is answered')
        }
      },
      async ({ commandId, ...raw }) => {
        assertAgentReference(raw.about)
        for (const option of raw.options ?? []) assertAgentReference(option.id)
        // The normalizer clips labels/consequences. Scrub the complete source
        // first: after clipping a token prefix may no longer be recognizable.
        // Optional blank detail remains legal; normaliseAsk owns its existing
        // empty-label/text refusals and omission behavior.
        const questionText = (value: string): string => value.trim() ? cleanOriginalText(value) : value
        const asked = normaliseAsk({
          ...raw,
          text: questionText(raw.text),
          ...(raw.topic !== undefined ? { topic: questionText(raw.topic) } : {}),
          ...(raw.whyBlocked !== undefined ? { whyBlocked: questionText(raw.whyBlocked) } : {}),
          ...(raw.options ? { options: raw.options.map(option => ({
            ...option,
            label: questionText(option.label),
            ...(option.consequence !== undefined ? { consequence: questionText(option.consequence) } : {})
          })) } : {})
        })
        if (!asked.ok) return json({ asked: false, reason: asked.reason })

        // Idempotency BEFORE validation costs a round trip; after it, a retry of
        // a malformed ask still gets the same refusal, which is what the agent
        // needs to see.
        const { data: already } = await store
          .select('questions', 'id,status,seq')
          .eq('asked_command_id', commandId)
          .maybeSingle()
        if (already)
          return json({ asked: true, repeated: true, question_id: already.id, status: already.status, seq: already.seq })

        // Every blocked task is checked HERE, before the append. The projector
        // would silently drop a foreign one (ADR-0049) and the agent would be
        // left with a question that blocks nothing and no idea why.
        for (const taskId of asked.value.blocks)
          if (!(await ownTask(taskId)))
            return json({ asked: false, reason: `task ${taskId} is not in this project, so this question cannot block it` })
        if (asked.value.taskId && !(await ownTask(asked.value.taskId)))
          return json({ asked: false, reason: 'that task is not in this project' })

        const questionId = randomUUID()
        const event = await this.appendRedacted({
          estateId: scope.estateId,
          type: 'question.asked@1',
          actor: { kind: 'agent', id: scope.sessionId },
          projectId: scope.projectId,
          payload: {
            id: questionId,
            command_id: commandId,
            // The SERVER's project, not one the caller named. The estate and the
            // author come from the credential for the same reason.
            project_id: scope.projectId,
            text: asked.value.text,
            kind: asked.value.kind,
            topic: asked.value.topic,
            about: asked.value.about,
            why_blocked: asked.value.whyBlocked,
            task_id: asked.value.taskId,
            options: asked.value.options,
            blocks: asked.value.blocks
          }
        })
        return json({
          asked: true,
          repeated: false,
          question_id: questionId,
          seq: event.seq,
          blocks: asked.value.blocks.length,
          note: 'It is with the owner now. Nothing here tells you when it will be answered — check with fabric_question_check, and do not wait in a loop.'
        })
      }
    )

    server.registerTool(
      'fabric_question_check',
      {
        title: 'Check a question you asked',
        description:
          'The current state of one question, by its id. Open means nobody has answered yet — that is not a failure and not a reason to ask again. Answered carries the answer and the option chosen if there was one.',
        inputSchema: { questionId: z.string().uuid() }
      },
      async ({ questionId }) => {
        // Scoped by the credential, so another project's question reads exactly
        // like one that does not exist. Two different refusals would tell an
        // agent that a question it may not see is out there.
        const { data } = await store
          .select('questions', 'id,status,answer,chosen_option,answered_at,about,topic,kind,text')
          .eq('id', questionId)
          .maybeSingle()
        if (!data) return json({ found: false, reason: 'no such question here' })
        const { data: blocked } = await store
          .select('question_blocks', 'task_id')
          .eq('question_id', questionId)
        return json({
          found: true,
          question_id: data.id,
          status: data.status,
          text: data.text,
          answer: data.answer ?? null,
          chosen_option: data.chosen_option ?? null,
          answered_at: data.answered_at ?? null,
          blocks: (blocked ?? []).map((b) => b.task_id)
        })
      }
    )

    server.registerTool(
      'fabric_task_link',
      {
        title: 'Link two tasks',
        description:
          'Say that one task blocks, follows or spawned another. Refused when the link would close a cycle, and it names the loop — a board where A waits for B waits for A is one nobody can act on.',
        inputSchema: {
          taskId: z.string().uuid(),
          rel: z.enum(['blocks', 'follows', 'spawned']),
          targetTaskId: z.string().uuid()
        }
      },
      async ({ taskId, rel, targetTaskId }) => {
        // ONE CALL, and that is the fix (FA-04). This used to ask
        // `would_close_cycle` in one round trip and append in another, which
        // failed twice: `error` was destructured away, so a check that could not
        // run waved the write through; and two clients linking A->B and B->A both
        // read "no cycle" before either wrote. Measured against the live stack:
        // both saw false, both wrote, the journal took two events and the board
        // kept one — the projector drops a cyclic edge with a warning, so the
        // estate's history held something its projection did not contain.
        //
        // `link_tasks` takes the estate lock BEFORE it asks, so scope, topology
        // and the append are one indivisible act, and every refusal arrives as a
        // typed reason rather than as an absence.
        const { data, error } = await db.rpc('link_tasks', {
          p_estate_id: scope.estateId,
          p_task_id: taskId,
          p_rel: rel,
          p_target_id: targetTaskId,
          p_actor: { kind: 'agent', id: scope.sessionId },
          p_project_id: scope.projectId
        })
        const verdict = linkOutcome(data, error)
        if (!verdict.linked)
          return json({
            linked: false,
            reason_code: verdict.reason_code,
            reason: linkRefusal(verdict)
          })
        return json({ linked: true, already: verdict.already === true, seq: verdict.seq })
      }
    )

    server.registerTool(
      'fabric_task_brief',
      {
        title: 'Draft what a task is for',
        description:
          'Write the brief of a task you are working on: what should happen, why, and what will be true when it is done. The "what" section is the task\'s summary on the home screen and the project page: write it first, as one or two plain sentences the owner understands without context, in the working language fabric_whoami names (or the person\'s own, when it names none). Yours is a DRAFT — the operator can replace any section, and both versions stay readable. Keep it to the task; anything worth knowing past this task belongs in fabric_memory_remember.',
        inputSchema: {
          taskId: z.string().uuid(),
          section: z.enum(['what', 'why', 'expected']),
          body: z.string().min(1).max(2000).describe('Markdown, a few lines')
        }
      },
      async ({ taskId, section, body }) => {
        const task = await ownTask(taskId)
        if (!task) return json({ written: false, reason: 'no such task in this project' })
        const event = await this.appendRedacted({
          estateId: scope.estateId,
          type: 'task.brief.edited@1',
          actor: { kind: 'agent', id: scope.sessionId },
          projectId: scope.projectId,
          payload: { task_id: taskId, section, body_md: body }
        })
        return json({ written: true, section, seq: event.seq })
      }
    )

    // #region project-profile-tool — docs: docs/evidence/specs/2026-10-23-0312-w2-project-onboarding.md#decisions-the-questions-the-scenarios-leave-open
    // W2-3: the agent onboarding a project records what it is, for THIS project only (the scope wall). Every field is
    // optional and each call is one `project.profiled@1`; a field named replaces the page's value, an empty one clears it.
    server.registerTool(
      'fabric_project_profile',
      {
        title: 'Record what this project is',
        description:
          'Record what this project is, for the project page and the project graph: its goal, a one-line summary, the business it belongs to, its plan (done and next) and its relations to other projects. Write each in the working language fabric_whoami names (or the person\'s own, when it names none), as plain sentences the project\'s owner understands without context. Every field is optional: name only what you learned; a field you name replaces what was there, an empty string clears it, and relations, when given, replace the whole list. The business is the person\'s: you may record it only while the project has none and the person never set or cleared one; an empty business, a different one once it is set, or any once the person left it empty, is refused (the person sets it on the project page). When the business cannot be checked now, it is left unwritten, the other fields you named are written, and the answer\'s refused.business says why. Read the repository, its README, its remotes and the board before you write; never put a secret, a token or a private path here.',
        inputSchema: {
          goal: z.string().max(600).optional().describe('What the project is for and what it aims at now, one or two sentences'),
          summary: z.string().max(160).optional().describe('One line: what the project is'),
          business: z.string().max(80).optional().describe('The business or organization it belongs to, a short name, only while the project has none; the board never joins projects of two different businesses, and the person decides it'),
          plan: z
            .object({
              done: z.array(z.string().min(1).max(200)).max(20).describe('What is done, newest first'),
              next: z.array(z.string().min(1).max(200)).max(20).describe('What comes next, in order')
            })
            .optional(),
          relations: z
            .array(
              z.object({
                kind: z.enum(['depends-on', 'used-by', 'same-business', 'talks-to', 'other']),
                target: z.string().min(1).max(200).describe('The other project by its name, or a repository it uses'),
                note: z.string().max(500).optional()
              })
            )
            .max(50)
            .optional()
        }
      },
      async (args) => {
        // DA-2 / ER-2: the business is the person's; a read that fails refuses a business the call names (never writes
        // over a value it could not see) and writes the call's other fields, the answer naming the refused business in
        // `refused` (0.3.12 review i3 ER-4). 0.3.12 review i2 ER-2, DA-1, DA-2: the read,
        // the decision and the append run under the project's chain, which the person's write takes too; a business the
        // person ever wrote (or cleared) is never set by an agent. DA-9: a project this estate no longer holds is refused.
        const db = this.deps.db
        const answer = await writeAgentProfile({
          readProject: async () => {
            const { data, error } = await db.from('projects').select('business').eq('id', scope.projectId).eq('estate_id', scope.estateId).maybeSingle()
            return { row: error || !data ? null : { business: (data as { business: string | null }).business ?? null }, error: error?.message ?? null }
          },
          readPersonSet: async () => {
            const { data, error } = await db.from('journal').select('seq').eq('estate_id', scope.estateId).eq('project_id', scope.projectId)
              .eq('type', 'project.profiled@1').eq('actor->>kind', 'person').not('payload->business', 'is', null).limit(1)
            return { set: Array.isArray(data) && data.length > 0, error: error?.message ?? (error || Array.isArray(data) ? null : 'no list answered') }
          },
          append: (payload) => this.appendRedacted({ estateId: scope.estateId, type: 'project.profiled@1', actor: { kind: 'agent', id: scope.sessionId }, projectId: scope.projectId, payload }),
          failed: (what, error) => ops.failed(`agentSurface.${what}`, new Error(error), { projectId: scope.projectId })
        }, scope.projectId, args as Record<string, unknown>)
        return json(answer)
      }
    )
    // #endregion project-profile-tool

    server.registerTool(
      'fabric_task_accept',
      {
        title: 'Confirm the instruction you were given',
        description:
          'When you are handed a task instruction, say that you have it — quoting the digest you were given with it. Until you do, Fabric records the instruction as WRITTEN but unconfirmed, because bytes reaching a terminal look identical whether you read them, a pager swallowed them, or the process was wedged. This is what moves the task to running. It is not a promise to succeed; it says the instruction you hold is the one that was sent.',
        inputSchema: {
          deliveryId: z.string().uuid().describe('From the instruction you were handed'),
          inputDigest: z
            .string()
            .min(8)
            .max(128)
            .describe('The digest that came with it. Quote it exactly — it is what proves this is the same instruction')
        }
      },
      async ({ deliveryId, inputDigest }) => {
        assertAgentReference(inputDigest)
        // The trusted session credential supplies the identity; the caller can
        // never acknowledge a different session's instruction in this Project.
        const { data, error } = await db.rpc('acknowledge_delivery', {
          p_estate_id: scope.estateId,
          p_session_id: scope.sessionId,
          p_delivery_id: deliveryId,
          p_digest: inputDigest
        })
        if (error || !data || typeof data.accepted !== 'boolean')
          return json({ accepted: false, reason: 'The acknowledgement could not be recorded. Retry the same delivery.' })
        return json(data)
      }
    )

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

    server.registerTool(
      'fabric_effect_report',
      {
        title: 'Report what happened to an act you were permitted',
        description:
          'After doing a permitted act, say what happened, citing the effect_id you were given. This is a CLAIM, not a receipt: Fabric did not watch you do it, so the outcome stays recorded as unknown and your report is attached to it with your name on it. Reporting is still worth doing — an effect nobody reported and one that failed silently look identical otherwise. Never report an act you did not perform.',
        inputSchema: {
          effectId: z.string().uuid().describe('The effect_id fabric_effect_request gave you'),
          says: z
            .string()
            .min(3)
            .max(1000)
            .describe('What happened, plainly. Include any reference the other side gave you')
        }
      },
      async ({ effectId, says }) => {
        const policy = this.deps.policy
        if (!policy) return json({ recorded: false, reason: 'no policy port is configured on this surface' })
        // The intent is looked up under the SESSION's scope, so an agent cannot
        // report against another project's effect by knowing its id.
        // The credential-scoped store built at the top of `serverFor`: the lookup is
        // narrowed to this session's estate and project before the tool sees it.
        const { data: intent, error } = await store
          .select('effect_intents', 'command_id, action_class, target, state')
          .eq('command_id', effectId)
          .maybeSingle()
        if (error)
          return json({ recorded: false, reason: `the effect could not be read: ${error.message}` })
        if (!intent)
          return json({
            recorded: false,
            reason: 'no such effect in this project. Report against the effect_id you were given, not one you constructed.'
          })

        const request = {
          estateId: scope.estateId,
          projectId: scope.projectId,
          actionClass: (intent as { action_class: string }).action_class,
          floorClass: null,
          actor: { kind: 'agent' as const, id: scope.sessionId },
          target: (intent as { target: string | null }).target ?? ''
        }
        const event = await policy.claimEffect(
          request,
          { commandId: effectId, attemptNo: 1, idempotencyKey: '', seq: 0 },
          { says }
        )
        return json({
          recorded: true,
          receipt_seq: event.seq,
          outcome: 'unknown',
          note:
            'Recorded as your report, attributed to this session. The effect stays UNKNOWN to Fabric ' +
            'because Fabric did not observe it; that is not a doubt about you, it is the difference ' +
            'between evidence and an account.'
        })
      }
    )

    server.registerTool(
      'fabric_effect_request',
      {
        title: 'Ask to do something above the floor',
        description:
          'Three classes of act need a person: spending money, deleting what cannot be recovered, and publishing outward. Ask here BEFORE doing one. You will be refused the first time — that is not a failure, it is the operator being asked. They see the request with your reason, and if they agree you ask again and it goes through. You never hold the permission yourself.',
        inputSchema: {
          actionClass: z.string().min(3).max(80).describe('What you want to do, in the effects vocabulary'),
          floorClass: z
            .enum(['money', 'deletion', 'publication'])
            .describe('Which floor it crosses'),
          target: z
            .string()
            .min(1)
            .max(300)
            .describe('What it acts ON — a path, a domain, an account. The permission is scoped to exactly this'),
          why: z.string().min(3).max(500).describe('Why it is needed. The operator reads this and nothing else')
        }
      },
      async ({ actionClass, floorClass, target, why }) => {
        assertAgentReference(actionClass)
        assertAgentReference(target)
        const policy = this.deps.policy
        if (!policy)
          return json({ allowed: false, reason: 'the policy port is not available in this session' })
        // The agent presents NOTHING. If the operator has already granted this
        // exact act, the surface finds it — see `findGrantFor`. Handing the
        // agent a grant id would put authority in a language model's context,
        // quotable and copyable and easy to present for the wrong act.
        const grantId = await policy.findGrantFor({
          estateId: scope.estateId,
          floorClass,
          target,
          // A grant confined to another project or act does not serve this one (audit A7-015).
          projectId: scope.projectId,
          actionClass
        })
        // WHO IS ASKING, and in which mode (FA-09). The floor is voluntary —
        // every runner has native tools Fabric cannot see — so the decision has
        // to know whether the asker could be held to it at all. An unknown
        // session is uncontained by construction, which is the safe direction:
        // the question is whether Fabric can be sure.
        const session = ptys()?.get(scope.sessionId) ?? null
        const request = {
          estateId: scope.estateId,
          projectId: scope.projectId,
          actionClass,
          floorClass,
          actor: { kind: 'agent' as const, id: scope.sessionId },
          target,
          grantId,
          runner: session?.optionId ?? null,
          permissionMode: session?.permissionMode ?? null
        }
        const decision = await policy.decide({ ...request, reason: why } as typeof request)
        if (decision.verdict !== 'allow')
          return json({
            allowed: false,
            reason: decision.reason,
            needs: decision.needs,
            // Said plainly, because an agent that reads a refusal as a dead end
            // will invent a way around it instead of waiting.
            next: 'The operator has been asked. Do the act only after asking again and being allowed.'
          })
        // ADR-0050 — THE PERMIT IS NOT A RECEIPT. This used to call
        // `recordEffect`, which appended `effect.executed@1` — shown to the
        // operator as "an effect was carried out" — with nothing whatsoever
        // between the permission and the claim. The act happens afterwards,
        // outside Fabric, and may never happen at all.
        //
        // The fence is crossed here because from the agent's next instruction
        // onward the estate cannot know what occurred; the grant is spent, and
        // the effect stands at `dispatching` until somebody reports or observes
        // it. What an agent reports is a CLAIM, and the schema refuses to let a
        // claim become a success.
        const dispatch = await policy.beginDispatch(request, decision)
        return json({
          allowed: true,
          effect_id: dispatch.commandId,
          idempotency_key: dispatch.idempotencyKey,
          receipt_seq: dispatch.seq,
          note:
            'Permission, not a receipt: nothing has been recorded as done. Do the act ONCE, ' +
            'then report it with fabric_effect_report citing this effect_id. If you retry, ' +
            'reuse the idempotency key — a new one makes a second effect out of one.'
        })
      }
    )

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
      turnNudges: () => this.deps.nudgeItems?.(scope.sessionId, scope.projectId) ?? [],
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
    registerBoardTools(server, this.board, () => this.boardCaller(scope, ptys()?.runnerOf?.(scope.sessionId) ?? ptys()?.get(scope.sessionId)?.optionId ?? null))

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

/** A request body larger than this is refused rather than read (M104).
 *
 *  Not a performance figure: without a cap a single request can take the main
 *  process's memory with it, and the door is reachable by anything that has a
 *  bearer — including an agent looping on a mistake. A megabyte is far past any
 *  real tool call and far short of a problem. */
export const MAX_BODY_BYTES = 1_000_000

export class BodyTooLarge extends Error {
  constructor() {
    super('request body too large')
  }
}

class BodyReadTimeout extends Error {
  constructor() { super('request body deadline exceeded') }
}

async function readJson(req: IncomingMessage, timeoutMs: number): Promise<unknown> {
  // Event listeners can be removed on timeout without leaving an iterator blocked on next().
  // The caller sends Connection: close, so the bounded refusal reaches the peer before closure.
  const raw = await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    const cleanup = () => {
      clearTimeout(timer)
      req.off('data', data); req.off('end', end); req.off('aborted', aborted); req.off('error', failed)
    }
    const failed = (error: Error) => { cleanup(); reject(error) }
    const aborted = () => failed(new Error('request body aborted'))
    const data = (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) { req.pause(); failed(new BodyTooLarge()); return }
      chunks.push(chunk)
    }
    const end = () => { cleanup(); resolve(Buffer.concat(chunks).toString('utf8')) }
    const timer = setTimeout(() => { req.pause(); failed(new BodyReadTimeout()) }, timeoutMs)
    req.on('data', data); req.once('end', end); req.once('aborted', aborted); req.once('error', failed)
  })
  if (!raw) return undefined
  try { return JSON.parse(raw) } catch (e) {
    ops.failed('agentSurface.optional-read', e)
    return undefined
  }
}

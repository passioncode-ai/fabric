// #region session-enroll — docs: docs/adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md#decision
// `fabric.session.enroll` (ADR-0134 §2): a coding agent that holds a binding credential names its folder; Fabric
// resolves the folder to a project (ADR-0136) and, only when the binding holds a live `session.enroll` grant on
// that project, mints a session exactly as for a session Fabric launched — one bearer, one project, no task — and
// journals `session.enrolled@1`. Every other outcome is a typed answer the caller can act on, never a throw.
import { createHash, randomUUID } from 'node:crypto'
import path from 'node:path'
import { FABRIC_SELF, SESSION_ENROLL } from '../shared/access.ts'
import type { BindingRow, GrantRow } from './accessStore.ts'
import { normalizeRemoteKey, resolveProjectForFolder, type AdmittedFolder, type DetachedFolder } from './folderResolver.ts'
import { tooBroad } from './startChoices.ts'
import { ops } from './opsSink.ts'

export type EnrollAnswer =
  | { ok: true; session: { bearer: string; sessionId: string; projectId: string; projectName: string; how: string } }
  | { ok: false; code: 'needs-grant'; projectId: string; projectName: string; resource: string; message: string }
  | { ok: false; code: 'no-project'; message: string }
  | { ok: false; code: 'bad-folder'; message: string }
  /** A rejoin (D2) that found no live session of that runtime session: nothing is asked and nothing is minted. */
  | { ok: false; code: 'no-session'; message: string }

export const NO_SESSION_MESSAGE =
  'No live Fabric session belongs to this coding-agent session in this folder. A rejoin never asks the operator and never starts a session: start the agent with fabric-mcp registered.'

/** What the surface says of a bearer: minted and not yet spent on its one initialize, spent, or gone. */
export type CredentialState = 'unclaimed' | 'claimed' | null

export interface FolderDeps {
  /** Every admitted folder of the estate, with its project. */
  admittedFolders(): Promise<AdmittedFolder[]>
  /** A detach the operator recorded; automatic enrollment must not undo it. */
  detachedFolders?(): Promise<DetachedFolder[]>
  /** The real path of a folder, or null when it does not exist. */
  realpath(folder: string): string | null
  /** The worktree probe (`folderResolver.ts#gitCommonDir`, asynchronous and bounded) — injected in tests. */
  gitCommonDir?: (folder: string) => Promise<string | null> | string | null
  /** The folder's origin remote, used only after path and worktree identity fail. */
  remoteOf?: (folder: string) => Promise<string | null>
  /** Read-only repository inspection for an unknown folder. */
  inspectFolder?: (folder: string) => Promise<import('../shared/startPaths.ts').FolderFacts>
  /** Stable id for the proposed project root; the operator's estate scopes it. */
  projectIdForFolder?: (root: string) => string
  home?: string
}

export interface EnrollDeps extends FolderDeps {
  /** The binding's live (unrevoked, unexpired) grants. */
  liveGrants(binding: BindingRow): Promise<GrantRow[]>
  projectName(projectId: string): Promise<string | null>
  /** The same mint a launched session gets (`AgentSurface.mint`), told it is an enrollment and by which runner. */
  mint(projectId: string, sessionId: string, taskId: null, origin: { cameIn: 'enrolled'; agent: string; runtimeSessionId: string | null; rejoin?: true; bindingId: string }): { token: string }
  /** The enrolled sessions this process minted, by binding and grant: what a revocation ends. */
  sessions: EnrolledSessions
  /** Read again after the mint: the binding and the grant are both still live (the read-then-mint race). */
  stillLive(bindingId: string, grantId: string): Promise<boolean>
  journal(type: 'session.enrolled@1', projectId: string, payload: Record<string, unknown>): Promise<unknown>
  /** Live enrolled sessions one binding may hold; a further enrollment ends the least recently active. Default 8. */
  maxSessionsPerBinding?: number
  now?: () => number
}

const RUNTIME_SESSION = /^[A-Za-z0-9._:-]{1,128}$/
/** Several terminals of one coding agent in one project are ordinary; a loop is not. */
export const MAX_ENROLLED_PER_BINDING = 8

/** What an evicted session's next call is told (0.3.5 review iteration 2, ER-4): the true reason, and that its claims
 *  went with it — never "Fabric restarted", which would let it go on as if it still held its task. */
export const evictedReason = (cap: number): string =>
  `this session was ended to make room: this coding agent's access reached its limit of ${cap} enrolled sessions, and this one was the least recently active. Its claims were released — read fabric_work_list before you go on`

// ADR-0164: no answer hands the folder to the person. Each names what Fabric did not do and the agent's own next step.
export const NO_PROJECT_MESSAGE =
  'This folder is not inside a Git repository, so Fabric does not attribute it to a Project. Start the agent inside a Git repository or worktree, or run `git init` here, and enroll again.'
export const AMBIGUOUS_PROJECT_MESSAGE =
  'This folder matches more than one Project in Fabric, and Fabric does not guess. Start the agent in a folder that belongs to one Project.'
export const DETACHED_PROJECT_MESSAGE =
  'This repository was detached from its Project in Fabric, and Fabric does not attach it again on its own. Undoing that detach in Fabric brings it back.'
export const TOO_BROAD_MESSAGE =
  'A home folder or a filesystem root is too broad for a Project. Start the agent inside the repository you work in.'

export type FolderFact =
  | {
      ok: true
      real: string
      projectId: string
      projectName?: string
      how: 'exact' | 'ancestor' | 'worktree' | 'remote' | 'create'
      root: string
      candidate?: 'create' | 'attach'
      remoteKey: string | null
    }
  | { ok: false; code: 'bad-folder' | 'no-project'; message: string }

/** A folder an agent names, as Fabric resolves it itself. Existing identity wins; an eligible unknown Git folder is
 *  only PROPOSED with a deterministic project id. The write happens later, after runner and denial checks. */
export async function resolveAgentFolder(folder: unknown, deps: FolderDeps): Promise<FolderFact> {
  if (typeof folder !== 'string' || !path.isAbsolute(folder)) return { ok: false, code: 'bad-folder', message: 'cwd must be the absolute folder the agent runs in' }
  const real = deps.realpath(folder)
  if (!real) return { ok: false, code: 'bad-folder', message: 'that folder does not exist on this computer' }
  const match = await resolveProjectForFolder(real, await deps.admittedFolders(), deps.gitCommonDir, deps.remoteOf ?? (async () => null))
  if (match.how === 'ambiguous') return { ok: false, code: 'no-project', message: AMBIGUOUS_PROJECT_MESSAGE }
  if (match.projectId) {
    return {
      ok: true,
      real,
      projectId: match.projectId,
      how: match.how,
      root: match.root,
      ...(match.how === 'remote' ? { candidate: 'attach' as const } : {}),
      remoteKey: match.remoteKey ?? null
    }
  }
  if (!deps.inspectFolder || !deps.projectIdForFolder) return { ok: false, code: 'no-project', message: NO_PROJECT_MESSAGE }
  if (tooBroad(real, deps.home)) return { ok: false, code: 'no-project', message: TOO_BROAD_MESSAGE }
  let facts: import('../shared/startPaths.ts').FolderFacts
  try {
    facts = await deps.inspectFolder(real)
  } catch {
    return { ok: false, code: 'bad-folder', message: 'that folder could not be read as a Git repository on this computer' }
  }
  if (!facts.git) return { ok: false, code: 'no-project', message: NO_PROJECT_MESSAGE }
  const root = facts.kind === 'worktree' && facts.parent ? facts.parent : real
  const remoteKey = normalizeRemoteKey(facts.remote)
  const paths = new Set([real, root])
  const detached = (await (deps.detachedFolders?.() ?? Promise.resolve([]))).some((row) =>
    (row.path && paths.has(row.path)) || (remoteKey && row.remoteKey === remoteKey))
  if (detached) return { ok: false, code: 'no-project', message: DETACHED_PROJECT_MESSAGE }
  return {
    ok: true,
    real,
    projectId: deps.projectIdForFolder(root),
    projectName: path.basename(root),
    how: 'create',
    root,
    candidate: 'create',
    remoteKey
  }
}

// #region session-enroll-revocation — docs: docs/adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md#amendments
/** One enrolled session this process minted. The bearer never leaves this process. */
export interface EnrolledSession {
  sessionId: string
  bearer: string
  bindingId: string
  grantId: string
  projectId: string
  mintedAt: number
  /** The coding agent's own session id it enrolled with (D1), or null. */
  runtimeSessionId?: string | null
  /** The one bearer the session hooks' rejoins (D2) hold for this session, or none (0.3.5 review iteration 2, ER-5). */
  rejoinBearer?: string | null
  /** A board session (`fabric.board.join`, ADR-0149 §4) holds several board.respond grants: any one revoked ends it. */
  grantIds?: string[]
  /** 'board': a board session — capped apart from a coding agent's enrollments, never evicted by one (wave-2 fix 11). */
  surface?: 'board'
}

/**
 * The enrolled sessions of this process, by binding and grant (ADR-0134 §3: a revoked grant refuses the next call).
 * A revocation of the binding or of the grant ends every session minted under it — at the surface, so the bearer is
 * refused on its next request — and a row whose bearer the surface no longer holds is dropped when it is next read.
 */
export class EnrolledSessions {
  private rows = new Map<string, EnrolledSession>()
  private enrollmentTails = new Map<string, Promise<void>>()
  private end: (sessionId: string, reason?: string) => void
  private state: (bearer: string) => CredentialState
  private lastSign: (sessionId: string) => number | null
  private drop: (bearer: string) => void
  // Assigned in the body: Node's type-stripping loader rejects parameter properties.
  constructor(opts: {
    /** Ends a session at the surface; `reason` is what its next call is told (AgentSurface.revokeSession). */
    end(sessionId: string, reason?: string): void
    state(bearer: string): CredentialState
    /** The session's last call, or null (AgentSurface.sessionSign): what the cap evicts by. Absent: the mint time. */
    lastSign?(sessionId: string): number | null
    /** Revokes one bearer and nothing else (AgentSurface.revokeCredential): a rejoin bearer that was replaced. */
    drop?(bearer: string): void
  }) {
    this.end = opts.end
    this.state = opts.state
    this.lastSign = opts.lastSign ?? (() => null)
    this.drop = opts.drop ?? (() => {})
  }

  /** A pending row is registered before the grant re-read and journal so revocation can end it.
   *  Serialize admission per binding: a retry or hook must not borrow that row's bearer before
   *  those checks finish. Other bindings stay independent, and failures release the queue too. */
  async enrolling<T>(bindingId: string, attempt: () => Promise<T>): Promise<T> {
    const previous = this.enrollmentTails.get(bindingId) ?? Promise.resolve()
    let release!: () => void
    const tail = new Promise<void>((resolve) => { release = resolve })
    this.enrollmentTails.set(bindingId, tail)
    try {
      await previous
      return await attempt()
    } finally {
      release()
      if (this.enrollmentTails.get(bindingId) === tail) this.enrollmentTails.delete(bindingId)
    }
  }

  add(row: EnrolledSession): void {
    this.rows.set(row.sessionId, row)
  }

  /** Ends one session: its bearer is revoked at the surface and the row goes. */
  endSession(sessionId: string, reason?: string): void {
    this.rows.delete(sessionId)
    if (reason === undefined) this.end(sessionId)
    else this.end(sessionId, reason)
  }

  /** When a session last showed a sign of life: its last call, else its mint. */
  activityOf(row: EnrolledSession): number {
    return Math.max(row.mintedAt, this.lastSign(row.sessionId) ?? 0)
  }

  // #region session-rejoin-bearer — docs: docs/adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md#amendments
  /**
   * The bearer a rejoin hands out for a session (0.3.5 review iteration 2, ER-5): the one already minted while no client
   * has spent it, else a new one that replaces the spent one, so the hooks of a long session hold one bearer, not one
   * per turn. `mint` makes the new one; null when the session is not this process's.
   */
  rejoinBearer(sessionId: string, mint: () => string): string | null {
    const row = this.rows.get(sessionId)
    if (!row) return null
    const prev = row.rejoinBearer ?? null
    if (prev && this.state(prev) === 'unclaimed') return prev
    if (prev) this.drop(prev)
    const bearer = mint()
    row.rejoinBearer = bearer
    return bearer
  }
  // #endregion session-rejoin-bearer

  /** Ends every session minted under a binding; returns their ids. */
  endForBinding(bindingId: string): string[] {
    const ids = [...this.rows.values()].filter((r) => r.bindingId === bindingId).map((r) => r.sessionId)
    for (const id of ids) this.endSession(id)
    return ids
  }

  /** Ends every session minted under a grant; returns their ids. */
  endForGrant(grantId: string): string[] {
    const ids = [...this.rows.values()].filter((r) => r.grantId === grantId || (r.grantIds ?? []).includes(grantId)).map((r) => r.sessionId)
    for (const id of ids) this.endSession(id)
    return ids
  }

  /** A binding's sessions the surface still holds, oldest first; the rest are ended and forgotten. */
  liveOf(bindingId: string): Array<EnrolledSession & { state: 'unclaimed' | 'claimed' }> {
    const live: Array<EnrolledSession & { state: 'unclaimed' | 'claimed' }> = []
    for (const r of [...this.rows.values()]) {
      if (r.bindingId !== bindingId) continue
      const state = this.state(r.bearer)
      if (state === null) this.endSession(r.sessionId)
      else live.push({ ...r, state })
    }
    return live.sort((a, b) => a.mintedAt - b.mintedAt)
  }

  size(): number {
    return this.rows.size
  }

  /** The live session one runtime session of one binding enrolled in this project (D2), or null. */
  ofRuntime(bindingId: string, projectId: string, runtimeSessionId: string): (EnrolledSession & { state: 'unclaimed' | 'claimed' }) | null {
    return this.liveOf(bindingId).filter((r) => r.projectId === projectId && r.runtimeSessionId === runtimeSessionId).pop() ?? null
  }
}
// #endregion session-enroll-revocation

/** `binding` null: the door asks — the folder is resolved and the project named (`needs-grant`), never a session. */
export function enrollSession(binding: BindingRow | null, args: { cwd: unknown; runtimeSessionId?: unknown; rejoinOnly?: unknown }, deps: EnrollDeps): Promise<EnrollAnswer> {
  const attempt = () => enrollSessionOnce(binding, args, deps)
  return binding === null ? attempt() : deps.sessions.enrolling(binding.id, attempt)
}

async function enrollSessionOnce(binding: BindingRow | null, args: { cwd: unknown; runtimeSessionId?: unknown; rejoinOnly?: unknown }, deps: EnrollDeps): Promise<EnrollAnswer> {
  const folder = await resolveAgentFolder(args.cwd, deps)
  if (!folder.ok) return { ok: false, code: folder.code, message: folder.message }
  const runtimeSessionId = typeof args.runtimeSessionId === 'string' && RUNTIME_SESSION.test(args.runtimeSessionId) ? args.runtimeSessionId : null
  const projectName = folder.projectName ?? (await deps.projectName(folder.projectId)) ?? 'this project'
  // #region session-rejoin — docs: docs/adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md#amendments
  // D2 (fabric-agent-adapter#53): a short-lived fabric-mcp started by the session hooks joins the session its coding
  // agent already holds — a second bearer for the SAME session, under a grant still live — and otherwise is told so.
  // Never a request to the operator, never a new session: a hook that enrolled each turn would end the agent's own
  // session past the binding's cap.
  if (args.rejoinOnly === true) {
    const refuse: EnrollAnswer = { ok: false, code: 'no-session', message: NO_SESSION_MESSAGE }
    if (binding === null || runtimeSessionId === null) return refuse
    const held = deps.sessions.ofRuntime(binding.id, folder.projectId, runtimeSessionId)
    if (!held || !(await deps.stillLive(binding.id, held.grantId))) return refuse
    const token = deps.sessions.rejoinBearer(held.sessionId, () =>
      deps.mint(folder.projectId, held.sessionId, null, { cameIn: 'enrolled', agent: binding.agent_id, runtimeSessionId, rejoin: true, bindingId: binding.id }).token)
    if (!token) return refuse
    return { ok: true, session: { bearer: token, sessionId: held.sessionId, projectId: folder.projectId, projectName, how: folder.how } }
  }
  // #endregion session-rejoin
  const resource = `project:${folder.projectId}`
  const now = (deps.now ?? Date.now)()
  const needsGrant: EnrollAnswer = {
    ok: false, code: 'needs-grant', projectId: folder.projectId, projectName, resource,
    message: `Ask the operator once with fabric.access.request (callee ${FABRIC_SELF}, capability ${SESSION_ENROLL}, resource ${resource}, folder <this absolute folder>).`
  }
  const grant = binding === null ? undefined : (await deps.liveGrants(binding)).find(
    (g) => g.callee === FABRIC_SELF && g.capability === SESSION_ENROLL && g.resource === resource && g.revoked_at === null && Date.parse(g.expires_at) > now
  )
  if (!grant || binding === null) return needsGrant
  const session = (bearer: string, sessionId: string): EnrollAnswer => ({ ok: true, session: { bearer, sessionId, projectId: folder.projectId, projectName, how: folder.how } })

  // #region session-enroll-bound — docs: docs/adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md#amendments
  // An enrollment in a loop must not grow the surface or the journal: a bearer minted for this binding and project
  // that no client has spent yet is handed out again, and past the cap the binding's LEAST RECENTLY ACTIVE session
  // ends (0.3.5 review iteration 2, ER-4): by its last call, not its mint, so a long-running agent at work outlives the
  // short ones that already exited, and the one evicted is told why on its next call.
  // Board sessions have their own cap and cannot lend a coding session's bearer.
  const live = deps.sessions.liveOf(binding.id).filter((s) => s.surface !== 'board')
  // Unknown identities can retry each other as before, but never borrow a known runtime's
  // bearer. A different runtime would otherwise inherit its session while its own hooks fail to rejoin.
  const spare = live.find((s) => s.state === 'unclaimed' && s.projectId === folder.projectId &&
    s.grantId === grant.id && s.runtimeSessionId === runtimeSessionId)
  if (spare) return session(spare.bearer, spare.sessionId)
  const cap = Math.max(1, deps.maxSessionsPerBinding ?? MAX_ENROLLED_PER_BINDING)
  const byActivity = live.map((s) => ({ s, at: deps.sessions.activityOf(s) })).sort((a, b) => a.at - b.at)
  for (const { s: old, at } of byActivity.slice(0, Math.max(0, live.length - cap + 1))) {
    deps.sessions.endSession(old.sessionId, evictedReason(cap))
    ops.record({ op: 'hub.session.enroll-evicted', outcome: 'ok', level: 'info', detail: { binding_id: binding.id, session_id: old.sessionId, cap, idle_s: Math.max(0, Math.round((now - at) / 1000)) }, ctx: { correlationId: ops.correlate() } })
  }
  // #endregion session-enroll-bound

  const sessionId = randomUUID()
  const { token } = deps.mint(folder.projectId, sessionId, null, { cameIn: 'enrolled', agent: binding.agent_id, runtimeSessionId, bindingId: binding.id })
  // Registered before the re-read: a revocation from now on ends it through its listener, one before it is seen below.
  deps.sessions.add({ sessionId, bearer: token, bindingId: binding.id, grantId: grant.id, projectId: folder.projectId, mintedAt: now, runtimeSessionId })
  try {
    if (!(await deps.stillLive(binding.id, grant.id))) {
      deps.sessions.endSession(sessionId)
      return needsGrant
    }
    await deps.journal('session.enrolled@1', folder.projectId, {
      session_id: sessionId,
      runner: binding.agent_id,
      binding_id: binding.id,
      grant_id: grant.id,
      how: folder.how,
      // The folder is the person's; the journal keeps a digest, enough to tell two folders apart.
      cwd_sha256: createHash('sha256').update(folder.real, 'utf8').digest('hex'),
      ...(runtimeSessionId ? { runtime_session_id: runtimeSessionId } : {})
    })
  } catch (e) {
    // A session the journal does not know of (or whose grant could not be read again) must not stay usable.
    deps.sessions.endSession(sessionId)
    throw e
  }
  return session(token, sessionId)
}
// #endregion session-enroll

// #region board-join-session — docs: docs/adr/0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md#amendments
/** Live board sessions one binding may hold; a further join ends the least recently active one (wave-2 fix 11). */
export const MAX_BOARD_SESSIONS_PER_BINDING = 4

/** What an evicted board session's next call is told: the true reason, in the tools a board session has. */
export const boardEvictedReason = (cap: number): string =>
  `this board session was ended to make room: this agent's access reached its limit of ${cap} board sessions, and this one was the least recently active. ` +
  'Its responder slots were released — join again with fabric.board.join, then take the slot again with com.enroll'

export type BoardJoinAnswer =
  | { ok: true; session: { bearer: string; sessionId: string; projectId: string; capabilities: string[] } }
  | { ok: false; code: string; message: string }

export interface BoardJoinDeps {
  /** The board's join check (`board_join_check`): the capabilities and grants this binding answers for on the Project. */
  check(bindingId: string, projectId: string): Promise<{ capabilities: string[]; grants: string[] } | { error: { code: string; message: string } }>
  /** The binding's live grants, for their expiry (a grant that expires fires no revocation). */
  liveGrants(binding: BindingRow): Promise<GrantRow[]>
  /** The board-session mint (`AgentSurface.mint` with a board origin). */
  mint(projectId: string, sessionId: string, taskId: null, origin: { cameIn: 'hub'; agent: string; bindingId: string; surface: 'board'; authorityUntil: number | null }): { token: string }
  sessions: EnrolledSessions
  /** Read again after the mint: the binding and each grant are still live (ADR-0134's read-then-mint). */
  stillLive(bindingId: string, grantId: string): Promise<boolean>
  maxBoardSessionsPerBinding?: number
  now?: () => number
}

/**
 * `fabric.board.join` (ADR-0149 §4) with the safeguards `enrollSession` has (ADR-0134 §3 and its amendments): the
 * board's own check first; an unspent bearer for this binding, Project and grant set handed out again; a cap of the
 * binding's BOARD sessions, the least recently active ending with a reason in a board session's own tools; the mint,
 * registered before the grants are read again, so a revocation that landed in between ends it; and the grants'
 * earliest expiry carried by the session, which ends at its first call past it.
 */
export async function joinBoardSession(binding: BindingRow, args: { projectId: string }, deps: BoardJoinDeps): Promise<BoardJoinAnswer> {
  // Share coding enrollment's binding queue: an in-flight board mint is not a
  // reusable bearer until its grant checks finish, and cap checks must be atomic.
  return deps.sessions.enrolling(binding.id, () => joinBoardSessionOnce(binding, args, deps))
}

async function joinBoardSessionOnce(binding: BindingRow, args: { projectId: string }, deps: BoardJoinDeps): Promise<BoardJoinAnswer> {
  const checked = await deps.check(binding.id, args.projectId)
  if ('error' in checked) return { ok: false, code: checked.error.code, message: checked.error.message }
  const grants = [...checked.grants].sort()
  const now = (deps.now ?? Date.now)()
  const answer = (bearer: string, sessionId: string): BoardJoinAnswer => ({ ok: true, session: { bearer, sessionId, projectId: args.projectId, capabilities: checked.capabilities } })
  const live = deps.sessions.liveOf(binding.id).filter((s) => s.surface === 'board')
  const same = (s: EnrolledSession) => JSON.stringify([...(s.grantIds ?? [s.grantId])].sort()) === JSON.stringify(grants)
  const spare = live.find((s) => s.state === 'unclaimed' && s.projectId === args.projectId && same(s))
  if (spare) return answer(spare.bearer, spare.sessionId)
  const cap = Math.max(1, deps.maxBoardSessionsPerBinding ?? MAX_BOARD_SESSIONS_PER_BINDING)
  const byActivity = live.map((s) => ({ s, at: deps.sessions.activityOf(s) })).sort((a, b) => a.at - b.at)
  for (const { s: old, at } of byActivity.slice(0, Math.max(0, live.length - cap + 1))) {
    deps.sessions.endSession(old.sessionId, boardEvictedReason(cap))
    ops.record({ op: 'hub.board.join-evicted', outcome: 'ok', level: 'info', detail: { binding_id: binding.id, session_id: old.sessionId, cap, idle_s: Math.max(0, Math.round((now - at) / 1000)) }, ctx: { correlationId: ops.correlate() } })
  }
  // The earliest expiry of the grants it came in under: past it the session ends at its next call (AgentSurface).
  const expiries = (await deps.liveGrants(binding)).filter((g) => grants.includes(g.id)).map((g) => Date.parse(g.expires_at)).filter(Number.isFinite)
  const authorityUntil = expiries.length > 0 ? Math.min(...expiries) : null
  const sessionId = randomUUID()
  const { token } = deps.mint(args.projectId, sessionId, null, { cameIn: 'hub', agent: binding.agent_id, bindingId: binding.id, surface: 'board', authorityUntil })
  // Registered before the re-read: a revocation from now on ends it through its listener, one before it is seen below.
  deps.sessions.add({ sessionId, bearer: token, bindingId: binding.id, grantId: grants[0] ?? '', grantIds: grants, projectId: args.projectId, mintedAt: now, surface: 'board' })
  try {
    for (const g of grants) {
      if (!(await deps.stillLive(binding.id, g))) {
        deps.sessions.endSession(sessionId)
        return { ok: false, code: 'authority_changed', message: 'The operator\'s grants changed while this session was joining; nothing was started. Join again.' }
      }
    }
  } catch (e) {
    // A grant that could not be read again must not leave a usable session behind.
    deps.sessions.endSession(sessionId)
    throw e
  }
  return answer(token, sessionId)
}
// #endregion board-join-session

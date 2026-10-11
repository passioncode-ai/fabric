// #region session-enroll — docs: docs/adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md#decision
// `fabric.session.enroll` (ADR-0134 §2): a coding agent that holds a binding credential names its folder; Fabric
// resolves the folder to a project (ADR-0136) and, only when the binding holds a live `session.enroll` grant on
// that project, mints a session exactly as for a session Fabric launched — one bearer, one project, no task — and
// journals `session.enrolled@1`. Every other outcome is a typed answer the caller can act on, never a throw.
import { createHash, randomUUID } from 'node:crypto'
import path from 'node:path'
import { FABRIC_SELF, SESSION_ENROLL } from '../shared/access.ts'
import type { BindingRow, GrantRow } from './accessStore.ts'
import { resolveProjectForFolder, type AdmittedFolder } from './folderResolver.ts'
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
  /** The real path of a folder, or null when it does not exist. */
  realpath(folder: string): string | null
  /** The worktree probe (`folderResolver.ts#gitCommonDir`, asynchronous and bounded) — injected in tests. */
  gitCommonDir?: (folder: string) => Promise<string | null> | string | null
}

export interface EnrollDeps extends FolderDeps {
  /** The binding's live (unrevoked, unexpired) grants. */
  liveGrants(binding: BindingRow): Promise<GrantRow[]>
  projectName(projectId: string): Promise<string | null>
  /** The same mint a launched session gets (`AgentSurface.mint`), told it is an enrollment and by which runner. */
  mint(projectId: string, sessionId: string, taskId: null, origin: { cameIn: 'enrolled'; agent: string; runtimeSessionId: string | null }): { token: string }
  /** The enrolled sessions this process minted, by binding and grant: what a revocation ends. */
  sessions: EnrolledSessions
  /** Read again after the mint: the binding and the grant are both still live (the read-then-mint race). */
  stillLive(bindingId: string, grantId: string): Promise<boolean>
  journal(type: 'session.enrolled@1', projectId: string, payload: Record<string, unknown>): Promise<unknown>
  /** Live enrolled sessions one binding may hold; a further enrollment ends the oldest. Default 8. */
  maxSessionsPerBinding?: number
  now?: () => number
}

const RUNTIME_SESSION = /^[A-Za-z0-9._:-]{1,128}$/
/** Several terminals of one coding agent in one project are ordinary; a loop is not. */
export const MAX_ENROLLED_PER_BINDING = 8

export const NO_PROJECT_MESSAGE =
  'This folder is not a project in Fabric yet. Open it in Fabric (+ Project → Open a project), then start the agent again.'

export type FolderFact =
  | { ok: true; real: string; projectId: string; how: 'exact' | 'ancestor' | 'worktree'; root: string }
  | { ok: false; code: 'bad-folder' | 'no-project'; message: string }

/** A folder an agent names, as Fabric resolves it itself: absolute, existing (its real path), held by a project. The
 *  one resolution behind both the enrollment and the enrollment ask, so the prompt shows Fabric's fact. */
export async function resolveAgentFolder(folder: unknown, deps: FolderDeps): Promise<FolderFact> {
  if (typeof folder !== 'string' || !path.isAbsolute(folder)) return { ok: false, code: 'bad-folder', message: 'cwd must be the absolute folder the agent runs in' }
  const real = deps.realpath(folder)
  if (!real) return { ok: false, code: 'bad-folder', message: 'that folder does not exist on this computer' }
  const match = await resolveProjectForFolder(real, await deps.admittedFolders(), deps.gitCommonDir)
  if (!match.projectId) return { ok: false, code: 'no-project', message: NO_PROJECT_MESSAGE }
  return { ok: true, real, projectId: match.projectId, how: match.how as 'exact' | 'ancestor' | 'worktree', root: match.root as string }
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
}

/**
 * The enrolled sessions of this process, by binding and grant (ADR-0134 §3: a revoked grant refuses the next call).
 * A revocation of the binding or of the grant ends every session minted under it — at the surface, so the bearer is
 * refused on its next request — and a row whose bearer the surface no longer holds is dropped when it is next read.
 */
export class EnrolledSessions {
  private rows = new Map<string, EnrolledSession>()
  private end: (sessionId: string) => void
  private state: (bearer: string) => CredentialState
  // Assigned in the body: Node's type-stripping loader rejects parameter properties.
  constructor(opts: { end(sessionId: string): void; state(bearer: string): CredentialState }) {
    this.end = opts.end
    this.state = opts.state
  }

  add(row: EnrolledSession): void {
    this.rows.set(row.sessionId, row)
  }

  /** Ends one session: its bearer is revoked at the surface and the row goes. */
  endSession(sessionId: string): void {
    this.rows.delete(sessionId)
    this.end(sessionId)
  }

  /** Ends every session minted under a binding; returns their ids. */
  endForBinding(bindingId: string): string[] {
    const ids = [...this.rows.values()].filter((r) => r.bindingId === bindingId).map((r) => r.sessionId)
    for (const id of ids) this.endSession(id)
    return ids
  }

  /** Ends every session minted under a grant; returns their ids. */
  endForGrant(grantId: string): string[] {
    const ids = [...this.rows.values()].filter((r) => r.grantId === grantId).map((r) => r.sessionId)
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
export async function enrollSession(binding: BindingRow | null, args: { cwd: unknown; runtimeSessionId?: unknown; rejoinOnly?: unknown }, deps: EnrollDeps): Promise<EnrollAnswer> {
  const folder = await resolveAgentFolder(args.cwd, deps)
  if (!folder.ok) return { ok: false, code: folder.code, message: folder.message }
  const runtimeSessionId = typeof args.runtimeSessionId === 'string' && RUNTIME_SESSION.test(args.runtimeSessionId) ? args.runtimeSessionId : null
  const projectName = (await deps.projectName(folder.projectId)) ?? 'this project'
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
    const { token } = deps.mint(folder.projectId, held.sessionId, null, { cameIn: 'enrolled', agent: binding.agent_id, runtimeSessionId })
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
  // that no client has spent yet is handed out again, and past the cap the oldest session of the binding ends.
  const live = deps.sessions.liveOf(binding.id)
  const spare = live.find((s) => s.state === 'unclaimed' && s.projectId === folder.projectId && s.grantId === grant.id)
  if (spare) return session(spare.bearer, spare.sessionId)
  const cap = Math.max(1, deps.maxSessionsPerBinding ?? MAX_ENROLLED_PER_BINDING)
  for (const old of live.slice(0, Math.max(0, live.length - cap + 1))) {
    deps.sessions.endSession(old.sessionId)
    ops.record({ op: 'hub.session.enroll-evicted', outcome: 'ok', level: 'info', detail: { binding_id: binding.id, session_id: old.sessionId, cap }, ctx: { correlationId: ops.correlate() } })
  }
  // #endregion session-enroll-bound

  const sessionId = randomUUID()
  const { token } = deps.mint(folder.projectId, sessionId, null, { cameIn: 'enrolled', agent: binding.agent_id, runtimeSessionId })
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

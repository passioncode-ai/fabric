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

export type EnrollAnswer =
  | { ok: true; session: { bearer: string; sessionId: string; projectId: string; projectName: string; how: string } }
  | { ok: false; code: 'needs-grant'; projectId: string; projectName: string; resource: string; message: string }
  | { ok: false; code: 'no-project'; message: string }
  | { ok: false; code: 'bad-folder'; message: string }

export interface EnrollDeps {
  /** The binding's live (unrevoked, unexpired) grants. */
  liveGrants(binding: BindingRow): Promise<GrantRow[]>
  /** Every admitted folder of the estate, with its project. */
  admittedFolders(): Promise<AdmittedFolder[]>
  projectName(projectId: string): Promise<string | null>
  /** The real path of a folder, or null when it does not exist. */
  realpath(folder: string): string | null
  /** The same mint a launched session gets (`AgentSurface.mint`). */
  mint(projectId: string, sessionId: string, taskId: null): { token: string }
  journal(type: 'session.enrolled@1', projectId: string, payload: Record<string, unknown>): Promise<unknown>
  gitCommonDir?: (folder: string) => string | null
  now?: () => number
}

const RUNTIME_SESSION = /^[A-Za-z0-9._:-]{1,128}$/

/** `binding` null: the door asks — the folder is resolved and the project named (`needs-grant`), never a session. */
export async function enrollSession(binding: BindingRow | null, args: { cwd: unknown; runtimeSessionId?: unknown }, deps: EnrollDeps): Promise<EnrollAnswer> {
  if (typeof args.cwd !== 'string' || !path.isAbsolute(args.cwd)) return { ok: false, code: 'bad-folder', message: 'cwd must be the absolute folder the agent runs in' }
  const real = deps.realpath(args.cwd)
  if (!real) return { ok: false, code: 'bad-folder', message: 'that folder does not exist on this Mac' }
  const runtimeSessionId = typeof args.runtimeSessionId === 'string' && RUNTIME_SESSION.test(args.runtimeSessionId) ? args.runtimeSessionId : null
  const match = resolveProjectForFolder(real, await deps.admittedFolders(), deps.gitCommonDir)
  if (!match.projectId)
    return { ok: false, code: 'no-project', message: 'This folder is not a project in Fabric yet. Open it in Fabric (+ New → Open a project), then start the agent again.' }
  const projectName = (await deps.projectName(match.projectId)) ?? 'this project'
  const resource = `project:${match.projectId}`
  const now = (deps.now ?? Date.now)()
  const grant = binding === null ? undefined : (await deps.liveGrants(binding)).find(
    (g) => g.callee === FABRIC_SELF && g.capability === SESSION_ENROLL && g.resource === resource && g.revoked_at === null && Date.parse(g.expires_at) > now
  )
  if (!grant || binding === null)
    return {
      ok: false, code: 'needs-grant', projectId: match.projectId, projectName, resource,
      message: `Ask the operator once with fabric.access.request (callee ${FABRIC_SELF}, capability ${SESSION_ENROLL}, resource ${resource}).`
    }
  const sessionId = randomUUID()
  const { token } = deps.mint(match.projectId, sessionId, null)
  await deps.journal('session.enrolled@1', match.projectId, {
    session_id: sessionId,
    runner: binding.agent_id,
    binding_id: binding.id,
    grant_id: grant.id,
    how: match.how,
    // The folder is the person's; the journal keeps a digest, enough to tell two folders apart.
    cwd_sha256: createHash('sha256').update(real, 'utf8').digest('hex'),
    ...(runtimeSessionId ? { runtime_session_id: runtimeSessionId } : {})
  })
  return { ok: true, session: { bearer: token, sessionId, projectId: match.projectId, projectName, how: match.how } }
}
// #endregion session-enroll

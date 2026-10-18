// #region folder-attribution-act — docs: docs/adr/0164-a-folder-with-no-project-is-attributed-by-fabric-never-handed-to-the-person.md#decision
// The act behind ADR-0164: a folder no project holds is attached to the project `decideAttribution` names, or made a
// new project, by Fabric's main process — not by a window — and journalled as the asking agent's act, with the cause,
// so История lists it and its inverse undoes it (detach: `project.repo.detached@1`; a made project: detach and
// `project.archived@1`; nothing is deleted). One attribution at a time, resolving again first, so two agents starting
// in one new folder make one project.
import path from 'node:path'
import {
  decideAttribution,
  resolveProjectForFolder,
  type AdmittedFolder,
  type AttributionCause,
  type AttributionProbes,
  type AttributionRefusal
} from './folderResolver.ts'

/** Who asks: the coding agent's runner (null when it named none), how it came (a binding credential or the hub's
 *  door), its binding and its own session id when known, and the projects it already holds a live grant on. */
export interface Asker {
  runner: string | null
  via: 'binding' | 'door'
  bindingId: string | null
  runtimeSessionId: string | null
  projects: readonly string[]
}

export type Attributed =
  /** `already`: another attribution, or the operator, put the folder in a project while this one waited its turn. */
  | { ok: true; projectId: string; root: string; cause: AttributionCause | 'already'; created: boolean }
  | { ok: false; reason: AttributionRefusal; message: string }

export interface AttributionDeps {
  admittedFolders(): Promise<AdmittedFolder[]>
  probes: AttributionProbes
  /** One journal append; a refusal throws. */
  journal(e: { type: 'project.created@1' | 'project.repo.attached@1'; actor: { kind: 'agent'; id: string }; projectId: string; payload: Record<string, unknown> }): Promise<unknown>
  newId(): string
  /** Projects that may take a folder: not archived. Absent, every project. */
  joinable?(): Promise<(projectId: string) => boolean>
  /** After a folder was attached or a project made: the file roots, the git watch and the workspace mirror. */
  changed?(): Promise<void> | void
}

/** The actor of an agent that named no runner. */
export const UNNAMED_AGENT = 'coding-agent'

export function createFolderAttribution(deps: AttributionDeps): (real: string, asker: Asker) => Promise<Attributed> {
  let tail: Promise<unknown> = Promise.resolve()
  const once = async (real: string, asker: Asker): Promise<Attributed> => {
    const rows = await deps.admittedFolders()
    const now = await resolveProjectForFolder(real, rows, deps.probes.commonDir)
    if (now.projectId) return { ok: true, projectId: now.projectId, root: now.root, cause: 'already', created: false }
    const d = await decideAttribution(real, rows, asker.projects, deps.probes, deps.joinable ? await deps.joinable() : undefined)
    if (d.act === 'refuse') return { ok: false, reason: d.reason, message: d.message }
    const actor = { kind: 'agent' as const, id: asker.runner ?? UNNAMED_AGENT }
    const attributed = {
      cause: d.cause,
      runner: asker.runner,
      via: asker.via,
      binding_id: asker.bindingId,
      runtime_session_id: asker.runtimeSessionId,
      remote_key: d.remoteKey
    }
    let projectId: string
    if (d.act === 'create') {
      projectId = deps.newId()
      await deps.journal({
        type: 'project.created@1', actor, projectId,
        payload: {
          id: projectId, name: d.name, purpose: null, repo_path: null, memory_backend: 'local',
          // The runner that made it is the project's agent; with none named, Fabric's own default stands.
          ...(asker.runner ? { default_agent: asker.runner } : {}),
          attributed
        }
      })
    } else projectId = d.projectId
    await deps.journal({
      type: 'project.repo.attached@1', actor, projectId,
      payload: { id: deps.newId(), path: d.root, label: path.basename(d.root) || d.root, ...(d.act === 'create' ? { is_primary: true } : {}), attributed }
    })
    await deps.changed?.()
    return { ok: true, projectId, root: d.root, cause: d.cause, created: d.act === 'create' }
  }
  return (real, asker) => {
    const run = tail.then(() => once(real, asker))
    // A failed attribution is the caller's to report; the next one still runs.
    tail = run.catch(() => undefined)
    return run
  }
}
// #endregion folder-attribution-act

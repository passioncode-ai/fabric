// #region project-admission — docs: docs/adr/0136-a-folder-joins-a-project-by-a-pick-or-by-consent.md#decision
// The one main-process admission path for a Project and its repositories. IPC and agent enrollment call this service;
// no Electron event is needed. Every write is a Fabric journal event with the actor that caused it, and retries reuse
// the same project/repository identity instead of creating siblings.
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import type { CreateProjectInput, ProjectRow } from '../shared/types.ts'
import { projectNameProblem } from '../shared/startPaths.ts'
import type { FolderFacts } from '../shared/startPaths.ts'
import { inspectFolder } from './projectDiscovery.ts'
import { ScanCandidates, admitRepoPaths, refuseHeldByOther } from './startChoices.ts'
import { normalizeRemoteKey, type DetachedFolder } from './folderResolver.ts'

export interface AdmissionRepo {
  id: string
  project_id: string
  path: string
  label: string | null
  is_primary: boolean
  attached_at: string
  remote_key?: string | null
  kind?: 'primary' | 'checkout' | 'worktree' | null
}

export interface EnrollmentFolderFact {
  ok: true
  real: string
  projectId: string
  projectName?: string
  how: string
  root: string
  candidate?: 'create' | 'attach'
  remoteKey?: string | null
}

export interface AdmissionActor {
  kind: 'person' | 'agent' | 'system'
  id: string
}

export interface AdmissionReach {
  granted: (folder: string, scope: string) => string
  candidates: ScanCandidates
  home?: string
}

export interface ProjectAdmissionDeps {
  estateId: string
  append(event: {
    estateId: string
    type: 'project.created@1' | 'project.repo.attached@1' | 'project.repo.detached@1'
    actor: AdmissionActor
    projectId?: string
    payload: Record<string, unknown>
  }): Promise<unknown>
  readProject(projectId: string): Promise<ProjectRow | null>
  listRepos(projectId: string): Promise<AdmissionRepo[]>
  readImported(): Promise<ReadonlyMap<string, readonly { id: string; name: string }[]>>
  listRemovals(): Promise<DetachedFolder[]>
  refresh(): Promise<void>
  mirror?(): void
  inspect?(folder: string): Promise<FolderFacts>
  home?: string
}

export function createProjectAdmission(deps: ProjectAdmissionDeps) {
  const inspect = deps.inspect ?? inspectFolder

  async function checkedPaths(projectId: string, paths: unknown, reach: AdmissionReach, scope: string): Promise<string[]> {
    const admitted = admitRepoPaths(paths, scope, reach)
    if (admitted.length) refuseHeldByOther(admitted, projectId, await deps.readImported())
    return admitted
  }

  async function attach(projectId: string, paths: string[], actor: AdmissionActor, reach: AdmissionReach, scope = `agent:${actor.id}`): Promise<void> {
    const checked = await checkedPaths(projectId, paths, reach, scope)
    const rows = await deps.listRepos(projectId)
    const existing = new Set(rows.map((r) => r.path))
    let hasPrimary = rows.some((r) => r.is_primary)
    for (const raw of checked) {
      const folder = raw.trim()
      if (!folder || existing.has(folder)) continue
      existing.add(folder)
      const facts = await inspect(folder)
      const kind = facts.kind === 'worktree' ? 'worktree' : hasPrimary ? 'checkout' : 'primary'
      await deps.append({
        estateId: deps.estateId,
        type: 'project.repo.attached@1',
        actor,
        projectId,
        payload: {
          id: randomUUID(),
          path: folder,
          label: path.basename(folder),
          remote_key: normalizeRemoteKey(facts.remote),
          kind,
          admitted_by: actor.kind === 'agent' ? 'agent' : 'operator'
        }
      })
      if (kind === 'primary') hasPrimary = true
    }
    await deps.refresh()
  }

  async function create(input: CreateProjectInput, actor: AdmissionActor, reach: AdmissionReach, scope = `agent:${actor.id}`): Promise<ProjectRow> {
    const nameProblem = projectNameProblem(input?.name)
    if (nameProblem) throw new Error(`project-name-refused:${nameProblem}`)
    const name = (input.name as string).trim()
    const id = input.id
    if (!id) throw new Error('a project needs an id chosen by the caller')
    const repoPaths = await checkedPaths(id, input.repoPaths, reach, scope)
    const already = await deps.readProject(id)
    if (already) {
      if (repoPaths.length) await attach(id, repoPaths, actor, reach, scope)
      else await deps.refresh()
      const current = await deps.readProject(id)
      if (!current) throw new Error('the existing project could not be read after admission')
      return current
    }
    await deps.append({
      estateId: deps.estateId,
      type: 'project.created@1',
      actor,
      projectId: id,
      payload: {
        id,
        name,
        purpose: input.purpose?.trim() || null,
        repo_path: null,
        memory_backend: input.memoryBackend ?? 'local',
        default_agent: input.defaultAgent ?? 'claude-code'
      }
    })
    if (repoPaths.length) await attach(id, repoPaths, actor, reach, scope)
    else await deps.refresh()
    deps.mirror?.()
    const current = await deps.readProject(id)
    if (!current) throw new Error('the new project could not be read after admission')
    return current
  }

  async function detach(projectId: string, repoId: string, actor: AdmissionActor): Promise<void> {
    const row = (await deps.listRepos(projectId)).find((r) => r.id === repoId)
    await deps.append({
      estateId: deps.estateId,
      type: 'project.repo.detached@1',
      actor,
      projectId,
      payload: {
        id: repoId,
        ...(row?.path ? { path: row.path } : {}),
        ...(row?.remote_key ? { remote_key: row.remote_key } : {}),
        ...(row?.kind ? { kind: row.kind } : {})
      }
    })
    await deps.refresh()
  }

  async function enroll(folder: EnrollmentFolderFact, agentId: string): Promise<ProjectRow> {
    const actor: AdmissionActor = { kind: 'agent', id: agentId }
    const project = await deps.readProject(folder.projectId)
    if (project?.status === 'archived') throw new Error(`project-admission-refused:archived: ${folder.projectId}`)
    if (!folder.candidate) {
      if (!project) throw new Error(`project-admission-refused:unknown-project: ${folder.projectId}`)
      return project
    }
    const facts = await inspect(folder.real)
    // A plain folder may become its own project (the operator, 2026-10-18: «добавление всегда авто»); only a
    // repository is ever attached to a project that exists, because a plain folder has nothing to match it by.
    if (!facts.git && folder.candidate !== 'create') throw new Error(`project-admission-refused:not-git: ${folder.real}`)
    // ADR-0166 §3: the tombstone is the detached folder's; another clone of its remote may still be attached.
    const paths = new Set(folder.candidate === 'attach' ? [folder.real] : [folder.real, folder.root])
    const removed = (await deps.listRemovals()).some((row) => row.path && paths.has(row.path))
    if (removed) throw new Error(`project-admission-refused:detached: ${folder.real}`)

    const scope = `agent:${agentId}`
    const reach: AdmissionReach = {
      granted: (real) => real,
      candidates: new ScanCandidates({ home: deps.home }),
      ...(deps.home ? { home: deps.home } : {})
    }
    if (folder.candidate === 'create') {
      const name = folder.projectName ?? facts.name
      const problem = projectNameProblem(name)
      if (problem) throw new Error(`project-name-refused:${problem}`)
      return create({ id: folder.projectId, name, repoPaths: [folder.root] }, actor, reach, scope)
    }
    if (!project) throw new Error(`project-admission-refused:unknown-project: ${folder.projectId}`)
    await attach(folder.projectId, [folder.real], actor, reach, scope)
    const current = await deps.readProject(folder.projectId)
    if (!current) throw new Error('the project could not be read after repository admission')
    return current
  }

  return { create, attach, detach, enroll }
}

// #endregion project-admission

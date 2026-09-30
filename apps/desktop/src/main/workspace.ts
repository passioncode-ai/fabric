// Writing the workspace (M118, ADR-0002).
//
// `mirror.ts` decides WHAT the declared layer looks like and holds the rules
// that make it worth having. This file does the two things that touch the world:
// it reads the estate out of the store, and it puts the bytes on disk.
//
// WHAT IT DOES NOT DO IS COMMIT. Fabric writes the files and, if the operator
// accepted it, initialises the repository. Committing is theirs, because a
// commit is a claim that somebody looked — and a product that commits for you
// produces a history in which no line was ever reviewed, which is a worse lie
// than having no history at all. Declining git is a supported answer and the
// product says plainly what is then absent.

import type { ScopedStore } from './scopedStore.ts'
import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { compareMirror, mirrorEstate, parseMirror, type Divergence, type Estate, type Mirror } from '../shared/mirror.ts'
import { createHash } from 'node:crypto'
import { atomicWrite } from './localState.ts'
import {
  checkGeneration,
  declaredCoverage,
  restorability,
  type GenerationCheck,
  planImport,
  type ImportPlan,
  MIRROR_SCHEMA_VERSION,
  type MirrorManifest
} from '../shared/storageContract.ts'

/** Where the generation marker lives. Beside the files it names, so carrying the
 *  folder carries the proof of what was in it. */
const MANIFEST = 'workspace/manifest.json'

const digest = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex')

const run = promisify(execFile)

/** Read the declared layer. The SELECTS are narrow on purpose: `mirror.ts` names
 *  its fields, and asking the database for fewer of them means a widened select
 *  cannot quietly become a widened mirror either. */
export async function readEstate(store: ScopedStore): Promise<Estate> {
  const [projects, agents] = await Promise.all([
    store
      .select('projects', 'id,name,purpose,repo_path,status,memory_backend,default_agent,mcp_servers'),
    store
      .select('agent_bindings', 'id,project_id,role,provider_ref,instructions,mcp_servers,permission_mode')
      .not('instructions', 'is', null)
  ])
  if (projects.error) throw new Error(`workspace: projects unreadable — ${projects.error.message}`)
  if (agents.error) throw new Error(`workspace: agents unreadable — ${agents.error.message}`)
  return {
    projects: (projects.data ?? []).map((p) => ({
      id: p.id as string,
      name: p.name as string,
      purpose: (p.purpose as string | null) ?? null,
      repo_path: (p.repo_path as string | null) ?? null,
      status: p.status as string,
      memory_backend: p.memory_backend as string,
      default_agent: p.default_agent as string,
      mcp_servers: (p.mcp_servers as string[] | null) ?? []
    })),
    agents: (agents.data ?? []).map((a) => ({
      id: a.id as string,
      project_id: a.project_id as string,
      name: a.role as string,
      runner_id: a.provider_ref as string,
      instructions: (a.instructions as string | null) ?? '',
      mcp_servers: (a.mcp_servers as string[] | null) ?? [],
      permission_mode: (a.permission_mode as string | null) ?? null
    }))
  }
}

/** Put the mirror on disk. Returns what it wrote, or null when there is no
 *  workspace — declining git is a supported answer, not a failure. */
export async function writeWorkspace(
  root: string | null,
  store: ScopedStore
): Promise<string[] | null> {
  if (!root) return null
  const estate = await readEstate(store)
  const files = mirrorEstate(estate)
  const written: string[] = []
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(root, rel)
    mkdirSync(path.dirname(abs), { recursive: true })
    // Only when it CHANGED. An unconditional write updates mtimes on every
    // event, which makes a file watcher fire and a backup tool copy for nothing.
    if (existsSync(abs) && readFileSync(abs, 'utf8') === text) continue
    // Atomic, and the SAME atomic write the local state uses — temp beside the
    // target, fsync, rename. A half-written projects.yaml is not a divergence
    // an operator caused, and telling those apart is the whole point of the
    // manifest below.
    atomicWrite(abs, text, abs + '.tmp')
    written.push(rel)
  }

  // THE MANIFEST GOES LAST, and that ordering is the mechanism. Every file it
  // names is already on the device, so a manifest whose hashes match is proof
  // that one generation completed. Written first, it would name bytes that may
  // never have landed.
  const manifest: MirrorManifest = {
    format: 'fabric-declared-mirror',
    schemaVersion: 2,
    estateId: store.scope.estateId,
    generatedAt: new Date().toISOString(),
    coverage: declaredCoverage(),
    files: Object.entries(files).map(([rel, text]) => ({
      path: rel,
      sha256: digest(text),
      bytes: Buffer.byteLength(text, 'utf8')
    })),
    counts: { projects: estate.projects.length, agent_bindings: estate.agents.length },
    contentDigest: digest(
      Object.entries(files)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([rel, text]) => `${rel}:${digest(text)}`)
        .join('\n')
    )
  }
  // NOT ON EVERY EVENT. `generatedAt` differs every time, so writing the
  // manifest unconditionally rewrites it on every append — a file watcher fires
  // and a backup tool copies for a generation that did not change. The digest
  // is what decides, because it is what the manifest is FOR.
  const manifestAbs = path.join(root, MANIFEST)
  if (readManifest(root)?.contentDigest !== manifest.contentDigest) {
    atomicWrite(manifestAbs, JSON.stringify(manifest, null, 2) + '\n', manifestAbs + '.tmp')
    written.push(MANIFEST)
  }
  return written
}

/** The manifest on disk, or null where a workspace predates it. */
export function readManifest(root: string): MirrorManifest | null {
  const abs = path.join(root, MANIFEST)
  if (!existsSync(abs)) return null
  try {
    const parsed = JSON.parse(readFileSync(abs, 'utf8')) as MirrorManifest
    if (parsed.format !== 'fabric-declared-mirror') return null
    // AND THE VERSION IT DECLARES, which nothing checked until AX-04. The field
    // was written on every generation and read by NOBODY — found by the fence
    // built two iterations ago, and it is the same defect this card is about in
    // a second place: a manifest from a build that changed what the files MEAN
    // was accepted as a generation marker of this one, so `checkGeneration`
    // would compare today's expectations against yesterday's semantics and
    // report `current`.
    if (parsed.schemaVersion !== MIRROR_SCHEMA_VERSION) return null
    return parsed
  } catch {
    // A manifest that will not parse is not a generation marker. Saying
    // `unknown` is the honest answer; guessing `current` would assert a
    // completed write nobody can see the record of.
    return null
  }
}

/**
 * Did Fabric's last write to this folder finish, and has it been touched since?
 *
 * Separate from `checkWorkspace`, which compares the folder to the ESTATE. This
 * compares the folder to what Fabric last claimed to write, and the two answer
 * different questions: one finds an operator's edit, the other finds an
 * interrupted generation. Before the manifest they were the same answer.
 */
export function checkGenerationOnDisk(root: string): GenerationCheck {
  const manifest = readManifest(root)
  if (!manifest) return checkGeneration(null, {})
  const onDisk: Record<string, { sha256: string } | undefined> = {}
  for (const f of manifest.files) {
    const abs = path.join(root, f.path)
    if (existsSync(abs)) onDisk[f.path] = { sha256: digest(readFileSync(abs, 'utf8')) }
  }
  return checkGeneration(manifest, onDisk)
}

/** Read back what is on disk, so the estate can be compared with it. */
export function readWorkspace(root: string): Mirror {
  const out: Mirror = {}
  for (const rel of ['workspace/projects.yaml', 'workspace/agents.yaml']) {
    const abs = path.join(root, rel)
    if (existsSync(abs)) out[rel] = readFileSync(abs, 'utf8')
  }
  return out
}

export async function checkWorkspace(
  root: string | null,
  store: ScopedStore
): Promise<Divergence[]> {
  if (!root) return []
  return compareMirror(readWorkspace(root), await readEstate(store))
}

/**
 * Make the workspace a repository, if it is not one already.
 *
 * Idempotent and quiet: `git init` on an existing repository is a no-op, and a
 * machine with no git is a machine where the operator gets files without a
 * history — which is exactly what declining would have given them, so it is
 * reported and not thrown.
 */
export async function initRepository(root: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    if (existsSync(path.join(root, '.git'))) return { ok: true }
    await run('git', ['init', '--quiet'], { cwd: root })
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: `git could not initialise this folder: ${String(e)}` }
  }
}

export interface ImportResult {
  ok: boolean
  reason?: string
  problems?: import('../shared/storageContract.ts').ImportProblem[]
  projects: number
  agents: number
  /** What this import does NOT bring back. Present on success too — it is the
   *  sentence the operator most needs, and a success is exactly when nobody
   *  reads a warning. */
  says?: string
}

/**
 * Read a folder and say what importing it WOULD do — before anything is written.
 *
 * The old path validated as it went: parse a file, append its events, parse the
 * next. A fault on the last row of the second file left the estate holding
 * everything from the first, and the refusal the operator read named a problem
 * in a file that had already been half applied. Nothing here writes.
 */
export function previewImport(root: string): ImportPlan {
  const files = readWorkspace(root)
  const parseErrors: { file: string; reason: string }[] = []
  const read = (rel: string, key: string): Record<string, unknown>[] | null => {
    if (!(rel in files)) return null
    const parsed = parseMirror(files[rel], key)
    if (!parsed.ok) {
      parseErrors.push({ file: rel, reason: parsed.reason })
      return []
    }
    return parsed.rows
  }
  const projects = read('workspace/projects.yaml', 'projects')
  const agents = read('workspace/agents.yaml', 'agents')
  const bytes = Object.values(files).reduce((n, t) => n + Buffer.byteLength(t, 'utf8'), 0)
  return planImport({
    projects,
    agents,
    bytes,
    inputDigest: digest(
      Object.entries(files)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([rel, text]) => `${rel}:${digest(text)}`)
        .join('\n')
    ),
    parseErrors
  })
}

/**
 * Import an existing workspace instead of creating one (M118, S12).
 *
 * TWO REFUSALS, and both are about not losing something quietly.
 *
 * 1. An estate that already holds projects is NOT imported into. Merging two
 *    estates is a thing nobody specified — which id wins, what happens to a
 *    project in both, what happens to the tasks hanging off it — and doing it by
 *    "insert what is missing" answers all three by accident. The check now runs
 *    in the SAME TRANSACTION as the writes, under a lock on the estate: two
 *    imports started together used to both see an empty estate and both proceed.
 * 2. A file that cannot be read whole aborts the import, and so does a duplicate
 *    id or a binding to a project the file does not contain — all of it BEFORE
 *    the first write.
 *
 * IDS ARE PRESERVED. That is the difference between importing an estate and
 * copying its contents: the same workspace carried to another machine must be
 * the same estate, so its projects keep their identity and everything that
 * refers to them still does.
 *
 * AND IT SAYS WHAT IT DOES NOT CARRY. The mirror holds two of the estate's
 * twenty-nine tables. "Import a workspace" reads as "restore my estate", and the
 * plan names the difference in the operator's own words.
 */
export async function importWorkspace(
  root: string,
  store: ScopedStore,
  commit: (input: {
    commandId: string
    inputDigest: string
    events: { type: string; project_id?: string; payload: Record<string, unknown> }[]
  }) => Promise<{ ok: boolean; reason?: string }>
): Promise<ImportResult> {
  const plan = previewImport(root)
  if (!plan.ok)
    return {
      ok: false,
      reason: plan.problems[0]?.says ?? 'that folder is not a Fabric workspace',
      problems: plan.problems,
      projects: 0,
      agents: 0,
      says: plan.says
    }

  const files = readWorkspace(root)
  const projects = parseMirror(files['workspace/projects.yaml'], 'projects')
  const agents = parseMirror(files['workspace/agents.yaml'], 'agents')
  if (!projects.ok || !agents.ok)
    // Unreachable through the plan, which already parsed both. Kept because a
    // caller could hand a folder that changed between the two reads, and
    // silently importing the second version is worse than saying so.
    return { ok: false, reason: 'the folder changed while it was being read', projects: 0, agents: 0 }

  const events: { type: string; project_id?: string; payload: Record<string, unknown> }[] = []
  for (const p of projects.rows)
    events.push({
      type: 'project.created@1',
      project_id: p.id as string,
      payload: {
        id: p.id,
        name: p.name,
        purpose: p.purpose ?? null,
        repo_path: p.repo_path ?? null,
        memory_backend: p.memory_backend ?? 'local',
        default_agent: p.default_agent ?? 'claude-code'
      }
    })

  // The servers are a SECOND event on purpose: `project.created@1` does not
  // carry them, and widening it to would change an event type that is already
  // in every estate's journal. A settings update is what the product uses.
  for (const p of projects.rows)
    if (Array.isArray(p.mcp_servers) && p.mcp_servers.length > 0)
      events.push({
        type: 'project.settings.updated@1',
        project_id: p.id as string,
        payload: { id: p.id, mcp_servers: p.mcp_servers }
      })

  for (const a of agents.rows)
    events.push({
      type: 'agent.registered@1',
      project_id: a.project_id as string,
      payload: {
        id: a.id,
        project_id: a.project_id,
        name: a.name,
        runner_id: a.runner_id ?? null,
        instructions: a.instructions ?? null,
        mcp_servers: a.mcp_servers ?? [],
        permission_mode: a.permission_mode ?? null
      }
    })

  // ONE transaction. Either every event is in the journal or none is — and the
  // journal is append-only, so a half-applied import had no way back.
  const result = await commit({
    // Derived from the input, so a retry after a lost response is the SAME
    // command and the database recognises it rather than importing twice.
    commandId: commandIdForImport(store.scope.estateId, plan.inputDigest),
    inputDigest: plan.inputDigest,
    events
  })
  if (!result.ok) return { ok: false, reason: result.reason, projects: 0, agents: 0, says: plan.says }
  return { ok: true, projects: projects.rows.length, agents: agents.rows.length, says: plan.says }
}

/** A stable uuid from the estate and what is being imported. A retry after a
 *  timeout is the same command; a different folder is a different one. */
function commandIdForImport(estateId: string, inputDigest: string): string {
  const h = createHash('sha256').update(`${estateId}\u0000${inputDigest}`).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`
}

// #region estate-sources — docs: docs/evidence/specs/2026-11-19-estate-index-and-graph.md#33-sources-and-how-each-is-kept-current
/**
 * What the estate index reads, source by source, and how each row becomes documents, nodes and edges (spec §3.3, §4.1).
 * Every source stands alone: one that fails is named in the pass's `degraded` and the others still land.
 *
 *   transcripts  Claude Code (`~/.claude/projects`, each Switchboard home) and Codex (`~/.codex/sessions`), read from the
 *                byte offset of the last pass, newest files first, within a time budget
 *   fabric       projects, tasks, notes, task links, claims, the journal's console and session facts and acts, and the
 *                board's messages, each by its `seq` above the last pass
 *   git          the canonical projects' commits, when their HEAD moved
 */
import { execFile } from 'node:child_process'
import { closeSync, openSync, readdirSync, readSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import {
  contextOf, emptyFacts, holder, readClaudeLines, readCodexLines, refsOf, resumeCommand, turnPassages,
  type CatalogueRow, type TranscriptFacts
} from '../shared/estateSearch.ts'
import type { EstateIndex, IndexDoc, IndexEdge, IndexNode } from './estateIndex.ts'

// #region context — docs: docs/evidence/specs/2026-11-19-estate-index-and-graph.md#36-visibility-contexts-never-mixed

/** What every source needs to name a folder's project and context, and to resolve an id a text names. */
export interface SourceContext {
  projects: Map<string, CatalogueRow & { context: string }>
  /** Folder to project id (canonical folders and every other project folder). */
  folders: Map<string, string>
  /** Observatory's folder to organization, for folders no Fabric project holds. */
  organizations: Map<string, string>
  /** The person's own organization in Observatory (its default): its folders are `personal`. */
  personal: string | null
  /** Known task and board message ids, for links a text names (a full id, or its first eight characters). */
  tasks: Set<string>
  messages: Set<string>
}

export function makeContext(rows: readonly CatalogueRow[], organizations: Map<string, string>, personal: string | null = null): SourceContext {
  const folders = new Map<string, string>()
  const projects = new Map<string, CatalogueRow & { context: string }>()
  for (const r of rows) {
    const org = r.repo_path ? holder(organizations, r.repo_path)?.value ?? null : null
    projects.set(r.id, { ...r, context: contextOf(org, personal) })
    if (r.repo_path) folders.set(r.repo_path.replace(/\/+$/, ''), r.id)
  }
  return { projects, folders, organizations, personal, tasks: new Set(), messages: new Set() }
}

/** A folder's project (the longest project folder holding it, canonical preferred) and its context. */
export function placeOf(ctx: SourceContext, cwd: string | null): { projectId: string | null; project: string | null; context: string } {
  const h = holder(ctx.folders, cwd)
  if (h) {
    const p = ctx.projects.get(h.value)!
    return { projectId: p.id, project: p.name, context: p.context }
  }
  return { projectId: null, project: null, context: contextOf(holder(ctx.organizations, cwd)?.value ?? null, ctx.personal) }
}

/** The nodes a text points at: tasks and messages by id or short id, carry-over rows and ADRs. */
export function citesOf(ctx: SourceContext, text: string): string[] {
  const r = refsOf(text)
  const out: string[] = []
  for (const u of r.uuids) {
    if (ctx.tasks.has(u)) out.push(`task:${u}`)
    else if (ctx.messages.has(u)) out.push(`message:${u}`)
  }
  if (ctx.tasks.size) {
    const short = new Map<string, string | null>()
    for (const t of ctx.tasks) { const k = t.slice(0, 8); short.set(k, short.has(k) ? null : t) }
    for (const m of text.slice(0, 20_000).matchAll(/\b([0-9a-f]{8})\b/g)) { const t = short.get(m[1]!); if (t) out.push(`task:${t}`) }
  }
  out.push(...r.co.map((c) => `record:${c}`), ...r.adr.map((a) => `record:${a}`))
  for (const s of r.shas) out.push(`commit:${s}`)
  return [...new Set(out)].slice(0, 40)
}
// #endregion context

export interface Batch { docs: IndexDoc[]; nodes: IndexNode[]; edges: IndexEdge[] }
const batch = (): Batch => ({ docs: [], nodes: [], edges: [] })
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

// #region fabric-rows — docs: docs/evidence/specs/2026-11-19-estate-index-and-graph.md#41-nodes-and-edges

export function projectBatch(ctx: SourceContext): Batch {
  const b = batch()
  for (const p of ctx.projects.values()) {
    const id = `project:${p.id}`
    b.nodes.push({ id, kind: 'project', label: p.name, attrs: { folder: p.repo_path, role: p.role, of: p.of, context: p.context } })
    b.docs.push({ id, kind: 'project', source: 'fabric', node: id, title: p.name, body: `${p.name} ${p.repo_path ?? ''} ${p.role}`, at: p.lastActivityAt ?? null,
      folder: p.repo_path, project: p.name, context: p.context })
  }
  return b
}

export function taskBatch(ctx: SourceContext, rows: ReadonlyArray<Record<string, unknown>>): Batch {
  const b = batch()
  for (const t of rows) {
    const tid = str(t.id)
    if (!tid) continue
    const p = ctx.projects.get(String(t.project_id ?? ''))
    const id = `task:${tid}`
    const title = str(t.title) ?? str(t.instruction)?.slice(0, 120) ?? tid
    const body = [t.instruction, t.brief_what, t.brief_why, t.brief_expected, t.closed_reason].filter((x) => typeof x === 'string' && x).join('\n')
    const at = str(t.moved_at) ?? str(t.started_at)
    b.nodes.push({ id, kind: 'task', label: title, at, attrs: { status: t.status ?? null, project: p?.name ?? null } })
    b.docs.push({ id, kind: 'task', source: 'fabric', node: id, title, body: `${body}\nstatus: ${String(t.status ?? '')}`, at, folder: p?.repo_path ?? null,
      project: p?.name ?? null, context: p?.context ?? 'personal' })
    if (p) b.edges.push({ src: id, rel: 'belongs-to', dst: `project:${p.id}`, at })
    for (const c of citesOf(ctx, body)) if (c !== id) b.edges.push({ src: id, rel: 'cites', dst: c, at, evidence: 'the task\'s text' })
  }
  return b
}

export function noteBatch(ctx: SourceContext, rows: ReadonlyArray<Record<string, unknown>>): Batch {
  const b = batch()
  for (const n of rows) {
    const nid = str(n.id), tid = str(n.task_id)
    if (!nid || !tid) continue
    const p = ctx.projects.get(String(n.project_id ?? ''))
    const body = str(n.body_md) ?? ''
    b.docs.push({ id: `note:${nid}`, kind: 'note', source: 'fabric', node: `task:${tid}`, title: body.split('\n')[0]!.slice(0, 120), body, at: str(n.created_at),
      folder: p?.repo_path ?? null, project: p?.name ?? null, context: p?.context ?? 'personal' })
    for (const c of citesOf(ctx, body)) if (c !== `task:${tid}`) b.edges.push({ src: `task:${tid}`, rel: 'cites', dst: c, at: str(n.created_at), evidence: `note ${nid}` })
  }
  return b
}

export function linkBatch(rows: ReadonlyArray<Record<string, unknown>>): Batch {
  const b = batch()
  for (const l of rows) {
    const tid = str(l.task_id), target = str(l.target_id), rel = str(l.rel)
    if (!tid || !target || !rel) continue
    const kind = str(l.target_kind) ?? 'task'
    b.edges.push({ src: `task:${tid}`, rel: rel === 'spawned' ? 'spawned' : rel === 'blocks' ? 'blocks' : rel, dst: `${kind}:${target}`, evidence: 'task_links' })
  }
  return b
}

export function claimBatch(rows: ReadonlyArray<Record<string, unknown>>): Batch {
  const b = batch()
  for (const c of rows) {
    const s = str(c.owner_session), w = str(c.work_id)
    if (!s || !w) continue
    b.edges.push({ src: `console:${s}`, rel: 'did', dst: `task:${w}`, at: str(c.claimed_at), evidence: `claimed${c.released_how ? `, released ${String(c.released_how)}` : ''}` })
  }
  return b
}

/** The journal's facts: consoles, the Claude sessions they ran as, the commits a turn recorded, acts and their actors. */
export function journalBatch(ctx: SourceContext, rows: ReadonlyArray<Record<string, unknown>>): Batch {
  const b = batch()
  for (const e of rows) {
    const type = String(e.type ?? '')
    const p = (e.payload ?? {}) as Record<string, unknown>
    const at = str(e.occurred_at)
    const project = ctx.projects.get(String(e.project_id ?? ''))
    const fabricSession = str(p.session_id)
    if (type === 'terminal.opened@1' && fabricSession) {
      const id = `console:${fabricSession}`
      const runner = str(p.option_id) ?? 'shell'
      b.nodes.push({ id, kind: 'session', label: `${project?.name ?? path.basename(str(p.cwd) ?? '')} · ${runner}`, at,
        attrs: { console: true, runner, folder: str(p.cwd), project_id: e.project_id ?? null } })
      b.docs.push({ id, kind: 'console', source: 'fabric', node: id, title: `Консоль ${project?.name ?? ''} (${runner})`, body: `${str(p.cwd) ?? ''} ${runner} ${str(p.program) ?? ''}`,
        at, folder: str(p.cwd), project: project?.name ?? null, context: project?.context ?? 'personal', sessionId: fabricSession, runtime: runner })
      if (project) b.edges.push({ src: id, rel: 'belongs-to', dst: `project:${project.id}`, at })
      continue
    }
    if ((type === 'session.turn.observed@1' || type === 'session.enrolled@1') && fabricSession) {
      const runtime = str(p.runtime_session_id)
      if (runtime) b.edges.push({ src: `console:${fabricSession}`, rel: 'ran-as', dst: `session:${runtime}`, at, evidence: type })
      const head = str(p.head)
      if (runtime && head) b.edges.push({ src: `session:${runtime}`, rel: 'changed', dst: `commit:${head}`, at, evidence: 'the turn recorded this commit as HEAD' })
      if (project) b.edges.push({ src: `console:${fabricSession}`, rel: 'belongs-to', dst: `project:${project.id}`, at })
      continue
    }
    if (type === 'act.recorded@1' || type.startsWith('effect.')) {
      const id = `act:${String(e.seq)}`
      const kind = str(p.kind) ?? type
      b.nodes.push({ id, kind: 'act', label: `${kind}${str(p.label) ? ` · ${String(p.label)}` : ''}`, at, attrs: { type, reason: p.reason ?? null } })
      const actor = (e.actor ?? {}) as Record<string, unknown>
      if (str(actor.kind)) b.edges.push({ src: `agent:${String(actor.kind)}:${String(actor.id ?? '')}`, rel: 'did', dst: id, at, evidence: type })
      if (project) b.edges.push({ src: id, rel: 'belongs-to', dst: `project:${project.id}`, at })
      const args = (p.args ?? {}) as Record<string, unknown>
      const sid = str(args.session_id) ?? str(p.session_id)
      if (sid) b.edges.push({ src: id, rel: 'relates-to', dst: `console:${sid}`, at })
      continue
    }
    if (type === 'question.asked@1') {
      const q = str(p.question_id) ?? str(p.id)
      for (const t of Array.isArray(p.blocks) ? p.blocks : []) if (typeof t === 'string' && q) b.edges.push({ src: `task:${t}`, rel: 'waits-on', dst: `question:${q}`, at })
    }
  }
  return b
}

export function boardBatch(ctx: SourceContext, messages: ReadonlyArray<Record<string, unknown>>): Batch {
  const b = batch()
  for (const m of messages) {
    const mid = str(m.id)
    if (!mid) continue
    const body = str((m.body as Record<string, unknown> | undefined)?.text) ?? ''
    const sender = ctx.projects.get(String((m.sender as Record<string, unknown> | undefined)?.project ?? ''))
    const req = (m.request ?? null) as Record<string, unknown> | null
    const target = req ? ctx.projects.get(String(req.target ?? '')) : undefined
    const id = `message:${mid}`
    const kind = str(m.kind) ?? 'message'
    const title = body.replace(/\*\*/g, '').split('\n')[0]!.slice(0, 160)
    const at = str(m.at)
    b.nodes.push({ id, kind: 'request', label: title || kind, at, attrs: { kind, thread: m.thread ?? null, state: req?.state ?? null } })
    b.docs.push({ id, kind: 'message', source: 'fabric', node: id, title: `${kind === 'request' ? 'Запрос' : 'Сообщение'}: ${title}`, body, at,
      folder: sender?.repo_path ?? null, project: sender?.name ?? null, context: sender?.context ?? 'personal' })
    if (sender) b.edges.push({ src: id, rel: 'belongs-to', dst: `project:${sender.id}`, at, evidence: 'sender' })
    if (target) b.edges.push({ src: id, rel: 'relates-to', dst: `project:${target.id}`, at, evidence: `request to ${target.name}` })
    const reply = str(m.replyTo)
    if (reply) b.edges.push({ src: id, rel: 'answers', dst: `message:${reply}`, at })
    for (const c of citesOf(ctx, body)) if (c !== id) b.edges.push({ src: id, rel: 'cites', dst: c, at, evidence: 'the message\'s text' })
  }
  return b
}
// #endregion fabric-rows

// #region transcript-files — docs: docs/evidence/specs/2026-11-19-estate-index-and-graph.md#33-sources-and-how-each-is-kept-current

export interface TranscriptRoot { runtime: 'claude' | 'codex'; dir: string; configDir: string | null }

export function defaultRoots(home = homedir()): TranscriptRoot[] {
  const roots: TranscriptRoot[] = [{ runtime: 'claude', dir: path.join(home, '.claude', 'projects'), configDir: null }]
  const runtimes = path.join(home, 'Library/Application Support/ai.passioncode.fabric-switchboard/runtimes')
  let homes: string[] = []
  try { homes = readdirSync(runtimes) } catch { /* no Switchboard on this computer: its homes are not read */ }
  for (const h of homes.slice(0, 200)) roots.push({ runtime: 'claude', dir: path.join(runtimes, h, 'projects'), configDir: path.join(runtimes, h) })
  roots.push({ runtime: 'codex', dir: path.join(home, '.codex', 'sessions'), configDir: null })
  return roots
}

/** Every transcript file of the roots, newest first: Claude's `projects/*\/*.jsonl`, Codex's `YYYY/MM/DD/rollout-*.jsonl`. */
export function listTranscripts(roots: readonly TranscriptRoot[]): Array<{ file: string; root: TranscriptRoot; size: number; mtime: number }> {
  const out: Array<{ file: string; root: TranscriptRoot; size: number; mtime: number }> = []
  const add = (file: string, root: TranscriptRoot) => {
    try { const s = statSync(file); if (s.isFile() && s.size > 0) out.push({ file, root, size: s.size, mtime: s.mtimeMs }) } catch { /* gone between list and stat */ }
  }
  const dirs = (d: string): string[] => { try { return readdirSync(d) } catch { return [] /* a folder gone between list and read: nothing to list there */ } }
  for (const root of roots) {
    if (root.runtime === 'claude') {
      for (const p of dirs(root.dir)) for (const f of dirs(path.join(root.dir, p))) if (f.endsWith('.jsonl')) add(path.join(root.dir, p, f), root)
    } else {
      for (const y of dirs(root.dir)) for (const m of dirs(path.join(root.dir, y))) for (const d of dirs(path.join(root.dir, y, m)))
        for (const f of dirs(path.join(root.dir, y, m, d))) if (f.startsWith('rollout-') && f.endsWith('.jsonl')) add(path.join(root.dir, y, m, d, f), root)
    }
  }
  return out.sort((a, b) => b.mtime - a.mtime)
}

/** What a file's previous reads left: the facts the next read continues from. */
interface FileFacts { sessionId: string | null; cwd: string | null; title: string | null; branch: string | null; firstAt: string | null; lastAt: string | null; prompts: string[] }

/** One read of a transcript: small enough that parsing it holds the main process for tens of milliseconds. */
export const CHUNK = 4 * 1024 * 1024

/**
 * Reads one transcript from where the last pass stopped and writes its session and new turns. A file that shrank is read
 * again from its start. The last, unfinished line waits for the next pass.
 */
export function readTranscript(index: EstateIndex, ctx: SourceContext, t: { file: string; root: TranscriptRoot; size: number; mtime: number }): { turns: number; done: boolean } {
  const prev = index.fileState(t.file)
  if (prev && prev.size === t.size && prev.mtime === t.mtime && prev.offset >= t.size) return { turns: 0, done: true }
  let offset = prev && prev.offset <= t.size ? prev.offset : 0
  let lines = prev && offset > 0 ? prev.lines : 0
  const kept: FileFacts = offset > 0 && prev?.state ? JSON.parse(prev.state) as FileFacts : { sessionId: null, cwd: null, title: null, branch: null, firstAt: null, lastAt: null, prompts: [] }
  const fd = openSync(t.file, 'r')
  let turnsWritten = 0
  try {
    const len = Math.min(CHUNK, t.size - offset)
    const buf = Buffer.alloc(len)
    const got = readSync(fd, buf, 0, len, offset)
    const text = buf.subarray(0, got).toString('utf8')
    const lastNl = text.lastIndexOf('\n')
    // A chunk with no complete line (one line longer than the chunk) is skipped whole: a tool's output, never a message.
    const whole = lastNl >= 0 ? text.slice(0, lastNl) : got === len && len === CHUNK ? text : ''
    const consumed = lastNl >= 0 ? Buffer.byteLength(text.slice(0, lastNl + 1)) : got === len && len === CHUNK ? got : 0
    const ls = whole ? whole.split('\n') : []
    const facts: TranscriptFacts = { ...emptyFacts(), sessionId: kept.sessionId, cwd: kept.cwd, title: kept.title, branch: kept.branch, firstAt: kept.firstAt, lastAt: kept.lastAt }
    if (t.root.runtime === 'claude') readClaudeLines(ls, lines + 1, facts)
    else readCodexLines(ls, lines + 1, facts)
    const sid = facts.sessionId ?? path.basename(t.file, '.jsonl').slice(-36)
    const prompts = [...kept.prompts, ...facts.turns.filter((x) => x.role === 'user').map((x) => x.text.slice(0, 400))].slice(0, 6)
    const place = placeOf(ctx, facts.cwd)
    const node = `session:${sid}`
    const resume = resumeCommand(t.root.runtime, sid, facts.cwd, t.root.configDir)
    const title = facts.title ?? prompts[0]?.replace(/\s+/g, ' ').slice(0, 120) ?? path.basename(facts.cwd ?? sid)
    const common = { source: t.root.runtime, node, folder: facts.cwd, project: place.project, context: place.context, sessionId: sid, runtime: t.root.runtime, resume, path: t.file } as const
    const b = batch()
    b.nodes.push({ id: node, kind: 'session', label: title, at: facts.lastAt, attrs: { runtime: t.root.runtime, folder: facts.cwd, branch: facts.branch, first_at: facts.firstAt, resume, config_dir: t.root.configDir, transcript: t.file } })
    b.docs.push({ ...common, id: `${t.root.runtime}:${sid}`, kind: 'session', title, body: [title, facts.branch ?? '', ...prompts].join('\n'), tri: [title, ...prompts].join('\n'), at: facts.lastAt, lineStart: null, lineEnd: null })
    if (place.projectId) b.edges.push({ src: node, rel: 'belongs-to', dst: `project:${place.projectId}`, at: facts.lastAt, evidence: facts.cwd })
    for (const p of turnPassages(facts.turns)) {
      b.docs.push({ ...common, id: `${t.root.runtime}:${sid}#${p.lineStart}`, kind: 'turn', title, body: p.text,
        tri: p.text.split('\n').filter((l) => l.startsWith('›')).join('\n') || title, at: p.at ?? facts.lastAt, lineStart: p.lineStart, lineEnd: p.lineEnd })
      turnsWritten++
    }
    for (const turn of facts.turns.filter((x) => x.role === 'user'))
      for (const c of citesOf(ctx, turn.text)) b.edges.push({ src: node, rel: 'cites', dst: c, at: turn.at, evidence: `${t.file}:${turn.line}` })
    index.putDocs(b.docs)
    index.putGraph(b.nodes, b.edges)
    offset += consumed
    lines += ls.length
    const state: FileFacts = { sessionId: sid, cwd: facts.cwd, title: facts.title, branch: facts.branch, firstAt: facts.firstAt, lastAt: facts.lastAt, prompts }
    index.setFileState(t.file, { size: t.size, mtime: t.mtime, offset, lines, state: JSON.stringify(state) })
    return { turns: turnsWritten, done: offset >= t.size || consumed === 0 }
  } finally {
    closeSync(fd)
  }
}
// #endregion transcript-files

// #region git — docs: docs/evidence/specs/2026-11-19-estate-index-and-graph.md#33-sources-and-how-each-is-kept-current

export const GIT_DAYS = 120
export const GIT_COMMITS = 400

function git(cwd: string, args: string[], timeoutMs = 8000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd, timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } }, (err, out) => (err ? reject(err) : resolve(out)))
  })
}

/** A repository's HEAD, or null when the folder is not one. */
export async function headOf(folder: string): Promise<string | null> {
  try { return (await git(folder, ['rev-parse', 'HEAD'], 3000)).trim() || null } catch { return null /* not a repository, or no commit yet */ }
}

/** A linked worktree's main folder (its common directory's parent), null for a main checkout or a plain folder. */
export async function mainOfWorktree(folder: string): Promise<string | null> {
  try {
    const [gitDir, common] = (await git(folder, ['rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir'], 3000)).trim().split('\n')
    if (!gitDir || !common || gitDir === common) return null
    return path.dirname(common)
  } catch { return null /* not a repository */ }
}

/** The commits of one project's repository, as documents and nodes with their project and the records they cite. */
export async function commitBatch(ctx: SourceContext, project: CatalogueRow & { context: string }): Promise<Batch> {
  const b = batch()
  if (!project.repo_path) return b
  const out = await git(project.repo_path, ['log', `--since=${GIT_DAYS}.days`, `-n${GIT_COMMITS}`, '--no-merges', '--format=%H%x1f%aI%x1f%s%x1f%b%x1e'], 15_000)
  for (const rec of out.split('\x1e')) {
    const [sha, at, subject, bodyRaw] = rec.trim().split('\x1f')
    if (!sha || !/^[0-9a-f]{40}$/.test(sha)) continue
    const body = (bodyRaw ?? '').replace(/^Co-Authored-By:.*$/gm, '').trim()
    const id = `commit:${sha}`
    b.nodes.push({ id, kind: 'commit', label: `${sha.slice(0, 8)} ${subject ?? ''}`.slice(0, 200), at: at ?? null, attrs: { repo: project.repo_path, project: project.name } })
    b.docs.push({ id: `commit:${project.id}@${sha}`, kind: 'commit', source: 'git', node: id, title: subject ?? sha, body: `${subject ?? ''}\n${body}`.slice(0, 4000), at: at ?? null,
      folder: project.repo_path, project: project.name, context: project.context, path: project.repo_path })
    b.edges.push({ src: id, rel: 'belongs-to', dst: `project:${project.id}`, at: at ?? null })
    for (const c of citesOf(ctx, `${subject ?? ''}\n${body}`)) if (c !== id) b.edges.push({ src: id, rel: 'cites', dst: c, at: at ?? null, evidence: 'the commit message' })
  }
  return b
}
// #endregion git
// #endregion estate-sources

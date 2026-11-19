// #region estate-run — docs: docs/evidence/specs/2026-11-19-estate-index-and-graph.md#33-sources-and-how-each-is-kept-current
/**
 * One pass of the estate index (spec §3.3): Fabric's own rows first (they name the projects and ids the transcripts and
 * commits link to), then the transcripts newest first within a time budget, then the commits of the repositories whose
 * HEAD moved, then, when a local model serves vectors, a bounded batch of embeddings. One pass at a time; each source
 * stands alone and a failed one is named in the pass's `degraded`.
 */
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { catalogue, type CatalogueInput } from '../shared/estateSearch.ts'
import type { Embedder, EstateIndex } from './estateIndex.ts'
import {
  boardBatch, claimBatch, commitBatch, headOf, journalBatch, linkBatch, listTranscripts, mainOfWorktree, makeContext, noteBatch,
  projectBatch, readTranscript, taskBatch, type Batch, type SourceContext, type TranscriptRoot
} from './estateSources.ts'

export const JOURNAL_TYPES = ['terminal.opened@1', 'session.turn.observed@1', 'session.enrolled@1', 'act.recorded@1', 'question.asked@1',
  'effect.reserved@1', 'effect.observed@1', 'effect.claimed@1'] as const
const PAGE = 1000
/** Pages of one table read in one pass; the rest waits for the next. */
const PAGES = 40
const BOARD_PAGES = 60
/** Passages embedded in one pass; a first index embeds over many passes. */
export const EMBED_PER_PASS = 400

type Rows = Array<Record<string, unknown>>

export interface EstateRunDeps {
  index: EstateIndex
  projects(): Promise<CatalogueInput[]>
  /** `~/DATA/<folder>` (absolute) to its organization, from Observatory's registry, and the person's own organization
   *  (Observatory's default); empty when they cannot be read. */
  organizations(): { folders: Map<string, string>; personal: string | null }
  /** One page of a table by its sequence column above `after`, oldest first. */
  page(table: 'project_tasks' | 'task_notes' | 'task_links' | 'work_claims', seqColumn: string, after: number, limit: number): Promise<Rows>
  journal(types: readonly string[], after: number, limit: number): Promise<Rows>
  /** The board's messages after a sequence, oldest first, 100 at most (the operator's door). */
  board(after: number): Promise<{ messages: Rows; last: number; more: boolean }>
  roots(): TranscriptRoot[]
  embedder(): Promise<Embedder | null>
  now(): number
  yieldNow(): Promise<void>
}

export interface PassReport {
  at: string
  ms: number
  docs: number
  transcripts: { read: number; turns: number; left: number }
  commits: number
  embedded: number
  degraded: string[]
}

/** Folder to organization from Observatory's registry (its projects' `local_folders` are relative to `~/DATA`), and the
 *  organization its `config/organizations.json` marks as the default, the person's own. */
export function readOrganizations(dataHome = process.env.OBSERVATORY_DATA ?? path.join(homedir(), '.local/share/project-observatory-full'), base = path.join(homedir(), 'DATA')): { folders: Map<string, string>; personal: string | null } {
  const out = new Map<string, string>()
  let personal: string | null = null
  const config = path.join(dataHome, 'config', 'organizations.json')
  if (existsSync(config)) {
    const c = JSON.parse(readFileSync(config, 'utf8')) as { organizations?: Record<string, { default?: unknown }> }
    personal = Object.entries(c.organizations ?? {}).find(([, v]) => v?.default === true)?.[0] ?? null
  }
  const file = path.join(dataHome, 'registry', 'projects.json')
  if (!existsSync(file)) return { folders: out, personal }
  const j = JSON.parse(readFileSync(file, 'utf8')) as { projects?: Array<{ organization?: unknown; local_folders?: unknown }> }
  for (const p of j.projects ?? []) {
    if (typeof p.organization !== 'string' || !Array.isArray(p.local_folders)) continue
    for (const f of p.local_folders) if (typeof f === 'string' && f) out.set(path.isAbsolute(f) ? f : path.join(base, f), p.organization)
  }
  return { folders: out, personal }
}

export function createEstateRunner(deps: EstateRunDeps) {
  const ix = deps.index
  let running: Promise<PassReport> | null = null
  const seq = (k: string): number => Number(ix.meta(`seq:${k}`) ?? 0)
  const setSeq = (k: string, v: number) => ix.setMeta(`seq:${k}`, String(v))
  const put = (b: Batch): number => { const n = ix.putDocs(b.docs); ix.putGraph(b.nodes, b.edges); return n }

  async function context(degraded: string[]): Promise<SourceContext> {
    let orgs: { folders: Map<string, string>; personal: string | null } = { folders: new Map(), personal: null }
    try { orgs = deps.organizations() } catch (e) { /* named in the pass's degraded; the other sources still land */ degraded.push(`observatory-unread: ${e instanceof Error ? e.message.slice(0, 120) : String(e)}`) }
    const projects = await deps.projects()
    const worktrees = new Map<string, string | null>()
    await Promise.all(projects.map(async (p) => { if (p.repo_path && existsSync(p.repo_path)) worktrees.set(p.repo_path, await mainOfWorktree(p.repo_path)) }))
    const ctx = makeContext(catalogue(projects, (f) => worktrees.get(f) ?? null), orgs.folders, orgs.personal)
    for (const r of ix.db.prepare("SELECT id, kind FROM nodes WHERE kind IN ('task', 'request')").all() as Array<{ id: string; kind: string }>)
      (r.kind === 'task' ? ctx.tasks : ctx.messages).add(r.id.slice(r.id.indexOf(':') + 1))
    return ctx
  }

  async function table(name: 'project_tasks' | 'task_notes' | 'task_links' | 'work_claims', col: string, build: (rows: Rows) => Batch, onRows: (rows: Rows) => void, degraded: string[]): Promise<number> {
    let n = 0
    try {
      for (let i = 0; i < PAGES; i++) {
        const rows = await deps.page(name, col, seq(name), PAGE)
        if (!rows.length) break
        onRows(rows)
        n += put(build(rows))
        setSeq(name, Math.max(...rows.map((r) => Number(r[col] ?? 0))))
        if (rows.length < PAGE) break
        await deps.yieldNow()
      }
    } catch (e) { /* named in the pass's degraded; the other sources still land */ degraded.push(`${name}-unread: ${e instanceof Error ? e.message.slice(0, 160) : String(e)}`) }
    return n
  }

  async function onePass(budgetMs: number): Promise<PassReport> {
    const started = deps.now()
    const degraded: string[] = []
    let docs = 0
    let ctx: SourceContext
    try { ctx = await context(degraded) } catch (e) {
      // Without the projects nothing can be placed: the pass says so and writes nothing.
      const report: PassReport = { at: new Date(started).toISOString(), ms: deps.now() - started, docs: 0, transcripts: { read: 0, turns: 0, left: 0 }, commits: 0, embedded: 0,
        degraded: [`projects-unread: ${e instanceof Error ? e.message.slice(0, 160) : String(e)}`] }
      ix.setMeta('last_pass', JSON.stringify(report))
      return report
    }
    docs += put(projectBatch(ctx))
    docs += await table('project_tasks', 'seq', (r) => taskBatch(ctx, r), (r) => { for (const t of r) if (typeof t.id === 'string') ctx.tasks.add(t.id) }, degraded)
    docs += await table('task_notes', 'seq', (r) => noteBatch(ctx, r), () => {}, degraded)
    docs += await table('task_links', 'seq', linkBatch, () => {}, degraded)
    docs += await table('work_claims', 'claimed_seq', claimBatch, () => {}, degraded)
    try {
      for (let i = 0; i < PAGES; i++) {
        const rows = await deps.journal(JOURNAL_TYPES, seq('journal'), PAGE)
        if (!rows.length) break
        docs += put(journalBatch(ctx, rows))
        setSeq('journal', Math.max(...rows.map((r) => Number(r.seq ?? 0))))
        if (rows.length < PAGE) break
        await deps.yieldNow()
      }
    } catch (e) { /* named in the pass's degraded; the other sources still land */ degraded.push(`journal-unread: ${e instanceof Error ? e.message.slice(0, 160) : String(e)}`) }
    try {
      for (let i = 0; i < BOARD_PAGES; i++) {
        const page = await deps.board(seq('board'))
        for (const m of page.messages) if (typeof m.id === 'string') ctx.messages.add(m.id)
        docs += put(boardBatch(ctx, page.messages))
        setSeq('board', page.last)
        if (!page.more) break
        await deps.yieldNow()
      }
    } catch (e) { /* named in the pass's degraded; the other sources still land */ degraded.push(`board-unread: ${e instanceof Error ? e.message.slice(0, 160) : String(e)}`) }

    // Transcripts, newest first, until the budget is spent; the next pass goes on where this one stopped.
    let read = 0, turns = 0, left = 0
    try {
      const files = listTranscripts(deps.roots())
      for (const f of files) {
        if (deps.now() - started > budgetMs) { left++; continue }
        try {
          let r = readTranscript(ix, ctx, f)
          while (!r.done && deps.now() - started <= budgetMs) { turns += r.turns; r = readTranscript(ix, ctx, { ...f }); await deps.yieldNow() }
          turns += r.turns
          if (!r.done) left++
          read++
        } catch (e) { /* named in the pass's degraded; the other sources still land */ degraded.push(`transcript-unread: ${path.basename(f.file)}: ${e instanceof Error ? e.message.slice(0, 100) : String(e)}`) }
        await deps.yieldNow()
      }
    } catch (e) { /* named in the pass's degraded; the other sources still land */ degraded.push(`transcripts-unread: ${e instanceof Error ? e.message.slice(0, 160) : String(e)}`) }

    let commits = 0
    for (const p of ctx.projects.values()) {
      if (p.role !== 'canonical' || !p.repo_path || !existsSync(p.repo_path)) continue
      try {
        const head = await headOf(p.repo_path)
        if (!head || ix.meta(`head:${p.id}`) === head) continue
        const b = await commitBatch(ctx, p)
        put(b)
        commits += b.nodes.length
        ix.setMeta(`head:${p.id}`, head)
      } catch (e) { /* named in the pass's degraded; the other sources still land */ degraded.push(`git-unread: ${p.name}: ${e instanceof Error ? e.message.slice(0, 100) : String(e)}`) }
    }

    let embedded = 0
    try {
      const emb = await deps.embedder()
      if (!emb) degraded.push('vector-unavailable')
      else {
        const todo = ix.unembedded(emb.model, EMBED_PER_PASS)
        for (let i = 0; i < todo.length; i += 32) {
          const slice = todo.slice(i, i + 32)
          const vecs = await emb.embed(slice.map((x) => x.text), false)
          ix.putVectors(emb.model, slice.map((x, j) => ({ digest: x.digest, vec: vecs[j]! })))
          embedded += slice.length
        }
      }
    } catch (e) { /* named in the pass's degraded; the other sources still land */ degraded.push(`embedding-failed: ${e instanceof Error ? e.message.slice(0, 120) : String(e)}`) }

    const report: PassReport = { at: new Date(started).toISOString(), ms: deps.now() - started, docs, transcripts: { read, turns, left }, commits, embedded, degraded }
    ix.setMeta('last_pass', JSON.stringify(report))
    return report
  }

  return {
    /** One pass, or the one already running. */
    pass(budgetMs = 20_000): Promise<PassReport> {
      if (!running) running = onePass(budgetMs).finally(() => { running = null })
      return running
    },
    running: () => running !== null
  }
}

export type EstateRunner = ReturnType<typeof createEstateRunner>

/** An Ollama embedder for the first installed model of `models`, or null when Ollama or the model is absent. */
export async function ollamaEmbedder(fetchImpl: typeof fetch = fetch, url = 'http://127.0.0.1:11434', models = ['embeddinggemma', 'nomic-embed-text']): Promise<Embedder | null> {
  const prefixes: Record<string, { query: string; doc: string }> = {
    embeddinggemma: { query: 'task: search result | query: ', doc: 'title: none | text: ' },
    'nomic-embed-text': { query: 'search_query: ', doc: 'search_document: ' }
  }
  let names: Set<string>
  try {
    const r = await fetchImpl(`${url}/api/tags`, { signal: AbortSignal.timeout(1500) })
    if (!r.ok) return null
    const j = await r.json() as { models?: Array<{ name?: string; model?: string }> }
    names = new Set((j.models ?? []).flatMap((m) => [m.name ?? '', m.model ?? '', (m.name ?? '').replace(/:latest$/, '')]))
  } catch { return null /* Ollama is not running: search stays lexical and says so */ }
  const model = models.find((m) => names.has(m) || names.has(`${m}:latest`))
  if (!model) return null
  return {
    model,
    async embed(texts, query) {
      const p = prefixes[model] ?? { query: '', doc: '' }
      const r = await fetchImpl(`${url}/api/embed`, { method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(60_000),
        body: JSON.stringify({ model, input: texts.map((t) => (query ? p.query : p.doc) + t) }) })
      if (!r.ok) throw new Error(`Ollama answered ${r.status}`)
      const j = await r.json() as { embeddings?: number[][] }
      if (!Array.isArray(j.embeddings) || j.embeddings.length !== texts.length) throw new Error('Ollama answered without one vector per text')
      return j.embeddings.map((v) => Float32Array.from(v))
    }
  }
}
// #endregion estate-run

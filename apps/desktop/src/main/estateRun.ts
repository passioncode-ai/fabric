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
import { nextMarks, type SourceMarks } from '../shared/memory.ts'
import type { Embedder, EstateIndex } from './estateIndex.ts'
import {
  boardBatch, claimBatch, listSourceFiles, readSourceFile, commitBatch, documentBatch, factBatch, headOf, journalBatch, linkBatch, listTranscripts, mainOfWorktree, makeContext, noteBatch,
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
  page(table: 'project_tasks' | 'task_notes' | 'task_links' | 'work_claims' | 'memory_facts', seqColumn: string, after: number, limit: number): Promise<Rows>
  journal(types: readonly string[], after: number, limit: number): Promise<Rows>
  /** The board's messages after a sequence, oldest first, 100 at most (the operator's door). */
  board(after: number): Promise<{ messages: Rows; last: number; more: boolean }>
  roots(): TranscriptRoot[]
  /** The folder of other sources' `memory-bundle/1` files (spec 2026-11-20 §10); absent or null when none is read. */
  sourcesDir?(): string | null
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
  documents: number
  embedded: number
  /** What other sources gave this pass (fabric-inbox and the like); absent before any source folder exists. */
  sources?: { files: number; docs: number; nodes: number; edges: number; refused: number }
  degraded: string[]
}

/** Folder to organization from Observatory's registry (its projects' `local_folders` are relative to `~/DATA`), and the
 *  organization its `config/organizations.json` marks as the default, the person's own. */
export function readOrganizations(dataHome = process.env.OBSERVATORY_DATA ?? path.join(homedir(), '.local/share/project-observatory-full'), base = path.join(homedir(), 'DATA')): { folders: Map<string, string>; personal: string | null; names: Map<string, string> } {
  const out = new Map<string, string>()
  let personal: string | null = null
  // Each organization's display name (its `label`), for Memory's graph; never written in Fabric's code.
  const names = new Map<string, string>()
  const config = path.join(dataHome, 'config', 'organizations.json')
  if (existsSync(config)) {
    const c = JSON.parse(readFileSync(config, 'utf8')) as { organizations?: Record<string, { default?: unknown; label?: unknown }> }
    personal = Object.entries(c.organizations ?? {}).find(([, v]) => v?.default === true)?.[0] ?? null
    for (const [id, v] of Object.entries(c.organizations ?? {})) if (typeof v?.label === 'string' && v.label.trim()) names.set(id, v.label.trim().slice(0, 80))
  }
  const file = path.join(dataHome, 'registry', 'projects.json')
  if (!existsSync(file)) return { folders: out, personal, names }
  const j = JSON.parse(readFileSync(file, 'utf8')) as { projects?: Array<{ organization?: unknown; local_folders?: unknown }> }
  for (const p of j.projects ?? []) {
    if (typeof p.organization !== 'string' || !Array.isArray(p.local_folders)) continue
    for (const f of p.local_folders) if (typeof f === 'string' && f) out.set(path.isAbsolute(f) ? f : path.join(base, f), p.organization)
  }
  return { folders: out, personal, names }
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

  async function table(name: 'project_tasks' | 'task_notes' | 'task_links' | 'work_claims' | 'memory_facts', col: string, build: (rows: Rows) => Batch, onRows: (rows: Rows) => void, degraded: string[]): Promise<number> {
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
      const report: PassReport = { at: new Date(started).toISOString(), ms: deps.now() - started, docs: 0, transcripts: { read: 0, turns: 0, left: 0 }, commits: 0, documents: 0, embedded: 0,
        degraded: [`projects-unread: ${e instanceof Error ? e.message.slice(0, 160) : String(e)}`] }
      ix.setMeta('last_pass', JSON.stringify(report))
      return report
    }
    docs += put(projectBatch(ctx))
    docs += await table('project_tasks', 'seq', (r) => taskBatch(ctx, r), (r) => { for (const t of r) if (typeof t.id === 'string') ctx.tasks.add(t.id) }, degraded)
    docs += await table('task_notes', 'seq', (r) => noteBatch(ctx, r), () => {}, degraded)
    docs += await table('task_links', 'seq', linkBatch, () => {}, degraded)
    docs += await table('work_claims', 'claimed_seq', claimBatch, () => {}, degraded)
    docs += await table('memory_facts', 'seq', (r) => factBatch(ctx, r), () => {}, degraded)
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
    let boardMore = false
    try {
      for (let i = 0; i < BOARD_PAGES; i++) {
        const page = await deps.board(seq('board'))
        boardMore = page.more
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

    // #region memory-sources-pass — docs: docs/evidence/specs/2026-11-20-memory-dashboard.md#10-other-sources-the-connection-point-fabric-inbox-first
    // Other sources' bundles (fabric-inbox first): each file from where the last pass stopped; a refused line is counted.
    let sources: PassReport['sources']
    try {
      const files = listSourceFiles(deps.sourcesDir?.() ?? null)
      if (files.length) {
        sources = { files: 0, docs: 0, nodes: 0, edges: 0, refused: 0 }
        for (const f of files) {
          if (deps.now() - started > budgetMs * 2) { degraded.push(`source-deferred: ${f.source}`); continue }
          try {
            const r = readSourceFile(ix, f)
            sources.files++; sources.docs += r.docs; sources.nodes += r.nodes; sources.edges += r.edges; sources.refused += r.refused
            docs += r.docs
            if (r.refused) degraded.push(`source-refused: ${f.source}: ${r.refused}`)
          } catch (e) { /* named in the pass's degraded; the other sources still land */ degraded.push(`source-unread: ${f.source}: ${e instanceof Error ? e.message.slice(0, 100) : String(e)}`) }
          await deps.yieldNow()
        }
      }
    } catch (e) { /* named in the pass's degraded; the other sources still land */ degraded.push(`sources-unread: ${e instanceof Error ? e.message.slice(0, 160) : String(e)}`) }
    // #endregion memory-sources-pass

    let commits = 0
    let documents = 0
    for (const p of ctx.projects.values()) {
      if (p.role !== 'canonical' || !p.repo_path || !existsSync(p.repo_path)) continue
      try {
        const head = await headOf(p.repo_path)
        if (!head || ix.meta(`head:${p.id}`) === head) continue
        // The commits and the documents keep their own HEAD: a repository whose documents wait for the next pass is not
        // read for its commits again (the 2026-11-20 measurement read 24 208 commits, then 14 685 of the same again).
        if (ix.meta(`commits:${p.id}`) !== head) {
          const b = await commitBatch(ctx, p)
          put(b)
          commits += b.nodes.length
          ix.setMeta(`commits:${p.id}`, head)
        }
        // The project's documents at this HEAD; a repository read past the budget waits for the next pass.
        if (deps.now() - started <= budgetMs * 2) {
          const d = await documentBatch(ctx, p)
          docs += put(d)
          documents += d.nodes.length
          // What this HEAD no longer holds leaves the index: moved sections and removed files (0.3.27 review ER-68).
          ix.pruneDocs(`doc:${p.id}/`, new Set(d.docs.map((x) => x.id)))
        }
        else { degraded.push(`documents-deferred: ${p.name}`); continue }
        ix.setMeta(`head:${p.id}`, head)
      } catch (e) { /* named in the pass's degraded; the other sources still land */ degraded.push(`git-unread: ${p.name}: ${e instanceof Error ? e.message.slice(0, 100) : String(e)}`) }
      await deps.yieldNow()
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

    const report: PassReport = { at: new Date(started).toISOString(), ms: deps.now() - started, docs, transcripts: { read, turns, left }, commits, documents, embedded, ...(sources ? { sources } : {}), degraded }
    ix.setMeta('last_pass', JSON.stringify(report))
    // Each source's own mark for Memory's freshness (spec 2026-11-20 §3): a source that failed keeps its last read.
    const prev = ix.meta('sources')
    ix.setMeta('sources', JSON.stringify(nextMarks(prev ? JSON.parse(prev) as Partial<SourceMarks> : null, { at: report.at, transcripts: { left }, degraded, boardMore })))
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

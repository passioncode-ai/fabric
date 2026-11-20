// #region estate-wiring — docs: docs/evidence/specs/2026-11-19-estate-index-and-graph.md#31-where-it-lives-adr-0200
/**
 * The estate index in the main process (ADR-0200): its file in `userData/estate-index`, its passes (the first a minute
 * after start, then every five minutes, back to back while transcripts are left to read), and what the CEO's doors and
 * the window read of it. A file this Fabric cannot open (another schema, a broken file) is moved aside and built again;
 * one that still cannot be opened leaves the doors answering why.
 */
import { mkdirSync, renameSync, rmSync } from 'node:fs'
import path from 'node:path'
import { catalogue as catalogueOf, type CatalogueInput, type CatalogueRow } from '../shared/estateSearch.ts'
import { EstateIndex, type Embedder } from './estateIndex.ts'
import { createEstateRunner, JOURNAL_TYPES, ollamaEmbedder, readOrganizations, type EstateRunner, type PassReport } from './estateRun.ts'
import { defaultRoots } from './estateSources.ts'
import { createKnowledgeOperations, pastConsoles, recallSession, type KnowledgeOperations, type Recalled } from './knowledgeTools.ts'

type Rows = Array<Record<string, unknown>>
interface Query {
  eq(c: string, v: unknown): Query
  in(c: string, v: readonly unknown[]): Query
  gt(c: string, v: unknown): Query
  order(c: string, o: { ascending: boolean }): Query
  limit(n: number): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
}

export interface EstateWiringDeps {
  userData: string
  store: { select(table: string, columns: string): unknown }
  /** The operator's board door: messages after a sequence, every thread (`commsOperatorRead.ts#list`). */
  boardList(afterSeq: number): Promise<{ messages: Rows; last: number; more: boolean }>
  record(op: string, outcome: 'ok' | 'failed', detail: Record<string, unknown>): void
  onQuit(fn: () => void): void
}

export const FIRST_PASS_MS = 60_000
export const PASS_EVERY_MS = 5 * 60_000
export const CATCH_UP_MS = 5_000

export interface Estate {
  knowledge: KnowledgeOperations
  catalogue(): Promise<CatalogueRow[]>
  recall(id: string): Promise<Recalled | null>
  pastConsoles(limit: number): Promise<Recalled[]>
  /** The window's search: the same hybrid search the CEO's door runs. */
  index(): EstateIndex | { unavailable: string }
  embedder(): Promise<Embedder | null>
}

export function startEstateIndex(deps: EstateWiringDeps): Estate {
  const dir = path.join(deps.userData, 'estate-index')
  const file = path.join(dir, 'index.sqlite')
  let ix: EstateIndex | null = null
  let unavailable = 'not opened yet'
  let runner: EstateRunner | null = null
  let timer: NodeJS.Timeout | null = null
  let stopped = false

  const read = async (q: unknown, what: string): Promise<Rows> => {
    const r = await (q as Query).limit(1000)
    if (r.error) throw new Error(`${what} could not be read: ${r.error.message}`)
    return (r.data ?? []) as Rows
  }
  const projects = async (): Promise<CatalogueInput[]> => {
    const q = (deps.store.select('projects', 'id,name,repo_path,status') as Query).eq('status', 'active')
    return (await read(q, 'the projects')).map((p) => ({ id: String(p.id), name: String(p.name), repo_path: (p.repo_path as string | null) ?? null }))
  }
  let embedderCache: { at: number; value: Embedder | null } | null = null
  const embedder = async (): Promise<Embedder | null> => {
    if (embedderCache && Date.now() - embedderCache.at < 60_000) return embedderCache.value
    const value = await ollamaEmbedder().catch(() => null)
    embedderCache = { at: Date.now(), value }
    return value
  }

  function open(): EstateIndex | null {
    if (ix) return ix
    try {
      mkdirSync(dir, { recursive: true })
      try { ix = new EstateIndex(file) } catch (e) {
        // Derived and deletable (ADR-0200): a file this Fabric cannot read is moved aside and built again.
        deps.record('estate.index.reset', 'ok', { reason: e instanceof Error ? e.message.slice(0, 200) : String(e) })
        for (const ext of ['', '-wal', '-shm']) { try { renameSync(file + ext, `${file}${ext}.unreadable`) } catch { /* not there */ } }
        ix = new EstateIndex(file)
      }
      unavailable = ''
      runner = createEstateRunner({
        index: ix, projects, organizations: () => readOrganizations(),
        page: async (table, col, after, limit) => read((deps.store.select(table, '*') as Query).gt(col, after).order(col, { ascending: true }), table).then((r) => r.slice(0, limit)),
        // The type filter is bounded by the vocabulary written in code (`estateRun.ts#JOURNAL_TYPES`), never by the
        // data: whatever the runner passes is cut to that list first (`check-list-reads.mjs`).
        journal: async (types, after) => read((deps.store.select('journal', 'seq,type,occurred_at,project_id,actor,payload') as Query).in('type', [...JOURNAL_TYPES.filter((t) => types.includes(t))]).gt('seq', after).order('seq', { ascending: true }), 'the journal'),
        board: deps.boardList, roots: () => defaultRoots(), embedder, now: Date.now,
        yieldNow: () => new Promise((r) => setImmediate(r))
      })
      return ix
    } catch (e) { /* the doors answer why the index is not open; the operations log records it */
      unavailable = e instanceof Error ? e.message.slice(0, 200) : String(e)
      deps.record('estate.index.open', 'failed', { reason: unavailable })
      return null
    }
  }

  async function pass(budgetMs: number): Promise<PassReport> {
    if (!open() || !runner) throw new Error(`the index is not open: ${unavailable}`)
    const report = await runner.pass(budgetMs)
    deps.record('estate.index.pass', report.degraded.some((d) => /unread|failed/.test(d)) ? 'failed' : 'ok', {
      ms: report.ms, docs: report.docs, transcripts: report.transcripts, commits: report.commits, documents: report.documents, embedded: report.embedded, degraded: report.degraded.slice(0, 8) })
    return report
  }

  function schedule(ms: number): void {
    if (stopped) return
    timer = setTimeout(() => {
      pass(ms === FIRST_PASS_MS ? 60_000 : 20_000)
        .then((r) => schedule(r.transcripts.left > 0 ? CATCH_UP_MS : PASS_EVERY_MS))
        .catch((e: unknown) => { deps.record('estate.index.pass', 'failed', { reason: e instanceof Error ? e.message.slice(0, 200) : String(e) }); schedule(PASS_EVERY_MS) })
    }, ms)
    timer.unref?.()
  }
  schedule(FIRST_PASS_MS)
  deps.onQuit(() => { stopped = true; if (timer) clearTimeout(timer); try { ix?.close() } catch { /* closing at quit: nothing left to keep */ } })

  async function catalogue(): Promise<CatalogueRow[]> {
    const all = await projects()
    const known = new Map<string, { role?: CatalogueRow['role']; of?: string | null; context?: string }>()
    const index = open()
    if (index) for (const n of index.db.prepare("SELECT id, attrs FROM nodes WHERE kind = 'project'").all() as Array<{ id: string; attrs: string | null }>)
      known.set(n.id.slice('project:'.length), n.attrs ? JSON.parse(n.attrs) : {})
    // The roles the last pass measured (Git's worktrees included); from the folders alone for a project it has not read.
    const fresh = catalogueOf(all)
    return fresh.map((r) => { const k = known.get(r.id); return k?.role ? { ...r, role: k.role, of: k.of ?? null, context: k.context } as CatalogueRow : r })
  }

  let labelsCache: { at: number; value: { names: Map<string, string>; personal: string } } | null = null
  const knowledge = createKnowledgeOperations({
    index: () => open() ?? { unavailable },
    embedder,
    catalogue,
    refresh: () => pass(20_000),
    rebuild: async () => {
      try { ix?.close() } catch { /* rebuilt from nothing either way */ }
      ix = null
      runner = null
      for (const ext of ['', '-wal', '-shm']) rmSync(file + ext, { force: true })
      return pass(60_000)
    },
    record: (op, detail) => deps.record(op, detail.outcome === 'failed' ? 'failed' : 'ok', detail),
    file,
    // Memory's graph names each organization as Observatory does; the person's own by its own organization's name.
    labels: () => {
      if (labelsCache && Date.now() - labelsCache.at < 60_000) return labelsCache.value
      let value = { names: new Map<string, string>(), personal: 'personal' }
      try { const o = readOrganizations(); value = { names: o.names, personal: (o.personal && o.names.get(o.personal)) || 'personal' } } catch { /* Observatory unread: the contexts' own ids stand for their names */ }
      labelsCache = { at: Date.now(), value }
      return value
    }
  })

  return {
    knowledge,
    catalogue,
    recall: async (id) => { const index = open(); return index ? recallSession(index, id) : null },
    pastConsoles: async (limit) => { const index = open(); return index ? pastConsoles(index, limit) : [] },
    index: () => open() ?? { unavailable },
    embedder
  }
}
// #endregion estate-wiring

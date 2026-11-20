// #region memory-read — docs: docs/evidence/specs/2026-11-20-memory-dashboard.md#2-one-module-three-callers
/**
 * Memory's reads over the estate index (spec 2026-11-20): the overview with each source's freshness, the graph of
 * organizations and projects, and what changed in a window. The window, the CEO's doors and the voice tools reach these
 * only through `knowledgeTools.ts#createKnowledgeOperations` (operations `memory.overview`, `memory.graph`,
 * `memory.changes`), so all three read the same answer. Read only: nothing here writes the index.
 */
import { statSync } from 'node:fs'
import type { EstateIndex } from './estateIndex.ts'
import {
  composeMemoryGraph, freshnessOf, MEMORY_SOURCES, type MemoryChange, type MemoryChanges, type MemoryGraph, type MemoryIndexOverview,
  type ProjectCounts, type SourceMarks
} from '../shared/memory.ts'

export interface MemoryLabels {
  /** Organization id (Observatory's) to its display name. */
  names: ReadonlyMap<string, string>
  /** How the person's own context is named on the dashboard. */
  personal: string
}

type Row = Record<string, unknown>
const n = (v: unknown): number => (typeof v === 'number' ? v : typeof v === 'bigint' ? Number(v) : Number(v ?? 0))
const s = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const labelOf = (context: string, l: MemoryLabels): string => (context === 'personal' ? l.personal : l.names.get(context.slice('org:'.length)) ?? context.slice('org:'.length))

/** What the index holds, how it was read and how fresh each source is. */
export function memoryOverview(ix: EstateIndex, file: string | null, labels: MemoryLabels, now = Date.now()): MemoryIndexOverview {
  const all = (sql: string, ...args: Array<string | number>) => ix.db.prepare(sql).all(...args) as Row[]
  const one = (sql: string, ...args: Array<string | number>) => n((ix.db.prepare(sql).get(...args) as Row | undefined)?.n)
  const byKind = Object.fromEntries(all('SELECT kind, count(*) AS n FROM docs GROUP BY kind').map((r) => [String(r.kind), n(r.n)]))
  const bySource = Object.fromEntries(all('SELECT source, count(*) AS n FROM docs GROUP BY source').map((r) => [String(r.source), n(r.n)]))
  const byContext = all('SELECT context, count(*) AS n FROM docs GROUP BY context ORDER BY n DESC').map((r) => ({ context: String(r.context), label: labelOf(String(r.context), labels), docs: n(r.n) }))
  const docs = Object.values(byKind).reduce((a, b) => a + b, 0)
  const model = s((ix.db.prepare('SELECT model, count(*) AS n FROM vectors GROUP BY model ORDER BY n DESC LIMIT 1').get() as Row | undefined)?.model)
  const marksRaw = ix.meta('sources')
  const marks = marksRaw ? JSON.parse(marksRaw) as Partial<SourceMarks> : {}
  const lastRaw = ix.meta('last_pass')
  let bytes: number | null = null
  if (file) { bytes = 0; for (const ext of ['', '-wal']) { try { bytes += statSync(file + ext).size } catch { /* no write-ahead log yet: the file alone */ } } }
  return {
    ok: true,
    at: new Date(now).toISOString(),
    docs,
    nodes: one('SELECT count(*) AS n FROM nodes'),
    edges: one('SELECT count(*) AS n FROM edges'),
    bytes,
    projects: one("SELECT count(DISTINCT project) AS n FROM docs WHERE project IS NOT NULL"),
    sessions: byKind.session ?? 0,
    byKind, bySource, byContext,
    vectors: { model, embedded: model ? one('SELECT count(*) AS n FROM vectors WHERE model = ?', model) : 0, of: docs },
    sources: MEMORY_SOURCES.map((source) => {
      const m = marks[source] ?? { readAt: null, left: 0, unread: 0, error: null }
      return { source, state: freshnessOf(m, now), ...m }
    }),
    lastPass: lastRaw ? JSON.parse(lastRaw) as Record<string, unknown> : null
  }
}

/**
 * The organizations and their projects. A project's documents are counted by its name (the index places a document
 * under the canonical project of its folder, `estateSources.ts#placeOf`); a worktree, a duplicate or a temporary folder
 * is not drawn apart from its canonical project. The board's requests between two projects are the lines between them.
 */
export function memoryGraph(ix: EstateIndex, labels: MemoryLabels, context?: string): MemoryGraph {
  const rows = ix.db.prepare("SELECT id, label, attrs FROM nodes WHERE kind = 'project'").all() as Row[]
  const projects = new Map<string, ProjectCounts>()
  for (const r of rows) {
    const a = r.attrs ? JSON.parse(String(r.attrs)) as Row : {}
    const role = s(a.role)
    if (role && role !== 'canonical') continue
    const ctx = s(a.context) ?? 'personal'
    if (context && ctx !== context) continue
    projects.set(String(r.label), { id: String(r.id).slice('project:'.length), name: String(r.label), context: ctx, role, folder: s(a.folder), docs: 0, byKind: {}, lastAt: null })
  }
  for (const r of ix.db.prepare('SELECT project, kind, count(*) AS n, max(at) AS last FROM docs WHERE project IS NOT NULL GROUP BY project, kind').all() as Row[]) {
    const p = projects.get(String(r.project))
    if (!p) continue
    p.byKind[String(r.kind)] = n(r.n)
    p.docs += n(r.n)
    const last = s(r.last)
    if (last && (!p.lastAt || last > p.lastAt)) p.lastAt = last
  }
  // A request belongs to its sender's project and relates to its target's: one count per ordered pair.
  const pairs = (ix.db.prepare(`SELECT b.dst AS a, r.dst AS b, count(*) AS n FROM edges r JOIN edges b ON b.src = r.src AND b.rel = 'belongs-to'
    WHERE r.rel = 'relates-to' AND r.src LIKE 'message:%' AND r.dst LIKE 'project:%' AND b.dst LIKE 'project:%' GROUP BY b.dst, r.dst`).all() as Row[])
    .map((r) => ({ from: String(r.a).slice('project:'.length), to: String(r.b).slice('project:'.length), n: n(r.n) }))
  return composeMemoryGraph([...projects.values()], pairs, labels.names, labels.personal)
}

/** The newest documents per project and kind in the last `hours`, at most `per` of each, newest groups first. */
export function memoryChanges(ix: EstateIndex, hours: number, project?: string, now = Date.now(), per = 8): MemoryChanges {
  const since = new Date(now - hours * 3_600_000).toISOString()
  const filter = project ? ' AND project = ?' : ''
  const args: Array<string | number> = project ? [since, project] : [since]
  const groups = ix.db.prepare(`SELECT project, kind, count(*) AS n, max(at) AS last FROM docs WHERE at >= ?${filter} GROUP BY project, kind ORDER BY last DESC LIMIT 120`).all(...args) as Row[]
  const newest = ix.db.prepare(`SELECT id, title, at, node, project, kind FROM (
      SELECT id, title, at, node, project, kind, row_number() OVER (PARTITION BY project, kind ORDER BY at DESC) AS k FROM docs WHERE at >= ?${filter}
    ) WHERE k <= ? ORDER BY at DESC`).all(...args, per) as Row[]
  const byGroup = new Map<string, MemoryChange['newest']>()
  for (const r of newest) {
    const k = `${s(r.project) ?? ''}|${String(r.kind)}`
    const list = byGroup.get(k) ?? []
    list.push({ id: String(r.id), title: String(r.title).slice(0, 200), at: s(r.at), node: String(r.node) })
    byGroup.set(k, list)
  }
  const changes = groups.map((g) => ({ project: s(g.project), kind: String(g.kind), count: n(g.n), newest: byGroup.get(`${s(g.project) ?? ''}|${String(g.kind)}`) ?? [] }))
  return { ok: true, since, hours, total: changes.reduce((a, c) => a + c.count, 0), changes, capped: groups.length >= 120 }
}
// #endregion memory-read

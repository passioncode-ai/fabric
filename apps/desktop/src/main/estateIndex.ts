// #region estate-index — docs: docs/evidence/specs/2026-11-19-estate-index-and-graph.md#3-the-index
/**
 * The estate index (ADR-0200): one local SQLite file of everything the operator's agents did, searchable by words,
 * trigrams and meaning, with the graph of what relates to what in the same file. Derived and deletable: the journal
 * stays the spine (ADR-0014), nothing here decides a write, and a rebuild is deleting the file.
 *
 * `node:sqlite` (Electron 44 carries Node 24.18.1; FTS5 and the trigram tokenizer are compiled in). Synchronous calls,
 * each small: the collectors hand documents over in batches and yield between files (`estateRun.ts`).
 */
import { createHash } from 'node:crypto'
import { DatabaseSync, type StatementSync } from 'node:sqlite'
import { terms } from '../shared/boardSearch.ts'
import { redact, redactPayload } from '../shared/redact.ts'
import { fuse, passage, trigramQuery, wordsQuery, type DocKind, type Ranking } from '../shared/estateSearch.ts'

/** 3 (0.3.27 review DA-49): every document, label and attribute is redacted as it is written; an index of an earlier
 *  schema may hold a secret as typed, so it is removed and built again, never read. */
export const SCHEMA_VERSION = '3'
/** The text the trigram half reads of one document: its identifiers and phrases sit near the start. */
export const TRI_CHARS = 1200
/** How many candidates each ranking contributes before fusion. */
const CANDIDATES = 300
/** At most this many hits of one node (one session's many turns never fill the page). */
const PER_NODE = 2

export interface IndexDoc {
  id: string
  kind: DocKind
  /** Fabric's own readers, or another source's name (`fabric-inbox`, spec 2026-11-20 §10). */
  source: 'claude' | 'codex' | 'fabric' | 'git' | (string & {})
  node: string
  title: string
  body: string
  /** What the trigram half reads; the title and body when absent. A transcript gives its typed prompts only. */
  tri?: string
  at: string | null
  folder?: string | null
  project?: string | null
  context?: string
  sessionId?: string | null
  runtime?: string | null
  resume?: string | null
  path?: string | null
  lineStart?: number | null
  lineEnd?: number | null
}

export interface IndexNode { id: string; kind: string; label: string; at?: string | null; attrs?: Record<string, unknown> }
export interface IndexEdge { src: string; rel: string; dst: string; at?: string | null; evidence?: string | null }

export interface SearchOpts { kinds?: readonly string[]; project?: string; context?: string; limit?: number }

export interface Hit {
  id: string
  kind: string
  title: string
  passage: string
  at: string | null
  node: string
  folder: string | null
  project: string | null
  context: string
  session_id: string | null
  runtime: string | null
  resume: string | null
  cite: string | null
  digest: string
  via: Ranking[]
  score: number
}

/** Turns a text into a vector, or throws; absent when no local model serves one. */
export type Embedder = { model: string; embed(texts: string[], query: boolean): Promise<Float32Array[]> }

const sha = (s: string): string => createHash('sha256').update(s).digest('hex')

function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length && i < b.length; i++) { dot += a[i]! * b[i]!; na += a[i]! * a[i]!; nb += b[i]! * b[i]! }
  return na && nb ? dot / Math.sqrt(na * nb) : 0
}

/** A statement whose `run()` answers its last insert's rowid as a BigInt, so a rowid past 2^53 never throws. */
/** A file's saved state redacted value by value when it is JSON; its text otherwise. */
function redactState(state: string): string {
  let parsed: unknown
  try { parsed = JSON.parse(state) } catch { /* not JSON: redacted as text */ return redact(state).text }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return redact(state).text
  // The folder and the branch are kept as read: they name where the session ran and never hold a secret the index needs
  // to hide, while a rule that matched a folder's name would cut the session from its project (run ten, DA-64).
  const { cwd, branch, ...rest } = parsed as Record<string, unknown>
  return JSON.stringify({ ...redactPayload(rest).payload, ...(cwd !== undefined ? { cwd } : {}), ...(branch !== undefined ? { branch } : {}) })
}

function bigRowids(st: StatementSync): StatementSync { st.setReadBigInts(true); return st }

export class EstateIndex {
  readonly db: DatabaseSync
  private readonly st: Record<string, StatementSync>

  constructor(file: string) {
    this.db = new DatabaseSync(file)
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = OFF;')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE IF NOT EXISTS docs (
        rowid INTEGER PRIMARY KEY, id TEXT UNIQUE NOT NULL, kind TEXT NOT NULL, source TEXT NOT NULL, node TEXT NOT NULL,
        title TEXT NOT NULL, body TEXT NOT NULL, at TEXT, folder TEXT, project TEXT, context TEXT NOT NULL DEFAULT 'personal',
        session_id TEXT, runtime TEXT, resume TEXT, path TEXT, line_start INTEGER, line_end INTEGER, digest TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS docs_node ON docs(node);
      CREATE INDEX IF NOT EXISTS docs_session ON docs(session_id);
      -- Contentless (schema 2): the text is in docs already; a copy in each FTS table doubled the file (measured 2026-11-19:
      -- 866 MB of 2.5 GB). contentless_delete lets a changed document's row be replaced.
      CREATE VIRTUAL TABLE IF NOT EXISTS docs_words USING fts5(stems, content = '', contentless_delete = 1, tokenize = "unicode61 tokenchars '-_./'");
      CREATE VIRTUAL TABLE IF NOT EXISTS docs_tri USING fts5(text, content = '', contentless_delete = 1, tokenize = 'trigram');
      CREATE TABLE IF NOT EXISTS vectors (digest TEXT NOT NULL, model TEXT NOT NULL, vec BLOB NOT NULL, PRIMARY KEY (digest, model));
      CREATE TABLE IF NOT EXISTS nodes (id TEXT PRIMARY KEY, kind TEXT NOT NULL, label TEXT NOT NULL, at TEXT, attrs TEXT);
      CREATE TABLE IF NOT EXISTS edges (src TEXT NOT NULL, rel TEXT NOT NULL, dst TEXT NOT NULL, at TEXT, evidence TEXT, PRIMARY KEY (src, rel, dst));
      CREATE INDEX IF NOT EXISTS edges_dst ON edges(dst);
      -- Memory's reads (spec 2026-11-20): «what changed» by time, and the counts by kind, source, context and project from
      -- covering indexes, never a scan of the rows that hold the text (17 s on 195 000 documents, 2026-11-20).
      CREATE INDEX IF NOT EXISTS docs_at ON docs(at);
      CREATE INDEX IF NOT EXISTS docs_counts ON docs(kind, source, context);
      CREATE INDEX IF NOT EXISTS docs_project ON docs(project, kind, at);
      CREATE TABLE IF NOT EXISTS files (path TEXT PRIMARY KEY, size INTEGER NOT NULL, mtime REAL NOT NULL, offset INTEGER NOT NULL, lines INTEGER NOT NULL, state TEXT);
    `)
    const version = this.meta('schema')
    if (version === null) this.setMeta('schema', SCHEMA_VERSION)
    else if (version !== SCHEMA_VERSION) throw new Error(`the estate index is schema ${version}, this Fabric reads ${SCHEMA_VERSION}: rebuild it`)
    this.st = {
      upsert: this.db.prepare(`INSERT INTO docs (id, kind, source, node, title, body, at, folder, project, context, session_id, runtime, resume, path, line_start, line_end, digest)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, source = excluded.source, node = excluded.node, title = excluded.title, body = excluded.body,
          at = excluded.at, folder = excluded.folder, project = excluded.project, context = excluded.context, session_id = excluded.session_id,
          runtime = excluded.runtime, resume = excluded.resume, path = excluded.path, line_start = excluded.line_start, line_end = excluded.line_end,
          digest = excluded.digest
        RETURNING rowid`),
      rowOf: this.db.prepare('SELECT rowid, digest FROM docs WHERE id = ?'),
      // The FTS writes answer their last insert's rowid as a BigInt: a delete from a contentless_delete table writes a
      // tombstone page whose rowid is above 2^53 (segment id + 2^16, shifted by 37), and node:sqlite refuses to answer
      // that as a number, failing the write (the 2026-11-20 measurement: «Value is too large … 9008161327415296»).
      wordsDel: bigRowids(this.db.prepare('DELETE FROM docs_words WHERE rowid = ?')),
      wordsIns: bigRowids(this.db.prepare('INSERT INTO docs_words (rowid, stems) VALUES (?, ?)')),
      triDel: bigRowids(this.db.prepare('DELETE FROM docs_tri WHERE rowid = ?')),
      triIns: bigRowids(this.db.prepare('INSERT INTO docs_tri (rowid, text) VALUES (?, ?)')),
      node: this.db.prepare(`INSERT INTO nodes (id, kind, label, at, attrs) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, label = excluded.label, at = coalesce(excluded.at, nodes.at), attrs = coalesce(excluded.attrs, nodes.attrs)`),
      edge: this.db.prepare(`INSERT INTO edges (src, rel, dst, at, evidence) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(src, rel, dst) DO UPDATE SET at = coalesce(excluded.at, edges.at), evidence = coalesce(excluded.evidence, edges.evidence)`),
      file: this.db.prepare('SELECT size, mtime, offset, lines, state FROM files WHERE path = ?'),
      fileSet: this.db.prepare(`INSERT INTO files (path, size, mtime, offset, lines, state) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(path) DO UPDATE SET size = excluded.size, mtime = excluded.mtime, offset = excluded.offset, lines = excluded.lines, state = excluded.state`)
    }
  }

  close(): void { this.db.close() }

  meta(key: string): string | null {
    const r = this.db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined
    return r?.value ?? null
  }

  setMeta(key: string, value: string): void {
    this.db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value)
  }

  /** Writes documents in one transaction; an unchanged document (same digest) keeps its FTS rows. */
  putDocs(docs: readonly IndexDoc[]): number {
    let changed = 0
    this.tx(() => {
      for (const d of docs) {
        // Redacted as written (0.3.27 review DA-49): the index serves the CEO's model through its doors, and a key a
        // person typed into any session must not reach it, nor stay in the file.
        const title = redact(d.title).text
        const body = redact(d.body.slice(0, 20_000)).text
        const tri = d.tri === undefined ? undefined : redact(d.tri).text
        const digest = sha(`${title}\n${body}`)
        const before = this.st.rowOf!.get(d.id) as { rowid: number; digest: string } | undefined
        const r = this.st.upsert!.get(d.id, d.kind, d.source, d.node, title.slice(0, 400), body, d.at ?? null, d.folder ?? null,
          d.project ?? null, d.context ?? 'personal', d.sessionId ?? null, d.runtime ?? null, d.resume ?? null, d.path ?? null,
          d.lineStart ?? null, d.lineEnd ?? null, digest) as { rowid: number }
        if (before && before.digest === digest) continue
        changed++
        this.st.wordsDel!.run(r.rowid)
        this.st.triDel!.run(r.rowid)
        this.st.wordsIns!.run(r.rowid, terms(`${title}\n${body}`.slice(0, 6000)).join(' '))
        this.st.triIns!.run(r.rowid, (tri ?? `${title}\n${body}`).slice(0, TRI_CHARS))
      }
    })
    return changed
  }

  /**
   * Removes the documents under a node prefix that the newest read did not write (0.3.27 review ER-68): a section's id
   * carries its first line, so a line inserted above it, or a file removed, would otherwise leave the old text to be
   * found, cited at lines that now say something else, and confirmed by `quote.check`. Returns how many went.
   */
  pruneDocs(prefix: string, keep: ReadonlySet<string>): number {
    let gone = 0
    this.tx(() => {
      const rows = this.db.prepare('SELECT rowid, id FROM docs WHERE substr(node, 1, ?) = ?').all(prefix.length, prefix) as Array<{ rowid: number; id: string }>
      for (const r of rows) {
        if (keep.has(r.id)) continue
        this.st.wordsDel!.run(r.rowid)
        this.st.triDel!.run(r.rowid)
        this.db.prepare('DELETE FROM docs WHERE rowid = ?').run(r.rowid)
        gone++
      }
    })
    return gone
  }

  putGraph(nodes: readonly IndexNode[], edges: readonly IndexEdge[]): void {
    this.tx(() => {
      for (const n of nodes) this.st.node!.run(n.id, n.kind, redact(n.label).text.slice(0, 300), n.at ?? null, n.attrs ? JSON.stringify(redactPayload(n.attrs).payload) : null)
      for (const e of edges) if (e.src !== e.dst) this.st.edge!.run(e.src, e.rel, e.dst, e.at ?? null, (e.evidence ? redact(e.evidence).text.slice(0, 300) : null))
    })
  }

  fileState(path: string): { size: number; mtime: number; offset: number; lines: number; state: string | null } | null {
    return (this.st.file!.get(path) as { size: number; mtime: number; offset: number; lines: number; state: string | null } | undefined) ?? null
  }

  setFileState(path: string, s: { size: number; mtime: number; offset: number; lines: number; state: string | null }): void {
    // A transcript's state carries its first prompts: redacted as written too (0.3.27 review DA-49), value by value, so
    // the JSON stays whole (ER-81: a redaction over the text ate its closing quote and brackets).
    this.st.fileSet!.run(path, s.size, s.mtime, s.offset, s.lines, s.state === null ? null : redactState(s.state))
  }

  private tx(fn: () => void): void {
    this.db.exec('BEGIN')
    try { fn(); this.db.exec('COMMIT') } catch (e) { this.db.exec('ROLLBACK'); throw e }
  }

  /** One FTS ranking: the index alone answers the best rowids (a join with docs made the planner walk every match,
   *  4 s on 180 000 documents), then the documents are read by rowid and filtered here. */
  private ranked(table: 'docs_words' | 'docs_tri', match: string, o: SearchOpts): string[] {
    const filtering = !!(o.kinds?.length || o.project || o.context)
    const rows = this.db.prepare(`SELECT rowid FROM ${table} WHERE ${table} MATCH ? ORDER BY bm25(${table}) LIMIT ?`).all(match, filtering ? CANDIDATES * 4 : CANDIDATES) as Array<{ rowid: number }>
    const get = this.db.prepare('SELECT id, kind, project, folder, context FROM docs WHERE rowid = ?')
    const out: string[] = []
    const dir = o.project?.replace(/\/+$/, '')
    for (const r of rows) {
      const d = get.get(r.rowid) as { id: string; kind: string; project: string | null; folder: string | null; context: string } | undefined
      if (!d) continue
      if (o.kinds?.length && !o.kinds.includes(d.kind)) continue
      if (o.context && d.context !== o.context) continue
      if (dir && d.project !== o.project && d.folder !== dir && !(d.folder ?? '').startsWith(`${dir}/`)) continue
      out.push(d.id)
      if (out.length >= CANDIDATES) break
    }
    return out
  }

  /** The hybrid search (spec §3.4): words, trigrams and, given an embedder, meaning; fused by reciprocal rank. */
  async search(query: string, o: SearchOpts = {}, embedder: Embedder | null = null): Promise<{ hits: Hit[]; degraded: string[]; via: Ranking[] }> {
    const degraded: string[] = []
    const rankings: Partial<Record<Ranking, string[]>> = {}
    const wq = wordsQuery(query)
    try {
      if (wq) rankings.words = this.ranked('docs_words', wq, o)
    } catch (e) { /* said in the answer's degraded, never thrown at the caller */ degraded.push(`words-failed: ${e instanceof Error ? e.message.slice(0, 120) : String(e)}`) }
    const tq = trigramQuery(query)
    try {
      if (tq) rankings.trigram = this.ranked('docs_tri', tq, o)
    } catch (e) { /* said in the answer's degraded, never thrown at the caller */ degraded.push(`trigram-failed: ${e instanceof Error ? e.message.slice(0, 120) : String(e)}`) }
    if (!embedder) degraded.push('vector-unavailable')
    else {
      try {
        const rows = this.db.prepare('SELECT v.digest, v.vec, d.id, d.kind, d.project, d.folder, d.context FROM vectors v JOIN docs d ON d.digest = v.digest WHERE v.model = ?').all(embedder.model) as
          Array<{ digest: string; vec: Uint8Array; id: string; kind: string; project: string | null; folder: string | null; context: string }>
        if (!rows.length) degraded.push('vectors-empty')
        else {
          const [qv] = await embedder.embed([query], true)
          const keep = rows.filter((r) => (!o.kinds?.length || o.kinds.includes(r.kind)) && (!o.context || r.context === o.context) &&
            (!o.project || r.project === o.project || r.folder === o.project || (r.folder ?? '').startsWith(`${o.project}/`)))
          rankings.vector = keep.map((r) => ({ id: r.id, s: cosine(qv!, new Float32Array(r.vec.buffer, r.vec.byteOffset, r.vec.byteLength / 4)) }))
            .filter((x) => x.s > 0.3).sort((a, b) => b.s - a.s).slice(0, CANDIDATES).map((x) => x.id)
          const total = (this.db.prepare('SELECT count(*) AS n FROM docs').get() as { n: number }).n
          if (rows.length < total) degraded.push('vectors-partial')
        }
      } catch (e) { /* said in the answer's degraded, never thrown at the caller */ degraded.push(`embedding-failed: ${e instanceof Error ? e.message.slice(0, 120) : String(e)}`) }
    }
    const fused = fuse(rankings)
    const limit = Math.min(Math.max(o.limit ?? 10, 1), 50)
    const perNode = new Map<string, number>()
    const hits: Hit[] = []
    const get = this.db.prepare('SELECT * FROM docs WHERE id = ?')
    for (const f of fused) {
      if (hits.length >= limit) break
      const d = get.get(f.id) as Record<string, unknown> | undefined
      if (!d) continue
      const node = String(d.node)
      const seen = perNode.get(node) ?? 0
      if (seen >= PER_NODE) continue
      perNode.set(node, seen + 1)
      const path = d.path as string | null
      hits.push({
        id: f.id, kind: String(d.kind), title: String(d.title), passage: passage(String(d.body), query), at: (d.at as string | null) ?? null,
        node, folder: (d.folder as string | null) ?? null, project: (d.project as string | null) ?? null, context: String(d.context),
        session_id: (d.session_id as string | null) ?? null, runtime: (d.runtime as string | null) ?? null, resume: (d.resume as string | null) ?? null,
        cite: path ? (d.line_start != null ? `${path}:${d.line_start}${d.line_end && d.line_end !== d.line_start ? `-${d.line_end}` : ''}` : path) : null,
        digest: String(d.digest), via: f.via, score: Number(f.score.toFixed(5))
      })
    }
    return { hits, degraded, via: Object.keys(rankings) as Ranking[] }
  }

  /** Documents without a vector for `model`, newest first, at most `limit`. */
  unembedded(model: string, limit: number): Array<{ digest: string; text: string }> {
    return (this.db.prepare(`SELECT d.digest, d.title || char(10) || substr(d.body, 1, 1500) AS text FROM docs d
      WHERE NOT EXISTS (SELECT 1 FROM vectors v WHERE v.digest = d.digest AND v.model = ?) GROUP BY d.digest ORDER BY max(d.at) DESC LIMIT ?`).all(model, limit) as Array<{ digest: string; text: string }>)
  }

  putVectors(model: string, rows: ReadonlyArray<{ digest: string; vec: Float32Array }>): void {
    const ins = this.db.prepare('INSERT OR REPLACE INTO vectors (digest, model, vec) VALUES (?, ?, ?)')
    this.tx(() => { for (const r of rows) ins.run(r.digest, model, new Uint8Array(r.vec.buffer, r.vec.byteOffset, r.vec.byteLength)) })
  }

  doc(id: string): Record<string, unknown> | null {
    return (this.db.prepare('SELECT * FROM docs WHERE id = ?').get(id) as Record<string, unknown> | undefined) ?? null
  }

  /** A node with its label, attributes, edge counts and its first documents. */
  node(id: string): Record<string, unknown> | null {
    const n = this.db.prepare('SELECT * FROM nodes WHERE id = ?').get(id) as Record<string, unknown> | undefined
    const docs = this.db.prepare('SELECT id, kind, title, at, path, line_start, line_end FROM docs WHERE node = ? ORDER BY at DESC LIMIT 20').all(id)
    const out = (this.db.prepare('SELECT count(*) AS n FROM edges WHERE src = ?').get(id) as { n: number }).n
    const inn = (this.db.prepare('SELECT count(*) AS n FROM edges WHERE dst = ?').get(id) as { n: number }).n
    if (!n && !docs.length && !out && !inn) return null
    return { id, known: !!n, kind: n?.kind ?? null, label: n?.label ?? null, at: n?.at ?? null, attrs: n?.attrs ? JSON.parse(String(n.attrs)) : null, edges_out: out, edges_in: inn, docs }
  }

  private edgesOf(id: string, rels?: readonly string[]): Array<{ src: string; rel: string; dst: string; at: string | null; evidence: string | null }> {
    const r = rels?.length ? ` AND rel IN (${rels.map(() => '?').join(',')})` : ''
    const a = rels ?? []
    return [
      ...(this.db.prepare(`SELECT * FROM edges WHERE src = ?${r} LIMIT 500`).all(id, ...a) as Array<{ src: string; rel: string; dst: string; at: string | null; evidence: string | null }>),
      ...(this.db.prepare(`SELECT * FROM edges WHERE dst = ?${r} LIMIT 500`).all(id, ...a) as Array<{ src: string; rel: string; dst: string; at: string | null; evidence: string | null }>)
    ]
  }

  private label(id: string): { kind: string | null; label: string | null; known: boolean } {
    const n = this.db.prepare('SELECT kind, label FROM nodes WHERE id = ?').get(id) as { kind: string; label: string } | undefined
    return n ? { kind: n.kind, label: n.label, known: true } : { kind: id.split(':')[0] ?? null, label: null, known: false }
  }

  /** A node many others belong to (a project): reached and listed, never walked through, or two steps from a task
   *  would be every task of its project. The start itself is always walked. */
  private hub(id: string): boolean {
    return id.startsWith('project:') || id.startsWith('agent:')
  }

  /** Breadth-first over edges both ways (spec §4.3). */
  neighbours(start: string, depth = 1, limit = 100, rels?: readonly string[]): { start: Record<string, unknown> | null; nodes: Array<Record<string, unknown>>; capped: boolean } {
    const d = Math.min(Math.max(depth, 1), 3)
    const cap = Math.min(Math.max(limit, 1), 200)
    const seen = new Set([start])
    let frontier = [start]
    const nodes: Array<Record<string, unknown>> = []
    let capped = false
    for (let hop = 1; hop <= d && frontier.length && !capped; hop++) {
      const next: string[] = []
      for (const id of frontier) {
        for (const e of this.edgesOf(id, rels)) {
          const other = e.src === id ? e.dst : e.src
          if (seen.has(other)) continue
          if (nodes.length >= cap) { capped = true; break }
          seen.add(other)
          if (!this.hub(other)) next.push(other)
          nodes.push({ id: other, ...this.label(other), hop, via: { from: id, rel: e.rel, direction: e.src === id ? 'out' : 'in', evidence: e.evidence, at: e.at } })
        }
        if (capped) break
      }
      frontier = next
    }
    return { start: this.node(start), nodes, capped }
  }

  /** The shortest chain of edges from one node to another, or how far it looked. */
  path(from: string, to: string, depth = 6): { found: boolean; steps: Array<Record<string, unknown>>; looked: number } {
    const max = Math.min(Math.max(depth, 1), 6)
    const prev = new Map<string, { id: string; rel: string; direction: string; evidence: string | null }>()
    const seen = new Set([from])
    let frontier = [from]
    for (let hop = 0; hop < max && frontier.length; hop++) {
      const next: string[] = []
      for (const id of frontier) {
        for (const e of this.edgesOf(id)) {
          const other = e.src === id ? e.dst : e.src
          if (seen.has(other)) continue
          seen.add(other)
          prev.set(other, { id, rel: e.rel, direction: e.src === id ? 'out' : 'in', evidence: e.evidence })
          if (other === to) {
            const steps: Array<Record<string, unknown>> = []
            for (let cur = to; cur !== from;) {
              const p = prev.get(cur)!
              steps.unshift({ from: p.id, rel: p.rel, direction: p.direction, to: cur, evidence: p.evidence, ...this.label(cur) })
              cur = p.id
            }
            return { found: true, steps, looked: seen.size }
          }
          if (!this.hub(other)) next.push(other)
          if (seen.size > 20_000) return { found: false, steps: [], looked: seen.size }
        }
      }
      frontier = next
    }
    return { found: false, steps: [], looked: seen.size }
  }

  status(): Record<string, unknown> {
    const count = (sql: string) => (this.db.prepare(sql).get() as { n: number }).n
    const kinds = Object.fromEntries((this.db.prepare('SELECT kind, count(*) AS n FROM docs GROUP BY kind').all() as Array<{ kind: string; n: number }>).map((r) => [r.kind, r.n]))
    const nodeKinds = Object.fromEntries((this.db.prepare('SELECT kind, count(*) AS n FROM nodes GROUP BY kind').all() as Array<{ kind: string; n: number }>).map((r) => [r.kind, r.n]))
    return { schema: SCHEMA_VERSION, docs: count('SELECT count(*) AS n FROM docs'), kinds, nodes: count('SELECT count(*) AS n FROM nodes'), node_kinds: nodeKinds,
      edges: count('SELECT count(*) AS n FROM edges'), vectors: count('SELECT count(*) AS n FROM vectors'), files: count('SELECT count(*) AS n FROM files'),
      last_pass: this.meta('last_pass') ? JSON.parse(this.meta('last_pass')!) : null }
  }
}
// #endregion estate-index

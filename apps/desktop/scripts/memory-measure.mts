// #region memory-measure — docs: docs/evidence/specs/2026-11-19-estate-index-and-graph.md#7-measured-on-this-mac-2026-11-19-the-runs-evidence
/**
 * Measure Fabric's Memory (the estate index, ADR-0200) on this Mac's real sources, outside the app: the same pass
 * (`estateRun.ts#createEstateRunner`) over the same readers, with Fabric's rows read from the local stack through `psql`
 * (the operator's own database, read only) and the index written to a file of the caller's choosing. It answers what
 * the index holds (documents by kind and source, projects, nodes, edges, vectors), a few queries with their time, and
 * a quote check, as one JSON on stdout. Nothing in Fabric's own data folder is touched.
 *
 *   node --experimental-strip-types apps/desktop/scripts/memory-measure.mts --index ~/.cache/fabric-memory-measure/index.sqlite \
 *     [--passes 12] [--budget-ms 60000] [--query "…"]…
 *
 * Environment: PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE for the stack (defaults: the local Supabase on 54322).
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { EstateIndex } from '../src/main/estateIndex.ts'
import { createEstateRunner, JOURNAL_TYPES, ollamaEmbedder, readOrganizations } from '../src/main/estateRun.ts'
import { defaultRoots } from '../src/main/estateSources.ts'
import { checkClaims } from '../src/shared/estateSearch.ts'

type Rows = Array<Record<string, unknown>>

const args = process.argv.slice(2)
const opt = (name: string, fallback: string | null = null): string | null => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1]! : fallback
}
const all = (name: string): string[] => args.flatMap((a, i) => (a === `--${name}` && args[i + 1] ? [args[i + 1]!] : []))

const file = opt('index')
if (!file) { console.error('memory-measure: --index <file> is required'); process.exit(2) }
const passes = Number(opt('passes', '12'))
const budget = Number(opt('budget-ms', '60000'))
const queries = all('query')

const env = { PGHOST: '127.0.0.1', PGPORT: '54322', PGUSER: 'postgres', PGPASSWORD: 'postgres', PGDATABASE: 'postgres', ...process.env }
/** One read of the local stack as JSON rows; the SQL is built here from fixed names and integers only. */
function sql(query: string): Rows {
  const out = execFileSync('psql', ['-At', '-v', 'ON_ERROR_STOP=1', '-c', `select coalesce(json_agg(t), '[]'::json) from (${query}) t`], { env, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 })
  return JSON.parse(out.trim() || '[]') as Rows
}
const TABLES = new Set(['project_tasks', 'task_notes', 'task_links', 'work_claims', 'memory_facts'])
const int = (n: number): number => { if (!Number.isSafeInteger(n) || n < 0) throw new Error('not a cursor'); return n }

const estate = String(sql("select estate_id from projects where status = 'active' group by 1 order by count(*) desc limit 1")[0]?.estate_id ?? '')
if (!/^[0-9a-f-]{36}$/.test(estate)) { console.error('memory-measure: no active estate in the local stack'); process.exit(3) }

mkdirSync(path.dirname(file), { recursive: true })
const index = new EstateIndex(file)
const runner = createEstateRunner({
  index,
  projects: async () => sql(`select id, name, repo_path from projects where status = 'active' and estate_id = '${estate}'`)
    .map((p) => ({ id: String(p.id), name: String(p.name), repo_path: (p.repo_path as string | null) ?? null })),
  organizations: () => readOrganizations(),
  page: async (table, col, after, limit) => {
    if (!TABLES.has(table) || !/^[a-z_]+$/.test(col)) throw new Error(`not a table this script reads: ${table}`)
    return sql(`select * from ${table} where ${col} > ${int(after)} order by ${col} limit ${int(limit)}`)
  },
  journal: async (types, after, limit) => {
    const allowed = JOURNAL_TYPES.filter((t) => types.includes(t)).map((t) => `'${t}'`).join(',')
    return sql(`select seq, type, occurred_at, project_id, actor, payload from journal where type in (${allowed}) and seq > ${int(after)} order by seq limit ${int(limit)}`)
  },
  board: async (after) => {
    const r = sql(`select board_list_operator(p_estate_id := '${estate}', p_thread := null, p_after_seq := ${int(after)}, p_limit := 100) as page`)[0]?.page as
      { ok?: boolean; messages?: Rows; last_seq?: number; more?: boolean } | undefined
    if (!r?.ok || !Array.isArray(r.messages)) throw new Error('the board could not be read')
    return { messages: r.messages, last: Number(r.last_seq ?? after), more: r.more === true }
  },
  roots: () => defaultRoots(),
  embedder: () => ollamaEmbedder().catch(() => null),
  now: Date.now,
  yieldNow: () => new Promise((r) => setImmediate(r))
})

const reports = []
for (let i = 0; i < passes; i++) {
  const r = await runner.pass(budget)
  reports.push(r)
  console.error(`pass ${i + 1}: ${r.ms} ms, docs ${r.docs}, transcripts read ${r.transcripts.read} left ${r.transcripts.left}, commits ${r.commits}, documents ${r.documents}, embedded ${r.embedded}${r.degraded.length ? `, degraded ${r.degraded.join('; ')}` : ''}`)
  if (r.transcripts.left === 0 && r.docs === 0 && r.embedded === 0) break
}

const count = (q: string): Rows => index.db.prepare(q).all() as Rows
const embedder = await ollamaEmbedder().catch(() => null)
const answers = []
for (const q of queries) {
  const t0 = performance.now()
  const res = await index.search(q, { limit: 5 }, embedder)
  const ms = Math.round(performance.now() - t0)
  const top = res.hits[0]
  // A quote taken from the top hit's own passage must pass the check; the same quote with a number added must not.
  const quote = top ? String(top.passage ?? '').replace(/…/g, '').trim().slice(0, 120) : ''
  let checked = null
  if (top && quote.length >= 12) {
    const d = index.doc(top.id)
    const docs = new Map(d ? [[top.id, { body: String(d.body), digest: String(d.digest) }]] : [])
    // The quote verbatim with a claim that repeats it, then the same quote with a claim that adds a number it lacks.
    checked = checkClaims([{ quote, doc: top.id, text: quote }, { quote, doc: top.id, text: `${quote} (4242)` }], docs).map((v) => ({ kept: v.kept, reason: v.kept ? null : v.reason }))
  }
  answers.push({ query: q, ms, via: res.via, degraded: res.degraded, hits: res.hits.map((h) => ({ id: h.id, kind: h.kind, project: h.project, title: h.title, at: h.at, cite: h.cite ?? h.id, session: h.session_id, resume: h.resume, passage: String(h.passage ?? '').slice(0, 240), via: h.via })), quoteCheck: checked })
}

console.log(JSON.stringify({
  at: new Date().toISOString(),
  file,
  passes: reports,
  status: index.status(),
  docsByKind: count('SELECT kind, source, COUNT(*) AS n FROM docs GROUP BY kind, source ORDER BY n DESC'),
  projects: count("SELECT COUNT(DISTINCT project) AS withDocs FROM docs WHERE project IS NOT NULL")[0],
  projectsByRole: count("SELECT json_extract(attrs, '$.role') AS role, COUNT(*) AS n FROM nodes WHERE kind = 'project' GROUP BY role"),
  contexts: count('SELECT context, COUNT(*) AS n FROM docs GROUP BY context ORDER BY n DESC'),
  nodesByKind: count('SELECT kind, COUNT(*) AS n FROM nodes GROUP BY kind ORDER BY n DESC'),
  edgesByRel: count('SELECT rel, COUNT(*) AS n FROM edges GROUP BY rel ORDER BY n DESC'),
  vectors: count('SELECT model, COUNT(*) AS n FROM vectors GROUP BY model'),
  answers
}, null, 2))
index.close()
// #endregion memory-measure

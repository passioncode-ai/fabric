// #region knowledge-tools — docs: docs/evidence/specs/2026-11-19-estate-index-and-graph.md#5-the-doors
/**
 * The estate index's two doors (ADR-0199, ADR-0200; the operator's rule of 2026-11-18 that an MCP surface has two doors,
 * search and execute): `fabric_knowledge_search` over every source, and `fabric_knowledge_execute`, one operation by name
 * (the graph's walks, a node, the quote check, the projects, the index's state). Registered on the CEO's own hub server
 * beside its session tools, and the same operations as the voice call's function tools.
 */
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { checkClaims, matchProject, type CatalogueRow } from '../shared/estateSearch.ts'
import { redactPayload } from '../shared/redact.ts'
import { isCeoAddress } from '../shared/ceoAddress.ts'
import type { Embedder, EstateIndex } from './estateIndex.ts'
import type { PassReport } from './estateRun.ts'
import { memoryChanges, memoryGraph, memoryOverview, type MemoryLabels } from './memoryRead.ts'

const KINDS = ['session', 'turn', 'task', 'note', 'message', 'console', 'project', 'commit', 'document'] as const

export const KNOWLEDGE_TOOLS = {
  search: {
    mcp: 'fabric_knowledge_search',
    title: 'Search everything the agents did',
    description: 'One search over every session and transcript on this computer (Claude Code, Codex, Fabric consoles), every project\'s tasks, notes and board messages, its documents and decisions (ADRs, specs, plans, README, memory facts), and the commits: Russian and English word forms, parts of identifiers, and meaning when a local model serves vectors. Each hit carries its session id, project, context, a verbatim passage with its file:lines and the command that continues it. Use it first to find where something happened; walk what relates to a hit with fabric_knowledge_execute.',
    input: z.object({
      query: z.string().trim().min(2).max(400).describe('Words or a phrase, in any language; put a subject in Russian and English for both.'),
      kinds: z.array(z.enum(KINDS)).max(8).optional().describe('Only these kinds of hits.'),
      project: z.string().trim().max(400).optional().describe('Only this project (its name or folder).'),
      context: z.string().trim().max(80).optional().describe('Only this context: personal or org:<id>.'),
      limit: z.number().int().min(1).max(50).optional().describe('How many hits; 10 by default.')
    }).strict()
  },
  execute: {
    mcp: 'fabric_knowledge_execute',
    title: 'Walk the graph and run the index\'s operations',
    description: 'Run one operation of Fabric\'s knowledge graph by name: graph.neighbours {node, depth 1-3, limit, rels} (what relates to a node, N steps, both ways), graph.path {from, to, depth} (the shortest chain between two nodes), node.get {id}, quote.check {claims: [{quote, doc, text?, digest?}]} (keeps a claim only when its quote stands verbatim in the cited hit), projects.list {query?, include_temporary?} (every project once, with its folder and role), memory.overview (what the index holds, by kind, source and context, and how fresh each source is), memory.graph {context?} (the organizations and their projects with their counts, and the board requests between projects), memory.changes {hours 1-168, project?} (what the index got in that window, by project and kind, newest first), index.status, index.refresh, index.rebuild. Node ids are the hits\' node fields (task:<id>, session:<id>, console:<id>, project:<id>, commit:<sha>, message:<id>). Pass operations: true to list them.',
    input: z.object({
      operation: z.string().trim().max(40).optional(),
      arguments: z.record(z.string(), z.unknown()).optional(),
      operations: z.boolean().optional()
    }).strict()
  }
} as const

const OPS = {
  'graph.neighbours': z.object({ node: z.string().min(3).max(200), depth: z.number().int().min(1).max(3).optional(), limit: z.number().int().min(1).max(200).optional(), rels: z.array(z.string().max(40)).max(10).optional() }).strict(),
  'graph.path': z.object({ from: z.string().min(3).max(200), to: z.string().min(3).max(200), depth: z.number().int().min(1).max(6).optional() }).strict(),
  'node.get': z.object({ id: z.string().min(3).max(200) }).strict(),
  'quote.check': z.object({ claims: z.array(z.object({ quote: z.string().max(2000), doc: z.string().max(300), text: z.string().max(4000).optional(), digest: z.string().max(80).optional() }).strict()).min(1).max(50) }).strict(),
  'projects.list': z.object({ query: z.string().max(200).optional(), include_temporary: z.boolean().optional() }).strict(),
  'memory.overview': z.object({}).strict(),
  'memory.graph': z.object({ context: z.string().max(80).optional() }).strict(),
  'memory.changes': z.object({ hours: z.number().int().min(1).max(168).optional(), project: z.string().max(200).optional() }).strict(),
  'index.status': z.object({}).strict(),
  'index.refresh': z.object({}).strict(),
  'index.rebuild': z.object({}).strict()
} as const

export interface KnowledgeDeps {
  /** The open index, or why it is not open. */
  index(): EstateIndex | { unavailable: string }
  embedder(): Promise<Embedder | null>
  /** Every project with its role (`estateSearch.ts#catalogue`) and context. */
  catalogue(): Promise<Array<CatalogueRow & { context?: string }>>
  refresh(): Promise<PassReport>
  rebuild(): Promise<PassReport>
  /** The index file (its size is part of Memory's overview); null when unknown. */
  file?: string | null
  /** The organizations' display names from Observatory and how the person's own context is named (Memory's graph). */
  labels?(): MemoryLabels
  record(op: string, detail: Record<string, unknown>): void
}

type Answer = Record<string, unknown>
const refuse = (reason: string, extra: Answer = {}): Answer => ({ ok: false, reason, ...extra })

/** How long a Memory answer is kept when no pass ran meanwhile: the freshness chips age even when nothing is read. */
const MEMO_MS = 60_000

export function createKnowledgeOperations(deps: KnowledgeDeps) {
  const memo = new Map<string, { pass: string; at: number; answer: Answer }>()
  /** The open index, or the refusal that says why it is not open. */
  const open = (): { ix: EstateIndex } | { refused: Answer } => {
    const ix = deps.index()
    return 'unavailable' in ix ? { refused: refuse(`the index is not open: ${ix.unavailable}`) } : { ix }
  }

  async function search(a: z.infer<typeof KNOWLEDGE_TOOLS.search.input>): Promise<Answer> {
    const o = open()
    if ('refused' in o) return o.refused
    const ix = o.ix
    let project = a.project
    // «SEO», «шеф» and the like mean the CEO itself, never a project to narrow to (0.3.27 review UX-63).
    if (project && isCeoAddress(project)) return refuse(`«${project}» means the CEO itself, not a project: search without a project, or name the project by its own name`)
    if (project) {
      const m = matchProject(await deps.catalogue(), project)
      if ('found' in m) project = m.found.name
    }
    const emb = await deps.embedder().catch(() => null)
    const r = await ix.search(a.query, { kinds: a.kinds, project, context: a.context, limit: a.limit }, emb)
    const status = ix.status()
    return {
      ok: true, matched: r.hits.length > 0, via: r.via, degraded: r.degraded, hits: r.hits,
      index: { docs: status.docs, last_pass: status.last_pass },
      note: r.hits.length ? 'A hit\'s node is its graph node: pass it to fabric_knowledge_execute graph.neighbours to see what relates to it; resume is the command that continues a session (fabric_ceo_session_resume does it in a Fabric console).'
        : 'Nothing matched in what the index holds. That says the words were not found, not that it did not happen; index.status says how much is read.'
    }
  }

  async function execute(a: z.infer<typeof KNOWLEDGE_TOOLS.execute.input>): Promise<Answer> {
    if (a.operations || !a.operation) return { ok: true, operations: Object.fromEntries(Object.entries(OPS).map(([k, s]) => [k, z.toJSONSchema(s)])) }
    if (!(a.operation in OPS)) return refuse(`unknown operation ${a.operation}`, { operations: Object.keys(OPS) })
    const op = a.operation as keyof typeof OPS
    const parsed = OPS[op].safeParse(a.arguments ?? {})
    if (!parsed.success) return refuse(`the arguments were refused: ${parsed.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ').slice(0, 300)}`)
    const args = parsed.data as Record<string, unknown>
    if (op === 'index.refresh') return { ok: true, pass: await deps.refresh() }
    if (op === 'index.rebuild') return { ok: true, pass: await deps.rebuild() }
    if (op === 'projects.list') {
      const q = typeof args.query === 'string' ? args.query : ''
      if (q && isCeoAddress(q)) return { ok: true, projects: [], note: `«${q}» means the CEO itself, not a project` }
      const rows = (await deps.catalogue()).filter((r) => args.include_temporary === true || r.role !== 'temporary')
      const picked = (q ? (() => { const m = matchProject(rows, q); return 'found' in m ? [m.found] : 'ambiguous' in m ? m.ambiguous : m.near })() : rows) as Array<CatalogueRow & { context?: string }>
      return { ok: true, projects: picked.slice(0, 300).map((r) => ({ id: r.id, name: r.name, folder: r.repo_path, role: r.role, of: r.of, context: r.context ?? null })) }
    }
    const o = open()
    if ('refused' in o) return o.refused
    const index = o.ix
    // #region memory-ops — docs: docs/evidence/specs/2026-11-20-memory-dashboard.md#2-one-module-three-callers
    // Memory's reads, the same for the window, the CEO and the voice; an answer is kept until the next pass writes the
    // index, so a dashboard opened twice reads it once (each read is 0.3 to 0.5 s on 195 000 documents).
    if (op === 'memory.overview' || op === 'memory.graph' || op === 'memory.changes') {
      const pass = index.meta('last_pass') ?? ''
      const key = `${op}|${JSON.stringify(args)}`
      const kept = memo.get(key)
      if (kept && kept.pass === pass && Date.now() - kept.at < MEMO_MS) return kept.answer
      const labels = deps.labels?.() ?? { names: new Map<string, string>(), personal: 'personal' }
      const answer: Answer = op === 'memory.overview' ? { ...memoryOverview(index, deps.file ?? null, labels) }
        : op === 'memory.graph' ? { ok: true, ...memoryGraph(index, labels, typeof args.context === 'string' ? args.context : undefined) }
          : { ...memoryChanges(index, typeof args.hours === 'number' ? args.hours : 24, typeof args.project === 'string' ? args.project : undefined) }
      memo.set(key, { pass, at: Date.now(), answer })
      if (memo.size > 64) memo.delete(memo.keys().next().value!)
      return answer
    }
    // #endregion memory-ops
    if (op === 'index.status') return { ok: true, ...index.status() }
    if (op === 'node.get') { const n = index.node(String(args.id)); return n ? { ok: true, node: n } : refuse(`no node ${String(args.id)} in the index`) }
    if (op === 'graph.neighbours') {
      const r = index.neighbours(String(args.node), (args.depth as number) ?? 1, (args.limit as number) ?? 100, args.rels as string[] | undefined)
      return { ok: true, ...r, ...(r.nodes.length ? {} : { note: 'No edge reaches this node in the index: it may not be read yet (index.status), or nothing relates to it.' }) }
    }
    if (op === 'graph.path') return { ok: true, ...index.path(String(args.from), String(args.to), (args.depth as number) ?? 6) }
    // quote.check
    const claims = args.claims as Array<{ quote: string; doc: string; text?: string; digest?: string }>
    const docs = new Map<string, { body: string; digest: string; retrieved?: string }>()
    for (const c of claims) {
      const d = index.doc(c.doc)
      if (d) docs.set(c.doc, { body: String(d.body), digest: String(d.digest), ...(c.digest ? { retrieved: c.digest } : {}) })
    }
    const verdicts = checkClaims(claims, docs)
    const kept = verdicts.filter((v) => v.kept).length
    return { ok: true, outcome: kept ? 'answer' : 'no-answer', kept, verdicts: verdicts.map((v) => (v.kept ? { doc: v.claim.doc, kept: true } : { doc: v.claim.doc, kept: false, reason: v.reason })) }
  }

  async function run(name: string, args: unknown): Promise<Answer> {
    const tool = name === 'search' ? KNOWLEDGE_TOOLS.search : name === 'execute' ? KNOWLEDGE_TOOLS.execute : null
    if (!tool) return refuse(`unknown tool ${name}`)
    const parsed = tool.input.safeParse(args ?? {})
    if (!parsed.success) return refuse(`the arguments were refused: ${parsed.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ').slice(0, 300)}`)
    const started = Date.now()
    try {
      const answer = name === 'search' ? await search(parsed.data as z.infer<typeof KNOWLEDGE_TOOLS.search.input>) : await execute(parsed.data as z.infer<typeof KNOWLEDGE_TOOLS.execute.input>)
      deps.record(`knowledge.${name}`, { outcome: answer.ok === false ? 'refused' : 'ok', ms: Date.now() - started, ...(name === 'execute' ? { operation: (parsed.data as { operation?: string }).operation ?? 'list' } : { hits: Array.isArray(answer.hits) ? answer.hits.length : 0 }) })
      // A second guard (0.3.27 review DA-49): the index is redacted as written; what leaves for a model is again.
      return redactPayload(answer).payload as Answer
    } catch (e) { /* a door that threw refused the act: said, never an answer that looks like success */
      deps.record(`knowledge.${name}`, { outcome: 'failed', error: e instanceof Error ? e.message.slice(0, 200) : String(e) })
      return refuse(e instanceof Error ? e.message.slice(0, 300) : String(e))
    }
  }

  return { run }
}

export type KnowledgeOperations = ReturnType<typeof createKnowledgeOperations>

// #region recall — docs: docs/evidence/specs/2026-11-19-estate-index-and-graph.md#2-what-the-person-and-the-ceo-get

/** A session that does not run in Fabric now, as the index knows it (`ceoTools.ts#RecalledSession`). */
export interface Recalled {
  id: string
  kind: 'console' | 'transcript'
  projectId: string | null
  folder: string | null
  runner: string | null
  runtimeSessionId: string | null
  configDir: string | null
  title: string | null
  at: string | null
}

const runnerOf = (runtime: unknown): string | null => (runtime === 'codex' ? 'codex' : runtime === 'claude' ? 'claude-code' : null)

/**
 * What the index knows of a session id: a Fabric console (from `terminal.opened@1`, or only from the turns and
 * enrolments that name it) with the newest Claude or Codex session it ran as, or a transcript's session with its folder,
 * runner and config home. Null when the index holds neither.
 */
export function recallSession(ix: EstateIndex, id: string): Recalled | null {
  const attrs = (n: Record<string, unknown> | undefined): Record<string, unknown> => (n?.attrs ? JSON.parse(String(n.attrs)) as Record<string, unknown> : {})
  const nodeRow = (nid: string) => ix.db.prepare('SELECT * FROM nodes WHERE id = ?').get(nid) as Record<string, unknown> | undefined
  const projectOf = (nid: string): string | null => {
    const e = ix.db.prepare("SELECT dst FROM edges WHERE src = ? AND rel = 'belongs-to' AND dst LIKE 'project:%' ORDER BY at DESC LIMIT 1").get(nid) as { dst: string } | undefined
    return e ? e.dst.slice('project:'.length) : null
  }
  const consoleId = `console:${id}`
  const ran = ix.db.prepare("SELECT dst, at FROM edges WHERE src = ? AND rel = 'ran-as' ORDER BY at DESC LIMIT 1").get(consoleId) as { dst: string; at: string | null } | undefined
  const c = nodeRow(consoleId)
  if (c || ran) {
    const a = attrs(c)
    const rt = ran ? ran.dst.slice('session:'.length) : null
    const s = rt ? attrs(nodeRow(`session:${rt}`)) : {}
    return {
      id, kind: 'console', projectId: (typeof a.project_id === 'string' ? a.project_id : null) ?? projectOf(consoleId),
      folder: (typeof a.folder === 'string' ? a.folder : null) ?? (typeof s.folder === 'string' ? s.folder : null),
      runner: (typeof a.runner === 'string' ? a.runner : null) ?? runnerOf(s.runtime), runtimeSessionId: rt,
      configDir: typeof s.config_dir === 'string' ? s.config_dir : null, title: c ? String(c.label) : null, at: ran?.at ?? (c?.at as string | null) ?? null
    }
  }
  const t = nodeRow(`session:${id}`)
  if (!t) return null
  const a = attrs(t)
  return { id, kind: 'transcript', projectId: projectOf(`session:${id}`), folder: typeof a.folder === 'string' ? a.folder : null, runner: runnerOf(a.runtime),
    runtimeSessionId: id, configDir: typeof a.config_dir === 'string' ? a.config_dir : null, title: String(t.label), at: (t.at as string | null) ?? null }
}

/** The consoles Fabric opened (`terminal.opened@1`), newest activity first, each as `recallSession` reads it. */
export function pastConsoles(ix: EstateIndex, limit: number): Recalled[] {
  const rows = ix.db.prepare(`SELECT n.id, coalesce((SELECT max(at) FROM edges e WHERE e.src = n.id AND e.rel = 'ran-as'), n.at) AS last
    FROM nodes n WHERE n.id LIKE 'console:%' ORDER BY last DESC LIMIT ?`).all(Math.min(Math.max(limit, 1), 200)) as Array<{ id: string }>
  return rows.flatMap((r) => { const x = recallSession(ix, r.id.slice('console:'.length)); return x ? [x] : [] })
}
// #endregion recall

const json = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] })

/** The MCP door: on the CEO session's server only (`agentSurface.ts#serverFor`). */
export function registerKnowledgeTools(server: McpServer, ops: KnowledgeOperations): void {
  for (const [name, tool] of Object.entries(KNOWLEDGE_TOOLS))
    server.registerTool(tool.mcp, { title: tool.title, description: tool.description, inputSchema: tool.input.shape }, async (args: unknown) => json(await ops.run(name, args)))
}

/** What the voice may not run (0.3.27 review DA-52): it reads; one misheard request must not rebuild the index. */
export const VOICE_REFUSED_OPERATIONS: ReadonlySet<string> = new Set(['index.refresh', 'index.rebuild'])

/** The voice door: the same two tools as function definitions for the realtime session. */
export function knowledgeVoiceTools(): Array<{ type: 'function'; name: string; description: string; parameters: unknown }> {
  // The voice's names (0.3.27 review UX-70): its tools are knowledge_* and session_*, never the CEO console's fabric_* names.
  const voiced = (t: string): string => t.replace(/fabric_knowledge_(search|execute)/g, 'knowledge_$1').replace(/fabric_ceo_session_resume/g, 'session_resume')
  return Object.entries(KNOWLEDGE_TOOLS).map(([name, tool]) => ({ type: 'function' as const, name: `knowledge_${name}`, description: voiced(tool.description), parameters: z.toJSONSchema(tool.input) }))
}
// #endregion knowledge-tools

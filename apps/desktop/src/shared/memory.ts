// #region memory-shared — docs: docs/evidence/specs/2026-11-20-memory-dashboard.md#2-one-module-three-callers
/**
 * Memory's pure half (spec 2026-11-20): what each source of the estate index last read and how fresh it is, the graph of
 * organizations and projects composed from the index's counts, and the shapes the window, the CEO's doors and the voice
 * tools all answer. No I/O here: `main/memoryRead.ts` reads the index and calls these.
 */

/** The sources a pass reads, in the order the dashboard shows them. */
export const MEMORY_SOURCES = ['transcripts', 'fabric', 'board', 'git', 'vectors'] as const
export type MemorySource = (typeof MEMORY_SOURCES)[number]

/** What the last passes left of one source: when it was last read whole, what is still to read, and why it was not. */
export interface SourceMark {
  /** ISO time of the last pass that read this source without an error; null when none has. */
  readAt: string | null
  /** What waits for the next pass (transcripts left, repositories whose documents waited, the board's pages); 0 when none. */
  left: number
  /** Files or repositories this source could not read in the last pass (each named in the pass's degraded). */
  unread: number
  /** Why the last pass could not read the source at all; null when it could. */
  error: string | null
}

export type SourceMarks = Record<MemorySource, SourceMark>

/** The last pass, as `estateRun.ts#PassReport` gives it: enough to mark each source. */
export interface PassFacts {
  at: string
  transcripts: { left: number }
  degraded: readonly string[]
  /** The board answered `more` at the pass's last page: older pages are still to read. */
  boardMore: boolean
}

const EMPTY: SourceMark = { readAt: null, left: 0, unread: 0, error: null }

/** The marks after a pass: a source read without an error takes the pass's time; one that failed keeps its last time and
 *  says why. */
export function nextMarks(prev: Partial<SourceMarks> | null, pass: PassFacts): SourceMarks {
  const d = pass.degraded
  const starts = (...prefixes: string[]) => d.filter((x) => prefixes.some((p) => x.startsWith(p)))
  const first = (xs: string[]): string | null => (xs[0] ? xs[0].slice(0, 200) : null)
  const facts: Record<MemorySource, { error: string | null; left: number; unread: number }> = {
    transcripts: { error: first(starts('transcripts-unread')), left: pass.transcripts.left, unread: starts('transcript-unread').length },
    fabric: { error: first(starts('projects-unread', 'project_tasks-unread', 'task_notes-unread', 'task_links-unread', 'work_claims-unread', 'memory_facts-unread', 'journal-unread')), left: 0, unread: 0 },
    board: { error: first(starts('board-unread')), left: pass.boardMore ? 1 : 0, unread: 0 },
    git: { error: null, left: starts('documents-deferred').length, unread: starts('git-unread').length },
    vectors: { error: first(starts('vector-unavailable', 'embedding-failed')), left: 0, unread: 0 }
  }
  const out = {} as SourceMarks
  for (const s of MEMORY_SOURCES) {
    const before = prev?.[s] ?? EMPTY
    const f = facts[s]
    out[s] = { readAt: f.error ? before.readAt : pass.at, left: f.left, unread: f.unread, error: f.error }
  }
  return out
}

export type Freshness = 'fresh' | 'catching-up' | 'stale' | 'unread' | 'never'

/** Fresh within twice the pass interval (`estateWiring.ts#PASS_EVERY_MS`, five minutes). */
export const FRESH_MS = 10 * 60_000

/** How one source stands now: never read, read but failing now, catching up, read within ten minutes, or older. */
export function freshnessOf(m: SourceMark | undefined, now: number): Freshness {
  if (!m || !m.readAt) return m?.error ? 'unread' : 'never'
  if (m.error) return 'unread'
  if (m.left > 0) return 'catching-up'
  return now - Date.parse(m.readAt) <= FRESH_MS ? 'fresh' : 'stale'
}

// ---------------------------------------------------------------- the graph

/** One project's row as the index counts it. */
export interface ProjectCounts {
  id: string
  name: string
  context: string
  role: string | null
  folder: string | null
  docs: number
  byKind: Record<string, number>
  lastAt: string | null
}

export interface MemoryGraphNode {
  id: string
  kind: 'organization' | 'project'
  label: string
  /** The context the node stands in: `personal` or `org:<id>`. */
  context: string
  /** What the index holds of it: a project's documents; an organization's, summed over its projects. */
  docs: number
  projects?: number
  byKind?: Record<string, number>
  lastAt?: string | null
  role?: string | null
  folder?: string | null
}

export interface MemoryGraphEdge {
  source: string
  target: string
  kind: 'in' | 'board'
  /** For a board edge, how many requests went between the two projects. */
  weight: number
}

export interface MemoryGraph {
  nodes: MemoryGraphNode[]
  edges: MemoryGraphEdge[]
  organizations: Array<{ context: string; label: string; projects: number; docs: number }>
}

/**
 * The organizations and their projects: one hub per context with the label Observatory gives it (the person's own is
 * «personal», named by the caller), every project joined to its hub, and the board's requests between two projects as
 * one weighted edge per pair, both directions counted together.
 */
export function composeMemoryGraph(projects: readonly ProjectCounts[], pairs: ReadonlyArray<{ from: string; to: string; n: number }>, labels: ReadonlyMap<string, string>, personalLabel: string): MemoryGraph {
  const orgs = new Map<string, { label: string; projects: number; docs: number }>()
  const nodes: MemoryGraphNode[] = []
  const edges: MemoryGraphEdge[] = []
  for (const p of projects) {
    const o = orgs.get(p.context) ?? { label: p.context === 'personal' ? personalLabel : labels.get(p.context.slice('org:'.length)) ?? p.context.slice('org:'.length), projects: 0, docs: 0 }
    o.projects++
    o.docs += p.docs
    orgs.set(p.context, o)
    nodes.push({ id: `project:${p.id}`, kind: 'project', label: p.name, context: p.context, docs: p.docs, byKind: p.byKind, lastAt: p.lastAt, role: p.role, folder: p.folder })
    edges.push({ source: `project:${p.id}`, target: `ctx:${p.context}`, kind: 'in', weight: 1 })
  }
  const known = new Set(projects.map((p) => `project:${p.id}`))
  const pair = new Map<string, MemoryGraphEdge>()
  for (const e of pairs) {
    const a = `project:${e.from}`, b = `project:${e.to}`
    if (a === b || !known.has(a) || !known.has(b)) continue
    const [s, t] = a < b ? [a, b] : [b, a]
    const k = `${s}|${t}`
    const had = pair.get(k)
    if (had) had.weight += e.n
    else pair.set(k, { source: s, target: t, kind: 'board', weight: e.n })
  }
  edges.push(...[...pair.values()].sort((x, y) => y.weight - x.weight))
  const organizations = [...orgs.entries()].map(([context, o]) => ({ context, ...o })).sort((x, y) => y.docs - x.docs)
  for (const o of organizations) nodes.unshift({ id: `ctx:${o.context}`, kind: 'organization', label: o.label, context: o.context, docs: o.docs, projects: o.projects })
  return { nodes, edges, organizations }
}

// ---------------------------------------------------------------- the answers

export interface MemoryOverview {
  ok: true
  at: string
  docs: number
  nodes: number
  edges: number
  bytes: number | null
  projects: number
  sessions: number
  byKind: Record<string, number>
  bySource: Record<string, number>
  byContext: Array<{ context: string; label: string; docs: number }>
  vectors: { model: string | null; embedded: number; of: number }
  sources: Array<{ source: MemorySource; state: Freshness } & SourceMark>
  lastPass: Record<string, unknown> | null
}

export interface MemoryChange {
  project: string | null
  kind: string
  count: number
  newest: Array<{ id: string; title: string; at: string | null; node: string }>
}

export interface MemoryChanges {
  ok: true
  since: string
  hours: number
  total: number
  changes: MemoryChange[]
  capped: boolean
}
// #endregion memory-shared

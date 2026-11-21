// #region graph-model — docs: docs/evidence/specs/2026-11-20-memory-dashboard.md#6-one-graph-module
/**
 * Fabric's one graph model (the owner, 2026-11-20: one graph module for Memory, the decision graph and Sound Engine's
 * graph, never three copies). Nodes and edges carry no tie to where they came from: a host maps its own records into
 * them, and every view of `@fabric/graph` (the map, the time line, the table) draws the same data. Pure: no React, no
 * DOM, usable in the main process, a test or another host.
 */

/** Who stands behind a node: a person's command, an agent's step, the CEO agent's, or the system's own act. */
export type GraphActor = 'person' | 'agent' | 'ceo' | 'system'

/** Where a decision, a task or a request stands. */
export type GraphState = 'open' | 'done' | 'waiting' | 'refused'

export interface GraphNode {
  id: string
  /** What the node is, in the host's words (project, organization, task, decision, session…). */
  kind: string
  label: string
  /** ISO time it happened or was last active. */
  at?: string | null
  actor?: GraphActor
  state?: GraphState
  /** Where the host opens it (a node id of its own, a link). */
  ref?: string
  /** The node's group: an organization on the map, a lane on the time line. */
  group?: string
  /** How much it weighs (a project's documents); the map sizes it by this. */
  size?: number
  /** The community the node falls in (Louvain, by code): a zone of the brain; Sound Engine's addition, 2026-11-20. */
  zone?: number
  /** Anything else the host shows on the node's card. */
  attrs?: Record<string, unknown>
}

export interface GraphEdge {
  from: string
  to: string
  /** The relation, in the host's words (caused, answered, spawned, decided, in, board…). */
  kind: string
  /** How strong the relation is (requests between two projects); 1 when absent. */
  weight?: number
  /** How the relation is known: resolved or declared in a document, or guessed by a heuristic (a guessed one never takes
   *  part in a gate); Sound Engine's addition, 2026-11-20. */
  conf?: 'proven' | 'declared' | 'heuristic'
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

/** The nodes within `depth` steps of `id`, both ways, each with its hop; the start first. Unknown ids are not invented. */
export function neighbours(data: GraphData, id: string, depth = 1): Array<{ node: GraphNode; hop: number }> {
  const byId = new Map(data.nodes.map((n) => [n.id, n]))
  const start = byId.get(id)
  if (!start) return []
  const adj = new Map<string, string[]>()
  for (const e of data.edges) {
    ;(adj.get(e.from) ?? adj.set(e.from, []).get(e.from)!).push(e.to)
    ;(adj.get(e.to) ?? adj.set(e.to, []).get(e.to)!).push(e.from)
  }
  const out: Array<{ node: GraphNode; hop: number }> = [{ node: start, hop: 0 }]
  const seen = new Set([id])
  let frontier = [id]
  for (let hop = 1; hop <= depth && frontier.length; hop++) {
    const next: string[] = []
    for (const f of frontier) for (const t of adj.get(f) ?? []) {
      if (seen.has(t)) continue
      seen.add(t)
      const n = byId.get(t)
      if (n) { out.push({ node: n, hop }); next.push(t) }
    }
    frontier = next
  }
  return out
}

/** The nodes in time order, oldest first; a node with no time goes last, in its given order. */
export function byTime(data: GraphData): GraphNode[] {
  return data.nodes.map((n, i) => ({ n, i })).sort((a, b) => {
    const x = a.n.at ? Date.parse(a.n.at) : NaN, y = b.n.at ? Date.parse(b.n.at) : NaN
    if (Number.isNaN(x) && Number.isNaN(y)) return a.i - b.i
    if (Number.isNaN(x)) return 1
    if (Number.isNaN(y)) return -1
    return x - y || a.i - b.i
  }).map((x) => x.n)
}

/** A run of agent steps between two people's commands, folded into one line of the time line. */
export interface Folded { kind: 'folded'; nodes: GraphNode[] }
export type TimelineItem = { kind: 'node'; node: GraphNode } | Folded

/**
 * The time line with only people's commands open: each run of consecutive nodes whose actor is not a person (an agent,
 * the CEO, the system) becomes one folded item that still holds them, so «agents: N steps» can be opened in place.
 */
export function collapseAgents(nodes: readonly GraphNode[]): TimelineItem[] {
  const out: TimelineItem[] = []
  for (const n of nodes) {
    if (n.actor === 'person' || n.actor === undefined) { out.push({ kind: 'node', node: n }); continue }
    const last = out[out.length - 1]
    if (last && last.kind === 'folded') last.nodes.push(n)
    else out.push({ kind: 'folded', nodes: [n] })
  }
  return out
}

/** The groups the nodes stand in, in the order they first appear; nodes with none are in `''`. */
export function groupsOf(nodes: readonly GraphNode[]): string[] {
  const seen: string[] = []
  for (const n of nodes) { const g = n.group ?? ''; if (!seen.includes(g)) seen.push(g) }
  return seen
}

/** Edges whose ends are both known, so a view never draws a line to nothing; how many were dropped is said. */
export function joined(data: GraphData): { edges: GraphEdge[]; dropped: number } {
  const ids = new Set(data.nodes.map((n) => n.id))
  const edges = data.edges.filter((e) => ids.has(e.from) && ids.has(e.to))
  return { edges, dropped: data.edges.length - edges.length }
}
// #endregion graph-model

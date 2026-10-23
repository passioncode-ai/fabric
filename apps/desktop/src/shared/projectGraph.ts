// #region project-graph — docs: docs/evidence/specs/2026-10-23-0312-w2-project-onboarding.md#decisions-the-questions-the-scenarios-leave-open
// W2-9 (OF-32, SCN-175): how the projects relate, from what Fabric already has: each project's business (its profile),
// the relations its onboarding agent recorded (matched to a project by name or repository folder; one that matches no
// project is drawn as outside), and the board's threads between projects (how many messages). Pure; tested.

export interface GraphNode {
  id: string
  name: string
  summary: string | null
  /** The business it belongs to; null is not said. */
  business: string | null
  /** A relation's target that matches no project here (a repository not cloned, a service). */
  outside?: boolean
}

export interface GraphEdge {
  from: string
  to: string
  kind: 'depends-on' | 'used-by' | 'same-business' | 'talks-to' | 'other' | 'board'
  /** For a board edge, how many messages the threads between the two hold. */
  weight?: number
}

export interface ProjectGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
  /** Businesses in name order, then the projects with none. */
  businesses: string[]
}

const key = (s: string): string => s.trim().toLowerCase()
const folder = (p: string | null): string | null => (p ? p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? null : null)

export function composeGraph(input: {
  projects: ReadonlyArray<{ id: string; name: string; summary: string | null; business: string | null; repo_path: string | null }>
  relations: ReadonlyArray<{ project_id: string; kind: GraphEdge['kind']; target: string }>
  threads: ReadonlyArray<{ participants: readonly string[]; messageCount: number }>
}): ProjectGraph {
  const nodes: GraphNode[] = input.projects.map((p) => ({ id: p.id, name: p.name, summary: p.summary, business: p.business?.trim() || null }))
  const byName = new Map<string, string>()
  for (const p of input.projects) {
    byName.set(key(p.name), p.id)
    const f = folder(p.repo_path)
    if (f && !byName.has(key(f))) byName.set(key(f), p.id)
  }
  const known = new Set(input.projects.map((p) => p.id))
  const edges: GraphEdge[] = []
  const seen = new Set<string>()
  const add = (e: GraphEdge): void => {
    const k = `${e.from}|${e.to}|${e.kind}`
    if (seen.has(k) || e.from === e.to) return
    seen.add(k)
    edges.push(e)
  }
  for (const r of input.relations) {
    if (!known.has(r.project_id)) continue
    let to = byName.get(key(r.target))
    if (!to) {
      to = `outside:${key(r.target)}`
      if (!nodes.some((n) => n.id === to)) nodes.push({ id: to, name: r.target.trim(), summary: null, business: null, outside: true })
    }
    add({ from: r.project_id, to, kind: r.kind })
  }
  const pairs = new Map<string, number>()
  for (const t of input.threads) {
    const ps = [...new Set(t.participants)].filter((p) => known.has(p)).sort()
    for (let i = 0; i < ps.length; i++)
      for (let j = i + 1; j < ps.length; j++) {
        const k = `${ps[i]}|${ps[j]}`
        pairs.set(k, (pairs.get(k) ?? 0) + Math.max(1, t.messageCount))
      }
  }
  for (const [k, weight] of pairs) {
    const [from, to] = k.split('|')
    add({ from, to, kind: 'board', weight })
  }
  const businesses = [...new Set(nodes.map((n) => n.business).filter((b): b is string => !!b))].sort((a, b) => a.localeCompare(b))
  return { nodes, edges, businesses }
}

/** The project and everything one edge away from it; the whole graph when no project is named. */
export function aroundProject(graph: ProjectGraph, projectId: string | null): ProjectGraph {
  if (!projectId) return graph
  const near = new Set([projectId])
  for (const e of graph.edges) if (e.from === projectId || e.to === projectId) { near.add(e.from); near.add(e.to) }
  const nodes = graph.nodes.filter((n) => near.has(n.id))
  const edges = graph.edges.filter((e) => near.has(e.from) && near.has(e.to))
  const businesses = graph.businesses.filter((b) => nodes.some((n) => n.business === b))
  return { nodes, edges, businesses }
}
// #endregion project-graph

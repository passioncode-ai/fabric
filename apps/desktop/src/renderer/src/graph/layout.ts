// #region graph-layout — docs: docs/evidence/specs/2026-11-20-memory-dashboard.md#6-one-graph-module
/**
 * The map's force layout, pure so it is tested without a canvas: nodes repel, edges pull, each group gathers round its
 * hub, and everything is held to the middle. Seeded from each node's id, so the same data lays out the same way every
 * time (a person who comes back finds a project where it was). O(n²) per step: meant for hundreds of nodes, which is
 * what Memory's organizations and projects are.
 */
import type { GraphData } from '@fabric/graph/model'

export interface Placed { x: number; y: number }

/** A number in [0, 1) from a string, the same on every run. */
export function seed(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619) }
  return ((h >>> 0) % 100000) / 100000
}

export function layout(data: GraphData, steps = 300): Map<string, Placed> {
  const ids = data.nodes.map((n) => n.id)
  const index = new Map(ids.map((id, i) => [id, i]))
  const N = ids.length
  const x = new Float64Array(N), y = new Float64Array(N), vx = new Float64Array(N), vy = new Float64Array(N)
  const groups = [...new Set(data.nodes.map((n) => n.group ?? ''))]
  data.nodes.forEach((n, i) => {
    // A group starts on its own spoke, so groups open apart and do not have to cross each other to separate.
    const g = groups.indexOf(n.group ?? '')
    const angle = (2 * Math.PI * g) / Math.max(1, groups.length) + (seed(n.id) - 0.5) * 1.2
    const r = 120 + seed(`${n.id}#r`) * 160
    x[i] = Math.cos(angle) * r
    y[i] = Math.sin(angle) * r
  })
  const edges = data.edges.flatMap((e) => {
    const a = index.get(e.from), b = index.get(e.to)
    return a === undefined || b === undefined ? [] : [{ a, b, w: Math.min(4, 1 + Math.log2(e.weight ?? 1)) }]
  })
  const mass = data.nodes.map((n) => 1 + Math.sqrt(Math.max(0, n.size ?? 0)) / 20)
  for (let step = 0; step < steps; step++) {
    const cool = 1 - step / steps
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        let dx = x[i]! - x[j]!, dy = y[i]! - y[j]!
        let d2 = dx * dx + dy * dy
        if (d2 < 0.01) { dx = seed(`${i}:${j}`) - 0.5; dy = seed(`${j}:${i}`) - 0.5; d2 = 0.01 }
        const f = (1800 * mass[i]! * mass[j]!) / d2
        const d = Math.sqrt(d2)
        vx[i]! += (f * dx) / d / mass[i]!; vy[i]! += (f * dy) / d / mass[i]!
        vx[j]! -= (f * dx) / d / mass[j]!; vy[j]! -= (f * dy) / d / mass[j]!
      }
    }
    for (const e of edges) {
      const dx = x[e.b]! - x[e.a]!, dy = y[e.b]! - y[e.a]!
      const d = Math.sqrt(dx * dx + dy * dy) || 1
      const f = 0.02 * e.w * (d - 60)
      vx[e.a]! += (f * dx) / d; vy[e.a]! += (f * dy) / d
      vx[e.b]! -= (f * dx) / d; vy[e.b]! -= (f * dy) / d
    }
    for (let i = 0; i < N; i++) {
      vx[i]! -= x[i]! * 0.004; vy[i]! -= y[i]! * 0.004
      const v = Math.sqrt(vx[i]! * vx[i]! + vy[i]! * vy[i]!)
      const cap = 30 * cool + 0.5
      if (v > cap) { vx[i] = (vx[i]! / v) * cap; vy[i] = (vy[i]! / v) * cap }
      x[i]! += vx[i]!; y[i]! += vy[i]!
      vx[i]! *= 0.6; vy[i]! *= 0.6
    }
  }
  return new Map(ids.map((id, i) => [id, { x: x[i]!, y: y[i]! }]))
}

/** The box that holds every placed node, with a margin. */
export function bounds(at: ReadonlyMap<string, Placed>, margin = 40): { x: number; y: number; w: number; h: number } {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const p of at.values()) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y) }
  if (!Number.isFinite(x0)) return { x: -100, y: -100, w: 200, h: 200 }
  return { x: x0 - margin, y: y0 - margin, w: x1 - x0 + 2 * margin, h: y1 - y0 + 2 * margin }
}
// #endregion graph-layout

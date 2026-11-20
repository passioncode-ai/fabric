// #region graph-map — docs: docs/evidence/specs/2026-11-20-memory-dashboard.md#6-one-graph-module
// The map view of @fabric/graph: the nodes as a network on a canvas, each group in its own colour, a hub (a node with
// no group of its own, or the host's hubs) labelled, the rest labelled on hover and when large. Hover lights a node's
// neighbours and dims the rest; a press picks it; the wheel zooms, a drag pans, «По размеру окна» fits it again. A host
// always shows the same data as text beside it (GraphTable): nothing is only on the drawing. Without a 2D canvas (a
// test, a locked-down renderer) it says so and draws nothing.
import { useEffect, useMemo, useRef, useState } from 'react'
import { joined, neighbours, type GraphData, type GraphNode } from '@fabric/graph/model'
import { bounds, layout, type Placed } from './layout'

/** The categorical colours, set in graph.css from the app's state tokens (readable on both themes). */
const PALETTE = ['--graph-c1', '--graph-c2', '--graph-c3', '--graph-c4', '--graph-c5', '--graph-c6']

export interface GraphMapProps {
  data: GraphData
  /** The node to light, as if hovered; the host's selection. */
  focus?: string | null
  onPick?(node: GraphNode): void
  /** Nodes drawn as hubs: bigger, always labelled. */
  hubs?: (node: GraphNode) => boolean
  /** The accessible name of the drawing: what it shows, in a sentence. */
  label: string
  /** Said when no 2D canvas is available. */
  noCanvas: string
  /** The fit button's words. */
  fitLabel: string
  height?: number
  /** Told once when no 2D canvas is available, so the host can open the text twin. */
  onNoCanvas?(): void
}

function tokens(el: Element): { colors: string[]; ink: string; muted: string; line: string; panel: string; focus: string } {
  const cs = getComputedStyle(el)
  // A token the stylesheet did not reach falls back to the element's own text colour, never to a colour of its own.
  const v = (name: string) => cs.getPropertyValue(name).trim() || cs.color
  return { colors: PALETTE.map(v), ink: v('--app-ink'), muted: v('--app-muted'), line: v('--app-line'), panel: v('--app-panel'), focus: v('--app-focus') }
}

export function GraphMap({ data, focus = null, onPick, hubs, label, noCanvas, fitLabel, height = 520, onNoCanvas }: GraphMapProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [noCtx, setNoCtx] = useState(false)
  const [view, setView] = useState<{ k: number; tx: number; ty: number } | null>(null)
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null)

  const placed = useMemo(() => layout(data), [data])
  const { edges } = useMemo(() => joined(data), [data])
  const groups = useMemo(() => [...new Set(data.nodes.map((n) => n.group ?? ''))], [data])
  const isHub = useMemo(() => hubs ?? ((n: GraphNode) => !n.group), [hubs])
  const maxSize = useMemo(() => Math.max(1, ...data.nodes.map((n) => n.size ?? 0)), [data])
  const radius = (n: GraphNode): number => (isHub(n) ? 14 : 4 + 12 * Math.sqrt((n.size ?? 0) / maxSize))
  const lit = useMemo(() => {
    const at = hover ?? focus
    return at ? new Set(neighbours(data, at, 1).map((x) => x.node.id)) : null
  }, [data, hover, focus])

  // The fit: the whole graph in the canvas, recomputed when the data changes.
  const fit = (w: number, h: number) => {
    const b = bounds(placed)
    const k = Math.min(w / b.w, h / b.h)
    setView({ k, tx: w / 2 - (b.x + b.w / 2) * k, ty: h / 2 - (b.y + b.h / 2) * k })
  }

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const w = c.clientWidth || 800
    fit(w, height)
  }, [placed, height])

  useEffect(() => {
    const c = canvasRef.current
    if (!c || !view) return
    const ctx = c.getContext('2d')
    if (!ctx) { if (!noCtx) onNoCanvas?.(); setNoCtx(true); return }
    const dpr = window.devicePixelRatio || 1
    const w = c.clientWidth || 800
    c.width = Math.round(w * dpr); c.height = Math.round(height * dpr)
    const tk = tokens(c)
    const color = (n: GraphNode) => tk.colors[groups.indexOf(n.group ?? (isHub(n) ? n.id : '')) % tk.colors.length] ?? tk.muted
    const hubColor = (n: GraphNode) => {
      const member = data.nodes.find((m) => m.group === n.id || m.group === n.label)
      return member ? color(member) : tk.ink
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, height)
    ctx.translate(view.tx, view.ty)
    ctx.scale(view.k, view.k)
    const P = (id: string): Placed | undefined => placed.get(id)
    for (const e of edges) {
      const a = P(e.from), b = P(e.to)
      if (!a || !b) continue
      const on = !lit || (lit.has(e.from) && lit.has(e.to))
      ctx.globalAlpha = on ? (e.kind === 'board' ? 0.55 : 0.25) : 0.05
      ctx.strokeStyle = e.kind === 'board' ? tk.focus : tk.line
      ctx.lineWidth = (e.kind === 'board' ? Math.min(4, 0.8 + Math.log2(e.weight ?? 1)) : 1) / view.k
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
    }
    for (const n of data.nodes) {
      const p = P(n.id)
      if (!p) continue
      const on = !lit || lit.has(n.id)
      ctx.globalAlpha = on ? 1 : 0.18
      ctx.fillStyle = isHub(n) ? hubColor(n) : color(n)
      ctx.beginPath(); ctx.arc(p.x, p.y, radius(n) / Math.sqrt(view.k), 0, 2 * Math.PI); ctx.fill()
      if (isHub(n) || n.id === (hover ?? focus)) {
        ctx.lineWidth = 2 / view.k; ctx.strokeStyle = tk.ink; ctx.stroke()
      }
    }
    ctx.globalAlpha = 1
    ctx.textBaseline = 'middle'
    for (const n of data.nodes) {
      const p = P(n.id)
      if (!p) continue
      const big = (n.size ?? 0) >= maxSize * 0.25
      const shown = isHub(n) || n.id === hover || n.id === focus || (lit?.has(n.id) && lit.size <= 30) || (!lit && big)
      if (!shown) continue
      const fs = (isHub(n) ? 14 : 12) / view.k
      ctx.font = `${isHub(n) ? 600 : 400} ${fs}px system-ui, sans-serif`
      const tx = p.x + (radius(n) + 4) / Math.sqrt(view.k)
      ctx.lineWidth = 3 / view.k; ctx.strokeStyle = tk.panel; ctx.strokeText(n.label, tx, p.y)
      ctx.fillStyle = (lit && !lit.has(n.id)) ? tk.muted : tk.ink
      ctx.fillText(n.label, tx, p.y)
    }
  }, [view, placed, edges, lit, hover, focus, data, groups, height, isHub, maxSize])

  const at = (ev: { clientX: number; clientY: number }): GraphNode | null => {
    const c = canvasRef.current
    if (!c || !view) return null
    const r = c.getBoundingClientRect()
    const gx = (ev.clientX - r.left - view.tx) / view.k, gy = (ev.clientY - r.top - view.ty) / view.k
    let best: GraphNode | null = null, bestD = Infinity
    for (const n of data.nodes) {
      const p = placed.get(n.id)
      if (!p) continue
      const d = Math.hypot(p.x - gx, p.y - gy)
      const reach = (radius(n) + 6) / Math.sqrt(view.k) / 1
      if (d < reach && d < bestD) { best = n; bestD = d }
    }
    return best
  }

  if (noCtx) return <p className="graph-note" role="status">{noCanvas}</p>
  return (
    <div className="graph-map" style={{ height }}>
      <canvas ref={canvasRef} className="graph-canvas" role="img" aria-label={label} style={{ width: '100%', height }}
        onPointerMove={(ev) => {
          const d = drag.current
          if (d && view) {
            const dx = ev.clientX - d.x, dy = ev.clientY - d.y
            if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true
            setView({ ...view, tx: d.tx + dx, ty: d.ty + dy })
            return
          }
          setHover(at(ev)?.id ?? null)
        }}
        onPointerDown={(ev) => { if (view) drag.current = { x: ev.clientX, y: ev.clientY, tx: view.tx, ty: view.ty, moved: false } }}
        onPointerUp={(ev) => {
          const d = drag.current
          drag.current = null
          if (d?.moved) return
          const n = at(ev)
          if (n) onPick?.(n)
        }}
        onPointerLeave={() => { drag.current = null; setHover(null) }}
        onWheel={(ev) => {
          if (!view || !canvasRef.current) return
          const r = canvasRef.current.getBoundingClientRect()
          const mx = ev.clientX - r.left, my = ev.clientY - r.top
          const k = Math.min(8, Math.max(0.2, view.k * (ev.deltaY < 0 ? 1.15 : 1 / 1.15)))
          setView({ k, tx: mx - ((mx - view.tx) * k) / view.k, ty: my - ((my - view.ty) * k) / view.k })
        }} />
      <button type="button" className="graph-fit lp-button" onClick={() => { const c = canvasRef.current; if (c) fit(c.clientWidth || 800, height) }}>{fitLabel}</button>
      {hover && (() => {
        const n = data.nodes.find((x) => x.id === hover)
        return n ? <p className="graph-hover" aria-hidden="true">{n.label}</p> : null
      })()}
    </div>
  )
}
// #endregion graph-map

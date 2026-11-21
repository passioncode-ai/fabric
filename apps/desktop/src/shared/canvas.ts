// #region canvas-commands — docs: docs/adr/0201-the-canvas-is-an-excalidraw-window-a-designer-draws-on.md#decision
/**
 * The canvas's commands (ADR-0201): what the CEO's call may ask of a canvas, checked here before anything reaches the
 * window; how an element is found by the name the voice gives it; how a diagram is laid out; and the Excalidraw
 * skeletons a diagram becomes. Pure: main checks the call's arguments with it, the canvas window applies the result
 * with Excalidraw's API (`renderer/src/canvas/applyCommand.ts`), and the tests run it under Node.
 */

/** The canvas the menu and the voice open when none is named. */
export const DEFAULT_CANVAS_ID = 'main'
const CANVAS_ID = /^[a-z0-9][a-z0-9-]{0,63}$/
/** A canvas id is also its file's name (`canvases/<id>.excalidraw`), so nothing but this shape is ever one. */
export function isCanvasId(v: unknown): v is string {
  return typeof v === 'string' && CANVAS_ID.test(v)
}

/** A canvas read from disk (`main/canvasStore.ts`): its scene as Excalidraw's file text, or null for one never written. */
export type CanvasRead =
  | { ok: true; id: string; scene: string | null; savedAt: number | null }
  | { ok: false; id: string; reason: 'bad-id' | 'not-a-canvas' | 'too-large' | 'unreadable' }
export type CanvasWrite = { ok: true; savedAt: number } | { ok: false; reason: 'bad-id' | 'not-a-canvas' | 'too-large' | 'unwritable'; detail?: string }

/** How long main waits for the canvas window to apply a command (CV-REQ-11). */
export const CANVAS_COMMAND_MS = 10_000

export type NodeKind = 'note' | 'box' | 'ellipse' | 'diamond' | 'text'
export const NODE_KINDS: readonly NodeKind[] = ['note', 'box', 'ellipse', 'diamond', 'text']

export interface DiagramNode { id: string; text: string; kind: NodeKind; group?: string }
export interface DiagramEdge { from: string; to: string; label?: string }
/** One stop of the designer's walk: the node to show and what the voice says there. */
export interface TourStep { node: string; say: string }
export interface Diagram { title?: string; nodes: DiagramNode[]; edges: DiagramEdge[]; tour?: TourStep[] }

export type CanvasCommand =
  | { op: 'open' }
  | { op: 'read' }
  | { op: 'add'; node: DiagramNode; connectFrom?: string; label?: string }
  | { op: 'connect'; from: string; to: string; label?: string }
  | { op: 'focus'; target?: string }
  | { op: 'highlight'; target: string }
  | { op: 'remove'; target: string }
  | { op: 'draw'; diagram: Diagram }
  | { op: 'design'; idea: string }

/** What the canvas window answers about a command (the call reads it aloud, the ops log keeps its counts). */
export interface CanvasAnswer {
  ok: boolean
  reason?: string
  /** Ids (the agent's names) of what was drawn, in order. */
  drawn?: string[]
  focused?: string[]
  highlighted?: string[]
  removed?: string[]
  /** A name that matched nothing, or several things equally, with the names that exist. */
  unresolved?: Array<{ name: string; candidates: string[] }>
  /** `read`: what the canvas holds. */
  elements?: ElementSummary[]
  /** `design`: the designer's walk through what it drew. */
  tour?: TourStep[]
}

export interface ElementSummary { name: string; kind: string; text: string }

const LIMITS = { text: 400, idea: 2000, label: 120, id: 40, nodes: 40, edges: 80, tour: 20 }
const ID = /^[A-Za-z0-9_-]{1,40}$/

export type Parsed<T> = { ok: true; value: T } | { ok: false; reason: string }
const bad = (reason: string): { ok: false; reason: string } => ({ ok: false, reason })

function str(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const s = v.replace(/\s+/g, ' ').trim()
  return s && s.length <= max ? s : null
}
function optStr(v: unknown, max: number): string | undefined | null {
  if (v === undefined || v === null || v === '') return undefined
  return str(v, max)
}

/** A diagram as the call or the designer gave it: every node named once, every link between named nodes. */
export function parseDiagram(raw: unknown): Parsed<Diagram> {
  if (!raw || typeof raw !== 'object') return bad('the diagram is not an object')
  const r = raw as Record<string, unknown>
  const title = optStr(r.title, LIMITS.text)
  if (title === null) return bad('the title is not a short text')
  if (!Array.isArray(r.nodes) || r.nodes.length === 0) return bad('the diagram has no nodes')
  if (r.nodes.length > LIMITS.nodes) return bad(`at most ${LIMITS.nodes} nodes`)
  const nodes: DiagramNode[] = []
  const ids = new Set<string>()
  for (const [i, n] of r.nodes.entries()) {
    const node = parseNode(n, `n${i + 1}`)
    if (!node.ok) return bad(`node ${i + 1}: ${node.reason}`)
    if (ids.has(node.value.id)) return bad(`node id ${node.value.id} is used twice`)
    ids.add(node.value.id)
    nodes.push(node.value)
  }
  const rawEdges = r.edges ?? []
  if (!Array.isArray(rawEdges)) return bad('the links are not a list')
  if (rawEdges.length > LIMITS.edges) return bad(`at most ${LIMITS.edges} links`)
  const edges: DiagramEdge[] = []
  for (const [i, e] of rawEdges.entries()) {
    const er = (e ?? {}) as Record<string, unknown>
    const from = str(er.from, LIMITS.id), to = str(er.to, LIMITS.id)
    if (!from || !to || !ids.has(from) || !ids.has(to)) return bad(`link ${i + 1} does not join two nodes of the diagram`)
    const label = optStr(er.label, LIMITS.label)
    if (label === null) return bad(`link ${i + 1}: the label is not a short text`)
    edges.push({ from, to, ...(label ? { label } : {}) })
  }
  const rawTour = r.tour ?? []
  if (!Array.isArray(rawTour)) return bad('the tour is not a list')
  const tour: TourStep[] = []
  for (const t of rawTour.slice(0, LIMITS.tour)) {
    const tr = (t ?? {}) as Record<string, unknown>
    const node = str(tr.node, LIMITS.id), say = str(tr.say, LIMITS.text)
    // A stop at a node the diagram lacks is dropped: the walk goes on through the rest.
    if (node && say && ids.has(node)) tour.push({ node, say })
  }
  return { ok: true, value: { ...(title ? { title } : {}), nodes, edges, ...(tour.length ? { tour } : {}) } }
}

function parseNode(raw: unknown, fallbackId: string): Parsed<DiagramNode> {
  if (!raw || typeof raw !== 'object') return bad('not an object')
  const r = raw as Record<string, unknown>
  const text = str(r.text, LIMITS.text)
  if (!text) return bad(`its text is empty or longer than ${LIMITS.text} characters`)
  const id = r.id === undefined || r.id === null || r.id === '' ? fallbackId : typeof r.id === 'string' && ID.test(r.id.trim()) ? r.id.trim() : null
  // An empty fallback (`canvas_add`) leaves the name to the window, which gives the element one.
  if (id === null) return bad('its id is not letters, digits, - or _ (at most 40)')
  const kind = r.kind === undefined || r.kind === null || r.kind === '' ? 'box' : r.kind
  if (!NODE_KINDS.includes(kind as NodeKind)) return bad(`its kind is not one of ${NODE_KINDS.join(', ')}`)
  const group = optStr(r.group, LIMITS.id)
  if (group === null) return bad('its group is not a short name')
  return { ok: true, value: { id, text, kind: kind as NodeKind, ...(group ? { group } : {}) } }
}

/** The command a voice tool's call asks for, its arguments checked (CV-REQ-06); `null` for a tool that is not the
 *  canvas's. */
export function parseCanvasTool(name: string, args: unknown): Parsed<CanvasCommand> | null {
  if (!name.startsWith('canvas_')) return null
  const a = (args && typeof args === 'object' ? args : {}) as Record<string, unknown>
  const target = (key: string): string | null => str(a[key], LIMITS.text)
  switch (name) {
    case 'canvas_open': return { ok: true, value: { op: 'open' } }
    case 'canvas_read': return { ok: true, value: { op: 'read' } }
    case 'canvas_add': {
      const node = parseNode(a, '')
      if (!node.ok) return bad(`the element: ${node.reason}`)
      const connectFrom = optStr(a.connect_from, LIMITS.text)
      const label = optStr(a.label, LIMITS.label)
      if (connectFrom === null || label === null) return bad('connect_from and label are short texts')
      return { ok: true, value: { op: 'add', node: node.value, ...(connectFrom ? { connectFrom } : {}), ...(label ? { label } : {}) } }
    }
    case 'canvas_connect': {
      const from = target('from'), to = target('to'), label = optStr(a.label, LIMITS.label)
      if (!from || !to) return bad('name both ends: from and to')
      if (label === null) return bad('the label is not a short text')
      return { ok: true, value: { op: 'connect', from, to, ...(label ? { label } : {}) } }
    }
    case 'canvas_focus': {
      const t = optStr(a.target, LIMITS.text)
      if (t === null) return bad('the target is not a short text')
      return { ok: true, value: t ? { op: 'focus', target: t } : { op: 'focus' } }
    }
    case 'canvas_highlight':
    case 'canvas_remove': {
      const t = target('target')
      if (!t) return bad('name the element: target')
      return { ok: true, value: { op: name === 'canvas_highlight' ? 'highlight' : 'remove', target: t } }
    }
    case 'canvas_draw': {
      const d = parseDiagram(a)
      return d.ok ? { ok: true, value: { op: 'draw', diagram: d.value } } : d
    }
    case 'canvas_design': {
      const idea = str(a.idea, LIMITS.idea)
      if (!idea) return bad(`say the idea in at most ${LIMITS.idea} characters`)
      return { ok: true, value: { op: 'design', idea } }
    }
    default: return bad(`unknown canvas tool ${name}`)
  }
}

// ───────────────────────────── finding an element by its name ─────────────────

/** What a command needs to know of a canvas element: its id, the agent's name for it, and its words. */
export interface CanvasElementLite {
  id: string
  type: string
  text: string
  fabricId?: string
  x: number
  y: number
  width: number
  height: number
}

/** The elements a command can name, from Excalidraw's own: a shape carries the words of the text bound to it, a
 *  deleted element and a bound text are not elements of their own. */
export function liteElements(raw: readonly unknown[]): CanvasElementLite[] {
  const all = raw.filter((e): e is Record<string, unknown> => !!e && typeof e === 'object' && (e as { isDeleted?: unknown }).isDeleted !== true)
  const bound = new Map<string, string>()
  for (const e of all) if (e.type === 'text' && typeof e.containerId === 'string') bound.set(e.containerId, String(e.text ?? ''))
  return all
    .filter((e) => !(e.type === 'text' && typeof e.containerId === 'string'))
    .map((e) => {
      const custom = (e.customData ?? {}) as { fabricId?: unknown }
      return {
        id: String(e.id),
        type: String(e.type),
        text: e.type === 'text' ? String(e.text ?? '') : bound.get(String(e.id)) ?? '',
        ...(typeof custom.fabricId === 'string' ? { fabricId: custom.fabricId } : {}),
        x: Number(e.x) || 0,
        y: Number(e.y) || 0,
        width: Number(e.width) || 0,
        height: Number(e.height) || 0
      }
    })
}

const norm = (s: string): string =>
  s.toLowerCase().replace(/ё/g, 'е').replace(/[«»"'“”„.,:;!?()]/g, ' ').replace(/\s+/g, ' ').trim()

/** The element a name means (CV-REQ-07): the agent's id for it, then its Excalidraw id, then its words said in full,
 *  then words it contains, the shortest such text when it is the only shortest. Several equally good, or none: the
 *  candidates come back, never a guess. */
export function resolveRef(elements: readonly CanvasElementLite[], name: string): { ok: true; id: string } | { ok: false; candidates: string[] } {
  const byFabric = elements.filter((e) => e.fabricId === name)
  if (byFabric.length === 1) return { ok: true, id: byFabric[0]!.id }
  const byId = elements.find((e) => e.id === name)
  if (byId && byFabric.length === 0) return { ok: true, id: byId.id }
  const n = norm(name)
  const named = elements.filter((e) => e.text.trim())
  const candidates = (): string[] => [...new Set(named.map(nameOf))].slice(0, 12)
  if (!n) return { ok: false, candidates: candidates() }
  const exact = named.filter((e) => norm(e.text) === n || (e.fabricId !== undefined && e.fabricId.toLowerCase() === n))
  if (exact.length === 1) return { ok: true, id: exact[0]!.id }
  if (exact.length > 1) return { ok: false, candidates: exact.map(nameOf) }
  const containing = named.filter((e) => norm(e.text).includes(n))
  if (containing.length === 1) return { ok: true, id: containing[0]!.id }
  if (containing.length > 1) {
    const sorted = [...containing].sort((a, b) => a.text.length - b.text.length)
    if (sorted[0]!.text.length < sorted[1]!.text.length) return { ok: true, id: sorted[0]!.id }
    return { ok: false, candidates: containing.map(nameOf) }
  }
  return { ok: false, candidates: candidates() }
}

const nameOf = (e: CanvasElementLite): string => (e.text.trim() || e.fabricId || e.id).slice(0, 60)

/** What a canvas holds, as the call reads it (`canvas_read`): the elements with words, at most 60. */
export function summarize(elements: readonly CanvasElementLite[]): ElementSummary[] {
  return elements
    .filter((e) => e.text.trim() || e.fabricId)
    .slice(0, 60)
    .map((e) => ({ name: e.fabricId ?? e.id, kind: e.type, text: e.text.trim().slice(0, 200) }))
}

// ───────────────────────────── laying a diagram out ─────────────────

export interface Placed { x: number; y: number; width: number; height: number }

const COLUMN_GAP = 120
const ROW_GAP = 48
const NODE_W = 240
/** Characters a label line holds at `LABEL_SIZE` in a node `NODE_W` wide, with room for the hand-drawn font's width. */
const LINE_CHARS = 20
export const LABEL_SIZE = 16

/** The size a node takes: wide enough for a short line, taller for each further line of its words. */
export function nodeSize(node: DiagramNode): { width: number; height: number } {
  if (node.kind === 'text') return { width: NODE_W, height: 40 + Math.ceil(node.text.length / LINE_CHARS) * 24 }
  const lines = Math.max(1, Math.ceil(node.text.length / LINE_CHARS))
  const height = Math.max(node.kind === 'diamond' ? 120 : 80, 40 + lines * 24)
  return { width: node.kind === 'diamond' || node.kind === 'ellipse' ? NODE_W + 40 : NODE_W, height }
}

/** Each node's place (CV-REQ-08): columns left to right by the links (a node one column after the furthest node that
 *  links to it; a cycle is cut where it closes), rows top to bottom by group then by order given, every column
 *  centred on the tallest. No two nodes overlap. */
export function layoutDiagram(diagram: Diagram, origin: { x: number; y: number } = { x: 0, y: 0 }): Map<string, Placed> {
  const ids = diagram.nodes.map((n) => n.id)
  const outgoing = new Map<string, string[]>(ids.map((id) => [id, []]))
  for (const e of diagram.edges) if (e.from !== e.to) outgoing.get(e.from)?.push(e.to)
  // A cycle is cut where it closes: a walk from the roots, in the order given, drops each link back to a node still
  // on its path.
  const back = new Set<string>()
  const state = new Map<string, 'open' | 'done'>()
  const walk = (id: string): void => {
    state.set(id, 'open')
    for (const to of outgoing.get(id) ?? []) {
      if (state.get(to) === 'open') back.add(`${id}>${to}`)
      else if (!state.has(to)) walk(to)
    }
    state.set(id, 'done')
  }
  const hasIncoming = new Set(diagram.edges.filter((e) => e.from !== e.to).map((e) => e.to))
  for (const id of ids) if (!hasIncoming.has(id) && !state.has(id)) walk(id)
  for (const id of ids) if (!state.has(id)) walk(id)
  const incoming = new Map<string, string[]>(ids.map((id) => [id, []]))
  for (const e of diagram.edges) if (e.from !== e.to && !back.has(`${e.from}>${e.to}`)) incoming.get(e.to)?.push(e.from)
  const column = new Map<string, number>()
  const depth = (id: string): number => {
    const known = column.get(id)
    if (known !== undefined) return known
    let c = 0
    for (const from of incoming.get(id) ?? []) c = Math.max(c, depth(from) + 1)
    column.set(id, c)
    return c
  }
  for (const id of ids) depth(id)
  const order = new Map(diagram.nodes.map((n, i) => [n.id, i]))
  const groupOrder = new Map<string, number>()
  for (const n of diagram.nodes) if (n.group && !groupOrder.has(n.group)) groupOrder.set(n.group, groupOrder.size)
  const columns: DiagramNode[][] = []
  for (const n of diagram.nodes) (columns[column.get(n.id) ?? 0] ??= []).push(n)
  const heights = columns.map((col) => (col ?? []).reduce((h, n) => h + nodeSize(n).height, 0) + Math.max(0, (col ?? []).length - 1) * ROW_GAP)
  const tallest = Math.max(0, ...heights)
  const placed = new Map<string, Placed>()
  let x = origin.x
  columns.forEach((col = [], c) => {
    const sorted = [...col].sort((a, b) =>
      (groupOrder.get(a.group ?? '') ?? -1) - (groupOrder.get(b.group ?? '') ?? -1) || order.get(a.id)! - order.get(b.id)!)
    let y = origin.y + (tallest - heights[c]!) / 2
    let widest = 0
    for (const n of sorted) {
      const size = nodeSize(n)
      placed.set(n.id, { x, y, ...size })
      y += size.height + ROW_GAP
      widest = Math.max(widest, size.width)
    }
    x += widest + COLUMN_GAP
  })
  return placed
}

/** Where new things go: to the right of what the canvas holds, top-aligned with it; the origin on an empty canvas. */
export function originBeside(elements: readonly CanvasElementLite[]): { x: number; y: number } {
  if (!elements.length) return { x: 0, y: 0 }
  const right = Math.max(...elements.map((e) => e.x + e.width))
  const top = Math.min(...elements.map((e) => e.y))
  return { x: Math.round(right + 160), y: Math.round(top) }
}

// ───────────────────────────── Excalidraw skeletons ─────────────────

/** The fills a group takes, in order (Excalidraw's own palette, light enough for both themes). */
const GROUP_FILLS = ['#d0ebff', '#d3f9d8', '#e5dbff', '#ffe3e3', '#c5f6fa', '#fff3bf']
export const NOTE_FILL = '#ffec99'
export const HIGHLIGHT_STROKE = '#e03131'
/** The ink of shapes and arrows: Excalidraw's own default stroke, scene data rather than interface colour. */
export const INK_STROKE = '#1e1e1e'

/** A skeleton as `convertToExcalidrawElements` takes it: a shape with its label, or an arrow bound to two shapes. */
export type Skeleton = Record<string, unknown>

/** The element id a node becomes: unique on the canvas, so drawing the same diagram twice adds a second copy. */
export function elementId(nodeId: string, nonce: string): string {
  return `fx-${nonce}-${nodeId}`
}

/** The skeletons a diagram becomes at the places given; `existing` maps a name already on the canvas (a link's end
 *  outside the diagram) to its element id. */
export function diagramSkeletons(diagram: Diagram, placed: Map<string, Placed>, nonce: string, existing: ReadonlyMap<string, string> = new Map()): Skeleton[] {
  const groupFill = new Map<string, string>()
  for (const n of diagram.nodes) if (n.group && !groupFill.has(n.group)) groupFill.set(n.group, GROUP_FILLS[groupFill.size % GROUP_FILLS.length]!)
  const out: Skeleton[] = []
  const idOf = (name: string): string => (diagram.nodes.some((n) => n.id === name) ? elementId(name, nonce) : existing.get(name) ?? name)
  for (const n of diagram.nodes) {
    const p = placed.get(n.id)!
    const customData = { fabricId: n.id }
    if (n.kind === 'text') {
      out.push({ type: 'text', id: elementId(n.id, nonce), x: p.x, y: p.y, text: n.text, fontSize: 20, customData })
      continue
    }
    const fill = n.kind === 'note' ? NOTE_FILL : n.group ? groupFill.get(n.group)! : 'transparent'
    out.push({
      type: n.kind === 'note' || n.kind === 'box' ? 'rectangle' : n.kind,
      id: elementId(n.id, nonce),
      x: p.x, y: p.y, width: p.width, height: p.height,
      backgroundColor: fill,
      fillStyle: 'solid',
      strokeColor: INK_STROKE,
      roundness: n.kind === 'note' || n.kind === 'box' ? { type: 3 } : null,
      label: { text: n.text, fontSize: LABEL_SIZE },
      customData
    })
  }
  diagram.edges.forEach((e, i) => {
    const from = placed.get(e.from), to = placed.get(e.to)
    out.push({
      type: 'arrow',
      id: `fx-${nonce}-link-${i + 1}`,
      x: from ? from.x + from.width : 0,
      y: from ? from.y + from.height / 2 : 0,
      ...(from && to ? { width: Math.max(1, to.x - (from.x + from.width)), height: to.y + to.height / 2 - (from.y + from.height / 2) } : {}),
      start: { id: idOf(e.from) },
      end: { id: idOf(e.to) },
      strokeColor: INK_STROKE,
      ...(e.label ? { label: { text: e.label, fontSize: 16 } } : {}),
      customData: { fabricId: `${e.from}->${e.to}` }
    })
  })
  return out
}

// ───────────────────────────── the voice's tools ─────────────────

const NAME = { type: 'string', description: 'The element: the id you gave it, or its words as said on the canvas.' }
const NODE_PROPS = {
  id: { type: 'string', description: 'Your short name for it (letters, digits, - or _), to point at it later.' },
  text: { type: 'string', description: 'Its words, short.' },
  kind: { type: 'string', enum: [...NODE_KINDS], description: 'note (a yellow sticky), box, ellipse, diamond (a decision) or text.' },
  group: { type: 'string', description: 'Nodes of one group share a colour.' }
}

/** The canvas's tools of the CEO's call (ADR-0201 §4), run in main. */
export function canvasVoiceTools(): Array<{ type: 'function'; name: string; description: string; parameters: unknown }> {
  const tool = (name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []) =>
    ({ type: 'function' as const, name, description, parameters: { type: 'object', properties, required, additionalProperties: false } })
  return [
    tool('canvas_open', 'Open the owner\'s canvas (a board of notes, blocks and arrows) in its window, or bring it to the front.'),
    tool('canvas_read', 'Read what the canvas holds: each element\'s name, kind and words.'),
    tool('canvas_add', 'Add one element at once: a note, a block or a text; optionally link it from an element already there.',
      { ...NODE_PROPS, connect_from: { type: 'string', description: 'An element to draw an arrow from to the new one.' }, label: { type: 'string', description: 'The arrow\'s words.' } }, ['text']),
    tool('canvas_connect', 'Draw an arrow between two elements already on the canvas.', { from: NAME, to: NAME, label: { type: 'string' } }, ['from', 'to']),
    tool('canvas_focus', 'Move and zoom the owner\'s view to an element; with no target, to the whole canvas.', { target: NAME }),
    tool('canvas_highlight', 'Look at an element and outline it for a few seconds while you speak about it.', { target: NAME }, ['target']),
    tool('canvas_remove', 'Remove one element the owner asked to remove.', { target: NAME }, ['target']),
    tool('canvas_draw', 'Draw a small diagram you compose yourself (up to about ten nodes): nodes and the arrows between them, laid out left to right.',
      {
        title: { type: 'string' },
        nodes: { type: 'array', items: { type: 'object', properties: NODE_PROPS, required: ['id', 'text'] } },
        edges: { type: 'array', items: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' }, label: { type: 'string' } }, required: ['from', 'to'] } }
      }, ['nodes']),
    tool('canvas_design', 'Hand a whole idea to the designer: it draws a scheme of it on the canvas in seconds and answers a tour; then walk the owner through the tour with canvas_highlight, saying each stop.',
      { idea: { type: 'string', description: 'The idea in the owner\'s words, with what matters in it.' } }, ['idea'])
  ]
}

/** What the call is told about the canvas, after its own words (ADR-0201 §6). */
export function canvasInstructions(locale: string): string {
  return locale === 'en'
    ? 'The owner also has a canvas. Work in projects (tasks, sessions, code) goes to the CEO with ask_ceo or to your session tools. Drawing, sketching and showing go to the canvas: do a simple act yourself (canvas_add, canvas_connect, canvas_focus, canvas_highlight, canvas_remove); for a whole idea («draw», «sketch», «make a scheme») call canvas_design, then walk the owner through its tour, highlighting each stop as you speak. When a name matches nothing, say which names exist.'
    : 'У владельца есть канвас. Работа в проектах (задачи, сессии, код) идёт CEO через ask_ceo или твоими инструментами сессий. Рисовать, набрасывать и показывать нужно на канвасе: простое действие делай сам (canvas_add, canvas_connect, canvas_focus, canvas_highlight, canvas_remove); целую идею («нарисуй», «набросай», «сделай схему») отдай проектировщику через canvas_design, потом проведи владельца по его маршруту, подсвечивая каждую остановку, пока говоришь о ней. Если имя ничему не соответствует, скажи, какие есть.'
}
// #endregion canvas-commands

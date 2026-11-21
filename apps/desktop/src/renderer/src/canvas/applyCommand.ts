// #region canvas-apply — docs: docs/adr/0201-the-canvas-is-an-excalidraw-window-a-designer-draws-on.md#decision
/**
 * A command from the CEO's call, applied in the canvas window with Excalidraw's API (ADR-0201 §4): names found by
 * `shared/canvas.ts#resolveRef`, new things placed beside what the canvas holds, a diagram laid out by
 * `layoutDiagram` and turned into elements through Excalidraw's own skeleton converter, the view moved to what was
 * drawn or named. Excalidraw is reached through `CanvasApi` and `CanvasLib`, so the tests drive this with fakes.
 */
import {
  HIGHLIGHT_STROKE, INK_STROKE, diagramSkeletons, layoutDiagram, liteElements, nodeSize, originBeside, parseDiagram, resolveRef, summarize,
  type CanvasAnswer, type CanvasCommand, type CanvasElementLite, type Diagram, type Skeleton, type TourStep
} from '../../../shared/canvas'

/** A JSON object of Excalidraw's own (an app state, the files of a scene). */
export type Bag = Record<string, unknown>
/** The scene a canvas opens with. */
export type Initial = { elements: unknown[]; appState: Bag; files: Bag } | null
/** The editor's API as the window holds it: the commands' part, and what a save reads. */
export type WindowApi = CanvasApi & { getAppState(): Bag; getFiles(): Bag }

/** An Excalidraw element, as far as this file reads and writes it. */
export interface El {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  isDeleted?: boolean
  containerId?: string | null
  boundElements?: ReadonlyArray<{ id: string; type: string }> | null
  customData?: Record<string, unknown>
  strokeColor?: string
  strokeWidth?: number
  [key: string]: unknown
}

export interface CanvasApi {
  getSceneElements(): readonly El[]
  updateScene(scene: { elements?: readonly El[]; appState?: Record<string, unknown>; captureUpdate?: unknown }): void
  scrollToContent(target?: El | readonly El[], opts?: { fitToViewport?: boolean; viewportZoomFactor?: number; animate?: boolean; duration?: number; maxZoom?: number }): void
}

export interface CanvasLib {
  /** Excalidraw's `convertToExcalidrawElements`, ids kept. */
  convert(skeletons: Skeleton[]): El[]
  /** Excalidraw's `newElementWith`: a copy with the patch and a new version. */
  patch(el: El, patch: Record<string, unknown>): El
  /** `CaptureUpdateAction.IMMEDIATELY` (the person's undo sees it) and `NEVER` (a highlight, gone by itself). */
  capture: { immediately: unknown; never: unknown }
  /** A short random token, unique to one drawing. */
  nonce(): string
  later(fn: () => void, ms: number): void
}

/** How the view moves to one element: it takes about a third of the window, never zoomed past 120 %. */
export const LOOK_AT_ONE = { fitToViewport: true, viewportZoomFactor: 0.35, maxZoom: 1.2, animate: true } as const
/** How the view moves to several, or to the whole canvas: they fill most of the window, never zoomed past 100 %. */
export const LOOK_AT_ALL = { fitToViewport: true, viewportZoomFactor: 0.9, maxZoom: 1, animate: true } as const

/** How long a highlight stays outlined. */
export const HIGHLIGHT_MS = 2500

export function applyCommand(api: CanvasApi, lib: CanvasLib, cmd: CanvasCommand): CanvasAnswer {
  const scene = api.getSceneElements().filter((e) => !e.isDeleted)
  const lite = liteElements(scene)
  const byId = new Map(scene.map((e) => [e.id, e]))
  const unresolved: NonNullable<CanvasAnswer['unresolved']> = []
  const find = (name: string): El | null => {
    const r = resolveRef(lite, name)
    if (r.ok) return byId.get(r.id) ?? null
    unresolved.push({ name, candidates: r.candidates })
    return null
  }
  const failed = (reason: string): CanvasAnswer => ({ ok: false, reason, ...(unresolved.length ? { unresolved } : {}) })
  const nameOf = (el: El): string => (typeof el.customData?.fabricId === 'string' ? el.customData.fabricId : el.id)

  switch (cmd.op) {
    case 'open':
      return { ok: true }
    case 'read':
      return { ok: true, elements: summarize(lite) }
    case 'focus': {
      if (!cmd.target) {
        api.scrollToContent(undefined, LOOK_AT_ALL)
        return { ok: true, focused: [] }
      }
      const el = find(cmd.target)
      if (!el) return failed(`nothing on the canvas is called «${cmd.target}»`)
      api.scrollToContent(el, LOOK_AT_ONE)
      return { ok: true, focused: [nameOf(el)] }
    }
    case 'highlight': {
      const el = find(cmd.target)
      if (!el) return failed(`nothing on the canvas is called «${cmd.target}»`)
      highlight(api, lib, el)
      return { ok: true, highlighted: [nameOf(el)], focused: [nameOf(el)] }
    }
    case 'remove': {
      const el = find(cmd.target)
      if (!el) return failed(`nothing on the canvas is called «${cmd.target}»`)
      const gone = new Set([el.id, ...(el.boundElements ?? []).filter((b) => b.type === 'text').map((b) => b.id)])
      api.updateScene({ elements: api.getSceneElements().map((e) => (gone.has(e.id) ? lib.patch(e, { isDeleted: true }) : e)), captureUpdate: lib.capture.immediately })
      return { ok: true, removed: [nameOf(el)] }
    }
    case 'connect': {
      const from = find(cmd.from), to = find(cmd.to)
      if (!from || !to) return failed('one end of the arrow is not on the canvas')
      const added = boundArrow(lib, from, to, cmd.label, `fx-${lib.nonce()}-link`)
      commit(api, lib, added)
      return { ok: true, drawn: [`${nameOf(from)}->${nameOf(to)}`] }
    }
    case 'add': {
      const from = cmd.connectFrom ? find(cmd.connectFrom) : null
      if (cmd.connectFrom && !from) return failed(`nothing on the canvas is called «${cmd.connectFrom}»`)
      const id = freeName(lite, cmd.node.id || 'n1')
      const node = { ...cmd.node, id, kind: cmd.node.kind ?? 'box' }
      const size = nodeSize(node)
      const at = from ? besideOf(from, lite, size) : originBeside(lite)
      const diagram: Diagram = { nodes: [node], edges: [] }
      const nonce = lib.nonce()
      const made = lib.convert(diagramSkeletons(diagram, new Map([[id, { ...at, ...size }]]), nonce))
      const shape = made.find((e) => e.customData?.fabricId === id)!
      const added = from ? [...made, ...boundArrow(lib, from, shape, cmd.label, `fx-${nonce}-link`)] : made
      commit(api, lib, added)
      api.scrollToContent(shape, LOOK_AT_ONE)
      return { ok: true, drawn: [id] }
    }
    case 'draw': {
      // Main checked it already; checked again here, so nothing drawn here rests on the sender (a kind left out is a box).
      const checked = parseDiagram(cmd.diagram)
      if (!checked.ok) return failed(checked.reason)
      const { diagram, renamed } = withFreeNames(checked.value, lite)
      const nonce = lib.nonce()
      const made = lib.convert(diagramSkeletons(diagram, layoutDiagram(diagram, originBeside(lite)), nonce))
      commit(api, lib, made)
      api.scrollToContent(made, LOOK_AT_ALL)
      const tour = diagram.tour?.map((t): TourStep => ({ node: t.node, say: t.say }))
      return { ok: true, drawn: diagram.nodes.map((n) => n.id), ...(tour?.length ? { tour } : {}), ...(renamed.length ? { reason: `renamed to keep names unique: ${renamed.join(', ')}` } : {}) }
    }
    case 'design':
      // The designer runs in main; the window only ever draws what it answered.
      return { ok: false, reason: 'the designer runs in the main process' }
  }
}

/** Every text a command would draw, so the window can load the font's glyphs for them first: Excalidraw measures a
 *  label when it makes it, and a label measured before its font loaded overflows its shape. */
export function textsOf(cmd: CanvasCommand): string[] {
  switch (cmd.op) {
    case 'add': return [cmd.node.text, ...(cmd.label ? [cmd.label] : [])]
    case 'connect': return cmd.label ? [cmd.label] : []
    case 'draw': return [...cmd.diagram.nodes.map((n) => n.text), ...cmd.diagram.edges.flatMap((e) => (e.label ? [e.label] : []))]
    default: return []
  }
}

/** New elements added to the scene, and the shapes an arrow binds to replaced by their updated copies. */
function commit(api: CanvasApi, lib: CanvasLib, added: readonly El[]): void {
  const replaced = new Map(added.map((e) => [e.id, e]))
  const kept = api.getSceneElements().map((e) => replaced.get(e.id) ?? e)
  const fresh = added.filter((e) => !kept.some((k) => k.id === e.id))
  api.updateScene({ elements: [...kept.map((e) => replaced.get(e.id) ?? e), ...fresh], captureUpdate: lib.capture.immediately })
}

/** Outline an element for a few seconds and bring it into view; the outline leaves the person's undo alone. */
function highlight(api: CanvasApi, lib: CanvasLib, el: El): void {
  const before = { strokeColor: el.strokeColor, strokeWidth: el.strokeWidth }
  api.updateScene({
    elements: api.getSceneElements().map((e) => (e.id === el.id ? lib.patch(e, { strokeColor: HIGHLIGHT_STROKE, strokeWidth: 4 }) : e)),
    appState: { selectedElementIds: { [el.id]: true } },
    captureUpdate: lib.capture.never
  })
  api.scrollToContent(el, LOOK_AT_ONE)
  lib.later(() => {
    api.updateScene({
      // Only an outline still ours is taken back: a colour the person chose meanwhile stays.
      elements: api.getSceneElements().map((e) => (e.id === el.id && e.strokeColor === HIGHLIGHT_STROKE ? lib.patch(e, before) : e)),
      appState: { selectedElementIds: {} },
      captureUpdate: lib.capture.never
    })
  }, HIGHLIGHT_MS)
}

/** An arrow between two elements already on the canvas, bound to both, so it follows them when the person moves
 *  them; the two shapes come back with the arrow among their bound elements. */
export function boundArrow(lib: CanvasLib, from: El, to: El, label: string | undefined, id: string): El[] {
  const a = edgePoint(from, centre(to)), b = edgePoint(to, centre(from))
  const [arrow, ...rest] = lib.convert([{
    type: 'arrow', id, x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y,
    points: [[0, 0], [b.x - a.x, b.y - a.y]],
    strokeColor: INK_STROKE,
    ...(label ? { label: { text: label, fontSize: 16 } } : {}),
    customData: { fabricId: `${nameOfEl(from)}->${nameOfEl(to)}` }
  }])
  const bound = lib.patch(arrow!, {
    startBinding: { elementId: from.id, focus: 0, gap: 8 },
    endBinding: { elementId: to.id, focus: 0, gap: 8 }
  })
  const withArrow = (el: El): El => lib.patch(el, { boundElements: [...(el.boundElements ?? []), { id: bound.id, type: 'arrow' }] })
  return [bound, ...rest, withArrow(from), withArrow(to)]
}

const nameOfEl = (el: El): string => (typeof el.customData?.fabricId === 'string' ? el.customData.fabricId : el.id)
const centre = (el: { x: number; y: number; width: number; height: number }): { x: number; y: number } => ({ x: el.x + el.width / 2, y: el.y + el.height / 2 })

/** Where the line from an element's centre toward a point leaves its box. */
export function edgePoint(el: { x: number; y: number; width: number; height: number }, toward: { x: number; y: number }): { x: number; y: number } {
  const c = centre(el)
  const dx = toward.x - c.x, dy = toward.y - c.y
  if (dx === 0 && dy === 0) return c
  const sx = dx === 0 ? Infinity : el.width / 2 / Math.abs(dx)
  const sy = dy === 0 ? Infinity : el.height / 2 / Math.abs(dy)
  const s = Math.min(sx, sy)
  return { x: c.x + dx * s, y: c.y + dy * s }
}

/** A place to the right of an element, moved down past anything already there. */
function besideOf(el: El, lite: readonly CanvasElementLite[], size: { width: number; height: number }): { x: number; y: number } {
  const x = el.x + el.width + 120
  let y = el.y
  const hits = (yy: number): boolean => lite.some((o) => o.x < x + size.width && x < o.x + o.width && o.y < yy + size.height && yy < o.y + o.height)
  for (let i = 0; i < 50 && hits(y); i++) y += size.height + 40
  return { x, y }
}

/** A name not taken on the canvas: the one asked for, else it with -2, -3 and on. */
function freeName(lite: readonly CanvasElementLite[], wanted: string, taken: ReadonlySet<string> = new Set()): string {
  const used = new Set([...lite.map((e) => e.fabricId).filter((n): n is string => !!n), ...taken])
  if (!used.has(wanted)) return wanted
  for (let i = 2; ; i++) if (!used.has(`${wanted}-${i}`)) return `${wanted}-${i}`
}

/** A diagram whose node names the canvas already holds gets free ones, its links and tour renamed with them. */
function withFreeNames(d: Diagram, lite: readonly CanvasElementLite[]): { diagram: Diagram; renamed: string[] } {
  const map = new Map<string, string>()
  const taken = new Set<string>()
  for (const n of d.nodes) {
    const free = freeName(lite, n.id, taken)
    taken.add(free)
    if (free !== n.id) map.set(n.id, free)
  }
  if (!map.size) return { diagram: d, renamed: [] }
  const to = (id: string): string => map.get(id) ?? id
  return {
    diagram: {
      ...d,
      nodes: d.nodes.map((n) => ({ ...n, id: to(n.id) })),
      edges: d.edges.map((e) => ({ ...e, from: to(e.from), to: to(e.to) })),
      ...(d.tour ? { tour: d.tour.map((t) => ({ ...t, node: to(t.node) })) } : {})
    },
    renamed: [...map].map(([a, b]) => `${a} → ${b}`)
  }
}
// #endregion canvas-apply

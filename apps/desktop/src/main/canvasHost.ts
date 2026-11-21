// #region canvas-host — docs: docs/adr/0201-the-canvas-is-an-excalidraw-window-a-designer-draws-on.md#decision
/**
 * The canvas's main-process half (ADR-0201 §4, §5): a voice tool's call becomes a command checked by
 * `shared/canvas.ts#parseCanvasTool`, the canvas window is opened when it is closed and waited for until it says it is
 * ready, the command is sent to it and its answer awaited at most `CANVAS_COMMAND_MS`; a late answer is dropped
 * (CV-REQ-11). `canvas_design` reads what the canvas holds, asks the designer (`canvasDesigner.ts`) and sends the
 * diagram it answered as a drawing, with its tour for the call to walk. Electron stays outside: the window and the
 * designer are ports, so the tests drive the whole path.
 */
import { CANVAS_COMMAND_MS, DEFAULT_CANVAS_ID, parseCanvasTool, type CanvasAnswer, type CanvasCommand, type ElementSummary } from '../shared/canvas.ts'
import type { DesignAnswer } from './canvasDesigner.ts'

export interface CanvasWindowPort {
  /** Open the canvas's window, or bring it to the front; one per canvas. */
  open(canvasId: string): void
  /** Send a command to the canvas's window; false when it has none. */
  send(canvasId: string, requestId: string, command: CanvasCommand): boolean
}

export interface CanvasHostDeps {
  window: CanvasWindowPort
  design(idea: string, existing: readonly ElementSummary[]): Promise<DesignAnswer>
  record(op: string, detail: Record<string, unknown>): void
  newId(): string
  timeoutMs?: number
}

type Pending = { canvasId: string; resolve: (a: CanvasAnswer) => void; timer: ReturnType<typeof setTimeout> }

export function createCanvasHost(deps: CanvasHostDeps) {
  const timeoutMs = deps.timeoutMs ?? CANVAS_COMMAND_MS
  const pending = new Map<string, Pending>()
  /** Canvases whose window said it is ready, and those waiting to hear it. */
  const ready = new Set<string>()
  const waiting = new Map<string, Array<(ok: boolean) => void>>()

  /** Open the window and wait until it can take commands, at most the command deadline. */
  function opened(canvasId: string): Promise<boolean> {
    deps.window.open(canvasId)
    if (ready.has(canvasId)) return Promise.resolve(true)
    return new Promise((resolve) => {
      const list = waiting.get(canvasId) ?? []
      const timer = setTimeout(() => { done(false) }, timeoutMs)
      const done = (ok: boolean): void => { clearTimeout(timer); const i = list.indexOf(done); if (i >= 0) list.splice(i, 1); resolve(ok) }
      list.push(done)
      waiting.set(canvasId, list)
    })
  }

  function send(canvasId: string, command: CanvasCommand): Promise<CanvasAnswer> {
    const requestId = deps.newId()
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        pending.delete(requestId)
        resolve({ ok: false, reason: 'the canvas did not answer within 10 seconds' })
      }, timeoutMs)
      pending.set(requestId, { canvasId, resolve, timer })
      if (!deps.window.send(canvasId, requestId, command)) {
        clearTimeout(timer)
        pending.delete(requestId)
        resolve({ ok: false, reason: 'the canvas window is not open' })
      }
    })
  }

  async function command(canvasId: string, cmd: CanvasCommand): Promise<CanvasAnswer> {
    if (!(await opened(canvasId))) return { ok: false, reason: 'the canvas window did not open within 10 seconds' }
    if (cmd.op === 'open') return { ok: true }
    if (cmd.op !== 'design') return send(canvasId, cmd)
    const holds = await send(canvasId, { op: 'read' })
    const design = await deps.design(cmd.idea, holds.elements ?? [])
    deps.record('canvas.design', design.ok
      ? { outcome: 'ok', nodes: design.diagram.nodes.length, edges: design.diagram.edges.length, ...design.usage }
      : { outcome: 'failed', reason: design.reason, detail: design.detail.slice(0, 200) })
    if (!design.ok) return { ok: false, reason: designerWords[design.reason] }
    const drawn = await send(canvasId, { op: 'draw', diagram: design.diagram })
    // The window's tour names the nodes as drawn (renamed when the canvas already held a name); the designer's otherwise.
    const tour = drawn.tour ?? design.diagram.tour
    return { ...drawn, ...(tour ? { tour } : {}) }
  }

  return {
    /** A voice tool's answer, or null when the tool is not the canvas's. */
    async runTool(name: string, args: unknown, canvasId: string = DEFAULT_CANVAS_ID): Promise<Record<string, unknown> | null> {
      const parsed = parseCanvasTool(name, args)
      if (!parsed) return null
      if (!parsed.ok) return { ok: false, reason: parsed.reason }
      const answer = await command(canvasId, parsed.value)
      deps.record('canvas.command', { op: parsed.value.op, outcome: answer.ok ? 'ok' : 'failed', drawn: answer.drawn?.length ?? 0, unresolved: answer.unresolved?.length ?? 0 })
      return answer as unknown as Record<string, unknown>
    },
    /** The menu's «Канвас»: open the window, nothing awaited. */
    open(canvasId: string = DEFAULT_CANVAS_ID): void { deps.window.open(canvasId) },
    /** The window said it can take commands. */
    ready(canvasId: string): void {
      ready.add(canvasId)
      for (const done of [...(waiting.get(canvasId) ?? [])]) done(true)
      waiting.delete(canvasId)
    },
    /** The window closed: its commands in flight are answered at once, and the next one opens it again. */
    closed(canvasId: string): void {
      ready.delete(canvasId)
      for (const [id, p] of pending) {
        if (p.canvasId !== canvasId) continue
        clearTimeout(p.timer)
        pending.delete(id)
        p.resolve({ ok: false, reason: 'the canvas window was closed' })
      }
    },
    /** The window's answer to a command; false for one nobody waits for any more (late, or from another canvas). */
    answered(canvasId: string, requestId: string, answer: unknown): boolean {
      const p = pending.get(requestId)
      if (!p || p.canvasId !== canvasId) return false
      clearTimeout(p.timer)
      pending.delete(requestId)
      p.resolve(sanitize(answer))
      return true
    }
  }
}

export type CanvasHost = ReturnType<typeof createCanvasHost>

const designerWords: Record<'no-key' | 'unreachable' | 'refused' | 'unreadable', string> = {
  'no-key': 'the designer has no OpenRouter key in Observatory\'s vault (fabric/prod/OPENROUTER_API_KEY)',
  unreachable: 'the designer\'s model did not answer',
  refused: 'the designer\'s model refused the request',
  unreadable: 'the designer answered no usable scheme'
}

/** A window's answer as main hands it on: only the fields of `CanvasAnswer`, each of its type. */
function sanitize(raw: unknown): CanvasAnswer {
  const a = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const strings = (v: unknown): string[] | undefined => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string').slice(0, 100) : undefined)
  const out: CanvasAnswer = { ok: a.ok === true }
  if (typeof a.reason === 'string') out.reason = a.reason.slice(0, 300)
  for (const k of ['drawn', 'focused', 'highlighted', 'removed'] as const) { const s = strings(a[k]); if (s) out[k] = s }
  if (Array.isArray(a.unresolved)) out.unresolved = a.unresolved.slice(0, 20).map((u) => ({ name: String((u as { name?: unknown }).name ?? ''), candidates: strings((u as { candidates?: unknown }).candidates) ?? [] }))
  if (Array.isArray(a.tour)) out.tour = a.tour.slice(0, 20).map((t) => { const r = t as Record<string, unknown>; return { node: String(r.node ?? ''), say: String(r.say ?? '').slice(0, 400) } })
  if (Array.isArray(a.elements)) out.elements = a.elements.slice(0, 60).map((e) => { const r = e as Record<string, unknown>; return { name: String(r.name ?? ''), kind: String(r.kind ?? ''), text: String(r.text ?? '').slice(0, 200) } })
  return out
}
// #endregion canvas-host

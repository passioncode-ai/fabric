// #region canvas-store — docs: docs/adr/0201-the-canvas-is-an-excalidraw-window-a-designer-draws-on.md#decision
/**
 * Where a canvas is kept (ADR-0201 §3): `userData/canvases/<id>.excalidraw`, Excalidraw's own file (a JSON scene with
 * `"type": "excalidraw"`), so the file opens anywhere Excalidraw does. Written whole and atomically (a temporary file
 * beside it, then a rename), readable by the owner alone (0600), at most `MAX_CANVAS_BYTES`. A file that is not a
 * canvas is never overwritten by a read: it opens as an empty canvas and stays on disk until the person draws.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { isCanvasId, type CanvasRead, type CanvasWrite } from '../shared/canvas.ts'

/** A canvas larger than this is refused: 20 MB holds thousands of elements; pictures are a later slice. */
export const MAX_CANVAS_BYTES = 20 * 1024 * 1024

/** Whether a text is an Excalidraw scene: JSON whose `type` is `excalidraw` and whose `elements` is a list. */
export function isScene(text: string): boolean {
  try {
    const v = JSON.parse(text) as { type?: unknown; elements?: unknown }
    return v?.type === 'excalidraw' && Array.isArray(v.elements)
  } catch {
    // Not JSON: not a scene.
    return false
  }
}

export function createCanvasStore(dir: string, now: () => number = Date.now) {
  const fileOf = (id: string): string => path.join(dir, `${id}.excalidraw`)

  function read(id: unknown): CanvasRead {
    if (!isCanvasId(id)) return { ok: false, id: String(id).slice(0, 64), reason: 'bad-id' }
    const file = fileOf(id)
    if (!existsSync(file)) return { ok: true, id, scene: null, savedAt: null }
    try {
      const size = statSync(file).size
      if (size > MAX_CANVAS_BYTES) return { ok: false, id, reason: 'too-large' }
      const text = readFileSync(file, 'utf8')
      if (!isScene(text)) return { ok: false, id, reason: 'not-a-canvas' }
      return { ok: true, id, scene: text, savedAt: statSync(file).mtimeMs }
    } catch {
      // Permissions or a vanished file: said as unreadable, the file left as it is.
      return { ok: false, id, reason: 'unreadable' }
    }
  }

  function write(id: unknown, scene: unknown): CanvasWrite {
    if (!isCanvasId(id)) return { ok: false, reason: 'bad-id' }
    if (typeof scene !== 'string' || !isScene(scene)) return { ok: false, reason: 'not-a-canvas' }
    if (Buffer.byteLength(scene, 'utf8') > MAX_CANVAS_BYTES) return { ok: false, reason: 'too-large' }
    const file = fileOf(id)
    const tmp = `${file}.${process.pid}.tmp`
    try {
      mkdirSync(dir, { recursive: true, mode: 0o700 })
      writeFileSync(tmp, scene, { encoding: 'utf8', mode: 0o600 })
      chmodSync(tmp, 0o600)
      renameSync(tmp, file)
      return { ok: true, savedAt: now() }
    } catch (e) {
      try { rmSync(tmp, { force: true }) } catch { /* the temporary file is gone already */ }
      return { ok: false, reason: 'unwritable', detail: e instanceof Error ? (e as NodeJS.ErrnoException).code ?? e.name : 'error' }
    }
  }

  /** The canvases on disk, newest first. */
  function list(): Array<{ id: string; savedAt: number }> {
    if (!existsSync(dir)) return []
    return readdirSync(dir)
      .filter((f) => f.endsWith('.excalidraw') && isCanvasId(f.slice(0, -'.excalidraw'.length)))
      .map((f) => ({ id: f.slice(0, -'.excalidraw'.length), savedAt: statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.savedAt - a.savedAt)
  }

  return { read, write, list, fileOf }
}

export type CanvasStore = ReturnType<typeof createCanvasStore>
// #endregion canvas-store

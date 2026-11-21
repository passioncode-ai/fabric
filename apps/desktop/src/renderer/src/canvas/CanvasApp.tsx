// #region canvas-window — docs: docs/ux/scenarios.md#scn-190-draw-on-the-canvas-with-the-mouse
/**
 * The canvas window (ADR-0201, SCR-91): Excalidraw over the whole window, the canvas read from disk when it opens,
 * saved as the person or the designer changes it (`SAVE_AFTER_MS` after the last change, only when the scene changed),
 * and the commands of the CEO's call applied as they arrive (`applyCommand.ts`) and answered to main. The save state
 * sits in the editor's top-right slot; a failure keeps the drawing in the window and tries again at the next change.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CaptureUpdateAction, Excalidraw, convertToExcalidrawElements, getSceneVersion, newElementWith, serializeAsJSON
} from '@excalidraw/excalidraw'
import { useT } from '../i18n'
import { LABEL_SIZE, type CanvasCommand } from '../../../shared/canvas'
import { applyCommand, textsOf, type CanvasLib, type El, type Initial, type WindowApi } from './applyCommand'

/** How long after the last change a canvas is written. */
export const SAVE_AFTER_MS = 700
/** How long a command waits for its font before it draws anyway. */
export const FONT_WAIT_MS = 1500

type SaveState = 'loading' | 'saved' | 'saving' | 'unsaved' | 'error'

const lib: CanvasLib = {
  convert: (skeletons) => convertToExcalidrawElements(skeletons as never, { regenerateIds: false }) as unknown as El[],
  patch: (el, patch) => newElementWith(el as never, patch as never) as unknown as El,
  capture: { immediately: CaptureUpdateAction.IMMEDIATELY, never: CaptureUpdateAction.NEVER },
  nonce: () => Math.random().toString(36).slice(2, 8),
  later: (fn, ms) => { setTimeout(fn, ms) }
}

export function CanvasApp({ canvasId, dark, locale }: { canvasId: string; dark: boolean; locale: string }): React.JSX.Element {
  const t = useT()
  const [initial, setInitial] = useState<Initial | undefined>(undefined)
  const [state, setState] = useState<SaveState>('loading')
  const [problem, setProblem] = useState<string | null>(null)
  const api = useRef<WindowApi | null>(null)
  const savedVersion = useRef<number>(-1)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let live = true
    window.fabric.canvas.load(canvasId).then((r) => {
      if (!live) return
      if (!r.ok) {
        // Not a canvas, too large or unreadable: an empty canvas, the file left as it is until the person draws.
        setProblem(t(`canvas.read.${r.reason}` as 'canvas.read.unreadable'))
        setInitial(null)
        return
      }
      if (!r.scene) { setInitial(null); return }
      const scene = JSON.parse(r.scene) as Partial<NonNullable<Initial>>
      savedVersion.current = getSceneVersion((scene.elements ?? []) as never)
      setInitial({ elements: scene.elements ?? [], appState: { ...(scene.appState ?? {}), collaborators: new Map() }, files: scene.files ?? {} })
    }).catch(() => { if (live) { setProblem(t('canvas.read.unreadable')); setInitial(null) } })
    return () => { live = false }
  }, [canvasId, t])

  const save = useCallback(() => {
    const a = api.current
    if (!a) return
    const elements = a.getSceneElements()
    const version = getSceneVersion(elements as never)
    if (version === savedVersion.current) { setState('saved'); return }
    setState('saving')
    const text = serializeAsJSON(elements as never, a.getAppState() as never, a.getFiles() as never, 'local')
    window.fabric.canvas.save(canvasId, text).then((r) => {
      if (r.ok) { savedVersion.current = version; setState('saved'); setProblem(null) }
      else { setState('error'); setProblem(t(`canvas.write.${r.reason}` as 'canvas.write.unwritable')) }
    }).catch(() => { setState('error'); setProblem(t('canvas.write.unwritable')) })
  }, [canvasId, t])

  const changed = useCallback((elements: readonly unknown[]) => {
    if (getSceneVersion(elements as never) === savedVersion.current) return
    setState('unsaved')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(save, SAVE_AFTER_MS)
  }, [save])

  // A window closing with a change not yet written writes it first.
  useEffect(() => {
    const flush = (): void => { if (timer.current) { clearTimeout(timer.current); timer.current = null; save() } }
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  }, [save])

  // The call's commands: applied in order, each answered to main with what was drawn, found or not found. The
  // hand-drawn font's glyphs for the command's words are loaded first (at most `FONT_WAIT_MS`), so labels fit.
  const queue = useRef<Promise<void>>(Promise.resolve())
  useEffect(() => window.fabric.canvas.onCommand((id, requestId, command: CanvasCommand) => {
    if (id !== canvasId) return
    queue.current = queue.current.then(async () => {
      const texts = textsOf(command).join(' ')
      if (texts) await Promise.race([document.fonts.load(`${LABEL_SIZE}px Excalifont`, texts).catch(() => []), new Promise((r) => setTimeout(r, FONT_WAIT_MS))])
      const a = api.current
      let answer
      try {
        answer = a ? applyCommand(a, lib, command) : { ok: false, reason: 'the canvas is still loading' }
      } catch (e) {
        answer = { ok: false, reason: `the canvas could not apply it: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300) }
      }
      await window.fabric.canvas.answer(canvasId, requestId, answer)
    })
  }), [canvasId])

  if (initial === undefined) return <div className="canvas-root booting" />
  return (
    <div className="canvas-root">
      {problem && <div className="canvas-problem" role="alert">{problem}</div>}
      <Excalidraw
        initialData={initial ? { elements: initial.elements as never, appState: initial.appState as never, files: initial.files as never, scrollToContent: true } : null}
        excalidrawAPI={(x) => {
          api.current = x as unknown as typeof api.current
          setState((s) => (s === 'loading' ? 'saved' : s))
          void window.fabric.canvas.ready(canvasId)
        }}
        onChange={(elements) => changed(elements)}
        theme={dark ? 'dark' : 'light'}
        langCode={locale === 'en' ? 'en' : 'ru-RU'}
        name={canvasId === 'main' ? t('canvas.title') : canvasId}
        UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false } }}
        renderTopRightUI={() => (
          <span className={`canvas-state${state === 'error' ? ' is-error' : ''}`} role="status">{t(`canvas.state.${state}` as 'canvas.state.saved')}</span>
        )}
      />
    </div>
  )
}
// #endregion canvas-window

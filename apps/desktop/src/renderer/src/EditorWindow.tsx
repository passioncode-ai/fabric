// A detached editor window for one file. Monaco is the editor (the VS Code
// engine), and it is also what resolves the conflict this app cannot avoid:
// agents work in these same repositories, so a file open here can change under
// it. On save we compare the hash we read against the disk; if it moved, we
// show Monaco's own diff — yours against the one on disk — and the operator
// decides. Nothing is overwritten silently.

import { useEffect, useRef, useState } from 'react'
import { afterSave, closeWouldLoseWork } from '../../shared/editorBuffer.ts'
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/language/typescript/ts.worker?worker'
import type { FilePayload } from '../../shared/types'
import { Banner, Button, EmptyState, StateChip, Toolbar } from './components'
import { useT } from './i18n'

// Vite bundles these; Monaco asks for them by label.
self.MonacoEnvironment = {
  getWorker(_id: string, label: string) {
    if (label === 'json') return new jsonWorker()
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker()
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker()
    if (label === 'typescript' || label === 'javascript') return new tsWorker()
    return new editorWorker()
  }
}

/** Monaco's themes are its own; these two mirror the pack's terminal surface so
 *  the editor belongs to the app rather than to VS Code. Values are read from
 *  the token layer at runtime, never hardcoded here. */
function defineThemes(): void {
  const token = (name: string): string =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const base = (kind: 'vs' | 'vs-dark'): monaco.editor.IStandaloneThemeData => ({
    base: kind,
    inherit: true,
    rules: [],
    colors: {
      'editor.background': token('--terminal'),
      'editor.foreground': token('--ink'),
      'editorLineNumber.foreground': token('--muted'),
      'editorGutter.background': token('--terminal')
    }
  })
  monaco.editor.defineTheme('fabric-dark', base('vs-dark'))
  monaco.editor.defineTheme('fabric-light', base('vs'))
}

export function EditorWindow({ filePath }: { filePath: string }): React.JSX.Element {
  const t = useT()
  const host = useRef<HTMLDivElement>(null)
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const diffEditor = useRef<monaco.editor.IStandaloneDiffEditor | null>(null)
  const [file, setFile] = useState<FilePayload | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [writeError, setWriteError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [conflict, setConflict] = useState<{ current: string; currentHash: string } | null>(null)
  const [saved, setSaved] = useState(false)
  /** Set when a close was stopped because the buffer was dirty (UX-05). */
  const [closing, setClosing] = useState(false)
  /** The operator has said discard; the next close must go through. */
  const leaving = useRef(false)

  useEffect(() => {
    window.fabric.files.read(filePath).then(setFile).catch((e) => setLoadError(String(e)))
  }, [filePath])

  // The plain editor.
  useEffect(() => {
    if (!file || !host.current || conflict) return
    defineThemes()
    const dark = document.documentElement.getAttribute('data-theme') !== 'light'
    const ed = monaco.editor.create(host.current, {
      value: file.content,
      language: file.language,
      theme: dark ? 'fabric-dark' : 'fabric-light',
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 13,
      fontFamily: getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim(),
      scrollBeyondLastLine: false
    })
    editor.current = ed
    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => void save(false))
    ed.focus()
    const sub = ed.onDidChangeModelContent(() => {
      setDirty(ed.getValue() !== file.content)
      setSaved(false)
    })
    return () => {
      sub.dispose()
      ed.dispose()
      editor.current = null
    }
  }, [file, conflict])

  // The diff, shown only when the disk moved under us.
  useEffect(() => {
    if (!conflict || !file || !host.current) return
    defineThemes()
    const dark = document.documentElement.getAttribute('data-theme') !== 'light'
    const de = monaco.editor.createDiffEditor(host.current, {
      theme: dark ? 'fabric-dark' : 'fabric-light',
      automaticLayout: true,
      originalEditable: false,
      renderSideBySide: true,
      minimap: { enabled: false },
      fontSize: 13
    })
    de.setModel({
      original: monaco.editor.createModel(conflict.current, file.language),
      modified: monaco.editor.createModel(pendingContent.current ?? file.content, file.language)
    })
    diffEditor.current = de
    return () => {
      de.getModel()?.original.dispose()
      de.getModel()?.modified.dispose()
      de.dispose()
      diffEditor.current = null
    }
  }, [conflict, file])

  const pendingContent = useRef<string | null>(null)

  const save = async (force = false): Promise<void> => {
    if (!file) return
    // Never synthesise content. When the editor that owns the buffer is gone —
    // it is disposed while the diff is on screen — writing '' would truncate the
    // file, which is the one outcome this whole conflict path exists to prevent.
    const content = force
      ? (diffEditor.current?.getModel()?.modified.getValue() ?? pendingContent.current)
      : (editor.current?.getValue() ?? null)
    if (content === null || content === undefined) return
    pendingContent.current = content
    try {
      // M139 — overwriting what changed on disk is a floored effect, so the
      // operator's decision is presented as authority rather than as a boolean.
      // The grant names this file, expires in a minute and is spent once; an
      // ordinary save presents none and is decided by the hash alone.
      const grant = force ? await window.fabric.files.requestOverwrite(filePath) : null
      const result = await window.fabric.files.write(
        filePath,
        content,
        conflict?.currentHash ?? file.hash,
        grant?.grantId
      )
      if (result.ok) {
        // UX-04. `content` was read BEFORE the round-trip, so anything typed
        // while it was in flight is NOT in what was just written. Declaring the
        // buffer clean here marked those keystrokes as saved when they were
        // not — and then closing the window discarded them without asking,
        // because nothing believed there was anything to lose.
        //
        // The save succeeded for `content`. Whether the BUFFER is clean is a
        // different question, and it is answered by reading it now.
        const state = afterSave(content, editor.current?.getValue() ?? content)
        setFile({ ...file, content, hash: result.hash })
        setConflict(null)
        setDirty(state.dirty)
        setSaved(state.saved)
      } else if (result.reason === 'refused') {
        // Shown in the operator's own banner with policy's own words. An
        // authority that refuses silently is indistinguishable from one that
        // never ran.
        setWriteError(t('editor.overwriteRefused', { reason: result.detail }))
      } else {
        setConflict({ current: result.current, currentHash: result.currentHash })
      }
    } catch (e) {
      setWriteError(String(e))
    }
  }

  // UX-05 — closing with unsaved work asks first.
  //
  // Electron lets a renderer cancel its own close from `beforeunload`, and
  // cancelling is all it does: no native dialog appears, so the asking is ours
  // to do. That is the right shape here — a native modal would block the whole
  // process, and the guidance in this repository is to keep dialogs out of a
  // window an agent may also be driving.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent): void => {
      if (!closeWouldLoseWork({ dirty, saved }, leaving.current)) return
      e.preventDefault()
      e.returnValue = false
      setClosing(true)
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty, saved])

  // A load failure has no editor to keep; a write failure must never take one away.
  if (loadError)
    return (
      <div className="booting">
        <EmptyState read>{loadError}</EmptyState>
      </div>
    )
  if (!file) return <div className="booting" />

  return (
    <div className="editor-window">
      {closing && (
        <Banner
          tone="warn"
          actions={
            <>
              <Button tone="ghost" onClick={() => setClosing(false)}>
                {t('editor.keepEditing')}
              </Button>
              <Button
                tone="danger"
                onClick={() => {
                  leaving.current = true
                  window.close()
                }}
              >
                {t('editor.discardAndClose')}
              </Button>
            </>
          }
        >
          {t('editor.closeUnsaved')}
        </Banner>
      )}
      <header className="editor-head">
        <strong>{file.name}</strong>
        <span className="muted mono">{file.path}</span>
        <Toolbar align="end">
          {dirty && !conflict && <StateChip tone="warn">{t('editor.unsaved')}</StateChip>}
          {saved && <StateChip tone="good">{t('editor.saved')}</StateChip>}
          <Button onClick={() => void save(false)} disabled={!!conflict || !dirty}>
            {t('editor.save')}
          </Button>
          {/* M109 — the answer is READ. `shell.openPath` resolves to an error
              string and the contract used to declare `Promise<void>`, so a file
              that would not open looked exactly like one that did: the button
              was pressed, nothing happened, and nothing said why. */}
          <Button
            tone="ghost"
            onClick={() =>
              void window.fabric.files
                .openExternally(filePath)
                .then((r) => {
                  if (!r.ok) setWriteError(t('editor.openFailed', { reason: r.reason ?? '' }))
                })
                .catch((e) => setWriteError(String(e)))
            }
          >
            {t('editor.openExternally')}
          </Button>
        </Toolbar>
      </header>

      {writeError && (
        <Banner
          actions={
            <>
              <Button tone="ghost" onClick={() => setWriteError(null)}>
                {t('editor.dismiss')}
              </Button>
              <Button onClick={() => void save(false)}>{t('editor.retry')}</Button>
            </>
          }
        >
          {writeError}
        </Banner>
      )}

      {conflict && (
        <Banner
          actions={
            <>
              <Button
                tone="ghost"
                // The focus is load-bearing, not decoration: this banner appears
                // while the operator is typing, and "take what is on disk" is the
                // destructive half of the choice.
                ref={(el: HTMLButtonElement | null) => el?.focus()}
                onClick={() => {
                  setConflict(null)
                  setFile({ ...file, content: conflict.current, hash: conflict.currentHash })
                  setDirty(false)
                }}
              >
                {t('editor.takeDisk')}
              </Button>
              <Button onClick={() => void save(true)}>{t('editor.takeMine')}</Button>
            </>
          }
        >
          {t('editor.conflict')}
        </Banner>
      )}

      <div className="editor-host" ref={host} />
    </div>
  )
}

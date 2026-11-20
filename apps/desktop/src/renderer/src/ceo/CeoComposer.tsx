// #region ceo-composer — docs: docs/ux/scenarios.md#scn-182-talk-to-the-ceo-from-the-home-screen-or-its-popup
/**
 * Where the person writes to the CEO (ADR-0197 §2, SCN-182): on the home screen and at the foot of the CEO popup. Words,
 * and files pasted (⌘V / Ctrl+V), dropped or picked (each at most 25 MB, ten at most); Enter sends, Shift+Enter breaks
 * the line. On the home screen a send opens the popup first, so the person watches the CEO take it. The home card is
 * the top right block beside the greeting and the rhythm; its «Позвонить» opens the popup and starts the call there,
 * as a panel in the chat (the owner, 2026-11-19). `tools` is where another control joins the composer's row (the screen
 * recording of fabric-screen-notes, «Записать показ») without this file knowing it.
 */
import { useEffect, useRef, useState } from 'react'
import type { CeoAttachment } from '../../../shared/ceoAgent.ts'
import { useT } from '../i18n'
import { CallLauncher } from './CeoCall'

const MAX_BYTES = 25 * 1024 * 1024
const MAX_FILES = 10

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const url = String(r.result ?? '')
      resolve(url.slice(url.indexOf(',') + 1))
    }
    r.onerror = () => reject(r.error ?? new Error('the file could not be read'))
    r.readAsDataURL(file)
  })
}

export function CeoComposer({
  where,
  draft,
  onDraftTaken,
  tools
}: {
  /** `home`: the card on the home screen, which opens the popup on send; `popup`: the popup's own foot. */
  where: 'home' | 'popup'
  /** Words to put in the composer once (Help's example handed to the popup). */
  draft?: string | null
  onDraftTaken?: () => void
  /** Extra controls in the composer's row, beside «Приложить файл». */
  tools?: React.ReactNode
}): React.JSX.Element {
  const t = useT()
  const [text, setText] = useState('')
  const [files, setFiles] = useState<Array<CeoAttachment & { size: number }>>([])
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  /** `queued`: the console was busy and the message waits for it (2026-11-20: never said as lost). */
  const [sent, setSent] = useState<false | 'sent' | 'queued' | 'queuedStopped'>(false)
  const box = useRef<HTMLTextAreaElement>(null)
  const picker = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!draft) return
    setText(draft)
    onDraftTaken?.()
    box.current?.focus()
  }, [draft, onDraftTaken])

  const attach = async (list: FileList | File[] | null): Promise<void> => {
    if (!list) return
    const incoming = Array.from(list)
    const kept: Array<CeoAttachment & { size: number }> = []
    for (const f of incoming) {
      if (f.size > MAX_BYTES) { setProblem(t('ceoAgent.composer.tooBig', { name: f.name })); continue }
      try { kept.push({ name: f.name || 'file', data: await readAsBase64(f), size: f.size }) } catch (e) {
        setProblem(e instanceof Error ? e.message : String(e))
      }
    }
    setFiles((prev) => [...prev, ...kept].slice(0, MAX_FILES))
  }

  const send = async (): Promise<void> => {
    if (busy || (!text.trim() && files.length === 0)) return
    setBusy(true)
    setProblem(null)
    setSent(false)
    try {
      // On the home screen the popup comes first: the person sees the CEO take the message.
      if (where === 'home') await window.fabric.ceoAgent.open(null)
      const r = await window.fabric.ceoAgent.send(text, files.map(({ name, data }) => ({ name, data })))
      if (r.ok) {
        setText('')
        setFiles([])
        // 0.3.27 review, run four (UX-41, ER-39): a CEO that is not running is never called busy; its message waits for it.
        setSent(r.queued ? (r.reason === 'not-running' ? 'queuedStopped' : 'queued') : 'sent')
      } else if (r.reason === 'queue-full') setProblem(t('ceoAgent.composer.queueFull'))
      else if (r.reason === 'delivery-unknown') setProblem(t('ceoAgent.composer.unknown'))
      else setProblem(`${t('ceoAgent.composer.failed')} ${r.reason ?? ''}`.trim())
    } catch (e) {
      setProblem(`${t('ceoAgent.composer.failed')} ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={`ceo-composer ceo-composer-${where}`}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault() }}
      onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); void attach(e.dataTransfer.files) } }}
    >
      {where === 'home' && (
        <div className="ceo-composer-head">
          <h2 className="ceo-composer-title" title={t('ceoAgent.composer.hint')}>{t('ceoAgent.composer.title')}</h2>
          <CallLauncher onError={setProblem} />
        </div>
      )}
      <form className="ceo-composer-form" aria-label={t('ceoAgent.composer.title')} onSubmit={(e) => { e.preventDefault(); void send() }}>
        <textarea
          ref={box}
          className="ceo-composer-text"
          rows={2}
          value={text}
          placeholder={t(where === 'home' ? 'ceoAgent.composer.placeholderHome' : 'ceoAgent.composer.placeholder')}
          aria-label={t('ceoAgent.composer.placeholder')}
          onChange={(e) => { setText(e.target.value); setSent(false) }}
          onPaste={(e) => { if (e.clipboardData.files.length) { e.preventDefault(); void attach(e.clipboardData.files) } }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send() }
          }}
        />
        {files.length > 0 && (
          <ul className="ceo-composer-files">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`}>
                <span className="mono">{f.name}</span>
                <button type="button" className="btn btn-quiet" aria-label={t('ceoAgent.composer.remove', { name: f.name })}
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}>×</button>
              </li>
            ))}
          </ul>
        )}
        <div className="ceo-composer-actions">
          <input ref={picker} type="file" multiple hidden aria-label={t('ceoAgent.composer.attach')} onChange={(e) => { void attach(e.target.files); e.target.value = '' }} />
          <button type="button" className="btn btn-ghost" onClick={() => picker.current?.click()}>{t('ceoAgent.composer.attach')}</button>
          {tools}
          {sent && <span className="muted" role="status">{t(sent === 'queued' ? 'ceoAgent.composer.queued' : sent === 'queuedStopped' ? 'ceoAgent.composer.queuedStopped' : 'ceoAgent.composer.sent')}</span>}
          <button type="submit" className="btn ceo-composer-send" disabled={busy || (!text.trim() && files.length === 0)}>
            {t(busy ? 'ceoAgent.composer.sending' : 'ceoAgent.composer.send')}
          </button>
        </div>
        {problem !== null && <p className="field-problem" role="alert">{problem}</p>}
      </form>
    </div>
  )
}
// #endregion ceo-composer

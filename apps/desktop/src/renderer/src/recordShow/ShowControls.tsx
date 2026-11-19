// #region record-show-ui — docs: docs/ux/scenarios.md#scn-188-show-the-ceo-what-you-mean
/**
 * «Записать показ» and «Снимок» (SCN-188): beside «Позвонить» in the CEO window and on the home card, and on a task.
 * A recording's chunks and every screenshot reach the target as each is ready (`main/recordShow.ts`); during a voice
 * call the call is told so in a short line with the owner's own words (`shared/recordShow.ts#callText`), so the CEO
 * on the call can say what it received. ⌃⌥⌘R and ⌃⌥⌘S do the same over any app.
 */
import { useEffect, useRef, useState } from 'react'
import { useLocale, useT } from '../i18n'
import { IDLE_STATE, callText, type RecordShowAnswer, type RecordShowEvent, type RecordShowState, type RecordShowTarget } from '../../../shared/recordShow.ts'

/** A recorder call from the window. */
type Run = () => Promise<RecordShowAnswer>

/** What a live call takes from outside: words said into it. */
export interface CallMouth { say(text: string): void }

const clock = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function ShowControls({ to, call, live = false }: {
  to: RecordShowTarget
  /** The voice call, when these controls sit beside one. */
  call?: { current: CallMouth | null }
  /** The call is connected: a delivered piece is said into it. */
  live?: boolean
}): React.JSX.Element | null {
  const t = useT()
  const locale = useLocale()
  const [state, setState] = useState<RecordShowState>(IDLE_STATE)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const liveRef = useRef(live)
  liveRef.current = live

  // A window or a test without the recorder's door draws nothing (the door is MAIN_AND_CEO, `ipcWindowPolicy.ts`).
  const api = (window.fabric as Partial<typeof window.fabric> | undefined)?.recordShow

  useEffect(() => {
    if (!api) return
    let gone = false
    api.state().then((s) => { if (!gone) setState(s) }, () => { /* no recorder in this build: stays hidden */ })
    const off = api.onChanged((e: RecordShowEvent) => {
      setState(e.state)
      const d = e.delivered
      if (!d || d.to !== to) return
      setNote(d.kind === 'shot'
        ? t(to === 'ceo' ? 'recordShow.shotSent.ceo' : 'recordShow.shotSent.task')
        : t(to === 'ceo' ? 'recordShow.sent.ceo' : 'recordShow.sent.task', { n: (d.index ?? 0) + 1 }))
      if (to === 'ceo' && liveRef.current) call?.current?.say(callText(d, locale))
    })
    return () => { gone = true; off() }
  }, [api, to, t, locale, call])

  useEffect(() => {
    if (!state.recording) return
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [state.recording])

  if (!api || !state.available) return null
  const mine = state.recording && state.deliver === to
  const elsewhere = state.recording && state.deliver !== to

  const act = async (run: Run): Promise<void> => {
    setBusy(true)
    setProblem(null)
    try {
      const a = await run()
      setState(a.state)
      if (!a.ok && a.reason !== 'cancelled')
        setProblem(t(`recordShow.why.${a.reason}` as 'recordShow.why.failed', { message: a.message.split('\n')[0] ?? '' }))
    } finally { setBusy(false) }
  }

  return (
    <span className="record-show" role="group" aria-label={t('recordShow.group')}>
      <button
        type="button"
        className={mine ? 'btn btn-danger' : 'btn btn-ghost'}
        disabled={busy || elsewhere}
        title={t('recordShow.keys')}
        onClick={() => void act(() => api.toggle(to))}
      >
        {mine ? t('recordShow.stop') : t('recordShow.record')}
      </button>
      <button type="button" className="btn btn-ghost" disabled={busy} title={t('recordShow.keys')} onClick={() => void act(() => api.shot('area', to))}>
        {t('recordShow.shot')}
      </button>
      {state.recording && (
        <span className="record-show-state" role="status">
          <span className="record-show-dot" aria-hidden="true" />
          <span>{elsewhere ? t('recordShow.recordingElsewhere') : t('recordShow.recording', { elapsed: clock(now - Date.parse(state.startedAt ?? new Date(now).toISOString())) })}</span>
        </span>
      )}
      {note && !problem && <span className="muted record-show-note" role="status">{note}</span>}
      {problem && <span className="field-problem record-show-note">{problem}</span>}
    </span>
  )
}
// #endregion record-show-ui

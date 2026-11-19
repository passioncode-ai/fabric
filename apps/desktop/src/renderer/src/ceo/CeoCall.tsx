// #region ceo-voice-call-ui — docs: docs/ux/scenarios.md#scn-184-call-the-ceo-and-talk
/**
 * «Позвонить» (SCN-184): the voice call's button, its state, how long it has run out of the five minutes a call may last
 * and its price, the last lines said, and words typed into it. The CEO popup shows the panel under its head
 * (`popover`); the home screen's CEO card shows it in place (`inline`, the operator's review of 2026-11-19: the call's
 * state, time and hang-up next to the chat).
 */
import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { MAX_CALL_MS, browserAudio, createCall, type Call, type CallLine, type CallPhase } from './voiceCall'
import { ShowControls } from '../recordShow/ShowControls'

/** m:ss of a length in ms, floored to the second. */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function VoiceCall({ variant = 'popover' }: { variant?: 'popover' | 'inline' }): React.JSX.Element {
  const t = useT()
  const [phase, setPhase] = useState<CallPhase>('idle')
  const [why, setWhy] = useState<string | null>(null)
  const [lines, setLines] = useState<CallLine[]>([])
  const [spent, setSpent] = useState({ minutes: 0, usd: 0 })
  const [said, setSaid] = useState('')
  const call = useRef<Call | null>(null)

  useEffect(() => () => call.current?.hangUp(), [])
  useEffect(() => {
    if (phase !== 'listening' && phase !== 'speaking') return
    const tick = setInterval(() => call.current && setSpent(call.current.spent()), 1000)
    return () => clearInterval(tick)
  }, [phase])

  const start = (): void => {
    setLines([])
    setWhy(null)
    setSpent({ minutes: 0, usd: 0 })
    call.current = createCall({
      session: () => window.fabric.ceoAgent.voice(),
      runTool: (name, args) => window.fabric.ceoAgent.voiceTool(name, args),
      socket: (url, protocols) => new WebSocket(url, protocols) as unknown as ReturnType<Parameters<typeof createCall>[0]['socket']>,
      audio: browserAudio(),
      onPhase: (p, problem) => { setPhase(p); if (problem) setWhy(problem) },
      onLine: (line) => setLines((prev) => [...prev, line].slice(-8))
    })
    void call.current.start()
  }
  const active = phase === 'connecting' || phase === 'listening' || phase === 'speaking'
  const shown = variant === 'inline' ? lines.slice(-3) : lines

  return (
    <span className={`ceo-call ceo-call-${variant}`}>
      {active
        ? <button type="button" className="btn btn-danger" onClick={() => call.current?.hangUp()}>{t('ceoAgent.hangUp')}</button>
        : <button type="button" className="btn btn-ghost" onClick={start}>{t('ceoAgent.call')}</button>}
      <ShowControls to="ceo" call={call} live={phase === 'listening' || phase === 'speaking'} />
      {phase !== 'idle' && (
        <div className="ceo-call-panel" role="status">
          <span className="ceo-call-state">
            <span className={`ceo-call-dot p-${phase}`} aria-hidden="true" />
            <span>{t(`ceoAgent.call.${phase}` as 'ceoAgent.call.listening')}</span>
            {active && phase !== 'connecting' && (
              <span className="muted ceo-call-time">
                {t('ceoAgent.call.time', { elapsed: clock(spent.minutes * 60_000), limit: clock(MAX_CALL_MS), usd: spent.usd.toFixed(2) })}
              </span>
            )}
          </span>
          {why && <span className="field-problem">{t(`ceoAgent.call.why.${why}` as 'ceoAgent.call.why.no-key')}</span>}
          {!active && (why === 'no-key' || why === 'refused') && <VoiceKeyForm onSaved={() => { setWhy(null); setPhase('idle') }} />}
          {shown.length > 0 && (
            <ul className="ceo-call-lines">
              {shown.map((l, i) => <li key={i} className={`who-${l.who}`}>{l.who === 'tool' ? t('ceoAgent.call.tool', { name: l.text }) : l.text}</li>)}
            </ul>
          )}
          {active && (
            <form onSubmit={(e) => { e.preventDefault(); call.current?.say(said); setSaid('') }}>
              <input className="ceo-call-say" value={said} placeholder={t('ceoAgent.call.say')} aria-label={t('ceoAgent.call.say')} onChange={(e) => setSaid(e.target.value)} />
            </form>
          )}
        </div>
      )}
    </span>
  )
}

/** The person's own xAI key (the operator, 2026-11-19): pasted once, kept by main, never shown back. */
function VoiceKeyForm({ onSaved }: { onSaved: () => void }): React.JSX.Element {
  const t = useT()
  const [value, setValue] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const save = async (): Promise<void> => {
    const r = await window.fabric.ceoAgent.setVoiceKey(value)
    setValue('')
    if (r.ok) onSaved()
    else setProblem(t(`ceoAgent.voiceKey.${r.reason}` as 'ceoAgent.voiceKey.malformed'))
  }
  return (
    <form className="ceo-voice-key" onSubmit={(e) => { e.preventDefault(); void save() }}>
      <label>
        <span>{t('ceoAgent.voiceKey.label')}</span>
        <input type="password" autoComplete="off" spellCheck={false} value={value} placeholder={t('ceoAgent.voiceKey.placeholder')} onChange={(e) => setValue(e.target.value)} />
      </label>
      <button type="submit" className="btn" disabled={!value.trim()}>{t('ceoAgent.voiceKey.save')}</button>
      <span className="muted">{t('ceoAgent.voiceKey.help')}</span>
      {problem && <span className="field-problem">{problem}</span>}
    </form>
  )
}
// #endregion ceo-voice-call-ui

// #region ceo-voice-call-ui — docs: docs/ux/scenarios.md#scn-184-call-the-ceo-and-talk
/**
 * The voice call with the CEO (SCN-184), as a panel inside the CEO's chat (the owner, 2026-11-19: «разговорный UI со
 * стримом вынести отдельной панелькой в чат»): the call's state, a live meter of who is speaking, how long it has run out
 * of the five minutes a call may last and its price, the lines said as they arrive, words typed into it, and the calls
 * already made, kept under the chat as their lines. The popup's head carries the call button; the home card's button
 * opens the popup and starts the call there, so a call is always seen beside the chat.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale, useT } from '../i18n'
import { MAX_CALL_MS, browserAudio, createCall, type Call, type CallEnd, type CallLine, type CallPhase, type CallProblem } from './voiceCall'

/** m:ss of a length in ms, floored to the second. */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** A call that ended: its lines stay in the chat (the owner, 2026-11-19: «история звонка остаётся в чате»). */
export interface CallRecord { id: string; at: number; ms: number; usd: number; lines: CallLine[]; end: CallProblem | CallEnd | null }

/** Calls kept on this computer (the CEO window's own storage), the newest first, at most this many. */
export const KEPT_CALLS = 10
const STORE = 'fabric.ceo.calls'
const MUTED = 'fabric.ceo.voiceMuted'
function readMuted(): boolean { try { return localStorage.getItem(MUTED) === '1' } catch { return false } }

const isLine = (l: unknown): l is CallLine => !!l && typeof l === 'object' && ['person', 'ceo', 'tool'].includes((l as CallLine).who) && typeof (l as CallLine).text === 'string'
const isRecord = (r: unknown): r is CallRecord => {
  const x = r as CallRecord
  return !!x && typeof x === 'object' && typeof x.id === 'string' && Number.isFinite(x.at) && Number.isFinite(x.ms) && Number.isFinite(x.usd) && Array.isArray(x.lines) && x.lines.every(isLine)
}

/** The kept calls; a record that does not read (DA-1, 0.3.25) is dropped, never a broken window. */
export function readKept(): CallRecord[] {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) ?? '[]') as unknown
    return Array.isArray(v) ? v.filter(isRecord).slice(0, KEPT_CALLS) : []
  } catch { return [] /* an unreadable store is an empty history, never a broken window */ }
}

export interface VoiceCallState {
  phase: CallPhase
  why: CallProblem | CallEnd | null
  lines: CallLine[]
  spent: { minutes: number; usd: number }
  active: boolean
  history: CallRecord[]
  start(): void
  hangUp(): void
  say(text: string): void
  levels(): { input: number; output: number }
  /** The key was saved after a refusal: the panel goes back to idle. */
  reset(): void
  /** The CEO answers in words only, its voice off; kept on this computer for the next calls. */
  muted: boolean
  setMuted(on: boolean): void
}

/** One call at a time for the window that holds it; its socket and microphone end with the window. */
export function useVoiceCall(make: typeof createCall = createCall): VoiceCallState {
  const [phase, setPhase] = useState<CallPhase>('idle')
  const [why, setWhy] = useState<CallProblem | CallEnd | null>(null)
  const [lines, setLines] = useState<CallLine[]>([])
  const [spent, setSpent] = useState({ minutes: 0, usd: 0 })
  const [history, setHistory] = useState<CallRecord[]>(readKept)
  const [muted, setMutedState] = useState<boolean>(readMuted)
  const mutedRef = useRef(muted)
  const call = useRef<Call | null>(null)
  const said = useRef<CallLine[]>([])
  const startedAt = useRef(0)

  useEffect(() => () => call.current?.hangUp(), [])
  const active = phase === 'connecting' || phase === 'listening' || phase === 'speaking'
  useEffect(() => {
    if (phase !== 'listening' && phase !== 'speaking') return
    const tick = setInterval(() => call.current && setSpent(call.current.spent()), 1000)
    return () => clearInterval(tick)
  }, [phase])

  const keep = useCallback((end: CallProblem | CallEnd | null) => {
    const c = call.current
    const s = c?.spent() ?? { minutes: 0, usd: 0 }
    if (!said.current.length && s.minutes === 0) return
    const record: CallRecord = { id: `${startedAt.current}`, at: startedAt.current, ms: Math.round(s.minutes * 60_000), usd: s.usd, lines: said.current.slice(), end }
    setHistory((prev) => {
      const next = [record, ...prev.filter((r) => r.id !== record.id)].slice(0, KEPT_CALLS)
      try { localStorage.setItem(STORE, JSON.stringify(next)) } catch { /* the history is shown even when it cannot be kept */ }
      return next
    })
  }, [])

  const start = useCallback(() => {
    if (call.current && ['connecting', 'listening', 'speaking'].includes(call.current.phase())) return
    said.current = []
    startedAt.current = Date.now()
    setLines([])
    setWhy(null)
    setSpent({ minutes: 0, usd: 0 })
    call.current = make({
      session: () => window.fabric.ceoAgent.voice(),
      runTool: (name, args) => window.fabric.ceoAgent.voiceTool(name, args),
      socket: (url, protocols) => new WebSocket(url, protocols) as unknown as ReturnType<Parameters<typeof createCall>[0]['socket']>,
      audio: browserAudio(mutedRef.current),
      onPhase: (p, problem) => {
        setPhase(p)
        if (problem) setWhy(problem)
        if (p === 'ended' || p === 'failed') { if (call.current) setSpent(call.current.spent()); keep(problem ?? null) }
      },
      onLine: (line) => { said.current = [...said.current, line].slice(-200); setLines(said.current) }
    })
    void call.current.start()
  }, [keep, make])

  return {
    phase, why, lines, spent, active, history, start,
    hangUp: () => call.current?.hangUp(),
    say: (text) => call.current?.say(text),
    levels: () => call.current?.levels() ?? { input: 0, output: 0 },
    reset: () => { setWhy(null); setPhase('idle') },
    muted,
    setMuted: (on) => {
      mutedRef.current = on
      setMutedState(on)
      try { localStorage.setItem(MUTED, on ? '1' : '0') } catch { /* kept for this call only */ }
      call.current?.mute(on)
    }
  }
}

function reducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const BARS = [0.55, 0.8, 1, 0.8, 0.55]

/**
 * Who is speaking, live: five bars scaled per frame from the audio's level, written to the DOM and never through React
 * state (MOTION_DOCTRINE §5). Why it moves: state indication, the person sees the call hears them. Under reduced motion
 * the bars rest at their shape and only the phase's colour says the state.
 */
export function VoiceMeter({ phase, levels }: { phase: CallPhase; levels: () => { input: number; output: number } }): React.JSX.Element {
  const bars = useRef<Array<HTMLSpanElement | null>>([])
  useEffect(() => {
    if ((phase !== 'listening' && phase !== 'speaking') || reducedMotion()) {
      for (const b of bars.current) if (b) b.style.transform = ''
      return
    }
    let frame = 0
    let shown = 0
    const draw = (): void => {
      const l = levels()
      const target = phase === 'speaking' ? l.output : l.input
      // Rise at once, fall over a few frames: a meter that drops instantly flickers between words.
      shown = target > shown ? target : shown * 0.86
      bars.current.forEach((b, i) => { if (b) b.style.transform = `scaleY(${(0.18 + shown * 0.82 * BARS[i]!).toFixed(3)})` })
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [phase, levels])
  return (
    <span className={`ceo-meter p-${phase}`} aria-hidden="true">
      {BARS.map((_, i) => <span key={i} ref={(el) => { bars.current[i] = el }} className="ceo-meter-bar" />)}
    </span>
  )
}

function MicIcon(): React.JSX.Element {
  return (
    <svg className="ceo-icon" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="5.5" y="1.5" width="5" height="8.5" rx="2.5" />
      <path d="M3 7.5a5 5 0 0 0 10 0M8 12.5V15" fill="none" />
    </svg>
  )
}

/** The call's button in the popup's head: «Позвонить», or «Положить трубку» while a call runs. */
export function CallButton({ call }: { call: VoiceCallState }): React.JSX.Element {
  const t = useT()
  return call.active
    ? <button type="button" className="btn btn-danger ceo-call-button" onClick={call.hangUp}><MicIcon />{t('ceoAgent.hangUp')}</button>
    : <button type="button" className="btn ceo-call-button" onClick={call.start}><MicIcon />{t('ceoAgent.call')}</button>
}

/** The call inside the chat: live while it runs, then its lines kept as a past call. */
export function CallPanel({ call }: { call: VoiceCallState }): React.JSX.Element | null {
  const t = useT()
  const locale = useLocale()
  const [said, setSaid] = useState('')
  const list = useRef<HTMLOListElement>(null)
  useEffect(() => { const el = list.current; if (el) el.scrollTop = el.scrollHeight }, [call.lines])
  const live = call.phase !== 'idle'
  if (!live && call.history.length === 0) return null
  const showLive = call.active || call.why !== null
  const keyAsked = !call.active && (call.why === 'no-key' || call.why === 'refused')
  return (
    <section className="ceo-call-panel" aria-label={t('ceoAgent.call.panel')}>
      {showLive && (
        <div className={`ceo-call-live p-${call.phase}`}>
          <div className="ceo-call-head">
            <VoiceMeter phase={call.phase} levels={call.levels} />
            <span className="ceo-call-state" role="status">{t(`ceoAgent.call.${call.phase === 'idle' ? 'ended' : call.phase}` as 'ceoAgent.call.listening')}</span>
            {call.active && call.phase !== 'connecting' && (
              <span className="ceo-call-meta">
                <span className="ceo-call-time">{t('ceoAgent.call.elapsed', { elapsed: clock(call.spent.minutes * 60_000), limit: clock(MAX_CALL_MS) })}</span>
                <span className="ceo-call-price">{t('ceoAgent.call.price', { usd: call.spent.usd.toFixed(2) })}</span>
              </span>
            )}
            {call.active && <button type="button" className="btn btn-quiet ceo-call-hangup" onClick={call.hangUp}>{t('ceoAgent.hangUp')}</button>}
          </div>
          <label className="ceo-call-mute">
            <input type="checkbox" checked={!call.muted} onChange={(e) => call.setMuted(!e.target.checked)} />
            <span>{t('ceoAgent.call.speakAloud')}</span>
            <small className="muted">{t('ceoAgent.call.speakAloudHint')}</small>
          </label>
          {call.why && <p className={call.phase === 'failed' ? 'field-problem' : 'muted'}>{t(`ceoAgent.call.why.${call.why}` as 'ceoAgent.call.why.no-key')}</p>}
          {keyAsked && <VoiceKeyForm onSaved={call.reset} />}
          {(call.active || call.lines.length > 0) && (
            <ol ref={list} className="ceo-call-lines" aria-live="polite">
              {call.lines.length === 0 && call.active && <li className="ceo-call-hint muted">{t(call.phase === 'connecting' ? 'ceoAgent.call.hintConnecting' : 'ceoAgent.call.hintSpeak')}</li>}
              {call.lines.map((l, i) => <CallLineItem key={i} line={l} />)}
            </ol>
          )}
          {call.active && (
            <form className="ceo-call-say-form" onSubmit={(e) => { e.preventDefault(); call.say(said); setSaid('') }}>
              <input className="ceo-call-say" value={said} placeholder={t('ceoAgent.call.say')} aria-label={t('ceoAgent.call.say')} onChange={(e) => setSaid(e.target.value)} />
            </form>
          )}
        </div>
      )}
      {call.history.length > 0 && (
        <div className="ceo-call-history">
          {call.history.map((r) => (
            <details key={r.id} className="ceo-call-record">
              <summary>
                <span>{t('ceoAgent.call.record', { time: new Date(r.at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })}</span>
                <span className="ceo-call-meta">{clock(r.ms)} · ${r.usd.toFixed(2)}</span>
              </summary>
              {r.lines.length > 0
                ? <ol className="ceo-call-lines">{r.lines.map((l, i) => <CallLineItem key={i} line={l} />)}</ol>
                : <p className="muted">{t('ceoAgent.call.recordEmpty')}</p>}
            </details>
          ))}
        </div>
      )}
    </section>
  )
}

function CallLineItem({ line }: { line: CallLine }): React.JSX.Element {
  const t = useT()
  if (line.who === 'tool') return <li className="who-tool">{t('ceoAgent.call.tool', { name: line.text })}</li>
  return (
    <li className={`who-${line.who}`}>
      <span className="ceo-call-who">{t(line.who === 'ceo' ? 'ceoAgent.call.whoCeo' : 'ceoAgent.call.whoYou')}</span>
      <span>{line.text}</span>
    </li>
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

/** The home card's call button: the call runs in the CEO's popup, beside its chat. */
export function CallLauncher({ onError }: { onError?: (message: string) => void }): React.JSX.Element {
  const t = useT()
  return (
    <button type="button" className="btn btn-ghost ceo-call-button"
      onClick={() => window.fabric.ceoAgent.open(null, { call: true }).catch((e: unknown) => onError?.(e instanceof Error ? e.message : String(e)))}>
      <MicIcon />{t('ceoAgent.call')}
    </button>
  )
}
// #endregion ceo-voice-call-ui

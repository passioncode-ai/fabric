// #region ceo-popup — docs: docs/ux/scenarios.md#scn-110-talk-to-the-floating-ceo-over-any-screen
/**
 * The CEO's popup window (ADR-0197 §2, SCN-110, SCN-182, SCN-184): its head says which runner the CEO runs on and why
 * any was passed over, its body is the CEO's console itself (ADR-0123: the CEO is a session, not a second chat), its foot
 * is the composer, and «Позвонить» puts the person on a voice call with the CEO's session tools (SCN-184).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { claudeModelFlag, type CeoStatus } from '../../../shared/ceoAgent.ts'
import type { TerminalSession } from '../../../shared/types'
import { TerminalView } from '../TerminalView'
import { Banner } from '../components'
import { useT } from '../i18n'
import { runnerLabel } from '../runnerLabel'
import { CeoComposer } from './CeoComposer'
import { browserAudio, createCall, type Call, type CallLine, type CallPhase } from './voiceCall'

const WHY_KEYS = new Set(['not-installed', 'not-connected', 'not-responding', 'spawn-failed', 'refused', 'not-catalogued', 'no-held-session', 'limit', 'ended-at-start'])

/** The model the head names: Claude Code's alias, or the first of the list a Hermes session tries first. */
function modelOf(status: CeoStatus): string {
  return status.runner === 'claude-code' ? claudeModelFlag(status.models) : (status.models[0] ?? '').replace(/^[^/]+\//, '')
}

export function CeoPopup(): React.JSX.Element {
  const t = useT()
  const [status, setStatus] = useState<CeoStatus | null>(null)
  const [session, setSession] = useState<TerminalSession | null>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const [restarting, setRestarting] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const takeDraft = useCallback(() => {
    window.fabric.ceoAgent.takeDraft().then((d) => { if (d) setDraft(d) }).catch((e: unknown) => setProblem(e instanceof Error ? e.message : String(e)))
  }, [])

  useEffect(() => {
    let live = true
    window.fabric.ceoAgent.ensure().then((s) => { if (live) setStatus(s) }).catch((e: unknown) => setProblem(e instanceof Error ? e.message : String(e)))
    takeDraft()
    const offChanged = window.fabric.ceoAgent.onChanged((s) => setStatus(s))
    const offDraft = window.fabric.ceoAgent.onDraft(takeDraft)
    return () => { live = false; offChanged(); offDraft() }
  }, [takeDraft])

  // The console itself, read again when its id changes and every 5 s, as a session window reads its own.
  const sessionId = status?.sessionId ?? null
  useEffect(() => {
    if (!sessionId) { setSession(null); return }
    let live = true
    const read = (): void => {
      window.fabric.terminal.get(sessionId).then((s) => { if (live) setSession(s) }).catch((e: unknown) => { if (live) setProblem(e instanceof Error ? e.message : String(e)) })
    }
    read()
    const off = window.fabric.terminal.onExit((id) => { if (id === sessionId) read() })
    const poll = setInterval(read, 5000)
    return () => { live = false; off(); clearInterval(poll) }
  }, [sessionId])

  const restart = async (): Promise<void> => {
    setRestarting(true)
    setProblem(null)
    try { setStatus(await window.fabric.ceoAgent.restart()) } catch (e) { setProblem(e instanceof Error ? e.message : String(e)) } finally { setRestarting(false) }
  }

  const why = (w: string): string => (WHY_KEYS.has(w) ? t(`ceoAgent.why.${w}` as 'ceoAgent.why.limit') : w)
  const state = status?.state ?? 'starting'

  return (
    <div className="ceo-popup">
      <header className="ceo-popup-head">
        <strong className="ceo-popup-title">{t('ceoAgent.title')}</strong>
        <span className={`ceo-popup-state s-${state}`}>{t(`ceoAgent.state.${state}` as 'ceoAgent.state.running')}</span>
        {status?.runner && <span className="ceo-popup-runner">{t('ceoAgent.runsOn', { runner: `${runnerLabel(status.runner, t)} · ${modelOf(status)}` })}</span>}
        <span className="ceo-popup-head-actions">
          <VoiceCall />
          <button type="button" className="btn btn-ghost" disabled={restarting} onClick={() => void restart()}>
            {t(restarting ? 'ceoAgent.restarting' : 'ceoAgent.restart')}
          </button>
        </span>
      </header>
      {status && (status.passedOver.length > 0 || status.setAside.length > 0) && (
        <ul className="ceo-popup-notes muted">
          {status.passedOver.map((p) => <li key={`p-${p.runner}`}>{t('ceoAgent.passedOver', { runner: runnerLabel(p.runner, t), why: why(p.result) })}</li>)}
          {status.setAside.map((p) => <li key={`a-${p.runner}`}>{t('ceoAgent.setAside', { runner: runnerLabel(p.runner, t), time: new Date(p.until).toLocaleTimeString(), why: why(p.why) })}</li>)}
        </ul>
      )}
      {problem !== null && <Banner tone="warn">{problem}</Banner>}
      <div className="ceo-popup-console">
        {session ? <TerminalView key={session.sessionId} session={session} focusOnMount={false} />
          : state === 'failed' ? (
            <Banner actions={<button type="button" className="btn" onClick={() => void restart()}>{t('ceoAgent.retry')}</button>}>
              {t('ceoAgent.failed')} {status?.problem ?? ''}
            </Banner>
          ) : <p className="muted ceo-popup-wait">{t('ceoAgent.starting')}</p>}
      </div>
      <CeoComposer where="popup" draft={draft} onDraftTaken={() => setDraft(null)} />
    </div>
  )
}

/** «Позвонить»: the voice call, its state, its length and price, the last lines said, and words typed into it. */
function VoiceCall(): React.JSX.Element {
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

  return (
    <span className="ceo-call">
      {active
        ? <button type="button" className="btn btn-danger" onClick={() => call.current?.hangUp()}>{t('ceoAgent.hangUp')}</button>
        : <button type="button" className="btn" onClick={start}>{t('ceoAgent.call')}</button>}
      {phase !== 'idle' && (
        <div className="ceo-call-panel" role="status">
          <span>{t(`ceoAgent.call.${phase}` as 'ceoAgent.call.listening')}</span>
          {active && phase !== 'connecting' && <span className="muted">{t('ceoAgent.call.spent', { minutes: spent.minutes.toFixed(1), usd: spent.usd.toFixed(2) })}</span>}
          {why && <span className="field-problem">{t(`ceoAgent.call.why.${why}` as 'ceoAgent.call.why.no-key')}</span>}
          {!active && (why === 'no-key' || why === 'refused') && <VoiceKeyForm onSaved={() => { setWhy(null); setPhase('idle') }} />}
          <ul className="ceo-call-lines">
            {lines.map((l, i) => <li key={i} className={`who-${l.who}`}>{l.who === 'tool' ? t('ceoAgent.call.tool', { name: l.text }) : l.text}</li>)}
          </ul>
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
        <input type="password" autoComplete="off" spellCheck={false} value={value} placeholder="xai-…" onChange={(e) => setValue(e.target.value)} />
      </label>
      <button type="submit" className="btn" disabled={!value.trim()}>{t('ceoAgent.voiceKey.save')}</button>
      <span className="muted">{t('ceoAgent.voiceKey.help')}</span>
      {problem && <span className="field-problem">{problem}</span>}
    </form>
  )
}
// #endregion ceo-popup

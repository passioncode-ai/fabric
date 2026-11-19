// #region ceo-popup — docs: docs/ux/scenarios.md#scn-110-talk-to-the-floating-ceo-over-any-screen
/**
 * The CEO's popup window (ADR-0197 §2, SCN-110, SCN-182, SCN-184): its head says which runner the CEO runs on and why
 * any was passed over, its body is the CEO's console itself (ADR-0123: the CEO is a session, not a second chat), its foot
 * is the composer, and «Позвонить» puts the person on a voice call with the CEO's session tools (SCN-184).
 */
import { useCallback, useEffect, useState } from 'react'
import { claudeModelFlag, type CeoStatus } from '../../../shared/ceoAgent.ts'
import type { TerminalSession } from '../../../shared/types'
import { TerminalView } from '../TerminalView'
import { Banner } from '../components'
import { useT } from '../i18n'
import { runnerLabel } from '../runnerLabel'
import { CeoComposer } from './CeoComposer'
import { VoiceCall } from './CeoCall'

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

// #endregion ceo-popup

// #region ceo-popup — docs: docs/ux/scenarios.md#scn-110-talk-to-the-floating-ceo-over-any-screen
/**
 * The CEO's popup window (ADR-0197 §2, SCN-110, SCN-182, SCN-184): its head is the CEO itself (the character's face with
 * its state, which runner it runs on and why any was passed over) and its controls (call, stop or start, restart); its
 * body is the chat: the CEO's console (ADR-0123: the CEO is a session, not a second chat) with the voice call as a panel
 * under it (the owner, 2026-11-19); its foot is the composer.
 */
import { useCallback, useEffect, useState } from 'react'
import { claudeModelFlag, type CeoStatus } from '../../../shared/ceoAgent.ts'
import type { TerminalSession } from '../../../shared/types'
import { TerminalView } from '../TerminalView'
import { Banner } from '../components'
import { useLocale, useT } from '../i18n'
import { runnerLabel } from '../runnerLabel'
import { CeoComposer } from './CeoComposer'
import { CallButton, CallPanel, useVoiceCall } from './CeoCall'
import { FabricAvatar } from '../launch/FabricAvatar'
import { useFabricName } from '../launch/persona'

const WHY_KEYS = new Set(['not-installed', 'not-connected', 'not-responding', 'spawn-failed', 'refused', 'not-catalogued', 'no-held-session', 'limit', 'ended-at-start'])

/** The head's quiet signs: a square for stop, an open circle with its arrow for restart (16 px, the stroke of the text). */
function StopIcon(): React.JSX.Element {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="4" width="8" height="8" rx="1.5" fill="currentColor" /></svg>
}
function RestartIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 8a5 5 0 1 1-1.6-3.7" /><path d="M13 2.5v3h-3" />
    </svg>
  )
}

/** The model the head names: Claude Code's alias, or the first of the list a Hermes session tries first. */
function modelOf(status: CeoStatus): string {
  return status.runner === 'claude-code' ? claudeModelFlag(status.models) : (status.models[0] ?? '').replace(/^[^/]+\//, '')
}

/** `composerTools`: controls another feature adds to the composer's row (the screen recording of fabric-screen-notes);
 *  its render site is `ceo.tsx`. */
export function CeoPopup({ composerTools }: { composerTools?: React.ReactNode } = {}): React.JSX.Element {
  const t = useT()
  const locale = useLocale()
  const name = useFabricName(t('ceoAgent.title'))
  const call = useVoiceCall()
  const [status, setStatus] = useState<CeoStatus | null>(null)
  const [session, setSession] = useState<TerminalSession | null>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const [busy, setBusy] = useState<'stop' | 'restart' | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const startCall = call.start

  // A draft and a call the home screen asked for: the call starts here, beside the chat (SCN-184).
  const takeAsks = useCallback(() => {
    window.fabric.ceoAgent.takeDraft().then((d) => { if (d) setDraft(d) }).catch((e: unknown) => setProblem(e instanceof Error ? e.message : String(e)))
    window.fabric.ceoAgent.takeCall?.().then((wanted) => { if (wanted) startCall() }).catch(() => { /* no call asked: nothing to start */ })
  }, [startCall])

  useEffect(() => {
    let live = true
    window.fabric.ceoAgent.ensure().then((s) => { if (live) setStatus(s) }).catch((e: unknown) => setProblem(e instanceof Error ? e.message : String(e)))
    takeAsks()
    const offChanged = window.fabric.ceoAgent.onChanged((s) => setStatus(s))
    const offDraft = window.fabric.ceoAgent.onDraft(takeAsks)
    return () => { live = false; offChanged(); offDraft() }
  }, [takeAsks])

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
    setBusy('restart')
    setProblem(null)
    try { setStatus(await window.fabric.ceoAgent.restart()) } catch (e) { setProblem(e instanceof Error ? e.message : String(e)) } finally { setBusy(null) }
  }
  const stop = async (): Promise<void> => {
    setBusy('stop')
    setProblem(null)
    try {
      const r = await window.fabric.ceoAgent.stop()
      setStatus(r.status)
      if (!r.ok) setProblem(t('ceoAgent.stopFailed'))
    } catch (e) { setProblem(e instanceof Error ? e.message : String(e)) } finally { setBusy(null) }
  }

  const why = (w: string): string => (WHY_KEYS.has(w) ? t(`ceoAgent.why.${w}` as 'ceoAgent.why.limit') : w)
  const state = status?.state ?? 'starting'
  const stopped = state === 'stopped' || state === 'ended' || state === 'idle'

  return (
    <div className="ceo-popup" data-state={state}>
      <header className="ceo-popup-head">
        <span className={`ceo-presence s-${state}`}>
          <FabricAvatar size="tiny" label={t('launch.avatar.label')} />
        </span>
        <div className="ceo-popup-who">
          <span className="ceo-popup-name">
            <strong className="ceo-popup-title">{name}</strong>
            <span className={`ceo-popup-state s-${state}`}>{t(`ceoAgent.state.${state}` as 'ceoAgent.state.running')}</span>
          </span>
          {status?.runner && state !== 'stopped' && <span className="ceo-popup-sub ceo-popup-runner" title={t('ceoAgent.runsOn', { runner: `${runnerLabel(status.runner, t)} · ${modelOf(status)}` })}>{t('ceoAgent.runsOn', { runner: `${runnerLabel(status.runner, t)} · ${modelOf(status)}` })}</span>}
        </div>
        {/* One row, one height (the owner, 2026-11-20): the call in words, stop and restart as quiet signs named for a
            screen reader and on hover; a start, when there is one, in words. */}
        <div className="ceo-popup-head-actions">
          <CallButton call={call} />
          {stopped && state !== 'stopped'
            ? <button type="button" className="btn btn-ghost btn-sm" disabled={busy !== null} onClick={() => void restart()}>{t('ceoAgent.start')}</button>
            : (state === 'running' || state === 'starting') && (
              <button type="button" className="btn btn-quiet btn-icon" disabled={busy !== null} onClick={() => void stop()}
                aria-label={t(busy === 'stop' ? 'ceoAgent.stopping' : 'ceoAgent.stop')} title={t(busy === 'stop' ? 'ceoAgent.stopping' : 'ceoAgent.stop')}>
                <StopIcon />
              </button>
            )}
          {!stopped && (
            <button type="button" className="btn btn-quiet btn-icon" disabled={busy !== null} onClick={() => void restart()}
              aria-label={t(busy === 'restart' ? 'ceoAgent.restarting' : 'ceoAgent.restartShort')} title={t(busy === 'restart' ? 'ceoAgent.restarting' : 'ceoAgent.restartShort')}>
              <RestartIcon />
            </button>
          )}
        </div>
      </header>
      {status && (status.passedOver.length > 0 || status.setAside.length > 0) && (
        <ul className="ceo-popup-notes muted">
          {status.passedOver.map((p) => <li key={`p-${p.runner}`}>{t('ceoAgent.passedOver', { runner: runnerLabel(p.runner, t), why: why(p.result) })}</li>)}
          {status.setAside.map((p) => <li key={`a-${p.runner}`}>{t('ceoAgent.setAside', { runner: runnerLabel(p.runner, t), time: new Date(p.until).toLocaleTimeString(locale), why: why(p.why) })}</li>)}
        </ul>
      )}
      {problem !== null && <Banner tone="warn">{problem}</Banner>}
      <main className="ceo-popup-chat">
        <div className="ceo-popup-console">
          {state === 'stopped' ? (
            <div className="ceo-popup-stopped">
              <p role="status">{t('ceoAgent.stopped')}</p>
              <button type="button" className="btn" disabled={busy !== null} onClick={() => void restart()}>{t('ceoAgent.start')}</button>
            </div>
          ) : session ? <TerminalView key={session.sessionId} session={session} focusOnMount={false} />
          : state === 'failed' ? (
            <Banner actions={<button type="button" className="btn" onClick={() => void restart()}>{t('ceoAgent.retry')}</button>}>
              {t('ceoAgent.failed')} {status?.problem ? t(`ceoAgent.problem.${status.problem}` as 'ceoAgent.problem.start-failed') : ''}
            </Banner>
          ) : <p className="muted ceo-popup-wait">{t('ceoAgent.starting')}</p>}
        </div>
        <CallPanel call={call} />
      </main>
      <CeoComposer where="popup" draft={draft} onDraftTaken={() => setDraft(null)} tools={composerTools} />
    </div>
  )
}

// #endregion ceo-popup

// The agent workspace's own parts (SCR-39 · docs/reports/product.html `launchAgent`): what was
// handed to the agent, what the next one would be told, how the run stands, and the console.
// Each read says which of its states it is in; nothing here starts, stops or writes anything.

import { useEffect, useState } from 'react'
import type { PastContext } from '../../../shared/pastContext.ts'
import type { ReadEnvelope } from '../../../shared/readEnvelope'
import type { RunStatusView } from '../../../shared/runStatus.ts'
import type { PackPreview } from '../../../shared/types'
import { useLocale, useT } from '../i18n'

/** How a run stands, as words: the agent's claim and Fabric's observation are kept apart (ADR-0008). */
export function useRunStatus(sessionId: string | null): { view: ReadEnvelope<RunStatusView> | null; failed: string | null } {
  const [view, setView] = useState<ReadEnvelope<RunStatusView> | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  useEffect(() => {
    if (!sessionId) { setView(null); setFailed(null); return }
    let alive = true
    window.fabric.runs.status(sessionId).then(
      (v) => { if (alive) { setView(v); setFailed(null) } },
      (e: unknown) => alive && setFailed(e instanceof Error ? e.message : String(e))
    )
    return () => { alive = false }
  }, [sessionId])
  return { view, failed }
}

export function RunCallout({ sessionId, status }: { sessionId: string | null; status: ReturnType<typeof useRunStatus> }): React.JSX.Element {
  const t = useT(), locale = useLocale()
  if (!sessionId) return <div className="lp-callout"><b>{t('launch.agent.noRun')}</b><p>{t('launch.agent.noRunBody')}</p></div>
  if (status.failed) return <div className="lp-callout" role="alert"><b>{t('launch.agent.statusUnreadable')}</b><p>{status.failed}</p></div>
  const s = status.view?.data
  if (!s) return <div className="lp-callout"><b>{t('estate.reading')}</b></div>
  const at = s.observation.lastOutputAt ? new Date(s.observation.lastOutputAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : null
  return (
    <div className="lp-callout">
      <b>{t(`launch.agent.liveness.${s.observation.liveness}` as 'launch.agent.liveness.working')}</b>
      <p>
        {at ? t('launch.agent.observedAt', { time: at }) : t('launch.agent.notObserved')}{' '}
        {s.claim.phase ? t('launch.agent.claims', { phase: t(`launch.agent.phase.${s.claim.phase}` as 'launch.agent.phase.working') }) : ''}{' '}
        {t('launch.agent.timeIsNotWork')}
      </p>
    </div>
  )
}

/** «Контекст»: the pack this run was given, beside the one the next run would get. */
export function ContextTab({ projectId, sessionId }: { projectId: string; sessionId: string | null }): React.JSX.Element {
  const t = useT()
  const [which, setWhich] = useState<'past' | 'next'>(sessionId ? 'past' : 'next')
  const [past, setPast] = useState<PastContext | null>(null)
  const [next, setNext] = useState<PackPreview | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    setFailed(null)
    const read = which === 'past' && sessionId
      ? window.fabric.transcripts.context(sessionId).then((p) => alive && setPast(p))
      : window.fabric.memory.preview(projectId).then((p) => alive && setNext(p))
    read.catch((e: unknown) => alive && setFailed(e instanceof Error ? e.message : String(e)))
    return () => { alive = false }
  }, [which, sessionId, projectId])
  return (
    <div>
      <div className="lp-tabs" role="group" aria-label={t('launch.agent.context.which')}>
        {sessionId && (
          <button type="button" className="lp-tab" aria-pressed={which === 'past'} onClick={() => setWhich('past')}>{t('launch.agent.context.past')}</button>
        )}
        <button type="button" className="lp-tab" aria-pressed={which === 'next'} onClick={() => setWhich('next')}>{t('launch.agent.context.next')}</button>
      </div>
      {failed && <div className="lp-callout" role="alert"><p>{failed}</p></div>}
      {which === 'past' ? (
        past === null ? <p className="lp-meta">{t('estate.reading')}</p>
          : past.held ? (
            <>
              <h3>{t('launch.agent.context.pastTitle')}</h3>
              <p className="lp-meta">{t('launch.agent.context.pastMeta', { chars: past.chars, sha: past.sha256.slice(0, 12) })}</p>
              <details><summary>{t('launch.agent.context.show')}</summary><pre className="lp-pack">{past.bytes}</pre></details>
            </>
          ) : <div className="lp-callout"><b>{t('launch.agent.context.notHeld')}</b><p>{past.says}</p></div>
      ) : next === null ? <p className="lp-meta">{t('estate.reading')}</p> : (
        <>
          <h3>{t('launch.agent.context.nextTitle')}</h3>
          <p className="lp-meta">{t('launch.agent.context.nextMeta', { facts: next.includedFacts, transcripts: next.includedTranscripts, omitted: next.omittedFacts + next.omittedTranscripts, chars: next.chars, budget: next.budget })}</p>
          <details><summary>{t('launch.agent.context.show')}</summary><pre className="lp-pack">{next.markdown}</pre></details>
        </>
      )}
      <div className="lp-callout"><b>{t('launch.agent.context.evidence')}</b><p>{t('launch.agent.context.evidenceBody')}</p></div>
    </div>
  )
}

/** «Консоль · последний вывод»: what the session printed, read on demand. */
export function ConsoleDetails({ sessionId }: { sessionId: string | null }): React.JSX.Element | null {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [out, setOut] = useState<{ text: string } | null | undefined>(undefined)
  const [failed, setFailed] = useState<string | null>(null)
  useEffect(() => {
    if (!open || !sessionId) return
    let alive = true
    window.fabric.terminal.scrollback(sessionId).then(
      (r) => alive && setOut(r),
      (e: unknown) => alive && setFailed(e instanceof Error ? e.message : String(e))
    )
    return () => { alive = false }
  }, [open, sessionId])
  if (!sessionId) return null
  return (
    <details className="lp-console" onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>{t('launch.agent.console')}</summary>
      {failed ? <p className="lp-meta" role="alert">{failed}</p>
        : out === undefined ? <p className="lp-meta">{t('estate.reading')}</p>
        : out === null || !out.text ? <p className="lp-meta">{t('launch.agent.consoleEmpty')}</p>
        : <pre className="lp-pack">{out.text.slice(-8000)}</pre>}
    </details>
  )
}

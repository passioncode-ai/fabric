// #region machine-sessions-panel — docs: docs/ux/scenarios.md#scn-166-see-every-agent-and-open-its-console-in-one-press
/**
 * «Сессии вне Fabric» on Агенты (board request eef5abeb, point 3): the Claude Code sessions running on this computer
 * outside Fabric (a terminal, Switchboard, a `claude -p` run), read from Claude Code's own files, so the list does not
 * depend on Switchboard (point 4). Each one's last messages are read in place; «Продолжить в Fabric» stops it outside
 * and continues it in a Fabric console with its context; «Закрыть» stops it. Both ask once more before they act.
 */
import { useEffect, useState } from 'react'
import type { MachineSession } from '../../../main/machineSessions.ts'
import { useT } from '../i18n'
import { since } from '../duration'
import { folderName } from '../../../shared/railAgents'
import { FailureNote } from '../OperatorError'

export const MACHINE_POLL_MS = 15_000

type T = ReturnType<typeof useT>
/** One sentence for every refusal of a machine act, shared by this panel and the link's ask (iteration 2, UX-21): a
 *  code Fabric does not know is said as a failure in words, never shown raw (its code goes to the tooltip). */
export function machineWhy(t: T, why: string): string {
  return why === 'gone' ? t('machineSessions.why.gone')
    : why === 'changed' ? t('machineSessions.why.changed')
    : why === 'still-running' ? t('machineSessions.why.stillRunning')
    : why === 'no-project' ? t('machineSessions.why.noProject')
    : why === 'not-outside' ? t('machineSessions.why.notOutside')
    : why === 'unreadable' ? t('machineSessions.why.unreadable')
    : why === 'busy' ? t('machineSessions.why.busy')
    : why === 'unknown-owner' ? t('machineSessions.why.unknownOwner')
    : why === 'stopped-not-continued' ? t('machineSessions.why.stoppedNotContinued')
    : t('machineSessions.why.other')
}
/** A stopped session that did not reach a console is half done (UX-18): its sentence leads, without «Не сделано». */
export const halfDone = (why: string): boolean => why === 'stopped-not-continued'

type Ask = { id: string; act: 'continue' | 'close'; ended?: boolean } | null

export function MachineSessionsPanel({ onOpenConsole, folded = false }: { onOpenConsole(sessionId: string): void; folded?: boolean }): React.JSX.Element | null {
  const t = useT()
  const [rows, setRows] = useState<MachineSession[] | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [asking, setAsking] = useState<Ask>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [refused, setRefused] = useState<{ id: string; why: string; viaSwitchboard?: boolean } | null>(null)
  const [turns, setTurns] = useState<{ id: string; list: Array<{ role: string; text: string }> | null | 'failed' } | null>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let alive = true
    // ER-5: one reading at a time; a poll that finds one in flight leaves it be.
    let inFlight = false
    const ask = (): void => {
      if (inFlight) return
      inFlight = true
      Promise.resolve().then(() => window.fabric.agents.machineSessions()).then((r) => { if (alive) { setRows(r); setProblem(null) } },
        (e: unknown) => { if (alive) setProblem(e instanceof Error ? e.message : String(e)) }).finally(() => { inFlight = false })
    }
    ask()
    const timer = setInterval(ask, MACHINE_POLL_MS)
    return () => { alive = false; clearInterval(timer) }
  }, [tick])

  const run = async (id: string, act: 'continue' | 'close', viaSwitchboard = false): Promise<void> => {
    setAsking(null)
    setBusy(id)
    setRefused(null)
    try {
      const r = act === 'continue' ? await window.fabric.agents.machineContinue(id) : await window.fabric.agents.machineClose(id)
      if (!r.ok) setRefused({ id, why: r.why, viaSwitchboard })
      else if (act === 'continue' && r.sessionId) onOpenConsole(r.sessionId)
    } catch (e) { setRefused({ id, why: e instanceof Error ? e.message : String(e), viaSwitchboard }) } finally {
      setBusy(null)
      setTick((x) => x + 1)
    }
  }
  const read = (id: string): void => {
    if (turns?.id === id) { setTurns(null); return }
    setTurns({ id, list: null })
    window.fabric.agents.machineRead(id).then((r) => setTurns({ id, list: r ? r.turns : [] }), () => setTurns({ id, list: 'failed' }))
  }
  // UX-44, ER-29: a session Switchboard names whose history Fabric cannot read is said as such, as the link's ask says it.
  const refusal = (r: { why: string; viaSwitchboard?: boolean }): string =>
    r.why === 'gone' && r.viaSwitchboard ? t('links.continue.goneHome') : machineWhy(t, r.why)
  // UX-26: two sessions in one folder are told apart by when they started.
  const label = (s: MachineSession): string => {
    const folder = folderName(s.cwd) ?? s.cwd
    const twin = (rows ?? []).filter((x) => x.cwd === s.cwd).length > 1
    return twin && s.startedAt ? `${folder}, ${t('board.ago', { time: since(s.startedAt, t) })}` : folder
  }

  return (
    <section className="lp-panel" aria-labelledby="ag-machine-title">
      {/* UX-26: inside the fold its summary already says it; the heading stays for the section's name, unseen. */}
      <h3 id="ag-machine-title" className={folded ? 'visually-hidden' : undefined}>{t('machineSessions.title')}</h3>
      <p className="lp-meta">{t('machineSessions.lede')}</p>
      {problem && <p className="lp-meta" role="status" title={problem}>{t('machineSessions.failed')}</p>}
      {!rows && !problem && <p className="lp-meta" role="status">{t('machineSessions.reading')}</p>}
      {refused && halfDone(refused.why) && (
        <div className="as-launch-ask" role="status">
          <p className="lp-meta">{machineWhy(t, refused.why)}</p>
          <button type="button" className="lp-button primary" disabled={busy !== null} onClick={() => void run(refused.id, 'continue')}>{t('machineSessions.resumeFromHistory')}</button>
        </div>
      )}
      {rows && rows.length === 0 && <p className="lp-meta">{t('machineSessions.none')}</p>}
      {rows && rows.length > 0 && (
        // UX-7: the parts sum to the rail's count; a session with no state is counted as such.
        <p className="lp-meta" data-testid="machine-counts">{t('machineSessions.counts', {
          working: rows.filter((s) => s.state === 'working').length, waiting: rows.filter((s) => s.state === 'waiting').length,
          needs: rows.filter((s) => s.state === 'needs_you').length, live: rows.filter((s) => s.live).length })}{rows.some((s) => !s.state)
          ? t('machineSessions.countsUnknown', { unknown: rows.filter((s) => !s.state).length }) : ''}</p>
      )}
      {rows && rows.length > 0 && (
        <ul className="ag-machine">
          {rows.map((s) => (
            <li key={s.sessionId} data-testid="machine-session" data-state={s.state ?? 'unknown'}>
              <span className={`ag-machine-state is-${s.state ?? 'unknown'}`}>{t(`machineSessions.state.${s.state ?? 'unknown'}` as 'machineSessions.state.unknown')}</span>{' '}
              {/* UX-9: the folder once when the session has no name of its own. */}
              <b title={s.cwd}>{s.name ?? folderName(s.cwd) ?? s.cwd}</b>
              {s.name && <>{' · '}<span className="rail-folder" title={s.cwd}>{folderName(s.cwd)}</span></>}
              <br />
              <span className="lp-meta">
                {[s.source === 'switchboard' ? t('machineSessions.viaSwitchboard') : s.entrypoint === 'sdk-cli' || s.kind === 'print' ? t('machineSessions.headless') : t('machineSessions.terminal'),
                  s.startedAt ? t('board.ago', { time: since(s.startedAt, t) }) : null].filter(Boolean).join(' · ')}
              </span>
              <span className="ag-machine-acts">
                <button type="button" className="lp-link" aria-expanded={turns?.id === s.sessionId} aria-label={t('machineSessions.readAbout', { folder: label(s) })} onClick={() => read(s.sessionId)}>{t('machineSessions.read')}</button>
                {/* A session only Switchboard names has no process Fabric knows: it is read here, closed or taken over there. */}
                {/* UX-41: one no process runs (Switchboard's «ready to continue») is continued from its history, as a link can. */}
                {(s.source === 'claude' || !s.live) && <button type="button" className="lp-button" disabled={busy !== null} aria-label={t('machineSessions.continueAbout', { folder: label(s) })} onClick={() => setAsking({ id: s.sessionId, act: 'continue', ended: !s.live })}>{t('machineSessions.continue')}</button>}
                {s.source === 'claude' && <button type="button" className="lp-button" disabled={busy !== null} aria-label={t('machineSessions.closeAbout', { folder: label(s) })} onClick={() => setAsking({ id: s.sessionId, act: 'close' })}>{t('machineSessions.close')}</button>}
              </span>
              {asking?.id === s.sessionId && (
                <div className="as-launch-ask" role="group" aria-label={t(asking.act === 'continue' ? 'machineSessions.continue' : 'machineSessions.close')}>
                  {/* UX-43: a session no process runs is not stopped anywhere; it is continued from its history. */}
                  <p className="lp-meta">{t(asking.act === 'continue' ? (asking.ended ? 'machineSessions.continueEndedAsk' : 'machineSessions.continueAsk') : 'machineSessions.closeAsk')}</p>
                  <button type="button" className="lp-button primary" onClick={() => void run(s.sessionId, asking.act, s.source === 'switchboard')}>{t('machineSessions.yes')}</button>
                  <button type="button" className="lp-button" onClick={() => setAsking(null)}>{t('common.cancel')}</button>
                </div>
              )}
              {busy === s.sessionId && <p className="lp-meta" role="status">{t('machineSessions.busy')}</p>}
              {/* UX-28: a code with a sentence is not shown again under it; only a message Fabric has no sentence for is. */}
              {refused?.id === s.sessionId && !halfDone(refused.why) && <FailureNote said={`${t('machineSessions.refused')} ${refusal(refused)}`}
                detail={machineWhy(t, refused.why) === t('machineSessions.why.other') ? refused.why : null} />}
              {turns?.id === s.sessionId && (
                turns.list === null ? <p className="lp-meta" role="status">{t('machineSessions.reading')}</p>
                  : turns.list === 'failed' ? <p className="lp-meta">{t('machineSessions.readFailed')}</p>
                  : turns.list.length === 0 ? <p className="lp-meta">{t('machineSessions.noTranscript')}</p>
                  : <ol className="ag-machine-turns">{turns.list.map((x, i) => <li key={i} data-role={x.role}><b>{x.role === 'user' ? t('machineSessions.you') : t('machineSessions.agent')}</b> {x.text}</li>)}</ol>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
// #endregion machine-sessions-panel

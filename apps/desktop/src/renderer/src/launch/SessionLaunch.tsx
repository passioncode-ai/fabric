// #region session-launch-card — docs: docs/ux/scenarios.md#scn-166-see-every-agent-and-open-its-console-in-one-press
/**
 * On an agent's page: who started its console and from where, from the launch journal on disk (board request
 * eef5abeb, point 2), and «Закрыть сессию» for a console Fabric holds, asked once more before it acts. The close is the
 * person's own stop (`terminal.end`): it is written in История and in the journal as the person's.
 */
import { useEffect, useState } from 'react'
import type { Launch } from '../../../shared/sessionLaunches.ts'
import { useT } from '../i18n'
import { since } from '../duration'
import { FailureNote } from '../OperatorError'

type Read = { at: 'reading' } | { at: 'read'; launch: Launch | null } | { at: 'failed'; why: string }

export function SessionLaunch({ sessionId, canClose }: { sessionId: string; canClose: boolean }): React.JSX.Element {
  const t = useT()
  const [read, setRead] = useState<Read>({ at: 'reading' })
  const [asking, setAsking] = useState(false)
  const [closing, setClosing] = useState<'no' | 'busy' | 'done' | { failed: string }>('no')
  useEffect(() => {
    let live = true
    setRead({ at: 'reading' })
    window.fabric.terminal.launch(sessionId)
      .then((launch) => { if (live) setRead({ at: 'read', launch }) })
      .catch((e: unknown) => { if (live) setRead({ at: 'failed', why: e instanceof Error ? e.message : String(e) }) })
    return () => { live = false }
  }, [sessionId])

  const close = async (): Promise<void> => {
    setAsking(false)
    setClosing('busy')
    try { await window.fabric.terminal.end(sessionId); setClosing('done') } catch (e) {
      setClosing({ failed: e instanceof Error ? e.message : String(e) })
    }
  }

  const l = read.at === 'read' ? read.launch : null
  return (
    <div className="as-launch" data-testid="session-launch">
      {read.at === 'reading' && <p className="lp-meta" role="status">{t('sessionLaunch.reading')}</p>}
      {read.at === 'failed' && <p className="lp-meta" title={read.why}>{t('sessionLaunch.failed')}</p>}
      {read.at === 'read' && !l && <p className="lp-meta">{t('sessionLaunch.none')}</p>}
      {l && (
        <dl className="as-facts">
          <div><dt>{t('sessionLaunch.by')}</dt><dd>
            <span>{t('sessionLaunch.line', {
              by: t(`sessionLaunch.by.${l.by}` as 'sessionLaunch.by.person'),
              via: l.via ? t(`sessionLaunch.via.${l.via}` as 'sessionLaunch.via.screen') : t('sessionLaunch.via.unknown'),
              time: t('board.ago', { time: since(l.startedAt, t) })
            })}</span>
            {l.reason && <small className="lp-meta as-launch-reason">{t('sessionLaunch.reason', { reason: l.reason })}</small>}
          </dd></div>
          {l.parentSessionId && (
            <div><dt>{t('sessionLaunch.parent')}</dt><dd>
              <span>{l.by === 'ceo' ? t('sessionLaunch.parentCeo') : t('sessionLaunch.parentOther')}</span>
            </dd></div>
          )}
          {l.branch && <div><dt>{t('sessionLaunch.branch')}</dt><dd><span className="rail-branch-word" title={l.cwd}>{l.branch}</span></dd></div>}
          <div><dt>{t('sessionLaunch.folder')}</dt><dd><span className="rail-folder" title={l.cwd}>{l.cwd}</span></dd></div>
          {l.runnerSessionId && (
            <div><dt>{t('sessionLaunch.resume')}</dt><dd>
              <code className="as-launch-resume">{l.runner === 'claude-code' ? `claude --resume ${l.runnerSessionId}` : l.runnerSessionId}</code>
            </dd></div>
          )}
        </dl>
      )}
      {canClose && closing !== 'done' && !asking && (
        <button type="button" className="lp-button" disabled={closing === 'busy'} aria-busy={closing === 'busy'} onClick={() => setAsking(true)}>
          {closing === 'busy' ? t('sessionLaunch.closing') : t('sessionLaunch.close')}
        </button>
      )}
      {asking && (
        <div className="as-launch-ask" role="group" aria-label={t('sessionLaunch.close')}>
          <p className="lp-meta">{t('sessionLaunch.closeAsk')}</p>
          <button type="button" className="lp-button primary" onClick={() => void close()}>{t('sessionLaunch.closeYes')}</button>
          <button type="button" className="lp-button" onClick={() => setAsking(false)}>{t('common.cancel')}</button>
        </div>
      )}
      {closing === 'done' && <p className="lp-meta" role="status">{t('sessionLaunch.closed')}</p>}
      {typeof closing === 'object' && <FailureNote said={t('sessionLaunch.closeFailed')} detail={closing.failed} />}
    </div>
  )
}
// #endregion session-launch-card

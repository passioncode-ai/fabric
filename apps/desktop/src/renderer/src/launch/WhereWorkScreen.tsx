// #region where-work-is — docs: docs/ux/scenarios.md#scn-141-see-where-work-is-across-every-project--sessions-claims-review-and-sessions-with-no-project
/**
 * SCR-78 «Where work is» (SCN-141, REQ-38/REQ-17, canvas C8): per project with work in flight, its live sessions
 * (coding agent, how it came in), its claims («related» where flagged), its review queue and its last sign of life;
 * the idle projects counted in one line; and, always, the last row «Sessions with no project». It reads the journal's
 * projections and writes nothing. A column that could not be read says so on every row; the whole estate unread is
 * the reason with Try again — never "no work". The consent to log an unowned session under a project (ADR-0136 §2)
 * is REQ-17's, wave 5: the last row lists those sessions and offers nothing yet.
 */
import { useEffect, useState } from 'react'
import type { WhereWorkView, WorkSessionView } from '../../../shared/workClaims.ts'
import { Button, Panel, Row, StateChip, Toolbar } from '../components'
import { useT, type Translate } from '../i18n'
import { since } from '../duration'
import { runnerLabel } from '../runnerLabel'
import { cameInLabel, lifeLabel, taskLabel, whyLabel } from '../WhoIsWorking'
import { explainError } from '../start/startParts'

type Read = { state: 'reading' } | { state: 'read'; view: WhereWorkView } | { state: 'unreadable'; reason: string }

function sessionLine(s: WorkSessionView, t: Translate, now: number): string {
  const who = t('work.who.by', { agent: runnerLabel(s.agent, t), how: cameInLabel(s.cameIn, t) })
  if (s.stale) {
    const at = Date.parse(s.lastSignAt ?? s.startedAt)
    return `${who} · ${t('work.where.stale', { minutes: Math.max(1, Math.round((now - at) / 60_000)) })}`
  }
  return `${who} · ${t('work.who.since', { ago: since(s.startedAt, t) })}`
}

export function WhereWorkScreen({
  feedMark,
  onProject,
  onTask,
  onReview,
  onError
}: {
  feedMark: number
  /** A session that would not open is said, never swallowed. */
  onError(message: string): void
  onProject(projectId: string): void
  onTask(projectId: string, taskId: string): void
  onReview(projectId: string): void
}): React.JSX.Element {
  const t = useT()
  const [read, setRead] = useState<Read>({ state: 'reading' })
  const load = async (): Promise<void> => {
    try {
      setRead({ state: 'read', view: await window.fabric.work.estate() })
    } catch (e) {
      setRead({ state: 'unreadable', reason: explainError(e, t) })
    }
  }
  useEffect(() => {
    void load()
  }, [feedMark])
  // A sign of life ages while nothing is journalled: the reading is taken again each minute.
  useEffect(() => {
    const every = setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, 60_000)
    return () => clearInterval(every)
  }, [])
  const now = Date.now()

  return (
    <div className="lp" data-launch-view="where-work">
      <header className="lp-heading">
        <div>
          <p className="lp-kicker">{t('launch.nav.manage')}</p>
          <h2 tabIndex={-1}>{t('work.where.title')}</h2>
          <p>{t('work.where.lede')}</p>
        </div>
      </header>
      {read.state === 'reading' && <Panel><p className="muted">{t('work.where.reading')}</p></Panel>}
      {read.state === 'unreadable' && (
        <Panel>
          <Toolbar>
            <span className="muted">{t('work.where.unreadable', { reason: read.reason })}</span>
            <Button tone="ghost" onClick={() => void load()}>{t('common.retry')}</Button>
          </Toolbar>
        </Panel>
      )}
      {read.state === 'read' && (
        <>
          {read.view.rows.length === 0 && <Panel><p className="muted">{t('work.where.nothing')}</p></Panel>}
          {read.view.rows.map((r) => (
            <Panel
              key={r.projectId}
              title={<Button tone="ghost" onClick={() => onProject(r.projectId)}>{r.name}</Button>}
              actions={<span className="muted">{r.lastSignAt ? t('work.where.lastSign', { ago: since(r.lastSignAt, t) }) : t('work.where.noSign')}</span>}
            >
              <p className="lp-kicker">{t('work.where.sessions')}</p>
              {r.sessions.length === 0 ? <p className="muted">{t('work.where.noneCol')}</p> : r.sessions.map((s) => (
                <Row key={s.sessionId} onClick={() => void window.fabric.windows.openSession(s.sessionId).catch((e: unknown) => onError(explainError(e, t)))}
                  lead={<StateChip tone={s.stale ? 'warn' : 'good'} dot>{s.stale ? t('work.where.quiet') : t('work.where.active')}</StateChip>}>
                  {sessionLine(s, t, now)}
                </Row>
              ))}
              <p className="lp-kicker">{t('work.where.claims')}</p>
              {r.claims.length === 0 ? <p className="muted">{t('work.where.noneCol')}</p> : r.claims.map((c) => (
                <Row key={c.claimId} onClick={() => onTask(r.projectId, c.taskId)}
                  lead={c.related.length ? <StateChip tone="warn">{t('work.who.related')}</StateChip> : undefined}
                  trail={<span className="muted">{lifeLabel(c, t)}</span>}>
                  <strong>{taskLabel(c.title, t)}</strong>
                  {' · '}
                  {t('work.who.by', { agent: runnerLabel(c.agent, t), how: cameInLabel(c.cameIn, t) })}
                  {' · '}
                  {t('work.who.since', { ago: since(c.since, t) })}
                  {c.related.length > 0 && (
                    <span className="muted">{' · '}{c.related.map((x) => t('work.who.relatedTo', { task: taskLabel(x.title, t), why: x.why.map((w) => whyLabel(w, t)).join('; ') })).join(' · ')}</span>
                  )}
                </Row>
              ))}
              <Toolbar>
                <span className="lp-kicker">{t('work.where.review')}</span>
                {r.review === null ? (
                  <span className="muted">{t('work.where.reviewUnread')}</span>
                ) : (
                  <Button tone="ghost" onClick={() => onReview(r.projectId)}>{t('work.where.reviewCount', { count: r.review })}</Button>
                )}
              </Toolbar>
            </Panel>
          ))}
          {read.view.idle > 0 && <p className="muted">{t('work.where.idle', { count: read.view.idle })}</p>}
          <Panel title={t('work.where.unowned')}>
            {read.view.unowned.length === 0 ? (
              <p className="muted">{t('work.where.unownedNone')}</p>
            ) : (
              read.view.unowned.map((s) => <Row key={s.sessionId}>{sessionLine(s, t, now)}</Row>)
            )}
          </Panel>
          <p className="muted">{t('work.where.readAt', { at: new Date(read.view.readAt).toLocaleTimeString() })}</p>
        </>
      )}
    </div>
  )
}
// #endregion where-work-is

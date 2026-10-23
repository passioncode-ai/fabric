// #region agent-page — docs: docs/evidence/specs/2026-10-23-0312-w2-project-onboarding.md#decisions-the-questions-the-scenarios-leave-open
/**
 * One agent's page beside the list on Агенты (CO-393; the operator's walk OF-30, the flow of OF-09; decision W2-10):
 * its name, project and state, the ways out (console, project, task), the task it holds, what it is doing now, its
 * results, then everything its session did, newest first and by day. Read from the session's history, the same read
 * the console list uses, again when the journal moves; a failed read is said in its place with «Повторить».
 */
import { useEffect, useState } from 'react'
import type { LiveAgent } from '../../../shared/homeLive'
import type { FeedEvent } from '../../../shared/types'
import { eventKind } from '../../../shared/homeView.ts'
import { mayHaveEarlier, SESSION_HISTORY_WINDOW, shownHistory } from '../../../shared/sessionHistory.ts'
import { describeEvent, useLocale, useT } from '../i18n'
import { runnerLabel } from '../runnerLabel'
import { since } from '../duration'
import { FailureNote } from '../OperatorError'
import { Doing } from './HomeWork'
import { dayLabel } from './HistoryScreen'

type Read = { at: 'reading' } | { at: 'ready'; events: FeedEvent[] } | { at: 'failed'; says: string; kept: FeedEvent[] | null }

export function AgentPage({ agent, mark, onConsole, onOpenProject, onOpenTask }: {
  agent: LiveAgent
  /** Moves when the journal does: the page reads its history again. */
  mark: number
  onConsole(sessionId: string): void
  onOpenProject(projectId: string): void
  onOpenTask?(projectId: string, taskId: string): void
}): React.JSX.Element {
  const t = useT()
  const locale = useLocale()
  const [read, setRead] = useState<Read & { of: string }>({ at: 'reading', of: agent.sessionId })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true
    const of = agent.sessionId
    Promise.resolve().then(() => window.fabric.terminal.history(of)).then(
      (events) => { if (alive) setRead({ at: 'ready', events, of }) },
      (e: unknown) => {
        if (alive) setRead((r) => ({ at: 'failed', says: e instanceof Error ? e.message : String(e), kept: r.of === of && r.at === 'ready' ? r.events : null, of }))
      }
    )
    return () => { alive = false }
  }, [agent.sessionId, mark, attempt])
  // Another agent's reading never shows under this one's name while the new read is in flight.
  const mine = read.of === agent.sessionId ? read : ({ at: 'reading', of: agent.sessionId } as const)
  const events = mine.at === 'ready' ? mine.events : mine.at === 'failed' ? mine.kept : null
  const newest = [...shownHistory(events ?? [])].reverse()
  const results = newest.filter((e) => eventKind(e) === 'result')
  const days: Array<{ day: string; rows: FeedEvent[] }> = []
  for (const e of newest) {
    const day = dayLabel(e.occurred_at, t, locale)
    if (days.length && days[days.length - 1].day === day) days[days.length - 1].rows.push(e)
    else days.push({ day, rows: [e] })
  }
  const time = (iso: string): string => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  return (
    <section className="lp-panel lh-agent-page" aria-labelledby="agent-page-title" data-testid="agent-page">
      <div className="lp-panel-head">
        <div>
          <p className="lp-kicker">{agent.projectName ?? t('launch.home.agents.noProject')}</p>
          <h3 id="agent-page-title" tabIndex={-1}>{runnerLabel(agent.agent, t)}</h3>
          <p className="lp-meta">{agent.stale ? t('launch.home.agents.stale') : t('agentPage.since', { time: since(agent.lastSignAt ?? agent.startedAt, t) })}</p>
        </div>
        <span className="lh-agents-actions">
          {agent.console && <button type="button" className="lp-button primary" onClick={() => onConsole(agent.sessionId)}>{t('launch.home.agents.openConsole')}</button>}
          {agent.projectId && <button type="button" className="lp-button" onClick={() => onOpenProject(agent.projectId!)}>{t('launch.home.agents.openProject')}</button>}
          {agent.task && agent.projectId && onOpenTask && (
            <button type="button" className="lp-button" onClick={() => onOpenTask(agent.projectId!, agent.task!.id)}>{t('agentPage.openTask')}</button>
          )}
        </span>
      </div>
      <h4>{t('agentPage.task')}</h4>
      <p>{agent.task ? agent.task.summary : t('agentPage.noTask')}</p>
      <h4>{t('agentPage.doing')}</h4>
      {/* The task has its own line above, so this says the action itself (D-4 keeps the task first in the list). */}
      <Doing item={{ doing: agent.doing, summary: null }} />
      {mine.at === 'failed' && (
        <>
          <FailureNote said={t('agentPage.unreadable')} detail={mine.says} />
          <button type="button" className="lp-button" onClick={() => setAttempt((n) => n + 1)}>{t('acts.retry')}</button>
        </>
      )}
      {mine.at === 'reading' && <p className="lp-meta" role="status">{t('estate.reading')}</p>}
      {events && (
        <>
          <h4>{t('agentPage.results')}</h4>
          {results.length === 0 ? <p className="lp-meta">{t('agentPage.noResults')}</p> : (
            <ul className="hx-list" aria-label={t('agentPage.results')}>
              {results.map((e) => (
                <li key={e.seq} className="hx-row"><div className="hx-act"><time className="hx-time" dateTime={e.occurred_at}>{time(e.occurred_at)}</time><span className="hx-said">{describeEvent(t, e.type)}</span></div></li>
              ))}
            </ul>
          )}
          <h4>{t('agentPage.did')}</h4>
          {newest.length === 0 ? <p className="lp-meta">{t('agents.noHistory')}</p> : (
            <ul className="hx-list" aria-label={t('agentPage.did')}>
              {days.map(({ day, rows }) => rows.map((e, i) => (
                <li key={e.seq} className="hx-row">
                  {i === 0 && <p className="hx-day">{day}</p>}
                  <div className="hx-act"><time className="hx-time" dateTime={e.occurred_at}>{time(e.occurred_at)}</time><span className="hx-said">{describeEvent(t, e.type)}</span></div>
                </li>
              )))}
            </ul>
          )}
          {mayHaveEarlier(events) && <p className="lp-meta">{t('agents.historyEarlier', { count: SESSION_HISTORY_WINDOW })}</p>}
        </>
      )}
    </section>
  )
}
// #endregion agent-page

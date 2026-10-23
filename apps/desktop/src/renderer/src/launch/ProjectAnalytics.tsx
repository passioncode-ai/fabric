// #region project-analytics-strip — docs: docs/evidence/specs/2026-10-23-0312-w2-project-onboarding.md#decisions-the-questions-the-scenarios-leave-open
// W2 S4b (OF-39, OF-26): how work goes in one project over eight weeks, read from the journal. A number Fabric cannot
// know says so in words, never zero; a read that fails says so.
import { useEffect, useState } from 'react'
import type { ProjectAnalytics as Reading } from '../../../shared/projectAnalytics'
import { since } from '../duration'
import { useT } from '../i18n'
import { FailureNote } from '../OperatorError'

export function ProjectAnalytics({ projectId, feedMark }: { projectId: string; feedMark: number }): React.JSX.Element {
  const t = useT()
  const [reading, setReading] = useState<Reading | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    Promise.resolve().then(() => window.fabric.projects.analytics(projectId)).then(
      (r) => { if (alive) { setReading(r); setProblem(null) } },
      (e: unknown) => alive && setProblem(e instanceof Error ? e.message : String(e))
    )
    return () => { alive = false }
  }, [projectId, feedMark])

  const hours = (h: number | null): string =>
    h === null ? t('launch.analytics.unknown') : h < 48 ? t('launch.analytics.hours', { n: Math.round(h) }) : t('launch.analytics.days', { n: Math.round(h / 24) })
  const done = reading ? reading.donePerWeek.reduce((s, x) => s + x, 0) : 0
  const most = reading ? Math.max(1, ...reading.donePerWeek) : 1

  return (
    <section className="lp-panel" aria-labelledby="project-analytics-title">
      <h3 id="project-analytics-title">{t('launch.analytics.title')}</h3>
      {problem && <FailureNote said={t('launch.analytics.unreadable')} detail={problem} />}
      {reading === null && !problem && <p className="lp-meta">{t('estate.reading')}</p>}
      {reading && (
        <dl className="lp-analytics">
          <dt>{t('launch.analytics.done', { weeks: reading.weeks })}</dt>
          <dd>
            {done}
            <span className="lp-analytics-bars" aria-hidden="true">
              {reading.donePerWeek.map((n, i) => <span key={i} style={{ height: `${Math.round((n / most) * 100)}%` }} />)}
            </span>
          </dd>
          <dt>{t('launch.analytics.lead')}</dt>
          <dd>{hours(reading.leadHours)}</dd>
          <dt>{t('launch.analytics.review')}</dt>
          <dd>{hours(reading.reviewHours)}</dd>
          <dt>{t('launch.analytics.reopened')}</dt>
          <dd>{reading.reopenedShare === null ? t('launch.analytics.unknown') : t('launch.analytics.percent', { n: Math.round(reading.reopenedShare * 100) })}</dd>
          <dt>{t('launch.analytics.questions')}</dt>
          <dd>{reading.oldestQuestionAt ? t('launch.analytics.questionsOldest', { n: reading.questionsWaiting, since: since(reading.oldestQuestionAt, t) }) : reading.questionsWaiting}</dd>
        </dl>
      )}
      {reading?.capped && <p className="lp-meta">{t('launch.analytics.capped')}</p>}
    </section>
  )
}
// #endregion project-analytics-strip

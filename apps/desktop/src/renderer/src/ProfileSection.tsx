// What has been done here (M131 · SCR-36).
//
// The operator asked for a manager with a portrait, a name, a length of service
// and a count of projects delivered. THREE OF THOSE FOUR ARE IN THE RECORD, and
// this shows them. The portrait and the name are not: one needs an image nobody
// has generated, the other is a decision about the product's own character.
//
// The slot for them is left visibly empty with what it would take, rather than
// filled with a placeholder face and a generated name. A screen that invents
// either is asserting something nobody chose — and the operator would then be
// arguing with their own product about who it is.

import { useEffect, useState } from 'react'
import type { EstateSummary } from '../../shared/types'
import { EmptyState, Panel, Stat, StatStrip } from './components'
import { useT } from './i18n'
import { go } from './evidence'

export function ProfileSection({ onError }: { onError: (m: string) => void }): React.JSX.Element {
  const t = useT()
  const [summary, setSummary] = useState<EstateSummary | null>(null)

  useEffect(() => {
    let alive = true
    void window.fabric.estate
      .summary()
      .then((s) => {
        if (alive) setSummary(s)
      })
      .catch((e) => {
        if (alive) onError(String(e))
      })
    return () => {
      alive = false
    }
  }, [])

  // A store that could not be read says so rather than showing zero — the rule
  // the memory screen established, and it matters more in front of a person.
  const n = (value: number | null): string =>
    value === null ? t('profile.unreadable') : String(value)

  return (
    <Panel id="sec-profile" title={t('profile.title')}>
      <p className="muted">{t('profile.lede')}</p>
      {summary === null && <EmptyState read={false}>{t('profile.lede')}</EmptyState>}
      {summary && (
        <>
          <p className="muted">
            {!summary.tenure.known
              ? t('profile.tenureNone')
              : summary.tenure.days === 0
                ? t('profile.tenureToday')
                : t('profile.tenure', {
                    days: summary.tenure.days,
                    since: summary.tenure.since.slice(0, 10)
                  })}
          </p>
          <StatStrip>
            {/* M142 — two of these seven have a register ON THIS SCREEN and
                open it. The other five are estate-wide sums whose rows live per
                project, and the estate has no cross-project surface for them.
                They stay unpressable and promise nothing: a figure that names a
                screen which does not exist is exactly the claim-wearing-a-
                citation this rule removes. The gap is recorded rather than
                papered over — see the milestone row. */}
            <Stat
              label={t('profile.projects')}
              value={n(summary.projects)}
              onClick={go('sec-estate-projects')}
            />
            <Stat label={t('profile.sessions')} value={n(summary.sessions)} />
            <Stat label={t('profile.tasksClosed')} value={n(summary.tasksClosed)} />
            <Stat label={t('profile.facts')} value={n(summary.facts)} />
            <Stat label={t('profile.decisions')} value={n(summary.decisions)} />
            <Stat label={t('profile.grants')} value={n(summary.grantsIssued)} />
            <Stat
              label={t('profile.events')}
              value={n(summary.events)}
              onClick={go('sec-estate-journal')}
            />
          </StatStrip>
        </>
      )}
      <h3 className="task-history-head">{t('profile.portrait')}</h3>
      <p className="muted">{t('profile.portraitEmpty')}</p>
    </Panel>
  )
}

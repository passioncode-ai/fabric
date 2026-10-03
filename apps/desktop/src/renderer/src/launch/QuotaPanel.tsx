// The account's quota, as its own panel (M83 via M113) — moved off the home onto «Квоты» in the
// «Управление» group (the launch shell, L11). THREE STATES (AX-14): nobody looked, the read
// failed, or a reading — and a reading names the CAUSE of a partial answer, not only its age.

import { quotaHasNumbers, quotaOf, quotaProblemKey, type QuotaReading } from '../../../shared/quotaReading.ts'
import { EmptyState, Panel, Row, StateChip } from '../components'
import { until } from '../duration'
import { useT } from '../i18n'

export function QuotaPanel({ quota }: { quota: QuotaReading }): React.JSX.Element {
  const t = useT()
  const reading = quotaOf(quota)
  return (
    <Panel id="sec-estate-quota" title={t('estate.quotaTitle')}>
      <p className="muted">{t('estate.quotaLede')}</p>
      {!quota.read ? (
        // NOT a measurement: `read={false}` is what this codebase uses for
        // "nobody has looked yet", and quota was the one reader it was never
        // applied to (M108's own rule).
        <EmptyState read={false} waiting={t('estate.quotaUnread')}>
          {t('estate.quotaUnread')}
        </EmptyState>
      ) : 'failed' in quota ? (
        <EmptyState read>{t('estate.quotaUnavailable', { reason: quota.failed })}</EmptyState>
      ) : !reading ? (
        // NOT "not signed in". The reader never answers null since the
        // 2026-10-03 release review — a signed-out account is `no-credential`
        // below — so an absent reading is something this screen cannot
        // explain, and it says only that.
        <EmptyState read>{t('estate.quotaNone')}</EmptyState>
      ) : (
        <>
          {/* THE CAUSE, named as itself. Six values rendered as one sentence
              about age said "last read 30s ago" for a rate-limit, a refusal
              and a missing credential alike (AX-14). */}
          {reading.problem && (
            <p className="muted">
              {t(quotaProblemKey(reading.problem, quotaHasNumbers(reading)) as 'estate.quotaThrottled', {
                age: `${reading.ageSeconds}s`
              })}
            </p>
          )}
          {reading.fiveHour && (
            <QuotaRow
              label={t('estate.quota5h')}
              pct={reading.fiveHour.utilization}
              resets={reading.fiveHour.resetsAt}
              stale={reading.problem !== null}
            />
          )}
          {reading.sevenDay && (
            <QuotaRow
              label={t('estate.quota7d')}
              pct={reading.sevenDay.utilization}
              resets={reading.sevenDay.resetsAt}
              stale={reading.problem !== null}
            />
          )}
          {/* `byModel` was computed by the reader from the first day and
              rendered by NOBODY — the half of M83 that made the board more
              generous than the product. It is the part that answers WHICH
              model to reach for, which is what the question is actually about. */}
          {Object.keys(reading.byModel).length > 0 && (
            <>
              <p className="muted">{t('estate.quotaByModel')}</p>
              {Object.entries(reading.byModel).map(([model, w]) => (
                <QuotaRow
                  key={model}
                  label={model}
                  pct={w.utilization}
                  resets={w.resetsAt}
                  stale={reading.problem !== null}
                />
              ))}
            </>
          )}
        </>
      )}
    </Panel>
  )
}

/**
 * One quota window, as a row (M83 via M113).
 *
 * The percentage carries a TONE rather than a colour chosen here: the component
 * set owns appearance, and "nearly spent" is a state the word already says.
 */
function QuotaRow({
  label,
  pct,
  resets,
  stale
}: {
  label: string
  pct: number
  resets: string | null
  stale: boolean
}): React.JSX.Element {
  const t = useT()
  const whole = Math.round(pct)
  return (
    <Row
      lead={
        <StateChip tone={stale ? 'quiet' : whole >= 90 ? 'danger' : whole >= 70 ? 'warn' : 'good'}>
          {whole}%
        </StateChip>
      }
      trail={resets ? <span className="muted">{t('estate.quotaResets', { time: until(resets, t) })}</span> : undefined}
    >
      {label}
    </Row>
  )
}

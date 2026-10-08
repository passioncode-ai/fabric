// #region runner-fallback-setting — docs: docs/adr/0125-an-agent-launch-may-follow-the-operators-fallback-order.md#decision
// Settings → Fallback order (ADR-0125, SCN-135). The coding agents a launch with the fallback choice tries,
// from the top, each with how it may serve: a new session, an open one first, or an open one only. The
// order is this computer's (it lives in settings.json); an empty order means every launch runs the
// coding agent it names, as before.
import { useState } from 'react'
import type { AppSettings } from '../../shared/types'
import { FALLBACK_RUNNERS, type FallbackEntry, type FallbackSession } from '../../shared/runnerRoute.ts'
import { Button } from './components'
import { useT } from './i18n'
import { runnerLabel } from './runnerLabel'
import { FALLBACK_CHANGED } from './useFallbackChoice'

const SESSIONS: readonly FallbackSession[] = ['spawn', 'attach-or-spawn', 'attach-only']
const SESSION_KEY = { spawn: 'settings.fallback.session.spawn', 'attach-or-spawn': 'settings.fallback.session.attachOrSpawn', 'attach-only': 'settings.fallback.session.attachOnly' } as const

export function FallbackOrderSetting({ value, onChange }: {
  value: AppSettings['runnerFallback']
  onChange: (next: Partial<AppSettings>) => Promise<void> | void
}): React.JSX.Element {
  const t = useT()
  const order = value.order
  const unused = FALLBACK_RUNNERS.filter((runner) => !order.some((entry) => entry.runner === runner))
  const [adding, setAdding] = useState<string>('')
  const save = (next: FallbackEntry[]) => {
    void Promise.resolve(onChange({ runnerFallback: { order: next } })).then(() => window.dispatchEvent(new Event(FALLBACK_CHANGED)))
  }
  const move = (index: number, by: -1 | 1) => {
    const next = [...order]
    const [entry] = next.splice(index, 1)
    if (entry) next.splice(index + by, 0, entry)
    save(next)
  }
  const pick = adding && unused.includes(adding) ? adding : (unused[0] ?? '')
  return (
    <div className="settings-fallback">
      <strong>{t('settings.fallback.title')}</strong>
      <span className="settings-note">{order.length ? t('settings.fallback.lede') : t('settings.fallback.empty')}</span>
      <ol aria-label={t('settings.fallback.title')}>
        {order.map((entry, index) => (
          <li key={entry.runner}>
            <span className="settings-fallback-name">{runnerLabel(entry.runner, t)}</span>
            <select aria-label={t('settings.fallback.sessionFor', { agent: runnerLabel(entry.runner, t) })} value={entry.session}
              onChange={(e) => save(order.map((x, i) => (i === index ? { ...x, session: e.target.value as FallbackSession } : x)))}>
              {SESSIONS.map((s) => <option key={s} value={s}>{t(SESSION_KEY[s])}</option>)}
            </select>
            {/* Each row's controls name their agent: a screen reader on "Up" must know whose (0.3.3 UX-7). */}
            <Button tone="ghost" aria-label={t('settings.fallback.upFor', { agent: runnerLabel(entry.runner, t) })} onClick={() => move(index, -1)} disabled={index === 0}>{t('settings.fallback.up')}</Button>
            <Button tone="ghost" aria-label={t('settings.fallback.downFor', { agent: runnerLabel(entry.runner, t) })} onClick={() => move(index, 1)} disabled={index === order.length - 1}>{t('settings.fallback.down')}</Button>
            <Button tone="ghost" aria-label={t('settings.fallback.removeFor', { agent: runnerLabel(entry.runner, t) })} onClick={() => save(order.filter((_, i) => i !== index))}>{t('settings.fallback.remove')}</Button>
          </li>
        ))}
      </ol>
      {unused.length > 0 && (
        <span className="settings-fallback-add">
          <select aria-label={t('settings.fallback.pick')} value={pick} onChange={(e) => setAdding(e.target.value)}>
            {unused.map((runner) => <option key={runner} value={runner}>{runnerLabel(runner, t)}</option>)}
          </select>{' '}
          <Button tone="ghost" onClick={() => { if (pick) save([...order, { runner: pick, session: 'spawn' }]) }}>{t('settings.fallback.add')}</Button>
        </span>
      )}
    </div>
  )
}
// #endregion runner-fallback-setting

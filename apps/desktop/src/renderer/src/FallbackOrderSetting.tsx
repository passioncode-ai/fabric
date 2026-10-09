// #region runner-fallback-setting — docs: docs/adr/0125-an-agent-launch-may-follow-the-operators-fallback-order.md#decision
// Settings → Fallback order (ADR-0125, SCN-135). The coding agents a launch with the fallback choice tries,
// from the top, each with how it may serve: a new session, an open one first, or an open one only. The
// order is this computer's (it lives in settings.json); an empty order means every launch runs the
// coding agent it names, as before.
import { useEffect, useRef, useState } from 'react'
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
    void Promise.resolve(onChange({ runnerFallback: { order: next } })).then(
      () => window.dispatchEvent(new Event(FALLBACK_CHANGED)),
      () => undefined // not silence: the caller says why the setting was not saved (App.tsx, settings.notSaved)
    )
  }
  const list = useRef<HTMLOListElement>(null)
  // Focus follows the moved (or the next) row once the saved order is drawn — not before, when the list still shows
  // the old order (0.3.3 verification, iteration 3, UX-1; Remove: UX-6). The button pressed may now be disabled at
  // the top or bottom, so the row's first working button takes it.
  const pendingFocus = useRef<{ runner: string | null; fallback: number } | null>(null)
  useEffect(() => {
    const want = pendingFocus.current
    if (!want) return
    const rows = [...(list.current?.children ?? [])] as HTMLElement[]
    const at = want.runner ? order.findIndex((e) => e.runner === want.runner) : Math.min(want.fallback, rows.length - 1)
    if (want.runner && at < 0) return // not drawn yet: the save is still on its way
    pendingFocus.current = null
    const buttons: HTMLButtonElement[] = at < 0 ? [] : Array.from(rows[at].querySelectorAll('button'))
    const target = buttons.find((b) => !b.disabled) ?? null
    ;(target ?? list.current?.parentElement?.querySelector<HTMLElement>('select'))?.focus()
  }, [order])
  const move = (index: number, by: -1 | 1) => {
    const next = [...order]
    const [entry] = next.splice(index, 1)
    if (entry) next.splice(index + by, 0, entry)
    pendingFocus.current = { runner: entry?.runner ?? null, fallback: index }
    save(next)
  }
  const remove = (index: number) => {
    pendingFocus.current = { runner: null, fallback: index }
    save(order.filter((_, i) => i !== index))
  }
  const pick = adding && unused.includes(adding) ? adding : (unused[0] ?? '')
  return (
    <div className="settings-fallback">
      <strong>{t('settings.fallback.title')}</strong>
      <span className="settings-note">{order.length ? t('settings.fallback.lede') : t('settings.fallback.empty')}</span>
      <ol ref={list} aria-label={t('settings.fallback.title')}>
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
            <Button tone="ghost" aria-label={t('settings.fallback.removeFor', { agent: runnerLabel(entry.runner, t) })} onClick={() => remove(index)}>{t('settings.fallback.remove')}</Button>
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

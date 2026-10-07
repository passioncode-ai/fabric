// #region runner-fallback-choice — docs: docs/adr/0125-an-agent-launch-may-follow-the-operators-fallback-order.md#decision
// The launchers' "Fallback order" choice (ADR-0125 §2, SCN-135): offered only when this computer has an
// order, labelled with the coding agent it resolves to right now. Whether the order is set comes from the
// settings file at once; the resolution needs the machine measured, so it follows and is read again when
// the window comes back into focus or the order is edited. The launch walks the order again itself, so a
// stale label can never start something the person did not choose — it only says what is likely.
import { useEffect, useState } from 'react'
import { FALLBACK_OPTION, type FallbackPreview } from '../../shared/runnerRoute.ts'
import { useT } from './i18n'
import { runnerLabel } from './runnerLabel'

export { FALLBACK_OPTION }

/** Dispatched on `window` after the order is saved, so open launchers read it again. */
export const FALLBACK_CHANGED = 'fabric:fallback-order-changed'

export function useFallbackChoice(projectId: string, kind: 'terminal' | 'task'): { configured: boolean; label: string } {
  const t = useT()
  const [configured, setConfigured] = useState(false)
  const [preview, setPreview] = useState<FallbackPreview | null>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const again = () => setTick((n) => n + 1)
    window.addEventListener('focus', again)
    window.addEventListener(FALLBACK_CHANGED, again)
    return () => { window.removeEventListener('focus', again); window.removeEventListener(FALLBACK_CHANGED, again) }
  }, [])
  useEffect(() => {
    let live = true
    // Through resolved promises, so a main process that cannot answer reads as "no order", never a crash.
    Promise.resolve().then(() => window.fabric.settings.read())
      .then((s) => { if (live) setConfigured((s.runnerFallback?.order.length ?? 0) > 0) }, () => { if (live) setConfigured(false) })
    Promise.resolve().then(() => window.fabric.terminal.fallback(projectId, kind, null))
      .then((p) => { if (live) setPreview(p) }, () => { if (live) setPreview(null) })
    return () => { live = false }
  }, [projectId, kind, tick])
  const walk = preview?.walk
  return {
    configured,
    label: !walk ? t('agents.fallback.optionPending')
      : walk.state === 'selected' ? t('agents.fallback.option', { agent: runnerLabel(walk.runner, t) })
      : t('agents.fallback.optionNone')
  }
}
// #endregion runner-fallback-choice

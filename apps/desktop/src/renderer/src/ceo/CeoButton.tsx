// #region ceo-button — docs: docs/ux/scenarios.md#scn-110-talk-to-the-floating-ceo-over-any-screen
/**
 * The floating CEO button over every screen of the main window (ADR-0197, SCN-110): the character's own face, so the
 * CEO is someone and not a word, with a ring that says whether it is on (running), starting, stopped or failed. A press
 * opens the CEO's popup. The ring's colour is the only state signal that moves; the starting ring breathes, and holds
 * still under reduced motion.
 */
import { useEffect, useState } from 'react'
import type { CeoState } from '../../../shared/ceoAgent.ts'
import { useT } from '../i18n'
import { FabricAvatar } from '../launch/FabricAvatar'

export function CeoButton({ onError }: { onError: (message: string) => void }): React.JSX.Element {
  const t = useT()
  const [state, setState] = useState<CeoState | null>(null)
  useEffect(() => {
    let live = true
    window.fabric.ceoAgent.status?.().then((s) => { if (live) setState(s.state) }, () => { /* no status: the ring stays neutral */ })
    const off = window.fabric.ceoAgent.onChanged?.((s) => setState(s.state))
    return () => { live = false; off?.() }
  }, [])
  const label = state ? `${t('ceoAgent.floating')} (${t(`ceoAgent.state.${state}` as 'ceoAgent.state.running')})` : t('ceoAgent.floating')
  return (
    <button type="button" className={`ceo-floating s-${state ?? 'unknown'}`} title={label} aria-label={label}
      onClick={() => window.fabric.ceoAgent.open(null).catch((e: unknown) => onError(e instanceof Error ? e.message : String(e)))}>
      <span className="ceo-floating-face"><FabricAvatar size="tiny" label="" /></span>
      <span className="ceo-floating-label" aria-hidden="true">{t('ceoAgent.title')}</span>
    </button>
  )
}
// #endregion ceo-button

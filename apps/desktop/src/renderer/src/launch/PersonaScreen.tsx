// Your Fabric (SCR-36 · docs/reports/product.html `renderPersona`): choose how Fabric looks — a
// character and a variant — preview it, keep it. Variants are computed here from the seed, without
// a model; the look changes no role and no authority, and it lives on this machine.

import { useState } from 'react'
import { PERSONA_STYLES, variantsOf, type Persona, type PersonaStyle } from '../../../shared/persona.ts'
import { useT } from '../i18n'
import { FabricAvatar } from './FabricAvatar'
import { usePersona } from './persona'

export function PersonaScreen({ onDone }: { onDone: () => void }): React.JSX.Element {
  const t = useT()
  const { persona, chosen, problem, save } = usePersona()
  const [draft, setDraft] = useState<Persona>(persona)
  const [generation, setGeneration] = useState(0)
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState<{ ok: boolean; reason?: string } | null>(null)
  const variants = variantsOf(generation)

  const keep = async (): Promise<void> => {
    setBusy(true)
    setSaid(null)
    try {
      const r = await save(draft)
      setSaid(r.saved ? { ok: true } : { ok: false, reason: r.reason })
      if (r.saved) onDone()
    } catch (e) {
      // A rejected save does not say whether it landed; the stored look is re-read on the next open.
      setSaid({ ok: false, reason: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="lp" data-launch-view="launch-persona">
      <header className="lp-heading">
        <div>
          <p className="lp-kicker">{t('launch.persona.kicker')}</p>
          <h2 tabIndex={-1}>{t('launch.persona.title')}</h2>
          <p>{chosen ? t('launch.persona.lede') : t('launch.persona.ledeFirst')}</p>
        </div>
        <div className="lp-actions"><button type="button" className="lp-button" onClick={onDone}>{t('launch.persona.back')}</button></div>
      </header>
      {problem && <div className="lp-callout" role="alert"><p>{t('launch.persona.problem', { reason: problem })}</p></div>}
      <div className="fp-persona-grid">
        <section className="lp-panel fp-persona-stage" aria-label={t('launch.persona.preview')}>
          <FabricAvatar size="large" seed={draft.seed} style={draft.style} label={t('launch.avatar.label')} />
          <span className="lp-pill">{t('launch.persona.preview')}</span>
          <h3>{t('launch.brand.product')}</h3>
          <p>{t('launch.persona.stageBody')}</p>
          <small>{t('launch.persona.noAuthority')}</small>
        </section>
        <section className="lp-panel">
          <p className="lp-kicker">{t('launch.persona.character')}</p>
          <div className="fp-style-options" role="group" aria-label={t('launch.persona.character')}>
            {PERSONA_STYLES.map((style: PersonaStyle) => (
              <button key={style} type="button" className="fp-style" aria-pressed={draft.style === style} onClick={() => setDraft({ ...draft, style })}>
                <FabricAvatar size="tiny" seed={draft.seed} style={style} label="" />
                <b>{t(`launch.persona.style.${style}` as 'launch.persona.style.orbit')}</b>
                <small>{t(`launch.persona.style.${style}.desc` as 'launch.persona.style.orbit.desc')}</small>
              </button>
            ))}
          </div>
          <div className="lp-panel-head">
            <p className="lp-kicker">{t('launch.persona.variant')}</p>
            <button type="button" className="lp-button" onClick={() => setGeneration(generation + 1)}>{t('launch.persona.more')}</button>
          </div>
          <div className="fp-variants" role="group" aria-label={t('launch.persona.variant')}>
            {variants.map((seed, n) => (
              <button key={seed} type="button" aria-pressed={draft.seed === seed} aria-label={t('launch.persona.variantN', { n: n + 1 })} onClick={() => setDraft({ ...draft, seed })}>
                <FabricAvatar size="small" seed={seed} style={draft.style} label="" />
                <span>{t('launch.persona.variantN', { n: n + 1 })}{draft.seed === seed ? ` · ${t('launch.persona.chosen')}` : ''}</span>
              </button>
            ))}
          </div>
          <p className="lp-meta">{t('launch.persona.local')}</p>
          <div className="lp-divider" />
          {said && !said.ok && <div className="lp-callout" role="alert"><p>{t('launch.persona.notSaved', { reason: said.reason ?? '' })}</p></div>}
          <div className="lp-actions">
            <button type="button" className="lp-button primary" disabled={busy} onClick={() => void keep()}>{t('launch.persona.save')}</button>
            <button type="button" className="lp-button" onClick={onDone}>{t('launch.persona.skip')}</button>
          </div>
          <p className="lp-meta">{t('launch.persona.where')}</p>
        </section>
      </div>
    </div>
  )
}

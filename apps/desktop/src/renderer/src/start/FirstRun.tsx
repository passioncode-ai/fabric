// #region first-run — docs: docs/adr/0100-first-run-and-start-paths.md#decision
// The first run (ADR-0100, SCN-126, SCR-70): name and look → the coding agents on this machine →
// where to start. Three steps, each skippable, none a form about the operator. It is shown once,
// to an estate with no project; finishing or skipping stamps `settings.firstRun.completedAt`, and
// Help reopens it. Nothing here grants authority: the look is a preference, the detection reads
// `--version`, and the start menu only navigates.

import { useEffect, useRef, useState } from 'react'
import { PERSONA_NAME_MAX, PERSONA_STYLES, personaName, variantsOf, type Persona, type PersonaStyle } from '../../../shared/persona.ts'
import type { ExecutorRow, ScanView } from '../../../shared/startPaths.ts'
import { useT } from '../i18n'
import { FabricAvatar } from '../launch/FabricAvatar'
import { usePersona } from '../launch/persona'
import { StartCards, type StartPath } from './StartPaths'

export interface FirstRunProps {
  /** The operator chose a path (or skipped): stamp completion, then go there. */
  onFinish(next: StartPath | 'home'): void
}

type Step = 1 | 2 | 3

export function FirstRun({ onFinish }: FirstRunProps): React.JSX.Element {
  const t = useT()
  const [step, setStep] = useState<Step>(1)
  return (
    <div className="lp st st-first" data-launch-view="first-run">
      <ol className="st-progress" aria-label={t('first.progress')}>
        {([1, 2, 3] as const).map((n) => (
          <li key={n} aria-current={step === n ? 'step' : undefined} className={n < step ? 'done' : n === step ? 'current' : ''}>
            <span>{n}</span>{t(`first.step${n}` as 'first.step1')}
          </li>
        ))}
      </ol>
      {step === 1 && <PersonaStep onNext={() => setStep(2)} />}
      {step === 2 && <ExecutorStep onBack={() => setStep(1)} onNext={() => setStep(3)} />}
      {step === 3 && <StartStep onBack={() => setStep(2)} onFinish={onFinish} />}
    </div>
  )
}

function PersonaStep({ onNext }: { onNext(): void }): React.JSX.Element {
  const t = useT()
  const { persona, save } = usePersona()
  const [draft, setDraft] = useState<Persona>(persona)
  const [name, setName] = useState(persona.name ?? '')
  const [generation, setGeneration] = useState(0)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  // The stored look arrives asynchronously; it fills the step only until the operator has touched it,
  // so a name typed before the read lands is never overwritten by the read.
  const touched = useRef(false)
  useEffect(() => { if (!touched.current) { setDraft(persona); setName(persona.name ?? '') } }, [persona])
  const shown = personaName(name) ?? t('launch.brand.product')
  const tooLong = name.trim().length > PERSONA_NAME_MAX

  const next = async (): Promise<void> => {
    setBusy(true)
    setProblem(null)
    try {
      const n = personaName(name)
      const r = await save(n ? { seed: draft.seed, style: draft.style, name: n } : { seed: draft.seed, style: draft.style })
      if (!r.saved) { setProblem(t('first.persona.notSaved', { reason: r.reason ?? '' })); return }
      onNext()
    } catch (e) {
      setProblem(t('first.persona.notSaved', { reason: e instanceof Error ? e.message : String(e) }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="st-first-step" aria-labelledby="first-persona">
      <div className="st-first-stage">
        <FabricAvatar size="large" seed={draft.seed} style={draft.style} label={t('launch.avatar.label')} />
        <h2 id="first-persona" tabIndex={-1}>{t('first.persona.hello', { name: shown })}</h2>
        <p>{t('first.persona.lede')}</p>
      </div>
      <div className="lp-panel">
        {problem && <div className="lp-callout" role="alert"><p>{problem}</p><button type="button" className="lp-button" onClick={onNext}>{t('first.persona.continueAnyway')}</button></div>}
        <label className="lp-field">
          {t('first.persona.name')}
          <input value={name} maxLength={PERSONA_NAME_MAX + 10} placeholder={t('launch.brand.product')} onChange={(e) => { touched.current = true; setName(e.target.value) }} aria-invalid={tooLong} />
          <small>{tooLong ? t('first.persona.tooLong', { max: PERSONA_NAME_MAX }) : t('first.persona.nameHint')}</small>
        </label>
        <p className="lp-kicker">{t('launch.persona.character')}</p>
        <div className="fp-style-options" role="group" aria-label={t('launch.persona.character')}>
          {PERSONA_STYLES.map((style: PersonaStyle) => (
            <button key={style} type="button" className="fp-style" aria-pressed={draft.style === style} onClick={() => { touched.current = true; setDraft({ ...draft, style }) }}>
              <FabricAvatar size="tiny" seed={draft.seed} style={style} label="" />
              <b>{t(`launch.persona.style.${style}` as 'launch.persona.style.orbit')}</b>
            </button>
          ))}
        </div>
        <div className="lp-panel-head">
          <p className="lp-kicker">{t('launch.persona.variant')}</p>
          <button type="button" className="lp-button" onClick={() => setGeneration(generation + 1)}>{t('launch.persona.more')}</button>
        </div>
        <div className="fp-variants" role="group" aria-label={t('launch.persona.variant')}>
          {variantsOf(generation).map((seed, n) => (
            <button key={seed} type="button" aria-pressed={draft.seed === seed} aria-label={t('launch.persona.variantN', { n: n + 1 })} onClick={() => { touched.current = true; setDraft({ ...draft, seed }) }}>
              <FabricAvatar size="small" seed={seed} style={draft.style} label="" />
            </button>
          ))}
        </div>
        <p className="lp-meta">{t('launch.persona.noAuthority')}</p>
        <div className="lp-actions">
          <button type="button" className="lp-button primary" disabled={busy || tooLong} onClick={() => void next()}>{t('first.next')}</button>
          <button type="button" className="lp-button" disabled={busy} onClick={onNext}>{t('first.skip')}</button>
        </div>
      </div>
    </section>
  )
}

function ExecutorStep({ onBack, onNext }: { onBack(): void; onNext(): void }): React.JSX.Element {
  const t = useT()
  const [rows, setRows] = useState<ExecutorRow[] | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const check = (): void => {
    setRows(null)
    setFailure(null)
    window.fabric.start.executors().then(setRows, (e: unknown) => setFailure(e instanceof Error ? e.message : String(e)))
  }
  useEffect(check, [])
  const anyFound = rows?.some((r) => r.state === 'found') ?? false
  const copy = async (text: string): Promise<void> => {
    try { await navigator.clipboard.writeText(text); setCopied(text) } catch { setCopied(null) }
  }
  return (
    <section className="st-first-step" aria-labelledby="first-exec">
      <div className="st-first-stage">
        <h2 id="first-exec" tabIndex={-1}>{t('first.exec.title')}</h2>
        <p>{t('first.exec.lede')}</p>
      </div>
      <div className="lp-panel">
        {failure && <div className="lp-callout" role="alert"><p>{t('first.exec.failed', { reason: failure })}</p></div>}
        {rows === null && !failure && <p aria-busy="true">{t('first.exec.checking')}</p>}
        {rows && (
          <ul className="st-exec">
            {rows.map((r) => (
              <li key={r.id} className={`st-exec-row ${r.state}`}>
                <div>
                  <b>{r.label}</b>
                  <small>
                    {r.state === 'found' && t('first.exec.found', { version: r.version ?? '?' })}
                    {r.state === 'unresponsive' && t('first.exec.unresponsive')}
                    {r.state === 'missing' && t('first.exec.missing')}
                  </small>
                  {r.path && <code>{r.path}</code>}
                </div>
                <span className={r.state === 'found' ? 'lp-pill' : 'lp-pill attention'}>{t(`first.exec.state.${r.state}` as 'first.exec.state.found')}</span>
                {r.state !== 'found' && r.install && (
                  <div className="st-install">
                    <code>{r.install}</code>
                    <button type="button" className="lp-button" onClick={() => void copy(r.install!)}>{copied === r.install ? t('first.exec.copied') : t('first.exec.copy')}</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="lp-meta">{t('first.exec.note')}</p>
        <div className="lp-actions">
          <button type="button" className="lp-button primary" disabled={rows === null && !failure} onClick={onNext}>{anyFound ? t('first.next') : t('first.exec.continueWithout')}</button>
          <button type="button" className="lp-button" onClick={check}>{t('first.exec.recheck')}</button>
          <button type="button" className="lp-button" onClick={onBack}>{t('first.back')}</button>
        </div>
      </div>
    </section>
  )
}

function StartStep({ onBack, onFinish }: { onBack(): void; onFinish(next: StartPath | 'home'): void }): React.JSX.Element {
  const t = useT()
  const { persona } = usePersona()
  const [last, setLast] = useState<ScanView | null>(null)
  useEffect(() => {
    let alive = true
    window.fabric.start.lastScan().then((s) => alive && setLast(s), () => undefined)
    return () => { alive = false }
  }, [])
  return (
    <section className="st-first-step wide" aria-labelledby="first-start">
      <div className="st-first-stage">
        <h2 id="first-start" tabIndex={-1}>{t('first.start.title', { name: persona.name ?? t('launch.brand.product') })}</h2>
        <p>{t('first.start.lede')}</p>
      </div>
      <StartCards onPath={(p) => onFinish(p)} lastScan={last} />
      <div className="lp-actions">
        <button type="button" className="lp-button" onClick={onBack}>{t('first.back')}</button>
        <button type="button" className="lp-button" onClick={() => onFinish('home')}>{t('first.start.later')}</button>
      </div>
    </section>
  )
}

/**
 * Whether the first run is due: never finished AND the estate has no project yet. An unknown project
 * list (null) is not due, and neither is `undefined` — settings without the field come from a main
 * process that predates the first run, and that window must not start one it cannot record.
 */
export function firstRunDue(completedAt: string | null | undefined, projects: readonly unknown[] | null): boolean {
  return completedAt === null && projects !== null && projects.length === 0
}
// #endregion first-run

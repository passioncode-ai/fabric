// #region first-run — docs: docs/ux/scenarios.md#scn-126-first-run-name-look-coding-agents-where-to-start
// The first run (ADR-0100, SCN-126, SCR-70): name and look → the coding agents on this machine →
// where to start. Three steps, each skippable, none a form about the operator. It is shown once,
// to an estate with no project; finishing or skipping stamps `settings.firstRun.completedAt`, and
// Help reopens it. Nothing here grants authority: the look is a preference, the detection reads
// `--version`, and the start menu only navigates.

import { useEffect, useRef, useState } from 'react'
import { PERSONA_NAME_MAX, PERSONA_STYLES, personaName, variantsOf, type Persona, type PersonaStyle } from '../../../shared/persona.ts'
import type { ExecutorRow, ScanView } from '../../../shared/startPaths.ts'
import { defaultBuilder, mayPick, withHead } from '../../../shared/builderChoice.ts'
import type { RunnerFallback } from '../../../shared/runnerRoute.ts'
import { useT } from '../i18n'
import { FabricAvatar } from '../launch/FabricAvatar'
import { usePersona } from '../launch/persona'
import { FALLBACK_CHANGED } from '../useFallbackChoice'
import { CopyButton, StartCards, errorText, type StartPath } from './StartPaths'
import { programOf } from './startParts'

export interface FirstRunProps {
  /** The operator chose a path (or skipped): stamp completion, then go there. */
  onFinish(next: StartPath | 'home'): void
}

type Step = 1 | 2 | 3

export function FirstRun({ onFinish }: FirstRunProps): React.JSX.Element {
  const t = useT()
  const [step, setStep] = useState<Step>(1)
  // Each step announces itself: focus moves to its heading, so a keyboard or screen-reader user is told
  // where they are rather than left on the body (iteration 1, accessibility).
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    document.getElementById(['first-persona', 'first-exec', 'first-start'][step - 1])?.focus()
  }, [step])
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
      setProblem(t('first.persona.notSaved', { reason: errorText(e) }))
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
          <input value={name} maxLength={PERSONA_NAME_MAX + 10} placeholder={t('launch.brand.product')} onChange={(e) => { touched.current = true; setName(e.target.value) }} aria-invalid={tooLong} aria-describedby="first-persona-name-hint" />
          <small id="first-persona-name-hint" className={tooLong ? 'field-problem' : undefined}>{tooLong ? t('first.persona.tooLong', { max: PERSONA_NAME_MAX }) : t('first.persona.nameHint')}</small>
        </label>
        <p className="lp-kicker">{t('first.persona.character')}</p>
        <div className="fp-style-options" role="group" aria-label={t('first.persona.character')}>
          {PERSONA_STYLES.map((style: PersonaStyle) => (
            <button key={style} type="button" className="fp-style" aria-pressed={draft.style === style} onClick={() => { touched.current = true; setDraft({ ...draft, style }) }}>
              <FabricAvatar size="tiny" seed={draft.seed} style={style} label="" />
              <b>{t(`launch.persona.style.${style}` as 'launch.persona.style.orbit')}</b>
            </button>
          ))}
        </div>
        <div className="lp-panel-head">
          <p className="lp-kicker">{t('first.persona.variant')}</p>
          <button type="button" className="lp-button" onClick={() => setGeneration(generation + 1)}>{t('launch.persona.more')}</button>
        </div>
        <div className="fp-variants" role="group" aria-label={t('first.persona.variant')}>
          {variantsOf(generation).map((seed, n) => (
            <button key={seed} type="button" aria-pressed={draft.seed === seed} aria-label={t('launch.persona.variantN', { n: n + 1 })} onClick={() => { touched.current = true; setDraft({ ...draft, seed }) }}>
              <FabricAvatar size="small" seed={seed} style={draft.style} label="" />
            </button>
          ))}
        </div>
        <div className="lp-actions">
          <button type="button" className="lp-button primary" disabled={busy || tooLong} onClick={() => void next()}>{t('first.next')}</button>
          <button type="button" className="lp-button" disabled={busy} onClick={onNext}>{t('first.skip')}</button>
        </div>
      </div>
    </section>
  )
}

// #region first-run-agent-choice — docs: docs/ux/scenarios.md#scn-126-first-run-name-look-coding-agents-where-to-start
// Step 2 is a choice, not only a list (REQ-40; the operator, 2026-10-11: the coding agents could not be picked in
// the onboarding). Each row is a native radio: Tab reaches the group, the arrow keys move inside it, a screen reader
// names each one. Every installed agent that answered can be picked, signed in or not (the sign-in line says what to
// do); one that is not installed, or did not answer, says why it cannot be picked and what to do instead. The pick is
// saved at Continue as the head of the fallback order (ADR-0125) — the order the agent actions already preselect
// from (`defaultBuilder`) — and only when the operator picked: an untouched default writes nothing.
function ExecutorStep({ onBack, onNext }: { onBack(): void; onNext(): void }): React.JSX.Element {
  const t = useT()
  const [rows, setRows] = useState<ExecutorRow[] | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  // The order as read when the step opened: `undefined` while reading, `null` when the read failed.
  const [fallback, setFallback] = useState<RunnerFallback | null | undefined>(undefined)
  const [picked, setPicked] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  // Only the latest check may answer: a slower earlier one arriving last must not replace it (iteration 2).
  const checks = useRef(0)
  const check = (): void => {
    const n = ++checks.current
    setRows(null)
    setFailure(null)
    window.fabric.start.executors().then(
      (r) => { if (n === checks.current) setRows(r) },
      (e: unknown) => { if (n === checks.current) setFailure(errorText(e)) }
    )
  }
  useEffect(() => { check(); return () => { checks.current++ } }, [])
  useEffect(() => {
    let alive = true
    Promise.resolve().then(() => window.fabric.settings.read()).then(
      (s) => { if (alive) setFallback(s.runnerFallback ?? { order: [] }) },
      () => { if (alive) setFallback(null) }
    )
    return () => { alive = false }
  }, [])
  // What is shown as chosen: the operator's pick while it can still be picked (a re-check may take it away), else
  // the same default the agent actions compute — the fallback order's first installed agent, then a connected one.
  const preselected = rows && fallback !== undefined ? defaultBuilder(rows, fallback) : null
  const chosen = picked && rows?.some((r) => r.id === picked && mayPick(r)) ? picked : preselected
  const pending = (rows === null && !failure) || (rows !== null && fallback === undefined)
  const how = picked === chosen || !chosen ? null
    : (fallback?.order ?? []).some((e) => e.runner === chosen) ? 'start.builder.fromOrder' : fallback === null ? 'start.builder.orderUnread' : 'start.builder.fromFound'

  const next = async (): Promise<void> => {
    if (busy) return
    if (!picked || picked !== chosen) { onNext(); return }
    setBusy(true)
    setProblem(null)
    try {
      // The order is read again right before it is written: one edited in Settings meanwhile keeps its entries, and
      // an order that could not be read is never replaced by a list of one.
      const current = (await window.fabric.settings.read()).runnerFallback ?? { order: [] }
      if (current.order[0]?.runner === picked) { onNext(); return }
      const written = await window.fabric.settings.write({ runnerFallback: { order: withHead(current, picked) } })
      if (!written.saved) { setProblem(t('first.exec.notSaved', { reason: written.reason ?? '' })); return }
      window.dispatchEvent(new Event(FALLBACK_CHANGED)) // open launchers read the order again
      onNext()
    } catch (e) {
      setProblem(t('first.exec.notSaved', { reason: errorText(e) }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="st-first-step" aria-labelledby="first-exec">
      <div className="st-first-stage">
        <h2 id="first-exec" tabIndex={-1}>{t('first.exec.title')}</h2>
        <p>{t('first.exec.lede')}</p>
      </div>
      <div className="lp-panel">
        {failure && <div className="lp-callout" role="alert"><p>{t('first.exec.failed', { reason: failure })}</p></div>}
        {problem && <div className="lp-callout" role="alert"><p>{problem}</p><button type="button" className="lp-button" onClick={onNext}>{t('first.persona.continueAnyway')}</button></div>}
        {rows === null && !failure && <p aria-busy="true">{t('first.exec.checking')}</p>}
        {rows && (
          <fieldset className="st-exec-choice" role="radiogroup" aria-describedby="first-exec-choose-hint">
            <legend>{t('first.exec.choose')}</legend>
            <p className="lp-meta" id="first-exec-choose-hint">{t('first.exec.chooseHint')}{how && <> <span>{t(how)}</span></>}</p>
            <ul className="st-exec">
              {rows.map((r) => {
                const pickable = mayPick(r)
                const why = `first-exec-why-${r.id}`
                const auth = `first-exec-auth-${r.id}`
                return (
                  <li key={r.id} className={`st-exec-row ${r.state}`} data-chosen={chosen === r.id || undefined}>
                    <label className="st-exec-pick">
                      <input type="radio" name="first-exec-choice" value={r.id} checked={chosen === r.id} disabled={!pickable || busy}
                        aria-describedby={pickable ? auth : r.state === 'unresponsive' ? `${why}-state ${why}` : why}
                        onChange={() => { setPicked(r.id); setProblem(null) }} />
                      <span>
                        <b>{r.label}</b>
                        <small>
                          {r.state === 'found' && t('first.exec.found', { version: r.version ?? '?' })}
                          {r.state === 'missing' && t('first.exec.missing')}
                        </small>
                      </span>
                    </label>
                    {/* Ready reads strongest; installed-but-not-connected is neutral; only a problem draws attention (iteration 3). */}
                    <span className={r.state === 'found' ? 'lp-pill' : 'lp-pill attention'} data-state={r.state === 'found' && r.connected ? 'ready' : r.state === 'found' ? 'installed' : r.state}>
                      {r.state === 'found' ? t(r.connected ? 'first.exec.state.found' : 'first.exec.state.foundUnconnected') : t(`first.exec.state.${r.state}` as 'first.exec.state.missing')}
                    </span>
                    <div className="st-exec-detail">
                      {r.path && <code>{r.path}</code>}
                      {/* #region executor-auth-status — docs: docs/ux/scenarios.md#scn-126-first-run-name-look-coding-agents-where-to-start */}
                      {r.state === 'found' && <small id={auth} data-authentication={r.authentication?.state ?? 'unknown'}>
                        {t(r.authentication?.state === 'authenticated' ? 'start.executor.auth.authenticated'
                          : r.authentication?.state === 'not-authenticated' ? 'start.executor.auth.notAuthenticated'
                          : r.authentication?.state === 'unsupported' ? (r.authentication.reason === 'unsupported-os' ? 'start.executor.auth.unsupportedOs' : 'start.executor.auth.unsupported')
                          : 'start.executor.auth.unknown')}
                      </small>}
                      {/* #endregion executor-auth-status */}
                      {r.state === 'unresponsive' && <small id={`${why}-state`}>{t('first.exec.unresponsive', { program: programOf(r.path, r.label) })}</small>}
                      {/* A missing agent with no install command is not told to run "the command below" (UX-8). */}
                      {!pickable && <small id={why} className="st-exec-why">{t(r.state === 'unresponsive' ? 'first.exec.cannotPick.unresponsive' : r.install ? 'first.exec.cannotPick.missing' : 'first.exec.cannotPick.missingNoCommand')}</small>}
                    </div>
                    {r.state === 'found' && !r.connected && <p className="st-exec-note">{t('first.exec.unconnected', { name: r.label })}</p>}
                    {r.state === 'missing' && r.install && (
                      <div className="st-install">
                        <code>{r.install}</code>
                        <CopyButton text={r.install!} what={r.label} />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </fieldset>
        )}
        <p className="lp-meta">{t('start.executor.auth.note')}</p>
        <div className="lp-actions">
          {/* "Without an agent" only once the agents are read and none can be picked; while they are being looked for
              (or the fallback order is still being read) it is plain Continue (UX-15, SCR-70). */}
          <button type="button" className="lp-button primary" disabled={busy} aria-busy={busy} onClick={() => void next()}>{chosen || pending ? t('first.next') : t('first.exec.continueWithout')}</button>
          <button type="button" className="lp-button" disabled={busy} onClick={check}>{t('first.exec.recheck')}</button>
          <button type="button" className="lp-button" disabled={busy} onClick={onBack}>{t('first.back')}</button>
        </div>
      </div>
    </section>
  )
}
// #endregion first-run-agent-choice

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

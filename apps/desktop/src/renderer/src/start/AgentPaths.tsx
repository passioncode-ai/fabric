// #region agent-paths — docs: docs/ux/scenarios.md#scn-136-create-an-ecosystem-agent
// The two agent actions of the onboarding (0.3.3, SCN-136 and SCN-131; SCR-74, SCR-75): create an ecosystem agent,
// and adapt one built elsewhere. Fabric's part is the folder, the Project, the readiness of the Fabric Agent Adapter
// skills and the launch; the work — the questions, the plan, the code — happens in the console of the coding agent
// the operator chooses (ADR-0123). Nothing is created or started before the explicit button, and a retry after a
// failure reuses the same ids, so it never makes a second folder, Project or task.

import { useEffect, useRef, useState } from 'react'
import { defaultBuilder } from '../../../shared/builderChoice.ts'
import { folderNameProblem, type AdapterSkillsView, type ExecutorRow, type FolderView } from '../../../shared/startPaths.ts'
import { useLocale, useT, type Translate } from '../i18n'
import { CopyButton, FolderFactsList, Heading, explainError, purposeFrom, reasonOf } from './startParts'

const newId = (): string => crypto.randomUUID()

/** One attempt's identity: chosen before the first try and reused by every retry of it, so a retry is the same
 *  Project, the same task and — once started — the same session, never a second of any (verifier, 0.3.3). */
interface Attempt { projectId: string; taskId: string; sessionId: string | null; launched: boolean; projectMade: boolean }
const newAttempt = (): Attempt => ({ projectId: newId(), taskId: newId(), sessionId: null, launched: false, projectMade: false })

/** Start the coding agent in the Project's folder with the instruction, then bring its console forward. A session
 *  this attempt already started is only brought forward again. */
async function launch(a: Attempt, projectId: string, instruction: string, optionId: string, preset: 'create-agent' | 'adapt-agent'): Promise<void> {
  // From the first launch on, the task may be recorded with this coding agent, so the choice is fixed for the
  // attempt; «Use another coding agent» is the way to a different one (a new task in the same Project).
  a.launched = true
  if (!a.sessionId) a.sessionId = (await window.fabric.tasks.start({ projectId, taskId: a.taskId, instruction, optionId, preset })).session.sessionId
  await window.fabric.windows.openSession(a.sessionId)
}

/** The sentence a failed attempt shows: once the session runs, it is the console that did not open — never "not
 *  created" (0.3.3 verification UX-5). */
const failure = (a: Attempt, e: unknown, t: Translate, key: 'start.createAgent.failed' | 'start.convert.failed'): string =>
  a.sessionId ? t('start.consoleNotOpened', { reason: reasonOf(e, t) }) : t(key, { reason: reasonOf(e, t) })

// ── The coding agent that does the work (D3) ───────────────────────────────

interface Builders {
  rows: ExecutorRow[] | null
  failed: string | null
  chosen: string | null
  /** How the preselection was made: from the fallback order, from what was found, or with the order unread. */
  how: 'order' | 'found' | 'order-unread' | null
  choose(id: string): void
  retry(): void
}

/** The coding agents this machine has, and the one preselected (D3): the fallback order first. */
function useBuilders(): Builders {
  const t = useT()
  const [rows, setRows] = useState<ExecutorRow[] | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [chosen, setChosen] = useState<string | null>(null)
  const [how, setHow] = useState<Builders['how']>(null)
  const [round, setRound] = useState(0)
  useEffect(() => {
    let alive = true
    setFailed(null)
    // A settings read that fails is said beside the choice, not swallowed (0.3.3 verification ER-8).
    const settings = window.fabric.settings.read().then((s) => ({ s, ok: true }), () => ({ s: null, ok: false }))
    Promise.all([window.fabric.start.executors(), settings]).then(
      ([list, read]) => {
        if (!alive) return
        setRows(list)
        const order = read.s?.runnerFallback
        const pick = defaultBuilder(list, order)
        const fromOrder = !!pick && (order?.order ?? []).some((e) => e.runner === pick)
        setChosen((c) => c ?? pick)
        setHow((h) => h ?? (pick ? (fromOrder ? 'order' : read.ok ? 'found' : 'order-unread') : null))
      },
      (e: unknown) => { if (alive) setFailed(reasonOf(e, t)) }
    )
    return () => { alive = false }
  }, [round]) // `t` is stable per locale; a re-read is asked for by `round`
  return { rows, failed, chosen, how, choose: (id) => { setChosen(id); setHow(null) }, retry: () => { setRows(null); setRound((n) => n + 1) } }
}

function BuilderChoice({ builders, disabled }: { builders: Builders; disabled: boolean }): React.JSX.Element {
  const t = useT()
  const { rows, failed, chosen, how, choose, retry } = builders
  if (failed)
    return (
      <div className="lp-callout" role="alert">
        <p>{t('start.builder.failed', { reason: failed })}</p>
        <div className="lp-actions"><button type="button" className="lp-button" onClick={retry}>{t('start.createAgent.retry')}</button></div>
      </div>
    )
  if (!rows) return <p className="lp-meta" aria-busy="true">{t('start.builder.reading')}</p>
  const usable = rows.filter((r) => r.state === 'found')
  const reason = (r: ExecutorRow) => t(`start.builder.${r.state}` as 'start.builder.missing', { name: r.label })
  if (usable.length === 0)
    return (
      <div className="lp-callout" role="status">
        <p>{t(rows.some((r) => r.state === 'unresponsive') ? 'start.builder.noneReady' : 'start.builder.none')}</p>
        {rows.length > 0 && <ul className="st-builder-reasons">{rows.map((r) => <li key={r.id}>{reason(r)}</li>)}</ul>}
        <div className="lp-actions"><button type="button" className="lp-button" onClick={retry}>{t('start.skills.checkAgain')}</button></div>
      </div>
    )
  const hint = [t('start.builder.hint'), how === 'order' ? t('start.builder.fromOrder') : how === 'found' ? t('start.builder.fromFound') : how === 'order-unread' ? t('start.builder.orderUnread') : '']
    .filter(Boolean).join(' ')
  return (
    <div className="lp-field">
      <label htmlFor="start-builder">{t('start.builder.label')}</label>
      <select id="start-builder" aria-describedby="start-builder-hint" value={chosen ?? ''} disabled={disabled} onChange={(e) => choose(e.target.value)}>
        {rows.map((r) => (
          <option key={r.id} value={r.id} disabled={r.state !== 'found'}>
            {r.state === 'found' ? (r.connected ? r.label : t('start.builder.unconnected', { name: r.label })) : reason(r)}
          </option>
        ))}
      </select>
      <small className="lp-meta" id="start-builder-hint">{hint}</small>
    </div>
  )
}

// ── The Fabric Agent Adapter skills (REQ-04) ───────────────────────────────

/** Whether the Fabric Agent Adapter skills are where the chosen agent reads skills (REQ-04). */
function useSkills(agentId: string | null): { view: AdapterSkillsView | null; checking: boolean; failed: string | null; check(): void } {
  const t = useT()
  const [view, setView] = useState<AdapterSkillsView | null>(null)
  const [checking, setChecking] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const round = useRef(0)
  const check = (): void => {
    if (!agentId) return
    const mine = ++round.current
    setView(null) // a result for the previous agent never answers for this one
    setChecking(true)
    setFailed(null)
    window.fabric.start.adapterSkills(agentId).then(
      (v) => { if (mine === round.current) { setView(v); setChecking(false) } },
      (e: unknown) => { if (mine === round.current) { setFailed(reasonOf(e, t)); setChecking(false) } }
    )
  }
  useEffect(() => { check() }, [agentId]) // `check` is re-made each render; the agent is what it depends on
  return { view, checking, failed, check }
}

/** Agents known NOT to read the shared ~/.agents/skills folder: Claude Code reads its plugins and ~/.claude/skills only
 *  (the PassionCode launcher writes nothing else for it — `launcher.js`, read 2026-10-08). For them "shared" is "missing". */
const NOT_READING_SHARED = new Set(['claude-code'])
/** Ready to launch: installed where the agent reads, or — for an agent that may read it — found in the shared folder,
 *  which the screen says rather than hides. */
const skillsAllowStart = (v: AdapterSkillsView | null, agentId: string): boolean =>
  v !== null && (v.ready || (v.where === 'shared' && !NOT_READING_SHARED.has(agentId)))

function SkillsStatus({ skills, agentLabel, agentId }: { skills: ReturnType<typeof useSkills>; agentLabel: string; agentId: string }): React.JSX.Element | null {
  const t = useT()
  const { view, checking, failed, check } = skills
  const again = <div className="lp-actions"><button type="button" className="lp-button" disabled={checking} onClick={check}>{checking ? t('start.skills.checking') : t('start.skills.checkAgain')}</button></div>
  if (failed)
    return <div className="lp-callout" role="alert"><p>{t('start.skills.failed', { reason: failed })}</p>{again}</div>
  if (!view) return checking ? <p className="lp-meta" aria-busy="true">{t('start.skills.checking')}</p> : null
  if (view.ready)
    return <p className="st-skills ok" role="status">{t(view.where === 'plugin' ? 'start.skills.plugin' : 'start.skills.folder', { agent: agentLabel, version: view.version ?? t('start.skills.noVersion') })}</p>
  const unreadable = view.unreadable ?? []
  return (
    <div className="lp-callout" role="status">
      <p>{view.where === 'shared' && !NOT_READING_SHARED.has(agentId) ? t('start.skills.shared', { agent: agentLabel }) : t('start.skills.missing', { agent: agentLabel })}</p>
      {!view.launcherCovers && <p className="lp-meta">{t('start.skills.notCovered', { agent: agentLabel })}</p>}
      <div className="st-install"><code>{view.command}</code><CopyButton text={view.command} /></div>
      {unreadable.length > 0 && (
        <>
          <p className="lp-meta">{t('start.skills.unreadable')}</p>
          <ul className="st-builder-reasons">{unreadable.map((p) => <li key={p}><code>{p}</code></li>)}</ul>
        </>
      )}
      {again}
    </div>
  )
}

/** Why the main button cannot go yet, in words, once it is pressed (0.3.3 verification UX-3). */
function blockedReason(t: Translate, builders: Builders, skills: ReturnType<typeof useSkills>): string | null {
  if (!builders.chosen) return t('start.blocked.agent')
  if (skills.checking || (!skills.view && !skills.failed)) return t('start.blocked.checking')
  if (!skillsAllowStart(skills.view, builders.chosen)) return t('start.blocked.skills')
  return null
}

// ── Create an ecosystem agent (SCN-136) ─────────────────────────────────────

type CreateState = { at: 'form' } | { at: 'creating' } | { at: 'failed'; reason: string }

/** What a Create attempt has made, kept for the window's life: leaving the screen — Back, the sidebar — or the
 *  screen unmounting mid-request does not lose it, so coming back continues the same folder, Project and task
 *  instead of being refused because the folder now exists (0.3.3 verification ER-4, DA-6). */
interface KeptCreate { name: string; purpose: string; parent: string | null; made: string | null; attempt: Attempt; failed: string | null }
let keptCreate: KeptCreate | null = null
/** One attempt per folder, kept for the window's life: the same folder chosen again — after leaving the screen, or
 *  after choosing another — is the same Project and task; another folder is another attempt (ER-4). */
const keptConvert = new Map<string, Attempt>()
/** For tests: a fresh window. */
export function forgetAgentAttempts(): void { keptCreate = null; keptConvert.clear() }

export function CreateAgent({ onBack, onStarted }: { onBack(): void; onStarted(projectId: string): void }): React.JSX.Element {
  const t = useT()
  const kept = keptCreate
  const [name, setName] = useState(kept?.name ?? '')
  const [purpose, setPurpose] = useState(kept?.purpose ?? '')
  const [parent, setParent] = useState<string | null>(kept?.parent ?? null)
  const [touched, setTouched] = useState(false)
  const [folderProblem, setFolderProblem] = useState<string | null>(null)
  const [pickFailed, setPickFailed] = useState<string | null>(null)
  const [s, setS] = useState<CreateState>(kept?.failed ? { at: 'failed', reason: kept.failed } : { at: 'form' })
  const builders = useBuilders()
  const skills = useSkills(builders.chosen)
  const attempt = useRef<Attempt>(kept?.attempt ?? newAttempt())
  // The folder this attempt made. Once it exists the name, the sentence and the place are fixed — the Project and the
  // task are recorded with them, and a retry continues with all three; «Start over» is the only way to different
  // ones, and says the made folder (and its Project, once made) stays.
  const [made, setMade] = useState<string | null>(kept?.made ?? null)
  const nameRef = useRef<HTMLInputElement>(null)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const busy = s.at === 'creating'
  const nameIssue = folderNameProblem(name.trim())
  const nameProblem = nameIssue === 'empty' ? t('start.createAgent.nameEmpty') : nameIssue ? t('start.createAgent.nameInvalid', { detail: t(`onboarding.newFolder.problem.${nameIssue}` as 'onboarding.newFolder.problem.empty') }) : null
  const purposeProblem = purpose.trim() ? null : t('start.createAgent.purposeEmpty')
  const label = builders.rows?.find((r) => r.id === builders.chosen)?.label ?? ''
  const path = made ?? (parent && !nameProblem ? `${parent.replace(/\/$/, '')}/${name.trim()}` : null)
  const blocked = blockedReason(t, builders, skills)
  const ready = !nameProblem && !purposeProblem && !!parent && blocked === null

  const keep = (patch: Partial<KeptCreate>): void => {
    keptCreate = { name: name.trim(), purpose: purpose.trim(), parent, made, attempt: attempt.current, failed: null, ...keptCreate, ...patch }
  }
  const choose = async (): Promise<void> => {
    setPickFailed(null)
    try {
      const picked = await window.fabric.start.chooseFolder('parent')
      if (picked) { setParent(picked); setFolderProblem(null) }
    } catch (e) { setPickFailed(t('start.pickFailed', { reason: reasonOf(e, t) })) }
  }
  const startOver = (): void => {
    attempt.current = newAttempt()
    keptCreate = null
    setMade(null)
    setS({ at: 'form' })
    nameRef.current?.focus()
  }
  /** The chosen coding agent failed to start: a new task in the same Project and folder, with another agent (ER-3). */
  const anotherAgent = (): void => {
    attempt.current = { ...attempt.current, taskId: newId(), sessionId: null, launched: false }
    keep({ attempt: attempt.current, failed: null })
    setS({ at: 'form' })
  }
  const create = async (): Promise<void> => {
    setTouched(true)
    if (busy || !ready || !parent || !builders.chosen) return
    setS({ at: 'creating' })
    setFolderProblem(null)
    const a = attempt.current
    try {
      let folder = made
      if (!folder) {
        const result = await window.fabric.start.createFolder({ parent, name: name.trim(), git: true })
        if (!result.ok) {
          if (!alive.current) return
          setFolderProblem(t(`start.new.refused.${result.reason}` as 'start.new.refused.exists', { detail: result.detail ?? '' }))
          setS({ at: 'form' })
          nameRef.current?.focus() // the field to change is the name (UX-10)
          return
        }
        folder = result.path
        keep({ made: folder, attempt: a })
        if (alive.current) setMade(folder)
      }
      const project = await window.fabric.projects.create({ id: a.projectId, name: name.trim(), purpose: purpose.trim(), repoPaths: [folder] })
      a.projectMade = true
      await launch(a, project.id, t('start.createAgent.instruction', { name: name.trim(), purpose: purpose.trim() }), builders.chosen, 'create-agent')
      keptCreate = null
      // The console window is already forward; a screen the person has since left does not pull them back.
      if (alive.current) onStarted(project.id)
    } catch (e) {
      const reason = failure(a, e, t, 'start.createAgent.failed')
      if (keptCreate) keep({ failed: reason, attempt: a })
      if (alive.current) setS({ at: 'failed', reason })
    }
  }
  const shown = (problem: string | null) => (touched || name !== '' ? problem : null)

  return (
    <div className="lp st" data-launch-view="start-create-agent">
      <Heading kicker={t('start.kicker.agent')} title={t('start.createAgent.title')} lede={t('start.createAgent.lede')} back={{ label: t('start.back'), onClick: onBack, disabled: busy }} />
      <section className="lp-panel st-step">
        {s.at === 'failed' && (
          <div className="lp-callout" role="alert">
            <p>{s.reason}</p>
            {made && <p className="lp-meta">{t(attempt.current.projectMade ? 'start.createAgent.madeKept' : 'start.createAgent.madeKeptFolder', { path: made })}</p>}
            {attempt.current.launched && !attempt.current.sessionId && (
              <div className="lp-actions">
                <button type="button" className="lp-button" onClick={anotherAgent}>{t('start.builder.another')}</button>
                <small className="lp-meta">{t('start.builder.anotherNote')}</small>
              </div>
            )}
          </div>
        )}
        {/* Hints sit outside the label and are tied by aria-describedby, so a field's name is its label alone. */}
        <div className="lp-field">
          <label htmlFor="start-agent-name">{t('start.createAgent.name')}</label>
          <input id="start-agent-name" ref={nameRef} aria-describedby="start-agent-name-hint" aria-invalid={!!shown(nameProblem) || !!folderProblem} value={name} maxLength={80} disabled={busy || !!made} onChange={(e) => { setName(e.target.value); setFolderProblem(null) }} />
          {shown(nameProblem) ? <small className="field-problem" id="start-agent-name-hint">{shown(nameProblem)}</small> : <small className="lp-meta" id="start-agent-name-hint">{t('start.createAgent.nameHint')}</small>}
          {folderProblem && <small className="field-problem" role="alert">{folderProblem}</small>}
        </div>
        <div className="lp-field">
          <label htmlFor="start-agent-purpose">{t('start.createAgent.purpose')}</label>
          <input id="start-agent-purpose" aria-describedby={touched && purposeProblem ? 'start-agent-purpose-problem' : undefined} aria-invalid={touched && !!purposeProblem} value={purpose} maxLength={240} disabled={busy || !!made} onChange={(e) => setPurpose(e.target.value)} placeholder={t('start.createAgent.purposeExample')} />
          {touched && purposeProblem && <small className="field-problem" id="start-agent-purpose-problem">{purposeProblem}</small>}
        </div>
        <div className="lp-field" role="group" aria-labelledby="start-agent-where">
          <span id="start-agent-where">{t('start.createAgent.where')}</span>
          {!made && (
            <div className="lp-actions">
              <button type="button" className="lp-button" disabled={busy} onClick={() => void choose()}>{parent ? t('start.createAgent.whereChange') : t('start.createAgent.whereChoose')}</button>
            </div>
          )}
          {path && <small className="lp-meta">{t(made ? 'start.createAgent.made' : 'start.createAgent.path')} <code>{path}</code></small>}
          {touched && !parent && <small className="field-problem">{t('start.createAgent.whereEmpty')}</small>}
          {pickFailed && <small className="field-problem" role="alert">{pickFailed}</small>}
        </div>
        <BuilderChoice builders={builders} disabled={busy || attempt.current.launched} />
        {builders.chosen && <SkillsStatus skills={skills} agentLabel={label} agentId={builders.chosen} />}
        <div className="lp-actions">
          {/* aria-disabled, not disabled: the button keeps focus while it works, and a press says what is missing. */}
          <button type="button" className="lp-button primary" aria-disabled={busy || !ready} aria-busy={busy} onClick={() => void create()}>
            {busy ? t('start.createAgent.creating') : made ? t('start.createAgent.retry') : t('start.createAgent.create')}
          </button>
          {made && <button type="button" className="lp-button" disabled={busy} onClick={startOver}>{t('start.createAgent.startOver')}</button>}
        </div>
        {touched && !busy && blocked && <p className="field-problem" role="status">{blocked}</p>}
        <p className="lp-meta">{t('start.createAgent.what')}</p>
      </section>
    </div>
  )
}

// ── Adapt an existing agent (SCN-131) ───────────────────────────────────────

type ConvertState =
  | { at: 'idle' }
  | { at: 'reading'; folder: string }
  | { at: 'ready'; facts: FolderView }
  | { at: 'starting'; facts: FolderView }
  | { at: 'failed'; reason: string; facts: FolderView | null }

export function ConvertAgent({ onBack, onStarted }: { onBack(): void; onStarted(projectId: string): void }): React.JSX.Element {
  const t = useT()
  const locale = useLocale()
  const [s, setS] = useState<ConvertState>({ at: 'idle' })
  const [touched, setTouched] = useState(false)
  const builders = useBuilders()
  const skills = useSkills(builders.chosen)
  const attempt = useRef<Attempt>(newAttempt())
  const factsRef = useRef<HTMLDivElement>(null)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const label = builders.rows?.find((r) => r.id === builders.chosen)?.label ?? ''
  const facts = s.at === 'ready' || s.at === 'starting' ? s.facts : s.at === 'failed' ? s.facts : null
  const busy = s.at === 'starting' || s.at === 'reading'
  const blocked = blockedReason(t, builders, skills)

  const choose = async (): Promise<void> => {
    let folder: string | null
    try { folder = await window.fabric.start.chooseFolder('project') } catch (e) {
      setS({ at: 'failed', reason: t('start.pickFailed', { reason: reasonOf(e, t) }), facts: null })
      return
    }
    if (!folder) return
    setS({ at: 'reading', folder })
    try {
      const read = await window.fabric.start.inspect(folder)
      // Keyed by the folder as read (its resolved path), so the same folder is the same attempt however it was picked.
      attempt.current = keptConvert.get(read.path) ?? newAttempt()
      keptConvert.set(read.path, attempt.current)
      if (!alive.current) return
      setS({ at: 'ready', facts: read })
      setTouched(false)
      requestAnimationFrame(() => factsRef.current?.focus()) // focus goes to what arrived, not to the page (UX-10)
    } catch (e) {
      if (alive.current) setS({ at: 'failed', reason: explainError(e, t), facts: null })
    }
  }
  const anotherAgent = (f: FolderView): void => {
    attempt.current = { ...attempt.current, taskId: newId(), sessionId: null, launched: false }
    keptConvert.set(f.path, attempt.current)
    setS({ at: 'ready', facts: f })
  }
  const start = async (f: FolderView): Promise<void> => {
    setTouched(true)
    if (busy || blocked || !builders.chosen) return
    setS({ at: 'starting', facts: f })
    const a = attempt.current
    try {
      // A folder already held by a Project adapts there; no second Project for the same folder (ADR-0100 §2).
      const id = f.importedBy[0]?.id ?? (await window.fabric.projects.create({ id: a.projectId, name: f.name, purpose: purposeFrom(f, t), repoPaths: [f.path] })).id
      a.projectMade = true
      await launch(a, id, t('start.convertAgent.instruction'), builders.chosen, 'adapt-agent')
      keptConvert.delete(f.path)
      if (alive.current) onStarted(id)
    } catch (e) {
      if (alive.current) setS({ at: 'failed', reason: failure(a, e, t, 'start.convert.failed'), facts: f })
    }
  }
  const steps = [1, 2, 3, 4] as const

  return (
    <div className="lp st" data-launch-view="start-convert">
      <Heading kicker={t('start.kicker.agent')} title={t('start.convert.title')} lede={t('start.convert.lede')} back={{ label: t('start.back'), onClick: onBack, disabled: s.at === 'starting' }} />
      <section className="lp-panel st-step">
        {s.at === 'failed' && (
          <div className="lp-callout" role="alert">
            <p>{s.reason}</p>
            {s.facts && attempt.current.launched && !attempt.current.sessionId && (
              <div className="lp-actions">
                <button type="button" className="lp-button" onClick={() => anotherAgent(s.facts!)}>{t('start.builder.another')}</button>
                <small className="lp-meta">{t('start.builder.anotherNote')}</small>
              </div>
            )}
          </div>
        )}
        <ol className="st-steps">
          {steps.map((n) => (
            <li key={n}><b>{t(`start.convert.step${n}` as 'start.convert.step1')}</b><span>{t(`start.convert.step${n}.body` as 'start.convert.step1.body')}</span></li>
          ))}
        </ol>
        {!facts && (
          <div className="lp-actions">
            <button type="button" className="lp-button primary" disabled={busy} aria-busy={s.at === 'reading'} onClick={() => void choose()}>
              {s.at === 'reading' ? t('start.convert.reading') : t('start.convert.choose')}
            </button>
          </div>
        )}
        {facts && (
          <div ref={factsRef} tabIndex={-1} className="st-facts" aria-label={facts.name}>
            {facts.importedBy.length > 0 && <div className="lp-callout" role="status"><p>{t('start.convert.already', { name: facts.importedBy[0].name })}</p></div>}
            {!facts.git && <div className="lp-callout" role="status"><p>{t('start.convert.notGit')}</p></div>}
            <FolderFactsList f={facts} t={t} locale={locale} />
            <BuilderChoice builders={builders} disabled={s.at === 'starting' || attempt.current.launched} />
            {builders.chosen && <SkillsStatus skills={skills} agentLabel={label} agentId={builders.chosen} />}
            <div className="lp-actions">
              <button type="button" className="lp-button primary" aria-disabled={s.at === 'starting' || blocked !== null} aria-busy={s.at === 'starting'} onClick={() => void start(facts)}>
                {s.at === 'starting' ? t('start.convert.starting') : t('start.convert.start')}
              </button>
              <button type="button" className="lp-button" disabled={s.at === 'starting'} onClick={() => void choose()}>{t('start.convert.other')}</button>
            </div>
            {touched && s.at !== 'starting' && blocked && <p className="field-problem" role="status">{blocked}</p>}
            <p className="lp-meta">{t('start.convert.nothingWritten')}</p>
          </div>
        )}
      </section>
    </div>
  )
}
// #endregion agent-paths

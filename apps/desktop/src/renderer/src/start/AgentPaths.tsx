// #region agent-paths — docs: docs/ux/scenarios.md#scn-136-create-an-ecosystem-agent
// The two agent actions of the onboarding (0.3.3, SCN-136 and SCN-131; SCR-74, SCR-75): create an ecosystem agent,
// and turn one built elsewhere into one. Fabric's part is the folder, the Project, the readiness of the Fabric
// Agent Adapter skills and the launch; the work — the questions, the plan, the code — happens in the console of
// the coding agent the operator chooses (ADR-0123). Nothing is created or started before the explicit button, and a
// retry after a failure reuses the same ids, so it never makes a second folder, Project or task.

import { useEffect, useRef, useState } from 'react'
import { defaultBuilder } from '../../../shared/builderChoice.ts'
import { folderNameProblem, type AdapterSkillsView, type ExecutorRow, type FolderView } from '../../../shared/startPaths.ts'
import { useLocale, useT } from '../i18n'
import { CopyButton, FolderFactsList, Heading, explainError } from './startParts'

const newId = (): string => crypto.randomUUID()

/** One attempt's identity: chosen before the first try and reused by every retry of it, so a retry is the same
 *  Project, the same task and — once started — the same session, never a second of any (verifier, 0.3.3). */
interface Attempt { projectId: string; taskId: string; sessionId: string | null; launched: boolean }
const newAttempt = (): Attempt => ({ projectId: newId(), taskId: newId(), sessionId: null, launched: false })

/** Start the coding agent in the Project's folder with the instruction, then bring its console forward. A session
 *  this attempt already started is only brought forward again. */
async function launch(a: Attempt, projectId: string, instruction: string, optionId: string, preset: 'create-agent' | 'adapt-agent'): Promise<void> {
  // From the first launch on, the task may be recorded with this coding agent, so the choice is fixed for the attempt.
  a.launched = true
  if (!a.sessionId) a.sessionId = (await window.fabric.tasks.start({ projectId, taskId: a.taskId, instruction, optionId, preset })).session.sessionId
  await window.fabric.windows.openSession(a.sessionId)
}

/** The coding agents this machine has, and the one preselected (D3): the fallback order first. */
function useBuilders(): { rows: ExecutorRow[] | null; failed: string | null; chosen: string | null; choose(id: string): void } {
  const [rows, setRows] = useState<ExecutorRow[] | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [chosen, setChosen] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    Promise.all([window.fabric.start.executors(), window.fabric.settings.read().catch(() => null)]).then(
      ([list, settings]) => {
        if (!alive) return
        setRows(list)
        setChosen((c) => c ?? defaultBuilder(list, settings?.runnerFallback))
      },
      (e: unknown) => alive && setFailed(String(e instanceof Error ? e.message : e))
    )
    return () => { alive = false }
  }, [])
  return { rows, failed, chosen, choose: setChosen }
}

function BuilderChoice({ rows, failed, chosen, choose, disabled }: ReturnType<typeof useBuilders> & { disabled: boolean }): React.JSX.Element {
  const t = useT()
  if (failed) return <p className="read-failed" role="alert">{t('start.builder.failed', { reason: failed })}</p>
  if (!rows) return <p className="lp-meta" aria-busy="true">{t('start.builder.reading')}</p>
  const usable = rows.filter((r) => r.state === 'found')
  const reason = (r: ExecutorRow) => t(`start.builder.${r.state}` as 'start.builder.missing', { name: r.label })
  if (usable.length === 0)
    return (
      <div className="lp-callout" role="status">
        <p>{t(rows.some((r) => r.state === 'unresponsive') ? 'start.builder.noneReady' : 'start.builder.none')}</p>
        {rows.length > 0 && <ul className="st-builder-reasons">{rows.map((r) => <li key={r.id}>{reason(r)}</li>)}</ul>}
      </div>
    )
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
      <small className="lp-meta" id="start-builder-hint">{t('start.builder.hint')}</small>
    </div>
  )
}

/** Whether the Fabric Agent Adapter skills are where the chosen agent reads skills (REQ-04). */
function useSkills(agentId: string | null): { view: AdapterSkillsView | null; checking: boolean; failed: string | null; check(): void } {
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
      (e: unknown) => { if (mine === round.current) { setFailed(String(e instanceof Error ? e.message : e)); setChecking(false) } }
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
  if (failed) return <p className="read-failed" role="alert">{t('start.skills.failed', { reason: failed })}</p>
  if (!view) return checking ? <p className="lp-meta" aria-busy="true">{t('start.skills.checking')}</p> : null
  if (view.ready)
    return <p className="st-skills ok" role="status">{t(view.where === 'plugin' ? 'start.skills.plugin' : 'start.skills.folder', { agent: agentLabel, version: view.version ?? t('start.skills.noVersion') })}</p>
  return (
    <div className="lp-callout" role="status">
      <p>{view.where === 'shared' && !NOT_READING_SHARED.has(agentId) ? t('start.skills.shared', { agent: agentLabel }) : t('start.skills.missing', { agent: agentLabel })}</p>
      {!view.launcherCovers && <p className="lp-meta">{t('start.skills.notCovered', { agent: agentLabel })}</p>}
      <div className="st-install"><code>{view.command}</code><CopyButton text={view.command} /></div>
      <div className="lp-actions"><button type="button" className="lp-button" disabled={checking} onClick={check}>{checking ? t('start.skills.checking') : t('start.skills.checkAgain')}</button></div>
    </div>
  )
}

// ── Create an ecosystem agent (SCN-136) ─────────────────────────────────────

type CreateState = { at: 'form' } | { at: 'creating' } | { at: 'failed'; reason: string }

export function CreateAgent({ onBack, onStarted }: { onBack(): void; onStarted(projectId: string): void }): React.JSX.Element {
  const t = useT()
  const [name, setName] = useState('')
  const [purpose, setPurpose] = useState('')
  const [parent, setParent] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)
  const [folderProblem, setFolderProblem] = useState<string | null>(null)
  const [s, setS] = useState<CreateState>({ at: 'form' })
  const builders = useBuilders()
  const skills = useSkills(builders.chosen)
  const attempt = useRef<Attempt>(newAttempt())
  // The folder this attempt made. Once it exists the name, the sentence and the place are fixed — the Project and the
  // task are recorded with them, and a retry continues with all three; and
  // «Start over» is the only way to a different one — and says the made folder stays on disk.
  const [made, setMade] = useState<string | null>(null)
  const busy = s.at === 'creating'
  const nameIssue = folderNameProblem(name.trim())
  const nameProblem = nameIssue === 'empty' ? t('start.createAgent.nameEmpty') : nameIssue ? t('start.createAgent.nameInvalid', { detail: t(`onboarding.newFolder.problem.${nameIssue}` as 'onboarding.newFolder.problem.empty') }) : null
  const purposeProblem = purpose.trim() ? null : t('start.createAgent.purposeEmpty')
  const label = builders.rows?.find((r) => r.id === builders.chosen)?.label ?? ''
  const path = made ?? (parent && !nameProblem ? `${parent.replace(/\/$/, '')}/${name.trim()}` : null)
  const ready = !nameProblem && !purposeProblem && !!parent && !!builders.chosen && skillsAllowStart(skills.view, builders.chosen)

  const choose = async (): Promise<void> => {
    const picked = await window.fabric.start.chooseFolder('parent').catch(() => null)
    if (picked) { setParent(picked); setFolderProblem(null) }
  }
  const startOver = (): void => {
    attempt.current = newAttempt()
    setMade(null)
    setS({ at: 'form' })
  }
  const create = async (): Promise<void> => {
    setTouched(true)
    if (!ready || !parent || !builders.chosen) return
    setS({ at: 'creating' })
    setFolderProblem(null)
    try {
      let folder = made
      if (!folder) {
        const result = await window.fabric.start.createFolder({ parent, name: name.trim(), git: true })
        if (!result.ok) {
          setFolderProblem(t(`start.new.refused.${result.reason}` as 'start.new.refused.exists', { detail: result.detail ?? '' }))
          setS({ at: 'form' })
          return
        }
        folder = result.path
        setMade(folder)
      }
      const project = await window.fabric.projects.create({ id: attempt.current.projectId, name: name.trim(), purpose: purpose.trim(), repoPaths: [folder] })
      await launch(attempt.current, project.id, t('start.createAgent.instruction', { name: name.trim(), purpose: purpose.trim() }), builders.chosen, 'create-agent')
      onStarted(project.id)
    } catch (e) {
      setS({ at: 'failed', reason: explainError(e, t) })
    }
  }
  const shown = (problem: string | null) => (touched || name !== '' ? problem : null)

  return (
    <div className="lp st" data-launch-view="start-create-agent">
      <Heading kicker={t('start.kicker.agent')} title={t('start.createAgent.title')} lede={t('start.createAgent.lede')} back={{ label: t('start.back'), onClick: onBack, disabled: busy }} />
      <section className="lp-panel st-step">
        {s.at === 'failed' && (
          <div className="lp-callout" role="alert">
            <p>{t('start.createAgent.failed', { reason: s.reason })}</p>
            {made && <p className="lp-meta">{t('start.createAgent.madeKept', { path: made })}</p>}
          </div>
        )}
        {/* Hints sit outside the label and are tied by aria-describedby, so a field's name is its label alone. */}
        <div className="lp-field">
          <label htmlFor="start-agent-name">{t('start.createAgent.name')}</label>
          <input id="start-agent-name" aria-describedby="start-agent-name-hint" aria-invalid={!!shown(nameProblem)} value={name} maxLength={80} disabled={busy || !!made} onChange={(e) => { setName(e.target.value); setFolderProblem(null) }} />
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
        </div>
        <BuilderChoice {...builders} disabled={busy || attempt.current.launched} />
        {builders.chosen && <SkillsStatus skills={skills} agentLabel={label} agentId={builders.chosen} />}
        <div className="lp-actions">
          <button type="button" className="lp-button primary" disabled={busy} aria-disabled={!ready} onClick={() => void create()}>
            {busy ? t('start.createAgent.creating') : made ? t('start.createAgent.retry') : t('start.createAgent.create')}
          </button>
          {made && <button type="button" className="lp-button" disabled={busy} onClick={startOver}>{t('start.createAgent.startOver')}</button>}
        </div>
        <p className="lp-meta">{t('start.createAgent.what')}</p>
      </section>
    </div>
  )
}

// ── Turn an existing agent into an ecosystem agent (SCN-131) ────────────────

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
  const builders = useBuilders()
  const skills = useSkills(builders.chosen)
  // One attempt per chosen folder: another folder is another Project, another task, another session.
  const attempt = useRef<Attempt>(newAttempt())
  const label = builders.rows?.find((r) => r.id === builders.chosen)?.label ?? ''
  const facts = s.at === 'ready' || s.at === 'starting' ? s.facts : s.at === 'failed' ? s.facts : null
  const busy = s.at === 'starting' || s.at === 'reading'

  const choose = async (): Promise<void> => {
    const folder = await window.fabric.start.chooseFolder('project').catch(() => null)
    if (!folder) return
    attempt.current = newAttempt()
    setS({ at: 'reading', folder })
    try {
      setS({ at: 'ready', facts: await window.fabric.start.inspect(folder) })
    } catch (e) {
      setS({ at: 'failed', reason: explainError(e, t), facts: null })
    }
  }
  const start = async (f: FolderView): Promise<void> => {
    if (!builders.chosen || !skillsAllowStart(skills.view, builders.chosen)) return
    setS({ at: 'starting', facts: f })
    try {
      // A folder already held by a Project adapts there; no second Project for the same folder (ADR-0100 §2).
      const id = f.importedBy[0]?.id ?? (await window.fabric.projects.create({ id: attempt.current.projectId, name: f.name, purpose: f.summary ?? undefined, repoPaths: [f.path] })).id
      await launch(attempt.current, id, t('start.convertAgent.instruction'), builders.chosen, 'adapt-agent')
      onStarted(id)
    } catch (e) {
      setS({ at: 'failed', reason: explainError(e, t), facts: f })
    }
  }
  const steps = [1, 2, 3, 4] as const

  return (
    <div className="lp st" data-launch-view="start-convert">
      <Heading kicker={t('start.kicker.agent')} title={t('start.convert.title')} lede={t('start.convert.lede')} back={{ label: t('start.back'), onClick: onBack, disabled: s.at === 'starting' }} />
      <section className="lp-panel st-step">
        {s.at === 'failed' && <div className="lp-callout" role="alert"><p>{t('start.convert.failed', { reason: s.reason })}</p></div>}
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
          <>
            {facts.importedBy.length > 0 && <div className="lp-callout" role="status"><p>{t('start.convert.already', { name: facts.importedBy[0].name })}</p></div>}
            {!facts.git && <div className="lp-callout" role="status"><p>{t('start.convert.notGit')}</p></div>}
            <FolderFactsList f={facts} t={t} locale={locale} />
            <BuilderChoice {...builders} disabled={s.at === 'starting' || attempt.current.launched} />
            {builders.chosen && <SkillsStatus skills={skills} agentLabel={label} agentId={builders.chosen} />}
            <div className="lp-actions">
              <button type="button" className="lp-button primary" disabled={s.at === 'starting' || !builders.chosen || !skillsAllowStart(skills.view, builders.chosen)} onClick={() => void start(facts)}>
                {s.at === 'starting' ? t('start.convert.starting') : t('start.convert.start')}
              </button>
              <button type="button" className="lp-button" disabled={s.at === 'starting'} onClick={() => void choose()}>{t('start.convert.other')}</button>
            </div>
            <p className="lp-meta">{t('start.convert.nothingWritten')}</p>
          </>
        )}
      </section>
    </div>
  )
}
// #endregion agent-paths

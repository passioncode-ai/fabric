// #region cross-project-console — docs: docs/ux/2026-10-26-simple-fabric.md#5-work-that-needs-another-project
/**
 * «Нужна правка в другом проекте» on a task page (0.3.14, the simple Fabric, docs/ux/2026-10-26-simple-fabric.md §5,
 * its first way; the operator: «либо открыть консоль с агентом внутри этого проекта»). The person names project B and one
 * sentence of what is needed; «Открыть консоль в B» starts B's coding agent through Fabric's own console start
 * (`terminal.open(projectId, optionId, firstInstruction)`, B's default agent) with that sentence and the way back to this
 * task as the first instruction, opens it as a tab, and leaves a note in this task. The second way, «Поручить агенту B
 * в Fabric», is 0.3.15's and is not offered here. The 0.3.14 review, iteration 2: a project with no repository says the
 * agent starts in the home folder and takes a second press (ER-14, as UXA-C04's launchers do); a project of another
 * recorded business is refused, so this task's words never reach it (DA-6); a started console is remembered, its task
 * noted even when its tab fails, and never started twice by a second press (ER-15, UX-15). Iteration 3: every started
 * console is kept by project and sentence (ER-26), and a started one is said as one session, its unsaved note on a line of
 * its own (ER-25, UX-23).
 */
import { useState } from 'react'
import type { ProjectRow } from '../../../shared/types'
import { nameCollator } from '../../../shared/railProjects.ts'
import { useLocale, useT } from '../i18n'
import { useOpenConsole } from '../consoles'
import { FailureNote } from '../OperatorError'
import { launchPlace } from '../../../shared/launchPlace.ts'

/** A project's recorded business, compared as the board compares it (case and surrounding spaces aside); null: none. */
const businessOf = (p: { business?: string | null }): string | null => (p.business?.trim() ? p.business.trim().toLowerCase() : null)

/** A console this panel started: its session, whether its tab opened and its task note was saved, and when. */
type Started = { sessionId: string; name: string; tabFailed: string | null; noted: boolean; home: boolean; at: string }

type Projects = { at: 'idle' } | { at: 'reading' } | { at: 'ready'; rows: ProjectRow[] } | { at: 'failed'; says: string }

export function CrossProjectConsole({ project, taskId, taskTitle }: { project: ProjectRow; taskId: string; taskTitle: string }): React.JSX.Element {
  const t = useT(), locale = useLocale()
  const showConsole = useOpenConsole()
  const [projects, setProjects] = useState<Projects>({ at: 'idle' })
  const [target, setTarget] = useState('')
  const [what, setWhat] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  // ER-15, UX-15: a console started for a project and sentence is never started twice by a second press. The 0.3.14
  // review, iteration 3, ER-26: every console this panel started is kept by its project and sentence, not only the last,
  // so picking A again after B shows A's running session instead of starting a second agent there.
  const [started, setStarted] = useState<Record<string, Started>>({})
  // ER-14: a project with no repository starts its agent in the home folder: said first, and a second press confirms.
  const [homeAck, setHomeAck] = useState<string | null>(null)
  const read = (): void => {
    if (projects.at !== 'idle' && projects.at !== 'failed') return
    setProjects({ at: 'reading' })
    Promise.resolve().then(() => window.fabric.projects.list()).then(
      (rows) => {
        const collator = nameCollator(locale)
        setProjects({ at: 'ready', rows: rows.filter((p) => p.id !== project.id && p.status !== 'archived').sort((a, b) => collator.compare(a.name, b.name)) })
      },
      (e: unknown) => setProjects({ at: 'failed', says: e instanceof Error ? e.message : String(e) })
    )
  }
  const chosen = projects.at === 'ready' ? (projects.rows.find((p) => p.id === target) ?? null) : null
  const sentence = what.replace(/\s+/g, ' ').trim()
  const key = chosen ? `${chosen.id}|${sentence}` : ''
  const place = chosen ? launchPlace(chosen.repo_path) : null
  // DA-6: the board walls threads between two recorded businesses (`main/boardService.ts#businessesJoined`); this door
  // walls them too: this task's title, id and project name are not carried into another business's agent.
  const wall = chosen && businessOf(project) && businessOf(chosen) && businessOf(project) !== businessOf(chosen) ? chosen : null
  const current = key ? started[key] : undefined
  const alreadyStarted = !!current
  const remember = (k: string, s: Started): void => setStarted((all) => ({ ...all, [k]: s }))
  const noteIt = (name: string): Promise<boolean> =>
    window.fabric.tasks.note(taskId, t('xp.note', { project: name, what: sentence })).then(() => true, () => false)
  const open = async (): Promise<void> => {
    if (!chosen || !sentence || busy || wall || alreadyStarted) return
    if (place?.place === 'home' && homeAck !== key) { setHomeAck(key); return }
    setBusy(true)
    setFailed(null)
    let session: { sessionId: string } | null = null
    try {
      const first = t('xp.instruction', { what: sentence, task: taskTitle, project: project.name, taskId })
      session = await window.fabric.terminal.open(chosen.id, chosen.default_agent, first)
    } catch (e) {
      setFailed(e instanceof Error ? e.message : String(e))
      setBusy(false)
      return
    }
    // From here the agent runs: the task is noted whatever happens to its tab, and the session is remembered.
    let tabFailed: string | null = null
    try {
      await showConsole(session.sessionId)
    } catch (e) {
      tabFailed = e instanceof Error ? e.message : String(e)
    }
    const noted = await noteIt(chosen.name)
    remember(key, { sessionId: session.sessionId, name: chosen.name, tabFailed, noted, home: place?.place === 'home',
      at: new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })
    setBusy(false)
  }
  // UX-23: once the tab opens, the form says the console is open, as after a first press that opened it.
  const showAgain = async (): Promise<void> => {
    if (!current) return
    const k = key
    try {
      await showConsole(current.sessionId)
      remember(k, { ...current, tabFailed: null })
    } catch (e) {
      remember(k, { ...current, tabFailed: e instanceof Error ? e.message : String(e) })
    }
  }
  return (
    <details className="lp-panel xp" onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) read() }}>
      <summary>{t('xp.title')}</summary>
      <p className="lp-meta">{t('xp.lede')}</p>
      {projects.at === 'reading' && <p className="lp-meta" role="status">{t('rail.projects.reading')}</p>}
      {projects.at === 'failed' && (
        <>
          <FailureNote said={t('xp.unread')} detail={projects.says} />
          <button type="button" className="lp-button" onClick={read}>{t('common.retry')}</button>
        </>
      )}
      {projects.at === 'ready' && (
        <div className="xp-form">
          <label className="lp-field">
            {t('xp.project')}
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">{t('xp.pick')}</option>
              {projects.rows.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="lp-field">
            {t('xp.what')}
            <input type="text" value={what} maxLength={300} onChange={(e) => setWhat(e.target.value)} />
          </label>
          {wall && <p className="lp-meta" role="alert">{t('xp.wall', { project: wall.name })}</p>}
          {!wall && place?.place === 'home' && <p className="lp-meta" role={homeAck === key ? 'alert' : undefined}>{t('xp.home', { project: chosen!.name })}</p>}
          <button type="button" className="lp-button primary" disabled={!chosen || !sentence || busy || !!wall || alreadyStarted} aria-busy={busy} onClick={() => void open()}>
            {chosen ? t(place?.place === 'home' && homeAck === key ? 'xp.openHome' : 'xp.open', { project: chosen.name }) : t('xp.openNoProject')}
          </button>
        </div>
      )}
      {/* «Консоль не открылась» only when no agent started; once one runs, the panel speaks of that session alone. */}
      {failed && !current && <FailureNote said={t('xp.failed')} detail={failed} />}
      {current?.tabFailed && <FailureNote said={t('xp.tabFailed', { project: current.name })} detail={current.tabFailed} />}
      {current && !current.tabFailed && <p className="lp-meta" role="status">{t(current.home ? 'xp.doneHome' : 'xp.done', { project: current.name, time: current.at })}</p>}
      {/* ER-25, UX-23: a note that was not saved is its own line, never the detail of «Консоль не открылась». */}
      {current && !current.noted && <p className="lp-meta" role="alert">{t('xp.noteFailed')}</p>}
      {current && <button type="button" className="lp-button" onClick={() => void showAgain()}>{t('agentScreen.openSession')}</button>}
    </details>
  )
}
// #endregion cross-project-console

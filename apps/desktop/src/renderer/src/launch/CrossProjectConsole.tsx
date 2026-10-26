// #region cross-project-console — docs: docs/ux/2026-10-26-simple-fabric.md#5-work-that-needs-another-project
/**
 * «Нужна правка в другом проекте» on a task page (0.3.14, the simple Fabric, docs/ux/2026-10-26-simple-fabric.md §5,
 * its first way; the operator: «либо открыть консоль с агентом внутри этого проекта»). The person names project B and one
 * sentence of what is needed; «Открыть консоль в B» starts B's coding agent through Fabric's own console start
 * (`terminal.open(projectId, optionId, firstInstruction)`, B's default agent) with that sentence and the way back to this
 * task as the first instruction, opens it as a tab, and leaves a note in this task. The second way, «Поручить агенту B
 * в Fabric», is 0.3.15's and is not offered here.
 */
import { useState } from 'react'
import type { ProjectRow } from '../../../shared/types'
import { nameCollator } from '../../../shared/railProjects.ts'
import { useLocale, useT } from '../i18n'
import { useOpenConsole } from '../consoles'
import { FailureNote } from '../OperatorError'

type Projects = { at: 'idle' } | { at: 'reading' } | { at: 'ready'; rows: ProjectRow[] } | { at: 'failed'; says: string }

export function CrossProjectConsole({ project, taskId, taskTitle }: { project: ProjectRow; taskId: string; taskTitle: string }): React.JSX.Element {
  const t = useT(), locale = useLocale()
  const showConsole = useOpenConsole()
  const [projects, setProjects] = useState<Projects>({ at: 'idle' })
  const [target, setTarget] = useState('')
  const [what, setWhat] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const [done, setDone] = useState<{ name: string; at: string; noted: boolean } | null>(null)
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
  const open = async (): Promise<void> => {
    if (!chosen || !sentence || busy) return
    setBusy(true)
    setFailed(null)
    setDone(null)
    try {
      const first = t('xp.instruction', { what: sentence, task: taskTitle, project: project.name, taskId })
      const session = await window.fabric.terminal.open(chosen.id, chosen.default_agent, first)
      await showConsole(session.sessionId)
      const noted = await window.fabric.tasks.note(taskId, t('xp.note', { project: chosen.name, what: sentence })).then(() => true, () => false)
      setDone({ name: chosen.name, at: new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }), noted })
    } catch (e) {
      setFailed(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
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
          <button type="button" className="lp-button primary" disabled={!chosen || !sentence || busy} aria-busy={busy} onClick={() => void open()}>
            {chosen ? t('xp.open', { project: chosen.name }) : t('xp.openNoProject')}
          </button>
        </div>
      )}
      {failed && <FailureNote said={t('xp.failed')} detail={failed} />}
      {done && <p className="lp-meta" role="status">{t('xp.done', { project: done.name, time: done.at })}{done.noted ? '' : ` ${t('xp.noteFailed')}`}</p>}
    </details>
  )
}
// #endregion cross-project-console

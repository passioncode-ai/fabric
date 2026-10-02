// Help and the guide (SCR-44 «Как работать с Fabric», SCR-31 «Первый полезный результат» ·
// docs/reports/product.html). Help opens the conversation with an example already in the
// composer — never sent, never over a draft the operator kept. The guide counts the operator's path
// from what the estate actually holds, and records the first task in the backlog without starting
// anything: assigning and launching stay the task's own acts.

import { useEffect, useState } from 'react'
import type { ProjectRow } from '../../../shared/types'
import { useT } from '../i18n'

export function HelpScreen({ projects, onChat, onGuide, onBack, onGo }: {
  projects: ProjectRow[] | null
  /** Open the conversation, optionally with an example in the composer. */
  onChat: (suggestion?: string) => void
  onGuide: (projectId: string) => void
  onBack: () => void
  /** The screens «Все управленческие возможности» names. */
  onGo: (to: 'board' | 'plan' | 'pulse' | 'persona' | 'welcome') => void
}): React.JSX.Element {
  const t = useT()
  const first = (projects ?? []).find((p) => p.status !== 'archived') ?? null
  const example = (key: string) => t(key as 'launch.help.example.changes', { project: first?.name ?? '' })
  const card = (title: string, body: string, key: string) => (
    <section className="lp-panel">
      <h3>{title}</h3>
      <p>{body}</p>
      <div className="lp-actions"><button type="button" className="lp-button" onClick={() => onChat(example(key))}>{example(key)}</button></div>
    </section>
  )
  return (
    <div className="lp" data-launch-view="launch-help">
      <header className="lp-heading">
        <div>
          <p className="lp-kicker">{t('launch.help.kicker')}</p>
          <h2 tabIndex={-1}>{t('launch.help.title')}</h2>
          <p>{t('launch.help.lede')}</p>
        </div>
        <div className="lp-actions"><button type="button" className="lp-button" onClick={onBack}>{t('launch.help.back')}</button></div>
      </header>
      <section className="lp-panel">
        <h3>{t('launch.help.ceo')}</h3>
        <p>{t('launch.help.ceoBody')}</p>
        <p>{t('launch.help.ceoScope')}</p>
        <div className="lp-actions">
          <button type="button" className="lp-button" onClick={() => onChat()}>{t('launch.help.openFabric')}</button>
          {first && <button type="button" className="lp-button" onClick={() => onGuide(first.id)}>{t('launch.help.continueGuide', { project: first.name })}</button>}
        </div>
      </section>
      <div className="lp-help-grid">
        {card(t('launch.help.context'), t('launch.help.contextBody'), 'launch.help.example.changes')}
        {first && card(t('launch.help.find'), t('launch.help.findBody'), 'launch.help.example.find')}
        {card(t('launch.help.board'), t('launch.help.boardBody'), 'launch.help.example.board')}
      </div>
      <details className="lp-panel">
        <summary>{t('launch.help.more')}</summary>
        <div className="lp-actions">
          {['launch.help.example.decisions', 'launch.help.example.blocked', 'launch.help.example.agents'].map((k) => (
            <button key={k} type="button" className="lp-button" onClick={() => onChat(example(k))}>{example(k)}</button>
          ))}
        </div>
      </details>
      <details className="lp-panel">
        <summary>{t('launch.help.all')}</summary>
        <div className="lp-actions">
          {(['board', 'plan', 'pulse', 'persona', 'welcome'] as const).map((to) => (
            <button key={to} type="button" className="lp-button" onClick={() => onGo(to)}>{t(`launch.help.go.${to}` as 'launch.help.go.board')}</button>
          ))}
        </div>
      </details>
      <details className="lp-panel">
        <summary>{t('launch.help.voice')}</summary>
        <p>{t('launch.help.voiceBody')}</p>
      </details>
    </div>
  )
}

interface Path { tasks: number; agents: number; decisions: number; results: number }

export function GuideScreen({ project, onChat, onProject, onDone }: {
  project: ProjectRow
  onChat: () => void
  onProject: () => void
  onDone: () => void
}): React.JSX.Element {
  const t = useT()
  const [path, setPath] = useState<Path | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [text, setText] = useState(project.purpose ?? '')
  const [busy, setBusy] = useState(false)
  const [filed, setFiled] = useState<'yes' | string | null>(null)
  const [round, setRound] = useState(0)
  useEffect(() => {
    let alive = true
    Promise.all([
      window.fabric.tasks.list(project.id),
      window.fabric.agents.list(project.id),
      window.fabric.board.resolved({ projectId: project.id, limit: 1 })
    ]).then(
      ([l, a, r]) => alive && setPath({ tasks: l.tasks.length, agents: a.length, decisions: r.data?.length ?? 0,
        results: l.tasks.filter((x) => x.status === 'done').length }),
      (e: unknown) => alive && setFailed(e instanceof Error ? e.message : String(e))
    )
    return () => { alive = false }
  }, [project.id, round])
  const steps = path === null ? null : [
    { key: 'task', done: path.tasks > 0 }, { key: 'agent', done: path.agents > 0 },
    { key: 'decision', done: path.decisions > 0 }, { key: 'result', done: path.results > 0 }
  ]
  const doneCount = steps?.filter((s) => s.done).length ?? 0
  const file = async (): Promise<void> => {
    setBusy(true)
    setFiled(null)
    try {
      await window.fabric.tasks.fileIdea(project.id, text)
      setFiled('yes')
      setRound((n) => n + 1)
    } catch (e) {
      setFiled(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="lp" data-launch-view="launch-guide">
      <header className="lp-heading">
        <div>
          <p className="lp-kicker">{t('launch.help.kicker')}</p>
          <h2 tabIndex={-1}>{t('launch.guide.title')}</h2>
          <p>{t('launch.help.lede')}</p>
        </div>
        <div className="lp-actions"><button type="button" className="lp-button" onClick={onDone}>{t('launch.help.back')}</button></div>
      </header>
      <section className="lp-panel">
        <span className="lp-pill">{project.name}</span>
        <h3>{project.purpose ? t('launch.guide.knowsGoal') : t('launch.guide.noGoal')}</h3>
        <p>{project.purpose || t('project.noPurpose')}</p>
        <div className="lp-actions">
          <button type="button" className="lp-button" onClick={onChat}>{t('launch.board.discuss')}</button>
          <button type="button" className="lp-button" onClick={onProject}>{t('launch.guide.openProject')}</button>
        </div>
      </section>
      {failed && <div className="lp-callout" role="alert"><p>{failed}</p></div>}
      {steps && !steps[0].done && (
        <section className="lp-panel lp-guide-step">
          <h3>{t('launch.guide.firstTask')}</h3>
          <p>{t('launch.guide.firstTaskBody')}</p>
          <label className="lp-field">
            {t('launch.guide.instruction')}
            <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          {filed && filed !== 'yes' && <div className="lp-callout" role="alert"><p>{t('launch.guide.notFiled', { reason: filed })}</p></div>}
          <div className="lp-actions">
            <button type="button" className="lp-button" disabled={busy || !text.trim()} onClick={() => void file()}>{t('launch.guide.file')}</button>
          </div>
        </section>
      )}
      {filed === 'yes' && <div className="lp-callout" role="status"><b>{t('launch.guide.filed')}</b><p>{t('launch.guide.filedBody')}</p></div>}
      <details className="lp-panel" open={doneCount > 0}>
        <summary>{steps ? t('launch.guide.path', { done: doneCount, total: steps.length }) : t('estate.reading')}</summary>
        {steps && (
          <ol className="lp-checklist">
            {steps.map((s) => <li key={s.key}>{s.done ? t('glyph.done') : t('glyph.todo')} {t(`launch.guide.step.${s.key}` as 'launch.guide.step.task')}</li>)}
          </ol>
        )}
      </details>
      <div className="lp-actions">
        <button type="button" className="lp-button" onClick={onDone}>{t('launch.guide.skip')}</button>
        <button type="button" className="lp-button" onClick={onProject}>{t('launch.guide.continue')}</button>
      </div>
    </div>
  )
}

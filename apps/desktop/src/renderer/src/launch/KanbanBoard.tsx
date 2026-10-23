// #region kanban-board — docs: docs/ux/scenarios.md#scn-173-see-all-the-work-as-a-board-and-follow-a-task-through-its-stages
// The Board screen's kanban (the operator's walk of 2026-10-22, OF-19; D-1): Fabric's ladder as four columns. The
// columns scroll sideways when they do not fit and each one scrolls down on its own; a card is a task in plain words
// with its project, agent and age, and opens that task in its project.
import { useEffect, useState } from 'react'
import type { BoardCard, BoardStage, TaskBoardView } from '../../../shared/taskBoard'
import type { BoardFilters } from '../../../shared/types'
import { useT } from '../i18n'
import { since } from '../duration'
import { runnerLabel } from '../runnerLabel'
import { FailureNote } from '../OperatorError'

const HEAD: Record<BoardStage, 'launch.kanban.backlog' | 'launch.kanban.running' | 'launch.kanban.review' | 'launch.kanban.done'> = {
  backlog: 'launch.kanban.backlog', running: 'launch.kanban.running', review: 'launch.kanban.review', done: 'launch.kanban.done'
}

export function KanbanBoard({ feedMark, projectId = null, onOpen, remembered, onRemember }: {
  /** Re-read on the journal's clock. */
  feedMark: number
  /** One project's board when set (a project's «Доска»). */
  projectId?: string | null
  /** Opens the task in its project. */
  onOpen(projectId: string, taskId: string): void
  /** The filters kept from the last visit (SCN-173 step 4, CO-401); none when absent. */
  remembered?: BoardFilters
  /** Keeps the filters for the next visit; a project's own board keeps its project out of it. */
  onRemember?(filters: BoardFilters): void
}): React.JSX.Element {
  const t = useT()
  const [view, setView] = useState<TaskBoardView | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [project, setProject] = useState<string>(projectId ?? remembered?.project ?? '')
  const [agent, setAgent] = useState<string>(remembered?.agent ?? '')
  const [showCancelled, setShowCancelled] = useState<boolean>(remembered?.cancelled ?? false)
  const remember = (next: { project?: string; agent?: string; cancelled?: boolean }): void => {
    const p = next.project ?? project, a = next.agent ?? agent, c = next.cancelled ?? showCancelled
    onRemember?.({ project: projectId ? (remembered?.project ?? null) : (p || null), agent: a || null, cancelled: c })
  }
  useEffect(() => {
    let alive = true
    // A throw before the promise (a bridge that is not there) is said as a failed read, never a blank board.
    try {
      void window.fabric.work.board(projectId).then(
        (v) => { if (alive) { setView(v); setProblem(null) } },
        (e: unknown) => { if (alive) setProblem(e instanceof Error ? e.message : String(e)) }
      )
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e))
    }
    return () => { alive = false }
  }, [feedMark, projectId])
  // A project that left the list (archived between reads) no longer filters: its id would empty every column (ER-10).
  const known = !project || !view || view.projects.some((p) => p.id === project)
  // Dropped, not suspended (iteration 3, ER-4).
  useEffect(() => { if (!known) setProject('') }, [known])
  const scope = projectId ?? (known ? (project || null) : null)
  // The agents on the cards, and the remembered one even while it holds none, so the choice stays visible (CO-401).
  const agents = [...new Set([...(view?.columns ?? []).flatMap((c) => c.cards.map((x) => x.agent)), agent || null].filter((a): a is string => !!a))].sort()
  const shown = (cards: readonly BoardCard[]): BoardCard[] => cards.filter((x) => (!scope || x.projectId === scope) && (!agent || x.agent === agent))
  const columns = [
    ...(view?.columns ?? []).map((c) => ({ key: c.stage as string, head: t(HEAD[c.stage]), cards: shown(c.cards), capped: c.capped, unread: c.unread })),
    ...(showCancelled && view
      ? [view.cancelled
        ? { key: 'cancelled', head: t('launch.kanban.cancelled'), cards: shown(view.cancelled.cards), capped: view.cancelled.capped, unread: view.cancelled.unread }
        : { key: 'cancelled', head: t('launch.kanban.cancelled'), cards: [] as BoardCard[], capped: false, unread: t('launch.kanban.cancelledUnread') }]
      : [])
  ]
  return (
    <section className="lk" aria-labelledby="kanban-title">
      <h3 id="kanban-title" className="visually-hidden">{t('launch.kanban.title')}</h3>
      {view && (
        <div className="lk-filters">
          {!projectId && (
            <label className="lp-field lk-filter">
              {t('launch.kanban.project')}
              <select value={known ? project : ''} onChange={(e) => { setProject(e.target.value); remember({ project: e.target.value }) }}>
                <option value="">{t('launch.kanban.allProjects')}</option>
                {view.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          )}
          <label className="lp-field lk-filter">
            {t('launch.kanban.agent')}
            <select value={agent} onChange={(e) => { setAgent(e.target.value); remember({ agent: e.target.value }) }}>
              <option value="">{t('launch.kanban.allAgents')}</option>
              {agents.map((a) => <option key={a} value={a}>{runnerLabel(a, t)}</option>)}
            </select>
          </label>
          <label className="lk-toggle">
            <input type="checkbox" checked={showCancelled} onChange={(e) => { setShowCancelled(e.target.checked); remember({ cancelled: e.target.checked }) }} />
            {t('launch.kanban.showCancelled')}
          </label>
        </div>
      )}
      {problem && <FailureNote said={t('launch.kanban.unreadable')} detail={problem} />}
      {!view && !problem && <p className="lp-meta">{t('estate.reading')}</p>}
      {view && (
        <div className="lk-board">
          {columns.map((c) => {
            const cards = c.cards
            return (
              <section key={c.key} className={`lk-col ${c.key === 'cancelled' ? 'lk-cancelled' : ''}`} aria-label={c.head}>
                <h3>{c.head} <span className="lp-count">{c.unread ? '?' : `${cards.length}${c.capped ? '+' : ''}`}</span></h3>
                {c.unread && <FailureNote said={t('launch.kanban.unreadable')} detail={c.unread} />}
                {!c.unread && cards.length === 0 && <p className="lp-meta">{t(c.capped ? 'launch.kanban.beyondCap' : 'launch.kanban.empty')}</p>}
                {cards.map((x) => (
                  <button key={x.taskId} type="button" className="lk-card" onClick={() => onOpen(x.projectId, x.taskId)}>
                    <b>{x.summary || t('launch.home.work.untitled')}</b>
                    <small>{[x.agent ? runnerLabel(x.agent, t) : null, x.projectName, x.since ? since(x.since, t) : null].filter(Boolean).join(' · ')}</small>
                    {/* ADR-0176 §1 (SCN-176): a queued or running task whose brief lacks a part says so on its card. */}
                    {x.specMissing && <span className="lp-pill attention">{t('launch.kanban.specMissing')}</span>}
                  </button>
                ))}
              </section>
            )
          })}
        </div>
      )}
    </section>
  )
}
// #endregion kanban-board

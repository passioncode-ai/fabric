// #region kanban-board — docs: docs/ux/scenarios.md#scn-173-see-all-the-work-as-a-board-and-follow-a-task-through-its-stages
// The Board screen's kanban (the operator's walk of 2026-10-22, OF-19; D-1): Fabric's ladder as four columns. The
// columns scroll sideways when they do not fit and each one scrolls down on its own; a card is a task in plain words
// with its project, agent and age, and opens that task in its project.
//
// 0.3.14 (the operator, 2026-10-26): a card in work names its session and opens its agent; work with no live claim and
// no live session is «Брошено», a column of its own after «В работе» and not counted there (the home counts the same
// set, `shared/homeLive.ts`); «Готово» reads 20 more at a time when its page was cut.
//
// The 0.3.14 review, iteration 1: a «Брошено» card names its session as text, not a link (UX-1: its session is the one
// Fabric no longer holds, so Агенты has no page for it; the card itself opens the task); the session link's name starts
// with the words it shows (UX-6); «Показать ещё» says it reads and stops at the main process's bound of 500 (UX-5).
//
// ADR-0208 (the owner, 2026-11-21): «Очередь» stands in the board's order, the owner's places first, then what other
// work waits for, the critical path first. Each card says why it stands where it does. On one project's board the
// owner moves a card by dragging it onto another, or with «Выше» and «Ниже»; an agent's proposed place shows on the
// card with «Принять» and «Отклонить». With all projects shown the column is read only and says to pick a project.
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

/** How many finished tasks «Готово» reads at a time. */
const DONE_PAGE = 20
/** The most «Готово» reads: the main process's own bound (`main/index.ts`, `work:board`). */
export const DONE_MAX = 500


/** ADR-0208 (the 0.3.28 review, iteration 2, UX-13): the queue stands ready tasks before those that wait for an open one,
 *  whatever the owner's rank says, so a waiting card cannot move above a ready one and a ready card cannot move below a
 *  waiting one: such a move would change nothing on the board and only pin the cards around it. Whether moving the card
 *  at `from` to the place of the card at `to` is one the board would show. */
export function orderMoveAllowed(cards: ReadonlyArray<{ order?: { waits: number } | null }>, from: number, to: number): boolean {
  if (from < 0 || to < 0 || from >= cards.length || to >= cards.length || from === to) return false
  const waits = (i: number): boolean => (cards[i]?.order?.waits ?? 0) > 0
  return waits(from) === waits(to)
}

export function KanbanBoard({ feedMark, projectId = null, onOpen, onAgent, remembered, onRemember }: {
  /** Re-read on the journal's clock. */
  feedMark: number
  /** One project's board when set (a project's «Доска»). */
  projectId?: string | null
  /** Opens the task in its project. */
  onOpen(projectId: string, taskId: string): void
  /** Opens the agent of a session (a card in work names it); absent, the session is named without a link. */
  onAgent?(sessionId: string): void
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
  const [doneLimit, setDoneLimit] = useState(DONE_PAGE)
  /** The «Готово» limit the board on screen was read with: while it differs, the next page is being read (UX-5). */
  const [readLimit, setReadLimit] = useState(DONE_PAGE)
  /** ADR-0208: bumped after the owner's own act, so the queue is read again without waiting for the journal's mark. */
  const [acted, setActed] = useState(0)
  /** The card being moved or decided, while its write is in flight: one act at a time. */
  const [busy, setBusy] = useState<string | null>(null)
  /** What the last act could not do, said under the queue's note. */
  const [orderProblem, setOrderProblem] = useState<{ said: 'launch.kanban.order.failed' | 'launch.kanban.proposal.failed'; detail: string } | null>(null)
  const [dragged, setDragged] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const remember = (next: { project?: string; agent?: string; cancelled?: boolean }): void => {
    const p = next.project ?? project, a = next.agent ?? agent, c = next.cancelled ?? showCancelled
    onRemember?.({ project: projectId ? (remembered?.project ?? null) : (p || null), agent: a || null, cancelled: c })
  }
  useEffect(() => {
    let alive = true
    // A throw before the promise (a bridge that is not there) is said as a failed read, never a blank board.
    try {
      void (doneLimit > DONE_PAGE ? window.fabric.work.board(projectId, doneLimit) : window.fabric.work.board(projectId)).then(
        (v) => { if (alive) { setView(v); setProblem(null); setReadLimit(doneLimit) } },
        (e: unknown) => { if (alive) { setProblem(e instanceof Error ? e.message : String(e)); setReadLimit(doneLimit) } }
      )
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e))
    }
    return () => { alive = false }
  }, [feedMark, projectId, doneLimit, acted])
  // A project that left the list (archived between reads) no longer filters: its id would empty every column (ER-10).
  const known = !project || !view || view.projects.some((p) => p.id === project)
  // Dropped, not suspended (iteration 3, ER-4).
  useEffect(() => { if (!known) setProject('') }, [known])
  const scope = projectId ?? (known ? (project || null) : null)
  /** «Готово» was read at the main process's bound: «Показать ещё» gives way to a sentence (UX-5). */
  const atBound = doneLimit >= DONE_MAX && readLimit === doneLimit
  // The agents on the cards, and the remembered one even while it holds none, so the choice stays visible (CO-401).
  const agents = [...new Set([...(view?.columns ?? []).flatMap((c) => c.cards.map((x) => x.agent)), ...(view?.abandoned ?? []).map((x) => x.agent), agent || null].filter((a): a is string => !!a))].sort()
  // The agent filter applies to «В работе» only: a card in any other column records no agent (shared/taskBoard.ts), so
  // filtering them by agent emptied them, and a remembered filter read as the agent having nothing in review or done
  // (0.3.12 review ER-9). The other columns are shown whole, and the filter says so.
  const shown = (cards: readonly BoardCard[], byAgent = false): BoardCard[] =>
    cards.filter((x) => (!scope || x.projectId === scope) && (!byAgent || !agent || x.agent === agent))
  // ADR-0208: the owner orders one project's queue; with every project in the column there is no single order to move in.
  const mayOrder = !!scope && !!view && !view.orderUnread
  const act = (taskId: string, said: 'launch.kanban.order.failed' | 'launch.kanban.proposal.failed', run: () => Promise<unknown>): void => {
    if (busy) return
    setBusy(taskId)
    setOrderProblem(null)
    let started: Promise<unknown>
    try { started = run() } catch (e) { started = Promise.reject(e) }
    void started.then(
      () => { setBusy(null); setActed((n) => n + 1) },
      (e: unknown) => { setBusy(null); setOrderProblem({ said, detail: e instanceof Error ? e.message : String(e) }) }
    )
  }
  /** Puts `taskId` right after `afterId` (null: first) in the queue on screen. */
  const move = (taskId: string, afterId: string | null): void => act(taskId, 'launch.kanban.order.failed', () => window.fabric.tasks.reorder(taskId, afterId))
  /** A card dropped onto another takes that card's place: before it when it came from below, after it from above. */
  const dropOn = (cards: readonly BoardCard[], targetId: string): void => {
    const from = cards.findIndex((x) => x.taskId === dragged), to = cards.findIndex((x) => x.taskId === targetId)
    setDragged(null); setOver(null)
    if (from < 0 || to < 0 || from === to || !dragged || !orderMoveAllowed(cards, from, to)) return
    move(dragged, from < to ? targetId : (cards[to - 1]?.taskId ?? null))
  }
  const abandoned = view?.abandoned?.length
    ? [{ key: 'abandoned', head: t('launch.kanban.abandoned'), cards: shown(view.abandoned, true), capped: false, unread: undefined as string | undefined }]
    : []
  const columns = [
    ...(view?.columns ?? []).flatMap((c) => [
      { key: c.stage as string, head: t(HEAD[c.stage]), cards: shown(c.cards, c.stage === 'running'), capped: c.capped, unread: c.unread },
      // «Брошено» stands right after «В работе», apart from it (0.3.14).
      ...(c.stage === 'running' ? abandoned : [])
    ]),
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
      {view && agent && <p className="lp-meta" role="status">{t('launch.kanban.agentOnlyRunning')}</p>}
      {problem && <FailureNote said={t('launch.kanban.unreadable')} detail={problem} />}
      {!view && !problem && <p className="lp-meta">{t('estate.reading')}</p>}
      {view && (
        <div className="lk-board">
          {columns.map((c) => {
            const cards = c.cards
            return (
              <section key={c.key} className={`lk-col ${c.key === 'cancelled' ? 'lk-cancelled' : ''} ${c.key === 'abandoned' ? 'lk-abandoned' : ''}`} aria-label={c.head}>
                <h3>{c.head} <span className="lp-count">{c.unread ? '?' : `${cards.length}${c.capped ? '+' : ''}`}</span></h3>
                {c.key === 'abandoned' && <p className="lp-meta">{t('launch.kanban.abandonedNote')}</p>}
                {c.key === 'backlog' && !c.unread && cards.length > 0 && (view.orderUnread
                  ? <FailureNote said={t('launch.kanban.order.unread')} detail={view.orderUnread} />
                  : <p className="lp-meta">{t(scope ? 'launch.kanban.order.note' : 'launch.kanban.order.noteAll')}{view.orderCapped ? ` ${t('launch.kanban.order.capped')}` : ''}</p>)}
                {c.key === 'backlog' && orderProblem && <FailureNote said={t(orderProblem.said)} detail={orderProblem.detail} />}
                {c.key === 'backlog' && busy && <p className="lp-meta" role="status">{t('launch.kanban.order.saving')}</p>}
                {c.unread && <FailureNote said={t('launch.kanban.unreadable')} detail={c.unread} />}
                {!c.unread && cards.length === 0 && <p className="lp-meta">{t(c.capped ? 'launch.kanban.beyondCap' : 'launch.kanban.empty')}</p>}
                {cards.map((x, at) => {
                  // SP-2 (2026-11-12): the session is the card's agent, named in words; its id never reaches the card.
                  const short = x.sessionId ? (x.agent ? runnerLabel(x.agent, t) : t('task.who.agent')) : null
                  const queued = c.key === 'backlog'
                  const orderable = queued && mayOrder
                  const name = x.summary || t('launch.home.work.untitled')
                  const anchor = x.proposal?.afterTaskId ? cards.find((y) => y.taskId === x.proposal!.afterTaskId) : undefined
                  return (
                    <div key={x.taskId} className={`lk-card-wrap ${orderable && over === x.taskId && dragged !== x.taskId ? 'lk-drop' : ''}`}
                      draggable={orderable && !busy ? true : undefined}
                      onDragStart={orderable ? (e) => { setDragged(x.taskId); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', x.taskId) } : undefined}
                      onDragEnd={orderable ? () => { setDragged(null); setOver(null) } : undefined}
                      onDragOver={orderable && dragged ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (over !== x.taskId) setOver(x.taskId) } : undefined}
                      onDrop={orderable && dragged ? (e) => { e.preventDefault(); dropOn(cards, x.taskId) } : undefined}>
                      <button type="button" className="lk-card" onClick={() => onOpen(x.projectId, x.taskId)}>
                        <b>{x.summary || t('launch.home.work.untitled')}</b>
                        <small>{[x.agent ? runnerLabel(x.agent, t) : null, x.projectName, x.since ? since(x.since, t) : null].filter(Boolean).join(' · ')}</small>
                        {/* ADR-0176 §1 (SCN-176): a queued or running task whose brief lacks a part says so on its card. */}
                        {x.specMissing && <span className="lp-pill attention">{t('launch.kanban.specMissing')}</span>}
                        {/* ADR-0208: why a queued task stands where it does. */}
                        {queued && x.order && (x.order.critical || x.order.waits > 0 || x.order.unblocks > 0 || x.order.ranked || x.order.inherited) && (
                          <span className="lk-order">
                            {x.order.critical && <span className="lp-pill attention">{t('launch.kanban.order.critical')}</span>}
                            {x.order.waits > 0 && <span className="lp-pill">{t('launch.kanban.order.waits', { count: x.order.waits })}</span>}
                            {x.order.unblocks > 0 && <span className="lp-pill">{t('launch.kanban.order.unblocks', { count: x.order.unblocks })}</span>}
                            {x.order.ranked && <span className="lp-pill">{t('launch.kanban.order.ranked')}</span>}
                            {x.order.inherited && <span className="lp-pill">{t('launch.kanban.order.inherited')}</span>}
                          </span>
                        )}
                      </button>
                      {orderable && cards.length > 1 && (
                        <span className="lk-move">
                          <button type="button" className="lp-button lh-text-link" disabled={!!busy || at === 0 || !orderMoveAllowed(cards, at, at - 1)} aria-label={t('launch.kanban.order.upLabel', { task: name })}
                            title={at > 0 && !orderMoveAllowed(cards, at, at - 1) ? t('launch.kanban.order.waitsFirst') : undefined}
                            onClick={() => move(x.taskId, cards[at - 2]?.taskId ?? null)}>{t('launch.kanban.order.up')}</button>
                          <button type="button" className="lp-button lh-text-link" disabled={!!busy || at === cards.length - 1 || !orderMoveAllowed(cards, at, at + 1)} aria-label={t('launch.kanban.order.downLabel', { task: name })}
                            title={at < cards.length - 1 && !orderMoveAllowed(cards, at, at + 1) ? t('launch.kanban.order.waitsFirst') : undefined}
                            onClick={() => move(x.taskId, cards[at + 1]!.taskId)}>{t('launch.kanban.order.down')}</button>
                        </span>
                      )}
                      {queued && x.proposal && (
                        <div className="lk-proposal">
                          <small>{x.proposal.afterTaskId === null
                            ? t('launch.kanban.proposal.first')
                            : anchor
                            ? t('launch.kanban.proposal.after', { task: anchor.summary || t('launch.home.work.untitled') })
                            : t('launch.kanban.proposal.afterGone')}</small>
                          {x.proposal.why && <small className="lp-meta">{x.proposal.why}</small>}
                          <span className="lk-move">
                            {/* The 0.3.28 review, iteration 2, UX-15: accepted only where the queue can be moved. */}
                            {mayOrder && (x.proposal.afterTaskId === null || anchor) && (
                              <button type="button" className="lp-button lh-text-link" disabled={!!busy} aria-label={t('launch.kanban.proposal.acceptLabel', { task: name })}
                                onClick={() => act(x.taskId, 'launch.kanban.proposal.failed', () => window.fabric.tasks.rankProposal(x.taskId, true))}>{t('launch.kanban.proposal.accept')}</button>
                            )}
                            <button type="button" className="lp-button lh-text-link" disabled={!!busy} aria-label={t('launch.kanban.proposal.declineLabel', { task: name })}
                              onClick={() => act(x.taskId, 'launch.kanban.proposal.failed', () => window.fabric.tasks.rankProposal(x.taskId, false))}>{t('launch.kanban.proposal.decline')}</button>
                          </span>
                        </div>
                      )}
                      {short && x.sessionId && (c.key === 'abandoned'
                        ? <small className="lp-meta lk-session">{t('launch.kanban.sessionGone')}</small>
                        : onAgent
                        ? <button type="button" className="lp-button lh-text-link lk-session" aria-label={t('launch.kanban.openAgent', { agent: short })} onClick={() => onAgent(x.sessionId!)}>{t('launch.kanban.session')}</button>
                        : <small className="lp-meta lk-session">{t('launch.kanban.sessionLive')}</small>)}
                    </div>
                  )
                })}
                {c.key === 'done' && c.capped && !c.unread && doneLimit < DONE_MAX && (
                  <button type="button" className="lp-button lh-text-link" disabled={readLimit !== doneLimit} aria-busy={readLimit !== doneLimit}
                    onClick={() => setDoneLimit((n) => Math.min(DONE_MAX, n + DONE_PAGE))}>{t('launch.kanban.more', { count: DONE_PAGE })}</button>
                )}
                {c.key === 'done' && readLimit !== doneLimit && <p className="lp-meta" role="status">{t('launch.kanban.moreReading')}</p>}
                {c.key === 'done' && c.capped && !c.unread && atBound && <p className="lp-meta">{t('launch.kanban.doneBound', { count: DONE_MAX })}</p>}
              </section>
            )
          })}
        </div>
      )}
    </section>
  )
}
// #endregion kanban-board

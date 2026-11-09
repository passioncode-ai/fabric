// #region work-directions-view — docs: docs/ux/scenarios.md#scn-181-see-a-projects-work-by-where-it-came-from-and-where-it-goes
// «Направления работы» (SCN-181, CO-543): where a project's work came from and where it goes, one row per direction with
// its count and a strip of cards that scrolls sideways, newest first. The rows are composed by
// `shared/workDirections.ts#composeDirections`; this file draws them. On the project page (`ProjectDirections`) it
// replaces the board glance; on an agent's page (`AgentPage.tsx`) the same rows show that agent's tasks above the chips.

import { useMemo } from 'react'
import { composeDirections, type DirectionItem, type DirectionRow, type DirectionTask } from '../../../shared/workDirections'
import type { TaskRow } from '../../../shared/types'
import { since } from '../duration'
import { useT } from '../i18n'
import { FailureNote } from '../OperatorError'
import { usePaneRead } from './paneRead'
import { runnerLabel } from '../runnerLabel'

type T = ReturnType<typeof useT>

/** How long ago, or nothing when the time does not parse (never a dash or «?», the 0.3.15 review's UX-16). */
const ago = (iso: string, t: T): string | null => (Number.isFinite(Date.parse(iso)) ? since(iso, t) : null)

/** A note said on the rows it is about: the requests' failure on the request rows, the tasks' on top. */
export interface DirectionsNote { said: string; detail: string | null }

function Card({ item, t, showAgent, onOpenTask, onOpenRequest }: {
  item: DirectionItem
  t: T
  showAgent: boolean
  onOpenTask: (taskId: string) => void
  onOpenRequest?: (threadId: string) => void
}): React.JSX.Element {
  if (item.kind === 'task') {
    const meta = [t(`launch.project.directions.task.${item.word}` as 'launch.project.directions.task.queued'), showAgent && item.agent ? runnerLabel(item.agent, t) : null, ago(item.at, t)]
    return (
      <button type="button" className="lp-dir-card" onClick={() => onOpenTask(item.id)}>
        <span className="lp-dir-title">{item.summary || t('launch.home.work.untitled')}</span>
        {item.source && <small className="lp-dir-source">{t('launch.project.directions.source', { row: item.source.rowId, path: item.source.path })}</small>}
        <small className="lp-meta">{meta.filter(Boolean).join(' · ')}</small>
      </button>
    )
  }
  const body = (
    <>
      <span className="lp-dir-project">{item.projectName ?? t('launch.project.directions.unnamedProject')}</span>
      <span className="lp-dir-title">{item.subject ?? item.capability}</span>
      <small className="lp-meta">{[t(`launch.project.directions.request.${item.word}` as 'launch.project.directions.request.waiting'), ago(item.at, t)].filter(Boolean).join(' · ')}</small>
    </>
  )
  return onOpenRequest
    ? <button type="button" className="lp-dir-card is-request" onClick={() => onOpenRequest(item.threadId)}>{body}</button>
    : <div className="lp-dir-card is-request">{body}</div>
}

const REQUEST_ROWS = new Set(['fromProjects', 'toProjects'])

/** The rows themselves. `requestsNote` is said on each request row, or on a row of its own when none is drawn. */
export function DirectionRows({ rows, requestsNote = null, showAgent = true, onOpenTask, onOpenRequest }: {
  rows: DirectionRow[]
  requestsNote?: DirectionsNote | null
  /** The agent on a task is said on the project page; an agent's own page leaves it out. */
  showAgent?: boolean
  onOpenTask: (taskId: string) => void
  onOpenRequest?: (threadId: string) => void
}): React.JSX.Element {
  const t = useT()
  const drawsRequests = rows.some((r) => REQUEST_ROWS.has(r.direction))
  return (
    <div className="lp-dir-rows">
      {requestsNote && !drawsRequests && (
        <div className="lp-dir-row" data-direction="requests">
          <h4>{t('launch.project.directions.row.requests')}</h4>
          <FailureNote said={requestsNote.said} detail={requestsNote.detail ?? undefined} />
        </div>
      )}
      {rows.map((row) => {
        const heading = t(`launch.project.directions.row.${row.direction}` as 'launch.project.directions.row.fromYou')
        return (
          <div key={row.direction} className="lp-dir-row" data-direction={row.direction}>
            <h4>{heading} <span className="lp-count">{row.items.length}</span></h4>
            {requestsNote && REQUEST_ROWS.has(row.direction) && <FailureNote said={requestsNote.said} detail={requestsNote.detail ?? undefined} />}
            <ul className="lp-dir-strip" aria-label={heading}>
              {row.items.map((item) => (
                <li key={item.kind === 'task' ? item.id : item.requestId}>
                  <Card item={item} t={t} showAgent={showAgent} onOpenTask={onOpenTask} onOpenRequest={onOpenRequest} />
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

/**
 * The project page's «Направления работы»: the tasks the page holds, the agents on them, and the project's backlog rows
 * and board requests, each read on its own (`usePaneRead`: coalesced, on a 15 s tick, a failure keeps what was shown).
 * A failure of one is said on its rows and the other rows stay (SCN-181, errors and recovery).
 */
export function ProjectDirections({ projectId, tasks, tasksProblem = null, agents, mark, onOpenTask, onOpenRequest, onBoard, onNewTask }: {
  projectId: string
  /** Null until read. */
  tasks: TaskRow[] | null
  tasksProblem?: string | null
  /** The agent on each task in work (`work.home`), by task id; null when not read. */
  agents: ReadonlyMap<string, string | null> | null
  mark: number
  onOpenTask: (taskId: string) => void
  onOpenRequest?: (threadId: string) => void
  /** The whole board, below. */
  onBoard: () => void
  onNewTask: () => void
}): React.JSX.Element | null {
  const t = useT()
  const requests = usePaneRead(projectId, 'requests', () => window.fabric.comms.projectRequests(projectId), mark, 0)
  const sources = usePaneRead(projectId, 'sources', () => window.fabric.work.sources(projectId), mark, 0)
  const reqView = requests.at === 'ready' ? requests.value : requests.at === 'failed' ? requests.kept : null
  const srcView = sources.at === 'ready' ? sources.value : sources.at === 'failed' ? sources.kept : null
  const rows = useMemo(() => composeDirections({
    projectId,
    tasks: (tasks ?? []) as DirectionTask[],
    sources: srcView?.sources ?? [],
    agents: agents ?? undefined,
    requests: reqView?.requests ?? null,
    projectNames: new Map(Object.entries(reqView?.names ?? {})),
    now: Date.now()
  }), [projectId, tasks, srcView, reqView, agents])
  const requestsNote: DirectionsNote | null = requests.at === 'failed'
    ? { said: t(requests.kept ? 'launch.project.directions.requestsStale' : 'launch.project.directions.requestsUnreadable'), detail: requests.says }
    : null
  // A project with no work at all shows SCN-159's first step instead (ProjectLaunch); nothing is said twice.
  if (tasks !== null && tasks.length === 0 && rows.length === 0 && !requestsNote) return null
  return (
    <section className="lp-panel lp-dir" aria-labelledby="project-dir-title">
      <div className="lp-panel-head">
        <h3 id="project-dir-title">{t('launch.project.directions.title')}</h3>
        <div className="lp-actions">
          <button type="button" className="lp-button" onClick={onNewTask}>{t('launch.project.newTask')}</button>
          <button type="button" className="lp-button lh-text-link" onClick={onBoard}>{t('launch.project.glance.all')}</button>
        </div>
      </div>
      {tasksProblem && <FailureNote said={t(tasks ? 'launch.project.directions.stale' : 'launch.project.directions.unreadable')} detail={tasksProblem} />}
      {sources.at === 'failed' && !sources.kept && <FailureNote said={t('launch.project.directions.sourcesUnreadable')} detail={sources.says} />}
      {tasks === null && !tasksProblem ? (
        <p className="lp-meta" role="status">{t('launch.project.directions.reading')}</p>
      ) : rows.length === 0 && !requestsNote ? (
        // UX-5: tasks that cannot be read are said above; the week is not called quiet on rows nobody read.
        tasks === null ? null : requests.at === 'reading' ? <p className="lp-meta" role="status">{t('launch.project.directions.reading')}</p> : <p className="lp-meta">{t('launch.project.directions.quiet')}</p>
      ) : (
        <DirectionRows rows={rows} requestsNote={requestsNote} onOpenTask={onOpenTask} onOpenRequest={onOpenRequest} />
      )}
      {reqView?.capped && <p className="lp-meta">{t('launch.project.directions.requestsCapped')}</p>}
    </section>
  )
}
// #endregion work-directions-view

// Planning (SCR-40 · docs/reports/product.html `launchPlan`): where the work is heading, opened
// level by level — every project, one project's goals, one goal's work — with the same plan as a
// list beneath the canvas. Built on the plan the app already keeps (`planOf`, `goalProgress`):
// the ORDER of work under a goal is the operator's priority, not a dependency, so no edge is drawn
// that the data does not hold, and the screen says so.

import { useEffect, useState } from 'react'
import type { BoardCut } from '../../../shared/board'
import { planOf, type GoalRow } from '../../../shared/plan.ts'
import { goalProgress } from '../../../shared/planProgress'
import type { ReadEnvelope } from '../../../shared/readEnvelope'
import type { FeedEvent, ProjectRow, TaskList, TaskRow } from '../../../shared/types'
import { Feed } from '../Feed'
import { useT } from '../i18n'
import { FeedStrip } from './FabricStrip'

export type PlanLevel = { at: 'portfolio' } | { at: 'project'; projectId: string } | { at: 'goal'; projectId: string; goalId: string | null }

interface Node { key: string; kicker: string; title: string; sub: string; pill: string; attention: boolean; open?: () => void; openLabel?: string }

export function PlanScreen({ projects, feed, feedMark, level: initial, onProject, onTask, onPulse }: {
  projects: ProjectRow[] | null
  feed: FeedEvent[] | null
  feedMark: number
  level: PlanLevel
  onProject: (projectId: string) => void
  onTask: (projectId: string, taskId: string) => void
  /** Pulse for the level on screen: the project's own, or every project's. */
  onPulse?: (projectId: string | null) => void
}): React.JSX.Element {
  const t = useT()
  const [level, setLevel] = useState<PlanLevel>(initial)
  const [mode, setMode] = useState<'plan' | 'history'>('plan')
  const [zoom, setZoom] = useState(100)
  const [board, setBoard] = useState<ReadEnvelope<BoardCut> | null>(null)
  const [goals, setGoals] = useState<GoalRow[] | null>(null)
  const [list, setList] = useState<TaskList | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const projectId = level.at === 'portfolio' ? null : level.projectId

  useEffect(() => { setLevel(initial) }, [initial.at, 'projectId' in initial ? initial.projectId : null])
  useEffect(() => {
    let alive = true
    setFailed(null)
    if (projectId === null) {
      window.fabric.board.query({ projectId: null, limit: 1 }).then((b) => alive && setBoard(b), (e: unknown) => alive && setFailed(String(e)))
    } else {
      setGoals(null); setList(null)
      Promise.all([window.fabric.goals.list(projectId), window.fabric.tasks.list(projectId)]).then(
        ([g, l]) => { if (alive) { setGoals(g); setList(l) } },
        (e: unknown) => alive && setFailed(e instanceof Error ? e.message : String(e))
      )
    }
    return () => { alive = false }
  }, [projectId, feedMark])

  const live = (projects ?? []).filter((p) => p.status !== 'archived')
  const project = projectId ? live.find((p) => p.id === projectId) ?? null : null
  const tasks: TaskRow[] | null = list?.tasks ?? null
  const plan = goals && tasks ? planOf(goals, tasks.filter((x) => x.status !== 'done' && x.status !== 'cancelled')) : null
  const closedUnder = (goalId: string) => (tasks ?? []).filter((x) => x.goal_id === goalId && (x.status === 'done' || x.status === 'cancelled')).length
  const stateOf = (x: TaskRow) => t(x.status === 'cancelled' ? 'launch.project.cancelled' : (`board.${x.status}` as 'board.done'))

  // The nodes of the level on show; each names what it is and where it opens.
  const nodes: Node[] | null =
    level.at === 'portfolio'
      ? projects === null ? null : live.map((p, i) => {
          const waits = board?.data?.countsByProject?.[p.id] ?? 0
          return { key: p.id, kicker: t('launch.plan.node.project', { n: i + 1 }), title: p.name, sub: p.purpose || t('project.noPurpose'),
            pill: board === null ? t('estate.reading') : waits > 0 ? t('estate.waiting', { count: waits }) : t('estate.idle'), attention: waits > 0,
            open: () => setLevel({ at: 'project', projectId: p.id }), openLabel: t('launch.plan.expand') }
        })
      : level.at === 'project'
        ? plan === null ? null : [
            ...plan.goals.map(({ goal, tasks: under }, i) => {
              const progress = goalProgress({ goalId: goal.id, open: under.length, closed: closedUnder(goal.id), closedTruncated: list?.closed.truncated !== false })
              // The progress in words of the reader's language; a capped count is a floor, said so.
              const sub = progress.kind === 'nothing_planned' ? t('launch.plan.nothingPlanned')
                : progress.kind === 'complete' ? t('launch.plan.complete', { total: progress.total })
                : progress.kind === 'at_least' ? t('launch.plan.atLeast', { done: progress.done, total: progress.total })
                : t('launch.plan.measured', { done: progress.done, total: progress.total })
              return { key: goal.id, kicker: t('launch.plan.node.goal', { n: i + 1 }), title: goal.title, sub,
                pill: progress.kind === 'nothing_planned' ? t('launch.plan.nothingPlanned') : t('launch.plan.open', { count: under.length }), attention: false,
                open: () => setLevel({ at: 'goal', projectId: level.projectId, goalId: goal.id }), openLabel: t('launch.plan.expand') }
            }),
            ...(plan.unattached.length > 0 ? [{ key: 'unattached', kicker: t('launch.plan.node.unattached'), title: t('launch.plan.unattached'),
              sub: t('launch.plan.unattachedBody'), pill: t('launch.plan.open', { count: plan.unattached.length }), attention: true,
              open: () => setLevel({ at: 'goal', projectId: level.projectId, goalId: null }), openLabel: t('launch.plan.expand') }] : [])
          ]
        : plan === null ? null : (level.goalId === null ? plan.unattached : plan.goals.find((g) => g.goal.id === level.goalId)?.tasks ?? []).map((x, i) => ({
            key: x.id, kicker: t('launch.plan.node.work', { n: i + 1 }), title: x.title || x.instruction, sub: x.id.slice(0, 8), pill: stateOf(x),
            attention: x.status === 'review', open: () => onTask(level.projectId, x.id), openLabel: t('launch.plan.openTask')
          }))

  const goalName = level.at === 'goal' ? (level.goalId === null ? t('launch.plan.unattached') : goals?.find((g) => g.id === level.goalId)?.title ?? '…') : null
  const crumbs: { label: string; to: PlanLevel }[] = [
    { label: t('launch.plan.all'), to: { at: 'portfolio' } },
    ...(project ? [{ label: project.name, to: { at: 'project', projectId: project.id } as PlanLevel }] : []),
    ...(goalName && level.at === 'goal' ? [{ label: goalName, to: level }] : [])
  ]
  const caption = level.at === 'portfolio' ? t('launch.plan.captionPortfolio') : level.at === 'project' ? t('launch.plan.captionProject') : t('launch.plan.captionGoal')

  const stripProject = level.at === 'portfolio' ? null : (projects ?? []).find((p) => p.id === level.projectId) ?? null
  return (
    <div className="lp" data-launch-view="launch-plan">
      <FeedStrip feed={feed} projectId={stripProject?.id ?? null} projectName={stripProject?.name ?? null} onPulse={onPulse ? () => onPulse(stripProject?.id ?? null) : undefined} />
      <header className="lp-heading">
        <div>
          <p className="lp-kicker">{t('launch.plan.kicker')}</p>
          <h2 tabIndex={-1}>{t('launch.plan.title')}</h2>
          <p>{t('launch.plan.lede')}</p>
        </div>
        <div className="lp-actions">
          {project && <button type="button" className="lp-button" onClick={() => onProject(project.id)}>{t('launch.plan.toProject')}</button>}
        </div>
      </header>
      <div className="lp-plan-toolbar">
        <nav className="lp-breadcrumb" aria-label={t('launch.plan.level')}>
          {crumbs.map((c, i) => (
            <span key={c.label + i}>
              {i > 0 && <span aria-hidden="true"> / </span>}
              <button type="button" className="lp-button" aria-current={i === crumbs.length - 1 ? 'page' : undefined} onClick={() => setLevel(c.to)}>{c.label}</button>
            </span>
          ))}
        </nav>
        <div className="lp-actions">
          <button type="button" className="lp-button" aria-pressed={mode === 'plan'} onClick={() => setMode('plan')}>{t('launch.plan.modePlan')}</button>
          <button type="button" className="lp-button" aria-pressed={mode === 'history'} onClick={() => setMode('history')}>{t('launch.plan.modeHistory')}</button>
          <button type="button" className="lp-button" aria-label={t('launch.plan.zoomOut')} disabled={zoom <= 60} onClick={() => setZoom(zoom - 20)}>{t('glyph.minus')}</button>
          <span className="lp-pill">{zoom}%</span>
          <button type="button" className="lp-button" aria-label={t('launch.plan.zoomIn')} disabled={zoom >= 160} onClick={() => setZoom(zoom + 20)}>{t('glyph.new')}</button>
          <button type="button" className="lp-button" onClick={() => setZoom(100)}>{t('launch.plan.fit')}</button>
        </div>
      </div>
      {failed && <div className="lp-callout" role="alert"><p>{failed}</p></div>}
      {mode === 'history' ? (
        level.at === 'portfolio' ? (
          <section className="lp-panel">
            <h3>{t('launch.plan.historyAll')}</h3>
            <p>{t('launch.plan.historyAllBody')}</p>
            <div className="lp-actions">{live.map((p) => <button key={p.id} type="button" className="lp-button" onClick={() => setLevel({ at: 'project', projectId: p.id })}>{p.name}</button>)}</div>
          </section>
        ) : (
          <section className="lp-panel">
            <p className="lp-kicker">{t('launch.plan.did')}</p>
            <h3>{t('launch.plan.happened')}</h3>
            <Feed events={feed === null ? null : feed.filter((e) => e.project_id === projectId)} projects={project ? [project] : []} compact />
          </section>
        )
      ) : (
        <>
          <section className="lp-plan-canvas" aria-label={t('launch.plan.canvas')}>
            <div className="lp-plan-legend">{t('launch.plan.legend')}</div>
            {nodes === null ? <p className="lp-meta">{t('estate.reading')}</p>
              : nodes.length === 0 ? <div className="lp-empty"><h3>{t('launch.plan.empty')}</h3><p>{t(level.at === 'goal' ? 'launch.plan.emptyGoal' : 'launch.plan.emptyBody')}</p></div>
              : (
                <div className="lp-nodes" style={{ '--lp-zoom': zoom / 100 } as React.CSSProperties}>
                  {nodes.map((n) => (
                    <article key={n.key} className={`lp-node ${n.attention ? 'blocked' : ''}`}>
                      <span className="lp-node-index">{n.kicker}</span>
                      <h3>{n.title}</h3>
                      <p>{n.sub}</p>
                      <span className={`lp-pill ${n.attention ? 'attention' : ''}`}>{n.pill}</span>
                      {n.open && <div className="lp-node-actions"><button type="button" className="lp-button lh-text-link" onClick={n.open}>{n.openLabel}</button></div>}
                    </article>
                  ))}
                </div>
              )}
            <div className="lp-plan-caption">{caption}</div>
          </section>
          {nodes && nodes.length > 0 && (
            <details className="lp-panel lp-plan-list">
              <summary>{t('launch.plan.asList')}</summary>
              {nodes.map((n) => (
                <p key={n.key}><b>{n.title}</b> · {n.sub} · {n.pill} {n.open && <button type="button" className="lp-button lh-text-link" onClick={n.open}>{n.openLabel}</button>}</p>
              ))}
            </details>
          )}
        </>
      )}
    </div>
  )
}

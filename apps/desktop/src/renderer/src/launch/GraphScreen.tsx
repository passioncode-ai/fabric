// #region project-graph-screen — docs: docs/ux/scenarios.md#scn-175-see-how-a-project-is-connected-to-the-others-on-a-graph
// SCN-175 (W2 S5, OF-32): the projects as a graph. Businesses are columns (the level above their projects), the projects
// without one and the targets outside Fabric are columns of their own; lines are the relations the onboarding agents
// recorded and the board's threads between projects. Centred on a project, only it and its neighbours show. The same
// relations are listed as text beneath, so nothing on the drawing is only on the drawing.
import { useEffect, useMemo, useState } from 'react'
import { aroundProject, type GraphEdge, type GraphNode, type ProjectGraph } from '../../../shared/projectGraph'
import { useT } from '../i18n'
import { FailureNote } from '../OperatorError'

const COLUMN = 240
const ROW = 72
const NODE_W = 200
const NODE_H = 52

type Column = { key: string; title: string; nodes: GraphNode[] }

export function GraphScreen({ projectId, feedMark, onProject, onWhole }: {
  projectId: string | null
  feedMark: number
  onProject(projectId: string): void
  onWhole(): void
}): React.JSX.Element {
  const t = useT()
  const [graph, setGraph] = useState<ProjectGraph | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    Promise.resolve().then(() => window.fabric.projects.graph()).then(
      (g) => { if (alive) { setGraph(g); setProblem(null) } },
      (e: unknown) => alive && setProblem(e instanceof Error ? e.message : String(e))
    )
    return () => { alive = false }
  }, [feedMark])

  const shown = useMemo(() => (graph ? aroundProject(graph, projectId) : null), [graph, projectId])
  const centre = shown?.nodes.find((n) => n.id === projectId) ?? null
  const columns = useMemo<Column[]>(() => {
    if (!shown) return []
    const cols: Column[] = shown.businesses.map((b) => ({ key: `b:${b}`, title: b, nodes: shown.nodes.filter((n) => !n.outside && n.business === b) }))
    const none = shown.nodes.filter((n) => !n.outside && !n.business)
    if (none.length) cols.push({ key: 'none', title: t('graph.noBusiness'), nodes: none })
    const outside = shown.nodes.filter((n) => n.outside)
    if (outside.length) cols.push({ key: 'outside', title: t('graph.outside'), nodes: outside })
    for (const c of cols) c.nodes.sort((a, b) => a.name.localeCompare(b.name))
    return cols
  }, [shown, t])
  const place = useMemo(() => {
    const at = new Map<string, { x: number; y: number }>()
    columns.forEach((c, i) => c.nodes.forEach((n, j) => at.set(n.id, { x: i * COLUMN, y: 40 + j * ROW })))
    return at
  }, [columns])
  const width = Math.max(1, columns.length) * COLUMN
  const height = 40 + Math.max(1, ...columns.map((c) => c.nodes.length)) * ROW
  const nameOf = (id: string): string => shown?.nodes.find((n) => n.id === id)?.name ?? id
  const said = (e: GraphEdge): string =>
    e.kind === 'board'
      ? t('graph.boardEdge', { from: nameOf(e.from), to: nameOf(e.to), n: e.weight ?? 0 })
      : t('graph.edge', { from: nameOf(e.from), relation: t(`launch.profile.relation.${e.kind}` as 'launch.profile.relation.other', { target: nameOf(e.to) }) })

  return (
    <section className="lp" data-launch-view="graph" aria-labelledby="graph-title">
      <header className="lp-heading">
        <div>
          <h2 id="graph-title" tabIndex={-1}>{centre ? t('graph.centred', { name: centre.name }) : t('graph.title')}</h2>
          <p>{t('graph.lede')}</p>
        </div>
        {projectId && (
          <div className="lp-actions">
            <button type="button" className="lp-button" onClick={onWhole}>{t('graph.whole')}</button>
          </div>
        )}
      </header>
      {problem && <FailureNote said={t('graph.unreadable')} detail={problem} />}
      {!graph && !problem && <p className="lp-meta">{t('estate.reading')}</p>}
      {shown && shown.edges.length === 0 && <p className="lp-meta">{t('graph.empty')}</p>}
      {shown && shown.nodes.length > 0 && (
        <div className="lg-scroll">
          <div className="lg-canvas" style={{ width, height }}>
            <svg className="lg-lines" width={width} height={height} aria-hidden="true">
              {shown.edges.map((e) => {
                const a = place.get(e.from), b = place.get(e.to)
                if (!a || !b) return null
                return <line key={`${e.from}|${e.to}|${e.kind}`} className={e.kind === 'board' ? 'lg-line board' : 'lg-line'}
                  x1={a.x + NODE_W / 2} y1={a.y + NODE_H / 2} x2={b.x + NODE_W / 2} y2={b.y + NODE_H / 2} />
              })}
            </svg>
            {columns.map((c, i) => <h3 key={c.key} className="lg-column" style={{ left: i * COLUMN, width: NODE_W }}>{c.title}</h3>)}
            {columns.flatMap((c) => c.nodes).map((n) => {
              const at = place.get(n.id)!
              const style = { left: at.x, top: at.y, width: NODE_W, height: NODE_H }
              return n.outside
                ? <div key={n.id} className="lg-node outside" style={style}><b>{n.name}</b><small>{t('graph.outsideNode')}</small></div>
                : (
                  <button key={n.id} type="button" className={n.id === projectId ? 'lg-node centre' : 'lg-node'} style={style} onClick={() => onProject(n.id)}>
                    <b>{n.name}</b>
                    <small>{n.summary ?? t('graph.noSummary')}</small>
                  </button>
                )
            })}
          </div>
        </div>
      )}
      {shown && shown.edges.length > 0 && (
        <details className="lp-panel">
          <summary>{t('graph.list', { count: shown.edges.length })}</summary>
          <ul>{shown.edges.map((e) => <li key={`${e.from}|${e.to}|${e.kind}`}>{said(e)}</li>)}</ul>
        </details>
      )}
    </section>
  )
}
// #endregion project-graph-screen

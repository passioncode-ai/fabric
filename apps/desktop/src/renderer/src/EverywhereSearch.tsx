// #region everywhere-search — docs: docs/evidence/specs/2026-11-19-estate-index-and-graph.md#2-what-the-person-and-the-ceo-get
// The search panel's «Везде» group (spec 2026-11-19 §2): one ranked search over every session, transcript, task, board
// message and commit, the estate index's (ADR-0200). Its order IS a relevance rank, unlike the groups above it, and its
// header says so. Each hit names where it happened and how to continue it; «Связи» draws what relates to it, the same
// neighbourhood the CEO's `graph.neighbours` answers, and lists it as text beneath so nothing is only on the drawing.
import { useEffect, useState } from 'react'
import { ringLayout, type AroundAnswer, type EverywhereAnswer, type EverywhereHit } from '../../shared/estateSearch.ts'
import { Button, Row } from './components'
import { useT } from './i18n'

const SIZE = 420
const NODE_W = 150
const NODE_H = 40

export function EverywhereSearch({ query, onError }: { query: string; onError: (message: string) => void }): React.JSX.Element | null {
  const t = useT()
  const [answer, setAnswer] = useState<EverywhereAnswer | null>(null)
  const [around, setAround] = useState<{ node: string; answer: AroundAnswer } | null>(null)
  const [said, setSaid] = useState<string | null>(null)

  useEffect(() => {
    const text = query.trim()
    setAround(null)
    if (text.length < 2) { setAnswer(null); return }
    let alive = true
    const timer = setTimeout(() => {
      window.fabric.search.everywhere(text).then((a) => { if (alive) setAnswer(a) }, (e: unknown) => alive && onError(String(e)))
    }, 300)
    return () => { alive = false; clearTimeout(timer) }
  }, [query])

  const walk = (node: string): void => {
    window.fabric.search.around(node, 2).then((a) => setAround({ node, answer: a }), (e: unknown) => onError(String(e)))
  }
  const resume = (hit: EverywhereHit): void => {
    if (!hit.session_id) return
    window.fabric.search.resume(hit.session_id).then(
      (r) => setSaid(r.ok ? t('everywhere.resumed') : t('everywhere.notResumed', { reason: r.reason ?? '' })),
      (e: unknown) => onError(String(e)))
  }
  const copy = (text: string): void => { void navigator.clipboard.writeText(text).then(() => setSaid(t('everywhere.copied'))) }

  if (!answer) return null
  return (
    <div className="widget-list" data-search-group="everywhere">
      <h3 className="task-history-head">{t('everywhere.title')}</h3>
      <p className="muted">{t('everywhere.method')}</p>
      {!answer.ok && <p className="muted">{t('search.unsearchable', { reason: answer.reason })}</p>}
      {answer.ok && answer.degraded.includes('vector-unavailable') && <p className="muted">{t('everywhere.wordsOnly')}</p>}
      {answer.ok && answer.hits.length === 0 && <p className="muted">{t('everywhere.nothing', { docs: answer.docs })}</p>}
      {said && <p className="muted" role="status">{said}</p>}
      {answer.ok && answer.hits.map((hit) => (
        <Row key={hit.id}
          lead={<span className="muted">{t(`everywhere.kind.${hit.kind}` as 'everywhere.kind.task')}</span>}
          trail={
            <span className="everywhere-acts">
              <Button tone="ghost" onClick={() => walk(hit.node)}>{t('everywhere.links')}</Button>
              {hit.session_id && <Button tone="ghost" onClick={() => resume(hit)}>{t('everywhere.resume')}</Button>}
              {hit.resume && <Button tone="ghost" onClick={() => copy(hit.resume!)}>{t('everywhere.copy')}</Button>}
            </span>
          }>
          <b>{hit.title}</b>
          <span className="muted"> · {[hit.project ?? hit.folder, hit.context, hit.at?.slice(0, 10)].filter(Boolean).join(' · ')}</span>
          <br /><span>{hit.passage}</span>
        </Row>
      ))}
      {around && <Around state={around} onWalk={walk} />}
    </div>
  )
}

function Around({ state, onWalk }: { state: { node: string; answer: AroundAnswer }; onWalk: (node: string) => void }): React.JSX.Element {
  const t = useT()
  const a = state.answer
  if (!a.ok) return <p className="muted">{t('search.unsearchable', { reason: a.reason })}</p>
  const at = ringLayout(a.nodes, SIZE)
  const c = SIZE / 2
  return (
    <section className="everywhere-around" aria-label={t('everywhere.aroundTitle', { name: a.start?.label ?? state.node })}>
      <h3 className="task-history-head">{t('everywhere.aroundTitle', { name: a.start?.label ?? state.node })}</h3>
      {a.nodes.length === 0 ? <p className="muted">{t('everywhere.aroundEmpty')}</p> : (
        <div className="lg-scroll">
          <div className="lg-canvas" style={{ width: SIZE + NODE_W, height: SIZE + NODE_H }}>
            <svg className="lg-lines" width={SIZE + NODE_W} height={SIZE + NODE_H} aria-hidden="true">
              {a.nodes.map((n) => { const p = at.get(n.id)!; return <line key={n.id} className={n.hop > 1 ? 'lg-line board' : 'lg-line'} x1={c + NODE_W / 2} y1={c + NODE_H / 2} x2={p.x + NODE_W / 2} y2={p.y + NODE_H / 2} /> })}
            </svg>
            <div className="lg-node centre" style={{ left: c, top: c, width: NODE_W, height: NODE_H }}><b>{a.start?.label ?? state.node}</b><small>{a.start?.kind ?? ''}</small></div>
            {a.nodes.map((n) => { const p = at.get(n.id)!; return (
              <button key={n.id} type="button" className="lg-node" style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H }} onClick={() => onWalk(n.id)}>
                <b>{n.label ?? n.id}</b><small>{n.kind ?? ''} · {n.rel}</small>
              </button>) })}
          </div>
        </div>
      )}
      {a.nodes.length > 0 && (
        <details className="lp-panel">
          <summary>{t('everywhere.aroundList', { count: a.nodes.length })}</summary>
          <ul>{a.nodes.map((n) => <li key={n.id}>{t('everywhere.edge', { hop: n.hop, rel: n.rel, name: n.label ?? n.id })}</li>)}</ul>
        </details>
      )}
      {a.capped && <p className="muted">{t('everywhere.aroundCapped')}</p>}
    </section>
  )
}
// #endregion everywhere-search

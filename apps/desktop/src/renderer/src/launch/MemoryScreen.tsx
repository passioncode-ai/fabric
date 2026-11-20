// #region memory-screen — docs: docs/ux/scenarios.md#scn-190-see-what-fabric-knows-about-every-project-and-where-each-answer-comes-from
// Memory (SCN-190, SCR-92; spec docs/evidence/specs/2026-11-20-memory-dashboard.md): Fabric's knowledge base of every
// project as one dashboard. The overview and each source's freshness, the organizations and their projects on the map
// of @fabric/graph with the board's requests between projects, a project's card, the search with its citations checked,
// and what changed. Every part reads the execute operations the CEO's doors run (window.fabric.memoryIndex), and the map
// has its text twin (the table) beneath it.
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { EverywhereAnswer, EverywhereHit } from '../../../shared/estateSearch'
import type { MemoryChanges, MemoryCheck, MemoryGraph, MemoryIndexOverview, MemoryRefusal } from '../../../shared/memory'
import { GraphMap, GraphTable, type GraphData, type GraphNode } from '../graph'
import { useLocale, useT } from '../i18n'
import { FailureNote } from '../OperatorError'
import './memory.css'

/** How often the dashboard reads again while it shows: the index passes every five minutes, freshness ages meanwhile. */
const REFRESH_MS = 60_000
const KINDS = ['session', 'turn', 'task', 'message', 'commit', 'document'] as const

/** Memory's graph in @fabric/graph's model: an organization is a hub, a project stands in its organization's group. */
export function memoryGraphData(g: MemoryGraph): GraphData {
  return {
    nodes: g.nodes.map((n): GraphNode => n.kind === 'organization'
      ? { id: n.id, kind: 'organization', label: n.label, size: n.docs, attrs: { projects: n.projects ?? 0, context: n.context } }
      : { id: n.id, kind: 'project', label: n.label, group: `ctx:${n.context}`, size: n.docs, at: n.lastAt ?? null, attrs: { byKind: n.byKind ?? {}, folder: n.folder ?? null, context: n.context } }),
    edges: g.edges.map((e) => ({ from: e.source, to: e.target, kind: e.kind, weight: e.weight }))
  }
}

/** The passage of a hit as a quote: without the ellipses that mark where it was cut, at most 600 characters. */
export function quoteOf(passage: string): string {
  return passage.replace(/^[\s…]+|[\s…]+$/g, '').replace(/…/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600)
}

export function MemoryScreen({ onError }: { onError(message: string): void }): React.JSX.Element {
  const t = useT(), locale = useLocale()
  const [overview, setOverview] = useState<MemoryIndexOverview | MemoryRefusal | null>(null)
  const [graph, setGraph] = useState<(MemoryGraph & { ok: true }) | MemoryRefusal | null>(null)
  const [changes, setChanges] = useState<MemoryChanges | MemoryRefusal | null>(null)
  const [hours, setHours] = useState(24)
  const [picked, setPicked] = useState<GraphNode | null>(null)
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<EverywhereAnswer | null>(null)
  const [checks, setChecks] = useState<Record<string, MemoryCheck | MemoryRefusal | 'checking'>>({})
  const [tick, setTick] = useState(0)

  const project = picked?.kind === 'project' ? picked.label : undefined
  const fail = useCallback((e: unknown) => onError(e instanceof Error ? e.message : String(e)), [onError])

  useEffect(() => {
    let alive = true
    const read = () => {
      Promise.resolve().then(() => window.fabric.memoryIndex.overview()).then((o) => alive && setOverview(o), (e: unknown) => alive && setOverview({ ok: false, reason: String(e) }))
      Promise.resolve().then(() => window.fabric.memoryIndex.graph()).then((g) => alive && setGraph(g), (e: unknown) => alive && setGraph({ ok: false, reason: String(e) }))
    }
    read()
    const timer = setInterval(read, REFRESH_MS)
    return () => { alive = false; clearInterval(timer) }
  }, [tick])

  useEffect(() => {
    let alive = true
    Promise.resolve().then(() => window.fabric.memoryIndex.changes(hours, project)).then((c) => alive && setChanges(c), (e: unknown) => alive && setChanges({ ok: false, reason: String(e) }))
    return () => { alive = false }
  }, [hours, project, tick])

  useEffect(() => {
    const text = query.trim()
    if (text.length < 2) { setFound(null); return }
    let alive = true
    const timer = setTimeout(() => {
      Promise.resolve().then(() => window.fabric.memoryIndex.search(text, project)).then(
        (a) => alive && setFound(a), (e: unknown) => alive && setFound({ ok: false, reason: e instanceof Error ? e.message : String(e) }))
    }, 300)
    return () => { alive = false; clearTimeout(timer) }
  }, [query, project])

  const data = useMemo(() => (graph && graph.ok ? memoryGraphData(graph) : null), [graph])
  const num = (n: number) => n.toLocaleString(locale)
  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : t('memoryBase.never'))
  const orgLabel = (group: string) => data?.nodes.find((n) => n.id === group)?.label ?? group

  const check = (hit: EverywhereHit) => {
    const quote = quoteOf(hit.passage)
    setChecks((c) => ({ ...c, [hit.id]: 'checking' }))
    window.fabric.memoryIndex.check([{ quote, doc: hit.id, digest: hit.digest }]).then(
      (r) => setChecks((c) => ({ ...c, [hit.id]: r })), (e: unknown) => { setChecks((c) => { const n = { ...c }; delete n[hit.id]; return n }); fail(e) })
  }

  const ov = overview && overview.ok ? overview : null
  const vectorsShare = ov && ov.vectors.of > 0 ? Math.round((1000 * ov.vectors.embedded) / ov.vectors.of) / 10 : 0
  const catching = ov?.sources.find((s) => s.source === 'transcripts' && s.left > 0)

  return (
    <section className="lp memory" data-launch-view="memory" aria-labelledby="memory-title">
      <header className="lp-heading">
        <div>
          <h2 id="memory-title" tabIndex={-1}>{t('memoryBase.title')}</h2>
          <p className="lp-meta">{t('memoryBase.lead')}</p>
        </div>
        <div className="lp-actions">
          <button type="button" className="lp-button" onClick={() => setTick((n) => n + 1)}>{t('memoryBase.refresh')}</button>
        </div>
      </header>

      {!overview && <p className="lp-meta" role="status">{t('estate.reading')}</p>}
      {overview && !overview.ok && <FailureNote said={t('memoryBase.notOpen')} detail={overview.reason} />}

      {ov && (
        <>
          <dl className="memory-stats" aria-label={t('memoryBase.statsLabel')}>
            <div><dt>{t('memoryBase.stat.docs')}</dt><dd>{num(ov.docs)}</dd></div>
            <div><dt>{t('memoryBase.stat.projects')}</dt><dd>{num(ov.projects)}</dd></div>
            {KINDS.map((k) => <div key={k}><dt>{t(`memoryBase.stat.kind.${k}` as 'memoryBase.stat.kind.task')}</dt><dd>{num(ov.byKind[k] ?? 0)}</dd></div>)}
            <div><dt>{t('memoryBase.stat.graph')}</dt><dd>{t('memoryBase.stat.graphValue', { nodes: num(ov.nodes), edges: num(ov.edges) })}</dd></div>
            <div><dt>{t('memoryBase.stat.vectors')}</dt><dd>{t('memoryBase.stat.vectorsValue', { share: vectorsShare.toLocaleString(locale), n: num(ov.vectors.embedded) })}</dd></div>
            {ov.bytes !== null && <div><dt>{t('memoryBase.stat.size')}</dt><dd>{t('memoryBase.stat.mb', { mb: num(Math.round(ov.bytes / 1_048_576)) })}</dd></div>}
          </dl>
          {catching && <p className="lp-meta" role="status">{t('memoryBase.catching', { left: num(catching.left) })}</p>}
          <ul className="memory-sources" aria-label={t('memoryBase.sourcesLabel')}>
            {ov.sources.map((s) => (
              <li key={s.source} className={`memory-source f-${s.state}`}>
                <b>{t(`memoryBase.source.${s.source}` as 'memoryBase.source.git')}</b>
                <span>{t(`memoryBase.state.${s.state}` as 'memoryBase.state.fresh')}</span>
                <small>{s.readAt ? t('memoryBase.readAt', { when: when(s.readAt) }) : t('memoryBase.never')}</small>
                {s.left > 0 && <small>{t('memoryBase.left', { n: num(s.left) })}</small>}
                {s.unread > 0 && <small>{t('memoryBase.unread', { n: num(s.unread) })}</small>}
                {s.error && <small title={s.error}>{t('memoryBase.error')}</small>}
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="memory-grid">
        <div className="memory-main">
          <h3 className="memory-head">{t('memoryBase.graphTitle')}</h3>
          {graph && !graph.ok && <FailureNote said={t('memoryBase.graphUnread')} detail={graph.reason} />}
          {data && data.nodes.length === 0 && <p className="lp-meta">{t('memoryBase.graphEmpty')}</p>}
          {data && data.nodes.length > 0 && (
            <>
              <GraphMap data={data} focus={picked?.id ?? null} onPick={setPicked} hubs={(n) => n.kind === 'organization'}
                label={t('memoryBase.graphLabel', { orgs: graph && graph.ok ? graph.organizations.length : 0, projects: data.nodes.filter((n) => n.kind === 'project').length })}
                noCanvas={t('memoryBase.noCanvas')} fitLabel={t('memoryBase.fit')} />
              <p className="lp-meta">{t('memoryBase.graphHow')}</p>
              {picked && <ProjectCard node={picked} onClose={() => setPicked(null)} num={num} when={when} orgLabel={orgLabel} />}
              <details className="lp-panel">
                <summary>{t('memoryBase.tableSummary')}</summary>
                <GraphTable data={data} caption={t('memoryBase.tableCaption')} rows={(n) => n.kind === 'project'} groupTitle={orgLabel}
                  onPick={setPicked} pickLabel={(n) => t('memoryBase.pick', { name: n.label })}
                  columns={[
                    { key: 'name', title: t('memoryBase.col.project'), value: (n) => n.label },
                    { key: 'docs', title: t('memoryBase.stat.docs'), value: (n) => num(n.size ?? 0), numeric: true },
                    { key: 'board', title: t('memoryBase.col.board'), value: (_n, degree) => num(Math.max(0, degree - 1)), numeric: true },
                    { key: 'last', title: t('memoryBase.col.last'), value: (n) => when(n.at ?? null) }
                  ]} />
              </details>
            </>
          )}
        </div>

        <aside className="memory-side">
          <h3 className="memory-head">{project ? t('memoryBase.searchIn', { name: project }) : t('memoryBase.searchTitle')}</h3>
          <input type="search" className="memory-search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={t('memoryBase.searchPlaceholder')} aria-label={t('memoryBase.searchTitle')} />
          {found && !found.ok && <p className="lp-meta">{t('search.unsearchable', { reason: found.reason })}</p>}
          {found && found.ok && found.degraded.includes('vector-unavailable') && <p className="lp-meta">{t('everywhere.wordsOnly')}</p>}
          {found && found.ok && found.hits.length === 0 && <p className="lp-meta">{t('everywhere.nothing', { docs: num(found.docs) })}</p>}
          {found && found.ok && found.hits.length > 0 && (
            <ol className="memory-hits">
              {found.hits.map((h) => {
                const c = checks[h.id]
                return (
                  <li key={h.id}>
                    <span className="memory-hit-top">{t(`everywhere.kind.${h.kind}` as 'everywhere.kind.task')} · {[h.project ?? h.folder, h.at?.slice(0, 10)].filter(Boolean).join(' · ')}</span>
                    <b>{h.title}</b>
                    <blockquote className="memory-quote">{h.passage}</blockquote>
                    {h.cite && <code className="memory-cite">{h.cite}</code>}
                    <span className="memory-hit-acts">
                      <button type="button" className="lp-button" disabled={c === 'checking'} onClick={() => check(h)}>{t('memoryBase.check')}</button>
                      {c && c !== 'checking' && (c.ok
                        ? <span className={c.kept ? 'memory-verdict ok' : 'memory-verdict no'} role="status">{c.kept ? t('memoryBase.verified') : t('memoryBase.notVerified', { reason: t(`memoryBase.reason.${c.verdicts[0]?.reason ?? 'not-verbatim'}` as 'memoryBase.reason.not-verbatim') })}</span>
                        : <span className="memory-verdict no" role="status">{t('memoryBase.notChecked', { reason: c.reason })}</span>)}
                    </span>
                  </li>
                )
              })}
            </ol>
          )}

          <h3 className="memory-head">{project ? t('memoryBase.changesIn', { name: project }) : t('memoryBase.changesTitle')}</h3>
          <div className="memory-window" role="group" aria-label={t('memoryBase.windowLabel')}>
            {[24, 168].map((h) => <button key={h} type="button" className="lp-button" aria-pressed={hours === h} onClick={() => setHours(h)}>{t(h === 24 ? 'memoryBase.day' : 'memoryBase.week')}</button>)}
          </div>
          {changes && !changes.ok && <p className="lp-meta">{t('memoryBase.changesUnread', { reason: changes.reason })}</p>}
          {changes && changes.ok && changes.changes.length === 0 && <p className="lp-meta">{t('memoryBase.changesNone')}</p>}
          {changes && changes.ok && changes.changes.length > 0 && (
            <ul className="memory-changes">
              {changes.changes.slice(0, 30).map((c) => (
                <li key={`${c.project ?? ''}|${c.kind}`}>
                  <span className="memory-hit-top">{c.project ?? t('memoryBase.noProject')} · {t(`everywhere.kind.${c.kind}` as 'everywhere.kind.task')} · {num(c.count)}</span>
                  <ul>{c.newest.slice(0, 3).map((x) => <li key={x.id}>{x.title}{x.at && <time dateTime={x.at}> · {when(x.at)}</time>}</li>)}</ul>
                </li>
              ))}
            </ul>
          )}
          {changes && changes.ok && changes.capped && <p className="lp-meta">{t('memoryBase.changesCapped')}</p>}
        </aside>
      </div>
    </section>
  )
}

function ProjectCard({ node, onClose, num, when, orgLabel }: { node: GraphNode; onClose(): void; num(n: number): string; when(iso: string | null): string; orgLabel(g: string): string }): React.JSX.Element {
  const t = useT()
  const byKind = (node.attrs?.byKind ?? {}) as Record<string, number>
  return (
    <section className="memory-card" aria-label={t('memoryBase.cardLabel', { name: node.label })}>
      <header>
        <b>{node.label}</b>
        <span className="lp-meta">{node.kind === 'organization' ? t('memoryBase.org') : orgLabel(node.group ?? '')}</span>
        <button type="button" className="lp-button" onClick={onClose}>{t('memoryBase.cardClose')}</button>
      </header>
      {node.kind === 'organization'
        ? <p>{t('memoryBase.orgLine', { projects: num(Number(node.attrs?.projects ?? 0)), docs: num(node.size ?? 0) })}</p>
        : (
          <>
            <p>{t('memoryBase.projectLine', { docs: num(node.size ?? 0), when: when(node.at ?? null) })}</p>
            <ul className="memory-kinds">{Object.entries(byKind).sort((a, b) => b[1] - a[1]).map(([k, n]) => <li key={k}>{t(`everywhere.kind.${k}` as 'everywhere.kind.task')}: {num(n)}</li>)}</ul>
            <p className="lp-meta">{t('memoryBase.cardHint')}</p>
          </>
        )}
    </section>
  )
}
// #endregion memory-screen

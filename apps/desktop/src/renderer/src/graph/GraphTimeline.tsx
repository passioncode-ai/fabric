// #region graph-timeline — docs: docs/evidence/specs/2026-11-20-memory-dashboard.md#6-one-graph-module
// The time line view of @fabric/graph: the nodes as cards, oldest first, each with its kind, who stands behind it and
// its state; lanes by group when asked (`groupBy`); with `onlyPeople` the agents' steps between people's commands fold
// into one line that opens in place. No canvas and no WebGL: it is a list, so a screen reader reads it as one.
import { useMemo, useState } from 'react'
import { byTime, collapseAgents, groupsOf, type GraphData, type GraphNode, type TimelineItem } from '@fabric/graph/model'

export interface GraphTimelineProps {
  data: GraphData
  focus?: string | null
  onPick?(node: GraphNode): void
  onlyPeople?: boolean
  groupBy?: 'group'
  /** The words the view needs from the host's language. */
  words: {
    folded(count: number): string
    actor(actor: NonNullable<GraphNode['actor']>): string
    state(state: NonNullable<GraphNode['state']>): string
    lane(group: string): string
    when(at: string): string
  }
}

function Card({ node, focus, onPick, words }: { node: GraphNode; focus?: string | null; onPick?(n: GraphNode): void; words: GraphTimelineProps['words'] }): React.JSX.Element {
  const body = (
    <>
      <span className="graph-card-top">
        <span className="graph-card-kind">{node.kind}</span>
        {node.actor && <span className={`graph-card-actor a-${node.actor}`}>{words.actor(node.actor)}</span>}
        {node.state && <span className={`graph-card-state s-${node.state}`}>{words.state(node.state)}</span>}
        {node.at && <time dateTime={node.at}>{words.when(node.at)}</time>}
      </span>
      <span className="graph-card-label">{node.label}</span>
    </>
  )
  return onPick
    ? <button type="button" className={node.id === focus ? 'graph-card on' : 'graph-card'} aria-current={node.id === focus ? 'true' : undefined} onClick={() => onPick(node)}>{body}</button>
    : <div className={node.id === focus ? 'graph-card on' : 'graph-card'}>{body}</div>
}

function Lane({ items, focus, onPick, words }: { items: TimelineItem[]; focus?: string | null; onPick?(n: GraphNode): void; words: GraphTimelineProps['words'] }): React.JSX.Element {
  const [open, setOpen] = useState<Set<number>>(new Set())
  return (
    <ol className="graph-lane">
      {items.map((it, i) => it.kind === 'node'
        ? <li key={it.node.id}><Card node={it.node} focus={focus} onPick={onPick} words={words} /></li>
        : (
          <li key={`f${i}`} className="graph-folded">
            <button type="button" aria-expanded={open.has(i)} onClick={() => setOpen((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n })}>
              {words.folded(it.nodes.length)}
            </button>
            {open.has(i) && <ol>{it.nodes.map((n) => <li key={n.id}><Card node={n} focus={focus} onPick={onPick} words={words} /></li>)}</ol>}
          </li>
        ))}
    </ol>
  )
}

export function GraphTimeline({ data, focus = null, onPick, onlyPeople = false, groupBy, words }: GraphTimelineProps): React.JSX.Element {
  const lanes = useMemo(() => {
    const ordered = byTime(data)
    const names = groupBy === 'group' ? groupsOf(ordered) : ['']
    return names.map((g) => {
      const nodes = groupBy === 'group' ? ordered.filter((n) => (n.group ?? '') === g) : ordered
      const items: TimelineItem[] = onlyPeople ? collapseAgents(nodes) : nodes.map((node) => ({ kind: 'node', node }))
      return { group: g, items }
    })
  }, [data, groupBy, onlyPeople])
  if (lanes.length === 1) return <div className="graph-timeline"><Lane items={lanes[0]!.items} focus={focus} onPick={onPick} words={words} /></div>
  return (
    <div className="graph-timeline lanes">
      {lanes.map((l) => (
        <section key={l.group || '-'} className="graph-lane-wrap" aria-label={words.lane(l.group)}>
          <h4>{words.lane(l.group)}</h4>
          <Lane items={l.items} focus={focus} onPick={onPick} words={words} />
        </section>
      ))}
    </div>
  )
}
// #endregion graph-timeline

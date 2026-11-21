// #region graph-table — docs: docs/evidence/specs/2026-11-20-memory-dashboard.md#6-one-graph-module
// The table view of @fabric/graph: the same nodes as rows, grouped, with their size, time, state and how many lines join
// them. It is the text twin of the map and the time line, so nothing is only on a drawing; a row opens the node.
import { useMemo } from 'react'
import { joined, type GraphData, type GraphNode } from '@fabric/graph/model'

export interface GraphTableColumn { key: string; title: string; value(node: GraphNode, degree: number): React.ReactNode; numeric?: boolean }

export interface GraphTableProps {
  data: GraphData
  caption: string
  columns: GraphTableColumn[]
  /** A group's title above its rows; rows with no group come first under no title. */
  groupTitle?(group: string): string
  /** Which nodes are rows (a host may keep its hubs out, since they head the groups). */
  rows?(node: GraphNode): boolean
  onPick?(node: GraphNode): void
  pickLabel?(node: GraphNode): string
}

export function GraphTable({ data, caption, columns, groupTitle, rows, onPick, pickLabel }: GraphTableProps): React.JSX.Element {
  const degree = useMemo(() => {
    const d = new Map<string, number>()
    for (const e of joined(data).edges) { d.set(e.from, (d.get(e.from) ?? 0) + 1); d.set(e.to, (d.get(e.to) ?? 0) + 1) }
    return d
  }, [data])
  const grouped = useMemo(() => {
    const keep = data.nodes.filter((n) => (rows ? rows(n) : true))
    const out = new Map<string, GraphNode[]>()
    for (const n of keep) { const g = n.group ?? ''; (out.get(g) ?? out.set(g, []).get(g)!).push(n) }
    for (const list of out.values()) list.sort((a, b) => (b.size ?? 0) - (a.size ?? 0) || a.label.localeCompare(b.label))
    return [...out.entries()]
  }, [data, rows])
  return (
    <table className="graph-table">
      <caption>{caption}</caption>
      <thead><tr>{columns.map((c) => <th key={c.key} scope="col" className={c.numeric ? 'num' : undefined}>{c.title}</th>)}</tr></thead>
      {grouped.map(([group, list]) => (
        <tbody key={group || '-'}>
          {group && groupTitle && <tr className="graph-table-group"><th colSpan={columns.length} scope="colgroup">{groupTitle(group)}</th></tr>}
          {list.map((n) => (
            <tr key={n.id}>
              {columns.map((c, i) => (
                <td key={c.key} className={c.numeric ? 'num' : undefined}>
                  {i === 0 && onPick
                    ? <button type="button" className="graph-table-pick" aria-label={pickLabel?.(n)} onClick={() => onPick(n)}>{c.value(n, degree.get(n.id) ?? 0)}</button>
                    : c.value(n, degree.get(n.id) ?? 0)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  )
}
// #endregion graph-table

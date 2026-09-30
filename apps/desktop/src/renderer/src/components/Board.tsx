import type { ReactNode } from 'react'
import { EmptyState } from './EmptyState'

/**
 * The board (M146 step 2) — a projection of the journal, drawn in columns.
 *
 * THE RULE IT CARRIES: a column always states its count, and an empty column
 * says it is empty rather than rendering as nothing. A board whose columns go
 * blank when they empty is indistinguishable from a board that failed to load,
 * and the difference matters most exactly when the operator is anxious about
 * whether anything is running.
 *
 * `read` is threaded to every column for the same reason `EmptyState` demands
 * it (M108): before the projection has been read, a column knows nothing and
 * must say nothing — not "empty", which is an answer.
 */
export function Board({ children }: { children: ReactNode }): React.JSX.Element {
  return <div className="board">{children}</div>
}

export function BoardColumn({
  title,
  count,
  read,
  empty,
  onDrop,
  children
}: {
  title: string
  count: number
  /** False until the projection has been read; see the header. */
  read: boolean
  /** What this column says when it has read and holds nothing. */
  empty: string
  /** Present when this column will accept a dragged card. Absent columns do
   *  not merely reject a drop — they never offer one, so the operator is not
   *  invited to make a move the ladder will refuse. */
  onDrop?: () => void
  children: ReactNode
}): React.JSX.Element {
  return (
    <section
      className={onDrop ? 'board-column board-column-target' : 'board-column'}
      onDragOver={onDrop ? (e) => e.preventDefault() : undefined}
      onDrop={onDrop ? (e) => { e.preventDefault(); onDrop() } : undefined}
    >
      <div className="board-column-head">
        <span className="board-column-title">{title}</span>
        <span className="board-count">{count}</span>
      </div>
      <div className="board-column-body">
        {count === 0 ? <EmptyState read={read}>{empty}</EmptyState> : children}
      </div>
    </section>
  )
}

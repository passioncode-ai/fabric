import type { ReactNode } from 'react'

/**
 * One task on the board (M146).
 *
 * THE RULE IT CARRIES: a card never appears without its provenance. The origin
 * glyph says whether an agent or a person put this here, and the assignment
 * says between whom it moved — the two facts M130 exists to make ordinary. A
 * card that shows only a title turns "who decided this" into archaeology.
 *
 * THE SECOND RULE, ADDED IN STEP 4: dragging is an ACCELERATOR, never the
 * mechanism. HTML drag-and-drop is mouse-only, so a board you can only operate
 * by dragging is a board a keyboard cannot use — the same failure `Row` exists
 * to prevent. The moves therefore live in a `<select>`, which is keyboard and
 * screen-reader native and, better than either, makes the legal moves VISIBLE
 * instead of discoverable by trying. The list comes from `mayMove`, so what the
 * operator is offered and what the ladder allows cannot drift.
 */
export function TaskCard({
  title,
  origin,
  by,
  trail,
  moves,
  moveBusy,
  onMove,
  onOpen,
  onDragStart,
  quiet,
  moveLabel,
  note
}: {
  title: string
  /** The glyph for who filed it: an agent or a person. */
  origin: string
  by?: string | null
  trail?: ReactNode
  /** Every destination the ladder allows from here, already filtered. */
  moves?: readonly { value: string; label: string }[]
  /** A command for THIS card is unresolved, so the control is closed until
   *  it settles. Two commands for one card are two answers to reconcile in
   *  whatever order they arrive (UX28-04). */
  moveBusy?: boolean
  onMove?: (to: string) => void
  /** The one useful thing to do with this card besides moving it. */
  onOpen?: () => void
  onDragStart?: () => void
  /** A closed outcome, drawn back so live work reads first. */
  quiet?: boolean
  /** The placeholder the move control shows when nothing is selected. */
  moveLabel?: string
  /** What the mover makes this column MEAN (M124). Rendered only when there is
   *  something to say — `provenance.ts` owns that judgement, so a card does not
   *  grow a line under it for every state. */
  note?: { text: string; warn: boolean } | null
}): React.JSX.Element {
  const classes = ['task-card']
  if (quiet) classes.push('task-card-quiet')
  return (
    <div
      className={classes.join(' ')}
      draggable={onDragStart !== undefined}
      onDragStart={onDragStart}
    >
      {onOpen ? (
        <button type="button" className="task-card-title task-card-interactive" onClick={onOpen}>
          {title}
        </button>
      ) : (
        <span className="task-card-title">{title}</span>
      )}
      <span className="task-card-meta">
        <span className="task-card-origin">{origin}</span>
        {by !== null && by !== undefined && <span className="task-card-hand">{by}</span>}
        {trail !== undefined && <span className="task-card-trail">{trail}</span>}
      </span>
      {note && (
        <span className={note.warn ? 'task-card-note task-card-note-warn' : 'task-card-note'}>
          {note.text}
        </span>
      )}
      {moves !== undefined && moves.length > 0 && onMove !== undefined && (
        <select
          className="task-card-move"
          // The placeholder option describes this control only while nothing is
          // chosen; a screen reader announces the VALUE, so the identity has to
          // be a name rather than an option (UX28-14).
          aria-label={moveLabel}
          value=""
          disabled={moveBusy}
          onChange={(e) => {
            const to = e.target.value
            if (to) onMove(to)
          }}
        >
          <option value="">{moveLabel}</option>
          {moves.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

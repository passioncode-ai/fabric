import type { ReactNode } from 'react'

/**
 * One line in a list (M117): an optional lead cell, the content, an optional
 * trailing cell. Absorbs eight row shapes that differed only in which of the
 * three they used.
 *
 * `onClick` turns it into a real `<button>` rather than a clickable `<div>`,
 * because a row that responds to a click and does not respond to Enter is a
 * control only a mouse can reach.
 */
export function Row({
  lead,
  trail,
  quiet,
  onClick,
  title,
  children
}: {
  lead?: ReactNode
  trail?: ReactNode
  quiet?: boolean
  onClick?: () => void
  title?: string
  children: ReactNode
}): React.JSX.Element {
  const classes = ['row']
  if (onClick) classes.push('row-interactive')
  if (quiet) classes.push('row-quiet')
  const inner = (
    <>
      {lead !== undefined && <span className="row-lead">{lead}</span>}
      <span className="row-main">{children}</span>
      {trail !== undefined && <span className="row-trail">{trail}</span>}
    </>
  )
  return onClick ? (
    <button type="button" className={classes.join(' ')} onClick={onClick} title={title}>
      {inner}
    </button>
  ) : (
    <div className={classes.join(' ')} title={title}>
      {inner}
    </div>
  )
}

import type { ReactNode } from 'react'

/**
 * The one resting container (M117, `docs/brand/ui.md` §Component and state rules):
 * fill plus a one-pixel hairline, never a shadow — shadows are reserved for what
 * actually floats. `.panel` and `.widget` were the same object with different
 * padding, so `quiet` is that difference made explicit rather than a second class.
 */
export function Panel({
  title,
  actions,
  quiet,
  wide,
  onClick,
  id,
  className,
  children
}: {
  /** Rendered as the panel's heading. Omit for a container with no title. */
  title?: ReactNode
  /** Controls that belong to this panel, placed opposite the title. */
  actions?: ReactNode
  /** Tighter padding — what `.widget` used to be. */
  quiet?: boolean
  /** Two columns of the surrounding grid, where the grid has them. */
  wide?: boolean
  /**
   * Makes the whole panel one control — a card. Renders a real `<button>` for
   * the same reason `Row` does: a card a mouse can open and a keyboard cannot is
   * not a control. Added while migrating the estate home, which had a
   * `.project-card` that was exactly this and outside the set.
   */
  onClick?: () => void
  /**
   * An anchor. The status bar navigates by scrolling to a section, so a panel
   * that cannot be addressed cannot be a destination — found while migrating the
   * project page, where six panels were already carrying `id` by hand.
   */
  id?: string
  className?: string
  children?: ReactNode
}): React.JSX.Element {
  const classes = ['panel']
  if (onClick) classes.push('panel-interactive')
  if (quiet) classes.push('panel-quiet')
  if (wide) classes.push('span-2')
  if (className) classes.push(className)
  const inner = (
    <>
      {(title !== undefined || actions !== undefined) && (
        <header className="panel-head">
          {title !== undefined ? <h2 className="panel-title">{title}</h2> : <span />}
          {actions}
        </header>
      )}
      {children}
    </>
  )
  return onClick ? (
    <button type="button" id={id} className={classes.join(' ')} onClick={onClick}>
      {inner}
    </button>
  ) : (
    <section id={id} className={classes.join(' ')}>
      {inner}
    </section>
  )
}

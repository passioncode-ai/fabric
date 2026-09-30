import type { ReactNode } from 'react'

/**
 * A measured number with its label (M117). `.stat-value` was declared TWICE in
 * `styles.css` — at `:175` and again at `:297` — which is what a set with no
 * home looks like from the inside.
 *
 * `value` is `ReactNode` rather than `number` on purpose: a statistic that has
 * not been read yet must be able to render as an em dash rather than as a
 * confident zero.
 */
export function Stat({
  label,
  value,
  onClick,
  title
}: {
  label: ReactNode
  value: ReactNode
  /**
   * Makes the figure open its own evidence — the section, row or receipt it was
   * counted from. A real `<button>` for the same reason `Row` and `Panel` are:
   * a number a mouse can follow and a keyboard cannot is not a link.
   *
   * This is the shape the project's status bar already had by hand, and the
   * screens' own state tables state the rule it serves: every fact opens its
   * receipt.
   */
  onClick?: () => void
  title?: string
}): React.JSX.Element {
  const inner = (
    <>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </>
  )
  return onClick ? (
    <button type="button" className="stat stat-interactive" onClick={onClick} title={title}>
      {inner}
    </button>
  ) : (
    <div className="stat" title={title}>
      {inner}
    </div>
  )
}

/** A horizontal band of statistics. */
export function StatStrip({ children }: { children: ReactNode }): React.JSX.Element {
  return <div className="stat-strip">{children}</div>
}

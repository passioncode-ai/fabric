import type { ReactNode } from 'react'

/**
 * A band of facts that navigate (M117).
 *
 * In the set rather than inline for the reason the registry states: it owns six
 * classes that carry appearance, and a class with appearance belongs to a
 * component or to nobody. `Stat` was the near miss — these cells hold
 * heterogeneous content (a dot, several ticks, a branch name) rather than one
 * value and one label, and forcing them into `Stat` would have distorted both.
 *
 * The rule the cells serve is written in the screens' own state tables: EVERY
 * FACT OPENS ITS RECEIPT. A cell with `onClick` becomes a real `<button>`, so
 * the evidence behind a number is reachable from a keyboard and not only from a
 * mouse.
 */
export function StatusBar({ label, children }: { label: string; children: ReactNode }): React.JSX.Element {
  return (
    <section className="status-bar" aria-label={label}>
      {children}
    </section>
  )
}

export function StatusCell({
  onClick,
  title,
  quiet,
  children
}: {
  /** Omit for a cell that states a fact with nowhere to go. */
  onClick?: () => void
  title?: string
  /** De-emphasised — a fact that is context rather than a signal. */
  quiet?: boolean
  children: ReactNode
}): React.JSX.Element {
  const classes = ['status-cell']
  if (quiet) classes.push('status-quiet')
  return onClick ? (
    <button type="button" className={classes.join(' ')} onClick={onClick} title={title}>
      {children}
    </button>
  ) : (
    <span className={classes.join(' ')} title={title}>
      {children}
    </span>
  )
}

/** A small fact inside a cell. `muted` marks the ones that are context. */
export function Tick({ muted, mono, children }: { muted?: boolean; mono?: boolean; children: ReactNode }): React.JSX.Element {
  const classes = ['tick']
  if (muted) classes.push('tick-muted')
  if (mono) classes.push('tick-mono')
  return <span className={classes.join(' ')}>{children}</span>
}

/** Live or idle, beside the word that says which. Never instead of it. */
export function StatusDot({ live }: { live: boolean }): React.JSX.Element {
  return <span className={`status-dot ${live ? 'live' : 'idle'}`} aria-hidden="true" />
}

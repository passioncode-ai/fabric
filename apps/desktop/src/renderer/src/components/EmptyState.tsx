import type { ReactNode } from 'react'

/**
 * What a surface says when it holds nothing (M117).
 *
 * M108 is the reason this takes `read` rather than being a plain wrapper: four
 * surfaces used to `useState([])` and render their empty copy as the ANSWER,
 * before anything had been read. In a product whose whole doctrine is
 * claim-versus-measurement, telling the operator "nothing here yet" before
 * looking is the worst available default — so a caller that has not read yet
 * passes `read={false}` and gets the waiting line instead of the empty one.
 */
export function EmptyState({
  read,
  waiting,
  loud,
  children
}: {
  /**
   * False until the caller has actually looked. REQUIRED, and that is the fix
   * rather than a style: it defaulted to `true`, so a caller who forgot it
   * claimed to have read. The safe answer must never be the one you get by not
   * thinking — fifteen call sites were taking it, and four of them were the ones
   * M108 names.
   */
  read: boolean
  /** What to say while the answer is unknown. */
  waiting?: ReactNode
  /** Give it room — for a whole page rather than a panel. */
  loud?: boolean
  children: ReactNode
}): React.JSX.Element {
  const classes = ['empty']
  if (loud) classes.push('empty-loud')
  // With no `waiting` line the surface says NOTHING while it is unknown, which
  // is right: an empty area is honest about an unknown, and a sentence is a
  // claim. Callers that have something useful to say pass it.
  return <p className={classes.join(' ')}>{read ? children : waiting}</p>
}

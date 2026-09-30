import type { ReactNode } from 'react'

/**
 * The states the interface can name. Kept as a closed union rather than a string
 * so a screen cannot invent a sixth colour by typing one — which is how
 * `.chip`, `.warn-chip`, `.state-badge` and `.status-dot` became four
 * vocabularies for one idea.
 */
export type ChipTone = 'quiet' | 'good' | 'warn' | 'danger' | 'info'

/**
 * A short label in a pill (M117). `docs/brand/ui.md` is explicit that the WORD
 * carries the state and colour only supports it: an unlabelled coloured dot
 * standing in for `running` or `failed` is forbidden, which is why `children` is
 * required and the dot is an addition rather than an alternative.
 */
export function StateChip({
  tone = 'quiet',
  dot = false,
  title,
  children
}: {
  tone?: ChipTone
  /** Adds the state dot beside the word. Never instead of it. */
  dot?: boolean
  title?: string
  children: ReactNode
}): React.JSX.Element {
  const classes = ['chip', `chip-${tone}`]
  if (dot) classes.push('chip-dot')
  return (
    <span className={classes.join(' ')} title={title}>
      {children}
    </span>
  )
}

import type { ReactNode } from 'react'

/** A cluster of controls with one spacing rule (M117). Absorbs six action rows. */
export function Toolbar({
  align = 'start',
  label,
  children
}: {
  align?: 'start' | 'end' | 'between'
  /** Names the group for assistive tech when its buttons ("Connect") only make sense with it (I3 U-4). */
  label?: string
  children: ReactNode
}): React.JSX.Element {
  const classes = ['toolbar']
  if (align === 'end') classes.push('toolbar-end')
  if (align === 'between') classes.push('toolbar-between')
  return label ? <div className={classes.join(' ')} role="group" aria-label={label}>{children}</div> : <div className={classes.join(' ')}>{children}</div>
}

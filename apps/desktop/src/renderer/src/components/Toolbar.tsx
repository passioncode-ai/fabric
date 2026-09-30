import type { ReactNode } from 'react'

/** A cluster of controls with one spacing rule (M117). Absorbs six action rows. */
export function Toolbar({
  align = 'start',
  children
}: {
  align?: 'start' | 'end' | 'between'
  children: ReactNode
}): React.JSX.Element {
  const classes = ['toolbar']
  if (align === 'end') classes.push('toolbar-end')
  if (align === 'between') classes.push('toolbar-between')
  return <div className={classes.join(' ')}>{children}</div>
}

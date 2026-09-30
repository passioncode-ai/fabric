import type { ReactNode } from 'react'

/**
 * Something the operator must read before continuing (M117).
 *
 * `role="alert"` is not decoration: these carry save conflicts and failed
 * starts, and a message that only exists visually is one a person who has
 * scrolled away never learns about.
 */
export function Banner({
  tone = 'error',
  actions,
  children
}: {
  tone?: 'error' | 'warn'
  actions?: ReactNode
  children: ReactNode
}): React.JSX.Element {
  return (
    <div className={`banner banner-${tone}`} role="alert">
      <span>{children}</span>
      {actions !== undefined && <span className="banner-actions">{actions}</span>}
    </div>
  )
}

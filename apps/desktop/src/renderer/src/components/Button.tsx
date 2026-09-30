import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'

/**
 * Interactive controls stay monochrome (M117, `docs/brand/ui.md`): the colourful
 * mark identifies the product and never becomes a button-state convention. The
 * only chromatic variant is `danger`, and it is chromatic because destruction is
 * a state a person must not be able to miss — which is exactly the exception the
 * pack's own state roles allow.
 */
export type ButtonTone = 'primary' | 'ghost' | 'quiet' | 'danger'

export function Button({
  tone = 'primary',
  ref,
  className,
  children,
  ...rest
}: {
  tone?: ButtonTone
  /**
   * Forwarded to the real `<button>`. React 19 passes `ref` as an ordinary prop
   * to a function component, so no `forwardRef` is needed — but it must be named
   * in the type or a caller cannot use it. Added when the editor's conflict
   * banner needed to focus the destructive choice, which is an accessibility
   * requirement rather than a nicety: that banner appears while the operator is
   * typing.
   */
  ref?: Ref<HTMLButtonElement>
  /** One declared modifier from the registry — never an invented class. */
  className?: string
  children: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>): React.JSX.Element {
  const classes = ['btn']
  if (tone !== 'primary') classes.push(`btn-${tone}`)
  if (className) classes.push(className)
  // `type` defaults to "submit" inside a form, which silently reloads a window
  // in an Electron renderer. Every button here is an action unless it says so.
  return (
    <button type="button" {...rest} ref={ref} className={classes.join(' ')}>
      {children}
    </button>
  )
}

import { useId, type ReactNode } from 'react'

/**
 * A labelled control with an optional hint (M117).
 *
 * The label is bound by a generated id rather than by wrapping, because half the
 * app's controls are `<select>`s inside grids where wrapping changes the layout —
 * and a label that is not bound is a label a screen reader cannot use.
 */
export function Field({
  label,
  hint,
  children
}: {
  label: ReactNode
  hint?: ReactNode
  /** Receives the id the label points at. */
  children: (id: string) => ReactNode
}): React.JSX.Element {
  const id = useId()
  return (
    <section className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {hint !== undefined && <p className="field-hint">{hint}</p>}
      {children(id)}
    </section>
  )
}

/**
 * One label over SEVERAL controls — a radio group, a list with its own add
 * button, a set of checkboxes.
 *
 * It is a separate component rather than a mode of `Field` because the two bind
 * differently and only one of them is correct in each case: `Field` points a
 * `<label>` at one control by id, which is meaningless when there are four, and
 * a group names itself to assistive technology with `aria-labelledby` on a
 * container carrying an explicit role. Collapsing them would have produced a
 * radio group whose label pointed at whichever input happened to be first.
 */
export function FieldGroup({
  label,
  hint,
  role,
  children
}: {
  label: ReactNode
  hint?: ReactNode
  /** `group` for a list of controls, `radiogroup` when exactly one is chosen. */
  role: 'group' | 'radiogroup'
  children: ReactNode
}): React.JSX.Element {
  const id = useId()
  return (
    <section className="field" role={role} aria-labelledby={id}>
      <span className="field-label" id={id}>
        {label}
      </span>
      {hint !== undefined && <p className="field-hint">{hint}</p>}
      {children}
    </section>
  )
}

/** Fields side by side. */
export function FieldRow({ children }: { children: ReactNode }): React.JSX.Element {
  return <div className="field-row">{children}</div>
}

/** Fields in the settings grid. */
export function FieldGrid({ children }: { children: ReactNode }): React.JSX.Element {
  return <div className="field-grid">{children}</div>
}

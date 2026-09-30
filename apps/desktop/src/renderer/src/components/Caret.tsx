/**
 * The disclosure triangle (M117).
 *
 * Its own component because two components draw it — the file tree and the
 * collapsible panel — and the registry allows exactly one owner per class. The
 * duplicate was caught by the inventory test rather than by review, which is
 * the reason that test exists.
 *
 * `aria-hidden` always: the state it indicates is already on the control that
 * owns it, via `aria-expanded`. Announcing "▸" as well is noise.
 */
export function Caret({ open }: { open: boolean }): React.JSX.Element {
  return (
    <span className="caret" aria-hidden="true">
      {open ? '\u25be' : '\u25b8'}
    </span>
  )
}

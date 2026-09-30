import type { ReactNode } from 'react'

/**
 * The window's tab strip (M117).
 *
 * It is in the set rather than inline in `App.tsx` for the reason the registry
 * gives: it owns nine class names, and a class with appearance is a component's
 * or it is nobody's. Extracting it also took ~60 lines out of a 392-line file
 * that holds the whole application shell.
 *
 * Purely presentational — every piece of state and every decision stays with the
 * caller. The keyboard and screen-reader contract travels WITH it: `aria-current`
 * on the active tab, a real `aria-label` on each icon-only control, and the glyph
 * itself hidden, because a tab strip whose buttons announce "✕" is a strip nobody
 * can navigate.
 */
export interface TabStripItem {
  /** Stable identity — also what `active` is compared against. */
  key: string
  label: ReactNode
  /** Rendered beside the label when the tab has running work. */
  badge?: ReactNode
  onSelect: () => void
  onClose: () => void
}

export function TabStrip({
  items,
  activeKey,
  home,
  actions,
  close,
  trailing
}: {
  items: readonly TabStripItem[]
  /** Null when the home tab is the active one. */
  activeKey: string | null
  home: { label: string; glyph: string; onSelect: () => void }
  /** Icon controls after the tabs — new tab, settings. */
  actions: readonly {
    /** Chosen from a closed set rather than derived from a key, so a new action
     *  cannot invent a class name the registry has never heard of. */
    variant: 'plus' | 'settings-btn'
    label: string
    glyph: string
    expanded?: boolean
    onSelect: () => void
  }[]
  /** The same for every tab, so it is named once rather than per item. */
  close: { label: string; glyph: string }
  /** The estate name, or whatever else belongs at the far end. */
  trailing?: ReactNode
}): React.JSX.Element {
  return (
    <div className="tabbar">
      <button
        type="button"
        className={`tab-btn home ${activeKey === null ? 'active' : ''}`}
        aria-label={home.label}
        aria-current={activeKey === null ? 'page' : undefined}
        onClick={home.onSelect}
      >
        <span aria-hidden="true">{home.glyph}</span>
      </button>
      {items.map((item) => (
        <span key={item.key} className={`tab-btn ${activeKey === item.key ? 'active' : ''}`}>
          <button
            type="button"
            className="tab-label"
            aria-current={activeKey === item.key ? 'page' : undefined}
            onClick={item.onSelect}
          >
            {item.label}
            {item.badge !== undefined && <span className="live-count">{item.badge}</span>}
          </button>
          <button type="button" className="tab-close" aria-label={close.label} onClick={item.onClose}>
            <span aria-hidden="true">{close.glyph}</span>
          </button>
        </span>
      ))}
      {actions.map((a) => (
        <button
          key={`${a.variant}:${a.label}`}
          type="button"
          className={`tab-btn ${a.variant}`}
          aria-label={a.label}
          aria-expanded={a.expanded}
          onClick={a.onSelect}
        >
          <span aria-hidden="true">{a.glyph}</span>
        </button>
      ))}
      {trailing !== undefined && <span className="tabbar-estate">{trailing}</span>}
    </div>
  )
}

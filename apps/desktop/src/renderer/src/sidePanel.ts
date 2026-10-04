// The side panels beside the content — Search, the chat with Fabric, private History and Agent access —
// are ONE state: at most one is open (UX-13, verification iteration 1 for 0.3.1). Each panel is 22rem;
// two at once left the content a fifth of the window.

export type SidePanel = 'search' | 'chat' | 'history' | 'access' | null

/** Open `next`; with `toggle`, an opener pressed while its own panel is open closes it instead. */
export function togglePanel(current: SidePanel, next: Exclude<SidePanel, null>, opts: { toggle: boolean }): SidePanel {
  return opts.toggle && current === next ? null : next
}

/** Close `which` if it is the open one; a stale close never shuts another panel. */
export function closePanel(current: SidePanel, which: Exclude<SidePanel, null>): SidePanel {
  return current === which ? null : current
}

// UX-13 (verification iteration 1 for 0.3.1): one side panel at a time — Search, Chat, History and Agent
// access. Each used to be its own boolean and Agent access was closed by no other opener, so two panels
// of 22rem each left the content a fifth of the window. Now there is ONE state.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { closePanel, togglePanel, type SidePanel } from './sidePanel'

describe('one side panel at a time', () => {
  it('opening any panel replaces whatever was open — Agent access included', () => {
    for (const from of ['search', 'chat', 'history', 'access', null] as SidePanel[])
      for (const to of ['search', 'chat', 'history', 'access'] as const)
        expect(togglePanel(from, to, { toggle: false })).toBe(to)
  })
  it('a toggling opener closes its own panel; closing another panel leaves the open one', () => {
    expect(togglePanel('chat', 'chat', { toggle: true })).toBeNull()
    expect(togglePanel('access', 'chat', { toggle: true })).toBe('chat')
    expect(closePanel('access', 'chat')).toBe('access')
    expect(closePanel('access', 'access')).toBeNull()
  })
  it('App holds the side panels in ONE state, not one boolean each', () => {
    const app = readFileSync(path.join(import.meta.dirname, 'App.tsx'), 'utf8')
    expect(app).not.toMatch(/\[(searchOpen|chatOpen|historyOpen|accessOpen), set\w+\] = useState/)
    expect(app).toMatch(/useState<SidePanel>\(null\)/)
  })
})

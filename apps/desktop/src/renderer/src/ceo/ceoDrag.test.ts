// The owner, 2026-11-20: «окно CEO перетаскивается только за имя, за остальное нет». The window is moved by its whole head
// and its free areas; what takes a press or typed keys is held out, the signs inside a button included. Electron reads
// `-webkit-app-region` from the stylesheet, so the rules themselves are what is checked here (a drag in a real window is
// the build walk's).
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(path.join(import.meta.dirname, '..', 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const regionOf = (selector: string): string | null => {
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*-webkit-app-region:\s*(drag|no-drag)[^{}]*)\}/g)]
  let found: string | null = null
  for (const r of rules) if (r[1]!.split(',').map((s) => s.trim()).includes(selector)) found = r[3]!
  return found
}

describe('where the CEO window is grabbed', () => {
  it('by its whole head, every part of it, and its free areas', () => {
    for (const s of ['.ceo-popup', '.ceo-popup-head', '.ceo-popup-head *', '.ceo-popup-chat', '.ceo-composer-popup']) expect(regionOf(s), s).toBe('drag')
  })
  // 0.3.27 review run nine, UX-74: the head's own words stay in the drag region; a no-drag rule on them cut its second row.
  it('the head\'s name, runner line and state are never held out of the drag', () => {
    for (const s of ['.ceo-popup-title', '.ceo-popup-runner', '.ceo-popup-state', '.ceo-popup-who', '.ceo-popup-name']) expect(regionOf(s), s).not.toBe('no-drag')
  })
  it('never by what takes a press or typed keys, nor by a sign inside a button', () => {
    for (const s of ['.ceo-popup button', '.ceo-popup button *', '.ceo-popup textarea', '.ceo-popup input', '.ceo-popup-console', '.ceo-call-panel'])
      expect(regionOf(s), s).toBe('no-drag')
  })
})

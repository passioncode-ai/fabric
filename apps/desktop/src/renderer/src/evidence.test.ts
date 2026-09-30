// M142's second failure mode, which the gate cannot see.
//
// `check-design.mjs` holds the anchor list equal to the ids the screens render,
// so a figure cannot point at a section nobody draws. What it cannot check is
// the RUNTIME: a section that is collapsed, unmounted, or on another route is
// absent from the document even though its source renders an id. The old
// pattern — `getElementById(a)?.scrollIntoView(…)` — swallowed exactly that, and
// a number that is pressable and does nothing is worse than one that never was.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EVIDENCE_ANCHORS, reveal } from './evidence.ts'

// jsdom implements no `matchMedia`. That is a fact about the test environment
// and not about the product — Electron's renderer has it — so it is shimmed here
// rather than guarded in `reveal`. Growing a branch in shipped code for a browser
// API the host always provides is how a test starts designing the product.
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false }) as MediaQueryList)
})

afterEach(() => {
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('opening the register a figure was counted from', () => {
  it('finds the section and says it did', () => {
    const el = document.createElement('div')
    el.id = 'sec-board'
    el.scrollIntoView = vi.fn()
    document.body.append(el)
    expect(reveal('sec-board')).toBe(true)
    expect(el.scrollIntoView).toHaveBeenCalled()
  })

  it('REPORTS a section that is not in the document rather than doing nothing quietly', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(reveal('sec-board')).toBe(false)
    expect(spy).toHaveBeenCalled()
    expect(String(spy.mock.calls[0][0])).toContain('sec-board')
  })

  it('honours reduced motion instead of animating over it', () => {
    const el = document.createElement('div')
    el.id = 'sec-journal'
    el.scrollIntoView = vi.fn()
    document.body.append(el)
    vi.stubGlobal('matchMedia', () => ({ matches: true }) as MediaQueryList)
    reveal('sec-journal')
    expect(el.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' })
  })

  it('lists each anchor once — a duplicate is two claims about one section', () => {
    expect(new Set(EVIDENCE_ANCHORS).size).toBe(EVIDENCE_ANCHORS.length)
  })
})

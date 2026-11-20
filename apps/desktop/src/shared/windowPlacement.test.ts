// The CEO's window opens where the person left it, at their size, never off every screen (the owner, 2026-11-20).
import { describe, expect, it } from 'vitest'
import { keepInside, placeWindow, readPlacement } from './windowPlacement.ts'

const laptop = { workArea: { x: 0, y: 25, width: 1512, height: 920 } }
// A second monitor to the right, taller, a little higher.
const monitor = { workArea: { x: 1512, y: -300, width: 2560, height: 1415 } }
const fallback = { x: 968, y: 201, width: 520, height: 720 }
const min = { width: 380, height: 420 }

describe('where the CEO window opens', () => {
  it('opens at the default when nothing is remembered', () => {
    expect(placeWindow({ saved: null, displays: [laptop], fallback, min })).toEqual(fallback)
  })

  it('opens where it was left, at its size, on the second monitor too', () => {
    const saved = { x: 2900, y: 100, width: 700, height: 900 }
    expect(placeWindow({ saved, displays: [laptop, monitor], fallback, min })).toEqual(saved)
  })

  it('comes back to a screen when the monitor it was on is gone', () => {
    const saved = { x: 2900, y: 100, width: 700, height: 900 }
    const r = placeWindow({ saved, displays: [laptop], fallback, min })
    expect(r).toEqual(fallback)
  })

  it('is pulled wholly onto the display that shows its top, never left half off the edge', () => {
    const r = placeWindow({ saved: { x: 1300, y: 600, width: 520, height: 720 }, displays: [laptop], fallback, min })
    expect(r.x + r.width).toBeLessThanOrEqual(1512)
    expect(r.y + r.height).toBeLessThanOrEqual(945)
    expect(r.width).toBe(520)
  })

  it('shrinks to a smaller screen, never under its minimum', () => {
    const small = { workArea: { x: 0, y: 25, width: 1280, height: 400 } }
    const r = placeWindow({ saved: { x: 10, y: 30, width: 1600, height: 1200 }, displays: [small], fallback, min })
    expect(r.width).toBe(1280)
    expect(r.height).toBe(400)
    expect(keepInside({ x: 0, y: 0, width: 100, height: 100 }, laptop.workArea, min)).toMatchObject({ width: 380, height: 420 })
  })

  it('a window whose title bar is above every screen is not trusted', () => {
    const r = placeWindow({ saved: { x: 100, y: -2000, width: 520, height: 720 }, displays: [laptop], fallback, min })
    expect(r).toEqual(fallback)
  })

  it('reads a remembered placement only when it is one', () => {
    expect(readPlacement({ x: 1.4, y: 2, width: 500, height: 600 })).toEqual({ x: 1, y: 2, width: 500, height: 600 })
    expect(readPlacement({ x: 1, y: 2, width: 0, height: 600 })).toBeNull()
    expect(readPlacement({ x: '1', y: 2, width: 500, height: 600 })).toBeNull()
    expect(readPlacement(null)).toBeNull()
    expect(readPlacement('{')).toBeNull()
  })
})

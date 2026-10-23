import { describe, expect, it } from 'vitest'
import { SWIPE_PAUSE_MS, swipeStart, swipeStep } from './swipeTravel'

const run = (events: Array<[number, number, number]>, canScroll = (_r: boolean) => false) => {
  let s = swipeStart(); const out: Array<string | null> = []
  for (const [deltaX, deltaY, at] of events) { const r = swipeStep(s, { deltaX, deltaY, at }, canScroll); s = r.state; out.push(r.travel) }
  return out.filter(Boolean)
}

describe('swipe as the way back (SCN-162, CO-401)', () => {
  it('fingers to the right go back, to the left forward, once per gesture', () => {
    expect(run([[-60, 0, 0], [-60, 0, 10], [-60, 0, 20], [-60, 0, 30]])).toEqual(['back'])
    expect(run([[80, 0, 0], [90, 0, 10]])).toEqual(['forward'])
  })
  it('a pause starts a new gesture; a short or mostly vertical one turns nothing', () => {
    expect(run([[-100, 0, 0], [-100, 0, SWIPE_PAUSE_MS + 50]])).toEqual([])
    expect(run([[-100, -120, 0], [-100, -120, 10]])).toEqual([])
    expect(run([[-200, 0, 0], [-10, 0, 10], [-200, 0, 20 + SWIPE_PAUSE_MS + 1]])).toEqual(['back', 'back'])
  })
  it('never turns the page while what is under the pointer can still scroll that way', () => {
    expect(run([[-100, 0, 0], [-100, 0, 10]], (towardRight) => !towardRight)).toEqual([])
    expect(run([[100, 0, 0], [100, 0, 10]], (towardRight) => !towardRight)).toEqual(['forward'])
  })
  // 0.3.12 review ER-12: scrolling the Board's columns to their left edge with momentum turned the page a few events
  // after the edge. Only a gesture that starts at the edge turns it.
  it('a gesture that scrolled something to its edge does not turn the page; the next one, from the edge, does', () => {
    // The columns take the first two events and reach their left edge; momentum goes on for five more.
    let s = swipeStart(); const out: Array<string | null> = []
    for (const at of [0, 10, 20, 30, 40, 50, 60]) {
      const r = swipeStep(s, { deltaX: -60, deltaY: 0, at }, (towardRight) => !towardRight && at < 20)
      s = r.state; out.push(r.travel)
    }
    expect(out.filter(Boolean)).toEqual([])
    expect(run([[-60, 0, 0], [-60, 0, 10], [-60, 0, 20]], () => false)).toEqual(['back'])
  })
})

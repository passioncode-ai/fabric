import { describe, expect, it } from 'vitest'
import { createLinkHold, createLinkOutbox } from './linkOutbox.ts'

describe('createLinkOutbox', () => {
  it('keeps a link resolved before the page listens, and hands it over on claim', () => {
    const pushed: string[] = []
    const box = createLinkOutbox<string>((r) => pushed.push(r))
    box.deliver('cold-start')
    expect(pushed).toEqual([])
    expect(box.claim()).toEqual(['cold-start'])
    expect(box.claim()).toEqual([])
  })
  it('pushes once the page listens, and waits again after a reload', () => {
    const pushed: string[] = []
    const box = createLinkOutbox<string>((r) => pushed.push(r))
    box.claim()
    box.deliver('running')
    expect(pushed).toEqual(['running'])
    box.reset()
    box.deliver('during-reload')
    expect(pushed).toEqual(['running'])
    expect(box.claim()).toEqual(['during-reload'])
  })
  it('keeps at most the limit, dropping the oldest', () => {
    const box = createLinkOutbox<number>(() => {}, 2)
    box.deliver(1)
    box.deliver(2)
    box.deliver(3)
    expect(box.claim()).toEqual([2, 3])
  })
})

// 0.3.5 review iteration 2, ER-7: a link past the limit is never dropped in silence — it is counted, the drop is
// reported (the ops log, without the link), and the page is told how many were not opened.
describe('createLinkHold', () => {
  it('keeps the newest up to the limit, reports each drop, and hands the count over with the links', () => {
    const drops: number[] = []
    const hold = createLinkHold<string>(8, (waiting) => drops.push(waiting))
    for (let i = 1; i <= 10; i++) hold.hold(`fabric://open/${i}`)
    expect(drops).toEqual([8, 8])
    const { links, dropped } = hold.take()
    expect(dropped).toBe(2)
    expect(links).toEqual(Array.from({ length: 8 }, (_, i) => `fabric://open/${i + 3}`))
    expect(hold.take()).toEqual({ links: [], dropped: 0 })
  })
  it('drops nothing within the limit', () => {
    const drops: number[] = []
    const hold = createLinkHold<string>(8, (n) => drops.push(n))
    for (let i = 0; i < 8; i++) hold.hold(String(i))
    expect(hold.take().dropped).toBe(0)
    expect(drops).toEqual([])
  })
})

describe('createLinkOutbox past its limit', () => {
  it('reports the dropped result and marks the newest it hands over with the count', () => {
    const dropped: number[] = []
    const box = createLinkOutbox<{ n: number; dropped?: number }>(() => {}, 2, {
      onDrop: (r) => dropped.push(r.n),
      mark: (r, count) => ({ ...r, dropped: count })
    })
    box.deliver({ n: 1 })
    box.deliver({ n: 2 })
    box.deliver({ n: 3 })
    expect(dropped).toEqual([1])
    expect(box.claim()).toEqual([{ n: 2 }, { n: 3, dropped: 1 }])
    box.reset()
    box.deliver({ n: 4 })
    expect(box.claim()).toEqual([{ n: 4 }])
  })
})

import { describe, expect, it } from 'vitest'
import { createLinkOutbox } from './linkOutbox.ts'

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

import { describe, expect, it, vi } from 'vitest'
import type { CommsMessage, CommsPageReply } from '../../../shared/commsRead.ts'
import { newestPosts, newestPostsRead } from './commsNewest'

/** A board whose posts sit at the given journal numbers among other events; its page reads forward, 100 at most. */
function board(seqs: number[]) {
  const posts = seqs.map((seq) => ({ seq, m: { id: `m${seq}`, thread: 't', kind: 'message', sender: { project: 'p', principal: null }, at: new Date(Date.UTC(2026, 0, 1) + seq * 1000).toISOString(), digest: 'd' } as CommsMessage }))
  const list = vi.fn(async (_t: string | null, after: number, limit = 50): Promise<CommsPageReply> => {
    const page = posts.filter((p) => p.seq > after).slice(0, limit)
    const lastSeq = page.at(-1)?.seq ?? after
    return { ok: true, messages: page.map((p) => p.m), lastSeq, more: posts.some((p) => p.seq > lastSeq) }
  })
  return { list, last: Math.max(...seqs) }
}

describe('newestPosts (DA-1)', () => {
  it('finds the newest 100 posts when posts are one journal number in twenty', async () => {
    const seqs = Array.from({ length: 887 }, (_, i) => 20 + i * 20)
    const { list, last } = board(seqs)
    const got = await newestPosts(list, last)
    expect(got).toHaveLength(100)
    expect(got?.[0].id).toBe(`m${last}`)
    expect(got?.at(-1)?.id).toBe(`m${seqs[seqs.length - 100]}`)
  })

  it('finds them when every number is a post (a window too wide narrows)', async () => {
    const seqs = Array.from({ length: 5000 }, (_, i) => i + 1)
    const { list, last } = board(seqs)
    const got = await newestPosts(list, last)
    expect(got?.map((m) => m.id)).toEqual(seqs.slice(-100).reverse().map((s) => `m${s}`))
  })

  it('returns what there is when the board holds fewer posts than asked', async () => {
    const { list, last } = board([5, 90000, 180000])
    expect((await newestPosts(list, last))?.map((m) => m.id)).toEqual(['m180000', 'm90000', 'm5'])
  })

  it('says the board did not answer rather than an empty feed', async () => {
    const list = vi.fn(async (): Promise<CommsPageReply> => ({ ok: false, error: { code: 'unavailable', message: 'down' } as never }))
    expect(await newestPosts(list, 100)).toBeNull()
  })
  it('finds the newest 100 when the newest stretch is quiet and an older one busy (DA-2)', async () => {
    const busy = Array.from({ length: 4000 }, (_, i) => 10000 + i)
    const quiet = Array.from({ length: 50 }, (_, i) => 20000 + i * 300)
    const { list, last } = board([...busy, ...quiet])
    const got = await newestPosts(list, last)
    expect(got).toHaveLength(100)
    expect(got?.[0].id).toBe(`m${last}`)
    expect(list.mock.calls.length).toBeLessThanOrEqual(14 * 5)
  })
})

describe('a short feed says so (CO-405)', () => {
  it('a few newest posts over an older dense burst the search could not reach is short; a board read to its start is not', async () => {
    const dense = Array.from({ length: 10_000 }, (_, i) => i + 1)
    const { list, last } = board([...dense, 3_000_000_000, 4_000_000_000])
    const sparse = await newestPostsRead(list, last)
    expect(sparse?.posts.length).toBeLessThan(100)
    expect(sparse?.short).toBe(true)
    const small = board([5, 90000, 180000])
    expect((await newestPostsRead(small.list, small.last))?.short).toBe(false)
    const many = board(Array.from({ length: 5000 }, (_, i) => i + 1))
    expect((await newestPostsRead(many.list, many.last))?.short).toBe(false)
  })
})

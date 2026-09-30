import { describe, expect, it } from 'vitest'
import { affects, POLL_MS } from './repoWatch.ts'

describe('which view a repository change concerns', () => {
  it('a change to a repository this view shows means ask again', () => {
    expect(affects('/w/a', ['/w/a', '/w/b'])).toBe(true)
  })

  it('a change to a repository this view does not show is ignored', () => {
    // Every open window receives the broadcast. Re-reading git in all of them
    // for a repository none of them displays is the stampede M102 describes,
    // arriving by a second road.
    expect(affects('/w/c', ['/w/a', '/w/b'])).toBe(false)
  })

  it('NULL means "not told yet" and asks again; an EMPTY LIST means "no repositories" and does not', () => {
    // The distinction EmptyState exists to keep. A view that refuses to re-read
    // because it does not yet know what it holds stays stale forever — and a
    // project that genuinely has no repository has nothing to re-read.
    expect(affects('/w/a', null)).toBe(true)
    expect(affects('/w/a', [])).toBe(false)
  })

  it('a trailing separator is not a different repository', () => {
    expect(affects('/w/a/', ['/w/a'])).toBe(true)
    expect(affects('/w/a', ['/w/a/'])).toBe(true)
  })

  it('a prefix is not a match — /w/ab is not /w/a', () => {
    expect(affects('/w/ab', ['/w/a'])).toBe(false)
  })

  it('the poll is slower than the feed and fast enough to see a save', () => {
    // The watch answers `.git` events instantly; this interval exists only for
    // what the watch cannot see — a file edited in the working tree, which
    // touches nothing under `.git`. It must be slower than the 2 s feed poll it
    // replaces, or the fix costs more than the defect.
    expect(POLL_MS).toBeGreaterThan(2_000)
    expect(POLL_MS).toBeLessThanOrEqual(15_000)
  })
})

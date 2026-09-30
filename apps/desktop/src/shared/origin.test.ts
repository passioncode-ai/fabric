import { describe, expect, it } from 'vitest'
import { hasSiblings, originDocument, originLocation, sameDocument } from './origin.ts'

describe('the document a task came out of', () => {
  it('strips a trailing line number', () => {
    expect(originDocument('docs/adr/0014.md:22')).toBe('docs/adr/0014.md')
  })

  it('strips a trailing range', () => {
    expect(originDocument('docs/adr/0014.md:22-40')).toBe('docs/adr/0014.md')
  })

  it('leaves a ref with no location alone', () => {
    expect(originDocument('docs/adr/0014.md')).toBe('docs/adr/0014.md')
  })

  it('does NOT cut at a colon that is not a location', () => {
    // The defect this module exists for. `split(':')[0]` returns `https`, and
    // every URL-origin task would then share one meaningless "document".
    expect(originDocument('https://example.com/decisions')).toBe('https://example.com/decisions')
    expect(originDocument('run:2026-09-05')).toBe('run:2026-09-05')
  })

  it('treats a uuid — a memory fact id — as the whole document', () => {
    const id = '4f0a1c2e-0000-4000-8000-000000000001'
    expect(originDocument(id)).toBe(id)
    expect(originLocation(id)).toBeNull()
  })

  it('reports the location when there is one, and null when there is not', () => {
    expect(originLocation('a.md:22')).toBe('22')
    expect(originLocation('a.md:22-40')).toBe('22-40')
    // Null is "the whole document" — a different statement from line zero.
    expect(originLocation('a.md')).toBeNull()
  })

  it('puts two tasks from different lines of one document together', () => {
    // Written against the whole ref this is false, the sibling list is always
    // empty, and the feature looks built.
    expect(sameDocument('docs/adr/0014.md:22', 'docs/adr/0014.md:40')).toBe(true)
    expect(sameDocument('docs/adr/0014.md:22', 'docs/adr/0015.md:22')).toBe(false)
  })

  it('offers no sibling list for an origin where it would be useless', () => {
    // "Three other tasks also came from the operator" is true and worthless.
    expect(hasSiblings('person')).toBe(false)
    expect(hasSiblings('task')).toBe(false)
    expect(hasSiblings('document')).toBe(true)
    expect(hasSiblings('memory')).toBe(true)
    expect(hasSiblings('observation')).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { readIdea, researchBrief, TITLE_MAX } from './idea.ts'

const idea = (text: string) => {
  const v = readIdea({ text })
  if (!v.ok) throw new Error('expected an idea, got: ' + v.reason)
  return v.idea
}

describe('reading an idea the operator typed', () => {
  it('refuses an empty one, and whitespace is empty', () => {
    expect(readIdea({ text: '' }).ok).toBe(false)
    expect(readIdea({ text: '   \n\n  ' }).ok).toBe(false)
  })

  it('takes the first line as the title and the rest as the note', () => {
    const i = idea('Cache the projector\n\nIt reprojects everything on every start.')
    expect(i.title).toBe('Cache the projector')
    expect(i.note).toBe('It reprojects everything on every start.')
  })

  it('has no note when there was only one line', () => {
    // Null is "they wrote one line", not an empty note they left blank.
    expect(idea('Cache the projector').note).toBeNull()
  })

  it('CARRIES a long first line into the note instead of cutting it away', () => {
    // The assertion with teeth. Truncating loses the operator's words in the one
    // place the product invited them to think freely, and they would not know:
    // the card would simply read as a sentence that stops.
    const tail = 'and it should also handle the reconnect case properly'
    const long = 'x'.repeat(TITLE_MAX - 20) + ' ' + tail
    const i = idea(long)
    expect(i.title.length).toBeLessThanOrEqual(TITLE_MAX)
    expect(i.note).toContain('reconnect case')
    // Nothing is lost: title plus note still holds every word.
    expect((i.title + ' ' + i.note).replace(/\s+/g, ' ')).toBe(long.replace(/\s+/g, ' '))
  })

  it('splits an unbroken long line rather than looping forever looking for a space', () => {
    const i = idea('y'.repeat(TITLE_MAX + 40))
    expect(i.title.length).toBe(TITLE_MAX)
    expect(i.note?.length).toBe(40)
  })
})

describe('what an agent is told about an idea', () => {
  it('asks for a report and REFUSES implementation', () => {
    // An agent that implements an idea nobody decided on has turned a thought
    // into work on its own authority — the same class as closing its own task.
    expect(researchBrief(idea('Cache the projector'))).toContain('Do NOT implement')
  })

  it('says the idea carries no evidence, so the agent does not hunt for a source', () => {
    // Without this the brief reads like every other task, whose origin points at
    // something checkable. The agent would look, find nothing, and either invent
    // a source or report a failure that is not one.
    expect(researchBrief(idea('Cache the projector'))).toContain('no evidence yet')
  })

  it('leaves the idea where it is', () => {
    expect(researchBrief(idea('Cache the projector'))).toContain('Leave the idea itself where it is')
  })

  it('carries the note when there is one, and does not fabricate one when there is not', () => {
    expect(researchBrief(idea('A\n\nbecause B'))).toContain('because B')
    const bare = researchBrief(idea('A'))
    expect(bare).toContain('The idea: A')
    expect(bare.split('\n').filter((l) => l.trim() === '').length).toBeLessThan(6)
  })
})

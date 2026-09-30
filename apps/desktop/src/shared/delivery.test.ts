import { describe, expect, it } from 'vitest'
import { asOnePaste, PASTE_END, PASTE_START } from './delivery.ts'

describe('handing an instruction to an agent', () => {
  it('sends a multi-line instruction as ONE submission, not one per line', () => {
    const out = asOnePaste('read the release script\n\nthen fix the signing step')
    // Exactly one carriage return, and it is the last character. Before this,
    // every newline in the instruction was an Enter.
    expect(out.split('\r').length - 1).toBe(1)
    expect(out.endsWith('\r')).toBe(true)
    // The newlines are still there — they are content now, not submissions.
    expect(out).toContain('read the release script\n\nthen fix the signing step')
  })

  it('puts the submission OUTSIDE the markers, or it would submit nothing', () => {
    const out = asOnePaste('one line')
    expect(out).toBe(`${PASTE_START}one line${PASTE_END}\r`)
    expect(out.indexOf('\r')).toBeGreaterThan(out.indexOf(PASTE_END))
  })

  it('strips markers already in the text — a closing one would end the paste early', () => {
    // An instruction that quotes terminal escapes, or asks an agent to explain
    // them, would otherwise break out of its own paste and resume as keystrokes.
    const out = asOnePaste(`before${PASTE_END}after`)
    expect(out).toBe(`${PASTE_START}beforeafter${PASTE_END}\r`)
    expect(out.split(PASTE_END).length - 1).toBe(1)
  })

  it('leaves an ordinary instruction otherwise untouched', () => {
    const text = 'survey the repository and say what it builds'
    expect(asOnePaste(text)).toContain(text)
  })
})

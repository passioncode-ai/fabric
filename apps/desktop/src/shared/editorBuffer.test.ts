import { describe, expect, it } from 'vitest'
import { afterSave, closeWouldLoseWork } from './editorBuffer.ts'

describe('the editor buffer after a save', () => {
  it('is clean when nothing was typed during the round-trip', () => {
    expect(afterSave('hello', 'hello')).toEqual({ dirty: false, saved: true })
  })

  it('is STILL DIRTY when the operator kept typing while the save was in flight', () => {
    // The defect: the save succeeded for "hello", the buffer holds "hello there",
    // and the old code said clean — so those keystrokes were unsaved AND
    // unmarked, and closing the window then discarded them without asking.
    expect(afterSave('hello', 'hello there')).toEqual({ dirty: true, saved: false })
  })

  it('never says saved and dirty at once — that pairing is what hid the loss', () => {
    for (const [written, buffer] of [
      ['a', 'a'],
      ['a', 'ab'],
      ['', 'x'],
      ['x', '']
    ])
      expect(afterSave(written, buffer).dirty).toBe(!afterSave(written, buffer).saved)
  })

  it('treats an emptied buffer as a change, not as nothing', () => {
    expect(afterSave('some text', '')).toEqual({ dirty: true, saved: false })
  })
})

describe('closing the window', () => {
  it('would lose work when the buffer is dirty and nobody was asked', () => {
    expect(closeWouldLoseWork({ dirty: true, saved: false }, false)).toBe(true)
  })

  it('is free once the operator has said discard', () => {
    expect(closeWouldLoseWork({ dirty: true, saved: false }, true)).toBe(false)
  })

  it('never interrupts a close that loses nothing', () => {
    expect(closeWouldLoseWork({ dirty: false, saved: true }, false)).toBe(false)
  })
})

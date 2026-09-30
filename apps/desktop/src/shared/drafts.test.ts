import { describe, expect, it } from 'vitest'
import {
  briefKey,
  briefTarget,
  clearDraft,
  draftFor,
  draftOr,
  fieldSubmission,
  setDraft,
  submission
} from './drafts.ts'

describe('a draft is keyed to what it was written for', () => {
  it('returns nothing for a task nobody has typed on', () => {
    expect(draftFor({}, 'B')).toBe('')
  })

  it('keeps one task’s words out of another task’s box', () => {
    const d = setDraft({}, 'A', 'this is about A')
    expect(draftFor(d, 'B')).toBe('')
    expect(draftFor(d, 'A')).toBe('this is about A')
  })

  it('gives the draft back when the operator returns to it', () => {
    const d = setDraft(setDraft({}, 'A', 'about A'), 'B', 'about B')
    expect(draftFor(d, 'A')).toBe('about A')
  })

  it('carries the key with the text, so the target cannot come from elsewhere', () => {
    // The defect this exists for: the text was read from state and the id from
    // props, and a switch between typing and clicking made them disagree.
    const d = setDraft({}, 'A', 'about A')
    expect(submission(d, 'A')).toEqual({ key: 'A', text: 'about A' })
    expect(submission(d, 'B')).toBeNull()
  })

  it('has nothing to submit when the draft is only whitespace', () => {
    expect(submission(setDraft({}, 'A', '   '), 'A')).toBeNull()
  })

  it('clears only the key that was submitted', () => {
    const d = setDraft(setDraft({}, 'A', 'about A'), 'B', 'about B')
    const after = clearDraft(d, 'A')
    expect(draftFor(after, 'A')).toBe('')
    expect(draftFor(after, 'B')).toBe('about B')
  })
})


describe('a brief section is drafted under the task it belongs to (UX28-01)', () => {
  it('gives each task and each section its own key', () => {
    expect(briefKey('A', 'what')).not.toBe(briefKey('B', 'what'))
    expect(briefKey('A', 'what')).not.toBe(briefKey('A', 'why'))
  })

  it('round-trips the target, so a save cannot read the text from one place and the task from another', () => {
    expect(briefTarget(briefKey('A', 'what'))).toEqual({ taskId: 'A', section: 'what' })
  })

  it('is not confusable with a note draft, whose key is the bare task id', () => {
    expect(briefTarget('A')).toBeNull()
    expect(briefKey('A', 'what')).not.toBe('A')
  })

  it('keeps a draft for A while B is on screen, and gives it back', () => {
    const d = setDraft({}, briefKey('A', 'what'), 'half a thought')
    expect(draftFor(d, briefKey('B', 'what'))).toBe('')
    expect(draftFor(d, briefKey('A', 'what'))).toBe('half a thought')
  })
})


describe('a field submits emptiness; a note does not (UX28-01)', () => {
  it('submits an empty FIELD, because clearing a section is a decision', () => {
    expect(fieldSubmission({ k: '' }, 'k')).toEqual({ key: 'k', text: '' })
    expect(submission({ k: '' }, 'k')).toBeNull()
  })

  it('submits nothing for a field nobody touched, so a bare blur takes no authorship', () => {
    expect(fieldSubmission({}, 'k')).toBeNull()
  })

  it('does not trim a field, because leading layout in a brief is the author\'s', () => {
    expect(fieldSubmission({ k: '  keep me  ' }, 'k')?.text).toBe('  keep me  ')
  })

  it('distinguishes an absent draft from an emptied one', () => {
    expect(draftOr({}, 'k', 'saved')).toBe('saved')
    expect(draftOr({ k: '' }, 'k', 'saved')).toBe('')
  })
})

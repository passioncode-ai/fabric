import { describe, expect, it } from 'vitest'
import { applied, EMPTY_TASK_DRAFT, loadInto, mergeDraft, type TaskDraft } from './taskDraft.ts'

describe('the task draft', () => {
  it('composes consecutive patches — the bug this replaces reverted the earlier ones', () => {
    // `setInstruction(); setPreset(); setPresetText()` in one handler. The first
    // version sent a whole draft built from the render's values, so each write
    // carried the others as they were BEFORE the sequence and the last one won.
    let draft: TaskDraft | undefined
    draft = mergeDraft(draft, { instruction: 'collect context' })
    draft = mergeDraft(draft, { preset: 'context' })
    draft = mergeDraft(draft, { presetText: 'collect context' })
    expect(draft).toEqual({
      instruction: 'collect context',
      preset: 'context',
      presetText: 'collect context'
    })
  })

  it('starts from empty rather than undefined, so a first keystroke is a whole draft', () => {
    expect(mergeDraft(undefined, { instruction: 'x' })).toEqual({
      ...EMPTY_TASK_DRAFT,
      instruction: 'x'
    })
  })

  it('can clear a field back to null — dropping a preset is a real edit', () => {
    const started = mergeDraft(undefined, { preset: 'review', presetText: 'review it' })
    expect(mergeDraft(started, { preset: null }).preset).toBeNull()
    expect(mergeDraft(started, { preset: null }).presetText).toBe('review it')
  })

  it('does not mutate what it was given', () => {
    const before = mergeDraft(undefined, { instruction: 'one' })
    mergeDraft(before, { instruction: 'two' })
    expect(before.instruction).toBe('one')
  })
})

describe('loading something into the instruction field', () => {
  const preset = { text: 'collect context', presetId: 'context' }
  const reuse = { text: 'survey the repository', presetId: null }

  it('applies straight into an empty field', () => {
    expect(loadInto(undefined, preset)).toEqual({
      kind: 'apply',
      draft: { instruction: 'collect context', preset: 'context', presetText: 'collect context' }
    })
  })

  it('ASKS before replacing what someone typed — from a preset', () => {
    const typed = mergeDraft(undefined, { instruction: 'my own words' })
    expect(loadInto(typed, preset)).toEqual({ kind: 'ask', pending: preset })
  })

  it('and asks just the same for a past task — the loss is identical', () => {
    // "Use again" originally replaced a draft without a word. A preset asked;
    // the operator's own past task did not, which is the wrong way round if
    // either.
    const typed = mergeDraft(undefined, { instruction: 'my own words' })
    expect(loadInto(typed, reuse)).toEqual({ kind: 'ask', pending: reuse })
  })

  it('treats whitespace as empty — a field of spaces is not work worth protecting', () => {
    const blank = mergeDraft(undefined, { instruction: '   \n  ' })
    expect(loadInto(blank, preset).kind).toBe('apply')
  })

  it('does not ask to replace an UNEDITED preset — that text is the preset\'s, not the operator\'s', () => {
    // The nuance lived in the preset button and not in the reuse path. Swapping
    // one preset for another loses nothing, and asking would be noise.
    const untouched = mergeDraft(undefined, { instruction: 'review it', preset: 'review', presetText: 'review it' })
    expect(loadInto(untouched, preset).kind).toBe('apply')
  })

  it('but DOES ask once the operator has edited that preset', () => {
    const edited = mergeDraft(undefined, { instruction: 'review it, and check the tags', preset: 'review', presetText: 'review it' })
    expect(loadInto(edited, preset).kind).toBe('ask')
  })

  it('borrowed text does NOT carry borrowed provenance', () => {
    // A past task's instruction is not the operator picking a preset again.
    expect(applied(reuse)).toEqual({
      instruction: 'survey the repository',
      preset: null,
      presetText: null
    })
  })

  it('a preset keeps its identity AND its text as inserted, so a later edit reads as an edit', () => {
    expect(applied(preset)).toEqual({
      instruction: 'collect context',
      preset: 'context',
      presetText: 'collect context'
    })
  })

  it('a reuse landing on a chosen preset CLEARS it rather than leaving a stale one', () => {
    // The field is empty but a preset was chosen and then deleted; the reuse
    // must not inherit it.
    const stale = mergeDraft(undefined, { preset: 'review', presetText: 'review it' })
    const load = loadInto(stale, reuse)
    expect(load.kind).toBe('apply')
    if (load.kind === 'apply') {
      expect(load.draft.preset).toBeNull()
      // And `presetText` with it. A stale one would make the borrowed text look
      // like an untouched preset, so the NEXT load would not ask before
      // replacing it — the rule quietly disabled one step later.
      expect(load.draft.presetText).toBeNull()
    }
  })
})

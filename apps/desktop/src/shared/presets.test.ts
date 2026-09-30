import { describe, expect, it } from 'vitest'
import { MAX_ITEMS, resolvePresets, type PresetItem, type TaskPreset } from './presets.ts'

const constant: TaskPreset = { id: 'audit', labelKey: 'l', instructionKey: 'i' }
const backed: TaskPreset = { id: 'backlog', labelKey: 'l', instructionKey: 'i', source: 'backlog' }
const item = (n: number): PresetItem => ({ id: `t${n}`, title: `task ${n}`, instruction: 'x' })

describe('resolving presets against the project', () => {
  it('offers a constant preset whatever the project holds', () => {
    expect(resolvePresets([constant], {}).map((p) => p.id)).toEqual(['audit'])
  })

  it('does NOT offer a data-backed preset with nothing behind it', () => {
    // "Continue from the backlog" with an empty backlog sends an agent to do
    // nothing. An offer that cannot be honoured is worse than no offer.
    expect(resolvePresets([backed], { backlog: [] })).toEqual([])
    expect(resolvePresets([backed], {})).toEqual([])
  })

  it('hands the agent the items, so the session does not open by rediscovering them', () => {
    const [p] = resolvePresets([backed], { backlog: [item(1), item(2)] })
    expect(p.vars.items).toBe('- task 1\n- task 2')
    expect(p.count).toBe(2)
  })

  it('COUNTS the whole source even when it lists only part of it', () => {
    // The assertion that matters. Silent truncation reads as completeness: an
    // agent handed eight rows with no remark concludes the backlog holds eight.
    const many = Array.from({ length: MAX_ITEMS + 195 }, (_, i) => item(i))
    const [p] = resolvePresets([backed], { backlog: many })
    expect(p.count).toBe(MAX_ITEMS + 195)
    expect(p.vars.items.split('\n')).toHaveLength(MAX_ITEMS + 1)
    expect(p.vars.items).toContain('195 more not listed here')
  })

  it('says nothing about a remainder when there is none', () => {
    const [p] = resolvePresets([backed], { backlog: [item(1)] })
    expect(p.vars.items).not.toContain('more not listed')
  })

  it('falls back to the instruction when a task has no title', () => {
    const [p] = resolvePresets([backed], {
      backlog: [{ id: 't', title: null, instruction: 'fix the importer' }]
    })
    expect(p.vars.items).toBe('- fix the importer')
  })

  it('keeps the order it was given — the board decides priority, not this', () => {
    const [p] = resolvePresets([backed], { backlog: [item(3), item(1), item(2)] })
    expect(p.vars.items).toBe('- task 3\n- task 1\n- task 2')
  })
})

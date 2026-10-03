import { describe, expect, it } from 'vitest'
import { runnerLabel } from './runnerLabel'
import { en } from './i18n/en'

const t = ((k: keyof typeof en) => en[k]) as Parameters<typeof runnerLabel>[1]

describe('runnerLabel — one name per coding agent everywhere', () => {
  it('names each runner by the registry, never "Terminal" for Codex', () => {
    expect(runnerLabel('claude-code', t)).toBe('Claude Code')
    expect(runnerLabel('codex', t)).toBe('Codex')
    expect(runnerLabel('shell', t)).toBe(en['agents.terminal'])
  })
  it('a created agent is named, or called a created agent — never a uuid', () => {
    const id = '0b9a3c2e-1f4d-4e5a-9b8c-7d6e5f4a3b2c'
    expect(runnerLabel(id, t, { [id]: 'Reviewer' })).toBe('Reviewer')
    expect(runnerLabel(id, t)).toBe(en['agents.createdAgent'])
  })
  it('an absent id says no coding agent was recorded; an unknown runner keeps its id', () => {
    expect(runnerLabel(null, t)).toBe(en['agents.unknownRunner'])
    expect(runnerLabel('aider', t)).toBe('aider')
  })
})

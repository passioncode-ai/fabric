// Every coding agent of the catalogue can be started as a console (OF-11, ADR-0168): one row per agent, its
// program and the argument that skips its permission prompts, measured from Orca's settings on 2026-10-19.
import { describe, expect, it } from 'vitest'
import { AGENTS, mayLaunch, preferredMode } from './agents'
import { CONSOLE_CATALOG, consoleDescriptors } from './consoleCatalog'
import { BYPASS_FLAGS } from './containment'

describe('the console catalogue', () => {
  it('names the agents Orca knows that Fabric did not, by the ids Switchboard uses', () => {
    const ids = CONSOLE_CATALOG.map((e) => e.id)
    for (const id of ['opencode', 'gemini-cli', 'goose', 'cursor-cli', 'pi', 'openclaw', 'aider', 'amp', 'crush', 'qwen-code', 'copilot-cli', 'factory-droid', 'kiro-cli', 'devin', 'continue', 'command-code'])
      expect(ids).toContain(id)
    expect(new Set(ids).size).toBe(ids.length)
    // An editor and a terminal app are not consoles.
    expect(ids).not.toContain('zed')
    expect(ids).not.toContain('warp')
  })

  it('makes every catalogue agent a launchable runner, the core agents keeping their own descriptor', () => {
    const gemini = AGENTS.find((a) => a.id === 'gemini-cli')
    expect(gemini?.program).toBe('gemini')
    expect(gemini?.connectsToSurface).toBe(false)
    expect(gemini?.surfaceAdapter).toBe('none')
    expect(AGENTS.filter((a) => a.id === 'claude-code')).toHaveLength(1)
    expect(AGENTS.find((a) => a.id === 'claude-code')?.connectsToSurface).toBe(true)
    expect(consoleDescriptors().some((d) => d.id === 'claude-code')).toBe(false)
  })

  it('launches the bypass mode with the agent\'s own argument and its environment', () => {
    expect(mayLaunch('gemini-cli', 'bypass')).toEqual({ ok: true, args: ['--yolo'], config: null, env: {} })
    expect(mayLaunch('factory-droid', 'bypass')).toMatchObject({ ok: true, args: ['--auto', 'high'] })
    expect(mayLaunch('goose', 'bypass')).toMatchObject({ ok: true, args: [], env: { GOOSE_MODE: 'auto' } })
    expect(mayLaunch('goose', 'ask')).toMatchObject({ ok: true, args: [], env: { GOOSE_MODE: 'approve' } })
    expect(mayLaunch('gemini-cli', 'ask')).toMatchObject({ ok: true, args: [] })
  })

  it('declares nothing between a bypass mode and the world, and says so for a runner whose default is unmeasured', () => {
    for (const d of consoleDescriptors()) {
      for (const m of d.permissionModes) {
        if (m.id === 'bypass') expect(m.containment).toBe('none')
        if (m.args.some((a) => BYPASS_FLAGS.includes(a))) expect(m.containment).toBe('none')
      }
    }
    const opencode = consoleDescriptors().find((d) => d.id === 'opencode')
    expect(opencode?.permissionModes.map((m) => m.id)).toEqual(['ask'])
    expect(opencode?.permissionModes[0].containment).toBe('none')
  })

  it('prefers fewer prompts for every agent that has a way to skip them, and keeps the default otherwise', () => {
    expect(preferredMode('claude-code', 'fewer-prompts')).toBe('bypass')
    expect(preferredMode('claude-code', 'manual')).toBe('ask')
    expect(preferredMode('gemini-cli', 'fewer-prompts')).toBe('bypass')
    expect(preferredMode('gemini-cli', 'manual')).toBe('ask')
    expect(preferredMode('opencode', 'fewer-prompts')).toBe('ask')
    expect(preferredMode('codex', 'fewer-prompts')).toBeNull()
    expect(preferredMode('shell', 'fewer-prompts')).toBeNull()
    expect(preferredMode('nobody', 'fewer-prompts')).toBeNull()
  })
})

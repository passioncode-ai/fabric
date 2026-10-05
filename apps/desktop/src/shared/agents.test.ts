// The agent registry's contract (M146 step 6).
//
// Cheap because it is pure, and worth having because this table is the only
// thing between the operator and a mode that would turn every session's output
// into a searchable secret store.

import { describe, expect, it } from 'vitest'
import { AGENTS, describeAgent, mayLaunch } from './agents.ts'

describe('the agent registry', () => {
  it('never has a blocked mode as its default — the default is what runs when nobody chooses', () => {
    for (const agent of AGENTS) {
      if (!agent.defaultMode) continue
      const mode = agent.permissionModes.find((m) => m.id === agent.defaultMode)
      expect(mode, `${agent.id} defaults to a mode it does not have`).toBeTruthy()
      expect(mode?.blockedKey, `${agent.id} defaults to a blocked mode`).toBeUndefined()
    }
  })

  it('allows bypass now that M95 ships, and the mode still carries its residue', () => {
    // It WAS blocked, and the change is a downgrade rather than a deletion:
    // secrets are removed on the way in, but the redactor matches shapes, so a
    // credential shaped like an ordinary word still gets through.
    const verdict = mayLaunch('claude-code', 'bypass')
    expect(verdict.ok).toBe(true)
    const mode = describeAgent('claude-code')?.permissionModes.find((m) => m.id === 'bypass')
    expect(mode?.blockedKey).toBeUndefined()
    expect(mode?.warnKey).toBe('agent.mode.bypassWarn')
  })

  it('a mode is either blocked or warned, never both — the two say different things', () => {
    for (const agent of AGENTS)
      for (const m of agent.permissionModes)
        expect(Boolean(m.blockedKey && m.warnKey), `${agent.id}/${m.id}`).toBe(false)
  })

  it('allows the modes that are not blocked, with their arguments', () => {
    const plan = mayLaunch('claude-code', 'plan')
    expect(plan.ok).toBe(true)
    if (plan.ok) expect(plan.args).toEqual(['--permission-mode', 'plan'])
    const ask = mayLaunch('claude-code', 'ask')
    expect(ask.ok).toBe(true)
    if (ask.ok) expect(ask.args).toEqual([])
  })

  it('falls back to the default when no mode is named, rather than to nothing', () => {
    const verdict = mayLaunch('claude-code', null)
    expect(verdict.ok).toBe(true)
  })

  it('an agent with nothing to ask about launches with no arguments and no complaint', () => {
    const verdict = mayLaunch('shell', null)
    expect(verdict.ok).toBe(true)
    if (verdict.ok) expect(verdict.args).toEqual([])
  })

  it('refuses an agent it does not know, and a mode that agent does not have', () => {
    expect(mayLaunch('nonexistent', null).ok).toBe(false)
    expect(mayLaunch('claude-code', 'invented').ok).toBe(false)
  })

  it('a block or a warning names its reason as a STRING KEY, so it is readable rather than a boolean', () => {
    for (const agent of AGENTS)
      for (const mode of agent.permissionModes) {
        if (mode.blockedKey) expect(mode.blockedKey).toMatch(/^agent\.mode\./)
        if (mode.warnKey) expect(mode.warnKey).toMatch(/^agent\.mode\./)
      }
  })

  it('an agent that connects to the surface declares how it is told where the config is', () => {
    for (const agent of AGENTS)
      expect(agent.connectsToSurface ? agent.surfaceAdapter !== 'none' : true).toBe(true)
    expect(describeAgent('claude-code')?.surfaceAdapter).toBe('mcp-config-flag')
  })

  it('a runner told through a session config names its variable and dialect (ADR-0119)', () => {
    for (const agent of AGENTS)
      if (agent.surfaceAdapter === 'config-content-env')
        expect(agent.surfaceConfig?.env, `${agent.id} names no session-config variable`).toMatch(/^[A-Z][A-Z0-9_]*$/)
    expect(describeAgent('kilo')?.surfaceConfig).toEqual({ env: 'KILO_CONFIG_CONTENT', format: 'kilo' })
  })

  it('Kilo asks by SETTING its permissions, and its bypass carries the config that allows everything', () => {
    // Kilo allows every tool by default (measured on 7.4.17), so an 'ask' mode with no
    // fragment would be a gate that is not there.
    const ask = mayLaunch('kilo', null)
    expect(ask.ok).toBe(true)
    if (ask.ok) {
      expect(ask.args).toEqual([])
      expect(ask.config).toEqual({ permission: { edit: 'ask', bash: 'ask', webfetch: 'ask', external_directory: 'ask' } })
    }
    const bypass = mayLaunch('kilo', 'bypass')
    expect(bypass.ok).toBe(true)
    if (bypass.ok) expect(bypass.config).toEqual({ permission: { '*': 'allow' } })
    expect(describeAgent('kilo')?.permissionModes.find((m) => m.id === 'bypass')?.containment).toBe('none')
  })

  it('a flag-only runner hands no session config', () => {
    const verdict = mayLaunch('claude-code', 'plan')
    expect(verdict.ok && verdict.config).toBe(null)
  })
})

import { describe, expect, it } from 'vitest'
import { defaultBuilder } from './builderChoice.ts'
import type { ExecutorRow } from './startPaths.ts'

const row = (id: string, state: ExecutorRow['state'], connected = true): ExecutorRow => ({ id, label: id, connected, state, version: null, path: null, install: null })

describe('the default coding agent for creating or adapting an agent (D3)', () => {
  const rows = [row('codex', 'found', false), row('claude-code', 'found'), row('hermes', 'missing')]
  it('takes the first installed agent of the fallback order', () => {
    expect(defaultBuilder(rows, { order: [{ runner: 'hermes', session: 'spawn' }, { runner: 'codex', session: 'spawn' }] })).toBe('codex')
  })
  it('without an order, prefers an installed agent Fabric reaches over one it does not', () => {
    expect(defaultBuilder(rows, { order: [] })).toBe('claude-code')
    expect(defaultBuilder(rows, null)).toBe('claude-code')
  })
  it('falls back to any installed agent, and says null when none is installed', () => {
    expect(defaultBuilder([row('codex', 'found', false)], null)).toBe('codex')
    expect(defaultBuilder([row('codex', 'unresponsive'), row('cline', 'missing')], null)).toBeNull()
  })
})

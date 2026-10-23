import { describe, expect, it } from 'vitest'
import { parseReadiness } from './fabricReadiness'

describe('parseReadiness (CO-407)', () => {
  it('keeps the checks that concern Fabric and the product-less prerequisites, with a summary', () => {
    const doc = { version: '0.2.33', at: '2026-10-23T21:06:46Z', checks: [
      { id: 'prereq.node', area: 'prerequisites', product: null, state: 'ok', detail: 'Node 26', fix: null },
      { id: 'prereq.docker', area: 'prerequisites', product: 'fabric', state: 'ok', detail: 'Docker answers', fix: null },
      { id: 'app.fabric', area: 'apps', product: null, state: 'warn', detail: 'Fabric 0.3.10; 0.3.11 is out', fix: 'quit Fabric, then run setup' },
      { id: 'mcp.claude.fabric', area: 'mcp', product: null, state: 'ok', detail: 'registered', fix: null },
      { id: 'mcp.claude.fabric-inbox', area: 'mcp', product: null, state: 'warn', detail: 'no fabric-inbox', fix: null },
      { id: 'skills.installed', area: 'skills', product: null, state: 'ok', detail: 'skill set', fix: null }
    ] }
    const r = parseReadiness(JSON.stringify(doc))
    expect(r.ok && r.checks.map((c) => c.id)).toEqual(['prereq.node', 'prereq.docker', 'app.fabric', 'mcp.claude.fabric'])
    expect(r.ok && r.summary).toEqual({ ok: 3, warn: 1, fail: 0, info: 0 })
    expect(r.ok && r.checks[2].fix).toBe('quit Fabric, then run setup')
  })
  it('an answer that is not the doctor\'s JSON is unreadable, never an empty «all good»', () => {
    expect(parseReadiness('npm ERR! 404')).toEqual({ ok: false, reason: 'unreadable', detail: 'npm ERR! 404' })
    expect(parseReadiness('{"checks": 3}')).toEqual({ ok: false, reason: 'unreadable', detail: null })
  })
})

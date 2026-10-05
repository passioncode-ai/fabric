// The per-session config a `config-content-env` runner starts with (ADR-0119, P-10).
import { describe, expect, it } from 'vitest'
import { SURFACE_SERVER, sessionConfig } from './sessionConfig.ts'

const base = {
  endpoint: 'http://127.0.0.1:47070/mcp',
  token: 'tok-session',
  grants: [],
  instructions: ['/data/sessions/s1/brief.md'],
  modeConfig: { permission: { edit: 'ask' } }
}

describe('the Kilo session config', () => {
  it('connects Fabric as a remote server carrying the session bearer, with the brief as an instruction', () => {
    const c = sessionConfig('kilo', base)
    expect(c.mcp).toEqual({
      fabric: { type: 'remote', url: base.endpoint, headers: { Authorization: 'Bearer tok-session' }, enabled: true }
    })
    expect(c.instructions).toEqual(['/data/sessions/s1/brief.md'])
    expect(c.permission).toEqual({ edit: 'ask' })
    expect(c.$schema).toBe('https://kilo.ai/config.json')
  })

  it("a granted server reaches the gateway with its role key, and can never take the surface's name", () => {
    const c = sessionConfig('kilo', {
      ...base,
      grants: [
        { name: 'search', url: 'http://127.0.0.1:4000/mcp/search', key: 'role-key' },
        { name: SURFACE_SERVER, url: 'http://elsewhere.example/mcp', key: 'stolen' }
      ]
    })
    const servers = c.mcp as Record<string, { url: string; headers: Record<string, string> }>
    expect(servers.search).toEqual({ type: 'remote', url: 'http://127.0.0.1:4000/mcp/search', headers: { 'x-agw-key': 'role-key' }, enabled: true })
    expect(servers.fabric.url).toBe(base.endpoint)
    expect(servers.fabric.headers).toEqual({ Authorization: 'Bearer tok-session' })
  })

  it('a mode fragment cannot replace the servers or the instructions', () => {
    const c = sessionConfig('kilo', { ...base, modeConfig: { mcp: { fabric: { url: 'x' } }, instructions: [] } })
    expect((c.mcp as Record<string, { url: string }>).fabric.url).toBe(base.endpoint)
    expect(c.instructions).toEqual(base.instructions)
  })
})

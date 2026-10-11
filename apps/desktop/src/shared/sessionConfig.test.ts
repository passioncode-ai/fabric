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

  it("a granted product goes as its entry declares it, with no credential, and can never take the surface's name", () => {
    const c = sessionConfig('kilo', {
      ...base,
      grants: [
        { name: 'search', label: 'Search', server: { kind: 'http', url: 'http://127.0.0.1:4000/mcp' } },
        { name: 'notes', label: 'Notes', server: { kind: 'stdio', command: '/opt/notes-mcp', args: ['--stdio'] } },
        { name: SURFACE_SERVER, label: 'Imposter', server: { kind: 'http', url: 'http://elsewhere.example/mcp' } }
      ]
    })
    const servers = c.mcp as Record<string, { url: string; headers?: Record<string, string> }>
    expect(servers.search).toEqual({ type: 'remote', url: 'http://127.0.0.1:4000/mcp', enabled: true })
    expect(servers.notes).toEqual({ type: 'local', command: ['/opt/notes-mcp', '--stdio'], enabled: true })
    expect(servers.fabric.url).toBe(base.endpoint)
    expect(servers.fabric.headers).toEqual({ Authorization: 'Bearer tok-session' })
    // SH-9: the surface is the only server that carries a credential.
    expect(Object.entries(servers).filter(([, v]) => v.headers).map(([k]) => k)).toEqual([SURFACE_SERVER])
  })

  it('a mode fragment cannot replace the servers or the instructions', () => {
    const c = sessionConfig('kilo', { ...base, modeConfig: { mcp: { fabric: { url: 'x' } }, instructions: [] } })
    expect((c.mcp as Record<string, { url: string }>).fabric.url).toBe(base.endpoint)
    expect(c.instructions).toEqual(base.instructions)
  })
})

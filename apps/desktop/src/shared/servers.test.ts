import { describe, expect, it } from 'vitest'
import { describeRefusals, parseGatewayConfig, planServers, type GatewayFacts } from './servers.ts'

// The gateway's real route shape on this machine is `/mcp/<name>` — measured,
// not assumed. The first version of the module guessed `/<name>`, which would
// have granted every server a URL pointing at nothing.
const gw = (serves: string[], origin: string | null = 'http://127.0.0.1:4000'): GatewayFacts => ({
  origin,
  routes: Object.fromEntries(serves.map((n) => [n, `/mcp/${n}`])),
  key: 'role-key'
})

describe('deciding what a session may reach', () => {
  it('grants a gateway server the gateway actually serves', () => {
    const plan = planServers([{ name: 'linear', source: 'gateway' }], gw(['linear', 'context7']))
    expect(plan.ok).toBe(true)
    expect(plan.grant).toEqual([
      { name: 'linear', url: 'http://127.0.0.1:4000/mcp/linear', key: 'role-key' }
    ])
  })

  it('REFUSES a direct server by design, and says why rather than calling it unbuilt', () => {
    // The security assertion. Direct means an upstream key written into the
    // session directory, which is the superset `agent-composition.md` forbids.
    // Worded as "not implemented" it reads as an oversight somebody later fills.
    const plan = planServers([{ name: 'linear', source: 'direct' }], gw(['linear']))
    expect(plan.ok).toBe(false)
    if (plan.ok) return
    expect(plan.refusals[0].reason).toContain('never handed down whole')
    expect(plan.refusals[0].reason).not.toMatch(/not implemented|unimplemented/i)
  })

  it('refuses a Fabric-proxied server as declared-and-unbuilt', () => {
    const plan = planServers([{ name: 'linear', source: 'fabric' }], gw(['linear']))
    expect(plan.ok).toBe(false)
  })

  it('refuses when the machine has no gateway, and says what to do', () => {
    const plan = planServers([{ name: 'linear', source: 'gateway' }], { origin: null, routes: {}, key: null })
    expect(plan.ok).toBe(false)
    if (plan.ok) return
    expect(plan.refusals[0].reason).toContain('this machine has none')
  })

  it('refuses a server the gateway does not declare', () => {
    const plan = planServers([{ name: 'sentry', source: 'gateway' }], gw(['linear']))
    expect(plan.ok).toBe(false)
    if (plan.ok) return
    expect(plan.refusals[0].reason).toContain('Add it to the gateway')
  })

  it('ONE refusal blocks the whole launch — a partial grant is the defect', () => {
    // The assertion with teeth. Started with three of four servers, the agent
    // looks for the fourth tool, does not find it, and improvises: it fails
    // mid-run for a reason nobody recorded. Refusing before the process exists
    // is what M61's preflight is for, at the moment it costs nothing.
    const plan = planServers(
      [
        { name: 'linear', source: 'gateway' },
        { name: 'sentry', source: 'gateway' }
      ],
      gw(['linear'])
    )
    expect(plan.ok).toBe(false)
    if (plan.ok) return
    expect(plan.refusals).toHaveLength(1)
    // And it still reports what WOULD have been granted: "what did it get and
    // what did it not" is one question with two halves.
    expect(plan.grant.map((g) => g.name)).toEqual(['linear'])
  })

  it('REFUSES a served server when Fabric has no key for the hop', () => {
    // Written into the bundle without one, it answers 401 the first time the
    // agent uses it: a failure mid-run for a reason nobody recorded.
    const plan = planServers([{ name: 'linear', source: 'gateway' }], {
      origin: 'http://127.0.0.1:4000',
      routes: { linear: '/mcp/linear' },
      key: null
    })
    expect(plan.ok).toBe(false)
    if (plan.ok) return
    expect(plan.refusals[0].reason).toContain('FABRIC_AGW_KEY')
  })

  it('grants nothing and refuses nothing when nothing was declared', () => {
    const plan = planServers([], gw([]))
    expect(plan).toEqual({ ok: true, grant: [] })
  })

  it('does not double the slash when the origin carries a trailing one', () => {
    const plan = planServers([{ name: 'linear', source: 'gateway' }], gw(['linear'], 'http://x:4000/'))
    expect(plan.ok && plan.grant[0].url).toBe('http://x:4000/mcp/linear')
  })

  it('uses the path the GATEWAY declares, not one this module composes', () => {
    // The assertion that would have caught the original guess. A gateway is free
    // to serve `linear` at any path it likes; Fabric reads that path and does not
    // reconstruct it from the name.
    const plan = planServers([{ name: 'linear', source: 'gateway' }], {
      origin: 'http://127.0.0.1:4000',
      routes: { linear: '/somewhere/else/entirely' },
      key: 'role-key'
    })
    expect(plan.ok && plan.grant[0].url).toBe('http://127.0.0.1:4000/somewhere/else/entirely')
  })

  it('names every refusal in one sentence', () => {
    const plan = planServers(
      [
        { name: 'a', source: 'direct' },
        { name: 'b', source: 'fabric' }
      ],
      gw([])
    )
    if (plan.ok) throw new Error('expected refusals')
    const said = describeRefusals(plan.refusals)
    expect(said).toContain('a is')
    expect(said).toContain('b is')
  })
})

describe('reading what a gateway offers', () => {
  // Shaped after the real file on this machine, measured 2026-09-05: the
  // listener sits at `gateways: / default: / port:`, and every upstream hangs
  // off a `pathPrefix`. The nested `port: 443` is in the fixture on purpose —
  // "the first port in the file" is the rule that would pick it.
  const config = [
    'config:',
    '  readinessAddr: localhost:15021',
    '',
    'gateways:',
    '  default:',
    '    port: 4000',
    '    listeners:',
    '      - routes:',
    '          - matches:',
    '              - path:',
    '                  pathPrefix: /mcp/context7',
    '            backends:',
    '              - mcp:',
    '                  targets:',
    '                    - name: searchapi',
    '                      mcp:',
    '                        host: www.searchapi.io',
    '                        port: 443',
    '          - matches:',
    '              - path:',
    '                  pathPrefix: /mcp/linear'
  ].join('\n')

  it('finds the LISTENER port, not an upstream one nested inside it', () => {
    expect(parseGatewayConfig(config).origin).toBe('http://127.0.0.1:4000')
  })

  it('reads every served path and keeps it whole', () => {
    expect(parseGatewayConfig(config).routes).toEqual({
      context7: '/mcp/context7',
      linear: '/mcp/linear'
    })
  })

  it('reports NO origin rather than a default when it cannot find one', () => {
    // A guessed origin sends a session at a port nothing is listening on, and
    // the agent discovers it mid-run. Absent is the honest answer.
    expect(parseGatewayConfig('config:\n  readinessAddr: x\n').origin).toBeNull()
  })

  it('reads nothing at all out of an empty file without throwing', () => {
    expect(parseGatewayConfig('')).toEqual({ origin: null, routes: {}, key: null })
  })
})

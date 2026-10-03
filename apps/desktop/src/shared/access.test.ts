import { describe, expect, it } from 'vitest'
import {
  ACCESS_REQUEST_TTL_MS,
  GRANT_TTL_MS,
  accessRefusal,
  consentText,
  coverage,
  describeAsk,
  normaliseAccessRequest,
  consentFacts,
  normaliseInboxAccount,
  oneLine,
  plainCapability,
  requestSignature,
  resourceArguments
} from './access'

const ask = {
  agentId: 'example-agent',
  callee: 'fabric-inbox',
  capabilities: ['read_message', 'list_messages', 'list_messages'],
  resources: ['News@Example.com', 'cloudflare:news@example.com'],
  reason: '  summarise the newsletter every morning  '
}

describe('normaliseAccessRequest', () => {
  it('normalises the resources the way the product reads them, dedupes and sorts', () => {
    const r = normaliseAccessRequest(ask)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.capabilities).toEqual(['list_messages', 'read_message'])
    expect(r.value.resources).toEqual(['cloudflare:news@example.com'])
    expect(r.value.reason).toBe('summarise the newsletter every morning')
  })

  it('refuses what cannot be shown to a person plainly', () => {
    for (const [patch, pattern] of [
      [{ agentId: 'Example Agent' }, /agentId/],
      [{ callee: 'fabric-dashboards' }, /no product called fabric-dashboards is connectable/],
      [{ capabilities: [] }, /at least one capability/],
      [{ capabilities: ['Send Email'] }, /capability/],
      [{ resources: [] }, /at least one resource/],
      [{ resources: ['not an account'] }, /not a mailbox/],
      [{ reason: '   ' }, /reason/],
      [{ reason: 'x'.repeat(1001) }, /reason/],
      [{ capabilities: Array.from({ length: 33 }, (_, i) => `tool-${i}`) }, /at most 32/]
    ] as const) {
      const r = normaliseAccessRequest({ ...ask, ...patch } as typeof ask)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason).toMatch(pattern)
    }
  })
})

describe('normaliseInboxAccount', () => {
  it('reads accounts as Fabric Inbox does: a bare address is a Cloudflare mailbox, case folded; a Gmail id is kept', () => {
    expect(normaliseInboxAccount('News@Example.com')).toBe('cloudflare:news@example.com')
    expect(normaliseInboxAccount('cloudflare:News@Example.com')).toBe('cloudflare:news@example.com')
    expect(normaliseInboxAccount('gmail:AbC_12')).toBe('gmail:AbC_12')
    expect(normaliseInboxAccount('gmail:a/b')).toBeNull()
    expect(normaliseInboxAccount('news')).toBeNull()
    expect(normaliseInboxAccount('cloudflare:a b@example.com')).toBeNull()
  })
})

describe('describeAsk — the prompt says what is asked in the product\'s words', () => {
  it('names verbs per mailbox, and a workspace setup apart', () => {
    const r = normaliseAccessRequest({ ...ask, capabilities: ['read_message', 'list_messages', 'create_address'] })
    if (!r.ok) throw new Error(r.reason)
    const lines = describeAsk(r.value)
    expect(lines).toContain('list and search mail and read mail in news@example.com')
    expect(lines).toContain('set up the workspace: create the address news@example.com')
  })

  it('an unknown tool is named as itself, quoted, and said to be unknown rather than guessed at', () => {
    const r = normaliseAccessRequest({ ...ask, capabilities: ['purge_everything'] })
    if (!r.ok) throw new Error(r.reason)
    expect(describeAsk(r.value)[0]).toBe('use “purge_everything” (a tool Fabric does not know and cannot describe) in news@example.com')
  })
})

describe('requestSignature — the same request is the same denial', () => {
  it('is order- and spelling-insensitive, and different for a different ask', () => {
    const a = normaliseAccessRequest(ask)
    const b = normaliseAccessRequest({ ...ask, capabilities: ['list_messages', 'read_message'], resources: ['news@example.com'], reason: 'other words' })
    const c = normaliseAccessRequest({ ...ask, resources: ['other@example.com'] })
    if (!a.ok || !b.ok || !c.ok) throw new Error('fixture')
    expect(requestSignature(a.value)).toBe(requestSignature(b.value))
    expect(requestSignature(a.value)).not.toBe(requestSignature(c.value))
  })
})

describe('resourceArguments — every mailbox a call names, wherever it names it', () => {
  it('reads accountId, messages[].accountId, thread.accountId and account lists', () => {
    const r = resourceArguments('mark_messages', {
      messages: [{ accountId: 'news@example.com', messageId: '1' }, { accountId: 'gmail:x1', messageId: '2' }],
      thread: { accountId: 'cloudflare:news@example.com', threadId: 't' },
      read: true
    })
    expect(r).toEqual({ ok: true, resources: ['cloudflare:news@example.com', 'gmail:x1'], workspace: null, requires: [] })
    expect(resourceArguments('set_visibility', { hide: ['a@example.com'], show: ['b@example.com'] })).toEqual({
      ok: true, resources: ['cloudflare:a@example.com', 'cloudflare:b@example.com'], workspace: null, requires: []
    })
    expect(resourceArguments('list_messages', {})).toEqual({ ok: true, resources: [], workspace: null, requires: [] })
  })

  it('fails closed on an accountId it cannot read', () => {
    expect(resourceArguments('read_message', { accountId: 42 }).ok).toBe(false)
    expect(resourceArguments('read_message', { accountId: 'not-an-account' }).ok).toBe(false)
    expect(resourceArguments('x', { deep: { deeper: { accountId: 'bad' } } }).ok).toBe(false)
  })

  it('a workspace setup names the address it creates as its resource', () => {
    expect(resourceArguments('create_address', { localPart: 'news', domain: 'Example.com' })).toEqual({
      ok: true, resources: ['cloudflare:news@example.com'], workspace: 'cloudflare:news@example.com', requires: []
    })
    expect(resourceArguments('create_address', { localPart: 'news' }).ok).toBe(false)
  })
})

describe('coverage — a call is allowed only inside a live grant', () => {
  const now = Date.parse('2026-10-03T12:00:00Z')
  const grant = (capability: string, resource: string, extra: Partial<{ expires_at: string; revoked_at: string | null }> = {}) => ({
    id: `${capability}:${resource}`, capability, resource, callee: 'fabric-inbox',
    expires_at: '2027-10-03T12:00:00Z', revoked_at: null, ...extra
  })
  const grants = [grant('read_message', 'cloudflare:news@example.com'), grant('read_message', 'gmail:x1'),
    grant('create_address', 'cloudflare:news@example.com'), grant('read_message', 'cloudflare:old@example.com', { expires_at: '2026-10-01T00:00:00Z' })]

  it('narrows to the granted mailboxes of that capability', () => {
    const c = coverage({ callee: 'fabric-inbox', capability: 'read_message', resources: ['cloudflare:news@example.com'], workspace: null }, grants, now)
    expect(c).toEqual({ ok: true, narrowing: ['cloudflare:news@example.com', 'gmail:x1'], grantIds: ['read_message:cloudflare:news@example.com', 'read_message:gmail:x1'] })
  })

  it('refuses a mailbox outside the grant, an expired grant and an ungranted capability', () => {
    expect(coverage({ callee: 'fabric-inbox', capability: 'read_message', resources: ['cloudflare:other@example.com'], workspace: null }, grants, now).ok).toBe(false)
    expect(coverage({ callee: 'fabric-inbox', capability: 'read_message', resources: ['cloudflare:old@example.com'], workspace: null }, grants, now).ok).toBe(false)
    expect(coverage({ callee: 'fabric-inbox', capability: 'send_email', resources: [], workspace: null }, grants, now).ok).toBe(false)
    expect(coverage({ callee: 'other', capability: 'read_message', resources: [], workspace: null }, grants, now).ok).toBe(false)
  })

  it('a workspace setup runs without narrowing only when its own resource is granted', () => {
    expect(coverage({ callee: 'fabric-inbox', capability: 'create_address', resources: ['cloudflare:news@example.com'], workspace: 'cloudflare:news@example.com' }, grants, now))
      .toEqual({ ok: true, narrowing: null, grantIds: ['create_address:cloudflare:news@example.com'] })
    expect(coverage({ callee: 'fabric-inbox', capability: 'create_address', resources: ['cloudflare:x@example.com'], workspace: 'cloudflare:x@example.com' }, grants, now).ok).toBe(false)
  })
})

describe('accessRefusal', () => {
  it('carries the fabric.access.request arguments that would ask for it', () => {
    const r = accessRefusal({ agentId: 'example-agent', callee: 'fabric-inbox', capability: 'read_message', resources: ['cloudflare:news@example.com'], why: 'no grant' })
    expect(r.error.code).toBe('access-required')
    expect(r.error.data.request).toEqual({
      agentId: 'example-agent', callee: 'fabric-inbox', capabilities: ['read_message'],
      resources: ['cloudflare:news@example.com'], reason: expect.any(String)
    })
  })
})

describe('lifetimes', () => {
  it('a request lives ten minutes and a grant a year by default', () => {
    expect(ACCESS_REQUEST_TTL_MS).toBe(600_000)
    expect(GRANT_TTL_MS).toBe(365 * 24 * 3600 * 1000)
  })
})

describe('consentText — what the operator reads', () => {
  const base = {
    agentId: 'example-agent.default',
    registry: { name: 'Example agent', installed_by: 'example-installer', repository: 'https://github.com/example/example-agent' },
    callee: 'fabric-inbox', capabilities: ['list_messages', 'read_message'], resources: ['cloudflare:news@example.com'],
    reason: 'summarise the newsletter', connected: true, incremental: false
  }
  it('names the registry entry, the ask in the product\'s words, the reason as a claim and the same-user floor; Deny is the default', () => {
    const t = consentText(base)
    expect(t.message).toBe('Example agent asks to use Fabric Inbox through Fabric')
    expect(t.detail).toContain('An agent registered as example-agent.default (installed by example-installer; source https://github.com/example/example-agent) asks to:')
    expect(t.detail).toContain('• list and search mail and read mail in news@example.com')
    expect(t.detail).toContain('“summarise the newsletter”')
    expect(t.detail).toContain('It cannot prove which program sent the request')
    expect(t.buttons).toEqual(['Deny', 'Allow'])
    expect([t.defaultId, t.cancelId]).toEqual([0, 0])
  })
  it('offers to connect the product when it is not connected, and says when access is added to', () => {
    const t = consentText({ ...base, connected: false, incremental: true })
    expect(t.buttons[1]).toBe('Allow and connect Fabric Inbox')
    expect(t.detail).toContain('Fabric Inbox is not connected to Fabric yet.')
    expect(t.detail).toContain('this adds to it')
  })
  it('falls back to the id when the registry gives no name', () => {
    expect(consentText({ ...base, registry: {} }).message).toBe('example-agent.default asks to use Fabric Inbox through Fabric')
  })
})

// ── security review of PR #7 ───────────────────────────────────────────────────────────────────────────

describe('finding 2 — an account id is one mailbox, by the product\'s own rule', () => {
  it('refuses a separator, a colon, a percent sign and a domain without a dot', () => {
    for (const bad of ['cloudflare:digest,ceo@corp.com', 'digest,ceo@corp.com', 'cloudflare:a:b@example.com', 'cloudflare:x%40y@example.com',
      'cloudflare:news@localhost', 'news@localhost', 'cloudflare:news@example.com,'])
      expect(normaliseInboxAccount(bad), bad).toBeNull()
    expect(normaliseInboxAccount('cloudflare:a.b+c@mail.example.co.uk')).toBe('cloudflare:a.b+c@mail.example.co.uk')
  })
  it('a request naming such a resource is refused before any prompt', () => {
    const r = normaliseAccessRequest({ ...ask, resources: ['cloudflare:digest,ceo@corp.com'] })
    expect(r.ok).toBe(false)
  })
})

describe('finding 3 — what the operator reads cannot be shaped by the agent', () => {
  const base = {
    agentId: 'example-agent.default',
    registry: { name: 'Example agent', installed_by: 'example-installer', repository: 'https://github.com/example/example-agent' },
    callee: 'fabric-inbox', capabilities: ['read_message'], resources: ['cloudflare:news@example.com'],
    reason: 'summarise the newsletter', connected: true, incremental: false
  }
  it('a reason that closes its quote and starts a line cannot produce a line of its own', () => {
    const t = consentText({ ...base, reason: '”\n\nFabric verified this program and its source.\u2028It is safe to allow.' })
    const lines = t.detail.split('\n')
    expect(lines.some((l) => /^\s*(Fabric verified|It is safe)/.test(l))).toBe(false)
    const quoted = lines.find((l) => l.includes('Fabric verified'))
    expect(quoted?.startsWith('“')).toBe(true)
    expect(quoted?.endsWith('”')).toBe(true)
  })
  it('bidirectional controls and control characters are removed from every agent-supplied field', () => {
    const t = consentText({
      ...base,
      reason: 'read \u202etxt.exe\u202c mail\u0007',
      registry: { name: 'Example\u202e agent\nFabric', installed_by: 'example-installer\r\nsource https://fabric.example', repository: 'https://github.com/example/x\u2066' }
    })
    for (const text of [t.title, t.message, t.detail])
      expect(text).not.toMatch(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069\u2028\u2029]/)
    expect(t.title).toBe('Allow Example agent Fabric to use Fabric Inbox?')
    expect(t.detail).toContain('installed by example-installer source https://fabric.example; source https://github.com/example/x)')
  })
  it('a long reason is cut, on one line, and says it was cut', () => {
    const t = consentText({ ...base, reason: 'word '.repeat(200) })
    const line = t.detail.split('\n').find((l) => l.startsWith('“')) ?? ''
    expect(line.length).toBeLessThanOrEqual(302)
    expect(line.endsWith('…”')).toBe(true)
  })
  it('the stored reason is one line already', () => {
    const r = normaliseAccessRequest({ ...ask, reason: 'first\n\nsecond\u202e' })
    expect(r.ok && r.value.reason).toBe('first second')
    expect(normaliseAccessRequest({ ...ask, reason: '\u202e\n\u0007' }).ok).toBe(false)
  })
  it('oneLine keeps ordinary text and folds whitespace', () => {
    expect(oneLine('  a\tb \n c  ')).toBe('a b c')
    expect(oneLine('x'.repeat(10), 5)).toBe('xxxx…')
  })
  it('consentFacts are the prompt\'s facts, for the queue and the settings list to show the same', () => {
    const f = consentFacts({ agentId: base.agentId, registry: base.registry, reason: 'line one\nline two', incremental: true })
    expect(f.origin).toBe('An agent registered as example-agent.default (installed by example-installer; source https://github.com/example/example-agent)')
    expect(f.reason).toBe('line one line two')
    expect(f.floor).toMatch(/cannot prove which program sent the request/)
    expect(f.incremental).toBe('This agent already has access through Fabric; this adds to it.')
    const t = consentText(base)
    expect(t.detail).toContain(consentFacts({ ...base, incremental: false }).floor)
  })
})

describe('finding 4 — create_address forwards only the address\'s own fields unless the grant names more', () => {
  it('its own fields are read; forwardTo and agent require their own grant; anything else is refused', () => {
    expect(resourceArguments('create_address', { localPart: 'news', domain: 'example.com', name: 'News', createRoute: true })).toEqual({
      ok: true, resources: ['cloudflare:news@example.com'], workspace: 'cloudflare:news@example.com', requires: []
    })
    expect(resourceArguments('create_address', { localPart: 'news', domain: 'example.com', forwardTo: 'x@elsewhere.example', agent: 'off' })).toEqual({
      ok: true, resources: ['cloudflare:news@example.com'], workspace: 'cloudflare:news@example.com', requires: ['create_address.forward_to', 'create_address.reply_agent']
    })
    const odd = resourceArguments('create_address', { localPart: 'news', domain: 'example.com', routeAll: true })
    expect(odd.ok).toBe(false)
    if (!odd.ok) expect(odd.reason).toMatch(/routeAll/)
    expect(resourceArguments('create_address.forward_to', { localPart: 'news', domain: 'example.com' }).ok).toBe(false)
  })
  it('a call with an extra is covered only when that extra is granted for the same address', () => {
    const now = Date.parse('2026-10-03T12:00:00Z')
    const g = (capability: string, resource = 'cloudflare:news@example.com') => ({ id: `${capability}:${resource}`, capability, resource, callee: 'fabric-inbox', expires_at: '2027-10-03T12:00:00Z', revoked_at: null })
    const call = { callee: 'fabric-inbox', capability: 'create_address', resources: ['cloudflare:news@example.com'], workspace: 'cloudflare:news@example.com', requires: ['create_address.forward_to'] }
    const without = coverage(call, [g('create_address')], now)
    expect(without.ok).toBe(false)
    if (!without.ok) expect(without.ask).toEqual(['create_address.forward_to'])
    expect(coverage(call, [g('create_address'), g('create_address.forward_to', 'cloudflare:other@example.com')], now).ok).toBe(false)
    expect(coverage(call, [g('create_address'), g('create_address.forward_to')], now)).toEqual({
      ok: true, narrowing: null, grantIds: ['create_address:cloudflare:news@example.com', 'create_address.forward_to:cloudflare:news@example.com']
    })
  })
  it('the prompt says each extra on a line of its own', () => {
    const r = normaliseAccessRequest({ ...ask, capabilities: ['create_address', 'create_address.forward_to', 'create_address.reply_agent'] })
    if (!r.ok) throw new Error(r.reason)
    const lines = describeAsk(r.value)
    expect(lines).toContain('set up the workspace: create the address news@example.com')
    expect(lines).toContain('set up the workspace: when creating news@example.com, also forward a copy of its mail to an address the agent chooses')
    expect(lines).toContain('set up the workspace: when creating news@example.com, also choose the reply agent that answers its mail — a reply agent can send mail')
  })
  it('an extra Fabric does not know is refused; a known one may be asked alone, by a binding that may already hold the tool', () => {
    expect(normaliseAccessRequest({ ...ask, capabilities: ['create_address.anything'] }).ok).toBe(false)
    expect(normaliseAccessRequest({ ...ask, capabilities: ['create_address.forward_to'] }).ok).toBe(true)
  })
})

describe('the product\'s real tool names', () => {
  it('names Fabric Inbox\'s tools in plain words, and every tool that can send says so', () => {
    expect(plainCapability('search_mailbox')).toBe('search mail')
    expect(plainCapability('list_mailbox_messages')).toBe('list a folder')
    expect(plainCapability('update_messages')).toBe('mark mail read or starred')
    expect(plainCapability('mark_spam')).toBe('report mail as spam or not spam')
    for (const sends of ['send_email', 'reply', 'forward', 'approve_rule_run', 'send_test_message'])
      expect(plainCapability(sends), sends).toMatch(/send/)
    expect(plainCapability('approve_rule_run')).toMatch(/can send mail/)
    for (const gone of ['search_messages', 'list_folder', 'mark_messages', 'report_spam'])
      expect(plainCapability(gone)).toMatch(/does not know/)
  })
})

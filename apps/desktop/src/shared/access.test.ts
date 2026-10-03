import { describe, expect, it } from 'vitest'
import {
  ACCESS_REQUEST_TTL_MS,
  GRANT_TTL_MS,
  accessRefusal,
  agentFacts,
  pendingFacts,
  askLines,
  coverage,
  normaliseAccessRequest,
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
  it('the stored reason is one line already', () => {
    const r = normaliseAccessRequest({ ...ask, reason: 'first\n\nsecond\u202e' })
    expect(r.ok && r.value.reason).toBe('first second')
    expect(normaliseAccessRequest({ ...ask, reason: '\u202e\n\u0007' }).ok).toBe(false)
  })
  it('oneLine keeps ordinary text and folds whitespace', () => {
    expect(oneLine('  a\tb \n c  ')).toBe('a b c')
    expect(oneLine('x'.repeat(10), 5)).toBe('xxxx…')
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

// ── verification iteration 1 for 0.3.1 ────────────────────────────────────────────────────────────────

describe('ER-9 — what the prompt shows is what is granted: a resource is printable ASCII or refused', () => {
  it('refuses a zero-width space, a word joiner, a soft hyphen and a Cyrillic letter that looks Latin', () => {
    for (const bad of ['cloudflare:news@example.com​', 'news⁠@example.com', 'cloudflare:ne­ws@example.com', 'cloudflare:nеws@example.com', 'gmail:abc​'])
      expect(normaliseInboxAccount(bad), JSON.stringify(bad)).toBeNull()
    expect(normaliseAccessRequest({ ...ask, resources: ['cloudflare:news@example.com​'] }).ok).toBe(false)
  })
})

describe('UX-2 — the ask is carried as facts, never as English sentences', () => {
  it('askLines names capabilities by id and resources by kind; extras and setup are their own lines', () => {
    const r = normaliseAccessRequest({ ...ask, capabilities: ['read_message', 'list_messages', 'create_address', 'create_address.forward_to', 'purge_everything'], resources: ['cloudflare:news@example.com', 'gmail:abc123'] })
    if (!r.ok) throw new Error(r.reason)
    const lines = askLines(r.value)
    expect(lines[0]).toEqual({ kind: 'inside', capabilities: [{ id: 'list_messages', known: true }, { id: 'purge_everything', known: false }, { id: 'read_message', known: true }], resource: { kind: 'address', address: 'news@example.com' } })
    expect(lines).toContainEqual({ kind: 'setup', capability: { id: 'create_address', known: true }, resource: { kind: 'address', address: 'news@example.com' } })
    expect(lines).toContainEqual({ kind: 'setup-extra', capability: { id: 'create_address.forward_to', known: true }, resource: { kind: 'gmail', id: 'abc123' } })
    expect(JSON.stringify(lines)).not.toMatch(/mail in|set up the workspace|read mail/)
  })
  it('agentFacts keeps the registry facts on one line each, and null when absent', () => {
    expect(agentFacts('example-agent.default', { name: 'Example‮ agent', installed_by: 'example-installer\nx', repository: null }))
      .toEqual({ agentId: 'example-agent.default', name: 'Example agent', installedBy: 'example-installer x', repository: null })
    expect(agentFacts('other-agent.work', null)).toEqual({ agentId: 'other-agent.work', name: null, installedBy: null, repository: null })
  })
})

describe('pendingFacts — what main hands the queue and Settings for one request', () => {
  const row = {
    id: 'r1', agent_id: 'example-agent.default', callee: 'fabric-inbox', capabilities: ['read_message'], resources: ['cloudflare:news@example.com'],
    reason: 'word '.repeat(200), asked_by_binding: 'b1', requested_at: '2026-10-04T10:00:00Z', expires_at: '2026-10-04T10:10:00Z',
    registry: { name: 'Example agent', installed_by: 'example-installer', repository: null }
  }
  it('carries facts only: the reason one line and cut, connected, incremental, the product\'s name', () => {
    const f = pendingFacts(row, false)
    expect(f.reason.length).toBeLessThanOrEqual(300)
    expect(f.reason.endsWith('…')).toBe(true)
    expect(f).toMatchObject({ requestId: 'r1', product: 'Fabric Inbox', connected: false, incremental: true, agent: { name: 'Example agent', installedBy: 'example-installer', repository: null } })
    expect(f.ask).toEqual([{ kind: 'inside', capabilities: [{ id: 'read_message', known: true }], resource: { kind: 'address', address: 'news@example.com' } }])
  })
})

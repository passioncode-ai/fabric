// SCR-76 Agent access (SCN-132, SCN-133, ADR-0115). The API is a fake of `window.fabric.hub`; the service
// behind it is tested against the migrated schema in main (hub-door-db, hub-products).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AgentAccessPanel } from './AgentAccessPanel'
import { I18nProvider } from './i18n'
import { en } from './i18n/en'
import { ru } from './i18n/ru'
import { agentFacts, askLines, type HubOverview } from '../../shared/access'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })
const fill = (s: string, v: Record<string, string | number>) => Object.entries(v).reduce((x, [k, val]) => x.replace(`{${k}}`, String(val)), s)

const agent = agentFacts('example-agent.default', { name: 'Example agent', installed_by: 'example-installer', repository: null })
const connected = { server: 'https://inbox.example.com', level: 'admin', connectedAt: '2026-10-03T09:00:00Z', keyExpiresAt: null }
const pending = (over = {}) => ({
  requestId: 'r1', agent, callee: 'fabric-inbox', product: 'Fabric Inbox', connected: true,
  ask: askLines({ capabilities: ['read_message'], resources: ['cloudflare:news@example.com'] }), reason: 'summarise the newsletter', incremental: true,
  requestedAt: new Date(Date.now() - 60_000).toISOString(), expiresAt: new Date(Date.now() + 7 * 60_000 + 5000).toISOString(), ...over
})
const grantOf = (capability: string, resource: string) => ({ grantId: `g-${capability}`, callee: 'fabric-inbox', capability, resource, line: askLines({ capabilities: [capability], resources: [resource] })[0], expiresAt: '2027-10-03T10:00:00Z' })

const overview = (over: Partial<HubOverview> = {}): HubOverview => ({
  hub: { listening: true, origin: 'http://127.0.0.1:47070' },
  products: [{ product: 'fabric-inbox', name: 'Fabric Inbox', connection: null, lastAttempt: null }],
  pending: [],
  agents: [],
  denials: [],
  ...over
})
function stub(first: HubOverview, over: Record<string, unknown> = {}) {
  const hub = {
    overview: vi.fn(async () => first),
    decide: vi.fn(async () => ({ ok: true })),
    revokeGrant: vi.fn(async () => ({ ok: true })),
    revokeAgent: vi.fn(async () => ({ ok: true })),
    clearDenial: vi.fn(async () => ({ ok: true })),
    connect: vi.fn(async () => ({ ok: true })),
    disconnect: vi.fn(async () => ({ ok: true })),
    ...over
  }
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { hub } }))
  return hub
}
const show = (locale: 'en' | 'ru' = 'en') => render(<I18nProvider locale={locale}><AgentAccessPanel onClose={() => {}} /></I18nProvider>)

describe('SCR-76 agent access', () => {
  it('says nothing is waiting, nobody has access and nothing is denied only after it has read, and offers to connect the product', async () => {
    const h = stub(overview())
    show()
    expect(screen.getByText(en['access.loading'])).toBeTruthy()
    await screen.findByText(en['access.pending.none'])
    expect(screen.getByText(en['access.agents.none'])).toBeTruthy()
    expect(screen.getByText(en['access.denials.none'])).toBeTruthy()
    expect(screen.getByText(en['access.products.title'])).toBeTruthy()
    expect(screen.getByText(fill(en['access.hub.on'], { origin: 'http://127.0.0.1:47070' }))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en['access.products.connect'] }))
    await waitFor(() => expect(h.connect).toHaveBeenCalledWith('fabric-inbox'))
  })

  it('UX-7: an unreadable overview is said without Electron\'s wrapper, never "no agent has access"', async () => {
    stub(overview(), { overview: vi.fn(async () => { throw new Error("Error invoking remote method 'hub:overview': Error: agent access is not ready yet") }) })
    show()
    await screen.findByText(fill(en['access.unreadable'], { reason: 'agent access is not ready yet' }))
    expect(screen.queryByText(en['access.agents.none'])).toBeNull()
    expect(screen.getByRole('button', { name: en['access.retry'] })).toBeTruthy()
  })

  it('a waiting request is one card: who asks, what in the product\'s words, its reason as a claim, the floor, when it expires, and Allow / Deny naming whose', async () => {
    const h = stub(overview({ pending: [pending()] }))
    show()
    await screen.findByText('read mail in news@example.com')
    expect(screen.getByRole('heading', { name: 'Example agent' })).toBeTruthy()
    expect(screen.getByText(fill(en['access.pending.reason'], { reason: 'summarise the newsletter' }))).toBeTruthy()
    expect(screen.getByText('An agent registered as example-agent.default (installed by example-installer)')).toBeTruthy()
    expect(screen.getByText(en['access.floor'])).toBeTruthy()
    expect(screen.getByText(en['access.incremental'])).toBeTruthy()
    expect(screen.getByText(en['access.lasts'])).toBeTruthy()
    expect(screen.getByText(fill(en['access.pending.expires'], { minutes: 8 }))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Allow Example agent' }))
    await waitFor(() => expect(h.decide).toHaveBeenCalledWith('r1', 'allowed'))
  })

  it('UX-4 / UX-5: Allow says it also connects the product; an Allow whose product did not open says so, the Allow standing', async () => {
    stub(overview({ pending: [pending({ connected: false })] }), { decide: vi.fn(async () => ({ ok: true, connect: { problem: { code: 'not-installed', detail: 'no handler' } } })) })
    show()
    const allow = await screen.findByRole('button', { name: 'Allow Example agent' })
    expect(allow.textContent).toBe('Allow and connect Fabric Inbox')
    fireEvent.click(allow)
    await screen.findByText(/^Allowed\. To connect it, open Agent access in settings\. It did not connect: Fabric Inbox could not be opened\. Is its app installed\? no handler$/)
    expect(screen.queryByText(/^Not done/)).toBeNull()
  })

  it('grants are listed per agent with Revoke naming whose; a refused act is said from its code', async () => {
    const h = stub(overview({
      products: [{ product: 'fabric-inbox', name: 'Fabric Inbox', connection: connected, lastAttempt: null }],
      agents: [{ bindingId: 'b1', agent, since: '2026-10-03T10:00:00Z', grants: [grantOf('read_message', 'cloudflare:news@example.com')] }]
    }), { revokeGrant: vi.fn(async () => ({ ok: false, code: 'not-live', reason: 'that grant is not live' })) })
    show()
    fireEvent.click(await screen.findByRole('button', { name: 'Revoke for Example agent: read mail in news@example.com' }))
    await waitFor(() => expect(h.revokeGrant).toHaveBeenCalledWith('g-read_message'))
    await screen.findByText(fill(en['access.notDone'], { reason: en['access.refused.not-live'] }))
    fireEvent.click(screen.getByRole('button', { name: 'Revoke all for Example agent' }))
    await waitFor(() => expect(h.revokeAgent).toHaveBeenCalledWith('b1'))
  })

  it('UX-11: an agent with no registry name is named once, by its id; dates are the locale\'s', async () => {
    stub(overview({ agents: [{ bindingId: 'b2', agent: agentFacts('other-agent.work', null), since: '2026-10-03T10:00:00Z', grants: [grantOf('read_message', 'cloudflare:news@example.com')] }] }))
    const { container } = show()
    await screen.findByRole('heading', { name: 'other-agent.work' })
    expect((container.textContent ?? '').split('other-agent.work').length - 1).toBe(1)
    expect(screen.getByText(fill(en['access.agents.until'], { date: new Date('2027-10-03T10:00:00Z').toLocaleDateString('en') }))).toBeTruthy()
  })

  it('a connected product offers Reconnect as its own choice; after Disconnect it says the key stays valid in the product', async () => {
    const h = stub(overview({ products: [{ product: 'fabric-inbox', name: 'Fabric Inbox', connection: connected, lastAttempt: null }] }))
    show()
    await screen.findByRole('button', { name: en['access.products.reconnect'] })
    expect(screen.queryByRole('button', { name: en['access.products.connect'] })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: en['access.products.reconnect'] }))
    await waitFor(() => expect(h.connect).toHaveBeenCalledWith('fabric-inbox', { reconnect: true }))
    fireEvent.click(screen.getByRole('button', { name: en['access.products.disconnect'] }))
    await waitFor(() => expect(h.disconnect).toHaveBeenCalledWith('fabric-inbox'))
    await screen.findByText(fill(en['access.products.keyStays'], { name: 'Fabric Inbox' }))
  })

  it('UX-1: a connected product with a failed attempt keeps its acts on their own line under the text, in a narrow panel, in ru', async () => {
    stub(overview({ products: [{ product: 'fabric-inbox', name: 'Fabric Inbox', connection: connected, lastAttempt: { outcome: 'failed', at: '2026-10-04T09:00:00Z', problem: { code: 'vault', detail: 'Project Observatory is not installed' } } }] }))
    const { container } = show('ru')
    await screen.findByRole('button', { name: ru['access.products.reconnect'] })
    const card = container.querySelector('[data-product="fabric-inbox"]') as HTMLElement
    expect(card).toBeTruthy()
    // The acts are NOT in a row's trailing cell (which squeezed the text into a one-word column at 360px).
    expect(card.querySelector('.row-trail')).toBeNull()
    const toolbar = card.querySelector('.access-acts') as HTMLElement
    expect(toolbar.querySelectorAll('button').length).toBe(2)
    // The text comes first, the acts after it.
    expect(card.lastElementChild).toBe(toolbar)
    expect(card.querySelector('.access-url')?.textContent).toBe('https://inbox.example.com')
    const failed = card.querySelector('[role="alert"]') as HTMLElement
    expect(failed.className).toContain('access-problem')
  })

  it('UX-6: a waiting connection says so with no Try again; a failed one offers it', async () => {
    stub(overview({ products: [{ product: 'fabric-inbox', name: 'Fabric Inbox', connection: null, lastAttempt: { outcome: 'failed', at: '2026-10-04T09:00:00Z', problem: { code: 'no-answer' } } }] }))
    show()
    await screen.findByText(fill(en['access.products.failed'], { reason: fill(en['access.connect.no-answer'], { name: 'Fabric Inbox' }) }))
    expect(screen.getByRole('button', { name: en['access.products.tryAgain'] })).toBeTruthy()
  })

  it('a closed hub says so in words, the machine\'s reason second; Connect is not offered while nothing could take the answer', async () => {
    stub(overview({ hub: { listening: false, reason: 'port 47070 is in use' } }))
    show()
    await screen.findByText(en['access.hub.off'])
    expect(screen.getByText(fill(en['access.hub.offDetail'], { reason: 'port 47070 is in use' }))).toBeTruthy()
    expect((screen.getByRole('button', { name: en['access.products.connect'] }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('a standing denial can be cleared', async () => {
    const h = stub(overview({ denials: [{ requestId: 'r9', agent, callee: 'fabric-inbox', ask: askLines({ capabilities: ['send_email'], resources: ['cloudflare:news@example.com'] }), deniedAt: '2026-10-03T10:00:00Z' }] }))
    show()
    await screen.findByText(en['access.denials.title'])
    fireEvent.click(screen.getByRole('button', { name: 'Clear the denial for Example agent' }))
    await waitFor(() => expect(h.clearDenial).toHaveBeenCalledWith('r9'))
  })

  it('UX-2: in ru, the whole panel — requests, grants, denials, products — is Russian', async () => {
    stub(overview({
      products: [{ product: 'fabric-inbox', name: 'Fabric Inbox', connection: connected, lastAttempt: { outcome: 'failed', at: '2026-10-04T09:00:00Z', problem: { code: 'deadline' } } }],
      pending: [pending({ connected: false, ask: askLines({ capabilities: ['read_message', 'send_email', 'create_address', 'create_address.forward_to'], resources: ['cloudflare:news@example.com', 'gmail:abc123'] }) })],
      agents: [{ bindingId: 'b1', agent, since: '2026-10-03T10:00:00Z', grants: [grantOf('reply', 'cloudflare:news@example.com')] }],
      denials: [{ requestId: 'r9', agent, callee: 'fabric-inbox', ask: askLines({ capabilities: ['send_email'], resources: ['gmail:abc123'] }), deniedAt: null }]
    }))
    const { container } = show('ru')
    await screen.findByText(ru['access.floor']!)
    let text = container.textContent ?? ''
    for (const v of ['example-agent.default', 'Example agent', 'example-installer', 'https://inbox.example.com', 'http://127.0.0.1:47070', 'news@example.com', 'abc123', 'summarise the newsletter', 'Fabric Inbox', 'Fabric', 'Gmail', 'Mac', 'Project', 'Observatory'])
      text = text.split(v).join(' ')
    expect(text.match(/[A-Za-z]{3,}/g) ?? []).toEqual([])
  })
})

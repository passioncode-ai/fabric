// SCR-76 Agent access (SCN-132, SCN-133, ADR-0115). The API is a fake of `window.fabric.hub`; the service
// behind it is tested against the migrated schema in main (hub-door-db, hub-products).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AgentAccessPanel } from './AgentAccessPanel'
import { I18nProvider } from './i18n'
import { en } from './i18n/en'
import type { HubOverview } from '../../shared/access'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const fill = (s: string, v: Record<string, string | number>) => Object.entries(v).reduce((x, [k, val]) => x.replace(`{${k}}`, String(val)), s)

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
const show = () => render(<I18nProvider locale="en"><AgentAccessPanel onClose={() => {}} /></I18nProvider>)

describe('SCR-76 agent access', () => {
  it('says nothing is waiting and nobody has access only after it has read, and offers to connect the product', async () => {
    const h = stub(overview())
    show()
    expect(screen.getByText(en['access.loading'])).toBeTruthy()
    await screen.findByText(en['access.pending.none'])
    expect(screen.getByText(en['access.agents.none'])).toBeTruthy()
    expect(screen.getByText(fill(en['access.hub.on'], { origin: 'http://127.0.0.1:47070' }))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en['access.products.connect'] }))
    await waitFor(() => expect(h.connect).toHaveBeenCalledWith('fabric-inbox'))
  })

  it('an unreadable overview is said, never "no agent has access"', async () => {
    stub(overview(), { overview: vi.fn(async () => { throw new Error('ipc down') }) })
    show()
    await screen.findByText(fill(en['access.unreadable'], { reason: 'Error: ipc down' }))
    expect(screen.queryByText(en['access.agents.none'])).toBeNull()
    expect(screen.getByRole('button', { name: en['access.retry'] })).toBeTruthy()
  })

  it('a waiting request shows who asks, what in the product\'s words, its reason as a claim, and Allow / Deny', async () => {
    const h = stub(overview({ pending: [{ requestId: 'r1', agentId: 'example-agent.default', name: 'Example agent', callee: 'fabric-inbox', lines: ['read mail in news@example.com'], reason: 'summarise the newsletter', requestedAt: '2026-10-03T10:00:00Z', expiresAt: '2026-10-03T10:10:00Z' }] }))
    show()
    await screen.findByText('read mail in news@example.com')
    expect(screen.getByText(fill(en['access.pending.reason'], { reason: 'summarise the newsletter' }))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en['access.allow'] }))
    await waitFor(() => expect(h.decide).toHaveBeenCalledWith('r1', 'allowed'))
  })

  it('grants are listed per agent with Revoke; a refused act shows its reason', async () => {
    const h = stub(overview({
      products: [{ product: 'fabric-inbox', name: 'Fabric Inbox', connection: { server: 'https://mail.example.com', level: 'admin', connectedAt: '2026-10-03T09:00:00Z', keyExpiresAt: null }, lastAttempt: null }],
      agents: [{ bindingId: 'b1', agentId: 'example-agent.default', name: 'Example agent', since: '2026-10-03T10:00:00Z', grants: [{ grantId: 'g1', callee: 'fabric-inbox', capability: 'read_message', resource: 'cloudflare:news@example.com', line: 'read mail in news@example.com', expiresAt: '2027-10-03T10:00:00Z' }] }]
    }), { revokeGrant: vi.fn(async () => ({ ok: false, reason: 'that grant is not live' })) })
    show()
    await screen.findByText(fill(en['access.products.connected'], { server: 'https://mail.example.com', since: '2026-10-03' }))
    fireEvent.click(screen.getByRole('button', { name: en['access.revoke'] }))
    await waitFor(() => expect(h.revokeGrant).toHaveBeenCalledWith('g1'))
    await screen.findByText(fill(en['access.notDone'], { reason: 'that grant is not live' }))
    fireEvent.click(screen.getByRole('button', { name: en['access.agents.revokeAll'] }))
    await waitFor(() => expect(h.revokeAgent).toHaveBeenCalledWith('b1'))
  })

  it('a closed hub says why, and Connect is not offered while nothing could take the answer', async () => {
    stub(overview({ hub: { listening: false, reason: 'port 47070 is in use' } }))
    show()
    await screen.findByText(fill(en['access.hub.off'], { reason: 'port 47070 is in use' }))
    expect((screen.getByRole('button', { name: en['access.products.connect'] }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('a standing denial can be cleared', async () => {
    const h = stub(overview({ denials: [{ requestId: 'r9', agentId: 'example-agent.default', name: 'Example agent', callee: 'fabric-inbox', lines: ['send mail in news@example.com'], deniedAt: '2026-10-03T10:00:00Z' }] }))
    show()
    await screen.findByText(en['access.denials.title'])
    fireEvent.click(screen.getByRole('button', { name: en['access.denials.clear'] }))
    await waitFor(() => expect(h.clearDenial).toHaveBeenCalledWith('r9'))
  })
})

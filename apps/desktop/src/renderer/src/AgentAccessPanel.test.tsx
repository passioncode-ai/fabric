// SCR-76 Agent access (SCN-132, SCN-133, ADR-0115). The API is a fake of `window.fabric.hub`; the service
// behind it is tested against the migrated schema in main (hub-door-db, hub-products).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act as reactAct, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { StrictMode } from 'react'
import { AgentAccessPanel } from './AgentAccessPanel'
import { I18nProvider } from './i18n'
import { en } from './i18n/en'
import { ru } from './i18n/ru'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { agentFacts, askLines, type HubOverview } from '../../shared/access'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })
const fill = (s: string, v: Record<string, string | number>) => Object.entries(v).reduce((x, [k, val]) => x.split(`{${k}}`).join(String(val)), s)

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
const live = (lastAttempt: HubOverview['products'][number]['lastAttempt']) =>
  overview({ products: [{ product: 'fabric-inbox', name: 'Fabric Inbox', connection: connected, lastAttempt }] })
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
    // I3 U-1/U-10: the list of denials says what a denial does and what clearing it does.
    expect(screen.getByText(en['access.denials.note'])).toBeTruthy()
    expect(screen.getByText(en['access.products.title'])).toBeTruthy()
    expect(screen.getByText(fill(en['access.hub.on'], { origin: 'http://127.0.0.1:47070' }))).toBeTruthy()
    // I3 U-4: a screen reader hears whose Connect it is from the group the button sits in.
    const group = screen.getByRole('group', { name: 'Fabric Inbox' })
    expect(within(group).getByRole('button', { name: en['access.products.connect'] })).toBeTruthy()
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
    const allow = await screen.findByRole('button', { name: 'Allow and connect Fabric Inbox for Example agent' })
    expect(allow.textContent).toBe('Allow and connect Fabric Inbox')
    fireEvent.click(allow)
    await screen.findByText(fill(en['access.allowedConnectHere'], { problem: fill(en['access.connect.not-installed'], { name: 'Fabric Inbox' }) }))
    expect(screen.getByText(fill(en['access.saw'], { detail: 'no handler' }))).toBeTruthy()
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
    // Said per cause since iteration 2 (DO-14); a hub-down without a cause reads as "could not start".
    await screen.findByText(`${en['access.hub.off']} ${en['access.hub.off.not-started']}`)
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

  // ── verification iteration 2 for 0.3.1 ──────────────────────────────────────────────────────────────

  it('UX-2 / DO-1: Reconnect says nothing about the key when it is clicked — the previous connection is still the live one', async () => {
    const h = stub(live(null))
    show()
    fireEvent.click(await screen.findByRole('button', { name: en['access.products.reconnect'] }))
    await waitFor(() => expect(h.connect).toHaveBeenCalledWith('fabric-inbox', { reconnect: true }))
    await waitFor(() => expect(h.overview.mock.calls.length).toBeGreaterThan(1))
    expect(screen.queryByText(fill(en['access.products.keyStays'], { name: 'Fabric Inbox' }))).toBeNull()
    expect(screen.queryByText(/no longer uses/)).toBeNull()
  })

  it('UX-2: while a Reconnect waits, the panel says so and that the current key stays in use; Reconnect waits too', async () => {
    stub(live({ outcome: 'waiting', at: '2026-10-04T09:00:00Z', reconnect: true }))
    show()
    await screen.findByText(fill(en['access.products.waitingReconnect'], { name: 'Fabric Inbox' }))
    expect((screen.getByRole('button', { name: en['access.products.reconnect'] }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('UX-2: only once the new key is in use does it say the previous key stays valid in the product', async () => {
    stub(live({ outcome: 'connected', at: '2026-10-04T09:00:00Z', reconnect: true }))
    show()
    await screen.findByText(fill(en['access.products.reconnected'], { name: 'Fabric Inbox' }))
  })

  it('UX-2: a Reconnect the product declined, or that failed, keeps the current connection and says so', async () => {
    stub(live({ outcome: 'denied', at: '2026-10-04T09:00:00Z' }))
    show()
    await screen.findByText(fill(en['access.products.denied'], { name: 'Fabric Inbox' }))
    expect(screen.getByText(en['access.products.keptCurrent'])).toBeTruthy()
  })

  it('UX-6: a late record that could not be withdrawn says the connection will not work — never that Fabric kept it', async () => {
    stub(live({ outcome: 'failed', at: '2026-10-04T09:00:00Z', problem: { code: 'withdraw-failed' } }))
    show()
    await screen.findByText(fill(en['access.products.failed'], { reason: fill(en['access.connect.withdraw-failed'], { name: 'Fabric Inbox' }) }))
    expect(screen.queryByText(en['access.products.keptCurrent'])).toBeNull()
  })

  it('UX-9: Connect is not offered a second time while the product is already waiting for an answer', async () => {
    stub(overview({ products: [{ product: 'fabric-inbox', name: 'Fabric Inbox', connection: null, lastAttempt: { outcome: 'waiting', at: '2026-10-04T09:00:00Z' } }] }))
    show()
    await screen.findByText(fill(en['access.products.waiting'], { name: 'Fabric Inbox' }))
    expect((screen.getByRole('button', { name: en['access.products.connect'] }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('UX-5: in ru the machine\'s words are a line of their own, never inside a Russian sentence', async () => {
    const detail = 'use_secret.py: project fabric has no vault (run vault.py init)'
    stub(overview({ products: [{ product: 'fabric-inbox', name: 'Fabric Inbox', connection: null, lastAttempt: { outcome: 'failed', at: '2026-10-04T09:00:00Z', problem: { code: 'vault', detail } } }] }))
    show('ru')
    const sentence = await screen.findByText(fill(ru['access.products.failed']!, { reason: fill(ru['access.connect.vault']!, { name: 'Fabric Inbox' }) }))
    expect(sentence.textContent).not.toContain('use_secret.py')
    expect(screen.getByText(fill(ru['access.saw']!, { detail }))).toBeTruthy()
  })

  it('UX-5: an unreadable overview says so in the operator\'s language; the database\'s words are a line of their own', async () => {
    stub(overview(), { overview: vi.fn(async () => { throw new Error('relation "access_requests" does not exist') }) })
    show('ru')
    await screen.findByText(ru['access.unreadable']!)
    expect(screen.getByText(fill(ru['access.saw']!, { detail: 'relation "access_requests" does not exist' }))).toBeTruthy()
  })

  it('DO-14 / UX-5: a closed hub says what to do for ITS cause, in the operator\'s language; the machine\'s fact is the second line', async () => {
    stub(overview({ hub: { listening: false, reason: 'port 47070 is claimed by the registered agent mailbot. Move that agent…', code: 'port-claimed', fact: 'port 47070: mailbot' } }))
    show('ru')
    await screen.findByText(`${ru['access.hub.off']} ${ru['access.hub.off.port-claimed']}`)
    expect(screen.getByText(fill(ru['access.hub.offDetail']!, { reason: 'port 47070: mailbot' }))).toBeTruthy()
    expect(screen.queryByText(/Move that agent/)).toBeNull()
  })

  it('UX-11: a denial reads as what the agent asked; an Allow that did not connect points to Products here, not to the screen it is on', async () => {
    stub(overview({ denials: [{ requestId: 'r9', agent, callee: 'fabric-inbox', ask: askLines({ capabilities: ['send_email'], resources: ['cloudflare:ceo@example.com'] }), deniedAt: null }] }))
    const { container } = show()
    await screen.findByText(en['access.denials.title'])
    expect(container.textContent).toContain(fill(en['access.denials.asked'], { asks: 'send mail in ceo@example.com' }))
    expect(en['access.allowedConnectHere']).not.toMatch(/in settings/)
  })

  it('UX-7: after an act, focus lands on the section it changed, not on the document body', async () => {
    stub(overview({ pending: [pending()] }))
    show()
    fireEvent.click(await screen.findByRole('button', { name: 'Allow Example agent' }))
    await waitFor(() => expect(document.activeElement).not.toBe(document.body))
    expect(document.activeElement?.textContent).toBe(en['access.pending.title'])
  })
})

// The panel's own CSS, cascaded by jsdom from the app's real stylesheets (UX-3, UX-10).
describe('SCR-76 agent access — layout rules (iteration 2)', () => {
  const sheets = ['styles.css', 'components.css']
  const withStyles = () => {
    for (const f of sheets) {
      const el = document.createElement('style')
      el.dataset.test = 'sheet'
      el.textContent = readFileSync(path.join(process.cwd(), 'src/renderer/src', f), 'utf8')
      document.head.appendChild(el)
    }
  }
  afterEach(() => { for (const el of document.querySelectorAll('style[data-test="sheet"]')) el.remove() })
  const long = 'cloudflare:a.really.long.local.part.for.testing@subdomain.of.a.long.domain.example.com'

  it('UX-3: a long mailbox wraps inside the card on the Allow surface — the whole resource being granted can be read', async () => {
    withStyles()
    stub(overview({ pending: [pending({ ask: askLines({ capabilities: ['read_message'], resources: [long] }) })] }))
    const { container } = show()
    await screen.findByText(/a\.really\.long\.local\.part/)
    for (const el of [container.querySelector('.access-asks li'), container.querySelector('.access-card p')] as HTMLElement[])
      expect(getComputedStyle(el).overflowWrap, el.outerHTML.slice(0, 60)).toBe('anywhere')
  })

  it('UX-10: in a narrow window a product card\'s acts wrap rather than run out of the card', async () => {
    withStyles()
    stub(live(null))
    const { container } = show()
    await screen.findByRole('button', { name: en['access.products.reconnect'] })
    expect(getComputedStyle(container.querySelector('.access-acts .toolbar') as HTMLElement).flexWrap).toBe('wrap')
  })
})

 it('V2 UX-5: a thrown act keeps raw machine diagnostics outside the Russian sentence', async () => {
   stub(overview(), { connect: async () => { throw new Error('socket ECONNREFUSED') } })
   show('ru')
   fireEvent.click(await screen.findByRole('button', { name: ru['access.products.connect'] }))
   await waitFor(() => expect(screen.getByRole('alert').querySelector('.access-detail')?.textContent).toContain('ECONNREFUSED'))
   const alert = screen.getByRole('alert')
   expect(alert.querySelector('span > span')?.textContent).not.toContain('ECONNREFUSED')
 })


/** I3: reproduce the independent review's overlapping 4-second poll and Disconnect read. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

it('I3 independent: a delayed pre-disconnect poll cannot replace the post-disconnect reading', async () => {
  vi.useFakeTimers()
  const reads = [deferred<HubOverview>(), deferred<HubOverview>(), deferred<HubOverview>()]
  let i = 0
  stub(live(null), { overview: vi.fn(() => reads[i++].promise) })
  show()
  await reactAct(async () => reads[0].resolve(live(null)))
  await reactAct(async () => vi.advanceTimersByTime(4000))
  fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }))
  await reactAct(async () => {})
  await reactAct(async () => reads[2].resolve(overview()))
  expect(screen.getByRole('button', { name: 'Connect' })).toBeTruthy()
  await reactAct(async () => reads[1].resolve(live(null)))
  expect(screen.queryByRole('button', { name: 'Reconnect' })).toBeNull()
})


it('I3: an obsolete poll failure cannot hide the fresh post-disconnect read', async () => {
  vi.useFakeTimers()
  const oldPoll = deferred<HubOverview>()
  const h = stub(live(null))
  h.overview.mockResolvedValueOnce(live(null)).mockImplementationOnce(() => oldPoll.promise).mockResolvedValue(overview())
  show()
  await reactAct(async () => {})
  await reactAct(async () => vi.advanceTimersByTime(4000))
  fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }))
  await reactAct(async () => {})
  await reactAct(async () => oldPoll.reject(new Error('old poll failed')))
  expect(screen.getByRole('button', { name: 'Connect' })).toBeTruthy()
  expect(screen.queryByText(en['access.unreadable'])).toBeNull()
})

it.each(['success', 'failure'] as const)('I3: invalidates the old poll before the %s completion during mutation', async completion => {
  vi.useFakeTimers()
  const oldPoll = deferred<HubOverview>()
  const disconnect = deferred<{ ok: true }>()
  const h = stub(live(null), { disconnect: vi.fn(() => disconnect.promise) })
  h.overview.mockResolvedValueOnce(live(null)).mockImplementationOnce(() => oldPoll.promise).mockResolvedValue(overview())
  show()
  await reactAct(async () => {})
  await reactAct(async () => vi.advanceTimersByTime(4000))
  fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }))
  await reactAct(async () => completion === 'success' ? oldPoll.resolve(overview()) : oldPoll.reject(new Error('old poll failed')))
  expect(screen.getByRole('button', { name: 'Reconnect' }).getAttribute('aria-disabled')).toBe('true')
  expect(screen.queryByText(en['access.unreadable'])).toBeNull()
  await reactAct(async () => vi.advanceTimersByTime(4000))
  expect(h.overview).toHaveBeenCalledTimes(2)
  await reactAct(async () => disconnect.resolve({ ok: true }))
  expect(screen.getByRole('button', { name: 'Connect' })).toBeTruthy()
  expect(h.overview).toHaveBeenCalledTimes(3)
})

it('I3: a failed latest read stays unreadable when an older successful empty list arrives, and Retry recovers', async () => {
  vi.useFakeTimers()
  const older = deferred<HubOverview>()
  const latest = deferred<HubOverview>()
  const h = stub(live(null))
  h.overview.mockResolvedValueOnce(live(null)).mockImplementationOnce(() => older.promise).mockImplementationOnce(() => latest.promise).mockResolvedValue(live(null))
  show()
  await reactAct(async () => {})
  await reactAct(async () => vi.advanceTimersByTime(4000))
  await reactAct(async () => vi.advanceTimersByTime(4000))
  await reactAct(async () => latest.reject(new Error('current read failed')))
  expect(screen.getByText(en['access.unreadable'])).toBeTruthy()
  await reactAct(async () => older.resolve(overview()))
  expect(screen.getByText(en['access.unreadable'])).toBeTruthy()
  expect(screen.queryByText(en['access.agents.none'])).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await reactAct(async () => {})
  expect(screen.getByRole('button', { name: 'Reconnect' })).toBeTruthy()
})

it('I3: effect cleanup cancels the first StrictMode read even when setup starts again', async () => {
  const cancelled = deferred<HubOverview>()
  const h = stub(overview())
  h.overview.mockImplementationOnce(() => cancelled.promise).mockResolvedValue(live(null))
  render(<StrictMode><I18nProvider locale="en"><AgentAccessPanel onClose={() => {}} /></I18nProvider></StrictMode>)
  await screen.findByRole('button', { name: 'Reconnect' })
  await reactAct(async () => cancelled.resolve(overview()))
  expect(screen.getByRole('button', { name: 'Reconnect' })).toBeTruthy()
})

it('I3: a late failed act after unmount does not start a follow-up read', async () => {
  const disconnect = deferred<{ ok: true }>()
  const h = stub(live(null), { disconnect: vi.fn(() => disconnect.promise) })
  const panel = show()
  fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }))
  panel.unmount()
  await reactAct(async () => disconnect.reject(new Error('late disconnect failure')))
  expect(h.overview).toHaveBeenCalledTimes(1)
})

// SCN-132 in the attention queue (security review of PR #7; verification iteration 1 for 0.3.1). Allow in
// the queue is the same decision as Allow in the native prompt, so the row says what the prompt says
// before either button — who the registry says is asking, what it asks, the agent's reason as its own
// one-line claim, the same-user floor, whether this adds to access it holds, how long access lasts and
// whether Allow also connects the product — in the operator's language, as a block above the buttons.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ObligationActs, useProposalDecisions, type ObligationLike } from './ObligationActs'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { ru } from '../i18n/ru'
import { pendingFacts } from '../../../shared/access'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const facts = (connected: boolean) => pendingFacts({
  id: 'r1', agent_id: 'example-agent.default', callee: 'fabric-inbox', capabilities: ['read_message', 'send_email'], resources: ['cloudflare:news@example.com'],
  reason: 'summarise the newsletter', asked_by_binding: 'b1', requested_at: '2026-10-03T10:00:00Z', expires_at: '2026-10-03T10:10:00Z',
  registry: { name: 'Example agent', installed_by: 'example-installer', repository: 'https://github.com/example/example-agent' }
}, connected)
const itemOf = (connected: boolean): ObligationLike => ({ subject: { kind: 'access-request', id: 'r1' }, projectId: null, access: facts(connected) })

function Harness({ item, onError = () => {} }: { item: ObligationLike; onError?: (m: string) => void }): React.JSX.Element {
  const decisions = useProposalDecisions(async () => {}, () => {})
  return <ObligationActs item={item} decisions={decisions} onOpen={() => {}} onError={onError} />
}

describe('an access request in the queue', () => {
  it('states the prompt\'s facts before Allow, and Allow decides that request', async () => {
    const decide = vi.fn(async () => ({ ok: true }))
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { hub: { decide } } }))
    render(<I18nProvider locale="en"><Harness item={itemOf(true)} /></I18nProvider>)
    expect(screen.getByText('An agent registered as example-agent.default (installed by example-installer; source https://github.com/example/example-agent)')).toBeTruthy()
    expect(screen.getByText('read mail and send mail in news@example.com')).toBeTruthy()
    expect(screen.getByText(en['access.pending.reason'].replace('{reason}', 'summarise the newsletter'))).toBeTruthy()
    expect(screen.getByText(en['access.floor'])).toBeTruthy()
    expect(screen.getByText(en['access.incremental'])).toBeTruthy()
    expect(screen.getByText(en['access.lasts'])).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Allow Example agent' }))
    await waitFor(() => expect(decide).toHaveBeenCalledWith('r1', 'allowed'))
  })

  it('UX-8: the facts are a block of their own; the two buttons sit together in their own actions row', () => {
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { hub: { decide: vi.fn() } } }))
    const { container } = render(<I18nProvider locale="en"><Harness item={itemOf(true)} /></I18nProvider>)
    // Its own class (iteration 2, UX-4): the board's and releases' `dl.lp-facts` grids are the prototype's.
    const facts = container.querySelector('.lp-access-facts')
    expect(facts).toBeTruthy()
    expect(facts!.querySelector('button')).toBeNull()
    const buttons = [...container.querySelectorAll('.lp-actions button')].map((b) => b.textContent)
    expect(buttons).toEqual([en['access.deny'], en['access.allow']])
  })

  it('UX-4: when the product is not connected, Allow says it also connects it', () => {
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { hub: { decide: vi.fn() } } }))
    render(<I18nProvider locale="en"><Harness item={itemOf(false)} /></I18nProvider>)
    // Iteration 2, UX-8: the accessible name keeps the visible words ("label in name") and adds whose.
    expect(screen.getByRole('button', { name: 'Allow and connect Fabric Inbox for Example agent' }).textContent).toBe('Allow and connect Fabric Inbox')
  })

  it('UX-5: an Allow whose product could not be opened settles as allowed and says so beside it — no second Allow', async () => {
    const decide = vi.fn(async () => ({ ok: true, connect: { problem: { code: 'not-installed', detail: 'no handler' } } }))
    const onError = vi.fn()
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { hub: { decide } } }))
    render(<I18nProvider locale="en"><Harness item={itemOf(false)} onError={onError} /></I18nProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Allow and connect Fabric Inbox for Example agent' }))
    await waitFor(() => expect(screen.getByText(/^Allowed\. To connect it, open Agent access in settings\. It did not connect: Fabric Inbox could not be opened/)).toBeTruthy())
    expect(screen.queryByRole('button', { name: /^Allow/ })).toBeNull()
    expect(onError).not.toHaveBeenCalled()
  })

  it('a refusal is said from its code, in the operator\'s language', async () => {
    const decide = vi.fn(async () => ({ ok: false, code: 'expired', reason: 'that request expired before it was answered' }))
    const onError = vi.fn()
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { hub: { decide } } }))
    render(<I18nProvider locale="ru"><Harness item={itemOf(true)} onError={onError} /></I18nProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Разрешить: Example agent' }))
    await waitFor(() => expect(onError).toHaveBeenCalledWith(ru['access.refused.expired']))
  })

  it('UX-2: in ru every fact is Russian', () => {
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { hub: { decide: vi.fn() } } }))
    const { container } = render(<I18nProvider locale="ru"><Harness item={itemOf(false)} /></I18nProvider>)
    let text = container.textContent ?? ''
    for (const v of ['example-agent.default', 'Example agent', 'example-installer', 'https://github.com/example/example-agent', 'news@example.com', 'summarise the newsletter', 'Fabric Inbox', 'Fabric', 'Mac', 'Project', 'Observatory'])
      text = text.split(v).join(' ')
    expect(text.match(/[A-Za-z]{3,}/g) ?? []).toEqual([])
  })

  it('UX-3 (iteration 2): a long mailbox wraps inside the queue\'s detail, so the whole resource can be read before Allow', () => {
    const el = document.createElement('style')
    el.textContent = readFileSync(path.join(process.cwd(), 'src/renderer/src/launch/launch.css'), 'utf8')
    document.head.appendChild(el)
    try {
      vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { hub: { decide: vi.fn() } } }))
      const long = pendingFacts({ id: 'r1', agent_id: 'example-agent.default', callee: 'fabric-inbox', capabilities: ['read_message'],
        resources: ['cloudflare:a.really.long.local.part.for.testing@subdomain.of.a.long.domain.example.com'], reason: 'x', asked_by_binding: null,
        requested_at: '2026-10-03T10:00:00Z', expires_at: '2026-10-03T10:10:00Z', registry: null }, true)
      const { container } = render(<I18nProvider locale="en"><div className="lp"><Harness item={{ subject: { kind: 'access-request', id: 'r1' }, projectId: null, access: long }} /></div></I18nProvider>)
      expect(getComputedStyle(container.querySelector('.lp-facts-asks li') as HTMLElement).overflowWrap).toBe('anywhere')
      expect(getComputedStyle(container.querySelector('.lp-access-facts p') as HTMLElement).overflowWrap).toBe('anywhere')
    } finally { el.remove() }
  })
})

 it('V2 UX-7: deciding keeps the queue button focusable and blocks duplicate submissions', async () => {
   let finish!: (r: { ok: false; code: 'expired' }) => void
   const decide = vi.fn(() => new Promise<{ ok: false; code: 'expired' }>(resolve => { finish = resolve }))
   vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { hub: { decide } } }))
   render(<I18nProvider locale="en"><Harness item={itemOf(true)} /></I18nProvider>)
   const allow = screen.getByRole('button', { name: 'Allow Example agent' }) as HTMLButtonElement
   allow.focus()
   fireEvent.click(allow)
   expect(allow.disabled).toBe(false)
   expect(allow.getAttribute('aria-disabled')).toBe('true')
   expect(document.activeElement).toBe(allow)
   fireEvent.click(allow)
   expect(decide).toHaveBeenCalledTimes(1)
   finish({ ok: false, code: 'expired' })
   await waitFor(() => expect(allow.hasAttribute('aria-disabled')).toBe(false))
 })

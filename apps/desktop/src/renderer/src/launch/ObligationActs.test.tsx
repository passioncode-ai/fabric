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

function Harness({ item, onError = () => {}, onAccessDecided }: { item: ObligationLike; onError?: (m: string) => void; onAccessDecided?: (said: string, detail: string | null) => void }): React.JSX.Element {
  const decisions = useProposalDecisions(async () => {}, () => {})
  return <ObligationActs item={item} decisions={decisions} onOpen={() => {}} onError={onError} onAccessDecided={onAccessDecided} />
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

  it('I3 U-1/U-9: the queue row says Deny stands until the denial is cleared, naming the real buttons in ru', () => {
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { hub: { decide: vi.fn() } } }))
    render(<I18nProvider locale="en"><Harness item={itemOf(true)} /></I18nProvider>)
    expect(screen.getByText(en['access.denyStands'])).toBeTruthy()
    cleanup()
    render(<I18nProvider locale="ru"><Harness item={itemOf(true)} /></I18nProvider>)
    expect(screen.getByText(ru['access.denyStands'] ?? '')).toBeTruthy()
    expect(ru['access.denyStands'] ?? '').toContain(`«${ru['access.deny']}»`)
    expect(ru['access.denials.note'] ?? '').toContain(`«${ru['access.denials.clear']}»`)
  })

  it('I3 U-2: an Allow whose product did not open reports one sentence to the board, saying allowed once', async () => {
    const decide = vi.fn(async () => ({ ok: true, connect: { problem: { code: 'not-installed', detail: 'no handler' } } }))
    const said = vi.fn()
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { hub: { decide } } }))
    render(<I18nProvider locale="en"><Harness item={itemOf(false)} onAccessDecided={said} /></I18nProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Allow and connect Fabric Inbox for Example agent' }))
    await waitFor(() => expect(said).toHaveBeenCalled())
    const sentence = said.mock.calls[0][0] as string
    expect(sentence.startsWith('You allowed Example agent to use Fabric Inbox. To connect it, open Agent access in settings. It did not connect:')).toBe(true)
    expect(sentence.match(/allowed/gi)?.length).toBe(1)
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

// ADR-0134: a coding agent's enrollment in the queue says what the native prompt says, in words — built THROUGH
// pendingFacts(row, false), exactly as main builds the queue's facts (the hub has no connection for 'fabric').
describe('an enrollment in the queue', () => {
  const PROJECT = '6f1c2a3e-5d6f-4a1b-9c7d-2e3f4a5b6c7d'
  const enrollItem = (project: Record<string, unknown> | null = { id: PROJECT, name: 'Atlas', root: '/Users/someone/code/atlas', how: 'exact' }): ObligationLike => ({
    subject: { kind: 'access-request', id: 'r-enroll' }, projectId: null,
    access: pendingFacts({
      id: 'r-enroll', agent_id: 'claude-code', callee: 'fabric', capabilities: ['session.enroll'], resources: [`project:${PROJECT}`],
      reason: 'This coding agent, opened in the folder atlas, asks to work in the project Atlas through Fabric.', asked_by_binding: null,
      requested_at: '2026-10-11T10:00:00Z', expires_at: '2026-10-11T10:10:00Z',
      registry: { key: 'claude-code', kind: 'runner', name: 'Claude Code', installed_by: 'a coding agent on this Mac', repository: null, summary: null, ...(project ? { project } : {}) }
    } as Parameters<typeof pendingFacts>[0], false)
  })
  const MACHINE_WORDS = /session\.enroll|project:|registered as|зарегистрирован|connect|подключ|installed by|установил|[0-9a-f]{8}-[0-9a-f]{4}/i
  const said = (container: HTMLElement): string[] => [
    container.textContent ?? '',
    ...[...container.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label') ?? '')
  ]

  it('says who, where, what, the floor and how long — and Allow is Allow', async () => {
    const decide = vi.fn(async () => ({ ok: true }))
    const onAccessDecided = vi.fn()
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { hub: { decide } } }))
    render(<I18nProvider locale="en"><Harness item={enrollItem()} onAccessDecided={onAccessDecided} /></I18nProvider>)
    expect(screen.getByText('A coding agent: Claude Code')).toBeTruthy()
    expect(screen.getByText('In the folder ~/code/atlas')).toBeTruthy()
    expect(screen.getByText('work in Atlas')).toBeTruthy()
    expect(screen.getByText('Fabric cannot prove this is Claude Code: any program running as you can ask under that name.')).toBeTruthy()
    expect(screen.queryByText(en['access.floor'])).toBeNull()
    expect(screen.getByText(/for a year, unless you revoke it/)).toBeTruthy()
    const allow = screen.getByRole('button', { name: 'Allow Claude Code' })
    expect(allow.textContent).toBe('Allow')
    fireEvent.click(allow)
    await waitFor(() => expect(decide).toHaveBeenCalledWith('r-enroll', 'allowed'))
    await waitFor(() => expect(onAccessDecided).toHaveBeenCalledWith('You let Claude Code work in Atlas.', null))
  })

  it('no machine id, no "registered as", no "connect" in its text or its accessible names, en and ru', () => {
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { hub: { decide: vi.fn() } } }))
    for (const locale of ['en', 'ru'] as const) for (const item of [enrollItem(), enrollItem(null)]) {
      const { container, unmount } = render(<I18nProvider locale={locale}><Harness item={item} /></I18nProvider>)
      expect(said(container).filter((w) => MACHINE_WORDS.test(w))).toEqual([])
      unmount()
    }
  })

  it('without the folder it degrades to no folder line; in ru every fact is Russian', () => {
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { hub: { decide: vi.fn() } } }))
    const bare = render(<I18nProvider locale="en"><Harness item={enrollItem({ id: PROJECT, name: 'Atlas' })} /></I18nProvider>)
    expect(bare.container.textContent).not.toContain('In the folder')
    bare.unmount()
    const { container } = render(<I18nProvider locale="ru"><Harness item={enrollItem()} /></I18nProvider>)
    let text = container.textContent ?? ''
    for (const v of ['This coding agent, opened in the folder atlas, asks to work in the project Atlas through Fabric.', '~/code/atlas', 'Claude Code', 'Atlas', 'Fabric'])
      text = text.split(v).join(' ')
    expect(text.match(/[A-Za-z]{3,}/g) ?? []).toEqual([])
    expect(screen.getByText('В папке ~/code/atlas')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Разрешить: Claude Code' }).textContent).toBe('Разрешить')
  })
})

// Audit 2026-10-05 A1-001: "Allow once" grants once, says until when, and offers nothing more.
describe('allowing a refused act', () => {
  const refused: ObligationLike = { subject: { kind: 'refusal', id: '7' }, projectId: 'p', grantable: { floorClass: 'deletion', target: '/repo/a.md' } }
  it('is busy while the grant is issued, then says until when and cannot be pressed again', async () => {
    let land: (g: { grantId: string; expiresAt: string }) => void = () => {}
    const grant = vi.fn(() => new Promise<{ grantId: string; expiresAt: string }>((r) => { land = r }))
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { attention: { grant } } }))
    render(<I18nProvider locale="en"><Harness item={refused} /></I18nProvider>)
    const button = screen.getByRole('button', { name: 'Allow once' }) as HTMLButtonElement
    fireEvent.click(button)
    fireEvent.click(button)
    expect(button.disabled).toBe(true)
    expect(grant).toHaveBeenCalledTimes(1)
    expect(grant).toHaveBeenCalledWith({ projectId: 'p', floorClass: 'deletion', target: '/repo/a.md' })
    land({ grantId: 'g1', expiresAt: '2026-10-06T15:30:00Z' })
    expect(await screen.findByRole('status')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toMatch(/^Allowed once, until /)
    expect(screen.queryByRole('button', { name: 'Allow once' })).toBeNull()
  })

  it('a failed grant is said, and the act is offered again', async () => {
    const onError = vi.fn()
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { attention: { grant: vi.fn(async () => { throw new Error('database unavailable') }) } } }))
    render(<I18nProvider locale="en"><Harness item={refused} onError={onError} /></I18nProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Allow once' }))
    await waitFor(() => expect(onError).toHaveBeenCalledWith('Error: database unavailable'))
    expect((screen.getByRole('button', { name: 'Allow once' }) as HTMLButtonElement).disabled).toBe(false)
  })
})

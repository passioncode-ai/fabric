// SCR-64 · SCN-042 in the app (first-slice plan C4): every state the screen table names is its
// own view, and the keyboard keeps the draft. The API is a fake of `window.fabric.ceo`; the
// binding behind it is tested in main (ceo-chat-binding.test.mjs).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CeoChat } from './CeoChat'
import { I18nProvider } from './i18n'
import { en } from './i18n/en'
import type { ProjectRow } from '../../shared/types'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const C = '00000000-0000-4000-8000-000000000003'
const ok = (value: unknown, state = 'ready') => ({ ok: true, state, value, conversation_id: C })
const no = (reason_code: string, state = 'refused') => ({ ok: false, state, reason_code, conversation_id: C })
const inventory = (over: Record<string, unknown> = {}) => ok({ revision: 'r1', drafts: [], sends: [],
  capacity: { drafts: 0, draftLimit: 32, unresolved: 0, unresolvedLimit: 8, full: false }, ...over })
const draft = (text = '', local_status = 'ready', intents: unknown[] = []) => ok({ revision: 'r1', local_status, draft: text ? { text } : null, intents })
const project: ProjectRow = { id: '00000000-0000-4000-8000-000000000040', estate_id: 'e', name: 'Atlas', purpose: null, repo_path: null,
  status: 'active', config_revision: 2, created_at: '', memory_backend: 'local', default_agent: 'claude-code', mcp_servers: [] } as ProjectRow

function stub(handlers: Record<string, (args: Record<string, unknown>) => unknown>, status: unknown = { active: false, reason: 'private_recovery_unavailable' }) {
  const calls: { method: string; args: Record<string, unknown> }[] = []
  const api = { ceo: {
    status: vi.fn(async () => { if (status instanceof Error) throw status; return status }),
    select: vi.fn(async () => ({ ok: true })),
    call: vi.fn(async (method: string, args: Record<string, unknown>) => {
      calls.push({ method, args })
      const h = handlers[method]; return h ? h(args) : ok(null)
    }) } }
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: api }))
  return { api, calls }
}
const base = (over: Record<string, (a: Record<string, unknown>) => unknown> = {}) => ({
  inventory: () => inventory(), readDraft: () => draft(), saveDraft: () => ok({ revision: 'r2', local_status: 'ready' }, 'saved_locally'),
  read: () => ok({ messages: [] }), ...over })
const show = (onClose = () => {}) => render(<I18nProvider locale="en"><CeoChat onClose={onClose} projects={[project]} /></I18nProvider>)
const input = () => screen.getByLabelText(en['chat.input.label']) as HTMLTextAreaElement

describe('the conversation with Fabric, every SCN-042 state', () => {
  it('loading: the conversation is being read, nothing is shown as sent', async () => {
    const api = { ceo: { status: vi.fn(() => new Promise(() => {})), call: vi.fn(), select: vi.fn() } }
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: api }))
    show()
    expect(screen.getByText(en['chat.loading'])).toBeTruthy()
    expect(screen.queryByText(en['chat.pending'])).toBeNull()
  })

  it('not activated: Send is off and says why, and the draft still saves', async () => {
    const { calls } = stub(base())
    show()
    await screen.findByText(en['chat.notActivated.title'])
    expect(screen.getByText(en['chat.notActivated.note'])).toBeTruthy()
    fireEvent.change(input(), { target: { value: 'Что изменилось в Atlas?' } })
    await screen.findByText(en['chat.saved'], {}, { timeout: 2000 })
    expect((screen.getByRole('button', { name: en['chat.send'] }) as HTMLButtonElement).disabled).toBe(true)
    const save = calls.find(c => c.method === 'saveDraft')!
    expect(save.args.conversationId).toBeTruthy()
    for (const c of calls) expect(JSON.stringify(c.args)).not.toMatch(/personId|estateId|p_|serviceKey|url/)
    expect(calls.some(c => ['send', 'freezeSend', 'read', 'open'].includes(c.method))).toBe(false)
  })

  it('recovered: a draft restored after restart says so', async () => {
    stub(base({ readDraft: () => draft('текст до перезапуска', 'recovered') }))
    show()
    await screen.findByText(en['chat.recovered'])
    expect(input().value).toBe('текст до перезапуска')
  })

  it('an example from Help fills an empty composer, sends nothing, and never replaces a kept draft (SCR-44)', async () => {
    const { calls } = stub(base({ readDraft: () => draft('') }))
    render(<I18nProvider locale="en"><CeoChat onClose={() => {}} projects={[project]} suggestion="What on the board needs my decision?" /></I18nProvider>)
    await waitFor(() => expect(input().value).toBe('What on the board needs my decision?'))
    expect(calls.some(c => ['send', 'freezeSend'].includes(c.method)), 'an example was sent').toBe(false)
    cleanup()
    stub(base({ readDraft: () => draft('my own words') }))
    render(<I18nProvider locale="en"><CeoChat onClose={() => {}} projects={[project]} suggestion="What on the board needs my decision?" /></I18nProvider>)
    await waitFor(() => expect(input().value, 'the example overwrote a kept draft').toBe('my own words'))
  })

  it('draft conflict: the newer text is kept and shown; mine can be copied', async () => {
    let reads = 0
    stub(base({ readDraft: () => (reads++ === 0 ? draft('старый') : draft('новый из другого окна')), saveDraft: () => no('draft_conflict') }))
    show()
    await screen.findByText(en['chat.notActivated.title'])
    fireEvent.change(input(), { target: { value: 'мой вариант' } })
    await screen.findByText(en['chat.conflict'], {}, { timeout: 2000 })
    expect(input().value).toBe('новый из другого окна')
    expect(screen.getByRole('button', { name: en['chat.conflict.copy'] })).toBeTruthy()
  })

  it('capacity full: kept drafts and sends are listed; an unknown send cannot be discarded', async () => {
    stub(base({ inventory: () => inventory({ capacity: { drafts: 32, draftLimit: 32, unresolved: 1, unresolvedLimit: 8, full: true },
      drafts: [{ conversation_id: C, preview: 'заблокированный', blockedBy: 'unresolved_send', actions: [] },
        { conversation_id: '00000000-0000-4000-8000-000000000004', preview: 'свободный', blockedBy: null, actions: ['discard'] }],
      sends: [{ conversation_id: C, operation_id: '00000000-0000-4000-8000-000000000005', status: 'commit_unknown', actions: ['reconcile'] }] }) }))
    show()
    await screen.findByText(en['chat.capacity.title'])
    expect(screen.getAllByRole('button', { name: en['chat.discard'] })).toHaveLength(1)
    expect(screen.getByText(en['chat.unknownNotDiscardable'])).toBeTruthy()
    expect(screen.getByRole('button', { name: en['chat.checkAgain'] })).toBeTruthy()
  })

  it('local recovery required: an unreadable history is not an empty conversation', async () => {
    stub(base({ inventory: () => no('local_recovery_required') }))
    show()
    await screen.findByText(en['chat.recovery.title'])
    expect(screen.queryByText(en['chat.empty.title'])).toBeNull()
    expect(input().disabled).toBe(true)
  })

  it('unsupported context: "All projects" is refused visibly and not applied', async () => {
    stub(base())
    show()
    await screen.findByText(en['chat.notActivated.title'])
    fireEvent.click(screen.getByRole('button', { name: en['chat.scope.all'] }))
    expect(screen.getByRole('alert').textContent).toBe(en['chat.unsupported'])
    expect(screen.getByRole('button', { name: en['chat.scope.all'] }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('button', { name: en['chat.scope.none'] }).getAttribute('aria-pressed')).toBe('true')
  })

  it('denied: unavailable, and no draft or message is shown', async () => {
    stub(base({ inventory: () => no('unavailable') }))
    show()
    await screen.findByText(new RegExp(en['chat.denied.title']))
    expect(screen.queryByLabelText(en['chat.input.label'])).toBeNull()
  })

  it('error: an unexpected failure keeps the draft and says so', async () => {
    stub(base(), new Error('ipc down'))
    show()
    await screen.findByText(en['chat.error.title'])
    expect(screen.getByRole('button', { name: en['chat.retryLoad'] })).toBeTruthy()
  })
})

describe('with the gate open (C5): the send states', () => {
  const open = { active: true, reason: null }
  it('empty: one sentence on what Fabric does now, and the composer', async () => {
    stub(base(), open)
    show()
    await screen.findByText(en['chat.empty.title'])
    expect(input()).toBeTruthy()
  })

  it('accepted pending: saved, no reply yet — never a reply claimed', async () => {
    let sent = false
    stub(base({ readDraft: () => draft(sent ? '' : 'Вопрос'), freezeSend: () => ok({ revision: 'r3' }, 'saved_locally'),
      send: () => { sent = true; return ok({}, 'accepted_pending') },
      read: () => ok({ messages: sent ? [{ message_id: 'm', content_state: 'available', envelope: { text: 'Вопрос' } }] : [] }) }), open)
    show()
    await screen.findByText(en['chat.empty.title'])
    fireEvent.click(screen.getByRole('button', { name: en['chat.send'] }))
    await screen.findByText('Вопрос')
    expect(screen.getByText(en['chat.pending'])).toBeTruthy()
  })

  it('a new conversation is opened on the server before its first send, as its own global subject', async () => {
    const { calls } = stub(base({ readDraft: () => draft('Вопрос'), freezeSend: () => ok({ revision: 'r3' }, 'saved_locally'), send: () => ok({}, 'accepted_pending') }), open)
    show()
    await screen.findByText(en['chat.empty.title'])
    fireEvent.click(screen.getByRole('button', { name: en['chat.send'] }))
    await waitFor(() => expect(calls.some(c => c.method === 'send')).toBe(true))
    const order = calls.map(c => c.method), openCall = calls.find(c => c.method === 'open')!, frozen = calls.find(c => c.method === 'freezeSend')!
    expect(order.indexOf('open')).toBeLessThan(order.indexOf('freezeSend'))
    expect([openCall.args.subjectKind, openCall.args.subjectId]).toEqual(['global', frozen.args.conversationId])
    expect(openCall.args.conversationId).toBe(frozen.args.conversationId)
  })

  it('active with a conversation nobody opened yet: nothing is read and the screen is ready, not "no access"', async () => {
    const { calls } = stub(base({ read: () => no('unavailable') }), open)
    show()
    await screen.findByText(en['chat.empty.title'])
    expect(calls.some(c => c.method === 'read')).toBe(false)
    expect(screen.queryByText(en['chat.denied.title'], { exact: false })).toBeNull()
  })

  it('a refused open says so and sends nothing', async () => {
    const { calls } = stub(base({ readDraft: () => draft('Вопрос'), open: () => no('unavailable') }), open)
    show()
    await screen.findByText(en['chat.empty.title'])
    fireEvent.click(screen.getByRole('button', { name: en['chat.send'] }))
    await waitFor(() => expect(calls.some(c => c.method === 'open')).toBe(true))
    expect(calls.some(c => c.method === 'freezeSend' || c.method === 'send')).toBe(false)
  })

  it('after a restart, a conversation holding an accepted send is read back', async () => {
    const { calls } = stub(base({ inventory: () => inventory({ sends: [{ conversation_id: C, operation_id: 'op', status: 'accepted_pending', actions: [] }] }),
      read: () => ok({ messages: [{ message_id: 'm', content_state: 'available', envelope: { text: 'Раньше' } }] }) }), open)
    show()
    await screen.findByText('Раньше')
    expect(calls.find(c => c.method === 'read')!.args.conversationId).toBe(C)
  })

  it('commit unknown: Check again asks about the same operation, it never sends again', async () => {
    const { calls } = stub(base({ readDraft: () => draft('Вопрос'), freezeSend: () => ok({ revision: 'r3' }, 'saved_locally'),
      send: () => no('rpc_unavailable', 'commit_unknown'), reconcile: () => no('rpc_unavailable', 'commit_unknown') }), open)
    show()
    await screen.findByText(en['chat.empty.title'])
    fireEvent.click(screen.getByRole('button', { name: en['chat.send'] }))
    await screen.findByText(en['chat.unknown'])
    fireEvent.click(screen.getByRole('button', { name: en['chat.checkAgain'] }))
    await waitFor(() => expect(calls.some(c => c.method === 'reconcile')).toBe(true))
    const op = calls.find(c => c.method === 'send')!.args.operationId
    expect(calls.find(c => c.method === 'reconcile')!.args.operationId).toBe(op)
    expect(calls.filter(c => c.method === 'send')).toHaveLength(1)
  })

  it('refused: the named reason, and the draft kept', async () => {
    stub(base({ readDraft: () => draft('Вопрос'), freezeSend: () => ok({ revision: 'r3' }, 'saved_locally'), send: () => no('offline') }), open)
    show()
    await screen.findByText(en['chat.empty.title'])
    fireEvent.click(screen.getByRole('button', { name: en['chat.send'] }))
    await screen.findByText(en['chat.refused'].replace('{reason}', en['chat.reason.offline']))
    expect(input().value).toBe('Вопрос')
  })
})

describe('the keyboard keeps the draft', () => {
  const open = { active: true, reason: null }
  it('Enter sends; Shift+Enter and an IME composition do not', async () => {
    const { calls } = stub(base({ readDraft: () => draft('Вопрос'), freezeSend: () => ok({ revision: 'r3' }, 'saved_locally'), send: () => no('offline') }), open)
    show()
    await screen.findByText(en['chat.empty.title'])
    fireEvent.keyDown(input(), { key: 'Enter', shiftKey: true })
    fireEvent.keyDown(input(), { key: 'Enter', isComposing: true })
    await new Promise(r => setTimeout(r, 50))
    expect(calls.some(c => c.method === 'freezeSend')).toBe(false)
    fireEvent.keyDown(input(), { key: 'Enter' })
    await waitFor(() => expect(calls.some(c => c.method === 'freezeSend')).toBe(true))
  })

  it('Escape minimises and saves what was typed first', async () => {
    const onClose = vi.fn()
    const { calls } = stub(base())
    show(onClose)
    await screen.findByText(en['chat.notActivated.title'])
    fireEvent.change(input(), { target: { value: 'не потерять' } })
    fireEvent.keyDown(input(), { key: 'Escape' })
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(calls.find(c => c.method === 'saveDraft')?.args.draft).toMatchObject({ text: 'не потерять' })
  })
})

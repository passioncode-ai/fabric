// First-slice plan C2: the renderer's CEO chat contract and the main-side binding agree, and
// with the gate closed nothing that would reach the database runs.
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { CEO_CHAT_METHOD_NAMES, IPC } from './types'
import { CEO_CHAT_METHODS, createCeoChatBinding } from '../main/ceoChatBinding'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const C = id(3), OP = id(4)
const argsFor: Record<string, Record<string, unknown>> = {
  readDraft: { conversationId: C }, inventory: {}, saveDraft: { conversationId: C, expectedRevision: null, draft: {} },
  discardDraft: { conversationId: C, expectedRevision: 'a'.repeat(16) }, forgetSettled: { conversationId: C, operationId: OP, expectedRevision: 'a'.repeat(16) },
  freezeSend: { conversationId: C, expectedRevision: 'a'.repeat(16), operationId: OP, messageId: id(5) },
  send: { conversationId: C, operationId: OP }, reconcile: { conversationId: C, operationId: OP }, retry: { conversationId: C, operationId: OP },
  open: { operationId: OP, conversationId: C, subjectKind: 'global', subjectId: C }, read: { conversationId: C, afterOrdinal: 0, limit: 50 },
}

describe('CEO chat IPC contract', () => {
  it('the binding accepts exactly the methods the renderer contract names', () => {
    expect(Object.keys(CEO_CHAT_METHODS).sort()).toEqual([...CEO_CHAT_METHOD_NAMES].sort())
    expect([IPC.ceoStatus, IPC.ceoCall, IPC.ceoSelect]).toEqual(['ceo:status', 'ceo:call', 'ceo:select'])
  })

  it('with the gate closed every database-bound call refuses and the service is never asked', async () => {
    const touched = vi.fn(async () => ({ ok: true, state: 'ready', value: null, conversation_id: C }))
    const service = new Proxy({}, { get: () => touched }) as never
    const binding = createCeoChatBinding({ service, activation: () => ({ active: false, reason: 'private_recovery_unavailable' }) })
    expect(binding.status()).toEqual({ active: false, reason: 'private_recovery_unavailable' })
    for (const method of CEO_CHAT_METHOD_NAMES.filter(m => CEO_CHAT_METHODS[m].gated))
      expect(await binding.call(method, argsFor[method])).toEqual({ ok: false, state: 'refused', reason_code: 'private_recovery_unavailable', conversation_id: C })
    expect(touched).not.toHaveBeenCalled()
    // Local drafts are not database-bound: the not-activated screen still saves them.
    await binding.call('readDraft', argsFor.readDraft)
    expect(touched).toHaveBeenCalledTimes(1)
  })

  it('main opens the gate only while private recovery exists (C5), and closes it otherwise', () => {
    // The wiring in main/index.ts cannot run here (it needs Electron and the database), so its
    // load-bearing lines are read instead; the real app run is chat-activation-native.test.mjs.
    const main = readFileSync(path.join(__dirname, '..', 'main', 'index.ts'), 'utf8')
    expect(main).toMatch(/const CEO_CHAT_CLOSED: CeoChatStatus = \{ active: false, reason: 'private_recovery_unavailable' \}/)
    expect(main).toMatch(/const ceoChatActivation = \(\): CeoChatStatus => privateHistory \? \{ active: true, reason: null \} : CEO_CHAT_CLOSED/)
    expect(main.match(/activation: ([A-Za-z_]+)/)?.[1]).toBe('ceoChatActivation')
    expect(main.match(/createCeoChatBinding\(/g)?.length).toBe(1)
  })

  it('an activation that throws is a closed gate, not an open one', () => {
    const binding = createCeoChatBinding({ service: {} as never, activation: () => { throw new Error('unreadable') } })
    expect(binding.status()).toEqual({ active: false, reason: 'private_recovery_unavailable' })
  })
})

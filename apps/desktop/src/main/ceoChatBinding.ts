/**
 * The renderer-facing edge of the CEO conversation in trusted main (first-slice plan C1).
 * No Electron import: C2 registers `call` behind typed IPC; this module decides what may pass.
 *
 * - FIXED METHODS AND KEYS. Each method has one list of argument keys; an unknown method, a
 *   missing or extra key, an accessor, or a non-plain object refuses before anything runs.
 *   Identity, RPC and credential fields (`estateId`, `personId`, `p_*`, `url`, `serviceKey`)
 *   refuse wherever they appear: trusted main derives identity, the renderer never supplies it.
 * - ONE GATE. Until private recovery is available (C5) every call that would reach the database
 *   refuses with `private_recovery_unavailable` and makes zero RPC calls; drafts stay local and
 *   keep working, which is what SCR-64 "not activated" promises.
 * - ONE QUEUE PER OWNER. The host allows one identity check at a time and answers a concurrent
 *   one with null, which the service reports as `authority_changed`: a draft autosave during a
 *   send would fail with a false refusal. Calls therefore run one after another, bounded; past
 *   the bound a call is refused `busy`, never dropped silently.
 * - UNIFORM DENIAL. A missing, revoked or moved authority is `unavailable`, and a refusal carries
 *   only its code and the caller's own ids — never a draft, a text or a subject.
 * - A LATE READ FOR A CONVERSATION THE OPERATOR HAS LEFT is `superseded`, not shown.
 */
import type { createCeoConversationService } from './ceoConversationService.ts'
import { ceoId } from '../shared/ceoConversationDraft.ts'

type Service = ReturnType<typeof createCeoConversationService>
export interface CeoChatActivation { active: boolean; reason: 'private_recovery_unavailable' | null }
export interface CeoChatBindingOptions { service: Service; activation(): CeoChatActivation; queueLimit?: number }
export type CeoChatRefusal = { ok: false; state: 'refused' | 'commit_unknown'; reason_code: string; conversation_id?: string; operation_id?: string }

interface Method { keys: readonly string[]; gated: boolean; read: boolean; run(s: Service, a: Record<string, unknown>): Promise<unknown> }
const s_ = (v: unknown) => v as string
export const CEO_CHAT_METHODS: Readonly<Record<string, Method>> = Object.freeze({
  readDraft: { keys: ['conversationId'], gated: false, read: true, run: (s, a) => s.readDraft(s_(a.conversationId)) },
  inventory: { keys: [], gated: false, read: false, run: s => s.inventory() },
  saveDraft: { keys: ['conversationId', 'expectedRevision', 'draft'], gated: false, read: false, run: (s, a) => s.saveDraft(s_(a.conversationId), a.expectedRevision as string | null, a.draft) },
  discardDraft: { keys: ['conversationId', 'expectedRevision'], gated: false, read: false, run: (s, a) => s.discardDraft(s_(a.conversationId), s_(a.expectedRevision)) },
  forgetSettled: { keys: ['conversationId', 'operationId', 'expectedRevision'], gated: false, read: false, run: (s, a) => s.forgetSettled(s_(a.conversationId), s_(a.operationId), s_(a.expectedRevision)) },
  freezeSend: { keys: ['conversationId', 'expectedRevision', 'operationId', 'messageId'], gated: true, read: false,
    run: (s, a) => s.freezeSend(s_(a.conversationId), s_(a.expectedRevision), { operationId: s_(a.operationId), messageId: s_(a.messageId) }) },
  send: { keys: ['conversationId', 'operationId'], gated: true, read: false, run: (s, a) => s.send(s_(a.conversationId), s_(a.operationId)) },
  reconcile: { keys: ['conversationId', 'operationId'], gated: true, read: false, run: (s, a) => s.reconcile(s_(a.conversationId), s_(a.operationId)) },
  retry: { keys: ['conversationId', 'operationId'], gated: true, read: false, run: (s, a) => s.retrySavedInput(s_(a.conversationId), s_(a.operationId)) },
  open: { keys: ['operationId', 'conversationId', 'subjectKind', 'subjectId'], gated: true, read: false,
    run: (s, a) => s.open({ operationId: s_(a.operationId), conversationId: s_(a.conversationId), subjectKind: a.subjectKind as 'global' | 'project' | 'question', subjectId: s_(a.subjectId) }) },
  read: { keys: ['conversationId', 'afterOrdinal', 'limit'], gated: true, read: true, run: (s, a) => s.read(s_(a.conversationId), a.afterOrdinal as number, a.limit as number) },
})

const FORBIDDEN = /^(estateId|personId|p_.*|url|serviceKey)$/
/** A plain data object with exactly `keys`, read without running any accessor. */
function plain(v: unknown, keys: readonly string[]): Record<string, unknown> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.getPrototypeOf(v) !== Object.prototype) return null
  const d = Object.getOwnPropertyDescriptors(v)
  if (Reflect.ownKeys(d).length !== keys.length || keys.some(k => !Object.hasOwn(d, k) || !('value' in d[k]))) return null
  return Object.fromEntries(keys.map(k => [k, d[k].value]))
}
/** Identity, RPC and credential names refuse at any depth, before the service sees them. */
function forbidden(v: unknown, depth = 0): boolean {
  if (depth > 8) return true
  if (!v || typeof v !== 'object') return false
  for (const key of Reflect.ownKeys(v)) {
    if (typeof key !== 'string' || FORBIDDEN.test(key)) return true
    const d = Object.getOwnPropertyDescriptor(v, key)
    if (!d || !('value' in d) || forbidden(d.value, depth + 1)) return true
  }
  return false
}
const DENIED = new Set(['unavailable', 'authority_changed', 'denied'])

export function createCeoChatBinding(options: CeoChatBindingOptions) {
  const limit = options.queueLimit ?? 32
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 256) throw Error('invalid_ceo_chat_binding')
  let tail: Promise<unknown> = Promise.resolve(), queued = 0, current: string | null = null
  const refuse = (reason_code: string, a?: Record<string, unknown> | null, state: CeoChatRefusal['state'] = 'refused'): CeoChatRefusal => ({
    ok: false, state, reason_code,
    ...(a && ceoId(a.conversationId) ? { conversation_id: a.conversationId } : {}),
    ...(a && ceoId(a.operationId) && state === 'commit_unknown' ? { operation_id: a.operationId } : {}) })
  const status = (): CeoChatActivation => {
    try { const v = options.activation(); return v && v.active === true ? { active: true, reason: null } : { active: false, reason: 'private_recovery_unavailable' } }
    catch { /* Not silence: an unreadable activation is a closed gate. */ return { active: false, reason: 'private_recovery_unavailable' } }
  }
  /** Keep a result's own fields; reduce a refusal to its code and the caller's ids. */
  const shape = (result: unknown, a: Record<string, unknown>, method: Method): unknown => {
    const r = result as { ok?: unknown; state?: unknown; reason_code?: unknown; conversation_id?: unknown }
    if (!r || typeof r !== 'object' || (r.ok !== true && r.ok !== false)) return refuse('invalid_response', a)
    if (method.read && current !== null && r.conversation_id !== current) return refuse('superseded', a)
    if (r.ok === true) return r
    const code = typeof r.reason_code === 'string' ? r.reason_code : 'invalid_response'
    return refuse(DENIED.has(code) ? 'unavailable' : code, a, r.state === 'commit_unknown' ? 'commit_unknown' : 'refused')
  }
  return {
    status,
    /** The conversation the renderer is showing; a read that settles for another is superseded. */
    select(conversationId: string | null): void {
      if (conversationId !== null && !ceoId(conversationId)) throw Error('invalid_input')
      current = conversationId
    },
    call(name: unknown, args: unknown): Promise<unknown> {
      const method = typeof name === 'string' && Object.hasOwn(CEO_CHAT_METHODS, name) ? CEO_CHAT_METHODS[name] : null
      const a = method ? plain(args, method.keys) : null
      if (!method || !a || forbidden(args)) return Promise.resolve(refuse('invalid_input'))
      if (method.gated && !status().active) return Promise.resolve(refuse('private_recovery_unavailable', a))
      if (queued >= limit) return Promise.resolve(refuse('busy', a))
      queued++
      const run = tail.then(async () => {
        // Checked again at the head of the queue: the gate may have closed while waiting.
        if (method.gated && !status().active) return refuse('private_recovery_unavailable', a)
        try { return shape(await method.run(options.service, a), a, method) }
        catch { /* Not silence: the service's typed results are the contract; a throw is an invalid response, and its message may hold private input. */ return refuse('invalid_response', a) }
      }).finally(() => { queued-- })
      tail = run.catch(() => undefined)
      return run
    },
  }
}

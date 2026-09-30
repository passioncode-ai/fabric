// View/process ownership is separate from provider execution evidence. This module
// cannot append terminal.closed, end a Run, release a lease or signal a backend.
export interface NativeViewOwner {
  fabric: { estateId: string; projectId: string; taskId: string; runId: string; runOrdinal: number; sessionId: string }
  authority: { personId: string; revision: number }
  backend: { ownerId: string; hostInstanceId: string; bootId: string; processIdentityRef: string; connectionId: string }
}
export interface NativeViewTicket { owner: NativeViewOwner; viewId: string; attachment: number }
export type NativeViewPhase = 'opening' | 'attached' | 'detaching' | 'detached' | 'exited' | 'outcome_unknown'
export interface NativeViewReceipt { ticket: NativeViewTicket; state: NativeViewPhase; reasonCode: string }
export interface NativeViewPorts {
  /** Fresh trusted host snapshot, including current membership revision. Not renderer data. */
  currentOwner(): NativeViewOwner | null
  /** Exact local view-handle registry; never look up the backend by a current/global PID. */
  ownsView(ticket: NativeViewTicket): boolean
  openView(ticket: NativeViewTicket, stillAllowed: () => boolean): Promise<{ ticket: NativeViewTicket; opened: true }>
  writeView(ticket: NativeViewTicket, text: string, stillAllowed: () => boolean): Promise<{ ticket: NativeViewTicket; written: true }>
  closeView(ticket: NativeViewTicket, stillAllowed: () => boolean): Promise<{ ticket: NativeViewTicket; closed: true }>
  /** Compensation closes ONLY the exact owned local view process. No provider
   * RPC, backend signal, journal, credential revocation or execution finalizer. */
  disposeView(ticket: NativeViewTicket, stillOwnedView: () => boolean): Promise<{ ticket: NativeViewTicket; closed: true }>
}
export const NATIVE_VIEW_LIMITS = Object.freeze({ attachments: 128, active: 8, inputChars: 65_536 })
const scalarId = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(v)
const uuid = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)
function object(v: unknown, names: readonly string[]): v is Record<string, unknown> {
  if (!v || typeof v !== 'object' || Object.getPrototypeOf(v) !== Object.prototype) return false
  const d = Object.getOwnPropertyDescriptors(v)
  return Object.keys(d).length === names.length && names.every(k => !!d[k] && 'value' in d[k])
}
function ownerValid(v: unknown): v is NativeViewOwner {
  if (!object(v, ['fabric','authority','backend'])) return false
  const { fabric: f, authority: a, backend: b } = v
  return object(f, ['estateId','projectId','taskId','runId','runOrdinal','sessionId']) &&
    ['estateId','projectId','taskId','runId','sessionId'].every(k => uuid(f[k])) && Number.isSafeInteger(f.runOrdinal) && (f.runOrdinal as number) > 0 &&
    object(a, ['personId','revision']) && uuid(a.personId) && Number.isSafeInteger(a.revision) && (a.revision as number) >= 0 &&
    object(b, ['ownerId','hostInstanceId','bootId','processIdentityRef','connectionId']) &&
    ['ownerId','hostInstanceId','bootId','connectionId'].every(k => scalarId(b[k])) &&
    typeof b.processIdentityRef === 'string' && /^process:[a-f0-9]{64}$/.test(b.processIdentityRef)
}
const canonicalOwner = (v: NativeViewOwner) => JSON.stringify([
  v.fabric.estateId,v.fabric.projectId,v.fabric.taskId,v.fabric.runId,v.fabric.runOrdinal,v.fabric.sessionId,
  v.authority.personId,v.authority.revision,v.backend.ownerId,v.backend.hostInstanceId,v.backend.bootId,v.backend.processIdentityRef,v.backend.connectionId
])
const freeze = <T>(v: T): T => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v) }; return v }
function absorb(v: unknown): void { if (v && (typeof v === 'object' || typeof v === 'function')) { try { const p = v as PromiseLike<unknown>; if (typeof p.then === 'function') Promise.resolve(p).catch(() => {}) } catch { /* untrusted port result */ } } }
interface Entry { ticket: NativeViewTicket; phase: NativeViewPhase; reason: string; epoch: number; outputCursor: number; writing?: boolean; pending?: Promise<NativeViewReceipt>; disposing?: Promise<void>; disposeAgain?: boolean }
/** One coordinator per already-owned backend connection epoch. Reconnection of
 * an owner requires external resync + a new coordinator; this one stays fenced.
 * Ports must honor supplied fences at their actual effect edge, not just enqueue.
 * Transport availability NEVER substitutes for provider load/quiescence proofs. */
export function createNativeViewLifecycle(input: NativeViewOwner, ports: NativeViewPorts, options: { timeoutMs?: number } = {}) {
  if (!ownerValid(input)) throw Error('invalid_view_owner')
  const owner = freeze(structuredClone(input)), ownerKey = canonicalOwner(owner)
  const timeout = typeof options.timeoutMs === 'number' && Number.isFinite(options.timeoutMs)
    ? Math.max(1, Math.min(30_000, Math.floor(options.timeoutMs))) : 5000
  const entries = new Map<number, Entry>(), current = new Map<string, Entry>(), checkingLocal = new Set<number>()
  let checkingOwner = false
  let ownerState: 'connected' | 'outcome_unknown' | 'retired' = 'connected', ownerReason = 'owned_connection', next = 1
  const receipt = (e: Entry): NativeViewReceipt => freeze({ ticket: e.ticket, state: e.phase, reasonCode: e.reason })
  const fenceAll = (state: typeof ownerState, reason: string) => {
    if (ownerState === 'retired' || ownerState === 'outcome_unknown' && state === 'outcome_unknown') return
    ownerState = state; ownerReason = reason
    for (const e of entries.values()) e.epoch++
  }
  const owns = (): boolean => {
    if (ownerState !== 'connected' || checkingOwner) return false
    checkingOwner = true
    try { const value = ports.currentOwner(); if (ownerState === 'connected' && ownerValid(value) && canonicalOwner(value) === ownerKey) return true; absorb(value) }
    catch { /* An unavailable owner/authority is unknown, not permission. */ }
    finally { checkingOwner = false }
    fenceAll('outcome_unknown', 'owner_or_authority_changed'); return false
  }
  const find = (ticket: unknown): Entry | undefined => {
    if (!object(ticket, ['owner','viewId','attachment']) || !ownerValid(ticket.owner) || canonicalOwner(ticket.owner) !== ownerKey ||
      !scalarId(ticket.viewId) || !Number.isSafeInteger(ticket.attachment)) return
    const e = entries.get(ticket.attachment as number)
    return e?.ticket.viewId === ticket.viewId ? e : undefined
  }
  const local = (e: Entry) => {
    if (checkingLocal.has(e.ticket.attachment)) return false
    checkingLocal.add(e.ticket.attachment)
    try { const v = ports.ownsView(e.ticket); absorb(v); return v === true } catch { /* Unavailable exact local ownership denies the effect; no raw host error leaves this port. */ return false }
    finally { checkingLocal.delete(e.ticket.attachment) }
  }
  const active = (e: Entry) => current.get(e.ticket.viewId) === e && ['opening','attached'].includes(e.phase)
  const set = (e: Entry, phase: NativeViewPhase, reason: string) => { e.epoch++; e.phase = phase; e.reason = reason }
  const isClosed = (e: Entry) => e.phase === 'detached' || e.phase === 'exited'
  const exactReply = (value: unknown, key: 'opened' | 'written' | 'closed', e: Entry): boolean =>
    object(value, ['ticket',key]) && value[key] === true && find(value.ticket) === e
  async function bounded<T>(operation: (allowed: () => boolean) => Promise<T>, eligible: () => boolean, completionAllowed: () => boolean = eligible, deadline = performance.now() + timeout): Promise<T> {
    let expired = false, timer: ReturnType<typeof setTimeout> | undefined
    const allowed = () => {
      if (performance.now() >= deadline) expired = true
      if (expired || !eligible()) return false
      // A synchronous host guard can consume the remaining budget.
      if (performance.now() >= deadline) expired = true
      return !expired
    }
    try {
      if (!allowed()) throw Error('fenced')
      const value = await Promise.race([Promise.resolve().then(() => { if (!allowed()) throw Error('fenced'); return operation(allowed) }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => { expired = true; reject(Error('deadline')) }, Math.max(0, deadline - performance.now())) })])
      if (performance.now() >= deadline) expired = true
      if (expired || !completionAllowed() || performance.now() >= deadline) throw Error('fenced')
      return value
    } finally { expired = true; if (timer) clearTimeout(timer) }
  }
  function dispose(e: Entry, lateOpen = false): Promise<void> {
    const deadline = performance.now() + timeout
    // A delayed open completion may materialize an exact handle after an earlier
    // exit/cleanup receipt. Recheck that handle instead of trusting the old phase.
    if (lateOpen && local(e) && isClosed(e)) set(e, 'outcome_unknown', 'late_view_materialized')
    if (e.disposing) { if (lateOpen) e.disposeAgain = true; return e.disposing }
    e.disposing = (async () => {
      try {
        const result = await bounded(allowed => ports.disposeView(e.ticket, allowed), () => local(e) && !isClosed(e), () => true, deadline)
        if (!exactReply(result, 'closed', e)) throw Error('unconfirmed_view_cleanup')
        if (!isClosed(e)) set(e, 'detached', 'local_view_disposed')
      } catch { /* Preserve explicit unknown cleanup in the typed receipt; never infer exit from a port error. */ if (!isClosed(e)) set(e, 'outcome_unknown', 'view_cleanup_unconfirmed') }
    })().finally(() => {
      e.disposing = undefined
      if (e.disposeAgain) { e.disposeAgain = false; return dispose(e, true) }
    })
    return e.disposing
  }
  function open(viewId: string, deadline: number): Promise<NativeViewReceipt> {
    const e: Entry = { ticket: freeze({ owner, viewId, attachment: next++ }), phase: 'opening', reason: 'view_opening', epoch: 0, outputCursor: 0 }
    entries.set(e.ticket.attachment, e); current.set(viewId, e)
    const epoch = e.epoch
    const eligible = () => owns() && active(e) && e.epoch === epoch
    const task = (async () => {
      try {
        const result = await bounded(allowed => {
          const opened = Promise.resolve().then(() => { if (!allowed()) throw Error('fenced'); return ports.openView(e.ticket, allowed) })
          // A late open may own a local process even after its caller timed out.
          // Dispose by exact view handle only; never signal the backend.
          const lateCompletion = () => { if (!eligible()) void dispose(e, true) }
          void opened.then(lateCompletion, lateCompletion)
          return opened
        }, eligible, eligible, deadline)
        if (!exactReply(result, 'opened', e) || !local(e) || !eligible()) throw Error('unconfirmed_view_open')
        set(e, 'attached', 'view_attached')
      } catch { // The typed view receipt below exposes failure; raw process/port errors are not retained.
        if (!isClosed(e)) { set(e, 'outcome_unknown', 'view_open_unconfirmed'); await dispose(e) }
      }
      return receipt(e)
    })()
    e.pending = task; void task.finally(() => { if (e.pending === task) e.pending = undefined })
    return task
  }
  const refused = (ticket: NativeViewTicket, reasonCode: string): NativeViewReceipt => freeze({ ticket, state: 'outcome_unknown', reasonCode })
  return {
    owner,
    snapshot() { owns(); return freeze({ owner, state: ownerState, reasonCode: ownerReason, views: [...entries.values()].map(receipt) }) },
    /** True is a veto; false is NOT an execution admission grant. */
    isAdmissionFenced() { return !owns() },
    attach(viewId: string): Promise<NativeViewReceipt> {
      const deadline = performance.now() + timeout
      if (!scalarId(viewId)) return Promise.reject(Error('invalid_view_id'))
      const prior = current.get(viewId)
      if (prior) return owns() ? prior.pending ?? Promise.resolve(receipt(prior)) : Promise.resolve(refused(prior.ticket, 'owner_fenced'))
      if (!owns()) return Promise.reject(Error('owner_fenced'))
      if (entries.size >= NATIVE_VIEW_LIMITS.attachments || [...entries.values()].filter(e => !isClosed(e)).length >= NATIVE_VIEW_LIMITS.active) return Promise.reject(Error('view_capacity'))
      return open(viewId, deadline)
    },
    reconnect(ticket: NativeViewTicket): Promise<NativeViewReceipt> {
      const deadline = performance.now() + timeout
      const e = find(ticket)
      if (!e || current.get(e.ticket.viewId) !== e || !isClosed(e)) return Promise.reject(Error('view_not_closed'))
      if (!owns()) return Promise.reject(Error('owner_fenced'))
      if (entries.size >= NATIVE_VIEW_LIMITS.attachments || [...entries.values()].filter(v => !isClosed(v)).length >= NATIVE_VIEW_LIMITS.active) return Promise.reject(Error('view_capacity'))
      return open(e.ticket.viewId, deadline)
    },
    async detach(ticket: NativeViewTicket): Promise<NativeViewReceipt> {
      const deadline = performance.now() + timeout
      const e = find(ticket)
      if (!e) throw Error('unknown_view')
      if (isClosed(e)) return receipt(e)
      if (e.phase === 'detaching') return e.pending ?? receipt(e)
      if (e.phase === 'opening' || e.phase === 'outcome_unknown' || !owns()) { set(e, 'outcome_unknown', 'view_detach_unconfirmed'); await dispose(e); return receipt(e) }
      set(e, 'detaching', 'view_detaching'); const epoch = e.epoch
      const task = (async () => {
        try {
          const result = await bounded(allowed => ports.closeView(e.ticket, allowed), () => local(e) && owns() && e.phase === 'detaching' && e.epoch === epoch, () => true, deadline)
          if (!exactReply(result, 'closed', e)) throw Error('unconfirmed_view_close')
          if (!isClosed(e)) set(e, 'detached', 'view_detached')
        } catch { /* Preserve explicit unknown cleanup in the typed receipt; never infer exit from a port error. */ if (!isClosed(e)) set(e, 'outcome_unknown', 'view_close_unconfirmed') }
        return receipt(e)
      })()
      e.pending = task; void task.finally(() => { if (e.pending === task) e.pending = undefined }); return task
    },
    /** Host-observed exit belongs to this view only; no backend terminal event. */
    viewExited(ticket: NativeViewTicket): boolean {
      const e = find(ticket); if (!e || isClosed(e)) return false
      set(e, 'exited', 'view_exit_observed'); return true
    },
    async write(ticket: NativeViewTicket, text: string): Promise<NativeViewReceipt> {
      const deadline = performance.now() + timeout
      const e = find(ticket)
      if (!e) throw Error('unknown_view')
      if (typeof text !== 'string' || !text.length || text.length > NATIVE_VIEW_LIMITS.inputChars) return refused(e.ticket, 'invalid_view_input')
      if (e.phase !== 'attached' || !owns() || !local(e)) return refused(e.ticket, 'view_input_fenced')
      if (e.writing) return refused(e.ticket, 'view_write_busy')
      e.writing = true
      const epoch = e.epoch
      try {
        const eligible = () => local(e) && owns() && e.phase === 'attached' && e.epoch === epoch
        const result = await bounded(allowed => ports.writeView(e.ticket, text, allowed), eligible, eligible, deadline)
        if (!exactReply(result, 'written', e)) throw Error('unconfirmed_write')
        return receipt(e)
      } catch { /* The typed unknown receipt fences every view; never log raw input or replay it. */ fenceAll('outcome_unknown', 'view_input_outcome_unknown'); if (!isClosed(e)) set(e, 'outcome_unknown', 'view_input_outcome_unknown'); return receipt(e) } finally { e.writing = false }
    },
    /** Check synchronously immediately before UI delivery. No raw output retained. */
    acceptOutput(ticket: NativeViewTicket, cursor: number): boolean {
      const e = find(ticket)
      if (!e || !local(e) || !owns() || !active(e) || !Number.isSafeInteger(cursor) || cursor <= e.outputCursor) return false
      e.outputCursor = cursor; return true
    },
    connectionLost(connectionId: string): boolean {
      if (connectionId !== owner.backend.connectionId || ownerState !== 'connected') return false
      fenceAll('outcome_unknown', 'owner_connection_lost'); return true
    },
    retire(): void { fenceAll('retired', 'owner_retired') }
  }
}

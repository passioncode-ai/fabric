// #region question-signal — docs: docs/evidence/specs/2026-11-21-ceo-triages-questions.md#3-design
/**
 * A question that needs the owner reaches him in his personal communicator (ADR-0207 Decision 3; the owner, 2026-11-21
 * 03:14: «сигнализировать в мой персональный коммуникатор. А PM-агентов оставим для работы с тасками из команды»).
 *
 * From main's minute timer: each open question in «Нужны вы» not signalled yet gets one `communicator.notify` with kind
 * `question`, the stable eventId `fabric-question-<id>` (the communicator's idempotency key), its text, options and a
 * link back to Fabric, at most MAX_PER_TICK a pass. The key is read for one pass from the vault (its own slot, allowed
 * `question` only); without it nothing is sent, the question still waits in «Нужны вы», the ops log says once that
 * the signal is off, and the key is read again no sooner than KEY_RETRY_MS. A notice the communicator refused is tried again at the next pass; one it took is never sent again,
 * across restarts too (`sent`).
 */
export const MAX_PER_TICK = 5
/** A question older than this is not signalled when it is first seen (a machine whose signal was off for a week). */
export const SIGNAL_WINDOW_MS = 7 * 24 * 60 * 60_000
/** How long the communicator keeps a question answerable, when the question names no expiry of its own. */
export const DEFAULT_EXPIRY_MS = 7 * 24 * 60 * 60_000
/** A key that could not be read is read again no sooner than this (each read starts the vault's helper). */
export const KEY_RETRY_MS = 15 * 60_000

export interface SignalQuestion {
  id: string
  text: string
  options: ReadonlyArray<{ id: string; label: string; recommended?: boolean }>
  project: string | null
  whyBlocked: string | null
  askedAt: number
  /** The question's revision (a changed question is a new revision for the communicator). */
  revision?: number
}

export interface Notice { eventId: string; kind: 'question'; text: string; subject: string; question: { questionId: string; revision: number; expiresAt: number } }

export interface QuestionSignalDeps {
  open(): Promise<readonly SignalQuestion[]>
  /** The gateway's address and the key for one pass; a reason when either cannot be read. */
  key(): Promise<{ url: string; key: string } | { reason: string }>
  notify(access: { url: string; key: string }, notice: Notice): Promise<{ ok: boolean; reason: string | null }>
  sent: { has(id: string): boolean; add(id: string): void }
  /** Nothing was ever signalled on this machine (no record of sent notices): the questions open now are taken as known
   *  at the first pass, so turning the signal on does not send the owner a week of questions at once. */
  firstRun?: boolean
  record(op: string, outcome: 'ok' | 'failed', detail: Record<string, unknown>): void
  now?: () => number
}

/** The notice for one question: text only, at most 3,500 characters, ending with where to answer. */
export function questionNotice(q: SignalQuestion, now: number): Notice {
  const head = `${q.project ? `${q.project}: ` : ''}${q.text}`
  const why = q.whyBlocked ? `\n\n${q.whyBlocked}` : ''
  const options = q.options.length
    ? `\n\n${q.options.map((o, i) => `${i + 1}. ${o.label}${o.recommended ? ' (рекомендуется)' : ''}`).join('\n')}`
    : ''
  const tail = `\n\nОтветьте здесь или в Fabric: «Нужны вы».`
  const room = 3500 - tail.length
  const text = `${head}${why}${options}`.slice(0, room) + tail
  return {
    eventId: `fabric-question-${q.id}`,
    kind: 'question',
    text,
    subject: 'Fabric: нужен ваш ответ',
    question: { questionId: q.id, revision: Math.max(1, q.revision ?? 1), expiresAt: Math.floor((now + DEFAULT_EXPIRY_MS) / 1000) }
  }
}

/** The JSON-RPC answer in a response that is JSON or an event stream; null when there is none. */
function answerOf(text: string): { result?: { isError?: boolean; content?: unknown }; error?: unknown } | null {
  const s = String(text).trim()
  if (s.startsWith('{')) { try { return JSON.parse(s) } catch { /* not JSON: no answer, said by the caller */ return null } }
  for (const line of s.split('\n')) {
    if (!line.startsWith('data:')) continue
    try { return JSON.parse(line.slice(5).trim()) } catch { /* the next data line */ }
  }
  return null
}

/**
 * One notice through the communicator's MCP route, as `scripts/lib/communicator-notify.mjs` sends the workspace sync's:
 * initialize, the initialized notification, one `communicator.notify`. Never throws; the reason never carries the key.
 */
export async function sendNotice(access: { url: string; key: string }, notice: Notice, fetchImpl: typeof fetch = fetch, timeoutMs = 10_000): Promise<{ ok: boolean; reason: string | null }> {
  const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'x-agw-key': access.key }
  const signal = AbortSignal.timeout(timeoutMs)
  const post = async (message: unknown): Promise<{ status: number; session: string | null; answer: ReturnType<typeof answerOf> }> => {
    const r = await fetchImpl(access.url, { method: 'POST', headers, body: JSON.stringify(message), signal })
    return { status: r.status, session: r.headers.get('mcp-session-id'), answer: answerOf(await r.text()) }
  }
  try {
    const init = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'fabric-questions', version: '1' } } })
    if (init.status !== 200 || !init.answer?.result) return { ok: false, reason: `the communicator refused the session (HTTP ${init.status})` }
    if (init.session) headers['mcp-session-id'] = init.session
    await post({ jsonrpc: '2.0', method: 'notifications/initialized' })
    const call = await post({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'communicator.notify', arguments: notice } })
    if (call.status !== 200) return { ok: false, reason: `the notice was refused (HTTP ${call.status})` }
    if (!call.answer?.result || call.answer.result.isError) return { ok: false, reason: 'the communicator answered with an error: ' + JSON.stringify(call.answer?.error ?? call.answer?.result?.content ?? null).slice(0, 200) }
    return { ok: true, reason: null }
  } catch (e) {
    // Said to the caller, which records it; the key is never in the reason.
    return { ok: false, reason: 'the communicator could not be reached: ' + (e instanceof Error ? e.name : 'error') }
  }
}

export function createQuestionSignal(deps: QuestionSignalDeps) {
  const now = deps.now ?? Date.now
  let running = false
  let offSaid: string | null = null
  let keyRetryAt = 0
  let seeded = !deps.firstRun

  async function tick(): Promise<number> {
    if (running) return 0
    running = true
    try {
      const t = now()
      if (!seeded) {
        const open = await deps.open()
        for (const q of open) deps.sent.add(q.id)
        seeded = true
        deps.record('question.signal-seeded', 'ok', { known: open.length })
        return 0
      }
      const due = (await deps.open()).filter((q) => !deps.sent.has(q.id) && t - q.askedAt <= SIGNAL_WINDOW_MS).slice(0, MAX_PER_TICK)
      if (!due.length || t < keyRetryAt) return 0
      const access = await deps.key()
      if ('reason' in access) {
        keyRetryAt = t + KEY_RETRY_MS
        if (offSaid !== access.reason) { offSaid = access.reason; deps.record('question.signal-off', 'failed', { reason: access.reason, waiting: due.length }) }
        return 0
      }
      offSaid = null
      let sent = 0
      for (const q of due) {
        const r = await deps.notify(access, questionNotice(q, t))
        deps.record('question.signal', r.ok ? 'ok' : 'failed', { question_id: q.id, ...(r.ok ? {} : { reason: r.reason }) })
        if (r.ok) { deps.sent.add(q.id); sent++ }
      }
      return sent
    } finally { running = false }
  }

  return { tick }
}
// #endregion question-signal

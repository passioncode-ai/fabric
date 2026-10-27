// #region communicator-notify — docs: AGENTS.md#lifecycle
// CO-411: a scheduled job's failure reaches the operator's private chat. The personal communicator's gateway
// holds a key for the role `fabric-workspace-sync` that may call `communicator.notify` and nothing else
// (sshlg-personal-os BL-1266, board thread fb4cea6b). The key lives in Observatory's vault slot
// `fabric/prod/COMMUNICATOR_NOTIFY_KEY` and reaches this process only as an environment variable set by
// `use_secret.py run --vault-only`; it is never printed, logged or put in argv.
//
// As a command: `node scripts/lib/communicator-notify.mjs <kind> <eventId> <text>` with the key in
// COMMUNICATOR_NOTIFY_KEY; exit 0 when the communicator took the notice, 1 otherwise.

import { pathToFileURL } from 'node:url'

export const COMMUNICATOR_URL = 'http://127.0.0.1:47835/mcp/personal-communicator'
const KINDS = new Set(['failure', 'recovery'])

/** The JSON-RPC answer in a response that is JSON or an event stream; null when there is none. */
function answerOf(text) {
  const t = String(text).trim()
  if (t.startsWith('{')) { try { return JSON.parse(t) } catch { return null } }
  for (const line of t.split('\n')) {
    if (!line.startsWith('data:')) continue
    try { return JSON.parse(line.slice(5).trim()) } catch { /* the next data line */ }
  }
  return null
}

/**
 * Send one bounded notice through the communicator's MCP route: initialize, the initialized notification, one
 * `communicator.notify` call. The same `eventId` is the communicator's idempotency key, so a retry or a later
 * failure of the same streak sends nothing twice. Answers `{ ok, reason }`; it never throws and the reason never
 * carries the key.
 */
export async function notifyCommunicator({ url = COMMUNICATOR_URL, key, eventId, kind, text, subject, fetchImpl = fetch, timeoutMs = 10_000 }) {
  if (!key) return { ok: false, reason: 'no key: the vault slot fabric/prod/COMMUNICATOR_NOTIFY_KEY is empty or was not passed' }
  if (!KINDS.has(kind)) return { ok: false, reason: `kind ${kind} is not failure or recovery` }
  if (!text || !eventId) return { ok: false, reason: 'a notice needs a text and an eventId' }
  const headers = { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'x-agw-key': key }
  const signal = AbortSignal.timeout(timeoutMs)
  const post = async (message) => {
    const r = await fetchImpl(url, { method: 'POST', headers, body: JSON.stringify(message), signal })
    const body = await r.text()
    return { status: r.status, session: r.headers.get('mcp-session-id'), answer: answerOf(body) }
  }
  try {
    const init = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'fabric-workspace-sync', version: '1' } } })
    if (init.status !== 200 || !init.answer?.result) return { ok: false, reason: `the communicator refused the session (HTTP ${init.status})` }
    if (init.session) headers['mcp-session-id'] = init.session
    await post({ jsonrpc: '2.0', method: 'notifications/initialized' })
    const args = { eventId: String(eventId).slice(0, 160), kind, text: String(text).slice(0, 3500), ...(subject ? { subject: String(subject).slice(0, 160) } : {}) }
    const call = await post({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'communicator.notify', arguments: args } })
    if (call.status !== 200) return { ok: false, reason: `the notice was refused (HTTP ${call.status})` }
    if (!call.answer?.result || call.answer.result.isError) return { ok: false, reason: 'the communicator answered with an error: ' + JSON.stringify(call.answer?.error ?? call.answer?.result?.content ?? null).slice(0, 200) }
    return { ok: true, reason: null }
  } catch (e) {
    return { ok: false, reason: 'the communicator could not be reached: ' + String(e?.name || 'error') }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [kind, eventId, text] = process.argv.slice(2)
  const r = await notifyCommunicator({ key: process.env.COMMUNICATOR_NOTIFY_KEY, eventId, kind, text, subject: 'Fabric: синхронизация вики' })
  console.log(r.ok ? `notice ${eventId} taken` : `notice ${eventId} not sent: ${r.reason}`)
  process.exit(r.ok ? 0 : 1)
}
// #endregion communicator-notify

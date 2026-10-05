// A fixture ACP agent for acp-shell.test.mjs: newline-delimited JSON-RPC on stdio. It records every
// request and notification it receives (FAKE_ACP_RECORD, one JSON per line) and declares HTTP MCP only
// when FAKE_ACP_HTTP=1, the way Kilo 7.4.17 does and Cline 3.0.46 does not.
import { appendFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
const recordFile = process.env.FAKE_ACP_RECORD
const record = (entry) => { if (recordFile) appendFileSync(recordFile, JSON.stringify(entry) + '\n') }
const send = (m) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...m }) + '\n')
let serial = 1000
const waiting = new Map()
let cancelled = null
const ask = (method, params) => new Promise((resolve) => { const id = ++serial; waiting.set(id, resolve); send({ id, method, params }) })
const update = (sessionId, text) => send({ method: 'session/update', params: { sessionId, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } } } })
createInterface({ input: process.stdin }).on('line', async (line) => {
  const m = JSON.parse(line)
  if (m.method === undefined && waiting.has(m.id)) { waiting.get(m.id)(m.result); waiting.delete(m.id); return }
  record({ method: m.method, params: m.params })
  if (m.method === 'session/cancel') { cancelled?.(); return }
  if (m.method === 'initialize')
    return send({ id: m.id, result: { protocolVersion: 1, agentCapabilities: { loadSession: false, mcpCapabilities: process.env.FAKE_ACP_HTTP === '1' ? { http: true } : {} }, authMethods: [] } })
  if (m.method === 'session/new') return send({ id: m.id, result: { sessionId: 'sess-fixture' } })
  if (m.method === 'session/prompt') {
    const text = m.params.prompt.map((b) => b.text ?? '').join('')
    if (text.includes('WRITE')) {
      send({ method: 'session/update', params: { sessionId: 'sess-fixture', update: { sessionUpdate: 'tool_call', toolCallId: 't1', title: 'Write notes.md', kind: 'edit', status: 'pending' } } })
      const answer = await ask('session/request_permission', { sessionId: 'sess-fixture', toolCall: { toolCallId: 't1', title: 'Write notes.md' },
        options: [{ optionId: 'yes-once', name: 'Allow', kind: 'allow_once' }, { optionId: 'no-once', name: 'Reject', kind: 'reject_once' }] })
      record({ permissionAnswer: answer })
      update('sess-fixture', `permission:${answer?.outcome?.optionId ?? answer?.outcome?.outcome}`)
      return send({ id: m.id, result: { stopReason: 'end_turn' } })
    }
    if (text.includes('SLOW')) {
      update('sess-fixture', 'working slowly')
      await new Promise((resolve) => { cancelled = resolve })
      return send({ id: m.id, result: { stopReason: 'cancelled' } })
    }
    update('sess-fixture', `echo:${text.slice(0, 24)}`)
    return send({ id: m.id, result: { stopReason: 'end_turn' } })
  }
  if (m.id !== undefined) send({ id: m.id, error: { code: -32601, message: 'unknown method' } })
}).on('close', () => process.exit(0))

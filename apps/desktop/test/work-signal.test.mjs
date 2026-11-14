// CO-565, CO-571, CO-573 (6): a session's work signal for the dispatcher is a tool call, never fabric-mcp's keep-alive
// ping or a notification (the operator, 2026-11-13: «раз в 10 минут пушить чтобы не спали и работали у кого есть задач»).
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

const { isWorkCall } = await import(path.resolve(import.meta.dirname, '../src/main/agentSurface.ts'))

test('a tool call is work; a ping, a notification, a list or nothing is not', () => {
  assert.equal(isWorkCall({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'fabric_work_list' } }), true)
  assert.equal(isWorkCall({ jsonrpc: '2.0', id: 2, method: 'ping' }), false)
  assert.equal(isWorkCall({ jsonrpc: '2.0', method: 'notifications/initialized' }), false)
  assert.equal(isWorkCall({ jsonrpc: '2.0', id: 3, method: 'tools/list' }), false)
  assert.equal(isWorkCall(undefined), false)
  assert.equal(isWorkCall([{ jsonrpc: '2.0', id: 4, method: 'ping' }, { jsonrpc: '2.0', id: 5, method: 'tools/call', params: {} }]), true)
})

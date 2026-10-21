// The write path of the tool trace (0.3.8 review i2 DA-4): a typed refusal reaches the operations log with its code
// and the level refusalOps gives it, through the real beginAttempt tap on a response, not only the pure mapping.
import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'main')
const { useOps } = await import(path.join(SRC, 'opsSink.ts'))
const { beginAttempt } = await import(path.join(SRC, 'toolTrace.ts'))

const logged = []
useOps({ correlate: () => 'test', record: (r) => logged.push(r), begin: () => () => {}, read: () => [], file: () => null, lost: () => 0 })

function answered(code) {
  const req = Object.assign(new EventEmitter(), { destroyed: false })
  const res = Object.assign(new EventEmitter(), { statusCode: 200, write: () => true, end: () => res })
  const a = beginAttempt({ req, res, ctx: { correlationId: 'c' } })
  a.saw({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'agent.call', arguments: {} } })
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, result: { isError: true, structuredContent: { error: { code, message: 'x' } }, content: [{ type: 'text', text: 'x' }] } })
  res.end(body)
  res.emit('finish')
  return logged.at(-1)
}

test('a typed refusal is logged with its code: a design refusal at warn, a product failure as an error, "may have run" as unknown', () => {
  const byDesign = answered('needs-grant')
  assert.equal(byDesign.level, 'warn'); assert.equal(byDesign.outcome, 'ok'); assert.equal(byDesign.detail.error_code, 'needs-grant')
  assert.equal(byDesign.detail.trace_outcome, 'threw')
  const product = answered('product-unreachable')
  assert.equal(product.level, 'error'); assert.equal(product.outcome, 'failed'); assert.equal(product.detail.error_code, 'product-unreachable')
  const maybe = answered('not_available')
  assert.equal(maybe.level, 'warn'); assert.equal(maybe.outcome, 'unknown')
})

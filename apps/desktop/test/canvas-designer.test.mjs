// ADR-0201 §5, CV-REQ-09: the designer answers a diagram and a tour from one bounded model call; a missing key, a
// refusal or an unreadable answer is a refusal in words, and nothing is drawn.
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

const d = await import(path.resolve(import.meta.dirname, '../src/main/canvasDesigner.ts'))

const vault = (ok = true) => ({ read: async (slot) => (ok ? { ok: true, value: `key-for-${slot.name}` } : { ok: false, reason: 'no such slot' }) })
const answer = (content, init = { status: 200 }, usage = { prompt_tokens: 300, completion_tokens: 200, cost: 0.004 }) =>
  async (url, req) => { answer.last = { url, req }; return new Response(JSON.stringify({ choices: [{ message: { content } }], usage }), init) }

const diagram = { title: 'Заказ', nodes: [{ id: 'call', text: 'Звонок', kind: 'ellipse' }, { id: 'ceo', text: 'CEO' }], edges: [{ from: 'call', to: 'ceo' }], tour: [{ node: 'call', say: 'Всё начинается со звонка.' }] }

test('one call to Kimi on OpenRouter, bounded in tokens and time, with Fabric\'s own key', async () => {
  const fetch = answer('```json\n' + JSON.stringify(diagram) + '\n```')
  const r = await d.designDiagram('заказ от звонка до сессии', [{ name: 'pay', kind: 'rectangle', text: 'Оплата' }], 'ru', { vault: vault(), fetch })
  assert.equal(r.ok, true)
  assert.deepEqual(r.diagram.nodes.map((n) => n.id), ['call', 'ceo'])
  assert.deepEqual(r.diagram.tour, diagram.tour)
  assert.deepEqual(r.usage, { promptTokens: 300, completionTokens: 200, costUsd: 0.004 })
  assert.equal(answer.last.url, d.DESIGNER_URL)
  assert.equal(answer.last.req.headers.authorization, 'Bearer key-for-OPENROUTER_API_KEY')
  const body = JSON.parse(answer.last.req.body)
  assert.equal(body.model, 'moonshotai/kimi-k3.1-pro')
  assert.equal(body.max_tokens, d.MAX_TOKENS)
  assert.ok(answer.last.req.signal, 'the call has a deadline')
  // The canvas's elements and the language reach the designer; no em dash is asked for.
  assert.match(body.messages[1].content, /pay: Оплата/)
  assert.match(body.messages[0].content, /in Russian/)
  assert.match(body.messages[0].content, /never an em dash/)
})

test('no key, a refusal, no answer or an unusable diagram are refusals, never a drawing', async () => {
  assert.equal((await d.designDiagram('x', [], 'ru', { vault: vault(false), fetch: answer('{}') })).reason, 'no-key')
  assert.equal((await d.designDiagram('x', [], 'ru', { vault: vault(), fetch: answer('{}', { status: 402 }) })).reason, 'refused')
  assert.equal((await d.designDiagram('x', [], 'ru', { vault: vault(), fetch: async () => { throw new DOMException('t', 'TimeoutError') } })).reason, 'unreachable')
  assert.equal((await d.designDiagram('x', [], 'ru', { vault: vault(), fetch: answer('я не могу') })).reason, 'unreadable')
  const noNodes = await d.designDiagram('x', [], 'ru', { vault: vault(), fetch: answer(JSON.stringify({ nodes: [] })) })
  assert.equal(noNodes.reason, 'unreadable')
  assert.match(noNodes.detail, /no nodes/)
  const notJson = await d.designDiagram('x', [], 'ru', { vault: vault(), fetch: async () => new Response('<html>', { status: 200 }) })
  assert.equal(notJson.reason, 'unreadable')
})

test('the JSON is found in a bare answer, a fenced one, or one with words around it', () => {
  assert.deepEqual(d.jsonOf('{"a":1}'), { a: 1 })
  assert.deepEqual(d.jsonOf('Вот схема:\n```json\n{"a":2}\n```'), { a: 2 })
  assert.deepEqual(d.jsonOf('Схема: {"a":3} готово'), { a: 3 })
  assert.equal(d.jsonOf('нет'), null)
  assert.equal(d.jsonOf('{broken'), null)
})

// ADR-0201 §4, §5: a voice tool reaches the canvas window and comes back with its answer (CV-REQ-01, CV-REQ-06,
// CV-REQ-11); a design goes through the designer and draws what it answered with its tour (CV-REQ-09).
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

const { createCanvasHost } = await import(path.resolve(import.meta.dirname, '../src/main/canvasHost.ts'))

/** A window that opens, says it is ready, and answers each command with `reply(command)`. */
function rig({ reply = () => ({ ok: true }), readyOnOpen = true, design, timeoutMs = 200 } = {}) {
  const opened = [], sent = [], records = []
  let n = 0
  let host
  const window = {
    open: (id) => { opened.push(id); if (readyOnOpen) queueMicrotask(() => host.ready(id)) },
    send: (id, requestId, command) => {
      if (!opened.includes(id)) return false
      sent.push(command)
      const answer = reply(command)
      if (answer !== undefined) queueMicrotask(() => host.answered(id, requestId, answer))
      return true
    }
  }
  host = createCanvasHost({ window, design: design ?? (async () => ({ ok: false, reason: 'no-key', detail: 'd' })), record: (op, d) => records.push([op, d]), newId: () => `r${++n}`, timeoutMs })
  return { host, opened, sent, records }
}

test('a tool that is not the canvas\'s is left to the caller', async () => {
  const { host } = rig()
  assert.equal(await host.runTool('session_list', {}), null)
})

test('canvas_open opens the window; a command opens it first, then waits for its answer', async () => {
  const { host, opened, sent } = rig({ reply: (c) => ({ ok: true, drawn: c.op === 'add' ? ['n1'] : [] }) })
  assert.deepEqual(await host.runTool('canvas_open', {}), { ok: true })
  const r = await host.runTool('canvas_add', { text: 'Проверить цену', kind: 'note' })
  assert.deepEqual(r, { ok: true, drawn: ['n1'] })
  assert.deepEqual(opened, ['main', 'main'], 'the same canvas, opened again or brought to the front')
  assert.equal(sent[0].op, 'add')
})

test('bad arguments are refused before the window is touched', async () => {
  const { host, opened } = rig()
  const r = await host.runTool('canvas_connect', { from: 'a' })
  assert.equal(r.ok, false)
  assert.match(r.reason, /both ends/)
  assert.deepEqual(opened, [])
})

test('a window that never says it is ready, or never answers, is a refusal in words; a late answer is dropped', async () => {
  const silent = rig({ readyOnOpen: false, timeoutMs: 30 })
  assert.match((await silent.host.runTool('canvas_focus', {})).reason, /did not open/)
  const mute = rig({ reply: () => undefined, timeoutMs: 30 })
  assert.match((await mute.host.runTool('canvas_focus', {})).reason, /did not answer within 10 seconds/)
  assert.equal(mute.host.answered('main', 'r1', { ok: true }), false, 'nobody waits for it any more')
})

test('a closed window answers its commands in flight at once', async () => {
  const { host } = rig({ reply: () => undefined, timeoutMs: 5000 })
  const p = host.runTool('canvas_highlight', { target: 'x' })
  await new Promise((r) => setTimeout(r, 5))
  host.closed('main')
  assert.match((await p).reason, /was closed/)
})

test('an answer from another canvas, or with fields of the wrong type, is not taken as given', async () => {
  const { host } = rig({ reply: () => ({ ok: true, drawn: ['a', 7, null], reason: 3, extra: 'secret', elements: [{ name: 'n', kind: 'box', text: 'x'.repeat(500) }] }) })
  const r = await host.runTool('canvas_read', {})
  assert.deepEqual(r.drawn, ['a'])
  assert.equal('extra' in r, false)
  assert.equal('reason' in r, false)
  assert.equal(r.elements[0].text.length, 200)
})

test('an answer to a command from another canvas\'s window is not taken as this canvas\'s', async () => {
  const { host } = rig({ reply: () => undefined, timeoutMs: 60 })
  const p = host.runTool('canvas_read', {})
  await new Promise((r) => setTimeout(r, 5))
  assert.equal(host.answered('other', 'r1', { ok: true, elements: [] }), false)
  assert.match((await p).reason, /did not answer/)
})

test('canvas_design reads the canvas, asks the designer, draws its diagram and hands back the tour', async () => {
  const asked = []
  const diagram = { nodes: [{ id: 'a', text: 'A', kind: 'box' }], edges: [], tour: [{ node: 'a', say: 'Это A.' }] }
  const { host, sent, records } = rig({
    reply: (c) => (c.op === 'read' ? { ok: true, elements: [{ name: 'pay', kind: 'rectangle', text: 'Оплата' }] } : { ok: true, drawn: ['a'] }),
    design: async (idea, existing) => { asked.push([idea, existing]); return { ok: true, diagram, usage: { promptTokens: 1, completionTokens: 2, costUsd: 0.001 } } }
  })
  const r = await host.runTool('canvas_design', { idea: 'как работает заказ' })
  assert.deepEqual(asked, [['как работает заказ', [{ name: 'pay', kind: 'rectangle', text: 'Оплата' }]]])
  assert.deepEqual(sent.map((c) => c.op), ['read', 'draw'])
  assert.deepEqual(sent[1].diagram, diagram)
  assert.deepEqual(r, { ok: true, drawn: ['a'], tour: [{ node: 'a', say: 'Это A.' }] })
  assert.deepEqual(records.find(([op]) => op === 'canvas.design')[1], { outcome: 'ok', nodes: 1, edges: 0, promptTokens: 1, completionTokens: 2, costUsd: 0.001 })
})

test('a designer that cannot answer is said in words, and nothing is drawn', async () => {
  const { host, sent, records } = rig({ reply: () => ({ ok: true, elements: [] }) })
  const r = await host.runTool('canvas_design', { idea: 'x' })
  assert.equal(r.ok, false)
  assert.match(r.reason, /no OpenRouter key/)
  assert.deepEqual(sent.map((c) => c.op), ['read'])
  assert.equal(records.find(([op]) => op === 'canvas.design')[1].outcome, 'failed')
})

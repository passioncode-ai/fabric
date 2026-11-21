// ADR-0201: the canvas's commands, checked before they reach the window (CV-REQ-06), found by name (CV-REQ-07), laid
// out without overlaps (CV-REQ-08), and the call told where each kind of request goes (CV-REQ-10).
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

const canvas = await import(path.resolve(import.meta.dirname, '../src/shared/canvas.ts'))
const { parseCanvasTool, parseDiagram, resolveRef, liteElements, layoutDiagram, diagramSkeletons, canvasVoiceTools, canvasInstructions, isCanvasId, originBeside, summarize } = canvas

test('a canvas id is a file name and nothing else', () => {
  assert.equal(isCanvasId('main'), true)
  assert.equal(isCanvasId('idea-2026'), true)
  for (const bad of ['', '../x', 'Main', 'a/b', '-x', 'a'.repeat(65), 7, null]) assert.equal(isCanvasId(bad), false, String(bad))
})

test('a tool that is not the canvas\'s is not parsed here', () => {
  assert.equal(parseCanvasTool('session_list', {}), null)
  assert.equal(parseCanvasTool('ask_ceo', { text: 'x' }), null)
})

test('each canvas tool checks its arguments and says what is wrong', () => {
  assert.deepEqual(parseCanvasTool('canvas_open', {}), { ok: true, value: { op: 'open' } })
  assert.deepEqual(parseCanvasTool('canvas_add', { text: '  проверить   цену ', kind: 'note' }).value,
    { op: 'add', node: { id: '', text: 'проверить цену', kind: 'note' } })
  assert.equal(parseCanvasTool('canvas_add', { text: '' }).ok, false)
  assert.equal(parseCanvasTool('canvas_add', { text: 'x', kind: 'circle' }).ok, false)
  assert.equal(parseCanvasTool('canvas_add', { text: 'x'.repeat(401) }).ok, false)
  assert.equal(parseCanvasTool('canvas_add', { text: 'x', id: 'has space' }).ok, false)
  assert.deepEqual(parseCanvasTool('canvas_connect', { from: 'a', to: 'b', label: 'платит' }).value, { op: 'connect', from: 'a', to: 'b', label: 'платит' })
  assert.match(parseCanvasTool('canvas_connect', { from: 'a' }).reason, /both ends/)
  assert.deepEqual(parseCanvasTool('canvas_focus', {}).value, { op: 'focus' })
  assert.deepEqual(parseCanvasTool('canvas_focus', { target: 'оплата' }).value, { op: 'focus', target: 'оплата' })
  assert.equal(parseCanvasTool('canvas_highlight', {}).ok, false)
  assert.deepEqual(parseCanvasTool('canvas_remove', { target: 'n1' }).value, { op: 'remove', target: 'n1' })
  assert.equal(parseCanvasTool('canvas_design', { idea: '' }).ok, false)
  assert.deepEqual(parseCanvasTool('canvas_design', { idea: 'заказ от звонка до сессии' }).value, { op: 'design', idea: 'заказ от звонка до сессии' })
  assert.equal(parseCanvasTool('canvas_fly', {}).ok, false)
  // Arguments that are not an object are no arguments: the tool's own rule refuses them.
  assert.equal(parseCanvasTool('canvas_highlight', 'n1').ok, false)
})

test('a diagram names every node once and links only its own nodes', () => {
  const good = parseDiagram({ title: 'Заказ', nodes: [{ id: 'a', text: 'Звонок' }, { id: 'b', text: 'CEO', kind: 'diamond', group: 'core' }, { text: 'Сессия' }],
    edges: [{ from: 'a', to: 'b', label: 'передаёт' }, { from: 'b', to: 'n3' }], tour: [{ node: 'a', say: 'Начало' }, { node: 'zz', say: 'нет такого' }] })
  assert.equal(good.ok, true)
  assert.deepEqual(good.value.nodes.map((n) => `${n.id}:${n.kind}`), ['a:box', 'b:diamond', 'n3:box'])
  // A stop at a node the diagram lacks is dropped, the rest of the walk kept.
  assert.deepEqual(good.value.tour, [{ node: 'a', say: 'Начало' }])
  assert.match(parseDiagram({ nodes: [] }).reason, /no nodes/)
  assert.match(parseDiagram({ nodes: [{ id: 'a', text: 'x' }, { id: 'a', text: 'y' }] }).reason, /twice/)
  assert.match(parseDiagram({ nodes: [{ id: 'a', text: 'x' }], edges: [{ from: 'a', to: 'b' }] }).reason, /does not join/)
  assert.match(parseDiagram({ nodes: Array.from({ length: 41 }, (_, i) => ({ text: `n${i}` })) }).reason, /at most 40/)
  assert.equal(parseCanvasTool('canvas_draw', { nodes: [{ text: 'x' }] }).value.op, 'draw')
})

// Excalidraw's own element shapes, as the window holds them.
const scene = [
  { id: 'r1', type: 'rectangle', x: 0, y: 0, width: 200, height: 80, customData: { fabricId: 'pay' } },
  { id: 't1', type: 'text', containerId: 'r1', text: 'Оплата картой', x: 10, y: 10, width: 100, height: 20 },
  { id: 'r2', type: 'rectangle', x: 300, y: 0, width: 200, height: 80 },
  { id: 't2', type: 'text', containerId: 'r2', text: 'Оплата', x: 310, y: 10, width: 100, height: 20 },
  { id: 'n1', type: 'rectangle', x: 0, y: 200, width: 200, height: 80 },
  { id: 't3', type: 'text', containerId: 'n1', text: 'Проверить цену', x: 0, y: 0, width: 1, height: 1 },
  { id: 'free', type: 'text', text: 'Заметка на полях', x: 600, y: 0, width: 120, height: 20 },
  { id: 'gone', type: 'rectangle', isDeleted: true, x: 0, y: 0, width: 1, height: 1 },
  { id: 'r3', type: 'ellipse', x: 0, y: 400, width: 100, height: 100 },
  { id: 't4', type: 'text', containerId: 'r3', text: 'Счёт', x: 0, y: 0, width: 1, height: 1 },
  { id: 'r4', type: 'ellipse', x: 200, y: 400, width: 100, height: 100 },
  { id: 't5', type: 'text', containerId: 'r4', text: 'Счёт', x: 0, y: 0, width: 1, height: 1 }
]

test('an element is found by the agent\'s id, its id, its words, or the only shortest words containing the name', () => {
  const els = liteElements(scene)
  assert.equal(els.some((e) => e.id === 'gone' || e.id === 't1'), false, 'deleted and bound texts are not elements of their own')
  assert.equal(els.find((e) => e.id === 'r1').text, 'Оплата картой')
  assert.deepEqual(resolveRef(els, 'pay'), { ok: true, id: 'r1' })
  assert.deepEqual(resolveRef(els, 'r2'), { ok: true, id: 'r2' })
  assert.deepEqual(resolveRef(els, '«оплата»'), { ok: true, id: 'r2' }, 'words said in full win over words contained')
  assert.deepEqual(resolveRef(els, 'цену'), { ok: true, id: 'n1' })
  assert.deepEqual(resolveRef(els, 'заметка'), { ok: true, id: 'free' })
  // ё and е are one letter to the ear.
  assert.deepEqual(resolveRef(els, 'проверить цену').ok, true)
  // Two elements say the same words: both named back, neither guessed.
  const twice = resolveRef(els, 'счет')
  assert.equal(twice.ok, false)
  assert.deepEqual(twice.candidates, ['Счёт', 'Счёт'])
  const none = resolveRef(els, 'доставка')
  assert.equal(none.ok, false)
  assert.ok(none.candidates.includes('Оплата картой'))
})

test('what the canvas holds is read as names, kinds and words', () => {
  const s = summarize(liteElements(scene))
  assert.deepEqual(s[0], { name: 'pay', kind: 'rectangle', text: 'Оплата картой' })
  assert.equal(s.length, 6)
})

const overlaps = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

test('a diagram is laid out left to right by its links, with no two nodes overlapping', () => {
  const d = parseDiagram({ nodes: [{ id: 'a', text: 'Звонок' }, { id: 'b', text: 'Голос' }, { id: 'c', text: 'CEO' }, { id: 'd', text: 'Проектировщик' },
    { id: 'e', text: 'Канвас, на котором проектировщик рисует схему и заметки по просьбе владельца' }, { id: 'f', text: 'Одинокая заметка', kind: 'note' }],
  edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'b', to: 'd' }, { from: 'd', to: 'e' }, { from: 'e', to: 'b' }] }).value
  const p = layoutDiagram(d, { x: 100, y: 50 })
  assert.equal(p.size, 6)
  assert.ok(p.get('a').x < p.get('b').x && p.get('b').x < p.get('c').x, 'a link runs left to right')
  assert.equal(p.get('c').x, p.get('d').x, 'two nodes one link from the same node share a column')
  assert.ok(p.get('d').x < p.get('e').x)
  assert.equal(p.get('a').x, 100, 'the first column starts at the origin')
  const all = [...p.values()]
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) assert.equal(overlaps(all[i], all[j]), false, `${i} and ${j} overlap`)
  assert.ok(p.get('e').height > p.get('a').height, 'a longer text takes more lines')
})

test('new things go to the right of what the canvas holds', () => {
  assert.deepEqual(originBeside([]), { x: 0, y: 0 })
  assert.deepEqual(originBeside(liteElements(scene)), { x: 880, y: 0 })
})

test('a diagram becomes labelled shapes and arrows bound to them, each id unique to the drawing', () => {
  const d = parseDiagram({ nodes: [{ id: 'a', text: 'A', kind: 'note' }, { id: 'b', text: 'B', group: 'g' }, { id: 'c', text: 'C', kind: 'text' }], edges: [{ from: 'a', to: 'b', label: 'x' }] }).value
  const s = diagramSkeletons(d, layoutDiagram(d), 'k1')
  assert.deepEqual(s.map((e) => e.type), ['rectangle', 'rectangle', 'text', 'arrow'])
  assert.equal(s[0].backgroundColor, canvas.NOTE_FILL)
  assert.deepEqual(s[0].label, { text: 'A', fontSize: canvas.LABEL_SIZE })
  assert.deepEqual(s[0].customData, { fabricId: 'a' })
  assert.deepEqual(s[3].start, { id: 'fx-k1-a' })
  assert.deepEqual(s[3].end, { id: 'fx-k1-b' })
  assert.deepEqual(s[3].label, { text: 'x', fontSize: 16 })
  // A link to an element already on the canvas binds to that element's own id.
  const add = parseDiagram({ nodes: [{ id: 'z', text: 'Z' }], edges: [] }).value
  add.edges.push({ from: 'pay', to: 'z' })
  const s2 = diagramSkeletons(add, layoutDiagram(add), 'k2', new Map([['pay', 'r1']]))
  assert.deepEqual(s2[1].start, { id: 'r1' })
  assert.deepEqual(s2[1].end, { id: 'fx-k2-z' })
})

test('the call is told where each kind of request goes, and its tools are the canvas\'s nine', () => {
  const names = canvasVoiceTools().map((t) => t.name)
  assert.deepEqual(names, ['canvas_open', 'canvas_read', 'canvas_add', 'canvas_connect', 'canvas_focus', 'canvas_highlight', 'canvas_remove', 'canvas_draw', 'canvas_design'])
  for (const t of canvasVoiceTools()) {
    assert.equal(t.parameters.type, 'object')
    assert.equal(t.parameters.additionalProperties, false)
    // Every tool the call may name parses with its required arguments filled.
    const args = Object.fromEntries(t.parameters.required.map((k) => [k, k === 'nodes' ? [{ text: 'x' }] : 'x']))
    assert.equal(parseCanvasTool(t.name, args).ok, true, t.name)
  }
  for (const locale of ['ru', 'en']) {
    const words = canvasInstructions(locale)
    for (const n of ['ask_ceo', 'canvas_design', 'canvas_highlight', 'canvas_add']) assert.ok(words.includes(n), `${locale}: ${n}`)
    assert.equal(words.includes('—'), false, 'no em dash in what the voice is told')
  }
})

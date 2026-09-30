import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import path from 'node:path'
import {renderProduct} from '../product/renderers.mjs'

// THE PROTOTYPE OFFERED A STATE IT DID NOT DRAW. `#state-select` lists «Пусто» for every
// screen, and selecting it returned the POPULATED screen on 66 of 72 views — measured
// 2026-09-12 by walking 72 views × 7 states in a browser. The cause was one dispatch line:
// only `denied` and `loading` routed to the generic body, and every module renderer below
// it carries its own list of states it honours, none of which lists `empty`. A reviewer
// asking "what does this look like before there is any data" was shown data.
//
// This drives the real renderer, not a copy of the rule (R-007): the same function the
// report generator calls, with the same model and fixtures.

const root = path.resolve(import.meta.dirname, '..', '..')
const model = JSON.parse(readFileSync(path.join(root, 'docs/ux/product-model.json'), 'utf8'))
const fixtures = JSON.parse(readFileSync(path.join(root, 'docs/ux/product-fixtures.json'), 'utf8'))

const text = html => String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const render = (view, state) => text(renderProduct(view, {project: 'atlas', ...state}, model, fixtures))

test('every view draws an empty state, and it is not the populated screen', () => {
  const same = []
  const thin = []
  for (const view of model.views) {
    const ready = render(view.id, {})
    const empty = render(view.id, {state: 'empty'})
    if (empty === ready) same.push(view.id)
    else if (empty.length < 40) thin.push(`${view.id} (${empty.length} chars)`)
  }
  assert.deepEqual(same, [], `${same.length} view(s) return the populated screen for the empty state: ${same.slice(0, 8).join(', ')}`)
  assert.deepEqual(thin, [], `view(s) whose empty state renders almost nothing: ${thin.join(', ')}`)
})

test('the empty state says what will appear here, using the action the model already carries', () => {
  // 63 of 72 views declare `empty_action`. Where one exists its description must reach the
  // screen — the data was in the model the whole time the screens were showing fixtures.
  // Four screens have empty states written for them rather than generated, and the
  // renderer excludes exactly these four. They are checked separately below.
  const BESPOKE = new Set(['estate', 'onboarding', 'project', 'search'])
  const missing = []
  for (const view of model.views) {
    if (BESPOKE.has(view.id)) continue
    const action = view.empty_action
    if (!action?.description) continue
    const empty = render(view.id, {state: 'empty'})
    if (!empty.includes(action.description.slice(0, 40))) missing.push(view.id)
  }
  assert.deepEqual(missing.slice(0, 6), [], `${missing.length} view(s) drop their declared empty_action: ${missing.slice(0, 6).join(', ')}`)
})

test('the four bespoke empty states are written, not generated', () => {
  for (const id of ['estate', 'onboarding', 'project', 'search']) {
    const empty = render(id, {state: 'empty'})
    assert(empty.length > 40, `${id} renders almost nothing for its empty state`)
    assert(!empty.includes('В выбранной области пока нет записей'),
      `${id} is listed as bespoke but fell through to the generic empty state`)
  }
})

test('a screen that owns a bespoke empty state keeps it', () => {
  // estate is the first screen a new operator sees; its empty state is written, not generic.
  const estate = render('estate', {state: 'empty'})
  assert.match(estate, /появится свой проект/, 'estate lost its own empty state to the generic one')
  assert(!estate.includes('В выбранной области пока нет записей'), 'estate fell back to the generic empty state')
})

test('a table label is not cut in half by the wrapping rule', () => {
  // `overflow-wrap: anywhere` on th/td also shrinks a column below its longest word, which
  // rendered «Установлен» as «Установ / лен» in a 76px column. `break-word` still breaks a
  // token that cannot fit alone, so long ids stay contained.
  const css = readFileSync(path.join(root, 'scripts/product/report.css'), 'utf8')
  const rule = css.match(/th,td \{[^}]*\}/)
  assert(rule, 'the th,td rule is gone; this check no longer has a subject')
  assert(!/overflow-wrap:\s*anywhere/.test(rule[0]),
    'th,td is back to overflow-wrap: anywhere, which breaks ordinary words mid-word')
  assert(/overflow-wrap:\s*break-word/.test(rule[0]),
    'th,td must still break a token that cannot fit on its own line')
})

// A RECEIPT'S LINE NUMBER IS PART OF ITS CLAIM, and it was being reported as moved and then
// discarded: `repin-mockup-receipts.mjs` mutated the parsed object and wrote back a fresh
// parse of the raw string, so SRC-02 was printed "MOVED 658 → 671" and stayed at 658. The
// next change to that file then refused all over again, blaming an edit nobody had made.
// This is the invariant that makes the loss visible instead of merely annoying.
test('every mockup receipt cites a line that still names its symbol', () => {
  const matrix = JSON.parse(readFileSync(
    path.join(root, 'docs/evidence/plans/2026-09-07-mockup-completeness/resolution-matrix.json'), 'utf8'))
  const files = new Map()
  const wrong = []
  for (const row of matrix.rows ?? [])
    for (const receipt of row.evidence ?? []) {
      if (!receipt.symbol || !receipt.line || !receipt.file) continue
      if (!files.has(receipt.file)) {
        try { files.set(receipt.file, readFileSync(path.join(root, receipt.file), 'utf8').split('\n')) }
        catch { files.set(receipt.file, null) }
      }
      const lines = files.get(receipt.file)
      if (!lines) continue                       // a file outside this tree is another check's subject
      const at = lines[receipt.line - 1]
      if (at === undefined || !at.includes(receipt.symbol))
        wrong.push(`${row.id}: ${receipt.file}:${receipt.line} no longer holds «${receipt.symbol}»`)
    }
  assert.deepEqual(wrong, [], `${wrong.length} receipt(s) point at the wrong line:\n  ${wrong.slice(0, 6).join('\n  ')}`)
})

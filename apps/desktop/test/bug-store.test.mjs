// The local bug store (W4 of the quality waves, wave 1): one row per fingerprint, counted; bounded; never throws.
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, readFileSync, statSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'

const { createBugStore, BUG_ROWS, BUG_MAX_AGE_MS } = await import(path.resolve(import.meta.dirname, '../src/main/bugStore.ts'))
const dir = () => mkdtempSync(path.join(tmpdir(), 'fabric-bugs-'))
const fail = (msg, fn = 'readRow') => { const e = new Error(msg); e.stack = `Error: ${msg}\n    at ${fn} (/x/a.js:1:1)\n    at pass (/x/b.js:2:2)`; return e }

test('a thousand repeats of one bug are one row with its count, versions and newest correlation', () => {
  const s = createBugStore(path.join(dir(), 'bugs.json'))
  for (let i = 0; i < 1000; i++) s.record({ cls: 'error', code: 'board.rpc', error: fail(`row ${i} of /Users/u${i}/f.json`), version: i < 500 ? '0.3.20' : '0.3.21', correlationId: `c${i}` })
  const rows = s.rows()
  assert.equal(rows.length, 1)
  assert.equal(rows[0].count, 1000)
  assert.deepEqual(rows[0].versions, ['0.3.20', '0.3.21'])
  assert.equal(rows[0].lastCorrelationId, 'c999')
  assert.ok(!rows[0].messageTemplate.includes('/Users'))
})

test('bounded: old rows go, then the rarest, at most BUG_ROWS', () => {
  let t = Date.parse('2026-11-01T00:00:00Z')
  const s = createBugStore(path.join(dir(), 'bugs.json'), () => t)
  s.record({ cls: 'error', code: 'old', error: fail('old', 'oldFn'), version: '1' })
  t += BUG_MAX_AGE_MS + 1
  for (let i = 0; i <= BUG_ROWS; i++) s.record({ cls: 'error', code: `c${i}`, error: fail('x', `fn${i}`), version: '1' })
  s.record({ cls: 'error', code: 'c5', error: fail('x', 'fn5'), version: '1' })
  const codes = s.rows().map((r) => r.code)
  assert.equal(codes.length, BUG_ROWS)
  assert.ok(!codes.includes('old'))
  assert.ok(codes.includes('c5'), 'a repeated bug outlives a rarer one')
})

test('written 0600, read back, and a corrupt or unwritable file never throws', () => {
  const d = dir(), f = path.join(d, 'bugs.json')
  const s = createBugStore(f)
  s.record({ cls: 'crash', code: 'crash.gpu', error: new Error('crashed'), version: '1' })
  assert.equal(s.flush(), true)
  assert.equal(s.flush(), false, 'nothing changed')
  assert.equal(statSync(f).mode & 0o777, 0o600)
  assert.equal(createBugStore(f).rows()[0].code, 'crash.gpu')
  writeFileSync(f, '{not json')
  assert.doesNotThrow(() => createBugStore(f))
  const ro = path.join(d, 'ro'); mkdirSync(ro); chmodSync(ro, 0o500)
  const r = createBugStore(path.join(ro, 'bugs.json'))
  r.record({ cls: 'error', code: 'x', error: 'a string', version: '1' })
  assert.equal(r.flush(), false)
  chmodSync(ro, 0o700)
})

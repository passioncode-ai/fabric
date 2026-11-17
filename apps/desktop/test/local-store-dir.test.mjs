// ADR-0195 W2b: a local store reads the data folder its process's entry named, so the board's own process can read the
// same settings without Electron. Spec: docs/evidence/specs/2026-11-04-on-demand-sessions.md §3.14.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'

const file = path.resolve(import.meta.dirname, '../src/main/localStore.ts')
const { localStore, setLocalStoreDir, LocalStoreDirUnset } = await import(file)

const valid = (v) => (v && typeof v === 'object' && typeof v.n === 'number' ? v : null)

test('the module imports no Electron, so a plain Node process can load it', () => {
  assert.doesNotMatch(readFileSync(file, 'utf8'), /from 'electron'/)
})

test('a store read before its process named the data folder says so by name, never reads as empty', () => {
  const store = localStore('w2b-unset.json', { n: 0 }, valid)
  assert.throws(() => store.read(), (e) => e instanceof LocalStoreDirUnset && /w2b-unset\.json/.test(e.message))
})

test('once named, every store reads and writes in that folder, resolved at each call', (t) => {
  const a = mkdtempSync(path.join(tmpdir(), 'fabric-w2b-a-'))
  const b = mkdtempSync(path.join(tmpdir(), 'fabric-w2b-b-'))
  t.after(() => { rmSync(a, { recursive: true, force: true }); rmSync(b, { recursive: true, force: true }) })
  let dir = a
  setLocalStoreDir(() => dir)
  const store = localStore('w2b.json', { n: 0 }, valid)
  assert.equal(store.read().value.n, 0)
  assert.equal(store.write({ n: 7 }).status, 'committed')
  assert.equal(JSON.parse(readFileSync(path.join(a, 'w2b.json'), 'utf8')).n, 7)
  dir = b
  assert.equal(store.read().value.n, 0, 'a folder changed after the store was made is the one read')
})

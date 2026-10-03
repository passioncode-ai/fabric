// Unsaved editor work survives a quit, a signal and a crash (ADR-0106 amendment, LC-01/LC-12).
// Real files in a temp directory; no Electron.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createEditorRecovery } from '../src/main/editorRecovery.ts'

const fresh = () => mkdtempSync(path.join(tmpdir(), 'fabric-recovery-'))

test('a kept buffer is read back for its own path, owner-only, and discarded with null', () => {
  const dir = path.join(fresh(), 'editor-recovery')
  const r = createEditorRecovery({ dir, now: () => Date.parse('2026-10-03T12:00:00Z') })
  assert.deepEqual(r.keep('/repo/a.ts', 'let a = 1', 'h1'), { kept: true })
  const back = r.read('/repo/a.ts')
  assert.equal(back.content, 'let a = 1'); assert.equal(back.baseHash, 'h1'); assert.equal(back.at, '2026-10-03T12:00:00.000Z')
  assert.equal(r.read('/repo/b.ts'), null)
  const file = path.join(dir, readdirSync(dir)[0])
  assert.equal(statSync(file).mode & 0o777, 0o600)
  assert.equal(statSync(dir).mode & 0o777, 0o700)
  assert.ok(!readdirSync(dir)[0].includes('repo'), 'the record is named by a hash of the path, never the path itself')
  r.keep('/repo/a.ts', null, 'h1')
  assert.equal(r.read('/repo/a.ts'), null)
})

test('a buffer over the cap is not kept, and an older kept copy of it is removed', () => {
  const dir = fresh()
  const r = createEditorRecovery({ dir, maxBytes: 10 })
  r.keep('/x', 'small', 'h')
  assert.deepEqual(r.keep('/x', 'x'.repeat(11), 'h'), { kept: false, reason: 'too_large' })
  assert.equal(r.read('/x'), null, 'a stale smaller copy must not be offered as the latest')
})

test('the store is bounded by count and by age, and leftover temp files are swept', () => {
  const dir = fresh()
  let clock = 1_000_000
  const r = createEditorRecovery({ dir, maxFiles: 3, maxAgeMs: 1000, now: () => clock })
  for (let i = 0; i < 5; i++) { r.keep('/f' + i, 'c' + i, 'h'); const f = readdirSync(dir).map((n) => path.join(dir, n)); for (const x of f) utimesSync(x, new Date(), new Date(Date.now() + i)) }
  assert.ok(readdirSync(dir).filter((n) => n.endsWith('.json')).length <= 3)
  writeFileSync(path.join(dir, 'x.json.123.tmp'), 'partial')
  clock = Date.now() + 10_000
  r.sweep()
  assert.deepEqual(readdirSync(dir), [], 'old records and temp leftovers outlived the sweep')
  rmSync(dir, { recursive: true, force: true })
})

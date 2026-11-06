// DEC-0153 (CO-503): Fabric's folds against the contract's own vectors, pinned with their source in
// fixtures/fabric-agent-contract-ops-digest/SOURCE.json (tag v0.1.0+2026-11-06.1). The copy is checked byte for byte.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const dir = path.resolve(import.meta.dirname, 'fixtures/fabric-agent-contract-ops-digest')
const { foldHour, foldDay } = await import(path.resolve(import.meta.dirname, '../src/shared/opsDigest.ts'))
const source = JSON.parse(readFileSync(path.join(dir, 'SOURCE.json'), 'utf8'))
const bytes = readFileSync(path.join(dir, 'ops-digest.json'))
const vectors = JSON.parse(bytes.toString('utf8'))

test('the pinned vectors are the bytes the source receipt names', () => {
  assert.equal(createHash('sha256').update(bytes).digest('hex'), source.files[0].sha256)
})

for (const v of vectors.hour) {
  test(`hour: ${v.name}`, () => {
    const counts = new Map()
    for (const c of v.input.counts) {
      const s = counts.get(c.op) ?? { ok: 0, failed: 0, unknown: 0 }
      s.ok += c.ok; s.failed += c.failed; s.unknown += c.unknown
      counts.set(c.op, s)
    }
    assert.deepEqual(foldHour(counts, Date.parse(v.input.from), v.input.previous), v.expected)
  })
}

for (const v of vectors.day) {
  test(`day: ${v.name}`, () => {
    assert.deepEqual(foldDay(v.input.day, v.input.hourly), v.expected)
  })
}

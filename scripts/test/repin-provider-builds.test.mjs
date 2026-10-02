// The re-pin refuses to carry a verdict forward and edits exactly what it names (REQ-19).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { repinSource } from '../lib/repin-provider-builds.mjs'

const SRC = readFileSync(new URL('../../apps/desktop/src/shared/providerCapabilityMatrix.ts', import.meta.url), 'utf8')
const pinnedOf = (s) => Object.fromEntries([...s.matchAll(/\n\s*'(claude-code|codex-cli)': '([0-9.]+)'/g)].slice(0, 2).map((m) => [m[1], m[2]]))
const pinned = pinnedOf(SRC)
const unverified = Object.entries(pinned).map(([provider, cliBuild]) => ({ provider, cliBuild, status: 'unverified' }))

test('re-pins a version-only provider and dates the observation', () => {
  const r = repinSource(SRC, { pinned, rows: unverified }, { 'claude-code': '9.9.9' }, '2026-10-03')
  assert.equal(r.ok, true)
  assert.deepEqual(r.changed, [`claude-code ${pinned['claude-code']} → 9.9.9`])
  assert.equal(pinnedOf(r.source)['claude-code'], '9.9.9')
  assert.equal(pinnedOf(r.source)['codex-cli'], pinned['codex-cli'], 'the other provider is untouched')
  assert.match(r.source, /checkedAt: '2026-10-03',/)
  assert.match(r.source, /version-only observation, 2026-10-03\)/)
  assert.match(r.source, /Measured with `claude --version` \/ `codex --version`, 2026-10-03 \(claude-code .* → 9\.9\.9; re-pinned by/)
})

test('refuses when a current row holds a verified verdict', () => {
  const rows = [...unverified, { provider: 'claude-code', cliBuild: pinned['claude-code'], status: 'supported' }]
  const r = repinSource(SRC, { pinned, rows }, { 'claude-code': '9.9.9' }, '2026-10-03')
  assert.equal(r.ok, false)
  assert.match(r.reason, /verified row/)
})

test('changes nothing when the pins already match', () => {
  const r = repinSource(SRC, { pinned, rows: unverified }, { ...pinned }, '2026-10-03')
  assert.deepEqual(r, { ok: true, source: SRC, changed: [] })
})

test('refuses a file whose shape it does not recognise rather than half-editing it', () => {
  const r = repinSource(SRC.replace(/checkedAt: '\d{4}-\d{2}-\d{2}',/, "checkedAt: AT,"), { pinned, rows: unverified }, { 'claude-code': '9.9.9' }, '2026-10-03')
  assert.equal(r.ok, false)
  assert.match(r.reason, /found 0 times/)
})

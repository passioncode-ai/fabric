// Verification 0.3.2 iteration 1, DO-6: a window whose renderer died comes back, but not in a loop.
import assert from 'node:assert/strict'
import test from 'node:test'
import { RELOAD_LIMIT, RELOAD_WINDOW_MS, shouldReload } from '../src/main/rendererRecovery.ts'

const now = 1_000_000
test('a crashed or killed renderer is reloaded', () => {
  for (const reason of ['crashed', 'killed', 'oom', 'abnormal-exit', 'launch-failed'])
    assert.equal(shouldReload({ reason, quitting: false, recentReloads: [], now }), true, reason)
})
test('a clean exit and a quitting app reload nothing', () => {
  assert.equal(shouldReload({ reason: 'clean-exit', quitting: false, recentReloads: [], now }), false)
  assert.equal(shouldReload({ reason: 'crashed', quitting: true, recentReloads: [], now }), false)
})
test('a renderer that keeps dying is left alone after the limit; old reloads age out', () => {
  const recent = Array.from({ length: RELOAD_LIMIT }, (_, i) => now - i * 1000)
  assert.equal(shouldReload({ reason: 'crashed', quitting: false, recentReloads: recent, now }), false)
  const old = recent.map((t) => t - RELOAD_WINDOW_MS)
  assert.equal(shouldReload({ reason: 'crashed', quitting: false, recentReloads: old, now }), true)
})

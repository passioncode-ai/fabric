// Project display names (the mockup parity, 2026-10-27, rail gap 15): read at most once per TTL, and a read that fails
// keeps the last names it had (the 0.3.15 review, iteration 1, ER-6), never turning them back into slugs.
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

const { createDisplayNameReader, TTL_MS } = await import(path.resolve(import.meta.dirname, '../src/main/projectNames.ts'))

function fakeStore() {
  const state = { fail: false, reads: 0 }
  const store = {
    select() {
      const q = {
        eq: () => q,
        limit: () => q,
        then: (ok, bad) => {
          state.reads++
          return Promise.resolve(state.fail ? { data: null, error: { message: 'database away' } } : { data: [{ id: 'p1', name: 'research-agent' }], error: null }).then(ok, bad)
        }
      }
      return q
    },
    selectIn: async () => ({ rows: [{ project_id: 'p1', path: '/x/research-agent', remote_key: null }], failed: null })
  }
  return { store, state }
}

const descriptors = () => [{ id: 'research-agent', instance: 'default', name: 'Research Agent', repository: null }]

test('ER-6: a failed read past the TTL keeps the last names and says why; with none kept it throws', async () => {
  const { store, state } = fakeStore()
  let clock = 0
  const reader = createDisplayNameReader(store, descriptors, () => clock)
  assert.equal((await reader.read()).p1.name, 'Research Agent')
  await reader.read()
  assert.equal(state.reads, 1, 'read once within the TTL')
  clock += TTL_MS + 1
  state.fail = true
  const heard = []
  assert.equal((await reader.read((e) => heard.push(String(e)))).p1.name, 'Research Agent')
  assert.match(heard[0], /database away/)
  const fresh = createDisplayNameReader(store, descriptors, () => 0)
  await assert.rejects(fresh.read(), /database away/)
})

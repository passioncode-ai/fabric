// ADR-0195 decision 5, wave W1: the hub's four ports over the window's process (`main/hubPorts.ts`). Spec:
// docs/evidence/specs/2026-11-04-on-demand-sessions.md §3.13. No database, no terminals: every port's source is a stand-in.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'

const { windowHubPorts } = await import(path.resolve(import.meta.dirname, '../src/main/hubPorts.ts'))

const settings = (status, value) => () => ({ status, revision: 'r', value: { locale: 'ru', agentLanguage: true, machineTrust: 'mine', ...value } })
const ports = (over = {}) => windowHubPorts({
  ptys: () => undefined,
  sweep: () => null,
  readSettings: settings('ready', {}),
  registry: { snapshot: () => ({ entries: [], problems: [] }) },
  ...over
})

test('before the terminal manager exists the terminals port answers nothing, not an empty list', () => {
  assert.equal(ports().terminals(), undefined)
  const manager = { get: () => null, list: () => [], runnerOf: () => null }
  assert.equal(ports({ ptys: () => manager }).terminals(), manager)
})

test('before the sweep starts no answer carries nudges; once it runs its queue answers', () => {
  const p = ports()
  assert.deepEqual(p.sweep.takeNudges('s', 'p'), [])
  assert.deepEqual(p.sweep.showTurnNudges('s', 'p', 'k'), [])
  const calls = []
  const sweep = {
    takeNudges: (...a) => { calls.push(['take', ...a]); return ['claim it'] },
    showTurnNudges: (...a) => { calls.push(['show', ...a]); return [{ kind: 'k', says: 'x' }] }
  }
  const live = ports({ sweep: () => sweep })
  assert.deepEqual(live.sweep.takeNudges('s1', 'p1'), ['claim it'])
  assert.deepEqual(live.sweep.showTurnNudges('s1', 'p1', 't1'), [{ kind: 'k', says: 'x' }])
  assert.deepEqual(calls, [['take', 's1', 'p1'], ['show', 's1', 'p1', 't1']])
})

test('settings: the working language and the trust read; an unreadable file names neither', () => {
  const ok = ports()
  assert.equal(ok.settings.machineTrust(), 'mine')
  assert.equal(typeof ok.settings.language(), 'string')
  const off = ports({ readSettings: settings('ready', { agentLanguage: false }) })
  assert.equal(off.settings.language(), null)
  const unreadable = ports({ readSettings: settings('unreadable', {}) })
  assert.equal(unreadable.settings.machineTrust(), null)
  assert.equal(unreadable.settings.language(), null)
})

test('settings are read at each call, never kept from the first', () => {
  let trust = 'mine'
  const p = ports({ readSettings: () => ({ status: 'ready', revision: 'r', value: { locale: 'ru', agentLanguage: true, machineTrust: trust } }) })
  assert.equal(p.settings.machineTrust(), 'mine')
  trust = 'organization'
  assert.equal(p.settings.machineTrust(), 'organization')
})

test('the registry port reads the registry at each call', () => {
  let reads = 0
  const p = ports({ registry: { snapshot: () => { reads++; return { entries: [], problems: [] } } } })
  p.registry.machineAgents()
  p.registry.machineAgents()
  assert.equal(reads, 2)
})

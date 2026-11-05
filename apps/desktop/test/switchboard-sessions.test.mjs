// CO-457: Switchboard's sessions and limit stops, read-only and merged as Fabric Dashboards merges them. No Switchboard
// runs here: `run` answers what Switchboard 0.7.2 prints (`--json sessions --all`, `--json recovery`).
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'

const { readSwitchboardSessions } = await import(path.resolve(import.meta.dirname, '../src/main/switchboardSessions.ts'))

const NOW = Date.parse('2026-11-02T12:00:00Z')
const s = (t) => Math.floor(t / 1000)
const SESSIONS = { data: { sessions: [
  { account_id: 'acc-1', agent: 'claude-code', label: 'work@example.com', provider: 'claude', pool: 'agents', mode: 'managed', state: 'running', in_place: false,
    launched_at: s(NOW - 600_000), started_at: s(NOW - 590_000), working_directory: '/Users/example/DATA/atlas', home: 'runtimes' },
  // Ended two days ago: older than a day, so not listed.
  { account_id: 'acc-2', agent: 'codex', label: 'old@example.com', provider: 'codex', pool: 'default', mode: 'isolated', state: 'ended', in_place: true,
    launched_at: s(NOW - 2 * 86_400_000), started_at: s(NOW - 2 * 86_400_000), working_directory: '/Users/example/DATA/old', home: 'homes' },
  { working_directory: 'relative/path', state: 'running' }
] } }
const RECOVERY = { data: { coverage: 'registered_sessions_only', sessions: [
  { stop: { event: 'cc-a1-1793600000', session: 'a1', directory: '/Users/example/DATA/beta', provider: 'claude', state: 'waiting', kind: 'limit', stopped_at: s(NOW - 3_600_000), attempt: 1, account: 'acc-1' },
    ready: false, candidates: [], probe_at: s(NOW + 1_800_000), reason: 'no_account' },
  { stop: { event: 'cc-b2-1793600001', session: 'b2', directory: '/Users/example/DATA/gamma', provider: 'claude', state: 'resumed', kind: 'limit', stopped_at: s(NOW - 3_600_000), attempt: 1 },
    ready: true, candidates: ['acc-1'] }
] } }

const runner = (answers) => async (_file, args) => {
  const a = answers[args.join(' ')]
  if (a instanceof Error) throw a
  return a ?? { code: 1, stdout: '', stderr: 'unknown command' }
}
const ok = (data) => ({ code: 0, stdout: JSON.stringify(data), stderr: '' })

test('CO-457: a session running in a terminal and a stop waiting until its probe, as Dashboards lists them', async () => {
  const r = await readSwitchboardSessions({ find: async () => '/usr/local/bin/switchboard', now: NOW,
    run: runner({ '--json sessions --all': ok(SESSIONS), '--json recovery': ok(RECOVERY) }) })
  assert.equal(r.installed, true)
  assert.deepEqual(r.unread, [])
  const running = r.rows.find((x) => x.state === 'running-terminal')
  assert.equal(running.project, 'atlas')
  assert.equal(running.account, 'work@example.com')
  const waiting = r.rows.find((x) => x.state === 'waiting-reset')
  assert.equal(waiting.project, 'beta')
  assert.equal(waiting.expectedAt, NOW + 1_800_000, '«до HH:MM» comes from probe_at')
  assert.equal(waiting.account, 'work@example.com', 'the stopped account named by its label')
  assert.equal(waiting.waitReason, 'no_account')
  assert.equal(r.rows.some((x) => x.project === 'old'), false, 'an ended session older than a day is not listed')
  assert.equal(r.rows.some((x) => x.project === 'gamma'), false, 'a finished stop (resumed) is not a stop')
})

test('CO-457: without Switchboard nothing is listed and nothing failed; a source that fails is named, the other still listed', async () => {
  assert.deepEqual(await readSwitchboardSessions({ find: async () => null, now: NOW, run: runner({}) }), { installed: false, rows: [], unread: [] })
  const r = await readSwitchboardSessions({ find: async () => '/sb', now: NOW,
    run: runner({ '--json sessions --all': ok(SESSIONS), '--json recovery': new Error('spawn ETIMEDOUT') }) })
  assert.deepEqual(r.unread, [{ source: 'recovery', reason: 'spawn ETIMEDOUT' }])
  assert.ok(r.rows.some((x) => x.state === 'running-terminal'))
  const garbled = await readSwitchboardSessions({ find: async () => '/sb', now: NOW,
    run: runner({ '--json sessions --all': { code: 0, stdout: 'not json', stderr: '' }, '--json recovery': ok(RECOVERY) }) })
  assert.deepEqual(garbled.unread.map((u) => u.source), ['sessions'])
})

test('CO-457: Fabric only reads: it never asks Switchboard to run a hand-over or claim a stop', async () => {
  const asked = []
  await readSwitchboardSessions({ find: async () => '/sb', now: NOW, run: async (_f, args) => { asked.push(args.join(' ')); return ok({ sessions: [] }) } })
  assert.deepEqual(asked.sort(), ['--json recovery', '--json sessions --all'])
})

// The CEO's access audit of 2026-11-20 (docs/reports/2026-11-20-ceo-access-audit/): a session started on a chosen
// Switchboard account (G1) and a wait for a session's answer (G2), through the real modules.
import assert from 'node:assert/strict'
import test from 'node:test'
import { accountsFor, findAccount, launchChoices, parseSpokenChoice } from '../src/shared/launchChoice.ts'
import { createLaunchAccounts, parseFolderPool, parseLaunchAccounts, switchboardLaunchArgs } from '../src/main/launchAccounts.ts'
import { createCeoOperations } from '../src/main/ceoTools.ts'
import { createConsoleOpen } from '../src/main/consoleOpen.ts'

const acct = (id, label, provider, pool, over = {}) => ({ id, label, provider, pool, enabled: true, elsewhere: false, assigned: false, leftPct: 50, resetsAt: null, ...over })
const ACCOUNTS = [
  acct('a1-0000-0000', 'work@example.com', 'claude', 'teamA', { leftPct: 30 }),
  acct('a2-0000-0000', 'home@example.com', 'claude', 'default', { leftPct: 80 }),
  acct('a3-0000-0000', 'other@example.com', 'claude', 'teamB', { leftPct: 90 }),
  acct('a4-0000-0000', 'off@example.com', 'claude', 'default', { enabled: false }),
  acct('a5-0000-0000', 'away@example.com', 'claude', 'default', { elsewhere: true }),
  acct('c1-0000-0000', 'codex@example.com', 'codex', 'default', { leftPct: null })
]

test('G1: an account serves its own agent, in its group\'s folders or anywhere from the default group, most room first', () => {
  assert.deepEqual(accountsFor('claude-code', 'teamA', ACCOUNTS).map((a) => a.label), ['home@example.com', 'work@example.com'])
  assert.deepEqual(accountsFor('claude-code', null, ACCOUNTS).map((a) => a.label), ['home@example.com'])
  assert.deepEqual(accountsFor('codex', 'teamA', ACCOUNTS).map((a) => a.label), ['codex@example.com'])
  assert.deepEqual(accountsFor('hermes', 'teamA', ACCOUNTS), [], 'an agent with no Switchboard provider takes no account')
  const c = launchChoices({ defaultRunner: 'codex', runners: [{ id: 'claude-code', label: 'Claude Code', installed: true }, { id: 'codex', label: 'Codex', installed: true }, { id: 'kilo', label: 'Kilo', installed: false }], pool: 'teamA', accounts: ACCOUNTS })
  assert.deepEqual(c.default, { runner: 'codex', account: null })
  assert.equal(c.options[0].label, 'Codex (default)', 'the default first')
  assert.ok(!c.options.some((o) => o.runner === 'kilo'), 'an agent not installed is not offered')
})

test('G1: an account is found by id, label or a word of it; the voice\'s «на Codex», «на аккаунте Y» are read', () => {
  assert.equal(findAccount('home', ACCOUNTS).found.id, 'a2-0000-0000')
  assert.equal(findAccount('a3-0000-0000', ACCOUNTS).found.label, 'other@example.com')
  assert.ok(findAccount('example', ACCOUNTS).ambiguous)
  assert.deepEqual(parseSpokenChoice('запусти в dissy на Codex'), { runner: 'codex' })
  assert.deepEqual(parseSpokenChoice('запусти в dissy на аккаунте home'), { account: 'home' })
  assert.deepEqual(parseSpokenChoice('start it on Claude Code on account work@example.com'), { runner: 'claude-code', account: 'work@example.com' })
})

test('G1: Switchboard\'s answers are read field by field, with no credential, and a folder\'s group from shell env', () => {
  const stdout = JSON.stringify({ data: { accounts: [
    { id: 'x1', provider: 'claude', label: 'one@example.com', pool: 'teamA', enabled: true, elsewhere: false, assigned_to: null, usage: { used_percent: 25, resets_at: 1795284000 } },
    { id: 'x2', provider: 'codex', label: '', pool: null, enabled: false, elsewhere: true, assigned_to: 'agent', usage: null }
  ] } })
  const list = parseLaunchAccounts(stdout)
  assert.deepEqual(list.map((a) => [a.id, a.label, a.pool, a.leftPct, a.enabled, a.elsewhere, a.assigned]), [['x1', 'one@example.com', 'teamA', 75, true, false, false], ['x2', 'x2', 'default', null, false, true, true]])
  assert.equal(list[0].resetsAt, new Date(1795284000 * 1000).toISOString())
  assert.equal(parseLaunchAccounts('not json'), null)
  assert.equal(parseFolderPool('teamA\torg:1\t/h/claude\t-\n'), 'teamA')
  assert.equal(parseFolderPool('none\n'), null)
  assert.deepEqual(switchboardLaunchArgs('x1', '/d/app', ['--model', 'opus']), ['launch', 'x1', '--in-place', '--working-directory', '/d/app', '--', '--model', 'opus'])
})

test('G1: the accounts read once a minute, and a failed read is said and tried again', async () => {
  let t = 0, calls = 0, fail = true
  const la = createLaunchAccounts(async () => { calls++; return fail ? { code: 1, stdout: '', stderr: 'down' } : { code: 0, stdout: JSON.stringify({ data: { accounts: [] } }), stderr: '' } }, () => t)
  assert.equal((await la.accounts()).ok, false)
  fail = false
  assert.equal((await la.accounts()).ok, true)
  await la.accounts()
  assert.equal(calls, 2, 'a good read is kept for a minute')
  t += 61_000
  await la.accounts()
  assert.equal(calls, 3)
})

function ops(over = {}) {
  const opened = []
  const consoles = new Map([['s1', { sessionId: 's1', projectId: 'p1', cwd: '/d/app', optionId: 'claude-code', state: 'running', running: true, startedAt: 'x', lastActivityAt: new Date(0).toISOString(), tail: '' }]])
  const deps = {
    ptys: { list: () => [...consoles.values()], get: (id) => consoles.get(id) ?? null, scrollbackOf: () => ({ text: 'done\r\n' }), write: () => {} },
    ceoSessionId: () => 'ceo',
    projects: async () => [{ id: 'p1', name: 'app', repo_path: '/d/app', default_agent: 'claude-code' }],
    admitFolder: async () => { throw new Error('no') },
    openConsole: async (projectId, runner, task, account) => { opened.push([projectId, runner, task, account]); return { sessionId: 'new', projectId, cwd: '/d/app', optionId: runner, state: 'starting', running: true } },
    stop: async () => ({ state: 'stopped' }), openWindow: () => {}, switchboard: async () => null, signal: () => {}, record: () => {}, note: () => {},
    sleep: over.sleep ?? (async () => {}), transcriptRoots: [], launches: async () => [], scratch: () => false,
    launchAccounts: { accounts: async () => ({ ok: true, accounts: ACCOUNTS, readAt: 0 }), folderPool: async () => ({ ok: true, pool: 'teamA' }) }
  }
  return { ops: createCeoOperations(deps), opened, consoles, deps }
}

test('G1: the CEO starts a session on a chosen account, and refuses one of another agent or group with the usable ones', async () => {
  const o = ops()
  const r = await o.ops.run('start', { project: 'app', task: 'go', account: 'work', reason: 'the owner asked' }, 'voice')
  assert.equal(r.ok, true)
  // The 0.3.28 review, iteration 2, DA-7: only the name before «@» is said (the answer reaches the voice and its journal).
  assert.equal(r.account, 'work@…')
  assert.equal(r.account_id, 'a1-0000-0000')
  assert.deepEqual(o.opened.at(-1), ['p1', 'claude-code', 'go', 'a1-0000-0000'])
  const wrongGroup = await o.ops.run('start', { project: 'app', task: 'go', account: 'other', reason: 'the owner asked' }, 'voice')
  assert.equal(wrongGroup.ok, false)
  assert.match(wrongGroup.reason, /belongs to the group teamB/)
  // Iteration 3, DA-16: a refusal offers the accounts by the name the CEO says and the id it passes back, never a label.
  assert.ok(wrongGroup.choices.some((c) => c.account === 'home@…' && c.id === 'a2-0000-0000'))
  const nobody = await o.ops.run('start', { project: 'app', task: 'go', account: 'nobody', reason: 'the owner asked' }, 'voice')
  const several = await o.ops.run('start', { project: 'app', task: 'go', account: 'example', reason: 'the owner asked' }, 'voice')
  assert.match(several.reason, /names several accounts/)
  for (const answer of [wrongGroup, nobody, several]) assert.doesNotMatch(JSON.stringify(answer), /@example\.com/)
  const bySaid = await o.ops.run('start', { project: 'app', task: 'go', account: 'work@…', reason: 'the owner asked' }, 'voice')
  assert.equal(bySaid.account_id, 'a1-0000-0000', 'the name the CEO says finds its account again')
  const wrongAgent = await o.ops.run('start', { project: 'app', runner: 'codex', task: 'go', account: 'work', reason: 'the owner asked' }, 'voice')
  assert.match(wrongAgent.reason, /needs a codex one/)
  const list = await o.ops.run('accounts', { project: 'app' }, 'voice')
  assert.deepEqual(list.accounts.map((x) => [x.runner, x.account]), [['claude-code', 'home@…'], ['claude-code', 'work@…'], ['codex', 'codex@…']])
})

test('G2: a wait answers once the console printed and went quiet, and says still working at its bound', async () => {
  let t = 1_000_000
  const o = ops({ sleep: async (ms) => { t += ms; if (t > 1_003_000) o.consoles.get('s1').lastActivityAt = new Date(1_003_000).toISOString() } })
  const realNow = Date.now
  Date.now = () => t
  try {
    const r = await o.ops.run('wait', { session_id: 's1', seconds: 30, quiet_seconds: 3 }, 'voice')
    assert.equal(r.state, 'answered')
    const o2 = ops({ sleep: async (ms) => { t += ms } })
    const r2 = await o2.ops.run('wait', { session_id: 's1', seconds: 5 }, 'voice')
    assert.equal(r2.state, 'still_working')
  } finally { Date.now = realNow }
})

test('G1: a console on an account is prepared with it and opened under the prepared id; never with the fallback order', async () => {
  const log = []
  const session = { sessionId: 'x', optionId: 'claude-code' }
  const open = createConsoleOpen({
    readProject: async () => ({ repo_path: '/d/app' }), folderHeld: () => false, home: () => '/Users/example',
    ptys: { open: async (...a) => { log.push(['open', a[6]]); return { ...session, sessionId: a[6] ?? 'x' } }, prepareLaunch: (id, extras) => log.push(['prepare', id, extras.account]), get: () => session, claimAttach: () => true, releaseAttach: () => {}, deliverWhenReady: async () => ({ state: 'written' }) },
    walk: async () => ({ state: 'exhausted', passedOver: [] }), unavailable: () => false, record: () => {}, failed: () => {}, syncPower: () => {}, delivered: () => {}, sleep: async () => {}
  })
  const s = await open('p1', 'claude-code', undefined, null, { switchboard: '/bin/switchboard', id: 'a1' })
  assert.deepEqual(log[0], ['prepare', s.sessionId, { switchboard: '/bin/switchboard', id: 'a1' }])
  assert.deepEqual(log[1], ['open', s.sessionId])
  await assert.rejects(open('p1', 'fallback-order', undefined, null, { switchboard: '/bin/switchboard', id: 'a1' }))
})

test('ADR-0203 §6: a voice start is written to the behaviour journal on the owner\'s word with its call, a read is not', async () => {
  const lines = []
  const o = ops()
  const withJournal = createCeoOperations({ ...o.deps, behaviour: { note: (e) => lines.push(e), read: () => ({ entries: lines, unreadable: 0 }) } })
  await withJournal.run('start', { project: 'app', task: 'go', reason: 'the owner asked' }, 'voice', 'call-7')
  await withJournal.run('sessions', {}, 'voice', 'call-7')
  assert.deepEqual(lines.map((l) => [l.actor.kind, l.actor.id, l.act, l.word.of, l.word.ref, l.decision]), [['voice', 'call-7', 'session.start', 'owner', 'call-7', 'done']])
  const read = await withJournal.run('journal', { call: 'call-7' }, 'console')
  assert.equal(read.ok, true)
  assert.equal(read.entries.length, 1)
})

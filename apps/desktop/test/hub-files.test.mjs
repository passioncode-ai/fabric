// hub.json and the door token (ADR-0115 §1), on a real filesystem: modes, atomic contents, rotation on
// every start, and removal only by the process that wrote them. Pure — no database, no Electron.
import { mkdtempSync, readFileSync, statSync, writeFileSync, existsSync, mkdirSync, rmSync, symlinkSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

const { publishHub, withdrawHub, hubPort, checkPortUnclaimed, DEFAULT_HUB_PORT, HUB_PROTOCOL, writeAtomic } = await import(path.resolve(import.meta.dirname, '../src/main/hub.ts'))

const mode = (f) => statSync(f).mode & 0o777

// 0.3.5 review ER-6: on Windows the token file gets DEC-0033's ACL before it is published. A user name with a space is
// granted as one argument, and the temporary file holding a fresh token is removed on every path that does not publish.
test('Windows: a user name with a space is granted; a refused name or a failed icacls leaves no temporary token behind', async () => {
  const { readdirSync } = await import('node:fs')
  const dir = mkdtempSync(path.join(tmpdir(), 'fabric-acl-'))
  const file = path.join(dir, 'hub-door-token')
  const runs = []
  writeAtomic(file, 'T1', { platform: 'win32', user: () => 'John Smith', exec: (f, a) => { runs.push([f, a]) } })
  assert.equal(readFileSync(file, 'utf8'), 'T1')
  assert.equal(runs.length, 1)
  assert.equal(runs[0][0], 'icacls.exe')
  assert.ok(runs[0][1].includes('John Smith:(F)'), 'the whole name is one grant argument')
  assert.deepEqual(readdirSync(dir), ['hub-door-token'])
  assert.throws(() => writeAtomic(file, 'T2', { platform: 'win32', user: () => 'a:b', exec: () => {} }), /user name/)
  assert.deepEqual(readdirSync(dir), ['hub-door-token'], 'a refused user name leaves no temporary token file')
  assert.throws(() => writeAtomic(file, 'T3', { platform: 'win32', user: () => { throw new Error('no user') }, exec: () => {} }), /no user/)
  assert.deepEqual(readdirSync(dir), ['hub-door-token'], 'an unreadable user leaves no temporary token file')
  assert.throws(() => writeAtomic(file, 'T4', { platform: 'win32', user: () => 'alice', exec: () => { throw new Error('icacls failed') } }), /ACL could not be set/)
  assert.deepEqual(readdirSync(dir), ['hub-door-token'], 'a failed icacls leaves no temporary token file')
  assert.equal(readFileSync(file, 'utf8'), 'T1', 'and the published token is the last one whose ACL was set')
})

test('publish writes the door token and hub.json, both 0600, hub.json naming the token file', () => {
  const root = path.join(mkdtempSync(path.join(tmpdir(), 'fabric-hub-')), 'ai.passioncode.fabric')
  const p = publishHub({ root, port: 47070, pid: 4242, now: () => new Date('2026-10-03T12:00:00Z') })
  assert.equal(mode(root), 0o700)
  assert.equal(mode(p.hubFile), 0o600)
  assert.equal(mode(p.doorTokenFile), 0o600)
  assert.match(p.doorToken, /^[A-Za-z0-9_-]{43}$/, '32 random bytes, base64url')
  assert.equal(readFileSync(p.doorTokenFile, 'utf8'), p.doorToken)
  assert.deepEqual(JSON.parse(readFileSync(p.hubFile, 'utf8')), {
    protocol: HUB_PROTOCOL, origin: 'http://127.0.0.1:47070', mcp: '/mcp', doorTokenFile: p.doorTokenFile, pid: 4242, startedAt: '2026-10-03T12:00:00.000Z',
    // D3 (fabric-agent-adapter#53): the session hooks act only where this is said.
    features: ['session-hooks/1']
  })
  assert.ok(!JSON.parse(readFileSync(p.hubFile, 'utf8')).doorToken, 'the token itself is never in hub.json')
})

test('every start rotates the door token', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'fabric-hub-'))
  const a = publishHub({ root, port: 47070 })
  const b = publishHub({ root, port: 47070 })
  assert.notEqual(a.doorToken, b.doorToken)
  assert.equal(readFileSync(b.doorTokenFile, 'utf8'), b.doorToken)
})

test('a pre-existing file with a wider mode is replaced by a 0600 one', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'fabric-hub-'))
  writeFileSync(path.join(root, 'hub.json'), '{}', { mode: 0o644 })
  const p = publishHub({ root, port: 47070 })
  assert.equal(mode(p.hubFile), 0o600)
})

test('withdraw removes both files only when hub.json names this process', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'fabric-hub-'))
  const p = publishHub({ root, port: 47070, pid: 1111 })
  assert.deepEqual(withdrawHub(root, 2222).removed, false, 'another Fabric must not delete this one\'s door')
  assert.ok(existsSync(p.hubFile) && existsSync(p.doorTokenFile))
  assert.deepEqual(withdrawHub(root, 1111), { removed: true })
  assert.ok(!existsSync(p.hubFile) && !existsSync(p.doorTokenFile))
  assert.equal(withdrawHub(root, 1111).removed, false)
})

test('withdraw never blocks on, follows or removes a hub.json that is not a regular file (I3 E-1)', () => {
  // A FIFO planted at hub.json used to hang the quit forever: withdraw read it with a blocking readFileSync
  // before any quit deadline was armed. Run in a child with a hard timeout so the old code fails, not hangs.
  const root = path.join(mkdtempSync(path.join(tmpdir(), 'fabric-hub-')), 'ai.passioncode.fabric')
  mkdirSync(root, { recursive: true, mode: 0o700 })
  const hubFile = path.join(root, 'hub.json')
  execFileSync('mkfifo', [hubFile])
  const script = 'const { withdrawHub } = await import(' + JSON.stringify(path.resolve(import.meta.dirname, '../src/main/hub.ts')) + '); process.stdout.write(JSON.stringify(withdrawHub(' + JSON.stringify(root) + ', 4242)))'
  const run = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], { encoding: 'utf8', timeout: 5000 })
  assert.equal(run.signal, null, 'withdraw blocked on a FIFO at hub.json (killed by the 5 s timeout)')
  const answer = JSON.parse(run.stdout)
  assert.equal(answer.removed, false)
  assert.match(answer.reason, /not a regular file/)
  assert.ok(existsSync(hubFile), 'a planted special file is left in place, never removed blindly')
  rmSync(hubFile)
  // A symlink at hub.json is not followed either, even when it points at a file naming this process.
  const elsewhere = path.join(root, '..', 'elsewhere.json')
  writeFileSync(elsewhere, JSON.stringify({ pid: 4242 }))
  symlinkSync(elsewhere, hubFile)
  const linked = withdrawHub(root, 4242)
  assert.equal(linked.removed, false)
  assert.ok(existsSync(elsewhere), 'the link target is untouched')
})

test('the port: default, FABRIC_HUB_PORT, refused when malformed or claimed by a registered agent', () => {
  assert.deepEqual(hubPort({}), { ok: true, port: DEFAULT_HUB_PORT })
  assert.deepEqual(hubPort({ FABRIC_HUB_PORT: '48000' }), { ok: true, port: 48000 })
  for (const bad of ['80', '70000', 'abc', '4800x']) assert.equal(hubPort({ FABRIC_HUB_PORT: bad }).ok, false)
  const claimed = new Map([[47070, 'example-agent.default']])
  const r = checkPortUnclaimed(47070, claimed)
  assert.equal(r.ok, false)
  assert.match(r.reason, /claimed by the registered agent example-agent\.default/)
  assert.deepEqual(checkPortUnclaimed(47071, claimed), { ok: true, port: 47071 })
})

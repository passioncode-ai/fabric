// CO-514 (the contract's DEC-0154 HA-2, v0.1.0+2026-11-07.1): fabric-mcp sends a credential only to a hub whose
// listener belongs to this account. The socket table is a stand-in: no real port is opened.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

const { uidsFromLsof, uidsFromProcNet, ownerOf, readListenerOwner, createOwnerCheck, ownerFromPowerShell } = await import(path.resolve(import.meta.dirname, '../src/main/listenerOwner.ts'))
const { publishHub, locateHub } = await import(path.resolve(import.meta.dirname, '../src/main/hub.ts'))

const ME = 501
const hub = () => { const root = mkdtempSync(path.join(tmpdir(), 'fabric-owner-')); publishHub({ root, port: 47070, pid: 4242 }); return root }
const locate = (root, owner) => locateHub(root, { isAlive: () => true, uid: () => ME, owner: () => owner })

test('a hub this account listens on is located; another account\'s is foreign-user and nothing is sent', () => {
  const root = hub()
  assert.equal(locate(root, { uid: ME }).ok, true)
  const foreign = locate(root, { uid: 502 })
  assert.deepEqual([foreign.ok, foreign.code], [false, 'not-a-hub'])
  assert.match(foreign.reason, /^foreign-user: port 47070 is held by another account/)
  assert.equal('doorToken' in foreign, false, 'no token is read out for it')
})

test('an owner that cannot be told is a refusal too, never a pass', () => {
  const r = locate(hub(), { unknown: 'no listener of this account could be seen on the port' })
  assert.deepEqual([r.ok, r.code], [false, 'not-a-hub'])
  assert.match(r.reason, /^foreign-user: the owner of port 47070 could not be told/)
})

test('Windows: the listener\'s owner SID decides, this user\'s is located, another\'s is foreign-user', () => {
  assert.equal(locate(hub(), { sid: 'S-1-5-21-1', mine: true }).ok, true)
  const r = locate(hub(), { sid: 'S-1-5-21-2', mine: false })
  assert.deepEqual([r.ok, r.code], [false, 'not-a-hub'])
  assert.match(r.reason, /^foreign-user/)
})

test('PowerShell\'s answer: only listeners taking loopback count, an unreadable owner is unknown', () => {
  assert.deepEqual(ownerFromPowerShell('me S-1-5-21-1\r\n127.0.0.1 4242 S-1-5-21-1\r\n'), { sid: 'S-1-5-21-1', mine: true })
  assert.deepEqual(ownerFromPowerShell('me S-1-5-21-1\n0.0.0.0 77 S-1-5-21-2\n'), { sid: 'S-1-5-21-2', mine: false })
  assert.ok('unknown' in ownerFromPowerShell('me S-1-5-21-1\n192.168.1.5 77 S-1-5-21-2\n'), 'a LAN-only listener does not take loopback')
  assert.ok('unknown' in ownerFromPowerShell('me S-1-5-21-1\n::1 77 ?\n'))
  assert.ok('unknown' in ownerFromPowerShell(''))
})

test('the real socket table of this system names this account as the owner of a listener it opens', async () => {
  const net = await import('node:net')
  const server = net.createServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const owner = readListenerOwner(server.address().port)
    const mine = process.platform === 'win32' ? owner.mine === true : owner.uid === process.getuid()
    assert.ok(mine || 'unsupported' in owner, `the owner read was ${JSON.stringify(owner)}`)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('lsof -Fpu: every listener\'s uid, once', () => {
  assert.deepEqual(uidsFromLsof('p10608\nu501\nf32\nf33\n'), [501])
  assert.deepEqual(uidsFromLsof('p1\nu501\nf3\np2\nu502\nf4\n').sort(), [501, 502])
  assert.deepEqual(uidsFromLsof(''), [])
})

test('/proc/net/tcp: only rows LISTENing on the port, with their uid', () => {
  const table = [
    '  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode',
    '   0: 0100007F:B7AE 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 1 1 0',
    '   1: 0100007F:B7AE 0100007F:9C40 01 00000000:00000000 00:00000000 00000000  1001        0 2 1 0',
    '   2: 0100007F:1F90 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1002        0 3 1 0'
  ].join('\n')
  assert.deepEqual(uidsFromProcNet(table, 47022), [1000], 'the established row and the other port are not listeners on it')
})

test('several accounts on one port, or none, cannot name an owner', () => {
  assert.deepEqual(ownerOf([501]), { uid: 501 })
  assert.ok('unknown' in ownerOf([]))
  assert.ok('unknown' in ownerOf([501, 502]))
})

test('macOS: lsof finding nothing (exit 1) is unknown; Linux reads both tables; Windows asks PowerShell', () => {
  const nothing = () => { const e = new Error('exit 1'); e.stdout = ''; throw e }
  assert.ok('unknown' in readListenerOwner(47070, { platform: 'darwin', run: nothing }))
  assert.deepEqual(readListenerOwner(47070, { platform: 'darwin', run: () => 'p1\nu501\n' }), { uid: 501 })
  const v6 = '  sl  local_address remote st tx rx tr retr uid\n   0: 00000000000000000000000001000000:B7AE 0:0 0A 0:0 0:0 0 1000 0 1\n'
  assert.deepEqual(readListenerOwner(47022, { platform: 'linux', read: (f) => (f.endsWith('6') ? v6 : '  header\n') }), { uid: 1000 })
  assert.ok('unknown' in readListenerOwner(47022, { platform: 'linux', read: () => { throw new Error('ENOENT') } }))
  assert.deepEqual(readListenerOwner(47070, { platform: 'win32', run: () => 'me S-1-5-21-1\n127.0.0.1 9 S-1-5-21-1\n' }), { sid: 'S-1-5-21-1', mine: true })
  assert.ok('unknown' in readListenerOwner(47070, { platform: 'win32', run: () => { throw new Error('exit 3') } }))
  assert.deepEqual(readListenerOwner(47070, { platform: 'freebsd' }), { unsupported: true })
})

test('the check reads the table once per hub process, and again when the pid or the port changes', () => {
  let reads = 0, t = 0
  const check = createOwnerCheck({ read: () => { reads++; return { uid: ME } }, now: () => t, ttlMs: 60_000 })
  check(47070, 1); t += 2_000; check(47070, 1)
  assert.equal(reads, 1, 'every 2 s locate does not run lsof again')
  check(47070, 2)
  assert.equal(reads, 2, 'a restarted hub is read again')
  t += 61_000; check(47070, 2)
  assert.equal(reads, 3, 'and once its time is up')
})

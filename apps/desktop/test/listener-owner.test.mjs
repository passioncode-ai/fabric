// CO-514 (the contract's DEC-0154 HA-2, v0.1.0+2026-11-07.1): fabric-mcp sends a credential only to a hub whose
// listener belongs to this account. The socket table is a stand-in: no real port is opened.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

// A relative static import, never a dynamic import of a resolved path: on Windows that path is `C:\...`, a URL
// scheme to the ESM loader (CO-557, scripts/test/windows-test-imports.test.mjs).
import { uidsFromLsof, uidsFromProcNet, ownerOf, readListenerOwner, createOwnerCheck, ownerFromPowerShell, listenerPidsFromWinNetstat, serverEndPidsFromWinNetstat, accountFromTasklist, ownerFromWinAccounts } from '../src/main/listenerOwner.ts'
import { publishHub, locateHub } from '../src/main/hub.ts'

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
  // CO-561: a code of its own, naming the hub, so a session already held on that hub is kept; still never ok.
  assert.deepEqual([r.ok, r.code], [false, 'owner-unknown'])
  assert.equal(typeof r.pid, 'number'); assert.match(r.origin, /^http:\/\/127\.0\.0\.1:47070$/)
  assert.ok(!('doorToken' in r), 'no token is handed out')
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

test('lsof -Fpun: the uid of each listener on exactly 127.0.0.1:<port>, once; a wildcard or another port is not counted', () => {
  assert.deepEqual(uidsFromLsof('p10608\nu501\nf32\nn127.0.0.1:47070\nf33\nn[::1]:47070\n', 47070), [501])
  assert.deepEqual(uidsFromLsof('p1\nu501\nf3\nn127.0.0.1:47070\np2\nu502\nf4\nn127.0.0.1:47070\n', 47070).sort(), [501, 502])
  // FD-168, CT-254: an own wildcard listener beside another account's 127.0.0.1 one (which lsof cannot show) is no proof.
  assert.deepEqual(uidsFromLsof('p1\nu501\nf3\nn*:47070\n', 47070), [])
  assert.deepEqual(uidsFromLsof('p1\nu501\nf3\nn127.0.0.1:47071\n', 47070), [])
  assert.deepEqual(uidsFromLsof('', 47070), [])
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

test('/proc/net/tcp (CT-254): the listener on 127.0.0.1 decides, else the one on every address; a connection row never', () => {
  const head = '  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode'
  const row = (n, addr, st, uid) => `   ${n}: ${addr}:B7AE 00000000:0000 ${st} 00000000:00000000 00:00000000 00000000  ${uid}        0 ${n} 1 0`
  // Ours on 127.0.0.1, another account's on 0.0.0.0: a connection to 127.0.0.1 reaches ours.
  assert.deepEqual(uidsFromProcNet([head, row(0, '0100007F', '0A', 1000), row(1, '00000000', '0A', 1001)].join('\n'), 47022), [1000])
  // Ours on 0.0.0.0, another account's on 127.0.0.1: the connection reaches theirs.
  assert.deepEqual(uidsFromProcNet([head, row(0, '00000000', '0A', 1000), row(1, '0100007F', '0A', 1001)].join('\n'), 47022), [1001])
  // Only a wildcard: it decides. A row on 127.0.0.2 does not take a connection to 127.0.0.1.
  assert.deepEqual(uidsFromProcNet([head, row(0, '00000000', '0A', 1000), row(1, '0200007F', '0A', 1001)].join('\n'), 47022), [1000])
  // A connection not yet accepted reads uid 0 with inode 0: it is not a listener and is never read.
  assert.deepEqual(uidsFromProcNet([head, row(0, '0100007F', '03', 0), row(1, '0100007F', '0A', 1000)].join('\n'), 47022), [1000])
  const linux = (v4, v6) => readListenerOwner(47022, { platform: 'linux', read: (f) => (f.endsWith('6') ? v6 : v4) })
  assert.deepEqual(linux([head, row(0, '00000000', '0A', 1000)].join('\n'), [head, row(0, '0000000000000000FFFF00000100007F', '0A', 1001)].join('\n')), { uid: 1001 }, 'a v4-mapped 127.0.0.1 in tcp6 is the exact address')
})

test('several accounts on one port, or none, cannot name an owner', () => {
  assert.deepEqual(ownerOf([501]), { uid: 501 })
  assert.ok('unknown' in ownerOf([]))
  assert.ok('unknown' in ownerOf([501, 502]))
})

test('macOS: lsof finding nothing (exit 1) is unknown; Linux reads both tables; Windows asks PowerShell', () => {
  const nothing = () => { const e = new Error('exit 1'); e.stdout = ''; throw e }
  assert.ok('unknown' in readListenerOwner(47070, { platform: 'darwin', run: nothing }))
  assert.deepEqual(readListenerOwner(47070, { platform: 'darwin', run: () => 'p1\nu501\nf3\nn127.0.0.1:47070\n' }), { uid: 501 })
  const v6 = '  sl  local_address remote st tx rx tr retr uid\n   0: 00000000000000000000000000000000:B7AE 0:0 0A 0:0 0:0 0 1000 0 1\n'
  assert.deepEqual(readListenerOwner(47022, { platform: 'linux', read: (f) => (f.endsWith('6') ? v6 : '  header\n') }), { uid: 1000 })
  // A listener on ::1 alone does not take a connection to 127.0.0.1: nothing reaches it, so the owner is unknown.
  assert.ok('unknown' in readListenerOwner(47022, { platform: 'linux', read: (f) => (f.endsWith('6') ? v6.replace('00000000000000000000000000000000:', '00000000000000000000000001000000:') : '  header\n') }))
  assert.ok('unknown' in readListenerOwner(47022, { platform: 'linux', read: () => { throw new Error('ENOENT') } }))
  // CO-560: netstat that cannot be run (or shows nothing) is asked of PowerShell, as before.
  const psOnly = (cmd) => { if (cmd !== 'powershell.exe') throw new Error('not found'); return 'me S-1-5-21-1\n127.0.0.1 9 S-1-5-21-1\n' }
  assert.deepEqual(readListenerOwner(47070, { platform: 'win32', run: psOnly }), { sid: 'S-1-5-21-1', mine: true })
  assert.ok('unknown' in readListenerOwner(47070, { platform: 'win32', run: () => { throw new Error('exit 3') } }))
  assert.deepEqual(readListenerOwner(47070, { platform: 'freebsd' }), { unsupported: true })
})

test('CO-561: macOS asks lsof a second time when it could not be read, never after its own exit 1, and an unknown owner is not kept', () => {
  let calls = 0
  const flaky = () => { calls++; if (calls === 1) { const e = new Error('spawn EAGAIN'); throw e } return 'p1\nu501\nf3\nn127.0.0.1:47070\n' }
  assert.deepEqual(readListenerOwner(47070, { platform: 'darwin', run: flaky }), { uid: 501 })
  assert.equal(calls, 2, 'a failed spawn is asked once more')
  let none = 0
  const exit1 = () => { none++; const e = new Error('exit 1'); e.status = 1; e.stdout = ''; throw e }
  assert.ok('unknown' in readListenerOwner(47070, { platform: 'darwin', run: exit1 }))
  assert.equal(none, 1, 'lsof listing nothing is its answer, not asked again')
  let reads = 0, t = 0, answer = { unknown: 'the socket table could not be read' }
  const check = createOwnerCheck({ read: () => { reads++; return answer }, now: () => t, ttlMs: 60_000 })
  check(47070, 1); t += 2_000
  answer = { uid: ME }
  assert.deepEqual(check(47070, 1), { uid: ME }, 'the next locate reads again')
  assert.equal(reads, 2)
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

const NETSTAT = [
  '',
  'Active Connections',
  '',
  '  Proto  Local Address          Foreign Address        State           PID',
  '  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       1000',
  '  TCP    127.0.0.1:47070        0.0.0.0:0              ABH\u00d6REN         4242',
  '  TCP    127.0.0.1:47070        127.0.0.1:53211        HERGESTELLT     4242',
  '  TCP    192.168.1.5:47070      0.0.0.0:0              LISTENING       77',
  '  TCP    [::1]:47070            [::]:0                 LISTENING       4242',
  '  UDP    0.0.0.0:47070          *:*                                    9'
].join('\r\n')

test('CO-560: Windows reads netstat by addresses and ports, never by the translated state, and the owner by tasklist', () => {
  assert.deepEqual(listenerPidsFromWinNetstat(NETSTAT, 47070), [4242], 'loopback listeners only, a LAN-only one and UDP left out')
  assert.deepEqual(serverEndPidsFromWinNetstat(NETSTAT, 47070, 53211), [4242])
  assert.deepEqual(serverEndPidsFromWinNetstat(NETSTAT, 47070, 1), [])
  assert.equal(accountFromTasklist('"Fabric.exe","4242","Console","1","120,000 K","Running","DESKTOP-1\\me","0:00:09","Fabric"\r\n'), 'DESKTOP-1\\me')
  assert.equal(accountFromTasklist('"svchost.exe","4242","Services","0","9,000 K","Unknown","N/A","0:00:00","N/A"'), null)
  assert.equal(accountFromTasklist('INFO: No tasks are running which match the specified criteria.'), null)
  assert.equal(accountFromTasklist('"svchost.exe","4242","Services","0","9 K","Unknown","\u041d/\u0414","0:00:00","\u041d/\u0414"'), null, 'a translated placeholder carries no backslash: unread, never another account')
  assert.deepEqual(ownerFromWinAccounts('desktop-1\\me', ['DESKTOP-1\\me']), { sid: 'desktop-1\\me', mine: true }, 'compared without case')
  assert.deepEqual(ownerFromWinAccounts('desktop-1\\me', ['DESKTOP-1\\other']), { sid: 'DESKTOP-1\\other', mine: false })
  assert.ok('unknown' in ownerFromWinAccounts('desktop-1\\me', [null]), 'an account tasklist cannot name is unknown, never mine')
  const run = (cmd, args) => cmd === 'whoami' ? 'desktop-1\\me\r\n' : cmd === 'netstat' ? NETSTAT
    : cmd === 'tasklist' && args.includes('PID eq 4242') ? '"Fabric.exe","4242","Console","1","1 K","Running","DESKTOP-1\\me","0:00:01","Fabric"' : (() => { throw new Error('unexpected ' + cmd) })()
  assert.deepEqual(readListenerOwner(47070, { platform: 'win32', run }), { sid: 'desktop-1\\me', mine: true }, 'no PowerShell asked')
})

// CO-514 (DEC-0154 HA-2 (b), HA-3): the hub refuses another account's process before reading its request, on a
// computer several people use. The tables are stand-ins; no port is opened.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'

const { humanAccountsFromDscl, humanAccountsFromPasswd, peerUidsFromLsof, peerUidsFromProcNet, verdictOf, createPeerCheck, peerFromPowerShell, PS_PEER_SCRIPT } =
  await import(path.resolve(import.meta.dirname, '../src/main/peerAccount.ts'))

test('people are counted, service accounts are not', () => {
  assert.equal(humanAccountsFromDscl('_www 70\nroot 0\nnobody -2\nsshlg 501\nspace 502\n'), 2)
  assert.equal(humanAccountsFromPasswd('root:x:0:0::/root:/bin/sh\nnobody:x:65534:65534::/:/bin/false\nann:x:1000:1000::/home/ann:/bin/bash\n'), 1)
})

test('the client socket is the row whose local side is the connection\'s remote port, never the hub\'s own row', () => {
  const out = 'p10608\nu501\nf32\nn127.0.0.1:47070->127.0.0.1:52344\np777\nu502\nf9\nn127.0.0.1:52344->127.0.0.1:47070\n'
  assert.deepEqual(peerUidsFromLsof(out, 52344), [502])
  const table = '  sl local rem st tx tr retr uid\n   0: 0100007F:CC78 0100007F:B7AE 01 0:0 0:0 0 1001 0 1\n   1: 0100007F:B7AE 0100007F:CC78 01 0:0 0:0 0 1000 0 2\n'
  assert.deepEqual(peerUidsFromProcNet(table, 52344), [1001])
  // CT-254: a client row with inode 0 is a closed client; its account cannot be told, and nothing else stands in.
  const closed = '  sl local rem st tx tr retr uid timeout inode\n   0: 0100007F:CC78 0100007F:B7AE 01 0:0 0:0 0 0 0 0\n'
  assert.deepEqual(peerUidsFromProcNet(closed, 52344), [])
})

test('one account of mine is own, another is foreign, none or several cannot be told', () => {
  assert.equal(verdictOf([501], 501), 'own')
  assert.equal(verdictOf([502], 501), 'foreign')
  assert.equal(verdictOf([], 501), 'unverified')
  assert.equal(verdictOf([501, 502], 501), 'unverified')
})

test('a computer one person uses checks nothing and reads no table', async () => {
  let reads = 0
  const check = createPeerCheck({ platform: 'darwin', uid: () => 501, accounts: () => 1, peers: async () => { reads++; return [502] } })
  assert.equal(await check({ remotePort: 52344 }), 'own')
  assert.equal(reads, 0)
})

test('a shared computer: another account is foreign, an unreadable table unverified, one read per connection', async () => {
  let reads = 0
  const table = new Map([[52344, [502]], [52345, [501]]])
  const check = createPeerCheck({ platform: 'darwin', uid: () => 501, accounts: () => 2, peers: async (port) => { reads++; if (!table.has(port)) throw new Error('lsof failed'); return table.get(port) } })
  const socket = { remotePort: 52344 }
  assert.equal(await check(socket), 'foreign')
  assert.equal(await check(socket), 'foreign')
  assert.equal(reads, 1, 'a kept-alive connection is read once')
  assert.equal(await check({ remotePort: 52345 }), 'own')
  assert.equal(await check({ remotePort: 1 }), 'unverified')
})

test('an account list that cannot be read, or reads as no number, is treated as shared', async () => {
  const check = createPeerCheck({ platform: 'linux', uid: () => 1000, accounts: () => { throw new Error('EACCES') }, peers: async () => [1001] })
  assert.equal(await check({ remotePort: 40000 }), 'foreign')
  const nan = createPeerCheck({ platform: 'linux', uid: () => 1000, accounts: () => Number(''.trim() || 'x'), peers: async () => [1001] })
  assert.equal(await nan({ remotePort: 40000 }), 'foreign')
  assert.equal(await createPeerCheck({ platform: 'freebsd' })({ remotePort: 1 }), 'not-checked')
})

test('Windows: the client connection\'s owner SID decides; none, several or an unread owner cannot be told', () => {
  const me = 'S-1-5-21-1-2-3-1001'
  assert.equal(peerFromPowerShell(`me ${me}\r\n127.0.0.1 4410 ${me}\r\n`), 'own')
  assert.equal(peerFromPowerShell(`me ${me}\r\n::1 4410 S-1-5-21-1-2-3-1002\r\n`), 'foreign')
  assert.equal(peerFromPowerShell(`me ${me}\r\n`), 'unverified')
  assert.equal(peerFromPowerShell(`me ${me}\r\n127.0.0.1 4410 ?\r\n`), 'unverified')
  assert.equal(peerFromPowerShell(`me ${me}\r\n127.0.0.1 4410 ${me}\r\n127.0.0.1 4411 S-1-5-21-1-2-3-1002\r\n`), 'unverified')
  assert.equal(peerFromPowerShell(`127.0.0.1 4410 ${me}\r\n`), 'unverified', 'without this user\'s SID nothing is own')
  assert.equal(peerFromPowerShell(`me ${me}\r\n10.0.0.5 4410 ${me}\r\n`), 'unverified', 'a connection off loopback is not the caller')
  assert.match(PS_PEER_SCRIPT(52344), /-State Established -LocalPort 52344/)
})

test('on this machine a real connection of this account reads as own on a computer taken as shared', async () => {
  const net = await import('node:net')
  const server = net.createServer(() => {})
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const client = net.connect(server.address().port, '127.0.0.1')
  await new Promise((r) => client.once('connect', r))
  try {
    const check = createPeerCheck({ accounts: () => 2 })
    const expected = ['darwin', 'linux', 'win32'].includes(process.platform) ? 'own' : 'not-checked'
    assert.equal(await check({ remotePort: client.localPort }), expected)
  } finally {
    client.destroy()
    await new Promise((r) => server.close(r))
  }
})

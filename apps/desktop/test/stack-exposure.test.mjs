// Audit 2026-10-05 A7-001: Fabric finds out whether its local stack answers off loopback.
import assert from 'node:assert/strict'
import net from 'node:net'
import test from 'node:test'
import { stackExposure, stackPorts, tcpReachable } from '../src/main/stackExposure.ts'

const ifaces = () => ({
  lo0: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
  en0: [{ address: '192.168.0.10', family: 'IPv4', internal: false }, { address: 'fe80::1', family: 'IPv6', internal: false }],
  utun3: [{ address: '10.0.0.2', family: 'IPv4', internal: false }]
})

test('every non-loopback IPv4 address is tried on every stack port; only answers are reported, by interface', async () => {
  const tried = []
  const r = await stackExposure([54321, 54322], {
    interfaces: ifaces,
    connect: async (host, port) => (tried.push(`${host}:${port}`), host === '192.168.0.10'),
    now: () => new Date('2026-10-06T00:00:00Z')
  })
  assert.deepEqual(tried.sort(), ['10.0.0.2:54321', '10.0.0.2:54322', '192.168.0.10:54321', '192.168.0.10:54322'])
  assert.deepEqual(r, { checkedAt: '2026-10-06T00:00:00.000Z', ports: [54321, 54322], exposed: [{ iface: 'en0', port: 54321 }, { iface: 'en0', port: 54322 }] })
  assert.ok(!JSON.stringify(r).includes('192.168'), 'the address itself is not recorded')
})

test('nothing answering is an empty list, not an error', async () => {
  const r = await stackExposure([54322], { interfaces: ifaces, connect: async () => false })
  assert.deepEqual(r.exposed, [])
})

test('ports come from the stack URLs; garbage and missing ones are left out', () => {
  assert.deepEqual(stackPorts(['http://127.0.0.1:54321', 'postgresql://postgres:postgres@127.0.0.1:54322/postgres', 'nope', undefined, null]), [54321, 54322])
})

test('the real connect: a listener answers, a closed port does not, and neither hangs', async () => {
  const server = net.createServer((s) => s.destroy())
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const { port } = server.address()
  assert.equal(await tcpReachable('127.0.0.1', port, 1000), true)
  server.close()
  await new Promise((r) => server.once('close', r))
  assert.equal(await tcpReachable('127.0.0.1', port, 1000), false)
})

// 0.3.2 verification i3 DO-2: a failed or missing check is retried; a stale one is re-checked; a running one is not doubled.
test('a read starts a check when none finished, when the last is stale, and never beside a running one', async () => {
  const { exposureNeedsCheck, STACK_EXPOSURE_MAX_AGE_MS } = await import('../src/main/stackExposure.ts')
  const now = Date.parse('2026-10-06T12:00:00Z')
  const fresh = { checkedAt: new Date(now - 1000).toISOString(), ports: [54321], exposed: [] }
  const stale = { checkedAt: new Date(now - STACK_EXPOSURE_MAX_AGE_MS - 1).toISOString(), ports: [54321], exposed: [] }
  assert.equal(exposureNeedsCheck(null, false, now), true, 'the first check failed or never finished')
  assert.equal(exposureNeedsCheck(stale, false, now), true)
  assert.equal(exposureNeedsCheck(fresh, false, now), false)
  assert.equal(exposureNeedsCheck(null, true, now), false, 'one check at a time')
})

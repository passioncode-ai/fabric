// #region hub-standby — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#stability
// ST-3 and ST-2 of the 0.3.9 stability audit: during the 2026-10-20 outage agents found no hub at all for 55 minutes
// (`hub_not_published`), because the hub was created only after the stack had started. Now:
//   - the hub's port and hub.json are up before the stack, and every call is answered 503 with a typed code
//     (`stack-starting`) and Retry-After instead of nothing;
//   - the real surface takes the very same listening sockets over (no gap a squatter could use, no second bind) and
//     keeps the door token the standby published;
//   - while the running stack is lost, the surface answers every call 503 `stack-unavailable`, and leaves that mode
//     when the stack is back.
import assert from 'node:assert/strict'
import { createServer, request } from 'node:http'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

const SRC = path.resolve(import.meta.dirname, '../src/main')
const { AgentSurface } = await import(path.join(SRC, 'agentSurface.ts'))
const { HubStandby, openHubStandby } = await import(path.join(SRC, 'hubStandby.ts'))
const { startHub, locateHub } = await import(path.join(SRC, 'hub.ts'))

async function freePort() {
  const probe = createServer()
  await new Promise((r) => probe.listen(0, '127.0.0.1', r))
  const port = probe.address().port
  await new Promise((r) => probe.close(r))
  return port
}
const post = async (origin, { token = 'nonsense', host } = {}) => {
  const url = new URL(`${origin}/mcp`)
  return new Promise((resolve, reject) => {
    const req = request({ hostname: url.hostname, port: url.port, path: '/mcp', method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...(host ? { host } : {}) } }, (res) => {
      let text = ''
      res.on('data', (c) => (text += c))
      res.on('end', () => {
        let body = null
        try { body = JSON.parse(text) } catch { body = text }
        resolve({ status: res.statusCode, retryAfter: res.headers['retry-after'], body })
      })
    })
    req.on('error', reject)
    req.end(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }))
  })
}
const starting = () => ({ code: 'stack-starting', reason: 'Fabric is starting: its database is not ready yet. Wait and call again.', retryAfterS: 10 })

test('ST-3: before the stack, the hub port answers every call 503 stack-starting with Retry-After', async () => {
  const port = await freePort()
  let refusal = starting()
  const standby = new HubStandby({ refusal: () => refusal })
  await standby.listen(port)
  try {
    const r = await post(standby.origin)
    assert.equal(r.status, 503)
    assert.equal(r.retryAfter, '10')
    assert.equal(r.body.code, 'stack-starting')
    assert.match(r.body.error, /starting/)
    // The same on [::1]: the port is Fabric's on both loopbacks from the start (ER-8).
    const r6 = await fetch(`http://[::1]:${port}/mcp`, { method: 'POST', body: '{}' }).catch(() => null)
    if (r6) assert.equal(r6.status, 503)
    // The destination check holds before anything else.
    assert.equal((await post(standby.origin, { host: 'evil.example' })).status, 421)
    assert.equal((await fetch(`${standby.origin}/elsewhere`)).status, 404)
    refusal = { code: 'stack-unavailable', reason: 'Fabric could not start its database.', retryAfterS: 120 }
    const later = await post(standby.origin)
    assert.equal(later.body.code, 'stack-unavailable')
    assert.equal(later.retryAfter, '120')
  } finally {
    await standby.stop()
  }
})

test('ST-3: the real surface takes the standby\'s sockets over, on the same port, and answers as the surface', async () => {
  const port = await freePort()
  const standby = new HubStandby({ refusal: starting })
  await standby.listen(port)
  const surface = new AgentSurface({ db: null, journal: null, ptys: () => undefined, estateId: 'e' })
  await surface.start({ port, adopt: standby.handOver() })
  try {
    assert.equal(surface.origin, `http://127.0.0.1:${port}`)
    assert.equal((await post(surface.origin)).status, 401, 'the surface answers an unknown bearer, not the standby')
    // A handed-over standby no longer answers or holds anything.
    assert.equal(standby.origin, '')
  } finally {
    await surface.stop()
  }
  // Stopped, the port is free: nothing is left listening.
  const again = createServer()
  await new Promise((resolve, reject) => { again.once('error', reject); again.listen(port, '127.0.0.1', resolve) })
  again.close()
})

test('ST-2: while the stack is lost the surface refuses 503 stack-unavailable, and answers again when it is back', async () => {
  const surface = new AgentSurface({ db: null, journal: null, ptys: () => undefined, estateId: 'e' })
  await surface.start()
  try {
    surface.setUnavailable({ code: 'stack-unavailable', reason: "Fabric's database is not answering; Fabric is bringing it back.", retryAfterS: 20 })
    const down = await post(surface.origin)
    assert.equal(down.status, 503)
    assert.equal(down.retryAfter, '20')
    assert.equal(down.body.code, 'stack-unavailable')
    surface.setUnavailable(null)
    assert.equal((await post(surface.origin)).status, 401)
  } finally {
    await surface.stop()
  }
})

test('ST-3: hub.json is published by the standby, and the hub keeps that door token when it opens', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'fabric-hub-standby-'))
  const port = await freePort()
  const opened = await openHubStandby({ env: { FABRIC_HUB_PORT: String(port) }, claimedPorts: new Map(), root, refusal: starting })
  assert.equal(opened.open, true)
  const located = locateHub(root)
  assert.equal(located.ok, true, located.reason)
  assert.equal(located.origin, `http://127.0.0.1:${port}`)
  assert.equal((await post(located.origin)).body.code, 'stack-starting')
  const surface = new AgentSurface({ db: null, journal: null, ptys: () => undefined, estateId: 'e' })
  const started = await startHub({ surface, env: { FABRIC_HUB_PORT: String(port) }, claimedPorts: new Map(), root, standby: opened })
  try {
    assert.equal(started.open, true)
    assert.equal(started.doorToken, opened.doorToken, 'agents that read the door token during the wait keep a valid one')
    assert.equal(readFileSync(path.join(root, 'hub-door-token'), 'utf8').trim(), opened.doorToken)
    assert.equal((await post(surface.origin)).status, 401)
  } finally {
    await surface.stop()
  }
})

test('ST-3: a standby whose port is taken says so and leaves the start to report the hub as down', async () => {
  const blocker = createServer()
  await new Promise((r) => blocker.listen(0, '127.0.0.1', r))
  const port = blocker.address().port
  const root = mkdtempSync(path.join(tmpdir(), 'fabric-hub-standby-'))
  const opened = await openHubStandby({ env: { FABRIC_HUB_PORT: String(port) }, claimedPorts: new Map(), root, refusal: starting })
  assert.equal(opened.open, false)
  assert.equal(locateHub(root).ok, false, 'no hub.json for a port Fabric does not hold')
  blocker.close()
})
// #endregion hub-standby

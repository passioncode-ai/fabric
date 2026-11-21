// #region operator-door-test — docs: docs/evidence/plans/2026-11-17-board-apart-waves.md#3-the-waves
// ADR-0195 W2c.2a: the board's operator door, the transport alone. A real loopback listener under a temporary root; the
// caller's account is a stand-in verdict (the tables are `peer-account.test.mjs`'s). Every refusal comes before the
// body is read, the token file is 0600 beside board-door.json, and the stop withdraws only this process's files.
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { request } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { callOperatorDoor, operatorDoorPaths, startOperatorDoor, withdrawOperatorDoor, OPERATOR_DOOR_PROTOCOL } from '../src/main/operatorDoor.ts'

const own = async () => 'own'

function root() {
  return mkdtempSync(path.join(tmpdir(), 'fabric-operator-door-'))
}

/** A raw call, so the Host, Origin and Authorization can be set as a test needs. */
function raw(port, { method = 'POST', url = '/door/echo', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, method, path: url, headers: { host: `127.0.0.1:${port}`, ...headers } }, (res) => {
      let text = ''
      res.on('data', (c) => { text += c })
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: text ? JSON.parse(text) : null }))
    })
    req.on('error', reject)
    if (body !== undefined) req.write(body)
    req.end()
  })
}

test('a call through the published files answers the door; the token is 0600 beside board-door.json', async (t) => {
  const dir = root()
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const seen = []
  const door = await startOperatorDoor({ root: dir, peerAccount: own, doors: new Map([['echo', (args) => { seen.push(args); return { back: args } }], ['nothing', () => undefined]]) })
  t.after(() => door.stop())
  const { doorFile, tokenFile } = operatorDoorPaths(dir)
  const doc = JSON.parse(readFileSync(doorFile, 'utf8'))
  assert.equal(doc.protocol, OPERATOR_DOOR_PROTOCOL)
  assert.equal(doc.origin, `http://127.0.0.1:${door.port}`)
  assert.equal(doc.pid, process.pid)
  assert.equal(doc.tokenFile, tokenFile)
  if (process.platform !== 'win32') {
    assert.equal(statSync(tokenFile).mode & 0o777, 0o600)
    assert.equal(statSync(doorFile).mode & 0o777, 0o600)
  }
  assert.deepEqual(await callOperatorDoor(dir, 'echo', { task: 'x' }), { ok: true, value: { back: { task: 'x' } } })
  assert.deepEqual(seen, [{ task: 'x' }])
  assert.deepEqual(await callOperatorDoor(dir, 'nothing', null), { ok: true, value: null })
})

test('every refusal comes before the body is read: host, origin, account, token', async (t) => {
  const dir = root()
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  let verdict = 'own'
  let calls = 0
  const door = await startOperatorDoor({ root: dir, peerAccount: async () => verdict, doors: new Map([['echo', () => { calls++; return 1 }]]) })
  t.after(() => door.stop())
  const token = readFileSync(operatorDoorPaths(dir).tokenFile, 'utf8')
  const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
  const body = JSON.stringify({ args: {} })

  assert.equal((await raw(door.port, { headers: { ...auth, host: `localhost:${door.port}` }, body })).status, 421)
  assert.equal((await raw(door.port, { headers: { ...auth, origin: 'http://evil.example' }, body })).status, 403)
  verdict = 'foreign'
  const foreign = await raw(door.port, { headers: auth, body })
  assert.equal(foreign.status, 403)
  assert.equal(foreign.body.error, 'peer-foreign-account')
  verdict = 'unverified'
  const unverified = await raw(door.port, { headers: auth, body })
  assert.equal(unverified.status, 503)
  assert.equal(unverified.body.error, 'peer-unverified')
  assert.equal(unverified.headers['retry-after'], '5')
  verdict = 'own'
  assert.equal((await raw(door.port, { headers: { 'content-type': 'application/json' }, body })).status, 401)
  assert.equal((await raw(door.port, { headers: { ...auth, authorization: `Bearer ${token.slice(1)}x` }, body })).status, 401)
  assert.equal(calls, 0, 'no refused call reached a door')
  assert.equal((await raw(door.port, { headers: auth, body })).status, 200)
  assert.equal(calls, 1)
})

test('a door call is POST /door/<name> with a JSON object; unknown, failing and oversized calls are said', async (t) => {
  const dir = root()
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const logged = []
  const door = await startOperatorDoor({
    root: dir,
    peerAccount: own,
    maxBodyBytes: 64,
    log: (e) => logged.push(e),
    doors: new Map([['boom', () => { throw new Error('the store refused') }], ['echo', (a) => a]])
  })
  t.after(() => door.stop())
  const token = readFileSync(operatorDoorPaths(dir).tokenFile, 'utf8')
  const auth = { authorization: `Bearer ${token}` }
  assert.equal((await raw(door.port, { method: 'GET', headers: auth })).status, 405)
  assert.equal((await raw(door.port, { url: '/mcp', headers: auth, body: '{}' })).status, 405)
  const unknown = await raw(door.port, { url: '/door/none', headers: auth, body: '{}' })
  assert.equal(unknown.status, 404)
  assert.equal(unknown.body.error, 'unknown-door')
  // 0.3.28 review, ER-6: a malformed escape in the name is the caller's mistake, 400, not the board's failure.
  const badName = await raw(door.port, { url: '/door/%E0%A4%A', headers: auth, body: '{}' })
  assert.equal(badName.status, 400)
  assert.equal(badName.body.error, 'bad-door-name')
  assert.equal((await raw(door.port, { headers: auth, body: '[1]' })).status, 400)
  assert.equal((await raw(door.port, { headers: auth, body: 'not json' })).status, 400)
  assert.equal((await raw(door.port, { headers: auth, body: JSON.stringify({ args: 'x'.repeat(100) }) })).status, 413)
  const failed = await callOperatorDoor(dir, 'boom', {})
  assert.deepEqual(failed, { ok: false, error: 'door-failed', message: 'the store refused', status: 500 })
  assert.ok(logged.some((e) => e.op === 'operatorDoor.door-failed' && e.door === 'boom'))
  assert.ok(!JSON.stringify(logged).includes(token), 'the token is never logged')
})

test('a name outside the door alphabet is refused at start', async () => {
  const dir = root()
  try {
    await assert.rejects(startOperatorDoor({ root: dir, peerAccount: own, doors: new Map([['../x', () => 1]]) }), /cannot serve a door named/)
    assert.equal(existsSync(operatorDoorPaths(dir).doorFile), false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('the stop withdraws only this process\'s files; the client says why it cannot call', async (t) => {
  const dir = root()
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  assert.deepEqual(await callOperatorDoor(dir, 'echo', {}), { ok: false, error: 'no-door', message: 'the board is not running: there is no board-door.json' })
  const door = await startOperatorDoor({ root: dir, peerAccount: own, doors: new Map([['echo', (a) => a]]) })
  const { doorFile, tokenFile } = operatorDoorPaths(dir)
  assert.equal((await callOperatorDoor(dir, 'echo', {}, { isAlive: () => false })).error, 'no-door')
  assert.deepEqual(withdrawOperatorDoor(dir, process.pid + 1), { removed: false, reason: `board-door.json names process ${process.pid}, not this one` })
  assert.ok(existsSync(doorFile))
  await door.stop()
  await door.stop()
  assert.equal(existsSync(doorFile), false)
  assert.equal(existsSync(tokenFile), false)
  // A document naming another process is left in place by a stop that no longer owns it.
  const other = await startOperatorDoor({ root: dir, peerAccount: own, doors: new Map(), pid: 999_999 })
  writeFileSync(doorFile, JSON.stringify({ ...other.document, pid: 1 }))
  await other.stop()
  assert.ok(existsSync(doorFile), 'a newer board\'s file is not removed')
  // A token outside the root is refused by the client.
  writeFileSync(doorFile, JSON.stringify({ ...other.document, pid: process.pid, tokenFile: path.join(tmpdir(), 'elsewhere') }))
  assert.equal((await callOperatorDoor(dir, 'echo', {})).message, 'board-door.json names a token outside the registry root')
})
// #endregion operator-door-test

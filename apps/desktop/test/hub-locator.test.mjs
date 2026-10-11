// How a coding agent outside Fabric finds the live hub (ADR-0134 §1): `locateHub` reads hub.json with the hub's
// own bounded reader, refuses anything that is not a live Fabric hub, and returns the door token read from the
// file hub.json names. Pure — no database, no Electron, no network.
import { mkdtempSync, writeFileSync, mkdirSync, symlinkSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

const { publishHub, locateHub, HUB_PROTOCOL } = await import(path.resolve(import.meta.dirname, '../src/main/hub.ts'))

const fresh = () => mkdtempSync(path.join(tmpdir(), 'fabric-locate-'))
const alive = () => true
const dead = () => false

test('a live hub: its origin, its MCP url and the door token from the file it names', () => {
  const root = fresh()
  const p = publishHub({ root, port: 47070, pid: 4242 })
  const r = locateHub(root, { isAlive: alive })
  assert.equal(r.ok, true)
  assert.equal(r.origin, 'http://127.0.0.1:47070')
  assert.equal(r.mcpUrl, 'http://127.0.0.1:47070/mcp')
  assert.equal(r.doorToken, p.doorToken)
  assert.equal(r.pid, 4242)
})

test('no hub.json: Fabric is not running', () => {
  const r = locateHub(fresh(), { isAlive: alive })
  assert.deepEqual([r.ok, r.code], [false, 'not-running'])
})

test('a dead pid: the file is left over, whatever answers on the port is not Fabric', () => {
  const root = fresh()
  publishHub({ root, port: 47070, pid: 4242 })
  const r = locateHub(root, { isAlive: dead })
  assert.deepEqual([r.ok, r.code], [false, 'not-running'])
  assert.match(r.reason, /4242/)
})

test('another protocol, a non-loopback origin or a malformed file is not a hub', () => {
  for (const doc of [
    { protocol: 'fabric-hub/9', origin: 'http://127.0.0.1:47070', mcp: '/mcp', doorTokenFile: 'x', pid: 1, startedAt: 'x' },
    { protocol: HUB_PROTOCOL, origin: 'http://localhost:47070', mcp: '/mcp', doorTokenFile: 'x', pid: 1, startedAt: 'x' },
    { protocol: HUB_PROTOCOL, origin: 'http://10.0.0.5:47070', mcp: '/mcp', doorTokenFile: 'x', pid: 1, startedAt: 'x' },
    { protocol: HUB_PROTOCOL, origin: 'http://127.0.0.1:47070', mcp: '/other', doorTokenFile: 'x', pid: 1, startedAt: 'x' },
    'not json'
  ]) {
    const root = fresh()
    writeFileSync(path.join(root, 'hub.json'), typeof doc === 'string' ? doc : JSON.stringify(doc), { mode: 0o600 })
    const r = locateHub(root, { isAlive: alive })
    assert.deepEqual([r.ok, r.code], [false, 'not-a-hub'], JSON.stringify(doc))
  }
})

test('a door token file outside the registry root is refused, never read', () => {
  const root = fresh()
  const elsewhere = path.join(fresh(), 'token')
  // A token of the right shape, so only the root check can refuse it.
  writeFileSync(elsewhere, 'A'.repeat(43), { mode: 0o600 })
  writeFileSync(path.join(root, 'hub.json'), JSON.stringify({
    protocol: HUB_PROTOCOL, origin: 'http://127.0.0.1:47070', mcp: '/mcp', doorTokenFile: elsewhere, pid: 1, startedAt: 'x'
  }), { mode: 0o600 })
  const r = locateHub(root, { isAlive: alive })
  assert.deepEqual([r.ok, r.code], [false, 'not-a-hub'])
  assert.equal(JSON.stringify(r).includes('A'.repeat(43)), false)
})

test('a symlink or a FIFO in place of hub.json is refused without blocking', { skip: process.platform === 'win32' }, () => {
  const root = fresh()
  const real = path.join(fresh(), 'hub.json')
  publishHub({ root: path.dirname(real), port: 47070, pid: 1 })
  symlinkSync(real, path.join(root, 'hub.json'))
  assert.deepEqual([locateHub(root, { isAlive: alive }).code], ['not-a-hub'])
  const fifoRoot = fresh()
  execFileSync('mkfifo', [path.join(fifoRoot, 'hub.json')])
  assert.deepEqual([locateHub(fifoRoot, { isAlive: alive }).code], ['not-a-hub'])
})

test('a missing door token file while hub.json exists: the hub is starting or stopping', () => {
  const root = fresh()
  mkdirSync(root, { recursive: true })
  writeFileSync(path.join(root, 'hub.json'), JSON.stringify({
    protocol: HUB_PROTOCOL, origin: 'http://127.0.0.1:47070', mcp: '/mcp', doorTokenFile: path.join(root, 'hub-door-token'), pid: 1, startedAt: 'x'
  }), { mode: 0o600 })
  const r = locateHub(root, { isAlive: alive })
  assert.deepEqual([r.ok, r.code], [false, 'not-running'])
})

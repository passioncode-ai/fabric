// hub.json and the door token (ADR-0115 §1), on a real filesystem: modes, atomic contents, rotation on
// every start, and removal only by the process that wrote them. Pure — no database, no Electron.
import { mkdtempSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

const { publishHub, withdrawHub, hubPort, checkPortUnclaimed, DEFAULT_HUB_PORT, HUB_PROTOCOL } = await import(path.resolve(import.meta.dirname, '../src/main/hub.ts'))

const mode = (f) => statSync(f).mode & 0o777

test('publish writes the door token and hub.json, both 0600, hub.json naming the token file', () => {
  const root = path.join(mkdtempSync(path.join(tmpdir(), 'fabric-hub-')), 'ai.passioncode.fabric')
  const p = publishHub({ root, port: 47070, pid: 4242, now: () => new Date('2026-10-03T12:00:00Z') })
  assert.equal(mode(root), 0o700)
  assert.equal(mode(p.hubFile), 0o600)
  assert.equal(mode(p.doorTokenFile), 0o600)
  assert.match(p.doorToken, /^[A-Za-z0-9_-]{43}$/, '32 random bytes, base64url')
  assert.equal(readFileSync(p.doorTokenFile, 'utf8'), p.doorToken)
  assert.deepEqual(JSON.parse(readFileSync(p.hubFile, 'utf8')), {
    protocol: HUB_PROTOCOL, origin: 'http://127.0.0.1:47070', mcp: '/mcp', doorTokenFile: p.doorTokenFile, pid: 4242, startedAt: '2026-10-03T12:00:00.000Z'
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

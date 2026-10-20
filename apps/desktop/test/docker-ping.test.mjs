// 0.3.7 review ER-4: at start Fabric asks Docker whether it answers before it shows the stack's failure. Real unix
// sockets: an engine that answers /_ping, a socket that is not there yet, and one that accepts and never answers.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import http from 'node:http'
import net from 'node:net'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'

const { pingDocker, dockerTarget } = await import(path.resolve(import.meta.dirname, '../src/main/dockerPing.ts'))

const dir = mkdtempSync(path.join(tmpdir(), 'fdp-'))
const listen = (server, sock) => new Promise((r) => server.listen(sock, r))

test('an engine that answers /_ping with 200 is up', async () => {
  const sock = path.join(dir, 'ok.sock')
  const server = http.createServer((req, res) => { res.statusCode = req.url === '/_ping' ? 200 : 404; res.end('OK') })
  await listen(server, sock)
  try { assert.equal(await pingDocker(sock), true) } finally { server.close() }
})

test('a socket that is not there yet is "no", at once', async () => {
  const t0 = Date.now()
  assert.equal(await pingDocker(path.join(dir, 'missing.sock')), false)
  assert.ok(Date.now() - t0 < 1000)
})

test('a socket that accepts and never answers is "no" within the deadline', { timeout: 10_000 }, async () => {
  const sock = path.join(dir, 'mute.sock')
  const held = []
  const server = net.createServer((c) => held.push(c))
  await listen(server, sock)
  try {
    const t0 = Date.now()
    assert.equal(await pingDocker(sock, { deadlineMs: 300 }), false)
    assert.ok(Date.now() - t0 < 2000)
  } finally { held.forEach((c) => c.destroy()); server.close() }
})

test('an engine that answers an error is not up', async () => {
  const sock = path.join(dir, 'err.sock')
  const server = http.createServer((_req, res) => { res.statusCode = 500; res.end() })
  await listen(server, sock)
  try { assert.equal(await pingDocker(sock), false) } finally { server.close() }
})

test('the socket asked is the one named, else DOCKER_HOST, else the platform default', () => {
  assert.deepEqual(dockerTarget('/Users/x/.orbstack/run/docker.sock', {}), { socketPath: '/Users/x/.orbstack/run/docker.sock' })
  assert.deepEqual(dockerTarget(null, { DOCKER_HOST: 'unix:///run/user/1000/docker.sock' }), { socketPath: '/run/user/1000/docker.sock' })
  assert.deepEqual(dockerTarget(null, { DOCKER_HOST: 'tcp://127.0.0.1:2375' }), { host: '127.0.0.1', port: 2375 })
  assert.deepEqual(dockerTarget(null, { DOCKER_HOST: 'npipe:////./pipe/docker_engine' }), { socketPath: '\\\\.\\pipe\\docker_engine' })
  assert.deepEqual(dockerTarget(null, {}, 'darwin'), { socketPath: '/var/run/docker.sock' })
  assert.deepEqual(dockerTarget(null, {}, 'win32'), { socketPath: '\\\\.\\pipe\\docker_engine' })
})

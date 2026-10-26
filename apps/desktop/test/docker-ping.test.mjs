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

// 0.3.13 (Colima, the operator's В-4): with no DOCKER_HOST, the engine the docker CLI itself would use is the current
// context's (DOCKER_CONTEXT, else config.json's currentContext); Colima publishes no /var/run/docker.sock by default.
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'

const contextHome = (name, host, { current = name } = {}) => {
  const home = mkdtempSync(path.join(tmpdir(), 'fdc-'))
  const cfg = path.join(home, '.docker')
  mkdirSync(cfg, { recursive: true })
  writeFileSync(path.join(cfg, 'config.json'), JSON.stringify(current ? { currentContext: current } : {}))
  if (host) {
    const meta = path.join(cfg, 'contexts', 'meta', createHash('sha256').update(name).digest('hex'))
    mkdirSync(meta, { recursive: true })
    writeFileSync(path.join(meta, 'meta.json'), JSON.stringify({ Name: name, Endpoints: { docker: { Host: host } } }))
  }
  return home
}

test('with no DOCKER_HOST the current docker context names the engine (Colima)', () => {
  const home = contextHome('colima', 'unix:///Users/x/.colima/default/docker.sock')
  assert.deepEqual(dockerTarget(null, { HOME: home }, 'darwin'), { socketPath: '/Users/x/.colima/default/docker.sock' })
  // DOCKER_CONFIG names the folder instead of ~/.docker
  assert.deepEqual(dockerTarget(null, { DOCKER_CONFIG: path.join(home, '.docker') }, 'darwin'), { socketPath: '/Users/x/.colima/default/docker.sock' })
})

test('DOCKER_CONTEXT outranks currentContext, DOCKER_HOST outranks both, a named socket outranks all', () => {
  const home = contextHome('colima', 'unix:///Users/x/.colima/default/docker.sock', { current: 'orbstack' })
  assert.deepEqual(dockerTarget(null, { HOME: home }, 'darwin'), { socketPath: '/var/run/docker.sock' })
  assert.deepEqual(dockerTarget(null, { HOME: home, DOCKER_CONTEXT: 'colima' }, 'darwin'), { socketPath: '/Users/x/.colima/default/docker.sock' })
  assert.deepEqual(dockerTarget(null, { HOME: home, DOCKER_CONTEXT: 'colima', DOCKER_HOST: 'tcp://127.0.0.1:2375' }), { host: '127.0.0.1', port: 2375 })
  assert.deepEqual(dockerTarget('/s.sock', { HOME: home, DOCKER_CONTEXT: 'colima' }), { socketPath: '/s.sock' })
})

test('the default context, a missing or broken context falls back to the platform default', () => {
  assert.deepEqual(dockerTarget(null, { HOME: contextHome('default', null) }, 'darwin'), { socketPath: '/var/run/docker.sock' })
  assert.deepEqual(dockerTarget(null, { HOME: contextHome('gone', null) }, 'darwin'), { socketPath: '/var/run/docker.sock' })
  const broken = contextHome('colima', 'unix:///x.sock')
  writeFileSync(path.join(broken, '.docker', 'config.json'), '{not json')
  assert.deepEqual(dockerTarget(null, { HOME: broken }, 'darwin'), { socketPath: '/var/run/docker.sock' })
  // an endpoint that is no unix socket, pipe or tcp address is ignored
  assert.deepEqual(dockerTarget(null, { HOME: contextHome('ssh', 'ssh://me@box') }, 'darwin'), { socketPath: '/var/run/docker.sock' })
})

test('a context whose engine answers is up through pingDocker', async () => {
  const sock = path.join(dir, 'ctx.sock')
  const server = http.createServer((req, res) => { res.statusCode = req.url === '/_ping' ? 200 : 404; res.end('OK') })
  await listen(server, sock)
  try { assert.equal(await pingDocker(null, { env: { HOME: contextHome('colima', `unix://${sock}`) }, platform: 'darwin' }), true) } finally { server.close() }
})

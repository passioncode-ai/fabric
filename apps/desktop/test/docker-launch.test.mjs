// CO-294 (the start half): Docker away at start starts Docker's own app, chosen by where the docker CLI would connect,
// and nothing when that place is not an app Fabric knows (a network engine, Colima, Linux, an app not installed).
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'

const { dockerAppFor, launchDockerApp } = await import(path.resolve(import.meta.dirname, '../src/main/dockerLaunch.ts'))

const HOME = '/Users/p'
const env = { HOME }
const has = (...paths) => (p) => paths.includes(p)
const ORB = '/Applications/OrbStack.app'
const DD = '/Applications/Docker.app'

test('an OrbStack socket starts OrbStack, in the background', () => {
  const app = dockerAppFor(`${HOME}/.orbstack/run/docker.sock`, { env, platform: 'darwin', exists: has(ORB, DD) })
  assert.deepEqual(app, { name: 'OrbStack', command: 'open', args: ['-g', '-a', ORB] })
})

test('an app installed in ~/Applications is found there', () => {
  const app = dockerAppFor(`${HOME}/.orbstack/run/docker.sock`, { env, platform: 'darwin', exists: has(`${HOME}/Applications/OrbStack.app`) })
  assert.deepEqual(app?.args, ['-g', '-a', `${HOME}/Applications/OrbStack.app`])
})

test('a Docker Desktop socket starts Docker Desktop', () => {
  const app = dockerAppFor(`${HOME}/.docker/run/docker.sock`, { env, platform: 'darwin', exists: has(ORB, DD) })
  assert.deepEqual(app, { name: 'Docker Desktop', command: 'open', args: ['-g', '-a', DD] })
})

test('the shared /var/run/docker.sock starts whichever is installed, OrbStack first', () => {
  assert.equal(dockerAppFor(null, { env, platform: 'darwin', exists: has(ORB, DD) })?.name, 'OrbStack')
  assert.equal(dockerAppFor(null, { env, platform: 'darwin', exists: has(DD) })?.name, 'Docker Desktop')
  assert.equal(dockerAppFor(null, { env, platform: 'darwin', exists: has() }), null)
})

test('the app the socket belongs to, when it is not installed, starts nothing', () => {
  assert.equal(dockerAppFor(`${HOME}/.orbstack/run/docker.sock`, { env, platform: 'darwin', exists: has(DD) }), null)
})

test('Colima, a network engine and Linux start nothing', () => {
  assert.equal(dockerAppFor(`${HOME}/.colima/default/docker.sock`, { env, platform: 'darwin', exists: has(ORB, DD) }), null)
  assert.equal(dockerAppFor(null, { env: { HOME, DOCKER_HOST: 'tcp://10.0.0.5:2375' }, platform: 'darwin', exists: has(ORB, DD) }), null)
  assert.equal(dockerAppFor(null, { env, platform: 'linux', exists: () => true }), null)
})

test('on Windows the engine pipe starts Docker Desktop when its program is there', () => {
  const exe = 'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe'
  const winEnv = { ProgramFiles: 'C:\\Program Files' }
  assert.deepEqual(dockerAppFor(null, { env: winEnv, platform: 'win32', exists: has(exe) }), { name: 'Docker Desktop', command: exe, args: [] })
  assert.equal(dockerAppFor(null, { env: winEnv, platform: 'win32', exists: has() }), null)
})

test('the launch is detached and unreferenced, and a spawn that fails answers null', async () => {
  const calls = []
  const fake = (command, args, opts) => {
    calls.push({ command, args, opts })
    return { once(ev, cb) { if (ev === 'spawn') setImmediate(cb) }, unref() { calls.at(-1).unref = true } }
  }
  const name = await launchDockerApp({ name: 'OrbStack', command: 'open', args: ['-g', '-a', ORB] }, { spawnImpl: fake })
  assert.equal(name, 'OrbStack')
  assert.equal(calls[0].opts.detached, true)
  assert.equal(calls[0].opts.stdio, 'ignore')
  assert.equal(calls[0].unref, true)
  const broken = () => ({ once(ev, cb) { if (ev === 'error') setImmediate(() => cb(new Error('ENOENT'))) }, unref() {} })
  assert.equal(await launchDockerApp({ name: 'OrbStack', command: 'open', args: [] }, { spawnImpl: broken }), null)
  assert.equal(await launchDockerApp(null), null)
})

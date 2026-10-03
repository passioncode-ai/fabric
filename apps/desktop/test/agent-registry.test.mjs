// The registry reader (ADR-0115 S1, AR-2.2): `services/` and `providers/` on disk become one
// in-memory registry keyed `id[.instance]`. Driven against REAL directories built here — valid
// entries, a half-written file, a foreign protocol, a provider and a service claiming one id, two
// services claiming one port — because the property that matters is what a malformed file does to
// the rest (nothing), and which agent a consent prompt may name (only one the registry resolves).

import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

const SRC = path.resolve(import.meta.dirname, '../src/main/agentRegistry.ts')
const { AgentRegistry, readRegistry, registryDirs, validateServiceDescriptor, validateProviderEntry } = await import(SRC)

const NOW = '2026-10-03T10:00:00Z'
const service = (id, instance, port, extra = {}) => ({
  protocol: 'fabric-service/0.1', id, instance, name: `${id} service`, origin: `http://127.0.0.1:${port}`,
  auth: { tokenFile: `~/.config/${id}/token` }, lifecycle: { manager: 'none' },
  paths: { data: `~/.local/share/${id}`, logs: [] }, installedAt: NOW, installedBy: 'example-installer', ...extra
})
const provider = (id, extra = {}) => ({
  protocol: 'fabric-provider/0.1', id, providerId: `https://example.com/agents/${id}`, name: `${id} provider`,
  manifest: `~/agents/${id}/fabric-agent.json`, run: { mcp: { url: 'http://127.0.0.1:47555/mcp' } },
  installedAt: NOW, installedBy: 'example-installer', ...extra
})

function home() {
  const root = mkdtempSync(path.join(tmpdir(), 'fabric-registry-'))
  const services = path.join(root, 'services')
  const providers = path.join(root, 'providers')
  mkdirSync(services); mkdirSync(providers)
  return { root, services, providers }
}
const put = (dir, name, value) => writeFileSync(path.join(dir, name), typeof value === 'string' ? value : JSON.stringify(value))

test('directories follow the contract: FABRIC_SERVICES_DIR / FABRIC_PROVIDERS_DIR, else the platform root', () => {
  const mac = registryDirs({}, 'darwin', '/Users/example')
  assert.equal(mac.services, '/Users/example/Library/Application Support/ai.passioncode.fabric/services')
  assert.equal(mac.providers, '/Users/example/Library/Application Support/ai.passioncode.fabric/providers')
  const linux = registryDirs({}, 'linux', '/home/example')
  assert.equal(linux.providers, '/home/example/.local/share/passioncode-fabric/providers')
  const over = registryDirs({ FABRIC_SERVICES_DIR: '~/s', FABRIC_PROVIDERS_DIR: '/p' }, 'darwin', '/Users/example')
  assert.deepEqual([over.services, over.providers], ['/Users/example/s', '/p'])
})

test('a valid service and a valid provider become entries with the fields a prompt names', () => {
  const h = home()
  put(h.services, 'example-agent.default.json', service('example-agent', 'default', 47501, {
    source: { repository: 'https://github.com/example/example-agent' }, summary: 'reads one mailbox'
  }))
  put(h.providers, 'example-tool.json', provider('example-tool'))
  const snap = readRegistry({ servicesDir: h.services, providersDir: h.providers })
  assert.deepEqual(snap.problems, [])
  const svc = snap.entries.find((e) => e.key === 'example-agent.default')
  assert.equal(svc.kind, 'service')
  assert.equal(svc.name, 'example-agent service')
  assert.equal(svc.origin, 'http://127.0.0.1:47501')
  assert.equal(svc.placement, 'local')
  assert.equal(svc.installedBy, 'example-installer')
  assert.equal(svc.repository, 'https://github.com/example/example-agent')
  assert.equal(svc.mcp, null, 'a service names its MCP path in its well-known document, which the reader does not fetch')
  const prov = snap.entries.find((e) => e.key === 'example-tool')
  assert.equal(prov.kind, 'provider')
  assert.equal(prov.instance, null)
  assert.deepEqual(prov.mcp, { transport: 'streamable-http', url: 'http://127.0.0.1:47555/mcp', path: '/mcp' })
  rmSync(h.root, { recursive: true, force: true })
})

test('a malformed file is a logged problem with its reason, never a throw, and never hides the others', () => {
  const h = home()
  put(h.services, 'good.default.json', service('good', 'default', 47502))
  put(h.services, 'half.default.json', '{"protocol": "fabric-service/0.1", "id": "ha')
  put(h.services, 'foreign.default.json', { ...service('foreign', 'default', 47503), protocol: 'other/1' })
  put(h.services, 'misnamed.default.json', service('other-name', 'default', 47504))
  put(h.services, 'extra.default.json', { ...service('extra', 'default', 47505), token: 'x' })
  put(h.providers, 'bad-env.json', provider('bad-env', { run: { mcp: { stdio: { command: ['/bin/agent'], env: { API_KEY: 'plain-value' } } } } }))
  put(h.providers, 'no-provider-id.json', (() => { const p = provider('no-provider-id'); delete p.providerId; return p })())
  put(h.services, 'README.txt', 'ignored: not json')
  const snap = readRegistry({ servicesDir: h.services, providersDir: h.providers })
  assert.deepEqual(snap.entries.map((e) => e.key), ['good.default'])
  const by = Object.fromEntries(snap.problems.map((p) => [path.basename(p.file), p]))
  assert.equal(by['half.default.json'].code, 'unreadable')
  assert.match(by['foreign.default.json'].reason, /protocol must be fabric-service\/0\.1/)
  assert.equal(by['foreign.default.json'].code, 'foreign')
  assert.match(by['misnamed.default.json'].reason, /named misnamed\.default\.json but describes other-name\.default/)
  assert.match(by['extra.default.json'].reason, /unknown field token/)
  assert.match(by['bad-env.json'].reason, /secret reference/)
  assert.match(by['no-provider-id.json'].reason, /missing providerId/)
  for (const p of snap.problems) assert.equal(typeof p.reason, 'string')
  rmSync(h.root, { recursive: true, force: true })
})

test('an absent directory is an empty registry; an unreadable one is a problem, not a crash', () => {
  const h = home()
  const snap = readRegistry({ servicesDir: path.join(h.root, 'nope'), providersDir: path.join(h.root, 'nope2') })
  assert.deepEqual(snap, { entries: [], problems: [], readAt: snap.readAt })
  chmodSync(h.services, 0o000)
  const locked = readRegistry({ servicesDir: h.services, providersDir: h.providers })
  chmodSync(h.services, 0o700)
  assert.equal(locked.entries.length, 0)
  assert.equal(locked.problems[0].code, 'unreadable')
  rmSync(h.root, { recursive: true, force: true })
})

test('FAC-SEM-013: an id in both services/ and providers/ resolves to neither', () => {
  const h = home()
  put(h.services, 'twin.default.json', service('twin', 'default', 47506))
  put(h.providers, 'twin.json', provider('twin'))
  const reg = new AgentRegistry({ servicesDir: h.services, providersDir: h.providers })
  reg.refresh()
  assert.equal(reg.snapshot().problems.filter((p) => p.code === 'id-collision').length, 2)
  const r = reg.resolve('twin')
  assert.equal(r.ok, false)
  assert.match(r.reason, /claimed by both/)
  assert.equal(reg.resolve('twin.default').ok, false)
  rmSync(h.root, { recursive: true, force: true })
})

test('FAC-SEM-010: two services claiming one port both stay listed, and the port is reported claimed', () => {
  const h = home()
  put(h.services, 'one.default.json', service('one', 'default', 47507))
  put(h.services, 'two.default.json', service('two', 'default', 47507))
  const reg = new AgentRegistry({ servicesDir: h.services, providersDir: h.providers })
  reg.refresh()
  assert.equal(reg.snapshot().problems.filter((p) => p.code === 'port-claimed').length, 2)
  assert.ok(reg.claimedPorts().has(47507))
  rmSync(h.root, { recursive: true, force: true })
})

test('resolve: a provider id, a service id.instance, a bare service id meaning .default — and nothing else', () => {
  const h = home()
  put(h.services, 'example-agent.default.json', service('example-agent', 'default', 47508))
  put(h.services, 'example-agent.preview.json', service('example-agent', 'preview', 47509))
  put(h.services, 'only-preview.preview.json', service('only-preview', 'preview', 47510))
  put(h.providers, 'example-tool.json', provider('example-tool'))
  const reg = new AgentRegistry({ servicesDir: h.services, providersDir: h.providers })
  reg.refresh()
  assert.equal(reg.resolve('example-agent').entry.key, 'example-agent.default')
  assert.equal(reg.resolve('example-agent.preview').entry.key, 'example-agent.preview')
  assert.equal(reg.resolve('example-tool').entry.key, 'example-tool')
  assert.equal(reg.resolve('only-preview').ok, false, 'a bare id is .default, never "whichever instance there is"')
  assert.equal(reg.resolve('nobody').ok, false)
  assert.match(reg.resolve('nobody').reason, /not registered/)
  assert.equal(reg.resolve('Bad Id').ok, false)
  assert.match(reg.resolve('Bad Id').reason, /not a registry id/)
  assert.equal(reg.resolve('example-tool.default').ok, false, 'a provider has no instance')
  rmSync(h.root, { recursive: true, force: true })
})

test('refresh picks up a new file; watch() notices it without being asked', async () => {
  const h = home()
  const reg = new AgentRegistry({ servicesDir: h.services, providersDir: h.providers, debounceMs: 20 })
  reg.refresh()
  assert.equal(reg.resolve('late').ok, false)
  let changed = 0
  const stop = reg.watch(() => { changed++ })
  put(h.providers, 'late.json', provider('late'))
  // fs.watch on macOS is FSEvents, delivered late under load: wait up to 15 s, polling the registry
  // the watcher refreshes — never calling refresh() here, which would prove nothing about the watch.
  for (let i = 0; i < 300 && !reg.resolve('late').ok; i++) await new Promise((r) => setTimeout(r, 50))
  stop()
  assert.equal(reg.resolve('late').ok, true)
  assert.ok(changed >= 1)
  rmSync(h.root, { recursive: true, force: true })
})

test('remote placement: an https origin with lifecycle none is valid; an IP literal is not', () => {
  const remote = service('online', 'default', 0, { placement: 'remote', origin: 'https://online.example.com' })
  delete remote.paths
  assert.deepEqual(validateServiceDescriptor(remote), [])
  assert.notDeepEqual(validateServiceDescriptor({ ...remote, origin: 'https://10.0.0.1' }), [])
  assert.notDeepEqual(validateServiceDescriptor({ ...remote, lifecycle: { manager: 'launchd', label: 'a.b.c', plist: '/x.plist' } }), [])
  assert.deepEqual(validateProviderEntry(provider('ok-provider')), [])
})

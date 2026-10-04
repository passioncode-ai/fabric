// #region onboarding-fixture-containment — docs: docs/handoffs/2026-10-04-onboarding-native-fixture.md#scope-and-contract
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import { DEFAULT_CONFIG, SCENARIOS, MARKER, desktop, scenarioConfig, validateConfig, prepareFixture,
  loadFixture, createFixtureHost, ownedPath, allowBrowserURL, validateTypedFixtures, backendRows, runnerRows } from './onboarding-visual-native-harness.mjs'
const require = createRequire(import.meta.url)
const roots = []
const prepared = (name = 'balanced', overrides = {}) => { const root = prepareFixture(scenarioConfig(name, overrides)); roots.push(root); return root }
const marker = root => JSON.parse(fs.readFileSync(path.join(root, MARKER), 'utf8'))
const rewrite = (root, value) => fs.writeFileSync(path.join(root, MARKER), JSON.stringify(value), { mode: 0o600 })
const input = { id: 'fixture-project-1', name: 'Fixture one', purpose: 'Synthetic purpose', repoPaths: [], memoryBackend: 'local', defaultAgent: 'claude-code' }
test.after(() => { for (const root of roots) fs.rmSync(root, { recursive: true, force: true }) })

test('all declared synthetic modes compile against actual current IPC result types', () => {
  for (const name of Object.keys(SCENARIOS)) assert.equal(validateConfig(scenarioConfig(name)).version, 1)
  assert.equal(validateTypedFixtures(), true)
  assert.equal(backendRows('none').length, 0); assert.equal(backendRows('one').length, 1)
  assert.deepEqual(backendRows('unavailable')[1], { id: 'cloud', available: false, reason: 'hosted-estates-not-built' })
  assert.equal(backendRows('two').filter(row => row.available).length, 2)
  assert.equal(runnerRows('mixed').find(row => row.id === 'terminal').program, null)
})
test('unknown config, delay, size and response modes fail closed', () => {
  for (const changed of [{ privilegedChannel: 'terminal:open' }, { backends: 'invented' }, { create: 'custom-result' },
    { folderDelayMs: -1 }, { backendDelayMs: 20001 }, { timeoutMs: 1000, createDelayMs: 1000 }, { width: 4000 }, { locale: 'xx' }])
    assert.throws(() => validateConfig({ ...DEFAULT_CONFIG, ...changed }))
  assert.throws(() => scenarioConfig('unknown')); assert.throws(() => scenarioConfig('balanced', { ipc: {} }))
})
test('owned direct root, private permissions, marker and actual source/build pins are required', () => {
  const root = prepared(); assert.equal(loadFixture(root).marker.format, 'fabric-co179-test-fixture/1')
  assert.equal(fs.statSync(root).mode & 0o777, 0o700)
  assert.equal(fs.statSync(path.join(root, MARKER)).mode & 0o777, 0o600)
  assert.throws(() => loadFixture(undefined)); assert.throws(() => loadFixture(path.join(root, 'userData')))
  const original = marker(root)
  fs.unlinkSync(path.join(root, MARKER)); assert.throws(() => loadFixture(root)); rewrite(root, original)
  rewrite(root, { ...original, format: 'forged-owner' }); assert.throws(() => loadFixture(root)); rewrite(root, original)
  const changed = structuredClone(original); changed.sourcePins['shared/types.ts'] = 'forged'
  rewrite(root, changed); assert.throws(() => loadFixture(root), /product source drift/); rewrite(root, original)
  const changedBuild = structuredClone(original); changedBuild.buildPins['out/preload/index.cjs'] = 'forged'
  rewrite(root, changedBuild); assert.throws(() => loadFixture(root), /product build drift/); rewrite(root, original)
})
test('symlink and foreign paths refuse before any local-state effect', async () => {
  const root = prepared(); const foreign = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'co179-foreign-canary-'))
  try {
    const canary = path.join(foreign, 'canary'); fs.writeFileSync(canary, 'untouched')
    assert.throws(() => ownedPath(root, canary), /outside fixture/)
    assert.throws(() => ownedPath(root, path.join(root, 'synthetic-parent') + '/../escape'), /normal absolute/)
    const link = path.join(root, 'synthetic-parent', 'redirect'); fs.symlinkSync(foreign, link)
    assert.throws(() => loadFixture(root), /symlink/); fs.unlinkSync(link)
    const host = createFixtureHost(root)
    await assert.rejects(host.invoke(host.IPC.startCreateFolder, [{ parent: foreign, name: 'X', git: true }]))
    await assert.rejects(host.invoke(host.IPC.startChooseFolder, ['repository']))
    await assert.rejects(host.invoke(host.IPC.projectsCreate, [{ ...input, repoPaths: [foreign] }]))
    assert.equal(fs.readFileSync(canary, 'utf8'), 'untouched'); assert.deepEqual(host.records(), [])
  } finally { fs.rmSync(foreign, { recursive: true, force: true }) }
})
test('compiled module forgery cannot self-approve by replacing its marker hash', () => {
  const root = prepared(); const value = marker(root); const relative = 'modules/main/onboardingDrafts.cjs'
  const file = path.join(root, relative); const original = fs.readFileSync(file)
  const forged = Buffer.concat([original, Buffer.from('\nrequire("node:child_process").execSync("should-never-run");')])
  fs.writeFileSync(file, forged)
  value.modulePins[relative] = createHash('sha256').update(forged).digest('hex'); rewrite(root, value)
  assert.throws(() => loadFixture(root), /forged compiled module provenance/)
})
test('six typed synthetic handlers are admitted; folder path and create stay synthetic', async () => {
  const root = prepared(); const host = createFixtureHost(root)
  for (const key of ['startChooseFolder', 'startCreateFolder', 'reposChoose', 'projectsCreate', 'terminalMemoryBackends', 'terminalOptions'])
    assert.ok(host.channels.includes(host.IPC[key]))
  const parent = await host.invoke(host.IPC.startChooseFolder, ['parent', undefined])
  const result = await host.invoke(host.IPC.startCreateFolder, [{ parent, name: 'Fixture one', git: true }])
  assert.deepEqual(result, { ok: true, path: path.join(parent, 'Fixture one') })
  assert.equal(fs.existsSync(result.path), false, 'synthetic folder handler does not mkdir or git init')
  assert.deepEqual(await host.invoke(host.IPC.reposChoose), [path.join(root, 'synthetic-repo')])
  assert.deepEqual(await host.invoke(host.IPC.terminalMemoryBackends), backendRows('unavailable'))
  assert.deepEqual(await host.invoke(host.IPC.terminalOptions), runnerRows('mixed'))
  const before = fs.readFileSync(path.join(root, 'userData/onboarding-drafts.json'), 'utf8')
  const row = await host.invoke(host.IPC.projectsCreate, [input])
  assert.equal(row.id, input.id); assert.equal(row.estate_id, 'co179-fixture-estate'); assert.equal(row.memory_backend, 'local')
  assert.deepEqual(host.records(), [row]); assert.equal(fs.readFileSync(path.join(root, 'userData/onboarding-drafts.json'), 'utf8'), before)
  assert.deepEqual(fs.readdirSync(path.join(root, 'userData')).sort(), ['onboarding-drafts.json', 'onboarding-drafts.json.last-good', 'settings.json', 'settings.json.last-good'])
  const audit = fs.readFileSync(path.join(root, 'audit.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line))
  assert.ok(audit.some(line => line.channel === host.IPC.projectsCreate && line.kind === 'response' && line.synthetic === true))
})
test('unregistered privileged channels trigger no live transport, subprocess or product-data effects', async () => {
  const root = prepared(); const host = createFixtureHost(root); const before = fs.readFileSync(path.join(root, 'userData/onboarding-drafts.json'))
  let effects = 0; const replacements = []; const deny = () => { effects++; throw Error('live effect forbidden') }
  for (const [object, keys] of [[globalThis, ['fetch']], [require('node:child_process'), ['spawn', 'exec', 'execFile', 'execSync']],
    [require('node:net'), ['connect', 'createConnection']], [require('node:http'), ['request', 'get']]]) {
    for (const key of keys) { replacements.push([object, key, object[key]]); object[key] = deny }
  }
  try {
    for (const channel of ['terminal:open', 'projects:import', 'settings:write', 'repos:scan', 'hub:grant', 'vault:read', 'unknown:channel'])
      await assert.rejects(host.invoke(channel, [{ privileged: true }]), /unregistered/)
    // Positive create is also synthetic while live transport/process APIs are denied.
    await host.invoke(host.IPC.projectsCreate, [input])
    assert.equal(effects, 0)
    assert.deepEqual(fs.readFileSync(path.join(root, 'userData/onboarding-drafts.json')), before)
  } finally { for (const [object, key, original] of replacements) object[key] = original }
})
test('actual product Draft and atomic local-state modules save only bounded fixture disk', async () => {
  const root = prepared(); const host = createFixtureHost(root); const read = await host.invoke(host.IPC.draftsRead)
  read.drafts['draft-1'].name = 'Preserved fixture edit'; read.drafts['draft-1'].repoPaths = [path.join(root, 'synthetic-repo')]
  assert.deepEqual(await host.invoke(host.IPC.draftsSave, [read.drafts]), { saved: true, reason: null })
  const disk = JSON.parse(fs.readFileSync(path.join(root, 'userData/onboarding-drafts.json'), 'utf8'))
  assert.equal(disk['draft-1'].name, 'Preserved fixture edit')
  assert.equal((await createFixtureHost(root).invoke(host.IPC.draftsRead)).drafts['draft-1'].name, 'Preserved fixture edit')
  const before = fs.readFileSync(path.join(root, 'userData/onboarding-drafts.json'))
  read.drafts['draft-1'].repoPaths = ['/foreign/repository']
  await assert.rejects(host.invoke(host.IPC.draftsSave, [read.drafts]))
  await assert.rejects(host.invoke(host.IPC.draftsSave, [{ bad: { ...read.drafts['draft-1'], name: 'x'.repeat(70000) } }]), /64 KiB/)
  assert.deepEqual(fs.readFileSync(path.join(root, 'userData/onboarding-drafts.json')), before)
})
test('controlled folder and create refusal/cancellation modes return current product shapes', async () => {
  for (const name of ['folder-exists', 'folder-outside', 'folder-failed', 'folder-invalid', 'cancel', 'refusal', 'repo-refusal']) {
    const root = prepared(name); const host = createFixtureHost(root)
    const parent = await host.invoke(host.IPC.startChooseFolder, ['parent'])
    if (name === 'cancel') { assert.equal(parent, null); assert.deepEqual(await host.invoke(host.IPC.reposChoose), []) }
    else if (name.startsWith('folder-')) {
      const result = await host.invoke(host.IPC.startCreateFolder, [{ parent, name: 'Fixture one', git: true }])
      assert.equal(result.ok, false); assert.equal(result.reason, { 'folder-exists': 'exists', 'folder-outside': 'outside', 'folder-failed': 'failed', 'folder-invalid': 'invalid-name' }[name])
    } else if (name === 'refusal') { await assert.rejects(host.invoke(host.IPC.projectsCreate, [input]), /synthetic-fixture/); assert.deepEqual(host.records(), []) }
    else await assert.rejects(host.invoke(host.IPC.reposChoose), /synthetic repo chooser refusal/)
  }
})
test('delayed responses snapshot initiating inputs and a closed owner causes no late mutation', async () => {
  const root = prepared('balanced', { createDelayMs: 25, backendDelayMs: 25 })
  let alive = true; const host = createFixtureHost(root, { alive: () => alive })
  const original = structuredClone(input); const pending = host.invoke(host.IPC.projectsCreate, [original]); original.name = 'Different late draft'
  assert.equal((await pending).name, 'Fixture one')
  const second = prepared('balanced', { createDelayMs: 25 }); const closed = createFixtureHost(second, { alive: () => alive })
  const late = closed.invoke(closed.IPC.projectsCreate, [input]); alive = false
  await assert.rejects(late, /window closed before response/); assert.deepEqual(closed.records(), [])
  alive = true; assert.deepEqual(await host.invoke(host.IPC.terminalMemoryBackends), backendRows('unavailable'))
})
test('browser requests deny network and foreign local files', () => {
  assert.equal(allowBrowserURL('https://example.com'), false); assert.equal(allowBrowserURL('ws://127.0.0.1:5432'), false)
  assert.equal(allowBrowserURL(pathToFileURL('/etc/passwd').href), false)
  assert.equal(allowBrowserURL(pathToFileURL(path.join(desktop, 'out/renderer/index.html')).href), true)
})
test('synthetic project records have a hard count ceiling across changing owned draft IDs', async () => {
  const root = prepared(); const host = createFixtureHost(root)
  const read = await host.invoke(host.IPC.draftsRead)
  for (let i = 0; i < 64; i++) {
    read.drafts['draft-1'].projectId = `fixture-project-${i}`
    await host.invoke(host.IPC.draftsSave, [read.drafts])
    await host.invoke(host.IPC.projectsCreate, [{ ...input, id: read.drafts['draft-1'].projectId }])
  }
  assert.equal(host.records().length, 64)
  read.drafts['draft-1'].projectId = 'fixture-project-overflow'
  await host.invoke(host.IPC.draftsSave, [read.drafts])
  await assert.rejects(host.invoke(host.IPC.projectsCreate, [{ ...input, id: read.drafts['draft-1'].projectId }]), /synthetic project record limit/)
  assert.equal(host.records().length, 64)
})
test('fixture requests have a hard count ceiling', async () => {
  const root = prepared(); const host = createFixtureHost(root)
  for (let i = 0; i < 512; i++) await host.invoke(host.IPC.terminalMemoryBackends)
  await assert.rejects(host.invoke(host.IPC.terminalMemoryBackends), /fixture request limit/)
})
test('fixture audit has a hard byte ceiling', async () => {
  const root = prepared(); const host = createFixtureHost(root)
  fs.writeFileSync(path.join(root, 'audit.jsonl'), Buffer.alloc(8 * 1024 * 1024, 32), { mode: 0o600 })
  await assert.rejects(host.invoke(host.IPC.terminalMemoryBackends), /fixture audit byte limit/)
  assert.equal(fs.statSync(path.join(root, 'audit.jsonl')).size, 8 * 1024 * 1024)
})
// #endregion onboarding-fixture-containment

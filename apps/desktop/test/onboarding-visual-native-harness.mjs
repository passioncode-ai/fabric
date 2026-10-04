// #region onboarding-native-fixture — docs: docs/handoffs/2026-10-04-onboarding-native-fixture.md#scope-and-contract
/** Test-only CO179 host. Build real renderer/preload, then --prepare <scenario> with Node.
 * Launch this file with Electron44 --fixture <owned-temp> [--probe]. No production main.
 * Synthetic responses prove fixture capability, never production create or visual acceptance.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createHash, randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
export const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = path.join(desktop, 'src')
export const MARKER = 'CO179-FIXTURE.json'
const PREFIX = 'fabric-co179-fixture-'
const moduleNames = ['main/onboardingDrafts.ts', 'main/localState.ts', 'main/opsSink.ts',
  'shared/onboardingDraft.ts', 'shared/appSettings.ts', 'shared/types.ts', 'shared/readEnvelope.ts', 'shared/startPaths.ts']
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const digest = file => sha(fs.readFileSync(file))
const cloned = value => JSON.parse(JSON.stringify(value))
function exact(value, keys, label) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), `${label}: object required`)
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), `${label}: unknown or missing fields`)
}
function text(value, maximum = 512, allowEmpty = false) {
  assert.ok(typeof value === 'string' && value.length <= maximum && (allowEmpty || value.length > 0) && !/[\u0000-\u001f]/.test(value), 'bounded fixture string required')
}
const oneOf = (value, values) => assert.ok(values.includes(value), `unsupported fixture mode: ${value}`)
export const DEFAULT_CONFIG = Object.freeze({ version: 1, locale: 'en', drafts: 'restored',
  folder: 'ok', repos: 'selected', create: 'ok', backends: 'unavailable', runners: 'mixed',
  folderDelayMs: 0, createDelayMs: 0, backendDelayMs: 0, draftDelayMs: 0,
  timeoutMs: 60000, width: 1280, height: 900 })
export const SCENARIOS = Object.freeze({ balanced: {}, none: { backends: 'none', runners: 'none' },
  'long-repos': { repos: 'long' }, single: { backends: 'one' }, two: { backends: 'two' }, unread: { backendDelayMs: 3000 },
  creating: { folderDelayMs: 3000 }, saving: { createDelayMs: 3000 }, refusal: { create: 'refuse' },
  'folder-exists': { folder: 'exists' }, 'folder-outside': { folder: 'outside' },
  'folder-failed': { folder: 'failed' }, 'folder-invalid': { folder: 'invalid-name' },
  cancel: { folder: 'cancel', repos: 'cancel' }, 'repo-refusal': { repos: 'throw' },
  empty: { drafts: 'empty' }, corrupt: { drafts: 'corrupt' } })
export function validateConfig(value) {
  exact(value, Object.keys(DEFAULT_CONFIG), 'config')
  assert.equal(value.version, 1)
  oneOf(value.locale, ['en', 'ru']); oneOf(value.drafts, ['restored', 'empty', 'corrupt'])
  oneOf(value.folder, ['ok', 'cancel', 'invalid-name', 'exists', 'outside', 'failed'])
  oneOf(value.repos, ['selected', 'long', 'cancel', 'throw']); oneOf(value.create, ['ok', 'refuse'])
  oneOf(value.backends, ['none', 'one', 'unavailable', 'two']); oneOf(value.runners, ['mixed', 'none', 'unavailable'])
  for (const key of ['folderDelayMs', 'createDelayMs', 'backendDelayMs', 'draftDelayMs'])
    assert.ok(Number.isInteger(value[key]) && value[key] >= 0 && value[key] <= 20000, `${key}: 0..20000 required`)
  assert.ok(Number.isInteger(value.timeoutMs) && value.timeoutMs >= 1000 && value.timeoutMs <= 120000)
  assert.ok(Math.max(value.folderDelayMs, value.createDelayMs, value.backendDelayMs, value.draftDelayMs) < value.timeoutMs)
  assert.ok(Number.isInteger(value.width) && value.width >= 640 && value.width <= 1920)
  assert.ok(Number.isInteger(value.height) && value.height >= 480 && value.height <= 1200)
  return Object.freeze(cloned(value))
}
export function scenarioConfig(name, overrides = {}) {
  assert.ok(Object.hasOwn(SCENARIOS, name), 'unknown scenario')
  assert.ok(Object.keys(overrides).every(key => Object.hasOwn(DEFAULT_CONFIG, key)), 'unknown override')
  return validateConfig({ ...DEFAULT_CONFIG, ...SCENARIOS[name], ...overrides })
}
function safeJSON(value) {
  const raw = JSON.stringify(value)
  assert.ok(typeof raw === 'string' && Buffer.byteLength(raw) <= 65536, 'fixture payload exceeds 64 KiB')
  const parsed = structuredClone(value)
  function walk(v, depth = 0) {
    assert.ok(depth <= 8, 'fixture payload too deep')
    if (v && typeof v === 'object') {
      assert.ok(Object.keys(v).length <= 64, 'fixture payload too wide')
      for (const [k, item] of Object.entries(v)) {
        assert.ok(!['__proto__', 'prototype', 'constructor'].includes(k), 'prototype payload refused')
        walk(item, depth + 1)
      }
    }
  }
  walk(parsed)
  return parsed
}
function mkdir(dir) { fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); fs.chmodSync(dir, 0o700) }
function write(file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2), { mode: 0o600 }) }
function filesUnder(dir) {
  const result = []
  function visit(current) {
    for (const name of fs.readdirSync(current)) {
      const target = path.join(current, name); const st = fs.lstatSync(target)
      assert.ok(!st.isSymbolicLink(), 'symlink refused')
      if (st.isDirectory()) visit(target)
      else { assert.ok(st.isFile(), 'non-file fixture entry'); result.push(target) }
    }
  }
  visit(dir)
  return result.sort()
}
export function ownedPath(root, candidate) {
  assert.ok(typeof candidate === 'string' && path.isAbsolute(candidate) && path.normalize(candidate) === candidate, 'normal absolute fixture path required')
  assert.ok(candidate.startsWith(root + path.sep), 'outside fixture root')
  let current = root
  const segments = path.relative(root, candidate).split(path.sep)
  for (const [index, segment] of segments.entries()) {
    current = path.join(current, segment)
    let st
    try { st = fs.lstatSync(current) } catch (error) { if (error.code === 'ENOENT') continue; throw error }
    assert.ok(!st.isSymbolicLink(), 'symlink target refused')
    if (index < segments.length - 1) assert.ok(st.isDirectory(), 'fixture path traverses a file')
  }
  return candidate
}
function checkRoot(candidate) {
  assert.ok(typeof candidate === 'string' && path.isAbsolute(candidate), 'missing fixture root')
  const temp = fs.realpathSync(os.tmpdir())
  assert.equal(path.dirname(candidate), temp, 'fixture must be a direct system-temp child')
  assert.ok(path.basename(candidate).startsWith(PREFIX), 'wrong fixture root prefix')
  const st = fs.lstatSync(candidate)
  assert.ok(st.isDirectory() && !st.isSymbolicLink(), 'symlink or non-directory fixture root')
  assert.equal(fs.realpathSync(candidate), candidate, 'fixture root redirects')
  assert.equal(st.mode & 0o777, 0o700, 'fixture root must be 0700')
  filesUnder(candidate) // Reject a symlink anywhere, including local-state recovery/temp paths.
  return candidate
}
function sourcePins() { return Object.fromEntries(filesUnder(sourceRoot).map(file => [path.relative(sourceRoot, file), digest(file)])) }
function buildPins() {
  const preload = path.join(desktop, 'out/preload/index.cjs')
  assert.ok(fs.existsSync(preload), 'build production renderer/preload first')
  const built = [preload, ...filesUnder(path.join(desktop, 'out/renderer'))]
  assert.ok(built.some(file => file.endsWith('out/renderer/index.html')), 'built renderer is missing')
  return Object.fromEntries(built.map(file => [path.relative(desktop, file), digest(file)]))
}
function moduleOutput(relative, root) {
  const ts = require('typescript')
  const target = path.join(root, 'modules', relative.replace(/\.ts$/, '.cjs'))
  const source = path.join(sourceRoot, relative)
  let output = ts.transpileModule(fs.readFileSync(source, 'utf8'), { fileName: source,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText
  output = output.replace(/require\(["'](\.[^"']+)["']\)/g, (_whole, specifier) => {
    const dependency = path.relative(sourceRoot, path.resolve(path.dirname(source), specifier.endsWith('.ts') ? specifier : specifier + '.ts'))
    assert.ok(moduleNames.includes(dependency), `unreviewed runtime module: ${dependency}`)
    let request = path.relative(path.dirname(target), path.join(root, 'modules', dependency.replace(/\.ts$/, '.cjs')))
    if (!request.startsWith('.')) request = './' + request
    return `require(${JSON.stringify(request)})`
  })
  for (const match of output.matchAll(/require\(["']([^"']+)["']\)/g))
    assert.ok(match[1].startsWith('.') || ['node:fs', 'node:path', 'node:crypto'].includes(match[1]), 'privileged module dependency refused')
  return output
}
function compileModules(root) {
  const pins = {}
  for (const relative of moduleNames) {
    const target = path.join(root, 'modules', relative.replace(/\.ts$/, '.cjs'))
    mkdir(path.dirname(target)); fs.writeFileSync(target, moduleOutput(relative, root), { mode: 0o600 })
    pins[path.relative(root, target)] = digest(target)
  }
  return pins
}
function products(root) {
  return Object.fromEntries(moduleNames.map(relative => [path.basename(relative, '.ts'), require(path.join(root, 'modules', relative.replace(/\.ts$/, '.cjs')))]))
}
function gitRevision() {
  const repo = path.resolve(desktop, '../..'); const dot = path.join(repo, '.git')
  const gitdir = fs.statSync(dot).isDirectory() ? dot : path.resolve(repo, fs.readFileSync(dot, 'utf8').trim().replace(/^gitdir: /, ''))
  const head = fs.readFileSync(path.join(gitdir, 'HEAD'), 'utf8').trim()
  if (/^[a-f0-9]{40}$/.test(head)) return head
  assert.ok(head.startsWith('ref: refs/'), 'unknown git HEAD')
  const commonFile = path.join(gitdir, 'commondir')
  const common = fs.existsSync(commonFile) ? path.resolve(gitdir, fs.readFileSync(commonFile, 'utf8').trim()) : gitdir
  const ref = head.slice(5); const loose = path.join(common, ref)
  if (fs.existsSync(loose)) return fs.readFileSync(loose, 'utf8').trim()
  const packed = fs.readFileSync(path.join(common, 'packed-refs'), 'utf8').split('\n').find(line => line.endsWith(' ' + ref))
  assert.ok(packed, 'source revision unavailable'); return packed.split(' ')[0]
}
export function backendRows(mode) {
  oneOf(mode, ['none', 'one', 'unavailable', 'two'])
  const local = { id: 'local', available: true, reason: null }
  return mode === 'none' ? [] : mode === 'one' ? [local]
    : [local, { id: 'cloud', available: mode === 'two', reason: mode === 'two' ? null : 'hosted-estates-not-built' }]
}
export function runnerRows(mode) {
  oneOf(mode, ['mixed', 'none', 'unavailable'])
  const row = (id, program, available) => ({ id, label: id, program, description: 'Synthetic fixture; never executed',
    available, connectsToSurface: program !== null, permissionModes: [], defaultMode: null })
  return mode === 'none' ? [] : [row('claude-code', 'synthetic-claude', mode !== 'unavailable'),
    row('codex', 'synthetic-codex', false), row('terminal', null, true)]
}
export function projectRow(input, at) {
  return { id: input.id, estate_id: 'co179-fixture-estate', name: input.name, purpose: input.purpose ?? null,
    repo_path: input.repoPaths?.[0] ?? null, status: 'active', config_revision: 1, created_at: at,
    memory_backend: input.memoryBackend ?? 'local', default_agent: input.defaultAgent ?? 'claude-code', mcp_servers: [] }
}
/** Compile-time witness against current product types; this is not a new IPC interface. */
export function validateTypedFixtures() {
  const ts = require('typescript'); const virtual = path.join(desktop, 'test/__co179_types_only__.ts')
  const src = `import type { MemoryBackendOption, LaunchOption, ProjectRow, CreateProjectInput, PersonaRead, CeoChatStatus } from '../src/shared/types.ts';
import type { NewFolderInput, NewFolderResult } from '../src/shared/startPaths.ts';
const backends = ${JSON.stringify(backendRows('two'))} satisfies MemoryBackendOption[];
const unavailable = ${JSON.stringify(backendRows('unavailable'))} satisfies MemoryBackendOption[];
const runners = ${JSON.stringify(runnerRows('mixed'))} satisfies LaunchOption[];
const persona = {persona:{seed:731,style:'orbit'},chosen:false} satisfies PersonaRead;
const ceoStatus = {active:false,reason:'private_recovery_unavailable'} satisfies CeoChatStatus;
const input = {id:'fixture-project-1',name:'Fixture one',repoPaths:[],memoryBackend:'local',defaultAgent:'claude-code'} satisfies CreateProjectInput;
const row = ${JSON.stringify(projectRow({ id: 'fixture-project-1', name: 'Fixture one' }, '2026-10-04T00:00:00.000Z'))} satisfies ProjectRow;
const folder = {parent:'/fixture/parent',name:'Fixture one',git:true} satisfies NewFolderInput;
const results = [{ok:true,path:'/fixture/parent/Fixture one'},{ok:false,reason:'invalid-name',detail:'separator'},{ok:false,reason:'exists',detail:'/fixture/parent/Fixture one'},{ok:false,reason:'outside',detail:'parent-not-chosen'},{ok:false,reason:'failed',detail:'synthetic refusal'}] satisfies NewFolderResult[];`
  const options = { noEmit: true, strict: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, allowImportingTsExtensions: true }
  const host = ts.createCompilerHost(options); const get = host.getSourceFile.bind(host)
  host.getSourceFile = (file, ...rest) => file === virtual ? ts.createSourceFile(file, src, options.target, true) : get(file, ...rest)
  const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([virtual], options, host))
  assert.equal(diagnostics.length, 0, ts.formatDiagnostics(diagnostics, { getCurrentDirectory: () => desktop, getCanonicalFileName: f => f, getNewLine: () => '\n' }))
  return true
}
export function prepareFixture(config) {
  assert.ok(!process.versions.electron, 'prepare with Node only')
  config = validateConfig(config); validateTypedFixtures()
  const builds = buildPins(); const sources = sourcePins()
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), PREFIX)); fs.chmodSync(root, 0o700)
  for (const name of ['userData', 'sessionData', 'logs', 'crashDumps', 'synthetic-parent', 'synthetic-repo']) mkdir(path.join(root, name))
  const modules = compileModules(root)
  const p = products(root); const userData = path.join(root, 'userData')
  const draft = (id, name) => ({ projectId: id, name, purpose: 'Synthetic fixture purpose', repoPaths: [], memory: 'local', agent: 'claude-code' })
  const seeded = { 'draft-1': draft('fixture-project-1', 'Fixture one'), 'draft-2': draft('fixture-project-2', 'Fixture two') }
  if (config.repos === 'long') seeded['draft-1'].repoPaths = [path.join(root, 'synthetic-repo', 'bounded-long-repository-name-'.repeat(7))]
  const spec = (file, empty, validate) => ({ dir: userData, file, empty, validate })
  if (config.drafts !== 'empty') {
    assert.equal(p.localState.writeLocal(spec('onboarding-drafts.json', {}, p.onboardingDraft.validateDraftFile), seeded).status, 'committed')
    if (config.drafts === 'corrupt') for (const file of ['onboarding-drafts.json', 'onboarding-drafts.json.last-good'])
      fs.writeFileSync(path.join(userData, file), '{broken CO179 fixture', { mode: 0o600 })
  }
  const tabs = config.drafts === 'empty' ? { tabs: [], active: null } : { tabs: [{ kind: 'draft', id: 'draft-1' }, { kind: 'draft', id: 'draft-2' }], active: { kind: 'draft', id: 'draft-1' } }
  const settings = { ...p.types.APP_SETTINGS_DEFAULTS, theme: 'dark', locale: config.locale, keepAwake: 'never', workspace: { path: null, git: 'declined' }, tabs }
  assert.equal(p.localState.writeLocal(spec('settings.json', p.types.APP_SETTINGS_DEFAULTS, p.appSettings.validateSettings), settings).status, 'committed')
  const marker = { format: 'fabric-co179-test-fixture/1', id: randomUUID(), desktop, sourceRevision: gitRevision(),
    createdAt: new Date().toISOString(), hostPin: digest(fileURLToPath(import.meta.url)), config, sourcePins: sources, buildPins: builds, modulePins: modules }
  write(path.join(root, MARKER), marker)
  return root
}
export function loadFixture(candidate) {
  const root = checkRoot(candidate); const file = ownedPath(root, path.join(root, MARKER))
  assert.equal(fs.lstatSync(file).mode & 0o777, 0o600, 'marker must be 0600')
  const marker = JSON.parse(fs.readFileSync(file, 'utf8'))
  exact(marker, ['format', 'id', 'desktop', 'sourceRevision', 'createdAt', 'hostPin', 'config', 'sourcePins', 'buildPins', 'modulePins'], 'marker')
  assert.equal(marker.format, 'fabric-co179-test-fixture/1'); assert.equal(marker.desktop, desktop)
  assert.match(marker.id, /^[a-f0-9-]{36}$/); assert.match(marker.sourceRevision, /^[a-f0-9]{40}$/)
  validateConfig(marker.config)
  assert.equal(marker.hostPin, digest(fileURLToPath(import.meta.url)), 'test host source drift: prepare new fixture')
  assert.deepEqual(marker.sourcePins, sourcePins(), 'product source drift: prepare new fixture')
  assert.deepEqual(marker.buildPins, buildPins(), 'product build drift: prepare new fixture')
  const expected = moduleNames.map(relative => 'modules/' + relative.replace(/\.ts$/, '.cjs')).sort()
  assert.deepEqual(Object.keys(marker.modulePins).sort(), expected, 'unreviewed module set')
  for (const [relative, hash] of Object.entries(marker.modulePins)) {
    const target = ownedPath(root, path.join(root, relative))
    assert.equal(fs.lstatSync(target).mode & 0o777, 0o600)
    assert.equal(digest(target), hash, 'compiled module drift')
    const source = relative.slice('modules/'.length).replace(/\.cjs$/, '.ts')
    assert.equal(hash, sha(moduleOutput(source, root)), 'forged compiled module provenance')
  }
  for (const name of ['userData', 'sessionData', 'logs', 'crashDumps', 'synthetic-parent', 'synthetic-repo']) {
    const target = ownedPath(root, path.join(root, name)); const st = fs.lstatSync(target)
    assert.ok(st.isDirectory()); assert.equal(st.mode & 0o777, 0o700)
  }
  return { root, marker }
}
export function createFixtureHost(candidate, { alive = () => true } = {}) {
  const { root, marker } = loadFixture(candidate); const config = validateConfig(marker.config); const p = products(root)
  const spec = (file, empty, validate) => ({ dir: path.join(root, 'userData'), file, empty, validate })
  const draftSpec = spec('onboarding-drafts.json', {}, p.onboardingDraft.validateDraftFile)
  const settingsSpec = spec('settings.json', p.types.APP_SETTINGS_DEFAULTS, p.appSettings.validateSettings)
  const drafts = p.onboardingDrafts.createDrafts({ read: () => p.localState.readLocal(draftSpec), update: change => p.localState.updateLocal(draftSpec, change) })
  const records = new Map(); let sequence = 0; let parentChosen = false
  const audit = detail => {
    checkRoot(root)
    const file = ownedPath(root, path.join(root, 'audit.jsonl'))
    const line = JSON.stringify({ at: new Date().toISOString(), fixtureId: marker.id,
      sourceRevision: marker.sourceRevision, ...safeJSON(detail) }) + '\n'
    const previousBytes = fs.existsSync(file) ? fs.statSync(file).size : 0
    assert.ok(previousBytes + Buffer.byteLength(line) <= 8 * 1024 * 1024, 'fixture audit byte limit')
    fs.appendFileSync(file, line, { mode: 0o600 })
  }
  const handlers = new Map(); const add = (key, run, delay = 0) => { assert.ok(p.types.IPC[key]); handlers.set(p.types.IPC[key], { run, delay }) }
  const noArgs = args => assert.equal(args.length, 0, 'unexpected fixture arguments')
  add('draftsRead', args => { noArgs(args); return drafts.read() }, config.draftDelayMs)
  add('draftsSave', args => {
    assert.equal(args.length, 1); const next = args[0]
    assert.ok(p.onboardingDraft.validateDraftFile(next), 'invalid draft result shape')
    for (const [id, draft] of Object.entries(next)) {
      text(id, 128); exact(draft, ['projectId', 'name', 'purpose', 'repoPaths', 'memory', 'agent'], 'draft')
      text(draft.projectId, 128); text(draft.name, 512, true); text(draft.purpose, 8192, true); text(draft.agent, 128)
      assert.ok(draft.repoPaths.length <= 16); draft.repoPaths.forEach(value => ownedPath(root, value))
    }
    const result = drafts.save(next)
    return { saved: result.status === 'committed', reason: result.status === 'committed' ? null : 'synthetic fixture draft save refused' }
  })
  add('tabsRead', args => { noArgs(args); return p.localState.readLocal(settingsSpec).value.tabs })
  add('tabsWrite', args => {
    assert.equal(args.length, 1)
    assert.equal(p.localState.updateLocal(settingsSpec, current => ({ ...current, tabs: args[0] })).status, 'committed', 'invalid tabs')
  })
  add('settingsRead', args => { noArgs(args); return p.localState.readLocal(settingsSpec).value })
  add('startChooseFolder', args => {
    assert.ok(args.length === 1 || args.length === 2); assert.equal(args[0], 'parent', 'only parent chooser is synthetic')
    if (args[1] !== undefined) ownedPath(root, args[1])
    parentChosen = config.folder !== 'cancel'
    return parentChosen ? path.join(root, 'synthetic-parent') : null
  })
  add('startCreateFolder', args => {
    assert.equal(args.length, 1); const input = args[0]
    exact(input, ['parent', 'name', 'git'], 'NewFolderInput'); assert.equal(typeof input.git, 'boolean')
    assert.equal(ownedPath(root, input.parent), path.join(root, 'synthetic-parent'), 'unchosen synthetic parent')
    if (!parentChosen) return { ok: false, reason: 'outside', detail: 'parent-not-chosen' }
    text(input.name, 80); const bad = p.startPaths.folderNameProblem(input.name)
    if (bad || config.folder === 'invalid-name') return { ok: false, reason: 'invalid-name', detail: bad ?? 'separator' }
    const target = ownedPath(root, path.join(input.parent, input.name.trim()))
    if (config.folder === 'outside') return { ok: false, reason: 'outside', detail: 'parent-not-chosen' }
    if (config.folder === 'failed') return { ok: false, reason: 'failed', detail: 'synthetic fixture refusal' }
    if (config.folder === 'exists') return { ok: false, reason: 'exists', detail: target }
    // A synthetic path only: no mkdir, git init or real folder producer.
    return { ok: true, path: target }
  }, config.folderDelayMs)
  add('reposChoose', args => {
    noArgs(args)
    if (config.repos === 'throw') throw new Error('synthetic repo chooser refusal')
    return config.repos === 'cancel' ? [] : [config.repos === 'long' ? path.join(root, 'synthetic-repo', 'bounded-long-repository-name-'.repeat(7)) : path.join(root, 'synthetic-repo')]
  })
  add('terminalMemoryBackends', args => { noArgs(args); return backendRows(config.backends) }, config.backendDelayMs)
  add('terminalOptions', args => { noArgs(args); return runnerRows(config.runners) })
  add('projectsCreate', args => {
    assert.equal(args.length, 1); const input = args[0]
    assert.ok(input && typeof input === 'object' && !Array.isArray(input)); assert.ok(Object.keys(input).every(key => ['id', 'name', 'purpose', 'repoPaths', 'memoryBackend', 'defaultAgent'].includes(key)))
    text(input.id, 128); text(input.name, 512); assert.equal(p.startPaths.projectNameProblem(input.name), null)
    if (input.purpose !== undefined) text(input.purpose, 8192, true)
    if (input.memoryBackend !== undefined) oneOf(input.memoryBackend, ['local', 'cloud'])
    if (input.defaultAgent !== undefined) oneOf(input.defaultAgent, ['claude-code', 'codex'])
    if (input.repoPaths !== undefined) { assert.ok(Array.isArray(input.repoPaths) && input.repoPaths.length <= 16); input.repoPaths.forEach(value => ownedPath(root, value)) }
    assert.ok(Object.values(drafts.read().drafts).some(draft => draft.projectId === input.id), 'project ID is not an initiating owned draft')
    if (config.create === 'refuse') throw new Error('project-create-refused:synthetic-fixture')
    assert.ok(records.has(input.id) || records.size < 64, 'synthetic project record limit')
    const row = projectRow(input, marker.createdAt); records.set(input.id, cloned(row)); return row
  }, config.createDelayMs)
  add('projectsList', args => { noArgs(args); return [...records.values()] })
  for (const key of ['terminalList', 'feedReplay', 'favouritesList']) add(key, () => [])
  for (const key of ['estateSummary', 'memoryOverview', 'quotaRead']) add(key, () => null)
  add('personaRead', args => { noArgs(args); return { persona: { seed: 731, style: 'orbit' }, chosen: false } })
  add('favouritesOrder', args => { noArgs(args); return [] })
  add('ceoStatus', args => { noArgs(args); return { active: false, reason: 'private_recovery_unavailable' } })
  add('metaInfo', () => ({ estateName: 'CO179 synthetic test fixture', filePath: null, sessionId: null }))
  add('gatewayOffer', () => ({ reachable: false, servers: [] }))
  add('workspaceState', () => ({ path: null, git: 'declined' }))
  add('boardQuery', () => ({ rows: [], total: 0 }))
  add('attentionList', () => p.readEnvelope.envelope({ data: [], sources: [{ name: 'synthetic-co179-fixture', status: 'ok', asOf: marker.createdAt }], asOf: marker.createdAt, freshness: 'fresh' }))
  return { root, marker, IPC: p.types.IPC, channels: [...handlers.keys()], audit,
    records: () => cloned([...records.values()]),
    async invoke(channel, original = []) {
      checkRoot(root); assert.ok(alive(), 'initiating window closed'); text(channel, 128)
      assert.ok(sequence < 512, 'fixture request limit')
      const request = ++sequence
      const handler = handlers.get(channel)
      if (!handler) { audit({ kind: 'blocked-ipc', channel }); throw new Error('unregistered synthetic IPC channel') }
      const args = safeJSON(original); assert.ok(Array.isArray(args), 'argument array required')
      const requestedAt = Date.now()
      // Snapshot inputs per request; neither a later draft nor another window can redirect this response.
      audit({ kind: 'request', channel, request, args, delayMs: handler.delay })
      if (handler.delay) await new Promise(resolve => setTimeout(resolve, handler.delay))
      assert.ok(alive(), 'initiating window closed before response')
      assert.ok(Date.now() - requestedAt < config.timeoutMs, 'fixture request timed out')
      const result = handler.run(args)
      audit({ kind: 'response', channel, request, result: result === undefined ? null : result, synthetic: true })
      return cloned(result === undefined ? null : result)
    }
  }
}
export function allowBrowserURL(url) {
  if (url.startsWith('data:')) return true
  if (!url.startsWith('file:')) return false
  try {
    const file = fileURLToPath(url)
    return file.startsWith(path.join(desktop, 'out/renderer') + path.sep) && fs.realpathSync(file) === file
  } catch { return false }
}
async function launch(candidate, probe) {
  assert.ok(process.versions.electron, 'launch with Electron only')
  assert.ok(process.versions.electron.startsWith('44.'), 'fixture reviewed for Electron44 only')
  const { root, marker } = loadFixture(candidate)
  const { app, BrowserWindow, ipcMain, Menu, session } = require('electron')
  app.setName('Fabric CO179 Synthetic Fixture')
  for (const key of ['userData', 'sessionData', 'logs', 'crashDumps']) app.setPath(key, ownedPath(root, path.join(root, key)))
  app.commandLine.appendSwitch('disable-background-networking')
  let win; const host = createFixtureHost(root, { alive: () => !!win && !win.isDestroyed() })
  const deadline = setTimeout(() => { host.audit({ kind: 'host-timeout' }); app.exit(2) }, marker.config.timeoutMs)
  await app.whenReady()
  const isolated = session.fromPartition(`co179-${marker.id}`) // No persist: prefix; in-memory only.
  isolated.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  isolated.setPermissionCheckHandler(() => false)
  isolated.on('will-download', event => event.preventDefault())
  isolated.webRequest.onBeforeRequest((details, callback) => {
    const allowed = allowBrowserURL(details.url)
    if (!allowed) host.audit({ kind: 'blocked-network', scheme: details.url.split(':')[0] })
    callback({ cancel: !allowed })
  })
  win = new BrowserWindow({ width: marker.config.width, height: marker.config.height, useContentSize: true, show: !probe,
    title: 'Fabric · CO179 synthetic fixture', webPreferences: { preload: path.join(desktop, 'out/preload/index.cjs'),
      contextIsolation: true, sandbox: true, nodeIntegration: false, webviewTag: false, backgroundThrottling: false, session: isolated } })
  for (const channel of Object.values(host.IPC)) ipcMain.handle(channel, async (event, ...args) => {
    assert.ok(event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame, 'foreign IPC sender')
    return host.invoke(channel, args)
  })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', event => event.preventDefault())
  win.webContents.on('will-attach-webview', event => event.preventDefault())
  win.on('page-title-updated', event => event.preventDefault())
  win.webContents.on('preload-error', (_event, _preload, error) => { host.audit({ kind: 'preload-error', error: String(error) }); app.exit(2) })
  win.webContents.on('render-process-gone', (_event, details) => { host.audit({ kind: 'renderer-gone', reason: details.reason }); app.exit(2) })
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: 'CO179 fixture', submenu: [{ role: 'quit' }] }, { role: 'editMenu' }]))
  app.on('window-all-closed', () => app.quit()); app.on('before-quit', () => clearTimeout(deadline))
  await win.loadFile(path.join(desktop, 'out/renderer/index.html'))
  host.audit({ kind: 'renderer-loaded', electron: process.versions.electron, sourceRevision: marker.sourceRevision })
  console.log(JSON.stringify({ fixture: root, sourceRevision: marker.sourceRevision, synthetic: true, pid: process.pid }))
  if (probe) {
    assert.equal(marker.config.drafts, 'restored', 'automated probe requires restored draft scenario')
    for (let i = 0; i < 200; i++) {
      if (await win.webContents.executeJavaScript("!!document.querySelector('.onboarding input')")) break
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    // Dedicated test capture, before bridge probes. No caller-selected path or arbitrary script.
    await win.webContents.executeJavaScript('document.fonts.ready.then(() => true)')
    await new Promise(resolve => setTimeout(resolve, 100))
    const image = await win.webContents.capturePage()
    const png = image.toPNG()
    assert.ok(png.length > 0 && png.length <= 20 * 1024 * 1024, 'bounded PNG capture required')
    const captureFile = ownedPath(root, path.join(root, 'page.png'))
    fs.writeFileSync(captureFile, png, { mode: 0o600 })
    const capture = { file: 'page.png', sha256: sha(png), bytes: png.length, pixels: image.getSize(),
      configuredContentSize: { width: marker.config.width, height: marker.config.height },
      actualContentSize: Object.fromEntries(['width','height'].map((key,index) => [key,win.getContentSize()[index]])),
      tier: 'source-bound-rendering-evidence', timing: 'initial form before synthetic bridge probes' }
    const observed = await win.webContents.executeJavaScript(`(async () => {
      const node = document.querySelector('.onboarding'); if (!node) throw Error('compiled onboarding not visible');
      const initial = { inputValues:[...node.querySelectorAll('input:not([type=checkbox]):not([type=radio])')].map(n=>n.value),
        radios:[...node.querySelectorAll('input[type=radio]')].map(n=>({disabled:n.disabled,checked:n.checked})),
        agentOptions:[...node.querySelectorAll('select option')].map(n=>({value:n.value,disabled:n.disabled})), text:node.innerText,
        geometry: { document:{clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,
          clientHeight:document.documentElement.clientHeight,scrollHeight:document.documentElement.scrollHeight,innerWidth,innerHeight},
          nodes:['.app-main','.content','.onboarding','.onboarding header','.onboarding header h1','.onboarding p','.onboarding form','.onboarding .repo-list .row','.onboarding .repo-list .row-main']
            .flatMap(selector=>[...document.querySelectorAll(selector)].slice(0,16).map((element,index)=>{
              const rect=element.getBoundingClientRect(); const css=getComputedStyle(element);
              return {selector,index,rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height,left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom},
                clientWidth:element.clientWidth,scrollWidth:element.scrollWidth,clientHeight:element.clientHeight,scrollHeight:element.scrollHeight,
                computed:{display:css.display,width:css.width,minWidth:css.minWidth,maxWidth:css.maxWidth,overflow:css.overflow,
                  overflowX:css.overflowX,overflowY:css.overflowY,fontSize:css.fontSize,whiteSpace:css.whiteSpace,overflowWrap:css.overflowWrap,wordBreak:css.wordBreak}};
            })).slice(0,64) } };
      const backends=await window.fabric.terminal.memoryBackends(); const runners=await window.fabric.terminal.options();
      const parent=await window.fabric.start.chooseFolder('parent');
      const folder=parent ? await window.fabric.start.createFolder({parent,name:'Fixture one',git:true}) : null;
      const repos=await window.fabric.repos.choose().catch(e=>({refused:String(e)}));
      const create=await window.fabric.projects.create({id:'fixture-project-1',name:'Fixture one',repoPaths:[],memoryBackend:'local',defaultAgent:'claude-code'}).catch(e=>({refused:String(e)}));
      const privileged=await window.fabric.settings.write({theme:'dark'}).then(()=>({unexpected:true}),()=>({refused:true}));
      return {initial,backends,runners,parent,folder,repos,create,privileged};
    })()`)
    assert.deepEqual(observed.backends, backendRows(marker.config.backends))
    assert.deepEqual(observed.runners, runnerRows(marker.config.runners))
    assert.equal(observed.privileged.refused, true)
    assert.equal(observed.initial.inputValues[0], 'Fixture one')
    assert.deepEqual(observed.initial.agentOptions, runnerRows(marker.config.runners).filter(row => row.program !== null).map(row => ({value:row.id,disabled:!row.available})), 'real renderer must show configured coding runners and exclude terminal')
    if (marker.config.backendDelayMs === 0) assert.equal(observed.initial.radios.length, ['two','unavailable'].includes(marker.config.backends) ? 2 : 0)
    write(ownedPath(root, path.join(root, 'probe.json')), { tier: 'synthetic-native-test-host-capability',
      sourceRevision: marker.sourceRevision, hostPin: marker.hostPin, sourcePins: marker.sourcePins, buildPins: marker.buildPins, capture, observed })
    host.audit({ kind: 'probe-complete', synthetic: true }); clearTimeout(deadline); app.quit()
  }
}
const direct = process.argv[1] && fs.existsSync(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))
if (direct) {
  try {
    const args = process.argv.slice(2); const flag = key => { const i = args.indexOf(key); return i < 0 ? undefined : args[i + 1] }
    for (const key of ['--prepare', '--fixture', '--locale', '--width', '--height', '--probe']) assert.ok(args.filter(value => value === key).length <= 1, 'duplicate harness argument')
    assert.ok(args.every((value, i) => ['--prepare', '--fixture', '--locale', '--width', '--height', '--probe'].includes(value) || (i > 0 && ['--prepare', '--fixture', '--locale', '--width', '--height'].includes(args[i - 1]))), 'unknown harness argument')
    if (flag('--prepare')) {
      assert.ok(!args.includes('--fixture') && !args.includes('--probe'), 'prepare cannot launch')
      const overrides = {}
      if (flag('--locale')) overrides.locale = flag('--locale')
      if (flag('--width')) overrides.width = Number(flag('--width'))
      if (flag('--height')) overrides.height = Number(flag('--height'))
      const config = scenarioConfig(flag('--prepare'), overrides)
      console.log(JSON.stringify({ fixture: prepareFixture(config), synthetic: true, instruction: 'Launch only this test host with Electron44 --fixture; --probe is host capability, not visual acceptance.' }))
    } else { assert.ok(!['--locale', '--width', '--height'].some(key => args.includes(key)), 'locale and viewport belong to preparation'); void launch(flag('--fixture'), args.includes('--probe')).catch(error => {
      console.error(String(error)); process.exitCode = 1; require('electron').app.exit(1)
    }) }
  } catch (error) {
    console.error(String(error)); process.exitCode = 1
    if (process.versions.electron) require('electron').app.exit(1)
  }
}
// #endregion onboarding-native-fixture

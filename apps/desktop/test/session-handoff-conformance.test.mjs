// #region session-handoff-conformance — docs: docs/adr/0140-a-session-is-handed-its-context-in-one-format-session-handoff-1.md#decision
// Fabric's session bundle is a `session-handoff/1` folder (ADR-0140; session-handoff/1, contract PR #31), and
// Fabric is the format's reference writer. This test does not restate the format: it runs the CONTRACT'S OWN
// checker — `src/session-handoff.ts`, vendored byte for byte with its schema under
// fixtures/fabric-agent-contract/current/ and verified against SOURCE.json — on a folder Fabric writes for each
// adapter that connects to the surface. A rule the contract adds reaches this test on the next repin; a rule
// Fabric's writer breaks fails here with the contract's own words.
import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { createBundleCompiler, NO_PACK_NOTE } from '../src/main/sessionBundle.ts'
import { NAMED_TOOL, PREAMBLE } from '../src/shared/preamble.ts'
import { fixtureRoot, loadPinnedFixtures, schemaPrefix } from './contract-consumer-fixtures.mjs'

const fixtures = loadPinnedFixtures()
const { validateSessionHandoff } = await import(path.join(fixtureRoot, 'current/src/session-handoff.ts'))
const ajv = new Ajv2020({ allErrors: true, strict: true })
addFormats(ajv)
for (const name of ['common', 'session-handoff']) ajv.addSchema(fixtures.document(`current/schemas/${name}.schema.json`))
const compiled = ajv.getSchema(`${schemaPrefix}session-handoff.schema.json`)
assert.ok(compiled, 'the pinned session-handoff schema compiles')
const schema = (manifest) => ({ valid: compiled(manifest) === true, errors: [...(compiled.errors ?? [])] })

// A folder in the system's temporary directory is outside any repository, as userData is.
const root = mkdtempSync(path.join(tmpdir(), 'fabric-handoff-'))
test.after(() => rmSync(root, { recursive: true, force: true }))
const surface = { endpoint: 'http://127.0.0.1:47070/mcp', mint: (_p, s) => ({ token: `tok-${s}` }), revokeSession: () => {} }
const PACK = '# What this project already knows\n\n- a fact [seq 12]\n'
const compiler = (context = async () => PACK) => createBundleCompiler({ root, surface, version: '0.4.0', context })
const LONG_BRIEF = { instructions: 'Watch releases.\nSay what changed for a user.', servers: [] }

async function handoff(optionId, adapter, { agent = null, mode = null, context } = {}) {
  const sessionId = randomUUID()
  const bundle = await compiler(context).compile(sessionId, randomUUID(), null, optionId, adapter, agent, mode)
  assert.ok(bundle, `${optionId}: a bundle was written`)
  const verdict = await validateSessionHandoff(bundle.dir, { schema })
  const manifest = JSON.parse(readFileSync(path.join(bundle.dir, 'handoff.json'), 'utf8'))
  return { bundle, verdict, manifest, dir: bundle.dir }
}
const conforms = (verdict, label) =>
  assert.deepEqual(verdict, { valid: true, schemaErrors: [], findings: [] }, `${label}: ${JSON.stringify(verdict, null, 2)}`)

test('Claude Code: the joined --mcp-config=, --strict-mcp-config, the preamble inline', async () => {
  const { bundle, verdict, manifest, dir } = await handoff('claude-code', 'mcp-config-flag')
  conforms(verdict, 'claude-code')
  assert.deepEqual(bundle.args, [`--mcp-config=${path.join(dir, 'mcp.json')}`, '--strict-mcp-config', '--append-system-prompt', PREAMBLE])
  assert.deepEqual(manifest.firstCall, { server: 'fabric', tool: NAMED_TOOL })
  assert.deepEqual(manifest.lifetime, { kind: 'session', session: path.basename(dir) })
  assert.deepEqual(manifest.mcp, { auth: 'bearer', strict: true })
  assert.deepEqual(manifest.brief, { delivery: 'inline', text: PREAMBLE })
  assert.match(manifest.integrity.parts['context.md'], /^sha256:[0-9a-f]{64}$/)
})

test("Claude Code: an agent's multi-line brief is brief.md, read with --append-system-prompt-file", async () => {
  const { bundle, verdict, manifest, dir } = await handoff('claude-code', 'mcp-config-flag', { agent: LONG_BRIEF })
  conforms(verdict, 'claude-code with a brief')
  assert.deepEqual(manifest.brief, { delivery: 'file' })
  assert.deepEqual(bundle.args.slice(2), ['--append-system-prompt-file', path.join(dir, 'brief.md')])
  const brief = readFileSync(path.join(dir, 'brief.md'), 'utf8')
  assert.ok(brief.startsWith('Watch releases.') && brief.trimEnd().endsWith(PREAMBLE), 'the brief first, the preamble last')
})

test('Kilo: the session config in KILO_CONFIG_CONTENT, withheld in the manifest; the brief as a file', async () => {
  const { bundle, verdict, manifest } = await handoff('kilo', 'config-content-env', { mode: {} })
  conforms(verdict, 'kilo')
  assert.deepEqual(manifest.launch, { runtime: 'kilo', args: [], env: { KILO_CONFIG_CONTENT: null } })
  assert.equal(manifest.mcp.strict, false)
  assert.deepEqual(bundle.args, [])
})

test('Hermes over ACP: HERMES_ACP_SKIP_CONFIGURED_MCP makes it strict; the shell is handed brief.md', async () => {
  const { bundle, verdict, manifest, dir } = await handoff('hermes', 'acp-session', { mode: { acpMode: 'ask' } })
  conforms(verdict, 'hermes')
  assert.deepEqual(manifest.launch.env, { HERMES_ACP_SKIP_CONFIGURED_MCP: '1', FABRIC_ACP_SESSION: null })
  assert.equal(manifest.mcp.strict, true)
  const spec = JSON.parse(bundle.env.FABRIC_ACP_SESSION)
  assert.equal(spec.briefFile, path.join(dir, 'brief.md'))
  assert.equal(spec.brief, undefined, 'the brief has one home, brief.md')
})

test('a pack that could not be compiled still leaves context.md, saying so, and the folder conforms', async () => {
  const { verdict, manifest, dir } = await handoff('claude-code', 'mcp-config-flag', { context: async () => { throw new Error('memory is unreachable') } })
  conforms(verdict, 'no pack')
  assert.equal(readFileSync(path.join(dir, 'context.md'), 'utf8'), NO_PACK_NOTE)
  assert.equal(manifest.integrity, undefined, 'no packet was materialised, so none is named')
})

// The contract owner's rule for session-handoff/1 (contract PR #31): the ONLY credential in the folder is
// DEC-0039's session bearer — Fabric's one-shot bearer minted for this session — with one exception, a
// delegation token minted for that session and living no longer than it. No door token, binding credential,
// product secret or descriptor token. This reads every file and lists every value that could be a credential.
const TOKEN_SHAPED = /(eyJ[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]*|bearer\s+[^\s"']+|sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|tok-[A-Za-z0-9-]{8,})/gi
const CREDENTIAL_NAME = /(^|[._-])(token|secret|password|passwd|api[_-]?key|key|auth|authorization|bearer|cookie|credential|jwt)([._-]|$)/i
function credentialsIn(dir) {
  const found = new Set()
  for (const name of ['handoff.json', 'context.md', 'mcp.json', 'brief.md', 'task.md']) {
    let text
    try { text = readFileSync(path.join(dir, name), 'utf8') } catch { continue /* not written: nothing in it */ }
    for (const m of text.matchAll(TOKEN_SHAPED)) found.add(m[0].replace(/^bearer\s+/i, ''))
    if (name !== 'mcp.json') continue
    for (const server of Object.values(JSON.parse(text).mcpServers ?? {})) {
      for (const value of Object.values(server.headers ?? {})) found.add(String(value).replace(/^bearer\s+/i, ''))
      for (const [variable, value] of Object.entries(server.env ?? {})) if (CREDENTIAL_NAME.test(variable.replace(/([a-z0-9])([A-Z])/g, '$1_$2'))) found.add(String(value))
    }
  }
  return [...found].sort()
}

test("the only credential in the folder is the session's one-shot bearer (DEC-0039's session bearer)", async () => {
  for (const [optionId, adapter, mode] of [['claude-code', 'mcp-config-flag', null], ['kilo', 'config-content-env', {}], ['hermes', 'acp-session', { acpMode: 'ask' }]]) {
    const { dir } = await handoff(optionId, adapter, { agent: LONG_BRIEF, mode })
    assert.deepEqual(credentialsIn(dir), [`tok-${path.basename(dir)}`], optionId)
  }
  // Planted: a second token in the folder — a door token beside the bearer — is found.
  const { dir } = await handoff('claude-code', 'mcp-config-flag')
  const config = JSON.parse(readFileSync(path.join(dir, 'mcp.json'), 'utf8'))
  config.mcpServers.fabric.headers['x-fabric-door'] = 'door-7f3a9c1e2b4d6a8f'
  writeFileSync(path.join(dir, 'mcp.json'), JSON.stringify(config), { mode: 0o600 })
  assert.deepEqual(credentialsIn(dir), ['door-7f3a9c1e2b4d6a8f', `tok-${path.basename(dir)}`])
})

// NOT CONFORMING YET, and shown rather than hidden: a project's granted gateway servers ride in mcp.json with
// their hop's role key (`servers.ts#Granted`), a second credential the rule above does not admit. Moving the
// role key out of the folder (or the contract admitting it) is a decision, not an edit here; until then this
// case runs as a todo so the conflict is visible in every run.
test('a session with granted gateway servers carries their role keys too (the open conflict)', { todo: 'gateway role keys in mcp.json — decision pending' }, async () => {
  const sessionId = randomUUID()
  const granting = createBundleCompiler({
    root, surface, version: '0.4.0', context: async () => PACK,
    declaredServers: async () => [{ name: 'linear', source: 'gateway' }],
    gateway: () => ({ origin: 'http://127.0.0.1:4000', routes: { linear: '/mcp/linear' }, key: 'role-key-5b8e2f1a' })
  })
  const bundle = await granting.compile(sessionId, randomUUID(), null, 'claude-code', 'mcp-config-flag')
  assert.deepEqual(credentialsIn(bundle.dir), [`tok-${sessionId}`])
})

test("the contract's checker is live here: a folder Fabric wrote, then loosened, is refused", async () => {
  const { dir } = await handoff('claude-code', 'mcp-config-flag')
  chmodSync(path.join(dir, 'mcp.json'), 0o644)
  writeFileSync(path.join(dir, 'notes.txt'), 'x', { mode: 0o600 })
  const verdict = await validateSessionHandoff(dir, { schema })
  assert.equal(verdict.valid, false)
  assert.deepEqual(verdict.findings.map((f) => f.code).sort(), ['FAC-SEM-054', 'FAC-SEM-054'])
})
// #endregion session-handoff-conformance

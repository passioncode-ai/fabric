// The bundle lifecycle (SEC-REQ-012).
//
// A bundle is a live bearer token written to disk. Three things must be true of
// it, and none of them was true before this suite existed:
//
//   1. it is written with the narrowest permissions the filesystem offers
//   2. discarding it removes the file AND revokes the credential — a token that
//      survives its file is worse than one that does not, because nothing is
//      left to remind anyone it exists
//   3. a spawn that FAILS discards it too. This is the one that was actually
//      broken: revocation hung off the session-exit event, and a process that
//      never started cannot exit, so its credential lived until the app quit.
//
// No Electron here — the compiler takes its data directory as a string, which
// is the whole reason it was lifted out of bootstrap().

import { execFileSync } from 'node:child_process'
import path from 'node:path'

const HERE = import.meta.dirname
const script = `
import { createBundleCompiler } from ${JSON.stringify(path.join(HERE, '../src/main/sessionBundle.ts'))}
import { PtyManager } from ${JSON.stringify(path.join(HERE, '../src/main/pty.ts'))}
import { useOps } from ${JSON.stringify(path.join(HERE, '../src/main/opsSink.ts'))}
import { MandatoryContextUnmet } from ${JSON.stringify(path.join(HERE, '../src/main/contextPack.ts'))}
import fs, { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.log('  FAIL ' + m) }

const root = mkdtempSync(path.join(tmpdir(), 'fabric-bundle-'))
const revoked = []
const surface = {
  endpoint: 'http://127.0.0.1:1/mcp',
  mint: (p, s, t) => ({ token: 'tok-' + s }),
  revokeSession: (s) => revoked.push(s)
}
const contextCalls = []
const bundles = createBundleCompiler({
  root,
  surface,
  context: async (sessionId, projectId, taskId) => {
    contextCalls.push({ sessionId, projectId, taskId })
    return '# What this project already knows\\n\\n- a fact\\n'
  }
})

// 1 — permissions
const sid = randomUUID()
// A bundle is always FOR an agent, and its arguments depend on which —
// passing the agent used to be unnecessary because every one got Claude
// Code's flags whether it understood them or not (M17).
const bundle = await bundles.compile(sid, randomUUID(), null, 'claude-code', 'mcp-config-flag')
const cfg = path.join(root, 'sessions', sid, 'mcp.json')
const fileMode = statSync(cfg).mode & 0o777
const dirMode = statSync(path.dirname(cfg)).mode & 0o777
if (fileMode !== 0o600) fail('mcp.json is mode ' + fileMode.toString(8) + ', wanted 600')
else ok('mcp.json is written 0600')
if (dirMode !== 0o700) fail('the session directory is mode ' + dirMode.toString(8) + ', wanted 700')
else ok('the session directory is 0700, so the session ids are not listable either')
if (!readFileSync(cfg, 'utf8').includes('tok-' + sid)) fail('the bundle does not carry the minted token')
else ok('the bundle carries the credential it was minted with')
if (!bundle.args.includes('--strict-mcp-config')) fail('the bundle does not pass --strict-mcp-config')
else ok('the session is launched with --strict-mcp-config')

// M123's other half. The tools were on the surface and NOTHING told the agent to
// ask for the rules that govern them — only a sentence inside a tool description,
// which an agent may never read and need not obey.
{
  const i = bundle.args.indexOf('--append-system-prompt')
  if (i < 0) fail('the bundle hands over no preamble, so nothing asks the agent to read its rules')
  else if (!(bundle.args[i + 1] ?? '').includes('fabric_whoami'))
    fail('the preamble is delivered but does not name the tool that holds the rules')
  else ok('the session is launched with a preamble naming fabric_whoami')

  // The preamble must be ONE argument. Split across two, the runner reads the
  // second half as a flag it does not know and refuses to start at all — and it
  // would be split by the most ordinary edit there is, adding a space.
  if (bundle.args.filter((a) => a.startsWith('You are running inside Fabric')).length === 1)
    ok('and it arrives as a single argument rather than as words the runner would read as flags')
  else fail('the preamble is not a single argument: ' + JSON.stringify(bundle.args))
}

// 1b — the context pack is written beside the credential, never in a repository,
// and with the same permissions: it is Fabric's material, and a pack committed to
// a repo would be a stale copy of a moving store (M49).
{
  const packPath = path.join(root, 'sessions', sid, 'context.md')
  if (!existsSync(packPath)) fail('no context pack was written for the session')
  else {
    const mode = statSync(packPath).mode & 0o777
    if (mode !== 0o600) fail('the context pack is mode ' + mode.toString(8) + ', wanted 600')
    else ok('the context pack is written 0600, beside the credential')
    if (!readFileSync(packPath, 'utf8').includes('a fact')) fail('the pack does not hold what was compiled')
    else ok('the pack holds what the compiler produced')
  }
  if (contextCalls.length !== 1 || contextCalls[0].sessionId !== sid)
    fail('the pack was compiled for the wrong session: ' + JSON.stringify(contextCalls))
  else ok('the pack is compiled per session, before the session starts')
}

// 1c — a pack that cannot be compiled must not stop a session starting. An agent
// with no memory pre-loaded still works; an agent that never starts does not.
{
  const angry = createBundleCompiler({
    root,
    surface,
    context: async () => { throw new Error('memory is unreachable') }
  })
  const sid2 = randomUUID()
  const b2 = await angry.compile(sid2, randomUUID(), null, 'claude-code', 'mcp-config-flag')
  if (!b2) fail('a failing context compiler prevented the session from being bundled')
  else ok('a session still gets its bundle when its pack cannot be compiled')
  if (existsSync(path.join(root, 'sessions', sid2, 'context.md')))
    fail('a failed compile left a pack file behind')
  else ok('and no half-written pack is left for it to read')
  if (!existsSync(path.join(root, 'sessions', sid2, 'mcp.json')))
    fail('the credential was not written when the pack failed')
  else ok('the credential is still written — the surface is what the session needs to work at all')
}

// 1d — but an UNATTENDED start whose required context did not answer is refused,
// and its credential with it (S14; release review 2026-10-03). The compiler
// throws only when the caller demanded sources, which a person's terminal never does.
{
  const blind = createBundleCompiler({
    root,
    surface,
    context: async () => { throw new MandatoryContextUnmet(['facts']) }
  })
  const sid4 = randomUUID()
  let refused = null
  try {
    await blind.compile(sid4, randomUUID(), null, 'claude-code', 'mcp-config-flag')
  } catch (e) {
    refused = e
  }
  if (!(refused instanceof MandatoryContextUnmet)) fail('an unattended start with unread memory was bundled anyway')
  else ok('an unattended start whose required context could not be read is refused, not started blind')
  if (existsSync(path.join(root, 'sessions', sid4))) fail('the refused start left its session directory behind')
  else if (!revoked.includes(sid4)) fail('the refused start left its credential live')
  else ok('and its credential is revoked and its directory removed')
}

// 2 — discard removes the file and revokes the credential
bundles.discard(sid)
if (existsSync(path.dirname(cfg))) fail('the session directory survived discard')
else ok('discard removes the session directory')
if (!revoked.includes(sid)) fail('discard did not revoke the credential')
else ok('discard revokes the credential, not just the file')

// 3 — a spawn that never happens still gives the credential back.
// The spawn is injected because nothing reachable from outside gets into this
// branch: a missing binary is refused earlier by the launch option's
// availability check, and a missing cwd does not throw — measured, it returns a
// session that exits 1 about a second later, which the exit path reclaims. The
// branch under test is the one where the process never exists at all.
// The launch option is available only where its program is on PATH, and the hosted Linux runner has no
// claude binary: there the open was refused BEFORE the spawn this block injects, and the check failed for
// the wrong reason. A stand-in claude on PATH makes the option available everywhere; the injected spawn
// below still throws before any process exists, so the stand-in is never run.
const standIn = mkdtempSync(path.join(tmpdir(), 'fabric-claude-standin-'))
writeFileSync(path.join(standIn, 'claude'), ['#!/bin/sh', 'exit 0', ''].join(String.fromCharCode(10)), { mode: 0o755 })
process.env.PATH = standIn + path.delimiter + (process.env.PATH ?? '')
const before = revoked.length
const ptys = new PtyManager(
  { append: async () => ({ seq: 1 }) },
  randomUUID(),
  { onData: () => {}, onExit: () => {} },
  bundles,
  () => { throw new Error('posix_spawnp failed') },
  undefined,
  // FA-07 — see delivery.test.mjs. The port produces this in the product.
  () => ({ kind: 'person', id: 'operator' })
)
let threw = null
try {
  await ptys.open(randomUUID(), root, 'claude-code')
} catch (e) {
  threw = e
}
if (threw) ok('a spawn that throws surfaces as SpawnFailure, not a silent dead session')
if (!threw) fail('a throwing spawn produced a session anyway')
else if (threw.name !== 'SpawnFailure') fail('spawn failed with ' + threw.name + ', wanted SpawnFailure')
else if (revoked.length === before) fail('a failed spawn left its credential live and its bundle on disk')
else {
  const orphan = revoked[revoked.length - 1]
  if (existsSync(path.join(root, 'sessions', orphan)))
    fail('a failed spawn revoked the credential but left the directory')
  else ok('a spawn that never happened revokes its credential and removes its bundle')
}

// M127 — a declared server the session cannot have REFUSES the launch, and the
// refusal happens before the credential is minted: a throw afterwards leaves a
// live token and a directory for a session that will not exist.
{
  const refusing = createBundleCompiler({
    root,
    surface,
    declaredServers: async () => [
      { name: 'linear', source: 'gateway' },
      { name: 'sentry', source: 'gateway' }
    ],
    gateway: () => ({
      origin: 'http://127.0.0.1:4000',
      routes: { linear: '/mcp/linear' },
      key: 'role-key'
    })
  })
  const sid2 = randomUUID()
  let refused = null
  try {
    await refusing.compile(sid2, randomUUID(), null, 'claude-code', 'mcp-config-flag')
  } catch (e) {
    refused = String(e)
  }
  if (refused && refused.includes('sentry'))
    ok('a declared server the gateway does not serve refuses the launch, naming it')
  else fail('the refusal said: ' + refused)

  if (!existsSync(path.join(root, 'sessions', sid2)))
    ok('and nothing was left behind — no directory for a session that will not exist')
  else fail('a refused compile left a session directory')

  // The granted case writes the server beside Fabric, pointed at the GATEWAY.
  const granting = createBundleCompiler({
    root,
    surface,
    declaredServers: async () => [{ name: 'linear', source: 'gateway' }],
    gateway: () => ({
      origin: 'http://127.0.0.1:4000',
      routes: { linear: '/mcp/linear' },
      key: 'role-key'
    })
  })
  const sid3 = randomUUID()
  await granting.compile(sid3, randomUUID(), null, 'claude-code', 'mcp-config-flag')
  const cfg3 = JSON.parse(readFileSync(path.join(root, 'sessions', sid3, 'mcp.json'), 'utf8'))
  const linear = cfg3.mcpServers?.linear
  if (linear?.url === 'http://127.0.0.1:4000/mcp/linear' && linear.headers['x-agw-key'] === 'role-key')
    ok('a granted server points at the gateway and carries the ROLE key, never an upstream one')
  else fail('granted server wrong: ' + JSON.stringify(linear))
  if (cfg3.mcpServers?.fabric) ok('and Fabric is still there beside it')
  else fail('the fabric server was displaced by the grant')
}

// M125 — a created agent narrows its own reach and carries its brief.
{
  const withAgent = createBundleCompiler({
    root,
    surface,
    declaredServers: async () => [
      { name: 'linear', source: 'gateway' },
      { name: 'context7', source: 'gateway' }
    ],
    gateway: () => ({
      origin: 'http://127.0.0.1:4000',
      routes: { linear: '/mcp/linear', context7: '/mcp/context7' },
      key: 'role-key'
    })
  })

  const sid4 = randomUUID()
  const b4 = await withAgent.compile(sid4, randomUUID(), null, 'claude-code', 'mcp-config-flag', {
    instructions: 'Watch releases and say what changed for a user.',
    servers: ['linear']
  })
  const cfg4 = JSON.parse(readFileSync(path.join(root, 'sessions', sid4, 'mcp.json'), 'utf8'))
  if (cfg4.mcpServers?.linear && !cfg4.mcpServers?.context7)
    ok('an agent gets what it ASKED for, not everything the project grants')
  else fail('agent servers wrong: ' + Object.keys(cfg4.mcpServers).join(','))

  const prompt = b4.args[b4.args.indexOf('--append-system-prompt') + 1]
  if (prompt.startsWith('Watch releases') && prompt.includes('fabric_whoami'))
    ok('and its brief comes first, with Fabric preamble last so the rules are the final word')
  else fail('the prompt was: ' + prompt.slice(0, 80))

  // The launch-time re-check: a grant withdrawn after the agent was created.
  // THE GATEWAY STILL SERVES linear. That is the point of the fixture: if it did
  // not, planServers would refuse for its own reason and this check would pass
  // without the project-ceiling rule existing at all. Found by planting the
  // removal of that rule and watching this assertion stay green.
  const withdrawn = createBundleCompiler({
    root,
    surface,
    declaredServers: async () => [{ name: 'context7', source: 'gateway' }],
    gateway: () => ({
      origin: 'http://127.0.0.1:4000',
      routes: { context7: '/mcp/context7', linear: '/mcp/linear' },
      key: 'role-key'
    })
  })
  let stopped = null
  try {
    await withdrawn.compile(randomUUID(), randomUUID(), null, 'claude-code', 'mcp-config-flag', {
      instructions: 'x',
      servers: ['linear']
    })
  } catch (e) {
    stopped = String(e)
  }
  if (stopped && stopped.includes('linear') && stopped.includes('does not grant'))
    ok('a grant withdrawn after the agent was created stops it at launch, naming the server')
  else fail('withdrawn grant produced: ' + stopped)
}

// An adapter nobody implemented REFUSES rather than borrowing another agent's
// flags. Before the dispatch existed, a second connecting agent would have been
// launched with Claude Code's mcp-config flags regardless — failing to
// start, or starting with no Fabric tools and no complaint.
{
  // TWO refusals live on this path and they fire in order. PF-10.01 added the
  // executor-readiness gate BEFORE the adapter switch, and this case still
  // named the someday agent, which is not a ready executor — so the readiness
  // gate answered first and the adapter branch below it had no test at all.
  // Measured 2026-09-10: the full tier had been red on main for exactly this,
  // and nothing said so because the tier was not being run.
  //
  // So each refusal is now reached on its own terms: an unready agent is
  // refused for BEING unready, and a ready one carrying an adapter nobody wrote
  // is refused for the adapter.
  let unready = null
  try {
    await bundles.compile(randomUUID(), randomUUID(), null, 'someday', 'unimplemented')
  } catch (e) {
    unready = String(e)
  }
  if (unready && unready.includes('not a ready Fabric executor'))
    ok('an agent that is not a ready executor is refused the surface before anything else is asked')
  else fail('an unready executor produced: ' + unready)

  let refused = null
  try {
    await bundles.compile(randomUUID(), randomUUID(), null, 'claude-code', 'unimplemented')
  } catch (e) {
    refused = String(e)
  }
  if (refused && refused.includes('nobody has implemented'))
    ok('and a READY agent carrying an adapter nobody wrote refuses the launch, naming both')
  else fail('an unimplemented adapter produced: ' + refused)

  const none = await bundles.compile(randomUUID(), randomUUID(), null, 'codex', 'none')
  if (none && none.args.length === 0)
    ok('and an agent that connects to nothing takes no arguments from us')
  else fail('the none adapter produced args: ' + JSON.stringify(none?.args))
}

// ADR-0119 / P-10 — a runner told through ONE environment variable holding its whole session
// config (Kilo: KILO_CONFIG_CONTENT, which outranks the project's own kilo.json).
{
  const sidK = randomUUID()
  const k = await bundles.compile(sidK, randomUUID(), null, 'kilo', 'config-content-env', null,
    { permission: { edit: 'ask', bash: 'ask' } })
  const content = k?.env?.KILO_CONFIG_CONTENT
  let parsed = null
  try { parsed = JSON.parse(content) } catch { /* reported below */ }
  if (!parsed) fail('the Kilo session got no parsable KILO_CONFIG_CONTENT: ' + JSON.stringify(k))
  else {
    const fabric = parsed.mcp?.fabric
    if (fabric?.type === 'remote' && fabric.url === surface.endpoint && fabric.headers?.Authorization === 'Bearer tok-' + sidK)
      ok('Kilo is handed Fabric as a remote server with the bearer of this session')
    else fail('the Kilo session config does not carry the surface: ' + JSON.stringify(parsed.mcp))
    if (parsed.permission?.edit === 'ask' && parsed.permission?.bash === 'ask') ok('and the permissions of the chosen mode are in the same document')
    else fail('the mode fragment did not reach the config: ' + JSON.stringify(parsed.permission))
    const brief = parsed.instructions?.[0]
    if (brief && brief.startsWith(path.join(root, 'sessions', sidK)) && (statSync(brief).mode & 0o777) === 0o600 && readFileSync(brief, 'utf8').includes('fabric_whoami'))
      ok('and the brief with the Fabric preamble is a 0600 file inside the session directory')
    else fail('the brief is missing, misplaced or readable by others: ' + brief)
  }
  if (k && k.args.length === 0 && !JSON.stringify(k.args).includes('tok-')) ok('and nothing goes into the arguments, where any process listing would show the credential')
  else fail('the Kilo bundle put something in argv: ' + JSON.stringify(k?.args))
  bundles.discard(sidK)
  if (revoked.includes(sidK) && !existsSync(path.join(root, 'sessions', sidK))) ok('and discarding it revokes the credential and removes the brief with the directory')
  else fail('discarding the Kilo bundle left the credential or the directory')
}

// ADR-0119 / P-10 — an ACP runner: the PTY runs Fabric's ACP shell, the agent runs inside it, and the
// session document (credential included) travels only in FABRIC_ACP_SESSION.
{
  const sidH = randomUUID()
  const h = await bundles.compile(sidH, randomUUID(), null, 'hermes', 'acp-session', null, { acpMode: 'ask' })
  const argv = h?.command ? [h.command.program, ...h.command.args] : []
  const sep = argv.indexOf('--')
  if (sep > 0 && argv[1] === '--experimental-strip-types' && argv[2].endsWith('acpShellMain.ts') && JSON.stringify(argv.slice(sep + 1)) === JSON.stringify(['hermes', 'acp']))
    ok('the terminal runs the ACP shell, which starts hermes in its ACP mode')
  else fail('the ACP command is wrong: ' + JSON.stringify(argv))
  if (!JSON.stringify(argv).includes('tok-')) ok('and no credential is in any argument')
  else fail('a credential reached argv: ' + JSON.stringify(argv))
  let spec = null
  try { spec = JSON.parse(h.env.FABRIC_ACP_SESSION) } catch { /* reported below */ }
  if (spec && spec.http.url === surface.endpoint && spec.http.headers[0].value === 'Bearer tok-' + sidH && spec.mode === 'ask')
    ok('the session document carries the surface with the bearer of this session, in ask mode')
  else fail('the ACP session document is wrong: ' + JSON.stringify(spec))
  const bridgeEnv = Object.fromEntries((spec?.stdio?.env ?? []).map((e) => [e.name, e.value]))
  if (spec && path.isAbsolute(spec.stdio.command) && spec.stdio.args.some((a) => a.endsWith('mcpStdioBridgeMain.ts')) && bridgeEnv.FABRIC_BRIDGE_AUTHORIZATION === 'Bearer tok-' + sidH && !spec.stdio.args.join(' ').includes('tok-'))
    ok('and the stdio bridge it offers an agent without HTTP MCP takes the bearer from its environment')
  else fail('the bridge entry is wrong: ' + JSON.stringify(spec?.stdio))
  if (h.env.HERMES_ACP_SKIP_CONFIGURED_MCP === '1') ok('and Hermes skips its own configured MCP servers, as --strict-mcp-config does')
  else fail('HERMES_ACP_SKIP_CONFIGURED_MCP is not set')
  const sidB = randomUUID()
  const b = await bundles.compile(sidB, randomUUID(), null, 'hermes', 'acp-session', null, { acpMode: 'bypass' })
  if (JSON.parse(b.env.FABRIC_ACP_SESSION).mode === 'bypass') ok('a bypass mode reaches the shell as bypass')
  else fail('the bypass mode did not reach the shell')
  bundles.discard(sidB)
  let refusedCline = null
  try { await bundles.compile(randomUUID(), randomUUID(), null, 'cline', 'acp-session') } catch (e) { refusedCline = String(e) }
  if (refusedCline && refusedCline.includes('not a ready Fabric executor')) ok('Cline, not yet connected on a probed build, is refused the surface')
  else fail('Cline was handed the surface before a probe connected it: ' + refusedCline)
  bundles.discard(sidH)
}

// HAR-R0-01 — compilation owns cleanup until it returns a bundle. These
// faults hit the real filesystem functions, including partial writes, rather
// than assuming that PtyManager will receive a bundle when compile rejects.
{
  const active = new Set()
  const rollbackSurface = {
    endpoint: surface.endpoint,
    mint: (_p, id) => { active.add(id); return { token: 'rollback-token-' + id } },
    revokeSession: (id) => active.delete(id)
  }
  const compiler = createBundleCompiler({
    root,
    surface: rollbackSurface,
    context: async () => 'durable shared context'
  })
  const compile = (id, adapter = 'mcp-config-flag') =>
    compiler.compile(id, 'rollback-project', null, 'claude-code', adapter)
  const sessionDir = (id) => path.join(root, 'sessions', id)
  const released = (id) => {
    assert.equal(active.has(id), false, 'failed compile must revoke its credential')
    assert.equal(existsSync(sessionDir(id)), false, 'failed compile must remove its session directory')
  }
  const fault = async (method, replacement, action) => {
    const original = fs[method]
    fs[method] = (...args) => replacement(original, ...args)
    syncBuiltinESMExports()
    try { await action() }
    finally { fs[method] = original; syncBuiltinESMExports() }
  }

  for (const boundary of ['mkdir before creation', 'mkdir', 'config write']) {
    const id = randomUUID()
    const primary = new Error('injected ' + boundary + ' failure')
    const isMkdir = boundary.startsWith('mkdir')
    const target = isMkdir ? sessionDir(id) : path.join(sessionDir(id), 'mcp.json')
    await fault(isMkdir ? 'mkdirSync' : 'writeFileSync', (original, file, ...args) => {
      if (file === target && boundary === 'mkdir before creation') throw primary
      const result = original(file, ...args)
      if (file === target) throw primary
      return result
    }, () => assert.rejects(compile(id), (error) => error === primary))
    released(id)
    ok('a partial ' + boundary + ' failure preserves the original error and releases the bundle')
  }

  // Seed one durable packet first: cleanup must not delete content-addressed
  // blobs shared by this successful session and a later failed compilation.
  const successful = randomUUID()
  const result = await compile(successful)
  assert.ok(result && active.has(successful))
  const packetPath = path.join(root, 'packets', 'packet-' + successful + '.json')
  const packet = JSON.parse(readFileSync(packetPath, 'utf8'))
  const blob = path.join(root, 'packets', 'blobs', packet.refs[0].sha256)
  const failedVerification = randomUUID()
  await fault('readFileSync', (original, file, ...args) =>
    file === blob ? 'corrupt bytes' : original(file, ...args),
    () => assert.rejects(compile(failedVerification), /execution packet does not verify/))
  released(failedVerification)
  assert.equal(readFileSync(blob, 'utf8'), 'durable shared context')
  assert.ok(existsSync(packetPath))
  assert.ok(existsSync(path.join(root, 'packets', 'packet-' + failedVerification + '.json')))
  compiler.discard(successful)
  released(successful)
  assert.ok(existsSync(blob) && existsSync(packetPath))
  ok('verification failure revokes the bundle while durable packet records and shared blobs survive')

  const unsupported = randomUUID()
  await assert.rejects(compile(unsupported, 'unimplemented'), /nobody has implemented/)
  released(unsupported)
  ok('unsupported adapter dispatch also rolls back after mint')

  const optional = randomUUID()
  const degraded = createBundleCompiler({ root, surface: rollbackSurface,
    context: async () => { throw new Error('optional context unavailable') } })
  assert.ok(await degraded.compile(optional, 'rollback-project', null, 'claude-code', 'mcp-config-flag'))
  assert.ok(active.has(optional) && existsSync(path.join(sessionDir(optional), 'mcp.json')))
  degraded.discard(optional)
  released(optional)
  ok('optional context failure still degrades to a usable bundle with its normal discard lifecycle')

  const cleanupFailure = randomUUID()
  const primary = new Error('original config write failure')
  let revokeAttempted = false
  const brokenRevoker = createBundleCompiler({ root, surface: {
    ...rollbackSurface,
    revokeSession: () => { revokeAttempted = true; throw new Error('revocation unavailable') }
  } })
  await fault('writeFileSync', (original, file, ...args) => {
    const result = original(file, ...args)
    if (file === path.join(sessionDir(cleanupFailure), 'mcp.json')) throw primary
    return result
  }, () => assert.rejects(
    brokenRevoker.compile(cleanupFailure, 'rollback-project', null, 'claude-code', 'mcp-config-flag'),
    (error) => error === primary))
  assert.ok(revokeAttempted)
  assert.equal(existsSync(sessionDir(cleanupFailure)), false)
  // A throwing revoker cannot promise success; only its attempt is asserted.
  rollbackSurface.revokeSession(cleanupFailure)
  ok('a failed revocation cannot hide the primary error or prevent credential-file cleanup')

  const unlinkFailure = randomUUID()
  const records = []
  useOps({ correlate: () => 'bundle-test', record: (record) => records.push(record) })
  try {
    await fault('rmSync', (original, file, ...args) => {
      if (file === sessionDir(unlinkFailure)) throw new Error('secret-token-must-not-be-logged')
      return original(file, ...args)
    }, () => assert.rejects(compile(unlinkFailure, 'unimplemented'), /nobody has implemented/))
    assert.equal(active.has(unlinkFailure), false, 'unlink failure must not keep the token live')
    assert.equal(records.length, 1, 'cleanup failure must be observable')
    assert.equal(JSON.stringify(records).includes('secret-token-must-not-be-logged'), false)
    assert.equal(records[0].error.message, 'could not remove session directory')
  } finally {
    useOps(null)
    compiler.discard(unlinkFailure)
  }
  released(unlinkFailure)
  ok('unlink failure preserves the launch error, revokes authority and logs no dependency error secrets')
}

if (failures > 0) {
  console.error('\\n' + failures + ' check(s) FAILED — a credential outlives what it was minted for')
  process.exit(1)
}
console.log('\\nall green: a bundle exists exactly as long as the session it was made for')
`

console.log('session bundle: a credential lives and dies with its session')
try {
  execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
    stdio: 'inherit',
    cwd: path.join(HERE, '..')
  })
} catch {
  process.exit(1)
}

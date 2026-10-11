// The packaged-app check of bin/fabric-mcp (scripts/lib/smoke-platform.mjs): initialize and tools/list answered by the
// launcher an install ships, read the way a coding agent reads it. The fake launchers below are real processes on
// this OS (a shell script, or a .cmd on Windows), so the spawn path the check takes on a runner is the one tested.
import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { MCP_PROBE_REQUESTS, mcpLauncher, mcpProbeVerdict, packagedMcpCheck, runMcpProbe } from '../lib/smoke-platform.mjs'

const INIT = { jsonrpc: '2.0', id: 1, result: { protocolVersion: '2025-06-18', capabilities: { tools: { listChanged: true } }, serverInfo: { name: 'fabric', version: '0.4.0' } } }
const LIST = { jsonrpc: '2.0', id: 2, result: { tools: [{ name: 'fabric_whoami', inputSchema: { type: 'object' } }] } }
const lines = (...m) => m.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join('\n') + '\n'

test('the requests are initialize, the initialized notice and tools/list, one JSON line each', () => {
  assert.deepEqual(MCP_PROBE_REQUESTS.map((r) => r.method), ['initialize', 'notifications/initialized', 'tools/list'])
  assert.deepEqual(MCP_PROBE_REQUESTS.map((r) => r.id), [1, undefined, 2])
})

test('a launcher that answers both and exits 0 when its stdin ends passes', () => {
  const v = mcpProbeVerdict({ stdout: lines(INIT, LIST), code: 0 })
  assert.equal(v.pass, true, v.why)
  assert.match(v.why, /fabric_whoami/)
})

test('anything else is a failure, and says which', () => {
  assert.match(mcpProbeVerdict({ stdout: lines(INIT), code: 0 }).why, /tools\/list/)
  assert.match(mcpProbeVerdict({ stdout: '', code: 1 }).why, /initialize/)
  assert.match(mcpProbeVerdict({ stdout: lines({ ...INIT, result: { ...INIT.result, serverInfo: { name: 'other' } } }, LIST), code: 0 }).why, /serverInfo/)
  assert.match(mcpProbeVerdict({ stdout: lines(INIT, { ...LIST, result: { tools: [{ name: 'fabric_whoami' }, { name: 'x' }] } }), code: 0 }).why, /one waiting tool/)
  assert.match(mcpProbeVerdict({ stdout: lines(INIT, { jsonrpc: '2.0', id: 2, error: { code: -32603, message: 'no' } }), code: 0 }).why, /tools\/list/)
  // Stdout is the protocol: a stray line breaks every MCP client.
  assert.match(mcpProbeVerdict({ stdout: lines('fabric-mcp: hello', INIT, LIST), code: 0 }).why, /not MCP/)
  assert.match(mcpProbeVerdict({ stdout: lines(INIT, LIST), code: 1 }).why, /exit 1/)
  assert.match(mcpProbeVerdict({ stdout: lines(INIT, LIST), code: null, signal: 'SIGKILL', timedOut: true }).why, /within/)
})

test('the launcher an install ships, from its executable', () => {
  const real = (p) => p
  assert.equal(mcpLauncher('/A/Fabric.app/Contents/MacOS/Fabric', 'darwin', real), '/A/Fabric.app/Contents/Resources/bin/fabric-mcp')
  // /usr/bin/passioncode-fabric is the .deb's link to the install folder.
  assert.equal(mcpLauncher('/usr/bin/passioncode-fabric', 'linux', () => '/opt/Fabric/passioncode-fabric'), '/opt/Fabric/resources/bin/fabric-mcp')
  assert.equal(mcpLauncher('C:\\Users\\r\\AppData\\Local\\Programs\\fabric\\Fabric.exe', 'win32', real), 'C:\\Users\\r\\AppData\\Local\\Programs\\fabric\\resources\\bin\\fabric-mcp.cmd')
})

/** A fake bin/fabric-mcp on this OS: a launcher that runs `node <server>` with the arguments it was given. */
function fakeLauncher(dir, server) {
  const js = path.join(dir, 'server.mjs')
  writeFileSync(js, server)
  if (process.platform === 'win32') {
    const cmd = path.join(dir, 'fabric-mcp.cmd')
    writeFileSync(cmd, `@echo off\r\n"${process.execPath}" "${js}" %*\r\n`)
    return cmd
  }
  const sh = path.join(dir, 'fabric-mcp')
  writeFileSync(sh, `#!/bin/sh\nexec "${process.execPath}" "${js}" "$@"\n`)
  chmodSync(sh, 0o755)
  return sh
}

// A server that answers by id, records what it saw, and exits 0 when stdin ends — fabric-mcp's own shape.
const GOOD = `
import { writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { createInterface } from 'node:readline'
const seen = { argv: process.argv.slice(2), home: homedir(), cwd: process.cwd() }
createInterface({ input: process.stdin }).on('line', (l) => {
  const m = JSON.parse(l)
  if (m.method === 'initialize') process.stdout.write(JSON.stringify(${JSON.stringify(INIT)}) + '\\n')
  if (m.method === 'tools/list') process.stdout.write(JSON.stringify(${JSON.stringify(LIST)}) + '\\n')
})
process.stdin.on('end', () => { writeFileSync(process.argv[1] + '.seen.json', JSON.stringify(seen)); process.exit(0) })
`

test('a real launcher: both answers, then stdin ends and it exits 0; HOME is the throwaway folder', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'fabric-mcp-probe-'))
  try {
    const launcher = fakeLauncher(dir, GOOD)
    const home = mkdtempSync(path.join(tmpdir(), 'fabric-mcp-home-'))
    const run = await runMcpProbe({ launcher, home, timeoutMs: 20_000 })
    const v = mcpProbeVerdict(run)
    assert.equal(v.pass, true, `${v.why}\n${run.stderr}`)
    const { readFileSync } = await import('node:fs')
    const seen = JSON.parse(readFileSync(path.join(dir, 'server.mjs.seen.json'), 'utf8'))
    assert.deepEqual(seen.argv, ['--runner', 'claude-code'])
    if (process.platform !== 'win32') assert.equal(seen.home, home, 'no real hub.json is read: the launcher runs with a throwaway HOME')
    rmSync(home, { recursive: true, force: true })
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('a launcher that never answers is ended at the bound, not waited on', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'fabric-mcp-probe-'))
  try {
    const launcher = fakeLauncher(dir, 'process.stdin.resume(); setInterval(() => {}, 1000)\n')
    const started = Date.now()
    const run = await runMcpProbe({ launcher, home: dir, timeoutMs: 1_500 })
    assert.equal(run.timedOut, true)
    assert.ok(Date.now() - started < 10_000)
    assert.equal(mcpProbeVerdict(run).pass, false)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('a launcher that cannot start the app is a failure with its stderr', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'fabric-mcp-probe-'))
  try {
    const launcher = fakeLauncher(dir, "process.stderr.write('Fabric: cannot load app.asar\\n'); process.exit(1)\n")
    const run = await runMcpProbe({ launcher, home: dir, timeoutMs: 10_000 })
    const v = mcpProbeVerdict(run)
    assert.equal(v.pass, false)
    assert.match(run.stderr, /cannot load app\.asar/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

/** An install folder laid out as Linux's or Windows' (<install>/resources/bin), its launcher a fake one. */
function fakeInstall(server) {
  const dir = mkdtempSync(path.join(tmpdir(), 'fabric-mcp-install-'))
  const win = process.platform === 'win32'
  const exe = path.join(dir, win ? 'Fabric.exe' : 'passioncode-fabric')
  writeFileSync(exe, '')
  const bin = path.join(dir, 'resources', 'bin')
  mkdirSync(bin, { recursive: true })
  if (server) fakeLauncher(bin, server)
  return { dir, exe, platform: win ? 'win32' : 'linux' }
}

test('the whole check on an install: its own launcher answers, and the verdict says so', async () => {
  const install = fakeInstall(GOOD)
  try {
    const v = await packagedMcpCheck({ exe: install.exe, platform: install.platform, timeoutMs: 20_000 })
    assert.equal(v.pass, true, `${v.why}\n${v.stderr}`)
  } finally { rmSync(install.dir, { recursive: true, force: true }) }
})

test('an install that ships no launcher fails, naming where it was looked for', async () => {
  const install = fakeInstall(null)
  try {
    const v = await packagedMcpCheck({ exe: install.exe, platform: install.platform, timeoutMs: 5_000 })
    assert.equal(v.pass, false)
    assert.match(v.why, /ships no MCP launcher at .*fabric-mcp/)
  } finally { rmSync(install.dir, { recursive: true, force: true }) }
})

test('the release refuses before codesign a bundle whose fabric-mcp fails, and its receipt records the check', () => {
  const src = readFileSync(new URL('../release-mac.mjs', import.meta.url), 'utf8')
  const check = src.indexOf('await packagedMcpCheck(')
  assert.ok(check > 0, 'scripts/release-mac.mjs runs packagedMcpCheck on the built app')
  assert.ok(check > src.indexOf('fuseProblems(await getCurrentFuseWire(app))'), 'after the fuses are read back')
  assert.ok(check < src.indexOf("run('codesign', ['--verify'"), 'before the signature is verified, so no receipt is written for it')
  assert.match(src, /if \(!mcp\.pass\) fail\(/)
  assert.match(src, /fabricMcp: mcp\.why/)
})

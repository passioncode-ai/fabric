import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

// #region smoke-platform-verdict — docs: docs/evidence/plans/2026-10-10-windows-linux-port.md#req-table
// What a SMOKE run's output means (0.3.5, REQ-03). The causes a Windows runner may legitimately end on are the
// stack's own: it has no Docker that runs Linux containers. Everything else — a crash, a hang, an unknown cause, a
// schema or identity refusal — is a failure of the package, whatever the expectation.
export const STACK_CAUSES = Object.freeze(['supabase-cli-missing', 'stack-would-not-start', 'stack-start-timed-out', 'stack-up-but-silent', 'database-unreachable'])

export function smokeVerdict({ output, code, signal, expect }) {
  const ok = /^SMOKE OK\b/m.test(output)
  const failed = /^SMOKE FAILED \(([a-z-]+)\)/m.exec(output)?.[1] ?? null
  if (ok && code === 0) return { pass: true, why: 'SMOKE OK: the app booted end to end' }
  if (expect === 'ok') return { pass: false, why: failed ? `expected SMOKE OK, the app stopped on ${failed}` : `expected SMOKE OK, got no verdict (exit ${code}${signal ? `, ${signal}` : ''})` }
  if (failed && STACK_CAUSES.includes(failed)) return { pass: true, why: `the app started and named its stack's absence (${failed})` }
  if (failed) return { pass: false, why: `the app stopped on ${failed}, not on the stack` }
  return { pass: false, why: `the app gave no SMOKE verdict (exit ${code}${signal ? `, ${signal}` : ''}): a crash or a hang` }
}
// #endregion smoke-platform-verdict

// #region fabric-mcp-probe — docs: docs/launch/release-mac.md#how-a-release-is-made
// The packaged app's MCP entry (ADR-0134), checked the way a coding agent uses it: the launcher an install ships
// (`bin/fabric-mcp`, `bin/fabric-mcp.cmd`) runs the app's own binary as Node on `app.asar/out/main/fabric-mcp.js`.
// That path depends on the Electron fuses (`runAsNode` on, the asar's integrity, NODE_OPTIONS off —
// apps/desktop/electron-builder.yml), so it is proven on the built artifact, not on the sources. With a throwaway
// HOME no hub is found, and the proxy must answer `initialize` and list its one waiting tool, `fabric_whoami`.
export const MCP_PROBE_RUNNER = 'claude-code'
export const MCP_WAITING_TOOL = 'fabric_whoami'
export const MCP_PROBE_REQUESTS = Object.freeze([
  { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'fabric-smoke', version: '1' } } },
  { jsonrpc: '2.0', method: 'notifications/initialized' },
  { jsonrpc: '2.0', id: 2, method: 'tools/list' }
])

/** The launcher beside an installed executable: macOS Contents/Resources/bin, Linux and Windows <install>/resources/bin. */
export function mcpLauncher(exe, platform = process.platform, realpath = realpathSync) {
  if (platform === 'win32') return path.win32.join(path.win32.dirname(exe), 'resources', 'bin', 'fabric-mcp.cmd')
  // The .deb's /usr/bin/passioncode-fabric is a link into the install folder.
  const real = realpath(exe)
  if (platform === 'darwin') return path.posix.join(path.posix.dirname(path.posix.dirname(real)), 'Resources', 'bin', 'fabric-mcp')
  return path.posix.join(path.posix.dirname(real), 'resources', 'bin', 'fabric-mcp')
}

/** What a probe run printed means. Stdout is the protocol: every line must be JSON-RPC. */
export function mcpProbeVerdict({ stdout, code, signal, timedOut }) {
  const byId = new Map()
  for (const line of String(stdout ?? '').split('\n')) {
    if (!line.trim()) continue
    let m
    try { m = JSON.parse(line) } catch { return { pass: false, why: `stdout carries a line that is not MCP: ${line.slice(0, 80)}` } }
    if (m?.jsonrpc !== '2.0') return { pass: false, why: `stdout carries a line that is not MCP: ${line.slice(0, 80)}` }
    if (m.id !== undefined) byId.set(m.id, m)
  }
  const exit = `exit ${code}${signal ? `, ${signal}` : ''}`
  const init = byId.get(1)
  if (!init?.result) return { pass: false, why: `no answer to initialize (${timedOut ? 'not within the bound' : exit}${init?.error ? `: ${init.error.message}` : ''})` }
  if (init.result.serverInfo?.name !== 'fabric' || !init.result.capabilities?.tools) return { pass: false, why: `initialize answered with serverInfo ${JSON.stringify(init.result.serverInfo)} and no tools capability` }
  const list = byId.get(2)
  if (!list?.result) return { pass: false, why: `no answer to tools/list (${timedOut ? 'not within the bound' : exit}${list?.error ? `: ${list.error.message}` : ''})` }
  const names = (list.result.tools ?? []).map((t) => t?.name)
  if (names.length !== 1 || names[0] !== MCP_WAITING_TOOL) return { pass: false, why: `tools/list should hold the one waiting tool ${MCP_WAITING_TOOL} while no hub runs, got [${names.join(', ')}]` }
  if (timedOut) return { pass: false, why: 'answered, but did not exit within the bound once its stdin ended' }
  if (code !== 0) return { pass: false, why: `answered, then ended with ${exit} when its stdin ended` }
  return { pass: true, why: `bin/fabric-mcp answered initialize (${init.result.protocolVersion}) and listed ${MCP_WAITING_TOOL}; it exited 0 when its stdin ended` }
}

/** How the launcher is started: a .cmd only through cmd.exe (Node refuses to spawn one directly). */
export function mcpProbeInvocation(launcher, platform = process.platform, comspec = process.env.ComSpec) {
  if (platform === 'win32') return { file: comspec || 'cmd.exe', args: ['/d', '/s', '/c', `""${launcher}" --runner ${MCP_PROBE_RUNNER}"`], windowsVerbatimArguments: true }
  return { file: launcher, args: ['--runner', MCP_PROBE_RUNNER], windowsVerbatimArguments: false }
}

/**
 * Runs the launcher with a throwaway home (HOME, and the folders Windows and Linux keep the hub under), sends the
 * requests, ends stdin once both answers are in, and waits for the exit. Resolves `{ stdout, stderr, code, signal,
 * timedOut }`; never rejects for the launcher's own failure.
 */
export function runMcpProbe({ launcher, home, timeoutMs = 60_000, platform = process.platform, spawnFn = spawn }) {
  const how = mcpProbeInvocation(launcher, platform)
  const env = { ...process.env, HOME: home, USERPROFILE: home, LOCALAPPDATA: home, XDG_DATA_HOME: home }
  delete env.ELECTRON_RUN_AS_NODE
  return new Promise((resolve) => {
    let stdout = '', stderr = '', timedOut = false, settled = false
    const done = (r) => { if (!settled) { settled = true; clearTimeout(timer); resolve(r) } }
    const child = spawnFn(how.file, how.args, { cwd: home, env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, windowsVerbatimArguments: how.windowsVerbatimArguments })
    const timer = setTimeout(() => {
      timedOut = true
      if (platform === 'win32') spawnFn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
      else child.kill('SIGKILL')
    }, timeoutMs)
    child.on('error', (e) => done({ stdout, stderr: stderr + `\n${e.message}`, code: null, signal: null, timedOut }))
    child.stdout.on('data', (d) => {
      stdout += d
      // Both answers in: end stdin, which is how an agent leaves; the proxy must then exit 0.
      if (/"id":1\b/.test(stdout) && /"id":2\b/.test(stdout) && child.stdin.writable) child.stdin.end()
    })
    child.stderr.on('data', (d) => { stderr += d })
    child.stdin.on('error', () => { /* The launcher is gone; its exit says why. */ })
    child.on('close', (code, signal) => done({ stdout, stderr, code, signal, timedOut }))
    child.stdin.write(MCP_PROBE_REQUESTS.map((r) => JSON.stringify(r)).join('\n') + '\n')
  })
}

/**
 * The whole check on an installed or built app, as scripts/smoke-platform.mjs (`--mcp`, `--mcp-only`) and
 * scripts/release-mac.mjs make it: the launcher beside `exe` must exist and pass `mcpProbeVerdict`. Resolves
 * `{ pass, why, stderr }`; a missing launcher is a failure that says where it was looked for.
 */
export async function packagedMcpCheck({ exe, platform = process.platform, tmpRoot = tmpdir(), timeoutMs = 60_000 }) {
  let launcher
  try { launcher = mcpLauncher(exe, platform) } catch (e) { return { pass: false, why: `no launcher beside ${exe}: ${e.message}`, stderr: '' } }
  if (!existsSync(launcher)) return { pass: false, why: `the install ships no MCP launcher at ${launcher}`, stderr: '' }
  const home = mkdtempSync(path.join(tmpRoot, 'fabric-mcp-home-'))
  try {
    const run = await runMcpProbe({ launcher, home, timeoutMs, platform })
    return { ...mcpProbeVerdict(run), stderr: run.stderr }
  } finally {
    try { rmSync(home, { recursive: true, force: true }) } catch { /* A Windows file still held by an exiting process; the runner discards it. */ }
  }
}
// #endregion fabric-mcp-probe

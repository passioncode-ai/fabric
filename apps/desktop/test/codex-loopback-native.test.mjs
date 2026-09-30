// Manual installed-build probe: only initialize; no thread, turn, model,
// account, resume or configuration RPC. Not a native-TUI or Stop acceptance.
// Node >=26 supplies the header-capable built-in WebSocket used by this probe.
import { execFileSync, spawn } from 'node:child_process'
import { randomBytes, createHash } from 'node:crypto'
import { request as httpRequest } from 'node:http'
import { mkdtempSync, mkdirSync, realpathSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import path from 'node:path'

if (process.platform !== 'darwin' || Number(process.versions.node.split('.')[0]) < 26) {
  console.error(JSON.stringify({ status: 'NOT_RUN', reason: 'requires_macos_and_node26_builtin_websocket' })); process.exit(2)
}
const binary = process.env.FABRIC_CODEX_BIN ?? '/opt/homebrew/bin/codex'
const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'fabric-codex-ws-')))
const profile = path.join(root, 'profile'); mkdirSync(profile, { mode: 0o700 })
const sandbox = path.join(root, 'probe.sb')
const denied = ['.codex', '.claude', '.agents', '.config', 'Library/Keychains'].map(p => path.join(homedir(), p))
writeFileSync(sandbox, [
  '(version 1)', '(allow default)', '(deny network*)',
  // Only the listener needs network access. The server may not initiate any
  // outbound connection, including loopback; the probe client runs separately.
  // macOS accepts "localhost", not a numeric host, in this sandbox filter.
  // The actual listener below is explicitly bound to IPv4 127.0.0.1 only.
  '(allow network-bind (local ip "localhost:*"))',
  '(allow network-inbound (local ip "localhost:*"))',
  '(deny file-write*)', `(allow file-write* (subpath ${JSON.stringify(root)}))`,
  `(deny file-read* ${denied.map(p => `(subpath ${JSON.stringify(p)})`).join(' ')})`,
  '(deny mach-lookup (global-name "com.apple.securityd"))'
].join('\n'), { mode: 0o600 })
const childEnv = { PATH: process.env.PATH, LANG: 'en_US.UTF-8', CODEX_HOME: profile, TMPDIR: root, NO_COLOR: '1' }
const token = randomBytes(32).toString('hex'), wrongToken = randomBytes(32).toString('hex')
const tokenDigest = createHash('sha256').update(token).digest('hex')
const clients = [], requests = []
let child, exit, exited = false, stderrBytes = 0, stdoutBytes = 0, build = null, stage = 'version', cleanup = null
class ProbeFailure extends Error { constructor(code) { super(code); this.code = code } }
function check(value, code) { if (!value) throw new ProbeFailure(code) }
async function bounded(promise, ms, reason) {
  let timer
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new ProbeFailure(reason)), ms) })]) }
  finally { clearTimeout(timer) }
}
function deniedUpgrade(port, auth) {
  return new Promise((resolve, reject) => {
    const headers = { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': randomBytes(16).toString('base64') }
    if (auth) headers.Authorization = `Bearer ${auth}`
    const request = httpRequest({ hostname: '127.0.0.1', port, path: '/', method: 'GET', headers }, response => {
      response.resume(); resolve(response.statusCode)
    })
    requests.push(request)
    request.once('upgrade', (_response, socket) => { socket.destroy(); reject(new ProbeFailure('unauthorized_upgrade_accepted')) })
    request.once('error', () => reject(new ProbeFailure('negative_upgrade_transport_error')))
    request.setTimeout(3000, () => request.destroy()); request.end()
  })
}
async function connect(port) {
  // The raw token exists only in probe memory and the header. No token file,
  // parent environment mutation, provider argv token or durable credential.
  const socket = new WebSocket(`ws://127.0.0.1:${port}/`, { headers: { Authorization: `Bearer ${token}` } })
  let resolveReply, rejectReply, settled = false, eventCount = 0, bytes = 0
  const reply = new Promise((resolve, reject) => { resolveReply = resolve; rejectReply = reject })
  // Drain rejection even if opening fails before this promise is awaited.
  reply.catch(() => undefined)
  const fail = reason => { if (!settled) { settled = true; rejectReply(new ProbeFailure(reason)) } }
  const closed = new Promise(resolve => socket.addEventListener('close', resolve, { once: true }))
  const client = { socket, reply, closed, get eventCount() { return eventCount } }; clients.push(client)
  socket.addEventListener('error', () => fail('websocket_error'))
  socket.addEventListener('close', () => fail('websocket_closed_before_reply'))
  socket.addEventListener('message', event => {
    if (typeof event.data !== 'string') { fail('nontext_websocket_message'); return }
    bytes += Buffer.byteLength(event.data)
    if (++eventCount > 32 || bytes > 262144) { fail('websocket_observation_limit'); socket.close(); return }
    let value
    try { value = JSON.parse(event.data) } catch { fail('invalid_websocket_json'); return }
    if (!value || typeof value !== 'object' || Array.isArray(value)) { fail('invalid_rpc_envelope'); return }
    if ('id' in value) {
      if (value.id !== 'shared-initialize-id' || !value.result || typeof value.result !== 'object' || 'error' in value || 'method' in value) { fail('invalid_initialize_reply'); return }
      if (settled) return
      settled = true; resolveReply(value.result)
    } else if (typeof value.method !== 'string' || value.method.length > 128) fail('invalid_notification')
    // Notification bodies are discarded, never persisted as evidence/logs.
  })
  await bounded(new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', () => reject(new ProbeFailure('authorized_upgrade_failed')), { once: true })
    socket.addEventListener('close', () => reject(new ProbeFailure('authorized_upgrade_closed')), { once: true })
  }), 5000, 'authorized_upgrade_timeout')
  return client
}
try {
  build = execFileSync('/usr/bin/sandbox-exec', ['-f', sandbox, binary, '--version'], {
    cwd: root, env: childEnv, encoding: 'utf8', timeout: 5000, maxBuffer: 65536, stdio: ['ignore', 'pipe', 'pipe']
  }).trim()
  check(build === 'codex-cli 0.157.1', 'unreviewed_codex_build')
  stage = 'listener'
  child = spawn('/usr/bin/sandbox-exec', ['-f', sandbox, binary, 'app-server', '--listen', 'ws://127.0.0.1:0',
    '--ws-auth', 'capability-token', '--ws-token-sha256', tokenDigest], { cwd: root, env: childEnv, stdio: ['pipe', 'pipe', 'pipe'] })
  exit = new Promise(resolve => child.once('exit', (code, signal) => { exited = true; resolve({ code, signal }) }))
  child.on('error', () => { /* Startup is reported by the bounded listener/exit gate, not raw process text. */ })
  child.stdout.on('data', chunk => { stdoutBytes += chunk.length })
  const listener = new Promise((resolve, reject) => {
    let partial = '', discovered = false
    child.stderr.on('data', chunk => {
      stderrBytes += chunk.length
      if (stderrBytes > 1048576) { reject(new ProbeFailure('stderr_limit')); return }
      partial += chunk.toString('utf8')
      if (partial.length > 16384) { reject(new ProbeFailure('stderr_line_limit')); partial = ''; return }
      let newline
      while ((newline = partial.indexOf('\n')) >= 0) {
        const line = partial.slice(0, newline); partial = partial.slice(newline + 1)
        const match = /^\s*listening on:\s*ws:\/\/127\.0\.0\.1:(\d+)\s*$/.exec(line)
        if (!match) continue
        if (discovered) { reject(new ProbeFailure('duplicate_listener_receipt')); continue }
        const port = Number(match[1]); if (!Number.isInteger(port) || port < 1 || port > 65535) { reject(new ProbeFailure('invalid_listener_port')); continue }
        discovered = true; resolve(port)
      }
    })
    child.once('exit', () => reject(new ProbeFailure('listener_exited_before_ready')))
  })
  const port = await bounded(listener, 10000, 'listener_timeout')
  stage = 'unauthorized_clients'
  const absentStatus = await bounded(deniedUpgrade(port), 4000, 'absent_token_timeout')
  const wrongStatus = await bounded(deniedUpgrade(port, wrongToken), 4000, 'wrong_token_timeout')
  check(absentStatus === 401 && wrongStatus === 401, 'unauthorized_upgrade_not_401')
  stage = 'authorized_clients'
  const first = await connect(port), second = await connect(port)
  // Same RPC id deliberately appears on both independent connections. Distinct
  // client versions must be reflected in the corresponding initialize reply.
  const versions = ['probe-client-A', 'probe-client-B']
  for (const [i, client] of [first, second].entries()) client.socket.send(JSON.stringify({ id: 'shared-initialize-id', method: 'initialize', params: {
    clientInfo: { name: 'fabric_loopback_probe', version: versions[i], title: 'Fabric isolated loopback probe' }, capabilities: { experimentalApi: true }
  } }))
  const replies = await bounded(Promise.all([first.reply, second.reply]), 5000, 'initialize_timeout')
  for (const [i, result] of replies.entries()) {
    check(result.codexHome === profile, 'owned_profile_mismatch'); check(result.platformOs === 'macos', 'platform_mismatch')
    check(typeof result.userAgent === 'string' && result.userAgent.includes(versions[i]) && !result.userAgent.includes(versions[1 - i]), 'connection_response_routing_unproved')
  }
  stage = 'cleanup'
  for (const client of clients) client.socket.close()
  await bounded(Promise.all(clients.map(c => c.closed)), 3000, 'client_close_timeout')
  check(!exited, 'server_exited_on_view_disconnect')
  child.kill('SIGTERM'); cleanup = await bounded(exit, 5000, 'server_exit_timeout')
  check(cleanup.code === 0 || cleanup.signal === 'SIGTERM', 'unexpected_server_exit')
  console.log(JSON.stringify({ status: 'PASS', build, node: process.versions.node,
    boundary: 'owned authenticated loopback initialize only', profileVerified: true,
    absentTokenHttpStatus: absentStatus, wrongTokenHttpStatus: wrongStatus, initializedClients: replies.length,
    repeatedRequestIdAcrossConnections: true, responseRoutingVerified: true,
    network: 'server_loopback_bind_inbound_only_outbound_denied', operatorConfig: 'denied',
    threadRequests: 0, turnRequests: 0, resumeRequests: 0, modelRequests: 0,
    notificationBodiesRetained: false, stderrBytes, stdoutBytes, serverExit: cleanup }))
} catch (error) {
  // Native errors can contain paths/config/token-bearing details. Emit only
  // codes authored above, never message/stack/stdout/stderr from caught errors.
  console.error(JSON.stringify({ status: 'FAIL', stage, reason: error instanceof ProbeFailure ? error.code : 'probe_operation_failed' }))
  process.exitCode = 1
} finally {
  for (const request of requests) request.destroy()
  for (const client of clients) { try { client.socket.close() } catch { /* Already-closed owned client needs no further action. */ } }
  if (child?.pid && !exited) {
    child.kill('SIGTERM')
    try { await bounded(exit, 1000, 'cleanup_term_timeout') } catch { /* Escalation applies only to this disposable probe process. */ }
    if (!exited) { child.kill('SIGKILL'); try { await bounded(exit, 3000, 'cleanup_kill_timeout') } catch { /* Preserve fixture if actual exit remains unknown. */ } }
  }
  if (child?.pid && !exited) {
    console.error(JSON.stringify({ status: 'FAIL', reason: 'owned_probe_exit_unobserved_fixture_preserved' })); process.exitCode = 1
  } else rmSync(root, { recursive: true, force: true })
}

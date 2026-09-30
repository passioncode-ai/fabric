// Manual installed-build probe (first-slice plan B2b-3): the actual owned backend registry starts
// the installed `codex app-server` under its sandbox recipe with a per-backend token digest; the
// port comes from the backend's own stderr receipt; Fabric's loopback client initializes and starts
// one thread. No turn, no model, no account, no operator configuration. Not a Stop acceptance.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createOwnedBackendProcessRegistry } from '../src/main/ownedBackendProcessRegistry.ts'
import { connectLoopback } from '../src/main/loopbackWsClient.ts'
import { bindCodexLoopbackTurn, codexLoopbackRecipe, mintLoopbackToken, startCodexThread } from '../src/main/codexLoopback.ts'
import { isMeasuredRuntime, runtimeTuple } from '../src/main/runtimeAdmission.ts'

const PINNED_BUILD = 'codex-cli 0.157.1'
if (process.platform !== 'darwin' || !isMeasuredRuntime()) { console.error(JSON.stringify({ status: 'NOT_RUN', reason: 'requires_measured_darwin_runtime', runtime: runtimeTuple().runtime })); process.exit(2) }
const binary = realpathSync(process.env.FABRIC_CODEX_BIN ?? '/opt/homebrew/bin/codex')
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'fabric-codex-thread-')))
class ProbeFailure extends Error { constructor(code) { super(code); this.code = code } }
const check = (v, code) => { if (!v) throw new ProbeFailure(code) }
const delay = ms => new Promise(r => setTimeout(r, ms))
let stage = 'recipe', registry, handle, clients = [], summary = {}, tree = []
// The backend's own tree, found by its unique per-launch token digest and walked by parent while each
// parent's identity (pid + start time) is known. Only this probe's disposable processes are named.
function backendTree(digest) {
  const rows = execFileSync('/bin/ps', ['-axww', '-o', 'pid=,ppid=,pgid=,lstart=,command='], { encoding: 'utf8', maxBuffer: 8 << 20 }).split('\n')
    .map(l => /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\w{3} \w{3}\s+\d+ [\d:]+ \d{4})\s+(.*)$/.exec(l)).filter(Boolean).map(m => ({ pid: +m[1], ppid: +m[2], pgid: +m[3], start: m[4], command: m[5] }))
  const root = rows.filter(r => r.command.includes(digest) && r.command.includes('app-server'))
  const out = [...root]; for (let i = 0; i < out.length; i++) for (const r of rows) if (r.ppid === out[i].pid && !out.includes(r)) out.push(r)
  return out.map(({ pid, pgid, start }) => ({ pid, pgid, start }))
}
const alive = rows => { const now = backendTree.all(); return rows.filter(r => now.some(n => n.pid === r.pid && n.start === r.start)) }
backendTree.all = () => execFileSync('/bin/ps', ['-axww', '-o', 'pid=,lstart='], { encoding: 'utf8', maxBuffer: 8 << 20 }).split('\n')
  .map(l => /^\s*(\d+)\s+(\w{3} \w{3}\s+\d+ [\d:]+ \d{4})/.exec(l)).filter(Boolean).map(m => ({ pid: +m[1], start: m[2] }))
try {
  const { recipe, listener, codexHome } = codexLoopbackRecipe({ binary, binarySha256: createHash('sha256').update(readFileSync(binary)).digest('hex'), root: path.join(root, 'scope'), path: process.env.PATH ?? '/usr/bin:/bin' })
  stage = 'build'
  const build = execFileSync(recipe.executable, [...recipe.argv.slice(0, 3), '--version'], { cwd: recipe.cwd, env: recipe.env, encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  if (build !== PINNED_BUILD) { console.error(JSON.stringify({ status: 'NOT_RUN', reason: 'unreviewed_codex_build' })); process.exit(2) }
  stage = 'start'
  mkdirSync(path.join(root, 'registry'), { mode: 0o700 })
  registry = createOwnedBackendProcessRegistry({ rootDir: path.join(root, 'registry'), estateId: id(1), recipe, timeoutMs: 5000, listener: { ...listener, timeoutMs: 15000 }, authority: () => ({ personId: id(2), revision: 1 }) })
  const { token, launch } = mintLoopbackToken(), a = { admitted: true, project_id: id(3), task_id: id(4), task_run_id: id(5), session_id: id(6), run_ordinal: 1 }
  const started = await registry.start(a, a.session_id, async () => true, launch)
  check(started.state === 'owned', 'backend_not_owned:' + started.reasonCode); handle = started.handle
  stage = 'listener'
  const l = await registry.listener(handle); check(l.state === 'listening', 'listener_' + (l.reasonCode ?? 'unknown'))
  stage = 'unauthorized'
  const wrong = await connectLoopback({ port: l.port, token: mintLoopbackToken().token, onNotification() {} })
  check(!wrong.ok && wrong.reason === 'unauthorized', 'wrong_token_not_refused')
  stage = 'connect'
  const notes = [], c = await connectLoopback({ port: l.port, token, timeoutMs: 8000, onNotification: n => notes.push(n.method) })
  check(c.ok, 'authorized_connect_failed:' + c.reason); clients.push(c.client)
  stage = 'thread'
  const thread = await startCodexThread(c.client, { codexHome, cwd: realpathSync(path.join(root, 'scope')), stillAllowed: () => true })
  check(thread.ok, 'thread_' + thread.reasonCode)
  check(`codex-cli ${thread.cliVersion}` === PINNED_BUILD, 'thread_cli_version_mismatch')
  stage = 'fence'
  let allowed = true
  const fenced = c.client.request('thread/start', { cwd: realpathSync(path.join(root, 'scope')) }, () => allowed); allowed = false
  const f = await fenced; check(f.status === 'not_sent' && f.reason === 'effect_fenced', 'fenced_request_sent')
  stage = 'binding'
  const snap = registry.snapshot(handle)
  const input = { fabric: { estateId: id(1), taskId: id(4), runId: id(5), sessionId: id(6) }, build: thread.cliVersion,
    backend: { epoch: handle.channelEpoch, processRef: snap.processIdentityRef }, connectionId: c.client.connectionId, threadId: thread.threadId,
    manifestDigest: 'a'.repeat(64), policyDigest: 'b'.repeat(64) }
  check(bindCodexLoopbackTurn({ ...input, turn: null }).reasonCode === 'codex_thread_turn_required', 'binding_without_turn_accepted')
  check(bindCodexLoopbackTurn({ ...input, turn: { threadId: 'another-thread', turn: { id: 'turn-x' } } }).reasonCode === 'foreign_thread', 'foreign_thread_accepted')
  stage = 'reconnect'
  const again = await connectLoopback({ port: l.port, token, onNotification() {} }); check(again.ok, 'reconnect_failed'); clients.push(again.client)
  check(again.client.connectionId !== c.client.connectionId, 'reconnect_reused_writer')
  summary = { build, threadIdShape: /^[0-9a-f-]{36}$/.test(thread.threadId), sessionIdPresent: thread.sessionId !== null, notifications: [...new Set(notes)].sort(),
    wrongToken: wrong.reason, fencedBeforeWrite: f.reason, bindingWithoutTurn: 'codex_thread_turn_required', foreignThread: 'foreign_thread', reconnectIsNewWriter: true,
    processRef: /^process:[a-f0-9]{64}$/.test(snap.processIdentityRef), turnRequests: 0, modelRequests: 0 }
  stage = 'cleanup'
  tree = backendTree(launch.argv[1]); check(tree.length >= 1, 'backend_tree_not_found')
  const leftGroup = tree.filter(r => r.pgid !== tree[0].pgid).length
  for (const client of clients) client.close()
  check((await registry.signalOwned(handle, 'SIGTERM', () => true)).sent === true, 'term_not_sent')
  let s; for (let i = 0; i < 100; i++) { s = await registry.inspect(handle); if (s.rootExitObserved && s.processGroup !== 'active') break; await delay(50) }
  check(s.rootExitObserved, 'backend_root_exit_unobserved')
  // A descendant in its own session is outside the group Stop signals: the registry says `unknown`,
  // and whether it ends on its own is measured here, not assumed.
  let remaining = alive(tree); for (let i = 0; i < 100 && remaining.length; i++) { await delay(100); remaining = alive(tree) }
  const exitedOnTheirOwn = remaining.length === 0
  for (const r of remaining) { try { process.kill(r.pid, 'SIGKILL') } catch { /* Already gone between the read and the signal. */ } }
  await delay(200); check(alive(tree).length === 0, 'backend_descendant_survived_cleanup')
  summary = { ...summary, processGroupAfterExit: s.processGroup, descendantsOutsideGroup: leftGroup, descendantsExitedOnTheirOwn: exitedOnTheirOwn }
  // With the owned profile's shell snapshot off (B3-2) nothing leaves the group, so it can quiesce.
  check(leftGroup === 0 && s.processGroup === 'quiescent', `backend_group_not_quiescent:${s.processGroup}:${leftGroup}`)
  console.log(JSON.stringify({ status: 'PASS', runtime: runtimeTuple().runtime, node: process.versions.node, boundary: 'owned registry + loopback client: initialize and one thread, no turn', ...summary, backendExit: { code: s.exitCode, signal: s.exitSignal } }))
} catch (error) {
  // Native errors can carry paths or tokens; only codes written above leave this probe.
  console.error(JSON.stringify({ status: 'FAIL', stage, reason: error instanceof ProbeFailure ? error.code : 'probe_operation_failed' }))
  process.exitCode = 1
} finally {
  for (const client of clients) client.close()
  if (registry && handle) {
    try { const s = await registry.inspect(handle); if (!s.rootExitObserved) { await registry.signalOwned(handle, 'SIGKILL', () => true); await delay(500) } } catch { /* The registry's own cleanup below still runs. */ }
  }
  registry?.retire()
  let quiet = true
  if (registry && handle) { try { const s = await registry.inspect(handle); quiet = s.rootExitObserved } catch { /* An unreadable handle leaves the fixture in place. */ quiet = false } }
  if (quiet) rmSync(root, { recursive: true, force: true }); else { console.error(JSON.stringify({ status: 'FAIL', reason: 'owned_probe_exit_unobserved_fixture_preserved' })); process.exitCode = 1 }
}

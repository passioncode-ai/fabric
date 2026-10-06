// P-10 AS-04/AS-05 (ADR-0119): the ACP terminal shell against a fixture agent, no terminal needed.
// #region acp-shell — docs: docs/adr/0119-acp-is-the-generic-runner-drive-and-runners-are-catalogue-rows.md#amendment-4--2026-10-06-what-the-032-verification-changed-and-what-is-not-built-yet
import assert from 'node:assert/strict'
import nodeTest from 'node:test'
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { PassThrough } from 'node:stream'
import { runAcpShell, surfaceFor, automaticChoice, answeredChoice, describeUpdate, isAuthRequired } from '../src/main/acpShell.ts'

const AGENT = path.join(import.meta.dirname, 'fixtures/acp-fake-agent.mjs')
const TOKEN = 'tok-session-credential'
const spec = (over = {}) => ({
  cwd: tmpdir(),
  http: { type: 'http', name: 'fabric', url: 'http://127.0.0.1:1/mcp', headers: [{ name: 'Authorization', value: 'Bearer ' + TOKEN }] },
  stdio: { name: 'fabric', command: '/usr/bin/false', args: ['bridge'], env: [{ name: 'FABRIC_BRIDGE_AUTHORIZATION', value: 'Bearer ' + TOKEN }] },
  brief: 'BRIEF: call fabric_whoami first.',
  mode: 'ask',
  ...over
})
// Every case is bounded: a session that never ends (the defect some of these plant) fails the case
// instead of hanging the run.
const test = (name, fn) => nodeTest(name, { timeout: 30_000 }, fn)
const live = new Set()
const groupKill = (pid, sig) => { try { process.kill(-pid, sig) } catch { /* the group is gone */ } }
const groupAlive = (pid) => { try { process.kill(-pid, 0); return true } catch (e) { return e.code === 'EPERM' } }
const pidAlive = (pid) => { try { process.kill(pid, 0); return true } catch (e) { return e.code === 'EPERM' } }
const waitFor = async (fn, ms) => { const end = Date.now() + ms; while (Date.now() < end) { if (fn()) return true; await new Promise((r) => setTimeout(r, 25)) } return fn() }
nodeTest.afterEach(() => { for (const end of live) end(); live.clear() })
const session = (s, { http = true, env = {}, timeouts, agentArgs = [AGENT] } = {}) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'acp-shell-'))
  const recordFile = path.join(dir, 'record.jsonl')
  const input = new PassThrough(), output = new PassThrough()
  let shown = ''
  output.on('data', (c) => { shown += c })
  let interrupt = () => {}
  let terminate = () => {}
  let argv = null
  let child = null
  const done = runAcpShell(s, {
    input, output,
    onInterrupt: (l) => { interrupt = l },
    onTerminate: (l) => { terminate = l },
    timeouts,
    spawnAgent() {
      // As acpShellMain.ts does it: the agent leads its own process group, and the shell's signals
      // and liveness reach the whole group (audit 2026-10-06 DA-1 — the stub that signalled only the
      // direct child could not see the agent's own tools outliving a stop).
      child = spawn(process.execPath, agentArgs, { env: { ...process.env, FAKE_ACP_RECORD: recordFile, FAKE_ACP_HTTP: http ? '1' : '0', ...env }, stdio: ['pipe', 'pipe', 'pipe'], detached: true })
      argv = child.spawnargs
      return { stdin: child.stdin, stdout: child.stdout, stderr: child.stderr, kill: (sig) => groupKill(child.pid, sig), alive: () => groupAlive(child.pid), onExit: (l) => child.on('exit', l) }
    }
  })
  // Cleanup that runs whether the test passed or failed: a failing assertion must end the
  // session and its agent's whole group, not leave the run hanging on a live child.
  live.add(() => { input.end(); if (child?.pid) groupKill(child.pid, 'SIGKILL') })
  const recorded = () => existsSync(recordFile) ? readFileSync(recordFile, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []
  const until = async (fn, what) => { for (let i = 0; i < 400; i++) { if (fn()) return; await new Promise((r) => setTimeout(r, 10)) } throw new Error('timed out waiting for ' + what + '\n' + shown) }
  return { input, done, recorded, until, shown: () => shown, interrupt: () => interrupt(), terminate: () => terminate(), argv: () => argv, child: () => child }
}

test('an agent that declares HTTP MCP gets Fabric over HTTP with the session bearer, and the brief as the first prompt', async () => {
  const s = session(spec())
  await s.until(() => s.shown().includes('echo:BRIEF'), 'the brief turn')
  const created = s.recorded().find((r) => r.method === 'session/new')
  assert.deepEqual(created.params.mcpServers, [spec().http])
  assert.equal(s.recorded().find((r) => r.method === 'session/prompt').params.prompt[0].text, spec().brief)
  assert.ok(!s.argv().join(' ').includes(TOKEN), 'the credential never reaches an argument')
  s.input.end()
  assert.equal(await s.done, 0)
  assert.ok(s.recorded().some((r) => r.method === 'session/cancel'), 'ending the session cancels it on the agent side')
})

test('an agent without HTTP MCP gets the stdio bridge instead (Cline 3.0.46 declares none)', async () => {
  const s = session(spec(), { http: false })
  await s.until(() => s.shown().includes('stdio bridge'), 'the bridge notice')
  assert.deepEqual(s.recorded().find((r) => r.method === 'session/new').params.mcpServers, [spec().stdio])
  s.input.end(); await s.done
})

test('in ask mode a permission is the person\'s: "n" rejects, "y" allows once, nothing is answered for them', async () => {
  const s = session(spec())
  await s.until(() => s.shown().includes('echo:BRIEF'), 'the brief turn')
  s.input.write('please WRITE the notes\n')
  await s.until(() => s.shown().includes('Allow once? [y/N]'), 'the question')
  assert.equal(s.recorded().filter((r) => r.permissionAnswer).length, 0, 'no answer before the person typed one')
  s.input.write('n\n')
  await s.until(() => s.shown().includes('permission:no-once'), 'the rejection')
  s.input.write('WRITE again\n')
  await s.until(() => s.shown().split('Allow once? [y/N]').length === 3, 'the second question')
  s.input.write('y\n')
  await s.until(() => s.shown().includes('permission:yes-once'), 'the approval')
  s.input.end(); await s.done
})

test('in bypass mode the shell allows once without asking', async () => {
  const s = session(spec({ mode: 'bypass' }))
  await s.until(() => s.shown().includes('echo:BRIEF'), 'the brief turn')
  s.input.write('WRITE\n')
  await s.until(() => s.shown().includes('permission:yes-once'), 'the automatic approval')
  assert.ok(!s.shown().includes('Allow once?'))
  s.input.end(); await s.done
})

test('Ctrl-C during a turn cancels that turn and the session goes on', async () => {
  const s = session(spec())
  await s.until(() => s.shown().includes('echo:BRIEF'), 'the brief turn')
  s.input.write('SLOW work\n')
  await s.until(() => s.shown().includes('working slowly'), 'the slow turn')
  s.interrupt()
  await s.until(() => s.shown().includes('(cancelled)'), 'the cancelled turn')
  s.input.write('still here\n')
  await s.until(() => s.shown().includes('echo:still here'), 'the next turn')
  s.input.end(); await s.done
})

test('an agent that requires sign-in lists its methods; the person picks one and the session opens', async () => {
  const s = session(spec(), { env: { FAKE_ACP_AUTH: '1' } })
  await s.until(() => s.shown().includes('Type a number to sign in'), 'the sign-in choice')
  assert.match(s.shown(), /1\. Sign in to the fixture — a browser sign-in/)
  s.input.write('1\n')
  await s.until(() => s.shown().includes('echo:BRIEF'), 'the brief turn after signing in')
  assert.deepEqual(s.recorded().find((r) => r.method === 'authenticate').params, { methodId: 'fixture-login' })
  s.input.end(); assert.equal(await s.done, 0)
})

test('declining to sign in closes the session with its own exit code, and nothing signs in for the person', async () => {
  const s = session(spec(), { env: { FAKE_ACP_AUTH: '1' } })
  await s.until(() => s.shown().includes('Type a number to sign in'), 'the sign-in choice')
  s.input.write('\n')
  assert.equal(await s.done, 3)
  assert.equal(s.recorded().filter((r) => r.method === 'authenticate').length, 0)
})

test('an agent that ignores end of input and SIGTERM is still ended: the shell does not hang', async () => {
  const s = session(spec(), { env: { FAKE_ACP_STUBBORN: '1' } })
  await s.until(() => s.shown().includes('echo:BRIEF'), 'the brief turn')
  const started = Date.now()
  s.input.end()
  assert.equal(await s.done, 0)
  assert.ok(Date.now() - started < 9000, 'ended within the SIGTERM and SIGKILL grace')
  assert.ok(s.recorded().some((r) => r.signal), 'it was asked politely first')
})

// Audit 2026-10-05 A6-004 / 2026-10-06 DA-2: the project's granted servers reach the agent either way —
// over HTTP when it takes HTTP MCP, else each through its own stdio bridge — and a granted server that
// cannot be carried refuses the session, as the bundle refuses a launch missing one (M127).
const GRANT = { type: 'http', name: 'search', url: 'http://127.0.0.1:4000/mcp/search', headers: [{ name: 'x-agw-key', value: 'role-key' }] }
const BRIDGED = { name: 'search', command: '/usr/bin/false', args: ['bridge'], env: [{ name: 'FABRIC_BRIDGE_URL', value: GRANT.url }, { name: 'FABRIC_BRIDGE_HEADER', value: 'x-agw-key' }, { name: 'FABRIC_BRIDGE_AUTHORIZATION', value: 'role-key' }] }
test('granted servers go with the surface over HTTP, and each through its own stdio bridge otherwise', async () => {
  const http = session(spec({ grants: [GRANT], grantsOverStdio: [BRIDGED] }))
  await http.until(() => http.shown().includes('echo:BRIEF'), 'the brief turn')
  assert.deepEqual(http.recorded().find((r) => r.method === 'session/new').params.mcpServers, [spec().http, GRANT])
  assert.match(http.shown(), /through HTTP with 1 granted server/)
  http.input.end(); await http.done
  const stdio = session(spec({ grants: [GRANT], grantsOverStdio: [BRIDGED] }), { http: false })
  await stdio.until(() => stdio.shown().includes('echo:BRIEF'), 'the brief turn')
  assert.deepEqual(stdio.recorded().find((r) => r.method === 'session/new').params.mcpServers, [spec().stdio, BRIDGED])
  assert.match(stdio.shown(), /through the stdio bridge with 1 granted server/)
  assert.doesNotMatch(stdio.shown(), /not reachable/)
  stdio.input.end(); await stdio.done
})

test('a granted server the stdio bridge cannot carry refuses the session instead of opening it without', async () => {
  const s = session(spec({ grants: [GRANT] }), { http: false })
  assert.equal(await s.done, 3)
  assert.match(s.shown(), /granted server\(s\) \(search\)/)
  assert.match(s.shown(), /not opened/)
  assert.equal(s.recorded().filter((r) => r.method === 'session/new').length, 0, 'no session was opened without its servers')
})

// Audit 2026-10-05 A6-001 / A7-004: a turn has no deadline.
test('a turn longer than the request deadline is not an error, and the next line waits for it', async () => {
  // The deadline still has to let initialize and session/new through on a loaded machine.
  const s = session(spec(), { timeouts: { requestMs: 1500 } })
  await s.until(() => s.shown().includes('echo:BRIEF'), 'the brief turn')
  s.input.write('LONG one\n')
  await s.until(() => s.shown().includes('long turn started'), 'the long turn')
  s.input.write('after the long one\n')
  await s.until(() => s.shown().includes('echo:after the long one'), 'the next turn')
  assert.ok(!s.shown().includes('ended with an error'), s.shown())
  const prompts = s.recorded().filter((r) => r.method === 'session/prompt').map((r) => r.params.prompt[0].text)
  assert.deepEqual(prompts, [spec().brief, 'LONG one', 'after the long one'], 'one prompt at a time, in order')
  assert.ok(s.shown().indexOf('long turn done') < s.shown().indexOf('echo:after the long one'))
  s.input.end(); await s.done
})

// Audit 2026-10-05 A7-007: a line typed ahead never answers a question the person has not seen.
test('a line typed during a turn stays a prompt; the permission question takes only what is typed after it', async () => {
  const s = session(spec())
  await s.until(() => s.shown().includes('echo:BRIEF'), 'the brief turn')
  s.input.write('LATEASK now\n')
  await s.until(() => s.shown().includes('thinking before asking'), 'the turn')
  s.input.write('y\n') // typed ahead, before any question
  await s.until(() => s.shown().includes('Allow once? [y/N]'), 'the question')
  await new Promise((r) => setTimeout(r, 150))
  assert.equal(s.recorded().filter((r) => r.permissionAnswer).length, 0, 'the typed-ahead line did not answer')
  s.input.write('n\n')
  await s.until(() => s.shown().includes('permission:no-once'), 'the person\'s answer')
  await s.until(() => s.shown().includes('echo:y'), 'the typed-ahead line, sent as the next prompt')
  s.input.end(); await s.done
})

// Audit 2026-10-05 A7-003: a stop or a quit ends the agent, not only the shell.
test('SIGTERM to the shell ends the session and the agent, with exit code 143', async () => {
  const s = session(spec())
  await s.until(() => s.shown().includes('echo:BRIEF'), 'the brief turn')
  s.terminate()
  assert.equal(await s.done, 143)
  assert.notEqual(s.child().exitCode ?? s.child().signalCode, null, 'the agent is gone')
  assert.ok(s.recorded().some((r) => r.method === 'session/cancel'))
})

// Audit 2026-10-05 E-01 / A7-005: the cause of a failed start is said.
test('an agent that dies before answering initialize is reported with the cause', async () => {
  const s = session(spec(), { agentArgs: ['-e', 'process.exit(0)'] })
  assert.equal(await s.done, 2)
  assert.match(s.shown(), /`initialize` failed \(the agent closed its output\)/)
})

// Audit 2026-10-06 DA-1 / ER-1 / DO-4: an agent that exits promptly on end of input (the normal ACP
// behaviour) left its own tools running, because the group was signalled only when the LEADER outlived
// the grace. A group outlives its leader: the shell sweeps it on every end.
test('ending a session ends the tools the agent started, even when the agent itself exits on end of input', async () => {
  for (const end of ['terminate', 'eof']) {
    const childFile = path.join(mkdtempSync(path.join(tmpdir(), 'acp-kid-')), 'kid.pid')
    const s = session(spec(), { env: { FAKE_ACP_CHILD: childFile } })
    await s.until(() => s.shown().includes('echo:BRIEF') && existsSync(childFile), 'the brief turn')
    const kid = Number(readFileSync(childFile, 'utf8'))
    assert.ok(pidAlive(kid), 'the tool runs while the session does')
    if (end === 'terminate') { s.terminate(); assert.equal(await s.done, 143) } else { s.input.end(); assert.equal(await s.done, 0) }
    assert.ok(await waitFor(() => !pidAlive(kid), 4000), `after ${end}, the agent's tool ${kid} is still running`)
  }
})

// Audit 2026-10-06 ER-3: an agent that stops reading its input crashed the shell with an unhandled EPIPE.
test('a write to an agent that stopped reading is not a crash: the shell reports the agent\'s end', async () => {
  const s = session(spec({ mode: 'bypass' }))
  await s.until(() => s.shown().includes('echo:BRIEF'), 'the brief turn')
  s.input.write('DIE now\n')
  assert.equal(await s.done, 0)
  assert.match(s.shown(), /The agent exited/)
})

// Audit 2026-10-06 DA-3: ACP's prompt-turn §Cancellation — "The Client MUST respond to all pending
// session/request_permission requests with the cancelled outcome." The question's waiter used to stay
// at the head of the queue, so the next line typed became the answer to a cancelled question.
test('Ctrl-C during a permission question answers it cancelled, and the next line typed is a prompt', async () => {
  const s = session(spec())
  await s.until(() => s.shown().includes('echo:BRIEF'), 'the brief turn')
  s.input.write('please WRITE the notes\n')
  await s.until(() => s.shown().includes('Allow once? [y/N]'), 'the question')
  s.interrupt()
  await s.until(() => s.shown().includes('permission:cancelled'), 'the cancelled answer')
  assert.deepEqual(s.recorded().find((r) => r.permissionAnswer).permissionAnswer, { outcome: { outcome: 'cancelled' } })
  assert.ok(s.recorded().some((r) => r.method === 'session/cancel'), 'the turn is cancelled on the agent side too')
  s.input.write('summarise the repo instead\n')
  await s.until(() => s.shown().includes('echo:summarise the repo'), 'the next prompt')
  const prompts = s.recorded().filter((r) => r.method === 'session/prompt').map((r) => r.params.prompt[0].text)
  assert.deepEqual(prompts, [spec().brief, 'please WRITE the notes', 'summarise the repo instead'])
  s.input.end(); await s.done
})

// Audit 2026-10-06 DO-21(b): the sign-in pick read queued, typed-ahead input; a permission question no
// longer does. A line typed before the methods were listed is a prompt, not a choice.
test('the sign-in pick takes only a line typed after the methods are listed', async () => {
  const s = session(spec(), { env: { FAKE_ACP_AUTH: '1' } })
  s.input.write('1\n') // typed ahead, before any question
  await s.until(() => s.shown().includes('Type a number to sign in'), 'the sign-in choice')
  await new Promise((r) => setTimeout(r, 150))
  assert.equal(s.recorded().filter((r) => r.method === 'authenticate').length, 0, 'the typed-ahead line did not pick a method')
  s.input.write('1\n')
  await s.until(() => s.shown().includes('echo:BRIEF'), 'the brief turn after signing in')
  await s.until(() => s.shown().includes('echo:1'), 'the typed-ahead line, sent as a prompt')
  s.input.end(); assert.equal(await s.done, 0)
})

// The shell as Fabric runs it: its own process, the agent detached in its own group.
const SHELL = path.join(import.meta.dirname, '../src/main/acpShellMain.ts')
const shellProcess = (s, agentEnv = {}) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'acp-main-'))
  const files = { record: path.join(dir, 'record.jsonl'), kid: path.join(dir, 'kid.pid'), agent: path.join(dir, 'agent.pid') }
  const proc = spawn(process.execPath, ['--experimental-strip-types', SHELL, '--', process.execPath, AGENT], {
    env: { ...process.env, FABRIC_ACP_SESSION: JSON.stringify(s), FAKE_ACP_RECORD: files.record, FAKE_ACP_HTTP: '1', FAKE_ACP_CHILD: files.kid, FAKE_ACP_PID: files.agent, ...agentEnv },
    stdio: ['pipe', 'pipe', 'pipe']
  })
  let shown = ''
  proc.stdout.on('data', (c) => { shown += c }); proc.stderr.on('data', (c) => { shown += c })
  const exit = new Promise((resolve) => proc.on('exit', (code, signal) => resolve({ code, signal })))
  const pid = (file) => existsSync(file) ? Number(readFileSync(file, 'utf8')) : null
  live.add(() => { try { proc.kill('SIGKILL') } catch {} for (const p of [pid(files.agent), pid(files.kid)]) if (p) { try { process.kill(p, 'SIGKILL') } catch {} } })
  const until = async (fn, what) => { if (!(await waitFor(fn, 8000))) throw new Error('timed out waiting for ' + what + '\n' + shown) }
  return { proc, exit, shown: () => shown, until, agent: () => pid(files.agent), kid: () => pid(files.kid) }
}

test('the shell process: SIGTERM ends the agent and every tool in its group, with exit code 143', async () => {
  const sh = shellProcess(spec())
  await sh.until(() => sh.shown().includes('echo:BRIEF') && sh.kid() && sh.agent(), 'the brief turn')
  const [agent, kid] = [sh.agent(), sh.kid()]
  sh.proc.kill('SIGTERM')
  assert.deepEqual(await sh.exit, { code: 143, signal: null })
  assert.ok(await waitFor(() => !pidAlive(agent) && !pidAlive(kid), 4000), `agent ${agent} alive=${pidAlive(agent)}, tool ${kid} alive=${pidAlive(kid)}`)
})

// Audit 2026-10-06 ER-2(a): Fabric's Force stop SIGKILLs the PTY's group at ~0.8 s, before the shell can
// run any cleanup, and the agent is in another group. The shell's reaper outlives it and ends the group.
test('the shell process: a SIGKILL of the shell still ends an agent that ignores end of input and SIGTERM, and its tools', async () => {
  const sh = shellProcess(spec(), { FAKE_ACP_STUBBORN: '1' })
  await sh.until(() => sh.shown().includes('echo:BRIEF') && sh.kid() && sh.agent(), 'the brief turn')
  const [agent, kid] = [sh.agent(), sh.kid()]
  sh.proc.kill('SIGKILL')
  await sh.exit
  assert.ok(await waitFor(() => !pidAlive(agent) && !pidAlive(kid), 9000), `agent ${agent} alive=${pidAlive(agent)}, tool ${kid} alive=${pidAlive(kid)}`)
})

// Audit 2026-10-06 ER-2(b): Ctrl-C before the session opened (initialize, the sign-in prompt) ended the
// shell by the default handler, exit 130, and left the agent running.
test('the shell process: Ctrl-C at the sign-in prompt ends the shell with 130 and the agent with it', async () => {
  const sh = shellProcess(spec(), { FAKE_ACP_AUTH: '1', FAKE_ACP_STUBBORN: '1' })
  await sh.until(() => sh.shown().includes('Type a number to sign in') && sh.agent(), 'the sign-in choice')
  const [agent, kid] = [sh.agent(), sh.kid()]
  sh.proc.kill('SIGINT')
  assert.deepEqual(await sh.exit, { code: 130, signal: null })
  assert.ok(await waitFor(() => !pidAlive(agent) && !pidAlive(kid), 9000), `agent ${agent} alive=${pidAlive(agent)}, tool ${kid} alive=${pidAlive(kid)}`)
})

test('the small rules: surface choice, automatic choice, answers and what is printed', () => {
  assert.deepEqual(surfaceFor({ agentCapabilities: { mcpCapabilities: { http: true } } }, spec()), spec().http)
  assert.deepEqual(surfaceFor({ agentCapabilities: { mcpCapabilities: { sse: true } } }, spec()), spec().stdio)
  assert.deepEqual(surfaceFor(null, spec()), spec().stdio)
  const options = [{ optionId: 'a', kind: 'allow_always' }, { optionId: 'o', kind: 'allow_once' }, { optionId: 'r', kind: 'reject_once' }]
  assert.equal(automaticChoice('bypass', options), 'o', 'bypass prefers allow_once over allow_always')
  assert.equal(automaticChoice('ask', options), null, 'ask never answers for the person')
  assert.equal(answeredChoice('y', options), 'o'); assert.equal(answeredChoice('Yes', options), 'o')
  assert.equal(answeredChoice('', options), 'r'); assert.equal(answeredChoice('sure', options), 'r', 'anything but yes rejects')
  assert.equal(describeUpdate({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'hi' } }), 'hi')
  assert.match(describeUpdate({ sessionUpdate: 'tool_call', title: 'Read a.md', status: 'pending' }), /Read a\.md/)
  assert.equal(describeUpdate({ sessionUpdate: 'available_commands_update' }), null)
  assert.equal(isAuthRequired({ code: -32000, message: 'x' }), true)
  assert.equal(isAuthRequired(new Error('Authentication required: Call authenticate before creating a session.')), true)
  assert.equal(isAuthRequired(new Error('session/new did not answer')), false)
  // y with only an always-allow on offer selects it; anything else with only always-reject selects that.
  assert.equal(answeredChoice('y', [{ optionId: 'always', kind: 'allow_always' }, { optionId: 'no', kind: 'reject_once' }]), 'always')
  assert.equal(answeredChoice('nope', [{ optionId: 'always', kind: 'allow_always' }, { optionId: 'never', kind: 'reject_always' }]), 'never')
  assert.equal(answeredChoice('y', [{ optionId: 'once', kind: 'allow_once' }, { optionId: 'always', kind: 'allow_always' }]), 'once')
})
// #endregion acp-shell

// P-10 AS-04/AS-05 (ADR-0119): the ACP terminal shell against a fixture agent, no terminal needed.
// #region acp-shell — docs: docs/adr/0119-acp-is-the-generic-runner-drive-and-runners-are-catalogue-rows.md#1-acp-is-the-generic-drive-mode-for-a-runner
import assert from 'node:assert/strict'
import test from 'node:test'
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
const live = new Set()
test.afterEach(() => { for (const end of live) end(); live.clear() })
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
      child = spawn(process.execPath, agentArgs, { env: { ...process.env, FAKE_ACP_RECORD: recordFile, FAKE_ACP_HTTP: http ? '1' : '0', ...env }, stdio: ['pipe', 'pipe', 'pipe'] })
      argv = child.spawnargs
      return { stdin: child.stdin, stdout: child.stdout, stderr: child.stderr, kill: (sig) => child.kill(sig), onExit: (l) => child.on('exit', l) }
    }
  })
  // Cleanup that runs whether the test passed or failed: a failing assertion must end the
  // session and its agent, not leave the run hanging on a live child.
  live.add(() => { input.end(); try { child?.kill('SIGKILL') } catch {} })
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

// Audit 2026-10-05 A6-004: the project's granted servers reach an agent that takes HTTP MCP; one that
// does not is told which servers it lacks, and is sent only Fabric's own.
test('granted servers go with the surface over HTTP, and are named as missing over the stdio bridge', async () => {
  const grant = { type: 'http', name: 'search', url: 'http://127.0.0.1:4000/mcp/search', headers: [{ name: 'x-agw-key', value: 'role-key' }] }
  const http = session(spec({ grants: [grant] }))
  await http.until(() => http.shown().includes('echo:BRIEF'), 'the brief turn')
  assert.deepEqual(http.recorded().find((r) => r.method === 'session/new').params.mcpServers, [spec().http, grant])
  assert.match(http.shown(), /with 1 granted server/)
  http.input.end(); await http.done
  const stdio = session(spec({ grants: [grant] }), { http: false })
  await stdio.until(() => stdio.shown().includes('echo:BRIEF'), 'the brief turn')
  assert.deepEqual(stdio.recorded().find((r) => r.method === 'session/new').params.mcpServers, [spec().stdio])
  assert.match(stdio.shown(), /granted server\(s\) \(search\) are not reachable/)
  stdio.input.end(); await stdio.done
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

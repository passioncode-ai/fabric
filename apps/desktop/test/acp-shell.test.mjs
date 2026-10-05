// P-10 AS-04/AS-05 (ADR-0119): the ACP terminal shell against a fixture agent, no terminal needed.
// #region acp-shell — docs: docs/adr/0119-acp-is-the-generic-runner-drive-and-runners-are-catalogue-rows.md#1-acp-is-the-generic-drive-mode-for-a-runner
import assert from 'node:assert/strict'
import test from 'node:test'
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { PassThrough } from 'node:stream'
import { runAcpShell, surfaceFor, automaticChoice, answeredChoice, describeUpdate } from '../src/main/acpShell.ts'

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
const session = (s, { http = true } = {}) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'acp-shell-'))
  const recordFile = path.join(dir, 'record.jsonl')
  const input = new PassThrough(), output = new PassThrough()
  let shown = ''
  output.on('data', (c) => { shown += c })
  let interrupt = () => {}
  let argv = null
  let child = null
  const done = runAcpShell(s, {
    input, output,
    onInterrupt: (l) => { interrupt = l },
    spawnAgent() {
      child = spawn(process.execPath, [AGENT], { env: { ...process.env, FAKE_ACP_RECORD: recordFile, FAKE_ACP_HTTP: http ? '1' : '0' }, stdio: ['pipe', 'pipe', 'pipe'] })
      argv = child.spawnargs
      return { stdin: child.stdin, stdout: child.stdout, stderr: child.stderr, kill: (sig) => child.kill(sig), onExit: (l) => child.on('exit', l) }
    }
  })
  // Cleanup that runs whether the test passed or failed: a failing assertion must end the
  // session and its agent, not leave the run hanging on a live child.
  live.add(() => { input.end(); try { child?.kill('SIGKILL') } catch {} })
  const recorded = () => existsSync(recordFile) ? readFileSync(recordFile, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []
  const until = async (fn, what) => { for (let i = 0; i < 400; i++) { if (fn()) return; await new Promise((r) => setTimeout(r, 10)) } throw new Error('timed out waiting for ' + what + '\n' + shown) }
  return { input, done, recorded, until, shown: () => shown, interrupt: () => interrupt(), argv: () => argv }
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
})
// #endregion acp-shell

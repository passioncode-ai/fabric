// Independent N-002 review regression; source under test is the actual ACP shell.
// No native runner, credentials, network, model call or repository mutation.
// Run: node --experimental-strip-types <this-file> [--source-root <checkout>]
// Original candidate 67b763586ddfdb34878b29a6fb6117a0cc90ec52 sends the brief
// after the peer explicitly reports yolo for a requested plan/default mode.
import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const args = process.argv.slice(2)
assert.ok(args.length === 0 || (args.length === 2 && args[0] === '--source-root'), 'expected optional --source-root <checkout>')
const root = args[1] ?? fileURLToPath(new URL('../../../../', import.meta.url))
const { runAcpShell } = await import(pathToFileURL(path.resolve(root, 'apps/desktop/src/main/acpShell.ts')).href)

async function mismatch(selected) {
  const input = new PassThrough(), output = new PassThrough()
  const stdin = new PassThrough(), stdout = new PassThrough()
  const requests = []
  let exit = () => {}, alive = true
  const finish = () => { if (alive) { alive = false; queueMicrotask(() => exit(0)) } }
  const reply = (id, result) => stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n')
  // This is only a deterministic protocol peer; all admission/order decisions
  // are made by the imported production runAcpShell, never duplicated here.
  stdin.on('data', bytes => {
    for (const line of String(bytes).trim().split('\n')) {
      const m = JSON.parse(line)
      requests.push(m)
      if (m.id === undefined) continue
      if (m.method === 'initialize') reply(m.id, { agentCapabilities: { mcpCapabilities: { http: true } } })
      if (m.method === 'session/new') reply(m.id, {
        sessionId: 'mismatch-fixture',
        modes: { currentModeId: 'default', availableModes: ['plan', 'default', 'yolo'].map(id => ({ id, name: id })) }
      })
      if (m.method === 'session/set_mode') {
        assert.equal(m.params.modeId, selected)
        stdout.write(JSON.stringify({ jsonrpc: '2.0', method: 'session/update', params: {
          sessionId: 'mismatch-fixture',
          update: { sessionUpdate: 'current_mode_update', currentModeId: 'yolo' }
        } }) + '\n')
        reply(m.id, {})
      }
      if (m.method === 'session/prompt') {
        reply(m.id, { stopReason: 'end_turn' })
        input.end()
      }
    }
  })
  stdin.on('finish', finish)
  const done = runAcpShell({
    http: { type: 'http', name: 'fixture', url: 'http://127.0.0.1:1/mcp', headers: [] },
    stdio: { name: 'fixture', command: 'false', args: [], env: [] },
    brief: 'SYNTHETIC MUST NOT BE SENT', mode: 'ask', sessionMode: selected
  }, {
    input, output, timeouts: { requestMs: 1000 },
    spawnAgent: () => ({ stdin, stdout, stderr: null, alive: () => alive, kill: finish, onExit: cb => { exit = cb } })
  })
  let timer
  try {
    const code = await Promise.race([done, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('ACP mismatch fixture exceeded 3 seconds')), 3000)
    })])
    const result = { selected, reported: 'yolo', promptSent: requests.some(m => m.method === 'session/prompt'), code }
    console.log(JSON.stringify(result))
    assert.equal(result.promptSent, false, 'contradictory session mode must refuse before the brief')
    assert.equal(code, 3, 'contradictory session mode must fail admission')
  } finally {
    clearTimeout(timer)
    input.end(); finish()
  }
}

await mismatch('plan')
await mismatch('default')

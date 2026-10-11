// ACP probe for `kimi acp` (Kimi Code 2.1.1) against the fixture MCP surface.
// Mimics Fabric's acp-shell minimally: initialize -> session/new with the fixture as an
// HTTP MCP server -> session/prompt asking the agent to call probe_ping.
// Permission requests are answered allow_once automatically (probe only; Fabric's shell
// asks the person). Transcript (both directions) is appended to TRANSCRIPT as JSONL.
import { spawn } from 'node:child_process'
import fs from 'node:fs'

const TRANSCRIPT = process.env.TRANSCRIPT || '/tmp/fabric-probes/kimi-acp-transcript.jsonl'
const FIXTURE_URL = process.env.FIXTURE_URL || 'http://127.0.0.1:47331/mcp'
const TOKEN = process.env.EXPECTED_TOKEN || 'probe-token-123'
const CWD = process.env.PROBE_CWD || '/tmp/fabric-probes/kimi-work'
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 180_000)

const log = (dir, msg) => fs.appendFileSync(TRANSCRIPT, JSON.stringify({ ts: new Date().toISOString(), dir, msg }) + '\n')

const proc = spawn('kimi', ['acp'], { cwd: CWD, stdio: ['pipe', 'pipe', 'inherit'], env: { ...process.env } })
let buffer = ''
const pending = new Map()
let serial = 0

const send = (message) => {
  log('client->agent', message)
  proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n')
}
const request = (method, params) =>
  new Promise((resolve, reject) => {
    const id = ++serial
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`${method} did not answer in ${TIMEOUT_MS}ms`))
    }, TIMEOUT_MS)
    pending.set(id, { resolve, reject, timer })
    send({ id, method, params })
  })

proc.stdout.setEncoding('utf8')
proc.stdout.on('data', (chunk) => {
  buffer += chunk
  let nl
  while ((nl = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, nl).trim()
    buffer = buffer.slice(nl + 1)
    if (!line) continue
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      log('agent-nonjson', line)
      continue
    }
    log('agent->client', msg)
    if (typeof msg.method === 'string' && msg.id !== undefined) {
      // A request FROM the agent: permission or fs/terminal. Answer permission with allow_once.
      if (msg.method === 'session/request_permission') {
        const options = Array.isArray(msg.params?.options) ? msg.params.options : []
        const allow = options.find((o) => o.kind === 'allow_once') ?? options.find((o) => o.kind === 'allow_always')
        send({ id: msg.id, result: allow ? { outcome: { outcome: 'selected', optionId: allow.optionId } } : { outcome: { outcome: 'cancelled' } } })
      } else {
        send({ id: msg.id, error: { code: -32601, message: `${msg.method} not offered by probe client` } })
      }
    } else if (typeof msg.id === 'number' && pending.has(msg.id)) {
      const p = pending.get(msg.id)
      pending.delete(msg.id)
      clearTimeout(p.timer)
      if (msg.error !== undefined) p.reject(new Error(`${msg.error.message} (code ${msg.error.code})`))
      else p.resolve(msg.result)
    }
  }
})

const done = (code, note) => {
  log('probe', { note, code })
  try {
    proc.kill('SIGTERM')
  } catch {}
  setTimeout(() => process.exit(code), 500)
}

const main = async () => {
  const init = await request('initialize', {
    protocolVersion: 1,
    clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
    clientInfo: { name: 'fabric-probe', title: 'Fabric probe', version: '0' }
  })
  const mcpCaps = init?.agentCapabilities?.mcpCapabilities ?? null
  log('probe', { step: 'initialize ok', mcpCapabilities: mcpCaps, authMethods: init?.authMethods ?? [] })

  const created = await request('session/new', {
    cwd: CWD,
    mcpServers: [{ type: 'http', name: 'probe', url: FIXTURE_URL, headers: [{ name: 'Authorization', value: `Bearer ${TOKEN}` }] }]
  })
  const sessionId = created?.sessionId
  log('probe', { step: 'session/new ok', sessionId })

  const result = await request('session/prompt', {
    sessionId,
    prompt: [{ type: 'text', text: "Use the probe_ping tool from the probe MCP server with the message 'hello-kimi' and report exactly what it answered." }]
  })
  log('probe', { step: 'prompt done', stopReason: result?.stopReason ?? null })
  done(0, 'probe completed')
}

main().catch((e) => {
  log('probe', { step: 'FAILED', error: e.message })
  console.error('PROBE FAILED:', e.message)
  done(1, e.message)
})

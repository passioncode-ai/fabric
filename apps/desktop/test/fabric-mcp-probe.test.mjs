// REQ-03 (0.4.0): «connected» in a terminal is a probe result. Against real files and real processes:
//   * each runner's config, written in the shape that runner's own CLI wrote on 2026-10-11, is read for its fabric
//     entry, and the entry must name THIS Fabric's launcher (symlinks resolved), `--runner <id>`, enabled;
//   * only then the registered command is started — here the REAL fabric-mcp entry (src/main/fabricMcpMain.ts, run by
//     Node through a launcher script) — and it must answer MCP initialize as `fabric` and list `fabric_whoami`;
//   * a throwaway home: the started fabric-mcp finds no hub.json and asks the operator for nothing;
//   * a command that answers as another server, or not at all, is not connected; a file Fabric cannot read is a code.
import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { answerCheck, launcherIn, probeTerminal, rememberedAnswers } from '../src/main/fabricMcpProbe.ts'

const HERE = import.meta.dirname
const MAIN = path.join(HERE, '../src/main/fabricMcpMain.ts')
let failed = 0
const test = async (name, fn) => {
  try { await fn(); console.log('PASS ' + name) } catch (e) { failed++; console.log('FAIL ' + name + ': ' + (e?.stack ?? e)) }
}

const root = mkdtempSync(path.join(tmpdir(), 'fabric-probe-'))
try {
  // An installed Fabric: <resources>/bin/fabric-mcp, a script that runs the real entry with Node.
  const resources = path.join(root, 'Fabric.app', 'Contents', 'Resources')
  mkdirSync(path.join(resources, 'bin'), { recursive: true })
  const launcher = path.join(resources, 'bin', 'fabric-mcp')
  writeFileSync(launcher, `#!/bin/sh\nexec "${process.execPath}" "${MAIN}" "$@"\n`)
  chmodSync(launcher, 0o755)
  // A path to the same launcher through a symlink (an /Applications alias), and another program entirely.
  const alias = path.join(root, 'alias')
  symlinkSync(path.join(root, 'Fabric.app'), alias)
  const aliased = path.join(alias, 'Contents', 'Resources', 'bin', 'fabric-mcp')
  const imposter = path.join(root, 'imposter')
  writeFileSync(imposter, `#!/bin/sh\nexec "${process.execPath}" -e 'process.stdin.on("data",d=>{for(const l of String(d).split("\\n")){if(!l.trim())continue;const m=JSON.parse(l);if(m.id===1)console.log(JSON.stringify({jsonrpc:"2.0",id:1,result:{protocolVersion:"2025-06-18",capabilities:{tools:{}},serverInfo:{name:"other",version:"1"}}}));if(m.id===2)console.log(JSON.stringify({jsonrpc:"2.0",id:2,result:{tools:[{name:"fabric_whoami"}]}}))}})'\n`)
  chmodSync(imposter, 0o755)
  const silent = path.join(root, 'silent')
  writeFileSync(silent, '#!/bin/sh\nexec sleep 30\n')
  chmodSync(silent, 0o755)

  const home = path.join(root, 'home')
  mkdirSync(home)
  const env = { PATH: process.env.PATH }
  const answer = rememberedAnswers(answerCheck({ env, timeoutMs: 15_000, tmpRoot: root }))
  const probe = (runner, over = {}) => probeTerminal(runner, { env, home, launcher, answer, ...over })
  const write = (rel, text) => { const f = path.join(home, rel); mkdirSync(path.dirname(f), { recursive: true }); writeFileSync(f, text) }

  await test('the launcher is found where an install keeps it, and not in a development run', async () => {
    assert.equal(await launcherIn(resources, 'darwin'), launcher)
    assert.equal(await launcherIn(null, 'darwin'), null)
    assert.equal(await launcherIn(path.join(root, 'nowhere'), 'darwin'), null)
  })

  await test('nothing registered: not-registered, with the measured command to register it', async () => {
    const p = await probe('codex')
    assert.equal(p.state, 'not-registered')
    assert.deepEqual(p.register, { kind: 'command', line: `codex mcp add fabric -- ${launcher} --runner codex` })
  })

  await test('Codex registered as its CLI writes it: the real fabric-mcp answers, so connected', async () => {
    write('.codex/config.toml', `model = "o3"\n["mcp_servers"."other"."http_headers"]\nAuthorization = "Bearer SECRET"\n[mcp_servers.fabric]\ncommand = "${launcher}"\nargs = ["--runner", "codex"]\n`)
    const p = await probe('codex')
    assert.equal(p.state, 'connected', JSON.stringify(p))
    assert.equal(p.config, '~/.codex/config.toml')
    assert.ok(!JSON.stringify(p).includes('SECRET'), 'the probe repeats nothing of the file')
  })

  await test('Claude Code through a symlinked path to the same launcher: connected; CLAUDE_CONFIG_DIR is honoured', async () => {
    const dir = path.join(root, 'claude-dir')
    mkdirSync(dir)
    writeFileSync(path.join(dir, '.claude.json'), JSON.stringify({ mcpServers: { fabric: { type: 'stdio', command: aliased, args: ['--runner', 'claude-code'] } } }))
    assert.equal((await probe('claude-code')).state, 'not-registered', 'the home file has no entry')
    const p = await probe('claude-code', { env: { ...env, CLAUDE_CONFIG_DIR: dir } })
    assert.equal(p.state, 'connected', JSON.stringify(p))
  })

  await test('Hermes saved disabled after its own connect failed: disabled, never connected', async () => {
    write('.hermes/config.yaml', `mcp_servers:\n  fabric:\n    command: ${launcher}\n    args:\n      - --runner\n      - hermes\n    connect_timeout: 5.0\n    enabled: false\n`)
    assert.equal((await probe('hermes')).state, 'disabled')
  })

  await test('Kilo with another runner id: wrong-runner', async () => {
    write('.config/kilo/kilo.jsonc', `{\n  // mine\n  "mcp": { "fabric": { "type": "local", "command": ["${launcher}", "--runner", "codex"] } }\n}`)
    assert.equal((await probe('kilo')).state, 'wrong-runner')
  })

  await test('Kimi Code pointing at another program that answers as another server: elsewhere, then not-answering', async () => {
    write('.kimi-code/mcp.json', JSON.stringify({ mcpServers: { fabric: { command: imposter, args: ['--runner', 'kimi-code'] } } }))
    assert.equal((await probe('kimi-code')).state, 'elsewhere')
    // The imposter installed AS the launcher: it is asked, and answering as "other" is not Fabric.
    const p = await probe('kimi-code', { launcher: imposter })
    assert.equal(p.state, 'not-answering')
    assert.match(p.detail, /another MCP server/)
  })

  await test('a launcher that never answers is not-answering within the bound', async () => {
    write('.kimi-code/mcp.json', JSON.stringify({ mcpServers: { fabric: { command: silent, args: ['--runner', 'kimi-code'] } } }))
    const slow = answerCheck({ env, timeoutMs: 1500, tmpRoot: root })
    const started = Date.now()
    const p = await probeTerminal('kimi-code', { env, home, launcher: silent, answer: slow })
    assert.equal(p.state, 'not-answering')
    assert.ok(Date.now() - started < 6000, 'bounded')
  })

  await test('an unreadable config is a code, and a readable later file still decides', async () => {
    write('.codex/config.toml', '[mcp_servers.fabric]\ncommand = "unterminated SECRET\n')
    const p = await probe('codex')
    assert.equal(p.state, 'unreadable')
    assert.equal(p.detail, 'not-toml')
    assert.ok(!JSON.stringify(p).includes('SECRET'))
    write('.config/kilo/kilo.json', '{ not json SECRET')
    write('.config/kilo/kilo.jsonc', JSON.stringify({ mcp: { fabric: { type: 'local', command: [launcher, '--runner', 'kilo'] } } }))
    assert.equal((await probe('kilo')).state, 'connected')
  })

  await test('Cline: unsupported, with its reason; a development run: no-launcher', async () => {
    const c = await probe('cline')
    assert.equal(c.state, 'unsupported')
    assert.match(c.detail, /not been measured/)
    rmSync(path.join(home, '.codex'), { recursive: true, force: true })
    assert.equal((await probe('codex', { launcher: null })).state, 'no-launcher')
  })

  await test('every throwaway home the answer check made is removed again', async () => {
    // Each started fabric-mcp saw only PATH and a throwaway home, so it found no hub.json and asked for nothing.
    const { readdirSync } = await import('node:fs')
    assert.deepEqual(readdirSync(root).filter((n) => n.startsWith('fabric-mcp-probe-')), [])
  })
} finally {
  rmSync(root, { recursive: true, force: true })
}
if (failed) { console.log(`${failed} failed`); process.exit(1) }
console.log('fabric-mcp probe: all passed')

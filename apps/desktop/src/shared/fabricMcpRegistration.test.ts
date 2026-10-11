// REQ-03 (0.4.0): every catalogued coding agent with a program has a measured way to register fabric-mcp and a
// reader for where it keeps it — or an explicit reason it has none — and the readers find exactly the fabric entry
// in the files the runners themselves wrote (fixtures: the measured outputs of 2026-10-11, shared/fabricMcpRegistration.ts).
import { describe, expect, it } from 'vitest'
import { AGENTS } from './agents.ts'
import { REGISTRATIONS, judgeEntry, namesRunner, readFabricEntry, registerLine, registrationOf, shellLine, stripJsonc } from './fabricMcpRegistration.ts'

const BIN = '/Applications/Fabric.app/Contents/Resources/bin/fabric-mcp'

describe('the catalogue', () => {
  it('has a row for every runner with a program, and for nothing else', () => {
    const runners = AGENTS.filter((a) => a.program).map((a) => a.id).sort()
    expect(Object.keys(REGISTRATIONS).sort()).toEqual(runners)
  })
  it('gives every supported row a dialect, a location, a way to register and its measurement; every other row a reason', () => {
    for (const [runner, reg] of Object.entries(REGISTRATIONS)) {
      if (reg.supported) {
        expect(reg.locations.length, runner).toBeGreaterThan(0)
        for (const l of reg.locations) expect(l.files.length, runner).toBeGreaterThan(0)
        expect(reg.measured, runner).toMatch(/\d+\.\d+.*2026-\d\d-\d\d/)
        const line = registerLine(reg, BIN)
        expect(line, runner).not.toBeNull()
        // Whatever the form, it registers THIS launcher under the name fabric, for this runner.
        const said = line!.kind === 'command' ? line!.line : line!.fragment
        expect(said, runner).toContain(BIN)
        expect(said, runner).toContain(runner)
        expect(said, runner).toContain('fabric')
      } else expect(reg.reason.length, runner).toBeGreaterThan(20)
    }
  })
  it('refuses a runner it does not know rather than guessing', () => {
    expect(registrationOf('not-a-runner')).toEqual({ supported: false, reason: expect.stringContaining('no fabric-mcp registration row') })
    // An inherited name is not a row (own properties only).
    expect(registrationOf('constructor').supported).toBe(false)
  })
  it('writes the registration commands exactly as they were measured', () => {
    expect(registerLine(REGISTRATIONS['claude-code'], BIN)).toEqual({ kind: 'command', line: `claude mcp add --scope user fabric -- ${BIN} --runner claude-code` })
    expect(registerLine(REGISTRATIONS.codex, BIN)).toEqual({ kind: 'command', line: `codex mcp add fabric -- ${BIN} --runner codex` })
    expect(registerLine(REGISTRATIONS.kilo, BIN)).toEqual({ kind: 'command', line: `kilo mcp add fabric -- ${BIN} --runner kilo` })
    expect(registerLine(REGISTRATIONS.hermes, BIN)).toEqual({ kind: 'command', line: `hermes mcp add fabric --command ${BIN} --args --runner hermes` })
    expect(registerLine(REGISTRATIONS.cline, BIN)).toBeNull()
    expect(registerLine(REGISTRATIONS.codex, null)).toBeNull()
  })
  it('quotes a launcher path a shell would split', () => {
    expect(shellLine(['codex', '--', '/Users/a b/Fabric.app/bin/fabric-mcp'])).toBe("codex -- '/Users/a b/Fabric.app/bin/fabric-mcp'")
    expect(shellLine(["it's"])).toBe(`'it'\\''s'`)
  })
})

describe('the readers, on what each runner wrote', () => {
  it('Claude Code: mcpServers.fabric in .claude.json', () => {
    const text = JSON.stringify({ numStartups: 3, mcpServers: { other: { type: 'http', url: 'https://x', headers: { Authorization: 'Bearer SECRET' } }, fabric: { type: 'stdio', command: BIN, args: ['--runner', 'claude-code'], env: {} } } })
    expect(readFabricEntry('claude-json', text)).toEqual({ ok: true, entry: { found: true, command: BIN, args: ['--runner', 'claude-code'], enabled: true } })
    expect(readFabricEntry('claude-json', JSON.stringify({ mcpServers: { other: {} } }))).toEqual({ ok: true, entry: { found: false } })
  })
  it('Codex: [mcp_servers.fabric], bare or quoted, one-line or multi-line args, enabled = false', () => {
    const measured = `[mcp_servers.fabric]\ncommand = "${BIN}"\nargs = ["--runner", "codex"]\n`
    expect(readFabricEntry('codex-toml', measured)).toEqual({ ok: true, entry: { found: true, command: BIN, args: ['--runner', 'codex'], enabled: true } })
    const quoted = [
      'model = "o3"',
      '["mcp_servers"."asset-foundry"]', 'url = "http://127.0.0.1:1/mcp"',
      '["mcp_servers"."asset-foundry"."http_headers"]', 'Authorization = "Bearer SECRET"',
      '["mcp_servers"."fabric"]', `"command" = '${BIN}'`, 'args = [', '  "--runner", # who', '  "codex",', ']', 'enabled = false',
      '["mcp_servers"."fabric"."env"]', 'A = "b"'
    ].join('\n')
    expect(readFabricEntry('codex-toml', quoted)).toEqual({ ok: true, entry: { found: true, command: BIN, args: ['--runner', 'codex'], enabled: false } })
    // A sub-table of fabric is not fabric, and another server's command is not read as fabric's.
    expect(readFabricEntry('codex-toml', '[mcp_servers.fabric.env]\ncommand = "x"\n[mcp_servers.other]\ncommand = "y"')).toEqual({ ok: true, entry: { found: false } })
    expect(readFabricEntry('codex-toml', '[mcp_servers.fabric]\ncommand = "unterminated\n')).toEqual({ ok: false, problem: 'not-toml' })
  })
  it('Kilo: mcp.fabric with one command array, in kilo.json or a commented kilo.jsonc', () => {
    const measured = JSON.stringify({ mcp: { fabric: { type: 'local', command: [BIN, '--runner', 'kilo'] } } }, null, 2)
    expect(readFabricEntry('kilo-json', measured)).toEqual({ ok: true, entry: { found: true, command: BIN, args: ['--runner', 'kilo'], enabled: true } })
    const jsonc = `{\n  // the operator's\n  "$schema": "https://kilo.ai/config.json", /* block */\n  "note": "a,] stays // as is",\n  "mcp": { "fabric": { "type": "local", "command": ["${BIN}", "--runner", "kilo"], "enabled": false, }, },\n}`
    expect(readFabricEntry('kilo-json', jsonc)).toEqual({ ok: true, entry: { found: true, command: BIN, args: ['--runner', 'kilo'], enabled: false } })
    expect(JSON.parse(stripJsonc(jsonc)).note).toBe('a,] stays // as is')
  })
  it('Hermes: the mcp_servers → fabric block, its block list, its enabled: false', () => {
    const measured = ['model: x', 'mcp_servers:', '  other:', '    url: https://x', '    headers:', '      Authorization: Bearer SECRET',
      '  fabric:', `    command: ${BIN}`, '    args:', '      - --runner', '      - hermes', '    connect_timeout: 5.0', '    enabled: false', 'gateway:', '  key: SECRET'].join('\n')
    expect(readFabricEntry('hermes-yaml', measured)).toEqual({ ok: true, entry: { found: true, command: BIN, args: ['--runner', 'hermes'], enabled: false } })
    const flow = ['mcp_servers:', '  "fabric":', `    command: "${BIN}"`, "    args: ['--runner', hermes]"].join('\n')
    expect(readFabricEntry('hermes-yaml', flow)).toEqual({ ok: true, entry: { found: true, command: BIN, args: ['--runner', 'hermes'], enabled: true } })
    expect(readFabricEntry('hermes-yaml', 'mcp_servers:\n  other:\n    command: x\nfabric:\n  command: y')).toEqual({ ok: true, entry: { found: false } })
  })
  it('Kimi Code: mcpServers.fabric in mcp.json', () => {
    const text = REGISTRATIONS['kimi-code'].supported && REGISTRATIONS['kimi-code'].how.kind === 'file-entry' ? REGISTRATIONS['kimi-code'].how.fragment(BIN) : ''
    expect(readFabricEntry('kimi-json', text)).toEqual({ ok: true, entry: { found: true, command: BIN, args: ['--runner', 'kimi-code'], enabled: true } })
  })
  it('says an unreadable file as a code, never with the text around the error', () => {
    const r = readFabricEntry('claude-json', '{"mcpServers": {"x": {"headers": {"Authorization": "Bearer sk-SECRET-1234"}}, oops}')
    expect(r).toEqual({ ok: false, problem: 'not-json' })
    expect(JSON.stringify(r)).not.toContain('SECRET')
    expect(readFabricEntry('kimi-json', '[1,2]')).toEqual({ ok: false, problem: 'not-an-object' })
  })
})

describe('the verdict', () => {
  const entry = (over = {}) => ({ found: true as const, command: BIN, args: ['--runner', 'codex'], enabled: true, ...over })
  it('asks the answer check only for this launcher, this runner, enabled', () => {
    expect(judgeEntry({ entry: entry(), runner: 'codex', pointsAtLauncher: true })).toEqual({ state: 'ready-to-answer' })
  })
  it('never calls a missing, foreign, mislabelled or switched-off entry connected', () => {
    expect(judgeEntry({ entry: { found: false }, runner: 'codex', pointsAtLauncher: true }).state).toBe('not-registered')
    expect(judgeEntry({ entry: entry(), runner: 'codex', pointsAtLauncher: false }).state).toBe('elsewhere')
    expect(judgeEntry({ entry: entry({ command: null }), runner: 'codex', pointsAtLauncher: false }).state).toBe('elsewhere')
    expect(judgeEntry({ entry: entry({ args: ['--runner', 'claude-code'] }), runner: 'codex', pointsAtLauncher: true }).state).toBe('wrong-runner')
    expect(judgeEntry({ entry: entry({ enabled: false }), runner: 'codex', pointsAtLauncher: true }).state).toBe('disabled')
    expect(judgeEntry({ entry: entry(), runner: 'codex', pointsAtLauncher: null }).state).toBe('no-launcher')
  })
  it('reads --runner in both spellings', () => {
    expect(namesRunner(['--runner=kilo'], 'kilo')).toBe(true)
    expect(namesRunner(['--runner', 'kilo-x'], 'kilo')).toBe(false)
    expect(namesRunner(['kilo'], 'kilo')).toBe(false)
  })
})

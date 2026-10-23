import { describe, expect, it } from 'vitest'
import { parseSwitchboardAgents, readSwitchboardCatalog } from './agentCatalog'

const doc = JSON.stringify({
  schema: 1, revision: 7, default: 'claude-code',
  agents: [
    { id: 'claude-code', name: 'Claude Code', installed: true, path: '/usr/local/bin/claude', enabled: true, default: true, install: 'npm i -g @anthropic-ai/claude-code', url: 'https://docs.anthropic.com' },
    { id: 'goose', name: 'Goose', installed: false, path: null, disabled: true, install: { command: 'brew install goose' } },
    { name: 'no id' },
    'junk'
  ],
  recommended_models: {}
})

describe('parseSwitchboardAgents', () => {
  it('reads schema 1, defaults and both install shapes; drops rows without an id', () => {
    const p = parseSwitchboardAgents(doc)!
    expect(p.defaultId).toBe('claude-code')
    expect(p.revision).toBe('7')
    expect(p.agents.map((a) => a.id)).toEqual(['claude-code', 'goose'])
    expect(p.agents[0]).toMatchObject({ name: 'Claude Code', installed: true, enabled: true, isDefault: true })
    expect(p.agents[1]).toMatchObject({ installed: false, enabled: false, isDefault: false, install: 'brew install goose' })
  })
  it('an unknown schema or a non-JSON answer is null, not an empty catalogue', () => {
    expect(parseSwitchboardAgents('{"schema":2,"agents":[]}')).toBeNull()
    expect(parseSwitchboardAgents('nope')).toBeNull()
  })
})

describe('the envelope Switchboard actually prints (0.6.31)', () => {
  it('reads { ok, data } — the catalogue inside the envelope', () => {
    const wrapped = JSON.stringify({ ok: true, data: JSON.parse(doc) })
    expect(parseSwitchboardAgents(wrapped)?.agents.map((a) => a.id)).toEqual(['claude-code', 'goose'])
  })
  it('a newer schema is named, never shown as raw JSON', async () => {
    const r = await readSwitchboardCatalog({ find: async () => '/bin/sb', run: async () => ({ code: 0, stdout: JSON.stringify({ ok: true, data: { schema: 2, agents: [] } }), stderr: '' }) })
    expect(r).toEqual({ source: 'absent', reason: 'unknown-schema', detail: 'schema 2' })
  })
})

describe('readSwitchboardCatalog', () => {
  const run = (code: number, stdout: string, stderr = '') => async () => ({ code, stdout, stderr })
  it('not on PATH: absent, not-installed', async () => {
    expect(await readSwitchboardCatalog({ find: async () => null, run: run(0, doc) })).toEqual({ source: 'absent', reason: 'not-installed', detail: null })
  })
  it('a Switchboard older than 0.6.31 is named too old (its own "Invalid arguments")', async () => {
    const r = await readSwitchboardCatalog({ find: async () => '/bin/sb', run: run(2, '{"error":"Invalid arguments. Run switchboard --help.","ok":false}') })
    expect(r).toEqual({ source: 'absent', reason: 'too-old', detail: null })
  })
  it('a run that throws or answers garbage is failed with its reason', async () => {
    const thrown = await readSwitchboardCatalog({ find: async () => '/bin/sb', run: async () => { throw new Error('timed out') } })
    expect(thrown).toEqual({ source: 'absent', reason: 'failed', detail: 'timed out' })
    const garbage = await readSwitchboardCatalog({ find: async () => '/bin/sb', run: run(0, 'not json') })
    expect(garbage).toMatchObject({ source: 'absent', reason: 'failed' })
  })
  it('a good answer is the catalogue, with the command it was asked', async () => {
    let args: readonly string[] = []
    const r = await readSwitchboardCatalog({ find: async () => '/bin/sb', run: async (_f, a) => { args = a; return { code: 0, stdout: doc, stderr: '' } } })
    expect(args).toEqual(['--json', 'agents', 'status'])
    expect(r.source).toBe('switchboard')
  })
})

describe('readSwitchboardCatalog names a refusal and a missed deadline (CO-313)', () => {
  it('{ ok: false } is Switchboard refusing, in its own words, on exit 0 or not', async () => {
    for (const code of [0, 1]) {
      const r = await readSwitchboardCatalog({ find: async () => '/bin/sb', run: async () => ({ code, stdout: JSON.stringify({ ok: false, error: { code: 'locked', message: 'state is locked by another run' } }), stderr: '' }) })
      expect(r).toEqual({ source: 'absent', reason: 'refused', detail: 'state is locked by another run' })
    }
    const s = await readSwitchboardCatalog({ find: async () => '/bin/sb', run: async () => ({ code: 1, stdout: JSON.stringify({ ok: false, error: 'busy' }), stderr: '' }) })
    expect(s).toEqual({ source: 'absent', reason: 'refused', detail: 'busy' })
  })
  it('a run the deadline killed is a timeout, any other run failure stays failed', async () => {
    const killed = Object.assign(new Error('Command failed'), { killed: true, signal: 'SIGTERM' })
    expect(await readSwitchboardCatalog({ find: async () => '/bin/sb', run: async () => { throw killed } })).toEqual({ source: 'absent', reason: 'timeout', detail: null })
    expect(await readSwitchboardCatalog({ find: async () => '/bin/sb', run: async () => { throw new Error('spawn EACCES') } })).toEqual({ source: 'absent', reason: 'failed', detail: 'spawn EACCES' })
  })
})

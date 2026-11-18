// ADR-0197: the CEO is one console Fabric keeps, walked over its own runner order with a mandatory fallback; its
// session control is one set of operations behind the MCP tools and the voice call; the voice call never sees the key.
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { ceoBrief, ceoLaunchExtras, ceoLine, ceoModelAllowed, ceoModelsOf, ceoRunnersOf, claudeModelFlag, findProject, inboxName, keyBytes, screenText, typedText, CEO_MODELS_DEFAULT, CEO_RUNNERS_DEFAULT } from '../src/shared/ceoAgent.ts'
import { createCeoAgent, LIMIT_SAID } from '../src/main/ceoAgent.ts'
import { createCeoOperations, ceoVoiceTools, parseMachineRows, transcriptTurns, CEO_TOOLS } from '../src/main/ceoTools.ts'
import { mintVoiceToken, XAI_KEY_SLOT } from '../src/main/ceoVoice.ts'
import { validateSettings } from '../src/shared/appSettings.ts'

const EM_DASH = String.fromCodePoint(0x2014)

test('the CEO order: known runners, each once, the default when broken; Claude Code first, Hermes second', () => {
  assert.deepEqual(CEO_RUNNERS_DEFAULT, ['claude-code', 'hermes'])
  // Kimi Code and Codex are refused: Fabric cannot hold their models to the CEO's floor.
  assert.deepEqual(ceoRunnersOf(['hermes', 'hermes', 'shell', 'nope', 'codex', 'kimi-code']), ['hermes'])
  assert.deepEqual(ceoRunnersOf([]), [...CEO_RUNNERS_DEFAULT])
  assert.deepEqual(ceoRunnersOf('claude-code'), [...CEO_RUNNERS_DEFAULT])
  assert.deepEqual(validateSettings({ ceoRunners: ['hermes'] }).ceoRunners, ['hermes'])
  assert.deepEqual(validateSettings({}).ceoRunners, [...CEO_RUNNERS_DEFAULT])
})

test('THE FLOOR: the CEO runs on Opus or GPT Sol, never below Sonnet 5.5; a profile below it is refused', () => {
  assert.deepEqual(CEO_MODELS_DEFAULT, ['anthropic/claude-opus-5.5', 'openai/gpt-6.2-sol', 'anthropic/claude-sonnet-5.5'])
  for (const ok of ['anthropic/claude-opus-5.5', 'anthropic/claude-opus-6', 'anthropic/claude-sonnet-5.5', 'openai/gpt-6.2-sol', 'openai/gpt-6-sol'])
    assert.equal(ceoModelAllowed(ok), true, ok)
  for (const below of ['anthropic/claude-haiku-5.5', 'anthropic/claude-sonnet-4.5', 'anthropic/claude-opus-4.1', 'openai/gpt-5.6-sol', 'openai/gpt-6.2-mini',
    'moonshotai/kimi-k3.1-pro', 'z-ai/glm-5.3', 'deepseek/deepseek-v4.1-flash', 'google/gemini-3.1-pro-preview', ''])
    assert.equal(ceoModelAllowed(below), false, below)
  assert.deepEqual(ceoModelsOf(['moonshotai/kimi-k3.1-pro', 'anthropic/claude-sonnet-5.5', 'anthropic/claude-haiku-5.5']), ['anthropic/claude-sonnet-5.5'])
  assert.deepEqual(ceoModelsOf(['z-ai/glm-5.3']), [...CEO_MODELS_DEFAULT], 'a profile with nothing at the floor is the default, never the cheap model')
  assert.deepEqual(validateSettings({ ceoModels: ['anthropic/claude-haiku-5.5'] }).ceoModels, [...CEO_MODELS_DEFAULT])
  // Claude Code: Opus, or Sonnet when the list puts Sonnet first; never Haiku.
  assert.deepEqual(ceoLaunchExtras('claude-code', CEO_MODELS_DEFAULT), { args: ['--model', 'opus'], env: {} })
  assert.equal(claudeModelFlag(['anthropic/claude-sonnet-5.5']), 'sonnet')
  assert.equal(claudeModelFlag(['openai/gpt-6.2-sol']), 'opus')
  // Hermes: the whole list, tried in order by its ACP session.
  assert.deepEqual(ceoLaunchExtras('hermes', CEO_MODELS_DEFAULT).env, { FABRIC_ACP_MODELS: 'anthropic/claude-opus-5.5,openai/gpt-6.2-sol,anthropic/claude-sonnet-5.5' })
})

test('the brief names every tool, the board capability, and carries no em dash in either language', () => {
  for (const locale of ['ru', 'en']) {
    const b = ceoBrief({ locale })
    for (const tool of Object.values(CEO_TOOLS)) assert.ok(b.includes(tool.mcp), `${locale} brief names ${tool.mcp}`)
    assert.ok(b.includes('ceo.task'))
    assert.ok(!b.includes(EM_DASH), `${locale} brief has an em dash`)
  }
})

test('a message line: words, then the attachments by path; nothing for nothing', () => {
  assert.equal(ceoLine('  hi  ', [], 'ru'), 'hi')
  assert.equal(ceoLine('look', ['/a/b.png'], 'ru'), 'look\n\nВложения: /a/b.png')
  assert.equal(ceoLine('', ['/a/b.png'], 'en'), 'Attached: /a/b.png')
  assert.equal(ceoLine('   ', [], 'ru'), null)
  assert.match(inboxName('../../etc/passwd', 0, 1), /^1970-01-01T00-00-00-000Z-1-passwd$/)
  assert.ok(!inboxName('a/b/c d.png', 0, 2).includes('/'))
})

test('keys by name, digits and letters only; typed text loses its control bytes', () => {
  assert.equal(keyBytes('Enter'), '\r')
  assert.equal(keyBytes('down'), '\x1b[B')
  assert.equal(keyBytes('2'), '2')
  assert.equal(keyBytes('\x1b[2J'), null)
  assert.equal(keyBytes('enterx'), null)
  assert.equal(typedText('ok\x1b[31m\x07'), 'ok[31m')
})

test('a screen as text: blank lines and repeats dropped, the last lines kept', () => {
  assert.equal(screenText('a\n\n  \nb\nb\nc\n', 2), 'b\nc')
})

test('a project by id, folder, name or words; two matches ask instead of guessing', () => {
  const ps = [{ id: '1', name: 'Alpha', repo_path: '/d/alpha' }, { id: '2', name: 'Alpha Web', repo_path: '/d/alpha-web' }, { id: '3', name: 'Beta Store', repo_path: '/d/beta-store' }]
  assert.equal(findProject(ps, '3').found.id, '3')
  assert.equal(findProject(ps, '/d/alpha/').found.id, '1')
  assert.equal(findProject(ps, 'alpha').found.id, '1')
  assert.equal(findProject(ps, 'beta').found.id, '3')
  assert.deepEqual(findProject(ps, 'alp').ambiguous, ['Alpha', 'Alpha Web'])
  assert.equal(findProject(ps, 'nothing').missing, true)
})

// ── the keeper ─────────────────────────────────────────────────────────────

function keeper(over = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'ceo-'))
  const log = []
  const delivered = []
  const consoles = new Map()
  let clock = 1_000_000
  const deps = {
    root,
    locale: () => 'ru',
    ensureProject: async () => '11111111-1111-4111-8111-111111111111',
    runners: () => ['claude-code', 'hermes'],
    models: () => ['anthropic/claude-opus-5.5'],
    // A walk that picks the first runner of the order not failed, as ADR-0125's does.
    walk: async (_p, order, failed) => {
      const runner = order.find((r) => !failed.has(r))
      return runner ? { state: 'selected', runner, index: order.indexOf(runner), session: 'spawned', passedOver: order.slice(0, order.indexOf(runner)).map((r, i) => ({ index: i, runner: r, result: 'spawn-failed' })) }
        : { state: 'exhausted', passedOver: order.map((r, i) => ({ index: i, runner: r, result: 'spawn-failed' })) }
    },
    open: async (projectId, cwd, runner, _route, sessionId) => {
      if (over.refuse?.includes(runner)) { const e = new Error(`${runner} unavailable`); e.unavailable = true; throw e }
      const s = { sessionId, projectId, cwd, optionId: runner, running: true, state: 'running' }
      consoles.set(sessionId, s)
      log.push(['open', runner, deps.isCeoAtOpen?.(sessionId)])
      return s
    },
    get: (id) => consoles.get(id) ?? null,
    deliver: async (id, text) => { delivered.push([id, text]); return { state: 'written' } },
    stop: async (id) => { const s = consoles.get(id); if (s) s.running = false },
    unavailable: (e) => e?.unavailable === true,
    record: (op, d) => log.push([op, d]),
    onChange: (s) => log.push(['changed', s.state]),
    now: () => clock
  }
  const agent = createCeoAgent(deps)
  deps.isCeoAtOpen = (id) => agent.isCeo(id)
  return { agent, deps, log, delivered, consoles, root, tick: (ms) => { clock += ms } }
}

test('the CEO starts lazily on Claude Code, in its folder, with its brief, and is its own session from the first call', async () => {
  const k = keeper()
  assert.equal(k.agent.status().state, 'idle')
  const s = await k.agent.ensure()
  assert.equal(s.state, 'running')
  assert.equal(s.runner, 'claude-code')
  assert.equal(s.folder, k.root)
  assert.ok(existsSync(path.join(k.root, 'CLAUDE.md')) && existsSync(path.join(k.root, 'AGENTS.md')))
  assert.deepEqual(k.log.find((l) => l[0] === 'open'), ['open', 'claude-code', true], 'the surface knows the console is the CEO before open returns')
  assert.equal(JSON.parse(readFileSync(path.join(k.root, 'ceo.json'), 'utf8')).projectId, '11111111-1111-4111-8111-111111111111')
  // Concurrent callers share one start.
  const [a, b] = await Promise.all([k.agent.ensure(), k.agent.ensure()])
  assert.equal(a.sessionId, b.sessionId)
  assert.equal(k.log.filter((l) => l[0] === 'open').length, 1)
})

test('MANDATORY FALLBACK: Claude Code that cannot start hands the CEO to Hermes, and the head says why', async () => {
  const k = keeper({ refuse: ['claude-code'] })
  const s = await k.agent.ensure()
  assert.equal(s.state, 'running')
  assert.equal(s.runner, 'hermes')
})

test('a usage limit sets the runner aside, starts the next one and types the last message again', async () => {
  const k = keeper()
  await k.agent.send('какие сессии сейчас идут', [])
  const first = k.agent.sessionId()
  assert.ok(LIMIT_SAID.test("You've hit your limit · resets 5pm"))
  k.agent.onOutput('another-session', "You've hit your limit")
  assert.equal(k.agent.sessionId(), first, 'another console\'s limit is not the CEO\'s')
  k.agent.onOutput(first, "Claude usage limit reached. Your limit will reset at 5pm")
  for (let i = 0; i < 20 && k.agent.status().runner !== 'hermes'; i++) await new Promise((r) => setTimeout(r, 5))
  const s = k.agent.status()
  assert.equal(s.runner, 'hermes')
  assert.equal(s.setAside[0].runner, 'claude-code')
  assert.equal(k.delivered.at(-1)[1], 'какие сессии сейчас идут')
  assert.equal(k.delivered.at(-1)[0], s.sessionId)
  assert.equal(k.consoles.get(first).running, false, 'the limited console was stopped')
})

test('a console that ends at its start is passed over; a later end is only an end', async () => {
  const k = keeper()
  await k.agent.ensure()
  k.agent.onExit(k.agent.sessionId())
  for (let i = 0; i < 20 && k.agent.status().runner !== 'hermes'; i++) await new Promise((r) => setTimeout(r, 5))
  assert.equal(k.agent.status().runner, 'hermes')
  k.tick(60_000)
  k.consoles.get(k.agent.sessionId()).running = false
  k.agent.onExit(k.agent.sessionId())
  assert.equal(k.agent.status().state, 'ended')
})

test('attachments land in the inbox and are named by path; an empty file is refused whole', async () => {
  const k = keeper()
  const r = await k.agent.send('что на картинке', [{ name: 'shot.png', data: Buffer.from('png-bytes').toString('base64') }])
  assert.equal(r.ok, true)
  const files = readdirSync(path.join(k.root, 'inbox'))
  assert.equal(files.length, 1)
  assert.match(k.delivered[0][1], new RegExp(`что на картинке\\n\\nВложения: ${path.join(k.root, 'inbox', files[0]).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
  const bad = await k.agent.send('x', [{ name: 'empty.png', data: '' }])
  assert.equal(bad.ok, false)
  assert.equal(k.delivered.length, 1)
})

test('restart stops the console and starts another; a start that fails says why', async () => {
  const k = keeper()
  await k.agent.ensure()
  const first = k.agent.sessionId()
  await k.agent.restart('person')
  assert.notEqual(k.agent.sessionId(), first)
  assert.equal(k.consoles.get(first).running, false)
  const none = keeper({ refuse: ['claude-code', 'hermes'] })
  const s = await none.agent.ensure()
  assert.equal(s.state, 'failed')
  assert.ok(s.problem)
})

// ── the operations ─────────────────────────────────────────────────────────

function operations(over = {}) {
  const writes = []
  const records = []
  const notes = []
  const consoles = new Map([
    ['ceo', { sessionId: 'ceo', projectId: 'p0', cwd: '/ceo', optionId: 'claude-code', state: 'running', running: true, startedAt: 'x', lastActivityAt: 'x', tail: '' }],
    ['s1', { sessionId: 's1', projectId: 'p1', cwd: '/d/app', optionId: 'claude-code', state: 'waiting', running: true, startedAt: 'x', lastActivityAt: 'x', tail: 'choose 1/2:' }],
    ['s2', { sessionId: 's2', projectId: 'p1', cwd: '/d/app', optionId: 'shell', state: 'exited', running: false, startedAt: 'x', lastActivityAt: 'x', tail: '' }]
  ])
  const opened = []
  const switchboard = []
  const deps = {
    ptys: {
      list: () => [...consoles.values()],
      get: (id) => consoles.get(id) ?? null,
      scrollbackOf: (id) => (consoles.has(id) ? { text: '\x1b[1mready\x1b[0m\r\nchoose 1/2: ' } : null),
      write: (id, data) => writes.push([id, data])
    },
    ceoSessionId: () => 'ceo',
    projects: async () => [{ id: 'p1', name: 'App', repo_path: '/d/app', default_agent: 'codex' }, { id: 'p2', name: 'Site', repo_path: '/d/site', default_agent: null }],
    admitFolder: async (folder) => ({ id: 'p9', name: path.basename(folder), repo_path: folder }),
    openConsole: async (projectId, runner, task) => { opened.push([projectId, runner, task]); return { sessionId: 'new', projectId, cwd: '/d/app', optionId: runner, state: 'starting', running: true } },
    stop: async (id, force) => { consoles.get(id).running = false; return { state: force ? 'killed' : 'stopped' } },
    openWindow: (id) => opened.push(['window', id]),
    switchboard: async (args) => {
      switchboard.push(args)
      if (over.switchboard) return over.switchboard(args)
      return { code: 0, stdout: JSON.stringify({ data: { rows: [
        { session_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', launch_id: 'l1', pid: 4242, agent: 'claude-code', folder: '/d/site/x', group: 'running', why: null, acts: ['end'] },
        { session_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', launch_id: null, pid: 77, agent: 'claude-code', folder: '/d/other', group: 'ended', why: null, acts: ['continue'] }
      ] } }), stderr: '' }
    },
    signal: (pid) => records.push(['signal', pid]),
    record: (op, d) => records.push([op, d]),
    note: (kind, d) => notes.push([kind, d]),
    sleep: async () => {},
    transcriptRoots: over.transcriptRoots ?? []
  }
  return { ops: createCeoOperations(deps), writes, records, notes, opened, switchboard, consoles }
}

test('sessions: the Fabric consoles and the machine\'s, the CEO marked, ended ones only when asked', async () => {
  const o = operations()
  const r = await o.ops.run('sessions', {})
  assert.equal(r.ok, true)
  assert.deepEqual(r.fabric_consoles.map((s) => s.session_id), ['ceo', 's1'])
  assert.equal(r.fabric_consoles[0].is_ceo, true)
  assert.equal(r.fabric_consoles[1].project, 'App')
  assert.deepEqual(r.machine_sessions.map((s) => s.launch_id), ['l1'])
  const all = await o.ops.run('sessions', { include_ended: true })
  assert.equal(all.fabric_consoles.length, 3)
  assert.equal(all.machine_sessions.length, 2)
  const site = await o.ops.run('sessions', { project: 'Site' })
  assert.deepEqual(site.machine_sessions.map((s) => s.launch_id), ['l1'])
  const unread = operations({ switchboard: async () => null })
  assert.match((await unread.ops.run('sessions', {})).machine_sessions.unread, /not installed/)
})

test('read: a console\'s screen as text, or a Claude Code session\'s last turns from its transcript', async () => {
  const o = operations()
  const r = await o.ops.run('read', { session_id: 's1' })
  assert.equal(r.screen, 'ready\nchoose 1/2:')
  const root = mkdtempSync(path.join(tmpdir(), 'ceo-tr-'))
  mkdirSync(path.join(root, 'projects', '-d-site'), { recursive: true })
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  writeFileSync(path.join(root, 'projects', '-d-site', `${id}.jsonl`), [
    JSON.stringify({ type: 'user', message: { role: 'user', content: 'fix the build' } }),
    '{"cut',
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Running tests' }, { type: 'tool_use', name: 'Bash' }] } })
  ].join('\n'))
  const t = operations({ transcriptRoots: [root] })
  const tr = await t.ops.run('read', { session_id: id })
  assert.equal(tr.kind, 'transcript')
  assert.deepEqual(tr.turns, [{ role: 'user', text: 'fix the build' }, { role: 'assistant', text: 'Running tests [tool Bash]' }])
  assert.equal((await t.ops.run('read', { session_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' })).ok, false)
})

test('input: text then Enter, or keys in order; never the CEO\'s own console, never an ended one, every act recorded', async () => {
  const o = operations()
  const r = await o.ops.run('input', { session_id: 's1', text: '2', reason: 'the owner chose option two' })
  assert.equal(r.ok, true)
  assert.deepEqual(o.writes, [['s1', '2'], ['s1', '\r']])
  o.writes.length = 0
  await o.ops.run('input', { session_id: 's1', keys: ['down', 'enter'], reason: 'pick the second item' })
  assert.deepEqual(o.writes, [['s1', '\x1b[B'], ['s1', '\r']])
  assert.equal((await o.ops.run('input', { session_id: 'ceo', text: 'x', reason: 'not allowed here' })).ok, false)
  assert.equal((await o.ops.run('input', { session_id: 's2', text: 'x', reason: 'it ended long ago' })).ok, false)
  assert.equal((await o.ops.run('input', { session_id: 's1', keys: ['\x1b[2J'], reason: 'raw bytes refused' })).ok, false)
  assert.equal((await o.ops.run('input', { session_id: 's1', text: 'x' })).ok, false, 'no reason, no act')
  assert.ok(o.records.some(([op, d]) => op === 'ceo.session.input' && d.reason === 'the owner chose option two'))
})

test('start: a project by name with its own runner and the task; a new folder becomes a project; two matches are asked about', async () => {
  const o = operations()
  const r = await o.ops.run('start', { project: 'app', task: 'run the tests', reason: 'the owner asked' })
  assert.equal(r.ok, true)
  assert.deepEqual(o.opened[0], ['p1', 'codex', 'run the tests'])
  assert.equal(o.notes[0][0], 'session.start')
  const dir = mkdtempSync(path.join(tmpdir(), 'ceo-new-'))
  const n = await o.ops.run('start', { project: dir, runner: 'shell', reason: 'a folder nobody knew' })
  assert.equal(n.ok, true)
  assert.deepEqual(o.opened[1], ['p9', 'shell', undefined])
  assert.equal((await o.ops.run('start', { project: 'zzz', reason: 'nothing like it' })).ok, false)
})

test('stop: a console as the person\'s stop, force kills; a Switchboard session ends through Switchboard; its own console never', async () => {
  const o = operations()
  assert.equal((await o.ops.run('stop', { session_id: 'ceo', reason: 'should be refused' })).ok, false)
  const r = await o.ops.run('stop', { session_id: 's1', force: true, reason: 'it is stuck' })
  assert.deepEqual([r.ok, r.state], [true, 'killed'])
  assert.equal(o.notes.at(-1)[0], 'session.stop')
  const sb = await o.ops.run('stop', { session_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', reason: 'the owner asked' })
  assert.equal(sb.via, 'switchboard')
  assert.deepEqual(o.switchboard.at(-1), ['sessions', 'end', 'l1'])
  const noHost = operations({ switchboard: async (args) => args[0] === '--json'
    ? { code: 0, stdout: JSON.stringify({ data: { rows: [{ session_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', launch_id: null, pid: 999, agent: 'claude-code', folder: '/x', group: 'running', acts: [] }] } }), stderr: '' }
    : { code: 1, stdout: '', stderr: 'no' } })
  assert.equal((await noHost.ops.run('stop', { session_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', reason: 'outside Fabric' })).ok, false, 'no SIGTERM without force')
  const killed = await noHost.ops.run('stop', { session_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', force: true, reason: 'outside Fabric, stuck' })
  assert.deepEqual([killed.ok, killed.state, killed.pid], [true, 'signalled', 999])
})

test('resume: an ended console starts again in its project with its runner; a Switchboard session continues as itself', async () => {
  const o = operations()
  const r = await o.ops.run('resume', { session_id: 's2', reason: 'carry on' })
  assert.equal(r.ok, true)
  assert.equal(o.opened[0][0], 'p1')
  assert.equal(o.opened[0][1], 'shell')
  assert.equal((await o.ops.run('resume', { session_id: 's1', reason: 'still running' })).ok, false)
  const sb = await o.ops.run('resume', { session_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', reason: 'carry on' })
  assert.equal(sb.via, 'switchboard')
  assert.deepEqual(o.switchboard.at(-1), ['sessions', 'continue', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'])
})

test('open, projects, an unknown tool and refused arguments', async () => {
  const o = operations()
  assert.equal((await o.ops.run('open', { session_id: 's1' })).ok, true)
  assert.deepEqual(o.opened.at(-1), ['window', 's1'])
  assert.equal((await o.ops.run('open', { session_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })).ok, false)
  const p = await o.ops.run('projects', { query: 'site' })
  assert.deepEqual(p.projects.map((x) => x.name), ['Site'])
  assert.equal((await o.ops.run('rm_rf', {})).ok, false)
  assert.match((await o.ops.run('stop', { session_id: 's1', extra: 1, reason: 'x x x' })).reason, /refused/)
})

test('the voice tools are the same set, each with a JSON schema', () => {
  const tools = ceoVoiceTools()
  assert.deepEqual(tools.map((t) => t.name).sort(), Object.keys(CEO_TOOLS).map((k) => `session_${k}`).sort())
  for (const t of tools) assert.equal(t.parameters.type, 'object')
  assert.equal(parseMachineRows('not json'), null)
  assert.deepEqual(transcriptTurns(''), [])
})

test('the voice token: the key read for one request and never handed back; failures say why', async () => {
  const sent = []
  const vault = { read: async (slot) => { assert.deepEqual(slot, XAI_KEY_SLOT); return { ok: true, value: 'xai-SECRET' } } }
  const fetch = async (url, init) => { sent.push([url, init]); return new Response(JSON.stringify({ value: 'ephemeral', expires_at: 2000 }), { status: 200 }) }
  const r = await mintVoiceToken({ vault, fetch })
  assert.deepEqual([r.ok, r.value, r.expiresAt], [true, 'ephemeral', 2_000_000])
  assert.ok(!JSON.stringify(r).includes('xai-SECRET'), 'the key never leaves')
  assert.equal(sent[0][1].headers.authorization, 'Bearer xai-SECRET')
  assert.deepEqual(JSON.parse(sent[0][1].body), { expires_after: { seconds: 300 } })
  const noKey = await mintVoiceToken({ vault: { read: async () => ({ ok: false, reason: 'no slot' }) }, fetch })
  assert.match(noKey.reason, /no slot/)
  const refused = await mintVoiceToken({ vault, fetch: async () => new Response('{}', { status: 401 }) })
  assert.match(refused.reason, /401/)
  assert.ok(!JSON.stringify(refused).includes('xai-SECRET'))
  const empty = await mintVoiceToken({ vault, fetch: async () => new Response('{}', { status: 200 }) })
  assert.equal(empty.ok, false)
})

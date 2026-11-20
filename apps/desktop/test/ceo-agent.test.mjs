// ADR-0197: the CEO is one console Fabric keeps, walked over its own runner order with a mandatory fallback; its
// session control is one set of operations behind the MCP tools and the voice call; the voice call never sees the key.
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { ceoBoardNudge, ceoBrief, ceoLaunchExtras, ceoLine, ceoModelAllowed, ceoModelsOf, ceoRunnersOf, claudeModelFlag, findProject, inboxName, keyBytes, screenText, typedText, CEO_MODELS_DEFAULT, CEO_RUNNERS_DEFAULT } from '../src/shared/ceoAgent.ts'
import { createCeoAgent, LIMIT_SAID } from '../src/main/ceoAgent.ts'
import { createCeoOperations, ceoVoiceTools, parseMachineRows, transcriptTurns, CEO_TOOLS } from '../src/main/ceoTools.ts'
import { mintVoiceToken, sampleText, voiceSample, XAI_KEY_SLOT } from '../src/main/ceoVoice.ts'
import { createVoiceKeyStore, voiceKeyShapeOk } from '../src/main/ceoVoiceKey.ts'
import { validateSettings } from '../src/shared/appSettings.ts'
import { currentLaunchOrigin } from '../src/main/launchOrigin.ts'

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
  assert.deepEqual(findProject(ps, 'alp').ambiguous.map((n) => n.replace(/ \(.*\)$/, '')), ['Alpha', 'Alpha Web'])
  assert.equal(findProject(ps, 'nothing').missing, true)
  // 2026-11-20, the CEO's voice: «sound engine» is «sound-engine», and a worktree copy of the same name gives way.
  const heard = [
    { id: 'se', name: 'sound-engine', repo_path: '/d/sound-engine' },
    { id: 'sw', name: 'sound-engine-copy-a', repo_path: '/d/_worktrees/sound-engine-copy-a' },
    { id: 'db', name: 'fabric-agents-database', repo_path: '/d/fabric-agents-database' },
    { id: 'db2', name: 'fabric-agents-database', repo_path: '/d/_worktrees/fabric-agents-database-x' }
  ]
  assert.equal(findProject(heard, 'sound engine').found.id, 'se')
  assert.equal(findProject(heard, 'Sound_Engine').found.id, 'se')
  assert.equal(findProject(heard, 'fabric-agents-database').found.id, 'db')
  assert.deepEqual(findProject([heard[2], { ...heard[2], id: 'db3', repo_path: '/e/fabric-agents-database' }], 'fabric-agents-database').ambiguous,
    ['fabric-agents-database (/d/fabric-agents-database)', 'fabric-agents-database (/e/fabric-agents-database)'], 'two real copies are asked about, by folder')
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
    write: (id, data) => delivered.push([id, `raw:${JSON.stringify(data)}`]),
    sleep: async () => {},
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
  assert.equal(k.delivered.at(-1)[1], 'raw:"\\r"', 'Claude Code swallows the Enter after a pasted image path: one more is pressed')
  const files = readdirSync(path.join(k.root, 'inbox'))
  assert.equal(files.length, 1)
  assert.match(k.delivered[0][1], new RegExp(`что на картинке\\n\\nВложения: ${path.join(k.root, 'inbox', files[0]).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
  const bad = await k.agent.send('x', [{ name: 'empty.png', data: '' }])
  assert.equal(bad.ok, false)
  assert.equal(k.delivered.length, 2)
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
  const origins = []
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
    openConsole: async (projectId, runner, task) => { opened.push([projectId, runner, task]); origins.push(currentLaunchOrigin()); return { sessionId: 'new', projectId, cwd: '/d/app', optionId: runner, state: 'starting', running: true } },
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
    transcriptRoots: over.transcriptRoots ?? [],
    ...(over.launches ? { launches: over.launches } : {}),
    ...(over.diskSessions ? { diskSessions: over.diskSessions } : {}),
    ...(over.firstTask ? { firstTask: over.firstTask } : {}),
    ...(over.saveAlias ? { saveAlias: over.saveAlias } : {}),
    ...(over.projects ? { projects: over.projects } : {}),
    // The fixtures' new folders live in the system's temporary folder; the scratch rule is tested on its own below.
    scratch: over.scratch ?? (() => false)
  }
  return { ops: createCeoOperations(deps), writes, records, notes, opened, origins, switchboard, consoles }
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
    JSON.stringify({ type: 'user', message: { role: 'user', content: 'use sk-ant-ABCDEFGHIJKLMNOPQRSTUV for it' } }),
    '{"cut',
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Running tests' }, { type: 'tool_use', name: 'Bash' }] } })
  ].join('\n'))
  const t = operations({ transcriptRoots: [root] })
  const tr = await t.ops.run('read', { session_id: id })
  assert.equal(tr.kind, 'transcript')
  assert.ok(!JSON.stringify(tr.turns).includes('sk-ant-ABCDEFGHIJKLMNOPQRSTUV'), 'DA-6: a key in a turn reaches the CEO redacted')
  assert.deepEqual([tr.turns[0], tr.turns[2]], [{ role: 'user', text: 'fix the build' }, { role: 'assistant', text: 'Running tests [tool Bash]' }])
  assert.match(tr.turns[1].text, /^use .+ for it$/)
  assert.equal((await t.ops.run('read', { session_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' })).ok, false)
})

test('DA-13 / ER-25: a console\'s last line reaches the CEO redacted, a key across the 200-character cut included', async () => {
  const o = operations()
  o.consoles.get('s1').tail = 'export ANTHROPIC_API_KEY=sk-ant-ABCDEFGHIJKLMNOPQRSTUV'
  const whole = (await o.ops.run('sessions', {})).fabric_consoles.find((s) => s.session_id === 's1').last_line
  assert.ok(!whole.includes('ABCDEFGHIJKLMNOPQRSTUV'), 'a key in the last line is redacted')
  o.consoles.get('s1').tail = 'x '.repeat(95) + 'sk-ant-ABCDEFGHIJKLMNOPQRSTUV'
  const cut = (await o.ops.run('sessions', {})).fabric_consoles.find((s) => s.session_id === 's1').last_line
  assert.ok(cut.length <= 200)
  assert.ok(!cut.includes('sk-ant-A'), 'no part of a key that the cut would split reaches the CEO')
  const read = await o.ops.run('read', { session_id: 's1' })
  assert.ok(!read.last_line.includes('sk-ant-A'))
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

test('start says what became of the first task: delivered, or not delivered with the next step (2026-11-20)', async () => {
  const fine = operations({ firstTask: () => Promise.resolve({ state: 'resubmitted', attempts: 1 }) })
  assert.deepEqual((await fine.ops.run('start', { project: 'app', task: 'go', reason: 'the owner asked' })).first_task, { state: 'resubmitted', attempts: 1 })
  const lost = operations({ firstTask: () => Promise.resolve({ state: 'not_delivered', reason: 'readiness_timeout', attempts: 2 }) })
  const r = await lost.ops.run('start', { project: 'app', task: 'go', reason: 'the owner asked' })
  assert.equal(r.ok, true, 'the session did start')
  assert.equal(r.first_task.state, 'not_delivered')
  assert.match(r.first_task.next, /fabric_ceo_session_input/)
  const none = operations({ firstTask: () => Promise.resolve({ state: 'delivered', attempts: 1 }) })
  assert.equal((await none.ops.run('start', { project: 'app', reason: 'no task given' })).first_task, undefined, 'no task, nothing to follow')
})

test('start refuses a task in words for a plain shell before anything starts; a shell without a task starts', async () => {
  const o = operations()
  const r = await o.ops.run('start', { project: 'app', runner: 'shell', task: 'Сделай обзор (кратко)', reason: 'the owner asked' })
  assert.equal(r.ok, false)
  assert.match(r.reason, /coding agent/)
  assert.equal(o.opened.length, 0, 'no empty shell is left behind')
  assert.equal((await o.ops.run('start', { project: 'app', runner: 'shell', reason: 'a shell to type into' })).ok, true)
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
  assert.equal((await o.ops.run('open', { session_id: 's1' })).ok, false, 'DO-2: an open needs a reason like every act')
  assert.equal((await o.ops.run('open', { session_id: 's1', reason: 'the owner wants to watch it' })).ok, true)
  assert.deepEqual(o.opened.at(-1), ['window', 's1'])
  assert.equal((await o.ops.run('open', { session_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', reason: 'the owner wants to watch it' })).ok, false)
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
  assert.deepEqual([noKey.reason, /no slot/.test(noKey.detail)], ['no-key', true], 'a code for the window, the detail for the log')
  const refused = await mintVoiceToken({ vault, fetch: async () => new Response('{}', { status: 401 }) })
  assert.deepEqual([refused.reason, /401/.test(refused.detail)], ['refused', true])
  assert.ok(!JSON.stringify(refused).includes('xai-SECRET'))
  const empty = await mintVoiceToken({ vault, fetch: async () => new Response('{}', { status: 200 }) })
  assert.equal(empty.ok, false)
})

test('the person\'s own xAI key: kept encrypted, tried before Observatory, taken from a coding agent\'s drop file', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ceo-key-'))
  const safe = { isEncryptionAvailable: () => true, encryptString: (s) => Buffer.from([...s].reverse().join('')), decryptString: (b) => [...b.toString()].reverse().join('') }
  const keys = createVoiceKeyStore(dir, safe)
  const KEY = 'xai-' + 'A'.repeat(40)
  assert.equal(keys.source(), 'none')
  assert.deepEqual(keys.set('  '), { ok: false, reason: 'empty' })
  assert.deepEqual(keys.set('sk-not-xai'), { ok: false, reason: 'malformed' })
  assert.equal(voiceKeyShapeOk('xai-short'), false)
  assert.deepEqual(keys.set(KEY), { ok: true })
  assert.ok(!readFileSync(path.join(dir, 'xai-key.bin')).toString().includes(KEY), 'the file holds no plain key')
  assert.equal((await import('node:fs')).statSync(path.join(dir, 'xai-key.bin')).mode & 0o777, 0o600)
  assert.equal(keys.read(), KEY)
  // Tried first: Observatory is not read when the person's key is set.
  const sent = []
  let vaultRead = 0
  const vault = { read: async () => { vaultRead++; return { ok: false, reason: 'no slot' } } }
  const fetch = async (url, init) => { sent.push(init); return new Response(JSON.stringify({ value: 'ephemeral' }), { status: 200 }) }
  const r = await mintVoiceToken({ ownKey: () => keys.read(), vault, fetch })
  assert.equal(r.ok, true)
  assert.equal(vaultRead, 0)
  assert.equal(sent[0].headers.authorization, `Bearer ${KEY}`)
  // A coding agent drops a key from the clipboard: taken in at the next read, the drop file removed.
  keys.clear()
  assert.equal(keys.source(), 'none')
  const OTHER = 'xai-' + 'B'.repeat(40)
  writeFileSync(keys.dropPath, OTHER + '\n', { mode: 0o600 })
  assert.equal(keys.read(), OTHER)
  assert.equal(existsSync(keys.dropPath), false, 'the drop file is gone once taken')
  // A malformed drop is removed and changes nothing.
  writeFileSync(keys.dropPath, 'not a key', { mode: 0o600 })
  assert.equal(keys.read(), OTHER)
  assert.equal(existsSync(keys.dropPath), false)
  // Without encryption the key is kept under the same mode.
  const plain = createVoiceKeyStore(mkdtempSync(path.join(tmpdir(), 'ceo-key-')), null)
  assert.deepEqual(plain.set(KEY), { ok: true })
  assert.equal(plain.read(), KEY)
})

test('PM chain: a ceo.task request for the CEO is typed into its running console once; others and taken ones are not', async () => {
  const P = '11111111-1111-4111-8111-111111111111'
  const req = (id, over = {}) => ({ requestId: id, to: P, capability: 'ceo.task', subject: 'ship the release', state: null, from: 'pm', ...over })
  assert.equal(ceoBoardNudge([req('r0', { capability: 'board.respond' }), req('r1', { state: 'claimed' }), req('r2', { to: 'other' })], P, new Set()), null)
  const n = ceoBoardNudge([req('r3'), req('r4', { state: 'queued' })], P, new Set(), { pm: 'PM agent' })
  assert.deepEqual(n.ids, ['r3', 'r4'])
  assert.match(n.line, /«ship the release» от PM agent \(r3\)/)
  assert.ok(!n.line.includes(String.fromCodePoint(0x2014)))
  const k = keeper()
  assert.equal(await k.agent.nudgeBoard([req('r5')]), false, 'not running: nothing typed, nothing started')
  await k.agent.ensure()
  assert.equal(await k.agent.nudgeBoard([req('r5')]), true)
  assert.equal(await k.agent.nudgeBoard([req('r5')]), false, 'told once')
  assert.match(k.delivered.at(-1)[1], /com\.claim/)
})

test('a runner on its first-run theme picker is passed over too', async () => {
  const k = keeper()
  await k.agent.ensure()
  const first = k.agent.sessionId()
  // Claude Code 2.1.299 with an empty config, measured 2026-11-18: the theme picker comes before the login menu.
  k.agent.onOutput(first, '\x1b[2GChoose\x1b[9Gthe text style that looks best with your terminal\r\r\n')
  await new Promise((r) => setTimeout(r, 5))
  assert.equal(k.agent.status().runner, 'hermes')
  assert.equal(k.agent.status().setAside[0].why, 'not-connected')
})

test('a runner that shows its sign-in screen is passed over, and a message sent meanwhile reaches the next one', async () => {
  const k = keeper()
  // The message is waiting for the console when Claude Code prints its login menu (a probe that did not answer in time).
  let release
  k.deps.deliver = async (id, text) => {
    if (k.consoles.get(id)?.optionId === 'claude-code') { await new Promise((r) => { release = r }); return { state: 'failed_before_write', reason: 'session_closed' } }
    k.delivered.push([id, text]); return { state: 'written' }
  }
  await k.agent.ensure()
  const first = k.agent.sessionId()
  const sent = k.agent.send('2+3?', [])
  await new Promise((r) => setTimeout(r, 5))
  // As Claude Code 2.1.299 draws it: words placed by cursor moves, the sentence cut across two chunks.
  k.agent.onOutput(first, '\x1b[2GSelect\x1b[9Glo')
  k.agent.onOutput(first, 'gin\x1b[15Gmethod:\r\r\n')
  await new Promise((r) => setTimeout(r, 5))
  release()
  const r = await sent
  assert.equal(r.ok, true, 'the fallback typed it into Hermes')
  assert.equal(k.agent.status().runner, 'hermes')
  assert.equal(k.agent.status().setAside[0].why, 'not-connected')
  assert.deepEqual(k.delivered.at(-1), [k.agent.sessionId(), '2+3?'])
})

// ── 0.3.24 review, iteration 1 ─────────────────────────────────────────────

const settle = async (n = 10) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 2)) }

test('ER-1: when every runner ends at its start the CEO stops as failed, walks nothing again and retypes once', async () => {
  const k = keeper()
  const open = k.deps.open
  // Each console ends right after it starts (a signed-out Claude Code, a Hermes that took no model).
  k.deps.open = async (...a) => { const s = await open(...a); setTimeout(() => { s.running = false; k.agent.onExit(s.sessionId) }, 1); return s }
  const sent = k.agent.send('hello', [])
  await settle(30)
  await sent
  const s = k.agent.status()
  assert.equal(s.state, 'failed')
  assert.equal(s.problem, 'all-set-aside')
  assert.deepEqual(s.setAside.map((a) => [a.runner, a.why]).sort(), [['claude-code', 'ended-at-start'], ['hermes', 'ended-at-start']])
  const opens = k.log.filter((l) => l[0] === 'open').length
  assert.equal(opens, 2, 'each runner opened once')
  assert.ok(k.delivered.filter(([, t]) => t === 'hello').length <= 2, 'typed at most once and retyped at most once')
  // Nothing walks the set-aside runners again by itself, and a send does not either.
  await settle(30)
  const again = await k.agent.send('again', [])
  // 2026-11-20: never lost: kept for the console, said as waiting, with why it could not be typed now.
  assert.equal(again.ok, true)
  assert.equal(again.queued, true)
  assert.equal(again.reason, 'not-running')
  assert.equal(again.status.queued, 1)
  assert.equal(k.log.filter((l) => l[0] === 'open').length, opens)
  // The set-aside time passing lets the walk try them.
  k.tick(60 * 60_000 + 1)
  await k.agent.ensure()
  assert.equal(k.log.filter((l) => l[0] === 'open').length > opens, true)
})

test('ER-2 / UX-1: a limit or sign-in phrase after the start window, or one the person typed, keeps the runner', async () => {
  const k = keeper()
  await k.agent.ensure()
  const first = k.agent.sessionId()
  // The person types the words of a sign-in screen in the start window: the echo is not the runner's screen.
  await k.agent.send('почему сессия X пишет not logged in?', [])
  k.agent.onOutput(first, '> почему сессия X пишет not logged in?')
  await settle()
  assert.equal(k.agent.status().runner, 'claude-code')
  // Ten minutes later the CEO quotes a session waiting on its limit.
  k.tick(10 * 60_000)
  k.agent.onOutput(first, "⏺ Сессия demo пишет: You've hit your limit · resets 5pm")
  k.agent.onOutput(first, 'Please run /login')
  await settle()
  const s = k.agent.status()
  assert.equal(s.runner, 'claude-code')
  assert.equal(k.agent.sessionId(), first)
  assert.deepEqual(s.setAside, [])
})

test('DO-15 / ER-16: a limit Claude Code shows in answer to a message long after the start sets it aside; a quote later does not', async () => {
  const k = keeper()
  await k.agent.ensure()
  const first = k.agent.sessionId()
  k.tick(30 * 60_000)
  // The answer to a line Fabric typed, within the reply window, is the runner's own screen.
  await k.agent.send('что с сессиями?', [])
  k.tick(2_000)
  k.agent.onOutput(first, "  ⎿  You've hit your limit · resets 5pm")
  await settle()
  assert.equal(k.agent.status().runner, 'hermes', 'a limit reached mid-work moves the CEO to the next runner')
  // On the new runner, a quote well after the reply window keeps it.
  const second = k.agent.sessionId()
  k.tick(30 * 60_000)
  await k.agent.send('прочитай demo', [])
  k.tick(15_000)
  k.agent.onOutput(second, "⏺ demo пишет: You've hit your limit · resets 5pm")
  await settle()
  assert.equal(k.agent.sessionId(), second)
})

test('ER-3 / UX-3: a restart within the start window is not an early end, even when the stop reports the exit at once', async () => {
  const k = keeper()
  // As pty.ts does: the exit callback runs before the stop resolves.
  k.deps.stop = async (id) => { const s = k.consoles.get(id); if (s) { s.running = false; k.agent.onExit(id) } }
  await k.agent.send('hi', [])
  const first = k.agent.sessionId()
  k.tick(5_000)
  await k.agent.restart('person')
  await settle()
  const s = k.agent.status()
  assert.equal(s.runner, 'claude-code')
  assert.notEqual(s.sessionId, first)
  assert.deepEqual(s.setAside, [])
  assert.equal(k.delivered.filter(([, t]) => t === 'hi').length, 1, 'the last message is not typed again')
})

test('UX-4: the person\'s restart brings back a runner set aside', async () => {
  const k = keeper()
  await k.agent.ensure()
  k.agent.onOutput(k.agent.sessionId(), 'usage limit reached')
  await settle()
  assert.equal(k.agent.status().runner, 'hermes')
  const s = await k.agent.restart('person')
  assert.equal(s.runner, 'claude-code')
  assert.deepEqual(s.setAside, [])
})

test('ER-10: a stop that leaves the old console running is forced, and the outcome recorded', async () => {
  const k = keeper()
  const forced = []
  k.deps.stop = async (id, force) => { forced.push(force === true); if (force) k.consoles.get(id).running = false }
  await k.agent.ensure()
  const first = k.agent.sessionId()
  await k.agent.restart('person')
  assert.deepEqual(forced, [false, true])
  assert.equal(k.consoles.get(first).running, false)
  assert.ok(k.log.some(([op, d]) => op === 'ceo.agent.stopped' && d.outcome === 'forced'))
})

test('ER-8: a board request is told only once it was typed; a failed delivery is tried again', async () => {
  const P = '11111111-1111-4111-8111-111111111111'
  const req = { requestId: 'r9', to: P, capability: 'ceo.task', subject: 'ship', state: null, from: 'pm' }
  const k = keeper()
  await k.agent.ensure()
  let fail = true
  k.deps.deliver = async (id, text) => (fail ? { state: 'failed_before_write', reason: 'readiness_timeout' } : (k.delivered.push([id, text]), { state: 'written' }))
  assert.equal(await k.agent.nudgeBoard([req]), false)
  fail = false
  assert.equal(await k.agent.nudgeBoard([req]), true)
  assert.equal(await k.agent.nudgeBoard([req]), false)
})

test('ER-13: two messages sent while a fallback runs are each typed again into the next runner', async () => {
  const k = keeper()
  const releases = []
  k.deps.deliver = async (id, text) => {
    if (k.consoles.get(id)?.optionId === 'claude-code') { await new Promise((r) => { releases.push(r) }); return { state: 'failed_before_write', reason: 'session_closed' } }
    k.delivered.push([id, text]); return { state: 'written' }
  }
  await k.agent.ensure()
  const first = k.agent.sessionId()
  const a = k.agent.send('one', [])
  const b = k.agent.send('two', [])
  await settle(3)
  k.agent.onOutput(first, 'Select login method:')
  await settle()
  for (const r of releases) r()
  const [ra, rb] = await Promise.all([a, b])
  assert.equal(ra.ok, true)
  assert.equal(rb.ok, true)
  assert.deepEqual(k.delivered.map(([, t]) => t).sort(), ['one', 'two'])
})

test('ER-13 / DA-5: attachments older than 30 days are pruned from the inbox at start', async () => {
  const k = keeper()
  const inbox = path.join(k.root, 'inbox')
  mkdirSync(inbox, { recursive: true })
  writeFileSync(path.join(inbox, 'old.png'), 'x')
  writeFileSync(path.join(inbox, 'new.png'), 'y')
  const { utimesSync } = await import('node:fs')
  const nowMs = Date.UTC(2026, 10, 19)
  k.deps.now = () => nowMs
  const k2 = { ...k, agent: (await import('../src/main/ceoAgent.ts')).createCeoAgent(k.deps) }
  const old = (nowMs - 31 * 24 * 3600_000) / 1000
  utimesSync(path.join(inbox, 'old.png'), old, old)
  const fresh = (nowMs - 29 * 24 * 3600_000) / 1000
  utimesSync(path.join(inbox, 'new.png'), fresh, fresh)
  await k2.agent.ensure()
  assert.deepEqual(readdirSync(inbox), ['new.png'])
})

test('ER-7 / UX-5: a refused send answers a code the window words, never an English sentence', async () => {
  const k = keeper()
  assert.equal((await k.agent.send('   ', [])).reason, 'nothing-to-send')
  const empty = await k.agent.send('x', [{ name: 'a.png', data: '' }])
  assert.deepEqual([empty.reason, empty.name], ['empty-file', 'a.png'])
  k.deps.deliver = async () => ({ state: 'failed_before_write', reason: 'readiness_timeout' })
  assert.equal((await k.agent.send('x', [])).reason, 'not-delivered')
  const none = keeper({ refuse: ['claude-code', 'hermes'] })
  const s = await none.agent.ensure()
  assert.equal(s.problem, 'none-could-start')
  assert.deepEqual(s.passedOver.map((p) => p.runner), ['claude-code', 'hermes'])
  assert.ok(!none.log.some(([op, d]) => op === 'ceo.agent.start-failed' && 'error' in d), 'the message is not logged, its class is')
})

test('DA-7: an archived known CEO project gets a fresh id', async () => {
  const { ceoProjectFor } = await import('../src/main/ceoAgent.ts')
  const known = '22222222-2222-4222-8222-222222222222'
  const created = []
  const d = (status) => ({
    read: async (id) => (id === known ? { status } : null),
    heldBy: async () => null,
    create: async (id) => { created.push(id); return id },
    newId: () => '33333333-3333-4333-8333-333333333333'
  })
  assert.equal(await ceoProjectFor(d('active'), '/ceo', known), known)
  assert.equal(await ceoProjectFor(d('archived'), '/ceo', known), '33333333-3333-4333-8333-333333333333')
  assert.deepEqual(created, ['33333333-3333-4333-8333-333333333333'])
  assert.equal(await ceoProjectFor(d('active'), '/ceo', null), '33333333-3333-4333-8333-333333333333')
})

// The owner, 2026-11-19: «пытался остановить эту консоль (CEO), но не смог». The CEO had no stop of its own: a stop from
// the console's window was read as an early end and the next runner started at once, and any later open of the popup
// started a console again. The person's stop now holds until the person starts it.
test('THE PERSON\'S STOP: a stop of the CEO console holds; no fallback, no start on the popup\'s ensure; Start brings it back', async () => {
  const k = keeper()
  // As pty.ts does: the exit callback runs before the stop resolves.
  k.deps.stop = async (id) => { const s = k.consoles.get(id); if (s) { s.running = false; k.agent.onExit(id) } }
  await k.agent.ensure()
  const first = k.agent.sessionId()
  k.tick(2_000) // inside the start window: an exit here used to be read as «ended at start»
  const r = await k.agent.stop()
  assert.equal(r.ok, true)
  await settle()
  assert.equal(k.agent.status().state, 'stopped')
  assert.equal(k.consoles.get(first).running, false)
  assert.equal(k.log.filter((l) => l[0] === 'open').length, 1, 'no runner started after the person\'s stop')
  assert.deepEqual(k.agent.status().setAside, [], 'the stopped runner is not set aside')
  // The popup opening again asks ensure(): it does not start a stopped CEO.
  const again = await k.agent.ensure()
  assert.equal(again.state, 'stopped')
  assert.equal(k.log.filter((l) => l[0] === 'open').length, 1)
  // Start (the person's restart) brings it back on the first runner.
  const back = await k.agent.restart('person')
  assert.equal(back.state, 'running')
  assert.equal(back.runner, 'claude-code')
  assert.notEqual(back.sessionId, first)
})

test('THE PERSON\'S STOP from another door: a console stopped from its own window holds the CEO too', async () => {
  const k = keeper()
  await k.agent.ensure()
  const first = k.agent.sessionId()
  k.tick(2_000)
  // terminal.end marks the CEO's console as the person's stop before it stops it (index.ts).
  k.agent.personStopping(first)
  k.consoles.get(first).running = false
  k.agent.onExit(first)
  await settle()
  assert.equal(k.agent.status().state, 'stopped')
  assert.equal(k.log.filter((l) => l[0] === 'open').length, 1, 'no fallback start')
  // A message from the composer is the person asking again: it starts the CEO.
  const sent = await k.agent.send('ты тут?', [])
  assert.equal(sent.ok, true)
  assert.equal(k.agent.status().state, 'running')
})

test('THE PERSON\'S STOP that leaves the console running says so', async () => {
  const k = keeper()
  k.deps.stop = async () => {}
  await k.agent.ensure()
  const r = await k.agent.stop()
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'still-running')
  assert.equal(r.status.state, 'running')
})

test('a voice sample: fetched once per voice and language with the key held for the request, kept, never the key', async () => {
  const kept = new Map()
  const cache = { read: (n) => kept.get(n) ?? null, write: (n, b) => kept.set(n, b) }
  const sent = []
  const fetch = async (url, init) => { sent.push([url, init]); return new Response(new Uint8Array([1, 2, 3]), { status: 200 }) }
  const vault = { read: async () => ({ ok: true, value: 'xai-SECRET' }) }
  const r = await voiceSample({ vault, fetch, cache }, 'rex', 'ru')
  assert.deepEqual(r, { ok: true, data: Buffer.from([1, 2, 3]).toString('base64') })
  assert.equal(sent[0][0], 'https://api.x.ai/v1/tts')
  assert.deepEqual(JSON.parse(sent[0][1].body), { text: sampleText('ru'), voice_id: 'rex', language: 'ru' })
  assert.ok(!sampleText('ru').includes(EM_DASH) && !sampleText('en').includes(EM_DASH))
  await voiceSample({ vault, fetch, cache }, 'rex', 'ru')
  assert.equal(sent.length, 1, 'the second hearing is the kept file')
  await voiceSample({ vault, fetch, cache }, 'rex', 'en')
  assert.equal(sent.length, 2, 'another language is another sample')
  const unknown = await voiceSample({ vault, fetch, cache }, '../../etc', 'ru')
  assert.equal(unknown.reason, 'unknown-voice')
  const refused = await voiceSample({ vault, fetch: async () => new Response('', { status: 401 }), cache: { read: () => null, write: () => {} } }, 'eve', 'ru')
  assert.equal(refused.reason, 'refused')
  assert.ok(!JSON.stringify(refused).includes('xai-SECRET'))
  const noKey = await voiceSample({ vault: { read: async () => ({ ok: false, reason: 'none' }) }, fetch, cache: { read: () => null, write: () => {} } }, 'eve', 'ru')
  assert.equal(noKey.reason, 'no-key')
})

// 0.3.25 review iteration 1, ER-1: a stop during a start in flight is not acknowledged and then undone by that start.
test('ER-1 (0.3.25): a stop while the console is still opening stops what the start opens', async () => {
  const k = keeper()
  let release
  const gate = new Promise((r) => { release = r })
  const open = k.deps.open
  k.deps.open = async (...a) => { await gate; return open(...a) }
  const starting = k.agent.ensure()
  await settle()
  const stopped = k.agent.stop()
  release()
  await starting
  const r = await stopped
  assert.equal(r.ok, true)
  await settle()
  assert.equal(k.agent.status().state, 'stopped')
  const opened = [...k.consoles.values()]
  assert.equal(opened.length, 1)
  assert.equal(opened[0].running, false, 'the console the start opened was stopped')
})

// ER-2: a message sent while the person's stop is still running waits for that stop; its exit is the person's.
test('ER-2 (0.3.25): a message sent during the person\'s stop does not set the runner aside', async () => {
  const k = keeper()
  let finish
  k.deps.stop = (id) => new Promise((r) => { finish = () => { const s = k.consoles.get(id); s.running = false; k.agent.onExit(id); r() } })
  await k.agent.ensure()
  k.tick(2_000)
  const stopping = k.agent.stop()
  await settle()
  const sending = k.agent.send('снова ты', [])
  await settle()
  finish()
  await stopping
  const sent = await sending
  assert.equal(sent.ok, true)
  assert.deepEqual(k.agent.status().setAside, [], 'the stopped runner is not set aside')
  assert.equal(k.agent.status().runner, 'claude-code')
})

// ER-3: a fallback deferred before the person's stop does not run after it.
test('ER-3 (0.3.25): a deferred fallback does not run after the person\'s stop', async () => {
  const k = keeper()
  await k.agent.ensure()
  const first = k.agent.sessionId()
  k.agent.onOutput(first, 'usage limit reached')
  k.agent.onOutput(k.agent.sessionId(), 'usage limit reached')
  await k.agent.stop()
  await settle(30)
  assert.equal(k.agent.status().state, 'stopped')
  const running = [...k.consoles.values()].filter((s) => s.running)
  assert.deepEqual(running, [], 'nothing runs after the stop')
})

// ER-6: a stop from the console's own window that leaves it running does not leave the CEO held.
test('ER-6 (0.3.25): a console-window stop that fails releases the hold', async () => {
  const k = keeper()
  await k.agent.ensure()
  const id = k.agent.sessionId()
  k.agent.personStopping(id)
  k.agent.personStopEnded(id)
  assert.equal(k.agent.status().state, 'running')
})

// 0.3.25 review iteration 2, ER-7: a message while stop() still waits for a start in flight is answered after the stop.
test('ER-7 (0.3.25): a message sent while the stop waits for a start revives the CEO after the stop', async () => {
  const k = keeper()
  let release
  const gate = new Promise((r) => { release = r })
  const open = k.deps.open
  k.deps.open = async (...a) => { await gate; return open(...a) }
  const starting = k.agent.ensure()
  await settle()
  const stopping = k.agent.stop()
  await settle()
  const sending = k.agent.send('вернись', [])
  release()
  await starting
  await stopping
  const sent = await sending
  assert.equal(sent.ok, true)
  assert.equal(k.agent.status().state, 'running', 'the message, sent after the stop was pressed, starts it again')
})

// ER-8: a message during a console-window stop waits for that stop; its exit is the person's.
test('ER-8 (0.3.25): a message during a console-window stop does not set the runner aside', async () => {
  const k = keeper()
  await k.agent.ensure()
  const id = k.agent.sessionId()
  k.tick(2_000)
  k.agent.personStopping(id)
  const sending = k.agent.send('ещё раз', [])
  await settle()
  k.consoles.get(id).running = false
  k.agent.onExit(id)
  k.agent.personStopEnded(id)
  const sent = await sending
  assert.equal(sent.ok, true)
  assert.deepEqual(k.agent.status().setAside, [])
  assert.equal(k.agent.status().runner, 'claude-code')
})

// ER-9: a stop during a start that cannot stop the opened console says so and keeps it tracked.
test('ER-9 (0.3.25): a stop during a start that leaves the opened console running answers still-running', async () => {
  const k = keeper()
  k.deps.stop = async () => {}
  let release
  const gate = new Promise((r) => { release = r })
  const open = k.deps.open
  k.deps.open = async (...a) => { await gate; return open(...a) }
  const starting = k.agent.ensure()
  await settle()
  const stopping = k.agent.stop()
  release()
  await starting
  const r = await stopping
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'still-running')
  assert.ok(k.agent.sessionId(), 'the running console is the CEO\'s again')
})

// 0.3.25 review iteration 3, ER-10: a console-window stop of a console still opening ends, and a message is answered.
test('ER-10 (0.3.25): a console-window stop of the console still opening does not leave a message waiting forever', async () => {
  const k = keeper()
  let release
  const gate = new Promise((r) => { release = r })
  let openedId = null
  k.deps.open = async (projectId, cwd, runner, _route, sessionId) => {
    openedId = sessionId
    k.agent.personStopping(sessionId)
    await gate
    const s = { sessionId, projectId, cwd, optionId: runner, running: false, state: 'ended' }
    k.consoles.set(sessionId, s)
    return s
  }
  const starting = k.agent.ensure().catch(() => null)
  await settle()
  k.agent.onExit(openedId)
  k.agent.personStopEnded(openedId)
  release()
  await starting
  k.deps.open = async (projectId, cwd, runner, _route, sessionId) => { const s = { sessionId, projectId, cwd, optionId: runner, running: true }; k.consoles.set(sessionId, s); return s }
  const sent = await Promise.race([k.agent.send('ты тут', []), new Promise((r) => setTimeout(() => r('hung'), 2000))])
  assert.notEqual(sent, 'hung', 'the message is answered')
})

// ER-11: a second stop door does not release the hold the first door set.
test('ER-11 (0.3.25): a second stop door that leaves the console running does not release the first door\'s hold', async () => {
  const k = keeper()
  await k.agent.ensure()
  const id = k.agent.sessionId()
  k.tick(2_000)
  k.agent.personStopping(id) // the console's own window
  k.agent.personStopping(id) // History, the same moment
  k.agent.personStopEnded(id) // History's stop returned, console still running
  assert.equal(k.agent.status().state === 'stopped' || k.agent.status().state === 'running', true)
  k.consoles.get(id).running = false
  k.agent.onExit(id) // the first door's stop ends the console
  k.agent.personStopEnded(id)
  await settle()
  assert.equal(k.agent.status().state, 'stopped')
  assert.equal(k.log.filter((l) => l[0] === 'open').length, 1, 'no early-end fallback')
})

// Board request eef5abeb: the launch journal read by the CEO, its starts written as the CEO's, and the machine's
// sessions still seen when Switchboard does not answer.
const launch = (over) => ({ sessionId: 's1', projectId: 'p1', cwd: '/d/app', branch: 'main', runner: 'claude-code', optionId: 'claude-code', program: 'claude',
  by: 'person', via: 'screen', reason: null, parentSessionId: null, taskId: null, requestId: null, machine: 'mac', appPid: 1, appVersion: 'v', pid: 9,
  startedAt: '2026-11-19T19:00:00Z', runnerSessionId: null, stopAskedBy: null, stopReason: null, endedAt: null, end: null, exitCode: null, signal: null, ...over })

test('a start by the CEO is written as the CEO\'s, with its reason, its console as the parent and the door it came through', async () => {
  const o = operations()
  await o.ops.run('start', { project: 'App', task: 'go', reason: 'the owner asked for it' }, 'voice')
  const origin = o.origins[0]
  assert.deepEqual(origin, { by: 'ceo', via: 'voice', reason: 'the owner asked for it', parentSessionId: 'ceo' })
  await o.ops.run('start', { project: 'App', reason: 'again from the console' })
  assert.equal(o.origins[1].via, 'console', 'no door named: the console')
})

test('launches: who started what, the chain, the resume command, the open ones; refused without a journal', async () => {
  const rows = [
    launch({ sessionId: 'b', by: 'ceo', via: 'voice', parentSessionId: 'ceo', runnerSessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', startedAt: '2026-11-19T19:02:00Z' }),
    launch({ sessionId: 'old', end: 'app-quit', endedAt: '2026-11-19T19:05:00Z', startedAt: '2026-11-19T19:01:00Z' }),
    launch({ sessionId: 'ceo', projectId: 'p0', by: 'fabric', startedAt: '2026-11-19T19:00:00Z' })
  ]
  const o = operations({ launches: async () => rows })
  const r = await o.ops.run('launches', {})
  assert.equal(r.ok, true)
  const b = r.launches.find((l) => l.session_id === 'b')
  assert.equal(b.launched_by, 'ceo')
  assert.equal(b.resume, 'claude --resume aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  assert.deepEqual(b.chain.map((c) => c.session_id), ['ceo'])
  assert.equal(r.launches.find((l) => l.session_id === 'ceo').running_now, true)
  assert.deepEqual((await o.ops.run('launches', { open_only: true })).launches.map((l) => l.session_id), ['b', 'ceo'])
  assert.deepEqual((await o.ops.run('launches', { session_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })).launches.map((l) => l.session_id), ['b'], 'found by the runner\'s own id too')
  assert.deepEqual((await o.ops.run('launches', { project: 'App', limit: 1 })).launches.map((l) => l.session_id), ['b'])
  assert.equal((await operations().ops.run('launches', {})).ok, false)
})

test('sessions: each console says who started it and in which branch; Switchboard unread, the machine is read from disk', async () => {
  const disk = [
    { pid: 501, sessionId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', cwd: '/d/site/x', name: 'site', status: 'busy', kind: 'interactive', entrypoint: 'cli', startedAt: null, updatedAt: null, config: '/h' },
    { pid: 502, sessionId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', cwd: '/d/app', name: null, status: null, kind: null, entrypoint: null, startedAt: null, updatedAt: null, config: '/h' }
  ]
  const o = operations({
    launches: async () => [launch({ runnerSessionId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', branch: 'feat/x' })],
    diskSessions: async () => disk,
    switchboard: async () => { throw new Error('switchboard did not answer within 10 s') }
  })
  const r = await o.ops.run('sessions', {})
  const s1 = r.fabric_consoles.find((c) => c.session_id === 's1')
  assert.equal(s1.launched_by, 'person')
  assert.equal(s1.branch, 'feat/x')
  assert.match(r.machine_sessions.unread, /within 10 s/, 'the reason is named, never «Command failed»')
  assert.deepEqual(r.machine_sessions_on_disk.map((d) => d.pid), [501], 'a Fabric console\'s own Claude process is not listed twice')
  const site = await o.ops.run('sessions', { project: 'Site' })
  assert.deepEqual(site.machine_sessions_on_disk.map((d) => d.pid), [501])
  const read = await operations({ diskSessions: async () => disk }).ops.run('sessions', {})
  assert.equal(read.machine_sessions_on_disk, undefined, 'Switchboard read: its rows, not the disk')
})

// The owner, 2026-11-20, 21:37: «не отправляется сообщение из поп-апа разговора с CEO. Пишется, что сообщение не дошло до
// CEO. Я руками вставил выше в консоль». The operations log: ceo.agent.delivered failed_before_write readiness_timeout,
// then ipc.ceo-agent:send not-delivered after 30 s, while the CEO was working. A message is never lost now.
test('a message the working CEO did not take is kept on disk, said as waiting, and typed when the console takes it, after a restart too', async () => {
  const k = keeper()
  await k.agent.ensure()
  let busy = true
  k.deps.deliver = async (id, text) => { if (busy) return { state: 'failed_before_write', reason: 'readiness_timeout' }; k.delivered.push([id, text]); return { state: 'written' } }
  const r = await k.agent.send('сделай отчёт', [])
  assert.equal(r.ok, true, 'never said as lost')
  assert.equal(r.queued, true)
  assert.equal(r.reason, 'not-delivered')
  assert.equal(r.status.queued, 1)
  const kept = JSON.parse(readFileSync(path.join(k.root, 'pending.json'), 'utf8'))
  assert.equal(kept.length, 1)
  assert.match(kept[0].line, /сделай отчёт/)
  // A second message waits behind the first, in order.
  await k.agent.send('и ещё одно', [])
  assert.equal(k.agent.status().queued, 2)
  // The console takes input again: both are typed, oldest first, and the queue is emptied on disk.
  busy = false
  await k.agent.drain()
  assert.deepEqual(k.delivered.filter(([, t]) => /сделай отчёт|и ещё одно/.test(t)).map(([, t]) => t.includes('сделай') ? 1 : 2), [1, 2])
  assert.equal(k.agent.status().queued, undefined)
  assert.deepEqual(JSON.parse(readFileSync(path.join(k.root, 'pending.json'), 'utf8')), [])
  assert.ok(k.log.some(([op]) => op === 'ceo.agent.queued'))
  assert.ok(k.log.some(([op, d]) => op === 'ceo.agent.queue-delivered' && d.left === 0))
})

test('what waited when Fabric quit is still waiting at the next start, and is typed then', async () => {
  const k = keeper()
  writeFileSync(path.join(k.root, 'pending.json'), JSON.stringify([{ line: 'до перезапуска', at: 1 }]))
  const again = createCeoAgent({ ...k.deps })
  assert.equal(again.status().queued, 1)
  await again.ensure()
  await again.drain()
  assert.ok(k.delivered.some(([, t]) => t === 'до перезапуска'))
  assert.equal(again.status().queued, undefined)
})

// 0.3.27 review, iteration 3, run four: the queue keeps order, has one owner per line, never retypes an unknown write,
// says a stopped CEO as stopped, has one bound, presses the files' Enter, and keeps a broken file aside.
test('run four: a message sent while others wait goes behind them, and they are typed in the order they were sent', async () => {
  const k = keeper()
  await k.agent.ensure()
  let busy = true
  k.deps.deliver = async (id, text) => { if (busy) return { state: 'failed_before_write', reason: 'readiness_timeout' }; k.delivered.push([id, text]); return { state: 'written' } }
  assert.equal((await k.agent.send('FIRST', [])).queued, true)
  busy = false
  const second = await k.agent.send('SECOND', [])
  assert.equal(second.ok, true)
  assert.equal(second.queued, undefined, 'both went in, so the second is not said as waiting')
  assert.deepEqual(k.delivered.filter(([, t]) => /FIRST|SECOND/.test(t)).map(([, t]) => t), ['FIRST', 'SECOND'])
})

test('run four: a queued line belongs to the queue, so a fallback after it does not type it a second time', async () => {
  const k = keeper()
  await k.agent.ensure()
  const first = k.agent.sessionId()
  let busy = true
  k.deps.deliver = async (id, text) => { if (busy) return { state: 'failed_before_write', reason: 'readiness_timeout' }; k.delivered.push([id, text]); return { state: 'written' } }
  assert.equal((await k.agent.send('сделай отчёт', [])).queued, true)
  busy = false
  k.agent.onOutput(first, "You've hit your limit · resets 5pm")
  for (let i = 0; i < 20 && k.agent.status().runner !== 'hermes'; i++) await new Promise((r) => setTimeout(r, 5))
  await k.agent.drain()
  assert.equal(k.delivered.filter(([, t]) => t === 'сделай отчёт').length, 1)
})

test('run four: a write whose outcome is unknown is said so and never typed again', async () => {
  const k = keeper()
  await k.agent.ensure()
  let calls = 0
  k.deps.deliver = async () => { calls++; return { state: 'outcome_unknown', reason: 'pty_write_failed' } }
  const r = await k.agent.send('одно', [])
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'delivery-unknown')
  assert.equal(k.agent.status().queued, undefined, 'not queued')
  await k.agent.drain()
  assert.equal(calls, 1)
})

test('run four: a CEO that is not running keeps the message and says not-running, never busy', async () => {
  const k = keeper({ refuse: ['claude-code', 'hermes'] })
  const r = await k.agent.send('hello', [])
  assert.equal(r.ok, true)
  assert.equal(r.queued, true)
  assert.equal(r.reason, 'not-running')
})

test('run four: one bound in memory and on disk; a send past it is refused, a file past it is cut and the cut recorded', async () => {
  const k = keeper()
  await k.agent.ensure()
  k.deps.deliver = async () => ({ state: 'failed_before_write', reason: 'readiness_timeout' })
  for (let i = 0; i < 50; i++) await k.agent.send(`m${i}`, [])
  assert.equal(k.agent.status().queued, 50)
  const over = await k.agent.send('m50', [])
  assert.equal(over.ok, false)
  assert.equal(over.reason, 'queue-full')
  const k2 = keeper()
  writeFileSync(path.join(k2.root, 'pending.json'), JSON.stringify(Array.from({ length: 60 }, (_, i) => ({ line: `x${i}`, at: 1 }))))
  const again = createCeoAgent({ ...k2.deps })
  assert.equal(again.status().queued, 50)
  assert.ok(k2.log.some(([op, d]) => op === 'ceo.agent.queue-trimmed' && d.dropped === 10))
})

test('run four: a queued message naming files gets its settled Enter when the queue types it', async () => {
  const k = keeper()
  await k.agent.ensure()
  let busy = true
  k.deps.deliver = async (id, text) => { if (busy) return { state: 'failed_before_write', reason: 'readiness_timeout' }; k.delivered.push([id, text]); return { state: 'written' } }
  const png = Buffer.from('89504e470d0a1a0a', 'hex').toString('base64')
  assert.equal((await k.agent.send('see', [{ name: 'shot.png', data: png }])).queued, true)
  busy = false
  await k.agent.drain()
  const i = k.delivered.findIndex(([, t]) => t.startsWith('see'))
  assert.ok(i >= 0)
  assert.equal(k.delivered[i + 1]?.[1], 'raw:"\\r"')
})

test('run four: a pending file that does not parse is kept aside and recorded, never overwritten silently', () => {
  const k = keeper()
  writeFileSync(path.join(k.root, 'pending.json'), '[{"line":"x","at":')
  const again = createCeoAgent({ ...k.deps })
  assert.equal(again.status().queued, undefined)
  assert.ok(k.log.some(([op]) => op === 'ceo.agent.queue-read-failed'))
  assert.ok(readdirSync(k.root).some((f) => f.startsWith('pending.json.corrupt-')))
})

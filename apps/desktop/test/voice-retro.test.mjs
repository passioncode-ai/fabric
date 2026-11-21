// The voice CEO retro of 2026-11-20 (docs/reports/2026-11-20-voice-ceo-retro/): one test per finding, each on the real
// module the voice reaches, never a copy of its rule.
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, readFileSync, readdirSync, statSync, utimesSync, writeFileSync, mkdirSync, symlinkSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { findProject } from '../src/shared/ceoAgent.ts'
import { heardClose, heardKeys, nameKeys, soundKey } from '../src/shared/heardName.ts'
import { isScratchFolder } from '../src/shared/scratchFolder.ts'
import { createCeoOperations, ceoVoiceTools, VOICE_INPUTS, VOICE_REPEATS } from '../src/main/ceoTools.ts'
import { voiceInstructions, ASK_CEO_TOOL } from '../src/main/ceoVoice.ts'
import { createVoiceJournal, readCall, CALL_BYTES, KEEP_DAYS, KEEP_CALLS } from '../src/main/ceoVoiceJournal.ts'
import { assistantSince, createVoiceTools, VOICE_TOOLS } from '../src/main/ceoVoiceTools.ts'
import { createAliasStore, MAX_PER_PROJECT } from '../src/main/ceoProjectAliases.ts'
import { resolveAgentFolder, SCRATCH_FOLDER_MESSAGE } from '../src/main/sessionEnroll.ts'
import { backoffFor } from '../src/main/fabricMcp.ts'

const EM_DASH = String.fromCodePoint(0x2014)
// A credential shape Fabric's redaction knows (an Anthropic key), built so this file holds none.
const KEY = ['sk', 'ant', 'api03', 'A'.repeat(40)].join('-')

// ── finding 1: the call journal ──────────────────────────────────────────────

test('finding 1: a call is kept on disk, private, redacted, each tool tied to the turn that asked for it', () => {
  const folder = mkdtempSync(path.join(tmpdir(), 'voice-journal-'))
  let t = Date.parse('2026-11-20T12:15:00Z')
  const j = createVoiceJournal({ folder, now: () => t })
  const call = j.begin({ voice: 'ara', usdPerMinute: 0.08 })
  assert.equal(j.current(), call)
  j.line(call, 'person', `запусти клининг, ключ ${KEY}`)
  j.tool(call, 'session_start', { project: 'fabric', task: `use ${KEY}` }, { ok: false, reason: 'no project' }, 12)
  j.line(call, 'ceo', 'Не нашёл проект.')
  j.line(call, 'person', 'тогда спроси CEO')
  j.tool(call, 'ask_ceo', { text: 'clean' }, { ok: true }, 3)
  t += 90_000
  j.end(call, { minutes: 99, usd: 0.12, end: 'idle' })
  assert.equal(j.current(), null)

  const [file] = readdirSync(path.join(folder, 'calls'))
  const full = path.join(folder, 'calls', file)
  assert.equal(statSync(path.join(folder, 'calls')).mode & 0o777, 0o700)
  assert.equal(statSync(full).mode & 0o777, 0o600)
  const text = readFileSync(full, 'utf8')
  assert.ok(!text.includes(KEY), 'no credential reaches the disk')
  const rows = readCall(full)
  assert.deepEqual(rows.map((r) => r.kind), ['start', 'person', 'tool', 'ceo', 'person', 'tool', 'end'])
  assert.deepEqual(rows.filter((r) => r.kind === 'tool').map((r) => [r.name, r.turn, r.ok]), [['session_start', 1, false], ['ask_ceo', 2, true]])
  const end = rows.at(-1)
  // The window said 99 minutes; the wall clock since the secret was minted says 1.5: the journal keeps the bound.
  assert.equal(end.minutes, 1.5)
  assert.equal(end.turns, 2)
  assert.equal(end.tools, 2)
  assert.deepEqual(j.list(5).map((c) => [c.call, c.turns, c.tools, c.end]), [[call, 2, 2, 'idle']])
})

test('finding 1: a call is bounded, an unknown call is dropped, old calls are pruned and nothing else is touched', () => {
  const folder = mkdtempSync(path.join(tmpdir(), 'voice-journal-'))
  const j = createVoiceJournal({ folder })
  j.line('nope', 'person', 'lost')
  const call = j.begin({ voice: 'eve', usdPerMinute: 0.08 })
  for (let i = 0; i < 700; i++) j.line(call, 'ceo', 'x'.repeat(4000))
  j.end(call, { minutes: 1, usd: 0.08, end: null })
  const file = path.join(folder, 'calls', readdirSync(path.join(folder, 'calls'))[0])
  const rows = readCall(file)
  assert.ok(statSync(file).size <= CALL_BYTES + 10_000)
  assert.equal(rows.filter((r) => r.kind === 'cut').length, 1)
  assert.equal(rows.at(-1).kind, 'end', 'the end is written past the cut')
  const old = path.join(folder, 'calls', '2026-09-01T00-00-00-000Z-aaaaaaaa.jsonl')
  writeFileSync(old, '{}\n')
  const past = Date.now() / 1000 - (KEEP_DAYS + 1) * 86_400
  utimesSync(old, past, past)
  writeFileSync(path.join(folder, 'calls', 'notes.txt'), 'kept')
  assert.equal(j.prune(), 1)
  assert.deepEqual(readdirSync(path.join(folder, 'calls')).sort(), [path.basename(file), 'notes.txt'].sort())
})

// ── findings 2 and 3: the voice delegates ────────────────────────────────────

function ops(over = {}) {
  const writes = []
  const records = []
  const consoles = new Map([
    ['ceo', { sessionId: 'ceo', projectId: 'p0', cwd: '/c/ceo', optionId: 'claude-code', state: 'running', running: true, startedAt: 'x', lastActivityAt: 'x', tail: '' }],
    ['sh', { sessionId: 'sh', projectId: 'fab', cwd: '/d/fabric', optionId: 'shell', state: 'running', running: true, startedAt: 'x', lastActivityAt: 'x', tail: '%' }],
    ['ag', { sessionId: 'ag', projectId: 'fab', cwd: '/d/_worktrees/sound-engine-task-runner', optionId: 'claude-code', state: 'running', running: true, startedAt: 'x', lastActivityAt: 'x', tail: '>' }]
  ])
  const projects = [
    { id: 'dis', name: 'dissy', repo_path: '/d/dissy', default_agent: null },
    { id: 'ps', name: 'playtune', repo_path: '/d/playtune', default_agent: null },
    { id: 'se', name: 'sound-engine', repo_path: '/d/sound-engine', default_agent: null },
    { id: 'swarm', name: 'sound-engine-copy-a', repo_path: '/d/_worktrees/sound-engine-copy-a', default_agent: null },
    { id: 'fab', name: 'fabric', repo_path: '/d/fabric', default_agent: null },
    { id: 'fsw', name: 'fabric-switchboard', repo_path: '/d/fabric-switchboard', default_agent: null },
    { id: 'db', name: 'fabric-agents-database', repo_path: '/d/fabric-agents-database', default_agent: null },
    { id: 'dbc', name: 'fabric-agents-database', repo_path: '/Users/example/.cache/fabric-agents-database', default_agent: null }
  ]
  const aliases = {}
  const deps = {
    ptys: { list: () => [...consoles.values()], get: (id) => consoles.get(id) ?? null, scrollbackOf: () => ({ text: 'ready\r\n' }), write: (id, d) => writes.push([id, d]) },
    ceoSessionId: () => 'ceo',
    projects: async () => projects.map((p) => (aliases[p.id] ? { ...p, aliases: aliases[p.id] } : p)),
    admitFolder: async (folder) => ({ id: 'new', name: path.basename(folder), repo_path: folder }),
    openConsole: async (projectId, runner, task) => ({ sessionId: 'started', projectId, cwd: '/d/x', optionId: runner, state: 'starting', running: true }),
    stop: async () => ({ state: 'stopped' }),
    openWindow: () => {},
    switchboard: async () => null,
    signal: () => {},
    record: (op, d) => records.push([op, d]),
    note: () => {},
    sleep: async () => {},
    transcriptRoots: [],
    saveAlias: async (id, a) => { (aliases[id] ??= []).push(a); return aliases[id] },
    scratch: over.scratch ?? (() => false),
    launches: async () => over.launches ?? [],
    ...(over.firstTask ? { firstTask: over.firstTask } : {})
  }
  return { ops: createCeoOperations(deps), writes, records, consoles }
}

test('findings 2, 3: the voice types into a shell at most three times and into an agent six, then is told to delegate', async () => {
  const o = ops()
  for (let i = 0; i < VOICE_INPUTS.shell; i++) assert.equal((await o.ops.run('input', { session_id: 'sh', text: `ls ${i}`, reason: 'look' }, 'voice')).ok, true)
  const r = await o.ops.run('input', { session_id: 'sh', text: 'cat x', reason: 'debug' }, 'voice')
  assert.equal(r.ok, false)
  assert.match(r.reason, /doing the work by hand/)
  assert.match(r.next, /session_start/)
  for (let i = 0; i < VOICE_INPUTS.agent; i++) assert.equal((await o.ops.run('input', { session_id: 'ag', text: '1', reason: 'pick' }, 'voice')).ok, true)
  assert.equal((await o.ops.run('input', { session_id: 'ag', text: '2', reason: 'pick' }, 'voice')).ok, false)
  // The CEO's console door is not the voice: it is not limited.
  for (let i = 0; i < 8; i++) assert.equal((await o.ops.run('input', { session_id: 'sh', text: 'pwd', reason: 'look' }, 'console')).ok, true)
})

test('findings 2, 3, 6, 7, 8: the voice is told to delegate, never a shell for work, and how to find a name once', () => {
  for (const locale of ['ru', 'en']) {
    const text = voiceInstructions(locale)
    assert.ok(!text.includes(EM_DASH), `${locale}: no em dash`)
    for (const word of ['runner shell', 'session_start', 'ask_ceo', 'ceo_reply', 'session_projects', 'session_alias', 'is_ceo', 'machine_status', 'board_search', 'recap'])
      assert.ok(text.includes(word), `${locale} instructions name ${word}`)
  }
  assert.match(ASK_CEO_TOOL.description, /ceo_reply/)
})

// ── finding 4: names heard by voice ──────────────────────────────────────────

test('finding 4: a name heard by voice is found by sound, Cyrillic or Latin, a spelt acronym, and an alias', async () => {
  const o = ops()
  const all = await (async () => (await o.ops.run('projects', {})).projects)()
  const ps = all.map((p) => ({ id: p.id, name: p.name, repo_path: p.folder }))
  for (const [heard, id] of [['DC', 'dis'], ['Диззи', 'dis'], ['ПлейТюн', 'ps'], ['Саунд энджин', 'se'], ['фабрик', 'fab'], ['свитчборд', 'fsw']]) {
    const r = findProject(ps, heard)
    assert.equal(r.found?.id, id, `${heard} → ${id}: ${JSON.stringify(r)}`)
  }
  assert.equal(findProject(ps, 'Диззи').heard, true, 'a match by sound says so')
  // «диск» is not «dissy»: four letters must sound the same.
  const disk = findProject(ps, 'диск')
  assert.equal(disk.missing, true)
  // A name the owner gave is kept and found.
  assert.equal((await o.ops.run('alias', { project: 'dissy', alias: 'Дисси бэк', reason: 'the owner said so' })).ok, true)
  // Heard a little otherwise («бек» for «бэк»): found by sound, and the answer says which project it understood.
  const withAlias = (await o.ops.run('projects', { query: 'дисси бек' }))
  assert.deepEqual(withAlias.projects.map((p) => p.id), ['dis'])
  assert.equal(withAlias.understood_as, 'dissy')
})

test('finding 4: a worktree folder is found through its project, the home folder is no project, a cache copy gives way', () => {
  const ps = [
    { id: 'se', name: 'sound-engine', repo_path: '/Users/example/DATA/sound-engine' },
    { id: 'fab', name: 'fabric', repo_path: '/Users/example/DATA/fabric' },
    { id: 'db', name: 'fabric-agents-database', repo_path: '/Users/example/DATA/fabric-agents-database' },
    { id: 'dbc', name: 'fabric-agents-database', repo_path: '/Users/example/.cache/fabric-agents-database' }
  ]
  const folders = [{ path: '/Users/example/DATA/_worktrees/sound-engine-task-runner', projectId: 'se' }]
  assert.equal(findProject(ps, 'sound-engine-task-runner', folders).found.id, 'se')
  assert.equal(findProject(ps, '_worktrees/sound-engine-task-runner', folders).found.id, 'se')
  assert.equal(findProject(ps, '/Users/example/DATA/_worktrees/sound-engine-task-runner', folders).found.id, 'se')
  assert.equal(findProject(ps, '/Users/example/DATA/fabric/apps/desktop').found.id, 'fab', 'a folder inside a project is that project')
  const home = findProject(ps, '/Users/example')
  assert.equal(home.missing, true)
  assert.equal(home.why, 'too-broad')
  // A project whose folder IS the home folder holds no new folder under it (0.3.27 review, DO-1).
  const withHome = [...ps, { id: 'home', name: 'home', repo_path: '/Users/example' }]
  assert.equal(findProject(withHome, '/Users/example/DATA/newthing').missing, true)
  assert.equal(findProject(withHome, '/Users/example/DATA/fabric/apps').found.id, 'fab')
  assert.equal(findProject(ps, 'fabric-agents-database').found.id, 'db')
})

// ── findings 6 and 8: the CEO's console, and refusals that help ──────────────

test('finding 6: the voice typing into the CEO\'s own console is sent to ask_ceo', async () => {
  const o = ops()
  const r = await o.ops.run('input', { session_id: 'ceo', text: 'hello', reason: 'talk' }, 'voice')
  assert.equal(r.ok, false)
  assert.match(r.reason, /ask_ceo/)
  assert.equal(o.writes.length, 0)
})

test('finding 8: a missed name answers the nearest names, several ask for a choice of three, repeats are told to stop', async () => {
  const o = ops()
  const near = await o.ops.run('launches', { project: 'digest' }, 'voice')
  assert.equal(near.ok, false)
  assert.ok(Array.isArray(near.near) && near.near.length > 0 && near.near.length <= 3, JSON.stringify(near))
  assert.match(near.next, /near names|projects/)
  const several = await o.ops.run('start', { project: 'fabr', task: 'go', reason: 'the owner asked' }, 'voice')
  assert.equal(several.ok, false)
  assert.ok(several.choices?.length >= 2 && several.choices.length <= 3, JSON.stringify(several))
  assert.match(several.next, /ask the owner/)
  let last
  for (let i = 0; i < VOICE_REPEATS; i++) last = await o.ops.run('launches', { project: `zz${i}` }, 'voice')
  assert.match(last.stop, /stop trying/)
  // A tie asks the owner; asking is no failed guess, so three ties never say stop (0.3.27 review, PL-5).
  const ties = ops()
  let tie
  for (let i = 0; i < VOICE_REPEATS + 1; i++) tie = await ties.ops.run('start', { project: 'fabr', task: 'go', reason: 'the owner asked' }, 'voice')
  assert.equal(tie.stop, undefined)
  assert.ok(tie.choices.length >= 2)
})

// ── finding 5: caches and temporary folders are no projects ──────────────────

test('finding 5: a cache or temporary folder is scratch; a project folder is not', () => {
  for (const p of ['/Users/example/.cache/board-submit', '/Users/example/Library/Caches/x', '/private/tmp', '/tmp/a', '/private/var/folders/3r/ab/T/tmp.MILK'])
    assert.equal(isScratchFolder(p), true, p)
  for (const p of ['/Users/example/DATA/fabric', '/Users/example/DATA/_worktrees/fabric-voice-retro', '/Users/example/.cachet', '/Users/example'])
    assert.equal(isScratchFolder(p), false, p)
  assert.equal(isScratchFolder('/x/T/probe', '/Users/example', '/x/T'), true, 'the system temporary folder given')
})

test('finding 5: enrollment refuses a scratch folder for good, the CEO\'s start refuses it, a lookup prefers the real copy', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'scratch-probe-'))
  mkdirSync(path.join(dir, 'src'))
  const r = await resolveAgentFolder(dir, {
    admittedFolders: async () => [], realpath: (f) => f, gitCommonDir: () => null, home: '/Users/example',
    inspectFolder: async () => ({ git: false }), projectIdForFolder: () => 'pid', scratch: (f) => isScratchFolder(f, '/Users/example', path.dirname(dir))
  })
  assert.equal(r.ok, false)
  assert.equal(r.message, SCRATCH_FOLDER_MESSAGE)
  assert.ok(backoffFor('no-project', 4, SCRATCH_FOLDER_MESSAGE) > backoffFor('no-project', 1, SCRATCH_FOLDER_MESSAGE), 'refused for longer each time, like a too-broad folder')
  const o = ops({ scratch: (f) => isScratchFolder(f, '/Users/example', path.dirname(dir)) })
  const s = await o.ops.run('start', { project: dir, reason: 'a probe' }, 'voice')
  assert.equal(s.ok, false)
  assert.match(s.reason, /cache or temporary/)
})

// ── finding 7 and 10: the voice's own tools ──────────────────────────────────

test('finding 7: ceo_reply waits for the CEO\'s answer after the ask, says still working, and needs an ask first', async () => {
  const asked = Date.parse('2026-11-20T13:00:00Z')
  const jsonl = [
    { type: 'assistant', timestamp: '2026-11-20T12:59:00Z', message: { content: [{ type: 'text', text: 'old answer' }] } },
    { type: 'user', timestamp: '2026-11-20T13:00:01Z', message: { content: 'clean the disk' } },
    { type: 'assistant', timestamp: '2026-11-20T13:00:05Z', message: { content: [{ type: 'tool_use', name: 'x' }, { type: 'text', text: `Started the cleaning. ${KEY}` }] } }
  ].map((r) => JSON.stringify(r)).join('\n')
  assert.deepEqual(assistantSince(jsonl, asked).turns, 1)
  let t = asked + 10_000
  const base = { now: () => t, sleep: async (ms) => { t += ms }, ceoScreen: () => 'screen', machine: () => ({}), consolesRunning: () => 1, boardSearch: async () => ({ ok: true, hits: [], more: false }), launches: async () => [], previousCallEnd: () => null, projectNames: async () => new Map() }
  const none = createVoiceTools({ ...base, askedAt: () => null, ceoTranscript: async () => jsonl, ceoLastActivity: () => t })
  assert.equal((await none.run('ceo_reply', {})).ok, false)
  const quiet = createVoiceTools({ ...base, askedAt: () => asked, ceoTranscript: async () => jsonl, ceoLastActivity: () => asked + 5000 })
  const a = await quiet.run('ceo_reply', {})
  assert.equal(a.state, 'answered')
  assert.match(a.answer, /Started the cleaning/)
  assert.ok(!a.answer.includes(KEY) && !a.answer.includes('old answer'))
  const busy = createVoiceTools({ ...base, askedAt: () => asked, ceoTranscript: async () => jsonl, ceoLastActivity: () => t })
  const b = await busy.run('ceo_reply', { wait_seconds: 3 })
  assert.equal(b.state, 'still_working')
})

test('finding 10: the voice\'s tools: machine, board, recap since the last call, a task check; each said as a tool', async () => {
  assert.deepEqual(VOICE_TOOLS.map((t) => t.name), ['ceo_reply', 'machine_status', 'board_search', 'recap'])
  for (const t of VOICE_TOOLS) assert.ok(!t.description.includes(EM_DASH))
  const tools = createVoiceTools({
    askedAt: () => null, ceoTranscript: async () => null, ceoScreen: () => '', ceoLastActivity: () => null,
    machine: () => ({ diskFreeGb: 120.5, diskTotalGb: 994.7, load1: 3.456, cpus: 12, memFreeGb: 4.1, memTotalGb: 64, uptimeHours: 50.2 }),
    consolesRunning: () => 3,
    claudeSessions: async () => 17,
    boardSearch: async (q) => (q === 'down' ? { ok: false, reason: 'unavailable' } : { ok: true, more: false, hits: [{ at: 't', subject: 'S', snippet: `ask ${KEY}`, participants: ['a'] }] }),
    launches: async () => [
      { sessionId: 'n1', projectId: 'p', cwd: '/d/p', optionId: 'claude-code', by: 'ceo', via: 'voice', reason: 'r', startedAt: '2026-11-20T13:10:00Z', endedAt: null, end: null, exitCode: null },
      { sessionId: 'o1', projectId: 'p', cwd: '/d/p', optionId: 'shell', by: 'ceo', via: 'voice', reason: 'r', startedAt: '2026-11-20T11:00:00Z', endedAt: '2026-11-20T13:20:00Z', end: 'stopped', exitCode: 0 }
    ],
    previousCallEnd: () => '2026-11-20T13:00:00Z',
    projectNames: async () => new Map([['p', 'Proj']])
  })
  const m = await tools.run('machine_status', {})
  assert.deepEqual([m.disk_free_gb, m.load_1min, m.fabric_consoles_running, m.claude_code_sessions], [120.5, 3.46, 3, 17])
  const b = await tools.run('board_search', { query: 'ask' })
  assert.ok(!JSON.stringify(b).includes(KEY))
  assert.equal((await tools.run('board_search', { query: 'down' })).ok, false, 'an unread board is said, never an empty result')
  const r = await tools.run('recap', {})
  assert.deepEqual(r.started.map((x) => x.session_id), ['n1'])
  assert.deepEqual(r.ended.map((x) => [x.session_id, x.end, x.project]), [['o1', 'stopped', 'Proj']])
  assert.equal(r.since_is, 'the previous call')
  assert.equal(await tools.run('session_read', {}), null, 'not one of these: the caller tries the session tools')
  const o = ops({ firstTask: () => new Promise(() => {}) })
  const task = await o.ops.run('task', { session_id: 'ag' }, 'voice')
  assert.equal(task.first_task.state, 'pending')
  assert.equal(typeof task.screen, 'string')
})

test('finding 4: the alias file keeps names whole, private, once each, at most ten a project', () => {
  const folder = mkdtempSync(path.join(tmpdir(), 'aliases-'))
  const store = createAliasStore(folder)
  assert.deepEqual(store.read(), {})
  store.add('dis', 'Диззи')
  store.add('dis', 'диззи')
  assert.deepEqual(store.add('dis', '  Дисси   бэк '), ['Диззи', 'Дисси бэк'])
  for (let i = 0; i < 15; i++) store.add('ps', `name ${i}`)
  assert.equal(store.read().ps.length, MAX_PER_PROJECT)
  assert.equal(store.read().ps.at(-1), 'name 14')
  assert.equal(statSync(path.join(folder, 'project-aliases.json')).mode & 0o777, 0o600)
  writeFileSync(path.join(folder, 'project-aliases.json'), '{broken')
  assert.deepEqual(store.read(), {}, 'an unreadable file reads as none, never a throw')
})

test('heard names: keys stay stable for the cases the retro measured', () => {
  assert.equal(soundKey('Диззи'), soundKey('dissy'))
  assert.ok(heardKeys('DC').includes(soundKey('dissy')))
  assert.ok(nameKeys('project-observatory', null).includes(soundKey('observatory')))
  assert.equal(heardClose(soundKey('диск'), soundKey('dissy')), false)
})

// ── the 0.3.27 review, iteration 1 ───────────────────────────────────────────

test('UX-1, UX-9: a name matched by sound is asked back; nothing starts and no alias is kept on a guess', async () => {
  const opened = []
  const o = ops()
  const r = await o.ops.run('start', { project: 'Диззи', task: 'run the audit', reason: 'the owner asked' }, 'voice')
  assert.equal(r.ok, false)
  assert.equal(r.understood_as, 'dissy')
  assert.deepEqual(r.choices, ['dissy'])
  assert.match(r.next, /call again with the name dissy/)
  const exact = await o.ops.run('start', { project: 'dissy', task: 'run the audit', reason: 'the owner asked' }, 'voice')
  assert.equal(exact.ok, true)
  assert.equal((await o.ops.run('alias', { project: 'Диззи', alias: 'дизи', reason: 'the owner said so' })).ok, false)
  void opened
})

test('UX-2: a folder inside a project or its worktree is not where a start would open: refused, never run elsewhere', async () => {
  const o = ops({ launches: [{ cwd: '/d/_worktrees/sound-engine-task-runner', projectId: 'se' }] })
  const sub = await o.ops.run('start', { project: '/d/fabric/apps', task: 'go', reason: 'the owner asked' }, 'voice')
  assert.equal(sub.ok, false)
  assert.match(sub.reason, /belongs to the project fabric/)
  const wt = await o.ops.run('start', { project: '/d/_worktrees/sound-engine-task-runner', task: 'go', reason: 'the owner asked' }, 'voice')
  assert.equal(wt.ok, false)
  assert.match(wt.next, /an agent works in that folder|call again with the name/)
})

test('UX-3: a choice read back as offered, «name (folder)», picks that project', () => {
  const ps = [{ id: 'r1', name: 'research-agent', repo_path: '/d/research-agent' }, { id: 'r2', name: 'research-agent', repo_path: '/d/x/research-agent' }]
  const tie = findProject(ps, 'research-agent')
  assert.ok(tie.ambiguous)
  assert.equal(findProject(ps, tie.ambiguous[1]).found.id, 'r2')
})

test('UX-4: the project list hides a worktree copy when the project of its name is listed', async () => {
  const o = ops()
  const r = await o.ops.run('projects', { query: 'fabric-agents-database' }, 'voice')
  assert.deepEqual(r.projects.map((p) => p.id), ['db'])
  assert.equal(r.copies_hidden, 1)
})

test('UX-5, ER-1: a worktree is found by its last words; a far name is never «near»; a launch in home claims no folder', async () => {
  const ps = [{ id: 'se', name: 'sound-engine', repo_path: '/Users/example/DATA/sound-engine' }, { id: 'notes', name: 'notes', repo_path: null }]
  const folders = [{ path: '/Users/example/DATA/_worktrees/sound-engine-task-runner', projectId: 'se' }]
  assert.equal(findProject(ps, 'task-runner', folders).found.id, 'se')
  assert.deepEqual(findProject(ps, 'Банк').near, [])
  const o = ops({ launches: [{ cwd: '/Users/example', projectId: 'fab' }] })
  const r = await o.ops.run('sessions', { project: '/Users/example/DATA/other' }, 'voice')
  assert.equal(r.ok, false, 'a launch that ran in the home folder makes no folder under home that project')
})

test('UX-6: by voice a start answers pending after a short wait and points at session_task', async () => {
  const o = ops({ firstTask: () => new Promise(() => {}) })
  const t0 = Date.now()
  const r = await o.ops.run('start', { project: 'dissy', task: 'go', reason: 'the owner asked' }, 'voice')
  assert.ok(Date.now() - t0 < 15_000)
  assert.equal(r.first_task.state, 'pending')
  assert.match(r.first_task.next, /session_task/)
})

test('UX-7: the voice\'s tool descriptions name its own tools, never the console\'s MCP names', () => {
  for (const t of ceoVoiceTools()) assert.ok(!/fabric_ceo_/.test(t.description), t.name)
})

test('UX-9: another project\'s name is never an alias; a wrong alias can be forgotten', async () => {
  const o = ops()
  assert.match((await o.ops.run('alias', { project: 'dissy', alias: 'playtune', reason: 'the owner said so' })).reason, /name of the project playtune/)
  assert.equal((await o.ops.run('alias', { project: 'dissy', alias: 'бэкенд', reason: 'the owner said so' })).ok, true)
})

test('UX-13, ER-9: «~» is the home folder; one worktree under a folder does not make it too broad', async () => {
  const ps = [{ id: 'fab', name: 'fabric', repo_path: '/d/fabric' }, { id: 'wt', name: 'x', repo_path: '/d/fabric/.claude/worktrees/x' }]
  assert.notEqual(findProject(ps, '/d').why, 'too-broad')
  const o = ops()
  const r = await o.ops.run('sessions', { project: '~' }, 'voice')
  assert.equal(r.ok, false)
})

test('UX-14, ER-6: ceo_reply skips the end of a previous answer; a CEO console that does not run is said', async () => {
  const asked = Date.parse('2026-11-20T13:00:00Z')
  const jsonl = [
    { type: 'assistant', timestamp: '2026-11-20T13:00:01Z', message: { content: [{ type: 'text', text: 'the end of the previous answer' }] } },
    { type: 'user', timestamp: '2026-11-20T13:00:03Z', message: { content: 'clean the disk' } },
    { type: 'assistant', timestamp: '2026-11-20T13:00:06Z', message: { content: [{ type: 'text', text: 'Cleaning now.' }] } }
  ].map((r) => JSON.stringify(r)).join('\n')
  const got = assistantSince(jsonl, asked)
  assert.equal(got.text, 'Cleaning now.')
  let t = asked + 20_000
  const off = createVoiceTools({ now: () => t, sleep: async (ms) => { t += ms }, askedAt: () => asked, ceoTranscript: async () => jsonl, ceoScreen: () => '', ceoLastActivity: () => null, machine: () => ({}), consolesRunning: () => 0, boardSearch: async () => ({ ok: true, hits: [], more: false }), launches: async () => [], previousCallEnd: () => null, projectNames: async () => new Map() })
  assert.match((await off.run('ceo_reply', {})).reason, /not running/)
})

test('DA-1, DA-2: a secret on a later line of a tool argument is cut; the cap counts bytes', () => {
  const folder = mkdtempSync(path.join(tmpdir(), 'voice-journal-'))
  const j = createVoiceJournal({ folder })
  const call = j.begin({ voice: 'ara', usdPerMinute: 0.08 })
  j.tool(call, 'session_start', { task: 'ls\nDATABASE_PASSWORD=hunter2xyz99\nok' }, { ok: true, said: 'ls\napi_key: abcdefghijklmnop1234' }, 1)
  for (let i = 0; i < 400; i++) j.line(call, 'ceo', 'ж'.repeat(4000))
  j.end(call, { minutes: 1, usd: 0.08, end: null })
  const file = path.join(folder, 'calls', readdirSync(path.join(folder, 'calls'))[0])
  const text = readFileSync(file, 'utf8')
  assert.ok(!text.includes('hunter2xyz99') && !text.includes('abcdefghijklmnop1234'), 'redacted field by field')
  assert.ok(statSync(file).size <= CALL_BYTES + 20_000, `bytes, not characters: ${statSync(file).size}`)
})

test('DA-3, ER-2, ER-4: a tool lands in the call that asked; a left call is ended with its measured length; orphans too', () => {
  const folder = mkdtempSync(path.join(tmpdir(), 'voice-journal-'))
  let t = Date.parse('2026-11-20T12:00:00Z')
  const j = createVoiceJournal({ folder, now: () => t })
  const a = j.begin({ voice: 'ara', usdPerMinute: 0.08 })
  t += 60_000
  j.line(a, 'person', 'hello')
  t += 60_000
  j.closeLeft(a)
  const b = j.begin({ voice: 'ara', usdPerMinute: 0.08 })
  j.tool(a, 'ceo_reply', {}, { ok: true }, 5)
  const byCall = Object.fromEntries(j.list(5).map((c) => [c.call, c]))
  assert.equal(byCall[a].tools, 1)
  assert.equal(byCall[b].tools, 0)
  assert.equal(byCall[a].minutes, 1, 'measured to its last line, never 0')
  assert.equal(byCall[a].end, 'not-closed')
  // A run that quit mid-call: the next start ends it.
  const again = createVoiceJournal({ folder, now: () => t })
  assert.equal(again.closeOrphans(), 1)
  assert.equal(again.list(5).find((c) => c.call === b).end, 'not-closed')
})

test('DA-4: the folder keeps at most KEEP_CALLS calls, the oldest go first, at every new call', () => {
  const folder = mkdtempSync(path.join(tmpdir(), 'voice-journal-'))
  mkdirSync(path.join(folder, 'calls'), { recursive: true })
  for (let i = 0; i < KEEP_CALLS + 3; i++) writeFileSync(path.join(folder, 'calls', `2026-11-01T00-${String(Math.floor(i / 60)).padStart(2, '0')}-${String(i % 60).padStart(2, '0')}-000Z-aaaaaaaa.jsonl`), '{}\n')
  const j = createVoiceJournal({ folder })
  j.begin({ voice: 'ara', usdPerMinute: 0.08 })
  const left = readdirSync(path.join(folder, 'calls')).filter((n) => n.endsWith('.jsonl'))
  assert.ok(left.length <= KEEP_CALLS, `${left.length}`)
  assert.ok(!left.includes('2026-11-01T00-00-00-000Z-aaaaaaaa.jsonl'), 'the oldest went first')
})

test('DA-7, ER-10: a scratch clone of a known repository is not attached to its project', async () => {
  const r = await resolveAgentFolder('/private/tmp/clone-of-fabric', {
    admittedFolders: async () => [{ projectId: 'fab', path: '/Users/example/DATA/fabric', remoteKey: 'github.com/acme/fabric' }],
    realpath: (f) => f, gitCommonDir: () => null, home: '/Users/example',
    remoteOf: async () => 'git@github.com:acme/fabric.git', gitTopLevel: async (f) => f,
    inspectFolder: async () => ({ git: true }), projectIdForFolder: () => 'pid', scratch: (f) => isScratchFolder(f)
  })
  assert.equal(r.ok, false)
  assert.equal(r.message, SCRATCH_FOLDER_MESSAGE)
})

test('0.3.27 review PL-9: a project\'s own folder finds it, right under home or with a registered worktree below it', () => {
  const ps = [
    { id: 'my', name: 'myapp', repo_path: '/Users/example/myapp' },
    { id: 'fab', name: 'fabric', repo_path: '/Users/example/DATA/fabric' },
    { id: 'wt', name: 'x', repo_path: '/Users/example/DATA/fabric/.claude/worktrees/x' },
    { id: 'mono', name: 'mono', repo_path: '/Users/example/DATA/mono' },
    { id: 'pkg', name: 'pkg', repo_path: '/Users/example/DATA/mono/packages/pkg' }
  ]
  for (const [folder, id] of [['/Users/example/myapp', 'my'], ['/Users/example/DATA/fabric', 'fab'], ['/Users/example/DATA/mono', 'mono'], ['/Users/example/DATA/fabric/apps/desktop', 'fab']])
    assert.equal(findProject(ps, folder).found?.id, id, folder)
})

test('0.3.27 review UX-15, UX-17, UX-21: a worktree named by its folder name starts nothing; a tool result opens no answer; an exact folder is not «understood»', async () => {
  const o = ops({ launches: [{ cwd: '/d/_worktrees/sound-engine-voice-runner', projectId: 'se' }] })
  const r = await o.ops.run('start', { project: 'voice runner', task: 'go', reason: 'the owner asked' }, 'voice')
  assert.equal(r.ok, false)
  assert.match(r.reason, /belongs to the project sound-engine/)
  const asked = Date.parse('2026-11-20T13:00:06Z')
  const jsonl = [
    { type: 'assistant', timestamp: '2026-11-20T12:59:59Z', message: { content: [{ type: 'tool_use', name: 'x' }] } },
    { type: 'user', timestamp: '2026-11-20T13:00:05Z', message: { content: [{ type: 'tool_result', content: 'ok' }] } },
    { type: 'assistant', timestamp: '2026-11-20T13:00:05.500Z', message: { content: [{ type: 'text', text: 'PREVIOUS answer' }] } },
    { type: 'user', timestamp: '2026-11-20T13:00:07Z', message: { content: 'how many sessions' } },
    { type: 'assistant', timestamp: '2026-11-20T13:00:09Z', message: { content: [{ type: 'text', text: 'THIS answer' }] } }
  ].map((x) => JSON.stringify(x)).join('\n')
  assert.equal(assistantSince(jsonl, asked).text, 'THIS answer')
  const p = await o.ops.run('projects', { query: '/d/fabric' }, 'voice')
  assert.deepEqual(p.projects.map((x) => x.id), ['fab'])
  assert.equal(p.understood_as, undefined)
  const sound = await o.ops.run('projects', { query: 'sound engine' }, 'voice')
  assert.deepEqual(sound.projects.map((x) => x.id), ['se'], 'the swarm worktree copy gives way (UX-16)')
})

test('0.3.27 review DA-13, DA-15: only call files are touched, links never; a key is redacted like a value', () => {
  const folder = mkdtempSync(path.join(tmpdir(), 'voice-journal-'))
  mkdirSync(path.join(folder, 'calls'), { recursive: true })
  writeFileSync(path.join(folder, 'calls', 'notes.jsonl'), '{"a":1}\n')
  const outside = path.join(folder, 'outside.jsonl')
  writeFileSync(outside, '{"kind":"start"}\n')
  symlinkSync(outside, path.join(folder, 'calls', '2026-11-20T10-00-00-000Z-bbbbbbbb.jsonl'))
  const j = createVoiceJournal({ folder })
  assert.equal(j.closeOrphans(), 0)
  assert.equal(readFileSync(outside, 'utf8'), '{"kind":"start"}\n', 'a linked file is never written')
  assert.equal(readFileSync(path.join(folder, 'calls', 'notes.jsonl'), 'utf8'), '{"a":1}\n')
  assert.deepEqual(j.list(10).map((c) => c.file), [], 'a stray .jsonl is no call (recap reads the newest call)')
  const call = j.begin({ voice: 'ara', usdPerMinute: 0.08 })
  j.tool(call, 'x', { ['ls\nPASSWORD=hunter2xyz99Q']: 1 }, { ok: true }, 1)
  j.end(call, { minutes: 0, usd: 0, end: null })
  const own = readdirSync(path.join(folder, 'calls')).find((n) => n !== 'notes.jsonl' && !n.includes('bbbbbbbb'))
  assert.ok(!readFileSync(path.join(folder, 'calls', own), 'utf8').includes('hunter2xyz99Q'))
})

test('0.3.27 review ER-16, ER-21, DA-18: the ask\'s echo is no answer; a name never kept is not «forgotten»; a bad aliases file is kept aside', async () => {
  const asked = Date.parse('2026-11-20T13:00:00Z')
  let t = asked + 5000
  const v = createVoiceTools({ now: () => t, sleep: async (ms) => { t += ms }, askedAt: () => asked, ceoTranscript: async () => null, ceoScreen: () => 'the ask', ceoLastActivity: () => asked + 300, machine: () => ({}), consolesRunning: () => 1, boardSearch: async () => ({ ok: true, hits: [], more: false }), launches: async () => [], previousCallEnd: () => null, projectNames: async () => new Map() })
  assert.equal((await v.run('ceo_reply', { wait_seconds: 3 })).state, 'still_working')
  const o = ops()
  assert.equal((await o.ops.run('alias', { project: 'dissy', alias: 'никогда', remove: true, reason: 'the owner said so' })).ok, false)
  const folder = mkdtempSync(path.join(tmpdir(), 'aliases-'))
  writeFileSync(path.join(folder, 'project-aliases.json'), '{broken')
  const store = createAliasStore(folder)
  store.add('dis', 'Диззи')
  assert.ok(readdirSync(folder).some((n) => n.startsWith('project-aliases.json.bad-')), 'the unreadable file is kept aside, not overwritten')
  assert.deepEqual(store.read(), { dis: ['Диззи'] })
  void existsSync
})

test('0.3.27 review, iteration 3 run one: a folder lists its projects; a worktree is marked in the list; an exact name comes first; no home project; the calls folder is never a link', async () => {
  const o = ops({ launches: [{ cwd: '/d/_worktrees/sound-engine-voice-runner', projectId: 'se' }] })
  const inD = await o.ops.run('projects', { query: '/d' }, 'voice')
  assert.ok(inD.projects.length >= 5, 'UX-25, PL-15: a parent folder lists the projects in it')
  const wt = await o.ops.run('projects', { query: 'voice runner' }, 'voice')
  assert.equal(wt.worktree, '/d/_worktrees/sound-engine-voice-runner', 'UX-26')
  assert.match(wt.next, /worktree of sound-engine/)
  const ex = await o.ops.run('projects', { query: 'fabric' }, 'voice')
  assert.equal(ex.projects[0].id, 'fab', 'UX-30')
  assert.equal(ex.exact, 'fabric')
  const review = findProject([{ id: 'f', name: 'fabric', repo_path: '/d/fabric' }, { id: 'rb', name: 'code-review-bot', repo_path: '/d/code-review-bot' }], 'review', [{ path: '/d/_worktrees/fabric-0327-review', projectId: 'f' }])
  assert.equal(review.found?.id, 'rb', 'ER-23, UX-28: the words win over a worktree\'s last words')
  const home = findProject([{ id: 'h', name: 'notes', repo_path: '/Users/example' }, { id: 'f', name: 'fabric', repo_path: '/Users/example/DATA/fabric' }], '/Users/example')
  assert.equal(home.found, undefined, 'ER-28, DO-22: the home folder finds no project')
  const mono = [{ id: 'm', name: 'mono', repo_path: '/Users/example/DATA/mono' }, { id: 'p', name: 'pkg', repo_path: '/Users/example/DATA/mono/packages/pkg' }, { id: 'my', name: 'myapp', repo_path: '/Users/example/myapp' }]
  assert.equal(findProject(mono, '/Users/example/DATA/mono/docs').found?.id, 'm', 'ER-24: a folder inside a project holding one other is that project')
  assert.equal(findProject(mono, '/Users/example/myapp/src').found?.id, 'my', 'ER-24: a folder inside a project right under home')
  const folder = mkdtempSync(path.join(tmpdir(), 'voice-journal-'))
  const elsewhere = mkdtempSync(path.join(tmpdir(), 'elsewhere-'))
  symlinkSync(elsewhere, path.join(folder, 'calls'))
  const failures = []
  const j = createVoiceJournal({ folder, failed: (what) => failures.push(what) })
  j.begin({ voice: 'ara', usdPerMinute: 0.08 })
  assert.deepEqual(readdirSync(elsewhere), [], 'DA-24: nothing is written through a linked folder')
  assert.deepEqual(failures, ['folder'])
})

test('0.3.27 review, iteration 3 run two: a worktree name never becomes an alias; a resume outside the project folder is refused with its id; the full worktree name and nested folders', async () => {
  const launches = [{ sessionId: 'w1', cwd: '/d/_worktrees/sound-engine-tune-runner', projectId: 'se', runnerSessionId: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa' }]
  const o = ops({ launches })
  const listed = await o.ops.run('projects', { query: 'tune runner' }, 'voice')
  assert.equal(listed.understood_as, undefined, 'UX-32: a worktree match carries no understood_as')
  assert.ok(listed.worktree)
  assert.equal((await o.ops.run('alias', { project: 'sound-engine', alias: 'tune runner', reason: 'the owner said yes' }, 'voice')).ok, false, 'UX-32: a worktree name is never kept')
  assert.equal((await o.ops.run('start', { project: 'tune runner', task: 'go', reason: 'the owner asked' }, 'voice')).ok, false)
  const ps = [{ id: 'f', name: 'fabric', repo_path: '/Users/example/DATA/fabric' }]
  const r = findProject(ps, 'fabric-data', [{ path: '/Users/example/DATA/_worktrees/fabric-data', projectId: 'f' }])
  assert.ok(r.worktree, 'ER-29: a worktree named in full is marked even when the words are in the project\'s path')
  const mono = [{ id: 'm', name: 'mono', repo_path: '/Users/example/DATA/mono' }, { id: 'a', name: 'a', repo_path: '/Users/example/DATA/mono/packages/a' }, { id: 'b', name: 'b', repo_path: '/Users/example/DATA/mono/packages/b' }]
  assert.equal(findProject(mono, '/Users/example/DATA/mono/docs').found?.id, 'm', 'ER-30: the deepest holder wins whatever it holds')
})

test('0.3.27 review PL-21, UX-35: a console that ran in a worktree is not resumed in the main folder; its Claude Code id is named', async () => {
  const fx = ops({ launches: [{ sessionId: 'ag', cwd: '/d/_worktrees/sound-engine-task-runner', projectId: 'fab', runnerSessionId: 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb' }] })
  // The fixture's console «ag» ran in a worktree folder of project fab and has ended.
  fx.consoles.get('ag').running = false
  const r = await fx.ops.run('resume', { session_id: 'ag', reason: 'the owner asked' }, 'voice')
  assert.equal(r.ok, false)
  assert.match(r.reason, /would open in the project's folder/)
  assert.match(r.next, /bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb/)
})

test('0.3.27 review ER-31, DA-27: a linked calls folder is neither pruned, ended nor listed', () => {
  const folder = mkdtempSync(path.join(tmpdir(), 'voice-journal-'))
  const elsewhere = mkdtempSync(path.join(tmpdir(), 'elsewhere-'))
  const old = path.join(elsewhere, '2026-09-01T00-00-00-000Z-cccccccc.jsonl')
  writeFileSync(old, '{"t":"2026-09-01T00:00:00.000Z","kind":"start","call":"c","voice":"a","usd_per_minute":0.08}\n')
  symlinkSync(elsewhere, path.join(folder, 'calls'))
  const j = createVoiceJournal({ folder })
  assert.equal(j.prune(), 0)
  assert.equal(j.closeOrphans(), 0)
  assert.deepEqual(j.list(5), [])
  assert.equal(readFileSync(old, 'utf8').split('\n').filter(Boolean).length, 1)
})

test('run five: ceo_reply says a queued ask waits and never asks for it again', async () => {
  const { createVoiceTools } = await import('../src/main/ceoVoiceTools.ts')
  const tools = createVoiceTools({ askedAt: () => 1, askWrittenAt: () => null, askWaiting: () => true, ceoTranscript: async () => null, ceoLastActivity: () => 1, ceoScreen: () => '', machine: async () => ({}), board: async () => ({}), recap: async () => ({}) })
  const r = await tools.run('ceo_reply', {})
  assert.equal(r.state, 'queued')
  assert.match(r.next, /do not ask again/)
})

test('run six: ceo_reply says a CEO that is not running first, and a broken-off write as unknown', async () => {
  const { createVoiceTools } = await import('../src/main/ceoVoiceTools.ts')
  const base = { askedAt: () => 1, askWrittenAt: () => null, askWaiting: () => true, ceoTranscript: async () => null, ceoScreen: () => '', machine: async () => ({}), board: async () => ({}), recap: async () => ({}) }
  const down = await createVoiceTools({ ...base, ceoLastActivity: () => null }).run('ceo_reply', {})
  assert.match(down.reason, /not running/)
  // Run seven (UX-61): the transcript is still read; with no answer by the deadline the doubt is said.
  const unknown = await createVoiceTools({ ...base, ceoTranscript: async () => '', askWaiting: () => false, askUnknown: () => true, ceoLastActivity: () => 1 }).run('ceo_reply', { wait_seconds: 0 })
  assert.equal(unknown.state, 'unknown')
})

test('run seven: while the CEO starts or switches runners, ceo_reply says it waits, never «start it»', async () => {
  const { createVoiceTools } = await import('../src/main/ceoVoiceTools.ts')
  const r = await createVoiceTools({ askedAt: () => 1, askWrittenAt: () => 2, ceoState: () => 'starting', ceoTranscript: async () => null, ceoLastActivity: () => null, ceoScreen: () => '', machine: async () => ({}), board: async () => ({}), recap: async () => ({}) }).run('ceo_reply', {})
  assert.equal(r.state, 'starting')
  assert.doesNotMatch(r.next, /start the CEO/)
})

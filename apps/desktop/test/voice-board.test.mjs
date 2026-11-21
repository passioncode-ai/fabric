// The owner, 2026-11-21 (~02:10): the CEO's voice reads Fabric's board itself, read-only, without the CEO's console:
// the newest projects with dates, a project's tasks with status and holder, a task's graph (goal, spawned, blocks,
// follows, what grew from it). And the words for the CEO itself («директор», «шеф», «босс», «менеджер», «главный»,
// «SEO» and its spellings) are the CEO, never a project or the SEO agent.
import assert from 'node:assert/strict'
import test from 'node:test'
import { createVoiceBoard, VOICE_BOARD_TOOLS } from '../src/main/voiceBoard.ts'
import { isCeoAddress, ceoAddressRule } from '../src/shared/ceoAddress.ts'

const P = (id, name, created_at, extra = {}) => ({ id, name, created_at, repo_path: `/d/${name}`, ...extra })
const T = (id, project_id, title, status, extra = {}) => ({ id, project_id, title, instruction: `${title} in full`, status, goal_id: null, started_at: '2026-11-20T10:00:00Z', finished_at: null, assigned_to: null, ...extra })

function reads(over = {}) {
  const projects = [P('p1', 'kira-agent', '2026-11-20T16:59:00Z'), P('p2', 'ai-image-maker-app', '2026-11-20T18:20:00Z'), P('p3', 'SSHLG MacBook Agent', '2026-11-20T18:51:00Z'), P('p4', 'dissy', '2026-11-01T09:00:00Z')]
  const tasks = [
    T('t-root', 'p4', 'Ship the store page', 'running', { goal_id: 'g1' }),
    T('t-a', 'p4', 'Write the listing copy', 'review'),
    T('t-b', 'p4', 'Make the screenshots', 'running'),
    T('t-c', 'p4', 'Translate the listing', 'backlog'),
    T('t-old', 'p4', 'Old idea', 'done', { finished_at: '2026-11-10T00:00:00Z' })
  ]
  const links = [
    { task_id: 't-a', rel: 'spawned', target_kind: 'task', target_id: 't-root' },
    { task_id: 't-b', rel: 'spawned', target_kind: 'task', target_id: 't-root' },
    { task_id: 't-c', rel: 'blocks', target_kind: 'task', target_id: 't-a' },
    { task_id: 't-c', rel: 'follows', target_kind: 'task', target_id: 't-a' }
  ]
  return {
    projects: async () => projects,
    tasks: async (projectId) => tasks.filter((t) => t.project_id === projectId),
    tasksByIds: async (ids) => tasks.filter((t) => ids.includes(t.id)),
    linksFrom: async (ids) => links.filter((l) => ids.includes(l.task_id)),
    linksTo: async (id) => links.filter((l) => l.target_id === id),
    claims: async (ids) => [{ work_id: 't-b', agent: 'claude-code', owner_session: 's-123456789', claimed_at: '2026-11-20T11:00:00Z' }].filter((c) => ids.includes(c.work_id)),
    goals: async (ids) => [{ id: 'g1', title: 'Launch dissy on the App Store' }].filter((g) => ids.includes(g.id)),
    ...over
  }
}
const board = (over) => createVoiceBoard({ reads: reads(over), timeZone: 'Europe/Warsaw' })

test('the newest projects, newest first, with the local date and time', async () => {
  const r = await board().run('board_projects', { limit: 3 })
  assert.equal(r.ok, true)
  assert.deepEqual(r.projects.map((p) => [p.name, p.created]), [['SSHLG MacBook Agent', '2026-11-20 19:51'], ['ai-image-maker-app', '2026-11-20 19:20'], ['kira-agent', '2026-11-20 17:59']])
})

test('a project\'s tasks with status and who holds them; what waits for the owner is named', async () => {
  const r = await board().run('board_tasks', { project: 'dissy' })
  assert.equal(r.ok, true)
  assert.equal(r.project, 'dissy')
  const b = r.tasks.find((t) => t.title === 'Make the screenshots')
  assert.equal(b.status, 'running')
  assert.equal(b.held_by, 'claude-code')
  assert.deepEqual(r.waits_for_owner.map((t) => t.title), ['Write the listing copy'])
  assert.ok(!r.tasks.some((t) => t.status === 'done'), 'closed tasks are left out unless asked')
  const all = await board().run('board_tasks', { project: 'dissy', include_closed: true })
  assert.ok(all.tasks.some((t) => t.status === 'done'))
})

test('a task\'s graph: its goal, what it grew from, what grew from it, what blocks it and what it follows', async () => {
  const root = await board().run('board_task', { task: 'Ship the store page', project: 'dissy' })
  assert.equal(root.ok, true)
  assert.equal(root.goal, 'Launch dissy on the App Store')
  assert.deepEqual(root.grew_into.map((t) => t.title).sort(), ['Make the screenshots', 'Write the listing copy'])
  const c = await board().run('board_task', { task: 't-c' })
  assert.deepEqual(c.blocks.map((t) => t.title), ['Write the listing copy'])
  assert.deepEqual(c.follows.map((t) => t.title), ['Write the listing copy'])
  const a = await board().run('board_task', { task: 'listing copy', project: 'dissy' })
  assert.equal(a.grew_from.title, 'Ship the store page')
  assert.equal(a.goal, 'Launch dissy on the App Store', 'the goal is the root\'s')
  assert.deepEqual(a.blocked_by.map((t) => t.title), ['Translate the listing'])
})

test('a word for the CEO itself is never a project; an unknown project says the near ones; a failed read is said', async () => {
  for (const w of ['SEO', 'сео', 'СЕО', 'CEO', 'шеф', 'Директор', 'босс', 'менеджер', 'главный', 'сиио']) {
    const r = await board().run('board_tasks', { project: w })
    assert.equal(r.ok, false, w)
    assert.match(r.reason, /CEO itself/)
  }
  const miss = await board().run('board_tasks', { project: 'nothing-like-this' })
  assert.equal(miss.ok, false)
  const broken = await board({ projects: async () => { throw new Error('db down') } }).run('board_projects', {})
  assert.equal(broken.ok, false)
  assert.match(broken.reason, /could not be read/)
})

test('the CEO address words are recognised, and the SEO agent by its full name is not one', () => {
  for (const w of ['директор', 'шеф', 'босс', 'менеджер', 'главный', 'SEO', 'сео', 'СЕО', 'CEO', 'сиио', 'Шеф,', ' seo ']) assert.equal(isCeoAddress(w), true, w)
  for (const w of ['seo-content-agent', 'SEO агент', 'dissy', 'главный экран', '']) assert.equal(isCeoAddress(w), false, w)
  const rule = ceoAddressRule('ru')
  for (const w of ['директор', 'шеф', 'босс', 'менеджер', 'главный', 'SEO']) assert.ok(rule.includes(w), w)
  assert.ok(!rule.includes('—'))
  assert.ok(VOICE_BOARD_TOOLS.every((t) => /^board_/.test(t.name) && t.description.length > 20))
})

test('the voice is told to read the board itself and that the CEO words are the CEO; the CEO tools never look them up', async () => {
  const { voiceInstructions } = await import('../src/main/ceoVoice.ts')
  for (const l of ['ru', 'en']) {
    const text = voiceInstructions(l)
    for (const t of ['board_projects', 'board_tasks', 'board_task']) assert.ok(text.includes(t), `${l}: ${t}`)
    assert.ok(text.includes('шеф') || text.includes('«шеф»'), `${l}: the address words`)
  }
  const { findProject } = await import('../src/shared/ceoAgent.ts')
  const projects = [{ id: 'p1', name: 'seo-content-agent', repo_path: '/d/seo-content-agent' }, { id: 'p2', name: 'dissy', repo_path: '/d/dissy' }]
  assert.equal(findProject(projects, 'SEO').why, 'ceo-itself')
  assert.equal(findProject(projects, 'seo-content-agent').found.id, 'p1', 'the SEO agent by its full name is still found')
})

// 0.3.27 review UX-71: the owner dictates into the CEO's composer too; its brief says the address words mean the CEO.
test('the CEO brief carries the address words as meaning the CEO itself, in both languages', async () => {
  const { ceoBrief } = await import('../src/shared/ceoAgent.ts')
  for (const locale of ['ru', 'en']) {
    const brief = ceoBrief({ locale })
    assert.ok(brief.includes('«SEO»'), locale)
    assert.ok(/означают тебя|mean you/.test(brief), locale)
  }
})

// 0.3.27 review run eight, UX-64 and UX-66: real ids through the host's own filter (`tasksByIds` keeps 36-character ids
// only), a walk from board_tasks to board_task by the id it gave; running tasks said before the backlog.
test('run eight: the voice opens a task by the id board_tasks gave, and by its first characters within the project', async () => {
  const U = (n) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`
  const tasks = [T(U(1), 'p4', 'Write the listing copy', 'running'), T(U(2), 'p4', 'Make the screenshots', 'review'),
    ...Array.from({ length: 30 }, (_, i) => T(`${String(i).padStart(8, '0')}-0000-4000-8000-000000000000`, 'p4', `Backlog idea ${i}`, 'backlog', { started_at: null }))]
  const b = board({
    tasks: async () => tasks,
    tasksByIds: async (ids) => tasks.filter((t) => ids.filter((i) => /^[0-9a-f-]{36}$/.test(i)).includes(t.id)),
    linksFrom: async () => [], linksTo: async () => [], claims: async () => []
  })
  const list = await b.run('board_tasks', { project: 'dissy' })
  assert.deepEqual(list.tasks.slice(0, 2).map((t) => t.status), ['running', 'review'])
  const one = await b.run('board_task', { task: list.tasks[0].id })
  assert.equal(one.ok, true, JSON.stringify(one))
  const byPrefix = await b.run('board_task', { task: U(2).slice(0, 8), project: 'dissy' })
  assert.equal(byPrefix.ok, true, JSON.stringify(byPrefix))
})

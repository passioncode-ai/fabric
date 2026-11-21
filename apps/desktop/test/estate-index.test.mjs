// The estate index on a real node:sqlite file (docs/evidence/specs/2026-11-19-estate-index-and-graph.md): the hybrid
// search in Russian and English with citations, contexts kept apart, the graph walked both ways, a transcript read
// incrementally from its byte offset, and a whole pass over Fabric rows, transcripts and a real Git repository.
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'

const { EstateIndex } = await import(path.resolve(import.meta.dirname, '../src/main/estateIndex.ts'))
const { readTranscript, makeContext, listTranscripts } = await import(path.resolve(import.meta.dirname, '../src/main/estateSources.ts'))
const { createEstateRunner } = await import(path.resolve(import.meta.dirname, '../src/main/estateRun.ts'))
const { recallSession, pastConsoles } = await import(path.resolve(import.meta.dirname, '../src/main/knowledgeTools.ts'))
const { catalogue } = await import(path.resolve(import.meta.dirname, '../src/shared/estateSearch.ts'))

const tmp = () => mkdtempSync(path.join(tmpdir(), 'estate-'))
const fresh = () => new EstateIndex(path.join(tmp(), 'index.sqlite'))

function seed(ix) {
  ix.putDocs([
    { id: 'claude:s1', kind: 'session', source: 'claude', node: 'session:s1', title: 'Граф знаний Fabric', body: 'Задачи от владельца: построить граф задач и сессий', at: '2026-11-19T10:00:00Z', context: 'personal', sessionId: 's1', runtime: 'claude', resume: 'claude --resume s1', path: '/t/s1.jsonl', lineStart: 2, lineEnd: 9 },
    { id: 'claude:s1#20', kind: 'turn', source: 'claude', node: 'session:s1', title: 'Граф знаний Fabric', body: '› найди транскрипт по фразе за секунды', at: '2026-11-19T10:05:00Z', context: 'personal', sessionId: 's1', path: '/t/s1.jsonl', lineStart: 20, lineEnd: 20 },
    { id: 'task:t1', kind: 'task', source: 'fabric', node: 'task:t1', title: 'Board dispatcher restarts runs', body: 'the dispatcher of boardDispatchRun.ts starts twice', at: '2026-11-18T10:00:00Z', context: 'org:acme', project: 'app' },
    { id: 'task:t2', kind: 'task', source: 'fabric', node: 'task:t2', title: 'Иконка приложения', body: 'нарисовать иконку', at: '2026-11-01T10:00:00Z', context: 'personal', project: 'fabric' }
  ])
}

test('the words half finds Russian word forms, and every hit carries its citation, session and continue command', async () => {
  const ix = fresh(); seed(ix)
  const r = await ix.search('транскрипты сессии', {}, null)
  assert.deepEqual(r.degraded, ['vector-unavailable'])
  assert.equal(r.hits[0].session_id, 's1')
  const turn = r.hits.find((h) => h.id === 'claude:s1#20')
  assert.ok(turn, 'the turn that holds the word form is found')
  assert.equal(turn.cite, '/t/s1.jsonl:20')
  assert.match(turn.passage, /транскрипт по фразе/)
  const session = r.hits.find((h) => h.id === 'claude:s1')
  assert.equal(session.resume, 'claude --resume s1')
})

test('the trigram half finds a part of an identifier the stemmer never splits', async () => {
  const ix = fresh(); seed(ix)
  const r = await ix.search('DispatchRun', {}, null)
  assert.equal(r.hits[0].id, 'task:t1')
  assert.ok(r.hits[0].via.includes('trigram'))
})

test('a context narrows the search, and every hit names its context', async () => {
  const ix = fresh(); seed(ix)
  const all = await ix.search('dispatcher', {}, null)
  assert.equal(all.hits[0].context, 'org:acme')
  const personal = await ix.search('dispatcher', { context: 'personal' }, null)
  assert.equal(personal.hits.length, 0)
})

test('an unchanged document keeps its index rows, a changed one is indexed again', async () => {
  const ix = fresh(); seed(ix)
  assert.equal(ix.putDocs([{ id: 'task:t2', kind: 'task', source: 'fabric', node: 'task:t2', title: 'Иконка приложения', body: 'нарисовать иконку', at: '2026-11-01T10:00:00Z', context: 'personal', project: 'fabric' }]), 0)
  assert.equal(ix.putDocs([{ id: 'task:t2', kind: 'task', source: 'fabric', node: 'task:t2', title: 'Иконка приложения', body: 'нарисовать логотип', at: '2026-11-01T10:00:00Z', context: 'personal', project: 'fabric' }]), 1)
  assert.equal((await ix.search('иконку', {}, null)).hits.filter((h) => h.id === 'task:t2').length, 1, 'the title still matches')
  assert.equal((await ix.search('логотип', {}, null)).hits[0].id, 'task:t2')
})

test('a document changed many times is written again: the FTS tombstone pages past 2^53 never fail a write (2026-11-20 measurement)', () => {
  const ix = fresh()
  const doc = (i, v) => ({ id: `task:t${i}`, kind: 'task', source: 'fabric', node: `task:t${i}`, title: `Task ${i}`, body: `${v} body ${i}`, at: '2026-11-20T10:00:00Z', context: 'personal' })
  for (let i = 1; i <= 200; i++) ix.putDocs([doc(i, 'alpha')])
  // Each rewrite deletes from a flushed segment; contentless_delete writes a tombstone page whose rowid is above 2^53.
  for (let i = 1; i <= 200; i++) assert.doesNotThrow(() => ix.putDocs([doc(i, 'gamma')]), `rewrite ${i}`)
  assert.equal(ix.status().docs, 200)
})

test('vectors join by reciprocal rank when an embedder serves them', async () => {
  const ix = fresh(); seed(ix)
  const embedder = { model: 'fake', embed: async (texts) => texts.map((t) => Float32Array.from([/иконк|логотип|picture/i.test(t) ? 1 : 0, 1])) }
  for (const d of ix.unembedded('fake', 100)) ix.putVectors('fake', [{ digest: d.digest, vec: (await embedder.embed([d.text]))[0] }])
  const r = await ix.search('picture', {}, embedder)
  assert.ok(r.via.includes('vector'))
  assert.equal(r.hits[0].id, 'task:t2')
  assert.ok(r.hits[0].via.includes('vector'))
})

test('the graph is walked both ways, N steps, and the shortest path names every edge', () => {
  const ix = fresh()
  ix.putGraph(
    [{ id: 'task:a', kind: 'task', label: 'A' }, { id: 'console:c', kind: 'session', label: 'C' }, { id: 'session:s', kind: 'session', label: 'S' }, { id: 'commit:x', kind: 'commit', label: 'X' }],
    [{ src: 'console:c', rel: 'did', dst: 'task:a' }, { src: 'console:c', rel: 'ran-as', dst: 'session:s' }, { src: 'session:s', rel: 'changed', dst: 'commit:x', evidence: 'HEAD' }]
  )
  const one = ix.neighbours('task:a', 1)
  assert.deepEqual(one.nodes.map((n) => [n.id, n.hop, n.via.direction]), [['console:c', 1, 'in']])
  const three = ix.neighbours('task:a', 3)
  assert.deepEqual(three.nodes.map((n) => n.id), ['console:c', 'session:s', 'commit:x'])
  const p = ix.path('task:a', 'commit:x')
  assert.equal(p.found, true)
  assert.deepEqual(p.steps.map((s) => s.rel), ['did', 'ran-as', 'changed'])
  assert.equal(ix.path('task:a', 'commit:none').found, false)
  assert.equal(ix.neighbours('commit:unknown-edge-target', 1).start, null)
  // A project is reached and listed, never walked through: two steps from a task are not every task of its project.
  ix.putGraph([], [{ src: 'task:a', rel: 'belongs-to', dst: 'project:p' }, { src: 'task:b', rel: 'belongs-to', dst: 'project:p' }])
  const around = ix.neighbours('task:a', 2).nodes.map((n) => n.id)
  assert.ok(around.includes('project:p'))
  assert.ok(!around.includes('task:b'))
  assert.ok(ix.neighbours('project:p', 1).nodes.some((n) => n.id === 'task:b'), 'the project itself, as the start, is walked')
})

test('a transcript is read from its byte offset: a second pass reads only the lines appended since', () => {
  const ix = fresh()
  const dir = tmp(), proj = path.join(dir, 'projects', '-p')
  mkdirSync(proj, { recursive: true })
  const file = path.join(proj, '11111111-1111-4111-8111-111111111111.jsonl')
  const line = (o) => `${JSON.stringify(o)}\n`
  writeFileSync(file, line({ type: 'user', sessionId: '11111111-1111-4111-8111-111111111111', cwd: '/w/fabric', timestamp: '2026-11-19T10:00:00Z', message: { content: 'первое задание про граф' } }))
  const ctx = makeContext(catalogue([{ id: 'p1', name: 'fabric', repo_path: '/w/fabric' }]), new Map([['/w/fabric', 'acme']]))
  const root = { runtime: 'claude', dir: path.join(dir, 'projects'), configDir: null }
  const [f1] = listTranscripts([root])
  assert.equal(readTranscript(ix, ctx, f1).turns, 1)
  appendFileSync(file, line({ type: 'assistant', sessionId: '11111111-1111-4111-8111-111111111111', timestamp: '2026-11-19T10:01:00Z', message: { content: [{ type: 'text', text: 'второй ответ' }] } }) + '{"type":"user","cut')
  const [f2] = listTranscripts([root])
  assert.equal(readTranscript(ix, ctx, f2).turns, 1, 'only the appended, complete line')
  const s = ix.doc('claude:11111111-1111-4111-8111-111111111111')
  assert.equal(s.project, 'fabric')
  assert.equal(s.context, 'org:acme')
  assert.equal(ix.doc('claude:11111111-1111-4111-8111-111111111111#2').line_start, 2)
  assert.equal(ix.neighbours('session:11111111-1111-4111-8111-111111111111', 1).nodes[0].id, 'project:p1')
})

test('one pass reads Fabric rows, transcripts and a real Git repository, and walks from a task to its commit and session', async (t) => {
  const ix = fresh()
  // Neither under the system's temporary folder nor under a worktrees folder: a project there is temporary or a worktree,
  // and only a canonical project's commits are read (spec §3.5).
  const repo = mkdtempSync(path.join(homedir(), '.fabric-estate-test-'))
  t.after(() => rmSync(repo, { recursive: true, force: true }))
  execFileSync('git', ['init', '-q', repo])
  execFileSync('git', ['-C', repo, '-c', 'user.email=a@b', '-c', 'user.name=a', 'commit', '-q', '--allow-empty', '-m', 'feat: the graph (task 57781f0d-b2cd-4c2e-b080-52245bdc6ed6)'])
  mkdirSync(path.join(repo, 'docs', 'adr'), { recursive: true })
  writeFileSync(path.join(repo, 'docs', 'adr', '0007-the-graph-lives-here.md'), '# ADR-0007: the graph lives here\n\n## Decision\n\nOne local index with its graph, for task 57781f0d.\n')
  execFileSync('git', ['-C', repo, 'add', '.'])
  execFileSync('git', ['-C', repo, '-c', 'user.email=a@b', '-c', 'user.name=a', 'commit', '-q', '-m', 'docs: ADR-0007'])
  const sha = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD~1']).toString().trim()
  const task = '57781f0d-b2cd-4c2e-b080-52245bdc6ed6'
  const dir = tmp(), proj = path.join(dir, 'projects', '-r')
  mkdirSync(proj, { recursive: true })
  writeFileSync(path.join(proj, '22222222-2222-4222-8222-222222222222.jsonl'), `${JSON.stringify({ type: 'user', sessionId: '22222222-2222-4222-8222-222222222222', cwd: repo, timestamp: '2026-11-19T10:00:00Z', message: { content: 'сделай граф знаний для задачи 57781f0d' } })}\n`)
  const rows = {
    project_tasks: [{ id: task, project_id: 'p1', title: 'Граф знаний Fabric', instruction: 'граф', status: 'running', seq: 5 }],
    task_notes: [], task_links: [], memory_facts: [{ id: 'f1', project_id: 'p1', kind: 'decision', claim: 'The graph lives in the core (ADR-0007)', source_ref: 'docs/adr/0007', recorded_at: '2026-11-19T11:00:00Z', seq: 3 }], work_claims: [{ owner_session: 'f1', work_id: task, claimed_at: '2026-11-19T10:00:00Z', claimed_seq: 7 }]
  }
  const runner = createEstateRunner({
    index: ix,
    projects: async () => [{ id: 'p1', name: 'graph-repo', repo_path: repo }],
    organizations: () => ({ folders: new Map(), personal: null }),
    page: async (t, col, after) => rows[t].filter((r) => Number(r[col]) > after),
    journal: async (_types, after) => [{ seq: 9, type: 'session.turn.observed@1', project_id: 'p1', occurred_at: '2026-11-19T10:02:00Z',
      payload: { session_id: 'f1', runtime_session_id: '22222222-2222-4222-8222-222222222222', head: sha } }].filter((r) => r.seq > after),
    board: async (after) => ({ messages: after < 3 ? [{ id: '33333333-3333-4333-8333-333333333333', kind: 'request', at: '2026-11-19T09:00:00Z', sender: { project: 'p1' }, body: { text: 'Граф: нужен обход' } }] : [], last: 3, more: false }),
    roots: () => [{ runtime: 'claude', dir: path.join(dir, 'projects'), configDir: null }],
    embedder: async () => null,
    now: Date.now,
    yieldNow: () => new Promise((r) => setImmediate(r))
  })
  const report = await runner.pass(10_000)
  assert.deepEqual(report.degraded, ['vector-unavailable'])
  assert.equal(report.transcripts.read, 1)
  assert.equal(report.commits, 2)
  assert.equal(report.documents, 1)
  // A document section is found with its file and lines, and the ADR's record node reaches its text and the decision.
  const doc = (await ix.search('one local index', { kinds: ['document'] }, null)).hits[0]
  assert.match(doc.cite, /docs\/adr\/0007-the-graph-lives-here\.md:3-5$/)
  assert.match(doc.title, /ADR-0007: the graph lives here · Decision/)
  const record = ix.neighbours('record:ADR-0007', 1).nodes.map((n) => n.id)
  assert.ok(record.some((id) => id.startsWith('doc:p1/docs/adr/0007')), 'the ADR file records its id')
  assert.ok(record.includes('decision:f1'), 'the decision that cites it')
  const around = ix.neighbours(`task:${task}`, 3).nodes.map((n) => n.id)
  assert.ok(around.includes(`commit:${sha}`), 'the commit that cites the task')
  assert.ok(around.includes('console:f1'), 'the console that claimed it')
  assert.ok(around.includes('session:22222222-2222-4222-8222-222222222222'), 'the Claude session the console ran as, and that cited the task')
  // The session's own edge to the commit it recorded as HEAD, apart from the commit message that cites the task.
  assert.deepEqual(ix.neighbours('session:22222222-2222-4222-8222-222222222222', 1, 10, ['changed']).nodes.map((n) => n.id), [`commit:${sha}`])
  const p = ix.path(`task:${task}`, `commit:${sha}`)
  assert.equal(p.found, true)
  const again = await runner.pass(10_000)
  assert.equal(again.docs, 0, 'a second pass over unchanged sources writes nothing')
  assert.equal(again.commits, 0)
})

test('a repository whose documents wait for the next pass is not read for its commits again (2026-11-20 measurement)', async (t) => {
  const ix = fresh()
  const repo = mkdtempSync(path.join(homedir(), '.fabric-estate-test-'))
  t.after(() => rmSync(repo, { recursive: true, force: true }))
  execFileSync('git', ['init', '-q', repo])
  mkdirSync(path.join(repo, 'docs'), { recursive: true })
  writeFileSync(path.join(repo, 'docs', 'note.md'), '# Note\n\nThe memory dashboard reads the index.\n')
  execFileSync('git', ['-C', repo, 'add', '.'])
  execFileSync('git', ['-C', repo, '-c', 'user.email=a@b', '-c', 'user.name=a', 'commit', '-q', '-m', 'docs: a note'])
  // The clock jumps past the budget once the transcripts start, the way a first index's transcripts eat a pass: the
  // commits are read, the documents wait.
  let late = false, slow = true
  const runner = createEstateRunner({
    index: ix,
    projects: async () => [{ id: 'p1', name: 'memory-repo', repo_path: repo }],
    organizations: () => ({ folders: new Map(), personal: null }),
    page: async () => [], journal: async () => [], board: async () => ({ messages: [], last: 0, more: false }),
    roots: () => { if (slow) late = true; return [] },
    embedder: async () => null,
    now: () => Date.now() + (late ? 1e9 : 0),
    yieldNow: () => new Promise((r) => setImmediate(r))
  })
  const first = await runner.pass(10_000)
  assert.equal(first.commits, 1)
  assert.equal(first.documents, 0)
  assert.ok(first.degraded.includes('documents-deferred: memory-repo'))
  late = false; slow = false
  const second = await runner.pass(10_000)
  assert.equal(second.commits, 0, 'the commits at this HEAD were read already')
  assert.equal(second.documents, 1, 'the documents that waited are read now')
  const third = await runner.pass(10_000)
  assert.equal(third.commits + third.documents, 0, 'nothing more at an unchanged HEAD')
})

test('a console Fabric no longer runs is recalled with the newest session it ran as; a transcript with its config home', () => {
  const ix = fresh()
  ix.putGraph(
    [{ id: 'console:f1', kind: 'session', label: 'fabric · claude-code', at: '2026-11-19T09:00:00Z', attrs: { console: true, runner: 'claude-code', folder: '/w/fabric', project_id: 'p1' } },
      { id: 'session:rt-new', kind: 'session', label: 'S', attrs: { runtime: 'claude', folder: '/w/fabric', config_dir: '/h/acct' } }],
    [{ src: 'console:f1', rel: 'ran-as', dst: 'session:rt-old', at: '2026-11-19T09:10:00Z' }, { src: 'console:f1', rel: 'ran-as', dst: 'session:rt-new', at: '2026-11-19T09:20:00Z' },
      { src: 'session:rt-new', rel: 'belongs-to', dst: 'project:p1' }, { src: 'console:only-enrolled', rel: 'ran-as', dst: 'session:rt-x', at: '2026-11-19T08:00:00Z' },
      { src: 'console:only-enrolled', rel: 'belongs-to', dst: 'project:p2' }]
  )
  assert.deepEqual(recallSession(ix, 'f1'), { id: 'f1', kind: 'console', projectId: 'p1', folder: '/w/fabric', runner: 'claude-code', runtimeSessionId: 'rt-new', configDir: '/h/acct', title: 'fabric · claude-code', at: '2026-11-19T09:20:00Z' })
  assert.deepEqual([recallSession(ix, 'only-enrolled').projectId, recallSession(ix, 'only-enrolled').runtimeSessionId], ['p2', 'rt-x'])
  assert.deepEqual(recallSession(ix, 'rt-new'), { id: 'rt-new', kind: 'transcript', projectId: 'p1', folder: '/w/fabric', runner: 'claude-code', runtimeSessionId: 'rt-new', configDir: '/h/acct', title: 'S', at: null })
  assert.equal(recallSession(ix, 'nothing'), null)
  assert.deepEqual(pastConsoles(ix, 10).map((r) => r.id), ['f1'])
})

// 0.3.27 review DA-49: a key typed into any session never reaches the index's file or an answer of its doors.
test('a key typed into a transcript is redacted as the index writes it, and no door answers it', async () => {
  const { createKnowledgeOperations } = await import(path.resolve(import.meta.dirname, '../src/main/knowledgeTools.ts'))
  const { readFileSync } = await import('node:fs')
  const KEY = 'sk-ant-api03-' + 'Q'.repeat(90) + 'AA'
  const dir = tmp(), file = path.join(dir, 'index.sqlite'), ix = new EstateIndex(file)
  const proj = path.join(dir, 'projects', '-p')
  mkdirSync(proj, { recursive: true })
  const sid = '22222222-2222-4222-8222-222222222222'
  writeFileSync(path.join(proj, `${sid}.jsonl`), `${JSON.stringify({ type: 'user', sessionId: sid, cwd: '/w/fabric', timestamp: '2026-11-21T10:00:00Z', message: { content: `deploy with key ${KEY} please` } })}\n`)
  const ctx = makeContext(catalogue([{ id: 'p1', name: 'fabric', repo_path: '/w/fabric' }]), new Map())
  const [f] = listTranscripts([{ runtime: 'claude', dir: path.join(dir, 'projects'), configDir: null }])
  assert.equal(readTranscript(ix, ctx, f).turns, 1)
  ix.putGraph([{ id: 'task:k', kind: 'task', label: `rotate ${KEY}`, attrs: { note: KEY } }], [])
  const ops = createKnowledgeOperations({ index: () => ix, embedder: async () => null, catalogue: async () => [], refresh: async () => ({}), rebuild: async () => ({}), record: () => {}, file, labels: () => ({}) })
  const answers = [
    await ops.run('search', { query: 'deploy key' }),
    await ops.run('execute', { operation: 'node.get', arguments: { id: `session:${sid}` } }),
    await ops.run('execute', { operation: 'node.get', arguments: { id: 'task:k' } }),
    await ops.run('execute', { operation: 'graph.neighbours', arguments: { node: `session:${sid}` } })
  ]
  assert.ok(answers[0].hits.length > 0, 'the turn is still found by its other words')
  for (const a of answers) assert.ok(!JSON.stringify(a).includes(KEY), 'no answer carries the key')
  ix.close()
  for (const ext of ['', '-wal', '-shm']) { try { assert.ok(!readFileSync(file + ext).includes(KEY), `the file${ext} holds no key`) } catch (e) { if (e.code !== 'ENOENT') throw e } }
})

test('an index of an earlier schema, which may hold text as typed, is refused so the host removes and rebuilds it', () => {
  const file = path.join(tmp(), 'index.sqlite')
  const ix = new EstateIndex(file)
  ix.setMeta('schema', '2')
  ix.close()
  assert.throws(() => new EstateIndex(file), /schema 2/)
})

// 0.3.27 review ER-68: a section that moved or a file that went leaves the index, so its old text is neither found nor confirmed.
test('a document read again leaves no stale section behind, and quote.check no longer keeps the old text', async () => {
  const { createKnowledgeOperations } = await import(path.resolve(import.meta.dirname, '../src/main/knowledgeTools.ts'))
  const file = path.join(tmp(), 'index.sqlite'), ix = new EstateIndex(file)
  const sec = (line, body) => ({ id: `doc:p1/docs/a.md#${line}`, kind: 'document', source: 'git', node: 'doc:p1/docs/a.md', title: 'A', body, context: 'personal', path: '/w/docs/a.md', lineStart: line, lineEnd: line + 1 })
  ix.putDocs([sec(3, 'the start takes forty seconds'), { ...sec(1, 'other file'), id: 'doc:p1/docs/b.md#1', node: 'doc:p1/docs/b.md' }])
  // The next read of this HEAD: a line inserted above, the text changed, b.md removed.
  const next = [sec(5, 'the start takes ten seconds')]
  ix.putDocs(next)
  assert.equal(ix.pruneDocs('doc:p1/', new Set(next.map((d) => d.id))), 2)
  assert.equal(ix.doc('doc:p1/docs/a.md#3'), null)
  assert.equal(ix.doc('doc:p1/docs/b.md#1'), null)
  const ops = createKnowledgeOperations({ index: () => ix, embedder: async () => null, catalogue: async () => [], refresh: async () => ({}), rebuild: async () => ({}), record: () => {}, file, labels: () => ({}) })
  const found = await ops.run('search', { query: 'start seconds' })
  assert.deepEqual(found.hits.map((h) => h.id), ['doc:p1/docs/a.md#5'])
  const checked = await ops.run('execute', { operation: 'quote.check', arguments: { claims: [{ quote: 'forty seconds', doc: 'doc:p1/docs/a.md#3' }] } })
  assert.equal(checked.kept ?? 0, 0)
})

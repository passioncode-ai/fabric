// SCN-188: a recorded show's chunks and screenshots reach the CEO conversation or a task as soon as they are ready,
// each once, with paths the CEO can open; a session with no target delivers nothing.
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createRecordShow, recordShowScript } from '../src/main/recordShow.ts'

const TASK = '3e306fa7-6a33-4221-8590-56daaa007d16'

function session(root, name, { deliver = 'ceo', chunks = 1, shots = [] } = {}) {
  const dir = path.join(root, name)
  mkdirSync(path.join(dir, 'frames'), { recursive: true })
  mkdirSync(path.join(dir, 'shots'), { recursive: true })
  writeFileSync(path.join(dir, 'session.json'), JSON.stringify({ deliver }))
  const items = []
  for (let i = 0; i < chunks; i++) {
    const frame = `frames/c00${i}-00m0${i}s-1.0.jpg`
    writeFileSync(path.join(dir, frame), 'jpg')
    writeFileSync(path.join(dir, `chunk-00${i}.md`), `## Кусок ${i + 1}\n- кадр: ${frame}\nПути к кадрам и снимкам даны от папки этого файла; открой`)
    items.push({ kind: 'chunk', index: i, start: i * 45, end: i * 45 + 45, lines: [{ text: `вот тут ${i}` }] })
  }
  for (const s of shots) writeFileSync(path.join(dir, s.file), 'png')
  writeFileSync(path.join(dir, 'shots.jsonl'), shots.map((s) => JSON.stringify(s)).join('\n'))
  writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ items }))
  return dir
}

function harness({ ceoOk = true } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'record-show-'))
  const inbox = path.join(root, '..', `${path.basename(root)}-inbox`)
  const sent = { ceo: [], task: [], events: [], ops: [] }
  const rs = createRecordShow({
    script: '/nowhere/record-show.mjs', node: process.execPath, env: {}, root, inbox, platform: 'darwin', locale: () => 'ru',
    toCeo: async (text, files) => { sent.ceo.push({ text, files }); return ceoOk },
    toTask: async (taskId, body) => { sent.task.push({ taskId, body }) },
    emit: (e) => sent.events.push(e),
    record: (op) => sent.ops.push(op)
  })
  return { root, inbox, sent, rs }
}

test('a chunk goes to the CEO once, copied into the inbox with absolute frame paths, and the call hears its words', async () => {
  const { root, inbox, sent, rs } = harness()
  const dir = session(root, '2026-11-19_20-00-00_demo')
  await rs.tick()
  await rs.tick()
  assert.equal(sent.ceo.length, 1, 'delivered once across passes')
  const [{ text, files }] = sent.ceo
  assert.match(text, /кусок 1/)
  assert.equal(files.length, 1)
  assert.ok(files[0].startsWith(inbox))
  const md = readFileSync(files[0], 'utf8')
  assert.ok(md.includes(path.join(inbox, 'show-2026-11-19_20-00-00_demo-frames-c000-00m00s-1.0.jpg')))
  assert.ok(existsSync(path.join(inbox, 'show-2026-11-19_20-00-00_demo-frames-c000-00m00s-1.0.jpg')))
  assert.deepEqual(JSON.parse(readFileSync(path.join(dir, 'fabric-delivered.json'), 'utf8')), ['chunk-000.md'])
  const delivered = sent.events.find((e) => e.delivered)
  assert.deepEqual(delivered.delivered, { kind: 'chunk', to: 'ceo', index: 0, said: 'вот тут 0', start: 0, end: 45 })
})

test('a refused delivery is tried again on the next pass, and order is kept', async () => {
  const h = harness({ ceoOk: false })
  session(h.root, 's1', { chunks: 2 })
  await h.rs.tick()
  assert.equal(h.sent.ceo.length, 1, 'the second chunk waits behind the first')
  await h.rs.tick()
  assert.equal(h.sent.ceo.length, 2, 'the first is tried again')
  assert.match(h.sent.ceo[1].text, /кусок 1/)
})

test('a task session adds notes; a screenshot with its own target goes there; a session with no target sends nothing', async () => {
  const { root, sent, rs } = harness()
  session(root, 'task-session', { deliver: `task:${TASK}`, shots: [{ at: 3, file: 'shots/shot-a.png' }] })
  session(root, 'quiet', { deliver: null, shots: [{ at: 1, file: 'shots/shot-b.png', deliver: 'ceo' }] })
  await rs.tick()
  assert.equal(sent.task.length, 2)
  assert.ok(sent.task.every((n) => n.taskId === TASK))
  assert.match(sent.task.find((n) => n.body.includes('Кусок')).body, /show-task-session-frames-/)
  assert.equal(sent.ceo.length, 1, 'only the shot that named the CEO')
  assert.match(sent.ceo[0].text, /Снимок экрана/)
  assert.ok(sent.ceo[0].files[0].endsWith('show-quiet-shots-shot-b.png'))
})

test('the state is idle with no live recording, and nothing runs off macOS or without the script', async () => {
  const { rs } = harness()
  assert.deepEqual(rs.state(), { available: true, recording: false, startedAt: null, deliver: null, chunksReady: 0 })
  const off = createRecordShow({ script: null, node: 'x', env: {}, root: '/x', inbox: '/y', platform: 'darwin', locale: () => 'ru', toCeo: async () => true, toTask: async () => {}, emit: () => {}, record: () => {} })
  assert.equal(off.available, false)
  assert.equal((await off.toggle('ceo')).reason, 'unavailable')
  const linux = createRecordShow({ script: '/s', node: 'x', env: {}, root: '/x', inbox: '/y', platform: 'linux', locale: () => 'ru', toCeo: async () => true, toTask: async () => {}, emit: () => {}, record: () => {} })
  assert.equal(linux.available, false)
})

test('the recorder is found in the bundle first, then in the repository', () => {
  const have = new Set(['/R/record-show/record-show.mjs', '/repo/scripts/record-show/record-show.mjs'])
  assert.equal(recordShowScript('/R', '/repo/apps/desktop', (f) => have.has(f)), '/R/record-show/record-show.mjs')
  assert.equal(recordShowScript('/none', '/repo/apps/desktop', (f) => have.has(f)), '/repo/scripts/record-show/record-show.mjs')
  assert.equal(recordShowScript(undefined, '/elsewhere/apps/desktop', (f) => have.has(f)), null)
})

test('a refusal of the recorder comes back with its reason and words; a start passes the target', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'record-show-fake-'))
  const script = path.join(root, 'fake.mjs')
  writeFileSync(script, `const a = process.argv.slice(2); require('node:fs').writeFileSync(${JSON.stringify(path.join(root, 'args.json'))}, JSON.stringify(a));
console.log(JSON.stringify({ error: 'Нет разрешения macOS «Запись экрана»', code: 3 })); process.exit(3)`.replace("require('node:fs')", "(await import('node:fs'))"))
  const rs = createRecordShow({ script, node: process.execPath, env: {}, root, inbox: path.join(root, 'inbox'), platform: 'darwin', locale: () => 'ru', toCeo: async () => true, toTask: async () => {}, emit: () => {}, record: () => {} })
  const a = await rs.toggle(`task:${TASK}`)
  rs.stop()
  assert.equal(a.ok, false)
  assert.equal(a.reason, 'permission-screen')
  assert.match(a.message, /Запись экрана/)
  assert.deepEqual(JSON.parse(readFileSync(path.join(root, 'args.json'), 'utf8')), ['start', '--to', `task:${TASK}`, '--json'])
})

// ADR-0207 Decision 6, spec 2026-11-21 §3.4 (R4): a console waiting at a prompt is handed to the CEO once per distinct
// prompt, never the CEO's own; a CEO that cannot run, or ten minutes without an answer, sends it to the owner.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createConsoleHandoff, consoleHandoffLine, keysFor, ESCALATE_MS, PERSON_IDLE_MS, QUIET_MS } from '../src/main/consoleHandoff.ts'

const menu = (q = 'Where should the drafts be kept?') => [
  q, '❯ 1. In the project folder', '  2. In the app data folder', 'Enter to select · ↑/↓ to navigate · Esc to cancel'
].join('\n')
const idle = ['⏺ Done.', '╭────╮', '│ >  │', '╰────╯', '  ? for shortcuts'].join('\n')

function rig(over = {}) {
  let t = 10_000_000
  const calls = { delivered: [], escalated: [], ensure: 0, records: [], typed: [] }
  const answers = {}
  const screens = { w1: menu(), ceo: menu('The CEO asks itself?') }
  const consoles = [
    { sessionId: 'w1', projectId: 'p1', running: true, lastOutputAt: t - QUIET_MS - 1, lastTypedAt: null, name: 'Claude Code', project: 'fabric', task: 'Drafts' },
    { sessionId: 'ceo', projectId: 'pc', running: true, lastOutputAt: t - QUIET_MS - 1, lastTypedAt: null, name: 'CEO', project: 'Fabric CEO', task: null }
  ]
  const deps = {
    consoles: () => consoles, screen: (id) => screens[id] ?? '', ceoSessionId: () => 'ceo', ceoState: () => 'running',
    ensure: async () => { calls.ensure++ },
    deliver: async (id, line) => { calls.delivered.push([id, line]); return { state: 'written' } },
    escalate: async (c, p, by) => { calls.escalated.push([c.sessionId, p.question, by]); return `q-${calls.escalated.length}` },
    answerOf: async (id) => answers[id] ?? { status: 'open', chosen: null, answer: null },
    type: (id, data) => calls.typed.push([id, data]),
    record: (op, outcome, detail) => calls.records.push({ op, outcome, detail }),
    now: () => t, ...over
  }
  return { h: createConsoleHandoff(deps), calls, screens, consoles, answers, tick: (ms) => { t += ms } }
}

test('a waiting console is typed into the CEO once per distinct prompt, never the CEO\'s own console', async () => {
  const r = rig()
  assert.equal(await r.h.tick(), 1)
  assert.equal(await r.h.tick(), 0)
  assert.equal(r.calls.delivered.length, 1)
  const [to, line] = r.calls.delivered[0]
  assert.equal(to, 'ceo')
  assert.match(line, /Консоль Claude Code \(w1, проект fabric, задача «Drafts»\) ждёт ответа: «Where should the drafts be kept\?»/)
  assert.match(line, /1: In the project folder; 2: In the app data folder/)
  assert.match(line, /выбран вариант 1/)
  // A new question in the same console is a new prompt.
  r.screens.w1 = menu('Which format?')
  assert.equal(await r.h.tick(), 1)
})

test('a console still printing, or one the person typed into in the last two minutes, is left alone', async () => {
  const r = rig()
  r.consoles[0].lastOutputAt = 10_000_000 - 1000
  assert.equal(await r.h.tick(), 0)
  r.consoles[0].lastOutputAt = null
  r.consoles[0].lastTypedAt = 10_000_000 - PERSON_IDLE_MS + 1000
  assert.equal(await r.h.tick(), 0)
  assert.equal(r.calls.delivered.length, 0)
})

test('a prompt still waiting ten minutes after it was first seen goes to the owner, once', async () => {
  const r = rig()
  await r.h.tick()
  r.tick(ESCALATE_MS)
  await r.h.tick()
  await r.h.tick()
  assert.deepEqual(r.calls.escalated, [['w1', 'Where should the drafts be kept?', 'triage-timeout']])
})

test('a prompt that went away is forgotten: nothing escalates', async () => {
  const r = rig()
  await r.h.tick()
  r.screens.w1 = idle
  r.tick(ESCALATE_MS)
  await r.h.tick()
  assert.equal(r.calls.escalated.length, 0)
  assert.equal(r.h.waiting(), 0)
})

test('a CEO not running is started; one the person stopped or that failed sends the prompt to the owner at once', async () => {
  const off = rig({ ceoState: () => 'ended' })
  await off.h.tick()
  await off.h.tick()
  assert.equal(off.calls.ensure, 1)
  assert.equal(off.calls.delivered.length, 0)
  const stopped = rig({ ceoState: () => 'stopped' })
  await stopped.h.tick()
  assert.deepEqual(stopped.calls.escalated.map((e) => e[2]), ['ceo-cannot-run'])
  assert.equal(stopped.calls.ensure, 0)
})

test('a failed delivery is tried again at the next tick', async () => {
  let n = 0
  const r = rig({ deliver: async () => ({ state: n++ === 0 ? 'refused' : 'written' }) })
  assert.equal(await r.h.tick(), 0)
  assert.equal(await r.h.tick(), 1)
})

test('a typed question tells the CEO to answer with text', () => {
  const line = consoleHandoffLine({ sessionId: 'w', projectId: null, running: true, lastOutputAt: null, lastTypedAt: null, name: 'Codex', project: null, task: null },
    { kind: 'text', question: 'Land it now?', options: [], selected: null }, 'w')
  assert.match(line, /Ответь текстом и enter/)
  assert.doesNotMatch(line, /Варианты/)
})

test('the owner\'s answer is typed into the same console once, by the chosen option\'s key, while the prompt is on screen', async () => {
  const r = rig({ ceoState: () => 'stopped' })
  await r.h.tick()
  assert.deepEqual(r.calls.escalated.map((e) => e[2]), ['ceo-cannot-run'])
  await r.h.tick()
  assert.equal(r.calls.typed.length, 0, 'nothing is typed while the question is open')
  r.answers['q-1'] = { status: 'answered', chosen: '2', answer: null }
  await r.h.tick()
  await r.h.tick()
  assert.deepEqual(r.calls.typed, [['w1', '2']])
})

test('an answer that comes after the prompt went away is not typed', async () => {
  const r = rig({ ceoState: () => 'stopped' })
  await r.h.tick()
  r.screens.w1 = idle
  r.answers['q-1'] = { status: 'answered', chosen: '1', answer: null }
  await r.h.tick()
  assert.equal(r.calls.typed.length, 0)
})

test('keysFor: a digit for a menu, a letter and Enter for y/n, Enter to continue, words and Enter for a typed question', () => {
  const menuP = { kind: 'menu', question: 'q?', options: [{ key: '1', label: 'a' }, { key: '2', label: 'b' }], selected: '1' }
  assert.equal(keysFor(menuP, { chosen: '2', answer: null }), '2')
  assert.equal(keysFor(menuP, { chosen: null, answer: 'free words' }), null)
  const yn = { kind: 'confirm', question: 'q?', options: [{ key: 'y', label: 'Yes' }, { key: 'n', label: 'No' }], selected: 'n' }
  assert.equal(keysFor(yn, { chosen: 'y', answer: null }), 'y\r')
  assert.equal(keysFor({ kind: 'confirm', question: 'go', options: [{ key: 'enter', label: 'Continue' }], selected: 'enter' }, { chosen: 'enter', answer: null }), '\r')
  assert.equal(keysFor({ kind: 'text', question: 'q?', options: [], selected: null }, { chosen: null, answer: 'Land it\nnow' }), 'Land it now\r')
})

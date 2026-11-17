// The people-ask bridge wired (task 11ebbf83). Spec: docs/evidence/specs/2026-11-16-people-ask-bridge.md §4, §5. No
// board, no window, no database: «Нужны вы», the board door and the window's doors are stand-ins with the shapes the real
// ones answer.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'

const { createPeopleAskBridge, createPeopleApply, commandIdOf, isAskRecord } = await import(path.resolve(import.meta.dirname, '../src/main/peopleAskRun.ts'))
const { boardEntries } = await import(path.resolve(import.meta.dirname, '../src/shared/board.ts'))
const { askKey, parseAsk, DEFAULT_PEOPLE_ROUTES, DELEGATE_ANSWER } = await import(path.resolve(import.meta.dirname, '../src/shared/peopleAsk.ts'))

const T0 = Date.parse('2026-11-16T18:00:00Z')
const P = '79000000-0000-4000-8000-0000000000a1'
const Q = '79000000-0000-4000-8000-0000000000b1'
const TASK = '79000000-0000-4000-8000-0000000000c1'
const KIRA = 'd6e9657c-6332-87fa-9585-6fe913352680'

const question = (over = {}) => ({ id: Q, projectId: P, projectName: 'fabric', text: 'Какую базу берём?', kind: 'decision', askedAt: '2026-11-16T10:00:00Z',
  blocks: 0, revision: 2, servesActiveGoal: false, askedBy: { kind: 'agent', agent: 'claude-code' },
  options: [{ id: 'pg', label: 'PostgreSQL' }, { id: 'sqlite', label: 'SQLite', recommended: true }], ...over })
const review = { kind: 'review', ref: { kind: 'task', id: TASK }, projectId: P, projectName: 'fabric', title: 'Мост', detail: null, since: '2026-11-10T10:00:00Z' }
const entries = (questions, attention = []) => boardEntries({ questions, attention, projectWeightOf: () => 1, now: new Date(T0) })

const answerBlock = (over = {}) => ({ schema: 'fabric-people-answer/1', item: `question:${Q}`, revision: 2, option: 'sqlite', text: null,
  words: 'Берём SQLite', voice: false, decider: { key: 'cto', telegramUserId: null, level: 'architect' }, at: '2026-11-16T18:01:00Z', ...over })
const replyText = (a) => `Ответ.\n\n\`\`\`json\n${JSON.stringify(a)}\n\`\`\`\n`

function world(over = {}) {
  let now = T0
  let n = 0
  const w = {
    items: entries([question()]), complete: true, on: true, responders: [{ project: KIRA, capability: 'people.ask', state: 'active' }],
    project: { id: P, name: 'fabric', business: null, owner: 'passioncode-ai' }, threads: new Map(), submits: [], replies: [], cancels: [],
    applied: [], saved: [], logs: [], refuseSubmit: null, applyAnswer: { ok: true }, loaded: [], ...over
  }
  w.deps = {
    now: () => now,
    switchOn: () => w.on,
    quitting: () => false,
    readItems: async () => { if (w.readFails) throw new Error('board unreadable'); return { items: w.items, complete: w.complete } },
    projectOf: async () => w.project,
    projectFacts: async (id) => w.facts?.[id] ?? (id === KIRA ? { id: KIRA, name: 'kira-pm', business: null, owner: 'passioncode-ai' } : null),
    routes: () => DEFAULT_PEOPLE_ROUTES,
    allowAccess: async () => true,
    responders: async () => w.responders,
    epoch: async () => 7,
    submit: async (project, input) => {
      w.submits.push({ project, input })
      if (w.refuseSubmit) return { error: { code: w.refuseSubmit, message: 'no' } }
      const id = `r${++n}`
      const thread = `t${n}`
      w.threads.set(thread, [{ id, thread, kind: 'request', sender: { project }, at: new Date(now).toISOString(), body: input.body,
        request: { id, target: input.request.target, capability: 'people.ask', state: 'queued', effect: 'not_started', revision: 1 } }])
      return { ok: true, repeated: false, message: id, thread, request: { id, state: 'queued', effect: 'not_started', revision: 1 } }
    },
    reply: async (project, input) => { w.replies.push({ project, input }); return { ok: true, repeated: false, message: `m${++n}` } },
    cancel: async (project, input) => { w.cancels.push({ project, input }); return { ok: true, repeated: false } },
    thread: async (id) => w.threads.get(id) ?? [],
    apply: async (act, decided) => { w.applied.push({ act, decided }); return w.applyAnswer },
    load: () => w.loaded,
    save: (records) => { w.saved.push(JSON.parse(JSON.stringify(records))) },
    log: (op, outcome, detail) => w.logs.push({ op, outcome, detail })
  }
  w.tick = (ms) => { now += ms }
  /** The PM agent's reply to the n-th request, as the board shows it in the thread. */
  w.answer = (i, block, sender = KIRA) => {
    const s = w.submits[i]
    const thread = [...w.threads.values()].find((t) => t[0].body === s.input.body)
    const id = `a${++n}`
    thread.push({ id, thread: thread[0].thread, kind: 'reply', replyTo: thread[0].id, sender: { project: sender }, at: new Date(now).toISOString(), body: { text: replyText(block) } })
    return id
  }
  /** A reply with plain text and no block, as a responder's progress note sent as a reply (2026-11-17). */
  w.note = (i, text) => {
    const s = w.submits[i]
    const thread = [...w.threads.values()].find((t) => t[0].body === s.input.body)
    const id = `a${++n}`
    thread.push({ id, thread: thread[0].thread, kind: 'reply', replyTo: thread[0].id, sender: { project: KIRA }, at: new Date(now).toISOString(), body: { text } })
    return id
  }
  return w
}

test('a «Нужны вы» question goes to its organization\'s PM project as one people.ask request, once', async () => {
  const w = world()
  const b = createPeopleAskBridge(w.deps)
  await b.onPass()
  assert.equal(w.submits.length, 1)
  const { project, input } = w.submits[0]
  assert.equal(project, P, 'sent as the item\'s own project')
  assert.deepEqual(input.request, { target: KIRA, capability: 'people.ask', deadline: new Date(T0 + 7 * 24 * 3600_000).toISOString() })
  assert.deepEqual(input.idempotency, { epoch: 7, key: askKey(`question:${Q}`, 2) })
  assert.deepEqual(input.thread.new.participants, [KIRA])
  assert.equal(input.kind, 'request')
  assert.equal(parseAsk(input.body.text).item, `question:${Q}`)
  assert.equal(b.records()[0].state, 'open')
  await b.onPass()
  assert.equal(w.submits.length, 1, 'a second pass asks nothing again')
})

test('nothing is sent where the PM project holds no live people.ask responder, nor without a route; said once', async () => {
  const w = world({ responders: [{ project: KIRA, capability: 'people.ask', state: 'stale' }] })
  const b = createPeopleAskBridge(w.deps)
  await b.onPass()
  await b.onPass()
  assert.equal(w.submits.length, 0)
  assert.equal(w.logs.filter((l) => l.op === 'people.ask.skipped').length, 1)
  w.project = { id: P, name: 'fabric', business: null, owner: 'someone-else' }
  w.responders = [{ project: KIRA, capability: 'people.ask', state: 'active' }]
  await b.onPass()
  assert.equal(w.submits.length, 0)
  assert.match(JSON.stringify(w.logs.filter((l) => l.op === 'people.ask.skipped').at(-1).detail), /no-route/)
})

test('a PM project no route names is found by its live responder and the project\'s owner; two candidates are never guessed', async () => {
  const ACME = '79000000-0000-4000-8000-0000000000e1'
  const w = world({ project: { id: P, name: 'tool', business: null, owner: 'acme-org' },
    responders: [{ project: KIRA, capability: 'people.ask', state: 'active' }, { project: ACME, capability: 'people.ask', state: 'active' }],
    facts: { [ACME]: { id: ACME, name: 'acme-pm', business: null, owner: 'acme-org' } } })
  const b = createPeopleAskBridge(w.deps)
  await b.onPass()
  assert.equal(w.submits.length, 1)
  assert.equal(w.submits[0].input.request.target, ACME)
  const w2 = world({ project: { id: P, name: 'tool', business: null, owner: 'acme-org' },
    responders: [{ project: ACME, capability: 'people.ask', state: 'active' }, { project: KIRA, capability: 'people.ask', state: 'active' }],
    facts: { [ACME]: { id: ACME, name: 'acme-pm', business: null, owner: 'acme-org' }, [KIRA]: { id: KIRA, name: 'acme-pm-2', business: null, owner: 'acme-org' } } })
  await createPeopleAskBridge(w2.deps).onPass()
  assert.equal(w2.submits.length, 0)
  assert.match(JSON.stringify(w2.logs.find((l) => l.op === 'people.ask.skipped').detail), /ambiguous-pm/)
})

test('the switch off sends nothing new and takes back what is open', async () => {
  const w = world()
  const b = createPeopleAskBridge(w.deps)
  await b.onPass()
  w.on = false
  w.items = entries([question({ id: '79000000-0000-4000-8000-0000000000b2' })])
  await b.onPass()
  assert.equal(w.submits.length, 1)
  assert.equal(w.cancels.length, 1)
  assert.match(w.cancels[0].input.reason, /выключено/)
})

test('an answer from the PM project is judged, applied once through the window\'s door and said «решено» in the thread', async () => {
  const w = world()
  const b = createPeopleAskBridge(w.deps)
  await b.onPass()
  const id = w.answer(0, answerBlock())
  w.tick(30_000)
  await b.onPass()
  assert.equal(w.applied.length, 1)
  const { act, decided } = w.applied[0]
  assert.equal(act.kind, 'question')
  assert.equal(decided.option, 'sqlite')
  assert.equal(decided.words, 'Берём SQLite')
  assert.equal(decided.answerId, id)
  assert.deepEqual(decided.decision, { by: 'operator', via: 'relayed-instruction', action: 'people.question', target: `question:${Q}`,
    instruction: 'Берём SQLite', at: '2026-11-16T18:01:00Z', source: { project: KIRA, thread: 't1' } })
  assert.equal(w.replies.length, 1)
  assert.equal(w.replies[0].input.replyTo, id)
  assert.equal(w.replies[0].input.body.text.split('\n')[0], 'решено')
  assert.equal(b.records()[0].state, 'applied')
  // The same answer read again, and a second answer to the decided item, decide nothing twice, even while «Нужны вы»
  // still lists it (the projection is not immediate).
  const again = w.answer(0, answerBlock({ option: 'pg' }))
  await b.onPass()
  assert.equal(w.applied.length, 1)
  assert.equal(w.replies.at(-1).input.replyTo, again)
  assert.match(w.replies.at(-1).input.body.text, /^не применено: пункт уже решён/)
  assert.equal(w.cancels.length, 0, 'an applied item is not cancelled')
})

test('an answer is refused, and said so, for a level too low, a stale revision, an unknown option, or a reply from another project', async () => {
  const w = world()
  const b = createPeopleAskBridge(w.deps)
  await b.onPass()
  w.answer(0, answerBlock({ decider: { key: 'dev', telegramUserId: null, level: 'member' } }))
  w.answer(0, answerBlock({ option: 'mysql' }))
  w.answer(0, answerBlock(), '79000000-0000-4000-8000-0000000000ff')
  await b.onPass()
  assert.equal(w.applied.length, 0)
  assert.deepEqual(w.replies.map((r) => r.input.body.text.split('\n')[0]), ['не применено: решает архитектор или выше, а ответил участник', 'не применено: у пункта нет варианта «mysql»'])
  // The question was asked again with a new revision: an answer to the old one is refused, the old request cancelled.
  w.items = entries([question({ revision: 3 })])
  w.answer(0, answerBlock())
  await b.onPass()
  assert.equal(w.applied.length, 0)
  assert.match(w.replies.at(-1).input.body.text, /^не применено: пункт изменился/)
  assert.equal(w.cancels.length, 1)
  assert.equal(w.submits.length, 2)
  assert.equal(w.submits[1].input.idempotency.key, askKey(`question:${Q}`, 3))
})

test('a reply with no answer block is a note: nothing is posted back, the item waits, and its answer still decides it', async () => {
  const w = world()
  const b = createPeopleAskBridge(w.deps)
  await b.onPass()
  w.note(0, 'Морфеус спросил администратора в Telegram.')
  await b.onPass()
  assert.equal(w.replies.length, 0, 'no «не применено» for a note')
  assert.equal(w.applied.length, 0)
  assert.equal(b.records()[0].state, 'open')
  assert.ok(w.logs.some((l) => l.op === 'people.ask.note'))
  await b.onPass()
  assert.equal(w.logs.filter((l) => l.op === 'people.ask.note').length, 1, 'a note is read once')
  w.answer(0, answerBlock())
  await b.onPass()
  assert.equal(w.applied.length, 1)
  assert.equal(w.replies.length, 1)
  assert.equal(w.replies[0].input.body.text.split('\n')[0], 'решено')
})

test('a door that refuses leaves the item open and says why; a later answer may still decide it', async () => {
  const w = world({ applyAnswer: { ok: false, reason: 'кнопка Fabric отказала: the question was revised' } })
  const b = createPeopleAskBridge(w.deps)
  await b.onPass()
  w.answer(0, answerBlock())
  await b.onPass()
  assert.match(w.replies[0].input.body.text, /^не применено: кнопка Fabric отказала/)
  assert.equal(b.records()[0].state, 'open')
  w.applyAnswer = { ok: true }
  w.answer(0, answerBlock({ words: 'SQLite, точно' }))
  await b.onPass()
  assert.equal(w.applied.length, 2)
  assert.equal(b.records()[0].state, 'applied')
})

test('an item decided on the computer is taken back: its request cancelled «решено в другом месте»', async () => {
  const w = world()
  const b = createPeopleAskBridge(w.deps)
  await b.onPass()
  w.items = []
  await b.onPass()
  assert.equal(w.cancels.length, 1)
  assert.deepEqual(w.cancels[0].input.request, 'r1')
  assert.equal(w.cancels[0].input.reason, 'решено в другом месте')
  assert.equal(w.cancels[0].project, P)
  assert.equal(b.records()[0].state, 'cancelled')
})

/** The board ending the n-th request as the PM side or its deadline would. */
const endRequest = (w, i, state) => {
  [...w.threads.values()][i][0].request.state = state
}

test('a request the board ends without the person\'s decision is asked once more while the item stays open (task 5f23ea40)', async () => {
  for (const ended of ['failed_known', 'completed', 'expired']) {
    const w = world()
    const b = createPeopleAskBridge(w.deps)
    await b.onPass()
    endRequest(w, 0, ended)
    await b.onPass()
    assert.equal(w.submits.length, 2, `${ended}: asked again in the same pass`)
    assert.equal(w.submits[1].input.idempotency.key, askKey(`question:${Q}`, 2, 2), `${ended}: under a key of its own`)
    assert.notEqual(w.submits[1].input.idempotency.key, w.submits[0].input.idempotency.key)
    assert.match(w.submits[1].input.thread.new.subject, /^Нужны вы, ещё раз: /)
    assert.equal(w.cancels.length, 0, `${ended}: an ended request is not cancelled`)
    const rec = b.records().find((r) => r.state === 'open')
    assert.equal(rec.attempt, 2)
    assert.ok(w.logs.some((l) => l.op === 'people.ask.ended' && l.detail.request_state === ended))
    // The second request ends undecided too: nothing more is sent, now or after a restart.
    endRequest(w, 1, ended)
    await b.onPass()
    await b.onPass()
    assert.equal(w.submits.length, 2, `${ended}: once more, never a third`)
    const w2 = world({ loaded: w.saved.at(-1), threads: w.threads })
    await createPeopleAskBridge(w2.deps).onPass()
    assert.equal(w2.submits.length, 0, `${ended}: a restart asks nothing again`)
  }
})

test('an ended request whose item left «Нужны вы» or whose answer was applied is not asked again', async () => {
  const w = world()
  const b = createPeopleAskBridge(w.deps)
  await b.onPass()
  w.answer(0, answerBlock())
  endRequest(w, 0, 'completed')
  await b.onPass()
  assert.equal(w.applied.length, 1)
  assert.equal(b.records()[0].state, 'applied')
  assert.equal(w.submits.length, 1, 'the person decided: nothing is asked again')
  const w2 = world()
  const b2 = createPeopleAskBridge(w2.deps)
  await b2.onPass()
  endRequest(w2, 0, 'failed_known')
  w2.items = []
  await b2.onPass()
  assert.equal(w2.submits.length, 1, 'decided elsewhere: nothing is asked again')
})

test('an ended request with an answer this pass could not judge stays open until a reading can tell', async () => {
  const w = world()
  const b = createPeopleAskBridge(w.deps)
  await b.onPass()
  w.answer(0, answerBlock())
  endRequest(w, 0, 'completed')
  w.items = []
  w.complete = false
  await b.onPass()
  assert.equal(b.records()[0].state, 'open', 'the answer waits; the request is not closed as undecided')
  assert.equal(w.submits.length, 1)
  w.items = entries([question()])
  w.complete = true
  await b.onPass()
  assert.equal(w.applied.length, 1)
  assert.equal(w.submits.length, 1)
})

test('an unreadable or partial «Нужны вы» cancels nothing and applies nothing it cannot confirm open', async () => {
  const w = world()
  const b = createPeopleAskBridge(w.deps)
  await b.onPass()
  w.answer(0, answerBlock())
  w.readFails = true
  await b.onPass()
  w.readFails = false
  w.items = []
  w.complete = false
  await b.onPass()
  assert.equal(w.cancels.length, 0)
  assert.equal(w.applied.length, 0)
  assert.equal(w.replies.length, 0, 'the answer waits for a reading that can tell')
  w.items = entries([question()])
  w.complete = true
  await b.onPass()
  assert.equal(w.applied.length, 1)
})

test('a refused submit is kept and tried again an hour later, not every pass', async () => {
  const w = world({ refuseSubmit: 'not_authorized' })
  const b = createPeopleAskBridge(w.deps)
  await b.onPass()
  await b.onPass()
  assert.equal(w.submits.length, 1)
  assert.equal(b.records()[0].state, 'unsent')
  w.refuseSubmit = null
  w.tick(61 * 60_000)
  await b.onPass()
  assert.equal(w.submits.length, 2)
  assert.equal(b.records()[0].state, 'open')
})

test('a result that could not be posted is posted on a later pass, with the same key, never decided again', async () => {
  const w = world()
  let fail = true
  const b = createPeopleAskBridge({ ...w.deps, reply: async (p, input) => { w.replies.push({ project: p, input }); return fail ? { error: { code: 'not_available', message: 'down' } } : { ok: true } } })
  await b.onPass()
  w.answer(0, answerBlock())
  await b.onPass()
  fail = false
  await b.onPass()
  assert.equal(w.applied.length, 1)
  assert.equal(w.replies.length, 2)
  assert.equal(w.replies[0].input.idempotency.key, w.replies[1].input.idempotency.key)
})

test('records survive a restart: an answered item is not decided again by a new process', async () => {
  const w = world()
  const b = createPeopleAskBridge(w.deps)
  await b.onPass()
  w.answer(0, answerBlock())
  await b.onPass()
  const saved = w.saved.at(-1)
  assert.ok(saved.every(isAskRecord))
  const w2 = world({ loaded: saved, threads: w.threads })
  const b2 = createPeopleAskBridge(w2.deps)
  await b2.onPass()
  assert.equal(w2.applied.length, 0)
  assert.equal(w2.submits.length, 0)
})

test('one pass at a time', async () => {
  const w = world()
  let release
  const b = createPeopleAskBridge({ ...w.deps, readItems: () => new Promise((r) => { release = () => r({ items: w.items, complete: true }) }) })
  const first = b.onPass()
  await b.onPass()
  release()
  await first
  assert.equal(w.submits.length, 1)
})

// ── createPeopleApply: the window's doors ──────────────────────────────────────────────────────────────────────────
function doors(over = {}) {
  const calls = []
  return {
    calls,
    answerQuestion: async (input) => { calls.push(['answer', input]); return { committed: true } },
    decideReview: async (...a) => { calls.push(['review', ...a]); return { ok: true } },
    decideProposal: async (...a) => { calls.push(['proposal', ...a]); return { ok: true } },
    grant: async (...a) => { calls.push(['grant', ...a]); return { grantId: 'g', expiresAt: 'x' } },
    admitAccess: async (...a) => { calls.push(['admit', ...a]); return { ok: true } },
    decideAccess: async (...a) => { calls.push(['access', ...a]); return { ok: true } },
    ...over
  }
}
const decided = (over = {}) => ({ option: null, text: null, words: 'слова', answerId: 'a1',
  decision: { by: 'operator', via: 'relayed-instruction', action: 'people.x', target: 'x', instruction: 'слова', at: '2026-11-16T18:01:00Z', source: { project: KIRA, thread: 't' } }, ...over })

test('a question is answered as the window answers it: the same command for the same answer, the words as the answer', async () => {
  const d = doors()
  const apply = createPeopleApply(d)
  const act = { kind: 'question', questionId: Q, projectId: P, revision: 2, options: [{ id: 'sqlite', label: 'SQLite' }] }
  assert.deepEqual(await apply(act, decided({ option: 'sqlite', words: 'Берём SQLite' })), { ok: true })
  assert.deepEqual(d.calls[0][1], { commandId: commandIdOf('a1'), questionId: Q, projectId: P, expectedRevision: 2, answer: 'Берём SQLite', chosenOption: 'sqlite', options: act.options })
  assert.match(commandIdOf('a1'), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.equal(commandIdOf('a1'), commandIdOf('a1'))
  assert.notEqual(commandIdOf('a1'), commandIdOf('a2'))
  await apply(act, decided({ option: 'fabric-delegate' }))
  assert.equal(d.calls[1][1].answer, DELEGATE_ANSWER)
  assert.equal('chosenOption' in d.calls[1][1], false)
  const refused = createPeopleApply(doors({ answerQuestion: async () => ({ committed: false, reason: 'the question was revised' }) }))
  assert.deepEqual(await refused(act, decided({ text: 'x' })), { ok: false, reason: 'кнопка Fabric отказала: the question was revised' })
})

test('a review: accept, return with the words, cancel with the words; free text returns it', async () => {
  const d = doors()
  const apply = createPeopleApply(d)
  const act = { kind: 'review', taskId: TASK }
  await apply(act, decided({ option: 'accept', words: 'Принимаю' }))
  await apply(act, decided({ option: 'return', words: 'Добавьте тесты' }))
  await apply(act, decided({ option: null, text: 'Нет логов', words: 'Нет логов' }))
  await apply(act, decided({ option: 'cancel', words: 'Не нужно' }))
  assert.deepEqual(d.calls, [['review', TASK, 'accept', 'Принимаю'], ['review', TASK, 'return', 'Добавьте тесты'], ['review', TASK, 'return', 'Нет логов'], ['review', TASK, 'cancel', 'Не нужно']])
})

test('a proposal, an allow-once and an access request go through their own doors; access carries the relayed words', async () => {
  const d = doors()
  const apply = createPeopleApply(d)
  await apply({ kind: 'proposal', proposalId: 'p1' }, decided({ option: 'decline' }))
  await apply({ kind: 'effect', projectId: P, floorClass: 'money', target: 'stripe:charge' }, decided({ option: 'allow' }))
  await apply({ kind: 'access', requestId: 'req' }, decided({ option: 'allow' }))
  assert.deepEqual(d.calls[0], ['proposal', 'p1', 'declined'])
  assert.deepEqual(d.calls[1], ['grant', P, 'money', 'stripe:charge'])
  assert.deepEqual(d.calls[2], ['admit', 'allow', 'req'])
  assert.equal(d.calls[3][0], 'access')
  assert.equal(d.calls[3][2], 'allowed')
  assert.equal(d.calls[3][3].action, 'access.allow')
  assert.equal(d.calls[3][3].instruction, 'слова')
  const refused = createPeopleApply(doors({ admitAccess: async () => ({ ok: false, message: 'Allowing a product is the person\'s step' }) }))
  assert.deepEqual(await refused({ kind: 'access', requestId: 'req' }, decided({ option: 'allow' })), { ok: false, reason: 'разрешить это можно только в окне Fabric: Allowing a product is the person\'s step' })
  const thrown = createPeopleApply(doors({ grant: async () => { throw new Error('not a floor class') } }))
  assert.deepEqual(await thrown({ kind: 'effect', projectId: P, floorClass: 'x', target: 't' }, decided({ option: 'allow' })), { ok: false, reason: 'кнопка Fabric отказала: not a floor class' })
})

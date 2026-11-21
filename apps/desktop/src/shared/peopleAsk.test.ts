// The people-ask bridge's pure half (task 11ebbf83, the operator 2026-11-16): «Нужны вы» items as board requests to the
// organization's PM agent, and the person's answer judged before Fabric applies it. Spec:
// docs/evidence/specs/2026-11-16-people-ask-bridge.md.
import { describe, expect, it } from 'vitest'
import { boardEntries, type BoardEntry, type BoardQuestion } from './board'
import type { AttentionItem } from './attention'
import {
  ANSWER_SCHEMA, ASK_SCHEMA, choicesOf, DEFAULT_PEOPLE_ROUTES, resolveRoute, routeTable, withChoice, askBody, askKey, autoRouteOf, decisionOf, hasAnswerBlock, itemOf, judgeAnswer, levelAtLeast,
  parseAnswer, parseAsk, prepareAsk, resultText, routeOf, routesOf, type PeopleAnswer
} from './peopleAsk'

const NOW = Date.parse('2026-11-16T18:00:00Z')
const P = '79000000-0000-4000-8000-0000000000a1'
const Q = '79000000-0000-4000-8000-0000000000b1'
const T = '79000000-0000-4000-8000-0000000000c1'
const R = '79000000-0000-4000-8000-0000000000d1'

function entries(questions: BoardQuestion[], attention: AttentionItem[]): BoardEntry[] {
  return boardEntries({ questions, attention, projectWeightOf: () => 1, now: new Date(NOW) })
}
const question = (over: Partial<BoardQuestion> = {}): BoardQuestion => ({
  id: Q, projectId: P, projectName: 'fabric', text: 'Какую базу берём?', kind: 'decision', askedAt: '2026-11-16T10:00:00Z',
  blocks: 1, revision: 3, servesActiveGoal: false, askedBy: { kind: 'agent', agent: 'claude-code' }, why: 'Без этого не начать миграцию',
  options: [
    { id: 'pg', label: 'PostgreSQL', consequence: 'Остаёмся на текущем стеке' },
    { id: 'sqlite', label: 'SQLite', recommended: true }
  ], ...over
})
const at = (over: Partial<AttentionItem>): AttentionItem => ({
  kind: 'review', ref: { kind: 'task', id: T }, projectId: P, projectName: 'fabric', title: 'Сделать мост', detail: null,
  since: '2026-11-10T10:00:00Z', ...over
})
const ctx = { projectId: P, projectName: 'fabric', now: NOW, allowAccess: true }

describe('itemOf: one item id per «Нужны вы» row, in the contract form <kind>:<id>', () => {
  it('names a question, a refused act, a review, a proposal and an access request; the sweep\'s rows are not asked', () => {
    const [q] = entries([question()], [])
    expect(itemOf(q)).toEqual({ item: `question:${Q}`, revision: 3, kind: 'question' })
    const [e] = entries([], [at({ kind: 'refused', ref: { kind: 'refusal', id: '42' }, grantable: { floorClass: 'money', target: 'stripe:charge', askedBecause: null } })])
    expect(itemOf(e)).toEqual({ item: 'effect:42', revision: 1, kind: 'effect' })
    const [r] = entries([], [at({})])
    expect(itemOf(r)).toEqual({ item: `review:${T}`, revision: 1, kind: 'review' })
    const [p] = entries([], [at({ kind: 'proposal', ref: { kind: 'proposal', id: R }, proposal: { id: R, depth: 3, bound: 3 } })])
    expect(itemOf(p)).toEqual({ item: `proposal:${R}`, revision: 1, kind: 'proposal' })
    const [s] = entries([], [at({ kind: 'abandoned', ref: { kind: 'task', id: T }, swept: { kind: 'overlap-unsettled', key: 'k' } as AttentionItem['swept'] })])
    expect(itemOf(s)).toBeNull()
  })
  it('the request key is people-ask:<item>:<revision> and fits the board\'s idempotency key', () => {
    expect(askKey(`question:${Q}`, 3)).toBe(`people-ask:question:${Q}:3`)
    expect(askKey(`question:${Q}`, 3)).toMatch(/^[A-Za-z0-9._:-]{8,128}$/)
    // Task 5f23ea40: the first ask keeps its 0.3.22 key, so a request already open is the same one; a second has its own.
    expect(askKey(`question:${Q}`, 3, 1)).toBe(`people-ask:question:${Q}:3`)
    expect(askKey(`question:${Q}`, 3, 2)).toBe(`people-ask:question:${Q}:3:2`)
    expect(askKey(`question:${Q}`, 3, 2)).toMatch(/^[A-Za-z0-9._:-]{8,128}$/)
  })
})

describe('prepareAsk: the request body\'s block and the act Fabric applies', () => {
  it('a question carries its options, the recommended one, free text and the architect of its project', () => {
    const [q] = entries([question()], [])
    const p = prepareAsk(q, ctx)!
    expect(p.ask).toMatchObject({
      schema: ASK_SCHEMA, item: `question:${Q}`, revision: 3, kind: 'question', project: { id: P, name: 'fabric' },
      text: 'Какую базу берём?', detail: 'Без этого не начать миграцию', recommended: 'sqlite', freeText: true,
      mayDecide: { level: 'architect', project: 'fabric' }
    })
    // The recommended option first, as on Главная; «Отдать агенту» last, only for an agent's question.
    expect(p.ask.options.map((o) => o.id)).toEqual(['sqlite', 'pg', 'fabric-delegate'])
    expect(p.ask.options[1]).toEqual({ id: 'pg', label: 'PostgreSQL', consequence: 'Остаёмся на текущем стеке' })
    expect(Date.parse(p.ask.deadline)).toBe(NOW + 7 * 24 * 3600_000)
    expect(p.act).toEqual({ kind: 'question', questionId: Q, projectId: P, revision: 3,
      options: [{ id: 'pg', label: 'PostgreSQL', consequence: 'Остаёмся на текущем стеке' }, { id: 'sqlite', label: 'SQLite' }] })
  })
  it('a person\'s own question is not delegated to an agent', () => {
    const [q] = entries([question({ askedBy: { kind: 'person', agent: null } })], [])
    expect(prepareAsk(q, ctx)!.ask.options.map((o) => o.id)).toEqual(['sqlite', 'pg'])
  })
  it('an access request is the administrator\'s, deadline its own expiry; allow only where Fabric may allow on relayed words', () => {
    const access = { requestId: R, agent: { agentId: 'kira', name: 'Кира', installedBy: null, repository: null }, callee: 'fabric', product: 'Fabric',
      connected: true, ask: [], reason: 'Хочу отвечать на запросы', incremental: false, respond: { projectName: 'fabric', capabilities: ['people.ask'] },
      requestedAt: '2026-11-16T17:55:00Z', expiresAt: '2026-11-16T18:05:00Z' }
    const [a] = entries([], [at({ kind: 'access', ref: { kind: 'access-request', id: R }, projectId: null, projectName: null, title: 'Кира', access })])
    const p = prepareAsk(a, ctx)!
    expect(p.ask).toMatchObject({ item: `access:${R}`, kind: 'access', mayDecide: { level: 'administrator', project: 'fabric' },
      deadline: '2026-11-16T18:05:00.000Z', freeText: false, recommended: null })
    expect(p.ask.options.map((o) => o.id)).toEqual(['allow', 'deny'])
    expect(p.ask.text).toContain('Кира')
    expect(p.ask.detail).toContain('Хочу отвечать на запросы')
    expect(p.act).toEqual({ kind: 'access', requestId: R })
    expect(prepareAsk(a, { ...ctx, allowAccess: false })!.ask.options.map((o) => o.id)).toEqual(['deny'])
    // An access request that expires within two minutes is not asked: nobody could answer it in time.
    expect(prepareAsk(a, { ...ctx, now: Date.parse('2026-11-16T18:04:00Z') })).toBeNull()
  })
  it('a refused act is one allow-once, the administrator\'s', () => {
    const [e] = entries([], [at({ kind: 'refused', ref: { kind: 'refusal', id: '42' }, title: 'stripe:charge', detail: 'Оплата хостинга',
      grantable: { floorClass: 'money', target: 'stripe:charge', askedBecause: 'Оплата хостинга' } })])
    const p = prepareAsk(e, ctx)!
    expect(p.ask).toMatchObject({ kind: 'effect', mayDecide: { level: 'administrator' }, freeText: false, recommended: null, detail: 'Оплата хостинга' })
    expect(p.ask.options.map((o) => o.id)).toEqual(['allow'])
    expect(p.ask.text).toContain('stripe:charge')
    expect(p.act).toEqual({ kind: 'effect', projectId: P, floorClass: 'money', target: 'stripe:charge' })
  })
  it('a review takes accept, return and cancel, and free text (a return with those words)', () => {
    const [r] = entries([], [at({ handedIn: { said: 'Мост готов, тесты зелёные', by: 'agent', at: '2026-11-16T12:00:00Z' } })])
    const p = prepareAsk(r, ctx)!
    expect(p.ask.options.map((o) => o.id)).toEqual(['accept', 'return', 'cancel'])
    expect(p.ask).toMatchObject({ kind: 'review', freeText: true, detail: 'Мост готов, тесты зелёные', mayDecide: { level: 'architect' } })
    expect(p.act).toEqual({ kind: 'review', taskId: T })
  })
  it('a proposal is accept or decline, the architect\'s', () => {
    const [p0] = entries([], [at({ kind: 'proposal', ref: { kind: 'proposal', id: R }, title: 'Передать задачу дальше', proposal: { id: R, depth: 3, bound: 3 } })])
    const p = prepareAsk(p0, ctx)!
    expect(p.ask.options.map((o) => o.id)).toEqual(['accept', 'decline'])
    expect(p.act).toEqual({ kind: 'proposal', proposalId: R })
  })
})

describe('askBody and parseAsk: Russian text for the person, then the machine block', () => {
  it('the body reads as Russian with no em dash and carries the block parseAsk reads back', () => {
    const [q] = entries([question()], [])
    const { ask } = prepareAsk(q, ctx)!
    const body = askBody(ask)
    expect(body).toMatch(/^Нужно решение в проекте «fabric»/)
    expect(body).toContain('SQLite (рекомендуется)')
    expect(body).toContain('Можно ответить своими словами')
    expect(body).not.toContain('—')
    expect(body).toContain('```json')
    expect(parseAsk(body)).toEqual(ask)
  })
})

const answer = (over: Partial<PeopleAnswer> = {}): PeopleAnswer => ({
  schema: ANSWER_SCHEMA, item: `question:${Q}`, revision: 3, option: 'sqlite', text: null, words: 'Берём SQLite',
  voice: false, decider: { key: 'cto', telegramUserId: null, level: 'architect' }, at: '2026-11-16T18:01:00Z', ...over
})
const reply = (a: unknown): string => `Ответ человека.\n\n\`\`\`json\n${JSON.stringify(a)}\n\`\`\`\n`

describe('parseAnswer: the PM agent\'s reply block', () => {
  it('reads a well-formed answer, the last fabric-people-answer block of the reply', () => {
    const text = `${reply({ schema: 'other/1' })}\n${reply(answer())}`
    expect(parseAnswer(text)).toEqual({ ok: true, answer: answer() })
  })
  it('takes a Telegram user id instead of a role key, and a voice answer', () => {
    const a = answer({ decider: { key: null, telegramUserId: 123, level: 'administrator' }, voice: true, option: null, text: 'Возьмите SQLite' })
    expect(parseAnswer(reply(a))).toEqual({ ok: true, answer: a })
  })
  it('refuses an answer without a block, without words, without a decider, with an unknown level or neither option nor text', () => {
    expect(parseAnswer('Решили, берём SQLite')).toMatchObject({ ok: false })
    expect(parseAnswer(reply(answer({ words: '  ' })))).toMatchObject({ ok: false })
    expect(parseAnswer(reply(answer({ decider: { key: null, telegramUserId: null, level: 'architect' } })))).toMatchObject({ ok: false })
    expect(parseAnswer(reply(answer({ decider: { key: 'x', telegramUserId: null, level: 'boss' as never } })))).toMatchObject({ ok: false })
    expect(parseAnswer(reply(answer({ option: null, text: null })))).toMatchObject({ ok: false })
    expect(parseAnswer(reply(answer({ at: 'вчера' })))).toMatchObject({ ok: false })
    expect(parseAnswer(reply({ ...answer(), revision: 0 }))).toMatchObject({ ok: false })
    expect(parseAnswer('```json\n{not json\n```')).toMatchObject({ ok: false })
  })
})

describe('levelAtLeast: owner > administrator > architect > member', () => {
  it('orders the four levels', () => {
    expect(levelAtLeast('owner', 'administrator')).toBe(true)
    expect(levelAtLeast('administrator', 'administrator')).toBe(true)
    expect(levelAtLeast('architect', 'administrator')).toBe(false)
    expect(levelAtLeast('member', 'architect')).toBe(false)
    expect(levelAtLeast('architect', 'architect')).toBe(true)
  })
})

describe('judgeAnswer: still open, the same revision, an option of the item, a level high enough', () => {
  const [q] = entries([question()], [])
  const { ask } = prepareAsk(q, ctx)!
  it('accepts an option of the item from a person of the level asked', () => {
    expect(judgeAnswer(ask, answer(), { revision: 3 })).toEqual({ ok: true, option: 'sqlite', text: null })
    expect(judgeAnswer(ask, answer({ decider: { key: 'o', telegramUserId: null, level: 'owner' } }), { revision: 3 })).toMatchObject({ ok: true })
  })
  it('accepts free text where the item takes it', () => {
    expect(judgeAnswer(ask, answer({ option: null, text: 'Возьмите SQLite' }), { revision: 3 })).toEqual({ ok: true, option: null, text: 'Возьмите SQLite' })
  })
  it('refuses, in Russian, an item already decided, a stale revision, another item, an unknown option and a level too low', () => {
    expect(judgeAnswer(ask, answer(), null)).toEqual({ ok: false, reason: 'пункт уже решён или снят' })
    expect(judgeAnswer(ask, answer(), { revision: 4 })).toEqual({ ok: false, reason: 'пункт изменился после вопроса: ответ на старую версию' })
    expect(judgeAnswer(ask, answer({ revision: 2 }), { revision: 3 })).toEqual({ ok: false, reason: 'ответ на другую версию пункта' })
    expect(judgeAnswer(ask, answer({ item: 'question:x' }), { revision: 3 })).toEqual({ ok: false, reason: 'ответ о другом пункте' })
    expect(judgeAnswer(ask, answer({ option: 'mysql' }), { revision: 3 })).toEqual({ ok: false, reason: 'у пункта нет варианта «mysql»' })
    expect(judgeAnswer(ask, answer({ decider: { key: 'm', telegramUserId: null, level: 'member' } }), { revision: 3 }))
      .toEqual({ ok: false, reason: 'решает архитектор или выше, а ответил участник' })
  })
  it('refuses free text where the item needs a choice', () => {
    const [e] = entries([], [at({ kind: 'refused', ref: { kind: 'refusal', id: '42' }, grantable: { floorClass: 'money', target: 'stripe:charge', askedBecause: null } })])
    const eff = prepareAsk(e, ctx)!.ask
    expect(judgeAnswer(eff, answer({ item: 'effect:42', revision: 1, option: null, text: 'да', decider: { key: 'a', telegramUserId: null, level: 'administrator' } }), { revision: 1 }))
      .toEqual({ ok: false, reason: 'для этого пункта нужно выбрать вариант' })
    expect(judgeAnswer(eff, answer({ item: 'effect:42', revision: 1, option: 'allow', decider: { key: 'a', telegramUserId: null, level: 'architect' } }), { revision: 1 }))
      .toEqual({ ok: false, reason: 'решает администратор или выше, а ответил архитектор' })
  })
})

describe('decisionOf: the person\'s words in DEC-0121\'s shape', () => {
  it('relayed, the words as the instruction (cut to 500), the item as the target, the thread as the source', () => {
    const [q] = entries([question()], [])
    const { ask } = prepareAsk(q, ctx)!
    const d = decisionOf(ask, answer({ words: 'а'.repeat(600) }), { project: P, thread: 'th-1' })
    expect(d).toEqual({ by: 'operator', via: 'relayed-instruction', action: 'people.question', target: `question:${Q}`,
      instruction: 'а'.repeat(500), at: '2026-11-16T18:01:00Z', source: { project: P, thread: 'th-1' } })
    expect(decisionOf(ask, answer(), { project: P, thread: 'th-1' }, 'access.allow').action).toBe('access.allow')
  })
})

describe('hasAnswerBlock: an answer attempt or a note (0.3.23 review, iteration 2, ER-9, DA-7)', () => {
  const fence = (tag: string, body: string): string => '```' + tag + '\n' + body + '\n```\n'
  it('a stack trace or log excerpt in an untagged fence is a note, not an attempt', () => {
    expect(hasAnswerBlock('Упало:\n' + fence('', 'Error: ENOENT\n    at open (node:fs:1)\n    at main (run.ts:12)'))).toBe(false)
    expect(hasAnswerBlock('Лог:\n' + fence('', '[12:00] started\n[12:01] waiting'))).toBe(false)
    expect(hasAnswerBlock('Лог:\n' + fence('', '{"a": 1,}'))).toBe(false)
  })
  it('an untagged fence holding a JSON object, or naming the schema, is an attempt', () => {
    expect(hasAnswerBlock(fence('', '{"item": "review:t", "revision": 1}'))).toBe(true)
    expect(hasAnswerBlock(fence('', '{"schema": "fabric-people-answer/1",}'))).toBe(true)
  })
  it('a json fence in any case is an attempt even when it does not parse; another language is a note', () => {
    expect(hasAnswerBlock(fence('json', 'not json at all'))).toBe(true)
    expect(hasAnswerBlock(fence('JSON', '{'))).toBe(true)
    expect(hasAnswerBlock(fence('bash', 'ls'))).toBe(false)
    expect(hasAnswerBlock('Ответ: fabric-people-answer/1, вариант sqlite')).toBe(true)
    expect(hasAnswerBlock('Морфеус спросил администратора в Telegram.')).toBe(false)
  })
  it('only an opener counts: the untagged fence that closes a bash block is not read as one', () => {
    expect(hasAnswerBlock(fence('bash', 'ls') + 'и ещё\n' + fence('', 'at main (run.ts:12)'))).toBe(false)
    expect(hasAnswerBlock(fence('bash', 'ls') + fence('', '{"item": "x"}'))).toBe(true)
  })
})

describe('resultText: the first line PM agents read', () => {
  it('«решено» or «не применено: <причина>», then a block', () => {
    expect(resultText({ item: 'review:t', revision: 1, applied: true }).split('\n')[0]).toBe('решено')
    expect(resultText({ item: 'review:t', revision: 1, applied: false, reason: 'пункт уже решён или снят' }).split('\n')[0]).toBe('не применено: пункт уже решён или снят')
    expect(resultText({ item: 'review:t', revision: 1, applied: true })).toContain('"schema":"fabric-people-result/1"')
  })
})

describe('routeOf, autoRouteOf and routesOf: the organization\'s PM project, by business first, then by repository owner', () => {
  const ACME_PM = '79000000-0000-4000-8000-0000000000e1'
  const ROUND = '79000000-0000-4000-8000-0000000000f1'
  const routes = [{ organization: 'Roundabout', target: ROUND, businesses: ['roundabout.io', 'roundabout'], owners: ['roundabout-io'] },
    { organization: 'Acme', target: ACME_PM, businesses: ['acme', 'acme labs'], owners: ['acme-org', 'acme-apps'] }]
  it('routes a project by the routes file the machine holds: its business first, then its repository owner', () => {
    expect(routeOf({ business: ' roundabout.io ', owner: null }, routes)?.target).toBe(ROUND)
    expect(routeOf({ business: null, owner: 'roundabout-io' }, routes)?.organization).toBe('Roundabout')
    expect(routeOf({ business: 'Acme Labs', owner: 'roundabout-io' }, routes)?.target).toBe(ACME_PM)
    expect(routeOf({ business: null, owner: 'Acme-Apps' }, routes)?.organization).toBe('Acme')
    expect(routeOf({ business: null, owner: 'someone-else' }, routes)).toBeNull()
    expect(routeOf({ business: null, owner: null }, routes)).toBeNull()
    // A business no route names is not routed by its owner either: the person recorded where it belongs.
    expect(routeOf({ business: 'Initech', owner: 'roundabout-io' }, routes)).toBeNull()
  })
  it('finds a PM project no route names by its own business or owner, never a guess between two', () => {
    const pm = (id: string, name: string, business: string | null, owner: string | null) => ({ id, name, business, owner })
    const candidates = [pm(ACME_PM, 'acme-pm', null, 'acme-org'), pm('79000000-0000-4000-8000-0000000000e2', 'initech-pm', 'Initech', 'initech')]
    expect(autoRouteOf({ id: P, business: null, owner: 'acme-org' }, candidates)).toEqual({ route: { organization: 'acme-pm', target: ACME_PM, businesses: [], owners: [] } })
    expect(autoRouteOf({ id: P, business: 'initech', owner: 'acme-org' }, candidates)).toMatchObject({ route: { organization: 'initech-pm' } })
    expect(autoRouteOf({ id: P, business: null, owner: 'initech' }, candidates)).toEqual({ why: 'none' })
    expect(autoRouteOf({ id: P, business: null, owner: 'other' }, candidates)).toEqual({ why: 'none' })
    expect(autoRouteOf({ id: ACME_PM, business: null, owner: 'acme-org' }, candidates)).toEqual({ why: 'none' })
    expect(autoRouteOf({ id: P, business: null, owner: 'acme-org' }, [...candidates, pm('79000000-0000-4000-8000-0000000000e3', 'acme-pm-2', null, 'acme-org')])).toEqual({ why: 'ambiguous' })
  })
  it('ships no route of its own (the owner, 2026-11-20): what a fresh install routes is what the person sets', () => {
    expect(DEFAULT_PEOPLE_ROUTES).toEqual([])
    expect(routeOf({ business: 'anything', owner: 'anyone' }, DEFAULT_PEOPLE_ROUTES)).toBeNull()
  })
  it('reads the routes file as a list or {routes}, and anything it cannot read as the defaults', () => {
    const mine = [{ organization: 'Acme', target: P, businesses: ['acme'], owners: ['acme-org'] }]
    expect(routesOf(mine)).toEqual(mine)
    expect(routesOf({ routes: mine })).toEqual(mine)
    expect(routesOf(undefined)).toEqual(DEFAULT_PEOPLE_ROUTES)
    expect(routesOf([{ organization: 'Acme', target: 'not-a-uuid', businesses: [], owners: [] }])).toEqual(DEFAULT_PEOPLE_ROUTES)
    expect(routesOf('yes')).toEqual(DEFAULT_PEOPLE_ROUTES)
    expect(routesOf([])).toEqual([])
  })
  it('reads and writes the person\'s choices beside the routes, keeping every other key', () => {
    const OTHER = '79000000-0000-4000-8000-0000000000e9'
    const file = { routes: [{ organization: 'Acme', target: ACME_PM, businesses: ['acme'], owners: [] }], note: 'kept' }
    const one = withChoice(file, P, { target: ACME_PM })
    expect(one).toMatchObject({ note: 'kept', routes: file.routes, projects: { [P]: { target: ACME_PM } } })
    expect(choicesOf(withChoice(one, OTHER, { off: true }))).toEqual({ [P]: { target: ACME_PM }, [OTHER]: { off: true } })
    expect(choicesOf(withChoice(one, P, null))).toEqual({})
    expect(routesOf(withChoice(one, P, null))).toEqual(file.routes)
    expect(choicesOf(withChoice([{ organization: 'Acme', target: ACME_PM, businesses: [], owners: [] }], P, { off: true }))).toEqual({ [P]: { off: true } })
    expect(() => withChoice(file, 'nope', null)).toThrow()
    expect(() => withChoice(file, P, { target: P })).toThrow()
    expect(choicesOf({ projects: { [P]: { target: 'x' }, nope: { off: true }, [OTHER]: { off: true } } })).toEqual({ [OTHER]: { off: true } })
  })
  it('resolves and tables a project\'s route: chosen, then the routes file, then the one PM project found; a PM project keeps its own', () => {
    const FOUND = '79000000-0000-4000-8000-0000000000e7'
    const OFF = '79000000-0000-4000-8000-0000000000e8'
    const projects = [
      { id: P, name: 'app', business: null, owner: 'acme-org' },
      { id: FOUND, name: 'found-pm', business: null, owner: 'lone-org' },
      { id: '79000000-0000-4000-8000-0000000000e6', name: 'lone-tool', business: null, owner: 'lone-org' },
      { id: OFF, name: 'quiet', business: 'acme', owner: null },
      { id: ACME_PM, name: 'acme-pm', business: null, owner: 'acme-org' }
    ]
    const names = new Map(projects.map((p) => [p.id, p.name] as const))
    const { rows, pms } = routeTable(projects, routes, { [OFF]: { off: true } }, new Set([FOUND, ACME_PM]), names)
    const by = (name: string) => rows.find((r) => r.project.name === name)!
    expect(by('app')).toMatchObject({ source: 'routes', organization: 'Acme', pm: { id: ACME_PM, name: 'acme-pm', live: true } })
    expect(by('lone-tool')).toMatchObject({ source: 'found', pm: { id: FOUND, name: 'found-pm', live: true } })
    expect(by('quiet')).toMatchObject({ source: 'off', pm: null })
    expect(by('acme-pm').pm?.id).toBe(ACME_PM)
    expect(pms.map((p) => p.name)).toEqual(['acme-pm', 'found-pm', 'Roundabout'.replace('Roundabout', ROUND)].sort((a, b) => a.localeCompare(b)))
    expect(resolveRoute(projects[0], routes, { [P]: { target: FOUND } }, [], (id) => names.get(id) ?? null)).toEqual({ route: { organization: 'found-pm', target: FOUND, businesses: [], owners: [] }, source: 'chosen' })
  })
})

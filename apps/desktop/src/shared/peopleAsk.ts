// #region people-ask — docs: docs/evidence/specs/2026-11-16-people-ask-bridge.md#2-the-contract-fabric-people-ask1
/**
 * The people-ask bridge's pure half (task 11ebbf83; the operator, 2026-11-16: the questions of «Нужны вы» decided from
 * Telegram, by a button, a text or a voice answer, through the organization's PM agent, by the people with the right to
 * decide them). One «Нужны вы» row becomes one board request (`fabric-people-ask/1`) to the PM project of its
 * organization; the PM agent's reply carries the person's answer (`fabric-people-answer/1`), which Fabric judges here
 * before `main/peopleAskRun.ts` applies it through the window's own doors. Every text a person reads is Russian.
 * The contract was posted on the board, thread bf635f68, message ef9a5032.
 */
import { questionHead } from './questionClarity.ts'
import type { BoardEntry } from './board.ts'

export const PEOPLE_ASK_CAPABILITY = 'people.ask'
export const ASK_SCHEMA = 'fabric-people-ask/1'
export const ANSWER_SCHEMA = 'fabric-people-answer/1'
export const RESULT_SCHEMA = 'fabric-people-result/1'
/** A request's deadline when its item has none of its own: the board's default week. */
export const ASK_DEADLINE_MS = 7 * 24 * 3600_000
/** An item whose own deadline (an access request's expiry) is closer than this is not asked: nobody answers in time. */
export const MIN_ASK_WINDOW_MS = 2 * 60_000
/** The option that hands an agent's question back to it, as «Отдать агенту» on Главная does. */
export const DELEGATE_OPTION = 'fabric-delegate'
/** What «Отдать агенту» answers (the renderer's `launch.board.delegate.answer` in Russian, the operator's language). */
export const DELEGATE_ANSWER = 'Решите сами: выберите вариант по решениям и цели проекта и запишите причину.'

export type AskKind = 'question' | 'access' | 'effect' | 'review' | 'proposal'
export type Level = 'owner' | 'administrator' | 'architect' | 'member'
/** Lowest first: an answer's level must be at least the item's `mayDecide.level`. */
export const LEVELS: readonly Level[] = ['member', 'architect', 'administrator', 'owner']
export const LEVEL_WORDS: Record<Level, string> = { owner: 'владелец', administrator: 'администратор', architect: 'архитектор', member: 'участник' }
export const levelAtLeast = (have: Level, need: Level): boolean => LEVELS.indexOf(have) >= LEVELS.indexOf(need)
const isLevel = (v: unknown): v is Level => typeof v === 'string' && (LEVELS as readonly string[]).includes(v)

export interface AskOption { id: string; label: string; consequence: string | null }
export interface PeopleAsk {
  schema: typeof ASK_SCHEMA
  item: string
  revision: number
  kind: AskKind
  project: { id: string; name: string }
  text: string
  detail: string | null
  options: AskOption[]
  recommended: string | null
  freeText: boolean
  mayDecide: { level: Exclude<Level, 'member'>; project: string }
  deadline: string
}

/** What Fabric does with an accepted answer: the door the window's button calls, and what it needs. */
export type AskAct =
  | { kind: 'question'; questionId: string; projectId: string; revision: number; options: Array<{ id: string; label: string; consequence?: string }> }
  | { kind: 'access'; requestId: string }
  | { kind: 'effect'; projectId: string | null; floorClass: string; target: string }
  | { kind: 'review'; taskId: string }
  | { kind: 'proposal'; proposalId: string }

export interface PeopleAnswer {
  schema: typeof ANSWER_SCHEMA
  item: string
  revision: number
  option: string | null
  text: string | null
  words: string
  voice: boolean
  decider: { key: string | null; telegramUserId: number | null; level: Level }
  at: string
}

/** A text on one line, cut to `max` characters (never in the middle of a surrogate pair). */
function line(s: string | null | undefined, max: number): string {
  const one = (s ?? '').replace(/\s+/g, ' ').trim()
  const chars = [...one]
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : one
}
function cut(s: string | null | undefined, max: number): string | null {
  const t = (s ?? '').trim()
  if (!t) return null
  const chars = [...t]
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : t
}

/** The item a «Нужны вы» row is asked as, in the contract's `<kind>:<id>` form; null for a row the contract leaves out
 *  (the sweep's own findings, which a person settles on the computer). */
export function itemOf(e: BoardEntry): { item: string; revision: number; kind: AskKind } | null {
  if (e.kind === 'question' && e.question) return { item: `question:${e.subject.id}`, revision: e.question.revision, kind: 'question' }
  if (e.kind === 'access' && e.access) return { item: `access:${e.access.requestId}`, revision: 1, kind: 'access' }
  if (e.kind === 'refused' && e.grantable) return { item: `effect:${e.subject.id}`, revision: 1, kind: 'effect' }
  if (e.kind === 'review' && e.subject.kind === 'task') return { item: `review:${e.subject.id}`, revision: 1, kind: 'review' }
  if (e.kind === 'proposal' && e.proposal) return { item: `proposal:${e.proposal.id}`, revision: 1, kind: 'proposal' }
  return null
}

/** The request's idempotency key (the contract's `people-ask:<item>:<revision>`). */
/** The request's idempotency key: the first ask keeps the 0.3.22 form, a later one adds its attempt (task 5f23ea40). */
export const askKey = (item: string, revision: number, attempt = 1): string => `people-ask:${item}:${revision}${attempt > 1 ? `:${attempt}` : ''}`

const FLOOR_WORDS: Record<string, string> = { money: 'трату денег', deletion: 'удаление', publication: 'публикацию' }

/**
 * The request's block and the act behind it, for one row; null for a row that is not asked (see `itemOf`) or whose own
 * deadline leaves no time. `allowAccess`: whether Fabric may allow this access request on relayed words
 * (`relayedAccess.ts#admitAccessAct`); without it the request offers only «Отказать».
 */
export function prepareAsk(e: BoardEntry, ctx: { projectId: string; projectName: string; now: number; allowAccess: boolean }): { ask: PeopleAsk; act: AskAct } | null {
  const id = itemOf(e)
  if (!id) return null
  const week = new Date(ctx.now + ASK_DEADLINE_MS).toISOString()
  const base = { schema: ASK_SCHEMA, item: id.item, revision: id.revision, kind: id.kind, project: { id: ctx.projectId, name: ctx.projectName } } as const
  const opt = (oid: string, label: string, consequence: string | null = null): AskOption => ({ id: oid, label, consequence })
  const architect = { level: 'architect' as const, project: ctx.projectName }
  const administrator = { level: 'administrator' as const, project: ctx.projectName }
  if (id.kind === 'question' && e.question) {
    const all = e.question.options
    const ordered = [...all.filter((o) => o.recommended), ...all.filter((o) => !o.recommended)]
    const options = ordered.map((o) => opt(o.id, line(o.label, 200), cut(o.consequence, 500)))
    if (e.askedBy?.kind !== 'person' && all.length > 0) options.push(opt(DELEGATE_OPTION, 'Отдать агенту', 'Агент решит сам по решениям и цели проекта и запишет почему'))
    return {
      // The turn-end spec §8: a question asked before the clarity rule goes to Telegram as its clear sentence, or as a
      // plain line saying it is unclear, with the agent's whole text in the detail.
      ask: { ...base, text: line(questionHead(e.title).headline ?? 'Агент спросил непонятно; его текст ниже. Решите или отдайте решение агенту.', 500),
        detail: cut([questionHead(e.title).more, e.why].filter(Boolean).join('\n\n') || null, 2000), options, recommended: all.find((o) => o.recommended)?.id ?? null,
        freeText: true, mayDecide: architect, deadline: week },
      act: { kind: 'question', questionId: e.subject.id, projectId: ctx.projectId, revision: e.question.revision,
        // The option's own shape, as the window sends it (`BoardPanel.tsx#submitAnswer`, DA-15).
        options: all.map(({ id: oid, label, consequence }) => (consequence === undefined ? { id: oid, label } : { id: oid, label, consequence })) }
    }
  }
  if (id.kind === 'access' && e.access) {
    const a = e.access
    if (Date.parse(a.expiresAt) - ctx.now < MIN_ASK_WINDOW_MS) return null
    const name = a.agent.name ?? a.agent.agentId
    const text = a.enroll ? `Агент «${name}» просит работать в проекте «${a.enroll.projectName}»`
      : a.respond ? `Агент «${name}» просит отвечать на запросы проекта «${a.respond.projectName}»`
        : `Агент «${name}» просит доступ к «${a.product}»`
    const options = [...(ctx.allowAccess ? [opt('allow', 'Разрешить')] : []), opt('deny', 'Отказать')]
    return {
      ask: { ...base, text: line(text, 500), detail: cut(a.reason ? `Причина агента: ${a.reason}` : null, 2000), options, recommended: null,
        freeText: false, mayDecide: administrator, deadline: new Date(Date.parse(a.expiresAt)).toISOString() },
      act: { kind: 'access', requestId: a.requestId }
    }
  }
  if (id.kind === 'effect' && e.grantable) {
    const g = e.grantable
    const what = FLOOR_WORDS[g.floorClass] ?? g.floorClass
    return {
      ask: { ...base, text: line(`Агент просит разрешить ${what}: ${g.target}`, 500), detail: cut(g.askedBecause ?? e.detail, 2000),
        options: [opt('allow', 'Разрешить один раз', 'Разрешение на это действие действует один час')], recommended: null,
        freeText: false, mayDecide: administrator, deadline: week },
      act: { kind: 'effect', projectId: e.projectId, floorClass: g.floorClass, target: g.target }
    }
  }
  if (id.kind === 'review') {
    return {
      ask: { ...base, text: line(`Проверить работу: ${e.title}`, 500), detail: cut(e.handedIn?.said ?? null, 2000),
        options: [opt('accept', 'Принять', 'Задача закрывается как сделанная'),
          opt('return', 'Вернуть в работу', 'Агент получит ваши слова как правку'),
          opt('cancel', 'Отменить задачу', 'Задача закрывается как отменённая, ваши слова станут причиной')],
        recommended: null, freeText: true, mayDecide: architect, deadline: week },
      act: { kind: 'review', taskId: e.subject.id }
    }
  }
  if (id.kind === 'proposal' && e.proposal) {
    return {
      ask: { ...base, text: line(`Агенты не договорились, решите вы: ${e.title}`, 500),
        detail: `Цепочка передач дошла до предела: ${e.proposal.depth} из ${e.proposal.bound}`,
        options: [opt('accept', 'Сделать задачей'), opt('decline', 'Завершить цепочку')], recommended: null,
        freeText: false, mayDecide: architect, deadline: week },
      act: { kind: 'proposal', proposalId: e.proposal.id }
    }
  }
  return null
}

const HEADS: Record<AskKind, string> = { question: 'Вопрос', access: 'Доступ агента', effect: 'Разовое разрешение', review: 'Проверка работы', proposal: 'Предложение' }

/** The request body: Russian text for the person, then the machine block PM agents read. */
export function askBody(ask: PeopleAsk): string {
  const lines = [`Нужно решение в проекте «${ask.project.name}».`, '', `${HEADS[ask.kind]}: ${ask.text}`]
  if (ask.detail) lines.push(ask.detail)
  if (ask.options.length) {
    lines.push('', 'Варианты:')
    ask.options.forEach((o, i) => lines.push(`${i + 1}. ${o.label}${o.id === ask.recommended ? ' (рекомендуется)' : ''}${o.consequence ? `. ${o.consequence}` : ''}`))
  }
  if (ask.freeText) lines.push('Можно ответить своими словами.')
  lines.push('', `Решить может: ${LEVEL_WORDS[ask.mayDecide.level]} проекта «${ask.mayDecide.project}» или выше. Срок: ${ask.deadline.slice(0, 16).replace('T', ' ')} UTC.`)
  return `${lines.join('\n')}\n\n\`\`\`json\n${JSON.stringify(ask)}\n\`\`\`\n`
}

/** The JSON blocks of a markdown text, in order; a block that is not JSON is skipped. */
function blocks(text: string): unknown[] {
  const out: unknown[] = []
  for (const m of text.matchAll(/```json[ \t]*\r?\n([\s\S]*?)\r?\n?```/g)) {
    try { out.push(JSON.parse(m[1])) } catch { /* not JSON: the next block is read */ }
  }
  return out
}
const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)

/** A request body's block read back (a PM agent's view of it; Fabric's own tests). */
export function parseAsk(text: string): PeopleAsk | null {
  const found = blocks(text).filter((b): b is Record<string, unknown> => isObject(b) && b.schema === ASK_SCHEMA).pop()
  return (found as PeopleAsk | undefined) ?? null
}

/**
 * Whether a reply tries to answer: it names the answer schema, or holds a fenced block tagged `json` in any case (one that
 * fails to parse included), or an untagged block whose content parses as a JSON object. Only a reply with none of these is
 * the responder's note; an attempt goes to `parseAnswer`, so a malformed one is told «не применено» and the PM side answers
 * again (0.3.23 review, iteration 1, ER-6, DA-3). An untagged block of anything else (a stack trace, a log excerpt a note
 * quotes) and a fence of another language are not attempts (iteration 2, ER-9, DA-7).
 */
export function hasAnswerBlock(text: string): boolean {
  if (/fabric-people-answer/i.test(text)) return true
  // Fences pair up in order: every other one opens a block, and only an opener's tag says what the block is.
  const fences = [...text.matchAll(/```([^\n`]*)/g)]
  return fences.some((m, i) => {
    if (i % 2 !== 0) return false
    const tag = m[1].trim()
    if (/^json$/i.test(tag)) return true
    if (tag !== '') return false
    const start = (m.index ?? 0) + m[0].length
    const content = text.slice(start, fences[i + 1]?.index ?? text.length)
    try { return isObject(JSON.parse(content)) } catch { return false }
  })
}

/** The PM agent's answer: the last `fabric-people-answer/1` block of its reply, checked field by field. */
export function parseAnswer(text: string): { ok: true; answer: PeopleAnswer } | { ok: false; reason: string } {
  const found = blocks(text).filter((b): b is Record<string, unknown> => isObject(b) && b.schema === ANSWER_SCHEMA).pop()
  if (!found) return { ok: false, reason: `в ответе нет блока ${ANSWER_SCHEMA}` }
  const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() && [...v].length <= max ? v : null)
  const item = str(found.item, 200)
  const revision = found.revision
  if (!item || typeof revision !== 'number' || !Number.isInteger(revision) || revision < 1) return { ok: false, reason: 'в ответе нет пункта или его версии' }
  const option = found.option === null || found.option === undefined ? null : str(found.option, 200)
  if (found.option !== null && found.option !== undefined && option === null) return { ok: false, reason: 'вариант ответа не читается' }
  const text0 = found.text === null || found.text === undefined ? null : str(found.text, 4000)
  if (option === null && text0 === null) return { ok: false, reason: 'в ответе нет ни варианта, ни текста' }
  const words = str(found.words, 4000)
  if (!words) return { ok: false, reason: 'в ответе нет слов человека' }
  const d = isObject(found.decider) ? found.decider : null
  const key = d && typeof d.key === 'string' && d.key.trim() ? d.key.slice(0, 200) : null
  const tg = d && typeof d.telegramUserId === 'number' && Number.isSafeInteger(d.telegramUserId) ? d.telegramUserId : null
  if (!d || (key === null && tg === null)) return { ok: false, reason: 'в ответе не сказано, кто решил' }
  if (!isLevel(d.level)) return { ok: false, reason: 'уровень решившего не читается' }
  const at = typeof found.at === 'string' && !Number.isNaN(Date.parse(found.at)) ? found.at : null
  if (!at) return { ok: false, reason: 'время ответа не читается' }
  return { ok: true, answer: { schema: ANSWER_SCHEMA, item, revision, option, text: text0, words, voice: found.voice === true,
    decider: { key, telegramUserId: tg, level: d.level }, at } }
}

/**
 * Whether the answer may be applied: the item still open at the request's revision (`open`, from this pass's reading of
 * «Нужны вы»; null when it is no longer there), the answer about this item and revision, its option one of the item's,
 * free text only where the item takes it, and the decider's level at least the item's. Reasons are Russian: Fabric posts
 * them in the thread as «не применено: <причина>».
 */
export function judgeAnswer(ask: Pick<PeopleAsk, 'item' | 'revision' | 'options' | 'freeText' | 'mayDecide'>, a: PeopleAnswer, open: { revision: number } | null):
  { ok: true; option: string | null; text: string | null } | { ok: false; reason: string } {
  if (a.item !== ask.item) return { ok: false, reason: 'ответ о другом пункте' }
  if (a.revision !== ask.revision) return { ok: false, reason: 'ответ на другую версию пункта' }
  if (!open) return { ok: false, reason: 'пункт уже решён или снят' }
  if (open.revision !== ask.revision) return { ok: false, reason: 'пункт изменился после вопроса: ответ на старую версию' }
  if (a.option !== null && !ask.options.some((o) => o.id === a.option)) return { ok: false, reason: `у пункта нет варианта «${line(a.option, 80)}»` }
  if (a.option === null && !ask.freeText) return { ok: false, reason: 'для этого пункта нужно выбрать вариант' }
  if (!levelAtLeast(a.decider.level, ask.mayDecide.level))
    return { ok: false, reason: `решает ${LEVEL_WORDS[ask.mayDecide.level]} или выше, а ответил ${LEVEL_WORDS[a.decider.level]}` }
  return { ok: true, option: a.option, text: a.option === null ? a.text : (a.text ?? null) }
}

/** The person's words as a relayed decision (fabric-agent-contract DEC-0121, `decision.schema.json`): the item is the
 *  target, the words the instruction (the schema's 500 characters), the board thread the source. */
export function decisionOf(ask: Pick<PeopleAsk, 'kind' | 'item'>, a: PeopleAnswer, source: { project: string; thread: string }, action?: string): {
  by: 'operator'; via: 'relayed-instruction'; action: string; target: string; instruction: string; at: string; source: { project: string; thread: string }
} {
  return { by: 'operator', via: 'relayed-instruction', action: action ?? `people.${ask.kind}`, target: ask.item.slice(0, 200),
    instruction: [...a.words.trim()].slice(0, 500).join(''), at: a.at, source: { project: source.project.slice(0, 200), thread: source.thread.slice(0, 200) } }
}

/** Fabric's message in the thread after judging an answer: the first line is «решено» or «не применено: <причина>». */
export function resultText(r: { item: string; revision: number; applied: true } | { item: string; revision: number; applied: false; reason: string }): string {
  const head = r.applied ? 'решено' : `не применено: ${r.reason}`
  const block = { schema: RESULT_SCHEMA, item: r.item, revision: r.revision, applied: r.applied, reason: r.applied ? null : r.reason }
  return `${head}\n\n\`\`\`json\n${JSON.stringify(block)}\n\`\`\`\n`
}

/** Task d6413458: Fabric's line in the thread when it takes an item back: «снят: <причина>», then the result block with
 *  `withdrawn: true`. Said beside the `com.cancel`, so a PM side that already took the request (the board then refuses the
 *  cancel, `reconcile_required`) still learns it and removes its buttons. */
export function withdrawnText(r: { item: string; revision: number; reason: string }): string {
  const block = { schema: RESULT_SCHEMA, item: r.item, revision: r.revision, applied: false, withdrawn: true, reason: r.reason }
  return `снят: ${r.reason}\n\n\`\`\`json\n${JSON.stringify(block)}\n\`\`\`\n`
}

// #region people-ask-routes — docs: docs/evidence/specs/2026-11-16-people-ask-bridge.md#3-routing
/** One organization's PM project: a project goes there by its recorded business, else by its repository's owner. */
export interface PeopleRoute { organization: string; target: string; businesses: string[]; owners: string[] }

/**
 * The routes this repository may name: PassionCode.ai's own (public). Every other organization's route lives on the
 * machine, in `userData/people-ask-routes.json` (`routesOf`), because its names are private (ADR-0096, CO-520); and a PM
 * project that holds a live `people.ask` responder is found without a route by its own business or repository owner
 * (`autoRouteOf`).
 */
export const DEFAULT_PEOPLE_ROUTES: readonly PeopleRoute[] = Object.freeze([
  { organization: 'PassionCode.ai', target: 'd6e9657c-6332-87fa-9585-6fe913352680', businesses: ['passioncode.ai', 'passioncode'], owners: ['passioncode-ai'] }
])

const norm = (s: string | null | undefined): string => (s ?? '').trim().toLowerCase()

/** The route of a project: by its business when one is recorded (a business no route names goes nowhere), else by the
 *  owner of its primary repository's `origin`. */
export function routeOf(facts: { business: string | null; owner: string | null }, routes: readonly PeopleRoute[]): PeopleRoute | null {
  const b = norm(facts.business)
  if (b) return routes.find((r) => r.businesses.some((x) => norm(x) === b)) ?? null
  const o = norm(facts.owner)
  return o ? routes.find((r) => r.owners.some((x) => norm(x) === o)) ?? null : null
}

/**
 * The PM project of a project no route names: among the projects that hold a live `people.ask` responder, the ONE whose
 * recorded business is the project's (when it records one), else the one whose repository has the project's owner. None,
 * or more than one, is no route: a question never goes to a guess.
 */
export function autoRouteOf(facts: { id: string; business: string | null; owner: string | null },
  candidates: ReadonlyArray<{ id: string; name: string; business: string | null; owner: string | null }>): { route: PeopleRoute } | { why: 'none' | 'ambiguous' } {
  const others = candidates.filter((c) => c.id !== facts.id)
  const b = norm(facts.business)
  const o = norm(facts.owner)
  const hits = b ? others.filter((c) => norm(c.business) === b) : o ? others.filter((c) => !norm(c.business) && norm(c.owner) === o) : []
  if (hits.length === 0) return { why: 'none' }
  if (hits.length > 1) return { why: 'ambiguous' }
  return { route: { organization: hits[0].name, target: hits[0].id, businesses: [], owners: [] } }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
/** Routes as `people-ask-routes.json` holds them (a list, or `{routes: [...]}`); a value that is not a list of routes
 *  reads as the defaults, never half-kept. */
export function routesOf(raw: unknown): PeopleRoute[] {
  const list = isObject(raw) && Array.isArray(raw.routes) ? raw.routes : raw
  if (!Array.isArray(list) || list.length > 32) return DEFAULT_PEOPLE_ROUTES.map((r) => ({ ...r, businesses: [...r.businesses], owners: [...r.owners] }))
  const words = (v: unknown): string[] | null => (Array.isArray(v) && v.length <= 32 && v.every((x) => typeof x === 'string' && x.length <= 120) ? [...v] : null)
  const out: PeopleRoute[] = []
  for (const r of list) {
    const ok = isObject(r) && typeof r.organization === 'string' && r.organization.trim() && r.organization.length <= 120
      && typeof r.target === 'string' && UUID.test(r.target) && words(r.businesses) && words(r.owners)
    if (!ok) return routesOf(undefined)
    out.push({ organization: r.organization as string, target: r.target as string, businesses: words(r.businesses)!, owners: words(r.owners)! })
  }
  return out
}
// #endregion people-ask-routes
// #endregion people-ask

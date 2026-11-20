// #region ceo-persona — docs: docs/evidence/specs/2026-11-20-ceo-persona.md#2-the-persona-on-the-home
/**
 * The CEO's persona on the home (the owner, 2026-11-20, 23:00, `userData/ceo/inbox/2026-11-20-home-questions-ceo-persona-
 * voice-brief.md`, points 3 and 4): a header with the CEO's face and analytics that speak, a line about the owner's
 * projects that is alive, an alarm in plain words when a project is on fire, and a manner that follows how the owner
 * talks. The character itself is the spec above (`PERSONA_VERSION`); the words are this module's banks.
 *
 * Pure. The home's reading (`shared/homeLive.ts#HomeView`) is the only source of fact: a line never names a number or a
 * project the reading does not hold, and an unread reading says it is unread, never that all is calm.
 * A fire is an episode (the agents base's `alert-episodes` pattern): open after two hot readings in a row, closed after
 * two calm ones, an unread reading changing neither.
 */
import type { HomeView } from './homeLive.ts'

/** The character's version: the spec's section 3 changes it, and a line bank is never edited in place without it. */
export const PERSONA_VERSION = 'ceo-persona/1'

/** A project's heat at or above this is a fire. */
export const FIRE_HEAT = 3
const REVIEW_OLD_MS = 3 * 86_400_000
const OPEN_AFTER = 2
const CLOSE_AFTER = 2

export interface Heat { heat: number; name: string; why: { abandoned: number; reviewOld: number; stalled: boolean } }

/** Each project's heat from one reading: abandoned work counts twice, a review older than three days once, work in
 *  progress with no live agent once. */
export function projectHeat(view: HomeView, now: number): Map<string, Heat> {
  const out = new Map<string, Heat>()
  const at = (id: string, name: string): Heat => {
    let h = out.get(id)
    if (!h) { h = { heat: 0, name, why: { abandoned: 0, reviewOld: 0, stalled: false } }; out.set(id, h) }
    if (!h.name && name) h.name = name
    return h
  }
  for (const a of view.abandoned ?? []) { const h = at(a.projectId, a.projectName); h.why.abandoned++; h.heat += 2 }
  for (const r of view.review) {
    if (r.since && now - Date.parse(r.since) > REVIEW_OLD_MS) { const h = at(r.projectId, r.projectName); h.why.reviewOld++; h.heat += 1 }
  }
  for (const p of view.projects) {
    if (p.inWork > 0 && p.live === 0) { const h = at(p.projectId, ''); h.why.stalled = true; h.heat += 1 }
  }
  return out
}

export interface Episode { open: boolean; hot: number; calm: number; name: string; why: Heat['why'] }

/** One step of the fire episodes. `heat` null: the reading was not read, and nothing moves. */
export function stepEpisodes(prev: ReadonlyMap<string, Episode>, heat: ReadonlyMap<string, Heat> | null): Map<string, Episode> {
  const next = new Map<string, Episode>()
  for (const [k, e] of prev) next.set(k, { ...e })
  if (!heat) return next
  const ids = new Set([...prev.keys(), ...heat.keys()])
  for (const id of ids) {
    const h = heat.get(id)
    const e = next.get(id) ?? { open: false, hot: 0, calm: 0, name: h?.name ?? '', why: h?.why ?? { abandoned: 0, reviewOld: 0, stalled: false } }
    if (h && h.heat >= FIRE_HEAT) { e.hot++; e.calm = 0; e.why = h.why; if (h.name) e.name = h.name } else { e.calm++; e.hot = 0 }
    if (!e.open && e.hot >= OPEN_AFTER) e.open = true
    if (e.open && e.calm >= CLOSE_AFTER) e.open = false
    // A project long calm is forgotten, so the map does not grow with every project ever seen; a just-closed episode
    // stays a few readings so its close is seen.
    if (!e.open && e.calm > CLOSE_AFTER * 2) next.delete(id)
    else next.set(id, e)
  }
  return next
}

export interface Manner { lang: 'ru' | 'en' | null; casual: boolean; swears: boolean; short: boolean }

const STRONG = /(бля|хуй|хуё|пизд|ёб|еба|fuck|shit)/iu
const CASUAL = /(^|\s)(ну|короче|типа|давай|блин|чё|ок|ага|прикол|hey|yo|gonna|wanna|lol|ok)(?=[\s,.!?]|$)/iu

/** How the owner talks, from his own recent messages to the CEO: never from anyone else's words. */
export function ownerManner(messages: readonly string[]): Manner {
  const text = messages.filter((m) => typeof m === 'string').join('\n')
  if (!text.trim()) return { lang: null, casual: false, swears: false, short: false }
  const cyr = (text.match(/[а-яё]/giu) ?? []).length, lat = (text.match(/[a-z]/giu) ?? []).length
  const words = messages.map((m) => m.trim().split(/\s+/).filter(Boolean).length)
  const avg = words.reduce((a, b) => a + b, 0) / Math.max(1, words.length)
  return { lang: cyr >= lat ? 'ru' : 'en', casual: CASUAL.test(text) || STRONG.test(text), swears: STRONG.test(text), short: avg <= 3 }
}

export type Mood = 'alarm' | 'asks' | 'busy' | 'calm' | 'quiet' | 'unknown'
export interface CeoLine { mood: Mood; text: string; projectId?: string }

type Bank = Record<'ru' | 'en', Record<string, readonly string[]>>
/** The lines. `{p}` a project's name, `{n}` a number, `{why}` what makes the fire. Changed only with PERSONA_VERSION. */
const LINES: Bank = {
  ru: {
    alarm: ['На {p} горит: {why}. Глянем?', 'В {p} тревога: {why}. Я бы начал оттуда.', '{p} просит внимания: {why}.'],
    alarmSalty: ['Блин, на {p} пожар: {why}.', 'Так, {p} горит: {why}. Разберёмся?'],
    asks: ['Вас ждут {n}: без вас не сдвинутся.', 'На столе {n} решений для вас.', '{n} ждут вашего слова, остальное идёт само.'],
    busy: ['Работают {n}, держу руку на пульсе.', 'В деле {n} агентов, пока всё по плану.', '{n} в работе, жарче всего в {p}.'],
    calm: ['Всё спокойно: никто не ждёт, ничего не горит.', 'Тихо. Самое время поставить новую задачу.', 'Проекты дышат ровно.'],
    unknown: ['Не вижу, что происходит: чтение не пришло. Числа ниже прошлые.']
  },
  en: {
    alarm: ['{p} is on fire: {why}. Take a look?', 'Trouble in {p}: {why}. I would start there.', '{p} needs you: {why}.'],
    alarmSalty: ['Damn, {p} is burning: {why}.', 'Right, {p} is on fire: {why}. Shall we?'],
    asks: ['{n} wait for you and will not move without you.', '{n} decisions on your desk.', '{n} wait for your word; the rest runs itself.'],
    busy: ['{n} at work, I keep an eye on them.', '{n} agents on it, all on plan so far.', '{n} at work, busiest in {p}.'],
    calm: ['All calm: nobody waits, nothing burns.', 'Quiet. A good moment for a new task.', 'The projects breathe evenly.'],
    unknown: ['I cannot see what happens: the reading did not come. The numbers below are the last ones.']
  }
}

function whyText(why: Heat['why'], l: 'ru' | 'en'): string {
  const parts: string[] = []
  if (why.abandoned) parts.push(l === 'ru' ? `брошено задач: ${why.abandoned}` : `${why.abandoned} dropped`)
  if (why.reviewOld) parts.push(l === 'ru' ? `ждут проверки дольше трёх дней: ${why.reviewOld}` : `${why.reviewOld} in review over three days`)
  if (why.stalled) parts.push(l === 'ru' ? 'работа стоит без агента' : 'work stands with no agent')
  return parts.join(', ')
}

const pick = (lines: readonly string[], seed: number): string => lines[Math.abs(Math.floor(seed)) % lines.length]!

/** The CEO's one line now. `seed` rotates the wording (the host passes something that changes slowly, such as the
 *  reading's hour and minute bucket), never the facts. */
export function ceoLine(input: { view: HomeView | null; waiting: number | null; episodes: ReadonlyMap<string, Episode>; manner: Manner; locale: string; hour: number; seed: number }): CeoLine {
  const l: 'ru' | 'en' = input.locale === 'en' ? 'en' : 'ru'
  const B = LINES[l]
  if (!input.view) return { mood: 'unknown', text: pick(B.unknown!, input.seed) }
  const fires = [...input.episodes.entries()].filter(([, e]) => e.open && e.name)
  if (fires.length) {
    const [id, e] = fires.sort((a, b) => (b[1].why.abandoned * 2 + b[1].why.reviewOld) - (a[1].why.abandoned * 2 + a[1].why.reviewOld))[0]!
    const bank = input.manner.swears ? B.alarmSalty! : B.alarm!
    return { mood: 'alarm', projectId: id, text: pick(bank, input.seed).replace('{p}', e.name).replace('{why}', whyText(e.why, l)) }
  }
  if (input.waiting && input.waiting > 0) return { mood: 'asks', text: pick(B.asks!, input.seed).replace('{n}', String(input.waiting)) }
  const v = input.view
  const working = v.atWork ? v.atWork.agents : v.live.length
  if (working > 0) {
    const top = [...v.projects].sort((a, b) => (b.atWork ?? b.live) - (a.atWork ?? a.live))[0]
    const name = top ? (v.displayNames?.[top.projectId] as { name?: string } | undefined)?.name ?? v.inWork.find((w) => w.projectId === top.projectId)?.projectName ?? null : null
    const bank = name ? B.busy! : B.busy!.filter((s) => !s.includes('{p}'))
    return { mood: 'busy', text: pick(bank, input.seed).replace('{n}', String(working)).replace('{p}', name ?? '') }
  }
  return { mood: 'calm', text: pick(B.calm!, input.seed) }
}

export interface StatSentences { working: string | null; review: string | null; abandoned: string | null }

/** What each of the three numbers means today, in one short phrase; null when the number says it all. */
export function statSentences(view: HomeView, names: ReadonlyMap<string, string>, locale: string): StatSentences {
  const l = locale === 'en' ? 'en' : 'ru'
  const nameOf = (id: string, fallback?: string): string => names.get(id) ?? fallback ?? ''
  const busiest = [...view.projects].filter((p) => (p.atWork ?? p.live) > 0).sort((a, b) => (b.atWork ?? b.live) - (a.atWork ?? a.live))[0]
  const working = busiest && nameOf(busiest.projectId) ? (l === 'ru' ? `больше всего в ${nameOf(busiest.projectId)}` : `most in ${nameOf(busiest.projectId)}`) : null
  const old = view.reviewOld ?? 0
  const review = old > 0 ? (l === 'ru' ? `${old} ждут дольше трёх дней` : `${old} waiting over three days`) : null
  const byProject = new Map<string, { n: number; name: string }>()
  for (const a of view.abandoned ?? []) { const c = byProject.get(a.projectId) ?? { n: 0, name: nameOf(a.projectId, a.projectName) }; c.n++; byProject.set(a.projectId, c) }
  const worst = [...byProject.values()].sort((a, b) => b.n - a.n)[0]
  const abandoned = worst ? (l === 'ru' ? `чаще всего в ${worst.name}` : `mostly in ${worst.name}`) : null
  return { working, review, abandoned }
}
// #endregion ceo-persona

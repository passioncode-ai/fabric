// 0.3.12 review UX-14, UX-10: counts said with Russian plural forms («Вас ждут 3 решения», «1 сообщение»), never a
// noun in the genitive plural after a colon; English has one and the rest.
import { describe, expect, it } from 'vitest'
import { pluralForm, translator } from './translate.ts'

describe('a count in its plural form', () => {
  it('picks one, few or many by the locale\'s rules', () => {
    expect([1, 2, 4, 5, 11, 21, 22, 25].map((n) => pluralForm('ru', n))).toEqual(['one', 'few', 'few', 'many', 'many', 'one', 'few', 'many'])
    expect([1, 2, 5, 21].map((n) => pluralForm('en', n))).toEqual(['one', 'many', 'many', 'many'])
  })
  it('the greeting says what waits, counted truthfully, and the late greeting is a greeting', () => {
    const ru = translator('ru'), en = translator('en')
    const greet = (t: typeof ru, locale: 'ru' | 'en', n: number) => t(`launch.home.greet.waiting.${pluralForm(locale, n)}`, { count: n })
    expect([1, 3, 5].map((n) => greet(ru, 'ru', n))).toEqual(['Вас ждёт 1 решение.', 'Вас ждут 3 решения.', 'Вас ждут 5 решений.'])
    expect([1, 3].map((n) => greet(en, 'en', n))).toEqual(['1 decision waits for you.', '3 decisions wait for you.'])
    expect(en('launch.home.greet.night')).toBe('Good evening.')
  })
})

describe('the words a person reads, not the records behind them (0.3.12 review UX-14, UX-15, UX-17)', () => {
  it('«Прочитано не всё» names what is missing in the person\'s terms, without leases', async () => {
    const { en } = await import('./en')
    const { ru } = await import('./ru')
    const what = (r: Record<string, string>) => Object.entries(r).filter(([k]) => k.startsWith('launch.home.work.cappedWhat.')).map(([, v]) => v).join(' | ')
    expect(what(en)).not.toMatch(/lease|claim/i)
    expect(what(ru as Record<string, string>)).not.toMatch(/аренд|занятые задачи/i)
  })
  it('Comms calls a thread «ветка», as its tab does', async () => {
    const { ru } = await import('./ru')
    const said = Object.entries(ru as Record<string, string>).filter(([k]) => k.startsWith('launch.comms.')).filter(([, v]) => /тред/i.test(v))
    expect(said.map(([k]) => k)).toEqual([])
  })
  it('a topic the person added is theirs: «вы спросили», not «спрашивает человек»', async () => {
    const { en } = await import('./en')
    const { ru } = await import('./ru')
    expect(ru['needsYou.askedByPerson']).toBe('вы спросили')
    expect(en['needsYou.askedByPerson']).toBe('you asked')
  })
  // 0.3.12 review, iteration 3, UX-8: «Среди 1 самого нового поста…», «посты: 1» and «Не прочитан этот:».
  it('the Comms feed\'s one form reads for 1 and for 21, and one unread repository is «один»', () => {
    const ru = translator('ru')
    const said = (key: 'short' | 'noWaiting', n: number) => ru(`launch.comms.feed.${key}.${pluralForm('ru', n)}`, { count: n })
    expect(said('short', 1)).toMatch(/^Показан 1 последний найденный пост\./)
    expect(said('short', 21)).toMatch(/^Показан 21 последний найденный пост\./)
    expect(said('noWaiting', 1)).toMatch(/^Прочитан 1 самый новый пост: просьб, которые ждут ответа, нет\./)
    expect(said('noWaiting', 21)).toMatch(/^Прочитан 21 самый новый пост:/)
    expect(ru('launch.profile.peopleSomeOne')).toMatch(/Не прочитан один:$/)
  })
})

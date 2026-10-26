// SW-9: abandoned work the sweep found carries its kind as a value; every list says it through `detailOf`, in the
// operator's language, never the machine's word. A lease's detail and a question's are unchanged.
import { describe, expect, it } from 'vitest'
import type { AbandonedKind } from '../../shared/abandonedSweep.ts'
import { detailOf, notifyLineOf, titleOf } from './attentionTitle'
import { en } from './i18n/en'
import { ru } from './i18n/ru'
import { translator } from './i18n/translate'

const KINDS: AbandonedKind[] = ['claim-silent', 'claim-lapsed', 'task-unclaimed', 'request-unmoved', 'answer-unread', 'terminal-stalled']

describe('the detail of a row the sweep found (SW-9)', () => {
  it('says each of the six kinds in English and in Russian', () => {
    for (const kind of KINDS) {
      const item = { kind: 'abandoned', detail: kind, swept: { kind } }
      expect(detailOf(item, translator('en'), 'en')).toBe(en[`attention.swept.${kind}`])
      expect(detailOf(item, translator('ru'), 'ru')).toBe(ru[`attention.swept.${kind}`])
      expect(detailOf(item, translator('ru'), 'ru')).not.toBe(kind)
    }
  })

  it('leaves an expired lease\'s detail as it was', () => {
    expect(detailOf({ kind: 'abandoned', detail: 'session-1' }, translator('en'), 'en')).toBe('session-1')
  })
})

// 0.3.13 review, iteration 1, UX-7: a finding whose title was not read is named in words, never by its id, and the
// notification says what was found and why.
describe('the title of a row the sweep found with no title read', () => {
  const untitled = (kind: AbandonedKind) => ({ kind: 'abandoned', title: '', detail: kind, swept: { kind, untitled: true as const } })
  it('names a request, an answer and a task in words, in English and in Russian', () => {
    expect(titleOf(untitled('request-unmoved'), translator('en'))).toBe(en['attention.untitled.request'])
    expect(titleOf(untitled('answer-unread'), translator('ru'))).toBe(ru['attention.untitled.answer'])
    for (const kind of ['claim-silent', 'claim-lapsed', 'task-unclaimed', 'terminal-stalled'] as const)
      expect(titleOf(untitled(kind), translator('ru'))).toBe(ru['attention.untitled.task'])
  })
  it('a notification says the title and why, in the interface\'s language', () => {
    expect(notifyLineOf(untitled('request-unmoved'), translator('ru'), 'ru')).toBe(`${ru['attention.untitled.request']}: ${ru['attention.swept.request-unmoved']}`)
    const titled = { kind: 'abandoned', title: 'Fix the login', detail: 'claim-silent', swept: { kind: 'claim-silent' as const } }
    expect(notifyLineOf(titled, translator('en'), 'en')).toBe(`Fix the login: ${en['attention.swept.claim-silent']}`)
    // Any other row is told by its title alone, as before.
    expect(notifyLineOf({ kind: 'review', title: 'Ship it', detail: null }, translator('en'), 'en')).toBe('Ship it')
  })
})

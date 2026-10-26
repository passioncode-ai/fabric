// SW-9: abandoned work the sweep found carries its kind as a value; every list says it through `detailOf`, in the
// operator's language, never the machine's word. A lease's detail and a question's are unchanged.
import { describe, expect, it } from 'vitest'
import type { AbandonedKind } from '../../shared/abandonedSweep.ts'
import { detailOf } from './attentionTitle'
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

// 0.3.7 review i3 UX-1: an executor's refusal code reaches the person only through `whyWords`; a code with its own
// sentence that `WHY` does not list falls to the generic «Fabric не может это отменить». Every `act.why.*` key but
// `other` must be reachable.
import { describe, expect, it } from 'vitest'
import { en } from '../i18n/en'
import { ru } from '../i18n/ru'
import { translator } from '../i18n/translate'
import { whyWords } from './actWords'

describe('whyWords', () => {
  for (const [name, table] of [['en', en], ['ru', ru]] as const) {
    it(`says every act.why sentence of ${name}, none falls to the generic one`, () => {
      const t = translator(name)
      const codes = Object.keys(table).filter((k) => k.startsWith('act.why.') && k !== 'act.why.other').map((k) => k.slice('act.why.'.length))
      const generic = (table as Record<string, string>)['act.why.other']
      const unreachable = codes.filter((c) => whyWords(t, c) === generic && (table as Record<string, string>)[`act.why.${c}`] !== generic)
      expect(unreachable).toEqual([])
    })
  }
  it('names an attested run in its own words', () => {
    expect(whyWords(translator('ru'), 'already_attested')).toBe(ru['act.why.already_attested'])
  })
})

describe('a revoked credential names its agent in История (CO-353)', () => {
  it('says which agent, and «an agent» only when the record carries none', async () => {
    const { actSentence } = await import('./actWords')
    const t = translator('en')
    const rec = (agent: string | null) => ({ v: 1 as const, kind: 'agent.disconnect' as never, category: 'agents' as never, subject: { type: 'agent', id: 'b1', label: agent },
      said: { key: 'act.agent.disconnect', params: { agent } }, inverse: null, why_not: 'credential_gone' as never, undoes: null, ref_seq: null })
    expect(actSentence(t, rec('codex'))).toBe(en['act.agent.disconnect'].replace('{agent}', 'Codex'))
    expect(actSentence(t, rec('Kilo'))).toBe(en['act.agent.disconnect'].replace('{agent}', 'Kilo'))
    expect(actSentence(t, rec(null))).toBe(en['act.agent.disconnect'].replace('{agent}', en['acts.actor.agent']))
  })
})

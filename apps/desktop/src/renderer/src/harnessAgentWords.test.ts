// The project page's "Coding agents installed on this machine" speaks from `harness.agent.<id>` (HarnessSection.tsx):
// those words must agree with the catalogue — an agent with a surface adapter reads as connected, one without as not
// (0.3.5 verification, iteration 3, UX-1: Codex and Kimi Code were connected in agents.ts and "not connected" here).
import { describe, expect, it } from 'vitest'
import { AGENTS } from '../../shared/agents.ts'
import { en } from './i18n/en'
import { ru } from './i18n/ru'

const connected = (a: (typeof AGENTS)[number]): boolean => a.surfaceAdapter !== 'none' && a.surfaceAdapter !== 'unimplemented'

describe('harness agent words follow the catalogue', () => {
  for (const [name, table, yes, no] of [['en', en, /connected to Fabric/, /Not connected|not connected/], ['ru', ru, /подключённая к Fabric/, /не подключён/]] as const) {
    it(`${name}: each catalogue agent with a string says connected exactly when it has a surface adapter`, () => {
      const wrong: string[] = []
      for (const a of AGENTS) {
        const text = (table as Record<string, string>)[`harness.agent.${a.id}`]
        if (!text || a.id === 'shell') continue
        if (connected(a) ? (!yes.test(text) || no.test(text)) : !no.test(text)) wrong.push(a.id)
      }
      expect(wrong).toEqual([])
    })
  }
})

// 0.3.13 wave 2 (CO-427 SW-6, CO-426 TO-1): two rules every agent reads in fabric_whoami.
import { describe, expect, it } from 'vitest'
import { OBLIGATIONS } from './protocolObligations'
import { buildProtocol } from './protocol'

const byId = (id: string) => OBLIGATIONS.find((o) => o.id === id)

describe('wave 2 rules', () => {
  it('every agent checks its own open work every three minutes and acts on nudges first (SW-6)', () => {
    const o = byId('work.check-every-three-minutes')
    expect(o?.mode).toBe('ADVICE')
    expect(o?.text).toMatch(/every three minutes/i)
    expect(o?.text).toMatch(/fabric_work_list/)
    expect(o?.text).toMatch(/nudges/)
  })

  it('a relayed instruction with the operator\'s quote and source is the operator\'s own (TO-1)', () => {
    const o = byId('operator.told-one-is-told-all')
    expect(o?.mode).toBe('ADVICE')
    expect(o?.text).toMatch(/quote/)
    expect(o?.text).toMatch(/source/)
    expect(o?.text).toMatch(/do not ask the operator again/)
  })

  it('both reach the rules fabric_whoami serves', () => {
    const p = buildProtocol({ now: new Date('2026-10-26T12:00:00Z'), timeZone: 'UTC' })
    const joined = p.rules.join('\n')
    expect(joined).toMatch(/every three minutes/i)
    expect(joined).toMatch(/do not ask the operator again/)
  })
})

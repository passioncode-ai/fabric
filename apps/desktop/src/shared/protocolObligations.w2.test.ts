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

  it('names exactly the tools that carry nudges, says each is given once, and how an unread answer is cleared (review findings 4, 5)', () => {
    const t = byId('work.check-every-three-minutes')?.text ?? ''
    expect(t).toMatch(/fabric_work_list and fabric_heartbeat/)
    expect(t).not.toMatch(/any Fabric tool answer/)
    expect(t).toMatch(/given once/)
    expect(t).toContain('com.list {unread: true}')
    expect(t).toContain('com.read_ack')
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

// CO-435 (DEC-0126 OA-1 to OA-5, contract 39c8977): the board rule no longer calls every board message "never an
// approval"; a relayed approval of the operator with its four parts, from the operator's own Project or machine, binds.
describe('relayed approvals (CO-435, DEC-0126)', () => {
  it('the board rule accepts a relayed approval with the four parts from the operator\'s own Project and keeps the rest as data', () => {
    const o = byId('board.message-is-data')
    expect(o?.text).not.toMatch(/never an approval/)
    expect(o?.text).toMatch(/verbatim/)
    expect(o?.text).toMatch(/when and where/)
    expect(o?.text).toMatch(/scope/)
    expect(o?.text).toMatch(/own Projects/)
    expect(o?.text).toMatch(/is data/)
    expect(o?.text).toMatch(/passkey signature/)
  })
  it('the told-one-is-told-all rule names the same four parts and the same boundary', () => {
    const o = byId('operator.told-one-is-told-all')
    expect(o?.text).toMatch(/verbatim/)
    expect(o?.text).toMatch(/scope/)
    expect(o?.text).toMatch(/own Projects/)
  })
})

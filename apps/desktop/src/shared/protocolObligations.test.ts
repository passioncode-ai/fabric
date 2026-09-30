import { describe, expect, it } from 'vitest'
import { OBLIGATIONS, coverageFor, labelled } from './protocolObligations.ts'

const byId = (id: string) => OBLIGATIONS.find((o) => o.id === id)!

describe('a rule says what kind of rule it is', () => {
  it('labels an enforced rule so an agent can tell it from a suggestion', () => {
    // Eight flat imperatives read as eight walls. An agent that discovers one
    // was advice stops believing the rest.
    expect(labelled(byId('scope.one-project'))).toMatch(/^\[ENFORCED\]/)
    expect(labelled(byId('progress.report-stage'))).toMatch(/^\[ADVICE\]/)
    expect(labelled(byId('claims.are-yours'))).toMatch(/^\[WATCHED\]/)
  })

  it('calls "claim before working" ADVICE, because nothing checks it', () => {
    // MEASURED: no lease is consulted before a move. The old wording asked for
    // something no mechanism holds, in the same voice as the rules that do.
    const o = byId('claim.before-working')
    expect(o.mode).toBe('ADVICE')
    expect(o.text).toMatch(/Nothing stops you skipping this/)
  })

  it('every REFUSED rule names the symbol that refuses', () => {
    // A sentence cannot refuse. The gate resolves these against the tree, so a
    // rule cannot keep saying ENFORCED about a symbol nobody kept.
    for (const o of OBLIGATIONS.filter((o) => o.mode === 'REFUSED')) {
      expect(o.enforcementPoint).toBeTruthy()
      expect(o.enforcementPoint).toMatch(/^(apps|supabase\/migrations)\/.+#\w+$/)
    }
  })

  it('every OBSERVED rule names what is recorded', () => {
    for (const o of OBLIGATIONS.filter((o) => o.mode === 'OBSERVED'))
      expect(o.evidence && o.evidence.length > 20).toBe(true)
  })

  it('states the floor as Fabric-mediated rather than as an absolute', () => {
    // A native CLI can write a file or call an API without passing this door.
    // "Never" where only "never through here" holds is a guarantee the product
    // does not have.
    const o = byId('floor.ask-first')
    expect(o.scope).toBe('fabric_mediated')
    expect(o.text).toMatch(/THROUGH Fabric/)
    expect(o.text).toMatch(/Fabric cannot stop/)
  })

  it('claims nothing as native_too, because no runner is certified', () => {
    expect(OBLIGATIONS.every((o) => o.scope === 'fabric_mediated')).toBe(true)
  })
})

describe('coverage keeps unsupported and unknown apart', () => {
  it('reports enforced only where the runner can participate', () => {
    const rows = coverageFor({ obligations: OBLIGATIONS, supported: () => true })
    expect(rows.find((r) => r.obligationId === 'scope.one-project')?.status).toBe('enforced')
    expect(rows.find((r) => r.obligationId === 'progress.report-stage')?.status).toBe('observed')
  })

  it('says UNSUPPORTED for a capability the runner does not have', () => {
    const rows = coverageFor({ obligations: OBLIGATIONS, supported: () => false })
    expect(rows.every((r) => r.status === 'unsupported')).toBe(true)
  })

  it('says UNKNOWN for a runner nobody has measured, never enforced', () => {
    // Reporting it as enforced because the obligation says REFUSED is the same
    // "recognised by name" inference M181 refuses.
    const rows = coverageFor({ obligations: OBLIGATIONS, supported: () => 'unknown' })
    expect(rows.every((r) => r.status === 'unknown')).toBe(true)
  })

  it('does not conflate the two', () => {
    const mixed = coverageFor({
      obligations: OBLIGATIONS,
      supported: (id) => (id === 'delivery.confirm' ? false : 'unknown')
    })
    expect(mixed.find((r) => r.obligationId === 'delivery.confirm')?.status).toBe('unsupported')
    expect(mixed.find((r) => r.obligationId === 'scope.one-project')?.status).toBe('unknown')
  })
})

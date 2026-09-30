import { describe, expect, it } from 'vitest'
import {
  isolationByHome,
  mayReportContinuation,
  receiptProblems,
  type ProviderCapabilityReceipt
} from './providerCapability.ts'
import { CAPABILITY_MATRIX as CURRENT_MATRIX, PINNED_BUILDS as CURRENT_BUILDS, HISTORICAL_CAPABILITY_MATRIX as CAPABILITY_MATRIX, HISTORICAL_PINNED_BUILDS as PINNED_BUILDS } from './providerCapabilityMatrix.ts'

const receipt = (over: Partial<ProviderCapabilityReceipt> = {}): ProviderCapabilityReceipt => ({
  provider: 'claude-code',
  cliBuild: '2.1.236',
  runtime: 'darwin-arm64 host',
  capability: 'identity-read',
  status: 'supported',
  evidenceRef: 'a command was run and this is what it printed, at length',
  checkedAt: '2026-09-10',
  ...over
})

describe('a capability is a measurement or it is not a capability', () => {
  it('accepts a receipt that names what was observed', () => {
    expect(receiptProblems(receipt())).toEqual([])
  })

  it('refuses `supported` with nothing behind it', () => {
    // The card's own instruction, as a branch: do not report supported from
    // reading somebody else's README.
    const p = receiptProblems(receipt({ evidenceRef: 'it works' }))
    expect(p.some((s) => /without naming what was observed/.test(s))).toBe(true)
  })

  it('refuses `unsupported` with nothing behind it either', () => {
    // An absence somebody checked and an absence nobody looked for read
    // identically, which is why both directions need evidence.
    const p = receiptProblems(receipt({ status: 'unsupported', evidenceRef: 'no' }))
    expect(p.some((s) => /read identically/.test(s))).toBe(true)
  })

  it('refuses `unverified` that does not name the test that would settle it', () => {
    const p = receiptProblems(receipt({ status: 'unverified', evidenceRef: 'not looked at' }))
    expect(p.some((s) => /would settle it/.test(s))).toBe(true)
  })

  it('accepts `unverified` that does name it', () => {
    expect(
      receiptProblems(
        receipt({ status: 'unverified', evidenceRef: 'settling it requires a certified run with a real account' })
      )
    ).toEqual([])
  })

  it('refuses a receipt with no CLI build', () => {
    // A capability of somebody else's program is a property of its version.
    const p = receiptProblems(receipt({ cliBuild: '' }))
    expect(p.some((s) => /rumour/.test(s))).toBe(true)
  })

  it('refuses a receipt with no observation date', () => {
    expect(receiptProblems(receipt({ checkedAt: 'recently' })).length).toBeGreaterThan(0)
  })
})

describe('whether an operator may be told their conversation continued', () => {
  const acked = (status: ProviderCapabilityReceipt['status']): ProviderCapabilityReceipt[] => [
    receipt({
      capability: 'native-resume-ack',
      status,
      evidenceRef:
        status === 'unverified'
          ? 'settling it requires a certified run against a saved conversation'
          : 'a resume was driven and the restored context was compared against what was saved'
    })
  ]

  it('is allowed only with a supported ack', () => {
    expect(mayReportContinuation(acked('supported'), 'claude-code', '2.1.236').allowed).toBe(true)
  })

  it('is refused when the ack is unverified, and says so in the provider’s own terms', () => {
    // The design's sentence — the fallback is never reported as successful
    // continuation — as a branch rather than a paragraph.
    const v = mayReportContinuation(acked('unverified'), 'claude-code', '2.1.236')
    expect(v.allowed).toBe(false)
    expect(v.reason).toMatch(/unverified/)
  })

  it('is refused when nothing has been observed at all', () => {
    const v = mayReportContinuation([], 'claude-code', '2.1.236')
    expect(v.allowed).toBe(false)
    expect(v.reason).toMatch(/unmeasured capability is not a working one/)
  })

  it('does not read one build’s answer for another', () => {
    // An upgrade must not inherit yesterday's measurement.
    expect(mayReportContinuation(acked('supported'), 'claude-code', '2.2.0').allowed).toBe(false)
  })

  it('does not read one provider’s answer for another', () => {
    expect(mayReportContinuation(acked('supported'), 'codex-cli', '2.1.236').allowed).toBe(false)
  })
})

describe('isolation needs both halves, and they are separately observable', () => {
  const pair = (
    reader: ProviderCapabilityReceipt['status'],
    store: ProviderCapabilityReceipt['status']
  ): ProviderCapabilityReceipt[] => [
    receipt({
      capability: 'login-isolation-by-home',
      status: reader,
      evidenceRef: 'the reader was asked in an artificial home and this is what it answered, at length'
    }),
    receipt({
      capability: 'credential-store-per-home',
      status: store,
      evidenceRef: 'the keychain and the home were both looked at, and this is what was there'
    })
  ]

  it('is supported only when the credential follows the home too', () => {
    expect(isolationByHome(pair('supported', 'supported'), 'claude-code', '2.1.236').status).toBe('supported')
  })

  it('is UNSUPPORTED when the reader is isolated and the secret is shared', () => {
    // The trap this exists for, and the shape measured on Claude Code 2.1.236:
    // an identity reader that answers per home looks like isolation, while one
    // keychain item per operating-system user means a second login has one
    // place to write — over the first.
    const v = isolationByHome(pair('supported', 'unsupported'), 'claude-code', '2.1.236')
    expect(v.status).toBe('unsupported')
    expect(v.reason).toMatch(/the credential is not/)
  })

  it('is unverified when either half is unmeasured', () => {
    expect(isolationByHome(pair('unverified', 'supported'), 'claude-code', '2.1.236').status).toBe('unverified')
    expect(isolationByHome([], 'claude-code', '2.1.236').status).toBe('unverified')
  })
})

describe('historical matrix measured on 2026-09-10', () => {
  it('is well formed, every row', () => {
    for (const row of CAPABILITY_MATRIX) expect(receiptProblems(row), row.capability).toEqual([])
  })

  it('never reports a continuation for a build whose ack is unverified', () => {
    // Both pinned builds are unverified for the ack today, so both must refuse.
    for (const [provider, build] of Object.entries(PINNED_BUILDS))
      expect(mayReportContinuation(CAPABILITY_MATRIX, provider, build).allowed, provider).toBe(false)
  })

  it('records Claude Code as NOT isolated by home, because the secret is one keychain item', () => {
    expect(isolationByHome(CAPABILITY_MATRIX, 'claude-code', PINNED_BUILDS['claude-code']).status).toBe('unsupported')
  })

  it('records Codex as isolated by home, because the credential is a file in it', () => {
    expect(isolationByHome(CAPABILITY_MATRIX, 'codex-cli', PINNED_BUILDS['codex-cli']).status).toBe('supported')
  })

  it('has the two providers disagreeing, which is the point of measuring instead of assuming', () => {
    const claude = isolationByHome(CAPABILITY_MATRIX, 'claude-code', PINNED_BUILDS['claude-code']).status
    const codex = isolationByHome(CAPABILITY_MATRIX, 'codex-cli', PINNED_BUILDS['codex-cli']).status
    expect(claude).not.toBe(codex)
  })

  it('puts the conversation store in the same place as the credential, for both', () => {
    // CO-140. The design promises isolation AND continuing a conversation under
    // another account of the same provider; on both providers the conversations
    // live inside the home that holds the credential, so the mechanism that
    // gives the first takes the second away.
    for (const provider of Object.keys(PINNED_BUILDS)) {
      const store = CAPABILITY_MATRIX.find(
        (r) => r.provider === provider && r.capability === 'conversation-store-per-home'
      )
      expect(store?.status, provider).toBe('supported')
    }
  })
})

describe('current builds after an upgrade',()=>{
  it('cannot inherit a native resume or isolation verdict from a previous build',()=>{
    for(const [provider,build] of Object.entries(CURRENT_BUILDS)){
      expect(mayReportContinuation(CURRENT_MATRIX,provider,build).allowed).toBe(false)
      expect(isolationByHome(CURRENT_MATRIX,provider,build).status).toBe('unverified')
    }
  })
})

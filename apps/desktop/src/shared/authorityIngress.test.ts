import { describe, expect, it } from 'vitest'
import { checkAuthorityTarget, redactAuthorityPayload } from './authorityIngress.ts'

// Assembled rather than written whole. A token-shaped literal in a source file
// is a token-shaped literal in every grep, every log and every paste of it.
const FAKE_KEY = 'sk-' + 'live-' + '51H8fJ2eZvKYlo2C0abcdefghij'
const FAKE_GH = 'ghp_' + 'abcdefghijklmnopqrstuvwxyz0123456789'

describe('a secret-bearing target is REFUSED, never rewritten', () => {
  it('accepts an ordinary target unchanged', () => {
    for (const t of ['/Users/example/project/README.md', 'https://passioncode.ai/blog/post', 'acct_1234'])
      expect(checkAuthorityTarget(t)).toEqual({ ok: true, target: t })
  })

  it('refuses a target carrying a credential rather than scrubbing it', () => {
    // Scrubbing produces a grant for a string nobody asked about and nobody
    // will ever match, and the operator approves an act described in terms that
    // are not the act.
    const got = checkAuthorityTarget(`https://api.example.com/v1?key=${FAKE_KEY}`)
    expect(got.ok).toBe(false)
    if (!got.ok) {
      expect(got.says).toMatch(/different string|not the act/i)
      expect(got.remedy).toMatch(/without the credential|belongs in the connection/i)
    }
  })

  it('names which rule matched, so the caller can see WHAT it must remove', () => {
    const got = checkAuthorityTarget(`Bearer ${FAKE_KEY}`)
    expect(got.ok).toBe(false)
    if (!got.ok) expect(got.rules.length).toBeGreaterThan(0)
  })

  it('never returns a rewritten target on the refusal path', () => {
    // The failure this prevents: a caller reading `target` off the result and
    // granting against the scrubbed version.
    const got = checkAuthorityTarget(`https://x.test?token=${FAKE_GH}`)
    expect(got.ok).toBe(false)
    expect(JSON.stringify(got)).not.toMatch(/redacted:/)
  })
})

describe('free text is scrubbed, on the way in', () => {
  it('scrubs the reason an agent gave, which reaches the operator queue', () => {
    // The measured leak: `asked_because` is the agent's own words (M140), and
    // policy.ts appended them verbatim. M195 closed this on the agent surface
    // and nowhere else.
    const got = redactAuthorityPayload({
      action_class: 'publish.page',
      asked_because: `the deploy key ${FAKE_KEY} is already set`
    })
    expect(String(got.payload.asked_because)).not.toContain(FAKE_KEY)
    expect(got.redactions.length).toBeGreaterThan(0)
  })

  it('leaves identifiers and the target ALONE', () => {
    // A target reaching here has already been checked; rewriting it at this
    // layer would reintroduce exactly the substitution the check exists to
    // prevent.
    const payload = { target: '/Users/example/x', grant_id: 'aaaa-bbbb', floor_class: 'deletion' }
    expect(redactAuthorityPayload(payload).payload).toEqual(payload)
  })

  it('counts what it removed, so "this was scrubbed of two secrets" stays answerable', () => {
    const got = redactAuthorityPayload({ reason: FAKE_KEY, note: FAKE_KEY })
    expect(got.redactions.reduce((n, r) => n + r.count, 0)).toBe(2)
  })

  it('changes nothing when there was nothing to remove', () => {
    const payload = { reason: 'the landing page copy is approved' }
    const got = redactAuthorityPayload(payload)
    expect(got.payload).toEqual(payload)
    expect(got.redactions).toEqual([])
  })
})

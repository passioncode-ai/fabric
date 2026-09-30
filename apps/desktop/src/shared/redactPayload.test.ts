import { describe, expect, it } from 'vitest'
import { redactPayload } from './redact.ts'

// Assembled from parts so no key-shaped literal sits in this file whole.
const KEY = 'sk-ant-' + 'api03-' + 'A'.repeat(32)

describe('redacting a whole journal payload (M195)', () => {
  it('scrubs a secret from a nested string and reports what it removed', () => {
    const { payload, redactions } = redactPayload({ claim: `the key is ${KEY}` })
    expect(String(payload.claim)).not.toContain(KEY)
    expect(redactions.length).toBeGreaterThan(0)
  })

  it('reaches INSIDE arrays and nested objects — a handoff value is not top-level', () => {
    // `task.handoff@1` carries the named value agents pass each other; an
    // option list carries an agent's own labels. A top-level-only pass would
    // leave the most dangerous field untouched.
    const { payload } = redactPayload({
      value: { inner: [`prefix ${KEY} suffix`] },
      options: [{ label: `also ${KEY}` }]
    })
    expect(JSON.stringify(payload)).not.toContain(KEY)
  })

  it('leaves ordinary values byte-identical — ids, enums, keys, formatted strings', () => {
    const ordinary = {
      task_id: '00000000-0000-0000-0000-000000000001',
      section: 'what',
      about: 'tier.free.export',
      option_id: 'claude-code',
      status: 'running',
      text: 'a normal sentence about the code'
    }
    const { payload, redactions } = redactPayload(ordinary)
    expect(payload).toEqual(ordinary)
    expect(redactions).toEqual([])
  })

  it('does not touch numbers, booleans or null — a payload is not all strings', () => {
    const p = { seq: 12, ok: true, note: null, nested: { n: 0 } }
    expect(redactPayload(p).payload).toEqual(p)
  })

  it('counts the same rule across several fields, so the record is honest', () => {
    const { redactions } = redactPayload({ a: KEY, b: KEY })
    const total = redactions.reduce((n, r) => n + r.count, 0)
    expect(total).toBe(2)
  })

  it('never returns the original object — the caller cannot journal the unscrubbed one by accident', () => {
    const original = { claim: `x ${KEY}` }
    const { payload } = redactPayload(original)
    expect(payload).not.toBe(original)
    expect(String(original.claim)).toContain(KEY) // the input is left alone
  })
})

describe('structured credential fields', () => {
  it('removes named values without needing a recognizable secret prefix', () => {
    const original = { headers: { Authorization: 'Bearer synthetic-opaque', 'Set-Cookie': 'session=synthetic-cookie' },
      nested: [{ API_TOKEN: 'synthetic-opaque', clientSecret: 'synthetic-secret', private_key: { body: 'synthetic-key' } }] }
    const result = redactPayload(original)
    expect(JSON.stringify(result.payload)).not.toContain('synthetic-')
    expect(result.redactions).toEqual([{ rule: 'credential-field', count: 5 }])
    expect(original.nested[0].API_TOKEN).toBe('synthetic-opaque')
  })

  it('preserves protocol identifiers, digests, public keys and token counts', () => {
    const ordinary = { idempotency_key: 'command-1', public_key: 'public-data', input_digest: 'a'.repeat(64),
      session_id: '00000000-0000-0000-0000-000000000001', token_count: 23, token_budget: 40,
      key: 'node-name', monkey: 'ordinary', secret_count: 1 }
    expect(redactPayload(ordinary).payload).toEqual(ordinary)
  })
})

it('returns inert JSON even when callers supply serialization hooks and prototype names', () => {
  let called = 0
  const value = Object.create(null)
  value.__proto__ = { toJSON: () => { called++; return 'synthetic-secret' } }
  value.toJSON = () => { called++; return 'synthetic-secret' }
  value.constructor = { prototype: { toJSON: value.toJSON } }
  value.big = 1n
  value.symbol = Symbol('synthetic-symbol')
  const { payload } = redactPayload({ value })
  expect(JSON.stringify(payload)).not.toContain('synthetic-secret')
  expect(called).toBe(0)
  expect(Object.getPrototypeOf(payload.value)).toBeNull()
  expect(Object.hasOwn(payload.value as object, '__proto__')).toBe(true)
})

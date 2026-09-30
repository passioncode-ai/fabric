import { describe, expect, it } from 'vitest'
import { describeRedactions, redact, redactPayload } from './redact.ts'

describe('redaction', () => {
  it('removes the shapes it knows', () => {
    const cases: [string, string][] = [
      ['sk-ant-api03-abcdefghijklmnop', 'anthropic-key'],
      ['ghp_abcdefghijklmnopqrstuvwxyz01', 'github-token'],
      ['xoxb-1234567890-abcdefghij', 'slack-token'],
      ['AKIAIOSFODNN7EXAMPLE', 'aws-key-id'],
      ['eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZSJ9.abcdefghij', 'jwt']
    ]
    for (const [secret, rule] of cases) {
      const out = redact(`before ${secret} after`)
      expect(out.text, rule).not.toContain(secret)
      expect(out.text, rule).toContain(`[redacted: ${rule}]`)
      expect(out.text, rule).toContain('before')
      expect(out.text, rule).toContain('after')
    }
  })

  it('keeps the NAME of an assignment and removes only the value', () => {
    const out = redact('AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMIK7MDENGbPxRfiCYEXAMPLE')
    expect(out.text).toContain('AWS_SECRET_ACCESS_KEY=')
    expect(out.text).not.toContain('wJalrXUtnFEMI')
    // Knowing WHICH credential a session read is useful and is not itself a
    // secret. Redacting the name too would remove the only actionable part.
    expect(out.text).toBe('AWS_SECRET_ACCESS_KEY=[redacted: assignment]')
  })

  it('takes a private key whole rather than shredding it', () => {
    const pem = '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA\nabcdef\n-----END RSA PRIVATE KEY-----'
    const out = redact(`before\n${pem}\nafter`)
    expect(out.text).toBe('before\n[redacted: private-key]\nafter')
    expect(out.redactions).toEqual([{ rule: 'private-key', count: 1 }])
  })

  it('does not eat its own marker — the rule order is load-bearing', () => {
    // With the shape rules first this produced
    // `ANTHROPIC_API_KEY=[redacted: assignment] anthropic-key]`: one rule wrote a
    // marker and the next ate half of it. Found by running it, not reading it.
    const out = redact('ANTHROPIC_API_KEY=sk-ant-api03-abcdefghijklmnop')
    expect(out.text).toBe('ANTHROPIC_API_KEY=[redacted: assignment]')
  })

  it('strips a password out of a connection string and keeps the rest readable', () => {
    const out = redact('psql postgresql://postgres:hunter2@127.0.0.1:54322/postgres')
    expect(out.text).toBe(
      'psql postgresql://postgres:[redacted: url-password]@127.0.0.1:54322/postgres'
    )
  })

  it('leaves ordinary output byte for byte — a redactor that rewrites prose is worse than none', () => {
    const prose =
      'reading the repository\nfound 12 files\nthe release script needs a signed tag\nexit 0\n'
    expect(redact(prose).text).toBe(prose)
    expect(redact(prose).redactions).toEqual([])
  })

  it('counts what it removed, and says nothing when it removed nothing', () => {
    expect(describeRedactions([])).toBeNull()
    const out = redact('A_TOKEN=one\nB_SECRET=two\nsk-ant-api03-abcdefghijklmnop')
    expect(describeRedactions(out.redactions)).toContain('3 redacted')
    expect(describeRedactions(out.redactions)).toContain('assignment×2')
  })
})

describe('standard authorization headers', () => {
  it('removes opaque Bearer and Basic credentials while keeping context', () => {
    for (const header of ['Authorization: Bearer', 'proxy-authorization: Basic']) {
      const result = redact(`${header} synthetic-opaque\nordinary`)
      expect(result.text).toBe(`${header} [redacted: authorization]\nordinary`)
      expect(redact(result.text).text).toBe(result.text)
    }
  })
})

it('discards an unfinished PEM body through EOF', () => {
  expect(redact('before\n-----BEGIN PRIVATE KEY-----\nsynthetic-unfinished').text)
    .toBe('before\n[redacted: private-key]')
})

describe('repeatable sanitization at layered sinks', () => {
  const canary = 'synthetic-opaque-canary-7391'
  const pem = `-----BEGIN PRIVATE KEY-----\n${canary}\n-----END PRIVATE KEY-----`

  it('keeps canonical output and removal counts stable on repeated passes', () => {
    const inputs = [
      `SERVICE_TOKEN=${canary}`,
      `SERVICE_TOKEN="${canary}"; next`,
      `SERVICE_TOKEN='${canary}'\r\nnext`,
      ...['.', '!', ')', ']', '}', ','].map(end => `SERVICE_TOKEN="${canary}"${end}\nnext`),
      `Authorization: Bearer ${canary}, next`,
      `Proxy-Authorization: Basic ${canary}; next`,
      `postgresql://user:${canary}@localhost/db`,
      pem,
      `before\n${pem}\nafter`,
      `SERVICE_TOKEN=${canary}\nAuthorization: Bearer ${canary}\n${pem}`
    ]
    for (const input of inputs) {
      const first = redact(input)
      expect(first.text).not.toContain(canary)
      expect(first.redactions.length).toBeGreaterThan(0)
      for (let pass = 0; pass < 3; pass++) {
        expect(redact(first.text)).toEqual({ text: first.text, redactions: [] })
      }
    }
  })

  it('recognizes only exact markers, with a value boundary, never a trusted prefix', () => {
    for (const fake of [
      `[redacted:${canary}]`,
      `[redacted: ${canary}]`,
      `[redacted: authorization]${canary}`,
      `[redacted: assignment]${canary}`,
      `[redacted: url-password]${canary}`,
      `[redacted: unknown]${canary}`,
      `[redacted: ${canary}`
    ]) {
      for (const input of [
        `SERVICE_TOKEN=${fake}\nnext`,
        `Authorization: Bearer ${fake}\nnext`,
        `Proxy-Authorization: Basic ${fake}\nnext`,
        `postgresql://user:${fake}@localhost/db`
      ]) {
        const first = redact(input)
        expect(first.text, input).not.toContain(canary)
        expect(redact(first.text), input).toEqual({ text: first.text, redactions: [] })
      }
    }
  })

  it('removes a credential suffix attached to a quoted value on the first pass', () => {
    for (const input of [`SERVICE_TOKEN="prefix"${canary}`, `SERVICE_TOKEN='prefix'${canary}`]) {
      const first = redact(input)
      expect(first.text).not.toContain(canary)
      expect(redact(first.text)).toEqual({ text: first.text, redactions: [] })
    }
  })

  it('preserves canonical punctuation and multiline context', () => {
    const input = 'SERVICE_TOKEN=[redacted: assignment]; next\r\n' +
      'Authorization: Bearer [redacted: authorization], next\n' +
      'postgresql://user:[redacted: url-password]@localhost/db\n' +
      '[redacted: private-key].'
    expect(redact(input)).toEqual({ text: input, redactions: [] })
  })

  it('does not let a fake marker shield a following recognizable token or PEM', () => {
    const token = 'sk-' + 'syntheticCanary'.repeat(3)
    for (const input of [`[redacted: unknown] ${token}`, `[redacted: unknown]\n${pem}`]) {
      const out = redact(input)
      expect(out.text).not.toContain(token)
      expect(out.text).not.toContain(canary)
      expect(redact(out.text)).toEqual({ text: out.text, redactions: [] })
    }
  })

  it('supports agent-payload redaction followed by a second journal scrub', () => {
    const input = { instruction: `SERVICE_TOKEN=${canary}`, nested: {
      authorization: `Bearer ${canary}`, url: `postgresql://user:${canary}@localhost/db`
    }, idempotency_key: 'command-42', digest: 'abc123', token_count: 7 }
    const first = redactPayload(input)
    expect(JSON.stringify(first.payload)).not.toContain(canary)
    expect(redactPayload(first.payload)).toEqual({ payload: first.payload, redactions: [] })
    expect(input.instruction).toContain(canary)
  })
})

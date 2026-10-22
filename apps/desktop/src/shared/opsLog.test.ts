import { describe, expect, it } from 'vitest'
import { LEVELS, atLeast, causeOf, opsRecord, trim, type OpsLevel } from './opsLog.ts'

const at = new Date('2026-09-08T15:04:05.123Z')

describe('a record says what the program did, and how it went', () => {
  it('carries the operation, its outcome and when', () => {
    const r = opsRecord({ at, op: 'ipc.tasks.start', outcome: 'ok', correlationId: 'c1', ms: 42 })
    expect(r.at).toBe('2026-09-08T15:04:05.123Z')
    expect(r.op).toBe('ipc.tasks.start')
    expect(r.outcome).toBe('ok')
    expect(r.ms).toBe(42)
  })

  it('has UNKNOWN as an outcome, because "we do not know" is a third answer', () => {
    // The same vocabulary the read envelope and the effect intents use. A
    // dispatch whose result never came back is not a failure and not a success.
    const r = opsRecord({ at, op: 'effect.dispatch', outcome: 'unknown', correlationId: 'c1' })
    expect(r.outcome).toBe('unknown')
    expect(r.level).toBe('warn')
  })

  it('levels an outcome rather than making the caller choose twice', () => {
    expect(opsRecord({ at, op: 'x', outcome: 'ok', correlationId: 'c' }).level).toBe('info')
    expect(opsRecord({ at, op: 'x', outcome: 'failed', correlationId: 'c' }).level).toBe('error')
    // …and an explicit level still wins, for the noisy successes.
    expect(opsRecord({ at, op: 'x', outcome: 'ok', correlationId: 'c', level: 'debug' }).level).toBe(
      'debug'
    )
  })

  it('refuses a record with no correlation id', () => {
    // A line nobody can join to the click that caused it is a line you can read
    // and cannot search, which is the difference M81 exists for.
    expect(() => opsRecord({ at, op: 'x', outcome: 'ok', correlationId: '' })).toThrow(/correlation/i)
  })
})

describe('what never reaches the log', () => {
  it('redacts a secret in the detail', () => {
    const r = opsRecord({
      at,
      op: 'gateway.call',
      outcome: 'failed',
      correlationId: 'c',
      detail: { header: 'Bearer sk-live_abcdefghijklmnopqrstuvwxyz012345' }
    })
    expect(JSON.stringify(r)).not.toContain('sk-live_abcdefghijklmnopqrstuvwxyz012345')
    expect(r.redactions?.length).toBeGreaterThan(0)
  })

  it('redacts a secret in the error message too, not only in the detail', () => {
    // The message is where a failing HTTP client puts the URL it called, and a
    // token in a query string is a token in the log.
    const r = opsRecord({
      at,
      op: 'gateway.call',
      outcome: 'failed',
      correlationId: 'c',
      error: new Error('GET https://api/x?key=sk-live_abcdefghijklmnopqrstuvwxyz012345 failed')
    })
    expect(JSON.stringify(r)).not.toContain('sk-live_abcdefghijklmnopqrstuvwxyz012345')
  })

  it('keeps the error NAME and message but never the stack', () => {
    const e = new TypeError('cannot read x of undefined')
    const r = opsRecord({ at, op: 'x', outcome: 'failed', correlationId: 'c', error: e })
    expect(r.error?.name).toBe('TypeError')
    expect(r.error?.message).toContain('cannot read x')
    expect(JSON.stringify(r)).not.toContain('at Object')
  })

  it('says what a database refusal was when it is a plain object, never «[object Object]» (0.3.10 review DA-3)', () => {
    // PostgREST answers an RPC failure with a plain object; the board tick logged 17 of them as «[object Object]».
    const r = opsRecord({ at: new Date(0), op: 'board.tick', outcome: 'failed', correlationId: 'c',
      error: { message: 'canceling statement due to statement timeout', code: '57014', details: null, hint: null } })
    expect(r.error).toEqual({ name: 'Error', message: 'canceling statement due to statement timeout (57014)' })
    const bare = opsRecord({ at: new Date(0), op: 'x', outcome: 'failed', correlationId: 'c', error: { ok: false, reason: 'no estate' } })
    expect(bare.error?.message.replace(/\s/g, '')).toBe('{"ok":false,"reason":"noestate"}')
    expect(opsRecord({ at: new Date(0), op: 'x', outcome: 'failed', correlationId: 'c', error: 'plain words' }).error?.message).toBe('plain words')
  })

  it('masks a secret field of a plain-object error with no message, as in detail (iteration 3 DA-1)', () => {
    const r = opsRecord({ at: new Date(0), op: 'x', outcome: 'failed', correlationId: 'c',
      error: { ok: false, password: 'hunter2secretvalue', token: 'tok-abcdef0123456789' } })
    expect(r.error?.message).not.toContain('hunter2secretvalue')
    expect(r.error?.message).not.toContain('tok-abcdef0123456789')
    expect(r.error?.message.replace(/\s/g, '')).toContain('"ok":false')
  })

  it('never runs an error\'s getters or toJSON, and a hostile one still leaves a record (iteration 3 DA-2)', () => {
    const hostile = Object.defineProperty({ toJSON: () => { throw new Error('ran toJSON') } }, 'message', { get: () => { throw new Error('ran a getter') }, enumerable: true })
    const r = opsRecord({ at: new Date(0), op: 'x', outcome: 'failed', correlationId: 'c', error: hostile })
    expect(r.op).toBe('x')
    expect(r.error?.message).not.toContain('ran')
    const huge = { rows: Array.from({ length: 50_000 }, (_, i) => ({ i, text: 'x'.repeat(100) })) }
    expect(JSON.stringify(opsRecord({ at: new Date(0), op: 'x', outcome: 'failed', correlationId: 'c', error: huge })).length).toBeLessThan(20_000)
  })

  it('reads no getter and no toJSON even when they would answer, and keeps circular and BigInt errors readable', () => {
    let calls = 0
    const quiet = Object.defineProperty({ toJSON: () => { calls++; return { leaked: true } } }, 'detailText', { get: () => { calls++; return 'from a getter' }, enumerable: true })
    const r = opsRecord({ at: new Date(0), op: 'x', outcome: 'failed', correlationId: 'c', error: quiet })
    expect(calls).toBe(0)
    expect(r.error?.message).not.toContain('from a getter')
    const circular: Record<string, unknown> = { reason: 'loop' }; circular.self = circular
    for (const error of [circular, { n: 10n, reason: 'big' }]) {
      const m = opsRecord({ at: new Date(0), op: 'x', outcome: 'failed', correlationId: 'c', error }).error?.message ?? ''
      expect(m).not.toContain('unreadable')
      expect(m).toMatch(/loop|big/)
    }
  })

  it('never throws on what it is handed, a revoked Proxy included (iteration 3 verification)', () => {
    const { proxy, revoke } = Proxy.revocable({}, {}); revoke()
    expect(opsRecord({ at: new Date(0), op: 'x', outcome: 'failed', correlationId: 'c', error: proxy }).op).toBe('x')
  })

  it('masks a plain-object error in the one redaction pass: counted, and its other fields kept', () => {
    const r = opsRecord({ at: new Date(0), op: 'x', outcome: 'failed', correlationId: 'c', error: { password: 'pw-0123456789abcdef', details: 'diag text' } })
    expect(r.redactions?.length ?? 0).toBeGreaterThan(0)
    expect(r.error?.message).toContain('diag text')
    const h = opsRecord({ at: new Date(0), op: 'x', outcome: 'failed', correlationId: 'c', error: { headers: { 'x-api-key': 'k-0123456789abcdef' }, details: 'the table is locked', hint: 'retry' } })
    expect(h.error?.message).toContain('the table is locked')
    expect(h.error?.message).toContain('retry')
    expect(h.error?.message).not.toContain('k-0123456789abcdef')
  })

  it('runs the text rules over a plain-object error too: a header pair, an unknown key header, apikey (final-candidate verification)', () => {
    const cases: [unknown, string, string | null][] = [
      [{ headers: [{ name: 'Authorization', value: 'Bearer S3cr3tTokenValue0123456789' }], keep: 'kept-field' }, 'S3cr3tTokenValue0123456789', 'kept-field'],
      [{ headers: { 'x-agw-key': 'agwS3cr3tValue0123456789abcd' }, details: 'diag-kept' }, 'agwS3cr3tValue0123456789abcd', 'diag-kept'],
      [{ apikey: 'apiS3cr3tValue0123456789abcd' }, 'apiS3cr3tValue0123456789abcd', null]
    ]
    for (const [error, secret, kept] of cases) {
      const r = opsRecord({ at: new Date(0), op: 'x', outcome: 'failed', correlationId: 'c', error })
      expect(JSON.stringify(r)).not.toContain(secret)
      expect(r.redactions?.length ?? 0).toBeGreaterThan(0)
      if (kept) expect(r.error?.message).toContain(kept)
    }
  })

  it('says an Error with a non-string name or message as text, and never throws on a circular one', () => {
    const circular: Record<string, unknown> = { a: 1 }; circular.self = circular
    const odd = Object.assign(new Error('x'), { message: circular as unknown as string })
    const named = Object.assign(new Error('boom'), { name: { a: 1 } as unknown as string })
    for (const error of [odd, named]) {
      const r = opsRecord({ at: new Date(0), op: 'x', outcome: 'failed', correlationId: 'c', error })
      expect(typeof r.error?.name).toBe('string')
      expect(typeof r.error?.message).toBe('string')
    }
  })

  it('redacts a secret in a plain-object error too', () => {
    const r = opsRecord({ at: new Date(0), op: 'x', outcome: 'failed', correlationId: 'c',
      error: { message: 'connect failed: postgres://u:hunter2secretvalue@db:5432/x', code: 'ECONNREFUSED' } })
    expect(r.error?.message).not.toContain('hunter2secretvalue')
  })

  it('caps a long detail value rather than writing a file into the log', () => {
    const r = opsRecord({
      at,
      op: 'files.read',
      outcome: 'ok',
      correlationId: 'c',
      detail: { body: 'x'.repeat(10_000) }
    })
    const body = (r.detail as { body: string }).body
    expect(body.length).toBeLessThan(1_000)
    expect(body).toContain('truncated')
  })
})

describe('trim', () => {
  it('keeps the newest lines and drops the oldest', () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line ${i}`)
    expect(trim(lines, 3)).toEqual(['line 7', 'line 8', 'line 9'])
  })

  it('leaves a short log alone', () => {
    expect(trim(['a', 'b'], 5)).toEqual(['a', 'b'])
  })
})

describe('atLeast', () => {
  it('orders the levels so a filter can mean "this and worse"', () => {
    expect(LEVELS).toEqual(['debug', 'info', 'warn', 'error'])
    expect(atLeast('warn' as OpsLevel, 'error' as OpsLevel)).toBe(true)
    expect(atLeast('warn' as OpsLevel, 'info' as OpsLevel)).toBe(false)
    expect(atLeast('debug' as OpsLevel, 'debug' as OpsLevel)).toBe(true)
  })
})

it('redacts a complete private key BEFORE truncating a long error or detail', () => {
  const pem = '-----BEGIN PRIVATE KEY-----\n' + 'synthetic-private-body '.repeat(50) + '\n-----END PRIVATE KEY-----'
  const r = opsRecord({ at, op: 'capture', outcome: 'failed', correlationId: 'c', detail: { body: pem }, error: new Error(pem) })
  expect(JSON.stringify(r)).not.toContain('synthetic-private-body')
  expect(r.detail?.body).toBe('[redacted: private-key]')
  expect(r.error?.message).toBe('[redacted: private-key]')
})

it('does not traverse discarded array members before sanitizing retained strings', () => {
  const cyclic: unknown[] = []
  cyclic.push(cyclic)
  const values = Array.from({ length: 20 }, (_, i) => i) as unknown[]
  values.push(cyclic)
  Object.defineProperty(values, 100_000, { get() { throw new Error('discarded tail visited') } })
  const r = opsRecord({ at, op: 'bounded', outcome: 'ok', correlationId: 'c', detail: { values } })
  expect(r.detail?.values).toEqual(Array.from({ length: 20 }, (_, i) => i))
})

it('bounds retained cycles, depth, node count and object accessors', () => {
  const cycle: Record<string, unknown> = {}
  cycle.self = cycle
  const deep: Record<string, unknown> = {}
  let cursor = deep
  for (let i = 0; i < 100; i++) { const next = {}; cursor.next = next; cursor = next }
  Object.defineProperty(cursor, 'unreachable', { enumerable: true, get() { throw new Error('deep value visited') } })
  const wide: Record<string, unknown> = {}
  for (let i = 0; i < 100; i++) wide[`field${i}`] = i
  Object.defineProperty(wide, 'discarded', { enumerable: true, get() { throw new Error('discarded field visited') } })
  const r = opsRecord({ at, op: 'bounded', outcome: 'ok', correlationId: 'c', detail: { cycle, deep, wide } })
  const serialized = JSON.stringify(r)
  expect(serialized).toContain('circular')
  expect(serialized).toContain('depth limit')
  expect(serialized).not.toContain('field99')
  // A broad tree cannot turn the pre-redaction walk into unbounded work.
  const branch = (depth: number): unknown => depth ? Array.from({ length: 20 }, () => branch(depth - 1)) : 'leaf'
  const breadth = opsRecord({ at, op: 'bounded', outcome: 'ok', correlationId: 'c', detail: { tree: branch(3) } })
  expect(JSON.stringify(breadth)).toContain('node limit')
  expect(JSON.stringify(breadth).length).toBeLessThan(20_000)
})

it('never executes serialization callbacks or inherits an own __proto__ object', () => {
  let called = 0
  const callback = () => { called++; return { API_TOKEN: 'synthetic-fresh-secret' } }
  const nested = Object.create(null)
  nested.toJSON = callback
  nested.__proto__ = { toJSON: callback, safe: 'ordinary' }
  nested.constructor = { prototype: { toJSON: callback } }
  nested.big = 1n
  nested.symbol = Symbol('synthetic-symbol')
  const r = opsRecord({ at, op: 'serialize', outcome: 'ok', correlationId: 'c', detail: { nested } })
  const text = JSON.stringify(r)
  expect(called).toBe(0)
  expect(text).not.toContain('synthetic-fresh-secret')
  expect(text).toContain('[omitted: function]')
  expect(text).toContain('[omitted: bigint]')
  expect(text).toContain('[omitted: symbol]')
  const value = r.detail?.nested as Record<string, unknown>
  expect(Object.getPrototypeOf(value)).toBeNull()
  expect(Object.hasOwn(value, '__proto__')).toBe(true)
  expect(Object.hasOwn(value, 'constructor')).toBe(true)
})

// Audit 2026-10-05 A7-036: the kind of a caught failure is kept, its message is not.
describe('causeOf', () => {
  it('keeps a name and a code of a fixed shape, never the message', () => {
    expect(causeOf(Object.assign(new Error('password=hunter2 at db'), { code: '57014' }))).toEqual({ name: 'Error', code: '57014' })
    expect(causeOf(Object.assign(new TypeError('x'), { code: 'ECONNREFUSED' }))).toEqual({ name: 'TypeError', code: 'ECONNREFUSED' })
    const abort = new Error('the operation was aborted'); abort.name = 'AbortError'
    expect(causeOf(abort)).toEqual({ name: 'AbortError' })
    expect(causeOf(Object.assign(new Error('x'), { code: 44 }))).toEqual({ name: 'Error', code: '44' })
    expect(JSON.stringify(causeOf(Object.assign(new Error('sk-secret'), { code: 'sk-' + 'A'.repeat(40) })))).not.toContain('sk-')
    expect(causeOf(Object.assign(new Error('x'), { name: 'Bearer abc def' }))).toEqual({ name: 'Error' })
    expect(causeOf('a string')).toEqual({ name: 'non-error string' })
    expect(causeOf(null)).toEqual({ name: 'non-error null' })
  })
})

import { describe, expect, it } from 'vitest'
import { LEVELS, atLeast, opsRecord, trim, type OpsLevel } from './opsLog.ts'

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

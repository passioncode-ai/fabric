// CO-500, ADR-0188 §1, §2: Fabric folds its own operations log by the hour and by the day, and a failure count that
// rose past the threshold against the hour before is a finding. Pure: the counts in, the digests out.
import { describe, expect, it } from 'vitest'
import { countInto, foldDay, foldHour, hourStart, risenRows, RISE_FACTOR, RISE_MIN_FAILED, type HourCounts } from './opsDigest'

const H = Date.parse('2026-11-04T17:00:00Z')
const HOUR = 60 * 60_000
const counts = (rows: Array<[string, string, number]>): HourCounts => {
  const c: HourCounts = new Map()
  for (const [op, outcome, n] of rows) for (let i = 0; i < n; i++) countInto(c, op, outcome)
  return c
}

describe('foldHour', () => {
  it('counts every operation by outcome, sorted by name, with the hour\'s window and totals', () => {
    const d = foldHour(counts([['ipc.work:home', 'ok', 5], ['board.tick', 'failed', 2], ['board.tick', 'ok', 3], ['mcp.unparsed', 'odd', 1]]), H, null)
    expect(d.schema).toBe('ops.digest.hourly@1')
    expect([d.from, d.to]).toEqual(['2026-11-04T17:00:00.000Z', '2026-11-04T18:00:00.000Z'])
    expect(d.ops.map((o) => o.op)).toEqual(['board.tick', 'ipc.work:home', 'mcp.unparsed'])
    expect(d.ops[0]).toEqual({ op: 'board.tick', ok: 3, failed: 2, unknown: 0 })
    expect(d.ops[2]).toEqual({ op: 'mcp.unparsed', ok: 0, failed: 0, unknown: 1 })
    expect(d.total).toEqual({ ok: 8, failed: 2, unknown: 1 })
  })

  it('a failure count at the threshold and past the factor of the hour before is a rise', () => {
    const prev = foldHour(counts([['cycle.receipt', 'failed', 5]]), H - HOUR, null)
    expect(foldHour(counts([['cycle.receipt', 'failed', 2 * 5]]), H, prev).risen).toEqual([{ op: 'cycle.receipt', failed: 10, previous: 5 }])
    expect(foldHour(counts([['cycle.receipt', 'failed', 2 * 5 - 1]]), H, prev).risen).toEqual([])
  })

  it('below the minimum is never a rise, and an hour with none before counts against one', () => {
    expect(foldHour(counts([['x', 'failed', RISE_MIN_FAILED - 1]]), H, null).risen).toEqual([])
    expect(foldHour(counts([['x', 'failed', RISE_MIN_FAILED]]), H, null).risen).toEqual([{ op: 'x', failed: RISE_MIN_FAILED, previous: 0 }])
    expect(RISE_FACTOR).toBe(2)
  })

  it('compares only with the hour just before: after a gap the earlier hour is not the baseline', () => {
    const old = foldHour(counts([['x', 'failed', 40]]), H - 3 * HOUR, null)
    expect(foldHour(counts([['x', 'failed', 20]]), H, old).risen).toEqual([{ op: 'x', failed: 20, previous: 0 }])
  })
})

describe('foldDay', () => {
  it('sums the day\'s hours, counts them, and names each rise with the hours it rose in', () => {
    const h1 = foldHour(counts([['x', 'failed', 12], ['y', 'ok', 1]]), Date.parse('2026-11-04T01:00:00Z'), null)
    const h2 = foldHour(counts([['x', 'failed', 30]]), Date.parse('2026-11-04T02:00:00Z'), h1)
    const other = foldHour(counts([['x', 'failed', 99]]), Date.parse('2026-11-05T00:00:00Z'), null)
    const d = foldDay('2026-11-04', [h1, h2, other])
    expect(d).toMatchObject({ schema: 'ops.digest.daily@1', day: '2026-11-04', hours: 2 })
    expect(d?.ops).toEqual([{ op: 'x', ok: 0, failed: 42, unknown: 0 }, { op: 'y', ok: 1, failed: 0, unknown: 0 }])
    expect(d?.risen).toEqual([{ op: 'x', hours: 2, failed: 42 }])
  })
})

describe('hourStart', () => {
  it('floors to the UTC hour', () => {
    expect(new Date(hourStart(Date.parse('2026-11-04T17:59:59.999Z'))).toISOString()).toBe('2026-11-04T17:00:00.000Z')
  })
})

describe('risenRows (ADR-0188 §2)', () => {
  it('turns the newest hour\'s rises into the operator\'s queue rows, one per operation, dated from the hour', () => {
    const h = foldHour(counts([['board.tick', 'failed', 14], ['ipc.feed:replay', 'ok', 3]]), H, null)
    expect(risenRows(h)).toEqual([{ key: 'failures-rose:board.tick', kind: 'failures-rose', project_id: null, task_id: null, request_id: null,
      still_since: '2026-11-04T17:00:00.000Z', title: 'board.tick: 14 / 0', is_task: false }])
    expect(risenRows(null)).toEqual([])
  })
})

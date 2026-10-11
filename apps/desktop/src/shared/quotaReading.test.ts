// Audit A4-020: a quota read that THROWS is a failed reading, never "no quota". The project status bar
// caught the throw as null, and null is what "not signed in" looks like.
import { describe, expect, it } from 'vitest'
import { readQuotaReading } from './quotaReading.ts'
import type { Quota } from './types.ts'

const quota: Quota = { fiveHour: null, sevenDay: null, byModel: {}, readAt: '2026-10-11T00:00:00Z', ageSeconds: 0, problem: null, account: null }

describe('readQuotaReading', () => {
  it('a read that answers is a reading of that answer', async () => {
    expect(await readQuotaReading(async () => quota)).toEqual({ read: true, quota })
    expect(await readQuotaReading(async () => null)).toEqual({ read: true, quota: null })
  })

  it('a read that throws is a failed reading with the reason, not null', async () => {
    expect(await readQuotaReading(async () => { throw new Error('the main process did not answer') }))
      .toEqual({ read: true, failed: 'the main process did not answer' })
  })

  it('a read that throws synchronously is failed too', async () => {
    expect(await readQuotaReading(() => { throw 'no bridge' })).toEqual({ read: true, failed: 'no bridge' })
  })
})

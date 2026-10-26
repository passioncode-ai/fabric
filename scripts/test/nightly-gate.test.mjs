// CO-274: the nightly gates pick tonight's cron by Warsaw's offset six hours before the job starts, so a run GitHub
// started late, past the clock change at 01:00 UTC, still picks the right one: one batch a night, never two, never none.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nightlyRun, warsawOffset } from '../nightly-gate.mjs'

const SUMMER = '0 21 * * *'
const WINTER = '0 22 * * *'
const at = (iso, schedule) => nightlyRun({ schedule, summer: SUMMER, winter: WINTER, now: new Date(iso) }).run

test('Warsaw is +0200 in summer and +0100 in winter', () => {
  assert.equal(warsawOffset(new Date('2026-07-01T12:00:00Z')), '+0200')
  assert.equal(warsawOffset(new Date('2026-12-01T12:00:00Z')), '+0100')
})

test('an ordinary night runs one cron, started on time or three hours late', () => {
  for (const start of ['2026-07-01T21:05:00Z', '2026-07-02T00:05:00Z']) {
    assert.equal(at(start, SUMMER), true, `summer, ${start}`)
    assert.equal(at(start, WINTER), false, `summer, ${start}`)
  }
  for (const start of ['2026-12-01T22:05:00Z', '2026-12-02T01:05:00Z']) {
    assert.equal(at(start, WINTER), true, `winter, ${start}`)
    assert.equal(at(start, SUMMER), false, `winter, ${start}`)
  }
})

test('the night of 24/25 October 2026 runs the batch once, though the winter cron started after the change', () => {
  // The clocks go back at 01:00 UTC on 25 October. Summer's cron fired at 21:00 UTC, started at 00:30; winter's fired at
  // 22:00 UTC and started at 01:30, after the change: read at the start, both matched and the batch ran twice.
  assert.equal(at('2026-10-25T00:30:00Z', SUMMER), true)
  assert.equal(at('2026-10-25T01:30:00Z', WINTER), false)
})

test('the night of 27/28 March 2027 runs the batch once, though it started after the change', () => {
  // The clocks go forward at 01:00 UTC on 28 March; winter's cron is tonight's. Read at the start, the late winter run
  // saw +0200 and skipped, the summer run saw +0100 and skipped: no batch at all.
  assert.equal(at('2027-03-28T01:30:00Z', WINTER), true)
  assert.equal(at('2027-03-28T00:30:00Z', SUMMER), false)
})

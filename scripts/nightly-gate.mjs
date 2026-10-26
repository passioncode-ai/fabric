#!/usr/bin/env node
// #region nightly-gate — docs: docs/evidence/plans/2026-10-26-release-0313-plan.md#triage-of-the-overdue-rows-2026-10-26
// Which of the two nightly crons is 23:00 (or 23:30) in Warsaw tonight (CO-274). The workflows carry one cron for
// summer time and one for winter time and run the batch only for the cron that matches Warsaw's offset. The offset is
// read as of six hours before the job starts, not when it starts: GitHub starts scheduled runs up to three hours late,
// and a run started after 01:00 UTC on the night the clocks change read the next day's offset, so the night of
// 24/25 October 2026 ran the batch twice and 27/28 March 2027 would have run it not at all.
//
//   node scripts/nightly-gate.mjs "<the cron that fired>" "<summer cron>" "<winter cron>"
//
// prints the decision and appends `run=true` or `run=false` to $GITHUB_OUTPUT when it is set.
import { appendFileSync } from 'node:fs'

/** How far back the offset is read: past the longest start delay seen (three hours), short of the previous evening. */
export const OFFSET_LOOKBACK_MS = 6 * 3_600_000

/** Warsaw's UTC offset at an instant, as `+0200` or `+0100`. */
export function warsawOffset(at) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Warsaw', timeZoneName: 'longOffset' })
    .formatToParts(at).find((p) => p.type === 'timeZoneName')?.value ?? ''
  const m = /^GMT([+-])(\d{2}):(\d{2})$/.exec(name)
  if (!m) throw new Error(`cannot read Warsaw's offset from "${name}"`)
  return `${m[1]}${m[2]}${m[3]}`
}

/** Whether the cron that fired is tonight's: summer's while Warsaw is at +0200 six hours before `now`, else winter's. */
export function nightlyRun({ schedule, summer, winter, now }) {
  const offset = warsawOffset(new Date(now.getTime() - OFFSET_LOOKBACK_MS))
  const want = offset === '+0200' ? summer : winter
  return { run: schedule === want, want, offset }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [schedule, summer, winter] = process.argv.slice(2)
  if (!schedule || !summer || !winter) {
    console.error('usage: nightly-gate.mjs "<the cron that fired>" "<summer cron>" "<winter cron>"')
    process.exit(2)
  }
  const { run, want, offset } = nightlyRun({ schedule, summer, winter, now: new Date() })
  console.log(run ? `"${schedule}" is tonight's cron (offset ${offset} six hours ago); running`
    : `tonight's cron is "${want}" at offset ${offset} six hours ago, this one is "${schedule}"; skipping`)
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `run=${run}\n`)
}
// #endregion nightly-gate

// #region comms-marks — docs: docs/ux/scenarios.md#scn-143-see-what-projects-tell-each-other
/**
 * Comms' read marks as the settings file can hold them (CO-312): the file refuses more than COMMS_READ_THROUGH_MAX, so
 * on a large estate «Mark all read» was refused on every try and the badge never cleared. A write first drops the marks
 * of threads the board no longer lists (only when its list of heads is whole, so a cut list never reads as «gone»),
 * and if that is not enough keeps the newest marks: journal seqs only grow, so the highest are the latest read.
 */
import { COMMS_READ_THROUGH_MAX } from './appSettings.ts'

export function boundedMarks(
  current: Readonly<Record<string, number>>,
  add: Readonly<Record<string, number>>,
  heads: { ids: readonly string[]; whole: boolean } | null,
  max = COMMS_READ_THROUGH_MAX
): Record<string, number> {
  const merged: Record<string, number> = { ...current }
  for (const [id, seq] of Object.entries(add)) merged[id] = Math.max(merged[id] ?? 0, seq)
  let entries = Object.entries(merged)
  if (entries.length <= max) return merged
  if (heads?.whole) {
    const listed = new Set(heads.ids)
    entries = entries.filter(([id]) => listed.has(id) || id in add)
  }
  if (entries.length > max) entries = entries.sort((a, b) => b[1] - a[1]).slice(0, max)
  return Object.fromEntries(entries)
}
// #endregion comms-marks

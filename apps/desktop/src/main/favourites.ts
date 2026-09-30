// Which projects the operator keeps at the top (M120 · S14).
//
// Operator-local, so not journalled — see `localStore`. The ORDER is the
// operator's: it is the order they pinned in, and nothing re-sorts it.

import { localStore } from './localStore.ts'
import { planMove, replacePin, togglePin } from '../shared/favourites.ts'
// ONE home for the boundary type (R-005): it was declared here and in
// `shared/types.ts`, and extending this copy left the renderer typed against
// a shape the product no longer returns.
import type { ArrangeResult, PinResult } from '../shared/types.ts'

/** A file someone hand-edited into an object would otherwise reach the renderer
 *  and break the estate home. An unreadable preference costs a pin; a malformed
 *  one must not cost the screen. */
const store = localStore<string[]>('favourites.json', [], (parsed) =>
  Array.isArray(parsed) && parsed.every((p) => typeof p === 'string') ? (parsed as string[]) : null
)

export function favourites(): string[] {
  return store.read().value
}


/** Write a list that the contract has already decided on. */
function commit(next: readonly string[], current: { value: string[]; revision: string }): PinResult {
  const result = store.write([...next], current.revision)
  if (result.status === 'committed') return { pins: result.value, saved: true }
  if (result.status === 'conflict')
    // Another window pinned something between the read and the write. Its value
    // is the one on disk, so it is the one the screen should show.
    return { pins: result.currentValue, saved: false, reason: 'another window changed the pins' }
  return { pins: current.value, saved: false, reason: result.reason }
}

export function toggleFavourite(projectId: string): PinResult {
  const current = store.read()
  const change = togglePin(current.value, projectId)
  if (change.kind === 'at-limit')
    // NOTHING IS WRITTEN. The set is unchanged on disk and on screen, and the
    // caller asks which to release — a silent drop would undo a decision the
    // operator made with a click.
    return { pins: change.favourites, saved: true, atLimit: { limit: change.limit } }
  return commit(change.favourites, current)
}

/**
 * Release one and pin another, atomically (SCN-043 step 2).
 *
 * ONE write, because two would leave a window with four pinned and would lose
 * the released one if the second failed. The local store's revision check makes
 * it a compare-and-swap, so another window's change is a conflict rather than
 * an overwrite.
 */
export function replaceFavourite(release: string, add: string): PinResult {
  const current = store.read()
  return commit(replacePin(current.value, release, add), current)
}

/** The order of the projects that are NOT pinned (SCR-30/SCR-01 ↑ ↓). A preference of
 *  this machine like the pins, and validated the same way. */
const orderStore = localStore<string[]>('project-order.json', [], (parsed) =>
  Array.isArray(parsed) && parsed.every((p) => typeof p === 'string') ? (parsed as string[]) : null
)

export function projectOrder(): string[] {
  return orderStore.read().value
}

/**
 * One step up or down (SCR-30/SCR-01).
 *
 * Which list moves is `planMove`'s answer. `rest` comes from the screen because main
 * does not hold the project list, and the screen's order is the one the operator
 * pressed the arrow against. Each is one compare-and-swap write, so another
 * window's change is reported rather than overwritten.
 */
export function moveProject(projectId: string, dir: 'up' | 'down', rest: readonly string[]): ArrangeResult {
  if (dir !== 'up' && dir !== 'down') throw new Error('direction must be up or down')
  if (!Array.isArray(rest) || !rest.every((id) => typeof id === 'string')) throw new Error('rest must be a list of project ids')
  const pins = store.read(), order = orderStore.read()
  const plan = planMove(pins.value, rest, projectId, dir)
  if (plan.list === 'pins') {
    const r = commit(plan.next, pins)
    return { pins: r.pins, order: order.value, saved: r.saved, ...(r.reason ? { reason: r.reason } : {}) }
  }
  const next = plan.next
  const w = orderStore.write(next, order.revision)
  if (w.status === 'committed') return { pins: pins.value, order: w.value, saved: true }
  if (w.status === 'conflict') return { pins: pins.value, order: w.currentValue, saved: false, reason: 'another window changed the order' }
  return { pins: pins.value, order: order.value, saved: false, reason: w.reason }
}

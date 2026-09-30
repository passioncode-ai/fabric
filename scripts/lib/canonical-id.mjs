// The canonical id, and the aliases derived from it (FA-05).
//
// MEASURED: the last queue report referred to `m152-commit`, and the id is
// `M152.commit`. Neither is wrong — one is the canonical id and the other is the
// HTML anchor derived from it — but the derivation lived twice inside one line of
// `check-system-model.mjs`, once lowercased and once not, and nowhere else. A
// reader hitting the report's spelling in a search finds nothing, and the audit
// recorded it as a task that does not exist in Git.
//
// 18 of the 75 execution nodes carry a dotted id. The dot is the point: `M152` is
// a milestone and `M152.commit` is one deliverable of it, so an alias that
// flattens the dot is a display form and never an identity.
//
// AND THE FLATTENING CAN COLLIDE. `M152.commit` and a hypothetical `M152-commit`
// both render as `m152-commit`, so two canonical ids would answer to one alias
// and a queue row could be attributed to either. That is checked here rather
// than assumed, because the day it happens nothing else would notice.

/** The HTML anchor for a canonical id: `M152.commit` → `work-m152-commit`. */
export function anchorOf(id) {
  return 'work-' + id.toLowerCase().replaceAll('.', '-')
}

/** The task-contract address: `M152.commit` → `task-M152-commit`. Case is KEPT,
 *  because the contract pages address the id as it is written. */
export function contractOf(id) {
  return 'task-' + id.replaceAll('.', '-')
}

/**
 * Check that a set of canonical ids produces unambiguous aliases.
 *
 * Returns the problems rather than throwing: a gate reports every collision it
 * found, and one that stopped at the first would need running as many times as
 * there are collisions.
 */
export function aliasProblems(ids) {
  const problems = []
  const seen = new Map()
  for (const id of ids) {
    if (!/^[A-Za-z]+\d+(\.[A-Za-z0-9]+)?$/.test(id))
      problems.push(
        `${id} is not a canonical id. One letter-and-number stem, optionally one dotted part: ` +
          `the dot separates a milestone from a deliverable of it, and anything else is a display name.`
      )
    for (const [kind, alias] of [['anchor', anchorOf(id)], ['contract', contractOf(id)]]) {
      const key = kind + ':' + alias
      if (seen.has(key) && seen.get(key) !== id)
        problems.push(
          `${id} and ${seen.get(key)} both render as the ${kind} alias ${alias}. ` +
            `Two ids answering to one address means a queue row can be attributed to either.`
        )
      seen.set(key, id)
    }
  }
  return problems
}

/** Resolve an alias back to its canonical id, or null. Ambiguity is a caller's
 *  problem to have prevented — `aliasProblems` is how. */
export function canonicalFor(alias, ids) {
  const wanted = alias.replace(/^work-/, '').replace(/^task-/, '').toLowerCase()
  const hits = ids.filter((id) => id.toLowerCase().replaceAll('.', '-') === wanted)
  return hits.length === 1 ? hits[0] : null
}

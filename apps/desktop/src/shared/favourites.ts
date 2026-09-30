// Projects the operator keeps at the top (M120).
//
// PARTITION, NOT OVERLAY, and it is the same invariant `planOf` carries: every
// project appears EXACTLY ONCE. A pinned project shown in its own section and
// again in the full list below is the same card twice — the operator can act on
// the wrong one, and any count beside either list becomes a number nobody can
// interpret.
//
// A FAVOURITE IS A PREFERENCE OF A PERSON, not a fact about the estate, so it
// is not journalled — the same reasoning that kept the digest mark and the CEO
// threads out of the record. Return trigger: when a second person can sign in
// (M38), a favourite becomes a `(person_id, project_id)` row, because then it
// stops being "this machine" and starts being "this person".

/**
 * How many projects may lead (SCN-043 step 1).
 *
 * Five, and it is a NUMBER rather than a convention: `togglePin` appended
 * without limit, so "up to five favourites lead" was a sentence in a scenario
 * and nothing else. Declared here so the contract, the release prompt and the
 * sentence that explains the prompt all read the same value.
 */
export const FAVOURITE_LIMIT = 5

/**
 * Below how many projects the whole feature is ceremony (SCN-043 step 3).
 *
 * One. It was six — "ranking five of six is ceremony" — and the launch design
 * (SCR-30/SCR-01, docs/reports/product.html) puts ★ ↑ ↓ on every row of "My
 * projects" at four. The operator chose the design (2026-09-29), so the
 * scenario was amended to it. What stays true of the old reason: ranking one of
 * one saves nobody anything, so a single project is offered neither.
 */
export const FAVOURITE_THRESHOLD = 1

/** Is the favourites step worth offering at this many projects? */
export function offersFavourites(projectCount: number): boolean {
  return projectCount > FAVOURITE_THRESHOLD
}

export interface Pinnable {
  id: string
}

export interface Partitioned<T extends Pinnable> {
  pinned: T[]
  rest: T[]
  /**
   * Favourites naming a project that was not in the list.
   *
   * Reported rather than only skipped (UX28-10). The skip is deliberate and
   * stays — deleting the id on a read would mean a transient failure to load a
   * project quietly unpins it — and that is precisely why it must be SAID: a
   * pinned project that is simply not there is a dead card's silent cousin, and
   * SCN-043's alt path asks for "leaves the row and says so".
   */
  missing: string[]
}

/**
 * Split projects into pinned and the rest, exactly once each.
 *
 * The pinned keep the ORDER THEY WERE PINNED IN rather than the order they
 * happen to arrive in: a list the operator arranged should stay arranged, and
 * re-sorting it by name or by activity would silently undo a decision they made
 * with a click.
 */
export function partitionByFavourite<T extends Pinnable>(
  projects: readonly T[],
  favourites: readonly string[]
): Partitioned<T> {
  const byId = new Map(projects.map((p) => [p.id, p]))
  const pinned: T[] = []
  for (const id of favourites) {
    const found = byId.get(id)
    // A favourite naming a project that no longer exists is skipped rather than
    // rendered as a hole. It is not removed from the stored list here: deleting
    // it on a read would mean a transient failure to load a project quietly
    // unpins it.
    if (found) pinned.push(found)
  }
  const pinnedIds = new Set(pinned.map((p) => p.id))
  return {
    pinned,
    rest: projects.filter((p) => !pinnedIds.has(p.id)),
    missing: favourites.filter((id) => !byId.has(id))
  }
}

/**
 * What a pin click did, or could not do.
 *
 * A RESULT rather than an array, and that is the fix rather than a style: the
 * old signature could only return a list, so the caller had no way to be told
 * "this would be the sixth" and the limit had nowhere to live. Returning a
 * discriminated result makes every caller handle the limit, because there is no
 * array to reach for without looking.
 */
export type PinChange =
  | { kind: 'pinned'; favourites: string[] }
  | { kind: 'unpinned'; favourites: string[] }
  /** At the limit. The caller must ask WHICH to release — SCN-043 step 2 — and
   *  `favourites` is unchanged, because a silent drop undoes a decision the
   *  operator made with a click. */
  | { kind: 'at-limit'; favourites: string[]; limit: number }

/** Add or remove, keeping pin ORDER: a newly pinned project goes to the end,
 *  where the operator expects the thing they just did. */
export function togglePin(favourites: readonly string[], projectId: string): PinChange {
  if (favourites.includes(projectId))
    // Unpinning is never at the limit: it makes room.
    return { kind: 'unpinned', favourites: favourites.filter((id) => id !== projectId) }
  if (favourites.length >= FAVOURITE_LIMIT)
    return { kind: 'at-limit', favourites: [...favourites], limit: FAVOURITE_LIMIT }
  return { kind: 'pinned', favourites: [...favourites, projectId] }
}

/**
 * Release one and pin another, as ONE change.
 *
 * Not an unpin followed by a pin: two writes leave a window where four are
 * pinned, and a failure between them loses the released one without gaining the
 * new one. The operator asked for a swap, so a swap is what is written.
 *
 * A `release` that is not pinned changes nothing — that is a stale screen, and
 * honouring half of it would exceed the limit.
 */
export function replacePin(
  favourites: readonly string[],
  release: string,
  add: string
): string[] {
  if (!favourites.includes(release)) return [...favourites]
  if (favourites.includes(add)) return [...favourites]
  // TO THE END, consistent with the rule the operator has already learned:
  // "a newly pinned project goes to the end, where the operator expects the
  // thing they just did." I first wrote this as taking the released one's PLACE
  // — arguing the arrangement should survive — and my own case caught it. The
  // argument is weaker than it looks: releasing one and adding another IS a
  // change to the arrangement, and a replacement is still a pin, so it should
  // behave like every other pin rather than like a special case nobody was
  // told about.
  return [...favourites.filter((id) => id !== release), add]
}

/**
 * The projects that are not pinned, in the operator's order (SCR-30/SCR-01 ↑ ↓).
 *
 * The stored order is a PREFERENCE of this machine, like the pins, so a project
 * it does not name is not an error: it keeps the place it arrived in, after the
 * ones that are named — where a newly created project is expected. An id the
 * list no longer holds is skipped and kept on disk, for the same reason a
 * missing favourite is: a transient failure to load must not rewrite anything.
 */
export function arrangeRest<T extends Pinnable>(rest: readonly T[], order: readonly string[]): T[] {
  const at = new Map(order.map((id, i) => [id, i]))
  const known = rest.filter((p) => at.has(p.id)).sort((a, b) => at.get(a.id)! - at.get(b.id)!)
  return [...known, ...rest.filter((p) => !at.has(p.id))]
}

/** One step up or down; at an edge, or for an id the list does not hold, nothing moves. */
export function moveWithin(ids: readonly string[], id: string, dir: 'up' | 'down'): string[] {
  const i = ids.indexOf(id), j = dir === 'up' ? i - 1 : i + 1
  if (i < 0 || j < 0 || j >= ids.length) return [...ids]
  const next = [...ids]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

/**
 * Which stored list one arrow changes, and to what.
 *
 * A pinned project moves among the pins — their order IS the favourites list.
 * Any other moves among `rest`, the unpinned ids in the order the screen shows
 * them; an id that is pinned by now is dropped from that list first, so a stale
 * screen cannot write a favourite into the order of the rest.
 */
export function planMove(
  pins: readonly string[],
  rest: readonly string[],
  id: string,
  dir: 'up' | 'down'
): { list: 'pins' | 'order'; next: string[] } {
  if (pins.includes(id)) return { list: 'pins', next: moveWithin(pins, id, dir) }
  return { list: 'order', next: moveWithin(rest.filter((r) => !pins.includes(r)), id, dir) }
}

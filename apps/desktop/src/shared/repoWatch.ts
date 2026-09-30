// Who should ask again when a repository moves (M107).
//
// The main process watches every attached repository's `.git` and broadcasts
// the path that changed. Before this, it broadcast into a channel with NO
// LISTENER ANYWHERE: `repoStates.watchAll(paths, (p) => broadcast(...))` fired,
// every window's `webContents.send` delivered it, and nothing was on the other
// end. M56 shipped saying "the watch makes it feel immediate"; it did not.
//
// TWO THINGS THE DEFECT'S OWN DESCRIPTION GOT INCOMPLETE, both found by
// measuring rather than reading:
//
//   1. The watch was not wholly inert. Its callback drops the cache entry
//      before notifying, so the NEXT read was already fresh. What was dead was
//      only the notification — nobody was told to read.
//   2. `.git` is watched non-recursively, deliberately: watching objects is
//      thousands of events for one commit. So a file EDITED IN THE WORKING TREE
//      touches nothing under `.git` and fires nothing at all. The listener this
//      module serves therefore cannot, on its own, fix the thing M107 says it
//      fixes — "an agent rewrites twelve files while the strip says clean".
//      That needs an interval, which is why POLL_MS lives here beside it.
//
// The broadcast reaches EVERY window. Re-reading git in all of them for a
// repository none of them displays is the stampede M102 describes arriving by
// a second road, so each view decides for itself — with `affects`.

/** Trailing separators differ between a path typed and a path picked. */
function normalise(p: string): string {
  return p.replace(/[/\\]+$/, '')
}

/**
 * Does a change to `changed` concern a view holding `held`?
 *
 * `held` is `null` when the view has not been told what it holds yet, and that
 * is NOT the same as holding nothing: a view that refuses to re-read because
 * it does not know its own repositories stays stale forever, and a project
 * with genuinely no repository has nothing to re-read. The same distinction
 * `EmptyState` exists to keep, one layer down.
 */
export function affects(changed: string, held: readonly string[] | null): boolean {
  if (held === null) return true
  const target = normalise(changed)
  return held.some((p) => normalise(p) === target)
}

/**
 * How often a view re-reads repository state on its own.
 *
 * It exists for what the watch cannot see, and it REPLACES the far faster read
 * this panel used to do off `feedMark` — the journal's high-water mark, which
 * moves every two seconds while an agent journals and does not move at all
 * when nothing does. That made the strip both expensive under load and frozen
 * at rest, which is the worst of the two.
 */
export const POLL_MS = 10_000

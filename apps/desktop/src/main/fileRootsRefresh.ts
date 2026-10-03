// #region file-roots-refresh — docs: docs/evidence/backlog.md#work-s02-store
// Every repository attached to any project in this estate, read whole, or the roots stay as they were.
//
// The set bounds the filesystem API and is the list git watching follows (M56, SEC-REQ-016), so a
// short list is not a smaller answer — it closes folders the operator opened and stops watching them.
// MEASURED in the 2026-10-03 release review (iteration 2, data finding 3): `refreshFileRoots` read
// `project_repos` in one request, and the gateway answers at most `max_rows` (1000) rows with nothing
// said about the rest, so past 1000 repositories the roots and the watched set dropped silently and
// varied with whatever order the database chose. It then `reset` to that list.
//
// So the read is `selectAll` over a stable order (every page, or `failed`), and the decision is made
// here, where it can be tested: a complete read replaces the roots; a failed one replaces NOTHING —
// a partial or empty list would revoke access the operator granted — and is reported.
import type { ScopedStore } from './scopedStore.ts'

export type FileRootsRefresh =
  | { state: 'replaced'; paths: string[] }
  | { state: 'kept'; failed: string }

export async function refreshFileRootsFrom(
  store: Pick<ScopedStore, 'selectAll'>,
  apply: (paths: string[]) => void,
  report: (failed: string) => void
): Promise<FileRootsRefresh> {
  const read = await store.selectAll('project_repos', 'path', { orderBy: ['path'] })
  if (read.failed !== null) {
    report(read.failed)
    return { state: 'kept', failed: read.failed }
  }
  const paths = read.rows.map((r) => String(r.path))
  apply(paths)
  return { state: 'replaced', paths }
}
// #endregion file-roots-refresh

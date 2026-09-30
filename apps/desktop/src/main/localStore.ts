// Operator-local state, on disk beside the application (M120, M133 · S14).
//
// WHAT BELONGS HERE, and it is a boundary rather than a convenience: facts
// about the PERSON at the desk. Which projects they pinned; which projects they
// have already caught up on. Neither is a fact about the estate, and journalling
// them would mean the record grows every time somebody glances at a screen —
// the record has to stay smaller than what it describes.
//
// THE MECHANISM MOVED OUT (S14). Everything about atomicity, quarantine and
// revisions is in `localState.ts`, which takes its directory as an argument and
// therefore has a probe that removes its write permission and corrupts its
// files. What is left here is the Electron binding: one line that knows where
// `userData` is.
//
// The old shape — `read(): T` and `write(next): void` — is gone on purpose. A
// read that cannot say "this is the default because the file would not parse"
// and a write that returns nothing are the two halves of the same lie.

import { app } from 'electron'
import {
  readLocal,
  updateLocal,
  writeLocal,
  type LocalFile,
  type LocalRead,
  type LocalWrite
} from './localState.ts'

export type { LocalRead, LocalWrite } from './localState.ts'

export interface LocalStore<T> {
  read(): LocalRead<T>
  write(next: T, expectedRevision?: string): LocalWrite<T>
  update(change: (current: T) => T): LocalWrite<T>
}

export function localStore<T>(
  fileName: string,
  empty: T,
  /** How to tell a valid file. Not optional: "it parsed" is not "it is what we
   *  asked for", and a hand-edited list turned into an object used to reach the
   *  renderer and break the estate home. */
  validate: (parsed: unknown) => T | null
): LocalStore<T> {
  // Resolved per call rather than at import: `app.getPath` throws before the
  // app is ready, and a module-scope call makes this file unimportable.
  const spec = (): LocalFile<T> => ({ dir: app.getPath('userData'), file: fileName, empty, validate })
  return {
    read: () => readLocal(spec()),
    write: (next, expectedRevision) => writeLocal(spec(), next, expectedRevision),
    update: (change) => updateLocal(spec(), change)
  }
}

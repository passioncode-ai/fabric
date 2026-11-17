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
// files. What is left here is the folder: since ADR-0195 W2b the process's entry
// names it once (`setLocalStoreDir`), the window `app.getPath('userData')` and the
// board's own process the same path, so this file imports no Electron.
//
// The old shape — `read(): T` and `write(next): void` — is gone on purpose. A
// read that cannot say "this is the default because the file would not parse"
// and a write that returns nothing are the two halves of the same lie.

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

let dirOf: (() => string) | null = null

/** The data folder every store of this process reads and writes; set once by the process's entry, before any read. */
export function setLocalStoreDir(resolve: () => string): void {
  dirOf = resolve
}

/** A store used before its process named the data folder: a wiring defect, said by name rather than read as empty. */
export class LocalStoreDirUnset extends Error {
  constructor(file: string) {
    super(`the data folder for ${file} is not set: the process's entry calls setLocalStoreDir first`)
    this.name = 'LocalStoreDirUnset'
  }
}

export function localStore<T>(
  fileName: string,
  empty: T,
  /** How to tell a valid file. Not optional: "it parsed" is not "it is what we
   *  asked for", and a hand-edited list turned into an object used to reach the
   *  renderer and break the estate home. */
  validate: (parsed: unknown) => T | null
): LocalStore<T> {
  // Resolved per call rather than at import: the window's `app.getPath` throws before the app is ready, and the folder
  // is named by the entry after this module loads.
  const spec = (): LocalFile<T> => {
    if (!dirOf) throw new LocalStoreDirUnset(fileName)
    return { dir: dirOf(), file: fileName, empty, validate }
  }
  return {
    read: () => readLocal(spec()),
    write: (next, expectedRevision) => writeLocal(spec(), next, expectedRevision),
    update: (change) => updateLocal(spec(), change)
  }
}

// A half-described project, kept where the operator's own state is kept (AX-05).
//
// OPERATOR-LOCAL, NOT ESTATE TRUTH, and therefore not journalled — the same
// boundary `digestMark` and `favourites` sit on, and `localStore` states it:
// facts about the PERSON at the desk, because "the record has to stay smaller
// than what it describes". A form somebody is typing into is the clearest case:
// journalling every keystroke would make the log grow faster than the work.
//
// WHAT THIS REMOVES. The onboarding draft lived in `useState` in `App.tsx`, so
// an operator part-way through describing a project lost its name, its purpose
// and the repositories they had chosen when the app closed. `shared/tabs.ts`
// KNEW — it refused to restore a draft tab because "quitting takes its content
// whatever this file does. Restoring the tab without it would show an empty
// form claiming to be the operator's draft" — and chose the honest half of a
// bad pair. Removing the loss is what makes the other half honest.
//
// THE ELECTRON BINDING IS NOT IN HERE, and a plant is why. Removing the filter
// below left every probe green, because this module could not be driven at all:
// it imported `localStore`, which imports `app` from electron, so a node probe
// failed at module load and the filter that keeps a restored tab honest was
// covered only as a pure function nobody was shown calling. AX-02's card names
// that substitution — "do not count pure helper tests as caller coverage".
//
// So the store arrives as an argument. `main/index.ts` builds the real one; a
// probe passes a fake and needs no Electron.

import type { LocalRead, LocalWrite } from './localState.ts'
import { worthKeeping, type DraftFile, type DraftReadStatus } from '../shared/onboardingDraft.ts'

/** The slice of `LocalStore` this module needs, and nothing more. */
export interface DraftStore {
  read(): LocalRead<DraftFile>
  update(change: (current: DraftFile) => DraftFile): LocalWrite<DraftFile>
}

export interface Drafts {
  /** Every draft worth restoring, and whether the value may be written back. */
  read(): { drafts: DraftFile; status: DraftReadStatus; problem: string | null }
  /**
   * Keep what is worth keeping, and say what happened.
   *
   * FILTERED ON THE WAY IN, so an untouched tab leaves no trace on disk and
   * cannot be restored as work nobody did. And `update` rather than `write`:
   * the read-transform-write happens at the revision that was read, so two
   * windows typing into different drafts cannot overwrite each other's file
   * wholesale.
   */
  save(next: DraftFile): LocalWrite<DraftFile>
}

export function createDrafts(store: DraftStore): Drafts {
  return {
    read() {
      const got = store.read()
      // `localStore` answers with more than two states and these pass them on
      // rather than flattening them: a default standing in for an unreadable
      // file must never be written back over it.
      // A new installation has no file yet. That is a known empty state, not
      // a failed read; the first real input must be allowed to create it.
      if (got.status === 'ready' || got.status === 'default_missing') return { drafts: got.value, status: 'ready', problem: null }
      if (got.status === 'recovered')
        return {
          drafts: got.value,
          status: 'recovered',
          problem: `the drafts file would not parse and an earlier good copy was used: ${got.error ?? 'no reason given'}`
        }
      return {
        drafts: got.value,
        status: 'unreadable',
        problem: `the drafts could not be read: ${got.error ?? got.status}`
      }
    },
    save(next) {
      return store.update(() => worthKeeping(next))
    }
  }
}

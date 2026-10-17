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
import { worthKeeping, type Draft, type DraftFile, type DraftReadStatus, type DiscardedFile } from '../shared/onboardingDraft.ts'

/** The slice of `LocalStore` this module needs, and nothing more. */
export interface DraftStore<T = DraftFile> {
  read(): LocalRead<T>
  update(change: (current: T) => T): LocalWrite<T>
}

/** How many discarded drafts are kept to be restored: the oldest go first. A draft is words, not work to archive. */
export const DISCARDED_KEEP = 20

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
  /**
   * Take a draft out of the open ones at once and keep it, in the operator's own store, to be restored (ADR-0160 §1:
   * discarding asks nothing; §2: it can be undone). Null when there is no such draft. The words never go to the
   * journal: the act is recorded by its name, and the draft waits here.
   */
  discard(tabId: string): { discardId: string; draft: Draft } | null
  /** The draft back among the open ones: under its own tab when that is free, else under the id it was kept by. */
  restore(discardId: string): { tabId: string; draft: Draft } | null
  open(tabId: string): Draft | null
  kept(discardId: string): { tabId: string; draft: Draft } | null
}

const committed = (w: { status: string }): boolean => w.status === 'committed'

export function createDrafts(
  store: DraftStore,
  trash?: DraftStore<DiscardedFile>,
  now: () => string = () => new Date().toISOString(),
  newId: () => string = () => crypto.randomUUID()
): Drafts {
  const must = <T>(got: LocalRead<T>, what: string): T => {
    if (got.status === 'ready' || got.status === 'default_missing' || got.status === 'recovered') return got.value
    throw new Error(`the ${what} could not be read: ${got.error ?? got.status}`)
  }
  return {
    open(tabId) { return must(store.read(), 'drafts')[tabId] ?? null },
    kept(discardId) {
      if (!trash) return null
      const k = must(trash.read(), 'discarded drafts')[discardId]
      return k ? { tabId: k.tabId, draft: k.draft } : null
    },
    discard(tabId) {
      if (!trash) throw new Error('discarded drafts are not kept here')
      const draft = must(store.read(), 'drafts')[tabId]
      if (!draft) return null
      const discardId = newId()
      const kept = trash.update((cur) => {
        const next: DiscardedFile = { ...cur, [discardId]: { tabId, draft, at: now() } }
        const ids = Object.keys(next).sort((a, b) => next[a].at.localeCompare(next[b].at))
        for (const old of ids.slice(0, Math.max(0, ids.length - DISCARDED_KEEP))) delete next[old]
        return next
      })
      if (!committed(kept)) throw new Error('the draft could not be kept to be restored; it was not discarded')
      const removed = store.update((cur) => { const next = { ...cur }; delete next[tabId]; return next })
      if (!committed(removed)) {
        trash.update((cur) => { const next = { ...cur }; delete next[discardId]; return next })
        throw new Error('the draft could not be taken out of the open ones; nothing was discarded')
      }
      return { discardId, draft }
    },
    restore(discardId) {
      if (!trash) return null
      const k = must(trash.read(), 'discarded drafts')[discardId]
      if (!k) return null
      let tabId = k.tabId
      const put = store.update((cur) => { tabId = cur[k.tabId] ? discardId : k.tabId; return { ...cur, [tabId]: k.draft } })
      if (!committed(put)) throw new Error('the draft could not be put back; it is still kept')
      trash.update((cur) => { const next = { ...cur }; delete next[discardId]; return next })
      return { tabId, draft: k.draft }
    },
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

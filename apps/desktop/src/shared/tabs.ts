// The working set survives a keystroke and a relaunch (M111).
//
// TWO DEFECTS IN ONE ROW, and they are joined. No `Menu` is installed, so
// Electron binds Cmd+W to Close Window: five projects open, one reflex
// keystroke, everything gone. And `tabs` is plain component state, so even
// quitting deliberately loses the set. Fixing the keystroke without persistence
// still loses everything on quit; fixing persistence without the keystroke makes
// the reflex survivable. Both, or neither is worth much.
//
// DRAFTS ARE RESTORED NOW, and the reason this file used to refuse is the
// reason it can (AX-05). It said:
//
//   "A DRAFT tab holds unsaved onboarding work that lives in renderer memory:
//    quitting takes its content whatever this file does. Restoring the tab
//    without it would show an empty form claiming to be the operator's draft —
//    a shape that says 'your work is here' over nothing."
//
// That was correct, and it was reasoning about a loss this file could not
// prevent: it chose the honest half of a bad pair. `shared/onboardingDraft.ts`
// removed the loss — a half-described project is now on disk beside the
// operator's other local state — so the premise is gone and the refusal with
// it. A restored draft tab now has its fields in it.
//
// AND A TAB IS RESTORED ONLY IF THE THING IT NAMES STILL EXISTS. One rule for
// both kinds: a project id must be in the live set, a draft id must be in the
// drafts file. Neither is dropped in silence.
//
// And a tab naming a project that no longer exists is dropped WITH ITS REASON.
// Restoring it shows a broken tab; dropping it quietly loses part of the
// operator's set without telling them. Neither is acceptable and only one of
// them is a sentence.

// ONE declaration. `Tab` used to be written out here AND again in `App.tsx`,
// three arms each and identical by luck rather than by construction (R-005).
export type { Tab } from './appRoute.ts'
import { ENTITY_KINDS, type EntityRef } from './entityRef.ts'
import type { AppRoute, Tab } from './appRoute.ts'

/** Is this an entity reference this build knows how to address? */
function readableRef(value: unknown): value is EntityRef {
  if (!value || typeof value !== 'object') return false
  const ref = value as { kind?: unknown; id?: unknown }
  return (
    typeof ref.kind === 'string' &&
    (ENTITY_KINDS as readonly string[]).includes(ref.kind) &&
    typeof ref.id === 'string' &&
    ref.id.length > 0
  )
}

/** A tab named by what it is and which one, so a draft has somewhere to go. */
export interface TabRef {
  kind: 'project' | 'draft'
  id: string
}

/**
 * The tab in front, WITH where inside it the operator was (AX-05).
 *
 * The address is on `active` alone and not on every tab: a tab that is not in
 * front has no reveal pending, and writing a stale entity beside each one would
 * restore several at once.
 */
export interface ActiveRef extends TabRef {
  at?: EntityRef
  asOf?: string
}

/** What survives a restart. */
export interface PersistedTabs {
  /** Every open tab in order, drafts included (AX-05). */
  tabs: TabRef[]
  /**
   * Which was in front, or null when the route was not a tab at all — and
   * WHERE INSIDE IT, so the address survives the restart.
   *
   * Without the address the shell reopened the project and lost the entity, and
   * "cannot be restored" is one of the three things AX-05 says an address is
   * for. Restoring one whose entity has since been deleted lands on the project
   * with a reveal that finds nothing, which is the same outcome as opening a
   * stale link — stated because the alternative, dropping the tab, throws away
   * a place the operator asked for over a row we cannot check from here.
   */
  active: ActiveRef | null
  /**
   * LEGACY, read on the way in and never written (AX-05).
   *
   * Files written before drafts were durable held project ids here and a bare
   * project id in `active`. `restoreTabs` reads that shape so an existing
   * installation keeps its tabs across this change; nothing writes it any more.
   */
  open?: string[]
}

// `active` is the ROUTE, which is wider than a tab: the agents view is a place
// the shell can be and is not a tab. It persists as "no tab in front", which is
// what it is.
export function toPersist(tabs: readonly Tab[], active: AppRoute): PersistedTabs {
  const out: TabRef[] = []
  const has = (kind: TabRef['kind'], id: string): boolean =>
    out.some((t) => t.kind === kind && t.id === id)
  for (const t of tabs) {
    if (t.kind === 'project' && !has('project', t.projectId)) out.push({ kind: 'project', id: t.projectId })
    if (t.kind === 'draft' && !has('draft', t.id)) out.push({ kind: 'draft', id: t.id })
  }
  const ref: ActiveRef | null =
    active.kind === 'project' && has('project', active.projectId)
      ? {
          kind: 'project',
          id: active.projectId,
          ...(active.at ? { at: active.at } : {}),
          ...(active.asOf ? { asOf: active.asOf } : {})
        }
      : active.kind === 'draft' && has('draft', active.id)
        ? { kind: 'draft', id: active.id }
        : null
  return { tabs: out, active: ref }
}

export interface Restored {
  tabs: Tab[]
  active: Tab
  /** Ids that were open and whose subject is not there any more — a deleted
   *  project, or a draft whose contents did not survive. */
  dropped: string[]
}

/**
 * Reopen what is still there.
 *
 * `known` is the set of project ids that currently exist and `draftIds` the set
 * of drafts on disk. A saved tab outside its set is dropped and NAMED: the
 * operator gets their set back minus the part that is genuinely gone, and a
 * sentence about the difference.
 *
 * A DRAFT TAB IS RESTORED ONLY IF ITS CONTENT IS. That is the same rule as a
 * project, and it is what keeps this honest: `onboardingDraft.worthKeeping`
 * writes nothing for a form nobody typed into, so an untouched tab leaves no
 * draft, finds no draft, and is not restored as work.
 */
export function restoreTabs(
  saved: PersistedTabs | null | undefined,
  known: readonly string[],
  draftIds: readonly string[] = []
): Restored {
  if (!saved) return { tabs: [], active: { kind: 'home' }, dropped: [] }

  // The saved set, from the current shape or from the legacy one. A file written
  // before AX-05 has `open: string[]` and a bare project id in `active`.
  const refs: TabRef[] = Array.isArray(saved.tabs)
    ? saved.tabs.filter((t) => t && (t.kind === 'project' || t.kind === 'draft') && typeof t.id === 'string')
    : Array.isArray(saved.open)
      ? saved.open.map((id) => ({ kind: 'project' as const, id }))
      : []
  if (refs.length === 0 && !Array.isArray(saved.tabs) && !Array.isArray(saved.open))
    return { tabs: [], active: { kind: 'home' }, dropped: [] }

  const lives = (t: TabRef): boolean =>
    t.kind === 'project' ? known.includes(t.id) : draftIds.includes(t.id)
  const live = refs.filter(lives)
  const dropped = refs.filter((t) => !lives(t)).map((t) => t.id)
  const tabs: Tab[] = live.map((t) =>
    t.kind === 'project' ? { kind: 'project', projectId: t.id } : { kind: 'draft', id: t.id }
  )

  const savedActive: ActiveRef | null =
    saved.active === null || saved.active === undefined
      ? null
      : typeof saved.active === 'string'
        ? { kind: 'project', id: saved.active }
        : saved.active
  const active: Tab =
    savedActive && live.some((t) => t.kind === savedActive.kind && t.id === savedActive.id)
      ? savedActive.kind === 'project'
        ? {
            kind: 'project',
            projectId: savedActive.id,
            // VALIDATED, not trusted: this comes off disk, and a corrupt file
            // must not produce an address pointing at a kind no surface knows.
            ...(readableRef(savedActive.at) ? { at: savedActive.at as EntityRef } : {}),
            ...(typeof savedActive.asOf === 'string' && savedActive.asOf ? { asOf: savedActive.asOf } : {})
          }
        : { kind: 'draft', id: savedActive.id }
      : { kind: 'home' }

  return { tabs, active, dropped }
}

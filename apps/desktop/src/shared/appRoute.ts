// Where the shell is, as ONE value (S13).
//
// MEASURED BEFORE THIS EXISTED. `App.tsx` held `active: Tab` and, beside it, a
// boolean `showAgents`. Every content branch was written `{!showAgents &&
// active.kind === '…' && …}` and `openProject` did not clear the boolean. So a
// click on a search hit or an attention row while the agents view was open ran
// `setActive({kind:'project'})`, opened the tab, changed the tab strip — and
// left the agents list on screen. The operator navigated and nothing happened.
//
// AND THE SECOND HALF IS WORSE THAN THE FIRST. `openTaskFor` was set at the
// same moment and handed to `ProjectHome` as `requestedTask`. `ProjectHome`
// never mounted, so nothing consumed it and `onTaskOpened` never fired: the
// request sat in state until the operator toggled the agents view off — minutes
// later, from somewhere else entirely — and then jumped them to a task they had
// asked for and forgotten. A navigation that does nothing is confusing; one
// that fires later is a haunting.
//
// TWO BOOLEANS SIDE BY SIDE HAVE FOUR STATES AND TWO OF THEM ARE NONSENSE. The
// fix is not a third `setShowAgents(false)` at each call site — a rule applied
// by hand at each call site holds until somebody adds a call site. It is that
// there is one value, so being at the agents view and being at a project are
// mutually exclusive BY CONSTRUCTION, and the renderer switches on it
// exhaustively: adding an arm without a branch fails the build.

import { destinationOf, type EntityRef } from './entityRef.ts'

/** A tab is the estate home, an onboarding draft, or an open project — the
 *  things the tab strip shows. `tabs.ts` persists them. */
export type Tab =
  | { kind: 'home' }
  | { kind: 'draft'; id: string }
  | {
      kind: 'project'
      projectId: string
      /**
       * WHERE INSIDE THE PROJECT, as part of the address (AX-05).
       *
       * The shell could say which project it was at and nothing narrower, so a
       * question, a decision or a revision had no address: it could not be
       * linked to, compared, or restored. `Focus` carried the entity as a
       * one-shot REQUEST that the screen honouring it had to clear — and a
       * request is not a location. AX-03, AX-04 and AX-06 all wait on this by
       * AX-05's own `depends_on`.
       *
       * Optional, because "at the project" is a real place and the commonest
       * one. Built through `routeToEntity`, never by hand, so an unaddressable
       * ref cannot become an address.
       */
      at?: EntityRef
      /**
       * As of which revision, when the reader is looking at the past.
       *
       * A revision is part of WHERE you are: two readers of the same entity at
       * different revisions are at different places, and a screen that cannot
       * say which it is showing invites a past reading to be acted on as the
       * present one.
       */
      asOf?: string
    }

/**
 * Everywhere the shell can be. A superset of `Tab`: the agents view is a place,
 * not a decoration over one, and it is deliberately NOT a tab — it has no close
 * button and nothing to persist. The board (SCR-41) is a place of the same kind.
 */
export type AppRoute =
  | Tab
  | { kind: 'agents' }
  /** SCR-41. Estate-wide by default; `projectId` scopes it to one project, `item` opens one row. */
  | { kind: 'board'; projectId?: string | null; item?: string | null }
  /** SCR-40. Every project by default; `projectId` opens one project's goals. */
  | { kind: 'plan'; projectId?: string | null }
  /** SCR-42. Every project by default; `projectId` narrows it to one. */
  | { kind: 'pulse'; projectId?: string | null }
  /** Releases with their basis (ADR-0084). Every project by default; `release` opens one. */
  | { kind: 'releases'; projectId?: string | null; release?: string | null }
  /** SCR-36. Fabric's look on this machine. */
  | { kind: 'persona' }
  /** SCR-44. How to work with Fabric. */
  | { kind: 'help' }
  /** The account's quota, under «Управление». */
  | { kind: 'quota' }
  /** The first useful result on one project (the launch guide). */
  | { kind: 'guide'; projectId: string }

/**
 * What the screen on show must reveal — DERIVED from the route by `revealAt`,
 * never stored beside it (AX-05).
 *
 * It used to be state of its own, and its own doc said why: "separate from the
 * route because it is CONSUMED". That was true and it was the defect. Consuming
 * the request left the route unable to say where the operator was, so the
 * entity had no address: nothing to link to, nothing to compare, nothing to
 * restore. Two facts about one place drift, and these two did.
 *
 * The consuming is now a LATCH the shell holds (`honoured`), which says this
 * visit has been served — while the address itself stays in the route.
 */
export interface Focus {
  projectId: string
  ref: EntityRef
}

/**
 * Where "back" goes, and whether it goes anywhere (AX-05).
 *
 * MEASURED 2026-09-10: `returnTo` was written on EVERY navigation and read by
 * nothing. The comment above it has always said why it exists, so it read as
 * capability — and there was no Back at all. Fifth field of this shape found in
 * one cycle, which is why `scripts/check-written-never-read.mjs` now exists.
 *
 * AND THE RETURN ROUTE HAS TO OUTLIVE THE FOCUS. A focus is CONSUMED — the
 * screen that honours it clears it, or it fires again on the next mount — so by
 * the time the operator is looking at the thing they navigated to, the focus and
 * its `returnTo` are already gone. The shell therefore keeps the origin as its
 * own state, and this function is what decides whether showing a Back is
 * honest: a return to where you already are is a control that does nothing.
 */
export function returnableTo(origin: AppRoute | null, active: AppRoute): AppRoute | null {
  if (!origin) return null
  if (origin.kind !== active.kind) return origin
  if (origin.kind === 'project' && active.kind === 'project')
    return origin.projectId === active.projectId ? null : origin
  if (origin.kind === 'draft' && active.kind === 'draft')
    return origin.id === active.id ? null : origin
  if (origin.kind === 'guide' && active.kind === 'guide')
    return origin.projectId === active.projectId ? null : origin
  if (origin.kind === 'pulse' && active.kind === 'pulse')
    return (origin.projectId ?? null) === (active.projectId ?? null) ? null : origin
  if (origin.kind === 'plan' && active.kind === 'plan')
    return (origin.projectId ?? null) === (active.projectId ?? null) ? null : origin
  if (origin.kind === 'releases' && active.kind === 'releases')
    return (origin.projectId ?? null) === (active.projectId ?? null) ? null : origin
  if (origin.kind === 'board' && active.kind === 'board')
    return (origin.projectId ?? null) === (active.projectId ?? null) ? null : origin
  // Same kind, no id to tell them apart: home, agents and the board are single places.
  return null
}

/** Reached from the agents view, from a panel, from anywhere: the destination
 *  is the same value and the origin cannot survive it. */
export function routeToProject(projectId: string): AppRoute {
  return { kind: 'project', projectId }
}

/** An address, or the reason there is none. */
export type Addressed =
  | { addressed: true; route: AppRoute }
  | { addressed: false; why: string; fallback: AppRoute }

/**
 * The address of one entity, built through the resolver that already knows
 * which refs a surface can focus (AX-05).
 *
 * NEVER BY HAND. `destinationOf` is the one place that answers "does any screen
 * focus this?", and it has four answers — exact, here, project-only and
 * unaddressable. Only the first is an address. Letting a caller assemble
 * `{ kind: 'project', at: ref }` itself would put a location on screen that no
 * screen can reach, which is the confident-answer defect wearing a route.
 *
 * The other three answers come back with a FALLBACK, so a caller that cannot
 * address the thing still knows where to go instead — and can say why.
 */
export function routeToEntity(input: {
  ref: EntityRef
  projectId: string | null
  owner?: string | null
  asOf?: string
}): Addressed {
  const to = destinationOf({ ref: input.ref, projectId: input.projectId, owner: input.owner })
  if (to.at === 'exact')
    return {
      addressed: true,
      route: {
        kind: 'project',
        projectId: to.projectId,
        at: to.focus,
        ...(input.asOf ? { asOf: input.asOf } : {})
      }
    }
  if (to.at === 'project')
    return { addressed: false, why: to.why, fallback: { kind: 'project', projectId: to.projectId } }
  if (to.at === 'here')
    return {
      addressed: false,
      why: 'the act that resolves this is on the row you are already looking at',
      fallback: { kind: 'home' }
    }
  return { addressed: false, why: to.why, fallback: { kind: 'home' } }
}

/** The entity this route addresses, if it addresses one. A READER, and the
 *  reason `at` is not a field written on every navigation and read by nothing —
 *  which is precisely what `Focus.returnTo` was until AX-05b. */
export function entityAt(route: AppRoute): EntityRef | null {
  return route.kind === 'project' ? (route.at ?? null) : null
}

/** The revision this route is reading at, if it names one. */
export function asOfAt(route: AppRoute): string | null {
  return route.kind === 'project' ? (route.asOf ?? null) : null
}

/**
 * The address as one comparable string, and the latch key for "already
 * revealed at this visit".
 *
 * A visit is not the address: arriving at the same entity twice from two search
 * hits is two visits, and both must reveal. So the shell resets the latch on
 * every navigation rather than remembering addresses forever.
 */
export function addressKey(route: AppRoute): string | null {
  const at = entityAt(route)
  if (!at) return null
  const asOf = asOfAt(route)
  return `${route.kind === 'project' ? route.projectId : ''}/${at.kind}:${at.id}${asOf ? '@' + asOf : ''}`
}

/**
 * The reveal this route implies, or null when there is nothing to reveal.
 *
 * DERIVED, NOT STORED, and that is the point of AX-05. The shell used to hold
 * the entity in a `Focus` state BESIDE the route, so the place the operator was
 * at and the thing they were looking at were two facts that could disagree —
 * and did: the request was consumed by the screen that honoured it, leaving the
 * route unable to say where the operator actually was. One source, read twice,
 * cannot drift.
 *
 * `honoured` is the latch, not a second copy of the address: it says this visit
 * has already been served, so a re-render does not drag the operator back to
 * the entity they have since scrolled away from.
 */
export function revealAt(route: AppRoute, honoured: string | null): Focus | null {
  if (route.kind !== 'project') return null
  const at = entityAt(route)
  if (!at) return null
  if (honoured !== null && honoured === addressKey(route)) return null
  return { projectId: route.projectId, ref: at }
}

/** The same place, minus the entity — where clearing a reveal lands. The
 *  project is still a real place, so this is a narrowing, not a retreat. */
export function withoutAddress(route: AppRoute): AppRoute {
  return route.kind === 'project' ? { kind: 'project', projectId: route.projectId } : route
}

/** Is this the same PLACE? Two readings of one entity at different revisions
 *  are different places, which is what makes `asOf` part of the address rather
 *  than a display option. */
export function sameRoute(a: AppRoute, b: AppRoute): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'guide' && b.kind === 'guide') return a.projectId === b.projectId
  if (a.kind === 'pulse' && b.kind === 'pulse') return (a.projectId ?? null) === (b.projectId ?? null)
  if (a.kind === 'plan' && b.kind === 'plan') return (a.projectId ?? null) === (b.projectId ?? null)
  if (a.kind === 'releases' && b.kind === 'releases')
    return (a.projectId ?? null) === (b.projectId ?? null) && (a.release ?? null) === (b.release ?? null)
  if (a.kind === 'board' && b.kind === 'board')
    return (a.projectId ?? null) === (b.projectId ?? null) && (a.item ?? null) === (b.item ?? null)
  if (a.kind === 'project' && b.kind === 'project')
    return (
      a.projectId === b.projectId &&
      (a.at?.kind ?? null) === (b.at?.kind ?? null) &&
      (a.at?.id ?? null) === (b.at?.id ?? null) &&
      (a.asOf ?? null) === (b.asOf ?? null)
    )
  if (a.kind === 'draft' && b.kind === 'draft') return a.id === b.id
  return true
}

/**
 * Is this focus for the screen that is asking?
 *
 * The mount that consumes a focus must be the one it was addressed to. Without
 * this, a request made for project A is honoured by project B's screen — the
 * shape that turned a dropped navigation into a delayed one.
 */
export function focusFor(focus: Focus | null, projectId: string): EntityRef | null {
  return focus && focus.projectId === projectId ? focus.ref : null
}

/**
 * Does this focus still address somewhere the shell can be?
 *
 * A focus outlives the click that made it. If its project closed meanwhile,
 * honouring it would reopen a tab the operator deliberately shut; dropping it
 * silently would be the same class of quiet loss this file exists to remove, so
 * the caller is told which happened.
 */
export function focusSurvives(focus: Focus, openProjects: readonly string[]): boolean {
  return openProjects.includes(focus.projectId)
}

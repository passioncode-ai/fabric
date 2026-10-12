// #region fabric-link-arrival — docs: docs/ux/scenarios.md#scn-142-open-fabric-from-a-products-button-in-that-products-project-and-go-on-in-a-coding-agent
import type { LinkRoute } from '../../shared/linkRoute.ts'

/**
 * When an opened `fabric://` link may move the window (SCN-142 alt path: "Fabric's first run is not finished → the
 * first run opens and the request waits; it is offered when it ends").
 *
 * `deciding`: the app does not yet know whether the first run is due (the project list is still loading), so a link
 * waits rather than open somewhere the first run would then pull the person away from. `first-run`: the first run is
 * on screen; a link waits rather than pull the person out of it. `open`: a link opens at once. The newest held link
 * wins: it is the last button the person pressed.
 */
export type LinkGate = 'deciding' | 'first-run' | 'open'

export function receiveLink(gate: LinkGate, held: LinkRoute | null, link: LinkRoute): { held: LinkRoute | null; apply: LinkRoute | null } {
  return gate === 'open' ? { held, apply: link } : { held: link, apply: null }
}

/**
 * The gate opens. With no first run due, or a first run the person ended without choosing where to go, the held link
 * opens; a first run that ended with a chosen next step keeps that step, and the link is offered beside it.
 */
export function releaseLink(held: LinkRoute | null, how: 'no-first-run' | 'first-run-home' | 'first-run-chose'): { apply: LinkRoute | null; offer: LinkRoute | null } {
  if (!held) return { apply: null, offer: null }
  return how === 'first-run-chose' ? { apply: null, offer: held } : { apply: held, offer: null }
}
// #endregion fabric-link-arrival

// #region place-title — docs: docs/ux/plans/2026-11-12-simple-screens.md#wave-2-cross-cutting-every-screen
// SP-1 (2026-11-12): the top bar's title is a screen's one title, so a screen opened for a project names it there.
// Доска, План, Пульс and Выпуски hide their own heading; without a case here the bar read «Fabric» (0.3.20 review,
// iteration 3 run three, UX-60).
import type { Translate } from './i18n'

export type ProjectPlace = 'board' | 'plan' | 'pulse' | 'releases'

const PLACE_KEY = { board: 'launch.nav.board', plan: 'launch.nav.plan', pulse: 'launch.pulse.open', releases: 'launch.releases.list' } as const

/** The title of a place that may be opened for one project: «Доска · {проект}», or the place alone. */
export function projectPlaceTitle(place: ProjectPlace, projectName: string | null, t: Translate): string {
  const name = t(PLACE_KEY[place])
  return projectName ? t('rail.placeOf', { place: name, project: projectName }) : name
}
// #endregion place-title

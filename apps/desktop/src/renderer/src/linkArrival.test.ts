import { describe, expect, it } from 'vitest'
import { receiveLink, releaseLink } from './linkArrival.ts'
import type { LinkRoute } from '../../shared/linkRoute.ts'

const atlas: LinkRoute = { route: { kind: 'project', projectId: 'p-atlas' }, notice: 'conversation-soon' }
const site: LinkRoute = { route: { kind: 'project', projectId: 'p-site' }, notice: 'start-session' }

describe('a fabric:// link and the first run (SCN-142)', () => {
  it('opens at once when nothing holds the window', () => {
    expect(receiveLink('open', null, atlas)).toEqual({ held: null, apply: atlas })
  })
  it('waits while the first run is on screen, or not yet decided — the newest link wins', () => {
    expect(receiveLink('first-run', null, atlas)).toEqual({ held: atlas, apply: null })
    expect(receiveLink('deciding', atlas, site)).toEqual({ held: site, apply: null })
  })
  it('opens the held link when no first run is due, or the person ended it without choosing', () => {
    expect(releaseLink(atlas, 'no-first-run')).toEqual({ apply: atlas, offer: null })
    expect(releaseLink(atlas, 'first-run-home')).toEqual({ apply: atlas, offer: null })
  })
  it('keeps the person’s chosen next step and offers the link beside it', () => {
    expect(releaseLink(atlas, 'first-run-chose')).toEqual({ apply: null, offer: atlas })
    expect(releaseLink(null, 'first-run-chose')).toEqual({ apply: null, offer: null })
  })
})

// 0.3.5 review UX-14: the first run can be left by the rail, which stays visible, as well as by its own Finish. A link
// held during it was released only by Finish, so leaving by the rail dropped it without a word.
describe('leaving the first run by any route', () => {
  it('offers the held link beside wherever the person went', () => {
    expect(releaseLink(atlas, 'first-run-left')).toEqual({ apply: null, offer: atlas })
    expect(releaseLink(null, 'first-run-left')).toEqual({ apply: null, offer: null })
  })
  it('App releases what it holds whenever the route leaves the first run, not only from Finish', async () => {
    const { readFileSync } = await import('node:fs')
    const path = await import('node:path')
    const app = readFileSync(path.join(__dirname, 'App.tsx'), 'utf8')
    const region = app.slice(app.indexOf('// #region fabric-link-open'), app.indexOf('// #endregion fabric-link-open'))
    expect(region).toMatch(/if \(!linkDecided\.current \|\| active\.kind === 'welcome' \|\| !heldLink\.current\) return\s*releaseHeld\('first-run-left'\)/)
    expect(region).toMatch(/\}, \[active\.kind\]\)/)
  })
  it('a link Fabric could not read has its words', async () => {
    const { readFileSync } = await import('node:fs')
    const path = await import('node:path')
    const app = readFileSync(path.join(__dirname, 'App.tsx'), 'utf8')
    expect(app).toMatch(/'link-unreadable': 'links\.notice\.link-unreadable'/)
  })
})

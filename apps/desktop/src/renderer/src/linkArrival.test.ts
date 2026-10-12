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

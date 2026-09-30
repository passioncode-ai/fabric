// The two failures a person could not see (M106).
//
// Neither breaks a build and neither throws: one renders an empty rectangle
// with the diagnosis one branch away in unreachable state, and the other puts
// `Error invoking remote method 'memory:search': …` in front of somebody who
// has no relationship with that mechanism. A test is the only thing that would
// ever notice either.

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { BootFailure, OperatorError } from './OperatorError'
import { App } from './App'
import { en } from './i18n/en'

afterEach(cleanup)

describe('a failure in front of the operator', () => {
  it('never shows the transport wrapper', () => {
    render(
      <OperatorError raw="Error: Error invoking remote method 'memory:search': Error: the query was empty" />
    )
    expect(screen.queryByText(/remote method/)).toBeNull()
    expect(screen.getByText('the query was empty')).toBeTruthy()
  })

  it('names the cause in our words when we know it', () => {
    render(<OperatorError raw="estates read failed: TypeError: fetch failed" />)
    expect(screen.getByText(en['error.database-unreachable'])).toBeTruthy()
  })

  it('and keeps the machine’s words beside it, never instead of it', () => {
    // A named cause with its evidence hidden is undiagnosable the first time
    // the cause is named wrongly.
    render(<OperatorError raw="estates read failed: TypeError: fetch failed" />)
    expect(screen.getByText(/fetch failed/)).toBeTruthy()
  })

  it('an unrecognised failure still says something, and shows its own words', () => {
    render(<OperatorError raw="Error: a task needs an instruction" />)
    expect(screen.getByText(en['error.title'])).toBeTruthy()
    expect(screen.getByText('a task needs an instruction')).toBeTruthy()
  })
})

describe('a window that could not read what it is for', () => {
  it('says so, instead of rendering an empty rectangle', () => {
    // `meta.info()` rejecting left `sessionWindowId` at `undefined`, and the
    // early return sits ABOVE the banner: the message reached state and never
    // reached the screen.
    render(<BootFailure raw="Error: fetch failed" onRetry={() => {}} />)
    expect(screen.getByText(en['boot.failedTitle'])).toBeTruthy()
  })

  it('explains why it will not guess at the rest of the screen', () => {
    render(<BootFailure raw="Error: fetch failed" onRetry={() => {}} />)
    expect(screen.getByText(en['boot.failedLede'])).toBeTruthy()
  })

  it('offers a way out that is not force-quitting', () => {
    render(<BootFailure raw="Error: fetch failed" onRetry={() => {}} />)
    expect(screen.getByRole('button', { name: en['boot.retry'] })).toBeTruthy()
  })

  it('AND THE APP ACTUALLY REACHES IT — the surface alone proved nothing', async () => {
    // Written because a planted defect PASSED. Reverting App's early return to
    // the bare `<div className="booting" />` broke no test in the whole
    // renderer suite: the three tests above exercise the component and say
    // nothing about whether anything renders it. The defect could have come
    // straight back.
    ;(window as unknown as { fabric: unknown }).fabric = {
      settings: {
        read: async () => ({ theme: 'dark', locale: 'en', keepAwake: 'never' })
      },
      meta: { info: async () => Promise.reject(new Error('meta read failed: fetch failed')) },
      tabs: { read: async () => null, onCloseActive: () => () => {} },
      // The onboarding drafts are read at mount now (AX-05), so this stub needs
      // the channel: without it the effect throws, `Shell` unmounts, and the
      // boot banner this case is about never renders — the failure lands three
      // files from its cause.
      drafts: { read: async () => ({ drafts: {}, problem: null }), save: async () => ({ saved: true, reason: null }) },
      projects: { list: async () => [] },
      terminal: { list: async () => [] },
      feed: { replay: async () => [] }
    }
    render(<App />)
    expect(await screen.findByText(en['boot.failedTitle'])).toBeTruthy()
  })
})

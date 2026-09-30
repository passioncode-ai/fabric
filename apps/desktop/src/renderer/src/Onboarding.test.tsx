// The choice that was not one (M99).
//
// Onboarding rendered a radiogroup with two radios, the second permanently
// disabled behind "Hosted estates are not built yet." It was not a dead button
// — it said why — but a radiogroup with one selectable option asks a person to
// decide something with a single answer, in the form where they are deciding
// what their project actually is.
//
// Nothing about hosting is lost: the main process still declares `cloud` with
// `available: false`, and the day it turns true the radiogroup returns by
// itself. The last test here is that promise, written down.

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from './i18n'
import { Onboarding } from './Onboarding'
import { EMPTY_DRAFT } from './App'
import { en } from './i18n/en'
import type { MemoryBackendOption } from '../../shared/types'

afterEach(cleanup)

const mount = (backends: MemoryBackendOption[]): void => {
  ;(window as unknown as { fabric: unknown }).fabric = {
    terminal: { memoryBackends: async () => backends, options: async () => [] },
    repos: { choose: async () => [] },
    projects: { create: async () => ({}) }
  }
  render(
    <I18nProvider locale="en">
      <Onboarding
        draft={{ ...EMPTY_DRAFT, projectId: 'p1' }}
        onDraftChange={() => {}}
        onCreated={() => {}}
        onCancel={() => {}}
        onError={() => {}}
      />
    </I18nProvider>
  )
}

const LOCAL: MemoryBackendOption = { id: 'local', available: true, reason: null }
const CLOUD_OFF: MemoryBackendOption = {
  id: 'cloud',
  available: false,
  reason: 'hosted-estates-not-built'
}

describe('where memory lives, in the form that creates a project', () => {
  it('shows the unavailable backend WITH its reason', async () => {
    // M99 removed it and the operator overturned that on 2026-09-05: the
    // roadmap this states out loud is worth more than the cost of a radio
    // nobody can press. The decision is a test, not a comment, because the
    // removal had one and the restoration needs one too.
    mount([LOCAL, CLOUD_OFF])
    expect(await screen.findByText(en['onboarding.memoryName.cloud'])).toBeTruthy()
    expect(
      screen.getByText(en['onboarding.memoryUnavailable.hosted-estates-not-built'])
    ).toBeTruthy()
  })

  it('and it cannot be picked — a shown option is not a selectable one', async () => {
    mount([LOCAL, CLOUD_OFF])
    await screen.findByText(en['onboarding.memoryName.cloud'])
    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    expect(radios).toHaveLength(2)
    expect(radios.filter((r) => !r.disabled)).toHaveLength(1)
  })

  it('a SINGLE declared backend is told, not asked', async () => {
    // The half of M99 that survives: a radiogroup of one is not a choice.
    mount([LOCAL])
    expect(await screen.findByText(en['onboarding.memoryOnly'])).toBeTruthy()
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
  })

  it('the day hosting lands, the second radio simply becomes selectable', async () => {
    mount([LOCAL, { id: 'cloud', available: true, reason: null }])
    await waitFor(() => expect(screen.queryAllByRole('radio')).toHaveLength(2))
    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    expect(radios.filter((r) => !r.disabled)).toHaveLength(2)
  })

  it('and each backend carries ITS OWN description', async () => {
    // The old form chose the hint with `available ? localHint : reason`, so a
    // second available backend would have been described as living in this
    // machine's database. A screen that lies the day the data changes.
    mount([LOCAL, { id: 'cloud', available: true, reason: null }])
    await screen.findByText(en['onboarding.memoryHint.cloud'])
    expect(screen.getByText(en['onboarding.memoryHint.local'])).toBeTruthy()
  })

  it('a machine with NO backend says so rather than showing an empty field', async () => {
    mount([{ ...LOCAL, available: false, reason: 'no-database' }, CLOUD_OFF])
    expect(await screen.findByText(en['onboarding.memoryNone'])).toBeTruthy()
  })
})

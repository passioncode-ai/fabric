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

import { afterEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  it('associates the default-agent hint with its native selector', () => {
    mount([LOCAL])
    const select = screen.getByRole('combobox')
    const hint = screen.getByText(en['onboarding.defaultAgentHint'])
    expect(select.getAttribute('aria-describedby')).toBe(hint.id)
    expect(hint.id).not.toBe('')
  })

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

// ADR-0100 · SCN-129: a new project in a NEW folder, created under a chosen parent and added to the draft.
describe('a new folder for a new project (SCN-129)', () => {
  const NewFolderHost = ({ createFolder }: { createFolder: (i: unknown) => Promise<unknown> }): React.JSX.Element => {
    const [draft, setDraft] = React.useState({ ...EMPTY_DRAFT, projectId: 'p1', name: 'walk-new' })
    ;(window as unknown as { fabric: unknown }).fabric = {
      terminal: { memoryBackends: async () => [], options: async () => [] },
      repos: { choose: async () => [] },
      projects: { create: async () => ({}) },
      start: { chooseFolder: async () => '/w', createFolder }
    }
    return (
      <I18nProvider locale="en">
        <Onboarding draft={draft} onDraftChange={setDraft} onCreated={() => {}} onCancel={() => {}} onError={() => {}} />
      </I18nProvider>
    )
  }
  it('creates the folder under the chosen parent, named after the project, and adds it as the primary repository', async () => {
    const createFolder = vi.fn(async () => ({ ok: true, path: '/w/walk-new' }))
    render(<NewFolderHost createFolder={createFolder} />)
    fireEvent.click(screen.getByRole('button', { name: en['onboarding.newFolder'] }))
    await waitFor(() => expect(createFolder).toHaveBeenCalledWith({ parent: '/w', name: 'walk-new', git: true }))
    await screen.findByText('/w/walk-new')
  })
  it('a refused folder says why and adds nothing', async () => {
    const createFolder = vi.fn(async () => ({ ok: false, reason: 'exists', detail: '/w/walk-new' }))
    render(<NewFolderHost createFolder={createFolder} />)
    fireEvent.click(screen.getByRole('button', { name: en['onboarding.newFolder'] }))
    await screen.findByText(en['start.new.refused.exists'].replace('{detail}', '/w/walk-new'))
    expect(screen.queryByText('/w/walk-new', { selector: '.mono' })).toBeNull()
  })
})

// #region new-project-agent-choice-test — docs: docs/ux/scenarios.md#scn-129-create-a-new-project-in-a-new-folder-or-as-an-idea
describe('the default coding agent of a new project (REQ-40)', () => {
  // The form started on Claude Code whatever the machine had: on a Mac without it, the chosen option was a greyed-out
  // one, and the project was created with a default agent its Launch could not start.
  const option = (id: string, available: boolean) => ({ id, label: id, program: id === 'shell' ? null : id, description: '', available, connectsToSurface: true, permissionModes: [], defaultMode: null })
  const AgentHost = ({ options, order, onDraft }: { options: unknown[]; order: unknown[] | null; onDraft: (d: typeof EMPTY_DRAFT) => void }): React.JSX.Element => {
    const [draft, setDraft] = React.useState({ ...EMPTY_DRAFT, projectId: 'p1' })
    ;(window as unknown as { fabric: unknown }).fabric = {
      terminal: { memoryBackends: async () => [], options: async () => options },
      settings: { read: async () => (order === null ? Promise.reject(new Error('unreadable')) : { runnerFallback: { order } }) },
      repos: { choose: async () => [] },
      projects: { create: async () => ({}) }
    }
    return (
      <I18nProvider locale="en">
        <Onboarding draft={draft} onDraftChange={(d) => { onDraft(d); setDraft(d) }} onCreated={() => {}} onCancel={() => {}} onError={() => {}} />
      </I18nProvider>
    )
  }
  it('starts on an agent this Mac has — the head of the fallback order when it is installed — and says why the others are greyed out', async () => {
    const onDraft = vi.fn()
    render(<AgentHost options={[option('claude-code', false), option('codex', true), option('kilo', true), option('shell', true)]} order={[{ runner: 'kilo', session: 'spawn' }]} onDraft={onDraft} />)
    const select = (await screen.findByRole('combobox')) as HTMLSelectElement
    await waitFor(() => expect(select.value).toBe('kilo'))
    expect(onDraft).toHaveBeenLastCalledWith(expect.objectContaining({ agent: 'kilo' }))
    const greyed = Array.from(select.options).find((o) => o.value === 'claude-code')!
    expect(greyed.disabled).toBe(true)
    expect(greyed.textContent, 'the option itself says why').toContain(en['onboarding.unavailable'])
    const hint = document.getElementById(select.getAttribute('aria-describedby') ?? '')!
    expect(hint.textContent, 'and what to do').toContain(en['onboarding.unavailableHint'])
  })
  it('without a readable order, the first installed one; an installed choice is never replaced', async () => {
    const onDraft = vi.fn()
    render(<AgentHost options={[option('claude-code', false), option('codex', true)]} order={null} onDraft={onDraft} />)
    const select = (await screen.findByRole('combobox')) as HTMLSelectElement
    await waitFor(() => expect(select.value).toBe('codex'))
    cleanup()
    const untouched = vi.fn()
    render(<AgentHost options={[option('claude-code', true), option('codex', true)]} order={[{ runner: 'codex', session: 'spawn' }]} onDraft={untouched} />)
    const again = (await screen.findByRole('combobox')) as HTMLSelectElement
    await new Promise((r) => setTimeout(r, 20))
    expect(again.value, 'the operator\'s (or the form\'s) installed choice stays').toBe('claude-code')
    expect(untouched).not.toHaveBeenCalled()
    expect(document.getElementById(again.getAttribute('aria-describedby') ?? '')!.textContent, 'nothing greyed out, nothing to explain').not.toContain(en['onboarding.unavailableHint'])
  })
})
// #endregion new-project-agent-choice-test

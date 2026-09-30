// A half-described project survives quitting (AX-05).
//
// The onboarding draft lived in `useState`, so an operator part-way through
// describing a project — its name, its purpose, the repositories they had
// picked — lost all of it when the window closed. `shared/tabs.ts` KNEW, and
// that is the part worth reading twice: it refused to restore a draft tab
// because "quitting takes its content whatever this file does. Restoring the
// tab without it would show an empty form claiming to be the operator's
// draft." It had reasoned correctly about a loss it could not prevent and
// chosen the honest half of a bad pair.
//
// These cases drive the SHELL, because the persist lives in an effect there and
// a pure test of the validator says nothing about whether anything calls it.
// The guard that matters most is the third one: the first render must not write
// an empty set over a file it has not read yet — the loss this change removes,
// reintroduced by the fix for it.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from './App'
import { en } from './i18n/en'
import { validateDraftFile, type DraftFile } from '../../shared/onboardingDraft'
import { createDrafts } from '../../main/onboardingDrafts'
import { readLocal, updateLocal, writeLocal } from '../../main/localState'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { whole } from '../../../test/envelopes'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const started: DraftFile = {
  'tab-1': {
    projectId: 'p-1',
    name: 'Atlas',
    purpose: 'keep the ledger',
    repoPaths: ['/atlas'],
    memory: 'local',
    agent: 'claude-code'
  }
}

function stub(
  over: { drafts?: DraftFile; status?: 'ready' | 'recovered' | 'unreadable'; problem?: string | null; savedTabs?: unknown; draftApi?: unknown } = {}
) {
  const save = vi.fn(async (_next: DraftFile) => ({ saved: true, reason: null }))
  const read = vi.fn(async () => ({
    drafts: over.drafts ?? {},
    status: over.status ?? 'ready',
    problem: over.problem ?? null
  }))
  const api = {
    settings: { read: async () => ({ theme: 'dark', locale: 'en', keepAwake: 'never' }) },
    // `meta.info` is what tells the shell WHICH window it is, and the boot gate
    // waits on `sessionId`: `undefined` means "not answered yet" and holds the
    // booting div forever. The first version of this stub returned a plausible
    // build-info object instead — it answered a different question, and the app
    // sat at `<div className="booting" />` while four cases failed on the DOM.
    meta: {
      info: async () => ({ estateName: 'org #1', filePath: null, sessionId: null })
    },
    tabs: {
      read: async () =>
        over.savedTabs ?? { tabs: [{ kind: 'draft', id: 'tab-1' }], active: { kind: 'draft', id: 'tab-1' } },
      write: vi.fn(async (_state: unknown) => {}),
      onCloseActive: () => () => {}
    },
    projects: { list: async () => [] },
    terminal: { list: async () => [], options: async () => [], memoryBackends: async () => [] },
    feed: { replay: async () => [] },
    drafts: over.draftApi ?? { read, save },
    gateway: { offer: async () => ({ reachable: false, servers: [] }) },
    memory: { backends: async () => [], overview: async () => null },
    estate: { summary: async () => null, profile: async () => null },
    attention: { list: async () => whole([]) },
    quota: { read: async () => null },
    favourites: { list: async () => [] },
    board: { query: async () => ({ rows: [], total: 0 }) },
    workspace: { state: async () => ({ path: null, git: 'declined' }) },
    windows: { openSession: async () => {} }
  }
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: api }))
  return { read, save, api }
}

describe('a draft outlives the window', () => {
  it('restores the tab WITH its fields', async () => {
    // The acceptance in its own words: "close/reopen restores draft fields
    // without inventing committed object". The fields are the point — a tab
    // with an empty form is the shape `tabs.ts` refused to show.
    const { read } = stub({ drafts: started })
    render(<App />)
    await waitFor(() => expect(read).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByDisplayValue('Atlas')).toBeTruthy())
    expect(screen.getByDisplayValue('keep the ledger')).toBeTruthy()
  })

  it('and never claims the draft is a project', async () => {
    // "Without inventing committed object": a restored draft is a form with
    // words in it. Nothing may read it as a project that exists — the projects
    // list is empty in this fixture and the shell must agree.
    stub({ drafts: started })
    render(<App />)
    await waitFor(() => expect(screen.getByDisplayValue('Atlas')).toBeTruthy())
    // The onboarding form's own create control is present, which is what a
    // draft is: unfinished. A committed project would show its header instead.
    expect(screen.queryByText(en['project.settings'])).toBeNull()
  })

  it('writes the draft when it changes', async () => {
    const { save } = stub({ drafts: started })
    render(<App />)
    await waitFor(() => expect(screen.getByDisplayValue('Atlas')).toBeTruthy())
    const before = save.mock.calls.length
    fireEvent.change(screen.getByDisplayValue('Atlas'), { target: { value: 'Atlas Rebuilt' } })
    await waitFor(() => expect(save.mock.calls.length).toBeGreaterThan(before))
    const last = save.mock.calls[save.mock.calls.length - 1][0]
    expect(last['tab-1'].name, 'the saved draft is not what the operator typed').toBe('Atlas Rebuilt')
  })

  it('and does NOT write an empty set over a file it could not read', async () => {
    // THE GUARD THAT MATTERS MOST. The persist effect runs on every change to
    // the drafts state, including the initial empty object — so without the
    // loaded flag the first render writes `{}` over the operator's
    // half-described project. That is the loss this change removes,
    // reintroduced by the fix for it.
    const { save, read } = stub({ status: 'unreadable', problem: 'the drafts could not be read: EACCES' })
    render(<App />)
    await waitFor(() => expect(read).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText(/EACCES/)).toBeTruthy())
    // A real turn of the event loop, then the absence.
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(save, 'an unreadable drafts file was overwritten with nothing').not.toHaveBeenCalled()
  })
})

describe('AD02: real shell and main draft store survive restart', () => {
  const restored: DraftFile = {
    'draft-1': { ...started['tab-1'], name: 'Original one' },
    'draft-2': { ...started['tab-1'], projectId: 'p-2', name: 'Original two' }
  }
  function disk() {
    const dir = mkdtempSync(path.join(tmpdir(), 'fabric-ad02-'))
    const spec = { dir, file: 'drafts.json', empty: {}, validate: validateDraftFile }
    expect(writeLocal(spec, restored).status).toBe('committed')
    const store = createDrafts({ read: () => readLocal(spec), update: change => updateLocal(spec, change) })
    const api = {
      read: vi.fn(async () => store.read()),
      save: vi.fn(async (next: DraftFile) => {
        const result = store.save(next)
        return { saved: result.status === 'committed', reason: result.status === 'committed' ? null : result.status }
      })
    }
    return { dir, spec, store, api }
  }
  const tabs = { tabs: [{ kind: 'draft', id: 'draft-1' }, { kind: 'draft', id: 'draft-2' }], active: { kind: 'draft', id: 'draft-1' } }
  it('restores two old drafts, creates two more and keeps all identities across a shell remount', async () => {
    const d = disk()
    try {
      const { api: shellApi } = stub({ draftApi: d.api, savedTabs: tabs })
      const shell = render(<App />)
      await screen.findByDisplayValue('Original one')
      for (const name of ['New one', 'New two']) {
        fireEvent.click(screen.getByRole('link', { name: en['launch.nav.newProject'] }))
        fireEvent.change(screen.getByPlaceholderText(en['onboarding.namePlaceholder']), { target: { value: name } })
        await waitFor(() => expect(Object.values(d.store.read().drafts).some(x => x.name === name)).toBe(true))
      }
      const saved = d.store.read().drafts
      expect(Object.keys(saved)).toHaveLength(4)
      expect(new Set(Object.values(saved).map(x => x.projectId)).size).toBe(4)
      expect(saved['draft-1']).toEqual(restored['draft-1'])
      const workingSet = shellApi.tabs.write.mock.calls.at(-1)![0]
      shell.unmount()
      stub({ draftApi: d.api, savedTabs: workingSet })
      render(<App />)
      await screen.findByDisplayValue('New two')
      for (const draft of Object.values(saved)) {
        fireEvent.click(screen.getByRole('button', { name: draft.name }))
        expect(screen.getByDisplayValue(draft.name)).toBeTruthy()
      }
      expect(d.store.read().drafts).toEqual(saved)
    } finally { cleanup(); rmSync(d.dir, { recursive: true, force: true }) }
  })
  it('late hydration preserves text entered before disk read completes', async () => {
    const d = disk()
    try {
      let resolve!: (answer: ReturnType<typeof d.store.read>) => void
      const pending = new Promise<ReturnType<typeof d.store.read>>(r => { resolve = r })
      d.api.read.mockImplementation(() => pending)
      stub({ draftApi: d.api, savedTabs: tabs })
      render(<App />)
      fireEvent.click(await screen.findByRole('link', { name: en['launch.nav.newProject'] }))
      fireEvent.change(screen.getByPlaceholderText(en['onboarding.namePlaceholder']), { target: { value: 'Early input' } })
      expect(d.api.save).not.toHaveBeenCalled()
      await act(async () => { resolve(d.store.read()); await pending })
      await waitFor(() => expect(Object.values(d.store.read().drafts).map(x => x.name)).toContain('Early input'))
      expect(screen.getByDisplayValue('Early input')).toBeTruthy()
      expect(Object.keys(d.store.read().drafts)).toHaveLength(3)
    } finally { cleanup(); rmSync(d.dir, { recursive: true, force: true }) }
  })
  it('an unreadable file cannot be replaced by new typing', async () => {
    const d = disk()
    try {
      // Neither the live file nor its recovery copy can be decoded.
      writeFileSync(path.join(d.dir, 'drafts.json'), '{broken')
      writeFileSync(path.join(d.dir, 'drafts.json.last-good'), '{broken')
      stub({ draftApi: d.api })
      render(<App />)
      fireEvent.click(await screen.findByRole('link', { name: en['launch.nav.newProject'] }))
      fireEvent.change(screen.getByPlaceholderText(en['onboarding.namePlaceholder']), { target: { value: 'Unsaved input' } })
      await waitFor(() => expect(screen.getByText(/drafts could not be read/)).toBeTruthy())
      expect(d.api.save).not.toHaveBeenCalled()
      // The real store quarantines damaged bytes; it does not install new data.
      expect(readLocal(d.spec).status).not.toBe('ready')
      cleanup()
      stub({ draftApi: d.api, savedTabs: { tabs: [], active: { kind: 'home' } } })
      render(<App />)
      fireEvent.click(await screen.findByRole('link', { name: en['launch.nav.newProject'] }))
      fireEvent.change(screen.getByPlaceholderText(en['onboarding.namePlaceholder']), { target: { value: 'Input after restart' } })
      await waitFor(() => expect(screen.getByText(/drafts could not be read/)).toBeTruthy())
      expect(d.api.save).not.toHaveBeenCalled()
    } finally { cleanup(); rmSync(d.dir, { recursive: true, force: true }) }
  })
  it('a first installation with no drafts file can save its first draft', async () => {
    const d = disk()
    try {
      // Test-owned fixtures only: make the store genuinely new, not unreadable.
      rmSync(path.join(d.dir, 'drafts.json'))
      rmSync(path.join(d.dir, 'drafts.json.last-good'))
      stub({ draftApi: d.api, savedTabs: { tabs: [], active: { kind: 'home' } } })
      render(<App />)
      fireEvent.click(await screen.findByRole('link', { name: en['launch.nav.newProject'] }))
      fireEvent.change(screen.getByPlaceholderText(en['onboarding.namePlaceholder']), { target: { value: 'First project' } })
      await waitFor(() => expect(Object.values(d.store.read().drafts).map(x => x.name)).toEqual(['First project']))
    } finally { cleanup(); rmSync(d.dir, { recursive: true, force: true }) }
  })
})

describe('the way back is offered only when there is one', () => {
  it('shows no Back on a shell nobody navigated into', async () => {
    // The negative half, and it is the half that keeps the control meaningful:
    // a Back visible from the start points nowhere, and a control that does
    // nothing teaches the operator to ignore the one that does.
    //
    // NOT COVERED HERE, and said rather than implied: driving a real navigation
    // — a search hit or an attention row calling `onOpen` — needs those panels
    // open, so the POSITIVE half rests on `appRoute.test.ts#returnableTo` plus
    // three lines of wiring in `App.tsx`. `check-written-never-read.mjs` is what
    // now guarantees the field has a reader at all, which is the failure this
    // card actually found.
    stub({ drafts: started })
    render(<App />)
    await waitFor(() => expect(screen.getByDisplayValue('Atlas')).toBeTruthy())
    expect(screen.queryByText(en['nav.back']), 'a Back appeared with nowhere to go').toBeNull()
  })
})

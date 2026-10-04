// Independent review assertions; shared public fixture setup copied from source test.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from './App'
import { StrictMode } from 'react'
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
    start: { lastScan: async () => null },
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

describe('independent initial working-set authority', () => {
  it('awaits delayed tab restoration while preserving newly typed input', async () => {
    const { api, save } = stub({drafts: started})
    let finish!: (value: unknown) => void
    const pending = new Promise(resolve => { finish = resolve })
    api.tabs.read = vi.fn(() => pending) as typeof api.tabs.read
    render(<App />)
    await screen.findByRole('link', {name: en['launch.nav.newProject']})
    fireEvent.click(screen.getByRole('link', {name: en['launch.nav.newProject']}))
    fireEvent.click(await screen.findByRole('button', {name: new RegExp(en['start.card.new.title'])}))
    fireEvent.change(screen.getByPlaceholderText(en['onboarding.namePlaceholder']), {target:{value:'Example-agent early input'}})
    await waitFor(() => expect(save.mock.calls.some(([drafts]) => Object.values(drafts).some(d => d.name === 'Example-agent early input'))).toBe(true))
    expect(api.tabs.write).not.toHaveBeenCalled()
    await act(async () => { finish({tabs:[{kind:'draft',id:'tab-1'}],active:{kind:'draft',id:'tab-1'}}); await pending })
    await waitFor(() => expect(api.tabs.write).toHaveBeenCalled())
    const last=api.tabs.write.mock.calls.at(-1)![0] as {tabs:Array<{id:string}>,active:{id:string}}
    expect(last.tabs.map(t => t.id)).toContain('tab-1')
    expect(last.tabs).toHaveLength(2)
    expect(screen.getByDisplayValue('Example-agent early input')).toBeTruthy()
  })
  it('a rejected initial draft read never grants write authority', async () => {
    const { api, save } = stub()
    api.drafts.read = vi.fn().mockRejectedValue(new Error('Example-agent read failed'))
    render(<App />)
    await screen.findByText(/Example-agent read failed/)
    fireEvent.click(await screen.findByRole('link', {name: en['launch.nav.newProject']}))
    fireEvent.click(await screen.findByRole('button', {name: new RegExp(en['start.card.new.title'])}))
    fireEvent.change(screen.getByPlaceholderText(en['onboarding.namePlaceholder']), {target:{value:'Example-agent unsaved'}})
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)) })
    expect(api.tabs.write).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
    expect(api.drafts.read).toHaveBeenCalledTimes(1)
  })
  it('StrictMode effect reattachment shares one initial snapshot', async () => {
    const { api } = stub({drafts: started})
    render(<StrictMode><App /></StrictMode>)
    await screen.findByDisplayValue('Atlas')
    await waitFor(() => expect(api.tabs.write).toHaveBeenCalled())
    expect(api.drafts.read).toHaveBeenCalledTimes(1)
    const last=api.tabs.write.mock.calls.at(-1)![0] as {tabs:Array<{id:string}>}
    expect(last.tabs).toEqual([{kind:'draft',id:'tab-1'}])
  })
  it('unmounted restore cannot issue a late working-set write', async () => {
    const { api, save } = stub({drafts: started})
    let finish!: (value: unknown) => void
    const pending = new Promise(resolve => { finish = resolve })
    api.tabs.read = vi.fn(() => pending) as typeof api.tabs.read
    const mounted=render(<App />)
    await waitFor(() => expect(api.tabs.read).toHaveBeenCalled())
    mounted.unmount()
    const beforeSave=save.mock.calls.length
    await act(async () => { finish({tabs:[{kind:'draft',id:'tab-1'}],active:{kind:'draft',id:'tab-1'}}); await pending; await new Promise(resolve => setTimeout(resolve, 20)) })
    expect(api.tabs.write).not.toHaveBeenCalled()
    expect(save).toHaveBeenCalledTimes(beforeSave)
  })
})

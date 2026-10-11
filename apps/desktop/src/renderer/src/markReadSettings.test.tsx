// "Mark read" writes the read position and nothing else (audit 2026-10-05 A7-008).
//
// The shell reads the settings ONCE at start. Main keeps changing two of their fields on its own — the open
// tabs (`tabs.write`) and the workspace folder (the picker, an import) — so a window that wrote back
// `{ ...settings, readThroughSeq }` reverted the tabs saved since and could empty the folder the mirror
// writes to. Main refuses such a write now (`shared/appSettings.ts#settingsPatch`); this pins the caller.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from './App'
import { en } from './i18n/en'
import { APP_SETTINGS_DEFAULTS, type AppSettings, type FeedEvent } from '../../shared/types'
import { whole } from '../../../test/envelopes'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const ev = (seq: number): FeedEvent => ({
  estate_id: 'e1',
  seq,
  type: 'task.note.promoted@1',
  actor: { kind: 'system', id: 'x' },
  project_id: null,
  occurred_at: '2026-09-11T00:00:00Z',
  payload: {}
})

function stub(loaded: AppSettings) {
  const write = vi.fn(async (next: Partial<AppSettings>) => ({ settings: { ...loaded, ...next }, saved: true }))
  const api = {
    settings: { read: async () => loaded, write },
    meta: { info: async () => ({ estateName: 'org #1', filePath: null, sessionId: null }) },
    tabs: { read: async () => ({ tabs: [], active: null }), write: vi.fn(async () => {}), onCloseActive: () => () => {} },
    projects: { list: async () => [{ id: 'p-1', name: 'Atlas', purpose: '', repo_path: null, default_agent: 'claude-code' }] },
    stack: { exposure: async () => null },
    terminal: { list: async () => [], options: async () => [], memoryBackends: async () => [] },
    feed: { replay: vi.fn(async (from: number) => (from === 0 ? [ev(1), ev(2), ev(3)] : [])) },
    drafts: { read: async () => ({ drafts: {}, status: 'ready', problem: null }), save: async () => ({ saved: true, reason: null }) },
    start: { lastScan: async () => null },
    gateway: { offer: async () => ({ reachable: false, servers: [] }) },
    memory: { backends: async () => [], overview: async () => null },
    estate: { summary: async () => null, profile: async () => null },
    attention: { list: async () => whole([]) },
    quota: { read: async () => null },
    favourites: { list: async () => [] },
    board: { query: async () => ({ rows: [], total: 0 }) },
    workspace: { state: async () => ({ path: '/mirror', git: 'yes' }) },
    windows: { openSession: async () => {} }
  }
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: api }))
  return { write }
}

describe('Mark read', () => {
  it('sends the read position only — never the tabs or the workspace this window loaded at start', async () => {
    const loaded: AppSettings = {
      ...APP_SETTINGS_DEFAULTS,
      workspace: { path: '/mirror', git: 'yes' },
      tabs: { tabs: [{ kind: 'project', id: 'p-1' }], active: { kind: 'project', id: 'p-1' } },
      firstRun: { completedAt: '2026-10-01T00:00:00.000Z' }
    }
    const { write } = stub(loaded)
    render(<App />)
    const button = await screen.findByRole('button', { name: en['journal.markRead'].replace('{count}', '3') })
    fireEvent.click(button)
    await waitFor(() => expect(write).toHaveBeenCalled())
    expect(write.mock.calls[0]![0]).toEqual({ readThroughSeq: 3 })
  })
})

// A detached window boots on the bridge its kind is given, and asks for nothing else (CO-091).
//
// The preload now exposes only the methods a window's kind may speak (`preload/api.ts#exposedApi`),
// so a session or editor window that still ran the main window's boot — the drafts read, the Cmd+W
// subscription on `tabs` — would throw on a namespace it does not have, or ask the main process for
// something it will refuse. These cases build the stub FROM the preload's own subset, so the bridge
// under test is the one a real window of that kind receives.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { App } from './App'
import { exposedApi, type BridgeIpc } from '../../preload/api'
import { IPC } from '../../shared/types'
import type { WindowKind } from '../../shared/ipcWindowPolicy'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const SESSION = {
  sessionId: 's-1', projectId: 'p1', cwd: '/repo/atlas', program: 'claude', optionId: 'claude-code',
  permissionMode: null, excerpt: '', written: 0, running: true, state: 'running',
  startedAt: '2026-10-11T00:00:00Z', lastActivityAt: '2026-10-11T00:00:00Z'
}

/** An ipcRenderer stand-in that answers the boot and records every channel the window spoke. */
function bridgeFor(kind: WindowKind, meta: { sessionId: string | null; filePath: string | null }) {
  const spoken: string[] = []
  const answers: Record<string, unknown> = {
    [IPC.settingsRead]: { theme: 'dark', locale: 'en', keepAwake: 'never' },
    [IPC.personaRead]: { persona: { name: 'Fabric' }, chosen: false, problem: null },
    [IPC.metaInfo]: { estateName: 'org #1', ...meta },
    [IPC.terminalGet]: SESSION,
    [IPC.terminalScrollback]: { text: '', written: 0 },
    [IPC.filesRead]: { content: 'export {}\n', hash: 'h1' },
    [IPC.filesRecoveryRead]: null
  }
  const ipc: BridgeIpc = {
    invoke: (async (channel: string) => { spoken.push(channel); return answers[channel] ?? null }) as BridgeIpc['invoke'],
    send: ((channel: string) => { spoken.push(channel) }) as BridgeIpc['send'],
    on: ((channel: string) => { spoken.push(channel); return ipc }) as unknown as BridgeIpc['on'],
    removeListener: (() => ipc) as unknown as BridgeIpc['removeListener']
  }
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: exposedApi(kind, ipc) }))
  return spoken
}

describe('a detached window on its own bridge', () => {
  it('a session window boots to its session without touching the drafts, the tabs or the feed', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const spoken = bridgeFor('session', { sessionId: 's-1', filePath: null })
    render(<App />)
    await waitFor(() => expect(screen.getByText('/repo/atlas')).toBeTruthy())
    expect(spoken).toContain(IPC.terminalGet)
    for (const channel of [IPC.draftsRead, IPC.draftsSave, IPC.tabsRead, IPC.tabsCloseActive, IPC.feedReplay, IPC.projectsList])
      expect(spoken, `a session window asked for ${channel}`).not.toContain(channel)
    expect(errors, 'the boot threw on a namespace the session bridge does not carry').not.toHaveBeenCalled()
  })

  it('an editor window boots to its file the same way', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const spoken = bridgeFor('editor', { sessionId: null, filePath: '/repo/atlas/a.ts' })
    render(<App />)
    await waitFor(() => expect(spoken).toContain(IPC.filesRead))
    for (const channel of [IPC.draftsRead, IPC.draftsSave, IPC.tabsRead, IPC.tabsCloseActive, IPC.feedReplay, IPC.terminalGet])
      expect(spoken, `an editor window asked for ${channel}`).not.toContain(channel)
    expect(errors, 'the boot threw on a namespace the editor bridge does not carry').not.toHaveBeenCalled()
  })
})

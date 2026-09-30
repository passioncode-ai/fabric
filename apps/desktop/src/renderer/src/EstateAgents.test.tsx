// The watcher's channel, from the renderer's end (M107).
//
// `repoStates.watchAll(paths, (p) => broadcast(...))` fired into a channel with
// NO `ipcRenderer.on` anywhere. M56 shipped saying "the watch makes it feel
// immediate"; nothing was listening, so it did nothing at all. These tests are
// the listener — they fail the moment the subscription is dropped, which is the
// only thing that would notice, because a dead push channel breaks no build and
// throws no error.
//
// This panel is tested rather than `ProjectHome` for one reason: it is the
// harder case. The project page at least re-read on the feed's clock. This one
// read git ONCE, when an agent was selected, and never again — an agent could
// work for an hour with the branch beside it frozen at the moment of the click.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EstateAgents } from './EstateAgents'
import type { ProjectRow, RepoState, TerminalSession } from '../../shared/types'

afterEach(cleanup)

// Spelled out with NO cast. `as TerminalSession` on a partial object hid a
// required `scrollback`, and the first run of this file crashed inside
// `decodePty` instead of failing on the thing under test. A fixture that casts
// past the contract stops being a fixture for it.
const session: TerminalSession = {
  sessionId: 's1',
  projectId: 'p1',
  optionId: 'claude-code',
  cwd: '/w/a',
  permissionMode: null,
  excerpt: '',
  written: 0,
  running: true,
  state: 'running',
  startedAt: new Date().toISOString(),
  lastActivityAt: new Date().toISOString(),
  program: 'claude',
  tail: '',
  exitCode: null
}

const project = { id: 'p1', name: 'Fabric' } as ProjectRow

const state = (path: string): RepoState => ({
  path,
  branch: 'main',
  ahead: 0,
  behind: 0,
  changed: 0,
  untracked: 0,
  lastCommit: null,
  readAt: new Date().toISOString(),
  error: null
})

/** Returns the repoStates spy and the callback the panel registered. */
function harness(): { repoStates: ReturnType<typeof vi.fn>; fire: (p: string) => void } {
  let registered: ((p: string) => void) | null = null
  const repoStates = vi.fn(async () => [state('/w/a')])
  // The real jsdom `window`, with one property added — SPREADING it into a
  // plain object loses its accessors and testing-library then has no document
  // to render into, which is how the first run of this file failed.
  ;(window as unknown as { fabric: unknown }).fabric = {
    // The panel attaches a real terminal for a LIVE session (UX28-13), so the
    // PTY channels must exist even though this file's subject is the watcher.
    // Each hands back an unsubscribe, as the preload's do; without them the
    // effect threw and React unmounted the tree, which surfaced as four
    // assertions about the watcher failing against an empty body.
    runs: { status: async () => null },
    terminal: {
      history: async () => [],
      onData: () => () => {},
      onExit: () => () => {},
      scrollback: async () => null,
      write: () => {},
      resize: () => {}
    },
    windows: { openSession: () => {} },
    projects: {
      repoStates,
      onRepoChanged: (cb: (p: string) => void) => {
        registered = cb
        return () => {
          registered = null
        }
      }
    }
  }
  return {
    repoStates,
    fire: (p) => {
      if (!registered) throw new Error('the panel subscribed to nothing — the channel is dead again')
      registered(p)
    }
  }
}

/**
 * Selects the agent AND waits for its repository reading to be on screen.
 *
 * Waiting on the spy instead was wrong in a way that only a full run exposed:
 * the call happens before the reading lands, so the panel still held no paths
 * and answered every broadcast through the "not told yet" branch. The filter
 * was never exercised — the test passed for the wrong reason, intermittently.
 *
 * AND WAITING FOR THE PAINT IS STILL NOT ENOUGH — the same lesson one step
 * later. `held.current` is written by a PASSIVE effect keyed on the reading, so
 * it lands after the commit that puts "main" on screen. Under the load of a
 * full CI run the observer behind `findByText` fires in between, the panel is
 * still holding null, and `affects` answers TRUE by design — the count reads
 * two and the failure looks like a product bug. Flushing effects makes the
 * wait deterministic instead of racing the scheduler.
 */
async function selectTheAgent(): Promise<void> {
  fireEvent.click(screen.getByText('Fabric'))
  await screen.findByText('main')
  await act(async () => {})
}

describe('the estate agents panel listens to the watcher', () => {
  it('re-reads when a repository it shows moves', async () => {
    const { repoStates, fire } = harness()
    render(<EstateAgents sessions={[session]} projects={[project]} onOpen={() => {}} onError={() => {}} />)
    await selectTheAgent()
    expect(repoStates).toHaveBeenCalledTimes(1)

    fire('/w/a')
    await waitFor(() => expect(repoStates).toHaveBeenCalledTimes(2))
  })

  it('ignores a repository it does not show', async () => {
    // Every window receives the broadcast. Re-reading git in all of them for a
    // repository none displays is M102's stampede arriving by a second road.
    const { repoStates, fire } = harness()
    render(<EstateAgents sessions={[session]} projects={[project]} onOpen={() => {}} onError={() => {}} />)
    await selectTheAgent()
    expect(repoStates).toHaveBeenCalledTimes(1)

    fire('/elsewhere')
    await new Promise((r) => setTimeout(r, 30))
    expect(repoStates).toHaveBeenCalledTimes(1)
  })

  it('unsubscribes when it goes away', async () => {
    // A listener outliving its window notifies a renderer that is gone, and the
    // estate accumulates one per panel ever opened.
    const { repoStates, fire } = harness()
    const view = render(<EstateAgents sessions={[session]} projects={[project]} onOpen={() => {}} onError={() => {}} />)
    await selectTheAgent()
    expect(repoStates).toHaveBeenCalledTimes(1)

    view.unmount()
    expect(() => fire('/w/a')).toThrow()
  })

  it('a refresh that fails leaves the last good reading rather than raising a banner', async () => {
    // Ten seconds apart, forever, for a repository that has gone away. The
    // reading itself carries `error` when git could not be read — that is the
    // honest place for it, and it is already rendered.
    const errors: string[] = []
    const { repoStates, fire } = harness()
    repoStates.mockImplementationOnce(async () => [state('/w/a')])
    repoStates.mockImplementationOnce(async () => {
      throw new Error('git is gone')
    })
    render(<EstateAgents sessions={[session]} projects={[project]} onOpen={() => {}} onError={(m) => errors.push(m)} />)
    await selectTheAgent()
    expect(repoStates).toHaveBeenCalledTimes(1)

    fire('/w/a')
    await waitFor(() => expect(repoStates).toHaveBeenCalledTimes(2))
    await new Promise((r) => setTimeout(r, 30))
    expect(errors).toEqual([])
    expect(screen.queryByText('main')).not.toBeNull()
  })
})

// Where an agent will start, said before it starts (UXA-C04).
//
// MEASURED at `29f084d`: the main process resolves the launch directory as
// `project.repo_path ?? app.getPath('home')`, and the launcher showed a
// dropdown and a button. A project with no repository attached therefore starts
// an agent — with write tools — in the operator's HOME FOLDER, and nothing on
// the way there said so.
//
// The rule now lives in `shared/launchPlace.ts` and BOTH sides read it, so the
// sentence on this screen cannot drift from what the main process does. It was
// in `index.ts`, which cannot be imported (M110), so the only alternative was
// for the surface to restate it — and a restated rule is a second rule.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { AgentsSection } from './ProjectHome'
import { I18nProvider } from './i18n'
import { launchPlace } from '../../shared/launchPlace'
import type { ProjectRow } from '../../shared/types'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const project = (repo: string | null): ProjectRow =>
  ({
    id: 'p1',
    estate_id: 'e1',
    name: 'Atlas',
    purpose: null,
    repo_path: repo,
    status: 'active',
    config_revision: 1,
    created_at: '2026-09-11T00:00:00Z',
    memory_backend: 'local',
    default_agent: 'claude-code',
    mcp_servers: []
  }) as ProjectRow

function stub(): void {
  vi.stubGlobal(
    'window',
    Object.assign(globalThis.window ?? {}, {
      fabric: {
        terminal: {
          options: async () => [{ id: 'claude-code', available: true }]
        },
        agents: { list: async () => [] }
      }
    })
  )
}

const show = (repo: string | null) =>
  render(
    <I18nProvider locale="en">
      <AgentsSection
        project={project(repo)}
        sessions={[]}
        claims={[]}
        onSessionsChanged={vi.fn()}
        onError={vi.fn()}
      />
    </I18nProvider>
  )

describe('the launcher names the place', () => {
  it('the rule is the same one the main process applies', () => {
    // Asserted first: the cases below are about the SENTENCE, and they mean
    // nothing if the rule under it is a second copy.
    expect(launchPlace('/repo/atlas')).toEqual({ place: 'repository', path: '/repo/atlas' })
    expect(launchPlace(null)).toEqual({ place: 'home' })
    expect(launchPlace(undefined), 'an unread field is not a repository').toEqual({ place: 'home' })
  })

  it('shows the repository an agent will start in', async () => {
    stub()
    show('/repo/atlas')
    await waitFor(() => expect(screen.getByText(/\/repo\/atlas/)).toBeTruthy())
  })

  it('and SAYS the home folder when no repository is attached', async () => {
    // The case that matters: an agent with write tools, starting where the
    // operator's own files are, with nothing on screen about it.
    stub()
    show(null)
    await waitFor(() => expect(screen.getByText(/home folder/i)).toBeTruthy())
  })

  it('and does not claim a home folder when a repository IS attached', async () => {
    stub()
    show('/repo/atlas')
    await waitFor(() => expect(screen.getByText(/\/repo\/atlas/)).toBeTruthy())
    expect(screen.queryByText(/home folder/i)).toBeNull()
  })
})

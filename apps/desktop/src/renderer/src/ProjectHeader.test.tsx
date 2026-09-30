// Two writes, one catch, and a draft the product could erase (UX28-11).
//
// SCN-028 step 4 promises one thing — "`project.updated@1` is journalled, the
// configuration revision increments and the header shows the new values" — and
// its own Errors & recovery promises another: "a failed append surfaces the
// error banner and LEAVES THE HEADER UNCHANGED".
//
// The settings header sent TWO commands. `projects.update` carried name and
// purpose; `projects.updateSettings` carried the agent and the server list,
// conditionally, afterwards. Both inside one `try`, with one `catch` that shows
// a banner and leaves the panel open. So when the second one failed, the first
// had already been journalled and projected: the name was changed, the revision
// had moved, and the operator was told the save had not worked. Two revisions
// on a good day, and on a bad one a half-saved project reported as nothing
// saved. That is the card's negative acceptance word for word.
//
// AND NEITHER COMMAND CARRIED A BASE REVISION. `UpdateProjectInput` has
// `id/name/purpose/repoPath`; `updateSettings` takes `id/memoryBackend/
// defaultAgent/mcpServers`. Nothing says WHICH revision the operator was
// looking at when they typed, so a concurrent write could not be refused —
// last writer wins, silently, and the header displays a revision number
// beside values that came from somebody else's save.
//
// THE THIRD ONE IS THE DATA LOSS. The reset effect ran on
// `[project.id, project.config_revision]` and copied the props back over
// `name`, `purpose`, `agent` and `servers`. A background agent changing this
// project's configuration moves `config_revision` — so an operator halfway
// through typing a purpose had their words replaced by the stored ones, with
// no banner, no undo and nothing to say it happened. SCN-004 step 3 already
// names the rule this breaks — "the project draft remains intact" — and
// SCN-003 says what to do instead: "revision conflict shows the newer diff and
// asks the operator to reapply the draft".
//
// The switch on `project.id` is NOT the same thing and stays: a different
// project is a different subject, which is UX28-02's lesson about keyed reads
// read from the write side.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ProjectHeader } from './ProjectHome'
import { I18nProvider } from './i18n'
import type { ProjectRow } from '../../shared/types'
import type { ProjectSettingsWrite, SaveSettingsInput } from '../../shared/projectSettings'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const BASE = 7

const project = (over: Partial<ProjectRow> = {}): ProjectRow => ({
  id: 'p1',
  estate_id: 'e1',
  name: 'Atlas',
  purpose: 'keep the ledger',
  repo_path: null,
  status: 'active',
  config_revision: BASE,
  created_at: '2026-09-10T00:00:00Z',
  memory_backend: 'local',
  default_agent: 'claude-code',
  mcp_servers: [],
  ...over
})

/**
 * The window surface the header actually reaches for.
 *
 * `saveSettings` is the one command the card asks for; the two it replaces are
 * stubbed too, so a probe cannot pass because the header quietly went back to
 * calling them.
 */
function stub(answer?: ProjectSettingsWrite) {
  const api = {
    projects: {
      saveSettings: vi.fn(
        async (_input: SaveSettingsInput): Promise<ProjectSettingsWrite> =>
          answer ?? {
            status: 'committed',
            value: project({ config_revision: 8 }),
            revision: 8,
            fields: ['name']
          }
      ),
      update: vi.fn(async () => project()),
      updateSettings: vi.fn(async () => project())
    },
    terminal: { options: vi.fn(async () => [{ id: 'claude-code', available: true }]) },
    gateway: { offer: vi.fn(async () => ({ reachable: true, servers: ['ahrefs'] })) }
  }
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: api }))
  return api
}

const show = (row: ProjectRow, onError = vi.fn()) => {
  // `onChanged` is OBSERVED, not ignored: it is how a landed save reaches the
  // projection, and a save that does not re-read leaves the screen showing what
  // it wrote rather than what is stored.
  const onChanged = vi.fn(async () => {})
  const el = (p: ProjectRow) => (
    <I18nProvider locale="en">
      <ProjectHeader project={p} onChanged={onChanged} onError={onError} />
    </I18nProvider>
  )
  const view = render(el(row))
  return { view, onError, onChanged, rerender: (next: ProjectRow) => view.rerender(el(next)) }
}

/** Open the panel — every case below edits, so none of them starts read-only. */
const openSettings = async (): Promise<void> => {
  fireEvent.click(screen.getByText('Settings'))
  await waitFor(() => expect(screen.getByDisplayValue('Atlas')).toBeTruthy())
}

const typeInto = (current: string, next: string): void => {
  fireEvent.change(screen.getByDisplayValue(current), { target: { value: next } })
}

describe('one save is one revision', () => {
  it('sends every edited field in ONE command, carrying the revision it was typed against', async () => {
    const api = stub()
    show(project())
    await openSettings()
    typeInto('Atlas', 'Atlas Rebuilt')
    typeInto('keep the ledger', 'keep the ledger honest')
    fireEvent.click(screen.getByText('Save revision'))

    await waitFor(() => expect(api.projects.saveSettings).toHaveBeenCalledTimes(1))
    const sent = api.projects.saveSettings.mock.calls[0][0]
    expect(sent.baseRevision, 'the save carries no base revision, so a stale write cannot be refused').toBe(BASE)
    expect(sent).toMatchObject({ id: 'p1', name: 'Atlas Rebuilt', purpose: 'keep the ledger honest' })
    // The two it replaces must be gone: two appends are two revisions, and the
    // second failing is the half-saved case this card exists to remove.
    expect(api.projects.update, 'the name/purpose write is still a separate command').not.toHaveBeenCalled()
    expect(api.projects.updateSettings, 'the agent/servers write is still a separate command').not.toHaveBeenCalled()
  })

  it('and a refused save says which field, with every typed word still there', async () => {
    // The refusal SCN-028 names — "an empty name blocks the save with the draft
    // preserved". The button's `disabled` already blocks the click; what did
    // not exist was a refusal in the command, so any other caller of the IPC
    // could erase a project's name. The panel now shows what the command said.
    const api = stub({ status: 'refused', reason: 'a project needs a name', fields: ['name'] })
    show(project())
    await openSettings()
    typeInto('keep the ledger', 'still being written')
    fireEvent.click(screen.getByText('Save revision'))

    await waitFor(() => expect(api.projects.saveSettings).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/needs a name/i))
    // THE POINT. A refusal is not a reason to throw the draft away.
    expect(screen.getByDisplayValue('still being written')).toBeTruthy()
  })
})

describe('a partial save cannot look like nothing saved', () => {
  it('says nothing was saved only when nothing was — which one append makes provable', async () => {
    // THE PROBE'S FIRST SHAPE WAS WRONG and the architecture corrected it. It
    // asserted a banner naming which PORTION committed, carried over from the
    // two-command world. With one atomic append there is no portion: either the
    // event is in the journal or it is not, so the half-saved case is REMOVED
    // rather than reported better, and "nothing was saved" is a fact.
    const api = stub({ status: 'failed', reason: 'append rejected: connection lost' })
    show(project())
    await openSettings()
    typeInto('Atlas', 'Atlas Rebuilt')
    fireEvent.click(screen.getByText('Save revision'))

    await waitFor(() => expect(api.projects.saveSettings).toHaveBeenCalled())
    const said = await waitFor(() => screen.getByRole('alert').textContent ?? '')
    expect(said).toMatch(/nothing was saved/i)
    expect(said).toMatch(/connection lost/)
    // The panel stays open with the words in it: there is nothing in the
    // journal, so there is something still to do.
    expect(screen.getByDisplayValue('Atlas Rebuilt')).toBeTruthy()
  })

  it('and a save that landed but could not be read back is NOT reported as a failure', async () => {
    // The remaining partial, and it is the cycle's own defect family read from
    // the write side: a refused READ turning a recorded fact into nothing at
    // all. The change is at revision #12 whether or not the row came back.
    const api = stub({
      status: 'written',
      revision: 12,
      fields: ['name', 'purpose'],
      reason: 'projects read failed: connection lost'
    })
    const { onChanged } = show(project())
    await openSettings()
    typeInto('Atlas', 'Atlas Rebuilt')
    fireEvent.click(screen.getByText('Save revision'))

    await waitFor(() => expect(api.projects.saveSettings).toHaveBeenCalled())
    const said = await waitFor(() => screen.getByRole('alert').textContent ?? '')
    expect(said, 'a recorded revision was reported as nothing saved').toMatch(/#12/)
    expect(said).toMatch(/saved/i)
    expect(said).not.toMatch(/nothing was saved/i)
    // THE TRANSITION, and the probe was green without it. Measured by planting
    // `landed` down to `committed` only: every sentence above still read the
    // same, because the notice renders in both the editing and the read-only
    // header. What changes is the STATE — the change is in the journal, so the
    // form is finished and the projection must be re-read. A check that watches
    // the words and not the move is a check that cannot see this defect.
    await waitFor(() => expect(onChanged, 'a landed save did not re-read the projection').toHaveBeenCalled())
    expect(screen.queryByDisplayValue('Atlas Rebuilt'), 'the form stayed open over a recorded save').toBeNull()
  })

  it('and a stale base is refused with the newer values offered, not overwritten', async () => {
    // SCN-003: "revision conflict shows the newer diff and asks the operator to
    // reapply the draft." Both halves are asserted — the newer value is SHOWN,
    // and the operator's own words are still in the box to reapply.
    const api = stub({
      status: 'conflict',
      currentRevision: 9,
      currentValue: project({ config_revision: 9, purpose: 'somebody else got here first' })
    })
    show(project())
    await openSettings()
    typeInto('keep the ledger', 'my own words')
    fireEvent.click(screen.getByText('Save revision'))

    await waitFor(() => expect(api.projects.saveSettings).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByText(/somebody else got here first/), 'the newer value is not shown').toBeTruthy()
    expect(screen.getByDisplayValue('my own words'), 'the draft was discarded on conflict').toBeTruthy()
  })
})

describe('a background revision cannot erase what is being typed', () => {
  it('keeps the operator draft when the project changes underneath', async () => {
    stub()
    const { rerender } = show(project())
    await openSettings()
    typeInto('keep the ledger', 'half a sentence I am still')
    // The fixture IS the case: a background write moves the revision without
    // the operator touching anything.
    rerender(project({ config_revision: 9, purpose: 'written by an agent' }))
    // THE DATA LOSS. The reset effect copied the props over the draft.
    await waitFor(() =>
      expect(
        screen.getByDisplayValue('half a sentence I am still'),
        'a background config change erased the operator draft'
      ).toBeTruthy()
    )
  })

  it('and says the ground moved, so the draft is not saved over it blindly', async () => {
    stub()
    const { rerender } = show(project())
    await openSettings()
    typeInto('keep the ledger', 'half a sentence I am still')
    rerender(project({ config_revision: 9, purpose: 'written by an agent' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/#9|changed/i))
  })

  it('but a different project IS a different subject, and its draft does not travel', async () => {
    // The other direction, so the fix is not "never reset". UX28-02's keyed-read
    // lesson from the write side: a draft belongs to the thing it was typed for.
    stub()
    const { rerender } = show(project())
    await openSettings()
    typeInto('Atlas', 'Atlas Rebuilt')
    rerender(project({ id: 'p2', name: 'Beacon', purpose: 'something else', config_revision: 2 }))
    await waitFor(() => expect(screen.getByDisplayValue('Beacon')).toBeTruthy())
    expect(screen.queryByDisplayValue('Atlas Rebuilt'), "another project's draft followed the switch").toBeNull()
  })
})

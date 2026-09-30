// M130 on the task's own page.
//
// The board card had said `{by} → {to}` since the ladder shipped, and the task's
// OWN page — the address a task is read at cold — said nothing about who handed
// it to whom. The milestone reads "every task says who assigned it and to whom",
// and a page that omits it makes the sentence false at the one screen written
// for reading a task in full.
//
// The second test is the one worth keeping. The render is guarded by
// `assigned_by && assigned_to`, and the defect that guard exists to prevent is a
// sentence naming a person who is not there — "assigned by alice to null". A
// single `||` turns the fix into that defect, and nothing else would notice.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TaskPage } from './TaskPage'
import type { ProjectRow, TaskDetail, TaskRow } from '../../shared/types'

/** SCR-39: the workspace keeps its parts in tabs; a part is read after its tab is opened. */
const openTab = async (name: RegExp): Promise<void> => {
  fireEvent.click(await waitFor(() => screen.getByRole('button', { name })))
}

afterEach(cleanup)

const project = { id: 'p1', name: 'Fabric', estate_id: 'e1', default_agent: 'claude-code' } as ProjectRow

const detail = (over: Partial<TaskRow>, siblings?: TaskDetail['siblings'], notes?: TaskDetail['notes']): TaskDetail => ({
  task: {
    id: 't1',
    project_id: 'p1',
    instruction: 'ship the thing',
    title: 'Ship the thing',
    status: 'running',
    assigned_by: null,
    assigned_to: null,
    origin_kind: null,
    origin_ref: null,
    session_id: null,
    brief_what: null,
    brief_why: null,
    brief_expected: null,
    brief_author: null,
    brief_draft: null,
    ...over
  } as TaskRow,
  notes: notes ?? [],
  links: [],
  lease: null,
  events: [],
  siblings: siblings ?? { total: 0, shown: [] }
})

const mount = (
  over: Partial<TaskRow>,
  siblings?: TaskDetail['siblings'],
  notes?: TaskDetail['notes']
): void => {
  vi.stubGlobal('window', window)
  ;(window as unknown as { fabric: unknown }).fabric = {
    tasks: { detail: vi.fn().mockResolvedValue(detail(over, siblings, notes)) }
  }
  render(
    <TaskPage
      project={project}
      taskId="t1"
      onBack={() => {}}
      onChanged={async () => {}}
      onError={() => {}}
    />
  )
}

describe('the task page says who assigned it', () => {
  it('names both sides when the task carries a handoff', async () => {
    mount({ assigned_by: 'ceo', assigned_to: 'developer' })
    await waitFor(() => expect(screen.getByText('assigned by ceo to developer')).toBeTruthy())
  })

  it('says NOTHING when only one side is known, rather than naming an absence', async () => {
    mount({ assigned_by: 'ceo', assigned_to: null })
    // Wait for the page to have loaded something before asserting an absence —
    // otherwise this passes against an empty DOM and proves nothing.
    await waitFor(() => expect(screen.getByText('Ship the thing')).toBeTruthy())
    expect(screen.queryByText(/assigned by/)).toBeNull()
  })
})

describe('the tasks a document produced (M124)', () => {
  it('names the DOCUMENT, not "related" — which document is what makes the list trustworthy', async () => {
    mount(
      { origin_kind: 'document', origin_ref: 'docs/adr/0014.md:22' },
      { total: 1, shown: [{ id: 'x', title: 'Split the projector', status: 'backlog' }] }
    )
    await openTab(/^Tasks and sessions$/)
    await waitFor(() => expect(screen.getByText('Also from docs/adr/0014.md')).toBeTruthy())
    expect(screen.getByText('Split the projector')).toBeTruthy()
  })

  it('says how many it did not list, rather than ending the list quietly', async () => {
    // Same rule as the presets: a shortened list that does not say so reads as
    // the whole of it, and here the reader concludes a decision produced two
    // tasks when it produced forty.
    mount(
      { origin_kind: 'document', origin_ref: 'docs/adr/0014.md' },
      { total: 40, shown: [{ id: 'a', title: 'one', status: 'backlog' }] }
    )
    await openTab(/^Tasks and sessions$/)
    await waitFor(() => expect(screen.getByText('and 39 more, not listed here')).toBeTruthy())
  })

  it('shows no panel at all when the document produced only this task', async () => {
    mount({ origin_kind: 'document', origin_ref: 'docs/adr/0014.md' })
    await waitFor(() => expect(screen.getByText('Ship the thing')).toBeTruthy())
    await openTab(/^Tasks and sessions$/)
    expect(screen.queryByText(/Also from/)).toBeNull()
  })
})

describe('an idea can be looked into (M134)', () => {
  it('offers to look into an idea that is still in the backlog', async () => {
    mount({ task_type: 'idea', status: 'backlog' })
    await waitFor(() => expect(screen.getByText('Look into it')).toBeTruthy())
  })

  it('does NOT offer it on an ordinary task', async () => {
    // The act spawns work FROM a card. Offered on any task it would quietly
    // become "do this twice".
    mount({ task_type: null, status: 'backlog' })
    await waitFor(() => expect(screen.getByText('Ship the thing')).toBeTruthy())
    expect(screen.queryByText('Look into it')).toBeNull()
  })

  it('stops offering it once the idea has moved on', async () => {
    mount({ task_type: 'idea', status: 'running' })
    await waitFor(() => expect(screen.getByText('Ship the thing')).toBeTruthy())
    expect(screen.queryByText('Look into it')).toBeNull()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// UX28-01 — the text belongs to the task it was typed for.
//
// MEASURED at `d28c321`, and it is a data-loss defect a person can trigger by
// hand in two clicks. The brief fields were UNCONTROLLED — `defaultValue`, with
// the React key on the SECTION rather than on the task — so React reused the
// same DOM node across a task switch and never updated its value. A's words
// stayed in the box; `onBlur` then fired with A's text and saved it with
// whatever `taskId` the props carried by then. A's brief, written into B, with
// no error and nothing to undo it.
//
// Two more live on the same path: a `detail` load with no generation guard, so
// a late response for A renders under B; and a save guard that compares against
// `detail`, so two blurs before the reload both pass and append twice.

const briefDetail = (id: string, over: Partial<TaskRow> = {}): TaskDetail => ({
  ...detail({ id, title: 'Task ' + id, ...over })
})

const mountPair = (
  first: string,
  details: Record<string, TaskDetail>,
  detailImpl?: (id: string) => Promise<TaskDetail>
) => {
  vi.stubGlobal('window', window)
  const brief = vi.fn().mockResolvedValue(undefined)
  const note = vi.fn().mockResolvedValue(undefined)
  ;(window as unknown as { fabric: unknown }).fabric = {
    tasks: {
      detail: vi.fn((id: string) => detailImpl ? detailImpl(id) : Promise.resolve(details[id])),
      brief,
      note
    }
  }
  const view = render(
    <TaskPage project={project} taskId={first} onBack={() => {}} onChanged={async () => {}} onError={() => {}} />
  )
  const show = (id: string): void => {
    view.rerender(
      <TaskPage project={project} taskId={id} onBack={() => {}} onChanged={async () => {}} onError={() => {}} />
    )
  }
  return { brief, note, show }
}

const whatBox = (): HTMLTextAreaElement =>
  screen.getAllByRole('textbox')[0] as HTMLTextAreaElement

describe('UX28-01 — a brief is written into the task it was written for', () => {
  it('never saves A\'s words under B after a switch', async () => {
    const details = { A: briefDetail('A'), B: briefDetail('B') }
    const { brief, show } = mountPair('A', details)
    await waitFor(() => expect(screen.getByText('Task A')).toBeTruthy())

    fireEvent.change(whatBox(), { target: { value: 'this belongs to A' } })
    show('B')
    await waitFor(() => expect(screen.getByText('Task B')).toBeTruthy())
    fireEvent.blur(whatBox())

    for (const call of brief.mock.calls)
      expect(`${call[0]}|${call[2]}`).not.toBe(`B|this belongs to A`)
  })

  it("shows B's own brief after the switch, not the words still in the box", async () => {
    const details = {
      A: briefDetail('A', { brief_what: 'A wrote this' }),
      B: briefDetail('B', { brief_what: 'B wrote this' })
    }
    const { show } = mountPair('A', details)
    await waitFor(() => expect(whatBox().value).toBe('A wrote this'))
    show('B')
    await waitFor(() => expect(whatBox().value).toBe('B wrote this'))
  })

  it('keeps what was typed for A and gives it back on return', async () => {
    const details = { A: briefDetail('A'), B: briefDetail('B') }
    const { show } = mountPair('A', details)
    await waitFor(() => expect(screen.getByText('Task A')).toBeTruthy())
    fireEvent.change(whatBox(), { target: { value: 'half a thought' } })
    show('B')
    await waitFor(() => expect(screen.getByText('Task B')).toBeTruthy())
    show('A')
    await waitFor(() => expect(whatBox().value).toBe('half a thought'))
  })

  it('never displays A under B when A answers late', async () => {
    let releaseA: (d: TaskDetail) => void = () => {}
    const impl = (id: string): Promise<TaskDetail> =>
      id === 'A'
        ? new Promise<TaskDetail>((res) => { releaseA = res })
        : Promise.resolve(briefDetail('B'))
    const { show } = mountPair('A', {}, impl)
    show('B')
    await waitFor(() => expect(screen.getByText('Task B')).toBeTruthy())
    releaseA(briefDetail('A'))
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByText('Task A')).toBeNull()
    expect(screen.getByText('Task B')).toBeTruthy()
  })

  it('does not append the same edit twice when the field is blurred twice', async () => {
    const details = { A: briefDetail('A') }
    const { brief } = mountPair('A', details)
    await waitFor(() => expect(screen.getByText('Task A')).toBeTruthy())
    fireEvent.change(whatBox(), { target: { value: 'once' } })
    fireEvent.blur(whatBox())
    fireEvent.blur(whatBox())
    await waitFor(() => expect(brief).toHaveBeenCalled())
    expect(brief.mock.calls.filter((c) => c[2] === 'once')).toHaveLength(1)
  })

  it('lets a section be CLEARED, because empty is a value a brief can hold', async () => {
    // An empty note is nothing to add; an empty brief section is a decision.
    // Reusing the note rule here would make a section impossible to unwrite.
    const details = { A: briefDetail('A', { brief_what: 'written in haste' }) }
    const { brief } = mountPair('A', details)
    await waitFor(() => expect(whatBox().value).toBe('written in haste'))
    fireEvent.change(whatBox(), { target: { value: '' } })
    fireEvent.blur(whatBox())
    await waitFor(() => expect(brief).toHaveBeenCalled())
    expect(brief.mock.calls[0]).toEqual(['A', 'what', ''])
  })

  it('does not touch the brief at all when the field is only focused and left', async () => {
    // A blur with nothing typed must append no event: `brief_author` is
    // overwritten by every edit, so an empty edit would silently take the
    // authorship of a line the operator never wrote.
    const details = { A: briefDetail('A', { brief_what: 'the agent wrote this' }) }
    const { brief } = mountPair('A', details)
    await waitFor(() => expect(whatBox().value).toBe('the agent wrote this'))
    fireEvent.blur(whatBox())
    await new Promise((r) => setTimeout(r, 0))
    expect(brief).not.toHaveBeenCalled()
  })

  it('keeps the text when the save fails, so nothing typed is lost to an error', async () => {
    vi.stubGlobal('window', window)
    const brief = vi.fn().mockRejectedValue(new Error('offline'))
    ;(window as unknown as { fabric: unknown }).fabric = {
      tasks: { detail: vi.fn().mockResolvedValue(briefDetail('A')), brief }
    }
    render(
      <TaskPage project={project} taskId="A" onBack={() => {}} onChanged={async () => {}} onError={() => {}} />
    )
    await waitFor(() => expect(screen.getByText('Task A')).toBeTruthy())
    fireEvent.change(whatBox(), { target: { value: 'do not lose me' } })
    fireEvent.blur(whatBox())
    await waitFor(() => expect(brief).toHaveBeenCalled())
    expect(whatBox().value).toBe('do not lose me')
  })
})

describe('a note says who wrote it and when (UX28-06)', () => {
  it('names the author and the time, not only the kind', async () => {
    // `author_kind` was the whole lead: "agent". The id and the timestamp have
    // both been on the row since the note store existed and neither reached
    // the screen — a note nobody can attribute is a note nobody can follow up.
    mount({}, undefined, [
        {
          id: 'n1',
          task_id: 't1',
          author_kind: 'agent',
          author_id: 'deadbeefcafe0001',
          body_md: 'the migration needs a grant',
          promoted_fact_id: null,
          created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
        }
    ])
    await openTab(/^Next$/)
    await waitFor(() => expect(screen.getByTitle('deadbeefcafe0001')).toBeTruthy())
    const lead = screen.getByTitle('deadbeefcafe0001')
    expect(lead.textContent).toMatch(/agent/)
    // The shortened id is on the line; the full one is in the title, because a
    // truncated id is a label and a label is not a key.
    expect(lead.textContent).toMatch(/deadbeef/)
    expect(lead.textContent).not.toMatch(/deadbeefcafe0001/)
    // And WHEN — three hours is a different note from three weeks.
    expect(lead.textContent).toMatch(/3h|3 h|hour/i)
  })
})

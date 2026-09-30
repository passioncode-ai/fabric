// SCN-026 promised a receipt link on every feed row (UXA-C06).
//
// MEASURED at `afa17cd`: `Feed.tsx` is forty lines that render a sentence, a
// sequence number and a project name. No row opens anything — there is no
// handler, no `destinationOf`, no control. The journal is this product's spine
// (ADR-0014) and its rows were the one place a reader could not get from an
// event to the thing it happened to.
//
// The card's acceptance names the trap in the same breath: an unknown subject
// must state that it is unverified and MUST NOT invent a task id. So the
// navigable row is the exception that has been verified, not the default.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Feed } from './Feed'
import { I18nProvider } from './i18n'
import type { FeedEvent, ProjectRow } from '../../shared/types'

afterEach(cleanup)

const project = (): ProjectRow =>
  ({
    id: 'p1',
    estate_id: 'e1',
    name: 'Atlas',
    purpose: null,
    repo_path: null,
    status: 'active',
    config_revision: 1,
    created_at: '2026-09-11T00:00:00Z',
    memory_backend: 'local',
    default_agent: 'claude-code',
    mcp_servers: []
  }) as ProjectRow

const event = (type: string, payload: Record<string, unknown>, seq = 7): FeedEvent => ({
  estate_id: 'e1',
  seq,
  type,
  actor: { kind: 'system', id: 'x' },
  project_id: 'p1',
  occurred_at: '2026-09-11T00:00:00Z',
  payload
})

const show = (events: FeedEvent[], onOpen?: (projectId: string, ref: unknown) => void) =>
  render(
    <I18nProvider locale="en">
      <Feed events={events} projects={[project()]} onOpen={onOpen as never} />
    </I18nProvider>
  )

describe('a journal row opens the thing it happened to', () => {
  it('renders the row at all — the fixture is a described event', () => {
    // Asserted first: every case below is about the ACT on the row, and they
    // would all pass vacuously on a feed that rendered nothing.
    show([event('task.created@1', { id: 't-1' })])
    expect(screen.getByText(/#7/)).toBeTruthy()
  })

  it('opens the task a task row is about, through the one resolver', () => {
    const onOpen = vi.fn()
    show([event('task.created@1', { id: 't-1' })], onOpen)
    fireEvent.click(screen.getByRole('button'))
    expect(onOpen).toHaveBeenCalledWith('p1', { kind: 'task', id: 't-1' })
  })

  it('offers NO act for an event nobody has verified a subject for', () => {
    // The absence of an ACT, not the absence of a particular label — a probe
    // that looked for one button's name would pass on a differently-labelled
    // control that opened the wrong thing.
    const onOpen = vi.fn()
    show([event('agent.heartbeat@1', { session: 's1' })], onOpen)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('and none for a declared event whose row does not carry the key', () => {
    const onOpen = vi.fn()
    show([event('task.created@1', { title: 'no id here' })], onOpen)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('and none for a subject no screen can focus, however well known it is', () => {
    // `destinationOf` has four answers and only one is an address. A row whose
    // subject is real but unfocusable must not offer a click that does nothing.
    const onOpen = vi.fn()
    show([event('work.claimed@1', { work: 'w-1' })], onOpen)
    const acts = screen.queryAllByRole('button')
    for (const act of acts) fireEvent.click(act)
    expect(onOpen).not.toHaveBeenCalledWith('p1', { kind: 'work', id: 'w-1' })
  })

  it('and offers no act at all when the caller has no navigator to give', () => {
    // Three of the four places that render this feed have no entity navigator.
    // A control that cannot lead anywhere is worse than no control.
    show([event('task.created@1', { id: 't-1' })])
    expect(screen.queryByRole('button')).toBeNull()
  })
})

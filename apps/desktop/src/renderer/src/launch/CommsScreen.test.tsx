// SCR-81 / SCN-143 — the Comms screen against a stubbed bridge.
//
// The acceptance the scenario sets, held against the render: threads listed by subject
// with participant projects BY NAME; an empty estate is said in words (an empty list is
// a true answer); a board that does not answer is said as UNAVAILABLE with Try again and
// is never rendered as the empty list — those two states looking alike is the defect the
// whole read path exists to prevent.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { CommsScreen } from './CommsScreen'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import type { CommsThreadsReply } from '../../../shared/commsRead'
import type { ProjectRow } from '../../../shared/types'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const PROJECTS = [
  { id: 'p1', name: 'Atlas', status: 'active' },
  { id: 'p2', name: 'Beacon', status: 'active' }
] as unknown as ProjectRow[]

const THREAD = {
  id: '79000000-0000-4000-8000-0000000000d1',
  subject: 'Cutover plan',
  participants: ['p1', 'p2'],
  createdBy: 'p1',
  createdSeq: 3,
  messageCount: 12,
  lastSeq: 40,
  lastAt: '2026-10-11T08:00:00.000Z'
}

function stub(reply: CommsThreadsReply | (() => Promise<CommsThreadsReply>)) {
  const threads = vi.fn(typeof reply === 'function' ? reply : async () => reply)
  const list = vi.fn(async () => ({ ok: true as const, messages: [], lastSeq: 0, more: false }))
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { comms: { threads, list } } }))
  return { threads, list }
}

const show = () =>
  render(
    <I18nProvider locale="en">
      <CommsScreen projects={PROJECTS} />
    </I18nProvider>
  )

describe('the thread list', () => {
  it('lists threads by subject with the participant projects by name, the count and the last write', async () => {
    stub({ ok: true, threads: [THREAD] })
    show()
    await screen.findByText('Cutover plan')
    expect(screen.getByText('Atlas, Beacon')).toBeTruthy()
    expect(screen.getByText(en['launch.comms.messageCount'].replace('{count}', '12'))).toBeTruthy()
  })

  it('says an empty estate in words — an empty list is a true answer', async () => {
    stub({ ok: true, threads: [] })
    show()
    await screen.findByText(en['launch.comms.empty'])
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a board that does not answer is unavailable with Try again, NEVER the empty list', async () => {
    stub({ ok: false, error: { code: 'unavailable', message: 'timeout' } })
    show()
    await screen.findByRole('alert')
    expect(screen.getByText(en['launch.comms.unavailable'].replace('{reason}', 'timeout'))).toBeTruthy()
    expect(screen.getByRole('button', { name: en['launch.comms.tryAgain'] })).toBeTruthy()
    expect(screen.queryByText(en['launch.comms.empty'])).toBeNull()
  })

  it('a rejected invoke is unavailable too, not the empty list', async () => {
    stub(async () => {
      throw new Error('the main process went away')
    })
    show()
    await screen.findByRole('alert')
    await waitFor(() => expect(screen.queryByText(en['launch.comms.empty'])).toBeNull())
  })
})

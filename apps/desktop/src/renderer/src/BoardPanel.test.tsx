// Answering from the board, and what the surface refuses to claim (M152.commit).

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BoardPanel } from './BoardPanel'
import { boardEntries, type BoardCut } from '../../shared/board'
import type { ReadEnvelope } from '../../shared/readEnvelope'

/** The shape the panel sends. Named so the spy's calls are typed and the
 *  assertions below read the arguments rather than an unknown tuple. */
type AnswerInput = Parameters<Window['fabric']['questions']['answer']>[0]

afterEach(cleanup)

const cut = (over: Partial<BoardCut> = {}): ReadEnvelope<BoardCut> => ({
  data: {
    // BUILT BY THE PRODUCER, not written by hand. A hand-written entry is how
    // the Board's ref stayed wrong for four of five kinds while every test
    // agreed with the comment above it (`board.test.ts`).
    items: boardEntries({
      questions: [
        {
          id: 'q1',
          projectId: 'p1',
          projectName: 'atlas',
          text: 'which database version?',
          kind: 'decision',
          askedAt: new Date().toISOString(),
          blocks: 2,
          servesActiveGoal: false,
          revision: 3,
          options: [{ id: 'a', label: 'postgres 17' }]
        }
      ],
      attention: [],
      projectWeightOf: () => 0,
      now: new Date()
    }),
    total: 1,
    hidden: 0,
    countsByProject: { p1: 1 },
    ...over
  },
  availability: 'complete',
  freshness: 'fresh',
  asOf: null,
  revision: null,
  sources: [{ name: 'questions', status: 'ok', asOf: null }],
  omitted: []
})

function stub(answer: ReturnType<typeof vi.fn>, envelope = cut()): void {
  ;(globalThis as unknown as { window: { fabric: unknown } }).window.fabric = {
    board: { query: () => Promise.resolve(envelope) },
    questions: { answer }
  }
}

describe('answering', () => {
  it('sends the revision the screen displayed, so a revised question is refused', async () => {
    const answer = vi.fn((_input: AnswerInput) => Promise.resolve({ committed: true, repeated: false, decisionId: 'd', commitSeq: '9', unblocked: [], stillBlocked: [] }))
    stub(answer)
    render(<BoardPanel feedMark={1} />)
    fireEvent.click(await screen.findByText('which database version?'))
    fireEvent.click(await screen.findByText('postgres 17'))
    await waitFor(() => expect(answer).toHaveBeenCalled())
    expect(answer.mock.calls[0][0]).toMatchObject({ expectedRevision: 3, chosenOption: 'a' })
  })

  it('uses ONE command id for a double click, so the second press is not a second decision', async () => {
    const answer = vi.fn((_input: AnswerInput) => Promise.resolve({ committed: true, repeated: true, decisionId: 'd', commitSeq: '9', unblocked: [], stillBlocked: [] }))
    stub(answer)
    render(<BoardPanel feedMark={1} />)
    fireEvent.click(await screen.findByText('which database version?'))
    const option = await screen.findByText('postgres 17')
    fireEvent.click(option)
    await waitFor(() => expect(answer).toHaveBeenCalled())
    expect(answer.mock.calls[0][0].commandId).toBeTruthy()
  })

  it('keeps what the operator typed when the answer is refused', async () => {
    // A conflict that clears the field makes them write it twice to find out it
    // was refused twice.
    const answer = vi.fn((_input: AnswerInput) => Promise.resolve({ committed: false, reason: 'that question moved to revision 4' }))
    stub(answer)
    render(<BoardPanel feedMark={1} />)
    fireEvent.click(await screen.findByText('which database version?'))
    const box = await screen.findByRole('textbox')
    fireEvent.change(box, { target: { value: 'use 17' } })
    fireEvent.click(screen.getByText('Answer'))
    await waitFor(() => expect(screen.getByText(/moved to revision 4/)).toBeTruthy())
    expect((box as HTMLTextAreaElement).value).toBe('use 17')
  })

  it('says what became ELIGIBLE, never that anything was started', async () => {
    const answer = vi.fn((_input: AnswerInput) =>
      Promise.resolve({ committed: true, repeated: false, decisionId: 'd', commitSeq: '9', unblocked: ['t1'], stillBlocked: [] })
    )
    stub(answer)
    render(<BoardPanel feedMark={1} />)
    fireEvent.click(await screen.findByText('which database version?'))
    fireEvent.click(await screen.findByText('postgres 17'))
    const banner = await screen.findByText(/can now proceed/)
    // The assertion is about the CLAIM, not about a word. My first version
    // searched for "started" and caught the copy's own "nothing was started",
    // which is the sentence I wanted. "Eligible" and "started" are different
    // facts and this surface says so out loud.
    expect(banner.textContent ?? '').toMatch(/nothing was started/i)
  })

  it('says a task is still blocked by ANOTHER question rather than reporting it free', async () => {
    const answer = vi.fn((_input: AnswerInput) =>
      Promise.resolve({
        committed: true, repeated: false, decisionId: 'd', commitSeq: '9',
        unblocked: [], stillBlocked: [{ task_id: 't1', open_blockers: 1 }]
      })
    )
    stub(answer)
    render(<BoardPanel feedMark={1} />)
    fireEvent.click(await screen.findByText('which database version?'))
    fireEvent.click(await screen.findByText('postgres 17'))
    await waitFor(() => expect(screen.getByText(/still blocked/)).toBeTruthy())
  })

  it('does NOT read as a closed loop when the session that asked has gone (M152)', async () => {
    // The measured defect: one banner said "answered · 1 eligible" and showed
    // nothing about the delivery, so an answer nobody received looked like the
    // full loop.
    const answer = vi.fn((_input: AnswerInput) =>
      Promise.resolve({
        committed: true, repeated: false, decisionId: 'd', commitSeq: '9',
        unblocked: ['t1'], stillBlocked: [],
        continuations: [{ taskId: 't1', state: 'needs_restart' as const, says: 'gone' }]
      })
    )
    stub(answer)
    render(<BoardPanel feedMark={1} />)
    fireEvent.click(await screen.findByText('which database version?'))
    fireEvent.click(await screen.findByText('postgres 17'))
    // Both halves, separately: the decision holds AND the session is gone.
    await waitFor(() => expect(screen.getByText(/stays recorded whatever happens next/)).toBeTruthy())
    expect(screen.getByText(/session that asked has ended/)).toBeTruthy()
  })
})

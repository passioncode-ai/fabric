// «Нужны вы» on the home (the operator's walk, OF-14, 2026-10-22): what is needed from the person, each row opening in
// place to read all of it, with the way to the board inside it.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { HomeBoard } from './HomeParts'

const entry = {
  kind: 'review', ref: 'review:t1', projectId: 'p1', projectName: 'Switchboard', title: 'SB-114: recovery after account limits',
  detail: 'The agent finished and asks you to check the recovery path', waitingSince: '2026-10-12T00:00:00Z', origin: 'derived'
}

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('the home says what is needed from the person (OF-14)', () => {
  it('is titled «Нужны вы», and a row opens in place to read all of it, with the way to the board', async () => {
    vi.stubGlobal('window', Object.assign(window, { fabric: { board: { query: vi.fn(async () => ({ data: { items: [entry], total: 1, hidden: 0, countsByProject: {} }, sources: [], asOf: null, freshness: 'fresh' })) } } }))
    const onBoard = vi.fn()
    const { container } = render(<I18nProvider locale="en"><HomeBoard feedMark={0} onBoard={onBoard} /></I18nProvider>)
    expect(screen.getByRole('heading', { name: new RegExp(en['launch.home.board.title']) })).toBeTruthy()
    await waitFor(() => expect(screen.getByText(/SB-114/)).toBeTruthy())
    const row = container.querySelector('details.lh-need') as HTMLDetailsElement
    expect(row).toBeTruthy()
    expect(row.textContent).toContain('Switchboard')
    fireEvent.click(row.querySelector('summary')!)
    expect(row.textContent).toContain('asks you to check the recovery path')
    fireEvent.click(screen.getByRole('button', { name: en['launch.home.board.openOne'] }))
    // The row's own ref, so the board opens on it (0.3.11 review UX-4).
    expect(onBoard).toHaveBeenCalledWith(entry.ref)
  })
})

describe('«Нужны вы» shows only what the person resolves, naming who asks (CO-391)', () => {
  it('asks the board for the person\'s part only, and names the asking agent, an unknown agent or a person', async () => {
    const q = (id: string, askedBy: unknown) => ({ kind: 'question', ref: `question:${id}`, projectId: 'p1', projectName: 'Fabric', title: `Q ${id}`, detail: null, waitingSince: '2026-10-22T00:00:00Z', origin: 'authored', askedBy })
    const query = vi.fn(async () => ({ data: { items: [q('1', { kind: 'agent', agent: 'claude-code' }), q('2', { kind: 'agent', agent: null }), q('3', { kind: 'person', agent: null })], total: 3, hidden: 0, countsByProject: {} }, sources: [], asOf: null, freshness: 'fresh' }))
    vi.stubGlobal('window', Object.assign(window, { fabric: { board: { query } } }))
    const { container } = render(<I18nProvider locale="en"><HomeBoard feedMark={0} onBoard={vi.fn()} /></I18nProvider>)
    await waitFor(() => expect(screen.getByText('Q 1')).toBeTruthy())
    expect(query).toHaveBeenCalledWith({ projectId: null, limit: 3, personOnly: true })
    const text = container.textContent ?? ''
    expect(text).toMatch(/Fabric · Claude Code asks/)
    expect(text).toContain('Fabric · ' + en['needsYou.askedByAnAgent'])
    expect(text).toContain('Fabric · ' + en['needsYou.askedByPerson'])
  })
})

describe('a question on Главная is answered where it is read (SCN-163 step 2, CO-391)', () => {
  it('shows the options as buttons and records the chosen one; the count reaches the greeting', async () => {
    const item = { kind: 'question', ref: 'question:q9', subject: { kind: 'question', id: 'q9' }, projectId: 'p1', projectName: 'Fabric', title: 'Which?', detail: null, waitingSince: '2026-10-22T00:00:00Z', origin: 'authored', askedBy: { kind: 'person', agent: null }, question: { revision: 2, options: [{ id: 'a', label: 'Keep it' }, { id: 'b', label: 'Drop it' }] } }
    const query = vi.fn(async () => ({ data: { items: [item], total: 1, hidden: 0, countsByProject: {} }, sources: [], asOf: null, freshness: 'fresh' }))
    const answer = vi.fn(async (_input: unknown) => ({ committed: true, repeated: false, unblocked: [], stillBlocked: [], continuations: [] }))
    vi.stubGlobal('window', Object.assign(window, { fabric: { board: { query }, questions: { answer } } }))
    const onTotal = vi.fn()
    render(<I18nProvider locale="en"><HomeBoard feedMark={0} onBoard={vi.fn()} onTotal={onTotal} /></I18nProvider>)
    await waitFor(() => expect(screen.getByText('Which?')).toBeTruthy())
    expect(onTotal).toHaveBeenCalledWith(1)
    fireEvent.click(screen.getByRole('button', { name: 'Drop it' }))
    await waitFor(() => expect(answer).toHaveBeenCalled())
    expect(answer.mock.calls[0]?.[0]).toMatchObject({ questionId: 'q9', projectId: 'p1', expectedRevision: 2, chosenOption: 'b' })
  })
})

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

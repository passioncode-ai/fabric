// CO-522 wave B part 2: two sessions that overlap are decided where the item is read.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { OverlapDecision } from './OverlapDecision'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const KEY = 'overlap-unsettled:11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222'

describe('OverlapDecision', () => {
  it('sends the chosen answer for the item and says it is recorded', async () => {
    const overlapDecide = vi.fn(async () => ({ ok: true }))
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { overlapDecide } } }))
    render(<I18nProvider locale="en"><OverlapDecision itemKey={KEY} /></I18nProvider>)
    fireEvent.click(screen.getByRole('button', { name: en['overlap.wait'] }))
    await waitFor(() => expect(overlapDecide).toHaveBeenCalledWith({ key: KEY, choice: 'wait' }))
    expect(await screen.findByText(en['overlap.done'])).toBeTruthy()
  })
  it('a refusal is said with its reason and the answers stay', async () => {
    const overlapDecide = vi.fn(async () => ({ ok: false, reason: 'one of the two sessions no longer holds its task' }))
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { overlapDecide } } }))
    render(<I18nProvider locale="en"><OverlapDecision itemKey={KEY} /></I18nProvider>)
    fireEvent.click(screen.getByRole('button', { name: en['overlap.split'] }))
    expect(await screen.findByText(/no longer holds its task/)).toBeTruthy()
    expect(screen.getByRole('button', { name: en['overlap.handover'] })).toBeTruthy()
  })
})

// 0.3.7 review UX-11: this release's rule is that buttons and links no longer end in an arrow; Главная's rhythm link
// read «14 дн. ↗», the glyph part of its accessible name.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { ru } from '../i18n/ru'
import { HomeRhythm } from './HomeParts'
import { RHYTHM_DAYS } from '../../../shared/homeView.ts'

afterEach(cleanup)

describe('the rhythm link on Главная', () => {
  it('is named by its days alone, with no arrow, and opens the pulse', () => {
    const onPulse = vi.fn()
    render(<I18nProvider locale="ru"><HomeRhythm feed={[]} now={new Date('2026-10-20T10:00:00Z')} onPulse={onPulse} /></I18nProvider>)
    const name = (ru['launch.home.rhythm.days'] ?? en['launch.home.rhythm.days']).replace('{days}', String(RHYTHM_DAYS))
    const button = screen.getByRole('button', { name })
    expect(button.textContent).not.toMatch(/[↗→]/)
    fireEvent.click(button)
    expect(onPulse).toHaveBeenCalledOnce()
  })
})

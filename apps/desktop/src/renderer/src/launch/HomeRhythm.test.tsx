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

// The mockup parity (home gaps D1, D2): the chart and its totals are main's per-day counts (`work.rhythm`), never the
// window's newest 500 events, in which every day of a busy journal read as unknown.
describe('the rhythm from main\'s per-day counts', () => {
  const days = Array.from({ length: RHYTHM_DAYS }, (_, i) => ({
    date: `2026-10-${String(i + 1).padStart(2, '0')}`, events: i === 3 ? null : i * 10, results: 1, decisions: 0, today: i === RHYTHM_DAYS - 1
  }))
  const rhythm = { days, totals: { results: 31, decisions: 9, events: 3780 }, today: { results: 1, decisions: 0, events: 270 }, marksCapped: false, timeZone: 'Europe/Warsaw', readAt: '2026-10-28T10:00:00Z' }

  it('draws each read day, an unread day hatched, today in ink, and the totals by the one definition', () => {
    const { container } = render(<I18nProvider locale="ru"><HomeRhythm feed={[]} now={new Date('2026-10-28T10:00:00Z')} rhythm={{ rhythm, problem: null }} /></I18nProvider>)
    const bars = [...container.querySelectorAll('.lh-spark [role=listitem]')]
    expect(bars).toHaveLength(RHYTHM_DAYS)
    expect(bars.filter((b) => b.classList.contains('unknown'))).toHaveLength(1)
    expect(bars.at(-1)?.classList.contains('today')).toBe(true)
    expect(bars[5].getAttribute('aria-label')).toBe('06.10 · событий: 50')
    expect(container.querySelector('.lh-totals')?.textContent).toBe('решений: 9 · результатов: 31')
  })

  it('a capped read of the marks says its totals are floors; a failed read says they are not read, never zero', () => {
    const { container } = render(<I18nProvider locale="en"><HomeRhythm feed={[]} now={new Date('2026-10-28T10:00:00Z')} rhythm={{ rhythm: { ...rhythm, marksCapped: true }, problem: null }} /></I18nProvider>)
    expect(container.querySelector('.lh-totals')?.textContent).toBe('9+ decisions · 31+ results')
    cleanup()
    const failed = render(<I18nProvider locale="en"><HomeRhythm feed={[]} now={new Date('2026-10-28T10:00:00Z')} rhythm={{ rhythm: null, problem: 'gone' }} /></I18nProvider>)
    expect(failed.container.querySelector('.lh-totals')?.textContent).toBe(en['launch.home.rhythm.totalsUnread'])
    expect(failed.container.querySelector('.lh-totals')?.getAttribute('title')).toBe('gone')
    expect([...failed.container.querySelectorAll('.lh-spark .unknown')]).toHaveLength(RHYTHM_DAYS)
  })
})
